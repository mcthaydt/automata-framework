# WEB.PLAY.7: live updates (TDD plan)

> **Spec:** [live playground design](../specs/2026-10-30-live-playground-design.md) §5.2 (the compile step and its
> worker), §5.7 (`EDIT_QUIET_MS`, `ANNOUNCE_AFTER_MS`), §6 F2 (the worker starts with the editor), F3, F4 (the swap, an
> edit before the first run), F5, §7.1 (Compile state), §7.2 (the syntax and import rows), §7.4, §8.2 (the diagnostic
> in the status line), §8.3, §10.1 (the compile worker's bytes), §12 (`@codemirror/lint` 6.9.7), A-1, A-3, A-4, A-13,
> §17 WEB.PLAY.7 row.
> **Base:** `main` at `575b34e` (WEB.PLAY.6 merged); `framework.ref` `f8023a9`.
> **Lane:** website. Plans and specs are auto-accepted (Owner, 2026-10-30).

## Goal

An edit in the editor updates the preview with no button. Every change restarts a 300 ms quiet timer (changes during
IME composition start it only when composition ends); when it fires, the source goes to the compile worker with the
next `seq`, and an answer with an older `seq` is dropped. A successful compile runs through the orchestrator's existing
double-buffered `run()`: a candidate frame boots under the one on show and replaces it only on `running`, so at most
two frames exist. A syntax or import error marks its line in the editor (`@codemirror/lint`: a gutter marker and an
underline), the status line says "Line N: <message>. The preview is still running your last working version." as a
44 px button that puts the caret on that line, nothing happens to the frames, and if it still stands after 1,000 ms a
polite live region announces it once. The next good compile clears it. An edit that compiles before the arrival run
reaches `running` replaces that run, and a precompiled original still downloading is not run after it. Under reduced
motion an edit runs nothing until the reader has pressed Play on this visit; Play then runs the current code.

Out of this task: runtime-error lines, the hang message, the worker-failure and offline texts with Retry (.8); Reset
and the share link (.9); the determinism row (.10); the layout pass and the latency table (.11).

## Interfaces

- Consumed: `compileExample(source, { id, moduleUrl })` and `Diagnostic` (`compile.ts`, WEB.PLAY.4);
  `createOrchestrator(...).run(code)` (`orchestrator.ts`, WEB.PLAY.5); `mountEditor` (`editor.ts`, WEB.PLAY.6);
  `Example.moduleUrl` (a site path, `/playground/examples/<module>/<module>-<name>.ts`).
- Produced:
  - `src/lib/playground/live.ts`: `EDIT_QUIET_MS = 300`, `ANNOUNCE_AFTER_MS = 1_000`,
    `createLiveCompile({ clock, worker, onResult })` with `edit(source)`, `now(source)`, `receive({ seq, result })`,
    `dispose()`; `CompileWorker = { post(job: { seq, source }): void; terminate(): void }`;
    `diagnosticText(diagnostic, kept)`.
  - `src/lib/playground/compile.worker.ts`: answers `{ seq, result }` to `{ seq, source, example }`.
  - `mountEditor` gains `onchange(doc: string)`; `editor.ts` exports `showDiagnostics(view, diagnostics)` and
    `moveCaret(view, line, column)`.
  - `CodePanel` gains `onedit` and `diagnostics` props and an exported `focusAt(line, column)`.
  - The playground root gains `data-compile`: `original`, `compiling`, `ok`, `syntax-error` (§7.1's Compile state, a
    readiness signal for the tests).
  - `checkCompileWorker` in `scripts/site-checks.ts`: the worker file at most 125,000 B gzip (§10.1), never named by a
    page.

## Files

| File | Create / modify | Responsibility |
| --- | --- | --- |
| `package.json`, `pnpm-lock.yaml` | modify | `@codemirror/lint` 6.9.7, exact |
| `src/lib/playground/live.ts` | create | quiet period, `seq`, latest-wins, the diagnostic's text |
| `src/lib/playground/compile.worker.ts` | create | the worker around `compileExample` |
| `src/lib/playground/editor.ts` | modify | the change listener (IME-aware), the lint gutter, diagnostics, caret moves |
| `src/lib/playground/CodePanel.svelte` | modify | `onedit`, `diagnostics`, `focusAt` |
| `src/lib/playground/Playground.svelte` | modify | the worker's start, compiled runs, diagnostics in the status line, the announcement, the reduced-motion rule, the original-fetch race |
| `scripts/site-checks.ts`, `scripts/check-site.ts` | modify | `checkCompileWorker` |
| `tests/playground/live.test.ts` | create | unit, fake clock and fake worker |
| `tests/site-checks.test.ts` | modify | the worker cases |
| `tests/e2e/playground.e2e.ts` | modify | A-1, A-3, A-4, A-13 and the race, in Chromium and WebKit |

## Steps (each test fails first, for the reason given)

- [x] 1. **First failing test** (e2e, Chromium): A-1's journey, "an edit updates the preview with no button". Open
  `/examples/shapes-rects`, wait for `running`, put the caret in `0x00cdf9` on the `Block` view's line, replace it with
  `0xff0000`; the root reaches `data-run-id="2"` with one frame, the status line says "Preview updated.", and a
  screenshot of the frame has more than 100 red pixels (decoded in the page's own canvas, so no image dependency).
  Fails: `data-run-id` stays `1` (an edit changes nothing).
- [x] 2. Unit `live.test.ts`: an edit posts nothing before 300 ms and posts once at 300 ms; a second edit at 200 ms
  restarts the timer and only the latest source is posted; `now()` posts at once and cancels the timer; an answer whose
  `seq` is not the latest is dropped; `dispose()` cancels the timer and terminates the worker, and later answers are
  dropped; `diagnosticText` gives "Line 21: Unexpected token. The preview is still running your last working
  version." (and without the second sentence when nothing runs). Fails: no module. Then `live.ts`.
- [x] 3. `compile.worker.ts`, `editor.ts`'s `onchange`, `CodePanel`'s `onedit`, and `Playground`: the worker starts
  when the editor starts loading; a result runs through `orchestrator.run`. Step 1 passes in Chromium and WebKit.
- [x] 4. e2e A-3: inserting `const broken = 1 +;` inside the `move` system marks that line (`.cm-lint-marker-error`
  in its gutter row, `.cm-lintRange-error` in the line), the status line names "Line N: Unexpected token" within the
  test's 2 s wait, `data-run-id` and the frame element are unchanged; deleting it runs the fix (`data-run-id` 2).
  Fails: no marker. Then `@codemirror/lint` (dependency, `lintGutter`, `showDiagnostics`) and the diagnostics path.
- [x] 5. e2e A-4: `import _ from 'lodash'` marks line 1's import with "The playground can import only
  @mcthaydt/automata and zod.", no request for anything named `lodash`, the preview keeps running.
- [x] 6. e2e: "pressing the diagnostic puts the caret on its line": the status line's button is at least 44 px high;
  pressing it focuses `.cm-content` with the caret on the marked line. Fails: no button. Then the button and
  `focusAt`.
- [ ] 7. e2e: "an edit before the first run replaces it": hold `/playground/compiled/shapes-rects.js` (route, released
  after the edit compiles), edit the colour; the edited code runs (red pixels) and, once the held original is
  released, it is not run (`data-run-id` stays 1, one frame). Fails: the original runs after the edit. Then the
  race guard in `Playground`.
- [ ] 8. e2e A-13 (`reducedMotion: 'reduce'`): an edit compiles (`data-compile="ok"`) but requests nothing under
  `/playground/` and the poster stays; after Play the current (edited) code runs, and the next edit updates it live.
  Fails as the gate stands or passes; either way it pins the rule.
- [ ] 9. e2e: "the compile worker starts with the editor, not before": no worker script request before a tap or
  focus on the code; one after. And the polite announcement: a diagnostic still standing after 1 s is in the live
  region once.
- [ ] 10. Unit `site-checks.test.ts`: a worker over 125,000 B gzip fails; a page naming the worker file fails; a
  build without the worker fails. Fails: no `checkCompileWorker`. Then the check, wired into `check-site.ts`.
- [ ] 11. Gates.

## Commands and expected results

- `pnpm exec vitest run tests/playground tests/site-checks.test.ts`: all pass.
- `pnpm build && pnpm exec playwright test tests/e2e/playground.e2e.ts --project=chromium` (then `--project=webkit`):
  all pass. `git checkout -- src/data/first-change-proof.json` after a build.
- `pnpm check:site`: 0 failures; it reports the editor chunk's and the compile worker's gzip sizes.

## Gates

`pnpm check` (0 errors), `pnpm test`, `pnpm build`, `pnpm check:site`, the playground spec on Chromium and WebKit, then
the full e2e once; Lighthouse on the two example pages is unchanged in principle (nothing new loads before a tap), run
once.

## Execution log

- 2026-10-30: plan written by the website lane (session_01QYLU1iBXhs9QdohCWXcLfV), replacing the old lane. Worktree
  `/home/user/wt/web-play-7`, branch `claude/website-WEB.PLAY.7-live-updates` from `575b34e`. AF reference worktree
  `/home/user/wt/automata-framework` at `f8023a9`.
- Steps 1–3: A-1's journey failed first with `data-run-id` staying `1`. The red-pixel count decodes the frame's
  screenshot in a blank page of the same context, because the site's CSP refuses a `data:` fetch. `diagnosticText`
  lives in `status.ts`, not `live.ts`: the status line is in the page's entry, and `live.ts` brings Zod, which loads
  only with the editor. The worker's jobs carry the example (`{ seq, source, example }`), since Vite's
  `new Worker(new URL(...))` pattern takes no query. Chromium and WebKit pass.
- Steps 4–6: A-3, A-4 and the diagnostic button failed first with no marker and no button. `@codemirror/lint` 6.9.7
  (exact). The lint gutter sits before the line numbers and takes the gutters' 1rem left padding, so the numbers stay
  where the static code has them and the box test still passes. An underline at the very end of a line covers its last
  character. The tests place the caret by a character's box, not with End (End stops at a wrapped line's first row),
  and retry the click until the caret is on the line: WebKit was still settling the page's scroll after the swap, so a
  click measured a moment earlier landed two to five lines lower (3 of 6 runs before, 6 of 6 after). Chromium and
  WebKit pass, the WEB.PLAY.6 tests included.
