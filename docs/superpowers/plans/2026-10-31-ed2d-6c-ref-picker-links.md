# ED2D.6c: reference picker and level links

**Row:** `docs/02-master-delivery-plan.md` ED2D.6c. Lane **editors**; ED2D.6b (#310, stacked on its branch
`claude/ed2d-6b-world-view` until it merges). Size M.
**Spec:** [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §5.5, §5.7 (links on the world map), §8 (the World
row, flow 4 "Link levels", flow 8 "Fix"), §9 (Links, the Refs rule), §12, §15 G-g and G-r. Mockups `level-rpg` (link
chips on the canvas), `world` (curved links with a label, the inspector's Links list and "Linked from") and `checks`.
Accepted under the Owner's "Auto accept all spec and plans" (2026-10-30) once reviewed.

**Goal:** a `ref` field is set by picking its target (levels first, then the entities of the definitions its `to`
allows); every resolved link draws on the level canvas and on the world map; a broken one draws nothing and the Checks
offer "Choose target" (7a's dialog, unchanged); two linked RPG maps can be built in the UI.

## Decisions (veto-defaults)

1. **One owner for ref resolution.** The rule of spec §9 "Refs" moves from `profiles/level-project/checks/links.ts` to
   `model/refs/ref-resolve.ts` (pure core), and the link checks, the picker and both canvases read it. The checks'
   messages, codes and order do not change.
2. **Picker:** a two-step dialog (`RefPicker.svelte`): the levels that hold something the field may point at, each with
   its count, then that level's choices: "The level itself" first when `to` allows `$level` (or is empty), then each
   allowed instance as `<definition label> at x, y`. Back returns to the levels. The instance holding the field is not a
   choice. Picking commits `{ target, container }` (a level: `{ target }`) through `commitField`, one undo step. The
   Checks view keeps 7a's flat `TargetDialog`.
3. **What a link is called:** `<target level name> · <target definition label>`, or the level name for a level target
   (the mockup's "Inn · inn-door" uses ids; definitions read better than generated ids).
4. **Level canvas:** a chip with that name above each entity of the level whose ref resolves, in the entity's colour
   (the accent when selected), and a line to the target when it is in the same level. Drawn at screen size, like the
   entity labels.
5. **World map:** one curve per resolved link between two different placed levels, from the edge of the source level
   facing the target to the facing edge of the target, with an arrowhead and the source definition's label at its
   middle, in the source definition's colour. Pixi 8's `Graphics` has no dash, so the line is solid (the mockup's is
   dashed). Links within one level are not drawn on the map. The inspector lists the selected level's links ("Links")
   and the levels that link to it ("Linked from"), which is also how jsdom tests see them.
6. **Add level:** G-r needs a second map and no view adds one yet, so the World view's panel gets "Add level"
   (`addLevel`, one undo step, selected after). Duplicate and remove stay in ED2D.8.
7. **G-r here is the linking half:** the DOM journey builds two linked maps from `topdown-rpg` (a door each way and a
   warp), reaches zero errors, saves and re-opens equal. The full G-r (tiles, walls, NPCs, export) is ED2D.10's
   acceptance.

## Files

**Create**
- `packages/editor-2d/src/model/refs/ref-resolve.ts`, `ref-resolve.test.ts`: `refIndex(project)`,
  `resolveRef(index, field, value)` (`{ ok: true, level, item? }` or `{ ok: false, code, message }`), `isRefValue`.
- `packages/editor-2d/src/model/refs/ref-links.ts`, `ref-links.test.ts`: `projectLinks(project)` (every resolved ref of
  an instance or a level, with its source and target positions), `refTargets(project, field, holder)` (the picker's
  levels and choices), `refName(project, field, value)`.
- `packages/editor-2d/src/app/level/RefPicker.svelte`, `RefPicker.dom.test.ts`.
- `packages/editor-2d/src/app/world/world-links.ts`, `world-links.test.ts`: `worldLinks(project, rects)`, the curves'
  end points, control point, label point and colour; `levelLinks(project, level)` for the inspector.
- `packages/editor-2d/src/app/links.dom.test.ts`: G-g and the G-r linking journey in jsdom.

**Modify**
- `profiles/level-project/checks/links.ts`: consume `ref-resolve`.
- `app/level/inspector-model.ts` (+ test): a `ref` row carries `ref: { name, targets }`.
- `app/level/FieldEditor.svelte` (+ `FieldEditor.dom.test.ts`): the ref row shows the name ("Not set", or the broken
  target) and "Choose target" opens `RefPicker`.
- `canvas/draw/draw-list-types.ts`, `canvas/draw/level-draw-list.ts` (+ test): `links` in the draw list.
- `canvas/level-scene.ts` / `canvas/scene-items.ts` (+ `level-visuals.canvas.test.ts`): draw the chips and lines.
- `app/world/WorldView.svelte`, `WorldCanvas.svelte`, `WorldInspector.svelte`, `app/views/view-props.ts`,
  `canvas/world-view.ts` (+ `world-view.canvas.test.ts`, `WorldView.dom.test.ts`): links on the map and in the
  inspector; "Add level".
- `index.ts` only if knip asks (nothing new is public).

**Interfaces:** consumes the kit's `FieldDef`/`RefValue`, `History`, `commitField`, `addLevel`, `findWorld`; produces
the `model/refs` functions above and `WorldCanvasProps.links`. No profile, file format or published API changes.

## Steps (each: failing test first, confirm the reason, minimal code, green)

- [x] 1. Plan (this file).
- [x] 2. `ref-resolve`: cases (level target, instance target, container mismatch, wrong kind, missing, `to` empty) fail
  on the missing module; move the rule; `links.ts` consumes it; its existing tests stay green unchanged.
- [x] 3. `ref-links`: `projectLinks` (instance and level holders, lists, broken skipped), `refTargets` (levels first,
  level itself when allowed, holder excluded, empty levels left out), `refName`.
- [x] 4. Inspector row and `RefPicker`: model test for the row; DOM tests: choose a level then an entity commits one
  step; Back; the level itself; nothing to pick says so; 44 px choices.
- [ ] 5. Level canvas: draw-list tests for `links` (label, colour, selected, same-level line, broken gives none);
  scene draws them (canvas test, chromium image).
- [ ] 6. World map: `worldLinks` tests (edges facing each other, label point, skip same-level and unplaced); the map
  draws them (canvas test, image); inspector Links and Linked from (DOM).
- [ ] 7. "Add level" in the World view (DOM: one undo step, selected, on the map and in the dock).
- [ ] 8. G-g in Node (link, delete the spawn: `brokenRef` with `choose-target`, `projectLinks` loses it) and in jsdom
  (the world inspector's Links empties; the Checks view offers Choose target and it repairs in one step).
- [ ] 9. G-r linking journey in jsdom (decision 7).
- [ ] 10. Gates and review images (built screenshots beside the `level-rpg` and `world` mockup frames, with a README).

## Gates

- Selected: `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm --filter @mcthaydt/automata-editor-2d test:parity`
  (layout in three browsers) and `test:canvas` (chromium) for the canvas changes.
- Omitted: build, api-report, api-index, agent-skills and a changeset (editor-2d is private).
- Pending: the Mac's CI.

## Execution log

- 2026-10-31: plan written on `claude/ed2d-6b-world-view` at `8936088a`.
- 2026-10-31, steps 2 and 3: `model/refs/ref-resolve.test.ts` and `ref-links.test.ts` failed on the missing modules,
  then pass (11 tests); `profiles/level-project` and `model/refs` unit tests: 14 files, 152 tests pass with
  `links.ts` reading `resolveRef` and its own tests unchanged.
- 2026-10-31, step 4: the row and picker tests failed (no `ref` on the row; no picker: the old "coming soon" case is
  replaced), then pass; editor-2d typecheck 0 errors; unit+dom 155 files, 2547 tests pass. The FieldDefEditor's
  default row has no project, so a ref default shows its value without a picker (the third FieldEditor case).
