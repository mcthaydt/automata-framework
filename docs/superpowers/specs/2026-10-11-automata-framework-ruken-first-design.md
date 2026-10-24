# AutomataFramework: Ruken-first architecture (master spec, revision 2)

- **Date:** 2026-10-11
- **Status:** Draft for Owner review. Supersedes the [2026-10-01 master spec](./2026-10-01-automata-framework-overview-design.md) wherever the two disagree; sections of the older spec not replaced here (laws, state ownership, determinism rules) still apply.
- **Owner direction, 2026-10-11:** "AF needs to be Ruken first, and extract and improve things from both the pixi project and FloorFifty. We'll use PixiJS for 2D and 3D. Modify the work already done, then update documentation for everything after. We should have core things taken from both, and everything else can be modular extensions." Follow-ups the same day: "use Effect and the Koota ECS" and "handle CI/CD, deployment, UI (especially on mobile) and the content pipeline early, combining insights from Ruken, FloorFifty and the pixi project." Roadmap, the same day: "let's do 2D, 2.5D, and 3D; we did 2D and 2.5D, we'll finish AF, make a 3D game based on AF then merge in the 3D stuff."
- **Companion documents:** [extraction map](./2026-10-11-core-and-extensions-extraction-map.md) (source file → AF package), [ADR 0002 Pixi for 2D and 3D](../../adr/0002-pixi-for-2d-and-3d.md), [ADR 0003 Effect outside the sim](../../adr/0003-effect-outside-the-sim.md), [ADR 0004 Ruken-first host](../../adr/0004-ruken-first-host.md).

---

## 1. What changed and why

| Area | 2026-10-01 design | This revision | Reason |
|---|---|---|---|
| Primary host | Ruken, standalone web and Tauri as equal adapters behind `Hosting` | **Ruken is the primary target.** Ruken's own packages (`@ruken/sdk`, `@ruken/manifest`, `@ruken/sdk-host` fake host, Ruken's build validation) are the foundation of the host, packaging and test layers. Standalone play comes from the SDK's own standalone session, not a second AF adapter. Tauri becomes an extension. | Owner direction. Ruken now has working code for all of this (Ruken M1 was Owner-accepted on 2026-10-09, except Ruken M1.7d and the `contracts-f1` tag, with FloorFifty hosted through it), so AF should consume it rather than re-derive it from the P01 spec. |
| Renderers | Three.js (`render-three`) and PixiJS (`render-pixi`) | **PixiJS only**: Pixi 8 for 2D in core, `@pixi/3d` for 3D as an extension | Owner direction. FloorFifty (2D) and The Last Light (2.5D/3D) both already run on Pixi, so one renderer covers both reference games and halves the post-process and visual-golden work. See ADR 0002. |
| Effect | Skipped | **Adopted outside the sim**: runtime services, boot, host adapters, content compiler, CLI, ship tooling and pipelines | Owner direction. The sim stays plain synchronous TypeScript for determinism and speed. See ADR 0003. |
| ECS | Koota (ADR 0001) | **Unchanged: Koota**, behind the sim facade | Owner direction confirms ADR 0001. The Last Light's Miniplex code ports onto the facade. |
| Reuse from games | Deferred to "Part C", after a future 3D game | **Now, for 2D and 2.5D.** Core packages are built from proven code in FloorFifty (2D), The Last Light (2.5D) and Ruken. Everything else ships as opt-in extensions. | Owner direction. Both games already demonstrate the behavior the old plan was waiting for. |
| Dimensions | 2D and 3D from the start | **2D and 2.5D in AF 1.0; full 3D after.** AF is finished on 2D and 2.5D. A 3D game is then built on AF, and its proven 3D pieces (rigged characters, animation, third-person camera and controller, brush-based environments) are merged back into AF (M9). **Amended 2026-10-23 (Owner):** 2.5D is dropped (2026-10-18) and "3D ships 1.0": the base 3D game is built inside AF 1.0 with procedural characters, and M9 promotes its systems into packages before the launch. | Owner direction. The same rule as the rest: extract from a game that already works. |
| Delivery order | Complete every A/B spec, then build A1b, A1c, A2 … A9, then B, then a game, then C | **Milestones, Ruken style.** M1 ships a blank game to Ruken end to end, with CI/CD, deployment, mobile UI and the content compiler in it. Each milestone's spec is written and reviewed at the start of that milestone. | Owner direction to handle CI/CD, deployment, mobile UI and content early. Ruken freezes each contract at the start of the milestone that uses it; AF does the same. |
| Docs | `001`–`004` numbered docs, phases A0–A9, B1–B2, C | `00`–`04` numbered docs matching Ruken's, milestones `M0`–`M8` | Ruken first applies to how the work is run too. Phase IDs from the old plan are mapped in [01 Decomposition](../../01-decomposition.md) §2. |

What is kept, unchanged: the seven laws (old spec §2), state ownership (§5), the A0 spike verdicts except S3, ADR 0001, the A0+A1 sim design (§4 of that spec and its §11–§12 refinements) and all merged A1a code in `packages/sim` and `tooling/`.

## 2. Laws

The seven laws stand. Law 7 is sharpened:

