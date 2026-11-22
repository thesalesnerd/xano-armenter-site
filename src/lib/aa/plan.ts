// Dry-run planner for an Artwork Archive export.
//
// buildPlan() is pure: it takes the parsed sheets and a snapshot of what is
// already in Artfolio and returns every create / update / skip it would do,
// with the reason. Nothing is written until applyPlan() runs the plan.
//
// Rules (they make a second run a no-op):
//  * Pieces match on inventory number, then on slug (explicit slug column,
//    the AA /artwork/<slug> link, or the title as AA slugs it). A row that
//    matches nothing but has the same title as an existing piece is NOT
//    created; it is reported so the user can decide.
//  * Existing values are never overwritten by default. Empty fields are
//    filled; different values are listed as conflicts. Exception: status,
//    because Artfolio defaulted every imported work to "available".
//  * Visibility (is_public) and slugs of existing pieces are never changed.
//  * Contacts match on AA id, then email, then name. Sales on AA id, then
//    piece + date + price. Exhibitions on AA id, then title + start date.
//    Locations and collections on name. Images on their source URL.

import { slugFromSourceRef, parseCurrency, parseDimensions, parseNumber, parseStatus, parseYear, splitImageUrls } from '../importer';
import type { Entity, FieldMap } from './fields';
import type { Sheet } from './sheets';

// ---------------------------------------------------------------------------
// Snapshot of existing data (only what matching and merging need)
// ---------------------------------------------------------------------------
export type ExPiece = {
  id: string; inventory_number: string | null; slug: string; title: string; status: string;
  year: number | null; medium: string | null; subject: string | null; style: string | null;
  height: number | null; width: number | null; depth: number | null;
  framed_height: number | null; framed_width: number | null; framed_depth: number | null; framed: boolean;
  price: number | null; currency: string | null; description: string | null; notes: string | null;
  signature: string | null; edition_size: number | null; tags: string[]; location: string | null;
  location_id: string | null; source_ref: string | null; creation_date: string | null;
  image_count: number; image_sources: string[];
};
export type Existing = {
  artistSlug: string;
  currency: string;
  unit: 'cm' | 'in';
  pieces: ExPiece[];
  locations: { id: string; name: string }[];
  contacts: { id: string; name: string; email: string | null; source_ref: string | null; company: string | null }[];
  invoices: { id: string; number: string }[];
  sales: { id: string; piece_id: string; sale_date: string | null; price: number | null; source_ref: string | null }[];
  exhibitions: { id: string; title: string; start_date: string | null; source_ref: string | null }[];
  exhibitionPieces: { exhibition_id: string; piece_id: string }[];
  collections: { id: string; name: string }[];
  collectionPieces: { collection_id: string; piece_id: string }[];
  provenance: { piece_id: string; description: string | null; party: string | null; date_text: string | null }[];
};

export type SheetInput = { sheet: Sheet; entity: Entity | 'ignore'; mapping: FieldMap };
export type Options = {
  overwrite: boolean;          // replace differing values instead of reporting them
  createTitleMatches: boolean; // create pieces whose only match is a same-titled piece
  defaultPublic: boolean;      // visibility for newly created pieces
  dateOrder: 'mdy' | 'dmy';    // how to read 03/04/2021 (AA is US: month first)
};
export const DEFAULT_OPTIONS: Options = { overwrite: false, createTitleMatches: false, defaultPublic: false, dateOrder: 'mdy' };

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------
export type Change = { field: string; from: unknown; to: unknown };
export type Where = { sheet: string; row: number }; // row: 1-based data row (header = row 1, so first data row = 2)
export type Action = 'create' | 'update' | 'unchanged' | 'skip';

export type PieceOp = Where & {
  action: Action; label: string; reason?: string;
  pieceId?: string; matchedBy?: string; ref: string; // temp ref for new pieces
  values: Record<string, unknown>; // full insert values (create) or patch (update)
  changes: Change[]; conflicts: Change[];
  location?: string; collections: string[]; exhibitions: string[]; provenance: string[];
  images: string[]; imagesSkipped: number;
};
export type SimpleOp = Where & {
  action: Action; label: string; reason?: string; id?: string; ref: string;
  values: Record<string, unknown>; changes: Change[]; conflicts: Change[];
};
export type SaleOp = SimpleOp & { pieceRef?: string; buyerRef?: string; viaRef?: string; invoiceRef?: string; markSold: boolean };
export type ExhibitionOp = SimpleOp & { pieceRefs: string[] };
export type Link = { kind: 'collection' | 'exhibition'; targetRef: string; pieceRef: string };

