# Artfolio

An artwork inventory and public catalogue for artists, built to replace Artwork Archive.
Several artists can each have their own workspace, and every workspace can have
several people with different roles.

**Stack:** React + Vite + Tailwind on the front end; Supabase (Postgres, Auth, Storage) as
the back end. No server code to run: all access rules live in the database
(`supabase/migrations`).

## What's in it

| Area | Features |
| --- | --- |
| **Pieces** | Grid, list and table views; search; filters (status, medium, subject, collection, visibility, year); sorting; bulk status/visibility/collection/delete. Full record per piece: inventory number (auto-assigned with your prefix), year, medium, subject, style, dimensions and framed dimensions, price and currency, 10 statuses, location, signature, tags, public description, private notes. Multiple images per piece, resized in the browser (2400px + thumbnail), reorderable, each with a caption and a public/private switch. Editions with per-print status, price and location. |
| **Locations** | Storage locations (studio, storage, galleries, collectors) with address and contact. Set per piece; filter pieces and group the inventory report by location. Turn locations typed on pieces into records in one click. |
| **Exhibitions** | Shows, fairs, residencies with venue and dates; which works were in each. Public exhibitions appear in `catalogue_v1`. |
| **Contacts, sales, invoices** *(owners only)* | Collectors, galleries (flag the one that represents the artist), institutions. Sales with buyer, gallery, commission and tax; recording a sale can mark the piece sold. Numbered invoices built from sales, printable as PDF. Sales CSV export. |
| **Provenance, notes, documents** *(owners only)* | Per piece: ordered provenance (entries can be made public), a dated private notes log, and private documents (certificates, invoices, condition reports) in a private Storage bucket opened through 5-minute signed links. |
| **Quick update** | `/a/<artist>/play`: a phone-first, one-work-at-a-time way for the artist to keep records right. Piles: *Is this still available?* (every work), *Missing info*, *Hidden from website*, *Sold*. Big buttons (Sold / Available / Not for sale / Hide from website), quick place picker, private price. Every tap saves at once with undo; progress, resume and a day streak are kept in the browser. Spanish, Catalan and English. Keys on desktop: ← → move, A/S/N/H answer, Z undo. |
| **Collections** | Group pieces into series or shows; optionally public. |
| **Reports** | Printable inventory report (choose columns, totals, group by location), available-works list, price list, and one-work-per-page portfolio, all saved as PDF from the browser. Full CSV export. |
| **Public profile** | `/p/<artist>`: bio, public works, public collections, a page per work with enquiry link. Private notes and hidden prices are never exposed. |
| **Import** | CSV or JSON upload with automatic column matching, preview, duplicate skipping, collection creation and image download from URLs. A command-line importer for large migrations with local image files. |
| **Workspaces & people** | Any user can create artists. Owners manage settings and people; editors manage the inventory; viewers can only look. |

## Set up

1. Create a project at [supabase.com](https://supabase.com) (the free tier is fine to start).
2. Apply the database schema:
   ```bash
   npm install
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. In the Supabase dashboard under **Authentication → URL Configuration**, set the Site URL to
   where the app will live.
4. Copy `.env.example` to `.env.local` and fill in the project URL and anon/publishable key
   (**Project Settings → API**).
5. `npm run dev`, then open http://localhost:5173, create an account and add an artist.

### Deploy

`npm run build` produces a static site in `dist/`. Host it anywhere static. `vercel.json`
(Vercel) and `public/_redirects` (Netlify, Cloudflare Pages) route every path to the app.
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's environment settings.

## Migrating from Artwork Archive

**Artwork Archive importer (recommended):** in AA, export your data while logged in (pieces,
contacts, sales, exhibitions, locations; CSV or Excel). In Artfolio open **Import → Moving from
Artwork Archive?** and upload all the files at once. Each sheet is recognised (you can change
it and its column mapping), then **Run dry run** shows every create, update and skip with the
reason, and every column that would not be imported. Nothing is written until you press
**Apply**.

- Pieces match on inventory number, then slug (an explicit slug column, the AA
  `/artwork/<slug>` link, or the title the way AA slugs it). A row whose only match is a piece
  with the same title is reported, not created.
- Existing values are never overwritten unless you tick *Replace existing values*; differing
  values are listed as conflicts. Status is the exception: Artfolio defaulted imported works to
  "available", so an AA status replaces "available". Visibility and slugs of existing pieces
  are never changed. New pieces are private unless you choose otherwise.
- Contacts match on AA id, email, then name; sales on AA id or piece + date + price;
  exhibitions on AA id or title + start date; images on their source URL. A second run with
  the same files is a no-op (`npm run test:import-db` proves this against the local stack).
- Each applied run is logged in `import_runs`.

**Plain CSV:**

**From an export (recommended):** export your pieces from Artwork Archive as a spreadsheet,
save it as CSV and upload it on the **Import** page. Columns are matched automatically and you
can adjust them before importing. Set the inventory prefix in **Settings** first if you want
new numbers to use it; numbers already in the file are kept.

**From a JSON catalogue with local images** (how Xano Armenter's 103 works were brought over
from the `xano-armenter-site` repo):

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
node scripts/import-json.mjs ../xano-armenter-site/js/artwork.json \
  --artist xano-armenter --name "Xano Armenter" --owner-email <your-login-email> \
  --root ../xano-armenter-site --public
```

The owner must have signed up in the app first. Add `--dry-run` to preview. Running it
again skips pieces already imported. The service-role key bypasses all access rules: keep
it out of the repo and the browser.

## Using the catalogue on a website

The public catalogue is readable with the anon key through three read-only views:
`public_artists`, `public_pieces` and `public_collections`. For example:

```js
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/public_pieces?artist_slug=eq.xano-armenter&order=year.desc`,
  { headers: { apikey: SUPABASE_ANON_KEY } },
);
const pieces = await res.json(); // images[].storage_path -> /storage/v1/object/public/artwork/<path>
```

## Security model

- Every table has row-level security. Access is decided by `artist_members` roles through
  `is_member`, `can_edit` and `is_owner` functions in the migration.
- Child rows (images, editions, collection links) always take their `artist_id` from the
  piece, so they can't be attached to another artist's data.
- A workspace can't lose its last owner.
- Anonymous visitors can't read any table directly, only the `public_*` views, which list
  public pieces of artists with a live profile and leave out notes and hidden prices.
- Locations and exhibitions follow the same member/editor rules. Contacts, sales, invoices,
  provenance, private notes, documents and import runs are readable and writable by
  workspace **owners only**. Documents live in a private `documents` bucket, owners only.
- Images live in one Storage bucket under `<artist_id>/<piece_id>/<random-id>.jpg`. Only
  editors of that artist can upload or delete. The bucket is public-read with
  unguessable paths, the same model image CDNs use, so image URLs work in reports, the
  public profile and on websites without signing.

## Development

```bash
npx supabase start          # local Postgres, Auth, Storage (Docker)
npx supabase db reset       # apply migrations to the local database
npm run test:rls            # 31 checks of the access rules against the local stack
npm run test:rls:parity     # 51 checks of the locations/contacts/sales/... rules and catalogue_v1
npm test                    # importer unit tests
npm run test:import-db      # importer end to end against the local stack (idempotency)
npm run test:e2e            # Playwright run of every parity screen (see the script header)
npm run typecheck
npx supabase gen types typescript --local > src/lib/database.types.ts   # after schema changes
```
