// Security tests for the database rules. Runs against the local Supabase
// stack (`npx supabase start`). Usage: npm run test:rls
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
const URL = env.API_URL;
const ANON = env.ANON_KEY;
const SERVICE = env.SERVICE_ROLE_KEY;

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
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { c, email };
}

const alice = await userClient('alice');
const bob = await userClient('bob');
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const { data: { user: aliceUser } } = await alice.c.auth.getUser();

// --- workspace creation ----------------------------------------------------
const { data: art, error: artErr } = await alice.c
  .from('artists')
  .insert({ slug: `alice-${run}`, name: 'Alice', inventory_prefix: 'AL-', created_by: aliceUser.id })
  .select()
  .single();
check('alice creates an artist workspace', !artErr && art, artErr);

const { data: mem } = await alice.c.from('artist_members').select('role').eq('artist_id', art.id);
check('creator becomes owner', mem?.[0]?.role === 'owner', mem);

// --- pieces + inventory numbers --------------------------------------------
const { data: p1, error: p1e } = await alice.c
  .from('pieces')
  .insert({ artist_id: art.id, title: 'Private piece', notes: 'secret note', price: 1000 })
  .select()
  .single();
check('alice adds a piece', !p1e, p1e);
check('inventory number auto-assigned', p1?.inventory_number === 'AL-0001', p1?.inventory_number);
check('currency defaults from artist', p1?.currency === 'EUR', p1?.currency);

const { data: p2 } = await alice.c
  .from('pieces')
  .insert({ artist_id: art.id, title: 'Public piece', is_public: true, notes: 'also secret', price: 500, show_price: false })
  .select()
  .single();
check('second inventory number increments', p2?.inventory_number === 'AL-0002', p2?.inventory_number);

// --- isolation --------------------------------------------------------------
const { data: bobSees } = await bob.c.from('pieces').select('id').eq('artist_id', art.id);
check("bob can't read alice's pieces", bobSees?.length === 0, bobSees);

const { error: bobInsErr } = await bob.c.from('pieces').insert({ artist_id: art.id, title: 'Intruder' });
check("bob can't add pieces to alice's workspace", !!bobInsErr);

const { data: bobUpd } = await bob.c.from('pieces').update({ title: 'Hacked' }).eq('id', p1.id).select();
check("bob can't edit alice's pieces", (bobUpd ?? []).length === 0, bobUpd);

const { data: bobArt } = await bob.c.from('artists').select('id').eq('id', art.id);
check("bob can't see alice's workspace", bobArt?.length === 0, bobArt);

const { error: selfAddErr } = await bob.c
  .from('artist_members')
  .insert({ artist_id: art.id, user_id: (await bob.c.auth.getUser()).data.user.id, role: 'owner' });
check("bob can't add himself as a member", !!selfAddErr);

// --- public catalogue ---------------------------------------------------------
let { data: pub } = await anon.from('public_pieces').select('*').eq('artist_id', art.id);
check('nothing public while profile is off', pub?.length === 0, pub);

await alice.c.from('artists').update({ public_profile: true }).eq('id', art.id);
({ data: pub } = await anon.from('public_pieces').select('*').eq('artist_id', art.id));
check('only the public piece is listed', pub?.length === 1 && pub[0].id === p2.id, pub);
check('private notes are not exposed', pub?.[0] && !('notes' in pub[0]), Object.keys(pub?.[0] ?? {}));
check('hidden price is not exposed', pub?.[0]?.price === null, pub?.[0]?.price);

const { data: anonPieces } = await anon.from('pieces').select('id');
check('anon cannot read the pieces table', (anonPieces ?? []).length === 0, anonPieces);

// --- roles --------------------------------------------------------------------
const { error: addErr } = await alice.c.rpc('add_member_by_email', {
  p_artist_id: art.id, p_email: bob.email, p_role: 'viewer',
});
check('owner invites bob as viewer', !addErr, addErr);

const { data: bobNow } = await bob.c.from('pieces').select('id, notes').eq('artist_id', art.id);
check('viewer can read all pieces', bobNow?.length === 2, bobNow);

const { data: viewerUpd } = await bob.c.from('pieces').update({ title: 'Nope' }).eq('id', p1.id).select();
check("viewer can't edit", (viewerUpd ?? []).length === 0, viewerUpd);

const { error: lastOwnerErr } = await alice.c
  .from('artist_members')
  .update({ role: 'editor' })
  .eq('artist_id', art.id)
  .eq('user_id', aliceUser.id);
check("last owner can't demote themselves", !!lastOwnerErr);

await alice.c.rpc('add_member_by_email', { p_artist_id: art.id, p_email: bob.email, p_role: 'editor' });
const { data: edUpd } = await bob.c.from('pieces').update({ title: 'Edited by Bob' }).eq('id', p1.id).select();
check('editor can edit', edUpd?.length === 1, edUpd);

