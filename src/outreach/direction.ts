import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withFileLock } from "../runtime/file-lock.js";

export interface LeadDirection { text: string; captureIds: string[] }
export function readLeadDirection(absDir: string): LeadDirection {
  const path = join(absDir, "direction.json");
  if (!existsSync(path)) return { text: "", captureIds: [] };
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (typeof data.text !== "string" || !Array.isArray(data.captureIds) || !data.captureIds.every((id: unknown) => typeof id === "string")) throw new Error("Invalid saved outreach angle");
  return data;
}

/** Capture retries never duplicate the thought or overwrite later owner edits. */
export function saveLeadDirection(root: string, dir: string, text: string, captureId?: string): LeadDirection {
  if (!/^outreach\/leads\/[A-Za-z0-9][\w.-]*$/.test(dir)) throw new Error("Invalid outreach lead folder");
  const abs = join(root, dir);
  if (realpathSync(abs) !== join(realpathSync(root), dir)) throw new Error("Lead folder must stay inside this repository");
  if (!existsSync(join(abs, "lead.md"))) throw new Error("No such lead");
  const path = join(abs, "direction.json");
  return withFileLock(path + ".lock", () => {
    const before = readLeadDirection(abs);
    if (captureId && before.captureIds.includes(captureId)) return before;
    const value = captureId && before.text ? before.text + "\n\n" + text.trim() : text.trim();
    if (value.length > 2000) throw new Error("Keep the combined outreach angle under 2000 characters. Your captured thought is still saved in Studio.");
    const next = { text: value, captureIds: captureId ? [...before.captureIds, captureId] : before.captureIds };
    const temp = path + "." + process.pid + ".tmp";
    writeFileSync(temp, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
    renameSync(temp, path);
    return next;
  });
}
