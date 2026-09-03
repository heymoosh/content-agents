import { parseEvidence, type EvidenceItem } from "../outreach/qualify.js";
import { parseResearchResponse, type ParsedResearch } from "../outreach/research.js";

// discovery:prompt -- the "go find candidates" half of the web-discovery agent (/scout). Unlike
// outreach/research.ts (which enriches an ALREADY-NAMED lead), this module asks the model to
// first PROPOSE candidates matching a theme, then walk each proposed candidate through the same
// evidence-gathering discipline research.ts already uses -- so a discovered lead never reaches
// Muxin without a real cited source he can click through.
//
// One function per kind (client/platform vs content-example) rather than research.ts's separate
// buildResearchPrompt/buildPlatformResearchPrompt split for client/platform: this is new code with
// no legacy prompt to preserve byte-for-byte, so a single kind-branching function is simpler than
// two near-duplicates. The client/platform legality vocabulary (classification/fit values, signal
// categories) still differs by kind, so those are threaded through as plain opts fields rather than
// hardcoded, exactly mirroring what research.ts's two prompts encode.

export interface ClientPlatformDiscoveryOpts {
  kind: "client" | "platform";
  theme: string;
  maxCandidates: number;
  rubric: string; // config/outreach/clients.md or platforms.md
  worldviewMap: string; // config/outreach/worldview-map.md
  extraContext: string; // person-fit rubric (client) or spin_angles text (platform)
  brief?: string; // config/outreach/brief.md: Muxin's short statement of what she wants; wins over the rubric
  excludeNames: string[]; // names of leads already on file, so the model doesn't re-propose them
  searchBudgetPerSignal: number;
  lens?: { belief: string; dialect: string; modality: string };
  anchorContext?: string;
  antiExamples?: string[];
  calibration?: string;
}

const CLASSIFICATION_VALUES: Record<"client" | "platform", string> = {
  client: "turnaround, greenfield, unclear, disqualified",
  platform: "strong, partial, weak, disqualified",
};
const SIGNAL_CATEGORIES: Record<"client" | "platform", string> = {
  client: "turnaround signals, greenfield signals, and disqualifying signals",
  platform: "topic-overlap, audience-reality, guest-friendliness/pitch-path, recency, and disqualifying signals",
};
const DOWNGRADE_TARGET: Record<"client" | "platform", string> = { client: "unclear", platform: "weak" };

