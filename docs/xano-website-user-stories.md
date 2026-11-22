# Xano's website, run from Artfolio: user stories

**Goal.** Xano Armenter is a painter, not a technical person. He should be able
to make xanoarmenter.com look the way he wants from Artfolio (his Artwork
Archive replacement), on his laptop or his phone, without asking anyone to
change code.

**How this was checked.** Every status below was checked against the code on
`claude/artfolio-backend` (the site: `src/site.tsx`, `src/data.ts`,
`src/i18n.tsx`, `src/cv.ts`, `api/catalogue.mjs`), `artfolio-app` (the admin)
and the live Supabase schema (`catalogue_v1`, `pieces`, `collections`,
`artists`) on 2026-11-22.

| Mark | Meaning |
|---|---|
| ✅ **Works today** | Xano can do it in Artfolio now and the site shows it within about a minute. |
| 🟡 **Partial** | Part of it works, or it only works through a workaround he would not find. |
| ❌ **Missing** | Only a developer can do it today (the text or choice is in the code). |
| 🔨 **Built here** | Missing today. Built end to end on `claude/xano-website-stories` (Phase 3). |

---

## Ranked list

Ranked by how much it matters to a working artist (sales, exhibitions,
credibility) times how often he would do it. "Often" means weekly or more,
"sometimes" means monthly or per show, and "rarely" means once a year or once ever.

| # | Story | Matters | How often | Today | After this branch |
|---|---|---|---|---|---|
| 1 | Show or hide a work on the site | High | Often | ✅ | ✅ |
| 2 | Mark a work sold; show or hide its price; "price on request" | High | Often | 🟡 | 🟡 |
| 3 | Choose and order the featured works on the home page | High | Sometimes | ❌ | 🔨 |
| 4 | Pick the hero image | High | Sometimes | ❌ | 🔨 |
| 5 | Preview before publishing, publish, undo, restore an earlier version | High | Every edit | ❌ | 🔨 |
| 6 | Edit the artist statement and bio, in English and Spanish | High | Sometimes | ❌ | 🔨 |
| 7 | Contact details, gallery representation, social links, where enquiries go | High | Rarely, but wrong today | ❌ | 🔨 |
| 8 | Add exhibitions (upcoming and past) and keep the CV up to date | High | Sometimes | ❌ | 🔨 (CV lists) / ❌ (upcoming banner) |
| 9 | Do all of this from his phone | High | Often | 🟡 | 🔨 for the Website section |
| 10 | Reorder the works on the Selected work page | Medium | Sometimes | 🟡 | 🟡 |
| 11 | Group works into series or collections with their own pages | Medium | Sometimes | 🟡 | 🟡 |
| 12 | News and press | Medium | Sometimes | ❌ | ❌ |
| 13 | Change the portrait and the about-page photos | Medium | Rarely | ❌ | ❌ |
| 14 | Page titles and share images (SEO basics) | Medium | Rarely | ❌ | ❌ |
| 15 | Home-page and Selected-work headlines and intros | Medium | Rarely | ❌ | 🔨 (home intro) |
| 16 | Catalan version | Low–medium | Rarely | ❌ | ❌ |
| 17 | Page order and menu labels | Low | Rarely | ❌ | ❌ |
| 18 | Simple look choices: accent colour, fonts from a set, layout density | Low | Rarely | ❌ | ❌ |

Stories 3 to 8 are the ones built in Phase 3. They are the ones that
are high value, missing today, and need the same foundation: a site-content
record in Supabase with a draft, a published copy and a history.

---

## The stories

### 1. Show or hide a work ✅

> As Xano, I want to hide a work from my website, or show it, so that only the
> paintings I am happy with are public.

Acceptance criteria
- In Artfolio, on the work's page, one switch ("Show on public profile") shows or hides it. ✅ `PieceEdit.tsx`, `pieces.is_public`.
- Hidden works disappear from Archive, Selected work and the home page within about a minute, with no redeploy. ✅ `catalogue_v1` only returns public works; `/api/catalogue` is cached 60 s.
- A hidden work that was featured on the home page is replaced automatically, never shown as a broken image. ✅ `pick()` in `src/data.ts` falls back to the Selected order. After Phase 3, the Website section also warns "This work is hidden, so the site shows X instead".
- He can hide or show several works at once. ✅ bulk visibility on the Pieces page.

