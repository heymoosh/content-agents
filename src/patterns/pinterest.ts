// The Pinterest collector: logged-out HTML, parsed with regex and JSON, into staged corpus
// entries stamped with the era they were published in.
//
// WHY THIS COLLECTOR EXISTS, AND WHAT IT IS NOT FOR. Read this before using its output.
//
// Pinterest's delivery to informational content collapsed around 2020. A probe of 459 pins across
// 31 accounts measured the same accounts posting the same format in different years: ADDitude
// Magazine's 2017 pins carry 15,201 and 14,710 saves and its 2026 pins carry 1 to 3. A lifestyle
// control group decayed about 20x over the same span while the informational niches decayed about
// 2,000x. So this collector is NOT a read on what works on Pinterest today, and nothing it
// collects should be presented that way.
//
// What it is for: the archive. Historically the best-performing ADHD and productivity content
// anywhere on any platform was Pinterest tip-graphics, text typeset onto an image, which is
// exactly the format Muxin already produces as quote cards. The top collected ADHD pin carries
// 104,864 saves against a top home-decor pin's 93,185. Thousands of proven 2014-2019 tip-graphic
// STRUCTURES are still readable, and that is the asset. Dead 2026 pins are collected too, because
// leaving them out would hide the collapse, but every entry carries `era` so nothing downstream
// can quietly mix a 2016 winner into a 2026 ranking. See src/patterns/era.ts for the boundaries
// and for the lifetime-cumulative-count confound that limits every era comparison.
//
// NEVER fetched through a model-backed tool. A model-backed fetch once silently rewrote 14 of 15
// post bodies on this project and attributed a stranger's comment to the author. This file issues
// plain HTTP requests and copies fields across without touching them.
//
// WHAT IT CANNOT DO, stated here rather than discovered later:
//
//   - It cannot read the words ON the graphic, and the fields that look like they might are SEO
//     metadata. CORRECTED 2026-08-23 after the winning images were downloaded and looked at:
//     `headline` is Pinterest's SEO-generated title and is frequently unrelated to the words
//     printed on the image. Pin 197736239865673673 carries the headline "Entrepreneurship Chart
//     Ideas For Students" over a graphic that reads "MARK CUBAN'S 12 RULES FOR STARTUPS"; pin
//     420453315189959306 carries "Productivity Process Flow Chart" over "HOW TO BE PRODUCTIVE by
//     Anna Vital". So the JSON text fields cannot deliver the on-image text at all, and no field
//     on a pinterest entry may be read as the creator's words. Every entry is body_is_complete
//     false with onscreen_text null, and `media.asset_url` carries the image url so a later
//     transcription pass has the file. That pass is NOT built here: reading words off an image is
//     its own decision, with its own cost and its own provenance rules.
//   - It cannot tell an original from a repin. `author.alternateName` names whoever owns THIS
//     copy, so a board's biggest pin is often someone else's work saved by the board owner. The
//     probe's single largest lifestyle pin, 93,185 saves, is exactly that. Every entry says so in
//     its notes.
//   - It cannot page a board. Logged out, a board's server-rendered payload carries roughly 21 to
//     25 pins and the paging endpoints answer 403. Those pins are the board's FIRST PAGE, not its
//     top 25, and `sample.role` is "unranked" to say so.
//   - It cannot discover anything. /search/pins/, /ideas/ and /today/ all answer 200 with zero
//     pins logged out. Accounts and boards come from the seeded list in
//     config/pattern-mining.yaml, which is the primary path rather than a convenience.

import "../util/env.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithRetry } from "../util/fetch-retry.js";
import { INBOX_DIR, makeId, normalizeHandle, readCorpus } from "./corpus.js";
import { CORPUS_PATH } from "./corpus.js";
import { loadConfig } from "./collect.js";
import { countByEra, eraFor, filterByEra, isImplausibleDate, isPostEra } from "./era.js";
import type { AccountSeed, CorpusEntry, PatternMiningConfig, PostEra } from "./types.js";

export const PINTEREST_BASE = "https://www.pinterest.com";

// The exact string the probe made roughly 550 successful requests with, zero 403s and zero 429s.
// Pinterest serves a different, emptier page to a default client, so this is load-bearing rather
// than decoration.
export const PINTEREST_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// One second between requests, which is the rate the probe ran at without ever being throttled.
export const DEFAULT_POLITENESS_MS = 1000;

// A board's server-rendered payload holds about this many pins. Asking for more does not fail, it
// just returns what is there, and the cap exists so one enormous board cannot eat a whole run.
export const DEFAULT_MAX_PINS_PER_BOARD = 25;

// ------------------------------------------------------------------------------------------
// Parsing. Every function here is pure: HTML string in, plain data out, no fetching.
// ------------------------------------------------------------------------------------------

// The profile page's ld+json identity card. The profile block is served with BOTH id= and
// data-test-id= forms, so either matches; the pin page below carries only data-test-id, and
// matching id="leaf-snippet" there finds nothing, which already cost one wasted pass.
const PROFILE_SNIPPET_RE = /<script[^>]*(?:data-test-)?id="profile-snippet"[^>]*>([\s\S]*?)<\/script>/;

// Same attribute trap on the pin page.
const LEAF_SNIPPET_RE = /<script[^>]*data-test-id="leaf-snippet"[^>]*>([\s\S]*?)<\/script>/;

// The page's server-rendered redux state: follower records, board index and the related-user
// graph all live here.
//
// The id matters and is easy to get wrong. Several handoff notes call this blob `__PWS_DATA__`.
// A profile page DOES carry a script with that id, but it is an 82KB client config blob with no
// user objects in it at all: walking it for a username finds zero matches. The data is under
// `__PWS_INITIAL_PROPS__`. Both ids are tried, first match wins, so a page that really does use
// the other one still parses.
const PROPS_BLOB_IDS = ["__PWS_INITIAL_PROPS__", "__PWS_DATA__"] as const;

