# Automata site redesign results

Implemented the audit fixes and replaced the original dark card-based presentation with the approved Design Taste direction. Canonical and social URLs use https://automata.ruken.com. Changes are local and have not been deployed.

## Design and content

Direction: **Type and nothing else**, seed **2089695647**, Chivo, **Candy chapters**. The site uses large type, flat yellow/white/pink/cyan/orange sections, square controls, a plain navigation bar and a full-width closing wordmark. Hairline panels, decorative gradients, bento components and Lucide icons were removed. Styling now uses a single plain CSS token system; unused styling and icon dependencies were removed from the manifest and lockfile.

One blueprint redraw: “Headline you can type” became “Live demo with controls.” Automata produces playable games rather than editable headlines. No palette redraws or invented product imagery. The imagery is the actual bundled game and example interfaces; no stock images, mock customer data, sample testimonials or external image credits were introduced. The social image is an original typography graphic.

The page argument moves from game programming to the playable Emberwick room, then focused demos, ownership boundaries and setup. The homepage embeds the starter. Other demo interfaces start on request, avoiding several simultaneous GPU sessions; the stop control unloads the iframe. Reduced-motion users get stopped embeds and no entrance or control animation.

Copy changes remove AI guarantees, first-attempt promises, crash guarantees, invented public installers, milestone jargon, fixed performance labels and unsupported reference-project claims. The source sample is now a complete simulation example checked against the current framework types. The API page is explicitly a selected reference, not an exhaustive specification. Generated docs were corrected at the generator and regenerated into JSON and both plain-text endpoints.

## Audit closeout

| Finding | Implementation |
| --- | --- |
| Incompatible starter and invented APIs | Published snippet typechecks against the adjacent simulation source; listed exports are checked against package entry points. Async creation, actual instance methods, runtime boot, physics, host and content entries are corrected. |
| Ignored demo deep links | Universal page load reads demo selection from the URL on the client; anchors preserve navigation and history. Unknown slugs use the catalog fallback. |
| Missing mobile navigation | Native details menu exposes the same primary destinations, with current-page semantics and adequate control sizing. Docs sections also collapse on phones. |
| Unsupported AI claims/installers | Replaced with project context, architectural guidance and verification instructions. |
| Misleading and inaccessible search | Native modal dialog searches pages, documentation content, API signatures and demos; arrow navigation, labelled input, Escape, modal focus and focus restoration are implemented. |
| False copy success | Shared copy control reports denied clipboard access and suggests manual selection. |
| Placeholder homepage demo | Actual starter bundle embedded, with explicit controls and standalone link. |
| Iframe load mistaken for game readiness | Reads existing trusted bundle boot markers; detects failure, bounds loading to 20 seconds, supports retry and clears timers between attempts. Only catalog bundle URLs can be embedded. |
| Missing landmarks, metadata and current page | Main landmark, skip link, visible focus, current-page semantics, one managed title/description, canonical and social metadata, social PNG and branded error route. |
| Slash stealing editable input | Shared editable-target guard excludes fields and open dialogs. |
| Clipped demo instructions | Header extraction now preserves continuation lines. The sync pipeline no longer manufactures an empty canvas claiming readiness when a bundle is missing. |
| Heavy highlighting surface | Load the highlighter on demand with only the needed languages/theme and a JavaScript regex engine. No all-language or Wasm bundle is loaded by the highlighting module. |

## Verification

- Full website unit suite: **16 files, 35 tests passed**.
- Nearest affected suite after final homepage/control edits: **3 files, 9 tests passed**.
- Svelte check: **0 errors, 0 warnings**.
- Static production build: passed with strict prerender errors and compressed outputs.
- `pnpm check:site`: verified **14 built pages** for unique title/description, main landmark, canonical origin, social image, internal destinations and anchors.
- In-process built server with the full manifest: `/` and `/docs/overview` returned **200**; `/docs/no-such-page` returned **404** with the branded error copy.
- Design Taste source lint: **0 FAIL, 0 WARN**; output saved in `.taste-skill/source-lint.txt`.
- `git diff --check`: passed.
- Dependency lockfile regenerated offline in an isolated temporary directory after the shared pnpm store rejected writes. No dependency versions were upgraded.

