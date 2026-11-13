# The editor's journeys, green again (2026-11-12, branch `claude/editor-journeys-green`)

Audit notes for the coordinator. The tracker rows below are the ones this branch would have added to
`docs/refactor/progress.md`; the coordinator gathers them.

## For the tracker


### The editor's journeys green again (2026-11-12, branch `claude/editor-journeys-green`)

CI's "The editor's journeys" step had not finished since 2026-11-06: each journey that needed Play waited out its 180 s limit.
Chromium on SwiftShader only (no GPU; WebKit would not install here: `playwright install webkit` fails on the host
requirements). Machine: 4 cores; the suite ran with `--workers=2`, as CI does. Failing journeys before, per project, are in
the "before" row.

| Step | Status | Record |
|---|---|---|
| A. Reproduced (editor-3d built first) | Before: iPad 8 failed, 12 passed, 4.0 m (4 workers); phone 8 failed, 2 skipped, 10 passed, 6.3 m. Failed: animation-plays-in-game, controls-change-the-game, paint-shows-in-game, whole-game-loop (each `locator.click: Test timeout of 180000ms exceeded` waiting for the Play link); new-game-opens (`the game's dev server exited with 1`); dark-levels-3d (`studio-stage` not visible); levels-3d-edit-reaches-the-game (night 0.283, needed < 0.191); new-3d-game-plays-its-edits (night 0.191, needed < 0.161) | logs kept in the session scratchpad |
| B. Harness links what `create-game` writes | Done, test first: `link-game-packages.ts` reads the generated game's package.json, workspace packages from the workspace, the rest from the installed game; a missing `dependencies` entry is an error naming it | `packages/editor/tests/unit/e2e-harness/harness.test.ts` |
| Two more causes behind the first | (1) `automata editor` starts the game's Vite alone, so a fresh game's `src/main.ts` was a 500 (`content/generated/fonts/fonts.css` is only written by `pnpm fonts`, the first step of `pnpm dev`): the editor now runs the game's own `fonts` script first (shared, not copied; the harness no longer calls it). (2) A new game opens on a Language dialog before the title, so three journeys waited for a Play button behind it: `press-play.ts` | `packages/tools/tests/unit/editor/game-runner.test.ts`; `.changeset/editor-prepares-the-game.md` |
| C. Fail fast | Done: `runEditorWithPlay` fails at once with the editor's "Play is off" line; `runGame` keeps the dev server's output and puts it in its error | unit tests in `harness.test.ts` |
| D. "Play is off" message | Done, test first: one-line cause and "Fix that in the game, then start the editor again." (the editor starts the game once, so a save does not bring Play back); not a translated string | `.changeset/editor-play-off-cause.md` |
| Phone layout | `animation-plays-in-game` opened the Characters list as if on a wide screen; on a phone it sits behind Panel, like the layers do in `paintWall` | journey |
| `dark-levels-3d` | Failed in three full runs, passed in three partial runs: the first `studio-stage` wait had the default 5 s while the next line has 30 s. Aligned to 30 s; passed in the next full run | journey |
| E. Night not darker than day (levels-3d-edit-reaches-the-game, new-3d-game-plays-its-edits) | NOT fixed, not software-GL only. Same renderer, bisected over main with a standalone probe (day / night mean luminance of base-3d's canvas): 98129556, 208d2082f, b4caf3a1e (#582), c749d77e3 (#584) day 0.302, night 0.204 (passes); ff50419db (#583, the gameplay camera) 0.118 / 0.107 (ratio 0.91, fails); 395565365 (#585, haze and sky) onward 0.237 / 0.280 (night brighter than day). The 3D package's own `time-of-day.parity` test passes on this renderer. The captured night frame is a flat green dither with no walls or crate. Left alone: the assertion. Needs the 3D owner: the game's look changed in #583 and #585. To prove or clear the renderer on a GPU: run the journey `levels-3d-edit-reaches-the-game` on the GPU runner and read the day and night frames there (software GL: a flat green dither, no walls or crate) | bisect probe in the session scratchpad |
| G. CI printed nothing for 13 minutes | Turbo groups a task's output on GitHub Actions. Root `test:e2e` now passes `--log-order stream`; Playwright's `list` reporter was already on | `package.json` |
| `@automata/editor-3d` build | `@automata/editor#test:e2e` did not depend on it, so the 3D journeys failed with "no editor build at packages/editor-3d/dist/suite" on a clean checkout | `turbo.json` |
| H. `pnpm --filter @automata/site check:launch` | Done, test first: `home-content.ts` imported `agent-prompt` without `.ts`; a Node-load test now fails on that. It now stops honestly: `@automata/tools` is not on npmjs.org, the repository is private, the domain has no mail record. Lint: `correctness/useImportExtensions` exists (off in the preset) but a per-folder override does not switch it on and 103 site imports would be flagged, so it is not enabled | `site/tests/unit/scripts/check-launch-loads.test.ts` |
| Final Chromium runs (2 workers) | iPad: 18 passed, 2 failed (the two night journeys), 6.3 m. Phone: before the phone-layout fix 15 passed, 3 failed, 2 skipped, 6.1 m (animation-plays-in-game, plus the two night journeys); animation-plays-in-game then passed alone on phone, 44 s | session logs |
| Not run | WebKit (not installable here), Firefox, a GPU; the website and stranger's-journey steps (see the hand-off note); `pnpm check` uncached | |

## Final Chromium results (2 workers, 4 cores, SwiftShader)

| Project | Result | Time |
|---|---|---|
| editor-ipad-chromium | 18 passed, 2 failed (the two night journeys, 9b) | 6 m 22 s |
| editor-phone-chromium | 15 passed, 3 failed, 2 skipped before the phone-layout fix (animation-plays-in-game, plus the two night journeys); animation-plays-in-game then passed alone on phone (44 s) | 6 m 6 s |
| Before the fixes (editor-3d built, 4 workers) | iPad 8 failed, 12 passed; phone 8 failed, 2 skipped, 10 passed | 4 m 0 s; 6 m 18 s |

Known red (9b): `levels-3d-edit-reaches-the-game` and `new-3d-game-plays-its-edits`. Bisect numbers (mean luminance of the
base-3d canvas, same renderer, standalone probe): c749d77e3 day 0.302 / night 0.204; ff50419db (#583) 0.118 / 0.107;
395565365 (#585) 0.237 / 0.280; current main 0.237 / 0.280. The assertions are untouched.

## The website and the stranger's journey (run as `.github/workflows/ci.yml` runs them)

| Step | Result | Time |
|---|---|---|
| `pnpm test:e2e --filter @automata/site` | 511 passed, 507 failed. 506 are WebKit tests that fail in 1 to 3 ms because WebKit cannot start here (`Host system is missing dependencies to run browsers`: libgtk-4, libgraphene, libevent, libgstgl, libavif, libwayland-server, libmanette, libenchant); `playwright install webkit` fails the same host check. 2 are Chromium: `desktop 1280×800 › /: every visible button does something` (`button "Stop" changed nothing`, on the Home page's demo, run with 2 workers and 1018 tests) and `editor-try › the try-it editor on a phone › nothing reaches past the screen's edge` (977 ms; its cause was not read). Neither was investigated. | 18 m 37 s |
| `pnpm test:e2e --filter @automata/consumer-smoke` | 1 passed (a stranger makes a 2D game from the packed packages, checks, plays and zips it, 59 s); the 3D stranger journey was skipped by the suite | 1 m 02 s |
| Editor journeys in WebKit | Not run (WebKit not installable here) | |
