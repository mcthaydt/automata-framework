# Smooth scrolling and subtle motion on the site

The Owner, 2026-11-08: "Add lucide, I think that's what it's called, to the website for SUPER SUBTLE smooth page
scrolling and gsap for SUPER SUBTLE microanimations and page transitions, do the same for the editors, we can do that
when it makes sense to."

This is stage 1 of the normal pipeline (audit and proposal), written on AF PR #520's branch, the newest site tip. The
plan is [2026-11-08-site-motion-plan.md](2026-11-08-site-motion-plan.md). The editors are not built here (section 9).

## 1. The short answers

- **The smooth-scroll library is Lenis, not Lucide.** Lucide is an icon set, and the site already uses it: 14 Lucide
  icons drawn inline in `site/src/shared/components/Icon.svelte` (ISC), and 40 in the editors'
  `packages/editor/src/shared/kit/icons/paths.ts` (`lucide-static` 0.460.0, recorded in `docs/provenance/sources.md`).
  Nothing about Lucide changes.
- **The site is `site/` in this repository.** `mcthaydt/automata-website` is the old site, never public (the site audit,
  2026-11-08); nothing goes there.
- **Lenis smooths the mouse wheel and trackpad only.** Phones and tablets keep their own scrolling, untouched. A wheel
  notch settles in about a quarter of a second (measured below), close to native. Anchors, the keyboard, Find in page
  and the scroll bar stay the browser's own.
- **GSAP runs the two things only script can time:** the new page settling in after a click, and the parts of Home's
  sections arriving as they scroll into view. Everything else that moves (hover, press, the search dialog, the phone
  menu, the copy tick) is CSS, which the site already does.
- **The cost is about 33 KB gzip, and only for visitors who get the motion.** It downloads after the first paint and
  after the page is live, is never preloaded, and is not downloaded at all for a visitor who asks for less motion or
  for less data. The first screen never moves on load, so the speed scores do not move.
- **GSAP is free but not open source.** Its licence (the "Standard 'no charge' license", owned by Webflow since 2025) is
  fine for a website, and fine for the editors' own buttons, dialogs and panels. The one line not to cross: GSAP never
  becomes the engine behind what people animate in their games (Feel, Sequence), because the licence bars using it to
  power a visual animation builder (section 9).

## 2. What is there today (audit, measured 2026-11-08 on #520's tip `09d5a347`)

### 2.1 Motion on the site

| Where | What | Notes |
| --- | --- | --- |
| `site/src/shared/styles/tokens.css` | `:root { scroll-behavior: smooth }` | Same-page anchors already glide. Turned off under reduced motion in `base.css`. |
| `site/src/shared/styles/base.css` | Buttons rise 1 px on hover and sink on press (fine pointers, motion allowed) | **Finding M1:** the controls' transitions are declared twice (`transform 0.14s, background 0.14s, border-color 0.14s`, then again inside `prefers-reduced-motion: no-preference` with 180 ms and 160 ms `ease`); the second wins. Neither reads the kit's `--ease-out`. |
| `base.css` | `@keyframes lift` and `@keyframes settle` | **Finding M2:** defined, used nowhere. |
| `base.css` | Reduced motion: `animation: none !important; transition: none !important` on everything | The site's rule is "reduced motion means still". This proposal keeps it. |
| `HomeMadeWith.svelte` | The logo marquee (40 s loop, pauses under the pointer, still under reduced motion) | Unchanged. |
| `HomeExamples.svelte`, `home.css` | Card and secondary-button hover transitions | Unchanged. |
| `ShapesPreview.svelte`, `Playground.svelte` | Hold a still frame or wait for Play under reduced motion | Unchanged. |
| `CommandMenu.svelte` (search, ⌘K) | A `<dialog>` that appears at once | Gets a CSS entrance (section 5.3). |
| `Header.svelte` phone menu | A `<details>` sheet that appears at once | Gets a CSS entrance (section 5.3). |
| `CopyButton.svelte` | The copy icon turns into a tick at once | Gets a CSS pop (section 5.3). |
| Page changes | SvelteKit swaps `main` at once and calls `scrollTo(0, 0)` | Gets the page settle (section 5.1). |

No smooth-scroll library, no GSAP, no scroll reveals and no page transitions exist anywhere in the repository
(searched for `lenis`, `gsap`, `onNavigate`, `startViewTransition` and `view-transition` outside `docs/archive/`).

### 2.2 What the site already guards that motion could break

