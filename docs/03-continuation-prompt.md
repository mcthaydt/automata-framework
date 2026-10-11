# AutomataFramework: living continuation

> Updated 2026-10-11. Source HEAD verified before this update: `398a114` on `main`. This file is a handoff snapshot, not proof of current CI, deployment or acceptance. Agents maintain it at every handoff.

## Prompt for the next agent

Work in the `mcthaydt/automata-framework` checkout. Read `AGENTS.md`, [00 Overview](00-overview.md), the [Ruken-first master spec](superpowers/specs/2026-10-11-automata-framework-ruken-first-design.md), the [extraction map](superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md), [01 Decomposition](01-decomposition.md), [02 Master delivery plan](02-master-delivery-plan.md) and this file. The source repositories are `mcthaydt/RukenApp`, `SNEKPRTY/FloorFifty` and `mcthaydt/PixiJS3D_Experiment_001` (The Last Light); re-read them at their current commits before relying on a path in the extraction map.

**Owner direction (2026-10-11):** AF is Ruken first. Core is built from FloorFifty, The Last Light and Ruken; everything else is an opt-in extension. PixiJS renders 2D and 3D. Effect runs everything outside the sim; the sim stays on Koota with no Effect. Handle CI/CD, deployment, mobile UI and the content pipeline early. Roadmap: finish AF on 2D and 2.5D (M8), build a 3D game on AF (GAME-3D), then merge its 3D pieces back (M9). This replaces the 2026-10-05 direction (all A/B specs first, a future 3D game, later "Part C").

## Exact next action

**Current task: M1.0a — Owner review of the Ruken-first restructure.**

