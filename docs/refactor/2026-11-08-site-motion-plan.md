# Site Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (no
> subagents in this project). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The website gets super subtle smooth wheel scrolling (Lenis), a page that settles in after a click, and Home's
sections arriving as they scroll into view (GSAP), plus small CSS entrances, at about 33 KB gzip loaded after the page is
live and not at all for visitors who ask for less motion.

**Architecture:** One folder, `site/src/shared/motion/`. A small layer in the layout's bundle (`motion-layer.ts`) decides
after hydration whether motion is wanted and, in the first idle moment, imports two dynamic chunks: `animate.ts` (GSAP:
the page settle and the reveals) and, on a fine pointer outside the playground, `smooth-scroll.ts` (Lenis). Pure helpers
(`motion-tokens.ts`, `motion-preference.ts`, `reveal-steps.ts`) carry the numbers and the decisions so they test in
jsdom. CSS keeps hover, press and the `[open]` entrances.

**Tech Stack:** SvelteKit 2.70 (`onNavigate`, `afterNavigate`), Svelte 5, Lenis 1.3.27, GSAP 3.15 core, Vitest 5 (jsdom),
Playwright 1.63 (Chromium and WebKit), Lighthouse CI.

**Spec:** [`2026-11-08-site-motion-spec.md`](2026-11-08-site-motion-spec.md).