- **Load budgets.** `lighthouserc.json` holds Home, `/start`, `/examples`, `/docs` and two example pages to performance
  0.9, LCP 2.5 s, CLS 0.1 and TBT 200 ms. `scripts/site-checks/javascript.ts` holds each page's modulepreloaded
  JavaScript to 48,000 bytes as built (the heaviest page has about 35 KB). Hydration waits for the first paint
  (`src/shared/html/hydration.ts`).
- **The CSP.** `script-src 'self'` plus hashes, no `unsafe-eval` (`src/shared/html/csp.ts`). Measured: the bundled
  Lenis and GSAP contain no `eval` or `new Function` and inject no `<style>` element.
- **Nested scroll boxes.** The docs sidebar and contents (`overflow: auto`, sticky), the search results, code blocks,
  the targets' commands (`data-scroll-region="horizontal"`), API tables, the playground's CodeMirror.
- **The Home demo** is the game in an `<iframe>`; the Play press is caught before hydration (`data-play`).
- **The boundaries rule** (`pnpm boundaries`, `--features site --components`): a feature imports only itself and
  `shared/`. Motion is used by the layout, Home, search and the header, so it belongs in `src/shared/motion/`.
- **New dependencies** are pinned exactly, get a row in `docs/versions.md` (`tooling/versions` fails without it), and,
  once AF #521 merges, an entry in `site/src/features/credits/credits-data.ts` (its test fails without one). Renovate's
  floor is 14 days old.

### 2.3 The libraries, measured

Bundled with esbuild, minified, the way the site would import them (`import Lenis from 'lenis'`,
`import { gsap } from 'gsap'`):

| Package | Version | Licence | Built | gzip -9 |
| --- | --- | --- | --- | --- |
| `lenis` | 1.3.27 (2026-10-15) | MIT | 18,800 B | 5,445 B |
| `gsap` core with CSSPlugin | 3.15.0 (2026-04-13) | GSAP Standard License | 70,794 B | 27,605 B |

`gsap` 3.15.1 (2026-11-04) is newer but under 14 days old today; the build pins the newest version that is at least 14
days old on its day. ScrollTrigger (18.0 KB gzip) is not needed: an `IntersectionObserver` starts each reveal.

Probed in Chromium (Playwright, a long dark page with a sticky 64 px header, a nested scroll box, an iframe and anchors;
scratch files, not committed):

- **Feel.** With `lerp: 0.14`, one 300 px wheel notch: 151 px after 62 ms, 258 px (86%) after 212 ms, 292 px (97%)
  after 411 ms, settled by about 600 ms. Timed separately: 90% of the notch at 264 ms and 99% at 514 ms with `0.14`,
  against 363 ms and 730 ms with Lenis's default `0.1`.
- **Nested boxes.** With `allowNestedScroll: true`, a wheel over a scrollable box scrolls the box (200 px) and leaves
  the page at 0.
- **Anchors.** With Lenis's `anchors` option off, a header link to `#s4` lands the section 96 px from the top, the same
  as without Lenis (`:target { scroll-margin-top: 6rem }` still applies).
- **Keyboard.** PageDown scrolls 700 px with Lenis running.
- **Classes.** At rest `<html class="lenis">`; during a wheel glide `lenis lenis-scrolling lenis-smooth`, and Lenis's
  stylesheet sets `iframe { pointer-events: none }` only then, so the demo frame cannot swallow the wheel mid-glide.
- **Cost on a slow phone.** On a 4x slowed CPU, evaluating the GSAP module took 13 ms and Lenis 6 ms, with no long task
  (over 50 ms) recorded.
- **Smooth scrolling to the top.** `scrollTo(0, 0)` with `:root { scroll-behavior: smooth }` jumped at once in Chromium;
  `scrollIntoView()` glided. WebKit is not installed in this container, so neither was measured there.

### 2.4 The GSAP licence, read 2026-11-08

From <https://gsap.com/standard-license> (effective 2025-04-30, modified 2025-05-30): use is free in commercial or
non-commercial "web sites, games, components, and other software". It forbids use "in tools that allow users to build
visual animations without code" that compete with Webflow's animation builder, and defines "Competitive Products" as
"any software, tool, or service that enables users to create, edit, or manage animations through a visual interface".
The same page's plain-English summary still says the free licence holds "as long as end users are not charged a fee of
any kind to use your product". GSAP is "All rights reserved", Webflow may change the terms, and it may end the licence
at its discretion.

For the website (free to read, no animation builder) this is a permitted use. The credits page says "Built on open
source"; GSAP's entry names its own licence and says it is free but not open source.

## 3. Decisions

