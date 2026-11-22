// node --test integrations/xano-site/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSnapshot, serialize, run, dimensions, toCm } from './snapshot-catalogue.mjs';

const SUPABASE_URL = 'https://example.supabase.co';
const STORAGE = `${SUPABASE_URL}/storage/v1/object/public/artwork/`;

let n = 0;
function piece(over = {}) {
  n += 1;
  const id = over.id ?? `piece-${n}`;
  return {
    id,
    slug: `work-${n}-xano-armenter`,
    inventory_number: `XA-${String(n).padStart(4, '0')}`,
    title: `Work ${n}`,
    kind: 'original',
    year: 2018,
    year_circa: false,
    medium: 'Acrylic on canvas',
    subject: 'Marine',
    style: null,
    height: 162,
    width: 180,
    depth: null,
    dimension_unit: 'cm',
    framed: false,
    framed_height: null,
    framed_width: null,
    framed_depth: null,
    status: 'available',
    description: 'Public description',
    tags: ['sea'],
    edition_size: null,
    price: 4200,
    currency: 'EUR',
    images: [{ path: `artist-1/${id}/a.jpg`, thumb_path: `artist-1/${id}/a_thumb.jpg`, width: 1600, height: 1440, caption: null }],
    collections: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...over,
  };
}

// The hand-written catalogue_v1 response the tests share.
function fixture() {
  n = 0;
  const wave = piece({ id: 'p-wave', slug: 'wave-xano-armenter', title: 'Wave', year: 2018, images: [
    { path: 'artist-1/p-wave/main.jpg', thumb_path: 'artist-1/p-wave/main_thumb.jpg', width: 1600, height: 1422, caption: null },
    { path: 'artist-1/p-wave/detail.jpg', thumb_path: null, width: 800, height: 800, caption: 'Detail' },
  ] });
  const noImage = piece({ id: 'p-noimg', slug: 'sketch-xano-armenter', title: 'Sketch without photo', images: [] });
  // 20 x 30 in, portrait image.
  const inches = piece({ id: 'p-inch', slug: 'inches-xano-armenter', title: 'Inches', year: 2020, height: 30, width: 20,
    dimension_unit: 'in', images: [{ path: 'artist-1/p-inch/a.jpg', thumb_path: null, width: 1000, height: 1500, caption: null }] });
  // Catalogued as 100 high x 50 wide, but the image is landscape 2:1.
  const swapped = piece({ id: 'p-swap', slug: 'swapped-xano-armenter', title: 'Swapped', year: 2015, height: 100, width: 50,
    images: [{ path: 'artist-1/p-swap/a.jpg', thumb_path: 'artist-1/p-swap/t.jpg', width: 2000, height: 1000, caption: null }] });
  // Stated 2:1, image square: more than 15% off.
  const mismatch = piece({ id: 'p-mis', slug: 'mismatch-xano-armenter', title: 'Mismatch', year: 2015, height: 100, width: 50,
    images: [{ path: 'artist-1/p-mis/a.jpg', thumb_path: null, width: 1000, height: 1000, caption: null }] });
  const undated = piece({ id: 'p-undated', slug: 'undated-xano-armenter', title: 'Àlbum', year: null, year_circa: true,
    medium: '', subject: null, height: null, width: null });
  const noPx = piece({ id: 'p-nopx', slug: 'nopx-xano-armenter', title: 'No pixel size',
    images: [{ path: 'artist-1/p-nopx/a.jpg', thumb_path: null, width: null, height: null, caption: null }] });
  const zebra = piece({ id: 'p-zebra', slug: 'zebra-xano-armenter', title: 'Zebra', year: 2015 });
  const old = piece({ id: 'p-old', slug: 'old-xano-armenter', title: 'Old favourite', year: 1990 });
  return {
    version: 1,
    generated_at: '2026-11-15T00:00:00Z',
    artist: { slug: 'xano-armenter', name: 'Xano Armenter', bio: null, location: 'Barcelona', website: null,
      contact_email: 'private@example.com', currency: 'EUR', dimension_unit: 'cm' },
    pieces: [wave, noImage, inches, swapped, mismatch, undated, noPx, zebra, old],
    collections: [
      { id: 'c-other', name: 'Marines', description: null, piece_ids: ['p-wave', 'p-zebra'] },
      // Order here is the order of the Selected page. p-noimg has no image and must not leave a gap.
      { id: 'c-sel', name: 'Selected', description: null, piece_ids: ['p-old', 'p-noimg', 'p-wave'] },
    ],
  };
}

