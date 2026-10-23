# QB.3j: LCP at most 2.5 s on `/`, `/start` and `/examples` TDD plan

- **Spec:** the quality-bar spec §4.2 targets (mobile performance at least 0.9, LCP at most 2.5 s) and the QB.3j row of the framework's `docs/02-master-delivery-plan.md`. The Owner said to go ahead on 2026-10-23 08:06Z.
- **Status:** steps 1 to 4 implemented and checked 2026-10-23, the budget passing on the hosted runner twice (runs 39930045734 and 39938497330); the hosted browser job of the final head and the Owner's veto of the hydration trade are open (the hosted run for the code head `de07175`, 39941880445, never got a runner, twice, because GitHub-hosted jobs are stopped for the account's billing, so it proves nothing; its `browsers` job is the proof of the rewritten picture test once the Owner fixes billing and the run can be re-run).
- **Progress:** 4 of 5 steps.
- **Branch:** `claude/project-thread-onilcu-lcp`, based on `main` (`c4b5901`, QB.3h merged).

## Where QB.3h left it

Measured on the GitHub-hosted runner (Chromium 153), which enforces the budget; median of three mobile runs.

| Page | Performance | FCP | LCP | LCP element |
| --- | --- | --- | --- | --- |
| `/` | 0.87 | 2,470 ms | 3,388 ms | the demo poster (`<img>`) |
| `/start` | 0.95 | 2,062 ms | 2,581 ms | a paragraph |
| `/examples` | 0.92 | 2,382 ms | 2,892 ms | the heading |
| `/docs` | 0.98 | 1,914 ms | 2,065 ms | a paragraph |

On every page 78 to 82 % of the LCP is render delay after the first byte, and the first contentful paint is 1.9 to 2.4 s even on `/docs`, which has one stylesheet and no code. So the work is on what delays first paint, not on the images, except for the one extra effect on `/`.

## Experiments (container, Chromium 141, same method; median of five)

Each variant is the built site with one change made to its HTML, served compressed, judged with Lighthouse (simulated slow 4G, 4× CPU). FCP / LCP in ms.

| Variant | `/docs` | `/start` | `/examples` | `/` |
| --- | --- | --- | --- | --- |
| built site as it is | 1,879 / 2,023 | 2,030 / 2,509 | 2,042 / 2,271 (2,200 or 2,900) | LCP 2,574 |
| CSS inlined in each page | 1,878 / 1,969 | 2,027 / 2,562 | 1,918 / 2,152 (2,100 or 2,860) | |
| no font preload | 2,028 / 2,028 | 2,191 / 2,936 | 2,165 / 3,014 | |
| chunk files merged (`experimentalMinChunkSize`), still preloaded | 1,715 / 1,865 | 1,903 / 2,256 | 2,039 / 2,416 | |
| no `modulepreload` links at all | 1,059 / 1,511 | 1,134 / 1,656 | 1,358 / 1,660 | 1,353 / 1,956 |
| **only the entry and node modules preloaded** | 1,186 / 1,507 | 1,452 / 2,107 | 1,458 / 1,711 | 1,493 / 2,107 |
| no script, no preloads (a floor) | 1,053 / 1,053 | 1,207 / 1,505 | 1,205 / 1,355 | |

