# Schematic build audit

Status: build audit, 2026-11-08. Audits AF PR #486 (branch `claude/project-thread-9rzwdx`, head `03f5c53b`, stacked on
#478) against [`2026-11-08-schematic-spec.md`](2026-11-08-schematic-spec.md),
[`2026-11-08-schematic-plan.md`](2026-11-08-schematic-plan.md) and its log, and
[`2026-11-08-schematic-plan-audit.md`](2026-11-08-schematic-plan-audit.md). Every finding was checked in the code at
that head, and the ones marked **(played)** were found by using the editors and the game by hand. Screenshots:
`/mnt/project-files/refactor/2026-11-08-schematic-build-audit-screens/`.

## Verdict

Schematic is real: a person can build a character's behaviour from nothing in the editors and see it in play. By hand,
in `examples/3d-story` served by `automata editor`, I added a blank character, named it, gave it sight, a patrol stop
at the nook, a second mode "Flee" at 2.5 m/s, and a switch from Patrol to Flee "when it sees the player", doing "run
from the player". In the game it switched to Flee at the same tick the guard saw the player (tick 59) and moved at
2.5 m/s; Watch logged "1.6 s: watcher went from Patrol to Flee". A Sentry added from the ready-made list stood at the
west place and went to Alarm when I walked into its sight. In a folder with no Schematic files, a ready-made Guard,
two places and two stops written in the editor pass the game's own compiler (`systemsDefShape` and `checkSystems`).

It is not ready to call done. One setting says the opposite of what the game does (H1). Fair play cannot run in any
game (H2). Nothing proves the 2D half (H3). A place rename's Undo leaves the scene broken, the diagram on a phone
shows one box and Fit does nothing, and Watch blames a missing extension on any game still on its title screen.

3 high, 9 medium and 12 low findings.

## What I ran

| What | Result |
| --- | --- |
| `examples/3d-story` `pnpm test:e2e` (Chromium, phone and iPad) | 12 of 12 pass (2.2 min) |
| By hand: the authoring session above, Watch, Places, Puzzle, Fair play, renames and Undo, a new game folder | Findings below |
| `extensions/editors` unit (all) and `svelte-check` | pass; 0 errors, 0 warnings |
| `@automata/debug` unit, `@automata/systems` unit | 74 pass, 74 pass |
| `@automata/editor` unit | pass |
| `examples/3d-story` `typecheck`, `test` | pass (5 tests) |
| `pnpm lint`, `boundaries`, `style`, `knip`, `check:changesets` | pass |
| `pnpm source-names` | fails, 5 findings in `examples/3d/wardrobe` and `packages/automata` SettingsScreen, files no Schematic commit touches |
| `check-style` and `check-boundaries` run by hand on `extensions/editors` and `examples/3d-story` (the gates skip them) | findings, see M8 |
| Not run | WebKit, Firefox, the GPU runner, parity, the 3D workflow's new step in CI |

## High

**H1. "Boxes and closed doors block its view" says the opposite of the game, and "yes" cannot be chosen.**
The sim reads `sight.wallsOnly === false ? w.walk : w.sight` (`systems/src/shared/sim/probe.ts:126`): with the field
left out, which is the default, only walls block sight (`world.ts:36`, "a sense with `wallsOnly` (the default)").
`senses.ts:47` and `:67` show a missing field as "yes", and `writeSense` (`:97`) writes "yes" by removing the field
and "no" as `wallsOnly = true`. So every ready-made character and the 3D story's guard read "block its view: yes"
while boxes do not block them, and both choices give the same walls-only sight: no person can make boxes block a
character's view. `tests/unit/schematic/senses.test.ts:28` and `:41-44` pin the wrong mapping. This is the plan
audit's H5.6, half fixed. *Fix:* a missing field and `true` read "no"; "yes" writes `wallsOnly = false`; a test in the
sim (a box between the guard and the player) for each answer, so the words are tied to what the game does. **(played:
a new sight sense reads "yes")**

**H2. Fair play cannot run in any game.** "Check now" runs the `[[check]]` row `fair-play` through the suite's checks
port (`schematic-session.svelte.ts:530`), but `automata editor` serves no checks runner, and no game, example or
template declares a `fair-play` check or the bots' scene module. In the served 3D story the page says "Fair play needs
two things from your game's code…", which is true of every game today. Spec section 7 and Task 14 step 6 are
unproven, and the Owner's open choice 2 was recommended on the condition that "the 2D story example has one".
*Fix:* either a checks runner in `automata editor` plus the 2D story's `systems.pipe.toml`, scene module and
`[[check]]` row, with Task 14 step 6 showing the verdict change; or put open choice 2 back to the Owner with the
cost (cut it, show the numbers read only). **(played)**

