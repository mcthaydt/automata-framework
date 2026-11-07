# Examples

Each file here is one example of one feature, run by `pnpm examples` (the index) and checked by its journey in
`examples/tests`. Emberwick, the 2D game, is in [`games/emberwick`](../games/emberwick/); the 3D game is in
[`games/base-3d`](../games/base-3d/). Art keeps to the [art direction](../docs/art/README.md) and its Endesga 64 colour palette.

A file starts with a header (what it shows, its controls, its base and its packages), and the catalog test checks it.

| Example | What it shows |
|---|---|
| [`audio/audio-sound.ts`](audio/audio-sound.ts) | a chime on a sim event |
| [`content/hot-reload/main.ts`](content/hot-reload/main.ts) | the room as a content file, edited while the game runs |
| [`core/core-basic-window.ts`](core/core-basic-window.ts) | open a game window |
| [`core/core-camera-2d.ts`](core/core-camera-2d.ts) | a camera that follows a square around a world bigger than the screen |
| [`core/core-host-lifecycle.ts`](core/core-host-lifecycle.ts) | the sim stands still while the host has the game in the background |
| [`core/core-input-gamepad.ts`](core/core-input-gamepad.ts) | move a square with a controller |
| [`core/core-input-keys.ts`](core/core-input-keys.ts) | move a square with the keyboard, a pad or touch |
| [`core/core-input-rebind.ts`](core/core-input-rebind.ts) | rebind a control in Settings, and keep it next time |
| [`core/core-input-touch.ts`](core/core-input-touch.ts) | steer a square by swiping, and flick down to drop it |
| [`core/core-leaderboard.ts`](core/core-leaderboard.ts) | a run's score goes to the host's leaderboard, and paused shows the board |
| [`core/core-saves.ts`](core/core-saves.ts) | three save slots on the title, and progress kept while you play |
| [`figures/figures-aim.ts`](figures/figures-aim.ts) | Wick turning his head, chest and right hand to follow an orb circling him |
| [`figures/figures-clips.ts`](figures/figures-clips.ts) | Wick walking back and forth along a line with clips played over the walk: a reach, a look and a flinch |
| [`figures/figures-outfits-items.ts`](figures/figures-outfits-items.ts) | one figure changing outfits and the item in its hand |
| [`figures/figures-poses.ts`](figures/figures-poses.ts) | Wick taking each pose of a small library in turn, a clip blending him into it |
| [`figures/figures-walk.ts`](figures/figures-walk.ts) | Wick, a procedural figure, walking a loop under the angled camera |
| [`render/render-filter.ts`](render/render-filter.ts) | two screen-space filters over the picture, and the quality tier that decides which run |
| [`render/render-interpolation.ts`](render/render-interpolation.ts) | a square drawn between sim ticks, beside a line where the sim says it is |
| [`render/render-quality.ts`](render/render-quality.ts) | switch the graphics quality tier while squares drift across the field |
| [`render3d/render3d-angled-camera.ts`](render3d/render3d-angled-camera.ts) | the angled camera, cut-away walls and a fading pillar |
| [`render3d/render3d-lighting-fog.ts`](render3d/render3d-lighting-fog.ts) | baked lamp light, a lit walker and fog in a 3D room |
| [`render3d/render3d-meshes.ts`](render3d/render3d-meshes.ts) | lit boxes and model files in a 3D view |
| [`shapes/shapes-draw-hud.ts`](shapes/shapes-draw-hud.ts) | a HUD and a mini-map drawn each frame over bouncing squares |
| [`shapes/shapes-rects.ts`](shapes/shapes-rects.ts) | rectangles that move, slide and spin |
| [`textures/textures-atlas.ts`](textures/textures-atlas.ts) | sprites drawn from a packed atlas |
| [`textures/textures-sprite.ts`](textures/textures-sprite.ts) | an animated sprite from a sprite sheet |
| [`ui/primitives/main.ts`](ui/primitives/main.ts) | every ui primitive at every reference size, with no renderer |

`content/hot-reload` and `ui/primitives` are small packages with their own `package.json`; the rest are single files.
