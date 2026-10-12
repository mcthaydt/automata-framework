# M1.5 Runtime: boot, loading, app loop, Time, Flow, presentation bus, settings, `defineExtension`

- **Status:** Draft 2026-10-12. Open questions answered by the Owner 2026-10-12: all nine recommended defaults accepted (§13). Next: the TDD plan, reviewed before any code.
- **Task:** M1.5 in the [master delivery plan](../../02-master-delivery-plan.md). Detail level: [01 Decomposition](../../01-decomposition.md) §5. Operating rules of 2026-10-12 apply: this spec is reviewed before its TDD plan, and the plan before any code.
- **Builds against:**
  - the [M1 shared contracts](./2026-10-11-m1-shared-contracts-design.md): §1 `Hosting` (consumed), §2 `defineExtension` and §3 `BootError` (both owned here);
  - the [Ruken-first master spec](./2026-10-11-automata-framework-ruken-first-design.md): the `runtime` row of §4.1, §5, §6 and §7;
  - [ADR 0003](../../adr/0003-effect-outside-the-sim.md) and the [S8 verdict](../../spikes/s8-effect.md) (budgets E1 to E5);
  - the [extraction map](./2026-10-11-core-and-extensions-extraction-map.md), `runtime` section and "Core additions from the audit".
- **Consumes, does not rebuild (on `main` `bced229`):** `packages/host` (`Hosting`, `HostingLive`, `HostError`, `./testing` `HostingTest`); `packages/ui` (geometry owner, `LoaderOverlay`, `ErrorPanel`, `BootFailurePanel`, `bootFailureView`, `BootFailure`, `UiSlotName`, `UiComponent`, browser hygiene); `packages/content` (types `FlowGraph`, `AssetsSource`, `GameSource`, `ContentSchemaDef`; the `virtual:automata/content` module); `packages/sim` (`Sim`, `StepResult`, `Command`, `PluginDef`; `./hash` for the content check).
- **Source commits (re-read 2026-10-12):**
  - FloorFifty `93f45b1f8e6f4e0ec9da77f392dd61ec3cfd6d49` (the extraction map surveyed `122a220`; `screen-manager.ts` grew from 196 to 215 lines and `screens/screen.ts` from 361 to 367 since). Files, under `apps/client/src/`: `main.ts` (`boot()` line 133, `afterFirstPaint` 141, settings 149, `loads.guard(() => hosting.ready)` 518), `managers/load-meter.ts`, `managers/fetch-progress.ts`, `managers/assets.ts`, `managers/veil.ts`, `managers/boot-version-check.ts`, `managers/screen-manager.ts`, `screens/screen.ts`, `common/dispose.ts`, `managers/presentation/{presentation-event-bus,presentation-event-router,presentation-flow,presentation-runtime}.ts`, `common/settings.ts`, `ui/store/settings.svelte.ts`, `managers/settings-bridge.ts`; `content/flow.toml`; tests under `tests/client/{managers,common,ruken}/`.
  - The Last Light (`PixiJS3D_Experiment_001`) `21c1553e813501b200d0eb4a2aa205ad7cdd12ce`: `src/game/clock.ts`, `src/game/session.ts`, `src/main.ts` (frame loop, lines 330–370), `tests/clock.test.ts`.

Neither source uses Effect, so each module is a rewrite onto Effect services whose source tests come across as behavior specs (extraction map §4).

## 1. Goal and boundaries

A game's `main.ts` calls `runGame(game)` once. The runtime then boots in the order of master spec §7, shows `LoaderOverlay` with real progress, renders nothing of the game before `session.ready`, enters the flow's entry screen, steps the game's sim at a fixed rate and draws every display frame with an interpolation factor. Every boot failure is a typed `BootError` drawn by `BootFailurePanel`. Try again re-runs the boot in a fresh scope and never reloads the page.

**Deliverables:**
1. `packages/runtime` (`@mcthaydt/automata-runtime`) with three entry points (§3.1).
2. `defineExtension` and `resolveExtensions` (shared contracts §2).
3. The boot program with the `BootError` union and its exhaustive match against ui's `BootFailure`.
4. Loading: the stall rule (30 s of silence fails, 8 s says "slow"), byte progress, per-screen files from `assets.toml`, fonts.
5. The app loop: fixed sim step, variable render, interpolation, plain `requestAnimationFrame` code with no Effect allocated per frame, and a frame-loop overhead check (the S8 gap).
6. Time (pause reasons from lifecycle and menus), Flow (screens from `flow.toml`, one transition at a time), the presentation bus, and settings over `Hosting.saves`.
7. The demo `examples/runtime/boot-and-flow` (no renderer; §8).

**Not in M1.5:**

