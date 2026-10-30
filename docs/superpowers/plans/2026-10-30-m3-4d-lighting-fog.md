# M3.4d: `render-pixi3d` part 4 (lighting and fog), TDD plan

- **Spec:** [revised M3 spec](../specs/2026-10-18-m3-3d-characters-design.md) §4.1 (`Pixi3dOptions.fog`, `lighting`), §4.3 (lighting and fog), §5 (boot bakes static light; per frame characters relight; lamp change), §6, §9, §13 D3-e, §15 M3R-D4; [2026-10-16 M3 spec](../specs/2026-10-16-m3-25d-pipelines-design.md) §4.4 (the bake: vertex light once per mesh at load with occlusion from boxes and planes; a lamp change rebakes only the meshes in its range; `View3D` linear fog).
- **Task:** `M3.4d — render-pixi3d part 4: lighting and fog` (02). Lane render3d. Stacked on M3.4a (`claude/3d-m3-4a-render3d`, PR #241, under review); M3.4b (camera) is built beside it on the same base, so shared edits (the index's exports, `Pixi3dOptions`, the extension) are additive only.
- **Status:** drafted 2026-10-30.
- **Progress:** 0 of 10 steps.

## Why

Static scenery needs light that reads in the angled view without real-time lights per fragment, characters need to darken and brighten as they walk past lamps, and the far side of a room closes into fog (spec §4.2: "every authored room closes its far side with a wall or fog"). M3.4a's example shows the gap: with only a sky-and-ground fill, the props read dark. M3.5d's figure view and M3.7b's rooms consume this task's `SceneLight` and `characterTint`.

## Sources (recorded)

- The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at `92e6704`, read-only:
  - `src/render/indirect-light.ts` (208 lines): `vertexLight` (diffuse N·L, `(1 - d/range)²` falloff, the sample nudged 3 cm off its surface, the slab test against boxes with an owner exemption), `lightAt` (light reaching a point with no normal), `bakeGeometry` (a dynamic copy of a primitive with vertex colours), `createVertexLighting` (per-lamp light computed once per vertex because static lamps never move, lamp levels scaling it, no upload when nothing changed, a bounding-sphere cull).
  - `src/render/occlusion.ts` (36 lines): contact darkening where a surface runs into a wall (floor into wall 0.38, wall into wall 0.3, otherwise 0.15, reach `exp(-d/0.28)` up to 0.9 m) and round the foot of furniture (0.45, `exp(-d/0.18)` up to 0.6 m), floored at 0.3.
  - `src/render/fog.ts` (94 lines): `hazeFor` (the view's linear fog). The mist (`puffAt`, `createFogVolume`, `ParticleContainer3D`) is **not** extracted: spec §4.3 keeps it only if S7 measures it within budget, and S7 has not (M3.1b pending), so it is left out.
  - Tests ported: `tests/indirect-light.test.ts` (direct light responds to distance, normal and solid occlusion; a collider does not shadow its own smaller seat; the bake keeps every vertex; colours change with lamp levels; contact darkening at wall bases, inside corners and the foot of furniture), `tests/vertex-lighting-cache.test.ts` (no upload when nothing changed; a changed input matches a fresh pass; the cull does less work). Not ported: `tests/fog.test.ts` (the haze's look constants and the mist) and the cache tests for the moving player lamp and the touch deadband (AF has no moving lamp in M3: lamps are content with sim-driven levels).
- What changes on extraction: The Last Light's light reads its level module (`BOXES`, `LAMPS`, `BOUNCE`, the sector map, `LOOK`); AF's reads one `SceneLighting` from content: lamps, an ambient level and colour, and occluder boxes and planes. The sector-map walls become planes; the authored warm bounce pools, wall fill, shade-table steps and the moving lamp are The Last Light's look and stay there.

## Decisions (agent defaults, for the Owner's veto)

1. **Content shape.** Kind `scene-lighting`, a collection under `content/lighting/` (one TOML file per room), `sim: false` (presentation, law 1). `SceneLighting { ambient, ambientColor, lamps, boxes, planes, fog? }`: `ambient` 0 to 1 (spec), `ambientColor` (default white), `lamps: Lamp[]` (`id`, `x`, `y`, `z`, `color`, `strength` default 1, `range` > 0, `level` default 1, the level before the sim says otherwise), occluder `boxes` (`x`, `y` the base, `z`, `width`, `height`, `depth`, optional `id`) and `planes` (centre, `normal`, `width`, `height`; one-sided for contact darkening, both sides block light), and an optional `fog { near, far, color }`. Colours are 0xRRGGBB integers (TOML hex). Lamp ids are unique within a file: a duplicate is a compile error at its `id`'s line and column. Boxes and planes are in the lighting file because there is no room content kind yet (2026-10-16 §4.4: "occlusion takes boxes and planes from the room content"); M3.7 or `sectors` (M6) can feed them from rooms later.
2. **The kind is registered by `render3dExtension`** with a type-only import of `ContentSchemaDef` (a frozen `{ kind, schema, place, sim }`), because `@mcthaydt/automata-content`'s root entry reaches its Node-only compiler and the extension is in every 3D game's browser bundle.
3. **The light model.** A vertex's colour is `(ambient × ambientColor + Σ level × strength × max(0, N·L) × (1 − d/range)² × lampColor) × contact`, clamped at 1.6 (the source's ceiling), multiplying the material's base colour (`vertexColors`). Occluded lamps add nothing (the sample is nudged 3 cm off its surface; a box whose `id` the mesh lists in `ignore` never shadows it). Static meshes use `FlatMaterial`, so only this light reaches them (no View3D lights).
4. **Baking and rebaking.** `SceneLight.bake(mesh)` reads the mesh's own position, rotation and scale as its world placement (a static mesh sits on the view's root), swaps in a dynamic copy of its geometry with vertex colours (the source geometry is not destroyed; it may be shared) and turns `vertexColors` on. Each lamp's light per vertex is computed once at bake (lamps do not move); a level change recomputes the colours of the meshes that lamp reaches and no others, and uploads only when a colour changed. `rebakes` counts meshes recomputed.
5. **The sim seam for lamp changes.** `Pixi3dOptions.lamps` names a component whose entities switch lamps: `{ lamp: string, level: f32 }`. The renderer reads it from the render deltas (added and changed set the level; removed and resync return a lamp to its content `level`) and calls `setLevels`. No new sim API: a game spawns the entity and sets its `level` from a system, which is the "sim event".
6. **Characters.** `characterTint(position, normal, lighting, levels)` is ambient plus N·L of the lamps in range at the position (no normal: the light from every direction, the source's `lightAt`), with the same occlusion, as `[r, g, b]`. `box(size, { color, lit: true })` uses it per frame as `FlatMaterial.baseColor = color × tint` when the renderer has lighting (the per-character tint, M3R-D4), with no normal (a box is not a figure); the figure view (M3.5d) passes normals per part.
7. **Fog.** `Pixi3dOptions.fog` (spec §4.1), or else `lighting.fog`, sets `View3D.fog` to `{ type: 'linear', near, far, color }`. No fog when neither is set. No mist (S7 has not measured it).
8. **`scene` gets the light.** `scene(view, stage, light)`: the third argument is the `SceneLight` (undefined without `lighting`), so a game bakes its static scenery there; entity view factories get it as a fourth argument. Both are additive.

## Files

- **Create (packages/render-pixi3d/src/light/):** `scene-lighting.schema.ts` (+ `.test.ts`), `scene-lighting.content.ts` (+ `scene-lighting-content.test.ts`), `occlusion.ts` (+ test), `vertex-light.ts` (+ test), `vertex-bake.ts` (+ test), `scene-light.ts` (+ test, D3-e), `lamp-switches.ts` (+ test), `view-fog.ts` (+ test); `src/parity/lighting.parity.test.ts`; `examples/render3d/render3d-lighting-fog.ts`, `examples/e2e/render3d-lighting-fog.e2e.ts`.
- **Modify:** `src/renderer/create-pixi3d-renderer.ts` (`fog`, `lighting`, `lamps`, the `scene` and factory argument), `src/views/view-3d.ts` (factory's fourth argument), `src/views/box-view.ts` (+ test: `lit`), `src/render3d.extension.ts` (+ test: content), `src/index.ts`, `package.json` (`@mcthaydt/automata-content`, `zod`), API report, agent skill, cheatsheet.

## Interfaces

Consumed: `ContentSchemaDef` (type), `compileContent` (tests); `Geometry3D`, `Mesh3D`, `FlatMaterial`, `View3D.fog` (`@pixi/3d` main entry); `RenderDelta` (sim).

Produced (`@mcthaydt/automata-render-pixi3d`, private):

```ts
export const lampSchema, occluderBoxSchema, occluderPlaneSchema, sceneLightingSchema   // zod
export type Lamp, OccluderBox, OccluderPlane, SceneLighting, SceneFog
export const sceneLightingContent: ContentSchemaDef<'scene-lighting'>
export type LampLevels = Readonly<Record<string, number>>
export function vertexLight(sample: LightSample, lamp: Lamp, lighting: SceneLighting, ignore?: readonly string[]): number
export function characterTint(position: Vec3, normal: Vec3 | undefined, lighting: SceneLighting, levels?: LampLevels): [number, number, number]
export function contactShade(sample: LightSample, lighting: SceneLighting): number
export interface SceneLight {
  readonly lighting: SceneLighting
  bake(mesh: Mesh3D, options?: { readonly ignore?: readonly string[] }): void
  setLevels(levels: LampLevels): void
  level(id: string): number
  tint(x: number, y: number, z: number, normal?: Vec3): [number, number, number]
  readonly rebakes: number
}
export function createSceneLight(lighting: SceneLighting): SceneLight
export interface Pixi3dOptions { …; fog?: SceneFog; lighting?: SceneLighting; lamps?: string; scene?: (view, stage, light?) => … }
export function box(size, material: { color: number; lit?: boolean }): View3dFactory
```

## Steps

Each step starts with its failing test, run alone, with the failure reason recorded in the log.

- [ ] **1. Plan.** This file (first commit).
- [ ] **2. Content schema.** Red: `scene-lighting.schema.test.ts` (defaults; a negative range, an ambient above 1, a colour above 0xffffff and a duplicate lamp id refused with their paths) and `scene-lighting-content.test.ts` (a lighting TOML compiles under `sceneLightingContent`; a duplicate id and a bad range fail with `file:line:col` at the field). Green: schema, kind.
- [ ] **3. Occlusion.** Red: `occlusion.test.ts` (ported: open floor, floor against a wall, an inside corner, wall foot and corner against the wall's middle, the foot of a box; a segment through a box or across a plane is blocked, past its edge it is not). Green: `occlusion.ts`.
- [ ] **4. Vertex light and the character tint.** Red: `vertex-light.test.ts` (ported: distance, normal, out of range, solid occlusion, the bench does not shadow its seat when ignored; `characterTint`: ambient only out of range, brighter facing the lamp, scaled by level, blocked by a wall). Green.
- [ ] **5. Bake.** Red: `vertex-bake.test.ts` (ported: every vertex gets a colour, positions and UVs kept; level 0.3 against 1; a changed level equals a fresh bake; float and snorm16 normals; the world placement from position, rotation and scale; which lamps reach the mesh). Green: `vertex-bake.ts`.
- [ ] **6. SceneLight (D3-e).** Red: `scene-light.test.ts` (bake swaps in a dynamic coloured geometry and turns `vertexColors` on; unchanged levels upload nothing; D3-e: two lamps far apart, a mesh and a character position in each one's range, lamp A off darkens only A's mesh and A's tint, B's mesh is not rebaked and its colours and tint are unchanged; `rebakes` counts only A's meshes). Green.
- [ ] **7. Lamp switches and fog.** Red: `lamp-switches.test.ts` (added, changed, removed, resync; rows without the component ignored) and `view-fog.test.ts` (options win over content; none gives null). Green.
- [ ] **8. Renderer, box and extension.** Red: `box-view.test.ts` (`lit` with a light tints by the light at the pose; without a light it is the plain box), `render3d.extension.test.ts` (registers `scene-lighting`). Browser `lighting.parity.test.ts` (Chromium, WebKit; Firefox skips with no WebGL): fog changes the far pixels; a lamp entity switched off through `apply` darkens the pixels near it and leaves the far side's pixels unchanged (D3-e end to end). Green: the renderer wiring.
- [ ] **9. Example.** `examples/render3d/render3d-lighting-fog.ts` (`Tier: core`, ≤ 100 code lines): a room of baked static boxes and walls under two lamps and fog; the sim switches the warm lamp off and on; a walking lit box takes the tint. Catalog test passes; e2e `render3d-lighting-fog.e2e.ts` under the CSP in `examples` and `examples-webkit` (boots, no errors or CSP events, many colours).
- [ ] **10. Gates and hand-off.** `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `pnpm api-report --update` then `pnpm api-report`; `pnpm api-index` (`pnpm cheatsheet` if stale); `pnpm agent-skills --write` then `pnpm agent-skills`; changesets only for published packages touched (none expected); `pnpm --filter @mcthaydt/automata-render-pixi3d test:parity`; focused e2e; gitleaks over `origin/main..HEAD`; push.

## Gates

- Selected: as step 10.
- Not here: Firefox WebGL and WebGPU (the GPU runner, M3.1b), frame budgets (S7-Q9 per-character cost and the bake's cost, M3.1b and M3.10), the mist (dropped until S7 measures it).

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
