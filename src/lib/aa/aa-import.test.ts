import { describe, expect, it } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';
import { autoMapFields, classifySheet, type Entity } from './fields';
import { cellText, parseCsvText, readSpreadsheet, type Sheet } from './sheets';
import { buildPlan, isNoop, normalizeMedium, parseDate, slugify, summarize, type ExPiece, type Existing, type SheetInput } from './plan';

// ---------------------------------------------------------------------------
// Fixtures shaped like Xano's real data
// ---------------------------------------------------------------------------
const piece = (over: Partial<ExPiece>): ExPiece => ({
  id: crypto.randomUUID(), inventory_number: null, slug: 'x', title: 'X', status: 'available',
  year: null, medium: null, subject: null, style: null, height: null, width: null, depth: null,
  framed_height: null, framed_width: null, framed_depth: null, framed: false, price: null, currency: 'USD',
  description: null, notes: null, signature: null, edition_size: null, tags: [], location: null, location_id: null,
  source_ref: null, creation_date: null, image_count: 1, image_sources: [], ...over,
});

function existing(): Existing {
  return {
    artistSlug: 'xano-armenter', currency: 'USD', unit: 'cm',
    pieces: [
      piece({ id: 'p-street', inventory_number: 'XA-0011', slug: 'street-walkby', title: 'Street walkby', year: 2019, medium: 'Acrylic on canvas', height: 100, width: 81 }),
      piece({ id: 'p-poema', inventory_number: 'XA-0008', slug: 'a-un-poema-de-rossend-bonas-serie-de-4-piezas', title: 'A un poema de Rossend Bonas (serie de 4 piezas)' }),
      piece({ id: 'p-wave', inventory_number: 'XA-0007', slug: 'wave-xano-armenter', title: 'Wave', price: 1200 }),
      piece({ id: 'p-beach', inventory_number: 'XA-0021', slug: 'beach-xano-armenter', title: 'Beach' }),
      piece({ id: 'p-dish', inventory_number: 'XA-0081', slug: 'dirty-dishes-xano-armenter', title: 'Dirty dishes' }),
      piece({ id: 'p-dish2', inventory_number: 'XA-0093', slug: 'dirty-dishes', title: 'Dirty dishes', image_count: 0 }),
    ],
    locations: [], contacts: [], invoices: [], sales: [], exhibitions: [], exhibitionPieces: [], collections: [{ id: 'c-sel', name: 'Selected' }],
    collectionPieces: [], provenance: [],
  };
}

const sheet = (name: string, rows: Record<string, string>[]): Sheet => ({ name, headers: Object.keys(rows[0]), rows });
const input = (s: Sheet, entity?: Entity): SheetInput => {
  const e = entity ?? classifySheet(s.name, s.headers);
  return { sheet: s, entity: e, mapping: autoMapFields(e, s.headers) };
};

// What an AA "Pieces" export row looks like (columns as AA labels them).
const aaPieces = sheet('pieces.csv', [
  { 'Inventory Number': '', 'Piece Name': 'Street walkby', 'Public URL': 'https://www.artworkarchive.com/profile/xano-armenter/artwork/street-walkby', Medium: 'Acrylic on canvas', Height: '100', Width: '81', 'Current Location': 'Camp 3', Status: 'Available', Price: '', 'Additional Images': '', Notes: '' },
  { 'Inventory Number': '', 'Piece Name': 'A un poema de Rossend Bonas (serie de 4 piezas).', 'Public URL': 'https://www.artworkarchive.com/profile/xano-armenter/artwork/a-un-poema-de-rossend-bonas-serie-de-4-piezas', Medium: 'Mixed media', Height: '', Width: '', 'Current Location': '', Status: 'Sold', Price: '$5,000', 'Additional Images': '', Notes: 'Ask KBH about the frame' },
  { 'Inventory Number': '', 'Piece Name': 'Wave', 'Public URL': 'https://www.artworkarchive.com/profile/xano-armenter/artwork/wave-xano-armenter', Medium: '', Height: '', Width: '', 'Current Location': 'At My Studio', Status: 'Available', Price: '1500', 'Additional Images': 'https://img.aa/wave-1.jpg https://img.aa/wave-detail.jpg', Notes: '' },
  { 'Inventory Number': '', 'Piece Name': 'Dirty dishes', 'Public URL': '', Medium: '', Height: '', Width: '', 'Current Location': '', Status: '', Price: '', 'Additional Images': '', Notes: '' },
  { 'Inventory Number': '', 'Piece Name': 'Brand new work', 'Public URL': 'https://www.artworkarchive.com/profile/xano-armenter/artwork/brand-new-work', Medium: 'Oil on linen', Height: '50', Width: '40', 'Current Location': 'Camp 3', Status: 'Available', Price: '900', 'Additional Images': '', Notes: '' },
]);