**Base:** this plan was written on AF #520's branch (`claude/project-thread-vw9kmv`, tip `09d5a347`). The build starts on
this PR's branch. If AF #521 (the credits page) and the copy rewrite (`claude/project-thread-fvbpvx`, new Home sections)
are still open, merge both into the build branch first, in one merge-up pass, and name the base in the log. Every path
below exists at `09d5a347` except the credits file (from #521).

## Global Constraints

- Lenis options, verbatim: `autoRaf: true`, `lerp: 0.14`, `smoothWheel: true`, `syncTouch: false`, `anchors: false`,
  `allowNestedScroll: true`, `stopInertiaOnNavigate: true`, `prevent` true inside `dialog[open]` or
  `[data-native-scroll]`.
- Tokens: press 140 ms, hover 180 ms, ui 200 ms, page 220 ms, reveal 480 ms, stagger 60 ms, stagger cap 6 parts per
  section, rise 8 px, settle 6 px, nudge 4 px, scale from 0.98 (a section's product 0.985), ease `power4.out` =
  `--ease-out` `cubic-bezier(0.22, 1, 0.36, 1)`. No duration over 480 ms, no travel over 8 px, no scale under 0.98.
- Only `transform` and `opacity` animate. No ease-in, bounce or elastic. No exit animation on a page change.
- Nothing is hidden by CSS or HTML before GSAP has loaded; reveals hide only parts wholly below the window; the hero,
  numbers row, logo strip and closing band never hide; reading pages never reveal.
- Reduced motion or `navigator.connection.saveData`: neither chunk is requested, the site is exactly as before.
- Lenis loads only for `(hover: hover) and (pointer: fine)` and never on `/examples/<id>`.
- Load: the two chunks and their imports within 36,000 bytes gzip; no page modulepreloads them; Lighthouse assertions in
  `site/lighthouserc.json` unchanged and passing; each page's modulepreload under the existing 48,000-byte budget.
- Dependencies pinned exactly: `lenis` 1.3.27; `gsap` the newest version at least 14 days old on the build day (3.15.0
  on 2026-11-08; 3.15.1 from 2026-11-18). A row each in `docs/versions.md`. A credits entry each if
  `site/src/features/credits/credits-data.ts` exists: Lenis "MIT"; GSAP "GSAP Standard License: free to use, not open
  source".
- Code goes in `site/src/shared/motion/` (a feature imports only itself and `shared/`); tests in
  `site/tests/unit/shared/motion/` importing `#src/…`, and `site/tests/e2e/motion.e2e.ts`. Files under 600 lines.
  Comments say why. `@automata/site` is private: no changeset.
- Failing test first. `pnpm format`, then `cd site && pnpm exec vitest run <files>` and `pnpm check` (svelte-check)
  before each commit; root `pnpm check` before the last. Conventional Commits.
- The build audit makes a small game in the try-it editor, plays it, reloads and confirms it persists (the Owner's audit
  rules); motion must change neither.

## Review Focus

1. **Content stuck hidden.** A page change whose `afterNavigate` never comes, GSAP failing to download, a `#hash` deep
   link into Home, or Find in page must leave nothing at opacity 0. Tests: Task 4 (the mark's 1,000 ms fallback; a
   rejected import hides nothing) and Task 7 (deep link).
2. **Reduced motion turned on mid-visit.** Running moves jump to their end with no inline styles left, Lenis is
   destroyed, and nothing new starts. Tests: Task 4 (unit) and Task 7 (`emulateMedia` mid-test).
3. **Back or Forward during a glide.** The page lands where SvelteKit restores it and does not drift. Test: Task 7.
4. **Nested scroll boxes.** The docs sidebar, the search results and code blocks keep the wheel; the page does not move.
   Test: Task 7.
5. **Leaving mid-reveal.** A page change while a section is arriving leaves no inline `opacity` or `transform` on the
   new page. Tests: Task 3 (`finish` clears) and Task 7.

---

### Task 1: The tokens, the preference and one transition rule per control

**Files:**
- Create: `site/src/shared/motion/motion-tokens.ts`, `site/src/shared/motion/motion-preference.ts`
- Modify: `site/src/shared/styles/tokens.css` (add the CSS tokens), `site/src/shared/styles/base.css` (M1, M2)
- Test: `site/tests/unit/shared/motion/motion-tokens.test.ts`, `site/tests/unit/shared/motion/motion-preference.test.ts`

**Interfaces:**
- Produces: `MOTION` (readonly object: `press 0.14`, `hover 0.18`, `ui 0.2`, `page 0.22`, `reveal 0.48`, `stagger 0.06`
  (seconds), `staggerCap 6`, `rise 8`, `settle 6`, `nudge 4` (px), `scaleFrom 0.98`, `productScaleFrom 0.985`,
  `ease 'power4.out'`, `lerp 0.14`, `revealMargin '0px 0px -15% 0px'`).
- Produces: `REDUCE = '(prefers-reduced-motion: reduce)'`, `FINE_POINTER = '(hover: hover) and (pointer: fine)'`,
  `wantsMotion(win: Window): boolean`, `smoothScrollAllowed(pathname: string): boolean`,
  `wantsSmoothScroll(win: Window, pathname: string): boolean`,
  `onReduceChange(win: Window, listener: (reduce: boolean) => void): () => void`.

- [ ] **Step 1: Write the failing tests.**
  `motion-tokens.test.ts`: every duration in `MOTION` is at most 0.48; `rise`, `settle`, `nudge` at most 8;
  `scaleFrom` and `productScaleFrom` at least 0.98; `MOTION.reveal + (MOTION.staggerCap - 1) * MOTION.stagger` is at most
  0.78; `ease` is `'power4.out'`; `tokens.css` (read with `readFileSync`) declares `--t-press: 140ms`,
  `--t-hover: 180ms`, `--t-ui: 200ms`, `--nudge: 4px`, `--scale-from: 0.98`, each equal to the `MOTION` value
  converted; `base.css` has no `@keyframes lift` or `@keyframes settle`, exactly one `transition` declaration for
  `button, .button`, and no `ease-in` anywhere in `site/src` CSS or Svelte styles.
  `motion-preference.test.ts`, with a stubbed `matchMedia` and `navigator.connection`: `wantsMotion` is false under
  `REDUCE`, false when `saveData` is true, true otherwise (and true when `navigator.connection` is missing);
  `smoothScrollAllowed('/examples/core-basic-window')` and `('/examples/core-basic-window/')` are false,
  `('/examples')`, `('/')`, `('/docs/start')` true; `wantsSmoothScroll` is false without `FINE_POINTER`;
  `onReduceChange` calls the listener with `true` on a change event and stops after the returned function runs.
- [ ] **Step 2: Run them and see them fail** for the missing modules and tokens:
  `cd site && pnpm exec vitest run tests/unit/shared/motion`.
- [ ] **Step 3: Write `motion-tokens.ts` and `motion-preference.ts`** with the interfaces above. Add the five CSS tokens to
  `tokens.css`'s `:root`. In `base.css`, keep one transition rule for controls inside the
  `prefers-reduced-motion: no-preference` block (`transform var(--t-press) var(--ease-out), background-color
  var(--t-hover) ease, border-color var(--t-hover) ease, color var(--t-hover) ease`), remove the unscoped one, and
  replace `lift` and `settle` with one `@keyframes motion-rise` (from `opacity: 0; transform: translateY(var(--nudge))
  scale(var(--scale-from))`, to `none`) and `@keyframes motion-fade` (from `opacity: 0`).
- [ ] **Step 4: Run the tests and see them pass;** run `pnpm check`. Open Home at 1280 px and confirm hover and press
  on a button look as before.
- [ ] **Step 5: Commit** `feat(site): motion tokens and the motion preference`.

### Task 2: Smooth scrolling (Lenis)

**Files:**
- Modify: `site/package.json` (`"lenis": "1.3.27"` in `dependencies`), `docs/versions.md` (row), the credits data if present
- Create: `site/src/shared/motion/smooth-scroll.ts`, `site/src/shared/motion/smooth-scroll.css`
- Test: `site/tests/unit/shared/motion/smooth-scroll.test.ts`

**Interfaces:**
- Consumes: `MOTION.lerp`.
- Produces: `LENIS_OPTIONS` (the Global Constraints' options, `prevent: preventSmoothScroll`),
  `preventSmoothScroll(node: HTMLElement): boolean`, `interface SmoothScroll { settle(): void; destroy(): void }`,
  `createSmoothScroll(): SmoothScroll`. `settle()` stops a glide where it is
  (`lenis.scrollTo(window.scrollY, { immediate: true, force: true })`; Lenis's own `reset` is private).

- [ ] **Step 1: Write the failing test.** `LENIS_OPTIONS` equals the Global Constraints' values (`lerp` is
  `MOTION.lerp`); `preventSmoothScroll` is true for a node inside `<dialog open>` and inside `[data-native-scroll]`,
  false inside a closed `<dialog>` and in `main`; `smooth-scroll.css` equals the text of
  `node_modules/lenis/dist/lenis.css` once whitespace is collapsed (so an upgrade that changes Lenis's rules fails here).
- [ ] **Step 2: Add the dependency** (`pnpm --filter @automata/site add lenis@1.3.27 --save-exact`), the
  `docs/versions.md` row (`lenis` | 1.3.27 | build date | "Smooth wheel scrolling on the site, fine pointers only; MIT")
  and the credits entry if the file exists. Run the test and see it fail for the missing module.
- [ ] **Step 3: Write `smooth-scroll.ts` and `smooth-scroll.css`.** The CSS is Lenis 1.3.27's `dist/lenis.css` copied
  (Lenis's package says `sideEffects: false`, so its CSS is not imported from the package); `smooth-scroll.ts` imports
  it, so it arrives with the chunk.
- [ ] **Step 4: Run the test and `pnpm check`; see them pass.** `pnpm --filter @automata/site exec knip` may report
  `lenis` unused until Task 4 wires the chunk; note it in the log and do not suppress it.
- [ ] **Step 5: Commit** `feat(site): smooth wheel scrolling with Lenis`.

### Task 3: The moves (GSAP) and the reveal steps

**Files:**
- Modify: `site/package.json` (`gsap`), `docs/versions.md` (row), the credits data if present
- Create: `site/src/shared/motion/reveal-steps.ts`, `site/src/shared/motion/animate.ts`
- Modify: `site/src/features/docs/DocsPage.svelte` (`data-page-content` on `<article class="doc-content">`)
- Test: `site/tests/unit/shared/motion/reveal-steps.test.ts`, `site/tests/unit/shared/motion/animate.test.ts`

**Interfaces:**
- Consumes: `MOTION`.
- Produces: `interface RevealPart { readonly element: Element; readonly product: boolean }`,
  `REVEAL_SECTIONS = 'main .home-section'`, `revealSteps(section: Element): RevealPart[]`,
  `isBelowWindow(element: Element, windowHeight: number): boolean` (its top is at or below `windowHeight`).
- Produces: `interface Animate { pageIn(target: HTMLElement): void; hide(parts: readonly RevealPart[]): void;
  reveal(parts: readonly RevealPart[]): void; finish(): void }`, `createAnimate(): Animate`.

- [ ] **Step 1: Write the failing tests.**
  `reveal-steps.test.ts` renders `Home.svelte` (as `tests/unit/home/home.test.ts` does) and, for each `.home-section`,
  checks `revealSteps`: words first in document order (`.home-kicker`, `h2`, `.home-sub`, `.home-points > li`,
  `.home-more > a`, `p.more`), then products (`.show`, `.home-panel`, each element once, `product: true`), then list
  items (`li` of any `ul` other than `.home-points`); no part contains another part; no part is inside `.hero`,
  `.facts`, `.made` or `.close`. `isBelowWindow` with a stubbed `getBoundingClientRect` (top 900, window 800: true;
  top 799: false).
  `animate.test.ts` (jsdom; GSAP runs there): after `hide(parts)` each part has inline `opacity: 0` and a
  `translate(…8px)` transform, product parts also `scale(0.985)`; after `reveal(parts)` and `finish()` no part has an
  inline `opacity` or `transform`; `pageIn(el)` then `finish()` leaves `el` with no inline style; the stagger offset
  of the eighth part equals the sixth's (read with `gsap.getTweensOf` or the timeline's child start times).
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Add `gsap`** (exact version per the Global Constraints), its `docs/versions.md` row ("The page settle and
  Home's reveals on the site; GSAP Standard License, free, not open source") and the credits entry if present.
- [ ] **Step 4: Write `reveal-steps.ts` and `animate.ts`.** `animate.ts` imports `{ gsap }` from `'gsap'` only (no
  plugins). All tweens are created inside one `gsap.context()`, so `finish()` is `ctx.getTweens().forEach(t =>
  t.progress(1))` then `ctx.revert()`. `pageIn` is a `fromTo` from `{ opacity: 0, y: MOTION.settle }` over
  `MOTION.page`; `reveal` is one timeline, parts at `Math.min(i, MOTION.staggerCap - 1) * MOTION.stagger`, each over
  `MOTION.reveal` to `{ opacity: 1, y: 0, scale: 1 }`; every tween uses `MOTION.ease` and `clearProps:
  'opacity,transform'`.
- [ ] **Step 5: Run the tests and `pnpm check`; see them pass. Commit** `feat(site): the page settle and Home's reveals`.

### Task 4: The motion layer in the layout

**Files:**
- Create: `site/src/shared/motion/motion-layer.ts`, `site/src/shared/styles/motion.css` (imported from `site/src/app.css`)
- Modify: `site/src/routes/+layout.svelte`
- Test: `site/tests/unit/shared/motion/motion-layer.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 3.
- Produces: `interface MotionLoaders { animate(): Promise<{ createAnimate(): Animate }>; smoothScroll(): Promise<{
  createSmoothScroll(): SmoothScroll }> }` with `DEFAULT_LOADERS` (`() => import('./animate')`,
  `() => import('./smooth-scroll')`), `isPageChange(from: URL | undefined, to: URL | undefined): boolean` (both exist and
  the pathname differs), `interface MotionLayer { start(pathname: string): void; beforePageChange(sameRoute: boolean):
  void; afterPageChange(pathname: string, sameRoute: boolean): void; destroy(): void }`,
  `createMotionLayer(win: Window, loaders?: MotionLoaders): MotionLayer`.
- The page-change mark: `<html data-page-change="same|other">`. `motion.css`, under `no-preference` only:
  `:root[data-page-change='other'] main, :root[data-page-change='same'] [data-page-content] { opacity: 0 }`, plus
  `@media print { main * { opacity: 1 !important; transform: none !important } }`.

- [ ] **Step 1: Write the failing tests** (jsdom, stubbed `matchMedia`, `requestIdleCallback`, fake loaders that count
  calls and return fakes):
  - under `REDUCE`, and with `saveData`, `start('/')` calls neither loader;
  - with motion and a coarse pointer, `start('/')` calls `animate` once and `smoothScroll` never; with a fine pointer on
    `/examples/x`, `smoothScroll` never; on `/` it is called once;
  - `afterPageChange('/examples/x', false)` destroys a running smooth scroll and `afterPageChange('/docs', false)`
    creates one again;
  - `beforePageChange(false)` sets `data-page-change="other"`, calls `settle()`, and sets the root's inline
    `scroll-behavior` to `auto`; `afterPageChange` removes both and calls `pageIn` on `main` (`sameRoute: true`: on
    `[data-page-content]`, falling back to `main` when there is none);
  - if `afterPageChange` never comes, `data-page-change` is gone 1,000 ms later (fake timers);
  - before `animate` has loaded, `beforePageChange` sets no mark; if the `animate` loader rejects, no mark is ever set
    and no element gets an inline style;
  - with sections below the window, `start('/')` hides their parts and observes them with `rootMargin:
    MOTION.revealMargin`; an intersection reveals them once; a section already in or above the window is never hidden;
  - a `REDUCE` change mid-visit calls `finish()` and `destroy()`, disconnects the observer, and later
    `beforePageChange` sets no mark; a change back to motion starts again;
  - `isPageChange`: `/docs` to `/docs#a` false, `/` to `/docs` true, `undefined` to `/` false.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Write `motion-layer.ts` and `motion.css`; wire `+layout.svelte`:** create the layer in `onMount` with
  `window` and call `start($page.url.pathname)`; `onNavigate((n) => isPageChange(n.from?.url, n.to?.url) &&
  layer?.beforePageChange(n.from?.route.id === n.to?.route.id))`; `afterNavigate((n) => n.type !== 'enter' &&
  isPageChange(n.from?.url, n.to?.url) && layer?.afterPageChange(n.to.url.pathname, n.from?.route.id ===
  n.to?.route.id))`; `layer.destroy()` on unmount. The idle wait is `requestIdleCallback` with a 1 ms `setTimeout`
  where it is missing.
- [ ] **Step 4: Run the tests and `pnpm check`, then build and look:** `pnpm build && pnpm api-index` at the root,
  `cd site && pnpm build`, serve `build` with `node scripts/serve-static.ts build 4660`, open Home at 1280 px with a
  mouse: the wheel glides, sections arrive, Docs settles in. Open it with reduced motion: nothing moves and the network
  panel shows no motion chunk. Write what you saw in the log.
- [ ] **Step 5: Commit** `feat(site): start the motion layer after the page is live`.

### Task 5: The small CSS moves

**Files:**
- Modify: `site/src/features/search/search.css`, `site/src/shared/components/Header.svelte`,
  `site/src/shared/components/CopyButton.svelte`
- Test: `site/tests/unit/shared/motion/css-moves.test.ts`

- [ ] **Step 1: Write the failing test** (reads the files as text): inside a `prefers-reduced-motion: no-preference`
  block, `.search-dialog[open]` uses `motion-rise` over `var(--t-ui)` with `var(--ease-out)` and its `::backdrop` uses
  `motion-fade`; the header's `.menu[open] nav` uses `motion-rise`; the copy button's tick and its status use
  `motion-fade`; none of the three animates on close; no rule outside a `no-preference` block names `motion-rise` or
  `motion-fade`.
- [ ] **Step 2: Run it and see it fail. Step 3: Add the three rules. Step 4: Run it and `pnpm check`; open the
  search with ⌘K, the phone menu at 390 px and a copy button, and confirm each enters once and Escape closes the search
  at once. Step 5: Commit** `feat(site): small entrances for search, the phone menu and copy`.

### Task 6: The load budget

**Files:**
- Modify: `site/scripts/site-checks/javascript.ts`, `site/scripts/check-site.ts`
- Test: `site/tests/unit/scripts/site-checks.test.ts` (add `checkMotionChunks` cases beside the editor chunk's)

**Interfaces:**
- Produces: `MOTION_SOURCES = ['src/shared/motion/animate.ts', 'src/shared/motion/smooth-scroll.ts']`,
  `MAX_MOTION_GZIP_BYTES = 36_000`, `checkMotionChunks(root: string, manifest: Record<string, ManifestChunk>): {
  failures: string[]; gzipBytes: number }`. Extract the editor check's walk into `chunkFiles(manifest, sources)` and
  use it in both.

- [ ] **Step 1: Write the failing tests** on a fixture manifest: over budget fails with the byte count in the message; a
  page that names a motion file fails; a manifest without a motion source fails; within budget passes and reports the
  bytes.
- [ ] **Step 2: Run them and see them fail. Step 3: Write `checkMotionChunks` and print its bytes in
  `check-site.ts`'s summary line beside the editor's.**
- [ ] **Step 4: Measure.** `cd site && pnpm build && pnpm check:site` passes and prints the motion bytes; the
  modulepreload check still passes on every page (record the heaviest page's bytes before and after Task 4). Run
  `pnpm lighthouse` on the build before Task 4's commit and after it, and record both medians for the six pages; every
  assertion passes.
- [ ] **Step 5: Commit** `test(site): hold the motion chunks to their budget`.

### Task 7: Proof in a browser, the grandma pass and the record

**Files:**
- Create: `site/tests/e2e/motion.e2e.ts`
- Modify: `site/playwright.config.ts` (`use.reducedMotion: 'reduce'` for every project, with a comment: the other
  suites check the finished page), `docs/refactor/progress.md`, this plan's log

- [ ] **Step 1: Write the journeys** (Chromium and WebKit projects; `test.use({ reducedMotion: 'no-preference' })`;
  readiness by polling, never a sleep):
  - a wheel of 300 px on Home: `scrollY` rises over several frames and settles between 290 and 310;
  - over `.docs-sidebar` on a long guide, and over the search results with a long query, the wheel scrolls that box and
    `scrollY` stays put;
  - a contents link on a guide lands its heading 96 px from the top (±2), as it does with reduced motion;
  - PageDown and Space scroll the page;
  - from Home scrolled to the bottom, clicking Docs: the first frame after the URL changes has `scrollY` 0, and
    `main`'s opacity reaches 1 within 400 ms with no inline `transform` after;
  - from `/docs/<a>` to `/docs/<b>`: `.docs-sidebar`'s opacity stays 1 throughout;
  - wheel on a long guide, then Back at once: after 1,000 ms `scrollY` equals where Back restores it (read it with
    reduced motion first) and does not change over the next 500 ms;
  - scrolling Home to the bottom step by step: every `.home-section` part reaches opacity 1 with no inline style;
    loading `/` with a hash or scrolling via `scrollIntoView` to a section shows it at opacity 1;
  - a phone (`devices['iPhone 13']`, `hasTouch`): no `lenis` class on `<html>`, and no motion chunk is requested;
  - reduced motion: no request for either motion chunk (from the manifest), no inline `opacity` on any element in
    `main` after a full scroll, and no `data-page-change` after a click;
  - reduced motion turned on mid-visit with `page.emulateMedia`: the `lenis` class goes and every section part is at
    opacity 1;
  - after a wheel over Home and 700 ms, pressing Play on the demo starts the game (the existing demo check, reused);
  - ⌘K opens search with focus in the field at once; Escape closes it at once.
- [ ] **Step 2: Run them** (`cd site && pnpm test:e2e tests/e2e/motion.e2e.ts`), then the whole site suite in
  Chromium (`pnpm test:e2e --project chromium`). Grep `tests/e2e` for tests that need motion (a moving marquee, an
  autoplaying preview); give each `test.use({ reducedMotion: 'no-preference' })` rather than weakening an assertion.
- [ ] **Step 3: The grandma pass.** With a real mouse wheel and a trackpad if the machine has one, at 1280 and 1440 px:
  read Home top to bottom, open Docs from the header, follow a contents link, press Back, open search. Then a phone at
  390 px with touch. Record in the log, in a sentence each: nothing she might press was missing or late, the wheel felt
  like hers, a click was never slowed, the first screen never moved.
- [ ] **Step 4: The audit rule.** Make a small level in the try-it editor (`/editor/app/`), download it, play it in a
  `create-game` game, reload the editor and confirm the level is still there (the recipe in the site plan's "Fix
  stage" log). Motion must not change any of it.
- [ ] **Step 5: Record and commit.** Fill this plan's log (base, what ran, what did not: WebKit if not run, Firefox,
  the GPU runner, parity), set the motion row in `progress.md`, run root `pnpm format` and `pnpm check`, commit
  `test(site): prove the motion in a browser`, push and open the PR as ready.

## Log

Empty until the build starts.