7. **The host is a port, and Ruken is the reference host.** All host access goes through the `Hosting` service. Its shape follows Ruken's P01 catalog, capabilities and limits as implemented in Ruken's `packages/protocol` and `packages/sdk`, not an AF-invented abstraction. Standalone play uses the SDK's own standalone session; another adapter (Tauri) implements the same service and must behave the same where Ruken defines behavior. AF never restates a Ruken limit: limits are read from Ruken's code (for example the SDK counts save *value* bytes only, `packages/sdk/src/save-map.ts`). A capability Ruken denies or that is unavailable fails visibly with the SDK's error; AF adds no fallback to device storage. A failed in-frame handshake follows the SDK: it falls back to standalone, and AF reports it (shared contracts §1.2).

## 3. Stack

| Concern | Choice | Notes |
|---|---|---|
| Simulation | Koota 0.6.6 behind the `automata-sim` facade; xoshiro128** RNG; `automata-sim/math`; `automata-sim/hash` (XXH64 and canonical JSON) | As built in A1a. No Effect, no DOM, no wall clock (boundary checker). |
| Physics | Rapier `-deterministic-compat` 0.21 (2D and 3D) in the `physics` extension | Spike S2 proved parity on a fixture, but neither reference game runs it: FloorFifty uses Planck and keeps it, The Last Light uses standard Rapier and moves to the deterministic-compat build when it adopts AF. M2.1 proves four-engine parity before anything depends on it. |
| Effects, services and errors | **Effect** (`effect`; `@effect/platform-browser` only where S8 allows) | Outside the sim only. Exact versions are pinned in M1.1 and recorded in `docs/versions.md`. |
| Schemas | **Zod 4** (`4.6.5`, the version Ruken pins) | Shared with Ruken's protocol and manifest packages and with the sim's command payloads. Effect Schema is not adopted; one schema language. |
| Rendering | **PixiJS 8.22+** (2D, core); **`@pixi/3d` 0.1.0-beta.2** (3D, experimental extension, D-1) | **WebGL2 is the default**; WebGPU is opt-in per game (FloorFifty forces WebGL for mobile reach, and Ruken's manifest renderers are `webgl2`, `webgl`, `canvas2d`, `wasm-webgl2`, with no WebGPU value). Filters ship as GLSL + WGSL pairs (S4) so opting in costs nothing. Every game runs Pixi's no-eval build and Zod jitless (FloorFifty `no-eval.ts`), because Ruken's game CSP has no `'unsafe-eval'`. |
| UI | Svelte 5 with plain CSS and theme custom properties | Svelte as in FloorFifty and Ruken's `packages/ui`. Menus and HUD stay in the DOM. Tailwind and GSAP are not core (Ruken's UI uses neither); tweening belongs to `feel`. |
| App and UI state | Svelte 5 rune stores | As in FloorFifty. Mirrors of sim state are read-only (old spec §5). Nano Stores (The Last Light only) is not adopted. |
| Presentation facts | Typed synchronous FIFO bus (FloorFifty `presentation-event-bus.ts`), exposed as an Effect service | Replaces raw mitt in core. mitt is no longer a core dependency. |
| Host | `@ruken/sdk`; `@ruken/manifest`; `@ruken/sdk-host` (fake host for tests) | Vendored as tarballs in [`vendor/ruken/`](../../../vendor/ruken/README.md) at a recorded RukenApp commit (D-6, FloorFifty's pattern) until Ruken publishes them; Ruken gates publication on its `NPM_PUBLISH_READY` variable and the M0.3 npm scope. |
| Tooling | Node 24, pnpm 10, Turborepo, TypeScript, Vitest 5, Playwright 1.63, Changesets, lefthook | Versions follow Ruken's `docs/versions.md` where AF consumes Ruken code (Zod, Node); M1.1 records each deliberate difference instead of downgrading (AF is on TypeScript 7.0.2, Ruken pins 6.0.3). Lint and format stay on Biome (D-3). |

## 4. Package map: core and extensions

Every package publishes as `@mcthaydt/automata-<name>` on GitHub Packages. **Core** packages are what any Ruken game needs and are installed by `create-game`. **Extensions** are opt-in packages registered through `defineExtension` (§5); a game that does not install one ships none of its code. The [extraction map](./2026-10-11-core-and-extensions-extraction-map.md) lists the source files each package starts from.

### 4.1 Core

| Package | Owns | Built from |
|---|---|---|
| `sim` | Deterministic simulation: Koota facade, fixed step, RNG substreams, commands, scheduler, resources, snapshot/restore, render delta, `./math`, `./hash` (XXH64 and canonical JSON, shared with `content`); a snapshot-section hook so plugins such as `physics` add their own snapshot section; `./replay`, the `.replay` codec, recorder and stepper (M2.3) | AF A1a (merged). The Last Light's record/replay and `worldHash` inform the replay harness. |
| `content` | TOML → Zod → canonical JSON + hash; diagnostics; watch mode; typed accessors; Vite plugin; generators for the `ruken.toml` content fields, locale keys, the telemetry catalog and the loading preload list | **Extracted from FloorFifty's working compiler**, `packages/content` (`@floor-fifty/content`: smol-toml parse, Zod schemas, validation, canonicalization, diagnostics, revisions, watch) with its tests from `tests/content/`, generalized from FloorFifty's game schema; hashing moves to `automata-sim/hash`. The A0+A1 §5 design fills gaps only. Ruken's manifest `content`, `analytics` and `loading.preload` sections. |
| `host` | The `Hosting` Effect service. Adapters: **`ruken`** (wraps `@ruken/sdk`), **`web`** (standalone; same limits). Test layer from `@ruken/sdk-host` fake host. | FloorFifty `apps/client/src/ruken/{host,current,exit,analytics}.ts` and its 13 Ruken test files; AF S6 contract tests and Ruken's answers |
| `runtime` | Boot and loading (including FloorFifty's `assets.ts`, `veil.ts` and `boot-version-check.ts`), app loop (fixed sim step, variable render, interpolation), Time (pause modes, lifecycle and menu pause), Flow (screens from `flow.toml`, one transition at a time), presentation bus, settings store over `Hosting` storage, Input (keyboard, pointer, touch, gamepad; the gamepad's host-summon button is the SDK's and never reaches game input), Save (Ruken saves), Audio core (buses, unlock, `audio.focus`/`audio.master`), Localization core (language from `session.locale`) | FloorFifty `main.ts` boot, `load-meter.ts`, `fetch-progress.ts`, `screen-manager.ts`, `screens/screen.ts`, `presentation/*`, `common/settings.ts`, `gamepad-source.ts`, `swipe-tracker.ts`, `audio/*` engine; The Last Light `clock.ts`, `session.ts`, `input.ts`, `audio/mixer.ts`. None of these sources uses Effect, so each is a rewrite onto Effect services whose tests come across as behavior specs. One package in M1 with a folder per service; the M4 and M5 specs decide whether Input, Save and Audio move to their own core packages once their scope is complete. |
| `render-pixi` | Pixi 8 2D adapter: the `./no-eval` entry every game imports first (`pixi.js/unsafe-eval`, Zod `config({ jitless: true })`); renderer init on WebGL2 by default with WebGPU opt-in and a `?renderer=` override; canvas resolution; `RenderDelta` consumer with interpolation and `resync`, pixel framebuffer option, letterbox, filter-program helpers (GLSL + WGSL pairs, pixel position from the vertex stage) | FloorFifty `apps/client/src/no-eval.ts`, `managers/app.ts` render setup (`preference: "webgl"`), `letterbox.ts`, `canvas-resolution.ts`; The Last Light `stage.ts` init (lines 355–373), `filter-programs.ts`. FloorFifty's `quality.ts`, `quality-rebuild.ts` and `render-target.ts` join in M4 (graphics settings). |
| `ui` | Mobile-first Svelte primitives (FloorFifty only, but core because Ruken requires layout under `display.metrics` on phones and Ruken's own UI is Svelte): geometry owner (form factor, height tier, visual-viewport tracking), ScreenFrame, ActionBar, CornerControls, Split, ScrollList, OptionGroup, PagerDots, Dialog, LoaderOverlay, ErrorPanel with Try again, focus navigation, cursor policy, back gesture, touch-control surface, theme tokens; browser hygiene (global errors, hidden browser bar, overscroll, page gestures, sleep when hidden, device class, landscape gate, image retry, input method, reduced motion) | FloorFifty `ui/layout/*`, `ui/{form-factor,height-tier,viewport-tracking.svelte}.ts`, `ui/focus-nav.ts`, `ui/cursor-policy.ts`, loader/error components; Ruken `packages/ui` (Button, IconButton, Dialog, Toast, theme tests); The Last Light `ui/kit.ts` tokens and `ui/access.ts` |
| `testing` | Sim and replay goldens (the golden harness, divergence diff and property test over `sim/replay`, M2.3); renderer-free component/screen fixtures; layout assertions (hit testing, target size, clipping, overlap, reachability); Playwright config helpers (per-checkout ports, reuse server, viewport projects); fake-host journeys | AF A0+A1 §6; FloorFifty `tests/e2e/support/layout.ts`, `playwright.config.ts`, `tools/e2e-serve.ts`, `tools/promote-evidence`; Ruken `e2e/sandbox`, `e2e/golden`, `@ruken/sdk-host` testing |
| `ship` | Reusable GitHub workflows (`game-ci.yml`, `game-release.yml`), focused remote runs (`test:remote`, needed for the reused runners), `ship prepare` (writes `ruken.toml` from config and content, checks it with `@ruken/manifest`'s `parseManifest` plus version, tag and root-absolute path checks), `ship publish` (hands `dist/` to `ruken publish`, which packs and validates; AF has no pack or validate step of its own), standalone dev and release hosting serving `@ruken/manifest`'s `compileHeaders` CSP | FloorFifty `deploy/tools/ruken-pack.ts`, `tools/test-remote`, `release.yml`, `release-builds.yml`, `docs/release.md`; Ruken `tooling/ruken-cli/src/{pack,publish}.ts`, `packages/validation`, `docs/self-hosted-runner.md`, `tooling/versions/pins.ts` |
| `dev-tools` (extension, dev only) | Worktree cleanup (`worktree-gc`), evidence capture and promotion | FloorFifty `tools/worktree-gc`, `tools/promote-evidence` (FloorFifty only, so not core); arrives with visual checks in M4 |
| `cli` | `create-game`, `update-game`, `validate`, `doctor`, `pack`, `publish`, `dev` (runs the game under the fake Ruken host) | New, on Effect; wraps `ship` and `content` |
| `check-boundaries`, `check-style` (tooling) | As built in A1a, with a fixture pinning that `packages/sim` may not import `effect` | AF A1a |

### 4.2 Extensions

| Extension | What it adds | Built from |
|---|---|---|
| `physics` | Rapier 2D and 3D sim plugins (deterministic-compat build), snapshot section 6, contact-event order, measured size and ms/tick. `net` stays physics-agnostic. | AF A0+A1 §4 physics design; spike S2 (Rapier parity); The Last Light's Rapier use, rewritten for the deterministic build |
| `leaderboards` | Leaderboards service on the Ruken session (`submit`, `get`) and the `[leaderboards]` manifest table | Ruken `packages/sdk` `LeaderboardsApi`; Ruken manifest |
| `render-pixi3d` (experimental, unpublished, D-1) | `@pixi/3d` adapter, scoped to 2.5D until M9: `View3D` setup, fixed-zone and orbit camera rigs, `Sprite3D` billboards (cylindrical/spherical), lit sprites from normal maps, single-mesh GLB and `.pack` loading, fog and particle mist, baked vertex lighting and occlusion | The Last Light `render/{stage,sprite-light,indirect-light,occlusion,fog,glb,props,showcase}.ts` |
| `post-retro` | Post chain as data: Bayer dither, LCD snap and panel, palette LUT, grade, bloom, grain, vignette (2D and 3D) | The Last Light `retro-filter.ts`, `bloom-filter.ts`, `lcd-panel.ts`, `palette.ts`; FloorFifty's eight GLSL filters and `filter-stack-guard.ts`; S4 dither |
| `audio-synth` | Procedural cues and beds as data, game-event → cue mapping, ducking, listener panning, offline render, audio checks (true peak, clicks, loudness) | The Last Light `audio/*` and its make-audio pipeline |
| `audio-stream` | Streamed music with decode-behind playback, song preloading, iPad unlock diagnostics | FloorFifty `managers/audio/{song-bridge,menu-stream,song-preloader,deck,diagnostics}.ts`, `docs/ipad-audio-check.md` |
| `feel` | Juice/effects as data (shake, hit-stop, flashes, haptics, tweening) with a coverage board and reduce-flashing support | The Last Light `feel/*`; FloorFifty `juice.toml`, `haptics.ts` |
| `sectors` | Build-engine-style sector maps: polygons with floor/ceiling heights, portals, wall detail; extruded meshes; Rapier colliders; light occlusion; cutaways; rule-based dressing | The Last Light `game/{sectors,sector-format,rooms,cutaway}.ts`, `render/{sector-mesh,dressing}.ts`. This is the starting point for the environment pipeline (old B2). |
| `nav` | Authored navigation graphs and click-to-walk routing | The Last Light `game/nav.ts` |
| `puzzle` | Verb/item/lock puzzle interpreter, solver, softlock search and generated route tests | The Last Light `game/{puzzle,puzzle-solver}.ts`, `contracts/puzzle.ts` |
| `systems` | NPC state machines, world rules, tunables, scenario probes and bot playtests | The Last Light `game/{systems,agents,probes,bots,pursuit,rules}.ts` |
| `narrative` | Dialogue-graph runtime with stance and facts, line records, lints and beat coverage | The Last Light `narrative/*` |
| `cutscenes` | In-engine cutscene scripts, builder, lint and preview | The Last Light `game/{cutscenes,cutscene-builder,cutscene-lint}.ts` |
| `net`, `server` | Opt-in multiplayer: `NetworkPort`, Colyseus client, room-mirroring store, server room running the same sim, input queue and tick scheduler, prediction and reconciliation | FloorFifty `managers/network/*`, `systems/netcode/*` (where prediction and reconciliation live), `ui/store/room-store.svelte.ts`, `apps/server/src/rooms/{input-queue,tick-scheduler,room-driver}.ts` |
| `store` | Ruken store and season pass (SKUs, seasons, tiers, grant-once ledger in Save) | Old A9 design. Waits on Ruken's `[store]` manifest section, which Ruken has not built yet. |
| `debug` | Debug panels and overlay registry, stripped from release builds | Old A6 design; The Last Light `?debug=1`, `feel/board.ts`, `audio/board.ts` |
| `telemetry-extra` | Umami and Grafana Faro adapters for standalone builds | Old A6 design. The Ruken adapter and the `track()` port stay in core `host`/`runtime`. |
| `host-tauri` | Tauri desktop adapter (owns Quit) for standalone desktop builds outside Ruken | Old A2/A3 design. Ruken has its own Tauri app; M7.0 decides whether AF still needs this. |
| `i18n-extra` | Extra fonts (CJK, Korean, dyslexia), long-text layout fixtures | FloorFifty `tools/i18n`, `docs/i18n/`; M5.0 decides whether core localization adopts FloorFifty's Paraglide setup |
| `pipelines` (dev tooling, never in a game bundle) | The asset/content pipeline platform: `pipe` router, MCP server, guard hook, budgets, gates, audit log, and the 2.5D character (lit sprite atlas with normal map), props (image → Meshy → flattened GLB), reference, scene/blockout and vision pipelines | The Last Light `scripts/{pipe.mjs,pipeline,mcp,guard}`, `pipeline.config.json`, `.claude/skills/*`, `direction/*`, `vision/*`. The rigged 3D character pipeline (old B1) comes from the 3D game in M9. |

**Placement rule.** A capability is core when Ruken requires it of every game (startup gating, lifecycle, layout under `display.metrics`, all four input paths, saves, audio focus, packaging, CSP and no-eval, offline, localization from `session.locale`, analytics naming) or when both reference games need it. Anything else is an extension. Moving an extension into core later is an explicit, reviewed decision.

**Recorded exceptions** (core although only one game proves them, audit 2026-10-11): Svelte `ui` primitives, the gamepad source and the letterbox (FloorFifty; core because Ruken requires mobile layout under `display.metrics` and all four input paths); Flow from `flow.toml` and the presentation bus (FloorFifty; core because every Ruken game needs boot → splash → menu screens and extensions such as `feel` and the audio extensions need one channel for sim events). The Last Light's equivalents (session phases, its event dispatch) are the second consumer when it adopts AF (M8).

## 5. Extension contract

A single registration function ties the layers together. Exact types are in the [M1 shared contracts](./2026-10-11-m1-shared-contracts-design.md#2-defineextension); the shape is:

```ts
export const sectorsExtension = defineExtension({
  name: 'sectors',
  requires: ['render-pixi3d'],          // other extensions; resolved and ordered by name like sim plugins
  sim: [sectorsPlugin],                 // sim plugins (definePlugin results); deterministic, no Effect
  content: [SectorMapSchema],           // defineContentSchema results, merged into the compile
  layers: SectorsRenderLive,            // Effect Layer(s) providing runtime services
  ui: { slots: { 'debug.panels': SectorsPanel } }, // named UI slots; no framework files edited
  manifest: (config) => ({}),           // contributions to the generated ruken.toml (only fields Ruken defines)
})
```

Rules: an extension never edits a core file; core never imports an extension; an extension's sim plugin obeys every sim boundary rule; manifest contributions may only set fields in Ruken's manifest schema; each extension has its own tests and a fixture game under `examples/`.

**Determinism check beyond `packages/sim`.** Any package that exports a sim plugin (`physics`, `sectors`, `puzzle`, `systems`, and a game's own `sim/` folder) runs `check-boundaries` on its sim sources, in AF CI and in the game CI template (`game-ci.yml`, M1.2). The checker takes a list of source roots; the lane that adds a plugin package adds its root.

## 6. Effect boundaries

See ADR 0003 for the decision record. Effect is adopted by Owner direction (2026-10-11) and stays whatever spike S8 measures: S8 sets the budgets (bundle bytes, boot time on the phone profiles) and the mitigations if they are exceeded (fewer modules, lazy layers, `@effect/platform-browser` only where needed). S8 runs in M1.1 against the ship lane's placeholder page, so the budget exists before the runtime is built.

- **Inside `packages/sim`: no Effect.** The step function, systems, snapshot and hash stay plain synchronous code. `check-boundaries` already rejects `effect` and `@effect/*` through its import allowlist; the `import-effect.ts` fixture pins that.
- **Runtime and host:** each manager is an Effect service (`Context.Tag` + `Layer`): `Hosting`, `Storage`, `Clock`, `Renderer`, `Flow`, `Time`, `Input`, `Audio`, `Save`, `Settings`, `Telemetry`, `PresentationBus`. Boot is one Effect program (§7). Failures are typed errors (for example `HostHandshakeFailed`, `ContentHashMismatch`, `LoadStalled`, `CapabilityDenied`), so every failure path has a named UI state.
- **Lifetimes:** `Scope` and finalizers replace FloorFifty's `DisposeBag`; a screen's resources are released on exit by its scope, and a game restart (Ruken requirement: return to the launcher without a page refresh) closes the whole runtime scope.
- **Time:** Effect's `Clock` is the injected clock (Ruken rule: never call `Date.now()` in domain code). AF's own timing (load stalls, save-flush timeouts, retries) is tested with `TestClock`. The SDK's timing (hello retry, handshake give-up, RPC timeouts) runs on `SdkEnv.timers` and the exit grace is enforced by the host, so tests drive those through an injected fake `SdkEnv` and the fake host's clock, not `TestClock` (shared contracts §1.4).
- **The frame loop** is plain code driven by `requestAnimationFrame` inside a runtime fiber; it does not allocate an Effect per frame. Measured in spike S8.
- **Build-time code** (content compiler, CLI, `ship`, `pipelines`) uses `node:fs` and `node:child_process` inside `Effect.try`, behind two small shared services in `packages/node` (`@mcthaydt/automata-node`: `Files` and `ProcessRunner`), with typed errors that become `file:line:col` reports. `@effect/platform-node` is not used: its 0.108 line needs the `@effect/cluster`, `rpc`, `sql` and `workflow` peers and native build scripts (ship lane, 2026-10-11).

## 7. Boot and loading (core, Ruken first)

Ordered steps, each with a named failure state. This combines the old spec §6 boot, Ruken's handshake rules and FloorFifty's M2.1g loading rules ("never a blank screen; no screen before its fonts, art and music; slow keeps going; a stall fails with Try again").

1. **First paint before code.** `index.html` paints the loader shell with CSS only (no inline script, Ruken CSP); a slow-network line appears by CSS delay. The entry module imports `render-pixi/no-eval` before anything else.
2. **Host.** `Hosting` initializes through `Ruken.init`, which owns the handshake (its retry interval, give-up and source and origin checks live in Ruken's `handshake.ts`). A top-level page, or a frame with no valid `welcome`, gets the SDK's standalone session; the framed case is reported as `handshake.fellBack` and logged, not fatal (shared contracts §1.2).
3. **Storage and settings.** Saves snapshot from `welcome`; settings load through `Hosting` storage.
4. **Content.** Compiled content loads; its hash is checked against the build's.
5. **Assets.** The screen's declared fonts, art and audio load with byte progress (`fetch-progress`); the preload list matches the generated `[loading] preload` in `ruken.toml`. Progress never sits at 0% before the first byte arrives. A load with no progress for 30 s is a stall and shows Try again.
6. **Renderer.** Pixi initializes on WebGL2 (WebGPU first only when the game opts in, then falling back to WebGL2 once).
7. **Ready.** The splash shows; gameplay renders **only after `session.ready`**. `menu.open` before ready is refused by AF's guard (the SDK at `b30d31b` does not refuse it; shared contracts §1.6).

## 8. Mobile-first UI (core, early)

UI is designed for a phone first and verified at phone sizes before desktop. Layout depends on container size and usable height; input mode is independent of layout.

- **One geometry owner** in `ui`: layout viewport, usable region (after safe area and Ruken's `hostReserved` edge rectangle) and visual-viewport occlusion. Form factor uses FloorFifty's thresholds (600 px portrait, 500 px landscape) and height tiers (short below 600 px, compact below 340 px) as starting values; opening a keyboard never reclassifies the form factor.
- **Reference sizes** for every layout contract: small portrait, compact landscape including 780×270, tablet portrait and landscape, desktop, each breakpoint boundary, with the browser bar and keyboard open where relevant.
- **Targets:** 44 px minimum, 48 px for primary actions. Decoration shrinks before controls do. Declared scroll regions only.
- **`display.metrics.scale`** (4/3 on Ruken's TV mode) is a hint to enlarge HUD and text, never CSS zoom.
- **Testing:** components and screens mount with production styles and fixture stores, without a renderer or server. DOM tests prove interactions; a real browser proves geometry with FloorFifty's layout assertions; composed journeys under the fake Ruken host prove integration; phone and tablet journeys run on the GPU runner nightly and on request; Owner visual acceptance stays a separate gate.

## 9. Content pipeline (core compiler early, asset pipelines as extensions)

- **M1:** the `content` compiler, extracted from FloorFifty's `packages/content` (fix first: its sorts use `localeCompare`, which the content hash must not depend on), and a Vite plugin, plus generators for the Ruken manifest fields (`content.languages`, `analytics.custom_events`, `loading.preload`), locale keys and the flow graph. Errors are `file:line:col`. Content hash feeds the snapshot header.
- **M3:** the `pipelines` extension: The Last Light's router, MCP server, budgets, gates, guard and audit log, made game-agnostic (its look bible, prompts and gates per game become content), with its 2.5D character and props pipelines. The sector-based environment pipeline follows in M6. Rigged 3D characters and brush-based environments (old B1/B2 in full) come from the 3D game in M9.
- **Art direction (Owner, 2026-10-11):** the Endesga 64 palette and a Bubble Bobble × Celeste look for 2D, 2.5D and 3D ([docs/art](../../art/README.md)). The palette is content (compiled and hashed with the rest), the default `ui` theme tokens and `post-retro` LUT come from it, and the `pipelines` palette gate checks assets against it.
- Generated files are never hand-edited (guard hook); human gates record decisions only (R-80 style: people decide, checks record facts).

### 9.1 Base projects and feature demos

Owner direction (2026-10-11): a teeny tiny base project per dimension (a character in a room: `examples/base-2d`, `base-25d`, `base-3d`), and every modular feature demonstrated by a small standalone demo on the matching base, raylib-examples style (`examples/<package>/<demo>/`, one `main.ts`, smoke-tested, listed in a gallery). The convention is in [`examples/README.md`](../../../examples/README.md). Each lane's PR ships its feature's demo; `base-2d` replaces the old `blank-game` in M1.8, and `base-25d` and `base-3d` land in M3. A feature without a demo is not done.

## 10. CI/CD and deployment (early)

- **Reusable workflows** in `ship`: a game's `ci.yml` is about five lines calling `game-ci.yml@v<major>`.
- **Lanes of feedback:** unit, typecheck, boundaries, style, content compile and renderer-free UI tests on GitHub-hosted Ubuntu on every push; cross-engine parity on hosted Ubuntu; browser journeys and visual checks on the GPU runner nightly and on request through a focused `test:remote <spec> --project=<viewport>` (FloorFifty pattern); Ruken gates (handshake, nothing rendered before ready, CSP scan, manifest validity, and Ruken's own build validation through `ruken publish`) on every release build.
- **Runners:** GitHub-hosted first. The self-hosted runners the Owner already operates for Ruken and FloorFifty (WSL Linux runner, Windows GPU runner) are reused before any new machine; the Linux GPU box from the old plan becomes optional, decided in the M1 spec from measured queue times. AF would be the third tenant on those runners (Ruken already records FloorFifty's suite slowing from 1.2 h to 1.9 h on the shared PC), so AF's browser lanes run nightly and on request only, and M1.1 measures the added queue time.
- **Packaging:** `ruken.toml` is generated, never hand-written, then checked with `@ruken/manifest`'s `parseManifest`. `ruken publish <dir>` packs the build and runs Ruken's build validation before upload, so AF has no pack or validate step of its own and quotes none of Ruken's limits (they live in Ruken's `packages/validation`). `ruken publish` has no dry run; `@ruken/validation` is private.
- **Deployment targets:** (1) Ruken: `ruken publish` of the same release tag. Ruken's local stack is the only M1 target; Ruken's TEST environment is not provisioned yet (an external input, 01 Decomposition §6); (2) standalone: a dev host with a build per branch and per release (FloorFifty's `/builds/<buildId>/` model) and a release host. The standalone provider (Cloudflare Pages/R2 in the old plan, or the existing Caddy VM pattern) is decided in the M1 spec.
- **Identity and evidence:** every result names its build ID, commit, content hash, runner and browser. First-attempt failures are preserved. Evidence screenshots go to an ignored `evidence/` folder and are promoted to committed baselines only after Owner approval.
- **Versions:** a `docs/versions.md` page and a pins test, as in Ruken, keep Node, pnpm, TypeScript, Vitest, Playwright and Zod aligned with Ruken.

## 11. Milestones

Each milestone gets a spec at its start, reviewed by the Owner, then just-in-time TDD plans per task. Order and tasks live in [02 Master delivery plan](../../02-master-delivery-plan.md).

| Milestone | Outcome | Exit (abridged) |
|---|---|---|
| **M0 Foundation** | Spikes S1–S6, ADR 0001, sim core (A1a) | Done; merged PRs #1 and #2 |
| **M1 Blank game on Ruken** | Toolchain aligned with Ruken; Effect runtime skeleton; `base-2d` and the demo gallery; `content` compiler; `host` (the Ruken SDK, hosted and standalone, fake-host tests); boot and loading; Flow/Time/presentation bus; `render-pixi` 2D; mobile-first `ui` primitives; reusable CI; generated `ruken.toml` and `ruken publish`; standalone dev host; `examples/base-2d`; minimal `create-game` | `create-game x`, push: CI green, published with `ruken publish` (which validates) to Ruken's local stack, and to the dev host, playable on a phone; nothing renders before ready; layout contracts pass at every reference size including 780×270 |
| **M2 Deterministic core complete** | Physics plugins, sim and replay goldens, 200-seed property test, first-divergent-tick diff, `0.0.x` prerelease publishing | The A0+A1 spec's A1 exit criteria 2–8 |
| **M3 2.5D and the pipeline platform** | Spike S7 (`@pixi/3d`); `render-pixi3d` at 2.5D scope; `base-25d` and `base-3d`; `post-retro`; `pipelines` platform; 2.5D character and props pipelines | A 2.5D example scene (fixed-camera room, billboard characters, GLB props) renders on WebGL2 (and WebGPU when opted in) under Ruken's CSP at ≥30 FPS on the phone profiles, in a private build (D-1); one character goes through the pipeline with its gates |
| **M4 Input and display complete** | Gamepad, touch overlay and gestures, rebinding, focus navigation across screens, letterbox, safe area, `hostReserved`, scale hint, graphics settings, color-blind UI | Input × form-factor E2E matrix passes under the fake Ruken host |
| **M5 Saves, audio, localization** | Ruken saves with versions and migrations, sync status, exit flush; audio buses and focus; `audio-synth` and `audio-stream`; six languages | Save N loads on N+1; save, exit and resume works across devices on Ruken; every UI string localized and laid out at long-text sizes |
| **M6 Gameplay extensions** | `sectors`, `nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `feel`, `debug`, `telemetry-extra`; environment pipeline on `sectors` | Each extension's fixture game passes; The Last Light's route tests pass against the extracted `puzzle` |
| **M7 Online and store** | `net` and `server`; `store` once Ruken's `[store]` manifest section exists; `host-tauri` | Two-client replay golden; single-player bundles contain no netcode; entitlement replays reproduce |
| **M8 CLI 1.0 and adoption** | Full CLI, codemods, docs, 1.0 (AF is finished for 2D and 2.5D); FloorFifty and The Last Light each run a slice on AF packages | `update-game` migrates the example from 0.x to 1.0; each reference game's adopted slice passes its own existing tests |
| **GAME-3D** | **Amended 2026-10-23:** the base 3D game, `games/base-3d`, built inside AF 1.0 (not after it, and not in its own repo) as the counterpart of the 2D platformer Emberwick, authored in the editors. A 3D game built on AF 1.0 in its own repo, with its own reviewed design. A small third-person action-adventure is the current suggestion; the Owner picks the concept. 3D-only systems live in the game first. | The game's own playable, deployed and Owner-accepted evidence on Ruken |
| **M9 3D merge** (**amended 2026-10-23:** now 3D systems into packages, before the 1.0 launch) | The 3D game's proven pieces move into AF: full 3D in `render-pixi3d`, rigged character and animation pipeline, third-person camera and character controller, brush-based environment pipeline | Each merged piece passes in AF and in the 3D game, which then consumes it from AF |
| **M10 Website** (final phase) | The AF site: a store selling extensions individually and as an all-access pass, documentation, the playable demo gallery, and everything else a framework site needs | Specified at M10.0 |

**Revised order and scope (Owner, 2026-10-16, [PRODUCT spec](./2026-10-16-product-core-and-plus-design.md) PD-3 to PD-5):**
- The free foundation comes first: core seams, localization (PRODUCT.L, taken out of M5), the core parts of M4 and M5, and a frame-budget probe.
- Then the Plus extensions on the FloorFifty path (`net`, `server`, the 2D part of `post-retro`, `feel`, `audio-stream`).
- Then the Party Racer starter, which is the FloorFifty acceptance case.
- M4, M5 and M7 no longer wait on M3.
- CPU players, progression, the replay viewer, the beat clock, parallax, a particles package, a leaderboards extension, extra telemetry and a tutorial system are cut to examples or hooks.

## 12. Decisions in force

The Owner asked on 2026-10-11 to proceed in parallel, so each decision below runs on its recommended default from that date. The Owner can override any of them; an override is recorded here and in [03 Continuation](../../03-continuation-prompt.md).

| ID | Decision | Default in force (2026-10-11) | Affects |
|---|---|---|---|
| D-1 | May AF use the `@pixi/3d` 0.1.0 beta (invited program, MIT licensed, vendored tarball)? | **Provisional (coordinator, 2026-10-11, after audit):** yes, but `render-pixi3d` stays an unpublished, experimental workspace package and stays out of public game builds until the beta's terms allow public deployment. The Last Light's README says to keep builds inside the beta with no public deployment, and a published package cannot depend on a `file:` tarball. Core never depends on it. Its `pixi.js ^8.22.0` peer also moves FloorFifty off 8.21 when it adopts AF. The Owner confirms or overrides. | M3, GAME-3D |
| D-2 | Adoption scope for the reference games in M8, and the 3D game's concept | A slice each (FloorFifty: host, loading and layout; The Last Light: puzzle and sectors), not full migration. The 3D game's concept is chosen at GAME-3D.0. Decided 2026-10-17 as this default by the [M8 spec](./2026-10-17-m8-cli-adoption-design.md) M8-D1; FloorFifty's whole loop is proven by PRODUCT.8. | M8, GAME-3D |
| D-3 | Lint and format | Keep Biome. Revisit only if aligning with Ruken's ESLint + Prettier becomes necessary; the sim's `useExponentiationOperator` rule must survive either way | M1.1 |
| D-4 | Standalone hosting | Reuse FloorFifty's proven pattern: a Caddy static host with a build per URL (`/builds/<buildId>/`) and the live release at `/`. `ship` keeps the provider behind a deploy step, so a later move to Cloudflare Pages/R2 does not change games. | M1.2 |
| D-5 | GPU runner | Reuse the Owner's existing runners (the WSL Linux runner and the Windows GPU runner). Until they are wired to AF, every CI job, including parity, is run locally, and that local run is the green gate (Owner, 2026-10-11; hosted Actions jobs are not getting runners). No new Linux GPU box. | M1.1 |
| D-7 | Licensing and distribution of paid extensions (Owner, 2026-10-11: Tailwind-style; core free, extensions paid individually or all-access) | Open until M10.0 for pricing, the store and license enforcement. **Refined 2026-10-16 (PRODUCT spec PD-1):** Automata Plus is every extension plus copy-in kits and starters; core is MIT on public npm; Plus lives in the private `mcthaydt/automata-plus` repo and registry from PRODUCT.5, before the first public publish. | M10, PRODUCT |
| D-8 | How AF publishes packages that depend on unpublished Ruken packages (`host` on `@ruken/sdk` and `@ruken/sdk-host`; `content` and `ship` on `@ruken/manifest`; `ship` spawning `@ruken/cli`; `ui` and `testing` on Ruken types) | Bundle the vendored Ruken code into that package's `dist/` at build time, as Ruken's own CLI bundles its workspace packages, inline the Ruken types into its `.d.ts`, keep the tarballs as dev dependencies and declare the bundled code's own runtime dependencies, with the Ruken commit recorded in the package (widened in the [M2 milestone spec](./2026-10-11-m2-deterministic-core-design.md) §4; cases in M2.4 §3.4); switch to the published `@ruken/*` versions once Ruken publishes them. AF does not republish Ruken packages under its own scope (Ruken owns them, ADR 0004). Decided before M2.4. | M2.4 |
| D-6 | How AF gets Ruken's unpublished packages | Vendor `@ruken/sdk`, `@ruken/sdk-host`, `@ruken/manifest` and `@ruken/cli` (built) tarballs in `vendor/ruken/` at a recorded RukenApp commit (`b30d31b`), with their SHA-256 and rebuild steps, as FloorFifty does. The integration owner re-vendors (after Ruken's F1 freeze and on request); lanes consume. | M1.2, M1.4 |

## 13. Risks

| Risk | Mitigation |
|---|---|
| `@pixi/3d` beta changes or stalls, or its terms never allow public deployment | 3D lives in one unpublished extension behind the renderer-agnostic `RenderDelta`; spike S7 records what AF relies on and the beta's deployment terms; 2D core is unaffected |
| Ruken packages are unpublished and still moving before F1 (planned 2026-10-16) | Vendor tarballs with recorded Ruken commits; run Ruken's fake-host and contract tests in AF CI; re-vendor after F1 and after each additive change |
| Effect adds bundle size and startup cost on phones | Effect stays (Owner direction); spike S8 in M1.1 sets the bundle and boot-time budgets on the S20 and iPhone 13 profiles and the mitigations if they are exceeded; the frame loop never allocates Effects per frame |
| Rapier's deterministic-compat build is proven only by spike S2, not by either reference game | Physics is an extension (`physics`), not core; M2.1 proves four-engine parity and measures cost before any extension or game depends on it |
| Extracting from two live games while they keep changing | Extraction copies from a recorded source commit; each extracted module brings the source game's tests with it; adoption is a separate milestone |
| Early CI/CD before the runtime is complete | M1 targets a blank game on purpose, the same "something deployable early" rule the old spec used, now ending at Ruken rather than at a dev host |
