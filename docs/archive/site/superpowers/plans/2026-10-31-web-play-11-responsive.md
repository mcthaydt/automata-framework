# WEB.PLAY.11: the responsive and input pass, measurements and acceptance (TDD plan)

> **Spec:** [live playground design](../specs/2026-10-30-live-playground-design.md) §9 (layout and input), §8.2 (the
> Preview toggle, Fullscreen, sizes), F11 (Fullscreen), §10.2 (time budgets), A-14, A-15, A-16, A-18, §17 WEB.PLAY.11.
> **Stacked on:** WEB.PLAY.10 (website#26, `claude/website-WEB.PLAY.10-determinism`, head `fa39095`), itself on
> WEB.PLAY.9 (website#25). `framework.ref` `f8023a9`.
> **Lane:** website. Plans and specs are auto-accepted (Owner, 2026-10-30).

## Found while measuring

- Already in place: the one-column / two-column switch at a 700 px container with the preview sticky
  (`Playground.svelte`), 16:10 by width, `inert` candidates; `site.e2e.ts` runs overflow, axe, keyboard and dead-button
  gates on every sitemap page (the example pages included) at 375×667, 768×1024, 1280×800 and 780×270;
  `playground.e2e.ts` covers the editor's name, 16 px text, wrapping, ring and Tab, and the code box's size (§9.3).
- Missing: the Preview toggle (§8.2: code header, `aria-pressed`, below 700 px), Fullscreen (§8.2, F11: preview
  toolbar, always; DemoRunner's behaviour), the height cap for a wide, short playground (§9.1: height < 500 px), a
  height-only test, the 50-edit soak (A-16), and per-control size checks across the four layouts.

## Goal

- A-14 at 375×667: changing only the viewport height (667 → 400 → 667) leaves the preview's box and `data-run-id` as
  they were. The Preview toggle (44 px, "Preview", `aria-pressed="true"` while shown) hides the preview: its wrapper
  clips to zero height and is `inert`, the frame keeps its own box and run id, and it shows again on a second press.
  It is not shown at 700 px and wider.
- A-14 at 768×1024 and 1280×800: side by side, the preview sticky while the code scrolls. At 780×270: side by side, and
  the preview panel fits in the viewport below the site header (`min(16:10 of the column, 100svh − header − toolbar)`,
  the game letterboxed).
- Every control in the playground at least 44×44 px at all four sizes, Play and Retry 48 px high.
- Fullscreen (44 px, preview toolbar, always): puts `.preview-panel` in fullscreen, or leaves it; when the browser
  refuses or doesn't answer within 1 s, says "Fullscreen is unavailable in this browser." in the toolbar.
- A-16: fifty edits in a row never leave more than two frames, settle at one, with no console errors.
- A-15: axe has no violations on `/examples/shapes-rects` with the editor open, at 375 and 1280.

## Interfaces

- `PreviewPanel`: a Fullscreen button and its message; no new props.
- `CodePanel`: props `previewShown: boolean`, `ontogglepreview()`; the toggle is rendered always and hidden by the
  container query at 700 px and wider.
- `Playground.svelte`: `previewShown` state; the preview wrapper's `data-shown` and `inert`.

## Files

- `src/lib/playground/Playground.svelte`, `CodePanel.svelte`, `PreviewPanel.svelte`.
- `tests/e2e/playground-layout.e2e.ts` (new: A-14, A-15 with the editor, A-16).
- `docs/evidence/owner-visual/2026-10-31-web-play-11-layouts/` (screenshots and README),
  `docs/evidence/2026-10-31-web-play-11-measurements.md` (the latency table and Lighthouse run from this container).

## Steps (each test fails first, for the reason given)

- [x] 1. A-14 height-only at 375 px. Expected to pass from the start (the preview's size follows its width): kept as
  the spec's named guard, and recorded.
- [x] 2. A-14 Preview toggle at 375×667 and its absence at 1280×800. Fails: no button.
- [x] 3. A-14 layouts: one column at 375; side by side and sticky at 768 and 1280; at 780×270 the preview panel's
  bottom is within the viewport. Fails at 780×270: the 16:10 preview is taller than the room left.
- [x] 4. A-14 sizes: every button and link in `.playground` ≥ 44×44 at the four sizes, Play 48 high; a Fullscreen
  button exists. Fails: no Fullscreen.
- [x] 5. Fullscreen: pressing it makes `.preview-panel` the fullscreen element (Chromium); a refused request shows the
  message. Fails: no button.
- [x] 6. A-16 soak. Expected to pass (the orchestrator's two-frame rule is unit-tested): kept as the acceptance test.
- [x] 7. A-15 axe with the editor open at 375 and 1280.
- [x] 8. Minimal code for 2 to 5; all of 1 to 7 pass on Chromium and WebKit.
- [x] 9. Measurements: the §10.2 latency rows in Chromium with 4× CPU (CDP `Emulation.setCPUThrottlingRate`) in this
  container, labelled as indicative (the budget's machine is `af-mac`); `pnpm lighthouse`. Owner screenshots of the four
  layouts and the toggle.

## Commands and expected results

- `pnpm exec vite build && pnpm exec playwright test tests/e2e/playground-layout.e2e.ts tests/e2e/playground.e2e.ts`:
  all pass on both projects.
- `pnpm exec playwright test tests/e2e/site.e2e.ts`: all pass (the new controls go through the overflow, axe, keyboard
  and dead-button gates).

## Gates

`pnpm check` (0 errors), `pnpm test`, `pnpm build`, `pnpm check:site`, the two playground specs and `site.e2e.ts` on
Chromium and WebKit, then the full e2e once. `pnpm lighthouse` if it runs in this container.

## Owner gates

- A-18: the Owner accepts the page at phone and desktop sizes from the screenshots, and on their own phone sees a typed
  change appear with no button.
- The §10.2 latency table on `af-mac` (this container's numbers are indicative only).

## Decisions for the Owner's veto

- Fullscreen's refusal text: "Fullscreen is unavailable in this browser." (DemoRunner said "… Open the demo in a new
  tab.", which has no counterpart for an example page).

## Execution log

- 2026-10-31: plan written by the website lane (session_01QYLU1fQBPTit3AUJBJS4gT). Worktree `/home/user/wt/play11`,
  branch `claude/website-WEB.PLAY.11-responsive` from WEB.PLAY.10's head `fa39095`.
- Steps 1 to 7 first run (Chromium): the height-only test and "no Preview toggle when side by side" passed from the
  start, as guards (the preview's size already followed its width; there was no toggle to show). The toggle test
  failed: no button. The four layout tests failed: no Fullscreen button. At 780×270 the panel was 254.5 px tall with
  196 px of room. Both Fullscreen tests failed: no button. Axe with the editor open passed at 375 and 1280.
- The soak failed twice, both times on the 30 s test timeout (fifty edits at the quiet period's pace take about 12 s
  before the last run settles), not on frames. It now has a 90 s timeout and says what it saw while it waits: 3/3 on
  Chromium and WebKit.
- Step 8: the toggle in `CodePanel` (hidden by the container query at 700 px), `previewShown` and a `ResizeObserver`
  for one column in `Playground` (a toggled-off preview is shown and takes input again once the playground widens),
  Fullscreen with its message in `PreviewPanel`, and the short-height cap
  (`@media (max-height: 499.98px)` around `@container playground (min-width: 700px)`).
- Gates after step 8: `pnpm check` 0 errors; `pnpm test` 435 passed + 1 expected fail; `pnpm build` done;
  `pnpm check:site` 45 pages; `playground.e2e.ts`, `site.e2e.ts` and `playground-layout.e2e.ts` 767 passed on
  Chromium and WebKit (29.0 min).
- Step 9: twelve screenshots (Chromium and WebKit) in `docs/evidence/owner-visual/2026-10-31-web-play-11-layouts/`.
  In this container the latency rows are about three times their budgets (keystroke to `running`: 1,599 ms unthrottled,
  3,558 ms at 4×; tap to editor 1,039 ms at 4×). They are recorded in
  `docs/evidence/2026-10-31-web-play-11-measurements.md` as indicative, and the `af-mac` run is still owed. Lighthouse
  passed every assertion (`/examples/shapes-rects`: 0.99, LCP 1,356 ms, CLS 0, TBT 134 ms).
