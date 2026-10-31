# @mcthaydt/automata-node

## 0.0.4

### Patch Changes

- 6dea6a0: `Files.readBytes(path)` reads a file's exact bytes as a `Uint8Array` of their own, for binary inputs such as images: reading them with `readText` replaces every byte that is not valid UTF-8. A failed read fails with the same `FileError` as `readText` (NODE.1).
  
  BREAKING: `FilesService` gains the required `readBytes`, so a custom `Files` implementation (a test fake) must add it; code that only calls `Files` or provides `FilesLive` compiles unchanged.

## 0.0.3

### Patch Changes

- c07e66a: Document the exports of content, host, node and ship: the content kinds, generators, tuning, flow and diagnostics types and the Vite plugin; the host's analytics properties and test options; the `Files` and `ProcessRunner` services and their live layers; and the ship inputs, `deployDev`, `publishToRuken`, `testRemote`, `rukenToml` and the build checks.

## 0.0.2

No changes in this release.

## 0.0.1

### Patch Changes

- c7ae066: First published build (M2.4): every package builds to `dist/` with tsdown (ui with svelte-package), bundles the
  vendored Ruken code it needs, and publishes to GitHub Packages. `check-boundaries` is now
  `@mcthaydt/automata-check-boundaries` with an `automata-check-boundaries` bin.