// ---------------------------------------------------------------------------
describe('column mapping', () => {
  it('maps AA column names', () => {
    const m = autoMapFields('pieces', aaPieces.headers);
    expect(m).toMatchObject({ 'Piece Name': 'title', 'Public URL': 'source_ref', 'Current Location': 'location', 'Additional Images': 'extra_image_urls', 'Inventory Number': 'inventory_number' });
  });
  it('classifies sheets by name, then by headers', () => {
    expect(classifySheet('AA Contacts.xlsx', ['Name'])).toBe('contacts');
    expect(classifySheet('export.csv', ['First Name', 'Last Name', 'Email'])).toBe('contacts');
    expect(classifySheet('export.csv', ['Exhibition Title', 'Venue', 'Start Date'])).toBe('exhibitions');
    expect(classifySheet('export.csv', ['Piece Name', 'Medium'])).toBe('pieces');
    expect(classifySheet('Sales.csv', ['Piece', 'Buyer'])).toBe('sales');
  });
  it('maps contact names split in two columns', () => {
    const m = autoMapFields('contacts', ['First Name', 'Last Name', 'Email Address', 'Zip']);
    expect(m).toEqual({ 'First Name': 'first_name', 'Last Name': 'last_name', 'Email Address': 'email', Zip: 'postal_code' });
  });
});

describe('reading files', () => {
  it('reads CSV with a BOM and duplicate headers', () => {
    const s = parseCsvText('a.csv', '﻿Title,Notes,Notes\nWave,a,b\n\n')!;
    expect(s.headers).toEqual(['Title', 'Notes', 'Notes (2)']);
    expect(s.rows).toEqual([{ Title: 'Wave', Notes: 'a', 'Notes (2)': 'b' }]);
  });
  it('reads XLSX workbooks, one sheet per tab, dates as ISO', async () => {
    const buf = (await writeXlsxFile([
      { sheet: 'Pieces', data: [[{ value: 'Piece Name' }, { value: 'Sold Date' }, { value: 'Price' }], [{ value: 'Wave' }, { value: new Date(Date.UTC(2024, 4, 3)), format: 'yyyy-mm-dd' }, { value: 1500 }]] },
      { sheet: 'Contacts', data: [[{ value: 'Name' }, { value: 'Email' }], [{ value: 'KBH Fine Arts Gallery' }, { value: 'info@kbh.example' }]] },
    ] as never).toBuffer()) as Buffer;
    const file = { name: 'aa-export.xlsx', arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, text: async () => '' };
    const sheets = await readSpreadsheet(file);
    expect(sheets.map((s) => s.name)).toEqual(['aa-export.xlsx › Pieces', 'aa-export.xlsx › Contacts']);
    expect(sheets[0].rows[0]).toEqual({ 'Piece Name': 'Wave', 'Sold Date': '2024-05-03', Price: '1500' });
    expect(classifySheet(sheets[1].name, sheets[1].headers)).toBe('contacts');
  });
  it('turns cells into text', () => {
    expect(cellText(12.5)).toBe('12.5');
    expect(cellText(true)).toBe('yes');
    expect(cellText(null)).toBe('');
  });
});

