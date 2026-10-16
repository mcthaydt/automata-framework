# AutomataFramework: overview

> **Owner direction, 2026-10-11:** AF is **Ruken first**. Core packages are built from proven code in FloorFifty (2D), The Last Light (the PixiJS 3D experiment) and Ruken itself; everything else is a modular extension. PixiJS renders 2D and 3D. Effect runs everything outside the sim; the sim stays on Koota. CI/CD, deployment, mobile UI and the content compiler come first, in M1. AF is finished on 2D (FloorFifty) and 2.5D (The Last Light); a 3D game is then built on AF and its 3D pieces are merged back. This replaces the 2026-10-05 direction (all A/B specs first, a future 3D game, then "Part C" extraction).

## Read order and document ownership

1. This overview.
2. The [Ruken-first master spec](superpowers/specs/2026-10-11-automata-framework-ruken-first-design.md) and its [extraction map](superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md). The [2026-10-01 master spec](superpowers/specs/2026-10-01-automata-framework-overview-design.md) still owns the laws, state ownership and determinism rules that the new spec does not replace.
3. [01 Decomposition](01-decomposition.md): packages, milestones, dependencies and the old-phase mapping.
4. [02 Master delivery plan](02-master-delivery-plan.md): the only task list, with task IDs.
5. [03 Continuation](03-continuation-prompt.md): current status, blockers and the exact next action.
6. [04 How we build](04-how-we-build.md): how a task flows from spec to merged PR.
7. The milestone's spec, the ADRs (`docs/adr/`), the spike verdicts (`docs/spikes/`) and the task's plan when one exists.

The numbering and roles match Ruken's own `docs/00`–`04`. Dated specs own architecture and behavior; the numbered documents own navigation, order and status. `AGENTS.md` holds the working rules and `CLAUDE.md` imports it.

## Purpose

AutomataFramework makes Ruken games mostly content and game logic. Versioned `@mcthaydt/automata-*` packages provide a deterministic Koota simulation, a content compiler, an Effect-based runtime, a Ruken-first host layer, PixiJS rendering, mobile-first Svelte UI, testing harnesses and the CI/CD and packaging that put a game on Ruken (and on a standalone site) with no per-game plumbing.

The seven laws stand: only the sim changes gameplay state; the server owns networked truth; each state has one owner; presentation observes truth; the sim has no I/O or wall clock; identical seed, content and ordered inputs reproduce; the host is a port, and Ruken is the reference host.

## Decisions in force

| Decision | Record |
|---|---|
| Koota ECS behind the sim facade | [ADR 0001](adr/0001-ecs-choice.md) |
| PixiJS for 2D (core) and 3D (`render-pixi3d` extension on `@pixi/3d`) | [ADR 0002](adr/0002-pixi-for-2d-and-3d.md) |
| Effect for runtime, host, tooling and pipelines; never inside the sim; Zod stays the schema language | [ADR 0003](adr/0003-effect-outside-the-sim.md) |
| Ruken first: consume `@ruken/sdk`, `@ruken/sdk-host`, `@ruken/manifest` and `ruken publish` (which validates); follow Ruken's doc and milestone process | [ADR 0004](adr/0004-ruken-first-host.md) |

Decisions D-1 to D-6 (the `@pixi/3d` beta dependency, adoption scope, lint tooling, standalone hosting, GPU runner, vendored Ruken packages) run on their recommended defaults since 2026-10-11 until the Owner overrides them; see the master spec §12. M1 runs in parallel lanes ([04 How we build](04-how-we-build.md#lanes-2026-10-11)).

## Product and engineering priorities

- **One look.** Endesga 64 palette, Bubble Bobble mixed with Celeste, in 2D, 2.5D and 3D ([art direction](art/README.md), Owner 2026-10-11).

- **Ship to Ruken early.** M1 ends with a blank game built, validated by Ruken's own checks, published to Ruken and playable on a phone. Everything after builds on a working pipeline.
- **Mobile first.** Layout is designed and tested at phone sizes first, with FloorFifty's geometry, target-size and reachability rules. UI tests do not need a renderer, server or full journey.
- **Core is small and proven; extensions are opt-in.** A capability is core only if Ruken requires it of every game or both reference games need it.
- **Fast feedback with honest gates.** Focused runs for iteration; full parity, GPU, release and device gates remain separate and required.
- **Evidence controls status.** Drafted, reviewed, implemented, locally verified, CI verified, deployed and Owner accepted are different facts.

## Current checkpoint

M0 (spikes S1–S6, ADR 0001, the A1a sim core) is merged. Nothing from M1 onward is implemented. M1 runs in parallel lanes, each writing its own task spec against the [M1 shared contracts](superpowers/specs/2026-10-11-m1-shared-contracts-design.md); the Owner review of the Ruken-first restructure (M1.0a) is pending. See [03 Continuation](03-continuation-prompt.md).

## Scope map

| Milestone | Scope |
|---|---|
| M0 Foundation | Spikes, ECS decision, sim core (done) |
| M1 Blank game on Ruken | Toolchain, Effect runtime skeleton, content compiler, host, boot and loading, 2D renderer, mobile UI primitives, CI/CD, packaging, publish, dev host, example, minimal `create-game` |
| M2 Deterministic core complete | Physics, goldens and replays, publishing |
| M3 2.5D and pipelines | `render-pixi3d` at 2.5D scope, `post-retro`, the pipeline platform, 2.5D character and props pipelines |
| M4 Input and display complete | All input paths and display policy, E2E matrix |
| M5 Saves, audio, localization | Ruken saves and migrations, audio extensions, six languages |
| M6 Gameplay extensions | Sectors, nav, puzzle, systems, narrative, cutscenes, feel, debug, environment pipeline |
| M7 Online and store | `net`/`server`, `store`, `host-tauri` |
| M8 CLI 1.0 and adoption | Full CLI, 1.0 (AF finished for 2D and 2.5D), a slice of FloorFifty and The Last Light running on AF |
| GAME-3D | A 3D game built on AF 1.0, in its own repo |
| M9 3D merge | The 3D game's proven pieces merged back into AF |
| M10 Website (final phase) | The AF site: store, documentation, playable demos and everything else a framework site needs |

**Business model (Owner, 2026-10-11; refined 2026-10-16 in the [PRODUCT spec](superpowers/specs/2026-10-16-product-core-and-plus-design.md), PD-1):** Tailwind-style. **Core** is free (MIT, public npm): the raylib-like foundation, built so that whatever is prompted next scales (seams, determinism, enforced checks, localization). **Automata Plus** is paid: every extension (networking, post-processing, feel, music streaming, physics and the rest), copy-in UI and screen kits, and ShipFast-style starter games. FloorFifty is the measure: core plus Plus rebuilds it, content excluded. Extensions stay separate packages with no core file edited by any of them, and move to the private `mcthaydt/automata-plus` repo and registry (PRODUCT.5). Pricing, the store and license enforcement are decided at M10.0 (D-7).

External inputs (Ruken package publication and F1, GitHub Packages tokens, runner capacity, hosting accounts) are tracked in [01 Decomposition](01-decomposition.md) §6; do not infer readiness from a planned date.