| Work | Where it goes |
|---|---|
| Input: keyboard, pointer, touch, gamepad, profiles, focus navigation across screens | M4. `base-2d` keeps its own `src/input/` until then. The host button reaches the game only through `onMenuRequest` (shared contracts §1.1). |
| Save: slots, autosave, versions and migrations, sync status UI | M5. Games may call `Hosting.saves` directly meanwhile. |
| Audio core, and sleeping and waking audio on `lifecycle` and on a hidden page (ui's `sleepWhenHidden`) | M5, with the audio engine. M1 has no audio to sleep. |
| Localization from `session.locale` | M5. Runtime copy is English defaults passed as props (ui's `BOOT_FAILURE_COPY_EN`). |
| Per-setting device storage (FloorFifty `keepAudioOnDevice`) | M5, with audio settings, the only settings it applies to (Q5). |
| Landscape gate and its fullscreen request | M4 display policy (Q6). |
| FloorFifty's authored presentation routing (`presentation-event-router.ts`), carry-over between screens, network activity loader | Not extracted: FloorFifty-specific. Routing returns if a second game needs routes as content. |
| `boot-version-check.ts` (bundle against server `/health`) | `net` (M7); M1 has no server. Its AF analogue is the content hash check (step 4). |
| The renderer itself | M1.7 `render-pixi`. This spec fixes only the interface the runtime hands it (§3.8). |
| `handshake.fellBack` dev overlay | `debug` (M6). Hosting already logs it once. |

## 2. Ownership

| State | Owner | Writers | Readers |
|---|---|---|---|
| Host session, readiness, lifecycle, saves | `Hosting` (host lane) | The SDK | Boot, Time, Settings |
| Boot phase (`loading`, `ready`, `failed`) | Boot program | Boot program only | `<html data-state>` (browser journeys wait on it, as `base-2d` does today), the overlay layer |
| Resolved extensions (order, layers, plugins, slots) | `resolveExtensions` | Nobody after boot | Boot (layers), the game (sim plugins), screens (slots), ship (manifest) |
| Loaded file bytes | `Assets` | `Assets` only | Renderer, screens |
| Current screen and the transition queue | `Flow` | `Flow.dispatch` and `Flow.start` | Screens, Time, the menu handler |
| Pause reasons | `Time` | Flow (a screen's `pausesSim`), the lifecycle watcher | App loop |
| Which sim is stepped; accumulator and alpha | App loop | The game's screens (`run`, `stop`) | Renderer (through `apply` and `draw`) |
| Simulation state | `sim` | Systems through commands (law 1) | Renderer through `RenderDelta`; never the runtime |
| Settings value | `Settings` | `Settings.update` | Screens, the game's appliers |
| Presentation facts (transient) | `PresentationBus` | Runtime (sim events, screen entered, pause changes), game code | Game code, extensions |
| Layout geometry | ui geometry owner, created by boot | ui | Renderer, screens |

The sim never sees any runtime service (law 1, ADR 0003).

## 3. Contracts

Rule for every service: a method called per frame or from a DOM handler is a plain function; anything that waits, can fail or holds a resource is an `Effect`. Services are `Context.Tag` + `Layer` as `Hosting` is; time comes from Effect's `Clock`, except frame time (§3.5).

### 3.1 Package layout and exports

```
packages/runtime/src/
  index.ts                     extension/index.ts             testing/index.ts
  extension/  define-extension.ts  resolve-extensions.ts  extension-error.ts
  boot/       game-definition.ts  boot-error.ts  boot-program.ts  run-game.ts  page-layers.svelte.ts
  loading/    load-meter.ts  fetch-progress.ts  assets.manager.ts
  loop/       frames.ts  frame-loop.ts  app-loop.manager.ts
  time/       time.manager.ts
  flow/       screen.ts  flow.manager.ts  veil.ts
  presentation/ presentation-bus.manager.ts
  settings/   settings.manager.ts  migrate-settings.ts
  render/     renderer.ts
  testing/    runtime-test.ts  manual-frames.ts  null-renderer.ts  fake-fetch.ts
```

Services live in `*.manager.ts` (the role `pnpm style` already knows); `defineExtension` results in games and extensions live in `*.extension.ts` (already enforced). Each source file has its `*.test.ts` beside it (§7).

| Entry | Exports |
|---|---|
| `@mcthaydt/automata-runtime` | `runGame`, `GameDefinition`, `RuntimeHandle`, `RuntimeServices` (the union of the runtime's service tags a screen or extension layer may require); `BootError`, `ContentHashMismatch`, `AssetLoadFailed`, `LoadStalled`, `RendererUnavailable`, `BootDefect`; `Flow`, `ScreenDef`, `ScreenContext`, `FlowFailure`; `Time`, `PauseReason`; `AppLoop`, `FrameInfo`; `Assets`; `Settings`, `SettingsDef`, `SettingsStore`, `settingsStore`; `PresentationBus`, `RuntimeFacts`, `typedBus`; `Renderer`, `GameRenderer`, `RenderTarget`, `RendererFactory`; `STALL_MS`, `SLOW_MS`, `MAX_FRAME_MS` |
| `./extension` | `defineExtension`, `resolveExtensions`, `ExtensionDef`, `ResolvedExtensions`, `ExtensionError`, `GameConfig`, `RukenManifestContribution`. No DOM or Svelte import, so a game's `vite.config.ts` and `ship` can load it in Node. |
| `./testing` | `RuntimeTest`, `manualFrames`, `nullRenderer`, `fakeFetch` |

Dependencies: `effect` 3.22.2, `zod` 4.6.5, `@mcthaydt/automata-host`, `@mcthaydt/automata-ui`, `@mcthaydt/automata-sim` (types and `./hash`), `svelte` 5.57.1 as a peer; `@mcthaydt/automata-content` as types only (its compiler imports `node:*`, so no value import). `@ruken/manifest` (types, for `GameConfig`). Dev: `@ruken/sdk-host`, `vitest`, `jsdom`, `@types/node`, `@sveltejs/vite-plugin-svelte` (mounting ui components), `svelte-check` with TypeScript 6 for typecheck as ui does, `@vitest/browser-playwright` and `playwright` (the Chromium bench); all already pinned in `docs/versions.md`.

### 3.2 `defineExtension` (shared contracts §2, owned here)

`ExtensionDef` is exactly the shared contracts' shape. This spec fills the placeholders:

```ts
/** The parts of Ruken's manifest an extension may read (`@ruken/manifest` `Manifest`, never copied). */
type GameConfig = Pick<Manifest, 'game' | 'runtime' | 'content'>
/** What an extension may add to ruken.toml in M1: preload files. `wants` is not a manifest field (Q7). */
type RukenManifestContribution = { readonly loading?: { readonly preload?: readonly string[] } }

interface ResolvedExtensions {
  readonly order: readonly string[]                           // by `requires`, ties by name
  readonly simPlugins: readonly PluginDef[]                  // in extension order; the game passes them to createSim
  readonly contentSchemas: readonly ContentSchemaDef[]       // for the content Vite plugin's `schemas`
  readonly layer: Layer.Layer<any, never, any>               // every extension's layers, merged in order
  slots(name: UiSlotName): readonly UiComponent[]           // every extension's component for that slot, in order
  manifest(config: GameConfig): RukenManifestContribution    // contributions merged; preload lists concatenated, first place kept
}
function resolveExtensions(defs: readonly ExtensionDef[]): ResolvedExtensions   // throws ExtensionError
class ExtensionError extends Data.TaggedError('ExtensionError')<{
  readonly reason: 'duplicate' | 'missing' | 'cycle' | 'manifest-field'
  readonly names: readonly string[]    // both names for missing (who, what), the loop for a cycle
}> {}
```

Order is Kahn's algorithm over `requires`, taking the smallest ready name each time, so order never depends on array order. A manifest contribution with a key outside `RukenManifestContribution` is a type error and, for untyped JavaScript, `ExtensionError{reason:'manifest-field'}` thrown by `resolved.manifest(config)`, which runs at build time (contributions are functions of `config`). `resolveExtensions` is synchronous and throws so a Vite config fails the build with the message; at runtime the build has already resolved the same list, so a throw there is a defect. An extension's layer may require runtime services (`Hosting`, `PresentationBus`, `Time`, `Flow`, `Settings`); it is provided after them.

### 3.3 Game definition, boot program and `BootError`

```ts
interface GameDefinition<S = never> {
  readonly root: HTMLElement
  readonly hosting: Omit<HostingOptions, 'disclosedEvents'>   // gameId, wants, pauseBehavior; disclosedEvents come from content
  readonly content: { readonly data: CompiledContentData; readonly hash: string } // the virtual module's `content`, `contentHash`
  readonly screens: readonly ScreenDef[]
  readonly renderer: RendererFactory
  readonly settings?: SettingsDef<S>
  readonly extensions?: readonly ExtensionDef[]
  readonly copy?: Partial<BootFailureCopy> & { readonly loading?: string; readonly slow?: string }
  readonly seams?: { fetch?; frames?; fonts?; sdkEnv?; document? }   // tests only, like HostingLive's seams
}
interface RuntimeHandle { shutdown(): Promise<void> }   // closes the runtime scope (Ruken's return to launcher)
function runGame<S>(game: GameDefinition<S>): RuntimeHandle

type BootError = HostError | ContentHashMismatch | AssetLoadFailed | LoadStalled | RendererUnavailable | BootDefect
class ContentHashMismatch extends Data.TaggedError('ContentHashMismatch')<{ expected: string; actual: string }> {}
class AssetLoadFailed   extends Data.TaggedError('AssetLoadFailed')<{ url: string; status: number }> {}    // status 0: network error
class LoadStalled       extends Data.TaggedError('LoadStalled')<{ url: string; bytesSoFar: number; stalledMs: number }> {}
class RendererUnavailable extends Data.TaggedError('RendererUnavailable')<{ tried: readonly ('webgl2' | 'webgpu')[] }> {}
class BootDefect        extends Data.TaggedError('BootDefect')<{ cause: unknown }> {}   // a bug, not a typed failure (Q1)
```

`CompiledContentData` is the compiled JSON with the fields the runtime reads typed: `flow: FlowGraph`, optional `assets: AssetsSource`, optional `game: GameSource`. `boot-error.ts` checks at the type level that `BootError` is assignable to ui's `BootFailure`, and the exhaustive `switch` in `run-game.ts` ends in `never`, so a new tag fails typecheck until ui draws it (shared contracts §4). `BootDefect` (Q1) is additive to shared contracts §3 and to ui's `BootFailure` (a `{ _tag: 'BootDefect' }` member drawn as the `start` state with Try again); that ui change is a small additive task in the plan.

### 3.4 Loading (`Assets`, the stall rule)

- **Stall rule** (FloorFifty `load-meter.ts`, behavior unchanged): one meter per boot scope measures silence. Any byte, finished file or finished step restarts it. A guarded wait fails with `LoadStalled` when nothing has arrived for `STALL_MS = 30_000`; a wait that begins after a long idle stretch does not inherit it; with other waits pending a new one does not reset their clock. `SLOW_MS = 8_000` sets `LoaderOverlay`'s `slow` line; slow never fails. Rewritten on Effect `Clock` (tested with `TestClock`); a stalled wait's fiber is interrupted, which aborts its `fetch` through the `AbortSignal` from `Effect.tryPromise`.
- **Byte progress** (FloorFifty `fetch-progress.ts`, unchanged): bodies are read chunk by chunk; each chunk reports bytes so far and the announced size, absent for an encoded body. Progress never sits at 0 % before the first byte: `LoaderOverlay` is indeterminate until then.
- **`Assets`:** `load(screen): Effect<void, AssetLoadFailed | LoadStalled>` fetches every file `assets.toml` lists for that screen (`content.assets.screens[screen].files`), single-flight per file, shared progress for every waiter (FloorFifty `assets.ts`). A failed file is not remembered, so Try again really refetches. `get(path): Blob | undefined` and `isLoaded(screen)` are plain. AF does not use Pixi's loader, so FloorFifty's `abandon` workaround for its promise cache is not needed: interrupting the fiber drops the request. Fonts: a screen's `fonts` (CSS font shorthands, §3.6) are awaited with `document.fonts.load` under the same stall rule (Q9).
- **Preload:** boot loads the screens named in `game.toml` `preload_screens`, default the flow's entry: the same list content generates as `[loading] preload`, so inside Ruken the files come from the cache Ruken filled.

### 3.5 App loop (`AppLoop`) and frames

```ts
interface FrameSource { now(): number; request(callback: () => void): number; cancel(handle: number): void } // live: performance.now + rAF
interface FrameInfo { alpha: number; frameMs: number; paused: boolean }   // one object reused every frame; never keep it
interface AppLoop {
  run(options: { sim: Sim; commands: (tick: number) => readonly Command[] }): void  // replaces the sim being stepped
  stop(): void            // stops stepping and drawing; the sim is the game's to dispose
  readonly running: boolean
}
const MAX_FRAME_MS = 100   // The Last Light clock.ts 0.1 s clamp: at most 6 steps at 60 Hz, the rest is dropped
```

Each display frame, in plain code (`frame-loop.ts` imports nothing from `effect`):
1. `elapsed = frames.now() - last`, clamped to `[0, MAX_FRAME_MS]`. Time comes from `now`, not the rAF timestamp (base-2d `loop.ts`: one time base for start and every frame).
2. While `Time` is paused the accumulator is zero (The Last Light: paused time is dropped) and no step runs.
3. Otherwise `accumulator += elapsed`; while `accumulator >= stepMs - 1e-6` (`stepMs = 1000 / sim.tickHz`; the tolerance keeps a frame of exactly one step from losing it), run one step: `result = sim.step(commands(sim.tick))`, `renderer.apply(result)`, rejected commands logged as errors, and, only when `result.events` is non-empty, publish `sim.events` on the bus. A step that stops the loop ends the frame's steps.
4. `renderer.draw(frame)` with `alpha = accumulator / stepMs` (1 while paused).

The loop is started inside a runtime fiber whose finalizer cancels the pending frame, so closing the scope stops it. A `SimFaultedError` or any throw from `step` stops the loop and reports a `FlowFailure` (§5); the loop never restarts a faulted sim.

### 3.6 Flow and screens

```ts
interface ScreenDef {
  readonly id: string                    // a screen in flow.toml (content checks the graph)
  readonly pausesSim?: boolean            // Time holds 'menu' while this screen is current
  readonly fonts?: readonly string[]      // e.g. '700 16px "Pixelify Sans"', awaited before enter
  enter(context: ScreenContext): Effect.Effect<void, unknown, Scope.Scope | RuntimeServices>
  openMenu?(): boolean                    // the host's "Open game menu"; true when the screen opened its own
}
interface ScreenContext { readonly layer: HTMLElement; readonly from: string | undefined }
interface Flow {
  readonly current: string | undefined
  dispatch(event: string): boolean        // false when the current screen has no edge for it (Q3)
  openMenu(): boolean                     // current screen's openMenu, false mid-transition or with none
  readonly settled: Effect.Effect<void>   // the queue is empty
}
type FlowFailure = AssetLoadFailed | LoadStalled | { _tag: 'ScreenFailed'; screen: string; cause: unknown }
```

- **Graph:** `content.flow` (`FlowGraph`, checked by the content compiler with the game's `FlowCapabilities`: its `screens` are the `ScreenDef` ids, its `styles` are `cut` and `fade`). The runtime never names a destination; a screen dispatches events.
- **One transition at a time** (FloorFifty `screen-manager.ts`): an explicit FIFO queue, not a promise chain. Each request is matched against the screen current when it is dequeued. A failed transition rejects itself and everything queued behind it, then the queue is open again.
- **Order of one transition:** (1) load the target's files and fonts with `LoaderOverlay` over the current screen when anything is missing (Q8); (2) cover, for `fade`; (3) close the current screen's scope (its finalizers run in reverse order, replacing `DisposeBag`); (4) set `current` to the target before awaiting its enter (a screen that dispatches during its own enter resolves against itself); (5) run `enter` in a new child scope of the runtime scope, inside the screen layer; (6) set or clear Time's `menu` reason from `pausesSim`; (7) `geometry.remeasure()`, focus the first `[data-kind="primary"]` control, else the first tabbable (ui `tabbables`); (8) reveal; (9) publish `screen.entered`. A transition to the screen already current is a no-op.
- **Veil** (FloorFifty `veil.ts` `createDomVeil`): `fade` covers with `--af-surface` over 350 ms and reveals over 350 ms; under reduced motion each half is 100 ms. Requests queued under the cover run under it and the last one reveals. A veil that fails to cover leaves the edge a cut.

### 3.7 Time, presentation bus and settings

- **`Time`:** `paused: boolean` and `reasons: ReadonlySet<'lifecycle' | 'menu'>` (plain getters), `pause(reason)`, `resume(reason)`; stepping runs only with no reason held. The lifecycle watcher adds `lifecycle` while `Hosting.lifecycle` is `background` or the document is hidden (the SDK's standalone session never changes its lifecycle), but only when `pauseBehavior` is `'pause'`; with `'continue'` it adds nothing (a hidden page still gets no frames, and the clamp drops the gap). On entering background with `'pause'`, it also calls `Flow.openMenu()` once, so the player comes back to the game's pause menu and play does not resume on its own (FloorFifty `menu-request.test.ts`; Q4). Each change publishes `time.changed`.
- **`PresentationBus`** (FloorFifty `presentation-event-bus.ts`): typed, synchronous, FIFO, facts only. A publish during delivery is appended, not nested; a listener that unsubscribes mid-delivery does not disturb the others. AF has no router, so the bus isolates a throwing listener itself: the error is logged and delivery continues. Runtime facts: `RuntimeFacts = { 'sim.events': readonly SimEvent[]; 'screen.entered': { screen: string; from: string | undefined }; 'time.changed': { paused: boolean } }`. `typedBus<GameFacts>()` gives a game a typed view over the same bus; publishing is a plain call with no Effect.
- **`Settings`** (FloorFifty `common/settings.ts` and `settings.svelte.ts`): one versioned JSON record under one `Hosting.saves` key.

```ts
interface SettingsDef<S> {
  readonly key: string                                          // e.g. 'settings'
  readonly version: number
  readonly schema: z.ZodType<S>                                 // every field with its own .catch(default)
  readonly defaults: S
  readonly migrations?: Readonly<Record<number, (record: Record<string, unknown>) => Record<string, unknown>>>
}
interface SettingsStore<S> {
  get(): S
  subscribe(listener: (value: S) => void): () => void           // Svelte's store contract: called at once
  update(change: (value: S) => S): void                         // memory first, then saves.set in a runtime fiber
}
settingsStore<S>(def: SettingsDef<S>): Effect.Effect<SettingsStore<S>, never, Settings>
```

Missing, unparseable or future-version records give the defaults; one bad field costs only that field; migrations run one version at a time. A failed `saves.set` keeps the value for the visit and logs a warning; nothing is written to device storage instead (AGENTS.md "Honor host authority"). Every write is `saves.set`; the SDK batches and the host lane's exiting handler flushes.

### 3.8 The interface handed to the renderer (M1.7 implements it)

```ts
interface RenderTarget {
  readonly host: HTMLElement              // the stage layer, below screens and overlays
  readonly geometry: GeometryOwner        // ui's owner; the letterbox reads it (M1.7)
  readonly assets: Pick<Assets, 'get'>    // loaded bytes; the renderer decodes them
}
interface GameRenderer {
  apply(result: StepResult): void         // once per sim step, in order; a `resync` delta replaces everything
  draw(frame: FrameInfo): void            // once per display frame; interpolate previous → current by alpha
  reset(): void                           // a new sim is about to be run
}
type RendererFactory = (target: RenderTarget) => Effect.Effect<GameRenderer, RendererUnavailable, Scope.Scope>
const Renderer: Context.Tag<GameRenderer, GameRenderer>
```

The factory's scope is the runtime scope; its finalizer destroys the renderer. The runtime calls nothing else on it.

## 4. Data and lifecycle flow

**Boot** (`boot-program.ts`, one `Effect` whose error channel is exactly `BootError`):
0. `index.html` paints the game's CSS-only loader shell; `main.ts` imports `render-pixi/no-eval` first (M1.7; until then `base-2d`'s own `no-eval.ts`).
1. `runGame` creates the three layers in `root` (stage, screens, overlay), sets `data-state="loading"`, creates the geometry owner, installs ui hygiene (`installGlobalErrorHandlers`, `suppressPageGestures`, `lockOverscroll`), mounts `LoaderOverlay` (indeterminate) and waits one frame, so the host lifts its cover onto the game's loader (FloorFifty `main.ts` `afterFirstPaint`).
2. **Host:** `HostingLive({ ...game.hosting, disclosedEvents: content.game?.custom_events })`. A throw is `HostError{operation:'init'}`. `Hosting.display` feeds `geometry.setHostDisplay`.
3. **Storage and settings:** when `game.settings` is set, read the record with `saves.get`; a failure is `HostError{operation:'saves.get'}`.
4. **Content:** recompute `contentHash` over `content.data` with `@mcthaydt/automata-sim/hash` and compare with `content.hash`; a difference is `ContentHashMismatch`.
5. **Assets:** the preload screens' files and fonts, with byte progress on `LoaderOverlay`, under the stall rule.
6. **Renderer:** `game.renderer(target)`; its canvas draws nothing yet.
7. **Ready:** `Hosting.ready`, guarded by the stall rule; 30 s with no answer is `HostError{code:'TIMEOUT', retryable:true, operation:'ready'}` (FloorFifty line 518; Q2). Then the extension layer is built, the menu handler is registered (`Hosting.onMenuRequest(() => flow.openMenu())`), the lifecycle watcher starts, `LoaderOverlay` unmounts, `data-state="ready"`, and `Flow` enters the entry screen. Gameplay can render only from here.

**Failure:** the exhaustive match mounts `BootFailurePanel` with `hostKind` (`Hosting.kind`; before step 2 succeeds, `'standalone'`, which no init state reads) and sets `data-state="failed"`. *Try again* closes the runtime scope (SDK session disposed, fetches aborted, layers emptied) and re-runs the program in a fresh scope; it never reloads the page. *Continue without loading* (standalone, saves not retryable) re-runs with the settings defaults and skips step 3. *Back to Ruken* runs `Hosting.exit('player')`.

**Shutdown:** `RuntimeHandle.shutdown` closes the runtime scope. Finalizers run in reverse order: frame loop cancelled, current screen's scope closed, extension layers, renderer destroyed, Hosting closed (later calls fail `CANCELLED`), hygiene uninstalled, geometry owner disposed, layers emptied. A second shutdown is a no-op.

## 5. Failure policy

| Case | Behavior |
|---|---|
| Any boot step fails | Its `BootError` (§3.3, shared contracts §3); never a blank screen |
| A defect (a bug, not a typed failure) during boot | Logged with its cause. `BootDefect` (Q1, accepted), drawn as the `start` state with Try again |
| Host never says ready | `HostError{TIMEOUT, ready}` after 30 s of silence (Q2) |
| A file returns a non-OK status, or the network fails | `AssetLoadFailed{url, status}` (0 for a network error) |
| Nothing arrives for 30 s | `LoadStalled{url, bytesSoFar, stalledMs: 30000}`; the fetch is aborted |
| Screen load or `enter` fails after boot | The old screen stays (a failed load) or the screen layer is empty (a failed enter, whose scope is closed); `ErrorPanel` shows the `download`, `download-stalled` or `start` copy with Try again, which re-queues the same transition |
| `sim.step` throws or the sim faulted | Loop stops; `ScreenFailed` panel with Try again, which re-enters the current screen (the game makes a new sim there) |
| Event with no edge from the current screen | `dispatch` returns false, nothing changes; a dev build logs it once per pair (Q3) |
| Menu request mid-transition or on a screen with no menu | `false`: the host keeps its own drawer |
| `saves.set` fails (quota, offline, no grant) | Value kept for the visit, warning logged, no device-storage fallback |
| Corrupt or future settings record | Defaults; a bad field costs only itself |
| A bus listener throws | Logged; delivery to the rest continues |
| Extension cycle, missing requirement, duplicate name, manifest field outside Ruken's | `ExtensionError` naming both or all names; fails the build |
| Call after shutdown | Hosting calls fail `CANCELLED`; `dispatch` returns false; the loop does not start |

## 6. UI inventory and responsive behavior

The runtime draws only ui primitives, in the overlay layer, all renderer-free:

| State | Component | Focus and input |
|---|---|---|
| Booting, loading a screen | `LoaderOverlay` (indeterminate until the first byte, then progress; slow line at 8 s) | Takes the pointer; no focusable control |
| Boot failed | `BootFailurePanel` (states and actions by `bootFailureView`) | First action focused; Enter and Space activate |
| Screen failed | `ErrorPanel` with Try again | First action focused |
| Fade | A full-cover `div` above screens, below the loader | Takes the pointer while covering |

Layout is ui's: the geometry owner is created before the first mount (step 1) and fed `Hosting.display`, so the first frame has `data-form-factor`, insets and `hostReserved`; the primitives' own layout contracts at every reference size, 780×270 included, already cover these states (M1.6). Keyboard and browser-bar changes never remount a screen: Flow ignores resizes, and screens re-read geometry. Copy is a prop, so long text and M5's languages need no runtime change.

## 7. Test allocation

Vitest on Node (jsdom where something mounts), against the real SDK and `@ruken/sdk-host` through `HostingTest`. AF timing runs on `TestClock`; SDK timing on the host lane's `manualClock`; frames on `manualFrames` (a `FrameSource` the test advances). No test waits on wall time.

| File | Covers |
|---|---|
| `extension/define-extension.test.ts`, `resolve-extensions.test.ts` | Order by `requires` then name; duplicate, missing (both names), cycle (the loop), manifest field outside Ruken's (type test with `@ts-expect-error` and the untyped case); plugins, schemas, slots and preload merged in order; layers can require runtime services |
| `boot/boot-program.test.ts` | Step order (nothing mounted in the screen layer and Flow not started before ready); each step's failure gives its tag; ready silence gives `TIMEOUT`; `disclosedEvents` from content; `data-state` values |
| `boot/run-game.test.ts` | The match draws each tag's state; Try again starts a new SDK session (the fake host sees a second `hello`) and never calls `location.reload`; Continue skips step 3; Back to Ruken sends `exit`; shutdown order and idempotence |
| `boot/boot-error.test.ts` | `BootError` is assignable to ui's `BootFailure` (typecheck) |
| `loading/load-meter.test.ts` | FloorFifty `load-meter.test.ts`'s ten cases on `TestClock` |
| `loading/fetch-progress.test.ts` | FloorFifty `fetch-progress.test.ts`'s five cases |
| `loading/assets.test.ts` | FloorFifty `assets.test.ts` cases that apply: single flight, shared progress, failure not remembered, non-OK status, chunks feed the meter, stall aborts the fetch; plus fonts awaited and interrupt aborting |
| `loop/frame-loop.test.ts` | The Last Light `clock.test.ts` (fixed ticks however frames group; paused time dropped; long frames capped; reset); base-2d `loop.test.ts` (time from `now`, a step that stops the loop) |
| `loop/app-loop.test.ts` | Step order (commands, step, apply, bus only with events); `draw` every frame with alpha; paused draws without stepping; a faulted sim stops the loop |
| `loop/frame-loop-purity.test.ts` | `frame-loop.ts` and the per-frame path import nothing from `effect` (reads the import graph) |
| `loop/frame-loop.bench.test.ts` | Loop overhead per frame with a no-op sim and renderer, in Node and Chromium (§9) |
| `time/time.test.ts` | Background pauses under `'pause'`, not under `'continue'`; document hidden pauses standalone; menu reason from `pausesSim`; resumes only when no reason is held; background opens the menu once and play does not resume on its own |
| `flow/flow.test.ts` | FloorFifty `screen-manager.test.ts` and `presentation-flow.test.ts` cases that apply: never two screens live, exit before enter, current before enter, same-screen no-op, failed enter closes its scope and a later retry works, finalizers once in reverse order, fade cover/reveal and the queued-under-cover case, reduced motion; plus unmatched event, files loaded before exit, focus after enter, `openMenu` routing |
| `presentation/presentation-bus.test.ts` | FloorFifty bus cases: nested publish drained after, idempotent unsubscribe, dispose twice; a throwing listener isolated |
| `settings/settings.test.ts`, `migrate-settings.test.ts` | FloorFifty `settings.test.ts` and `settings-hosted.test.ts` cases that apply: defaults (absent, bad JSON, future version), field-by-field fallback, migration, round trip through the fake host's saves, a refused save kept in memory with nothing written to `localStorage`, store contract |

A real-browser journey of the boot states belongs to the demo (§8) under the shared fake host (`examples/demo-host`). Layout of the overlay states is ui's, already proven.

## 8. Demo `examples/runtime/boot-and-flow`

Needs no base: three DOM screens (`title`, `play`, `paused`) on ui primitives, a `nullRenderer`, a 60 Hz sim with one counter system so the tick shows, and a `?fail=` query (`init`, `saves`, `content`, `download`, `stall`, `renderer`, `ready`) that makes the fake host or `fakeFetch` fail one step, so every boot state can be seen. Its browser check boots it under `examples/demo-host`, waits on `data-state`, walks title → play → paused → play, and checks each `?fail=` state shows its panel. It is also the page the E1 to E3 size budgets are measured on (§9).

## 9. Budgets and feedback workflow

- **S8 budgets:** E1 (Effect's share of the initial bundle ≤ 35 kB gzip) and E5 (no CSP violation) must hold for the demo. Effect's share is measured from the build's per-module rendered bytes for `effect`, gzipped together. E2 to E4 are re-measured on the demo with S8's method in the nightly browser job. The runtime must not import `effect/Schema`, `@effect/platform` or anything S8 lists as kept out of the boot path.
- **Frame loop (the S8 gap):** "no Effect per frame" is pinned by the purity test. The bench records loop overhead per frame (median, 10,000 frames); the budget is the first measurement with S8's 2× headroom, recorded in `docs/spikes/s8-effect.md`, not a number set here.
- **Iterate:** `pnpm --filter @mcthaydt/automata-runtime test`, or `pnpm vitest run <file>`.
- **Gate:** the local CI run the Test Orchestrator names (`pnpm check`, parity, the demo's browser check), recorded in the PR.

## 10. Ruken alignment

| Behavior | Ruken source |
|---|---|
| Nothing renders before ready (R-04) | `sdk` `session.ready`, relayed by `Hosting.ready` |
| Pause behavior is fixed for the game's life | `protocol` `PauseBehavior`; manifest `[runtime] pause_behavior` (read from `ship.config.ts`) |
| Lifecycle states and reasons | `protocol` `LifecyclePayload` (`active`/`background`; `hidden`, `blurred`, `host-overlay`, `ad`, `offline-grace`) |
| Host menu reaches the game only through `onMenuRequest` | `sdk` `onMenuRequest`; AF's before-ready guard is the host lane's |
| Saves, limits and errors | `sdk` saves; AF quotes no limit (shared contracts §1.3) |
| Preload list | manifest `[loading] preload`, generated by content from the same `assets.toml` screens boot loads |
| No `eval` | Ruken's CSP via `compileHeaders`; the runtime generates no code, and `render-pixi/no-eval` comes first |
| Return to the launcher without a refresh | Try again and shutdown close the scope; nothing reloads inside a Ruken frame |

Nothing here needs a new request to Ruken.

## 11. What `base-2d` changes in M1.8

M1.8 moves `examples/base-2d` onto the runtime; this spec only lists the change so the interface fits it.

| Today (stand-in) | After |
|---|---|
| `main.ts` → `bootPage(startGame(root))` | `main.ts` → `runGame(base2dGame)` |
| `src/boot.ts` (`Ruken.init` direct, its own menu guard), `boot-page.ts`, `boot-failure.ts` (`BaseBootFailed`, `RendererFailed`, `SimFailed`) | Deleted: `HostingLive` through the runtime; `BootFailurePanel`; a failed first sim is the room screen's `ScreenFailed` |
| `src/loop.ts` (5 steps per frame, then drop) | `AppLoop` (100 ms clamp, 6 steps at 60 Hz). The golden route does not use the loop, so its hash does not change |
| `src/flow.ts` (a TypeScript table; `background` as a flow event) | `content/flow.toml` (splash, menu, room, paused, end); `background` goes away: Time pauses and opens the menu |
| `src/screens/screens.ts` (DOM panels) | One `ScreenDef` per screen on ui primitives; `paused` has `pausesSim: true`; fonts declared on `splash` |
| `game.ts` wiring and `failure.ts` | `base2dGame` (`GameDefinition`); rounds stay in the game, on the room screen's scope |
| `play-room.ts` (demos' entry) | Steps through `AppLoop` with the same options; demos keep their API |
| Renderer (`src/render/`) | Unchanged until M1.7; wrapped as a `RendererFactory` (`apply`, `draw(frame)` ignoring alpha, `reset`) |
| No settings | One setting the pause screen toggles (motion: system or reduced), read by the fade veil |

Draft #22 (the room as compiled content) stays held until M1.8 resumes. `examples/placeholder` is retired with S8 re-measured on `base-2d`, as the S8 verdict plans.

## 12. Exit criteria

1. `@mcthaydt/automata-runtime` exports §3.1; `pnpm style` and `pnpm boundaries` pass (the sim still imports no Effect).
2. Every case in §7 passes; the shared contracts' acceptance for the runtime holds: an exhaustive `BootError` match, and `defineExtension` rejecting a cycle, a missing requirement and a manifest field outside Ruken's schema.
3. The demo boots standalone and under the fake host, renders nothing before ready, walks its flow, and shows each `?fail=` state with the right actions; E1 and E5 hold; the frame-loop overhead is recorded.
4. **Failure cases that must fail as specified:** a 404 shows "Couldn't download the game" with Try again; 30 s of silence shows the stalled copy and aborts the fetch; a host that never says ready shows "Couldn't connect to Ruken" after 30 s; a tampered content hash shows "damaged"; Try again never reloads the page.
5. **Not claimed by M1.5:** `base-2d` on the runtime (M1.8), the renderer (M1.7), real-phone timing, Owner visual acceptance.

## 13. Open questions for the Owner

**Answered 2026-10-12 (Owner):** all nine recommended defaults below are accepted. Q1 adds `BootDefect` to `BootError` and ui's `BootFailure` additively (shared contracts §3).

1. **Q1, defects at boot.** `BootError` has no tag for a bug (a throw that is not a typed failure). Recommended: add `BootDefect` to `BootError` and ui's `BootFailure` (additive to shared contracts §3), drawn as the `start` state with Try again.
2. **Q2, ready that never comes.** Recommended: guard `Hosting.ready` with the 30 s stall rule and fail with `HostError{code:'TIMEOUT', retryable:true, operation:'ready'}`, as FloorFifty does (`main.ts` line 518). The risk is a host pre-roll longer than 30 s; Ruken does not say.
3. **Q3, an event with no edge.** FloorFifty treats it as a failure. Recommended: ignore it (`dispatch` returns false, a dev build logs it), because the host, lifecycle and input send events on any screen.
4. **Q4, background pauses into the menu.** Recommended: with `pauseBehavior: 'pause'`, going to background opens the game's pause menu and play does not resume on its own (FloorFifty's tested behavior, and `base-2d`'s today).
5. **Q5, settings shape.** The extraction map says "schema from content". Recommended: the schema stays Zod in code (per-field `.catch` and migrations are code), and every M1 setting lives in `Hosting.saves`; the device-only split arrives with audio settings in M5.
6. **Q6, landscape gate and fullscreen.** The ui spec assigned wiring them to M1.5. Recommended: defer to M4 display policy; FloorFifty skips the gate inside Ruken anyway.
7. **Q7, extension `wants`.** Ruken's manifest has no `wants` field, so `RukenManifestContribution` cannot carry capabilities as the shared contracts suggest. Recommended: add an optional `wants` to `ExtensionDef` (additive) when the first extension needs one (`leaderboards`); none does in M1.
8. **Q8, load before leaving.** FloorFifty exits the old screen and then loads the new one. Recommended: load the target's files first, with the loader over the old screen, so a failed load leaves the player on a working screen.
9. **Q9, fonts.** `assets.toml` lists files only. Recommended: a screen names its fonts in code (`ScreenDef.fonts`), awaited with `document.fonts.load` under the stall rule; no content schema change in M1.
