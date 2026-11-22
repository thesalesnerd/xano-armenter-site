// Loads the Artfolio snapshot the planner needs, and writes a plan.
// Both take the Supabase client as a parameter so they run in the browser
// (signed-in owner) and in tests against the local stack.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import type { Existing, Plan } from './plan';
import { summarize } from './plan';

type Db = SupabaseClient<Database>;

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function loadExisting(db: Db, artist: { id: string; slug: string; currency: string; dimension_unit: string }): Promise<Existing> {
  const a = artist.id;
  const [pieces, images, locations, contacts, invoices, sales, exhibitions, exhibitionPieces, collections, collectionPieces, provenance] = await Promise.all([
    all((f, t) => db.from('pieces').select('id, inventory_number, slug, title, status, year, medium, subject, style, height, width, depth, framed, framed_height, framed_width, framed_depth, price, currency, description, notes, signature, edition_size, tags, location, location_id, source_ref, creation_date').eq('artist_id', a).order('id').range(f, t)),
    all((f, t) => db.from('piece_images').select('piece_id, source_url').eq('artist_id', a).order('id').range(f, t)),
    all((f, t) => db.from('locations').select('id, name').eq('artist_id', a).order('id').range(f, t)),
    all((f, t) => db.from('contacts').select('id, name, email, source_ref, company, kind, phone, address, city, country, website, notes').eq('artist_id', a).order('id').range(f, t)),
    all((f, t) => db.from('invoices').select('id, number').eq('artist_id', a).order('id').range(f, t)),
    all((f, t) => db.from('sales').select('id, piece_id, sale_date, price, source_ref').eq('artist_id', a).order('id').range(f, t)),
    all((f, t) => db.from('exhibitions').select('id, title, start_date, source_ref').eq('artist_id', a).order('id').range(f, t)),
    all((f, t) => db.from('exhibition_pieces').select('exhibition_id, piece_id').eq('artist_id', a).order('piece_id').range(f, t)),
    all((f, t) => db.from('collections').select('id, name').eq('artist_id', a).order('id').range(f, t)),
    all((f, t) => db.from('collection_pieces').select('collection_id, piece_id').eq('artist_id', a).order('piece_id').range(f, t)),
    all((f, t) => db.from('provenance').select('piece_id, description, party, date_text').eq('artist_id', a).order('id').range(f, t)),
  ]);
  const imgCount = new Map<string, number>();
  const imgSrc = new Map<string, string[]>();
  for (const i of images) {
    imgCount.set(i.piece_id, (imgCount.get(i.piece_id) ?? 0) + 1);
    if (i.source_url) imgSrc.set(i.piece_id, [...(imgSrc.get(i.piece_id) ?? []), i.source_url]);
  }
  return {
    artistSlug: artist.slug,
    currency: artist.currency,
    unit: artist.dimension_unit === 'in' ? 'in' : 'cm',
    pieces: pieces.map((p) => ({ ...p, image_count: imgCount.get(p.id) ?? 0, image_sources: imgSrc.get(p.id) ?? [] })),
    locations, contacts, invoices, sales, exhibitions, exhibitionPieces, collections, collectionPieces, provenance,
  } as Existing;
}

export type Progress = (msg: string) => void;
export type ImageFetcher = (url: string, pieceId: string, position: number) => Promise<void>;

export type ApplyResult = { written: Record<string, number>; errors: string[] };

/**
 * Writes the plan in dependency order. Each step resolves refs produced by
 * earlier steps. Errors are collected per row and do not stop the run; a
 * rerun of the planner afterwards picks up whatever didn't make it.
 */
