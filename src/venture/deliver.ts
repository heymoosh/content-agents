import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readArtifacts, readArtifact, transitionArtifact, readyForDelivery, type VentureArtifact } from "./artifacts.js";
import { readyToPasteDir, phase1Dir } from "./paths.js";
import { claimSlots, readLedger, releaseClaims, fmtLa, type Claim } from "../publish/slots.js";
import { checkReuse } from "../publish/reuse-guard.js";
import { postNoteToSubstack, type PostContext, type PostFn } from "../publish/substack.js";
import { PullError } from "../pull/errors.js";
import { loadRules, requireRulesVersionMatch } from "./rules.js";

// The ONLY place venture content leaves the repo. Two paths, per rules.md §5.4/§5.5 + the
// artifact-kind table (venture/rules.yaml):
//   substack-post (manual) -> ready-to-paste/<id>.txt, Muxin pastes + confirms the live URL.
//   text-post-note (app)   -> the existing Substack Notes agent (src/publish/substack.ts),
//     via the SAME shared scheduler ledger /atomize uses (windowKey "substack") -- deliberately,
//     per Muxin's decision, so a Venture Note can't collide with a same-day /atomize Note.
//
// Deliberately does NOT reuse publishSubstack() -- that function reads readQueue(folder) and
// review-queue.md, neither of which exists for a venture. This reimplements ONLY its two-phase
// claim-then-fire pattern against artifacts.jsonl instead.

const WINDOW_KEY = "substack";

function assetKey(slug: string, artifactId: string): string {
  return `venture/${slug}/${artifactId}`;
}

function findPendingClaim(asset: string): Claim | undefined {
  return readLedger().find((c) => c.asset === asset && c.platform === WINDOW_KEY);
}

export interface DeliverResult {
  artifact_id: string;
  action: "handed_off" | "claimed" | "waiting" | "posted" | "failed" | "skipped";
  detail: string;
}

function deliverManual(slug: string, a: VentureArtifact, at: string): DeliverResult {
  mkdirSync(readyToPasteDir(slug), { recursive: true });
  const bodyPath = `${phase1Dir(slug)}/${a.artifact_id}.md`;
  const body = readFileSync(bodyPath, "utf8").trim();
  const heads = a.title ? `${a.title}\n\n` : "";
  const pastePath = `${readyToPasteDir(slug)}/${a.artifact_id}.txt`;
  writeFileSync(pastePath, heads + body + "\n");
  transitionArtifact(slug, a.artifact_id, { delivery_status: "handed_off" }, at);
  return { artifact_id: a.artifact_id, action: "handed_off", detail: pastePath };
}

async function deliverApp(slug: string, a: VentureArtifact, at: string, opts: { now?: Date; postFn?: PostFn; headed?: boolean }): Promise<DeliverResult> {
  const now = opts.now ?? new Date();
  const postFn = opts.postFn ?? postNoteToSubstack;
  const asset = assetKey(slug, a.artifact_id);

  const reuseCheck = checkReuse(a.artifact_id, WINDOW_KEY);
  if (!reuseCheck.allowed) {
    return { artifact_id: a.artifact_id, action: "skipped", detail: `reuse guard: ${reuseCheck.reason}` };
  }

  const existing = findPendingClaim(asset);
  if (!existing) {
    const { labels } = claimSlots({ windowKey: WINDOW_KEY, conflictPlatforms: [WINDOW_KEY], count: 1, asset, by: "venture", now });
    const when = labels[0] ?? "next-free-slot";
    transitionArtifact(slug, a.artifact_id, { delivery_status: "handed_off" }, at);
    return { artifact_id: a.artifact_id, action: "claimed", detail: `substack slot claimed for ${when} (not yet posted)` };
  }

  if (new Date(existing.time).getTime() > now.getTime()) {
    return { artifact_id: a.artifact_id, action: "waiting", detail: `slot ${fmtLa(new Date(existing.time))} not yet due` };
  }

  const bodyPath = `${phase1Dir(slug)}/${a.artifact_id}.md`;
  const body = readFileSync(bodyPath, "utf8").trim();
  try {
    const { ref } = await postFn({ headed: opts.headed }, body);
    transitionArtifact(
      slug,
      a.artifact_id,
      {
        delivery_status: "live_confirmed",
        evidence: { type: "agent", value: ref, provider: "substack-notes", confirmed_by: "agent", confirmed_at: at },
      },
      at
    );
    releaseClaims([existing]);
    return { artifact_id: a.artifact_id, action: "posted", detail: ref };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retryable = err instanceof PullError ? err.kind === "NETWORK" || err.kind === "SESSION_EXPIRED" : false;
    transitionArtifact(
      slug,
      a.artifact_id,
      { delivery_status: "failed", failure: { provider: "substack-notes", message, retryable, at } },
      at
    );
    return { artifact_id: a.artifact_id, action: "failed", detail: message };
  }
}

