// Published website content for the site: GET /api/site-content
//
// What Xano published in Artfolio → Website (site_content_v1, anon key: the
// published copy only, never the draft). Cached by Vercel's CDN like
// /api/catalogue: a minute fresh, then served stale while it refreshes or
// while Supabase is down. If this fails the site keeps the bundled copy, and
// anything not set falls back to the site's own text.

import { DEFAULT_ANON_KEY, DEFAULT_SUPABASE_URL } from '../scripts/snapshot-catalogue.mjs';
import { fetchSiteContent } from '../scripts/snapshot-site-content.mjs';

const env = (name, fallback) => (process.env[name] ?? '').trim() || fallback;

export default async function handler(req, res) {
  // Previews may read another artist (?artist=<slug>) for testing; production never.
  const override = process.env.VERCEL_ENV !== 'production' ? new URL(req.url, 'http://x').searchParams.get('artist') : null;
  const artistSlug = (override ?? '').trim() || env('ARTIST_SLUG', 'xano-armenter');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const data = await fetchSiteContent({
      supabaseUrl: env('SUPABASE_URL', DEFAULT_SUPABASE_URL),
      anonKey: env('SUPABASE_ANON_KEY', DEFAULT_ANON_KEY),
      artistSlug,
    });
    if (!data) throw new Error(`No public profile for "${artistSlug}"`);
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control', 'max-age=60, stale-while-revalidate=86400, stale-if-error=604800');
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (err) {
    console.error(`site-content: ${err.message}`);
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'Site content unavailable' }));
  }
}
