# c7 Fashion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (no
> subagents in this project). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A painted figure in an AF scene is FigureBuilder's own render (D2, 18°, crisp) with per-texel depth, the
character kit carries the runway wardrobe and cast, and a runway example shows it.

**Architecture:** The kit's door (now `src/shared/figure-builder/`) exposes FB's stage contract. A pure `place.ts`
applies the contract's placement rule to one sim entity; a per-camera `painted-stage.ts` sorts the figures and shows each
on FB's own depth-writing `CellSprite` inside AF's `View3D`, so figures and AF's meshes share one depth buffer. A new
`fashion` feature registers the wardrobe through FB's hooks. Nothing in `packages/3d` changes by design.

**Tech Stack:** TypeScript, PixiJS 8.22 with `@pixi/3d` 0.1.0-beta.2 (private beta), FigureBuilder (git submodule,
`STAGE_VERSION` 1), Vitest 5 (Node and browser projects), Playwright 1.63 journeys.

**Spec:** [`2026-11-11-c7-fashion-spec.md`](2026-11-11-c7-fashion-spec.md). FB's contract:
`vendor/FigureBuilder/docs/contract.md`.

## Global Constraints

- Density 2; pitch `SPRITE_PITCH` (18°) whatever the camera's tilt; crisp: `scale = max(1, round(zoom / density))`,
  the top-left rounded to whole pixels. Never minified, never a lower density to save time.
