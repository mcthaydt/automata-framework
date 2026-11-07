# @automata/3d

The 3D half of an AutomataFramework game. It draws what a game authored: a level made of sectors, the figures that
walk in it, and a camera, in the same low-resolution pixel look as the 2D side, on Pixi 3D. It ships no content
library and no generators beyond a small base set, so it stays as light as the 2D core; everything bigger is an
extension.

This package is **private** until Pixi 3D is public. `@pixi/3d` is a vendored beta (`0.1.0-beta.2`), and no game
imports it directly: every game goes through this package, which installs the no-eval build first.

```ts
import '@automata/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK, targetSize } from '@automata/3d'
```

## The entries

| Entry | What it is for |
| --- | --- |
| `@automata/3d` | The renderer, the camera, the world builder, the look (`DEFAULT_LOOK`, `targetSize`, `addLookPass`), the time of day and the timeline |
| `@automata/3d/no-eval` | Installs the no-eval shader path. Import it before anything else |
| `@automata/3d/camera-view` | The lens and the camera's view of a level |
| `@automata/3d/figures` | Procedural figures: body, motion, clips, items and the five registries |
| `@automata/3d/figures-kit` | What an extension needs to write a wardrobe, a hairstyle or a seat |
| `@automata/3d/level` | The `af-sector/2` level file and the sector geometry |
| `@automata/3d/world-content` | The world's content shapes, for tools that read levels |
| `@automata/3d/base` | The base pair (one man, one woman), a base interior and exterior, and five base props |
| `@automata/3d/sim` | The sim-side level and piece state; no Pixi, no clock, no `Math.random` |
| `@automata/3d/testing`, `@automata/3d/testing-checks` | Fixtures and checks for tests and extension authors |

## What is core and what is an extension

Core keeps the camera, the renderer, `af-sector/2`, the world builder, prop placement (`registerPropGenerator`, with
`box` and `cylinder`), lamps, time of day, the timeline, piece states, figure body, motion and items, the five
registries, seven garment kinds, glTF loading and the look. Extensions add the rest: `@automata/world-kit` (prop,
swatch and kit libraries, the dresser, decals, lettering, generated maps, photo textures, sky, stars, rain and
bloom as look passes) and `@automata/character-kit` (the other garments, hair pieces, finishes and seats).

## The look

A game picks a `Look` (a few numbers: how small the field is, how many steps light is cut into, the outline, the
dither) and the renderer draws the world with a stepped-light material, snaps the frame to the DUEL palette and
upscales it in whole pixels. See [ADR 0007](../../docs/adr/0007-3d-look.md) for why this is done with passes and
where a baked figure is the fallback.