## Visual and runtime acceptance remains open

A native Chrome view of the built homepage from disk showed the oversized yellow first screen and navigation. That review exposed excessive hero padding and a long supporting sentence; both were reduced. File-origin viewing does not establish client routing, clipboard permissions or live demo behavior.

The session cannot bind a local preview server (`listen EPERM`). Design Taste's viewport inspector therefore cannot run. Subsequent native screenshot capture failed with ScreenCaptureKit error `-3811`. Reliable final captures at 1440, 768 and 390 pixels, a scored screenshot critique, live HTTP interaction checks, host CSP and actual device/GPU acceptance have **not passed**. No numeric visual score is assigned without those captures.

The build also emits warnings from SvelteKit's generated `root.svelte` about initial store references. Application Svelte diagnostics are clean; generated framework files were not edited or warning filters added. Chivo is requested from Google Fonts with a system fallback; network/font loading and final line wrapping still need the browser pass.

Run `pnpm preview --host 127.0.0.1 --port 5198` in an environment that permits local servers, then use the Design Taste inspector against that URL. These are acceptance steps, not completed checks.

## Quality gates (QB.3, 2026-10-16)

Implements the framework's quality-bar spec (QB.3, §4.2 and QB-c) on branch `claude/clever-pasteur-ujmu6e-qb3`. Plan: [`docs/superpowers/plans/2026-10-16-qb3-website-quality-gates.md`](superpowers/plans/2026-10-16-qb3-website-quality-gates.md).

| Finding | Fix and gate |
| --- | --- |
| F-1: the site says MIT; the framework says `UNLICENSED` | `tests/license-claim.test.ts` reads the sibling framework's published `license` fields and `LICENSE`. It is `it.fails` ("expected red until DX.11"): green while the claim is false, red once the framework is MIT, so DX.11 must remove the marker. The MIT copy stays. |
| F-2: six JPEG previews named `.png` | Renamed to `.jpg`; 640 px and full-width WebP copies (`scripts/encode-previews.ts`) served through `<picture>` with `srcset`. `check:site` fails when an image's bytes differ from its extension or an `<img>` has no `alt`; the browser suite fails when an image is more than 2× its rendered width. |
| F-3: no `robots.txt` or `sitemap.xml` | Generated after `vite build` from each page's canonical URL (`scripts/write-seo-files.ts`); `check:site` fails on a page missing from the sitemap, an entry with no page, or a `robots.txt` without the `Sitemap:` line. |
| F-4: no privacy, terms, contact or security contact | `/privacy`, `/terms`, footer links and a `mailto:` contact on every page, `/.well-known/security.txt` (Contact, Expires, Canonical). QB-D3: one contact and one security address, no postal address. `check:site` fails on a missing link, a missing or expired `security.txt`, or any `<form>`. |
| F-5: fonts from `api.fontshare.com` | Already replaced by `@fontsource-variable/geist` on `main` before QB.3. Added a preload of the Geist latin face. `check:site` fails on an `@font-face` without `font-display: swap`, any asset from another origin, or a page without a font preload. |
| F-6: no real-browser tests | `pnpm test:e2e` (Playwright 1.63, Chromium and WebKit) on the built site at 375×667, 768×1024, 1280×800 and 780×270. See below. |
| Favicon set | 32 px PNG and 180 px apple-touch icon rendered from `favicon.svg` (`scripts/render-favicons.ts`); `check:site` checks their sizes and links. |
| Placeholder copy | `check:site` fails on `lorem`, `TODO`, `coming soon`, `seamless`, `cutting-edge`, `unleash`, `supercharge`, `revolutionize`, `game-changer`. |

Browser suite, per page and viewport: no horizontal scroll, console error, page error, third-party request, cookie or browser storage; axe (WCAG 2.2 AA) at 375 and 1280. Also: every primary link reachable in the header or the opened menu; a Start link in the header at every width; "Make your first change" visible without scrolling at 375×667; Tab reaches every control with a visible focus ring; every visible button changes something; branded 404 with links; demo runner loading and failure states; search empty state; content and links with JavaScript off; heading and primary action on an emulated slow 3G connection (Chromium only, as it needs the DevTools protocol). `tests/e2e/gates.e2e.ts` proves each gate catches a planted fixture.

