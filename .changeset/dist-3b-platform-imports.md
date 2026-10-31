---
"@mcthaydt/automata-check-boundaries": patch
"@mcthaydt/automata-ship": patch
---

`automata-check-boundaries --platform-imports <root>...` checks that a distribution target's platform packages
(`@ruken/*`, `@tauri-apps/*`) are imported only by files under a folder named for that target (`ruken/`, `tauri/`),
tests included (DIST.3b, ADR 0006). Each finding names the file, the import and the AF replacement. Only real imports
count; a package named in a string, a comment or a template does not. `pnpm boundaries` runs it over `packages`,
`games`, `examples` and `tooling`.

`@mcthaydt/automata-ship` exports `rukenHeaders(config, target)`: the headers Ruken serves a game's build with, from
its ship config, so a game's `vite preview` gets Ruken's CSP without importing `@ruken/manifest`.
