# DX.7a: the release version bump refreshes the agent skills and the API index TDD plan

- **Spec:** [M2 build and publish spec](../specs/2026-10-11-m2-build-and-publish-design.md) §3.5 (`release-packages.yml` runs `pnpm release:version` as changesets/action's version script); [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.7 (the `automata-api` skill carries DX.4's generated `api.md`; the plugin's version is the API version) and §3.8 (the API index).
- **Task:** DX.7 follow-up "Release version bump" (02, "DX.7 follow-ups"): `pnpm agent-skills` fails once `release:version` bumps the packages, until `pnpm agent-skills --write` copies the new `api.md` and sets the plugin version. Lane ship (root `package.json`, `tooling/release/`, `.changeset/`).
- **Status:** drafted 2026-10-30, based on `main` `89ff04da`.
- **Progress:** 3 of 5 steps.

## What is wrong

`release:version` is `changeset version && node tooling/release/src/sync-versions.ts`. A version bump changes more than each `package.json`, its changelog and the sim's `SIM_VERSION`:

- `agents/automata/skills/automata-api/reference/api.md` states the version on its first two lines. It must be `tooling/api-index/dist/api.md` byte for byte, and `pnpm api-index` renders that version from the published packages' `package.json` (`tooling/api-index/src/render.ts`, `indexVersion`).
- `agents/automata/.claude-plugin/plugin.json`'s `version` must be that API version (`tooling/agent-skills/src/api-reference.ts`; Claude Code refreshes an installed plugin when its version changes).

Neither is written by the version step, so the Version packages pull request fails `pnpm agent-skills` until someone edits it. PR #31 (Version packages, merged 2026-10-25) had both files changed by hand in its one commit `85df09cc`: `plugin.json` 0.0.2 → 0.0.3 and `api.md`'s two version lines. Every other file in it (nine `package.json`, nine `CHANGELOG.md`, `packages/sim/src/version.ts`, the consumed changesets) came from the version script, which shows changesets/action commits every non-ignored change the script leaves.

## Decisions

- **The version step regenerates, in order:** `changeset version` → `node tooling/release/src/sync-versions.ts` (unchanged) → `pnpm build` (the API index reads the emitted `.d.ts`; the version job's checkout has no `dist/`) → `pnpm cheatsheet` → `pnpm agent-skills --write`.
- **`pnpm cheatsheet`, not `pnpm api-index`.** `pnpm cheatsheet` is `node tooling/api-index/src/cli.ts --write-cheatsheet` (pinned by `tooling/api-index/src/ci.test.ts`): the same API index run, which writes `dist/api.md` and the other generated files, plus `docs/cheatsheet.md`. That is "the API index, and the cheatsheet when it is stale" in one step: rewriting a current cheatsheet leaves it byte-identical, so git sees no change. A version bump alone never makes the cheatsheet stale (it names no version, `cheatsheet.ts`); if `main` ever carried a stale one, the Version packages diff would show the fix for the Owner to read. The step still fails on an undocumented export (exit 1), so an incomplete pull request is never opened.
- **No `api-report` step.** The API reports state no version (`git grep` for the current version finds only `plugin.json`, `api.md`, `version.ts` and test fixtures outside changelogs and manifests), so a bump does not change them.
- **No workflow edit.** `release-packages.yml`'s `version` job already runs `pnpm install --frozen-lockfile` and then `version-script: pnpm release:version`; the new steps need nothing more. Build output stays out of the commit because every generated folder is git-ignored (`dist/`, `.turbo/`, `packages/*/VENDORED.md`); step 4 proves it on a real bump.
- **The test reads the root script,** as `tooling/agent-skills/src/ci.test.ts` and `tooling/api-index/src/ci.test.ts` already do for the gates: the exact step list, so a reordering (agent skills before the index, the index before the build) or a dropped step fails. The steps' own behaviour is tested where it lives (`sync-versions.test.ts`, `tooling/api-index/src/run.test.ts`, `tooling/agent-skills/src/api-reference.test.ts`); step 4 runs the whole chain once on a real bump.

## Files

- **Create:** `tooling/release/src/release-version.test.ts`; this plan.
- **Modify:** root `package.json` (`release:version`); `.changeset/README.md` (what the Version packages pull request carries); M2 spec §3.5 (the version script's steps, as built).
- **No changeset:** nothing published changes (root `package.json` and `tooling/release` are private).

## Interfaces

- **Consumed:** root scripts `build`, `cheatsheet` (`node tooling/api-index/src/cli.ts --write-cheatsheet`), `agent-skills` (`node tooling/agent-skills/src/cli.ts`, `--write`); `syncSimVersion` through `sync-versions.ts`; changesets/action's `version-script`.
- **Produced:** `release:version` = `changeset version && node tooling/release/src/sync-versions.ts && pnpm build && pnpm cheatsheet && pnpm agent-skills --write`. No new code or exports.

## Steps

- [x] **1. Plan.** This file, committed first.
- [x] **2. Red.** `tooling/release/src/release-version.test.ts`: `release:version` split on ` && ` equals the five steps above. Run `pnpm --filter @mcthaydt/release exec vitest run src/release-version.test.ts`; expected: 1 failed, the received list being today's two steps.
- [x] **3. Green.** Root `package.json` `release:version` gains `pnpm build && pnpm cheatsheet && pnpm agent-skills --write`. The same command: 1 passed; then `pnpm --filter @mcthaydt/release test:unit`, all passed.
- [ ] **4. Prove it on a real bump** in a disposable worktree of this branch (`/home/user/wt/af-dx7a-dryrun`, detached, removed afterwards), with a scratch patch changeset on `@mcthaydt/automata-sim` (the fixed group bumps all nine to 0.0.4):
  - *Control (today's script):* `pnpm exec changeset version && node tooling/release/src/sync-versions.ts`, then `pnpm build && pnpm api-index`, then `pnpm agent-skills`. Expected: exit 1, `plugin.json says version 0.0.3 but the API is 0.0.4` (PR #31's failure).
  - *Reset* (`git checkout -- . && git clean -fd`, ignored build output kept), re-add the changeset, *then the new script:* `pnpm release:version`. Expected: exit 0; afterwards `pnpm api-index` and `pnpm agent-skills` (check mode, no `--write`) exit 0; `git status --porcelain` lists only the nine `package.json`, nine `CHANGELOG.md`, `packages/sim/src/version.ts`, `plugin.json`, `api.md` and the consumed changeset, with no build output. Record the cold build time (the version job's timeout is 20 minutes, including `pnpm check`).
- [ ] **5. Docs and gates.** `.changeset/README.md`, M2 spec §3.5; `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`, `pnpm build && node tooling/consumer-smoke/src/run.ts --from packs` (a change to `tooling/release/` and the root `package.json`, 04's build-and-publish rule).

## Gates

- Selected: the release package's unit tests; `pnpm check` (forced); the changeset checks; the consumer smoke from packs; the dry-run bump of step 4.
- Omitted: `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills` as gates of their own (no published export, doc comment or skill changes; step 4 runs the last two on the bumped tree); parity (no sim, renderer, ui or golden change); examples and e2e (none touched).
- Not runnable here: the release workflow itself (it runs on the Owner's Mac on a push to `main`). The next Version packages pull request is the proof that it needs no hand edits.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | 1 | `62a0c605` | Plan drafted from `main` `89ff04da`; PR #31's files read through the REST API (`85df09cc`: `plugin.json` and `api.md` the only hand edits). |
| 2026-10-30 | 2 | | `tooling/release/src/release-version.test.ts`. Red: `pnpm --filter @mcthaydt/release exec vitest run src/release-version.test.ts` 1 failed; received `["changeset version", "node tooling/release/src/sync-versions.ts"]`, missing `pnpm build`, `pnpm cheatsheet`, `pnpm agent-skills --write`. |
| 2026-10-30 | 3 | | Root `release:version` extended. The test: 1 passed; `pnpm --filter @mcthaydt/release test:unit` 8 files, 38 passed, 4 skipped (the built-package cases, `AF_CHECK_DIST` only, as on `main`). |
