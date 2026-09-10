// Pure summariser for the Studio E2E runner (e2e/run-all.ts). No filesystem access here — the
// runner reads the per-journey ledger and writes the returned summary; this module only computes
// it, so the counting logic can be unit-tested without booting Chromium.

export type JourneyStatus = "pass" | "fail" | "blocked";

export type JourneyRecord = {
  pass: string;
  feature: string;
  pr?: string;
  status: JourneyStatus;
  detail: string;
};

export type RunIdentity = {
  candidateSha: string;
  command: string;
  exitCode: number;
};

export type NamedReason = { name: string; reason: string };

export type E2ESummary = {
  candidateSha: string;
  command: string;
  exitCode: number;
  passed: number;
  failed: number;
  skipped: number;
  failures: NamedReason[];
  skips: NamedReason[];
};

function journeyName(record: JourneyRecord): string {
  return `${record.pass}: ${record.feature}`;
}

/**
 * Derive a citable run summary from the runner's per-journey records and its run identity.
 * A "blocked" record is a skip. Every failed or skipped journey must carry a non-empty detail —
 * an empty one is treated as a refusal to summarise rather than silently reported as "".
 */
export function summarizeE2ERun(records: JourneyRecord[], identity: RunIdentity): E2ESummary {
  const failures: NamedReason[] = [];
  const skips: NamedReason[] = [];
  let passed = 0;

  for (const record of records) {
    if (record.status === "pass") {
      passed += 1;
      continue;
    }
    const reason = record.detail?.trim();
    if (!reason) {
      throw new Error(
        `refusing to summarise: "${journeyName(record)}" is ${record.status} with no reason recorded`,
      );
    }
    if (record.status === "fail") {
      failures.push({ name: journeyName(record), reason });
    } else {
      skips.push({ name: journeyName(record), reason });
    }
  }

  return {
    candidateSha: identity.candidateSha,
    command: identity.command,
    exitCode: identity.exitCode,
    passed,
    failed: failures.length,
    skipped: skips.length,
    failures,
    skips,
  };
}
