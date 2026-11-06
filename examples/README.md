# Examples

Two packages, one per dimension. Each file is one example of one feature.

- [`2d/`](2d/) (`@af-examples/examples-2d`): the 2D examples, run by `pnpm examples` (the index) and checked by their
  journeys in `2d/tests`. They are public: nothing here reaches the 3D packages.
- [`3d/`](3d/) (`@af-examples/examples-3d`): the 3D renderer's and the procedural figures' examples, run by
  `pnpm examples:3d` and checked by their journeys in `3d/tests` in the 3D workflow.

Emberwick, the 2D game, is in [`games/emberwick`](../games/emberwick/); the 3D game is in
[`games/base-3d`](../games/base-3d/). Art keeps to the [art direction](../docs/art/README.md) and its Endesga 64 colour palette.

A file starts with a header (what it shows, its controls, its base and its packages), and the catalog test checks it.

| Example | What it shows |
|---|---|
| [`2d/audio/audio-sound.ts`](2d/audio/audio-sound.ts) | a chime on a sim event |
| [`2d/content/hot-reload/main.ts`](2d/content/hot-reload/main.ts) | the room as a content file, edited while the game runs |
| [`2d/core/core-basic-window.ts`](2d/core/core-basic-window.ts) | open a game window |
| [`2d/core/core-camera-2d.ts`](2d/core/core-camera-2d.ts) | a camera that follows a square around a world bigger than the screen |
| [`2d/core/core-host-lifecycle.ts`](2d/core/core-host-lifecycle.ts) | the sim stands still while the host has the game in the background |
| [`2d/core/core-input-gamepad.ts`](2d/core/core-input-gamepad.ts) | move a square with a controller |
| [`2d/core/core-input-keys.ts`](2d/core/core-input-keys.ts) | move a square with the keyboard, a pad or touch |
| [`2d/core/core-input-rebind.ts`](2d/core/core-input-rebind.ts) | rebind a control in Settings, and keep it next time |
| [`2d/core/core-input-touch.ts`](2d/core/core-input-touch.ts) | steer a square by swiping, and flick down to drop it |
| [`2d/core/core-leaderboard.ts`](2d/core/core-leaderboard.ts) | a run's score goes to the host's leaderboard, and paused shows the board |
| [`2d/core/core-saves.ts`](2d/core/core-saves.ts) | three save slots on the title, and progress kept while you play |
| [`3d/figures/figures-aim.ts`](3d/figures/figures-aim.ts) | Wick turning his head, chest and right hand to follow an orb circling him |
| [`3d/figures/figures-clips.ts`](3d/figures/figures-clips.ts) | Wick walking back and forth along a line with clips played over the walk: a reach, a look and a flinch |
| [`3d/figures/figures-outfits-items.ts`](3d/figures/figures-outfits-items.ts) | one figure changing outfits and the item in its hand |
| [`3d/figures/figures-poses.ts`](3d/figures/figures-poses.ts) | Wick taking each pose of a small library in turn, a clip blending him into it |
| [`3d/figures/figures-walk.ts`](3d/figures/figures-walk.ts) | Wick, a procedural figure, walking a loop under the angled camera |
| [`2d/render/render-filter.ts`](2d/render/render-filter.ts) | two screen-space filters over the picture, and the quality tier that decides which run |
| [`2d/render/render-interpolation.ts`](2d/render/render-interpolation.ts) | a square drawn between sim ticks, beside a line where the sim says it is |
| [`2d/render/render-quality.ts`](2d/render/render-quality.ts) | switch the graphics quality tier while squares drift across the field |
| [`3d/render3d/render3d-angled-camera.ts`](3d/render3d/render3d-angled-camera.ts) | the angled camera, cut-away walls and a fading pillar |
| [`3d/render3d/render3d-lighting-fog.ts`](3d/render3d/render3d-lighting-fog.ts) | baked lamp light, a lit walker and fog in a 3D room |
| [`3d/render3d/render3d-meshes.ts`](3d/render3d/render3d-meshes.ts) | lit boxes and model files in a 3D view |
| [`2d/shapes/shapes-draw-hud.ts`](2d/shapes/shapes-draw-hud.ts) | a HUD and a mini-map drawn each frame over bouncing squares |
| [`2d/shapes/shapes-rects.ts`](2d/shapes/shapes-rects.ts) | rectangles that move, slide and spin |
| [`2d/textures/textures-atlas.ts`](2d/textures/textures-atlas.ts) | sprites drawn from a packed atlas |
| [`2d/textures/textures-sprite.ts`](2d/textures/textures-sprite.ts) | an animated sprite from a sprite sheet |
| [`2d/ui/primitives/main.ts`](2d/ui/primitives/main.ts) | every ui primitive at every reference size, with no renderer |

`2d/content/hot-reload` and `2d/ui/primitives` are small packages with their own `package.json`; the rest are single files.
