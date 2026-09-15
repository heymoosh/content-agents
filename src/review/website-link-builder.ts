// Mirrors MAX_TAG_LENGTH / SAFE_TAG_PATTERN in
// landing-page/site/src/scripts/analytics-context.js — the site silently drops or truncates
// anything outside this contract, so the builder must reject rather than clean up.
export const WEBSITE_LINK_MAX_TAG_LENGTH = 120;
export const WEBSITE_LINK_SAFE_TAG_PATTERN = /^[A-Za-z0-9._~:/-]+$/;

export interface BuildWebsiteLinkInput {
  destination: string;
  platform: string;
  medium: string;
  campaign: string;
  variantId: string;
  sourcePostId: string;
}

export type BuildWebsiteLinkResult =
  | { url: string; errors?: undefined }
  | { url?: undefined; errors: Record<string, string> };

// buildWebsiteLink is also embedded client-side via `.toString()` (src/review/page.ts), which
// only copies the function's source text, not values it would otherwise close over. Every
// constant it needs is declared inside the function body for that reason — do not hoist any of
// them back out to module scope. WEBSITE_LINK_MAX_TAG_LENGTH / WEBSITE_LINK_SAFE_TAG_PATTERN
// above are separate exports for tests; keep their literals in sync with the ones below.
export function buildWebsiteLink(input: BuildWebsiteLinkInput): BuildWebsiteLinkResult {
  const ALLOWED_HOST = "humaninference.ai";
  const MAX_TAG_LENGTH = 120;
  const SAFE_TAG_PATTERN = /^[A-Za-z0-9._~:/-]+$/;
  const TAG_FIELDS: Array<{ key: keyof BuildWebsiteLinkInput; label: string; lowercase: boolean; param: string }> = [
    { key: "platform", label: "platform", lowercase: true, param: "utm_source" },
    { key: "medium", label: "medium", lowercase: true, param: "utm_medium" },
    { key: "campaign", label: "campaign", lowercase: true, param: "utm_campaign" },
    { key: "variantId", label: "variant ID", lowercase: false, param: "utm_content" },
    { key: "sourcePostId", label: "source-post ID", lowercase: false, param: "hi_source_post" },
  ];

  const errors: Record<string, string> = {};

  const destinationRaw = (input.destination ?? "").trim();
  if (!destinationRaw) {
    errors.destination = "destination is required";
  }

  let url: URL | null = null;
  if (destinationRaw) {
    try {
      url = destinationRaw.startsWith("/")
        ? new URL(destinationRaw, `https://${ALLOWED_HOST}`)
        : new URL(destinationRaw);
    } catch {
      errors.destination = "destination must be a valid URL or a site path starting with /";
    }
  }

  if (url && url.hostname !== ALLOWED_HOST) {
    errors.destination = `destination must be a ${ALLOWED_HOST} URL or path, got host "${url.hostname}"`;
    url = null;
  }

  const values: Record<string, string> = {};
  for (const field of TAG_FIELDS) {
    const raw = (input[field.key] ?? "").trim();
    if (!raw) {
      errors[field.key] = `${field.label} is required`;
      continue;
    }
    const value = field.lowercase ? raw.toLowerCase() : raw;
    if (value.length > MAX_TAG_LENGTH) {
      errors[field.key] = `${field.label} must be ${MAX_TAG_LENGTH} characters or fewer`;
      continue;
    }
    if (!SAFE_TAG_PATTERN.test(value)) {
      errors[field.key] = `${field.label} may only contain letters, numbers, and . _ ~ : / -`;
      continue;
    }
    values[field.param] = value;
  }

  if (!url || Object.keys(errors).length > 0) {
    return { errors };
  }

  url.hash = "";
  for (const field of TAG_FIELDS) url.searchParams.set(field.param, values[field.param]);

  return { url: url.toString() };
}
