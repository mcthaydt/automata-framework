# AutomataFramework: living continuation

> Updated 2026-10-11. Source HEAD verified before this update: `398a114` on `main`. This file is a handoff snapshot, not proof of current CI, deployment or acceptance. Agents maintain it at every handoff.

## Prompt for the next agent

Work in the `mcthaydt/automata-framework` checkout. Read `AGENTS.md`, [00 Overview](00-overview.md), the [Ruken-first master spec](superpowers/specs/2026-10-11-automata-framework-ruken-first-design.md), the [extraction map](superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md), [01 Decomposition](01-decomposition.md), [02 Master delivery plan](02-master-delivery-plan.md) and this file. The source repositories are `mcthaydt/RukenApp`, `SNEKPRTY/FloorFifty` and `mcthaydt/PixiJS3D_Experiment_001` (The Last Light); re-read them at their current commits before relying on a path in the extraction map.

**Owner direction (2026-10-11):** AF is Ruken first. Core is built from FloorFifty, The Last Light and Ruken; everything else is an opt-in extension. PixiJS renders 2D and 3D. Effect runs everything outside the sim; the sim stays on Koota with no Effect. Handle CI/CD, deployment, mobile UI and the content pipeline early. Roadmap: finish AF on 2D and 2.5D (M8), build a 3D game on AF (GAME-3D), then merge its 3D pieces back (M9). This replaces the 2026-10-05 direction (all A/B specs first, a future 3D game, later "Part C").

## Exact next action

**Current task: M1.0a — Owner review of the Ruken-first restructure.**

1. The Owner reviews the master spec, the extraction map, ADRs 0002–0004 and decisions D-1 to D-5 (master spec §12).
2. Record the outcome in the [02 execution record](02-master-delivery-plan.md#execution-record-and-handoff) and tick M1.0a only on that review.
3. Then **M1.0b**: write the M1 milestone spec (`docs/superpowers/specs/<date>-m1-blank-game-on-ruken-design.md`) at the detail in [01 Decomposition §5](01-decomposition.md#5-required-milestone-spec-and-plan-detail). Start by reading Ruken's `packages/sdk`, `packages/sdk-host/src/testing`, `packages/manifest`, `packages/validation` and `tooling/ruken-cli` at their current commit, and FloorFifty's `apps/client/src/ruken/`, `deploy/tools/ruken-pack.ts`, loading and `ui/layout/` code.

Do not write an M1 task plan or product code before M1.0b is reviewed.

## Current artifacts and evidence limits

| Artifact / work | Evidence | What remains |
|---|---|---|
| M0 (A0 spikes, A1a sim core) | Merged PRs #1 and #2; historical CI green 2026-10-02 | Not re-run in hosted CI in this update |
| Ruken-first restructure | This branch's draft PR: new master spec, extraction map, ADRs 0002–0004, docs renamed `001`–`004` → `00`–`03` plus new `04-how-we-build.md`, superseded notes on the 2026-10-01 specs and S3, updated `AGENTS.md` | Owner review (M1.0a) |
| `check-boundaries` fixture `import-effect.ts` | Added on this branch; the existing import allowlist already rejects it, so the test passed on first run (a regression pin for ADR 0003, not a red→green change) | — |
| Checks on `99c853c` | Hosted Actions jobs got no runner (account minutes, likely). Run locally on Node 24.21.0 with Playwright 1.63 browsers: lint, typecheck, boundaries, style pass; unit sim 147, boundaries 21, style 17; parity 165/165 in Chromium, WebKit, Firefox. Owner (2026-10-11): run CI locally. | Re-run locally after each push |
| Source survey | FloorFifty `122a220`, The Last Light `948abe9`, RukenApp `b30d31b`, all read on 2026-10-11 | Re-survey at M1.0b |

## External inputs and unresolved gates

- Ruken packages (`@ruken/sdk`, `@ruken/sdk-host`, `@ruken/manifest`) are unpublished; Ruken gates publication on `NPM_PUBLISH_READY` and its M0.3. AF plans to vendor tarballs (FloorFifty's `vendor/ruken/` pattern) and needs the Owner's OK to do so.
- Ruken's F1 freeze is planned for 2026-10-16; the `contracts-f1` tag did not exist on 2026-10-11. Re-vendor and re-run contract tests after it.
- Ruken has no `[store]` manifest section yet; the `store` extension waits for it.
- `@pixi/3d` is a 0.1.0 beta (D-1). Runner reuse (D-5), standalone hosting (D-4), lint tooling (D-3) and adoption scope (D-2) are open.
- GitHub Packages tokens and hosting accounts are not verified.

## Maintenance checklist

Update this snapshot after a task completes or blocks, after plan changes, after verification and before each handoff:

1. Record the date and the verified source HEAD. Never invent a commit for the update itself.
2. Record completed task IDs, artifacts, PRs or commits and actual evidence, separating drafted, reviewed, implemented, locally verified, CI verified, deployed and Owner accepted.
3. Keep one exact next task, its prerequisites and first concrete action; list Owner decisions separately.
4. Keep incomplete gates unchecked in the master plan and specs.
5. Record unfinished edits and check failures; remove resolved blockers.
6. Verify relative links, task IDs and status consistency.
