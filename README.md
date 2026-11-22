# Xano Armenter — artist site

Four-page site (Home, Selected work, About, Contact) plus a full archive, in
English and Spanish (`/es`). Built from the Figma design and Make prototype,
with the catalogue exported from Artwork Archive.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

The site is a single-page app, so the host must serve `index.html` for every
path. `vercel.json` and `public/_redirects` (Netlify, Cloudflare Pages) do
that; the build also writes `dist/404.html` for GitHub Pages.

## Where things are

| | |
|---|---|
| `data/artwork.json` | The catalogue (103 works) exported from Artwork Archive. |
| `scripts/build-data.py` | Builds `src/data/artworks.json` from it. The **selected works and their order** are the `SELECTED` list at the top. Run `npm run data` after changing it. |
| `public/artwork/` | Images (1600px) and `thumb/` (800px). |
| `src/i18n.tsx` | All copy in English and Spanish, and the enquiry email (`CONTACT_EMAIL`). |
| `src/cv.ts` | Exhibitions and commissions on the About page. |
| `src/data.ts` | Hero, the three home-page works and the practice image. |
| `src/components/Mosaic.tsx` | The uncropped mosaic of works. |
| `src/components/RoomView.tsx` | "Imagine it in your home": the painting at true size in a room photo (`public/rooms/`, scale constants in `ROOMS`), or over the visitor's own photo. |
| `src/components/PortraitSplash.tsx` | Animated portrait on the About page (see `HANDOFF-portrait-splash.md`). |
| `reference/google-site/CONTENT.md` | The artist's own statement and CV, the source for the copy. |

## Notes

- No prices are shown. Every work links to Contact with the work filled in.
- Paintings are never cropped, except the full-screen hero.
- The room view uses the catalogued size in centimetres. Works without a
  catalogued size are shown at an approximate size and say so.
- The Spanish copy and parts of the English copy are drafts for review.

## Catalogue updates (Artfolio)

The catalogue lives in Artfolio. The site shows edits made there (new work,
price, sold, hidden) within about a minute, with no redeploy:

- `api/catalogue.mjs` serves the public catalogue (`catalogue_v1`) in the
  site's format, built by the same code as the build snapshot
  (`scripts/snapshot-catalogue.mjs`). Vercel's CDN caches it for 60 s and
  serves the last good copy while refreshing or if Supabase is down.
- Pages render at once from the bundled `src/data/artworks.json` (refreshed
  on every build) and swap in the live copy when it arrives (`src/data.ts`).
  If the API fails, or returns no works, the bundled copy stays.
- `/sitemap.xml` is generated from the live catalogue (`api/sitemap.mjs`).
- `/admin` redirects to the Artfolio app (`vercel.json`).
- On preview deployments, `/api/catalogue?artist=<slug>` reads another artist,
  for testing.