// A handle can carry an underscore and a digit but nothing regex-special. Escaped anyway, because
// a handle is external input and a handle that changes what a pattern means is a bug nobody finds.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseJsonScript(html: string, re: RegExp): unknown | null {
  const match = re.exec(html);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return null;
  }
}

export interface ProfileSnippet {
  // The handle Pinterest says this page belongs to.
  handle: string | null;
  displayName: string | null;
  // Followers, where the ld+json carries them. ABSENT on many real profiles, including
  // additudemag, pipshints, sandrarief and kiddiematters, which is why the props route below is
  // required rather than optional. Null here means "this route did not say", never "zero".
  followers: number | null;
}

// Reads the ld+json identity card. Returns null when the page has no snippet at all, which is a
// real case (joannagaines) and means "could not verify from this route", not "empty profile".
export function parseProfileSnippet(html: string): ProfileSnippet | null {
  const parsed = parseJsonScript(html, PROFILE_SNIPPET_RE);
  if (parsed === null || typeof parsed !== "object") return null;
  const main = (parsed as Record<string, unknown>).mainEntity;
  if (typeof main !== "object" || main === null) return null;
  const entity = main as Record<string, unknown>;
  const alternate = entity.alternateName;
  const name = entity.name;
  return {
    handle: typeof alternate === "string" && alternate.trim() !== "" ? alternate.trim() : null,
    displayName: typeof name === "string" && name.trim() !== "" ? name.trim() : null,
    followers: followersFromInteractionStatistic(entity.interactionStatistic),
  };
}

// interactionStatistic is a DICT on a profile, not the list it is on a pin. Both shapes are
// accepted so a change on Pinterest's side does not silently zero every follower count.
export function followersFromInteractionStatistic(raw: unknown): number | null {
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const type = JSON.stringify(record.interactionType ?? "");
    if (!type.includes("FollowAction")) continue;
    const count = record.userInteractionCount;
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) return count;
  }
  return null;
}