const { data: bobArtUpd } = await bob.c.from('artists').update({ name: 'X' }).eq('id', art.id).select();
check("editor can't change workspace settings", (bobArtUpd ?? []).length === 0, bobArtUpd);

// --- collections / child rows --------------------------------------------------
const { data: bobArt2 } = await bob.c
  .from('artists')
  .insert({ slug: `bob-${run}`, name: 'Bob', created_by: (await bob.c.auth.getUser()).data.user.id })
  .select()
  .single();
const { data: bobCol } = await bob.c.from('collections').insert({ artist_id: bobArt2.id, name: 'Bob col' }).select().single();
const { error: crossErr } = await bob.c.from('collection_pieces').insert({ collection_id: bobCol.id, piece_id: p1.id });
check("can't put a piece in another artist's collection", !!crossErr);

const { data: aliceCol, error: colErr } = await alice.c.from('collections').insert({ artist_id: art.id, name: 'Series A' }).select().single();
check('editor creates a collection', !colErr, colErr);
const { error: cpErr } = await alice.c.from('collection_pieces').insert({ collection_id: aliceCol.id, piece_id: p1.id, artist_id: art.id });
check('piece added to own collection', !cpErr, cpErr);
const { data: img, error: imgErr } = await alice.c
  .from('piece_images')
  .insert({ piece_id: p2.id, artist_id: bobArt2.id, storage_path: 'x.jpg' })
  .select()
  .single();
check('image row is recorded', !imgErr, imgErr);
check('image artist_id is forced to the piece owner', img?.artist_id === art.id, img?.artist_id);
const { error: edErr } = await alice.c.from('piece_editions').insert({ piece_id: p2.id, artist_id: art.id, edition_number: '1/10' });
check('edition row is recorded', !edErr, edErr);
({ data: pub } = await anon.from('public_pieces').select('images').eq('id', p2.id));
check('public view includes images', pub?.[0]?.images?.length === 1, pub);

// --- storage ------------------------------------------------------------------
const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
const { error: upErr } = await alice.c.storage.from('artwork').upload(`${art.id}/${p1.id}/a.jpg`, blob);
check('owner uploads to own folder', !upErr, upErr);

const { error: outsiderUp } = await (await userClient('carol')).c.storage
  .from('artwork')
  .upload(`${art.id}/${p1.id}/evil.jpg`, blob);
check("outsider can't upload to alice's folder", !!outsiderUp);

// --- slugs ----------------------------------------------------------------------
check('slug is built from the title', p1?.slug === 'private-piece' && p2?.slug === 'public-piece', [p1?.slug, p2?.slug]);

const { data: p3, error: p3e } = await alice.c
  .from('pieces')
  .insert({ artist_id: art.id, title: 'Públic piece!', is_public: true, year: 1978, year_circa: true, price: 750, location: 'Studio drawer', signature: 'Signed verso', source_ref: 'https://example.test/secret-source' })
  .select()
  .single();
check('duplicate slug gets a -2 suffix', !p3e && p3?.slug === 'public-piece-2', p3e ?? p3?.slug);

const { data: p4 } = await alice.c
  .from('pieces')
  .insert({ artist_id: art.id, title: 'Zeta', slug: 'From The Source', is_public: true, year: 2001 })
  .select()
  .single();
check('a given slug is kept, normalised', p4?.slug === 'from-the-source', p4?.slug);

const { data: renamed } = await alice.c.from('pieces').update({ title: 'A completely new title' }).eq('id', p2.id).select().single();
check('slug is stable after a title update', renamed?.title === 'A completely new title' && renamed?.slug === 'public-piece', renamed?.slug);

const { data: reslug } = await alice.c.from('pieces').update({ slug: 'My Own Slug' }).eq('id', p4.id).select().single();
check('editor can set the slug explicitly', reslug?.slug === 'my-own-slug', reslug?.slug);

const { error: clashErr } = await alice.c.from('pieces').update({ slug: 'public-piece' }).eq('id', p4.id);
check("editor can't take a slug that is in use", clashErr?.code === '23505', clashErr);

const { data: allSlugs } = await alice.c.from('pieces').select('slug').eq('artist_id', art.id);
check('slugs are unique per artist', allSlugs?.length === 4 && new Set(allSlugs.map((p) => p.slug)).size === 4, allSlugs);

// --- catalogue_v1 ---------------------------------------------------------------
// alice: public profile; p1 private, p2 public (hidden price), p3 + p4 public.
const { data: pubCol } = await alice.c.from('collections').insert({ artist_id: art.id, name: 'Public series', description: 'Shown', is_public: true }).select().single();
await alice.c.from('collection_pieces').insert([
  { collection_id: pubCol.id, piece_id: p2.id, artist_id: art.id, position: 2 },
  { collection_id: pubCol.id, piece_id: p4.id, artist_id: art.id, position: 0 },
  { collection_id: pubCol.id, piece_id: p3.id, artist_id: art.id, position: 1 },
  { collection_id: pubCol.id, piece_id: p1.id, artist_id: art.id, position: 0 }, // private piece
  { collection_id: aliceCol.id, piece_id: p2.id, artist_id: art.id, position: 0 }, // private collection
]);

