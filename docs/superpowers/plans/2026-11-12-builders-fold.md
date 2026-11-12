# The builders move into the framework: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task by task,
> in one session per branch, with no subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fresh clone of the framework builds, checks and tests with no submodule and no second repository; the
figure painter lives in the framework with its history and its five goldens unmoved; what EnvironmentBuilder still had
that the framework lacked is in the framework, and the rest is recorded as not wanted, file by file.

**Architecture:** FigureBuilder's code arrives as a private extension, `extensions/painted-figures`
(`@automata/painted-figures`), by a filtered history merge, byte for byte, and its own suite passes there before
anything is changed. The character kit's one door then points at the package, the submodule and its wrapper go, the
wardrobe branch arrives as its own commits, and only then is the source brought under the framework's rules, one rule
a commit, with the goldens run after each. EnvironmentBuilder moves almost no code: the survey found its features
already ported, so its group is proof and record.

**Tech stack:** TypeScript 6.0.3, PixiJS 8.22.0 with `@pixi/3d` 0.1.0-beta.2, Vitest 5.0.3 (unit and browser
projects, `@automata/vitest-preset`), Playwright 1.63.0, Biome, pnpm and turbo, `git filter-repo` 2.47.0.

**Spec:** [`../specs/2026-11-12-builders-into-the-framework-design.md`](../specs/2026-11-12-builders-into-the-framework-design.md).
**Surveys:** [`figure-builder.md`](../audits/2026-11-12-builders-fold-survey/figure-builder.md) and
[`environment-builder.md`](../audits/2026-11-12-builders-fold-survey/environment-builder.md): read them first; this plan
argues from their measurements. **Tracker:** [`../progress.md`](../progress.md), workstream 6.

## Tracking

**0 of 19 tasks done (0%)** (task 20 is conditional and counted only if the Owner chooses it). Tick a task only when
its checks passed in the session that did it; say what did not run.

| # | Task | Branch | State | Evidence |
|---|---|---|---|---|
| 1 | The baseline, and the checksum manifest | `claude/builders-fold-figures` | todo | |
| 2 | The painter's source arrives with its history; its own suite passes as it is | `claude/builders-fold-figures` | todo | |
| 3 | The character kit's door points at the package | `claude/builders-fold-figures` | todo | |
| 4 | The submodule and its wrapper go | `claude/builders-fold-figures` | todo | |
| 5 | The wardrobe branch arrives as its own commits | `claude/builders-fold-figures` | todo | |
| 6 | Conform: the framework's format | `claude/builders-fold-figures` | todo | |
| 7 | Conform: the framework's layout, test imports, runner and boundaries | `claude/builders-fold-figures` | todo | |
| 8 | Conform: lint, one rule a commit | `claude/builders-fold-figures` | todo | |
| 9 | Conform: no file over 600 lines | `claude/builders-fold-figures` | todo | |
| 10 | Conform: the eight libraries are checked by Zod | `claude/builders-fold-figures` | todo | |
| 11 | Conform: the view check is a browser suite | `claude/builders-fold-figures` | todo | |
| 12 | Conform: the words (readme, contract, comments, provenance) | `claude/builders-fold-figures` | todo | |
| 13 | Group 1 closes: the gates whole, the record, the pull request | `claude/builders-fold-figures` | todo | |
| 14 | The workflows lose the submodule step (only with the Owner's word) | `claude/builders-fold-figures` | todo | |
| 15 | The tiles golden, restated as a world-kit check | `claude/builders-fold-scenes` | todo | |
| 16 | What the builder changed after the ports were read | `claude/builders-fold-scenes` | todo | |
| 17 | The photo process as the world kit's document | `claude/builders-fold-scenes` | todo | |
| 18 | The provenance table at `f7c5356`; the ledger rows | `claude/builders-fold-scenes` | todo | |
| 19 | Group 2 closes: the retirement notes, the gates whole, the pull request | `claude/builders-fold-scenes` | todo | |
| 20 | Conditional: the CPU scene renderer as a reference tool (only if the Owner chooses option B) | `claude/builders-fold-scenes` | not planned | |

## What this plan settles

Each has the recommendation and its reason. Where the decision is the Owner's, the options and the default are under
"Questions for the Owner".

### 1. History

**FigureBuilder: a filtered history, merged once.** `git filter-repo` keeps only the code paths (`src`, `base`,
`tests`, `scripts`, `viewer`, `package.json`, `tsconfig.json`, `vitest.config.ts`), rewrites them under
`extensions/painted-figures/`, and the result is merged with `--allow-unrelated-histories` in one merge commit whose
subject is a Conventional Commit. `git log` and `git blame` then work on the new paths with no extra flags.

- Size, measured: the filtered history is **243 commits and 1.64 MB packed** (`main`, 236 commits, with the wardrobe
  branch's 7), dry-run in a scratch clone with the exact command of task 2; all of `main` unfiltered is 347 commits
  and 20.6 MB, because of 228 audit PNGs (12.2 MB) that the framework does not want in its history. The framework's clone here is shallow (483 commits,
  100.32 MiB), so its full size was not measured; the fold adds about 2 MB to whatever it is.
- The imported commits keep their own subjects (10 of 347 are Conventional Commits). They are history, not new work;
  rewriting their messages would falsify the record. Nothing in the repository checks commit subjects (no commit-lint
  in `lefthook.yml` or the workflows). The rule "Conventional Commits on a branch with a pull request" holds for every
  commit this plan authors, the merge commits included.
- Commit ids change. `filter-repo`'s commit map (old id to new id) is committed as
  `docs/provenance/painted-figures-commit-map.txt`, so an id quoted in an old document (`d5ca055`) can be found.
- **A checksum manifest is written whichever way history goes**: `docs/provenance/painted-figures-manifest.json`,
  the SHA-256 of each of the 131 files under the five folders and the 3 root files at `23f889c8`, checked against the
  merged tree in task 2.
- A subtree merge of the whole history is rejected: it brings the 20.6 MB and 271 `docs/` files whose Markdown the
  framework's `pnpm style` would then read.
- **Fallback:** if `git filter-repo` cannot be installed in the execution session, a plain copy with the manifest and
  the source commit in `docs/provenance/sources.md` (the spec's rule 4 allows it). Say so in the log.

**EnvironmentBuilder: no code moves under the default, so there is no history to carry.** Its record is
`docs/provenance/sources.md` brought to `f7c5356` with a row for every file (task 18); its photos are already in the
framework, byte-identical.

### 2. Goldens

- **FigureBuilder's five run in the framework's test runner, in `pnpm test:unit`, so in `pnpm check`, in `ci.yml` on
  every pull request, and in the commit hook when the package or something it depends on changed.** `AGENTS.md`: "The
  gate runs every unit test". Until task 7 they run through the builder's own `vitest.config.ts`; after it, through
  `@automata/vitest-preset`.
- **Time, measured** (x86_64, 4 cores): the five goldens with `ulp.test.ts` and `identity.test.ts` take **27 s** under
  the framework's Node 24.21; the whole suite (47 files, 561 tests) takes at most **227 s** (another suite shared the
  cores). Turbo caches it when the package's inputs have not changed, so it is paid only by commits that touch the
  painter. A session that has just run the whole `pnpm check` on the tree it commits may skip the hook
  (`LEFTHOOK=0`), by the Owner's rule of 2026-11-11.
- **The view check** (GPU frame equal to the CPU's, byte for byte) becomes a browser suite in task 11 and runs with
  `pnpm test:browser:3d` and in `.github/workflows/3d.yml`, not in `pnpm check`. Until task 11 it is run by hand after
  any change under `src/features/view/`.
- **EnvironmentBuilder's three:** see the first question for the Owner. Measured: `base` (8 frames) and `scenes`
  (14 frames) move as soon as its painter is the framework's pin. Default: they do not come; `tiles` comes restated
  (task 15).
- **The character kit's and the world kit's goldens do not move.** The kit's are run in tasks 3, 4, 5 and after every
  conform task.

**Every place a golden could move. Each is a stop: do not re-record, write what moved in the log, tell the
coordinator.**

| Where | Why it could move | What catches it |
|---|---|---|
| Task 2, the arrival | a file differs from the source; Node 24 or Vitest 5.0.3 in place of the builder's | the manifest check; the builder's suite as it is (measured: the goldens pass under Node 24.21) |
| Task 3, the door | the kit resolves a different copy of `pixi.js` or `@pixi/3d`, or different source | the kit's unit goldens (`runway-cells.json` and the others under `tests/fixtures/goldens/`) and its Chromium suite |
| Task 5, the wardrobe branch | its seven code commits change `hair.ts`, `garments.ts`, `paint.ts`, `parts.ts`, `fit.ts` | the five goldens, the branch's own pins, the kit's goldens |
| Task 6, format | none expected (syntax only) | the suite |
| Task 7, the layout | a golden reads its data by a relative path; module load order changes with the move | the suite; a golden that cannot find its data fails loudly |
| Task 8, lint | a rewritten assignment-in-expression, a NaN test, a removed `!` | the suite after each rule |
| Task 9, the splits | registries fill at module load; the part index seeds the grain, so order matters | the suite after each split |
| Task 10, Zod | a parse that drops or reorders keys changes iteration order | a key-order test written first; the suite |
| Task 11, the browser suite | none to CPU goldens; the GPU cases are new recordings of equality, not images | the cases themselves |
| Task 15, the tiles | the world kit's pipeline has drifted from the builder's | the cross-check itself |
| Task 16, the hunks | a ported hunk changes a framework frame | the 3D package's and the world kit's suites |
| Any task, another machine | a last bit of `Math.sin` on another architecture (the arm64 difference fixed in `d5ca055`) | `ulp.test.ts` in the suite; the pull request's CI run; the Owner's run on arm64 (task 13) |
| After the fold, the `@pixi/3d` beta.3 upgrade | `FlatMaterial` encodes colour for display; the material template changes | `tests/unit/view/template.test.ts` fails by design; the browser suite of task 11 |

### 3. The move and the conform are separate

Tasks 2 to 5 move: after them the source is the builder's own, byte for byte, and its suite passes as written. Tasks 6
to 12 conform, each a commit or a short run of commits that changes one thing and proves no pixel changed.

| Task | Conform step | What it proves |
|---|---|---|
| 6 | Biome's format | `pnpm lint` reads the package's formatting; the temporary Biome exclusion is half gone |
| 7 | `src/shared/<layer>/`, `src/features/view/`, `src/entries/`; tests in `tests/unit/`; `#src/…` imports; the framework's Vitest preset; the layer test restated | `pnpm boundaries --features` and `style`'s test-imports rule pass with the package in their lists; the layer order still holds |
| 8 | Biome's lint rules, one a commit | `pnpm lint` passes with no exclusion |
| 9 | Files of at most 600 lines | `pnpm style` passes with the package in its names, length and plan-comments list |
| 10 | Zod schemas for the eight libraries | a wrong library fails at load, in words |
| 11 | `view-check` as a browser suite | the GPU equality runs in a gate, not by hand |
| 12 | The readme, the contract, comments, provenance | no path or comment names the submodule; the builder's rules are written in the framework's form |

Not conformed in this plan, and named so: the two stricter compiler flags (below).

### 4. Order against the `@pixi/3d` beta.3 upgrade

**The fold's first group lands first, on beta.2. Then the upgrade.**

- The painter's view (`src/features/view/`, 482 lines) is written for beta.2. `cell-template.ts` is a copy of
  beta.2's WGSL material template with four edits, and `tests/features/view/template.test.ts` reads the installed
  `@pixi/3d` and fails when its template moves on. The character kit draws painted figures through that `CellSprite`.
- Today that code is in the submodule, where the upgrade branch cannot change it. So the upgrade cannot finish before
  the fold without breaking painted figures under WebGPU, and the fold cannot run the builder's suite "as it is" on
  beta.3.
- From the beta.3 notes (`vendor/pixi-3d/release-notes-0.1.0-beta.3.txt`), what touches a sprite-drawn figure:
  - **Unlit colours drawn as authored:** `FlatMaterial` and `Sprite3D` "now encode their colour inputs for display, so
    they render differently with no code change". `CellMaterial` is a `FlatMaterial`: the byte equality with the CPU
    frame must be proven again.
  - **Tone mapping defaults to `none`:** `StageView` already passes `toneMapping: 'none'`, so its own view does not
    change; a host's view that relied on the default does.
  - **Samplers:** per-texture samplers on WebGPU make the template's texel snap (there because the batch sampler was
    linear) unnecessary; the copy of the template has to be remade from beta.3's either way.
  - **Depth:** the figure's per-texel depth is its own shader bit (`gl_FragDepth`, and `@builtin(frag_depth)` through
    the template copy); a view with a `beforeToneMapping` effect now draws into `rgba16float` linear light, which a
    host's passes must account for.
  - `Sprite3D` takes one options object; `cull` defaults to `'gpu'`.
