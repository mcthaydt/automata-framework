# DX.9: evidence file TDD plan

- **Spec:** [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.10, §4 (ownership: `tooling/evidence`, ship lane, consumed by the website), §2 (the rows marked DX.9) and §12 (`evidence.json` is produced by af-linux CI on `main`, and the website renders it).
- **Status:** drafted 2026-10-16 (DX.0 Owner-approved 2026-10-16); implemented and locally verified 2026-10-16; draft PR, Owner review pending.
- **Progress:** 7 of 7 steps.
- **Scope:** the AF side only. The website's sync, rendering and the "hard-coded hash fails `audit-regressions.test.ts`" test live in `mcthaydt/automata_website` and are follow-up DX.9w in [02](../../02-master-delivery-plan.md). The `automata check` results for the `create-game` output wait on DX.5 and DX.6; the file says so explicitly (follow-up DX.9a).

## Design

- **Hashes come from the runs that check them.** Today the goldens are checked in four engines by the golden tests (Node) and the parity suites (Chromium, WebKit, Firefox). No test reports the hash it computed; a pass only says it matched. So each golden test records what its own engine computed in Vitest's task `meta` (`goldenEvidence`: scenario, seed, ticks, hash, and the runtime: Node's `process.version` or the browser's user agent), and Vitest's JSON reporter writes it out. Seed and ticks are read from the sim at the end of the run (`sim.seed`, `sim.tick` minus the start tick), never typed into the evidence.
- **Goldens covered** (every scenario run to a committed hash in all four engines today):
  - `sim/snapshot-churn`: `packages/sim/src/world/snapshot.parity.test.ts`;
  - `testing/bounce`: `packages/testing/src/sim/bounce.golden.test.ts` (`bounce.golden.json` and `bounce.replay`);
  - `physics/scene-2d` and `physics/scene-3d`: `packages/physics/src/physics-{2d,3d}.parity.test.ts`;
  - `base-2d/golden-route`: `examples/base-2d/src/golden.parity.test.ts` (base-2d's node project runs that file too, so it records Node's hash as well);
  - `physics-bodies-2d/golden-run`: `examples/physics/bodies-2d/golden{,.parity}.test.ts`.
- **Per-package `test:evidence`:** reruns only those golden files in Node and the browsers project, with `--reporter=default --reporter=json --outputFile.json=.evidence/goldens.json`. The root `evidence` script runs them through turbo (uncached), then `node tooling/evidence/src/cli.ts`.
- **The generator** (`cli.ts`) reads every workspace package's `.evidence/goldens.json`, the revision (`GITHUB_SHA`, else `git rev-parse HEAD` and whether the tree is dirty), the run (`GITHUB_*` variables when `GITHUB_ACTIONS=true`, else `kind: "local"`), the Playwright version from `playwright-core`, and the publishable packages' manifest versions with whether their `name@version` release tag exists. It fails on: no goldens, a golden test that did not pass, a scenario missing an engine or seen twice in one, or seeds/ticks that disagree across engines. It validates the result with the schema and writes `evidence.json` and `evidence.schema.json` (`z.toJSONSchema`) at the repository root (git-ignored).
- **Delivery to the website:** the spec leaves it open, so the simplest: the parity job uploads both files as the workflow artifact `evidence` on pushes to `main`. The parity checkout fetches tags so `released` is true to the registry's release tags.

## Files

- **Create:** `tooling/evidence/` with `package.json`, `tsconfig.json`, `src/evidence.schema.ts`, `src/golden-evidence.ts`, `src/collect.ts`, `src/cli.ts`, `src/evidence.schema.test.ts`, `src/golden-evidence.test.ts`, `src/collect.test.ts`, `src/fixtures/goldens.report.json`.
- **Modify:**
  - the golden tests listed above, `examples/base-2d/src/golden-run.ts`, `examples/physics/bodies-2d/golden.ts`, `packages/physics/src/testing/run-scene.ts` (return `seed` and `ticks`);
  - `package.json` of `packages/sim`, `packages/testing`, `packages/physics`, `examples/base-2d`, `examples/physics/bodies-2d` (`test:evidence`, devDependency `@mcthaydt/evidence`);
  - root `package.json` (`evidence`, `ci:local`), `turbo.json` (`test:evidence`), `.gitignore`;
  - `.github/workflows/ci.yml` (parity job), `packages/ship/src/workflows.test.ts`.

## Interfaces

- **Produced:** `EvidenceSchema` and `GoldenEvidenceSchema` (Zod, `tooling/evidence/src/evidence.schema.ts`); `recordGoldenEvidence(task, { scenario, seed, ticks, hash })` (browser-safe, no imports); `buildEvidence(inputs)` and `goldensFromReports(reports)` (`collect.ts`); `evidence.json` + `evidence.schema.json`, artifact `evidence`.
- **Consumed:** Vitest's JSON reporter (`testResults[].assertionResults[].meta`), `workspacePackages`/`publishablePackages` (`tooling/release/src/publishable-packages.ts`), `GITHUB_*` run variables, git tags `@mcthaydt/<name>@<version>` written by Changesets.

## Steps

- [x] **1. Schema.** `evidence.schema.test.ts`: a complete document parses; a hash that is not 16 hex digits, an engine outside node/chromium/firefox/webkit, a CI run without a URL, and an `automataCheck` that is not `pending` are rejected. Run `pnpm --filter @mcthaydt/evidence test` and confirm it fails because `evidence.schema.ts` does not exist; implement; confirm it passes.
- [x] **2. Recording.** `golden-evidence.test.ts` (Node): `recordGoldenEvidence` puts `{ scenario, seed, ticks, hash, runtime: { kind: 'node', version } }` in `task.meta.goldenEvidence`, and it parses with `GoldenEvidenceSchema`. Confirm it fails on the missing module; implement; confirm it passes.
- [x] **3. Collecting.** `collect.test.ts` over `fixtures/goldens.report.json` (a trimmed real Vitest JSON report): goldens grouped per scenario with four engines and versions parsed from the user agents; a failed golden test, a missing engine, a duplicate engine and a seed that differs between engines each throw naming the scenario; a report with no goldens throws; packages are marked released by their tags; the run comes from `GITHUB_*` or is local; `automataCheck` is pending on DX.5 and DX.6. Confirm the failures are the missing functions; implement `collect.ts`; confirm it passes.
- [x] **4. Golden tests record evidence.** Add the `recordGoldenEvidence` calls and the `seed`/`ticks` return fields. Run each package's `test:evidence` and confirm the JSON report holds one `goldenEvidence` per engine for each scenario (the failing check: before the change, the report has none). Each package's existing golden tests still pass in Node and the browsers.
- [x] **5. CLI.** `cli.ts` wires the readers to `buildEvidence`; the root `evidence` script and turbo's uncached `test:evidence`. Run `pnpm evidence` once against the real reports and check `evidence.json` by eye against the committed goldens (`bounce.golden.json`'s last hash, `GOLDEN_HASH` values, physics `EXPECTED`). Not committed.
- [x] **6. CI.** In `workflows.test.ts`, failing first: the parity job's checkout fetches tags; on pushes only it runs `pnpm evidence` (with `HOME: /root`) and uploads `evidence.json` and `evidence.schema.json` as the artifact `evidence` before the chown step; the root `evidence` script; every golden package has a `test:evidence` writing `.evidence/goldens.json`; `ci:local` runs `pnpm evidence` after `pnpm test:parity` (the existing order test). Change `ci.yml` and `ci:local`; confirm green. `pnpm lint:actions` if docker is present.
- [x] **7. Gates and bookkeeping.** `pnpm format`, `pnpm check`, `pnpm test:parity`, `pnpm evidence`. 02 (DX.9 row, follow-ups DX.9a and DX.9w, execution record), 03 artifacts row, this plan's execution log.

