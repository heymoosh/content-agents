import "../util/env.js";
import { readFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue, setStatus, appendPublishLog, appendBetPlacement } from "./queue.js";

// Push approved text posts (x / linkedin / bluesky) from a content folder's review queue
// to Typefully as SCHEDULED DRAFTS — never instant publish. Each post gets an EXPLICIT publish
// time computed from the platform cadence in config/platforms.yaml (posts_per_week + slot_days +
// slot_time_pst, anchored to PT/DST-aware); platforms without a cadence fall back to next-free-slot.
//   tsx src/publish/typefully.ts <content-folder>
// Needs TYPEFULLY_API_KEY (and optionally TYPEFULLY_SOCIAL_SET_ID) in .env.

const BASE = "https://api.typefully.com/v2";
const TEXT_PLATFORMS = new Set(["x", "linkedin", "bluesky"]);

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const key = process.env.TYPEFULLY_API_KEY;
  if (!key) throw new Error("TYPEFULLY_API_KEY missing in .env (generate at typefully.com settings)");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 402) {
    throw new Error(
      "Typefully returned 402 — API drafts need a paid plan (or the account is paused). " +
        "Check typefully.com/pricing, or switch the publish path to Postiz (see docs/setup-typefully.md)."
    );
  }
  if (!res.ok) throw new Error(`typefully ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function socialSetId(): Promise<string> {
  if (process.env.TYPEFULLY_SOCIAL_SET_ID) return process.env.TYPEFULLY_SOCIAL_SET_ID;
  const sets = (await api("/social-sets")) as { results?: { id: string | number; name?: string }[] } | { id: string | number }[];
  const list = Array.isArray(sets) ? sets : sets.results ?? [];
  if (list.length === 0) throw new Error("no Typefully social sets — connect your accounts at typefully.com first");
  const id = String(list[0].id);
  if (list.length > 1) {
    console.log(`multiple social sets found; using first (${id}). Pin with TYPEFULLY_SOCIAL_SET_ID in .env.`);
  }
  return id;
}

// CTA config (config/cta.yaml): placement keeps the link out of the body where the platform
// algorithm penalizes in-post links (X, LinkedIn); source_fallback is used when a `cta: source`
// derivative has no published essay URL to point at. See Platform Reference.
function loadCtaConfig(): {
  placement: Record<string, string>;
  fallbackUrl: string | null;
  fallbackLabel: string;
} {
  try {
    const cfg = parseYaml(readFileSync(join(repoRoot, "config", "cta.yaml"), "utf8")) as {
      placement?: Record<string, string>;
      source_fallback?: { url?: string; label?: string };
    };
    return {
      placement: cfg.placement ?? {},
      fallbackUrl: cfg.source_fallback?.url ?? null,
      fallbackLabel: cfg.source_fallback?.label ?? "",
    };
  } catch {
    return { placement: {}, fallbackUrl: null, fallbackLabel: "" };
  }
}

// The source essay's own URL — what `cta: source` derivatives point at. Pasted into source.md
// `canonical_url` (auto-filled when atomized from a live URL). Null until it's a real http(s) url.
function loadCanonicalUrl(folder: string): string | null {
  try {
    const { fm } = splitFrontmatter(readFileSync(join(folder, "source.md"), "utf8"));
    const u = typeof fm.canonical_url === "string" ? fm.canonical_url.trim() : "";
    return /^https?:\/\//.test(u) ? u : null;
  } catch {
    return null;
  }
}

function loadPlatformMax(): Record<string, number> {
  try {
    const cfg = parseYaml(readFileSync(join(repoRoot, "config", "platforms.yaml"), "utf8")) as {
      platforms?: Record<string, { max_chars?: number }>;
    };
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(cfg.platforms ?? {})) out[k] = v.max_chars ?? Infinity;
    return out;
  } catch {
    return {};
  }
}

// ── Cadence scheduler ──────────────────────────────────────────────────────
// Compute an EXPLICIT publish time per post from config/platforms.yaml (posts_per_week +
// slot_days + slot_time_pst), anchored to America/Los_Angeles (DST-aware), so Typefully
// auto-publishes on schedule instead of dumping everything into "next-free-slot".
const TZ = "America/Los_Angeles";
const WEEKDAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

type PlatformSchedule = { postsPerWeek: number; days: number[]; timePst: string };

function loadSchedule(): Record<string, PlatformSchedule> {
  try {
    const cfg = parseYaml(readFileSync(join(repoRoot, "config", "platforms.yaml"), "utf8")) as {
      platforms?: Record<string, { posts_per_week?: number; slot_days?: string[]; slot_time_pst?: string }>;
    };
    const out: Record<string, PlatformSchedule> = {};
    for (const [k, v] of Object.entries(cfg.platforms ?? {})) {
      if (!v.posts_per_week || !v.slot_days || !v.slot_time_pst) continue;
      const days = v.slot_days
        .map((s) => WEEKDAYS[s.toLowerCase().slice(0, 3)])
        .filter((n): n is number => n !== undefined);
      if (days.length) out[k] = { postsPerWeek: v.posts_per_week, days, timePst: v.slot_time_pst };
    }
    return out;
  } catch {
    return {};
  }
}

// The LA wall-clock parts (calendar day + weekday) of a given instant.
function laParts(d: Date): { year: number; month: number; day: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, weekday: WEEKDAYS[String(p.weekday).toLowerCase()] };
}

// LA's UTC offset (ms) at a given instant — accounts for PST vs PDT.
function laOffsetMs(d: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
  const hour = +p.hour === 24 ? 0 : +p.hour;
  return Date.UTC(+p.year, +p.month - 1, +p.day, hour, +p.minute, +p.second) - d.getTime();
}

// The UTC instant for a given LA wall-clock date+time (DST-aware).
function laWallToInstant(y: number, mo: number, d: number, h: number, mi: number): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  return new Date(guess - laOffsetMs(new Date(guess)));
}

// Monday-of-week key (LA) for the posts_per_week cap.
function weekKey(y: number, mo: number, d: number, weekday: number): string {
  const back = (weekday + 6) % 7; // days since Monday
  return new Date(Date.UTC(y, mo - 1, d - back)).toISOString().slice(0, 10);
}

// `count` future slot instants for one platform, ~1/day on slot_days, ≤ posts_per_week per week.
function computeSlots(cfg: PlatformSchedule, count: number, now: Date): Date[] {
  const [hh, mm] = cfg.timePst.split(":").map(Number);
  const slots: Date[] = [];
  const perWeek: Record<string, number> = {};
  for (let offset = 1; offset <= 180 && slots.length < count; offset++) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const { year, month, day, weekday } = laParts(probe);
    if (!cfg.days.includes(weekday)) continue;
    const wk = weekKey(year, month, day, weekday);
    if ((perWeek[wk] ?? 0) >= cfg.postsPerWeek) continue;
    const instant = laWallToInstant(year, month, day, hh, mm);
    if (instant.getTime() <= now.getTime()) continue;
    slots.push(instant);
    perWeek[wk] = (perWeek[wk] ?? 0) + 1;
  }
  return slots;
}

function fmtLa(d: Date): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(d) + " PT"
  );
}

// Build the Typefully `posts` array, placing the CTA link per config so the body stays clean.
// Returns a manual-comment string when the platform needs the link added by hand (LinkedIn).
function buildPosts(
  body: string,
  ctaUrl: string | null,
  ctaLabel: string,
  placement: string,
  max: number
): { posts: { text: string }[]; manualComment: string | null } {
  if (!ctaUrl) return { posts: [{ text: body }], manualComment: null };
  const ctaLine = `${ctaLabel} ${ctaUrl}`.trim();

  if (placement === "comment") {
    // LinkedIn: links are suppressed in-body and the API can't post a first comment for us.
    return { posts: [{ text: body }], manualComment: ctaLine };
  }
  if (placement === "inline") {
    const combined = `${body}\n\n${ctaLine}`;
    if (combined.length <= max) return { posts: [{ text: combined }], manualComment: null };
    return { posts: [{ text: body }, { text: ctaLine }], manualComment: null }; // would overflow → reply
  }
  // "reply" (X) or any unknown placement → link in the first reply
  return { posts: [{ text: body }, { text: ctaLine }], manualComment: null };
}

// Read-only: list what's currently scheduled in Typefully (sanity-check the queue). No writes.
//   tsx src/publish/typefully.ts --list
async function runList(): Promise<void> {
  const setId = await socialSetId();
  const res = (await api(`/social-sets/${setId}/drafts?limit=50`)) as
    | { results?: TypefullyDraft[] }
    | TypefullyDraft[];
  const list = Array.isArray(res) ? res : res.results ?? [];
  const scheduled = list
    .filter((d) => d.scheduled_date && (d.status === "scheduled" || new Date(d.scheduled_date) > new Date()))
    .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime());
  if (!scheduled.length) {
    console.log("No scheduled drafts found in Typefully.");
    return;
  }
  console.log(`Scheduled in Typefully (${scheduled.length}), times in PT:`);
  for (const d of scheduled) {
    const plats =
      [
        ["x", d.x_post_enabled],
        ["linkedin", d.linkedin_post_enabled],
        ["bluesky", d.bluesky_post_enabled],
        ["threads", d.threads_post_enabled],
        ["mastodon", d.mastodon_post_enabled],
      ]
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(",") || "?";
    console.log(`  ${fmtLa(new Date(d.scheduled_date!))}  [${plats}]  ${d.draft_title ?? d.id}`);
  }
}

type TypefullyDraft = {
  id: string | number;
  draft_title?: string;
  scheduled_date?: string | null;
  status?: string;
  x_post_enabled?: boolean;
  linkedin_post_enabled?: boolean;
  bluesky_post_enabled?: boolean;
  threads_post_enabled?: boolean;
  mastodon_post_enabled?: boolean;
};

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: tsx src/publish/typefully.ts <content-folder> | --list");
    process.exit(1);
  }
  if (arg === "--list") {
    await runList();
    return;
  }
  const folder = isAbsolute(arg) ? arg : join(repoRoot, arg);
  const { rows } = readQueue(folder);
  const approved = rows.filter((r) => r.status === "approve" && TEXT_PLATFORMS.has(r.platform));
  if (approved.length === 0) {
    console.log("no approved x/linkedin/bluesky rows in the review queue");
    return;
  }

  const setId = await socialSetId();
  const { placement: placementMap, fallbackUrl, fallbackLabel } = loadCtaConfig();
  const canonicalUrl = loadCanonicalUrl(folder);
  const maxMap = loadPlatformMax();

  // Assign an explicit publish time per row from the platform cadence (config/platforms.yaml).
  // Rows fill future slots in queue order; platforms without a cadence fall back to next-free-slot.
  const schedule = loadSchedule();
  const now = new Date();
  const byPlatform: Record<string, typeof approved> = {};
  for (const r of approved) (byPlatform[r.platform] ??= []).push(r);
  const slotByRow = new Map<string, string>(); // rowId → ISO publish_at | "next-free-slot"
  const whenByRow = new Map<string, string>(); // rowId → human label for logs
  for (const [platform, rowsP] of Object.entries(byPlatform)) {
    const sched = schedule[platform];
    const slots = sched ? computeSlots(sched, rowsP.length, now) : [];
    rowsP.forEach((r, i) => {
      if (i < slots.length) {
        slotByRow.set(r.id, slots[i].toISOString());
        whenByRow.set(r.id, fmtLa(slots[i]));
      } else {
        slotByRow.set(r.id, "next-free-slot");
        whenByRow.set(r.id, "next-free-slot");
      }
    });
  }
  console.log("Cadence schedule (PT):");
  for (const [platform, rowsP] of Object.entries(byPlatform)) {
    const sched = schedule[platform];
    console.log(`  ${platform}${sched ? ` (${sched.postsPerWeek}/wk)` : " (next-free-slot)"}:`);
    for (const r of rowsP) console.log(`    ${r.id} → ${whenByRow.get(r.id)}`);
  }

  for (const row of approved) {
    const assetPath = isAbsolute(row.asset) ? row.asset : join(folder, row.asset);
    const { fm, body } = splitFrontmatter(readFileSync(assetPath, "utf8"));
    const platformKey = row.platform === "x" ? "x" : row.platform; // typefully platform keys: x, linkedin, bluesky

    // Resolve the CTA link: `none`/empty → none; `source` → the essay's own url (canonical_url),
    // falling back to the Substack home when no essay url exists; any other value → a literal url.
    const rawCta = typeof fm.cta === "string" ? fm.cta.trim() : "";
    let ctaUrl: string | null;
    let ctaLabel = typeof fm.cta_label === "string" ? fm.cta_label : "";
    if (!rawCta || rawCta.toLowerCase() === "none") {
      ctaUrl = null;
    } else if (rawCta.toLowerCase() === "source") {
      if (canonicalUrl) {
        ctaUrl = canonicalUrl;
      } else {
        ctaUrl = fallbackUrl;
        if (fallbackLabel) ctaLabel = fallbackLabel;
        if (ctaUrl) {
          console.log(`  ↳ note: ${row.id} cta:source → homepage (no canonical_url in source.md)`);
        }
      }
    } else {
      ctaUrl = rawCta;
    }
    const placement = placementMap[row.platform] ?? "inline";
    const { posts, manualComment } = buildPosts(body, ctaUrl, ctaLabel, placement, maxMap[row.platform] ?? Infinity);

    const publishAt = slotByRow.get(row.id) ?? "next-free-slot";
    const when = whenByRow.get(row.id) ?? "next-free-slot";
    const draft = await api(`/social-sets/${setId}/drafts`, {
      method: "POST",
      body: JSON.stringify({
        draft_title: `${row.id} (content-agents)`,
        publish_at: publishAt,
        platforms: {
          [platformKey]: {
            enabled: true,
            posts,
          },
        },
      }),
    }) as { id?: string | number; share_url?: string };
    setStatus(folder, row, "published");
    const placeNote = ctaUrl ? `, cta→${placement}` : "";
    appendPublishLog(folder, `${row.id} → typefully draft ${draft.id ?? "?"} (${row.platform}, ${when}${placeNote})`);
    if (manualComment) {
      appendPublishLog(folder, `  ↳ ACTION: add as the first comment on ${row.id} in Typefully → ${manualComment}`);
    }
    appendBetPlacement(folder, row.id, row.platform, `typefully draft ${draft.id ?? "?"}`, fm, body);
    console.log(
      `scheduled: ${row.id} (${row.platform}) → ${when} → typefully draft ${draft.id ?? "?"}${placeNote}` +
        (manualComment ? `\n  ↳ add link as first comment: ${manualComment}` : "")
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
