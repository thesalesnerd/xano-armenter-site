// End-to-end check of /capture/try with a fake camera that shows a photo of a painting.
// node tests/capture/e2e-try.mjs <fake.y4m> <outDir>   (vite on :5199)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const [y4m, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`],
});
const ctx = await browser.newContext({ ...devices['Pixel 7'], permissions: ['camera'] });
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto('http://localhost:5199/capture/try');
await page.fill('input >> nth=0', '38');
await page.fill('input >> nth=1', '46');
await page.screenshot({ path: `${out}/1-intro.png` });
await page.click('text=Open the camera');
await page.waitForSelector('svg polygon', { timeout: 30000 });
await page.waitForTimeout(1500);
console.log('hint:', await page.locator('.absolute.inset-x-4.bottom-4').innerText());
await page.screenshot({ path: `${out}/2-camera.png` });
await page.click('[aria-label="Take photo"]');
await page.waitForSelector('img[alt="Corrected painting"]', { timeout: 60000 });
await page.waitForFunction(() => !document.body.innerText.includes('Correcting…'));
await page.screenshot({ path: `${out}/3-result.png` });
console.log((await page.locator('ul.space-y-1').innerText()).replace(/\n/g, ' | '));
await page.click('text=1 · Corners');
await page.waitForTimeout(500);
// drag the top-left corner a little to show the magnifier
const h = page.locator('svg g').first();
const b = await h.boundingBox();
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
await page.mouse.down();
await page.mouse.move(b.x + b.width / 2 + 6, b.y + b.height / 2 + 4, { steps: 4 });
await page.screenshot({ path: `${out}/4-corners.png` });
await page.mouse.up();
const dl = page.waitForEvent('download');
await page.click('text=Download');
const d = await dl;
await d.saveAs(`${out}/5-download.jpg`);
console.log('downloaded', d.suggestedFilename());
await browser.close();