Defects the suite found and this branch fixed: below 1050 px the Start link was only inside the folded menu (now always in the header); the API reference's focusable signature regions did not scroll themselves (axe `scrollable-region-focusable`).

### Verification (2026-10-16, shared container, load average about 30)

- `pnpm check`: 0 errors, 0 warnings.
- `pnpm build`: passed; `pnpm check:site`: 26 pages verified. `tests/site-checks.test.ts` holds a failing fixture for every rule (27 cases).
- `pnpm test`: 29 files, 104 tests. First attempt: 99 passed, 1 expected fail (the MIT claim), 4 failed: three 5 s timeouts under load and `api-contract` "publishes the exact current project files", which fails identically on `main` because the sibling framework checkout has no `LICENSE` file. Rerun of the two affected files with `--testTimeout=60000`: 5 passed, 1 failed (that same pre-existing test).
- `pnpm test:e2e` (Chromium and WebKit): 424 tests. First attempt: 422 passed, 1 skipped (slow 3G on WebKit, by design), 1 failed: `/examples` buttons at 1280 in Chromium hit the 120 s test timeout while its WebGL demo ran. The button tests now run with reduced motion (no auto-started demo) and a 300 s limit; rerun of all 104 button tests: 104 passed.

### Pending and open

- **Lighthouse CI budget: recorded 2026-10-23 (QB.3f), not yet a deployed-origin number.** See "CI and Lighthouse (QB.3f)" below. Re-record against the deployed origin once DX.12/QB.4 land.
- **Owner acceptance pass: open.** A real phone, Safari, and a second person walking the journey, recorded here with device, browser and date. Also open: the Owner's read-through of each page against its purpose, and the privacy and terms wording.

| Owner check | Device and browser | Date | Result |
| --- | --- | --- | --- |
| Real phone journey | | | open |
| Safari | | | open |
| Second person runs the journey | | | open |
| Privacy and terms wording | | | open |

## CI and Lighthouse (QB.3f, 2026-10-23)

Implements the QB.3f row of the framework's master plan on top of QB.3. Plan: [`docs/superpowers/plans/2026-10-23-qb3f-website-ci.md`](superpowers/plans/2026-10-23-qb3f-website-ci.md).

### What the CI is

`.github/workflows/ci.yml` has three jobs on the Owner's `af-linux` runner label (`vars.AF_LINUX_RUNNER` moves it; there is no hosted fallback, as in the framework). `checks` runs `pnpm check`, `pnpm build`, `pnpm check:site` and `pnpm test`, then uploads the build; `browsers` runs `pnpm test:e2e` (Chromium and WebKit) in the pinned Playwright image on that build; `lighthouse` runs `pnpm lighthouse` on that build. `tests/workflows.test.ts` pins the shape.

**The framework is checked out at `framework.ref`, not at `main`.** Tests, the workshop and the sync scripts read the framework's sources from a sibling checkout. The site's committed copies (`src/data/projects.json`, the workshop proof) match the framework at `365f115` (M1 exit). Framework `main` has since moved Emberwick from `examples/base-2d` to `games/emberwick` (EX.2): against today's `main`, `pnpm check` reports 16 errors, `pnpm build` fails in `verify:workshop`, and 6 test files fail. So a CI that followed `main` would be red for reasons unrelated to the change under test. Moving the pin is a deliberate change: re-sync the site from the new commit, then edit `framework.ref`.

**Owner actions before the first run:**

1. Register a self-hosted runner labelled `af-linux` (or set `AF_LINUX_RUNNER`) to this repository, with Docker for the Playwright image.
2. Add the repository secret `AF_FRAMEWORK_TOKEN`: a fine-grained personal access token with "Contents: read" on `mcthaydt/automata-framework` (the repository is private). The job fails at once with a message when it is missing.

### Findings

