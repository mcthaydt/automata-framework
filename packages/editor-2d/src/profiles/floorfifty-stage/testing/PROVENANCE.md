# Provenance of the stage fixtures

`stages/*.toml` are the four stage files FloorFifty ships, copied byte for byte from `content/stages/` of the
`FloorFifty` repository at commit `ee5d44e` (2026-10-23, "Merge pull request #97 from SNEKPRTY/release/1.0.0-rc.1").
They are the Owner's own game content, used here as read-only test fixtures (2D editor spec FF-D3, FF-o). A refresh is a
re-copy at a newer commit with the diff reviewed; nothing in the editor edits these files.

`stage.schema.ts` is the vendored form of `packages/content/src/schema/stage.ts` at the same commit.

`art-aliases.json` is the sorted list of the 304 asset aliases in `packages/asset-contract/assets/art-manifest.json` of the
same commit (every `bundles.*[].alias`; nothing else of the manifest is copied). The alias checks read it as the loaded
art manifest: all 42 aliases the four stages use are in it.

`tunables.ts` (one folder up) is the vendored form of the tunable declarations in `packages/shared/src/common/tuning.ts` at the
same commit.

`course-goldens.json` and `compose-goldens.json` are not copied from FloorFifty; they are what its code computes, written by
`make-goldens.mjs` (EDFF.1c). The script copies FloorFifty's `rng.ts`, `course.ts`, `demand.ts`, `stage-layers.ts` and
`stage-presentation.ts` at the commit above into a temporary folder, replaces the imports that need a GPU or an image (the
texture provider, haze, window codes, the sun's shimmer filter) with stubs, and runs them on `pixi.js` 8.21.0:

- `course-goldens.json`: `createCourse`, `bounceBudget` and `stepDemands` for nine cases (the seeds of Rooftops, Snow Shrine and
  Sunken Dome, a hundred floors across every ramp band, a steep ramp, other physics, and seeds 0, 4294967295 and
  4294967296 + 12345), plus the first draws of `createRng` and `deriveSeed`.
- `compose-goldens.json`: `StageLayers.update` for each of the four stages at five climb states and four framings, run with
  reduced motion so the lift and the city's sink are at rest. The heights of the strips are chosen, not the art's (the
  script lists them in the file); the framing reads them.

A refresh is `node --experimental-transform-types make-goldens.mjs <FloorFifty checkout>` at a newer commit, then
`pnpm exec biome check --write`, with the diff of the JSON reviewed. Rooftops' step demands in the file agree with the
values FloorFifty's own `demand.test.ts` pins (floor 1 about 0.11, floor 7 about 0.94, floor 19 about 0.84).