- FB is reached only through `extensions/character-kit/src/shared/figure-builder/door.ts` (FB's `index` and `kit`) and
  `door-view.ts` (FB's `view`). Never patch `vendor/FigureBuilder`; never deep-import; never copy FB code.
- No file under `packages/3d` is edited. If Task 3's Step 5 proves it must be, stop and tell the coordinator
  (`session_01HNdX7KS1hMXgJFNLYmWYFq`) which of the two files in the spec's section 9, and wait.
- The sim owns positions and the show's clock. The painter is presentation.
- A feature imports only itself and `shared/`; tests import `#src/…`; one suffix `.test.ts`; files at most 600 lines;
  kebab-case; comments say why.
- Failing test first, seen failing for the right reason. Injected clocks (`now`), fixed seeds, no sleeps.
- No golden or hash is re-recorded to pass. The kit's existing goldens (`tests/fixtures/goldens`) must not move.
- Every package touched is private: no changeset. `@pixi/3d` is never published or deployed.
- Before each commit: `pnpm format`, then `pnpm --filter @automata/character-kit typecheck` and `test:unit`.
- Before each push: the affected browser suites and journeys locally, in Chromium and WebKit (commands in each task).
  Journeys get 120 s a test; servers 180 s; a tap sends down and up in one task.
- Conventional Commits. Update `docs/refactor/progress.md` and this plan's log (bottom) in the same session as the work.

## Review Focus

1. **A camera that moves this frame.** The figure is placed by the camera as it is drawn, not last frame's. Task 3.
2. **A figure behind the camera, or at the frame's edge.** Hidden (perspective, `d < 0.1`) or clipped; nothing throws,
   no NaN in the quad. Task 2.
3. **A renderer that is not WebGL.** One warning in words, figures still drawn, flat depth. Task 3.
4. **`registerFashion()` twice, or two games in one page.** No "registered already" throw. Task 6.
5. **An entity removed mid-show, or hidden.** Its `CellSprite` leaves the stage (or is not drawn while the entity's
   node is hidden) and the ranks of the rest close up; no leaked texture. Task 3.
6. **An unknown `pose` or `outfit` name in `state`.** An error in words naming the name and the character, at the first
   frame, not a silent standing figure. Task 3.

## File Structure

```
extensions/character-kit/
  src/shared/figure-builder/door.ts         FB index + kit (no Pixi)                      moved from features/painted
  src/shared/figure-builder/door-view.ts    FB view: CellSprite                           new
  src/features/painted/pose.ts              Camera3D → CameraPose                         new (replaces camera.ts)
  src/features/painted/place.ts             the placement rule for one figure, pure       new
  src/features/painted/painted-stage.ts     per-camera: sort, rank, CellSprite, depths    new (replaces figure-sprite.ts)
  src/features/painted/state.ts             a PaintedState's names checked, pure          new
  src/features/painted/painted-view.ts      paintedFigure                                 rewritten
  src/features/fashion/{fabrics,swatches,hair,shells,garments,cast,register-fashion}.ts   new
  tests/unit/shared/door.test.ts            moved from tests/unit/painted
  tests/unit/shared/contract.test.ts        STAGE_VERSION, SPRITE_PITCH, TIE_BIAS                 new
  tests/unit/painted/{pose,place,state}.test.ts   new (camera.test.ts deleted)
  tests/unit/fashion/{register,fit,cast}.test.ts                                          new
  tests/browser/painted/{painted-view,painted-depth,painted-scale}.test.ts                rewritten, new, new
  scripts/gate.ts                           the gates' renders and measurements           new
examples/3d/characterkit/characterkit-painted.ts      640 × 360
examples/3d/characterkit/characterkit-runway.ts       new
examples/3d/tests/e2e/characterkit-runway.test.ts     new
examples/3d/tests/e2e/colours.ts                      coloursPerThird, from the hair and painted journeys
vendor/figure-builder/package.json                    pixi.js, @pixi/3d, if Task 1 Step 1 needs them
.github/workflows/3d.yml                              the vendor paths in pull_request
docs/refactor/c7/                                     the gates' artifacts
```

---

### Task 0: FigureBuilder main already carries U1 and U2

FB #27 merged them: FB main `d6e3c9f` exports `TIE_BIAS` from `src/index` (U1) and `GROUP`, `weights`, `qmul`,
`smooth`, `Limb`, `Ring` from `src/kit` (U2). There is no upstream PR to wait for. Task 1 bumps the submodule to
`d6e3c9f` or a later FB main commit the coordinator names, and every task can start.

### Task 1: Bump the submodule and move the door

**Files:**

- Modify: `vendor/FigureBuilder` (the gitlink, to `d6e3c9f` or later), `pnpm-lock.yaml` if it moves,
  `vendor/figure-builder/package.json` if Step 1 shows the view entry's Pixi imports do not resolve,
  `.github/workflows/3d.yml` (its `pull_request` paths gain `vendor/FigureBuilder` and `vendor/figure-builder/**`, so a
  bump alone runs the 3D suites)
- Move: `src/features/painted/door.ts` → `src/shared/figure-builder/door.ts`; create `door-view.ts` beside it
- Move: `tests/unit/painted/door.test.ts` → `tests/unit/shared/door.test.ts`
- Create: `tests/unit/shared/contract.test.ts`
- Modify: every importer of the old door path (`painted/*.ts`, `entries/index.ts`, `tests/browser/painted/*`)

**Interfaces:**

- Produces, from `door.ts`: everything it exports today, plus `SPRITE_PITCH`, `STAGE_VERSION`, `TIE_BIAS`, `cellOf`,
  `project`, `viewOf`, `zoomOf`, `texelDepths`, `stageFrame`, `compose`, `ScriptedActor`, `POSES`, `GAITS`, `SWATCHES`,
  `HAIR_STYLES`, `registerGarment`, `registerOutfitHooks`, `registerHairPiece`, `registerFinish`, `registerFabric`, and
  the types `Cell`, `CameraPose`, `StageSprite`, `StageFrame`, `Backdrop`, `Garment`, `GarmentKind`, `Wearing`, `Fit`,
  `Fabric`, `HairStyle`, `HairFinish`, `Material`, `Part`, `Side`, `Body`. From FB's `kit` (U2, on main): `limb`,
  `superquadric`, `GROUP`, `weights`, `axisAngle`, `lerp`, `qmul`, `smooth`, `J`, types `Limb`, `Ring`, `V3`.
- Produces, from `door-view.ts`: `CellSprite`.

- [x] **Step 1:** Bump: `git -C vendor/FigureBuilder fetch origin && git -C vendor/FigureBuilder checkout d6e3c9f`
      (or the later FB main commit the coordinator names), `pnpm install`, `pnpm --filter figure-builder typecheck`.
      Expected: declarations build. FB's view entry imports `pixi.js` and `@pixi/3d`, and the wrapper package
      (`vendor/figure-builder`) declares only `typescript` and reaches FB's sources through a symlink into
      `vendor/FigureBuilder`, where there is no `node_modules`. So prove both resolutions before going on: the
      declarations of `src/view` build, and a throwaway browser test in the kit that imports `figure-builder/view` loads.
      If either fails, add `pixi.js` (8.22.0) and `@pixi/3d` (the same `vendor/pixi-3d` tarball) to the wrapper as
      `peerDependencies` and `devDependencies`, and re-run. The wrapper's `./*` export maps `figure-builder/view` to
      `src/view.ts`: if FB's view entry is elsewhere, stop and tell the coordinator.
- [x] **Step 1b: Check the plan's FB names against FB main** (this audit could not read FB: see the audit). With the
      submodule at the bumped commit, confirm each and note any mismatch in this plan's log before writing code:
      `docs/contract.md` (`STAGE_VERSION` 1, the placement rule of the spec's 5.2, the tie rule); `src/index` exports
      `SPRITE_PITCH`, `TIE_BIAS` (0.001), `cellOf`, `project`, `viewOf`, `zoomOf` (taken at the figure's ground point,
      in pixels a D1 texel), `texelDepths`, `stageFrame`, `compose`, `ScriptedActor`, `POSES`, `GAITS`, `SWATCHES`,
      `HAIR_STYLES` and the five `register*` hooks, and that it pulls in no Pixi; `src/kit` exports U2's six names;
      `CellSprite`'s constructor with depth, `show(cell)`, `showDepths(depths, perspective, p10, p14, bias)`, what
      `checkCentred` requires of the quad's anchor, and that its depth bit is WebGL only; `registerGarment` throws on a
      second registration; the showcase branches at `cb4aa9f` and `8fb0242` hold the files of the spec's 5.4, with
      7 fabrics, 9 garment kinds and the casts named there. A mismatch that changes an interface here: stop and tell
      the coordinator.
- [x] **Step 2:** Run the kit's suites on the bump alone, before any edit: `pnpm --filter @automata/character-kit
      test:unit` and `test:browser`. Expected: pass; the 16 texel-for-texel views still equal. A failure here is FB's
      change to investigate, not to re-record.
- [x] **Step 3: Failing tests.** `door.test.ts` (moved): the only files importing `figure-builder` are
      `src/shared/figure-builder/door.ts` (specifiers `figure-builder`, `figure-builder/kit` only) and `door-view.ts`
      (`figure-builder/view` only). `contract.test.ts`:

```ts
import { SPRITE_PITCH, STAGE_VERSION, TIE_BIAS } from '#src/shared/figure-builder/door.ts'
it('is the stage contract this kit was written for', () => {
  expect(STAGE_VERSION).toBe(1)
  expect(SPRITE_PITCH).toBeCloseTo((18 * Math.PI) / 180, 12)
  expect(TIE_BIAS).toBe(0.001)
})
```

- [x] **Step 4:** Run; expect FAIL (no such module). Move the door, add the exports, fix importers. Run; expect PASS.
- [x] **Step 5:** Add the two `vendor/` paths to `.github/workflows/3d.yml`'s `pull_request` paths. Then
      `pnpm boundaries && pnpm style && pnpm knip` (an export nothing uses yet is added in the task that uses it, if
      knip objects). Commit: `refactor(character-kit): the door to FigureBuilder moves to shared and takes the stage contract`.

### Task 2: The pose and the placement rule

**Files:**

- Create: `src/features/painted/pose.ts`, `src/features/painted/place.ts`
- Test: `tests/unit/painted/pose.test.ts`, `tests/unit/painted/place.test.ts`

**Interfaces:**

- Produces:

```ts
/** What `poseOf` reads of a Camera3D. */
export interface CameraLike {
  readonly position: { x: number; y: number; z: number }
  readonly quaternion: { x: number; y: number; z: number; w: number }
  readonly mode: 'perspective' | 'orthographic'
  readonly fov: number                // vertical, degrees
  readonly orthographicSize: number   // half the view's width, metres
  readonly zoom: number
}
export function poseOf(camera: CameraLike, size: readonly [number, number]): CameraPose

export interface Placed {
  readonly sprite: StageSprite                      // name, cell, at, screen, scale, depth: FB's own shape
  readonly position: readonly [number, number, number]   // the quad's place in the scene
  readonly pixelSize: number                        // metres a texel on the quad
}
/** The view a figure at `at` is painted from: the pose's bearing, the painter's pitch. */
export function paintView(pose: CameraPose, at: V3): View
/** The contract's placement for one figure, or undefined when it is behind a perspective camera (d < 0.1). */
export function place(pose: CameraPose, at: V3, cell: Cell, name: string): Placed | undefined
/** Far to near, ties in the order given: the frame's order, whose index is the rank. */
export function ranked(placed: readonly Placed[]): Placed[]
```

- [x] **Step 1: Failing tests, `pose.test.ts`.** A camera at `[0, 3, 5]` looking at the origin gives `fwd` along
      `normalize([0, −3, −5])`, `right` `[1, 0, 0]`, and `right × up = −fwd` to 1e-12; perspective `fov` 53.13° at
      640 × 360 gives `f` 360 ± 0.01 and no `pixelsPerMetre`; orthographic with `orthographicSize = 320 / 73.846…` gives
      `pixelsPerMetre` 73.846 ± 1e-9 and no `f`; `zoom` other than 1 is folded in as `@pixi/3d`'s
      `Camera3D.computeProjection` does (0.1.0-beta.2): a perspective camera divides `fov` by `zoom`, so
      `f = (h / 2) / tan(fov / zoom / 2)` (`zoom` 2 at 53.13° and 360 high gives 762.5, not 720); an orthographic camera
      multiplies `orthographicSize` by `zoom`, so `pixelsPerMetre = w / (2 · orthographicSize · zoom)`. A third case
      checks `poseOf` against the camera's own `computeProjection(w / h)` matrix: `P[5] · h / 2` is `f`, and
      `P[0] · w / 2` is `pixelsPerMetre`, to 1e-9.
- [x] **Step 2: Failing tests, `place.test.ts`.** The parity test, perspective and orthographic, for both `BASE`
      figures at three places (the centre, 2 m left and 4 m deeper, the frame's edge):

```ts
const actor = new ScriptedActor({ who: def, at: [x, z] /* a still placement */ })
const frame = stageFrame([actor], 0, pose)                    // FB's own rule: D2, crisp, SPRITE_PITCH
const figure = new Figure(member(def, 2))
figure.update(0, { facing: /* the actor's */, moving: false, view: paintView(pose, [x, 0, z]) })
const mine = place(pose, [x, 0, z], cellOf(figure), def.id)!
expect(mine.sprite.screen).toEqual(frame.sprites[0].screen)
expect(mine.sprite.scale).toBe(frame.sprites[0].scale)
expect(mine.sprite.depth).toBeCloseTo(frame.sprites[0].depth, 9)
expect(mine.sprite.cell.pitch).toBeCloseTo(SPRITE_PITCH, 12)
```

      Then: cameras tilted 25°, 40° and 60° give the same `cell.key`; at 480 × 270 under the example's follow camera (5 m to a focus 1 m above the
      feet, so the feet are 5.42 m deep), `zoomOf / 2` is about 0.67 and `scale` is 1 (the floor of 1); a figure 0.05 m in front of a perspective camera is `undefined`; no field of a `Placed` at the
      frame's edge is NaN; `ranked` puts the farther first and keeps the given order on a tie; `position` projected
      back through `project(pose, …)` lands the anchor texel on `screen + scale · anchor` to 1e-6.
      (The executor checks `ScriptedActor`'s real constructor in `vendor/FigureBuilder/docs/actors.md` and adapts the
      first line; the assertions stand.)
- [x] **Step 3:** Run both; expect FAIL (modules missing).
- [x] **Step 4: Implement.** `place` is the spec's 5.2 block, using the door's `project`, `zoomOf`, `viewOf`. The quad's
      place is `StageView.draw`'s: `eye + d·fwd + px·right − py·up` with `px, py = (screen + scale·anchor − size / 2) · k`,
      `k = d / f` or `1 / pixelsPerMetre`; `pixelSize = scale · k`.
- [x] **Step 5:** Run; expect PASS. Commit: `feat(character-kit): the stage contract's placement for one figure`.

### Task 3: The painted stage, with per-texel depth

**Files:**

- Create: `src/features/painted/painted-stage.ts`, `src/features/painted/state.ts` (pure: a `PaintedState`'s names
  checked against the character)
- Rewrite: `src/features/painted/painted-view.ts`
- Delete: `src/features/painted/figure-sprite.ts`, `src/features/painted/camera.ts`, `tests/unit/painted/camera.test.ts`
- Test: `tests/browser/painted/painted-view.test.ts` (rewritten), `tests/browser/painted/painted-depth.test.ts`,
  `tests/unit/painted/state.test.ts`

**Interfaces:**

- Consumes: `poseOf`, `paintView`, `place`, `ranked` (Task 2); `CellSprite` (`door-view.ts`); `texelDepths`, `TIE_BIAS`.
- Produces:

```ts
export interface PaintedState {
  readonly moving: boolean
  readonly pose?: string | undefined     // a name in FB's POSES
  readonly outfit?: string | undefined   // one of the character's outfits
}
export interface PaintedFigureOptions {
  readonly density?: 1 | 2 | 4 | undefined
  readonly state?: ((components: Components) => PaintedState) | undefined
  readonly now?: (() => number) | undefined
}
export function paintedFigure(def: CharacterDef, options?: PaintedFigureOptions): View3dFactory

// painted-stage.ts
export interface StageMember {
  /** Paints for this frame's `view` and returns the cell and where the figure stands. */
  frame(view: (at: V3) => View): { cell: Cell; at: V3; name: string }
}
export interface PaintedStage {
  add(member: StageMember): { readonly node: Container3D; remove(): void }
  /** For tests: what was placed this frame, in rank order. */
  readonly placed: readonly Placed[]
}
export function stageFor(camera: Camera3D): PaintedStage   // one per camera, kept in a WeakMap
export const NOT_WEBGL: string   // the warning's words
```

- [x] **Step 1: Failing unit test, `state.test.ts`** (Node). `paintedFigure` needs Pixi and a render, so the name
      check is a pure function in `state.ts`, `checkState(def, state)`: an unknown `pose` throws
      `/No pose called "nope"/` with the character's id; an unknown `outfit` throws `/has no outfit called/` likewise;
      known names pass. `paintedFigure` calls it in the entity's update path (AF's draw hook, where the renderer's
      errors already surface), never inside the render callback, where a throw would stop Pixi's ticker; the browser
      test of Step 2 (case 8) holds that a bad name reaches the page as that error at the first frame.
- [x] **Step 2: Failing browser tests, `painted-depth.test.ts`** (uses `createPixi3dRenderer`, `builtRenderer`,
      `snapshot`, `testTarget` from `@automata/3d/testing-checks`, as `painted-view.test.ts` does today; a fixed `now`).
      Each case builds the same frame on the CPU with FB's `compose(frame, backdrop)` from `stage.placed` and compares
      the renderer's readback, figure pixels only:
  1. one figure, orthographic at 18° and 73.846 px a metre: every pixel equal;
  2. one figure, perspective 640 × 360 at 5 m: every pixel equal, and the figure's height in pixels is `scale ×` its
     cell's painted rows;
  3. two figures overlapping, the nearer in front, then swapped by distance: equal; an exact tie in depth goes to the
     later-made;
  4. a figure with an AF box (`occluders.box`) cutting it at the knees, the backdrop being that box's front face: equal
     except pixels within one pixel of the cut line;
  5. **this frame's camera**: move the camera 1 m sideways, render once, the readback equals `compose` for the new
     pose (Review Focus 1);
  6. remove the first of three figures: two sprites drawn, ranks 0 and 1, and the removed one's texture is destroyed
     (Review Focus 5);
  7. under `preference: 'webgpu'` where the browser grants it, `console.warn` is called once with `NOT_WEBGL` and the
     figures are drawn; skipped with its reason where WebGPU is refused (Review Focus 3);
  8. a `state` naming an unknown pose: the renderer's first frame reports the error in words (Review Focus 6);
  9. the entity's own node hidden (`visible = false`) or its row removed: its `CellSprite` is not drawn (the quad lives
     under the stage's node, not the entity's, so it follows the entity's node's `worldVisible` and leaves with it).

      Every browser case skips with its reason where the engine has no WebGL 2 (`hasWebGL2`, as `painted-view.test.ts`
      does): the kit's `browser` project runs Chromium, WebKit and Firefox together, and headless Firefox here has none.
- [x] **Step 3:** Rewrite `painted-view.test.ts`: both base figures, 8 directions, through the renderer under the
      orthographic camera at 18°, are FB's `standing` cell at `SPRITE_PITCH` texel for texel (16 of 16), as before but
      at the fixed pitch.
- [x] **Step 4:** Run `pnpm --filter @automata/character-kit test:browser`; expect FAIL (no `painted-stage`).
- [x] **Step 5: Implement.** `stageFor(camera)` keeps one stage per camera. Its node is a `Container3D` at the scene's
      root, attached on a member's first update (a factory's node has no parent yet when the factory runs; from then on
      `node.view3d` is the `View3D`). Each frame it runs once, in `View3D.onRender`, which `@pixi/3d` 0.1.0-beta.2 runs at
      the start of every render, after AF's draw hooks (so after the camera driver has moved the camera). `Container3D`
      has no `onRender` of its own. `onRender` is one slot: the stage keeps any callback already there, calls it first,
      and puts it back when its last member leaves. Case 5 proves the order; if it fails, stop (Global Constraints) and
      report. Then per frame: `pose = poseOf(camera, [w,
      h])`; each member's `frame(at => paintView(pose, at))`; `place`; `ranked`; per rank `i`: `quad.show(cell)`,
      `quad.showDepths(texelDepths(pose, sprite), pose.f !== undefined, P[10], P[14], (i + 1) * TIE_BIAS)` with
      `P = camera.computeProjection(w / h, kept).elements` (one `Matrix4` kept by the stage, not one a frame); set the quad's position, `pixelSize`, and its
      quaternion to the camera's. The renderer's type is read once; not WebGL warns once with `NOT_WEBGL`.
      `paintedFigure` keeps `placeView3d` for the entity's place and yaw (an entity's yaw 0 faces −z, a figure's facing 0
      faces +z: half a turn), owns its `Figure`, and is a `StageMember`.
