import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Charles routes expose the production persona through a dedicated reviewed edit workflow", () => {
  const source = readFileSync(new URL("./serve-charles.ts", import.meta.url), "utf8");
  assert.ok(source.includes('url.pathname === "/api/charles/persona"'));
  assert.ok(source.includes('url.pathname === "/api/charles/persona/proposals"'));
  assert.match(source, /proposeCharlesPersonaEdit/);
  assert.match(source, /approveCharlesPersonaProposal/);
  assert.match(source, /rejectCharlesPersonaProposal/);
});

test("Charles room renders production YAML editing and explicit proposal decisions beside the unchanged copyable brief", () => {
  const source = readFileSync(new URL("./page.ts", import.meta.url), "utf8");
  assert.match(source, /id="charlesPersonaYaml"/);
  assert.match(source, /id="charlesPersonaProposeBtn"/);
  assert.match(source, /id="charlesPersonaProposals"/);
  assert.match(source, /\/api\/charles\/persona\/proposals/);
  assert.match(source, /data-persona-decision="approve"/);
  assert.match(source, /data-persona-decision="reject"/);
  assert.match(source, /id="charlesBriefText" readonly/);
  const draftingSource = readFileSync(new URL("./charles-jobs.ts", import.meta.url), "utf8");
  assert.match(draftingSource, /read charles\/AGENTS\.md and charles\/config\/persona\.yaml in full/);
});
