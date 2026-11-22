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
| **Pieces** | Grid, list and table views; search; filters (status, medium, subject, collection, visibility, year); sorting; bulk status/visibility/collection/delete. Full record per piece: inventory number (auto-assigned with your prefix), year, medium, subject, style, dimensions and framed dimensions, price and currency, 10 statuses, location, signature, tags, public description, private notes. Multiple images per piece, resized in the browser (2400px + thumbnail). Editions with per-print status, price and location. |
| **Quick update** | `/a/<artist>/play`: a phone-first, one-work-at-a-time way for the artist to keep records right. Piles: *Is this still available?* (every work), *Missing info*, *Hidden from website*, *Sold*. Big buttons (Sold / Available / Not for sale / Hide from website), quick place picker, private price. Every tap saves at once with undo; progress, resume and a day streak are kept in the browser. Spanish, Catalan and English. Keys on desktop: ← → move, A/S/N/H answer, Z undo. |
| **Collections** | Group pieces into series or shows; optionally public. |
| **Reports** | Printable inventory report (choose columns, totals), price list, and one-work-per-page portfolio, all saved as PDF from the browser. Full CSV export. |
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
- Images live in one Storage bucket under `<artist_id>/<piece_id>/<random-id>.jpg`. Only
  editors of that artist can upload or delete. The bucket is public-read with
  unguessable paths, the same model image CDNs use, so image URLs work in reports, the
  public profile and on websites without signing.

## Development

```bash
npx supabase start          # local Postgres, Auth, Storage (Docker)
npx supabase db reset       # apply migrations to the local database
npm run test:rls            # 31 checks of the access rules against the local stack
npm run typecheck
npx supabase gen types typescript --local > src/lib/database.types.ts   # after schema changes
```
