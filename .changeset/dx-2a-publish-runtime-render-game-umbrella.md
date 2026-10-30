---
'@mcthaydt/automata': patch
'@mcthaydt/automata-game': patch
'@mcthaydt/automata-render-pixi': patch
'@mcthaydt/automata-runtime': patch
---

First publish of the runtime, the Pixi renderer, the game package and the umbrella (DX.2a), so a game, and Automata
Plus, can install them. Each ships `dist` only, with Ruken's code and types inside it (D-8): the runtime's Svelte
rune modules stay files of their own (`*.svelte.js`), the game package ships its screens as Svelte source with the
`svelte` condition, and `svelte` and `pixi.js` are caret peers. Every export now has a doc comment.

BREAKING: `@mcthaydt/automata-render-pixi` no longer exports `VERSION` (it said `0.0.1` and nothing read it); the
package's version is its `package.json`'s.
