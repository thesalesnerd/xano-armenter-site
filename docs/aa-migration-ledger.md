# Artwork Archive → Artfolio migration ledger

Audit date: 2026-11-22. Scope: everything Xano Armenter has in Artwork Archive (AA, `artworkarchive.com/profile/xano-armenter`, AA user 111754). It checks whether each item is in Artfolio (Supabase project `trcqmiemvyoxeetgfguo`, artist `xano-armenter`) and on the live site (xanoarmenter.com), and whether the QR labels on the paintings keep working.

All Supabase access in this audit was read-only. Nothing was written, deleted or cancelled anywhere.

## Bottom line

- **Every AA artwork is in Artfolio: 95 of 95.** Each one has its image, title, medium and dimensions (where AA had them), and the year, subject and price where AA had those. 94 of them are public on the site. The one that isn't is *Beach* (XA-0021), hidden on purpose because the image shows the work hanging in a room.
- **Gaps in the data:** 55 storage locations and 1 price were not imported, and the import created 8 duplicate rows. The exact SQL to fix all three is in [`tools/aa-audit/proposed-fixes.sql`](../tools/aa-audit/proposed-fixes.sql). **It has not been run and needs Mike's OK.**
- **Data that never left AA:** anything private to the AA account was never exported. That covers notes, sales and invoices, contacts, exhibitions, provenance, documents, extra images and sold status. Only an AA data export, done by Mike while logged in, can bring these over. See [§2](#2-what-aa-holds-and-what-we-could-see).
- **QR codes:** the labels point at artworkarchive.com, which we cannot redirect. **They stop working when the AA subscription ends**, because AA deactivates the Public Profile on cancellation. The recommendation is to reprint the labels pointing at xanoarmenter.com, keeping AA on its cheapest plan until that is done. A printable sheet of the 94 new labels is ready at [`docs/qr-labels.html`](qr-labels.html). See [§4](#4-qr-codes).

## 1. Counts explained (103 / 102 / 94 / 95)

| Number | What it is |
|---|---|
| **95** | Real AA artworks. This is the count in AA's own Inventory Report (PDF export, 2026-04-16, 26 pages, 95 records, 95 images) and the number of unique works in the profile scrape (`tools/scraped-xano.json`, 95 slugs). |
| **103** | Rows in Artfolio. That is the 95 works plus **8 duplicates**. The source JSON (`data/artwork.json`) listed 8 works twice: once complete, and once with no year, no image and no AA page. The importer turned both into pieces. The duplicates got inventory numbers XA-0093 to XA-0103 and slugs ending `-2` where the plain slug was taken. |
| **102** | Public rows in Artfolio, and what the Catalogue API reports. That is 103 minus *Beach* (`is_public = false`). |
| **94** | Works shown on `/p/xano-armenter` and on the site. That is 102 minus the 8 imageless duplicates, because the profile and the site snapshot skip works with no image. The 94 are exactly the 95 AA works minus *Beach*. |

So no real work is missing. Once the duplicates are removed, Artfolio will show **95 rows, 94 public**, and every count will agree.

## 2. What AA holds, and what we could see

AA's public pages sit behind a Cloudflare bot check, which refuses automated fetches from this environment (HTTP 403 `cf-mitigated: challenge`). The Wayback Machine is not reachable from here either. The AA side of this audit therefore comes from the copies already in the repo:

- `data/InventoryReport-xano-armenter-20260416190206.pdf`: AA's own export. Per work it has title, price, medium, dimensions, location and the primary image. Parsed to `tools/aa-audit/aa-inventory-report-2026-04-16.json`.
- `data/artwork.json`: title, year, medium, dimensions, subject, price and primary image.
- `tools/aa-migration-manifest.json`, `tools/scraped-xano.json` and `tools/image-urls.json`: the public page URL and primary image URL for each work.

| AA field | In the AA data we have? | In Artfolio? | Notes |
|---|---|---|---|
| Title | yes (95) | yes (95) | Titles match. AA ends 8 titles with a stray "." in the PDF; Artfolio drops it. |
| Year | yes (92; 3 have none in AA either) | yes (92) | Matches. *A un poema…* is stored as circa 2017. |
| Medium | yes (95) | yes (95) | Matches once AA's Spanish/English mix is normalised (e.g. "Acrilico sobre telal" → "Acrylic on canvas"). |
| Dimensions | yes (87; 8 have none in AA either) | yes (87) | Matches. |
| Price | yes (14) | 13 | **XA-0008 *A un poema de Rossend Bonas* is missing $5,000**: the source JSON had no price, but the PDF does. Prices are in USD. The other 81 works have no price in AA. |
| Subject | yes (34) | yes (34) | Matches. |
| Location | yes (55; "Camp 3" ×48, "At My Studio" ×5, "Hospital Clinic" ×1, "Unknown" ×1) | **0** | **Never imported.** The fix is ready. |
| Primary image | yes (95) | yes (95) | All rehosted in Supabase storage. None depend on AA's CDN any more. |
| Additional images | **unknown** | — | The scrapes and the PDF only captured the primary image. Whether any work has more images in AA can only be checked logged in or via AA's export. |
| AA inventory number | not exported | Artfolio numbers XA-0001… | Artfolio assigned its own numbers. If physical labels show AA's numbers, those will not match. |
| Status (available / sold / on loan / gift) | **not exported** | all `available` | All 95 are `available` in Artfolio by default. Sold works may be marked wrongly. |
| Description, private notes, signature, framed size, edition | **not exported** | empty | — |
| Provenance, exhibitions, sales / invoices, consignments | **not exported** | no tables | Artfolio's schema has no tables for these yet. |
| Contacts / collectors | **not exported** | no table | Artfolio's schema has no contacts table yet. |
| Documents / attachments | **not exported** | no storage for them | — |
| Collections / series | none seen in AA's public data | "Selected" (24) | "Selected" is the site's own curation, not from AA. |

**Only Mike, logged in to AA, can produce the rest.** Before AA is cancelled, he should run AA's data export (AA's cancellation help article recommends exporting first). He should also download any extra images and documents, and save the export into the repo, e.g. `data/aa-export-YYYY-MM-DD/`. Any non-empty columns can then be diffed the same way. AA keeps a cancelled account view-only "for up to one year", which is a safety net but not a plan.

## 3. Per-work ledger

"Images AA → AF" counts the primary image only (see above). "Gaps" lists fields AA has that Artfolio lacks, plus fields missing on both sides, which are marked as such.

| Inv # | Title | AA page / QR target (`artworkarchive.com/profile/xano-armenter/artwork/…`) | In Artfolio | Images AA → AF | Public | New page (`xanoarmenter.com/archive/…`) | Gaps |
|---|---|---|---|---|---|---|---|
| XA-0001 | About the future | `about-the-future` | yes | 1 → 1 | yes | `about-the-future` | — |
| XA-0002 | Taula de treball 2 | `taula-de-treball-2` | yes | 1 → 1 | yes | `taula-de-treball-2` | — |
| XA-0003 | Ultramar 1 | `ultramar-1` | yes | 1 → 1 | yes | `ultramar-1` | — |
| XA-0004 | Ultramar 2 / Underwater 2 | `ultramar-2-underwater-2` | yes | 1 → 1 | yes | `ultramar-2-underwater-2` | — |
| XA-0005 | Ultramar 3 | `ultramar-3` | yes | 1 → 1 | yes | `ultramar-3` | — |
| XA-0006 | Ultramar 4 / Underwater 4 | `ultramar-4-underwater-4` | yes | 1 → 1 | yes | `ultramar-4-underwater-4` | — |
| XA-0007 | Wave | `wave-xano-armenter` | yes | 1 → 1 | yes | `wave-xano-armenter` | — |
| XA-0008 | A un poema de Rossend Bonas (serie de 4 piezas) | `a-un-poema-de-rossend-bonas-serie-de-4-piezas` | yes | 1 → 1 | yes | `a-un-poema-de-rossend-bonas-serie-de-4-piezas` | price $5,000 missing |
| XA-0009 | Jo pintor | `jo-pintor` | yes | 1 → 1 | yes | `jo-pintor` | — |
| XA-0010 | Pampagulles | `pampagulles` | yes | 1 → 1 | yes | `pampagulles` | — |
| XA-0011 | Street walkby | `street-walkby` | yes | 1 → 1 | yes | `street-walkby` | location “Camp 3” missing |
| XA-0012 | La cova dels colors (Retina 2) | `la-cova-dels-colors-retina-2` | yes | 1 → 1 | yes | `la-cova-dels-colors-retina-2` | location “At My Studio” missing |
| XA-0013 | Agora | `agora-xano-armenter` | yes | 1 → 1 | yes | `agora-xano-armenter` | — |
| XA-0014 | Carrer ple de gent | `carrer-ple-de-gent` | yes | 1 → 1 | yes | `carrer-ple-de-gent` | — |
| XA-0015 | Chanel sources | `chanel-sources` | yes | 1 → 1 | yes | `chanel-sources` | — |
| XA-0016 | En el aire | `en-el-aire-xano-armenter` | yes | 1 → 1 | yes | `en-el-aire-xano-armenter` | — |
| XA-0017 | Seres invisibles | `seres-invisibles` | yes | 1 → 1 | yes | `seres-invisibles` | location “Camp 3” missing |
| XA-0018 | La riqueza / Content is waiting | `la-riqueza-content-is-waiting` | yes | 1 → 1 | yes | `la-riqueza-content-is-waiting` | — |
| XA-0019 | Public and private | `public-and-private` | yes | 1 → 1 | yes | `public-and-private` | location “Camp 3” missing |
| XA-0020 | Sense parets | `sense-parets` | yes | 1 → 1 | yes | `sense-parets` | — |
| XA-0021 | Beach | `beach-xano-armenter` | yes | 1 → 1 | **no** | — (hidden) | location “Hospital Clinic” missing; no dimensions in AA or AF |
| XA-0022 | Break More Walls | `break-more-walls` | yes | 1 → 1 | yes | `break-more-walls` | location “At My Studio” missing |
| XA-0023 | City 1 and City 2 | `city-1-and-city-2` | yes | 1 → 1 | yes | `city-1-and-city-2` | location “At My Studio” missing |
| XA-0024 | Drops 1 | `drops-1` | yes | 1 → 1 | yes | `drops-1` | location “Unknown” missing |
| XA-0025 | Not nothing | `not-nothing-xano-armenter` | yes | 1 → 1 | yes | `not-nothing-xano-armenter` | — |
| XA-0026 | Broken walls 2 | `broken-walls-2` | yes | 1 → 1 | yes | `broken-walls-2` | — |
| XA-0027 | Celebration | `celebration-xano-armenter` | yes | 1 → 1 | yes | `celebration-xano-armenter` | location “Camp 3” missing |
| XA-0028 | Close up unit | `close-up-unit` | yes | 1 → 1 | yes | `close-up-unit` | — |
| XA-0029 | Exoplaneta | `exoplaneta` | yes | 1 → 1 | yes | `exoplaneta` | — |
| XA-0030 | Explorer | `explorer-xano-armenter` | yes | 1 → 1 | yes | `explorer-xano-armenter` | — |
| XA-0031 | Burning Room | `burning-room` | yes | 1 → 1 | yes | `burning-room` | location “Camp 3” missing |
| XA-0032 | Finestra oberta | `finestra-oberta` | yes | 1 → 1 | yes | `finestra-oberta` | location “Camp 3” missing |
| XA-0033 | Lo viejo y lo nuevo | `lo-viejo-y-lo-nuevo` | yes | 1 → 1 | yes | `lo-viejo-y-lo-nuevo` | location “Camp 3” missing |
| XA-0034 | Pintar la natura | `pintar-la-natura` | yes | 1 → 1 | yes | `pintar-la-natura` | location “Camp 3” missing |
| XA-0035 | Abstraccio de paisatge | `abstraccio-de-paisatge` | yes | 1 → 1 | yes | `abstraccio-de-paisatge` | location “Camp 3” missing |
| XA-0036 | Abstraccio de paisatge 2 | `abstraccio-de-paisatge-2` | yes | 1 → 1 | yes | `abstraccio-de-paisatge-2` | location “Camp 3” missing |
| XA-0037 | Caterina | `caterina-xano-armenter` | yes | 1 → 1 | yes | `caterina-xano-armenter` | location “Camp 3” missing |
| XA-0038 | Pintar la natura 2 | `pintar-la-natura-2` | yes | 1 → 1 | yes | `pintar-la-natura-2` | location “Camp 3” missing |
| XA-0039 | Tornar al origen | `tornar-al-origen` | yes | 1 → 1 | yes | `tornar-al-origen` | location “Camp 3” missing |
| XA-0040 | Dark hour | `dark-hour` | yes | 1 → 1 | yes | `dark-hour` | location “Camp 3” missing |
| XA-0041 | Les Ferreres | `les-ferreres` | yes | 1 → 1 | yes | `les-ferreres` | location “Camp 3” missing |
| XA-0042 | Luz blanca / White Light | `luz-blanca-white-ligth` | yes | 1 → 1 | yes | `luz-blanca-white-ligth` | location “Camp 3” missing |
| XA-0043 | Studio formula | `studio-formula` | yes | 1 → 1 | yes | `studio-formula` | location “Camp 3” missing |
| XA-0044 | Ciutat oberta | `ciutat-oberta` | yes | 1 → 1 | yes | `ciutat-oberta` | location “Camp 3” missing |
| XA-0045 | Red table with yellow bird | `red-table-with-yellow-bird` | yes | 1 → 1 | yes | `red-table-with-yellow-bird` | location “Camp 3” missing |
| XA-0046 | Studio corner | `studio-corner-xano-armenter` | yes | 1 → 1 | yes | `studio-corner-xano-armenter` | location “Camp 3” missing |
| XA-0047 | La mente tambien juega (Opening) | `la-mente-tambien-juega-opening` | yes | 1 → 1 | yes | `la-mente-tambien-juega-opening` | location “Camp 3” missing |
| XA-0048 | Lets Dance | `lets-dance-xano-armenter` | yes | 1 → 1 | yes | `lets-dance-xano-armenter` | location “Camp 3” missing |
| XA-0049 | The club | `the-club-xano-armenter` | yes | 1 → 1 | yes | `the-club-xano-armenter` | — |
| XA-0050 | The New Baby | `the-new-baby-xano-armenter` | yes | 1 → 1 | yes | `the-new-baby-xano-armenter` | — |
| XA-0051 | Continium | `continium` | yes | 1 → 1 | yes | `continium` | — |
| XA-0052 | Graffiti Town | `graffiti-town-xano-armenter` | yes | 1 → 1 | yes | `graffiti-town-xano-armenter` | no dimensions in AA or AF |
| XA-0053 | Hot pipes | `hot-pipes` | yes | 1 → 1 | yes | `hot-pipes` | location “Camp 3” missing |
| XA-0054 | Ingeni I | `ingeni-i` | yes | 1 → 1 | yes | `ingeni-i` | — |
| XA-0055 | Ingeni II | `ingeni-ii` | yes | 1 → 1 | yes | `ingeni-ii` | location “Camp 3” missing |
| XA-0056 | Ingeni III | `ingeni-iii` | yes | 1 → 1 | yes | `ingeni-iii` | — |
| XA-0057 | Ingeni petit | `ingeni-petit` | yes | 1 → 1 | yes | `ingeni-petit` | location “Camp 3” missing |
| XA-0058 | Jerry's Lab | `jerry-s-lab` | yes | 1 → 1 | yes | `jerry-s-lab` | — |
| XA-0059 | La Reserva | `la-reserva` | yes | 1 → 1 | yes | `la-reserva` | no dimensions in AA or AF |
| XA-0060 | Laberint | `laberint` | yes | 1 → 1 | yes | `laberint` | location “At My Studio” missing |
| XA-0061 | Laboratori | `laboratori` | yes | 1 → 1 | yes | `laboratori` | location “Camp 3” missing |
| XA-0062 | Loop | `loop-xano-armenter` | yes | 1 → 1 | yes | `loop-xano-armenter` | — |
| XA-0063 | Mecanic | `mecanic` | yes | 1 → 1 | yes | `mecanic` | location “Camp 3” missing |
| XA-0064 | Monotipo | `monotipo-xano-armenter` | yes | 1 → 1 | yes | `monotipo-xano-armenter` | location “Camp 3” missing |
| XA-0065 | Red Pipe | `red-pipe-xano-armenter` | yes | 1 → 1 | yes | `red-pipe-xano-armenter` | location “Camp 3” missing |
| XA-0066 | Secret formula | `secret-formula` | yes | 1 → 1 | yes | `secret-formula` | location “Camp 3” missing |
| XA-0067 | Sota No | `sota-no` | yes | 1 → 1 | yes | `sota-no` | location “Camp 3” missing |
| XA-0068 | The Fool (Retrat) | `the-fool-retrat` | yes | 1 → 1 | yes | `the-fool-retrat` | — |
| XA-0069 | La Siesta | `la-siesta-xano-armenter` | yes | 1 → 1 | yes | `la-siesta-xano-armenter` | no dimensions in AA or AF |
| XA-0070 | Painting mix | `painting-mix` | yes | 1 → 1 | yes | `painting-mix` | location “Camp 3” missing |
| XA-0071 | Paisatge pintat | `paisatge-pintat` | yes | 1 → 1 | yes | `paisatge-pintat` | location “Camp 3” missing |
| XA-0072 | The Truck Driver | `the-truck-driver` | yes | 1 → 1 | yes | `the-truck-driver` | no dimensions in AA or AF |
| XA-0073 | Dos figuras | `dos-figuras-xano-armenter` | yes | 1 → 1 | yes | `dos-figuras-xano-armenter` | location “Camp 3” missing |
| XA-0074 | House | `house-xano-armenter` | yes | 1 → 1 | yes | `house-xano-armenter` | location “Camp 3” missing |
| XA-0075 | No Se Conocen | `no-se-conocen` | yes | 1 → 1 | yes | `no-se-conocen` | location “Camp 3” missing |
| XA-0076 | Big Move | `big-move` | yes | 1 → 1 | yes | `big-move` | location “Camp 3” missing |
| XA-0077 | Interesting (Red & black) | `interesting-red-black` | yes | 1 → 1 | yes | `interesting-red-black` | — |
| XA-0078 | La Visita | `la-visita-xano-armenter` | yes | 1 → 1 | yes | `la-visita-xano-armenter` | location “Camp 3” missing |
| XA-0079 | Sink | `sink-xano-armenter` | yes | 1 → 1 | yes | `sink-xano-armenter` | — |
| XA-0080 | The breakfast | `the-breakfast` | yes | 1 → 1 | yes | `the-breakfast` | — |
| XA-0081 | Dirty dishes | `dirty-dishes-xano-armenter` | yes | 1 → 1 | yes | `dirty-dishes-xano-armenter` | — |
| XA-0082 | El Bostezo | `el-bostezo` | yes | 1 → 1 | yes | `el-bostezo` | — |
| XA-0083 | Wallpaper city | `wallpaper-city` | yes | 1 → 1 | yes | `wallpaper-city` | location “Camp 3” missing |
| XA-0084 | Estudi de estudi | `estudi-de-estudi` | yes | 1 → 1 | yes | `estudi-de-estudi` | location “Camp 3” missing |
| XA-0085 | Candy fallout | `candy-fallout` | yes | 1 → 1 | yes | `candy-fallout` | location “Camp 3” missing |
| XA-0086 | Desnudo | `desnudo-xano-armenter` | yes | 1 → 1 | yes | `desnudo-xano-armenter` | location “Camp 3” missing |
| XA-0087 | Doce y diez | `doce-y-diez` | yes | 1 → 1 | yes | `doce-y-diez` | location “Camp 3” missing |
| XA-0088 | Plantas | `plantas-xano-armenter` | yes | 1 → 1 | yes | `plantas-xano-armenter` | location “Camp 3” missing |
| XA-0089 | Taula de treball | `taula-de-treball` | yes | 1 → 1 | yes | `taula-de-treball` | location “Camp 3” missing |
| XA-0090 | Bodegon Amb Marge | `bodegon-amb-marge` | yes | 1 → 1 | yes | `bodegon-amb-marge` | no dimensions in AA or AF |
| XA-0091 | Martini lady | `martini-lady-xano-armenter` | yes | 1 → 1 | yes | `martini-lady-xano-armenter` | location “At My Studio” missing |
| XA-0092 | Playa Negra | `playa-negra` | yes | 1 → 1 | yes | `playa-negra` | — |
| XA-0097 | Las abuelas | `las-abuelas` | yes | 1 → 1 | yes | `las-abuelas` | location “Camp 3” missing; no year in AA or AF; no dimensions in AA or AF |
| XA-0100 | Multiples realitats | `multiples-realitats` | yes | 1 → 1 | yes | `multiples-realitats` | location “Camp 3” missing; no year in AA or AF |
| XA-0101 | Pineda de Olle Pinell | `pineda-de-olle-pinell` | yes | 1 → 1 | yes | `pineda-de-olle-pinell` | location “Camp 3” missing; no year in AA or AF; no dimensions in AA or AF |

### Duplicate rows created by the import (proposed for deletion)

These 8 rows are public in Artfolio but have no image. The site and the profile skip them, which is why the public count is 94 and not 102. Each one has a complete twin in the table above.

| Inv # | Title | Artfolio slug | Why it is a duplicate |
|---|---|---|---|
| XA-0093 | Dirty dishes | `dirty-dishes` | no image, no year, no AA page (source_ref is the profile root); the real record is the one with the AA page |
| XA-0094 | Estudi de estudi | `estudi-de-estudi-2` | no image, no year, no AA page (source_ref is the profile root); the real record is the one with the AA page |
| XA-0095 | Hot pipes | `hot-pipes-2` | no image, no year, no AA page (source_ref is the profile root); the real record is the one with the AA page |
| XA-0096 | Ingeni petit | `ingeni-petit-2` | no image, no year, no AA page (source_ref is the profile root); the real record is the one with the AA page |
| XA-0098 | Luz blanca /White Ligth | `luz-blanca-white-ligth-2` | no image, no year, no AA page (source_ref is the profile root); the real record is the one with the AA page |
| XA-0099 | Monotipo | `monotipo` | no image, no year, no AA page (source_ref is the profile root); the real record is the one with the AA page |
| XA-0102 | Sense parets | `sense-parets-2` | no image, no year, no AA page (source_ref is the profile root); the real record is the one with the AA page |
| XA-0103 | Seres invisibles | `seres-invisibles-2` | no image, no year, no AA page (source_ref is the profile root); the real record is the one with the AA page |

## 4. QR codes

### What the labels encode

AA's label tool ("Artwork/QR Labels" report) offers three QR link types, according to AA help articles #4619740 and #802844:

1. **Public page.** "Links to the artwork's page on your Artwork Archive Public Profile." The work must be marked Public.
2. **Internal.** Opens the private piece record, which only works for someone logged in to Xano's AA account. Visitors get a login page.
3. **Custom.** Every label opens the same URL that you enter.

For Xano, the public artwork pages are `https://www.artworkarchive.com/profile/xano-armenter/artwork/<slug>`. These are the URLs recorded in `tools/aa-migration-manifest.json` for all 95 works, and they are listed per work in §3 and in [`tools/aa-audit/aa-qr-map.csv`](../tools/aa-audit/aa-qr-map.csv). AA documents no short-link or redirect service.

**Not verified:** no physical label has been scanned in this audit. **Mike: please scan one label with a phone and note the URL it opens.**
- If it is the `/profile/xano-armenter/artwork/…` URL above, the analysis below holds.
- If it is an `app.artworkarchive.com`/login URL, the labels are the "Internal" type and have never worked for the public. Reprinting then costs nothing in lost function.
- If it is a custom URL Mike controls, it can simply be pointed at the new site.

### The mapping

For all 94 public works the slug is the same on both sides:

`artworkarchive.com/profile/xano-armenter/artwork/<slug>` → `https://xanoarmenter.com/archive/<slug>`

All 94 target pages are confirmed present in the live site bundle (xano-armenter.vercel.app, checked 2026-11-22). The Artfolio page is also listed in the CSV: `artfolio-sandy.vercel.app/p/xano-armenter/w/<piece id>`. *Beach* has no public page on the new site.

### Can the old QR URLs keep working after AA is cancelled?

**No, not without AA.**
- AA's cancellation article says the Public Profile "will be deactivated" on cancellation. Every public-page QR then lands on a dead AA page.
- The URLs are on artworkarchive.com, so no DNS or redirect we control can catch them.
- AA has no feature to forward its profile or artwork pages elsewhere. Its "custom domain" help (#7124390) covers the opposite direction: forwarding *your* domain to AA.
- AA has no free plan, only a 14-day trial.

| Option | Keeps existing labels working? | Cost | Verdict |
|---|---|---|---|
| A. Keep AA on its cheapest plan with the Public Profile on | Yes, for as long as it is paid | Apprentice plan about **$9/mo billed annually (~$108/yr), $10/mo monthly**. It allows up to 100 works, and Xano has 95. Figures are third-party (Aug 2026) and could not be checked on AA's pricing page, which blocks automated access. One source claims a 2026 restructure with a $39/mo "Artist" plan. **It is also unverified whether the cheapest plan includes the Public Profile.** Mike should confirm both on AA's billing page. | Works, but means paying AA indefinitely |
| B. AA redirect / custom domain | — | — | **Does not exist** |
| C. Reprint labels pointing at xanoarmenter.com | Replaces them | Label stock and printing only. The sheet is generated: [`docs/qr-labels.html`](qr-labels.html) has 94 labels at 50 × 30 mm with title, inventory number and URL, regenerated by `tools/aa-audit/make-qr-labels.mjs`. Artfolio itself does not generate QR codes; nothing in the app or site code does. | **Recommended**, because the domain is Mike's to keep forever |
| D. In the meantime, add "This catalogue has moved to xanoarmenter.com" to the AA profile bio (and optionally each artwork description) | Softens the hand-over while AA is still paid | Free | Do it alongside C |

**Recommendation: C + D, with A as a time-boxed bridge.**
1. Keep AA paid (cheapest plan that keeps the Public Profile) until the new labels are on.
2. Put the "moved" notice on the AA profile now.
3. Print `docs/qr-labels.html` and stick the new labels over or next to the old ones on every work Xano still holds. Per the Inventory Report, 48 are at Camp 3 and 5 at his studio.
4. **The exception is works already sold or out with collectors.** Their old labels die with AA, and we have no sold list (see §2). If that list is long or the works matter, keep A going longer or send those owners a new label. Mike decides.
5. Cancel AA only after the data export (§2) and the relabelling are done.

Optional hardening for later, not done here because it touches the live site: give the site a permanent short route keyed on the inventory number, e.g. `xanoarmenter.com/w/XA-0012`. Labels would then survive a title or slug change. The current labels use `/archive/<slug>`, which exists today.

## 5. Fixes

| Fix | Status |
|---|---|
| Per-work AA → new-site QR map (`tools/aa-audit/aa-qr-map.csv`) | **Done** (repo only) |
| Printable replacement QR labels (`docs/qr-labels.html` + generator script) | **Done** (repo only) |
| Parsed AA Inventory Report (`tools/aa-audit/aa-inventory-report-2026-04-16.json`) | **Done** (repo only) |
| Fill 55 locations from the Inventory Report | **Proposed SQL, awaiting OK** |
| Set XA-0008 price to 5,000 USD | **Proposed SQL, awaiting OK** |
| Delete the 8 duplicate rows | **Proposed SQL, awaiting OK** (guarded: each delete skips a row that has gained an image, collection or edition) |
| Rebuild the site snapshot after the SQL | Not needed for counts, because the site already shows 94. A rebuild would only matter if locations or prices are shown, and the price for XA-0008 is. |

The SQL is in [`tools/aa-audit/proposed-fixes.sql`](../tools/aa-audit/proposed-fixes.sql). It runs in one transaction with a count check (expect 95 total, 94 public, 55 with location) before `commit`.

## 6. Decisions needed from Mike

1. **Approve the Supabase fixes** in `tools/aa-audit/proposed-fixes.sql`: 55 locations, 1 price, 8 duplicate deletions. Also decide whether "Unknown" (XA-0024 *Drops 1*) should be stored as a location or left empty.
2. **Scan one existing label** and report the URL it opens (see §4).
3. **Run AA's data export while logged in** and drop it in the repo, before cancelling anything. This is the only way to get notes, sold status, sales/invoices, contacts, exhibitions, provenance, documents and any extra images. Artfolio needs tables for contacts, sales and exhibitions if those turn out to be non-empty.
4. **Sold works.** Which works are sold or out with collectors? That decides how long AA has to stay paid (option A) for labels we can't replace.
5. **Confirm the AA plan and price** that keeps the Public Profile live, and choose the cancellation date (after steps 2–4 and the relabelling).
6. **Confirm *Beach* stays hidden.** It has no new QR target; it is a photo of a work in a room at Hospital Clinic.
7. **Confirm the live AA count is still 95.** The Inventory Report dates from 2026-04-16, and AA can't be checked from this environment. Anything added in AA since then would not be here.
