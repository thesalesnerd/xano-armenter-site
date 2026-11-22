// GET /sitemap.xml (rewritten here by vercel.json): every page in English and
// Spanish plus one URL per public work, from the live catalogue, so a work
// added in Artfolio is listed for search engines without a redeploy.

import { catalogueResponse } from './catalogue.mjs';
import { createRequire } from 'node:module';

const bundled = createRequire(import.meta.url)('../src/data/artworks.json');

const PAGES = ['/', '/work', '/archive', '/about', '/contact'];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function sitemap(site, works) {
  const url = (path) => {
    const en = `${site}${path === '/' ? '/' : path}`;
    const es = `${site}/es${path === '/' ? '' : path}`;
    const alt = `<xhtml:link rel="alternate" hreflang="en" href="${esc(en)}"/><xhtml:link rel="alternate" hreflang="es" href="${esc(es)}"/>`;
    return `<url><loc>${esc(en)}</loc>${alt}</url><url><loc>${esc(es)}</loc>${alt}</url>`;
  };
  const paths = [...PAGES, ...works.map((w) => `/archive/${encodeURIComponent(w.slug)}`)];
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    paths.map(url).join('\n') +
    '\n</urlset>\n'
  );
}

export default async function handler(req, res) {
  const site = ((process.env.SITE_URL ?? '').trim() || 'https://xanoarmenter.com').replace(/\/+$/, '');
  let works;
  try {
    works = await catalogueResponse({ artistSlug: (process.env.ARTIST_SLUG ?? '').trim() || 'xano-armenter' });
  } catch (err) {
    console.error(`sitemap: live catalogue unavailable (${err.message}), using the bundled copy`);
    works = bundled;
  }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=3600, stale-while-revalidate=86400, stale-if-error=604800');
  res.statusCode = 200;
  res.end(sitemap(site, works));
}