- **What the other redoes.** Fold first: the upgrade redoes nothing of the fold; it gains one more package whose
  `file:` specifier moves, and it ports the view in place with the browser suite of task 11 as its proof. Upgrade first
  (not recommended): the fold's task 2 skips `template.test.ts` and the view check with a note, and the view's port
  becomes a fold task.

### 5. What retires

In tasks 3, 4 and 12 (no workflow file among them):

| File | What happens |
|---|---|
| `.gitmodules` | deleted |
| `vendor/FigureBuilder` (the gitlink) | removed with `git rm` |
| `vendor/figure-builder/package.json`, `types.mjs`, `tsconfig.types.json`, and the links `src`, `base` | deleted; the declarations step moves into the package (below) |
| `pnpm-workspace.yaml` | the comment and the entry `vendor/figure-builder` go |
| `biome.json` lines 20 and 21 | the two exclusions go |
| `knip.jsonc` lines 8, 9 and 28 to 31 | the ignore entry and the wrapper's workspace go; the package gets its own entry |
| `.gitignore` lines 41 and 42 | replaced by `extensions/painted-figures/types/` |
| root `package.json`, `boundaries` | `figure-builder` becomes `@automata/painted-figures` in the 13 `--forbid` entries |
| root `package.json`, `@pixi/3d` and `pixi.js` | removed if nothing else needs them (they are there because the submodule's sources resolved from the root); kept with a new comment if a check fails without them |
| `tooling/release/tests/unit/closed-beta-guard.test.ts` lines 33 and 35 | the forbidden name becomes `@automata/painted-figures` |
| `extensions/character-kit/package.json` line 38 | `"figure-builder": "workspace:*"` becomes `"@automata/painted-figures": "workspace:*"` |
| `extensions/character-kit/src/shared/figure-builder/door.ts`, `door-view.ts` | new specifiers; the folder becomes `src/shared/painted-figures/` in task 12 |
| `extensions/character-kit/README.md` lines 52 and 53, and the 10 kit files that say "submodule", "upstream" or `vendor/FigureBuilder` | reworded |
| `docs/provenance/sources.md`, "The figure builder as a submodule (2026-11-10)" | kept as history; a section "The figure painter, folded in" follows it |

**The hand-run type step does not vanish; it stops being hand-run.** The kit and everything that imports the kit are
compiled with the framework's strict base, and a `.ts` source they import is checked with *their* options: importing
the painter's source directly would put its 1,395 strict errors into the kit's typecheck. That is why the wrapper
builds declarations with the builder's own settings. The package keeps that: `tsconfig.types.json` and a `prepare`
script emit `types/`, and `exports` names the declarations as `types` and the source as `default`. With the source in
the repository, `pnpm install` always runs it, so no session runs it by hand and a fresh clone needs no manual step.
It goes for good when the painter passes the two strict flags (following work).

In task 14, **only with the Owner's word quoted in the pull request** (line numbers at `main` `0df11a43`):

| File | Lines |
|---|---|
| `.github/workflows/ci.yml` | the step at 80-85, 174-179, 252-257, 316-321, 380-385; the secret passed at 419 and 436 |
| `.github/workflows/3d.yml` | the path filters and their comment at 23-25; the step at 58-63 and 116-121; the secret passed at 162 |
| `.github/workflows/release-packages.yml` | the step at 81-86 and 148-153; the secret passed at 126 |
| `.github/workflows/release-checks.yml` | the secret declared at 20-21; the step at 46-51 |
| `.github/workflows/game-ci.yml` | the secret declared at 29-30; the step at 47-52 |
| `.github/workflows/site.yml` | the secret declared at 22-23; the step at 52-58 |
| `.github/workflows/windows-trial.yml` | the step at 33-39 and 71-77 |
| `.github/workflows/consumer-smoke.yml` | the step at 40-45 |
| in each | the `secrets:` key itself where `SUBMODULES_TOKEN` was its only entry |

73 lines name the submodule or the token across the eight files. With them go, in the same commit:
`.github/scripts/checkout-submodules.sh`; `tooling/repo-hygiene/tests/unit/checkout-submodules.test.ts`; rule 6 and the
token's entries in `tooling/repo-hygiene/src/workflow-invariants.ts` (lines 11-12, 41, 46-47, 87-90, 102-104, 117-138)
with the four cases of its test (lines 81, 95, 118, 141); `docs/runbook.md` line 63. The secret itself is the Owner's
to delete.

Measured: with no `.gitmodules`, `checkout-submodules.sh` exits 0 with and without a token. So tasks 1 to 13 leave
every workflow untouched and CI still runs; the step is a no-op until task 14.

### 6. Workstream 4's tasks 13 to 16 after the fold

Written as an addendum at the end of this plan ("Addendum for workstream 4's plan"), for the coordinator to move.

### 7. The two old repositories

The note each gets is under "The retirement notes". No session pushes to them. Open branches besides `c9-wardrobe`
are listed in the surveys; the two that carry painter work not on `main` (`claude/c5-finish-fixes`,
`claude/turned-face-both-eyes`) are the third question for the Owner.

### 8. Risks, and how the plan would notice each

| Risk | How it is noticed |
|---|---|
| A golden moves on another machine architecture | `tests/unit/hair/ulp.test.ts` redraws with the maths a last bit off and runs in every `pnpm check`; the pull request's CI runs the suite on the runner's architecture; task 13 asks the Owner for one run on arm64 before merge (`pnpm --filter @automata/painted-figures test:unit`). A difference is fixed in the painter, never with a per-architecture golden |
| Test time added to `pnpm check` and the commit hook | task 1 times `pnpm check` and `pnpm test:unit` before; task 13 times them after. More than 5 minutes added to an uncached `pnpm check` is reported to the coordinator with the slowest files (`vitest --reporter=verbose`), not fixed by moving goldens out of the gate |
| Repository size | task 1 records `git count-objects -vH`; task 13 records it again. Expected growth about 2 MB. More than 5 MB is a stop: something that is not code came across (check `git rev-list --objects` for the largest new blobs) |
| Licence records for photos | nothing moves: the 38 photos are already in the kit with source, licence and credit, and `extensions/world-kit/tests/unit/textures/swatch-tiles.test.ts` fails without them. Task 17's document says where the record lives. The painter has no third-party asset: no PNG, font or sound in its source or tests |
| Name clashes | the package's `Figure`, `Cell`, `stageFrame`, `lightSprite`, `POSES`, `GAITS` sit beside core's mesh figures (`packages/3d/src/features/figures/`), the `figure` content kind and `spriteLight` in `packages/3d/src/features/look/sprite-light.ts`. Task 12 lists every export name the package shares with `@automata/3d`'s entries (a command, below) in the package's readme with one line each on which is which. No module can import the wrong one by accident: the kit's door test allows only the door files to import the package, and `pnpm boundaries --forbid` keeps it out of core |
| The declarations go stale | the package's `typecheck` rebuilds them and turbo runs it before the kit's (a `dependsOn` in `turbo.json`); `pnpm install` builds them on a fresh clone |
| The filtered history is not the source | the manifest check of task 2: 134 files, each SHA-256 equal to `git show 23f889c8:<path>` |

## Questions for the Owner

Sent to the coordinator while this plan was written; the plan proceeds on each default.

1. **EnvironmentBuilder's goldens.** Measured: with its painter at the framework's pin, `tests/golden/base.test.ts`
   (8 of 8) and `tests/golden/scenes.test.ts` (14 of 14) fail; `tiles` passes. **A (default):** the CPU scene renderer
   and those two goldens do not come; the `tiles` golden comes restated as a world-kit check; the spec's rule 1 is
   amended to say so. **B:** the CPU scene renderer comes as a private reference tool and the two goldens are
   re-recorded once, in one named commit (task 20). **C (rejected):** a frozen second copy of the painter.
2. **The workflow files.** **(a, default):** the fold lands with the submodule steps left as no-ops and task 14 waits
   for the Owner's word. **(b):** the Owner gives the word now and task 14 runs before task 13.
3. **FigureBuilder's branches with painter work not on its `main`** (`claude/c5-finish-fixes`, 8 fixes;
   `claude/turned-face-both-eyes`, a fix that re-records a golden). **(a, default):** they stay in the retired
   repository and are listed as following work. **(b):** they are brought as framework changes after the fold.
