// End-to-end test of Artfolio → Website against a deploy of the website.
//
// Logs in to Artfolio as a test editor, changes the artist statement, the
// three featured works and the big picture, checks the live preview, publishes,
// checks the deployed website shows it, then restores the earlier state from
// "Earlier versions" (or, when nothing was published before, the caller cleans
// up the test rows; see docs/xano-website-stories-merge.md).
//
//   ADMIN_URL=http://localhost:5173  SITE_URL=https://<site deploy>
//   SITE_SHARE_URL=<deploy URL with ?_vercel_share=…>   (protected previews)
//   TEST_EMAIL=…  TEST_PASSWORD=…  ARTIST=xano-armenter  SHOTS=<dir>
//   node artfolio/e2e/website.e2e.mjs
import { createRequire } from 'node:module';
// The pre-installed Playwright (require() finds it globally; ESM import does not).
const { chromium } = createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';

const env = (k, d) => process.env[k] ?? d ?? (() => { throw new Error(`${k} is required`); })();
const ADMIN = env('ADMIN_URL', 'http://localhost:5173');
const SITE = env('SITE_URL').replace(/\/+$/, '');
const SHARE = process.env.SITE_SHARE_URL;
const ARTIST = env('ARTIST', 'xano-armenter');
const SHOTS = process.env.SHOTS;
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const STATEMENT = `“Test statement ${stamp}: painting as a joyous chess problem.”`;
const PICKS = { hero: 'sense-parets', featured: ['public-and-private', 'about-the-future', 'en-el-aire-xano-armenter'] };

const step = (s) => console.log(`• ${s}`);
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

// Protected preview: open the share link once, then let its cookie travel
// inside the cross-site preview frame too.
// Or hand over the preview's access cookie directly (SITE_JWT, the _vercel_jwt
// value), when the share link's redirect through vercel.com can't be reached.
if (process.env.SITE_JWT) {
  await context.addCookies([{ name: '_vercel_jwt', value: process.env.SITE_JWT, domain: new URL(SITE).hostname, path: '/', sameSite: 'None', secure: true, httpOnly: true }]);
} else if (SHARE) {
  const p = await context.newPage();
  await p.goto(SHARE);
  const cookies = await context.cookies(SITE);
  await context.addCookies(cookies.map((c) => ({ ...c, sameSite: 'None', secure: true })));
  await p.close();
}

const page = await context.newPage();
page.on('pageerror', (e) => console.warn(`  admin page error: ${e.message}`));

step('log in');
await page.goto(`${ADMIN}/login`);
await page.fill('#email', env('TEST_EMAIL'));
await page.fill('#password', env('TEST_PASSWORD'));
await page.click('button.btn-primary');
await page.waitForURL((u) => !u.pathname.startsWith('/login'));

step('open Website, pointed at the deploy under test');
await page.goto(`${ADMIN}/a/${ARTIST}/website?site=${encodeURIComponent(SITE)}`);
await page.getByRole('heading', { name: 'Your website' }).waitFor();
const frame = page.frameLocator('iframe[title="Preview of your website"]');
await frame.locator('.hero img').waitFor({ timeout: 30_000 });
// The site answers with its built-in text; the fields start from it.
await page.getByLabel('Headline (English)').first().waitFor();
await assert.doesNotReject(page.waitForFunction(() => {
  const el = document.querySelector('textarea[aria-label="Headline (English)"]');
  return el && el.value.length > 10;
}, null, { timeout: 15_000 }), 'fields filled from the site');
await shot(page, '01-website-home');

const heroBefore = await frame.locator('.hero img').getAttribute('src');

step('pick the big picture');
await page.getByRole('button', { name: 'Change big picture' }).click();
await page.getByPlaceholder('Search by title or year').fill('Sense parets');
await page.getByRole('dialog').getByRole('button', { name: /Sense parets/ }).click();

