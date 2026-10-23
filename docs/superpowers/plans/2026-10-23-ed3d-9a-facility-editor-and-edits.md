# ED3D.9a Facility editor and the World edits: TDD plan

- **Task:** ED3D.9, first part (headless). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.2 (document and selection), §5.3 flow 6 (World), §5.4 (World commands `wing.move`, `join.set`, `join.remove`, `lock.set`), §6 (the World view's edits), §11 (facility file missing or invalid) and acceptance case ED3-i (the offset half). The `facility.json` document as an editor of its own (its own `History` and `Selection`) and the four edits the World view calls, each one undo step, with the sentences a refusal gives. Plain TypeScript: no Svelte, DOM, Pixi or clock.
- **Lane:** editor-3d. **Depends on:** ED3D.1 (merged: `facilityCodec`, `facilitySchema`) and the kit's `History` and `Selection` (merged). It does not wait on the view stack or the entity line: nothing here touches a level, a tool or a pointer. Branch `claude/project-thread-39g5i1-ed3d-9a` is cut from `main` (9514d52f), so the PR targets `main`.
- **Status:** Drafted 2026-10-23 19:20 UTC by the lane's successor thread, on the standing go-ahead to keep building while the stacks wait (hub overnight mode, bus 0850). Not reviewed; spec review (ED3D.0) is still open. The choices below are the agent's and vetoable. Steps are ticked only when their checks pass.
- **Progress:** 0 of 5 steps.

## Why this task exists

The World view moves a wing, edits a join and edits a lock, and each of those has to be undoable, selectable and refuse what the file cannot hold. The rules for that are not drawing rules: they are rules about a file of wings, joins, phases and locks, and they are easiest to get right, and to test against the shipped `facility.json`, without a screen. This task builds the model once so that ED3D.9c (the World view's controller) and the Svelte cards after it only forward taps to it.

## Sources, read at these commits

- **AF (`main` at 9514d52f):** `format/facility.schema.ts` (`Facility`, `FacilityWing`, `FacilityJoin`, `JoinSide`, `FacilityPhase`, `FacilityLock`, the loose objects that keep unknown members), `profile/last-light-codecs.ts` (`facilityCodec`, its member orders), `model/level-editor.ts` (the shape this editor follows), `model/edit.ts` (`EditResult`, `ok`, `refuse`), `codec/print.ts` (`roundJsonNumber`), the shipped `testing/fixtures/facility.json` (two wings, `clinic` and `bay`; four joins; four phases; twenty locks; recorded from The Last Light at 92e6704).
- **Spec:** §5.3 flow 6 ("Moving a wing, adding a join or editing a lock is a `facility.json` edit through the same codec") and ED3-i.

## Scope

**In:** `src/model/facility-selection.ts` (selection ids for the World), `src/model/facility-editor.ts` (`FacilityEdit`, `createFacilityEditor`), `src/model/facility-edits.ts` (`moveWing`, `setJoin`, `removeJoin`, `setLock`) and their tests; the package entry exports them; a comment in `level-state.ts` that the facility has its own editor.

**Out, with where each goes:**

| What | Where |
|---|---|
| The checks of the facility (every id resolves, a join's two sides line up in the world once the wings' offsets are applied, a lock's door exists in the room's level) and "joins checks re-run" after a wing move (ED3-i, second half) | ED3D.9b. The alignment rule needs the rooms' geometry from the levels the facility names (the World view holds several levels, the editor opens one), and Last Light's own lint for it (`scripts/pipeline/facility-lib.ts`) is not vendored. It is written from that source's tests once a copy is in the repo, not guessed here |
| What a join side's `door`, `opening` or `wall` names inside a level | ED3D.9b, for the same reason. Here a side is checked against the facility itself only: its phase exists and lists the room |
| The World view's controller (cards, wing drag, join and lock selection, opening a level) and its painting | ED3D.9c, and the Svelte shell (ED3D.5b) |
| Adding, renaming and removing wings and phases, editing the street, a phase's doors and exit | not in spec §5.4's World group; the facility's skeleton is edited in the file for now |
| Saving: `facilityCodec.patch` writes the change; the document session and its journal are the kit's (EDK.5) | the shell, ED3D.5b |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **The facility is an editor of its own, with its own `History`.** Spec §4.2 puts `facility?` in the level's `History` state. The kit's storage (EDK.5) keeps the known `mtime`, the autosave journal, the dirty mark and the conflict dialog per document, and the facility is a file apart from every level, so one `History` per file keeps undo, dirty and recovery honest: undo in World undoes the facility, undo in Plan undoes the level. The level editor is untouched, so this lands beside the stacks without a merge.
2. **An edit is the level editor's protocol over a facility:** `{ id, label, coalesce?, run(facility) }` answering `EditResult<Facility>` (`ok(facility, select?)`, `refuse(reason, at?)`; the new facility is in the result's `level` member, the name the shared result type has). A refusal changes nothing; a result that is the facility it was given changes nothing and records nothing. `run` applies one step, `begin` opens a session for a drag (live while open, one step on commit), as `LevelEditor`.
3. **Selection ids for the World are `wing:<id>`, `join:<id>`, `lock:<id>` and `phase:<id>`** (the same `kind:name` form as the level's; a name may hold neither `:` nor `/`, so a file's id that does is edited but cannot be selected, and an edit that would add one is refused). The selection drops ids that a change removed. A new join or lock is selected.
4. **`wing.move` takes the new offset,** `[x, y, z]` metres rounded to four decimals as the codec prints them, so the model an edit makes is the model a save reads back; a drag is a session and a stepper nudge uses the coalesce key `wing.move:<id>`. A wing cannot be moved to a number that is not finite.
5. **`join.set` and `lock.set` add or replace by id,** in place when it exists and at the end when it does not, and take the whole join or lock (the caller spreads the one it has, which carries the members it does not know). A join needs two different sides; a side of a phase names a phase of the facility that lists the room (in `rooms` or `seen`) and, for a wall, a whole number from 0; a street side is always fine. A lock needs at least one phase, every phase must exist, and `at` must name something. These are the rules the facility file alone can judge; the rest is ED3D.9b.
6. **Removing a join is `join.remove`; removing a lock is not a World command** (a phase's `doors` names locks by id, and what to do with them is a decision for the checks, ED3D.9b).

## Contract

```
packages/editor-3d/src/model/facility-selection.ts    facilitySelection, parseFacilitySelection, FacilitySelectionRef
packages/editor-3d/src/model/facility-editor.ts       FacilityEdit, FacilityState, FacilityEditor, FacilitySession, createFacilityEditor, FacilityEditorOptions
packages/editor-3d/src/model/facility-edits.ts        moveWing, setJoin, removeJoin, setLock, MoveWingArgs
packages/editor-3d/src/index.ts                       the public entry gains all of these
```

```ts
// facility-selection.ts
export type FacilitySelectionRef = { readonly kind: 'wing' | 'join' | 'lock' | 'phase'; readonly id: string }
/** `wing:bay`; throws SelectionIdError for an id that is empty or holds ":" or "/". */
export function facilitySelection(kind: FacilitySelectionRef['kind'], id: string): string
export function parseFacilitySelection(id: string): FacilitySelectionRef | undefined

// facility-editor.ts
export interface FacilityEdit {
  readonly id: string                    // 'wing.move'
  readonly label: string                 // 'Move wing bay'
  readonly coalesce?: string | undefined
  run(facility: Facility): EditResult<Facility>
}
export interface FacilityState { readonly facility: Facility }
export interface FacilitySession { readonly open: boolean; run(edit: FacilityEdit): EditResult<Facility>; commit(): void; cancel(): void }
export interface FacilityEditor {
  readonly history: History<FacilityState>
  readonly selection: Selection<string>
  /** The live facility, including the runs of an open session. */
  readonly facility: Facility
  run(edit: FacilityEdit): EditResult<Facility>
  begin(label: string): FacilitySession
}
export interface FacilityEditorOptions { readonly facility: Facility; readonly now?: (() => number) | undefined }
export function createFacilityEditor(options: FacilityEditorOptions): FacilityEditor

// facility-edits.ts
export interface MoveWingArgs { readonly wing: string; readonly offset: readonly [number, number, number] }
export function moveWing(args: MoveWingArgs): FacilityEdit
export function setJoin(join: FacilityJoin): FacilityEdit
export function removeJoin(id: string): FacilityEdit
export function setLock(lock: FacilityLock): FacilityEdit
```

## Steps

Tests use the shipped facility (`facility.json` through `facilityCodec.parse`): wings `clinic` (offset 0, 0, 0; phases P0, P1, P3) and `bay` (10.375, -1, -6.6; phase P2); joins `exit`, `clinicDoor` and two more; four phases (P2 lists the Bay's rooms, among them `west`; P3 the clinic's, among them `yard` and `corridor`); twenty locks (`p0.cabinet`, `p0.supply` and the rest).

- [ ] **1. The selection ids and the editor** (`model/facility-selection.test.ts`, `model/facility-editor.test.ts`; `model/facility-selection.ts`, `model/facility-editor.ts`).
  - *Red, by case:* the ids are written `kind:id` and read back; an id that is empty or holds `:` or `/` throws `SelectionIdError`; `parseFacilitySelection` reads the four kinds and nothing else (no colon, a second colon, a slash, an unknown kind, an empty name). The editor, with small fake edits over the shipped facility: `run` applies an edit as one undo step with its label and answers its result; a refusal changes nothing and records nothing; an edit that answers the facility it was given records nothing; `select` on a result replaces the selection; after any change of the facility (an edit, an undo, a redo, a commit) the selection drops the joins, locks, wings and phases that are gone and keeps the others; `begin` opens a session whose runs show live (`facility` includes them), commit as one step, cancel leaves nothing, and a second `begin` while one is open comes back closed and refuses its runs; `now` is the history's clock (a coalesced pair is one step); a session refuses a run after it is over.
  - *Expected failure:* the modules are missing.
  - *Done:*
- [ ] **2. `moveWing`** (`model/facility-edits.test.ts`; `model/facility-edits.ts`).
  - *Red, by case:* moves the offset and nothing else (the other wing, the joins, the phases and the locks are the same objects; the unknown members of the wing it moved stay); the offset is rounded to four decimals; one undo step labelled `Move wing bay`; the coalesce key `wing.move:bay`; the wing is selected; the same offset records nothing; an unknown wing is refused with `no wing barn`; an offset with a number that is not finite is refused with a sentence naming the wing; the wing's id is not touched. **ED3-i, the offset half:** moving the bay by 0.5 m on x and printing it with `facilityCodec.patch` changes only that one number in the text (`10.375` to `10.875`), checked with the shared text-diff helper against the shipped file; undo restores the model that the unchanged text parses to.
  - *Expected failure:* `moveWing` is not exported.
  - *Done:*
- [ ] **3. `setJoin` and `removeJoin`** (the same files).
  - *Red, by case:* a new join is appended and selected, one undo step labelled `Add join x`; a join with an id that exists is replaced in place (order kept), labelled `Change join clinicDoor`, unknown members of the join it was given kept; a street side (`{ street: 'start' }`) is accepted; a side whose phase is not in the facility is refused with `no phase P9`; a room the phase does not list is refused with `phase P3 has no room attic`; a room listed under `seen` is accepted; a wall that is not a whole number from 0 is refused; two equal sides are refused with `a join needs two different sides`; an id that is empty or holds `:` or `/` is refused when the join is new and accepted when the file already has it; `removeJoin` removes by id, labelled `Remove join exit`, drops it from the selection; an unknown id is refused with `no join exit2`; both survive `facilityCodec.patch` against the shipped text (a join added, a join removed, a join replaced), and where the codec refuses, the refusal is the one the test names.
  - *Expected failure:* `setJoin` and `removeJoin` are not exported.
  - *Done:*
- [ ] **4. `setLock`** (the same files).
  - *Red, by case:* a new lock is appended and selected, labelled `Add lock x`; an existing id is replaced in place, labelled `Change lock p0.cabinet`, unknown members kept; changing a lock's kind, hints, `opens` and `fallback` is the whole lock replaced and nothing else in the facility changes (same objects elsewhere); a lock with no phase is refused with `a lock needs at least one phase`; a phase that is not in the facility is refused with `no phase P9`; `at` empty (a blank string, an empty list) is refused; an id with `:` or `/` is refused when new; the same lock records nothing; it survives `facilityCodec.patch` against the shipped text, and where the codec refuses, the refusal is the one the test names.
  - *Expected failure:* `setLock` is not exported.
  - *Done:*
- [ ] **5. Entry, gates and records.**
  - *Run in order:* the package entry exports the editor, the four edits, the selection helpers and their types (asserted in `index.test.ts`); `level-state.ts`'s comment says the facility has its own editor; `pnpm format`, `pnpm docs:stack`, `pnpm check`, `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` then `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic, listed on its step; `purity.test.ts` holds for `model`.
  - *Records:* master plan (02), continuation prompt (03) and the spec's §4.2 (the facility's own history) and task table in the docs follow-up PR once the lines merge; nothing ticked in 02 from this PR.
  - *Done:*

## Mutations

Hand mutation per step with `mutate.py` (`/mnt/project-files/ed3d/mutate.py`), run from `packages/editor-3d`, the module's own test file as the filter. To be listed when the steps are done.

## Verification

Local, Node 24: the package's tests and `pnpm check`. No browser or GPU suite is selected (no DOM, no painting, no sim code). Whether a wing drag wants a snap to the grid (the level's 0.5 m step) is judged on the built World view (ED3D.9c, ED3D.11).

## Risks

| Risk | Mitigation |
|---|---|
| The spec's single `History` for level and facility is the better design (one undo across both files) | decision 1: the level editor is unchanged, so merging the two histories later is a change in this module and the shell only; the reason for two is the kit's per-document journal and conflict handling |
| A join the editor accepts is one the game's lint rejects (alignment, door names) | out of scope on purpose: ED3D.9b ports that lint from its source and runs it after every edit, as ED3-i says; the edits refuse only what the facility file alone can judge |
| An edit makes a file the codec cannot patch byte-exactly | steps 2 to 4 run each edit through `facilityCodec.patch` against the shipped text; where it refuses, the test records the refusal, which is the "Save is held" case of spec §11 |