export function parseInitialProps(html: string): unknown | null {
  for (const id of PROPS_BLOB_IDS) {
    const parsed = parseJsonScript(html, new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`));
    if (parsed !== null) return parsed;
  }
  return null;
}

export interface ProfileFromProps {
  displayName: string | null;
  followers: number | null;
  // Which route inside the blob answered, printed in the run log so a surprising number can be
  // traced without re-fetching. "user-resource" is the page's own record for the handle that was
  // asked for; "walk" is the weaker fallback described below.
  source: "user-resource" | "walk";
}

// The authoritative route. The profile page keeps its own answer under a UserResource key that
// literally contains the requested username, so this is an exact-handle lookup rather than a
// search for something that looks right. 65 of 66 captured profiles carried it.
function userResourceFor(props: unknown, handle: string): Record<string, unknown> | null {
  const state = (props as { initialReduxState?: unknown })?.initialReduxState;
  if (typeof state !== "object" || state === null) return null;
  const resources = (state as Record<string, unknown>).resources;
  if (typeof resources !== "object" || resources === null) return null;
  const users = (resources as Record<string, unknown>).UserResource;
  if (typeof users !== "object" || users === null) return null;
  const needle = `"username","${normalizeHandle(handle)}"`;
  for (const [key, value] of Object.entries(users as Record<string, unknown>)) {
    if (!key.replace(/\s+/g, "").toLowerCase().includes(needle)) continue;
    const data = (value as { data?: unknown })?.data;
    if (typeof data === "object" && data !== null && !Array.isArray(data)) return data as Record<string, unknown>;
  }
  return null;
}

// The fallback: walk the blob for any object whose `username` equals the handle and which carries
// a follower count, then take the value that appears most often. Weaker than the route above
// because the same blob also describes other people (board collaborators, related pinners), so
// the handle match is doing all the work. Used only when the exact record is missing.
function walkForFollowers(props: unknown, handle: string): { displayName: string | null; followers: number } | null {
  const wanted = normalizeHandle(handle);
  const hits: { displayName: string | null; followers: number }[] = [];
  const seen = new Set<unknown>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    if (seen.has(node)) return;
    seen.add(node);
    const record = node as Record<string, unknown>;
    const username = record.username;
    if (typeof username === "string" && normalizeHandle(username) === wanted) {
      const count = record.follower_count ?? record.followerCount;
      if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
        const name = record.full_name;
        hits.push({ displayName: typeof name === "string" && name.trim() !== "" ? name.trim() : null, followers: count });
      }
    }
    for (const child of Object.values(record)) visit(child);
  };
  visit(props);
  if (hits.length === 0) return null;
  const tally = new Map<number, number>();
  for (const hit of hits) tally.set(hit.followers, (tally.get(hit.followers) ?? 0) + 1);
  let best = hits[0].followers;
  for (const [value, count] of tally) if (count > (tally.get(best) ?? 0)) best = value;
  return hits.find((hit) => hit.followers === best) ?? hits[0];
}

export function profileFromProps(props: unknown, handle: string): ProfileFromProps | null {
  const exact = userResourceFor(props, handle);
  if (exact) {
    const count = exact.follower_count ?? exact.followerCount;
    const name = exact.full_name;
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
      return {
        displayName: typeof name === "string" && name.trim() !== "" ? name.trim() : null,
        followers: count,
        source: "user-resource",
      };
    }
  }
  const walked = walkForFollowers(props, handle);
  return walked ? { ...walked, source: "walk" } : null;
}

export interface PinterestBoard {
  slug: string;
  name: string | null;
  // Pinterest's own count of everything on the board. Almost always far larger than what a
  // logged-out fetch can reach, and printed next to the collected count so the gap is visible.
  pinCount: number | null;
}

// Boards the handle actually OWNS, read structurally out of the props blob. A profile page also
// describes boards belonging to other people (related boards, boards a pin was saved to), and
// collecting one of those would file another creator's pins under this account.
export function boardsFromProps(props: unknown, handle: string): PinterestBoard[] {
  const wanted = normalizeHandle(handle);
  const state = (props as { initialReduxState?: unknown })?.initialReduxState;
  const boards = typeof state === "object" && state !== null ? (state as Record<string, unknown>).boards : null;
  if (typeof boards !== "object" || boards === null) return [];
  const found: PinterestBoard[] = [];
  const seen = new Set<string>();
  for (const value of Object.values(boards as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const board = value as Record<string, unknown>;
    const owner = board.owner;
    const ownerName = typeof owner === "object" && owner !== null ? (owner as Record<string, unknown>).username : null;
    if (typeof ownerName !== "string" || normalizeHandle(ownerName) !== wanted) continue;
    const url = board.url;
    if (typeof url !== "string") continue;
    const slug = boardSlugFromUrl(url, wanted);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const name = board.name;
    const pinCount = board.pin_count;
    found.push({
      slug,
      name: typeof name === "string" && name.trim() !== "" ? name.trim() : null,
      pinCount: typeof pinCount === "number" && Number.isFinite(pinCount) ? pinCount : null,
    });
  }
  return found;
}

export function boardSlugFromUrl(url: string, handle: string): string | null {
  const match = new RegExp(`^/${escapeRegex(normalizeHandle(handle))}/([a-z0-9-]+)/$`).exec(url.toLowerCase());
  return match ? match[1] : null;
}

// The raw-HTML fallback for board slugs, kept because it is what the probe verified and because it
// still answers on a page whose props blob changed shape. It cannot check ownership, so its
// results are only used when the structural route found nothing.
export function boardSlugsFromHtml(html: string, handle: string): string[] {
  const re = new RegExp(`"url":"/${escapeRegex(normalizeHandle(handle))}/([a-z0-9-]+)/"`, "g");
  const slugs = new Set<string>();
  for (const match of html.matchAll(re)) slugs.add(match[1]);
  return [...slugs].sort();
}

// Usernames of OTHER accounts named on a profile page: Pinterest's related-user graph.
//
// This is the one discovery route that works logged out, and it is why a seeded crawl is possible
// at all. The search surfaces are dead: /search/pins/?q=, /ideas/<slug>/ and /today/ all answer
// 200 with zero pins. A profile page instead names its neighbourhood, 46 accounts on additudemag
// and 78 on kiddiematters, so one hand-picked handle per topic fans out.
//
// USERNAMES ONLY, and that limit is not a style choice. The graph's follower numbers are wrong:
// proximity parsing misattributes counts across adjacent user objects, and careercontessa and
// prepary both read 80,467 off a third party's page while a direct fetch of prepary returns
// 5,673. This function therefore returns names and nothing else, so there is no number here for a
// caller to record by accident. Every count must come from re-fetching that handle's own profile.
export function relatedHandlesFromProps(props: unknown, excluding: string): string[] {
  const skip = normalizeHandle(excluding);
  const names = new Set<string>();
  const seen = new Set<unknown>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    if (seen.has(node)) return;
    seen.add(node);
    const record = node as Record<string, unknown>;
    const username = record.username;
    if (typeof username === "string" && username.trim() !== "" && normalizeHandle(username) !== skip) {
      names.add(username.trim());
    }
    for (const child of Object.values(record)) visit(child);
  };
  visit(props);
  return [...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// Pin ids off a board page, in payload order, deduped. Order is preserved because it is the only
// positional information the page gives, and it is recorded as `sample.rank`.
export function pinIdsFromBoard(html: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/"type":"pin","id":"(\d+)"/g)) {
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    ids.push(match[1]);
  }
  return ids;
}

export interface PinterestPin {
  id: string;
  url: string;
  // Pinterest's SEO-GENERATED TITLE. Present on 452 of 466 captured pins and free of the
  // boilerplate that pollutes articleBody, so it is the most reliable STRING available. It is not
  // the most reliable FACT: it frequently has nothing to do with the words printed on the image
  // (see the module header for two confirmed cases). Treat it as metadata about the pin, never as
  // the creator's words and never as the graphic's text.
  headline: string | null;
  // Pinterest's description field. Also SEO metadata, and even less reliable than the headline. On
  // many pins it is a machine-built keyword blob ("Adhd management, Adhd strategies, Adhd
  // executive"), on about 18 percent it arrives with a date prefix, and on a handful it is pure
  // boilerplate. Cleaned by cleanArticleBody before it is used at all.
  articleBody: string | null;
  // Pinterest's own published date for the image. Kept exactly as served, including the one pin
  // that claims a date in the future.
  datePublished: string | null;
  // Whoever owns THIS copy of the pin. Not necessarily whoever made the image.
  author: string | null;
  // Where the pin points, when it points anywhere.
  sharedUrl: string | null;
  // The image file itself, full resolution, off the ld+json `image` field. THIS is where the pin's
  // actual substance lives, and recording it is what makes a later transcription pass possible
  // without re-fetching every pin page.
  imageUrl: string | null;
  // Global aggregate saves across every copy of this image on Pinterest.
  aggregateSaves: number | null;
  // This copy's own repins. The number attributable to the account that posted it.
  repinCount: number | null;
  // When THIS copy was saved to a board, which is a different fact from datePublished and differs
  // by more than a year on 62 of 442 captured pins. A repin of a 2012 image made in 2018 reads
  // 2012 published and 2018 created. Recorded so the divergence is visible, never used for era.
  copyCreatedAt: string | null;
}

const BOILERPLATE_BODIES = [
  "Discover (and save!) your own Pins on Pinterest.",
  "Discover (and save!) your own Pins on Pinterest",
];

const PINTEREST_BODY_NOT_CAPTURED = "[Pinterest body not captured]";

// Strips the date prefix Pinterest prepends to roughly 18 percent of articleBody values, and
// refuses the boilerplate outright.
//
// The separator in that prefix is a real em dash, written here as an escape rather than as the
// character, because CLAUDE.md rule 5 bans the character from this repo's own source. The HTML
// being parsed is another site's data and keeps whatever it keeps.
export function cleanArticleBody(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  let text = raw.trim();
  text = text.replace(/^[A-Z][a-z]{2}\s+\d{1,2},\s*\d{4}\s*\u2014\s*/, "").trim();
  if (text === "") return null;
  for (const boilerplate of BOILERPLATE_BODIES) {
    if (text === boilerplate) return null;
  }
  return text;
}

export function pinUrl(id: string): string {
  return `${PINTEREST_BASE}/pin/${id}/`;
}

export function parsePin(html: string, id: string): PinterestPin | null {
  const parsed = parseJsonScript(html, LEAF_SNIPPET_RE);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const snippet = parsed as Record<string, unknown>;
  const author = snippet.author;
  const shared = snippet.sharedContent;
  const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
  // repinCount and createdAt live in the redux blob, not in the ld+json, and a narrow regex is
  // enough for both: they are plain numeric and string fields with no nesting to walk.
  const repin = /"repinCount":(\d+)/.exec(html);
  const created = /"createdAt":"([^"]+)"/.exec(html);
  return {
    id,
    url: pinUrl(id),
    headline: str(snippet.headline),
    articleBody: str(snippet.articleBody),
    datePublished: str(snippet.datePublished),
    author: typeof author === "object" && author !== null ? str((author as Record<string, unknown>).alternateName) : null,
    sharedUrl: typeof shared === "object" && shared !== null ? str((shared as Record<string, unknown>).url) : null,
    imageUrl: str(snippet.image),
    aggregateSaves: savesFromInteractionStatistic(snippet.interactionStatistic),
    repinCount: repin ? Number(repin[1]) : null,
    copyCreatedAt: created ? created[1] : null,
  };
}

// Pinterest labels the counter by `description`, not by interaction type: the type is LikeAction
// even though the number is saves. Matching on the type would silently read the wrong counter if
// Pinterest ever added a second one.
export function savesFromInteractionStatistic(raw: unknown): number | null {
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (record.description !== "Saves") continue;
    const count = record.userInteractionCount;
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) return count;
  }
  return null;
}

// ------------------------------------------------------------------------------------------
// Identity. Pinterest vanity handles collide, and this project has been burned by impostor
// accounts on four platforms.
// ------------------------------------------------------------------------------------------

export type IdentityStatus = "verified" | "unverified" | "mismatch";

export interface IdentityVerdict {
  status: IdentityStatus;
  observedHandle: string | null;
  observedName: string | null;
  reason: string;
}

// Compares what the page says against what the seed expects.
//
// The handle check alone is NOT enough and the code must not pretend otherwise: /jasminestar/
// resolves to a different person entirely, and that page's alternateName still reads
// "jasminestar" because the impostor genuinely owns the handle. What catches it is the DISPLAY
// NAME, "Sharon Stewart" against an expected "Jasmine Star". So a name conflict is a hard error,
// not a warning.
//
// The limit, stated plainly: a collision whose display name also resembles the expected one slips
// through. /joannagaines/ resolves to "Joanna Cox-Gaines" with 166 followers, and no name rule
// separates that from "Joanna Gaines". The follower count is what gives it away, so every run
// prints the observed name and count for a human to read.
export function verifyIdentity(
  requestedHandle: string,
  expectedCreator: string | null,
  snippet: ProfileSnippet | null,
  fromProps: ProfileFromProps | null,
): IdentityVerdict {
  const wanted = normalizeHandle(requestedHandle);
  const observedHandle = snippet?.handle ?? null;
  const observedName = snippet?.displayName ?? fromProps?.displayName ?? null;
  if (observedHandle !== null && normalizeHandle(observedHandle) !== wanted) {
    return {
      status: "mismatch",
      observedHandle,
      observedName,
      reason: `page for @${wanted} reports handle @${observedHandle}`,
    };
  }
  if (expectedCreator === null || expectedCreator.trim() === "") {
    return { status: "unverified", observedHandle, observedName, reason: "the seed names no expected creator to check against" };
  }
  if (observedName === null) {
    return { status: "unverified", observedHandle, observedName, reason: "no display name on the page, from either route" };
  }
  if (!namesAgree(expectedCreator, observedName)) {
    return {
      status: "mismatch",
      observedHandle,
      observedName,
      reason: `expected ${JSON.stringify(expectedCreator)} but the page belongs to ${JSON.stringify(observedName)}`,
    };
  }
  return { status: "verified", observedHandle, observedName, reason: `display name matches ${JSON.stringify(expectedCreator)}` };
}

// Deliberately loose: it has to accept "ADDitude Magazine" against "ADDitude", and it has to
// reject "Sharon Stewart" against "Jasmine Star". One shared meaningful word is the bar, which is
// permissive on purpose, because a false mismatch stops a real collection and a false match is
// caught by the printed follower count.
export function namesAgree(expected: string, observed: string): boolean {
  const tokens = (value: string): Set<string> =>
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((word) => word.length > 2),
    );
  const wanted = tokens(expected);
  const seen = tokens(observed);
  if (wanted.size === 0 || seen.size === 0) return true;
  for (const word of wanted) if (seen.has(word)) return true;
  return false;
}

// ------------------------------------------------------------------------------------------
// Entry building.
// ------------------------------------------------------------------------------------------

export interface EntryContext {
  handle: string;
  creator: string;
  niche: string;
  boardSlug: string;
  followers: number | null;
  // 1-based position in the board's first page, which is the only positional fact available.
  rank: number;
  collectedAt: string;
  identity: IdentityVerdict;
  now?: Date;
}

// Why some of these choices are what they are, since each one could plausibly be the other way:
//
//   body        Pinterest publishes no on-image text at all, so this is a fixed observational
//               marker rather than a copy of Pinterest's headline or description. `title` keeps
//               the SEO metadata as a separate field, while body_is_complete is false and the
//               notes say in words that it is not the creator's text.
//   metrics     `shares` gets repinCount, this copy's own saves, because that is the number this
//               account earned. The global aggregate goes in `aggregate_saves`, which nothing
//               scores against. `views` and `likes` stay null: logged out, Pinterest publishes
//               neither, and a zero would read as a measurement. `comments` stays null too, which
//               is a deliberate refusal rather than a gap: the page does carry a commentCount, but
//               it sits inside `aggregatedPinData` next to the cross-copy save total, so it counts
//               comments on every copy of the image and is not this post's number. Recording it in
//               `metrics.comments` would put a cross-copy aggregate into a per-post field and
//               inflate every engagement score built from it.
//   role        "unranked". A board's first page is not a top list and not an unbiased sample.
export function toStagedEntry(pin: PinterestPin, ctx: EntryContext): CorpusEntry | null {
  const cleaned = cleanArticleBody(pin.articleBody);
  const title = pin.headline;
  const hasMetadata = title !== null || cleaned !== null;
  // A pin with neither a headline nor a usable description has no text at all. It is dropped
  // rather than staged with an invented body: 14 of 466 captured pins are in this state.
  if (!hasMetadata) return null;

  const era = eraFor(pin.datePublished);
  const notes: string[] = [
    "Pinterest, logged out. The words ON the graphic are not published and were not collected, which is why body_is_complete is false and media.onscreen_text is null.",
    "TEXT PROVENANCE: title holds Pinterest's SEO-GENERATED metadata; body is an observational marker only. Neither is the creator's words, and the title is frequently unrelated to the words printed on the image. One measured pin's headline reads \"Entrepreneurship Chart Ideas For Students\" over a graphic that reads \"MARK CUBAN'S 12 RULES FOR STARTUPS\". Never quote this text as the post.",
    `Saves: ${pin.aggregateSaves ?? "unknown"} aggregate across every copy of this image on Pinterest, ${pin.repinCount ?? "unknown"} repins of this copy. Both are lifetime running totals with no window, so an older pin has had longer to accrue them.`,
    "Authorship: author.alternateName names whoever owns THIS copy, so this may be a repin of someone else's image. The route cannot separate an original from a repin, and a board's biggest pin often is one.",
    "Evidence status: UNRANKED OBSERVATION. This is a first-page capture, not a winner selection, top-pins listing, or performance ranking.",
    `Sample: position ${ctx.rank} on the first server-rendered page of /${ctx.handle}/${ctx.boardSlug}/. Logged out that page carries roughly 21 to 25 pins and cannot be paged, so this is the board's first page, not its top pins.`,
  ];
  if (pin.copyCreatedAt !== null) {
    notes.push(`This copy was saved on ${pin.copyCreatedAt}, which is a different fact from the published date era is taken from.`);
  }
  if (isImplausibleDate(pin.datePublished, ctx.now)) {
    notes.push(`WARNING: Pinterest published a date in the future for this pin (${pin.datePublished}). Kept exactly as served rather than corrected, so era is unreliable for this entry.`);
  }
  if (ctx.identity.status !== "verified") {
    notes.push(`Identity ${ctx.identity.status}: ${ctx.identity.reason}. Observed display name ${JSON.stringify(ctx.identity.observedName)}, followers ${ctx.followers ?? "unknown"}.`);
  }
  if (pin.sharedUrl !== null) notes.push(`Pin links to ${pin.sharedUrl}`);
  if (pin.imageUrl === null) {
    notes.push("No image url was published for this pin, so a later transcription pass cannot recover its words from this record.");
  }

  const entry: CorpusEntry = {
    id: makeId("pinterest", ctx.handle, pin.url),
    platform: "pinterest",
    handle: normalizeHandle(ctx.handle),
    creator: ctx.creator,
    niche: ctx.niche,
    url: pin.url,
    posted_at: pin.datePublished,
    era,
    collected_at: ctx.collectedAt,
    kind: "text",
    body: PINTEREST_BODY_NOT_CAPTURED,
    transcript_source: null,
    metrics: {
      views: null,
      likes: null,
      comments: null,
      shares: pin.repinCount,
      followers: ctx.followers,
      aggregate_saves: pin.aggregateSaves,
    },
    title,
    media: {
      form: "image",
      // Null, always, and the correction of 2026-08-23 makes it more clearly right rather than
      // less. The pin's substance is text typeset into the image, Pinterest does not publish it,
      // and `headline` is an SEO title that is frequently unrelated to it. Letting the headline
      // stand in here would put words the creator never wrote into a remix as if they had been
      // market-tested. Only a real reading of the image may fill this, and whatever fills it must
      // record in `description` how it was read.
      onscreen_text: null,
      description:
        "A pinterest pin: one image, usually text typeset onto a graphic. The words on the image were NOT read: no transcription pass has run over this record, and the pin's headline is an SEO-generated title rather than the graphic's text. media.asset_url holds the image file for a later pass. Form determined from the route, which serves only single-image pins.",
      duration_seconds: null,
      media_count: null,
      has_captions: null,
      aspect: null,
      // The whole point of the 2026-08-23 correction. The words are in this file and nowhere else,
      // so a later transcription pass needs nothing but this url.
      asset_url: pin.imageUrl,
      // False, always, and not a judgement call. The graphic is what carried the pin, and it was
      // not collected; body is only the fixed observational marker above.
      body_is_complete: false,
    },
    sample: {
      listing: `board:${ctx.boardSlug}`,
      window: null,
      rank: ctx.rank,
      role: "unranked",
    },
    notes: notes.join("\n"),
  };
  return entry;
}

// ------------------------------------------------------------------------------------------
// Client.
// ------------------------------------------------------------------------------------------

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// Thrown on 403 or 429 and never swallowed. The probe saw neither across roughly 550 requests, so
// one appearing means something changed, and the run stops rather than collecting a page of
// Pinterest's block notice as if it were data.
export class PinterestBlockedError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`Pinterest answered HTTP ${status} for ${url}. Stopping the run rather than continuing into a block.`);
    this.name = "PinterestBlockedError";
  }
}

