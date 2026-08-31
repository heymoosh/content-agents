export interface DistributionRecommendation {
  option: string;
  reason: string;
  requiredMedia?: "image-carousel" | "static-quote-card" | "short-video-script";
}

export interface SourceDistributionRecommendation {
  topic: "civic-technology" | "career-purpose" | "general" | "short-note";
  platforms: DistributionRecommendation[];
  media: DistributionRecommendation[];
  mediaRationale: string;
  evidence: "source-fit";
}

function occurrences(body: string, terms: readonly string[]): number {
  const text = body.toLowerCase();
  return terms.reduce((sum, term) => sum + (text.match(new RegExp(`\\b${term}\\b`, "g"))?.length ?? 0), 0);
}

export function recommendSourceDistribution(input: { body: string; sourceKind?: string }): SourceDistributionRecommendation {
  const body = input.body.trim();
  const words = body ? body.split(/\s+/).length : 0;
  const headings = body.split("\n").filter((line) => /^#{1,3}\s+/.test(line.trim())).length;
  const isNote = input.sourceKind === "substack-note";
  if (isNote || words <= 80) {
    return {
      topic: "short-note",
      platforms: [
        { option: "x", reason: "Publish on X because this is one compact claim that fits the fast text feed without added setup." },
        { option: "threads", reason: "Publish on Threads because the thought is conversational and complete at its original short length." },
        { option: "bluesky", reason: "Publish on Bluesky because the complete short observation fits a conversational text feed without expansion." },
        { option: "mastodon", reason: "Publish on Mastodon because this is a self-contained text post that does not depend on an algorithmic hook." },
        { option: "linkedin", reason: "Publish on LinkedIn as a brief observation because the point is complete without turning it into a longer lesson post." },
      ],
      media: [],
      mediaRationale: "Use text only because this is already a complete short-form thought. Adding media would manufacture weight the source does not need.",
      evidence: "source-fit",
    };
  }

  const civic = occurrences(body, ["civic", "democracy", "democratic", "politics", "political", "society", "social", "community", "collective", "power"]);
  const technology = occurrences(body, ["ai", "technology", "technical", "system", "systems", "product", "builder"]);
  const career = occurrences(body, ["career", "work", "job", "professional", "happiness", "purpose", "fulfillment", "fulfilling", "passion"]);
  const topic = career > civic + technology * 0.35 ? "career-purpose" : civic >= 2 || technology >= 3 ? "civic-technology" : "general";

  const platforms: DistributionRecommendation[] = topic === "career-purpose"
    ? [
        { option: "linkedin", reason: "Publish on LinkedIn because the source connects career, work, and personal purpose in a reflective professional narrative." },
        { option: "threads", reason: "Publish on Threads because the personal realization can travel as a conversational sequence without becoming a formal essay summary." },
        { option: "x", reason: "Publish on X because the essay contains concise claims about work, happiness, and purpose that can stand alone." },
        { option: "bluesky", reason: "Publish on Bluesky because the reflective argument can become an observational post rather than a promotional link drop." },
        { option: "mastodon", reason: "Publish on Mastodon because the idea supports a self-contained text treatment for a non-algorithmic feed." },
        { option: "instagram", reason: "Publish on Instagram because the personal arc can become a carousel with one clear idea per slide.", requiredMedia: "image-carousel" },
        { option: "tiktok", reason: "Publish on TikTok because the personal realization has a spoken hook, turn, and conclusion suitable for a short video.", requiredMedia: "short-video-script" },
        { option: "youtube", reason: "Publish as a YouTube Short because the source can support the same concise spoken story with a durable searchable title.", requiredMedia: "short-video-script" },
      ]
    : topic === "civic-technology"
      ? [
          { option: "bluesky", reason: "Publish on Bluesky because the source joins civic questions and technology in the conversational public-interest territory of that audience." },
          { option: "linkedin", reason: "Publish on LinkedIn because the long source develops a structured argument about institutions, systems, and practical agency." },
          { option: "x", reason: "Publish on X because the source contains several sharp claims that can stand alone as concise provocations." },
          { option: "mastodon", reason: "Publish on Mastodon because the civic argument can be shared as substantive self-contained text without relying on algorithmic reach." },
          { option: "threads", reason: "Publish on Threads because the argument can be translated into a conversational sequence for a broader mixed-topic audience." },
          { option: "instagram", reason: "Publish on Instagram because the source's named sections can become a sequential carousel without inventing new claims.", requiredMedia: "image-carousel" },
          { option: "tiktok", reason: "Publish on TikTok because the source contains a conflict, argument, and practical turn that can become a focused short video.", requiredMedia: "short-video-script" },
          { option: "youtube", reason: "Publish as a YouTube Short because the same focused video treatment can reach a second video-first audience.", requiredMedia: "short-video-script" },
        ]
      : [
          { option: "threads", reason: "Publish on Threads because the source is idea-led and conversational rather than tied to a specialist channel." },
          { option: "x", reason: "Publish on X because its central point can be compressed into a clear standalone claim." },
          { option: "bluesky", reason: "Publish on Bluesky because the central idea can stand alone as an observational text post." },
          { option: "mastodon", reason: "Publish on Mastodon because the source supports substantive self-contained text." },
          { option: "linkedin", reason: "Publish on LinkedIn when the idea can be framed as a practical or reflective lesson." },
          { option: "instagram", reason: "Publish on Instagram when the source structure supports a visual sequence.", requiredMedia: "image-carousel" },
          { option: "tiktok", reason: "Publish on TikTok when the source can become a focused spoken short.", requiredMedia: "short-video-script" },
          { option: "youtube", reason: "Publish as a YouTube Short using the same reviewed short-video treatment.", requiredMedia: "short-video-script" },
        ];

  const media: DistributionRecommendation[] = [];
  if (words >= 500 && headings >= 3) {
    media.push({ option: "image-carousel", reason: "Use an image carousel because the source has multiple named sections that can become a sequential visual argument without inventing new substance." });
  }
  if (words >= 250) {
    media.push({ option: "static-quote-card", reason: "Use a static quote card because the source is long enough to contain a self-supporting line worth preserving verbatim." });
  }
  if (words >= 500) {
    media.push({ option: "short-video-script", reason: "Use a short-video script because the source has enough substance for a hook, one developed point, and a conclusion without padding." });
  }
  return {
    topic,
    platforms,
    media,
    mediaRationale: media.length ? "The recommended media formats are supported by the source's existing structure and language." : "Use text only because the source does not provide enough visual structure to justify an asset.",
    evidence: "source-fit",
  };
}
