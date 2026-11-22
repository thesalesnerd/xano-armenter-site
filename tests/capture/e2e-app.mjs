// Logged-in end-to-end run of /a/<artist>/capture against a throwaway test artist.
// TEST_EMAIL / TEST_PASSWORD / TEST_ARTIST env; node tests/capture/e2e-app.mjs <fake.y4m> <hi-res.jpg> <framed.jpg> <outDir>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const [y4m, hires, framed, out] = process.argv.slice(2);
const base = process.env.BASE_URL ?? 'http://localhost:5199';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`] });
const ctx = await browser.newContext({ ...devices['Pixel 7'], permissions: ['camera'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const waitResult = async () => {
  await page.waitForSelector('img[alt="Corrected painting"]', { timeout: 90000 });
  await page.waitForFunction(() => !/Correcting…|Finding|Loading/.test(document.body.innerText), null, { timeout: 90000 });
};

await page.goto(`${base}/login`);
await page.fill('input[type=email]', process.env.TEST_EMAIL);
await page.fill('input[type=password]', process.env.TEST_PASSWORD);
await page.click('button:has-text("Sign in")');
await page.waitForURL((u) => !u.pathname.startsWith('/login'));
await page.goto(`${base}/a/${process.env.TEST_ARTIST}/capture`);
await page.waitForSelector('text=Scan the label');
await shot('a1-picker');

// 1) QR label typed in (same path as a scan): the QR session's URL format
await page.click('text=Scan the label');
await page.fill('input[placeholder^="or type"]', 'https://xanoarmenter.com/qr/zz-2');
await page.click('text=Go');
await page.waitForSelector('text=ZZ-0002 · Test no photo', { timeout: 15000 });
console.log('QR label -> ZZ-0002 OK');
await page.click('text=✕ Close');

// 2) existing work with an old photo: guided shutter, make main
await page.click('text=Test truck (old wall photo)');
await page.waitForSelector('svg polygon', { timeout: 30000 });
await page.waitForSelector('text=Looks good', { timeout: 20000 });
await shot('a2-camera');
await page.click('[aria-label="Take photo"]');
await waitResult();
await shot('a3-result');
await page.click('text=Next →');
await page.waitForSelector('text=Make this the main image');
await shot('a4-save');
await page.click('button:has-text("Save")');
await page.waitForSelector('text=Saved ✓', { timeout: 60000 });
await shot('a5-saved');
console.log('saved existing:', await page.locator('p.text-sm.text-stone-600').innerText());

// 3) new work from a full-resolution photo (library)
await page.click('text=Photograph the next work');
await page.click('text=New work from a photo');
await page.waitForSelector('[aria-label="Take photo"]');
await page.setInputFiles('input[type=file]:not([capture])', framed);
await waitResult();
await page.click('text=1 · Corners');
await page.click('text=Trim frame edge');
await page.waitForTimeout(300);
await page.click('text=Trim frame edge');
await shot('b1-corners-trimmed');
await page.click('text=2 · Result');
await waitResult();
await shot('b2-result');
await page.click('text=Next →');
await page.fill('label:has-text("Title") input', 'Test new work (delete me)');
await page.fill('label:has-text("Width") input', '120');
await shot('b3-new-form');
await page.click('button:has-text("Save")');
await page.waitForSelector('text=Saved ✓', { timeout: 90000 });
console.log('saved new work');

// 4) hi-res guided-equivalent via "Phone camera" input for ZZ-0002
await page.click('text=Photograph the next work');
await page.click('text=Test no photo');
await page.waitForSelector('[aria-label="Take photo"]');
await page.setInputFiles('input[capture]', hires);
await waitResult();
console.log('checks:', (await page.locator('ul.space-y-1').innerText()).replace(/\n/g, ' | '));
await page.click('text=Next →');
await page.click('button:has-text("Save")');
await page.waitForSelector('text=Saved ✓', { timeout: 90000 });
console.log('saved ZZ-0002 from phone camera file');
await browser.close();
