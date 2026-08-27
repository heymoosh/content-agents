import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIXTURE_ENV_VAR,
  FIXTURE_WRITE_REFUSAL,
  FIXTURE_BANNER_MARKER,
  FIXTURE_PANEL_MARKER,
  FIXTURE_OPEN_MARKER,
  FIXTURE_INTERCEPT_MARKER,
  FIXTURE_SCENARIOS,
  fixturesEnabled,
  fixtureBannerHtml,
  fixturePanelHtml,
  fixtureScriptHtml,
  type FixtureScenario,
} from "./fixtures.js";
import {
  renderPage,
  jobRoom,
  jobRailLabel,
  jobAwaitingAnswer,
  jobSettled,
  jobProgressPct,
  jobStepDots,
  stripJobFor,
  ANSWERED_FOOTER,
  jobFooter,
  jobAnswerEcho,
  type JobView,
  type JobRoom,
} from "./page.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));

function scenario(id: string): FixtureScenario {
  const s = FIXTURE_SCENARIOS.find((x) => x.id === id);
  assert.ok(s, `no fixture scenario "${id}"`);
  return s as FixtureScenario;
}

function jobsOf(id: string): JobView[] {
  const payload = scenario(id).overrides["/api/jobs"] as { jobs: JobView[] } | undefined;
  assert.ok(payload, `scenario "${id}" forces no /api/jobs payload`);
  return payload.jobs;
}

// ── The gate ─────────────────────────────────────────────────────────────────────────────────────

test("fixture mode is off unless the process was started with the env var", () => {
  assert.equal(fixturesEnabled({}), false);
  assert.equal(fixturesEnabled({ [FIXTURE_ENV_VAR]: "" }), false);
  assert.equal(fixturesEnabled({ [FIXTURE_ENV_VAR]: "0" }), false);
  assert.equal(fixturesEnabled({ [FIXTURE_ENV_VAR]: "no" }), false);
  assert.equal(fixturesEnabled({ [FIXTURE_ENV_VAR]: "1" }), true);
  assert.equal(fixturesEnabled({ [FIXTURE_ENV_VAR]: "true" }), true);
});

// THE critical test. When fixtures are off the code path must not EXIST in the served page — not be
// hidden with CSS, not be behind a disabled flag the browser could flip. Absent.
test("fixtures disabled: the page carries no fixture markup, data, or enabling control", () => {
  const html = renderPage({ repoRoot: "/tmp/repo", isDevWorktree: false });
  for (const marker of [
    FIXTURE_BANNER_MARKER, // the banner
    FIXTURE_PANEL_MARKER, // the panel
    FIXTURE_OPEN_MARKER, // the control that would reopen a hidden panel
    FIXTURE_INTERCEPT_MARKER, // the fetch interceptor
    FIXTURE_ENV_VAR, // any hint the flag exists
    "FIXTURE", // every fixture string is prefixed with it
    "data-fx", // every fixture button carries it
    "fxBannerState",
    "FIXTURE_NOW",
  ]) {
    assert.ok(!html.includes(marker), `disabled page must not contain ${JSON.stringify(marker)}`);
  }
  // And no fixture payload leaked in as JSON either.
  assert.ok(!html.includes("fixture-job-"), "no fixture job id may appear");
  assert.ok(!html.includes("fixture-series"), "no fixture series slug may appear");
  // Explicitly: not merely hidden.
  assert.ok(!/fxPanel/.test(html));
});

test("fixtures disabled by default — omitting the option is the same as passing false", () => {
  const omitted = renderPage({ repoRoot: "/tmp/repo", isDevWorktree: false });
  const explicit = renderPage({ repoRoot: "/tmp/repo", isDevWorktree: false, fixtures: false });
  assert.equal(omitted, explicit);
});

test("fixtures enabled: banner, panel and interceptor all render", () => {
  const html = renderPage({ repoRoot: "/tmp/repo", isDevWorktree: false, fixtures: true });
  assert.ok(html.includes(FIXTURE_BANNER_MARKER), "the banner must render");
  assert.ok(html.includes(FIXTURE_PANEL_MARKER), "the panel must render");
  assert.ok(html.includes(FIXTURE_INTERCEPT_MARKER), "the fetch interceptor must render");
  assert.match(html, /FIXTURE MODE/);
  assert.ok(html.includes(FIXTURE_ENV_VAR), "the banner names the flag that turned this on");
  // Unmistakable, and not dismissable: the panel has a hide button, the banner has none.
  assert.match(html, /NOTHING ON THIS PAGE IS REAL/);
  assert.ok(!/id="fxBanner"[^>]*hidden/.test(html), "the banner is never rendered hidden");
});