- **The `modulepreload` links are the cost.** Each page lists 26 to 29 of them (80 to 90 KB compressed, 250 to 275 KB built). Lighthouse's simulation shares the slow link between everything that was in flight before the first paint, so the stylesheet and the font wait behind script that nothing needs until hydration. Dropping the links for shared chunks and keeping those for the entry and the two node modules (7 to 12 KB compressed) takes 0.5 to 0.9 s off first paint and 0.4 to 0.8 s off LCP. Inlining the stylesheet, merging chunks and removing the font preload do not help (the font preload matters: without it the swapped text paints later).
- **The price is hydration, measured under the same network and CPU throttling in a real browser** (Chromium 141 with the DevTools profile: 1.6 Mbit/s, 150 ms, 4× CPU). First paint: `/docs` 676 → 648 ms, `/start` 756 → 688 ms (only a little, a browser prioritises the stylesheet). The last module arrives later: `/docs` 1,216 → 1,633 ms, `/start` 1,354 → 1,726 ms (0.4 s later; with no preloads at all 0.6 to 0.7 s later). The pages are prerendered, so the text, the links and the images are there before that; the search box, the menu, the filters and the demo's Play button start working that much later on a slow connection. That is the trade, and it is the Owner's to veto.
- **`/` has a second, hosted-only cause.** Chromium 153 fetches two `loading="lazy"` gallery images (95 KB, 2,300 and 2,860 px down) about 90 ms after the poster, and the simulation charges them to the poster's LCP (3,388 ms hosted against 2,574 in the container). Chromium 141 does not fetch them. `content-visibility: auto` did not stop the fetch. The images have to be requested only when the reader nears them.

## Design

- **Only the entry and node modules are preloaded.** `src/hooks.server.ts` passes every prerendered page through `withoutChunkPreloads` (new, `src/lib/preloads.ts`), which removes the `<link rel="modulepreload">` lines for files under `_app/immutable/chunks/` and leaves every other link alone. The hydration script still imports the same modules; only the head's hints go. `check:site` replaces the 320 KB gate with a rule that a page preloads only `_app/immutable/entry/` and `_app/immutable/nodes/` files, within 48 KB built (the largest page preloads 35 KB), and keeps "every modulepreload exists".
- **Gallery pictures wait until they are near.** A `LazyPicture` component renders the `<picture>` (with `<source srcset>` and `<img src>`) only when an `IntersectionObserver` reports its box within 400 px of the viewport, inside a placeholder of the right aspect ratio (no layout shift), with a `<noscript>` copy of the same picture so a reader without script gets the images and a crawler that does not run script sees them. The poster of a `DemoRunner` is not wrapped (it is the LCP). It replaces the native `loading="lazy"` on the home page's example previews and `CreativeStarts` (used by `/` and `/showcase`).
- **Budgets are re-recorded on the hosted runner and tightened.** If every page then meets 0.9 and 2.5 s, `/` leaves `BELOW_PERFORMANCE_TARGET`, its floor becomes 0.9 and its LCP ceiling 2,500 ms like the others. The recorded numbers come from the CI job's printed medians, not from the container.

## Interfaces

- **Produced:** `withoutChunkPreloads(html)` (`src/lib/preloads.ts`) and the hook that applies it; `LazyPicture.svelte` (props: the JPEG path as `previewSrcset` takes it, `alt`, `width`, `height`, `sizes`, optional class); the `check:site` preload rule; a new `lighthouse-baseline.json` and budgets.
- **Consumed:** `previewSrcset`, `checkSite`, `MAX_PRELOADED_SCRIPT_BYTES`, the Lighthouse job's median printout.

## Files

