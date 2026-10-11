# AutomataFramework: decomposition

- **As of:** 2026-10-11 (Ruken-first restructure). Completion evidence for M0 is the recorded 2026-10-02 snapshot; it has not been re-run in this update.
- **Purpose:** the package and milestone inventory, dependencies, the mapping from the old A/B/C phases, and the detail every milestone spec and plan must reach. It indexes the specs; it does not replace them.
- **Source of truth for *what*:** the [Ruken-first master spec](superpowers/specs/2026-10-11-automata-framework-ruken-first-design.md) and [extraction map](superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md); for the sim, the [A0+A1 spec](superpowers/specs/2026-10-01-a0-a1-spikes-foundation-design.md) (§11–§12 override its earlier sections). If this document and a spec disagree, the spec wins.

> **Read order:** [00 Overview](00-overview.md) → this decomposition → [02 Master delivery plan](02-master-delivery-plan.md) → [03 Continuation](03-continuation-prompt.md) → [04 How we build](04-how-we-build.md).

---

## 1. Where we are

```
M0 Foundation ─────────── DONE   PR #1 (spikes S1–S6, ADR 0001), PR #2 (A1a sim core), CI green in 4 engines (2026-10-02)
M1 Blank game on Ruken ── NEXT   master spec + extraction map + ADRs 0002–0004 drafted 2026-10-11; Owner review pending
M2 … M8 ───────────────── NOT STARTED
External: Ruken M1 accepted 2026-10-09 (except Ruken M1.7d and the `contracts-f1` tag); Ruken packages unpublished; Ruken F1 freeze planned 2026-10-16 (tag not yet cut)
```

