# AutomataFramework: Work Decomposition

- **As of:** 2026-10-05 (planning update; completion evidence below remains the recorded 2026-10-02 snapshot)
- **Purpose:** Canonical phase and work-package inventory: where the project is, what is left, and the architectural dependencies. It does not replace the specs; it indexes them and breaks every phase into work packages.
- **Source of truth for *what*:** the overview spec (`superpowers/specs/2026-10-01-automata-framework-overview-design.md`) and the A0+A1 spec (`superpowers/specs/2026-10-01-a0-a1-spikes-foundation-design.md`, §11–§12 override earlier sections). If this doc and a spec disagree, the spec wins and this doc is stale.
- **Rule of detail (Owner direction, 2026-10-05):** complete phase specs for A and B now, at Ruken's level of precision (§3.1), before the next implementation plan or product work. Implementation plans remain just-in-time. Responsive UI reuse and faster, stronger testing are integrated requirements of the existing phases, not a separate workstream.

> **Read order:** [001 Overview](001-overview.md) → this decomposition → [003 Master delivery plan](003-master-delivery-plan.md) → [004 Living continuation](004-continuation-prompt.md). The delivery plan owns task order; the continuation owns the current next action.

---

## 1. Where we are (TL;DR)

```
A0 Spikes ──────────── DONE    merged PR #1 (S1–S6 all pass, Koota confirmed, ADR 0001)
A1 Foundation
  ├─ A1a sim core ──── DONE    merged PR #2 (2026-10-02), CI green in all 4 engines
  ├─ A1b physics + content ─── NOT STARTED (no plan yet)
  └─ A1c testing + example + release ─── NOT STARTED (no plan yet)
A2 … A9, B ───────── NOT STARTED (no specs yet)
3D game ──────────── FOLLOWS A+B (game design not yet selected)
C modular extraction ─ FOLLOWS real 3D game + FloorFifty evidence
External: Ruken answered the P01 gap list on 2026-10-02 (recorded in s6-ruken-stub.md); F1 = 2026-10-16
```

