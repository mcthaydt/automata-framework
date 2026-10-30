# ED3D.5b 3D app core (headless): TDD plan

- **Task:** ED3D.5b in [02](../../02-master-delivery-plan.md). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.1 (the registry lists the installed profiles), §4.6 (a newer major `format` refuses), §5.3 flows 1 (open) and 9 (save), §8 (persistence: OPFS workspace imported from a folder or a zip, the autosave holds the model and Restore re-patches, the held Save of a patch refusal), §11 (the rows for an unrecognised file, a newer major and a refused patch) and acceptance ED3-o. [Kit spec](../specs/2026-10-23-editor-kit-design.md) §4.7 and §5 flows 3 and 4 (`Workspace`, `DocumentSession`, `findRecovery`, conflict, Keep mine, Save as copy).
- **Lane:** editor-3d. **Depends on:** ED3D.3 (`LevelEditor`), ED3D.9a (`FacilityEditor`), EDK.5 (storage), all merged. **Unblocks:** ED3D.5c (Home and the open flows in Svelte), ED3D.9c (World is shown when the facility opened beside the level).
- **Status:** Drafted 2026-10-30. Not reviewed. Steps are ticked when their checks pass.
- **Progress:** 0 of 7 steps.

## Why

The same shape as editor-2d's `app/` (ED2D.4c1): everything the Home screen and the document frame ask of storage, as plain TypeScript the Svelte views of ED3D.5c only forward to, tested in Node over the kit's memory store and an injected clock. What differs from 2D is the codec: a level is saved by patching its text (`profile.patch`), the patch can refuse, and the autosave keeps the model rather than the text.

## Scope

**In** (`packages/editor-3d/src/app/`, run in Node, under the purity test like the rest of `app/`):

| File | What |
|---|---|
| `read-level.ts` | `readLevel(bytes)`: size limit, UTF-8, `detectProfile`, `parse`; one of five outcomes. An unrecognised file and a refused parse carry the installed profile ids and a sentence that names them |
| `patched-document.ts` | `createPatchedDocument`: the kit's `DocumentSession` over a history whose file is written by a codec's `patch`; the held Save of a refusal; Save reformatted; Export a copy; Restore from the model journal. Used by the level and by the facility |
| `open-level.ts` | `openLevel`: a `LevelEditor`, its patched document and the checks run once; `findFacilityBeside` and `openFacility` (a `FacilityEditor` and its patched document) |
| `project-list.ts` | `listProjects`: one entry per `.json` file a profile or the facility codec claims, newest first, with the check counts |
| `import-files.ts` | `importFolder` and `importZip`: write a picked folder's files, or a zip's, into the workspace under one root folder |
| `editor-app.ts` | `createEditorApp({ workspace, clock })`: `installed`, `list`, `open`, `importFolder`, `importZip` |
| `src/testing/memory-workspace.ts` | A memory workspace and a hand-moved clock for the tests |