- **Create:** `src/hooks.server.ts`, `src/lib/preloads.ts`, `tests/preloads.test.ts`, `src/lib/components/LazyPicture.svelte`, `tests/lazy-picture.test.ts`.
- **Modify:** `scripts/site-checks.ts`, `tests/site-checks.test.ts`, `src/routes/+page.svelte`, `src/lib/components/CreativeStarts.svelte`, `tests/e2e/site.e2e.ts` (the home page requests only the poster's image before the first scroll, on a slow connection) and `tests/e2e/gates.ts` if it needs a helper, `lighthouserc.json`, `lighthouse-baseline.json`, `tests/lighthouse-budget.test.ts`, `docs/2026-10-14-site-redesign-results.md`.

## Steps

- [x] **1. Fewer preloads.** `tests/preloads.test.ts` fails first (the module does not exist): `withoutChunkPreloads` drops chunk `modulepreload` links, keeps entry and node links, the stylesheet link and the font preload, and changes nothing else in the document, also when the links are on one line. `tests/site-checks.test.ts` fails first: a page that preloads a shared chunk fails `check:site`, a page that preloads only entry and node files passes, and the byte budget is 48 KB. Then add the hook and the rule; rebuild and confirm no built page lists a chunk. Done: 7 and 6 new unit tests, red first (module missing; the old rule accepted a chunk), seven planted changes caught; the built pages list four preloads each (entry/start, entry/app, nodes/0, the page's node) and `check:site` passes on 28 pages.
- [x] **2. Pictures near the reader.** `tests/lazy-picture.test.ts` fails first: with an observer that never reports there is no `<img>` and a placeholder keeps the aspect ratio; when it reports intersecting the `<picture>` renders once and the observer disconnects; without `IntersectionObserver` the picture renders at once; the `<noscript>` copy is in the markup. The e2e test fails first on a slow connection: the home page has requested images other than the poster before any scroll. Then use `LazyPicture` on the home page and in `CreativeStarts`. Done: the e2e test failed first (Chromium 141 fetched `double-jump` and `bodies-2d` before any scroll, so the early fetch shows locally with plain Playwright), 4 unit tests red then green, six planted changes caught, plus an e2e test that a reader without script still gets the pictures (`javaScriptEnabled: false`). `CreativeStarts`' scoped `img` rules became `:global(img)` under `.creative-preview`, and its links gained an `aria-label` (the link's name no longer comes from an image that is not there yet).
- [x] **3. Re-measure locally.** Rebuild; `pnpm lighthouse` and the throttled load probe; expect every page under 2.5 s with the container's Chromium. Done, median of three: `/` 0.98 and LCP 2,109 ms (was 0.95 and 2,574), `/start` 0.99 and 2,106 (0.96, 2,474), `/examples` 0.99 and 1,715 (0.92, 2,878), `/docs` 1.00 and 1,556 (0.98, 2,029); first contentful paint 1.25 to 1.47 s (was 1.9 to 2.4); TBT 135 ms on `/` (was 46; the hydration now falls after first paint, still under the 200 ms line), 78, 26 and 16 ms elsewhere. The Chromium suite passes (228 tests); WebKit runs on the hosted job.
- [x] **4. Hosted judgement and ratchet.** Push; the CI job prints the hosted medians; re-record `lighthouse-baseline.json` from them; tighten `lighthouserc.json` and `tests/lighthouse-budget.test.ts` (red first against the new baseline); a second hosted run confirms. Done: hosted medians (run 39930045734): `/` 0.96, LCP 2,122 ms, `/start` 0.99, 2,111, `/examples` 0.96, 1,749, `/docs` 1.00, 1,636; the only red was the gallery's blocking time in the median run (208 ms against 200). Baseline re-recorded from those medians, which left 8 of 27 budget tests red (the old ceilings 3,700, 3,000 and 3,300, the home page's 0.8 floor and its below-target entry); every page is now held to 0.9 and 2.5 s, `/` and `/examples` get a 300 ms blocking-time line with the reason in the test, and nine planted changes to the budget are caught. The second hosted run's Lighthouse job passed (`/` 0.95, 2,125 ms, 211 ms blocking; `/start` 0.97, 2,114; `/examples` 0.98, 1,861; `/docs` 1.00, 1,599). Its browser job failed one test, my own picture test in WebKit: it relied on a smooth scroll to the bottom passing every picture; rewritten with instant jumps, four planted changes caught, and the recorded-blocking-time rule now holds each page to its own line.
- [ ] **5. Gates and bookkeeping.** `pnpm check`, `pnpm test`, `pnpm build`, `pnpm check:site`, the Chromium browser suite locally and the hosted `browsers` job (WebKit); mutation checks; the results doc; the framework's 02 and 03 rows; the Owner write-up.

## Execution log

See the results doc, "LCP under 2.5 s (QB.3j, 2026-10-23)" once step 3 is done.
