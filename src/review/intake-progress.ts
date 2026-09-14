// Shared by the server gate and the emitted browser UI. Keep this function self-contained.
export function intakeProgress(definitions: { key: string; label: string }[], values: Record<string, string>) {
  const missing = definitions.filter(f => !values[f.key]?.trim() ||
    (f.key === 'scorecard.required_live_posts' && (!Number.isSafeInteger(Number(values[f.key])) || Number(values[f.key]) <= 0)));
  return { missing, completed: definitions.length - missing.length, total: definitions.length, ready: missing.length === 0 };
}
