import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// A cut is one version of a content folder's inspiration (source.md), built through an editorial
// lens (plan i-want-to-add-mellow-mist: "inspiration -> cuts -> approve -> atomize"). "extract" is
// the default lens and stays at today's top level (source.md/derivatives/) -- no cuts/ subfolder,
// no migration for existing content. Any additional lens (e.g. "derisk") gets its own
// cuts/<lens>/cut.md, scaffolded here once Muxin approves that version in Stage 1.

export const DEFAULT_LENS = "extract";

export interface CutSource {
  lens: string;
  title: string;
  text: string;
}

// Path to a non-default cut's folder: content/<slug>/cuts/<lens>/. Never called for "extract".
export function cutDir(folderDir: string, lens: string): string {
  return join(folderDir, "cuts", lens);
}

// Scaffold cuts/<lens>/cut.md + cuts/<lens>/derivatives/ for an approved, non-default cut. Throws
// if the lens is "extract" (that's the top-level default, never a subfolder) or if the cut already
// exists, mirroring scaffoldContentFolder's "already exists" guard in new-content.ts.
export function addCut(folderDir: string, src: CutSource): string {
  if (src.lens === DEFAULT_LENS) {
    throw new Error(`addCut: "${DEFAULT_LENS}" is the default top-level cut, never a cuts/ subfolder`);
  }
  const dir = cutDir(folderDir, src.lens);
  if (existsSync(join(dir, "cut.md"))) throw new Error(`already exists: ${dir}/cut.md`);
  mkdirSync(join(dir, "derivatives"), { recursive: true });
  writeFileSync(
    join(dir, "cut.md"),
    `---\nlens: ${src.lens}\ntitle: "${src.title.replace(/"/g, '\\"')}"\ncreated_at: ${new Date().toISOString()}\n---\n\n${src.text.trim()}\n`
  );
  return dir;
}

// Every lens with a cuts/<lens>/cut.md on disk, alphabetical. Does not include "extract" -- callers
// that need the full set (e.g. the review GUI's Cuts tab) should treat "extract" as always present
// when source.md exists, plus whatever this returns.
export function listCuts(folderDir: string): string[] {
  const cutsRoot = join(folderDir, "cuts");
  if (!existsSync(cutsRoot)) return [];
  return readdirSync(cutsRoot)
    .filter((name) => statSync(join(cutsRoot, name)).isDirectory() && existsSync(join(cutsRoot, name, "cut.md")))
    .sort();
}
