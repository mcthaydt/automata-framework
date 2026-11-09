# Editors v2: build audit

Stage 5 of the editors v2 redesign. Audited: PR #559 at `68cdd642` (first `f0d9f93a`), against the
[spec](2026-11-08-editors-v2-spec.md) and [plan](2026-11-08-editors-v2-plan.md), on 2026-11-09, Chromium only. Pictures:
`refactor/2026-11-09-editors-v2-build-audit/` in the project's shared folder (`<size>-<editor>.png` at `f0d9f93a`,
`68cdd642-<size>-<look>-<editor>.png` at the new head).

## The answer first

- **The failing journey was the test, not the game.** In `audio-plays-in-game` the player does move after the keeper
  talks and the guard does chase (the game's debug probe: the guard turns `patrol` → `hunt` at tick 255 and reaches the
  player). The music stayed calm because the game was opened on the music rules' **old order** (calm first, which always
  holds). The journey's last two waits held before the "Move up" was saved: the file already said `chase`, and the game
  already served `"mode": "chase"`. A page that loads in that moment never hears of the change. Measured: 4 of 6 runs
  failed before the fix, every failing run served the old order, and 16 of 16 pass after it. The merged story code is not
  at fault.
- **Made, played, reloaded, reopened.** A new 2D game, made in the editors at a phone and an iPad size: a new keeper line
  in Writer, a key in the Tuner and the Light look on Home. All three survive a reload, a closed tab, and a stopped and
  restarted editor in a fresh browser, and the played keeper says the new line. This is now the journey
  `work-survives-reopening` (passes on both sizes). The complete-game journeys (every editor, 2D and 3D, played and
  published) pass on both sizes: 22 of 22, the 3D Publish `test.fail` as stated.
- **What needs fixing before #559 merges:** the header on the iPad (F1) and the phone (F2), and the white strip over the
  phone's level (F3). The rest can follow.

## Fixed in this PR

