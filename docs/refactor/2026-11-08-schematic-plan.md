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

- [ ] **Step 1: Failing tests:** a rule reads "When … then …, every [n] s", with its design text as "What it is for"; a rule with no conditions reads as its text only and says which switches carry it out when its text names them; a rule's condition menu leaves out what needs a character (the check's `ruleProbeError` and `ruleEffectError` list); Numbers rows are label (the number's name in words), value, range and unit, with the note as help.
- [ ] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit.

### Task 11: Watch

**Files:** `WatchPane.svelte`, `watch-bridge.ts`, `watch-log.ts` (reuse `TunerGame.svelte` by exporting it from `@automata/editor`'s kit, as a separate small commit in `packages/editor` with its own test; the package is private, so no changeset); in `extensions/debug`: `src/features/watch/forward-events.ts` and its wiring in the overlay (H8); tests on both sides.

**Interfaces:** debug: `forwardEvents(bus: BusPort, location: Location, parent: Window): () => void`: reads `af-watch` (an origin) and `events` (comma list) from the page's address; when both are present and `parent !== window`, subscribes to `sim.events` and posts `{ type: 'af-sim-event', name, payload }` for each named event to `parent` with `targetOrigin` = that origin. Editor: `watchBridge(frame: HTMLIFrameElement, gameOrigin: string, on: (event) => void)`.

- [ ] **Step 1: Failing tests:** debug posts nothing unframed, nothing without `af-watch`, never with `*` as the target origin, and only the named events; the editor ignores a message whose source is not the frame's window or whose origin is not the game's; a good `systems.mode` lights the box, flashes the from-to arrow (or the Any-mode arrow), and logs "12.4 s: guard went from Patrol to Hunt"; with no game URL the pane shows the Tuner's line; with the game up but no event within the first restart, the "Ask whoever writes your game's code to add the debug extension" line shows; while the file has problems, the pane says the game is still playing the last version that worked.
- [ ] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit `feat(editors,debug): Watch a character's modes as the game runs`.

### Task 12: Fair play

**Files:** `FairCanvas.svelte`, `fair-words.ts`; tests (with the memory checks port).

- [ ] **Step 1: Failing tests:** scenarios as sentences; thresholds as "at least [70] %"; Check now runs the declared check by id and shows "Fair: 3 of 3 checks pass" or the failing scenario in words; the check is found as a `[[check]]` row no file row names, and a test proves a value edit runs no fair-play check (H9); a result is stale after an edit; no declared check, or no pipelines extension, shows "Fair play needs two things from your game's code: …" with the link.
- [ ] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit.

### Task 13: The puzzle

**Files:** `puzzle/puzzle-pieces.ts` (the puzzle's condition and effect kinds as pieces), `puzzle/solver.worker.ts`, `PuzzleCanvas.svelte`; tests.

- [ ] **Step 1: Failing tests:** items, facts with starting values, actions as "At {hotspot}, using {item}: when …, …", the goal; systemic and lethal entries read as sentences under "How the characters open the way" and "What can kill the player", read only (H10); "Can it be finished?" posts the edited puzzle to the worker, which runs `createSolver(def)` and answers "Yes, in 14 steps" or "No: the player can get stuck after …"; the answer is stale after an edit; the page bundle imports no Node module (a build test).
- [ ] **Steps 2 to 4:** see them fail; implement; pass. **Step 5:** Commit.

### Task 14: Served journey: AI edited in Schematic changes play, 2D

After the merge-up with the content-in-play work. On its `examples/2d-story` (a guard on a patrol between two areas
split by a wall with a gap; the game passes the level's placed characters' points to `loadSystems` by name, and exposes
the sim through its test hook). If that example lacks the start points or the test hook, add them there in this task.
Add to it the fair-play files: a `systems.pipe.toml` and a scene module that reads `content/systems/guard.toml` from
disk on each run, and the `[[check]]` row that runs them.

**Files:** `examples/2d-story/tests/e2e/schematic-in-play.test.ts`; the pipe files above.

- [ ] **Step 1: Failing journey** (Chromium, phone and iPad projects), `automata editor` serving the suite and the game:
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
- [ ] **Step 2:** Pass. **Step 3:** Commit `test(examples): AI edited in Schematic changes a 2D game`.

### Task 15: Served journey: AI edited in Schematic changes play, 3D

No 3D game uses `systems` today. Add the smallest one, private, the shape of a `create-game` 3D game: `examples/3d-story/`
with a level (`content/levels/hall.af-sector.json`, two rooms joined by a doorway, editable in Levels 3D), a nav graph
(`content/nav/hall.toml`, four places), a puzzle file with one fact, `content/systems/hall.toml` (one Guard), its
editor list (Levels 3D, Schematic, the Tuner), and `src/` wiring `sectorsExtension`, `navExtension`, `puzzleExtension`,
`systemsExtension`, `debugExtension` (behind `__AUTOMATA_DEBUG__`, with `installDebug({ bus })`), drawing each agent
as the base figure from 3D core, and a test hook that reads the sim. Its behaviour is code: the player walks with the
template's controls. It moves no other 3D hash, golden or replay.

**Files:** `examples/3d-story/**`; `examples/3d-story/tests/e2e/schematic-in-play-3d.test.ts`.

- [ ] **Step 1: Failing unit test** in the example: a scripted run hashes the same twice in Node; the guard patrols.
- [ ] **Step 2: Failing journey** (Chromium; the GPU runner for the 3D workflow): steps 1 to 5 of Task 14 on this
  game, plus Watch: open Watch, step the player into sight, and the diagram lights Hunt and logs the switch.
- [ ] **Step 3:** Pass; record the scene's hash in Node; report which engines ran. **Step 4:** Commit
  `test(examples): AI edited in Schematic changes a 3D game`.

### Task 16: The sample journey, template, docs and the gate

- [ ] `create-game`'s template `editors.toml` gains the systems, nav and puzzle rows (test in `packages/tools`).
- [ ] Journey on the sample page: open Schematic, change the guard's sight, the file changes, Undo.
- [ ] The systems README gains "Editing characters in Schematic" (where a character starts, places, Watch, Fair
  play's scene module); `docs/refactor/progress.md` and this log updated.
- [ ] `pnpm format`, `pnpm check`; the log below records what ran (Node, Chromium) and what did not (WebKit, Firefox,
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
