# @mcthaydt/automata-tools

The `automata` command line: make a game, check it, build it and ship it.

```sh
pnpm dlx @mcthaydt/automata-tools create-game my-game   # a new game in ./my-game
cd my-game && pnpm install
pnpm dev                                                # play it in your browser
pnpm check                                              # every check a game passes before it is published
```

A new game builds for the web and for itch.io. Add `--targets web,itch,tauri,ruken` to `create-game` to build for a
desktop app or Ruken too.

Inside a game, `pnpm exec automata` runs the rest:

```sh
pnpm exec automata check                 # boundaries, types, tests and the build's rules
pnpm exec automata build                 # the game's Vite build
pnpm exec automata ship --help           # prepare and publish to itch.io, a desktop app or Ruken
```

`automata --help` lists every command. The guides are in the Docs on the Automata Framework site.
