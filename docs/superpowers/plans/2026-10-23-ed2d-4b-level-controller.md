# ED2D.4b Level view controller: TDD plan

- **Task:** ED2D.4b, the second slice of ED2D.4 in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §5.9 (tools), §8 (the Level view and its flows 2 and 3), §12 (Pencil draws, a finger pans), §13 (a cancelled pointer cancels the stroke); acceptance G-b (a stroke is one undo step) and G-c.
- **Lane:** editor-2d. **Depends on:** ED2D.4a (the edit commands); stacks on #145. **Unblocks:** ED2D.4c (the Svelte Level view and the Pixi canvas wire pointer events and the palette to this controller).
- **Status:** Planned 2026-10-23 on `claude/project-thread-73sp69-ed2d4b`. The 2D spec is drafted, not reviewed.
- **Progress:** 4 of 4 steps (2026-10-23). Locally checked; not CI verified, no Owner acceptance.

## Scope

**In:** `packages/editor-2d/src/app/level-editor.ts`, plain TypeScript with no Svelte, DOM or Pixi, run in the `unit` project in Node. It is the Level view's logic: what the palette and the toolbar have chosen, and what a pointer does to the project through the ED2D.4a commands, one `History` step per gesture.

- State the view reads: the level, the active layer, the tool, the brush size, the palette word, the entity definition, the selected instances, the cell under the pointer and the layers that are locked or hidden.
- The tools of spec §5.9 on the layer kinds that have them in this slice: brush, eraser, rectangle, fill and picker on cell layers; brush (place), select (pick, drag), eraser (delete) and picker on entity layers; brush (place) on object layers.
- Gestures as `History` transactions: a stroke, a rectangle and an entity drag show live and commit as one step, and a cancelled pointer leaves no step.

**Out, with owner:**

| What | Where |
|---|---|
| Svelte views, the toolbar, the palette, the layer panel, the inspector, Home | ED2D.4c |
| The Pixi canvas and drawing the footprint, the rectangle preview and the selection handles | ED2D.4c, ED2D.4d |
| Mapping a pointer event to level pixels (zoom, pan, pinch, Pencil versus finger) | ED2D.4c, using the kit's `Viewport2D` and `attachGestures` (EDK.3) |
| Marquee selection, stamps, the dice tool, resize handles, nudging and duplicating with the keyboard | ED2D.4d |
| Selecting, moving and erasing objects (needs an object hit test) | ED2D.4d |
| The kit's `Selection` and command registry | ED2D.4c wires the controller's state into them |

## Decisions made here (written into the 2D spec in this PR)

