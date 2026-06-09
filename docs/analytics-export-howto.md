# Analytics export how-to (~10 minutes, every 1–2 weeks)

Drop the files into `data/inbox/<platform>/` — exact filenames don't matter; the importer
hashes contents and skips anything already imported.

## X / Twitter → `data/inbox/x/`
1. analytics.x.com (or X app → Premium → Analytics)
2. Posts / Content view → set date range to "since last export"
3. **Export data** → CSV → drop it in
- If per-post export isn't available on your tier, export the overview CSV — the importer
  preserves whatever columns exist (`raw_json`), but per-post is much more useful.

## LinkedIn → `data/inbox/linkedin/`
1. Profile → **Analytics & tools** (creator mode) → Post impressions → set range
2. **Export** → XLSX → drop it in
- The parser scans every sheet for a header row with an "Impressions" column, so layout
  changes usually still work. If it fails loudly, the columns changed — update
  `src/ingest/parse-linkedin.ts` aliases.

## Substack → `data/inbox/substack/`
1. Dashboard → **Stats** → Posts table
2. Export CSV (or Settings → Export your data and use the posts stats CSV)

## Bluesky — nothing to do
`npm run bluesky` fetches posts + engagement via the AT Protocol API.
One-time setup: create an app password at bsky.app/settings/app-passwords, put
`BLUESKY_HANDLE` and `BLUESKY_APP_PASSWORD` in `.env`.

## Communities (Moral Ambition, Democratic Resilience, Women in Product, ABC Builders, Lenny's)
No exports exist. Append a 30-second note to `data/community-log.md` after each post or
notable observation — format is at the top of that file. This is the only community signal
`/strategy` gets, so honest notes ("silence", "2 polite likes") matter as much as wins.
