import { existsSync, readFileSync, realpathSync } from "node:fs";
import { relative, resolve } from "node:path";
import { readArtifact } from "../venture/artifacts.js";
import { readDecision } from "../venture/decisions.js";
import { clusterAnalysisPath, ventureDir } from "../venture/paths.js";

export type VentureDocumentState = "missing" | "empty" | "ready" | "unavailable";

export interface VentureDocumentIndexItem {
  id: string;
  phase: number;
  title: string;
  path: string;
  state: VentureDocumentState;
  error?: string;
}

export interface VentureDocument extends VentureDocumentIndexItem {
  content: string | null;
}

type DocumentSource =
  | { kind: "artifact"; artifactId: string }
  | { kind: "decision"; decisionId: string }
  | { kind: "file"; path: string };

interface DocumentDefinition {
  id: string;
  phase: number;
  title: string;
  source: (slug: string) => DocumentSource;
}

const DOCUMENTS: DocumentDefinition[] = [
  { id: "research-plan", phase: 1, title: "Research plan and confirmed knowns", source: () => ({ kind: "artifact", artifactId: "p1-research-plan" }) },
  { id: "research-read", phase: 1, title: "Research read and findings", source: () => ({ kind: "artifact", artifactId: "p1-research-read" }) },
  { id: "cluster-analysis", phase: 3, title: "Cluster analysis", source: (slug) => ({ kind: "file", path: clusterAnalysisPath(slug) }) },
  { id: "transformation", phase: 3, title: "Transformation", source: () => ({ kind: "decision", decisionId: "p3-transformation-01" }) },
  { id: "product-outline", phase: 3, title: "Product outline", source: () => ({ kind: "artifact", artifactId: "p3-product-outline" }) },
  { id: "price-decision", phase: 3, title: "Price decision", source: () => ({ kind: "artifact", artifactId: "p3-price-decision" }) },
  { id: "operating-plan", phase: 4, title: "Operating plan", source: () => ({ kind: "artifact", artifactId: "p4-operating-plan" }) },
  { id: "day-14-review", phase: 4, title: "Day 14 review", source: () => ({ kind: "artifact", artifactId: "p4-day-14-review" }) },
];

function insideVenture(slug: string, candidate: string): string {
  const root = resolve(ventureDir(slug));
  const absolute = resolve(candidate);
  const rel = relative(root, absolute);
  if (rel.startsWith("..") || rel.includes("/../")) {
    throw new Error("document path is outside venture directory");
  }
  // A missing canonical document is an honest state, so do not require realpath() to succeed for
  // it. Existing files get a second containment check after symlinks are resolved; otherwise an
  // apparently in-tree body path could read an arbitrary file through an in-tree symlink.
  if (existsSync(absolute)) {
    const realRoot = realpathSync(root);
    const realFile = realpathSync(absolute);
    const realRel = relative(realRoot, realFile);
    if (realRel.startsWith("..") || realRel.includes("/../")) {
      throw new Error("document path is outside venture directory");
    }
  }
  return absolute;
}

function fromText(def: DocumentDefinition, path: string, content: string | null): VentureDocument {
  return {
    id: def.id,
    phase: def.phase,
    title: def.title,
    path,
    state: content === null ? "missing" : content.trim() ? "ready" : "empty",
    content,
  };
}

function resolveDocument(slug: string, def: DocumentDefinition): VentureDocument {
  const source = def.source(slug);
  if (source.kind === "file") {
    const path = insideVenture(slug, source.path);
    return fromText(def, relative(ventureDir(slug), path), existsSync(path) ? readFileSync(path, "utf8") : null);
  }

  if (source.kind === "decision") {
    const decision = readDecision(slug, source.decisionId);
    return fromText(def, "decisions.jsonl", decision ? JSON.stringify(decision, null, 2) : null);
  }

  const artifact = readArtifact(slug, source.artifactId);
  if (!artifact) return fromText(def, "artifacts.jsonl", null);
  if (!artifact.body_path) {
    return fromText(def, "artifacts.jsonl", artifact.fields === null ? "" : JSON.stringify(artifact.fields, null, 2));
  }
  const path = insideVenture(slug, resolve(ventureDir(slug), artifact.body_path));
  return fromText(def, relative(ventureDir(slug), path), existsSync(path) ? readFileSync(path, "utf8") : null);
}

export function listVentureDocuments(slug: string): VentureDocumentIndexItem[] {
  return DOCUMENTS.map((def) => {
    try {
      const { content: _content, ...item } = resolveDocument(slug, def);
      return item;
    } catch (error) {
      const source = def.source(slug);
      let path: string;
      if (source.kind === "file") path = relative(ventureDir(slug), source.path);
      else if (source.kind === "decision") path = "decisions.jsonl";
      else {
        path = "artifacts.jsonl";
        try {
          path = readArtifact(slug, source.artifactId)?.body_path ?? path;
        } catch {
          // The row is already unavailable. A malformed durable log must not make error reporting
          // retry the same failed parse and take down the whole index.
        }
      }
      return {
        id: def.id,
        phase: def.phase,
        title: def.title,
        path,
        state: "unavailable",
        error: error instanceof Error ? error.message : "document is unavailable",
      };
    }
  });
}

export function readVentureDocument(slug: string, id: string): VentureDocument | undefined {
  const def = DOCUMENTS.find((document) => document.id === id);
  return def ? resolveDocument(slug, def) : undefined;
}