describe('parsers', () => {
  it('reads dates, US order by default', () => {
    expect(parseDate('3/4/2021')).toBe('2021-03-04');
    expect(parseDate('3/4/2021', 'dmy')).toBe('2021-04-03');
    expect(parseDate('25/12/2020')).toBe('2020-12-25');
    expect(parseDate('2019')).toBe('2019-01-01');
    expect(parseDate('May 3, 2021')).toBe('2021-05-03');
    expect(parseDate('nonsense')).toBeNull();
  });
  it('translates AA media the way Artfolio stores them', () => {
    expect(['Acrilico sobre tela', 'Acrilico sobre telal', 'Acrilico sobre telaL', 'Acrílico sobre lienzo'].map(normalizeMedium)).toEqual(Array(4).fill('Acrylic on canvas'));
    expect(normalizeMedium('Oleo sobre tela')).toBe('Oil on canvas');
    expect(normalizeMedium('Acrylic On Paper')).toBe('Acrylic on paper');
    expect(normalizeMedium('iPad print')).toBe('iPad print');
  });

  it('slugs like AA', () => {
    expect(slugify('Luz blanca /White Ligth')).toBe('luz-blanca-white-ligth');
    expect(slugify("Jerry's Lab")).toBe('jerry-s-lab');
  });
});

describe('dry-run plan for pieces', () => {
  const plan = buildPlan([input(aaPieces)], existing());
  const op = (title: string) => plan.pieces.find((p) => p.label.includes(title))!;

  it('matches existing pieces by the slug in the AA link', () => {
    expect(op('Street walkby')).toMatchObject({ action: 'update', pieceId: 'p-street', matchedBy: 'slug “street-walkby”' });
    expect(op('Wave')).toMatchObject({ pieceId: 'p-wave' });
  });

  it('fills the missing location and links it to a new location record', () => {
    const s = op('Street walkby');
    expect(s.changes.map((c) => c.field)).toEqual(['source_ref', 'location_id', 'location']);
    expect(s.values).toMatchObject({ location: 'Camp 3', location_ref: 'loc:camp 3' });
    expect(plan.locations.map((l) => l.label)).toEqual(['Camp 3', 'At My Studio']);
  });

  it('fills the missing price, and marks a sold work sold', () => {
    const p = op('Rossend');
    expect(p.values).toMatchObject({ price: 5000, status: 'sold', notes: 'Ask KBH about the frame', medium: 'Mixed media' });
  });

  it('never overwrites a different existing value; reports it as a conflict', () => {
    const w = op('Wave');
    expect(w.values.price).toBeUndefined();
    expect(w.conflicts).toEqual([{ field: 'price', from: 1200, to: 1500 }]);
  });

  it('overwrites only when asked', () => {
    const p2 = buildPlan([input(aaPieces)], existing(), { overwrite: true });
    expect(p2.pieces.find((p) => p.pieceId === 'p-wave')!.values.price).toBe(1500);
  });

  it('skips the main image of a piece that already has one, adds the extras', () => {
    const w = op('Wave');
    expect(w.images).toEqual(['https://img.aa/wave-detail.jpg']);
    expect(w.imagesSkipped).toBe(1);
  });

  it('does not create a same-titled piece without an inventory number or slug match', () => {
    const d = op('Dirty dishes');
    expect(d.action).toBe('skip');
    expect(d.reason).toMatch(/same title/);
  });

  it('creates genuinely new pieces, private by default', () => {
    const n = op('Brand new work');
    expect(n.action).toBe('create');
    expect(n.values).toMatchObject({ title: 'Brand new work', slug: 'brand-new-work', is_public: false, price: 900, currency: 'USD', height: 50, location: 'Camp 3' });
  });

  it('summarizes', () => {
    expect(summarize(plan).pieces).toEqual({ create: 1, update: 3, unchanged: 0, skip: 1 });
  });

  it('never changes visibility or slug of an existing piece', () => {
    const rows = [{ 'Inventory Number': 'XA-0021', 'Piece Name': 'Beach', Public: 'yes', Slug: 'new-beach' }];
    const p = buildPlan([input(sheet('p.csv', rows), 'pieces')], existing());
    expect(p.pieces[0]).toMatchObject({ pieceId: 'p-beach', action: 'unchanged' });
  });

  it('matches by inventory number before slug, and flags a row used twice', () => {
    const rows = [
      { 'Inventory Number': 'XA-0011', 'Piece Name': 'Street walkby', Year: '2019' },
      { 'Inventory Number': '', 'Piece Name': 'Street walkby', Year: '2019' },
    ];
    const p = buildPlan([input(sheet('p.csv', rows), 'pieces')], existing());
    expect(p.pieces[0]).toMatchObject({ pieceId: 'p-street', matchedBy: 'inventory number', action: 'unchanged' });
    expect(p.pieces[1]).toMatchObject({ action: 'skip', reason: 'same piece as p.csv row 2' });
  });

  it('matches title slugs with the AA profile suffix even when the Artfolio slug differs', () => {
    const ex = { ...existing(), artistSlug: 'xano' };
    const rows = [
      { 'Piece Name': 'Wave', 'Public URL': '' },
      { 'Piece Name': 'Other', 'Public URL': 'https://www.artworkarchive.com/profile/xano-armenter/artwork/other' },
    ];
    const p = buildPlan([input(sheet('p.csv', rows), 'pieces')], ex);
    expect(p.pieces[0]).toMatchObject({ pieceId: 'p-wave', matchedBy: 'slug “wave-xano-armenter” (from title)' });
  });

  it('matches a title that was corrected in Artfolio through the slug AA gave it', () => {
    const ex = existing();
    ex.pieces.push(piece({ id: 'p-luz', inventory_number: 'XA-0042', slug: 'luz-blanca-white-ligth', title: 'Luz blanca / White Light', source_ref: 'https://www.artworkarchive.com/profile/xano-armenter/artwork/luz-blanca-white-ligth' }));
    const p = buildPlan([input(sheet('p.csv', [{ 'Piece Name': 'Luz blanca /White Ligth', Medium: 'x' }]), 'pieces')], ex);
    expect(p.pieces[0]).toMatchObject({ pieceId: 'p-luz' });
  });

  it('a filled-in price brings its currency', () => {
    const ex = existing();
    ex.pieces.find((x) => x.id === 'p-street')!.currency = 'EUR';
    const p = buildPlan([input(sheet('p.csv', [{ 'Inventory Number': 'XA-0011', 'Piece Name': 'Street walkby', Price: '$1,000' }]), 'pieces')], ex);
    expect(p.pieces[0].values).toMatchObject({ price: 1000, currency: 'USD' });
    expect(p.pieces[0].conflicts).toEqual([]);
  });

  it('reports columns it did not import, with how many cells had data', () => {
    const rows = [{ 'Piece Name': 'Wave', 'Insurance Value': '2000', Blank: '' }];
    const p = buildPlan([input(sheet('p.csv', rows), 'pieces')], existing());
    expect(p.unmapped).toEqual([{ sheet: 'p.csv', column: 'Insurance Value', filled: 1, sample: '2000' }]);
  });
});

