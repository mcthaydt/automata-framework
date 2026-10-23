# QB.1b: the Owner's release approval waits only for a publish TDD plan

- **Spec:** [QB spec](../specs/2026-10-16-quality-bar-design.md) §4.1 (a `release` environment that needs Owner approval; agents never publish); [M2 build and publish spec](../specs/2026-10-11-m2-build-and-publish-design.md) §3.5 (the release workflow).
- **Task:** `QB.1b — Release approval only for publishes` (02). Lane ship.
- **Status:** drafted 2026-10-23, based on `main`. No PR is opened until the shared runner's queue drains.
- **Progress:** 4 of 4 steps.

## What is wrong

`release-packages.yml` has one job, `release`, with `environment: release`. Every push to `main` therefore waits for the Owner's approval, including the runs that only open or update the "Version packages" pull request. The approval was meant to guard a publish (QB spec: "release publishes need an Owner-approved `release` environment").

## Decisions

- **Three jobs, one workflow, one concurrency group.**
  - `plan` (read-only, no environment) answers one question: does the pushed commit carry changesets (any `.changeset/*.md` except `README.md`)? That is the question `changesets/action` itself asks to choose between "open or update the Version packages PR" and "publish".
  - `version` runs when it does: no environment, `contents: write` and `pull-requests: write`, `changesets/action` with no `publish-script`, so it can only version.
  - `publish` runs when it does not: `environment: release` (the Owner's approval, unchanged), `contents: write` (the action creates the GitHub releases) and `packages: write`, no `pull-requests`, `changesets/action` with `publish-script`, then the post-publish verification and the consumer smoke, exactly as today.
  - The concurrency group `release` stays at the workflow level, so a release still runs one at a time.
- **Both jobs keep `pnpm check` on the commit.** The Version packages PR's own CI waits for approval and nothing requires it, so the commit is checked in the release workflow (the existing comment); a publish never runs on an unchecked commit.
- **Least privilege improves.** Today one job holds `contents`, `pull-requests` and `packages` write. After the split, the job that can publish cannot touch pull requests, and the job that can open pull requests cannot publish.
- **`plan` reads files, not the API.** `find .changeset -maxdepth 1 -name '*.md' ! -name README.md` on a full checkout of the pushed commit: no token, no network, the same rule the action applies.
- **What cannot be tested here.** Workflows run only on GitHub and hosted runners get no minutes on this account (`release-packages.yml` header). The workflow tests pin the shape (jobs, `needs`, `if`, environment, permissions, inputs); the first real run is the proof, and the PR says so. If `plan` and `changesets/action` ever disagree, the failure is safe: `version` with no changesets and no `publish-script` finds nothing to do and exits, and `publish` with changesets present takes the action's version path, which needs `pull-requests: write` that the job lacks, so it fails without publishing.

## Files

- **Modify:** `.github/workflows/release-packages.yml`; `packages/ship/src/workflows.test.ts` (the `release-packages.yml` describe); `.changeset/README.md` (one sentence: only a publish waits for approval); this plan; `docs/02-master-delivery-plan.md` (the row, with the docs sync PR).
- **No changeset:** no published package changes (`packages/ship` gains only a test change).

## Interfaces

- **Consumed:** `changesets/action@ae32849…` inputs `version-script`, `publish-script`, `commit-message`, `pr-title`; the `release` environment.
- **Produced:** jobs `plan` (output `pending`), `version`, `publish`.

## Steps

- [x] **1. The shape, red first.** Rewrite the `release-packages.yml` describe in `workflows.test.ts`: `plan` has no environment and outputs whether changesets are pending; `version` needs `plan`, runs when pending, has no environment, may write contents and pull requests only, and its `changesets/action` has no `publish-script`; `publish` needs `plan`, runs when nothing is pending, is the only job in the `release` environment, may write contents and packages only, and holds the `publish-script`, the verification and the consumer smoke; both jobs check out full history without keeping the token, run `pnpm check` before the action, run on `ubuntu-latest` with the 20-minute timeout. Run `pnpm --filter @mcthaydt/automata-ship test:unit`; the new cases fail on the single-job workflow.
- [x] **2. The workflow.** Split `release-packages.yml` accordingly; the cases pass.
- [x] **3. Prove the plan's rule.** Run the `plan` shell snippet against this checkout (no changesets pending on a clean tree, pending after adding a file) and record both outputs.
- [x] **4. Gates and docs.** `pnpm format`, `pnpm check`, the changeset check (`pnpm changeset status --since=origin/main` exits 0 with no changeset needed); `.changeset/README.md`; the 02 row with the docs sync PR.

## Gates

- Selected: `pnpm check`; the ship package's unit tests; the plan snippet run by hand.
- Omitted, not runnable here: any GitHub Actions run (hosted minutes). The Owner reviews the workflow diff.
- No changeset.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | `9c71ad1` | |
| 2026-10-23 | 1 | | The `release-packages.yml` describe rewritten (13 cases; the `Step` and `Job` test types gained the fields they read). Red: `pnpm --filter @mcthaydt/automata-ship test:unit` 11 failed, 256 passed; every new case failed on the single-job workflow. |
| 2026-10-23 | 2 | | Workflow split into `plan`, `version` and `publish`; ship unit tests 267 passed. |
| 2026-10-23 | 3 | | The plan job's `find` rule run by hand: this checkout (38 changesets pending on `main`) gives `pending=true`; a folder with only `README.md` and `config.json` gives `pending=false`; adding one changeset gives `pending=true`. No Actions run is possible here. |
| 2026-10-23 | 4 | | `.changeset/README.md` says which job waits. `pnpm format`, `pnpm check` and the changeset check below. 02's row and 03 come with the docs sync PR. |
