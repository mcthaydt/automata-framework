# Character kit

Clothes, hairstyles and seats for the 3D figures. The figure builder in `@automata/3d` can dress a body in seven things
(a top, trousers, shoes, a cape, hair, a cap and a face). This kit adds the rest, so a game that wants a nurse, a
lamplighter or a girl with box braids does not have to write them.

It is free and MIT licensed. It is optional: a game that does not add it loses nothing.

## Turn it on

In the game's list of extensions, put the kit after the figures:

```ts
import { characterKitExtension } from '@automata/character-kit'
import { figuresExtension } from '@automata/3d/figures'

export default defineGame({ extensions: [figuresExtension, characterKitExtension] })
```

If you forget, you are told, in words: a figure that wears a skirt says `No garment called "skirt" is registered`, and a
hairstyle with a bun says `There is no hair piece called "bun"`.

## What you get

**Eight things to wear.** Write them in a figure's outfit like any other garment.

| Garment    | What it is                                                            |
| ---------- | --------------------------------------------------------------------- |
| `waistcoat` | A short vest over the chest.                                         |
| `legs`     | Stockings: the legs from the thigh down.                              |
| `skirt`    | Hangs from the waist to `length` (0 the hip, 0.5 the knee, 1 the ankle). |
| `apron`    | A bib, straps, a tie at the back and pockets.                         |
| `coat`     | Long, with a collar and buttons.                                      |
| `belt`     | A band round the waist, with a buckle.                                |
| `gloves`   | The hands in the gloves' colour.                                      |
| `mark`     | A watch or a badge on the chest.                                      |

**Nine pieces to build a hairstyle from.** A style lists pieces: `scalp` (a close shell, or a fade), `rows` (braids or
cornrows), `tail` (a ponytail, high or low), `fall` (loose hair, straight or curly), `strands` (locks hung from the
skull), `bun`, `sweep` (a quiff), `block` (a high-top) and `edges` (baby hairs).

**Five finishes** for how the hair looks in the light: `coil`, `braid`, `loc`, `curl` (matte) and `smooth` (it gleams).
Core has `sleek` and `straight`.

**Seats.** A `figure-seat` file says how a figure sits: how high the seat is, whether it leans or slumps, where each hand
goes. `seated(skeleton, gait, seat, time)` gives the sitting pose.

## Painted figures and the wardrobe

A painted figure is a character drawn the way the figure builder's own renders are: texel by texel, 128 × 192 texels for 2.6 m,
always from the same angle (18° down, whatever the camera does), one pixel to a texel, and each texel has its own depth, so a
figure goes behind a wall or behind another figure a texel at a time. The painter is `@automata/figures`, a private package of
this repository (`extensions/figures`), and the kit reaches it only through `src/shared/figures/`.

```ts
import { BASE, paintedFigure } from '@automata/character-kit'

createPixi3dRenderer({
  views: { [Walker.id]: paintedFigure(BASE[0].def, { state: (c) => ({ moving: c.walker?.walking === true }) }) },
})
```

Make the game's field big enough that a texel is a pixel at the figure's feet. At 720 × 405 under the follow camera it is.
A painted figure sits in the room's light. In a renderer made with `lighting`, `paintedFigure` reads the light where the figure stands (the
lamps at their levels, the sun, the ground round its feet) and takes it as the builder's sprite light does: a flat light in whole steps of
its own colours, one lighter step on the lamps' side, a thin rim, and the light's warmth; a figure is never lit above its painted colours (by day it is as painted; a dark room takes it down), and under a lamp it is at most one step hotter than the ground
round its feet. `paintedFigure(def, { lit: false })` keeps a figure as the painter drew it. It draws the same under WebGL and WebGPU (under WebGPU
a figure hides behind a wall texel by texel too).

A figure that stands can hold one of the builder's stands: `state: () => ({ moving: false, pose: 'handOnHip' })`. A name that
is not there is an error that says so.

**The runway wardrobe.** Nine more things to wear, written in a painted character's outfit. Not the same as the eight above:
these are for painted figures, and each is sized from the body under it, so it fits any body the sliders make.

| Garment    | What it is                                                               |
| ---------- | ------------------------------------------------------------------------ |
| `tee`      | A tee, a knit or a shirt: `sleeves` none, short or long; `length` of the hem. |
| `hoodie`   | Roomy, with the hood down behind the neck and a pouch pocket.            |
| `jacket`   | Wool or leather, to the hip, with lapels or a `collar`, a `zip`, and an `inner` shirt in a V. |
| `coat`     | Long sleeves, lapels and skirts to `length`.                             |
| `skirt`    | From the waist to `length` (0 the hip, 0.5 the knee, 1 the ankle).       |
| `dress`    | A fitted top and a skirt in one cloth.                                   |
| `jeans`    | Straight legs to the ankle.                                              |
| `trousers` | The same, roomier; `wide` widens the leg.                                |
| `shoes`    | Shoes and their `sole`.                                                  |

They come with seven fabrics (twill, rib, gingham, Breton stripe, pinstripe, plaid, windowpane), their swatches (cloth,
leather, skin, hair, lips, eyes), twelve hair styles and a glossy `silk` finish. `registerFashion()` adds them to the
builder once; loading the kit's extension calls it, so a second call is harmless.

**The cast.** Fifteen characters as data, to use or to learn from: `RUNWAY_CAST` (Mara, Dre, June, Theo, Edith, Sam, Nia and Otto,
each in an outfit of the wardrobe) and `DEMO_CAST` (Beauty, Ugly, Elder, Lifter, Big, Lanky and Poised, in plain blocks, to show
how far the sliders go). Each is `{ def, pose, about }`: `def` is what `paintedFigure` takes.

```ts
import { RUNWAY_CAST, paintedFigure } from '@automata/character-kit'

views: { [Mara.id]: paintedFigure(RUNWAY_CAST[0].def, { state: () => ({ moving: false, pose: RUNWAY_CAST[0].pose }) }) }
```

## Try it

The repository's `extensions/character-kit/tests/fixtures/content` has eight hairstyles and eight seats to copy from (they are not in the npm package). `pnpm --filter @automata/character-kit test`
checks everything, and `pnpm --filter @automata/character-kit goldens` re-records the pictures the tests compare
against. Only do that on purpose, and say why in the commit.
