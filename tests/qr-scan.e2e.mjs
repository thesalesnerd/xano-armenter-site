// End-to-end check of the permanent QR labels.
//
//   npm run build
//   npm i --no-save jsqr@1.4.0 pngjs@7.0.0
//   node tests/qr-scan.e2e.mjs [XA-0001 XA-0042 …]
//
// Serves dist/ the way vercel.json does (static files first, /qr/:id through
// api/qr.js, everything else to index.html), opens docs/qr-labels.html in
// Chromium, screenshots and decodes the QR on a few labels, then follows each
// decoded URL (xanoarmenter.com pointed at the local server) and checks the
// redirect and the rendered artwork page.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { createRequire } from "node:module";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import handler from "../api/qr.js";

// Playwright is preinstalled globally in CI images; require() finds it from any directory.
const { chromium } = createRequire(import.meta.url)("playwright");

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".jpg": "image/jpeg", ".png": "image/png", ".txt": "text/plain" };

async function file(path) {
  try {
    const s = await stat(path);
    if (s.isDirectory()) return file(join(path, "index.html"));
    return { body: await readFile(path), type: types[extname(path)] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://x");
  const qr = /^\/qr\/([^/]+)$/.exec(pathname);
  if (qr) return handler({ url: `/api/qr?id=${qr[1]}` }, res);
  const f = (await file(join(dist, decodeURIComponent(pathname)))) ?? (await file(join(dist, "index.html")));
  res.writeHead(200, { "Content-Type": f.type });
  res.end(f.body);
});
await new Promise((r) => server.listen(0, r));
const local = `http://localhost:${server.address().port}`;

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ["XA-0001", "XA-0008", "XA-0042", "XA-0092"];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
await page.goto(`file://${join(root, "docs/qr-labels.html")}`);
let failures = 0;

for (const inv of wanted) {
  const label = page.locator(`.l[data-inv="${inv}"]`);
  if (!(await label.count())) { console.log(`✗ ${inv}: no label on the sheet`); failures++; continue; }
  const png = PNG.sync.read(await label.locator("svg").screenshot({ scale: "device" }));
  // Pad with a white quiet zone: the labels print with margin 0.
  const pad = 40, w = png.width + pad * 2, h = png.height + pad * 2;
  const img = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < png.height; y++) img.set(png.data.subarray(y * png.width * 4, (y + 1) * png.width * 4), ((y + pad) * w + pad) * 4);
  const code = jsQR(img, w, h);
  if (!code) { console.log(`✗ ${inv}: QR did not decode`); failures++; continue; }

  const scanned = code.data;
  const expected = `https://xanoarmenter.com/qr/${inv}`;
  const res = await fetch(scanned.replace("https://xanoarmenter.com", local), { redirect: "manual" });
  const location = res.headers.get("location");
  const tab = await browser.newPage();
  await tab.goto(scanned.replace("https://xanoarmenter.com", local));
  const title = await tab.locator(".lightbox h2").textContent({ timeout: 10_000 }).catch(() => null);
  const enquire = await tab.locator(".lightbox a[href*='/contact?work=']").count();
  const ogTitle = await tab.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
  await tab.screenshot({ path: join(root, `tests/out-${inv}.png`) }).catch(() => {});
  await tab.close();

  const ok = scanned === expected && res.status === 302 && location?.startsWith("/archive/") && title && enquire === 1 && ogTitle?.startsWith(title.trim());
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${inv}: scanned ${scanned} → ${res.status} ${location} → "${title}" (og:title "${ogTitle}", enquire ${enquire})`);
}

await browser.close();
server.close();
if (failures) { console.error(`${failures} label(s) failed`); process.exit(1); }
console.log(`All ${wanted.length} labels scan, redirect and render.`);
