# Plan: base-3d art pass (match Emberwick's look)

Spec: [2026-11-01-base-3d-art-direction.md](../specs/2026-11-01-base-3d-art-direction.md). Branch
`claude/3d-art-pass` (stacked on #373). One wide PR. Lanes: session_01QYLU1hrGL6WtJhKZasRs8Z (steps 0–10), then
session_01QYLU1iRHT7V45nkE1aT4Lg (steps 11–15).

Interfaces consumed: `@pixi/3d` core (`PointLight`, `DirectionalLight`, `PhongMaterial` emissive, `FlatMaterial`,
`ParticleContainer3D`, `Geometry3D`, `View3D` fog/background/environment); render-pixi3d `createPixi3dRenderer`
(`scene` hook, `views`), `Occluders`; the area (`AreaSource`). Produced: `@mcthaydt/automata-content/palette`,
`WallOptions.surface`, base-3d `views/{palette,textures,dressing,night,lantern}.ts`, changed `views/ember.ts`.

## Steps

- [x] 0. Spike and spec (commit 9c6b018a).
- [x] 1. content `./palette` entry. Test first: `packages/content/src/palette/palette-entry.test.ts` imports
  `../../package.json` exports and `./index.ts` from the entry; expect `DEFAULT_PALETTE.colors[45] === '#94fdff'` and
  the entry file importing nothing from the compiler. Fails: no entry. Change: `src/palette/index.ts` re-exporting
  `DEFAULT_PALETTE`, `ENDESGA_64`, type `Palette`; `package.json` `"./palette"`. Then `pnpm api-report --update`,
  patch changeset. Check: `pnpm --filter @mcthaydt/automata-content test`.
- [x] 2. render-pixi3d `WallOptions.surface`. Test first in `occluders/occluders.test.ts`: a wall with
  `surface: { texture, tile: 2 }` gets its own geometry (not the trim's cube) whose +z face UVs span length/2 by
  height/2, a material with that texture, tinted `color`; a wall without it keeps the shared cube; `dispose` destroys
  the per-wall geometry. Change: `occluders/tiled-cube.ts` + `wall()`. Check: `pnpm --filter
  @mcthaydt/automata-render-pixi3d test`.
- [x] 3. base-3d `views/palette.ts` + test (tokens are Emberwick's entries).
- [x] 4. `views/textures.ts` + test (painters deterministic, sized, palette-only or transparent).
- [x] 5. `views/dressing.ts` + test (≤ 24 lights, placements inside rooms, out of pits, clear of spawn/embers/goal;
  wall bays cover each side wall).
- [x] 6. `views/night.ts` (builds and animates; browser test builds it without errors) and `main.ts` wiring; remove
  `buildScene`/`FOG`/`channelBoxes` from `views/index.ts` with their tests moved.
- [x] 7. `views/ember.ts` (emissive core, point light, halo; goal sparks) + tests.
- [x] 8. `views/lantern.ts` + test; wired on the hero view.
- [x] 9. Roll clip from the Studio; markers inside 24 ticks.
- [x] 10. Route golden unchanged (`c735b5acacbbc716`); gates; acceptance images and README.

Lane 2 (coordinator's order: the cap, vertex colour only, the study of the 3D reference game, the five gaps, images):

- [x] 11. render-pixi3d `maxInternalHeight` (G3-x, the coordinator's option (b): a capped internal resolution,
  nearest-upscaled; no letterbox, budget kept at 30 s). Test first: `renderer/capped-view.test.ts` (`cappedViewSize`
  keeps a screen within the cap, scales a taller one to the cap keeping the aspect, whole pixels, at least 1); failed
  on the missing module. Then `parity/capped-view.parity.test.ts`: a 160 × 90 page with `maxInternalHeight: 45` draws
  the view at 80 × 45 and every 2 × 2 block of the canvas is one colour; without the cap the view follows the screen.
  Failed on `expected 160 to be 80`. Change: `renderer/capped-view.ts` (`CappedView`: the view in an offscreen
  container drawn into a resolution-1 nearest `RenderTexture` last in each frame; a sprite stretches it over the page)
  and the option in `create-pixi3d-renderer.ts`; base-3d `main.ts` passes `maxInternalHeight: 360`. Check:
  render-pixi3d node + browsers tests, then G3-x three times.
- [x] 12. ~~Vertex colour only~~ (21d85c0e, reverted in b5600de0): the Owner corrected the brief, "No we still used
  textures, we only used vertex lighting though, no real time" (relayed by the coordinator; it reached this lane after
  the push). In its place, 12b.
- [x] 12b. Baked vertex light only, textures kept (3db0c3f5). render-pixi3d: `tiledCube(span, tile, cell?)` cuts each
  face into cells for the bake (test first: `tiledCube` 6 × 2 × 0.4 at cell 1 has 82 vertices, UVs still in metres;
  failed on the vertex count); `createOccluders(parent, light?)`: with a light every wall and trim is a `FlatMaterial`
  (texture kept) on a cut cube, baked once parented and released on dispose (tests first in `occluders.test.ts`, failed
  on `PhongMaterial`); the renderer hands its light to the occluders (`lighting.parity.test.ts` case first, failed on
  `PhongMaterial`). base-3d: `views/lighting.ts` `nightLighting(area)` (ambient 0.32 moonlight, the moon as a far lamp,
  a lamp per mushroom cluster, a warm goal lamp; `lighting.test.ts` written first but run only after the module:
  deviation) passed as `Pixi3dOptions.lighting`; `buildNight(view, occluders, area, light)` bakes every stone box on a
  textured `FlatMaterial` (`night.test.ts` first: no `PointLight` or `DirectionalLight` and no environment; every
  `night:stone` mesh flat, baked and textured); embers and the lantern lose their PointLights and glow unlit
  (`ember.test.ts`, `lantern.test.ts` first); Wick takes the bake's light at his chest (the figure view's tint).
  `LIGHT_BUDGET` and the `ambientSky` token removed (unused). Textures calmer (`textures.test.ts` first: under 2 % lone
  specks, failed at 14.6 %; the floor 64 px over 4 m, failed on its width).
- [x] 13. Study of the 3D reference game (read at `92e6704`, no code copied); "What we took from the 3D reference game"
  in `docs/spikes/base-3d-art.md`; a provenance row; the spec's lane-2 revision note.
- [x] 14. The gaps (the rim and back fill were real-time lights, removed in 12b; the moon stays). Wick: the hood rim 1.4 → 2.2 and a cool back fill (`BACK_FILL`, moonlight, 1.1 m up and 0.9 m
  behind him) so his cloak reads in the sprite's blue from behind (`lantern.test.ts` and the budget test changed first,
  seen failing; Wick now carries three lights, still inside the budget of 24). The moon painted at 128 px (test first).
  The stone's blue: the ambient sky colour 11 → 41 (`ambientSky`; `night.test.ts` and `palette.test.ts` changed first).
- [x] 15. Same-moment images recaptured (`docs/evidence/owner-visual/2026-11-01-base-3d-art-pass/`, README updated);
  origin/main merged (#373 landed); gates below; report to the coordinator.

## Execution log

- 2026-11-01: spike + spec committed and sent to the coordinator.
- 2026-11-01: steps 1–2 (b2529fc2). Steps 3–8: tests written first and seen failing on the missing module (palette's
  test was written beside its module and not run first: a deviation, recorded here); the trim also takes the
  surface (a pale untextured trim showed in the first game capture, so the occluders test gained the trim case first).
  `tiledCube` exported from render-pixi3d for the night's stone boxes. Old `buildScene`/`channelBoxes`/ceilings dropped
  (the night is open to the sky); `sceneOf` stays for the dressing.
- 2026-11-01: steps 7–8 retuned against game captures (ember glow 0.7 with sparks on every ember, lantern 4 m / 2.2;
  ambient 0.45 over 39, moonlight 0.4). The dressing keeps the valley and the plateau pines and the towers off the
  moon's line (tests seen failing first). Step 9: `roll-tuck` pose and the roll clip with `tuck`/`rise` markers;
  `src/content/roll-clip.test.ts` failed first on the pickup pose and the missing markers. Hand-written in the
  Studio's clip format, not re-saved in the Studio UI (EG-6 updated). Route golden still `c735b5acacbbc716`.
- 2026-11-01: acceptance images in `docs/evidence/owner-visual/2026-11-01-base-3d-art-pass/` with an honest README.
  Deviation: the lava scroll (spec §2) is not built; noted in the spec as a follow-up.
- 2026-11-01: gates. `TURBO_FORCE=true pnpm check` exit 0; base-3d `test:parity` 96/96; render-pixi3d `test:parity` 36
  passed, 21 skipped (`runIf(hasWebGL2)` blocks, environment); `build:examples`, `build:demos` 0; api-report updated
  (content `./palette`, render-pixi3d `WallOptions`), cheatsheet and agent skill rewritten; changesets 0 problems.
  base-3d e2e (`--project=base-3d`): G3-x first failed at 31.3 s (30 s budget) while #373's head passed it at 20.8 s;
  merged the mushrooms (`views/mushrooms.ts`, test first), bays of ~4 m and one particle container an ember; then 7/7,
  G3-x at 29.6, 28.7 and 28.1 s. The test budget was not changed. Frame cost about 190 vs 90 ms on software rendering.
- 2026-11-01: coordinator's review (exposure, Wick). Cloak swatch 41 → 42 (the sprite's lit tone); a cool rim light
  rides over Wick (lantern test seen failing first); lantern 4.5 m / 3; fill 0.6, moonlight 0.55. Light budget test
  counts Wick's two. Images recaptured; spec and README updated.
- 2026-11-01: coordinator's second review (not accepted at ccf350bf: grey bands, enclosed corridor, palette, Wick,
  red channels). Done: the view fills the page (no letterbox: `logicalWidth/Height` undefined in main.ts); the ruin
  floats in the night (sky below the horizon too, fog and below-sky in 40), low bays 0.5–1.3 m and pillar stubs, near
  wall a 0.9 m parapet, silhouette islands far off and below, a 16 m moon high on the right; the channels are gaps onto
  the sky with teal rims (lava and its lights removed); grass and moss in Emberwick's 34–37; Wick's hood points.
  Tests changed first and seen failing (dressing, night, palette). G3-x: 31.6, 31.7, 31.6 s with the full-frame view;
  26.6 s with the letterbox put back temporarily (same scene). Budget not raised; reported.
