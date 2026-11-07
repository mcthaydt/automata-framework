# Site visual audit (2026-11-06)

Read-only audit of the website as it stands on the newest build branch (`claude/project-thread-bjrs94`, PR #418, head
`ec06efc7`, after task 10.3). Built with `pnpm turbo run build --filter @mcthaydt/automata-site...` and served with
`vite preview`. Chromium only (WebKit and Firefox cannot be installed in cloud sessions, so Safari on a real iPhone or
iPad is still the Owner's check).

Screenshots: `refactor/2026-11-06-site-visual-audit/screens/` in the project's shared folder (105 full-page JPEGs at
2x, named `<page>--<size>.jpg`). Raw measurements for every page at every size:
`metrics.json` beside them.

## 1. Are we done adding screens?

**No.** The plan still adds, removes or rebuilds these screens (`docs/refactor/2026-11-06-2d-editors-and-site-plan.md`,
progress at 32 of 63 tasks):

| Task | What changes on screen |
|---|---|
| 11.1 to 11.3 | New shared look: one token source for editor and site, Geist font, icon set, restyled kit components, a design board |
| 12.1 to 12.5 | Every 2D editor screen redesigned: Home (project cards, New level sheet), the document frame (top bar, problems sheet, Share menu), the Level view (tool pill, Layers sheet, inspector), Map, Tiles, Characters, the conflict and recovery dialogs |
| 18.1 | Site cut to seven pages: Showcase, AI, Cheatsheet and Sources go (with redirects); Community, Proof, Releases and Inside are already gone |
| 18.2 | Home and Start rewritten for `create-game` (no `git clone`, no `base-2d`) |
| 18.3 | A new Editor page with three pictures and **"Try the editor"**, plus the editor itself at `/editor/app/` |
| 18.4 | Docs rebuilt from the framework's guides, with a new "How it works" page; API pages regenerated |
| 20.1 | Copy pass over the whole site and CLI |

So this audit is a **baseline**. Layout bugs in shared pieces (footer, code blocks, header, tap targets) will carry
into the new pages unless they are fixed, so they are worth fixing now; page-level copy problems on pages that 18.x
rewrites or deletes are listed but marked as already planned. The audit should run again after phase 18, and once
more on the editor after phase 12.

## 2. What was checked

- **58 pages** (every page in the sitemap, plus a missing page for the 404) at **6 sizes**: phone 390 × 844 and
  844 × 390, tablet 820 × 1180 and 1180 × 820, desktop 1080 × 1920 and 1440 × 900. Phone and tablet run as touch
  devices.
- Measured on every page and size: horizontal overflow, elements past the right edge, interactive elements under
  44 px, text under 12 px, console errors.
- Screenshotted and reviewed by eye at all six sizes: Home, Start, Docs, Quick Start, ECS doc, Editors, Examples, two
  example pages, API, an API package page, AI, Cheatsheet, Showcase, Privacy, Terms, 404. Plus the phone menu open and
  search open.

**What is already good:** no page scrolls sideways at any size (0 of 348 page-size pairs), no text is under 12 px, and
there are no console errors apart from the expected 404. Lazy images load on scroll. The header folds into Start,
Search and Menu on phones and tablets without crowding.

## 3. Findings, most severe first

"Planned" means a plan task already fixes it; "New" means nothing in the plan covers it yet.

### High

| # | Finding | Where | Status |
|---|---|---|---|
| H1 | **The site describes the old framework.** Start and Quick Start say `git clone` the private repo and run `@af-examples/base-2d`; Home says it is *not for* people who want "a visual scene editor" and "editor tooling", and the desktop build "is planned"; the Editors page says "there is no editor to open on this site" and lists 3D, Studio and Plus editors. A stranger following Start today hits a repo they cannot see and a package that no longer exists. | Home, Start, Quick Start, Editors | Planned (18.2, 18.3, 18.4; W1, W2, W4, W7) |
| H2 | **Links to the private GitHub repository** on almost every page: "Open project on GitHub", "View file on GitHub", footer "Framework source", the Editors page's "the editor suite spec". Every one is a 404 for a visitor. | Home, examples, footer, Editors | Planned (19.2, `repositoryPublic: false`) |
| H3 | **A personal Gmail address is published** in the footer of every page, on Privacy and Terms, and in `/.well-known/security.txt` (`site/src/lib/site.js`). | Every page | Planned (W9, D8: the Owner supplies the contact address) |
| H4 | **The API package pages are enormous.** `/api/0.0.5/automata` is 185,000 px tall on a phone (279 exports on one page, 210 kB of HTML); Chromium could not even take a full-page screenshot of it. Cheatsheet is 30,000 px. On a phone that is minutes of scrolling with no way to jump. | API package pages | **New** for the API pages (18.4 only says "one page per package"); Cheatsheet is deleted in 18.1 |
| H5 | **The first example looks broken.** "open a game window" shows a black box with only a pause button. Nothing says the empty window is the point. The first thing a stranger runs should show something (a title screen, a coloured background, a line of text). | `/examples/core-basic-window` | **New** |