## Execution log

- 2026-10-16, step 1–3: schema, recording helper and collector red on the missing modules, then green (29 tests in `tooling/evidence`). The root `.gitignore`'s `evidence/` (screenshots, M1 ship plan 7.3) also ignored `tooling/evidence/`; it is now `/evidence/`, plus `/evidence.json`, `/evidence.schema.json` and `.evidence/`.
- 2026-10-16, step 4: red check: `packages/testing`'s `test:evidence` report held 0 `goldenEvidence` entries before the change. After it, every package's report holds one per engine per scenario. base-2d first recorded Node twice (its node project also runs `golden.parity.test.ts`), so base-2d records from that file only. Physics' `EXPECTED` now also pins `seed: 2026, ticks: 300`; no hash changed. `golden-evidence.ts` types its globals itself, because sim and physics compile without DOM or Node types.
- 2026-10-16, step 5: `pnpm evidence` at `3fa513e` (local, clean tree), about 27 s on the shared container: 6 goldens, all four engines agree, each equal to the committed value (`testing/bounce` `021df7c6554d00c6` = `bounce.golden.json` tick 300; `sim/snapshot-churn` `98cc273719c10ef2`; `physics/scene-2d` `46042079c99bfdf1`; `physics/scene-3d` `5ab771a640ac4b78`; `base-2d/golden-route` `31f50888ccb4cf0a`; `physics-bodies-2d/golden-run` `ad621eea6325a8db`); engines Node v24.21.0, Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6 (Playwright 1.63.0); 9 publishable packages at 0.0.2, all with release tags (tags fetched first). Output not committed.
- 2026-10-16, step 6: 5 new `workflows.test.ts` cases red on the missing script, steps and tags, then green (85 tests). `pnpm lint:actions` not run: the Docker CLI exists but no daemon. The parity job keeps its 10-minute limit; the evidence run adds about half a minute locally.
- 2026-10-16, step 7: `pnpm format`; `pnpm check` (typecheck 27 tasks, unit 23 tasks, 1,692 tests, some replayed from turbo's cache); `pnpm test:parity` (9 suites, 590 tests, 86 s); `pnpm test:e2e` on ports 4705/4805 (46 passed). An empty changeset covers the test-only changes in sim, testing and physics.