1. **Lenis 1.3.x for the wheel, on fine pointers only.** It keeps native scrolling (sticky headers, Find in page, the
   scroll bar and the keyboard all work), unlike libraries that move the page with a transform. Options:
   `autoRaf: true`, `lerp: 0.14`, `smoothWheel: true`, `syncTouch: false`, `anchors: false`, `allowNestedScroll: true`,
   `stopInertiaOnNavigate: true`, and `prevent` for an open `<dialog>` and anything marked `data-native-scroll`.
2. **Lenis is off on the playground** (`/examples/<id>`), which is a tool with its own editor, frame and scroll boxes,
   and on any element marked `data-native-scroll`. `/editor/app/` is a separate app and never loads it.
3. **Anchors stay the browser's.** `scroll-behavior: smooth` on `:root` stays (off under reduced motion, as now), and
   the motion layer sets the root to `scroll-behavior: auto` for the instant of a page change, so a new page always
   starts at its top on its first frame in every engine.
4. **GSAP 3.x core only, for the page settle and the reveals.** No ScrollTrigger, no ScrollSmoother, no SplitText, no
   plugins. Hover, press and things that appear with `[open]` stay CSS.
5. **Nothing is hidden by CSS or by the HTML.** Only the motion module hides anything, only after GSAP has loaded, and
   only parts that are wholly below the window at that moment. Without script, before GSAP arrives, after a fast scroll,
   on a deep link or for Find in page, the content is simply there.
6. **Reduced motion means still, as today.** A visitor who asks for less motion, or whose browser asks for less data
   (`navigator.connection.saveData`), downloads neither library and sees the site exactly as it is now. If the setting
   changes during a visit, running moves jump to their end, Lenis is removed and nothing new starts.
7. **The numbers are tokens.** `site/src/shared/motion/motion-tokens.ts` holds them, `tokens.css` mirrors the ones CSS
   uses, and a test holds the two equal. When the editors' turn comes they move into the kit's `tokens.json`, so both
   read one source (not now: the editors v2 build is changing `tokens.json` on another branch).
8. **The curve is the kit's.** Everything enters and leaves on `--ease-out`, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out
   quint), which is GSAP's `power4.out`. No ease-in, no bounce, no elastic (taste-skill: ease-in feels slow).

## 4. The tokens ("super subtle", in numbers)

| Token | Value | CSS name | Used for |
| --- | --- | --- | --- |
| press | 140 ms | `--t-press` | A button's press and release (exists today as 0.14 s) |
| hover | 180 ms | `--t-hover` | Colour and border on hover (exists today as 180 ms) |
| ui | 200 ms | `--t-ui` | The search dialog, the phone menu, the copy tick |
| page | 220 ms | (script only) | A new page settling in |
| reveal | 480 ms | (script only) | One part of a section arriving |
| stagger | 60 ms | (script only) | Between the parts of one section |
| stagger cap | 6 parts | (script only) | A section's seventh part onwards starts with the sixth |
| rise | 8 px | (script only) | The furthest anything travels (reveals) |
| settle | 6 px | (script only) | A new page's travel |
| nudge | 4 px | `--nudge` | The search dialog's and the phone menu's travel |
| scale from | 0.98 | `--scale-from` | The least anything is scaled; only the search dialog (0.98) and a section's product picture (0.985) scale |
| lerp | 0.14 | (script only) | Lenis's smoothing per frame at 60 Hz (frame-rate independent) |

Rules the test enforces: no duration over 480 ms, no travel over 8 px, no scale under 0.98, only `transform` and
`opacity` animate, and a whole section finishes within 480 + 5 × 60 = 780 ms of starting (the stagger cap is per
section: the seventh part onwards starts with the sixth).

## 5. Where it moves

### 5.1 A page change (GSAP)

When a click (or Back, Forward or a search result) loads another page, the old content goes at once and the new page's
content fades up from 6 px below over 220 ms. There is no exit animation, so a click never waits. Header and footer stay
still. When only the page's data changes (one guide to another), only the element marked `data-page-content` (today
the guide's article) settles, so the docs sidebar and contents stay put; otherwise `main` does. The old content is
hidden by a mark on `<html>` (`data-page-change`) set just before SvelteKit swaps the page and removed as the settle
starts (or after 1 s whatever happens), so the new page never shows at full opacity for a frame first. The first page
of a visit never animates. A same-page `#hash` link is not a page change. When the settle ends, GSAP clears its inline
styles, so no transform is left on `main` (a lasting transform would change how `position: fixed` children sit).

Focus, the skip link and SvelteKit's route announcement are unchanged: the content is in the page from the first frame,
at opacity 0 for at most 220 ms.

### 5.2 Home's sections arriving (GSAP)