export function buildClientPlatformDiscoveryPrompt(opts: ClientPlatformDiscoveryOpts): string {
  const excludeBlock = opts.excludeNames.length
    ? `Do NOT propose any of these -- already on file: ${opts.excludeNames.join(", ")}.`
    : "None on file yet -- propose freely.";
  const rubricLabel = opts.kind === "client" ? "CLIENT FIT RUBRIC (config/outreach/clients.md)" : "PLATFORM FIT RUBRIC (config/outreach/platforms.md)";
  const extraLabel =
    opts.kind === "client" ? "PERSON-FIT RUBRIC (config/outreach/person-fit.md)" : "MUXIN'S EXISTING PER-CHANNEL POSITIONING (config/platforms.yaml spin_angles)";
  const personFitStep = opts.kind === "client" ? `\n5. Person-fit pass: try to identify one named individual at the company (founder, exec, or a visible team member) who might be a genuine philosophical match, using the Philosophical Depth Probe tiers from the person-fit rubric above. Only report a person-fit item if they rate Genuine depth or Developing WITH a direct quote backing it. If nobody clears that bar, do not report one at all -- that is a legitimate, expected outcome.` : "";
  const pitchInstruction =
    opts.kind === "client"
      ? `the specific, honest angle a pitch to this company would use, naming the real match found`
      : `whichever per-channel positioning entry above has the closest audience match to this candidate's actual audience -- use its "angle" text as the core material, do not invent a new worldview framing from scratch when an already-approved one fits`;
  const lensBlock = opts.lens
    ? [
        `--- ACTIVE DISCOVERY LENS (rotate this run; do not broaden back to generic search) ---`,
        `Belief: ${opts.lens.belief}`,
        `Community dialect: ${opts.lens.dialect}`,
        `Modality: ${opts.lens.modality}`,
        opts.anchorContext?.trim() || "No trusted anchor subset selected for this run.",
        `Generate fresh search queries from this belief x dialect x modality. Treat anchors as graph entry points, not as candidates to repeat.`,
      ]
    : [];
  const feedbackBlock = [
    `--- DISCOVERY FEEDBACK ---`,
    opts.calibration?.trim() || "No pursue/pass calibration is available yet. Keep classifications conservative.",
    opts.antiExamples?.length
      ? `Prior pass reasons are negative examples. Do not surface lookalikes:\n${opts.antiExamples.map((item) => `- ${item}`).join("\n")}`
      : "No prior pass reasons are available yet.",
  ];
  const peopleFirstInstruction = opts.kind === "client"
    ? `Start with reflective founders or executives whose public words show openness to changing direction. Establish a named person's worldview fit with a direct quote first, then research the company only after that person qualifies. The company is the eventual lead record, but its marketing voice is not the discovery starting point.`
    : `Start with platforms whose actual recent audience and contributor path match the rubric.`;

  return [
    `You are running the DISCOVERY stage of a client/platform-fit outreach engine for Muxin Li (docs/outreach-engine-plan.md), a new stage upstream of the existing RESEARCH stage.`,
    `Theme to search around: ${opts.theme}`,
    excludeBlock,
    ``,
    ...(opts.brief?.trim() ? [`--- MUXIN'S BRIEF (config/outreach/brief.md): the primary lens; where it disagrees with the rubric below, the brief wins ---`, opts.brief.trim(), ``] : []),
    `--- ${rubricLabel} ---`,
    opts.rubric.trim(),
    ``,
    `--- WORLDVIEW MAP (config/outreach/worldview-map.md) ---`,
    opts.worldviewMap.trim(),
    ``,
    `--- ${extraLabel} ---`,
    opts.extraContext.trim(),
    ``,
    ...lensBlock,
    ...(lensBlock.length ? [``] : []),
    ...feedbackBlock,
    ``,
    `--- YOUR TASK ---`,
    peopleFirstInstruction,
    `Search the web and propose up to ${opts.maxCandidates} real, specific ${opts.kind === "client" ? "companies" : "platforms"} that plausibly fit the theme and rubric above. Each must be a real, currently-operating entity you can find live evidence for -- never invent one.`,
    `For EACH candidate you propose, walk the SAME closed-checklist research the engine's normal research stage runs:`,
    `1. Walk the ${SIGNAL_CATEGORIES[opts.kind]} from the rubric above, one at a time. For each signal, search at most ${opts.searchBudgetPerSignal} times. If nothing turns up within that budget, record "no evidence found" and move on.`,
    `2. Look for a worldview-match: a direct quote (with a working source link) from the candidate itself (founder, blog, press, job postings, mission page) that echoes one of the worldview-map statements above, in its own words. REQUIRED to be a real quote -- if none exists, say so plainly, do not paraphrase or infer one.`,
    `3. Disconfirmation pass: separately search for evidence AGAINST the worldview match you just made. Record what you searched for and what you found, even if the honest answer is nothing found either way.`,
    `4. Classify as exactly one of: ${CLASSIFICATION_VALUES[opts.kind]}, per the rubric above. If evidence is thin or mixed, use ${DOWNGRADE_TARGET[opts.kind]}, a real and expected outcome. Never round up to look more decisive.${personFitStep}`,
    `${opts.kind === "client" ? "6" : "5"}. Pitch angle: ${pitchInstruction}.`,
    ``,
    `RULES:`,
    `- Every evidence item must have a real, working-looking source URL, and worldview-match items must carry a real direct quote. No quote means no worldview-match claim, full stop.`,
    `- Cite Glassdoor/Blind-style or comment-section commentary as commentary, never as verified fact.`,
    `- No em dashes anywhere in your output. Use periods, commas, colons, or parentheses instead.`,
    `- Do not invent evidence or a candidate. "No evidence found" and "fewer than ${opts.maxCandidates} candidates" are both legitimate, expected results.`,
    ``,
    `--- OUTPUT FORMAT (repeat this whole block once per candidate, numbered CANDIDATE 1, CANDIDATE 2, ... nothing before CANDIDATE 1 or after the last block) ---`,
    `CANDIDATE 1:`,
    `NAME: <candidate name>`,
    `URL: <candidate's real URL>`,
    `PROFILE:`,
    `<2-4 sentence plain-prose summary of what this candidate is and does, for someone who has never heard of it>`,
    ``,
    `EVIDENCE:`,
    `<one line per evidence item found, in exactly this shape, one item per line>`,
    `- E1 | signal: <signal category> | person: <name, or blank> | source: <full https URL> | quote: <exact quote in double quotes, or (none) for non-quote signals> | <one-line description>`,
    ``,
    `DISCONFIRMATION:`,
    `<1-3 sentences: what you searched for as evidence against the worldview match, and what you found or did not find>`,
    ``,
    `CLASSIFICATION: <${CLASSIFICATION_VALUES[opts.kind]}>`,
    `CLASSIFICATION_NOTE:`,
    `<1-2 short paragraphs of rationale citing the evidence item ids above, e.g. "per E2, E4". Must not assert a worldview match without citing a worldview-match evidence item that carries a real quote.>`,
    ``,
    `PITCH_ANGLE: <one sentence, or "insufficient evidence for a pitch angle yet" if classification is on the low end>`,
  ].join("\n");
}

