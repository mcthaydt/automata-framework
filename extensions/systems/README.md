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

## Editing characters in Schematic

Schematic, in the editors, changes a scene's characters without touching code. It reads and writes
`content/systems/<scene>.toml` (the behaviour) and `content/nav/<scene>.toml` (the places); the game's editor list
needs a row for each (the create-game template has them).

- **A character**: its modes and how fast it moves in each, the arrows between modes (what must be true, what
  happens, in what order they are checked), what it notices (sight, hearing, touch, light, warmth) and its patrol.
- **Where it starts**: at its first patrol stop, unless the level places it. A character with no stop starts at the
  level's corner, and Schematic says so.
- **Places**: where each is, which join, and what in the behaviour file uses it. Renaming a place changes the
  places file and the behaviour file; taking one away is refused while anything uses it.
- **Ready-made behaviours**: Guard, Sentry, Hunter, Coward and Wanderer, tested in the sim (`tests/unit/presets-sim.test.ts`).
- **Numbers and rules**: the scene's tuned numbers with their ranges, and the world's rules (their values change in
  place).

Schematic writes a value into its own spot in the file. Adding or taking out a condition, an action, a patrol stop or
a sense rewrites only that item's tables, so every other line stays as it was; a comment inside the item is lost.
Not built yet: Watch (the game beside the diagram), Fair play, the puzzle page, and adding rules.

