# World kit

Ready-made things for 3D rooms and streets. Core's world builder can draw a box, a cylinder, a table, a bin, a lamp,
a street lamp and a tree. This kit adds the rest (chairs, beds, shelves, plants, cars, shop signs, trees and clouds),
a dresser that furnishes a whole room from one word, and two generated maps, so a game does not have to model them.

It is free and MIT licensed. It is optional: a game that does not add it loses nothing.

## Turn it on

In the game's list of extensions, put the kit after `3d`:

```ts
import { worldKitExtension } from '@automata/world-kit'
import { render3dExtension } from '@automata/3d'

export default defineGame({ extensions: [render3dExtension, worldKitExtension] })
```

If you forget, you are told, in words: a prop that asks for a chair says `unknown-generator` and names it, and a room
that asks to be furnished is drawn empty with the note `Add @automata/world-kit, or remove "dress" from the room`.

## Furnish a room

Give a room a purpose and run `dressLevel` once, before the level is built:

```ts
import { dressLevel, worldKitLibrary } from '@automata/world-kit'

// the room says: dress = { as = "office", seed = 3 }
const { level, problems } = dressLevel(myLevel, worldKitLibrary)
```

`level` is the same level with the furniture, wall fixtures, clutter and ceiling lamps added as ordinary props, each with
a name like `office:furniture:2`. Core draws it with no extension needed. The same seed gives the same room every time.
`problems` is empty when all went well. If a room names a purpose the library has no kit for (`dress = { as = "castle" }`),
that room is left empty and `problems` says so.

The purposes are `waitingRoom`, `office`, `bedroom`, `livingRoom`, `corridor`, `storeroom`, `street` and `yard`.
To take a piece out, or move one, name it in the room's `dress`: `remove = ["office:furniture:2"]`, or
`pin = { "office:furniture:3" = { at = [2.5, 2.5] } }`.

## Make a whole place

`generateMap` makes a level from a name and a number. The same number always gives the same level.

```ts
import { dressLevel, generateMap, worldKitLibrary } from '@automata/world-kit'

const { level } = dressLevel(generateMap('apartment', 7), worldKitLibrary)
```

`apartment` is a corridor with four to six rooms, a ramp and a landing. `block` is a street at night with shops, cars
and lamps. Both ask for their rooms to be furnished, so run them through `dressLevel`. `dressedBaseScenes` has core's
plain base interior and exterior with a waiting room and a street added, for judging a look change.

## Photo textures

Every material is a photo. `assets/photos/` holds 38 CC0 photos (`photos.json` has each one's source, licence and
credit), and `library/tiles/` holds the small DUEL tile each swatch is drawn with. A tile is made from its photo by
`photoToTile`: flatten, facet, scale down, index to the palette, wear, clean. It is deterministic, so the committed
tile is checked, not trusted: it carries its photo's sha-256, and a missing, stray or stale tile is an error.

```sh
pnpm exec automata-world-textures --check   # do the committed tiles match their photos?
pnpm exec automata-world-textures --out out/tiles   # draw them again
```

## Checks

- `checkReads(level, library, photos)` tells you which swatch misses the look it declared in `reads` (too blotchy, too
  flat, too few colours) as a `swatch-reads` problem.
- `readsAgainst(figure, room, camera)` says whether a figure still stands out against the room behind it. It works on
  the pixels of a frame you drew, so it runs in Node.

## Sky passes

`@automata/world-kit/sky` adds stars, rain and a glow to core's look. Each is a pass that runs after core's DUEL snap and
lands on whole palette steps, and each has its own switch (stars and glow are on, rain is off unless you give it). The stars
are as thick as the time of day says. A game that does not add them draws core's look unchanged.

```ts
import { addSkyPasses } from '@automata/world-kit/sky'

addSkyPasses({ stars: true, glow: true, rain: { density: 0.3 } })
```

Call it once before the renderer is made; a second call throws, because the pass names are taken.

## Add your own

Props, swatches and kits are data. Put a TOML file in `content/world-props`, `content/world-swatches` or
`content/world-kits` and lay it over the kit's library: `{ ...worldKitLibrary.props, ...yours }`. Your names win.
A new shape is a generator you register with `registerPropGenerator` from `@automata/3d/props-kit`.

## What is in it

- `library/props.json`: the presets (a bed, a wardrobe, a vending machine, a car).
- `library/kits.json`: the eight purposes above.
- `library/swatches.json`: the materials. A swatch of a base name (`baseWall`, `baseFloor`) has the same colour as
  core's, with the photo texture on it.
- `library/maps/`: five small maps, ready to read as levels. `pnpm run maps` makes them again from
  `tests/fixtures/builder-maps.json`.
- `library/glyphs.json` and `library/words.json`: the block letters and the words a made-up shop sign is set from.
