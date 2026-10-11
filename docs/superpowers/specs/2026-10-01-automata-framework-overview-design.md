# AutomataFramework: Overview & Decomposition (Master Spec)

- **Date:** 2026-10-01
- **Status:** Approved 2026-10-01
- **Scope:** The whole framework at the architecture level. Each phase listed in §12 gets its own spec, then its own plan, then implementation.

> **Superseded in part, 2026-10-11.** The [Ruken-first master spec](./2026-10-11-automata-framework-ruken-first-design.md) replaces this document's host model, renderer choice (Three.js removed; PixiJS for 2D and 3D), Effect decision (now adopted outside the sim), package map, distribution of extensions, delivery order (§12, Parts A/B/C) and prior-art status (§13). The laws (§2, law 7 refined), state ownership (§5), data flow (§6, boot refined), Ruken integration requirements (§7), hosting notes (§9), telemetry (§10) and testing layers (§11) still apply where the new spec does not replace them. Read [00 Overview](../../00-overview.md) first.
>
> **Owner direction, 2026-10-05 (historical):** reuse FloorFifty's UI learnings through components designed for multiple resolutions and orientations, and dramatically improve test speed and failure diagnosis.

---

## 1. Purpose and success criteria

snek_attak makes games for **Ruken**, which is pitched as an "Everyday Console". FloorFifty (`snek_attak/Games/FloorFifty`) was the first, and most of its effort went into plumbing that had nothing to do with the game itself:
- a 277-line CI file
- a fragile Windows GPU runner
- a blue/green deploy script
- a 1,483-line audio manager
- letterbox and mobile gesture handling
- a settings system

FloorFifty also never integrated Ruken. *(True on 2026-10-01; FloorFifty has since been hosted on Ruken through `@ruken/sdk`, accepted in Ruken M1 on 2026-10-09.)*

AutomataFramework turns that plumbing into reusable, versioned packages so that a game is mostly **content plus game logic**.

**Success means all of the following:**
1. The day `create-game <name>` runs, the result is a game that boots, plays, and deploys **both inside Ruken and as a standalone site**.
2. **CI enforces Ruken's hard gates automatically** (see §7). A game cannot accidentally ship something Ruken would reject.
3. A new game needs **no changes to CI, deploy, or packaging**. Its CI file is a few lines that call the framework's reusable workflows.
4. Framework fixes reach every game through a version bump (`update-game`), not by copying code between repos.

## 2. Laws

1. Only the simulation changes gameplay state.
2. Only the authoritative server decides networked truth.
3. Each piece of state has exactly one owner.
4. Presentation may observe the simulation but never control it indirectly.
5. The simulation has no external I/O and no dependency on wall-clock time.
6. The same seed, content, and ordered inputs must produce the same result.
7. **The host is a port.** Ruken, standalone web, and Tauri all sit behind one `Hosting` interface. Code outside the host adapters never knows which host it is running in.

> Simulation produces truth. Rendering displays truth. UI observes truth. Networking transports truth. Persistence stores truth.

Patterns are drawn from *Game Programming Patterns* (Game Loop, Update Method, Component, Command, Event Queue, Service Locator, Double Buffer, Object Pool) and Refactoring.Guru (Adapter, Facade, Strategy, Observer, State). Use a pattern where it removes real coupling, not to be decorative.

## 3. Distribution model: versioned packages plus thin games

```
automata-framework/                (this repo)
  packages/@automata/*             versioned, published packages
  tooling/                         CLI source
  examples/blank-game/             a reference game that consumes the packages, as games would
  infra/                           reusable GH workflows, Docker images, OpenTofu modules
  content/                         framework-default content (UI strings, default settings)

<game>/                            (a separate repo per game)
  automata.config.ts
  content/**/*.toml
  src/game/                        game components, systems, scenes
  src/ui/                          screen overrides / slot fills
  .github/workflows/ci.yml         ~5 lines: `uses: <org>/automata-framework/.github/workflows/game-ci.yml@v1`
```

**`automata.config.ts`** declares:
- the game ID and title
- the renderer (`three` or `pixi`)
- whether networking is on (`network: true|false`)
- locales, orientation, and input devices
- the Ruken game ID
- deploy targets
- the telemetry catalog path

