# Puzzle

Locks, keys, goals and checkpoints written as data, run by the simulation. A level says "this door opens when you hold
the red key" and the game needs no code for it. A solver tells you whether a level can be finished.

It is free and MIT licensed. It is optional: a game that does not add it loses nothing.

## Turn it on

```ts
import { puzzleExtension } from '@automata/puzzle'

export default defineGame({ extensions: [puzzleExtension({ extensions: ['sectors'] })] })
```

`extensions` lists the extensions the game uses, so a rule that needs one you forgot fails when your content compiles,
not in the middle of play. Add `calls` to give the rules functions of your own to call.

## What you get

- **A `puzzle` content kind**: the rules and goals, in TOML files.
- **The sim side** (`@automata/puzzle/sim`): the interpreter, the commands a player's verbs become, and the events
  other extensions listen to.
- **A solver** (`@automata/puzzle/solver`, for build time and tests, never in a game bundle): tries the moves and says
  which levels cannot be finished.
