import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bootServer, openSession, openRoom, record, results, ROOT } from './harness.js';
const PORT = 4802;
async function main() {
  if (!process.env.E2E_REPO_ROOT) throw new Error('Use disposable runner');
  mkdirSync(join(ROOT, 'stories', 'judgment-example'), { recursive: true });
  writeFileSync(join(ROOT, 'stories', 'judgment-example', 'bible.md'), '# Judgment Example');
  const server = await bootServer({}, PORT);
  let session: Awaited<ReturnType<typeof openSession>> | undefined;
  try {
    session = await openSession(PORT);
    const { page } = session;
    // Controlled home response checks navigation, including stale prior room/brand selection.
    await page.route('**/api/studio', route => route.fulfill({ json: { team: [], needsYou: [
      { room: 'fiction', label: 'Fiction', text: 'Example idea waiting', detail: '', action: 'Review ideas', series: 'judgment-example', page: 'inbox' },
      { room: 'fiction', label: 'Fiction', text: 'Example scene waiting', detail: '', action: 'Review scene', series: 'judgment-example', page: 'review' },
      { room: 'signals', label: 'Signals', text: 'Charles decisions waiting', detail: '', action: 'Review', brand: 'charles' },
    ] } }));
    await page.route('**/api/signals?brand=charles', route => route.fulfill({ json: { briefPath: null, changeProposals: [{ id: 'orphan', status: 'pending', recommendation: { title: 'Older pending change' }, delta: { kind: 'cadence', file: 'config/platforms.yaml', platform: 'x', field: 'posts_per_week', before: 2, after: 3 } }] } }));
    await page.reload();
    await openRoom(page, 'studio');
    const inboxResponse = page.waitForResponse(r => r.url().includes('/api/fiction/inbox?series=judgment-example'));
    await page.getByRole('button', { name: 'Review ideas', exact: true }).click();
    await page.locator('#ficIdea').waitFor({ state: 'visible' });
    assert.equal((await inboxResponse).status(), 200);
    await openRoom(page, 'studio');
    await page.getByRole('button', { name: 'Review scene', exact: true }).click();
    await page.locator('[data-fiction-page="review"].on').waitFor({ state: 'visible' });
    await openRoom(page, 'studio');
    const response = page.waitForResponse(r => r.url().includes('/api/signals?brand=charles'));
    await page.locator('#studioMain .ny-row', { hasText: 'Charles decisions waiting' }).getByRole('button').click();
    await response;
    assert.equal(await page.locator('#signalsBrand').inputValue(), 'charles');
    assert.ok(await page.locator('#signalsReads').isVisible());
    await page.getByRole('button', { name: 'Approve exact change', exact: true }).waitFor({ state: 'visible' });
    assert.equal(session.errors.filter(e => e.startsWith('uncaught:')).length, 0);
    record({ feature: 'Needs you opens Fiction inbox/review and the selected Signals brand', status: 'pass', detail: 'Controlled home response; actual room routes and rendering, no providers' });
  } finally { await session?.close(); await server.stop(); }
}
main().catch(error => { record({ feature: 'Studio judgment navigation', status: 'fail', detail: String(error) }); console.error(error); }).finally(() => process.exit(results.some(r => r.status === 'fail') ? 1 : 0));
