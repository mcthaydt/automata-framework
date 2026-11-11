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
5. **An entity removed mid-show.** Its `CellSprite` leaves the stage and the ranks of the rest close up; no leaked
   texture. Task 3.
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
  src/features/painted/painted-view.ts      paintedFigure                                 rewritten
  src/features/fashion/{fabrics,swatches,hair,shells,garments,cast,register-fashion}.ts   new
  tests/unit/shared/door.test.ts            moved from tests/unit/painted
  tests/unit/painted/{pose,place}.test.ts   new (camera.test.ts deleted)
  tests/unit/fashion/{register,fit,cast}.test.ts                                          new
  tests/browser/painted/{painted-view,painted-depth}.test.ts                              rewritten, new
  scripts/gate.ts                           the gates' renders and measurements           new
examples/3d/characterkit/characterkit-painted.ts      640 × 360
examples/3d/characterkit/characterkit-runway.ts       new
examples/3d/tests/e2e/characterkit-runway.test.ts     new
docs/refactor/c7/                                     the gates' artifacts
```

---

### Task 0: The upstream asks (the coordinator's, not the executor's)

- [ ] FB main carries U1 (`TIE_BIAS` exported by `src/index`) and U2 (`src/kit` exports `GROUP`, `weights`, `qmul`,
      `smooth`, types `Limb`, `Ring`), each with its line in FB's `tests/api.test.ts`. No `STAGE_VERSION` bump.
- [ ] The coordinator gives the executor the FB commit to bump to.

Tasks 1 to 5 need U1 only; Tasks 7 and on need U2. If U2 is late, do Tasks 1 to 6 and gate 1 first.

### Task 1: Bump the submodule and move the door

**Files:**

- Modify: `vendor/FigureBuilder` (the gitlink), `pnpm-lock.yaml` if it moves
- Move: `src/features/painted/door.ts` → `src/shared/figure-builder/door.ts`; create `door-view.ts` beside it
- Move: `tests/unit/painted/door.test.ts` → `tests/unit/shared/door.test.ts`
- Create: `tests/unit/shared/contract.test.ts`
- Modify: every importer of the old door path (`painted/*.ts`, `entries/index.ts`, `tests/browser/painted/*`)

**Interfaces:**

- Produces, from `door.ts`: everything it exports today, plus `SPRITE_PITCH`, `STAGE_VERSION`, `TIE_BIAS`, `cellOf`,
  `project`, `viewOf`, `zoomOf`, `texelDepths`, `stageFrame`, `compose`, `ScriptedActor`, `POSES`, `GAITS`, `SWATCHES`,
  `HAIR_STYLES`, `registerGarment`, `registerOutfitHooks`, `registerHairPiece`, `registerFinish`, `registerFabric`, and
  the types `Cell`, `CameraPose`, `StageSprite`, `StageFrame`, `Backdrop`, `Garment`, `GarmentKind`, `Wearing`, `Fit`,
  `Fabric`, `HairStyle`, `HairFinish`, `Material`, `Part`, `Side`, `Body`. From FB's `kit` (after U2): `limb`,
  `superquadric`, `GROUP`, `weights`, `axisAngle`, `lerp`, `qmul`, `smooth`, `J`, types `Limb`, `Ring`, `V3`.
- Produces, from `door-view.ts`: `CellSprite`.

- [ ] **Step 1:** Bump: `git -C vendor/FigureBuilder fetch origin && git -C vendor/FigureBuilder checkout <commit>`,
      `pnpm install`, `pnpm --filter figure-builder typecheck`. Expected: declarations build.
- [ ] **Step 2:** Run the kit's suites on the bump alone, before any edit: `pnpm --filter @automata/character-kit
      test:unit` and `test:browser`. Expected: pass; the 16 texel-for-texel views still equal. A failure here is FB's
      change to investigate, not to re-record.
- [ ] **Step 3: Failing tests.** `door.test.ts` (moved): the only files importing `figure-builder` are
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

- [ ] **Step 4:** Run; expect FAIL (no such module). Move the door, add the exports, fix importers. Run; expect PASS.
- [ ] **Step 5:** `pnpm boundaries && pnpm style && pnpm knip` (an export nothing uses yet is added in the task that
      uses it, if knip objects). Commit: `refactor(character-kit): the door to FigureBuilder moves to shared and takes the stage contract`.

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

- [ ] **Step 1: Failing tests, `pose.test.ts`.** A camera at `[0, 3, 5]` looking at the origin gives `fwd` along
      `normalize([0, −3, −5])`, `right` `[1, 0, 0]`, and `right × up = −fwd` to 1e-12; perspective `fov` 53.13° at
      640 × 360 gives `f` 360 ± 0.01 and no `pixelsPerMetre`; orthographic with `orthographicSize = 320 / 73.846…` gives
      `pixelsPerMetre` 73.846 ± 1e-9 and no `f`; `zoom` other than 1 is folded in (perspective `f × zoom`, orthographic
      `pixelsPerMetre × zoom`).
- [ ] **Step 2: Failing tests, `place.test.ts`.** The parity test, perspective and orthographic, for both `BASE`
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

      Then: cameras tilted 25°, 40° and 60° give the same `cell.key`; at 480 × 270, 5 m, `scale` is 1 (0.73 rounds up to
      the floor of 1); a figure 0.05 m in front of a perspective camera is `undefined`; no field of a `Placed` at the
      frame's edge is NaN; `ranked` puts the farther first and keeps the given order on a tie; `position` projected
      back through `project(pose, …)` lands the anchor texel on `screen + scale · anchor` to 1e-6.
      (The executor checks `ScriptedActor`'s real constructor in `vendor/FigureBuilder/docs/actors.md` and adapts the
      first line; the assertions stand.)
- [ ] **Step 3:** Run both; expect FAIL (modules missing).
- [ ] **Step 4: Implement.** `place` is the spec's 5.2 block, using the door's `project`, `zoomOf`, `viewOf`. The quad's
      place is `StageView.draw`'s: `eye + d·fwd + px·right − py·up` with `px, py = (screen + scale·anchor − size / 2) · k`,
      `k = d / f` or `1 / pixelsPerMetre`; `pixelSize = scale · k`.
- [ ] **Step 5:** Run; expect PASS. Commit: `feat(character-kit): the stage contract's placement for one figure`.

### Task 3: The painted stage, with per-texel depth

**Files:**

- Create: `src/features/painted/painted-stage.ts`
- Rewrite: `src/features/painted/painted-view.ts`
- Delete: `src/features/painted/figure-sprite.ts`, `src/features/painted/camera.ts`, `tests/unit/painted/camera.test.ts`
- Test: `tests/browser/painted/painted-view.test.ts` (rewritten), `tests/browser/painted/painted-depth.test.ts`,
  `tests/unit/painted/painted-stage.test.ts`

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

- [ ] **Step 1: Failing unit test, `painted-stage.test.ts`** (Node, a fake `CellSprite` seam is not needed: test the
      pure parts). Unknown `pose` name: `paintedFigure(def, { state: () => ({ moving: false, pose: 'nope' }) })` throws
      at its first frame with `/No pose called "nope"/` and the character's id; unknown `outfit` likewise
      (`/has no outfit called/`).
- [ ] **Step 2: Failing browser tests, `painted-depth.test.ts`** (uses `createPixi3dRenderer`, `builtRenderer`,
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
     figures are drawn; skipped with its reason where WebGPU is refused (Review Focus 3).
- [ ] **Step 3:** Rewrite `painted-view.test.ts`: both base figures, 8 directions, through the renderer under the
      orthographic camera at 18°, are FB's `standing` cell at `SPRITE_PITCH` texel for texel (16 of 16), as before but
      at the fixed pitch.
- [ ] **Step 4:** Run `pnpm --filter @automata/character-kit test:browser`; expect FAIL (no `painted-stage`).
- [ ] **Step 5: Implement.** `stageFor(camera)` keeps one stage per camera. Its node is a `Container3D` added under the
      first member's parent's root; each frame it runs once, in the last callback before the view draws: try, in order,
      (a) `onRender` on the stage's own node, (b) `onRender` on the `View3D` reached from the node's parents. Case 5
      decides: if neither passes it, stop (Global Constraints) and report. Then per frame: `pose = poseOf(camera, [w,
      h])`; each member's `frame(at => paintView(pose, at))`; `place`; `ranked`; per rank `i`: `quad.show(cell)`,
      `quad.showDepths(texelDepths(pose, sprite), pose.f !== undefined, P[10], P[14], (i + 1) * TIE_BIAS)` with
      `P = camera.computeProjection(w / h, new Matrix4()).elements`; set the quad's position, `pixelSize`, and its
      quaternion to the camera's. The renderer's type is read once; not WebGL warns once with `NOT_WEBGL`.
      `paintedFigure` keeps `placeView3d` for the entity's place and yaw (an entity's yaw 0 faces −z, a figure's facing 0
      faces +z: half a turn), owns its `Figure`, and is a `StageMember`.
- [ ] **Step 6:** Run unit and browser, Chromium then WebKit (`pnpm --filter @automata/character-kit test:browser`;
      the preset's WebKit project). Expected: PASS; case 7 may skip with its reason.
- [ ] **Step 7:** `pnpm boundaries && pnpm style && pnpm knip`. Commit:
      `feat(character-kit): painted figures at the painter's pitch, crisp, with per-texel depth`.

### Task 4: `characterkit-painted` at 1:1

**Files:**

- Modify: `examples/3d/characterkit/characterkit-painted.ts`, `examples/3d/tests/e2e/characterkit-painted.test.ts`,
  `examples/3d/README.md` (the row's words, if they name the size)
- Test: `extensions/character-kit/tests/browser/painted/painted-scale.test.ts`

- [ ] **Step 1: Failing browser test.** The example's own numbers (640 × 360, `fovOf(24)`, the default view 5 m back,
      25° down): for the walker at each corner of its 2 m square and the stander, `place(...).sprite.scale >= 1`, and it
      is exactly 1. The same at 480 × 270 is also 1 by the floor, so the test also asserts `zoomOf(pose, at) / 2 >= 0.95`
      at 640 × 360 (0.975 at 5 m) and documents that 480 × 270 gives 0.73: the reason for the size.
- [ ] **Step 2:** Run; expect FAIL on the 0.95 line until the size is passed as 640 × 360.
- [ ] **Step 3:** `size: { width: 640, height: 360 }` in the example; add a box wall the walker passes behind on one side
      of its square, so depth is seen. The header comment says what the example now shows (the fixed pitch, crisp, depth).
- [ ] **Step 4:** The journey keeps its checks; add: the canvas is `data-renderer="webgl"`. Run
      `pnpm --filter @af-examples/examples-3d test:e2e -- characterkit-painted` (both projects). Expected: 2 passed.
- [ ] **Step 5:** Commit: `feat(examples): characterkit-painted at 640 × 360, one pixel a texel, behind a wall`.

### Task 5: Gate 1 (the coordinator's checkpoint)

**Files:**

- Create: `extensions/character-kit/scripts/gate.ts`, `docs/refactor/c7/gate-1/*`

- [ ] **Step 1:** `gate.ts` (Playwright, Chromium, the built examples): renders `characterkit-painted` at a fixed tick
      from the branch's base (`git worktree` of `origin/claude/figurebuilder-submodule`) and from this branch; writes
      each as a PNG at ×4 nearest; measures texels a pixel from the readback (the stander's height in pixels against its
      cell's painted rows) and writes `measurements.json`; writes FB's own `standing` cell of the same figure and
      direction beside them; writes the depth sheet (Task 3's cases 3 and 4 as images). Numbers come from the script,
      never typed.
- [ ] **Step 2:** Run it; look at every image; write `docs/refactor/c7/gate-1/README.md`: the three images side by
      side, the measured numbers, what changed and why, and the WebKit run of Tasks 3 and 4.
- [ ] **Step 3:** Run before pushing: `pnpm check`; `pnpm --filter @automata/character-kit test:browser` (Chromium,
      WebKit); the two `characterkit-painted` journeys. Update `progress.md` (what ran, what did not: Firefox and the
      GPU runner pending). Commit, push, and tell the coordinator the gate is ready. **Stop until the coordinator says to go on** (the Owner, 2026-11-11: "show me when you're think you're done"; the gates are the coordinator's).

### Task 6: Fashion: fabrics, swatches, hair

**Files:**

- Create: `src/features/fashion/fabrics.ts`, `swatches.ts`, `hair.ts`, `register-fashion.ts`
- Test: `tests/unit/fashion/register.test.ts`

**Interfaces:**

- Produces: `FABRICS: Readonly<Record<string, Fabric>>` (7), `FASHION_SWATCHES: Readonly<Record<string, Material>>`,
  `FASHION_HAIR: Readonly<Record<string, HairStyle>>`, `registerFashion(): void` (idempotent; Task 7 adds garments to it).

- [ ] **Step 1:** Read the sources: `git -C vendor/FigureBuilder fetch origin claude/runway-video claude/demo-characters`
      then `git show <branch>:demo/runway/wardrobe.ts` (fabrics, wardrobe swatches), `demo/runway/library.ts` and
      `demo/library.ts` (skin, hair and lip swatches, `silk`, hair styles). The runway's library is the later of the two;
      where they differ, the runway's wins and the demo characters' extra entries are added.
- [ ] **Step 2: Failing tests.** After `registerFashion()`: `FABRICS` has 7 entries and each was handed to
      `registerFabric` (that each one paints, a non-null `cell.weave`, is Task 7's to assert, once a garment can wear
      it); every `FASHION_SWATCHES` key is in `SWATCHES`; every `FASHION_HAIR` key is in
      `HAIR_STYLES`; a character with hair finish `silk` builds. `registerFashion()` twice does not throw (Review
      Focus 4). No name collides with FB's base tables (a collision is a test failure naming it, not an overwrite).
- [ ] **Step 3:** Run; FAIL. Port the data through the door only. A hair style that needs a piece FB main lacks is
      registered with `registerHairPiece` (H3); note in the file which, if any.
- [ ] **Step 4:** Run; PASS. Commit: `feat(character-kit): the runway's fabrics, swatches and hair on FigureBuilder's hooks`.

### Task 7: Fashion: the garments (needs U2)

**Files:**

- Create: `src/features/fashion/shells.ts`, `src/features/fashion/garments.ts`
- Modify: `register-fashion.ts`
- Test: `tests/unit/fashion/fit.test.ts`

**Interfaces:**

- Produces: nine kinds registered by `registerFashion()`: `tee`, `hoodie`, `jacket`, `coat`, `skirt`, `dress`, `jeans`,
  `trousers`, `shoes`, with the item shapes of the source (`{ tee: string; sleeves?: 'none' | 'short' | 'long'; ease?:
  number; length?: number }` and so on, verbatim from `demo/runway/wardrobe.ts` lines 215 to 275); exported types `Tee`,
  `Hoodie`, `Jacket`, `FashionCoat`, `FashionSkirt`, `Dress`, `Jeans`, `Trousers`, `Shoes`.

- [ ] **Step 1: Failing test, `fit.test.ts`** (the showcase's `fit-check`, as assertions). For each runway outfit
      (Task 8's cast is not there yet: list the eight outfits' garments inline from `demo/runway/characters.ts`) on each
      slider extreme (thin, heavy, muscular, curvy, short; the values from `demo/runway/fit-check.ts`), in the front and
      three-quarter-back directions at D2: the figure builds and paints; and no texel inside a garment's painted region
      is a skin swatch's ramp colour (the check `fit-check.ts` drew by eye, made a count that must be 0). A `tee` in
      each fabric has a non-null `cell.weave`.
- [ ] **Step 2:** Run; FAIL (no such garment kind).
- [ ] **Step 3:** Port `wardrobe.ts` (275 lines) into `shells.ts` (the body-fitted shells: `legsOf` and its like) and
      `garments.ts` (the nine `registerGarment` entries), imports through the door. The source was written against an
      older FB main: where `Wearing`, `Fit` or `Body` moved, follow main's types; never widen a type to `any` to get past
      one. Where a garment needs behaviour main only offers through H2 (`registerOutfitHooks`), use H2 and say so in the
      file.
- [ ] **Step 4:** Run; PASS. Also run the kit's whole unit suite: the older garments' goldens must not move.
- [ ] **Step 5:** Commit: `feat(character-kit): the runway wardrobe, nine garment kinds fitted to the body under them`.

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

- [ ] **Step 1: Failing tests.** Each of the 15 builds with `member(def, 2)` and paints a standing cell; each model's
      `pose` is a key of `POSES`; ids are unique across both casts and against `BASE`; the eight runway models' heights
      and girths are not all alike (the tallest's painted rows exceed the shortest's by at least 10; the widest's
      columns the narrowest's by at least 6: "a variety of body types", measured).
- [ ] **Step 2:** Run; FAIL. Port `characters.ts` from both branches as data. The extension imports
      `register-fashion.ts`.
- [ ] **Step 3:** README: a new section, "Painted figures and the wardrobe", in the README's plain voice: what a painted
      figure is, the nine garments in a table, the cast, and a four-line example. Passes the drunk grandma test.
- [ ] **Step 4:** Run unit, `pnpm knip`, typecheck; PASS. Commit:
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

      `coloursPerThird` moves from `characterkit-painted.test.ts` to a helper both journeys import.
- [ ] **Step 2:** Run `pnpm --filter @af-examples/examples-3d test:e2e -- characterkit-runway`; FAIL (404).
- [ ] **Step 3: Implement the example.** One file, in the examples' shape (the header block; `// --- sim ---`,
      `// --- game ---`). 640 × 360. Sim: one component per model slot (`x`, `y`, `z`, `yaw`, `walking`, `stand`), and
      one system that places all eight from `ctx.tick`: a model leaves the doorway (z = −3.5) every 420 ticks, walks
      7 m to the runway's end at 1 m/s, holds its hero stand 120 ticks, turns, walks back; so the one returning passes
      the next one coming. The show loops after the eighth. A `show` resource holds the lead model's index and stage for
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
      in the doorway half behind the wall, 10 s of the loop as frames; and timings measured in the page on the Pixel 7
      profile: paint time a cell (mean, worst), frame time with the most walkers at once, the first loop against later
      loops. Written to `measurements.json`.
- [ ] **Step 2:** If a frame is over 33 ms after the first loop, lengthen the gap between models (fewer walking at
      once) and re-measure. Never lower the density. Record what was changed and why.
- [ ] **Step 3:** Look at every image. Write `gate-2/README.md`: the stills, the numbers, anything that differs from
      FB's showcase and why.
- [ ] **Step 4:** Run and record in `progress.md`, each as ran or not run: `pnpm check`; `pnpm test:browser:3d`
      (Chromium, WebKit); `pnpm --filter @af-examples/examples-3d test:e2e`; `pnpm build` (to see nothing published
      includes `@pixi/3d`: the kit, `@automata/3d` and the examples stay private). Pending and said so: Firefox, the GPU
      runner.
- [ ] **Step 5:** Commit, push, tell the coordinator. **Stop: gate 2 is the coordinator's, who shows the Owner the finished result.**

---

## Log

- 2026-11-11: written with the spec. Not started. The Owner approved specs and plans ahead ("auto approve spec and plans", relayed by the
  coordinator). Next: the plan audit, then Task 0 (FB's U1 and U2).
