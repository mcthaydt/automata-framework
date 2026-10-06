# AutomataFramework: overview

> **Owner direction, 2026-10-05:** complete detailed specs for A and B before the next implementation plan. Follow Ruken's separation of a complete phase-spec inventory from just-in-time implementation plans.

## Read order and document ownership

1. This overview and the [approved master architecture](superpowers/specs/2026-10-01-automata-framework-overview-design.md).
2. [002 Decomposition](002-decomposition.md): phase responsibilities, architectural dependencies and required planning detail.
3. [003 Master delivery plan](003-master-delivery-plan.md): ordered specification and engineering tasks, prerequisites and acceptance gates.
4. [004 Living continuation](004-continuation-prompt.md): current evidence, incomplete work and the exact next action.
5. The relevant phase spec, ADRs/spike verdicts and reviewed implementation plan when one exists.

The dated master and phase specs own architecture and behavior. The numbered documents provide navigation, coverage, order and status; they do not duplicate every contract or turn planned behavior into implemented behavior. The old `docs/superpowers/decomposition.md` is a forwarding reference, not a second tracker. `AGENTS.md` defines the working rules; `CLAUDE.md` imports it.

## Purpose

AutomataFramework makes games mostly content and game logic. Versioned `@mcthaydt/automata-*` packages provide deterministic simulation, compiled content, runtime managers, responsive UI, render adapters, host integration and reusable testing/shipping infrastructure. A game boots and deploys inside Ruken and as a standalone site without copying plumbing between repositories.

The seven laws remain authoritative: only sim changes gameplay state; server owns networked truth; each state has one owner; presentation observes truth; sim has no I/O or wall clock; identical seed/content/ordered inputs reproduce; the host is a port.

## Product and engineering priorities

- **Responsive UI is reusable behavior.** Framework components handle available container size, usable height, orientation, safe areas, host exclusions, browser bars, keyboard occlusion and input focus. Games supply content/theme/composition. Preserve FloorFifty's demonstrated layout and interaction lessons.
- **Fast feedback is part of the framework.** Isolated UI fixtures must not require a renderer, server or full game journey. Focused tests have useful diagnostics and measured queue/setup/execution budgets; full release, parity, GPU and real-device gates remain separate and mandatory where specified.
- **Specs cover the whole system before further implementation.** Define state ownership, public contracts, lifecycles, failure/recovery policy, data schemas, component states, dependencies and concrete acceptance cases across A and B. Audit them together for gaps and incompatible assumptions.
- **Plans follow reviewed contracts.** Write executable TDD plans immediately before their phases are implemented. Preserve completed work and existing plans; reconcile actual source/evidence before treating an unchecked box as missing code.
- **Evidence controls status.** A draft, source file, passing unit test, green CI, deployment and Owner visual acceptance are different facts.

Delivery order is **A + B → real 3D game → C modular extraction**. The previous C1–C8 template-port scope is cut; there is no predetermined replacement module list. The foundation example remains a test fixture and does not satisfy the real-game milestone.

## Current checkpoint

The recorded October 2 checkpoint has A0 and A1a merged. The full A1 foundation remains incomplete: physics/content and testing/example/build/publishing work are still in the remaining inventory. See the decomposition for the historical evidence and refresh it before engineering.

The next task is **SPEC-01: reconcile the existing overview and A0+A1 design**, followed by the 10 missing A/B phase specs, a cross-phase contract audit and written-spec review. Do not start the A1b plan or product implementation before the specification gate in the master delivery plan.

## Scope map

| Part | Scope | Design sources |
|---|---|---|
| A | Foundation, runtime/hosts/renderers/UI, shipping, input/display, save/audio/localization, debug/telemetry, networking, CLI/release and store | Master architecture §§4–12; A0+A1 design; spike verdicts |
| B | Character and environment asset pipelines | Master architecture §12; actual source art/editor contracts and asset validation |
| 3D game | A real game built using A and B; game-specific systems remain in the game initially | A separate reviewed game design, followed by TDD plans and playable acceptance evidence |
| C (later) | Modular systems extracted from FloorFifty (2D) and the 3D game after their behavior and reuse needs are demonstrated | Actual game source, tests and runtime evidence; module specs selected after the game |

External Ruken contracts must be read from the current Ruken specs and reconciled with the [S6 answers](spikes/s6-ruken-stub.md). Ruken's staged delivery affects available host capabilities, not ownership of gameplay. Account approvals, SDK publication, GPU hardware and deployment inputs remain explicit dependencies; do not infer readiness from a planned date.