export interface DeliverOptions {
  now?: Date;
  postFn?: PostFn;
  headed?: boolean;
  onlyIds?: string[];
}

// Delivers every artifact currently readyForDelivery(). Called on demand (Muxin's command), not
// automatically -- there's no cron here yet, matching /atomize's own two-phase claim-then-fire
// model where a later run is what actually fires a claimed slot.
export async function deliverVenture(slug: string, opts: DeliverOptions = {}): Promise<DeliverResult[]> {
  requireRulesVersionMatch(slug, loadRules());
  const now = opts.now ?? new Date();
  // Two populations need visiting, not one: artifacts starting delivery fresh (readyForDelivery),
  // PLUS app-kind artifacts already claimed (handed_off) whose slot might be due now -- claiming
  // moves delivery_status to handed_off, so without this second half a claimed slot would never
  // be revisited on a later run. Manual-kind handed_off artifacts wait for Muxin's own `confirm`
  // command instead, never for another deliverVenture pass.
  let candidates = readArtifacts(slug).filter(
    (a) => readyForDelivery(a) || (a.delivery_mode === "app" && a.delivery_status === "handed_off")
  );
  if (opts.onlyIds) candidates = candidates.filter((a) => opts.onlyIds!.includes(a.artifact_id));
  const results: DeliverResult[] = [];
  for (const a of candidates) {
    if (a.delivery_mode === "manual") {
      results.push(deliverManual(slug, a, now.toISOString()));
    } else if (a.delivery_mode === "app") {
      results.push(await deliverApp(slug, a, now.toISOString(), opts));
    }
  }
  return results;
}

// Muxin's confirmation after pasting a manual (essay) artifact herself. The one place a `url`
// evidence type gets written for a manual-kind artifact.
export function confirmManualDelivery(slug: string, artifactId: string, url: string, at: string): void {
  requireRulesVersionMatch(slug, loadRules());
  const a = readArtifact(slug, artifactId);
  if (!a) throw new Error(`no such artifact: ${artifactId}`);
  if (a.delivery_mode !== "manual") throw new Error(`${artifactId} is not a manual-delivery artifact`);
  if (a.delivery_status !== "handed_off") {
    throw new Error(`${artifactId} is ${a.delivery_status}, not handed_off -- run deliver first`);
  }
  transitionArtifact(
    slug,
    artifactId,
    { delivery_status: "live_confirmed", evidence: { type: "url", value: url, confirmed_by: "muxin", confirmed_at: at } },
    at
  );
}

const USAGE = "usage: tsx src/venture/deliver.ts <slug> | tsx src/venture/deliver.ts confirm <slug> <artifact_id> --url <live-url>";

function main() {
  const [, , first, ...rest] = process.argv;
  if (!first) {
    console.error(USAGE);
    process.exit(1);
  }

  if (first === "confirm") {
    const [slug, artifactId] = rest;
    const urlIdx = process.argv.indexOf("--url");
    const url = urlIdx >= 0 ? process.argv[urlIdx + 1] : undefined;
    if (!slug || !artifactId || !url) {
      console.error(USAGE);
      process.exit(1);
    }
    try {
      confirmManualDelivery(slug, artifactId, url!, new Date().toISOString());
      console.log(`${artifactId} confirmed live: ${url}`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    return;
  }

  const slug = first;
  deliverVenture(slug).then((results) => {
    if (results.length === 0) {
      console.log("nothing ready for delivery (needs approved + publishable + ready)");
    }
    for (const r of results) console.log(`${r.artifact_id}: ${r.action} -- ${r.detail}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
