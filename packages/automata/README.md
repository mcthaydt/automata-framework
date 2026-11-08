# @mcthaydt/automata

The one import for an AutomataFramework game: the game call, the sim's verbs, the PixiJS renderer, the screens
(title, play, paused, settings, saves), input for keyboard, touch and gamepad, and the host contract that lets
the same build run on the web, itch.io, Ruken or a desktop app.

```sh
pnpm add @mcthaydt/automata @mcthaydt/automata-sim
```

```ts
import '@mcthaydt/automata/no-eval' // first, so the page needs no `eval`
import { defineGame } from '@mcthaydt/automata'

export default defineGame({
  id: 'my-game',
  size: { width: 320, height: 180 },
  sim: { plugins: [] },
})
```

`automata create-game my-game` (from [`@mcthaydt/automata-tools`](https://github.com/mcthaydt/automata-framework/tree/main/packages/tools)) writes a whole game
project for you. The build picks the target's adapter through the `automata-web`, `automata-ruken` and
`automata-tauri` conditions of `@mcthaydt/automata/target`.

More: [the docs](https://github.com/mcthaydt/automata-framework/tree/main/docs) and [the examples](https://github.com/mcthaydt/automata-framework/tree/main/examples).
