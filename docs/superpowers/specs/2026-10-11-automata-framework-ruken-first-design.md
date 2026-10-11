# AutomataFramework: Ruken-first architecture (master spec, revision 2)

- **Date:** 2026-10-11
- **Status:** Draft for Owner review. Supersedes the [2026-10-01 master spec](./2026-10-01-automata-framework-overview-design.md) wherever the two disagree; sections of the older spec not replaced here (laws, state ownership, determinism rules) still apply.
- **Owner direction, 2026-10-11:** "AF needs to be Ruken first, and extract and improve things from both the pixi project and FloorFifty. We'll use PixiJS for 2D and 3D. Modify the work already done, then update documentation for everything after. We should have core things taken from both, and everything else can be modular extensions." Follow-ups the same day: "use Effect and the Koota ECS" and "handle CI/CD, deployment, UI (especially on mobile) and the content pipeline early, combining insights from Ruken, FloorFifty and the pixi project."
- **Companion documents:** [extraction map](./2026-10-11-core-and-extensions-extraction-map.md) (source file → AF package), [ADR 0002 Pixi for 2D and 3D](../../adr/0002-pixi-for-2d-and-3d.md), [ADR 0003 Effect outside the sim](../../adr/0003-effect-outside-the-sim.md), [ADR 0004 Ruken-first host](../../adr/0004-ruken-first-host.md).

---

## 1. What changed and why

| Area | 2026-10-01 design | This revision | Reason |
|---|---|---|---|
| Primary host | Ruken, standalone web and Tauri as equal adapters behind `Hosting` | **Ruken is the primary target.** Ruken's own packages (`@ruken/sdk`, `@ruken/manifest`, `@ruken/sdk-host` fake host, Ruken's build validation) are the foundation of the host, packaging and test layers. Standalone web stays as a second adapter. Tauri becomes an extension. | Owner direction. Ruken now has working code for all of this (Ruken M1 was Owner-accepted on 2026-10-09 with FloorFifty hosted through it), so AF should consume it rather than re-derive it from the P01 spec. |
| Renderers | Three.js (`render-three`) and PixiJS (`render-pixi`) | **PixiJS only**: Pixi 8 for 2D in core, `@pixi/3d` for 3D as an extension | Owner direction. FloorFifty (2D) and The Last Light (2.5D/3D) both already run on Pixi, so one renderer covers both reference games and halves the post-process and visual-golden work. See ADR 0002. |
| Effect | Skipped | **Adopted outside the sim**: runtime services, boot, host adapters, content compiler, CLI, ship tooling and pipelines | Owner direction. The sim stays plain synchronous TypeScript for determinism and speed. See ADR 0003. |
| ECS | Koota (ADR 0001) | **Unchanged: Koota**, behind the sim facade | Owner direction confirms ADR 0001. The Last Light's Miniplex code ports onto the facade. |
| Reuse from games | Deferred to "Part C", after a future 3D game | **Now.** Core packages are built from proven code in FloorFifty, The Last Light and Ruken. Everything else ships as opt-in extensions. | Owner direction. Both games already demonstrate the behavior the old plan was waiting for. |
| Delivery order | Complete every A/B spec, then build A1b, A1c, A2 … A9, then B, then a game, then C | **Milestones, Ruken style.** M1 ships a blank game to Ruken end to end, with CI/CD, deployment, mobile UI and the content compiler in it. Each milestone's spec is written and reviewed at the start of that milestone. | Owner direction to handle CI/CD, deployment, mobile UI and content early. Ruken freezes each contract at the start of the milestone that uses it; AF does the same. |
| Docs | `001`–`004` numbered docs, phases A0–A9, B1–B2, C | `00`–`04` numbered docs matching Ruken's, milestones `M0`–`M8` | Ruken first applies to how the work is run too. Phase IDs from the old plan are mapped in [01 Decomposition](../../01-decomposition.md) §2. |

What is kept, unchanged: the seven laws (old spec §2), state ownership (§5), the A0 spike verdicts except S3, ADR 0001, the A0+A1 sim design (§4 of that spec and its §11–§12 refinements) and all merged A1a code in `packages/sim` and `tooling/`.

