---
'@automata/framework': patch
---

A component in the published package that imports a `.svelte.ts` module now points at the `.svelte.js` file in `dist/`, so a game's bundler finds it (the play screen did not resolve in a packed install).
