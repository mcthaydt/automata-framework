# Schematic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task
> (the project runs plans natively, never with subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schematic, the game's AI editor: every part of a character's behaviour editable, shown as a diagram, watched
running, checked for fairness; and the scene's puzzle.

**Architecture:** A feature folder `extensions/editors/src/features/schematic/` on the shared TOML session
(`shared/toml-session.ts`, `shared/content-session.svelte.ts`). One table of pieces (`pieces.ts`) is the editor's
whole vocabulary of conditions and actions; the diagram's layout is a pure function; the views are Svelte with an SVG
diagram. Fair play and the puzzle solver run as game checks through the suite's checks port (Node); Watch reuses the
Tuner's split view and adds one window message to the debug overlay.

**Tech Stack:** TypeScript 6.0.3, Svelte 5.57.1, Zod 4.6.6, Vitest 5.0.3 (jsdom + Testing Library, Chromium layout).

**Spec:** [`2026-11-08-schematic-spec.md`](2026-11-08-schematic-spec.md), with the shared
[`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md).

## Global Constraints

- The content editors plan's constraints hold (no "Plus", core never imports this package, feature folders, tests in
  `tests/`, 600 lines a file, drunk grandma copy, 44/48 px targets, span-preserving edits, test first).
- No key name on screen: `sawHide`, `warmthWithin`, `followThrough`, `setMode`, `probe`, `transition`, `agent`,
  `routine`, `tunables`, `matrix` never appear in the page's text (a DOM test scans for them).
- The file holds no layout: diagram positions are computed every time.
- A condition or action kind the table lacks stays read only, never dropped or rewritten.
- Watch's message listener checks both `event.source` and `event.origin`.
- Fair play and the solver run in Node through the checks port; the page never imports `@automata/systems/bots` or
  `@automata/puzzle/solver`.

## Review Focus

1. **A converted, very large file** (`clinic`: nine modes, ~60 switches, ~3,000 lines). The diagram and list stay
   usable and an edit rewrites only its literal. Test in Task 3 (layout) and Task 5 (an edit on the clinic fixture
   leaves every other byte).
2. **`from = "*"` switches and self-loops** (`stunned` to `stunned`). Drawn and editable. Test in Task 3.
3. **A rename of a mode** that switches, the start mode and other characters' "is in mode" conditions name. Renaming
   changes every reference in one undo step. Test in Task 6.
4. **A nested `not`** in an old file (`not: { not: … }`). Shown as its sentence, editable to one level, read only
   deeper. Test in Task 1.
5. **A game without the systems, debug or pipelines extension.** Each missing one says what to add; nothing falls back
   silently. Tests in Tasks 4, 10 and 11.

---

### Task 1: The conditions table

**Files:** create `src/features/schematic/pieces/conditions.ts`, `src/features/schematic/pieces/piece.ts`; test
`tests/unit/schematic/conditions.test.ts`.

**Interfaces:**
- Produces: `interface Piece<V> { kind: string; group: 'notices' | 'where' | 'true' | 'time' | 'does'; matches(value: unknown): value is V; words(value: V, names: Names): string; fields(value: V, names: Names): Field[]; write(value: V, key: string, next: unknown): V; fresh(names: Names): V }`; `interface Names { modes: string[]; agents: string[]; facts: string[]; places: string[]; hooks: string[] }`; `CONDITIONS: readonly Piece<Probe>[]` (12 rows, in the spec's order); `conditionPiece(probe: unknown): Piece<Probe> | undefined`; `conditionWords(probe: Probe, names: Names): string` (handles `not` as "does not …"; a second `not` reads "not (…)", read only).
- Consumes: `Field` from `shared/fields.ts`; `Probe` from `@automata/systems/sim`.

- [ ] **Step 1: Failing tests**, one `it` per kind: `{ sees: true }` reads "sees the player"; `{ heard: 'shriek', reach: 6 }` "hears a shriek within 6 m" (fields Kind of noise, Within m); `{ heard: 'step' }` "hears a step from anywhere"; `{ inLight: true, radius: 2 }` "is in light (within 2 m)"; `{ warmthWithin: 3 }` "is within 3 m of warmth"; `{ touching: true }` "is touching the player"; `{ fact: 'power.on', is: true }` "power on is yes"; `{ mode: 'hunt', agent: 'nurse' }` "nurse is hunting"… (exact copy: "nurse is in hunt"); `{ at: 'bedside' }` "is at bedside"; `{ timer: 8 }` "has waited more than 8 s"; `{ crossed: true }` "the player crossed a door"; `{ sawHide: { radius: 4, los: true } }` "saw the player hide within 4 m, in sight"; `{ not: { sees: true } }` "does not see the player"; each `fresh()` passes `probeSchema`; each `write` then `matches` round-trips.
- [ ] **Step 2–4:** run, implement, pass. **Step 5:** commit `feat(editors): Schematic's conditions`.

### Task 2: The actions table

**Files:** `src/features/schematic/pieces/actions.ts`; test `tests/unit/schematic/actions.test.ts`.

**Interfaces:** `ACTIONS: readonly Piece<SysEffect>[]` (9 rows); `actionWords(effect, names): string`.

- [ ] Tests first, one per kind: `{ setMode: 'hunt' }` "switch to hunt"; `{ setMode: 'patrol', agent: 'porter' }` "switch porter to patrol"; `{ goTo: 'bedside' }` "go to bedside"; `{ goTo: { x: 1, z: 2 } }` "go to the point 1, 2"; `{ flee: 'light' }` "run from light"; `{ noise: { at: 'self', loudness: 6, kind: 'shriek' } }` "make a shriek noise here, loudness 6"; `{ set: 'self.timer', to: 0 }` "set timer to 0" (a `self.` fact reads as "its"); `{ emit: { cutscene: 'caught' } }` "play the cutscene caught"; `{ emit: { line: 'l1' } }` "say the line l1"; `{ emit: { caught: 'ada' } }` "catch the player"; `{ call: 'chase' }` "run the game's chase"; `followThrough` "follow the player through {portal} after {delay} s, then {then}"; `ambush` "lie in wait at {at} as {mode}…". Fresh passes `effectSchema`. Implement, commit `feat(editors): Schematic's actions`.

### Task 3: The diagram's layout

**Files:** `src/features/schematic/diagram/layout.ts`; test `tests/unit/schematic/layout.test.ts`.

**Interfaces:** `layoutAgent(agent: AgentDef, size: { box: { w: number; h: number }; gap: number }): Diagram` with `Diagram = { boxes: Box[]; arrows: Arrow[]; width: number; height: number }`, `Box = { mode: string | '*'; x: number; y: number; w: number; h: number; start: boolean }`, `Arrow = { from: string; to: string; switches: number[]; loop: boolean; points: [number, number][] }`.

- [ ] Tests first: columns by breadth-first distance from `initial`; unreachable modes in a last column; `*` box first when any `from = "*"`; a self switch is `loop: true`; two switches between the same pair share one arrow with both indices; on the `clinic`, `bay` and `prologue` fixtures no two boxes overlap and every switch index appears in exactly one arrow. Implement (orthogonal arrows, no external library), commit `feat(editors): Schematic's diagram layout`.

### Task 4: Session, suite editor, panel and the start pages

**Files:** `schematic-session.svelte.ts`, `schematic-suite-editor.ts`, `SchematicRegions.svelte`, `SchematicPanel.svelte`, `SchematicStart.svelte`; `src/app/suite/content-editors.ts` (add `createSchematic()` after Feel and Audio's place); sample `src/app/suite/sample/systems.toml` (one Guard) and its list row; test `tests/unit/schematic/schematic-editor.test.ts`.

**Interfaces:** `createSchematic(options: { gameUrl?: string }): SuiteEditor<SchematicSession>`; `SchematicChoice = { kind: 'character'; index: number } | { kind: 'rules' } | { kind: 'numbers' } | { kind: 'fair' } | { kind: 'puzzle' }`; the session holds one `TomlSession<SystemsDef>` per scene file (opened on choosing the scene) and the scene's puzzle session when it has one. The schema is `systemsDefShape` (no hook cross-check in the editor: the hook list is the game's code; the content check reports a missing hook).

- [ ] Tests first: panel lists scenes, Characters by name, World rules, Numbers, Fair play, Puzzle (only with a puzzle file); no systems file shows "This scene has no characters yet." and "Add a character"; a list without the systems row shows the row to add; copy scan for the banned words. Implement, commit `feat(editors): Schematic's frame`.

### Task 5: The diagram and the list of switches

**Files:** `diagram/Diagram.svelte` (SVG, every box and label a `<button>`-role element with a name), `SwitchList.svelte`, `CharacterCanvas.svelte` (Diagram and List tabs on a phone, stacked wider); tests `tests/unit/schematic/diagram.test.ts`, `tests/browser/schematic-layout.test.ts` (Chromium, 390x844 and 820x1180).

- [ ] Tests first: selecting a box selects the mode in the session; an arrow's label is its first condition and "and N more"; the list is "Checked first" to "Checked last" by priority; an edit made through the inspector on the clinic fixture changes only its literal (compare the rest byte for byte); Fit, pan and pinch keep targets at 44 px (layout test). Implement, commit `feat(editors): Schematic's diagram and list`.

### Task 6: The inspector: modes and switches

**Files:** `ModeInspector.svelte`, `SwitchInspector.svelte`, `PieceRow.svelte` (a sentence with its fields, built from a `Piece`), `AddPiece.svelte` (the grouped menu); `schematic-edits.ts` (rename a mode everywhere, reorder switches by rewriting priorities, add and remove a switch); tests `tests/unit/schematic/schematic-edits.test.ts`, `tests/unit/schematic/inspector.test.ts`.

**Interfaces:** `renameModeEdits(def: SystemsDef, agent: number, from: string, to: string): ContentEdit[]` (modes, initial, speed key, every transition's from/to, `setMode` actions and `mode` conditions naming it for that agent, routine mode); `reorderEdits(agent: AgentDef, index: number, to: number, agentIndex: number): ContentEdit[]` (priorities rewritten as descending tens, only those that change).

- [ ] Tests first: rename touches every reference in one undo step; reorder keeps relative order of the others; "Not" toggles `{ not }` around a condition; removing the last condition leaves `when = []` ("always"); adding each kind from the menu passes the schema. Implement, commit `feat(editors): Schematic's inspector`.

### Task 7: Senses and patrol

**Files:** `CharacterInspector.svelte`, `senses.ts`, `patrol.ts`; tests.

- [ ] Tests first: each sense as a sentence with fields ("Sees up to 4.5 m, through walls only: yes"); add and remove a sense; patrol stops in order with "Waits [3] s" and actions (Task 2's pieces); a stop picks a place from the nav graph's named nodes (read through the workspace, `content/nav/<scene>.toml`); a missing nav file says "Name places in the scene's nav graph to use them here." Implement, commit.

### Task 8: Ready-made behaviours

**Files:** `presets.ts` (Guard, Sentry, Hunter, Coward, Wanderer as `AgentDef` data with words), `AddCharacter.svelte`; tests.

- [ ] Tests first: each preset passes `systemsDefShape` inside a minimal def; adding one writes an `[[agents]]` table with a unique id ("guard-2"); the sheet describes each in one line. Implement, commit.

### Task 9: World rules and Numbers

**Files:** `RulesCanvas.svelte`, `NumbersCanvas.svelte`; tests.

- [ ] Tests first: a rule reads "When … then …, every [n] s", with its design text as "What it is for"; a rule with no conditions reads as its text only and says which switches carry it out when its text names them; Numbers rows are label (the tunable's key in words), value, range and unit, with the note as help. Implement, commit.

### Task 10: Watch

**Files:** `WatchPane.svelte` (the Tuner's split view; reuse `TunerGame.svelte` by moving its game frame to the kit if
needed, as a separate small commit in `packages/editor` with its own test); in `extensions/debug`: post
`{ type: 'af-systems-mode', agent, mode, switch }` to `window.parent` on each mode change (test there); the editor
listens with source and origin checks; tests for both sides.

- [ ] Tests first: a message from another window or origin is ignored; a good one lights the box and flashes the
  arrow; no game URL shows "Open your game with automata editor to watch it run."; no debug overlay shows its hint.
  Implement, commit.

### Task 11: Fair play

**Files:** `FairCanvas.svelte`, `fair-words.ts`; the `create-game` template list gains the check row; tests.

- [ ] Tests first (with the memory checks port): scenarios as sentences; thresholds as "at least [70] %"; Check now
  runs the declared check and shows "Fair: 3 of 3 checks pass" or the failing scenario in words; a result is stale
  after an edit; no declared check shows how to add it. Implement, commit.

### Task 12: The puzzle

**Files:** `puzzle/puzzle-pieces.ts` (the puzzle's condition and effect kinds as pieces), `PuzzleCanvas.svelte`; tests.

- [ ] Tests first: items, facts with starting values, actions as "At {hotspot}, using {item}: when …, …", the goal;
  "Can it be finished?" runs the declared solver check and reads its result in words. Implement, commit.

### Task 13: Journeys, template and docs

- [ ] `create-game`'s template `editors.toml` gains the systems and puzzle rows (test in `packages/tools`).
- [ ] Journey on the sample page: open Schematic, change the guard's sight, the file changes, Undo.
- [ ] `pnpm format`, `pnpm check`; the log below records what ran and what did not.

## Log

(Each session records what it did here, with evidence.)
