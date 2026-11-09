# Sectors

Rooms in a level, as the simulation sees them. A level is an `af-sector/2` file (the 3D editor writes it). This plugin
knows which room each thing stands in, tells the game when someone enters a room or crosses a zone, and turns the walls
and floors into numbers the simulation can walk against.

It is free, MIT licensed and optional. It is not published to npm yet.

## Turn it on

```ts
import { sectorsExtension } from '@automata/sectors'

export default defineGame({ extensions: [sectorsExtension] })
```

Read the level with `readSectorMap`, which checks the file and says what is wrong in words, and give the result to
`loadSectorMap`.

## What you get

- **`resolveLevel`**: rooms, walls, doors and pits as plain numbers: where the floor is and where a wall stops you.
- **`checkLevel`**: finds a room that crosses itself, a wall of no length, a door to nowhere or a slope the sim cannot
  walk. It returns the problems as a list and never throws.
- **Events**: `sector.entered` and `zone.crossed`.
- **Rapier colliders** from the same level (`@automata/sectors/physics`), if the game uses physics.

[`@automata/nav`](../nav/README.md), [`@automata/narrative`](../narrative/README.md) and
[`@automata/systems`](../systems/README.md) build on it.