// The whole design hinges on this ordering: the interceptor has to be installed before the app's
// own script runs, because that script fires load()/loadJobs()/loadContent() the moment it parses.
test("the interceptor is emitted BEFORE the app's own script", () => {
  const html = renderPage({ repoRoot: "/tmp/repo", isDevWorktree: false, fixtures: true });
  const interceptor = html.indexOf(FIXTURE_INTERCEPT_MARKER);
  const appScript = html.indexOf("const $ = (s, r=document)");
  assert.ok(interceptor > -1 && appScript > -1);
  assert.ok(interceptor < appScript, "fixture interceptor must be installed before the app script");
});

// ── Never write ──────────────────────────────────────────────────────────────────────────────────

test("the browser interceptor refuses every non-GET, so no write request leaves the page", () => {
  const script = fixtureScriptHtml();
  assert.match(script, /if \(method !== "GET"\) return Promise\.resolve\(reply\(403,/);
  assert.match(script, /window\.fetch = function/);
  // The refusal is served from the page, not proxied to the server.
  assert.ok(!/realFetch\(input, init\);\s*\n\s*}\s*;\s*$/.test(script.split("if (method !== \"GET\")")[0]));
});

test("the venture read dispatcher is GET-only, so a fixture override of one cannot write", () => {
  const src = readFileSync(join(HERE, "venture-reads.ts"), "utf8");
  assert.match(src, /if \(method !== "GET" \|\| !pathname\.startsWith\("\/api\/venture\/"\)\) return null;/);
});

test("serve.ts refuses every non-GET above every route while fixtures are on", () => {
  const src = readFileSync(join(HERE, "serve.ts"), "utf8");
  const guard = src.indexOf('if (FIXTURES_ON && req.method !== "GET")');
  assert.ok(guard > -1, "serve.ts must carry the fixture write guard");
  // Structural proof that no mutating route can be reached while the flag is set: EVERY non-GET
  // route in the handler sits below the guard, and so does the very first route of any kind.
  const writes = [...src.matchAll(/req\.method === "(?!GET)[A-Z]+"/g)].map((m) => m.index as number);
  assert.ok(writes.length > 40, `expected the handler's write routes, found ${writes.length}`);
  for (const at of writes) {
    assert.ok(guard < at, `a non-GET route at index ${at} sits above the fixture write guard`);
  }
  assert.ok(guard < src.indexOf('url.pathname === "/"'), "the guard runs before any route matches");
  assert.match(src, /const FIXTURES_ON = fixturesEnabled\(\);/);
  assert.match(src, /fixtures: FIXTURES_ON/);
});

test("no fixture scenario fakes a route that writes — every override is a GET read", () => {
  const src = readFileSync(join(HERE, "serve.ts"), "utf8");
  const routeSources = [src];
  for (const [handler, file] of [
    ["handleFictionRoute", "serve-fiction.ts"],
    ["handleCharlesRoute", "serve-charles.ts"],
    ["handleSignalsRoute", "serve-signals.ts"],
  ] as const) {
    if (src.includes(`await ${handler}(`)) {
      routeSources.push(readFileSync(join(HERE, file), "utf8"));
    }
  }
  for (const s of FIXTURE_SCENARIOS) {
    for (const path of Object.keys(s.overrides)) {
      // Venture reads are owned by handleVentureRead rather than by a literal pathname compare, and
      // that dispatcher is GET-only by construction (asserted just below), so a /api/venture/ path
      // it answers is as provably read-only as a literal GET route here.
      const isVentureRead = path.startsWith("/api/venture/") && src.includes("handleVentureRead");
      const isLiteralGetRead = routeSources.some((routeSrc) =>
        routeSrc.includes(`req.method === "GET" && url.pathname === "${path}"`),
      );
      assert.ok(
        isVentureRead || isLiteralGetRead,
        `${s.id} overrides ${path}, which is not a GET route in the server dispatcher`,
      );
    }
  }
});

// `import type` is erased before anything runs, so it can never pull code in; only a VALUE import
// can. The check below therefore separates the two rather than counting every `from` clause, which
// is strictly stronger than the old "one import, and it is a type" rule: it now proves the property
// transitively for the one value import fixtures.ts has.
function valueImports(src: string): string[] {
  return [...src.matchAll(/^import\s+(?!type\s)[^;]*?from\s+"([^"]+)";/gms)].map((m) => m[1]);
}

test("the fixtures module is I/O-free by construction — it cannot write anything", () => {
  const src = readFileSync(join(HERE, "fixtures.ts"), "utf8");
  // Two value imports, and the second is why this test grew a second half: fixtures.ts builds its
  // Venture scenarios by running the REAL buildVentureThread over fixture data, so a scenario can
  // never drift from what the room renders. That is only safe while the builder is itself I/O-free.
  assert.deepEqual(valueImports(src), ["./venture-thread.js"], "fixtures.ts value-imports only the thread builder");
  for (const banned of ["node:fs", "node:child_process", "node:http", "writeFileSync", "appendFileSync", "mkdirSync", "execSync", "spawn("]) {
    assert.ok(!src.includes(banned), `fixtures.ts must not reference ${banned}`);
  }
});

test("venture-thread.ts is I/O-free too, which is what makes importing it into fixtures safe", () => {
  const src = readFileSync(join(HERE, "venture-thread.ts"), "utf8");
  assert.deepEqual(valueImports(src), [], "venture-thread.ts must import types only — a value import could drag node:fs in");
  for (const banned of ["node:fs", "node:child_process", "node:http", "writeFileSync", "appendFileSync", "mkdirSync"]) {
    assert.ok(!src.includes(banned), `venture-thread.ts must not reference ${banned}`);
  }
});

test("a full fixture session touches no file — rendering every scenario leaves the tree alone", async () => {
  // Exercise everything the fixture path can do server-side: build the page, every scenario's
  // payload, the panel and the script. If any of it wrote, the module would need fs, which the
  // test above forbids; this one proves the emitted output is also complete without I/O.
  const before = readFileSync(join(HERE, "fixtures.ts"), "utf8");
  const html = renderPage({ repoRoot: "/tmp/repo", isDevWorktree: false, fixtures: true });
  fixtureBannerHtml();
  fixturePanelHtml();
  fixtureScriptHtml();
  for (const s of FIXTURE_SCENARIOS) JSON.stringify(s.overrides);
  assert.ok(html.length > 0);
  assert.equal(readFileSync(join(HERE, "fixtures.ts"), "utf8"), before);
});

// ── What it can force ────────────────────────────────────────────────────────────────────────────

test("every scenario is uniquely identified and either resets or forces something", () => {
  const ids = new Set<string>();
  for (const s of FIXTURE_SCENARIOS) {
    assert.ok(!ids.has(s.id), `duplicate scenario id ${s.id}`);
    ids.add(s.id);
    assert.ok(s.group && s.label, `${s.id} needs a group and a label`);
    if (s.reset || s.disabled) continue;
    assert.ok(Object.keys(s.overrides).length > 0, `${s.id} forces nothing`);
    for (const path of Object.keys(s.overrides)) {
      assert.match(path, /^\/api\//, `${s.id} overrides a non-API path: ${path}`);
    }
  }
});

test("every fixture value is obviously fake on inspection", () => {
  for (const s of FIXTURE_SCENARIOS) {
    const jobs = (s.overrides["/api/jobs"] as { jobs: JobView[] } | undefined)?.jobs ?? [];
    for (const j of jobs) {
      assert.match(j.id, /^fixture-/, "a fixture job id could never collide with a real one");
      assert.match(j.label, /^FIXTURE: /, "a fixture job label says so on screen");
      for (const step of j.steps ?? []) assert.match(step, /^FIXTURE /);
      if (j.error) assert.match(j.error, /^FIXTURE: /);
      if (j.ask) assert.match(j.ask.question, /^FIXTURE: /);
      if (j.lastStdoutLine) assert.match(j.lastStdoutLine, /^FIXTURE: /);
    }
  }
  const scene = scenario("fiction-scene").overrides["/api/fiction/scene"] as {
    beats: string; chapter: { title: string; body: string };
  };
  assert.match(scene.beats, /^FIXTURE: /);
  assert.match(scene.chapter.title, /^FIXTURE: /);
  assert.match(scene.chapter.body, /^FIXTURE\./);
});

test("job states: each one drives the screen state it is named for", () => {
  const queued = jobsOf("job-queued")[0];
  assert.equal(queued.status, "queued");
  // Rule 1a on screen: a job with no stepTotal draws no bar, because nothing measured it.
  assert.equal(jobProgressPct(queued), null);

  const running = jobsOf("job-running")[0];
  assert.equal(running.status, "running");
  assert.equal(jobProgressPct(running), 25); // 1 of 4 — the bar IS reviewable on this one
  assert.equal(jobStepDots(running).filter((d) => d.state === "current").length, 1);

  // Rule 1c, both halves. Awaiting: a demand on Muxin.
  const awaiting = jobsOf("job-blocked-awaiting")[0];
  assert.equal(awaiting.status, "blocked");
  assert.equal(jobAwaitingAnswer(awaiting), true);
  assert.equal(jobSettled(awaiting), false);
  assert.equal(jobRailLabel(awaiting).text, "Needs you");

  // Answered: settled work, not a demand — the shipped model the prototype gets wrong.
  const answered = jobsOf("job-blocked-answered")[0];
  assert.equal(answered.status, "blocked");
  assert.equal(jobAwaitingAnswer(answered), false);
  assert.equal(jobSettled(answered), true);
  assert.equal(jobRailLabel(answered).text, "You answered");
  assert.equal(jobFooter(answered), ANSWERED_FOOTER);
  assert.equal(jobAnswerEcho(answered), "You said: FIXTURE option A");

  const failed = jobsOf("job-failed")[0];
  assert.equal(failed.status, "failed");
  assert.equal(jobRailLabel(failed).text, "Did not work");
  assert.equal(jobStepDots(failed).filter((d) => d.state === "failed").length, 1);

  const done = jobsOf("job-done")[0];
  assert.equal(done.status, "done");
  assert.equal(jobSettled(done), true);
  assert.equal(jobStepDots(done).every((d) => d.state === "done"), true);
});

// PR #361's status. The fixture exists so the state is reviewable; no assertion is made about how
// page.ts renders it, because today it renders it wrong (see the comment on the fixture) and a test
// pinning that would have to be deleted by whoever fixes it.
test("the stopped state is forceable, and is finished work rather than a demand", () => {
  const stopped = jobsOf("job-stopped")[0];
  assert.equal(stopped.status, "stopped");
  assert.equal(jobAwaitingAnswer(stopped), false);
  assert.equal(jobRoom(stopped.kind), "Content");
});

test("a done job's finishedAt is stamped in the browser, not baked in at render", () => {
  // Otherwise the strip's linger window would already have expired by the time anyone clicked.
  const done = jobsOf("job-done")[0] as unknown as { finishedAt: string };
  assert.equal(done.finishedAt, "FIXTURE_NOW");
  assert.match(fixtureScriptHtml(), /if \(v === FX\.now\) return Date\.now\(\);/);
});

test("job-by-room fixtures use real kinds, so each one lands in the room it claims", () => {
  const rooms: JobRoom[] = ["Content", "Outreach", "Fiction", "Signals", "Charles", "Venture"];
  for (const room of rooms) {
    const s = scenario(`job-room-${room.toLowerCase()}`);
    assert.ok(!s.disabled, `${room} should be forceable`);
    const job = ((s.overrides["/api/jobs"] as { jobs: JobView[] }).jobs)[0];
    assert.equal(jobRoom(job.kind), room, `kind "${job.kind}" does not land in ${room}`);
    // And the room strip actually picks it up (Charles has no strip by design).
    const strip = stripJobFor([job], room, Date.now());
    if (room === "Charles") assert.equal(strip, null);
    else assert.equal(strip?.id, job.id);
  }
});

test("the Venture job-by-room fixture is forceable with a real Venture kind", () => {
  const s = scenario("job-room-venture");
  assert.ok(!s.disabled, "Venture should no longer be disabled");
  assert.equal(s.note, undefined);
  assert.equal(s.room, "venture");
  const j = jobsOf("job-room-venture")[0];
  assert.equal(j.kind, "venture-analysis");
  assert.equal(jobRoom(j.kind), "Venture");
  assert.ok(!/data-fx="job-room-venture" disabled/.test(fixturePanelHtml()), "panel button must be enabled");
});

test("the three Fiction states cover every scene shape, and each overrides all three fiction reads", () => {
  const shapes = {
    "fiction-no-beats": { beats: "", chapter: null },
    "fiction-beats-no-chapter": { beats: "nonempty", chapter: null },
    "fiction-scene": { beats: "nonempty", chapter: "present" },
  };
  for (const [id, want] of Object.entries(shapes)) {
    const s = scenario(id);
    // loadFiction() issues three GETs; missing any one falls through to real data or a 400.
    for (const route of ["/api/fiction", "/api/fiction/doc", "/api/fiction/scene"]) {
      assert.ok(route in s.overrides, `${id} must override ${route}`);
    }
    const scene = s.overrides["/api/fiction/scene"] as { beats: string; chapter: unknown };
    assert.equal(scene.beats === "" ? "" : "nonempty", want.beats);
    assert.equal(scene.chapter == null ? null : "present", want.chapter);
    assert.equal(s.room, "fiction");
  }
});

test("empty-state fixtures cover every room in the header, and cold start covers them all at once", () => {
  const rooms = ["content", "studio", "outreach", "fiction", "signals", "charles"];
  for (const room of rooms) {
    const s = scenario(`empty-${room}`);
    assert.equal(s.room, room);
    assert.ok(Object.keys(s.overrides).length > 0);
  }
  const cold = scenario("cold-start");
  const forced = Object.keys(cold.overrides);
  for (const room of rooms) {
    for (const route of Object.keys(scenario(`empty-${room}`).overrides)) {
      assert.ok(forced.includes(route), `cold start must also force ${route}`);
    }
  }
  assert.deepEqual(cold.overrides["/api/jobs"], { jobs: [] }, "cold start starts with an empty queue");
});

test("reset clears every override rather than adding one", () => {
  const s = scenario("reset");
  assert.equal(s.reset, true);
  assert.deepEqual(s.overrides, {});
  assert.match(fixtureScriptHtml(), /if \(sc\.reset\) \{ overrides = Object\.create\(null\); last = ""; \}/);
});

test("the room jump is derived from the page's own nav, so Venture appears the day it ships", () => {
  const script = fixtureScriptHtml();
  assert.match(script, /document\.querySelectorAll\("nav\.rooms \.room"\)/);
  assert.ok(!script.includes('"content","studio","outreach"'), "the room list must not be hardcoded");
  // Today's nav is the source of truth for what the panel offers.
  const html = renderPage({ repoRoot: "/tmp/repo", isDevWorktree: false, fixtures: true });
  assert.match(html, /data-room="fiction"/);
  assert.ok(html.includes('id="fxRooms"'), "the panel leaves a slot the nav fills at runtime");
});

test("the refusal message says how to get back to real data", () => {
  assert.match(FIXTURE_WRITE_REFUSAL, /Every write is refused/);
  assert.match(FIXTURE_WRITE_REFUSAL, /Restart the review server without the flag/);
  assert.ok(FIXTURE_WRITE_REFUSAL.includes(FIXTURE_ENV_VAR));
});

// ── The interceptor, actually executed ───────────────────────────────────────────────────────────
// No browser under node:test, so the emitted script is run for real in a VM against a DOM stub.
// This is what proves the fetch wrapper behaves, rather than just that its source text looks right.

interface FakeEl {
  id: string;
  hidden: boolean;
  style: Record<string, string>;
  innerHTML: string;
  textContent: string;
  addEventListener(type: string, fn: (e: unknown) => void): void;
  handler?: (e: unknown) => void;
}

function fakeEl(id: string): FakeEl {
  const el: FakeEl = {
    id, hidden: false, innerHTML: "", textContent: "",
    style: {},
    addEventListener(_t, fn) { el.handler = fn; },
  };
  return el;
}

async function bootInterceptor() {
  const { runInNewContext } = await import("node:vm");
  const els: Record<string, FakeEl> = {
    fxBannerState: fakeEl("fxBannerState"),
    fxRooms: fakeEl("fxRooms"),
    fxPanel: fakeEl("fxPanel"),
    fxOpen: fakeEl("fxOpen"),
  };
  const passthrough: string[] = [];
  const roomJumps: string[] = [];
  const ctx: Record<string, unknown> = {
    URL, Response, console,
    location: { href: "http://localhost:4600/" },
    document: {
      readyState: "complete",
      getElementById: (id: string) => els[id] ?? null,
      querySelectorAll: (sel: string) =>
        sel === "nav.rooms .room"
          ? [{ getAttribute: () => "content" }, { getAttribute: () => "fiction" }]
          : [],
      addEventListener: () => {},
    },
  };
  ctx.window = ctx;
  // The app's own globals the script reaches for, stubbed so we can see what it calls.
  ctx.fetch = (input: string) => { passthrough.push(String(input)); return Promise.resolve("REAL"); };
  ctx.setRoom = (r: string) => { roomJumps.push(r); };

  const html = fixtureScriptHtml();
  const body = html.slice(html.indexOf(">") + 1, html.lastIndexOf("</script>"));
  runInNewContext(body, ctx);

  const click = (fx: string) =>
    els.fxPanel.handler?.({ target: { closest: () => ({ id: "", dataset: { fx } }) } });
  const get = (url: string) => (ctx.window as { fetch: (u: string) => Promise<unknown> }).fetch(url);
  const post = (url: string) =>
    (ctx.window as { fetch: (u: string, i: unknown) => Promise<Response> }).fetch(url, { method: "POST" });
  return { ctx, els, click, get, post, passthrough, roomJumps };
}

test("the interceptor installs, and refuses every write without letting it reach the network", async () => {
  const fx = await bootInterceptor();
  assert.equal((fx.ctx as { __reviewFixtureFetchInstalled?: boolean }).__reviewFixtureFetchInstalled, true);

  for (const route of ["/api/status", "/api/signals/backlog", "/api/fiction/doc", "/api/jobs/clear", "/api/atomize"]) {
    const res = await fx.post(route);
    assert.equal(res.status, 403, `${route} must be refused`);
    assert.deepEqual(await res.json(), { ok: false, error: FIXTURE_WRITE_REFUSAL });
  }
  assert.deepEqual(fx.passthrough, [], "not one write request reached the real fetch");
});

test("fixture panel hide and reopen explicitly toggle display state", async () => {
  const fx = await bootInterceptor();
  fx.els.fxPanel.handler?.({ target: { closest: () => ({ id: "fxHide", dataset: {} }) } });
  assert.equal(fx.els.fxPanel.hidden, true);
  assert.equal(fx.els.fxPanel.style.display, "none");
  assert.equal(fx.els.fxOpen.hidden, false);
  assert.equal(fx.els.fxOpen.style.display, "block");

  fx.els.fxOpen.handler?.({ target: { closest: () => ({ id: "fxOpen", dataset: {} }) } });
  assert.equal(fx.els.fxPanel.hidden, false);
  assert.equal(fx.els.fxPanel.style.display, "flex");
  assert.equal(fx.els.fxOpen.hidden, true);
  assert.equal(fx.els.fxOpen.style.display, "none");
});

test("with nothing forced, every read passes straight through to the real server", async () => {
  const fx = await bootInterceptor();
  assert.equal(await fx.get("/api/jobs"), "REAL");
  assert.equal(await fx.get("/api/queue"), "REAL");
  assert.deepEqual(fx.passthrough, ["/api/jobs", "/api/queue"]);
  assert.match(fx.els.fxBannerState.textContent, /real data/);
});

test("forcing a job state serves that job to /api/jobs and says so in the banner", async () => {
  const fx = await bootInterceptor();
  fx.click("job-blocked-answered");
  const body = (await (await fx.get("/api/jobs") as unknown as Response).json()) as { jobs: JobView[] };
  assert.equal(body.jobs.length, 1);
  assert.equal(body.jobs[0].id, "fixture-job-answered");
  assert.equal(body.jobs[0].answer, "FIXTURE option A");
  assert.deepEqual(fx.passthrough, [], "the forced route never hit the real server");
  assert.match(fx.els.fxBannerState.textContent, /forcing \/api\/jobs/);
  assert.match(fx.els.fxBannerState.textContent, /Job state \/ blocked \(answered\)/);
  assert.deepEqual(fx.roomJumps, ["studio"]);
});

test("a forced fiction scene answers all three fiction reads, query string and all", async () => {
  const fx = await bootInterceptor();
  fx.click("fiction-scene");
  const scene = (await (await fx.get("/api/fiction/scene?series=fixture-series") as unknown as Response).json()) as {
    beats: string; chapter: { title: string };
  };
  assert.match(scene.beats, /^FIXTURE: /);
  assert.equal(scene.chapter.title, "FIXTURE: Chapter one");
  const series = (await (await fx.get("/api/fiction") as unknown as Response).json()) as { series: { slug: string }[] };
  assert.equal(series.series[0].slug, "fixture-series");
  await (await fx.get("/api/fiction/doc?series=fixture-series&path=bible.md") as unknown as Response).json();
  assert.deepEqual(fx.passthrough, [], "no fiction read fell through to real data");
  assert.deepEqual(fx.roomJumps, ["fiction"]);
});

test("FIXTURE_NOW becomes a real timestamp at apply time, so a done job's strip still lingers", async () => {
  const fx = await bootInterceptor();
  const before = Date.now();
  fx.click("job-done");
  const body = (await (await fx.get("/api/jobs") as unknown as Response).json()) as { jobs: JobView[] };
  const finishedAt = body.jobs[0].finishedAt as number;
  assert.equal(typeof finishedAt, "number");
  assert.ok(finishedAt >= before && finishedAt <= Date.now());
  // And the strip does pick it up, which is the whole reason the timestamp is late-bound.
  assert.equal(stripJobFor(body.jobs, "Content", Date.now())?.id, "fixture-job-done");
});

test("cold start empties every room at once, and reset hands the desk back to real data", async () => {
  const fx = await bootInterceptor();
  fx.click("cold-start");
  for (const route of ["/api/queue", "/api/studio", "/api/outreach/leads", "/api/fiction", "/api/signals", "/api/charles", "/api/jobs"]) {
    await (await fx.get(route) as unknown as Response).json();
  }
  assert.deepEqual(fx.passthrough, [], "cold start leaves no room reading real data");

  fx.click("reset");
  assert.equal(await fx.get("/api/jobs"), "REAL");
  assert.equal(await fx.get("/api/queue"), "REAL");
  assert.match(fx.els.fxBannerState.textContent, /real data · nothing forced · every write refused/);
  // Reset is a return to real data, not a licence to write.
  assert.equal((await fx.post("/api/status")).status, 403);
});

test("the Venture job-by-room button forces a Venture job and jumps to the Venture room", async () => {
  const fx = await bootInterceptor();
  fx.click("job-room-venture");
  const body = (await (await fx.get("/api/jobs") as unknown as Response).json()) as { jobs: JobView[] };
  assert.equal(body.jobs[0].kind, "venture-analysis");
  assert.deepEqual(fx.roomJumps, ["venture"]);
});

test("the room buttons are built from whatever rooms the header actually has", async () => {
  const fx = await bootInterceptor();
  assert.match(fx.els.fxRooms.innerHTML, /data-fxroom="content"/);
  assert.match(fx.els.fxRooms.innerHTML, /data-fxroom="fiction"/);
  // The stub nav has no Venture tab today; the panel offers exactly what exists, no more.
  assert.ok(!fx.els.fxRooms.innerHTML.includes("venture"));
});

// ── Slice 2: approval, scheduling, interruption, history ─────────────────────────────────────────

const SLICE2_IDS = [
  "approval-waiting",
  "approval-given-not-live",
  "scheduling-slot-claimed",
  "scheduling-no-slot",
  "interruption-jobs-unreadable",
  "interruption-studio-unreadable",
  "history-quiet",
] as const;

test("every FIXTURE_SCENARIOS id is unique", () => {
  const ids = FIXTURE_SCENARIOS.map((s) => s.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("slice-2 scenario ids are present", () => {
  for (const id of SLICE2_IDS) {
    assert.ok(FIXTURE_SCENARIOS.some((s) => s.id === id), `missing scenario ${id}`);
  }
});

test("history-quiet has only settled jobs: no queued, no running", () => {
  const jobs = jobsOf("history-quiet");
  assert.ok(jobs.length >= 3);
  assert.ok(jobs.every((j) => j.status !== "queued" && j.status !== "running"));
  assert.ok(jobs.some((j) => j.status === "done"));
  assert.ok(jobs.some((j) => j.status === "stopped"));
  assert.ok(jobs.some((j) => j.status === "blocked" && j.answer));
  for (const j of jobs) {
    assert.equal(typeof j.elapsedMs, "number");
    assert.ok(j.finishedAt != null, `${j.id} needs finishedAt so the clock reads as history`);
  }
});

test("approval-given-not-live rows are all approve and none published", () => {
  const queue = scenario("approval-given-not-live").overrides["/api/queue"] as {
    pieces: { rows: { status: string }[] }[];
  };
  const rows = queue.pieces.flatMap((p) => p.rows);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.status === "approve"));
  assert.ok(rows.every((r) => r.status !== "published"));
});

test("every new slice-2 fixture body string carries the FIXTURE: marker", () => {
  // Only the payload each scenario uniquely forces — not the shared FX_CONTENT_BASE wizard
  // scaffolding underneath approval/scheduling.
  const uniquePayload: Record<(typeof SLICE2_IDS)[number], string> = {
    "approval-waiting": "/api/queue",
    "approval-given-not-live": "/api/queue",
    "scheduling-slot-claimed": "/api/queue",
    "scheduling-no-slot": "/api/queue",
    "interruption-jobs-unreadable": "/api/jobs",
    "interruption-studio-unreadable": "/api/studio",
    "history-quiet": "/api/jobs",
  };
  function walk(v: unknown, path: string): void {
    if (typeof v === "string") {
      if (v.length === 0) return;
      if (/^(approve|revise|discard|published|blocked|locked|text|image|quote-card|x|linkedin|bluesky|url)$/.test(v)) return;
      if (/^fx-/.test(v) || /^fixture-/.test(v)) return;
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) return;
      if (v === "FIXTURE_NOW") return;
      assert.match(v, /FIXTURE/, `${path} is missing the FIXTURE marker: ${JSON.stringify(v)}`);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        if (k === "status" || k === "id" || k === "platform" || k === "format" || k === "kind"
            || k === "time" || k === "pending" || k === "liveStateAsOf" || k === "textPlatforms"
            || k === "slug" || k === "editable" || k === "revisable" || k === "duplicatable"
            || k === "sourceLines" || k === "step" || k === "stepTotal" || k === "failedAtStep"
            || k === "retryable" || k === "elapsedMs" || k === "finishedAt") continue;
        walk(child, `${path}.${k}`);
      }
    }
  }
  for (const id of SLICE2_IDS) {
    const key = uniquePayload[id];
    const payload = scenario(id).overrides[key];
    assert.ok(payload != null, `${id} must override ${key}`);
    walk(payload, `${id}${key}`);
  }
});

test("approval-waiting rows all need a decision and pending is non-zero", () => {
  const queue = scenario("approval-waiting").overrides["/api/queue"] as {
    pending: number; pieces: { rows: { status: string }[] }[];
  };
  assert.ok(queue.pending > 0);
  assert.ok(queue.pieces[0].rows.every((r) => r.status === ""));
});

test("scheduling-slot-claimed rows carry a slot; scheduling-no-slot rows do not", () => {
  const claimed = scenario("scheduling-slot-claimed").overrides["/api/queue"] as {
    pieces: { rows: { slot?: { time: string; label: string }; status: string }[] }[];
  };
  const bare = scenario("scheduling-no-slot").overrides["/api/queue"] as {
    pieces: { rows: { slot?: unknown; status: string }[] }[];
  };
  for (const row of claimed.pieces[0].rows) {
    assert.ok(row.slot, "claimed scenario needs a slot");
    assert.match(row.slot.label, /^FIXTURE:/);
    assert.equal(row.status, "approve");
    assert.notEqual(row.status, "published");
  }
  for (const row of bare.pieces[0].rows) {
    assert.equal(row.slot, undefined);
    assert.equal(row.status, "approve");
  }
});

test("interruption fixtures force an error body on the failing read", () => {
  const jobs = scenario("interruption-jobs-unreadable").overrides["/api/jobs"] as { error: string };
  const studio = scenario("interruption-studio-unreadable").overrides["/api/studio"] as { error: string };
  assert.match(jobs.error, /^FIXTURE:/);
  assert.match(studio.error, /^FIXTURE:/);
});

test("interruption overrides answer as a non-ok text body so the recoverable path fires", async () => {
  // loadStudio checks !r.ok; loadJobs only catches. A 500 text body trips both.
  const fx = await bootInterceptor();
  fx.click("interruption-jobs-unreadable");
  const jobsRes = await fx.get("/api/jobs") as unknown as Response;
  assert.equal(jobsRes.ok, false);
  assert.equal(jobsRes.status, 500);
  await assert.rejects(() => jobsRes.json());

  fx.click("interruption-studio-unreadable");
  const studioRes = await fx.get("/api/studio") as unknown as Response;
  assert.equal(studioRes.ok, false);
  assert.equal(studioRes.status, 500);
  assert.match(await studioRes.text(), /^FIXTURE:/);
});
