// Shared machinery for the Studio end-to-end suite.
//
// Why this exists: `npm test` asserts what renderPage() RETURNS. It has never executed a single
// line of the inline <script> that page ships to the browser, never made a fetch, never clicked
// anything. So a room whose script throws on load, or whose fetch 404s, passes the unit suite and
// is broken on screen. This suite boots the real server and drives a real Chromium.
//
// Two passes, because the app forces it:
//   A. REVIEW_FIXTURES=1 — fixture mode refuses every non-GET by construction (fixtures.ts §4), so
//      it can only prove the READ surfaces. That is exactly what it is for: every room renders
//      with data, in a browser, with no console errors.
//   B. a plain server — the only way to reach the write routes. Runs against the WORKTREE's own
//      data (repoRoot is derived from import.meta.url in src/db/db.ts), so nothing it writes can
//      reach Muxin's real checkout.
//
// Nothing here may spawn a model job. EXPENSIVE_ROUTES below is aborted at the browser, so a stray
// click cannot start a `claude -p` run, cost subscription time, or make the suite flaky.

import { chromium, type Browser, type Page, type Request } from "playwright";
import { spawn, type ChildProcess } from "node:child_process";
import { appendFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The combined runner sets E2E_REPO_ROOT to a disposable copy of the checkout. Keeping this
// override in the shared harness makes every pass use the same boundary: server source, fixture
// data, assertions, and the result ledger all resolve below one temporary root. A direct pass run
// still defaults to its checkout, which is useful for debugging but is intentionally not what
// `npm run test:e2e` uses.
export const ROOT = resolve(process.env.E2E_REPO_ROOT ?? SOURCE_ROOT);
export const DRAFT_HOME = process.env.E2E_DRAFT_HOME ? resolve(process.env.E2E_DRAFT_HOME) : null;

export const E2E_PHASE3_SLUG = "e2e-phase3";
export const E2E_WRITE_SLUG = "e2e-probe-venture";

/** Resolve Playwright's browser cache before the E2E runner swaps HOME for its draft sandbox. */
export function playwrightBrowsersPath(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  return env.PLAYWRIGHT_BROWSERS_PATH ?? join(home, "Library", "Caches", "ms-playwright");
}

/** Remove only artifacts owned by this suite from a disposable copy before a run starts. */
export function resetDisposableSuiteState(root: string, draftHome: string): void {
  for (const path of [
    join(root, "e2e", "results.jsonl"),
    join(root, "e2e", "RESULTS.md"),
    join(root, "venture", E2E_PHASE3_SLUG),
    join(root, "venture", E2E_WRITE_SLUG),
    join(draftHome, ".content-agents", "venture-intake-drafts", `${E2E_WRITE_SLUG}.json`),
    join(draftHome, ".content-agents", "venture-intake-drafts", `${E2E_WRITE_SLUG}.sections.json`),
  ]) {
    rmSync(path, { recursive: true, force: true });
  }
}

/**
 * Hash the checkout's bytes and entry types, omitting only git metadata and dependencies. The
 * combined runner uses this around every browser pass. It deliberately includes ignored runtime
 * data (analytics, queues, and scratch files), because those are exactly the files a write route
 * must not accidentally reach in the caller's checkout.
 */
export function snapshotWorktree(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const skip = new Set([".git", "node_modules"]);
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (skip.has(entry.name) && dir === root) continue;
      const path = join(dir, entry.name);
      const rel = path.slice(root.length + 1);
      const stat = lstatSync(path);
      if (stat.isDirectory()) {
        out.set(`${rel}/`, `dir:${stat.mode}`);
        walk(path);
      } else if (stat.isSymbolicLink()) {
        out.set(rel, `symlink:${readlinkSync(path)}`);
      } else if (stat.isFile()) {
        const hash = createHash("sha256");
        hash.update(readFileSync(path));
        out.set(rel, `file:${stat.mode}:${hash.digest("hex")}`);
      } else {
        out.set(rel, `other:${stat.mode}`);
      }
    }
  };
  walk(root);
  return out;
}

export function changedWorktreePaths(before: Map<string, string>, after: Map<string, string>): string[] {
  const changed = new Set<string>();
  for (const [path, value] of after) if (before.get(path) !== value) changed.add(path);
  for (const path of before.keys()) if (!after.has(path)) changed.add(path);
  return [...changed].sort();
}