export interface ClientPlatformDiscoveryCandidate extends ParsedResearch {
  name: string;
  url: string;
}

// Splits the multi-candidate response on its own CANDIDATE N: markers, pulls NAME/URL off the top
// of each block, then reuses parseResearchResponse verbatim for the rest of that block -- the
// per-candidate body is byte-identical in shape to a single research.ts response, so there is no
// reason to re-implement that marker scan here.
export function parseClientPlatformDiscoveryCandidates(text: string): ClientPlatformDiscoveryCandidate[] {
  const blocks = text
    .split(/^CANDIDATE\s+\d+:\s*$/m)
    .map((b) => b.trim())
    .filter(Boolean);
  const results: ClientPlatformDiscoveryCandidate[] = [];
  for (const block of blocks) {
    const nameM = block.match(/^NAME:\s*(.*)$/m);
    const name = nameM ? nameM[1].trim() : "";
    if (!name) continue; // malformed block (e.g. model declined this candidate slot) -- skip, don't throw
    const urlM = block.match(/^URL:\s*(.*)$/m);
    const parsed = parseResearchResponse(block);
    results.push({ name, url: urlM ? urlM[1].trim() : "", ...parsed });
  }
  return results;
}

export interface ContentExampleDiscoveryOpts {
  theme: string;
  maxCandidates: number;
  excludeNames: string[];
  searchBudgetPerSignal: number;
}

