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
| [ ] | M1.0a — Owner review of the Ruken-first restructure | The [master spec](superpowers/specs/2026-10-11-automata-framework-ruken-first-design.md), [extraction map](superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md), ADRs [0002](adr/0002-pixi-for-2d-and-3d.md)–[0004](adr/0004-ruken-first-host.md) and decisions D-1 to D-5. Drafted 2026-10-11; not yet reviewed. |
| [ ] | M1.0b — Write and review the M1 milestone spec | M1.0a. `m1-blank-game-on-ruken`: contracts for `Hosting`, the boot program and its errors, Flow, Time, the presentation bus, the `RenderDelta` consumer, the geometry owner and UI primitives, `content` outputs, `defineExtension`, the reusable workflows and the pack/publish flow, at the [01 Decomposition §5](01-decomposition.md#5-required-milestone-spec-and-plan-detail) level. Resolves D-3, D-4, D-5. Re-read Ruken's packages at their current commit first. |
| [ ] | M1.1 — Toolchain, versions and CI lanes | M1.0b. Versions aligned with Ruken and pinned by a test; Effect added; hosted lanes and reused browser runners; per-checkout ports, focused `test:remote`, evidence capture/promotion. |
| [ ] | M1.2 — Ship skeleton | M1.1; vendored Ruken packages. Reusable `game-ci.yml` and release workflow; generated `ruken.toml` checked by `@ruken/manifest` and Ruken's validation rules; zip; `ruken publish` to Ruken's local stack and TEST; standalone dev host per build. Proven with a placeholder page that completes the Ruken handshake. |
| [ ] | M1.3 — Content compiler | M1.0b. `@mcthaydt/automata-content` per the A0+A1 spec §5 plus Ruken manifest, locale-key, flow and preload generators; Effect for files and errors. |
| [ ] | M1.4 — Host | M1.0b; vendored Ruken packages. `Hosting` service, Ruken and web adapters, fake-host test layer, ported FloorFifty and S6 contract tests, `track()`. |
| [ ] | M1.5 — Runtime | M1.4; spike S8 verdict. Boot program, loading rules, app loop, Time, Flow, presentation bus, settings. |
| [ ] | M1.6 — Mobile-first UI primitives | M1.0b. Geometry owner and primitives with renderer-free fixtures and layout contracts at every reference size, including 780×270. |
| [ ] | M1.7 — 2D renderer | M1.5. `render-pixi` init, `RenderDelta` consumer, pixel framebuffer, letterbox, filter helpers. |
| [ ] | M1.8 — Example, scaffold and M1 exit | M1.2–M1.7. `examples/blank-game` through the M1.2 pipeline; minimal `create-game`; exit evidence: CI green, Ruken-validated zip, published to Ruken local stack and dev host, phone play, nothing rendered before ready. |

## M2 Deterministic core complete

| Done | Task | Prerequisite and deliverable |
|---|---|---|
| [ ] | M2.0 — Write and review the M2 milestone spec | M1.3 (content hash). Reconcile the A0+A1 spec's remaining A1b/A1c design; resolve the shared XXH64 location and Rapier contact-event order. |
| [ ] | M2.1 — Physics plugins | M2.0. Rapier 2D/3D plugins, snapshot section 6, four-engine parity, measured size and ms/tick. |
| [ ] | M2.2 — Content in the sim | M1.3, M2.0. Typed frozen content; snapshot `contentHash`; mismatch on restore. |
| [ ] | M2.3 — Goldens and replays | M2.1, M2.2. `simGolden`, `.replay` v1, `replayGolden` with first-divergent-tick diff, ≥200-seed property test, cross-engine runner. |
| [ ] | M2.4 — Build and publish | M2.3; GitHub Packages tokens. Library builds, Changesets, `0.0.x` prereleases; CI under 10 minutes. |

## M3 to M8

Each milestone starts with a spec task (`Mn.0`) and is decomposed into tasks when that spec is reviewed. Work packages are in [01 Decomposition §4](01-decomposition.md#4-milestone-work-packages).

| Done | Task | Prerequisite and deliverable |
|---|---|---|
| [ ] | M3.0 — 3D and pipelines spec, with spike S7 | M2. Decide D-1. `render-pixi3d`, `post-retro`, `pipelines`, character pipeline. |
| [ ] | M4.0 — Input and display spec | M1. Complete input paths, display policy, E2E matrix under the fake Ruken host. |
| [ ] | M5.0 — Saves, audio and localization spec | M2, M4. Ruken saves and migrations, audio extensions, six languages. |
| [ ] | M6.0 — Gameplay extensions spec | M2, M3. `sectors`, `nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `feel`, `debug`, `telemetry-extra`, environment pipeline. |
| [ ] | M7.0 — Online and store spec | M2, M5; Ruken `[store]` for `store`. `net`/`server`, `store`, `host-tauri`. |
| [ ] | M8.0 — CLI 1.0 and adoption spec | All before. Decide D-2. Full CLI, 1.0, FloorFifty and The Last Light adoption slices. |

## Execution record and handoff

| Date | Task | Artifact | Checks | Review status |
|---|---|---|---|---|
| 2026-10-11 | Restructure (input to M1.0a) | This branch: Ruken-first master spec, extraction map, ADRs 0002–0004, numbered docs renamed to `00`–`04` and rewritten, superseded notes on the 2026-10-01 specs and spike S3, `AGENTS.md`, and a `check-boundaries` fixture pinning "no Effect in the sim" | `pnpm check` and relative-link check on this branch (see the PR) | Draft; M1.0a not ticked until the Owner reviews |

For each completed task record its ID, PR or commit, the checks that ran and their result, review status and remaining gates. Update this table, the affected spec and [03 Continuation](03-continuation-prompt.md) in the same session.