describe('contacts, sales, exhibitions', () => {
  const contacts = sheet('Contacts.csv', [
    { 'Contact ID': 'c1', 'First Name': '', 'Last Name': '', Company: 'KBH Fine Arts Gallery', Email: 'info@kbh.example', 'Contact Type': 'Gallery' },
    { 'Contact ID': 'c2', 'First Name': 'Ana', 'Last Name': 'Puig', Company: '', Email: 'ana@example.com', 'Contact Type': 'Collector' },
  ]);
  const sales = sheet('Sales.csv', [
    { 'Inventory Number': 'XA-0011', Piece: '', 'Sale Date': '06/15/2025', 'Sale Price': '3,500', Buyer: 'Ana Puig', Gallery: 'KBH Fine Arts Gallery', Commission: '40', Invoice: '1001' },
    { 'Inventory Number': '', Piece: 'Ghost piece', 'Sale Date': '06/15/2025', 'Sale Price': '100', Buyer: 'Nobody', Gallery: '', Commission: '', Invoice: '' },
  ]);
  const exhibitions = sheet('Exhibitions.csv', [
    { 'Exhibition Title': 'Ultramar', Venue: 'KBH Fine Arts Gallery', City: 'Barcelona', 'Start Date': '2024-03-01', 'End Date': '2024-04-01', Pieces: 'XA-0011; XA-0007' },
  ]);
  const plan = buildPlan([input(contacts), input(sales), input(exhibitions)], existing());

  it('creates contacts once, matching sale buyers and galleries to them', () => {
    expect(plan.contacts.filter((c) => c.action === 'create').map((c) => c.label)).toEqual(['KBH Fine Arts Gallery', 'Ana Puig']);
    const kbh = plan.contacts[0];
    expect(kbh.values).toMatchObject({ kind: 'gallery', email: 'info@kbh.example', source_ref: 'c1' });
    const sale = plan.sales[0];
    expect(sale).toMatchObject({ action: 'create', pieceRef: 'id:p-street', buyerRef: plan.contacts[1].ref, viaRef: kbh.ref });
    expect(sale.values).toMatchObject({ sale_date: '2025-06-15', price: 3500, commission_pct: 40 });
  });

  it('creates the invoice and marks the piece sold', () => {
    expect(plan.invoices.map((i) => i.label)).toEqual(['1001']);
    const street = plan.pieces.find((p) => p.pieceId === 'p-street')!;
    expect(street.changes).toEqual([{ field: 'status', from: 'available', to: 'sold' }]);
  });

  it('skips a sale whose piece is unknown', () => {
    expect(plan.sales[1]).toMatchObject({ action: 'skip' });
  });

  it('creates the exhibition and links its pieces', () => {
    expect(plan.exhibitions[0]).toMatchObject({ action: 'create', label: 'Ultramar' });
    expect(plan.exhibitions[0].values).toMatchObject({ venue: 'KBH Fine Arts Gallery', start_date: '2024-03-01', end_date: '2024-04-01', is_public: false });
    expect(plan.links.filter((l) => l.kind === 'exhibition').map((l) => l.pieceRef)).toEqual(['id:p-street', 'id:p-wave']);
  });
});