**H3. Nothing proves Schematic in 2D.** Task 14 and the 2D half of Task 8 (`presets-2d.test.ts`) are not built.
The plan log says they wait for content-in-play; that work has since moved on: #484's head now has the 2D story's
keeper, cutscene and guard (`6171e923`), and this branch merged an earlier #484 (`685667d4`). *Fix:* merge #484 up
again, then build Task 14 on `examples/2d-story` and the 2D preset test, as the plan says. Spec section 2's 2D
light and warmth words are only covered by a unit test.

## Medium

**M1. Undo after renaming a place leaves the scene broken.** `renamePlace` (`schematic-session.svelte.ts:380`)
writes the places file, then the behaviour file, as two undo steps (the log calls this a deferred minor; spec section
8 asks for one step). Renaming "nook" to "corner" and pressing Undo once put the behaviour file back to "nook" while
the places file kept "corner"; Status then said "1 problem in this scene. Your game is still playing the last version
that worked." The rename also rewrote the places file's layout (`[nodes.nook]` became `nodes.corner = {…}`).
*Fix:* one undo step across both files (a joint history entry, or Undo of either file undoes the pair). **(played)**

**M2. On a phone the diagram shows one box, and Fit does nothing.** `CharacterCanvas.svelte:63-65`: Smaller stops at
zoom 1, and Fit sets zoom 1, so Fit is the same as the smallest zoom. The 3D story's guard at 390 px shows only "Any
mode it moves in" and a line off the edge; at 820 px the diagram is 1,168 px wide in a 506 px pane. Spec 4.1's pinch
and Ctrl-scroll zoom are not built (no wheel or pinch handler in `schematic/`). In Watch the lit box (here Catch) is
usually off screen, so the person never sees it light. *Fix:* Fit shows the start mode and as much as fits at the 44 px
floor (or lays the columns top to bottom on a narrow pane); Watch scrolls the lit box into view; build the pinch and
Ctrl-scroll the spec names, or strike them from the spec. **(played; screens `diagram-phone-after-fit.png`,
`diagram-ipad.png`)**

**M3. Watch tells a person to add the debug extension when the game is on its title screen.** `WatchPane.svelte`
shows "You can see the game, but not which mode each character is in. Ask whoever writes your game's code to add the
debug extension." after 8 s without `af-watch-ready`. Debug is installed in the 3D story's renderer, which starts when
Play is pressed, so 10 s on the title screen shows that line though the extension is there; after Play the log works.
*Fix:* do not decide on silence alone: say "Press Play in the game to see which mode each character is in" until the
game has been played (or the frame has had input), and only then the debug line. **(played; `watch-on-title-screen.png`)**

**M4. A fact can only be one the behaviour file already names.** `names.ts:9` takes facts from the behaviour file
only; the puzzle's facts are not offered, and there is no "a new fact…" (spec 5.3). In the 3D story a guard cannot be
made to react to the puzzle's `lamp`; a new fact condition is `alarm` by default (`conditions.ts:295`) whatever the
scene has. This cuts the link between the puzzle and the characters, which is half of what Schematic is for.
*Fix:* facts are the puzzle's facts, then the file's, then "a new fact…" (a text field); a test with the 3D story's
puzzle.

**M5. A new game cannot add places before a character, so ready-made characters start without a patrol.** With no
behaviour file, every panel entry (Places included) shows "This scene has no characters yet" (`SchematicCanvas.svelte`,
`ready` needs a definition). A Guard added first gets no stops (`presets.ts stopsAt` on no places) and "Starts at: the
level's corner", against spec 9 ("every one has at least one patrol stop"). *Fix:* let Places open without a behaviour
file; on the start page offer "Add the first place" before "Add a character", or have Add a character say it will
stand in the corner until it has places. **(played, in an empty game folder)**

**M6. The character inspector leaves out what the game's code does, and the design notes have no page.** Spec 4: the
character shows "Things its game code does" (its hooks, read only), and the design table opens read only with "Design
notes, kept in the file." Neither exists (no `hooks` in any Schematic view). A person cannot tell that code also drives
a character. *Fix:* both, read only, as the spec says.

**M7. "How it decides" leaves out a rule the game runs.** `decide-words.ts` has six lines; it does not say that a catch
or a cutscene ends the rest, and so does a switch into or out of a mode where it stands still (spec 4.3;
`agent-step.ts run()`), and "The patrol only runs in the mode called Patrol" leaves out Routine (`ROUTINE_MODES`).
*Fix:* add the line and the second name, with the test the plan's constraint asks for (each line pinned against
`agent-step.ts`).

