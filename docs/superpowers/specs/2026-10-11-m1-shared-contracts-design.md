# M1 shared contracts: Hosting, defineExtension, boot failures

> Status: drafted 2026-10-11 by the integration owner (PR #4), part of M1.0b. Owner review pending. The host, ui, runtime and content lanes build against this file; a change goes through the integration owner, not a lane.

The master spec ([§5](2026-10-11-automata-framework-ruken-first-design.md#5-extension-contract), [§6](2026-10-11-automata-framework-ruken-first-design.md#6-effect-boundaries), [§7](2026-10-11-automata-framework-ruken-first-design.md#7-boot-and-loading-core-ruken-first)) names three contracts that more than one lane consumes. This spec fixes their shapes so the lanes can work in parallel. Lane specs refine behavior inside these shapes; they do not change them.

| Contract | Owner (implements) | Consumers |
|---|---|---|
| `Hosting` service and `HostError` union (§1) | **host** lane, `packages/host` | runtime, ui (status states), every extension that touches the host |
| `defineExtension` (§2) | **runtime** lane, `packages/runtime` | every extension, content (schemas), ui (slots), ship (manifest contributions) |
| `BootError` union and the error-to-UI map (§3) | **runtime** lane defines the errors; **ui** lane draws the states | runtime, ui, examples |

Source of truth for Ruken types: `@ruken/sdk` packed from RukenApp `b30d31b` ([`vendor/ruken/`](../../../vendor/ruken/README.md)). AF imports Ruken's types (`Capability`, `ErrorCode`, `SavesStatus`, `DisplayMetricsPayload`, `InputModePayload`, `LifecyclePayload`, `AudioChange`, `EntitlementsPayload`, `RoundOutcome`) and never copies them.

## 1. `Hosting`

### 1.1 Shape

`Hosting` is an Effect service (`Context.Tag`). Two layers provide it: `HostingRuken` (wraps `Ruken.init`; used when framed by Ruken and in tests against `@ruken/sdk-host`) and `HostingWeb` (standalone page, no Ruken frame). A third, `HostingTest`, is `HostingRuken` wired to the fake host.

```ts
import type { Capability, ErrorCode, SavesStatus, DisplayMetricsPayload, InputModePayload,
  LifecyclePayload, AudioChange, EntitlementsPayload, RoundOutcome } from '@ruken/sdk'

interface Hosting {
  readonly kind: 'ruken' | 'web'
  readonly player: { readonly id: string; readonly displayName: string }
  readonly locale: string
  readonly granted: ReadonlySet<Capability>
  /** Resolves when the host says the game may render gameplay (Ruken `session.ready`). */
  readonly ready: Effect.Effect<void, HostError>

  // Observed host state: current value plus changes. Streams end when the runtime scope closes.
  readonly lifecycle: Subscribable<LifecyclePayload>
  readonly input: Subscribable<InputModePayload>
  readonly display: Subscribable<DisplayMetricsPayload>
  readonly audio: Subscribable<AudioChange>
  readonly entitlements: Subscribable<EntitlementsPayload>
  readonly savesStatus: Subscribable<SavesStatus>

  // Requests. Each fails with a HostError; none falls back to another path on its own.
  readonly saves: {
    get(key: string): Effect.Effect<string | null, HostError>
    set(key: string, value: string): Effect.Effect<void, HostError>
    remove(key: string): Effect.Effect<void, HostError>
    flush: Effect.Effect<{ persisted: 'host-outbox' | 'server' }, HostError>
  }
  setFullscreen(on: boolean): Effect.Effect<{ fullscreen: boolean }, HostError>
  round: { start: Effect.Effect<void>; end(outcome?: RoundOutcome): Effect.Effect<void> }
  track(event: string, props?: Record<string, string | number | boolean>): Effect.Effect<void>
  exit(reason?: string): Effect.Effect<void, HostError>
  onMenuRequest(handler: () => boolean): Effect.Effect<void, never, Scope.Scope>
  onExiting(handler: Effect.Effect<void>): Effect.Effect<void, never, Scope.Scope>
}
```

`Subscribable<A>` is Effect's `Subscribable` (a `get` plus a `changes` stream). Leaderboards, store, ads and links are **not** in core `Hosting`; their extensions add their own services built on the same session (master spec §4.2), so core never imports them.

### 1.2 `HostError`

One tagged union, mapped one to one from Ruken's `ErrorCode` so no information is lost or invented:

```ts
class HostError extends Data.TaggedError('HostError')<{
  readonly code: ErrorCode          // Ruken's code, unchanged
  readonly retryable: boolean       // Ruken's flag, unchanged
  readonly operation: string        // e.g. 'saves.set', 'init'
  readonly cause?: unknown
}> {}

class HostHandshakeFailed extends Data.TaggedError('HostHandshakeFailed')<{
  readonly reason: 'timeout' | 'bad-origin' | 'version' | 'internal'
}> {}
```

`HostHandshakeFailed` covers `Ruken.init` failing inside a Ruken frame (10 s with no `welcome`, origin rejected, version refused). Everything after the handshake is a `HostError`. Retry policy lives in the caller with Effect's `Schedule`, and only when `retryable` is true.

### 1.3 Capability rules

- Requested capabilities come from the game config and the extensions' manifest contributions; `Hosting` passes them to `Ruken.init` as `wants`.
- A capability not in `granted` fails its requests with `HostError{code:'UNSUPPORTED'}` (or `DENIED` when the host says so). It never switches to `localStorage`, a standalone path or a silent no-op (AGENTS.md "Honor host authority"). `track` is the one exception: it is fire-and-forget and drops events without `telemetry`.
- `HostingWeb` grants what a standalone page can honestly provide: `lifecycle`, `input`, `display`, `audio`, `saves` (device storage, with the player told saves stay on this device), `exit` as a no-op. It never claims `store`, `ads` or `leaderboards`.

### 1.4 Required tests (host lane)

Against `@ruken/sdk-host`: handshake success; handshake timeout (`TestClock`, 10 s); wrong origin and wrong source rejected; `ready` before and after; each observed stream's initial value and change; saves get/set/remove/flush including `offline-queued`, `conflict` and `recovered` status; a capability missing from `granted` fails without fallback; `exiting` runs its handler within the 1,500 ms grace; `onMenuRequest` before ready answers `NOT_READY` (the SDK's behavior, asserted, not reimplemented). Port FloorFifty's `apps/client/src/ruken/` contract tests and spike S6's cases.

### 1.5 Known external item

The SDK at `b30d31b` still sends `baseRevision` and `writeId` on `saves.set`/`saves.remove` (Ruken `packages/protocol/src/meta/types.ts`, lines 94–100). AF does not touch them. Whether they stay is Ruken's call, tracked in [03 Continuation](../../03-continuation-prompt.md) as a request to Ruken.

## 2. `defineExtension`

```ts
interface ExtensionDef<Name extends string = string> {
  readonly name: Name                                   // kebab-case, unique
  readonly requires?: readonly string[]                 // other extension names
  readonly sim?: readonly PluginDef[]                   // definePlugin results; pass the determinism checker
  readonly content?: readonly ContentSchemaDef[]        // defineContentSchema results (content lane)
  readonly layers?: Layer.Layer<any, never, any>        // Effect services the extension provides
  readonly ui?: { readonly slots?: Readonly<Record<UiSlotName, UiComponent>> }
  readonly manifest?: (config: GameConfig) => RukenManifestContribution
}
declare function defineExtension<const N extends string>(def: ExtensionDef<N>): ExtensionDef<N>
```

Rules:

- `defineExtension` results live in a `*.extension.ts` file (the `style` rule gains this suffix in M1.5).
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
| 2 Host | `HostHandshakeFailed` | `reason` | "Couldn't connect to Ruken" | Try again (reload inside the frame) |
| 3 Storage | `HostError` (op `saves.*`) | `code`, `retryable` | "Couldn't load your progress" | Try again if retryable; otherwise Continue without loading (only under `HostingWeb`) |
| 4 Content | `ContentHashMismatch` | `expected`, `actual` | "This build is damaged" | Try again (reload) |
| 5 Assets | `AssetLoadFailed` | `url`, `status` | "Couldn't download the game" | Try again |
| 5 Assets | `LoadStalled` | `url`, `bytesSoFar`, `stalledMs` (30,000) | Same state, "Still waiting" copy | Try again |
| 6 Renderer | `RendererUnavailable` | `tried: ('webgpu'|'webgl2')[]` | "This device can't run the game" | None (exit) |
| 7 Ready | `HostError` (op `ready`) | `code` | "Couldn't connect to Ruken" | Try again |

Copy here is a placeholder for the ui lane spec; tone follows Ruken's rules (quiet, human, no blame). Try again re-runs the boot program from step 2 in a fresh runtime scope; it never refreshes the page from inside a Ruken frame.

## 4. Acceptance

- The host lane's `Hosting` passes §1.4 against the fake host.
- The ui lane renders every §3 state from a fixture without a renderer.
- The runtime lane's boot program has an exhaustive match over `BootError` (a new tag fails typecheck until the UI handles it).
- `defineExtension` rejects a cycle, a missing requirement and a manifest field outside Ruken's schema, each with a test.