| # | What | Fix |
| --- | --- | --- |
| J1 | `audio-plays-in-game` opened the game before the rules' new order was served (above). | Waits for the served order itself. |
| J2 | `feel-shows-in-game` (the default shake) had the same race: it waited for the feel's event, which is saved before its shake. Failed on both sizes in one full run. | Waits for the served entry with its shake. 16 of 16. |
| J3 | `sequence-shows-in-game` waited for `keeper.farewell`, which the keeper's conversation names already, so the wait held at once. | Waits for the step's own `"line": "keeper.farewell"`. |
| J4 | `pressInList` could wait out the whole test: a sheet on its way out still shows its rows, then drops them, and `evaluate` on a row that has gone waits for it forever (2 of 12 phone runs). | A row that has gone is "not reachable". Shared by every suite's journeys. |
| P1 | No journey reloaded or reopened the editors (the Owner's rule since 2026-11-08). | `work-survives-reopening`. |

## Findings

### High

- **F1. The iPad's header has no breadcrumb and cuts the level's name** (spec §7.4, plan Task 6 ruling 1 and Task 11).
  `SuiteHeader` takes `header: EditorHeader`, but no editor supplies one, so "Levels / Start ▾" never shows. Levels' own
  tools sit in the header instead: at 820 × 1180 they read "LevelsLevel  Tiles  Sta", with no gap after the editor's
  name and the level picker cut to three letters (`68cdd642-ipad-dark-levels.png`). `68cdd642` made the count and Saved
  keep their room and lets the tools scroll, which leaves the picker cut. Task 6's log says Task 11 moves the picker and
  views into the header; Task 11's log does not. A person on the primary device cannot read which level is open. Fix:
  Levels 2D (and Levels 3D) supply `header` (document name, the level menu, Level · Tiles), as the spec draws it.
- **F2. On a phone the header takes three rows and cuts the editor's name to two letters.** At 390 × 844, Levels shows
  "Le… ▾" over a second row of two bare icons (the list and the panel) and a third row of Level, Tiles and Start: about
  155 px of 844 before the stage (`phone-levels.png`); Characters is "C… ▾" (`phone-characters.png`). Review Focus 4 was
  held for a long name; a short one is cut too. Fix with F1: the title holds the document's name, and the list and panel
  buttons join the first row or the title menu.
- **F3. A white strip lies across the top of the level on a phone, in Dark too.** About 50 px high, from the stage's top
  to the zoom toolbar (`phone-levels-drawn.png`, `68cdd642-phone-dark-levels.png`). No element covers it
  (`document.elementFromPoint` and every element under the point were read): the level canvas draws it. It stays after a
  resize. Not on the iPad. Not checked on #534, so whether v2 caused it is open.

### Medium

- **F4. Schematic's board cuts words on the iPad.** In the tall board at 820 × 1180 a link label at the right edge reads
  "ha / go / wh", the zoom toolbar covers the Follow box, and the list row "Hunt to Patrol: has got where it was going and
  does not see the player and" runs off the panel with no wrap (`ipad-schematic.png`). Task 13's test checks the mode
  boxes' words, not the links' labels or the rows below.
- **F5. "No problems" is a bare tick beside "✓ Saved".** Under 900 px the problem count drops its word (spec §7.4), and
  with no problems that leaves a lone tick: Home's header reads "Home ✓ ✓ Saved" (`ipad-home.png`). A grandma sees two
  ticks and cannot tell what the first one means. Keep the word "No problems" when there is room, or show nothing.
- **F6. Plan steps ticked whose checks did not run.** Task 14 Step 4 is `[x]` but its log and the PR say the site's e2e
  and parity did not run; Step 2 (the `3d.yml` commands) and Step 3 (every visual test) are `[x]` with "not run: the GPU
  runner" and "no compared baselines". AGENTS.md: tick a step only when its checks pass. Untick them, or run them.
- **F7. Tests written after the code** in Tasks 2, 7 and 8 (the log says so). Recorded, not undone; the fixes stage keeps
  red-first.

### Low

- **F8. Writer names the keeper twice.** The list is "Keeper › Lines" then "Keeper", and Home's card says
  "Keeper · Keeper" (`ipad-writer.png`, `ipad-home.png`). Say what each is ("Keeper's lines", "Keeper's talk").
- **F9. Layer rows cut their second line on the iPad**: "Characters a…", "Tiles that pla…", "Walls and flo…"
  (`ipad-levels.png`). The list is 264 px with two 44 px buttons; let the line wrap.
- **F10. Home's Characters card names nothing** though the game has five characters (`ipad-home.png`); every other card
  lists what is in it.
- **F11. A required field with no label shows its key**: `missingWords` falls back to `field.id`
  (`packages/editor/src/shared/kit/fields/field-values.ts:15`), and the words are "needs its Patrol path", not the
  spec's "needs a Patrol path".
- **F12. After a saved change restarts the open game, its sound stays off until the next tap** (the new game's audio
  is locked again). A person changing music while the game plays hears silence. Found while tracing J1; dev only.

## Held

- Dark by default on a light device; Light chosen on Home survives a reload and a closed tab; a fresh browser opens Dark.
- Publish is the only lime on every screen pictured, in both looks; no pill buttons; corners 4/6/8.
- The sidebar (iPad), the tab bar with More (phone) and Home's cards; every editor opens from them.
- Apple Pencil: the canvas gestures keep their pen handling (`recognizer.ts`), untouched by v2. No v2 journey draws with
  a pen; the apps plan owns that proof.
- Nothing was added beyond the plan's parts; the Review page stays out.

## What ran

Chromium only, at 390 × 844 and 820 × 1180, on `68cdd642` after `pnpm build` (the journeys read the build):
the extension journeys (18; then `audio-plays-in-game` ×8 and `feel-shows-in-game` ×4 per size after the fixes),
`complete-game-2d` and `complete-game-3d` (22 of 22), `work-survives-reopening` (2 of 2), `sequence-shows-in-game` ×2,
`pnpm check`. Not run: WebKit, Firefox, the GPU runner, the site's e2e, parity, the editors' layout projects (no change
here touches the editors' source).
