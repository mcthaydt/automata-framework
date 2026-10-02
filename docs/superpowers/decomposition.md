# AutomataFramework: Work Decomposition

- **As of:** 2026-10-02
- **Purpose:** One page that says where the project is, what is left, and in what order. It does not replace the specs; it indexes them and breaks every phase into work packages.
- **Source of truth for *what*:** the overview spec (`specs/2026-10-01-automata-framework-overview-design.md`) and the A0+A1 spec (`specs/2026-10-01-a0-a1-spikes-foundation-design.md`, §11–§12 override earlier sections). If this doc and a spec disagree, the spec wins and this doc is stale.
- **Rule of detail:** near phases are broken down to deliverables; far phases stay coarse on purpose ("don't over-specify before there is evidence", overview §13).

---

## 1. Where we are (TL;DR)

```
A0 Spikes ──────────── DONE    merged PR #1 (S1–S6 all pass, Koota confirmed, ADR 0001)
A1 Foundation
  ├─ A1a sim core ──── DONE    merged PR #2 (2026-10-02), CI green in all 4 engines
  ├─ A1b physics + content ─── NOT STARTED (no plan yet)
  └─ A1c testing + example + release ─── NOT STARTED (no plan yet)
A2 … A9, B, C ─────── NOT STARTED (no specs yet)
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

### 2.3 Write and execute the A1b plan, then A1c

The A1a plan calls the next two plans "2b" and "2c". **This doc calls them A1b and A1c**; rename them when the plans are written so file names, branches and PRs line up (`a1b-physics-content`, `a1c-testing-release`).

---

## 3. Phase map and dependencies

```
A0 ─► A1a ─► A1b ─► A1c ─► A2 ─► A3 ─┬─► A4 ─┐
                                     ├─► A5 ─┤
                                     ├─► A6 ─┼─► A8 (1.0)
                                     ├─► A7 ─┤
                                     └─► A9 ─┘   (A9 needs A5 Save; rewards beyond cosmetic need A7)
                               A2 ─► B1, B2 (parallel track)
                          B + A4/A5 ─► C1 ─► C2 ─► C3 … C8
