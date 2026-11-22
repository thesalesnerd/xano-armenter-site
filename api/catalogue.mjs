// Live catalogue for the site: GET /api/catalogue
//
// Reads Artfolio's public catalogue (catalogue_v1, anon key) and answers with the
// same JSON array the build bundles in src/data/artworks.json, built by the same
// code (scripts/snapshot-catalogue.mjs), so only the published fields leave
// Artfolio. Vercel's CDN keeps the answer for a minute and serves the previous
// one while it refreshes, so a visitor never waits on Supabase and an edit in
// Artfolio shows on the site within a minute or two, without a redeploy.
//
// The site renders the bundled copy first and swaps in this answer when it
// arrives; if this fails the site simply keeps the bundled copy.

import { buildSnapshot, fetchCatalogue, CATALOGUE_VERSION, DEFAULT_ANON_KEY, DEFAULT_SUPABASE_URL } from '../scripts/snapshot-catalogue.mjs';

const env = (name, fallback) => (process.env[name] ?? '').trim() || fallback;

export async function catalogueResponse({ artistSlug, fetchImpl = fetch } = {}) {
  const supabaseUrl = env('SUPABASE_URL', DEFAULT_SUPABASE_URL);
  const anonKey = env('SUPABASE_ANON_KEY', DEFAULT_ANON_KEY);
  const catalogue = await fetchCatalogue({ supabaseUrl, anonKey, artistSlug, fetchImpl, attempts: 2, timeoutMs: 8_000 });
  if (!catalogue) throw new Error(`No public catalogue for "${artistSlug}"`);
  if (catalogue.version !== CATALOGUE_VERSION) throw new Error(`Catalogue version ${catalogue.version}, expected ${CATALOGUE_VERSION}`);
  const { works, problems } = buildSnapshot(catalogue, { supabaseUrl, selectedCollection: env('SELECTED_COLLECTION', 'Selected') });
  for (const p of problems) console.warn(`catalogue: ${p}`);
  // An empty catalogue is far more likely an accident (profile switched off,
  // images missing) than intended: refuse, and the site keeps its bundled copy.
  if (works.length === 0) throw new Error('Catalogue has no works with images');
  return works;
}

export default async function handler(req, res) {
  // Previews may read another artist's catalogue (?artist=<slug>) for testing;
  // production always serves the configured artist.
  const override = process.env.VERCEL_ENV !== 'production' ? new URL(req.url, 'http://x').searchParams.get('artist') : null;
  const artistSlug = (override ?? '').trim() || env('ARTIST_SLUG', 'xano-armenter');
  try {
    const works = await catalogueResponse({ artistSlug });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // Browsers always revalidate; the CDN keeps it 60 s, then serves it stale
    // for up to a day while refreshing in the background (or while Supabase is down).
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control', 'max-age=60, stale-while-revalidate=86400, stale-if-error=604800');
    res.statusCode = 200;
    res.end(JSON.stringify(works));
  } catch (err) {
    console.error(`catalogue: ${err.message}`);
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Catalogue unavailable' }));
  }
}
