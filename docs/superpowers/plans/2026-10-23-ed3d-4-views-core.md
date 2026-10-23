# ED3D.4 Views core: TDD plan

- **Task:** ED3D.4. [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.3 (geometry owner), §5.2 (layers: a hidden layer is not drawn and not hit, a locked layer is drawn and not hit), §5.3 flows 2, 3 and 4 (the snap targets of a drag, the wall under the crosshair, Walk's start), ED3-n, §6 (what each view draws and selects), ED3D-D6, ED3D-D8 and ED3D-D11, §12 (projection, picking and snapping unit-tested with fixed numbers; the 3D renderer by its projected geometry). The renderer-free core of Plan, Dollhouse and Walk: the plan camera and grid, the plan scene (what to paint), picking and snapping on the plan, and the flat-shaded meshes with their cutaway, camera, projection and ray picking for the two 3D views.
- **Lane:** editor-3d. **Depends on:** ED3D.3 (PR #137: the level editor, `ViewState`, selection references), ED3D.1c (the geometry the views read) and EDK.3 (PR #133: `Viewport2D`). Branch `claude/project-thread-ljshus-ed3d-4` is stacked on #137's branch with the kit's EDK.3 branch merged in.
- **Status:** Drafted 2026-10-23, built on the coordinator's and the hub's instruction of 10:05 UTC to keep going on the next ED3D slice while the stack waits in the merge queue. Not reviewed; spec review (ED3D.0) is still open. Steps below are ticked only when their checks pass.
- **Progress:** 0 of 9 steps.

## Why this task exists

The app (ED3D.5) and the tools (ED3D.6) draw, touch and drag. Everything they decide from a pointer position or a camera is arithmetic over `geometry(doc)`: where a metre is on the screen, which wall is under a finger, where a dragged corner lands, which wall quad a ray hits. Written inside Svelte components that arithmetic could be tested only in a browser, and the Plan and the 3D views would each re-derive the geometry the spec says only the profile owns (§4.3). This task builds it once, as pure functions with fixed-number tests: the components then only paint what a scene says and forward what a pick says.

## Sources, read at these commits

- **The Last Light, `mcthaydt/PixiJS3D_Experiment_001` at `92e6704`:** `editor/src/client/plan.ts` (`gridLines`, `snap`, `snapStep`, `fitView`, `zoomAt`, the plan transform) and `editor/tests/client-plan.test.ts` (the cases for `snap`, `snapStep`, the transform and the grid, which come along with their expected numbers). Its transform is replaced by the kit's `Viewport2D`; its items, edits and literal handling are ED3D.3, ED3D.7 and the codec.
- **AF:** `geometry/sectors.ts` (`ResolvedMap`, `Edge`, `Sector`, `Piece`, `insideSector`, `polygonArea`, `floorAt`), `checks/wall-locator.ts` and `checks/check.ts` (selection ids), `model/selection-ref.ts`, `model/view-store.ts` (`ViewState`: camera, grid, hidden, locked), `profile/level-profile.ts` (`GeometryLayer`); the kit's `gestures/viewport-2d.ts` on EDK.3.

## Scope

**In:** the kit's `./core` entry gains `createViewport` and the viewport and gesture-event types (a change request in the same spirit as step 1 of ED3D.3); `src/view/plan/` and `src/view/mesh/` in `editor-3d`, plus `src/geometry/triangulate.ts`, all under the purity test.

**Out, with where each goes:**

| What | Where |
|---|---|
| Painting: the Pixi canvas, strokes, labels, loupe, nudge pad, any DOM | ED3D.5 (Plan, Split) and ED3D.6 (tools) |
| Things on the plan and in 3D (props, lamps, hotspots, nav graph, zones) and their picking | ED3D.7: they need the entity model. The scene and mesh take geometry layers only, as the spec's §4.3 says |
| Wall thickness, masonry masses, trim, handrails, textures and the material picker | ED3D.8. Meshes here are single-sided faces, flat-shaded by the sector's light |
| Walk movement (sticks, collision, minimap, Fly and Orbit modes) | ED3D.8. This task builds the walk camera, the eye placement and the picking it needs |
| World view | ED3D.9 |
| Selection highlight, hover, rulers, length labels | ED3D.5. Picks and snaps answer with the data they draw from |
| Marquee (rectangle) selection, long-press and gesture wiring | ED3D.6, over `attachGestures` |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **The plan transform is the kit's `Viewport2D`, driven by `ViewState.camera`.** `camera` is `{ x, z, zoom }`: the plan's centre in metres and a zoom where 1 is 32 px per metre. `planViewport(camera, size)` builds the `Viewport2D` (limits 4 to 400 px per metre, Last Light's) and `cameraOf(viewport)` reads it back, so a pinch the kit's viewport handles ends as a `view.set({ camera })`. A plan point `{ x, z }` is the viewport's `{ x, y: z }`: z runs down the screen, as in Last Light's plan.
2. **A scene is a draw list, not a drawing.** `planScene` answers fills (an outline and holes with the sector's zone or floor texture as its colour group, floor, ceiling and light) and walls (one segment per physical line, classified `solid`, `portal`, `door` or `window`, with the door's or window's span in metres), each with the selection id the app selects it by. Hidden layers are left out (`sectors`, `walls`); locked ones stay in (they are drawn, and only picking leaves them out).
3. **Selection ids come from one function, `selectionOf(profile, level)`.** `sector(id)` is `sector:<id>` for a sector the document lists, and nothing for a derived one (Last Light's opening connectors, which the plan draws and nothing selects); `edge(edge)` is the wall locator's answer (`wall:<sector>/<corner>`, or the sector for a wall that belongs to no corner). Plan scene, picking, snapping and the meshes all read it, so they name the same things.
4. **Picking answers the wall on the side that was touched.** A wall is hit when the pointer is within the pointer kind's radius of its segment (touch 22 px, so a 44 px target; pen 12; mouse 8); of two walls of one shared line (a portal and its reverse) the one whose inward side holds the pointer wins, which is the wall of the sector the finger is in; otherwise the nearest. A wall beats a sector; of nested sectors the smallest area wins. Corner picking (for the vertex tool) answers a sector and the corner index in the document, through the same locator.
5. **Snapping has an order and says what it snapped to.** Vertex, then wall line, then the rectilinear axis through the previous point, then the grid (when the view's snap is on), then the data step (ED3D-D11: 0.05 m; Shift 0.01 m; Alt none). The answer carries `kind` so the app can draw the target (the spec's Pencil hover preview) and a `target` selection id where there is one. Last Light's `snap` and `snapStep` keep their cases.
6. **3D positions are `[x, y, z]` with the document's axes:** x east, z south (the plan's down), y up from the floor heights. A mesh is a list of surfaces, each one flat polygon set with its role (`floor`, `ceiling`, `wall`, `lower`, `upper`, `door`), sector, selection id, normal and shade, so a renderer can merge them by material and a pick can name them. There is no renderer in this package (ED3D-D6 puts it in the app).
7. **The dollhouse's cutaway is back-face culling.** A surface is shown when the eye is on its front side. A wall whose inward side faces away from the eye is therefore cut away, ceilings vanish for an eye above them, and the same rule serves Walk from inside a room. The `hideFrom` and `cut` groups of Last Light are camera-zone concepts of the game and are not applied.
8. **One camera type for both 3D views.** `Camera3D` is an eye, a yaw, a pitch and a vertical field of view; the dollhouse's orbit (target, distance, yaw, default pitch 30° and 45° yaw) and the walk camera (eye height 1.6 m, field of view 69°, ED3D-D8) both produce one. Projection and the ray through a pixel are written once over it.

## Contract

```
packages/editor-kit/src/core/index.ts          gains createViewport, Viewport2D, ViewportInit, ViewportLimits, Point, Size, Rect and the gesture event and pointer types
packages/editor-3d/src/view/selection-of.ts    SelectionOf, selectionOf
packages/editor-3d/src/view/plan/plan-viewport.ts   PLAN_PX_PER_M, PLAN_LIMITS, planViewport, cameraOf, toScreen, toWorld, levelBounds, fitPlan, gridStep, gridLines, snapStep, snapValue
packages/editor-3d/src/view/plan/plan-scene.ts      PlanScene, PlanFill, PlanWall, WallKind, planScene
packages/editor-3d/src/view/plan/plan-pick.ts       PICK_RADIUS, PlanHit, CornerHit, pickPlan, pickCorner
packages/editor-3d/src/view/plan/plan-snap.ts       SnapOptions, SnapResult, snapPlan
packages/editor-3d/src/geometry/triangulate.ts      triangulate
packages/editor-3d/src/view/mesh/sector-mesh.ts     Vec3, Surface, SurfaceRole, SectorMesh, buildSectorMesh, faceShade
packages/editor-3d/src/view/mesh/camera-3d.ts       Camera3D, Ray, forward, projectPoint, rayThrough, orbitCamera, fitOrbit, orbitBy, walkCamera, walkStart
packages/editor-3d/src/view/mesh/mesh-pick.ts       facesEye, visibleSurfaces, pickMesh
packages/editor-3d/src/index.ts                     the public entry gains the view core
```

```ts
export interface SelectionOf { sector(id: string): string | undefined; edge(edge: Edge): string | undefined }
export function selectionOf<D>(profile: LevelProfile<D>, level: D): SelectionOf

export const PLAN_PX_PER_M = 32
export function planViewport(camera: ViewState['camera'], size: Size): Viewport2D
export function cameraOf(viewport: Viewport2D): ViewState['camera']
export const toScreen = (viewport: Viewport2D, p: Point): ScreenPoint            // Point is { x, z }
export const toWorld = (viewport: Viewport2D, p: ScreenPoint): Point
export function levelBounds(layers: readonly GeometryLayer[]): Rect                // { x, y: z, w, h }
export function fitPlan(bounds: Rect, size: Size, padding?: number): ViewState['camera']
export function gridLines(viewport: Viewport2D, base: number): { step: number; xs: GridLine[]; zs: GridLine[] }

export type WallKind = 'solid' | 'portal' | 'door' | 'window'
export interface PlanScene { fills: PlanFill[]; walls: PlanWall[]; bounds: Rect }
export function planScene(layers: readonly GeometryLayer[], select: SelectionOf, options?: { hidden?: readonly string[] }): PlanScene

export type PlanHit = { kind: 'wall'; selection: string; sector: string; at: Point; distance: number } | { kind: 'sector'; selection: string; sector: string }
export function pickPlan(layers, select, viewport, at: ScreenPoint, options: { radius: number; hidden?: readonly string[]; locked?: readonly string[] }): PlanHit | undefined
export function pickCorner(layers, select, viewport, at: ScreenPoint, options: { radius: number; hidden?: readonly string[]; locked?: readonly string[] }): CornerHit | undefined

export type SnapKind = 'vertex' | 'wall' | 'axis' | 'grid' | 'data' | 'free'
export interface SnapResult { x: number; z: number; kind: SnapKind; target?: string | undefined }
export function snapPlan(layers, select, viewport, at: ScreenPoint, options: SnapOptions): SnapResult

export function triangulate(outline: readonly Point[], holes?: readonly (readonly Point[])[]): { points: Point[]; triangles: [number, number, number][] }

export type Vec3 = readonly [number, number, number]
export interface Surface { role: SurfaceRole; sector: string; selection: string | undefined; normal: Vec3; shade: number; positions: number[]; indices: number[] }
export function buildSectorMesh(layers: readonly GeometryLayer[], select: SelectionOf): SectorMesh

export interface Camera3D { eye: Vec3; yaw: number; pitch: number; fov: number }
export function projectPoint(camera: Camera3D, size: Size, p: Vec3): { x: number; y: number; depth: number } | undefined
export function rayThrough(camera: Camera3D, size: Size, at: ScreenPoint): Ray
export function visibleSurfaces(mesh: SectorMesh, eye: Vec3): Surface[]
export function pickMesh(mesh: SectorMesh, eye: Vec3, ray: Ray): MeshHit | undefined
```

## Steps (strict TDD: failing test first, then the minimal change; tick a step when its checks pass)

- [ ] **1. Plan viewport, grid and snap values** (`plan-viewport.test.ts`, the kit's `core.test.ts`; `view/plan/plan-viewport.ts`, the kit's `src/core/index.ts`, `src/purity.test.ts` gains the `view` layer).
  - *Red, by case:* the kit's core entry exports `createViewport` besides what it had; `planViewport({ x: 0, z: 0, zoom: 1 }, { w: 600, h: 400 })` puts the origin at the centre and a metre at 32 px, z downward; `cameraOf(planViewport(c, size))` gives `c` back for centres and zooms (round trip, to the float); a zoom outside 4 to 400 px per metre is clamped; `toScreen` and `toWorld` are inverse; `levelBounds` covers every outline and hole of every sectors layer, and for no sector is the 10 m box around the origin that Last Light uses; `fitPlan` centres the bounds in the viewport inside the padding (Last Light's case: `-5..5` by `-7..7` in 600 by 400 with 20 px padding puts the centre at the middle and the 14 m height inside 360 px); `gridStep(0.25, 64)` is 0.25 and `gridStep(0.25, 32)` is 0.5 (ED3D-D11: 0.5 m zoomed out), doubling until a step is at least 16 px; `gridLines` lists the lines in view with every fourth marked major and none outside it; `snapStep()` is 0.05, with Shift 0.01, with Alt 0; `snapValue` keeps Last Light's cases (`1.4737` to `1.45` at 0.05, `0.3 * 3` to `0.9`, step 0 keeps four decimals, never `-0`); `src/view` is a purity layer.
  - *Expected failure:* the kit entry lacks `createViewport`, the module is missing, and the purity test refuses an empty layer.
- [ ] **2. Selection ids and the plan scene** (`selection-of.test.ts`, `plan-scene.test.ts`; `view/selection-of.ts`, `view/plan/plan-scene.ts`).
  - *Red, by case:* on the depot, `selectionOf(...).sector('hall')` is `sector:hall` and `sector('nowhere')` nothing, and `edge` of the hall's second wall is `wall:hall/1`; on `clinic-dawn`, an opening's connector sector has no selection and its walls name the sector or nothing; `planScene` on the depot gives one fill per sector with its outline and no holes, the zone `''` and the floor texture as the group, and one wall per physical line (the portal pair on x = 8 once), `portal` for the hall's wall into the dock and `solid` for the rest; a wall with a door is `door` with the span `at ± width / 2` clipped to the wall, and a window is `window`; a portal that carries a door is a `portal` (the door of a portal wall is a frame); the hole of a sector is a hole of its fill and its walls are walls; `hidden: ['walls']` leaves `walls` empty and keeps the fills, `hidden: ['sectors']` the reverse; the bounds are `levelBounds`; the scene reads only `geometry` (the same layers give the same scene: plain data, equal by value).
  - *Expected failure:* the modules are missing.
- [ ] **3. Plan picking** (`plan-pick.test.ts`; `view/plan/plan-pick.ts`).
  - *Red, by case:* a point 10 px from a wall is a hit for touch (22) and a miss for mouse (8); the nearest of two walls wins; on a portal line the pointer on the hall's side gets `wall:hall/1` and on the dock's side `wall:dock/3`, at the same pixel distance; a wall beats the sector under it; a point inside a sector far from every wall is that sector, a point in a hole is the sector that fills the hole, outside everything nothing; of nested sectors the smaller; `hidden: ['walls']` and `locked: ['walls']` both leave out walls, `hidden` or `locked` of `sectors` leave out sector fills (a hit on a wall is still a hit); a derived connector sector and a wall with no selection are never answered; the answer's `at` is the closest point on the wall in metres and `distance` is in pixels; at a different zoom the same metre distance is a different hit (the radius is in pixels); `pickCorner` answers `{ sector, corner, at }` for a point near a corner in the document's index (the second corner of the hall is 1), the corner shared by a portal pair answers the sector under the pointer, the middle of a wall and a pilaster's notch corner answer nothing, and hidden or locked `walls` leave corners out.
  - *Expected failure:* the module is missing.
- [ ] **4. Plan snapping** (`plan-snap.test.ts`; `view/plan/plan-snap.ts`).
  - *Red, by case:* a point within the radius of a corner snaps to it exactly (`kind: 'vertex'`, `target` the wall selection) and the nearest corner wins over a wall line that is closer by a hair; a point near a wall but not a corner snaps onto the line (`'wall'`); with a previous point `from`, a point within the radius of the horizontal or vertical through it locks that axis and snaps the other coordinate to the grid (`'axis'`); with the view's grid snap on a free point goes to the grid (`'grid'`, 0.5 for the default step) and with it off to 0.05 (`'data'`); Shift gives 0.01; Alt gives the point itself rounded to four decimals (`'free'`) and no vertex or wall either; the priority holds when several apply (vertex over wall over axis over grid); hidden or locked `walls` leave vertex and wall targets out; results are rounded to four decimals and never `-0`; the radius is in pixels, so zooming in snaps to fewer metres.
  - *Expected failure:* the module is missing.
- [ ] **5. Triangulation** (`triangulate.test.ts`; `geometry/triangulate.ts`).
  - *Red, by case:* a rectangle gives two triangles; a concave L gives four with the area of the L; a rectangle with a rectangular hole has total triangle area outer minus hole, uses every outline and hole point and no triangle covers the hole; a hole touching nothing, two holes, a hole in the concave part; every triangle has the winding of the outline (the loops are normalised: outer counter-clockwise, holes clockwise); a collinear run of points along an edge is kept; fewer than three points gives nothing; the depot's and `clinic-dawn`'s sectors triangulate with the area `polygonArea` says, minus their holes.
  - *Expected failure:* the module is missing.
- [ ] **6. Sector meshes** (`sector-mesh.test.ts`; `view/mesh/sector-mesh.ts`).
  - *Red, by case:* the depot's hall gives a floor at y = 0 facing up, a ceiling at y = 4 facing down, and four walls of corner to corner and floor to ceiling facing into the room; the dock (floor -0.5) joined to the hall by a portal leaves the strip between the two floors (`lower`, 0 to -0.5 is in the dock: the hall's wall of the portal gives nothing where the dock is lower, and the dock's wall gives the step up to the hall's floor); a portal with a lower neighbour ceiling gives an `upper` strip; a wall with a door has the side strips, the header over the door's height and the closed door panel as a `door` surface; a window has the strips round it, with no pane; every surface holds the sector, its selection id (a derived sector's walls and floor: none), a unit normal, and a shade from the light (`faceShade`: full light on an up face is lighter than on a wall; light 0.5 is darker than 1; never above 1); the positions are `[x, y, z]` with z the plan's z; the indices address the positions; total floor area equals the sectors' areas; the mesh is plain data, equal by value for equal layers.
  - *Expected failure:* the module is missing.
- [ ] **7. The 3D camera** (`camera-3d.test.ts`; `view/mesh/camera-3d.ts`).
  - *Red, by case:* an eye at `(0, 0, 10)` with yaw 0 and pitch 0 looks toward -z (north) and projects the origin to the centre of the screen and a point to the right of it to the right; a point behind the eye is `undefined`; a point at the vertical field edge lands on the screen edge for a 53.13° field (24 mm) and 69° (walk); `rayThrough` is the inverse of `projectPoint` (a pixel's ray passes through the point that projects to it); the ray through the screen centre is the forward vector; `orbitCamera` puts the eye on the sphere of the distance round the target, pitch 30° above it by default and yaw 45°, looking at the target (the target projects to the centre); `orbitBy` changes yaw freely and clamps pitch to 5° to 85°; `fitOrbit` of a box sets a distance at which all eight corners project inside the screen; `walkCamera` puts the eye 1.6 m above the floor; `walkStart` on a spawn uses it and its facing, and on none uses the middle of the first sector with a warning, and a level with no sector gives the origin with a warning.
  - *Expected failure:* the module is missing.
- [ ] **8. Cutaway and 3D picking** (`mesh-pick.test.ts`; `view/mesh/mesh-pick.ts`).
  - *Red, by case:* from above and to the south-east of the depot, the hall's south and east walls (inward side facing away) are cut and the north and west walls and the floor show, and the ceiling does not; from inside the hall at eye height every wall and the floor and ceiling show; `visibleSurfaces` keeps mesh order; a ray from the walk camera through a wall's middle hits that wall's selection id at the right distance and point; a ray through a door panel hits the door; through a window hole it hits what is behind; a ray at the floor hits `sector:<id>`; a ray at a cut-away wall passes through it to what is behind; a hit on a derived sector's surface is a hit with no selection (it occludes); a ray into the sky is nothing; the nearest of two surfaces wins; hits from the dollhouse and from Walk agree for the same ray.
  - *Expected failure:* the module is missing.
- [ ] **9. Gates and records.**
  - *Run in order:* `pnpm format`, `pnpm docs:stack` (commit if it changes), `pnpm check`, and the CI steps `pnpm check` skips (`pnpm build`, `pnpm api-index`, `pnpm agent-skills`, `pnpm api-report`: the kit's report gains the `./core` additions); hand mutation over each step's logic, listed on its step; `index.ts` exports the view core (names asserted in `index.test.ts`; test helpers stay out).
  - *Records:* master plan (02), continuation prompt (03) and the spec's task table in the docs follow-up PR once the stack merges; nothing ticked in 02 from this PR.

## Verification

Local, Node 24: the package's tests, the kit's unit project for `./core`, and `pnpm check`. The package has no browser or GPU suite, so parity, e2e and visual runs are not selected; no sim code is touched. Picking radii, snap order and the cutaway are judged on the built editor (ED3D.12) and the Owner's iPad pass.

**Owner acceptance:** none of its own. The view half of ED3-c (the snap onto the ward's wall line), ED3-f (the wall under the crosshair in Walk) and ED3-n (no spawn: the first sector's centre) are judged on the built editor (ED3D.12) and the iPad pass.

## Risks and how the plan answers them

- **The kit's `./core` is the 2D lane's package too.** The addition is export lines plus a new report section; a conflict in the generated report is cleared by regenerating it.
- **Triangulation with holes is the one algorithm here that can be subtly wrong.** The tests check area, vertex use and winding on convex, concave, holed and shipped sectors, and the mutation pass runs over it.
- **A 3D face that is the wrong way round shows as a missing wall.** The cutaway test names which walls show from a fixed eye, and the normals are tested against the sector's inward side.
- **Stack depth.** This branch sits on #137 (on #129, which is retargeting to `main` after #127 merged) and carries EDK.3; each merges bottom-up. If a lower PR gets a merge from `main`, `main` is merged into this branch (no rebase).
