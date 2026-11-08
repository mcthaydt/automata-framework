# @mcthaydt/automata-content

Turns a game's content files (levels, text, tuning numbers, a palette) into the one checked file the game loads.
It tells you which file, line and column is wrong, and it gives the game a content hash so a saved game can tell
whether it matches the build.

```sh
pnpm add -D @mcthaydt/automata-content
```

```ts
// vite.config.ts
import { automataContent } from '@mcthaydt/automata-content/vite'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [automataContent()] })
```

Run `automata-content build` to compile without Vite. A game's own pages import the browser-safe entries
(`@mcthaydt/automata-content/schema`, `/palette`, `/locale`, `/game-config`); the root is the compiler and
needs Node.

More: [the docs](https://github.com/mcthaydt/automata-framework/tree/main/docs) and [the examples](https://github.com/mcthaydt/automata-framework/tree/main/examples).