// Routes that spawn a `claude -p` process, hit a paid API, or drive a real browser session. The
// suite must never trigger one: they cost real money or subscription time, take minutes, and would
// make every run non-deterministic. A feature behind one of these is reported as
// "not drivable without spawning a model job" — an honest gap, not a pass.
export const EXPENSIVE_ROUTES = [
  "/api/atomize",
  "/api/content/generate",
  "/api/signals/experiments/propose",
  "/api/develop/start",
  "/api/develop/reply",
  "/api/develop/format",
  "/api/revise",
  "/api/video/generate",
  "/api/fiction/draft",
  "/api/fiction/repass",
  "/api/fiction/check",
  "/api/charles/draft",
  "/api/strategy/ask",
  "/api/strategy/insights",
  "/api/strategy/ask-insights",
  "/api/strategy/refresh-brief",
  "/api/strategy/pull",
  "/api/outreach/draft",
  "/api/outreach/scout",
  "/api/outreach/message/revise",
  "/api/notes",
];

export type Status = "pass" | "fail" | "blocked";

export type Result = {
  feature: string;
  pr?: string;
  status: Status;
  detail: string;
};

export const results: Result[] = [];

/** Which pass is running, so a combined report can group its rows. */
export const PASS_NAME = process.env.E2E_PASS ?? "pass";
const LEDGER = join(ROOT, "e2e", "results.jsonl");

export function record(r: Result): void {
  results.push(r);
  const mark = r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "BLOCKED";
  console.log(`  [${mark}] ${r.feature}${r.detail ? " — " + r.detail : ""}`);
  flushReport();
}

// Appended after every single result, not at the end: the verdict is the deliverable, and a crash
// three quarters of the way through must not take the findings with it.
export function flushReport(): void {
  mkdirSync(dirname(LEDGER), { recursive: true });
  appendFileSync(LEDGER, JSON.stringify({ pass: PASS_NAME, ...results[results.length - 1] }) + "\n");
}

export type Server = { port: number; stop: () => Promise<void> };

/**
 * Boot the real review server out of this worktree and wait for the port to answer.
 *
 * The wait loop below cannot tell our own child from someone else's server on the same port, and a
 * killed run leaves its server listening. Adopting one of those is the worst possible failure: the
 * whole suite passes or fails against code from another commit, and every row it writes is a lie
 * about the working tree. So refuse to start if the port already answers, and say which port.
 */
