// Fetch a Substack post (or the latest from a feed) and extract title + plain text.
// Public posts only — Substack has no API; the RSS feed and post HTML are the interfaces.

export interface FetchedPost {
  title: string;
  url: string;
  publishedAt: string | null;
  text: string;
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|blockquote|div)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  return m[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1").trim();
}

export async function fetchSubstackPost(url: string): Promise<FetchedPost> {
  // Resolve via the publication's RSS feed — it carries full content for public posts
  // and avoids scraping paywalled markup.
  const u = new URL(url);
  const feedUrl = `${u.origin}/feed`;
  const res = await fetch(feedUrl, { headers: { "user-agent": "content-agents/0.1" } });
  if (!res.ok) throw new Error(`feed fetch failed: ${feedUrl} → ${res.status}`);
  const xml = await res.text();

  const items = xml.split(/<item>/i).slice(1);
  if (items.length === 0) throw new Error(`no items in feed ${feedUrl}`);

  const wantLatest = u.pathname === "/" || u.pathname === "/feed";
  const item = wantLatest
    ? items[0]
    : items.find((it) => (tag(it, "link") ?? "").split("?")[0] === url.split("?")[0]);
  if (!item) {
    throw new Error(
      `post not found in feed (feeds carry ~20 recent posts). Save the essay text to a file and run /atomize <file> instead.`
    );
  }

  const html = tag(item, "content:encoded") ?? tag(item, "description") ?? "";
  return {
    title: tag(item, "title") ?? "untitled",
    url: tag(item, "link") ?? url,
    publishedAt: tag(item, "pubDate") ? new Date(tag(item, "pubDate")!).toISOString() : null,
    text: htmlToText(html),
  };
}