Each `.home-section` wholly below the window when motion starts arrives once, when its top passes 85% of the window's
height (an `IntersectionObserver` with `rootMargin: '0px 0px -15% 0px'`), in reading order, as one sequence:

1. the words: `.home-kicker`, `h2`, `.home-sub`, each `.home-points li`, the section's link (`.home-more > a`,
   `.more`), rising 8 px with opacity, 60 ms apart;
2. the product: `.show`, `.home-panel`, the picture, rising 8 px from scale 0.985 to 1;
3. a list: each `li` of the section's cards, targets or changelog rows, rising 8 px, 60 ms apart.

Parts after the sixth in the sequence start with the sixth, so a long list does not trickle in.

The steps come from one pure function (`revealSteps`) that reads those classes, so a new section built from Home's
section classes (the copy rewrite, AF #542, adds "Built in" and "Pricing" from them) arrives the
same way with no new code. The hero, the numbers row, the logo strip and the closing lime band are never hidden: the
first screen is what the visitor came for and is the LCP. Reading pages (Docs, Reference, Changelog, Start, Privacy,
Terms, the examples) never use reveals: their content is the point.

Taste-skill's motion rules apply: reveals on the sections that carry a product picture or list, never the same
fade on every block, never replayed, never content that stays hidden if a script fails. Taste-skill's own budget (eight
or more moving elements, a 16 to 32 px rise) is set aside where it conflicts with the Owner's "SUPER SUBTLE": 8 px,
and no signature hero move.

### 5.3 Small things (CSS, under `prefers-reduced-motion: no-preference`)

- **Search (⌘K).** The dialog rises 4 px from scale 0.98 and fades in over 200 ms; its backdrop fades in over 200 ms.
  Closing is instant, so Escape always feels immediate. Focus moves into the field at once, as now.
- **Phone menu.** The sheet under the bar drops 4 px into place and fades in over 200 ms when `details[open]`.
- **Copy.** The tick that replaces the copy icon fades in over 200 ms, and so does "Copied".
- **Buttons.** One transition rule per control, reading `--t-press`, `--t-hover` and `--ease-out` (fixes M1); the
  unused `lift` and `settle` keyframes go, replaced by the one `motion-rise` keyframe these use (fixes M2).
- **Print.** `@media print` shows every part at full opacity with no transform, whatever a reveal was doing.

### 5.4 Scrolling (Lenis)

On a mouse or trackpad with motion allowed, outside the playground: the wheel glides (section 2.3). A wheel over the
docs sidebar, the contents, the search results, a code block or a table scrolls that box. A wheel over the open search
dialog behaves as today (Lenis lets it through). During a glide the demo frame ignores the pointer for that moment, so
the wheel keeps scrolling the page; a press on Play after the glide reaches the game.

When a page change starts, any glide stops where it is, so SvelteKit's own scroll (to the top, or back to where Back
returns) is never fought by a glide still running.

## 6. Loading and cost

- `src/shared/motion/motion-layer.ts` is the only motion code in the layout's bundle (the budget allows it: the heaviest
  page preloads about 35 KB of the 48,000 bytes). It runs after hydration, which already waits for the first paint.
- It decides first: reduced motion or Save-Data, nothing loads. Otherwise, in the first idle moment
  (`requestIdleCallback`, falling back to a 1 ms timeout), it imports `./animate.ts` (GSAP), and on a fine pointer
  outside the playground `./smooth-scroll.ts` (Lenis and its 5-rule stylesheet). These are separate dynamic chunks,
  never modulepreloaded.
- **Budget, checked by `pnpm check:site`:** the two motion chunks and what they import together stay within 36,000
  bytes gzip (measured today: 33,050 for the libraries), and no page modulepreloads either. The Lighthouse assertions in
  `lighthouserc.json` stay as they are and must still pass on all six pages.
- The reveals do not move the layout (transform and opacity only), so CLS cannot rise from them.

## 7. Accessibility and the drunk grandma test

Could a drunk grandma tell what is happening and what to press?

- **What she sees first never moves.** The first screen of every page is still on arrival.
- **Nothing she might press is missing.** Reveals only touch parts below the window; a button inside one is in the page
  and pressable throughout, and is fully there within 780 ms of scrolling to it.
- **A click is never slowed.** No exit animation; the new page is there at once and settles in 220 ms.
- **Her mouse wheel still feels like her mouse wheel,** a little softer. Her phone is untouched. Her arrow keys,
  PageDown, Space and the scroll bar work as before.
- **If she asks her computer for less motion, the site is still,** and downloads nothing for motion.
- Focus rings, the skip link, keyboard order, screen-reader text and contrast are unchanged: moving parts are at full
  opacity at rest, and no text is ever drawn over another.

