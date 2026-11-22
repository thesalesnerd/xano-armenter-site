# Merge notes: Website section (branch `claude/xano-website-stories`)

What this branch adds, who should merge what, and how it was tested. Stories,
ranking and wireframes: [`xano-website-user-stories.md`](xano-website-user-stories.md),
[`website-section-wireframes.html`](website-section-wireframes.html).

## 1. Database: already applied

`artfolio/supabase/migrations/20261122120000_site_content.sql` was applied to
the live project (`trcqmiemvyoxeetgfguo`) on 2026-11-22, after the local tests
passed. It is **additive only**:

- new tables `site_content` (one row per artist: draft, published copy, who/when)
  and `site_content_versions` (every publish);
- RLS: workspace members read; owners and editors (`can_edit`) may insert a row
  and update **only the `draft` column** (column grants); no client delete;
- functions `publish_site_content(artist_id)`, `discard_site_draft(artist_id)`,
  `restore_site_version(version_id)` (security definer, check `can_edit`), and
  `site_content_v1(artist_slug)` for anon: the published copy only, only while
  the artist's public profile is on (same pattern as `catalogue_v1`);
- nothing existing is altered, replaced or dropped; no catalogue row was touched.

Checks:

```bash
bash artfolio/supabase/tests/run-local.sh      # throwaway Postgres: base schema + migration + 7 access-rule tests
node artfolio/supabase/tests/check-additive.mjs artfolio/supabase/migrations/20261122120000_site_content.sql \
  --live <json array of public table/function names>   # names must not exist yet
```

"Only Xano can edit" means: only owners and editors of the `xano-armenter`
workspace. Today that is Mike's login; Xano gets it when the backend session
adds his login as owner or editor. Nothing else is needed for him to edit.

## 2. Artfolio app: for the parity session

Patch: `artfolio/patches/0001-website-section.patch`, made with
`git format-patch` against `artfolio-app` at `326621f`; `git apply --check` is clean there.

```bash
git checkout artfolio-app            # or the parity branch
git am < <path>/artfolio/patches/0001-website-section.patch
npm run typecheck
```

It adds `src/pages/Website.tsx`, `src/components/WorkPicker.tsx`,
`src/lib/siteContent.ts`, the migration file, one route in `src/main.tsx` and
one nav item ("Website") in `src/components/Layout.tsx`. No dependency changes.
`siteContent.ts` uses an untyped client for the two new tables, so
`database.types.ts` doesn't have to be regenerated (regenerating later is fine).

Behaviour to know about:

- The preview frame loads the artist's **Settings → Website** address
  (`artists.website`, `https://xanoarmenter.com` for Xano) with `?xa-preview=1`.
  `?site=<url>` on the Website page overrides it for that browser tab (used to
  point at a preview deploy).
- Until the site changes below are in production, the preview shows a note
  ("The preview isn't answering yet…") and the fields start empty, with placeholders.
  Editing and publishing still work.

## 3. Website: for the backend session (production deploys)

Site changes are on this branch, on top of `claude/artfolio-backend` at `a0f0596`:

| File | Change |
|---|---|
| `src/content.ts` (new) | Content store: bundled copy, then `/api/site-content`, then the draft from the Artfolio preview frame (postMessage, allow-listed origins only). Cleans everything it receives; all of it is rendered as text. |
| `api/site-content.mjs` (new) | Published content, CDN-cached 60 s like `/api/catalogue`. Previews accept `?artist=`. |
| `scripts/snapshot-site-content.mjs` (new), `src/data/site-content.json` (new) | Build-time snapshot (`npm run content`, part of `npm run build`); falls back to the committed file. |
| `scripts/site-content.test.mjs` (new) | `npm run test:content`. |
| `src/i18n.tsx` | `useI18n().t` lays Xano's texts over the built-in ones; `useContact()`; `builtInText()` for the editor. |
| `src/data.ts` | Hero, featured and practice come from the content, falling back to the built-in picks, then to Selected, never repeating a work. `DEFAULT_PICKS`. |
| `src/cv.ts` | `useCv()`; an emptied list hides its column. |
| `src/site.tsx` | Uses the above; enquiry email, Instagram and gallery line from the content; preview ribbon. |
| `src/main.tsx`, `src/index.css` | Start-up hook; ribbon style. |

