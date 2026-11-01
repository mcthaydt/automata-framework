# @mcthaydt/automata-host

## 0.0.5

### Patch Changes

- cfb2cf0: AF owns the host contract (DIST.2, ADR 0006). `@mcthaydt/automata-host` now defines the capability names, error codes and
  payloads in its own Zod schemas: `CAPABILITIES`, `ERROR_CODES`, a `*Schema` per payload and their types. The names are
  Ruken's, kept where they fit, and a test holds them to the vendored SDK. `Hosting.kind` adds `'tauri'`. The web adapter's
  `saves.flush` answers `{ persisted: 'device' }`.
  
  BREAKING: the root entry no longer exports an adapter. `HostingLive` and `makeHosting` come from
  `@mcthaydt/automata-host/target` only, and `toHostError` is internal to the Ruken adapter. `ErrorCode`, `Hosting`,
  `HostingLeaderboards` and `HostingSaves` are typed by AF's own contract (the same names and shapes as Ruken's;
  `Hosting.kind` adds `'tauri'`, `SavesFlushRes.persisted` adds `'device'`, the leaderboard `meta` and `query` are
  `LeaderboardSubmitMeta` and `LeaderboardQuery`). `./target` resolves to the web adapter by default: a Ruken build adds
  the `automata-ruken` condition, `resolve: { conditions: ['automata-ruken', ...defaultClientConditions] }`. The
  `automata-web` condition is unchanged.
  
  Migration:
  
  | Before | After |
  | --- | --- |
  | `import type { Capability, LifecyclePayload, … } from '@ruken/sdk'` | `from '@mcthaydt/automata-host'` (same names) |
  | `RukenError['code']` | `ErrorCode` from `@mcthaydt/automata-host` |
  | `Parameters<LeaderboardsApi['submit']>[2]`, `Parameters<LeaderboardsApi['get']>[1]` | `LeaderboardSubmitMeta`, `LeaderboardQuery` |
  | `import { HostingLive, makeHosting } from '@mcthaydt/automata-host'` | `from '@mcthaydt/automata-host/target'` |
  | A Ruken build or test with no condition | add the `automata-ruken` condition |
  | `flush` answering `host-outbox` on the web adapter | `device` |
- b112a01: AF's own fake host (DIST.4, DIST spec §7). `@mcthaydt/automata-testing/host` exports `FakeHosting` (a layer giving
  `Hosting` and `FakeHostControl`) and `fakeHosting` (its control handle and a `make` for boot). They implement AF's host
  contract in process for the `web`, `itch`, `ruken` and `tauri` targets: each target's kind, name, grants and error codes,
  deferred readiness, schema-checked host changes, planned failures, held calls for timeouts, consent, menu and close.
  
  `@mcthaydt/automata-host/contract-suite` publishes the `Hosting` contract's Vitest cases (`describeHostingContract`), which
  every adapter and the fake pass; `vitest` is an optional peer of `host`.
  
  The runtime takes `seams.hosting`: a function that builds the game's `Hosting` in place of the build target's adapter,
  for example `fakeHosting().make`. A game's tests can boot on any target without Ruken's fake host.
- bb98b8b: The desktop (`tauri`) host adapter (DIST.5a, ADR 0006). `@mcthaydt/automata-host/target` under the `automata-tauri`
  condition gives a desktop build's `Hosting`. It is the web adapter's page plus:
  - the game's saves in one `saves.json` store in the app's data folder. They are never kept in `localStorage` or memory;
    when the store cannot be read, `saves` is not granted and every call fails `DENIED`;
  - a flush that writes the store and answers `persisted: 'device'`;
  - Quit (`exit` is granted). `exit` and the window's close request run the game's exiting handlers, then the flush,
    within `HOST_EXIT_CAP`, then quit.
  
  `@tauri-apps/api`, `@tauri-apps/plugin-store` and `@tauri-apps/plugin-process` are optional peers that a desktop game
  installs. `TAURI_MARKERS` and `findTauriMarkers` check that only a `tauri` build holds Tauri's IPC code.
  
  `ui`'s boot failure knows the `tauri` host kind. Its exit action reads "Quit" (the new `quit` copy key), and a saves
  failure that will not clear offers "Continue without loading". The runtime passes `tauri` through to it.
  
  BREAKING: `ui`'s `HostKind` adds `'tauri'`, so an exhaustive `switch` over it must add a case. `BootFailureCopy` adds
  the `quit` key, so a complete copy object must give it. `bootFailureView` now offers "Continue without loading" for a
  non-retryable saves failure on every host but Ruken, and the exit action for an unsupported device wherever exit can be
  granted (Ruken and the desktop).
- de363d9: The packages are MIT licensed: each has `"license": "MIT"` and a `LICENSE` file. Third-party code, fonts and artwork
  keep their own terms; see `LICENSE-SCOPE.md` in the repository.

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
