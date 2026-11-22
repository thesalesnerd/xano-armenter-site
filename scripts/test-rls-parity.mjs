// Access-rule tests for the Artwork Archive parity tables
// (supabase/migrations/20261122000000_aa_parity.sql).
// Runs against the local Supabase stack. Usage: npm run test:rls:parity
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const env = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8' })
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    }),
);
const { API_URL: URL, ANON_KEY: ANON, SERVICE_ROLE_KEY: SERVICE } = env;

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : '  -> ' + JSON.stringify(detail)}`);
  if (!ok) failures++;
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const run = Date.now().toString(36);

async function userClient(label) {
  const email = `${label}-${run}@example.test`;
  const password = 'test-password-123';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { c, email, id: data.user.id };
}

const owner = await userClient('owner');
const editor = await userClient('editor');
const viewer = await userClient('viewer');
const stranger = await userClient('stranger');
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

const { data: art } = await owner.c
  .from('artists')
  .insert({ slug: `par-${run}`, name: 'Parity', created_by: owner.id, public_profile: true })
  .select()
  .single();
await owner.c.rpc('add_member_by_email', { p_artist_id: art.id, p_email: editor.email, p_role: 'editor' });
await owner.c.rpc('add_member_by_email', { p_artist_id: art.id, p_email: viewer.email, p_role: 'viewer' });

const { data: other } = await stranger.c
  .from('artists')
  .insert({ slug: `oth-${run}`, name: 'Other', created_by: stranger.id })
  .select()
  .single();

const { data: piece } = await owner.c
  .from('pieces')
  .insert({ artist_id: art.id, title: 'Public piece', is_public: true })
  .select()
  .single();
const { data: otherPiece } = await stranger.c.from('pieces').insert({ artist_id: other.id, title: 'Theirs' }).select().single();

// --- locations: members read, editors write ---------------------------------
const { data: loc, error: locErr } = await editor.c.from('locations').insert({ artist_id: art.id, name: 'Camp 3' }).select().single();
check('editor creates a location', !locErr && loc, locErr);
const { data: vLoc } = await viewer.c.from('locations').select('id').eq('artist_id', art.id);
check('viewer reads locations', vLoc?.length === 1, vLoc);
const { error: vLocIns } = await viewer.c.from('locations').insert({ artist_id: art.id, name: 'Nope' });
check("viewer can't create locations", !!vLocIns);
const { data: sLoc } = await stranger.c.from('locations').select('id').eq('artist_id', art.id);
check("stranger can't read locations", sLoc?.length === 0, sLoc);
const { error: linkErr } = await editor.c.from('pieces').update({ location_id: loc.id }).eq('id', piece.id);
check('editor links a piece to a location', !linkErr, linkErr);
const { data: sLocRow } = await stranger.c.from('locations').insert({ artist_id: other.id, name: 'Elsewhere' }).select().single();
const { error: crossLoc } = await stranger.c.from('pieces').update({ location_id: loc.id }).eq('id', otherPiece.id);
check("a piece can't point at another artist's location", !!crossLoc);
const { error: crossLoc2 } = await owner.c.from('pieces').update({ location_id: sLocRow.id }).eq('id', piece.id);
check("owner can't link to a stranger's location", !!crossLoc2);

// --- contacts / sales / invoices: owner only ---------------------------------
const { data: contact, error: cErr } = await owner.c
  .from('contacts')
  .insert({ artist_id: art.id, name: 'KBH Fine Arts Gallery', kind: 'gallery', represents_artist: true })
  .select()
  .single();
check('owner creates a contact', !cErr && contact, cErr);
for (const [who, u] of [['editor', editor], ['viewer', viewer], ['stranger', stranger]]) {
  const { data } = await u.c.from('contacts').select('id').eq('artist_id', art.id);
  check(`${who} can't read contacts`, data?.length === 0, data);
}
const { error: edCont } = await editor.c.from('contacts').insert({ artist_id: art.id, name: 'Sneaky' });
check("editor can't create contacts", !!edCont);

const { data: inv, error: invErr } = await owner.c.rpc('next_invoice_number', { p_artist_id: art.id });
check('next invoice number starts at INV-0001', inv === 'INV-0001', invErr ?? inv);
const { error: edInvNo } = await editor.c.rpc('next_invoice_number', { p_artist_id: art.id });
check("editor can't get invoice numbers", !!edInvNo);
const { data: invoice, error: invIns } = await owner.c
  .from('invoices')
  .insert({ artist_id: art.id, number: inv, contact_id: contact.id, currency: 'USD' })
  .select()
  .single();
check('owner creates an invoice', !invIns && invoice, invIns);
const { data: inv2 } = await owner.c.rpc('next_invoice_number', { p_artist_id: art.id });
check('invoice numbers increment', inv2 === 'INV-0002', inv2);

const { data: sale, error: saleErr } = await owner.c
  .from('sales')
  .insert({ artist_id: art.id, piece_id: piece.id, buyer_contact_id: contact.id, invoice_id: invoice.id, price: 5000, currency: 'USD', sale_date: '2026-01-02' })
  .select()
  .single();
check('owner records a sale', !saleErr && sale, saleErr);
const { data: edSales } = await editor.c.from('sales').select('id').eq('artist_id', art.id);
check("editor can't read sales", edSales?.length === 0, edSales);
const { error: crossSale } = await stranger.c
  .from('sales')
  .insert({ artist_id: other.id, piece_id: otherPiece.id, buyer_contact_id: contact.id });
check("a sale can't reference another artist's contact", !!crossSale);
const { error: crossSale2 } = await stranger.c.from('sales').insert({ artist_id: other.id, piece_id: piece.id });
check("stranger can't record a sale of alice's piece", !!crossSale2);