const { data: cat, error: catErr } = await anon.rpc('catalogue_v1', { p_artist_slug: art.slug });
check('anon can call catalogue_v1 for a public artist', !catErr && cat?.version === 1 && cat?.artist?.slug === art.slug, catErr ?? cat);
check(
  'catalogue has the v1 top-level shape',
  JSON.stringify(Object.keys(cat ?? {}).sort()) === '["artist","collections","generated_at","pieces","version"]' && !Number.isNaN(Date.parse(cat?.generated_at)),
  Object.keys(cat ?? {}),
);
check(
  'catalogue artist has only public fields',
  JSON.stringify(Object.keys(cat?.artist ?? {}).sort()) === '["bio","contact_email","currency","dimension_unit","location","name","slug","website"]',
  Object.keys(cat?.artist ?? {}),
);

const catIds = (cat?.pieces ?? []).map((p) => p.id);
check('catalogue lists only public pieces', catIds.length === 3 && !catIds.includes(p1.id), catIds);
check('catalogue pieces are ordered by year desc (no year last), then title', JSON.stringify(catIds) === JSON.stringify([p4.id, p3.id, p2.id]), catIds);

const PIECE_KEYS = ['collections', 'created_at', 'currency', 'depth', 'description', 'dimension_unit', 'edition_size', 'framed', 'framed_depth', 'framed_height', 'framed_width', 'height', 'id', 'images', 'inventory_number', 'kind', 'medium', 'price', 'slug', 'status', 'style', 'subject', 'tags', 'title', 'updated_at', 'width', 'year', 'year_circa'];
check(
  'catalogue pieces have exactly the v1 fields (no notes, location, signature, source_ref)',
  (cat?.pieces ?? []).every((p) => JSON.stringify(Object.keys(p).sort()) === JSON.stringify(PIECE_KEYS)),
  Object.keys(cat?.pieces?.[0] ?? {}).sort(),
);
const catText = JSON.stringify(cat ?? {});
check(
  'catalogue leaks no private text',
  !['secret note', 'also secret', 'Studio drawer', 'Signed verso', 'secret-source', 'Series A', 'Edited by Bob'].some((t) => catText.includes(t)),
);
const c2 = cat?.pieces?.find((p) => p.id === p2.id);
const c3 = cat?.pieces?.find((p) => p.id === p3.id);
check('catalogue hides a hidden price', c2 && c2.price === null && c2.currency === 'EUR', c2?.price);
check('catalogue shows a visible price', c3?.price === 750, c3?.price);
check('catalogue carries slug and year_circa', c3?.slug === 'public-piece-2' && c3?.year === 1978 && c3?.year_circa === true && c2?.year_circa === false, c3);
check(
  'catalogue images use path / thumb_path / width / height / caption',
  c2?.images?.length === 1 && c2.images[0].path === 'x.jpg' && JSON.stringify(Object.keys(c2.images[0]).sort()) === '["caption","height","path","thumb_path","width"]' && Array.isArray(c3?.images) && c3.images.length === 0,
  c2?.images,
);
check(
  'catalogue lists only public collections',
  cat?.collections?.length === 1 && cat.collections[0].id === pubCol.id && cat.collections[0].name === 'Public series' && cat.collections[0].description === 'Shown',
  cat?.collections,
);
check(
  'collection order respects position and skips private pieces',
  JSON.stringify(cat?.collections?.[0]?.piece_ids) === JSON.stringify([p4.id, p3.id, p2.id]),
  cat?.collections?.[0]?.piece_ids,
);
check(
  "a piece's collections are the public ones, with its position",
  JSON.stringify(c2?.collections) === JSON.stringify([{ id: pubCol.id, name: 'Public series', position: 2 }]),
  c2?.collections,
);

const { data: catAuthed, error: catAuthedErr } = await bob.c.rpc('catalogue_v1', { p_artist_slug: art.slug });
check('signed-in users get the same public catalogue', !catAuthedErr && catAuthed?.pieces?.length === 3, catAuthedErr);

const { data: catBob, error: catBobErr } = await anon.rpc('catalogue_v1', { p_artist_slug: bobArt2.slug });
check('catalogue_v1 is null for a non-public artist', !catBobErr && catBob === null, catBobErr ?? catBob);
const { data: catNone, error: catNoneErr } = await anon.rpc('catalogue_v1', { p_artist_slug: `nobody-${run}` });
check('catalogue_v1 is null for an unknown artist', !catNoneErr && catNone === null, catNoneErr ?? catNone);

await alice.c.from('artists').update({ public_profile: false }).eq('id', art.id);
const { data: catOff } = await anon.rpc('catalogue_v1', { p_artist_slug: art.slug });
check('catalogue_v1 turns null when the profile is switched off', catOff === null, catOff);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