4. **The retirement note.** **(a, default):** the Owner pastes the note below into each `README.md` and archives.
   **(b):** the Owner grants one session push access to add it.
5. **The package's licence.** FigureBuilder records none. **Default:** `"license": "MIT"`, `"private": true`, as the
   two kits say.

## Calls made in this plan, for the coordinator to check

1. **The home and the name:** a private extension, `extensions/painted-figures`, `@automata/painted-figures`
   (the other name considered: `@automata/figures`). Reasons in the survey.
2. **The Pixi-free pipeline lives in `src/shared/<layer>/`**, not in `src/features/`: the framework's feature rule
   forbids one feature importing another, and the pipeline is layers. `src/features/view/` is the one feature.
3. **The layer order stays a test in the package** (`tests/unit/layers.test.ts`), not a new rule in
   `automata-check-boundaries`: it runs in `pnpm check` through `test:unit`, and a new boundaries mode would change a
   published package for one private consumer.
4. **The fold lands before the beta.3 upgrade.**
5. **Filtered history, not a subtree merge and not a plain copy.**
6. **Two compiler flags stay off for the painter** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), with
   the declarations step kept until they are on. 1,395 errors otherwise, each fix a possible change of code path.
7. **`@napi-rs/canvas`** (not in the lockfile) stays a `devDependency` of the private package for its hand-run sheet
   scripts; `pnpm deps:new` will report it.
8. **The builder's `docs/superpowers/` and its 228 PNGs do not come.** The wardrobe cycle's spec, plan and plan audit
   are copied to `docs/archive/figure-painter/c9-wardrobe/` (links there are not checked), because workstream 4's
   remaining wardrobe tasks use that plan as their step-level text.
9. **EnvironmentBuilder's GPU harness is not wanted** (the builder's own log ended it: `9c2df06`, "the look moves to
   AutomataFramework"); its `gpu:parity` idea is listed as following work.
10. **Tuning a swatch's knobs against its reads is an editor gap**, not a command to port.

## Global constraints

