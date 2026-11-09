---
'@automataframework/automata-tools': patch
---
`automata create-game` now writes a game that runs: a square the player moves, on the default title, play and pause screens, laid out by role (`src/constants.ts` to `src/views.ts`, then `src/main.ts`). Before, the page only printed the game's title and the build failed on the framework's Svelte screens; the new `vite.config.ts` compiles them with `@sveltejs/vite-plugin-svelte`, and the game depends on `svelte` instead of `effect`.
