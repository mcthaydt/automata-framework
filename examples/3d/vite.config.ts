import { setContentPlugin } from '@af-examples/set-3d/vite'
import { examplesRunner } from '@automata/examples-runner'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// Every 3D example in this folder (the 3D runtime and figures), served and built by the same runner as the 2D ones:
// `pnpm examples:3d [name]`. Each page starts its example with the umbrella's `startGame`; Svelte
// compiles the default screens and the ui primitives under them. The set's content (`examples/set-3d`) compiles into
// `virtual:automata/content`, as a game's does, for the examples that call its `scene()`.
export default defineConfig({
  plugins: [
    svelte(),
    examplesRunner({
      root: import.meta.dirname,
      start: '@automata/framework',
      noEval: '@automata/framework/no-eval',
    }),
    setContentPlugin(process.env),
  ],
})
