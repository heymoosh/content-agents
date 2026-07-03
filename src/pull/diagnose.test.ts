/**
 * Unit tests for src/pull/diagnose.ts — looksLikeAuthWall. This is the signal that separates an
 * expired login (re-auth) from a site UI change (update selectors), so getting it right IS the
 * triage. captureDiagnostics is a side-effecting Playwright call, verified live rather than here.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeAuthWall } from "./diagnose.js";

test("looksLikeAuthWall flags login / checkpoint / authwall URLs", () => {
  for (const url of [
    "https://www.linkedin.com/uas/login?session_redirect=%2Fanalytics%2Fcreator%2Fcontent%2F",
    "https://www.linkedin.com/login",
    "https://www.linkedin.com/checkpoint/challenge/AbC",
    "https://www.linkedin.com/authwall?trk=x",
  ]) {
    assert.equal(looksLikeAuthWall(url), true, url);
  }
});

test("looksLikeAuthWall passes an authenticated analytics URL", () => {
  assert.equal(looksLikeAuthWall("https://www.linkedin.com/analytics/creator/content/"), false);
});