Everything Ruken needs in `ruken.toml` is **generated** from this file and from the content files. Nobody hand-writes it.

**Extension works by registration, never by editing framework files.** Games use `defineComponent` / `defineSystem` / `defineScene` / `defineScreen` / `defineContentSchema`, plus named UI slots. For an emergency fix, a game may use `pnpm patch` and must upstream the fix afterwards.

**CLI (`@automata/cli`):**
- `create-game`: scaffold a repo with config, CI, and an example scene.
- `update-game`: bump `@automata/*` and run the codemods that ship with each breaking release.
- `lock-game`: pin exact versions plus the content hash, for a reproducible release or Ruken submission.
- `deploy-game`, `validate` (content and Ruken gates), `doctor` (environment check).

**Versioning** uses Changesets with strict semver. Breaking changes must include a codemod. While a game and the framework are being developed together, the game links the framework packages from the local workspace (or uses `examples/`).

## 4. Package map

> **Naming:** `@automata/<name>` is shorthand in this document. The published packages are `@mcthaydt/automata-<name>` on GitHub Packages, from the repo `mcthaydt/automata-framework` (decided in the A0+A1 spec).

| Package | Owns | Depends on |
|---|---|---|
| `@automata/sim` | Pure deterministic simulation: Koota world, Rapier (deterministic builds, 2D and 3D), fixed-step clock, seeded RNG, command queue, system scheduler, world resources (flags, quests, inventory, in-game clock), snapshot/restore, render snapshot. **No DOM, `Date`, `Math.random`, `performance`, or I/O**, enforced by a boundary checker. | Koota, Rapier |
| `@automata/content` | TOML (smol-toml) → Zod 4 → canonical JSON plus content hash. Merges schemas registered by the game. Generates the telemetry event catalog, `ruken.toml`, and locale key lists. Runs at build time; the runtime only reads the compiled JSON. | smol-toml, zod |
| `@automata/runtime` | Client shell: boot sequence and app loop (fixed sim step plus variable render with interpolation). Managers: **Time** (pause modes, timescale, fixed vs. variable step), **Input** (devices, profiles, rebinding, cursor hiding), **Scene/Flow** (graph defined in `flow.toml`), **Save** (3 slots, autosave, versioning and migrations), **Audio** (Web Audio buses), **Display** (viewport, letterbox, safe area, `hostReserved`, orientation, UI scale, graphics settings), **Localization** (Paraglide), **Debug** (imgui-js, stripped from release builds). | sim, content, host, Nano Stores, mitt |
| `@automata/render-three` | Three.js adapter that consumes render snapshots. Uses WebGPURenderer with WebGL2 fallback, and a post-process stack in TSL so the same shaders run on both backends. | three |
| `@automata/render-pixi` | PixiJS 8 adapter that consumes render snapshots. WebGPU with WebGL fallback, and Pixi filters for post-processing. | pixi.js |
| `@automata/ui` | Svelte 5, Tailwind, GSAP. Screens: splash, main menu, settings, pause, game end, credits, quick actions (fullscreen, tutorial, contact, mute). Also gamepad focus navigation, the touch-control overlay, data-driven screen definitions, and override slots. | runtime (stores), Paraglide |
| `@automata/host` | The `Hosting` port, with three adapters: **ruken** (wraps `@ruken/sdk`), **web** (standalone), and **tauri** (desktop, which owns Quit). | `@ruken/sdk`, Tauri API |
| `@automata/net` *(opt-in)* | Protocol (commands, snapshots, deltas), client prediction and reconciliation, and the Colyseus client. | sim, colyseus.js |
| `@automata/server` *(opt-in)* | Base Colyseus room that runs the same `sim`, an input queue and tick scheduler, and persistence with Prisma and Neon for data the server owns. | sim, net, colyseus, prisma |
| `@automata/telemetry` | Neutral `track()` port and event catalog types. Adapters for Ruken, Umami, and Faro. Gated by consent. | (adapters lazy-loaded) |
| `@automata/testing` | Harnesses for sim goldens, replay goldens, and visual goldens; Playwright fixtures and E2E helpers; Ruken gate checks. | vitest, playwright |
| `@automata/cli` | `create`, `update`, `lock`, `deploy`, `validate`, `doctor`. | commander, @clack/prompts, fs-extra, picocolors |
| `infra/` | Reusable GitHub workflows, Docker images (build, test-GPU, server), and OpenTofu modules (Cloudflare sites, Hetzner server, GPU runner, Neon). | — |

