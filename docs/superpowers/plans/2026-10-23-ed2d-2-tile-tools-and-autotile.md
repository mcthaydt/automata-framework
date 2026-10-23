# ED2D.2 Tile tools and the auto-tile engine: TDD plan

- **Task:** ED2D.2 in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §5.3 (cells), §5.6 (auto-tile rules), §5.9 (tools), §14 (golden and property tests); decision ED2D-D4; acceptance G-c and G-d.
- **Lane:** editor-2d. **Depends on:** ED2D.1 (this PR stacks on #128). **Unblocks:** ED2D.3 (the export resolves auto layers with this engine; the checks reuse its rule diagnostics) and ED2D.4 (the canvas calls these operations from its tools).
- **Status:** In progress on `claude/project-thread-73sp69-ed2d2`, stacked on ED2D.1 (#128). The 2D spec is drafted, not reviewed.
- **Progress:** 9 of 11 steps.

## Scope

**In:** headless, pure functions in `packages/editor-2d/src/tiles/` (no DOM, clock, timer or `Math.random`; the architecture test from ED2D.1 enforces it):

- Tile tools of spec §5.9 as operations over a `Grid`: brush footprint and stroke line, rectangle, flood fill, stamp (copy, flip, paste), the random dice, erase (painting 0) and pick, all with flips.
- `tiles/hash.ts`: the 32-bit integer hash that auto-tile variation, chance and the dice share.
- The auto-tile engine of §5.6: rule matching (patterns 1, 3 and 5; `any`, `empty`, `filled`, `is`, `not`; `outside`; flips; chance; variants; `breakOnMatch`; stacked outputs), a full evaluation, an incremental one, manual overrides on top, and an output hash.
- Rule diagnostics for Checks (the data only; the Checks list is ED2D.3).
- A `browsers` vitest project in `packages/editor-2d` so the golden hashes run in Chromium, WebKit and Firefox as well as Node (the `parity` CI job runs `test:parity` for every package that has it).

**Out, with owner:**

| What | Where |
|---|---|
| Commands (`paintCells`, `floodFill`, … as named `History` functions over a `Project`) and the layer-kind dispatch | ED2D.3 and ED2D.4 |
| Pointer handling, tool state, palettes, the hover footprint | ED2D.4, ED2D.8 |
| Marquee selection and copy-paste of a selection | ED2D.4 (it calls `copyStamp` and `pasteStamp`) |
| `rerollSeed`, the rule editor | ED2D.3, ED2D.5 |
| Turning a result into Pixi sprites; the AF content export of resolved stacks | ED2D.4; ED2D.3 |

## Decisions made here (written into the 2D spec in this PR)

1. **One set of operations for every grid.** A tool takes the cell **word** (a packed tile cell, an IntGrid value, or an override tile) and returns a new `Grid`; it does not know the layer kind. `eraser` is painting the word 0. Commands in later tasks pick the word and the grid.
2. **Brush footprint.** A square of size `n` (a whole number 1 to 8; else `RangeError`) whose top-left is `x - floor((n - 1) / 2)`, `y - floor((n - 1) / 2)`, so odd sizes centre on the cursor and even sizes extend one cell further right and down. Cells outside the grid are dropped by the grid itself.
3. **A stroke is a line.** `lineCells(from, to)` is Bresenham's line, both ends included, so a fast drag leaves no gaps; the brush stamps its footprint on every cell of it.
4. **Rectangle** corners are inclusive and may come in either order.
5. **Fill** is 4-connected, replaces the cells that equal the start cell's word (a flipped tile is a different word), stays inside the grid, and returns the same `Grid` when the start cell already holds the word. It scans runs, so a large empty level is not one call per cell.
6. **Stamp.** `Stamp { w, h, cells }` is row-major. `pasteStamp` skips empty stamp cells by default (so a pasted shape does not erase what is under its gaps), or writes them with `{ clear: true }`. `flipStamp` mirrors the layout; for tile stamps it also toggles each tile's flip bits, for IntGrid stamps it does not (`kind: 'tile' | 'int'`, as in the cell codec).
7. **Dice.** `paintRandom` picks `candidates[hashCell(seed, 0, x, y, DICE) % n]` per cell, so a stroke repaints the same tiles when it is replayed.
8. **Matching.** A rule reads the source IntGrid in a `size × size` window around the cell. A pattern cell is a predicate on the value read (`empty` is 0, `filled` is not 0). A cell beyond the level reads `rule.outside` (a number, or `'same'` for the centre cell's value). The centre predicate is tested first, as a cheap exit.
9. **Flip variants** are alternatives, tried in the order none, X, Y, XY for those the rule enables; the first that matches wins, and the tile is drawn with that variant's flips. The mirrored pattern reads the source mirrored about the centre.
10. **Chance and variants.** A rule that matches then rolls its chance: `chance >= 1` always applies, `<= 0` never, otherwise `hashCell(seed, ruleKey, x, y, CHANCE) < floor(chance * 2^32)`. A rule whose roll fails did not match, so it adds nothing and does not break. More than one candidate tile picks `tiles[hashCell(seed, ruleKey, x, y, VARIANT) % n]`. A rule with no tiles never applies.
11. **The hash** is the murmur3 finalizer folded over its arguments with `Math.imul`, shifts and xor only, and the rule key is FNV-1a of the rule id. No float is involved except `chance * 2^32`, a single correctly rounded multiply, identical in every engine.
12. **Result shape.** `AutoTiles { cols, rows, stacks }`: `stacks` maps `y * cols + x` to the tiles drawn there, in rule order; a cell with no tile has no entry. `hashAutoTiles` folds it in ascending key order, so the hash does not depend on how the map was built.
13. **Compiled rules and incremental.** `compileRules(groups)` flattens the active rules of the active groups once into the cells each really reads (the 'any' cells of a pattern cost nothing, and a rule that can never draw is left out), and its `radius` is the farthest cell any of them reads (0 for a size-1 rule or a 5 × 5 of 'any' around the centre). `patchAutoTiles(previous, …, changed)` re-evaluates only the cells within that radius of a changed source cell (clipped to the level) and copies the rest from `previous`; a property test checks it equals a full evaluation after random edits and rule sets. It copies the map, which is fine for export and tests; the canvas patches its own sprites from `windowAround` and `evaluateCell`.
14. **Overrides** replace a cell's stack by the one override tile. (Open: how an eraser on an auto layer says "no tile here". The file has no spelling for it, so ED2D.4's default is that the eraser removes the override and the rule output shows again; asked on the bus.)
15. **Diagnostics (deviation from spec §5.6).** The spec's "never matches through flips" cannot happen: flip variants are alternatives and every pattern cell reads a different source cell. Replaced by what can happen: `valueUnknown` (a pattern names an IntGrid value the source layer does not define), `neverFires` (`chance` is 0 or no tiles), `tileOutOfRange` (a tile index beyond the tileset) and `shadowed` (info: an earlier active `breakOnMatch` rule with `chance` 1 and no flips covers every cell this rule could match; same `outside`, a window no larger than this rule's).

## Contract

All in `packages/editor-2d/src/tiles/`, re-exported from `src/index.ts`.

```ts
// hash.ts
export function hashCell(seed: number, key: number, x: number, y: number, salt: number): number   // unsigned 32-bit
export function hashText(text: string): number                                                    // FNV-1a, unsigned
export const SALT: { readonly chance: 1; readonly variant: 2; readonly dice: 3 }

// tile-cell.ts
export function flipCell(cell: number, axis: 'x' | 'y'): number          // toggles the flip bit; 0 stays 0
export function pickTile(grid: Grid, x: number, y: number): UnpackedTile | undefined

// footprint.ts
export interface Point { readonly x: number; readonly y: number }
export function brushCells(at: Point, size: number): Point[]            // row-major
export function lineCells(from: Point, to: Point): Point[]               // Bresenham, both ends

// paint.ts
export function paintCells(grid: Grid, cells: Iterable<Point>, word: number): Grid
export function paintRect(grid: Grid, a: Point, b: Point, word: number): Grid
export function paintRandom(grid: Grid, cells: Iterable<Point>, candidates: readonly number[], seed: number): Grid

// flood-fill.ts
export function floodFill(grid: Grid, at: Point, word: number): Grid

// stamp.ts
export interface Stamp { readonly w: number; readonly h: number; readonly cells: Uint32Array }
export function copyStamp(grid: Grid, x: number, y: number, w: number, h: number): Stamp
export function flipStamp(stamp: Stamp, axis: 'x' | 'y', kind: CellKind): Stamp
export function pasteStamp(grid: Grid, stamp: Stamp, at: Point, options?: { clear?: boolean }): Grid

// autotile/match.ts
export interface AutoTile { readonly tile: number; readonly flipX: boolean; readonly flipY: boolean }
export interface CompiledRules { readonly radius: number /* …and the flat rule list, opaque */ }
export function compileRules(groups: readonly RuleGroup[]): CompiledRules
export function evaluateCell(source: Grid, rules: CompiledRules, seed: number, x: number, y: number): AutoTile[]

// autotile/auto-tiles.ts
export interface AutoTiles { readonly cols: number; readonly rows: number; readonly stacks: ReadonlyMap<number, readonly AutoTile[]> }
export function autoTiles(source: Grid, rules: CompiledRules, seed: number): AutoTiles
export function windowAround(changed: Iterable<Point>, radius: number, cols: number, rows: number): Point[]
export function patchAutoTiles(previous: AutoTiles, source: Grid, rules: CompiledRules, seed: number, changed: Iterable<Point>): AutoTiles
export function applyOverrides(result: AutoTiles, overrides: Grid): AutoTiles
export function hashAutoTiles(result: AutoTiles): number

// autotile/rule-issues.ts
export interface RuleIssue { readonly code: 'valueUnknown' | 'neverFires' | 'tileOutOfRange' | 'shadowed'; readonly severity: 'warning' | 'info' | 'error'; readonly group: string; readonly rule: string; readonly message: string }
export function ruleIssues(groups: readonly RuleGroup[], context: { values: ReadonlySet<number>; tileCount: number | undefined }): RuleIssue[]
```

## Files

**Create** (each with a `*.test.ts` beside it): `src/tiles/hash.ts`, `tile-cell.ts`, `footprint.ts`, `paint.ts`, `flood-fill.ts`, `stamp.ts`, `autotile/match.ts`, `autotile/auto-tiles.ts`, `autotile/rule-issues.ts`, `src/testing/autotile-fixtures.ts`, `src/tiles/autotile/golden.parity.test.ts`.
**Modify:** `src/index.ts` (exports), `vitest.config.ts` (the `browsers` project), `package.json` (`test:parity`, `@vitest/browser-playwright` and `playwright` dev dependencies, the same pins as `packages/sim`), `pnpm-lock.yaml`, `tooling/api-report/reports/editor-2d.api.md`, the spec (decisions above, §5.6 and §5.9 wording, §14), docs 02 and 03.

## Steps

Each step: write the test, run it and confirm it fails for the stated reason, make the minimal change, run it green, tick the box in the same session. Gates after every step: `pnpm --filter @mcthaydt/automata-editor-2d test:unit`, `typecheck`, and `pnpm lint`; before the last commit the full `pnpm check`, `pnpm api-report` and the `browsers` project (Chromium locally; WebKit and Firefox in CI and by a bus `test-request`).

- [x] **1. Hash.** Fails: `hashCell` is not exported. Tests: deterministic; every argument changes the result; results are unsigned 32-bit; recorded values for five fixed inputs (so a change of mixer is a visible diff); `hashText('') === 0x811c9dc5` and the standard FNV-1a vectors for `a` and `foobar`; a 4096-cell sweep puts `hashCell % 4` in each bucket within 10 % of a quarter.
- [x] **2. Tile cells.** Fails: `flipCell` is not exported. Tests: toggles X and Y independently and twice returns the cell; 0 stays 0; the tile index is untouched; `pickTile` returns the tile with its flips, and `undefined` for an empty or outside cell.
- [x] **3. Footprints and lines.** Fails: `brushCells` is not exported. Tests: sizes 1, 2, 3, 4 and 8 have `n²` cells at the offsets of decision 2, row-major; size 0, 9 and 2.5 throw `RangeError`; `lineCells` includes both ends, handles all eight octants, a single point and a reversed line (same cells reversed).
- [x] **4. Paint.** Fails: `paintCells` is not exported. Tests: paints and erases (word 0); the same `Grid` comes back when nothing changes; cells outside are ignored; untouched chunks are shared; `paintRect` in either corner order, clipped at the edges, one cell; `paintRandom` is deterministic for a seed, uses only the candidates, different seeds differ, and an empty candidate list throws.
- [x] **5. Fill.** Fails: `floodFill` is not exported. Tests: fills an enclosed room only; leaks nowhere through a diagonal gap (4-connected); fills the whole empty level in one call (a 4096 × 4096 level finishes with fewer than 4096 `fillRect` calls); a flipped tile is a different word; filling with the cell's own word returns the same `Grid`; a start outside returns the same `Grid`; a seeded property test compares it with a naive per-cell recursion on random 12 × 12 grids.
- [x] **6. Stamps.** Fails: `copyStamp` is not exported. Tests: copy then paste at the same place is the identity; paste skips empty cells, or writes them with `clear`; clipping at the edges; `flipStamp` twice is the identity, mirrors the layout, toggles tile flip bits for `'tile'` and leaves IntGrid values for `'int'`; a stamp with a wrong `cells` length throws.
- [x] **7. Matching.** Fails: `evaluateCell` is not exported. Tests, each on a tiny hand-drawn grid: every pattern cell kind; sizes 1, 3 and 5; `outside` as 0, as a value and as `'same'` at all four edges and a corner; flips in the order none, X, Y, XY (a pattern that matches only mirrored draws mirrored; one that matches both draws unflipped); chance 0, 1, and 0.5 over 4096 cells lands between 45 % and 55 % and is the same on a second run; variants use every candidate and none other; `breakOnMatch` ends the cell, a rule that fails its roll does not break; stacking in rule order; inactive rules and inactive groups are skipped; a rule with no tiles never applies.
- [x] **8. Whole layer, incremental, overrides.** Fails: `autoTiles` is not exported. Tests: `autoTiles` has an entry only for cells with a tile; `hashAutoTiles` is the same for a map built in another order; **property (seeded, 300 runs):** random IntGrid, random rule set (sizes 1 to 5, every cell kind, flips, `outside`, chance, groups), then random edits: `patchAutoTiles(previous, edited, …, changed)` equals `autoTiles(edited, …)`; `autoTileRadius` is 0 for size-1 rules and 2 for a 5 × 5 one and ignores inactive rules; `windowAround` clips; `applyOverrides` replaces a stack with the override tile (with its flips) and leaves other cells alone.
- [x] **9. Rule issues.** Fails: `ruleIssues` is not exported. Tests: each code fires on a hand-made rule and not on a correct one; `shadowed` needs the earlier rule to be active, `breakOnMatch`, chance 1, flip-free, with the same `outside` and a window no larger, and covers a later rule's flipped variants too; ids are the group's and rule's own.
- [ ] **10. Golden and parity.** Fails: `autotile-fixtures` does not exist. Build the platformer rule set (fill with three variants, top and side edges with flips, an inner corner, a 5 × 5 thick-wall rule, a 25 % grass tuft, `breakOnMatch`) and a 48 × 32 cave IntGrid made with integer-only arithmetic. A small hand-drawn map beside it has its expected tile stacks written out by hand; that test is the independent check that the hash is of the right thing. The golden test records `hashAutoTiles` for the cave at three seeds, then runs unchanged in Node and, through `golden.parity.test.ts`, in Chromium, WebKit and Firefox. Add the `browsers` project, the `test:parity` script and the dev dependencies.
- [ ] **11. Exports, reports and docs.** Fails: `src/index.test.ts` finds the new exports missing. Export the contract; regenerate the API report; spec §5.6, §5.9 and §14 wording; docs 02 and 03; execution record here.

## Gates

- Unit: all `src/**/*.test.ts` in Node (the parity file runs there too).
- Parity: `pnpm --filter @mcthaydt/automata-editor-2d test:parity` (Chromium here; WebKit and Firefox on the Mac runners through CI and a bus `test-request`).
- Whole repo before the PR: `pnpm check`, `pnpm api-report`, `pnpm knip`.
- Not claimed: CI, WebKit and Firefox results, Owner acceptance.

## Execution record

- Steps 1 to 5 (hash, tile cells, footprints and lines, paint and dice, fill): 47 unit tests, lint and typecheck pass. Step 1's recorded hashes come from an independent python murmur3_32 that first reproduced the published vectors (`test` → 0xba6bd213, `aaaa` under seed 0x9747b28c → 0x5a97808a, empty under seed 1 → 0x514e28b7); FNV-1a matches the standard vectors. Deviations: `lineCells` always walks from the end that comes first (smaller y, then x) and reverses, so a tie is broken the same way from either end (the plan's "same cells reversed" would fail for Bresenham otherwise); the fill test for a diagonal gap uses a fully walled middle cell (a ring of four walls), since a one-cell room open to its right is not a diagonal case. `src/testing/random.ts` is the shared seeded generator (integer arithmetic only).
- Steps 6 to 8 (stamps, rule matching, whole layer with the incremental property and overrides): 56 tests in `tiles/autotile` plus 15 for stamps; lint and typecheck pass. The incremental property has bite: shrinking the radius by one fails it (checked by hand and put back). Deviations: rules are compiled once (`compileRules`) and the evaluation functions take `CompiledRules`, not raw groups, so the per-cell cost has no id hashing or pattern scan of 'any' cells; `radius` is the real reach of the compiled checks, not `floor(size / 2)`, so a 5 × 5 rule that reads only its centre costs a window of 1; `AutoTile` and `evaluateCell` live in `match.ts`. A symmetric pattern's mirrored variant is dropped at compile time (the plain one always wins), which changes no result.
- Step 9 (rule issues): 18 tests, 74 in `tiles/autotile`; lint and typecheck pass. Deviations from the step text: a rule is shadowed when the earlier rule reads only cells the later one also reads, with a condition at least as narrow (that subsumes "a window no larger"); rules that are off are skipped for every code (they are off on purpose); a pattern or `outside` value that is not in the source layer's value list is `valueUnknown` for `is` and `not` alike. `match.ts` now also exports `KIND`, `Check`, `Variant` and `ruleVariants`, which the issue checker reads (not exported from the package).
