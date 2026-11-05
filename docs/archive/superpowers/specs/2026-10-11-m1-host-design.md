# M1.4 Host: `Hosting` on Ruken's SDK, and the fake-host test layer

- **Status:** Drafted 2026-10-11 (lane **host**) and revised the same day to follow the [M1 shared contracts](./2026-10-11-m1-shared-contracts-design.md) §1. Not yet reviewed.
- **Task:** M1.4 in the [master delivery plan](../../02-master-delivery-plan.md). Detail level: [01 Decomposition](../../01-decomposition.md) §5.
- **Parents:**
  - the shared contracts §1, which own the `Hosting` shape, the errors, the fallback rule and the required tests;
  - the [Ruken-first master spec](./2026-10-11-automata-framework-ruken-first-design.md), law 7 and §§4, 6, 7;
  - the [extraction map](./2026-10-11-core-and-extensions-extraction-map.md), `host` section;
  - [ADR 0003](../../adr/0003-effect-outside-the-sim.md) and [ADR 0004](../../adr/0004-ruken-first-host.md);
  - the [S6 verdict and Ruken's answers](../../spikes/s6-ruken-stub.md).
- **Source commits:**
  - RukenApp `b30d31b`: `packages/sdk` and `packages/sdk-host`, consumed from [`vendor/ruken/`](../../../vendor/ruken/README.md), which the integration owner owns.
  - FloorFifty `122a220`: `apps/client/src/ruken/*` and `tests/client/ruken/*`.

This spec refines behavior inside the contract's shape. Where the two differ, the shared contracts win.

## 1. Goal and boundaries

A game reaches its host only through `Hosting`. One layer, `HostingLive`, wraps `Ruken.init`, and the SDK decides between a hosted session and its standalone one. Tests use `HostingTest`: `HostingLive` running on an `SdkEnv` wired to `@ruken/sdk-host`'s fake host, with the real SDK in between.

**Deliverables:** `packages/host` (`@mcthaydt/automata-host`) with two entry points:
- `.`: `Hosting`, `HostingLive`, `makeHosting`, `HostError`, `HostHandshakeFailed`, `toHostError` and `HOST_EXIT_CAP`;
- `./testing`: `HostingTest`, `FakeHostHandle`, `manualClock`, `realClock` and `runScoped`.

**Not in M1.4:**

| Work | Where it goes |
|---|---|
| Leaderboards, store, ads and links | Extension services (shared contracts §1.1). FloorFifty's breaks and links tests move with them. |
| `hostReserved` insets, `scale` as HUD size, safe area | The `ui` geometry owner (M1.6) reads `Hosting.display`. |
| Settings, and which settings stay on the device (FloorFifty's `keepAudioOnDevice`) | `runtime` settings (M1.5) |
| Pause policy from lifecycle and the menu | `runtime` Time (M1.5) |
| Standalone analytics providers | The `telemetry-extra` extension |
| The two-origin browser check from S6 | The browser runner, once **ship** wires it (M1.1) |
| The `host/lifecycle-and-saves` demo | Waits on `base-2d` ([examples README](../../../examples/README.md)) |

## 2. Ownership

| State | Owner | Writers | Readers |
|---|---|---|---|
| Handshake, origin and source checks, grants, request timeouts, saves engine and limits | `@ruken/sdk` | The SDK only | `Hosting` relays them |
| Hosted or standalone, and whether a framed page fell back | `HostingLive`, from the SDK's session | The SDK's choice | Boot (M1.5), a dev overlay |
| Readiness (`session.ready`, R-04) | The host | The host | Boot renders no gameplay before it |
| Menu handlers | `Hosting` (latest registered, held back until ready) | Screens, for their scope | The host's "Open game menu" |
| Exiting handlers | `Hosting` (each cut at `HOST_EXIT_CAP`) | Any scope | The host's close |
| Open round | `Hosting` (`guardRounds`) | `round.start` / `round.end` | Ruken's play metrics |
| Disclosed analytics names | The game (`HostingOptions.disclosedEvents`, from `[analytics].custom_events`) | Content (M1.3) | `track` |

The sim never sees `Hosting` (law 1, ADR 0003).

## 3. Contracts

The `Hosting` shape, `HostError` and `HostHandshakeFailed` are exactly the shared contracts' §1.1 and §1.2. Ruken's types come from `@ruken/sdk` and are never copied. This lane adds:

- **`HostingOptions`:** `gameId`, `wants`, `pauseBehavior`, optional `disclosedEvents`, and optional `testHostOrigins` (for test builds only, passed to `Ruken.init` unchanged). In M1 the game passes these by hand; from M1.5 content supplies them.
- **`HostingLive(options, seams?)`** is a `Layer<Hosting, HostError>`. `makeHosting` is the same thing as a scoped Effect. The only seam is `env: SdkEnv`, the SDK's own test hook. `Ruken.init` rejects only for invalid options (a build bug); that rejection becomes `HostError{operation:'init'}`, so boot can show an error state instead of crashing.
- **`toHostError(operation, cause)`:**
  - a `RukenError` keeps its code and retryable flag;
  - the `QuotaExceededError` that Ruken's save map throws becomes `QUOTA_EXCEEDED`, not retryable (Ruken's flag);
  - anything else becomes `INTERNAL`, retryable.
- **`HOST_EXIT_CAP = 1 s`** comes from FloorFifty `ruken/exit.ts`. It is inside Ruken's 1.5 s grace (`sdk-host/src/bridge/defaults.ts` `EXIT_GRACE_MS`).
- **Subscribables:** `changes` starts with the current value and then emits each change, like `SubscriptionRef.changes`. The listener is registered before the current value is read, so no change can be lost in between.
- **`./testing`:**
  - `HostingTest({ hosting?, host?, env?, gameOrigin? })` provides `Hosting` and `FakeHostHandle` (`host`, `sentByGame(type)`).
  - `manualClock()` implements both the fake host's `BridgeClock` and the SDK's `SdkTimers`, so one clock drives SDK and host timing (shared contracts §1.4).

## 4. Data and lifecycle flow

1. `makeHosting` creates the menu dispatcher. It then calls `Ruken.init({ gameId, wants, pauseBehavior, testHostOrigins, onMenuRequest })` and releases the session with `dispose()` when the scope closes.
2. The SDK sends `hello` every 250 ms and gives up after 10 s. It accepts a `welcome` only from `window.parent` and an allowlisted origin. With no usable welcome it returns its standalone session (`sdk/src/handshake.ts`).
3. If the session is not hosted and the page is framed (`!env.isTopLevel`, or `window !== window.top`), `handshake.fellBack` is `Some(HostHandshakeFailed{ reason: 'no-welcome' })` and one warning is logged with `Effect.logWarning`. The game keeps running standalone.
4. Once `session.ready` resolves, the menu dispatcher starts asking handlers. Until then it answers `false` without asking (§5).
5. The observed state (lifecycle, input, display, audio, entitlements and saves status) wraps the SDK's current values and their `on('change')` events.
6. `onExiting(handler)` registers an SDK `exiting` listener for its scope. The listener runs the handler on the caller's runtime, so it uses the same `Clock`, and cuts it off at `HOST_EXIT_CAP`. A failure is logged, never thrown at the host.
7. `makeHosting` registers one exiting handler of its own: it flushes saves, capped at `HOST_EXIT_CAP`, so saves still in flight reach the host before it closes the game (FloorFifty `ruken/exit.ts`).
8. The handshake can be interrupted, so boot may stop waiting on a frame that isn't Ruken's. A session that arrives after the interrupt is disposed at once.
9. When the scope closes, three things happen in order. Hosting marks itself closed, after which saves, `setFullscreen` and `exit` fail with `HostError{code:'CANCELLED'}` instead of being dropped. Every observed stream ends. Then the session is disposed.

## 5. Failure policy

AF relays every SDK error as `HostError` and adds no gate, fallback or no-op of its own (shared contracts §1.3). There are two exceptions, both pinned by tests:
- **Menu before ready:** a `menu.open` that arrives before `session.ready` answers `false` and never reaches a handler. The SDK at `b30d31b` has no `NOT_READY` check (§7).
- **Exiting handlers:** each is cut off at 1 s, and its failure is logged.

| Case | Behavior |
|---|---|
| Framed, no welcome within 10 s (wrong origin, forged source, no host) | Standalone, `fellBack` set, one warning |
| Second welcome | Ignored by the SDK |
| Save over a Ruken limit | `HostError{code:'QUOTA_EXCEEDED'}`, cached value unchanged, nothing sent |
| Bad save key | `HostError{code:'INVALID_PAYLOAD'}` |
| `saves` not granted | SDK behavior, pinned: writes stay in memory, nothing is sent, `flush` fails with `UNSUPPORTED` (§7) |
| No `localStorage` on a standalone page | SDK behavior, pinned: saves last the visit |
| Undisclosed or malformed analytics event | Dropped with a logged warning, never thrown |
| Unconsented analytics event | Dropped by the SDK |
| Call after Hosting shut down | `HostError{code:'CANCELLED'}` |
| Invalid options passed to `Ruken.init` | `HostError{operation:'init'}` from the layer |
| Unbalanced rounds | A second start and an orphan end are dropped |
| An exiting handler that never ends | Cut off at 1 s on Effect time |

## 6. UI inventory and responsive behavior

`Hosting` has no UI. It feeds other lanes:

| Input | Consumer |
|---|---|
| `ready` | The boot gate (M1.5) |
| `display` (`hostReserved`, `safeArea`, `scale`, `fullscreen`, `orientation`) | The `ui` geometry owner (M1.6) |
| `lifecycle` | Time (M1.5) |
| `audio.gain` | Audio (M5) |
| `setFullscreen().support` | FloorFifty's Home Screen hint (`ui`) |
| `handshake.fellBack` | A dev overlay (M1.5/M1.6) |

## 7. Ruken alignment and requests to Ruken

| Behavior | Ruken source |
|---|---|
| Handshake, allowlist, source check, `testHostOrigins` | `sdk/src/{handshake,allowlist,init}.ts` |
| Errors and codes | `sdk/src/errors.ts`; `protocol/src/meta/errors.ts` |
| Saves and limits | `sdk/src/{save-map,saves-storage,saves-local}.ts` (a value's size counts its bytes only, `save-map.ts:48`) |
| Standalone session | `sdk/src/standalone.ts` |
| Fake host | `sdk-host/src/testing/*` |

Found while building this lane, recorded in shared contracts §1.6 and in 03 Continuation as requests to Ruken:
1. `saves.set` and `saves.remove` still carry `baseRevision` and `writeId` (S6 answers 4 and 9 said they would go). The tests assert only `key` and `value`.
2. A write without the `saves` grant is cached in memory instead of failing with DENIED (S6 answer 3).
3. The SDK has no `NOT_READY` answer for `menu.open` before ready (S6 answer 6). AF guards it (§5).

## 8. Test allocation

All tests run in Vitest on Node, against the real SDK and the fake host over in-memory ports. SDK timing runs on `manualClock` and AF timing on `TestClock`. No test sleeps on wall time.

| File | Covers |
|---|---|
| `errors.test.ts` | `toHostError` mapping; `HostHandshakeFailed` |
| `rounds.test.ts` | `guardRounds` |
| `handshake.test.ts` | Hosted; top-level standalone with no fallback; framed timeout falls back with one warning; forged source, forged self-welcome and wrong origin; one welcome; locale and player; `ready` before and after |
| `state.test.ts` | Display (with the reserved edge), audio gain (master, mute, ad ducking), lifecycle (hidden and shown, drawer reason), input mode, entitlements: each one's current value and change |
| `saves.test.ts` | Snapshot read, set, remove, flush; quota and bad key relayed; syncing, saved, offline-queued, conflict, recovered; no grant (pinned) |
| `requests.test.ts` | Menu (refused until a handler says yes, latest handler wins, removed with its scope, guarded before ready); exiting (runs before `exitReady`, cut off at 1 s on `TestClock`, removed with its scope); `exit` defaults to `player`; `setFullscreen` returns `support`; rounds; analytics (consent, none without, undisclosed dropped) |
| `test-host-origin.test.ts` | A listed test host is accepted; an unlisted one, or a different origin, falls back |
| `shutdown.test.ts` | Streams end on shutdown; calls after shutdown fail with `CANCELLED`; the built-in exit flush runs, and is cut off at 1 s; the dropped-`track` warning; an interrupted handshake disposes a late session; invalid options give a typed error |
| `standalone.test.ts` | Ready at once, neutral state, nothing sent; saves under `ruken:<gameId>:`; exit, fullscreen and rounds relayed; no storage (pinned) |
| `vendor.test.ts` | The vendored tarballs install and complete a handshake |

**FloorFifty's 13 files and where each one went:**

| FloorFifty file | Where it lives now |
|---|---|
| `hosting.test.ts` | Here (`handshake`, `saves`, `standalone`, `requests`) |
| `menu-request.test.ts` | Host half here; the screen cases go to M1.5 |
| `exit-and-links.test.ts` | Exit and exiting here; links go to the links extension |
| `analytics.test.ts` | Here; `character_selected` wiring stays in FloorFifty |
| `audio-host-gain.test.ts` | Here; the mixer is M5's |
| `fullscreen-hosted.test.ts` | Here; the Home Screen hint goes to M1.6 |
| `host-reserved.test.ts` | Metrics here; the inset CSS goes to M1.6 |
| `game-end-break.test.ts` | Ads extension |
| `rounds.test.ts` | The guard here; round timing stays in the game |
| `sleep-hosted.test.ts` | Lifecycle here; the sleep policy goes to M1.5 |
| `settings-hosted.test.ts` | Saves here; the settings shape goes to M1.5 |
| `test-host-origin.test.ts` | Here; the build-time variable goes to M1.2 |
| `support.ts` | Became `./testing` |

**S6 cases:** forged source and self-welcome, second welcome, the 10 s give-up, ready gating, the menu before ready, error mapping, and saves limits relayed. The allowlist table and the catalog-generated tests stay in Ruken's own SDK suite (`allowlist.test.ts`, `golden.test.ts`), which runs there whenever the SDK is re-vendored.

## 9. Feedback workflow and exit criteria

- **Iterate:** `pnpm --filter @mcthaydt/automata-host test`, or `pnpm vitest run <file>`.
- **Gate:** a full local CI run on Node 24 (`pnpm check`, plus the parity suites in Chromium, WebKit and Firefox), recorded in the PR. Hosted runners are unavailable.
- **Done when:** every case in §8 passes, `pnpm check` is green, and the gate's summary is in the PR.
- **Not claimed:** hosted CI, the two-origin browser run, and Owner review of this spec or of the shared contracts.