Games always opt in to `net` and `server` deliberately. A single-player bundle contains no netcode.

## 5. State ownership

| State | Owner | Examples | Who may write it |
|---|---|---|---|
| Entity gameplay data | **Koota** (sim) | health, position, velocity, cooldown, weapon, team | sim systems only |
| Physical bodies | **Rapier** (sim) | bodies, colliders, contacts | sim physics step only |
| Progression and world facts | **sim world resources** | flags, quests, inventory, in-game clock, RNG state | sim systems, through commands |
| App/UI state | **Nano Stores** | selectedCharacter, settings, menuState, connectionStatus, currentRoom, volume | runtime managers and UI |
| Mirrors of sim state | **Nano Stores (read-only, derived)** | HUD health, quest log view | written only by the mirror sync; never by the UI |
| Presentation facts (one-off events) | **mitt** | screenShake, playSound, spawnParticles, toast | emitted from the snapshot/event diff; facts only, **never commands** |
| Durable player data | **Save manager → Hosting storage** | save slots, settings | Save manager only |
| Networked truth | **Colyseus server** | authoritative snapshots | server sim only |
| Entitlements (owned items, subscriptions) | **Host (Ruken), via `Hosting`** | `items`, `subscriptions[].active` | host only; they enter the sim as timestamped commands, so replays reproduce. A grant-once ledger lives in Save. |
| Server-owned durable data | **Postgres (Prisma/Neon)** | multiplayer accounts and world data | server only, networked games only |

There is **no Redux store**. The automata-template's action/reducer discipline survives as **typed sim commands**, and its selectors survive as **mirror selectors**.

## 6. Data flow

**Single-player (local authority):**

```
devices ─► Input manager ─► commands (per tick, ordered)
                                │
                                ▼
                     sim.step(commands)  ◄─ fixed clock, seeded RNG, compiled content
                                │
                     render snapshot + sim events
                ┌───────────────┼──────────────────┐
                ▼               ▼                  ▼
     render adapter      mitt (facts)      Nano Store mirrors
     (interpolates)      audio / VFX /      ─► Svelte UI
                         toast
```

**Networked:** each command goes to the local sim (prediction) and to the server at the same time. The server's authoritative snapshots reconcile the local state by rolling back and replaying unacknowledged commands; this relies on snapshot/restore. The rendering and UI paths are unchanged.

**Boot:**
1. The host adapter initializes (`Ruken.init`).
2. Storage becomes available.
3. Settings load.
4. Compiled content and the hash check load.
5. The renderer starts, probing WebGPU first and falling back to WebGL2.
6. The splash screen shows.
7. Rendering begins **only after host ready**.

## 7. Ruken integration contract

**Sources:**
- `Ruken/RukenApp/docs/superpowers/specs/2026-10-01-ruken-p01-protocol-sdk-design.md`. The SDK exists only as a spec so far; contract freeze F1 is **2026-10-16**.
- The Figma file `1bY4WOV4ep1Hp1IUL5eTpU`, page "01 Player experience", section "Game host" (nodes `114:328`–`130:786`).
- The reference adoption design: `.../2026-10-01-ruken-p06-floorfifty-adoption-design.md`.

**What the framework must guarantee by default:**

