# M1 shared contracts: Hosting, defineExtension, boot failures

> Status: drafted 2026-10-11 by the integration owner (PR #4), part of M1.0b; §1 and §3 revised the same day after audit round 3. Owner review pending. The host, ui, runtime and content lanes build against this file; a change goes through the integration owner, not a lane.

The master spec ([§5](2026-10-11-automata-framework-ruken-first-design.md#5-extension-contract), [§6](2026-10-11-automata-framework-ruken-first-design.md#6-effect-boundaries), [§7](2026-10-11-automata-framework-ruken-first-design.md#7-boot-and-loading-core-ruken-first)) names three contracts that more than one lane consumes. This spec fixes their shapes so the lanes can work in parallel. Lane specs refine behavior inside these shapes; they do not change them.

| Contract | Owner (implements) | Consumers |
|---|---|---|
| `Hosting` service and `HostError` union (§1) | **host** lane, `packages/host` | runtime, ui (status states), every extension that touches the host |
| `defineExtension` (§2) | **runtime** lane, `packages/runtime` | every extension, content (schemas), ui (slots), ship (manifest contributions) |
| `BootError` union and the error-to-UI map (§3) | **runtime** lane defines the errors; **ui** lane draws the states | runtime, ui, examples |

Source of truth for Ruken types: `@ruken/sdk` packed from RukenApp `b30d31b` ([`vendor/ruken/`](../../../vendor/ruken/README.md)). AF imports Ruken's types (`Capability`, `ErrorCode`, `SavesStatus`, `DisplayMetricsPayload`, `InputModePayload`, `LifecyclePayload`, `AudioChange`, `EntitlementsPayload`, `RoundOutcome`) and never copies them.

## 1. `Hosting`

Revised 2026-10-11 (audit round 3, coordinator decisions): follow the SDK's own handshake fallback, one adapter instead of two, Ruken's return types for `setFullscreen` and `exit`, and no AF copies of Ruken limits.

Revised 2026-10-16 (PUB.1, host lane; [PUB spec](./2026-10-16-publish-targets-design.md) §3, [ADR 0005](../../adr/0005-publish-targets.md)): a second adapter for builds published outside Ruken, chosen at build time; `kind` gains `'web'`; new `hostName`.

### 1.1 Shape

`Hosting` is an Effect service (`Context.Tag`). **One layer, `HostingLive`, wraps `Ruken.init`** for every case. The SDK already decides between a hosted session (framed by Ruken, `welcome` received) and its standalone session (top-level page, or no valid `welcome` within the SDK's timeout, `packages/sdk/src/handshake.ts`), and its standalone session already provides local saves and unsupported services (`standalone.ts`). For a `ruken` build AF writes no second adapter; the web adapter below exists only for builds published elsewhere (PUB.1). `HostingTest` is `HostingLive` with an `SdkEnv` wired to `@ruken/sdk-host`'s fake host. A later desktop adapter (`host-tauri`, M7) implements the same service itself.

**The web adapter (PUB.1).** An `itch` or `web` build (PUB spec §3) does not call `Ruken.init`: inside itch.io's frame the SDK would wait 10 s for a welcome that never comes. `@mcthaydt/automata-host/target` exports `makeHosting` and `HostingLive` with the same signatures under two export conditions: `default` resolves to the Ruken adapter above, and `automata-web` resolves to `hosting-web.ts`, which implements this same contract for a page outside Ruken (PUB spec §3.1: no handshake, lifecycle from Page Visibility and focus, input from real events, `visualViewport` display metrics, Element Fullscreen, `localStorage` saves under the SDK's `ruken:<gameId>:` prefix). It imports `@ruken/sdk` as types only, so its bundle holds no SDK code. Its differences from the SDK's standalone session are deliberate and each is pinned by a test: `exit` fails `UNSUPPORTED`; blocked storage leaves `saves` ungranted and every save call fails `DENIED` (never memory); a full origin quota fails `QUOTA_EXCEEDED`. The runtime's boot imports `makeHosting` from `./target`; everything else imports the contract from `.`. The build chooses the target (PUB.2): `resolve.conditions: ['automata-web', ...]` and the define `__AUTOMATA_TARGET__` (`'itch'` or `'web'`), which only sets `hostName`.

`HostingLive` is a `Layer<Hosting, HostError>`: `Ruken.init` can still throw (for example `INVALID_PAYLOAD` for a bad `gameId` or `wants`), and that failure surfaces as `HostError{ operation: 'init' }` so the runtime maps it to a boot state (§3). The layer is scoped: when the runtime scope closes, the session is disposed and every later `Hosting` operation fails with `HostError{ code: 'CANCELLED', retryable: false }`.

```ts
import type { RukenError } from '@ruken/sdk'
// The SDK at b30d31b does not export its ErrorCode alias, so AF names it from the error class.
type ErrorCode = RukenError['code']
import type { Capability, SavesStatus, DisplayMetricsPayload, InputModePayload,
  LifecyclePayload, AudioChange, EntitlementsPayload, RoundOutcome, FullscreenRes,
  SavesFlushRes } from '@ruken/sdk'

interface Hosting {
  /** 'ruken' when Ruken hosts it; 'standalone' when the SDK returned its standalone session; 'web' for the web adapter. */
  readonly kind: 'ruken' | 'standalone' | 'web'
  /** The host's name for UI ("Back to …"): 'Ruken' from the Ruken adapter; 'itch.io' or 'this page' from the web adapter. */
  readonly hostName: string
  /** Some when the page is inside a frame but the SDK fell back to standalone (see 1.2). */
  readonly handshake: { readonly fellBack: Option.Option<HostHandshakeFailed> }
  readonly player: { readonly id: string; readonly displayName: string }
  /** Ruken's `session.locale`; the runtime's localization picks its language from it. */
  readonly locale: string
  readonly granted: ReadonlySet<Capability>
  /** Resolves on `session.ready` (immediately when standalone). No gameplay renders before it. */
  readonly ready: Effect.Effect<void, HostError>

  // Observed host state: current value plus changes. Streams end when the runtime scope closes.
  readonly lifecycle: Subscribable<LifecyclePayload>
  readonly input: Subscribable<InputModePayload>
  readonly display: Subscribable<DisplayMetricsPayload>
  readonly audio: Subscribable<AudioChange>
  readonly entitlements: Subscribable<EntitlementsPayload>
  readonly savesStatus: Subscribable<SavesStatus>

  // Requests. Each surfaces the SDK's RukenError as a HostError; none adds a fallback of its own.
  readonly saves: {
    get(key: string): Effect.Effect<string | null, HostError>
    set(key: string, value: string): Effect.Effect<void, HostError>
    remove(key: string): Effect.Effect<void, HostError>
    flush: Effect.Effect<SavesFlushRes, HostError>
  }
  setFullscreen(on: boolean): Effect.Effect<FullscreenRes, HostError>   // { fullscreen, support }
  round: { start: Effect.Effect<void>; end(outcome?: RoundOutcome): Effect.Effect<void> }
  track(event: string, props?: Record<string, string | number | boolean>): Effect.Effect<void>
  exit(reason?: 'player' | 'completed'): Effect.Effect<void, HostError> // default 'player'
  /** Before `ready` resolves, the dispatcher answers false and skips the handler (the SDK does not guard this). */
  onMenuRequest(handler: () => boolean): Effect.Effect<void, never, Scope.Scope>
  onExiting(handler: Effect.Effect<void>): Effect.Effect<void, never, Scope.Scope>
}
```

`Subscribable<A>` is Effect's `Subscribable` (a `get` plus a `changes` stream). `setFullscreen` returns Ruken's `FullscreenRes` unchanged, so a game can show FloorFifty's iOS home-screen hint when `support` is `'ios-home-screen'`. `exit` takes Ruken's two reasons.

**Not in core `Hosting`, on purpose:** leaderboards, store, ads and links. Each is an extension service built on the same session (`leaderboards` joins the extension list in master spec §4.2). Core never imports them. The gamepad's host button and Escape reach the game only through `onMenuRequest`; the SDK owns the gamepad watching (`packages/sdk/src/gamepad.ts`), and AF's Input service never reads the host button itself.

### 1.2 Errors and the handshake fallback

```ts
class HostError extends Data.TaggedError('HostError')<{
  readonly code: ErrorCode          // Ruken's code, unchanged
  readonly retryable: boolean       // Ruken's flag, unchanged
  readonly operation: string        // e.g. 'saves.set', 'ready'
  readonly cause?: unknown
}> {}

class HostHandshakeFailed extends Data.TaggedError('HostHandshakeFailed')<{
  readonly reason: 'no-welcome'     // the SDK does not say whether it timed out or rejected a welcome
}> {}
```

**A failed in-frame handshake is a reported fallback, not a fatal error** (coordinator decision, matching Ruken's `handshake.ts`). When the page is framed (`window !== window.top`) and `Ruken.init` returns a standalone session, `HostingLive` sets `handshake.fellBack` to `Some(HostHandshakeFailed)` and logs it with `Effect.logWarning`; the game keeps running standalone. The runtime may also show it in a dev overlay. There is no analytics requirement: after the fallback, `track` goes through the standalone session and cannot reach Ruken.

Retry policy lives in the caller with Effect's `Schedule`, and only when `retryable` is true.

### 1.3 Capabilities and limits

- Requested capabilities come from the game config and the extensions' manifest contributions; `Hosting` passes them to `Ruken.init` as `wants`.
- The SDK enforces grants and limits. AF relays its `RukenError`s as `HostError` and adds no gate, no fallback to device storage and no silent no-op of its own (AGENTS.md "Honor host authority"). `track` is fire-and-forget as in the SDK.
- **AF quotes no Ruken limit.** Save sizes, key counts, zip size and rate limits are Ruken's (for example the SDK counts save *value* bytes, `save-map.ts` line 48). Tests that need a limit import Ruken's constant or trigger Ruken's own error; AF documents link to Ruken's code instead of copying numbers.

### 1.4 Time in tests

Two clocks, kept apart:

- **SDK timing** (hello retry, handshake give-up, RPC timeouts) runs on `SdkEnv.timers`, and the exit grace is enforced by the host. `HostingTest` uses one manual fake clock that implements both the SDK's `SdkTimers` (`now`, `setTimeout`, `clearTimeout`) and `@ruken/sdk-host`'s `BridgeClock`, and the test advances it, so these tests do not wait 10 s. (The SDK's own fake env and Ruken's `TestClock` are not exported, so AF writes this small fake.) AF asserts the SDK's behavior; it never re-implements its timings.
- **AF timing** (exit grace, save-flush timeout, retries chosen with `Schedule`) runs on Effect's `Clock` and is tested with `TestClock`.

### 1.5 Required tests (host lane)

Against `@ruken/sdk-host`: hosted handshake; top-level page gives `kind: 'standalone'` with `fellBack` = `None`; framed page with no welcome gives `kind: 'standalone'`, `fellBack` = `Some` and one warning logged; wrong origin and wrong source rejected (falls back as above); `ready` before and after; each observed stream's initial value and change; `locale` from the session; saves get/set/remove/flush including `offline-queued`, `conflict` and `recovered` status and a quota error relayed from the SDK; a capability missing from `granted` fails with the SDK's error and no fallback; `setFullscreen` returns `support`; `exit` defaults to `'player'`; `exiting` runs its handler; `onMenuRequest` before `ready` resolves answers `false` without calling the game's handler (AF's guard, below). Port FloorFifty's `apps/client/src/ruken/` contract tests and spike S6's cases. The cases that apply to any host (ready, player and locale, saves round trip and flush, each stream starting with its current value, rounds and analytics never failing, handlers in a scope, `CANCELLED` and ended streams after shutdown) run against both adapters in `packages/host/src/hosting-web.test.ts` (PUB-a).

### 1.6 Known external item

The SDK at `b30d31b` still sends `baseRevision` and `writeId` on `saves.set`/`saves.remove` (Ruken `packages/protocol/src/meta/types.ts`, lines 94–100). AF does not touch them. Whether they stay is Ruken's call, tracked in [03 Continuation](../../03-continuation-prompt.md) as a request to Ruken.

Also at `b30d31b`: without the `saves` grant, the SDK's `storage.setItem` succeeds into an in-memory cache and sends nothing (`packages/sdk/src/saves-storage.ts`, `enabled: granted.has('saves')`); only `saves.flush` fails with `UNSUPPORTED`. That contradicts Ruken's S6 answer 3 ("throw DENIED, never fall back to memory"). AF adds no gate (§1.3); the host tests pin the SDK's current behavior so a re-vendor surfaces Ruken's fix. Tracked as a second request to Ruken.

And: the SDK at `b30d31b` has no `NOT_READY` for `menu.open` before `session.ready`; it calls the game's handler and answers `{ opened: true }`. AF's `onMenuRequest` dispatcher therefore answers `false` and skips the handler until `ready` resolves (a small guard, pinned by a test). Tracked as a third request to Ruken.

## 2. `defineExtension`

```ts
interface ExtensionDef<Name extends string = string> {
  readonly name: Name                                   // kebab-case, unique
  readonly requires?: readonly string[]                 // other extension names
  readonly sim?: readonly PluginDef[]                   // definePlugin results; pass the determinism checker
  readonly content?: readonly ContentSchemaDef[]        // defineContentSchema results (content lane)
  readonly layers?: Layer.Layer<any, never, any>        // Effect services the extension provides
  readonly ui?: { readonly slots?: Readonly<Partial<Record<UiSlotName, UiComponent>>> }
  readonly manifest?: (config: GameConfig) => RukenManifestContribution
}
declare function defineExtension<const N extends string>(def: ExtensionDef<N>): ExtensionDef<N>
```

Rules:

- `defineExtension` results live in a `*.extension.ts` file (enforced by `pnpm style`, as are `defineContentSchema` in `*.content.ts` and `defineContentGenerator` in `*.generator.ts`).
- Extensions are resolved by `requires` and then ordered by name, like sim plugins. A cycle or a missing requirement fails the build with both names.
- `RukenManifestContribution` is a partial of `@ruken/manifest`'s own input type: `wants` capabilities and the `[loading] preload` list. Any field Ruken's schema lacks is a type error.
- `UiSlotName` is a closed union the ui lane defines in its spec (for example `'debug.panels'`, `'settings.sections'`). An extension cannot add a slot.
- `layers` cannot fail at construction (`never` error channel); anything that can fail runs in the boot program as a named step.
- **Determinism check.** Any package whose extension has `sim` plugins runs `check-boundaries` on its sim sources, in AF CI and in the game CI template (`game-ci.yml`). The checker takes a list of source roots; `packages/sim` is the first.

`ContentSchemaDef`, `UiComponent` and `GameConfig` are placeholders named here and defined by the content, ui and runtime lane specs respectively.

## 3. Boot failures and their UI states

Every boot step in master spec §7 fails with a typed error. The runtime's boot program's error channel is exactly `BootError`; the ui lane draws one state per tag. No step fails silently and no state is a blank screen.

| Step | Error tag | Fields | UI state | Player action |
|---|---|---|---|---|
| 2 Host | `HostError` (op `init`) when `Ruken.init` throws; an in-frame handshake failure is not an error but a reported fallback to standalone (§1.2) | `code`, `retryable` | "Couldn't start the game" | Try again if retryable; otherwise none (a build or config fault) |
| 3 Storage | `HostError` (op `saves.*`) | `code`, `retryable` | "Couldn't load your progress" | Try again if retryable. Not retryable: "Back to {host}" (`exit`, named by the host and shown only when `exit` is granted; PUB.4) when `kind` is `ruken`; Continue without loading when `kind` is `standalone` |
| 4 Content | `ContentHashMismatch` | `expected`, `actual` | "This build is damaged" | Try again (reload) |
| 5 Assets | `AssetLoadFailed` | `url`, `status` | "Couldn't download the game" | Try again |
| 5 Assets | `LoadStalled` | `url`, `bytesSoFar`, `stalledMs` (30,000) | Same state, "Still waiting" copy | Try again |
| 6 Renderer | `RendererUnavailable` | `tried: ('webgl2'|'webgpu')[]` (WebGL2 is the default; WebGPU only when the game opts in) | "This device can't run the game" | "Back to {host}" (`exit`, only when granted; PUB.4) when `kind` is `ruken`; a final panel with no action when `standalone` |
| 7 Ready | `HostError` (op `ready`) | `code` | "Couldn't connect to Ruken" | Try again |
| any step, a defect (added 2026-10-12, M1.5 Q1) | `BootDefect` | — | "Couldn't start the game" | Try again |

Copy here is a placeholder for the ui lane spec; tone follows Ruken's rules (quiet, human, no blame). Try again re-runs the boot program in a fresh runtime scope (a new SDK session included); it never refreshes the page from inside a Ruken frame.

## 4. Acceptance

- The host lane's `Hosting` passes §1.5 against the fake host.
- The ui lane renders every §3 state from a fixture without a renderer.
- The runtime lane's boot program has an exhaustive match over `BootError` (a new tag fails typecheck until the UI handles it).
- `defineExtension` rejects a cycle, a missing requirement and a manifest field outside Ruken's schema, each with a test.