Merge: `git merge origin/claude/xano-website-stories` into the branch you deploy
(it is a fast-forward of `claude/artfolio-backend` at `a0f0596` plus these
commits). Conflicts are only likely in `src/site.tsx` / `src/data.ts` if those
changed meanwhile. Then `npm run build` as usual.

Production behaviour after the merge:

- With nothing published (the state right now), the site is **identical** to
  today: every field falls back to the current text and picks.
- After Xano publishes, the site shows it within about a minute, without a redeploy.
- **Preview origins:** the site accepts drafts only from
  `https://artfolio-sandy.vercel.app`, `https://artfolio-*-mike-8009s-projects.vercel.app`,
  and localhost, plus `VITE_ADMIN_ORIGINS` (comma-separated) at build time. If
  Artfolio moves to another domain, add it there.
- The enquiry address still defaults to the temporary `CONTACT_EMAIL` in
  `src/i18n.tsx` until Xano sets his own in Website → Contact. Setting it there is
  the quickest way to stop enquiries going to the placeholder address.

## 4. End-to-end test

`artfolio/e2e/website.e2e.mjs` (Playwright): logs in to Artfolio as a test
editor, opens Website pointed at a site deploy, picks a new big picture and three
featured works, edits the artist statement, checks the live preview follows,
checks visitors still see the old content, publishes, waits for the deployed
site to show the new statement, hero and featured works, and checks Earlier
versions.

```bash
ADMIN_URL=http://localhost:5173 SITE_URL=https://xano-website-stories.vercel.app \
SITE_JWT=<_vercel_jwt cookie from a share link> TEST_EMAIL=… TEST_PASSWORD=… \
SHOTS=<dir> node artfolio/e2e/website.e2e.mjs
```

### Run on 2026-11-22

- Site: preview deploy `xano-website-stories.vercel.app` (alias of
  `dpl_3iFGCwCj1fMPrziYrs9knhztbH2m`, built from this branch). Admin: Artfolio
  with the patch applied, run locally against the live database.
- Test login: a temporary editor of `xano-armenter` (`mike+website-test@…`),
  created for the run and deleted afterwards.
- Result: **all steps passed.** The preview followed every change at once. The
  public API kept the old content until Publish. About 1–2 minutes after
  publishing, the deployed site showed the new statement, hero (alt "Sense
  parets, …") and featured works, without the preview ribbon. Earlier versions
  listed the publish as "on your website now".
- Restore: before the run, no website content existed for any artist, so
  restoring meant removing what the test created: its `site_content` row and
  version, its membership and its login. Afterwards `site_content_v1('xano-armenter')`
  returns `{}` again, so the site shows its built-in text. No catalogue row was
  written by the test or the migration.
- Not covered by the browser run: "Look at this version" and "Discard changes"
  in the UI, because there was only one version. The database functions behind
  them are covered by `run-local.sh` (tests 6 and 4).
- Environment note: previews are protected and `vercel.com` isn't reachable from
  the test sandbox, so the test takes the preview's `_vercel_jwt` cookie
  (`SITE_JWT`) from a share link instead of following the share redirect.

## 5. Deployed to production (2026-11-22, at Mike's request)

- **Website** (`xanoarmenter.com`): deployed from this branch (`3260039`),
  which is what was in production (`a0f0596`) plus this work. It does **not**
  include `claude/artfolio-backend`'s later QR merge (`7481c3b`); the backend
  session ships that as before and should merge this branch when it does.
  Nothing is published yet, so visitors see the site unchanged.
- **Artfolio** (`artfolio-sandy.vercel.app`): built from `claude/artfolio-parity`
  at `e5ce02f` (exactly what was live) plus the Website patch, deployed as
  static files like the parity session's deploys. The patch rebased onto
  parity is `artfolio/patches/0001-website-section-on-parity.patch` (one
  trivial conflict in `src/main.tsx`: both sides add imports and routes).
  **Parity session: apply that patch before your next production deploy, or the
  Website section disappears again.**
