# ED2D: the 2D editor (one LDtk-style editor for platformers, top-down RPGs and more; FloorFifty stages are a profile)

> **Status:** drafted 2026-10-23 (lane **editor-2d**, thread "2D level editor"), **redone the same day as genre-general** after the Owner's decision (below). Review pending. Not reviewed, not implemented; Owner visual acceptance of the 2D mockups is **not** given. Task rows: [ED2D.0 to ED2D.10 and EDFF.1 to EDFF.5](../../02-master-delivery-plan.md#ed-editors-owner-amendment-2026-10-23). Shared pieces are in the [editor kit spec](./2026-10-23-editor-kit-design.md); the sibling editor is the 3D one (PR #94).
>
> **Why (Owner via the Orchestrator).** First ask, 2026-10-23: "Add one 2D editor, LDtk-like, … tablet-first, web-based … Figma mockups first." **Decision, 2026-10-23 02:31 UTC:** "2D is too Floor Fifty specific; we should be able to do 2D platformer and 2D RPG from same editor." So the editor is one genre-general tool on LDtk's model, the same editor builds a platformer level and a top-down RPG map, and a FloorFifty stage is a **profile** of it. "Build a FloorFifty stage" stays a required acceptance case (FF-o), no longer the only one. Mockups: Figma file [Automata Editors](https://www.figma.com/design/8H4vY5xZj7xIedrvDdwg2d), pages `2D · Home`, `2D · Level`, `2D · States`, `2D · Profile FloorFifty`, `Kit`.

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| LDtk (ldtk.io) data model and editor | v1.5 docs | The model (§5): projects, worlds, levels, layers, definitions, typed fields, auto-layer rules; the tools and the world map |
| [Editor kit spec](./2026-10-23-editor-kit-design.md) §4.8 | this PR | `FieldDef`, `EntityDef` and value rules shared with the 3D editor |
| FloorFifty `content/stages/{dawn,rooftops,snow-shrine,sunken-dome}.toml` | `SNEKPRTY/FloorFifty` `ee5d44e` (2026-10-21) | The FloorFifty profile's format and acceptance fixtures (§10) |
| FloorFifty `packages/content/src/schema/stage.ts` (258 lines) | same | The stage schema, vendored (§10.2) |
| FloorFifty `packages/content/src/validate/{course,aliases,set-pieces,bounds}.ts` | same | The checks the profile must reproduce (§10.7) |
| FloorFifty `apps/client/src/systems/render/{stage-layers,stage-presentation}.ts` (618 + 214) | same | The composition math the stage preview must match (§10.4) |
| FloorFifty `packages/shared/src/level/{course,demand,rng}.ts` | same | The seeded course generator and per-floor demand (§10.5) |
| FloorFifty `packages/asset-contract/assets/art-manifest.json` | same | Aliases, sizes and bundles for the stage asset picker |
| The Last Light `editor/` | `PixiJS3D_Experiment_001` `92e6704` | Shell conventions only (the 3D thread extracts the rest) |

## 1. What the editor builds

The model names no genre. A **template** is data (definitions, a starter level, checks expressed as limits and required fields), so the platformer and the RPG are two starting points of one editor, not two modes.

| Project kind | v1 | How |
|---|---|---|
| 2D platformer (side view, tile collision, enemies, doors, checkpoints, moving platforms) | **Yes** | Template `platformer`: IntGrid `collision`, auto-layer `ground` driven by it, tile `decor`, entities `player-start`, `slime`, `coin`, `door`, `checkpoint`, `moving-platform` |
| 2D top-down RPG (maps joined by doors and warps, NPCs, chests, signs, triggers) | **Yes** | Template `topdown-rpg`: tile `ground`, IntGrid `walls`, auto-layer `walls-art`, free-placed `props`, entities `player-start`, `npc`, `door`, `warp`, `chest`, `sign`, `trigger`, `enemy` |
| Other tile-and-entity games (puzzle, shooter, adventure, farming) | **Yes** | Template `blank`: the user defines layers and entities |
| FloorFifty climber stages | **Yes, as a profile** | §10 |
| Isometric, hexagonal or staggered grids | No | A grid-shape amendment to the model; orthogonal grids only |
| Infinite, streamed or procedurally generated worlds | No | A post-launch milestone with the framework's open-world work (the 3D thread tracks the terrain and open-world row) |
| Sprite or tile animation, physics tuning, cutscenes, dialogue trees | No | Other tools; a text or id field can point at their output |

Two reference projects appear in the mockups and the acceptance cases: **Mossgate** (platformer; levels Old Gate, Moss Steps, Waterwheel, Cistern, Bell Tower) and **Hollowmere** (RPG; maps Village, Inn, Cellar, Forest path, Shrine). Their artwork, tiles and numbers are illustrative.

## 2. Scope

In: one editor that builds a **platformer level** and a **top-down RPG map** end to end with the LDtk model (worlds, levels, tile, IntGrid, auto-tile, entity and free-object layers, tilesets with auto-tile rules, entity definitions with typed fields, references between levels), on an iPad, saved as a lossless project file and exported as AF content; **and** a FloorFifty stage profile that authors and edits the game's own stage TOML with the composition shown as the game draws it.

Out: running the game inside the editor (previews are the composition or the map, not play); making art; editing characters, songs, modes or unlocks; the AF runtime consumption of exported levels (a `tilemap` extension, proposed in §17); cloud sync; the grids and world kinds in §1's last rows.

## 3. Decisions

