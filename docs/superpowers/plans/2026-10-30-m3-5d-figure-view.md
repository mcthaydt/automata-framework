# M3.5d: the figure view in render-pixi3d (plan)

**Task:** 02 row M3.5d (lane figures; prerequisites M3.4a, M3.4d, M3.5c). **Spec:** [M3 spec, revised three times](../specs/2026-10-18-m3-3d-characters-design.md) §4.1 (entity views), §4.4.1 (drawing, faces, presentation time), §4.4.5 step 7 (the CPU re-skin), §4.3 (the per-character light tint, M3R-D4). Acceptance: the view's parts of F-b and F-d (one rebuild on an outfit or item change, no joint moves), D3-d for the figure's position. Owner: "Auto accept all spec and plans" (2026-10-30), so this plan stands once reviewed.

**Branch:** `claude/3d-m3-5d-figure-view`, stacked on `claude/3d-m3-4d-light` (#247) and `claude/3d-m3-5c-motion` (#224) until they merge; the PR's own diff is the files below.

## Scope

`figure(def, options)` in `render-pixi3d`: a `View3dFactory` that draws a `figures` `Built` against the figure's joint matrices.

- **Parts.** Each rigid part is one `Mesh3D` under its joint's `Container3D`; the joint containers sit flat under the figure's node and take each joint's world matrix from `fk` at every pose step (flat, not nested: `Evaluated.world` is already world space, so nesting would compose twice).
- **CPU skinning.** A skinned part (`Part.skin`, rest figure space) is re-skinned on the CPU at each pose step, linear blend over its weights (two bones in the source): `v' = Σ wⱼ · worldⱼ · restⱼ⁻¹ · v`, where `restⱼ⁻¹` is the joint's rest translation inverted (rest rotations are identity). Positions and normals go into the geometry's own dynamic buffers; no GPU skinning, no glTF skin.
- **Face decals.** Each `Decal` is a small quad on its bone, centred `at`, facing `normal`, `size` texels across at `FIGURE_PPM`. Back-face culling (the material default) hides a quad turned away from the camera, which is "shown only when facing the camera". Only the neutral face draws: decals with no `when` list or one naming `neutral`, and not the blink's lids (`blink: true`) (expressions and blinks are clips' work in M3.6).
- **Materials.** `BuiltMaterial.colour` indexes the palette (`DEFAULT_PALETTE`, Endesga 64, unless `options.palette`); `shade` steps the colour (×(1 + 0.18·shade) per channel, capped); `flat` keeps its colour in any light. Without `lighting`: one `PhongMaterial` per material name, per figure. With `lighting` (M3R-D4): one `FlatMaterial` per material name, tinted each frame by `SceneLight.tint` at the figure's chest height, as `box`'s moving lit box; `flat` materials skip the tint.
- **Motion.** `options.state(components)` reads the figure's motion inputs from the render row (`moving`, `facing`, optional `moveDir`, `outfit`, `item`); `options.now()` is presentation time in seconds (default `performance.now() / 1000`). The pose is `evaluateMotion(skeleton, gait, state)` with `poseClock(gait, now)`'s `phase` and `t` and the built clearance; the facing turns the figure's node (`placeView3d` handles position and `yaw` as for `box`), so the pose is evaluated at yaw 0. It is re-evaluated only when the pose clock's step, the state or the outfit/item changes ("at each pose step"); M3.6d replaces this driver with `evaluate()` (the FigureState and clip layers), keeping the drawing.
- **Rebuild.** An outfit or item change from the state rebuilds the part list once (`build`) and replaces the drawing; the skeleton is built once per factory, so no joint moves (F-d).
- **Build budget.** Building a figure's meshes past `FIGURE_BUILD_BUDGET_MS` (5 ms: S7-Q9's Node build at p95 1.95 ms with headroom for phones until M3.1b's phone numbers land) logs one warning through `options.warn` (default `console.warn`) naming the figure and the time.