- 2026-11-01 (lane 2): step 11. G3-x on this container, same scene, `--repeat-each=3`: uncapped (full-frame view)
  32.3 s ✘, 32.2 s ✘, 23.5 s; with `maxInternalHeight: 360` 18.0, 18.1 and 11.3 s, all passing. The 30 s budget is
  unchanged. At the e2e's 844 × 390 at resolution 2 the view shades 779 × 360 pixels instead of 1688 × 780.
- 2026-11-01 (lane 2): step 12, three looks captured against the 2D. Smooth Gouraud blends (shared vertices) read as
  blurred murk with featureless walls; flat half-metre cells as a coarse patchwork; flat quarter-metre cells over a
  narrower tone range read as Emberwick's pixel mosaic, so that one stayed. The stone still reads greyer than the 2D's
  blue under the night light: step 14.
- 2026-11-01 (lane 2): step 14 captured against the 2D: with the ambient sky 41 the stone reads blue-violet like the
  2D platforms (it read grey under 11), and Wick reads in his cloak's blue from behind. Deviation: `palette.test.ts`
  pinned `ambient: 11` as an Emberwick role; the 3D light departs from it on purpose, so the test names the new token
  and why.
- 2026-11-01 (lane 2): gates after merging origin/main. `pnpm install --frozen-lockfile` 0; `pnpm format` 0;
  `TURBO_FORCE=true pnpm check` first failed on `@mcthaydt/api-report` (the render-pixi3d report was stale: expected,
  the API changed); after `pnpm build`, `pnpm api-report --update` (render-pixi3d: `cellCube`, `CellColor`,
  `CellOptions`, `maxInternalHeight`, `WallOptions.paint`; `tiledCube` and `surface` gone) it exits 0. `pnpm api-index`
  0 (cheatsheet current), `pnpm agent-skills` current. `changeset status --since=origin/main` lists releases;
  `check-changesets` 14 changesets, 0 problems (render-pixi3d is private: no changeset). render-pixi3d `test:parity` 40
  passed, 23 skipped (`runIf(hasWebGL2)`: headless Firefox here has no WebGL2); base-3d `test:parity` 96/96.
  `build:examples` 0, `build:demos` 0. base-3d e2e 7/7, G3-x 13.6 s. Route golden `c735b5acacbbc716` unchanged (the sim
  is untouched).
