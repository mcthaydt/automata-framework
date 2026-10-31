# ED2D.5b Tilesets view and rule editor: TDD plan

- **Task:** ED2D.5b in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §5.4 (tilesets), §5.6 (rules), §8 (the Tilesets row, flow 6), §12 (inputs, 44 px pattern cells), §13; mockup `tileset` in `docs/design/editor-2d/screens-general.mjs`.
- **Lane:** editor-2d. **Depends on:** ED2D.5a (the commands, merged) and ED2D.4c4b (the Level view's inspector and shell use, merged). **Unblocks:** ED2D.8 (journeys and polish).
- **Status:** drafted 2026-10-31 on `claude/ed2d-5b-tilesets-view`. Owner, 2026-10-30: "Auto accept all spec and plans"; this plan is accepted once its review is done.
- **Progress:** 8 of 8 steps.

## Scope

**In:** the `TilesetsView` rail destination of the `level-project` profile (it replaces the pending view for `tilesets`):

- **Panel:** the tilesets (name, tile size, "placeholder" or the tile count), then the auto layers (each "from <source>"), the selected auto layer's rule groups (label, rule count, active), and the selected group's rules as a reorderable strip (kit `ReorderList`, a 44 px grip; each row shows its pattern, its first output tile, its id and a summary such as `2 tiles · flip X · break`). Add a group and add a rule.
- **Canvas:** the selected tileset's image as a grid of 44 px tile cells (CSS sprites from the image, numbered placeholders without it, the same cut as the palette), tap toggles a tile in the tile selection; the tags as chips (selecting a tag marks its tiles), "Tag selected" and "Untag selected" for the selected tag, a new tag from a name; below, the **live preview**: a fixed sample IntGrid of the selected IntGrid value next to what the auto layer's rules make of it, the cells the selected rule matches outlined.
- **Inspector:** tabs Rule and Group. Rule: the id, active, size (1 × 1, 3 × 3, 5 × 5), the pattern editor (44 px cells, tap cycles any, empty, filled, is, not with the chosen IntGrid value; the centre marked), the IntGrid value the cycle uses, the outputs (each removable, "Add selected tiles"), chance (percent), Flip X, Flip Y, Break on match, outside (same or a value), Duplicate and Delete. Group: label, active, Delete group.
- Every edit is one `History` step through `commitEdit`; a value the model refuses shows its message and changes nothing.

**Out, with owner:**

| What | Where |
|---|---|
| Replace image and add a tileset (a file pick, a workspace write and an image measure) | a later row (follow-up in the PR); the view does not draw the button until it works |
| "Re-roll variation" of a level's seed (`rerollSeed`) | ED2D.6 (5a's out-table); the preview uses the first level's seed for the layer |
| Moving a rule between groups, deleting a tileset | not in a row (5a's out-table) |
| Rules in a bottom dock strip | the mockup puts the rule strip in the panel; the dock stays empty (decision 6) |
| WebKit iPad journeys, Pencil polish | ED2D.8 |

## Decisions (listed in the PR for the Owner's veto)

1. **Headless first.** `tilesets/tilesets-model.ts` turns the project and the view's selection into rows and an inspector model; `tilesets/rule-preview.ts` computes the preview; `tilesets/tilesets-session.ts` holds the selection and runs every edit through `commitEdit`. The Svelte files draw and forward, as the Level view does.
2. **Selection follows the data.** The first tileset, the first auto layer, its first group and that group's first rule are chosen on open; a removed group or rule falls back to the first remaining; a tileset selection keeps only tiles that still exist.
3. **The cycle's value** is a choice beside the pattern (the source layer's IntGrid values, the first by default), and the preview's sample is painted with it.
4. **The sample IntGrid** is a fixed 12 × 8 shape (a platform with a step, a hole and a lone cell) so edges, corners, inner corners and the 1-cell case all show. Cells outside the sample read as the rule's `outside`, as in a level.
5. **"Where the rule matches"** is the selected rule evaluated alone (its group's other rules and earlier breaks ignored), which is what a person edits the pattern for; the caption says so.
6. **The rule strip lives in the panel** below its group, as the mockup draws it, so `medium` opens it with the panel drawer; the shell's dock is not used.
7. **New ids** come from the view's `IdSource` (`rule-<id>`, `group-<id>`); a duplicated rule is inserted after the original with a new id.
8. **The sprite helper** of the palette moves to `app/tile-sprite.ts` so the palette, the sheet, the rule rows and the preview cut tiles one way.

## Contract

```ts
// app/tilesets/tilesets-model.ts
export interface TilesetsSelection { tileset?: string; layer?: string; group?: string; rule?: string; tiles: readonly number[]; tag?: string; value?: number }
export function resolveSelection(project: Project, selection: TilesetsSelection): ResolvedSelection
export function tilesetRows(project: Project): readonly TilesetRow[]
export function autoLayerRows(project: Project): readonly AutoLayerRow[]
export function groupRows(def: AutoLayerDef): readonly GroupRow[]
export function ruleRows(def: AutoLayerDef, group: string): readonly RuleRow[]
export function ruleSummary(rule: Rule): string
export function tagRows(tileset: TilesetDef): readonly TagRow[]
export function ruleInspector(project: Project, layer: string, rule: string): RuleInspector | undefined

// app/tilesets/rule-preview.ts
export const SAMPLE: { cols: 12; rows: 8 }
export function sampleGrid(value: number): Grid
export function rulePreview(project: Project, layer: string, value: number, rule?: string): RulePreview

// app/tilesets/tilesets-session.ts
export function createTilesetsSession(options: { history: History<unknown>; ids: IdSource }): TilesetsSession | undefined
```

## Files

- **Create:** `packages/editor-2d/src/app/tile-sprite.ts` (+ test), `app/tilesets/tilesets-model.ts` (+ test), `app/tilesets/rule-preview.ts` (+ test), `app/tilesets/tilesets-session.ts` (+ test), `app/tilesets/TilesetsView.svelte`, `TilesetsPanel.svelte`, `TilesetSheet.svelte`, `RulePreview.svelte`, `RuleInspector.svelte`, `PatternEditor.svelte`, `TileSprite.svelte`, `TilesetsView.dom.test.ts`, `tilesets-view.layout.test.ts`.
- **Modify:** `app/level/Palette.svelte` (use `tile-sprite.ts`), `app/views/views.ts` (register `TilesetsView`), `app/views/views.dom.test.ts` if it names Tilesets as pending.

## Steps

1. [x] **Sprite helper.** Test `tile-sprite.test.ts`: a tile with an image gives the background image, size and position scaled to the cell; without a URL a flat colour. Move the palette's code; Palette's DOM tests stay green.
2. [x] **Rows.** `tilesets-model.test.ts` on the platformer and RPG templates: tileset rows (`Terrain (placeholder)`, `16 px · placeholder`), auto layer rows (`Ground`, `from Collision`), group rows with counts, rule rows with summaries (`1 tile · break`, `2 tiles · chance 30% · flip X`), tag rows with counts.
3. [x] **Selection.** `resolveSelection`: defaults, a removed rule or group falls back, tiles past the tileset are dropped, a project with no auto layer selects no rule.
4. [x] **Rule inspector model.** Pattern cells with labels (`any`, `empty`, `filled`, `is Solid`, `not Spike`), the centre index, outputs as tile items, chance in percent, the outside choice list (`same`, `empty`, each value).
5. [x] **Preview.** `rule-preview.test.ts`: the sample's shape; the result equals `autoTiles` of the sample; the matched cells of a `filled`-centre, all-`any` rule are exactly the filled sample cells; a rule with `{ is: 2 }` centre on a sample of value 1 matches nothing.
6. [x] **Session.** `tilesets-session.test.ts`: each action is one undo step with its label (cycle a cell, size, outputs add and remove, chance, flips, break, outside, active, duplicate, delete, add rule, add group, group label and active, delete group, reorder rules and groups, tag and untag, a new tag); a refused value returns the message and adds no step; undo restores the selection's fallback.
7. [x] **Views.** `TilesetsView.dom.test.ts` mounted as the app mounts it (switching the rail to Tilesets): the panel lists, the sheet's tiles and tags, tapping a pattern cell cycles it and the preview changes, Space, ArrowDown, Space on a rule's grip (the kit `ReorderList`'s keyboard) moves it (one undo step), adding an output from the selected tile, a refused chance shows the message, Delete and Duplicate. `views.ts` registers the view.
8. [x] **Layout.** `tilesets-view.layout.test.ts` in Chromium, WebKit and Firefox at the kit's eight sizes (`SIZES`): no page scroll, pattern cells and every button at least 44 px, the panel's rule strip scrolls inside its region, the inspector's footer stays reachable. Review images under `docs/evidence/owner-visual/2026-10-31-ed2d-5b-tilesets/` with a README.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm --filter @mcthaydt/automata-editor-2d test:parity` (all three browsers); `pnpm --filter @mcthaydt/automata-editor-2d build`. No changeset (editor-2d is private) beyond an empty one if `changeset status` asks.

## Execution log

- 2026-10-31: plan drafted from the spec, the mockup and the 5a commands; read at `origin/main` c3499adb.
- 2026-10-31: steps 1 to 5. `tile-sprite.test.ts` (2), `tilesets-model.test.ts` (13) and `rule-preview.test.ts` (5) failed first on the missing modules, then pass; the palette's DOM tests stay green on the moved sprite code. `palette-model.ts` exports `tileItems` (was the private `tilesOf`). The matched cells evaluate the selected rule alone with a stand-in output tile, so a rule with no output yet still shows where it would match; its chance roll still applies.
- 2026-10-31: step 6. `tilesets-session.test.ts` (13) failed first on the missing module; one case then failed on the test itself (a tile left selected), fixed in the test; 13 pass.
- 2026-10-31: step 7. `TilesetsView.dom.test.ts` (9) written before the view's behaviour was run; the first run failed 5 cases on an ambiguous query (the grip's name "Reorder Hazards and water" also matched), fixed by anchoring the query; 9 pass, and `views.dom.test.ts` maps `TilesetsView`. Deviation: the plan said Alt+ArrowDown on a grip; the kit `ReorderList` lifts with Space, moves with the arrows and drops with Space, so the test uses that. Components added beyond the plan's list: `PatternThumb.svelte` and `pattern-cell.ts` (the rule row's thumbnail and the shared kind name); `TileSprite.svelte` was not needed (each place uses `spriteStyle`). `svelte-check` clean.
- 2026-10-31: step 8. `tilesets-view.layout.test.ts` first failed 6 of 24 Chromium cases: the canvas column and the sideways tile sheet were not declared scroll regions (`is off screen`, then `is cut at the side of its scroll region` at 900 × 600 and on phones). The column is `data-scroll-region`; the sheet scrolls sideways on purpose and is `data-scroll-region="both"`, as the layout contract says for an editor's strip. Then 72 of 72 pass (Chromium, WebKit, Firefox × 8 sizes) and the DOM suite stays 9 of 9. Looking at the screenshots found two faults the tests did not: the matched-cell outline was painted under the tiles (now an `::after` overlay) and the caption said "1 cells" (now singular, with a DOM assertion). Review images and their README: `docs/evidence/owner-visual/2026-10-31-ed2d-5b-tilesets/`.
- 2026-10-31: review fix. Showing another tileset now clears the tile selection (a tile index names a tile of one sheet); the new session case failed first, then 14 of 14 pass. `TURBO_FORCE=true pnpm check` passed before it (35 of 35 tasks).
- 2026-10-31: CI fix. The Mac's parity job failed 16 WebKit cases of `tilesets-view.layout.test.ts` with "Same as the centreEmptyS is 271x22": the native `<select>` for "Outside the level" keeps WebKit's 22 px native height on macOS, which Linux WebKit here does not reproduce (all 72 cases passed locally). The editors have no other native select; enum choices use the kit `Picker`, so this one does too (44 px trigger, a listbox). The DOM case now drives the picker; it failed first on the missing "Outside the level: Empty" button, then 9 of 9 pass; the layout test is 72 of 72 in all three browsers here, and `svelte-check` is clean. Review images refreshed.

## Follow-ups

- "Replace image" and adding a tileset need a file pick, a workspace write and an image measure (`importTileset` exists); a later row.
- "Re-roll variation" belongs with `rerollSeed` (ED2D.6); the preview shows the first level's seed.
- Rule ids are truncated in the 264 px panel; rules have no label of their own in the model (spec §5.6), so the id is the name.
- Tile cells are 44 px at every size; spec §12 lets them grow to the grid size on `wide` (ED2D.8, with the palette's).