- [ ] **Step 6 (Chromium and WebKit passed; headless Firefox not run, so left open):** Run unit and browser (`pnpm --filter @automata/character-kit test:browser`: one project, Chromium,
      WebKit and Firefox). Expected: PASS in Chromium and WebKit; every case skips with its reason in headless Firefox;
      case 7 may skip with its reason.
- [x] **Step 7:** `pnpm boundaries && pnpm style && pnpm knip`. Commit:
      `feat(character-kit): painted figures at the painter's pitch, crisp, with per-texel depth`.

### Task 4: `characterkit-painted` at 1:1 (720 × 405, by the coordinator's ruling; the steps below say 640 × 360 where they were written)

**Files:**

- Modify: `examples/3d/characterkit/characterkit-painted.ts`, `examples/3d/tests/e2e/characterkit-painted.test.ts`,
  `examples/3d/README.md` (the row's words, if they name the size)
- Test: `extensions/character-kit/tests/browser/painted/painted-scale.test.ts` (each case skips with its reason without
  WebGL 2)

- [x] **Step 1: Failing browser test.** The example's own numbers (640 × 360, `fovOf(24)`, the follow view 5 m to a
      focus 1 m above the walker's feet, 25° down, under reduced motion so klipp's damping is zero and the camera sits
      on its target): for the walker at each corner of its 2 m square, `place(...).sprite.scale` is exactly 1 and
      `zoomOf(pose, at) / 2` is between 0.85 and 1.0 (about 0.90: the feet are 5.42 m deep); for the stander, whom the
      camera does not follow, `scale` is 1 at every point of the walker's lap. At 480 × 270 the walker's `zoomOf / 2`
      is under 0.7 (about 0.67): the test asserts that 640 × 360 is nearer 1 than 480 × 270 and documents both numbers,
      the reason for the size. The numbers come from `zoomOf` through the door, never typed.
