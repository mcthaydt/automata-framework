# ED2D.1 Project model, `.af2d.json` and the profile registry: TDD plan

- **Task:** ED2D.1 in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §4 (ownership, boundary rules), §5.1 to §5.5 and §5.3 (model, layers, grids, tilesets, entities), §6.1 (the working file), §7 (the `Profile` interface), §13 (failure rows for opening); decisions ED2D-D2 to ED2D-D4, ED2D-D6, ED2D-D13; acceptance G-b, G-n, G-o, G-p and the file part of G-a.
- **Lane:** editor-2d. **Depends on:** EDK.7 (typed fields; this PR stacks on #116) and the kit's `History` (EDK.2; only the commands in ED2D.3 and later use it). **Unblocks:** ED2D.2 (tile tools and the auto-tile engine), ED2D.3 (templates, checks, export), EDFF.1 (the FloorFifty profile starts from the `Profile` interface).
- **Status:** Planned 2026-10-23. Nothing implemented yet. The 2D spec is drafted, not reviewed.
- **Progress:** 0 of 8 steps.

## Scope

**In:** the new private package `packages/editor-2d` with the headless core, no Svelte, DOM, Pixi, clock or `Math.random`, run in a Node `unit` project:

- `model/ids.ts`: the injected `IdSource`.
- `model/grid.ts`: the chunked immutable `Grid`.
- `model/cells.codec.ts`: the run-length row strings of §5.3.
- `model/project.types.ts` and `model/project.schema.ts`: the project model and its strict zod file schema; `tiles/autotile/rule.schema.ts`: the rule shapes (the engine is ED2D.2).
- `model/project.codec.ts`: file text to `Project` and back, the canonical printer, the opening rules of §6.1 and §13, and `model/migrations/` (the chain, empty at version 1).
- `profiles/profile.plugin.ts`: the `Profile` interface and the registry.
- `src/architecture.test.ts`: the import-graph rules of spec §4.
- A small kit change request: `entityDefShape`, so `EntityDef2D` extends the kit's entity schema without copying its keys (kit spec §3).

**Out, with owner:**

| What | Where |
|---|---|
| Commands (`createProject`, `paintCells`, `addLevel`, …) and the templates | ED2D.3 (templates, `createProject`), ED2D.4 and later (the rest); `History` wiring is the app's |
| Painting tools, the auto-tile engine and its hash | ED2D.2 |
| Checks (`tileOutOfRange`, `brokenRef`, `minNotMet`, …), the AF content export | ED2D.3 |
| The built-in `level-project` profile object | ED2D.3 (it needs templates and checks); ED2D.1 ships the interface and registry only |
| Views, canvas, stores, Home | ED2D.4 and later |
| The FloorFifty profile | EDFF.1 |

## Decisions made here (written into the 2D spec in this PR)

1. **One model, two shapes.** `Project` (grids as `Grid`) is the in-memory model; the file shape (`ProjectFile`, grids as row strings) is the zod schema. `decodeProject` and `encodeProject` convert, with the layer definitions telling a `rows` instance whether it is tiles or IntGrid and giving its size (`ceil(level / grid)` cells).
2. **A layer instance names its layer by `def` only**, as in the spec's extract. Its shape is one of `{ def, rows }` (tiles, IntGrid), `{ def, seed, overrides }` (auto) or `{ def, items }` (entities, objects); the definition's `kind` must agree, else `layerKindMismatch`.
3. **Opening has three outcomes**: `opened` (with `upgradedFrom` after a migration), `readOnly` (a newer `version`, or unknown keys, each carrying the raw text and, for keys, their paths; no model is built, so nothing can be written back) and `failed` (`notJson` with line and column, `notAProject`, `invalid` with issues, `tooLarge`). These are §13's rows.
4. **`duplicateId`, an unknown layer or tileset reference, a row that does not decode (`cellInvalid`: a malformed token or the wrong width or height) and a guard-rail breach (ED2D-D13) are `invalid`** at open, because decoding and every lookup need them. Values that fit the shape but not the world (a tile index beyond its tileset, a broken ref) open and become Checks in ED2D.3.
5. **Canonical print:** UTF-8, two-space `JSON.stringify` layout in schema key order, a final newline; `defs.tilesets`, `defs.entities`, `worlds` and `levels` sorted by id; everything whose order means something (layer definitions, level fields, items, placements, rules) keeps its order. Because one array element prints per line, each grid row is one line (§5.3). Opening a canonical file and printing it is byte-identical (G-b); a hand-edited file with other key order or spacing prints canonically.
6. **A tileset without an `image` is a placeholder** (spec §5.4, ED2D-D11), so `TilesetDef.image` is optional; `imageSize` stays required, because the columns and rows derive from it.
7. **Cell encoding.** A tile cell stores `tile + 1` in bits 0 to 28, `flipX` in bit 30 and `flipY` in bit 31 as in the spec; the row-string token is the tile index followed by `h`, `v` or `hv` (no other spelling decodes), `.` is empty, an IntGrid token is its value 1 to 255, and `*n` repeats a token n times (`n` at least 2 when printing, at least 1 when reading).
8. **Ids.** `IdSource.next()` returns an 8-character base36 string; `counterIds()` is the deterministic source for tests and `randomIds(fill)` takes the host's random-bytes function, so `model/` holds no randomness itself.
9. **The migration chain** is `Migration { from, to, run(raw) }` over the parsed JSON; the real list is empty at version 1, the mechanism is tested with injected migrations, and a chain with a gap or a step that does not advance by one is refused.

## Contract

All in `packages/editor-2d/src/`, re-exported from `src/index.ts`.

### `model/ids.ts`

```ts
export interface IdSource { next(): string }
export function counterIds(start?: number): IdSource                         // '00000001', '00000002', … (base36, zero-padded)
export function randomIds(fill: (bytes: Uint8Array) => void): IdSource      // 8 base36 characters per id
```

### `model/grid.ts`

```ts
export const CHUNK = 16
export class Grid {
  readonly cols: number; readonly rows: number
  static empty(cols: number, rows: number): Grid
  get(x: number, y: number): number                          // 0 outside the grid
  set(x: number, y: number, value: number): Grid            // same Grid when nothing changes or (x, y) is outside
  fillRect(x: number, y: number, w: number, h: number, value: number): Grid   // clipped to the grid
  edit(fn: (cells: GridEditor) => void): Grid               // many writes, each touched chunk copied once
  resize(cols: number, rows: number): Grid                   // cells outside the new size are dropped
  equals(other: Grid): boolean
  nonEmpty(): Iterable<{ x: number; y: number; value: number }>   // row-major
  readonly chunkCount: number                                // chunks that hold at least one non-zero cell
  sharesChunk(other: Grid, x: number, y: number): boolean    // for the structural-sharing tests
}
```

Every edit returns a new `Grid` that shares each untouched chunk; an all-zero chunk is dropped (ED2D-D4).

### `model/cells.codec.ts`

```ts
export type CellKind = 'tile' | 'int'
export interface CellProblem { readonly row: number; readonly token?: number; readonly message: string }
export function encodeRows(grid: Grid, kind: CellKind): string[]
export function decodeRows(rows: readonly string[], kind: CellKind, cols: number, rowCount: number): { ok: true; grid: Grid } | { ok: false; problems: CellProblem[] }
```

### `model/project.types.ts`, `model/project.schema.ts`, `tiles/autotile/rule.schema.ts`

The types of spec §5.1 to §5.6 as written there (`Project`, `Definitions`, `World`, `Level`, `LayerDef`, `LayerInstance`, `TilesetDef`, `EntityDef2D`, `EntityInstance`, `ObjectInstance`, `RuleGroup`, `Rule`, `PatternCell`) with decisions 1, 2 and 6, plus `ProjectFile` (the schema's output). `projectFileSchema` is a strict object tree: an unknown key at any depth is an issue. Guard rails (ED2D-D13) are bounds in the schema (grid cell 4 to 256 px, level side up to 16 384 px, at most 256 levels and 64 layer definitions); the 1024-cell layer limit is checked in `decodeProject`, before a grid is allocated. `entityDef2DSchema` is the kit's `entityDefShape` plus the 2D keys and runs the kit's `checkEntityDef` from `superRefine`.

### `model/project.codec.ts`, `model/migrations/migration.ts`

```ts
export const FILE_VERSION = 1
export type OpenResult =
  | { readonly status: 'opened'; readonly project: Project; readonly upgradedFrom?: number }
  | { readonly status: 'readOnly'; readonly reason: 'newerVersion' | 'unknownKeys'; readonly message: string; readonly text: string; readonly keyPaths?: readonly string[] }
  | { readonly status: 'failed'; readonly code: 'notJson' | 'notAProject' | 'invalid' | 'tooLarge'; readonly message: string; readonly line?: number; readonly column?: number; readonly issues?: readonly OpenIssue[] }
export interface OpenIssue { readonly code: string; readonly path: string; readonly message: string }
export function openProject(text: string, migrations?: readonly Migration[]): OpenResult
export function printProject(project: Project): string
export function decodeProject(file: ProjectFile): { ok: true; project: Project } | { ok: false; issues: OpenIssue[] }
export function encodeProject(project: Project): ProjectFile
```

Issue paths address the object as in spec §9 (`levels[moss-steps].layers[collision].rows[3]`).

### `profiles/profile.plugin.ts`

The `Profile<V>` interface of spec §7 with `Result<T, E>`, `ParseError` (`{ code, message, path?, line?, column? }`), `Diagnostic` (`{ severity, code, path, message, fix? }`), `ProjectContext` (`{ assets?: readonly string[] }`, the workspace's known asset paths), `ViewDef` (`{ id, label, component }`, a rail destination that names a component) and `ExportTarget<V>` (`{ id, label, files(value): { path, contents }[] }`). And:

```ts
export interface ProfileRegistry {
  register(profile: Profile<unknown>): () => void       // throws on a duplicate id; returns unregister
  list(): readonly Profile<unknown>[]                    // in registration order
  get(id: string): Profile<unknown> | undefined
  sniff(fileName: string, text: string): readonly Profile<unknown>[]   // every profile that claims the file; the app asks when two do
}
export function createProfileRegistry(): ProfileRegistry
```

## Steps (each: failing test first, confirm the reason, minimal change, verify)

| # | Step | Test file and what fails first | Verify |
|---|---|---|---|
| 1 | Package scaffold; `IdSource` | `model/ids.test.ts`: "Failed to resolve import"; `counterIds` is unique, zero-padded, matches `/^[0-9a-z]{8}$/` and restarts from a given start; `randomIds` maps fixed bytes to a fixed id | unit, typecheck, knip, `pnpm install --frozen-lockfile` |
| 2 | Chunked `Grid` | `model/grid.test.ts`: get, set and `fillRect` (clipped), the same object when nothing changes, untouched chunks shared and an all-zero chunk dropped, `edit` copies each chunk once, `resize` drops outside cells, `equals`, `nonEmpty` order, out-of-range writes ignored | unit |
| 3 | Cell codec | `model/cells.codec.test.ts`: the spec's example `".*5 7h*3 2 .*24"`, one spelling per grid, flips, `*n` rules, an all-empty row, malformed tokens (`7x`, `0` for int, `300`, `vh`, `*0`), wrong width or row count with row and token positions; property: `decode(encode(grid))` equals the grid over seeded random grids of both kinds | unit |
| 4 | Types and strict zod schema, kit `entityDefShape` | `model/project.schema.test.ts`: a minimal file parses; every shape in §5 round-trips through parse; an unknown key at depth is an issue with its path; each guard rail refuses; a rule pattern whose length is not `size²` fails; the kit test `entityDefShape` keys equal `entityDefSchema`'s | unit |
| 5 | Decode, encode, canonical print | `model/project.codec.test.ts`: fixtures (minimal, platformer-like with all five layer kinds, an RPG-like with objects and refs); decode builds the grids; `encode∘decode` is the identity on the file shape; **G-b** a canonical text prints byte-identical; non-canonical key order and spacing print canonically; sorted arrays; `layerKindMismatch`, unknown layer or tileset ref, `duplicateId`, `cellInvalid` with its path, a 1025-column layer | unit |
| 6 | Opening rules and migrations | `model/open-project.test.ts`: **G-n** not JSON (line and column) and `format` other than `af2d`; **G-o** a newer `version` is read-only with the raw text and is never re-printed by the API; **G-p** an unknown key is read-only with the key paths; an older version runs injected migrations in order and reports `upgradedFrom`; a gapped or non-advancing chain is refused; a file over 16 MB is `tooLarge` | unit |
| 7 | Profile interface and registry | `profiles/profile.plugin.test.ts`: register, list in order, get, duplicate id throws, unregister, `sniff` returns every claimant in registration order, two claimants are both returned | unit |
| 8 | Boundary test, exports, gates | `architecture.test.ts` (first fails when a planted banned token or import is in a temp fixture string, then passes on the real tree): `model/` and `tiles/` import no Svelte, DOM or Pixi and use no `Date`, timers, `performance`, `Math.random` or `crypto`; nothing but `app/profiles.ts` imports `profiles/*`; profiles never import each other; no template or profile id in `app`, `tiles`, `canvas` (G-s, vacuous until those folders exist). Then `pnpm exec biome check --write`, package typecheck and unit, `pnpm lint`, `pnpm style`, `pnpm knip`, `pnpm boundaries`, frozen install; docs 02 and 03; spec edits for decisions 1 to 9 | unit and gates |

## Acceptance (2D spec)

G-b (canonical text prints byte-identical), G-n, G-o and G-p (the three refusals) pass in unit tests; the file part of G-a (a project that prints and re-opens equals itself) passes for the fixtures. The rest of G-a, G-c to G-m and G-q to G-t need later tasks.

## Risks

- **A second model shape.** `Project` and `ProjectFile` both exist, which is a cost; the alternative (grids as row arrays in memory) would make every stroke a string rebuild. Mitigation: one `encodeProject` and one `decodeProject`, and a test that `encode∘decode` is the identity.
- **Zod and unknown keys.** Strictness is the point (G-p), but zod reports an unknown key as an issue with the parent path; the key path list must name the key itself. A test per depth pins it.
- **Spec drift.** Decisions 1 to 9 refine §5.1, §5.4 and §6.1; they are written back into the spec here so ED2D.2, ED2D.3 and EDFF.1 read one text.
- **Package size.** One PR holds a package scaffold and eight steps. The steps are independent commits so the review can go step by step.

## Execution record

(Filled in as steps complete.)
