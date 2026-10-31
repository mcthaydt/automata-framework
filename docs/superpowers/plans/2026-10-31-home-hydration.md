# perf: load SourceExplorer files on demand (plan)

> **Asked by:** the coordinator, after website#28's Lighthouse budget failed on `/` (TBT 216 ms against 200 ms on the
> Mac; website#26 hit 273 ms). **Lane:** website. **Branch:** `claude/website-home-hydration`. No budget change.

## Goal

The home page's universal load (`src/routes/+page.ts`) ran again in the browser at hydration. It imported the 260 KB
example-sources chunk (`JSON.parse` of every project) to show base-2d, of which only the first file is visible. Move
the load to the server: the page's data lists base-2d's files and carries only the first file's content. The source
explorer fetches the project's prerendered `/sources/<slug>.json` once, the first time another file is chosen.

## Interfaces

| Name | File | Notes |
| --- | --- | --- |
| `STARTER_FILE` | `src/data/home-sources.ts` | the file the home explorer opens first; the first guide's path |
| `DeferredFile`, `deferredProject(slug, keep)`, `exampleProjectSlugs()` | `src/data/projects.ts` | text files outside `keep` become `{ path, language, deferred: true }`; binary assets are unchanged |
| `/sources/<slug>.json` | `src/routes/sources/[slug].json/+server.ts` | prerendered for every project: its files as published |
| `+page.server.ts` | `src/routes/` | replaces `+page.ts` |
| SourceExplorer | `src/lib/components/SourceExplorer.svelte` | a deferred file shows "Loading this file…", then its content; on a failed fetch, "could not be loaded" with the GitHub link |

## Steps (TDD)

1. [x] `tests/home-sources.test.ts` (fails first: no `home-sources` module): the load lists every file and carries only
   `STARTER_FILE`'s content (data under 20 KB); there is no `+page.ts`, and no browser module on the page imports
   `data/projects`; the endpoint is prerendered for base-2d and returns its files; the explorer fetches once for two
   deferred files; a failed fetch says so.
2. [x] Implement; `tests/page-data.test.ts` reads the server load.
3. [x] Before and after: interleaved Lighthouse runs on `/`.

## Gates

`pnpm check`, `pnpm test`, `pnpm build`, `pnpm check:site`, `site.e2e.ts` on chromium and webkit, `pnpm lighthouse`.

## Execution log

- 2026-10-31: tests failed first (no module), then passed (5 new, 11 with page-data and source-explorer).
- `svelte-check` caught `getExampleProject`'s return type: it now replaces `files` with `SourceFile[]` instead of
  intersecting.
- Build: `/` HTML 44.7 KB to 54.6 KB uncompressed (the file list and the first file inline); the example-sources chunk
  is in no client chunk; `build/sources/` has one JSON per project (base-2d 196 KB, 47 KB brotli).
- Lighthouse 12.6.1 on `/`, 7 interleaved runs each, local Linux container, before = main `776d3d7`:
  - TBT: before 111, 52, 43, 130, 46, 37, 49 (median 49); after 62, 63, 41, 53, 91, 43, 40 (median 53).
  - LCP median: 1652 ms before, 1505 ms after.
  - Transfer median: 288 KB before, 230 KB after.
  - Performance score 1 both.
- What still blocks after FCP: Svelte's hydration of the whole page (the runtime chunk, about 110 ms simulated, at
  about 2.7 s) and an unattributed task at about 1.66 s. Neither depends on the example sources.
- Gates before merging main: `pnpm check` 0/0; `pnpm test` 440 passed and 1 expected fail; `pnpm build`;
  `pnpm check:site` 45 pages; `site.e2e.ts` chromium 337 passed (2 skipped) and webkit 335 passed; `playground.e2e.ts`
  69 passed (2 skipped).
- `pnpm lighthouse`: every collected run is within budget. On `/`, TBT was 90, 46 and 55 ms (median 55). The run was
  stopped by the job's time limit on `/examples/shapes-rects` after one run (TBT 61 ms), before `lhci assert`, so
  the per-URL medians were read from the saved reports.
- Merged `main` `c27b8f9` (website#28). Its `+page.server.ts` (`enginesAgree`) and this one became a single server load,
  and `page-data.test.ts` checks `enginesAgree` against the evidence. After the merge: `pnpm check` 0/0;
  `pnpm test` 459 passed and 1 expected fail; `pnpm build`; `pnpm check:site` 46 pages.