**What exists in code today** (on `main`, from PR #2):
- `packages/sim`: deterministic math, XXH64, canonical JSON, xoshiro128** RNG with per-system substreams, field types + `define*` factories, plugin/system ordering, `EntityStore` (StableIds, frozen `get()`, render delta), `createSim`/`step`, snapshot v1 (sections 1–4) with atomic validating `restore` and `hash()`.
- `tooling/check-boundaries` and `tooling/check-style`, both AST-based, with fixtures.
- `.github/workflows/ci.yml`: `checks` job and `cross-engine` job, both green. Unit: sim 147, boundaries 20, style 17. Parity: 165/165 in Chromium/WebKit/Firefox (~1m20s, in the pinned Playwright container).

**What does not exist yet:** physics, content compiler, golden/replay harnesses, the example game, builds/publishing, and everything that renders, takes input, or talks to a host.

---

## 2. Do next, in order

### 2.1 Unblock and merge PR #2 (A1a) — done 2026-10-02

- [x] The parity job was timing out inside `playwright install --with-deps`. It now runs in the pinned `mcr.microsoft.com/playwright:v1.63.0-noble` container (plus a git `safe.directory` step and `HOME=/root` on the test step for Firefox). **Bump the image tag whenever the `playwright` devDependency changes.**
- [x] Merged PR #2 into `main`.
- [x] Cleanup: `a1a-sim-core` worktree and branch removed; main checkout on `main`.

### 2.2 Send the P01 gap list to Ruken (deadline 2026-10-16)

- [x] Send the 9 questions in `docs/spikes/s6-ruken-stub.md` ("P01 gaps and questions") to the Ruken team.
- [x] Record the answers in the S6 verdict file ("Ruken's answers", 2026-10-02); they feed the A2 `host` spec.
- [ ] After F1 (2026-10-16), check the published P01 includes the agreed changes.

### 2.3 Complete the full specification pass before the next implementation plan

**Current next task:** follow SPEC-01 through SPEC-13 in [003 Master delivery plan](003-master-delivery-plan.md). Reconcile the existing overview/A0+A1 design, write the 10 missing A2–A9 and B1–B2 phase specs, audit cross-phase contracts and obtain written-spec review. Do not start the A1b implementation plan or product code before that gate.

After the specification gate, write/review the A1b plan, implement its approved scope, then write/review A1c. The A1a plan calls those plans "2b" and "2c"; use A1b/A1c filenames when they are written so files, branches and PRs line up (`a1b-physics-content`, `a1c-testing-release`).

---

## 3. Phase map and dependencies

```
A0 ─► A1a ─► A1b ─► A1c ─► A2 ─► A3 ─┬─► A4 ─┐
                                     ├─► A5 ─┤
                                     ├─► A6 ─┼─► A8 (1.0)
                                     ├─► A7 ─┤
                                     └─► A9 ─┘   (A9 needs A5 Save; rewards beyond cosmetic need A7)
                               A2 ─► B1, B2 (parallel track)
                          A + B ─► real 3D game ─┐
                       FloorFifty (2D) evidence ─┴─► C modular extraction
External: Ruken F1 (2026-10-16) ─► A2 host/ruken adapter swaps stub for real @ruken/sdk
```

Per-phase process (unchanged from A0/A1): **phase spec → plan → task-by-task execution with review → PR → merge.** Exit criteria are fixed per phase; new ideas go to a later phase's backlog (§8).

| Phase | Spec | Plan | Status | Exit criterion (abridged) |
|---|---|---|---|---|
| A0 Spikes | A0+A1 spec | A0 plan | ✅ merged | Verdict per spike; ECS decided |
| A1a Sim core | A0+A1 spec | A1a plan | ✅ merged PR #2 | (contributes to A1 exit) |
| A1b Physics + content | A0+A1 spec | **to write** | ⬜ | (contributes to A1 exit) |
| A1c Testing + example + release | A0+A1 spec | **to write** | ⬜ | Same seed+inputs → same hash, in hosted CI, 4 engines |
| A2 Skeleton | **to write** | — | ⬜ | Responsive UI foundations independently previewable/testable; boots under mock Ruken + standalone; nothing renders before ready |
| A3 Ship pipeline | **to write** | — | ⬜ | Focused remote feedback and explicit coverage/evidence; `create-game x` + push → dev host + Ruken zip, no manual steps |
| A4 Input + Display | — | — | ⬜ | Component/composed-screen layout contracts and E2E input × form-factor matrix pass |
| A5 Save + Audio + i18n | — | — | ⬜ | Save migration; localized strings; dense settings/long text/save states remain usable across layouts |
| A6 Debug + Telemetry | — | — | ⬜ | No debug code in release bundles; events validated against catalog |
| A7 Networking | — | — | ⬜ | Two-client replay golden passes; SP bundles have no netcode |
| A8 CLI + 1.0 | — | — | ⬜ | Scaffolded UI preview/focused testing workflow; `update-game` migrates example from 0.x to 1.0 |
| A9 Store & Season Pass | — | — | ⬜ | Entitlement replays reproduce; late grants; lapsed sub keeps progress |
| B1 Character pipeline | **to write** | — | ⬜ | Rig/animation/export/content and measured asset-budget validation |
| B2 Environment pipeline | **to write** | — | ⬜ | Map compiler outputs render geometry, colliders, spawn anchors and lighting data |
| 3D game | **future reviewed game design** | — | ⬜ | Playable game using A/B; actual gameplay, asset, responsive UI, runtime and test evidence |
| C Modular extraction | **selected after game evidence** | — | ⬜ | Justified modules extracted from FloorFifty and the 3D game, with reviewed contracts and verified consumer adoption |

---

## 3.1 Required phase-spec and implementation-plan detail

The reference is **Ruken's `docs/superpowers/` planning**, particularly P1's protocol catalog, P5's ordered runtime flows and P9's component/state inventory. Repo configuration changes are not implied by this reference.

Write all remaining A/B phase specs during the current specification pass, then audit their shared contracts together. After written-spec review, write each implementation plan just before executing its phase. Preserve existing detailed A0/A1 work; reconcile demonstrated gaps rather than rebuilding it. The 3D game gets a separate reviewed design before its implementation plans. C module specs follow an evidence audit of FloorFifty and that game; they are not prerequisites for the A/B spec gate. A drafted spec is not an executable plan or a completion claim.

| Phase spec must define | Concrete detail required before writing its plan |
|---|---|
| Goal and boundaries | Observable resulting behavior, included deliverables, exclusions and exact prerequisite artifacts |
| Ownership | Which package/manager/port owns each state; allowed writers; sim versus presentation/host responsibilities |
| Contracts | Named types/functions, inputs/outputs, schemas, units, ordering, version/compatibility behavior and the downstream consumer |
| Data and lifecycle flow | Ordered boot/update/transition/shutdown steps, readiness gates, disposal and restart behavior |
| Failure policy | Invalid inputs, timeout/cancellation, unavailable capability, partial failure and recovery; identify what state is preserved |
| UI inventory | Components and screens, supported states, composition rules, input/focus behavior and host-aware actions |
| Responsive behavior | Container/usable-height policy, orientation changes, safe areas, keyboard/browser bars, host-reserved geometry, long text and UI scaling |
| Test allocation | Cases assigned to unit, DOM behavior, real-browser layout, parity, GPU, integration and real-device gates; fixtures versus real journeys explicit |
| Feedback workflow | Focused selection, setup/build reuse, readiness signals, evidence/reporting and measured timing/queue budgets where infrastructure is involved |
| Exit criteria | Named success and failure cases, required evidence, unresolved dependencies and separate Owner acceptance where applicable |
| Decisions | Chosen approach and reason; open questions resolved before they affect implementation; changes to upstream contracts recorded explicitly |

Every implementation plan then includes global constraints and review risks; exact create/modify/test files and responsibilities; consumed/produced interfaces per task; independently reviewable deliverables; failing tests and expected failure; minimal implementation steps; passing-test commands and expected outcomes; and integration/exit checks. Checkboxes advance only with the required evidence. Do not use historical test totals or copied plan outputs as current verification.

**UI example of sufficient detail:** an ActionBar spec names primary/secondary/utility states, label-collapse and wrap priority, target-size floors, disabled/processing behavior, keyboard/controller focus, compact-landscape behavior and the corresponding layout/interaction cases. Its plan names the component/model/test files, defines their interfaces and includes a failing 780×270 reachability test. “Make the action bar responsive” is not an executable task.

**Testing example of sufficient detail:** a focused layout run specifies how it mounts production components/styles without a renderer/server, selects screen/state/viewport, waits for fonts/layout readiness, detects covered or clipped controls and reports reproduction evidence. A full journey separately proves production boot/navigation. A screenshot alone does not prove hit testing, and a fixture alone does not prove integration.

---

## 4. A1 in detail (the current phase)

### 4.1 A1 exit criteria → who satisfies them

| # | A1 exit criterion (A0+A1 spec §8) | Satisfied by | Status |
|---|---|---|---|
| 1 | Spike verdicts committed, `spikes/` deleted, ECS ADR | A0 | ✅ |
| 2 | sim, content, testing, check-boundaries, check-style build; CI publishes `0.0.x` to GitHub Packages | A1a (sim, checkers) + A1b (content) + A1c (testing, builds, publish) | 🟡 |
| 3 | `blank-game` sim + replay goldens identical in Node/Chromium/WebKit/Firefox | A1c | ⬜ |
| 4 | Property test ≥200 seeds: snapshot→restore→continue == uninterrupted | A1c (A1a has the fixture and a restore parity test, not the 200-seed property test) | ⬜ |
| 5 | Every check rule has a rejecting fixture | A1a | ✅ |
| 6 | Content errors report `file:line:col`; dangling ref fails compile | A1b | ⬜ |
| 7 | Injected divergence → `replayGolden` reports first divergent tick + exact field | A1c | ⬜ |
| 8 | Hosted CI under 10 minutes | A1a (done, ~1.5 min) + A1c pipeline (must stay under) | 🟡 |

### 4.2 A1b: physics plugins + `@mcthaydt/automata-content`

Spec: A0+A1 §4.5, §4.6 (section 6), §5, §11 (Rapier notes).

**WP-1b.1 Physics plugins** (`packages/sim`, subpath exports `./physics-2d`, `./physics-3d`)
- [ ] Add the Rapier `-deterministic-compat` 0.21 builds (2D and 3D) as dependencies; confirm they are on the `check-boundaries` import allowlist.
- [ ] Lazy-load the wasm inside the plugin (`createSim` is already async).
- [ ] Components: `RigidBody` (kind, linear/angular damping), `Collider` (shape, size, sensor, groups), `Transform2D` / `Transform3D` (render rows).
- [ ] Systems: `physics.syncIn` (prePhysics), `physics.step` (physics), `physics.syncOut` + `physics.events` (postPhysics). Contact/sensor events emitted in a deterministic order.
- [ ] Snapshot **section 6**: per world, Rapier `takeSnapshot()` bytes verbatim; restore rebuilds the world; hash covers the bytes.
- [ ] Parity tests (`*.parity.test.ts`) in 4 engines: stepping, snapshot round-trip, restore-and-continue.
- [ ] Measure and record wasm size and ms/tick at the S1 workload; add to the spec's notes.

**WP-1b.2 Content compiler** (`packages/content`, new)
- [ ] Scaffold package (same tsconfig/vitest shape as sim; not under `check-boundaries`, it runs at build time).
- [ ] `defineContentSchema(kind, zodSchema, { folder })` and `contentRef(kind)`.
- [ ] Pipeline: discover `content/<folder>/**/*.toml` → smol-toml parse with positions → Zod 4 validate → resolve refs → canonicalize (sorted keys, collections by ID) → emit.
- [ ] Outputs: `content.json`, `content.hash` (XXH64 — reuse sim's implementation so hashes agree), `content.d.ts` (typed accessors).
- [ ] Errors: collect all, report `file:line:col  <zod path>  <message>`, non-zero exit.
- [ ] `tuning.toml` `{ value, min, max, step }` range check + emitted metadata (for A6 sliders).
- [ ] `defineContentGenerator(name, fn)` hook only (real generators come later).
- [ ] Vite plugin `automataContent()` exposing `virtual:automata/content` (watch mode; HMR restart is A2).

**WP-1b.3 Wire content into the sim**
- [ ] `SimOptions.content` is `unknown` today: give it the compiled-content type, deep-freeze it, and make the snapshot header's `contentHash` the compiler's hash. Restore with a different content hash throws `SnapshotMismatchError`.

**Resolve during SPEC-01 before the A1b plan:** where the canonical XXH64 lives so both packages share it without content depending on sim's internals (a shared subpath export is the simplest); event ordering for Rapier contacts.

### 4.3 A1c: `@mcthaydt/automata-testing`, `examples/blank-game`, builds and release

Spec: A0+A1 §3.2, §3.4, §6, §7.

**WP-1c.1 Golden harnesses** (`packages/testing`)
- [ ] `simGolden({ name, plugins, content, seed, script, ticks, every })` → `__goldens__/<name>.golden.json`; `AUTOMATA_UPDATE_GOLDENS=1` rewrites.
- [ ] `.replay` binary format v1 (header: seed, tickHz, schemaHash, contentHash, framework version; per-tick commands; checkpoint hashes + final hash) and `recordReplay`.
- [ ] `replayGolden(file, plugins, content)`: checkpoint verification, **first-divergent-tick bisection**, structural snapshot diff (`component velocity.x on entity 17: 1.25 ≠ 1.2500001`).
- [ ] A deliberately divergent fixture proving the diff (exit #7).
- [ ] The ≥200-seed snapshot/restore property test (exit #4).
- [ ] Cross-engine runner: the golden suites in Node + Vitest browser mode × 3; any engine mismatch fails.

**WP-1c.2 `examples/blank-game`**
- [ ] Scenes `bounce3d` (physics3d, 20 bodies, a `Move`-driven player) and `bounce2d`.
- [ ] Content: `tuning.toml` (gravity, impulse) + a `bodies/*.toml` schema with references.
- [ ] Committed: one `simGolden` + one `.replay` per scene.
- [ ] Imports packages only through public `exports`.

**WP-1c.3 Build, version, publish**
- [ ] Vite library mode → ESM + `.d.ts`; switch `exports` from `src/*.ts` to `dist/`.
- [ ] Changesets; snapshot prerelease `0.0.x` to GitHub Packages as `@mcthaydt/automata-*` on `main`.
- [ ] CI to spec shape: `install` → (lint, typecheck, boundaries, style, unit) → `goldens-node`, `goldens-browsers` → `build` → `publish-prerelease`; under 10 minutes.

**Needs from you:** GitHub Packages publish permissions for the repo (a `GITHUB_TOKEN` with `packages: write` is normally enough) and a read token for future game repos.

---

## 5. A2–A9 work packages

Each needs its own phase spec first. The bullets are the work packages that spec should decompose; the "decide in spec" items are known open questions.

### A2 Skeleton (first missing phase spec in the specification pass)
- **`host`**: the `Hosting` port (init/ready, lifecycle, storage, display metrics, input mode, audio focus, entitlements, `store.purchase`/`store.manage`, `links.open`, capabilities such as Quit/Fullscreen). Adapters: `web`, `ruken` (ported from the S6 stub, recoverable at commit `696b554`, with all its contract tests), and a **mock Ruken host** page. Tauri adapter shape only (built in A3).
- **`runtime`**: the 7-step boot sequence (overview §6); app loop with fixed sim step + variable render + interpolation; **Time** manager (pause modes, timescale, lifecycle/menu pause); **Scene/Flow** manager from `flow.toml` (port FloorFifty `screen-manager.ts`); presentation event bus (mitt, facts only; port FloorFifty `presentation-event-bus.ts`); Nano Store mirrors; content virtual module + restart on change.
- **`render-three`**: WebGPURenderer with forced-WebGL2 fallback, consuming `RenderDelta` (incl. `resync`), one TSL post stack (S3).
- **`render-pixi`**: same contract on Pixi 8; filters as GLSL+WGSL pairs (S4).
- **`ui`**: Svelte 5 + Tailwind + GSAP; splash → menu → blank gameplay → pause → end, credits, quick actions that adapt to `Hosting` capabilities. Establish reusable ScreenFrame, ActionBar and dialog/layout foundations. Define component states and normal/compact composition rules; do not defer all responsive behavior to A4.
- **UI preview/testing**: mount production components/screens with fixture stores and host/display ports, without a renderer or server. Register normal, dense, disabled, loading and error states where applicable. DOM behavior tests prove interactions; real-browser geometry proves layout.
- **Geometry contract**: one owner for layout viewport, usable presentation region and visual occlusion; layout shape stays independent of input mode. Define how later A4 safe-area/host metrics extend it without competing breakpoints.
- **Example**: `blank-game` runs in both renderers.
- **Decide in spec:** the exact `Hosting` interface; interpolation contract (`RenderDelta` carries current state only, so the adapter keeps previous state); the P01 answers (S6 verdict, "Consequences for A2": drop `baseRevision`/`writeId`, `menu.open` → `NOT_READY` before ready, static `pauseBehavior`, `scale` as a hint); whether the real `@ruken/sdk` lands inside A2 or right after.

### A3 Ship pipeline
- Reusable workflows (`game-ci.yml`) so a game's CI is ~5 lines.
- **Linux GPU runner**: self-hosted, ephemeral Docker with GPU passthrough, pinned browsers/drivers, defined in OpenTofu. Verify a **non-black WebGPU capture** there (S3 open item).
- OpenTofu modules: runner, Cloudflare Pages/R2 dev + prod, Neon.
- Visual goldens (screen × renderer × form factor) and E2E (splash → end) on the runner.
- Focused remote selection by spec/screen/state/viewport; print selected and omitted gates. Build once per compatible configuration and identify results by exact artifact/content/runner/browser identity. Unknown affected-test dependencies fall back to broader coverage.
- Measure queue, setup/build and execution time separately; set justified feedback budgets in the A3 spec. Reserve focused-job capacity; tune functional concurrency from measurements and give performance probes exclusive GPU access.
- Failure reports preserve first-attempt errors, reproduction commands, named screen/state/viewport and relevant trace/screenshot/diff. Separate infrastructure failure, focused success and full release acceptance; isolate run-owned resources and retain the complete release gate.
- Ruken packaging: `ruken.toml` generator, zip (≤200 MB, ≤4,000 files, relative paths), gate checks (handshake, no render before ready at 5 s, CSP scan, zip limits, manifest validity, FPS budget).
- Tauri desktop build artifact. Minimal `create-game`. First real prerelease.
- **Needs from you:** GPU box hardware, Cloudflare/Hetzner/Neon accounts and API tokens, domain(s) for dev/prod hosts.

### A4 Input + Display
- Input: keyboard/mouse, gamepad, touch, profiles, rebinding, cursor hiding, touch overlay, gamepad focus nav (port FloorFifty `gamepad-source.ts`, `focus-nav.ts`, `cursor-policy.ts`, gestures).
- Display: responsive layouts (mobile portrait → mobile landscape → desktop landscape → tablet portrait), safe area + `hostReserved` 48×56, UI scale, letterbox (port `letterbox.ts`, AutomataEngine `viewport.ts`), stacking post-process (LCD, film grain, outline, dither, color grading) per adapter, graphics settings, color-blind UI.
- Touch targets ≥44 px (48 primary).
- Complete reusable frames, action bars, dialogs, panels, scroll lists and paged grids. Specify how layout uses container width and usable height, reduces decoration before controls, and preserves selection/focus on resize or rotation.
- Layout contracts cover small portrait, compact landscape (including 780×270), desktop and tablet orientations, breakpoint boundaries, keyboard/browser-bar occlusion, safe areas and host rectangles. Keep primary actions reachable; verify actual hit testing, target dimensions, clipped rows/text, prohibited overlap and intentional scroll containment.
- Validate isolated components and composed screens, then representative production input journeys across both renderers. Fixtures and screenshots do not replace integration or Owner visual acceptance.

### A5 Save + Audio + Localization
- Save: 3 slots, autosave, versioning + migrations, string-encoded through `Hosting` (Ruken limits: strings only, 1 MB/key, 10 MB/game, 256 keys, key regex). Sync status UI. Flush on `session.exiting` then `exitReady`.
- Audio: Web Audio buses, music, SFX, settings; respect `audio.focus`/`audio.master`.
- Paraglide: EN/ES/ZH/KO/PT/JA, dyslexia font; full settings menu.
- Extend the preview/layout matrix with dense settings, long translations, large UI/text scales, audio controls and save checking/syncing/offline/conflict/error states. Define what remains visible and operable under compact height and an open keyboard.
- **Decide in spec:** save encoding format (overview §15), component/state bindings and localization layout cases.

### A6 Debug + Telemetry
- imgui-js panels (state, ECS, perf HUD, toggles) with an overlay registry; stripped from release builds (assert in CI).
- `track()` port, TOML event catalog → Zod + Ruken `[analytics] custom_events`; adapters Ruken / Umami / Faro; consent gating. The sim never calls telemetry.

### A7 Networking (opt-in)
- `net`: protocol, prediction + reconciliation (rollback via snapshot/restore), Colyseus client.
- `server`: Colyseus room running the same sim, input queue + tick scheduler (port FloorFifty server), Prisma/Neon, Hetzner deploy.
- Two-client replay golden; bundle check that SP builds contain no netcode.
- Fast deterministic clock/network harnesses cover server cadence drift, jitter, delayed/duplicate packets, stalls, hidden-tab gaps and reconciliation. Define authority timeline ownership and side-effect suppression during replay; keep wall-clock access outside sim. Representative real two-client journeys verify the production transport separately.

### A8 CLI + 1.0
- Full `create` / `update` / `lock` / `deploy` / `validate` / `doctor`; codemod infrastructure; docs; 1.0 release; `update-game` migrates the example 0.x → 1.0.
- Scaffold focused test commands and screen-fixture registration with documentation of selected versus full gates. A new game inherits independent UI previews, layout assertions and the reusable CI workflow.

### A9 Store & Season Pass
- Grant-once ledger in Save; TOML schema for SKUs, seasons, tiers, XP curve, tracks, rewards; pass progression as sim state; entitlements enter the sim as timestamped commands; pass-track + store UI with `store.manage`; standalone/dev entitlement overrides. Cosmetic rewards unless server-validated (A7).

---

## 6. Part B, the real 3D game and later modular extraction

- **B1 Character pipeline** (can start once A2 lands): Meshy → Blender MCP; rig, animation set, GLB export, budget validator, content TOML. Look: PSP/DS-era low-poly, PS2-Persona proportions, 90s-SNK textures.
- **B2 Environment pipeline:** TrenchBroom-style brushes (Sencha editor as reference); map compiler → GLB, Rapier colliders, spawn anchors, lighting zones as data.

### Real 3D game on A and B

After delivering A/B, design and build a real 3D game using the framework and asset pipelines. Select its concept, playable scope, target devices and acceptance cases in a separate reviewed game spec. Optional framework capabilities are used only when the game needs them. The foundation example is not this milestone.

Implement gameplay systems in the game first, with sim-owned gameplay state, presentation/host ports, shared responsive components and focused test fixtures. Verify real play journeys, assets, deployment and Owner visual/play acceptance separately from automated checks.

### Part C: modular systems from demonstrated game behavior

The former C1–C8 template-port scope is removed. Once the 3D game has accepted playable behavior, audit it alongside FloorFifty (2D) for useful extraction candidates. The module inventory is intentionally undecided until that evidence exists.

For each selected module, document source behavior, consumers, shared versus game-specific responsibilities, dimensional assumptions, public contracts, lifecycle/failure policy and regression evidence before writing its TDD extraction plan. Keep branding and game-specific content/state in the games. Validate actual consumer adoption and applicable 2D/3D cases; do not force every module to serve both dimensions or copy systems solely to fill a catalog. Responsive UI and testing learnings already belong in A and continue through the game and extraction.

---

## 7. External dependencies and things only you can do

| Item | Blocks | Deadline / status |
|---|---|---|
| Send P01 gap list (9 questions) to Ruken | A2 ruken adapter quality | ✅ answered 2026-10-02; verify published P01 after F1 (2026-10-16) |
| Real `@ruken/sdk` after F1 | A2 (swap stub → SDK, re-run contract tests) | After 2026-10-16 |
| GitHub Packages tokens (publish + game-repo read) | A1c publish, every game repo | Needed for A1c |
| Linux GPU machine | A3 visual goldens, E2E, Ruken gates | Needed for A3 |
| Cloudflare, Hetzner, Neon accounts + tokens; domains | A3 (Cloudflare, Neon), A7 (Hetzner, Neon) | Needed for A3 |

---

## 8. Backlog / parking lot

New ideas go here, not into the current phase.

- (empty)