- 2026-11-01 (lane 2): the coordinator's corrections reached this lane after the push of 46299b06 (the cross-session
  queue): keep textures, light only with baked vertex light. Reverted 21d85c0e (b5600de0) and did 12b (3db0c3f5).
  Captures against the 2D: the baked moonlight keeps the stone blue and the mushrooms pool cyan on the walls; the
  speckled moss read as noise, so the textures were calmed, then the 2 m moss tile repeated as a grid, so the floor is
  64 px over 4 m. base-3d e2e 7/7 with G3-x at 8.0 s (no real-time lights). Wick reads as a flat tinted silhouette:
  his light is one tint at the chest (a remaining gap).
- 2026-11-01 (lane 2): gates after 12b and merging origin/main. `pnpm build` 0; `pnpm api-report --update`
  (render-pixi3d: `tiledCube(span, tile, cell?)` and `WallOptions.surface` back, `cellCube`/`paint` gone);
  `TURBO_FORCE=true pnpm check` 0; `check-changesets` 17, 0 problems; render-pixi3d `test:parity` 42 passed, 24 skipped
  (`runIf(hasWebGL2)`, headless Firefox); base-3d `test:parity` 96/96; `build:examples` 0, `build:demos` 0; base-3d e2e
  7/7, G3-x 8.2 s. Route golden `c735b5acacbbc716` unchanged.
