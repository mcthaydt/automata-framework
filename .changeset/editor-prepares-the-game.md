---
'@automata/tools': patch
---
`automata editor` now prepares the game the way `pnpm dev` does before it starts the game's Vite: it runs the game's own `fonts` script, so a new game that was never started with `pnpm dev` no longer opens a blank Play tab (its `src/main.ts` imported fonts that were not written yet).