## 8. How it is proved

- **Unit (Vitest, jsdom, `site/tests/unit/shared/motion/`):** the token limits and the CSS mirror; the preference
  (reduced motion, Save-Data, coarse pointer, the playground path, a mid-visit change); Lenis's options and `prevent`;
  `revealSteps` on Home's markup (order, cap, the hero never included); the layer with fake loaders (nothing loads
  under reduced motion; Lenis is removed on entering the playground; a mid-visit change finishes everything).
- **Browser (Playwright, Chromium and WebKit, `site/tests/e2e/motion.e2e.ts`, against the built site):** a wheel glides
  and settles; nested boxes keep their wheel; an anchor lands where it did before; PageDown works; a new page starts at
  its top and reaches full opacity within 400 ms; Back during a glide lands where Back should; a `#hash` deep link to a
  Home section shows it at full opacity; scrolling Home brings every section to full opacity with no transform left;
  a phone (touch, coarse pointer) has no `lenis` class; reduced motion requests neither chunk and never sets an inline
  opacity; the search dialog opens with focus in its field; Play on the demo still starts the game after a wheel.
- **Existing suites** run against the finished, still page: the site's Playwright config sets `reducedMotion: 'reduce'`
  for every test, and `motion.e2e.ts` opts in to `no-preference`. Their assertions do not change.
- **Gates:** `pnpm check` (lint, typecheck, boundaries, style, knip, unit, versions), `pnpm check:site` with the motion
  budget, `pnpm lighthouse` before and after, and the site's Chromium e2e. The build audit makes and plays a small game
  from the try-it editor as every audit does, and reloads the editor to confirm its work persists; motion must not
  touch either.

## 9. The editors, later

The Owner: "do the same for the editors, we can do that when it makes sense to". That is after the editors v2 build
(AF #519's plan) and its audit land. The plan for that stage:

- **GSAP for the editors' own interface, never for the game.** The Owner, 2026-11-08: "Use gsap for the editor UI
  motion", after asking "How is my app competing with webflow?" It is not: Webflow builds websites, and the editors
  make games. The licence's words are broad ("Competitive Products" is any tool where people "create, edit, or
  manage animations through a visual interface", which Feel and Sequence are), but what it bars is using GSAP *to
  power* such a builder. So GSAP may animate the editors' buttons, dialogs and panels, the same tokens and curve as
  the site. It must never drive what a person
  animates in their game: Feel's juice, Sequence's timeline and every in-game move stay the framework's own code. A
  test in the editors' build should fail if `extensions/feel`, the cutscene runtime or any game imports `gsap`.
- **Smooth scrolling where the editors read like a page, not in the tools.** Home's list of games and levels can glide
  like the site. Panels, lists, the inspector and the canvas stay exact: a wheel there should move as far as the hand
  did, and on the canvas the wheel zooms and pans. Each glide region needs its own Lenis instance on that region
  (`data-scroll-region`), so there are only as many as there are page-like lists.
- **Where it fits:**
  - switching editors in the sidebar or tab bar: the work panel's content fades in, 160 ms, no travel;
  - dialogs and phone sheets (New level, Publish, Export, Import, Ask, the conflict and recovery dialogs): the dialog
    rises 4 px and fades in; a phone sheet slides up from the bottom edge over 240 ms;
  - "Saving…" to "Saved" and the problem count: a 120 ms crossfade;
  - Home: a newly made level or game card settles from scale 0.98;
  - Publish done: the one moment allowed to be noticed, a tick that draws itself.
- **Where it never goes:** the canvas, the game preview, drawing, dragging, zoom and pan (one to one with the hand),
  tool and selection changes, undo and redo, typing, and anything seen hundreds of times a session.
- The tokens move into `packages/editor/src/shared/kit/tokens/tokens.json` then, and the site reads them from there.

## 10. Out of scope

- The editors (section 9), `/editor/app/` (the try-it editor is an editor build), the playground's own frames, the
  demos and every game.
- Scroll-linked effects, parallax, pinned sections, a custom cursor, a signature hero move, counters on the numbers row
  and any change of layout, copy or colour.
- The View Transitions API: it would do the page change for nothing, but the Owner asked for GSAP, which also runs the
  reveals.

## 11. For the Owner

1. The editors (section 9): GSAP for their own interface only, and smooth scrolling on Home's lists but not in the
   tool panels. Say if the panels should glide too. Nothing is built until the editors' turn.
2. GSAP on the credits page reads "GSAP Standard License: free to use, not open source". Say if it should be worded
   differently.