**Out, with owner:** every Svelte view, the error panel with Copy details, the dialogs (ED3D.5c); the World view (ED3D.9c); Take theirs (the view reopens the file, ED3D.5c); export of a whole workspace as a folder or a zip (not in this row: the kit's `exports` writes one file; a later row if the Owner wants it); the generate command after a save (ED3D.10b).

## Decisions (for the Owner's veto)

1. **The zip library is `fflate` 0.8.3** (MIT, no dependencies, about 8 kB for `unzipSync`, published 2026-05-16), a dependency of `editor-3d` only. `unzipSync` with a `filter` reads each entry's declared size first, so an entry over 16 MB is skipped without being inflated.
2. **An import goes under one root folder.** A folder import keeps the picked folder's name (the first segment of each relative path); a zip whose entries share one top folder keeps that folder, any other zip goes under the zip's name without `.zip`. A root the workspace already has becomes `name 2`, `name 3`, so an import never overwrites. Directory entries, `__MACOSX/`, `.DS_Store`, a path with an empty, `.` or `..` segment, a backslash or a NUL, and an entry over 16 MB are skipped and listed with the reason. A store refusal stops the import and reports what was already written.
3. **A newer major `format` is the profile's `invalid`.** The `af-sector` schema already refuses `af-sector/2` with the format found (ED3D.1b); the app's outcome adds the installed profiles, so §11's message has both. The registry is unchanged.
4. **A patch refusal holds Save.** `save`, `overwrite` and `saveCopy` patch first; a refusal returns `{ status: 'refused', path, reason, detail }`, writes nothing, leaves the session's state alone (no save problem, status stays `dirty`) and sets `held` until a save goes through. **Save reformatted** writes the model as `JSON.stringify(model, null, 2)` plus a newline, guarded by the file's mtime like Save (a conflict is a conflict), and only when the codec reads that text back; it then becomes the base. **Export a copy** writes the same text to `workspace.exports` under the file's name and leaves the file alone.
5. **The base follows the file.** The patch needs the text and the model it parses to: both are those of the last read or written text, and after a save the model is the codec's parse of what was written (the codec rounds numbers to 4 decimals).
6. **The autosave keeps the model** (`JSON.stringify` of it). Restore parses the payload with the codec's schema and applies it as one `Restore autosave` step; the base stays the file as it is now, so the next save patches the restored model into the current text. A payload that no longer validates is refused with its issues and changes nothing.
7. **The facility beside a level** is `facility.json` in the level's folder, else in a sibling folder (`../*/facility.json`, the Last Light layout `docs/art/blockout-facility/` beside `docs/art/blockout-clinic/`), the first by path. Only a profile the registry says has a facility looks (`hasFacility`: the Last Light blockout). The level opens whatever the facility does; the outcome says `opened` (its own editor and patched document, its own recovery), `missing` or `invalid` (with the issues), which ED3D.9c turns into World shown or hidden with a reason.
8. **The checks run once on open** and the counts go to the project list; `checks` is called with no context (the host gives the game's lists later).
9. **Time is injected.** `clock` is required: `app/` is under the purity test (no `Date`, no timers), so the entry page of ED3D.5c passes the system clock.

## Contract

```ts
// read-level.ts
export type ReadOutcome =
  | { status: 'parsed'; profile: LevelProfile<unknown>; value: unknown; text: string; warnings: readonly ParseIssue[] }
  | { status: 'unrecognised'; reason: string; installed: readonly string[]; message: string; text: string }
  | { status: 'invalid'; profile: LevelProfile<unknown>; issues: readonly ParseIssue[]; installed: readonly string[]; text: string }
  | { status: 'notText' }
  | { status: 'tooLarge'; bytes: number }
export function readLevel(bytes: Uint8Array): ReadOutcome

// patched-document.ts
export type DocumentSaveOutcome = SaveOutcome | PatchRefused
export interface PatchedDocument {
  readonly path: string
  readonly session: DocumentSession
  readonly held: PatchRefused | undefined
  save(): Promise<DocumentSaveOutcome>
  overwrite(): Promise<DocumentSaveOutcome>
  saveCopy(): Promise<DocumentSaveOutcome>
  saveReformatted(): Promise<DocumentSaveOutcome>
  exportCopy(): Promise<ExportOutcome>
  restore(recovery: Recovery): RestoreOutcome
  discardRecovery(): Promise<void>
  dispose(): void
}

// editor-app.ts
export interface EditorApp {
  readonly workspace: Workspace
  readonly installed: readonly string[]
  list(): Promise<readonly ProjectEntry[]>
  open(path: string): Promise<OpenOutcome>
  importFolder(files: readonly PickedFile[]): Promise<ImportOutcome>
  importZip(name: string, bytes: Uint8Array): Promise<ImportOutcome>
}
export function createEditorApp(options: { workspace: Workspace; clock: StorageClock }): EditorApp
```

## Steps

Each starts with the failing test and its reason, then the minimal change.

- [ ] **1. Reading a file.** `read-level.test.ts`: the depot and the four blockouts parse with their profile; `af-sector/1.4` parses with its warning; `af-sector/2` is `invalid` with the issue at `format` naming `af-sector/2` and `installed` both ids; `{}` and the facility are `unrecognised` with the registry's reason and a message naming both profiles; broken JSON is `unrecognised` with the scanner's offset; a schema error is `invalid` with its JSON path; `FF FE` is `notText`; 16 MB + 1 byte is `tooLarge` before decoding.
- [ ] **2. Saving through the patch.** `patched-document.test.ts` over the depot and a blockout: an edit then `save` writes exactly the patched text (one number changed, every other byte kept) and the session is `saved`; a second edit and save patches the text of the first save; a file rewritten behind the editor is a `conflict` and is not written; `overwrite` (Keep mine) writes it; `saveCopy` writes `name copy.json` and the file keeps its text.
- [ ] **3. The held Save (ED3-o).** A model the patch cannot write (a floor of `1e21`): `save`, `overwrite` and `saveCopy` are `refused` with the path and reason, nothing is written (bytes and mtime unchanged), the status stays `dirty`, `held` is set; `saveReformatted` writes the reformatted text, which reopens to the same model, and clears `held`; `exportCopy` writes the same text to the exports store and leaves the file alone; a model nothing can write (`Infinity`) is refused by both.
- [ ] **4. The autosave and Restore.** After an edit and the debounce the journal holds the model; reopening offers the recovery; `restore` applies it as one `Restore autosave` step (undo brings the file back), and `save` patches it into the file as it is now (byte-preserving); a payload that does not validate is refused and changes nothing; `discardRecovery` removes the journal; a journal the store cannot read opens the level with `recoveryError`.
- [ ] **5. Opening, and the facility beside.** `editor-app.test.ts`: `open` gives the `LevelEditor`, the checks run once, `missing`, `storageFailed` for a store that throws, the read outcomes with `path`; a blockout at `art/blockout-clinic/blockout.json` opens the facility at `art/blockout-facility/facility.json`; one in its own folder wins; no facility is `missing`; a broken one is `invalid` with its issues and the level still opens; an `af-sector` level does not look; a facility edit saves through `facilityCodec.patch`.
- [ ] **6. The project list and import.** `project-list.test.ts`: levels with their profile and check counts, a broken level, the facility, newest first; images and unknown JSON left out. `import-files.test.ts`: a folder lands under its name, a second import under `name 2`; a zip with one top folder keeps it, a flat zip goes under its stem; skipped entries with reasons; bytes that are not a zip are `refused`; a store that refuses stops with what was written; imported Last Light files then list and open with the facility beside.
- [ ] **7. Gates and records.** `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm api-report` (editor-3d is private), changeset status and `check-changesets`; spec §8 as built; the execution record below.

## Execution record

(filled in as steps pass)
