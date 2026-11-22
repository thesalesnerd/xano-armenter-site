// node tests/capture/bench.mjs <outDir> <img> [img…]   (needs `npx vite` on :5199)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
const [outDir, ...imgs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
await page.route('**/__img/**', (r) => r.fulfill({ body: readFileSync(decodeURIComponent(new URL(r.request().url()).pathname.slice(6))), contentType: 'image/jpeg' }));
await page.goto('http://localhost:5199/tests/capture/bench.html');
await page.waitForFunction(() => window.ready);
const summary = [];
for (const img of imgs) {
  const [file, json] = img.split('::');
  const opts = json ? JSON.parse(json) : {};
  const r = await page.evaluate(([u, o]) => window.run(u, o), ['/__img' + file, opts]);
  const name = basename(file, '.jpg');
  writeFileSync(`${outDir}/${name}-after.jpg`, Buffer.from(r.jpg.split(',')[1], 'base64'));
  delete r.jpg;
  summary.push({ name, ...r });
  console.log(name, JSON.stringify({ ...r, quad: r.quad.map((p) => [Math.round(p.x), Math.round(p.y)]) }));
}
writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 1));
await browser.close();
