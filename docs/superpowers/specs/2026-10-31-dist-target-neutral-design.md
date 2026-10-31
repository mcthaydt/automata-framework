# DIST: an AF-owned host contract and four peer targets (web, itch, ruken, tauri)

> **Status:** Draft, review pending (coordinator). Drafted 2026-10-31 (task DIST.1, docs only) on `main` `bb0b330c`.
> Accepted once its review is done, under the Owner's 2026-10-31 words: "Reminder that everything is auto approved and
> accepted, do not wait on me to do any approvals" (and 2026-10-30, "Auto accept all spec and plans"). The veto
> defaults in §12 stand unless the Owner overrides one. Not implemented: DIST.2 to DIST.6 each start with a TDD plan.
>
> **Why (Owner, 2026-10-31):** "Let's not couple the automata framework so tightly to Ruken - that's just one of the
> many places we can distribute content to easily; we have tauri export, Ruken export, and itch export".
>
> **Decision record:** [ADR 0006](../../adr/0006-distribution-targets.md). **Amends:** the
> [PUB spec](./2026-10-16-publish-targets-design.md) §3 (the target model, `./target`'s default condition, "Ruken stays
> the vocabulary"), §3.1 (`flush` on the web adapter), §2 "Out" (desktop builds) and §10 PUB-D4; the
> [M1 shared contracts spec](./2026-10-11-m1-shared-contracts-design.md) §1.1 to §1.5 (where the types come from, the
> error codes' owner, the required tests). Superseded rows: M7.11 (`host-tauri` in Plus) by DIST.5.

## 0. Sources

| Source | Revision or date | Used for |
|---|---|---|
| This repo | `bb0b330c` | The coupling inventory (§1) |
| Vendored `@ruken/sdk` (`vendor/ruken/ruken-sdk-0.0.0.tgz`), `dist/index.d.ts` | As pinned in `docs/versions.md` | `CAPABILITIES` (14 names), `ERROR_CODES` (10 codes), the payload types kept in §4.1 |
| [Tauri 2: Configuration](https://v2.tauri.app/reference/config/), [Distribute](https://v2.tauri.app/distribute/), [Store plugin](https://v2.tauri.app/plugin/store/), [Process plugin](https://v2.tauri.app/plugin/process/), [CSP](https://v2.tauri.app/security/csp/), [Mocking](https://v2.tauri.app/develop/tests/mocking/) | Read 2026-10-31 | §6 (the desktop adapter and bundle). DIST.5's plan re-reads them and pins exact versions in `docs/versions.md` |
| [itch.io: Uploading HTML5 games](https://itch.io/docs/creators/html5), [butler: Pushing builds](https://itch.io/docs/butler/pushing.html) | As cited in PUB §0 | Unchanged; §6.4 adds the Downloadable channels |

## 1. The coupling today (measured at `bb0b330c`)

`grep "from '@ruken/"` over non-test sources in `packages/` gives:

| Package | Imports | What for |
|---|---|---|
| `host` | `@ruken/sdk` in `hosting.ts`, `errors.ts`, `rounds.ts`, `hosting-live.ts`, `hosting-web.ts` (types), `testing/fake-web-page.ts`; `@ruken/sdk-host/testing` in `testing/hosting-test.ts` | Every `Hosting` type, `ErrorCode = RukenError['code']`, `toHostError`; the test layer is Ruken's fake host |
| `ui` | `@ruken/sdk` types in `geometry/geometry.ts` (`DisplayMetricsPayload`), `browser/landscape-gate.ts` (`FullscreenRes`), `status/boot-failure.ts` (`RukenError['code']`); `build/ruken-sdk.ts` inlines the SDK's declarations into `dist/vendor/` | Layout, fullscreen and boot-failure copy |
| `testing` | `@ruken/sdk` (`DisplayMetricsPayload`) in `fixtures/viewport-window.ts` | The viewport fixture |
| `runtime` | `@ruken/sdk-host/testing` in `testing/runtime-test.ts`; `@ruken/manifest` (`Manifest`) in `extension/define-extension.ts` | `RuntimeTest` runs every runtime test as a Ruken game; `GameConfig` is Ruken's manifest |
| `game` | `@ruken/manifest` (`SLUG_RE`) in `define-game.ts` | The game id rule |
| `content` | `@ruken/manifest` in `game/game-facts.ts` (`Manifest`, `RATINGS`) and `game/ruken-check.ts` (`parseManifest`) | Game facts and the Ruken fields check |
| `ship` | `@ruken/manifest` in `config/ship-config.ts`, `errors.ts`, `deploy/deploy-dev.ts`, `manifest/check-manifest.ts`; `ruken publish` in `publish/publish-to-ruken.ts` | `ShipConfig` *is* Ruken's `Manifest`; the Ruken build and publish |
| `cli` | `@ruken/manifest` (`compileHeaders`) in `check/csp-probe-live.ts` | The CSP probe |

Also: `@mcthaydt/automata-host/target` resolves to the **Ruken adapter by default** and to the web adapter only under
`automata-web` (PUB §3), so a tool that knows nothing of AF's conditions (Vitest, `tsc`, a consumer's bundler) gets
Ruken; and the games' browser journeys (`games/*/e2e/host/host.ts`, `tooling/examples-runner/host/`) host every game
with `@ruken/sdk-host`. There is no desktop target.

## 2. Goal and scope

**Goal.** A game is written once against AF's own host contract and builds for any of `web`, `itch`, `ruken` and
`tauri`, chosen at build time. Ruken is one of four peers and stays fully working.

**In:**
- AF's host contract in `@mcthaydt/automata-host`, in Zod, owned there (§4).
- One adapter per target, each the only importer of its platform's packages, enforced by `pnpm boundaries` (§5).
- An AF fake host in `@mcthaydt/automata-testing` for every game, example and package test (§7).
- `tauri` as a core target: the adapter, `automata-ship prepare|publish --target tauri`, unsigned CI bundles, signing
  with the Owner's credentials, itch.io Downloadable from the same bundles (§6).
- Docs, `create-game` and the website presenting the four targets equally (§9, DIST.6).

**Out:**
- New capabilities. The contract keeps today's surface; no target gains a feature it lacks today except `tauri`'s
  `exit` (Quit) and saves in the app's data folder.
- Steam, mobile app stores, portal SDKs (Poki, CrazyGames). The adapter seam allows them later; none is planned.
- Auto-update for desktop builds (Tauri's updater). itch.io's app updates Downloadable builds; nothing else is planned.
- Changing a game's `ship.config.ts` keys (§4.4: ownership moves, the keys stay).

## 3. Ownership

| State or artifact | Owner (lane, package) | Allowed writers | Consumers |
|---|---|---|---|
| The host contract: capability names, error codes, payload schemas, `Hosting`, `HostError` (§4) | **host**, `packages/host/src/contract/` | host lane, through this spec | every adapter, `runtime`, `game`, `ui`, `testing`, games |
| The Ruken adapter and its conformance tests | host, `packages/host/src/ruken/` | host lane | `./target` under `automata-ruken` |
| The web adapter (`web`, `itch`) | host, `packages/host/src/web/` | host lane | `./target` under `automata-web` and `default` |
| The Tauri adapter | host, `packages/host/src/tauri/` | host lane | `./target` under `automata-tauri` |
| The game config schema (the keys of `ship.config.ts` every target reads) | **content**, `packages/content/src/game/game-config.schema.ts` | content lane | `ship`, `runtime` (`defineExtension`'s `GameConfig`), `game` |
| Each target's build checks, limits and packaging | **ship**, `packages/ship/src/targets/<target>/` | ship lane | `automata-ship prepare|publish --target <target>` |
| The AF fake host | **testing**, `packages/testing/src/host/` | testing lane | every package, example and game test |
| Host-aware UI copy ("Back to …", "Quit", the storage notice) | **ui**, `packages/ui/src/status/` | ui lane | `game`'s default screens |

The sim never sees the target (law 7): the golden replay hash is identical for all four builds of a game.

## 4. The contract (DIST.2)

### 4.1 Names, kept

AF's contract keeps every Ruken name that already fits, so DIST.2 moves ownership without renaming anything a game
calls. The canonical definitions live in `packages/host/src/contract/`, one schema per file with the `*.schema.ts`
suffix, each exporting the Zod schema and its `z.infer` type (with explicit annotations, for `isolatedDeclarations`):

| File | Exports | Values |
|---|---|---|
| `capability.schema.ts` | `CAPABILITIES`, `Capability` | Ruken's 14: `lifecycle`, `input`, `display`, `audio`, `exit`, `menu`, `saves`, `leaderboards`, `entitlements`, `store`, `ads`, `telemetry`, `analytics.custom`, `links` |
| `error-code.schema.ts` | `ERROR_CODES`, `ErrorCode` | Ruken's 10: `UNSUPPORTED`, `NOT_READY`, `TIMEOUT`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, `INVALID_PAYLOAD`, `DENIED`, `OFFLINE`, `CANCELLED`, `INTERNAL` |
| `lifecycle.schema.ts` | `LifecyclePayload`, `PauseBehavior` | As the SDK's |
| `input-mode.schema.ts` | `InputMode`, `InputModePayload` | As the SDK's |
| `display.schema.ts` | `DisplayMetricsPayload`, `FullscreenRes` | As the SDK's |
| `audio.schema.ts` | `AudioChange` | As the SDK's |
| `saves.schema.ts` | `SavesStatus`, `SavesFlushRes`, `SavesChangedPayload` | As the SDK's, **plus** `SavesFlushRes.persisted: 'device'` (§4.3) |
| `entitlements.schema.ts` | `EntitlementsPayload` | As the SDK's |
| `leaderboards.schema.ts` | `LeaderboardSubmitMeta`, `LeaderboardQuery`, `LeaderboardSubmitRes`, `LeaderboardGetRes` | As the SDK's (`meta` and `query` were `Parameters<LeaderboardsApi[…]>`) |
| `round.schema.ts` | `RoundOutcome` | `complete`, `fail`, `quit` |

`hosting.ts` (the `Hosting` interface and tag) and `errors.ts` (`HostError`, `HostHandshakeFailed`) move into
`contract/` and import only from these files and `effect`. `toHostError`, which knows `RukenError`, moves to the Ruken
adapter. The package root (`@mcthaydt/automata-host`) re-exports every name above, so a consumer imports
`Capability`, `ErrorCode`, `DisplayMetricsPayload` and the rest from AF.

**Conformance, not copies.** Keeping Ruken's names means AF now holds lists Ruken also holds. Drift is caught, not
trusted: `packages/host/src/ruken/conformance.test.ts` asserts, against the vendored SDK, that `CAPABILITIES` and
`ERROR_CODES` equal Ruken's arrays element for element, and (with `expectTypeOf`) that each Ruken payload type is
assignable to AF's. A re-vendor that adds a Ruken capability or code fails that test, and the host lane decides the
mapping in this spec before the re-vendor merges. The same pattern covers `@ruken/manifest` (§4.4).

### 4.2 `Hosting`, changed only where a target needs it

The `Hosting` shape of M1 shared contracts §1.1 and PUB §3 is unchanged except:

- `kind: 'ruken' | 'standalone' | 'web' | 'tauri'`. `'standalone'` still means the Ruken adapter got the SDK's
  standalone session.
- `hostName`: `'Ruken'`, `'itch.io'`, `'this page'` (web) or the game's title (tauri). The UI's exit label comes from
  `kind` (`'tauri'` gives "Quit"), not from `hostName` (§8).
- `HostingOptions.gameId`'s doc says "the game config's `game.id`", not "ruken.toml".

### 4.3 Capabilities and behavior per target

What each adapter grants. "Fails" means `HostError` with that code; no row silently falls back (AGENTS.md "Honor host
authority").

| Capability | `ruken` | `web` and `itch` (PUB §3.1, unchanged) | `tauri` |
|---|---|---|---|
| `lifecycle` | The host's | Page Visibility and focus | The same, from the webview window |
| `input` | The host's | Real pointer, keyboard and gamepad events | The same |
| `display` | The host's | `visualViewport` | The same (the window's viewport) |
| `audio` | The host's | Granted | Granted |
| `exit` | The host's | Not granted; fails `UNSUPPORTED` | **Granted:** runs the `onExiting` handlers, flushes saves, then quits the app |
| `menu` | The host's | Not granted (the game's own menu) | Not granted |
| `saves` | The host's | `localStorage` when the probe succeeds; otherwise not granted and calls fail `DENIED`; a full quota fails `QUOTA_EXCEEDED` | A store file in the app's data folder (§6.1); when it cannot be opened, not granted and calls fail `DENIED` |
| `savesStatus`, `flush` | The host's | `saved`; `persisted: 'device'` | `saved`; `persisted: 'device'` |
| `leaderboards`, `entitlements`, `store`, `ads`, `telemetry`, `analytics.custom`, `links` | The host's | Not granted; calls fail `UNSUPPORTED`; `track` drops | The same |

`persisted: 'device'` is new (PUB §9 request 3 is now AF's to answer, since AF owns the type). The web adapter answers
`'host-outbox'` today, mirroring the SDK's standalone session; DIST.2 switches it to `'device'` and the Ruken adapter
relays Ruken's values unchanged.

### 4.4 The game config

`ShipConfig` is Ruken's `Manifest` today. DIST.3 gives it an AF owner without changing a key:
- `packages/content/src/game/game-config.schema.ts` defines `GameConfigSchema` in Zod with today's keys and Ruken's
  snake_case (`game`, `runtime`, `network`, `content`, `analytics`, `loading`, `leaderboards`), and AF's own enums
  (`RATINGS`, the renderer, orientation and input lists, the game id pattern) where Ruken's are used today.
- `ShipConfig` becomes `GameConfig` plus the target sections it already has (`itch`, `audience`) and a new optional
  `tauri` (§6.3). `defineExtension`'s `GameConfig` and `defineGame`'s id check read the content schema.
- Ruken-only fields (`game.sdk`, `loading`, `leaderboards` slugs, `analytics.custom_events` when sent to Ruken) stay
  in the same places and are required only when the game builds for `ruken`; `prepare --target ruken` still parses the
  whole config with `@ruken/manifest`'s `parseManifest` and fails on what Ruken refuses.
- `packages/ship/src/targets/ruken/conformance.test.ts` asserts AF's enums equal or are a subset of Ruken's
  (`RATINGS`, the id pattern against `SLUG_RE` on fixtures).

**Migration for configs: none.** Every existing `ship.config.ts` type-checks unchanged.

## 5. The adapter boundary (DIST.2, DIST.3)

### 5.1 Where a platform's packages may be imported

A `pnpm boundaries` rule (`tooling/check-boundaries`, new `platform-imports` check) scans `packages/`, `games/`,
`examples/` and `tooling/` and fails any import of a platform's packages outside a folder named for its target:

| Packages | Allowed only under a path segment |
|---|---|
| `@ruken/sdk`, `@ruken/sdk-host`, `@ruken/manifest`, `@ruken/cli` | `ruken/` |
| `@tauri-apps/*` | `tauri/` |

The check covers static and dynamic imports and `export … from`, with tests included: Ruken's fake host is a Ruken
test tool. Its error names the file, the import and the AF replacement (for example `@ruken/sdk` `Capability` →
`@mcthaydt/automata-host` `Capability`). The few build scripts that only *name* a vendored tarball
(`tooling/release`, `tooling/versions`, `create-game`'s generated `package.json`) contain strings, not imports, and
are not affected.

### 5.2 Where the folders are

| Today | After |
|---|---|
| `host/src/hosting-live.ts`, `toHostError`, `sdk-markers.ts`, handshake and test-origin tests, `testing/hosting-test.ts` | `host/src/ruken/` (`hosting-ruken.ts`, `errors-ruken.ts`, …); `HostingTest` stays exported from `./testing` as the Ruken adapter's test layer, documented as Ruken-only |
| `host/src/hosting-web.ts`, `testing/fake-web-page.ts` | `host/src/web/`; `StorageLike` becomes a local interface |
| (new) | `host/src/tauri/` (§6.1) |
| `ui/build/ruken-sdk.ts` (inlined SDK declarations) | Deleted: `ui` types come from `@mcthaydt/automata-host` |
| `runtime/src/testing/runtime-test.ts` (`FakeHostOptions`) | Runs on the AF fake host (§7); a Ruken variant, if a test needs one, lives in `runtime/src/testing/ruken/` |
| `content/src/game/ruken-check.ts` | `content/src/game/ruken/ruken-check.ts`, called only for a game that builds for `ruken` (the compiler's Vite plugin receives the target) |
| `ship/src/manifest/*`, `publish/publish-to-ruken.ts`, `deploy/deploy-dev.ts`, Ruken parts of `errors.ts` | `ship/src/targets/ruken/` |
| `ship/src/targets/itch-*.ts`, `prepare-itch.ts`, `publish/publish-to-itch.ts` | `ship/src/targets/itch/` (moved for symmetry; no `@ruken` import) |
| `cli/src/check/csp-probe-live.ts` | `cli/src/check/ruken/` (it compiles Ruken's headers) |
| `games/*/e2e/host/host.ts`, `tooling/examples-runner/host/` | `…/e2e/ruken/`, `…/host/ruken/` for the Ruken journeys |

### 5.3 Choosing the adapter at build time

`@mcthaydt/automata-host/target` gets one condition per adapter, and `default` becomes the target-neutral web adapter,
so a tool that does not know AF's conditions never pulls a platform SDK:

```json
"./target": {
  "automata-ruken": "./src/ruken/target.ts",
  "automata-tauri": "./src/tauri/target.ts",
  "automata-web": "./src/web/target.ts",
  "default": "./src/web/target.ts"
}
```

A game's Vite config sets `resolve.conditions: ['automata-<target>', ...defaultClientConditions]` from Vite's
`--mode` (`vite build --mode ruken|itch|web|tauri`). Its scripts are `build:<target>` for each target it ships; plain
`build` is removed from the template so no target is implied (DIST.6). Each bundle holds exactly one adapter; the
existing marker check (`RUKEN_SDK_MARKERS`) runs on every non-Ruken build, and DIST.5 adds the matching check that a
non-Tauri bundle holds no Tauri IPC code.

## 6. The `tauri` target (DIST.5)

### 6.1 Adapter (`packages/host/src/tauri/hosting-tauri.ts`)

The web adapter's behavior, plus:
- **Saves** through `@tauri-apps/plugin-store`, one store file (`saves.json`) in the app's data folder. `get`/`set`/
  `remove`/`keys` map to the store; `flush` calls the store's `save()` and answers `persisted: 'device'`. A store that
  fails to load leaves `saves` ungranted and every call fails `DENIED`; a failed write fails `INTERNAL` (retryable).
  Never `localStorage`, never memory.
- **Exit** (`exit()`, and the window's close request through `onCloseRequested`): runs the `onExiting` handlers in
  order under `HOST_EXIT_CAP` (1 s), flushes saves, then quits through `@tauri-apps/plugin-process`'s `exit(0)`. A
  close request waits for the same sequence.
- `hostName` is the game's title; `kind: 'tauri'`.
- `@tauri-apps/api`, `@tauri-apps/plugin-store` and `@tauri-apps/plugin-process` are optional peer dependencies of
  `@mcthaydt/automata-host`, installed by a game that builds for `tauri` (`create-game` adds them, DIST.6).

### 6.2 Bundle (`packages/ship/src/targets/tauri/`)

`automata-ship prepare --target tauri`, after a `vite build --mode tauri`:
1. The existing checks: version tag, no root-absolute paths, the web build's `index.html`.
2. Tauri's checks, in `tauri-checks.ts` with their sources: `tauri.identifier` is reverse-DNS; `game.version` is
   semver; the generated CSP has no `unsafe-eval` (the no-`eval` rule for every web build).
3. Writes a generated Tauri project (`tauri.conf.json` from the game config: `productName` = `game.title`, `version`,
   `identifier`, one window sized from `runtime.orientation`, `app.security.csp`; a fixed minimal `src-tauri` with the
   store and process plugins) into `.automata/tauri/`, never into the game's source.
4. Runs the pinned `@tauri-apps/cli` `tauri build` through ship's `ProcessRunner` for the host OS, and copies the
   bundles to `dist-tauri/<id>-<version>-<os>.<ext>`.

Missing toolchain (Rust, or Linux's WebKitGTK headers) fails before the build, naming what to install. Tauri builds
for the OS it runs on, so the Linux bundle builds wherever CI runs; macOS and Windows bundles build on the Owner's
runners (§10).

### 6.3 Config

```ts
export default defineShipConfig({
  game: { id: 'emberwick', title: 'Emberwick', version: '1.2.0', entry: 'index.html' },
  // runtime, network, content: unchanged
  tauri: { identifier: 'dev.mcthaydt.emberwick' },
  itch: { project: 'mcthaydt/emberwick', channel: 'html5' },
})
```

### 6.4 Signing and itch.io Downloadable

- CI builds are **unsigned**, and the release notes say so.
- Signing and notarization run only in the release environment, with the Owner's secrets: macOS `APPLE_CERTIFICATE`,
  `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`; Windows a code-signing certificate (the
  Owner chooses the provider). A missing secret fails the signing job by name; it never ships an unsigned bundle as
  signed.
- `automata-ship publish --target itch --from tauri` pushes each bundle present to its butler channel (`windows`,
  `mac`, `linux`, or `itch.downloads` overrides), with the same `--userversion` and `--if-changed` as HTML5. That is how
  a game sells on itch.io (PUB §2 "Out", now in).

## 7. The AF fake host (DIST.4)

`@mcthaydt/automata-testing` exports `FakeHosting` from `./host`: a `Layer` providing `Hosting` (and a
`FakeHostControl` handle) that implements §4 in process, with no window messages and no platform package:

- `target`: `'web' | 'itch' | 'ruken' | 'tauri'` sets `kind`, `hostName` and the default grants of §4.3.
- `granted` overrides the grants; an ungranted capability fails exactly as §4.3 says for that target.
- Readiness: `ready` resolves at once, or on `control.welcome()` when `deferReady: true`; `control.failReady(code)`.
- Lifecycle, input, display, audio, entitlements and saves status: `control.push(…)`, each validated by its §4.1
  schema (an invalid fixture fails the test, not the game).
- Saves: an in-memory map the test can seed and read, with `control.failNext('saves.set', 'QUOTA_EXCEEDED')`.
- Timeouts: requests can be held (`control.hold('saves.flush')`) and the test advances Effect's `TestClock`.
- Consent: `track` records only disclosed events, and nothing when `consent: false`.
- Exit and menu: records `exit` calls; `control.requestMenu()` and `control.close()` drive the game's handlers.

The **host contract suite** (`packages/host/src/testing/hosting-contract.ts`, today on two adapters) runs against the
Ruken adapter (over `@ruken/sdk-host`), the web adapter, the Tauri adapter (over `@tauri-apps/api/mocks`) and
`FakeHosting`, so the fake cannot drift from the real adapters. Each intended difference is a pinned test named after it.

**Source and origin checks.** `FakeHosting` exchanges no window messages, so it has nothing to check. Every harness that
does listen to window messages (the Ruken frame host in `e2e/ruken/`, the itch-like harness, the examples playground)
validates both `event.source` and `event.origin`, and keeps its test that a wrong source or origin is ignored.

Games, examples and package tests switch to `FakeHosting`; `@ruken/sdk-host` stays only in `ruken/` folders.

## 8. Ordered flows

1. **Build for a target.** `pnpm build:<target>` → Vite with `automata-<target>` → the bundle holds that adapter only →
   the marker checks pass → `automata-ship prepare --target <target>` runs that target's checks (§6.2, PUB §4, the
   Ruken manifest) → the artifact (`dist/`, the itch zip, `ruken.toml` + build, or the Tauri bundles).
2. **Boot.** `runGame` builds the `Hosting` layer from `./target` → awaits `ready` → reads `granted` → shows the game.
   A failed `ready` shows the boot failure (M1 shared contracts §3) with `hostName` in its copy and, when `exit` is
   granted, "Back to Ruken" (`ruken`) or "Quit" (`tauri`); otherwise no exit action.
3. **A capability missing on a target.** The game reads `granted` before offering a feature (the leaderboard screen is
   hidden without `leaderboards`). A call made anyway fails `UNSUPPORTED` (not offered by the target) or `DENIED`
   (offered but refused), and the caller shows its own message. Nothing switches to another storage or path.
4. **Consent.** `track` sends only events the game disclosed (`analytics.custom_events`) and only where the target
   grants `analytics.custom`; elsewhere it drops them and never fails. No target adds analytics of its own.
5. **Saves fail.** Storage blocked (web) or the store unreadable (tauri): `saves` not granted, the "Progress won't be
   saved" notice, the game runs on. A full quota or failed write: the save service reports it (M5) and keeps the
   in-progress state; `retryable` decides whether it retries with `Schedule`.
6. **Close.** Ruken's `exiting`, a page's `pagehide`, or Tauri's close request → `onExiting` handlers under the 1 s cap →
   save flush → the host closes (Ruken, Tauri) or the page unloads (web).
7. **Recovery.** A Ruken session that fell back to standalone keeps running (shared contracts §1.2). A Tauri store
   written by a newer game version is read by the save service's migrations, as on every target.

## 9. How each row lands

| Row | Lane | Depends on | Delivers | Plan |
|---|---|---|---|---|
| DIST.2 | host | DIST.1 | §4 in `contract/`; adapters in `ruken/` and `web/`; `toHostError` in `ruken/`; the conformance test; `./target`'s conditions with `default` = web (§5.3); `persisted: 'device'`; the contract suite on both adapters; changeset (minor, `host`) and the migration note (§11) | `docs/superpowers/plans/2026-10-31-dist-2-host-contract.md` |
| DIST.3 | game, runtime, ui, testing, content, ship, cli | DIST.2 | Every §5.2 move; `ui`, `testing`, `runtime`, `game` on AF's types; the game config schema (§4.4); the `platform-imports` boundaries rule; the games' Vite configs and scripts set `--mode` (this touches `games/base-3d/vite.config.ts` and `package.json`, owned by the 3D lane: a two-line change, flagged in the PR); host-neutral copy | `…/2026-10-31-dist-3-ruken-boundary.md` |
| DIST.4 | testing | DIST.2 | `FakeHosting` (§7) and the contract suite on it; `RuntimeTest`, examples and games' unit tests on it | `…/2026-10-31-dist-4-fake-host.md` |
| DIST.5 | host, ship | DIST.2 (adapter), DIST.3 (`targets/` layout) | §6: the adapter, `prepare|publish --target tauri`, the Linux bundle in local CI, the signing job, itch.io Downloadable; supersedes M7.11 | `…/2026-10-31-dist-5-tauri.md` |
| DIST.6 | ship (template, docs), website lane | DIST.3, DIST.5 | `create-game` asks which targets (default: all four) and writes their scripts, configs and dependencies; "Publish to Ruken / itch.io / the web / desktop" guides; the website copy (website lane, other repo) | `…/2026-10-31-dist-6-docs-template.md` |

DIST.2 and DIST.4 can run in parallel after DIST.2's contract files merge; DIST.5's adapter needs only DIST.2.

## 10. Tests and gates

| Layer | What | Where |
|---|---|---|
| Unit (Node, `TestClock`) | The contract suite on four implementations (§7); each adapter's own cases (Ruken handshake and origin; web storage probe; Tauri store, close sequence, missing store) | `packages/host/src/**`, `packages/testing/src/host/` |
| Unit | Conformance with the vendored Ruken packages (§4.1, §4.4) | `host/src/ruken/`, `ship/src/targets/ruken/` |
| Unit | `platform-imports`: each forbidden import fails on a fixture, each allowed folder passes, the message names the replacement | `tooling/check-boundaries` |
| Unit | Tauri checks fail on their fixtures; the generated `tauri.conf.json` is byte-identical for the same config; missing Rust or WebKitGTK fails before `tauri build` (fake `ProcessRunner`) | `packages/ship/src/targets/tauri/` |
| Build | Each target's bundle of the placeholder holds only its adapter (Ruken markers absent from web, itch and tauri; Tauri markers absent from web, itch and ruken) | `packages/host`, consumer smoke |
| Browser (Playwright) | The Ruken journeys (frame host) and the itch-like harness, unchanged; a `tauri` build's web content served with `@tauri-apps/api/mocks` boots, saves through the mocked store and quits through the mocked process plugin | games' and examples' E2E |
| Parity | The golden replay hash is identical for a game's four builds | the parity suite, with the extra builds |
| Desktop | `prepare --target tauri` produces a Linux AppImage and `.deb` in local CI; macOS and Windows bundles on the Owner's runners | DIST.5 |
| Device (Owner) | One game launched from each desktop bundle on its OS, a save surviving a restart, Quit closing it; one Downloadable build pushed to a real itch.io page | Owner, recorded with device and date |

Required gates per row: `pnpm check` (lint, typecheck, `boundaries`, `style`, `knip`, unit), `pnpm build`,
`api-report`, `api-index`, `agent-skills`, changesets, and parity for each package whose goldens or renderer the row
touches.

## 11. Migration

The packages are 0.x, so DIST.2 and DIST.3 are minor bumps with changesets. The migration note (in each changeset, so it reaches
each package's `CHANGELOG.md`):

| Before | After |
|---|---|
| `import type { Capability, LifecyclePayload, … } from '@ruken/sdk'` | `from '@mcthaydt/automata-host'` (same names) |
| `RukenError['code']` | `ErrorCode` from `@mcthaydt/automata-host` |
| `Parameters<LeaderboardsApi['submit']>[2]` | `LeaderboardSubmitMeta` |
| A game's Vite config with no condition (a Ruken build) | `--mode ruken` and the `automata-ruken` condition (§5.3) |
| `HostingTest` / `@ruken/sdk-host` in a game's unit tests | `FakeHosting` from `@mcthaydt/automata-testing/host` |
| `flush` answering `host-outbox` on web | `device` |

**No codemod** (veto default DIST-D5): the only consumers are this repo's games, examples and template, which DIST.3
updates in the same PR, and the `platform-imports` error names each replacement.

## 12. Decisions for the Owner's veto (defaults taken)

| ID | Question | Default | Why |
|---|---|---|---|
| DIST-D1 | Rename to AF-specific names? | **No: keep Ruken's names** where they fit, with a conformance test | ADR 0006: "a move of ownership, not a rename"; no game code changes |
| DIST-D2 | `./target`'s `default` condition | **The web adapter**; Ruken needs `automata-ruken` | No target is the default reference; tools unaware of AF's conditions never pull a platform SDK |
| DIST-D3 | `SavesFlushRes.persisted` for device storage | **Add `'device'`** (web and tauri) | AF owns the type now; `'host-outbox'` was a stand-in (PUB §9.3) |
| DIST-D4 | Where the game config schema lives | **`content`** (`game-config.schema.ts`), keys unchanged | `content` already owns the game facts; `runtime` and `game` already depend on it; `ship` gains the dependency |
| DIST-D5 | Codemod | **None**, a migration table and a boundaries message | Only in-repo consumers today |
| DIST-D6 | Tauri saves | **`plugin-store` in the app data folder**, `DENIED` when unavailable | One file, atomic save; never `localStorage` or memory |
| DIST-D7 | Tauri packages | **Optional peer dependencies** of `host` | Only a `tauri` build installs them |
| DIST-D8 | Desktop signing | **Unsigned CI bundles; signing only in the release environment** with the Owner's secrets | Credentials are the Owner's |
| DIST-D9 | `create-game`'s default targets | **All four**, each removable | The four are peers |

## 13. Acceptance

- **DIST-a (contract):** `@mcthaydt/automata-host` defines every name in §4.1; nothing in `host/src/contract/`
  imports `@ruken/*`; the conformance test passes against the vendored SDK and fails when a fixture adds a Ruken
  capability.
- **DIST-b (boundary):** `pnpm boundaries` passes on the repo and fails on a fixture importing `@ruken/sdk` from
  `packages/ui/src/` with the replacement named; the same for `@tauri-apps/api` outside `tauri/`.
- **DIST-c (parity of adapters):** the contract suite passes on the Ruken, web and Tauri adapters and `FakeHosting`;
  each difference is a named pinned test.
- **DIST-d (no fallback):** on each target, an ungranted `saves` fails `DENIED` or `UNSUPPORTED` and writes nothing to
  `localStorage`, memory or disk (a spy on each proves it); the UI shows the notice.
- **DIST-e (bundles):** the placeholder's four builds each hold only their adapter; their golden hashes match.
- **DIST-f (tauri):** `prepare --target tauri` makes a Linux bundle in local CI; with mocks, the game boots, saves,
  and Quit runs the exit handlers then the flush then `exit(0)` in that order; a missing toolchain fails before the
  build with its name. **Failure case:** a CSP containing `unsafe-eval` fails `prepare`.
- **DIST-g (ruken still whole):** the Ruken E2E journeys, `prepare --target ruken`, `ruken.toml` output and `publish`
  pass unchanged.
- **DIST-h (docs and template):** a game generated with the four targets runs each `build:<target>` green with no edits.
- **Owner gates (never ticked by an agent):** signing credentials; a signed bundle launched on macOS and Windows; one
  Downloadable push to a real itch.io page, recorded with URL, device and date.

## 14. Proposed row text for 02 (for the coordinator)

- DIST.3 adds `content`, `ship` and `cli` to its lanes (the §5.2 moves) and the games' `--mode` scripts.
- DIST.4's "source and origin checks" reads: "source and origin checks stay in every harness that listens to window
  messages; `FakeHosting` exchanges none (§7)".
