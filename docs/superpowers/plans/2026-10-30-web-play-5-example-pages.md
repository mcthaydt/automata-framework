# WEB.PLAY.5: the example pages and the preview that runs on arrival (TDD plan)

> **Spec:** [live playground design](../specs/2026-10-30-live-playground-design.md) §6 F1, F4, F10, F11 (Restart), §7.1,
> §7.2 (the rows the orchestrator owns), §7.4, §8, §17 WEB.PLAY.5 row. Decisions PLAY-D1, D9, D10, D14.
> **Stacked on:** WEB.PLAY.4 part B (website#20, `claude/website-WEB.PLAY.4b-runtime`, head `59bcf4f`); `framework.ref`
> `f8023a9`.
> **Lane:** website. Plans and specs are auto-accepted (Owner, 2026-10-30).

## Goal

`/examples` is an index of the 17 catalog examples; every example has a prerendered `/examples/<id>` page with the list
beside it, its header fields, its exact source as static code, and a preview that runs the precompiled original once
the page has loaded and the preview is near the screen. Under reduced motion the poster and Play show and nothing under
`/playground/` is requested before Play. The orchestrator owns the frames: candidate, swap on `running`, timeouts,
failures that keep the last good preview, and the message checks of §5.1.

Out of this task (later rows): the editor (WEB.PLAY.6), the compile worker and live edits (.7), Retry, offline and the
editor/worker failure states (.8), Reset and the share link (.9), the determinism row (.10), the Preview toggle,
Fullscreen and the layout pass (.11).

## Files

| File | Create / modify | Responsibility |
| --- | --- | --- |
| `src/data/examples.ts` | create | Typed `examples.json`: `getExamples()`, `getExample(id)`, `exampleIndex()` (the slim list grouped by module) |
| `src/lib/playground/orchestrator.ts` | create | F4, F10, F11 with an injected clock and frame factory; §5.1 parent checks; the §7.1 preview and candidate states; the status texts of §8.3 that apply |
| `src/lib/playground/origin.ts` | create | `atOrigin(code, from, to)`: the precompiled original names the production origin in its `import.meta.url` literal; a local server runs it at its own |
| `src/lib/playground/Playground.svelte` | create | Layout, status line, `data-code`/`data-preview`/`data-run-id`, arrival (load + near screen + reduced motion), the message listener, the frame factory |
| `src/lib/playground/CodePanel.svelte` | create | The static code box: exact source, line-number gutter, Copy code |
| `src/lib/playground/PreviewPanel.svelte` | create | Poster (title panel; the catalog has no screenshots), Play, the frames' container, Restart, the stopped overlay |
| `src/routes/examples/+page.svelte`, `+page.ts` | rewrite | The index: the catalog grouped by module; `?demo=` and every other query land here |
| `src/routes/examples/[id]/+page.svelte`, `+page.ts` | create | Prerendered with `entries` from `examples.json`; sidebar list, header fields, `Playground` |
| `src/lib/components/CommandMenu.svelte` | modify | Example entries point at `/examples/<id>` instead of the retired `?demo=` gallery |
| `lighthouserc.json`, `lighthouse-baseline.json` | modify | `/examples/core-basic-window` and `/examples/shapes-rects` join the collected URLs with the `/examples` budget |
| `tests/playground/orchestrator.test.ts` | create | unit, fake clock and fake frames |
| `tests/playground/origin.test.ts` | create | unit |
| `tests/examples-pages.test.ts` | create | DOM (jsdom): index, example page, arrival, reduced motion, Play, exact source |
| `tests/examples.test.ts`, `tests/examples-gallery.test.ts`, `tests/demo-navigation.test.ts`, `tests/source-explorer.test.ts` | rewrite | The gallery cases go; the `DemoRunner`, `demoPoster`, `demoStatus` and `SourceExplorer` cases stay (those components still serve `/`, `/start` and `/showcase`) |
| `tests/e2e/playground.e2e.ts` | create | real browser, Chromium and WebKit |
| `tests/lighthouse-budget.test.ts` | modify if it pins the URL list | |

## Interfaces

Consumed: `src/data/examples.json` and `static/playground/**` (written by the sync, never by hand);
`src/lib/playground/protocol.ts` (`frameMessage`, `RunMessage`, `PROTOCOL_VERSION`); `SITE_ORIGIN` (`src/lib/site.js`);
`hydrateAfterFirstPaint` (already on every page).

Produced:

```ts
// orchestrator.ts
export const FIRST_BOOT_TIMEOUT_MS = 20_000
export const BOOT_TIMEOUT_MS = 10_000
export interface PreviewFrame { readonly window: unknown; post(message: RunMessage): void; reveal(): void; remove(): void }
export interface Clock { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void }
export type PreviewState = 'poster' | 'starting' | 'running' | 'failed'
export interface OrchestratorView { preview: PreviewState; runId: number; status: string; stopped: string | null; frames: number }
export function createOrchestrator(options: { createFrame(): PreviewFrame; clock: Clock; title: string; onChange(view: OrchestratorView): void }): {
  run(code: string): void         // F4 without a compile: a candidate frame for this code
  restart(): void                 // F11: the last code again, from tick 0
  receive(event: { source: unknown; origin: string; data: unknown }): void
  dispose(): void                 // F10: both frames and every timer
}
// origin.ts
export function atOrigin(code: string, from: string, to: string): string
```

## Steps (each test is written and seen to fail before the code)

1. [x] **Orchestrator.** `tests/playground/orchestrator.test.ts`, failing because the module does not exist:
   "drops a message whose origin is not `null`" (the §17 named test), and: a wrong source, an unparsable shape, a
   stale run id are dropped; `booted` posts `run` once with the next run id; the candidate is revealed only on
   `running` and the old frame removed then; never more than two frames; a second `run` while a candidate boots removes
   that candidate; `failed` (import/boot) removes the candidate and keeps the running preview, with "Line N: …" in the
   status; `failed` (run) from the current frame keeps it with "Stopped: line N: …"; the first frame times out at
   20,000 ms and later ones at 10,000 ms, each removing only the candidate; `restart` runs the last code again;
   `dispose` removes both frames and clears the timers.
   Run: `pnpm vitest run tests/playground/orchestrator.test.ts`, expect red then green.
2. [x] **Origin.** `tests/playground/origin.test.ts`: `atOrigin` swaps the quoted `"<from>/playground/` literal and
   nothing else (not a comment, not another origin), is the identity when `from === to`, refuses a non-origin.
3. [x] **Example data and pages.** `tests/examples-pages.test.ts` (jsdom), failing because the routes do not exist:
   the index lists all 17 examples grouped by module with links to `/examples/<id>`; `entries()` gives every id;
   the page's static code equals the synced source byte for byte; the header fields show; "an example page starts the
   original after `load` with no input" (a stubbed `IntersectionObserver` and `fetch`: after `load` and an
   intersection, one iframe on the frame page with `sandbox="allow-scripts"`, and `fetch` asked for
   `/playground/compiled/<id>.js`; nothing before `load`); "with reduced motion an example page requests nothing under
   `/playground/` before Play" (`matchMedia` stub; Play then starts it); the frame is titled "Preview: <title>" once
   revealed.