const build = (cat = fixture(), opts = {}) => buildSnapshot(cat, { supabaseUrl: SUPABASE_URL, ...opts });
const bySlug = (works, slug) => works.find((w) => w.slug === slug);

function jsonFetch(body, status = 200) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    });
  };
  impl.calls = calls;
  return impl;
}

function quiet() {
  const lines = [];
  return { log: (m) => lines.push(String(m)), error: (m) => lines.push(String(m)), lines, get text() { return lines.join('\n'); } };
}

async function sandbox(t) {
  const dir = await mkdtemp(join(tmpdir(), 'snapshot-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'src/data/artworks.json');
  const env = { SUPABASE_URL, SUPABASE_ANON_KEY: 'anon-key' };
  const go = (fetchImpl, argv = [], extraEnv = {}) => {
    const out = quiet();
    return run({ argv, env: { ...env, ...extraEnv }, cwd: dir, fetchImpl, out }).then((code) => ({ code, out }));
  };
  return { dir, file, go };
}

const exists = (p) => stat(p).then(() => true, () => false);

test('a work has exactly the shape the website expects', () => {
  const { works } = build();
  assert.deepEqual(bySlug(works, 'wave-xano-armenter'), {
    slug: 'wave-xano-armenter',
    title: 'Wave',
    year: 2018,
    circa: false,
    medium: 'Acrylic on canvas',
    subject: 'Marine',
    cm: { h: 162, w: 180 },
    dims: '162 × 180 cm',
    image: `${STORAGE}artist-1/p-wave/main.jpg`,
    thumb: `${STORAGE}artist-1/p-wave/main_thumb.jpg`,
    w: 1600,
    h: 1422,
    selected: 1,
    price: 4200,
    currency: 'EUR',
    sold: false,
    series: ['Marines'],
  });
  assert.deepEqual(Object.keys(works[0]),
    ['slug', 'title', 'year', 'circa', 'medium', 'subject', 'cm', 'dims', 'image', 'thumb', 'w', 'h', 'selected',
      'price', 'currency', 'sold', 'series']);
});

test('works without an image are left out', () => {
  const { works, skipped } = build();
  assert.equal(bySlug(works, 'sketch-xano-armenter'), undefined);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0], /Sketch without photo/);
});

test('a work whose image has no pixel size is left out and reported', () => {
  const { works, problems } = build();
  assert.equal(bySlug(works, 'nopx-xano-armenter'), undefined);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /No pixel size.*no pixel size/);
});

test('price only when the catalogue publishes it; sold from status', () => {
  const cat = fixture();
  cat.pieces = cat.pieces.map((p) => p.id === 'p-zebra' ? { ...p, price: null, status: 'sold' } : p);
  const zebra = bySlug(build(cat).works, 'zebra-xano-armenter');
  assert.equal(zebra.price, null);
  assert.equal(zebra.currency, null);
  assert.equal(zebra.sold, true);
  assert.equal(bySlug(build(cat).works, 'wave-xano-armenter').sold, false);
});

test('no private data in the output', () => {
  const text = serialize(build().works);
  for (const banned of ['private@example.com', 'status', 'available', 'inventory', 'XA-00', 'Public description', 'tags']) {
    assert.ok(!text.includes(banned), `output contains "${banned}"`);
  }
});

test('inches become centimetres, one decimal at most, no trailing .0', () => {
  const w = bySlug(build().works, 'inches-xano-armenter');
  assert.deepEqual(w.cm, { h: 76.2, w: 50.8 });
  assert.equal(w.dims, '76.2 × 50.8 cm');
  assert.equal(toCm(10, 'in'), 25.4);
  assert.equal(toCm(50, 'in'), 127);
  assert.equal(toCm(11.5, 'in'), 29.2); // 29.21
  assert.equal(dimensions(toCm(50, 'in'), toCm(25, 'in'), 500, 1000).dims, '127 × 63.5 cm');
});

test('the artist unit is used when a piece has none', () => {
  const cat = fixture();
  cat.artist.dimension_unit = 'in';
  cat.pieces = [piece({ slug: 'a', height: 10, width: 20, dimension_unit: null,
    images: [{ path: 'x/a.jpg', thumb_path: null, width: 2000, height: 1000, caption: null }] })];
  assert.deepEqual(build(cat).works[0].cm, { h: 25.4, w: 50.8 });
});

