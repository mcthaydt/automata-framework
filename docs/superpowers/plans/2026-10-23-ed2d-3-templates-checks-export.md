# ED2D.3 Templates, checks and AF content export: TDD plan

- **Task:** ED2D.3 in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §6.2 (AF content export), §7 (the `level-project` profile and its templates), §9 (checks); acceptance G-i and the "zero errors" part of flow 1; the sample projects of §14.
- **Lane:** editor-2d. **Depends on:** ED2D.1 (model, codec, profile registry) and ED2D.2 (rule engine and its issues); this PR stacks on #131. **Unblocks:** ED2D.4 (Home lists the templates, the Level view opens a starter level, the registration list imports the profile) and ED2D.7 (the Checks panel and Export dialog show what this task computes).
- **Status:** Planned 2026-10-23 on `claude/project-thread-73sp69-ed2d3`. The 2D spec is drafted, not reviewed.
- **Progress:** 0 of 10 steps.

## Scope

**In:** headless code in `packages/editor-2d/src/profiles/level-project/` (plus two small shared helpers in `model/`), renderer-free:

- Three templates (`platformer`, `topdown-rpg`, `blank`) that build a valid starter project from an injected `IdSource`, with generated placeholder tilesets (definitions without an image) and the auto-tile rules the spec names.
- The checks of spec §9 as one pure function over a `Project`, with paths and fix names.
- The AF content export: `project.toml`, `levels/<id>.toml`, `world.toml`, its zod schema (`content.schema.ts`), and the tests that decode what was written back to the editor's grids.
- The `level-project` `Profile` (sniff, parse, print, check, templates, views, exports), and the two sample projects (Mossgate, Hollowmere) the spec's fixtures list names.

**Out, with owner:**

| What | Where |
|---|---|
| Commands (`createProject`, `addLevel`, `paintCells`, …) as named `History` functions | ED2D.4 (the canvas tools call them); the template `create` is `createProject` |
| Applying a fix (`remove`, `move-inside`, `choose-target`) | ED2D.7 (the Checks panel); this task only names the fix on the diagnostic |
| Drawing the placeholder tiles (colour and glyph per index) | ED2D.4 (`textures.manager.ts`); the template only declares the tileset |
| `app/profiles.ts`, the registration list, and every Svelte view the profile names | ED2D.4 to ED2D.7 |
| Importing a tileset image; `missingTileset` needs the workspace's asset list, which the app passes in `ProjectContext` | ED2D.4, ED2D.5 |
| A game that reads the TOML (a `tilemap` extension) | Unplanned, spec §17.1 |

## Decisions made here (written into the 2D spec in this PR)