- **F-1 stays visible.** At `365f115` the only failing unit test was `api-contract` "publishes the exact current project files": the site's copies of `LICENSE`, `LICENSE-SCOPE.md` and the `license` field in `package.json` carry MIT, and the framework ships neither until DX.11. Those three files alone may now differ; an `it.fails` test keeps the difference in view and goes red when DX.11 lands, so DX.11 must remove both.
- **A flaky unit test.** `source-explorer` "connects the homepage explanations…" failed in 2 of 3 full runs (`Found multiple elements with the text: /createLoop/`): once the code is highlighted `createLoop` is in two tokens. It now asks for all of them. Four consecutive full runs passed.
- **Lighthouse: three pages miss the spec's targets.** First recorded run (below). Performance is 0.62 on `/`, 0.66 on `/start` and 0.62 on `/examples` against the target of 0.9, and LCP is 3.2 s, 2.6 s and 2.8 s against 2.5 s. Total blocking time is the cause (1.7 s, 2.5 s and 6.4 s); `/docs` scores 0.98 with none. CLS is 0 everywhere. This is a performance task for whoever owns the pages, not part of QB.3f.

### Lighthouse baseline

`lighthouse-baseline.json`, written by `scripts/record-lighthouse-baseline.ts` from `pnpm lighthouse`'s reports: the median of three mobile runs per page (Lighthouse 12.6.1, HeadlessChrome 141, simulated 4G and 4× CPU slowdown) against the built site served compressed (`serve-static.ts --compressed`: the `.br`/`.gz` files adapter-static wrote, as the host will). Machine: a 4-CPU Linux cloud container, load average 1.5 to 2, benchmark index about 2,000 to 2,300. It is not the deployed origin: re-record against DX.12/QB.4.

| Page | Performance | LCP | CLS | TBT | Transfer |
| --- | --- | --- | --- | --- | --- |
| `/` | 0.62 | 3,163 ms | 0 | 1,698 ms | 420 KB |
| `/start` | 0.66 | 2,561 ms | 0 | 2,477 ms | 351 KB |
| `/examples` | 0.62 | 2,778 ms | 0 | 6,435 ms | 541 KB |
| `/docs` | 0.98 | 1,974 ms | 0 | 0 ms | 127 KB |

**Budget (`lighthouserc.json`).** Per page, judged on the median run, `error` level: performance at least 0.55, 0.6, 0.55 and 0.9; LCP at most 4,000, 3,300, 3,500 and 2,500 ms; CLS at most 0.1. The spec says thresholds "come from the first recorded run and are only tightened", so `tests/lighthouse-budget.test.ts` holds each page to its floor: no looser than the first run allowing a tenth of the score and a quarter of the LCP for noise, or than the spec's target where the page already meets it. Tightening is free; loosening fails the test. A second `pnpm lighthouse` run passed all four budgets.

### Verification (2026-10-23, framework at `365f115`, Node 22.22.0, 4-CPU container, load average under 2)

- `pnpm check`: 0 errors, 0 warnings. `pnpm build`: passed. `pnpm check:site`: 26 pages verified.
- `pnpm test`: 32 files, 138 passed, 2 expected fails (the MIT claim and the licence files), 0 failed; four consecutive runs. The framework was installed with `--ignore-scripts`, as the CI does.
- Red-first evidence: each new test failed on a planted change (a dropped `persist-credentials`, a hosted runner, a framework install with scripts, a mismatched Playwright image, a loosened Lighthouse budget, a baseline the budget no longer passes, the compressed mode switched off, the licence list shortened) and passed on the real files.
- QB.3's browser suite, re-run here: `pnpm test:e2e` in Chromium only, **212 passed**. 211 ran in this container's preinstalled full Chromium 141 (Playwright 1.63.0 pins 153); one, "a clean page passes every gate", failed there with a `favicon.ico` 404 that full Chromium requests and the headless shell does not, and passed in the preinstalled headless shell. **WebKit was not run:** `cdn.playwright.dev` is blocked from this container, so WebKit and the pinned Chromium 153 are pending on the runner (bus test-request).
- Not run: the three workflow jobs themselves (no runner is registered to this repository, and `AF_FRAMEWORK_TOKEN` does not exist yet).