External: Ruken F1 (2026-10-16) ─► A2 host/ruken adapter swaps stub for real @ruken/sdk
```

Per-phase process (unchanged from A0/A1): **phase spec → plan → task-by-task execution with review → PR → merge.** Exit criteria are fixed per phase; new ideas go to a later phase's backlog (§8).

| Phase | Spec | Plan | Status | Exit criterion (abridged) |
|---|---|---|---|---|
| A0 Spikes | A0+A1 spec | A0 plan | ✅ merged | Verdict per spike; ECS decided |
| A1a Sim core | A0+A1 spec | A1a plan | ✅ merged PR #2 | (contributes to A1 exit) |
| A1b Physics + content | A0+A1 spec | **to write** | ⬜ | (contributes to A1 exit) |
| A1c Testing + example + release | A0+A1 spec | **to write** | ⬜ | Same seed+inputs → same hash, in hosted CI, 4 engines |
| A2 Skeleton | **to write** | — | ⬜ | Boots under mock Ruken + standalone; nothing renders before ready |
| A3 Ship pipeline | **to write** | — | ⬜ | `create-game x` + push → dev host + Ruken zip, no manual steps |
| A4 Input + Display | — | — | ⬜ | E2E matrix input devices × form factors passes |
| A5 Save + Audio + i18n | — | — | ⬜ | Save vN loads on vN+1 via migration; every string localized |
| A6 Debug + Telemetry | — | — | ⬜ | No debug code in release bundles; events validated against catalog |
| A7 Networking | — | — | ⬜ | Two-client replay golden passes; SP bundles have no netcode |
| A8 CLI + 1.0 | — | — | ⬜ | `update-game` migrates example from 0.x to 1.0 |
| A9 Store & Season Pass | — | — | ⬜ | Entitlement replays reproduce; late grants; lapsed sub keeps progress |
| B1/B2 Asset pipelines | — | — | ⬜ | (defined in their specs) |
| C1–C8 Gameplay systems | — | — | ⬜ | (defined in their specs) |

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

**Open questions for the A1b plan:** where the canonical XXH64 lives so both packages share it without content depending on sim's internals (a shared subpath export is the simplest); event ordering for Rapier contacts.

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

### A2 Skeleton (next spec to write)
- **`host`**: the `Hosting` port (init/ready, lifecycle, storage, display metrics, input mode, audio focus, entitlements, `store.purchase`/`store.manage`, `links.open`, capabilities such as Quit/Fullscreen). Adapters: `web`, `ruken` (ported from the S6 stub, recoverable at commit `696b554`, with all its contract tests), and a **mock Ruken host** page. Tauri adapter shape only (built in A3).
- **`runtime`**: the 7-step boot sequence (overview §6); app loop with fixed sim step + variable render + interpolation; **Time** manager (pause modes, timescale, lifecycle/menu pause); **Scene/Flow** manager from `flow.toml` (port FloorFifty `screen-manager.ts`); presentation event bus (mitt, facts only; port FloorFifty `presentation-event-bus.ts`); Nano Store mirrors; content virtual module + restart on change.
- **`render-three`**: WebGPURenderer with forced-WebGL2 fallback, consuming `RenderDelta` (incl. `resync`), one TSL post stack (S3).
- **`render-pixi`**: same contract on Pixi 8; filters as GLSL+WGSL pairs (S4).
- **`ui`**: Svelte 5 + Tailwind + GSAP; splash → menu → blank gameplay → pause → end, credits, quick actions that adapt to `Hosting` capabilities.
- **Example**: `blank-game` runs in both renderers.
- **Decide in spec:** the exact `Hosting` interface; interpolation contract (`RenderDelta` carries current state only, so the adapter keeps previous state); the P01 answers (S6 verdict, "Consequences for A2": drop `baseRevision`/`writeId`, `menu.open` → `NOT_READY` before ready, static `pauseBehavior`, `scale` as a hint); whether the real `@ruken/sdk` lands inside A2 or right after.

### A3 Ship pipeline
- Reusable workflows (`game-ci.yml`) so a game's CI is ~5 lines.
- **Linux GPU runner**: self-hosted, ephemeral Docker with GPU passthrough, pinned browsers/drivers, defined in OpenTofu. Verify a **non-black WebGPU capture** there (S3 open item).
- OpenTofu modules: runner, Cloudflare Pages/R2 dev + prod, Neon.
- Visual goldens (screen × renderer × form factor) and E2E (splash → end) on the runner.
- Ruken packaging: `ruken.toml` generator, zip (≤200 MB, ≤4,000 files, relative paths), gate checks (handshake, no render before ready at 5 s, CSP scan, zip limits, manifest validity, FPS budget).
- Tauri desktop build artifact. Minimal `create-game`. First real prerelease.
- **Needs from you:** GPU box hardware, Cloudflare/Hetzner/Neon accounts and API tokens, domain(s) for dev/prod hosts.

### A4 Input + Display
- Input: keyboard/mouse, gamepad, touch, profiles, rebinding, cursor hiding, touch overlay, gamepad focus nav (port FloorFifty `gamepad-source.ts`, `focus-nav.ts`, `cursor-policy.ts`, gestures).
- Display: responsive layouts (mobile portrait → mobile landscape → desktop landscape → tablet portrait), safe area + `hostReserved` 48×56, UI scale, letterbox (port `letterbox.ts`, AutomataEngine `viewport.ts`), stacking post-process (LCD, film grain, outline, dither, color grading) per adapter, graphics settings, color-blind UI.
- Touch targets ≥44 px (48 primary).

### A5 Save + Audio + Localization
- Save: 3 slots, autosave, versioning + migrations, string-encoded through `Hosting` (Ruken limits: strings only, 1 MB/key, 10 MB/game, 256 keys, key regex). Sync status UI. Flush on `session.exiting` then `exitReady`.
- Audio: Web Audio buses, music, SFX, settings; respect `audio.focus`/`audio.master`.
- Paraglide: EN/ES/ZH/KO/PT/JA, dyslexia font; full settings menu.
- **Decide in spec:** save encoding format (overview §15).

### A6 Debug + Telemetry
- imgui-js panels (state, ECS, perf HUD, toggles) with an overlay registry; stripped from release builds (assert in CI).
- `track()` port, TOML event catalog → Zod + Ruken `[analytics] custom_events`; adapters Ruken / Umami / Faro; consent gating. The sim never calls telemetry.

### A7 Networking (opt-in)
- `net`: protocol, prediction + reconciliation (rollback via snapshot/restore), Colyseus client.
- `server`: Colyseus room running the same sim, input queue + tick scheduler (port FloorFifty server), Prisma/Neon, Hetzner deploy.
- Two-client replay golden; bundle check that SP builds contain no netcode.

### A8 CLI + 1.0
- Full `create` / `update` / `lock` / `deploy` / `validate` / `doctor`; codemod infrastructure; docs; 1.0 release; `update-game` migrates the example 0.x → 1.0.

### A9 Store & Season Pass
- Grant-once ledger in Save; TOML schema for SKUs, seasons, tiers, XP curve, tracks, rewards; pass progression as sim state; entitlements enter the sim as timestamped commands; pass-track + store UI with `store.manage`; standalone/dev entitlement overrides. Cosmetic rewards unless server-validated (A7).

---

## 6. Parts B and C (coarse on purpose)

- **B1 Character pipeline** (can start once A2 lands): Meshy → Blender MCP; rig, animation set, GLB export, budget validator, content TOML. Look: PSP/DS-era low-poly, PS2-Persona proportions, 90s-SNK textures.
- **B2 Environment pipeline:** TrenchBroom-style brushes (Sencha editor as reference); map compiler → GLB, Rapier colliders, spawn anchors, lighting zones as data.
- **C1–C8:** ported from automata-template as opt-in `@automata/*` modules, in order: Rule Manager (QB v2) → Objectives + Scene Director → character controller/spawn/vCam → animation + zone lighting → utility BT AI → dialogue/storylets/cutscenes → in-game screens → debug overlays. Start by reading `git show 9d7efa3a:"Hi/2026-05-17-threejs-rust-port-design.md"` in the template repo.

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
