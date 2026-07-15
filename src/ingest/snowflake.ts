// Decode real per-post timestamps embedded in platform-native numeric IDs (Snowflake-style),
// so ingest doesn't have to fall back to a synthetic midnight built from a bare calendar date
// (X and LinkedIn's analytics exports carry only a Date/Publish Date column, no time-of-day).
// Both platforms embed a millisecond timestamp in the high bits of a 64-bit integer ID -- only
// the epoch offset and bit shift differ. Verified against real exports (card 6f1a2e9c): decoded
// X post 2073539791929376785 -> 2026-07-04T22:49:45.559Z, matching its export Date "Sat, Jul 4,
// 2026"; decoded LinkedIn activity 7478118288640630786 -> 2026-07-01T16:12:16.731Z, matching its
// export Post Publish Date "7/1/2026".

const SNOWFLAKE_SHIFT = 22n;
const TWITTER_EPOCH_MS = 1288834974657n; // 2010-11-04, X/Twitter's Snowflake epoch
const MIN_YEAR = 2010;
const MAX_YEAR = 2100;

function isPlausibleMs(ms: number): boolean {
  if (!Number.isFinite(ms)) return false;
  const year = new Date(ms).getUTCFullYear();
  return year >= MIN_YEAR && year <= MAX_YEAR;
}

function decodeSnowflake(id: string, epochMs: bigint): string | null {
  if (!/^\d+$/.test(id)) return null; // reject the sha256-hex fallback ids and any non-numeric input
  let n: bigint;
  try {
    n = BigInt(id);
  } catch {
    return null;
  }
  const ms = Number((n >> SNOWFLAKE_SHIFT) + epochMs);
  if (!isPlausibleMs(ms)) return null;
  return new Date(ms).toISOString();
}

/** X (Twitter) post id -> real creation time. Twitter Snowflake: the top 41 bits (after a 22-bit
 * shift off the low bits) are milliseconds since the Twitter custom epoch (2010-11-04). */
export function xPostTimeIso(postId: string | null | undefined): string | null {
  if (!postId) return null;
  return decodeSnowflake(postId, TWITTER_EPOCH_MS);
}

/** LinkedIn post/activity id -> real creation time. Same 22-bit shift as Twitter Snowflake, but
 * no epoch offset -- the top bits are a raw Unix ms timestamp. */
export function linkedinPostTimeIso(postId: string | null | undefined): string | null {
  if (!postId) return null;
  return decodeSnowflake(postId, 0n);
}
