# @mcthaydt/automata-tools

The `automata` command line: make a game, check it, build it and ship it.

```sh
pnpm add -D @mcthaydt/automata-tools
pnpm exec automata create-game my-game   # a new game in ./my-game
pnpm exec automata check                 # boundaries, types, tests and the build's rules
pnpm exec automata build                 # the game's Vite build
pnpm exec automata ship --help           # prepare and publish to Ruken, itch.io or a desktop app
```

`automata --help` lists every command. `automata-ship` still works for one more release; it prints that it has
moved to `automata ship`.

More: [the docs](https://github.com/mcthaydt/automata-framework/tree/main/docs) and [the examples](https://github.com/mcthaydt/automata-framework/tree/main/examples).