export interface ClientOptions {
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  politenessMs?: number;
}

export class PinterestClient {
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly politenessMs: number;
  private fetched = false;

  constructor(opts: ClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => fetchWithRetry(input, init) as Promise<Response>);
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.politenessMs = opts.politenessMs ?? DEFAULT_POLITENESS_MS;
  }

  // Waits before every request after the first, so the pause is between requests rather than
  // trailing the last one.
  async fetchHtml(url: string): Promise<string> {
    if (this.fetched && this.politenessMs > 0) await this.sleep(this.politenessMs);
    this.fetched = true;
    const res = await this.fetchImpl(url, { headers: { "user-agent": PINTEREST_USER_AGENT } });
    if (res.status === 403 || res.status === 429) throw new PinterestBlockedError(res.status, url);
    if (!res.ok) throw new Error(`Pinterest answered HTTP ${res.status} for ${url}`);
    return await res.text();
  }

  profile(handle: string): Promise<string> {
    return this.fetchHtml(`${PINTEREST_BASE}/${normalizeHandle(handle)}/`);
  }

  board(handle: string, slug: string): Promise<string> {
    return this.fetchHtml(`${PINTEREST_BASE}/${normalizeHandle(handle)}/${slug}/`);
  }

  pin(id: string): Promise<string> {
    return this.fetchHtml(pinUrl(id));
  }
}

