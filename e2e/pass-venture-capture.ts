// Focused real-browser/real-store proof of the Studio → Venture capture handoff.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { appendCanonEvent } from "../src/venture/canon.js";
import { bootServer, openSession, openRoom, record, results, ROOT } from "./harness.js";

const PORT = 4801;
const A = "capture-pricing";
const B = "capture-newsletter";
async function main() {
  if (!process.env.E2E_REPO_ROOT) throw new Error("Run through the disposable E2E runner");
  for (const slug of [A, B]) {
    mkdirSync(join(ROOT, "venture", slug), { recursive: true });
    appendCanonEvent(slug, "venture-kicked-off", slug+"/kickoff", {}, "2026-09-13T00:00:00Z");
  }
  const canonBefore = [A, B].map(slug => readFileSync(join(ROOT,"venture",slug,"canon.md"),"utf8"));
  const server = await bootServer({}, PORT);
  let session: Awaited<ReturnType<typeof openSession>> | undefined;
  try {
    session = await openSession(PORT);
    const { page } = session;
    const start = async (text: string) => {
      await openRoom(page,"studio");
      await page.fill("#src",text);
      await page.click("#routeBtn"); // classifier blocked; deterministic Venture fallback
      await page.locator("#captureVerdict").getByRole("button",{name:"Start on it",exact:true}).click();
    };
    const queue = async () => (await (await page.request.get(`http://127.0.0.1:${PORT}/api/room-queue?room=Venture`)).json()).items;
    const named = "A venture idea for capture-pricing.\nKeep this exact second line.";
    await start(named);
    await page.waitForFunction(() => document.querySelector("#flash")?.textContent?.includes("saved in its venture queue"));
    assert.equal(await page.locator("#ventureSelect").inputValue(),A);
    const card = page.locator("#ventureCaptureHandoff .capture-handoff",{hasText:named});
    assert.equal(await card.count(),1);
    assert.ok(await card.isVisible());
    const first = (await queue()).find((it: any) => it.payload.slug === A);
    assert.ok(first);
    await page.reload();
    await openRoom(page,"venture");
    await page.locator("#ventureCaptureHandoff .capture-handoff",{hasText:named}).getByRole("button",{name:"Open in Venture"}).click();
    await page.waitForFunction(() => document.querySelector("#flash")?.textContent?.includes("saved in its venture queue"));
    assert.equal((await queue()).filter((it: any) => it.captureId === first.captureId).length,1);
    record({feature:"Named Venture capture opens the correct venture; exact thought survives reload and retry without duplication",status:"pass",detail:first.captureId});

    const ambiguous = "A venture idea about improving the offer, with no venture name.";
    await start(ambiguous);
    await page.locator("#ventureQueueAsk").waitFor({state:"visible"});
    assert.ok((await page.locator("#ventureQueueAsk").innerText()).includes(ambiguous));
    await page.reload();
    await openRoom(page,"venture");
    await page.locator("#ventureCaptureHandoff .capture-handoff",{hasText:ambiguous}).getByRole("button",{name:"Open in Venture"}).click();
    await page.locator(`#ventureQueueAsk [data-venture-answer="${B}"]`).click();
    await page.waitForFunction(slug => document.querySelector<HTMLSelectElement>("#ventureSelect")?.value===slug && document.querySelector("#flash")?.textContent?.includes("Thought saved under"),B);
    await page.reload();
    await openRoom(page,"venture");
    await page.locator("#ventureCaptureHandoff .capture-handoff",{hasText:ambiguous}).getByRole("button",{name:"Open in Venture"}).click();
    await page.waitForFunction(slug => document.querySelector<HTMLSelectElement>("#ventureSelect")?.value===slug,B);
    assert.equal(await page.locator("#ventureQueueAsk").count(),0);
    assert.equal((await queue()).filter((it: any) => it.payload.slug === B).length,1);
    record({feature:"Ambiguous capture survives reload, accepts an explicit venture choice and resumes that choice",status:"pass",detail:B});

    const failed = "Another venture idea for capture-pricing that must survive a failed handoff.";
    await page.route("**/api/captures/start",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({ok:false,error:"Injected handoff failure"})}),{times:1});
    await start(failed);
    await page.waitForFunction(() => document.querySelector("#flash")?.textContent?.includes("Injected handoff failure"));
    assert.equal(await page.locator("#src").inputValue(),failed);
    await page.reload();
    await openRoom(page,"venture");
    await page.locator("#ventureCaptureHandoff .capture-handoff",{hasText:failed}).getByRole("button",{name:"Open in Venture"}).click();
    await page.waitForFunction(() => document.querySelector("#flash")?.textContent?.includes("saved in its venture queue"));
    assert.deepEqual([A,B].map(slug=>readFileSync(join(ROOT,"venture",slug,"canon.md"),"utf8")),canonBefore);
    assert.equal(session.errors.filter(e=>e.startsWith("uncaught:")).length,0);
    assert.ok(session.blockedCalls.every(call=>call==="POST /api/captures/classify"));
    await page.screenshot({path:join(ROOT,"e2e","venture-capture.png"),fullPage:true});
    record({feature:"Failed handoff retains the thought and retries after reload; no model, draft or approval action",status:"pass",detail:"Real save/start/answer routes and disk stores; classifier fallback only"});
  } finally { await session?.close(); await server.stop(); }
}
main().catch(error=>{record({feature:"Venture capture journey",status:"fail",detail:String(error)}); console.error(error);}).finally(()=>process.exit(results.some(r=>r.status==="fail")?1:0));