- **No pixel changes.** No recorded golden, image or hash is re-recorded in this plan. One that would move stops the
  task. The only new recordings are first recordings named by their task (none in group 1; the restated tiles list in
  task 15, which is the builder's own data).
- **The move and the conform are separate commits.** Tasks 2 to 5 change no line of the builder's source or tests.
- **The framework's rules** (`AGENTS.md`): feature folders, `pnpm boundaries`, tests in `tests/` importing `#src/…`,
  kebab-case names, files of at most 600 lines, Zod as the only schema language, PixiJS only for rendering, comments
  that say why and not which plan asked.
- **Private until Pixi 3D is public.** `"private": true`; no changeset; `pnpm boundaries --forbid` and the closed-beta
  guard keep the package out of everything published.
- **No paid stage and no model call.**
- **Neither builder is core.** Brand or game content does not come: no branch but `main` and `claude/c9-wardrobe`.
- **Test first where code changes** (tasks 7, 10, 11, 14, 15, 16): the failing test is written and seen to fail for
  the right reason before the change.
- **Stage files by path.** Never `git commit -a`. `pnpm format` before each commit. Conventional Commits.
- **Workflow files change only in task 14**, with the Owner's word quoted in the pull request.
- **Never push to `mcthaydt/FigureBuilder` or `mcthaydt/EnvironmentBuilder`.** Clone them read only, outside the
  framework's working tree.

### The gates

- After every task: `pnpm check` (exit 0), and the suites the task names.
- The painter's suite: `pnpm --filter @automata/painted-figures test:unit`. Expected until task 5: 47 files, 561
  tests. After task 5 the count grows by the wardrobe branch's five test files; record the new numbers there and use
  them from then on. After task 7 the file count is the same and the paths are `tests/unit/…`.
- The kit: `pnpm --filter @automata/character-kit test:unit`, then in Chromium
  `AF_WEBGPU=software pnpm --filter @automata/character-kit test:browser`. Record the counts in task 1 and expect the
  same ones after.
- Chromium only, on software GL. WebKit, Firefox, a real GPU and arm64 are not run by a session; say so.

## Review focus

The conditions the spec implies and no single task's test exercises, most likely first. Each is pinned in the task
named.

1. **A fresh clone with no submodule and no manual step.** After task 4, clone the branch into a scratch folder with
   plain `git clone`, run `pnpm install --frozen-lockfile` and `pnpm check`: both must pass with nothing else typed
   (task 4, step 6; again in task 13).
2. **A pull request from a fork has no secrets.** The submodule step must stay harmless with no token until task 14
   (task 4, step 5 runs the script both ways).
3. **A stale `types/` folder.** Edit one exported type in the painter and run `pnpm typecheck` once: the kit must see
   the new type without a second command (task 3, step 5).
4. **A library file with a wrong field.** After task 10 a misspelt key in `swatches.json` fails at load, naming the
   file and the key, not as a wrong colour later (task 10, step 1).
5. **A consumer that reaches past the entries.** `import '@automata/painted-figures/features/paint/paint'` must not
   resolve: the package exports three entries and no wildcard (task 3, step 1's test).

---

## Group 1: FigureBuilder (`claude/builders-fold-figures`)

From `origin/main`. One draft pull request at the end of task 13. In every command below, `$FB` is a scratch clone of
`https://github.com/mcthaydt/FigureBuilder` outside the framework's working tree, and `$PIN` is
`23f889c8a5cda3511f4a2d044324c57ba624dc1c`.

### Task 1: The baseline, and the checksum manifest

**Files:**
- Create: `docs/provenance/painted-figures-manifest.json`

- [ ] **Step 1: The baseline.** `git submodule update --init`, `pnpm install --frozen-lockfile`, then `pnpm check`
  (expect exit 0), `pnpm --filter @automata/character-kit test:unit`,
  `AF_WEBGPU=software pnpm --filter @automata/character-kit test:browser`, `git count-objects -vH`. Time `pnpm check`
  and `pnpm test:unit` with `time`. Write every count and time in the log: they are what later tasks are held to.
- [ ] **Step 2: The manifest.** With `$FB` at `$PIN`:

```bash
node -e '
const { execFileSync } = require("node:child_process"), { createHash } = require("node:crypto"), fs = require("node:fs")
const [src, commit] = process.argv.slice(1)
const keep = /^(src|base|tests|scripts|viewer)\/|^(package\.json|tsconfig\.json|vitest\.config\.ts)$/
const files = execFileSync("git", ["-C", src, "ls-tree", "-r", "--name-only", commit], { encoding: "utf8" }).trim().split("\n").filter((f) => keep.test(f))
const out = { source: "mcthaydt/FigureBuilder", commit, home: "extensions/painted-figures", files: {} }
for (const f of files) out.files[f] = createHash("sha256").update(execFileSync("git", ["-C", src, "show", `${commit}:${f}`])).digest("hex")
fs.writeFileSync("docs/provenance/painted-figures-manifest.json", `${JSON.stringify(out, null, 2)}\n`)
console.log(files.length)' "$FB" "$PIN"
```

  Expected output: `134` (47 in `src`, 1 in `base`, 73 in `tests`, 6 in `scripts`, 4 in `viewer`, 3 root files).
- [ ] **Step 3: Commit.** `git add docs/provenance/painted-figures-manifest.json`, then
  `chore(provenance): the figure painter's files at 23f889c8, by checksum`.

**Done when:** the log holds the baseline numbers and the manifest lists 134 files.

### Task 2: The painter's source arrives with its history; its own suite passes as it is

**Files:**
- Create (by merge): `extensions/painted-figures/{src,base,tests,scripts,viewer}/**`, `package.json`,
  `tsconfig.json`, `vitest.config.ts`
- Create: `extensions/painted-figures/tsconfig.types.json`, `docs/provenance/painted-figures-commit-map.txt`
- Modify: `extensions/painted-figures/package.json`, `biome.json`, `knip.jsonc`, `.gitignore`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: the workspace package `@automata/painted-figures` with `exports` `"."`, `"./kit"`, `"./view"`, each
  `{ "types": "./types/src/<entry>.d.ts", "default": "./src/<entry>.ts" }` for `index`, `kit`, `view`; and its
  scripts `prepare`, `typecheck`, `test:unit`.

- [ ] **Step 1: Filter.** In a second fresh clone (filter-repo rewrites the clone it runs in):

```bash
python3 -m pip install --user git-filter-repo==2.47.0
git clone https://github.com/mcthaydt/FigureBuilder "$FB-filtered" && cd "$FB-filtered"
git branch claude/c9-wardrobe origin/claude/c9-wardrobe
git filter-repo --force \
  --path src --path base --path tests --path scripts --path viewer \
  --path package.json --path tsconfig.json --path vitest.config.ts \
  --to-subdirectory-filter extensions/painted-figures \
  --refs refs/heads/main refs/heads/claude/c9-wardrobe
```

  Expected, from the plan session's dry run in a scratch clone: `git log --oneline main | wc -l` prints **236** (the
  commits that touched none of the kept paths are dropped); `git ls-tree -r --name-only main | wc -l` prints **134**,
  none outside `extensions/painted-figures/`; `git rev-list --count main..claude/c9-wardrobe` prints **7** (the
  branch's code commits; its three document and evidence commits are dropped) and the branch sits on the filtered
  `main`; the two refs together pack to about 1.6 MB. If `pip` cannot install the tool, use the fallback of "History" and say
  so.
- [ ] **Step 2: Merge.** In the framework:

```bash
git remote add painter-history "$FB-filtered" && git fetch painter-history
git merge --allow-unrelated-histories --no-ff painter-history/main \
  -m "chore(painted-figures): the figure painter's source arrives with its history"
cp "$FB-filtered/.git/filter-repo/commit-map" docs/provenance/painted-figures-commit-map.txt
```

  The merge commit's body says: the source repository, `$PIN`, the paths kept, the paths left out and why, and that
  the imported commits keep their own subjects.
- [ ] **Step 3: The manifest check.** Every file equal to its source:

```bash
node -e '
const { createHash } = require("node:crypto"), fs = require("node:fs")
const m = JSON.parse(fs.readFileSync("docs/provenance/painted-figures-manifest.json", "utf8"))
const bad = Object.entries(m.files).filter(([f, sha]) => createHash("sha256").update(fs.readFileSync(`${m.home}/${f}`)).digest("hex") !== sha)
console.log(Object.keys(m.files).length, "files,", bad.length, "differ"); process.exit(bad.length ? 1 : 0)'
```

  Expected: `134 files, 0 differ`. Anything else is a stop.
- [ ] **Step 4: Make it a workspace package, changing no source or test.** Edit only
  `extensions/painted-figures/package.json`: `"name": "@automata/painted-figures"`, `"version": "0.0.0"`,
  `"private": true`, `"license": "MIT"`, `"type": "module"`, the `exports` above, `"dependencies"`
  `{ "@pixi/3d": "file:../../vendor/pixi-3d/pixi-3d-0.1.0-beta.2.tgz" }`, `"peerDependencies"`
  `{ "pixi.js": "8.22.0" }`, `"devDependencies"` at the kit's versions (`pixi.js` 8.22.0, `typescript` 6.0.3,
  `vite` 8.3.3, `vitest` 5.0.3, `playwright` 1.63.0, `tsx` 4.23.15, `@types/node` 24.19.1) plus `@napi-rs/canvas`
  `1.0.10`, and the scripts `"prepare": "tsc -p tsconfig.types.json"`,
  `"typecheck": "tsc -p tsconfig.types.json && tsc --noEmit"`, `"test:unit": "vitest run"`, and the builder's
  `render`, `golden`, `lit`, `actors`, `c5`, `view-check` with `tsx` in place of `vite-node`. Copy
  `vendor/figure-builder/tsconfig.types.json` to `extensions/painted-figures/tsconfig.types.json` unchanged but for
  its comment. Add `extensions/painted-figures/types/` to `.gitignore`. Add, each with a comment that task 6 or task 7
  removes it, `"!extensions/painted-figures"` to `biome.json`'s `files.includes` and
  `"extensions/painted-figures/**"` to `knip.jsonc`'s `ignore`.
- [ ] **Step 5: Install and run the builder's suite as it is.** `pnpm install` (the lockfile changes), then
  `pnpm --filter @automata/painted-figures test:unit`. Expected: **47 files, 561 tests, all pass.** A failure is a
  stop: nothing has been changed, so the cause is the runtime (Node 24.21, Vitest 5.0.3) and is reported, not fixed
  by touching a golden. Then `pnpm --filter @automata/painted-figures typecheck`: expected 0 errors in `src` and
  `base` (measured on TypeScript 6.0.3); if `tests`, `scripts` or `viewer` report errors under 6.0.3, list them in the
  log and leave them for task 7 with `"include"` unchanged.
- [ ] **Step 6: The view check, by hand, once:** `pnpm --filter @automata/painted-figures view-check`. Expected: exit
  0 (every case equal, or `webgpu: no adapter, skipped`). It was not run by the plan session; if it fails here on the
  untouched source, record the output and tell the coordinator before going on.
- [ ] **Step 7:** `pnpm check` (exit 0), then commit by path:
  `chore(painted-figures): a workspace package of the painter, as it arrived`.

**Done when:** the manifest check prints `134 files, 0 differ`, the builder's suite passes unchanged in the
framework's workspace, and `pnpm check` is green.

### Task 3: The character kit's door points at the package

**Files:**
- Modify: `extensions/character-kit/package.json:38`, `extensions/character-kit/src/shared/figure-builder/door.ts`,
  `door-view.ts`, `extensions/character-kit/tests/unit/shared/door.test.ts`, `turbo.json`, root `package.json`
  (`boundaries`), `tooling/release/tests/unit/closed-beta-guard.test.ts:33-35`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `@automata/painted-figures`, `/kit`, `/view` from task 2.
- Produces: the door's export names unchanged (45 from the index, 10 from the kit entry, 2 from the view entry).

- [ ] **Step 1: The failing test.** In `door.test.ts`, change the specifiers the three cases look for from
  `figure-builder`, `figure-builder/kit` and `figure-builder/view` to `@automata/painted-figures`,
  `@automata/painted-figures/kit` and `@automata/painted-figures/view`, and add one case:

```ts
it('cannot reach past the three entries', async () => {
  const manifest = JSON.parse(readFileSync(new URL('../../../../painted-figures/package.json', import.meta.url), 'utf8'))
  expect(Object.keys(manifest.exports)).toEqual(['.', './kit', './view'])
})
```

  Run `pnpm --filter @automata/character-kit exec vitest run --project unit tests/unit/shared/door.test.ts`.
  Expected: the three specifier cases FAIL (the door still imports `figure-builder`); the new case passes.
- [ ] **Step 2: Switch.** The three specifiers in `door.ts` and `door-view.ts`; the dependency in the kit's
  `package.json`; `figure-builder` to `@automata/painted-figures` in the root `boundaries` script's 13 `--forbid`
  entries and in the closed-beta guard test. Rewrite the door's header comment: the painter is a package of this
  repository, changed in place; the door stays so the kit takes only the names it uses.
- [ ] **Step 3: Declarations before the kit's typecheck.** In `turbo.json`'s `tasks` add
  `"@automata/character-kit#typecheck": { "dependsOn": ["@automata/painted-figures#typecheck"] }`.
- [ ] **Step 4:** `pnpm install`, then the door test (PASS), `pnpm boundaries` (0 findings), the guard test (PASS).
- [ ] **Step 5: The stale-types check.** Add a throwaway exported type to
  `extensions/painted-figures/src/index.ts`, import it in the door, run `pnpm typecheck` once: expected green. Revert
  both edits (`git checkout -- <the two files>`); `git status` shows neither.
- [ ] **Step 6: The kit's goldens.** The kit's unit suite and its Chromium suite: the same counts as task 1,
  `git status` clean after them (no recorded file rewritten). A moved cell is a stop.
- [ ] **Step 7:** `pnpm check`; commit `refactor(character-kit): the door imports the painter as a workspace package`.

**Done when:** nothing in the kit imports `figure-builder`, and the kit's suites give the baseline's counts.

### Task 4: The submodule and its wrapper go

**Files:**
- Delete: `.gitmodules`, `vendor/FigureBuilder` (gitlink), `vendor/figure-builder/` (5 tracked entries)
- Modify: `pnpm-workspace.yaml`, `biome.json:20-21`, `knip.jsonc:8-9,28-31`, `.gitignore:41-42`, root `package.json`,
  `pnpm-lock.yaml`

- [ ] **Step 1: Remove.**

```bash
git submodule deinit -f vendor/FigureBuilder
git rm -f vendor/FigureBuilder
rm -rf .git/modules/vendor/FigureBuilder
git rm -r vendor/figure-builder
git rm -f .gitmodules
```

- [ ] **Step 2: The configuration.** Take the comment and the entry out of `pnpm-workspace.yaml`; the two exclusions
  out of `biome.json`; the ignore entry and the wrapper's workspace out of `knip.jsonc`; lines 41 and 42 out of
  `.gitignore`.
- [ ] **Step 3: The root's Pixi.** Remove `@pixi/3d` and `pixi.js` from the root `package.json`, `pnpm install`,
  `pnpm check`, and the kit's Chromium suite. If all pass, they stay out. If something fails to resolve them, put them
  back with a comment naming what needs them.
- [ ] **Step 4:** `grep -rIn -iE "figure-builder|vendor/FigureBuilder|gitmodules" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs . | grep -v "^./.github/"`
  Expected: only the kit's door folder name and comments (task 12 rewords them). Anything that is configuration or
  code is fixed here.
- [ ] **Step 5: The workflows' step is harmless.** `SUBMODULES_TOKEN= bash .github/scripts/checkout-submodules.sh;
  echo $?` and `SUBMODULES_TOKEN=x bash .github/scripts/checkout-submodules.sh; echo $?`: both print `0`.
  `pnpm --filter @automata/repo-hygiene test:unit` still passes: the invariant wants the step present, and it is.
- [ ] **Step 6: A fresh clone.** `git clone --branch claude/builders-fold-figures <this repository's path> /tmp/fresh
  && cd /tmp/fresh && pnpm install --frozen-lockfile && pnpm check` after committing. Expected: exit 0 with nothing
  else typed.
- [ ] **Step 7:** Commit `chore(repo): the figure builder's submodule and its wrapper package go`.

**Done when:** `git submodule status` prints nothing, a fresh clone passes `pnpm check`, and no workflow file changed
(`git diff --stat origin/main -- .github` is empty).

### Task 5: The wardrobe branch arrives as its own commits

**Files:**
- Create (by merge): what `claude/c9-wardrobe` adds under `src`, `tests` and `scripts`
- Create: `docs/archive/figure-painter/c9-wardrobe/{2026-11-11-c9-wardrobe-design.md,2026-11-11-c9-wardrobe.md,2026-11-11-c9-wardrobe-plan-audit.md,README.md}`

- [ ] **Step 1: Merge.**
  `git merge --no-ff painter-history/claude/c9-wardrobe -m "feat(painted-figures): the wardrobe's first six tasks arrive (sheer cloth, the shod foot, the head's form, front hair, hair on the trunk, a fringe)"`.
  **One conflict is expected, in `extensions/painted-figures/package.json`** (the branch adds a script to the file
  task 2 rewrote): keep task 2's file and add `"c9": "tsx scripts/c9-sheet.ts"`. Any other conflict is a stop.
  Expected: seven commits arrive (F0 to F6).
- [ ] **Step 2: Nothing recorded moved.**
  `git diff --stat HEAD^1 HEAD -- extensions/painted-figures/tests/golden` prints nothing.
- [ ] **Step 3: Its suite.** `pnpm --filter @automata/painted-figures test:unit`: every test passes, the five goldens
  among them. Record the new file and test counts in the log; they are the expected counts from here on.
- [ ] **Step 4: The kit.** Its unit and Chromium suites at the baseline's counts, `git status` clean. The branch
  promises that a field left out changes nothing; a moved kit cell means it did not hold, and is a stop.
- [ ] **Step 5: Its documents, as a record.** Copy the wardrobe cycle's spec, plan and plan audit from `$FB` at
  `856498a` into `docs/archive/figure-painter/c9-wardrobe/`, with a `README.md` that gives the source repository and
  commit and says the Checkpoint A sheets (five PNGs, 5.1 MB) stayed there. Commit
  `docs(archive): the wardrobe cycle's spec, plan and plan audit, from the retired repository`.
- [ ] **Step 6:** `pnpm check`.

**Done when:** the branch's seven code commits are in `git log -- extensions/painted-figures`, no golden changed, and
both suites pass.

### Task 6: Conform: the framework's format

- [ ] **Step 1:** Remove `"!extensions/painted-figures"` from `biome.json`. Run
  `pnpm exec biome format --write extensions/painted-figures` (format only; lint is task 8). Until task 8, put the
  package under a Biome `overrides` entry that turns the linter off for `extensions/painted-figures/**`, with a
  comment that task 8 removes it.
- [ ] **Step 2:** The painter's suite (the counts of task 5), the kit's unit suite, `pnpm check`.
- [ ] **Step 3:** Commit, alone, `style(painted-figures): the framework's formatting`, so `git blame -w` and
  `git log --follow` step over it easily. (The repository has no `.git-blame-ignore-revs`; do not create one.)

**Done when:** `pnpm exec biome format extensions/painted-figures` reports nothing to change and the suites pass.

### Task 7: Conform: the framework's layout, test imports, runner and boundaries

**Files:**
- Move: `src/lib` to `src/shared/math`; `src/features/{body,paint,lighting,motion,hair,outfit,figure,actors,stage}`
  to `src/shared/<the same name>`; `base/base.ts` to `src/shared/base/base-pair.ts`; `src/{index,kit,view}.ts` to
  `src/entries/`; `src/features/view` stays; `tests/features/<x>` to `tests/unit/<x>`; `tests/golden/*.test.ts` and
  the recorders to `tests/unit/golden/`; the recorded `.json` and `.rgba.gz` to `tests/fixtures/golden/`;
  `tests/support/*` and `tests/features/draw.ts` to `tests/fixtures/`; `tests/api.test.ts` to
  `tests/unit/api.test.ts`
- Create: `tests/unit/layers.test.ts` (from `tests/architecture.test.ts`), `vitest.config.ts` on the preset,
  `tsconfig.json` on the base
- Modify: `package.json` (`imports`, `exports`, scripts), `tsconfig.types.json`, the root `package.json` lists,
  `knip.jsonc`, the kit's nothing (the entries keep their names)

**Interfaces:**
- Produces: `"imports": { "#src/*": "./src/*" }`; `exports` `"."`, `"./kit"`, `"./view"` with
  `"types": "./types/src/entries/<entry>.d.ts"` and `"default": "./src/entries/<entry>.ts"`; scripts
  `"test:unit": "vitest run --project unit"`, `"typecheck": "tsc -p tsconfig.types.json && tsc -p ."`.

- [ ] **Step 1: The layer test first.** Move `tests/architecture.test.ts` to `tests/unit/layers.test.ts` and set

```ts
const LAYERS = [
  'src/shared/math', 'src/shared/body', 'src/shared/paint', 'src/shared/lighting', 'src/shared/motion',
  'src/shared/hair', 'src/shared/outfit', 'src/shared/figure', 'src/shared/base', 'src/shared/actors',
  'src/shared/stage', 'src/entries/index.ts', 'src/entries/kit.ts',
  // The Pixi 3D view, above the public surface and on its own entry, so nothing below it loads Pixi.
  'src/features/view', 'src/entries/view.ts',
]
```

  with `ROOT` two folders up, `MODULES = walk('src')`, and the Pixi case's allowed folders `src/features/view/` and
  the view check's fixture folder. Run it: expected FAIL, "every module belongs to a layer" lists every file still at
  its old path.
- [ ] **Step 2: Move with `git mv`**, then fix the imports the move breaks: relative ones inside `src/`, and in
  tests every chain into `src/` or `base/` (51 files) becomes `#src/…` with the `.ts` extension, as the kit's tests
  write it. The goldens' data paths become `tests/fixtures/golden/`. Change nothing else in any file.
- [ ] **Step 3: The runner and the compiler.** `vitest.config.ts` uses `defineTests` from `@automata/vitest-preset`
  with a `unit` project over `tests/unit`, as `extensions/character-kit/vitest.config.ts` does. `tsconfig.json`
  extends `../../tsconfig.base.json` with `"isolatedDeclarations": false`, `"noUncheckedIndexedAccess": false`,
  `"exactOptionalPropertyTypes": false`, `"resolveJsonModule": true`, and a comment: the painter predates the two
  flags, each of their 1,395 findings is a possible change of code path under a golden, and the declarations step
  exists because of them. `tsconfig.types.json` takes the new `include` and stays the builder's settings.
- [ ] **Step 4: The lists.** Add `extensions/painted-figures` to the root scripts where the kit is listed:
  `boundaries --features`, `--forbid …:effect`, `style`'s `--test-imports` list (not yet its `--plan-comments` list,
  which also checks file length: task 9 adds that), `test:unit:3d`, `test:browser:3d`, and as `!./extensions/painted-figures` in `test:unit:2d`, `test:browser:2d` and
  `test:browser:affected`. Replace the temporary `knip.jsonc` ignore with a workspace entry whose `entry` is the three
  files of `src/entries/` and the scripts.
