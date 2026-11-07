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

## Add your own

Props, swatches and kits are data. Put a TOML file in `content/world-props`, `content/world-swatches` or
`content/world-kits` and lay it over the kit's library: `{ ...worldKitLibrary.props, ...yours }`. Your names win.
A new shape is a generator you register with `registerPropGenerator` from `@automata/3d/props-kit`.

## What is in it

- `library/props.json`: the presets (a bed, a wardrobe, a vending machine, a car).
- `library/kits.json`: the eight purposes above.
- `library/swatches.json`: the materials. A swatch of a base name (`baseWall`, `baseFloor`) has the same colour as
  core's, with the photo texture on it.
- `library/glyphs.json` and `library/words.json`: the block letters and the words a made-up shop sign is set from.