| Area | Requirement | Where it lives |
|---|---|---|
| Startup | Call `Ruken.init` before building any storage. **No gameplay renders before `session.ready`.** | host, runtime boot |
| Lifecycle | `lifecycle.changed` (active/background) and `onMenuRequest` pause through the Time manager, following the declared `pauseBehavior`. On `session.exiting` (1500 ms grace), flush the save and then call `exitReady`. | host → runtime Time |
| Layout | Honor `display.metrics` (`safeArea`, the `hostReserved` 48×56 edge tab, `scale`). Supported orientations are portrait, landscape, or any. | runtime Display, ui |
| Input | Touch, keyboard, pointer, and controller are all first-class paths. Touch targets are at least 44 px (48 px for primary actions). React to `input.mode` changes. | runtime Input, ui |
| Saves | `saves.storage` holds **string values only**, at most 1 MB per key, 10 MB per game, and 256 keys. Keys must match `/^[A-Za-z0-9._:-]{1,128}$/`. Show sync status. | runtime Save |
| Audio | Respect `audio.focus` and `audio.master`. Ruken provides no mixer, so the game owns its own. | runtime Audio |
| Packaging | A static zip of at most 200 MB (warning above 50 MB), at most 4,000 files, with `ruken.toml` and the entry file at the root. Use relative paths (`base: "./"`). | cli, infra |
| CSP | Only `script-src 'self' 'wasm-unsafe-eval'` is allowed: no inline scripts, no `eval`. `connect-src` may only reach the hosts declared in `[network]`. Links open through `links.open`. | build config, CI gate |
| Offline | Omitting `[network]` means the game is offline-capable. Single-player games omit it by default. | config → manifest |
| Performance | **30 FPS or better on Galaxy S20, iPhone 13, and desktop.** | CI perf budget |
| Localization | `en` is required. Languages are declared in the manifest. | content → manifest |
| Analytics | Custom events must match `/^[a-z][a-z0-9_]{1,39}$/` and be declared in the manifest. | telemetry catalog → manifest |
| Restart | The game can restart and return to the launcher without a page refresh. | runtime Scene |
| Store | `store.purchase` (item or subscription SKU), `store.manage`, and `entitlements.changed`. Grant whenever `items` gains a SKU or a subscription becomes `active`, not only when a purchase resolves. The game draws its own pass track and rewards. | host (A2), store module (A9) |

Inside Ruken, the host drawer owns Fullscreen, Exit, Language, and Accessibility entry points. The game's quick actions and Quit adapt to `Hosting` capabilities: Quit appears only under the Tauri adapter, and Fullscreen is delegated to `display.setFullscreen` when Ruken is the host.

## 8. Library decisions

| Library | Decision | Rationale |
|---|---|---|
| **Koota** (pmndrs) | **Replaces Miniplex**, subject to the A0 spike | SoA storage helps the 30 FPS gate on Galaxy S20; the retired AutomataEngine missed 60 Hz at 2,000 entities. Built-in relations cover inventory, parenting, and targets. `Added`/`Changed`/`Removed` queries feed render sync and the store mirrors. The React hooks are unused; we write thin Svelte/Nano bindings instead. The spike must prove deterministic iteration order and snapshot/restore. If it fails, we fall back to Miniplex. |
| **Rapier** | Adopt, using the deterministic builds (2D and 3D) | Required by laws 5 and 6. It is WebAssembly, which Ruken's CSP permits via `'wasm-unsafe-eval'`. |
| **TypeGPU** | **Skip** for now | It is at v0.12 and WebGPU-only, but Ruken requires a WebGL path. TSL in Three and Pixi filters already target both backends. Reconsider for optional extras that only work on WebGPU. |
| **Effect** | **Skip** | It would be a second programming paradigm for every game developer, it overlaps with Zod 4, and it adds overhead in the hot loop. Plain async code plus Zod is enough for the server and CLI. |
| **glyph** (pmndrs) | **Defer** to the first phase that needs text in the 3D world | Pre-release, wasm, Three only. Menus, HUD, and dialogue boxes stay in Svelte DOM, which already handles CJK, Korean, the dyslexia font, and accessibility. |
| **WebGPU** | Use where available, with a **mandatory WebGL2 fallback** | Ruken's renderer enum lists only WebGL variants, and its devices vary. |
| **Redux** | **Dropped** | Ownership is split as in §5. |

## 9. Hosting and infrastructure