### Medium

| # | Finding | Where | Status |
|---|---|---|---|
| M1 | **Tap targets under 44 px** (the repository rule is 44 px, 48 px for primary actions). Footer links are 40 px tall on all 57 pages; the docs "On this page" links are 36 px; Copy buttons are 32 px; the demo's Restart, Fullscreen and Open demo are 36 px; stand-alone text links like "Play the starter", "Remix the room", "Get the prompt", "Browse all examples" are 22 to 27 px; the logo link is 19 to 21 px; desktop nav links are 42 px. | Shared components | **New** (worth fixing in the shared CSS before 18.x builds on it) |
| M2 | **Code breaks mid-word on phones.** Paths and commands wrap inside a word: `games/emberwick/src/shared/roo` / `m.ts`, `@af-examples/base-` / `2d`, `github.com/mcthaydt/autom` / `ata-framework.git`. Some blocks wrap, others (Quick Start) clip and scroll sideways, so the same kind of block behaves two ways. Copy buttons sit beside the title in one block and drop under it in another. | Home code viewer, Start, Quick Start, examples | **New** |
| M3 | **Phone landscape hides the thing you came for.** At 844 × 390 the header and the example's Shows/Controls/Difficulty/Packages table fill the whole screen, so the live preview starts below the fold; on Home the Emberwick demo starts below the fold too. | Example pages, Home | **New** |
| M4 | **The phone menu is see-through.** The panel is 94 % opaque, so the giant hero heading shows through behind the menu links ("Make a game." ghosted behind Start and Showcase). The menu also has no Editors or API link. | Every page, phone and tablet | **New** (the link list changes in 18.1) |
| M5 | **Editors page headings are the wrong size.** "Cost" and "How edits are made" are as big as the page title and sit right under the paragraph above with no space; it reads like a broken page. | `/editors` | Planned (18.3 replaces the page) |
| M6 | **Navigation does not match the site.** The header offers Showcase and AI (both being cut) but not Editors or API; the footer has both "API reference" and "Complete API", which a visitor cannot tell apart. | Header, footer | Partly planned (18.1 cuts pages; the footer labels are **new**) |
| M7 | **Example copy fails the drunk grandma test.** Titles are lower case fragments ("open a game window", "the sim stands still while the host has the game in the background"); descriptions are API notes ("keys() gestures: a swipe holds a direction while the finger steers past a 12 px dead zone, a flick down (40 px within 180 ms) lasts exactly one tick"); the list shows bare star ratings with no label. Home's FAQ tells people to "Install Superpowers". | Examples, Home FAQ | Planned (20.1 copy pass) |

### Low

