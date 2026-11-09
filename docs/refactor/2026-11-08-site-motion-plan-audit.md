# Site motion: plan audit

> **2026-11-09:** GSAP was replaced by Motion (MIT) after this was written, at the Owner's word. Read GSAP below as the
> record of the time; the plan's swap log says what changed.

Stage 3 of the site motion pipeline (Opus, medium; superpowers `writing-plans` used as the standard the plan is held
to; no subagents). Audited 2026-11-08 on AF #541 (`b69837ee`, on #520's `09d5a347`): the
[spec](2026-11-08-site-motion-spec.md) and the [plan](2026-11-08-site-motion-plan.md). Every fix below is applied to
those two documents in this PR. The editors question (spec section 9) is left to the Owner, who is answering it on the
plan's card; nothing here changes it.

**Verdict: the plan is sound and ready to build once the fixes below are in (they are).** Its numbers check out, the
reduced-motion path downloads nothing, and the GSAP licence permits the website. Two findings would have failed the
build or shipped a visible gap (A1, A2); the rest tighten tests and wording.

## What was checked, and what it showed

| Claim | How it was checked | Result |
| --- | --- | --- |
| Lenis 1.3.27 is 5,445 B gzip, GSAP 3.15.0 core 27,605 B | Rebuilt both with esbuild (minified ESM, `gzip -9`) | 5,403 B and 27,547 B (my entry wrapper differs by a few bytes): **holds**. Neither contains `eval` or `new Function`. |
| Lenis's options exist and do what the spec says | Read `lenis` 1.3.27's `lenis.d.ts` and `lenis.mjs` | **Holds.** `autoRaf`, `lerp`, `smoothWheel`, `syncTouch`, `anchors`, `allowNestedScroll`, `stopInertiaOnNavigate`, `prevent` are all public; `reset` is private, so `settle()` via `scrollTo(scrollY, { immediate, force })` is right. `stopInertiaOnNavigate` only catches link clicks, so the plan's own `settle()` on every page change (Back and Forward included) is needed, and it is there. Lenis also honours reduced motion by itself (`respectReducedMotion`, default on), a second guard behind the plan's. |
| A wheel notch is 90% done at 264 ms with `lerp: 0.14` | Lenis damps with `1 - e^(-60 · lerp · t)`, frame-rate independent | 90% at 274 ms and 99% at 548 ms in theory; the measured 264 and 514 ms match (first-frame offset). **Holds.** "Settled by about 600 ms" was short: half a pixel takes about 760 ms (A11). |
| `power4.out` is the kit's `--ease-out` | Compared `1 - (1 - t)^5` with `cubic-bezier(0.22, 1, 0.36, 1)` at 1,000 points | Largest gap 0.011 (at t = 0.06): **the same curve to the eye.** |
| A whole section finishes in 780 ms | 480 + 5 × 60 | **Holds.** |
| The page-change mark never blanks the old page while data loads | Read SvelteKit 2.70.4's `client.js` `navigate()` | **Holds.** `onNavigate` callbacks run after `load_route` resolves, just before `root.$set`; scroll is reset after the DOM update and `afterNavigate` runs after that. So `main` is hidden only across the swap, and the inline `scroll-behavior: auto` covers SvelteKit's `scrollTo` and `scrollIntoView` (Back, deep links). |
| GSAP's moves can be unit-tested in jsdom | Ran `gsap.set`, a staggered timeline with `clearProps`, `progress(1)` and `context.revert()` under jsdom | **Holds** with `requestAnimationFrame` and `cancelAnimationFrame` present, which Vitest's jsdom provides. |
| Reduced motion downloads nothing | Read the plan's layer, the site's `base.css`, `playwright.config.ts` and the existing e2e | **Holds.** The site's Playwright config has no `reducedMotion` today (some tests set it per test); Task 7 setting it for every project and opting `motion.e2e.ts` out is consistent. |
| The CSP allows it | `src/shared/html/csp.ts` | `script-src 'self'` + hashes, `style-src 'self' 'unsafe-inline'`: the two dynamic chunks, Lenis's stylesheet as a Vite CSS file and GSAP's inline styles are all allowed. **Holds.** |
| GSAP 3.15.1 can be pinned from 2026-11-18 | `npm view gsap time` | 3.15.1 was published 2026-11-04, so 14 days is 11-18. **Holds.** But 4.0.0-beta.3 appeared 2026-11-05 (A7). |
| The GSAP licence quotes | Read <https://gsap.com/standard-license> (effective 2025-04-30, modified 2025-05-30) | Quotes **hold**. One correction: Webflow may end the licence "in its discretion **if you fail to comply**", not at will; and a version released before a licence change stays under its old terms, while using a later version accepts the new ones (A7). The website is a permitted use. |

