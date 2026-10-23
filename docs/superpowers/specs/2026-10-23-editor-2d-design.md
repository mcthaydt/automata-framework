# ED2D: the 2D editor (FloorFifty stages first, LDtk-style levels next)

> **Status:** drafted 2026-10-23 (lane **editor-2d**, thread "2D level editor"), review pending. Not reviewed, not implemented. Task rows: [ED2D.0 to ED2D.9](../../02-master-delivery-plan.md#ed-editors-owner-amendment-2026-10-23). Shared pieces are in the [editor kit spec](./2026-10-23-editor-kit-design.md).
>
> **Why (Owner via the Orchestrator, 2026-10-23):** "Add one 2D editor, LDtk-like, that can at minimum build a complete FloorFifty stage. Figma mockups first. Tablet-first, web-based." Mockups: Figma file [Automata Editors](https://www.figma.com/design/8H4vY5xZj7xIedrvDdwg2d), pages `2D · Home`, `2D · Stage`, `2D · Level`, `2D · States`.

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| FloorFifty `content/stages/{dawn,rooftops,snow-shrine,sunken-dome}.toml` | `SNEKPRTY/FloorFifty` `ee5d44e` (2026-10-21) | The format to author and the acceptance fixtures |
| FloorFifty `packages/content/src/schema/stage.ts` (258 lines) | same | The stage schema, vendored (§5.1) |
| FloorFifty `packages/content/src/validate/{course,aliases,set-pieces,bounds}.ts` | same | The checks the editor must reproduce (§7) |
| FloorFifty `apps/client/src/systems/render/{stage-layers,stage-presentation}.ts` (618 + 214) | same | The composition math the preview must match (§5.3) |
| FloorFifty `packages/shared/src/level/{course,demand,rng}.ts` | same | The seeded course generator and per-floor demand (§5.4) |
| FloorFifty `packages/asset-contract/assets/art-manifest.json` | same | Aliases, sizes and bundles for the asset picker |
| LDtk (ldtk.io) data model and editor | v1.5 docs | Concepts for §9: worlds, levels, layers, definitions, fields |
| The Last Light `editor/` | `PixiJS3D_Experiment_001` `92e6704` | Shell conventions only (the 3D thread extracts the rest) |

## 1. What a FloorFifty stage is (measured)

A stage is one TOML file in `content/stages/`. FloorFifty draws its floors from a seed, so a stage is **a frozen course plus a theme**, not a tile map.

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

The files are written by people for people: `rooftops.toml` is 30% comments, with design rationale beside the numbers. **The editor must never destroy that.** This drives the codec decision (§5.2).

## 2. Scope

In (minimum, Owner): author a complete FloorFifty stage from nothing and edit the four shipped ones, with the composition shown live as the game draws it, on an iPad, and export a file FloorFifty's compiler accepts.

In (next, "close to LDtk"): a generic level project with a world map, tile, int-grid and entity layers, definitions and typed fields (§9), exported as AF content.

Out: running the game inside the editor (the stage preview is the scenery composition, not a race); editing characters, songs, modes or unlocks; making art; the AF runtime consumption of levels (a tilemap extension, to be planned by the contract owner named in §9.3); cloud sync.

## 3. Decisions

| ID | Decision | Default and why |
|---|---|---|
| ED2D-D1 | The editor edits **the game's own files**, not an editor project format, for stages | The stage TOML is the contract; a second format would drift. LDtk's single `.ldtk` project is right for a generic level tool and is used for levels (§9), not for stages. |
| ED2D-D2 | Comment- and format-preserving TOML via `@decimalturn/toml-patch` (MIT) on top of `smol-toml` (already in the stack) | Measured 2026-10-23: identity patch is byte-equal on all four shipped stages, and a one-value edit changes exactly the lines that hold it. The structural edits (add, remove, reorder layers and pieces) keep every other comment. New dependency: needs the `deps:new` review in the PR. |
| ED2D-D3 | The stage schema is **vendored** with a recorded source commit, not imported | FloorFifty's `content` package is not in AF (stages are game content, extraction map §4). A vendored copy is refreshed by a script that diffs against FloorFifty at a pinned commit; a profile registry lets a game supply its own (§5.1). |
| ED2D-D4 | Composition math is a pure function ported from `StageLayers`, and tested against numbers taken from FloorFifty's own tests | "WYSIWYG" is a claim about numbers. The Pixi scene only applies them. |
| ED2D-D5 | Tablet-first means the iPad Safari feature set | No directory picker, no File System Access: OPFS workspace, import with the file picker, export with the share sheet or download. A folder adapter is an upgrade on Chromium desktop. |
| ED2D-D6 | Canvas views are PixiJS 8 (WebGL2); lists, inspectors and timelines are DOM/SVG | ADR 0002 (PixiJS only); DOM gets accessibility and text input for free. |
| ED2D-D7 | Real art when available, honest placeholders otherwise | With a manifest and image files loaded, layers show their art. Without, each layer is a labelled plate tinted by its role and sized from the manifest, and the status line says "Placeholders: no art loaded". Never a fake picture. |
| ED2D-D8 | Export always works; writing into a game folder is blocked while errors stand | A draft with errors can still be saved or shared; the compiler is the final judge, the editor is a fast mirror of it. |
| ED2D-D9 | Levels are a second profile on the same engine, specified in an amendment before ED2D.6 starts | Keeps this spec honest about what is designed (the stage) and what is only outlined (§9). |

## 4. Ownership and architecture

Packages (all `private` until a consumer outside the repo exists):

| Package | Owns | Depends on |
|---|---|---|
| `packages/editor-kit` | Shell, history, gestures, widgets, storage ([kit spec](./2026-10-23-editor-kit-design.md)) | `@mcthaydt/automata-ui` geometry, Svelte 5 |
| `packages/editor-2d` | Everything below | `editor-kit`, `pixi.js`, `zod`, `smol-toml`, `@decimalturn/toml-patch` |

Inside `editor-2d` (folders group by feature, files take role suffixes):

```
src/
  model/            project.resource.ts, document.resource.ts, profile.plugin.ts   (profile registry)
  profiles/
    floorfifty-stage/
      stage.schema.ts          vendored from FloorFifty, source commit recorded in SOURCE.md
      stage.codec.ts           parse, patch, stringify (toml-patch), error positions
      stage.commands.ts        every edit as a History update, one function each
      stage.checks.ts          schema + course + alias + set-piece checks as Diagnostics
      stage.compose.ts         composeStage(): layer transforms for (cameraY, progress, time)
      stage.course.ts          createCourse(seed, tuning), demand per floor
      stage.template.ts        "New stage" templates
    level/                     (ED2D.6)
  canvas/           compose.view.ts (Pixi), course.view.ts (SVG), textures.manager.ts
  app/              shell wiring, views (Svelte), stores
```

Contract owners: the **stage document** type and its checks are owned by `profiles/floorfifty-stage`; the composition output type (`LayerPlacement[]`) is owned by `stage.compose.ts` and consumed by the canvas and the tests only. No copy lives in the canvas.

## 5. The FloorFifty stage profile

### 5.1 Document and profile registry

```ts
interface StageDocument {
  readonly path: string                 // content/stages/rooftops.toml
  readonly base: string                 // the text as loaded (comments, layout)
  readonly value: StageValue            // parsed, validated shape (schema output)
  readonly draft: DraftState            // fields mid-edit that are not yet valid (e.g. empty alias)
}
interface Profile<V> {
  readonly id: 'floorfifty-stage'
  parse(text: string): Result<V, ParseError[]>       // positions for every error
  print(base: string, value: V): string              // minimal patch of base
  check(value: V, context: ProjectContext): Diagnostic[]
  template(kind: string): V
}
```

`History` state is the `StageDocument`'s `value` + `draft`; the text is derived (`print(base, value)`) on demand for the diff and export, never stored per step.

### 5.2 Codec rules

1. Opening and exporting with no change returns the original text byte for byte (tested on all four stages).
2. A changed scalar changes only its own line. A new table or array element is inserted after its siblings with the file's existing style (blank line between tables, key order as the schema lists them). A removed element removes the comment block directly above it, nothing else.
3. Reordering layers moves each table with its leading comment block.
4. Output must re-parse to exactly `value` (tested as a property over generated edits).
5. Parse errors report line and column; the editor shows them and never replaces the file.

### 5.3 Composition (WYSIWYG)

`composeStage(presentation, layers, { cameraY, progress, timeSeconds, framing })` returns, per layer, `{ alias, x, y, tileX, alpha, haze, visible }`, plus the light's position, by the same formulas as `StageLayers.update`:

- city layer `y = −cameraY + cameraY·factor·0.15 + sink + citySink(progress)·arc + framingSink + lift`; sky layer `y = −cameraY·(1−factor) + sink + lift` (+ `framingSink` for a sky plate); `tileX = cameraY·factor·0.2 + timeSeconds·drift`;
- `lift = horizonLift · smoothstep(progress)`; `citySink(progress)` interpolates linearly between knots built from the phrases' ends, never decreasing;
- sun `y = −lightHeight − cameraY·0.94 + lift`; default `lightHeight` is −60; a layer's default `arc` is `depth / 0.35` for city, 0 for sky.

The canvas view applies these placements to Pixi sprites; the unit tests assert the numbers. Golden numbers come from FloorFifty's `tests/client/systems/render/stage-layers.test.ts` and from running `StageLayers` headlessly at progress 0, 0.5 and 1 for each shipped stage.

The preview controls are the climb scrubber (floor 0 to 50, mapped to `progress` and `cameraY`), a viewport chip (phone portrait 390×844, phone landscape 780×270, tablet), a time control (play/pause drift, reduced-motion toggle), and a "Ghost" toggle that outlines every layer's extent.

### 5.4 Course

`createCourse(seed, tuning)` is a port of FloorFifty's generator (`course.ts`, `rng.ts`) with the same integer RNG, tested against FloorFifty's output for seeds 35229 and 34528. The Course view draws floors 0 to the course's top as bars (stationary or moving with a direction arrow), the horizontal bounds, the reach of one bounce, and per-floor horizontal demand (`demand.ts`). Tuning comes from the project's `tuning.toml` (bundled FloorFifty defaults when none is loaded) with the stage's `courseTuning` on top.

### 5.5 Commands

Every edit is one named function in `stage.commands.ts` that takes the document and returns the next, so undo labels, keyboard handling and tests share them. Representative set (each has a test):

`renameStage`, `setPlatformAlias`, `setBackdropAlias`, `setLight`, `addLayer`, `removeLayer`, `duplicateLayer`, `moveLayer(index → index)`, `setLayerField(index, field, value)`, `dragLayerSink(index, delta)` (a transaction), `setPresentation(field, value)`, `setCitySink(phrase, value)`, `setSeed`, `rerollSeed`, `setPhrase(name, field, value)`, `fitPhrasesToCourse`, `addExtension`, `removeExtension`, `addSetPiece(kind, floor)`, `moveSetPiece(index, floor)`, `setSetPieceField`, `removeSetPiece`, `setCourseTuning(name, value | undefined)`.

Layer order: the list is back to front in the file and shown front-first in the panel, with "Front" and "Back" captions at the ends (the panel's convention matches every layer panel, the file's does not change).

## 6. Views and flows

Mockup ids refer to the Figma pages above. All views share the kit shell: top bar, rail (56), panel (264), canvas, inspector (320), dock (148) in `wide`; drawers and sheets in `medium`.

| View | Mockup | Panel | Canvas | Inspector | Dock |
|---|---|---|---|---|---|
| **Home** | `2D · Home` | Stage list with validity badge, thumbnail, modified time; templates; storage state | n/a | Selected stage summary, Open, Duplicate, Delete, Export | n/a |
| **Compose** | `2D · Stage` | Layers (front first): sun/light row, each layer row with grip, eye, swatch, alias, plate chip, depth | Framed viewport with the composed scenery, selection outline, sink handle, ghost extents | Layer fields (alias picker, plate, depth, sink, haze, extend, arc, drift) with inline diagnostics | Climb scrubber with phrase bands, set-piece pins, citySink curve |
| **Course** | `2D · Stage` | Seed, phrase list, extension list | Generated floors, bounds, reach, demand | Phrase card (range steppers, purpose), seed with reroll and pin, tunables | Floor strip |
| **Set pieces** | `2D · Stage` | Piece list grouped by floor | Preview of the selected piece playing over the composition | Kind-specific fields; flashes carry the WCAG 2.3.1 note | Lanes by kind across floors 1 to 50 |
| **Stage** | `2D · States` | Sections | n/a | Identity (id, name, unlock, platformAlias), presentation, courseTuning table | n/a |
| **Checks** | `2D · States` | Diagnostics grouped by severity, each linking to its field | n/a | The failing field's inspector | n/a |
| **Export** | `2D · States` | n/a | n/a | n/a | Dialog: text diff against the file as loaded, destinations, error count |

Ordered flows:

1. **New stage:** Home → New → template (Empty, Simple city, Sky only, Copy of…) → Compose with a valid minimal document (one sky plate layer) → Checks shows what is missing (course optional, art aliases unchecked without a manifest).
2. **Open:** Home → Open file(s) → parse → (error: error panel with line and column, original untouched) → Compose; or Open folder (Chromium) → list `content/stages/`, read `tuning.toml` and the art manifest alongside.
3. **Edit a layer:** select (tap row or tap the layer in the canvas) → inspector fields or drag the sink handle with finger or Pencil → one undo step per gesture → canvas and Checks update within one frame.
4. **Scrub the climb:** drag the playhead → `progress` and `cameraY` update → canvas shows the parallax and the citySink arc at that floor; set-piece pins light up as the head passes.
5. **Fix:** a diagnostic with a known repair offers it as an action ("Reorder: cityMid is nearer than cityNear", "Fit phrases to 1–19"); applying it is one undo step.
6. **Export:** Export → diff against the loaded text → destination: Download, Share, Copy, Write to folder (when a folder store is attached and errors are zero) → on write success `markClean`.
7. **Recover:** reopen after a crash → Restore/Discard (kit §5).

## 7. Checks (diagnostics)

Each diagnostic: `{ severity, code, path, message, fix? }` where `path` is the TOML key path (`theme.layers[3].depth`). Severities: error (FloorFifty's compiler would reject), warning (suspicious), info.

| Source | Codes (errors unless noted) |
|---|---|
| Schema (vendored Zod, messages rewritten for people) | `id`, `displayName`, `phraseOrder`, `phraseRange`, `layerRange`, `plateOnlySky`, `arcOnlyCity`, `driftOnPlate`, `plateFirst`, `duplicateAlias`, `layerOrder` (with fix: reorder), `setPieceRange`, `tooManyPieces` |
| Course (`validate/course.ts`) | `phraseOverlap`, `phrasePastTop`, `floorsUnaccounted` (fix: fit), `extensionOverlap`, `extensionPastTallest`, `extensionUnaccounted` |
| Aliases (`validate/aliases.ts`) | `unknownAssetAlias` (error when a manifest is loaded, info "unchecked" otherwise; fix: suggestions by edit distance) |
| Set pieces (`validate/set-pieces.ts`) | `unknownReference` for layers not drawn (fix: remove name) |
| Tuning (`validate/bounds.ts`) | `unknownTunable`, `tunableRange` (against loaded or bundled declarations) |
| Editor-only | `flashRate` (warning: more than 3 flashes per second across overlapping pieces), `emptyPurpose`, `unusedLayer` (info) |

## 8. Persistence

Kit storage (§4.7 of the kit spec) with these editor rules: the workspace in OPFS holds copies of stage files under `stages/`; the original path is remembered as metadata for export; when a folder is attached, Save writes the real file with the `mtime` guard. The art manifest and images are optional workspace inputs (`assets/art-manifest.json`, `assets/production/*.png`); a missing image degrades that layer to a placeholder, never the document.

## 9. LDtk-style levels (outline; format amendment before ED2D.6)

### 9.1 Concept map

| LDtk | Here |
|---|---|
| Project with definitions | `LevelProject`: layer, entity, tileset, enum definitions; one file `*.af2d.json` as the working format |
| World and levels on a free canvas (also GridVania, linear) | World map view: levels as rectangles at world positions with depth; free and grid layouts |
| IntGrid layer, values with names and colours | Same, with collision-style semantics left to the game |
| Entities layer, entity defs with typed fields, pivot, size, resizable, tags, references | Same; field types int, float, bool, string, text, colour, enum, point, file, entity reference, and arrays of these |
| Tiles layer, tilesets with grid size and spacing, flips | Same |
| Auto-layer rules | Later (ED2D.6b); manual tiles first |
| Level and project field instances | Same |
| Tools: select, brush, rectangle, fill, eraser, picker, stamp, random | Same set; Pencil pressure is not used for tiles |
| JSON export, simplified export | `levels/<id>.toml` for AF content (tiles run-length encoded in a multiline string) plus the working JSON |

### 9.2 Mockups

`2D · Level` shows the level view (layers, tools, tileset palette, entity inspector) and the world map. Interaction rules are those of the kit: a stroke is one transaction, two-finger pan/pinch, Pencil draws, finger pans when the Pencil is active.

### 9.3 Contract owner

The level file schema is a **new shared contract** (sim/content/snapshot/replay/host rule, AGENTS.md). Until a game runtime consumes it, `editor-2d` owns `level.schema.ts`; the amendment names the consuming milestone and proposes a `tilemap` extension (the 2D analogue of `sectors`) to the Orchestrator as a question, since no task row for it exists.

## 10. Responsive and input inventory

| Context | Mode | Notes |
|---|---|---|
| iPad 11" landscape 1194×834 | `wide` | Reference for the mockups; canvas 554×602 beside a 264 panel and 320 inspector |
| iPad 11" portrait 834×1194 | `medium` | Layers and inspector as drawers; the climb dock is a bottom sheet; the canvas is the whole width |
| iPad mini 1133×744 | `wide`, short | Dock hidden until summoned by a rail button; scrubber also reachable as a compact bar over the canvas |
| iPad 13" 1366×1024 | `wide` | |
| Desktop ≥ 1440 | `wide` | Hover, shortcuts: `Mod+Z`, `Mod+Shift+Z`, `Delete`, `Mod+D` duplicate, `[` `]` reorder, arrows nudge sink by 1 (shift 10) |
| Phone | `compact` | Not a target; opens, edits and exports without data loss |
| Input | | Finger: select, drag, pan, pinch. Pencil: precise drags, hover shows the sink guide. Mouse: wheel zoom, middle pan. Keyboard: all inspector fields, list reorder with `Alt+↑/↓`. |

Touch targets stay 44 (48 for Export); nothing is hover-only; the canvas never scrolls the page.

## 11. Failure and recovery

| Failure | Behavior |
|---|---|
| TOML syntax error on open | Error panel with line/column and a read-only text view; nothing written; "Open another" |
| Schema errors on open | Document opens; Checks lists them; the offending fields are marked; export allowed (ED2D-D8) |
| Unknown keys the vendored schema rejects (a newer FloorFifty) | Kept verbatim in the text, shown as an `unknownKey` warning; the editor refuses to patch inside a table it cannot validate and says why |
| Art manifest or image missing/corrupt | Placeholder for that layer; one info diagnostic; no crash |
| Texture upload fails (WebGL context lost) | Canvas shows "Preview paused", restores on `webglcontextrestored`; document and history unaffected |
| Write conflict, quota, permission | Kit §6 |
| Edit while an export dialog is open | Dialog diff is recomputed; export operates on the latest state |
| Huge pasted TOML (> 1 MB) | Refused with a size message; stages are small by design |

## 12. Testing

| Layer | What | Where |
|---|---|---|
| Unit | Codec round trips; commands; checks; `composeStage`; `createCourse`; demand | `profiles/**`, renderer-free |
| Property | For random command sequences over the four fixtures: `print` re-parses to `value`; undo of any prefix restores the original text byte for byte | `profiles/floorfifty-stage` |
| Golden | `composeStage` numbers vs FloorFifty; `createCourse` vs FloorFifty; shipped stages open with zero errors | fixtures in `src/testing/fixtures/` copied from FloorFifty at the recorded commit |
| DOM | Layer panel, inspector fields, diagnostics list, export dialog states | Vitest browser mode |
| Layout | Shell regions at the sizes in §10 | kit layout project |
| Journeys | New stage → add layers → set seed → add piece → export; open Rooftops → drag sink with Pencil → undo; rotate mid-edit | Playwright WebKit iPad profiles |
| Visual | Composition canvas vs recorded images for the four stages | GPU runner (D-5); Owner visual acceptance; never auto-promoted |
| Device | iPad Safari manual + `test-request` on the bus for the Mac/PC/Linux runs | Orchestrator |

Fixtures are FloorFifty's four stages, a minimal stage, a stage per error class in §7, and malformed files. TDD: the first commit of each task is its plan; the first test fails for the stated reason.

## 13. Acceptance cases

| ID | Case | Pass |
|---|---|---|
| A-a | Open each shipped stage, change nothing, export | Output equals the input byte for byte |
| A-b | Open Rooftops, set layer 3's sink 150 → 160, export | Diff is exactly one line |
| A-c | Remove a layer, add a set piece, reorder two layers | Re-parse equals the expected value; every other comment line is unchanged; undo ×3 restores the original bytes |
| A-d | Reorder `cityMid` in front of `cityNear` | `layerOrder` error appears on the right field with a working fix; the canvas shows the wrong order until fixed |
| A-e | Type a misspelled alias with a manifest loaded | `unknownAssetAlias` with the nearest alias as a fix |
| A-f | Shorten phrases so floor 19 is unclaimed | `floorsUnaccounted` with "Fit phrases"; applying it clears the error |
| A-g | Scrub the climb on Rooftops at floor 0, 25, 50 | `composeStage` matches FloorFifty's numbers; the canvas draws the same city sink as the game |
| A-h | Seed 35229 in Course | Floors equal FloorFifty's generator's |
| A-i | Pencil-drag a layer's sink handle | One undo step; two-finger tap undoes it |
| A-j | Rotate 1194×834 → 834×1194 during a drag | Drag cancelled, no loss, drawers in place, selection kept |
| A-k | Kill the tab after three edits | Restore dialog offers them; restored state equals the pre-kill state |
| A-l | Write to a folder whose file changed meanwhile | Conflict dialog; nothing overwritten |
| A-m (fail) | Open a file with a TOML syntax error | Error panel with line/column; no workspace file created |
| A-n (fail) | Open a stage with a key the schema does not know | `unknownKey` warning; text preserved; no patch inside that table |
| A-o | ED2D.9: rebuild Dawn, Rooftops, Snow Shrine, Sunken Dome from empty stages | Each re-parses to a value that equals the shipped file's value; FloorFifty's content compiler accepts it |
| A-p | Level (ED2D.6): paint a 3-layer level, export, re-open | Re-opened project equals the saved one; exported TOML validates against `level.schema.ts` |

## 14. Tasks

Rows and order are in the [master plan](../../02-master-delivery-plan.md#ed-editors-owner-amendment-2026-10-23): ED2D.1 headless profile (codec, schema, checks, compose, course) → ED2D.2 shell and Compose → ED2D.3 Course → ED2D.4 Set pieces → ED2D.5 Export, Checks, recovery → ED2D.6 Levels → ED2D.7 polish and journeys → ED2D.8 `automata editor` → ED2D.9 acceptance. ED2D.1 starts as soon as this spec is reviewed; it needs only `History` from EDK.2 and can use a stand-in until then.

## 15. Open questions (answers will come from the Owner through the Orchestrator)

1. **Stage means the content file.** FloorFifty has no hand-placed floor geometry (floors come from the seed). If the Owner also wants authored floors, FloorFifty needs a `course.floors` field first; the editor would add a Floors entity layer then. Default: not in scope.
2. **A `tilemap` extension** to consume `levels/*.toml` is unplanned. Default: proposed as a post-ED2D.6 row.
3. **Where the editor is served from** (LAN dev server, a static host, a Ruken-style page). Default: static build plus `automata editor` for a game checkout; hosting is the Owner's call.
4. **Art access.** FloorFifty's art is in a private repository; the editor never fetches it. Default: the Owner imports `assets/` into the workspace; placeholders otherwise.
