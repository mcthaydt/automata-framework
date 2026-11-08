# Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (no
> subagents in this project). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sequence edits a cutscene as a timeline of tracks and keys, with a scrubbable plan preview from the director
and the lint's findings in words.

**Architecture:** `extensions/editors/src/features/sequence`: one `ContentSession<CutsceneScript, Selection>` per
cutscene file; pure model files (`tracks.ts` rows and marks, `key-edits.ts` edits, `plan-view.ts` drawing data from
`stateAt`); Svelte regions for the timeline, the preview and the inspector.

**Tech Stack:** Svelte 5 runes, Vitest 5 (jsdom, Testing Library, pointer events), Zod 4,
`@automata/cutscenes` (schema and `/director`).

**Spec:** [`2026-11-08-sequence-spec.md`](2026-11-08-sequence-spec.md), with the shared
[`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md).

**Audit:** [`2026-11-08-sequence-plan-audit.md`](2026-11-08-sequence-plan-audit.md) (S1 to S10, fixed below). Task 7
was added by it: a cutscene edited here must be seen in play.

## Global Constraints

- The content editors plan's constraints hold (no "Plus", core never imports this package, feature folders, tests in
  `tests/`, 600 lines a file, drunk grandma copy, 44/48 px targets, span-preserving edits, test first).
- Words are the spec's section 4 table, verbatim. No key name on screen (`pos`, `look`, `alpha`, `lintAllow`, `t`).
- A key's time snaps to 0.1 s, stays within 0 and the scene's length, and stays between its neighbours on its row: the
  schema refuses a camera key before the one before it, and an actor key before that actor's previous one (audit S2).
- Not every track keys by `t`: `cues` use `at`, `shake` is `[from, to, metres]`, `flicker` `[from, to]`, a caption has
  `t` and `until`. Every time edit goes through `tracks.ts`'s accessors (audit S3).
- The page imports `@automata/cutscenes/director`, the schema and the tools' constants (`MIN_SHOT`); it runs no lint and
  uses no checks port (there is no cutscenes pipeline, and the lint needs a 3D map; audit S5).
- A cutscene names no scene or level. Names come from the whole game (audit S6), and the preview's walls from a 2D level
  the person picks, read from its file (audit S7). A 3D game's preview says "Walls show for 2D levels only, for now."
- Sounds are not offered: nothing plays a cutscene's sound keys (audit S4). A file that has them shows the row read
  only, "Sounds in cutscenes don't play yet."
- What a person changes in Sequence is seen in play, in a served journey (the Owner, 2026-11-08): Task 7. A journey
  step that could not run is left unchecked and named, never replaced by writing the file directly.

## Review Focus

1. **Two keys at the same time on one row.** Both shown (side by side), each selectable; dragging one does not move the
   other. Test in Task 2.
2. **A drag that ends where it started.** No write and no undo step. Test in Task 3.
3. **Shortening the scene below its keys.** Asks first: "3 steps are after the new end. Remove them?" Test in Task 3.
4. **A caption whose line was removed in Writer.** Kept, shown as "This step's words were removed.", and the preview
   shows nothing for it. Test in Task 4.
5. **A camera key dragged past the next one.** It stops at the next key's time; the file stays valid. Test in Task 3.
6. **Retiming a cue or a shake.** A cue writes `at`; a shake's start writes index 0 and its end index 1. Test in Task 3.
7. **A scene that uses a 3D-only track in a 2D game.** The row shows "Only in 3D games" and the key still edits. Test in
   Task 2.

---

### Task 1: Session, panel and start pages

**Files:**

- Create: `sequence-session.svelte.ts`, `sequence-suite-editor.ts`, `SequencePanel.svelte`, `SequenceRegions.svelte`
  under `extensions/editors/src/features/sequence`; `sample/cutscene.toml`
- Modify: `content-editors.ts`, `sample/editors.toml`; `extensions/editors/package.json` (add `@automata/cutscenes`,
  and `@automata/3d`, whose `timeline` the cutscene schema imports for `easeSchema`; audit S8)
- Test: `tests/unit/sequence/sequence-editor.test.ts`

**Interfaces:**

- Produces: `createSequence(): SuiteEditor<SequenceSession>` (id `sequence`, label `Sequence`); `SequenceSession`
  holds the chosen file's `ContentSession<CutsceneScript, Selection>`, `playhead: number` (`$state`), `is2d: boolean`
  (from the editor list's rows: a game with a `levels-2d` row and no `levels-3d` row); `type Selection = { track:
TrackId; index: number } | undefined`; `addCutsceneEdit(id: string, duration: number): string` (the new file's text).

- [ ] **Step 1: Write the failing DOM tests:** no cutscenes → "This game has no cutscenes yet." and **Add a
  cutscene** (asks a name and a length, writes `content/cutscenes/<id>.toml` with one camera key at 0); a file with a
  mistake opens read only; the list shows each cutscene's name.
- [ ] **Step 2–4: Run, implement, run.**
- [ ] **Step 5: Commit** `feat(editors): Sequence opens and starts cutscenes`.

### Task 2: Tracks, rows and marks

**Files:**

- Create: `tracks.ts`, `SequenceTimeline.svelte`
- Test: `tests/unit/sequence/tracks.test.ts`

**Interfaces:**

- Produces: `type TrackId = 'camera' | 'actor' | 'caption' | 'sound' | 'light' | 'doors' | 'time' | 'grade' | 'props' |
'cues' | 'shake' | 'flicker' | 'fade' | 'states'`; `rows(script: CutsceneScript, is2d: boolean): Row[]` where
  `Row = { id: string; words: string; track: TrackId; who?: string; only3d: boolean; marks: Mark[] }` and `Mark = {
index: number; t: number; until?: number; lane: number }` (an actor's keys get a row per `who`; a second mark at the
  same `t` gets lane 1); `TRACK_WORDS`; `timeOf(track, key): number`, `endOf(track, key): number | undefined` and
  `timePath(track, index, end?: boolean): (string | number)[]` (`cues` → `at`; `shake`, `flicker` → index 0, end index
  1; `caption` end → `until`; the rest `t`). The `sound` track is listed read only and `Add a row` never offers it;
  `states` and `lintAllow` are not rows.

- [ ] **Step 1: Write the failing tests** with Review Focus 1 and 5, and rows in the spec's order.
- [ ] **Step 2–4: Run, implement, run.** The timeline draws the ruler, rows with pinned names, and marks (44 px
  targets), and scrolls sideways in its own region.
- [ ] **Step 5: Commit** `feat(editors): Sequence's timeline`.

### Task 3: Key edits, drag and the playhead

**Files:**

- Create: `key-edits.ts`
- Modify: `SequenceTimeline.svelte`
- Test: `tests/unit/sequence/key-edits.test.ts`, `sequence-editor.test.ts`

**Interfaces:**

- Produces: `snap(t: number, duration: number): number`; `bounds(script, track, index): [number, number]` (the
  neighbours on its row for camera and per-`who` actor keys, else 0 and the length); `retimeEdit(track, index, before:
number, t: number): ContentEdit | undefined` (clamped to `bounds`, written at `timePath`; undefined when unchanged); `addKeyEdits(script, track, t, state: SceneState, who?:
string): ContentEdit[]` (values from the director's state at `t`); `removeKeyEdit`; `durationEdits(script, length):
{ edits: ContentEdit[]; dropped: number }`.

- [ ] **Step 1: Write the failing tests** with Review Focus 2, 3, 6 and 7; dragging with pointer events (4 px threshold)
  writes one `t` edit in one undo step; **Move to the playhead**; **Add here** on the camera row copies the camera's
  pose at the playhead.
- [ ] **Step 2–4: Run, implement, run.** Play advances the playhead with an injected clock (`requestAnimationFrame` in
  the page).
- [ ] **Step 5: Commit** `feat(editors): Sequence moves and adds steps in time`.

### Task 4: The inspector

**Files:**

- Create: `key-fields.ts`, `SequenceInspector.svelte`
- Test: `tests/unit/sequence/key-fields.test.ts`, `sequence-editor.test.ts`

**Interfaces:**

- Produces: `keyFields(track: TrackId, key: unknown, names: SequenceNames): Field[]` with the spec section 4 words;
  `SequenceNames = { lines: { id: string; words: string; file: string }[]; actors: string[]; anchors: string[];
clips: Record<string, string[]>; lamps: string[]; doors: string[] }`, read on open from the whole game: every
  `content/lines/*.toml` (shown by their words, grouped by file), the names of placed items with a `name` in the game's
  2D levels (content-in-play Task 14 matches an actor's `who` to that name) and the names the file already uses;
  anchors are `player`, `actor:<who>` and the names in use; `namesProblem(field, value, names): string | undefined`
  ("This step's words were removed." for a line, never its id). A camera or door key whose `ease` is a curve shows
  "Moves (its own curve)" and keeps it; **Moves smoothly** removes `ease` (audit S9).

- [ ] **Step 1: Write the failing tests** with Review Focus 4; a caption's line is picked by its words; the lens shows
  "wide" at 28 mm; the rare actor fields sit under **More**.
- [ ] **Step 2–4: Run, implement, run.** At phone width the inspector is a sheet over the timeline when a key is
  selected; it keeps focus through rotation.
- [ ] **Step 5: Commit** `feat(editors): Sequence's step fields`.

### Task 5: The plan preview

**Files:**

- Create: `plan-view.ts`, `SequencePreview.svelte`
- Test: `tests/unit/sequence/plan-view.test.ts`

**Interfaces:**

- Consumes: `createDirector`, `SceneState` from `@automata/cutscenes/director`.
- Produces: `levelWalls(level: string): Promise<Segment[]>` (the solid cells of a 2D level's collision layer, read
  from its file through `workspace.read` with the readers content-in-play Task 11 uses, one metre a cell; the person
  picks the level once, "Show over: Hall", kept in the session only); `planView(state: SceneState, walls: readonly
Segment[], size: { w: number; h: number }): { actors: {
name: string; x: number; y: number; facing: number }[]; camera: { x: number; y: number; angle: number; spread: number
}; caption?: string; fade: number; walls: Segment[] }` (fitted to the size with a margin); `Segment = readonly [number,
number, number, number]`.

- [ ] **Step 1: Write the failing tests:** an actor at x 2, z 3 lands where the fit puts it; the camera wedge points from
  `pos` to `look` and its spread follows the lens (`fovOf`); fade 1 at the end of a fade key; a 2×2 level with one solid
  cell gives that cell's four walls; a 3D game gives no walls and the words in the Global Constraints.
- [ ] **Step 2–4: Run, implement, run.**
- [ ] **Step 5: Commit** `feat(editors): Sequence's preview from above`.

### Task 6: Checks, layout, template, records

- [ ] **What is wrong**, computed in the page from the file and the game's lines (`scene-problems.ts`): a caption's
  line is missing or has no words, two captions overlap, a step after the end, a shot shorter than a second
  (`MIN_SHOT`; camera keys at one time are a cut, not a shot). Shown in the spec's section 3.7 words on their mark or
  bar. Unit test each.
- [ ] Chromium layout test at 390×844 and 820×1180; screens to the project files, looked at before they are kept.
- [ ] Add Sequence's row to the create-game template `editors.toml` (`content/cutscenes/*.toml`).
- [ ] `pnpm format`, the package's `test:unit` and `typecheck`, `pnpm boundaries`; Log entry below; a line in
  `docs/refactor/progress.md`; say what did not run.

### Task 7: A cutscene edited in Sequence shows in play (served journey)

The proof is content-in-play Task 16's journey in `examples/2d-story`. Its Sequence step as first written ("changes
the caption to 'Later, at the gate.'") cannot be done in Sequence, which picks a caption's line and never edits its
words (audit S1); this is the step the journey runs.

- [ ] **Step 1: Served journey** (Chromium, phone and iPad projects): `automata editor` in the example. In the suite,
  open Writer and add a caption line "Later, at the gate." (said by no one); Save. Open Sequence, open the gate
  cutscene, pick that line for its caption by its words, drag the caption to start at 1 s, move the keeper's last key
  one cell further; Save. Press **Play**, walk into the keeper, choose the second answer: the caption "Later, at the
  gate." shows above the box's place and the keeper walks to the new spot. Assert in the DOM and through the test
  hook; look at the screenshots and explain them in the log.
- [ ] **Step 2:** If `examples/2d-story` has not landed, leave this step unchecked, say so in the log and the PR, and
  do not count Sequence as done. Never write the TOML directly and count it as edited.
- [ ] **Step 3: Commit** `test(examples): a cutscene edited in Sequence shows in play`.

## Log

(Each session records what it did here, with evidence.)

**2026-11-08, build session (Sonnet, inline, no subagent).** Branch `claude/project-thread-2salzc`, stacked on #478.

- Tasks 1 to 5 built, test first, in `extensions/editors/src/features/sequence`: `tracks.ts` (rows, marks, lanes, 3D-only
  rows in a 2D game, Sounds read only), `key-edits.ts` (snap, bounds, retime, move, add at the playhead from the
  director's state, remove, shorten with a count), `key-fields.ts` (the spec's section 4 words, Arrives with "Moves (its
  own curve)" kept, a caption's line by its words, a removed line named "This step's words were removed.", rare actor
  fields under More), `plan-view.ts` (walls from a 2D level's collision layer, dots, camera wedge, fade), the session and
  the Svelte regions (panel, timeline with pointer drag and a 4 px threshold, preview, inspector as a sheet on a phone,
  Add a row, Add here, Move to the playhead, Play with an injected clock). 52 unit tests in `tests/unit/sequence/`.
- Task 6, partly: `scene-problems.ts` says a missing or empty line, overlapping words, a step after the end and a
  short shot, with unit tests; the create-game template row and the sample file are in. **Not done:** the Chromium layout
  test at 390x844 and 820x1180, and the screens (no browser project in the package yet; Feel's Task 4 owns adding it).
- **Task 7 (served journey) not done and not counted:** `examples/2d-story` has not landed. The Sequence step of
  content-in-play's journey stays unchecked. Nothing was written to a file directly to stand in for it.
- Rulings: (1) a bar that would start at the new end has no length left, so shortening drops it and counts it; (2) an
  actor's `facing` is radians in the file (the director moves x by cos and z by -sin), so the dial shows degrees and
  writes radians; (3) a lens in the file is read as written, "wide" under 35 mm and "close" over 70 mm; (4) a
  cutscene's clip names come from the cues the game's cutscenes already use, since no source of a figure's clips exists
  yet; (5) the preview resolves `player` and named places to a placed character's cell (16 px a metre) or the origin.
- Ran: `pnpm --filter @automata/editors test:unit` (all pass), `typecheck`, `pnpm boundaries`, `pnpm style`, `pnpm knip`.
  Did not run: WebKit, Firefox, any browser test, any journey.
