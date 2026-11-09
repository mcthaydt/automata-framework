# @automataframework/automata-content

Turns a game's content files (levels, text, tuning numbers, a palette) into the one checked file the game loads.
It tells you which file, line and column is wrong, and it gives the game a content hash so a saved game can tell
whether it matches the build.

```sh
pnpm add -D @automataframework/automata-content
```

```ts
// vite.config.ts
import { automataContent } from '@automataframework/automata-content/vite'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [automataContent()] })
```

Run `automata-content build` to compile without Vite. A game's own pages import the browser-safe entries
(`@automataframework/automata-content/schema`, `/palette`, `/locale`, `/game-config`, `/level-2d`); the root is the compiler and
needs Node.

## Levels from the 2D editor

`@automataframework/automata-content/level-2d` is the format the 2D editor writes. Register its three kinds, then read a level
in your game:

```ts
import { entitiesOf, intGridRows, level2dKinds } from '@automataframework/automata-content/level-2d'

// vite.config.ts: automataContent({ root, schemas: level2dKinds() })
// in the game: rows of numbers (0 is empty) and the entities of a layer
const walls = intGridRows(level, 'collision')
const things = entitiesOf(level, 'entities')
```

More: [the docs](https://github.com/mcthaydt/automata-framework/tree/main/docs) and [the examples](https://github.com/mcthaydt/automata-framework/tree/main/examples).
