# Systems

Rules for a world and the creatures in it, as data: a watchman who patrols, hears a noise, gives chase and loses you.
You write how they behave in a file, and the simulation runs it the same way every time. It also ships bots that play
your game, to check that it is fair.

It is free, MIT licensed and optional. It is not published to npm yet.

## Turn it on

Systems needs [`@automata/sectors`](../sectors/README.md), [`@automata/nav`](../nav/README.md) and
[`@automata/puzzle`](../puzzle/README.md):

```ts
import { systemsExtension } from '@automata/systems'

const systems = systemsExtension()
export default defineGame({
  extensions: [sectorsExtension, navExtension, puzzleExtension({ extensions: ['systems'] }), systems.extension],
})
```

If one of them is missing, the game refuses to start and says who needs what.

## What you get

- **A `systems` content kind**: agents, their modes (patrol, hunt) and the rules between them.
- **Sim**: commands to hide and unhide, and events for a change of mode, a noise and a catch. `systems.hear` makes a
  noise from your own system.
- **Bots** (`@automata/systems/bots`, Node only): scripted players, scenarios, playtests and a fairness report, for
  build time and tests.
