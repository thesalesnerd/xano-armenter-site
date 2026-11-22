# Artfolio changes for the Website section

For the Artfolio parity session to apply to `artfolio-app`. The full notes are in
`docs/xano-website-stories-merge.md`.

- `patches/0001-website-section.patch`: `git am` onto `artfolio-app` (based on `326621f`).
- `supabase/migrations/20261122120000_site_content.sql`: the migration (also in the
  patch). **Already applied to the live project.**
- `supabase/tests/`: `run-local.sh` (throwaway Postgres, access-rule tests and
  additive check), `check-additive.mjs`.
- `e2e/website.e2e.mjs`: the Playwright end-to-end test.
