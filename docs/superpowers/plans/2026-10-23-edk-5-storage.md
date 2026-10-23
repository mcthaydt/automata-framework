# EDK.5 Storage adapters, autosave and recovery: TDD plan

- **Task:** EDK.5 in [02](../../02-master-delivery-plan.md). [Editor kit spec](../specs/2026-10-23-editor-kit-design.md) §4.7 (storage), §5 flows 3 and 4 (save, recover), §6 (OPFS missing, folder permission revoked, quota, tab hidden); decisions EDK-D2, EDK-D7; acceptance EK-d, EK-e, EK-f.
- **Lane:** editor-kit. **Depends on:** EDK.2 (`History`, whose `revision` and `cleanRevision` say when a document is dirty) and EDK.4 (`StatusLine`'s save states and the toast store the shell shows problems with). This PR stacks on the EDK.4 PR (#139). **Unblocks:** ED2D.4 (the shell opens a stage from the workspace and saves it), ED3D.5 and EDFF.1 (the FloorFifty stage lives in the workspace).
- **Status:** Planned 2026-10-23 on `claude/project-thread-73sp69-edk5`. The kit spec is drafted, not reviewed.
- **Progress:** 1 of 7 steps.

## Scope

**In:** `packages/editor-kit/src/storage/`, plain TypeScript with no Svelte (EDK-D2), run in the existing `unit` project against fakes, plus one real-browser contract run in the `layout` project:

- The **`ProjectStore` interface** of the spec and four adapters: `memory`, `opfs`, `folder` (File System Access, handles kept in IndexedDB and re-permissioned on demand) and `download` (write-only: download, share sheet, clipboard).
- **`openWorkspace`**, which picks OPFS when a real write works and otherwise falls back to `memory` plus `download` with the "Not saved on this device" state (EK-f).
- The **autosave journal** and **recovery** (`<doc>.autosave`, debounced 800 ms, flushed when the page hides; found and offered on open; EK-d).
- **`createDocumentSession`**, the save flow: write with the last known `mtime`, `conflict` instead of an overwrite, Keep mine, Save as copy, quota and denial as a state plus a callback for the toast (EK-e). It is what the editors call; they never touch the journal.
- Test fixtures in `src/testing/`: `FakeOpfs` and `FakeFolder` (directory handles in memory with controllable failures), and a `describeProjectStore` contract suite that every adapter, including the real OPFS in Chromium, passes.

**Out, with owner:**

| What | Where |
|---|---|
| The conflict, restore and re-grant dialogs, the Export and "Open folder" buttons | The editors' shells (ED2D.4, ED3D.5) build them from `Dialog`, `Menu` and `createToasts`; the session returns exactly what they need |
| "Take theirs": reading the file again and starting a new `History` | The editor (it owns the parser); the session offers `discardJournal` |
| What the document is, how it serializes, how a `.autosave` payload parses | The editor passes `serializeFile` and `snapshot`; the journal payload is an opaque string |
| Zip import and export of a workspace | ED2D.4 / ED3D.5 (they need the editors' file lists) |
| Real iPad Safari OPFS and share sheet | EDK.6 (WebKit) and the Orchestrator's device pass |
| Owner acceptance | Never ticked by an agent |

**Fact the design rests on (checked 2026-10-23):** `FileSystemFileHandle.createWritable()` reached Safari in 2025 (WebKit bug 283841; Baseline "newly available" since September 2025), so current iPadOS has OPFS writes and older iPadOS does not. The adapter never assumes it: `openWorkspace` writes and reads back a probe file, and any failure falls back with the visible state.

## Decisions made here (written into the kit spec in this PR)

1. **Paths** are `/`-separated, relative, with no empty, `.` or `..` segment, no backslash and no NUL. A bad path is a programmer error, so every method throws a `RangeError` for it instead of returning a result.
2. **Writes return a result, reads throw.** `write` returns `WriteResult` as the spec says. `list`, `read` and `remove` reject with `StorageError { reason: 'denied' | 'quota' | 'io' }` (a missing file is `undefined` or a no-op, not an error). The folder adapter's revoked permission is `denied` on every call.
3. **`mtime` is the store's own clock** (`File.lastModified` for the handle stores) and the memory store makes it strictly increase per file, so a conflict is never missed because two writes fell in one millisecond. `expected.mtime` on a missing file is a `conflict` (someone removed it).
4. **`list(prefix)`** is a plain string prefix of the full path, results sorted by path in code-unit order (deterministic); files only.
5. **One handle implementation, two stores.** OPFS and a user folder are both directory handles, so `createHandleStore(root, { kind, guard })` is shared. The adapters depend on a small structural interface (`DirectoryLike`, `FileLike`, `WritableLike`), not on `lib.dom`, so the fakes are honest and the File System Access calls TypeScript does not know (`queryPermission`, `requestPermission`, `showDirectoryPicker`) need no casts. Writes go through `createWritable()`, which Chromium and Safari commit atomically on `close()`; a failed write calls `abort()`.
6. **Errors are classified once**, in `classifyStorageError(error)`: `QuotaExceededError` is `quota`; `NotAllowedError`, `SecurityError` and a revoked permission are `denied`; anything else is `io`, with the browser's message kept.
7. **The journal is a second store**, not a hidden folder of the first: OPFS directory `journal` beside `workspace` (so `list()` of the workspace never shows autosaves), or `memory` when OPFS is unavailable (then there is no crash recovery, and the status already says so). The envelope is JSON: `{ format: 'af-autosave/1', path, savedAt, baseMtime, payload }`, where `payload` is the editor's `snapshot(state)` string and `baseMtime` is the file's `mtime` when the editor opened or last saved it.
8. **Recovery rule.** An autosave is offered when it parses, names the same path, and is not older than the file (`savedAt >= file.mtime`, or the file is missing). `baseChanged` is true when `baseMtime` is not the file's current `mtime`, so the dialog can warn that restoring will replace a hand edit. An unreadable journal is treated as none. An older autosave is left alone (the next clean save removes it).
9. **Autosave only after a committed step.** It watches `history.revision`, not the history's live transaction updates, so a drag writes nothing until it commits (EK-a). A document that returns to its clean revision (undo to the saved state) removes its journal. Writes are queued one at a time, and a clean save waits for the one in flight, so a late autosave never resurrects a removed journal.
10. **Quota pauses, everything else retries.** `quota` pauses autosave (`state: 'paused'`) until `resume()`; `denied` and `io` set `state: 'error'` and the next change tries again. Either way the session's `status` is `'error'` and `onproblem` is called once per change of problem, so the shell can toast it; nothing is dropped silently.
11. **A save marks clean only what it saved.** The session remembers `history.revision` when it serialized; if the document changed while the write was in flight, the document stays dirty and the journal stays.
12. **The clock is epoch milliseconds** (`StorageClock`, structurally a `GestureClock`), because `savedAt` is compared with a file's `lastModified`. Tests pass `createTestClock(1_700_000_000_000)`.
13. **`SaveState` has one definition**, in `storage/save-state.ts`, and `StatusLine` imports it, so the pill and the session cannot drift.

## Contract

```ts
// storage/project-store.ts
export interface StoredEntry { readonly path: string; readonly size: number; readonly mtime: number }
export type WriteFailure = 'conflict' | 'denied' | 'quota' | 'io'
export type WriteResult =
  | { readonly ok: true; readonly mtime: number }
  | { readonly ok: false; readonly reason: WriteFailure; readonly message: string }
export interface ProjectStore {
  readonly kind: 'memory' | 'opfs' | 'folder' | 'download'
  list(prefix?: string): Promise<StoredEntry[]>
  read(path: string): Promise<Uint8Array | undefined>
  write(path: string, data: Uint8Array | string, expected?: { readonly mtime: number }): Promise<WriteResult>
  remove(path: string): Promise<void>
  /** Optional; no adapter implements it in EDK.5 (the browsers have no change feed for OPFS or a folder). */
  watch?(path: string, listener: () => void): () => void
}
export class StorageError extends Error { readonly reason: 'denied' | 'quota' | 'io' }
export function assertStorePath(path: string): void            // storage/store-path.ts
export function statPath(store: ProjectStore, path: string): Promise<StoredEntry | undefined>

// storage/save-state.ts
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'device'

// storage/memory-store.ts
export function createMemoryStore(options?: { now?: () => number }): ProjectStore

// storage/handle-store.ts (structural handles; see decision 5)
export function createHandleStore(root: DirectoryLike, options: { kind: 'opfs' | 'folder'; guard?: () => Promise<void> }): ProjectStore
export function createOpfsStore(options?: { directory?: string; getRoot?: () => Promise<DirectoryLike> }): Promise<ProjectStore>

// storage/folder.ts
export interface FolderStore extends ProjectStore { readonly kind: 'folder'; readonly name: string; requestAccess(): Promise<boolean> }
export interface HandleVault { save(name: string, handle: DirectoryLike): Promise<void>; load(name: string): Promise<DirectoryLike | undefined>; forget(name: string): Promise<void> }
export function createIndexedDbVault(options?: { database?: string }): HandleVault
export function pickFolder(vault: HandleVault, env?: FolderEnv): Promise<FolderStore | undefined>       // undefined when cancelled
export function restoreFolder(vault: HandleVault, name: string): Promise<FolderStore | undefined>        // permission is checked on use

// storage/download-store.ts
export interface DownloadStore extends ProjectStore {
  readonly kind: 'download'
  readonly canShare: boolean
  share(path: string, data: Uint8Array | string): Promise<WriteResult>   // the share sheet; a dismissed sheet is { ok: false, reason: 'denied', message: 'Export cancelled' }
  copyText(text: string): Promise<WriteResult>
}
export function createDownloadStore(env?: DownloadEnv): DownloadStore

// storage/workspace.ts
export interface Workspace {
  readonly store: ProjectStore; readonly journal: ProjectStore; readonly exports: DownloadStore
  readonly persistent: boolean          // false: the status line says SaveState 'device' and Export is the primary action
  readonly reason: string | undefined   // why OPFS is not used
}
export function openWorkspace(env?: WorkspaceEnv): Promise<Workspace>

// storage/clock.ts
export interface StorageClock { now(): number; setTimer(ms: number, run: () => void): unknown; clearTimer(handle: unknown): void }
export const systemClock: StorageClock

// storage/autosave.ts + journal-entry.ts + recovery.ts
export interface Recovery { readonly payload: string; readonly savedAt: number; readonly baseChanged: boolean }
export function findRecovery(store: ProjectStore, journal: ProjectStore, path: string): Promise<Recovery | undefined>
export function discardRecovery(journal: ProjectStore, path: string): Promise<void>
// createAutosave (internal to the session): { state; flush(); clear(); resume(); dispose() }

// storage/document-session.ts
export interface Problem { readonly source: 'save' | 'autosave'; readonly reason: 'denied' | 'quota' | 'io'; readonly message: string; readonly paused: boolean }
export type SaveOutcome =
  | { readonly status: 'saved'; readonly path: string }
  | { readonly status: 'conflict' }
  | { readonly status: 'failed'; readonly reason: 'denied' | 'quota' | 'io'; readonly message: string }
export interface DocumentSessionOptions<S> {
  store: ProjectStore; journal: ProjectStore; path: string; history: History<S>
  serializeFile(state: S): Uint8Array | string; snapshot(state: S): string
  mtime?: number | undefined            // the file's mtime when it was opened; undefined for a new file
  deviceOnly?: boolean                  // Workspace.persistent === false
  clock?: StorageClock; debounceMs?: number            // default 800
  onproblem?(problem: Problem): void
}
export interface DocumentSession {
  readonly status: SaveState
  readonly problem: Problem | undefined
  subscribe(run: () => void): () => void
  save(): Promise<SaveOutcome>          // write with the known mtime; conflict leaves the file alone
  overwrite(): Promise<SaveOutcome>     // Keep mine: write without the guard
  saveCopy(): Promise<SaveOutcome>      // Save as copy: the first unused "<name> copy[ n].<ext>"; the session keeps its own path
  flush(): Promise<void>                // write the journal now (the page is hiding)
  discardJournal(): Promise<void>
  dispose(): void
}
export function createDocumentSession<S>(options: DocumentSessionOptions<S>): DocumentSession
export function flushOnHide(session: Pick<DocumentSession, 'flush'>, target?: { document: Document; window: Window }): () => void
```

## Files

Create, all under `packages/editor-kit/src/storage/` unless noted: `project-store.ts`, `store-path.ts`, `save-state.ts`, `memory-store.ts`, `handle-store.ts`, `folder.ts`, `download-store.ts`, `workspace.ts`, `clock.ts`, `journal-entry.ts`, `recovery.ts`, `autosave.ts`, `document-session.ts`, `page-lifecycle.ts`, a `*.test.ts` beside each, `storage.layout.test.ts`; `src/testing/fake-fs.ts` (`createFakeOpfs`, `createFakeFolder`), `src/testing/store-contract.ts` (`describeProjectStore`).
Modify: `src/widgets/StatusLine.svelte` (import `SaveState`), `src/index.ts`, `tooling/api-report/reports/editor-kit.api.md`, the kit spec (§4.7), `docs/02-master-delivery-plan.md`, `docs/03-continuation-prompt.md`.

## Steps

Each step starts with a failing test and the reason it fails.

- [x] **1. The store contract, paths and the memory store.** Fails: nothing exists. `store-path` tests: accepts `a`, `stages/a.toml`, `a b/c.d`; throws `RangeError` for `''`, `/a`, `a/`, `a//b`, `./a`, `a/../b`, `..`, `a\b`, a NUL. The shared `describeProjectStore(name, make)` suite (written here, run on the memory store): `list` is sorted by path, files only, filtered by plain string prefix (`stages/` and `stages/a`), carries `size` in bytes and `mtime`; `read` of a missing file is `undefined`; a string is stored as UTF-8 and reads back as bytes; `write` of a new file is `ok` with an `mtime`, a second write to the same file has a strictly larger `mtime` even when the clock did not move; `expected.mtime` equal to the current one writes, a different one is `conflict` and leaves the bytes untouched, `expected` on a missing file is `conflict`; `remove` deletes, and removing a missing file does nothing; nested paths work; a bad path throws before anything happens. `statPath` finds an exact path (not `a.toml.bak`).
- [ ] **2. Handle stores (OPFS and folder) over fake handles.** Fails: no adapter. `createFakeOpfs()` and `createFakeFolder()` are written first (nested directories, `getFileHandle`/`getDirectoryHandle` with `create`, `removeEntry`, `entries()`, `getFile()` with `lastModified`, `createWritable()` with `write`/`close`/`abort`, plus switches to make the next write throw `QuotaExceededError`, `NotAllowedError` or anything else, and to make `close` fail). The contract suite passes for `createHandleStore(fakeOpfs, { kind: 'opfs' })`. Extra: a write that throws `QuotaExceededError` is `{ ok: false, reason: 'quota' }`, `NotAllowedError` is `denied`, another error is `io` with its message; a failed write calls `abort` and leaves the old bytes; a conflict is detected from `lastModified`; `read`/`list` that throw reject with `StorageError` of the same reasons; `guard` runs before every call and its rejection becomes `denied`. `classifyStorageError` is tested on its own.
- [ ] **3. The folder upgrade.** Fails: not exported. `createFolderStore` wraps a handle with a `guard` that asks `queryPermission({ mode: 'readwrite' })` and, for `prompt`, nothing (a write is not a user gesture), so a revoked or unasked permission is `denied` on every call while `requestAccess()` calls `requestPermission` (which needs a gesture) and returns whether it was granted; after a grant the same store works. `pickFolder(vault, env)` calls `env.showDirectoryPicker({ mode: 'readwrite' })`, saves the handle in the vault under its name, returns the store; a dismissed picker (`AbortError`) returns `undefined`; no picker in the environment returns `undefined` without throwing. `restoreFolder(vault, name)` returns a store for a saved handle and `undefined` for an unknown name. `createIndexedDbVault` is exercised in Chromium in step 7.
- [ ] **4. Download store and the workspace.** Fails: not exported. Download store (fake env): `write` creates a file of the given name and type, starts a download through the env, and returns `ok`; `read` is `undefined`, `list` is `[]`, `remove` does nothing; `share` calls the env's share with the file when `canShare` and returns `{ ok: false, reason: 'denied', message: 'Export cancelled' }` for an `AbortError`; `canShare` is false when the env cannot share files, and `share` then returns `io`; `copyText` writes the clipboard and maps a refusal to `denied`. Workspace: with a working root, `store` is OPFS in directory `workspace`, `journal` is OPFS in `journal`, `persistent` is true, and the probe file is gone afterwards; with no `getRoot`, a `getRoot` that throws `SecurityError`, or a probe write that throws `QuotaExceededError`, `store` and `journal` are memory stores, `persistent` is false and `reason` says why (EK-f); `exports` is a download store either way.
- [ ] **5. Autosave and recovery.** Fails: not exported. Journal entry: round-trips; a payload that is not the envelope (garbage, wrong `format`, missing fields) parses to `undefined`. Autosave (real `createHistory`, memory stores, `TestClock`): an apply schedules one write after 800 ms and a second apply before then restarts the wait (one write with the latest state); a transaction's live updates write nothing, its commit does (EK-a); a document back at its clean revision removes the journal; `flush()` writes at once and settles after the write; nothing is written while the document is clean; writes are one at a time and the last state wins; `clear()` waits for a write in flight and then removes the journal, so no file reappears; `quota` pauses (no write on the next change) until `resume()`; `denied`/`io` set `error` and the next change writes again; a `snapshot` that throws sets `error` and the history still works; `dispose()` cancels the timer and writes nothing. Recovery (EK-d): after three edits and 800 ms, `findRecovery` returns the payload of the last state with `baseChanged` false; with the file missing it still returns; with a file newer than the journal it returns `undefined` and leaves the journal; with a file changed after `baseMtime` but older than the journal it returns with `baseChanged` true; a journal for another path or a corrupt one is `undefined`; `discardRecovery` removes it.
- [ ] **6. The document session.** Fails: not exported. `save` writes `serializeFile(state)` with the known `mtime`, marks the history clean, removes the journal and reports `saved` (EK-e's happy path); `status` goes `dirty` → `saving` → `saved`, and `subscribe` hears each change; a changed file is `conflict`, nothing is overwritten, `status` stays `dirty` (EK-e); `overwrite` writes without the guard and records the new `mtime`; `saveCopy` writes `name copy.ext` (then `name copy 2.ext` when that exists), leaves the session's own state alone and returns the copy's path; a document edited while a save is in flight stays dirty and keeps its journal (decision 11); `quota`, `denied` and `io` from the store give `failed` with the reason, `status` `error` and one `onproblem` call, and the history stays dirty; a later successful save clears `error`; an autosave `quota` calls `onproblem` with `paused: true` and sets `status` `error`; `deviceOnly` makes the idle status `device` (and `dirty` edits stay `device`, since nothing is persisted); `flush` writes the journal; `dispose` stops listening and cancels the timer. Walks EK-d end to end: three edits, drop the session without a save, `findRecovery`, a new history restored from the payload is dirty, `discardRecovery` removes it.
- [ ] **7. Page lifecycle, real OPFS, exports and gates.** Fails: not exported. `flushOnHide` calls `flush` when `visibilitychange` finds the document hidden and on `pagehide`, ignores a visible `visibilitychange`, and returns an unsubscribe that removes both listeners. `storage.layout.test.ts` (Chromium, real browser APIs): the `describeProjectStore` suite against real OPFS in a unique directory per run (removed afterwards), `openWorkspace()` with the real environment is persistent, and the IndexedDB vault saves, loads and forgets a real directory handle. Then amend kit spec §4.7, export the public names from `src/index.ts`, `StatusLine` imports `SaveState`, tick the rows, `pnpm api-report --update`, repo-level lint, style, knip, boundaries, the package's `typecheck`, whole unit and layout suites.

## Gates

`pnpm --filter @mcthaydt/automata-editor-kit test:unit`, `test:layout` and `typecheck`; repo-level `pnpm lint`, `style`, `knip`, `boundaries`, `api-report`. Not run here: CI, WebKit and Firefox, a real iPad (OPFS writes, the share sheet, the quota of a private window), real File System Access (headless Chromium has no directory picker), `pnpm deps:new` (no dependency is added), the full-repo `test:unit` (run once before the PR leaves draft).

## Execution record

(Filled in as steps pass.)
