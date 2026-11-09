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
this PR's branch. If AF #521 (the credits page) and the copy rewrite's PR (thread "Rewrite the site copy from GTM
research"; it had not pushed when the plan was audited, so find its branch from its PR, never from a guessed name) are
still open, merge both into the build branch first, in one merge-up pass, and name the base in the log. Every path below
exists at `09d5a347` except the credits file (from #521).

**Step 0, before Task 1 (the copy rewrite may restructure the site):** on the merged base, list every route
(`find site/src/routes -name '+page.svelte'`), every file that uses `home-section`, and Home's section order, and write
them in the log. Nothing in this plan names a Home section or counts them: reveals key off `main .home-section` on any
route, and the tests read whatever sections the markup has. If the rewrite renamed `.home-section`, `.home-kicker`,
`.home-sub`, `.home-points`, `.home-more` or `.home-panel`, change `revealSteps`' selectors and this plan's Task 3 to
the new names in the first commit and say so in the log; if it moved the playground off `/examples/<id>`, change
`smoothScrollAllowed` to match. A new page (Pricing, a new Editor page) needs nothing: Lenis and the page settle are
site-wide.

## Global Constraints

- Lenis options, verbatim: `autoRaf: true`, `lerp: 0.14`, `smoothWheel: true`, `syncTouch: false`, `anchors: false`,
  `allowNestedScroll: true`, `stopInertiaOnNavigate: true`, `prevent` true inside `dialog[open]` or
  `[data-native-scroll]`.
- Tokens: press 140 ms, hover 180 ms, ui 200 ms, page 220 ms, reveal 480 ms, stagger 60 ms, stagger cap 6 parts per
  section, rise 8 px, settle 6 px, nudge 4 px, scale from 0.98 (a section's product 0.985), ease `power4.out` =
  `--ease-out` `cubic-bezier(0.22, 1, 0.36, 1)`. No duration over 480 ms, no travel over 8 px, no scale under 0.98.
- Only `transform` and `opacity` animate. No ease-in, bounce or elastic. No exit animation on a page change.
- Nothing is hidden by CSS or HTML before GSAP has loaded; reveals hide only parts of a `main .home-section` that is
  wholly below the window; nothing outside a `.home-section` is ever hidden; reading pages never use `.home-section`.
  Focus moving into a hidden section reveals it at once.
- The ease comes from the editor kit's `--ease-out` (`packages/editor/src/shared/kit/tokens.css`, reached through
  `@automata/editor/tokens.css` in `site/src/app.css`); the editors v2 build is changing those tokens, so a test holds
  the name and value.
- Reduced motion or `navigator.connection.saveData`: neither chunk is requested, the site is exactly as before.
- Lenis loads only for `(hover: hover) and (pointer: fine)` and never on `/examples/<id>`.
- Load: the two chunks and their imports within 36,000 bytes gzip; no page modulepreloads them; Lighthouse assertions in
  `site/lighthouserc.json` unchanged and passing; each page's modulepreload under the existing 48,000-byte budget.
- Dependencies pinned exactly: `lenis` 1.3.27; `gsap` the newest **3.x** version at least 14 days old on the build day
  (3.15.0 on 2026-11-08; 3.15.1 from 2026-11-18). `gsap` 4 is in beta (4.0.0-beta.3, 2026-11-05) and Lenis 2 in dev;
  neither is taken here. Read <https://gsap.com/standard-license> on the build day; if its "Last modified" date is
  later than 2025-05-30, stop and tell the Owner before adding GSAP.
- `renovate.json` gets one rule for `gsap`: `allowedVersions: "<4"` and a `prBodyNotes` line saying to re-read the
  licence page before merging, because a GSAP version released after a licence change comes under the new terms. A row each in `docs/versions.md`. A credits entry each if
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
   link into Home, Find in page, or Tab into a hidden section must leave nothing at opacity 0 (or a focus ring round an
   invisible link). Tests: Task 4 (the mark's 1,000 ms fallback; a rejected import hides nothing; `focusin` reveals)
   and Task 7 (deep link; Tab).
2. **Reduced motion turned on mid-visit.** Running moves jump to their end with no inline styles left, Lenis is
   destroyed, and nothing new starts. Tests: Task 4 (unit) and Task 7 (`emulateMedia` mid-test).
3. **Back or Forward during a glide.** The page lands where SvelteKit restores it and does not drift. Test: Task 7.
4. **Nested scroll boxes.** The docs sidebar, the search results and code blocks keep the wheel; the page does not move.
   Test: Task 7.
5. **Leaving or arriving mid-visit.** A page change while a section is arriving leaves no inline `opacity` or
   `transform` on the new page, and arriving at Home by a click (Docs to Home, Back to Home) reveals its sections below
   the window as a first visit does. Tests: Task 3 (`finish` clears, and the animator still works after it), Task 4
   (`beforePageChange` finishes and disconnects; `afterPageChange` scans the new page) and Task 7.

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
  converted; the kit's `packages/editor/src/shared/kit/tokens.css` declares `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`
  (so a rename in the editors v2 build fails here, not as a silent `ease`); `base.css` has no `@keyframes lift` or
  `@keyframes settle`, exactly one rule whose selector list includes `button` and that declares `transition`, that rule
  still lists `.button`, `.demo-list a`, `.docs-sidebar nav a` and `nav.link-row a`, and no `ease-in` anywhere in
  `site/src` CSS or Svelte styles.
  `motion-preference.test.ts`, with a stubbed `matchMedia` and `navigator.connection`: `wantsMotion` is false under
  `REDUCE`, false when `saveData` is true, true otherwise (and true when `navigator.connection` is missing);
  `smoothScrollAllowed('/examples/core-basic-window')` and `('/examples/core-basic-window/')` are false,
  `('/examples')`, `('/')`, `('/docs/start')` true; `wantsSmoothScroll` is false without `FINE_POINTER`;
  `onReduceChange` calls the listener with `true` on a change event and stops after the returned function runs.
- [ ] **Step 2: Run them and see them fail** for the missing modules and tokens:
  `cd site && pnpm exec vitest run tests/unit/shared/motion`.
- [ ] **Step 3: Write `motion-tokens.ts` and `motion-preference.ts`** with the interfaces above. Add the five CSS tokens to
  `tokens.css`'s `:root`. In `base.css`, keep one transition rule for controls inside the
  `prefers-reduced-motion: no-preference` block, on the same selectors it has today (`button, .button, .demo-list a,
  .docs-sidebar nav a, nav.link-row a`): `transform var(--t-press) var(--ease-out), background-color var(--t-hover)
  ease, border-color var(--t-hover) ease, color var(--t-hover) ease, box-shadow 240ms ease` (box-shadow stays as
  today; it is not a motion token). Remove the unscoped one, and
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
  items (`li` of any `ul` other than `.home-points`); no part contains another part; every part is inside a
  `.home-section`, so nothing in `.hero`, `.facts`, `.made`, `.close` or any other non-section block is ever a part. The
  test loops over whatever `.home-section`s Home renders, never a fixed count. A second case reads the source of the
  reading features (`src/features/{docs,api,changelog,start,legal,examples,playground}`) and finds no `home-section`. `isBelowWindow` with a stubbed `getBoundingClientRect` (top 900, window 800: true;
  top 799: false).
  `animate.test.ts` (jsdom; GSAP runs there): after `hide(parts)` each part has inline `opacity: 0` and a
  `translate(…8px)` transform, product parts also `scale(0.985)`; after `reveal(parts)` and `finish()` no part has an
  inline `opacity` or `transform`; `pageIn(el)` then `finish()` leaves `el` with no inline style; after `finish()`, a
  second `pageIn(el)` still sets an inline opacity and a second `finish()` clears it (the context is reused after
  `revert()`); every element `hide` or `pageIn` touched carries `data-motion` until `finish()` or its move ends removes
  it; the stagger offset of the eighth part equals the sixth's (read with `gsap.getTweensOf` or the timeline's child
  start times). Vitest's jsdom provides `requestAnimationFrame` and `cancelAnimationFrame`, which GSAP's ticker needs
  (checked in the plan audit: `gsap.set`, `progress(1)` with `clearProps` and `revert()` all behave in jsdom).
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Add `gsap`** (exact version per the Global Constraints, after reading the licence page), its
  `docs/versions.md` row ("The page settle and Home's reveals on the site; GSAP Standard License, free, not open
  source"), the credits entry if present, and the `renovate.json` rule from the Global Constraints.
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
  `@media print { main, [data-motion] { opacity: 1 !important; transform: none !important } }` (only what motion
  touched, so the page's other transforms print as they are).

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
  - a `focusin` on an element inside a hidden section reveals that section at once and unobserves it;
  - `beforePageChange` calls `finish()` and disconnects the observer; `afterPageChange('/', false)` with new sections
    below the window hides and observes them (arriving at Home by a click reveals as a first visit does), and on a page
    with no `.home-section` it observes nothing;
  - a `REDUCE` change mid-visit calls `finish()` and `destroy()`, disconnects the observer, and later
    `beforePageChange` sets no mark; a change back to motion starts again;
  - `isPageChange`: `/docs` to `/docs#a` false, `/` to `/docs` true, `undefined` to `/` false.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Write `motion-layer.ts` and `motion.css`; wire `+layout.svelte`:** create the layer in `onMount` with
  `window` and call `start($page.url.pathname)`; `onNavigate((n) => isPageChange(n.from?.url, n.to?.url) &&
  layer?.beforePageChange(n.from?.route.id === n.to?.route.id))`; `afterNavigate((n) => n.type !== 'enter' &&
  isPageChange(n.from?.url, n.to?.url) && layer?.afterPageChange(n.to.url.pathname, n.from?.route.id ===
  n.to?.route.id))`; `layer.destroy()` on unmount. The layer listens for `focusin` on `main` once while any section is hidden. The idle wait is `requestIdleCallback` with a 1 ms `setTimeout`
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
  use it in both. The motion files are `chunkFiles(manifest, MOTION_SOURCES)` **less** `chunkFiles` of every manifest
  entry with `isEntry: true` (the app's entries and the layout's node): `motion-tokens.ts` is imported by the layer in
  the layout and by both chunks, so the walk from `animate.ts` reaches a chunk every page already names, and counting
  or forbidding that chunk would fail a correct build. Each motion source must still be its own file in that set (a
  source that ended up inside an entry was imported statically by mistake, and that fails).

- [ ] **Step 1: Write the failing tests** on a fixture manifest: over budget fails with the byte count in the message; a
  page that names a motion file fails; a manifest without a motion source fails; within budget passes and reports the
  bytes; a motion chunk that imports a chunk an entry also imports neither counts it nor fails when a page names it; a
  motion source whose file is an entry's file fails.
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
  - from `/docs`, clicking the logo to Home, then scrolling: the sections below the window arrive as on a first visit;
  - on Home, pressing Tab until focus is in a section below the window: that section's parts reach opacity 1 within
    800 ms of the focus, and the focused element is at opacity 1 when the poll ends;
  - every route in Step 0's list loads with no console error and reaches full opacity (one loop, so pages the copy
    rewrite added are covered without naming them);
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

- 2026-11-08, plan audit (stage 3): [2026-11-08-site-motion-plan-audit.md](2026-11-08-site-motion-plan-audit.md). Fixes
  applied to this plan and the spec: A1 to A12. Build log starts below.

### Build log (stage 4, Sonnet high, 2026-11-09)

**Base.** The build branch is AF #542's tip (`98129556`, the copy rewrite, itself on #520) with #543 merged in
(`dc5775b4`); one conflict, in `progress.md`, kept both sections. AF #521 (the credits page) was not in the base, so
there is no credits file and no credits entries (the plan says "if it exists"); add Lenis (MIT) and GSAP ("GSAP Standard
License: free to use, not open source") there when #521 lands.

**Step 0 inventory.** 15 routes with a page (`editor`, `not-found`, `app` (Pricing), `api`, `api/[version]/[pkg]`,
`start`, `examples`, `examples/[id]`, `terms`, `privacy`, `docs`, `docs/[slug]`, `changelog`, `/`). `home-section` is in
the 11 Home components. Home's order is Hero, Facts, Made with, Built in, Code (agents), Determinism (checks), Editor,
Targets (Publish), Pricing, Examples, Changelog, closing band. The class names the plan keys off all survived the copy
rewrite, so `revealSteps` kept its selectors. The playground is still `/examples/<id>`.

**Pins.** `lenis` 1.3.27 (5.4 KB gzip). `gsap` 3.15.0, not 3.15.1: 3.15.1 came out 2026-11-04, four days before the
build, and 4.0 is a beta. The licence page (read 2026-11-09) still says "Last modified date: May 30, 2025", so the plan's
stop condition did not fire. Renovate holds `gsap` below 4 and tells whoever reviews its PR to re-read the licence.

**What ran** (all Chromium, cloud container):
- Site unit tests 495 (was 434): tokens, preference, Lenis options and its native-input handling, the moves, the reveal
  steps against the real Home, the layer (22 cases), the CSS moves, the budget check.
- `svelte-check` 0 errors; `pnpm lint` clean for the files this changes; `knip` clean; `pnpm build` of the site and
  `check:site` (47 pages). The motion chunks are 32,941 B gzip of the 36,000 budget; no page names them.
- Lighthouse (the site's `lighthouserc.json`, 3 runs a page, medians), before this branch's motion and after:
  performance 100 on all six pages both times; Home LCP 1,584 ms both; Home TBT 0 ms before, 38 ms after (the layer and
  the first reveal); other pages 0 to 4 ms. All assertions pass.
- `tests/e2e/motion.e2e.ts`: 20 journeys, 3 of 3 runs green. Wheel glide over several frames landing at 300 +/- 10;
  PageDown, Home and End (also straight after a wheel); wheel over the docs sidebar and over the search results moves the
  box, not the page; a contents link lands 96 px under the top (also straight after a wheel); a click to Docs starts at the
  top on the first frame and settles with nothing left behind; another guide keeps its sidebar at opacity 1; Back after a
  wheel does not drift; Home's sections arrive and leave no inline style; End then Home leaves every section visible;
  Tab into a waiting section reveals it; Docs to Home by a click reveals as a first visit; every route in the sitemap
  loads without a console error and ends fully visible; the playground has no `lenis` class; reduced motion downloads
  neither chunk; reduced motion switched on mid-visit removes `lenis` and shows every part; a phone (iPhone 13) has no
  smooth scroll and never requests it; search opens with focus in the field and Escape closes it at once.
- The whole site suite in Chromium: 421 passed, then the 51 failures were looked at: 47 were the playground suites
  (an example autostarts only without reduced motion, and the suite default is now reduced; the two playground files now
  ask for `no-preference`) and 4 were `site.e2e.ts` still listing "Reference", which the copy rewrite (#542) replaced
  with Pricing in the header. After both fixes: `playground.e2e.ts` 37 of 37, `playground-layout.e2e.ts` and
  `site.e2e.ts` 162 of 162, `visitor.e2e.ts` and `editor-try.e2e.ts` 15 of 15 (also run once with motion on).

**Not run:** WebKit and Firefox (not installed in the container; the journeys are written for both projects in
`playwright.config.ts` and need the CI runner), the GPU runner, cross-engine parity, root `pnpm check` end to end. Failures
that already exist on this base and are not this branch's: `pnpm boundaries` (3, `extensions/editors` sequence imports
writer), `pnpm source-names` (5), `pnpm style` (3 broken links in docs: `site-build-audit.md`, `dark-mode-build-audit.md`),
and `pnpm api-index` (3 undocumented exports).

**Rulings.**
1. *The site's pins are not rows in `docs/versions.md`.* The plan asked for rows; `tooling/versions` reads only
   `packages`, `extensions`, `tooling`, `games` and `examples`, so a row for a site-only pin fails its "no row for a
   version nothing uses" test (the site's other pins, such as `sucrase`, have none). The pins are exact in
   `site/package.json` and recorded here. Cost if wrong: add the rows when that tool learns about `site/`.
2. *Lenis's stylesheet is in the page's CSS (`styles/smooth-scroll.css`), not in the chunk.* A dynamic import's CSS is
   linked by every page, which would send it to visitors who asked for less motion and failed the budget check. The rules
   do nothing without Lenis's `lenis` class; a test holds the file equal to Lenis's own. Cost: 0.4 KB for everyone.
3. *A key, a click on a #link, focus and a press on the scroll bar stop Lenis's glide first (`smooth-scroll.ts`).* Found
   in the browser: Lenis ignores the browser's own scrolling until its glide has died away (about 1.5 s after a wheel), so
   End, PageDown and contents links pressed just after a notch did nothing or snapped back. Cost: one listener set. Not
   covered: Find in page and script `scrollTo` within about 1.5 s of a wheel still lose to the glide, then recover.
4. *Reveals also run on every scroll while a section waits (`motion-layer.ts`).* The observer only sees a section while it
   is on screen, so End, a #link or dragging the scroll bar left skipped sections hidden. Cost: a rect read per waiting
   section per scroll, only while one waits (at most nine).
5. *A same-route change with no `[data-page-content]` settles the whole page.* Otherwise `/examples/a` to `/examples/b`
   would flash the new page at full strength, then drop to opacity 0. `afterPageChange` follows what `beforePageChange`
   marked, not the `sameRoute` flag.
6. *A phone loads the moves, not the smoothing.* The plan's Task 7 says "no motion chunk is requested" on a phone, but its
   Task 4 loads GSAP for a coarse pointer. The journey asserts what Task 4 builds: Lenis is never requested.
7. *The suite default is reduced motion.* The plan's change, with the two playground files and the motion journeys opting
   back in. `site.e2e.ts`'s stale `Reference` link is corrected to `Pricing`.

**Task 7, the Owner's audit rule (make a game, play it, reload).** The visitor journeys (play Emberwick; make a platformer
level in the try-it editor and share it) pass with motion on. Reloading the try-it editor does not bring a new level
back, with motion on or off (probed in Chromium: no stored keys, no canvas after reload): that is the editors' saving
work (sign-in and saving thread), not motion, and the editor loads no motion code. Playing a downloaded game from
`create-game` was not repeated; motion never touches a game's frame.

**The grandma pass** (Chromium at 1440 x 900 and an iPhone 13, by journeys and screenshots; no physical trackpad):
Home read top to bottom: the first screen never moves and Make a game is there at once. Each section is readable as it
reaches the middle of the window, and a section that is skipped by End or a link is already shown. The wheel feels like
a slightly softer native one (a notch is 90% done in about a quarter of a second). A click on Docs, Examples or Back
starts the next page at its top and eases it in, 6 px over 0.22 s, with no wait before it. Search opens with the cursor
in the box and closes the instant Escape is pressed. On the phone the page scrolls with its own momentum, sections
ease in once, and the menu opens with a 4 px rise. Nothing she might press was missing, late or moving under her finger.
