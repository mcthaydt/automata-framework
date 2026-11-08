# Cutscenes

A short scene the game plays: the camera moves, a lamp warms, a door opens, a line is said. A scene is a script of keyed
tracks, written as data. A director answers "what does the scene look like at second 3?", so a preview, a check and a
replay all see the same picture. The simulation only counts ticks.

It is free, MIT licensed and optional. It is not published to npm yet.

## Turn it on

Cutscenes need [`@automata/sectors`](../sectors/README.md), [`@automata/nav`](../nav/README.md) and
[`@automata/narrative`](../narrative/README.md):

```ts
import { cutscenesExtension } from '@automata/cutscenes'

const cutscenes = cutscenesExtension()
export default defineGame({
  extensions: [sectorsExtension, navExtension, narrative.extension, cutscenes.extension],
})
```

Call `cutscenes.start` from the puzzle's `cutscene` hook. If a needed extension is missing, the game refuses to start.

## What you get

- **A `cutscene` content kind**, and the sim that counts a scene's time: `start`, skip, and `locked` for the input a
  scene holds while it plays.
- **`@automata/cutscenes/director`**: `createDirector(script)` and `stateAt(seconds)` give the camera, lamps, doors,
  props, fades and actors at that moment. The view reads it each frame.
- **`@automata/cutscenes/tools`**: lint a script, naming a lamp, door or prop the level does not have.

`examples/3d/cutscenes` has two scenes you can run.