## Findings, all fixed in this PR

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| A1 | High | Task 6's budget walk follows every import from `animate.ts` and `smooth-scroll.ts`. `motion-tokens.ts` is imported by the layer (in the layout) and by both chunks, so Vite puts it in a chunk the layout already loads; the walk then counts that chunk, and "no page names a motion file" fails on a correct build. | Motion files are those reachable from the motion sources **less** those reachable from any entry; a motion source must still be its own file. Two new test cases. |
| A2 | High | Reveals only ran on a visit's first page: `afterPageChange` never scanned the new page, and `beforePageChange` never finished the old reveals. Docs to Home by the header showed every section at once while a fresh visit had them arrive, and a reveal could run on detached nodes. | `beforePageChange` finishes and disconnects; `afterPageChange` scans the new page's `main .home-section`. Unit and journey tests. |
| A3 | Medium | Tab into a hidden section draws a focus ring round an invisible link until the observer fires, and the `-15%` margin may not fire at all if the focused element sits in the window's bottom strip. Fails the drunk grandma test for keyboard users. | `focusin` inside a hidden section reveals it at once. Unit and journey tests. |
| A4 | Medium | The plan named the copy rewrite's branch (`claude/project-thread-fvbpvx`), which does not exist; that thread may add, remove or reorder Home's sections and add pages (Pricing, a new Editor page). The never-hidden list and the reading-pages list named today's blocks and pages. | Step 0 re-inventories routes and sections on the merged base; reveals key off `main .home-section` alone on any route; "nothing outside a `.home-section` is ever hidden"; a test holds that reading features never use the class; the journeys loop over every route instead of naming them. |
| A5 | Medium | Task 1's single transition rule would have dropped `.demo-list a`, `.docs-sidebar nav a`, `nav.link-row a` and `box-shadow` from today's rule. | The rule keeps today's selectors and `box-shadow 240ms`; the test checks them. |
| A6 | Medium | `--ease-out` is not a site token: it comes from the editor kit's `tokens.css`, which the editors v2 build is changing. A rename would turn every move into a silent `ease`. | Task 1's test holds the kit's name and value. |
| A7 | Medium | GSAP's terms can change, and a later version comes under the new terms; `gsap` 4 is in beta, and "the newest version 14 days old" could pick it. | Pin the newest **3.x**; read the licence page on build day and stop if it changed; a Renovate rule keeps `gsap` below 4 and reminds the reviewer to re-read the licence. Spec wording corrected. |
| A8 | Low | `finish()` reverts the GSAP context; the plan never tested that the animator still works afterwards. | Test: `pageIn` after `finish()` still animates and clears. |
| A9 | Low | The print rule `main * { transform: none !important }` would flatten every transform on the page in print (icons, the marquee). | Every element motion touches carries `data-motion`; print targets `main, [data-motion]` only. |
| A10 | Low | The spec said content is "simply there" for Find in page; after GSAP has hidden a part, it arrives instead (within 780 ms). | Wording corrected. |
| A11 | Low | "Settled by about 600 ms" for a wheel notch. | About 760 ms to half a pixel, with the formula. |
| A12 | Low | The reading-pages list missed `/app`, `/editor`, `/api` and the not-found page. | Covered by A4's rule (no `.home-section` outside marketing pages) instead of a list. |

## Completeness, consistency, cohesion

- **Complete:** every spec section has a task (5.1 and 5.2 in Tasks 3 and 4, 5.3 in Tasks 1 and 5, 5.4 in Task 2, 6 in
  Task 6, 7 and 8 in Task 7). The Owner's audit rules (make and play a small game in the editor, reload and confirm it
  persists) are in Task 7 Step 4.
- **Consistent:** names and signatures agree across tasks (`MOTION`, `revealSteps`, `RevealPart`, `Animate`,
  `SmoothScroll`, `MotionLayer`, `MotionLoaders`). The tokens table, the Global Constraints and Task 1's interface give
  the same values.
- **Cohesive:** one folder, `site/src/shared/motion/`, pure helpers tested in jsdom, two lazy chunks, CSS for what CSS
  can do. Nothing reaches into the editors, the games or the playground's frames.

## The drunk grandma test

Could a drunk grandma tell what is happening and what to press? Yes: the first screen never moves, a click is never
slowed (no exit, 220 ms in), her wheel is a little softer and her phone untouched, and with A3 a link she tabs to is
never invisible. Nothing she might press is ever more than 780 ms from fully there, and nothing waits on a script.

## Not run

No code was built in this stage. WebKit and Firefox were not run (not installed in the cloud container); the build's
journeys run in Chromium and WebKit. Lighthouse was not run; Task 6 records it before and after.
