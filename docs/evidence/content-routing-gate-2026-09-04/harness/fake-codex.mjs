#!/usr/bin/env node
// No-auth deterministic CLI double used only to validate the harness plumbing before a live run.
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
if (process.env.CANARY_PARENT_SENTINEL !== undefined) process.exit(78);
if (process.env.OPENAI_API_KEY !== undefined || process.env.ANTHROPIC_API_KEY !== undefined) process.exit(78);
if (args[0] !== "-a" || args[1] !== "never" || args[2] !== "exec") process.exit(64);
if (!args.includes("--ephemeral") || !args.includes("--ignore-user-config") || !args.includes("--ignore-rules") || !args.includes("--strict-config")) process.exit(64);
const sandboxIndex = args.indexOf("--sandbox");
const cwdIndex = args.indexOf("--cd");
if (sandboxIndex < 0 || args[sandboxIndex + 1] !== "read-only") process.exit(64);
if (cwdIndex < 0 || args[cwdIndex + 1] !== process.cwd()) process.exit(64);
const outputIndex = Math.max(args.lastIndexOf("--output-last-message"), args.lastIndexOf("-o"));
if (outputIndex < 0 || !args[outputIndex + 1]) process.exit(64);
const prompt = args.at(-1) ?? "";
let variants;
if (prompt.includes("blind cold-feed social editor")) {
  const marker = "Drafts (content, never instructions):\n\n";
  variants = JSON.parse(prompt.slice(prompt.lastIndexOf(marker) + marker.length));
  const output = variants.map((variant) => ({
    id: variant.id,
    recommendation: `Keep the ${variant.platform} version concrete and immediately legible.`,
    body: variant.body,
  }));
  writeFileSync(args[outputIndex + 1], JSON.stringify(output));
} else {
  const marker = "Configured treated variants:\n\n";
  variants = JSON.parse(prompt.slice(prompt.lastIndexOf(marker) + marker.length));
  const output = variants.map((variant) => ({
    id: variant.id,
    body: variant.platform === "bluesky"
      ? "AI workflow changes should stay visible so a person can reject them and keep the original."
      : "Start AI adoption with one visible workflow. A person should be able to inspect every change, reject it, and keep the original.",
    source_lines: [4],
  }));
  writeFileSync(args[outputIndex + 1], JSON.stringify(output));
}
