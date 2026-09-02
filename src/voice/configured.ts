/**
 * Deterministic hard checks shared by generated prose boundaries that use config/voice.yaml.
 * This is deliberately a bounded syntax check, not a substitute for human voice review.
 */
export function muxinVoiceFindings(body: string): string[] {
  const findings: string[] = [];
  if (/[—–]/.test(body)) findings.push("contains an em dash or en dash");
  const tells: readonly RegExp[] = [
    /\bhere(?:'|’)?s the (?:thing|kicker)\b/i,
    /\bthe thing is\b/i,
    /\bit(?:'|’)?s not just\b/i,
    /\bit(?:'|’)?s not about .{0,80}\bit(?:'|’)?s about\b/i,
    /\bisn(?:'|’)?t .{0,80}(?:,\s*|\.\s*)it(?:'|’)?s\b/i,
    /\b(?:isn(?:'|’)?t|more than) just\b/i,
    /\blet(?:'|’)?s (?:dive in|unpack|break it down)\b/i,
    /\b(?:in a world where|in an age of|in today(?:'|’)?s)\b/i,
    /\b(?:at the end of the day|the reality is|the truth is|make no mistake|it(?:'|’)?s worth noting|that said|needless to say)\b/i,
    /\b(?:delve|supercharge|game-changer|tapestry|testament|ever-evolving|robust|seamless|realm|landscape|foster|harness|elevate|empower|paradigm|journey)\b/i,
    /\b(?:navigate the complexities|unlock(?:ing|ed|s)?|at scale)\b/i,
  ];
  if (tells.some((pattern) => pattern.test(body))) findings.push("contains an AI tell banned by config/voice.yaml");
  if (/\[\^[^\]]+\]|^\[\^[^\]]+\]:/m.test(body)) findings.push("contains a markdown footnote marker");
  if (/:\s+[a-z]/.test(body)) findings.push("starts a word lowercase after a colon");
  return findings;
}
