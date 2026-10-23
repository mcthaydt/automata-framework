# Test feedback hygiene: examples-runner turbo inputs and the pre-commit test budget TDD plan

- **Spec:** [EX spec](../specs/2026-10-16-examples-one-file-design.md) §5 (the catalog and parity tests read files outside the runner package); AGENTS.md "Testing feedback and shared runs" (a cached or timed-out gate must not misreport).
- **Tasks:** the two small follow-ups in `docs/02`, bundled because both are about a local gate misreporting a change: "EX.1 follow-up — turbo inputs for the catalog test" (integration) and "Follow-up (found in the parity-on-Mac PR) — Pre-commit unit tests get the 90 s budget" (ship).
- **Status:** drafted 2026-10-23.
- **Progress:** 4 of 4 steps.

## Decisions

- **Which files the runner's `test:unit` reads.** `tooling/examples-runner`'s `node` project runs the catalog test (reads `docs/02-master-delivery-plan.md`, every `examples/**` file, and each `packages/*/package.json` `exports`) and the examples' golden replays (`examples.parity.test.ts` imports every example, which pulls in the game, sim, runtime and render-pixi sources, and reads `examples/__goldens__/*.replay`). Turbo hashes only the runner's own files, so a change to any of those replays a cached pass. The runner gets a `turbo.json` that extends the root and adds those files to `test:unit` and `test` inputs, the way `packages/ship/turbo.json` does. Package sources are listed without their `*.test.ts` files: a package's own tests do not change what an example does.
- **Prove it with turbo's own plan.** `src/turbo-inputs.test.ts` asks `turbo run test:unit --dry=json` which files it hashes and asserts the list, as `packages/ship/src/turbo-inputs.test.ts` does for ship (no hand-built glob matching).
- **Pre-commit uses the root script's budget.** `lefthook.yml` runs `turbo run test:unit --filter="...[HEAD]"` without `-- --testTimeout=90000`, the budget `pnpm test:unit` passes. The hook passes the same argument. A test in `tooling/repo-hygiene` (private, so it needs no changeset; `packages/ship` is published and would) reads `lefthook.yml` and the root `test:unit` script and asserts the hook's command ends with the script's timeout argument, so the two cannot drift.

## Files

- **Create:** `tooling/examples-runner/turbo.json`, `tooling/examples-runner/src/turbo-inputs.test.ts`, `tooling/repo-hygiene/src/lefthook.test.ts`.
- **Modify:** `lefthook.yml`, `tooling/repo-hygiene/turbo.json` (the hook file is a new input of its tests), `docs/02-master-delivery-plan.md` (the two rows and the execution record), `docs/03-continuation-prompt.md`.
- **No changeset:** no published package changes.

## Interfaces

- **Consumed:** turbo's `--dry=json` task plan; the root `package.json` `scripts["test:unit"]`; `lefthook.yml`.
- **Produced:** none.

## Steps

- [x] **1. Runner inputs, red.** `turbo-inputs.test.ts`: the plan for `@mcthaydt/examples-runner#test:unit` (and `#test`) lists `docs/02-master-delivery-plan.md`, an example (`examples/core/core-basic-window.ts`), its golden (`examples/__goldens__/core-basic-window.replay`) or another recorded one, `packages/game/package.json` and a game source (`packages/game/src/define-game.ts`), and does not list `packages/game/src/define-game.test.ts`. It fails because turbo hashes only the runner's own files.
- [x] **2. Runner inputs, green.** Add `tooling/examples-runner/turbo.json`; the test passes. Prove the original failure by hand too: change a `Pending:` line, rerun `pnpm test:unit` and see turbo run the task instead of replaying it.
- [x] **3. Pre-commit budget, red.** `lefthook.test.ts`: the `2_affected-unit-tests` command contains the same `--testTimeout=<n>` argument as the root `test:unit` script. It fails because the hook has none.
- [x] **4. Pre-commit budget, green.** Add `-- --testTimeout=90000` to the hook; the test passes. `pnpm format`, `pnpm check`.

## Gates

- Selected: `pnpm check`; the two new tests by name.
- Omitted: `pnpm test:parity` and `pnpm test:e2e` (no runtime, rendering, UI, host or game change).

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | | |
| 2026-10-23 | 1 to 4 | | Red first: `turbo-inputs.test.ts` 4 of 4 failed on the file list (`expected [ …(57) ] to deeply equal ArrayContaining`); `lefthook.test.ts` failed on the missing `-- --testTimeout=90000`. Deviation: the lefthook test lives in `tooling/repo-hygiene`, not `packages/ship`, so it needs no changeset; `lefthook.yml` became an input of repo-hygiene's tests. The pre-commit hook runs the unit tests on the working tree, so the red test file was kept out of the plan's commit. Local, Node 24.21.0: `pnpm check` exit 0 (34 of 34 and 30 of 30 turbo tasks). A touched docs/02 changed the examples-runner task hash. |
