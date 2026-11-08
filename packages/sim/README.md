# @mcthaydt/automata-sim

The rules of an AutomataFramework game. You describe what exists (components), what the player can ask for
(commands) and what happens each tick (systems), and the sim gives the same result every time, bit for bit, in
Node, Chromium, WebKit and Firefox. It never touches the screen, the clock or `Math.random`, so a recorded
game replays exactly.

```sh
pnpm add @mcthaydt/automata-sim
```

```ts
import { defineComponent, definePlugin, defineSystem } from '@mcthaydt/automata-sim'

const Square = defineComponent('square', { x: 'f32', y: 'f32' })
const drift = defineSystem('drift', (ctx) => {
  for (const square of ctx.query(Square)) square.set(Square, { x: square.get(Square).x + 1, y: 0 })
})

export const plugin = definePlugin({ name: 'my-game', defs: [Square, drift] })
```

Most games import everything through [`@mcthaydt/automata`](https://github.com/mcthaydt/automata-framework/tree/main/packages/automata), which re-exports these. Use
this package on its own for tests, tools and anything that runs without a browser.

More: [the docs](https://github.com/mcthaydt/automata-framework/tree/main/docs) and [the examples](https://github.com/mcthaydt/automata-framework/tree/main/examples).
