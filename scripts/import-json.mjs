#!/usr/bin/env node
// Bulk-import artworks from a JSON file (e.g. a scraped Artwork Archive
// catalogue) with local or remote images, using the service-role key.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/import-json.mjs <artworks.json> \
//     --artist xano-armenter --name "Xano Armenter" --owner-email you@example.com \
//     [--root ../xano-armenter-site] [--currency EUR] [--public] [--dry-run]
//
// Each JSON item may have: title, year, medium, subject, dimensions ("46 x 38 cm"),
// price ("$1,500"), status, description, notes, location, inventory_number,
// image / thumb (path relative to --root, or http(s) URL), images (array),
// slug / aa_url / url (kept as source_ref). Re-running skips pieces whose
// source_ref or title+year already exist.
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
  console.error('Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/import-json.mjs <file.json> --artist <slug> [--name "Artist"] [--owner-email you@x.com] [--root dir] [--currency EUR] [--public] [--dry-run]');
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

function jpegSize(buf) {
  // Walk JPEG markers to the SOF segment for width/height.
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
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
  const year = Number(String(it.year ?? '').match(/\b\d{4}\b/)?.[0]) || null;
  const source_ref = it.aa_url || it.url || it.source_ref || it.slug || null;
  if ((source_ref && seenRef.has(source_ref)) || seenTY.has(`${title.toLowerCase()}|${year ?? ''}`)) {
    skipped++;
    continue;
  }
  const dims = it.dimensions ? parseDims(it.dimensions) : { height: null, width: null, depth: null, unit: 'cm' };
  const piece = {
    artist_id: artist.id,
    title,
    year,
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
    console.log(`[dry run] ${title} (${year ?? '—'}) ${refs.length} image(s)`);
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
      const id = crypto.randomUUID();
      const storage_path = `${artist.id}/${row.id}/${id}.jpg`;
      const thumb_path = `${artist.id}/${row.id}/${id}_thumb.jpg`;
      const opts = { contentType: 'image/jpeg', cacheControl: '31536000' };
      let r = await db.storage.from('artwork').upload(storage_path, full, opts);
      if (r.error) throw r.error;
      r = await db.storage.from('artwork').upload(thumb_path, thumb, opts);
      if (r.error) throw r.error;
      const size = jpegSize(full) ?? {};
      const { error: iErr } = await db.from('piece_images').insert({ piece_id: row.id, artist_id: artist.id, storage_path, thumb_path, position: pos, ...size });
      if (iErr) throw iErr;
      images++;
    } catch (e) {
      failures.push(`${title} image ${ref}: ${e.message}`);
    }
  }
  process.stdout.write(`\r${n + 1}/${items.length} ${title.slice(0, 50).padEnd(50)}`);
}

console.log(`\n\n${dry ? '[dry run] ' : ''}Created ${created} pieces, ${images} images; skipped ${skipped} already present.`);
if (failures.length) {
  console.log(`${failures.length} problem(s):`);
  failures.forEach((f) => console.log('  - ' + f));
  process.exitCode = 1;
}
