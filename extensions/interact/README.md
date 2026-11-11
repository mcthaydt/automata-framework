# Interact

Use a thing in the world. Someone taps a jar across the room and the character walks there, and when they are close
enough, uses it: the puzzle answers as it would for any verb. If there is no way to the jar, they say so, and the use
is forgotten, so a door that opens later does not make the character turn round and use it.

It is free, MIT licensed and optional. It is not published to npm yet.

## Turn it on

Interact needs [`@automata/nav`](../nav/README.md) to walk and [`@automata/puzzle`](../puzzle/README.md) for the verbs it
acts with. You tell it who the player is and what the hotspots' conditions read:

```ts
import { interactExtension } from '@automata/interact'

const interact = interactExtension({
  player: (sim) => /* the player's entity and where it stands */,
  reader: (sim) => /* the facts and items the puzzle reads */,
  hide: systems.hide, // optional: a hiding place hides instead of sending a verb
  puzzle: puzzleOptions, // the options you gave the puzzle, so a use runs its `call` effects too
})
export default defineGame({
  extensions: [sectorsExtension, navExtension, puzzleExtension(), interact.extension],
})
```

If `nav` or `puzzle` is missing, the game refuses to start and names it.

## What you get

- **Hotspots in the level**: entities of the `hotspot` definition, each with a spot, a `reach` in metres, a name (a message
  key), whether it hides, and `when` conditions that say when it can be used. `hotspotsOf(level)` reads them and names
  each one that is not valid.
- **Commands**: `Use` (walk to a hotspot and act), `Combine`, `EnterCode` and `Cancel`. `useCommands(entity, hotspot)`
  is what a tap sends: the walk and the use, in one tick.
- **Events**: `InteractPending` while the player walks, `InteractRefused` (`unknown`, `unavailable`, `unreachable`) and
  `InteractUsed`.
- **`inReach`**: the hotspots the player can use right now, nearest first, for a prompt.

The pending use, what reach means and the one-at-a-time rule are plain numbers in `src/shared/sim/pending.ts`, which
imports no extension, so they can move to the framework core when a second game needs them.

## Not here

The words a hotspot shows and the button that shows them are the HUD's ([`@automata/hud`](../hud/README.md)). There is no
editor for a hotspot yet: Levels 3D places the entities, and `hide` and `when` are edited as the entity's fields.