**M8. The style and boundary gates do not look at Schematic or the 3D story.** `pnpm style` and the `--features`
boundary list name neither `extensions/editors` nor `examples/3d-story`, so "style passes" says nothing about them.
Run by hand: `schematic-session.svelte.ts` is 603 lines (the rule is 600); plan comments at `patrol.ts:8` and
`presets.ts:1`; `solver.worker.ts` has an unknown role; `examples/3d-story/tests/unit/hall/hall-run.test.ts:11-15`
import `src/` by relative chains (AGENTS: `#src/…`); `.view.ts` is an unknown role in three files; and the example's
own `pnpm check` fails a sim boundary (`room.ts:3` imports the level JSON, a pattern it took from create-game's 3D
template, `template-3d-room.ts:101`). *Fix:* add both paths to `style` and `boundaries`, and fix or rule on each.

**M9. "Run from the player" can run through the player.** The sim's `fleeNode` (`systems effect.ts:49`) picks the
reachable place farthest from the player and walks the route there, whatever the route passes. In the 3D story's hall
my hand-made character fled from the nook toward the west end, past the player: the distance fell from about 3.5 m to
2.06 m before it grew. The Coward's line ("runs away from the player") overpromises in any corridor. This is sim
behaviour, which the plan forbids changing without asking, so it is the Owner's call. *Fix:* ask the Owner whether
`fleeNode` should avoid routes through the source; until then the Coward's line says it runs to the farthest place.
**(played)**

## Low

- **L1.** Home lists "Hall" three times under Schematic (systems, places, puzzle) and a fourth under Levels 3D, with
  nothing to tell them apart (known). Name each by what it is ("Hall: characters", "Hall: places", "Hall: puzzle"), or
  one entry per scene. (`home-phone-four-halls.png`)
- **L2.** The served page shows Levels 3D and Studio as "Not in this build" (known), so the 3D story's level cannot be
  edited where Task 15 says it can.
- **L3.** The start page's rows to copy (`schematic-facts.ts LIST_ROWS`) leave out the puzzles row and use
  `checks = []`, where create-game's template has the puzzles row and `checks = ["content"]`.
- **L4.** Fair play copy: "No scenarios yet. The game's code writes them." (scenarios are content in the behaviour
  file); a scenario reads "a careful player, is at lobby within 90 s" (`fair-words.ts`); Status has no "Fair play: last
  checked 2 changes ago" (spec 4).
- **L5.** A refusal stays on screen after moving to another page (a character rename refusal shown above Places), and
  an empty inspector bubble shows on Places at iPad width. (`places-ipad.png`)
- **L6.** With no places, the patrol says "Add the first place." with no link to Places (Task 7).
- **L7.** The condition menu has a "not …" kind beside the Not button on every condition (spec 5.2 says Not is the
  button only); the follow's doorway choice offers only "the doorway she just used" (`names.doorways` is always empty).
- **L8.** "Add a switch out of it" writes a live switch with no condition, so the running game switches every step
  until a condition is added. Say so on the new switch ("Always, until you add a condition") or add it with a first
  condition.
- **L9.** "Any mode it moves in to Catch: …" reads oddly; "From any mode it moves in to Catch" reads better.
- **L10.** Debug's `forwardEvents` posts to any origin the address names when framed. It is in development builds
  only, so this is acceptable; note it in the debug README.
- **L11.** The project-files copy of the plan (`/mnt/project-files/refactor/2026-11-08-schematic-plan.md`) is stale:
  every box unticked and no build log. Copy the repository's version over it.
- **L12.** `.github/workflows/3d.yml` gains the 3D story's journey; it has not run in CI, and it will run on every 3D
  workflow run on the Owner's runner.

## Checked and fine

- The 3D served journey's six steps each edit through the suite's controls, read the file, then measure play through
  the debug window; reproduced here 12 of 12.
- Problems are `systemsDefShape` plus `checkSystems` with the scene's places as nodes, each message as a sentence
  (`schematic-problems.ts`); a refused character rename says "There is already a character called “guard”."
- The ready-made five are as spec section 9 and each is tested in the 3D sim (`presets-sim.test.ts`), with a run that
  hashes the same twice.
- Watch's bridge checks both `event.source` and `event.origin`; debug posts only when framed, only to an exact origin,
  never `*`, and only the named events.
- The puzzle's "Can it be finished?" answers in the page ("Yes, in 1 step." for the 3D story).
- A game without the systems extension gets "This game does not use characters that think yet." with a link.
- Touch targets in the phone switch sheet are all 44 px or more, and the page never scrolls sideways at 390 px.
- No sim, schema or hash change in `systems`, `nav`, `puzzle` or `sectors`.

## For the fixes

Fix H1, M1 to M8 and the lows in the build's own code. H2 and M9 need the Owner (open choice 2; a sim change). H3 is
the plan's Task 14 and the 2D half of Task 8, after merging #484 up. Each fix keeps the standing rule: make the edit
in the editors, play it, and say what the game did.
