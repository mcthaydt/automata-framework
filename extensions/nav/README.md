# Nav

Click to walk. Someone says "go there" and the character finds a way through the level's rooms and doors, or says there
is none. Routes follow a graph of spots you draw, and the same seed gives the same walk.

It is free, MIT licensed and optional. It is not published to npm yet.

## Turn it on

Nav needs [`@automata/sectors`](../sectors/README.md). Add both:

```ts
import { navExtension } from '@automata/nav'
import { sectorsExtension } from '@automata/sectors'

export default defineGame({ extensions: [sectorsExtension, navExtension] })
```

If `sectors` is missing, the game refuses to start and names it.

## What you get

- **A `nav-graph` content kind**: the spots and the lines between them, one TOML file for each scene.
- **Commands and events**: `WalkTo` and `NavDoor` (open or shut a door), then `NavArrived` or `NavUnreachable`.
- **`route`**: the shortest way over the graph, if you want to ask without walking.
- **Your own obstacles**: pass `blocked` to say where the game's own boxes are.
