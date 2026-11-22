// Playwright run of every Artwork Archive parity screen against the local
// Supabase stack and a build of the app.
//
//   npx supabase start
//   npx vite build --mode e2e --outDir /tmp/dist-e2e   (.env.e2e.local points at the local stack)
//   npx vite preview --outDir /tmp/dist-e2e --port 4173 &
//   node scripts/e2e-parity.mjs [screenshot-dir]
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Playwright is preinstalled globally in CI/dev containers; run with NODE_PATH=$(npm root -g) if not a local dependency.
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.E2E_BASE ?? 'http://localhost:4173';
const SHOTS = process.argv[2] ?? join(tmpdir(), 'artfolio-e2e');
mkdirSync(SHOTS, { recursive: true });

const env = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8' }).split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
);
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const password = 'test-password-123';

async function user(label) {
  const email = `${label}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const c = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });
  return { email, id: data.user.id, c };
}

let failures = 0;
const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (e) {
    failures++;
    await Promise.all(browser.contexts().flatMap((c) => c.pages()).map((pg, i) => pg.screenshot({ path: join(SHOTS, `fail-${results.length}-${i}.png`), fullPage: true }).catch(() => {})));
    results.push(`FAIL  ${name}  -> ${e.message.split('\n')[0]}`);
  }
  console.log(results.at(-1));
}
// Click a checkbox and wait for it to reach the wanted state (cache updates land on the next tick).
async function setChecked(loc, want) {
  if ((await loc.isChecked()) !== want) await loc.click();
  for (let i = 0; i < 50 && (await loc.isChecked()) !== want; i++) await new Promise((r) => setTimeout(r, 100));
  if ((await loc.isChecked()) !== want) throw new Error('checkbox did not change');
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- seed --------------------------------------------------------------------
const owner = await user('owner');
const editor = await user('editor');
const slug = `xa-${run}`;
const { data: artist } = await owner.c.from('artists').insert({ slug, name: 'Xano Test', inventory_prefix: 'XA-', currency: 'USD', created_by: owner.id, public_profile: true }).select().single();
await owner.c.rpc('add_member_by_email', { p_artist_id: artist.id, p_email: editor.email, p_role: 'editor' });
const mk = (title, inv, extra = {}) => owner.c.from('pieces').insert({ artist_id: artist.id, title, inventory_number: inv, is_public: true, ...extra }).select().single().then((r) => r.data);
const street = await mk('Street walkby', 'XA-0011', { slug: 'street-walkby', medium: 'Acrylic on canvas', height: 100, width: 81, price: 2000 });
const wave = await mk('Wave', 'XA-0007', { slug: 'wave-xano-armenter', location: 'At My Studio', price: 1200 });
const studio = await mk('Studio corner', 'XA-0046', { slug: 'studio-corner-xano-armenter', location: 'At My Studio' });
// Two image rows (paths need not exist for ordering tests).
await owner.c.from('piece_images').insert({ piece_id: street.id, artist_id: artist.id, storage_path: `${artist.id}/${street.id}/first.jpg`, position: 0 });
await owner.c.from('piece_images').insert({ piece_id: street.id, artist_id: artist.id, storage_path: `${artist.id}/${street.id}/second.jpg`, position: 1 });

const browser = await chromium.launch();
async function signIn(email) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(`${BASE}/login`);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button.btn-primary');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  return page;
}
const shot = (page, name) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
const A = `${BASE}/a/${slug}`;

const page = await signIn(owner.email);

// --- Locations ---------------------------------------------------------------
await step('Locations: create a location', async () => {
  await page.goto(`${A}/locations`);
  await page.getByRole('button', { name: '+ New location' }).click();
  const form = page.getByRole('form', { name: 'Location form' });
  await form.getByLabel('Name').fill('Camp 3');
  await form.getByLabel('Address').fill('Carrer de la Pau 3, Barcelona');
  await form.getByRole('button', { name: 'Add location' }).click();
  await page.getByRole('cell', { name: 'Camp 3' }).waitFor();
});
await step('Locations: turn a typed location into a record and link its pieces', async () => {
  await page.getByText('At My Studio · 2 pieces').waitFor();
  await page.getByRole('button', { name: 'Create & link' }).click();
  await page.getByRole('cell', { name: 'At My Studio' }).waitFor();
  const { data } = await owner.c.from('pieces').select('location_id, location').in('id', [wave.id, studio.id]);
  expect(data.every((p) => p.location_id && p.location === 'At My Studio'), 'pieces not linked');
  await shot(page, '01-locations');
});
await step('Pieces: filter by location', async () => {
  const { data: loc } = await owner.c.from('locations').select('id').eq('artist_id', artist.id).eq('name', 'At My Studio').single();
  await page.goto(`${A}/pieces?location=${loc.id}`);
  await page.getByText('Studio corner').first().waitFor();
  expect(!(await page.getByText('Street walkby').count()), 'unfiltered piece shown');
});

// --- Piece page ---------------------------------------------------------------
await step('Piece: set storage location and save', async () => {
  await page.goto(`${A}/pieces/${street.id}`);
  await page.getByLabel('Storage location').selectOption({ label: 'Camp 3' });
  expect((await page.getByLabel('Location details').inputValue()) === 'Camp 3', 'details not prefilled');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('Saved', { exact: true }).waitFor();
  const { data } = await owner.c.from('pieces').select('location_id, location').eq('id', street.id).single();
  expect(data.location_id && data.location === 'Camp 3', JSON.stringify(data));
});
await step('Piece: reorder images and hide one from the public', async () => {
  const thumbs = page.locator('.group.relative').filter({ has: page.locator('img') });
  await thumbs.nth(1).hover();
  await page.getByRole('button', { name: 'Move earlier' }).click();
  await page.waitForTimeout(800);
  const { data: imgs } = await owner.c.from('piece_images').select('storage_path, position').eq('piece_id', street.id).order('position');
  expect(imgs[0].storage_path.endsWith('second.jpg'), 'order not saved');
  await setChecked(page.getByLabel('Show publicly'), false);
  await page.getByText('Private', { exact: true }).first().waitFor();
  await page.getByLabel('Image caption').fill('Detail');
  await page.getByLabel('Image caption').blur();
  await page.waitForTimeout(500);
  const { data: hidden } = await owner.c.from('piece_images').select('is_public, caption').eq('piece_id', street.id).order('position');
  expect(hidden[0].is_public === false && hidden[0].caption === 'Detail', JSON.stringify(hidden));
  const { data: cat } = await createClient(env.API_URL, env.ANON_KEY).rpc('catalogue_v1', { p_artist_slug: slug });
  const p = cat.pieces.find((x) => x.id === street.id);
  expect(p.images.length === 1 && p.images[0].path.endsWith('first.jpg'), 'private image in catalogue');
});
await step('Piece: private notes log', async () => {
  await page.getByLabel('New note').fill('Frame chipped at lower left');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByText('Frame chipped at lower left').waitFor();
});
await step('Piece: provenance entry', async () => {
  await page.getByRole('button', { name: '+ Add entry' }).click();
  const entry = page.getByRole('listitem', { name: 'Provenance entry 1' });
  await entry.getByLabel('When').fill('2019');
  await entry.getByLabel('When').blur();
  await setChecked(entry.getByLabel('Public'), true);
  await page.waitForTimeout(500);
  const { data } = await owner.c.from('provenance').select('date_text, party, event, is_public').eq('piece_id', street.id);
  expect(data.length === 1 && data[0].date_text === '2019' && data[0].party === 'Xano Test' && data[0].is_public, JSON.stringify(data));
});
await step('Piece: upload and open a document', async () => {
  await page.getByTestId('document-input').setInputFiles({ name: 'certificate.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% test certificate\n') });
  await page.getByRole('button', { name: 'certificate.pdf', exact: true }).waitFor();
  const [req] = await Promise.all([
    page.context().waitForEvent('request', (r) => r.url().includes('/object/sign/documents/') && r.url().includes('token=')),
    page.getByRole('button', { name: 'certificate.pdf', exact: true }).click(),
  ]);
  const res = await fetch(req.url());
  const text = await res.text();
  expect(res.ok && text.includes('test certificate'), `signed link: ${res.status}`);
});

// --- Exhibitions ----------------------------------------------------------------
await step('Exhibitions: create, make public, add works', async () => {
  await page.goto(`${A}/exhibitions`);
  await page.getByPlaceholder('New exhibition title').fill('Ultramar');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/exhibitions\/[0-9a-f-]{36}/);
  const form = page.getByRole('form', { name: 'Exhibition form' });
  await form.getByLabel('Venue', { exact: true }).fill('KBH Fine Arts Gallery');
  await form.getByLabel('City').fill('Barcelona');
  await form.getByLabel('Opens').fill('2024-03-01');
  await form.getByLabel('Public (listed in the website catalogue)').check();
  await form.getByRole('button', { name: 'Save' }).click();
  await page.getByText('Saved').waitFor();
  await page.getByLabel('Add a work').fill('wave');
  await page.getByRole('button', { name: /XA-0007 Wave/ }).click();
  await page.getByText('Works in this exhibition (1)').waitFor();
  await shot(page, '02-exhibition');
  const { data: cat } = await createClient(env.API_URL, env.ANON_KEY).rpc('catalogue_v1', { p_artist_slug: slug });
  expect(cat.exhibitions[0]?.title === 'Ultramar' && cat.exhibitions[0].piece_ids[0] === wave.id, JSON.stringify(cat.exhibitions));
});
await step('Piece: add to exhibition from the piece page', async () => {
  await page.goto(`${A}/pieces/${studio.id}`);
  await page.getByLabel('Add to exhibition').selectOption({ label: 'Ultramar (2024)' });
  await page.getByRole('link', { name: 'Ultramar' }).waitFor();
});

// --- Contacts ---------------------------------------------------------------------
await step('Contacts: add the representing gallery', async () => {
  await page.goto(`${A}/contacts`);
  await page.getByRole('button', { name: '+ New contact' }).click();
  const form = page.getByRole('form', { name: 'Contact form' });
  await form.getByLabel('Name').fill('KBH Fine Arts Gallery');
  await form.getByLabel('Type').selectOption('gallery');
  await form.getByLabel('Email').fill('info@kbh.example');
  await form.getByLabel('Represents Xano Test (gallery / agent)').check();
  await form.getByRole('button', { name: 'Add contact' }).click();
  await page.getByText('Represents Xano Test', { exact: true }).waitFor();
});

// --- Sales & invoices --------------------------------------------------------------
await step('Sales: record a sale with a new buyer; piece marked sold', async () => {
  await page.goto(`${A}/sales`);
  await page.getByRole('button', { name: '+ Record sale' }).click();
  const form = page.getByRole('form', { name: 'Sale form' });
  await form.getByLabel('Piece').selectOption({ label: 'XA-0011 · Street walkby' });
  await form.getByLabel('New buyer name (optional)').fill('Ana Puig');
  await form.getByLabel('Sold via (gallery / agent)').selectOption({ label: 'KBH Fine Arts Gallery' });
  await form.getByLabel('Date').fill('2025-06-15');
  await form.getByLabel('Price').fill('3500');
  await form.getByLabel('Commission %').fill('40');
  await form.getByRole('button', { name: 'Record sale' }).click();
  await page.getByRole('cell', { name: 'Ana Puig' }).waitFor();
  await page.getByText('$3,500 gross · $2,100 after commission').waitFor();
  const { data } = await owner.c.from('pieces').select('status').eq('id', street.id).single();
  expect(data.status === 'sold', data.status);
  await shot(page, '03-sales');
});
await step('Sales: export CSV', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  expect(/sales-.*\.csv$/.test(dl.suggestedFilename()), dl.suggestedFilename());
});
await step('Invoices: create for the buyer, add the sale, totals', async () => {
  await page.getByRole('button', { name: /^Invoices/ }).click();
  await page.getByLabel('New invoice for').selectOption({ label: 'Ana Puig' });
  await page.waitForURL(/invoices\/[0-9a-f-]{36}/);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const details = page.getByRole('region', { name: 'Invoice details' }).or(page.locator('[aria-label="Invoice details"]'));
  await details.getByLabel('Tax rate %').fill('21');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Saved').waitFor();
  await page.getByText('INV-0001').first().waitFor();
  await page.getByText('$4,235').waitFor(); // 3500 + 21%
  await shot(page, '04-invoice');
});

// --- Piece page sales panel ---------------------------------------------------------
await step('Piece: sales panel lists the sale and invoice', async () => {
  await page.goto(`${A}/pieces/${street.id}`);
  await page.getByText('2025-06-15 · Ana Puig via KBH Fine Arts Gallery').waitFor();
  await page.getByRole('link', { name: 'INV-0001' }).waitFor();
  await shot(page, '05-piece');
});

// --- Import from AA ------------------------------------------------------------------
const csv = {
  'Pieces.csv': [
    'Inventory Number,Piece Name,Public URL,Medium,Height,Width,Current Location,Status,Price,Additional Images',
    ',Wave,https://www.artworkarchive.com/profile/xano-armenter/artwork/wave-xano-armenter,Acrylic on canvas,60,60,At My Studio,Available,1500,',
    ',Brand new work,https://www.artworkarchive.com/profile/xano-armenter/artwork/brand-new-work,Oil on linen,50,40,Camp 3,Available,900,',
    ',Studio corner,,,,,Hospital Clinic,Sold,,',
  ].join('\n'),
  'Contacts.csv': 'Contact ID,First Name,Last Name,Company,Email,Contact Type\nc9,Joan,Mas,,joan@example.com,Collector',
};
await step('Import AA: dry run shows the plan, writes nothing', async () => {
  await page.goto(`${A}/import`);
  await page.getByRole('link', { name: /Moving from Artwork Archive/ }).click();
  await page.getByTestId('aa-files').setInputFiles(Object.entries(csv).map(([name, text]) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text) })));
  await page.getByText('Pieces.csv').waitFor();
  await page.getByRole('button', { name: 'Run dry run' }).click();
  await page.getByRole('region', { name: 'Dry-run report' }).waitFor();
  const pieces = await page.getByTestId('summary-pieces').innerText();
  expect(pieces.replace(/\s+/g, ' ').trim().toLowerCase() === 'pieces 1 2 0 0', pieces);
  await page.getByText('price: Artfolio has 1200, file has 1500').waitFor();
  const { count } = await owner.c.from('pieces').select('*', { count: 'exact', head: true }).eq('artist_id', artist.id);
  expect(count === 3, `dry run wrote: ${count}`);
  await shot(page, '06-import-dry-run');
});
await step('Import AA: download the report', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download report (CSV)' }).click()]);
  expect(/aa-import-dry-run/.test(dl.suggestedFilename()), dl.suggestedFilename());
});
await step('Import AA: apply, then a second run changes nothing', async () => {
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByText('Nothing to change: Artfolio already has everything in these files.').waitFor({ timeout: 30_000 });
  const { data: w } = await owner.c.from('pieces').select('price, medium, height').eq('id', wave.id).single();
  expect(Number(w.price) === 1200 && w.medium === 'Acrylic on canvas' && Number(w.height) === 60, JSON.stringify(w));
  const { data: s } = await owner.c.from('pieces').select('status, location').eq('id', studio.id).single();
  expect(s.status === 'sold' && s.location === 'At My Studio', JSON.stringify(s));
  const { data: n } = await owner.c.from('pieces').select('is_public, location_id').eq('artist_id', artist.id).eq('slug', 'brand-new-work').single();
  expect(n && n.is_public === false && n.location_id, JSON.stringify(n));
  const { count } = await owner.c.from('contacts').select('*', { count: 'exact', head: true }).eq('artist_id', artist.id).eq('email', 'joan@example.com');
  expect(count === 1, 'contact not imported');
  await shot(page, '07-import-applied');
  // A fresh page with the same files: still nothing to do.
  await page.goto(`${A}/import/aa`);
  await page.getByTestId('aa-files').setInputFiles(Object.entries(csv).map(([name, text]) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text) })));
  await page.getByRole('button', { name: 'Run dry run' }).click();
  await page.getByText('Nothing to change: Artfolio already has everything in these files.').waitFor();
});

// --- Reports ----------------------------------------------------------------------------
await step('Reports: available works list', async () => {
  await page.goto(`${A}/reports`);
  await page.getByRole('button', { name: /Available works/ }).click();
  await page.getByText('(available works only)').waitFor();
  await page.getByRole('link', { name: 'Open printable report' }).click();
  await page.getByRole('heading', { name: 'Available works' }).waitFor();
  const body = await page.locator('table').innerText();
  expect(body.includes('Wave') && body.includes('Brand new work') && !body.includes('Street walkby') && !body.includes('Studio corner'), body);
  expect(body.includes('At My Studio') && body.includes('Camp 3'), 'locations missing');
  await shot(page, '08-report-available');
});
await step('Reports: inventory grouped by location', async () => {
  await page.goto(`${A}/reports`);
  await page.getByLabel('Group by location').check();
  await page.getByRole('link', { name: 'Open printable report' }).click();
  await page.getByRole('heading', { name: /^Camp 3/ }).waitFor();
  await page.getByRole('heading', { name: /^At My Studio/ }).waitFor();
  await shot(page, '09-report-inventory');
});

await step('Print: reports use the full page width (no sidebar column)', async () => {
  await page.emulateMedia({ media: 'print' });
  const box = await page.locator('main').boundingBox();
  await page.emulateMedia({ media: 'screen' });
  expect(box.x < 5 && box.width > 1300, JSON.stringify(box));
});
await step('QR: piece panel and label sheet render', async () => {
  await page.goto(`${A}/pieces/${wave.id}`);
  await page.getByText(/QR/).first().waitFor();
  await page.goto(`${A}/reports/labels`);
  await page.getByPlaceholder('https://xanoarmenter.com').fill('https://xanoarmenter.com');
  await page.getByText('Enter the website the codes should point to.').waitFor({ state: 'detached' });
  await page.getByText('Wave').last().waitFor();
  await shot(page, '10-qr-labels');
});

// --- Editor role -------------------------------------------------------------------------
const ed = await signIn(editor.email);
await step('Editor: no contacts or sales in the menu, owner-only pages refuse', async () => {
  await ed.goto(`${A}/pieces`);
  await ed.getByRole('link', { name: 'Locations' }).waitFor();
  expect(!(await ed.getByRole('link', { name: 'Contacts' }).count()) && !(await ed.getByRole('link', { name: 'Sales' }).count()), 'owner nav visible');
  await ed.goto(`${A}/contacts`);
  await ed.getByText('Owners only').waitFor();
  await ed.goto(`${A}/sales`);
  await ed.getByText('Owners only').waitFor();
});
await step('Editor: piece page shows exhibitions but no private panels', async () => {
  await ed.goto(`${A}/pieces/${street.id}`);
  await ed.getByText('Not in any exhibition.').waitFor();
  expect(!(await ed.getByText('Private notes log').count()) && !(await ed.getByText('Record sale').count()), 'private panels visible');
});

await browser.close();
writeFileSync(join(SHOTS, 'results.txt'), results.join('\n') + '\n');
console.log(failures ? `\n${failures} step(s) failed` : '\nAll steps passed');
process.exit(failures ? 1 : 0);
