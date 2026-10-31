# WEB.PLAY.10: the determinism row (TDD plan)

> **Spec:** [live playground design](../specs/2026-10-30-live-playground-design.md) §13 (determinism stays visible),
> F6, §5.1 (`run.determinism`, `determinism`, `determinism-unavailable`), §7.1 (determinism states), §8.1
> (`DeterminismRow`), A-10, §17 WEB.PLAY.10 row.
> **Stacked on:** WEB.PLAY.9 (website#25, `claude/website-WEB.PLAY.9-share`, head `cb25120`). `framework.ref` `f8023a9`.
> The framework's frame already answers the request (`tooling/examples-runner/src/playground/frame.ts`, `determinism`).
> **Lane:** website. Plans and specs are auto-accepted (Owner, 2026-10-30).

## Goal

- When the example has a `Golden:` header (`example.golden` in the catalog), every `run` carries
  `determinism: { ticks }`. It also carries `replay` (the catalog's `/playground/goldens/<id>.replay`) when the code
  is the unedited original: the precompiled original, or a compile of the editor while it equals the original (after
  Reset, or a share link of the original). An example with no golden gets no request and shows no row.
- A row under the preview, below the status line, says only what this browser checked (§13):
  - pass: "Determinism: these 120 ticks replay in this browser to the golden recorded in the framework
    (`examples/__goldens__/shapes-rects.replay`, framework `f8023a9`). Hash `<hash>`."
  - diverged, as an alert: "Determinism: this browser diverged from the golden at tick N."
  - edited: "Your edit: 120 ticks hash to `<hash>` in this browser. The golden belongs to the original code; agreement
    across engines is checked in the framework's CI."
  - The short ref comes from the frame's `booted.framework` (the build's commit), and the hash from the frame's
    `determinism` message. No hash or ref is written into `src/`.
- A request whose frame is replaced or dropped never reaches the row (the message's `runId` must be the frame on show).

## Interfaces

- `src/lib/playground/determinism.ts` (new): `type DeterminismView = { kind: 'checking'; ticks } | { kind: 'pass';
  ticks; hash; framework } | { kind: 'diverged'; tick } | { kind: 'edited'; ticks; hash }`;
  `determinismText(view, exampleId): string`.
- `OrchestratorView.determinism?: DeterminismView` (absent: no row). `orchestrator.run(code, determinism?)`, where
  `determinism` is `RunMessage['determinism']`; `restart()` reuses the last request.
- `src/lib/playground/DeterminismRow.svelte` (new): props `view`, `exampleId`; `role="alert"` only when diverged.

## Files

- `src/lib/playground/determinism.ts`, `src/lib/playground/DeterminismRow.svelte` (new).
- `src/lib/playground/orchestrator.ts`, `src/lib/playground/Playground.svelte`.
- `tests/playground/determinism.test.ts` (new), `tests/playground/orchestrator.test.ts`, `tests/e2e/playground.e2e.ts`.

## Steps (each test fails first, for the reason given)

- [x] 1. e2e A-10 (three tests): unedited `shapes-rects` shows the pass text with a 16-hex hash and the frame's short
  ref, and the hash is in no file under `src/`; an edit shows "Your edit: 120 ticks hash to …"; `core-basic-window`
  reaches `running` with no row. Fails: no row exists.
- [x] 2. `determinism.test.ts`: the four texts, exactly. Fails: no module.
- [x] 3. `orchestrator.test.ts`: `run(code, request)` posts `determinism` in `run` (and none without one); `running`
  shows `checking`; `golden: 'pass'` shows pass with the booted framework; `'none'` shows edited; `'diverged'` shows
  the tick; `determinism-unavailable` removes the row; a message from a replaced frame's `runId` is dropped; `restart`
  sends the same request. Fails: `run` posts no `determinism`.
- [x] 4. Minimal code: `determinism.ts`, the orchestrator, `DeterminismRow.svelte`, and `Playground.svelte` passing
  the request (`edited ? { ticks } : { ticks, replay }`). Steps 1 to 3 pass.

## Commands and expected results

- `pnpm exec vitest run tests/playground`: all pass.
- `pnpm exec vite build && pnpm exec playwright test tests/e2e/playground.e2e.ts --project=chromium` (then
  `--project=webkit`): all pass. `git checkout -- src/data/first-change-proof.json` after a full `pnpm build`.

## Gates

`pnpm check` (0 errors), `pnpm test`, `pnpm build`, `pnpm check:site`, the playground spec on Chromium and WebKit, then
the full e2e once.

## Decisions for the Owner's veto

- While the check runs the row says "Determinism: checking 120 ticks in this browser…" rather than nothing, so the
  row's arrival does not move the page twice. §13 gives no text for it.
- `determinism-unavailable` (the golden could not be fetched or read) shows no row: a check that did not run makes no
  claim. §13 gives no text for it.

## Execution log

- 2026-10-31: plan written by the website lane (session_01QYLU1fQBPTit3AUJBJS4gT). Worktree `/home/user/wt/play10`,
  branch `claude/website-WEB.PLAY.10-determinism` from WEB.PLAY.9's head `cb25120`.
- Step 1 failed first in Chromium: the pass and edit tests found no `.determinism-row`. The no-golden test passed from
  the start, as a guard should: it pins that no row appears.
- Step 2 failed first: no module `determinism`. Step 3 failed first: `run` posted no `determinism` and the view had
  none (5 of the 6 new tests; the unavailable case passed trivially because no row ever appeared).
- Step 4 deviation: WEB.PLAY.7's placeholder test "ignores determinism reports for now (the row is WEB.PLAY.10)" now
  reads "ignores a determinism report for a run that asked for none", with its body unchanged. The orchestrator drops a
  report for a run that sent no request, so the row never claims a check nobody asked for.
- After step 4: `vitest run tests/playground` 76/76; `pnpm check` 0 errors; `playground.e2e.ts` 72/72 on Chromium and
  WebKit.