1. **Templates are data built by code.** `create(ids)` returns a `Project` whose every instance id comes from `ids` (a counter in tests), so a test compares the whole value. Layer instances of a level come from one shared helper, `emptyLayers(defs, size)` in `model/level-layers.ts` (a grid of `ceil(side / cell)` cells per side, auto seed 1), which `addLevel` will reuse in ED2D.4.
2. **The platformer's 47-tile terrain set is generated, not typed.** The blob set: a solid cell's four edge neighbours (N, E, S, W) and, for each diagonal whose two adjacent edges are both solid, that diagonal. That is 1 + 4 + 8 + 2 + 16 + 16 = 47 distinct neighbourhoods, one rule each (`breakOnMatch`, `outside: 'same'`, no flips), tile index = the rule's position in a fixed order. A test proves that all 256 neighbourhoods of a solid cell match exactly one blob rule. Spike, water, ladder and one-way get one size-1 rule each.
3. **The RPG's walls use a 16-tile 4-neighbour set** (index `8 + N + 2E + 4S + 8W`), plus one rule each for water and door-frame. Same generator style, same exactly-one-rule test.
4. **Tileset size is derived.** `tilesetTiles(def)` in `model/tileset-grid.ts` gives columns, rows and count from `imageSize`, `tile`, `spacing` and `padding` (the spec's rule in §5.4); the checks, the templates' tests and the export all use it.
5. **Checks return the spec's codes plus four additions**, each because a state the spec allows had no code: `ruleValueUnknown` (the engine's `valueUnknown`), `placementUnknownLevel` (a world places a level that does not exist), `cellValueUnknown` (an IntGrid cell holds a value the layer does not define) and the severity of `ruleNeverMatches` is the engine's (warning), not the table's info. Spec §9 is amended.
6. **Aggregation.** `tileOutOfRange` and `cellValueUnknown` are one diagnostic per layer instance ("3 cells use tiles beyond the tileset's 64"), so "Remove 3 stray tiles" is one fix. Everything else is one diagnostic per object.
7. **Bounds.** An entity or object is out of bounds when its anchor `(x, y)` is outside `[0, w] × [0, h]` of its level. `levelsOverlap` is for free worlds and means the same depth and an intersection of positive area (different depths overlap on purpose).
8. **Refs.** A `ref` value resolves by its field's `to`: `$level` means `target` is a level id; any other entry is an entity definition id, and `target` is an instance id, found by id across the project (ids are unique) and, when the value has a `container`, required to be in that level. Not found, or in the wrong container, is `brokenRef`; found with a definition that `to` does not allow is `refWrongKind`.
9. **Export shape** (spec §6.2, now exact). Header comment `# Generated by the Automata 2D editor from "<name>". Do not edit; export again.`, then `format = "af2d-content"`, `version = 1`. `project.toml`: name, template, `[[layers]]` (id, kind, grid, tileset, snap, source, `[[layers.values]]`), `[[tilesets]]` (id, tile, columns, rows, spacing, padding, `image` or `placeholder = true`, tags), `[[entities]]` (the whole definition: shape, size, pivot, resizable, tags, single, min, fields), `[[levelFields]]`. `levels/<id>.toml`: id, name, size, background, fields, `[[layers]]` with `rows` (tiles, IntGrid) in the file's own row-string format, `[[layers.stack]]` for an auto layer (one `rows` per stack depth, depth 0 drawn first, overrides already applied, tile row-strings), `[[layers.items]]` for entities and objects. `world.toml`: `[[worlds]]` with placements and, for a `grid` world, each level's `neighbours` (north, east, south, west: the levels whose edge touches this one's edge along a span of positive length, in position then id order). Floats whose value is whole print as TOML integers (smol-toml's printer); `project.toml` declares the type.
10. **Profile mapping.** `parse` returns `ok` only when `openProject` opened; a read-only or failed outcome becomes errors with the same codes (`newerVersion`, `unknownKeys` once per key path, `notJson` with line and column, `notAProject`, `invalid` with paths, `tooLarge`). The app that wants the read-only text view already has the text. `sniff` accepts a name ending `.af2d.json`, or text whose first 4 KB holds `"format": "af2d"`.
11. **New dependency, no new pin.** `smol-toml` 1.9.0 is already pinned and recorded (`packages/content`, `packages/cli`, `packages/ship`); `editor-2d` depends on it at the same version, and the `docs/versions.md` row names the new use. `ProjectContext` gains `imageSizes` (path to measured size) for `tilesetImageChanged`.

## Contract

```ts
// model/level-layers.ts
export function layerCells(size: Size, grid: number): { cols: number; rows: number }
export function emptyLayers(layers: readonly LayerDef[], size: Size): LayerInstance[]   // one per definition, in order

// model/tileset-grid.ts
export function tilesetTiles(def: TilesetDef): { columns: number; rows: number; count: number }

// profiles/level-project/
export const levelProject: Profile<Project>
export function checkProject(project: Project, context: ProjectContext): Diagnostic[]   // errors, then warnings, then info; discovery order within
export function exportContent(project: Project): { path: string; contents: string }[]  // project.toml, levels/<id>.toml…, world.toml
// content.schema.ts: contentProjectSchema, contentLevelSchema, contentWorldSchema (zod, strict)
// templates/: platformerTemplate, topdownRpgTemplate, blankTemplate: TemplateDef<Project>
```

## Files

Create: `src/model/level-layers.ts`, `src/model/tileset-grid.ts` (+ tests); under `src/profiles/level-project/`: `templates/placeholder-tileset.ts`, `templates/blob-rules.ts`, `templates/platformer.ts`, `templates/topdown-rpg.ts`, `templates/blank.ts`, `checks/definitions.ts`, `checks/levels.ts`, `checks/entities.ts`, `checks/links.ts`, `checks/index.ts` (assembles, sorts), `project-checks.ts`, `content.schema.ts`, `content-export.ts`, `level-project.ts` (+ a `*.test.ts` beside each); `src/testing/samples.ts`, `src/testing/project-edit.ts`.
Modify: `src/profiles/profile.ts` (`ProjectContext.imageSizes`), `src/index.ts`, `packages/editor-2d/package.json` (`smol-toml`), `pnpm-lock.yaml`, `docs/versions.md`, the 2D spec (§6.2, §7, §9), `docs/02-master-delivery-plan.md`, `docs/03-continuation-prompt.md`, `tooling/api-report/reports/automata-editor-2d.api.md`.

## Steps

Each step starts with a failing test and the reason it fails.