- [ ] **Step 5:** The layer test PASSES; the painter's suite at task 5's counts; `pnpm boundaries` and `pnpm style`
  at 0 findings; `pnpm knip`; the kit's unit and Chromium suites; `pnpm check`.
- [ ] **Step 6:** Commit `refactor(painted-figures): shared layers, one feature, three entries; tests in tests/unit`.

**Done when:** `pnpm boundaries` and `pnpm style --test-imports` pass with the package in their lists, the layer test
passes over the new paths, and no suite's count changed.

### Task 8: Conform: lint, one rule a commit

137 findings in the source at `23f889c8` (the survey has the count by rule); the tests' and the wardrobe branch's are
counted here first.

- [ ] **Step 1:** Remove the linter override of task 6. `pnpm exec biome lint extensions/painted-figures
  --max-diagnostics=5000` and record the count by rule in the log.
- [ ] **Step 2: For each rule, in this order**, fix every finding of that rule, run the painter's suite, commit
  `style(painted-figures): <rule>`: `noUnusedImports`, `noUnusedVariables`, `noUnusedFunctionParameters`, `useConst`,
  `useOptionalChain`, `noEmptyInterface`, `noExplicitAny`, `useIterableCallbackReturn`, `noSelfCompare`,
  `noAssignInExpressions`, `noNonNullAssertion`, then any rule only the tests show.
  - `noSelfCompare`: `x !== x` on a number becomes `Number.isNaN(x)`; if the operand is not provably a number, keep
    the line with a `biome-ignore` that says it is a NaN test.
  - `noAssignInExpressions`: lift the assignment out only where the order of evaluation is plainly the same; in a
    loop of the rasteriser where it is not plain, keep the line with a `biome-ignore` that says why.
  - `noNonNullAssertion`: the package's compiler flags make most `!` unnecessary, so removing one must leave
    `pnpm --filter @automata/painted-figures typecheck` green; where it does not, keep it with a `biome-ignore`.
  - An unused variable that is "generic machinery no base figure reaches" is not deleted if a test under
    `tests/unit/` names it; check before removing.