| # | Finding | Where | Status |
|---|---|---|---|
| L1 | The Search button shows `⌘K` on phones and tablets, and the search dialog says "Use arrow keys to move, Enter to open, Escape to close" on touch screens. | Header, search | **New** |
| L2 | The double-jump preview picture has a cropped HUD strip across the top with unreadable 6 px text cut off at the left ("uble jump"). | Home, Showcase | **New** (re-shoot the preview) |
| L3 | Desktop Home has a vertical "EMBERWICK" label floating in the left gutter; the "Explore the working parts" section has one lonely "Content" card; the double-jump card is narrower than the Emberwick card above it. | Home, desktop | **New** (Home is rewritten in 18.2; check it there) |
| L4 | On tablet portrait and phone landscape, "Play the starter" drops under "Make your first change" and is not aligned with it. | Home hero | **New** (check in 18.2) |
| L5 | Home repeats itself: "Try a double jump" appears as two primary buttons a screen apart, and "Make your first change" twice. | Home | Planned (18.2) |
| L6 | The 404 says "Back to overview", which means the home page; "Go to the home page" says it plainly. | 404 | Planned (20.1) |
| L7 | The code shown on Home has comments a visitor will not follow ("The base's ...", "Bubble Bobble style"). | Home code viewer | **New** (comment wording in Emberwick's `room.ts`) |
| L8 | Privacy says "The site itself stores nothing in your browser". Once "Try the editor" ships (18.3) the editor saves levels in browser storage, so this line needs a sentence about it. | Privacy | **New** (pair with 18.3) |
| L9 | Every page's canonical URL and sitemap still use `automata.ruken.com`. | SEO files | Planned (D8, ADR 0006: the Owner's domain) |

## 4. Recommendation

Fix the **new** shared-layout items (M1 tap targets, M2 code wrapping, M4 menu, L1 touch hints) as one small task
before phase 18, because every rebuilt page inherits them. Add H4 (API page length: an index with collapsed sections
or one page per export group) and H5 (a first example that shows something) to tasks 18.4 and 18.3's neighbours. The
rest is already in phases 18 to 20. Re-run this audit with the scripts in the shared folder's `refactor/2026-11-06-site-visual-audit/scripts/` (`run.cjs` measures, `shots.cjs` screenshots; both expect `vite preview` on port 4417)
after phase 18, and on the editor after phase 12.

## 5. Rerun after phase 18, part (session 20, 2026-11-07)

Run with the same scripts against `vite preview` of the rebuilt site (header, footer, Home and Start from the approved
mockup, the source explorer cut). 348 page and size pairs.

| Check | Before (section 2) | Now |
|---|---|---|
| Sideways scroll | several pages | 0 |
| Page errors | — | only the 404 (expected) and the API package page's screenshot (the page is too tall to capture: H4) |
| Text under 12 px | — | 6, all the Home command drawn at 10.6 to 11.9 px through the global `code` rule |
| Tap targets under 44 px | 9,507 | 4,938 (Home 324 → 11, Start 191 → 71) |

Fixed after the run, in the same session and not yet re-measured: Copy buttons (32 px → 44 px), the header's API link
(39 px wide → 44 px), the Home command (now the box's own 13.5 px, 13 px on phones), one command-box style everywhere,
and inline code breaks only where it must (M2). The menu is opaque (M4), the ⌘K hint is hidden on touch (L1, the
search dialog's keyboard line is left), and L3 to L5 and L7 went with the old Home.

Left, by task: the docs sidebar and "On this page" links (M1, 18.4), the API page length (H4, 18.4), the first example
(H5) and the phone-landscape fold (M3) in 18.2's Step V, the cheatsheet's small targets (the page is cut in 18.1), and
the editors page (M5, 18.3). Rerun this audit after 18.4.

## 6. Rerun after 18.4 and 18.5 (session 22, 2026-11-07)

The same `run.cjs` against the built site (`scripts/serve-static.ts build 4417`), over the 35 pages of its sitemap and
the 404: 216 page and size pairs. The page list changed with 18.1 and 18.4 (the cut pages and the site's own docs now
redirect), so the counts are per page that exists.

| Check | Section 5 | Now |
|---|---|---|
| Sideways scroll | 0 | 0 |
| Page errors | the 404 and the API package page | the 404 only (expected); the API pages fold, so they capture |
| Text under 12 px | 6 | 0 |
| Tap targets under 44 px | 4,938 | 30, all on Start: its two upstream links (22 px tall) and three checkboxes (20 px) |

Fixed after the run: Start's two upstream links are 44 px tall. The checkboxes stay 20 px; their labels, the whole
row, are 48 px, and a tap on a label ticks the box. The site's browser suite now holds every page to this at all six
sizes (`tests/e2e/site.e2e.ts`, "big enough to tap"), with the touch hint (L1) and the opaque phone menu (M4).

H4 is closed: an API package page is one and a half phone screens with its groups folded (it was too tall to capture).
M1 is closed for links and buttons. Left: M2's code-block wrapping was checked by eye in section 5 and has no
browser rule yet.
