import { join } from "node:path";
import { writeFileSync } from "node:fs";
import type { BrowserContext, Page } from "playwright";
import { inboxDir } from "../paths.js";
import { captureDiagnostics, looksLikeAuthWall } from "../diagnose.js";
import { PullError } from "../errors.js";
import type { PlatformPuller } from "../types.js";

// Substack has no public analytics API, and — crucially — its "data export" (Settings → Exports)
// is the WRONG source for content analytics: it carries EMAIL deliver/open events only and misses
// web views entirely, so it badly undercounts real reach. The REAL per-post analytics live in the
// writer dashboard, which is backed by a clean internal JSON API. Discovered 2026-07-03 by sniffing
// the dashboard's own XHRs against the saved session:
//   GET /api/v1/post_management/published?offset=0&limit=N&order_by=post_date&order_direction=desc
//   -> { posts: [ { id, title, slug, post_date, reaction_count, comment_count,
//        stats: { views, opens, open_rate, clicks, shares, signups_within_1_day, ... } } ] }
// (Real gap seen: a post the export showed as ~33 delivered actually had 56 real views here.)
// So we fetch that endpoint with the authenticated context and write a CSV the existing
// parseSubstack ingests — no export/zip/async, and richer data. Aggregate reach/growth is also
// available at /api/v1/publish-dashboard/summary-v2?range=365 (subscribers + totalViews) for a
// later audience/growth follow-up.
const HOME_URL = "https://substack.com/home";
// limit is capped server-side (100 → 400); 25 is what the dashboard itself requests. Muxin has
// far fewer published posts than this, and it is ordered newest-first, so recent posts (the ones
// that matter for fresh analytics) are always covered. Add offset paging here if the archive grows.
const PUBLISHED_PATH =
  "/api/v1/post_management/published?offset=0&limit=25&order_by=post_date&order_direction=desc";
// Aggregate reach/growth (real subscriber total + views the per-post pull can't see). Written as
// raw JSON for the ingest step (parseSubstackSummary) to turn into audience rows.
const SUMMARY_PATH = "/api/v1/publish-dashboard/summary-v2?range=365";

// Reach the publication dashboard via the "Dashboard" nav link, and read the subdomain off the
// resulting /publish/ URL (we can't hardcode Muxin's subdomain, and the analytics API is served
// from the publication origin).
async function publicationOrigin(page: Page): Promise<string> {
  const dashboard = page
    .getByRole("link", { name: /dashboard/i })
    .or(page.getByRole("button", { name: /dashboard/i }))
    .first();
  try {
    await dashboard.waitFor({ state: "visible", timeout: 15_000 });
    await Promise.all([
      page.waitForURL(/\/publish\b/, { timeout: 20_000 }),
      dashboard.click(),
    ]);
  } catch (cause) {
    const diag = await captureDiagnostics(page, "substack", "dashboard-link-missing");
    throw new PullError("UI_CHANGED", `Couldn't reach the Substack publication dashboard from ${page.url()}`, {
      hint: `Expected a "Dashboard" link on substack.com/home leading to /publish/. Re-check src/pull/platforms/substack.ts. Screenshot: ${join(diag, "screenshot.png")}`,
      diagnosticsDir: diag,
      cause,
    });
  }
  return new URL(page.url()).origin;
}

// Minimal CSV-cell escaping (titles can contain commas/quotes/newlines).
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const substack: PlatformPuller = {
  platform: "substack",
  loginUrl: "https://substack.com/sign-in",

  async pull(context: BrowserContext): Promise<string[]> {
    const page = context.pages()[0] ?? (await context.newPage());

    // 1) Navigate — a failure here is connectivity (our side), not a UI change.
    try {
      await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (cause) {
      throw new PullError("NETWORK", `Couldn't load ${HOME_URL}`, {
        hint: "Check your connection / that Substack opens in a normal browser.",
        cause,
      });
    }

    // 2) Auth check — a sign-in wall means the saved session lapsed (re-login), NOT a UI change.
    if (looksLikeAuthWall(page.url())) {
      throw new PullError("SESSION_EXPIRED", `Substack redirected to a sign-in wall (${page.url()})`, {
        hint: "Run `npm run pull:login -- substack` and sign in again.",
      });
    }

    // 3) Resolve the publication origin (learns the subdomain), then fetch per-post analytics
    //    JSON with the authenticated context.
    const origin = await publicationOrigin(page);
    let posts: any[];
    try {
      const resp = await page.request.get(`${origin}${PUBLISHED_PATH}`);
      if (!resp.ok()) {
        throw new PullError("UI_CHANGED", `Substack analytics API returned ${resp.status()} (${origin}${PUBLISHED_PATH})`, {
          hint: "The dashboard API shape/params may have changed — re-check the query in src/pull/platforms/substack.ts.",
        });
      }
      const json = (await resp.json()) as { posts?: any[] };
      posts = json.posts ?? [];
    } catch (cause) {
      if (cause instanceof PullError) throw cause;
      throw new PullError("UI_CHANGED", `Couldn't read the Substack analytics API (${origin}${PUBLISHED_PATH})`, {
        hint: "The dashboard API may have moved — re-check src/pull/platforms/substack.ts.",
        cause,
      });
    }
    if (posts.length === 0) {
      throw new PullError("UI_CHANGED", "Substack analytics API returned no published posts", {
        hint: "Unexpected empty result — verify published posts exist / the API params in src/pull/platforms/substack.ts.",
      });
    }

    // 4) Map to the CSV columns parseSubstack already understands and write it to the inbox.
    const stamp = new Date().toISOString().slice(0, 10);
    let dest: string;
    try {
      const header = [
        "post_id", "title", "post_date", "url", "views", "opens",
        "open_rate", "clicks", "signups", "reactions", "comments", "shares",
      ];
      const lines = [header.join(",")];
      for (const p of posts) {
        const s = p.stats ?? {};
        lines.push(
          [
            p.id,
            p.title,
            p.post_date,
            p.slug ? `${origin}/p/${p.slug}` : "",
            s.views,
            s.opens,
            s.open_rate,
            s.clicks,
            s.signups_within_1_day ?? s.signups,
            p.reaction_count,
            p.comment_count,
            s.shares,
          ].map(csvCell).join(",")
        );
      }
      dest = join(inboxDir("substack"), `substack-stats-${stamp}.csv`);
      writeFileSync(dest, lines.join("\n") + "\n");
    } catch (cause) {
      throw new PullError("DOWNLOAD_FAILED", "Fetched analytics but writing the CSV failed", {
        hint: "Check disk space / write permission for data/inbox/substack/.",
        cause,
      });
    }

    // 5) Aggregate reach/growth — the real subscriber total + views. Non-fatal: a summary hiccup
    //    must not lose the per-post CSV we already wrote, so we warn and return what we have.
    const out = [dest];
    try {
      const sResp = await page.request.get(`${origin}${SUMMARY_PATH}`);
      if (sResp.ok()) {
        const sDest = join(inboxDir("substack"), `substack-summary-${stamp}.json`);
        writeFileSync(sDest, await sResp.text());
        out.push(sDest);
      } else {
        console.warn(
          `substack: summary-v2 returned ${sResp.status()} — skipping aggregate audience (per-post pull unaffected).`
        );
      }
    } catch (cause) {
      console.warn(
        `substack: couldn't fetch summary-v2 (${cause instanceof Error ? cause.message : cause}) — skipping aggregate audience.`
      );
    }
    return out;
  },
};
