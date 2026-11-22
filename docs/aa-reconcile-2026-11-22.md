# AA → Artfolio reconciliation, 2026-11-22

Source: AA Inventory Report exported by Mike on 2026-11-22 12:37 (27 pages, 102 records, 102 images),
compared with the 2026-04-16 report and with Artfolio (`xano-armenter`). Parsed records:
`tools/aa-audit/aa-inventory-report-2026-04-16-vs-2026-11-22.json`; importer input:
`tools/aa-audit/aa-inventory-report-2026-11-22.csv`. Imported with the Artwork Archive importer
(dry run first, then apply; a second run plans nothing).

## Changes in AA since April

| Work | Change in AA | Artfolio now |
|---|---|---|
| Algo pasa | new | XA-0104, private, image from the report |
| Bedrock | new (At My Studio) | XA-0105, private, image |
| Goodbye New York | new (no dimensions in AA) | XA-0106, private, image |
| Ground | new (At My Studio) | XA-0107, private, image |
| Pots i Xipres | new (Camp 3) | XA-0108, private, image |
| Under Construction | new, 80 × 160 cm (Camp 3) | XA-0109, private, image |
| Under Construction | a second AA record with no image and no dimensions | **not imported** (looks like an empty draft in AA) |
| Drops 1 (XA-0024) | price $1,000 | price 1,000 USD |
| Break More Walls (XA-0022) | location “Coleccion Marcelino Armenter & Emilia Jordi (Madrid)” (was At My Studio) | location updated to match AA; status left “available” |

Images are the 600 px copies embedded in the report. Replace them with full-size photos when available.
New works are private until someone decides to publish them.

## Labels export

`ArtworkLabels-xano-armenter-20261122123714.pdf` (11 pages) is AA's text-only wall-label sheet:
artist, title, year, medium, size, price. It contains **no QR codes and no links**, so it doesn't
answer which URL the physical QR labels open. That still needs one label scanned with a phone.

## Importer fixes found by this run (before anything was written)

- A work whose title was corrected in Artfolio (“Luz blanca /White Ligth” → “White Light”) would
  have been created again. Title-slug matches are now accepted when the slug is the one AA gave the work.
- A price filled into a work that had the default currency kept that currency (Drops 1 would have
  been 1,000 EUR). A filled-in price now brings its currency.
- AA's Spanish media (“Acrilico sobre tela/telal/telaL”) are translated as Artfolio stores them.