- **Dev host:** a preview URL for every branch and HEAD build, plus an archive of every release at `/vX.Y.Z/`.
- **Prod host:** the latest tagged release, as the standalone website.
- **Ruken:** a `ruken-build.zip` built from the **same release tag**. Ruken's own game host (Cloudflare R2) serves it to players.
- **Providers:** Cloudflare Pages/R2 for the static dev and prod sites; Hetzner for the Colyseus server in Docker (only when networking is on); Neon for Postgres (networked only).
- **Test machine:** a Linux GPU box running a self-hosted GitHub runner, with each job in an ephemeral Docker container with GPU passthrough. Browser and driver versions are pinned so visual goldens stay stable. This replaces FloorFifty's Windows runner, which only stayed up while someone was logged in.
- **IaC:** OpenTofu modules in `infra/tofu/` for Cloudflare, Hetzner, the runner, and Neon.
- **Desktop:** Tauri desktop builds are a release artifact for standalone distribution. Ruken already ships its own desktop app, so Tauri is not used on Ruken's path.

## 10. Telemetry

- Games call `track('event_name', props)`. Events are defined in a TOML **event catalog** and validated with Zod at build time.
- The same catalog generates Ruken's `[analytics] custom_events`.
- **Adapters:**
  - **Ruken** `analytics.track`, when hosted. Ruken already sends activity, perf, and error telemetry automatically.
  - **Umami**, for product analytics in standalone builds.
  - **Grafana Faro**, for errors, performance, and real-user monitoring.
- Everything is gated by consent (`consent.changed`, plus standalone settings).
- **The sim never calls telemetry.** Events derive from sim events at the presentation layer.

## 11. Testing strategy

**Fast feedback is a framework requirement.** Test each behavior at the cheapest layer that can truthfully verify it. UI behavior and layout must be testable without starting a renderer, server or full game journey. Provide focused selection and local watch feedback; reuse immutable builds across compatible CI jobs. Measure queue, setup/build and execution time separately, and set feedback budgets in the relevant phase specs from actual measurements. Required cross-engine parity, GPU, release and real-device gates remain intact.

Failure reports identify the exact build, component/screen, state and viewport, with reproduction commands and relevant traces/screenshots/diffs. Preserve first-attempt failures when retries recover. Show omitted and pending gates explicitly; focused green does not mean full acceptance. Isolate run-owned ports/processes and reserve GPU capacity for focused feedback; performance probes run without competing GPU jobs.

| Layer | What | Where it runs |
|---|---|---|
| Unit / TDD | Every package. Strict red→green→refactor. | hosted CI |
| UI behavior + layout | Production components and styles in isolated fixtures; focus, hit targets, clipping, overlap, scroll containment, rotation and keyboard occlusion. DOM behavior tests plus real-browser geometry checks. | Node/jsdom and lightweight renderer-free browser tests locally or in hosted CI; heavy visual/E2E stays on Linux GPU runner |
| Boundary | `sim` imports only allowed modules (no DOM, `Date`, `Math.random`, I/O). Naming and style enforcement. | hosted CI |
| **Sim golden** | For a given seed and inputs, the state hash every N ticks equals the committed golden. | hosted CI |
| **Replay golden** | A recorded input stream reproduces the identical final hash. Networked games also run a two-client replay. | hosted CI |
| **Visual golden** | Playwright screenshots of each screen × renderer × form factor, in the order mobile portrait → mobile landscape → desktop landscape → tablet portrait. | Linux GPU runner |
| E2E | The flow splash → menu → gameplay → pause → end, on every device input path, under the mock Ruken host and standalone. | Linux GPU runner |
| Ruken gates | SDK handshake, no render before ready (screenshot at 5 s), CSP scan, zip limits, manifest validity, FPS budget on mobile emulation profiles. | Linux GPU runner |

## 12. Decomposition