export async function bootServer(env: Record<string, string>, port: number): Promise<Server> {
  try {
    const stale = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) });
    if (stale.ok) {
      throw new Error(
        `port ${port} already answers, so this run would test whatever that server is running, ` +
          `not this worktree. Stop it first: lsof -nP -iTCP:${port} -sTCP:LISTEN`,
      );
    }
  } catch (e) {
    // Only the refusal above is fatal. A connection error here is the normal case: nothing is
    // listening yet, which is exactly what we want.
    if (e instanceof Error && e.message.startsWith(`port ${port} already answers`)) throw e;
  }
  const serverEntry = join(ROOT, "src", "review", "serve.ts");
  // serve.ts intentionally binds only when run directly. A loader/eval entrypoint cannot
  // reliably satisfy that module-identity comparison, so bootstrap it through the explicit
  // startReviewServer() seam after importing the copied entry. This is harness-only and leaves
  // the production direct-run guard untouched.
  const bootstrap = [
    "import { pathToFileURL } from 'node:url';",
    "const entry = process.env.E2E_SERVER_ENTRY;",
    "if (!entry) throw new Error('E2E_SERVER_ENTRY is required');",
    "const mod = await import(pathToFileURL(entry).href);",
    "if (typeof mod.startReviewServer !== 'function') throw new Error('serve.ts has no startReviewServer seam');",
    "mod.startReviewServer();",
  ].join(" ");
  const proc: ChildProcess = spawn(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", bootstrap],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        ...env,
        E2E_SERVER_ENTRY: serverEntry,
        ...(DRAFT_HOME ? { HOME: DRAFT_HOME } : {}),
        ...(process.env.E2E_REPO_ROOT ? { CONTENT_AGENTS_TEST_VENTURE_ROOT: join(ROOT, "venture") } : {}),
        REVIEW_PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
      // The tsx launcher forks the real node server, so killing only the launcher orphans the
      // server and leaves its port held. Its own group means stop() can take the whole tree.
      detached: true,
    }
  );
  let log = "";
  proc.stdout?.on("data", (d) => (log += String(d)));
  proc.stderr?.on("data", (d) => (log += String(d)));

  // A server that dies on startup would otherwise be waited on for the full 60 seconds.
  let exited: string | null = null;
  proc.on("exit", (code, signal) => (exited = `exit code ${code}, signal ${signal}`));

  // Negative pid is the process group: the launcher and the node server it forked.
  // Timeout and early-exit must use the same path as stop(), or the orphaned server holds the port.
  const killTree = (): void => {
    try {
      if (proc.pid) process.kill(-proc.pid, "SIGKILL");
    } catch {
      proc.kill("SIGKILL");
    }
  };

  const deadline = Date.now() + 60_000;
  for (;;) {
    if (exited) {
      killTree();
      throw new Error(`server on ${port} died before answering (${exited}). Output:\n${log}`);
    }
    if (Date.now() > deadline) {
      killTree();
      throw new Error(`server did not start on ${port} within 60s. Output:\n${log}`);
    }
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  let stopped: Promise<void> | null = null;
  const waitForExit = (): Promise<void> => {
    if (stopped) return stopped;
    stopped = new Promise((resolve) => {
      if (exited) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, 2_000);
      proc.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    return stopped;
  };

  return {
    port,
    stop: async () => {
      killTree();
      await waitForExit();
    },
  };
}

export type Session = {
  browser: Browser;
  page: Page;
  /** Console errors and uncaught exceptions, newest last. */
  errors: string[];
  /** Non-OK responses to same-origin requests the page itself made. */
  badResponses: string[];
  /** Expensive routes the page tried to reach, which this suite aborted. */
  blockedCalls: string[];
  close: () => Promise<void>;
};

export async function openSession(port: number, options: { allowInjectedRoutes?: readonly string[] } = {}): Promise<Session> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    const badResponses: string[] = [];
    const blockedCalls: string[] = [];

    page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
    page.on("pageerror", (e) => errors.push(`uncaught: ${e.message}`));
    page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.port === String(port) && !r.ok() && r.status() !== 304) {
      badResponses.push(`${r.status()} ${u.pathname}${u.search}`);
    }
    });
  // Scoped to /api/** on purpose: intercepting every request (documents, assets) puts the whole
  // page load through the handler for no benefit, and only API routes can spawn a model job.
    await page.route("**/api/**", async (route, req: Request) => {
    const path = new URL(req.url()).pathname;
    const explicitlyInjected = options.allowInjectedRoutes?.includes(path) === true;
    if (!explicitlyInjected && EXPENSIVE_ROUTES.some((e) => path === e || path.startsWith(e + "/"))) {
      blockedCalls.push(`${req.method()} ${path}`);
      await route.abort();
      return;
    }
    await route.continue();
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    return {
      browser,
      page,
      errors,
      badResponses,
      blockedCalls,
      close: async () => {
        await browser.close();
      },
    };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

/** Click a room's nav button and wait for its section to actually become visible. */
export async function openRoom(page: Page, room: string): Promise<void> {
  await page.click(`button.room[data-room="${room}"]`);
  const id = "#room" + room[0].toUpperCase() + room.slice(1);
  await page.waitForSelector(`${id}:not([hidden])`, { timeout: 15_000 });
}

/**
 * Wait until a container stops saying "Loading…". This is the assertion that catches the whole
 * class of bug the unit suite cannot see: if the room's fetch 404s or its render throws, the
 * placeholder that renderPage() shipped is still sitting there.
 */
export async function waitLoaded(page: Page, selector: string, timeoutMs = 20_000): Promise<string> {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return !/Loading…/.test(el.textContent ?? "");
    },
    selector,
    { timeout: timeoutMs }
  );
  return (await page.textContent(selector)) ?? "";
}

/**
 * Apply a fixture scenario by clicking its chip.
 *
 * The fixture panel starts collapsed, because it opened over the room behind it and Muxin said the
 * screen was overwhelming. Its chips are therefore present but not visible until the panel opens,
 * and a click on one times out rather than failing loudly. Every scenario click goes through here
 * so a collapsed panel can never be mistaken for a broken surface. Already open is not an error.
 */
export async function applyScenario(page: Page, id: string): Promise<void> {
  await page.click("#fxOpen").catch(() => null);
  await page.click(`button.fxb[data-fx="${id}"]`);
}

export async function textOf(page: Page, selector: string): Promise<string> {
  return (await page.textContent(selector).catch(() => "")) ?? "";
}
