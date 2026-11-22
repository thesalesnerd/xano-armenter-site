#!/usr/bin/env node
// Website content snapshot: what Xano published in Artfolio → Website.
//
// Reads site_content_v1 (anon key, published copy only) and writes
// src/data/site-content.json, which the site bundles so it renders with the
// published text at once; /api/site-content then keeps it current without a
// redeploy. If Artfolio can't be reached, the committed file is kept.
//
//   node scripts/snapshot-site-content.mjs [--dry-run]

import { writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_ANON_KEY, DEFAULT_SUPABASE_URL } from './snapshot-catalogue.mjs';

export const SITE_CONTENT_VERSION = 1;

/** -> { version, artist, published_at, content } or null when the artist has no public profile. */
export async function fetchSiteContent({ supabaseUrl, anonKey, artistSlug, fetchImpl = fetch, timeoutMs = 8_000 }) {
  const res = await fetchImpl(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/site_content_v1`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ p_artist_slug: artistSlug }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`site_content_v1: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (data === null) return null;
  if (data?.version !== SITE_CONTENT_VERSION || typeof data.content !== 'object' || data.content === null) {
    throw new Error(`site_content_v1: unexpected answer (version ${data?.version})`);
  }
  return { version: data.version, artist: data.artist, published_at: data.published_at ?? null, content: data.content };
}

async function main() {
  const env = (n, f) => (process.env[n] ?? '').trim() || f;
  const out = resolve(env('SITE_CONTENT_OUT', 'src/data/site-content.json'));
  const data = await fetchSiteContent({
    supabaseUrl: env('SUPABASE_URL', DEFAULT_SUPABASE_URL),
    anonKey: env('SUPABASE_ANON_KEY', DEFAULT_ANON_KEY),
    artistSlug: env('ARTIST_SLUG', 'xano-armenter'),
  });
  if (!data) throw new Error('No public profile for this artist; keeping the committed site content');
  const text = `${JSON.stringify(data, null, 2)}\n`;
  if (process.argv.includes('--dry-run')) return console.log(text);
  await writeFile(`${out}.tmp`, text);
  await rename(`${out}.tmp`, out);
  console.log(`Site content: published ${data.published_at ?? 'never'} → ${out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`Site content snapshot skipped: ${err.message}`);
    process.exit(1);
  });
}
