import { fileURLToPath } from "node:url";
import { listLeads, renderTargetsList, type LeadSummary } from "./status.js";
import { buildFollowups, summarizeFollowups, type FollowupsResult } from "./tracker.js";

export function renderOutreachStrategySection(leads: LeadSummary[], followups: FollowupsResult): string {
  const summaries = summarizeFollowups(followups);
  const totalRows = summaries.reduce((sum, item) => sum + item.total, 0);
  const lines = [
    "## Outreach and follow-ups",
    "",
    "```text",
    renderTargetsList(leads),
    "```",
    "",
    "| bucket | total | due | overdue | responded |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...summaries.map((item) =>
      `| ${item.bucket} | ${item.total} | ${item.due} | ${item.overdue} | ${item.responded} |`,
    ),
  ];

  if (totalRows === 0) lines.push("", "No follow-up rows are active.");
  if (followups.jobsearchNote) lines.push("", `Job-search data: ${followups.jobsearchNote}`);
  return lines.join("\n");
}

export function buildOutreachStrategySection(): string {
  return renderOutreachStrategySection(listLeads(), buildFollowups());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(buildOutreachStrategySection());
}