export type Plan = {
  pieces: PieceOp[];
  locations: SimpleOp[];
  contacts: SimpleOp[];
  invoices: SimpleOp[];
  sales: SaleOp[];
  exhibitions: ExhibitionOp[];
  collections: SimpleOp[];
  links: Link[];
  provenance: { pieceRef: string; description: string; label: string }[];
  unmapped: { sheet: string; column: string; filled: number; sample: string }[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------
const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function slugify(s: string): string {
  return norm(s).replace(/ /g, '-').slice(0, 80).replace(/-+$/, '');
}

const isEmpty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

function same(a: unknown, b: unknown): boolean {
  if (isEmpty(a) && isEmpty(b)) return true;
  if (typeof a === 'number' || typeof b === 'number') return a != null && b != null && Number(a) === Number(b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => norm(String(x)) === norm(String(b[i])));
  return norm(String(a ?? '')) === norm(String(b ?? ''));
}

const truthy = (v: string) => /^(y|yes|true|1|public|published|visible|x|si|sí)$/i.test(v.trim());

/** Reads a date cell: ISO, Excel's ISO conversion, 3/4/2021 (month first unless the option says otherwise), "May 3, 2021", or a bare year. */
export function parseDate(v: string, order: 'mdy' | 'dmy' = 'mdy'): string | null {
  const s = v.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let a = +m[1], b = +m[2];
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    if (order === 'dmy' || a > 12) [a, b] = [b, a];
    return iso(y, a, b);
  }
  m = s.match(/^(\d{4})$/);
  if (m) return iso(+m[1], 1, 1);
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return null;
}
function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1000 || y > 3000) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Artwork Archive media typed in Spanish/Catalan, as Artfolio stores them in English. */
export function normalizeMedium(v: string): string {
  const s = v.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const m = s.match(/^(acrilic|acrylic|oleo|oli|oil)\w*\s+(sobre|on|s\/)\s+(tela|tel|lienzo|canvas|paper|papel)\w*$/);
  if (!m) return v.trim();
  const what = /^(oleo|oli|oil)/.test(m[1]) ? 'Oil' : 'Acrylic';
  return `${what} on ${/^(paper|papel)/.test(m[3]) ? 'paper' : 'canvas'}`;
}

const list = (v: string) => v.split(/\s*[;\n|]\s*/).map((x) => x.trim()).filter(Boolean);

function contactKind(v: string): string | null {
  const s = v.toLowerCase();
  if (!s) return null;
  if (/gallery|galer/.test(s)) return 'gallery';
  if (/museum|institution|foundation|university|school|hospital|corporate|company/.test(s)) return 'institution';
  if (/dealer|agent|consultant|advisor/.test(s)) return 'dealer';
  if (/press|media|journalist|critic/.test(s)) return 'press';
  if (/collector|buyer|client|customer|patron/.test(s)) return 'collector';
  return 'other';
}

function exhibitionKind(v: string): string | null {
  const s = v.toLowerCase();
  if (!s) return null;
  if (/solo/.test(s)) return 'solo';
  if (/group|collective/.test(s)) return 'group';
  if (/fair/.test(s)) return 'fair';
  if (/online|virtual/.test(s)) return 'online';
  if (/residen/.test(s)) return 'residency';
  return 'other';
}