- [x] **Step 2:** Run; expect FAIL on the "nearer 1" line until the size is passed as 640 × 360.
- [x] **Step 3:** `size: { width: 640, height: 360 }` in the example; add a box wall the walker passes behind on one side
      of its square, so depth is seen. The header comment says what the example now shows (the fixed pitch, crisp, depth).
- [x] **Step 4:** The journey keeps its checks (it already asserts `data-renderer="webgl"`); add: no page error after
      12 s of play, by which the walker has passed behind the wall. Run
      `pnpm --filter @af-examples/examples-3d test:e2e -- characterkit-painted` (both projects). Expected: 2 passed.
- [x] **Step 5:** Commit: `feat(examples): characterkit-painted at 640 × 360, one pixel a texel, behind a wall`.

### Task 5: Gate 1 (the coordinator's checkpoint)

**Files:**

- Create: `extensions/character-kit/scripts/gate.ts`, `docs/refactor/c7/gate-1/*`

- [x] **Step 1:** `gate.ts` (Playwright, Chromium, the built examples): renders `characterkit-painted` at a fixed tick
      from the branch's base and from this branch; writes each as a PNG at ×4 nearest; measures texels a pixel from the
      readback (the stander's height in pixels against its cell's painted rows) and writes `measurements.json`; writes
      FB's own `standing` cell of the same figure and direction beside them; writes the depth sheet (Task 3's cases 3
      and 4 as images). Numbers come from the script, never typed. The same tick is not the same frame by itself: the
      painter's walk clock is the page's clock and the follow camera eases (klipp's damping). So the script installs
      Playwright's fake clock (`page.clock.install` at a fixed time, then `runFor` to the tick) and emulates
      `reducedMotion: 'reduce'` (which zeroes the camera's damping), on both sides. The base is a commit, not a branch (the branch goes when #577
      merges): `a66b4e0e`, the head of `claude/figurebuilder-submodule` this branch was cut from (measured at the plan
      audit with `git merge-base`), written into `measurements.json`; its `git worktree` needs `git submodule update --init` and `pnpm install` of its
      own, because the builder's declarations are built at install and git-ignored.
- [x] **Step 2:** Run it; look at every image; write `docs/refactor/c7/gate-1/README.md`: the three images side by
      side, the measured numbers, what changed and why, and the WebKit run of Tasks 3 and 4.
- [x] **Step 3:** Run before pushing: `pnpm check`; `pnpm --filter @automata/character-kit test:browser` (Chromium,
      WebKit); the two `characterkit-painted` journeys. Update `progress.md` (what ran, what did not: Firefox and the
      GPU runner pending). Commit, push, and tell the coordinator the gate is ready. **Stop until the coordinator says to go on** (the Owner, 2026-11-11: "show me when you're think you're done"; the gates are the coordinator's).

### Task 6: Fashion: fabrics, swatches, hair

**Files:**

- Create: `src/features/fashion/fabrics.ts`, `swatches.ts`, `hair.ts`, `register-fashion.ts`
- Test: `tests/unit/fashion/register.test.ts`

**Interfaces:**

- Produces: `FABRICS: Readonly<Record<string, Fabric>>` (7), `FASHION_SWATCHES: Readonly<Record<string, Material>>`,
  `FASHION_HAIR: Readonly<Record<string, HairStyle>>`, `registerFashion(): void` (idempotent; Task 7 adds garments to it).

- [x] **Step 1:** Read the sources: `git -C vendor/FigureBuilder fetch origin claude/runway-video claude/demo-characters`
      then `git show cb4aa9f:demo/runway/wardrobe.ts` (the spec's commits, not the branch heads, which may have
      moved; `8fb0242` for `claude/demo-characters`) (fabrics, wardrobe swatches), `demo/runway/library.ts` and
      `demo/library.ts` (skin, hair and lip swatches, `silk`, hair styles). The runway's library is the later of the two;
      where they differ, the runway's wins and the demo characters' extra entries are added.
- [x] **Step 2: Failing tests.** After `registerFashion()`: `FABRICS` has 7 entries and each was handed to
      `registerFabric` (that each one paints, a non-null `cell.weave`, is Task 7's to assert, once a garment can wear
      it); every `FASHION_SWATCHES` key is in `SWATCHES`; every `FASHION_HAIR` key is in
      `HAIR_STYLES`; a character with hair finish `silk` builds. `registerFashion()` twice does not throw (Review
      Focus 4). No name collides with FB's base tables (a collision is a test failure naming it, not an overwrite).
- [x] **Step 3:** Run; FAIL. Port the data through the door only. A hair style that needs a piece FB main lacks is
      registered with `registerHairPiece` (H3); note in the file which, if any.
- [x] **Step 4:** Run; PASS. Commit: `feat(character-kit): the runway's fabrics, swatches and hair on FigureBuilder's hooks`.

### Task 7: Fashion: the garments (uses U2, on FB main)

**Files:**

- Create: `src/features/fashion/shells.ts`, `src/features/fashion/garments.ts`
- Modify: `register-fashion.ts`
- Test: `tests/unit/fashion/fit.test.ts`

**Interfaces:**

- Produces: nine kinds registered by `registerFashion()`: `tee`, `hoodie`, `jacket`, `coat`, `skirt`, `dress`, `jeans`,
  `trousers`, `shoes`, with the item shapes of the source (`{ tee: string; sleeves?: 'none' | 'short' | 'long'; ease?:
  number; length?: number }` and so on, verbatim from `demo/runway/wardrobe.ts` lines 215 to 275); exported types `Tee`,
  `Hoodie`, `Jacket`, `FashionCoat`, `FashionSkirt`, `Dress`, `Jeans`, `Trousers`, `Shoes`.

- [x] **Step 1: Failing test, `fit.test.ts`** (the showcase's `fit-check`, as assertions). For each runway outfit
      (Task 8's cast is not there yet: list the eight outfits' garments inline from `demo/runway/characters.ts`) on each
      slider extreme (thin, heavy, muscular, curvy, short; the values from `demo/runway/fit-check.ts`), in the front and
      three-quarter-back directions at D2: the figure builds and paints; and no texel inside a garment's painted region
      is a skin swatch's ramp colour (the check `fit-check.ts` drew by eye, made a count that must be 0). A `tee` in
      each fabric has a non-null `cell.weave`.
- [x] **Step 2:** Run; FAIL (no such garment kind).
- [x] **Step 3:** Port `wardrobe.ts` (275 lines) into `shells.ts` (the body-fitted shells: `legsOf` and its like) and
      `garments.ts` (the nine `registerGarment` entries), imports through the door. The source was written against an
      older FB main: where `Wearing`, `Fit` or `Body` moved, follow main's types; never widen a type to `any` to get past
      one. Where a garment needs behaviour main only offers through H2 (`registerOutfitHooks`), use H2 and say so in the
      file.
- [x] **Step 4:** Run; PASS. Also run the kit's whole unit suite: the older garments' goldens must not move.
- [x] **Step 5:** Commit: `feat(character-kit): the runway wardrobe, nine garment kinds fitted to the body under them`.

### Task 8: Fashion: the cast, the entry, the words

**Files:**

- Create: `src/features/fashion/cast.ts`
- Modify: `src/entries/index.ts`, `src/app/character-kit.extension.ts`, `package.json` (`sideEffects` already matches
  `register-*.ts`), `README.md`
- Test: `tests/unit/fashion/cast.test.ts`

**Interfaces:**

- Produces: `interface Model { readonly def: CharacterDef; readonly pose: string; readonly about: string }`;
  `RUNWAY_CAST: readonly Model[]` (MARA, DRE, JUNE, THEO, EDITH, SAM, NIA, OTTO, in that order);
  `DEMO_CAST: readonly Model[]` (BEAUTY, UGLY, ELDER, LIFTER, BIG, LANKY, POISED); the entry exports both,
  `registerFashion`, and the garment types.

- [x] **Step 1: Failing tests.** Each of the 15 builds with `member(def, 2)` and paints a standing cell; each model's
      `pose` is a key of `POSES`; ids are unique across both casts and against `BASE`; the eight runway models' heights
      and girths are not all alike (the tallest's painted rows exceed the shortest's by at least 10; the widest's
      columns the narrowest's by at least 6: "a variety of body types", measured).
- [x] **Step 2:** Run; FAIL. Port `characters.ts` from both branches as data. The extension imports
      `register-fashion.ts`.
- [x] **Step 3:** README: a new section, "Painted figures and the wardrobe", in the README's plain voice: what a painted
      figure is, the nine garments in a table, the cast, and a four-line example. Passes the drunk grandma test.
- [x] **Step 4:** Run unit, `pnpm knip`, typecheck; PASS. Commit:
      `feat(character-kit): the runway and demo casts, and the wardrobe in the kit's entry`.

### Task 9: The runway example and its journey

**Files:**

- Create: `examples/3d/characterkit/characterkit-runway.ts`, `examples/3d/tests/e2e/characterkit-runway.test.ts`
- Modify: `examples/3d/README.md` (one row)

**Interfaces:**

- Consumes: `RUNWAY_CAST`, `paintedFigure`, `characterKitExtension`; `PaintedState.pose`.

- [ ] **Step 1: Failing journey.**

```ts
test('the runway plays: a named model walks, then the next', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, gameUrl, 'characterkit-runway')
  const canvas = frame.locator('canvas.af-stage')
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
  await frame.getByTestId('play').click()
  await expect(canvas).toHaveAttribute('data-model', 'mara', { timeout: 30_000 })
  await expect(frame.getByText('MARA')).toBeVisible()
  await expect.poll(async () => (await coloursPerThird(frame))[1], { timeout: 30_000 }).toBeGreaterThan(14)
  await expect(canvas).toHaveAttribute('data-stage', 'standing', { timeout: 60_000 })
  await expect(canvas).toHaveAttribute('data-model', 'dre', { timeout: 60_000 })
  expect(errors).toEqual([])
})
```

      `coloursPerThird` (the same function in `characterkit-painted.test.ts` and `characterkit-hair.test.ts`) moves to
      `tests/e2e/colours.ts`, which all three journeys import.
- [ ] **Step 2:** Run `pnpm --filter @af-examples/examples-3d test:e2e -- characterkit-runway`; FAIL (404).
- [ ] **Step 3: Implement the example.** One file, in the examples' shape (the header block; `// --- sim ---`,
      `// --- game ---`). 640 × 360. Sim: one component per model slot (`x`, `y`, `z`, `yaw`, `walking`, `stand`), and
      one system that places all eight from `ctx.tick`: a model leaves the doorway (z = −3.5) every 540 ticks, walks
      7 m to the runway's end at 1 m/s (420 ticks), holds its hero stand 120 ticks, turns, walks back (420 ticks); the
      next leaves as it turns (the spec's "the next sets off as one turns"), so the one returning passes the next one
      coming at mid-runway, and at most two walk at once. The lead model, the one `data-model` and the name show, is the
      one walking out or standing; it becomes the next model at the turn, so `standing` is seen for 120 ticks before
      `data-model` changes (with 420 ticks between departures the next would leave on the tick the lead arrives, and
      the journey's `standing` would race `data-model`). The show loops after the eighth. A `show` resource holds the lead model's index and stage for
      the HUD. Renderer: no `camera` option; in `scene`, `view.camera` is set orthographic, `orthographicSize = 320 /
      (192 / 2.6)`, at 18° down, looking up the runway, near and far set so the depth step where figures stand is under
      1 mm (assert it in the example's browser test below); the set from `occluders.box` (runway, floor, back wall in two
      parts leaving the doorway). `views`: each slot's `paintedFigure(RUNWAY_CAST[i].def, { state })` with `pose` the
      model's own when standing. The name on screen and `data-model`, `data-stage` on the canvas each frame (as
      `cutscenes-door-and-lamp.ts` sets its `dataset`).
- [ ] **Step 4:** Add to `painted-scale.test.ts`: the runway's camera gives `scale` exactly 1 for every slot at every
      point of its path, `zoomOf / 2` is 1 to 1e-9, and `24-bit depth step at the farthest figure < 0.001`.
- [ ] **Step 5:** Run the journey in both projects; expected: 2 passed, each under 120 s. Run the whole
      `examples-3d` journey suite once locally to see its total time against the job's 30 minutes.
- [ ] **Step 6:** Commit: `feat(examples): characterkit-runway, eight models of different builds walk a runway`.

### Task 10: Gate 2, the records, the full gates

**Files:**

- Modify: `extensions/character-kit/scripts/gate.ts`; create `docs/refactor/c7/gate-2/*`
- Modify: `docs/refactor/progress.md`, `docs/status.md`, `docs/adr/0007-3d-look.md` (the line "the builder's coming
  painted-cell contract … replaces the door's exports when it lands": it has landed; say what the door takes now),
  this plan's log

- [ ] **Step 1:** `gate.ts runway`: a still of each model at the runway's end (×4 nearest), two models passing, a model
      in the doorway half behind the wall, 10 s of the loop as frames; and timings measured in the page: paint time a
      cell (mean, worst), the most cells painted in one frame, frame time with the most walkers at once (two, by the
      schedule), each model's first walk-out against its later ones (each model is a new figure with its own cells, so
      a model's first appearance paints, not only the first loop), and the painted cells' bytes after a full loop.
      Playwright's Pixel 7 profile sets the viewport, the pixel ratio and touch, not the CPU: the timings are taken
      twice, at the runner's speed and under Chromium's CPU throttling at 4× (CDP `Emulation.setCPUThrottlingRate`),
      and labelled so; neither is called a phone's. Written to `measurements.json`.
- [ ] **Step 2:** If a frame is over 33 ms under 4× throttling, in any loop including the first, first paint the next
      model's walk cells ahead, during the lead's stand, a few a frame (presentation only, the same density); then, if
      still over, lengthen the gap between models (fewer walking at once) and re-measure. Never lower the density.
      Record what was changed and why.
- [ ] **Step 3:** Look at every image. Write `gate-2/README.md`: the stills, the numbers, anything that differs from
      FB's showcase and why.
- [ ] **Step 4:** Run and record in `progress.md`, each as ran or not run: `pnpm check`; `pnpm test:browser:3d`
      (Chromium, WebKit); `pnpm --filter @af-examples/examples-3d test:e2e`; `pnpm build` (to see nothing published
      includes `@pixi/3d`: the kit, `@automata/3d` and the examples stay private). Pending and said so: Firefox, the GPU
      runner.
- [ ] **Step 5:** Commit, push, tell the coordinator. **Stop: gate 2 is the coordinator's, who shows the Owner the finished result.**

---

## Merge checklist for Tasks 1 to 8 (they merge ahead of the runway)

The runway's gate 2 also runs `pnpm build`; Tasks 1 to 8 merge before it, so these run before they do, each recorded as ran or not run in
`progress.md`:

- `pnpm check`, whole (not the pre-commit hook's affected packages: it never ran `@automata/versions`).
- `pnpm build`, then no published package's `dist` holds the closed beta: `grep -rl "@pixi/3d\|figure-builder\|CellSprite"` over each published
  package's `dist` finds only the doc comment in `render-delta-consumer.d.ts` and the boundaries tool's own error text (`pnpm boundaries` now
  forbids both imports in every published package, and `closed-beta-guard.test.ts` pins that the list covers them all).
- The kit's browser suite and the three `characterkit-*` journeys in Chromium and WebKit.
- `docs/refactor/progress.md` merged from `main` keeping both sides, after #577 is on `main`.

---

## Log

- 2026-11-11: written with the spec. Not started. The Owner approved specs and plans ahead ("auto approve spec and plans", relayed by the
  coordinator). Next: the plan audit, then Task 0 (FB's U1 and U2).
- 2026-11-11: audited ([audit](2026-11-11-c7-fashion-plan-audit.md)): 5 blocking, 10 should-fix, 5 nice-to-have, all
  fixed here. U1 and U2 are on FB main (`d6e3c9f`, FB #27), so Task 0 is done and Task 1 bumps to it. FB itself was
  not readable in the audit's session: Task 1 Step 1b checks the plan's FB names first. Next: Task 1.
- 2026-11-11 (execution): Tasks 1 to 5 done on `claude/c7-af`. Step 1b: FB main `d6e3c9f` matches every name; `view.ts` does not export
  `perTexelDepthWarning`, so `NOT_WEBGL` is the kit's own. Rulings (ledger in `.superpowers`, git-ignored): the quad is a child of the entity's
  node, one `CellSprite` per entity, `painter.ts` added; `door-view.ts` made in Task 3 where first used (knip); the root `package.json` lists
  `pixi.js` and `@pixi/3d` (a bundler resolves the builder's view sources from the submodule's real path); `characterkit-painted` is 720 × 405
  (the coordinator), its wall is on the camera's side (the camera looks toward +z); `painted-scale` is a Node unit test that reads the example's size.
  WebKit and Firefox cannot be installed in this container: every browser run was Chromium. Gate 1: [README](c7/gate-1/README.md). Next: Task 6, unless the
  coordinator says stop.
- 2026-11-11 (execution, later): Tasks 6 to 8 done (fabrics, swatches and hair; nine garments; the casts, the entry, the README). Task 9 and
  Task 10 are on hold: the Owner, via the coordinator, "We can hault progress for the fashion runway until the envbuilder is done with
  stage 2 so the runway actually looks good". The runway example, its journey, its camera test and gate 2's script were started and are not on
  the branch. WebKit now runs here (`playwright install-deps webkit`, then `playwright install webkit`): the kit's browser suite and the three
  `characterkit-*` journeys pass in Chromium and WebKit. Case 3 of `painted-depth` (two overlapping figures) differs from `compose` by 2 of 230,400
  pixels in WebKit where two surfaces cross (the builder's contract allows a pixel there), so it allows 8. Gate 1 measured with no look pass
  (the example sets none); 91% of the stander's texels equal the builder's cell, the rest not yet attributed between the idle pose's moment and the
  DUEL snap (EnvironmentBuilder's `claude/eb-look-albedo`).
- 2026-11-11 (implementation audit, Tasks 1 to 8): [audit](2026-11-11-c7-fashion-implementation-audit.md): 1 blocking (`pnpm check` fails:
  `tsx@4.23.15` unrecorded in `docs/versions.md`), 9 should-fix, 6 nice-to-have, none fixed here. Gate 1's 91% and 99% are one render at
  two idle steps; the last 1% is the soles below the ground line under the floor: the painter matches. The wardrobe equals the showcase's
  cells on the pinned FB. Next: fix B1 and the should-fix items, then the runway when EnvironmentBuilder's stage 2 is done.
- 2026-11-11 (fixes, Tasks 1 to 8): B1 and S1 to S8 closed (S9 waits on #577: not merged when these fixes finished). B1: `tsx` stays, its pin recorded
  in `docs/versions.md` (the `goldens` way of running a script cannot load the builder's JSON imports without an attribute). S1/S2: gate 1 compares the
  render with the builder's own best idle cell, counts the soles the floor hides (27 of 45 below the ground line; 100% of the texels above it equal), and
  measures 1.000 texels a pixel from the ground up; README, parity counts and header corrected. S3: `painted-depth` skips only where two sprites' depths are
  within the depth step. S4: a golden of the showcase's cells (32 on the models' own bodies, 80 on the fit check's extremes), from `scripts/record-runway-cells.ts`;
  clearance mutations of `shells.ts` now fail 10 to 16 unit tests; the skin count alone fails none (a garment repaints what it covers). S5: boxes ticked
  (Task 3 Step 6 stays open: Firefox did not run). S6: ADR 0007. S7: `@pixi/3d` and `figure-builder` forbidden in all 13 published packages. S8: the merge checklist above.
  Skipped: N1 to N6, see the fixes row in `progress.md`.
