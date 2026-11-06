# QB.3h: Lighthouse fixes on `/`, `/start` and `/examples` TDD plan

- **Spec:** the quality-bar spec §4.2 targets (mobile performance at least 0.9, LCP at most 2.5 s) and the QB.3h row of the framework's `docs/02-master-delivery-plan.md`: "fix the total blocking time that holds three pages below the spec's targets, then tighten the budgets".
- **Status:** implemented and locally checked 2026-10-23; CI verified and Owner acceptance open (see the PR).
- **Progress:** 6 of 6 steps.
- **Branch:** `claude/project-thread-onilcu-lighthouse`, based on `main` (`8bcc5a0`).

## Findings that shape the design

Measured on the merged `main` build, served compressed, with `pnpm lighthouse` (median of three mobile runs; Lighthouse 12.6.1, HeadlessChrome 141, a 4-CPU container; the same method as the QB.3f baseline):

| Page | Performance | LCP | TBT | Long tasks that make the TBT |
| --- | --- | --- | --- | --- |
| `/` | 0.62 | 3,179 ms | 1,698 ms | one 1.9 s task at 2.5 s |
| `/start` | 0.67 | 2,506 ms | 2,666 ms | one 2.9 s task at 2.5 s |
| `/examples` | 0.62 | 2,772 ms | 8,802 ms | one 2.0 s task, then about 60 tasks of 160 to 530 ms from the demo iframe |
| `/docs` | 0.98 | 1,996 ms | 0 ms | none |

- **The single long task is syntax highlighting.** A CDP CPU profile of `/start` under 4× slowdown puts about 2.3 s of self time in shiki's tokenizer (`findNextMatchSync` and its caller in the textmate engine). `/docs` has no code block and no long task. Every `CodeBlock` highlights as soon as it mounts, whether or not anyone can see it: `/start` mounts 11 of them, 5 inside closed `<details>`, and `/` and `/examples` each highlight the source explorer's first file far below the first screen.
- **`/examples` starts its demo on load.** `DemoRunner` defaults to `autoStart`, so the PixiJS demo runs its frame loop beside the page (`CanvasPool` tasks of 160 to 530 ms, no GPU in the test browser), which is where the 8.8 s comes from and why TTI is 14.5 s. The home page and `/start` already wait for "Play demo" with a poster.
- **LCP follows the main thread here.** The LCP breakdown shows 59 to 84 % render delay on these pages against 77 % of a smaller number on `/docs`; the simulated LCP includes the long tasks. Remove the tasks first, then re-measure before touching anything else. Candidates only if LCP is still over 2.5 s: the 78 KB `projects.json` chunk that `/` and `/examples` preload (372 KB of example sources, every project, for a page that shows one), the hero poster's fetch priority, and the 46 KB home page HTML.

## Design

- **A code block highlights when it is near the screen.** `CodeBlock` shows the plain `<pre>` immediately (as it does today before the highlighter is ready) and starts `highlightCode` when an `IntersectionObserver` reports the block within 300 px of the viewport, then stops observing. A block in a closed `<details>` never intersects, so it waits until opened. Where `IntersectionObserver` does not exist (old browsers, jsdom) it highlights at once, so behavior and every existing test are unchanged there. Nothing moves when the highlight lands: the block keeps its height class (the plain and highlighted markup both use the same monospace box), which the CLS budget keeps checking.
- **The examples gallery waits for "Play demo".** `/examples` passes `autoStart={false}` and a poster for the demos that have a preview image (`renderer-2d`, `bodies-2d`, `hot-reload`, `lifecycle-and-saves`, and `emberwick` for `base-2d`); `boot-and-flow` and `ui-primitives` have none yet and show the text panel with the button, which `DemoRunner` already supports. This is a product change, not only a performance one: the page no longer plays on arrival. The home page and `/start` already behave this way, so it is also the consistent behavior. It is called out in the PR for the Owner to veto.
- **The example sources load on demand.** `/` and `/examples` get their project from a `+page.ts` load function that imports the sources module with `import()`, so the 380 KB chunk is not modulepreloaded with the page. `check:site` gains a rule (no page preloads more than 320 KB of script, and every modulepreload exists), and `/proof`, which the rule flagged, reads its evidence in a `+page.server.ts` so zod stays out of the browser.
- **The budget ratchets.** `lighthouserc.json` gains a `total-blocking-time` assertion per page and the floors in `tests/lighthouse-budget.test.ts` are tightened to the new numbers (allowing the same tenth of the score and a quarter of the time for noise). The test only lets budgets get tighter.

