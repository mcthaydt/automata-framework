# ED2D.8c: level names the World map's pictures do not swallow

**Row:** `docs/02-master-delivery-plan.md` ED2D.8 (a follow-up of ED2D.8b, #332, on whose branch this is built). Lane
**editors**. Size S. Accepted under the Owner's "Auto accept all spec and plans".
**Spec:** [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §8 (the World row). Mockup `world`.
**Coordinator follow-up (review of #332):** the level names are hard to read over busy pictures: "give each a backing
plate (a Graphics rect behind the Text), or move the name above the rectangle."

## Decisions (veto-defaults)

1. **A plate, not a move.** Each level's name sits on a rounded plate in `bg/surface` (opaque) in the rectangle's
   top-left corner, drawn over the picture and under the name, the way the level canvas draws its link chips. Above
   the rectangle the name would collide with the level stacked over it, so it stays inside. The plate's size follows
   the text at screen size; it is not clipped to the rectangle (a name was never clipped).

## Files

**Modify:** `packages/editor-2d/src/canvas/world-view.ts` (a `plates` Graphics between the outlines and the labels),
`packages/editor-2d/src/canvas/world-view.canvas.test.ts` (the plate over a picture).
**Interfaces:** none produced or changed. No published package, so no changeset.

## Steps

- [x] 1. Red: a Chromium canvas test renders a pictured level named `Village` (red background) and expects the pixel
  just inside the plate's padding, left of the first glyph, to be `bg/surface`, not the picture's red. Fails: it is red.
- [x] 2. Green: the plate. The four existing world-view canvas tests still pass.
- [x] 3. Review images: `world-view.layout.test.ts` (Chromium) shots beside the `world` mockup in
  `docs/evidence/owner-visual/2026-10-31-ed2d-8c/` with a README of differences.
- [x] 4. Gates: biome, `pnpm format`, `TURBO_FORCE=true pnpm check`; the editor-2d layout run in three browsers.

## Execution log
- 2026-10-31, step 1: red in Chromium and WebKit: the pixel was `#f1e0e0` and `#f0e3e3` (the name's glyph over the red picture), not `bg/surface`.
- 2026-10-31, step 2: the plate (`plates`, a `Graphics` between the outlines and the labels). `world-view.canvas.test.ts` 10 of 10 (Chromium and WebKit).
- 2026-10-31, step 3: Chromium layout 8 of 8; images in `docs/evidence/owner-visual/2026-10-31-ed2d-8c/` with ED2D.8b's image of the same view as the before.
- 2026-10-31, step 4: biome and `pnpm format` clean. `TURBO_FORCE=true pnpm check`: lint, typecheck, boundaries, style and knip passed; the first run's unit tests failed only in `tooling/repo-hygiene` `gitleaks.test.ts` ("several installs at once, in separate processes": a truncated archive, `tar: Unexpected EOF`) while the machine ran other lanes' work; that file alone passes 13 of 13 (preserved as first-attempt evidence, not a product assertion; this branch does not touch repo-hygiene). editor-2d `world-view.layout.test.ts` in the layout project (Chromium, WebKit, Firefox): 24 of 24; `world-view.canvas.test.ts` (canvas project, Chromium and WebKit): 10 of 10.
