# Plan: base-3d art pass (match Emberwick's look)

Spec: [2026-11-01-base-3d-art-direction.md](../specs/2026-11-01-base-3d-art-direction.md). Branch
`claude/3d-art-pass` (stacked on #373). One wide PR. Lane: session_01QYLU1hrGL6WtJhKZasRs8Z.

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
- [ ] 3. base-3d `views/palette.ts` + test (tokens are Emberwick's entries).
- [ ] 4. `views/textures.ts` + test (painters deterministic, sized, palette-only or transparent).
- [ ] 5. `views/dressing.ts` + test (≤ 24 lights, placements inside rooms, out of pits, clear of spawn/embers/goal;
  wall bays cover each side wall).
- [ ] 6. `views/night.ts` (builds and animates; browser test builds it without errors) and `main.ts` wiring; remove
  `buildScene`/`FOG`/`channelBoxes` from `views/index.ts` with their tests moved.
- [ ] 7. `views/ember.ts` (emissive core, point light, halo; goal sparks) + tests.
- [ ] 8. `views/lantern.ts` + test; wired on the hero view.
- [ ] 9. Roll clip from the Studio; markers inside 24 ticks.
- [ ] 10. Route golden unchanged (`c735b5acacbbc716`); gates; acceptance images and README.

## Execution log

- 2026-11-01: spike + spec committed and sent to the coordinator.
