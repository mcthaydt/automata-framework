# The Last Light salvage: the framework and kit work that is not the game (2026-11-13)

EXECUTION session, no subagents. The Owner scrapped The Last Light ("scrap the last light; we'll do a brand new microgame with
same features; a systemic horror game"). Its folder `games/the-last-light/` does not go to main. This branch,
`claude/last-light-salvage`, brings the generic framework and kit work that was built on the game's branches to main's line,
without the game.

Sources (none is on main): `claude/last-light-prologue` (`61070fa98`, the joined branch), `claude/last-light-camera-back`
(`7c207cd6e`), `claude/last-light-ada-build` (`7c0a4ca3a`), `claude/last-light-atmosphere` (`642034977`, notes only).
The prologue's merge base with main is `28d72fb54` (PR #668); main has moved on by PRs #669 and #670 since (the builders' tile
fixtures in world-kit, the evidence tooling, the sim snapshot codec).

## Step 1: the map

`git diff --stat origin/main...<branch>` outside `games/the-last-light/`:

| Source | Files outside the game | Generic code, tests, config | Notes and shots (not carried as files) |
|---|---|---|---|
| prologue over main | 578 | 222 (this map) | 356 under `docs/superpowers` |
| camera-back over prologue | 14 | 6: `play-fit`, the kit's density | 8 (frames, notes) |
| ada-build over prologue | 14 | 6: `extensions/figures` seat and thighs | 8 (frames, notes) |
| atmosphere over camera-back | 2 | 0 | 2: the original's lights and passes, measured |

Files changed on both main (since `28d72fb54`) and the prologue: `biome.json`, `docs/provenance/sources.md`,
`docs/superpowers/progress.md`. All three are the game's (its generated-content ignore, its provenance entry, the tracker).
None is carried, so a path-level carry cannot undo anything main did.

### How each group is carried

A path-level carry: the branch history is interleaved with the game's, so no commit can be cherry-picked whole. Each group is
`git checkout origin/claude/last-light-prologue -- <paths>` (or the later branch for its own files), reviewed, scrubbed of the
game's name and ties, and committed with the source commits named in its body.

### The generic changes, in feature groups

"Tie" is what, inside the game's folder or its name, the piece leans on. "Changeset" is the package's own (`@automata/framework`,
`audio-synth` and `ui-screens` are published and share one version; the others are private and take none).

| # | Feature | Packages | Source commits | Tests it brings | Changeset | Tie to the game |
|---|---|---|---|---|---|---|
| F1 | Screen-pixel post-filter slot: `postFilter(name, { at: 'screen' })`, the stage's `screenFilters`, `uScreenScale`, `uScreenOrigin` | `packages/automata` | 5fda1960b | `post-filter.test.ts`, `renderer.test.ts` | `screen-post-filters` | none |
| F2 | `lcdPanelScreenFilter`: the LCD mesh, stripes and scanlines as a screen filter (needs F1) | `extensions/lcd-panel` | cf6a1bb3e | unit `lcd-screen`, Chromium and webgpu `lcd-screen*` | none (private) | none (adds the `@automata/framework` peer) |
| F3 | The letterbox's whole scale keeps a landscape field inside the view | `packages/automata` | 784aa1dd5 | `letterbox.test.ts` | `letterbox-whole-landscape-height` | none; **may move a 2D picture: checked in step 4** |
| F4 | `inputs()` accepts a map whose only touch input is a stick and a drag | `packages/automata` | 9eb278355 | `keys.analog.test.ts` | `inputs-stick-and-drag-only` | none |
| F5 | A play-screen component reads `usePlay().inputMethod`; `mountInPlay` and `noteInputMethod` | `packages/automata` | fa4967848 | `play-context.svelte.test.ts` and a probe fixture | `play-handle-input-method` | none |
| F6 | Camera turn input: the drag takes either mouse button, `turnUnitsFromStick`, `CameraDragSurface` | `packages/automata` | f184d89c7 (the framework half) | `camera-turn`, `camera-drag-tracker`, `camera-drag-surface.svelte`, `keys.analog` | `camera-drag-either-button` | none (its game half, the Q and E removal, stays) |
| F7 | The opt-in camera yaw plugin, its `camera-yaw` sim command and view latch; the painted figure's `facing-hold` | `packages/3d` `features/camera/sim`, `extensions/character-kit` | f184d89c7 (the 3d and kit half) | `camera-yaw.system`, `view-latch`, `facing-hold` | none (private) | none |
| F8 | `lensMm`, `focusBounds`, `lead` on a camera view; the follow camera's pose | `packages/3d`, `packages/editor-3d` | a162c8f9d | `angled-camera`, `framing`, `play-camera`, `camera-view.schema`, editor-3d `follow-camera` | none | none |
| F9 | The `peekReach` cap, `fitFocus`, the play fit derived from the walkable floor and the sprite, any heading; the camera-back fix (`fitFocus`'s `peekReach` ignored the box inset and wrote -0) | `packages/3d` | 189c02895, a83c54c12, adb26c007; camera-back f16a7fa70 | `play-fit.test.ts`, `angled-camera.test.ts`, `occluder-pass.test.ts` | none | test comments name the game |
| F10 | The occluder rule for tall props, bulkheads, steps, frames, bands and decor; it follows the camera that is drawing (`DrawingCamera`, `DrawingCamera.subject`); a shot keeps its own figure in sight; the world builder's wall helpers move to `wall-parts.ts` | `packages/3d`, `games/base-3d` test | 040387409, fb1707d72, f84df11df, 4b025a77f | `occluder-rule`, `occluder-pass`, `occluders`, `world-view`, `build`, base-3d `scene` | none | test comments name the game |
| F11 | `Director.cameraAt(t)`: a pure look-ahead of a cutscene's camera; the caption can take the game's typing | `extensions/cutscenes` | f23d6e4bc, 0b7d6d2f7 | `director.test.ts`, `caption.test.ts` | none | none |
| F12 | A prop names a model that replaces its blockout on screen (`af-sector-2` prop `model`); a model takes the room's baked light; a model's texture is sampled by the nearest texel | `packages/3d`, `packages/editor-3d` test | 2b3fcfa08, 56c1e7cbe, 2a26ac480 | `prop-model`, `prop-models`, `world-view-models`, `load-models`, editor-3d `prop-model-codec` | none | none; **nearest sampling may move a model picture: step 4** |
| F13 | Contact darkening on a lamp's light, opt in, with its strengths as parameters | `packages/3d` | eeecd04f1 | `occlusion`, `vertex-bake` | none | none |
| F14 | The dither weighs by luma and tapers in the blacks; the retro grade may sit after the snap | `packages/3d`, `extensions/retro-crisp` | 5735e67c0 | `dither-weight`, `grade-position` | none | none |
| F15 | A window's moonlight patch on a floor (the light patch) | `packages/3d` | a32b497c6 | `light-patch.test.ts` | none | none |
| F16 | audio-synth: a cue takes a `gain`; a cue that names a recorded `sound` plays it | `extensions/audio-synth` | 2e65aec91, abb9a3c6d | `audio.schema`, `mixer`, `audio-stage` | `audio-synth-cue-gain`, `audio-synth-recorded-cue` | none |
| F17 | narrative: a line with delivery beats compiles under the lines content kind | `extensions/narrative` | d274894b2 | `words.test.ts` | none | none |
| F18 | ui-screens: `@automata/ui-screens/content`, the credits kind without Svelte | `extensions/ui-screens`, `site/playground` | 1275f701b | `content-entry`, `entries` | `ui-screens-content-entry` | none |
| F19 | world-kit: an optional joint colour on a photo-made tile swatch; a joint closed across a short break; `albedo-tiles` | `extensions/world-kit` | 624d5c4fe, 3c3f5276e, 9e22ace81 | `joint`, `albedo-tiles` | none | none; **main moved in the same package, merged by file** |
| F20 | character-kit: the painted figure's density (`'auto'`, a function asked each frame, `densityNeeded`), `grid: true`, the room's dimmest step (`dimmest`), `holdSkinHue`, `skinColours`, `paintedTones` and the skin-hue fixes | `extensions/character-kit` | 76c148348, 8db048406, 2a92304aa, 620c18808, 8d8f56a30, d4df32b69, f69303f35, 1ba72ba23; camera-back acfda274e | `density`, `auto-painter`, `place`, `room-light`, `skin-hue`, browser `painted-density`, `painted-grid` (+ webgpu), `painted-lit`, `painted-depth` | none | comments name the game; **the density default may move recorded cells: step 4** |
| F21 | character-kit: new hair, face and garment pieces: the bob and loose hair, hair over the face, a low cap, `eyeMarks`, an open waistcoat, a shirt, stockings, a belt, a boot's shaft, trousers split from `shells.ts` | `extensions/character-kit` | 9607d2721, ae98c7201, 6abfc17ee, c2d4da698, 4691bc8f1, 66f52482b, 6db38f66c, ebe0d7381, fc2cf92c3, 2b7c1d474, 97c9ed611, 00087de63, 1c9484cf2 | `hair-bob`, `accessories`, `cut`, `ada-pieces`, `shirt`, `vest-v`, `boot-shaft`, `eye-marks`, `legs-default`, `skirt-default`, `waistcoat-default` | none | file `ada-pieces.test.ts` is named for the game's cast: check it |
| F22 | character-kit testing helpers: paint a character in Node and count a swatch's texels, sheets, `proportions` | `extensions/character-kit` `src/testing`, `entries/testing.ts` | 9c8f50d92, a76c7863e, a99db7a94 | `painted-frames`, `raster`, `proportions` | none | the `scripts/` that use them read the game's cast: left out |
| F23 | figures: the held skin colour in the paint budget (the kit's stand-ins), `contract.md` | `extensions/figures` | 1ba72ba23 | `api.test.ts` | none | contract.md names the game |
| F24 | figures: the `seat` slider reaches lower; a new `thighs` slider | `extensions/figures` | ada-build 830308e38, 63be52ae9 | `thighs.test.ts`, `bust-seat.test.ts`, `fit.test.ts` | none | none |
| F25 | Generated files that go with the above: API reports, the cheatsheet, the agent package's API reference | `tooling/api-report`, `docs/cheatsheet.md`, `agents/` | 4eddc7b8e, 4014cd779, and the exports of the rows above | regenerated, not carried | n/a | n/a |

### Left behind, with the reason

| Piece | Why |
|---|---|
| `games/the-last-light/` (the game, its content, its journeys) | The decision. |
| `extensions/character-kit/scripts/` `ada-*.ts`, `figure-looks`, `figure-variants`, `figure-sheet`, `figure-rebuild`, `figure-reference`, `figure-framing`, `figure-proportions` and their `package.json` scripts | They import the game's cast and swatch files (`games/the-last-light/src/features/figures/*`). Studies of Ada, not a capability. The helpers they use are F22. |
| `extensions/character-kit/tests/unit/scripts/*.test.ts` | They test those scripts. |
| `docs/guides/hotspots-and-the-play-hud.md`, its index row and the site's two guide tests | The guide quotes the game's own files. A guide for the new game replaces it. |
| `.github/workflows/3d.yml`, `biome.json`, `knip.jsonc`, root `package.json`, `pnpm-lock.yaml` entries for the game, `tooling/repo-hygiene` (the title is no longer withheld), `docs/provenance/sources.md` | The game's wiring. The workflow is also not to be changed here. |
| `docs/superpowers/progress.md` and every audit folder's frames | Main's tracker stays. The rows are in "For the tracker" below. |
| The game's own lights and passes (`lookOf`, its `lit: false`, the LCD and retro settings it chose) | The game's. |

## For the tracker

(Filled in as the work lands; the rows are the Owner's to paste.)

## Where the work stands (resume point)

Steps 1 to 3 are done and pushed: the map, the carry (every group above, one or more commits each) and the ties cut.

**One carried change was not opt-in and is changed here.** In the source the painted figure's `density` defaulted to `'auto'`, which
moves every figure's cell. Here a figure that names no density is painted at 2, as on main, and `'auto'` is asked for. The kit's
Chromium and webgpu browser suites are otherwise unchanged (only `painted-density.test.ts`, which asked for the default, now asks for
`'auto'`, and has a test of the default).

**Not yet run (step 5 and the trial merges' last part):** `TURBO_FORCE=true pnpm check` was started and its result is in the final
report; after it: `pnpm build`, `pnpm api-report --update` and `pnpm api-index --write` (commit what they write), then the
packages/3d unit, Chromium browser and webgpu-software suites, the figures Chromium goldens, the world-kit and lcd-panel Chromium
suites, the base-3d and examples-3d e2e in Chromium. A resuming session starts with those, in that order.

## Trial merges (not pushed, in a scratch worktree)

Against `origin/claude/pixi-3d-public`: 5 conflicts.

| File | The conflict |
|---|---|
| `extensions/lcd-panel/package.json` | Peers: this branch adds `@automata/framework` (for the screen filter); that branch moves `@pixi/3d` to beta.3 and `pixi.js` to 8.23.0. Keep both. |
| `extensions/lcd-panel/vitest.config.ts` | Both rewrite the project list and the header comment (this branch's one `browser` project over `.`, with the screen filter's WebGL2 and WebGPU cases; that branch splits `pass` and `webgpu` folders). Needs the test files laid out one way. |
| `packages/3d/src/app/world-view.ts` | Imports only: this branch adds `FlatMaterial`, `ModelInvalid`, `toSrgb` and the model library types; that branch adds `UnlitMaterial`. Keep both and check the model mesh uses the unlit material. |
| `packages/3d/src/features/look/duel-snap-filter.ts` | The constructor: this branch adds the dither's `lumaWeight` and `shadowTaper` options; that branch adds `{ stage: 'afterToneMapping' }` to `super()`. Both apply. |
| `packages/3d/src/shared/render/light/vertex-bake.ts` | Top of the bake: this branch adds the contact darkening's `lampShare` and `lampOpen`; that branch adds `engineColour(extras)`. Both apply. |

Against `origin/claude/3d-night-regression`: 1 conflict, `packages/3d/src/app/create-renderer.ts` (this branch passes `width` and
`drawing` to `occluderHooks`; that branch adds `hazeFocusHooks` after it; both apply). Merged after `pixi-3d-public` the same file
still conflicts and nothing else does. Either order works; the only file both touch is `create-renderer.ts`.
