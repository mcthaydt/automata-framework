# c7 plan audit

The audit of [the c7 plan](2026-11-11-c7-fashion-plan.md) against [its spec](2026-11-11-c7-fashion-spec.md), AF's code
and FigureBuilder (FB). 2026-11-11, on `claude/c7-af-spec` (draft PR #581, stacked on #577). The Owner approved the
spec and plan ahead ("auto approve spec and plans"), so the audit checks the plan's correctness and leaves the Owner's
decisions alone.

**Result: 5 blocking, 10 should-fix, 5 nice-to-have. All are fixed in the plan.** The spec was changed only where it
was factually wrong (B3, B4, S10, and FB's main commit), and each change is marked "corrected at the plan audit".

## What could not be checked: FigureBuilder

FB could not be read in this session. The submodule needs credentials to clone, and adding
`mcthaydt/figurebuilder` to the session was refused. There is no copy of FB anywhere on the machine. So none of
these were checked against FB main (`d6e3c9f`):

- `docs/contract.md`;
- the names and signatures in `src/features/stage` (`project`, `viewOf`, `zoomOf`, `texelDepths`, `stageFrame`,
  `compose`, `ScriptedActor`, `StageSprite`) and `STAGE_VERSION`;
- `src/features/view/cell-sprite.ts`: `CellSprite`, its depth bit, its WebGL-only depth, `showDepths`'s arguments and
  `checkCentred`. The plan never names `checkCentred`;
- `SPRITE_PITCH` and `TIE_BIAS`;
- the H1 to H5 hooks, including whether `registerGarment` throws on a second registration;
- the showcase branches at `cb4aa9f` and `8fb0242`: the file paths, the 7 fabrics, the 9 garment kinds, the casts,
  and `wardrobe.ts`'s 275 lines;
- whether `src/index` is free of Pixi;
- whether FB's view entry is `src/view.ts`.

U1 and U2 being on FB main at `d6e3c9f` is the coordinator's fact, and the audit relied on it. B5 makes the
executor check every one of these before writing code.

## Verified in AF

- The door is `extensions/character-kit/src/features/painted/door.ts`. It exports `BASE`, `Figure`, `member`,
  `standing` and the types `CastMember`, `CharacterDef`, `FigureInput` and `View`. `tests/unit/painted/door.test.ts`
  walks `src/` and `tests/` and holds the door as the only importer.
- `vendor/figure-builder` is the workspace package. It symlinks FB's `src` and `base`, maps `./*` to `src/*.ts`,
  declares only `typescript`, and builds declarations of `src/**` with `types: []`.
- `View3dFactory` takes the camera as its fifth argument. `mount` passes the `View3D`'s own camera
  (`factory(row, componentId, models, light, view.camera)`), read when the factory is called.
- `mergeHooks(entities, cameraDriver(...), occluding)` runs views before the camera moves. AF's renderer calls
  `hooks.draw` and then `app.render()`, so `View3D.onRender` runs after the camera driver.
- In `@pixi/3d` 0.1.0-beta.2, `View3D` has `onRender`, which runs at the start of each render. `Container3D` has no
  `onRender`; it has `view3d`.
- `computeProjection` divides `fov` by `zoom` in perspective and multiplies `orthographicSize` by `zoom` in
  orthographic. `orthographicSize` is half the view's width.
- The main render graph's depth is `depth24plus-stencil8`.
- The renderer tries WebGL 2 unless `preference: 'webgpu'`.
- `fovOf(24)` is 53.13°, from `2·atan(12/24)`, on a vertical gate. The follow view's defaults are 25° down, 5 m back
  and `focusHeight` 1, so the walker's feet are 5.42 m deep.
- `characterkit-painted` is 480 × 270, follows the walker, and its journey already asserts `data-renderer="webgl"`.
- `coloursPerThird` is copied in both the painted and the hair journeys.
- The kit's `browser` project runs Chromium, WebKit and Firefox together. The existing painted test skips without
  WebGL 2.
- CI:
  - journeys get 120 s and their servers 180 s;
  - `3d.yml`'s journeys job gets 30 minutes;
  - `SUBMODULES_TOKEN` is used in its own step, `submodule update --init --depth 1`, in `3d.yml`, `ci.yml` and
    `release-checks.yml`;
  - `test:browser:3d` includes the kit, with a 90 s test timeout;
  - `3d.yml`'s `pull_request` paths do not include `vendor/FigureBuilder` or `vendor/figure-builder/**`.
- `@automata/character-kit`, `@automata/3d` and `examples/3d` are private. The kit's `sideEffects` already matches
  `features/*/register-*.ts`.
- ADR 0007 line 74 still says "the builder's coming painted-cell contract … replaces the door's exports when it
  lands".
- The base of this branch is `a66b4e0e`, the head of `claude/figurebuilder-submodule`.
- The playwright devices: Pixel 7 landscape is 863 × 360 at ×2.625; iPhone 14 landscape is 750 × 340 at ×3.

## Blocking

**B1. Task 0 waited on an FB PR that has merged.** FB #27 (`d6e3c9f`) carries U1 and U2. Fixed:
- Task 0 now records that it is done.
- Task 1 bumps to `d6e3c9f` or later.
- Task 7 no longer "needs U2".
- The spec's sections 2, 5.1 and 8 name `d6e3c9f`.

**B2. Task 2's pose test folded `zoom` in the wrong way for both camera modes.** It said perspective `f × zoom` and
orthographic `pixelsPerMetre × zoom`. `@pixi/3d` computes `fov / zoom` and `orthographicSize × zoom`, so
`pixelsPerMetre` is `w / (2·orthographicSize·zoom)`. A test written to the plan would have driven a wrong `poseOf`.
Fixed: the test now uses the right formulas (zoom 2 at 53.13° and 360 px gives f = 762.5) and adds a check against
the camera's own `computeProjection` matrix.

**B3. Task 4's `zoomOf / 2 >= 0.95` at 640 × 360 could never pass.** The spec's 0.975 is taken at the follow camera's
focus, 5 m away. The focus is 1 m above the feet, so at 25° down the feet are 5.42 m deep, which gives about 0.90. The
assertion also covered the stander, whom the camera does not follow. Fixed:
- The walker's `zoomOf / 2` must lie in [0.85, 1.0].
- The stander's `scale` must be 1.
- 640 × 360 must be nearer 1 than 480 × 270 (about 0.67).
- The test runs under reduced motion, so the camera sits on its target.

The spec's sections 2 and 4 are corrected: 0.73 → 0.73 at the focus and 0.67 at the feet, and "2.5% over true scale"
→ about 11% at the feet. The Owner's size call (640 × 360) stands.

**B4. Task 9's schedule broke the journey and contradicted the spec.** A model left every 420 ticks, and the walk
takes 420 ticks. So the next model left on the very tick the lead arrived, and `data-stage="standing"` raced
`data-model` changing. The spec says "the next sets off as one turns". Fixed:
- Departures are every 540 ticks.
- The lead is the model walking out or standing, and it changes at the turn.
- At most two models walk at once. The spec's "three walkers" is corrected to "the most at once (two)".

**B5. The plan's FB interfaces had no step that checks them against FB before code is written.** None could be
checked here (see above). Fixed: Task 1 Step 1b. With the submodule bumped, the executor confirms each name,
signature and behaviour the plan relies on, including `checkCentred` and `zoomOf`'s point and unit. On a mismatch that
changes an interface, the executor stops and tells the coordinator.

## Should-fix

**S1. FB's view entry imports `pixi.js` and `@pixi/3d`, and nothing shows the wrapper can resolve them.** The wrapper
declares neither. Its sources are reached through a symlink into `vendor/FigureBuilder`, which has no `node_modules`.
Task 1 Step 1 now proves two things: that the declarations of `src/view` build, and that a browser import of
`figure-builder/view` loads. If either fails, it adds both packages to the wrapper as peer and dev dependencies.

**S2. The render seam named a hook that does not exist.** Task 3 Step 5 tried `onRender` on the stage's
`Container3D` first, but `Container3D` has no `onRender`. Fixed: the step uses `View3D.onRender` through
`node.view3d`. That slot holds one callback, so the step keeps and calls any callback already there and restores it.
Case 5 still proves the order.

**S3. The stage node was to be added "under the first member's parent's root".** When the factory runs, the node has
no parent yet. Fixed: the stage attaches on a member's first update.

**S4. Task 3 Step 1's Node test could not reach "the first frame".** `paintedFigure` needs Pixi and a render. Also, a
throw inside a render callback would stop Pixi's ticker. Fixed:
- A pure `state.ts` (`checkState`) is tested in Node.
- `paintedFigure` calls it in the entity's update path, not inside the render callback.
- A browser case (8) shows the error at the first frame.

**S5. A hidden or removed entity's `CellSprite` would still be drawn.** The quad lives under the stage's node, not
the entity's. Fixed: browser case 9 is added, and Review Focus 5 now covers it.

**S6. "The preset's WebKit project" does not exist.** The kit's `browser` project runs all three engines. Fixed:
Step 6 names the project as it is, and every new browser case skips with a reason when WebGL 2 is missing.

**S7. Gate 1's "same sim tick" did not fix the frame.** The painter's walk clock is the page's clock, the follow
camera eases, and the base was a branch that goes away when #577 merges. Fixed:
- The gate script uses Playwright's fake clock and `reducedMotion: 'reduce'`, which zeroes klipp's damping.
- The base is pinned to `a66b4e0e`.
- The base's worktree gets its own submodule checkout and install.

**S8. Gate 2's timings did not measure what they claimed, and the CPU risk was under-planned.** Playwright's Pixel 7
profile sets the viewport, pixel ratio and touch, but not the CPU.

Each of the eight models is a new figure with its own cells, so each model's first walk-out paints. That cost comes
back eight times a loop, not only in the first loop. The "fewer walkers" fix does nothing for it, and Step 2 ignored
the first loop. Fixed:
- Timings are taken at the runner's speed and under 4× CDP CPU throttling, each labelled.
- The gate adds the most cells painted in one frame, each model's first walk-out against its later ones, and the
  cells' bytes after a loop.
- The 33 ms rule now covers every loop.
- The first remedy is to paint the next model's cells ahead during the lead's stand, a few a frame, at the same
  density. Fewer walkers comes after that.

**S9. A change to the submodule alone did not run the 3D suites.** `3d.yml`'s `pull_request` paths miss the two
vendor folders. Fixed: Task 1 adds them.

**S10. The spec said "Both journey phones show 640 × 360 at ×1".** That is not true: iPhone 14 landscape is
750 × 340 CSS px, and the letterbox scales the whole field. The crisp rule holds in the field's own pixels. Fixed in
the spec's section 4.

## Nice-to-have

**N1.** At 720 × 405 the feet would be about 1.01 px a texel, against 0.90 at 640 × 360. This is for the coordinator
to raise if wanted. The Owner-approved call stands, and nothing was changed.

**N2.** `computeProjection` was handed a new `Matrix4` every frame. Fixed: the stage keeps one.

**N3.** `coloursPerThird` is copied in the hair journey as well as the painted one. Fixed: one helper,
`tests/e2e/colours.ts`, used by all three journeys.

**N4.** Task 4 Step 4 added a `data-renderer` check the journey already has. Fixed: it now checks for no page error
after the walker has passed behind the wall.

**N5.** The File Structure left out `contract.test.ts`, `state.ts` and its test, `painted-scale.test.ts`, the journey
helper, the wrapper and the workflow. Fixed.

## Not changed

- The Owner's decisions in spec section 1, and the calls in section 8 (N1 is only raised).
- The spec's crisp rule. Decision 1 says `round(zoom)` and section 4 says `round(zoom / 2)`. These are the same rule
  in different units of `zoom`; B5's check of `zoomOf` settles it.

## Ran

- Read the plan, the spec and the AF code named above.
- Read `@pixi/3d` 0.1.0-beta.2's `Camera3D`, `View3D`, `Container3D` and `RenderGraph` from the vendored tarball.
- Measured the devices from `@playwright/test` 1.63.
- `pnpm install --frozen-lockfile`. The submodule is absent, so `figure-builder` built no declarations.
- `pnpm format` and `check-style --docs`, recorded in `progress.md`.
- Nothing was built or run in a browser.
