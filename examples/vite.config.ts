import { examplesRunner } from '@mcthaydt/examples-runner'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// Every example in this folder, served and built by the one runner (EX spec §5): `pnpm examples [name]`,
// `pnpm build:examples`. Each page starts its example with the game package's `startGame` (DX.2); Svelte
// compiles the default screens and the ui primitives under them.
export default defineConfig({
  plugins: [
    svelte(),
    examplesRunner({
      root: import.meta.dirname,
      start: '@mcthaydt/automata-game',
      noEval: '@mcthaydt/automata-game/no-eval',
    }),
  ],
})
