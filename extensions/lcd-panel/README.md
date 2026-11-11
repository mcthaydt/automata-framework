# LCD panel

The look of a small LCD screen, as one pass over the pixel-art look: a mesh of rows and columns, red-green-blue stripes,
scanlines, a little glow round bright pixels (halation), a slight colour split at the edges and a vignette round the
frame. It is a post pass, so it draws the same on WebGL2 and on WebGPU, and a settings profile says how strong each part is.

**It runs after core's DUEL snap, and its output is not on the palette, on purpose.** The panel simulates the display, not the
scene: the stripes, the glow and the colour split are what a screen does to the picture it is given, as the source game's LCD
does. Everything that belongs to the picture (a colour grade, say) goes before the snap, as the
[retro pass](../retro-crisp/README.md) does.

It is free and MIT licensed. It is optional: a game that does not add it loses nothing. It is not published to npm yet,
because it builds on `@automata/3d`.

## Turn it on

Add the pass once, before the renderer is made. Passes run in the order they were added, after core's snap, so add the panel
last if it should sit on top of the other passes that follow the snap (stars, glow).

```ts
import { addLcdPanelPass } from '@automata/lcd-panel/pass'

const panel = addLcdPanelPass({ profile: { grid: 0.45 } }) // the rest is the clinic's numbers
```

`panel.passes` lists the panels the renderer made. Each is a `PostEffect`, so `pass.enabled = false` takes it out of the
frame, and `pass.profile = { ... }` retunes it while the game runs.

## The profile

Every setting has a default, so `{}` is the clinic's panel. A setting that is out of range, or one the profile does not
know, is refused and the message names it.

| Setting | Default | What it does |
|---|---|---|
| `grid` | 0.3 | Mesh visibility, 0 to 1. 0 keeps the stripes but drops the mesh |
| `balance` | 0.6 | Share of the mesh given to rows. 1 is horizontal lines only |
| `minPitch` | 3 | Shortest mesh period, in field pixels. Under about 3 the mesh fades out |
| `subpixels` | 0.3 | Stripe visibility. 0 drops the stripes |
| `layout` | `rgb` | Stripe order, `rgb` or `bgr` |
| `scanlines` | 0.3 | Added to the row axis of the mesh |
| `aberration` | 0.25 | Red and blue split sideways, in cells |
| `glow`, `glowThreshold`, `glowRadius` | 0.3, 0.55, 1.5 | Halation: how much, above which luma, how far (in cells) |
| `brightness` | 1.55 | Gives back the light the mesh absorbs. 1 disables it |
| `gamma` | 1 | 1 disables it |
| `cell` | 2 | Field pixels a side of one cell; the mesh period is a whole number of cells |
| `snap` | `false` | Crisp pixels: the colour split lands on whole pixels (a stronger fringe) |
| `vignette` | `true` | The frame's outer vignette |

`LCD_CLINIC` is the defaults and `LCD_OFF` is the panel with every term that changes the picture zeroed (the vignette
stays, since it belongs to the frame). Both come from `@automata/lcd-panel`, which has no renderer in it, with
`parseLcdProfile`, `derivePitch` and the other pure maths, so Node tests can use them.

## What it is built from

The mesh is a port of `lcd-perfect` v10 by sinedied (MIT): a sinusoid integrated exactly over each output pixel's
footprint, and faded out past the Nyquist limit rather than folded into a coarser pattern, which is why it holds up at any
field size. The notice is in `src/features/lcd-panel/lcd-shader.ts`.

## See it

[`examples/3d/lcdpanel/lcdpanel-screen.ts`](../../examples/3d/lcdpanel/lcdpanel-screen.ts) draws a room with the panel on
and off (press L); `?pref=webgpu` draws it on WebGPU. The pictures, on and off, on WebGL and WebGPU, are in
[`docs/refactor/tll-extensions/`](../../docs/refactor/tll-extensions/).
