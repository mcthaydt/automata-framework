---
'@automata/framework': patch
---
A game restarted in place while `pnpm dev` runs (a saved change) now has its sound back at once, because the page has already had a tap. Before, the new game's audio stayed locked until the next tap.
