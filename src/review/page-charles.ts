import type { CharlesPost } from "./charles.js";

export type CharlesPage = "input" | "needs-review" | "approved" | "all";

export function charlesPostsForPage(posts: CharlesPost[], page: CharlesPage): CharlesPost[] {
  if (page === "needs-review") return posts.filter((post) => post.status === "pending" || post.status === "revise");
  if (page === "approved") return posts.filter((post) => post.status === "approve");
  if (page === "all") return posts;
  return [];
}
