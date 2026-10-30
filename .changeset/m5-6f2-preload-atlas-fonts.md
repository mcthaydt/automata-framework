---
'@mcthaydt/automata-content': patch
---

A preloaded screen's atlases and fonts join the generated preload list (M5 spec §4.7). A screen names them in `assets.toml` beside its `files` (`atlases = ["wick"]`, `fonts = ["pixel"]`, by their names in `atlases.toml` and `fonts.toml`); `preloadList` then adds each atlas page's Spritesheet JSON and image (`atlases/<atlas>-<page>.json` and `.png`) and every language's subset that `fonts.json` names (`fonts/<file>`), from the outputs `automata-content assets` wrote below `outDir`. A name not declared is `unknownReference`; an atlas or font not built, or a page or subset missing from the build, is `missingAsset`, all reported at once at the screen's key. An `assets.toml` that names none compiles and preloads as before.

BREAKING: the API report counts `AssetsSource`'s new optional `atlases` and `fonts` as a changed interface. Code that reads or builds an `AssetsSource` compiles and behaves as before.
