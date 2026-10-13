# AutomataFramework: living continuation

> Updated 2026-10-13. Source HEAD verified before this update: `1ed77cc` on `main`, af-linux CI green at that merge (checks, parity in Chromium, WebKit and Firefox, consumer smoke, base-2d and placeholder game-ci). This file is a handoff snapshot, not proof of current CI, deployment or acceptance. Agents maintain it at every handoff.

## Prompt for the next agent

Work in the `mcthaydt/automata-framework` checkout. Read `AGENTS.md`, [00 Overview](00-overview.md), the [Ruken-first master spec](superpowers/specs/2026-10-11-automata-framework-ruken-first-design.md), the [extraction map](superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md), [01 Decomposition](01-decomposition.md), [02 Master delivery plan](02-master-delivery-plan.md) and this file. The source repositories are `mcthaydt/RukenApp`, `SNEKPRTY/FloorFifty` and `mcthaydt/PixiJS3D_Experiment_001` (The Last Light); re-read them at their current commits before relying on a path in the extraction map.

**Owner direction (2026-10-11):** AF is Ruken first. Core is built from FloorFifty, The Last Light and Ruken; everything else is an opt-in extension. PixiJS renders 2D and 3D. Effect runs everything outside the sim; the sim stays on Koota with no Effect. Handle CI/CD, deployment, mobile UI and the content pipeline early. Roadmap: finish AF on 2D and 2.5D (M8), build a 3D game on AF (GAME-3D), then merge its 3D pieces back (M9). This replaces the 2026-10-05 direction (all A/B specs first, a future 3D game, later "Part C").

## Exact next action

**Current task: finish M1 (the blank game on Ruken).** M2 is closed — its last task, M2.4, merged as PR #19 (`1ed77cc`, 2026-10-13). M1.1–M1.4, M1.6 and the M1.8 base and demos are merged on `main`; what remains:

1. **M1.5 Runtime** — continue from Task 3 of 20 on branch `claude/project-thread-pwjmcz` ([spec](superpowers/specs/2026-10-12-m1-runtime-design.md), [plan](superpowers/plans/2026-10-12-m1-runtime.md)). Its Phases 2–12: the presentation bus, loading and `Assets`, the frame loop, `Time`, settings, the renderer interface, `AppLoop`, page layers, the veil, `Flow`, boot errors, the boot program, `runGame`, `./testing`, the demo and the S8 bench.
2. **M1.7 `render-pixi`** (new, not started) — the `./no-eval` entry, WebGL2-default init, the `RenderDelta` consumer, pixel framebuffer, letterbox and filter helpers. Depends on M1.5.
3. **M1.8 exit** — `create-game`/`cli` scaffold, gallery wiring, and the exit evidence (Ruken-validated zip, publish to the Ruken local stack and dev host, phone play).