1. The Owner reviews the master spec, the extraction map, ADRs 0002–0004 and decisions D-1 to D-6 (master spec §12).
2. Record the outcome in the [02 execution record](02-master-delivery-plan.md#execution-record-and-handoff) and tick M1.0a only on that review.
3. **M1.0b** runs per lane: each lane's first commit is its task spec, built against the [M1 shared contracts](superpowers/specs/2026-10-11-m1-shared-contracts-design.md). The integration owner checks the lane specs against each other and against the audits in the project's `audits/` folder.

**Parallel lanes (Owner, 2026-10-11):** work now runs in lanes ([04 How we build](04-how-we-build.md#lanes-2026-10-11)): ship (M1.1–M1.2), content (M1.3), host (M1.4), ui (M1.6) and sim (M2.1) in parallel, then runtime (M1.5, M1.7) after host and ui merge. Each lane writes its task spec first and is reviewed in its own PR. Decisions D-1 to D-6 run on their recommended defaults (master spec §12) until the Owner overrides them.

## Current artifacts and evidence limits

| Artifact / work | Evidence | What remains |
|---|---|---|
| M0 (A0 spikes, A1a sim core) | Merged PRs #1 and #2; historical CI green 2026-10-02 | Not re-run in hosted CI in this update |
| Ruken-first restructure | This branch's draft PR: new master spec, extraction map, ADRs 0002–0004, docs renamed `001`–`004` → `00`–`03` plus new `04-how-we-build.md`, superseded notes on the 2026-10-01 specs and S3, updated `AGENTS.md` | Owner review (M1.0a) |
| `check-boundaries` fixture `import-effect.ts` | Added on this branch; the existing import allowlist already rejects it, so the test passed on first run (a regression pin for ADR 0003, not a red→green change) | — |
| Checks on `99c853c` | Hosted Actions jobs got no runner (account minutes, likely). Run locally on Node 24.21.0 with Playwright 1.63 browsers: lint, typecheck, boundaries, style pass; unit sim 147, boundaries 21, style 17; parity 165/165 in Chromium, WebKit, Firefox. Owner (2026-10-11): run CI locally. | Re-run locally after each push |
| Audit fixes | Ruken tarballs vendored (D-6); `@mcthaydt/automata-sim/hash` export (test written first, failed on the missing export, then passed); [M1 shared contracts](superpowers/specs/2026-10-11-m1-shared-contracts-design.md) drafted; physics as a `physics` extension; S8 in M1.1; determinism check for every sim-plugin package and `game-ci.yml` | Owner review with M1.0a |
| Audit round 3 (plan vs sources) | Checker hardened: the `Function` constructor reached through `.constructor`, computed and template-literal keys, `WeakRef`/`FinalizationRegistry`/`Atomics`/`SharedArrayBuffer`, `.mts`/`.cts`/`.js` files, and relative imports leaving the root (8 new tests, red then green). Docs: Ruken limits no longer copied; the in-frame handshake falls back as the SDK does and is reported; one `Hosting` layer over the SDK; WebGL2 default; no-eval entry in core; content extracted from FloorFifty's compiler; ship relies on `ruken publish`; `render-pixi3d` unpublished (D-1 provisional); recorded single-game core exceptions; missed modules mapped | Owner review with M1.0a |
| Examples convention | Owner, 2026-10-11: a character-in-a-room base per dimension and a raylib-style demo per feature ([`examples/README.md`](../examples/README.md)); `base-2d` in M1.8, `base-25d` and `base-3d` in M3 | Bases and demos |
| Art direction | Owner, 2026-10-11: Endesga 64 palette ([docs/art](art/README.md), file kept verbatim, 64 unique colors checked) and a Bubble Bobble × Celeste look for 2D, 2.5D and 3D | Palette schema (M1.3), theme tokens (M1.6), LUT and palette gate (M3) |
| Source survey | FloorFifty `122a220`, The Last Light `948abe9`, RukenApp `b30d31b`, all read on 2026-10-11 | Re-survey at M1.0b |

## External inputs and unresolved gates

- Ruken packages (`@ruken/sdk`, `@ruken/sdk-host`, `@ruken/manifest`) are unpublished; Ruken gates publication on `NPM_PUBLISH_READY` and its M0.3. AF vendors them in `vendor/ruken/` at RukenApp `b30d31b` (D-6); the integration owner re-vendors.
- Request to Ruken: the SDK at `b30d31b` still sends `baseRevision` and `writeId` on `saves.set`/`saves.remove` (Ruken `packages/protocol/src/meta/types.ts` lines 94–100). AF does not use them; whether they stay is Ruken's call.
- Request to Ruken: without the `saves` grant the SDK's `storage.setItem` writes to memory and sends nothing (`packages/sdk/src/saves-storage.ts`), contradicting Ruken's S6 answer 3. AF pins the current behavior in host tests and adds no gate.
- Request to Ruken: `menu.open` before `session.ready` is not refused with `NOT_READY`; the SDK calls the game's handler. AF guards it in `Hosting`.
- Request to Ruken: publish `@ruken/cli` (it already has `publishConfig`) so `ship publish` need not vendor it.
- What counts as green (Owner, 2026-10-11): a full local CI run (Node 24, `pnpm check`, parity in Chromium, WebKit and Firefox) is the gate while hosted Actions get no runner. PR #4 is green by that rule on `e34203a`; the lanes may restart. Wiring a self-hosted runner stays under D-5.
- Ruken's F1 freeze is planned for 2026-10-16; the `contracts-f1` tag did not exist on 2026-10-11. Re-vendor and re-run contract tests after it.
- Ruken has no `[store]` manifest section yet; the `store` extension waits for it.
- `@pixi/3d` is a 0.1.0 beta whose terms (per The Last Light's README) allow no public deployment. D-1 is provisional: `render-pixi3d` stays unpublished and out of public builds. D-1 to D-6 run on their defaults (master spec §12) until the Owner overrides them.
- `@mcthaydt/automata-host` (and `testing`) cannot be published while they depend on a local Ruken tarball; D-8 (default: bundle the vendored Ruken code into their `dist/`) must be settled before M2.4.
- Spike S8 (Effect's phone cost) has not run yet although `host` is now built on Effect; the ship lane runs it in M1.1, before the runtime lane starts.
- Ruken's TEST environment is not provisioned; M1 publishes to Ruken's local stack only.
- GitHub Packages tokens and hosting accounts are not verified.

## Maintenance checklist

Update this snapshot after a task completes or blocks, after plan changes, after verification and before each handoff:

1. Record the date and the verified source HEAD. Never invent a commit for the update itself.
2. Record completed task IDs, artifacts, PRs or commits and actual evidence, separating drafted, reviewed, implemented, locally verified, CI verified, deployed and Owner accepted.
3. Keep one exact next task, its prerequisites and first concrete action; list Owner decisions separately.
4. Keep incomplete gates unchecked in the master plan and specs.
5. Record unfinished edits and check failures; remove resolved blockers.
6. Verify relative links, task IDs and status consistency.
