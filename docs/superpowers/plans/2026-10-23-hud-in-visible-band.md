# EX.4 follow-up: two example HUDs in the band a wide phone shows TDD plan

- **Spec:** [EX spec](../specs/2026-10-16-examples-one-file-design.md) §5 (smoke at Pixel 7 and 780 × 270); AGENTS.md "Responsive UI" (preserve essential state through compact height and look at the screenshots at phone sizes first).
- **Task:** `Follow-up (found in EX.4) — Move two example HUDs into the band a wide phone shows` (02). Lane examples.
- **Status:** drafted 2026-10-23, stacked on the render-filter branch (it carries the row). No PR is opened until the shared runner's queue drains.
- **Progress:** 0 of 3 steps.

## What is wrong

On a wide landscape phone (Pixel 7 landscape, 780 × 270) the 320 × 180 playfield is scaled to the width, so only the band from about y = 35 to y = 145 shows. `render/render-quality.ts` draws its HUD at y = 4 and `shapes/shapes-draw-hud.ts` draws its text bar at y = 160 and its mini-map from y = 136 to y = 172: all outside the band. A reader on such a phone sees an example whose point is its HUD with no HUD.

## Decisions

- **Move, do not shrink.** The HUD text keeps its size and the mini-map its 64 × 36 box. They move to y = 40 (`render-quality`) and to y = 126 (text bar, 14 high) and y = 104 (mini-map, bottom left), which sit inside the band at both sizes and clear of the Pause button at the top right.
- **No framework change here.** The row asks whether `DrawContext` should expose the visible band. That is a public API question for the Owner; the examples carry a one-line comment naming the band until it is answered.
- **The failing test is a pixel measurement.** There is no unit-level seam for "is this drawn inside the part of the screen a phone shows". The check boots each example through the runner in Chromium at 780 × 270 and at Pixel 7 portrait and counts the pixels of the HUD box's colour (`0x2e222f`) in the screenshot: zero means cropped. It is a scratch script, not committed; the catalog test and typecheck stay the committed gate.

## Files

- **Modify:** `examples/render/render-quality.ts`, `examples/shapes/shapes-draw-hud.ts`; this plan; `docs/02-master-delivery-plan.md` (the follow-up row).
- No golden changes: `draw` never writes the sim, and `shapes-draw-hud`'s golden is the sim's.

## Steps

- [ ] **1. Red.** On the unchanged files, count the HUD box's pixels at both sizes for both examples. Expect zero at 780 × 270 and many in portrait.
- [ ] **2. Move the HUDs.** Edit the two files; count again (non-zero at both sizes) and read the screenshots at both sizes, checking the HUD, the mini-map and the Pause button do not overlap.
- [ ] **3. Gates.** `pnpm format`, `pnpm check` (the catalog test and the examples' typecheck among them), `pnpm build:examples`; the parity golden for `shapes-draw-hud` in Chromium.

## Gates

- Selected: `pnpm check`; `pnpm build:examples`; the examples-runner golden parity in Chromium; the pixel counts and screenshots above.
- Omitted here, pending on CI: WebKit and Firefox parity and the smoke projects.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | | |
