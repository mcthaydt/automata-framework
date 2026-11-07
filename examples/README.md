# Examples

Two packages, one per dimension. Each file is one example of one feature.

- [`2d/`](2d/) (`@af-examples/examples-2d`): the 2D examples, run by `pnpm examples` (the index) and checked by their
  journeys in `2d/tests`. They are public: nothing here reaches the 3D packages.
- [`3d/`](3d/) (`@af-examples/examples-3d`): the 3D renderer's and the procedural figures' examples, run by
  `pnpm examples:3d` and checked by their journeys in `3d/tests` in the 3D workflow.

Emberwick, the 2D game, is in [`games/emberwick`](../games/emberwick/); the 3D game is in
[`games/base-3d`](../games/base-3d/). Art keeps to the [art direction](../docs/art/README.md) and its DUEL colour palette.

A file starts with a header (what it shows, its controls, its base and its packages), and the catalog test checks it.

| Example | What it shows |
|---|---|
| [`2d/audio/audio-sound.ts`](2d/audio/audio-sound.ts) | A chime that plays when the game says so |
| [`2d/content/hot-reload/main.ts`](2d/content/hot-reload/main.ts) | the room as a content file, edited while the game runs |
| [`2d/core/core-basic-window.ts`](2d/core/core-basic-window.ts) | A game window with a coloured field and a line of text |
| [`2d/core/core-camera-2d.ts`](2d/core/core-camera-2d.ts) | A camera that follows a square around a world bigger than the screen |
| [`2d/core/core-host-lifecycle.ts`](2d/core/core-host-lifecycle.ts) | The game stops and pauses while its tab is in the background |
| [`2d/core/core-input-gamepad.ts`](2d/core/core-input-gamepad.ts) | Move a square with a controller |
| [`2d/core/core-input-keys.ts`](2d/core/core-input-keys.ts) | Move a square with the keyboard, a controller or touch |
| [`2d/core/core-input-rebind.ts`](2d/core/core-input-rebind.ts) | Change a control in Settings, and keep it next time |
| [`2d/core/core-input-touch.ts`](2d/core/core-input-touch.ts) | Steer a square by swiping, and flick down to drop it |
| [`2d/core/core-leaderboard.ts`](2d/core/core-leaderboard.ts) | Each run's score on a leaderboard, shown when you pause |
| [`2d/core/core-saves.ts`](2d/core/core-saves.ts) | Three save slots, and progress kept while you play |
| [`3d/figures/figures-aim.ts`](3d/figures/figures-aim.ts) | Wick turning his head, chest and right hand to follow an orb circling him |
| [`3d/figures/figures-clips.ts`](3d/figures/figures-clips.ts) | Wick walking back and forth along a line with clips played over the walk: a reach, a look and a flinch |
| [`3d/figures/figures-outfits-items.ts`](3d/figures/figures-outfits-items.ts) | one figure changing outfits and the item in its hand |
| [`3d/figures/figures-poses.ts`](3d/figures/figures-poses.ts) | Wick taking each pose of a small library in turn, a clip blending him into it |
| [`3d/figures/figures-walk.ts`](3d/figures/figures-walk.ts) | Wick, a procedural figure, walking a loop under the angled camera |
| [`2d/render/render-filter.ts`](2d/render/render-filter.ts) | Two filters over the whole picture, chosen by graphics quality |
| [`2d/render/render-interpolation.ts`](2d/render/render-interpolation.ts) | A square that moves smoothly between the game's steps |
| [`2d/render/render-quality.ts`](2d/render/render-quality.ts) | Switch the graphics quality while squares drift by |
| [`3d/render3d/render3d-angled-camera.ts`](3d/render3d/render3d-angled-camera.ts) | the angled camera, cut-away walls and a fading pillar |
| [`3d/render3d/render3d-lighting-fog.ts`](3d/render3d/render3d-lighting-fog.ts) | baked lamp light, a lit walker and fog in a 3D room |
| [`3d/render3d/render3d-meshes.ts`](3d/render3d/render3d-meshes.ts) | lit boxes and model files in a 3D view |
| [`2d/shapes/shapes-draw-hud.ts`](2d/shapes/shapes-draw-hud.ts) | A score line and a mini-map drawn over bouncing squares |
| [`2d/shapes/shapes-rects.ts`](2d/shapes/shapes-rects.ts) | Rectangles that move, slide and spin |
| [`2d/textures/textures-atlas.ts`](2d/textures/textures-atlas.ts) | Pictures cut from one packed image |
| [`2d/textures/textures-sprite.ts`](2d/textures/textures-sprite.ts) | A character animated from a sheet of frames |
| [`2d/ui/primitives/main.ts`](2d/ui/primitives/main.ts) | every ui primitive at every reference size, with no renderer |

`2d/content/hot-reload` and `2d/ui/primitives` are small packages with their own `package.json`; the rest are single files.
