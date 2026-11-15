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

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
