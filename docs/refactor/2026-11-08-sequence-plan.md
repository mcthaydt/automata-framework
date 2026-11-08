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

## Global Constraints

- The content editors plan's constraints hold (no "Plus", core never imports this package, feature folders, tests in
  `tests/`, 600 lines a file, drunk grandma copy, 44/48 px targets, span-preserving edits, test first).
- Words are the spec's section 4 table, verbatim. No key name on screen (`pos`, `look`, `alpha`, `lintAllow`, `t`).
- A key's time snaps to 0.1 s and stays within 0 and the scene's length.
- The lint runs in Node through the checks port; the page imports only `@automata/cutscenes/director` and the schema.
- The preview reads the world through the same `places` data the content-in-play plan gives the lint; until that
  lands it draws no walls and says "The level's walls show once the game is built."

## Review Focus

1. **Two keys at the same time on one row.** Both shown (side by side), each selectable; dragging one does not move the
   other. Test in Task 2.
2. **A drag that ends where it started.** No write and no undo step. Test in Task 3.
3. **Shortening the scene below its keys.** Asks first: "3 steps are after the new end. Remove them?" Test in Task 3.
4. **A caption whose line was removed in Writer.** Kept, shown as "There is no line shop.thanks yet.", and the preview
   shows nothing for it. Test in Task 4.
5. **A scene that uses a 3D-only track in a 2D game.** The row shows "Only in 3D games" and the key still edits. Test in
   Task 2.

---

### Task 1: Session, panel and start pages

**Files:**
- Create: `sequence-session.svelte.ts`, `sequence-suite-editor.ts`, `SequencePanel.svelte`, `SequenceRegions.svelte`
  under `extensions/editors/src/features/sequence`; `sample/cutscene.toml`
- Modify: `content-editors.ts`, `sample/editors.toml`
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
  same `t` gets lane 1); `TRACK_WORDS`.

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
- Produces: `snap(t: number, duration: number): number`; `retimeEdit(track, index, before: number, t: number):
  ContentEdit | undefined` (undefined when unchanged); `addKeyEdits(script, track, t, state: SceneState, who?:
  string): ContentEdit[]` (values from the director's state at `t`); `removeKeyEdit`; `durationEdits(script, length):
  { edits: ContentEdit[]; dropped: number }`.

- [ ] **Step 1: Write the failing tests** with Review Focus 2 and 3; dragging with pointer events (4 px threshold)
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
  `SequenceNames = { lines: { id: string; words: string }[]; actors: string[]; anchors: string[]; sounds: string[];
  clips: Record<string, string[]>; lamps: string[]; doors: string[] }`, read on open from the scene's lines (with
  `words`), the editor list's files and the game's audio file; `namesProblem(field, value, names): string | undefined`.

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
- Produces: `planView(state: SceneState, walls: readonly Segment[], size: { w: number; h: number }): { actors: {
  name: string; x: number; y: number; facing: number }[]; camera: { x: number; y: number; angle: number; spread: number
  }; caption?: string; fade: number; walls: Segment[] }` (fitted to the size with a margin); `Segment = readonly [number,
  number, number, number]`.

- [ ] **Step 1: Write the failing tests:** an actor at x 2, z 3 lands where the fit puts it; the camera wedge points from
  `pos` to `look` and its spread follows the lens (`fovOf`); fade 1 at the end of a fade key; no walls → the words in the
  Global Constraints.
- [ ] **Step 2–4: Run, implement, run.**
- [ ] **Step 5: Commit** `feat(editors): Sequence's preview from above`.

### Task 6: Checks, layout, template, records

- [ ] **Check the scene**: the cutscenes lint as an `after` check through the checks port; findings in the spec's
  section 3.7 words on their mark or bar; marked out of date after a change. Unit test the words.
- [ ] Chromium layout test at 390×844 and 820×1180; screens to the project files, looked at before they are kept.
- [ ] Add Sequence's row to the create-game template `editors.toml` (`content/cutscenes/*.toml`).
- [ ] `pnpm format`, the package's `test:unit` and `typecheck`, `pnpm boundaries`; Log entry below; a line in
  `docs/refactor/progress.md`; say what did not run.

## Log

(Each session records what it did here, with evidence.)
