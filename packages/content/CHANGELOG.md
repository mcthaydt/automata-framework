# @mcthaydt/automata-content

## 0.0.3

### Patch Changes

- c07e66a: Document the exports of content, host, node and ship: the content kinds, generators, tuning, flow and diagnostics types and the Vite plugin; the host's analytics properties and test options; the `Files` and `ProcessRunner` services and their live layers; and the ship inputs, `deployDev`, `publishToRuken`, `testRemote`, `rukenToml` and the build checks.
- 276a7ae: Font subsetting (M5.5): `content/fonts.toml` names each committed source font with its sha256, licence and languages. `automata-content assets` cuts each language's subset to woff2 with a content-hashed name and writes `fonts.json`. A source whose hash differs is refused (`invalidAsset`), and a message with a character none of its language's subsets holds fails at the message's `file:line:col` with the code point (`missingGlyph`). The `./assets` entry adds `buildFonts`, `subsetWoff2` and `fontCoverage`. `CompiledContent.messageLocations` says where each language's message is written.
- f05aaba: Atlas packing (M5.6): `content/atlases.toml`, the `@mcthaydt/automata-content/assets` entry (`buildAtlases`, the deterministic `packFrames`), and `automata-content assets`, which writes each atlas page's PNG and Pixi Spritesheet JSON. With a declared `content/palette.toml`, frames are checked against it (`offPalette`); a broken frame is `invalidAsset`.
- 0d11a56: Content localization (PRODUCT.L2): a translation's missing key is reported at the source text's `file:line:col`, and an extra or non-text key at its own line and column; `CompiledContent` gains `languages` and `catalogs`; `ContentOptions.paraglide` compiles the catalogs (and a game's own) with Paraglide on build; the new `@mcthaydt/automata-content/locale` entry has `createContentText` for run-time lookup and the per-locale glyph sets.
  
  BREAKING: `CompiledContent` gains the required `languages` and `catalogs` members, so a hand-built `CompiledContent` must add them. `ContentOptions` gains the optional `paraglide` member.
- 9244e86: Raise the `vite` peer floor to `^8.3.3`: 8.3.0 to 8.3.2 carry GHSA-587h-7wmj-h5pm (a high-severity `launch-editor` check bypass on Windows, dev server only), which the dependency audit now reports.
- 50ec5a9: Depend on `zod` 4.6.6: 4.6.5 and earlier carry GHSA-mrhx-c7xc-m3w5 (a high-severity memory exhaustion while validating oversized constrained collections), which the dependency audit now reports.
- Updated dependencies [00ca723]
- Updated dependencies [25d5a68]
- Updated dependencies [0c84109]
- Updated dependencies [50ec5a9]
  - @mcthaydt/automata-sim@0.0.3

## 0.0.2

### Patch Changes

- c763d97: Send the dev server's HMR event only when a rebuild's result actually changed, so one save — which macOS may
  report as several watcher events, and which the watcher also emits for authored files at startup — never sends
  a second, identical `automata:content` or `automata:content-error`.
- @mcthaydt/automata-sim@0.0.2

## 0.0.1

### Patch Changes

- c7ae066: First published build (M2.4): every package builds to `dist/` with tsdown (ui with svelte-package), bundles the
  vendored Ruken code it needs, and publishes to GitHub Packages. `check-boundaries` is now
  `@mcthaydt/automata-check-boundaries` with an `automata-check-boundaries` bin.
- 38fdbf6: Make the compiler's skipped-file test portable to a case-insensitive filesystem.
- Updated dependencies [c7ae066]
  - @mcthaydt/automata-sim@0.0.1
