import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { mapFromCatalogue, normalize, resolve } from "../api/qr.js";
import fallback from "../api/_qr-map.js";
import { render } from "./prerender-works.mjs";

test("normalize accepts the forms people type", () => {
  assert.equal(normalize("XA-0001"), "XA-0001");
  assert.equal(normalize(" xa-0001 "), "XA-0001");
  assert.equal(normalize("xa-12"), "XA-0012");
  assert.equal(normalize("XA12"), "XA-0012");
});

test("mapFromCatalogue skips works without an image or inventory number", () => {
  const map = mapFromCatalogue({
    artist: { slug: "xano-armenter" },
    pieces: [
      { inventory_number: "XA-0001", slug: "about-the-future", images: [{ path: "a.jpg" }] },
      { inventory_number: "XA-0002", slug: null, title: "Café Nit", images: [{ path: "b.jpg" }] },
      { inventory_number: "XA-0003", slug: "no-image", images: [] },
      { inventory_number: null, slug: "no-number", images: [{ path: "c.jpg" }] },
    ],
  });
  assert.deepEqual(map, { "XA-0001": "about-the-future", "XA-0002": "cafe-nit-xano-armenter" });
});

test("resolve falls back to the committed map when Artfolio is down", async () => {
  const r = await resolve("xa-1", async () => { throw new Error("down"); });
  assert.equal(r.source, "fallback");
  assert.equal(r.slug, fallback.works["XA-0001"]);
});

test("fallback map covers every public work", () => {
  assert.ok(Object.keys(fallback.works).length >= 94);
});

function call(url) {
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end() { this.ended = true; } };
  return handler({ url }, res).then(() => res);
}

test("handler redirects a known number to its archive page", async () => {
  const res = await call("/api/qr?id=XA-0001");
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, `/archive/${fallback.works["XA-0001"]}`);
});

test("handler sends unknown numbers to the archive, uncached", async () => {
  const res = await call("/api/qr?id=XA-9999");
  assert.equal(res.headers.location, "/archive");
  assert.equal(res.headers["cache-control"], "no-store");
});

test("prerender puts the work's meta tags into the page", () => {
  const tpl = '<html><head><title>X</title><meta name="description" content="d" /></head><body><div id="root"></div></body></html>';
  const html = render(tpl, {
    slug: "wave", title: "Wave & Sea", year: 2018, circa: false, medium: "Acrylic on canvas", subject: null,
    cm: { h: 162, w: 180 }, dims: "162 × 180 cm", image: "https://img/w.jpg", thumb: "", w: 1600, h: 1422,
    selected: 0, price: 5000, currency: "USD", sold: false, series: [],
  });
  assert.match(html, /<title>Wave &amp; Sea \(2018\) — Xano Armenter<\/title>/);
  assert.match(html, /property="og:image" content="https:\/\/img\/w.jpg"/);
  assert.match(html, /rel="canonical" href="https:\/\/xanoarmenter.com\/archive\/wave"/);
  assert.match(html, /Ask about availability · \$5,000/);
  assert.doesNotMatch(html, /InStock/);
  assert.equal((html.match(/<title>/g) || []).length, 1);
});