- [ ] **Step 3:** A moved texel after any rule: `git revert` that commit, record the finding, go on with the next
  rule, and tell the coordinator.
- [ ] **Step 4:** `pnpm lint` (0 findings, no override left), `pnpm check`.

**Done when:** `biome.json` has no entry for the package and `pnpm lint` passes.

### Task 9: Conform: no file over 600 lines

Three files after task 5: `src/shared/paint/paint.ts` (about 1,607 lines), `src/shared/motion/motion.ts` (716),
`src/shared/hair/hair.ts` (about 692). Formatting in task 6 changes these counts; measure them first with `wc -l`.

- [ ] **Step 1:** For each file, list its top-level declarations and which of them run code at module load (a
  registry filled, a table built). Write the list in the log.
- [ ] **Step 2: Split by moving whole declarations, unedited, into sibling files of the same layer**, named for what
  they hold in kebab-case. Everything that runs at load stays in one module, in its present order, and the original
  file re-exports what moved, so no importer changes. The order in which parts are built is never changed: the part
  index seeds the painter's grain.
- [ ] **Step 3:** After each file: the painter's suite, the layer test (the new files are in the same layer), commit
  `refactor(painted-figures): <file> in parts of at most 600 lines`.
- [ ] **Step 4:** Add `extensions/painted-figures/src` to `style`'s `--plan-comments` list, beside the kit's (that
  run checks names, length and plan comments). `pnpm style`: 0 findings. `pnpm check`.

**Done when:** `pnpm style` reports no `file-length` finding for the package and the suites pass.

### Task 10: Conform: the eight libraries are checked by Zod

**Files:**
- Create: `<library>.schema.ts` beside each reader (`actions`, `hair`, `times`, `gaits`, `poses`, `seats`, `items`,
  `swatches`), and `tests/unit/libraries.test.ts`