// ------------------------------------------------------------------------------------------
// Collection.
// ------------------------------------------------------------------------------------------

export interface ProfileReading {
  followers: number | null;
  followersSource: "ld+json" | "user-resource" | "walk" | "none";
  identity: IdentityVerdict;
  boards: PinterestBoard[];
}

// Reads a profile page into the three facts a run needs: who this is, how big they are, and what
// boards they own.
//
// A missing profile-snippet is NOT zero followers and NOT a missing account. joannagaines answers
// 200 with no snippet at all. So every route is tried, and a null at the end means "no route
// answered", which is recorded as such rather than as a number.
export function readProfile(html: string, handle: string, expectedCreator: string | null): ProfileReading {
  const snippet = parseProfileSnippet(html);
  const props = parseInitialProps(html);
  const fromProps = props === null ? null : profileFromProps(props, handle);
  let followers = snippet?.followers ?? null;
  let followersSource: ProfileReading["followersSource"] = followers === null ? "none" : "ld+json";
  if (followers === null && fromProps !== null) {
    followers = fromProps.followers;
    followersSource = fromProps.source;
  }
  let boards = props === null ? [] : boardsFromProps(props, handle);
  if (boards.length === 0) {
    boards = boardSlugsFromHtml(html, handle).map((slug) => ({ slug, name: null, pinCount: null }));
  }
  return {
    followers,
    followersSource,
    identity: verifyIdentity(handle, expectedCreator, snippet, fromProps),
    boards,
  };
}