## Inside page (PRODUCT.4w, 2026-10-23)

Implements the PRODUCT.4w row of the framework's master plan: the site's `/inside` page renders the framework's generated `docs/stack.md` (PRODUCT spec §8) and a test holds the site's copy to the framework's file. Plan: [`docs/superpowers/plans/2026-10-23-product4w-inside-page.md`](superpowers/plans/2026-10-23-product4w-inside-page.md). Stacked on QB.3f (PR #3); independent of DX.9w, so the two footers each add one link and the second PR to merge resolves a one-line conflict in `Footer.svelte`.

### What the page is

- `pnpm sync:stack` copies `docs/stack.md` from the sibling framework checkout's `origin/main` into `src/data/stack.md` and records the framework commit that last changed it and the file's sha256 in `src/data/stack.source.json`. The recorded copy is commit `313daa7` (framework `origin/main` was at `5ad4a84`), sha256 `ad256094…e356068c`. `pnpm sync:stack --check` says whether the framework has moved the page since. It did while this was being built: the first copy was `c2f6f48`, and `--check` then reported `313daa7`, a framework change that moved `vite` from 8.3.2 to 8.3.3 on the page. One `pnpm sync:stack` took it in and changed two lines of the page and the record; the tests held throughout, which is the flow working as designed. The embedded example sources (`src/data/projects.json`, from `365f115`) still show `vite` 8.3.2; they have their own sync and are not part of this change.
- `tests/stack-page.test.ts` is the check the plan asks for: the copy matches its recorded sha256 and is byte for byte `git show <commit>:docs/stack.md` from the framework checkout. CI's checkout is pinned to `framework.ref` but fetches full history, so the recorded commit is there to compare with.
- The page shows the framework's words, versions and licences as they are. Two mechanical edits: the generated-file comment is dropped, and the relative `versions.md` link points to that file on GitHub (the site does not serve the framework's docs folder). A block the page cannot lay out (code, quote, a heading below level 2, a numbered list) makes `stackSections` throw, so a change in the framework fails a test instead of showing raw markup.
- The page has the framework's overview table with an anchor to each library's section, then one section per library (a package, version and licence table, and the tier, role, rationale and what AF adds), then the Planck-to-Rapier note. Each table is in a labelled, keyboard-focusable scroll region. `**bold**` is new in the site's inline text (`parseInline`), never inside a code span.
- Colyseus is "not yet installed" and the vendored Ruken packages are "not declared in the installed package", as the framework says. The site adds nothing to hide that; PRODUCT.4r (a Ruken request for licences) is what changes it.

### Verification (2026-10-23, framework `origin/main` at `5ad4a84`, recorded stack commit `313daa7`, 4-CPU container)

- `pnpm check`: 0 errors, 0 warnings. `pnpm build`: passed. `pnpm check:site`: 27 pages verified (26 plus `/inside`).
- `pnpm test`: 35 files, 158 passed, 2 expected fails (the MIT claim and the licence files, as in QB.3f), 0 failed. The framework checkout here is `origin/main`, not `framework.ref`; the stack tests do not read anything the pin would change.
- Chromium browser suite (`pnpm test:e2e`, QB.3 gates, full run before the last small edit): **219 passed**, 7 of them for `/inside` (axe, keyboard and focus rings, every button, no overflow at 375 px, no third-party requests, no console errors). After removing the unused ordered-list branch, the 7 `/inside` gates re-ran on the final build and passed. Same caveat as QB.3f: run in the container's preinstalled headless shell (Chromium 141; Playwright pins 153), **WebKit not run** (`cdn.playwright.dev` is blocked here), pending on the runner (bus test-request).
- Red-first evidence: `tests/inline-markdown.test.ts`, `tests/stack-page.test.ts` and `tests/sync-stack.test.ts` each failed before their code existed (`readFrameworkStack is not a function`, no `stackSections`). Planted changes the tests then caught: keeping the generated-file comment, rewriting in-page anchors as framework links, rewriting nothing, accepting an unrenderable block (code, quote, numbered list, level-3 heading), ending sections at the wrong heading level, dropping the table's region role, not rendering the table, not rendering bold, and a sync script that compared only the commit or took the newest commit instead of the one that last changed the page. A mutation that the first tests missed (an ordered list the page could render but the framework's page never uses) led to removing that branch: the page renders what the framework uses, and anything else fails loudly.
- Looked at: `/inside` at 375 px, 1280 px and as a full page in the Chromium headless shell. Reading order, the overview table and the library sections look right. Each library heading carries a `scroll-margin-top` for the sticky header; following an overview link was not clicked through by hand. No Owner visual acceptance has happened.
- Not done: the optional CI step for `pnpm sync:stack --check` (a moving `main` would make CI red for reasons unrelated to the change under test; the commit check in the unit tests is the gate). The first workflow run is still waiting on the runner and `AF_FRAMEWORK_TOKEN` (QB.3f).