## 2. Laws

The seven laws stand. Law 7 is sharpened:

7. **The host is a port, and Ruken is the reference host.** All host access goes through the `Hosting` service. Its shape follows Ruken's P01 catalog, capabilities and limits as implemented in Ruken's `packages/protocol` and `packages/sdk`, not an AF-invented abstraction. Other adapters (standalone web, Tauri) implement the same service and must behave the same where Ruken defines behavior (for example save limits counted in UTF-8 key plus value bytes). A capability Ruken denies or that is unavailable fails visibly; it never silently falls back to device storage.

## 3. Stack

| Concern | Choice | Notes |
|---|---|---|
| Simulation | Koota 0.6.6 behind the `automata-sim` facade; Rapier `-deterministic-compat` 0.21 (2D and 3D); xoshiro128** RNG; `automata-sim/math` | As built in A1a. No Effect, no DOM, no wall clock (boundary checker). |
| Effects, services and errors | **Effect** (`effect`, `@effect/platform`, `@effect/platform-browser`, `@effect/platform-node`) | Outside the sim only. Exact versions are pinned in M1.1 and recorded in `docs/versions.md`. |
| Schemas | **Zod 4** (`4.6.5`, the version Ruken pins) | Shared with Ruken's protocol and manifest packages and with the sim's command payloads. Effect Schema is not adopted; one schema language. |
| Rendering | **PixiJS 8.22+** (2D, core); **`@pixi/3d` 0.1.0-beta.2** (3D, extension) | WebGPU preferred, WebGL2 fallback mandatory (Ruken's manifest renderers are `webgl2`, `webgl`, `canvas2d`, `wasm-webgl2`). Filters ship as GLSL + WGSL pairs (S4). |
| UI | Svelte 5, Tailwind 4, GSAP 3 | As in FloorFifty and Ruken's `packages/ui`. Menus and HUD stay in the DOM. |
| App and UI state | Nano Stores | Mirrors of sim state are read-only (old spec §5). |
| Presentation facts | Typed synchronous FIFO bus (FloorFifty `presentation-event-bus.ts`), exposed as an Effect service | Replaces raw mitt in core. mitt is no longer a core dependency. |
| Host | `@ruken/sdk`; `@ruken/manifest`; `@ruken/sdk-host` (fake host for tests) | Vendored as tarballs (FloorFifty's `vendor/ruken/` pattern) until Ruken publishes them; Ruken gates publication on its `NPM_PUBLISH_READY` variable and the M0.3 npm scope. |
| Tooling | Node 24, pnpm 10, Turborepo, TypeScript, Vitest 5, Playwright 1.63, Changesets, lefthook | Versions are aligned with Ruken's `docs/versions.md` pins in M1.1. Lint and format stay on Biome for now (open decision D-3 in §12). |

## 4. Package map: core and extensions

Every package publishes as `@mcthaydt/automata-<name>` on GitHub Packages. **Core** packages are what any Ruken game needs and are installed by `create-game`. **Extensions** are opt-in packages registered through `defineExtension` (§5); a game that does not install one ships none of its code. The [extraction map](./2026-10-11-core-and-extensions-extraction-map.md) lists the source files each package starts from.

### 4.1 Core

| Package | Owns | Built from |
|---|---|---|
| `sim` | Deterministic simulation: Koota facade, fixed step, RNG substreams, commands, scheduler, resources, snapshot/restore, render delta, `math`; physics as `./physics-2d` and `./physics-3d` subpaths | AF A1a (merged). The Last Light's record/replay and `worldHash` inform the replay harness. |
| `content` | TOML → Zod → canonical JSON + hash; typed accessors; Vite plugin; generators for the `ruken.toml` content fields, locale keys, the telemetry catalog and the loading preload list | AF A0+A1 §5 design; FloorFifty `content/*.toml`, `flow.toml`, `tuning.toml` and its invariants/tunables split; Ruken's manifest `content`, `analytics` and `loading.preload` sections |
| `host` | The `Hosting` Effect service. Adapters: **`ruken`** (wraps `@ruken/sdk`), **`web`** (standalone; same limits). Test layer from `@ruken/sdk-host` fake host. | FloorFifty `apps/client/src/ruken/{host,current,exit,analytics}.ts` and its 13 Ruken test files; AF S6 contract tests and Ruken's answers |
| `runtime` | Boot and loading, app loop (fixed sim step, variable render, interpolation), Time (pause modes, lifecycle and menu pause), Flow (screens from `flow.toml`, one transition at a time), presentation bus, settings store over `Hosting` storage, Input (keyboard, pointer, touch, gamepad), Save (Ruken saves), Audio core (buses, unlock, `audio.focus`/`audio.master`), Localization core | FloorFifty `main.ts` boot, `load-meter.ts`, `fetch-progress.ts`, `screen-manager.ts`, `screens/screen.ts`, `presentation/*`, `common/settings.ts`, `gamepad-source.ts`, `swipe-tracker.ts`, `audio/*` engine; The Last Light `clock.ts`, `session.ts`, `input.ts`, `audio/mixer.ts` |
| `render-pixi` | Pixi 8 2D adapter: renderer init with WebGPU → WebGL2 retry and `?renderer=` override, `RenderDelta` consumer with interpolation and `resync`, pixel framebuffer option, letterbox, filter-program helpers (GLSL + WGSL pairs, pixel position from the vertex stage) | FloorFifty `letterbox.ts` and render setup; The Last Light `stage.ts` init (lines 355–373), `filter-programs.ts` |
| `ui` | Mobile-first Svelte primitives: geometry owner (form factor, height tier, visual-viewport tracking), ScreenFrame, ActionBar, CornerControls, Split, ScrollList, OptionGroup, PagerDots, Dialog, LoaderOverlay, ErrorPanel with Try again, focus navigation, cursor policy, back gesture, touch-control surface, theme tokens | FloorFifty `ui/layout/*`, `ui/{form-factor,height-tier,viewport-tracking.svelte}.ts`, `ui/focus-nav.ts`, `ui/cursor-policy.ts`, loader/error components; Ruken `packages/ui` (Button, IconButton, Dialog, Toast, theme tests); The Last Light `ui/kit.ts` tokens and `ui/access.ts` |
| `testing` | Sim and replay goldens; renderer-free component/screen fixtures; layout assertions (hit testing, target size, clipping, overlap, reachability); Playwright config helpers (per-checkout ports, reuse server, viewport projects); fake-host journeys; evidence capture and promotion | AF A0+A1 §6; FloorFifty `tests/e2e/support/layout.ts`, `playwright.config.ts`, `tools/e2e-serve.ts`, `tools/promote-evidence`; Ruken `e2e/sandbox`, `e2e/golden`, `@ruken/sdk-host` testing |
| `ship` | Reusable GitHub workflows (`game-ci.yml`, `game-release.yml`), focused remote runs, Ruken packaging (writes `ruken.toml` from config and content, preload list, zip) checked with Ruken's own manifest parser and build validation rules, publish to Ruken (through `ruken publish`), standalone dev and release hosting | FloorFifty `deploy/tools/ruken-pack.ts`, `tools/test-remote`, `release.yml`, `release-builds.yml`, `docs/release.md`; Ruken `tooling/ruken-cli/src/{pack,publish}.ts`, `packages/validation`, `docs/self-hosted-runner.md`, `tooling/versions/pins.ts` |
| `cli` | `create-game`, `update-game`, `validate`, `doctor`, `pack`, `publish`, `dev` (runs the game under the fake Ruken host) | New, on Effect; wraps `ship` and `content` |
| `check-boundaries`, `check-style` (tooling) | As built in A1a, with a fixture pinning that `packages/sim` may not import `effect` | AF A1a |

### 4.2 Extensions

| Extension | What it adds | Built from |
|---|---|---|
| `render-pixi3d` | `@pixi/3d` adapter: `View3D` setup, fixed-zone and orbit camera rigs, `Sprite3D` billboards (cylindrical/spherical), lit sprites from normal maps, single-mesh GLB and `.pack` loading, fog and particle mist, baked vertex lighting and occlusion | The Last Light `render/{stage,sprite-light,indirect-light,occlusion,fog,glb,props,showcase}.ts` |
| `post-retro` | Post chain as data: Bayer dither, LCD snap and panel, palette LUT, grade, bloom, grain, vignette (2D and 3D) | The Last Light `retro-filter.ts`, `bloom-filter.ts`, `lcd-panel.ts`, `palette.ts`; S4 dither |
| `audio-synth` | Procedural cues and beds as data, game-event → cue mapping, ducking, listener panning, offline render, audio checks (true peak, clicks, loudness) | The Last Light `audio/*` and its make-audio pipeline |
| `audio-stream` | Streamed music with decode-behind playback, song preloading, iPad unlock diagnostics | FloorFifty `managers/audio/{song-bridge,menu-stream,song-preloader,deck,diagnostics}.ts`, `docs/ipad-audio-check.md` |
| `feel` | Juice/effects as data (shake, hit-stop, flashes) with a coverage board and reduce-flashing support | The Last Light `feel/*`; FloorFifty `juice.toml` |
| `sectors` | Build-engine-style sector maps: polygons with floor/ceiling heights, portals, wall detail; extruded meshes; Rapier colliders; light occlusion; cutaways; rule-based dressing | The Last Light `game/{sectors,sector-format,rooms,cutaway}.ts`, `render/{sector-mesh,dressing}.ts`. This is the starting point for the environment pipeline (old B2). |
| `nav` | Authored navigation graphs and click-to-walk routing | The Last Light `game/nav.ts` |
| `puzzle` | Verb/item/lock puzzle interpreter, solver, softlock search and generated route tests | The Last Light `game/{puzzle,puzzle-solver}.ts`, `contracts/puzzle.ts` |
| `systems` | NPC state machines, world rules, tunables, scenario probes and bot playtests | The Last Light `game/{systems,agents,probes,bots,pursuit,rules}.ts` |
| `narrative` | Dialogue-graph runtime with stance and facts, line records, lints and beat coverage | The Last Light `narrative/*` |
| `cutscenes` | In-engine cutscene scripts, builder, lint and preview | The Last Light `game/{cutscenes,cutscene-builder,cutscene-lint}.ts` |
| `net`, `server` | Opt-in multiplayer: `NetworkPort`, Colyseus client, room-mirroring store, server room running the same sim, input queue and tick scheduler, prediction and reconciliation | FloorFifty `managers/network/*`, `ui/store/room-store.svelte.ts`, `apps/server/src/rooms/{input-queue,tick-scheduler,room-driver}.ts` |
| `store` | Ruken store and season pass (SKUs, seasons, tiers, grant-once ledger in Save) | Old A9 design. Waits on Ruken's `[store]` manifest section, which Ruken has not built yet. |
| `debug` | Debug panels and overlay registry, stripped from release builds | Old A6 design; The Last Light `?debug=1`, `feel/board.ts`, `audio/board.ts` |
| `telemetry-extra` | Umami and Grafana Faro adapters for standalone builds | Old A6 design. The Ruken adapter and the `track()` port stay in core `host`/`runtime`. |
| `host-tauri` | Tauri desktop adapter (owns Quit) | Old A2/A3 design |
| `i18n-extra` | Extra fonts (CJK, Korean, dyslexia), long-text layout fixtures | FloorFifty `tools/i18n`, `docs/i18n/` |
| `pipelines` (dev tooling, never in a game bundle) | The asset/content pipeline platform: `pipe` router, MCP server, guard hook, budgets, gates, audit log, and the character, props, reference, scene/blockout and vision pipelines | The Last Light `scripts/{pipe.mjs,pipeline,mcp,guard}`, `pipeline.config.json`, `.claude/skills/*`. Character pipeline replaces the old B1 plan's starting point. |

**Placement rule.** A capability is core when Ruken requires it of every game (startup gating, lifecycle, layout under `display.metrics`, all four input paths, saves, audio focus, packaging, CSP, offline, localization of `en`, analytics naming) or when both reference games need it. Anything else is an extension. Moving an extension into core later is an explicit, reviewed decision.

## 5. Extension contract

A single registration function ties the layers together. Exact types are specified in the M1 spec; the shape is:

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

## 6. Effect boundaries

See ADR 0003 for the decision record.

- **Inside `packages/sim`: no Effect.** The step function, systems, snapshot and hash stay plain synchronous code. `check-boundaries` already rejects `effect` and `@effect/*` through its import allowlist; the `import-effect.ts` fixture pins that.
- **Runtime and host:** each manager is an Effect service (`Context.Tag` + `Layer`): `Hosting`, `Storage`, `Clock`, `Renderer`, `Flow`, `Time`, `Input`, `Audio`, `Save`, `Settings`, `Telemetry`, `PresentationBus`. Boot is one Effect program (§7). Failures are typed errors (for example `HostHandshakeFailed`, `ContentHashMismatch`, `LoadStalled`, `CapabilityDenied`), so every failure path has a named UI state.
- **Lifetimes:** `Scope` and finalizers replace FloorFifty's `DisposeBag`; a screen's resources are released on exit by its scope, and a game restart (Ruken requirement: return to the launcher without a page refresh) closes the whole runtime scope.
- **Time:** Effect's `Clock` is the injected clock (Ruken rule: never call `Date.now()` in domain code). Handshake retries, load stalls, the 1,500 ms exit grace and save flush timeouts are tested with `TestClock`.
- **The frame loop** is plain code driven by `requestAnimationFrame` inside a runtime fiber; it does not allocate an Effect per frame. Measured in spike S8.
- **Build-time code** (content compiler, CLI, `ship`, `pipelines`) uses `@effect/platform-node` for files, processes and HTTP, with typed errors that become `file:line:col` reports.

## 7. Boot and loading (core, Ruken first)

Ordered steps, each with a named failure state. This combines the old spec §6 boot, Ruken's handshake rules and FloorFifty's M2.1g loading rules ("never a blank screen; no screen before its fonts, art and music; slow keeps going; a stall fails with Try again").

1. **First paint before code.** `index.html` paints the loader shell with CSS only (no inline script, Ruken CSP); a slow-network line appears by CSS delay.
2. **Host.** `Hosting` initializes: `Ruken.init` (hello retry every 250 ms, 10 s give-up, source and origin checks) when framed; the web adapter otherwise. A failed handshake inside a Ruken frame is an error state, not a silent switch to standalone.
3. **Storage and settings.** Saves snapshot from `welcome`; settings load through `Hosting` storage.
4. **Content.** Compiled content loads; its hash is checked against the build's.
5. **Assets.** The screen's declared fonts, art and audio load with byte progress (`fetch-progress`); the preload list matches the generated `[loading] preload` in `ruken.toml`. Progress never sits at 0% before the first byte arrives. A load with no progress for 30 s is a stall and shows Try again.
6. **Renderer.** Pixi initializes, WebGPU first, retrying WebGL2 once.
7. **Ready.** The splash shows; gameplay renders **only after `session.ready`**. `menu.open` before ready answers `NOT_READY`.

## 8. Mobile-first UI (core, early)

UI is designed for a phone first and verified at phone sizes before desktop. Layout depends on container size and usable height; input mode is independent of layout.

- **One geometry owner** in `ui`: layout viewport, usable region (after safe area and Ruken's `hostReserved` edge rectangle) and visual-viewport occlusion. Form factor uses FloorFifty's thresholds (600 px portrait, 500 px landscape) and height tiers (short below 600 px, compact below 340 px) as starting values; opening a keyboard never reclassifies the form factor.
- **Reference sizes** for every layout contract: small portrait, compact landscape including 780×270, tablet portrait and landscape, desktop, each breakpoint boundary, with the browser bar and keyboard open where relevant.
- **Targets:** 44 px minimum, 48 px for primary actions. Decoration shrinks before controls do. Declared scroll regions only.
- **`display.metrics.scale`** (4/3 on Ruken's TV mode) is a hint to enlarge HUD and text, never CSS zoom.
- **Testing:** components and screens mount with production styles and fixture stores, without a renderer or server. DOM tests prove interactions; a real browser proves geometry with FloorFifty's layout assertions; composed journeys under the fake Ruken host prove integration; phone and tablet journeys run on the GPU runner nightly and on request; Owner visual acceptance stays a separate gate.

## 9. Content pipeline (core compiler early, asset pipelines as extensions)

- **M1:** the `content` compiler and Vite plugin as specified in the A0+A1 spec §5, plus generators for the Ruken manifest fields (`content.languages`, `analytics.custom_events`, `loading.preload`), locale keys and the flow graph. Errors are `file:line:col`. Content hash feeds the snapshot header.
- **M3:** the `pipelines` extension: The Last Light's router, MCP server, budgets, gates, guard and audit log, made game-agnostic (its look bible, prompts and gates per game become content). Character (old B1) and environment (old B2, now built on `sectors`) pipelines run on it.
- Generated files are never hand-edited (guard hook); human gates record decisions only (R-80 style: people decide, checks record facts).

## 10. CI/CD and deployment (early)

- **Reusable workflows** in `ship`: a game's `ci.yml` is about five lines calling `game-ci.yml@v<major>`.
- **Lanes of feedback:** unit, typecheck, boundaries, style, content compile and renderer-free UI tests on GitHub-hosted Ubuntu on every push; cross-engine parity on hosted Ubuntu; browser journeys and visual checks on the GPU runner nightly and on request through a focused `test:remote <spec> --project=<viewport>` (FloorFifty pattern); Ruken gates (handshake, nothing rendered before ready at 5 s, CSP scan, zip limits, manifest validity) on every release build.
- **Runners:** GitHub-hosted first. The self-hosted runners the Owner already operates for Ruken and FloorFifty (WSL Linux runner, Windows GPU runner) are reused before any new machine; the Linux GPU box from the old plan becomes optional, decided in the M1 spec from measured queue times.
- **Packaging:** `ruken.toml` is generated, never hand-written, then checked with `@ruken/manifest`'s parser and Ruken's build validation rules (archive, size, file types, preload list) before upload. Zip: at most 200 MB (warn above 50 MB), 4,000 files, relative paths.
- **Deployment targets:** (1) Ruken: `ruken publish` of the same release tag, starting with Ruken's local stack and TEST environment; (2) standalone: a dev host with a build per branch and per release (FloorFifty's `/builds/<buildId>/` model) and a release host. The standalone provider (Cloudflare Pages/R2 in the old plan, or the existing Caddy VM pattern) is decided in the M1 spec.
- **Identity and evidence:** every result names its build ID, commit, content hash, runner and browser. First-attempt failures are preserved. Evidence screenshots go to an ignored `evidence/` folder and are promoted to committed baselines only after Owner approval.
- **Versions:** a `docs/versions.md` page and a pins test, as in Ruken, keep Node, pnpm, TypeScript, Vitest, Playwright and Zod aligned with Ruken.

## 11. Milestones

Each milestone gets a spec at its start, reviewed by the Owner, then just-in-time TDD plans per task. Order and tasks live in [02 Master delivery plan](../../02-master-delivery-plan.md).

| Milestone | Outcome | Exit (abridged) |
|---|---|---|
| **M0 Foundation** | Spikes S1–S6, ADR 0001, sim core (A1a) | Done; merged PRs #1 and #2 |
| **M1 Blank game on Ruken** | Toolchain aligned with Ruken; Effect runtime skeleton; `content` compiler; `host` (Ruken + web, fake-host tests); boot and loading; Flow/Time/presentation bus; `render-pixi` 2D; mobile-first `ui` primitives; reusable CI; Ruken pack, validate and publish; standalone dev host; `examples/blank-game`; minimal `create-game` | `create-game x`, push: CI green, a Ruken zip that passes Ruken's validation, published to Ruken's local stack and the dev host, playable on a phone; nothing renders before ready; layout contracts pass at every reference size including 780×270 |
| **M2 Deterministic core complete** | Physics plugins, sim and replay goldens, 200-seed property test, first-divergent-tick diff, `0.0.x` prerelease publishing | The A0+A1 spec's A1 exit criteria 2–8 |
| **M3 3D and the pipeline platform** | Spike S7 (`@pixi/3d`); `render-pixi3d`; `post-retro`; `pipelines` platform; character pipeline | A 3D example scene renders on WebGPU and WebGL2 under Ruken's CSP at ≥30 FPS on the phone profiles; one character goes through the pipeline with its gates |
| **M4 Input and display complete** | Gamepad, touch overlay and gestures, rebinding, focus navigation across screens, letterbox, safe area, `hostReserved`, scale hint, graphics settings, color-blind UI | Input × form-factor E2E matrix passes under the fake Ruken host |
| **M5 Saves, audio, localization** | Ruken saves with versions and migrations, sync status, exit flush; audio buses and focus; `audio-synth` and `audio-stream`; six languages | Save N loads on N+1; save, exit and resume works across devices on Ruken; every UI string localized and laid out at long-text sizes |
| **M6 Gameplay extensions** | `sectors`, `nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `feel`, `debug`, `telemetry-extra`; environment pipeline on `sectors` | Each extension's fixture game passes; The Last Light's route tests pass against the extracted `puzzle` |
| **M7 Online and store** | `net` and `server`; `store` once Ruken's `[store]` manifest section exists; `host-tauri` | Two-client replay golden; single-player bundles contain no netcode; entitlement replays reproduce |
| **M8 CLI 1.0 and adoption** | Full CLI, codemods, docs, 1.0; FloorFifty and The Last Light each run a slice on AF packages | `update-game` migrates the example from 0.x to 1.0; each reference game's adopted slice passes its own existing tests |

## 12. Open decisions for the Owner

| ID | Decision | Recommendation | Blocks |
|---|---|---|---|
| D-1 | `@pixi/3d` is a 0.1.0 beta from an invited program, vendored as a tarball (MIT licensed). May AF publish an extension that depends on it, and on which version? | Yes, as the `render-pixi3d` extension only, pinned to the tarball's version and re-vendored per beta; core never depends on it | M3 |
| D-2 | Adoption scope for the reference games in M8 | A slice each (FloorFifty: host + loading + layout; The Last Light: puzzle + sectors), not full migration | M8 |
| D-3 | Lint and format: keep Biome or move to Ruken's ESLint + Prettier | Keep Biome until M1.1 measures the cost of switching; the sim's `useExponentiationOperator` rule must survive either way | M1.1 |
| D-4 | Standalone hosting provider | Decide in the M1 spec between Cloudflare Pages/R2 and FloorFifty's existing Caddy VM pattern | M1 |
| D-5 | Whether a dedicated Linux GPU runner is still needed | Reuse the existing runners in M1 and decide from measured queue times | M1 |

## 13. Risks

| Risk | Mitigation |
|---|---|
| `@pixi/3d` beta changes or stalls | 3D lives in one extension behind the renderer-agnostic `RenderDelta`; spike S7 records what AF relies on; 2D core is unaffected |
| Ruken packages are unpublished and still moving before F1 (planned 2026-10-16) | Vendor tarballs with recorded Ruken commits; run Ruken's fake-host and contract tests in AF CI; re-vendor after F1 and after each additive change |
| Effect adds bundle size and startup cost on phones | Spike S8 measures boot time and bundle size on the S20 and iPhone 13 profiles before M1's runtime plan; the frame loop never allocates Effects per frame |
| Extracting from two live games while they keep changing | Extraction copies from a recorded source commit; each extracted module brings the source game's tests with it; adoption is a separate milestone |
| Early CI/CD before the runtime is complete | M1 targets a blank game on purpose, the same "something deployable early" rule the old spec used, now ending at Ruken rather than at a dev host |