| ID | Decision | Default and why |
|---|---|---|
| ED2D-D1 | **One genre-general editor on LDtk's model.** Nothing in the model, the tools or the app names a genre; platformer and RPG differ only in data | Owner, 2026-10-23 02:31. A test fails if template ids appear in `src/app`, `src/tiles` or `src/canvas` (G-s). |
| ED2D-D2 | **Profiles.** A profile is a registered document kind `{ id, label, sniff, parse, print, check, templates, views, exports }` (§7). `level-project` is built in; `floorfifty-stage` is an extension | Replaces the earlier "the editor edits the game's own files, never an editor format". The shell, history, storage, Home, Checks and Export belong to the editor; a profile supplies the document and its views. Core never imports a profile; profiles never import each other. |
| ED2D-D3 | **The working format is `*.af2d.json`**: versioned, printed canonically (sorted keys, one grid row per line, run-length cells), migrated on open. **The game-facing format is an export** (AF content TOML, §6.2) | A generic editor needs a lossless project file (LDtk's single `.ldtk` is the model); games need a small flat file that diffs well. The file is generated, so no comment preservation is needed. |
| ED2D-D4 | **Grids are chunked and immutable**: 16×16-cell chunks, a stroke copies the chunks it touches, `History` snapshots share the rest | EDK-D4: sharing is the document's job. Undo is a reference swap; memory grows with edits, not level size. |
| ED2D-D5 | **Auto-tile rules follow LDtk's semantics** (IntGrid source, 1/3/5-cell patterns of any, empty, filled, is, not; chance; flips; break-on-match; stacked outputs) with a **seeded integer hash** for chance and variant picks (§5.6) | LDtk is the model the Owner named. Determinism: the same project exports the same tiles in Node, Chromium, WebKit and Firefox (G-d). |
| ED2D-D6 | **Entities are the kit's typed definitions** (kit §4.8) extended with 2D facts: shape, size, pivot, resizing, tile, tags, limits | Shared with the 3D editor; one validator, one retype rule. |
| ED2D-D7 | **Links between levels are reference values** `{ container: levelId, target: entityId }` checked by `brokenRef` | Doors, warps and triggers join levels; deleting a target must be loud, never a silent dangling id. |
| ED2D-D8 | **Profile code lives in `src/profiles/<id>/`**; one package until a second game profile ships | AF's extension rule: extensions never edit core files; core never imports an extension. Splitting `editor-2d-floorfifty` out is cheap later (a folder move) and expensive now (a package, a build, a knip entry). |
| ED2D-D9 | **Tablet-first means the iPad Safari feature set**: OPFS workspace, import with the file picker, export with the share sheet or download; a folder adapter is an upgrade on Chromium desktop | No directory picker or File System Access on iPad. |
| ED2D-D10 | **Canvas views are PixiJS 8 (WebGL2); lists, inspectors and rule editors are DOM/SVG** | ADR 0002; DOM gets accessibility and text input for free. |
| ED2D-D11 | **Real art when available, honest placeholders otherwise.** Templates ship generated placeholder tilesets labelled as such; the user imports their own PNG | Never a fake picture. A missing image degrades that tileset to numbered placeholders and one diagnostic, never the document. |
| ED2D-D12 | **Export always works; writing into a game folder is blocked while errors stand** | A draft with errors can still be saved or shared; the game's compiler (FloorFifty) or schema (AF export) is the final judge. |
| ED2D-D13 | **Guard rails** (defaults the Owner can veto): grid cell 4 to 256 px; a layer at most 1024×1024 cells; a level at most 16 384 px a side; 256 levels and 64 layer definitions per project; a file at most 16 MB | Bounds the chunk map, the Pixi textures and a pasted file; checked on open and on resize. |

The FloorFifty profile's own decisions (FF-D1 to FF-D4) are in §10.1.

## 4. Ownership and architecture

Packages (all `private` until a consumer outside the repo exists):

| Package | Owns | Depends on |
|---|---|---|
| `packages/editor-kit` | Shell, history, gestures, widgets, storage, field and entity definitions ([kit spec](./2026-10-23-editor-kit-design.md)) | `@mcthaydt/automata-ui` geometry, Svelte 5 |
| `packages/editor-2d` | Everything below | `editor-kit`, `pixi.js`, `zod`, `smol-toml`; the FloorFifty profile adds `@decimalturn/toml-patch` |

Inside `editor-2d` (folders group by feature, files take role suffixes):

```
src/
  model/            project.schema.ts (+ project-types.ts), grid.ts (chunked), cells-codec.ts, project-codec.ts,
                    open-project.ts, json-syntax.ts, ids.ts (injected id source), migrations/migration.ts,
                    commands/*.command.ts
  tiles/            paint.ts, fill.ts, stamp.ts, autotile/{rule.schema.ts, match.ts, hash.ts, layer.ts}
  profiles/
    profile.ts                 the Profile interface and registry
    level-project/             built in: templates/*, project-checks.ts, content-export.ts (AF TOML)
    floorfifty-stage/          extension (§10): stage.schema.ts, stage-codec.ts, stage.command.ts,
                               stage-checks.ts, stage-compose.ts, stage-course.ts, stage-template.ts
  canvas/           level-view.ts, tileset-view.ts, world-view.ts (Pixi), textures.manager.ts
  app/              shell wiring, views (Svelte), stores, one folder per rail destination
```

File names follow `pnpm style`: a role suffix (`*.schema.ts`, `*.command.ts`, `*.manager.ts`, …) only from its list and only for files that export what the role means, so a codec, a view or a check list is a plain kebab-case name. Contract owners: the **project schema and `*.af2d.json`** belong to `model/` (and become a shared content contract once a game runtime consumes them, §17); `FieldDef`/`EntityDef` belong to the kit; the **`Profile` interface** to `profiles/profile.ts`; the **stage document** and its checks to `profiles/floorfifty-stage`; the stage **composition output** (`LayerPlacement[]`) to `stage-compose.ts`, consumed by the canvas and the tests only.

Boundary rules, enforced by `src/architecture.test.ts` over the import graph (built in ED2D.1; `pnpm boundaries` covers only `sim`, whose rules are far stricter): `model/` and `tiles/` import only relative paths, `zod` and `@mcthaydt/automata-editor-kit/fields` (the kit's field rules without its Svelte shell) and use no DOM, clock, timer, `crypto` or `Math.random`; `model`, `tiles`, `canvas` and `app` never import `profiles/<name>/` except the registration list in `app/profiles.ts`; profiles never import each other; no template or profile id string appears in `app`, `tiles` or `canvas` (G-s); files import each other in no ring; a relative import resolves to a file.

## 5. The project model

### 5.1 Project, definitions, worlds, levels

```ts
interface Project {
  readonly format: 'af2d'
  readonly version: 1                          // bumped by a migration, never edited in place
  readonly name: string
  readonly template: string                    // where it started; informs nothing at runtime
  readonly defs: Definitions
  readonly worlds: readonly World[]            // at least one
  readonly levels: readonly Level[]            // each level is in exactly one world
}
interface Definitions {
  readonly layers: readonly LayerDef[]         // front to back as the panel shows them
  readonly tilesets: readonly TilesetDef[]
  readonly entities: readonly EntityDef2D[]
  readonly levelFields: readonly FieldDef[]    // typed fields every level carries (kit §4.8)
}
interface World {
  readonly id: string
  readonly layout: 'free' | 'grid' | 'horizontal' | 'vertical'
  readonly grid?: { readonly w: number; readonly h: number }          // layout 'grid': snap size in px
  readonly placements: readonly { level: string; x: number; y: number; depth: number }[]
}
interface Level {
  readonly id: string                          // /^[a-z][a-z0-9-]*$/, unique in the project
  readonly name: string
  readonly size: { readonly w: number; readonly h: number }            // px
  readonly background: { color: string; image?: string; mode: 'fit' | 'cover' | 'repeat' | 'repeat-x' }
  readonly fields: FieldValues                 // values of defs.levelFields
  readonly layers: readonly LayerInstance[]    // one per LayerDef, same order
}
```

Every level has an instance of every layer definition (LDtk's rule), so a definition change never leaves a level half-shaped. Ids of definitions are human-chosen kebab-case; ids of **instances** (entities, objects) are generated by an injected `IdSource` (8 base36 characters in production, a counter in tests), stable across edits and duplication so references survive.

### 5.2 Layers

```ts
type LayerDef =
  | { id; label; kind: 'tiles';    grid: number; tileset: string; opacity: number }
  | { id; label; kind: 'intgrid';  grid: number; values: readonly IntValueDef[]; opacity: number }
  | { id; label; kind: 'auto';     grid: number; source: string /* an intgrid layer */; tileset: string; groups: readonly RuleGroup[]; opacity: number }
  | { id; label; kind: 'entities'; grid: number; snap: boolean }
  | { id; label; kind: 'objects';  tileset: string; snap: number /* px, 0 = free */ }
interface IntValueDef { readonly value: number /* 1..255 */; readonly id: string; readonly label?: string; readonly color: string }

type LayerInstance =
  | { def: string; kind: 'tiles';    cells: Grid }                       // packed tile cells
  | { def: string; kind: 'intgrid';  cells: Grid }                       // 0 = empty, else the value
  | { def: string; kind: 'auto';     seed: number; overrides: Grid }     // the output is derived, never stored
  | { def: string; kind: 'entities'; items: readonly EntityInstance[] }
  | { def: string; kind: 'objects';  items: readonly ObjectInstance[] }
interface EntityInstance { readonly id: string; readonly def: string; readonly x: number; readonly y: number; readonly w?: number; readonly h?: number; readonly fields: FieldValues }
interface ObjectInstance { readonly id: string; readonly tile: number; readonly x: number; readonly y: number; readonly flipX: boolean; readonly flipY: boolean }
```

The five kinds cover the Owner's list: **tiles** (hand-placed), **IntGrid** (named values with colours: collision, terrain, regions), **auto** (an auto-tile layer, LDtk's AutoLayer, fed by an IntGrid layer), **entities** (typed things, optionally on the grid), **objects** (free-placed tile sprites for props and decor, off the grid, no fields). A level background (colour, image, fit mode) replaces a scenery layer; parallax is out of v1.

### 5.3 Grids and cell encoding

`Grid` is a sparse map of 16×16-cell chunks of `Uint32Array`, immutable: `set(x, y, v)` and `fillRect` return a new `Grid` that shares every untouched chunk, and an all-zero chunk is dropped so an empty level costs nothing. A tile cell packs `tile + 1` in bits 0 to 28, `flipX` in bit 30, `flipY` in bit 31 (0 is empty); an IntGrid cell is the value (0 is empty).

Files print a grid as **one string per row, run-length coded**: tokens separated by a space, `.` empty, otherwise the value (tiles: the tile index followed by `h`, `v` or `hv` for flips), `*n` repeats a token n times. Example: `".*5 7h*3 2 .*24"`. The printer is canonical (one spelling for a grid), so equal grids print byte-equal and a git diff shows the rows that changed. `decode(encode(grid))` is the identity (property test), and a token that does not fit the layer's tileset or value list is a `cellInvalid` problem on open, not a crash.

### 5.4 Tilesets

```ts
interface TilesetDef {
  readonly id: string; readonly label: string
  readonly image: string                      // asset path in the workspace, resolved through the store
  readonly imageSize: { w: number; h: number }  // recorded when imported; a mismatch on open is `tilesetImageChanged`
  readonly tile: { w: number; h: number }
  readonly spacing: number; readonly padding: number
  readonly tags: readonly { tag: string; tiles: readonly number[] }[]   // "solid", "water", … for palettes and rules
}
```

Columns and rows derive from `imageSize`, `tile`, `spacing` and `padding`. A tileset without an image is a placeholder set (generated by a template and labelled "placeholder"); importing a PNG swaps `image` and keeps every tile index, so a project built on placeholders moves to real art by one replace.

### 5.5 Entity definitions and instances

```ts
type EntityDef2D = EntityDef & {                    // kit §4.8: id, label, color, single, fields
  readonly shape: 'rect' | 'ellipse' | 'point' | 'tile'
  readonly size: { readonly w: number; readonly h: number }    // px
  readonly pivot: { readonly x: number; readonly y: number }   // 0..1 within the shape
  readonly resizable: 'none' | 'x' | 'y' | 'xy'
  readonly tile?: { readonly tileset: string; readonly index: number }   // drawn on the canvas when set
  readonly tags: readonly string[]
  readonly min?: { readonly per: 'level' | 'project'; readonly count: number }   // "at least one player-start in the project"
}
```

An instance's `fields` validate against its definition with the kit's `checkValues`. Template limits are data: `player-start` is `single` and `min: { per: 'project', count: 1 }`; a door's `target` is a `required` ref. That is how the platformer and RPG templates carry "checks" with no template code (ED2D-D1). The inspector builds a form from the definition; the definitions editor (`entities` view) adds, renames and retypes fields and refuses a change that would invalidate instances, with the list (kit EK-j).

### 5.6 Auto-tile rules

```ts
interface RuleGroup { readonly id: string; readonly label: string; readonly active: boolean; readonly rules: readonly Rule[] }
interface Rule {
  readonly id: string; readonly active: boolean
  readonly size: 1 | 3 | 5                                   // pattern is size × size, row-major, the centre is the cell being decided
  readonly pattern: readonly PatternCell[]
  readonly tiles: readonly number[]                          // candidates; more than one picks a variant by hash
  readonly chance: number                                    // 0..1, default 1
  readonly flipX: boolean; readonly flipY: boolean           // also try the mirrored pattern, draw the tile mirrored
  readonly breakOnMatch: boolean                             // stop the remaining rules for this cell
  readonly outside: number | 'same'                          // value read beyond the level edge (0 = empty); 'same' repeats the centre
}
type PatternCell = 'any' | 'empty' | 'filled' | { is: number } | { not: number }
```

Evaluation for one cell: groups in order, rules in order, skipping inactive ones; a rule matches when every pattern cell holds against the source IntGrid (trying no-flip, then flipX, flipY, both when enabled); then a hash decides `chance` and the variant. A match **adds** its tile to the cell's stack (a cell can hold several tiles drawn in rule order, so edges and corners can overlay a fill) and `breakOnMatch` ends the cell. The result is `Map<cell, readonly {tile, flipX, flipY}[]>`, derived, never stored; `overrides` hold manual tiles painted over the result.

The hash is a 32-bit integer mix (`Math.imul` and shifts, no floats) of `(layer seed, rule id, x, y, salt)`, so a project exports identical tiles on every engine; the **seed** is stored per auto-layer instance and "Re-roll variation" is one undo step that changes it. Painting one source cell recomputes only the window of `floor(maxRuleSize / 2)` cells around it; a property test checks that the incremental result equals a full recompute. Diagnostics the engine feeds Checks: a rule with a tile outside its tileset, a rule that can never match (a pattern cell demanding both `is 1` and `not 1` through flips), a rule shadowed by an earlier `breakOnMatch` rule with a pattern at least as general (info).

### 5.7 Worlds

`free`: levels sit at any pixel position, with `depth` ordering overlaps; `grid`: positions snap to the world's grid (LDtk's GridVania) and the export lists each level's **neighbours** (north, east, south, west, by touching edges) for room-scrolling games; `horizontal` / `vertical`: a sequence, positions derived. Switching the layout is one undo step and never changes a level's contents. Doors, warps and triggers whose `ref` fields name another level draw as links on the world map.

### 5.8 Commands

Every edit is a named function in `model/commands/` taking the project and returning the next, so undo labels, keyboard handling and tests share them (the kit's `History` and command registry carry them). Representative set (each has a test): `createProject(template)`, `addLevel`, `duplicateLevel`, `resizeLevel(anchor)`, `moveLevelInWorld`, `setWorldLayout`, `paintCells`, `paintRect`, `floodFill`, `stampCells`, `eraseCells`, `placeEntity`, `moveEntity`, `resizeEntity`, `setEntityField`, `placeObject`, `addLayerDef`, `reorderLayerDefs`, `setIntValue`, `importTileset`, `tagTiles`, `addRule`, `editRule`, `reorderRules`, `rerollSeed`, `addEntityDef`, `addFieldDef`, `renameField`, `retypeField` (refuses with the kit's list), `deleteDefinition` (refuses with the list, or removes the uses as one step when confirmed). A stroke or drag is one `History` transaction.

### 5.9 Tools

| Tool | tiles | intgrid | auto | entities | objects |
|---|---|---|---|---|---|
| Select / move (marquee on a drag) | cells | cells | overrides | instances, handles, path points | instances |
| Brush (size 1 to 8) | tile | value | stamps an override | places one | places one |
| Rectangle | tile | value | override | n/a | n/a |
| Fill (flood, bounded by the level) | tile | value | override | n/a | n/a |
| Eraser | tile | value | override | instance | instance |
| Picker | tile | value | n/a | selects the definition | tile |
| Stamp (multi-tile from the palette or a copied region) | tiles | values | overrides | n/a | n/a |
| Random (dice: a tile from the palette selection per cell, by hash) | tiles | n/a | overrides | n/a | n/a |

Finger: select, drag, pan, pinch. Pencil: draws and drags precisely, hover shows the brush footprint; with the Pencil active a finger pans (kit §4.5). Mouse: wheel zoom, middle pan.

## 6. Formats

### 6.1 The working file (`*.af2d.json`)

A strict zod schema (`project.schema.ts`) over the shapes in §5, printed canonically: UTF-8, two-space indent, object keys in schema order, arrays of definitions and levels sorted by id, grids as row strings (§5.3). Opening rules: `version` equal to the supported one parses; **lower** runs the chain of `*.migration.ts` functions in memory (each pure, each with a fixture pair) and the file is rewritten only on save; **higher** opens read-only with the message and the raw text, never rewritten; **any key the schema does not know** opens read-only with the list of paths, so a newer or hand-edited file cannot lose data silently. A short extract (a layer instance names its definition by `def` and repeats its `kind`, so the schema validates it without the definitions and `layerKindMismatch` catches a disagreement):

```json
{ "format": "af2d", "version": 1, "name": "Mossgate", "template": "platformer",
  "levels": [ { "id": "moss-steps", "size": { "w": 512, "h": 288 },
    "layers": [
      { "def": "entities", "kind": "entities", "items": [
        { "id": "k3f9a1x2", "def": "player-start", "x": 48, "y": 240, "fields": {} },
        { "id": "q8m2c7d1", "def": "slime", "x": 208, "y": 240, "fields": { "hp": 3, "patrol": [ {"x":176,"y":240}, {"x":272,"y":240} ] } } ] },
      { "def": "collision", "kind": "intgrid", "rows": [ ".*32", ".*32", "1*32" ] } ] } ] }
```

Details fixed while building ED2D.1:

- **One model, two shapes.** `Project` (grids as `Grid`) is the in-memory model; `ProjectFile` is the same tree with each grid as its row strings, and `project.schema.ts` validates it. `decodeProject` and `encodeProject` convert, with the layer definitions giving each grid its size, `ceil(level / grid)` cells across and down.
- **Opening has three outcomes** (`openProject`): `opened` (with `upgradedFrom` after a migration), `readOnly` (`newerVersion`, or `unknownKeys` with each key's path; the result carries the raw text and no project, so nothing can be written back) and `failed` (`notJson` with line and column, `notAProject`, `invalid` with up to 100 issues, `tooLarge` over 16 MB). A leading byte order mark is ignored. The line and column come from our own scanner (`json-syntax.ts`), because Safari's `JSON.parse` names no position.
- **Refused at open because decoding needs them:** `duplicateId` (definitions, worlds, levels, IntGrid values and ids, instance ids across the project), `unknownLayer` (a layer instance or an auto layer's `source` names no layer), `unknownTileset`, `layerKindMismatch`, `layerMismatch` (a level does not hold one instance of every definition in the definitions' order), `layerTooLarge` (a layer is over 1024 cells on a side, checked before a grid is allocated) and `cellInvalid` (a token that is not a cell, or a row of the wrong width or count). Values that fit the shape but not the world (a tile past its tileset, a broken ref, an instance of an unknown entity) open and become Checks (§9).
- **Guard rails** (ED2D-D13) in the schema: a layer grid cell 4 to 256 px, a level side up to 16 384 px, at most 256 levels and 64 layer definitions; a world has a snap `grid` exactly when its layout is `grid`.
- **Canonical print:** two-space JSON in schema key order, a final newline, `defs.tilesets`, `defs.entities`, `worlds` and `levels` sorted by id and the keys of field values sorted; everything whose order means something (layer definitions, a level's layers, items, placements, rules, a list value) keeps it. `printProject` throws on a project the schema would refuse to open.
- **Cells:** a tile token is the tile index followed by `h`, `v` or `hv`, an IntGrid token is its value 1 to 255, `.` is empty, and `*n` repeats a token n times (n at least 2 when printing).
- **Ids:** definitions and levels are `/^[a-z][a-z0-9-]*$/`; instance and rule ids are lower case, digits and hyphens; `IdSource.next()` returns 8 base36 characters, `counterIds()` is the deterministic source for tests and `randomIds(fill)` takes the host's random bytes, so `model/` holds no randomness.
- **Migrations:** `Migration { from, to, run(raw) }` over the parsed JSON, `to` always `from + 1`; `migrate` stamps `version`, reports a missing step or a step that threw as a failed open, and throws for a malformed chain (a bug in the editor). The real list is empty at version 1.

### 6.2 AF content export (TOML)

Generated, write-only, deterministic: `project.toml` (definitions the game needs: layer grid sizes, IntGrid value ids, entity definition ids and field types, tileset ids and tile sizes), `levels/<id>.toml` (size, level fields, per layer the row strings, and each entity as a `[[layers.entities]]` table with its typed fields), `world.toml` (layout, placements and, for `grid` worlds, neighbours). Auto-layer output is exported as resolved tile stacks so a game needs no rule engine. A header comment says the file is generated. The export has its own schema (`content.schema.ts`) and the test decodes the row strings back to grids and compares them with the editor's. Whether and when AF consumes it is §17.

## 7. Profiles

```ts
interface Profile<V> {
  readonly id: string                                       // 'level-project', 'floorfifty-stage'
  readonly label: string
  sniff(fileName: string, text: string): boolean            // can this profile open it
  parse(text: string): Result<V, ParseError[]>              // positions for every error
  print(base: string, value: V): string                     // base = the text as loaded (a codec may patch it); '' for a document never loaded
  check(value: V, context: ProjectContext): Diagnostic[]
  fix?(value: V, diagnostic: Diagnostic, context: ProjectContext): V   // applies the one-step repair a finding's `fix` names; absent when there is none
  readonly templates: readonly { id: string; label: string; create(ids: IdSource): V }[]
  readonly views: readonly ViewDef[]                        // rail destinations; each names a Svelte component
  readonly exports: readonly ExportTarget<V>[]              // working file, AF content TOML, …; files(value, base) gets the text as loaded
}
```

`fix` exists because a finding's `fix` is only a name (`reorder-layers`) and the app, which may name no profile (G-s), cannot map it to a command; the profile does (EDFF.1d). `base` reaches `files` for the same reason `print` has it: a profile that patches the loaded text exports the file with its comments. Both were added to the interface by EDFF.1d and are backward compatible: a profile without `fix` offers no repair, and a target that prints the whole value ignores `base`.

The editor lists documents of every registered profile on Home, opens one with the profile that `sniff`s it (asking when two do), and shows that profile's views on the rail. `History` state is the profile's value; text is derived on demand for diffs and export, never stored per step.

- **`level-project`** (built in): the model of §5, rail `Level · World · Tilesets · Entities · Checks · Export`, templates `platformer`, `topdown-rpg`, `blank`.
- **`floorfifty-stage`** (extension): §10, rail `Compose · Course · Pieces · Stage · Assets · Checks · Export`.

Templates:

| Template | Starts with |
|---|---|
| `platformer` | One 512×288 level; 16 px grid; layers (front to back) `entities`, `decor` (tiles), `ground` (auto, from `collision`), `collision` (IntGrid: `solid`, `one-way`, `spike`, `water`, `ladder`); a placeholder tileset with a 47-tile terrain rule group (edges, corners, inner corners); entity definitions `player-start` (single, min 1), `slime` (hp int 1..9, patrol point list, tint colour), `coin`, `door` (required `target` ref), `checkpoint`, `moving-platform` (travel point, speed float); level field `music` text |
| `topdown-rpg` | One 320×240 level; 16 px grid; layers `entities`, `props` (objects), `walls-art` (auto, from `walls`), `walls` (IntGrid: `blocked`, `water`, `door-frame`), `ground` (tiles); a placeholder tileset with grass, path, water, wall and floor tiles; definitions `player-start` (single, min 1), `npc` (name text, dialogue multiline text, facing enum, route point list), `door` and `warp` (required `target` ref, `facing` enum), `chest` (item text, amount int), `sign` (text), `trigger` (resizable rect, `event` text), `enemy` (hp int, `aggro` int); level field `area` text |
| `blank` | One 256×256 level; one tiles layer and one entities layer; one placeholder tileset; no entity definitions |

Placeholder tilesets are generated flat-colour tiles with a glyph and the word "placeholder" in the Assets list (ED2D-D11).

## 8. Views and flows

Mockup ids are the screen ids in `docs/design/editor-2d/`. All views share the kit shell: top bar, rail (56), panel (264), canvas, inspector (320), dock (148) in `wide`; drawers and sheets in `medium`.

| View | Mockup | Panel | Canvas | Inspector | Dock |
|---|---|---|---|---|---|
| **Home** | `home` | Projects (every profile) with kind badge, validity, modified time; templates; storage state | n/a | Selected project summary, Open, Duplicate, Delete, Export | n/a |
| **Level** | `level-platformer`, `level-rpg`, `level-portrait` | Layers (visibility, lock, kind) and, below, the palette for the selected layer: tileset tiles, IntGrid values or entity definitions | The level at the chosen zoom with grid, snap and selection | Tabs Entity / Level / Checks; typed fields from the definition | The world's levels as cards |
| **World** | `world` | Worlds and layout | Levels as rectangles at world positions with links | Level position, size, depth, fields | n/a |
| **Tilesets** | `tileset` | Tilesets, then rule groups and rules | The tileset image with tags and the tile selection | The selected rule: pattern, outputs, chance, flips, break; a live preview over a sample IntGrid | Rule list as a strip |
| **Entities** | `entities` | Entity definitions and level fields | A preview of the definition (shape, size, pivot, tile) | Field list with type, default, bounds, options, required | n/a |
| **Checks** | `checks` | Diagnostics by severity, each linking to its object | n/a | The failing object's inspector | n/a |
| **Export** | `export` | n/a | n/a | n/a | Dialog: targets, file list with sizes, error count |

Ordered flows:

1. **New project:** Home → New → template → Level view on the template's starter level (valid, zero errors).
2. **Terrain:** pick a layer → pick a tool → paint on the canvas (Pencil) → IntGrid cells change → the auto layer updates within the frame → a stroke is one undo step.
3. **Entities:** select an entity layer → pick a definition in the palette → tap to place → the inspector shows its fields; an invalid value is refused with a message and the field keeps its previous value.
4. **Link levels:** select a door → its `target` field → pick a spawn in another level from the picker (levels, then entities of the allowed definitions) → the link draws on the canvas and on the world map.
5. **Definitions:** Entities view → change a field's type or delete a definition → refusal with the instance list → "Delete anyway" removes the uses as one step.
6. **Rules:** Tilesets view → select a rule → edit the pattern cells (tap cycles any / empty / filled / is / not) → the preview redraws → reorder with the grip.
7. **World:** World view → drag levels; switch layout; the dock cards on the Level view follow.
8. **Fix:** a diagnostic with a known repair offers it ("Choose target", "Remove 3 stray tiles", "Reorder: …"); applying it is one undo step.
9. **Export:** Export → pick targets → file list → Download, Share, Copy or Write to folder (only with zero errors and a folder store) → `markClean`.
10. **Recover:** reopen after a crash → Restore or Discard (kit §5).

## 9. Checks

Each diagnostic: `{ severity, code, path, message, fix? }` where `path` addresses the object (`levels[moss-steps].layers[entities].items[q8m2c7d1].fields.target`). Severities: error (the export or the game would break), warning (suspicious), info.

| Source | Codes |
|---|---|
| File (refusals at open, §6.1, not Checks) | `newerVersion`, `unknownKeys`, `duplicateId`, `unknownLayer`, `unknownTileset`, `layerKindMismatch`, `layerMismatch`, `layerTooLarge`, `cellInvalid` |
| Definitions | `missingTileset` (the image), `tilesetImageChanged` (warning), `fieldDefInvalid` (the kit's `checkFieldDef`), `ruleTileOutOfRange`, `ruleNeverMatches` (info), `ruleShadowed` (info), `unusedDefinition` (info) |
| Levels | `tileOutOfRange` (fix: remove), `unknownEntityDef`, `entityOutOfBounds` (warning, fix: move inside), `levelOutsideWorld`, `levelsOverlap` (warning, free layouts) |
| Entities | `fieldMissing`, `fieldInvalid` (the kit's problem codes), `singleExceeded`, `minNotMet` (project or level) |
| Links | `brokenRef` (fix: choose target), `refWrongKind` |
| Editor-only | `emptyLevel` (info) |

Template "checks" are definitions: `minNotMet` reports "no player-start in the project", `fieldMissing` reports a door with no target. The FloorFifty profile's checks are in §10.7.

## 10. Profile: FloorFifty stage

This profile makes the editor author **the game's own stage files**. FloorFifty draws its floors from a seed, so a stage is **a frozen course plus a theme**, not a tile map, which is why it is a profile with its own document and views, not a level project. The editor's shell, history, storage, Home, Checks and Export serve it unchanged.

### 10.1 Decisions

| ID | Decision | Default and why |
|---|---|---|
| FF-D1 | The profile edits **the game's own TOML**, not an editor project format | The stage TOML is the contract; a second format would drift. |
| FF-D2 | Comment- and format-preserving TOML via `@decimalturn/toml-patch` (MIT) on `smol-toml` (already in the stack) | Measured 2026-10-23: identity patch is byte-equal on all four shipped stages, and a one-value edit changes exactly the lines that hold it. Whole-table edits (add, remove, reorder) are not safe with comments, so the codec does those itself (§10.3). New dependency: needs the `deps:new` review in the PR that adds it. |
| FF-D3 | The stage schema is **vendored** with a recorded source commit, not imported | FloorFifty's `content` package is not in AF (stages are game content, extraction map §4). A refresh script diffs against FloorFifty at a pinned commit; the profile registry lets another game supply its own. |
| FF-D4 | Composition math is a pure function ported from `StageLayers`, tested against numbers from FloorFifty's own tests | "WYSIWYG" is a claim about numbers; the Pixi scene only applies them. |

### 10.2 What a FloorFifty stage is (measured)

A stage is one TOML file in `content/stages/`.

| Stage | Lines | Comment lines | Scenery layers (sky/city) | Set pieces | Has course | Has presentation | Light / preview |
|---|---|---|---|---|---|---|---|
| `dawn` (tutorial only) | 78 | 18 | 3 (1/2) | 3 | no | yes | no / no |
| `rooftops` | 287 | 86 | 12 (5/7) | 6 (5 kinds) | seed 35229 | yes | yes / yes |
| `snow-shrine` | 213 | 36 | 7 (2/5) | 8 | seed 34528 | yes | yes / yes |
| `sunken-dome` | 191 | 28 | 7 (3/4) | 7 | yes | yes | no / yes |

What the file holds (schema `stageSchema`, strict, no unknown keys):

| Table | Fields | Rules the schema enforces |
|---|---|---|
| root | `id`, `displayName` (≤ 48), `unlock?`, `platformAlias` | `id` matches `^[a-z0-9-]+$` |
| `[courseTuning]` | flat map of finite numbers | names and ranges checked against the game's tunable declarations |
| `[course]` | `seed` (int ≥ 0), `phrases` ×4, `extension?` ×n | phrases named `teach`, `combine`, `recover`, `finish` once each, in that order; `toFloor ≥ fromFloor ≥ 1` |
| `[theme]` | `backdropAlias`, `lightAlias?`, `previewAlias?`, `ambienceAlias?`, `layers` (≥ 1) | see below |
| `[[theme.layers]]` | `alias`, `plate` (sky/city), `depth` 0..1, `sink` −720..1440, `haze?` 0..1, `extend` (none/skirt/tile/plate), `arc?` 0..2 (city only), `drift?` 0..3 (not with `plate`) | `plate` extend only on sky; a plate must be the first sky layer; aliases unique; within each plate a layer is not nearer than the one after it |
| `[theme.presentation]` | `profile`, `refractionIntensity` 0..0.8, `horizonLift` 0..48, `lightHeight?`, `lightShimmer?`, `silhouette?`, `citySink?` (teach/combine/recover/finish 0..720) | |
| `[[theme.setPieces]]` | `floor` 1..50, `holdMs` 500..20 000, then by `kind`: `lightsOut` (`invert?`), `paletteShift` (`mood`, `stay?`), `weatherBurst` (`particle`, `density`, `layers?`), `skyFlash` (`flashes` 1..3, `tone`, `kick?`), `swarm` (`layers`, `speed` 1..20) | ≤ 16 pieces; named layers must be drawn by the stage |

Cross-file checks (FloorFifty `validate/`): every phrase floor is claimed exactly once up to the course's top floor (from `COURSE_FLOOR_COUNT`, default 20, so floors 1 to 19), the extension accounts for the floors above up to the tallest finite mode (49), every alias exists in the art manifest, set pieces name only drawn layers.

The files are written by people for people: `rooftops.toml` is 30% comments, with design rationale beside the numbers. **The editor must never destroy that.** This drives FF-D2.

### 10.3 Document and codec

```ts
// What the profile edits (`Profile<StageDocument>`); the open file's path, `base` text and drafts belong to the app (ED2D.5).
interface StageDocument {
  readonly value: StageValue            // parsed, validated shape (schema output)
  readonly ids: ListIds                 // one id per element of course.extension, theme.layers and theme.setPieces
}
interface ListIds { readonly extension: readonly string[]; readonly layers: readonly string[]; readonly setPieces: readonly string[] }

parseStage(text): Result<StageDocument, readonly ParseError[]>   // ids are b0, b1, ... per list
printStage(base, document): string                                // base = the text the document was read from
```

The three lists have no key a table can be told apart by, so every element carries an id the codec follows through an edit: it tells "moved" from "removed, and a new one added", and a moved element keeps its comments. A parsed document numbers its elements `b0`, `b1`, … per list; commands give new elements a fresh id from the injected `IdSource` and keep ids when they move or duplicate (a duplicate gets a fresh one). The ids of a list must be as many as its elements and distinct; `printStage` throws when they are not. **`base` stays the text as loaded for the whole session** (the app never replaces it by what it saved), because the `b` ids refer to its elements; saving again from the same base is idempotent, and a reload re-reads both.

`print(base, value)` is the profile's `print` (§7). The codec is two layers: a **block engine** that adds, removes and rearranges whole tables (`course` with its phrases and extension, `theme.presentation`, `theme.presentation.citySink`, and the elements of the three lists), and `@decimalturn/toml-patch`, which carries every change inside a table. The engine exists because the library, measured on the shipped stages, drops the comment block that follows a removed table, leaves a removed element's own comment behind on its neighbour, does not move comments with a swapped element, and writes `citySink = { … }` or `phrases = [ { … } ]` inline for a new table. Codec rules:

1. Opening and exporting with no change returns the original text byte for byte (tested on all four stages, with `\r\n` line endings and without a final newline). Line endings and the final newline are the base's.
2. A changed scalar changes only its own line, and a comment at the end of that line stays. An optional key added or removed adds or removes only its line, and a comment directly above a removed key goes with it. A new table or array element follows the file's style: a blank line between tables, the keys in the order the shipped files write them (layers `alias, plate, depth, sink, haze, extend, arc, drift`; set pieces `floor, kind, holdMs`, then the kind's keys), string lists as `["a", "b"]`, and it is placed after its siblings, or after the last table that comes before it in file order (`courseTuning`, `course`, `course.phrases`, `course.extension`, `theme`, `theme.layers`, `theme.presentation`, `theme.presentation.citySink`, `theme.setPieces`). A removed table removes the comment lines directly above it and the blank line after it, and nothing else: a comment block that a blank line separates from the next header belongs to no table and stays.
3. Reordering elements moves each table with its leading comment block into the place of the table that held the element now there, so the text between tables stays where it was.
4. Output must re-parse to exactly `value` (tested as a property over generated edits: 200 seeded sequences of 1 to 8 edits for each shipped stage, which also checks that every comment of a table or key that stays is in the output once and that none appears from nowhere).
5. Parse errors report line and column; the editor shows them and never replaces the file. A schema issue reports its path (`theme.layers[2].depth`) and the line of its key (the table header for a missing key; one error for each unknown key).

Known limits: a list the text writes as an inline array is edited by the library, with its layout, not by the engine; removing a commented key between two blank lines leaves both blank lines; a float written `1.0` is printed `1`.

### 10.4 Composition (WYSIWYG)

`resolveScenery(value)` turns a stage into the scenery (`stage-scenery.ts`, from FloorFifty's `stage-presentation.ts`): each layer with its defaults (a city layer's `arc` is `depth / 0.35`, a sky layer's 0; `haze` and `drift` 0), the light's alias and height (default −60), the horizon lift, and the ascent arc as knots: a phrase ending on floor `n` of a climb whose last phrase ends on `last` stands at `(n + 1) / (last + 1)` of the climb, with its `citySink` value held at the one before it if smaller, so the finish lands on 1. `citySinkAt(scenery, progress)` interpolates linearly between the knots and clamps. `composeStage(scenery, { cameraY, progress, timeSeconds, framing })` (`stage-compose.ts`) returns, in drawing order, `{ alias, plate, depth, extend, haze, y, tileX }` for each layer, and `{ alias, y, scale, after }` for the light, plus `lift` and `citySink`, by the formulas of `StageLayers.update`:

- city layer `y = −cameraY + cameraY·depth·0.15 + sink + citySink(progress)·arc + framingSink + lift`; sky layer `y = −cameraY·(1−depth) + sink + lift`, and a sky plate also `+ framingSink`; `tileX = cameraY·depth·0.2`, plus `timeSeconds·drift` when `drift > 0`, and absent for a plate, which is one untiled picture. `y` is where the strip's bottom edge stands (strips are anchored at the bottom centre, x = 0); a `tile` layer's strip runs 4000 units below its art, so its `sink` and `y` include them;
- `lift = horizonLift · t²(3 − 2t)` with `t = clamp(progress, 0, 1)`; both `lift` and `citySink` are the settled values, where the game's 0.4 s ease comes to rest (it applies them at once under reduced motion);
- city layers are rounded to whole device pixels at `framing.pixelsPerUnit` (default 1; 0 or less rounds nothing); the sky is not;
- `framingSink = max(0, cityTopMin − highest)` where `highest` is the least `sink − height` of the city strips with a known art height (`framing.heights`), so portrait can hold the city in the lower third; zero without `cityTopMin` or a height;
- the light `y = −lightHeight − cameraY·0.94 + lift`, scale 0.55, drawn after a leading sky plate (the first sky layer, when it is a plate) and before every other layer; the leading plate is drawn first, every other layer keeps its place in the list.

The canvas applies these placements to Pixi sprites; the unit tests assert the numbers. **Golden numbers are the game's own**: `testing/make-goldens.mjs` runs FloorFifty's `StageLayers.update` and `resolveStagePresentation` on `pixi.js` (stubbing only the textures, haze, window codes and the sun's shimmer filter) for the four shipped stages at five climb states and four framings, and the port must equal them bit for bit (80 frames per run of the tests). Not previewed, because they need a race, a song or a GPU and move a layer by a few units: the music and race reactions (bob, jolt, surge, a set piece's sweep), the sun's heat shimmer, haze baking and window codes. Preview controls: the climb scrubber (floor 0 to 50 mapped to `progress` and `cameraY`), a viewport chip (phone portrait 390×844, phone landscape 780×270, tablet), a time control (play/pause drift, reduced-motion toggle) and a "Ghost" toggle that outlines every layer's extent. With a manifest and image files loaded, layers show their art; without, each layer is a labelled plate tinted by its role and sized from the manifest, and the status line says "Placeholders: no art loaded" (ED2D-D11).

Differences from the first draft of this section: the output lists `alias, plate, depth, extend, haze, y, tileX` and drops `x`, `alpha` and `visible` (every strip is centred on x = 0, the game has no per-layer alpha, and hiding a layer is the Layers panel's own state); the placements are the settled ones; `composeStage` takes the resolved scenery, not the presentation and the layers separately; and the framing carries the art heights it measures.

### 10.5 Course

`createCourse(seed, tuning)` (`course-floors.ts`) is a port of FloorFifty's generator (`course.ts`, with `rng.ts` as `course-rng.ts`): the same SplitMix32 stream, a stream per floor from `(seed, index)` so the first `n` floors of a tall course are those of an `n`-floor course, a fixed starting floor, a draw across the bounds for each floor's `x`, a coin and a speed (read against the demand ramp's band from `DEMAND_RAMP_FROM_FLOOR` up). `bounceBudget` and `stepDemands` (`course-demand.ts`, from `demand.ts`) give how much of one bounce each step asks for. Tested against the game's own output for nine cases (the seeds of Rooftops 35229, Snow Shrine 34528 and Sunken Dome 107255, a hundred floors, a steep ramp, other physics, seeds 0, 4294967295 and 4294967296 + 12345), exactly, and against the hashes FloorFifty pinned for floors 0 to 49 before the ramp existed. The Course view draws floors 0 to the course's top as bars (stationary or moving with a direction arrow), the horizontal bounds, the reach of one bounce and per-floor horizontal demand.

Tuning: `resolveCourseTuning(courseTuning, context)` (`course-tuning.ts`) resolves the 16 tunables the course reads (`COURSE_FLOOR_COUNT`, `FLOOR_WIDTH`, `FLOOR_GAP_MIN`, `DEATH_LINE_MARGIN`, `PLAYER_WIDTH`, `MAX_MOVE_SPEED`, `GRAVITY`, `BOUNCE_VELOCITY`, the two moving-floor speeds and the six ramp ones) the game's way: the stage's `courseTuning`, else the project's `tuning.toml`, else the declared default. A value the game would refuse (out of range, a fraction for an `int`, not a number) makes the course unavailable and names the value, instead of drawing a wrong course; the Checks report the same value (`tunableRange`). The other 19 tunables are the checks' business alone; `FLOOR_GAP_MAX` is among them, because the generator uses `FLOOR_GAP_MIN` for the gap, as the game does.

### 10.6 Commands and views

Every edit is one named function taking the document and returning the next, in `commands/` (EDFF.1d). They are pure: they copy what they change, return the same object when nothing changes (so `History` records nothing for a no-op), and never judge a value's range, because a value out of range is a finding of the checks (§10.7) and the editor keeps that document open. They keep the document's structure whole: a list index or an id the document does not have throws `RangeError`; an element added takes its id from the injected `IdSource` (and a source that repeats an id throws); a move keeps the element's id and a duplicate gets a new one; an optional field set to `undefined` is dropped, not left present and unset; `course.extension` is unset, not empty, when its last entry goes.

| Group | Commands |
|---|---|
| Identity and aliases (`identity-edits.ts`) | `renameStage`, `setStageId`, `setUnlock`, `setPlatformAlias`, `setBackdropAlias`, `setLight`, `setPreviewAlias`, `setAmbienceAlias`, `setCourseTuning(name, value \| undefined)` |
| Presentation (`presentation-edits.ts`) | `setPresentation(field, value)` (makes the block from neutral values when the stage has none), `removePresentation`, `setCitySink(phrase, value)` (makes the arc with zeros for the other phrases), `removeCitySink` |
| Layers (`layer-edits.ts`) | `addLayer(ids, layer, at?)` (in front by default), `removeLayer`, `duplicateLayer` (a copy in front of the original, which leaves its alias twice for the checks), `moveLayer(from, to)`, `setLayerField(index, field, value)`, `dragLayerSink(index, delta)` (whole units, no clamp; the caller passes the delta from where the gesture began to the document it began with, so a gesture is one `History` transaction), `sortLayersByDepth` |
| Course (`course-edits.ts`) | `addCourse(ids, { seed, top, tallest })` (four phrases tiling floors 1 to `top`, and one extension entry from there to `tallest`: a course the checks accept), `removeCourse`, `setSeed`, `rerollSeed(rng)` (0 to 99 999, never the seed it has), `setPhrase(name, field, value)`, `fitPhrasesToCourse(top)`, `addExtension(ids, entry)`, `setExtension(index, field, value)`, `removeExtension` |
| Set pieces (`piece-edits.ts`) | `addSetPiece(ids, kind, floor)` (default values per kind; after the last piece on a floor at or below its own, so a file in floor order stays in it), `moveSetPiece(index, floor)` (the floor only; the list keeps its order so a drag's index stays valid), `setSetPieceField(index, field, value)` (refuses a field the kind does not have, or no value for one it needs), `removeSetPiece` |

The spec's first list had 23 names; `setStageId`, `setUnlock`, `setPreviewAlias`, `setAmbienceAlias`, `setExtension`, `addCourse`, `removeCourse`, `removePresentation`, `removeCitySink` and `sortLayersByDepth` are added because the Stage, Assets and Course views edit those fields and the acceptance case FF-o rebuilds the four shipped stages from an empty one by commands alone (a test does so for the model: each result equals the shipped file's value). The layer list is back to front in the file and shown front-first in the panel with "Front" and "Back" captions; the file does not change.

**Repairs** (`stage-fixes.ts`, the profile's `fix`): `applyStageFix(document, diagnostic, context)` turns the name a finding carries into commands. `reorder-layers` lists each plate's layers by depth in the slots the plate already holds (the sky and city layers keep their places in the list, the drawing order across plates; equal depths keep theirs), which clears every `layerOrder` finding at once and can leave a sky plate that is nearer than the layers after it somewhere other than first, reported as `plateFirst`. `fit-phrases` is `fitPhrasesToCourse` with the top floor read from the stage's `COURSE_FLOOR_COUNT` (else the base tuning, else the default): each phrase ends the floor before the next starts and the last ends at the top; a start is kept where it can be (after the phrase before, early enough to leave a floor for each after), so a gap is absorbed by the phrase before it, an overlap is trimmed from it and a missing tail goes to `finish`, and the boundaries the author drew stay. `remove-name` removes the one name in a piece's `layers` that the finding's path points at (a swarm left with none stays an error; a weather burst left with none drops its `layers`, which means every layer). A finding with no repair, an unknown repair, or a target that is gone throws.

**Profile object** (`floorfifty-stage.ts`): `sniff` claims a text with a `platformAlias =` line (so a file the parser will refuse is still routed here, and its errors get positions) or a `.toml` file that opens a `[theme]` table; `print('', document)` prints a document that was never loaded against `NEW_STAGE_TEXT`, the smallest stage the schema accepts; `check` reads `ProjectContext.assets` as the art manifest's aliases (the tunable declarations, `tuning.toml` and the tallest course are the checks' bundled defaults until the app reads the game's folder); the templates are **Empty** (one sky plate), **Sky only** (plus the sun and a band of clouds) and **Simple city** (plus two skylines, the presentation block and a course on the default 19-floor climb with Rooftops' seed), all with the game's real aliases so a loaded manifest accepts them; the single export is the stage file at `content/stages/<id>.toml`, printed against the loaded text. "Copy of…" copies an open document with its base text and is an app flow.

| View | Mockup | Panel | Canvas | Inspector | Dock |
|---|---|---|---|---|---|
| **Compose** | `ff-compose` | Layers (front first): sun/light row, each layer with grip, eye, swatch, alias, plate chip, depth | Framed viewport with the composed scenery, selection outline, sink handle, ghost extents | Layer fields (alias picker, plate, depth, sink, haze, extend, arc, drift) with inline diagnostics | Climb scrubber with phrase bands, set-piece pins, citySink curve |
| **Course** | `ff-course` | Seed, phrase list, extension list | Generated floors, bounds, reach, demand | Phrase card (range steppers, purpose), seed with reroll and pin, tunables | Floor strip |
| **Set pieces** | `ff-pieces` | Piece list grouped by floor | Preview of the selected piece playing over the composition | Kind-specific fields; flashes carry the WCAG 2.3.1 note | Lanes by kind across floors 1 to 50 |
| **Stage** | `ff-settings` | Sections | n/a | Identity (id, name, unlock, platformAlias), presentation, courseTuning table | n/a |

Flows: **New stage** (Home → New → template Empty, Simple city, Sky only, Copy of… → Compose with a valid minimal document: one sky plate layer); **Open** (file, or a folder on Chromium to read `content/stages/`, `tuning.toml` and the art manifest alongside); **Edit a layer** (select, inspector fields or drag the sink handle with finger or Pencil, one undo step per gesture, canvas and Checks update within a frame); **Scrub the climb** (drag the playhead, parallax and the citySink arc follow, set-piece pins light up); **Fix** ("Reorder: cityMid is nearer than cityNear", "Fit phrases to 1–19"); **Export** (diff against the loaded text, then destination).

### 10.7 Checks

`checkStage(document, context): Diagnostic[]` runs on the document's **value**, not on the schema's verdict: a command can leave a value the schema would refuse (a duplicated layer has its alias twice, a dragged sink leaves its range, a layer moved past a nearer one breaks the depth order), and the editor keeps that document open, says what is wrong and where, and offers the repair. A test makes the vendored schema the oracle for the rules the checks restate: 49 edits within the types a command can produce, applied to the minimal and the four shipped stages, singly and as 600 seeded sequences; the checks report an error at a schema issue's path exactly when the schema refuses the value.

A finding's `path` is the parse error's path with each list index replaced by the element's id (`theme.layers[b2].depth`, `theme.setPieces[b0].layers[1]`, `course.extension[b1]`), so a reorder does not change it; the four phrases keep their index (`course.phrases[2].toFloor`), and `courseTuning.GRAVITY` names a tunable. Messages name the layer, phrase or piece, the value and the limit, in words; a run of floors is one finding (`floors 5–10`), never a sentence a floor. Findings come errors first, then warnings, then info.

`StageCheckContext` is `{ aliases?, tunables?, baseTuning?, tallestFloor? }`; each missing member means the bundled one: no manifest, FloorFifty's tunable declarations (`tunables.ts`, vendored at `ee5d44e`), the declared defaults, and the tallest finite course of 49.

| Source | Codes (errors unless noted) |
|---|---|
| Stage identity and aliases | `id` (the id and the unlock), `displayName`, `emptyAlias` (also a layer's alias and a name in a set piece's list), `presentationRange`, `seedInvalid` |
| Course shape | `phraseOrder`, `phraseRange` (a floor that is not a whole number from 1, or a phrase or entry that ends before it starts), `emptyPurpose`, `purposeTooLong` |
| Layers | `noLayers`, `layerRange`, `plateOnlySky`, `arcOnlyCity`, `driftOnPlate`, `plateFirst`, `duplicateAlias`, `layerOrder` (fix `reorder-layers`: "cityMid has depth 0.2, further than cityNear (0.5) before it") |
| Set pieces | `setPieceRange` (floor, hold, flashes, kick, density, speed, and how many layers a piece names), `tooManyPieces` |
| Course against the climb (`validate/course.ts`) | `phraseOverlap`, `phrasePastTop`, `floorsUnaccounted` (fix `fit-phrases`), `extensionOverlap`, `extensionPastTallest`, `extensionUnaccounted`. The top floor is `COURSE_FLOOR_COUNT - 1` of the base tuning with the stage's `courseTuning` on top; when that count is out of range the course checks stay quiet and `tunableRange` reports it. Floors are handled as runs, so a phrase that ends at floor 1e15 is a finding, not a loop |
| Aliases (`validate/aliases.ts`) | `unknownAssetAlias` for the five stage aliases and every layer, when a manifest is loaded, with the nearest names by edit distance in the message (a swap of neighbours is one edit; names within a sixth of the alias's length); `aliasesUnchecked` (info, one for the stage) when none is loaded |
| Set pieces (`validate/set-pieces.ts`) | `unknownReference` for a name in a piece's `layers` that the stage does not draw (fix `remove-name`) |
| Tuning (`validate/bounds.ts`) | `unknownTunable` (with the nearest name), `codeOnlyTunable` (an invariant such as `TICK_HZ`), `tunableRange` (range, and a whole number for an `int` tunable) |
| Editor-only | `flashRate` (warning): the sky flashes on one floor start together, flash `i` of a piece `i × max(334, hold ÷ flashes)` ms after it (the director's own schedule), and more than three starting inside one second breaks WCAG 2.3.1. Pieces on different floors start when the climber reaches them, which no check can know |

Differences from the first draft of this section: `unusedLayer` is cut (no rule that needs only the document and a list of aliases says a layer is unused; it returns when the Compose view defines what unused means); `emptyPurpose` is an error, not editor-only, because the schema refuses an empty purpose; one info finding `aliasesUnchecked` replaces one per alias; and the codes `emptyAlias`, `noLayers`, `presentationRange`, `seedInvalid`, `purposeTooLong` and `codeOnlyTunable` name schema and bounds rules the first list left out. Enum values (a mood, a particle, a plate) are not checked: the types keep a command from producing a wrong one.

## 11. Persistence

Kit storage (§4.7 of the kit spec) with these rules: the workspace in OPFS holds copies of project files under `projects/` and stage files under `stages/`; tileset images and the art manifest are workspace inputs under `assets/`; the original path is remembered as metadata for export; when a folder is attached, Save writes the real file with the `mtime` guard. A missing image degrades that tileset or layer to placeholders, never the document. The autosave journal stores the profile's printed text, not the in-memory value.

## 12. Responsive and input inventory

| Context | Mode | Notes |
|---|---|---|
| iPad 11" landscape 1194×834 | `wide` | Reference for the mockups; canvas 554×602 beside a 264 panel and 320 inspector |
| iPad 11" portrait 834×1194 | `medium` | Layers and inspector as drawers; the palette and dock are bottom sheets; the canvas is the whole width |
| iPad mini 1133×744 | `wide`, short | Dock hidden until summoned by a rail button; the world cards also reachable from a chip over the canvas |
| iPad 13" 1366×1024 | `wide` | |
| Desktop ≥ 1440 | `wide` | Hover, shortcuts: `Mod+Z`, `Mod+Shift+Z`, `Delete`, `Mod+D` duplicate, `B` brush, `R` rectangle, `G` fill, `E` eraser, `I` picker, `[` `]` brush size, arrows nudge the selection by one cell (shift 8), `Alt+↑/↓` reorder in lists |
| Phone | `compact` | Not a target; opens, edits and exports without data loss |
| Input | | Finger: select, drag, pan, pinch. Pencil: precise drags and strokes, hover shows the brush footprint. Mouse: wheel zoom, middle pan. Keyboard: every inspector field and rule cell |

Touch targets stay 44 (48 for Export); tile palette cells are 44 on `compact` and `medium` and scale up to the grid size on `wide`; the rule pattern cells are 44; nothing is hover-only; the canvas never scrolls the page. The Level view's essential actions on a short height are tools, undo/redo, layers and Export; the palette and dock open as sheets (kit §4.2).

## 13. Failure and recovery

| Failure | Behavior |
|---|---|
| Not JSON, or `format` is not `af2d` | Error panel with line and column when JSON, a read-only text view; nothing written; "Open another" |
| `version` newer than supported | Read-only with "made by a newer editor"; never rewritten |
| `version` older | Migrated in memory, "Upgraded from v1" in the status line; the file changes only on save |
| Unknown keys at a supported version | Read-only with the key paths listed; export of the raw text still works |
| Schema errors that are not structural (a tile out of range, a broken ref) | Opens; Checks lists them; the offending objects are marked; export allowed (ED2D-D12) |
| Tileset image missing or corrupt | Numbered placeholder tiles, `missingTileset`; no crash |
| Deleting a layer, tileset, entity definition or level that is in use | Refusal dialog listing the uses; "Delete anyway" removes them as one undo step |
| A level resized smaller than its content | Entities outside are kept and flagged `entityOutOfBounds`; tile cells outside are dropped, shown in the confirm dialog |
| Auto-tile rule with an invalid tile | The rule is skipped, `ruleTileOutOfRange` is reported |
| Texture upload fails (WebGL context lost) | Canvas shows "Preview paused", restores on `webglcontextrestored`; document and history unaffected |
| Pointer cancelled mid-stroke | The transaction cancels; no partial stroke |
| Write conflict, quota, permission | Kit §6 |
| Edit while an export dialog is open | The dialog recomputes; export operates on the latest state |
| File over 16 MB, or a level over the guard rails | Refused with a size message |
| FloorFifty profile: TOML syntax error, schema errors, unknown keys, missing manifest | TOML syntax error shows the error panel with line and column and a read-only text view; schema errors open the document with Checks; an unknown key is kept verbatim as an `unknownKey` warning and the profile refuses to patch inside a table it cannot validate, saying why; a missing manifest or image is a placeholder and one info diagnostic |

## 14. Testing

| Layer | What | Where |
|---|---|---|
| Unit | Schema and codec round trips; cell encoding (property); chunked grid; commands; checks; auto-tile engine; export; id source; migrations with fixtures; the FloorFifty codec, commands, checks, `composeStage`, `createCourse`, demand | `model/`, `tiles/`, `profiles/**`, renderer-free |
| Property | RLE `decode∘encode` is identity; random command sequences then undo of any prefix restores the project byte-for-byte when printed; incremental auto-tile equals full recompute; FloorFifty `print` re-parses to `value` and undo restores the original text | `model/`, `tiles/`, `profiles/floorfifty-stage` |
| Golden | Auto-tile output hash for fixed IntGrids and rule sets, **identical in Node, Chromium, WebKit and Firefox** (the browser projects run the same file); `composeStage` and `createCourse` vs FloorFifty; shipped stages open with zero errors | fixtures in `src/testing/fixtures/` |
| Architecture | The import-graph rules of §4; no template or profile ids in `app`, `tiles`, `canvas` (G-s) | one unit test |
| DOM | Layer panel, palettes, entity inspector and every field type, rule editor, diagnostics list, export dialog states | Vitest browser mode |
| Layout | Shell regions at the sizes in §12 | kit layout project |
| Journeys | Platformer level and RPG map end to end; link two maps; retype refusal; rotate mid-stroke; FloorFifty: new stage → layers → seed → piece → export, open Rooftops → drag sink with Pencil → undo | Playwright WebKit iPad profiles |
| Visual | Level and stage canvases vs recorded images | GPU runner (D-5); Owner visual acceptance; never auto-promoted |
| Device | iPad Safari manual, plus `test-request` on the bus for the Mac/PC/Linux runs | Orchestrator |

Fixtures: the two sample projects (Mossgate, Hollowmere), a minimal project, a project per error class in §9, malformed and newer-version files, FloorFifty's four stages, a minimal stage, a stage per stage error class, malformed TOML. TDD: the first commit of each task is its plan; the first test fails for the stated reason.

## 15. Acceptance cases

General (the editor):

| ID | Case | Pass |
|---|---|---|
| G-a | Create from `platformer`, paint on three layers, place entities, save, re-open | The re-opened project equals the saved one |
| G-b | Open a canonical file and save with no change | Byte-identical output |
| G-c | Paint IntGrid cells under an auto layer | The tiles equal the engine's full recompute; one stroke is one undo step |
| G-d | Auto-tile golden: fixed IntGrid and rule set | Same hash in Node, Chromium, WebKit and Firefox |
| G-e | Place an entity; edit an int beyond its max, an enum, a colour, a point list and a ref | Invalid values are refused with a message and the field keeps its value; valid ones are undoable |
| G-f | Retype a field in use; delete an entity definition in use | Refusal listing the exact instances (kit EK-j); "Delete anyway" is one undo step |
| G-g | Link a door to a spawn in another level, then delete the spawn | `brokenRef` on the door, with the "Choose target" fix; the link vanishes from the world map |
| G-h | Arrange five levels on a free world, switch to `grid` | Positions snap; neighbours appear in the export; undo restores |
| G-i | Export both sample projects as AF content | The TOML validates against `content.schema.ts`; decoded rows equal the editor's grids; auto layers export resolved tile stacks |
| G-j | Pencil-drag a stroke of cells | One undo step; two-finger tap undoes it |
| G-k | Rotate 1194×834 → 834×1194 during a stroke | Stroke cancelled, nothing lost, drawers in place, selection kept |
| G-l | Kill the tab after three edits | Restore offers them; restored state equals the pre-kill state |
| G-m | Write to a folder whose file changed meanwhile | Conflict dialog; nothing overwritten |
| G-n (fail) | Open a file that is not JSON, or has `format` ≠ `af2d` | Error panel; no workspace file created |
| G-o (fail) | Open a file with a newer `version` | Read-only with the message; the file is never rewritten |
| G-p (fail) | Open a file with an unknown key | Read-only with the key paths listed |
| G-q | **Platformer, end to end (ED2D.10):** from `platformer` build a level (ground via IntGrid and the auto layer, platforms, a spike hazard, player start, three enemies with patrol paths, coins, a door), a second level, link them, Checks shows zero errors, export, re-open | The re-opened project equals the saved one; the export validates (G-i) |
| G-r | **RPG, end to end (ED2D.10):** from `topdown-rpg` build a village map (ground tiles, a walls IntGrid with the auto layer, tree props, two NPCs with dialogue, a door to the inn and a warp to the forest path), the inn map with a return door, Checks shows zero errors, export, re-open | Same as G-q |
| G-s | **One editor, no genre in the code:** G-q and G-r run on the same build; a test scans `src/app`, `src/tiles` and `src/canvas` | No template or profile id appears there; both samples load through the same code paths |
| G-t | From `blank`, define a layer and an entity with fields and place them | Works with no code change (a puzzle or shooter level is possible) |

FloorFifty profile:

| ID | Case | Pass |
|---|---|---|
| FF-a | Open each shipped stage, change nothing, export | Output equals the input byte for byte |
| FF-b | Open Rooftops, set layer 3's sink 150 → 160, export | The diff is exactly one line |
| FF-c | Remove a layer, add a set piece, reorder two layers | Re-parse equals the expected value; every other comment line is unchanged; undo ×3 restores the original bytes |
| FF-d | Reorder `cityMid` in front of `cityNear` | `layerOrder` error on the right field with a working fix; the canvas shows the wrong order until fixed |
| FF-e | Type a misspelled alias with a manifest loaded | `unknownAssetAlias` with the nearest alias as a fix |
| FF-f | Shorten phrases so floor 19 is unclaimed | `floorsUnaccounted` with "Fit phrases"; applying it clears the error |
| FF-g | Scrub the climb on Rooftops at floor 0, 25, 50 | `composeStage` matches FloorFifty's numbers; the canvas draws the same city sink as the game |
| FF-h | Seed 35229 in Course | Floors equal FloorFifty's generator's |
| FF-i | Pencil-drag a layer's sink handle | One undo step; two-finger tap undoes it |
| FF-j (fail) | Open a stage with a TOML syntax error | Error panel with line/column; no workspace file created |
| FF-k (fail) | Open a stage with a key the schema does not know | `unknownKey` warning; text preserved; no patch inside that table |
| FF-o | **Build a FloorFifty stage (EDFF.5):** rebuild Dawn, Rooftops, Snow Shrine and Sunken Dome from empty stages | Each re-parses to a value that equals the shipped file's value; FloorFifty's content compiler accepts it |

## 16. Tasks

Rows and order are in the [master plan](../../02-master-delivery-plan.md#ed-editors-owner-amendment-2026-10-23).

- **The editor:** ED2D.1 project model, `.af2d.json`, migrations and the profile registry (headless; needs EDK.7 and the kit's `History`) → ED2D.2 tile tools and the auto-tile engine (headless) → ED2D.3 templates, checks and AF content export (headless) → ED2D.4 app shell, Home and the Level view (platformer end to end) → ED2D.5 tilesets, rules and entity-definition editors → ED2D.6 world map and linked levels (RPG end to end) → ED2D.7 export dialog, checks panel and recovery → ED2D.8 Pencil and touch polish, accessibility, journeys → ED2D.9 `automata editor` command and docs → ED2D.10 acceptance (G-q, G-r, G-s, G-t).
- **The FloorFifty profile (parallel lane after ED2D.1):** EDFF.1 headless profile (vendored schema, codec, checks, compose, course) → EDFF.2 Compose view → EDFF.3 Course view → EDFF.4 Set pieces → EDFF.5 acceptance (FF-o).

ED2D.1 starts as soon as this spec is reviewed and EDK.7 lands; EDFF.1 can start from the `Profile` interface alone.

## 17. Open questions (answers will come from the Owner through the Orchestrator)

1. **A `tilemap` extension** to consume `levels/*.toml` is unplanned (the 2D analogue of the 3D `sectors` extension). Default: proposed as a post-ED2D.7 row, asked on the bus.
2. **LDtk compatibility.** Importing an `.ldtk` project would bring existing user work in. Default: not in v1; a candidate row after ED2D.10.
3. **Shared enums** (a project-level list of names reused by many fields and tile tags). Default: v1 uses per-field `options` and tileset tags; add project enums if duplication hurts.
4. **Multi-tile rule outputs** (a rule stamps a 2×2 object). Default: later; single-tile stacks cover edges, corners and variants.
5. **Slopes and per-tile shapes.** Default: IntGrid values carry the meaning (a `slope-up` value); the game interprets them.
6. **Stage means the content file.** FloorFifty has no hand-placed floor geometry (floors come from the seed). If the Owner also wants authored floors, FloorFifty needs a `course.floors` field first; the profile would add a Floors layer then. Default: not in scope.
7. **Where the editor is served from** (LAN dev server, a static host, a Ruken-style page). Default: static build plus `automata editor` for a game checkout; hosting is the Owner's call.
8. **Art access.** FloorFifty's art is in a private repository; the editor never fetches it. Default: the Owner imports `assets/` into the workspace; placeholders otherwise.