## Interfaces

- **Produced:** `CodeBlock` highlights lazily (same props); `/examples` page props for `DemoRunner` (`autoStart`, `poster`); `demoPoster(slug)` in `src/lib/previews.ts` (the preview a demo has, if any); `total-blocking-time` budgets; a new `lighthouse-baseline.json`.
- **Consumed:** `highlightCode` (unchanged), `previewSrcset`, `DemoRunner`'s existing `autoStart` and `poster` props.

## Files

- **Create:** `tests/code-block.test.ts`, `tests/examples-gallery.test.ts` (the demo waits for Play), `tests/page-data.test.ts`, `tests/helpers/page-data.ts`, `src/routes/+page.ts`, `src/routes/proof/+page.server.ts`.
- **Modify:** `src/lib/components/CodeBlock.svelte`, `src/routes/examples/+page.svelte` and `+page.ts`, `src/routes/+page.svelte`, `src/routes/proof/+page.svelte`, `src/lib/previews.ts`, `scripts/site-checks.ts`, `tests/site-checks.test.ts`, `.github/workflows/ci.yml` (the Lighthouse report upload keeps its hidden folder), `tests/lighthouse-budget.test.ts`, `lighthouserc.json`, `lighthouse-baseline.json`, `docs/2026-10-14-site-redesign-results.md`, and any existing test that expects the gallery demo to be running on arrival (`tests/e2e/site.e2e.ts` if one does).

## Steps

- [x] **1. Lazy highlighting.** `tests/code-block.test.ts` fails first: with a stubbed `IntersectionObserver` that never reports, `highlightCode` is not called and the plain code shows; when it reports intersecting, `highlightCode` is called once with the code and language and the highlighted markup replaces the plain code; the observer disconnects after that; without `IntersectionObserver` it highlights at once. Then change `CodeBlock`.
- [x] **2. The gallery waits for Play.** `tests/examples-gallery.test.ts` fails first: the page renders no `iframe`, shows the poster for a demo that has one, and a Play click mounts the iframe with the selected demo's bundle; `demoPoster` returns a preview only for the six images that exist. Then change the page and `previews.ts`.
- [x] **3. Re-measure.** Rebuilt, `pnpm lighthouse` three times per page. After steps 1 and 2: performance 0.89 / 0.95 / 0.91, TBT 0 / 8 / 21 ms, LCP still 3,174 / 2,576 / 2,877 ms on `/`, `/start`, `/examples`. The network table named the 78 KB (380 KB built) example-sources chunk, modulepreloaded on `/` and `/examples` only.
- [x] **4. Remaining LCP.** The cause the report named (the sources chunk) is fixed: `src/routes/+page.ts` and `src/routes/examples/+page.ts` load the project on demand, `check:site` fails a page that preloads over 320 KB of script (tests first), and `/proof`, which the new gate flagged at 391 KB because it validated its evidence with zod in the browser, reads it in a server load. Result: performance 0.95 / 0.96 / 0.92 / 0.98; LCP 2,574 / 2,474 / 2,878 / 2,029 ms. `/` and `/examples` are still over 2.5 s; their medians swing by a quarter between sets of runs, a poster `fetchpriority` experiment showed no gain and was removed, and the next candidates (style and layout before the first paint) are a larger change. Recorded in the results doc; stopped here.
- [x] **5. Ratchet.** `lighthouse-baseline.json` recorded again (`scripts/record-lighthouse-baseline.ts`), which turned nine budget tests red against the old `lighthouserc.json`; then the floors, ceilings and a `total-blocking-time` assertion (200 ms) on all four pages. The LCP noise allowance in the test is a third, up from a quarter (measured swing).
- [x] **6. Gates and bookkeeping.** `pnpm check`, `pnpm test` (43 files, 227 tests with the expected fail), `pnpm build`, `pnpm check:site`, the Chromium browser suite (it found that the plain, not yet highlighted `<pre>` needs `tabindex="0"` for axe's scrollable-region rule; fixed test first), `pnpm lighthouse` against the new budget; mutation checks; results doc; the framework's 02 and 03 rows.

## Execution log

See the results doc, "Lighthouse fixes (QB.3h, 2026-10-23)".
