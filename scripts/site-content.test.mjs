import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSiteContent } from './snapshot-site-content.mjs';

const fake = (status, body) => async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
const opts = { supabaseUrl: 'https://x.supabase.co/', anonKey: 'k', artistSlug: 'xano-armenter' };

test('returns the published copy', async () => {
  const body = { version: 1, artist: 'xano-armenter', published_at: '2026-11-22T10:00:00.000Z', content: { about: { statement: { en: 'Hi' } } } };
  assert.deepEqual(await fetchSiteContent({ ...opts, fetchImpl: fake(200, body) }), body);
});

test('null when the artist has no public profile', async () => {
  assert.equal(await fetchSiteContent({ ...opts, fetchImpl: fake(200, 'null') }), null);
});

test('refuses an unknown version or shape, and HTTP errors', async () => {
  await assert.rejects(fetchSiteContent({ ...opts, fetchImpl: fake(200, { version: 2, content: {} }) }));
  await assert.rejects(fetchSiteContent({ ...opts, fetchImpl: fake(200, { version: 1, content: null }) }));
  await assert.rejects(fetchSiteContent({ ...opts, fetchImpl: fake(500, 'boom') }));
});

test('calls the RPC with the anon key and the artist slug', async () => {
  let seen;
  await fetchSiteContent({ ...opts, fetchImpl: async (url, init) => { seen = { url, init }; return new Response('null'); } });
  assert.equal(seen.url, 'https://x.supabase.co/rest/v1/rpc/site_content_v1');
  assert.equal(seen.init.headers.apikey, 'k');
  assert.deepEqual(JSON.parse(seen.init.body), { p_artist_slug: 'xano-armenter' });
});
