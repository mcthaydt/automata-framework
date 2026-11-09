---
'@automataframework/automata-tools': patch
---
`automata ship prepare` and `publish` ask for `--target` every time (`web`, `itch`, `tauri` or `ruken`), and `prepare --target web` checks a build for secrets, inlined assets, `eval`, the private Pixi 3D beta and root-absolute paths. `automata add`, `ship deploy-dev`, `ship test-remote` and the `automata-ship` name are gone, and an unknown command says so instead of making a game.