step('pick the three featured works');
const titles = { 'public-and-private': 'Public and private', 'about-the-future': 'About the future', 'en-el-aire-xano-armenter': 'En el aire' };
for (const [i, slug] of PICKS.featured.entries()) {
  await page.getByRole('button', { name: `Change work ${i + 1}` }).click();
  await page.getByPlaceholder('Search by title or year').fill(titles[slug]);
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(titles[slug]) }).first().click();
}

step('preview follows at once, before publishing');
await assert.doesNotReject(frame.locator('.hero img').evaluate((img, before) =>
  new Promise((ok, no) => { const t = Date.now(); (function f() { if (img.getAttribute('src') !== before) ok(); else if (Date.now() - t > 10000) no(); else setTimeout(f, 200); })(); }), heroBefore));
for (const [i, slug] of PICKS.featured.entries()) {
  await frame.locator(`.featured-card-${i + 1}[href$="/${slug}"]`).waitFor({ timeout: 10_000 });
}
await frame.locator('.preview-ribbon').waitFor();
await shot(page, '02-preview-home');

step('change the artist statement');
await page.getByRole('tab', { name: 'About' }).click();
await page.getByLabel('Artist statement (English)').fill(STATEMENT);
await frame.locator('.about-closing', { hasText: 'Test statement' }).waitFor({ timeout: 15_000 });
await page.getByText('Spanish not updated yet').first().waitFor();
await shot(page, '03-preview-about');

step('phone view');
await page.getByRole('button', { name: 'Phone', exact: true }).click();
await shot(page, '04-phone-preview');
await page.getByRole('button', { name: 'Computer', exact: true }).click();

step('visitors do not see the draft yet');
// Through the browser context, so the share cookie and the network proxy apply.
const probe = await context.newPage();
await probe.goto(`${SITE}/robots.txt`);
const live = () => probe.evaluate(() => fetch(`/api/site-content?t=${Date.now()}`).then((r) => r.json()));
await page.getByText('Saved as a draft').waitFor({ timeout: 15_000 });
assert.notEqual((await live()).content?.about?.statement?.en, STATEMENT);

step('publish');
await page.getByRole('button', { name: 'Publish' }).click();
await page.getByText('Published. Your website shows it within a minute.').waitFor({ timeout: 20_000 });
await page.getByText('Everything is published').first().waitFor();

step('the website shows it (allowing for the one-minute cache)');
const visitor = await context.newPage();
const deadline = Date.now() + 150_000;
for (;;) {
  const loaded = await visitor.goto(`${SITE}/about`).then(() => true, (e) => (console.warn(`  retrying: ${e.message.split('\n')[0]}`), false));
  const ok = loaded && await visitor.locator('.about-closing', { hasText: 'Test statement' }).waitFor({ timeout: 8_000 }).then(() => true, () => false);
  if (ok) break;
  if (Date.now() > deadline) throw new Error('published statement never showed on the website');
  await visitor.waitForTimeout(10_000);
}
await assert.equal(await visitor.locator('.preview-ribbon').count(), 0, 'no preview ribbon for visitors');
await shot(visitor, '05-site-about-published');
await visitor.goto(`${SITE}/`).catch(() => visitor.goto(`${SITE}/`));
await visitor.locator(`.featured-card-1[href$="/${PICKS.featured[0]}"]`).waitFor({ timeout: 15_000 });
for (const [i, slug] of PICKS.featured.entries()) assert.ok(await visitor.locator(`.featured-card-${i + 1}[href$="/${slug}"]`).count(), `featured ${i + 1}`);
assert.match(await visitor.locator('.hero img').getAttribute('alt'), /Sense parets/);
await shot(visitor, '06-site-home-published');

step('Earlier versions lists the publish');
await page.getByRole('tab', { name: 'Earlier versions' }).click();
await page.getByText('on your website now').waitFor();
const restorable = await page.getByRole('button', { name: 'Look at this version' }).count();
await shot(page, '07-history');
console.log(JSON.stringify({ ok: true, restorable }));
await browser.close();