describe('idempotency', () => {
  it('a second run over the data the first run wrote plans nothing', () => {
    const contacts = sheet('Contacts.csv', [{ 'Contact ID': 'c2', Name: 'Ana Puig', Email: 'ana@example.com' }]);
    const sales = sheet('Sales.csv', [{ 'Inventory Number': 'XA-0011', 'Sale Date': '2025-06-15', 'Sale Price': '3500', Buyer: 'Ana Puig' }]);
    const exhibitions = sheet('Exhibitions.csv', [{ 'Exhibition Title': 'Ultramar', 'Start Date': '2024-03-01', Pieces: 'XA-0011' }]);
    const first = buildPlan([input(aaPieces), input(contacts), input(sales), input(exhibitions)], existing());
    expect(isNoop(first)).toBe(false);

    // Simulate what applyPlan wrote.
    const ex = existing();
    for (const op of first.pieces) {
      if (op.action === 'update') Object.assign(ex.pieces.find((p) => p.id === op.pieceId)!, op.values, op.values.location_ref ? { location_id: 'l-' + op.values.location_ref } : {});
      if (op.action === 'create') ex.pieces.push(piece({ ...(op.values as Partial<ExPiece>), id: 'new-1', slug: 'brand-new-work', location_id: 'l-loc:camp 3', image_count: 0 }));
      for (const url of op.images) {
        const p = ex.pieces.find((x) => x.id === (op.pieceId ?? 'new-1'))!;
        p.image_sources.push(url);
        p.image_count++;
      }
    }
    ex.locations = first.locations.map((l) => ({ id: 'l-' + l.ref, name: l.label }));
    for (const p of ex.pieces) if (p.location_id) p.location_id = p.location_id.replace(/^l-/, 'l-');
    ex.contacts = first.contacts.map((c) => ({ id: 'k-' + c.ref, name: String(c.values.name), email: (c.values.email as string) ?? null, source_ref: (c.values.source_ref as string) ?? null, company: null }));
    ex.sales = first.sales.filter((s) => s.action === 'create').map((s) => ({ id: 's1', piece_id: s.pieceRef!.slice(3), sale_date: s.values.sale_date as string, price: s.values.price as number, source_ref: null }));
    ex.exhibitions = first.exhibitions.map((e) => ({ id: 'e-' + e.ref, title: e.label, start_date: (e.values.start_date as string) ?? null, source_ref: null }));
    ex.exhibitionPieces = first.links.filter((l) => l.kind === 'exhibition').map((l) => ({ exhibition_id: 'e-' + l.targetRef, piece_id: l.pieceRef.slice(3) }));

    const second = buildPlan([input(aaPieces), input(contacts), input(sales), input(exhibitions)], ex);
    const writes = second.pieces.filter((p) => p.action === 'create' || p.action === 'update');
    expect(writes).toEqual([]);
    expect(isNoop(second)).toBe(true);
    // The price conflict is still reported, but nothing is written.
    expect(second.pieces.find((p) => p.pieceId === 'p-wave')!.conflicts).toHaveLength(1);
  });
});