// content-example candidates are NOT outreach targets -- they're raw material for the (separate,
// opt-in) /brand-lens Inspiration mode: a real product/company/org move worth naming a testable,
// load-bearing belief about. This prompt deliberately does NOT ask the model to name the belief
// under audit itself (that's /brand-lens's job, and Muxin writes any resulting piece) -- it only
// asks for a real, cited example plus a tentative one-line angle, so Muxin has something concrete
// to vet.
export function buildContentExampleDiscoveryPrompt(opts: ContentExampleDiscoveryOpts): string {
  const excludeBlock = opts.excludeNames.length
    ? `Do NOT propose any of these -- already on file: ${opts.excludeNames.join(", ")}.`
    : "None on file yet -- propose freely.";
  return [
    `You are scouting real-world examples for Muxin Li to potentially write about, using a "riskiest belief, cheapest test, what it saves or unlocks" framing (a separate tool composes that analysis later -- your job here is only to FIND good raw material, cited, never to compose the analysis yourself).`,
    `Theme to search around: ${opts.theme}`,
    excludeBlock,
    ``,
    `--- YOUR TASK ---`,
    `Search the web and find up to ${opts.maxCandidates} real, specific, recent examples (a product launch, a pricing change, a public strategy move, an org's stated bet) that plausibly rest on one clear, testable assumption -- the kind of thing worth de-risking in public. Each must be real and citable, never invented.`,
    `For each candidate, search at most ${opts.searchBudgetPerSignal} times to find a real quote (with a working source link) in the company/org's OWN words describing the move or claim. If you can't find a real quote within budget, drop that candidate rather than inventing one.`,
    ``,
    `RULES:`,
    `- Every candidate must carry a real, working-looking source URL and a real, exact quote. No quote means drop the candidate.`,
    `- No em dashes anywhere in your output. Use periods, commas, colons, or parentheses instead.`,
    `- Do not invent a candidate, a quote, or a source. Fewer than ${opts.maxCandidates} candidates is a legitimate, expected result.`,
    `- ANGLE is a TENTATIVE one-line guess at the riskiest assumption, not a finished analysis -- it will be re-examined (and can be overridden) later.`,
    ``,
    `--- OUTPUT FORMAT (repeat once per candidate, numbered CANDIDATE 1, CANDIDATE 2, ... nothing before CANDIDATE 1 or after the last block) ---`,
    `CANDIDATE 1:`,
    `NAME: <short name for the example, e.g. "Acme's Q3 pricing relaunch">`,
    `URL: <the source URL>`,
    `WHY:`,
    `<1-3 sentences: what real move/claim this is, and why it looks like it rests on one clear, testable assumption>`,
    ``,
    `EVIDENCE:`,
    `<exactly one line, in this shape>`,
    `- E1 | signal: source-quote | person: | source: <full https URL> | quote: <exact quote in double quotes> | <one-line description>`,
    ``,
    `ANGLE: <one tentative sentence naming the riskiest belief this seems to rest on>`,
  ].join("\n");
}

export interface ContentExampleDiscoveryCandidate {
  name: string;
  url: string;
  why: string;
  evidence: EvidenceItem[];
  angle: string;
}

const CE_MARKERS = ["NAME", "URL", "WHY", "EVIDENCE", "ANGLE"];

export function parseContentExampleDiscoveryCandidates(text: string): ContentExampleDiscoveryCandidate[] {
  const blocks = text
    .split(/^CANDIDATE\s+\d+:\s*$/m)
    .map((b) => b.trim())
    .filter(Boolean);
  const markerRe = new RegExp(`^(${CE_MARKERS.join("|")}):\\s*(.*)$`);
  const results: ContentExampleDiscoveryCandidate[] = [];
  for (const block of blocks) {
    const sections: Record<string, string[]> = {};
    let current: string | null = null;
    for (const line of block.split("\n")) {
      const m = line.match(markerRe);
      if (m) {
        current = m[1];
        sections[current] = sections[current] ?? [];
        if (m[2]) sections[current].push(m[2]);
        continue;
      }
      if (current) sections[current].push(line);
    }
    const get = (key: string) => (sections[key] ?? []).join("\n").trim();
    const name = get("NAME");
    if (!name) continue; // malformed/declined block -- skip, don't throw
    const evidenceBlock = get("EVIDENCE");
    results.push({
      name,
      url: get("URL"),
      why: get("WHY"),
      evidence: parseEvidence(`## Evidence\n\n${evidenceBlock}\n`),
      angle: get("ANGLE"),
    });
  }
  return results;
}

// Discovery does strictly more searching per run than a single research.ts pass (it proposes
// candidates AND researches each one), so its budget is computed per-kind rather than reusing
// computeSearchBudgetTotal directly: signalsPerCandidate mirrors research.ts's own SIGNAL_COUNT
// (client=3, platform=5), plus a flat overhead for the candidate-proposal searches themselves.
// content-example candidates only need one signal (the source-quote), so signalsPerCandidate=1.
const SIGNALS_PER_CANDIDATE: Record<"client" | "platform" | "content-example", number> = {
  client: 3,
  platform: 5,
  "content-example": 1,
};
const PROPOSAL_OVERHEAD_SEARCHES = 2;

export function computeDiscoveryBudget(
  kind: "client" | "platform" | "content-example",
  maxCandidates: number,
  searchBudgetPerSignal: number,
): number {
  return searchBudgetPerSignal * (maxCandidates * SIGNALS_PER_CANDIDATE[kind] + PROPOSAL_OVERHEAD_SEARCHES);
}
