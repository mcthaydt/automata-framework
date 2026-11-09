---
'@automata/framework': patch
---
The packed default Play screen found its play-context module again: the component imported it with `.svelte.ts` written out, which `svelte-package` leaves as it is, so a game's build from the packed package failed with an unresolved import. It is now imported without the extension, like the other `.svelte.ts` modules.