export async function applyPlan(db: Db, artistId: string, plan: Plan, opts: { onProgress?: Progress; fetchImage?: ImageFetcher; fileNames?: string[] } = {}): Promise<ApplyResult> {
  const say = opts.onProgress ?? (() => {});
  const ids = new Map<string, string>();
  const errors: string[] = [];
  const written: Record<string, number> = {};
  const bump = (k: string) => (written[k] = (written[k] ?? 0) + 1);
  const resolve = (ref: string | undefined) => (!ref ? null : ref.startsWith('id:') ? ref.slice(3) : ids.get(ref) ?? null);
  const fail = (where: { sheet: string; row: number }, what: string, e: unknown) =>
    errors.push(`${where.sheet} row ${where.row}: ${what}: ${(e as { message?: string })?.message ?? String(e)}`);

  async function insert(table: 'locations' | 'contacts' | 'invoices' | 'exhibitions' | 'collections', op: Plan['locations'][number], values: Record<string, unknown>) {
    const { data, error } = await db.from(table).insert({ ...values, artist_id: artistId } as never).select('id').single();
    if (error) return fail(op, `create ${table.slice(0, -1)} “${op.label}”`, error);
    ids.set(op.ref, (data as { id: string }).id);
    bump(table);
  }

  say('Locations…');
  for (const op of plan.locations) if (op.action === 'create') await insert('locations', op, op.values);
  say('Contacts…');
  for (const op of plan.contacts) {
    if (op.action === 'create') await insert('contacts', op, op.values);
    else if (op.action === 'update' && op.id) {
      const { error } = await db.from('contacts').update(op.values as never).eq('id', op.id);
      if (error) fail(op, `update contact “${op.label}”`, error);
      else bump('contacts updated');
    }
  }
  say('Invoices…');
  for (const op of plan.invoices) {
    if (op.action !== 'create') continue;
    // Invoice contact = the buyer of its first sale.
    const sale = plan.sales.find((s) => s.invoiceRef === op.ref && s.buyerRef);
    await insert('invoices', op, { ...op.values, contact_id: resolve(sale?.buyerRef) });
  }
  say('Exhibitions…');
  for (const op of plan.exhibitions) if (op.action === 'create') await insert('exhibitions', op, op.values);
  say('Collections…');
  for (const op of plan.collections) if (op.action === 'create') await insert('collections', op, op.values);

  // Pieces.
  const pieceOps = plan.pieces.filter((p) => p.action === 'create' || p.action === 'update');
  for (const [i, op] of pieceOps.entries()) {
    say(`Pieces ${i + 1} of ${pieceOps.length}…`);
    const { location_ref, ...rest } = op.values as Record<string, unknown> & { location_ref?: string };
    const values: Record<string, unknown> = { ...rest };
    if (location_ref) values.location_id = resolve(location_ref);
    for (const k of ['collection', 'exhibition', 'provenance', 'images']) delete values[k];
    if (op.action === 'create') {
      const { data, error } = await db.from('pieces').insert({ ...values, artist_id: artistId } as never).select('id').single();
      if (error) {
        fail(op, `create piece “${op.label}”`, error);
        continue;
      }
      ids.set(op.ref, (data as { id: string }).id);
      bump('pieces');
    } else if (Object.keys(values).length) {
      const { error } = await db.from('pieces').update(values as never).eq('id', op.pieceId!);
      if (error) fail(op, `update piece “${op.label}”`, error);
      else bump('pieces updated');
    }
  }

  say('Links…');
  for (const l of plan.links) {
    const piece_id = resolve(l.pieceRef);
    const target = resolve(l.targetRef);
    if (!piece_id || !target) continue;
    const { error } =
      l.kind === 'collection'
        ? await db.from('collection_pieces').upsert({ collection_id: target, piece_id, artist_id: artistId }, { onConflict: 'collection_id,piece_id', ignoreDuplicates: true })
        : await db.from('exhibition_pieces').upsert({ exhibition_id: target, piece_id, artist_id: artistId }, { onConflict: 'exhibition_id,piece_id', ignoreDuplicates: true });
    if (error) errors.push(`link ${l.kind}: ${error.message}`);
    else bump(`${l.kind} links`);
  }

  say('Provenance…');
  const provPos = new Map<string, number>();
  for (const p of plan.provenance) {
    const piece_id = resolve(p.pieceRef);
    if (!piece_id) continue;
    const position = provPos.get(piece_id) ?? 100;
    provPos.set(piece_id, position + 1);
    const { error } = await db.from('provenance').insert({ artist_id: artistId, piece_id, position, event: 'other', description: p.description, is_public: false });
    if (error) errors.push(`provenance for ${p.label}: ${error.message}`);
    else bump('provenance');
  }

  say('Sales…');
  for (const s of plan.sales) {
    if (s.action !== 'create') continue;
    const piece_id = resolve(s.pieceRef);
    if (!piece_id) {
      fail(s, `sale of “${s.label}”`, 'the piece was not created');
      continue;
    }
    const { error } = await db.from('sales').insert({
      ...(s.values as object),
      artist_id: artistId,
      piece_id,
      buyer_contact_id: resolve(s.buyerRef),
      via_contact_id: resolve(s.viaRef),
      invoice_id: resolve(s.invoiceRef),
    } as never);
    if (error) fail(s, `sale of “${s.label}”`, error);
    else bump('sales');
  }

  if (opts.fetchImage) {
    const jobs = plan.pieces.flatMap((op) => {
      const before = Number(op.changes.find((c) => c.field === 'images')?.from ?? 0);
      return op.images.map((url, i) => ({ op, url, i: before + i }));
    });
    for (const [n, { op, url, i }] of jobs.entries()) {
      say(`Images ${n + 1} of ${jobs.length}…`);
      const piece_id = resolve(op.ref);
      if (!piece_id) continue;
      try {
        await opts.fetchImage(url, piece_id, i);
        bump('images');
      } catch (e) {
        fail(op, `image ${url}`, e);
      }
    }
  }

  await db.from('import_runs').insert({ artist_id: artistId, source: 'artwork-archive', file_names: opts.fileNames ?? [], summary: { planned: summarize(plan), written, errors } as never });
  say('Done');
  return { written, errors };
}
