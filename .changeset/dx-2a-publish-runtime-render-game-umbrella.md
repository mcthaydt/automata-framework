---
'@mcthaydt/automata': patch
'@mcthaydt/automata-game': patch
'@mcthaydt/automata-render-pixi': patch
'@mcthaydt/automata-runtime': patch
---

First publish of the runtime, the Pixi renderer, the game package and the umbrella (DX.2a), so a game, and Automata
Plus, can install them. Each ships `dist` only, `svelte` and `pixi.js` are caret peers, and every export has a doc
comment. The runtime's Svelte rune modules stay files of their own (`*.svelte.js`) and it ships Ruken's types, not
its code; the game package ships its screens as Svelte source under the `svelte` condition and bundles the one Ruken
value it uses (D-8, listed in its `VENDORED.md`).