function locationKind(v: string): string | null {
  const s = v.toLowerCase();
  if (!s) return null;
  if (/studio/.test(s)) return 'studio';
  if (/storage|warehouse|camp/.test(s)) return 'storage';
  if (/gallery/.test(s)) return 'gallery';
  if (/collector|client/.test(s)) return 'collector';
  if (/exhib|show/.test(s)) return 'exhibition';
  return 'other';
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------
export function buildPlan(inputs: SheetInput[], ex: Existing, opts: Partial<Options> = {}): Plan {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const plan: Plan = { pieces: [], locations: [], contacts: [], invoices: [], sales: [], exhibitions: [], collections: [], links: [], provenance: [], unmapped: [], warnings: [] };

  // --- unmapped columns: nothing is dropped silently -------------------------
  for (const { sheet, entity, mapping } of inputs) {
    for (const h of sheet.headers) {
      if (entity !== 'ignore' && mapping[h]) continue;
      const vals = sheet.rows.map((r) => r[h]).filter(Boolean);
      if (vals.length) plan.unmapped.push({ sheet: sheet.name, column: h, filled: vals.length, sample: vals[0].slice(0, 60) });
    }
  }

  const rowsOf = (entity: Entity) =>
    inputs
      .filter((i) => i.entity === entity)
      .flatMap(({ sheet, mapping }) =>
        sheet.rows.map((r, i) => {
          const get = (k: string) => {
            const col = sheet.headers.find((h) => mapping[h] === k);
            return col ? (r[col] ?? '').trim() : '';
          };
          return { get, where: { sheet: sheet.name, row: i + 2 } };
        }),
      );

  // --- lookups ---------------------------------------------------------------
  const byInv = new Map<string, ExPiece>();
  const bySlug = new Map<string, ExPiece>();
  const byTitle = new Map<string, ExPiece[]>();
  for (const p of ex.pieces) {
    if (p.inventory_number) byInv.set(norm(p.inventory_number), p);
    bySlug.set(p.slug, p);
    const t = norm(p.title);
    byTitle.set(t, [...(byTitle.get(t) ?? []), p]);
  }

  // Named things (locations, collections, contacts, invoices, exhibitions) can
  // be referenced from several sheets; each gets one op and a stable ref.
  const named = <T extends SimpleOp>(arr: T[], existing: { id: string; name: string }[], prefix: string) => {
    const ex2 = new Map(existing.map((e) => [norm(e.name), e]));
    const made = new Map<string, T>();
    return (name: string, where: Where, values: Record<string, unknown>, make: (op: SimpleOp) => T = (x) => x as T): string => {
      const k = norm(name);
      const hit = ex2.get(k);
      if (hit) return `id:${hit.id}`;
      let op = made.get(k);
      if (!op) {
        op = make({ ...where, action: 'create', label: name, ref: `${prefix}:${k}`, values, changes: [], conflicts: [] });
        made.set(k, op);
        arr.push(op);
      }
      return op.ref;
    };
  };
  const location = named(plan.locations, ex.locations, 'loc');
  const collection = named(plan.collections, ex.collections, 'col');
  const invoice = named(plan.invoices, ex.invoices.map((i) => ({ id: i.id, name: i.number })), 'inv');

  // --- contacts ----------------------------------------------------------------
  const cBySrc = new Map(ex.contacts.filter((c) => c.source_ref).map((c) => [c.source_ref!, c]));
  const cByEmail = new Map(ex.contacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]));
  const cByName = new Map(ex.contacts.map((c) => [norm(c.name), c]));
  const newContacts = new Map<string, SimpleOp>();

  function contactRef(fields: Record<string, unknown>, where: Where, fromSheet: boolean): string | undefined {
    const name = String(fields.name ?? '').trim();
    const email = String(fields.email ?? '').trim().toLowerCase();
    const src = String(fields.source_ref ?? '').trim();
    if (!name && !email) return undefined;
    const hit = (src && cBySrc.get(src)) || (email && cByEmail.get(email)) || (name && cByName.get(norm(name)));
    if (hit) {
      if (fromSheet) {
        const current = ex.contacts.find((c) => c.id === hit.id)!;
        const changes: Change[] = [];
        const conflicts: Change[] = [];
        for (const [k, v] of Object.entries(fields)) {
          if (isEmpty(v) || !(k in current)) continue;
          const cur = (current as Record<string, unknown>)[k];
          if (same(cur, v)) continue;
          (isEmpty(cur) || o.overwrite ? changes : conflicts).push({ field: k, from: cur, to: v });
        }
        plan.contacts.push({ ...where, action: changes.length ? 'update' : 'unchanged', label: hit.name, id: hit.id, ref: `id:${hit.id}`, values: Object.fromEntries(changes.map((c) => [c.field, c.to])), changes, conflicts });
      }
      return `id:${hit.id}`;
    }
    const key = src || email || norm(name);
    let op = newContacts.get(key) ?? (email ? newContacts.get(email) : undefined) ?? newContacts.get(norm(name));
    if (op) {
      if (fromSheet) for (const [k, v] of Object.entries(fields)) if (isEmpty(op.values[k]) && !isEmpty(v)) op.values[k] = v;
      return op.ref;
    }
    op = { ...where, action: 'create', label: name || email, ref: `con:${key}`, values: { ...fields, name: name || email }, changes: [], conflicts: [] };
    newContacts.set(key, op);
    if (email) newContacts.set(email, op);
    if (name) newContacts.set(norm(name), op);
    plan.contacts.push(op);
    return op.ref;
  }

  for (const { get, where } of rowsOf('contacts')) {
    const name = get('name') || [get('first_name'), get('last_name')].filter(Boolean).join(' ') || get('company');
    if (!name && !get('email')) {
      plan.contacts.push({ ...where, action: 'skip', label: '(no name)', reason: 'no name or email', ref: '', values: {}, changes: [], conflicts: [] });
      continue;
    }
    const address = [get('address'), get('address2'), [get('postal_code'), get('region')].filter(Boolean).join(' ')].filter(Boolean).join('\n');
    contactRef({
      name, company: get('company') || null, kind: contactKind(get('kind')) ?? (get('company') && !get('first_name') ? 'gallery' : 'collector'),
      email: get('email') || null, phone: get('phone') || null, address: address || null, city: get('city') || null,
      country: get('country') || null, website: get('website') || null, notes: get('notes') || null,
      tags: list(get('tags').replace(/,/g, ';')), source_ref: get('source_ref') || null,
    }, where, true);
  }

  // --- locations sheet ---------------------------------------------------------
  for (const { get, where } of rowsOf('locations')) {
    const name = get('name');
    if (!name) continue;
    const address = [get('address'), get('city'), get('country')].filter(Boolean).join(', ') || null;
    const ref = location(name, where, { name, kind: locationKind(get('kind') || name) ?? 'storage', address, notes: get('notes') || null });
    if (ref.startsWith('id:')) plan.locations.push({ ...where, action: 'unchanged', label: name, id: ref.slice(3), ref, values: {}, changes: [], conflicts: [] });
  }

  // --- pieces --------------------------------------------------------------------
  const eBySrc = new Map(ex.exhibitions.filter((e) => e.source_ref).map((e) => [e.source_ref!, e]));
  const newEx = new Map<string, ExhibitionOp>();
  const claimed = new Map<string, Where>(); // piece id / new ref -> first row that used it
  const newInv = new Set<string>();

  // AA slugs a work as "<title>" or, when taken, "<title>-<profile>". The
  // profile is the artist's AA handle, which can differ from the Artfolio slug.
  const profiles = new Set([ex.artistSlug]);
  const sourceRefs = [...ex.pieces.map((p) => p.source_ref ?? ''), ...inputs.filter((i) => i.entity === 'pieces').flatMap(({ sheet, mapping }) => {
    const col = sheet.headers.find((h) => mapping[h] === 'source_ref');
    return col ? sheet.rows.map((r) => r[col] ?? '') : [];
  })];
  for (const ref of sourceRefs) {
    const m = ref.match(/\/profile\/([^/?#]+)\//);
    if (m) profiles.add(slugify(m[1]));
  }
  const titleSlugsOf = (title: string) => (title ? [slugify(title), ...[...profiles].map((pr) => `${slugify(title)}-${pr}`)] : []);

  function matchPiece(inv: string, slugs: string[]): { p?: ExPiece; by?: string } {
    if (inv && byInv.has(norm(inv))) return { p: byInv.get(norm(inv)), by: 'inventory number' };
    for (const s of slugs) if (s && bySlug.has(s)) return { p: bySlug.get(s), by: `slug “${s}”` };
    return {};
  }

  for (const { get, where } of rowsOf('pieces')) {
    const title = get('title');
    const inv = get('inventory_number');
    const label = [inv, title].filter(Boolean).join(' ') || '(untitled row)';
    const blank = (): PieceOp => ({ ...where, action: 'skip', label, ref: '', values: {}, changes: [], conflicts: [], collections: [], exhibitions: [], provenance: [], images: [], imagesSkipped: 0 });
    if (!title && !inv) {
      plan.pieces.push({ ...blank(), reason: 'no title or inventory number' });
      continue;
    }

    // Parse the row into piece values.
    const sourceRef = get('source_ref');
    const explicitSlug = get('slug') ? slugify(get('slug')) : '';
    const linkSlug = sourceRef ? slugify(slugFromSourceRef(sourceRef) ?? '') : '';
    const titleSlugs = titleSlugsOf(title);
    const dims = get('dimensions') ? parseDimensions(get('dimensions')) : { height: null, width: null, depth: null, unit: null };
    const fdims = get('framed_dimensions') ? parseDimensions(get('framed_dimensions')) : null;
    const unitRaw = get('dimension_unit').toLowerCase();
    const unit = unitRaw.startsWith('in') ? 'in' : unitRaw.startsWith('c') ? 'cm' : dims.unit ?? ex.unit;
    const yr = get('year') ? parseYear(get('year')) : { year: null, circa: false };
    const yearCell = get('year');
    const creationDate = /^\d{4}-\d{2}-\d{2}$/.test(yearCell) || /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(yearCell) ? parseDate(yearCell, o.dateOrder) : null;
    const statusRaw = get('status');
    const status = parseStatus(statusRaw);
    const priceRaw = get('price');
    const num = (k: string) => (get(k) ? parseNumber(get(k)) : null);
    const kindRaw = get('kind').toLowerCase();

    const values: Record<string, unknown> = {
      title: title || inv,
      inventory_number: inv || null,
      year: yr.year,
      year_circa: yr.circa,
      creation_date: creationDate,
      medium: get('medium') ? normalizeMedium(get('medium')) : null,
      subject: get('subject') || null,
      style: get('style') || null,
      height: num('height') ?? dims.height,
      width: num('width') ?? dims.width,
      depth: num('depth') ?? dims.depth,
      dimension_unit: unit,
      framed: get('framed') ? truthy(get('framed')) : fdims ? true : null,
      framed_height: fdims?.height ?? null,
      framed_width: fdims?.width ?? null,
      framed_depth: fdims?.depth ?? null,
      price: priceRaw ? parseNumber(priceRaw) : null,
      currency: get('currency').toUpperCase().slice(0, 3) || (priceRaw ? parseCurrency(priceRaw) : null) || null,
      status: status,
      description: get('description') || null,
      notes: get('notes') || null,
      signature: get('signature') || null,
      edition_size: num('edition_size'),
      kind: /edition|print|multiple/.test(kindRaw) || num('edition_size') ? 'edition' : kindRaw ? 'original' : null,
      tags: get('tags') ? get('tags').split(/[,;]/).map((t) => t.trim()).filter(Boolean) : [],
      source_ref: sourceRef || null,
    };
    if (statusRaw && !status) plan.warnings.push(`${where.sheet} row ${where.row}: unknown status “${statusRaw}”, left as is`);

    const locationName = get('location');
    const collections = list(get('collections'));
    const exhibitions = list(get('exhibitions'));
    const provenance = get('provenance') ? get('provenance').split(/\n+/).map((x) => x.trim()).filter(Boolean) : [];
    const imageUrls = [...splitImageUrls(get('image_urls')), ...splitImageUrls(get('extra_image_urls'))].filter((u, i, a) => a.indexOf(u) === i);

    // Match.
    let { p, by } = matchPiece(inv, [explicitSlug, linkSlug]);
    if (!p && !inv) {
      // Title-derived slugs only when the row has no inventory number of its own.
      const r = matchPiece('', titleSlugs);
      // Accept when the titles agree, or when the matched slug is the one AA itself
      // gave the work (its source_ref is the AA /artwork/<slug> link): the title
      // may have been corrected in Artfolio since ("White Ligth" -> "White Light").
      const aaSlug = r.p?.source_ref ? slugify(slugFromSourceRef(r.p.source_ref) ?? '') : '';
      const sameTitle = r.p && norm(r.p.title) === norm(title) && (byTitle.get(norm(title)) ?? []).length === 1;
      if (r.p && (sameTitle || (aaSlug && aaSlug === r.p.slug && titleSlugs.includes(aaSlug)))) ({ p, by } = { p: r.p, by: `${r.by} (from title)` });
    }

    const op: PieceOp = { ...blank(), action: 'create', ref: '', values: {}, location: locationName || undefined, collections, exhibitions, provenance };

    if (p) {
      const first = claimed.get(p.id);
      if (first) {
        plan.pieces.push({ ...blank(), pieceId: p.id, reason: `same piece as ${first.sheet} row ${first.row}` });
        continue;
      }
      claimed.set(p.id, where);
      op.pieceId = p.id;
      op.ref = `id:${p.id}`;
      op.matchedBy = by;
      op.label = `${p.inventory_number ?? ''} ${p.title}`.trim();

      for (const [k, v] of Object.entries(values)) {
        if (['source_ref', 'year_circa', 'kind', 'dimension_unit', 'title', 'inventory_number'].includes(k)) continue;
        if (isEmpty(v) || v === null) continue;
        const cur = (p as unknown as Record<string, unknown>)[k];
        if (k === 'framed') {
          if (v === true && !cur) op.changes.push({ field: k, from: cur, to: v });
          continue;
        }
        if (same(cur, v)) continue;
        if (k === 'status' && cur === 'available') {
          op.changes.push({ field: k, from: cur, to: v });
          continue;
        }
        (isEmpty(cur) || o.overwrite ? op.changes : op.conflicts).push({ field: k, from: cur, to: v });
      }
      if (!p.inventory_number && inv) op.changes.push({ field: 'inventory_number', from: null, to: inv });
      if (!p.source_ref && sourceRef) op.changes.push({ field: 'source_ref', from: null, to: sourceRef });
      if (op.changes.some((c) => c.field === 'year')) op.changes.push({ field: 'year_circa', from: false, to: yr.circa });
      if (op.changes.some((c) => ['height', 'width', 'depth'].includes(c.field)) && !p.height && !p.width) op.changes.push({ field: 'dimension_unit', from: null, to: unit });
      if (op.changes.some((c) => c.field === 'edition_size')) op.changes.push({ field: 'kind', from: 'original', to: 'edition' });
      // A price filled in from the file brings its currency: the old currency only
      // ever applied to a price that wasn't there.
      if (op.changes.some((c) => c.field === 'price') && values.currency && values.currency !== p.currency) {
        op.conflicts = op.conflicts.filter((c) => c.field !== 'currency');
        if (!op.changes.some((c) => c.field === 'currency')) op.changes.push({ field: 'currency', from: p.currency, to: values.currency });
      }
      op.values = Object.fromEntries(op.changes.map((c) => [c.field, c.to]));

      // Images: skip ones already imported; a piece that already has images
      // from before we tracked sources is assumed to have the main one.
      const known = new Set(p.image_sources);
      let fresh = imageUrls.filter((u) => !known.has(u));
      if (fresh.length && p.image_count > p.image_sources.length && imageUrls[0] === fresh[0]) fresh = fresh.slice(1);
      op.imagesSkipped = imageUrls.length - fresh.length;
      op.images = fresh;
    } else {
      const twins = byTitle.get(norm(title)) ?? [];
      if (twins.length && !o.createTitleMatches) {
        plan.pieces.push({
          ...blank(),
          reason: `not created: no inventory number or slug match, but “${twins[0].title}” (${twins.map((t) => t.inventory_number).join(', ')}) has the same title. Add its inventory number to the row, or allow title matches to create it.`,
        });
        continue;
      }
      if (inv && newInv.has(norm(inv))) {
        plan.pieces.push({ ...blank(), reason: `inventory number ${inv} appears twice in the file` });
        continue;
      }
      const key = inv ? `inv:${norm(inv)}` : explicitSlug || linkSlug ? `slug:${explicitSlug || linkSlug}` : `row:${where.sheet}:${where.row}`;
      if (claimed.has(key)) {
        const first = claimed.get(key)!;
        plan.pieces.push({ ...blank(), reason: `same piece as ${first.sheet} row ${first.row}` });
        continue;
      }
      claimed.set(key, where);
      if (inv) newInv.add(norm(inv));
      op.ref = `new:${key}`;
      const v: Record<string, unknown> = Object.fromEntries(Object.entries(values).filter(([, x]) => x !== null && !(Array.isArray(x) && !x.length)));
      v.title = values.title;
      v.status = values.status ?? 'available';
      v.kind = values.kind ?? 'original';
      v.framed = values.framed ?? false;
      v.is_public = get('is_public') ? truthy(get('is_public')) : o.defaultPublic;
      v.currency = values.currency ?? ex.currency;
      if (explicitSlug || linkSlug) v.slug = explicitSlug || linkSlug;
      op.values = v;
      op.images = imageUrls;
    }

    // Location: link to a location record; fill the text field when empty.
    if (locationName) {
      const lref = location(locationName, where, { name: locationName, kind: locationKind(locationName) ?? 'storage' });
      const cur = p ? ex.locations.find((l) => l.id === p!.location_id) : undefined;
      if (!p || !p.location_id) {
        op.values.location_ref = lref;
        op.changes.push({ field: 'location_id', from: null, to: locationName });
        if (p && !p.location) {
          op.values.location = locationName;
          op.changes.push({ field: 'location', from: null, to: locationName });
        }
      } else if (cur && norm(cur.name) !== norm(locationName)) {
        op.conflicts.push({ field: 'location_id', from: cur.name, to: locationName });
      }
      if (!p) op.values.location = locationName;
    }

    // Collections and exhibitions named on the piece row.
    for (const c of collections) {
      const cref = collection(c, where, { name: c, is_public: false });
      const has = cref.startsWith('id:') && p && ex.collectionPieces.some((x) => x.collection_id === cref.slice(3) && x.piece_id === p!.id);
      if (!has) {
        plan.links.push({ kind: 'collection', targetRef: cref, pieceRef: op.ref });
        op.changes.push({ field: 'collection', from: null, to: c });
      }
    }
    for (const e of exhibitions) {
      const eref = exhibitionRef(e, null, where, {});
      const has = eref.startsWith('id:') && p && ex.exhibitionPieces.some((x) => x.exhibition_id === eref.slice(3) && x.piece_id === p!.id);
      if (!has) {
        plan.links.push({ kind: 'exhibition', targetRef: eref, pieceRef: op.ref });
        op.changes.push({ field: 'exhibition', from: null, to: e });
      }
    }
    for (const line of provenance) {
      const dup = p && ex.provenance.some((x) => x.piece_id === p!.id && norm([x.date_text, x.party, x.description].filter(Boolean).join(' ')) === norm(line));
      if (!dup) {
        plan.provenance.push({ pieceRef: op.ref, description: line, label: op.label });
        op.changes.push({ field: 'provenance', from: null, to: line });
      }
    }
    if (op.images.length) op.changes.push({ field: 'images', from: p?.image_count ?? 0, to: `+${op.images.length}` });

    // A sale recorded on the piece row.
    const salePrice = get('sale_price') ? parseNumber(get('sale_price')) : null;
    const saleDate = get('sale_date') ? parseDate(get('sale_date'), o.dateOrder) : null;
    if (get('buyer') || salePrice != null || saleDate) {
      addSale(where, op.ref, p?.id, op.label, {
        sale_date: saleDate, price: salePrice, currency: values.currency ?? null,
        commission_pct: get('commission_pct') ? parseNumber(get('commission_pct')) : null, source_ref: null, notes: null, status: 'completed',
      }, { name: get('buyer'), email: get('buyer_email') }, get('sold_via'), get('invoice_number'), !status || status === 'sold');
    }

    if (op.pieceId) op.action = op.changes.length ? 'update' : 'unchanged';
    plan.pieces.push(op);
  }

  // --- exhibitions ----------------------------------------------------------------
  function exhibitionRef(title: string, start: string | null, where: Where, values: Record<string, unknown>, src?: string): string {
    const k = norm(title);
    const hit = (src && eBySrc.get(src)) || ex.exhibitions.find((e) => norm(e.title) === k && (!start || !e.start_date || e.start_date === start));
    if (hit) return `id:${hit.id}`;
    const key = `${k}|${start ?? ''}`;
    let op = newEx.get(key) ?? (start ? undefined : [...newEx.entries()].find(([kk]) => kk.startsWith(`${k}|`))?.[1]);
    if (!op) {
      op = { ...where, action: 'create', label: title, ref: `exh:${key}`, values: { title, ...values }, changes: [], conflicts: [], pieceRefs: [] };
      newEx.set(key, op);
      plan.exhibitions.push(op);
    } else {
      for (const [kk, v] of Object.entries(values)) if (isEmpty(op.values[kk]) && !isEmpty(v)) op.values[kk] = v;
    }
    return op.ref;
  }

  function pieceRefFor(inv: string, title: string): { ref?: string; id?: string; label: string } {
    const planned = plan.pieces.find((op) => op.action !== 'skip' && ((inv && norm(String(op.values.inventory_number ?? '')) === norm(inv)) || (inv && op.pieceId && norm(ex.pieces.find((x) => x.id === op.pieceId)?.inventory_number) === norm(inv))));
    if (planned) return { ref: planned.ref, id: planned.pieceId, label: planned.label };
    const { p } = matchPiece(inv, titleSlugsOf(title));
    if (p) return { ref: `id:${p.id}`, id: p.id, label: `${p.inventory_number ?? ''} ${p.title}`.trim() };
    const twins = title ? byTitle.get(norm(title)) ?? [] : [];
    if (twins.length === 1) return { ref: `id:${twins[0].id}`, id: twins[0].id, label: `${twins[0].inventory_number ?? ''} ${twins[0].title}`.trim() };
    const plannedByTitle = plan.pieces.filter((op) => op.action === 'create' && title && norm(String(op.values.title)) === norm(title));
    if (plannedByTitle.length === 1) return { ref: plannedByTitle[0].ref, label: plannedByTitle[0].label };
    return { label: [inv, title].filter(Boolean).join(' ') };
  }

  for (const { get, where } of rowsOf('exhibitions')) {
    const title = get('title');
    if (!title) continue;
    const start = parseDate(get('start_date'), o.dateOrder);
    const values = {
      kind: exhibitionKind(get('kind')) ?? 'group', venue: get('venue') || null, city: get('city') || null, country: get('country') || null,
      start_date: start, end_date: parseDate(get('end_date'), o.dateOrder), url: get('url') || null, description: get('description') || null,
      is_public: get('is_public') ? truthy(get('is_public')) : false, source_ref: get('source_ref') || null,
    };
    const ref = exhibitionRef(title, start, where, values, get('source_ref') || undefined);
    if (ref.startsWith('id:')) plan.exhibitions.push({ ...where, action: 'unchanged', label: title, id: ref.slice(3), ref, values: {}, changes: [], conflicts: [], pieceRefs: [] });
    for (const item of list(get('pieces').replace(/,(?=\s*[A-Z]{1,4}-?\d)/g, ';'))) {
      const looksInv = /^[A-Z]{0,5}-?\d+$/i.test(item);
      const r = pieceRefFor(looksInv ? item : '', looksInv ? '' : item);
      if (!r.ref) {
        plan.warnings.push(`${where.sheet} row ${where.row}: exhibition “${title}” lists “${item}”, which matches no piece`);
        continue;
      }
      const has = ref.startsWith('id:') && r.id && ex.exhibitionPieces.some((x) => x.exhibition_id === ref.slice(3) && x.piece_id === r.id);
      if (!has && !plan.links.some((l) => l.kind === 'exhibition' && l.targetRef === ref && l.pieceRef === r.ref)) {
        plan.links.push({ kind: 'exhibition', targetRef: ref, pieceRef: r.ref });
      }
    }
  }

  // --- sales -----------------------------------------------------------------------
  function addSale(
    where: Where, pieceRef: string | undefined, pieceId: string | undefined, label: string,
    values: Record<string, unknown>, buyer: { name: string; email: string }, via: string, invoiceNo: string, markSold: boolean,
  ) {
    const base: SaleOp = { ...where, action: 'create', label, ref: '', values, changes: [], conflicts: [], markSold };
    if (!pieceRef) {
      plan.sales.push({ ...base, action: 'skip', reason: 'the piece is not in Artfolio and not in this import' });
      return;
    }
    const src = values.source_ref as string | null;
    const dup = ex.sales.find((s) =>
      (src && s.source_ref === src) ||
      (pieceId && s.piece_id === pieceId && (s.sale_date ?? null) === (values.sale_date ?? null) && (s.price == null || values.price == null || Number(s.price) === Number(values.price))));
    if (dup) {
      plan.sales.push({ ...base, action: 'unchanged', id: dup.id, ref: `id:${dup.id}` });
      return;
    }
    const twin = plan.sales.find((s) => s.action === 'create' && s.pieceRef === pieceRef && s.values.sale_date === values.sale_date && s.values.price === values.price);
    if (twin) {
      plan.sales.push({ ...base, action: 'skip', reason: `same sale as ${twin.sheet} row ${twin.row}` });
      return;
    }
    base.ref = `sale:${where.sheet}:${where.row}`;
    base.pieceRef = pieceRef;
    base.buyerRef = contactRef({ name: buyer.name, email: buyer.email || null, kind: 'collector' }, where, false);
    base.viaRef = via ? contactRef({ name: via, kind: 'gallery' }, where, false) : undefined;
    base.invoiceRef = invoiceNo ? invoice(invoiceNo, where, { number: invoiceNo, status: 'paid', issue_date: values.sale_date ?? null, currency: values.currency ?? null }) : undefined;
    plan.sales.push(base);
  }

  for (const { get, where } of rowsOf('sales')) {
    const r = pieceRefFor(get('inventory_number'), get('title'));
    addSale(where, r.ref, r.id, r.label, {
      sale_date: parseDate(get('sale_date'), o.dateOrder),
      price: get('price') ? parseNumber(get('price')) : null,
      currency: get('currency').toUpperCase().slice(0, 3) || parseCurrency(get('price')) || null,
      commission_pct: get('commission_pct') ? parseNumber(get('commission_pct')) : null,
      tax_amount: get('tax_amount') ? parseNumber(get('tax_amount')) : null,
      status: /pend|unpaid|due/i.test(get('status')) ? 'pending' : /cancel|void|refund/i.test(get('status')) ? 'cancelled' : 'completed',
      notes: get('notes') || null,
      source_ref: get('source_ref') || null,
    }, { name: get('buyer'), email: get('buyer_email') }, get('via'), get('invoice_number'), true);
  }

  // A sale marks its piece sold when the piece is still "available".
  for (const s of plan.sales) {
    if (s.action !== 'create' || !s.markSold || s.values.status === 'cancelled') continue;
    const op = plan.pieces.find((p) => p.ref === s.pieceRef && p.action !== 'skip');
    const exp = s.pieceRef?.startsWith('id:') ? ex.pieces.find((p) => p.id === s.pieceRef!.slice(3)) : undefined;
    const current = op ? (op.values.status as string | undefined) ?? exp?.status : exp?.status;
    if (current && current !== 'available') continue;
    if (op) {
      op.values.status = 'sold';
      op.changes = op.changes.filter((c) => c.field !== 'status');
      op.changes.push({ field: 'status', from: exp?.status ?? null, to: 'sold' });
      if (op.action === 'unchanged') op.action = 'update';
    } else if (exp) {
      plan.pieces.push({ ...s, action: 'update', label: s.label, pieceId: exp.id, ref: `id:${exp.id}`, matchedBy: 'sale', values: { status: 'sold' }, changes: [{ field: 'status', from: exp.status, to: 'sold' }], conflicts: [], collections: [], exhibitions: [], provenance: [], images: [], imagesSkipped: 0, reason: 'marked sold by a sale row' });
    }
  }

  return plan;
}

/** Counts per area and action, for the summary line and the import log. */
export function summarize(plan: Plan) {
  const count = (ops: { action: Action }[]) => {
    const c = { create: 0, update: 0, unchanged: 0, skip: 0 };
    for (const op of ops) c[op.action]++;
    return c;
  };
  return {
    pieces: count(plan.pieces),
    locations: count(plan.locations),
    contacts: count(plan.contacts),
    invoices: count(plan.invoices),
    sales: count(plan.sales),
    exhibitions: count(plan.exhibitions),
    collections: count(plan.collections),
    links: plan.links.length,
    provenance: plan.provenance.length,
    images: plan.pieces.reduce((n, p) => n + p.images.length, 0),
    conflicts: plan.pieces.reduce((n, p) => n + p.conflicts.length, 0) + plan.contacts.reduce((n, p) => n + p.conflicts.length, 0),
    unmapped: plan.unmapped.length,
    warnings: plan.warnings.length,
  };
}

/** True when applying the plan would write nothing. */
export function isNoop(plan: Plan): boolean {
  const s = summarize(plan);
  return (['pieces', 'locations', 'contacts', 'invoices', 'sales', 'exhibitions', 'collections'] as const).every((k) => s[k].create === 0 && s[k].update === 0) && s.links === 0 && s.provenance === 0 && s.images === 0;
}
