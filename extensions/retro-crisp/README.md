# Retro and crisp

Two small things that make AF's pixel-art look read like old hardware.

**Retro** is a post pass: an unsharp mask, a colour grade (warmth, tint, contrast, saturation, vibrance, black crush), a
vignette, and a film fade that lifts black toward a tint, settles white, and adds moving grain, dust and the odd scratch.
It runs after core's DUEL snap, so it grades colours that are already on the palette. A neutral profile
(`RETRO_NEUTRAL`) changes nothing: an exact DUEL colour comes out as it went in.

**Crisp** is how the picture reaches the screen without a pixel being smeared or drawn at an uneven width: the maths for
a whole-number scale of the field (`letterboxScale`), for billboards whose texels land on whole field pixels
(`figureSnap`), and a canvas layout helper. Its `lcd` flag is what sets `snap` on the [LCD panel](../lcd-panel/README.md).

It is free and MIT licensed. It is optional: a game that does not add it loses nothing. It is not published to npm yet,
because it builds on `@automata/3d`.

## Turn the retro pass on

Add it once, before the renderer is made, and before the LCD panel so the panel sits on top:

```ts
import { addRetroPass } from '@automata/retro-crisp/pass'

const retro = addRetroPass({ profile: { grade: { saturation: 1 } } }) // the rest is the clinic's numbers
```

`retro.passes` lists the passes the renderer made. `pass.enabled = false` takes one out of the frame,
`pass.profile = { ... }` retunes it, and Pixi's shared ticker drives the film's clock.

## The retro profile

Every setting has a default, so `{}` is the clinic's look. A setting out of range, or one the profile does not know, is
refused and the message names it.

| Setting | Default | What it does |
|---|---|---|
| `sharpness` | 0.35 | Unsharp mask strength from a 4-tap cross. 0 leaves it out |
| `grade.exposure` | 0 | In stops: +1 doubles the light |
| `grade.warmth`, `grade.tint` | -0.12, 0.08 | Cool to warm; magenta to green |
| `grade.brilliance` | 0 | Lifts what is dark |
| `grade.contrast`, `grade.highlights`, `grade.shadows` | 1.05, -0.05, 0 | |
| `grade.saturation`, `grade.vibrance` | 0.85, 0.1 | Vibrance saturates the dull colours more |
| `grade.blackCrush` | 0.025 | Colours darker than this luma go grey |
| `grade.moodBlend` | 0.85 | How much of the grade is kept. 0 keeps none |
| `vignette` | 0.85 | How dark the corners go. 0 leaves the frame even |
| `fade.colour`, `fade.lift`, `fade.white` | `#4b5a56`, 0.13, 0.96 | Black becomes `lift` of `colour`; white settles at `white` |
| `fade.grain`, `fade.fps` | 0.04, 12 | Film grain's amplitude, and the film's frame rate |
| `fade.speck`, `fade.specks`, `fade.scratch` | 3, 0.0008, 0.25 | Dust size, the share of dust lit, the share of frames with a scratch |
| `quantise` | `null` | `{ levels, lumaWeight }`: an ordered 8 x 8 Bayer dither for a look with no palette snap |
| `cell` | 1 | Pixels a side of the grain and dust cell (2 on a phone's coarser field) |

## Crisp

```ts
import { crispFromQuery, letterboxScale } from '@automata/retro-crisp'

const crisp = crispFromQuery(location.search) // ?crisp=figures,lcd  ?crisp=1  ?scale=fit
const layout = letterboxScale(innerWidth, innerHeight, devicePixelRatio, crisp.cap)
```

`layout.scale` device pixels make one field pixel, `layout.frame` is the field to draw (it follows the window's shape up to
`cap`), and `layout.size` and `layout.offset` say where the canvas goes. Every device length is a whole number of device
pixels. `applyCrispLayout(canvas, layout)` sets them on a canvas with `image-rendering: pixelated`.

Core's letterbox scales the field by the window's width over the field's width, which is not a whole number. Whole-pixel
scaling in the running game needs a hook there, which is core's to give; until it does, `letterboxScale` is the maths for it
and the `lcd` flag is what a game can use today.

## See it

[`examples/3d/retrocrisp/retrocrisp-grade.ts`](../../examples/3d/retrocrisp/retrocrisp-grade.ts) draws a room with the pass on
and off (press R) and the panel's colour split snapped to whole pixels with `?crisp=lcd`; `?pref=webgpu` draws it on WebGPU.
The pictures are in [`docs/refactor/tll-extensions/`](../../docs/refactor/tll-extensions/).
