# M2 Deterministic core complete: milestone spec

- **Status:** drafted 2026-10-11 by the M2 specs thread; revised the same day after the PR #12 audit; awaiting Owner review. This is task **M2.0** in [02 Master delivery plan](../../02-master-delivery-plan.md). Review freezes the contracts in §4; after that they change only additively or through a written change request.
- **Builds on:** `main` at `d556d23` (M1 lanes #4 integration, #5 host, #6 ship, #7 ui and #8 content, and M2.1 physics #9, all merged). `base-2d` is PR #10, open (head `ab4f857` when this was revised); nothing here treats it as on `main`.
- **Replaces:** the A1b/A1c design left in the [A0+A1 spec](./2026-10-01-a0-a1-spikes-foundation-design.md) (§4.5 physics, §6 testing, §7 example, §8 exits 2–8). The content compiler (§5) already moved to M1.3, physics to M2.1. Laws, state ownership and determinism rules from the [2026-10-01 master spec](./2026-10-01-automata-framework-overview-design.md) still apply, as sharpened by the [Ruken-first master spec](./2026-10-11-automata-framework-ruken-first-design.md).
- **Task specs** (each is what its lane's thread executes; this document owns only what they share):

  | Task | Lane | Spec | Plan |
  |---|---|---|---|
  | M2.1 Physics plugins | sim | [m2-sim-physics](./2026-10-11-m2-sim-physics-design.md) (PR #9, merged) | [plan](../plans/2026-10-11-m2-sim-physics.md) |
  | M2.1b Physics demo | sim | [m2-physics-demo](./2026-10-11-m2-physics-demo-design.md) | [plan](../plans/2026-10-11-m2-physics-demo.md) |
  | M2.2 Content in the sim | content | [m2-content-in-sim](./2026-10-11-m2-content-in-sim-design.md) | [plan](../plans/2026-10-11-m2-content-in-sim.md) |
  | M2.3 Goldens and replays | testing | [m2-goldens-and-replays](./2026-10-11-m2-goldens-and-replays-design.md) | [plan](../plans/2026-10-11-m2-goldens-and-replays.md) |
  | M2.4 Build and publish | ship | [m2-build-and-publish](./2026-10-11-m2-build-and-publish-design.md) | [plan](../plans/2026-10-11-m2-build-and-publish.md) |

## 1. Goal and boundaries

At the end of M2 a game's simulation is provably deterministic and shippable as a dependency:

- the sim runs on content from the compiler, frozen, with a generated type for it, and a snapshot taken under other gameplay content is refused while a store-listing fix is not (M2.2);
- a run can be recorded as a `.replay` and played back headless in Node or in any browser; a mismatch names the first divergent check window, and for a golden (which carries reference data) the exact tick and field (M2.3);
- the same goldens pass with identical hashes in Node, Chromium, WebKit and Firefox (M2.3, over M2.1's physics);
- AF's packages build, version and publish as `0.0.x` to GitHub Packages, so a game in its own repository can install them (M2.4);
- each new capability has a raylib-style demo on `base-2d` ([`examples/README.md`](../../../examples/README.md)).

**Exclusions.** Runtime use of these pieces (the app loop restarting the sim on content change, recording replays during play, sharing them) is M1.5's or later work; M2 delivers the contracts and the harness they will use. Saves and migrations are M5. Networked replays (two clients) are M7. Visual (screenshot) goldens stay with M4's E2E matrix and the GPU runner; M2's goldens are sim hashes only. 3D demos wait for `base-3d` (M3).

**Prerequisite artifacts:** M1.3 content compiler (merged, #8); M2.1 physics (merged, #9); `base-2d` (#10, open) for the demos. The demos are the only M2 deliverables that wait on #10; every package change can start now.

## 2. What already exists (verified 2026-10-11, not rebuilt)

| Piece | Where | State |
|---|---|---|
| Content passed to the sim, canonicalized, deep-frozen, hashed into the snapshot header; restore with another hash throws `SnapshotMismatchError('contentHash')` | `packages/sim/src/world/sim.ts:160-162, 451-452`; test `world/snapshot.test.ts:90`; `world/sim.test.ts:160` | Built in A1a. M2.2 adds the partition, the types and the cross-package check, not this. |
| The compiler's hash uses the sim's own `canonicalJson` and `xxhash64` | `packages/content/src/hash/content-hash.ts` | Built in M1.3; M2.2 proves equality with a test |
| Snapshot v1 with header, sections 1–4, section 6 (with #9) | `packages/sim/src/world/snapshot.ts` | Built; `decodeSnapshot` is internal |
| Per-engine parity runs for sim, content, physics, base-2d | each package's `browsers` vitest project; root `pnpm test:parity` | Built |
| A hand-written golden route with a final hash | `examples/base-2d/src/golden.ts` in PR #10 (open) | Built on #10's branch; once #10 merges, M2.3's demo adds a `.replay` golden of a base-2d run, without touching base-2d |
| Workspace `exports` pointing at `src/*.ts`, every package `private: true` | `packages/*/package.json` | M2.4 adds builds and `publishConfig` |

## 3. Ownership

| State or artifact | Owner | Writers |
|---|---|---|
| The sim's content (frozen) and its gating hash | `sim` (computes the hash from what it is given) | only `createSim` |
| Which content the sim gets (the sim partition) | `content` | the compiler; games choose per schema (M2.2) |
| The `SimContentData` type | `content` generates it into the game's `content.d.ts`; sim code applies it to `ctx.content` (which stays `unknown`) | the compiler's type generator |
| `.replay` bytes format and its codec | `sim` (`@mcthaydt/automata-sim/replay`): pure, no I/O, runs in a game build | M2.3 |
| Snapshot inspection (`Sim.describeSnapshot`) | `sim` | M2.3 |
| Golden files, divergence reports, the property test helper, compression adapters | `testing` (`@mcthaydt/automata-testing/sim`) | M2.3 |
| Golden files on disk (`__goldens__/`) | the package or game whose tests own them | only the Node test project with `AUTOMATA_UPDATE_GOLDENS=1`; never a browser project |
| Built `dist/`, versions, changelogs, the release workflow | `ship` lane (root config, `.changeset/`, each package's build fields) | M2.4 |

Presentation never reads a `.replay` or a snapshot directly; a viewer re-simulates through the sim (FloorFifty `replay/stepper.ts` rule: "through the one simulation there is").

## 4. Contracts this milestone freezes

Each is specified in full in its task spec; listed here so the lanes build against one shape.

| Contract | Kind | Task spec | Consumers |
|---|---|---|---|
| `defineContentSchema(kind, schema, place, { sim? })`: `sim` defaults to `true`; built-ins `tuning` in, `flow`, `palette`, `game`, `assets` out | additive to M1 shared contracts §2 | M2.2 §3.1 | games, `pipelines` (M3), runtime (M1.5) |
| `CompiledContent.sim: { data, hash }`; `virtual:automata/content` adds `simContent` and `simContentHash` | additive to M1.3 | M2.2 §3.2 | runtime boot check (M1.5), replays (M2.3), saves (M5) |
| `SimContentData` in the generated `content.d.ts`; `SimContext.content` stays `unknown` | additive to M1.3's generated types | M2.2 §3.3 | game sim code |
| `Sim.contentHash: string` (16 hex) | additive | M2.2 §3.4 | runtime, replays, saves |
| `Sim.describeSnapshot(bytes?): SnapshotView` | additive | M2.3 §3.1 | `testing`, `debug` (M6) |
| `.replay` format v1 and `@mcthaydt/automata-sim/replay` (`REPLAY_FORMAT`, `DEFAULT_CHECK_EVERY`, `REPLAY_INFLATE_MAX_BYTES`, the `Replay`/`ReplayHeader`/`ReplayCommand` types, `createRecorder`, `encodeReplay`, `decodeReplay`, `createReplayStepper`, `ReplayCompression`, `packReplay`, `unpackReplay`, `ReplayFormatError`, `ReplayRecordError`) | new | M2.3 §3.2–§3.5 | `testing`, runtime (M1.5 recording), `net` (M7), saves |
| `@mcthaydt/automata-testing/sim` (`simGolden`, `replayGolden`, `GoldenReport`, `expectGolden`, `diffSnapshotViews`, `formatGoldenReport`, `snapshotRoundTripProperty`, `goldenCommands`, `nodeCompression`, `streamCompression`) | new | M2.3 §3.6–§3.9 | every package with sim plugins, every game's tests |
| Published package layout (`exports` → `src` in the workspace, `publishConfig.exports` → `dist`), one fixed version for every `@mcthaydt/automata-*` package | new | M2.4 §3 | every game repository, `create-game` (M1.8), `update-game` (M8) |

**Decided here (needs no lane):**

- **One gating hash, partitioned by kind.** FloorFifty splits a ruleset revision from per-stage course revisions, choosing fields (`packages/content/src/revisions.ts:9-20, 49-66`, 122a220), so a new stage does not invalidate replays of the others. AF starts with one sim-content hash over whole kinds: the partition that matters now is gameplay versus presentation and store data (the M1.3 audit decision; coordinator, 2026-10-11: store metadata is out of the gating hash). The cost of by-kind (text and display fields inside a sim kind gate saves) is stated in M2.2 §3.1. Per-field marking and per-level hashes go to the backlog until a game needs them.
- **Two content hashes, two jobs.** `content.hash` (everything) stays the M1.5 boot check and evidence identity (M1.3 spec); the sim hash gates snapshots and replays only (M2.2 §3.2).
- **The replay codec is core.** A `.replay` is recorded during play and checked in tests, so its format lives in `sim` (pure, boundary-checked), not in the dev-only `testing` package. Compression is injected, as in FloorFifty (`replay/compression.ts`), so `sim` imports no `zlib` and no `CompressionStream`.
- **Builds use tsdown, not Vite library mode.** The A0+A1 spec and 01 Decomposition say "Vite library mode". Ruken builds its published packages with `tsdown` 0.23.0 and AF follows Ruken's pins (ADR 0004, `docs/versions.md`). `isolatedDeclarations` lets tsdown emit `.d.ts` without TypeScript's JS API (TypeScript 7 has none); every package sets it except `node` and `ship`, which M2.4 converts first (M2.4 §2). M2.4's PR updates 01 and A0+A1 to say tsdown.
- **D-8 widened.** D-8 named `host` and `testing`. `content` and `ship` also depend on vendored `@ruken/manifest`, `ship` spawns `@ruken/cli`, and `ui` and `testing` import Ruken types. The default is unchanged in kind: bundle what the package imports from the vendored tarballs into its JavaScript, inline the Ruken types into its `.d.ts`, keep the tarballs as dev dependencies, and record the RukenApp commit; M2.4 §3.4 lists each case. The master spec's D-8 row is updated to match.

## 5. Order and parallelism

```
#9 physics (merged) ──► M2.1b physics demo ◄── #10 base-2d
M2.2 content in sim ──┐
                      ├──► M2.3 record-replay demo (needs #10)
M2.3 goldens/replays ─┘
M2.4 build and publish ── packaging can start now; the first release waits for M2.2 and M2.3 to merge
```

- M2.2 and M2.3 run in parallel. Both touch `packages/sim`: M2.2 adds `Sim.contentHash` (`world/sim.ts`); M2.3 adds `src/replay/` and `Sim.describeSnapshot` (`world/sim.ts`, `world/snapshot.ts`), so `world/sim.ts` takes two small additive edits. Merge M2.2 first; M2.3 merges `main` after it and re-runs its goldens. M2.3 types content as `unknown`, as the sim does, and the replay header copies the hashes from the sim's snapshot header, so M2.3 depends on nothing M2.2 adds.
- The physics demo (M2.1b) and the other two demos need small additions to base-2d (exported `startGame` options, a `./sim` entry, and for content-restore the compiled-room swap); integration owns those and they are requested through the coordinator.
- M2.4 edits every `packages/*/package.json` (adds `files`, `publishConfig`, a `build` script; drops `private`). Those edits are additive fields. It merges last, after merging `main`, and its first release PR is opened only then.
- M2.1b and the M2.2 and M2.3 demos need `base-2d` on `main` (#10). A lane whose demo is blocked ships its package work and leaves the demo row "waiting" in `examples/README.md`; the demo then lands as its own small PR with the same task ID.

## 6. Data and lifecycle flow (end to end)

1. **Compile.** `automata-content` writes `content.json` (everything) and, from M2.2, the sim partition with its hash; `content.d.ts` gains `SimContentData`.
2. **Create.** `createSim({ seed, content: simContent, plugins })` canonicalizes and freezes the content and computes `sim.contentHash`. The M1.5 boot check is on `content.hash`; the runtime may also assert `sim.contentHash === simContentHash` once, as a build-bug check (M2.2 §4).
3. **Set up.** Scene setup may `spawn` outside `step` (base-2d spawns the player this way).
4. **Record.** `createRecorder(sim)`, created before the first step (tick 0 of the round), snapshots the sim as the replay's start state (so setup spawns and checkpoint starts are both covered, as The Last Light's `ReplayLog.from` and FloorFifty's "state at GO" do), then records each `step`'s commands and a check hash every 60 ticks.
5. **Finish.** `recorder.finish()` adds the final tick and hash and returns a `Replay`; `encodeReplay` and `packReplay` turn it into bytes.
6. **Play back.** `createReplayStepper(replay, { plugins, content })` creates a sim, restores the start snapshot (refused with `SnapshotMismatchError` if the schema or content changed) and steps the recorded commands, reporting each check.
7. **Golden.** `replayGolden` does 6 against a committed golden and, on a mismatch, finds the first divergent tick and diffs the two states field by field.

## 7. Failure policy (shared)

| Case | Behaviour | Where |
|---|---|---|
| Snapshot or replay from other gameplay content | `SnapshotMismatchError('contentHash')`; the report says "content changed", never "diverged" | M2.2, M2.3 |
| Store or display metadata changed (`game.toml`) | Accepted: not in the sim partition | M2.2 |
| Schema changed (component, command, resource, plugin config) | `SnapshotMismatchError('schemaHash')`; a golden must be re-recorded with the reason written in the commit and the plan's log | M2.3 |
| Hash differs in one engine only | A failure, never a flake; never rebaselined per engine (AGENTS.md) | M2.3 |
| Malformed or truncated replay, oversized inflate | `ReplayFormatError`; nothing is stepped | M2.3 |
| A browser project asked to update goldens | Fails: only the Node project writes goldens | M2.3 |
| Publish without a token, or with a version already on the registry | The release job fails before uploading anything; nothing partial is published | M2.4 |

## 8. Test allocation

| Layer | What | Where |
|---|---|---|
| Unit (Node) | Partition rules, types, hash equality, replay codec round trips and every format error, recorder, stepper, divergence finder, structural diff, property test | `packages/content`, `packages/sim`, `packages/testing` |
| Parity (Chromium, WebKit, Firefox) | Compiler hash equals sim hash for a fixture; every golden in `packages/testing` and in the demos replays with identical hashes | each package's browser project (`browsers`; in `testing`, the new `sim-browsers`), root `pnpm test:parity` |
| Fixture games | A divergent fixture plugin (exit 7); the testing package's own fixture plugin and the physics scenes from #9 | `packages/testing/src/sim/fixtures/` |
| Demos | Smoke test per demo (boots under the fake host, ready, no console errors) and the demo's own golden in four engines | `examples/<package>/<demo>/` |
| Packaging | Packed tarballs install into a project outside the workspace and typecheck with TypeScript 7.0.2 and 6.0.3 | `tooling/consumer-smoke` (M2.4) |
| Browser journeys | Each demo's play journey runs nightly and on request on the GPU runner, like base-2d's | root `playwright.config.ts` projects |

Owner gates: demo look and feel (each demo's screenshots, shown before promotion); the M2 spec review; the first publish (merging the release PR).

## 9. Feedback workflow

Focused first: `pnpm vitest run <file>` in the package, then `pnpm --filter <pkg> test:parity` for parity-relevant changes, then `pnpm ci:local` before calling a PR green. The af-linux runner is stalled (2026-10-11), so a full local run is the gate (Owner, 2026-10-11, "local green counts"); each PR says which gates ran where. First-attempt failures are kept in the PR. Golden updates are their own commit, with the reason.

## 10. Ruken alignment

- Snapshots and replays are AF's own (Ruken has no sim). Saves of them go through `Hosting` storage in M5, where Ruken's save limits apply (the SDK's `save-map.ts`); M2 quotes none of them.
- Publishing follows Ruken's own release setup: `tsdown` 0.23.0 builds, `@changesets/cli` 3.0.3, `changesets/action` v2.1.2 at `ae32849d`, workspace `exports` to source with `publishConfig.exports` to `dist` (RukenApp `packages/sdk/package.json`, `.github/workflows/release-packages.yml` at `ccad7c0`). Ruken publishes to npm with OIDC; AF publishes to GitHub Packages (master spec §4), so the token differs.
- Requests to Ruken: none new.

## 11. Demos (raylib style, on `base-2d`)

| Demo | Shows | Lane | Spec |
|---|---|---|---|
| `examples/physics/bodies-2d` | Rapier crates and balls in base-2d's room, pushed by Wick | sim (M2.1b) | [m2-physics-demo](./2026-10-11-m2-physics-demo-design.md) |
| `examples/sim/content-restore` | Gameplay content gates a snapshot; store metadata does not | content (M2.2) | [m2-content-in-sim §8](./2026-10-11-m2-content-in-sim-design.md#8-demo-examplessimcontent-restore) |
| `examples/testing/record-replay` | Play, then watch the run re-simulated from its `.replay`, with each check passing | testing (M2.3) | [m2-goldens-and-replays §8](./2026-10-11-m2-goldens-and-replays-design.md#8-demo-examplestestingrecord-replay) |
| `examples/physics/bodies-3d` | Rapier bodies in 3D | sim | waits on `base-3d` (M3) |

M2.4 has no gallery demo: publishing is shown by `tooling/consumer-smoke`, a project outside the workspace that installs the packed packages.

**Art.** Endesga 64 only, with base-2d's original look (Emberwick: Wick, mossy night ruins, pixel lighting). Bubble Bobble and Celeste are loose references, never models (Owner, 2026-10-11: the first base-2d "read like a clone"). New sprites are palette-indexed pixel maps like base-2d's `src/art/sprites.ts`, with provenance in the demo's `PROVENANCE.md`. Screenshots are evidence until the Owner approves them.

## 12. Exit criteria

M2 is done when each holds, with evidence recorded in 02's execution record (A0+A1 §8 numbering):

| # | Criterion | Evidence |
|---|---|---|
| 2 | `sim`, `physics`, `content`, `testing` (and every other `@mcthaydt/automata-*` package) build; CI publishes a `0.0.x` prerelease to GitHub Packages | M2.4: release job log, the registry listing, `consumer-smoke` green against the published versions |
| 3 | The base-2d replay golden (`examples/testing/record-replay`) and the physics demo golden pass in Node, Chromium, WebKit and Firefox with identical hashes | M2.3, M2.1b: `pnpm test:parity` output |
| 4 | Property test over ≥ 200 seeds and tick counts: snapshot, restore and continue equals an uninterrupted run, with and without physics | M2.3 |
| 5 | Every `check-boundaries` and `check-style` rule has a rejecting fixture | Already true (M0, PR #4); re-confirmed by M2.3 for `src/replay/` |
| 6 | Content errors report `file:line:col`; a dangling reference fails the compile | Already true (M1.3); M2.2 adds `simReference` |
| 7 | A deliberate divergence makes `replayGolden` report the first divergent tick and the exact field | M2.3 divergent fixture |
| 8 | CI passes in under 10 minutes | M2.4: each af-linux job's wall time, and their sum (one runner serializes them). Open while the runner is stalled; the local timings are recorded meanwhile |

Plus: each demo in §11 (except `bodies-3d`) merged with its smoke test and golden, and its screenshots shown to the Owner.

**Failure cases that must be proven by tests:** content change refuses a snapshot and a replay; store metadata change does not; schema change refuses a replay with a schema message; truncated replay; inflate bomb; per-engine mismatch fails; a browser cannot rebaseline; publishing an existing version fails.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Reference snapshots make goldens large | Stored deflated; a size cap per golden (M2.3 §3.6) with an explicit `snapshotEvery` to trade exactness of the diff tick for size |
| `sim.hash()` costs ~5 ms at 500 bodies (#9 §10.5), so per-tick hashing is slow | Goldens hash per tick only while bisecting a failure; the passing path hashes every 60 ticks |
| tsdown with TypeScript 7 | `isolatedDeclarations` keeps `.d.ts` on oxc; M2.4 task 1 proves it on `sim` before any other package |
| Svelte components (`ui`) are not plain TS | `ui` publishes `.svelte` sources through `@sveltejs/package`, the Svelte-recommended layout (M2.4 §3.3) |
| GitHub Packages needs a token even to install | `consumer-smoke` installs with a read token; `game-ci.yml` and `game-release.yml` install with `AF_READ_TOKEN`, a classic PAT with `read:packages` (§14) |

## 14. Open questions and Owner inputs

- **Q1, decided (coordinator, 2026-10-11):** releases use the workflow's own `GITHUB_TOKEN` with `packages: write`; games use `AF_READ_TOKEN`, a **classic** personal access token with `read:packages` only, which the Owner creates at M2.4 time (not a blocker before then). GitHub Packages' npm registry "only supports authentication using a personal access token (classic)" ([GitHub docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry), read 2026-10-11), so a fine-grained token will not work.
- **Q2:** one fixed version for all AF packages (recommended, §4) or independent versions? Fixed keeps `update-game` and support simple while everything is `0.0.x`; revisit at 1.0 (M8).
- **Q3:** `@sveltejs/package` for `ui` (recommended) or ship `ui` unbuilt.
- **Q4:** the demo names in §11. Recommended as written.
