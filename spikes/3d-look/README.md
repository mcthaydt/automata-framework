# Spike 3d-look (ADR 0007)

Measures the two ways to draw the pixel-art look on Pixi 3D, on base-3d's own page with the look injected into
`main.ts` by a Vite transform (the game's source is untouched). Spikes are exempt from TDD.

```sh
export PATH=/opt/node24/bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
ln -sfn ../../games/base-3d/node_modules spikes/3d-look/node_modules   # once; git-ignored
node spikes/3d-look/measure.mjs full|lowres|passes|bake                # results in spikes/out/
```

| Mode | What it draws |
|---|---|
| `full` | base-3d as it is: 844 × 390, Phong materials |
| `lowres` | the same at a 389 × 180 field (short side 180), the letterbox's nearest upscale |
| `passes` | `lowres` + a stepped-light material on every mesh (a lighting bit through `createLightingBit`) + a post effect that snaps each pixel to DUEL and draws depth edges |
| `bake` | `lowres` + unlit flat meshes and one billboard for the figure (the cost floor of baked cells) |

The script plays to the room, holds the camera turn and walks, and records the rAF intervals. Chromium here draws
WebGL2 in software: the numbers are recorded, not judged. The GPU runner's phone and iPad profiles judge (8.2).
