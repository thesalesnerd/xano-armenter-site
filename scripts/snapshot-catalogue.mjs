#!/usr/bin/env node
// Catalogue snapshot for the artist website.
//
// Fetches the public catalogue of one artist from Artfolio (the `catalogue_v1`
// RPC, readable with the anon key) and writes the JSON file the website bundles.
// Zero npm dependencies; needs Node 22+ (global fetch).
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon key> \
//   node snapshot.mjs [--dry-run] [--force]
//
// Environment:
//   SUPABASE_URL          required
//   SUPABASE_ANON_KEY     required (public value)
//   ARTIST_SLUG           default "xano-armenter"
//   SELECTED_COLLECTION   default "Selected"
//   OUT                   default "src/data/artworks.json"
//
// Only the fields listed in toWork() are ever written. Price is written only
// when the catalogue publishes it (the work's "show price" switch in Artfolio);
// notes, inventory numbers, descriptions and other catalogue data never reach
// the output.
//
// Site copy of app/integrations/xano-site/snapshot.mjs (branch
// claude/serene-allen-1y12cr), extended with price, currency, sold and series.
// It runs before every build (npm run build); if the API cannot be reached the
// committed src/data/artworks.json is kept, so the site never builds empty.

import { readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CATALOGUE_VERSION = 1;
export const RATIO_TOLERANCE = 0.15;
export const SHRINK_GUARD = 0.5;
const CM_PER_INCH = 2.54;

// Artfolio's project and its publishable key. Both are public (the browser app
// uses the same key) and only allow what anon may do: read catalogue_v1.
// SUPABASE_URL / SUPABASE_ANON_KEY override them.
const DEFAULT_SUPABASE_URL = 'https://trcqmiemvyoxeetgfguo.supabase.co';
const DEFAULT_ANON_KEY = 'sb_publishable_UG-NEwH8e6-YNrKIcOY1vw_dydhBKDg';

/** Errors that must stop the run and leave the existing file alone. */
export class SnapshotError extends Error {}

// ---------------------------------------------------------------- helpers

const round1 = (n) => Math.round(n * 10) / 10;

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function text(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function toInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isInteger(n) ? n : null;
}

/** Number -> display string: at most one decimal, no trailing ".0". */
export function fmt(n) {
  return String(round1(n));
}

/** Catalogue length -> centimetres, at most one decimal. */
export function toCm(value, unit) {
  const n = num(value);
  if (n === null) return null;
  return round1(unit === 'in' ? n * CM_PER_INCH : n);
}

export function slugify(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function publicUrl(supabaseUrl, path) {
  const base = String(supabaseUrl).replace(/\/+$/, '');
  const clean = String(path).replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/artwork/${clean}`;
}

/**
 * The site's dimension rule. The catalogue mixes "height x width" and
 * "width x height", so the longer number goes to the longer side of the image.
 * When the stated proportions are more than 15% away from the image's, the
 * numbers describe something else (a frame, a detail shot, a typo) and `cm`
 * is null so the site never scales a work from them.
 *
 * Returns { cm, dims }.
 */
export function dimensions(heightCm, widthCm, pxW, pxH) {
  if (heightCm === null && widthCm === null) return { cm: null, dims: null };
  if (heightCm === null || widthCm === null) {
    // One side only: nothing to check against, show what the catalogue says.
    return { cm: null, dims: `${fmt(heightCm ?? widthCm)} cm` };
  }
  const long = Math.max(heightCm, widthCm);
  const short = Math.min(heightCm, widthCm);
  const stated = long / short;
  const image = Math.max(pxW, pxH) / Math.min(pxW, pxH);
  if (Math.abs(stated / image - 1) > RATIO_TOLERANCE) {
    // Can't tell which number is which: keep the catalogue's own order for display.
    return { cm: null, dims: `${fmt(heightCm)} × ${fmt(widthCm)} cm` };
  }
  let h = heightCm;
  let w = widthCm;
  if (pxW > pxH) { w = long; h = short; }
  else if (pxH > pxW) { h = long; w = short; }
  return { cm: { h, w }, dims: `${fmt(h)} × ${fmt(w)} cm` };
}

function compareText(a, b) {
  const x = a.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const y = b.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------- build

/** One catalogue piece -> one website work. Key order here is the output key order. */
function toWork(piece, ctx) {
  const image = piece.images[0];
  const pxW = toInt(image.width);
  const pxH = toInt(image.height);
  const unit = piece.dimension_unit ?? ctx.artistUnit ?? 'cm';
  const { cm, dims } = dimensions(toCm(piece.height, unit), toCm(piece.width, unit), pxW, pxH);
  const imageUrl = publicUrl(ctx.supabaseUrl, image.path);
  return {
    slug: ctx.slug,
    title: text(piece.title) ?? 'Untitled',
    year: toInt(piece.year),
    circa: piece.year_circa === true,
    medium: text(piece.medium),
    subject: text(piece.subject),
    cm,
    dims,
    image: imageUrl,
    thumb: text(image.thumb_path) ? publicUrl(ctx.supabaseUrl, image.thumb_path) : imageUrl,
    w: pxW,
    h: pxH,
    selected: null,
    price: num(piece.price),
    currency: num(piece.price) === null ? null : text(piece.currency) ?? text(ctx.artistCurrency),
    sold: piece.status === 'sold',
    series: ctx.series.get(piece.id) ?? [],
  };
}

/**
 * Catalogue (the catalogue_v1 response) -> { works, skipped, problems, selectedFound }.
 *   skipped   pieces left out because they have no image (expected, not an error)
 *   problems  pieces left out because something is wrong with them (reported loudly)
 */
export function buildSnapshot(catalogue, { supabaseUrl, selectedCollection = 'Selected' } = {}) {
  if (!supabaseUrl) throw new SnapshotError('SUPABASE_URL is required to build image URLs.');
  const pieces = Array.isArray(catalogue?.pieces) ? catalogue.pieces : [];
  const artistSlug = text(catalogue?.artist?.slug) ?? '';
  const artistUnit = catalogue?.artist?.dimension_unit;
  const artistCurrency = catalogue?.artist?.currency;

  const wanted = selectedCollection.trim().toLowerCase();
  const collection = (catalogue?.collections ?? []).find((c) => String(c.name ?? '').trim().toLowerCase() === wanted);
  const selectedIds = collection ? (collection.piece_ids ?? []) : [];

  // Series: every other public collection a work is in, by name.
  const series = new Map();
  for (const c of catalogue?.collections ?? []) {
    const name = text(c.name);
    if (!name || c === collection) continue;
    for (const id of c.piece_ids ?? []) series.set(id, [...(series.get(id) ?? []), name]);
  }

  const works = [];
  const skipped = [];
  const problems = [];
  const bySlug = new Map();
  const byId = new Map();

  for (const piece of pieces) {
    const label = `"${piece.title ?? '(untitled)'}" (${piece.inventory_number ?? piece.id})`;
    const first = Array.isArray(piece.images) ? piece.images[0] : undefined;
    if (!first || !text(first.path)) { skipped.push(label); continue; }
    if (toInt(first.width) === null || toInt(first.height) === null || first.width <= 0 || first.height <= 0) {
      problems.push(`${label}: first image has no pixel size (width/height) in the catalogue; work left out`);
      continue;
    }
    const slug = text(piece.slug) ?? [slugify(piece.title), artistSlug].filter(Boolean).join('-');
    if (!slug) { problems.push(`${label}: no slug and no title to make one from; work left out`); continue; }
    if (bySlug.has(slug)) {
      problems.push(`${label}: slug "${slug}" is already used by ${bySlug.get(slug)}; work left out`);
      continue;
    }
    bySlug.set(slug, label);
    const work = toWork(piece, { supabaseUrl, artistUnit, artistCurrency, slug, series });
    works.push(work);
    byId.set(piece.id, work);
  }

  // Position among the works that are actually emitted, so the site gets 0,1,2…
  // with no gaps even if a selected piece has no image yet.
  let position = 0;
  for (const id of selectedIds) {
    const work = byId.get(id);
    if (work && work.selected === null) work.selected = position++;
  }

  works.sort((a, b) => {
    if ((a.selected === null) !== (b.selected === null)) return a.selected === null ? 1 : -1;
    if (a.selected !== null && a.selected !== b.selected) return a.selected - b.selected;
    if (a.year !== b.year) {
      if (a.year === null) return 1;
      if (b.year === null) return -1;
      return b.year - a.year;
    }
    return compareText(a.title, b.title) || compareText(a.slug, b.slug);
  });

  return { works, skipped, problems, selectedFound: Boolean(collection) };
}

/** Deterministic text of the output file. */
export function serialize(works) {
  return JSON.stringify(works, null, 2) + '\n';
}

/** What changed between the file on disk and the new snapshot. */
export function diffWorks(before, after) {
  const old = new Map(before.map((w) => [w.slug, JSON.stringify(w)]));
  const cur = new Map(after.map((w) => [w.slug, JSON.stringify(w)]));
  return {
    added: [...cur.keys()].filter((s) => !old.has(s)),
    removed: [...old.keys()].filter((s) => !cur.has(s)),
    changed: [...cur.keys()].filter((s) => old.has(s) && old.get(s) !== cur.get(s)),
    reordered: before.map((w) => w.slug).join('\n') !== after.map((w) => w.slug).join('\n'),
  };
}

// ---------------------------------------------------------------- fetch

export async function fetchCatalogue({ supabaseUrl, anonKey, artistSlug, fetchImpl = fetch, attempts = 3 }) {
  const url = `${String(supabaseUrl).replace(/\/+$/, '')}/rest/v1/rpc/catalogue_v1`;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ p_artist_slug: artistSlug }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      lastError = new SnapshotError(`Could not reach the catalogue API: ${err.message}`);
      continue; // network trouble: try again
    }
    if (res.status >= 500 && attempt < attempts) {
      lastError = new SnapshotError(`Catalogue API answered HTTP ${res.status}`);
      continue;
    }
    if (res.status !== 200) {
      const body = await res.text().catch(() => '');
      throw new SnapshotError(`Catalogue API answered HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    try {
      return await res.json();
    } catch (err) {
      throw new SnapshotError(`Catalogue API did not return JSON: ${err.message}`);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------- run

async function readExisting(path) {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { raw: null, works: null };
    throw err;
  }
  try {
    const parsed = JSON.parse(raw);
    return { raw, works: Array.isArray(parsed) ? parsed : null };
  } catch {
    return { raw, works: null };
  }
}

/**
 * Runs the snapshot. Returns the process exit code. Never throws for expected
 * failures, and never touches the output file unless everything checked out.
 */
export async function run({ argv = [], env = process.env, cwd = process.cwd(), fetchImpl = fetch, out = console } = {}) {
  const dryRun = argv.includes('--dry-run');
  const force = argv.includes('--force');
  const unknown = argv.filter((a) => !['--dry-run', '--force'].includes(a));
  const fail = (message) => {
    out.error(`snapshot: ${message}`);
    if (env.GITHUB_ACTIONS) out.error(`::error title=Catalogue snapshot::${message.replace(/\n/g, ' ')}`);
    return 1;
  };
  if (unknown.length) return fail(`unknown argument ${unknown.join(' ')} (use --dry-run and/or --force)`);

  const supabaseUrl = text(env.SUPABASE_URL) ?? DEFAULT_SUPABASE_URL;
  const anonKey = text(env.SUPABASE_ANON_KEY) ?? DEFAULT_ANON_KEY;
  const artistSlug = text(env.ARTIST_SLUG) ?? 'xano-armenter';
  const selectedCollection = text(env.SELECTED_COLLECTION) ?? 'Selected';
  const outPath = resolve(cwd, text(env.OUT) ?? 'src/data/artworks.json');
  if (!supabaseUrl || !anonKey) return fail('SUPABASE_URL and SUPABASE_ANON_KEY must be set.');

  try {
    const catalogue = await fetchCatalogue({ supabaseUrl, anonKey, artistSlug, fetchImpl });
    if (catalogue === null || catalogue === undefined) {
      throw new SnapshotError(`The API returned null for "${artistSlug}": no such artist, or the public profile is switched off.`);
    }
    if (catalogue.version !== CATALOGUE_VERSION) {
      throw new SnapshotError(`Catalogue version is ${JSON.stringify(catalogue.version)}, this script understands ${CATALOGUE_VERSION}. Update the script.`);
    }

    const { works, skipped, problems, selectedFound } = buildSnapshot(catalogue, { supabaseUrl, selectedCollection });
    for (const p of problems) {
      out.error(`snapshot: PROBLEM ${p}`);
      if (env.GITHUB_ACTIONS) out.error(`::warning title=Work left out of the snapshot::${p}`);
    }
    if (works.length === 0) {
      throw new SnapshotError(`The catalogue has ${catalogue.pieces?.length ?? 0} public works but none with a usable image.`);
    }

    const existing = await readExisting(outPath);
    const before = existing.works ?? [];
    const diff = diffWorks(before, works);
    const selectedCount = works.filter((w) => w.selected !== null).length;
    const text_ = serialize(works);
    const unchanged = existing.raw === text_;

    out.log(`Artist: ${artistSlug} (${catalogue.pieces?.length ?? 0} public works in the catalogue)`);
    out.log(`Works in snapshot: ${works.length} (was ${existing.works ? before.length : 'no file'})`);
    out.log(`Left out, no image: ${skipped.length}${skipped.length ? ` — ${skipped.join(', ')}` : ''}`);
    out.log(`Left out, problems: ${problems.length}`);
    out.log(`Selected ("${selectedCollection}"): ${selectedCount}${selectedFound ? '' : ' — no public collection with that name'}`);
    out.log(`Without usable dimensions (cm null): ${works.filter((w) => w.cm === null).length}`);
    out.log(`Added: ${diff.added.length}${diff.added.length ? ` — ${diff.added.join(', ')}` : ''}`);
    out.log(`Removed: ${diff.removed.length}${diff.removed.length ? ` — ${diff.removed.join(', ')}` : ''}`);
    out.log(`Changed: ${diff.changed.length}${diff.changed.length ? ` — ${diff.changed.join(', ')}` : ''}`);
    if (diff.reordered && !diff.added.length && !diff.removed.length) out.log('Order changed.');

    if (!force) {
      if (before.length > 0 && works.length < before.length * SHRINK_GUARD) {
        throw new SnapshotError(
          `The new snapshot has ${works.length} works, fewer than half of the ${before.length} in ${outPath}. ` +
          'Refusing to overwrite. If this is intended, run again with --force.');
      }
      if (before.some((w) => w.selected !== null && w.selected !== undefined) && selectedCount === 0) {
        throw new SnapshotError(
          `The current file has selected works but the new snapshot has none (public collection "${selectedCollection}" ` +
          `${selectedFound ? 'has no works with images' : 'was not found'}). Refusing to empty the Selected page. ` +
          'If this is intended, run again with --force.');
      }
    }

    if (dryRun) {
      out.log(unchanged ? 'Dry run: file is already up to date.' : `Dry run: ${outPath} would be rewritten.`);
      return 0;
    }
    if (unchanged) {
      out.log('No change: file left as it is.');
      return 0;
    }
    await mkdir(dirname(outPath), { recursive: true });
    const tmp = `${outPath}.tmp-${process.pid}`;
    try {
      await writeFile(tmp, text_, 'utf8');
      await rename(tmp, outPath);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
    out.log(`Wrote ${outPath}`);
    return 0;
  } catch (err) {
    if (err instanceof SnapshotError) return fail(`${err.message}\nThe existing file was not touched.`);
    throw err;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await run({ argv: process.argv.slice(2) });
}
