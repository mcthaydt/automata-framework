---
"@mcthaydt/automata-content": patch
---

The content Vite plugin (`automataContent` from `@mcthaydt/automata-content/vite`) now sets `build.assetsInlineLimit: 0` when the game's Vite config leaves it unset, so every asset ships as a file. Vite would otherwise inline an asset under 4 kB as a `data:` URL, which Pixi's loader fetches and Ruken's CSP (`connect-src`, which has no `data:`) refuses, so the asset never loaded. A value the game sets itself is kept.