**What exists in code** (on `main`, from PR #2, plus this branch's one fixture):
- `packages/sim`: deterministic math, XXH64, canonical JSON, xoshiro128** RNG with per-system substreams, field types and `define*` factories, plugin/system ordering, `EntityStore` (StableIds, frozen `get()`, render delta), `createSim`/`step`, snapshot v1 (sections 1–4) with atomic validating `restore` and `hash()`. XXH64 and canonical JSON are also exported as `@mcthaydt/automata-sim/hash` (added in PR #4) so the content compiler hashes with the same code.
- `tooling/check-boundaries` and `tooling/check-style`, AST-based, with fixtures. This branch adds `import-effect.ts`, pinning ADR 0003's rule that the sim never imports Effect.
- `.github/workflows/ci.yml`: `checks` and `cross-engine` jobs. Historical: unit sim 147, boundaries 20, style 17; parity 165/165 in Chromium/WebKit/Firefox (~1m20s).

**What does not exist yet:** physics, the content compiler, goldens and replays, the example game, publishing, and everything that renders, takes input, talks to Ruken, packages or deploys.

## 2. Old phases mapped to milestones

The A/B/C phase IDs remain in historical documents (the A0 and A1a plans, spike verdicts, PR titles). New work uses milestone task IDs.

| Old phase | New home | Note |
|---|---|---|
| A0 Spikes | M0 | Done. S3 (Three.js) is historical; ADR 0002 retires `render-three`. |
| A1a Sim core | M0 | Done. |
| A1b Physics + content | Content compiler → **M1.3**; physics → **M2.1** | Content moved earlier on Owner direction (content pipeline early). |
| A1c Testing + example + release | Example and minimal scaffold → **M1.8**; goldens, replays, publishing → **M2.2–M2.4** | |
| A2 Skeleton | **M1.4–M1.7** | `render-three` removed; Ruken host from Ruken's packages, not the S6 stub. |
| A3 Ship pipeline | **M1.1–M1.2** | Moved to the start of M1 on Owner direction (CI/CD and deployment early): the pipeline is proven on a placeholder game before the runtime exists. |
| A4 Input + Display | Core primitives in **M1.6**; completion in **M4** | Mobile UI early. |
| A5 Save + Audio + i18n | **M5** | |
| A6 Debug + Telemetry | Ruken telemetry in core (M1.4); `debug`, `telemetry-extra` extensions in **M6** | |
| A7 Networking | `net`/`server` extensions, **M7** | Built from FloorFifty's Colyseus code. |
| A8 CLI + 1.0 | Minimal `create-game` in M1; full CLI in **M8** | |
| A9 Store & Season Pass | `store` extension, **M7** | Blocked on Ruken's `[store]` manifest section. |
| B1 Character pipeline | 2.5D sprite-atlas characters in the `pipelines` extension, **M3**; rigged 3D characters, **M9** | Starts from The Last Light's character pipeline; the rigged pipeline comes from the 3D game. |
| B2 Environment pipeline | `sectors` extension + sector environment pipeline, **M6**; brush-based 3D environments, **M9** | Starts from The Last Light's sector maps; TrenchBroom/Sencha stays a reference for the 3D game. |
| "Real 3D game" | **GAME-3D**, after AF 1.0 (M8), then **M9** merges its 3D pieces back | Owner roadmap 2026-10-11: 2D and 2.5D first, then 3D. The Last Light is the 2.5D reference. |
| Part C modular extraction | Replaced by core + extensions from day one | |

## 3. Milestone map and dependencies

```
M0 ─► M1 ─┬─► M2 ─┬─► M3 ─► M6
          │       ├─► M5 ─┐
          └─► M4 ─┘       ├─► M7 ─► M8
                    M2 ───┘
M8 (AF 1.0, 2D + 2.5D) ─► GAME-3D (a 3D game on AF) ─► M9 (3D merge)
External: Ruken package publication / F1 ─► M1.2, M1.4 re-vendor;  Ruken [store] ─► M7 store
```

- M2 depends on M1's content compiler (content hash in the snapshot header). M3 needs M2's physics for 3D colliders. M5 needs M4's layout matrix for settings screens. M6's extensions need M2 (physics, goldens) and M3 (3D) where they render in 3D. M7 needs M2's snapshot/restore for reconciliation. M8 needs everything it adopts.
- **Process per milestone (Ruken style):** milestone spec → Owner review (contracts for that milestone freeze here) → a just-in-time TDD plan per task → PR per task with its task ID → merge → evidence recorded in the master plan and continuation.

| Milestone | Spec | Status | Exit criterion (abridged) |
|---|---|---|---|
| M0 Foundation | A0+A1 spec | ✅ merged | Spike verdicts; ECS decided; sim core |
| M1 Blank game on Ruken | **to write** (`m1-blank-game-on-ruken`) | ⬜ | Push → CI green → Ruken-validated zip → published to Ruken local stack and dev host → playable on a phone; nothing renders before ready; layout contracts pass at every reference size |
| M2 Deterministic core complete | A0+A1 spec + **to write** (`m2-deterministic-core`) | ⬜ | A1 exits 2–8 of the A0+A1 spec |
| M3 2.5D and pipelines | **to write** | ⬜ | 2.5D example (private build, D-1) on WebGL2, and WebGPU when opted in, under Ruken CSP at ≥30 FPS on phone profiles; one character through the pipeline with gates |
| M4 Input and display | **to write** | ⬜ | Input × form-factor E2E matrix under the fake Ruken host |
| M5 Saves, audio, localization | **to write** | ⬜ | Save N → N+1 migration; cross-device save/exit/resume on Ruken; all strings localized |
| M6 Gameplay extensions | **to write** | ⬜ | Each extension's fixture game passes; The Last Light's route tests pass on extracted `puzzle` |
| M7 Online and store | **to write** | ⬜ | Two-client replay golden; no netcode in single-player bundles; entitlement replays reproduce |
| M8 CLI 1.0 and adoption | **to write** | ⬜ | `update-game` 0.x → 1.0; each reference game's adopted slice passes its existing tests |
| GAME-3D | **its own game design** | ⬜ | A 3D game built on AF 1.0, playable and Owner-accepted on Ruken |
| M9 3D merge | **to write** | ⬜ | The 3D game's proven pieces pass in AF and the game consumes them from AF |
| M10 Website | **to write** | ⬜ | The site sells extensions individually and as an all-access pass, hosts the docs and the playable demo gallery |

## 4. Milestone work packages

Each milestone spec decomposes these and may refine them; task IDs are owned by [02 Master delivery plan](02-master-delivery-plan.md).

### M1 Blank game on Ruken
Ordered so the pipeline exists before the runtime: CI/CD and deployment are proven on a placeholder page first, then each runtime piece lands on a working pipeline.
- **M1.1 Toolchain and CI lanes:** align with Ruken's `docs/versions.md` where AF consumes Ruken code (Node, Zod) and record each deliberate difference (TypeScript 7 vs Ruken's 6.0.3) rather than downgrading; add AF's versions page and pins test; add Effect; decide D-3 (lint tooling); spike S8 on the placeholder page (Effect bundle bytes and cold boot on the phone profiles under Ruken's CSP), which sets the runtime's budgets. Split CI into lanes (hosted checks and parity on every push; browser lanes on the reused runners, D-5), add per-checkout ports, server reuse and focused `test:remote`; browser lanes nightly and on request, with the added queue time on the shared runners measured. Evidence promotion and worktree cleanup move to the `dev-tools` extension (M4).
- **M1.2 Ship skeleton:** reusable `game-ci.yml` (which runs `check-boundaries` on the game's sim sources) and release workflow; `ship prepare` writes `ruken.toml` and checks it with `@ruken/manifest`'s `parseManifest` (plus version, tag and root-absolute path checks); `ship publish` hands `dist/` to `ruken publish`, which packs and validates (no AF zip or validate step; no dry run exists); Ruken's local stack is the only M1 target; standalone dev host with per-build URLs (D-4) serving `compileHeaders`' CSP. Proven with a placeholder game page that completes the Ruken handshake through vendored `@ruken/sdk` and waits for `session.ready`.
- **M1.3 Content compiler**, extracted from FloorFifty's `packages/content` and its `tests/content/` suite (extraction map), with the A0+A1 spec §5 filling gaps: discovery, smol-toml with positions, Zod 4, references, canonical JSON, XXH64 hash (imported from `@mcthaydt/automata-sim/hash`), `content.d.ts`, all errors as `file:line:col`, tuning ranges, generator hook, Vite plugin; generators for `ruken.toml` content fields, locale keys, flow graph and preload list.
- **M1.4 Host:** `Hosting` Effect service per the [M1 shared contracts](superpowers/specs/2026-10-11-m1-shared-contracts-design.md); one layer over vendored `@ruken/sdk`, whose own standalone session covers non-Ruken play (no AF web adapter, no AF copies of Ruken limits); the in-frame handshake fallback reported; test layer on `@ruken/sdk-host`'s fake host; FloorFifty's 13 Ruken test files and the S6 cases ported; `track()` with the Ruken analytics adapter.
- **M1.5 Runtime:** within the S8 budgets (M1.1), with a frame-loop overhead check; the boot program (master spec §7) with the `BootError` union from the [M1 shared contracts](superpowers/specs/2026-10-11-m1-shared-contracts-design.md); `defineExtension`; loading with byte progress, 30 s stall and Try again; app loop with fixed sim step and interpolation; Time (lifecycle and menu pause, fixed `pauseBehavior`); Flow from `flow.toml`; presentation bus; settings over host storage.
- **M1.6 Mobile-first `ui`:** geometry owner (form factor, height tier, visual viewport, safe area, `hostReserved`), ScreenFrame, ActionBar, CornerControls, ScrollList, Dialog, LoaderOverlay, ErrorPanel, focus navigation basics; renderer-free fixtures; layout assertions at every reference size including 780×270. Can start in parallel with M1.3.
- **M1.7 `render-pixi` 2D:** the `./no-eval` entry (Pixi's no-eval build and Zod jitless, FloorFifty `no-eval.ts`); init on WebGL2 by default with WebGPU opt-in, `RenderDelta` consumption with `resync`, pixel framebuffer option, letterbox, filter helpers.
- **M1.8 Base project, demos, scaffold and exit:** `examples/base-2d`, a character in a room (splash → menu → room → pause → end), replaces the placeholder in the M1.2 pipeline; the demo gallery and the M1 lanes' waiting demos ([`examples/README.md`](../examples/README.md)); `create-game` starts from `base-2d`; minimal `create-game`; M1 exit evidence.

### M2 Deterministic core complete
- **Physics plugins** (the `physics` extension package, `packages/physics`, with a snapshot-section hook added to `packages/sim`; `net` stays physics-agnostic): Rapier `-deterministic-compat` 0.21, lazy wasm, `RigidBody`/`Collider`/`Transform2D`/`Transform3D`, `physics.syncIn`/`step`/`syncOut`/`events`, deterministic contact order, snapshot section 6, parity tests in four engines, measured wasm size and ms/tick.
- **Wire content into the sim:** typed, deep-frozen `SimOptions.content`; snapshot `contentHash` from the compiler; restore with another hash throws `SnapshotMismatchError`.
- **Goldens and replays** (`testing`): `simGolden`, `.replay` v1 and `recordReplay`, `replayGolden` with first-divergent-tick bisection and structural diff, a divergent fixture, the ≥200-seed property test, the cross-engine runner. The Last Light's `record`/`replay`/`worldHash` tests are a second consumer.
- **Build and publish:** Vite library mode, Changesets, `0.0.x` prereleases to GitHub Packages; CI under 10 minutes.

### M3 2.5D and pipelines
- **Spike S7:** `@pixi/3d` under Ruken's CSP, WebGL2 parity, phone FPS, CI capture path, API surface; decide D-1.
- **`render-pixi3d`** at 2.5D scope (fixed-zone and orbit cameras, billboards, lit sprites, GLB props, fog, baked lighting), **`post-retro`**, a 2.5D example scene.
- **`pipelines`:** router, MCP server, budgets, gates, guard, audit log, made game-agnostic; The Last Light's 2.5D character (lit sprite atlas with normal map) and props (image → Meshy → flattened GLB) pipelines with their gates.

### M4 Input and display
- Gamepad, touch overlay and gestures, profiles and rebinding, cursor hiding, focus navigation across composed screens; letterbox and safe area; `scale` hint; graphics settings; color-blind UI; complete frames, panels, lists and paged grids; input × form-factor E2E matrix under the fake Ruken host.

### M5 Saves, audio, localization
- Ruken saves: slots, autosave, versions and migrations, sync status, flush on `session.exiting` then `exitReady`; string encoding within Ruken's limits.
- Audio core focus/gain; `audio-synth`; `audio-stream`.
- Paraglide EN/ES/ZH/KO/PT/JA; `i18n-extra` fonts; dense settings, long text and large UI scale in the layout matrix.

### M6 Gameplay extensions
- `sectors` (and the environment pipeline on it), `nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `feel`, `debug`, `telemetry-extra`. Fix The Last Light's core leaks first (extraction map §3).

### M7 Online and store
- `net`/`server` from FloorFifty: `NetworkPort`, Colyseus client, room store, input queue, tick scheduler, prediction and reconciliation, deterministic clock/network harnesses, two-client replay, bundle check.
- `store` once Ruken's `[store]` manifest section exists; `host-tauri`.

### M8 CLI 1.0 and adoption
- Full `create`/`update`/`lock`/`deploy`/`validate`/`doctor`, codemods, docs, 1.0.
- Adoption slices (D-2): FloorFifty on AF `host` + loading + `ui` layout; The Last Light on AF `puzzle` + `sectors`, each passing its own existing tests at a pinned commit (Ruken's `floorfifty.sha` pattern).

### GAME-3D and M9 3D merge
- **GAME-3D:** a 3D game in its own repo on AF 1.0, with its own reviewed game design and TDD plans (a small third-person action-adventure is the current suggestion; the Owner picks). 3D-only systems stay in the game until they work there.
- **M9:** merge the game's proven 3D pieces into AF: full 3D in `render-pixi3d`, the rigged character and animation pipeline (Meshy → Blender, rig, animation set, GLB, budget validator, content TOML), third-person camera and character controller, and the brush-based environment pipeline. Each piece keeps passing in the game, which then consumes it from AF.

## 5. Required milestone-spec and plan detail

The reference is Ruken's `docs/superpowers/`: P01's catalog, P05's ordered flows and P09's component/state inventory. Every milestone spec defines:

| Must define | Concrete detail |
|---|---|
| Goal and boundaries | Observable behavior, deliverables, exclusions, prerequisite artifacts |
| Ownership | Which package, service or port owns each state; allowed writers; sim versus presentation versus host |
| Contracts | Named types and functions, Effect services and their errors, schemas, units, ordering, versioning, consumers |
| Data and lifecycle flow | Ordered boot/update/transition/shutdown steps, readiness gates, scopes and disposal, restart |
| Failure policy | Invalid input, timeout, cancellation, unavailable or denied capability, partial failure, recovery, preserved state |
| UI inventory | Components and screens, states, composition, focus and input, host-aware actions |
| Responsive behavior | Container and usable-height policy, orientation, safe areas, `hostReserved`, browser bars and keyboards, long text, UI scale |
| Test allocation | Unit, DOM, real-browser layout, parity, GPU, fake-host integration, device and Owner gates; fixtures versus real journeys |
| Feedback workflow | Focused selection, build reuse, readiness signals, evidence, measured timing |
| Ruken alignment | Which Ruken contract each behavior follows, by package and file; anything Ruken lacks goes to Ruken as a request |
| Exit criteria | Named success and failure cases, required evidence, external dependencies, Owner acceptance |

Every plan names exact create/modify/test files, consumed and produced interfaces, a failing test with its expected failure, the minimal change, passing commands and expected outcomes, and integration checks. Checkboxes advance only with evidence.

## 6. External dependencies and things only the Owner can do

| Item | Blocks | Status |
|---|---|---|
| Owner review of the Ruken-first spec, extraction map, ADRs 0002–0004 and decisions D-1 to D-6 | Nothing (defaults in force since 2026-10-11; an override may change lane work) | Pending |
| Ruken package publication (`@ruken/sdk`, `@ruken/sdk-host`, `@ruken/manifest`, `@ruken/cli`) | M1.2, M1.4 | Unpublished (Ruken gates it on `NPM_PUBLISH_READY` and M0.3); vendored meanwhile (D-6). `@ruken/validation` is private, and AF does not need it because `ruken publish` validates. |
| Ruken TEST environment | Publishing beyond Ruken's local stack | Not provisioned; M1 targets the local stack only |
| Ruken F1 contract freeze (`contracts-f1` tag) | Re-vendor after M1.4 | Planned 2026-10-16; not cut as of 2026-10-11 |
| Ruken `[store]` manifest section | M7 `store` | Not built in Ruken |
| GitHub Packages publish and game-read tokens | M2.4 publishing, every game repo | Not verified |
| Runner capacity (reuse of the Owner's WSL and Windows GPU runners, or a Linux GPU box) | M1.1 browser lanes, M3 visual checks | D-5 |
| Standalone hosting account and domain | M1.2 dev host | D-4 |
| `@pixi/3d` beta access, version and deployment terms (public deployment is not allowed under the beta, per The Last Light's README) | M3 public builds, GAME-3D deployment | D-1 (provisional: unpublished, private builds only) |

## 7. Backlog

New ideas go here, not into the current milestone.

- (empty)