1. **The controller owns what the History does not:** tool state and the pointer gesture. The project stays in the `History`; the controller reads `history.state` at every event and never keeps a copy, so undo and redo need nothing from it. It depends on a two-method **`EditHistory` port** (`state`, `apply`, `begin`) that the kit's `History<Project>` satisfies structurally, so the controller runs in Node without the Svelte shell and the app passes the real one.
2. **One gesture at a time.** `pointerDown` while a gesture is open cancels that one first (a lost `pointerup`), `cancel()` ends it with no step, `setTool`, `setLayer` and `setLevel` cancel it, and `pointerUp` without a gesture does nothing.
3. **A gesture is a transaction.** A stroke updates the live state on every move and commits on `pointerUp`; it commits only if the state changed (a stroke over cells that already hold the word records nothing). The rectangle recomputes from the project as it was at `pointerDown` on every move, so dragging back shrinks it. Fill, place and delete are single `apply` steps.
4. **Undo labels** are `Paint`, `Erase`, `Rectangle`, `Fill`, `Place entity`, `Move entity`, `Delete entity` and `Place object`.
5. **Cells and pixels.** Pointer positions are level pixels. A cell is `floor(px / grid)` of the active layer's definition. A stroke is the Bresenham line between consecutive cells with the brush footprint at each (the ED2D.2 helpers), the first cell included at `pointerDown`.
6. **Entity snapping** follows the layer definition: with `snap` the pivot point moves to the nearest multiple of the grid, without it to the nearest whole pixel. A drag moves by the pointer's offset from where it went down, snapped, so the entity does not jump to the pointer.
7. **Each layer remembers its palette word.** An IntGrid value and a packed tile share no meaning, so the word belongs to the layer it was chosen on: `setLayer` restores the word last chosen on that layer, or a default that makes a fresh layer paintable (an IntGrid layer's first value, tile 0 for a tiles, auto or objects layer). `setWord` changes the word of the active layer. The entity definition is one choice for the whole view and defaults to the project's first.
8. **Locked layers refuse edits**; a hidden layer does too (nothing is drawn where it would land). Both are view state, not part of the document.
9. **Placing selects what was placed.** A `single` definition placed again moves the instance already there (ED2D.4a), and that instance is the one selected.
10. **Selection follows the project.** `refresh()` drops selected ids that no longer exist; the app calls it from its `History` subscription, so an undo that removes an entity clears its selection.

## Contract

```ts
// app/level-editor.ts
export type LevelTool = 'select' | 'brush' | 'rectangle' | 'fill' | 'eraser' | 'picker'

export interface EditHistory {
  readonly state: Project
  apply(label: string, update: (project: Project) => Project): void
  begin(label: string): { update(fn: (project: Project) => Project): void; commit(): void; cancel(): void }
}

export interface LevelEditorView {
  readonly level: string
  readonly layer: string
  readonly tool: LevelTool
  readonly brushSize: number                 // 1 to 8
  readonly word: number                      // IntGrid value or packed tile; 0 erases
  readonly entityDef: string | undefined
  readonly selected: readonly string[]       // instance ids
  readonly hover: Point | undefined          // the cell under the pointer, for the footprint
  readonly locked: ReadonlySet<string>       // layer definition ids
  readonly hidden: ReadonlySet<string>
  readonly gesture: 'idle' | 'stroke' | 'rectangle' | 'move'
  readonly rectangle: { readonly from: Point; readonly to: Point } | undefined   // the live rectangle, in cells
}

export interface LevelEditor {
  readonly view: LevelEditorView
  subscribe(run: () => void): () => void
  setLevel(id: string): void
  setLayer(def: string): void
  setTool(tool: LevelTool): void
  setBrushSize(size: number): void
  setWord(word: number): void
  setEntityDef(def: string): void
  setLocked(layer: string, locked: boolean): void
  setHidden(layer: string, hidden: boolean): void
  pointerMove(at: Point): void              // level pixels; updates hover and an open gesture
  pointerDown(at: Point): void
  pointerUp(): void
  cancel(): void
  pointerLeave(): void                      // clears hover
  refresh(): void
}

export function createLevelEditor(options: {
  readonly history: EditHistory
  readonly ids: IdSource
  readonly level: string
  readonly layer?: string
}): LevelEditor
```

## Files

- Create: `packages/editor-2d/src/app/level-editor.ts`, `app/level-editor.test.ts`, `src/testing/fake-history.ts` (an `EditHistory` with the kit's semantics: live transaction, one step per commit, none for an unchanged state; it keeps the list of steps for assertions).
- Modify: `src/index.ts` (export the controller and its types), `index.test.ts`, the spec §5.9 and §8, `docs/02`, `docs/03`.
- The architecture test already treats `app/` as generic: no profile or template id may appear in it.

## Steps

Each step starts with a failing test and the reason it fails. After each: the package's `typecheck` and `test:unit`, then a hand mutation pass on the new file (one condition or constant at a time; every survivor gets a test or a reason it is equivalent).

- [x] **1. State.** Fails: the module does not exist. A new controller starts on the given level and layer (the first layer when none is given) with the brush tool, size 1, and that layer's default word; `subscribe` hears each change once and nothing for a setter that changes nothing; `setBrushSize` rounds and clamps to 1 to 8 and refuses a non-number; `setLevel` and `setLayer` refuse ids the project does not have; changing the layer restores the word remembered for the new layer (its default when it has none), clears the selection and the rectangle and cancels a gesture; `setLocked` and `setHidden` keep sets and notify; `pointerMove` with no gesture only sets `hover` to the cell, `pointerLeave` clears it; `unsubscribe` stops notifications.
- [x] **2. Cell strokes.** Fails: no pointer handling. Brush: `pointerDown` paints the footprint at the cell, moves paint the line and footprint, the state is live before `pointerUp`, `pointerUp` commits exactly one `Paint` step, and a size-2 brush paints a 2 × 2. Eraser writes 0 as `Erase`. Rectangle: `Rectangle` step from the anchor to the current cell, shrinking when the pointer moves back, `view.rectangle` live and cleared after. Fill: one `Fill` step from the cell. Picker: sets the word from the cell and records nothing, and leaves the word on an empty cell. `cancel` restores the project with no step; a stroke that repaints the same word records no step; a second `pointerDown` cancels the first gesture; `pointerUp` with nothing open does nothing; cells outside the level are dropped; a locked or hidden layer ignores `pointerDown`; a layer of tiles, IntGrid and auto kinds all work.
- [x] **3. Entities.** Fails: no entity handling. Brush places the chosen definition at the snapped pointer as `Place entity` and selects it (and, for a `single` definition already in the level, selects the existing instance after it moved); no placement without an `entityDef`. Select: down on an instance selects it, down on empty clears the selection, a drag moves it by the snapped offset live and commits one `Move entity`, a drag that ends where it began records nothing; with `snap` off positions are whole pixels. Eraser: down on an instance deletes it as `Delete entity` and drops it from the selection. Picker: down on an instance selects it and sets `entityDef` to its definition. `refresh` drops selected ids that are gone, and does not notify when nothing changed. The topmost of two overlapping instances wins every hit.
- [x] **4. Objects, exports and gates.** Fails: no object handling; `index.test.ts` lists the new names. Brush on an objects layer places an object of the word's tile (its flips from the word) at the pointer as `Place object`; the other tools do nothing on an objects layer yet (`select` and `eraser` are ED2D.4d); export the controller; amend spec §5.9 and §8; update 02 and 03; `pnpm lint`, `style`, `knip`, `boundaries`, the package's `typecheck` and `test:unit`.

## Gates

`pnpm --filter @mcthaydt/automata-editor-2d typecheck` and `test:unit`; repo-level `pnpm lint`, `style`, `knip`, `boundaries`. Not run here: CI, WebKit and Firefox parity (no hashes, no cross-engine behavior), the full-repo `test:unit` (once before the PR leaves draft), any visual check (no screens), and a run against the kit's real `History` (ED2D.4c wires and tests it; here the port is tested against a fake with the same semantics).

## Execution record

- **Steps 1 and 2** (2026-10-23): the controller state and the cell strokes. 47 controller tests and 2 new `cellWord` tests pass; the package's `tsc -p .` and Biome are clean. Deviation from the plan as first written: the palette word is remembered per layer (decision 7) because one shared word cannot say whether `3` is an IntGrid value or a packed tile; `cellWord` was added to the ED2D.4a cell edits for the picker. Hand mutation pass on `level-editor.ts`: 48 mutants, 7 survived the first round. Five now die (hover change detection, the rectangle at pointer down, the stroke's last cell on a bent path, the brush size while moving, the layer's own grid); the two that clear the selection on `setLevel` and `setLayer` need a selection and wait for step 3.
- **Step 3** (2026-10-23): entity handling. Placing, select with drag, eraser and picker as planned. Hit testing and the topmost rule come from `entityAt`; a drag is computed from the project as it was at pointer down, which makes a drag back to the start record no step. Two survivors of the first mutation pass (`setLevel` and `setLayer` clearing the selection) now die. A further 30 mutants of the entity code were run; one survived (`existingSingle` looking at the first level instead of the edited one) and a test with a second level now kills it. One equivalent mutant is known and left: the early `return` after a brush placement, because the lines after it do nothing for the brush.
- **Step 4** (2026-10-23): objects, exports and gates. The brush on an objects layer places the palette tile with its flips as `Place object` (no selection yet, since selecting objects is ED2D.4d). 9 mutants of the object code all die. The type `Tool` of the contract is exported as `LevelTool` because the package index is flat. The controller, `LevelEditorView`, `LevelEditorOptions`, `EditHistory` and `LevelTool` are exported with a line in `index.test.ts`. `pnpm api-report --update` regenerated `editor-2d.api.md`. Spec §5.9 has an "As built (ED2D.4b)" paragraph and §8 a sentence on flows 2 and 3.
- **Gates run** (2026-10-23, Node on the cloud container): the package's `tsc -p .` and `test:unit` (44 files, 678 tests), `pnpm lint` (exit 0; 181 warnings, none in the files of this PR), `pnpm style` (407 files, 0 findings), `pnpm boundaries` (0 findings), `pnpm knip` (clean) and `pnpm api-report --update` (regenerated `editor-2d.api.md`). **Pending:** CI, the full-repo `test:unit`, the rest of `pnpm check`'s hosted run, the run against the kit's real `History` (ED2D.4c), and every visual and Owner gate (no screens exist).
