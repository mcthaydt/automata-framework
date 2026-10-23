# EDK.2 History, selection, commands and keymap: TDD plan

- **Task:** EDK.2 in [02](../../02-master-delivery-plan.md). [Editor kit spec](../specs/2026-10-23-editor-kit-design.md) §4.3 (`History<S>`), §4.4 (`Selection`, commands, keymap); decisions EDK-D2, EDK-D4, EDK-D5; acceptance EK-a (the undo-step part), EK-h.
- **Lane:** editor-kit. **Depends on:** EDK.1 (the package; this PR stacks on #106).
- **Status:** Planned 2026-10-23. Nothing implemented.
- **Progress:** 0 of 5 steps.

## Scope

**In:** four pure-TypeScript modules in `packages/editor-kit/src/`, no DOM and no Svelte (EDK-D2), run in the existing `unit` project: `history/`, `selection/`, `commands/` (command, registry, shortcut) and `keymap/`.

**Out, with owner:**

| What | Where |
|---|---|
| Binding `keydown` events to the keymap, reading `inText` from the event target, `preventDefault` | The app (ED2D.2); the keymap takes a plain key description |
| Two-finger tap = undo, three-finger tap = redo on the canvas | EDK.3 (gestures); the shell registers them against these commands |
| Persisting history, autosave journal | EDK.5 (storage) |
| Svelte reactive wrappers over `History` and `Selection` | The editor that needs them; both expose `subscribe` and plain getters |

## Decisions made here (written into the spec in this PR)

1. **Undo while a transaction is open cancels the transaction and does nothing else; redo while one is open does nothing.** Spec §4.3 said "cancels it first", which reads as cancel then also undo a committed step; a pen user who undoes mid-stroke would lose the stroke and the step before it. One undo gesture is one visible step back. `canUndo` is true while a transaction is open for the same reason.
2. **A closed transaction ignores further calls** (`open` is `false` afterwards). A gesture can end after a two-finger undo cancelled its transaction, and its `commit` must not corrupt the history. Beginning a second transaction, or `apply` while one is open, throws `HistoryError` with code `transaction-open`, and the first transaction is intact (EK-h).
3. **Dirty is `revision !== cleanRevision`** as the spec says, so undoing back to the saved state still reads dirty. That is conservative (autosave runs, nothing is lost); tracking the saved position instead is a later change if the Owner wants it.
4. **The selection's primary is the most recently selected id**, and `range` with an id that is not in `order` changes nothing.
5. **Commands close over their own state** (`run(): void`, `enabled?(): boolean`); no context argument, because the editor owns its `History` and `Selection` and a Svelte component can pass closures.
6. **Two commands cannot share a shortcut** (after normalising `shift+mod+z` to `Mod+Shift+Z`), and registering one throws, so a conflict is found at startup rather than as a key that does the wrong thing.

## Contract

### `history/history.ts`

```ts
export type HistoryErrorCode = 'transaction-open'
export class HistoryError extends Error { readonly code: HistoryErrorCode }

export interface HistoryOptions {
  /** Steps kept; the oldest drops silently. Default 500. */
  readonly limit?: number
  /** Milliseconds, injected so coalescing tests use a fake clock. Default `performance.now`. */
  readonly now?: () => number
  /** Two `apply`s with the same coalesce key within this many ms are one step. Default 600. */
  readonly coalesceWindowMs?: number
}

export interface Transaction<S> {
  readonly open: boolean
  update(fn: (state: S) => S): void
  commit(): void
  cancel(): void
}

export interface History<S> { /* as spec §4.3 */ }
export function createHistory<S>(initial: S, options?: HistoryOptions): History<S>
```

Rules as in the spec, plus decisions 1 to 3. `apply` returning the same object records nothing, does not bump `revision` and does not notify. A coalesced `apply` replaces the top step's `after` state and label, keeps its `before`, and bumps `revision`. A new step clears the redo stack. `state` is the live state, so subscribers see a transaction's updates as they happen; `revision` moves on commit, undo, redo and `apply` only.

### `selection/selection.ts`

```ts
export type SelectionId = string | number
export interface Selection<Id extends SelectionId> {
  readonly ids: readonly Id[]          // in selection order; a new array only when it changes
  readonly size: number
  readonly primary: Id | undefined     // the most recently selected
  has(id: Id): boolean
  set(ids: Iterable<Id>): void
  add(id: Id): void                    // an id already selected becomes the primary
  toggle(id: Id): void
  clear(): void
  range(from: Id, to: Id, order: readonly Id[]): void   // replaces the selection with the ids between them, either direction; primary is `to`
  subscribe(listener: (selection: Selection<Id>) => void): () => void
}
export function createSelection<Id extends SelectionId>(): Selection<Id>
```

Subscribers hear only real changes (order or primary included).

### `commands/shortcut.ts`, `commands/command.ts`, `keymap/keymap.ts`

```ts
export type Platform = 'apple' | 'other'
export interface Shortcut { readonly key: string; readonly mod: boolean; readonly ctrl: boolean; readonly meta: boolean; readonly shift: boolean; readonly alt: boolean }
export function parseShortcut(text: string): Shortcut          // throws on an empty key, two keys or an unknown modifier
export function normalizeShortcut(text: string): string       // 'shift+mod+z' → 'Mod+Shift+Z'

export interface Command { readonly id: string; readonly title: string; run(): void; enabled?(): boolean; readonly shortcut?: string; readonly allowInText?: boolean }
export function defineCommand(command: Command): Command      // validates id, title and shortcut
export interface CommandRegistry {
  register(command: Command): () => void                      // throws on a duplicate id or shortcut; returns unregister
  get(id: string): Command | undefined
  list(): readonly Command[]                                   // in registration order
  run(id: string): boolean                                     // false when unknown or disabled
}
export function createCommandRegistry(): CommandRegistry

export interface KeyInput { readonly key: string; readonly metaKey: boolean; readonly ctrlKey: boolean; readonly shiftKey: boolean; readonly altKey: boolean; readonly inText: boolean }
export interface Keymap { resolve(input: KeyInput): Command | undefined; handle(input: KeyInput): boolean }
export function createKeymap(registry: CommandRegistry, platform: Platform): Keymap
```

`Mod` is Meta on `apple` and Ctrl on `other`; modifiers must match exactly (on `apple`, `Mod+Z` is not Ctrl+Z). Letter keys compare lowercased, `Space` is `' '`. A command whose `enabled()` is false, or that lacks `allowInText` while `inText` is true, is not resolved, so the key falls through to the browser. `handle` runs the resolved command and returns whether it did, so the caller knows to `preventDefault`.

## Steps (each: failing test first, confirm the reason, minimal change, verify)

| # | Step | Test file and what fails first | Verify |
|---|---|---|---|
| 1 | History: `apply`, undo and redo, labels, revision, clean, subscribe, depth limit | `history/history.test.ts`: "Failed to resolve import ./history"; then one behavior at a time (same state records nothing; a new step clears redo; limit 3 drops the oldest and `canUndo` stays true until the last is undone) | unit |
| 2 | History: coalescing and transactions | same file: coalesce within the window with a fake clock merges, outside it does not, a different key does not; transaction live state, commit is one step, cancel restores, unchanged commit records nothing; second `begin` and `apply` while open throw `HistoryError` and leave the first intact (EK-h); `undo` cancels, `redo` does nothing, a closed transaction ignores calls | unit |
| 3 | Selection | `selection/selection.test.ts`: set, add, toggle, clear, primary, range both directions, range with an unknown id, subscribers hear real changes only, `ids` identity stable between changes | unit |
| 4 | Shortcuts and commands | `commands/shortcut.test.ts`, `commands/command.test.ts`: parse and normalise (`Mod+Shift+Z`, `Delete`, `Space`, case and order), rejects bad text; `defineCommand` validation; registry order, duplicate id and shortcut throw, unregister frees both, `run` of unknown or disabled is false | unit |
| 5 | Keymap, exports, gates | `keymap/keymap.test.ts`: `Mod+Z` is Meta+Z on apple and Ctrl+Z elsewhere and not the other; exact modifiers; shift distinguishes `Mod+Z` from `Mod+Shift+Z`; in-text blocks unless `allowInText`; disabled falls through; `handle` runs once and returns true; `index.test.ts` gains the new exports. Then `pnpm exec biome check --write`, package typecheck and unit, `pnpm lint`, `pnpm style`, `pnpm knip`; docs 02 and 03; spec §4.3 line changed per decision 1 | unit and gates |

## Acceptance (kit spec)

EK-h (begin twice throws, the first transaction is intact) and the undo-step part of EK-a (a drag is one transaction, one undo step) pass in unit tests. The scrubbing stepper that completes EK-a is EDK.4.

## Risks

- **Coalescing and the clean state.** A coalesced step moves `revision`, so a save between two scrubs of one field is dirty again after the second scrub, which is correct. A test pins it.
- **Selection ids that no longer exist.** The kit does not know the document, so deleting a selected item is the editor's `set` call. If every editor needs a `prune`, it is added then.
