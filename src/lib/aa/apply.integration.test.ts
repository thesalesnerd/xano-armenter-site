// Runs the importer end to end against the local Supabase stack:
// plan -> apply -> plan again must be a no-op. Skipped unless
// AA_IMPORT_IT=1 (needs `npx supabase start`).
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { autoMapFields, classifySheet } from './fields';
import { parseCsvText } from './sheets';
import { buildPlan, isNoop, summarize } from './plan';
import { applyPlan, loadExisting } from './apply';

const enabled = process.env.AA_IMPORT_IT === '1';

describe.skipIf(!enabled)('AA import against the local database', () => {
  it('is idempotent and only fills empty fields', async () => {
    const env = Object.fromEntries(
      execSync('npx supabase status -o env', { encoding: 'utf8' })
        .split('\n').filter((l) => l.includes('='))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
    );
    const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const run = Date.now().toString(36);
    const email = `importer-${run}@example.test`;
    const { data: u } = await admin.auth.admin.createUser({ email, password: 'test-password-123', email_confirm: true });
    const db = createClient<Database>(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
    await db.auth.signInWithPassword({ email, password: 'test-password-123' });

    const { data: artist } = await db.from('artists').insert({ slug: `imp-${run}`, name: 'Importer', inventory_prefix: 'XA-', currency: 'USD', created_by: u.user!.id }).select().single();
    const { data: street } = await db.from('pieces').insert({ artist_id: artist!.id, title: 'Street walkby', inventory_number: 'XA-0011', slug: 'street-walkby', is_public: true, price: 1200 }).select().single();

    const files = [
      parseCsvText('Pieces.csv', [
        'Inventory Number,Piece Name,Public URL,Medium,Current Location,Status,Price,Exhibitions,Collections',
        ',Street walkby,https://www.artworkarchive.com/profile/x/artwork/street-walkby,Acrylic on canvas,Camp 3,Available,1500,Ultramar,Selected',
        'XA-0200,Brand new work,,Oil on linen,Camp 3,Available,900,,',
      ].join('\n'))!,
      parseCsvText('Contacts.csv', 'Contact ID,Company,Email,Contact Type\nc1,KBH Fine Arts Gallery,info@kbh.example,Gallery\nc2,,ana@example.com,Collector')!,
      parseCsvText('Sales.csv', 'Inventory Number,Sale Date,Sale Price,Buyer,Buyer Email,Gallery,Invoice\nXA-0200,2025-06-15,900,Ana Puig,ana@example.com,KBH Fine Arts Gallery,1001')!,
    ];
    const inputs = files.map((sheet) => {
      const entity = classifySheet(sheet.name, sheet.headers);
      return { sheet, entity, mapping: autoMapFields(entity, sheet.headers) };
    });

    const first = buildPlan(inputs, await loadExisting(db, artist!));
    expect(summarize(first).pieces).toMatchObject({ create: 1, update: 1 });
    const res = await applyPlan(db, artist!.id, first);
    expect(res.errors).toEqual([]);

    const { data: s2 } = await db.from('pieces').select('price, medium, location, location_id, status, is_public').eq('id', street!.id).single();
    expect(s2).toMatchObject({ price: 1200, medium: 'Acrylic on canvas', location: 'Camp 3', status: 'available', is_public: true });
    expect(s2!.location_id).toBeTruthy();
    const { data: created } = await db.from('pieces').select('id, status, is_public, location_id').eq('artist_id', artist!.id).eq('inventory_number', 'XA-0200').single();
    expect(created).toMatchObject({ status: 'sold', is_public: false, location_id: s2!.location_id });
    const { data: sales } = await db.from('sales').select('price, buyer_contact_id, via_contact_id, invoice_id').eq('piece_id', created!.id);
    expect(sales).toHaveLength(1);
    expect(sales![0].buyer_contact_id && sales![0].via_contact_id && sales![0].invoice_id).toBeTruthy();
    const { count: contacts } = await db.from('contacts').select('*', { count: 'exact', head: true }).eq('artist_id', artist!.id);
    expect(contacts).toBe(2); // KBH and Ana, matched across the contacts and sales sheets
    const { count: ex } = await db.from('exhibition_pieces').select('*', { count: 'exact', head: true }).eq('artist_id', artist!.id);
    expect(ex).toBe(1);

    const second = buildPlan(inputs, await loadExisting(db, artist!));
    expect(isNoop(second)).toBe(true);
    expect(second.pieces.find((p) => p.pieceId === street!.id)!.conflicts).toEqual([{ field: 'price', from: 1200, to: 1500 }]);

    const { count: runs } = await db.from('import_runs').select('*', { count: 'exact', head: true }).eq('artist_id', artist!.id);
    expect(runs).toBe(1);
  }, 60_000);
});
