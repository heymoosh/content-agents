import { test } from "node:test";
import assert from "node:assert/strict";
import { SIGNALS_DASHBOARD_SCRIPT } from "./page-signals-dashboard.js";
import { renderPage } from "./page.js";
import { metricLine, groupDigits } from "./page-signals.js";

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const render = new Function("esc", "groupDigits", "metricLine", "displayLabel", "FAMILY_METRICS", SIGNALS_DASHBOARD_SCRIPT + "; return { signalsPerformanceHtml, signalsOutcomeCardsHtml, signalsExperimentStatus };")(
  esc, groupDigits, metricLine, (s: string) => s, [["attention", [["impressions", "IMPRESSIONS"]]], ["business", [["calls", "CALLS"]]]],
);

test("experiment status distinguishes approval, collection, ready results and reviewed learning", () => {
  const status=render.signalsExperimentStatus;
  assert.match(status({status:'proposed'},{analysisStatus:'collecting'},null),/approval/);
  assert.match(status({status:'plan-approved'},null,null),/draft creation/);
  assert.match(status({status:'drafts-pending-content-review'},{analysisStatus:'collecting'},null),/delivery or sufficient measurements/);
  assert.match(status({status:'drafts-pending-content-review'},{analysisStatus:'ready'},null),/ready to interpret/);
  assert.match(status({status:'drafts-pending-content-review'},null,{reviewStatus:'pending'}),/your review/);
  assert.equal(status({status:'drafts-pending-content-review'},null,{reviewStatus:'accepted'}),'Learning recorded');
});

test("dashboard renders real zeros, escapes post text/URLs, and never substitutes sample data", () => {
  const metric = { value: 0, measured: 1, missing: 1 };
  const html = render.signalsPerformanceHtml({
    posts: 2, measuredPosts: 1, firstPost: "2026-09-01", lastPost: "2026-09-02", latestCapture: "2026-09-03",
    platforms: [{ platform: "bluesky", posts: 2, impressions: metric, replies: metric, topics: [], formats: [], untagged: 2,
      examples: [{ text: '<img src=x onerror="evil()">', url: 'javascript:evil()', replies: 0, impressions: null }] }],
  });
  assert.match(html, /Latest metric capture: 2026-09-03/);
  assert.match(html, /0<small>1 posts measured · 1 missing/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img|javascript:|illustrative|Sample data/);
  assert.match(html, /not a ranking of platform fit/);
});

test("absent performance, failed reads and unmeasured outcomes are distinct from measured zero", () => {
  assert.match(render.signalsPerformanceHtml({ posts: 0, excludedUnassigned: 9 }), /9 older posts/);
  assert.match(render.signalsPerformanceHtml({ error: "offline" }), /not a zero result/);
  const html = render.signalsOutcomeCardsHtml({
    attention: { impressions: { state: "measured", value: 0, records_measured: 1, records_unmeasured: 0 } },
    business: { calls: { state: "not_measured", reason: "No imported calls" } },
  });
  assert.match(html, /<dd>0<\/dd>/);
  assert.match(html, /No measurements imported yet/);
  assert.match(html, /No imported calls/);
  assert.doesNotMatch(html, /<dd>Not measured<\/dd>/);
});

const page = renderPage({ repoRoot: "/fixture", isDevWorktree: true });
const script = page.match(/<script>([\s\S]*?)<\/script>/)![1];
test("emitted page parses and contains the shared renderer, without the old sample-led overview", () => {
  assert.doesNotThrow(() => new Function(script));
  assert.ok(script.includes(SIGNALS_DASHBOARD_SCRIPT));
  assert.doesNotMatch(page, /Sample data · illustrative|No live strategy brief yet|Measurement inventory/);
  assert.match(page, /data-signals-tab="experiments"/);
});

test("a delayed prior-brand response cannot overwrite any dashboard panel; one failed read does not hide other reads", async () => {
  const start=script.indexOf("async function loadSignals(){");
  const code = script.slice(start, script.indexOf('document.getElementById("signalsBrand")', start));
  let brand = "human-inference";
  const elements = new Map<string, { innerHTML: string }>();
  const $ = (id: string) => { if (!elements.has(id)) elements.set(id, { innerHTML: "old-brand" }); return elements.get(id)!; };
  let resolveFirst!: (v: unknown) => void;
  const first = new Promise(resolve => { resolveFirst = resolve; });
  const fetch = async (url: string) => {
    if (url.includes("human-inference")) await first;
    return { ok: !url.includes("/outcomes"), json: async () => url.includes("/outcomes") ? { error: "ledger blocked" } : { brand: url.split("brand=")[1] } };
  };
  const state = new Function("$", "signalsBrand", "fetch", `let SIGNALS,OUTCOMES,RESEARCH;
    function renderSignals(){$('#signalsTop').innerHTML=SIGNALS.brand;}
    function renderOutcomes(){$('#signalsFamilies').innerHTML=OUTCOMES.error;}
    function renderResearch(){$('#signalsResearch').innerHTML=RESEARCH.brand;}
    function signalsPerformanceHtml(d){return d.brand;}
    ${code}; return {loadSignals};`)($, () => brand, fetch);
  const old = state.loadSignals();
  assert.equal($("#signalsPerformance").innerHTML, "<p>Loading performance…</p>");
  brand = "charles";
  await state.loadSignals();
  resolveFirst(null);
  await old;
  assert.equal($("#signalsPerformance").innerHTML, "charles");
  assert.equal($("#signalsTop").innerHTML, "charles");
  assert.equal($("#signalsResearch").innerHTML, "charles");
  assert.equal($("#signalsFamilies").innerHTML, "ledger blocked");
});

test("missing brief does not hide pending settings reviews or experiments", () => {
  const code = script.slice(script.indexOf("function renderSignals(){"), script.indexOf("async function proposeSignalsVenture("));
  const elements = new Map<string, any>();
  const $ = (id: string) => { if (!elements.has(id)) elements.set(id, { innerHTML: "", querySelectorAll: () => [] }); return elements.get(id); };
  new Function("$", "esc", `const SIGNALS={briefPath:null,experimentPlans:[{status:'proposed'}]};
    const bindSignalsExperimentActions=()=>{};
    const signalsExperimentsHtml=()=>'<p>Real experiment</p>';
    const signalsVentureHandoffsHtml=()=>'';
    const signalsConfigurationReviewsHtml=()=>'<p>Pending settings review</p>';
    ${code};renderSignals();`)($, esc);
  assert.match($("#signalsTop").innerHTML, /Pending settings review/);
  assert.match($("#signalsTop").innerHTML, /1 test plan/);
  assert.match($("#signalsExperiments").innerHTML, /Real experiment/);
});