- [x] **1. Layers and tileset math.** Fails: `emptyLayers` and `tilesetTiles` are not exported. Tests: one instance per definition in order; cells per side are `ceil(side / grid)`; auto layers get seed 1 and empty overrides; entity and object layers start empty; a 128 × 128 set of 16 px tiles has 8 × 8 = 64 tiles; spacing and padding reduce columns exactly as §5.4 says; a size that is not a multiple floors.
- [ ] **2. Placeholder tilesets and generated rules.** Fails: the generators are not exported. Tests: `placeholderTileset` has no image, the size its columns and rows imply and the tags it is given; the blob generator yields 47 distinct rules; for each of the 256 neighbourhoods of a solid cell exactly one blob rule matches (the compiled engine, `outside: 'same'`); the 4-neighbour generator yields 16 rules and the same exactly-one property; `ruleIssues` finds nothing in either set.
- [ ] **3. Templates.** Fails: the three templates are not exported. Tests: each `create(counterIds())` opens through `openProject(printProject(value))` as the same project; the platformer has the spec's layers in front-to-back order, definitions (player-start single with `min`, slime fields, door's required `target`), level field and 512 × 288 level with a floor and a player start; the RPG has its layers, definitions, 320 × 240 level, grass ground and player start; `blank` has the two layers, one tileset, no entity definition and a 256 × 256 level; ids come from the source (a second source continuing the counter gives different instance ids).
- [ ] **4. Definition and level checks.** Fails: `checkProject` is not exported. Tests, one per code, each on a valid template edited with `project-edit.ts` so only that code appears: `missingTileset`, `tilesetImageChanged`, `fieldDefInvalid`, `ruleTileOutOfRange`, `ruleValueUnknown`, `ruleNeverMatches`, `ruleShadowed`, `unusedDefinition`, `tileOutOfRange` (tiles, objects and auto overrides; aggregated; fix `remove`), `cellValueUnknown`, `unknownEntityDef`, `entityOutOfBounds` (fix `move-inside`), `levelOutsideWorld`, `placementUnknownLevel`, `levelsOverlap` (same depth only, free layout only), `emptyLevel`. Paths are the spec's.
- [ ] **5. Entity and link checks.** Fails: no entity or link code is reported. Tests: `fieldMissing` (a door without `target`), `fieldInvalid` (hp above max, and a level field), `singleExceeded` (two player-starts in one level), `minNotMet` (no player-start in the project; a per-level minimum), `brokenRef` (target deleted, wrong container, `$level` naming nothing; fix `choose-target`), `refWrongKind`; a ref list with one bad member reports that member. Ordering: errors, warnings, info, each in discovery order; the result for a fixed project is identical on every call.
- [ ] **6. All three templates are clean.** Fails: the platformer reports an error for a reason the test names (adjust the template, never the check). Tests: `checkProject` on each starter has no error and no warning; the only infos are `unusedDefinition` for definitions the starter does not use and `emptyLevel` for `blank`.
- [ ] **7. Content schema and export, tiles and entities.** Fails: `exportContent` is not exported. Tests: the file list and order; the header comment; `project.toml`, every level file and `world.toml` parse with `smol-toml` and validate against the content schemas; rows of tiles and IntGrid layers decode (`decodeRows`) to grids equal to the editor's; items carry typed fields (a point list, a ref, a colour, a float); the output is byte-identical on a second call; a project with the same content in another definition order is not required to match (order is the project's).
- [ ] **8. Auto layers and grid-world neighbours.** Fails: auto layers and neighbours are missing from the export. Tests: each stack depth decodes to the tiles `applyOverrides(autoTiles(...))` gives, with overrides replacing the stack; a level with no ground has no stack; a `grid` world lists neighbours by touching edges (equal and unequal sizes, corner contact is not a neighbour); a `free` world has none.
- [ ] **9. The profile and the samples.** Fails: `levelProject` is not exported. Tests: the registry accepts it; `sniff` by name and by text; `parse` maps each `openProject` outcome (G-n, G-o, G-p) to errors with positions and codes; `print(parse(x))` is `x` for the canonical file (G-b); the three templates, the six views, the two exports; the samples Mossgate (platformer, two linked levels, three slimes with patrol paths, coins, a door, a spike) and Hollowmere (RPG, village and inn linked by a door and a warp, two NPCs) open, check with zero errors, and **export for G-i** (validates, decodes equal, auto layers resolved). The architecture test still passes (no profile or template id outside `profiles/`).
- [ ] **10. Gates and docs.** Amend spec §6.2, §7, §9 and the testing section for what was decided; tick nothing the Owner owns; update rows in 02 and 03; `pnpm install --lockfile-only`, frozen install, `api-report --update`, repo-level lint, style, knip, boundaries, typecheck, and the package's whole unit suite.

## Gates

`pnpm --filter @mcthaydt/automata-editor-2d test:unit` and `typecheck`; repo-level `pnpm lint`, `style`, `knip`, `boundaries`, `api-report`; `pnpm --filter @mcthaydt/versions test:unit` (the new dependency must be recorded); frozen install. Not run here: CI, full-repo `test:unit` (run once before the PR is marked ready), `pnpm deps:new`.

## Execution record

(Filled in as steps pass.)
