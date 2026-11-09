# Schematic plan audit

Status: plan audit, 2026-11-08. Audits [`2026-11-08-schematic-spec.md`](2026-11-08-schematic-spec.md) and
[`2026-11-08-schematic-plan.md`](2026-11-08-schematic-plan.md) (PR #478, branch `claude/project-thread-j53mj6` at
`9abece4f`) against the shared [`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md), the
`systems`, `puzzle`, `nav`, `debug` and `pipelines` extensions on that branch, the suite's write path, and the
content-in-play spec and plan (PR #479, audited on #481). Every finding below was checked in code; file and line
references are to that commit.

The Owner's charge: Schematic "looks particularly weak; that's how we do AI." The question asked here is whether a
person can author real game AI with it (what a character notices, its modes and how it switches, its patrol, ready-made
behaviours, watching it run, testing it) and whether the plan proves, in a served game, that what she edits changes
what the characters do, in 2D and 3D.

**Verdict:** the spec's shape is right (one table of pieces, a computed diagram, sentences as the editor), but the
draft would have shipped an editor that cannot make a character patrol in a new game, teaches a model of the AI that
the interpreter does not run, cannot check its own work, and is never shown changing a game. 10 high findings and 12
medium ones; all are fixed in the spec and plan in the same commit as this audit. The plan grows from 13 to 16 tasks.

## High

**H1. Nothing proves that an edit in Schematic changes play, in 2D or 3D.** The plan's only journey (Task 13) checks
that the file changed. The content-in-play plan's 2D journey (#481, Task 16 Step 3) has Schematic change the guard's
chase speed and then asserts only that the guard sees and loses the player, which would pass with the old speed. No
3D game or example uses `systems` at all: no `package.json` outside `extensions/systems` and `extensions/pipelines`
names it, and `loadSystems` has no caller outside the extension. *Fix:* new Task 14 (2D, on the content-in-play
plan's `examples/2d-story`) and Task 15 (3D, a new `examples/3d-story` on `sectors`) are served journeys whose every
edit is made in Schematic and then measured in play through the game's test hook: a sight range that flips "does not
see" to "sees" at a fixed distance, a speed measured over a second, a switch whose target mode changes, a ready-made
character added in the editor that appears and walks its patrol. The 3D example is new and private and moves no 3D
hash.

**H2. A person cannot make a place, so no character can patrol in a game made with the editors.** Patrol stops, "is
at", "go to" and the follow name nodes of the scene's nav graph (`content/nav/<scene>.toml`, `nav-graph.schema.ts`:
nodes by name and the edges between them; `route.ts` walks the edges). No editor writes that file: the content editors
spec (section 2) leaves the nav graph out, and the content-in-play spec (section 3.4) says "drawing one in Levels is
not part of this work". A new game has no nav file, so the patrol picker is empty. *Fix:* Schematic gains **Places**:
the scene's nav graph as a list (a name, where it is in metres, which places a character can walk to from it), with
its own start page and template row. Drawing places on the map stays later (open choice 3).

**H3. Where a character starts is not content.** `loadSystems` (`load-systems.ts:31`) puts an agent at the `places`
the game's code passes, else its first patrol stop, else the origin. A Sentry added from a ready-made behaviour with
no patrol would stand in the level's corner. *Fix:* the character inspector shows "Starts at" in words: where the
level places it, when the game passes start points; else its first patrol stop; else a warning with the fix. Every
ready-made behaviour has at least one stop. The 2D and 3D story examples pass the level's placed characters by name
(asked of the content-in-play build; Task 14 checks it).

**H4. The editor would check only the file's shape, so a wrong name never shows, and an edit that breaks the scene
silently stops reaching the game.** Task 4 makes the session's schema `systemsDefShape` (Zod). Every name check
(a mode, a character, a node, a hook, a routine without a patrol mode) is in `checkSystems`
(`systems-checks.ts`), which the content compiler runs (`systems.content.ts`) and the dev watcher uses to keep the
last good content. So spec section 5.3's "a value that names nothing shows its problem" cannot pass, and Watch would
keep showing the old behaviour with no word why. *Fix:* the session's problems are the shape plus `checkSystems`
(hooks: every hook the file names, so a hook is the compiler's to report; nodes: the scene's places), each message
mapped to a sentence at its field; while the file has problems, Watch and Status say "Your game is still playing the
last version that worked. Fix the problems to see this one."

**H5. The spec teaches a model of the AI that the interpreter does not run.** Checked in `agent-step.ts` and
`probe-kinds.ts`:

1. Not "the highest that holds wins": `run()` (agent-step.ts:44) applies **every** switch whose conditions hold, in
   order, in one step; it stops early only on a catch or a cutscene, or after a switch into or out of a still mode.
   The chase in the fixtures depends on it (a switch from Hunt to Hunt that goes to the player every step).
2. Switches run at three different times (`ordered()`): every step; when a noise is made (any switch that asks
   "hears"); and after the character stops or is blocked (any switch that asks `self.idle` or `self.blocked`). Order
   counts only within each group. One "Checked first ... Checked last" list misstates when a switch runs.
3. A switch from any mode (`from = "*"`) applies only to modes the character moves in (`applies`, `isStill`).
4. The patrol runs only in a mode named `patrol` or `routine` (`ROUTINE_MODES`). Renaming that mode stops the patrol.
5. "Has waited more than N s" (`timer`) counts time standing still and is not reset by a mode change (`setMode`,
   `world.ts`); the fixtures reset it with `set self.timer = 0`.
6. Sight's `wallsOnly` (default true) means only walls block the view; false means anything that blocks walking does.
   "Through walls only: yes" says the opposite.
7. A mode with no speed is a check error ("no speed for mode"); a new mode writes 0.
8. In a mode with speed 0, `stepAgent` returns before the wait counts or the waiting switches run, so "has stood
   still more than" and "has got where it was going" never hold there. The draft's Sentry ("Alarm → Patrol when it has
   waited 8 s", with Alarm standing still) would never stand down.

*Fix:* spec section 4.3 states the rules in words; the list has three groups ("All the time", "When it hears
something", "When it stops or is stuck"), reorders within a group, and says "Every switch that fits does its actions,
from the top"; the Any-mode box reads "Any mode it moves in"; the patrol mode is marked and its rename refused with a
sentence; "reset its wait" is an action, and a hint shows when nothing resets the wait on the way into a mode that
waits, or when a still mode's switch waits; sight reads "Boxes and closed doors block its view: yes/no".

**H6. The pieces table lacks the words real AI needs.** Missing: `self.idle` ("has got where it was going"),
`self.blocked` ("is stuck"), the character's own facts (`self.<name>`, "its own [name]"), `pursuit.hidden` ("the
player is hiding"), "hears anything" (`heard = "*"`), and the places an action may name besides a nav node: the player,
itself, the last noise, the nearest light, the nearest warmth, another character, a point (`PLACES`, `effect.ts
place`). Section 5.3 offered nav nodes only, so "go to the player" and "run from the player" could not be picked.
Without "has got where it was going", the Guard's search-then-give-up cannot be built. *Fix:* Tasks 1 and 2 carry
these rows and their tests.

**H7. The ready-made behaviours are tested only against the schema.** A preset that passes the schema can still never
leave Patrol. *Fix:* Task 8 writes each preset out (modes, switches, senses, stop) in the plan using only existing
vocabulary, and tests each in the sim on the 2D patrol scene (content-in-play Task 15's `patrol-2d`) and on the 3D
ward scene (`systems/testing/ward-game.ts`): Guard patrols, sees the player at 4 m and chases, loses her behind a wall,
searches where she was, gives up and walks its patrol again; Sentry raises the alarm and a Hunter hears it; Hunter
goes to a noise; Coward runs from the player; Wanderer walks its route and ignores her.

**H8. Watch's message does not exist and cannot say what the spec says.** `debug` posts nothing to its parent and
knows nothing of `systems`. A mode change is already a sim event (`systems.mode`, `{ agent, from, to }`,
`systems.event.ts`), which reaches the presentation bus's `sim.events` fact that debug's `BusPort` reads, but only
when the game calls `installDebug({ bus })`. Nothing carries "the switch it last took". *Fix:* debug forwards the sim
events the editor asks for (here `systems.mode`) to its parent, only when framed with `?af-watch=<editor origin>` and
only to that origin; the editor checks source and origin; the lit arrow is the from-to arrow (else the Any-mode one).
Watch adds a short log in words ("12.4 s: guard went from Patrol to Hunt"). No sim change, so no hash moves.

**H9. Fair play cannot run in any game, and as declared it would run on every edit.** The `systems` pipeline imports a
scene module the game writes (`systems-pipeline.ts`: a `SystemsScene` with `create`, `start`, `view` and routes in
code, `bots/scene.ts`). No game, example or template has one. And a check named in a file row's `checks` runs after
every write (`write-path.ts`, the `after` checks), so the bots would run on every slider move. *Fix:* the check is a
`[[check]]` row that no file row names, run by id from "Check now"; the start page names both needs (the pipelines
extension and the scene's fair-play file, which the game's code provides); the 2D story example ships a scene module
that reads `content/systems/guard.toml` at run time, and Task 14 shows a sight edit lowering the careful player's
wins. Open choice 2 is re-asked with this cost.

**H10. "Can it be finished?" does not need Node or game code, and the plan sends it through a pipeline no game can
run.** The `puzzle` pipeline also imports a game-written `PuzzleScene` module. But `createSolver(def, model = {})`
(`solver.ts:68`) takes the puzzle alone and the solver's files import only types and each other. *Fix:* the page runs
the solver on the edited puzzle in a Web Worker; the constraint now forbids only the bots in the page. Also, `systemic`
and `lethal` are not "design notes that change no behaviour": the solver takes systemic set-ups as steps
(`solver.ts:79`, `:160`) and checks lethal hints (`:482`). They show read only, as "How the characters open the way"
and "What can kill the player", and the solver's answer counts them.

## Medium

**M1. Renames miss references.** `renameModeEdits` misses `followThrough.then`, `ambush.mode` and `ambush.then` (any
character's), world rules' "is in mode" and "switch to" naming this character, other characters' switches that set
this one's mode, and scenarios' conditions. A character rename is missing altogether (other characters' and rules'
references, ambush, scenario placement). *Fix:* Task 6 lists every site and tests each.

**M2. Zoom breaks the 44 px rule.** Zooming out shrinks boxes below 44 px. *Fix:* the smallest zoom keeps a box's
target at 44 px; past that the diagram scrolls; Fit fits within that limit.

**M3. Adding and removing a condition is a structural edit.** The fixtures write switches as arrays of tables
(`[[agents.transitions.when]]`), and structural edits go through toml-patch (`patch-toml.ts`). *Fix:* Task 6 tests add
and remove on `bay`: outside that switch, every byte is unchanged.

**M4. The fixture facts are wrong.** `clinic` is one character, 32 switches, 2,253 lines. The largest is `bay`: two
characters, 74 switches, 3,479 lines, eight modes. *Fix:* the big-file tests use `bay`.

**M5. There are no fairness defaults to copy.** Every top-level table of a systems file is required. *Fix:* a new file
takes `toy.ts`'s fairness (0.9, 20, 1.5, 1, 1.3) and empty lists for the rest, tested against the full checks.

**M6. Package dependencies are missing.** *Fix:* `@automata/editors` depends on `@automata/systems`, `@automata/puzzle`
and `@automata/nav` and imports only their `/sim` entries in the page and `@automata/puzzle/solver` in the worker.

**M7. Copy.** The no-game Watch line differs from the Tuner pane's; "hooks" would show; a fact reads "power on is
yes"; the ambush sentence is unfinished and its `id` is the person's to invent. *Fix:* reuse the Tuner's line; "Things
its game code does"; names in quotes ("“power on” is yes"); "Hides, then appears at [place] after [2] s, waits [1] s,
then [hunts]", with the id made by the editor.

**M8. The shared spec contradicts this one.** Content editors spec section 2 says Schematic is "sentences ... not a
node graph" and leaves the nav graph out. *Fix:* both lines updated in the same commit.

**M9. Task 5 tests an inspector edit before Task 6 builds the inspector.** *Fix:* moved to Task 6.

**M10. Task 1's copy line contradicts itself** ("nurse is hunting… (exact copy: nurse is in hunt)"). *Fix:* one
sentence: "nurse is in Hunt".

**M11. The warmth sense is a list of kinds with a reach each** (`sources`), not one number. *Fix:* Task 7 edits it as
rows.

**M12. Watch shows a game the editor cannot see into, and a failed check keeps the old game running.** Covered by H4
and H8; Task 10 tests the "still playing the last version" line.

## The four open choices, for the Owner

1. **Which ready-made behaviours ship.** Recommended: Guard, Sentry, Hunter, Coward, Wanderer. The audit wrote each
   out and checked that today's conditions and actions can build it (H7).
2. **Fair play in the editor, or only in `automata check`.** Recommended: in the editor, as a "Check now" button.
   New cost from the audit: it only works in a game whose code provides the scene's fair-play file (a short TypeScript
   module); no template can write it. The 2D story example has one, so it is proven. If that cost is not worth it,
   cut Fair play from the first build and keep its numbers read only.
3. **A patrol drawn on the level, or a list.** Recommended: a list now, the map later. The audit adds Places as a list
   too (H2): without it a new game has nowhere to patrol.
4. **The puzzle as a lock graph, or a list.** Recommended: the list now, the graph after.

## What ran

Reading and checking code only (no build). The fixes are to the spec and plan; the build (Sonnet, high) runs them.
