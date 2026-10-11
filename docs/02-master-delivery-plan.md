# AutomataFramework: master delivery plan

> **Direction (Owner, 2026-10-11):** Ruken first; core from FloorFifty, The Last Light and Ruken, everything else as extensions; PixiJS for 2D and 3D; Effect outside the sim, Koota inside; CI/CD, deployment, mobile UI and the content compiler early. Read [03 Continuation](03-continuation-prompt.md) before choosing work.

## How to use this plan

This is the only task list. Every piece of work has a task ID; if it is not here, nobody builds it. Read [00 Overview](00-overview.md) and [01 Decomposition](01-decomposition.md) first. Dated specs own contracts; this plan owns order. A row here is not an executable TDD plan.

Each milestone starts with its spec (`docs/superpowers/specs/YYYY-MM-DD-<slug>-design.md`), reviewed by the Owner; that review freezes the milestone's contracts, after which changes are additive or go through a written change request. Each task then gets a just-in-time TDD plan in `docs/superpowers/plans/` before code. A row is ticked only with its evidence recorded in the execution record below. Gates are reported separately: implemented, locally verified, CI verified, deployed, Owner accepted.

## M0 Foundation (done)

| Done | Task | Evidence |
|---|---|---|
| [x] | M0.1 — Spikes S1–S6 and ADR 0001 (was A0) | PR #1; [spike verdicts](spikes/README.md). S3 is historical since ADR 0002. |
| [x] | M0.2 — Sim core (was A1a) | PR #2, merged 2026-10-02; CI green in Node, Chromium, WebKit and Firefox (historical; not re-run on 2026-10-11) |

## M1 Blank game on Ruken

