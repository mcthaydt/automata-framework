# EX.4 follow-up: two example HUDs in the band a wide phone shows TDD plan

- **Spec:** [EX spec](../specs/2026-10-16-examples-one-file-design.md) §5 (smoke at Pixel 7 and 780 × 270); AGENTS.md "Responsive UI" (preserve essential state through compact height and look at the screenshots at phone sizes first).
- **Task:** `Follow-up (found in EX.4) — Move two example HUDs into the band a wide phone shows` (02). Lane examples.
- **Status:** drafted and implemented 2026-10-23, locally checked, stacked on the render-filter branch (it carries the row). No PR is opened until the shared runner's queue drains.
- **Progress:** 3 of 3 steps.

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

- [x] **1. Red.** On the unchanged files, count the HUD box's pixels at both sizes for both examples. Expect zero at 780 × 270 and many in portrait.
- [x] **2. Move the HUDs.** Edit the two files; count again (non-zero at both sizes) and read the screenshots at both sizes, checking the HUD, the mini-map and the Pause button do not overlap.
- [x] **3. Gates.** `pnpm format`, `pnpm check` (the catalog test and the examples' typecheck among them), `pnpm build:examples`; the golden for `shapes-draw-hud` (the runner's Node replay is part of `pnpm check`).

## Gates

- Selected: `pnpm check`; `pnpm build:examples`; the pixel counts and screenshots above.
- Omitted here, pending on CI: the golden's Chromium, WebKit and Firefox replays (`draw` never writes the sim, so the golden cannot move, but the claim is CI's to confirm) and the smoke projects.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | `64dd2ea` | |
| 2026-10-23 | 1 | | Red, on the unchanged files, Chromium with swiftshader through the runner (`vite build` + preview, the fake host beside it): HUD-box pixels (`0x2e222f`) at 780 × 270 were 0 for `render-quality` and 0 for `shapes-draw-hud`; in Pixel 7 portrait 14,100 and 10,693. |
| 2026-10-23 | 2 | | `render-quality`'s bar moved from y = 4 to y = 40; `shapes-draw-hud`'s text bar from y = 160 to y = 126 and its mini-map from y = 136 to y = 104, each with a comment naming the band. Same measurement after a rebuild: 68,327 and 44,755 at 780 × 270, 14,664 and 10,258 in portrait. The screenshots at 780 × 270 were read: the bar sits at the top left below the top edge, the mini-map at the bottom left and the text bar at the bottom right, whole, and the Pause button at the top right overlaps none of them; the squares still drift and bounce across the field. Not promoted as baselines. |
| 2026-10-23 | 3 | | `pnpm format` (no fixes); `TURBO_FORCE=true pnpm check` 30 of 30 tasks, exit 0 (the catalog test and the examples' typecheck among them, and the runner's Node golden replay); `pnpm build:examples` built every example. |