### 2. Sold, prices, "price on request" 🟡

> As Xano, I want to decide for each work whether the price shows, and mark works
> sold, so that collectors know what is available without me answering the same
> email ten times.

Acceptance criteria
- A "Show price publicly" switch per work. ✅ `pieces.show_price`; `catalogue_v1` hides the price otherwise. (No prices are published at the moment, by choice.)
- A sold work says "Sold" when opened. ✅ `Lightbox.tsx`.
- A small red dot marks sold works in the grids, as galleries do. ❌ The mosaic shows no sold marker.
- When the price is hidden, the work says "Price on request" (with a switch to turn that wording on or off for the whole site). ❌ Today it says nothing.
- "Reserved" or "on loan" shown as such, not as available. ❌ Only `sold` is passed to the site.

### 3. Featured works on the home page 🔨

> As Xano, I want to choose which three works appear on my home page, and in which
> order, so that the first thing visitors see is my best or newest work.

Acceptance criteria
- In Artfolio → Website → Home page, he sees the three featured works as pictures, with "Change" and "Move up / Move down" on each.
- "Change" opens a picker of his public works (pictures, title, year, a search box). Hidden works cannot be picked.
- Changes show in the live preview at once, and on the real site only after "Publish".
- If a featured work is later hidden or deleted, the site shows the next work from Selected instead, and the Website section shows a warning on that slot.
- Before anything is chosen, the site shows exactly what it shows today.
- Today: ❌ the three works are slugs in `src/data.ts` (`FEATURED`).

### 4. The hero image 🔨

> As Xano, I want to pick the big full-screen picture at the top of my home page,
> so that it matches what I am showing now.

Acceptance criteria
- Same picker as story 3, one slot, labelled "Big picture at the top".
- The preview shows the hero cropped the way the site crops it (full screen), on a desktop and on a phone, so he can see what will be cut.
- The "practice" picture lower down the home page can be picked the same way.
- Today: ❌ `HERO` and `PRACTICE` are slugs in `src/data.ts`.

### 5. Preview, publish, undo, restore 🔨

> As Xano, I want to see my changes on the real site before anyone else does, then
> publish them with one button, and go back if I don't like the result, so that I
> am never afraid of breaking my website.

Acceptance criteria
- Every change is saved automatically as a **draft**. Leaving the page loses nothing.
- Next to the controls is a **live preview of the real site** (the real pages, fonts and paintings, not an imitation), updating as he types. It has Computer and Phone views.
- Nobody else sees the draft. Visitors keep seeing the published version.
- A clear line says "Changes not published yet" or "Everything is published".
- **Publish** makes the draft live. The site shows it within about a minute.
- **Discard changes** puts the draft back to what is published.
- **History** lists every publish (date, time, who). **Restore** on any entry loads it into the draft so he can look at it first, then publish.
- Nothing he does in the Website section can change his catalogue (titles, prices, inventory).
- Today: ❌ copy is in code; any change needs a developer and a deploy.

### 6. Artist statement and bio, English and Spanish 🔨

> As Xano, I want to rewrite my statement and bio whenever my thinking changes, in
> English and Spanish, so that my website speaks in my voice.

Acceptance criteria
- Website → About has plain boxes: "Quote at the top", "Headline", "Bio, first paragraph", "Bio, second paragraph", "What I do today", "Artist statement".
- Each box has English and Spanish side by side (stacked on a phone), starting from the text the site shows today.
- If he changes the English and not the Spanish, a gentle note says "Spanish not updated yet", and the Spanish site keeps its current text. A box left empty always falls back to today's text, never to a blank space.
- The home page introduction is edited the same way (story 15).
- Catalan: see story 16.
- Today: ❌ all of it is in `src/i18n.tsx`.

### 7. Contact, gallery, social links 🔨

> As Xano, I want to set the email address enquiries go to, my gallery and my
> Instagram, so that collectors and curators reach me, not a placeholder.

Acceptance criteria
- Website → Contact: "Email for enquiries", "Gallery that represents you" (English and Spanish wording), "Instagram link".
- Every "Enquire about this work" button, the footer email and the contact page use that address at once (after publishing).
- The email is checked to look like an email before it can be published. The Instagram link accepts a handle (`@xano_armenter`) or a full link.
- Leaving the gallery empty hides the line instead of showing an empty one.
- Today: ❌ `CONTACT_EMAIL` in `src/i18n.tsx` is a temporary address that is **not Xano's**; enquiries currently go to the wrong person. This is the most urgent fix in this list.

### 8. Exhibitions and CV 🔨 / upcoming banner ❌

> As Xano, I want to add a new exhibition to my CV, and announce an upcoming one,
> so that curators and collectors see I am active.

Acceptance criteria (CV, built)
- Website → CV: lists for "Solo exhibitions" and "Commissions", one line each: year and text.
- Add, edit, remove, move up and down. Lists start with what the site shows today.
- Names stay in their original language (the same on the English and Spanish sites), as today.
- Group exhibitions and permanent collections (already in `reference/google-site/CONTENT.md`) can be added as extra lists later. Not built yet.

Acceptance criteria (upcoming, not built)
- An "Upcoming" item with title, venue, city, dates, link and a picked work.
- While its end date has not passed it shows as a band on the home page; afterwards it moves itself into the CV as a past exhibition.
- Today: ❌ `src/cv.ts`.

### 9. From his phone 🟡 → 🔨

> As Xano, I want to do all of this from my phone, in the studio or at an opening,
> so that I don't need to sit at a computer.

Acceptance criteria
- Every Website screen works one-handed at 375 px wide: big touch targets, no tables, no hover-only controls.
- On a phone, Edit and Preview are two tabs instead of side by side.
- Picking a work uses big thumbnails and a search box.
- Publish and Discard stay reachable at the bottom of the screen.
- Today: 🟡 Artfolio's layout has a mobile menu, and the piece editor works on a phone; there is no Website section.

### 10. Reorder the Selected work page 🟡

> As Xano, I want to put the works on my Selected work page in the order I like.

Acceptance criteria
- In the "Selected" collection, drag (or Move up / Move down on a phone) to reorder.
- The site follows that order. ✅ The site already sorts Selected by `collection_pieces.position`.
- Today: 🟡 the order is stored and used by the site, but Artfolio has no way to change it (`CollectionDetail.tsx` can only add and remove). Belongs to the Artfolio parity session (collections UI).

### 11. Series with their own pages 🟡

> As Xano, I want to group works into series (Ultramar, New York, Wine labels…)
> with their own page and a short text, so that visitors understand how the work
> hangs together.

Acceptance criteria
- Any public collection other than "Selected" is a series. ✅ The site already receives them (`series` in the catalogue) and lists them in the lightbox.
- Each series gets a page (`/series/<name>`), with the collection description as its intro, and is listed on the Selected work page. ❌
- He chooses which series appear and in which order in Website → Pages. ❌

### 12. News and press ❌

> As Xano, I want to post short news (a new commission, an article about me) and
> list press with links and PDFs, so that the site feels alive and credible.

Acceptance criteria
- Website → News: title, date, text, an optional picture (picked from his works or uploaded), an optional link.
- Website → Press: publication, title, date, link or uploaded PDF.
- News shows on the About page (or its own page if there are more than three items); press below the CV.

### 13. Portrait and about photos ❌

> As Xano, I want to change my portrait and the studio photos.

Acceptance criteria
- Upload a photo from the phone's camera roll; crop it in a fixed frame so it always fits the design.
- The animated paint-splash portrait is made from one specific photo (`HANDOFF-portrait-splash.md`). A new portrait replaces it with a still photo, with a note that a new animation needs a designer. That is the one honest exception to "no one changes code".

### 14. Page titles and share images ❌

> As Xano, I want each page to have a good title and picture when shared on
> WhatsApp or Instagram, so that links to my site look professional.