export interface BoardResult {
  slug: string;
  pinIds: string[];
  entries: CorpusEntry[];
  skippedNoText: number;
}

export interface CollectAccountResult {
  handle: string;
  profile: ProfileReading;
  boards: BoardResult[];
  entries: CorpusEntry[];
  // Boards that answered 200 and yielded no pin ids. Pinterest returns 200 for boards that do not
  // exist, so this is the ONLY way to tell a typo from an empty board, and it is surfaced rather
  // than logged and forgotten.
  emptyBoards: string[];
}

export async function collectAccount(
  client: PinterestClient,
  seed: { handle: string; creator: string; niche: string; boards?: string[] },
  opts: { maxPins?: number; collectedAt?: string; now?: Date } = {},
): Promise<CollectAccountResult> {
  const handle = normalizeHandle(seed.handle);
  const maxPins = opts.maxPins ?? DEFAULT_MAX_PINS_PER_BOARD;
  const collectedAt = opts.collectedAt ?? new Date().toISOString();
  const profile = readProfile(await client.profile(handle), handle, seed.creator);
  // A hard stop, not a warning. Collecting from a page that belongs to someone else files their
  // posts under this creator's name, and this project has already been burned by that on four
  // platforms.
  if (profile.identity.status === "mismatch") {
    throw new Error(`@${handle}: identity mismatch, ${profile.identity.reason}. Refusing to collect. Fix the handle in config/pattern-mining.yaml.`);
  }

  const wanted = seed.boards && seed.boards.length > 0 ? seed.boards : profile.boards.map((board) => board.slug);
  const boards: BoardResult[] = [];
  const emptyBoards: string[] = [];
  const entries: CorpusEntry[] = [];
  for (const slug of wanted) {
    const pinIds = pinIdsFromBoard(await client.board(handle, slug)).slice(0, maxPins);
    if (pinIds.length === 0) {
      emptyBoards.push(slug);
      boards.push({ slug, pinIds: [], entries: [], skippedNoText: 0 });
      continue;
    }
    const boardEntries: CorpusEntry[] = [];
    let skippedNoText = 0;
    for (const [index, pinId] of pinIds.entries()) {
      const pin = parsePin(await client.pin(pinId), pinId);
      if (pin === null) {
        skippedNoText++;
        continue;
      }
      const entry = toStagedEntry(pin, {
        handle,
        creator: seed.creator,
        niche: seed.niche,
        boardSlug: slug,
        followers: profile.followers,
        rank: index + 1,
        collectedAt,
        identity: profile.identity,
        now: opts.now,
      });
      if (entry === null) {
        skippedNoText++;
        continue;
      }
      boardEntries.push(entry);
    }
    boards.push({ slug, pinIds, entries: boardEntries, skippedNoText });
    entries.push(...boardEntries);
  }
  return { handle, profile, boards, entries, emptyBoards };
}

export interface ExpansionCandidate {
  handle: string;
  // Re-fetched from the candidate's OWN profile page. Never the number the graph reported.
  followers: number | null;
  followersSource: ProfileReading["followersSource"];
  displayName: string | null;
  boardCount: number;
  // True when this handle is already a pinterest row in config, so a run does not re-propose it.
  alreadySeeded: boolean;
}

