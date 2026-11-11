# Gate 1: painted figures at one pixel a texel, with depth

Made by `pnpm --filter @automata/character-kit gate 1` (`extensions/character-kit/scripts/gate.ts`); every number below is in
[`measurements.json`](measurements.json) and [`parity.json`](parity.json), measured from the renders, never typed. The coordinator checks
this before the fashion work (tasks 6 to 8) goes on.

Before is `a66b4e0e` (the head of `claude/figurebuilder-submodule`, which this branch was cut from), built in a worktree of its own;
after is this branch. Both ran in Chromium under Playwright's fake clock with `reducedMotion: 'reduce'`, the viewport the field's own size
so the letterbox's upscale is ×1 and the canvas holds the field's pixels, and the readback taken 33 ms of fake time after the
first frame that shows the figures: the same sim tick (the first ticks of the walker's loop) on both sides.

## The picture

| | field | file |
|---|---|---|
| before | 480 × 270 | [`before.png`](before.png) (×4) |
| after | 720 × 405 | [`after.png`](after.png) (×4) |
| the stander: before, after, the builder's own `standing` cell | | [`stander-before-after-builder.png`](stander-before-after-builder.png) (×4, nearest) |

![before](before.png)
![after](after.png)
![the stander](stander-before-after-builder.png)

## Texels a pixel (the stander, the woman, found in each render as the figure farthest from the middle)

| | painted rows of her cell | her height in pixels | texels a pixel |
|---|---|---|---|
| before (480 × 270, cell painted at the camera's 25°) | 123 | 69 | 1.78 |
| after (720 × 405, cell painted at the painter's 18°) | 128 | 126 | 1.016 |

Before, a texel was minified: nearly two texels went into each pixel, so texels dropped out (the jagged outline of the left tile).
After, a texel is a pixel: the figure is the builder's cell as it paints it. Of her 128-row cell, 99% of the opaque
texels equal the builder's own `standing` cell pixel for pixel at the best offset (the rest is the idle pose's blink and hair at a
different moment than the sheet's three steps). The unit test `painted-scale` gives the same from `zoomOf`: 0.67 a pixel at 480 × 270,
0.90 at 640 × 360, 1.01 at 720 × 405 (the coordinator's ruling, never minified).

## Parity with the builder's `compose` (the depth sheet)

[`depth-1.png`](depth-1.png) to [`depth-4.png`](depth-4.png): each is the GPU's readback, the builder's `compose(frame, backdrop)` of the same
frame, and red where they differ (the sheets are all dark, so none). Counts, in [`parity.json`](parity.json):

| case | pixels compared | differing |
|---|---|---|
| one figure, orthographic at 18° | 230400 | 0 |
| one figure, perspective (the follow view) | 230400 | 0 |
| two overlapping figures | 230400 | 0 |
| a figure cut by a wall | 230400 | 0 |

Case 3 is two overlapping figures (the nearer in front, the other's body behind her arm); case 4 a figure cut by a thin wall whose front face
is 5 cm in front of the figure's root plane, so some of her stands in front of the wall and the rest behind it, by texel (a pixel either side
of the cut line is not compared, where two surfaces cross). The same cases run as tests in `tests/browser/painted/painted-depth.test.ts`, which a
flat-depth mutation fails (cases 3 and 4).

## What changed, and why

- The cell is painted at the builder's 18° whatever the camera's tilt (the camera is 25° down here), at D2, and drawn crisp: whole pixels a
  texel, the top-left on the pixel grid. The size is 720 × 405 so that a texel at the walker's feet is 1.01 px.
- Each texel has a depth, so figures hide behind AF's geometry and each other by texel. `characterkit-painted` gained a low wall between the camera
  and the walker's near side (the camera looks toward +z): in `after.png` the walker's legs are behind it.
- The sprite is the builder's own `CellSprite` in AF's `View3D`, placed by the stage contract's rule (the kit's `place.ts`, held to the
  builder's `stageFrame` by a unit test, perspective and orthographic).

## What ran, and what did not

- Ran (Chromium, this container's software WebGL): the kit's unit suite, its browser suite (3 files, 46 tests, 1 skipped), `characterkit-painted`'s journey (examples-3d project).
- Not run: WebKit and Firefox (neither can be installed in this container), the WebGPU case (no adapter here), the GPU runner: pending for CI.
