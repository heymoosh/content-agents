// Generic fallback for any URL that isn't a working Substack (or other RSS) feed: fetch the raw
// page HTML and extract the main article via Readability. Used only when fetch-substack.ts's
// feed-based path fails.

import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import type { FetchedPost } from "./fetch-substack.js";

function firstValidDate(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function extractPublishedAt(document: Document): string | null {
  const og = document.querySelector('meta[property="article:published_time"]')?.getAttribute("content");
  if (og) {
    const d = firstValidDate(og);
    if (d) return d;
  }

  for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const data = JSON.parse(script.textContent ?? "");
      for (const item of Array.isArray(data) ? data : [data]) {
        const d = firstValidDate(item?.datePublished);
        if (d) return d;
      }
    } catch {
      // malformed JSON-LD — skip
    }
  }

  return firstValidDate(document.querySelector("time[datetime]")?.getAttribute("datetime"));
}

export async function fetchGenericArticle(url: string): Promise<FetchedPost> {
  const res = await fetch(url, { headers: { "user-agent": "content-agents/0.1" } });
  if (!res.ok) throw new Error(`generic page fetch failed: ${url} → ${res.status}`);
  const html = await res.text();

  const { document } = parseHTML(html);
  const publishedAt = extractPublishedAt(document);

  const article = new Readability(document).parse();
  if (!article?.textContent?.trim()) {
    throw new Error(`readability found no article content at ${url}`);
  }

  return {
    title: article.title?.trim() || "untitled",
    url,
    publishedAt: publishedAt ?? firstValidDate(article.publishedTime),
    text: article.textContent.trim(),
  };
}
