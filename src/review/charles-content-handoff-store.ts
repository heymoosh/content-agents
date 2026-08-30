import { readCharlesPost, type CharlesPost } from "./charles.js";
import { createCharlesContentHandoff, type CharlesContentHandoff } from "./charles-content-handoff.js";

export interface CharlesPostHandoffOptions {
  readonly root: string;
  readonly postId: string;
  readonly thought: string;
  readonly replySource?: string;
  readonly selectedOutputs: readonly string[];
  readonly descriptor: string;
  readonly originalInput: string;
  readonly inheritedVentureId?: string | null;
}

/** Bridge an approved Charles draft into Content configuration, without drafting or publishing. */
export function createApprovedCharlesHandoff(options: CharlesPostHandoffOptions): CharlesContentHandoff {
  const post: CharlesPost = readCharlesPost(options.postId, options.root);
  if (post.status !== "approve") throw new Error("Charles post must be approved before handoff");
  if (!post.body.trim()) throw new Error("Charles post has no source body");
  return createCharlesContentHandoff({
    id: options.postId, thought: options.thought || post.body,
    replySource: options.replySource, selectedOutputs: options.selectedOutputs,
    descriptor: options.descriptor, originalInput: options.originalInput,
    inheritedVentureId: options.inheritedVentureId,
  });
}
