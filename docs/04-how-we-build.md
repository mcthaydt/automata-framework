# How we build AutomataFramework

AF follows Ruken's way of working (Ruken's [`docs/04-how-we-build.md`](https://github.com/mcthaydt/RukenApp/blob/main/docs/04-how-we-build.md)), scaled to one framework repo. `AGENTS.md` has the full rules.

## The short version

- **One plan.** [02 Master delivery plan](02-master-delivery-plan.md) is the only task list. Every piece of work has a task ID (M1.4, M2.3 …).
- **One status page.** [03 Continuation](03-continuation-prompt.md) says what is happening now, what is blocked and what the Owner needs to decide.
- **Specs per milestone.** A milestone starts with its spec. The Owner's review freezes that milestone's contracts; after that they change only additively or through a written change request.
- **Plans per task, just in time.** Each task gets a TDD plan in `docs/superpowers/plans/` before its code.
- **Every change is a pull request** whose title starts with the task ID. Nothing is pushed to `main`.
- **Nothing is done on an agent's word.** Done means tests pass, CI is green, and where the plan says so the Owner has looked and accepted.

## Ruken first

- Ruken's contracts win. AF consumes `@ruken/sdk`, `@ruken/sdk-host`, `@ruken/manifest`, Ruken's validation and `ruken publish` (ADR 0004). When AF needs something Ruken lacks, it goes to Ruken as a request; AF does not extend the protocol itself.
- Version pins follow Ruken's `docs/versions.md`.
- Ruken's milestone IDs (M1, M2 …) and AF's look alike. In AF documents, a bare `M1.4` is AF's; Ruken's are always written "Ruken M1".

## Core and extensions

- Core is what Ruken requires of every game or what both reference games need. Everything else is an extension registered with `defineExtension` (master spec §5).
- An extension never edits a core file; core never imports an extension.
- Extracted code comes from a recorded source commit and brings its source tests with it ([extraction map](superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md)).

## Lanes (2026-10-11)

The Owner asked on 2026-10-11 for work to run in parallel threads. Each lane is one thread on its own branch and worktree, owns the folders below and touches nothing else. The integration owner (the thread that owns PR #4) keeps `docs/00`–`04`, `AGENTS.md`, the master spec, the extraction map and the ADRs true, checks lane specs against each other, and merges in order.

| Lane | Tasks | Owns | Must not touch |
|---|---|---|---|
| **ship** | M1.1, M1.2, M2.4 | `.github/workflows/`, root `package.json`, `turbo.json`, `.nvmrc`, `pnpm-workspace.yaml`, `biome.json`, `lefthook.yml`, `docs/versions.md`, `tooling/versions/`, `packages/ship/`, `packages/node/` (the shared `Files` and `ProcessRunner` Effect services that content and the CLI reuse), (`ship prepare` and `ship publish` over `ruken publish`; no zip or validate step of its own), `examples/placeholder/`; spike S8 (`docs/spikes/s8-effect.md`, measured on the placeholder). From M2.4: `.changeset/`, `tooling/release/`, `tooling/consumer-smoke/`, the rename of `tooling/check-boundaries`, root `playwright.config.ts` (other lanes ask for their journey projects), and in every published package only its build and publish fields ([M2.4 spec](superpowers/specs/2026-10-11-m2-build-and-publish-design.md)) | Any other `packages/*` source; `vendor/ruken/`; numbered docs |
| **content** | M1.3, M2.2 | `packages/content/`, extracted from FloorFifty's `packages/content` with its `tests/content/` suite (hashes through `@mcthaydt/automata-sim/hash`, already exported; includes a palette content schema, see [art direction](art/README.md)). From M2.2: in `packages/sim/`, only `Sim.contentHash`; `examples/sim/content-restore/` | Everything else |
| **host** | M1.4 | `packages/host/` | Everything else; `vendor/ruken/` (consumed, not repacked) |
| **ui** | M1.6 | `packages/ui/` (default theme tokens from Endesga 64, [art direction](art/README.md)), `packages/testing/` (layout assertions and renderer-free fixture mounting only, and the `unit` and `layout` Vitest projects) | Everything else; `packages/testing/src/sim/` (testing lane) |
| **sim** | M2.1, M2.1b | New `packages/physics/` (the physics extension); in `packages/sim/`, only a snapshot-section hook for plugins; in `tooling/check-boundaries`, only the Rapier import entry if it needs one, and `packages/physics/src` added to the root `boundaries` script (the checker already takes several roots and closes the audited bypasses, PR #4). From M2.1b: `examples/physics/`; in `tooling/check-boundaries`, the two physics entries in `IMPORT_ALLOWED` and the `--allow-import` option. It agrees to the testing lane adding `packages/physics/src/snapshot-property.test.ts` | Everything else |
| **testing** | M2.3 | `packages/sim/src/replay/` and the `./replay` export; in `packages/sim/`, `Sim.describeSnapshot` (`world/sim.ts`, `world/snapshot.ts`), the `createRng`/`deriveSeed` exports and `src/version.ts`; `packages/testing/src/sim/`, the `./sim` export and the `sim` and `sim-browsers` Vitest projects; `packages/physics/src/snapshot-property.test.ts`; `examples/testing/` ([M2.3 spec](superpowers/specs/2026-10-11-m2-goldens-and-replays-design.md)) | Everything else; root config and `docs/versions.md` go through ship |
| **game** (DX, 2026-10-16) | DX.2 | New `packages/game/` (`@mcthaydt/automata-game`), `examples/game/` ([DX spec](superpowers/specs/2026-10-16-dx-small-games-ai-native-design.md)) | Every other package's source; changes it needs in `sim`, `render-pixi` or `ui` go to their lanes (DX.1, DX.2b) |
| **runtime** (later) | M1.5, M1.7 | `packages/runtime/`, `packages/render-pixi/` | Starts after **host** and **ui** merge |
| **integration** | M1.0a, M1.0b shared contracts, M1.8, all docs | The numbered docs, specs (including the [M1 shared contracts](superpowers/specs/2026-10-11-m1-shared-contracts-design.md)), ADRs, `vendor/ruken/` (D-6), `examples/README.md`, `examples/base-*/`, `examples/gallery/`, `packages/cli/` | Lane folders, except to merge |

Rules for every lane:
- Branch from `claude/ruken-first-af-60n4bh` (PR #4) until it merges, then from `main`. Open a draft PR to `main` whose title starts with the task ID, and say in the body that it stacks on PR #4.
- First commit: the lane's task spec, `docs/superpowers/specs/2026-10-11-m1-<lane>-design.md` (or its `m2-*` spec, already written for M2), at the 01 Decomposition §5 level, citing the Ruken, FloorFifty or The Last Light files it builds from (extraction map). Then its TDD plan in `docs/superpowers/plans/`, then code. Strict TDD.
- Dependencies go in the lane's own `package.json`; only **ship** changes root config. `pnpm-lock.yaml` conflicts are resolved by merging `main` and re-running `pnpm install`, never by hand.
- Ship your feature's demo in `examples/<package>/<demo>/` on the matching base, per [`examples/README.md`](../examples/README.md). If the base is not there yet, add the demo's row to that README as waiting; the integration owner finishes it in M1.8 or M3. A lane only edits its own rows and folders under `examples/`.
- Build against the [M1 shared contracts](superpowers/specs/2026-10-11-m1-shared-contracts-design.md) (`Hosting`, `HostError`, `defineExtension`, `BootError`). A lane that needs one changed asks the integration owner; it does not edit the shape itself.
- Run CI locally before calling a PR green: Node 24, `pnpm check`, and the parity suite in Chromium, WebKit and Firefox (hosted Actions jobs are not getting runners).
- **A pull request runs only what it can affect** (CI backlog, 2026-10-23). One runner serves every pull request, so the `checks` job always runs and works out whether the pull request changes only `docs/` and Markdown files. Parity and the games' CI (`placeholder`, `base-2d`) then run only for a pull request that is ready for review and changes something else; a draft or a docs-only pull request stops after `checks`. Marking a draft ready starts the rest. Pushes to `main`, the nightly run and manual runs are unchanged ([ci.yml](../.github/workflows/ci.yml)). Since 2026-10-30 (Owner: "Yes, affected-only on PRs") a pull request's parity job runs only the suites of the packages it affects, dependents included (`pnpm test:parity:affected`, turbo `--affected` over the merge commit's `HEAD^1..HEAD`), unless it changes a file outside `packages/`, `tooling/`, `examples/`, `games/` and `docs/` (root config, a workflow, `vendor/`): then every suite runs, as on `main` and in the nightly. Push to a queued pull request only to fix red CI: every push cancels its run and sends it to the back.
- **No test runs twice.** Inside AF an example's own job skips `Check` and the determinism check, because `checks` already runs every package's `typecheck`, `test:unit` and `boundaries` (which include the examples' sim roots); the job keeps its build, `automata-ship prepare` and the artifact, and a game repository runs every step ([game-ci.yml](../.github/workflows/game-ci.yml), M2.4 spec §3.7). The cross-engine runs are required, not duplicates: a golden or parity test runs in Node (`test:unit`) and again in the three browsers (`test:parity`).
- A PR that changes how packages are built or published (a `tsdown.config.ts`, `svelte.config.js`, `package.json`, `.changeset/`, `tooling/release/` or `tooling/consumer-smoke/`) also runs `pnpm build && node tooling/consumer-smoke/src/run.ts --from packs` locally ([consumer-smoke](../tooling/consumer-smoke/README.md)).
- A PR that changes a published package (anything under the nine `packages/*` and `tooling/check-boundaries/` that `tooling/release` publishes) adds a changeset: `pnpm changeset`, pick the packages, choose `patch` (every change is a patch before 1.0). CI fails without one (`pnpm changeset status --since=origin/main`), and a branch that predates M2.4 hits this once it merges `main`. A PR that publishes nothing (docs, examples, workflows) needs no changeset; `pnpm changeset --empty` records that explicitly when `changeset status` still asks.
- Report status through the PR and to the integration owner; do not edit the numbered docs.

## How a task flows

1. **Pick** the next unblocked task in the master plan (its prerequisites done, its milestone spec reviewed).
2. **Plan** it in `docs/superpowers/plans/`: exact files, interfaces, failing tests first, commands and expected results.
3. **Build** on its own branch in its own worktree. Strict TDD in `packages/`, `tooling/` and `examples/`.
4. **PR** with the task ID first in the title; CI green.
5. **Review and merge.** Anything needing the Owner's eyes (UI states, screenshots, copy) is flagged in the PR and on the status page.
6. **Record** the evidence in the master plan's execution record and update the continuation.