## Re-sync to framework main (QB.3g, 2026-10-23)

Replaces QB.3f's stopgap, the pinned framework: the site's copies now come from framework `5ad4a84` (`main`), and `framework.ref` says so. Plan: [`docs/superpowers/plans/2026-10-23-qb3g-site-resync.md`](superpowers/plans/2026-10-23-qb3g-site-resync.md).

### What changed

- **The move.** Emberwick (`@af-examples/base-2d`) is at `games/emberwick`. The sync, the displayed file paths on the home page, the start page, the AI guidance and the creative starts, the workshop's imports and the tests now say so. The demo stays at `/demos/base-2d`. The six other demos did not move.
- **The sync.** `pnpm sync` searches `examples/` and `games/` for shared packages, replaces each demo's bundle instead of merging a new build into the old one (hashed file names left every old build behind), and writes the framework commit it read to `framework.ref`. It refuses a framework checkout with edited or untracked files. It does not build the demos: build them in the framework (`pnpm build:demos` and `pnpm --filter @af-examples/base-2d build`) first.
- **Regenerated:** `src/data/projects.json` (the published example sources), `demos.json`, the seven demo bundles, the workshop bundle and its proof date (`first-change-proof.json`, re-verified against the new sim), `static/llms-full.txt`.
- **The licence files.** The three files the site carried ahead of the framework (`LICENSE`, `LICENSE-SCOPE.md`, the `license` field) are no longer in the published project files, because the framework has none yet. `api-contract` therefore needs no allowance and its `it.fails` test is gone. DX.11 plus one `pnpm sync` brings them back. The Terms page's MIT claim is unchanged and `license-claim.test.ts` still holds it as expected red until DX.11.

### Verification (2026-10-23, framework `5ad4a84`, Node 22.22.0, 4-CPU container)

- Before the change, against `main`: `pnpm check` 10 errors; `pnpm sync` stopped at "Missing demo source". The merge queue's run of `pnpm test` on the same pair found `api-contract`, `example-sources` (2 tests) and `source-explorer` failing, and `first-change`, `double-jump` and `workshop-controls` failing at import.
- After: `pnpm check` 0 errors, 0 warnings. `pnpm test`: 37 files, 168 passed, 1 expected fail (`license-claim`), 0 failed. `pnpm build` passed (it re-runs the workshop's tests against the framework's sim); `pnpm check:site`: 27 pages. Chromium browser suite (headless shell 141): **219 passed**.
- Red-first: `example-sources`, `demo-bundles` and `framework-source` failed before their code existed. Planted changes the tests caught: no `games/` search, a bundle folder that kept `/index.html`, a bundle that merged instead of replacing, no `index.html` check, a dirty checkout accepted, a 4-character commit id.
- Not run: WebKit and Chromium 153 (a bus test-request covers them); the Lighthouse budget against the new bundles (the four measured pages are unchanged, but `/examples` loads the demos; re-record when DX.12 gives a quiet origin).
- Not done: the previews (`static/previews/*.jpg`, the home page poster) are older screenshots of Emberwick and the demos; the framework's art and screens have changed since `365f115`. Refreshing them needs a capture on a machine with a GPU browser, and the Owner's visual acceptance.
