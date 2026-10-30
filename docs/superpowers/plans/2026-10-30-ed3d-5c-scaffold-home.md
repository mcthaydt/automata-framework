# ED3D.5c 3D Svelte scaffold, Home and open flows: TDD plan

- **Task:** ED3D.5c in [02](../../02-master-delivery-plan.md). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §5.3 flows 1 and 9, §8, §9, §10, §11 (the rows for a schema error, an unrecognised or newer file, a refused patch, an autosave newer than the file), §12 (DOM and layout layers), acceptance ED3-k and ED3-o in the UI. [Kit spec](../specs/2026-10-23-editor-kit-design.md) §4.6 (`Dialog`, toasts), §4.7 and §5 flows 3 and 4 (conflict, Keep mine, Take theirs, Save as copy, Restore or Discard).
- **Lane:** editor-3d (with kit moves). **Depends on:** ED3D.5b (#207, the headless app core), ED2D.4c2b (#212, the 2D open flows whose UI patterns this follows), EDK.4 (widgets), all merged. **Unblocks:** ED3D.5d (Plan view in the frame), ED3D.9c (World), ED3D.13b (New level from Home).
- **Status:** Drafted 2026-10-30. Not reviewed, not CI verified, not Owner accepted.
- **Progress:** 4 of 10 steps.

## Why

editor-3d has a headless app (`createEditorApp`) and no screen. This slice gives it the same toolchain as editor-2d (Svelte 5, Vite, `unit`, `dom` and `layout` projects, `svelte-check`), a page that boots, Home, and the flows around opening and saving a level. Home and the dialogs that editor-2d built are generic: rather than a second copy, they **move into the kit** and both editors use them (one contract owner). What stays per editor is what knows its own files: the card words for a project, the import controls, the error panel's wording, the held Save of the 3D codec.

## Scope

**Moved into `packages/editor-kit`** (out of editor-2d, or out of editor-3d for `readStored`; editor-2d migrated to import them, its tests kept green):

| Kit file | From | What |
|---|---|---|
| `src/storage/read-stored.ts` | editor-3d `app/open-level.ts` | `readStored(store, path)`: stat, then read; `read`, `missing` or `storageFailed`. Both editors' `open` use it (PR #207 review item 7) |
| `src/widgets/Button.svelte`, `Pill.svelte` | editor-2d `app/controls/` | The 44 px button with the 48 px `primary` kind (`data-kind`), and the state or accent pill |
| `src/home/project-browse.ts` | editor-2d `app/home/home-model.ts` | The generic words and rules of a project list: `HomeCard`, `filterCards`, `projectCount`, `reconcileSelection`, `stepSelection`, `modifiedLabel`, `sizeLabel`, `splitPath`, `storageNotes`, `workspaceSubtitle` |
| `src/home/project-browser.ts` | editor-2d `app/home/home-controller.ts` | `createProjectBrowser`: the list state machine (phase, entries, visible, query, selected, busy, message; refresh with an older read never replacing a newer one; search; select; step; one action at a time) |
| `src/home/HomeScreen.svelte` | editor-2d `app/home/Home.svelte` | The shell of Home: brand, Sources and Details toggles below `wide`, the search header, the list or the unavailable notice, a `below` snippet (templates), the inspector, the status line, sheets and toasts |
| `src/home/ProjectList.svelte`, `ProjectCard.svelte`, `UnavailableNotice.svelte`, `SourcesPanel.svelte` | editor-2d `app/home/` | The listbox of cards, a card, the "can't be listed" notice, the sources panel (its import controls are a snippet) |
| `src/home/FilePick.svelte` | editor-2d `SourcesPanel.svelte` | The label around a transparent file input (iPad Safari opens the picker only from a real tap), with `multiple`, `directory` and `accept` |
| `src/dialogs/RecoveryDialog.svelte`, `ConflictDialog.svelte`, `recovery-facts.ts` | editor-2d `app/document/` | Restore or Discard, and Keep mine / Take theirs / Save as copy (kit spec §5 flows 3 and 4: the kit's dialogs, ED3D spec §8) |
| `src/testing/layout-sizes.ts` | editor-2d `src/testing/layout-sizes.ts` | The eight window sizes, `REST` and `arrived`, for every editor's layout tests |

**New in `packages/editor-3d`:**

| File | What |
|---|---|
| `package.json`, `vite.config.ts`, `vitest.config.ts`, `svelte.config.js`, `biome.json`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/main.css`, `src/vitest-setup.ts` | The toolchain, as editor-2d's: `unit` (Node), `dom` (jsdom, `*.dom.test.ts`), `layout` (real browser, `*.layout.test.ts`), `svelte-check --fail-on-warnings` |
| `src/architecture.test.ts`, `src/testing/architecture.ts` | Components live only in `ui/`; nothing outside `ui/` imports `ui/`, a component, `svelte` or the kit's Svelte root; `ui/` imports from the package only `app/` (types from anywhere); `ui/` (but `main.ts`) reads no clock, timer or randomness. The purity test keeps covering `app/` |
| `src/app/home/home-model.ts` | A `ProjectEntry` as a kit `HomeCard` (title, badge, kind pill, accent), the toasts of an open or an import |
| `src/app/home/home-controller.ts` | Home's actions over `createProjectBrowser`: open (a document goes to the owner, a file to look at goes to `onProblem`), Import folder, Import zip |
| `src/app/document/open-flow-model.ts` | The error panel's model (title, one row per issue with its JSON path, the Copy details text), the held Save's words, the save and restore toasts, the document heading |
| `src/app/document/document-controller.ts` | One open level: undo, redo, Save with each outcome (conflict, failed with Retry, refused: the held dialog), Keep mine, Take theirs, Save as copy, Save reformatted, Export a copy, Restore, Discard, flush on hide, close (flush, then dispose the level and the facility beside it) |
| `src/ui/boot.ts`, `App.svelte` | `startEditor(target, env)`; the route between Home and the document, the error panel over Home |
| `src/ui/home/Home.svelte`, `LevelSummary.svelte` | Home on the kit's `HomeScreen`, with Import folder and Import zip; the selected level's facts and Open |
| `src/ui/document/DocumentFrame.svelte`, `DocumentBar.svelte`, `ErrorPanel.svelte`, `HeldSaveDialog.svelte` | The frame (placeholder canvas until ED3D.5d), the top bar, the error panel with JSON paths and Copy details, the held Save (ED3-o) |
| `src/ui/home.layout.test.ts`, `src/ui/document/open-flows.layout.test.ts` | Chromium layout at the eight sizes |

**Out, with owner:** the Plan view, layers, the checks pill (ED3D.5d, ED3D.10b); World and opening `facility.json` (ED3D.9c: a facility card says it opens with a level); New level from Home (ED3D.13b); keyboard shortcuts for Undo, Redo and Save (ED3D.11); WebKit and Firefox in the layout projects (EDK.6a, #242, not merged when this slice began: the editor-3d `layout` project starts on Chromium); WebKit iPad journeys (EDK.6b, ED3D.11).

## Decisions (for the Owner's veto)

1. **What moves is what both editors use unchanged.** The list model, the list controller, the card, the list, the sources panel, the unavailable notice, the Home shell, the two storage dialogs, the button and pill, the layout sizes, `readStored`. What knows a file stays: editor-2d keeps its templates, summary, delete dialog, profile choice, text view and error panel; editor-3d writes its own error panel (JSON paths, no text view: the spec asks for "a list of JSON paths and messages with Copy details") and the held Save dialog.
2. **A card is data.** The kit never sees a `ProjectEntry`: each editor maps its entries to `HomeCard { path, title, badge, kind, accent, size, mtime, search }`, and the browser controller is generic over the entry with a `card` function.
3. **3D imports are a folder or a zip.** Home's sources panel has **Import folder…** (`webkitdirectory`, each file's `webkitRelativePath`) and **Import zip…** (`.zip`), both through `FilePick`; outcomes are toasts naming the root and the skipped files' count.
4. **A facility card does not open on its own.** Its summary says it opens with a level beside it, Open is disabled with that reason; World is ED3D.9c.
5. **The error panel lists JSON paths.** `invalid` shows one row per issue, the path dotted (`sectors.0.floor`, `(file)` for the root) and the message; `unrecognised` shows the registry's reason and the installed profiles; `notText` and `tooLarge` say what is wrong. **Copy details** copies the file name, the outcome, every row and the installed profiles through `Workspace.exports.copyText`. Open another (primary) closes it.
6. **The held Save (ED3-o)** is a dialog naming the path and the reason (the codec's own detail), with **Save reformatted** (primary), **Export a copy** and Cancel. A Save while held opens it again without writing. Save reformatted that conflicts opens the conflict dialog.
7. **Take theirs** reopens the file through `app.open`; only when that opens is the old level disposed and its journal removed, as in editor-2d.
8. **Closing disposes the facility too.** The facility's own document is flushed and disposed with the level (its editing is ED3D.9c).
9. **The editor-3d `layout` project starts with Chromium**; EDK.6a adds WebKit and Firefox with the same instance shape it gives editor-kit and editor-2d.

## Contract

```ts
// editor-kit/core
export type Stored =
  | { status: 'read'; mtime: number; bytes: Uint8Array }
  | { status: 'missing' }
  | { status: 'storageFailed'; reason: StorageFailure; message: string }
export function readStored(store: ProjectStore, path: string): Promise<Stored>

export interface HomeCard {
  readonly path: string; readonly title: string
  readonly badge: { readonly tone: Tone; readonly text: string }
  readonly kind: string; readonly accent: string | undefined
  readonly size: number; readonly mtime: number
  /** Extra words a search matches besides the path, the title and the kind. */
  readonly search?: readonly string[]
}
export interface BrowserState<E> { phase; entries: readonly E[]; visible: readonly E[]; query; selected; busy: string | undefined; message }
export interface ProjectBrowser<E> {
  readonly state: { subscribe(run: (state: BrowserState<E>) => void): () => void }
  refresh(prefer?: (visible: readonly E[]) => string | undefined): Promise<void>
  search(query: string): void; select(path: string): void; step(key: StepKey): void
  run(kind: string, work: () => Promise<void>): Promise<void>
}
export function createProjectBrowser<E extends { readonly path: string }>(options: {
  list(): Promise<readonly E[]>; card(entry: E): HomeCard
  onError(message: string): void
}): ProjectBrowser<E>

// editor-3d app/document/document-controller.ts
export interface DocumentState {
  readonly level: OpenLevel; readonly heading: { title: string; file: string }
  readonly save: SaveState; readonly canUndo: boolean; readonly canRedo: boolean
  readonly undoLabel: string | undefined; readonly redoLabel: string | undefined
  readonly recovery: Recovery | undefined; readonly conflict: boolean
  readonly held: PatchRefused | undefined; readonly heldOpen: boolean
  readonly busy: 'save' | 'resolve' | undefined
}
export function createDocumentController(options: {
  app: EditorApp; opened: Opened; toasts: ToastStore
  lifecycle: { document: LifecycleDocument; window: LifecycleWindow }
}): DocumentController
```

## Component and state inventory

| Component | States |
|---|---|
| `HomeScreen` (kit) | loading skeleton, empty, no match with Clear search, unavailable with Retry, list; Sources and Details toggles below `wide`; Escape closes the drawers |
| `ProjectList`, `ProjectCard` (kit) | one tab stop, arrows, Home, End, Enter opens, Delete asks (when the owner handles it); tap selects, a second finger tap opens, a double click opens |
| `SourcesPanel`, `FilePick` (kit) | the workspace row; import controls disabled while busy; storage notes persistent and device-only |
| `RecoveryDialog`, `ConflictDialog` (kit) | as ED2D.4c2b (facts, base changed, not dismissible; three choices, busy, Cancel) |
| `Home` (3D) | Import folder, Import zip; level and facility cards; the summary for a level (Open), a broken level (Open shows the panel), a facility (Open disabled with the reason), nothing selected |
| `ErrorPanel` (3D) | invalid with JSON paths; newer major (`format` named); unrecognised with the installed profiles; not text; too large; Copy details ok and failed |
| `HeldSaveDialog` (3D) | the path and the reason; Save reformatted, Export a copy, Cancel; busy |
| `DocumentBar` (3D) | Back, title and path, the profile pill (left out at compact), Undo and Redo named with the step and disabled when empty, Save; busy |

Responsive and input: Home and the dialogs at the eight sizes of the shared `layout-sizes` (spec §10's iPad sizes, 900×600, the phone both ways); touch 44, primary 48; no horizontal page scroll; the list scrolls inside its region; Tab reaches every action, the kit's `Dialog` traps and restores focus; nothing is hover-only.

## Failure and recovery

| Failure | Behavior |
|---|---|
| Schema error, newer major, unrecognised, not text, too large | Error panel over Home with the JSON paths and Copy details; nothing written |
| Missing, store refused | Toast; the list is read again |
| Save conflict (ED3-k) | Conflict dialog; nothing overwritten until Keep mine |
| Patch refused (ED3-o) | Held Save dialog with the path and reason; nothing written; Save reformatted or Export a copy |
| Save failed | Toast with Retry |
| Autosave newer than the file | Restore or Discard first; a refused restore toasts its first issue and stays on offer |
| Back, page hidden | The journal is written first |
| Workspace cannot be listed | The unavailable notice with Retry; import stays usable |
| Import refused or partly skipped | Toast with the reason or the skipped count |

## Steps

Each starts with the failing test and its reason, then the minimal change; the box is ticked when its checks pass.

- [x] **1. `readStored` in the kit.** `read-stored.test.ts` (read with the stat's mtime, missing, removed between stat and read, a store that throws is `storageFailed`). Red: no module. Then editor-3d's `open-level.ts` and editor-2d's `editor-app.ts` use it; their tests stay green.
- [x] **2. Button and Pill in the kit.** Their tests move to the kit (red: no module), the files move, editor-2d imports them from the kit.
- [x] **3. The list model and the browser in the kit.** `project-browse.test.ts` (the moved model tests, over cards) and `project-browser.test.ts` (load, unavailable, retry, an older read dropped, search, select, step, one action at a time, `prefer`). Red: no module. editor-2d's `home-model` keeps its own words and maps entries to cards; `home-controller` is built on the browser; its tests are unchanged and green.
- [x] **4. Home components in the kit.** `ProjectList.test.ts`, `ProjectCard` through it, `SourcesPanel.test.ts`, `FilePick.test.ts`, `UnavailableNotice.test.ts`, `HomeScreen.test.ts` (moved from editor-2d's dom tests, over cards). Red: no module. editor-2d's `Home.svelte` is the kit's `HomeScreen` with its templates, summary and delete dialog; `Home.dom.test.ts`, `App.dom.test.ts`, `boot.dom.test.ts` and `home.layout.test.ts` stay green.
- [ ] **5. The storage dialogs in the kit.** `RecoveryDialog.test.ts`, `ConflictDialog.test.ts`, `recovery-facts.test.ts` moved (red: no module); editor-2d's frame imports them; `layout-sizes` moves to `editor-kit/testing`.
- [ ] **6. The editor-3d toolchain.** `toolchain.dom.test.ts` (a component of the package mounts the kit shell in jsdom; red: no `dom` project), `architecture.test.ts` (planted trees, then the real one; red: no module), `svelte-check`, `vite build`.
- [ ] **7. Home's model and controller (3D).** `home-model.test.ts` (cards for a level, a broken level, a facility; the open and import toasts) and `home-controller.test.ts` (open a level, a panel outcome to `onProblem`, a missing file toasted, Import folder and Import zip select what they imported). Red: no module.
- [ ] **8. The open-flow model and the document controller (3D).** `open-flow-model.test.ts` (each panel outcome, Copy details, the held words, the heading) and `document-controller.test.ts` over a memory workspace and the test clock (save, conflict and the three choices, Take theirs on a broken file, failed with Retry, refused then held, Save while held, Save reformatted, Export a copy, Restore and Discard, a refused Restore, undo and redo labels, flush on hide, close flushes and disposes the facility). Red: no module.
- [ ] **9. The 3D components, root and boot.** `*.dom.test.ts` for `ErrorPanel`, `HeldSaveDialog`, `DocumentBar`, `LevelSummary`, `Home`, `DocumentFrame`, `App` and `boot` (an invalid file shows the panel and Copy details copies; a refused save holds and Save reformatted writes; Back flushes the journal). Then `home.layout.test.ts` and `document/open-flows.layout.test.ts` at eight sizes in Chromium with screenshots.
- [ ] **10. Gates and records.** `pnpm format`, `TURBO_FORCE=true pnpm check`, the layout projects of editor-kit, editor-2d and editor-3d, `pnpm api-report`, changeset status and `check-changesets` (all three packages are private: no changeset); spec §8 and the kit spec §4.7 as built.

## Execution record

**2026-10-30.**

- Step 1: `read-stored.test.ts`, 4 tests (red: `./read-stored` did not resolve). The function moved verbatim from editor-3d's `open-level.ts`; editor-3d's `editor-app.ts` and `open-level.ts` and editor-2d's `editor-app.ts` import it from `editor-kit/core` (editor-3d `src/app` 465 tests, editor-2d `editor-app*` 42 tests, green).
- Step 2: `Button.dom.test.ts` and `Pill.dom.test.ts` moved to the kit as `widgets/Button.test.ts` and `Pill.test.ts` (red: the components did not resolve there), then the components; the kit's root entry exports them, and the twelve editor-2d components import them from the kit (kit 13 tests; editor-2d `dom` 186 tests and `svelte-check` clean).
- Step 3: `home/project-browse.test.ts` (the moved model tests, over cards: 27) and `home/project-browser.test.ts` (7) were written first (red: neither module resolved). Changed from the contract: the browser searches through a `words(entry)` function rather than a `card(entry)`, so editor-2d's controller needs no registry (its options are unchanged) and `cardWords(card)` gives the same three words for an editor that has a card; the browser exposes `current` and `load(prefer)` for the actions built on it. editor-2d keeps `entryBadge`, `kindTone`, `cardTitle`, the templates and the toasts, and gains `searchWords` and `homeCard` (2 new tests); its `home-controller.ts` is the kit browser plus its five actions, its 548-line test file unchanged. editor-2d `src/app` `unit` and `dom`: 461 tests green; `svelte-check` clean.
- Step 4: the kit tests came first: `ProjectList.test.ts` (editor-2d's 40 over hand-written cards, plus Delete left alone when the editor offers none), `SourcesPanel.test.ts` (the panel's 7, its import controls a snippet), `FilePick.test.ts` (7: the import tests, a single file with `accept`, the folder picker and the path from the folder down), `UnavailableNotice.test.ts` (moved), `HomeScreen.test.ts` (7, through `testing/HomeScreenFixture.svelte`); red: none of the components resolved. Then the components moved: `ProjectCard` draws a `HomeCard`, `ProjectList` takes cards and an `emptyHint` (editor-2d: "Pick a template below to start one."), `ondelete` is optional; `HomeScreen` is editor-2d's `Home.svelte` without its templates, summary and delete dialog, which come back as the `below`, `inspector` and `sheets` snippets, and `focusList()` for after a deletion. `FilePick` sets `webkitdirectory` through an attachment (jsdom showed Svelte setting a property no engine has). A generic component's props are typed inline (`svelte-check`: the declaration may not name a private `Props`). editor-2d's `Home.svelte` is the kit's `HomeScreen` with Import files, the templates, the summary and the delete dialog; its four moved components and their two test files are gone. Kit 106 home and entry tests; editor-2d `dom` 132 (the 54 moved tests now run in the kit) and `svelte-check` clean on both.
  - The Chromium layout run of editor-2d then caught a regression from step 2: in a dialog, the primary button was 44 px tall. The kit `Dialog`'s `.actions button` rule (44 px) weighs as much as `Button`'s primary rule, and with both in the kit its stylesheet now came later. `Dialog` gives `[data-kind='primary']` the 48 px beside `[data-primary]`; editor-2d `layout` 65 of 65 in Chromium.
