import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { ZodType } from "zod";

// Load + zod-validate a YAML config file. A missing file (ENOENT) is a legitimate "no override"
// case and returns `fallback` unchanged — e.g. a checkout with no config/platforms.yaml override.
// Any OTHER failure (malformed YAML, a field with the wrong type, a required field missing) throws,
// naming the file path and what was wrong, instead of silently falling back to defaults — a YAML
// typo should break loudly, not quietly disable the behavior it configures.
export function loadYamlConfig<T>(path: string, schema: ZodType<T>, fallback: T): T {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (e) {
    throw new Error(`${path}: invalid YAML — ${(e as Error).message}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`${path}: invalid config — ${issues}`);
  }
  return result.data;
}
