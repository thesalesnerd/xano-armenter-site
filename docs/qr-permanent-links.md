# Permanent QR links for Xano's paintings

Date: 2026-11-22. Branch: `claude/artfolio-qr`.

## How it works

Every label encodes **`https://xanoarmenter.com/qr/<inventory number>`**, e.g. `https://xanoarmenter.com/qr/XA-0001`.

- `api/qr.js` (a Vercel function; `vercel.json` rewrites `/qr/:id` to it) looks the number up in Artfolio's public catalogue (`catalogue_v1`, read-only, cached 5 minutes) and answers **302** to the work's page, `/archive/<slug>`.
- If Artfolio can't be reached, it uses `api/_qr-map.js`, a fallback map refreshed before every build by `scripts/qr-map.mjs` (and committed).
- A number that is unknown, or belongs to a hidden work (e.g. *Beach*, XA-0021), lands on `/archive` instead of an error.
- It accepts `xa-1`, `XA1` and `xa-0001` as well as `XA-0001`.

The label never has to change. If a work is renamed, gets a new slug, or the site is redesigned, only the lookup changes. **The one thing that must stay fixed is the inventory number.** Don't renumber works that have labels.

The redirect is a 302 (temporary) on purpose, so that browsers and scanners never cache the target as final.

## Work pages

All 94 public works have a page at `xanoarmenter.com/archive/<slug>` with the image, title, year, medium, dimensions, availability ("Available", or "Sold", plus the price where Artfolio publishes one) and an **Enquire about this work** link. This was checked against the catalogue: the map, the site snapshot and `tools/aa-audit/aa-qr-map.csv` agree on all 94.

What was missing, and is now fixed:
- **Link previews.** The site is a single-page app, so every URL used to share the same generic title and no image. `scripts/prerender-works.mjs` runs after `vite build` and writes `dist/archive/<slug>/index.html` for each work, with its own `<title>`, description, canonical URL, Open Graph tags, Twitter card and schema.org `VisualArtwork` JSON-LD, plus a `<noscript>` copy of the work. Vercel serves these before the SPA rewrite.
- **Availability** was only shown for sold or priced works. It is now always shown. ⚠ Artfolio marks all 95 works `available`, because AA's sold status was never exported (see the ledger, §2). Sold works need marking in Artfolio before launch.
- **Tab title.** The browser tab now shows the work's title while it is open.

Known limit: a work added in Artfolio after the last build gets the generic preview until the next build. The page itself works at once on the live-catalogue site.

## Artfolio admin (QR in the app)

`patches/artfolio-app/0001-qr-codes-and-labels.patch` applies to `artfolio-app` with `git am`. It needs `npm install`, because it adds the `qrcode` dependency.
- **Piece page → "QR code" panel:** a preview, the permanent link, and **PNG** (1200 px) and **SVG** downloads, plus a "Print label" shortcut. It warns when the piece is private.
- **Reports → QR labels** (`/a/<artist>/reports/labels`): choose works (search, select all or clear; public works are preselected), a label size (38×21, 50×30, 63.5×38 or 99×38 mm, or custom), A4 or Letter, the gap, cut lines, and what to print (title, inventory #, artist, year · medium · size, link text). It prints at real millimetres.
- Codes use the artist's **Website** from Settings. **Mike: set Website to `https://xanoarmenter.com` in Artfolio → Settings.** Until then, the label page has a field to type it in, and the piece panel asks for it.
- No database change was needed: no migration, no RLS change, no catalogue rows touched.

## Tests

- `npm run test:qr`: unit tests for the redirect (normalising numbers, mapping, fallback, unknown numbers) and the prerendered meta tags.
- `node tests/qr-scan.e2e.mjs`: Playwright opens `docs/qr-labels.html`, screenshots and **decodes** the QR on labels XA-0001, XA-0008, XA-0042 and XA-0092, follows each decoded URL against the built site served the way `vercel.json` routes it, and checks the 302, the rendered work (title, enquire link) and the `og:title`. All 4 pass.
- Vercel preview of this branch: `/qr/xa-1` → *About the future* page with full meta tags; `/qr/XA-0021` → `/archive`.
- The Artfolio pages were checked in Chromium against a mocked session: the PNG/SVG downloads, 94 labels with 94 codes, and print layout.

## Transition note for the Artwork Archive profile (text only)

Paste into the AA **profile bio / About** (Mike or Xano, logged in). The short version can go in each artwork's description.

**Profile (English):**
> **This catalogue has moved.** Xano Armenter's complete archive of paintings now lives at **xanoarmenter.com**, with every work, current availability and a direct line to the studio. If you scanned a label on the back of a painting, you'll find the same work at xanoarmenter.com/archive. New labels on the works link there directly. Enquiries: via xanoarmenter.com/contact.

**Profile (Español):**
> **Este catálogo se ha trasladado.** El archivo completo de pinturas de Xano Armenter está ahora en **xanoarmenter.com**, con todas las obras, su disponibilidad y contacto directo con el estudio. Si has escaneado la etiqueta del dorso de un cuadro, encontrarás la misma obra en xanoarmenter.com/archive. Las nuevas etiquetas enlazan allí directamente. Consultas: xanoarmenter.com/contact.

**Per artwork (one line):**
> This work's page has moved to xanoarmenter.com/archive/<slug>. / Esta obra está ahora en xanoarmenter.com/archive/<slug>.

(The `<slug>` for each work is in `tools/aa-audit/aa-qr-map.csv`, column `site_url`.)

**Order of steps:** put the note up now → print and apply the new labels (`docs/qr-labels.html`, or Artfolio → Reports → QR labels) → run AA's data export → only then cancel AA (see the ledger, §4 and §6).