Out of scope: `evaluate()`, clips, aim and expressions (M3.6d); gloss (Phong specular; recorded as a deviation if not reachable in `@pixi/3d`'s Phong); the examples `figures-walk` and `figures-outfits-items` are steps 7 and 8 here, and split to a follow-up PR if the view's PR is already large (recorded in the log).

## Files

Create (all under `packages/render-pixi3d/src/figure/`):
- `figure-skin.ts` — `skinPart(rest, weights, world, restAt, out)`: pure linear-blend skinning of positions and normals. Test `figure-skin.test.ts`.
- `figure-decals.ts` — `decalQuads(decals, ppm)`: the neutral-face decals as quad geometry per bone. Test `figure-decals.test.ts`.
- `figure-colour.ts` — `materialColour(material, palette)`: a `BuiltMaterial` as 0xRRGGBB with its shade. Test `figure-colour.test.ts`.
- `figure-joints.ts` — `placeJoint(node, m)`: a `Container3D`'s position and rotation from a row-major `M`. Test `figure-joints.test.ts`.
- `figure-meshes.ts` — `drawFigure(built, skeleton, palette)` → `{ joints, meshes, pose(world), destroy() }`. Test `figure-meshes.test.ts`.
- `figure-view.ts` — `figure(def, options)`, `FigureViewOptions`, `FIGURE_BUILD_BUDGET_MS`. Test `figure-view.test.ts`.

Modify:
- `packages/render-pixi3d/src/index.ts` — export `figure`, `FigureViewOptions`.
- `packages/render-pixi3d/package.json` — dependency `@mcthaydt/automata-figures: workspace:*` (both private).
- `packages/figures/package.json` + `packages/figures/src/testing/index.ts` — a `./testing` entry exporting `fixtureFigures` for render-pixi3d's tests (as runtime, ui and host do).
- No changeset: render-pixi3d and figures are private.

Consumed: `figures` `build`, `Built`, `Part`, `Decal`, `BuiltMaterial`, `FigureLibrary`, `skeleton`, `evaluateMotion`, `poseClock`, `gaitOf`, `FIGURE_PPM`, `J`-free `M` maths; `content` `DEFAULT_PALETTE`; render-pixi3d `View3dFactory`, `placeView3d`, `SceneLight.tint`. Produced: `figure(def, options): View3dFactory`, `FigureViewOptions`.

## Steps (TDD: each test fails first for the stated reason, then the minimal code)

- [x] **1. Skinning.** `figure-skin.test.ts`: a vertex weighted 1 to a joint follows that joint's matrix; 0.5/0.5 between two joints lands halfway; at the rest pose every vertex is unchanged; normals rotate but do not translate. Fails: no module.
- [x] **2. Joints.** `figure-joints.test.ts`: a matrix of a 90° turn about y and a translation sets the container's position and a quaternion that turns +z to +x. Fails: no module.
- [x] **3. Colour.** `figure-colour.test.ts`: palette index 1 of Endesga 64 is 0x131313; shade +1 lightens, −1 darkens, capped at 0xff. Fails: no module.
- [x] **4. Decals.** `figure-decals.test.ts`: a neutral decal gives one quad (4 vertices, 2 triangles) centred at `at`, its winding facing `normal`, `size` texels wide at `FIGURE_PPM`; decals whose `when` lacks `neutral`, and `blink: true` lids, are skipped. Fails: no module.
- [x] **5. Meshes.** `figure-meshes.test.ts` on the fixture Wick: one `Mesh3D` per rigid part under its bone's container, skinned parts under the root with dynamic geometry, decal meshes on their bones; `pose(world)` moves a joint container to the world matrix and re-skins a skinned part's buffer; `destroy()` frees every geometry and material. Fails: no module.
- [x] **6. View.** `figure-view.test.ts`: the view stands on its component's position and turns by yaw, interpolated (D3-d); the pose is re-evaluated only when the pose step or the state changes; an outfit or item change rebuilds the parts once and no joint moves (F-d); with a `SceneLight`, a non-flat material's colour is the base times the light's tint, a flat one keeps its colour; a build past the budget warns once. Fails: no module.
- [ ] **7. Example `figures-walk`** (examples/render3d): Wick walking a loop under the angled camera, inline figure data as the lighting example inlines its lighting. Build with `pnpm build:examples`.
- [ ] **8. Example `figures-outfits-items`**: one figure cycling outfits and held items.
- [ ] **9. Gates.** `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm --filter @mcthaydt/automata-render-pixi3d test:parity` (Chromium, WebKit; Firefox has no WebGL here, the Mac runner is the proof); `pnpm build:examples` and the examples' focused e2e when steps 7 and 8 land.

## Execution log

| Date | Step | Evidence |
| --- | --- | --- |
| 2026-10-30 | 1–6 | `npx vitest run --project node src/figure/` in packages/render-pixi3d: each test file failed first on its missing module, then 19 passed; the whole node project 282 passed; `tsc -p .` clean. Deviations: the neutral face is decals with no `when` or one naming `neutral` (FigureBuilder's open eyes name it; the first filter dropped them); a rebuild replaces the whole drawing rather than keeping joint containers (simpler, and F-d holds through the shared skeleton); the build warning names the component, as `FigureDef` has no id; `tinted` is now exported from box-view.ts for the figure's tint; gloss is not drawn (no specular is set on the Phong material yet). |
