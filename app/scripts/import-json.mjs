#!/usr/bin/env node
// Bulk-import artworks from a JSON file (e.g. a scraped Artwork Archive
// catalogue) with local or remote images, using the service-role key.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/import-json.mjs <artworks.json> \
//     --artist xano-armenter --name "Xano Armenter" --owner-email you@example.com \
//     [--root ../xano-armenter-site] [--currency EUR] [--public] [--dry-run]
//     [--collection "Selected works" --collection-slugs wave,agora | slugs.txt]
//
// Each JSON item may have: title, year ("1978", "~1978", "c. 1978"), medium, subject, dimensions ("46 x 38 cm"),
// price ("$1,500"), status, description, notes, location, inventory_number,
// image / thumb (path relative to --root, or http(s) URL), images (array),
// slug, aa_url / url (kept as source_ref). The piece's slug is `slug`, else the
// last segment of the link (".../artwork/about-the-future"), else the database
// builds it from the title. Image width and height are read from the file.
// Re-running skips pieces whose source_ref or title+year already exist.
//
// --collection puts the pieces listed in --collection-slugs (comma list, or a
// file with one slug per line) into that collection, in that order, creating
// it if needed (public when --public is given). Works on already-imported pieces.
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const file = args[0] && !args[0].startsWith('--') ? args[0] : undefined;
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const slug = opt('artist');
const root = path.resolve(opt('root', path.dirname(file ?? '.')));
const dry = flag('dry-run');

