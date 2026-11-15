# Catalogue snapshot for the artist website

Artfolio is where the catalogue is kept. The artist website does not talk to Artfolio
when a visitor opens it: it bundles a JSON file, `src/data/artworks.json`, and this
folder is what keeps that file up to date.

| File | What it is |
| --- | --- |
| `snapshot.mjs` | The script. Reads the public catalogue, writes the website's JSON file. No dependencies, Node 22. |
| `snapshot.test.mjs` | Its tests (`npm run test:snapshot` in the app, or `node --test snapshot.test.mjs`). |
| `site-workflow.yml` | GitHub Actions workflow for the **website** repository: runs the script daily and on demand, commits the file when it changed. |

## How it works

1. The script calls Artfolio's public catalogue endpoint,
   `POST {SUPABASE_URL}/rest/v1/rpc/catalogue_v1` with `{"p_artist_slug": "<slug>"}` and the
   anon key. It returns only what is public: works marked public, of an artist whose public
   profile is live.
2. Each work that has an image becomes one entry. Works without an image are left out.
3. The entries are written to `src/data/artworks.json`. If nothing changed in the
   catalogue the file is byte-for-byte the same, so there is no commit and no redeploy.

Each entry:

```json
{
  "slug": "wave-xano-armenter",
  "title": "Wave",
  "year": 2018,
  "circa": false,
  "medium": "Acrylic on canvas",
  "subject": "Marine",
  "cm": { "h": 162, "w": 180 },
  "dims": "162 × 180 cm",
  "image": "https://<ref>.supabase.co/storage/v1/object/public/artwork/<path>",
  "thumb": "https://<ref>.supabase.co/storage/v1/object/public/artwork/<thumb path>",
  "w": 1600,
  "h": 1422,
  "selected": 0
}
```

- **Nothing private.** Only these fields are written. Prices, status, inventory numbers,
  descriptions and notes never reach the file, whatever the API returns.
- **`image` / `thumb`** are the first image of the work. `thumb` falls back to `image`.
  `w` and `h` are the pixel size of that image.
- **`cm`** is the size in centimetres (inches are converted, one decimal at most). The
  catalogue mixes "height × width" and "width × height", so the longer number is given to
  the longer side of the image. If the stated proportions are more than 15% away from the
  image's, `cm` is `null`: the numbers can't be trusted to scale the work.
- **`dims`** is the display text, height × width, from the corrected `cm`. When `cm` is
  `null` because of the 15% rule, `dims` still shows the numbers as catalogued. It is
  `null` only when the work has no height and no width.
- **Order:** selected works first, in their collection order; then newest first (undated
  last); then by title.

### What stops it writing

The script exits with an error and leaves the existing file exactly as it was when:

- the API can't be reached, answers anything but 200, or returns `null` (wrong slug, or
  the public profile is switched off);
- the catalogue format version is not 1;
- no work has an image;
- the new file would have **fewer than half** the works of the current one;
- the current file has selected works and the new one would have none (for example the
  "Selected" collection was renamed or made private).

The last two are there to catch accidents. If the change is intended, run with `--force`.

A work whose image has no pixel size recorded is left out and reported as a `PROBLEM`
line (a warning annotation in GitHub Actions); the rest of the snapshot is still written.
Opening the work in Artfolio and uploading the image again fixes it.

## The "Selected" collection

The website's Selected work page shows the works whose `selected` is not `null`, in that
order. It is driven from Artfolio:

1. In Artfolio, open **Collections** and create a collection named **Selected**.
2. Make the collection **public**.
3. Add the works and put them in the order they should appear.

The first work in the collection gets `"selected": 0`, the next `1`, and so on. Works in
the collection that have no image are skipped without leaving a gap. Everything else gets
`"selected": null`. To use a different collection, set `SELECTED_COLLECTION` to its name
(matching ignores upper/lower case).

Changes show on the website after the next snapshot: the nightly one, or right away with
"run now" below.

## Run it by hand

From the website repository:

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_ANON_KEY=<anon key> \
node scripts/snapshot-catalogue.mjs --dry-run
```

`--dry-run` prints what would change (counts, and the slugs added, removed and changed)
and writes nothing. Drop it to write the file; add `--force` to get past the two safety
checks above.

| Variable | Default | |
| --- | --- | --- |
| `SUPABASE_URL` | required | The Artfolio project URL |
| `SUPABASE_ANON_KEY` | required | The anon / publishable key. Public, the same one the browser uses. |
| `ARTIST_SLUG` | `xano-armenter` | The artist's profile address in Artfolio (`/p/<slug>`) |
| `SELECTED_COLLECTION` | `Selected` | Name of the public collection behind the Selected work page |
| `OUT` | `src/data/artworks.json` | File to write, relative to where the script is run |

## Set up the automatic refresh (once, in the website repository)

1. Copy `snapshot.mjs` to `scripts/snapshot-catalogue.mjs`.
2. Copy `site-workflow.yml` to `.github/workflows/catalogue-snapshot.yml`.
3. In **Settings → Secrets and variables → Actions → Variables**, add `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` as repository *variables*.
4. In **Settings → Actions → General → Workflow permissions**, allow read and write.
5. Decide how the site redeploys after the commit. The workflow has a marked place for it.
   If the host rebuilds on every push by itself, there is nothing to add. If the site is
   deployed by another GitHub Actions workflow, read the comment there: a commit pushed by
   a workflow does not start other workflows on its own.

The snapshot then runs every day at 04:23 UTC.

### Run now

After changing the catalogue, to update the website without waiting for the night:

- GitHub → the website repository → **Actions** → **Catalogue snapshot** → **Run workflow**, or
- `gh workflow run catalogue-snapshot.yml` from the website repository.

Tick **force** (or `-f force=true`) only when a big drop in the number of works is intended.

If a run fails, the website keeps its last good snapshot; the reason is in the run's log.

## Using it for another artist's site

Nothing in the script is specific to one artist.

- Set `ARTIST_SLUG` to the artist's slug, and `SELECTED_COLLECTION` / `OUT` if that site
  uses another collection name or file path. In the workflow these are the `ARTIST_SLUG`
  and `SELECTED_COLLECTION` repository variables and the `OUT:` line; the commit step
  names the same file.
- The artist's public profile must be live in Artfolio (**Settings**), and the works that
  should appear must be public.
- If that site wants a different JSON shape, the place to change is `toWork()` in
  `snapshot.mjs`: it lists every field that is written, in output order. Keep it a list of
  named fields rather than passing the API object through, so private data can't leak in
  later. The dimension rule is `dimensions()` and the ordering is the sort at the end of
  `buildSnapshot()`.
- If the catalogue API moves to a new version, the script refuses to run until
  `CATALOGUE_VERSION` and the mapping are updated.
