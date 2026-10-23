# ED2D.1 Project model, `.af2d.json` and the profile registry: TDD plan

- **Task:** ED2D.1 in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §4 (ownership, boundary rules), §5.1 to §5.5 and §5.3 (model, layers, grids, tilesets, entities), §6.1 (the working file), §7 (the `Profile` interface), §13 (failure rows for opening); decisions ED2D-D2 to ED2D-D4, ED2D-D6, ED2D-D13; acceptance G-b, G-n, G-o, G-p and the file part of G-a.
- **Lane:** editor-2d. **Depends on:** EDK.7 (typed fields; this PR stacks on #116) and the kit's `History` (EDK.2; only the commands in ED2D.3 and later use it). **Unblocks:** ED2D.2 (tile tools and the auto-tile engine), ED2D.3 (templates, checks, export), EDFF.1 (the FloorFifty profile starts from the `Profile` interface).
- **Status:** Implemented 2026-10-23 on `claude/project-thread-73sp69-ed2d1`, stacked on EDK.7 (#116); locally checked (see the execution record); not CI verified. The 2D spec is drafted, not reviewed.
- **Progress:** 8 of 8 steps.

## Scope

**In:** the new private package `packages/editor-2d` with the headless core, no Svelte, DOM, Pixi, clock or `Math.random`, run in a Node `unit` project:

- `model/ids.ts`: the injected `IdSource`.
- `model/grid.ts`: the chunked immutable `Grid`.
- `model/cells-codec.ts`: the run-length row strings of §5.3.
- `model/project-types.ts` and `model/project.schema.ts`: the project model and its strict zod file schema; `tiles/autotile/rule.schema.ts`: the rule shapes (the engine is ED2D.2).
- `model/project-codec.ts` (decode, encode, the canonical printer), `model/open-project.ts` (the opening rules of §6.1 and §13), `model/json-syntax.ts` (where a text stops being JSON) and `model/migrations/migration.ts` (the chain, empty at version 1).
- `profiles/profile.ts`: the `Profile` interface and the registry.
- `src/architecture.test.ts`: the import-graph rules of spec §4.
- Two small kit changes: `entityDefShape`, so `EntityDef2D` extends the kit's entity schema without copying its keys (kit spec §3), and a `./fields` entry so this Node project imports the field rules without the Svelte shell the kit's root also exports.
- `tooling/api-report/reports/editor-2d.api.md`: `pnpm api-report` covers every `packages/*` folder, private ones included.

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
2. **A layer instance names its layer by `def` and repeats its `kind`** (a change from the spec's extract, now written into it). Its shape is one of `{ def, kind, rows }` (tiles, IntGrid), `{ def, kind, seed, overrides }` (auto) or `{ def, kind, items }` (entities, objects), so the schema validates it without the definitions (a `discriminatedUnion`, with errors that name the branch); the definition's `kind` must agree, else `layerKindMismatch`.
3. **Opening has three outcomes**: `opened` (with `upgradedFrom` after a migration), `readOnly` (a newer `version`, or unknown keys, each carrying the raw text and, for keys, their paths; no model is built, so nothing can be written back) and `failed` (`notJson` with line and column, `notAProject`, `invalid` with issues, `tooLarge`). These are §13's rows.
4. **`duplicateId`, an unknown layer or tileset reference, a row that does not decode (`cellInvalid`: a malformed token or the wrong width or height) and a guard-rail breach (ED2D-D13) are `invalid`** at open, because decoding and every lookup need them. Values that fit the shape but not the world (a tile index beyond its tileset, a broken ref) open and become Checks in ED2D.3.
5. **Canonical print:** UTF-8, two-space `JSON.stringify` layout in schema key order, a final newline; `defs.tilesets`, `defs.entities`, `worlds` and `levels` sorted by id; everything whose order means something (layer definitions, level fields, items, placements, rules) keeps its order. Because one array element prints per line, each grid row is one line (§5.3). Opening a canonical file and printing it is byte-identical (G-b); a hand-edited file with other key order or spacing prints canonically.
6. **A tileset without an `image` is a placeholder** (spec §5.4, ED2D-D11), so `TilesetDef.image` is optional; `imageSize` stays required, because the columns and rows derive from it.
7. **Cell encoding.** A tile cell stores `tile + 1` in bits 0 to 28, `flipX` in bit 30 and `flipY` in bit 31 as in the spec; the row-string token is the tile index followed by `h`, `v` or `hv` (no other spelling decodes), `.` is empty, an IntGrid token is its value 1 to 255, and `*n` repeats a token n times (`n` at least 2 when printing, at least 1 when reading).
8. **Ids.** `IdSource.next()` returns an 8-character base36 string; `counterIds()` is the deterministic source for tests and `randomIds(fill)` takes the host's random-bytes function, so `model/` holds no randomness itself.
9. **The migration chain** is `Migration { from, to, run(raw) }` over the parsed JSON; the real list is empty at version 1, the mechanism is tested with injected migrations, a step that does not advance by one (or two steps from one version) throws, and a version with no step, or a step that throws, is a failed open.
10. **Where JSON fails (added while building).** Safari's `JSON.parse` names no position and §13 needs a line and column, so `json-syntax.ts` reads RFC 8259 itself, only after `JSON.parse` has thrown. A seeded property test (3000 edits of a real file) keeps it in agreement with `JSON.parse` about which texts are valid.
11. **File names follow `pnpm style` (added while building).** The plan named `*.codec.ts`, `*.types.ts` and `*.plugin.ts`; `check-style` knows no `codec` or `types` role and wants `definePlugin` in a `*.plugin.ts`, so they are `cells-codec.ts`, `project-codec.ts`, `project-types.ts` and `profiles/profile.ts`. The spec's file list is updated.
12. **More open-time refusals (added while building).** `layerMismatch` (a level does not hold one instance of every definition in order) and `layerTooLarge` join the list of decision 4; an auto layer whose `source` is missing is `unknownLayer`, and one whose source is not an IntGrid layer is `layerKindMismatch`. They replace the Checks `autoSourceMissing` and `layerMissing`.
13. **Ids and printing (added while building).** Definition and level ids are `/^[a-z][a-z0-9-]*$/` (`DEF_ID`), instance and rule ids `/^[a-z0-9][a-z0-9-]*$/` (`ITEM_ID`); the keys of field values print sorted; a leading byte order mark is ignored on open; the error panel shows at most 100 issues; `printProject` throws on a project the schema would refuse.

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

### `model/cells-codec.ts`

```ts
export type CellKind = 'tile' | 'int'
export interface CellProblem { readonly row: number; readonly token?: number; readonly message: string }
export function encodeRows(grid: Grid, kind: CellKind): string[]
export function decodeRows(rows: readonly string[], kind: CellKind, cols: number, rowCount: number): { ok: true; grid: Grid } | { ok: false; problems: CellProblem[] }
```

### `model/project-types.ts`, `model/project.schema.ts`, `tiles/autotile/rule.schema.ts`

The types of spec §5.1 to §5.6 as written there (`Project`, `Definitions`, `World`, `Level`, `LayerDef`, `LayerInstance`, `TilesetDef`, `EntityDef2D`, `EntityInstance`, `ObjectInstance`, `RuleGroup`, `Rule`, `PatternCell`) with decisions 1, 2 and 6, plus `ProjectFile` (the schema's output). `projectFileSchema` is a strict object tree: an unknown key at any depth is an issue. Guard rails (ED2D-D13) are bounds in the schema (grid cell 4 to 256 px, level side up to 16 384 px, at most 256 levels and 64 layer definitions); the 1024-cell layer limit is checked in `decodeProject`, before a grid is allocated. `entityDef2DSchema` is the kit's `entityDefShape` plus the 2D keys and runs the kit's `checkEntityDef` from `superRefine`.

### `model/project-codec.ts`, `model/migrations/migration.ts`

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

### `profiles/profile.ts`

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
| 3 | Cell codec | `model/cells-codec.test.ts`: the spec's example `".*5 7h*3 2 .*24"`, one spelling per grid, flips, `*n` rules, an all-empty row, malformed tokens (`7x`, `0` for int, `300`, `vh`, `*0`), wrong width or row count with row and token positions; property: `decode(encode(grid))` equals the grid over seeded random grids of both kinds | unit |
| 4 | Types and strict zod schema, kit `entityDefShape` | `model/project.schema.test.ts`: a minimal file parses; every shape in §5 round-trips through parse; an unknown key at depth is an issue with its path; each guard rail refuses; a rule pattern whose length is not `size²` fails; the kit test `entityDefShape` keys equal `entityDefSchema`'s | unit |
| 5 | Decode, encode, canonical print | `model/project-codec.test.ts`: fixtures (minimal, platformer-like with all five layer kinds, an RPG-like with objects and refs); decode builds the grids; `encode∘decode` is the identity on the file shape; **G-b** a canonical text prints byte-identical; non-canonical key order and spacing print canonically; sorted arrays; `layerKindMismatch`, unknown layer or tileset ref, `duplicateId`, `cellInvalid` with its path, a 1025-column layer | unit |
| 6 | Opening rules and migrations | `model/open-project.test.ts`: **G-n** not JSON (line and column) and `format` other than `af2d`; **G-o** a newer `version` is read-only with the raw text and is never re-printed by the API; **G-p** an unknown key is read-only with the key paths; an older version runs injected migrations in order and reports `upgradedFrom`; a gapped or non-advancing chain is refused; a file over 16 MB is `tooLarge` | unit |
| 7 | Profile interface and registry | `profiles/profile.test.ts`: register, list in order, get, duplicate id throws, unregister, `sniff` returns every claimant in registration order, two claimants are both returned | unit |
| 8 | Boundary test, exports, gates (architecture rules in `src/testing/architecture.ts`, which uses `oxc-parser` as a dev dependency) | `architecture.test.ts` (first fails when a planted banned token or import is in a temp fixture string, then passes on the real tree): `model/` and `tiles/` import no Svelte, DOM or Pixi and use no `Date`, timers, `performance`, `Math.random` or `crypto`; nothing but `app/profiles.ts` imports `profiles/*`; profiles never import each other; no template or profile id in `app`, `tiles`, `canvas` (G-s, vacuous until those folders exist). Then `pnpm exec biome check --write`, package typecheck and unit, `pnpm lint`, `pnpm style`, `pnpm knip`, `pnpm boundaries`, frozen install; docs 02 and 03; spec edits for decisions 1 to 9 | unit and gates |

## Acceptance (2D spec)

G-b (canonical text prints byte-identical), G-n, G-o and G-p (the three refusals) pass in unit tests; the file part of G-a (a project that prints and re-opens equals itself) passes for the fixtures. The rest of G-a, G-c to G-m and G-q to G-t need later tasks.

## Risks

- **A second model shape.** `Project` and `ProjectFile` both exist, which is a cost; the alternative (grids as row arrays in memory) would make every stroke a string rebuild. Mitigation: one `encodeProject` and one `decodeProject`, and a test that `encode∘decode` is the identity.
- **Zod and unknown keys.** Strictness is the point (G-p), but zod reports an unknown key as an issue with the parent path; the key path list must name the key itself. A test per depth pins it.
- **Spec drift.** Decisions 1 to 9 refine §5.1, §5.4 and §6.1; they are written back into the spec here so ED2D.2, ED2D.3 and EDFF.1 read one text.
- **Package size.** One PR holds a package scaffold and eight steps. The steps are independent commits so the review can go step by step.

## Execution record

2026-10-23, one session, commits on `claude/project-thread-73sp69-ed2d1` (base: EDK.7, #116). Every step: the test first, its failure confirmed for the expected reason (a missing module), then the minimal change.

| Step | Commit | What landed |
|---|---|---|
| 1 | `93f1bd3` | package scaffold, `IdSource` (`counterIds`, `randomIds`), 6 tests |
| 2 | `992261e` | chunked immutable `Grid`, 19 tests |
| 3 | `ace4896` | run-length cell codec and tile packing, 19 tests including a seeded round-trip property |
| kit | `4e11d14` | `entityDefShape`, `entityDefIssues`, kit change request from step 4 |
| 4 | `2318007` | `project-types.ts`, strict `project.schema.ts`, `rule.schema.ts`, shared fixtures; the kit `./fields` entry; 49 schema tests |
| 5 | `1bad5af` | `decodeProject`, `encodeProject`, `printProject`; 27 tests |
| 6 | `0ae7242` | `openProject`, `migrate`, `findJsonError`; 50 tests (24 open, 7 migration, 25 JSON, the last with a 3000-edit property against `JSON.parse`) |
| 7 | `6bfd85f` | `Profile`, `ProfileRegistry`; 10 tests |
| 8 | this PR's last commit | `architecture.test.ts` (13 tests: planted trees, then the real tree), `index.ts` and its test, API reports, docs |

**Deviations and rulings**

- File names changed from the plan (decision 11) because `pnpm style` rejects the `codec` and `types` roles.
- `kind` is stored in the file's layer instances (decision 2). The spec's extract and §6.1 now show it.
- The kit gained a `./fields` entry. Its root exports `EditorShell` (a `.svelte` file), which a Node project cannot load; the root re-exports the entry, so the shells are unaffected (kit test `src/fields/index.test.ts`).
- `pnpm api-report` failed for `editor-kit` in CI's lint job once the unit step passes (the step is after `test:unit`, so earlier runs never reached it). `editor-kit.api.md` is now committed on #106, #109 and #116, and `editor-kit.api.md` and `editor-2d.api.md` here. #109 and #116 both change `editor-kit.api.md`: the second to merge regenerates it with `pnpm api-report --update` after merging main.
- `oxc-parser` 0.152.0 (the version `check-style` already pins) is a dev dependency of `editor-2d` for the architecture test; `pnpm deps:new` could not run in the container (api.npmjs.org unreachable).

**Verification (local, Node 24, in the cloud container)**

- `pnpm exec vitest run --project unit` in `packages/editor-2d`: 204 tests, 12 files, pass. `packages/editor-kit` unit: 143 tests pass.
- `pnpm lint` (0 errors, the 175 warnings already on main), `pnpm typecheck` (36 tasks), `pnpm boundaries`, `pnpm style` (0 findings), `pnpm knip`, `pnpm api-report`, `pnpm install --frozen-lockfile`: pass.
- Not run: the full-repo `pnpm test:unit`, CI, the cross-engine parity suites (nothing here touches the sim or a browser), `pnpm deps:new`, Owner acceptance.

**Acceptance (2D spec §15):** G-b, G-n, G-o and G-p pass in unit tests (`project-codec.test.ts`, `open-project.test.ts`); the file part of G-a (a project that prints and re-opens equals itself) passes for the two fixtures. The rest of G-a and G-c to G-t need later tasks.
