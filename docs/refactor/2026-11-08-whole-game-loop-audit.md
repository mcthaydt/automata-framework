# Whole game loop: build audit

Audit of AF PR #480 (branch `claude/project-thread-6rfl3t`, head `62c383f2`, stacked on #473): `automata editor` opens
the editors page, starts the game beside it, and serves Play and Publish. Checked against the 2D editors audit's
findings E1 to E6 (`2026-11-06-2d-editors-and-site-audit.md`, section 3) and the code. Nothing was taken on trust: each
finding below says what was run or read.

## What was done by hand

In a cloud container (Node 24.21.0, Chromium 1243; WebKit and Firefox are not installed there):

1. `pnpm install --frozen-lockfile`, `pnpm build`. `packages/tools/dist/editors/{2d,suite}` hold the editors, and the
   suite build carries no `@pixi/3d`.
2. `automata create-game my-game` in `/tmp/hand`, outside the repository. It writes `content/editors.toml`,
   `content/levels/start.af2d.json` and the exported `start.toml`, `project.toml`, `world.toml`. The game's packages
   were linked from Emberwick's `node_modules`, as the journey's `newGame` does (the packages are not on a registry
   yet, so a stranger's `pnpm install` cannot run).
3. `pnpm exec automata editor --port 5401` in the game: "Opened My game", "This computer", "Your game is running:
   http://localhost:41739/" in about 7 s.
4. At iPad landscape (1180 × 820): Home shows the game's name, "Saved in your game folder", Play and Publish. Opened
   Start, chose Collision, Brush, and dragged a wall across row 1. `content/levels/start.toml` gained
   `".*10 1*4 .*18"` on the collision layer: saved with no Save button.
5. Play opened the game in a new tab. With that tab open, the stroke above reloaded the game by itself (back to its
   title screen); past the title, the new wall is on the screen at the top.
6. Publish, Build my game: "Building your game… this can take a minute.", Escape does not close it, then "Your game is
   ready to upload." Download the zip saved `my-game-0.1.0-itch.zip` (9 files, `index.html` with `./assets/` paths).
   Unzipped under `/html/123/` as itch.io serves it and opened in Chromium: the game runs, with the new wall.
7. The same at phone size (390 × 844): Home, Play and Publish work and the zip downloads. Painting failed at first
   because the layer sheet covers the lower half of the level after a layer is chosen (the 2D editor's sheet, not this
   PR).
8. Edge cases, with the built bin from the parent folder (`automata editor my-game --lan`):
   - two Publish presses at once: the second answers 409; the first makes the zip; `/api/publish/file` hands it over
     with the token and refuses a cross-site POST (403);
   - a syntax error in `src/shared/constants.ts`: Publish answers "Your game did not build…" (see W3);
   - a game with no `node_modules`: the terminal prints "Play is off: …"; the page shows Publish but no Play (see W4);
   - SIGTERM to the editor process stops the game's Vite too; the port closes.
9. The journeys: `pnpm exec playwright test -c playwright.journeys.config.ts --project editor-ipad-chromium --project
   editor-phone-chromium whole-game-loop`: 4 passed (the loop at both sizes; the tile journey fails as expected). With
   its `test.fail` taken out, the tile journey fails at the screen check (`Expected: not "000000"`), after the save:
   it fails for the reason it names today.
10. Unit tests of the changed files: tools `tests/unit/editor` 78 passed; editor `publish-client`, `served-workspace`
    and `Suite-play-publish` 15 passed. `pnpm check` was not run in full here.

Screens: `/mnt/project-files/refactor/2026-11-08-whole-game-loop-audit-screens/`.

## E1 to E6, now

| Finding | Status on #480 | Evidence |
| --- | --- | --- |
| E1 Save does not reach the game | Fixed (on the stack) | Step 4: each stroke is written to `start.toml`; `check --only levels` passes in the journey |
| E2 The editors are in no package | Fixed (on the stack) | `tools/dist/editors/{2d,suite}`; the built bin served a game in `/tmp` |
| E3 A new game has nothing to edit; wide fallback | Fixed (on the stack) | create-game writes the editor list and a level; `editor-policy.ts` falls back to level files only |
| E4 3D by default | Fixed | `parseEditorArgs` defaults to `suite`, which opens Levels 2D |
| E5 The suite never opens its game | Fixed (on the stack) | "My game" and its Start level, not the sample |
| E6 Ship, Ask, checks, gates wired to nothing | Partly fixed | Play and Publish work on a game's own folder. Ask, the checks pill and gates are hidden, not wired; Export changes and Import changes still show on Home (15.3 cuts them). Publish runs no `automata check` step (W6) |

None of E1 to E5 is on `main` yet: they land with the stack (#409 to #473).

## Findings

Each has an ID for the fixes stage. Severity: **High** stops a person making a game; **Medium** misleads them or
exposes something; **Low** is copy, tests or polish.

### High

**W1. Tiles painted in the editor do not show in play.** Walls (the Collision layer) show; Decor and Ground tiles do
not, because the starter game and 2D core draw only collision walls. The journey `a tile painted in the editor is drawn
in the running game` proves it (it fails at the screen check). Owned by the content-in-play work (#479, #481), not
this PR; listed here because the Owner judges the loop by what shows in play. **Fix:** none on #480; remove
`test.fail` when #479's build lands (W7 makes that safe).

### Medium

**W2. Under `--lan` the game is open to the whole network without the token.** The editor needs the token for every
`/api` route (401 without it), but the game's Vite listens on `0.0.0.0` with no check. From another address,
`/src/shared/constants.ts`, `/content/levels/start.af2d.json`, `/package.json` and `/ship.config.ts` all answered 200.
It is read-only and Vite still refuses `.env` files, but the guide says "The editors write files, so they never listen
beyond this computer without a token", and a person reads that as covering what the command starts. **Fix:** say it
in the guide and in the printed line ("Your game is open to your network: …"), or start the game on `localhost` and
let the editor's server pass Play through its token check (a proxy route).

**W3. A failed Publish shows colour codes and a stack trace.** The detail is the build's last 20 lines as they are:
ANSI escapes (`\u001b[31m`, `\u001b[38;5;246m`) and nine `at …` frames from rolldown and Vite. The line that matters
(`Unexpected token … src/shared/constants.ts:9:14`) is in there but buried in noise a grandma cannot read. **Fix:**
run the steps with `NO_COLOR=1` and `FORCE_COLOR=0`, drop `    at ` lines, then take the tail. Unit-test it in
`publish-game.test.ts`.

**W4. When the game cannot start, Play just disappears.** With no packages installed, the terminal says "Play is off:
Your game's packages are not installed…", but the page shows Publish and no Play, and nothing says why. Publish then
fails with the reason, so the two buttons tell different stories. **Fix:** the ping carries the reason (`playOff`),
and the top bar shows Play disabled, or a Play that opens a short note with the sentence and what to run.

**W5. Publish is cut off at phone size in a level.** At 390 px the top bar shows "P" of Publish under the Panel and
Layers buttons (`phone-2-level.png`). The AGENTS rule: never hide an action to fit. **Fix:** give Play and Publish a
place that always fits on a phone (an overflow menu or the bottom of the level sheet), and add a layout test at phone
width that both are fully visible.

**W6. Publish checks less than the guide says.** The guide: "checks it is ready to go online: no secrets, nothing that
needs eval, and within itch.io's limits". `ship prepare --target itch` scans for secrets and `@pixi/3d` and checks
itch.io's limits; the no-eval check is only in `automata check` (`no-eval`), which Publish never runs. Nor does it run
`levels`, `inputs` or `orientation`, which `automata help` calls "Check a game before you ship it". **Fix:** either
run `automata check` (or its build-side steps: `levels`, `no-eval`) before the build and show its findings in the same
words, or change the guide to say what Publish checks.

### Low

**W7. The tile journey's `test.fail` passes for any failure.** Today it fails at the right step (checked by taking
`test.fail` out). But a later break before that step (a renamed layer, a save that never lands, a game that does not
start) also counts as the expected failure, and no one sees it. **Fix:** assert today's behaviour instead: the save
lands and the cell is still empty (`toBe(EMPTY_COLOUR)`), with a comment to flip the assertion when #479 lands. Then
it fails loudly when tiles start drawing, and when its set-up breaks.

**W8. The new game's words are from before this PR.** `create-game` ends with "Next: cd my-game && pnpm install &&
pnpm dev", not the editor. Its README says "`pnpm exec automata editor` opens it in the level editor; press Save and
the game plays the new level", and `template-level.ts`'s error says "Open the level in the editor and press Save".
There is no Save button (each step saves itself), and neither mentions Play or Publish. **Fix:** "Next: cd my-game &&
pnpm install && pnpm exec automata editor"; the README says the editors save as you draw, Play plays the game and
Publish makes the zip; add a `"editor": "automata editor"` script so the line is `pnpm editor`.

**W9. The game's name changes case.** create-game says "Created "My Game"" and the game's title screen says "My
Game"; the editor's top bar and the terminal say "My game" (`gameName` falls back to the folder in words, since
create-game writes no `automata.title`). **Fix:** create-game writes `automata.title` into `package.json`.

**W10. The command is silent while the game starts.** `editorCommand` waits for the game (up to 60 s) before it prints
anything. Here it was 7 s; on a cold Vite cache or a slow disk a person sees an empty terminal and may think it hung.
The journeys' `runEditor` gives up at 30 s, under the game's 60 s. **Fix:** print "Starting your game…" first (or
serve the editor first and start the game beside it), and make the harness wait at least as long as `startGame`.

**W11. Copy that fails the drunk grandma test.**
- The dialog is titled "Put your game online", but it makes a zip the person uploads themselves. Say "Make your game
  ready to upload" (or keep the title and say in the first line that nothing goes online until they upload the zip).
- The server's sentences start lower case and read as code: "your game is already being published", "nothing
  published yet: press Publish first". These reach the dialog as the problem line. Start them with a capital and say
  what to do ("Your game is already being built. Wait for it to finish.").

**W12. The guide's terminal steps are not the ones Publish runs.** It says "The same steps from a terminal are
`automata build` and `automata ship prepare --target itch`". Publish runs `vite build --mode itch`; `automata build`
builds in the default mode, so a game with itch-only settings builds differently. **Fix:** say `pnpm build:itch &&
pnpm prepare:itch`, as the game's README does.

### Noted, not findings

- Every saved stroke reloads the open game tab to its title screen (Vite reloads the page when the compiled content
  changes). The change does show; a person who is mid-play loses their place. Worth a line in the guide.
- Phone size hides the game's name and the "Saved" note, and the layer sheet covers the level after a layer is chosen.
  Both are the 2D editor's, before this PR.
- Export changes and Import changes still sit on Home for a served game next to Publish. 15.3 cuts them.
- Download on an iPad: the zip is a blob saved by a clicked link after an `await`. Not checked in Safari (WebKit is not
  in cloud sessions); run `whole-game-loop` on the `editor-ipad-webkit` project on the Mac.
- Publish does not wait for a save still on its way. Each stroke saves within a moment, so a Publish pressed right
  after a stroke may build the file before it. Plausible, not reproduced.
- A SIGKILL of the editor leaves the game's Vite running (SIGINT and SIGTERM stop it). Ctrl+C reaches both anyway.

## For the fixes stage

Fix W2 to W12 on a branch stacked on #480 (W1 waits for #479). Write each test first: W3 and W10 in
`packages/tools/tests/unit/editor/`, W4 and W11 in `Suite-play-publish.test.ts` and the publish dialog, W5 as a layout
test at phone width, W6 in `publish-game.test.ts`, W8 and W9 in the create-game tests, W7 in the journey. Then run
`whole-game-loop` at iPad and phone size and do the loop by hand again: create-game, editor, paint, Play, Publish,
open the zip.

## Fixes (2026-11-08, session 8ps35v)

W2 to W12 are fixed on a branch stacked on this PR; W1 waits for #479. See `docs/refactor/progress.md`, "Whole game
loop fixes", for what each fix is and what was run. Two things the audit did not list, found while fixing: a failed `levels`
check said "press Save" although the editor has no Save button, and the Start page test on the site pinned the old
create-game line.