**Owner reviews still pending (tick only on the Owner's review):** M1.0a (the Ruken-first restructure) and M2.0 (the M2 milestone spec). Decisions D-1 to D-6 run on their recommended defaults (master spec §12).

**Kept branches:** `claude/project-thread-pwjmcz` (M1.5 runtime — the next action) and `claude/project-thread-z6q9rx` (M3 spec and plan — documentation for upcoming work). Both edit `docs/02`–`04`, so rebase them onto `main` when their work resumes.

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
| `examples/base-2d` (M1.8 part 1) | Draft PR #10 from `claude/af-base-2d-x39a9r`, with `main` merged through #9 (`d556d23`). Local gate green: check, parity in every package, 24 browser journeys across every example, build, prepare-ruken. Audited mergeable by the AF framework audit thread. Restyled as Emberwick (Owner, 2026-10-11). Stand-ins for content, host, runtime loop, renderer and ui ([task spec](superpowers/specs/2026-10-11-m1-base-2d-design.md)) | CI on af-linux for the latest head; move the base onto `HostingLive`, compiled content and the ui primitives (#5, #8, #7 are merged); the host, content and physics demos; gallery, `create-game`, M1 exit |
| Feature demos on `base-2d` (M1.8 part 2) | Draft PR from `claude/af-feature-demos-wsbg60`, stacked on #10: `host/lifecycle-and-saves`, `content/hot-reload`, `physics/bodies-2d`, the shared fake host (`examples/demo-host`), the gallery list, `playRoom` in `base-2d` (`@af-examples/base-2d/play`); `automata-content` serves its virtual module under a query (test first). Audit fixes (2026-10-11): demo checks wait for the host's frame (WebKit race), the physics demo's sim is in `pnpm boundaries` (new `--allow-import`, physics entry points allowlisted) with a golden hash `54bfb33a9790ef21` and a parity test, host demo shows denied and offline saves, room-schema issues carry their row, hot-reload plays only the newest save, `playRoom` resets layers on a room change and cleans up a restart overtaken by `destroy`. Local: unit tests, typecheck, lint, demo browser checks and the bodies parity in Chromium; Rapier's wasm loads under Ruken's CSP; WebKit and Firefox not run here | Rebase when #10 moves; Owner look at the demo screenshots; gallery page; `bodies-3d` with `base-3d` (M3) |
| Koota under Ruken's CSP | Koota's struct-of-arrays traits compile accessors with `new Function`; under Ruken's `script-src` (no `unsafe-eval`) the sim threw `EvalError` in the browser. `packages/sim` now defines traits as factories (array of structs) with a no-eval test; hashes unchanged | Re-check any new trait helper (#9 adds some) against the no-eval test |
| Art direction | Owner, 2026-10-11: Endesga 64 palette ([docs/art](art/README.md), file kept verbatim, 64 unique colors checked) and a Bubble Bobble × Celeste look for 2D, 2.5D and 3D | Palette schema (M1.3), theme tokens (M1.6), LUT and palette gate (M3) |
| M2 specs (M2.0 draft) | [M2 milestone spec](superpowers/specs/2026-10-11-m2-deterministic-core-design.md) and task specs and TDD plans for M2.1b (physics demo), M2.2 (content in the sim), M2.3 (goldens and replays) and M2.4 (build and publish), drafted 2026-10-11 and revised after the PR #12 audit against `main` `d556d23` (#9 merged) and PR #10 `ab4f857`; sources re-read: FloorFifty `122a220` (replay codec), The Last Light `8280918` (record and replay), RukenApp `ccad7c0` (tsdown, Changesets) | Owner review (M2.0); lanes start after it, or now on the Owner's word. Token decision (coordinator, checked against GitHub's docs): releases on `GITHUB_TOKEN`; games on `AF_READ_TOKEN`, a classic PAT with `read:packages` only (the npm registry accepts no fine-grained tokens), which the Owner creates at M2.4 time. Requests to integration: base-2d's `startGame` options, a `./sim` entry, and its room as compiled content (for the M2.1b, M2.3 and M2.2 demos) |
| M2.4 build and publish | **Merged** as PR #19 (`1ed77cc`, 2026-10-13): all nine packages build and pack; audited (approve with changes) and the audit's fixes landed: ui loads in Node and under nodenext types, the consumer smoke pins the workspace pnpm and checks nodenext, the release job runs `pnpm check` before publishing, uses changesets/action v2's input names and keeps no token in `.git/config`, turbo rebuilds when the shared build code changes, outside peers of published packages are `^` ranges floored at the workspace pin (the one range `tooling/versions` allows). `ci:local` and `consumer-smoke --from packs` green locally. Nothing published | **Merged** onto `main`, af-linux CI green at the merge; the Owner merges the "Version packages" PR to publish `0.0.1` (set the Actions spending limit first). `release-packages.yml` stays on `ubuntu-latest` (audit: never on af-linux with a write token); the Owner chose an Actions budget (2026-10-11) and sets the spending limit; no release runs until it is set. Packages say `"license": "UNLICENSED"` (Owner, 2026-10-11, until launch). Every PR that changes a published package now needs a changeset (`docs/04-how-we-build.md`); #15, #17 and #18 need one when they merge `main`. The Owner creates `AF_READ_TOKEN` (classic, `read:packages`) when the first game repository needs it. The `.replay` smoke step and `SIM_VERSION` sync start with M2.3 |
| Source survey | FloorFifty `122a220`, The Last Light `948abe9` (re-read at `8280918` for the M2 specs), RukenApp `b30d31b`, all read on 2026-10-11 | Re-survey at M1.0b |

## External inputs and unresolved gates

- Ruken packages (`@ruken/sdk`, `@ruken/sdk-host`, `@ruken/manifest`) are unpublished; Ruken gates publication on `NPM_PUBLISH_READY` and its M0.3. AF vendors them in `vendor/ruken/` at RukenApp `b30d31b` (D-6); the integration owner re-vendors.
- Request to Ruken: the SDK at `b30d31b` still sends `baseRevision` and `writeId` on `saves.set`/`saves.remove` (Ruken `packages/protocol/src/meta/types.ts` lines 94–100). AF does not use them; whether they stay is Ruken's call.
- Request to Ruken: without the `saves` grant the SDK's `storage.setItem` writes to memory and sends nothing (`packages/sdk/src/saves-storage.ts`), contradicting Ruken's S6 answer 3. AF pins the current behavior in host tests and adds no gate.
- Request to Ruken: `menu.open` before `session.ready` is not refused with `NOT_READY`; the SDK calls the game's handler. AF guards it in `Hosting`.
- Request to Ruken: publish `@ruken/cli` (it already has `publishConfig`) so `ship publish` need not vendor it.
- What counts as green (Owner, 2026-10-11): a full local CI run (Node 24, `pnpm check`, parity in Chromium, WebKit and Firefox) is the gate while hosted Actions get no runner. PR #4 is green by that rule on `e34203a`; the lanes may restart. Once #6 merges, the local run is `pnpm ci:local` (the same jobs as `ci.yml`, kept in step by a workflow test, with parity as the root `pnpm test:parity` across every package with a browsers project) plus `pnpm test:e2e` for the browser journeys, and CI jobs target the self-hosted runner label `af-linux` (D-5); until that runner is registered, local runs stay the gate.
- Parity on af-linux (#16, merged 2026-10-11 as `3795827`): `pnpm test:parity` runs three packages at a time with a 120 s browser connect timeout, because all of #14's eight suites at once left Firefox past vitest's 60 s default on the shared WSL Docker runner. Draft PRs skip the `parity` job, which runs when a PR is marked ready for review and on every push to `main`; while a PR is a draft, run the same gate in a cloud container (`docs/cloud-parity.md`). Hosted Actions minutes are used up, so every `ci.yml` job runs on af-linux. The timeout is not called fixed until #14 passes parity there with #16 merged in.
- Ruken's F1 freeze is planned for 2026-10-16; the `contracts-f1` tag did not exist on 2026-10-11. Re-vendor and re-run contract tests after it.
- Ruken has no `[store]` manifest section yet; the `store` extension waits for it.
- `@pixi/3d` is a 0.1.0 beta whose terms (per The Last Light's README) allow no public deployment. D-1 is provisional: `render-pixi3d` stays unpublished and out of public builds. D-1 to D-6 run on their defaults (master spec §12) until the Owner overrides them.
- `@mcthaydt/automata-host` (and `testing`, `ui`, `content`, `ship`) cannot be published while they depend on a local Ruken tarball; D-8 (bundle the vendored Ruken code into their `dist/` and inline Ruken types into their `.d.ts`) is specified in the [M2.4 spec](superpowers/specs/2026-10-11-m2-build-and-publish-design.md) §3.4.
- Spike S8 gate closed (ship lane, PR #6 `6056f82`, [verdict](spikes/README.md)): Effect costs 28.0 kB gzip and 50–73 ms cold boot at 4×, within the budgets E1–E5 the runtime lane must hold. Still open: measurements on real phones, WebKit throttling, and frame-loop allocation, which the runtime lane checks in M1.5.
- Ruken's TEST environment is not provisioned; M1 publishes to Ruken's local stack only.
- GitHub Packages tokens are decided (M2.4: workflow `GITHUB_TOKEN` to publish; `AF_READ_TOKEN`, a classic PAT with `read:packages`, for games), but not yet created or used. Hosting accounts are not verified.

## Merge notes for the lane PRs

Proposed order, once the Owner approves:
1. #4
2. #6 ship
3. #8 content
4. #5 host
5. #7 ui
6. #9 physics

Each PR rebases on `main` after the one before it merges and re-runs local check plus parity.

- #9 physics appends its pins (`@dimforge/rapier2d-deterministic-compat` and `rapier3d-deterministic-compat` 0.21.0) to `docs/versions.md` once #6 has created that file. Lanes may append rows for their own pins.
- #9 changes the sim golden hash on purpose (`2dfe1971eaf6af8f` → `98cc273719c10ef2`), because the schema hash now covers the resource and command schemas. Before #9 merges, confirm the new hash is identical in Node, Chromium, WebKit and Firefox, then record it in the execution record.
- Done 2026-10-11: #9 merged first (`d556d23`) and was merged into #10 by the audit's steps. `entity-store.ts` keeps the copying `read()` and the factory traits, and a partial `set` merges into the current record (`store.read(e, def)`). The base-2d golden was re-recorded as `31f50888ccb4cf0a` (was `a40a6dbda55f4932`, changed by #9's schema hash), identical in Node, Chromium, WebKit and Firefox. Results: sim 185, physics 69, base-2d 109; parity passes in every package.
- The base-2d PR adds the same `check-boundaries` allowlist lines as #9 (identical text, so the merge is clean or trivially resolved).
- #9 spec §12 defaults: transforms live in `physics`, velocity is on `RigidBody`, and the sim fails closed.

## Maintenance checklist

Update this snapshot after a task completes or blocks, after plan changes, after verification and before each handoff:

1. Record the date and the verified source HEAD. Never invent a commit for the update itself.
2. Record completed task IDs, artifacts, PRs or commits and actual evidence, separating drafted, reviewed, implemented, locally verified, CI verified, deployed and Owner accepted.
3. Keep one exact next task, its prerequisites and first concrete action; list Owner decisions separately.
4. Keep incomplete gates unchecked in the master plan and specs.
5. Record unfinished edits and check failures; remove resolved blockers.
6. Verify relative links, task IDs and status consistency.
