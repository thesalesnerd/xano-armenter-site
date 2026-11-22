#!/usr/bin/env node
// Gives every work its own HTML file with real meta tags, so a shared link or a
// QR scan previews properly (title, description, image) even for crawlers that
// don't run JavaScript (WhatsApp, iMessage, Facebook, Slack, search engines).
//
// Runs after `vite build`: copies dist/index.html to dist/archive/<slug>/index.html
// with the work's <title>, description, canonical URL, Open Graph, Twitter card
// and schema.org VisualArtwork JSON-LD, plus a <noscript> plain-HTML copy of
// the work for visitors and crawlers without JavaScript. Vercel serves these
// files before the SPA rewrite in vercel.json, so nothing else changes.
//
//   SITE_URL  default https://xanoarmenter.com
import { mkdir, readFile, writeFile } from "node:fs/promises";

const SITE = (process.env.SITE_URL || "https://xanoarmenter.com").replace(/\/+$/, "");
const ARTIST = "Xano Armenter";
const root = new URL("..", import.meta.url);
const dist = new URL("dist/", root);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const year = (w) => (w.year ? `${w.circa ? "c. " : ""}${w.year}` : "");
const money = (w) => {
  if (w.price === null || !w.currency) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: w.currency, maximumFractionDigits: 0 }).format(w.price);
  } catch {
    return `${w.price} ${w.currency}`;
  }
};
export const availability = (w) => (w.sold ? "Sold" : "Available");

export function head(w) {
  const url = `${SITE}/archive/${w.slug}`;
  const title = `${w.title}${w.year ? ` (${year(w)})` : ""} — ${ARTIST}`;
  const facts = [w.medium, w.dims, year(w)].filter(Boolean).join(", ");
  const description = `${facts ? `${facts}. ` : ""}Painting by ${ARTIST}. ${availability(w)}${w.sold ? "" : " — enquire with the studio"}.`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: w.title,
    url,
    image: w.image,
    creator: { "@type": "Person", name: ARTIST, url: SITE },
    ...(w.year ? { dateCreated: String(w.year) } : {}),
    ...(w.medium ? { artMedium: w.medium } : {}),
    ...(w.cm ? { height: { "@type": "Distance", name: `${w.cm.h} cm` }, width: { "@type": "Distance", name: `${w.cm.w} cm` } } : {}),
    ...(w.subject ? { genre: w.subject } : {}),
    offers: {
      "@type": "Offer",
      availability: w.sold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      ...(w.price !== null && w.currency ? { price: w.price, priceCurrency: w.currency } : {}),
    },
  };
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="${ARTIST}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(w.image)}" />`,
    `<meta property="og:image:width" content="${w.w}" />`,
    `<meta property="og:image:height" content="${w.h}" />`,
    `<meta property="og:image:alt" content="${esc(`${w.title} by ${ARTIST}`)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(w.image)}" />`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
  ];
  return { title, description, tags: tags.join("\n    ") };
}

/** Plain HTML for crawlers and visitors without JavaScript (React replaces #root otherwise). */
export function body(w) {
  const facts = [w.medium, year(w)].filter(Boolean).join(", ");
  const price = w.sold ? "" : money(w);
  return `<noscript><main style="max-width:60rem;margin:0 auto;padding:2rem 1rem;font-family:system-ui,sans-serif">
      <p><a href="/archive">${ARTIST} — Archive</a></p>
      <img src="${esc(w.image)}" alt="${esc(w.title)}" width="${w.w}" height="${w.h}" style="max-width:100%;height:auto" />
      <h1>${esc(w.title)}</h1>
      ${facts ? `<p>${esc(facts)}</p>` : ""}
      ${w.dims ? `<p>${esc(w.dims)}</p>` : ""}
      <p>${availability(w)}${price ? ` · ${esc(price)}` : ""}</p>
      <p><a href="/contact?work=${encodeURIComponent(w.slug)}">Enquire about this work</a></p>
    </main></noscript>`;
}

export function render(template, w) {
  const { tags } = head(w);
  let html = template
    .replace(/<title>[\s\S]*?<\/title>\s*/, "")
    .replace(/<meta name="description"[^>]*>\s*/, "")
    .replace("</head>", `  ${tags}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body(w)}</div>`);
  if (!html.includes('rel="canonical"') || !html.includes(w.slug)) throw new Error(`prerender failed for ${w.slug}`);
  return html;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const template = await readFile(new URL("index.html", dist), "utf8");
  const works = JSON.parse(await readFile(new URL("src/data/artworks.json", root), "utf8"));
  for (const w of works) {
    const dir = new URL(`archive/${w.slug}/`, dist);
    await mkdir(dir, { recursive: true });
    await writeFile(new URL("index.html", dir), render(template, w));
  }
  console.log(`prerender: ${works.length} work pages -> dist/archive/<slug>/index.html`);
}
