# Retro and crisp

Two small things that make AF's pixel-art look read like old hardware.

**Retro** is a post pass: an unsharp mask, a colour grade (warmth, tint, contrast, saturation, vibrance, black crush), a
vignette, and a film fade that lifts black toward a tint, settles white, and adds moving grain, dust and the odd scratch.
It runs **before** core's DUEL snap (`addLookPass` with `beforeSnap`), as the look's haze does, so the colours it grades,
fades and grains are snapped to the palette: the final frame is DUEL. A neutral profile (`RETRO_NEUTRAL`) changes nothing: an
exact DUEL colour comes out as it went in, and the snap leaves it there.

**Crisp** is how the picture reaches the screen without a pixel being smeared or drawn at an uneven width: the maths for
a whole-number scale of the field (`letterboxScale`), for billboards whose texels land on whole field pixels
(`figureSnap`), and a canvas layout helper. Its `lcd` flag is what sets `snap` on the [LCD panel](../lcd-panel/README.md).

It is free and MIT licensed. It is optional: a game that does not add it loses nothing. It is not published to npm yet,
because it builds on `@automataframework/3d`.

## Turn the retro pass on

Add it once, before the renderer is made. It takes its place ahead of the snap whatever order the passes were added in; the
LCD panel runs after the snap, so it sits on top:

```ts
import { addRetroPass } from '@automataframework/retro-crisp/pass'

const retro = addRetroPass({ profile: { grade: { saturation: 1 } } }) // the rest is the clinic's numbers
```

`retro.passes` lists the passes the renderer made. `pass.enabled = false` takes one out of the frame,
`pass.profile = { ... }` retunes it, and Pixi's shared ticker drives the film's clock.

**Reduced motion.** The film's grain, dust and scratch are the pass's only movement. While the player has asked for less
movement (`prefers-reduced-motion`, read each frame) the film's clock stands where it was, so the picture holds still and goes
on from there if the setting is turned off. A game with its own setting says so: `addRetroPass({ reducedMotion: () => settings.reduceMotion })`.

**At the old game's picture size.** The browser tests draw the pass at 640 x 360 (a 16:9 window) and 640 x 480 (4:3): the clinic's
grade moves the picture and the snap puts it back on the palette, and the neutral profile leaves it alone.

## The old game's look: the LCD panel and the retro grade together

One call each at module load, before `createPixi3dRenderer`; the profiles are the old game's numbers when left out or `{}`, and a game's content can hold
the keys it changes. There is no look or content key that switches an extension's pass on (core never imports one), so this is code.

```ts
import { addLcdPanelPass } from '@automataframework/lcd-panel/pass'
import { CRISP_CLINIC, crispRendererOptions } from '@automataframework/retro-crisp'
import { addRetroPass } from '@automataframework/retro-crisp/pass'

addRetroPass({ profile: content.retro ?? {}, reducedMotion: () => settings.reduceMotion }) // before core's snap
addLcdPanelPass({ profile: content.lcd ?? {} }) // after it, on top
createPixi3dRenderer({ ...options, ...crispRendererOptions(CRISP_CLINIC), look }) // whole-pixel scale; look.pixel.short is the picture's short side (480 at most)
```

Both are proved at 640 x 360 and 640 x 480. `reducedMotion` is optional (the default reads `prefers-reduced-motion`).

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

The whole-pixel scale is core's letterbox option `scale: 'whole'` (`fit`, the fractional fit to the view's width, is core's
default). `crispRendererOptions` turns the profile into it:

```ts
import { crispFromQuery, crispRendererOptions } from '@automataframework/retro-crisp'

const crisp = crispFromQuery(location.search) // ?crisp=figures,lcd  ?crisp=1  ?scale=fit
createPixi3dRenderer({ ...options, ...crispRendererOptions(crisp) }) // { scale: 'whole' } unless the profile says `fit`
```

The field then takes a whole number of device pixels a field pixel, centred and clipped to its own rectangle, so no pixel is
drawn wider than another. `lcd` is what sets `snap` on the [LCD panel](../lcd-panel/README.md).

For a host that owns its canvas, `letterboxScale(width, height, devicePixelRatio, cap)` is the maths (the scale, the field to
draw, where the canvas goes, all in whole device pixels) and `applyCrispLayout(canvas, layout)` sets it with
`image-rendering: pixelated`. `snapRatio`, `texelRatio` and `figureSnap` are for billboards whose texels should land on whole
field pixels.

## See it

[`examples/3d/retrocrisp/retrocrisp-grade.ts`](../../examples/3d/retrocrisp/retrocrisp-grade.ts) draws a room with the pass on
and off (press R), the field at a whole-pixel scale (`?scale=fit` is the fractional fit) and the panel's colour split snapped to
whole pixels with `?crisp=lcd`; `?pref=webgpu` draws it on WebGPU.
The pictures are in [`docs/refactor/tll-extensions/`](../../docs/refactor/tll-extensions/).