Acceptance criteria
- One title and description per page, in English and Spanish, with a preview of the Google result and of the WhatsApp card.
- A share image per page, picked from his works; a work's own page uses that work.
- Today: ❌ one static `<title>` in `index.html`, no share images.

### 15. Home-page and Selected-work wording 🔨 (home intro) / ❌ (the rest)

> As Xano, I want to change the headlines on my home page and Selected work page.

- 🔨 The home introduction (headline and paragraph) is editable in Website → Home page.
- ❌ The other headlines ("Seas, crowds and cities.", call-to-action lines) are still in code. Same mechanism; add fields when he asks.

### 16. Catalan ❌

> As Xano, I want my site in Catalan too, because I live and exhibit in Catalonia.

Acceptance criteria
- A Catalan site at `/ca`, switchable like Spanish.
- In the Website section every text box gets a third language. Empty Catalan boxes fall back to Spanish.
- The content model already stores text per language (`{"en": …, "es": …}`), so adding `"ca"` needs no database change, only site work (a third string table) and a third column in the editor.

### 17. Page order and menu labels ❌

> As Xano, I want to rename "Selected work" to "Paintings", or hide the Archive
> from the menu.

Acceptance criteria
- Website → Pages: each page with a name (per language), a Show in menu switch, and Move up / Move down. Home and Contact cannot be hidden.

### 18. Look choices ❌

> As Xano, I want to change the accent colour or the fonts a little, without
> breaking the design.

Acceptance criteria
- A short list of curated choices, each shown on a small preview: three or four accent colours that pass contrast checks, three font pairings, "Airy" or "Compact" spacing.
- No free colour picker and no font upload: every choice has been checked against the design.
- "Back to the original design" in one tap.

---

## What the stories need underneath (for developers)

All of 3–8 and 12–18 are "site settings that are not catalogue data". Phase 3
adds one record per artist with three parts:

- **draft**: what Xano is editing, saved as he types;
- **published**: what visitors see;
- **versions**: every published copy, for History and Restore.

Text is stored per language (`{"en": "…", "es": "…"}`), works are referred to by
their site slug, and anything left empty falls back to the text in the site's
code today. So the site never shows a blank where text used to be, and adding
Catalan or a new field needs no database change.

Phase 2 (the Website section) and Phase 3 (what was built) are below.

---

## Phase 2: the "Website" section in Artfolio

Wireframes: [`docs/website-section-wireframes.html`](website-section-wireframes.html)
(open it in a browser; it has desktop and phone views of each screen).

### Principles

1. **One screen per question he asks himself.** "What's on my home page?",
   "What does my about page say?", "How do people reach me?", "What's on my CV?",
   "What did I publish before?" Each maps onto one story.
2. **The real site, next to the controls.** The preview is the actual website in
   a frame, showing the draft. No approximations.
3. **Draft by default, publish on purpose.** Saving is automatic; publishing is
   one deliberate, clearly labelled button.
4. **Plain words.** "Big picture at the top", not "hero". "Show on my
   website", not "is_public". "Earlier versions", not "revisions". No field
   names, no slugs, no JSON.
5. **Nothing can break.** Empty fields fall back to today's text; hidden works
   are swapped automatically; every publish can be undone.
6. **Phone first.** Edit and Preview become tabs, buttons are big, the publish bar is
   at the bottom.

### Layout

```
┌ Artfolio ────────────────────────────────────────────────────────────────┐
│ Pieces  Collections  Reports  Import  Website  Settings                  │
├──────────────────────────────────────────────────────────────────────────┤
│ Your website                                   ● Changes not published   │
│ [Home page] [About] [CV] [Contact] [Earlier versions]                    │
├───────────────────────────────┬──────────────────────────────────────────┤
│ Big picture at the top        │  ┌ Preview · Computer | Phone ─ EN|ES ┐  │
│ ┌──────────┐                  │  │                                    │  │
│ │  image   │ Wave, 2019       │  │      the real site, showing        │  │
│ └──────────┘ [Change]         │  │      the draft, live               │  │
│                               │  │                                    │  │
│ Three works under it          │  │                                    │  │
│ 1 [img] Ultramar 4  ↑ ↓ Change│  │                                    │  │
│ 2 [img] Àgora       ↑ ↓ Change│  │                                    │  │
│ 3 [img] Pampagulles ↑ ↓ Change│  │                                    │  │
│                               │  └────────────────────────────────────┘  │
│ Introduction  English|Español │                                          │
├───────────────────────────────┴──────────────────────────────────────────┤
│ Saved as a draft · only you can see it     [Discard changes] [Publish]   │
└──────────────────────────────────────────────────────────────────────────┘
```

