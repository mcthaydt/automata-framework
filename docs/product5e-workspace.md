# PRODUCT.5e: the Plus workspace skeleton, core.ref sync and CI

- **Plan:** the framework's `docs/superpowers/plans/2026-10-23-product5-plus-repo-and-physics-move.md`, section 5e and
  decisions P5-D1 to P5-D6. The integration owner ticks that plan in the framework; this file is the evidence for it.
- **Branch:** `claude/plus-5e-workspace`. This is a rebuild of the lost first build (commit `cc77cc6` on
  `claude/project-thread-4vn53j`, which was never pushed), done from the plan rather than recovered.
- **Framework source:** `core.ref` is `b7ef19d978d4751eaf08d1374dcfbcf2459d8c2b`, the framework's `main` on 2026-10-30
  (the merge of #188). It contains `tooling/core-packs`, which arrived with #179.
- **Status:** implemented and checked locally. The first CI run on the Mac is pending.

## Steps (the plan's 5e list)

- [x] 1. Tests 1 to 3 red; the three scripts (`core-ref`, `overrides`, `sync-core`).
- [x] 2. Test 5 (passes vacuously: there is no package yet; it is pinned for 5f) and the root files.
- [x] 3. The CI workflow and test 4. `core.ref` names a commit that has `tooling/core-packs`.
- [ ] 4. First green run on the Mac (runner `af-mac-plus`). Pending: it runs when the PR is pushed.

## What was built

| Path | What |
|---|---|
| `package.json`, `pnpm-lock.yaml` | Private root; `packageManager` and `engines` as the framework's; devDependencies pinned to the framework's versions (Biome 2.5.15, TypeScript 7.0.2, Vitest 5.0.3, `@types/node` 24.19.1) plus `yaml` 2.9.1 (the version the framework's `packages/ship` and the website use) for the CI-shape test |
| `pnpm-workspace.yaml` | `packages/*`, `examples`, the framework's Node and install settings, and the `# core-overrides:begin` / `# core-overrides:end` block that `pnpm core:sync` writes |
| `.nvmrc`, `tsconfig.base.json`, `biome.jsonc` | Copied from the framework at `b7ef19d9`; the source commit is in a comment at the top of each JSON file |
| `core.ref` | One full commit, nothing else |
| `tooling/core/core-ref.ts` | Test 1: reads `core.ref` |
| `tooling/core/overrides.ts` | Test 2: reads and checks `packs.json`, writes the block |
| `tooling/core/sync-core.ts` | Test 3: the sync, with git and the shell as ports; the live ports |
| `tooling/core/manifest-rules.ts` | Test 5: license and core-as-peer rules; reads `packages/*/package.json` (also used by the sync) |
| `tooling/core/cli.ts` | `pnpm core:sync [--repository <url or path>]` |
| `tooling/ci/workflows.test.ts`, `.github/workflows/ci.yml` | Test 4 and the workflow |
| `AGENTS.md`, `CLAUDE.md` (`@AGENTS.md`), `LICENSE`, `README.md`, `.gitignore` | Root files |

## Red first

Each test file was run against a stub module (functions that throw "not implemented") or no module at all before the
code was written, and failed for that reason:

| Test | Red run |
|---|---|
| 1, `core-ref.test.ts` | 15 failed: "not implemented" |
| 2, `overrides.test.ts` | The file failed at collection: the `parsePacks` stub threw "not implemented" |
| 3, `sync-core.test.ts` | 17 failed and 1 passed. The pass was vacuous (the live-git failure test accepted any error), so its message was pinned, and then 18 of 18 failed |
| 5, `manifest-rules.test.ts` | 15 failed: "manifestProblems is not a function" and "workspaceManifestProblems is not a function" |
| `cli.test.ts` | 7 failed: "parseArgs is not a function", and the command exited 0 instead of 2 |
| 4, `workflows.test.ts` | Failed: ENOENT, `.github/workflows/ci.yml` |

## Mutation run (by hand)

Each mutant was applied alone, the file's tests were run, and the file was restored. The script and mutant lists were
scratch files and are not committed.

- **`overrides.ts` and `core-ref.ts`: 46 mutants.** The first pass killed 43. The three survivors were the name's
  start anchor and the version's two anchors; adding the cases `npm:@mcthaydt/automata-sim`, `v0.1.0`, `^0.1.0` and
  `0.1.0 || 0.2.0` brought it to 46 of 46. The plan lists the earlier survivors, and each has its own killed mutant
  now: the commit-hash end anchor (O1; `<commit>+dirty` and `<commit>x` are rejected), the folder pattern's first
  character (O11 to O14), an array and null accepted as a record (O19, O20), an unchecked `version`, `file` and
  `sha256` (O22 to O25), the empty string (an `''` case for each field), a non-string `dir` (O21), a pack that is
  not an object (string, null and array cases), and the END marker check (O33). The `.tgz` end anchor got its case
  (`automata-sim-0.1.0.tgz.part`) before the run.
- **`sync-core.ts`: 27 mutants, 25 killed, 2 not killed.** G5 (`git init` even when `.git` exists) is equivalent:
  re-running `git init` on a repository is harmless. Turning git's prompts back on (G6) first survived, so the
  environment became a pure function, `gitEnv`, with its own test, and that mutant is killed. G7, where the live port
  stops using `gitEnv`, survives: only a terminal shows the difference, and the test machine has none.
- **`manifest-rules.ts`: 11 mutants.** The first pass killed 10. The survivor was reading a package folder that
  has no `package.json` (a deleted package that left its ignored `node_modules` behind); with that case added,
  11 of 11 are killed.
- **`.github/workflows/ci.yml`: 18 mutants, 18 killed.** They were a hosted label in `runs-on`, an array and an
  expression in `runs-on`, a hosted label in a comment, no fork guard, a weaker guard, a second job without the
  guard, the install before the sync, a kept checkout token, a secret, an unpinned action, a checkout of the
  framework, a hosted-only cache, no own pnpm folder, event text in a script, a push trigger on every branch, write
  permission, and no `pnpm check`. A second workflow file with `runs-on: ubuntu-24.04` fails 2 tests.

## The real sync, against the local framework clone

- **First run:** 2026-10-30, 00:59:06Z to 00:59:38Z. The command was
  `pnpm core:sync --repository /home/user/automata-framework`, run in the new worktree with no `.core/`. Wall time
  was **32.6 s**; the sync itself reported "done in 31.5 s".
  - The fetch by commit from the shallow local clone took under 1 s.
  - The framework install took 3 s (327 packages, 313 reused from the store).
  - The build took 20.4 s (12 turbo tasks, 0 cached).
  - It wrote **10 packs**. Sizes of the tarballs, all at 0.0.3: ui 112 KB, ship 76 KB, host 56 KB, content 52 KB,
    sim 36 KB, testing 28 KB, physics 12 KB, check-boundaries 8 KB, node 4 KB; and evidence 0.0.0, 12 KB.
  - `git status` in `.core/af` was clean afterwards.
  - The block it wrote is the one committed in `pnpm-workspace.yaml`.
- **Second run:** it skipped the framework work, took 1.1 s, and left `pnpm-workspace.yaml` byte-identical.
- **Install:** `pnpm install` recorded the 10 overrides in `pnpm-lock.yaml`, and `pnpm install --frozen-lockfile`
  then passed. On a copy with no `.core/`, `pnpm install --frozen-lockfile` also passes, because no package depends
  on core yet. From 5f on, the sync comes first, as the README and CI do.
- **Scratch proof (not committed):** a copy of the workspace with a probe package that lists
  `@mcthaydt/automata-sim` as a peer and a dev dependency.
  - A fresh sync took 48.3 s.
  - The probe resolved `@mcthaydt/automata-sim` from `.core/packs/automata-sim` (23 exports), with one `koota`
    (0.6.6) in the tree.
  - `rm -rf .core/packs`, then a sync (19.0 s, with the framework's turbo cache warm), then
    `pnpm install --frozen-lockfile` left the lockfile byte-identical. This is the P5-D1 claim, checked with the
    generated block.

## Deviations from the plan, with the reason for each

1. **`biome.jsonc`, not `biome.json`.** Biome refused a comment in `biome.json` ("Expected an array, an object, or a
   literal"), and the plan wants the source commit in a comment. The settings are the framework's; the excludes that
   name framework folders, and the `packages/sim` override, are dropped, as the comment says.
2. **A skipped sync still writes the block.** The plan says the sync "stops" when `packs.json` records `core.ref`.
   Here the framework work stops, but the block is still written from the existing `packs.json`. The names Plus has
   itself can change without `core.ref` moving (5f adds physics, which the framework still packs until 5g). Writing
   an unchanged block changes nothing.
3. **A dirty `packs.json` is refused.** The framework's packer writes `<commit>+dirty` when it packs an unclean tree
   with `--allow-dirty`. Plus installs only from a clean commit; the sync always passes `--source-commit`.
4. **`--repository`.** It is not in the plan. It lets a sync be proved against a local clone, as this slice was. The
   default is the framework on GitHub.
5. **`vitest.config.ts` is not type-checked**, as in the framework's tooling: `isolatedDeclarations` cannot infer its
   default export.
6. **Test 4 pins more than the plan's three points.** Beyond `af-mac`, no hosted label and the fork guard, it also
   pins:
   - triggers and read-only permissions;
   - actions pinned to commits;
   - no kept checkout token and no secret;
   - no checkout of the framework (it comes through the sync's plain git);
   - pnpm's own folder and no hosted-only cache;
   - no event text in scripts;
   - sync, then install, then check.

   These are the website's pins that apply to Plus.

## Gates

| Gate | Result |
|---|---|
| `pnpm format` | No fixes left |
| `pnpm check` (lint, typecheck, unit) | Green: 6 files, 135 tests |
| Real `pnpm core:sync` against the local framework clone | 10 packs, 32.6 s; the skip run took 1.1 s |
| `pnpm install --frozen-lockfile` after the sync | Green |
| Hand mutation run | 46 of 46, 25 of 27 (1 equivalent, 1 needs a terminal), 11 of 11, 18 of 18 |
| actionlint | **Omitted.** The container's Docker has no daemon, and fetching the release binary was not permitted. The workflow parses as YAML in test 4; the Mac's first run is the check |
| First CI run on the Mac | **Pending** (step 4) |

## Follow-ups

- **5f:** each Plus package needs its own `LICENSE` file. `"SEE LICENSE IN LICENSE"` is read from the package's
  folder, and the root `LICENSE` is not in a published tarball.
- **5f:** a package's `tsconfig.json` extends `../../tsconfig.base.json`, and the root `test` and `typecheck` scripts
  grow to run the packages' own projects.
- **5h:** the block and `.core/` go away when core is on GitHub Packages (P5-D1).
- `core.ref` moves only when Plus needs a newer core. Each move is a commit of `core.ref`, `pnpm-workspace.yaml` and
  `pnpm-lock.yaml`.
