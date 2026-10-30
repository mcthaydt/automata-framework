# ED2D.4c2b Open flows and the document top bar: TDD plan

- **Task:** ED2D.4c2b in [02](../../02-master-delivery-plan.md), the second half of the 4c2 split in [ED2D.4c2a](2026-10-23-ed2d-4c2a-home.md) ("Out, with owner": the error panel, text view, profile choice, recovery and conflict dialogs; undo, redo and Save in the top bar; the page-lifecycle flush). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §8 (flow 10, §8.1 and §8.2), §12, §13 (the first four rows, "Write conflict, quota, permission"), §14, §15 G-l, G-m, G-n, G-o, G-p; [kit spec](../specs/2026-10-23-editor-kit-design.md) §4.6 (`Dialog`, toasts), §4.7 (document session, folder, page lifecycle), §5 flows 3 and 4, §6. Mockups `open-failed` and `recover` in `docs/design/editor-2d/` (page `2D · States`), the top bar of `level-platformer`.
- **Lane:** editor-2d. **Depends on:** ED2D.4c2a (merged, #165), ED2D.4c1 (merged, #162), EDK.4 (`Dialog`, toasts), EDK.5 (storage). **Unblocks:** ED2D.4c4a (the Level view mounts in the frame this slice gives a top bar), ED2D.7 (Export joins the same top bar and the error panel's raw-text export).
- **Status:** Implemented and locally checked 2026-10-30 on `claude/editors-ed2d-4c2b-ed2d-4c2b-open-flows` (draft PR). Not CI verified; Chromium layout only (WebKit and Firefox pending EDK.6a); no iPad run; no Owner visual acceptance. The 2D spec is drafted, not reviewed.
- **Progress:** 8 of 8 steps.

## Scope

**In** (`packages/editor-2d/src/app/`, plus one prop on the kit's `Dialog`):

- `app/document/open-flow-model.ts` (pure): which outcomes get the error panel, its wording, the text view's window of lines, the recovery facts, the save and conflict messages, the document's heading.
- `app/document/document-controller.ts` (plain TypeScript, Svelte store contract): one open document's save state, undo and redo, the recovery decision, the conflict decision (Keep mine, Take theirs, Save as copy), save failures with Retry or Re-grant, `flushOnHide`, and leaving (flush, then dispose).
- `app/folder-access.ts`: the Re-grant toast action for a store that is a picked folder (`FolderStore.requestAccess`).
- `app/home/home-controller.ts`: outcomes that need a panel or a choice go to the owner (`onProblem`), `open(path, as)`.
- Components: `document/ErrorPanel.svelte`, `document/TextView.svelte`, `document/ProfileChoice.svelte`, `document/RecoveryDialog.svelte`, `document/ConflictDialog.svelte`, `document/DocumentBar.svelte`; `DocumentFrame.svelte` and `App.svelte` rewired; `boot.ts` hands the page lifecycle in.
- Kit: `Dialog` gains `width?: 'normal' | 'wide'` (the error panel's text needs the mockup's 640 px).

**Out, with owner:**

| What | Where |
|---|---|
| Keyboard shortcuts (`Mod+Z`, `Mod+Shift+Z`) for the top bar's Undo and Redo | ED2D.4c4b (spec §12's shortcuts) |
| Export in the top bar, and exporting the raw text of a read-only file | ED2D.7 (the panel offers Copy text now) |
| The checks pill in the top bar | ED2D.4c4b (Checks tab) |
| A folder as a source (pick, list, open, save to a real folder) | ED2D.8. Re-grant is wired here for any store that is a `FolderStore`, so it works the day a folder is a workspace |
| The Level view in the frame's canvas | ED2D.4c4a |

## Decisions (written into the 2D spec in this PR)

1. **Which outcome gets what.** `invalid`, `unrecognised`, `notText` and `tooLarge` open the **error panel**; `choose` opens the **profile choice**; `missing` and `storageFailed` stay toasts (nothing to look at; the list is read again). The panel is the kit's `Dialog` over Home, as the `open-failed` mockup draws it, so Home's search and selection are where the person left them.
2. **The panel is profile-blind.** It shows the profile's own `ParseError` messages, each with its line and column or its key path, and never reads a code: a newer version (G-o) and unknown keys (G-p) are worded by the profile ("made by a newer editor", one line per key path). The heading says what kind of outcome it is (`x does not open`, `x is not a project this editor opens`, `x is not a text file`, `x is too large to open`). A callout says nothing was written. Actions: **Copy text** (through `Workspace.exports.copyText`, only when there is text) and **Open another** (primary, closes the panel back to Home).
3. **The text view is a window, not the file.** At most 400 lines are drawn: the first ones, or the ones around the first error's line, with "Lines a to b of n". Error lines are marked (colour and an `aria-label`), the first marked line is scrolled into view, the view is its own scroll region in both directions (`touch-action: pan-x pan-y`), and long lines scroll instead of wrapping, so columns stay true.
4. **The profile choice** lists each candidate profile as a button (its label) and Cancel; choosing reads the file again with `open(path, profile.id)`, which can then open, or show the panel.
5. **Recovery comes first.** A document that opens with a recovery shows the frame with the Restore dialog over it, not dismissible (Escape and the scrim do nothing: choosing is required). It names the file, when the autosave was made (Home's `modifiedLabel`) and whether the file changed since (`baseChanged`: "The file also changed since; restoring replaces that change"). **Restore edits** applies it as one undoable step (the document is dirty); a payload that no longer parses is refused with a toast naming the first error, and the file stays open as saved with its journal kept. **Discard** removes the journal. `recoveryError` is a warning toast; the document is open.
6. **Save goes through the controller.** `saved` toasts nothing (the status line says Saved); `conflict` opens the conflict dialog; `failed` toasts the reason with **Retry**, or **Re-grant** when the reason is `denied` and the workspace's store is a folder (Re-grant asks `requestAccess()` and, when granted, saves again; refused says so). An autosave problem (quota, denial) is toasted once when it appears; the status line already shows `error`.
7. **Conflict** (G-m, EK-e): "x changed since you opened it", **Keep mine** (`overwrite`), **Take theirs**, **Save as copy** (`saveCopy`, toast names the copy; the document keeps its own path), and Cancel (dismissible: nothing happens, the edits stay). **Take theirs** opens the file again with the same profile first; only when that works is the old document disposed and its autosave removed, so a file that no longer opens leaves the person's edits where they were (toast with the reason).
8. **The top bar** (mockup `level-platformer`): Back, the document's title (the profile's `summary` title, else the file name) over its path, the profile's label as a pill, then Undo, Redo and Save at the end. Undo and Redo are disabled when there is nothing to do and are named with the step (`Undo Paint`); Save is disabled while a save runs. Every control 44 px; at compact width the title truncates and the buttons keep their size.
9. **Leaving flushes.** Back (and the editor closing) writes the journal before the document is disposed, so an edit in the last 800 ms is not lost (the autosave drops a pending write on dispose). `flushOnHide(session, lifecycle)` is attached while a document is open, moved to the new session on Take theirs, and removed on leaving. `boot.ts` hands `document` and `window` in as the lifecycle; `EditorEnv.window` becomes `ViewportWindow & LifecycleWindow`.
10. **Logic stays headless.** As in 4c2a: the model and the controller are Node `unit` tests; the components' `dom` tests cover what is seen and done; Chromium layout tests measure the panel, the dialogs and the top bar.

## Contract

```ts
// app/document/open-flow-model.ts
export type PanelOutcome = Extract<OpenOutcome, { status: 'invalid' | 'unrecognised' | 'notText' | 'tooLarge' }>
export type ChoiceOutcome = Extract<OpenOutcome, { status: 'choose' }>
export function needsPanel(outcome: OpenOutcome): outcome is PanelOutcome
export interface ErrorPanelModel {
  readonly title: string
  readonly problems: readonly { readonly text: string; readonly where: string | undefined }[]
  readonly text: string | undefined
  readonly lines: readonly number[]             // 1-based lines with an error, sorted, unique
}
export function errorPanel(outcome: PanelOutcome): ErrorPanelModel
export interface TextWindow { readonly first: number; readonly lines: readonly string[]; readonly total: number }
export function textWindow(text: string, focus?: number, size?: number): TextWindow
export function recoveryFacts(path: string, recovery: Recovery, now: number): readonly { label: string; value: string }[]
export function documentHeading(profile: Profile<unknown>, value: unknown, path: string): { title: string; file: string }
export function saveFailure(path: string, outcome: Extract<SaveOutcome, { status: 'failed' }>): string

// app/folder-access.ts
export function regrantAction(store: ProjectStore, toasts: ToastStore, retry: () => Promise<void>): ToastAction | undefined

// app/document/document-controller.ts
export interface DocumentState {
  readonly document: OpenDocument
  readonly heading: { readonly title: string; readonly file: string }
  readonly save: SaveState
  readonly canUndo: boolean; readonly canRedo: boolean
  readonly undoLabel: string | undefined; readonly redoLabel: string | undefined
  readonly recovery: Recovery | undefined       // offered, not yet decided
  readonly conflict: boolean
  readonly busy: 'save' | 'resolve' | undefined
}
export interface DocumentController {
  readonly state: { subscribe(run: (state: DocumentState) => void): () => void }
  undo(): void; redo(): void
  save(): Promise<void>
  keepMine(): Promise<void>; takeTheirs(): Promise<void>; saveCopy(): Promise<void>; dismissConflict(): void
  restore(): void; discard(): Promise<void>
  /** Flushes the journal, stops listening to the page and disposes the document. */
  close(): Promise<void>
}
export function createDocumentController(options: {
  app: EditorApp; opened: Opened; toasts: ToastStore; clock: { now(): number }
  lifecycle: { document: LifecycleDocument; window: LifecycleWindow }
}): DocumentController

// app/home/home-controller.ts (changes)
//   options.onProblem(outcome: PanelOutcome | ChoiceOutcome): void
//   open(path?: string, as?: string): Promise<void>

// editor-kit Dialog: width?: 'normal' | 'wide'   (data-width; wide is min(40rem, 100%))
```

## Component and state inventory

| Component | States |
|---|---|
| `ErrorPanel` | invalid with positions (lines marked, first one in view); unknown keys (one problem per key path, no position); newer version (the profile's message); unrecognised (text, no problems); not text and too large (no text view); Copy text (absent without text; ok and failed toasts); Open another; Escape closes |
| `TextView` | the window's lines with numbers; marked lines; "Lines a to b of n" when windowed; empty file ("The file is empty") |
| `ProfileChoice` | one button per candidate, Cancel; Escape cancels |
| `RecoveryDialog` | facts (file, last autosave, the file on disk unchanged or changed); Restore edits (primary, 48), Discard; not dismissible; busy |
| `ConflictDialog` | the message; Keep mine, Take theirs, Save as copy (primary), Cancel; busy disables the three |
| `DocumentBar` | Back; title and path; profile pill; Undo / Redo enabled, disabled, named with the step; Save enabled, disabled while saving |
| `DocumentFrame` | as 4c2a plus the bar, the dialogs and the controller's toasts |

Responsive and input: the panel and dialogs inside the screen at all eight sizes of 4c2a's layout test, the panel `wide` (640 px) where there is room and full width less the gutters on a phone; the text view scrolls inside itself, never the page; the top bar never wraps off the screen at 390 px (the title truncates). Touch 44, primary 48. Keyboard: the kit's `Dialog` traps and restores focus; Tab reaches every action; Escape closes the panel, the choice and the conflict dialog, not the recovery dialog. Nothing is hover-only.

## Failure and recovery

| Failure | Behavior |
|---|---|
| Not JSON, not a project, newer version, unknown keys (G-n, G-o, G-p) | Error panel with the profile's messages and positions, the read-only text view; nothing written (the store is unchanged) |
| Not text, over 16 MB | Error panel without a text view |
| Two profiles claim it | Profile choice; the choice reads it again |
| Copy text refused | Error toast with the store's message |
| Restore of a payload that no longer parses | Toast with the first error; the file stays open as saved; the journal is kept |
| Save conflict (G-m) | Conflict dialog; nothing overwritten until Keep mine |
| Take theirs on a file that no longer opens | Toast with the reason; the document and its edits stay |
| Save failed | Toast with Retry; `denied` on a folder: Re-grant, then save again |
| Autosave stops (quota) | One warning toast; the status line shows `error` |
| Tab hidden, page closed, Back | The journal is written first (`flushOnHide`, close) |

## Tests

Node `unit`: `open-flow-model.test.ts` (every function, both samples' headings, a planted profile without `summary`, the window's edges), `folder-access.test.ts` (a memory store gives none; a folder store's Re-grant granted retries, refused toasts), `document-controller.test.ts` over a memory workspace, `createTestClock`, a fake lifecycle (save, conflict and each resolution, Take theirs when the file broke, failed with Retry, restore and discard, refused restore, undo and redo and their labels, flush on hide, close flushes before dispose, autosave problem toast), `home-controller.test.ts` additions (each panel kind and `choose` reach `onProblem` and are not toasted; `open(path, as)`). `dom`: each component's states and actions, `App.dom.test.ts` (an invalid file shows the panel and Open another returns to the list; choose then open; recovery dialog first), `boot.dom.test.ts` (the lifecycle listeners are added while a document is open and removed after Back). `layout` (Chromium, production CSS, real `startEditor`, eight sizes): the error panel with a long text (inside the screen, Copy text and Open another reachable and sized, the text view scrolls in itself, no page overflow), the recovery dialog, the conflict dialog, the top bar (every control at least 44 px, nothing clipped or overlapping). WebKit and Firefox: the editor-2d `layout` project is Chromium only; EDK.6a adds the engines, so they are pending here.

## Steps

Each step starts with the failing test and confirms why it fails; the box is ticked in the commit that finishes it.

- [x] **1. Kit `Dialog` width.** `Dialog.test.ts`: `width="wide"` puts `data-width="wide"` on the dialog, the default is `normal`. Red: no attribute. Kit spec §4.6 note.
  - Done: 2 tests (red: the attribute was absent), `DialogFixture` passes `width` through; `.dialog[data-width='wide']` is `min(40rem, 100%)`.
- [x] **2. The open-flow model.** `open-flow-model.ts` against `open-flow-model.test.ts`.
  - Done: 21 tests (red: no module). Added beyond the contract: `savedCopyMessage`, `restoreRefused`, `recoveryUnreadable`, `reloadedMessage` and `autosaveProblem` (the words of the controller's toasts, so they are tested here once); `recoveryFacts` takes an optional `timeZone` like `modifiedLabel`. Mutation check: 11 mutants, 2 survivors; one got a test (a focus past the end of a short file), the other was an `''` guard equivalent to the general path and was removed.
- [x] **3. Re-grant.** `folder-access.ts` against `folder-access.test.ts`.
  - Done: `retryAction({ store, reason, toasts, retry })` is the toast action (Retry, or Re-grant for `denied` on a `FolderStore`), 4 tests over a memory store and a `FolderStore` stand-in (red: no module). The contract's `regrantAction` returning `undefined` became one function that always returns an action: every failed save offers one.
- [x] **4. The document controller.** `document-controller.ts` against `document-controller.test.ts`.
  - Done: 25 tests over the planted note profile (red: no module). The controller takes no `clock` (the dialog computes the recovery facts' age). Mutation check: 19 mutants, 8 survived the first tests; 7 got tests (the autosave toast told once while the status moves, Save after close, a failed Save as copy toasts only the failure, Take theirs with the document's own profile when a rival claims the file, Take theirs dropping an offered autosave, Discard with nothing on offer) and one was dead code (`listeners.clear()` in `close`: nothing publishes after `detach`), removed. All 7 re-run killed.
- [x] **5. Home hands problems over.** `home-controller.ts` (`onProblem`, `open(path, as)`); `openProblem`'s choose wording.
  - Done: three tests replaced (an unrecognised file, a choice then `open(path, 'rival')`, an invalid project: each reaches `onProblem`, no toast, the list is read again; red: `onProblem` never called) and the two choice wordings in `home-model.test.ts` lose "not available yet".
- [x] **6. Components.** `TextView`, `ErrorPanel`, `ProfileChoice`, `RecoveryDialog`, `ConflictDialog`, `DocumentBar` against their `*.dom.test.ts`.
  - Done: 43 `dom` tests in six files; the red of each is its unresolved import (`TextView` was drafted before its test, moved aside to see the red, then restored). Changes found on the way: `DocumentBar` takes `compact` and leaves the profile's pill out on a phone (the layout screenshots showed it truncated to "Level pr"); the conflict dialog closes while a choice runs (a controller test, `resolve`, so a choice that conflicts again reopens it rather than staying hidden). Hand mutation checks: 17 mutants over the six components and `App.svelte`, all killed.
- [x] **7. Root and frame.** `DocumentFrame`, `App`, `boot.ts` against `DocumentFrame.dom.test.ts`, `App.dom.test.ts`, `boot.dom.test.ts`; `document/open-flows.layout.test.ts` at eight sizes; `vite build`.
  - Done: `DocumentFrame` takes the document controller (12 tests: heading and focus, the compact bar, Back, undo and redo, Save, conflict and Keep mine, Take theirs, Restore and Discard, toasts, device-only); `App` routes panel and choice outcomes and closes the controller on Back and on destroy (6 tests, two new: G-n with the store unchanged, a choice that opens with the rival profile); `boot.ts` hands `document` and `window` in as the lifecycle (3 new tests: the `pagehide` listener while a document is open and gone after Back, G-o and G-p through the real profile, the newer file never rewritten). Test-first slip: `App.svelte` and `boot.ts` were rewritten before the lifecycle and G-o/G-p boot tests ran, so those three were checked by mutation instead. The heading is now the document's title, so four boot assertions name `Mossgate` and `Hollowmere` instead of the file. `src/testing/layout-sizes.ts` holds the eight sizes, `REST` and `arrived`, now shared by `home.layout.test.ts` and the new `document/open-flows.layout.test.ts` (24 tests in Chromium: the error panel inside the screen with Copy text and Open another reachable and sized, 600+ px wide where the screen allows, the text view scrolling both ways with the error line in view; the top bar's Back, Undo, Redo and Save; the Restore dialog, then the conflict dialog reached through Restore, a write behind the editor and Save). Its first run caught the text view scrolling past the error line (`offsetTop` counted from the dialog); measured against the view now. Screenshots (gitignored) inspected at every size. `vite build` passes.
- [x] **8. Gates and records.** `pnpm format`, `TURBO_FORCE=true pnpm check`, the layout project, `pnpm api-report` (the kit's report if `Dialog`'s props show), changeset status and `check-changesets` (both packages private: no changeset); spec §8.3 and §14 as built; the 4c2a plan's split table points here.
  - Done 2026-10-30. `pnpm format`, then `TURBO_FORCE=true pnpm check`: lint, typecheck (svelte-check), boundaries, style and knip clean; the first run caught `Dialog`'s new `width` refusing an explicit `undefined` under `exactOptionalPropertyTypes` (the kit's fixture passes it through), fixed to `'normal' | 'wide' | undefined`. Unit stage: 30 of 33 tasks passed (editor-2d 2146, editor-kit 835); `automata-content`'s `render-types.test.ts` timed out at 90 s spawning `tsc` while four other agents shared the 4 CPUs (the package is untouched here), which cancelled `game` and `runtime`; the three re-run alone pass (286, 183, 519). Chromium `layout` project of editor-2d: 65 of 65 (Home 41, open flows 24); the kit's `widgets.layout.test.ts` (it measures `Dialog`): 24 of 24. `pnpm --filter @mcthaydt/automata-editor-2d build` passes. `pnpm api-report`: 0 breaks, 0 undeclared (the kit report lists `Dialog` as a component, so its props do not show). `pnpm changeset status --since=origin/main`: nothing to bump; `check-changesets`: 0 problems (both packages private, no changeset). Not run: WebKit and Firefox layout (the editor-2d `layout` project is Chromium only; EDK.6a adds the engines), iPad Safari, `pnpm api-index` and `pnpm agent-skills` (no published package changed). Records: spec §8.2 (choice, frame) and a new §8.3, §14 rows; the kit spec §4.6 `Dialog` width; the 4c2a plan's split table links here.

## Execution record

**2026-10-30, review fixes (coordinator's review of #212), each test-first:**

1. Back during Take theirs leaked the reloaded document: `takeTheirs` now checks `closed` after reading the file and after removing the old journal, and disposes the new document (2 controller tests, red without the checks; the second check was mutation-verified). Back is disabled while a save or a conflict choice runs (`DocumentBar`'s `saving` prop became `busy`; DOM test).
2. The pending close is tracked: `App.svelte` keeps one `closing` promise for every close, opening a file waits for it (so `findRecovery` sees the flushed journal), and an exported `idle()` lets `EditorHandle.dispose` wait for it (App DOM test with a held journal flush; boot DOM test with a held journal write).
3. `TextView`'s marked line carried an `aria-label` on a role-less `div`, which is not announced; it now holds a visually hidden "error on this line" (DOM test by text).
4. A refused Restore keeps the autosave on offer, and the toast says to Discard to go on with the saved file (model and controller tests).
5. Tests added: the Restore dialog has the focus on a full-frame mount (DOM and Chromium); the layout fixture is 701 lines with the error at line 600, so the panel shows "Lines 302 to 701 of 701"; the conflict layout holds Save as copy to 48 px.

(Filled in as steps finish.)

### Deviations

- The contract's `regrantAction(...)` returning `undefined` became `retryAction(...)`, which always returns the toast's action (Retry, or Re-grant for a folder that denied).
- `createDocumentController` takes no `clock`; the frame passes `clock.now()` to the Restore dialog for the autosave's age.
- `DocumentBar` gained `compact` (the profile pill is left out on a phone), and the conflict dialog closes while a choice runs (`resolve`), both found by the layout screenshots and a controller test.
- `src/testing/layout-sizes.ts` is new: the eight sizes, `REST` and `arrived`, shared with `home.layout.test.ts` instead of a second copy.
- Re-grant is wired for a failed save only; a `denied` open from Home stays a toast (no folder is a source until ED2D.8).

### Not done

- WebKit and Firefox layout (EDK.6a), an iPad Safari pass and the Owner's visual acceptance of the panel, the dialogs and the top bar.
- Keyboard shortcuts for Undo, Redo and Save (ED2D.4c4b), Export in the top bar (ED2D.7).