test('swapped height and width are put right from the image', () => {
  const w = bySlug(build().works, 'swapped-xano-armenter');
  assert.deepEqual(w.cm, { h: 50, w: 100 });
  assert.equal(w.dims, '50 × 100 cm');
});

test('more than 15% off the image ratio: cm is null', () => {
  const w = bySlug(build().works, 'mismatch-xano-armenter');
  assert.equal(w.cm, null);
  assert.equal(w.dims, '100 × 50 cm'); // still shown, as catalogued
  // Either side of the threshold.
  assert.notEqual(dimensions(114, 100, 1000, 1000).cm, null);
  assert.equal(dimensions(116, 100, 1000, 1000).cm, null);
  assert.deepEqual(dimensions(100, 100, 1100, 1000).cm, { h: 100, w: 100 });
});

test('missing dimensions, year, medium, thumb', () => {
  const w = bySlug(build().works, 'undated-xano-armenter');
  assert.equal(w.cm, null);
  assert.equal(w.dims, null);
  assert.equal(w.year, null);
  assert.equal(w.circa, true);
  assert.equal(w.medium, null);
  assert.equal(w.subject, null);
  const inch = bySlug(build().works, 'inches-xano-armenter');
  assert.equal(inch.thumb, inch.image); // no thumb_path: fall back to the image
});

test('selected works first by position, then year descending (none last), then title', () => {
  const { works } = build();
  assert.deepEqual(works.map((w) => [w.slug, w.selected]), [
    ['old-xano-armenter', 0],      // first in "Selected"
    ['wave-xano-armenter', 1],     // p-noimg sat between them: no gap
    ['inches-xano-armenter', null],   // 2020
    ['mismatch-xano-armenter', null], // 2015, M
    ['swapped-xano-armenter', null],  // 2015, S
    ['zebra-xano-armenter', null],    // 2015, Z
    ['undated-xano-armenter', null],  // no year
  ]);
});

test('SELECTED_COLLECTION chooses the collection; an unknown one selects nothing', () => {
  const other = build(fixture(), { selectedCollection: 'marines' });
  assert.deepEqual(other.works.filter((w) => w.selected !== null).map((w) => w.slug),
    ['wave-xano-armenter', 'zebra-xano-armenter']);
  const none = build(fixture(), { selectedCollection: 'Nope' });
  assert.equal(none.selectedFound, false);
  assert.ok(none.works.every((w) => w.selected === null));
});

test('output is deterministic', async (t) => {
  const a = fixture();
  const b = fixture();
  b.pieces.reverse();
  b.pieces = b.pieces.map((p) => Object.fromEntries(Object.entries(p).reverse()));
  b.generated_at = '2030-01-01T00:00:00Z';
  const text = serialize(build(a).works);
  assert.equal(serialize(build(b).works), text);
  assert.ok(text.startsWith('[\n  {\n    "slug": '));
  assert.ok(text.endsWith('}\n]\n'));

  // Through the CLI: a second run with the same catalogue does not rewrite the file.
  const { file, go } = await sandbox(t);
  assert.equal((await go(jsonFetch(a))).code, 0);
  assert.equal(await readFile(file, 'utf8'), text);
  const first = await stat(file, { bigint: true });
  const second = await go(jsonFetch(b));
  assert.equal(second.code, 0);
  assert.match(second.out.text, /No change/);
  assert.equal((await stat(file, { bigint: true })).mtimeNs, first.mtimeNs);
  assert.equal(await readFile(file, 'utf8'), text);
});

test('the request follows the API contract', async (t) => {
  const { go } = await sandbox(t);
  const f = jsonFetch(fixture());
  await go(f, [], { SUPABASE_URL: `${SUPABASE_URL}/`, ARTIST_SLUG: 'someone-else' });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, `${SUPABASE_URL}/rest/v1/rpc/catalogue_v1`);
  assert.equal(f.calls[0].init.method, 'POST');
  assert.equal(f.calls[0].init.headers.apikey, 'anon-key');
  assert.equal(f.calls[0].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { p_artist_slug: 'someone-else' });
});