if (!file || !slug || !URL || !KEY) {
  console.error('Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/import-json.mjs <file.json> --artist <slug> [--name "Artist"] [--owner-email you@x.com] [--root dir] [--currency EUR] [--public] [--dry-run] [--collection "Name" --collection-slugs a,b,c]');
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

// ---- parsing helpers (kept in line with src/lib/importer.ts) ---------------
function parseNumber(v) {
  if (v == null || v === '') return null;
  const c = String(v).replace(/[^\d.,-]/g, '');
  if (!c) return null;
  if (/^-?\d{1,3}(\.\d{3})+$/.test(c)) return Number(c.replace(/\./g, ''));
  if (/^-?\d{1,3}(,\d{3})+$/.test(c)) return Number(c.replace(/,/g, ''));
  const s = c.lastIndexOf(',') > c.lastIndexOf('.') ? c.replace(/\./g, '').replace(',', '.') : c.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function parseCurrency(v) {
  const s = String(v ?? '');
  return s.match(/\b([A-Z]{3})\b/)?.[1] ?? (s.includes('€') ? 'EUR' : s.includes('£') ? 'GBP' : s.includes('$') ? 'USD' : null);
}
function parseDims(v) {
  const s = String(v ?? '');
  const n = (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(',', '.')));
  const unit = /\bin\b|inch|"/i.test(s) ? 'in' : 'cm';
  return { height: n[0] ?? null, width: n[1] ?? null, depth: n[2] ?? null, unit };
}
const STATUS = [[/sold/i, 'sold'], [/hold|reserv/i, 'on_hold'], [/loan/i, 'on_loan'], [/consign/i, 'consigned'], [/not for sale|nfs/i, 'not_for_sale'], [/avail/i, 'available']];
const parseStatus = (v) => (v ? STATUS.find(([re]) => re.test(v))?.[1] : null) ?? null;

async function readImage(ref) {
  if (/^https?:\/\//.test(ref)) {
    const r = await fetch(ref);
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${ref}`);
    return Buffer.from(await r.arrayBuffer());
  }
  return readFile(path.resolve(root, ref));
}

// "~1978", "c. 1978", "circa 1978" -> { year: 1978, circa: true }
function parseYear(v) {
  const s = String(v ?? '');
  const m = s.match(/\b(1\d{3}|2\d{3})\b/);
  if (!m) return { year: null, circa: false };
  const before = s.slice(0, m.index).trim();
  const circa = /(?:[~≈]|\b(?:c|ca|circa|approx|about|around)\.?)$/i.test(before) || /^\s*\?/.test(s.slice(m.index + 4));
  return { year: Number(m[1]), circa };
}
// ".../profile/<artist>/artwork/about-the-future" -> "about-the-future"
function slugFromRef(ref) {
  if (!/^https?:\/\//i.test(String(ref ?? ''))) return null;
  let url;
  try { url = new globalThis.URL(ref); } catch { return null; }
  const parts = url.pathname.split('/').filter(Boolean);
  if (!parts.length) return null;
  if (/artworkarchive\.com$/i.test(url.hostname) && parts[parts.length - 2] !== 'artwork') return null;
  let last = parts[parts.length - 1];
  try { last = decodeURIComponent(last); } catch { /* keep as is */ }
  return last.replace(/\.[a-z0-9]{2,5}$/i, '') || null;
}

// Pixel size and type from the file header (JPEG, PNG, WebP, GIF).
function imageInfo(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { type: 'image/png', ext: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { type: 'image/gif', ext: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    const base = { type: 'image/webp', ext: 'webp' };
    if (kind === 'VP8X') return { ...base, width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { ...base, width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { ...base, width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
    }
    return base;
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    // Walk JPEG markers to the SOF segment. EXIF orientations 5-8 swap the sides.
    const base = { type: 'image/jpeg', ext: 'jpg' };
    let i = 2, rotated = false;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return base;
      const marker = buf[i + 1];
      if (marker === 0xff) { i++; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (marker === 0xe1 && buf.toString('ascii', i + 4, i + 8) === 'Exif') rotated = exifRotated(buf.subarray(i + 10, i + 2 + len));
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        const h = buf.readUInt16BE(i + 5), w = buf.readUInt16BE(i + 7);
        return rotated ? { ...base, width: h, height: w } : { ...base, width: w, height: h };
      }
      i += 2 + len;
    }
    return base;
  }
  return null;
}
function exifRotated(tiff) {
  try {
    const le = tiff.toString('ascii', 0, 2) === 'II';
    const u16 = (o) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
    const u32 = (o) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
    const ifd = u32(4);
    for (let n = 0; n < u16(ifd); n++) {
      const e = ifd + 2 + n * 12;
      if (u16(e) === 0x0112) return u16(e + 8) >= 5;
    }
  } catch { /* malformed EXIF: assume upright */ }
  return false;
}

// ---- artist ---------------------------------------------------------------
let { data: artist } = await db.from('artists').select('*').eq('slug', slug).maybeSingle();
if (!artist) {
  const email = opt('owner-email');
  if (!email) {
    console.error(`No artist "${slug}" yet. Pass --owner-email (an existing account) and --name to create it.`);
    process.exit(1);
  }
  const { data: owner } = await db.from('profiles').select('id').ilike('email', email).maybeSingle();
  if (!owner) {
    console.error(`No account for ${email}. Sign up in the app first.`);
    process.exit(1);
  }
  if (dry) {
    console.log(`[dry run] would create artist ${slug} owned by ${email}`);
    artist = { id: '00000000-0000-0000-0000-000000000000', currency: opt('currency', 'EUR') };
  } else {
    const { data, error } = await db
      .from('artists')
      .insert({ slug, name: opt('name', slug), currency: opt('currency', 'EUR'), created_by: owner.id })
      .select()
      .single();
    if (error) throw error;
    const { error: mErr } = await db.from('artist_members').insert({ artist_id: data.id, user_id: owner.id, role: 'owner' });
    if (mErr) throw mErr;
    artist = data;
    console.log(`Created artist ${slug}`);
  }
}

// ---- pieces ---------------------------------------------------------------
const items = JSON.parse(await readFile(file, 'utf8'));
const { data: existing = [] } = await db.from('pieces').select('title, year, source_ref').eq('artist_id', artist.id);
const seenRef = new Set(existing.map((p) => p.source_ref).filter(Boolean));
const seenTY = new Set(existing.map((p) => `${p.title.toLowerCase()}|${p.year ?? ''}`));

let created = 0, skipped = 0, images = 0;
const failures = [];
for (const [n, it] of items.entries()) {
  const title = String(it.title ?? '').trim() || 'Untitled';
  const { year, circa } = parseYear(it.year);
  const source_ref = it.aa_url || it.url || it.source_ref || it.slug || null;
  if ((source_ref && seenRef.has(source_ref)) || seenTY.has(`${title.toLowerCase()}|${year ?? ''}`)) {
    skipped++;
    continue;
  }
  const dims = it.dimensions ? parseDims(it.dimensions) : { height: null, width: null, depth: null, unit: 'cm' };
  const piece = {
    artist_id: artist.id,
    title,
    // Null lets the database slugify the title; it also de-duplicates.
    slug: (typeof it.slug === 'string' && it.slug.trim()) || slugFromRef(it.aa_url || it.url || it.source_ref) || null,
    year,
    year_circa: circa,
    medium: it.medium || null,
    subject: it.subject || null,
    height: it.height ?? dims.height,
    width: it.width ?? dims.width,
    depth: it.depth ?? dims.depth,
    dimension_unit: dims.unit,
    price: parseNumber(it.price),
    currency: parseCurrency(it.price) || it.currency || artist.currency,
    status: parseStatus(it.status) ?? 'available',
    is_public: flag('public'),
    description: it.description || null,
    notes: it.notes || null,
    location: it.location || null,
    inventory_number: it.inventory_number || null,
    source_ref,
  };
  const refs = [...(it.images ?? []), it.image].filter(Boolean);
  if (dry) {
    console.log(`[dry run] ${title} (${circa ? 'c. ' : ''}${year ?? '—'}) ${piece.slug ?? '(slug from title)'} ${refs.length} image(s)`);
    created++;
    continue;
  }
  const { data: row, error } = await db.from('pieces').insert(piece).select('id').single();
  if (error) {
    failures.push(`${title}: ${error.message}`);
    continue;
  }
  created++;
  seenTY.add(`${title.toLowerCase()}|${year ?? ''}`);

  for (const [pos, ref] of [...new Set(refs)].entries()) {
    try {
      const full = await readImage(ref);
      const thumbRef = pos === 0 && it.thumb ? it.thumb : null;
      const thumb = thumbRef ? await readImage(thumbRef) : full;
      const info = imageInfo(full);
      const thumbInfo = imageInfo(thumb);
      if (!info || !thumbInfo) throw new Error('not a JPEG, PNG, WebP or GIF image');
      const id = crypto.randomUUID();
      const storage_path = `${artist.id}/${row.id}/${id}.${info.ext}`;
      const thumb_path = `${artist.id}/${row.id}/${id}_thumb.${thumbInfo.ext}`;
      let r = await db.storage.from('artwork').upload(storage_path, full, { contentType: info.type, cacheControl: '31536000' });
      if (r.error) throw r.error;
      r = await db.storage.from('artwork').upload(thumb_path, thumb, { contentType: thumbInfo.type, cacheControl: '31536000' });
      if (r.error) throw r.error;
      const { error: iErr } = await db.from('piece_images').insert({
        piece_id: row.id, artist_id: artist.id, storage_path, thumb_path, position: pos,
        width: info.width ?? null, height: info.height ?? null,
      });
      if (iErr) throw iErr;
      images++;
      if (!info.width || !info.height) failures.push(`${title} image ${ref}: stored, but its pixel size could not be read`);
    } catch (e) {
      failures.push(`${title} image ${ref}: ${e.message}`);
    }
  }
  process.stdout.write(`\r${n + 1}/${items.length} ${title.slice(0, 50).padEnd(50)}`);
}

// ---- optional collection ----------------------------------------------------
const collectionName = opt('collection');
if (collectionName && !dry) {
  const arg = opt('collection-slugs', '');
  const text = arg && !arg.includes(',') ? await readFile(arg, 'utf8').catch(() => arg) : arg;
  const slugs = [...new Set(text.split(/[\s,]+/).filter(Boolean))];
  const { data: found = [] } = await db.from('pieces').select('id, slug').eq('artist_id', artist.id).in('slug', slugs);
  const bySlug = new Map(found.map((p) => [p.slug, p.id]));
  slugs.filter((s) => !bySlug.has(s)).forEach((s) => failures.push(`collection "${collectionName}": no piece with slug ${s}`));
  const { data: col, error: cErr } = await db
    .from('collections')
    .upsert({ artist_id: artist.id, name: collectionName, ...(flag('public') ? { is_public: true } : {}) }, { onConflict: 'artist_id,name' })
    .select('id')
    .single();
  if (cErr) throw cErr;
  const links = slugs.filter((s) => bySlug.has(s)).map((s, position) => ({ collection_id: col.id, piece_id: bySlug.get(s), artist_id: artist.id, position }));
  if (links.length) {
    const { error: lErr } = await db.from('collection_pieces').upsert(links, { onConflict: 'collection_id,piece_id' });
    if (lErr) throw lErr;
  }
  console.log(`\nCollection "${collectionName}": ${links.length} piece(s) in the given order.`);
}

console.log(`\n\n${dry ? '[dry run] ' : ''}Created ${created} pieces, ${images} images; skipped ${skipped} already present.`);
if (failures.length) {
  console.log(`${failures.length} problem(s):`);
  failures.forEach((f) => console.log('  - ' + f));
  process.exitCode = 1;
}
