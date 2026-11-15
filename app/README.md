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
again skips pieces already imported. Each piece keeps the slug it had on Artwork Archive
(the last part of its `aa_url`), years written as `~1978`, `c. 1978` or `circa 1978` are
stored as approximate, and each image's pixel size is recorded. `--public` marks the pieces
public; the catalogue goes live when you also switch on **Public profile** in Settings.

To group pieces while importing (or afterwards: existing pieces are matched by slug), add
`--collection "Selected works" --collection-slugs wave-xano-armenter,pampagulles` (a comma
list, or a file with one slug per line). The collection keeps that order. The service-role key bypasses all access rules: keep
it out of the repo and the browser.

## Using the catalogue on a website

One request returns an artist's whole public catalogue as JSON. It needs only the project
URL and the anon (publishable) key, so it can be called from a browser, a static-site build
or a server, and several websites can read the same catalogue.

```bash
curl -X POST "$SUPABASE_URL/rest/v1/rpc/catalogue_v1" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_artist_slug": "xano-armenter"}'
```

```js
const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/catalogue_v1`, {
  method: 'POST',
  headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_artist_slug: 'xano-armenter' }),
});
const catalogue = await res.json(); // null if there is no such artist or the profile is off
const src = (path) => `${SUPABASE_URL}/storage/v1/object/public/artwork/${path}`;
```

The response is `null` (HTTP 200) when the artist doesn't exist or **Public profile** is
switched off in Settings. Otherwise:

```jsonc
{
  "version": 1,
  "generated_at": "2026-11-15T22:49:20.634Z",
  "artist": { "slug", "name", "bio", "location", "website", "contact_email", "currency", "dimension_unit" },
  "pieces": [                       // public pieces only; newest year first, no year last, then title
    {
      "id": "uuid",
      "slug": "about-the-future",   // unique per artist, stable: use it in page URLs
      "inventory_number": "0001",
      "title": "About the future",
      "kind": "original",           // or "edition"
      "year": 2018,                 // or null
      "year_circa": false,          // true: show as "c. 2018"
      "medium", "subject", "style",
      "height": 46, "width": 38, "depth": null, "dimension_unit": "cm",
      "framed": false, "framed_height", "framed_width", "framed_depth",
      "status": "available",        // available, on_hold, sold, on_loan, consigned, not_for_sale,
                                    // gifted, donated, destroyed, archived
      "description", "tags": [], "edition_size",
      "price": 1500,                // null when there is none or "Show price publicly" is off
      "currency": "USD",
      "images": [                   // in display order; [] when the piece has none
        { "path", "thumb_path", "width": 1600, "height": 1944, "caption" }
      ],
      "collections": [ { "id", "name", "position" } ],   // public collections only
      "created_at", "updated_at"
    }
  ],
  "collections": [                  // public collections only, by name
    { "id", "name", "description", "piece_ids": ["uuid"] }   // in collection order, public pieces only
  ]
}
```

- **Images:** `path` and `thumb_path` are object names in the public `artwork` Storage bucket.
  The URL is `${SUPABASE_URL}/storage/v1/object/public/artwork/${path}`. `width` and `height`
  are the pixel size of `path`, for laying out pages before images load (they can be null
  for images recorded without a size). `thumb_path` can be null.
- **Slugs** are assigned when a piece is created (from the title, or from the original link
  when importing: `…/artwork/about-the-future` gives `about-the-future`), with `-2`, `-3`… for
  duplicates. Renaming a piece does not change its slug. Editors can change it under
  **Web address (slug)** on the piece; doing so breaks existing links.
- **Never included:** private notes, location, signature, the import source link, hidden
  prices, private pieces and private collections.
- **Versioning:** `catalogue_v1` only ever gains fields. Anything that would rename, remove or
  change the meaning of a field ships as `catalogue_v2`, and `v1` keeps working. Ignore
  fields you don't know.
- A sample response (Xano Armenter's 103 works) is in
  `integrations/fixtures/catalogue_v1.sample.json`.

### Low-level access

The same public data is also readable as three read-only views, `public_artists`,
`public_pieces` and `public_collections`, for filtered or paged queries through the REST API:

```js
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/public_pieces?artist_slug=eq.xano-armenter&order=year.desc`,
  { headers: { apikey: SUPABASE_ANON_KEY } },
);
const pieces = await res.json(); // images[].storage_path -> /storage/v1/object/public/artwork/<path>
```

These follow the database schema and are not versioned: prefer `catalogue_v1` for websites.

## Security model

- Every table has row-level security. Access is decided by `artist_members` roles through
  `is_member`, `can_edit` and `is_owner` functions in the migration.
- Child rows (images, editions, collection links) always take their `artist_id` from the
  piece, so they can't be attached to another artist's data.
- A workspace can't lose its last owner.
- Anonymous visitors can't read any table directly, only the `public_*` views and the
  `catalogue_v1` function, which list public pieces of artists with a live profile and leave
  out notes and hidden prices.
- Images live in one Storage bucket under `<artist_id>/<piece_id>/<random-id>.jpg`. Only
  editors of that artist can upload or delete. The bucket is public-read with
  unguessable paths, the same model image CDNs use, so image URLs work in reports, the
  public profile and on websites without signing.

## Development

```bash
npx supabase start          # local Postgres, Auth, Storage (Docker)
npx supabase db reset       # apply migrations to the local database
npm run test:rls            # 56 checks of the access rules and the catalogue API against the local stack
npm run typecheck
npx supabase gen types typescript --local > src/lib/database.types.ts   # after schema changes
```