// --- exhibitions: members read, editors write; public via catalogue ---------
const { data: exh, error: exhErr } = await editor.c
  .from('exhibitions')
  .insert({ artist_id: art.id, title: 'Open Studio', is_public: true, start_date: '2025-05-01', venue: 'Camp 3' })
  .select()
  .single();
check('editor creates an exhibition', !exhErr && exh, exhErr);
const { data: hidden } = await editor.c.from('exhibitions').insert({ artist_id: art.id, title: 'Private viewing' }).select().single();
const { error: epErr } = await editor.c.from('exhibition_pieces').insert({ exhibition_id: exh.id, piece_id: piece.id, artist_id: art.id });
check('editor adds a piece to an exhibition', !epErr, epErr);
await editor.c.from('exhibition_pieces').insert({ exhibition_id: hidden.id, piece_id: piece.id, artist_id: art.id });
const { error: crossEp } = await stranger.c.from('exhibition_pieces').insert({ exhibition_id: exh.id, piece_id: otherPiece.id, artist_id: other.id });
check("stranger can't add to alice's exhibition", !!crossEp);

// --- provenance & notes: owner only ------------------------------------------
await owner.c.from('provenance').insert([
  { artist_id: art.id, piece_id: piece.id, position: 0, event: 'created', date_text: '2019', party: 'The artist', is_public: true },
  { artist_id: art.id, piece_id: piece.id, position: 1, event: 'sold', date_text: '2026', party: 'Secret collector', is_public: false },
]);
const { data: edProv } = await editor.c.from('provenance').select('id').eq('piece_id', piece.id);
check("editor can't read provenance", edProv?.length === 0, edProv);
const { error: noteErr } = await owner.c.from('piece_notes').insert({ artist_id: art.id, piece_id: piece.id, body: 'Needs reframing' });
check('owner adds a private note', !noteErr, noteErr);
const { data: vNotes } = await viewer.c.from('piece_notes').select('id').eq('piece_id', piece.id);
check("viewer can't read private notes", vNotes?.length === 0, vNotes);

// --- images: private images stay out of the public catalogue ----------------
await owner.c.from('piece_images').insert([
  { piece_id: piece.id, artist_id: art.id, storage_path: `${art.id}/${piece.id}/a.jpg`, position: 0, is_public: true },
  { piece_id: piece.id, artist_id: art.id, storage_path: `${art.id}/${piece.id}/b.jpg`, position: 1, is_public: false },
]);

const { data: cat, error: catErr } = await anon.rpc('catalogue_v1', { p_artist_slug: art.slug });
check('anon reads catalogue_v1', !catErr && cat?.version === 1, catErr);
const cp = cat?.pieces?.[0];
check('catalogue skips private images', cp?.images?.length === 1 && cp.images[0].path.endsWith('a.jpg'), cp?.images);
check('catalogue lists only public exhibitions', cat?.exhibitions?.length === 1 && cat.exhibitions[0].title === 'Open Studio', cat?.exhibitions);
check('catalogue exhibition lists public pieces', cat?.exhibitions?.[0]?.piece_ids?.[0] === piece.id, cat?.exhibitions);
check('piece lists public exhibition ids only', cp?.exhibition_ids?.length === 1 && cp.exhibition_ids[0] === exh.id, cp?.exhibition_ids);
check('catalogue shows public provenance only', cp?.provenance?.length === 1 && cp.provenance[0].party === 'The artist', cp?.provenance);
const catText = JSON.stringify(cat);
check('catalogue leaks no sale, contact or location', !/KBH|Secret collector|Camp 3"|5000/.test(catText.replace('"venue":"Camp 3"', '')), null);
const { data: pv } = await anon.from('public_pieces').select('images').eq('id', piece.id).single();
check('public_pieces skips private images', pv?.images?.length === 1, pv);
const { data: pe } = await anon.from('public_exhibitions').select('title').eq('artist_slug', art.slug);
check('public_exhibitions lists public ones only', pe?.length === 1, pe);
for (const t of ['locations', 'contacts', 'sales', 'invoices', 'exhibitions', 'provenance', 'piece_notes', 'documents', 'import_runs']) {
  const { data } = await anon.from(t).select('*').limit(1);
  check(`anon can't read ${t}`, !data || data.length === 0, data);
}

// --- documents bucket: owner only --------------------------------------------
const path = `${art.id}/${piece.id}/certificate.pdf`;
const blob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
const { error: upErr } = await owner.c.storage.from('documents').upload(path, blob, { contentType: 'application/pdf' });
check('owner uploads a document', !upErr, upErr);
const { error: docRow } = await owner.c.from('documents').insert({ artist_id: art.id, piece_id: piece.id, title: 'Certificate', storage_path: path, mime_type: 'application/pdf' });
check('owner records the document', !docRow, docRow);
const { error: edUp } = await editor.c.storage.from('documents').upload(`${art.id}/x.pdf`, blob, { contentType: 'application/pdf' });
check("editor can't upload documents", !!edUp);
const { data: edDl } = await editor.c.storage.from('documents').download(path);
check("editor can't download documents", !edDl);
const { data: signed } = await owner.c.storage.from('documents').createSignedUrl(path, 60);
check('owner gets a signed download link', !!signed?.signedUrl, signed);
const { data: anonDl } = await anon.storage.from('documents').download(path);
check("anon can't download documents", !anonDl);

// --- existing rows untouched by the migration --------------------------------
const { data: still } = await owner.c.from('pieces').select('location, status, is_public').eq('id', piece.id).single();
check('piece text location and status unchanged', still?.location === null && still?.status === 'available', still);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