On a phone, the tabs scroll sideways, **Edit / Preview** is a switch at the top,
and the publish bar sticks to the bottom.

### Screens, one to one with the stories

| Screen | Stories | Controls |
|---|---|---|
| **Home page** | 3, 4, 15 | Big picture at the top (one work); Three works under it (three slots, Change, Move up/down); Picture next to "The practice" (one work); Introduction headline and paragraph (EN/ES). |
| **About** | 6 | Quote at the top; Headline; Bio first and second paragraph; What I do today; Artist statement (each EN/ES). |
| **CV** | 8 | Solo exhibitions and Commissions: rows of Year + Text, Add a line, Remove, Move up/down. |
| **Contact** | 7 | Email for enquiries; Gallery that represents you (EN/ES); Instagram. |
| **Earlier versions** | 5 | List of publishes (date, who), each with "Look at this version" (loads into the draft, so it shows in the preview) and a note that publishing it makes it live again. |
| Later: Pages, News, Press, Look, Sharing | 11, 12, 14, 16, 17, 18 | Same pattern: a tab each. |

### Work picker

A sheet (full screen on a phone) with his **public** works as big thumbnails,
a search box (title or year), and the current choice ticked. Tapping a work
chooses it and closes the sheet. Hidden works are not offered. A note says "Only
works shown on your website are listed".

### Draft, preview and publish: how it behaves

- Typing or choosing saves the draft after a second ("Saving…" → "Saved as a draft").
- The status line reads either **"Everything is published"** or
  **"Changes not published yet"**, and the Publish button is only active in the second case.
- **Publish** asks nothing more (it is undoable), then says "Published. Your site
  shows it within a minute."
- **Discard changes** asks "Throw away your unpublished changes?" and resets the draft to
  the published copy.
- **Earlier versions → Look at this version** replaces the draft (after
  confirming if there are unpublished changes) so he can preview it; **Publish**
  then brings it back.

---

## Phase 3: what was built

Built and tested end to end on 2026-11-22 (Playwright, against a preview deploy of the site and the live database). The admin part is a patch for the Artfolio parity session to apply; the site part merges with the backend session's next production deploy.

See [`docs/xano-website-stories-merge.md`](xano-website-stories-merge.md) for
the merge notes, the test run and what each session needs to do.

| Story | What works end to end |
|---|---|
| 3 Featured works | Picked and ordered in Website → Home page; site reads them; hidden works fall back. |
| 4 Hero and practice pictures | Same. |
| 5 Draft, preview, publish, history | Autosaved draft, live preview of the real site (postMessage to the site in a frame), Publish, Discard, Earlier versions → restore. The restore and discard rules are covered by the database tests; the end-to-end run tested draft, preview, publish and the history list. |
| 6 Statement and bio | All About-page texts, EN/ES, with "Spanish not updated" notes and fallbacks. |
| 7 Contact | Enquiry email (used by every enquiry link, the footer and the contact page), gallery line, Instagram. |
| 8 CV | Solo exhibitions and commissions lists. |
| 9 Phone | The Website section is built phone first (tabs for Edit and Preview, sticky publish bar). |
| 15 Home intro | Headline and paragraph, EN/ES. |

### Not built yet, in priority order

1. Sold dots and "Price on request" (story 2). Small site change plus one site-wide switch.
2. Upcoming exhibition banner (story 8).
3. Reorder the Selected collection in Artfolio (story 10). This belongs to the parity session.
4. Series pages (story 11), News and press (12), Sharing and SEO (14).
5. Portrait upload (13), Catalan (16), Pages and menu (17), Look (18).