test('a null API response fails and leaves the file untouched', async (t) => {
  const { file, go } = await sandbox(t);
  await go(jsonFetch(fixture()));
  const before = await readFile(file, 'utf8');
  const { code, out } = await go(jsonFetch('null'));
  assert.equal(code, 1);
  assert.match(out.text, /returned null/);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('non-200, wrong version and zero works with images all fail without writing', async (t) => {
  const { file, go } = await sandbox(t);
  await go(jsonFetch(fixture()));
  const before = await readFile(file, 'utf8');

  assert.equal((await go(jsonFetch({ message: 'nope' }, 404))).code, 1);
  assert.equal((await go(jsonFetch({ message: 'boom' }, 500))).code, 1);
  assert.equal((await go(jsonFetch({ ...fixture(), version: 2 }))).code, 1);
  const empty = fixture();
  empty.pieces = empty.pieces.map((p) => ({ ...p, images: [] }));
  assert.equal((await go(jsonFetch(empty))).code, 1);
  assert.equal((await go(async () => { throw new Error('offline'); })).code, 1);

  assert.equal(await readFile(file, 'utf8'), before);
});

test('failures never create the file when there was none', async (t) => {
  const { file, go } = await sandbox(t);
  assert.equal((await go(jsonFetch('null'))).code, 1);
  assert.equal(await exists(file), false);
});

test('50% guard: a snapshot under half the current size needs --force', async (t) => {
  const { file, go } = await sandbox(t);
  await go(jsonFetch(fixture())); // 7 works
  const before = await readFile(file, 'utf8');

  const small = fixture();
  small.pieces = small.pieces.filter((p) => ['p-old', 'p-wave', 'p-zebra'].includes(p.id)); // 3 of 7
  const refused = await go(jsonFetch(small));
  assert.equal(refused.code, 1);
  assert.match(refused.out.text, /fewer than half/);
  assert.equal(await readFile(file, 'utf8'), before);

  const half = fixture();
  half.pieces = half.pieces.filter((p) => ['p-old', 'p-wave', 'p-zebra', 'p-inch'].includes(p.id)); // 4 of 7
  assert.equal((await go(jsonFetch(half), ['--dry-run'])).code, 0);

  const forced = await go(jsonFetch(small), ['--force']);
  assert.equal(forced.code, 0);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).length, 3);
});

test('losing every selected work needs --force', async (t) => {
  const { file, go } = await sandbox(t);
  await go(jsonFetch(fixture()));
  const before = await readFile(file, 'utf8');
  const renamed = fixture();
  renamed.collections[1].name = 'Highlights';
  const refused = await go(jsonFetch(renamed));
  assert.equal(refused.code, 1);
  assert.match(refused.out.text, /Selected page/);
  assert.equal(await readFile(file, 'utf8'), before);
  assert.equal((await go(jsonFetch(renamed), [], { SELECTED_COLLECTION: 'Highlights' })).code, 0);
});

test('--dry-run prints a summary and writes nothing', async (t) => {
  const { file, go } = await sandbox(t);
  const fresh = await go(jsonFetch(fixture()), ['--dry-run']);
  assert.equal(fresh.code, 0);
  assert.equal(await exists(file), false);
  assert.match(fresh.out.text, /Works in snapshot: 7/);
  assert.match(fresh.out.text, /Left out, no image: 1/);
  assert.match(fresh.out.text, /Left out, problems: 1/);

  await go(jsonFetch(fixture()));
  const before = await readFile(file, 'utf8');
  const next = fixture();
  next.pieces = next.pieces.filter((p) => p.id !== 'p-zebra');
  next.pieces.find((p) => p.id === 'p-inch').title = 'Inches, retitled';
  next.pieces.push(piece({ id: 'p-new', slug: 'brand-new-xano-armenter', title: 'Brand new', year: 2026 }));
  const { code, out } = await go(jsonFetch(next), ['--dry-run']);
  assert.equal(code, 0);
  assert.match(out.text, /Added: 1 — brand-new-xano-armenter/);
  assert.match(out.text, /Removed: 1 — zebra-xano-armenter/);
  assert.match(out.text, /Changed: 1 — inches-xano-armenter/);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('OUT chooses the file', async (t) => {
  const { dir, file, go } = await sandbox(t);
  assert.equal((await go(jsonFetch(fixture()), [], { OUT: 'elsewhere/works.json' })).code, 0);
  assert.equal(await exists(join(dir, 'elsewhere/works.json')), true);
  assert.equal(await exists(file), false);
  await writeFile(join(dir, 'elsewhere/works.json'), 'not json');
  assert.equal((await go(jsonFetch(fixture()), [], { OUT: 'elsewhere/works.json' })).code, 0); // unreadable file: replaced
});
