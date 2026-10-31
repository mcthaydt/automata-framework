# EDS.2c Ship, the Review desk, Export and Import: TDD plan

- **Task:** EDS.2c in [02](../../02-master-delivery-plan.md). [Editor suite spec](../specs/2026-10-30-editor-suite-design.md) §4.3 (`ChangeSet.ship`, `list`), §4.5 (journal), §4.8 (scene-interchange v2), §5 flows 9 to 11, §9 (`ship-dialog`, `review-desk`, `interchange`), §11 (failures), EDS-D10, EDS-D15, EDS-D19; acceptance EDS-j, EDS-o, EDS-p, EDS-p2, EDS-aa.
- **Lane:** editors. **Depends on:** EDS.2b (#275, merged: the write path, the journal through `ChangeSet.record(files, writes)`, the pills), EDS.1a (documents), EDS.1d-a (the git change set's `ship` and `list`, merged). **Unblocks:** COLLAB.2, EDS.2d's import of scenes, every editor's Ship.
- **Status:** Drafted 2026-10-30. Accepted under the Owner's "Auto accept all spec and plans" (2026-10-30) once reviewed.
- **Progress:** 11 of 12 steps (EDS.2c-a #287 and EDS.2c-b implemented and locally checked; not CI verified).

## The split, and why

EDS.2c is size M with three dialogs and a new interchange format. It lands in two PRs so each is reviewable:

- **EDS.2c-a (steps 1 to 6): the headless core.** The multi-file undo step in the write path (an import's all-or-none step, EDS-D19, and EDS-aa), scene-interchange v2 (schema, export, the import plan, apply), the Ship description drafted from the journal, and the Review desk's model. Plain TypeScript in `editor-suite/core`, no Svelte, DOM or clock.
- **EDS.2c-b (steps 7 to 12): the UI.** The Ship dialog, the Review desk (a rail entry), the Export and Import dialogs, wired into `Suite.svelte` and `suite-session.ts`, with DOM journeys, layout checks at the spec §10 sizes and review images under `docs/evidence/owner-visual/`.

## Scope

**In:** `packages/editor-suite/src/core/` (write path, interchange, ship draft, review model) and `src/shell/` (the three dialogs and their wiring); this plan.

**Out, with owner:** `automata editor`'s `export` and `import` commands and `--stamp` (EDS.1d-b, which wires the CLI; the core takes no clock and has no stamp); the disk workspace (EDS.1d-b); a per-editor schema hook on `SuiteEditor` (none exists; see decision 3); the scene picker (EDS.2d, when the level editors' scenes mount); Get latest and the conflict view (COLLAB.2).

## Interfaces

**Consumed:** `SuitePorts`, `SuiteWorkspace`, `ChangeSet` (`ship`, `list`, `checkpoint`), `ChangeSetSummary`, `ChangeSetWrite`, `GateState`, `WorkspaceFile`, `CheckDef` from `@mcthaydt/automata-editor-kit/ports`; `openDocument`, `ContentEdit`, `KeyPath` from `.../documents`; `createMemoryPorts` from `.../ports/testing`; `lineDiff` (`core/text-diff.ts`), `reopenedGates`, `changedPaths` (`core/reopened-gates.ts`), `createWritePath` (`core/write-path.ts`).

**Produced (`editor-suite/core`, private package):**

- `WritePath.writeAll(files: readonly { path; text; expected?: { mtime } | 'absent' }[], label): Promise<WriteOutcome>`: one undo step over several files. Every file's policy, expected mtime and `before` checks are settled before anything is written; a write that fails part-way puts back the ones already written. Undo and redo of the step write every file back or none (each must still read what the step wrote). `write` becomes a one-file `writeAll`.
- `INTERCHANGE_FORMAT`, `interchangeSchema`, `type InterchangeDocument` (spec §4.8's shape).
- `exportInterchange(files: readonly { path; editor; text }[], options: { scene?; commit?; format: 'toml' | 'json' }): string`: sorted keys, no clock.
- `planImport(text, options: { list: EditorList; read; installed: readonly string[]; provider?: (editor) => string | undefined; locked: (path) => readonly string[] }): Promise<ImportPlan>` (TOML or JSON, told apart by a leading `{`); `ImportPlan = { error } | { changes: PlannedChange[]; refused: PlanRefusal[]; applicable: boolean }`, where `PlannedChange = { path; editor; before?; after; expected; hunks; gates; checks }` and `PlanRefusal = { editor; path?; reason: 'not-installed' | 'unlisted' | 'read-only' | 'editor-mismatch' | 'locked' | 'unwritable'; why }`. The policy is `fileAccess` over the list (one owner), so a path not yet in the workspace is still classed.
- `applyImport(plan, writePath)`: `writePath.writeAll` of the planned changes with their expected mtimes, labelled "Import"; `{ refused: 'plan' }` for a plan that cannot apply.
- `reviewModel(summary, files, states: readonly GateState[] | { error } | undefined)`: per change set, each file's first-before and latest-after text with `lineDiff` hunks, created files marked, checks with their before and after measures, reopened gates with their decisions (`unknown` with the reason when unreadable), tokens.
- `draftShip(review: ReviewChangeSet): { title; body }`: drafted from the same model the Review desk shows.

**Produced (shell, EDS.2c-b):** `ShipDialog.svelte`, `ReviewDesk.svelte`, `InterchangeDialog.svelte`; `SuiteSession.ship()`, `exportScene()`, `planImport()`, `applyImport()`.

## Decisions made here (defaults, listed for the Owner's veto)

1. **A not-installed section does not block Apply.** §4.8 says Apply is enabled only on a clean plan; §11 says a section whose editor is not installed is refused "and the rest of the plan can still apply"; EDS-p2 says nothing of it is written. The plan is `applicable` when it has changes and every refusal is `not-installed`; any other refusal (a path not in the list, a `never` or generated path, an editor that does not match the row, a locked value, a value the documents cannot write) disables Apply.
2. **No provenance on export.** `provenance` is optional in §4.8; with `sections` keyed editor → path → value, every value's file and key path are its place in `sections`, so export writes none and import ignores it.
3. **"Validates each section with the editors' schemas"** reads as: the section's editor is installed, the path's row names that editor, the documents can write each value (`ContentDocument.edit`'s verify), and the files' `before` checks pass on the candidate texts (run by Apply) (the built-in `content` check and the game's). `SuiteEditor` has no schema hook and adding one is a kit contract change no editor needs yet; when an editor brings one (EDS.4a's Tuner first) it joins here.
4. **Import keeps comments and layout:** each file's new text is its current document with value edits (leaf `set`, new keys `insert`, dropped keys `remove`; an array that changed is `set` whole), not a reprint. A file the export names that does not exist is created (`expected: 'absent'`), printed as TOML or JSON from the value.
5. **Apply re-reads every file:** a file whose mtime moved on since the plan refuses the whole apply with "Plan again" (§11), before anything is written.

## Steps

Each step: write the test, run `pnpm --filter @mcthaydt/automata-editor-suite exec vitest run <file>` and see it fail for the reason named, write the code, see it pass.

### EDS.2c-a, the headless core

- [x] **1. Plan** (this file).
- [x] **2. `writeAll`** — `src/core/write-path.ts`, `write-path.test.ts`. Fails first: `writeAll` is not a function. Cases: two files written as one step, one Undo puts both back and one Redo writes both; a `before` failure in either writes neither; an expected mtime that moved refuses with the path and writes nothing; a storage failure on the second file puts the first back; Undo of the step when one file moved on is refused with that path and neither file changes; EDS-aa (create a file, Undo removes it; create one, change it outside the write path, Undo is refused with the path and the file stays). The existing write-path tests stay green.
- [x] **3. Interchange schema and export** — `src/core/interchange.ts`, `interchange.test.ts`. Fails first: module missing. Cases: export of FloorFifty's `tuning.toml` (the kit's fixture) under `tuner` as TOML and JSON parses back through `interchangeSchema`; keys are sorted and two exports are byte-identical; `scene` and `source.commit` are carried; version 1 or another format is refused with the version found.
- [x] **4. The import plan** — `interchange.test.ts`. Fails first: `planImport` missing. Cases: EDS-o (FloorFifty, no scenes: export, change `MAX_MOVE_SPEED`, plan: one change with its hunk, gates `[]` ("No gates"), its checks, applicable); EDS-p (export then import unchanged: no changes, not applicable); EDS-p2 (a `sequence` section with `sequence` not installed: refused "editor not installed", nothing of it planned, the rest still applicable); refusals for an unlisted path, a `never` path, an editor that does not match the row and a locked key (each disables Apply); a section path that does not exist yet is planned as created; text that does not parse is the plan's `error`; comments in the changed file survive.
- [x] **5. Apply** — `interchange.test.ts`. Fails first: `applyImport` missing. Cases: EDS-o's apply writes the file once, journals it, and is one undo step (Undo puts the file back); a file changed after the plan refuses the apply ("Plan again") and writes nothing; a not-applicable plan writes nothing.
- [x] **6. Ship draft and the Review model** — `src/core/ship-draft.ts`, `review-model.ts`, their tests. Fails first: modules missing. Ship: the title is the change set's; the body lists the changed files (created ones marked), each check's status with failing findings, each reopened gate with its decision or "state unknown" (gates unreadable), and "Gates still need the owner"; nothing in the body comes from a clock. Review: each file's diff from its first before to its latest after, a file written back to its first text drops out, measures before and after, gates reopened with their decisions (an approved gate is still listed as reopened), tokens.

### EDS.2c-b, the UI

- [x] **7. Session wiring** — `src/shell/suite-session.ts`, `suite-session.test.ts`: `canShip()`, `review()`, `draft()`, `ship()`, `exportGame(format, scene?)`, `planImport()`, `applyImport()` over the ports; a missing `changeSet` hides Ship (`canShip()` false).
- [x] **8. Ship dialog** — `ShipDialog.svelte`, `ShipDialog.dom.test.ts`: §9 states (ready, a check failing warns and still allows, pushing, pushed with PR, compare link only, push failed with the reason); the description is editable before Ship; EDS-j through the memory change set (PR URL, then compare link only).
- [x] **9. Review desk** — `ReviewDesk.svelte`, `ReviewDesk.dom.test.ts`: no open change set, gates not readable, a failing check, an approved gate still reopened; a Review rail entry opens it; it has no button that records.
- [x] **10. Export and Import** — `InterchangeDialog.svelte`, `InterchangeDialog.dom.test.ts`: export (format, files, the text to copy or save), import (paste or choose a file, the plan with changes, diffs, gates, checks and refusals; Apply 48 px, disabled unless applicable; a file moved on → "Plan again"); EDS-o, EDS-p and EDS-p2 as journeys; Apply then Undo.
- [x] **11. Layout** — `suite-ship.layout.test.ts`: the three dialogs at 1194×834, 834×1194, 1133×744 and 390×844: no overflow, primary actions 48 px, touch targets 44 px, the dialog scrolls in its own region; review images under `docs/evidence/owner-visual/2026-10-31-eds-2c-b/` with a README.
- [ ] **12. Gates** — below.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; the suite's `test:unit`, and for EDS.2c-b its `test:layout` (Chromium, WebKit, Firefox). The suite is private: no changeset; `pnpm api-report` only if the `./core` entry's exports change (they do in EDS.2c-a: `--update`). `pnpm changeset status --since=origin/main` and `check-changesets`.

## Execution log

- **2026-10-30, steps 1 to 6 (EDS.2c-a).** Each failed first for the reason named: `writeAll` "is not a function" (6 new cases); `interchange.test.ts` and `review-model.test.ts` "Cannot find module" (checked by running each with its module absent); the entry test's export list and the headless rule (`purity.test.ts`) failed on the new exports and imports until updated. Then: write path 16, interchange 13, review and ship 6; the suite's `test:unit` 274 passed; `svelte-check` clean.
- **Deviation:** `purity.test.ts` now allows `@mcthaydt/automata-editor-kit/documents` as a runtime import of `./core`: the documents are headless (no Svelte, DOM or clock; their entry says so) and import edits through them (§4.8: "a plan of value edits through §4.4's documents").
- **Deviation:** the write-path test's `speed` check now fails when any candidate is over 9 (it read only the first); a one-file write is unchanged, and `writeAll` gives every file of a run as a candidate. Files that name the same `before` checks share one run.
- **Deviation:** the import plan does not run the `before` checks itself; Apply's `writeAll` runs them on every candidate before writing and refuses with their findings (decision 3's check half). The plan lists the checks each change runs.
- **Gates (EDS.2c-a):** `pnpm format`; `TURBO_FORCE=true pnpm check` passed (37 and 35 tasks); `pnpm api-report --update` (the suite's report, `./core`'s new exports); `pnpm changeset status --since=origin/main` and `check-changesets` (0 problems; the suite is private, so no changeset). No UI: no layout or parity runs.
- **2026-10-31, steps 7 to 11 (EDS.2c-b).** `suite-session.test.ts` failed first ("canShip is not a function"), then 6 passed; `ReviewDesk.dom.test.ts` and `InterchangeDialog.dom.test.ts` failed first on the missing components, then 6 and 6 passed; `Suite.ship.dom.test.ts` (4 journeys: no Ship without the port, EDS-j, the Review entry, EDS-o with Undo) failed first on the missing wiring, then passed; `suite-ship.layout.test.ts` 72 passed (3 checks × 8 sizes × Chromium, WebKit, Firefox). The suite's `test:unit` 303 passed; `svelte-check` clean.
- **Deviation:** `ShipDialog.svelte` was written before its DOM test (6 cases, passing on first run), not test first; its behaviour is also covered by the EDS-j journey, which failed first.
- **Deviation:** with no editor open, the top bar's Undo and Redo step the suite's own history (an import from Home); with an editor open they still also step the editor's history, so an import followed by an editor's Undo is EDS.2d's to reconcile (follow-up), as is refreshing an open editor's session after an import writes its file.
- **Deviation:** an `open` gate reads "open, no decision yet" on the desk and in the Ship draft (it read "open before this change"); `ship-draft.ts` (from EDS.2c-a) changed with a new case.
- **Deviation:** Export and Import sit on Home above the cards; the scene picker that would export one scene is EDS.2d's, so Export takes the whole game for now (`exportGame(format, scene?)` already takes a scene).
- **Gates (EDS.2c-b):** `pnpm format`; `TURBO_FORCE=true pnpm check` passed (37 and 35 tasks; the first run failed `pnpm style` on the word "checkout" in the Ship dialog, reworded); the suite's `test:layout` 195 passed in Chromium, WebKit and Firefox (the new file 72); `test:unit` 303. Private package: no changeset; `./core` exports unchanged.
