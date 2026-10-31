# WEB.PLAY.8: failure and recovery (TDD plan)

> **Spec:** [live playground design](../specs/2026-10-30-live-playground-design.md) §7.2 (every row WEB.PLAY.7 did not
> cover), §7.3 (the loop guard's message), §8.2 (Retry), §8.3 (the texts), A-5, A-6, A-7, §17 WEB.PLAY.8 row.
> **Stacked on:** WEB.PLAY.7 (website#23, `claude/website-WEB.PLAY.7-live-updates`, head `ccbaf32`); `framework.ref`
> `f8023a9`.
> **Lane:** website. Plans and specs are auto-accepted (Owner, 2026-10-30).

## Goal

Each failure in §7.2 shows its own text, keeps what the spec says it keeps, and recovers as the spec says:

| Row | Already (WEB.PLAY.5–.7) | This task |
| --- | --- | --- |
| Import fails, or the default export is not `defineGame(...)` | orchestrator keeps the running preview, names the line | e2e |
| Throws before its first frame (`boot`) | the same | e2e (A-5's first half); the editor marks the line |
| Throws while running (`run`) | "Stopped: line N: …" over the stopped preview | e2e (A-5's second half); the editor marks the line; the next good edit runs |
| A loop that never ends | the frame's loop guard posts `failed` with `hung: true` | the spec's text, "Line N: this loop ran for over a second without a break, so the preview stopped it." (the frame says "over 1 s"); e2e A-6 |
| Never reaches `running` | both timeouts, unit-tested | e2e A-7 (10 s, a later frame) |
| The worker fails to start or crashes | — | its `error` event: "Live updates are unavailable in this browser. Play still runs the original."; edits stop compiling |
| The runtime fails to download (offline) | first frame times out with "press Play to try again" and Play | the spec's text, "The preview couldn't load. Check the connection and press Retry.", and a 44 px Retry that starts a fresh first frame, keeping the editor and the edit (it runs the current code) |

## Interfaces

- Consumed: `OrchestratorView` (`stopped`, `status`, `preview`, `frames`), `failed` messages (`phase`, `line`, `column`,
  `hung`), `CodePanel`'s `diagnostics`, `live.ts`.
- Produced:
  - `OrchestratorView.failure?: { line: number; column: number; message: string }`: the line of the last frame
    failure that had one, cleared by the next `running`. `Playground` marks it in the editor like a diagnostic.
  - `STATUS.liveUnavailable`, `STATUS.offline` (replacing `firstBootTimeout`), `STATUS.hung(line?)`.
  - `PreviewPanel` gains `showRetry` and `onretry`.

## Files

| File | Create / modify | Responsibility |
| --- | --- | --- |
| `src/lib/playground/orchestrator.ts` | modify | `failure`; the hang text |
| `src/lib/playground/status.ts` | modify | the texts |
| `src/lib/playground/Playground.svelte` | modify | worker `error`; Retry; frame failures marked in the editor |
| `src/lib/playground/PreviewPanel.svelte` | modify | Retry |
| `tests/playground/orchestrator.test.ts` | modify | `failure`, the hang text |
| `tests/e2e/playground.e2e.ts` | modify | one journey per row |

## Steps (each test fails first, for the reason given)

- [ ] 1. **First failing test** (e2e, Chromium): A-6, "a loop that never ends is stopped, named, and the next good
  edit runs": add `while (true) {}` inside the `move` system; within the test's 3 s wait the status line says
  "Line N: this loop ran for over a second without a break, so the preview stopped it." (N the `while` line), the
  editor still takes typing, deleting the loop runs (`data-run-id` 2). Fails: the status line has the frame's
  "over 1 s" text.
- [ ] 2. Unit `orchestrator.test.ts`: a `hung` failure gives the spec's text; `failure` carries the line of a
  candidate's or a running frame's failure and is cleared by the next `running`. Fails: no `failure`, the frame's text.
  Then the orchestrator; step 1 passes.
- [ ] 3. e2e A-5: `throw new Error('x')` as `setup`'s first statement shows "Line N: x. The preview is still running
  your last working version." and marks line N; the preview keeps running (`data-run-id` 1). A throw on tick 60 (a
  counter in `move`) shows "Stopped: line N: x." over the preview and marks line N; the next good edit runs. Fails: no
  marker. Then `Playground` passes `failure` to the editor alongside the compile's diagnostics.
- [ ] 4. e2e: "a default export that is not defineGame(...) is named": `export default 1` in place of the
  `defineGame` call; "The example's default export must be defineGame(...)"; the preview keeps running.
- [ ] 5. e2e A-7: route the frame page to one that never posts `booted` for the second frame only (count the
  requests); an edit leaves the running preview, and after 10 s the candidate is removed with "The preview did not
  start within 10 seconds." Fails or passes as the timer stands; it pins the row in a browser.
- [ ] 6. e2e: "when the compile worker fails, the status line says so and Play still runs the original": route the
  worker script to a 500; after the first edit, "Live updates are unavailable in this browser. Play still runs the
  original."; the preview keeps running. Fails: nothing handles the worker's `error`.
- [ ] 7. e2e: "offline, the first frame times out and Retry starts a fresh one": route `/playground/runtime/**` to
  abort until released; after 20 s, "The preview couldn't load. Check the connection and press Retry." and a Retry
  button of at least 44 px; release, press Retry, the preview runs. Fails: the text and the control are Play's.
- [ ] 8. Gates.

## Commands and expected results

- `pnpm exec vitest run tests/playground`: all pass.
- `pnpm build && pnpm exec playwright test tests/e2e/playground.e2e.ts --project=chromium` (then `--project=webkit`):
  all pass. `git checkout -- src/data/first-change-proof.json` after a build.

## Gates

`pnpm check` (0 errors), `pnpm test`, `pnpm build`, `pnpm check:site`, the playground spec on Chromium and WebKit, then
the full e2e once.

## Execution log

- 2026-10-31: plan written by the website lane (session_01QYLU1iBXhs9QdohCWXcLfV). Worktree `/home/user/wt/web-play-8`,
  branch `claude/website-WEB.PLAY.8-failures` from WEB.PLAY.7's head `ccbaf32` (website#23, not yet merged; merge
  `main` in once it is).