| Done | Task | Prerequisite and deliverable |
|---|---|---|
| [ ] | M1.0a — Owner review of the Ruken-first restructure | The [master spec](superpowers/specs/2026-10-11-automata-framework-ruken-first-design.md), [extraction map](superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md), ADRs [0002](adr/0002-pixi-for-2d-and-3d.md)–[0004](adr/0004-ruken-first-host.md) and decisions D-1 to D-6 (running on their recommended defaults since 2026-10-11, master spec §12). Drafted 2026-10-11; not yet reviewed. Work proceeds in parallel lanes meanwhile (Owner, 2026-10-11). |
| [ ] | M1.0b — M1 contracts, written per lane | Split by lane ([04 How we build](04-how-we-build.md#lanes-2026-10-11)) so lanes run in parallel: each lane's first commit is its task spec (`docs/superpowers/specs/2026-10-11-m1-<lane>-design.md`) at the [01 Decomposition §5](01-decomposition.md#5-required-milestone-spec-and-plan-detail) level, reviewed by the Owner in that lane's PR. The integration owner (the PR #4 thread) checks the lane specs against each other. The shared contracts (`Hosting` and `HostError`, `defineExtension`, `BootError` and its UI states) are drafted in the [M1 shared contracts spec](superpowers/specs/2026-10-11-m1-shared-contracts-design.md) (2026-10-11, Owner review pending). |
| [ ] | M1.1 — Toolchain, versions and CI lanes | Lane **ship**. Versions aligned with Ruken and pinned by a test; Effect added; spike S8 on the placeholder sets the Effect bundle and boot budgets; hosted lanes and reused browser runners; per-checkout ports, focused `test:remote`; deliberate version differences from Ruken recorded. |
| [ ] | M1.2 — Ship skeleton | Lane **ship**; M1.1. Reusable `game-ci.yml` (runs `check-boundaries` on the game's sim sources) and release workflow; `ship prepare` (generated `ruken.toml` checked by `parseManifest`) and `ship publish` (hands `dist/` to `ruken publish`, which packs and validates) to Ruken's local stack; standalone dev host per build with Ruken's `compileHeaders` CSP. Proven with a placeholder page that completes the Ruken handshake. |
| [ ] | M1.3 — Content compiler | Lane **content**. `@mcthaydt/automata-content` extracted from FloorFifty's `packages/content` and its tests (A0+A1 spec §5 fills gaps), plus Ruken manifest, locale-key, flow and preload generators; Effect for files and errors. |
| [ ] | M1.4 — Host | Lane **host**. `Hosting` service over the Ruken SDK's hosted and standalone sessions (shared contracts §1), fake-host test layer, ported FloorFifty and S6 contract tests, `track()`. |
| [ ] | M1.5 — Runtime | Lane **runtime**, started after **host** and **ui** merge; within the S8 budgets. `defineExtension`, boot program with `BootError`, loading rules, app loop, Time, Flow, presentation bus, settings. |
| [ ] | M1.6 — Mobile-first UI primitives | Lane **ui**. Geometry owner and primitives with renderer-free fixtures and layout contracts at every reference size, including 780×270. |
| [ ] | M1.7 — 2D renderer | Lane **runtime**; M1.5. `render-pixi` no-eval entry, WebGL2-default init, `RenderDelta` consumer, pixel framebuffer, letterbox, filter helpers. |
| [ ] | M1.8 — Base project, demos, scaffold and M1 exit | M1.2–M1.7. `examples/base-2d` (a character in a room) through the M1.2 pipeline; the demo gallery and the M1 lanes' demos ([`examples/README.md`](../examples/README.md)); minimal `create-game` from `base-2d`; exit evidence: CI green, Ruken-validated zip, published to Ruken local stack and dev host, phone play, nothing rendered before ready. |

## M2 Deterministic core complete

| Done | Task | Prerequisite and deliverable |
|---|---|---|
| [ ] | M2.0 — Write and review the M2 milestone spec | M1.3 (content hash). Reconcile the A0+A1 spec's remaining A1b/A1c design; resolve Rapier contact-event order. The shared XXH64 location is settled: `@mcthaydt/automata-sim/hash` (PR #4). |
| [ ] | M2.1 — Physics plugins | Lane **sim** (its task spec stands in for M2.0's physics part). A new `packages/physics` extension plus a snapshot-section hook in `packages/sim`. Rapier deterministic-compat 2D/3D plugins, snapshot section 6, four-engine parity, measured size and ms/tick. |
| [ ] | M2.2 — Content in the sim | M1.3, M2.0. Typed frozen content; snapshot `contentHash`; mismatch on restore. |
| [ ] | M2.3 — Goldens and replays | M2.1, M2.2. `simGolden`, `.replay` v1, `replayGolden` with first-divergent-tick diff, ≥200-seed property test, cross-engine runner. |
| [ ] | M2.4 — Build and publish | M2.3; GitHub Packages tokens. Library builds, Changesets, `0.0.x` prereleases; CI under 10 minutes. |

## M3 to M8

Each milestone starts with a spec task (`Mn.0`) and is decomposed into tasks when that spec is reviewed. Work packages are in [01 Decomposition §4](01-decomposition.md#4-milestone-work-packages).

| Done | Task | Prerequisite and deliverable |
|---|---|---|
| [ ] | M3.0 — 2.5D and pipelines spec, with spike S7 | M2. Confirm D-1 (provisional: `render-pixi3d` unpublished, private builds only). `examples/base-25d` and `examples/base-3d` (the same character in a room); `render-pixi3d` at 2.5D scope, `post-retro`, `pipelines`, 2.5D character and props pipelines. |
| [ ] | M4.0 — Input and display spec | M1. Complete input paths, display policy, E2E matrix under the fake Ruken host. |
| [ ] | M5.0 — Saves, audio and localization spec | M2, M4. Ruken saves and migrations, audio extensions, six languages. |
| [ ] | M6.0 — Gameplay extensions spec | M2, M3. `sectors`, `nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `feel`, `debug`, `telemetry-extra`, environment pipeline. |
| [ ] | M7.0 — Online and store spec | M2, M5; Ruken `[store]` for `store`. `net`/`server`, `store`, `host-tauri`. |
| [ ] | M8.0 — CLI 1.0 and adoption spec | All before. Decide D-2. Full CLI, 1.0 (AF finished for 2D and 2.5D), FloorFifty and The Last Light adoption slices. |

## After AF 1.0: the 3D game, then the 3D merge

Owner roadmap (2026-10-11): 2D and 2.5D first, then 3D. The 3D pieces come from a working 3D game, the same way the 2D and 2.5D pieces come from FloorFifty and The Last Light.

| Done | Task | Prerequisite and deliverable |
|---|---|---|
| [ ] | GAME-3D.0 — Design and review the 3D game | M8. Concept (a small third-person action-adventure is the current suggestion), playable scope, target devices and acceptance cases in its own repo. |
| [ ] | GAME-3D.1 — Build and accept the 3D game on AF | GAME-3D.0. Playable, deployed on Ruken, Owner-accepted. 3D-only systems live in the game. |
| [ ] | M9.0 — 3D merge spec | GAME-3D.1. Select the proven pieces: full 3D `render-pixi3d`, rigged character and animation pipeline, third-person camera and controller, brush-based environments. |
| [ ] | M10.0 — Website spec (final phase) | M9. The AF site: store for paid extensions (individual and all-access), documentation, the playable demo gallery from `examples/`, and everything else a framework site needs. Decide D-7 (licensing and paid-extension distribution). Owner direction 2026-10-11; nothing is built before this spec. |

## Execution record and handoff

| Date | Task | Artifact | Checks | Review status |
|---|---|---|---|---|
| 2026-10-11 | Restructure (input to M1.0a) | This branch: Ruken-first master spec, extraction map, ADRs 0002–0004, numbered docs renamed to `00`–`04` and rewritten, superseded notes on the 2026-10-01 specs and spike S3, `AGENTS.md`, and a `check-boundaries` fixture pinning "no Effect in the sim" | `pnpm check` and relative-link check on this branch (see the PR) | Draft; M1.0a not ticked until the Owner reviews |
| 2026-10-11 | Audit fixes (input to M1.0a, M1.0b) | Ruken tarballs vendored at RukenApp `b30d31b` (D-6); `@mcthaydt/automata-sim/hash` export with a test; [M1 shared contracts spec](superpowers/specs/2026-10-11-m1-shared-contracts-design.md); physics moved to a `physics` extension; S8 moved to M1.1; determinism check required for every sim-plugin package and in `game-ci.yml` | Local CI (see the PR) | Draft |
| 2026-10-11 | Audit round 3 (input to M1.0a, M1.0b) | `check-boundaries` hardened against the audited bypasses (TDD, 8 new tests); shared contracts §1 follows the SDK's handshake fallback with one adapter; master spec, extraction map, 01, ADRs 0002 and 0004 corrected against Ruken, FloorFifty and The Last Light code | Local CI (see the PR) | Draft |

For each completed task record its ID, PR or commit, the checks that ran and their result, review status and remaining gates. Update this table, the affected spec and [03 Continuation](03-continuation-prompt.md) in the same session.