// Discovery, and it deliberately stops short of collecting.
//
// It reads one seeded profile's related-user graph, then RE-FETCHES each named handle's own
// profile for its real follower count, display name and board count, and prints the result. It
// adds nothing to config and collects no pins, for three reasons worth stating rather than
// leaving as an omission:
//
//   1. A config row needs an expected creator name, and that is what makes the identity check
//      able to refuse an impostor. The graph supplies a handle and nothing to check it against.
//   2. Which niche a handle belongs to is a judgement, and this project's rule is to never guess
//      a handle into a seed list.
//   3. A handle being adjacent to a good account is not evidence it is a good account.
//
// So the output is a list for a person to read and choose from.
export async function expandFromAccount(
  client: PinterestClient,
  handle: string,
  opts: { limit?: number; seeded?: Set<string> } = {},
): Promise<ExpansionCandidate[]> {
  const seeded = opts.seeded ?? new Set<string>();
  const root = normalizeHandle(handle);
  const names = relatedHandlesFromProps(parseInitialProps(await client.profile(root)), root);
  const candidates: ExpansionCandidate[] = [];
  for (const name of names.slice(0, opts.limit ?? names.length)) {
    const normalized = normalizeHandle(name);
    let reading: ProfileReading | null = null;
    try {
      // The re-fetch. This is the ONLY number that may be recorded for this handle.
      reading = readProfile(await client.profile(normalized), normalized, null);
    } catch (err) {
      if (err instanceof PinterestBlockedError) throw err;
      reading = null;
    }
    candidates.push({
      handle: normalized,
      followers: reading?.followers ?? null,
      followersSource: reading?.followersSource ?? "none",
      displayName: reading?.identity.observedName ?? null,
      boardCount: reading?.boards.length ?? 0,
      alreadySeeded: seeded.has(normalized),
    });
  }
  return candidates;
}

export function pinterestSeeds(config: PatternMiningConfig): AccountSeed[] {
  return (config.accounts ?? []).filter((seed) => seed.platform === "pinterest" && typeof seed.handle === "string");
}

// ------------------------------------------------------------------------------------------
// CLI.
// ------------------------------------------------------------------------------------------

export interface PinterestArgs {
  command: "collect" | "rank" | "expand";
  account: string | null;
  boards: string[];
  all: boolean;
  maxPins: number;
  outPath: string | null;
  configPath: string | null;
  corpusPath: string;
  era: PostEra | null;
  niche: string | null;
  limit: number;
  politenessMs: number;
}

export function parsePinterestArgs(argv: string[]): PinterestArgs {
  const args: PinterestArgs = {
    command: argv[0] === "rank" ? "rank" : argv[0] === "expand" ? "expand" : "collect",
    account: null,
    boards: [],
    all: false,
    maxPins: DEFAULT_MAX_PINS_PER_BOARD,
    outPath: null,
    configPath: null,
    corpusPath: CORPUS_PATH,
    era: null,
    niche: null,
    limit: 20,
    politenessMs: DEFAULT_POLITENESS_MS,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--account" && value) (args.account = value), i++;
    else if (flag === "--board" && value) args.boards.push(value), i++;
    else if (flag === "--all") args.all = true;
    else if (flag === "--max-pins" && value) (args.maxPins = Number(value)), i++;
    else if (flag === "--out" && value) (args.outPath = value), i++;
    else if (flag === "--config" && value) (args.configPath = value), i++;
    else if (flag === "--corpus" && value) (args.corpusPath = value), i++;
    else if (flag === "--era" && value) (args.era = isPostEra(value) ? value : null), i++;
    else if (flag === "--niche" && value) (args.niche = value), i++;
    else if (flag === "--limit" && value) (args.limit = Number(value)), i++;
    else if (flag === "--politeness-ms" && value) (args.politenessMs = Number(value)), i++;
  }
  return args;
}

