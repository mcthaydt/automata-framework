---
'@automataframework/automata-content': patch
'@automataframework/automata-tools': patch
---
In dev, a good content save now sends a real HMR update for `virtual:automata/content`, not only the `automata:content` event: a module that accepts it (`import.meta.hot.accept`) gets the new content in place, and a page where nothing does reloads. A game made with `automata create-game` accepts it in `src/main.ts` and starts over on the new content, on the same page.
