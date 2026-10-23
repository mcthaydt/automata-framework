# EDK: the editor kit, shared by the 2D and 3D editors

> **Status:** drafted 2026-10-23 (lane **editor-kit**, thread "2D level editor"), review pending. Not reviewed, not implemented. Task rows: [EDK.0 to EDK.7](../../02-master-delivery-plan.md#ed-editors-owner-amendment-2026-10-23).
>
> **Why (Owner via the Orchestrator, 2026-10-23):** AF gets two tablet-first web editors, a 3D level editor extracted from The Last Light's `editor/` suite and one 2D level editor close to LDtk. They must read as one suite and must not build the same shell, undo stack and touch handling twice. This spec fixes what they share.

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| The Last Light `editor/src/client/{main,style.css,index.html,model}.ts`, `editor/README.md` | `mcthaydt/PixiJS3D_Experiment_001` `92e6704` (2026-10-22) | The shell's regions (top bar, left rail 48/260, centre, right 320 inspector with tabs, change-set and gate pills), the dark token set, the 44 pt rule, the iPad-over-LAN use |
| The Last Light editor-suite spec §5 to §6 | same repo, `docs/superpowers/specs/2026-10-16-editor-suite-design.md` | Owner decisions on touch first and Pencil |
| AF `packages/ui` geometry owner | `main` `c2cca72` | Form factor and height tier: the single source of layout geometry (AGENTS.md) |
| Figma file [Automata Editors](https://www.figma.com/design/8H4vY5xZj7xIedrvDdwg2d), variable collection `Editor Kit` | created 2026-10-23 | The tokens (§4.1) |

## 1. Scope

In: the parts both editors need and neither owns a reason to fork.

| Area | Kit owns | Editors own |
|---|---|---|
| Layout | `EditorShell`, panel, drawer, detent sheet, rail, status line | What goes in each region |
| State | `History` with transactions, `Selection`, command registry, keymap | Their document types and every command's meaning |
| Definitions | `FieldDef` and `EntityDef` shapes, value validation, defaults, retype checks (§4.8) | What an entity *means* (2D: shape, pivot, tile; 3D: footprint, how it sits) and every definition's content |
| Input | Pointer pipeline for finger, Apple Pencil and mouse; viewport math for 2D | The 3D camera, tools and hit testing |
| Widgets | Stepper with drag-scrub, slider, segmented control, chips, swatch, picker, reorderable list, tabs, dialog, toast, menu | Domain widgets (layer row, tile palette, vec3) built from these |
| Storage | `ProjectStore` and its adapters, autosave journal, recovery | What is saved and its format |
| Tests | Tablet viewport profiles, touch and pen helpers | Their journeys |

Out: any game code, any Last Light server or policy layer (the 3D editor keeps those), rendering (each editor owns its Pixi scene), the document formats.

## 2. Decisions

| ID | Decision | Default and why |
|---|---|---|
| EDK-D1 | One package, `packages/editor-kit`, private until a second consumer ships | Two consumers exist from day one, so it is a package, not a folder. Private avoids an API promise before both editors have used it. |
| EDK-D2 | Svelte 5 for components, plain TypeScript for everything else | AF's stack (`docs/stack.md`). `core` and `gestures` import no Svelte so they test in a renderer-free unit project. |
| EDK-D3 | Layout classes come from `@mcthaydt/automata-ui`'s geometry owner | AGENTS.md: the `ui` geometry owner is the single source of layout geometry. The kit maps its form factors to three shell modes (§4.2) and never re-measures the window. |
| EDK-D4 | Immutable document snapshots, no patch language | `History<S>` stores whole snapshots; sharing is the document's job (chunked arrays for tiles). Simplest thing that gives exact undo. A patch layer can be added later without changing callers. |
| EDK-D5 | Coalescing by key, transactions by scope | One drag is one undo step (a transaction); typing or scrubbing the same field within 600 ms is one step (coalesce key). |
| EDK-D6 | The Last Light dark theme verbatim | `#111214` app, `#1a1b1e` surface, `#23252a` raised, border `#33363c`, text `#e8e6e1`, dim `#8e8c85`, amber `#e0a54a`, IBM Plex Sans and Mono. One suite. |
| EDK-D7 | Storage is an interface with four adapters | iPad Safari has no directory picker, so a browser-only workspace (OPFS) is the default and a folder is an upgrade (§4.7). |
| EDK-D8 | Entity and field definitions are one shared shape, owned here | Both editors are "LDtk style": what a thing is and which typed fields it has is data in the project or profile, not editor code (Owner, 2026-10-23: both editors are genre-general). One validator, one definitions editor widget set, one place to add a field type. Proposed by the 3D lane, owned by the kit. |

## 3. Ownership

- The kit has one contract owner: this spec. Editors consume; they do not fork a widget. A need becomes a kit change request in the editor's PR, reviewed with it.
- The kit never imports an editor. Editors never import each other.
- Dependency direction: `editor-2d`, `editor-3d` → `editor-kit` → `@mcthaydt/automata-ui` (geometry only) and Svelte.

## 4. Interfaces

### 4.1 Tokens (`@mcthaydt/automata-editor-kit/tokens.css`)

CSS custom properties generated from one table, mirrored by the Figma `Editor Kit` collection. Names are the Figma names with `/` as `-`.

| Group | Tokens |
|---|---|
| Surfaces | `--color-bg-app`, `-surface`, `-raised`, `-field`, `-canvas` |
| Lines and text | `--color-border-default`, `-strong`; `--color-text-primary`, `-dim`, `-faint` |
| Accent and state | `--color-accent-default`, `-ink`, `-soft`; `--color-state-ok`, `-bad`, `-warn` |
| Domain colours | `--color-layer-{sky,city,tiles,entities,intgrid}`, `--color-phase-{teach,combine,recover,finish}` |
| Space and shape | `--space-{1..6}` (4 8 12 16 24 32), `--radius-{sm,md,lg,xl}` (6 8 12 16), `--size-hit` 44, `--size-primary` 48 |
| Type | IBM Plex Sans 20/26, 15/20, 13/18, 12/16, 11/14 caps; IBM Plex Mono 12/16, 11/14 |

A test reads the Figma-exported token list checked into `docs/design/editor-kit/tokens.json` and fails if the CSS and the JSON disagree.

### 4.2 `EditorShell`

Regions as Svelte 5 snippets: `topbar`, `rail`, `panel`, `canvas`, `inspector`, `dock`, `status`, plus `sheets` for overlays. Layout is chosen from the geometry owner's form factor (EDK-D3):

| Shell mode | Form factor | Regions |
|---|---|---|
| `wide` | `desktop` (includes iPad landscape 1194×834 and 1366×1024) | rail 56 + panel 264 + canvas + inspector 320; dock 148 beneath, collapsible |
| `medium` | `tablet-portrait` (834×1194, 744×1133) | canvas full width; the rail is a 64 px tab bar along the foot; panel and inspector are 320 drawers (open beside the canvas, not modal); dock is a bottom sheet |
| `compact` | `phone-portrait`, `phone-landscape` | canvas full; the rail is the same tab bar; every other region is a detent sheet, one open at a time |

Rules:

- A height tier of `short` (600 px or less of layout height, from the geometry owner) hides the dock until summoned, as the same bottom sheet `medium` uses, and tightens gutters, never targets (AGENTS.md).
- Regions are siblings that stay mounted. A mode change moves them with CSS (grid areas, fixed position, transforms) and never re-renders them elsewhere, so focus, scroll position and open transactions survive a rotation. A closed drawer or sheet is `inert` and `visibility: hidden`, not `display: none`, so its scroll position is kept.
- The rail snippet is told `orientation` (`vertical` in `wide`, `horizontal` otherwise) so the editor draws the same destinations either way.
- Keyboard, browser-bar and Stage Manager size changes do not remount regions or lose focus, scroll or selection (the geometry owner debounces; the shell keys regions by id).
- Detent sheets have three detents (peek 96, or 192 for the dock: its 148 px and the handle; half 50%; full 92%, each of the room above the tab bar and status line), a drag handle at least 44 high, and a scrim only at full.
- Every region that can scroll declares its scroll region; the canvas never scrolls the page (`touch-action: none`, overscroll locked).

### 4.3 `History<S>`

```ts
interface History<S> {
  readonly state: S
  readonly revision: number            // every commit, undo and redo
  readonly cleanRevision: number       // set by markClean(); dirty when different
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly undoLabel: string | undefined
  readonly redoLabel: string | undefined
  apply(label: string, update: (state: S) => S, options?: { coalesce?: string }): void
  begin(label: string): Transaction<S>
  undo(): void
  redo(): void
  markClean(): void
  subscribe(listener: (h: History<S>) => void): () => void
}
interface Transaction<S> { update(fn: (state: S) => S): void; commit(): void; cancel(): void }
```

- `apply` that returns the same state object records nothing.
- A transaction shows live state to subscribers while open; `cancel` restores the state at `begin`; `commit` records one step. Opening a second transaction while one is open throws.
- `undo` while a transaction is open cancels it and does nothing else (one undo gesture is one visible step back); `redo` while one is open does nothing. `canUndo` is true while one is open. A transaction that was cancelled, committed or cancelled by an undo is closed (`open` is `false`) and ignores further calls, because a gesture can end after a two-finger undo cancelled its transaction. `apply` while one is open throws, like a second `begin`: both throw `HistoryError` with code `transaction-open`. A transaction or `apply` that returns the same state object (identity, not equality) records nothing.
- Depth limit 500 steps; the oldest drops silently and `canUndo` stays truthful.
- Time comes from an injected clock (default `performance.now`), so coalescing tests use fake timers.

### 4.4 `Selection<Id>`, commands, keymap

- `Selection<Id>`: `set`, `add`, `toggle`, `clear`, `range(from, to, order)`, `has`, `primary`, `subscribe`. Ids are strings or numbers; order is the caller's.
- `defineCommand({ id, title, run, enabled?, shortcut?, allowInText? })` (commands close over the editor's own state, so `run` and `enabled` take no context; registering two commands with one shortcut, however written, or one id twice, throws), `createCommandRegistry()`, `createKeymap(registry, platform)`. Shortcuts are written `Mod+Z`, `Mod+Shift+Z`, `Delete`, `Space`; `Mod` is Cmd on Apple, Ctrl elsewhere. A shortcut fires only when focus is not in a text field unless the command says `allowInText`, and not while the command's `enabled()` is false (the key then falls through to the browser). The keymap takes a plain `KeyInput` (`key`, the four modifier flags and `inText`) so it needs no DOM; the app converts its `KeyboardEvent`, and `handle` returns whether a command ran so the app can `preventDefault`. `Selection`'s primary is the most recently selected id, and `range` with an id that is not in `order` changes nothing.
- Touch equivalents are registered by the shell, not the editor: two-finger tap = undo, three-finger tap = redo, on the canvas only, behind a setting (default on).

### 4.5 Pointer pipeline (`gestures`)

`attachGestures(element, handlers, options): () => void` over Pointer Events with pointer capture.

| Event | Fires when |
|---|---|
| `tap` / `doubleTap` | pointer up within slop and 300 ms; `count` and `pointerType` supplied |
| `longPress` | held 450 ms inside slop; cancels the tap |
| `dragStart` / `drag` / `dragEnd` | travel past slop (touch 8, pen 4, mouse 3); carries `pressure`, `tiltX`, `tiltY`, `pointerType`, `button`, `modifiers` |
| `pan` / `pinch` | two touch pointers: centre delta, scale delta, rotation delta (rotation reported only if the editor asks) |
| `hover` | pen hover and mouse move without buttons |
| `wheel` | wheel and trackpad: zoom with Ctrl/Meta, pan otherwise |

Rules: a pen that is down or hovering within 300 ms makes touch pointers pan/pinch only (palm rejection); `pointercancel` ends the gesture with `cancelled: true` and never commits; `touch-action: none` is set by `attachGestures`; timers are injected. A second pointer arriving mid-drag converts the drag to pinch and emits `dragEnd` with `cancelled: true`.

A `Viewport2D` helper holds pan, zoom, limits and the screen/world conversions, `zoomAt(point, factor)`, `fit(rect, padding)`, and snaps zoom to 1/8 steps above 100%.

### 4.6 Widgets

All widgets: minimum 44×44 hit area (48 for the primary action), visible focus ring, keyboard operable, a `disabled` state with a reason string, `aria` roles. No hover-only affordance; Pencil hover may preview.

| Widget | States | Notes |
|---|---|---|
| `Stepper` | idle, focus, scrubbing, disabled, invalid | Drag the label left/right to scrub; tap the value to type; unit suffix; min/max clamp with a visible stop |
| `Slider` | idle, focus, dragging, disabled | Track at least 44 high; numeric readout; double tap resets to default |
| `Segmented` | idle, selected, disabled option | 2 to 5 options; disabled options explain why |
| `Chips` | idle, selected, removable | Single or multi |
| `Swatch` / `ColorField` | idle, open | Palette-first; free colour behind "custom" |
| `Picker` | closed, open, searching, empty | Sheet on `medium`/`compact`, popover on `wide` |
| `ReorderList` | idle, dragging, dropping, locked row | Drag handle 44 wide; auto-scroll at edges; announces moves |
| `Tabs`, `Dialog`, `Toast`, `Menu`, `StatusLine` | standard | Dialog traps focus and restores it; toast has an action and does not steal focus |

### 4.7 Storage

```ts
interface ProjectStore {
  readonly kind: 'memory' | 'opfs' | 'folder' | 'download'
  list(prefix?: string): Promise<StoredEntry[]>
  read(path: string): Promise<Uint8Array | undefined>
  write(path: string, data: Uint8Array | string, expected?: { mtime: number }): Promise<WriteResult>
  remove(path: string): Promise<void>
  watch?(path: string, listener: () => void): () => void
}
type WriteResult = { ok: true; mtime: number } | { ok: false; reason: 'conflict' | 'denied' | 'quota' | 'io'; message: string }
```

- `memory` (tests), `opfs` (default on every browser incl. iPad Safari), `folder` (File System Access, Chromium desktop, handles persisted in IndexedDB and re-permissioned on demand), `download` (write-only: browser download, or `navigator.share({ files })` on iPadOS, or clipboard).
- `write` with `expected.mtime` refuses with `conflict` when the file changed underneath, so an editor never silently overwrites a hand edit.
- **Autosave journal:** every committed history step schedules a debounced (800 ms) write of `<doc>.autosave` to OPFS regardless of the primary store; clean save deletes it; on open, a newer autosave offers Restore or Discard. Quota and denial surface as a toast and a status-line state, never a silent loss.

### 4.8 Typed fields and entity definitions

Both editors place *things* (a spawn point, an NPC, a door, a lamp) whose properties are data, not editor code: a **definition** says what a thing is and which typed fields it carries; an **instance** holds the values. The shapes and the value rules live here once (EDK-D8). Each editor stores its own definitions and instances in its own file format and adds its own facts to `EntityDef`.

```ts
type FieldType = 'int' | 'float' | 'bool' | 'text' | 'enum' | 'color' | 'angle' | 'ref' | 'point'

interface FieldDef {
  readonly id: string                  // /^[A-Za-z][A-Za-z0-9_]*$/, unique in its entity
  readonly type: FieldType
  readonly label?: string
  readonly list?: boolean              // an ordered array of this type (a patrol path is a list of points)
  readonly required?: boolean          // no default stands in: an instance without a value is a `fieldMissing` problem
  readonly default?: FieldValue
  readonly min?: number                // int, float: inclusive bounds
  readonly max?: number
  readonly step?: number               // int, float: the stepper's increment (default 1 for int)
  readonly options?: readonly string[] // enum: non-empty, unique
  readonly multiline?: boolean         // text
  readonly to?: readonly string[]      // ref: what it may point at, as names the editor defines (entity definition ids, `$level`, `$sector`); empty or absent means any
}

type FieldValue = number | boolean | string | Point | RefValue | readonly FieldValue[]
interface Point { readonly x: number; readonly y: number }
interface RefValue { readonly target: string; readonly container?: string }  // container: the level or sector holding the target

interface EntityDef {
  readonly id: string                  // /^[a-z][a-z0-9-]*$/
  readonly label?: string
  readonly color?: string              // a token name or #rrggbb
  readonly single?: boolean            // at most one instance per scope the editor names (2D: per level; 3D: per map)
  readonly fields: readonly FieldDef[]
}
type FieldValues = Readonly<Record<string, FieldValue>>
```

Pure functions (no DOM, no clock; validate shapes only, never the world), in `packages/editor-kit/src/fields/`:

| Function | Behavior |
|---|---|
| `checkFieldDef(def)` | Problems with one definition, in a stable order: `badId`, `wrongTypeProperty` (`min`, `max` or `step` on a type that is not `int` or `float`, `options` on a non-enum, `to` on a non-ref, `multiline` on a non-text; the message names the property), `badBounds` (`min > max`, or a bound that is not finite), `badStep` (not a positive number), `noOptions` and `duplicateOption` (enum), `badDefault` (a `default` that fails `checkFieldValue`, or any `default` on a `required` field) |
| `checkEntityDef(def)` | The entity's `badEntityId` and `badEntityColor` (`#rrggbb` or a `group/name` token), then each field's problems tagged with its `fieldId` and `fieldIndex`, and `duplicateFieldId` at the later occurrence |
| `defaultFieldValue(def)` | `undefined` for a `required` field; else `default`; else `[]` for a list; else the type's zero (`0` moved into the bounds, `false`, `''`, first option, `#ffffff`, `0` for an angle, `{x:0,y:0}`, and `undefined` for a ref until one is picked) |
| `checkFieldValue(def, value)` | `undefined` when it fits, else `{ code, message }`: `wrongType`, `notInteger`, `belowMin`, `aboveMax`, `notAnOption`, `badColor`, `badRef`, `badPoint`, `badListItem` (with the `index` of the first bad item and its own problem as `cause`). `int` needs a whole number, `float` and `angle` a finite number (`NaN` and the infinities are `wrongType`, a project file cannot hold them); `min` and `max` bound `int` and `float` only, because an angle wraps; a color is `#rrggbb` in either case; a point's coordinates are finite. A list of a required field may be empty |
| `checkValues(fields, values)` | Problems for a whole instance: each field in definition order (a missing required field is `fieldMissing`, an explicit `undefined` counts as missing), then every value whose id has no field as `unknownField`, sorted. Each problem carries its `fieldId` |
| `valuesWithDefaults(fields, values)` | The instance's values with every missing field that has a stand-in filled in (its default, else its type's zero); required fields and refs without a default stay missing; the same object when nothing is filled |
| `checkRetype(oldDef, newDef, instances)` | Before a definitions editor changes a field's type, bounds, options, list flag or `required`: the instances (`{ id, values }`) whose value would stop validating, each with its problem, so the editor refuses with a list and never loses data silently. An instance that already failed the old definition is not listed (`checkValues` reports it; the retype did not break it). The value is read by `oldDef.id`, so a rename combined with a retype is one call |
| `renameField(def, from, to)` and `renameFieldValues(values, from, to)` | The entity with one field's id changed in place (`unknownField`, `badId` and `duplicateFieldId` refuse), and an instance's values with the value moved to the new id, keeping key order. Neither mutates; together they keep values by id (EK-j) |

A reference's `target` and `container` are opaque here; whether they resolve is the editor's check (2D `brokenRef`). Zod schemas (`fieldValueSchema`, `fieldValuesSchema`, `fieldDefSchema`, `entityDefSchema`) are exported for the editors' file schemas: strict objects, so an unknown key is a parse error, and `fieldDefSchema` and `entityDefSchema` run `checkFieldDef` and `checkEntityDef` in `superRefine`, so a file that parses has passed the rules the definitions editor shows. The value schemas accept any well-formed shape, because only `checkValues` knows the definition. Editors extend `EntityDef` by intersection (`EntityDef2D = EntityDef & { shape, size, pivot, … }`); the kit never learns those facts.

Definitions editor widgets (field list, type picker, option editor, default editor) are built from the §4.6 widgets in the editor that needs them; if both editors build the same one it moves here.

## 5. Ordered flows

1. **Open:** adapter chosen (OPFS default) → list documents → select → read → editor parses → `History` created at that state → `markClean`.
2. **Edit:** gesture or widget → `apply`/transaction → subscribers re-render → autosave scheduled.
3. **Save:** editor serializes → `store.write(path, data, { mtime })` → `ok` → `markClean`, delete autosave; `conflict` → dialog (Keep mine, Take theirs, Save as copy); other failures → toast with Retry and Export instead.
4. **Recover:** open finds autosave newer than the file → dialog; Restore loads it as dirty state.
5. **Resize/rotate:** geometry owner publishes → shell mode may change → regions move between slots with the same keys; focus, scroll, selection and open transactions survive.

## 6. Failure and recovery

| Failure | Behavior |
|---|---|
| OPFS missing (private window, old browser) | Falls back to `memory` + `download`; status line says "Not saved on this device"; Export is promoted to the primary action |
| Folder permission revoked | `folder` adapter reports `denied`; shell offers Re-grant or switch to OPFS; edits stay in history |
| Quota exceeded | `quota` result; toast; autosave pauses with a visible state; Export still works |
| Pointer cancelled (palm, system gesture) | Gesture ends `cancelled`; open transaction cancelled; no partial edit |
| Unhandled error in a widget | Boundary replaces only that region with an error panel and a Copy details action; other regions stay usable |
| Tab hidden or page unload | Journal flushed on `visibilitychange` and `pagehide` |

## 7. Responsive and input inventory

| Context | Size | Input | Must hold |
|---|---|---|---|
| iPad 11" landscape | 1194×834 | touch + Pencil | `wide` mode, all regions visible, dock open |
| iPad 11" portrait | 834×1194 | touch + Pencil | `medium`, drawers, dock as sheet |
| iPad mini landscape | 1133×744 | touch | `wide`, dock open (744 px is taller than the geometry owner's `short` limit of 600) |
| Desktop window 900×600 | 900×600 | mouse | `wide`, height `short` → dock hidden until summoned |
| iPad 13" landscape | 1366×1024 | touch + Pencil | `wide` |
| Desktop | 1440×900 and larger | mouse + keyboard | `wide`, hover states, shortcuts |
| Phone (not a target) | 390×844, 844×390 | touch | `compact`, nothing unreachable, no crash |
| Software keyboard open | any | touch | No remount; focused field scrolled into view; canvas not resized |

## 8. Testing

| Layer | Where | What |
|---|---|---|
| Unit (renderer-free) | `core`, `gestures`, `storage` | History, selection, keymap, gesture recognizer with fake pointer events and fake timers, adapters against a fake OPFS and fake File System Access |
| DOM component | Vitest browser mode | Each widget state in §4.6, focus, keyboard, disabled reasons |
| Layout contract | Vitest layout project, real browser | Shell at every size in §7: region boxes, hit sizes ≥ 44, no horizontal page scroll, scroll regions declared |
| Tablet journeys | Playwright WebKit with iPad profiles | Touch and pen sequences from `testing` helpers: drag-scrub, long-press menu, pinch, reorder |
| Visual | GPU runner (D-5) | Screenshots only for Owner visual acceptance; never auto-promoted |

Fixtures: `FakePointer` (touch, pen, mouse), `FakeOpfs`, `FakeFolderHandle`, a `TestClock`. Focused feedback first: one widget or one gesture, then the layer, then `pnpm check`.

## 9. Acceptance cases

| ID | Case | Pass |
|---|---|---|
| EK-a | Drag a stepper label 40 px right, release | One undo step; value changed by the configured rate; undo restores it |
| EK-b | Pencil down, then palm touches | Palm ignored; Pencil stroke unaffected |
| EK-c | Rotate iPad from landscape to portrait mid-drag of a slider | Drag ends `cancelled`, value unchanged, no remount, panel scroll kept |
| EK-d | Make 3 edits, kill the tab, reopen | Restore dialog offers the autosave; restoring reproduces the state; Discard deletes it |
| EK-e | Save when the file changed on disk | `conflict`; nothing overwritten; dialog offers the three choices |
| EK-f | OPFS unavailable | Falls back to memory + download with the visible "Not saved on this device" state |
| EK-g | Layout at 1194×834, 834×1194, 1133×744, 1366×1024, 390×844 | Layout contract passes; every action reachable |
| EK-h (fail) | `begin` twice without commit | Throws a typed error; first transaction intact |
| EK-i (fail) | `attachGestures` torn down mid-gesture | Pointer capture released; no handler fires after dispose |
| EK-j | An entity definition has `hp: int 0..9`; set an instance to 12, then retype `hp` to text while two instances hold numbers | `belowMin`/`aboveMax` problem on 12; `checkRetype` lists exactly the two instances and the editor refuses; renaming `hp` keeps both values |

## 10. Tasks

Order and dependencies are in the [master plan](../../02-master-delivery-plan.md#ed-editors-owner-amendment-2026-10-23): EDK.1 package, tokens and shell → EDK.2 history/selection/commands → EDK.3 gestures → EDK.4 widgets → EDK.5 storage → EDK.6 tablet harness; EDK.7 typed field and entity definitions (§4.8; needs only EDK.1, and ED2D.1 and ED3D.1b wait for it). Each gets a TDD plan before code; the first commit of each PR is that plan.

## 11. Open questions (answers will come from the Owner through the Orchestrator)

1. Publish the kit to GitHub Packages once both editors use it, or keep it private for good? Default: private.
2. Should the kit ship an icon set? Default: a small inline-SVG set (stroke 1.75, 24 grid) generated from one file, shared with the Figma icon page.
