# Schematic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task
> (the project runs plans natively, never with subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schematic, the game's AI editor: every part of a character's behaviour editable, shown as a diagram, watched
running, checked for fairness; the scene's places and puzzle; and proof, in served 2D and 3D games, that what a person
changes in Schematic is what the characters do.

**Architecture:** A feature folder `extensions/editors/src/features/schematic/` on the shared TOML session
(`shared/toml-session.ts`, `shared/content-session.svelte.ts`). One table of pieces (`pieces/`) is the editor's whole
vocabulary of conditions and actions; the diagram's layout is a pure function; the views are Svelte with an SVG
diagram. The session checks what the game's content compiler checks (`systemsDefShape` and `checkSystems`). Fair play
runs as a game check in Node through the checks port; the puzzle solver runs in a Web Worker in the page. Watch reuses
the Tuner's split view; `debug` forwards the sim's existing `systems.mode` events to the framing editor.

**Tech Stack:** TypeScript 6.0.3, Svelte 5.57.1, Zod 4.6.6, Vitest 5.0.3 (jsdom + Testing Library, Chromium layout),
Playwright (served journeys).

**Spec:** [`2026-11-08-schematic-spec.md`](2026-11-08-schematic-spec.md), with the shared
[`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md). **Audit:**
[`2026-11-08-schematic-plan-audit.md`](2026-11-08-schematic-plan-audit.md) (H1 to H10, M1 to M12; every one is fixed
below and named where it lands).

**Depends on:** the content-in-play work (PR #479, audited on #481): `@automata/places`, `level-2d`, its Task 15 2D
patrol scene and its Task 16 `examples/2d-story`. Tasks 1 to 7 and 9 to 13 need none of it. Task 8's 2D half and Task
14 run after the branch is merged up with that work; until then leave those steps unchecked and say so in the log.

## Global Constraints

- The content editors plan's constraints hold (no "Plus", core never imports this package, feature folders, tests in
  `tests/`, 600 lines a file, drunk grandma copy, 44/48 px targets, span-preserving edits, test first).
- No key name on screen: `sawHide`, `warmthWithin`, `followThrough`, `setMode`, `probe`, `transition`, `agent`,
  `routine`, `tunables`, `matrix`, `priority`, `hook`, `self.`, `pursuit.`, `nav`, `node` never appear in the page's
  text (a DOM test scans every Schematic view for them).
- The file holds no layout: diagram positions are computed every time.
- A condition or action kind the table lacks stays read only, never dropped or rewritten.
- What the editor calls fine is what the game plays: problems are `systemsDefShape` plus `checkSystems` (H4).
- The editor states the interpreter's rules as they are (spec 4.3, H5); a test pins each against `agent-step.ts`.
- Watch's message listener checks both `event.source` and `event.origin`; debug posts only when framed with
  `af-watch` and only to that origin.
- Fair play runs in Node through the checks port, by id, never after every write; the page never imports
  `@automata/systems/bots`. The puzzle solver runs in a Web Worker on the edited puzzle.
- Nothing Schematic adds reads the world except through the `places` contract (content-in-play spec 3.4). In a 2D
  game the light and warmth senses show the lint's words, tested in Task 7 with a game whose editor list names a 2D
  level and no 3D one.
- No sim, schema or hash changes in `systems`, `nav`, `puzzle` or `sectors`. If one seems needed, stop and ask.
- Every served journey edits through the suite's UI. Never write the TOML directly and count it as edited.

## Review Focus

1. **The largest converted file** (`bay`: two characters, eight modes, 74 switches, 3,479 lines). The diagram and list
   stay usable; a value edit rewrites only its literal (Task 6); adding and removing a condition leaves every byte
   outside that switch (Task 6).
2. **`from = "*"` switches and self-loops.** Drawn, editable, and labelled "Any mode it moves in" (Task 3, Task 5).
3. **Renames** of a mode, a character and a place change every reference in one undo step; the patrol mode's rename is
   refused (Tasks 6 and 9).
4. **A nested `not`** in an old file (`not: { not: … }`): shown as its sentence, editable to one level, read only
   deeper (Task 1).
5. **A game without the systems, nav, debug or pipelines extension.** Each missing one says what to add; nothing falls
   back silently (Tasks 4, 9, 11, 12).
6. **The proof in play** (Tasks 14 and 15): each assertion would fail with the value before the edit.

---

### Task 1: The conditions table

**Files:** create `src/features/schematic/pieces/piece.ts`, `src/features/schematic/pieces/conditions.ts`; test
`tests/unit/schematic/conditions.test.ts`.

**Interfaces:**
- Produces: `interface Piece<V> { kind: string; group: 'notices' | 'where' | 'true' | 'time' | 'move' | 'change' | 'tell'; matches(value: unknown): value is V; words(value: V, names: Names): string; fields(value: V, names: Names): Field[]; write(value: V, key: string, next: unknown): V; fresh(names: Names): V }`; `interface Names { modes: string[]; agents: string[]; facts: string[]; places: string[]; hooks: string[]; doorways: string[] }`; `CONDITIONS: readonly Piece<Probe>[]` (the 12 kinds plus the special facts, below); `conditionPiece(probe: unknown): Piece<Probe> | undefined`; `conditionWords(probe: Probe, names: Names): string` (a `not` reads "does not …"; a second `not` reads "not (…)", read only).
- Consumes: `Field` from `shared/fields.ts`; `Probe`, `probeSchema` from `@automata/systems/sim`.

- [x] **Step 1: Failing tests**, one `it` each: `{ sees: true }` "sees the player"; `{ heard: 'shriek', reach: 6 }` "hears a shriek within 6 m" (fields Kind of noise, Within m); `{ heard: 'step' }` "hears a step from anywhere"; `{ heard: '*' }` "hears anything"; `{ inLight: true, radius: 2 }` "is in light (within 2 m)"; `{ warmthWithin: 3 }` "is within 3 m of warmth"; `{ touching: true }` "is touching the player"; `{ touching: true, radius: 1 }` "is within 1 m of the player"; `{ fact: 'power.on', is: true }` "“power on” is yes"; `{ mode: 'hunt', agent: 'nurse' }` "nurse is in Hunt"; `{ mode: 'hunt' }` "is in Hunt"; `{ at: 'bedside' }` "is at bedside"; `{ timer: 8 }` "has stood still more than 8 s"; `{ crossed: true }` "the player just went through a doorway"; `{ sawHide: { radius: 4, los: true } }` "saw the player hide within 4 m, in sight"; the special facts: `{ fact: 'self.idle', is: true }` "has got where it was going", `{ fact: 'self.blocked', is: true }` "is stuck", `{ fact: 'pursuit.hidden', is: '' }` "the player is not hiding", `{ fact: 'self.seen', is: true }` "its own “seen” is yes"; `{ not: { sees: true } }` "does not see the player"; `{ not: { not: { sees: true } } }` reads "not (does not see the player)" and is read only; every `fresh()` passes `probeSchema`; every `write` then `matches` round-trips; a kind the table lacks returns `undefined` from `conditionPiece`.
- [x] **Step 2:** Run `pnpm --filter @automata/editors test conditions`; confirm each fails for the missing module.
- [x] **Step 3:** Implement. **Step 4:** Pass. **Step 5:** Commit `feat(editors): Schematic's conditions`.

### Task 2: The actions table

**Files:** `src/features/schematic/pieces/actions.ts`, `src/features/schematic/pieces/places-field.ts`; test
`tests/unit/schematic/actions.test.ts`.

**Interfaces:** `ACTIONS: readonly Piece<SysEffect>[]` (9 kinds, plus "reset its wait"); `actionWords(effect, names): string`; `placeChoices(names: Names): { value: string; words: string }[]` (the player, itself, the last noise, the nearest light, the nearest warm thing, each character, each named place, then "a point…"; `PLACES` from `probe-kinds.ts` is the source of the special names).

- [x] **Step 1: Failing tests**, one per kind: `{ setMode: 'hunt' }` "switch to Hunt"; `{ setMode: 'patrol', agent: 'porter' }` "switch porter to Patrol"; `{ goTo: 'bedside' }` "go to bedside"; `{ goTo: 'player' }` "go to the player"; `{ goTo: 'noise' }` "go to the last noise it heard"; `{ goTo: { x: 1, z: 2 } }` "go to the point 1 across, 2 down"; `{ flee: 'player' }` "run from the player"; `{ flee: 'light' }` "run from the nearest light"; `{ noise: { at: 'self', loudness: 6, kind: 'shriek' } }` "make a shriek noise here, loudness 6"; `{ set: 'alarm', to: true }` "set “alarm” to yes"; `{ set: 'self.timer', to: 0 }` "reset its wait" (its own row); `{ emit: { cutscene: 'caught' } }` "play the cutscene caught"; `{ emit: { line: 'l1' } }` "say the line l1"; `{ emit: { caught: 'ada' } }` "catch the player"; `{ call: 'chase' }` "do “chase” (in the game's code)"; `followThrough` with `portal: 'crossed'` "follow the player through the doorway she used after 2 s, then Hunt"; `ambush` "hide, then appear at [place] after [2] s, wait [1] s, then Hunt" and its `fresh()` makes a unique id (`ambush-1`, `ambush-2`) that no field shows. `placeChoices` lists in the order above. Each `fresh()` passes `effectSchema`.
- [x] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit `feat(editors): Schematic's actions`.

### Task 3: The diagram's layout

**Files:** `src/features/schematic/diagram/layout.ts`; test `tests/unit/schematic/layout.test.ts`.

**Interfaces:** `layoutAgent(agent: AgentDef, size: { box: { w: number; h: number }; gap: number; label: number }): Diagram` with `Diagram = { boxes: Box[]; arrows: Arrow[]; width: number; height: number }`, `Box = { mode: string | '*'; x: number; y: number; w: number; h: number; start: boolean; still: boolean; patrol: boolean }`, `Arrow = { from: string; to: string; switches: number[]; loop: boolean; timing: 'always' | 'hears' | 'stops'; points: [number, number][]; label: { x: number; y: number; w: number; h: number } }`.

- [x] **Step 1: Failing tests:** columns by breadth-first distance from `initial`; unreachable modes in a last column; the `*` box first when any `from = "*"`; a self switch is `loop: true`; two switches between the same pair share one arrow with both indices; `timing` matches `ordered()` from `agent-step.ts` for every switch of every fixture (hearing, waiting, deciding); `still` is `isStill` and `patrol` is `routineMode`; on `bay`, `clinic-dawn`, `clinic` and `prologue` no two boxes overlap, no two labels overlap, and every switch index appears in exactly one arrow.
- [x] **Steps 2 to 4:** see them fail; implement (orthogonal arrows, no external library); pass. **Step 5:** Commit `feat(editors): Schematic's diagram layout`.

### Task 4: Session, problems, suite editor, panel and the start pages

**Files:** `schematic-session.svelte.ts`, `schematic-problems.ts`, `schematic-suite-editor.ts`, `SchematicRegions.svelte`, `SchematicPanel.svelte`, `SchematicStart.svelte`, `starter.ts`; `src/app/suite/content-editors.ts` (add `createSchematic()`); sample `src/app/suite/sample/systems.toml` (one Guard), `sample/nav.toml` (three places) and their list rows; `extensions/editors/package.json` (depend on `@automata/systems`, `@automata/nav`, `@automata/puzzle`, workspace); tests `tests/unit/schematic/schematic-editor.test.ts`, `tests/unit/schematic/problems.test.ts`, `tests/unit/schematic/starter.test.ts`.

**Interfaces:** `createSchematic(options: { gameUrl?: string }): SuiteEditor<SchematicSession>`; `SchematicChoice = { kind: 'character'; index: number } | { kind: 'places' } | { kind: 'rules' } | { kind: 'numbers' } | { kind: 'fair' } | { kind: 'puzzle' }`; the session holds one `TomlSession<SystemsDef>` per scene (opened on choosing it), the scene's nav session and its puzzle session when they exist. `schematicProblems(def: SystemsDef, nodes: readonly string[] | undefined): Problem[]` runs `systemsDefShape` then `checkSystems(def, { hooks: everyHookNamed(def), nodes }, …)` and maps each message to a sentence at its key path (H4); `newSystemsFile(scene: string, agent: AgentDef): SystemsDef` (M5: fairness 0.9, 20, 1.5, 1, 1.3; every list empty).

- [x] **Step 1: Failing tests:** the panel lists scenes, Characters by name, Places, World rules, Numbers, Fair play, Puzzle (only with a puzzle file); no systems file shows "This scene has no characters yet." and "Add a character"; a list without the systems or nav row shows the row to add; a game without the systems extension shows its sentence and README link; every `checkSystems` message the fixtures and a broken copy of each can produce has a sentence (a test feeds one broken file per message kind) and lands on its field; a hook the file names is never reported; while problems exist, Status says "Your game is still playing the last version that worked. Fix the problems to see this one."; `newSystemsFile` passes `systemsDefShape` and `checkSystems`; the copy scan for the banned words.
- [x] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit `feat(editors): Schematic's frame and problems`.

### Task 5: The diagram and the list of switches

**Files:** `diagram/Diagram.svelte` (SVG, every box and label a `<button>`-role element with a name), `SwitchList.svelte`, `CharacterCanvas.svelte` (Diagram and List tabs on a phone, stacked wider), `decide-words.ts` (the spec 4.3 lines); tests `tests/unit/schematic/diagram.test.ts`, `tests/browser/schematic-layout.test.ts` (Chromium, 390x844 and 820x1180).

- [x] **Step 1: Failing tests:** selecting a box selects the mode in the session; an arrow's label is its first condition and "and N more"; a hearing or stopping switch is dashed with its mark; the list has three groups, "All the time", "When it hears something", "When it stops or is stuck", each in order; the canvas shows the spec 4.3 lines; "Any mode it moves in" labels the `*` box; the patrol mode shows "Walks its patrol here"; a still mode shows "stands still"; a still mode's switch that waits shows "This never happens: it stands still in …"; a mode with a waiting switch out and no reset in shows "This may switch at once: …"; layout test: at the smallest zoom every box and label target is at least 44 px, Fit and pan work, and the `bay` diagram scrolls rather than shrinking (M2).
- [x] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit `feat(editors): Schematic's diagram and list`.

### Task 6: The inspector: modes and switches

**Files:** `ModeInspector.svelte`, `SwitchInspector.svelte`, `PieceRow.svelte` (a sentence with its fields, built from a `Piece`), `AddPiece.svelte` (the grouped menu); `schematic-edits.ts`; tests `tests/unit/schematic/schematic-edits.test.ts`, `tests/unit/schematic/inspector.test.ts`.

**Interfaces:**
- `renameModeEdits(def: SystemsDef, agent: number, from: string, to: string): ContentEdit[] | { refused: string }`: modes, initial, the speed key, this character's switches' from and to, every `setMode` and `mode` condition naming this character's mode (its own, other characters' with `agent`, world rules'), `followThrough.then`, `ambush.mode` and `ambush.then` where the ambush names this character, and scenarios' conditions. Refused for the patrol mode (`routineMode`).
- `renameAgentEdits(def: SystemsDef, from: string, to: string): ContentEdit[]`: the id, every `agent` field in conditions and actions (characters' and rules'), `ambush.agent`, scenarios' `setup.place` keys.
- `reorderEdits(agent: AgentDef, agentIndex: number, index: number, to: number): ContentEdit[]`: within the switch's group only; priorities rewritten as descending tens within that group, only those that change.
- `addModeEdits` writes the mode with speed 0.

- [x] **Step 1: Failing tests:** each rename site above in its own `it`, all in one undo step; renaming `patrol` is refused with "This mode walks the patrol, so it keeps its name. Add a new mode instead."; reorder never moves a switch across groups and keeps the others' relative order; "Not" toggles `{ not }` around a condition; removing the last condition leaves `when = []` ("always"); adding each kind from the menu passes the checks; a new mode has speed 0 and passes the checks; on `bay`, changing one switch's number through the inspector changes only that literal, and adding then removing a condition on one switch leaves every byte outside that switch's tables unchanged (M3); this test moved here from Task 5 (M9).
- [x] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit `feat(editors): Schematic's inspector`.

### Task 7: Where it starts, senses and patrol

**Files:** `CharacterInspector.svelte`, `senses.ts`, `patrol.ts`, `start-words.ts`; tests `tests/unit/schematic/senses.test.ts`, `tests/unit/schematic/patrol.test.ts`.

- [x] **Step 1: Failing tests:** sight reads "Sees up to [4.5] m. Boxes and closed doors block its view: [no]" (`wallsOnly` true is "no", H5.6); hearing "Hears up to [8] m" (no reach: "Hears from anywhere"); touch "Touches within [0.6] m"; light "Notices light within [2] m"; warmth as rows "Feels [a stove] within [3] m" (M11); add and remove a sense; in a game whose list names a 2D level and no 3D one, light and warmth show the 2D lint sentence; "Starts at" reads "its first patrol stop, [desk]" or, with no stop, "the level's corner. Give it a patrol stop to start at." (H3); patrol stops in order with "Waits [3] s" and actions (Task 2's pieces); a stop picks from the scene's places; with no nav file, "Characters need places to walk between. Add the first place." links to Places.
- [x] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit `feat(editors): Schematic's senses, start and patrol`.

### Task 8: Ready-made behaviours

**Files:** `presets.ts` (Guard, Sentry, Hunter, Coward, Wanderer exactly as spec section 9, as `AgentDef` data with one line of words each), `AddCharacter.svelte`; tests `tests/unit/schematic/presets.test.ts`, `extensions/systems/tests/unit/presets-sim.test.ts` (3D, on `testing/ward-game.ts`), `extensions/level-2d/tests/unit/sim/presets-2d.test.ts` (2D, on content-in-play Task 15's `patrol-2d`). The presets' data is imported by the sim tests from `@automata/editors`' testing entry, or copied once into a shared fixture, whichever keeps `boundaries` green (no extension imports the editors package outside tests).

- [x] **Step 1: Failing tests:** each preset passes `systemsDefShape` and `checkSystems` inside `newSystemsFile`; adding one writes an `[[agents]]` table with a unique id ("guard-2") and stops at the scene's first places; the sheet describes each in one line. In the sim, 3D and 2D, with fixed seeds (H7): **Guard** walks its patrol, switches to Hunt when the player stands 4 m away in sight, closes on her, switches to Search when a wall hides her, walks to where it last saw her, returns to Patrol after 5 s there, and catches her when it touches her (`systems.caught`); **Sentry** stays at its post, switches to Alarm and makes the alarm noise when it sees her, and a Hunter 10 m away goes to that noise; **Hunter** goes to a thrown noise and gives up 4 s after arriving; **Coward** moves away from the player when it sees her (distance grows over 2 s); **Wanderer** visits its three stops in order and never changes mode with the player beside it. Each run hashes the same twice.
- [~] **Steps 2 to 4:** see them fail; implement; pass (the 2D half after the merge-up; see "Depends on"). **Step 5:** Commit `feat(editors): Schematic's ready-made behaviours, checked in the sim`.

### Task 9: Places

**Files:** `PlacesCanvas.svelte`, `places-edits.ts`; tests `tests/unit/schematic/places.test.ts`.

**Interfaces:** the scene's nav session (`navGraphSchema`); `renamePlaceEdits(nav, systems, puzzle?, from, to)` returns edits for both files as one step (patrol stops, `at` conditions, `goTo`/`noise.at`/`ambush.at` naming it, the nav edges); `removePlace` is refused while anything names it, with the list of what does.

- [x] **Step 1: Failing tests:** each place reads "[bedside]: [4] across, [2] down. Walks to [desk] [door]"; an edge with a door reads "through the [ward door]"; add a place; connect and disconnect two places (one undirected edge, never twice); rename changes every reference in both files in one undo step; remove is refused with what names it; a new game writes `content/nav/<scene>.toml` on its first place (with the list row check of Task 4); the nav schema's problems show in words.
- [x] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit `feat(editors): Schematic's places`.

### Task 10: World rules and Numbers

**Files:** `RulesCanvas.svelte`, `NumbersCanvas.svelte`; tests.

- [x] **Step 1: Failing tests:** a rule reads "When … then …, every [n] s", with its design text as "What it is for"; a rule with no conditions reads as its text only and says which switches carry it out when its text names them; a rule's condition menu leaves out what needs a character (the check's `ruleProbeError` and `ruleEffectError` list); Numbers rows are label (the number's name in words), value, range and unit, with the note as help.
- [x] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit `feat(editors): Schematic's rules can be added and taken apart`.

### Task 11: Watch

**Files:** `WatchPane.svelte`, `watch-bridge.ts`, `watch-log.ts` (reuse `TunerGame.svelte` by exporting it from `@automata/editor`'s kit, as a separate small commit in `packages/editor` with its own test; the package is private, so no changeset); in `extensions/debug`: `src/features/watch/forward-events.ts` and its wiring in the overlay (H8); tests on both sides.

**Interfaces:** debug: `forwardEvents(bus: BusPort, location: Location, parent: Window): () => void`: reads `af-watch` (an origin) and `events` (comma list) from the page's address; when both are present and `parent !== window`, subscribes to `sim.events` and posts `{ type: 'af-sim-event', name, payload }` for each named event to `parent` with `targetOrigin` = that origin. Editor: `watchBridge(frame: HTMLIFrameElement, gameOrigin: string, on: (event) => void)`.

- [x] **Step 1: Failing tests:** debug posts nothing unframed, nothing without `af-watch`, never with `*` as the target origin, and only the named events; the editor ignores a message whose source is not the frame's window or whose origin is not the game's; a good `systems.mode` lights the box, flashes the from-to arrow (or the Any-mode arrow), and logs "12.4 s: guard went from Patrol to Hunt"; with no game URL the pane shows the Tuner's line; with the game up but no event within the first restart, the "Ask whoever writes your game's code to add the debug extension" line shows; while the file has problems, the pane says the game is still playing the last version that worked.
- [x] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit `feat(editors,debug): Watch a character's modes as the game runs`.

### Task 12: Fair play

**Files:** `FairCanvas.svelte`, `fair-words.ts`; tests (with the memory checks port).

- [x] **Step 1: Failing tests:** scenarios as sentences; thresholds as "at least [70] %"; Check now runs the declared check by id and shows "Fair: 3 of 3 checks pass" or the failing scenario in words; the check is found as a `[[check]]` row no file row names, and a test proves a value edit runs no fair-play check (H9); a result is stale after an edit; no declared check, or no pipelines extension, shows "Fair play needs two things from your game's code: …" with the link.
- [x] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit `feat(editors): Schematic's fair play`.

### Task 13: The puzzle

**Files:** `puzzle/puzzle-pieces.ts` (the puzzle's condition and effect kinds as pieces), `puzzle/solver.worker.ts`, `PuzzleCanvas.svelte`; tests.

- [x] **Step 1: Failing tests:** items, facts with starting values, actions as "At {hotspot}, using {item}: when …, …", the goal; systemic and lethal entries read as sentences under "How the characters open the way" and "What can kill the player", read only (H10); "Can it be finished?" posts the edited puzzle to the worker, which runs `createSolver(def)` and answers "Yes, in 14 steps" or "No: the player can get stuck after …"; the answer is stale after an edit; the page bundle imports no Node module (a build test).
- [x] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit `feat(editors): Schematic's puzzle`.

### Task 14: Served journey: AI edited in Schematic changes play, 2D

After the merge-up with the content-in-play work. On its `examples/2d-story` (a guard on a patrol between two areas
split by a wall with a gap; the game passes the level's placed characters' points to `loadSystems` by name, and exposes
the sim through its test hook). If that example lacks the start points or the test hook, add them there in this task.
Add to it the fair-play files: a `systems.pipe.toml` and a scene module that reads `content/systems/guard.toml` from
disk on each run, and the `[[check]]` row that runs them.

**Files:** `examples/2d-story/tests/e2e/schematic-in-play.test.ts`; the pipe files above.

- [x] **Step 1: Failing journey** (Chromium, phone and iPad projects), `automata editor` serving the suite and the game:
  1. Play with the player placed 5 m from the guard in its line of sight: through the test hook, the guard stays in
     Patrol for 3 s (sight is 4 m).
  2. In Schematic: the guard's sight to 7 m; Save; Play: the guard is in Hunt within 1 s.
  3. In Schematic: Hunt's speed from 2.2 to 3.5 m/s; Save; Play: the distance the guard covers in Hunt over 1 s is
     3.5 m ± 0.1 (it was 2.2).
  4. In Schematic: the switch Patrol → Hunt now goes to Search instead; Save; Play: the guard's first mode change is to
     Search.
  5. In Schematic: Add a character, Sentry, at a place; Save; Play: the sentry exists in the sim at that place and
     switches to Alarm when the player steps into its sight.
  6. Fair play: Check now; raise the guard's sight to 12 m; Check now: the careful player's wins go down, and the
     verdict's words change.
  7. Look at the screenshots and explain each in the log.
- [x] **Step 2:** Pass. **Step 3:** Commit `test(examples): AI edited in Schematic changes a 2D game`. (Done in the fixes: 10 of 10 in Chromium. The 2D story's fair-play step is not run: no runner, H2.)

### Task 15: Served journey: AI edited in Schematic changes play, 3D

No 3D game uses `systems` today. Add the smallest one, private, the shape of a `create-game` 3D game: `examples/3d-story/`
with a level (`content/levels/hall.af-sector.json`, two rooms joined by a doorway, editable in Levels 3D), a nav graph
(`content/nav/hall.toml`, four places), a puzzle file with one fact, `content/systems/hall.toml` (one Guard), its
editor list (Levels 3D, Schematic, the Tuner), and `src/` wiring `sectorsExtension`, `navExtension`, `puzzleExtension`,
`systemsExtension`, `debugExtension` (behind `__AUTOMATA_DEBUG__`, with `installDebug({ bus })`), drawing each agent
as the base figure from 3D core, and a test hook that reads the sim. Its behaviour is code: the player walks with the
template's controls. It moves no other 3D hash, golden or replay.

**Files:** `examples/3d-story/**`; `examples/3d-story/tests/e2e/schematic-in-play-3d.test.ts`.

- [x] **Step 1: Failing unit test** in the example: a scripted run hashes the same twice in Node; the guard patrols.
- [x] **Step 2: Failing journey** (Chromium; the GPU runner for the 3D workflow): steps 1 to 5 of Task 14 on this
  game, plus Watch: open Watch, step the player into sight, and the diagram lights Hunt and logs the switch.
- [x] **Step 3:** Pass; record the scene's hash in Node; report which engines ran. **Step 4:** Commit
  `test(examples): AI edited in Schematic changes a 3D game`.

### Task 16: The sample journey, template, docs and the gate

- [x] `create-game`'s template `editors.toml` gains the systems, nav and puzzle rows (test in `packages/tools`).
- [x] Journey on the sample page: open Schematic, change the guard's sight, the file changes, Undo.
- [x] The systems README gains "Editing characters in Schematic" (where a character starts, places, Watch, Fair
  play's scene module); `docs/refactor/progress.md` and this log updated.
- [ ] (see the log: `pnpm format` and `pnpm check` results) `pnpm format`, `pnpm check`; the log below records what ran (Node, Chromium) and what did not (WebKit, Firefox,
  the GPU journeys on the runner).

## Log

(Each session records what it did here, with evidence.)

- 2026-11-08, plan audit ([`2026-11-08-schematic-plan-audit.md`](2026-11-08-schematic-plan-audit.md)): 10 high and 12
  medium findings fixed. New: Places (Task 9), the served 2D and 3D journeys in play (Tasks 14 and 15), the presets
  tested in the sim (Task 8), `checkSystems` in the editor (Task 4), the three switch groups (Tasks 3, 5, 6), the
  solver in a worker (Task 13), debug's event forward for Watch (Task 11). 16 tasks.
- 2026-11-08, build (Sonnet, high, inline, ~50 min): Tasks 1 to 7 done and Task 8's 3D half, AF PR #486 stacked on #478.
  Evidence: editors `pnpm test:unit` 266 pass, systems 74 pass, both typechecks 0 errors, biome clean. Task 8 marked
  `[~]`: its Step 2 to 4 are done for the 3D sim (`extensions/systems/tests/unit/presets-sim.test.ts`; sabotaging four
  presets each failed a sim test) and not for 2D (`presets-2d.test.ts` needs content-in-play Task 15). Tasks 9 to 16 are
  not started. Not run: the Chromium layout suite after Tasks 6 and 7, the journeys, `pnpm check`, parity, WebKit,
  Firefox. Ruling: the kit's TOML patch (toml-patch 3.3.1) throws or mis-places inserts and removes inside arrays of
  tables nested in an array of tables, so structural changes to a switch, a patrol stop or a sense rewrite only that
  item's tables as text (`switch-text.ts`), read back and compared with the intended value, written with
  `TomlSession.accept` as one undo step; value edits stay span-exact kit edits. A comment inside a rewritten item is
  lost. This replaces the plan's `addConditionEdit`-style kit edits. The M3 test on `bay` passes (rewrite of one
  switch, every other byte kept, round trip equal).
- 2026-11-08, Task 9 (Places) done; Task 10 partial (`[~]`): Numbers done; Rules edit values only, adding or removing a
  rule or its parts is refused in words and the rule condition menu limits are not built. Editors `pnpm test:unit` 280 pass.
- 2026-11-08, hand-off for the build audit: self-review found one real defect and fixed it (RED then GREEN): the kit's
  lenient TOML reader accepted `senses = []` beside `[[agents.senses]]` tables, which the game's strict reader
  (smol-toml) refuses. Every structural change is now read back with both readers. Also run: `pnpm boundaries`,
  `pnpm style`, `pnpm knip` clean; Chromium layout 6 pass at 390x844 and 820x1180 (it covers the diagram and list, not the
  inspector). Final review is a self-review by the author (no subagent tool), not a fresh reviewer. Deferred minors: Rules
  cannot add or remove parts; a place rename is two undo steps; comments inside a rewritten item are lost; a fact probe
  reads "power" is no (quoted names and yes/no); the Places and Rules screens have no phone-size layout test; the
  inspector has no phone-size layout test. The audit must make a small game in the editors, play it, and confirm the
  edit shows up in play (Tasks 14 and 15 would have done this and have not been built).

- 2026-11-08, Task 10 finished: a rule can be added, removed, and given or relieved of conditions and actions
  (`rule-text.ts`, the same text rewrite as a switch, read back with both readers; the last rule out puts `rules = []`
  back). The rule menus offer exactly what the game's own checks accept (`rule-menu.ts` asks `checkSystems`, so the list
  cannot drift). A rule the design notes point to cannot be removed, in words. Editors unit 297 pass.
- 2026-11-08, Task 11 (Watch) done in three commits: `@automata/editor`'s kit exports the Tuner's frame as `GameFrame`
  (gains `query` and `onframe`); `@automata/debug` gains `forwardEvents` (wired in the overlay, changeset added); Schematic gets
  `WatchPane`, `watch-bridge.ts`, `watch-log.ts` and the lit diagram. Ruling: debug also posts one `af-watch-ready` message
  when it starts listening, which the plan did not name; without it a quiet game cannot be told from one with no debug
  extension, and the "Ask whoever writes your game's code" line would be a guess. Cost if wrong: one extra message type.
  Ruling: seconds are the sim tick over `tickHz` (new optional field on `installDebug`, default 60), computed in debug.
  Evidence: editors unit 315 pass, debug unit 74 pass, editor-package tuner-game and kit tests pass, Chromium layout 8 pass
  (6 diagram, 2 Watch at 390x844 and 820x1180), typechecks and biome clean.
- 2026-11-08, Task 12 (Fair play) done in the editor: `FairCanvas`, `fair-words.ts`, the session's `checkFair` and
  `setFairNumber`. The check is the `[[check]]` row with id `fair-play`, which no file row names (a threshold edit runs
  none: tested). The check prints the suite's own shape (`{ findings, measure }`, `argv-checks.ts`), not the pipeline's
  `{ id, ok, detail }` list, so a game's `fair-play` check is a small command of the game's own (Task 14 writes
  `examples/2d-story`'s). The run passes the current file as a candidate, so it plays what is on screen, saved or not.
  Editors unit 327 pass.
- 2026-11-08, Task 13 (Puzzle) done: the puzzle's conditions and effects as pieces (`puzzle/puzzle-pieces.ts`), items and
  facts added and taken out, with a refusal that names what still uses them (`puzzle/puzzle-edits.ts`), "Can it be
  finished?" in a worker (`puzzle/solve.ts`, `solver.worker.ts`, `solver-client.ts`; a test builds the worker for the page and
  finds no Node module in it). Ruling: the rule-list text rewrite became `table-list-text.ts` (a rule list, a puzzle's actions
  and goal) so the two share one tested path. Ruling: the solver is told each of the game's `call`s changes nothing, so
  the answer says which calls were not counted ("What the game's code does (wake) is not counted."); the solver throws
  without a model for a call, and an answer that threw would help nobody. Cost if wrong: an answer can say yes where a
  call would have closed a way. Not done: renaming an item or a fact, editing hotspots and ways in (read only). Editors unit 384
  pass.

- 2026-11-08, Task 15 (3D served journey) done: `examples/3d-story`, a private hall with a guard (a level, a nav graph,
  a puzzle, a behaviour file, the editor list with Levels 3D, Studio, the Tuner and Schematic). The guard is the base
  woman figure, drawn from the sim. Unit (5 pass): the guard patrols to the first stop, stays in Patrol 3 s with no
  mode change, hunts a player in its path, hunts within 1 s when the file's sight is 7, and the same run hashes the
  same twice (Node scene hash after 8 s: `1addc88c39a912bf`). Journey (`pnpm test:e2e` there, Chromium, phone and iPad,
  12 of 12 pass): `automata editor` serves the suite and the game's dev server plays; each step edits through the
  editors' own controls and reads the file (`range = 7`, `hunt = 3.5`, the switch pointing at Search, a Sentry added),
  then plays and reads the sim through the debug window: no change in 3 s; Hunt within 60 ticks; 3.5 m in the first
  second of Hunt; the first change is to Search; the Sentry exists at its place and sounds the alarm; Watch lights Hunt and logs
  "0.5 s: guard went from Patrol to Hunt". Screenshots looked at (not committed, `test-results/`): `watch-hunt` shows
  the game beside the diagram with the two figures close and the log's two lines; `5-sentry-alarm` shows the player at
  the sentry's place; the others show the editors after each edit. Mutation check: with sight left at 4.5 step 2 fails.
  Not run: WebKit, Firefox, the GPU runner, parity, `.github/workflows/3d.yml` (this change adds a step for this example's
  `test:e2e` after the base-3d and examples-3d steps; it has not run in CI). Rulings: the puzzle has two facts, `lamp` and `alarm`, because the Sentry preset sets `alarm` and the
  puzzle would refuse an unknown fact (the plan said one) — cost if wrong: one extra fact. The tests for the game were
  written after the game (the plan's Step 1 order), with the mutation check in place of a watched RED. The game's
  `vite.config` relies on the content plugin's own `__AUTOMATA_DEBUG__` (true on the dev server) instead of `debugBuild`.
  The Watch pane needed no change in debug beyond the game installing the debug extension.
- 2026-11-08, found while making the game: (1) the content editors page opened only the sample game, never the game it was served
  on; `openContentSuite` now opens the served checkout and falls back to the sample (tests). (2) The ready-made character
  picker pushed the rail wider than a phone and an iPad rail; fixed with a RED browser layout test
  (`schematic-panel-layout.test.ts`: phone rail 240 px, iPad rail 263 px). (3) `contentEditors` now passes the game's address,
  so Watch works in a served game.
- 2026-11-08, Task 16: sample-page journey done (`extensions/editors`, `pnpm test:e2e`, phone and iPad, Chromium, 2 pass):
  Schematic on the in-memory sample game, the guard's "Sees up to" 4.5 to 7, the first change asks for a title as every
  first change does, "Undo Change what it notices" puts 4.5 back. Its first run failed because the title prompt was
  not answered; that is the page working, not a defect. A unit test now also holds that Schematic's Undo hook is on after
  an edit and puts the number back. The systems README says what Schematic does today, including Watch's need for the
  debug extension and the `fair-play` check convention.
- 2026-11-08, NOT DONE, and why: Task 14 (2D served journey) and the 2D half of Task 8 (`presets-2d.test.ts`) need the
  content-in-play work (spec AF PR #479, Tasks 10 to 15 there), which is not built: a 2D level's characters are not in play
  yet, so a 2D game cannot show a Schematic edit. Fair play in a served game (Task 14 step 6, and the equivalent in
  Task 15) is also not proven: `automata editor` serves `/api` ping, list, file and publish only and has no checks runner, so
  "Check now" has nothing to run there; no example game declares a `fair-play` check or a scene module for the bots.
  Deferred minors: the Home list shows three identically named "Hall" entries (the systems, nav and puzzle files) with no
  hint which is which (core `packages/editor` home list); the served suite page for the content editors shows "Not in this
  build" for Levels 3D and Studio; debug's overlay on a late host install is unchanged.
- 2026-11-08, the gate (Task 16's last step), `pnpm check` run piece by piece because it stops at its first failure:
  `pnpm lint`, `typecheck`, `boundaries` and `style` pass. `pnpm source-names` FAILS on 5 findings in files this branch
  does not touch (`examples/3d/characterkit/characterkit-wardrobe.ts:3`, `examples/3d/wardrobe/wardrobe.extension.ts:3`, three
  lines of `packages/automata/.../SettingsScreen.svelte`); it was failing before this session's work and is for whoever owns
  those files. After it, run by hand: `pnpm knip` (found `examples/2d-story/ship.config.ts` and the 3D story's, and an
  unused export in `guard.view.ts`: the config files are now entries in `knip.jsonc`, the export is gone; clean),
  `pnpm check:changesets` passes, `pnpm test:unit` had one failure, the committed API report for `@automata/editor` (it lacked
  `GameFrame`, exported in Task 11): `pnpm build` then `pnpm api-report --update` added its 6 lines, and the api-report tests
  pass (43). `pnpm api-index --write` could not run (an extension's `dist` is not built here) and is not needed: `editor` is
  private. Not run: WebKit, Firefox, the GPU runner, parity, the 2D journeys (no 2D example is touched), `pnpm agent-skills`.
  Final review: self-review (no subagent tool).
- 2026-11-08, build audit ([`2026-11-08-schematic-build-audit.md`](2026-11-08-schematic-build-audit.md)): 3 high, 9
  medium, 12 low. Played by hand in the served 3D story: a character built from nothing (sight, a stop, a Flee mode, a
  switch) flees in play; the 3D journey reproduced 12 of 12 (Chromium). High: the sight setting's words are the
  reverse of the game's and cannot make boxes block view; Fair play runs in no game; Task 14 and the 2D presets test
  are still to do (#484 now has the 2D story's guard).
- 2026-11-08, fixes for the build audit (Sonnet, inline), on #486 with #484 merged up (`e1ef8350`). Every fix was written
  as a failing test first. Done: H1 (a sight's `wallsOnly` reads as the sim reads it; `sight-boxes.test.ts` in `systems`
  pins the sim); H3 (#484 merged, Task 14 with its served journey `examples/2d-story`, 10 of 10 in Chromium at phone and
  iPad, and the 2D presets test, `presets-2d.test.ts`, 11 tests; the 2D golden hash is unchanged because the noise
  command is registered only when a cast asks for it); M1 (a place rename is one joint step, and Undo follows every
  file a step changed, proved in the 3D journey at phone and iPad); M2 (Fit shows the box where the character starts
  and fits the pane, Smaller goes to 0.85 where labels are still 44 px, Watch scrolls the lit box into view); M3 (Watch
  says "Press Play in the game" first and asks for the debug extension only after 8 s of silence); M4 (the puzzle's facts
  come first, then the file's, then "a new fact…"); M5 (Places opens before any character, and the start page offers
  "Add the first place"); M6 (the inspector lists a character's game code, read only, and the rules page says the design
  notes are kept in the file); M7 (two lines added to "How it decides", each pinned against the interpreter in
  `decide-rules.test.ts`); M8 (`style` and `boundaries` now cover `extensions/editors` and `examples/3d-story`, both
  pass: the 3D story's sim no longer reaches the level file, its features no longer import each other, view and worker
  files are plain kebab-case, its test imports `#src/`). L1 (Home shows one row per scene: `SuiteEditor.homeFiles`), L3
  (the list rows to copy have the puzzles row and `checks = ["content"]`), L4 (copy and a "Fair play: last checked N
  changes ago" status line), L5 (a refusal leaves with its page; the inspector says where a page is edited), L6 (a
  button to Places), L7 (no "not …" in the add menu; the follow's doorways are those the file already uses), L8 (a
  switch with no condition says it switches every time), L9 (wording), L10 (debug README).
  Rulings: pinch and Ctrl-scroll are struck from spec 4.1 (the buttons do the job, a pinch inside a scroll region zooms
  the page, and essential only); a made-up fact exists in the file only, the puzzle's facts are added on the Puzzle page;
  the word "routine" is no longer on the test's list of file words because it is also a mode's name.
  Not done, with reasons: H2 and M9 wait on the Owner. L2 (Levels 3D and Studio read "Not in this build" on the served
  page): not Schematic's. L11: the project-files copy was replaced with this version. L12: `.github/workflows/3d.yml`
  has not run in CI. The `ci.yml` 2D journeys step gained `--filter @af-examples/2d-story` (a workflow change; the
  repository's AGENTS.md calls for the Owner's words only in Plus, but it is flagged in the PR). `create-game`'s 3D template
  has the same sim-reads-the-level pattern M8 fixed in the 3D story; left alone, flagged. `2d-story` is not yet in
  `style` or `boundaries` (it has `.view.ts`, `.extensions.ts` and a `.system.ts` with no system). `pnpm api-index
  --write` fails here on two undocumented exports it does not own (`Picture`, `PROMPT_COPY`), so the cheatsheet is not
  updated. Not run: WebKit, Firefox, the GPU runner, parity.
- 2026-11-08, fixes for the fixes audit (Sonnet, inline), on #497. Each was written test first.
  F1 (the "Boxes and closed doors block its view" setting did nothing: sectors' and level-2d's `sight` are their `walk`):
  Schematic now says "Walls and closed doors block its view" and offers no box setting; `wallsOnly` is kept when the range
  changes; both providers are pinned in `sight-boxes.test.ts` and `systems-2d.test.ts`. F2 (Watch in the 2D story): the story
  installs the debug extension and `examples/2d-story/src/app/step-bus.ts` feeds the bus's `sim.step` from the renderer's
  `apply`; a served journey walks into the guard's sight and sees Hunt light and the log line. M2 (Fit shows one box on a
  phone): not a vertical layout, which was judged too heavy for the size of the problem. The button says "Show the start"
  when the diagram is wider than the screen and a note says to slide it sideways or read the list; pinned in the layout
  tests. F4: the 2D story is in `style`, `--test-imports` and `--features` and passes all three (its `features/level` went
  to `shared/level`, three files were renamed to the role suffixes). L-a to L-e: renaming a place is one whole-table edit that
  keeps the order, Home's first scene is the game's level name, a flee mode no longer offers the fleer itself, the silent-game
  hint waits until someone has gone into the game, and the rules page lists the design notes.
  H2 (the Owner, "A and A": build Fair play for real): `automata editor` serves `POST /api/checks/run` for the ids the
  editor list declares (argv in the checkout, never a shell; a candidate outside the checkout is an error; the list is
  read at start and no browser can write it) and says `checks` in the ping; the page declares the list's checks and runs them
  through the server (`checks-client.ts`, `open-suite-ports.ts`). The 2D story's `fair-play` row runs
  `examples/2d-story/fair-play/check.mjs`, which loads `scene.ts` (the bots' `SystemsScene` over the story's own sim) in
  Vite's module runner and prints the share of tries that held for the two scenarios now in `guard.toml`. A served journey:
  Check now says "Fair: 2 of 2 checks pass"; the guard's sight is cut from 9 to 6 m in Schematic; Check now says "Not fair
  yet" and names the scenario. Ruling: no `systems.pipe.toml`. The pipelines' `automata-pipe` loads a scene module in plain
  Node, which cannot read this story's Vite-only content; a file that cannot load would be a lie. The check reads the guard's
  file as it stands on disk, which is where Schematic writes each change; `candidates` are sent but not read.
  M9 (the Owner): `fleeNode` now skips a place whose route passes within 1.5 m of what is fled from, and keeps the old rule only
  when every route does (cornered). `flee.test.ts`: a stub corridor, and the clinic's own sim, where the runner went to
  0.23 m from the player before and now never nearer than 1.5 m. Not shown in a game made in the editors: the 2D story's
  one-line level cannot make the runner's farthest place lie past the player unless the coward sees 3 m only and wanders by
  its stops, so no journey claims it.
  Two racy journey steps were fixed on the way: the 3D Watch test read the lit box half a second after Hunt, when the guard has
  already caught the player (it now accepts Hunt or Catch), and the two "point a switch elsewhere" steps played before the
  file was written (they now wait for the line). Served journeys in Chromium, phone and iPad: 2D 14 of 14, 3D 14 of 14.
  Not run: WebKit, Firefox, the GPU runner, parity. `pnpm api-index --write` still needs a build here.
