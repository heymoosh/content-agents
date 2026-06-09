# YouTube upload setup (one-time, ~20 minutes)

Lets `/publish` upload finished Shorts directly. Free; default quota (10,000 units/day,
upload = 1,600 units) allows ~6 uploads/day — far more than needed.

## 1. Google Cloud project
1. console.cloud.google.com → New project (e.g. `content-agents`)
2. APIs & Services → Library → enable **YouTube Data API v3**

## 2. OAuth consent screen
1. APIs & Services → OAuth consent screen → External
2. Add yourself as the only test user… then **Publish app** (production). This matters:
   in "testing" mode refresh tokens expire every 7 days; in production they persist.
   With only the upload scope and yourself as the user, verification is not required —
   the unverified-app warning during your own consent is fine to click through.

## 3. Credentials
1. Credentials → Create credentials → OAuth client ID → **Desktop app**
2. Put client ID + secret in `.env` (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`)

## 4. Get the refresh token (once)
Run this and follow the URL it prints:

```bash
npx tsx -e '
const id = process.env.YOUTUBE_CLIENT_ID;
console.log(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${id}&redirect_uri=http://localhost:8089&response_type=code&access_type=offline&prompt=consent&scope=https://www.googleapis.com/auth/youtube.upload`);
require("http").createServer(async (req, res) => {
  const code = new URL(req.url, "http://localhost:8089").searchParams.get("code");
  if (!code) return res.end();
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      redirect_uri: "http://localhost:8089", grant_type: "authorization_code" }) });
  const j = await r.json();
  console.log("\nYOUTUBE_REFRESH_TOKEN=" + j.refresh_token);
  res.end("done — token printed in terminal"); process.exit(0);
}).listen(8089);
' 
```

(Export `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` in the shell first, or run after
filling `.env` with `set -a; source .env; set +a`.)

Put the printed value in `.env` as `YOUTUBE_REFRESH_TOKEN`.

## 5. Behavior
- Uploads are **private** by default — spot-check in YouTube Studio, then publish.
  Set `YOUTUBE_PRIVACY=public` in `.env` to skip that step later.
- `#Shorts` is appended to the title automatically; 9:16 + <3min qualifies as a Short.
- First test: approve a video row in a test content folder and run
  `npm run publish:youtube -- <folder>` — confirm it appears as private in Studio.