// The era-scoped ranking. This is the answer to "show me the tip-graphics that worked in
// 2014-2019", and the reason it lives here rather than in the shared outlier report is that it
// ranks on aggregate saves, which is a pinterest-only quantity and not comparable to anything.
export function rankReport(corpus: CorpusEntry[], era: PostEra | null, niche: string | null, limit: number): string[] {
  const pins = corpus.filter((entry) => entry.platform === "pinterest");
  const lines: string[] = [];
  const counts = [...countByEra(pins).entries()].filter(([, count]) => count > 0);
  lines.push(`Pinterest entries: ${pins.length}. By era: ${counts.map(([name, count]) => `${name} ${count}`).join(", ") || "none"}.`);
  if (era === null) {
    lines.push("No --era given, so nothing is ranked. Pinterest eras differ by three orders of magnitude and a pooled");
    lines.push("ranking would just be a list of old pins with no explanation attached. Pass one of: pre-2020, 2020-2022, 2023-plus.");
    return lines;
  }
  let selected = filterByEra(pins, era);
  if (niche !== null) selected = selected.filter((entry) => entry.niche === niche);
  selected = [...selected].sort((a, b) => (b.metrics.aggregate_saves ?? -1) - (a.metrics.aggregate_saves ?? -1));
  lines.push("");
  lines.push(`Era ${era}${niche === null ? "" : `, niche ${niche}`}: ${selected.length} entries, ranked by aggregate saves.`);
  lines.push("Aggregate saves count every copy of the image across Pinterest and are LIFETIME totals with no window,");
  lines.push("so an older pin has had longer to accrue them. Compare within one account or against a same-era control.");
  lines.push("Every one of these is a SHAPE, not a quotation: the words on the graphic were never collected.");
  lines.push("");
  for (const entry of selected.slice(0, limit)) {
    const saves = entry.metrics.aggregate_saves ?? null;
    const repins = entry.metrics.shares ?? null;
    lines.push(`  ${String(saves ?? "?").padStart(7)} saves / ${String(repins ?? "?").padStart(5)} repins  ${(entry.posted_at ?? "no date").slice(0, 10)}  @${entry.handle}`);
    lines.push(`          ${(entry.title ?? entry.body).replace(/\s+/g, " ").slice(0, 96)}`);
    lines.push(`          ${entry.url}`);
  }
  return lines;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parsePinterestArgs(argv);

  if (args.command === "rank") {
    for (const line of rankReport(readCorpus(args.corpusPath), args.era, args.niche, args.limit)) console.log(line);
    return 0;
  }

  const config = args.configPath ? loadConfig(args.configPath) : loadConfig();
  let seeds = pinterestSeeds(config);

  if (args.command === "expand") {
    if (args.account === null) {
      console.error("Pass --account <handle> to expand from. Discovery starts from a handle you already trust.");
      return 1;
    }
    const seeded = new Set(seeds.map((seed) => normalizeHandle(seed.handle ?? "")));
    const client = new PinterestClient({ politenessMs: args.politenessMs });
    let candidates: ExpansionCandidate[];
    try {
      candidates = await expandFromAccount(client, args.account, { limit: args.limit, seeded });
    } catch (err) {
      if (err instanceof PinterestBlockedError) {
        console.error(`\n${err.message}`);
        return 2;
      }
      console.error((err as Error).message);
      return 1;
    }
    console.log(`Related accounts named on @${normalizeHandle(args.account)}'s profile: ${candidates.length}.`);
    console.log("Every follower number below was re-fetched from that handle's OWN profile. The graph's own");
    console.log("numbers are wrong (careercontessa and prepary both read 80,467 from a third party's page while");
    console.log("prepary's own page says 5,673), so none of them were used.\n");
    console.log("handle                          followers  route          boards  display name");
    for (const candidate of candidates) {
      const followers = candidate.followers === null ? "no data" : String(candidate.followers);
      const mark = candidate.alreadySeeded ? " (already seeded)" : "";
      console.log(
        `${candidate.handle.padEnd(31)} ${followers.padStart(9)}  ${candidate.followersSource.padEnd(13)}  ${String(candidate.boardCount).padStart(6)}  ${candidate.displayName ?? "?"}${mark}`,
      );
    }
    console.log("\nNothing was collected and nothing was added to config. These are candidates for a person to");
    console.log("choose from: a config row needs an expected creator name to check identity against, and a niche,");
    console.log("and neither is something the graph can supply. Being next to a good account is not evidence.");
    return 0;
  }

  if (args.account !== null) {
    const wanted = normalizeHandle(args.account);
    seeds = seeds.filter((seed) => normalizeHandle(seed.handle ?? "") === wanted);
    if (seeds.length === 0) {
      console.error(`No pinterest account @${wanted} in config/pattern-mining.yaml. Pinterest has no logged-out discovery, so`);
      console.error("the seeded list is the only way in. Add the row, with its board slugs, before collecting.");
      return 1;
    }
  } else if (!args.all) {
    console.error("Pass --account <handle> or --all. Pinterest has no logged-out discovery: /search/pins/, /ideas/ and");
    console.error("/today/ all answer 200 with zero pins, so every run starts from the seeded list in config/pattern-mining.yaml.");
    return 1;
  }

  const client = new PinterestClient({ politenessMs: args.politenessMs });
  const collectedAt = new Date().toISOString();
  const staged: CorpusEntry[] = [];
  let failures = 0;
  for (const seed of seeds) {
    const handle = normalizeHandle(seed.handle ?? "");
    try {
      const result = await collectAccount(
        client,
        {
          handle,
          creator: seed.creator,
          niche: seed.niche,
          boards: args.boards.length > 0 ? args.boards : seed.boards,
        },
        { maxPins: args.maxPins, collectedAt },
      );
      const followers = result.profile.followers === null ? "no route answered" : `${result.profile.followers} (${result.profile.followersSource})`;
      console.log(`@${handle}  followers ${followers}  identity ${result.profile.identity.status}: ${result.profile.identity.reason}`);
      console.log(`  display name on the page: ${JSON.stringify(result.profile.identity.observedName)}. Read it: a vanity handle can belong to someone else.`);
      for (const board of result.boards) {
        const skipped = board.skippedNoText > 0 ? `, ${board.skippedNoText} pins had no text and were dropped` : "";
        console.log(`  /${handle}/${board.slug}/  ${board.pinIds.length} pins on the first page, ${board.entries.length} staged${skipped}`);
      }
      for (const slug of result.emptyBoards) {
        console.log(`  /${handle}/${slug}/  ZERO pin ids. Pinterest answers 200 for boards that do not exist, so check the slug.`);
      }
      const eras = [...countByEra(result.entries).entries()].filter(([, count]) => count > 0);
      if (eras.length > 0) console.log(`  eras: ${eras.map(([era, count]) => `${era} ${count}`).join(", ")}`);
      staged.push(...result.entries);
    } catch (err) {
      failures++;
      if (err instanceof PinterestBlockedError) {
        console.error(`\n${err.message}`);
        console.error("The probe made roughly 550 requests at this rate without a single 403 or 429, so this is new.");
        console.error("Stop, do not retry in a loop, and report it before collecting more.");
        return 2;
      }
      console.error(`@${handle}: ${(err as Error).message}`);
    }
  }

  if (staged.length === 0) {
    console.log("\nNothing staged.");
    return failures > 0 ? 1 : 0;
  }
  const outPath = args.outPath ?? join(INBOX_DIR, `pinterest-${collectedAt.slice(0, 10)}.json`);
  mkdirSync(join(outPath, ".."), { recursive: true });
  writeFileSync(outPath, JSON.stringify(staged, null, 2) + "\n", "utf8");
  console.log(`\nStaged ${staged.length} entries to ${outPath}`);
  console.log("Nothing is in the corpus yet. Review the file, then run: npm run patterns:collect");
  return failures > 0 ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  });
}
