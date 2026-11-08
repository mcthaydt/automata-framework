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

## Try it

The repository's `extensions/character-kit/tests/fixtures/content` has eight hairstyles and eight seats to copy from (they are not in the npm package). `pnpm --filter @automata/character-kit test`
checks everything, and `pnpm --filter @automata/character-kit goldens` re-records the pictures the tests compare
against. Only do that on purpose, and say why in the commit.
