// One-time YouTube OAuth helper. Prints a Google consent URL, listens for the
// redirect, swaps the code for a refresh token, and writes it into .env.
//
//   npx tsx scripts/youtube-auth.ts
//
// Needs YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET already in .env. Uses a loopback
// redirect on http://localhost:3000/oauth2callback (override port with PORT=...).
// See docs/setup-youtube-oauth.md. Re-run any time the refresh token is lost/revoked.
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ENV_PATH = process.env.ENV_FILE ?? join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
const PORT = Number(process.env.PORT ?? 3000);
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = "https://www.googleapis.com/auth/youtube.upload";

function readEnv(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) map.set(m[1], m[2].replace(/^["']|["']$/g, ""));
    }
  } catch {
    /* no .env */
  }
  return map;
}

function writeRefreshToken(token: string): void {
  let text = readFileSync(ENV_PATH, "utf8");
  if (/^YOUTUBE_REFRESH_TOKEN=.*$/m.test(text)) {
    text = text.replace(/^YOUTUBE_REFRESH_TOKEN=.*$/m, `YOUTUBE_REFRESH_TOKEN=${token}`);
  } else {
    text += `\nYOUTUBE_REFRESH_TOKEN=${token}\n`;
  }
  writeFileSync(ENV_PATH, text);
}

const env = readEnv();
const clientId = env.get("YOUTUBE_CLIENT_ID");
const clientSecret = env.get("YOUTUBE_CLIENT_SECRET");
if (!clientId || !clientSecret) {
  console.error(`YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET missing in ${ENV_PATH}`);
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: SCOPE,
  }).toString();

console.log("\n=== Open this URL in your browser, then click Allow ===\n");
console.log(authUrl);
console.log(`\nListening on ${REDIRECT} …\n`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404).end();
    return;
  }
  const error = url.searchParams.get("error");
  if (error) {
    res.writeHead(400).end(`OAuth error: ${error}`);
    console.error(`OAuth error: ${error}`);
    process.exit(1);
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("no code in callback");
    return;
  }

  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT,
        grant_type: "authorization_code",
      }),
    });
    const j = (await r.json()) as { refresh_token?: string; error?: string; error_description?: string };
    if (!j.refresh_token) {
      const msg = `no refresh_token returned: ${JSON.stringify(j)}`;
      res.writeHead(400).end(msg);
      console.error(msg);
      process.exit(1);
    }
    writeRefreshToken(j.refresh_token);
    res.writeHead(200, { "content-type": "text/html" }).end(
      "<h1>Done ✅</h1><p>Refresh token saved to .env. You can close this tab.</p>"
    );
    console.log("✅ YOUTUBE_REFRESH_TOKEN written to .env");
    server.close();
    process.exit(0);
  } catch (e) {
    res.writeHead(500).end(String(e));
    console.error(e);
    process.exit(1);
  }
});

server.listen(PORT);