4. [x] **Old gallery tests.** Rewrite `examples.test.ts`, `examples-gallery.test.ts`, `demo-navigation.test.ts` and
   `source-explorer.test.ts`: the gallery cases move to the new pages (index, `?demo=` landing on the index), the
   component cases render `DemoRunner` and `SourceExplorer` directly. `tests/page-data.test.ts` and
   `tests/helpers/page-data.ts` follow.
5. [x] **CommandMenu and Lighthouse.** Example entries open `/examples/<id>`; `lighthouserc.json` gains the two
   example URLs with the `/examples` assertions (and `tests/lighthouse-budget.test.ts` if it pins the list).
6. [ ] **Real browser.** `tests/e2e/playground.e2e.ts`: `shapes-rects` reaches `data-preview="running"` with no input
   and the frame draws; no request under `/playground/` before `load`; reduced motion requests nothing under
   `/playground/` before Play, then Play runs it; `/examples` requests nothing under `/playground/`; a forged message
   from the page itself (wrong source) changes nothing. Both projects.
7. [ ] **Gates.** `pnpm check` (0 errors); `pnpm test`; `pnpm build`; `pnpm check:site`; the focused e2e
   (`tests/e2e/playground.e2e.ts`, then `tests/e2e/site.e2e.ts`, since the 17 new pages join the sitemap and its
   gates). Lighthouse is selected if the container can run it, otherwise pending with the reason.

## Gates

| Gate | Command | Expected |
| --- | --- | --- |
| types | `pnpm check` | 0 errors |
| unit + DOM | `pnpm test` | all pass |
| build | `pnpm build` | ok; 17 `build/examples/<id>.html` |
| site checks | `pnpm check:site` | passes with the new pages |
| browser | `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-local pnpm exec playwright test tests/e2e/playground.e2e.ts tests/e2e/site.e2e.ts` | all pass, Chromium and WebKit |
| Lighthouse | `pnpm lighthouse` | budgets hold on the two example pages (R-9), or the numbers go to the Owner |

## Execution log

- 2026-10-30: plan written (website lane, after the WEB.PLAY.4 part B handoff).