**Ordering rule:** reach something deployable early. Every phase has fixed exit criteria; anything new goes into a later phase, not the current one (lesson from FloorFifty's scope churn).

**Planning detail (Owner direction, 2026-10-05):** Match the depth of Ruken's `docs/superpowers/specs/` and `plans/`: each phase spec defines scope, state ownership, interfaces, data flow, lifecycle/failure behavior, dependencies and concrete acceptance cases. Its implementation plan names exact files, consumed/produced interfaces, test-first steps, verification commands and evidence-backed tracking. Complete this design detail for A and B in the current specification pass; implementation plans remain just-in-time. The decomposition indexes the work and does not substitute for a spec or implementation plan. See [01 Decomposition](../../01-decomposition.md) §5 for the required detail. Preserve completed A1 sim-core work; the next A1b plan follows the full specification review gate.

### Part A: Framework (walking skeleton plus core managers)

| Phase | Scope | Exit criteria |
|---|---|---|
| **A0 Spikes** (throwaway code) | ① Koota: deterministic iteration and snapshot/restore. ② Rapier deterministic 2D/3D under Ruken's CSP. ③ Three WebGPU→WebGL2 fallback, with a TSL post-process pass on both backends. ④ Pixi 8 on WebGPU and WebGL. ⑤ A Ruken SDK stub that conforms to P01. | A written verdict for each spike. Koota is confirmed, or we fall back to Miniplex. |
| **A1 Foundation** | Monorepo (pnpm, turbo, TS, Biome, Vitest, Changesets), the boundary checker, `sim` (world, clock, RNG, commands, scheduler, resources, snapshot), `content` (TOML→Zod→JSON plus hash), and the sim and replay golden harnesses. | The same seed and inputs produce the same hash, verified in hosted CI. |
| **A2 Skeleton** | The `runtime` app loop, Scene/Flow and Time managers, both render adapters, `host` (web and ruken adapters plus a mock Ruken host), `ui` screens splash → menu → blank gameplay → pause → end, plus credits and quick actions. Store plumbing in `Hosting`: entitlements, `store.purchase`, `store.manage`. `examples/blank-game` runs in both renderers. Establish reusable responsive screen/layout primitives and a renderer-free component/screen preview and test harness, drawing on FloorFifty. | Components and skeleton screens can be previewed and tested without a renderer or server. It boots under the mock Ruken host and standalone. Nothing renders before ready. |
| **A3 Ship pipeline** | Reusable workflows; OpenTofu for the GPU runner, Cloudflare dev/prod, and Neon; visual goldens and E2E; the Ruken zip, `ruken.toml`, and gate checks; a Tauri desktop build; a **minimal `create-game`**; a first prerelease of the packages. Focused remote runs, compatible build reuse, GPU preflight, actionable failure artifacts and explicit coverage reports; measure feedback and queue times. | Focused tests can run without repeating the full matrix; full release gates remain required. `create-game x`, then push, puts x on the dev host and produces a Ruken zip, with no manual steps. |
| **A4 Input + Display** | Input: keyboard and mouse, gamepad, touch, profiles, rebinding, cursor hiding, the touch overlay, gamepad focus navigation. Display: responsive layouts in the priority order above, safe area and `hostReserved`, UI scale, the stacking post-process (LCD, film grain, outline, dither, color grading), graphics settings, color-blind UI. Complete shared frames, action bars, dialogs, lists and panels that adapt to container size and usable height; keep layout geometry separate from input mode. Cover compact landscape, rotation, browser bars, keyboards and host exclusions without losing state or reachable controls. | Responsive component and composed-screen contracts pass at reference sizes and breakpoint boundaries, including focus, target sizes, hit testing, clipping and scroll containment. An E2E matrix of input devices × form factors passes. |
| **A5 Save + Audio + Localization** | Save: 3 slots, autosave, versioning and migrations, string-encoded through Hosting. Audio buses, music, SFX, and audio settings. Paraglide in EN/ES/ZH/KO/PT/JA, plus a dyslexia font option. The full settings menu. Extend shared UI fixtures and layout contracts with dense settings, long translations, large UI/text scales and save/audio states. | These states remain readable and operable across supported sizes and orientations. A save made on version N loads on version N+1 through its migration. Every UI string is localized. |
| **A6 Debug + Telemetry** | imgui-js panels (state, ECS, perf HUD, toggles), with a registry so later systems can add overlays. The telemetry port, its three adapters, and consent. | Debug code is absent from release bundles. Events are validated against the catalog. |
| **A7 Networking** (opt-in) | `net` and `server`: a Colyseus room running the sim, prediction and reconciliation, Prisma/Neon, and the Hetzner deploy. The example game in networked mode. Deterministic clock/network harnesses cover cadence drift, jitter, delayed/duplicate packets, stalls and reconciliation before representative real multiplayer journeys. | The two-client replay golden passes. Single-player bundles contain no netcode. |
| **A8 CLI + 1.0** | The full `create`/`update`/`lock`/`deploy`/`validate`/`doctor`, the codemod infrastructure, docs, and the 1.0 release. Scaffold documented focused test commands and screen-fixture registration so games inherit the feedback workflow without custom CI plumbing. | A scaffolded game can preview and test its UI independently and report focused versus full coverage. `update-game` migrates the example game from 0.x to 1.0. |
| **A9 Store & Season Pass** | Items (DLC, extra content) and subscriptions (e.g. a battle pass), sold through Ruken's `store` capability: a grant-once ledger in Save; a TOML schema for SKUs, seasons, tiers, the XP curve, free/paid tracks and rewards; pass progression as sim state; pass-track and store UI with a `store.manage` entry; standalone/dev entitlement overrides. Game-specific challenges remain in the game until later modular extraction is justified. Rewards should be cosmetic unless server-validated (A7), because saves are client-side. | A replay with entitlement changes reproduces. A purchase that times out still grants when entitlements arrive later. A lapsed subscription locks the paid track without losing earned progress. |

**Deferred beyond Part A:**
- Tauri mobile, until there is a standalone app-store target. Ruken mobile is a PWA.
- glyph.
- TypeGPU.

### Part B: Asset pipelines (internal; can start in parallel once A2 lands)

- **B1 Character pipeline:** Meshy → Blender MCP. The target look is PSP/DS-era low-poly, with PS2-Persona proportions and 90s-SNK-style textures. Steps: rig, animation set, GLB export, budget validator, and content TOML.
- **B2 Environment pipeline:** a TrenchBroom-style brush workflow, with the Sencha editor (`GavynBryan/Sencha/editor`) as the reference. A map compiler outputs GLB, Rapier colliders, spawn anchors, and lighting zones as data.

### Real 3D game using Parts A and B

**Owner direction, 2026-10-05:** cut the former C1–C8 template-port scope. Deliver A and B, then build a real 3D game with them. A separate reviewed game design selects the concept, playable scope, assets, target devices and relevant optional framework capabilities. Write its implementation plans just before execution. The foundation example is a test fixture, not the real-game milestone.

Keep gameplay systems in the game initially, obeying the seven laws and consuming A's responsive UI and focused testing infrastructure. Acceptance includes real playable journeys, asset/render/runtime evidence and separate Owner play/visual review.

### Part C: modular systems extracted from FloorFifty and the 3D game

After the 3D game has accepted playable behavior, audit it alongside FloorFifty (2D). Select modules from demonstrated behavior and reuse needs rather than a speculative template inventory. No C module list is approved yet, and C specs are not prerequisites for A/B implementation.

Each selected module needs a reviewed spec covering source behavior, public/versioned contracts, state ownership, lifecycle/failure policy, dimensional assumptions, game-specific boundaries and applicable regression cases. Then extract incrementally under TDD and verify adoption in actual consumers. Modules publish under the existing `@mcthaydt/automata-*` convention. Preserve responsive layout/input behavior and testing diagnostics; keep branding, content and game-specific state in the games. A module need not support both 2D and 3D when its justified scope is dimension-specific.

---

## 13. Prior art to reuse

**FloorFifty** (`snek_attak/Games/FloorFifty/FloorFifty_SRC/apps/client/src/` unless noted):
- `managers/presentation/presentation-event-bus.ts`: a typed, synchronous FIFO queue. Facts only; anything published during a drain is queued, not nested.
- `managers/screen-manager.ts` with `content/flow.toml`: one transition at a time, exit before enter, and no navigation policy of its own.
- `screens/screen.ts` and `common/dispose.ts`: the enter/exit contract plus a DisposeBag, with dependencies passed in as ports.
- `managers/network/network.ts` (`NetworkPort`) and `ui/store/room-store.svelte.ts` (a store that only mirrors the server).
- `managers/letterbox.ts`, `managers/gamepad-source.ts`, `ui/focus-nav.ts`, `ui/cursor-policy.ts`, and the gesture helpers.
- `ui/layout/`: ScreenFrame, ActionBar, CornerControls, Split, ScrollList, OptionGroup and dialog/paging patterns. Extract behavior and contracts; keep branding and game-specific state in the game.
- `ui/{form-factor,height-tier,viewport-tracking.svelte}.ts`: layout shape, usable height and visual viewport occlusion are separate concerns; keyboard opening must not reclassify the layout.
- `tests/e2e/support/layout.ts` and the responsive sweep: reuse hit-testing, target-size, clipping, overlap and reachability assertions in isolated UI fixtures, then verify composed integration.
- `playwright.config.ts` and CI: reuse viewport-sensitive selection, separate performance probes and actionable evidence; avoid full GPU journeys for ordinary DOM layout checks.
- `packages/shared/src/common/{constants,tuning}.ts`: the split between invariants and tunables.
- `apps/server/src/rooms/{input-queue,tick-scheduler,room-driver}.ts`.

**Ruken planning** (`Ruken/RukenApp/docs/superpowers/`):
- `specs/2026-10-01-ruken-p01-protocol-sdk-design.md`: message catalog, capabilities, payloads, timeouts, failure handling, paired contract tests and downstream ownership.
- `specs/2026-10-01-ruken-p05-runtime-services-design.md`: ordered service flows, adapter mappings, save conflicts/quotas and concrete success/failure acceptance cases.
- `specs/2026-10-01-ruken-p09-player-web-design.md`: component/state inventory, tokens, orientation behavior, host-state bindings and testable interaction rules. Reuse the documentation precision, not Ruken's product branding.
- `plans/2026-10-01-ruken-p00-foundation.md` and `plans/2026-10-01-ruken-p01-protocol-sdk.md`: global constraints, review risks, exact file responsibilities, consumed/produced interfaces, red→green tasks and verification commands.
- Ruken has phase specs P0–P14 but executable plans only for P0/P1. Match that separation here: full phase specs first, implementation plans just before execution. Do not invent future implementation evidence.

**Retired AutomataEngine** (`Ruken/[Retired]/AutomataEngine`):
- `scripts/check-boundaries.ts` (simulation purity)
- the `step`/`project` split
- `src/host/lifecycle.ts`
- `src/render/viewport.ts` (safe-area-aware)
- versioned saves with migrations

Lesson from it: **don't over-specify before there is evidence.**

## 14. Risks

| Risk | Mitigation |
|---|---|
| The Ruken SDK exists only as a spec until F1 (2026-10-16) | Build against a stub that conforms to P01, behind `Hosting`, and swap in the real SDK after F1. Contract tests cover the stub. |
| Koota's determinism and snapshot behavior are unproven | Spike in A0, with Miniplex as the fallback. |
| Two renderers double post-process and visual-golden work | Share the render-snapshot contract. Keep post-process effects declared as data and implement them per adapter. Cover both in the visual matrix. |
| Scope churn (FloorFifty's launch spec was amended more than 10 times) | Fixed exit criteria per phase; new ideas go into a later phase's backlog. |
| The GPU runner could become as flaky as FloorFifty's | Ephemeral containers, pinned browsers, and the runner defined in OpenTofu so it can be rebuilt. |
| Mobile performance (30 FPS on S20) | A perf budget gate from A3 onward, and SoA ECS. |

## 15. Deferred to the phase specs

- Biome rule set, and the TS naming convention that replaces the Godot prefixes (A1).
- The snapshot and save encoding format (A1 and A5).
- Post-process implementation per adapter (A4).
- The exact reusable-workflow interface and the OpenTofu module layout (A3).
- Responsive component APIs and fixture registration (A2), focused test selection/caching/reporting and measured feedback budgets (A3), and the detailed viewport/occlusion/input coverage matrix (A4). Define these within the full phase-spec pass, with measured feedback budgets refined when A3 has timing evidence. Do not create a separate workstream or rewrite completed A1 sim-core work.
