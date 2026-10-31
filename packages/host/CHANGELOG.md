# @mcthaydt/automata-host

## 0.0.4

### Patch Changes

- bb4e89d: Bundle Ruken's packages from RukenApp `e376a2d`, where they are MIT licensed. `VENDORED.md` names the new commit and hashes, and now also each bundled package's licence and the licence text, which MIT asks every copy of the code to carry. The bundled Ruken code itself is unchanged: every `dist/` is the same as at `d0fa2fe`.
- 2687799: Bundle Ruken's packages from RukenApp `d0fa2fe` instead of `b30d31b` (`VENDORED.md` names the commit and hashes). The bundled `@ruken/sdk-host` and `@ruken/cli` now declare `zod` 4.6.6 (the SDK only as a dev dependency; `@ruken/manifest` does not use zod), so nothing in AF installs 4.6.5 (GHSA-mrhx-c7xc-m3w5). The SDK also trusts Ruken's private beta sites as hosts, and Ruken's host now answers `Hosting.leaderboards.get` with the player's own entry only; the call is unchanged.

## 0.0.3

### Patch Changes

- c07e66a: Document the exports of content, host, node and ship: the content kinds, generators, tuning, flow and diagnostics types and the Vite plugin; the host's analytics properties and test options; the `Files` and `ProcessRunner` services and their live layers; and the ship inputs, `deployDev`, `publishToRuken`, `testRemote`, `rukenToml` and the build checks.
- 5e171d7: `Hosting.saves.keys` lists the session's save keys, sorted; `Hosting.saves.changed` streams another device's write or the host's conflict choice (M5.1).
- 64731c3: `Hosting.onExiting` handlers now run one after another in registration order, then the built-in `saves.flush`, all inside one `HOST_EXIT_CAP`, so a write a handler makes is flushed before the host is answered (the SDK ran its exiting listeners together, so the flush could leave first). A handler that never returns costs the flush, and the host is still answered at the cap. Adds `Hosting.round.ended`, a stream with one item per round that ended (its outcome) that ends when Hosting shuts down; a dropped end gives none.
- 0859c82: `Hosting.leaderboards.submit/get` relay Ruken's `LeaderboardsApi` (PRODUCT.1). Without the `leaderboards` grant, standalone or offline they fail with the SDK's code as a `HostError`; nothing falls back to a local board.
  
  BREAKING: `Hosting` gains the required `leaderboards` member, so a hand-written `Hosting` implementation must add it.
- 3d45178: PUB.1: a web `Hosting` adapter for builds published outside Ruken (itch.io or any static host), chosen at build time through the new `@mcthaydt/automata-host/target` export (`automata-web` condition → web adapter, `default` → Ruken adapter). `Hosting.kind` gains `'web'` and `Hosting.hostName` names the host for UI. `RUKEN_SDK_MARKERS` and `findRukenSdkMarkers` let a build check that an itch bundle holds no Ruken SDK code.
  
  BREAKING: `Hosting` gains the required `hostName` member and `kind` gains `'web'`, so a hand-written `Hosting` implementation must add `hostName`, and a `switch` over `kind` must handle `'web'`. The Ruken adapter and every existing call behave as before.
- 50ec5a9: Depend on `zod` 4.6.6: 4.6.5 and earlier carry GHSA-mrhx-c7xc-m3w5 (a high-severity memory exhaustion while validating oversized constrained collections), which the dependency audit now reports.

## 0.0.2

No changes in this release.

## 0.0.1

### Patch Changes

- c7ae066: First published build (M2.4): every package builds to `dist/` with tsdown (ui with svelte-package), bundles the
  vendored Ruken code it needs, and publishes to GitHub Packages. `check-boundaries` is now
  `@mcthaydt/automata-check-boundaries` with an `automata-check-boundaries` bin.