- Modify: the eight readers; `package.json` (`zod` 4.6.6, the kit's version)

- [ ] **Step 1: The failing test,** `tests/unit/libraries.test.ts`, one block per library:

```ts
it.each(LIBRARIES)('$name is checked when it loads, and comes out exactly as written', ({ raw, schema }) => {
  const parsed = schema.parse(raw)
  expect(parsed).toEqual(raw)
  expect(JSON.stringify(parsed)).toBe(JSON.stringify(raw)) // the same keys in the same order: order seeds the painter
})
it.each(LIBRARIES)('$name with a misspelt key is refused, naming the key', ({ raw, schema, misspelt }) => {
  expect(() => schema.parse(misspelt(raw))).toThrow(/Unrecognized key/)
})
```

  Expected: FAIL, the schemas do not exist.
- [ ] **Step 2:** Write each schema with `z.strictObject` (an unknown key is an error, never dropped), fields in the
  order the file writes them, and `z.record` for maps keyed by name. Each reader replaces its cast with
  `schema.parse(json)`; the exported types stay the ones the readers export today (assert with
  `satisfies` that the schema's output is assignable to them; do not replace the types).
- [ ] **Step 3:** The new test passes; the painter's suite; the kit's unit suite (it fills `SWATCHES` and
  `HAIR_STYLES` at load); `pnpm check`. Commit `feat(painted-figures): the libraries are checked when they load`.

**Done when:** a misspelt key in any of the eight files fails at load and no golden moved.

### Task 11: Conform: the view check is a browser suite

**Files:**
- Create: `tests/browser/view-check.test.ts`, `tests/fixtures/view-cases.ts` (from `viewer/cases.ts`),
  `tests/fixtures/view-sheets.ts` (from `viewer/sheets.ts`)
- Modify: `vitest.config.ts` (a `browser` project and a `webgpu` project, as the kit's has), `package.json`
  (`"test:browser": "vitest run --project browser --project webgpu"`), the root `test:browser:3d` list (task 7 added
  the filter)
- Keep: `viewer/` and `scripts/view-check.ts` until the suite is proven equal, then delete `scripts/view-check.ts`

- [ ] **Step 1: The test first.** One `it` per case of `CASES`, drawing the case's `StageFrame` with `StageView` in
  the page and comparing the readback with `compose(frame)`: every byte equal for a `bytes` case; for a `palette`
  case alpha 0 or 255 only and every opaque pixel a colour some sprite's cell holds. One block for the 8 standing
  views of each base figure, texel for texel. One for determinism (`scene4` drawn twice in a page and once in a fresh
  one). Run it before the browser project exists: FAIL (no such project).
- [ ] **Step 2:** Add the projects; run
  `AF_WEBGPU=software pnpm --filter @automata/painted-figures test:browser`. Expected: every case passes under WebGL
  and, where the software adapter is granted, under WebGPU.
- [ ] **Step 3: Equal to the script.** Run `pnpm --filter @automata/painted-figures view-check` once more and compare
  the list of cases it reports with the suite's: the same names, none missing. Then delete `scripts/view-check.ts`
  and its `package.json` script; `viewer/` stays as the hand viewer (`"viewer": "vite viewer"`).
- [ ] **Step 4:** `pnpm check`; commit `test(painted-figures): the GPU frame equals the painter's, as a browser suite`.

**Done when:** `pnpm test:browser:3d` runs the suite and it passes in Chromium.

### Task 12: Conform: the words

**Files:**
- Create: `extensions/painted-figures/README.md`, `extensions/painted-figures/docs/contract.md`, `docs/actors.md`
- Move: `extensions/character-kit/src/shared/figure-builder/` to `src/shared/painted-figures/`
- Modify: the kit's `README.md:52-53`, the 10 kit files that say "submodule", "upstream" or `vendor/FigureBuilder`,
  `extensions/character-kit/tests/unit/shared/{door,contract}.test.ts`, `docs/provenance/sources.md`, the painter's
  comments that name the old game's repository (`src/shared/stage/pose.ts`)

- [ ] **Step 1: The readme,** from the builder's `CLAUDE.md` and `README.md` at `$PIN`, in the framework's voice:
  what the package is; the layout as it now is; the five goldens and the one command that re-records each, with the
  rule that a re-record is a deliberate visual change named in its commit; the hook registries H1 to H5 and the
  machinery never to cut as dead, with its tests; the rules that are the painter's own (the layer order and where it
  is tested, the part index and the grain, seams, DUEL and whole steps, no nudity and no stereotype, everything a
  generator plus data); the two compiler flags and why. No fork section. Then the name table: every export name the
  package's three entries share with `@automata/3d`'s entries, each with one line on which is which. List them with:

```bash
node -e '
const fs = require("node:fs"), path = require("node:path")
const names = (dir) => new Set(fs.readdirSync(dir).flatMap((f) =>
  [...fs.readFileSync(path.join(dir, f), "utf8").matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)].flatMap((m) =>
    m[1].split(",").map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()).filter(Boolean))))
const ours = names("extensions/painted-figures/src/entries"), core = names("packages/3d/src/entries")
console.log([...ours].filter((n) => core.has(n)).sort().join("\n"))'
```

- [ ] **Step 2: The contract,** `docs/contract.md` and `docs/actors.md` copied from `$PIN` and corrected: the
  consumers are the character kit's door, in this repository; the entries' paths; the changelog gains "moved into the
  framework, `STAGE_VERSION` unchanged at 1". Run `pnpm style` on them (links and plan IDs) and fix what it finds.
- [ ] **Step 3: The door folder** renamed with `git mv`; `#src/shared/figure-builder/` becomes
  `#src/shared/painted-figures/` wherever the kit imports it; the door test's paths follow.
- [ ] **Step 4: Comments.** In the kit, reword the comments that say the builder is a submodule, is fixed upstream or
  lives under `vendor/`. In the painter, `pose.ts` keeps the game's name and drops the old repository's.
- [ ] **Step 5: Provenance.** In `docs/provenance/sources.md`, after "The figure builder as a submodule
  (2026-11-10)", a section "The figure painter, folded in (the date)": the source repository and `$PIN`, the wardrobe
  branch's `856498a`, the method (filtered history, the commit map, the manifest), what did not come and why, and the
  Owner's decision of 2026-11-12 quoted. `pnpm source-names` passes.
- [ ] **Step 6:** `pnpm check`, the kit's suites; commit
  `docs(painted-figures): the readme, the contract and the provenance of the fold`.

**Done when:** `grep -rIn -iE "submodule|vendor/FigureBuilder" extensions/character-kit extensions/painted-figures`
prints nothing.

### Task 13: Group 1 closes

- [ ] **Step 1:** `git fetch origin main && git merge origin/main`; `pnpm install --frozen-lockfile`.
- [ ] **Step 2:** `pnpm build`; `pnpm api-report` and `pnpm api-index` (expected: nothing to update, no published
  package's exports changed; if either reports a change, run it with `--update` or `--write`, read the diff, and
  commit it with the reason).
- [ ] **Step 3:** The whole `pnpm check`, timed; then the unit tests once uncached,
  `time pnpm exec turbo run test:unit --force -- --testTimeout=90000`. Compare with task 1's times and write both.
- [ ] **Step 4: Chromium, software GL:** `AF_WEBGPU=software pnpm --filter @automata/painted-figures test:browser`,
  `AF_WEBGPU=software pnpm --filter @automata/character-kit test:browser`, `pnpm test:journeys:3d`, and the
  `test:browser` of any other workspace that depends on the kit (`pnpm why @automata/character-kit -r` names them).
  `git status` clean after them.
- [ ] **Step 5:** `git count-objects -vH` against task 1's. The fresh-clone check of task 4, step 6, again.
- [ ] **Step 6: The record.** This plan's tracking table and log; `docs/superpowers/progress.md`, workstream 6: what
  moved, what did not and why, the stops met. **What was not run, stated:** WebKit, Firefox, WebGPU on a real GPU,
  anything on arm64, the journeys of the reference game.
- [ ] **Step 7:** Push; open a draft pull request,
  `feat(painted-figures): the figure painter lives in the framework`. Its body: the Owner's decision quoted, the
  manifest result, the suites and counts, the list of what was not run, and a request to the Owner for one run on
  arm64: `pnpm install && pnpm --filter @automata/painted-figures test:unit`.

**Done when:** the pull request is open with every gate's result in it.

### Task 14: The workflows lose the submodule step (only with the Owner's word)

Do not start without the Owner's sentence. Quote it in the commit body and in the pull request.

**Files:** the eight workflow files and the lines under "What retires"; `.github/scripts/checkout-submodules.sh`;
`tooling/repo-hygiene/src/workflow-invariants.ts` and `tests/unit/workflow-invariants.test.ts`;
`tooling/repo-hygiene/tests/unit/checkout-submodules.test.ts`; `docs/runbook.md:63`

- [ ] **Step 1: The failing test.** In `workflow-invariants.test.ts`, replace the four submodule cases with one
  (`WORKFLOWS` is the folder constant the file already has):

```ts
it('names no submodule step and no submodule token: the repository has no submodule', () => {
  const text = readdirSync(WORKFLOWS)
    .filter((file) => file.endsWith('.yml'))
    .map((file) => readFileSync(join(WORKFLOWS, file), 'utf8'))
    .join('\n')
  expect(text).not.toMatch(/SUBMODULES_TOKEN|checkout-submodules|vendor\/FigureBuilder|vendor\/figure-builder/)
})
```

  Expected: FAIL, 73 lines match.
- [ ] **Step 2:** Remove the lines listed under "What retires" from the eight files; delete the script and its test;
  take rule 6, `SUBMODULES_TOKEN` in `READ_ONLY_SECRETS`, `SUBMODULE_SCRIPT` and the two checks that use them out of
  `workflow-invariants.ts`; remove the runbook's row.
- [ ] **Step 3:** The test passes; `pnpm check`; `pnpm lint:actions` if Docker is there (say so if not).
- [ ] **Step 4:** Commit `ci: the workflows no longer check out a submodule`, with the Owner's words in the body.
  Tell the coordinator the `SUBMODULES_TOKEN` secret can be deleted by the Owner.

**Done when:** `grep -rn "SUBMODULES_TOKEN\|checkout-submodules" .github tooling docs/runbook.md` prints nothing.

---

## Group 2: EnvironmentBuilder (`claude/builders-fold-scenes`)

From `origin/main` after group 1 merged. `$EB` is a scratch clone of
`https://github.com/mcthaydt/EnvironmentBuilder` at `f7c535694fd7a53a8f94129b9e13b9ab3503a095`, outside the working
tree. These tasks follow the default answer to the first question (option A). If the Owner chooses B, task 20 is
planned before this group starts.

### Task 15: The tiles golden, restated as a world-kit check

**Files:**
- Create: `extensions/world-kit/tests/fixtures/goldens/builder-tiles.json` (the builder's `tests/golden/tiles.json`,
  unchanged, 112 keys), `extensions/world-kit/tests/unit/textures/builder-tiles.test.ts`

**Interfaces:**
- Consumes: `photoToTile(image, knobs)` and `unpack` from `extensions/world-kit/src/features/textures/tile.ts`,
  `decodePng` from `png.ts`, the photo files in `extensions/world-kit/assets/photos/`.

- [ ] **Step 1: Read both sides.** The builder's md5 is
  `md5(`${t.w}x${t.h}` + the bytes of t.data)` of `tileOf({ ...spec, wear: 0.3, seed: 1 }, 32, 32)`
  (`$EB/tests/golden/tiles.ts`). Write in the log how the kit's tile holds its labels (`unpack`) and the mapping to
  the builder's `t.data` (element type, label numbering, row order).
- [ ] **Step 2: The test.** For each of the 112 keys `<photo>/<mode>`: the kit's tile for that photo and mode at 32
  texels a metre, wear 0.3, seed 1, laid out as the builder's `t.data`, its md5 equal to the recorded one. The mapping
  is a small function in the test file, with a comment saying it is the builder's layout.
- [ ] **Step 3: Run it.**
  `pnpm --filter @automata/world-kit exec vitest run --project unit tests/unit/textures/builder-tiles.test.ts`.
  - **All 112 equal:** the golden has come, unmoved. Commit
    `test(world-kit): the photo pipeline reproduces the source's tiles, key for key`.
  - **Some differ:** a stop. Do not change the pipeline and do not re-record. Write which keys differ and, for the
    first, the first stage whose output differs (run the builder's stages from `$EB` beside the kit's on the same
    photo). Tell the coordinator: the port has drifted, and whether to fix the kit is a decision, because fixing it
    moves the kit's committed tiles.
  - **No mapping can be written** (the kit's tile is not label data of that kind): record why, do not commit the
    test, and say that the tiles golden did not come.
- [ ] **Step 4:** `pnpm check`.

**Done when:** one of the three outcomes is in the log with its evidence.

### Task 16: What the builder changed after the ports were read

The provenance rows were written at `6d82a52`. Eight ported files changed between it and `f7c5356`.

- [ ] **Step 1:** For each of `src/features/view/readability.ts`, `view/view-frame.ts`, `world/types.ts`,
  `world/map.ts`, `world/swatches.ts`, `stage/sprite-light.ts`, `paint/look.ts` with `paint/library/look.json`, and
  `world/library/maps.json` with `base/base.ts`: `git -C $EB diff 6d82a52 f7c5356 -- <file>`. For every hunk, find its
  answer in the framework file the survey names and mark it, in a table added to the survey
  (`environment-builder.md`, "The hunks, read"): **already answered** (the framework file and line), **not wanted**
  (the reason: it serves the CPU renderer or the harness), or **to port**.
- [ ] **Step 2: For each "to port" hunk,** test first in the package that holds the port (`packages/3d` or
  `extensions/world-kit`): the failing test, the change, the package's suite. A hunk whose port would move one of the
  framework's recorded frames is not ported: it is a stop and a question for the coordinator, with the frame named.
- [ ] **Step 3:** One commit a ported hunk, `fix(<package>): <what the hunk does>`; a changeset if the package is
  published (`packages/3d`, the two kits are private: none).
- [ ] **Step 4:** `pnpm check`; the 3D package's and the world kit's Chromium suites
  (`AF_WEBGPU=software pnpm --filter @automata/3d test:browser`, `--filter @automata/world-kit test:browser`), `git
  status` clean after them.

**Done when:** every hunk of the eight files has a row and no row says "to port".

### Task 17: The photo process as the world kit's document

**Files:**
- Create: `extensions/world-kit/docs/photos.md`
- Modify: `extensions/world-kit/README.md` (one link)

- [ ] **Step 1:** From `$EB/docs/photos.md` (287 lines): keep the process (photograph in grey weather, square on,
  with the size known; cut out, scale down, facet, scale down, index, clean up; no hand-drawn pixels; a material is a
  photo, a pattern is a design) and the record each photo needs (`file`, `size`, `source`, `licence`, `credit` in
  `assets/photos/photos.json`). Replace every command with the kit's (`textures-cli.ts`'s, as
  `tests/unit/textures/textures-command.test.ts` runs it) and every path with the kit's. Say which test fails when a
  record is missing (`tests/unit/textures/swatch-tiles.test.ts`). Name no source project (`pnpm source-names` reads
  nothing under `extensions/`, but the kit's documents are meant to be published one day).
- [ ] **Step 2:** `pnpm style` (the link and plan-ID rules read it); `pnpm check`; commit
  `docs(world-kit): how a photo becomes a tile, and the record each photo needs`.

**Done when:** the document exists, its commands are the kit's, and `pnpm style` passes.

### Task 18: The provenance table at `f7c5356`; the ledger rows

**Files:**
- Modify: `docs/provenance/sources.md` ("The environment source"), `docs/provenance/builders-manifest.json`,
  `docs/superpowers/progress.md` (the editor gaps ledger; "Following work")

- [ ] **Step 1:** "The environment source" reads `f7c5356`. Add a row for each of the 51 files with none (the survey
  lists them: the harness and its tests, `paint/albedo.ts`, `view/cpu-frame.ts`, `view/expose.ts`, six scripts and
  their tests), each "left out" with its reason or naming the framework file. Correct the rows that still say "goes
  to `@automata/world-kit`" for `world/dress.ts`, `generate.ts`, `lettering.ts` and the library files to name the
  kit's files the survey checked; `world/decals.ts` stays "left out", with workstream 4's open row as the reason. Add
  the rows for task 15's golden and task 17's document.
- [ ] **Step 2:** Regenerate the manifest's `environment` entry at `f7c5356` (`pnpm sources-md`, as the section's own
  "Pull again" says). `pnpm source-names` (it runs `sources-md-cli --complete`): exit 0.
- [ ] **Step 3: The ledger.** In `progress.md`'s editor gaps ledger, one row: a swatch's texture knobs cannot be
  tuned against its `reads` in an editor; the judge exists (`checkReads`), the search does not. Under workstream 5's
  notes, one line: a hand-run command that compares a real GPU's frame with SwiftShader's for the framework's own
  frames would end "WebGPU on a real GPU: not run".
- [ ] **Step 4:** `pnpm check`; commit `docs(provenance): every file of the environment source at f7c5356, and where it went`.

**Done when:** `pnpm source-names` passes and no file of the builder at `f7c5356` lacks a row.

### Task 19: Group 2 closes

- [ ] **Step 1:** `git fetch origin main && git merge origin/main`; `pnpm install --frozen-lockfile`; `pnpm build`;
  `pnpm api-report`; `pnpm api-index` (update and commit with the reason if task 16 changed a published package's
  exports or doc comments).
- [ ] **Step 2:** The whole `pnpm check`. Chromium, software GL: the 3D package's, the world kit's and the character
  kit's `test:browser`, and `pnpm test:journeys:3d`. `git status` clean after them.
- [ ] **Step 3: The retirement notes.** Send the coordinator the two notes below, for the Owner (or, if the Owner
  granted a session access, that session commits each to its repository's `README.md` and nothing else).
- [ ] **Step 4: The record.** This plan's table and log; `progress.md`, workstream 6: what moved, what did not and
  why (the survey's summary table, with task 15's and 16's outcomes), and the spec's "Done means" line by line with
  its evidence. **Not run, stated:** WebKit, Firefox, WebGPU on a real GPU, the builder's own `test:gpu` and `check`.
- [ ] **Step 5:** Push; a draft pull request,
  `docs(world-kit): what the environment source still had, proven and recorded`.

**Done when:** the pull request is open and the notes are with the coordinator.

### Task 20 (conditional): the CPU scene renderer as a reference tool

**Not planned.** It exists only if the Owner chooses option B of the first question, and then it gets its own short
plan before group 2 starts, on the pattern of group 1: a filtered history of `src`, `base`, `tests` and `scripts`
(3.87 MB with the photos, which would be dropped in favour of the kit's identical copies) merged under a private
home that is not an extension a game can add (it draws nothing a game ships); its door `src/lib/figure.ts` rewritten
to import `@automata/painted-figures/kit` and `@automata/painted-figures` (the kit entry exports every name the door
takes from the internals); its suite run, with `base` and `scenes` failing as measured (22 frames); then **one**
commit that re-records those two goldens, quoting the Owner, with every moved frame shot before and after; the GPU
harness left out. Nothing of this is done under the default.

---

## The retirement notes

For `mcthaydt/FigureBuilder`, at the top of `README.md`:

> **Retired.** This repository's code now lives in `mcthaydt/automata-framework`, in `extensions/painted-figures`,
> with its history: `main` at `23f889c8` and the branch `claude/c9-wardrobe` at `856498a`. Work on the painter
> continues there. Nothing is merged here any more. Still only here: the specs, plans, audits and gate sheets under
> `docs/superpowers/`; the branches `claude/c5-finish-fixes` and `claude/turned-face-both-eyes` (painter fixes not on
> `main`); the content branches and spikes; the tag `archive/dressed-golden`.

For `mcthaydt/EnvironmentBuilder`, at the top of `README.md`:

> **Retired.** What a game needs from this repository is in `mcthaydt/automata-framework`: the photo pipeline, the
> photo library with its licence records, the dresser, the kits, the maps and their generators in
> `extensions/world-kit`; the level format, the world builder and the look in `packages/3d`. That repository's
> `docs/provenance/sources.md` lists every file here at `f7c5356` and where it went or why it stayed. The CPU scene
> renderer, its views, the GPU harness and their goldens were not carried over; they remain here as the record.
> Nothing is merged here any more.

Archiving both repositories is the Owner's.

## Addendum for workstream 4's plan (its tasks 13 to 16, after the fold)

For the coordinator to move into `2026-11-11-builders-look.md`, replacing the text of its group 4. One branch,
`claude/builders-look-wardrobe`, from `main` after this plan's group 1; one pull request; no second repository and no
pin.

- **Task 13, the painter: drawn moods and the wardrobe golden.** In `extensions/painted-figures`. The step-level text
  is the wardrobe cycle's plan, now at `docs/archive/figure-painter/c9-wardrobe/2026-11-11-c9-wardrobe.md`: its task
  F8 (the faces `fear`, `sad`, `worried` and `firm` drawn; `EXPRESSIONS` gains `worried` and `firm`), its Checkpoint
  B cut to the faces sheet, and its task F9 cut to the golden and the documents (a first recording,
  `tests/fixtures/golden/wardrobe.json`, with its test in `tests/unit/golden/`). Its paths are read through this
  plan's task 7 (`src/features/<x>` is `src/shared/<x>`, `tests/features/<x>` is `tests/unit/<x>`). Out: its
  showcase, and glyphs unless the Owner asks. Gates: `pnpm check`, the painter's browser suite. No golden on `main`
  moves but two that are expected: F8 replaces the `face/fear@D*` and `face/sad@D*` pins that F0 recorded (they
  pinned faces not yet drawn), in the commit F8 names. "Merge to FigureBuilder's `main`; tell the coordinator the
  commit" is gone.
- **Task 14, the door.** Step 1 (move the pin) is gone. Step 2 stands: the kit's door
  (`src/shared/painted-figures/door.ts`) re-exports what the new kinds use (`rampOf`, `skull`, `onHead`, `headForm`
  and the types `Skull`, `HeadForm`, `ShoeForm`, `Foot`, as the wardrobe plan lists them), pinned by `door.test.ts`.
  The runway golden must not move; if it does, the painter changed a cell it promised not to: stop.
- **Task 15, the ward's clothes as kit entries; moods reach the painter.** As written, with one change: where it says
  a cell that moves under the last-bit nudge "is fixed in FigureBuilder", it is fixed in
  `extensions/painted-figures`, in the same pull request, with the painter's own goldens run.
- **Task 16, the ward gate sheet; the pull request.** As written.
- **Task 17, step 2:** "FigureBuilder #29 is merged by task 13" becomes "FigureBuilder #29 stays open in the retired
  repository; its code is on `main` here". **Step 4** ("ask, do not do": fold or keep the submodule) is answered by
  the Owner's decision of 2026-11-12 and is removed.

**Following work, not part of this plan or that one** (what the reference game still needs from figures, and what
the fold leaves open):

- **A held item** (the lamp in a figure's hand): the painter has items (`ITEMS`, `itemOf`) and the hand's anchors
  (hook H2); the kit's `PaintedState` has no field for one. A kit change with a painter test, now one pull request.
- **Cutscene poses:** the painter has `POSES`, `SEATS` and holds (`applyHold`); the cutscenes extension has no way
  to name one for a painted figure at a time on its timeline.
- **Glyphs** (a watch, a badge): the Owner's to ask for.
- **The two strict compiler flags** for the painter, one file at a time behind the goldens; then the declarations
  step and `tsconfig.types.json` go and `exports` points at source.
- **The painter fixes left in the retired repository** (`claude/c5-finish-fixes`, `claude/turned-face-both-eyes`), if
  the Owner wants them.
- **An editor for painted figures** (already row 2 of the editor gaps ledger), and tuning a swatch against its reads
  (task 18's row).
- **The `@pixi/3d` beta.3 port of `src/features/view/`**, on the upgrade branch.

## Log

| Date | Session | What |
|---|---|---|
| 2026-11-12 | Stage 2 (plan), `claude/builders-fold-plan` | The two surveys and this plan, against `main` `0df11a43`, FigureBuilder `23f889c8` and EnvironmentBuilder `f7c5356` (both cloned read only; nothing committed in them). Ran: both builders' own suites (FigureBuilder 47 files, 561 tests, at most 227 s; EnvironmentBuilder 55 files, 578 tests, 130 s), FigureBuilder's goldens under Node 24.21 (pass, 27 s), EnvironmentBuilder's suite against the framework's painter pin (27 failures in 4 files), the framework's format, lint, style and strict typecheck over the builders' source, the submodule script with no submodule (exit 0 both ways), byte and key comparisons of the photo library and the kits, and a dry run in a scratch clone of task 2's filter and manifest check (236 commits on `main`, 7 more for the wardrobe branch, 134 files, 0 differ, 1.64 MB). Not run: either builder's view or GPU check, any render, anything on arm64, the wardrobe branch's tests, the tiles cross-check. No product code written; no golden or hash touched |
