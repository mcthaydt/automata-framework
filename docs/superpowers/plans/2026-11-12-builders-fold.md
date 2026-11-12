# The builders move into the framework: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task by task,
> in one session per branch, with no subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fresh clone of the framework builds, checks and tests with no submodule and no second repository; the
figure painter lives in the framework with its history and its five goldens unmoved; what EnvironmentBuilder still had
that the framework lacked is in the framework, and the rest is recorded as not wanted, file by file.

**Architecture:** FigureBuilder's code arrives as a private extension, `extensions/figures`
(`@automata/figures`), by a filtered history merge, byte for byte, and its own suite passes there before
anything is changed. The character kit's one door then points at the package, the submodule, its wrapper and the
workflows' checkout step go, the two fix branches and the wardrobe branch arrive as their own commits, and only then
is the source brought under the framework's rules, one rule a commit, with the goldens run after each. A third branch
brings the painter under the framework's two strictest compiler flags, folder by folder. EnvironmentBuilder moves almost no code: the survey found its features
already ported, so its group is proof and record.

**Tech stack:** TypeScript 6.0.3, PixiJS 8.22.0 with `@pixi/3d` 0.1.0-beta.2, Vitest 5.0.3 (unit and browser
projects, `@automata/vitest-preset`), Playwright 1.63.0, Biome, pnpm and turbo, `git filter-repo` 2.47.0.

**Spec:** [`../specs/2026-11-12-builders-into-the-framework-design.md`](../specs/2026-11-12-builders-into-the-framework-design.md).
**Surveys:** [`figure-builder.md`](../audits/2026-11-12-builders-fold-survey/figure-builder.md) and
[`environment-builder.md`](../audits/2026-11-12-builders-fold-survey/environment-builder.md): read them first; this plan
argues from their measurements. **Tracker:** [`../progress.md`](../progress.md), workstream 6.

## Tracking

**15 of 28 tasks done (54%)** (tasks 9 to 12 done) (task 20 is conditional and counted only if the Owner chooses it). Audited 2026-11-12
([plan audit](../audits/2026-11-12-builders-fold-plan-audit.md)): its fixes are in the steps below. Numbers 4b to 4d were
added and 14 was moved to 4b after the Owner's answers of 2026-11-12, so the numbering has letters and a gap. Tick a
task only when its checks passed in the session that did it; say what did not run.

| # | Task | Branch | State | Evidence |
|---|---|---|---|---|
| 1 | The baseline, and the checksum manifest | `claude/builders-fold-figures` | done | `e074227fe`: baseline `pnpm check` exit 0, 11m56s cold (65 tasks; turbo test time 9m13s); kit unit 28 files, 228 tests, 53 s; kit browser (Chromium, software GL) 7 files, 58 tests, 3 files skipped by design (the gate's sheets), 35 s; pack 275.69 MiB; manifest 134 files |
| 2 | The painter's source arrives with its history; its own suite passes as it is | `claude/builders-fold-figures` | done | `e22caf219` (merge), `b192bad57` (the pin, step 3b made early), `ef3cd569e` (the package): filter 111 commits on main, 126 in all, 1.03 MiB, 0 SNEKPRTY blobs, 0 cut paths; manifest 134 files, 0 differ; the builder's suite 47 files, 563 tests (560 of 561 before the pin); typecheck 0 errors; view-check exit 0; `pnpm check` exit 0 (4m40s, cached) |
| 3 | The character kit's door points at the package | `claude/builders-fold-figures` | done | `refactor(character-kit): the door imports the painter as a workspace package`: door test 5 of 5 (three specifier cases watched failing first), boundaries 0 findings, closed-beta guard passes, stale-types and missing-types checks green; kit unit 28 files, 229 tests (228 and the new case); kit browser (Chromium) 58 pass, 3 files skipped, as the baseline; no recorded file rewritten; `pnpm check` exit 0 (2m23s) |
| 4 | The submodule and its wrapper go | `claude/builders-fold-figures` | done | `93f7e6ba3`: `git submodule status` prints nothing; a fresh clone (plain `git clone`, `pnpm install --frozen-lockfile`) passes `pnpm check` (66 tasks, 14m53s, nothing else typed); `pnpm check` in the tree 15m54s uncached; kit Chromium 58 pass without the root's Pixi; the hygiene invariants pass; `git diff --stat origin/main -- .github` empty |
| 4b | The workflows lose the submodule step (the Owner's word given) | `claude/builders-fold-figures` | done | `323a971d9`: the Owner's words quoted in the commit body ("remove the submodule checkout and SUBMODULES_TOKEN from the workflows"); the new invariant test failed first (the 73 lines), passes; hygiene unit 157 tests; `pnpm check` exit 0 (66 tasks); no `SUBMODULES_TOKEN` or `checkout-submodules` left under `.github`, `tooling` or the runbook; actionlint not run (no Docker daemon here) |
| 4c | The c5-finish fixes come across | `claude/builders-fold-figures` | done | Six cherry-picks (`82c11508a` S1, `a799dc290` S2, `eb02942d2` N1, `6f63f4e3d` N2, `35ba7296a` N5, `3f058313f` N4) and `cc3626b84` (step 3b); after the five: 47 files, 577 tests, no golden moved; after step 3b: 47 files, 578 tests, typecheck 0 errors; kit unit 229 tests, kit Chromium 58 pass as the baseline, no recorded file rewritten; `pnpm check` exit 0 (3m27s) |
| 4d | A turned face keeps both eyes: the fix, the sheet, the Owner's eye, the re-record | `claude/builders-fold-figures` | done (the Owner, 2026-11-12: "yes, give me both eyes") | Steps 1 to 3 done: the fix applied cleanly and moves exactly the five tests in four files the audit measured (579 tests, 574 pass), the character kit's suites do not move; the sheet is committed (`732ecfa7e`) at `docs/superpowers/audits/2026-11-12-builders-fold-survey/turned-face/`. Steps 4 and 5, on the Owner's yes: the fix `18d0cec` (the builder's commit, its author, `LEFTHOOK=0` because it alone fails the goldens) and the re-record `0eb1a76` (actors 10 + 8 frames, base 1 sheet of 3 texels, sprites 1 md5; only `actors.json`, `sprites.json` and `base-m-hero-d1.rgba.gz` changed); painter 52 files, 654 tests; kit unit 229, Chromium 58 |
| 5 | The wardrobe branch arrives as its own commits | `claude/builders-fold-figures` | done | `1e22885f3` (the merge, seven commits F0 to F6) and `ab909678f` (the documents): the one conflict was `package.json`, resolved as the plan says (`c9` script added); no golden file changed (`git diff --stat HEAD^1 HEAD -- extensions/figures/tests/golden` empty); the painter's suite 52 files, 653 tests, all pass on Node 24.21 (the 2-ulp pin of `b192bad57` already holds the head's profile pin); the goldens, identity, ulp, face-d2 and layer tests also pass on Node 22.23.4 (10 files, 115 tests); kit unit 229 and Chromium 58 as the baseline; `pnpm check` exit 0 (3m34s) |
| 6 | Conform: one mechanical commit for format, one for lint's automatic fixes | `claude/builders-fold-figures` | done | `4efbf92` (format; 128 files, tool output only) and `598503d` (lint's safe fixes, imports sorted in 92 files); the painter 52 files, 654 tests unmoved after each, kit unit 229; `pnpm check` exit 0 on each tree; no golden file changed. 285 lint findings left (listed in the log) for task 8 |
| 7 | Conform: the framework's layout, test imports, runner, boundaries; the suite split for the commit hook | `claude/builders-fold-figures` | done | `538bb9e`: the layer test written first and seen failing (2 of 6, the 43 modules still at their old paths); then 123 files moved with `git mv` by a script that rewrites each specifier as the old code read it; goldens' data are 100% renames; `goldens` project 9 files, 76 tests, 51 s; `unit` 43 files, 578 tests; whole 52 files, 654 tests; `pnpm boundaries` 0 findings, `style` 0, `knip` 0, typecheck 0 errors; kit unit 229, kit Chromium 58; `pnpm check` exit 0; the commit hook ran only `goldens` (66 s) |
| 8 | Conform: the lint rules that need a hand, one rule a commit | `claude/builders-fold-figures` | done | `1a20225`: 14 rules in 12 commits (the 285 findings by rule are in the log), then the override removed (last, not first: the commit hook lints staged files with the working `biome.json`); `pnpm lint` exit 0 and Biome reports nothing in the package; no golden, md5 or pixel moved; the whole painter suite passed before each value-risk commit (705 tests, 3m50s quiet); `pnpm check` exit 0 (8m06s, painter 52 files, 705 tests). The plan's claim that most `!` are unneeded is false here (see the log); the three `noFocusedTests` are functions named `fit`, no `.only` exists. Also the timeout fix `b3366fc` (log) |
| 9 | Conform: no file over 600 lines | `claude/builders-fold-figures` | done | Six files were over, not three; every file is now at most 600 lines and `pnpm style` has no exemption for one. Whole declarations moved: motion (`eeb156e`), hair (`bcc6748`), garments (`875ba4d`), actor (`6d9e042`), paint's helpers (`e3661f8`), figure's build (`980dd3f`). `class Figure`: `faceAt`, `handsAt` and `fillDepth` as functions of a `Posed` object (`05d9091a1`, `figure.ts` 520). `paint()`: fourteen phase functions over one context, one commit each (`439487ff0` to `3854c1dd0`), `paint.ts` 90 lines (see the log). The knip finding of the splits' re-exports: `667b1abf8` |
| 10 | Conform: the eight libraries are checked by Zod | `claude/builders-fold-figures` | done | `tests/unit/libraries.test.ts` (18 cases) first, RED on the missing modules; eight `*.schema.ts` beside their readers, `asWritten` in `shared/math`, the readers parse instead of casting (log) |
| 11 | Conform: the view check is a browser suite | `claude/builders-fold-figures` | done | `tests/browser/view/view-check.test.ts` (16 standing views, 105 cases under WebGL, determinism) and `tests/browser/webgpu/view-webgpu.test.ts` (105 cases under WebGPU), written first and RED on "no projects were found"; `AF_WEBGPU=software pnpm --filter @automata/figures test:browser`: 2 files, 227 tests pass (54 s), the same 227 results, by name, as the script's (16 + 105 + 105 + 1, none missing); without the software flag the 105 WebGPU cases skip in words and 122 pass. `scripts/view-check.ts` deleted (log) |
| 12 | Conform: the words (readme, contract, comments, provenance) | `claude/builders-fold-figures` | done | `extensions/figures/README.md`, `docs/contract.md` (+ the changelog entry) and `docs/actors.md` copied from `$PIN` and corrected; the kit's door folder `git mv`'d to `src/shared/figures/`; `grep -rIn -iE "submodule\|vendor/FigureBuilder" extensions/character-kit extensions/figures` prints nothing; `grep -rn Nurse extensions/figures` prints only the guard in `fringe.test.ts`; provenance section in `docs/provenance/sources.md`; `pnpm style` and `pnpm source-names` 0 findings; the whole `pnpm check` exit 0 (7m08s); kit unit 28 files, 229 tests; kit Chromium and WebGPU 58 pass, 3 files skipped by design |
| 13 | Group 1 closes: the gates whole, the record, the pull request | `claude/builders-fold-figures` | in progress | Steps 1 to 3 done and the browser half of step 4 (log); steps 4 (the journeys), 5 (the fresh clone), the five unit runs and the final record remain; no pull request is opened (the coordinator's word) |
| 21 | Strict: the ledger measured; `shared/math` and `shared/body` | `claude/builders-fold-strict` | todo | |
| 22 | Strict: `shared/paint` but for `paint.ts` | `claude/builders-fold-strict` | todo | |
| 23 | Strict: `shared/paint/paint.ts` and its parts | `claude/builders-fold-strict` | todo | |
| 24 | Strict: `shared/lighting` and `shared/motion` | `claude/builders-fold-strict` | todo | |
| 25 | Strict: `shared/hair` and `shared/outfit` | `claude/builders-fold-strict` | todo | |
| 26 | Strict: `shared/figure` and `shared/base` | `claude/builders-fold-strict` | todo | |
| 27 | Strict: `shared/actors`, `shared/stage`, the view; the flags on; the declarations step goes; the pull request | `claude/builders-fold-strict` | todo | |
| 15 | The tiles golden, restated as a world-kit check | `claude/builders-fold-scenes` | todo | |
| 16 | What the builder changed after the ports were read | `claude/builders-fold-scenes` | todo | |
| 17 | The photo process as the world kit's document | `claude/builders-fold-scenes` | todo | |
| 18 | The provenance table at `f7c5356`; the ledger rows | `claude/builders-fold-scenes` | todo | |
| 19 | Group 2 closes: the retirement notes recorded, the gates whole, the pull request | `claude/builders-fold-scenes` | todo | |
| 20 | Conditional: the CPU scene renderer as a reference tool (only if the Owner chooses option B) | `claude/builders-fold-scenes` | not planned | |

**Order of the branches.** `claude/builders-fold-figures` first. When it has merged: `claude/builders-fold-strict`
(the painter only) and `claude/builders-fold-scenes` (the world kit and the record only) touch no file in common and
may run side by side. Workstream 4's wardrobe branch changes the painter, so it starts after
`claude/builders-fold-strict` merges; the `@pixi/3d` beta.3 upgrade may merge any time after
`claude/builders-fold-figures`.

## What this plan settles

Each has the recommendation and its reason. Where the decision is the Owner's, the options and the default are under
"Questions for the Owner".

### 1. History

**FigureBuilder: a filtered history, merged once.** `git filter-repo` keeps only the code paths (`src`, `base`,
`tests`, `scripts`, `viewer`, `package.json`, `tsconfig.json`, `vitest.config.ts`), rewrites them under
`extensions/figures/`, and the result is merged with `--allow-unrelated-histories` in one merge commit whose
subject is a Conventional Commit. `git log` and `git blame` then work on the new paths with no extra flags.

- Size, measured: the filtered history is **251 commits and 1.72 MiB packed** (`main`, 236 commits; the wardrobe
  branch's 7; the c5 branch's 6; the turned-face branch's 2), dry-run by the plan audit in a fresh clone with the exact
  command of task 2 and fetched into an empty repository; all of `main` unfiltered is 347 commits
  and 20.6 MB, because of 228 audit PNGs (12.2 MB) that the framework does not want in its history.
- **The history starts at the last content cut** (the coordinator's ruling of 2026-11-12, after the plan audit
  found the builder's first cast in its history: "brand or game content does not come, and that holds for history
  too: this repository is to become public"). Up to 2026-11-05 the builder's history held named characters of the
  reference game and the Owner's SNEKPRTY graphics: `src/render/figure/streetwear.ts` and
  `library/graphics.json` (cut in filtered `df78c2f`, "Cut the wardrobe's garments"), `library/looks.json` and
  `sets.json` (`ea56575`, "Cut the random cast"), `library/headwear.json` (`d5e80af`), the dressed golden's 44 sheets of
  the cast's garments and `tests/fixtures/dressed.json` (`df78c2f`), the scene pipeline's scenes, props, signage and
  lettering (`dd3e0cb`), the portraits (`65e343b`), and the characters and story-era fields inside `render/figure/cast.ts`,
  `genes.ts`, `rig.ts` and `paint.ts` (swept by `d8f7fcd` and `e6cbf80`). Those paths cannot simply be filtered out:
  `cast.ts`, `presets.ts`, `genes.ts`, `swatches.json` and `items.json` are machinery that was renamed into
  `src/features/` and lives at the tip, and the engine files of that time name the characters in their own text. So
  the kept history begins at `e6cbf80` (original `6b6819c`, "Sweep dead exports, … story-era character fields"),
  the last of the cuts, as a root commit holding its whole tree, and keeps only what descends from it; the one merge
  whose first parent is older (`1070cd7`, original `13407db`, "Merge the base-pair refactor") keeps only its parent from
  the cut branch. Measured by the plan audit: **126 commits** (`main` 111, the wardrobe 7, c5 6, turned face 2),
  **1.04 MiB**, `main`'s tree byte-identical to `$PIN`'s, **0 blobs** naming SNEKPRTY, no path of the cut content in any
  commit. What is left of the characters in kept text is "the Nurse" in three comments of the tip and in two files of
  the wardrobe branch (task 12, step 4 rewords them; the blobs before that commit keep them, since the tip must equal
  the source byte for byte), and the guard in `fringe.test.ts` that checks a hair style's text names none of them.
  Everything before the cut stays in the archived repository; ids from before it (for example `82822ff`) are not in the
  framework's history and are found there.
- The imported commits keep their own subjects (10 of 347 are Conventional Commits). They are history, not new work;
  rewriting their messages would falsify the record. Nothing in the repository checks commit subjects (no commit-lint
  in `lefthook.yml` or the workflows). The rule "Conventional Commits on a branch with a pull request" holds for every
  commit this plan authors, the merge commits included.
- Commit ids change. `filter-repo`'s commit map (old id to new id) is committed as
  `docs/provenance/figures-commit-map.txt`, so an id quoted in an old document (`d5ca055`) can be found. It maps the
  commits from the cut on; an id from before the cut is found only in the archived repository.
- **A checksum manifest is written whichever way history goes**: `docs/provenance/figures-manifest.json`,
  the SHA-256 of each of the 131 files under the five folders and the 3 root files at `23f889c8`, checked against the
  merged tree in task 2.
- **The 228 audit PNGs (12.2 MB) and the rest of the builder's `docs/` are not brought**, in the tree or in the
  history. The manifest and `docs/provenance/sources.md` name the source repository and commit where they stay.
- The two fix branches the Owner asked for are filtered in the same run, so their commits can be cherry-picked with
  their authorship and messages (tasks 4c and 4d).
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
- **Time, measured** (x86_64, 4 cores): the whole suite (47 files, 561 tests) takes at most **227 s** (another suite
  shared the cores); the five goldens with `ulp.test.ts` and `identity.test.ts` take **27 s** under the framework's
  Node 24.21. Per file, 16 of the 47 files take 80% of the time; the goldens, the pins, the last-bit test, the API
  pin and the layer test (9 files) are 23% of it.
- **227 s is too long for the commit hook** (the coordinator's ruling), and nothing may leave the gate. So the
  suite is two Vitest projects from task 7 on:
  - `goldens`: the five goldens, the identity pins, the last-bit test, the API pin and the layer test. About 30 to
    60 s. It runs **always**: in the hook, in `pnpm check`, in CI.
  - `unit`: the other 38 files (each feature's guard tests). About 3 minutes. It runs in **`pnpm check` and CI**,
    and in the hook only when asked.
  - How: the root `test:unit`, `test:unit:2d` and `test:unit:3d` scripts set `AF_UNIT_FULL=1`; `turbo.json` names
    `AF_UNIT_FULL` in the `env` of a task entry for this package alone, `@automata/figures#test:unit` (which repeats
    the generic entry's `passThroughEnv`, since a package's entry replaces it), so the painter's two runs are cached
    apart and every other package's hook run still serves `pnpm check`; the package's `test:unit` script is
    `vitest run --project goldens` plus `--project unit` when the variable is set. The hook's command
    (`turbo run test:unit --filter="...[HEAD]"`) does not set it. `AGENTS.md`'s "the gate runs every unit test"
    still holds, because the gate is `pnpm check`.
  - Rejected: a `tests/slow/` folder. `AGENTS.md` keeps `slow/` for what needs a real browser or the network and is
    run by hand; these tests need neither and must stay in the gate.
  - A commit that touches only the kit never runs the painter's tests at all: the hook's filter takes changed
    packages and what depends on them, not what they depend on.
- **The view check** (GPU frame equal to the CPU's, byte for byte) becomes a browser suite in task 11 and runs with
  `pnpm test:browser:3d` and in `.github/workflows/3d.yml`, not in `pnpm check`. Until task 11 it is run by hand after
  any change under `src/features/view/`.
- **EnvironmentBuilder's three:** see the first question for the Owner. Measured: `base` (8 frames) and `scenes`
  (14 frames) move as soon as its painter is the framework's pin. Default: they do not come; `tiles` comes restated
  (task 15; the plan audit ran the cross-check: the world kit's pipeline gives all 112 md5s).
- **The character kit's and the world kit's goldens do not move.** The kit's are run in tasks 3, 4, 5 and after every
  conform task.

**Every place a golden could move. Each is a stop: do not re-record, write what moved in the log, tell the
coordinator.**

| Where | Why it could move | What catches it |
|---|---|---|
| Task 2, the arrival | a file differs from the source; Node 24 or Vitest 5.0.3 in place of the builder's | the manifest check; the builder's suite as it is (measured: the goldens pass under Node 24.21) |
| Task 3, the door | the kit resolves a different copy of `pixi.js` or `@pixi/3d`, or different source | the kit's unit goldens (`runway-cells.json` and the others under `tests/fixtures/goldens/`) and its Chromium suite |
| Task 4c, the c5-finish fixes | six commits change `paint.ts`, `fabric.ts`, `light.ts`, `figure.ts` (measured for all six by the plan audit, with step 3b's fix: no golden moves); N4 also breaks `lighting/sprite.ts`, which `main` added after the branch was cut (step 3b) | the five goldens, the identity pins, the kit's goldens; step 3b's test for a second fabric depth |
| Task 4d, the turned face | **expected to move, and the one re-record this plan makes**: the actors, base and sprites goldens, and `stage/sheets.test.ts`, which reads the base golden (measured by the plan audit: 5 tests fail in 4 files), and whichever of the kit's cells show a turned face | the sheet; nothing is re-recorded before the Owner has seen it |
| Task 5, the wardrobe branch | its seven code commits change `hair.ts`, `garments.ts`, `paint.ts`, `parts.ts`, `fit.ts`; one of its pins, `face-d2.test.ts`, holds a float to the last bit as Node 22 computed it and fails on Node 24.21 (measured; no cell moves) | the five goldens, the branch's own pins, the kit's goldens; step 3's stop |
| Task 6, format | none expected (syntax only) | the suite |
| Task 7, the layout | a golden reads its data by a relative path; module load order changes with the move | the suite; a golden that cannot find its data fails loudly |
| Task 6, lint's automatic fixes | none expected (Biome's safe fixes only) | the suite |
| Task 8, lint by hand | a rewritten assignment-in-expression, a NaN test | the suite after each rule |
| Tasks 21 to 27, the strict flags | a check added where an index can be out of range changes a path that was silently reading `undefined` | the suite after each folder; a golden that moves there has found a real out-of-range read, and is a stop with the index named |
| Task 9, the splits | registries fill at module load; the part index seeds the grain, so order matters | the suite after each split |
| Task 10, Zod | a parse that drops or reorders keys changes iteration order | a key-order test written first; the suite |
| Task 11, the browser suite | none to CPU goldens; the GPU cases are new recordings of equality, not images | the cases themselves |
| Task 15, the tiles | the world kit's pipeline has drifted from the builder's | the cross-check itself |
| Task 16, the hunks | a ported hunk changes a framework frame | the 3D package's and the world kit's suites |
| Any task, another machine | a last bit of `Math.sin` on another architecture (the arm64 difference fixed in `d5ca055`), or of any maths on another Node (V8) version (measured by the plan audit: Node 22.23 and 24.21 differ in one float of `headForm`, task 5) | `ulp.test.ts` in the suite; the pull request's CI run; the Owner's run on arm64 with Node 24.21 (task 13) |
| After the fold, the `@pixi/3d` beta.3 upgrade | `FlatMaterial` encodes colour for display; the material template changes | `tests/unit/view/template.test.ts` fails by design; the browser suite of task 11 |

### 3. The move and the conform are separate

Tasks 2 to 5 move: after them the source is the builder's own, byte for byte, and its suite passes as written. Tasks 6
to 12 conform, each a commit or a short run of commits that changes one thing and proves no pixel changed.

| Task | Conform step | What it proves |
|---|---|---|
| 6 | Biome's format, then Biome's automatic lint fixes: two mechanical commits, no hand edit, before anything else is touched | later diffs are readable; `pnpm lint` reads the package's formatting |
| 7 | `src/shared/<layer>/`, `src/features/view/`, `src/entries/`; tests in `tests/unit/`; `#src/…` imports; the framework's Vitest preset; the layer test restated; the suite in two projects | `pnpm boundaries --features` and `style`'s test-imports rule pass with the package in their lists; the layer order still holds; the hook runs the goldens only |
| 8 | The lint rules that need a hand, one a commit | `pnpm lint` passes with no exclusion |
| 9 | Files of at most 600 lines | `pnpm style` passes with the package in its names, length and plan-comments list |
| 10 | Zod schemas for the eight libraries | a wrong library fails at load, in words |
| 11 | `view-check` as a browser suite | the GPU equality runs in a gate, not by hand |
| 12 | The readme, the contract, comments, provenance | no path or comment names the submodule; the builder's rules are written in the framework's form |
| 21 to 27 | `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, folder by folder | the painter compiles under the framework's base with no exception; the declarations step is gone |

**The two strict flags: the ledger.** The package arrives with the two flags off, stated in its `tsconfig.json` with
a comment that says why (the coordinator's ruling). 1,395 errors at `23f889c8`; the first strict task measures them
again on the conformed tree (the fix branches, the wardrobe branch and the removed `!`s change the count) and fills
the last column.

Each task also takes its layers' test folders (`tests/unit/<layer>`, after task 7), which the package's `tsconfig.json`
compiles too; the first ledger counted only `src` and `base`. The plan audit counted the whole package with the fix
branches and the wardrobe branch applied (before task 6), in the builder's layout: `src` 1,427, `tests` 579, `scripts`
51, `viewer` 28.

| Task | Folders (after task 7's layout) | `src` at `23f889c8` | `src` / `tests` at the audit | Measured at the task |
|---|---|---|---|---|
| 21 | `shared/math`, `shared/body`; `tests/unit/{math,body}` and `tests/fixtures` (the old `support`, `draw.ts`) | 101 + 89 = 190 | 187 / 45 | |
| 22 | `shared/paint` but for `paint.ts` (`raster.ts` 142) | 145 | | |
| 23 | `shared/paint/paint.ts` and the parts task 9 split it into; `tests/unit/paint` | 511 | 668 for all of `paint` / 54 | |
| 24 | `shared/lighting`, `shared/motion`; their tests | 57 + 56 = 113 | 113 / 47 | |
| 25 | `shared/hair`, `shared/outfit`; their tests | 103 + 23 = 126 | 152 / 260 | |
| 26 | `shared/figure`, `shared/base`; their tests | 226 + 0 = 226 | 225 / 49 | |
| 27 | `shared/actors`, `shared/stage`, `features/view`, `entries`; their tests, `golden`, `api`, `layers`; `scripts`, `viewer` | 68 + 7 + 9 + 0 = 84 | 82 / 124, and 79 in `scripts` and `viewer` | |
| | | **1,395** | **1,427 / 579**, and 79 | |

Seven tasks, on their own branch right after the first group, **inside this workstream** (recommended, and the
coordinator's default): figures are about to be changed a lot, and every change made before the flags are on adds to
the ledger. The first group's pull request is not held up by them, and the declarations step is the only cost of
the gap.

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
- **What the upgrade inherits, exactly:** (0) the upgrade branch already moved the `pixi.js` pin to 8.23.0 in
  `vendor/figure-builder/package.json`, which task 4 deletes: when it merges `main`, the modify/delete conflict is
  resolved by deleting the file and moving the pin in `extensions/figures/package.json` (`peerDependencies` and
  `devDependencies`); (1) one more `file:` specifier to move, in
  `extensions/figures/package.json`, with its `pixi.js` peer; (2) `src/features/view/cell-template.ts`, the copy of
  the material template, remade from beta.3's, and `tests/unit/view/template.test.ts`, its guard, which fails until
  it is; (3) `CellMaterial` (a `FlatMaterial`) and `CellSprite` under beta.3's display encoding of unlit colour, held
  to byte equality with the CPU frame by task 11's browser suite; (4) per-texture samplers in place of the template's
  texel snap; (5) `Sprite3D`'s single options object in `cell-sprite.ts`.
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
| `.gitignore` lines 41 and 42 | replaced by `extensions/figures/types/` |
| root `package.json`, `boundaries` | `figure-builder` becomes `@automata/figures` in the 13 `--forbid` entries |
| root `package.json`, `@pixi/3d` and `pixi.js` | removed if nothing else needs them (they are there because the submodule's sources resolved from the root); kept with a new comment if a check fails without them |
| `tooling/release/tests/unit/closed-beta-guard.test.ts` lines 33 and 35 | the forbidden name becomes `@automata/figures` |
| `extensions/character-kit/package.json` line 38 | `"figure-builder": "workspace:*"` becomes `"@automata/figures": "workspace:*"` |
| `extensions/character-kit/src/shared/figure-builder/door.ts`, `door-view.ts` | new specifiers; the folder becomes `src/shared/figures/` in task 12 |
| `extensions/character-kit/README.md` lines 52 and 53, and the 10 kit files that say "submodule", "upstream" or `vendor/FigureBuilder` | reworded |
| `docs/provenance/sources.md`, "The figure builder as a submodule (2026-11-10)" | kept as history; a section "The figure painter, folded in" follows it |

**The hand-run type step does not vanish; it stops being hand-run.** The kit and everything that imports the kit are
compiled with the framework's strict base, and a `.ts` source they import is checked with *their* options: importing
the painter's source directly would put its 1,395 strict errors into the kit's typecheck. That is why the wrapper
builds declarations with the builder's own settings. The package keeps that: `tsconfig.types.json` and a `prepare`
script emit `types/`, and `exports` names the declarations as `types` and the source as `default`. With the source in
the repository, `pnpm install` always runs it, so no session runs it by hand and a fresh clone needs no manual step.
It goes for good in task 27, when the painter passes the two strict flags.

In task 4b, on the Owner's word of 2026-11-12, quoted in the commit and in the pull request: **"remove the submodule
checkout and SUBMODULES_TOKEN from the workflows"** (line numbers at `main` `0df11a43`):

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

Measured: with no `.gitmodules`, `checkout-submodules.sh` exits 0 with and without a token. So tasks 1 to 4 leave
every workflow untouched and CI still runs; task 4b is its own commit, made only after the checks pass without the
submodule.

### 6. Workstream 4's tasks 13 to 16 after the fold

Written as an addendum at the end of this plan ("Addendum for workstream 4's plan"), for the coordinator to move.

### 7. The two old repositories

Both are retired and **archived by the Owner (2026-11-12)**: the notes are merged (FigureBuilder `3caa9ad`, merged as
`c29284c`; EnvironmentBuilder `6983342`, merged as `1eb60f9`; "The retirement notes" below). Task 19 records those
commits.

**The archived sources, for every step that reads them.** An archived repository is read only and stays readable:
it clones, its branches and tags fetch, and its pull requests and issues read. Nothing can be pushed, merged,
commented or closed there (FigureBuilder #29 stays open for good). So:

- Before task 1, the execution session attaches both repositories **read only** (`add_repo`, access `read`): task 1's
  `git submodule update --init` and every `$FB` clone need FigureBuilder, and group 2's `$EB` needs EnvironmentBuilder.
- Each `main` has moved past the commit this plan reads (the merged notes). **No step reads `main`**: every step names
  `$PIN` (`23f889c8`), `856498a` (the wardrobe branch), the fix branches by name, or `f7c5356`. Task 2 sets the filtered
  clone's `main` to `$PIN` before filtering and checks it.
- A step that would need a change there (a fix, a re-record, a note) is made in the framework instead, or not at all.

Their open branches are in the surveys. By the Owner's answer of 2026-11-12 ("bring the figure builder branches in
that we missed"), `claude/c5-finish-fixes` and `claude/turned-face-both-eyes` come across (tasks
4c and 4d); the content branches and spikes do not, and the survey says why each was judged content.

### 8. Risks, and how the plan would notice each

| Risk | How it is noticed |
|---|---|
| A golden moves on another machine architecture | `tests/unit/hair/ulp.test.ts` redraws with the maths a last bit off and runs in every `pnpm check`; the pull request's CI runs the suite on the runner's architecture; task 13 asks the Owner for one run on arm64 before merge (`AF_UNIT_FULL=1 pnpm --filter @automata/figures test:unit`). A difference is fixed in the painter, never with a per-architecture golden |
| Test time added to `pnpm check` and the commit hook | task 1 times `pnpm check` and `pnpm test:unit` before; task 13 times them after. More than 5 minutes added to an uncached `pnpm check` is reported to the coordinator with the slowest files (`vitest --reporter=verbose`), not fixed by moving goldens out of the gate |
| Repository size | task 1 records `git count-objects -vH`; task 13 records it again. Expected growth about 2 MB. More than 5 MB is a stop: something that is not code came across (check `git rev-list --objects` for the largest new blobs) |
| Licence records for photos | nothing moves: the 38 photos are already in the kit with source, licence and credit, and `extensions/world-kit/tests/unit/textures/swatch-tiles.test.ts` fails without them. Task 17's document says where the record lives. The painter has no third-party asset: no PNG, font or sound in its source or tests |
| Name clashes | the package's `Figure`, `Cell`, `stageFrame`, `lightSprite`, `POSES`, `GAITS` sit beside core's mesh figures (`packages/3d/src/features/figures/`), the `figure` content kind and `spriteLight` in `packages/3d/src/features/look/sprite-light.ts`. Task 12 lists every export name the package shares with `@automata/3d`'s entries (a command, below) in the package's readme with one line each on which is which. No module can import the wrong one by accident: the kit's door test allows only the door files to import the package, and `pnpm boundaries --forbid` keeps it out of core |
| A bounds check in a hot loop slows the painter | the inline `xs[i] ?? outside(xs, i)` (measured free in `rasterize`; a generic reader was 5.5 times slower there); tasks 21 to 27 time the painter's suite and the painter's bench (task 21, step 3b) before and after each folder; more than 10% slower is reported with the loop named before going on |
| The declarations go stale | the package's `typecheck` rebuilds them and turbo runs it before every other typecheck (task 3's `dependsOn`); `pnpm install` builds them on a fresh clone |
| The filtered history is not the source | the manifest check of task 2: 134 files, each SHA-256 equal to `git show 23f889c8:<path>` |

## Questions for the Owner, and the answers so far

1. **EnvironmentBuilder's goldens: open.** Measured: with its painter at the framework's pin,
   `tests/golden/base.test.ts` (8 of 8) and `tests/golden/scenes.test.ts` (14 of 14) fail; `tiles` passes.
   **A (default, planned):** the CPU scene renderer and those two goldens do not come; the `tiles` golden comes
   restated as a world-kit check; the spec's rule 1 is amended to say so. The survey's first table says what A gives
   up. **B:** the CPU scene renderer comes as a private reference tool and the two goldens are re-recorded once
   (task 20). **C (rejected):** a frozen second copy of the painter. *To change: choose B, and task 20 is planned
   before group 2 starts.*
2. **The workflow files: answered, 2026-11-12.** "remove the submodule checkout and SUBMODULES_TOKEN from the
   workflows". Task 4b, in the first group's pull request, as its own commit.
3. **FigureBuilder's branches with painter work not on its `main`: answered, 2026-11-12.** "bring the figure builder
   branches in that we missed". Tasks 4c and 4d. The turned-face fix re-records goldens only after the Owner has seen
   its sheet.
4. **The retirement note: answered and done, 2026-11-12.** The coordinator committed it to each repository; the Owner
   merged both and archived both repositories (FigureBuilder `c29284c`, EnvironmentBuilder `1eb60f9`).
5. **The package's licence: the coordinator agreed.** `"license": "MIT"`, `"private": true`.

## Calls made in this plan, for the coordinator to check

1. **The home and the name:** a private extension, `extensions/figures`, `@automata/figures` (ruled by the
   coordinator; the first survey draft proposed `painted-figures`).
2. **The Pixi-free pipeline lives in `src/shared/<layer>/`**, not in `src/features/`: the framework's feature rule
   forbids one feature importing another, and the pipeline is layers. `src/features/view/` is the one feature.
3. **The layer order stays a test in the package** (`tests/unit/layers.test.ts`), not a new rule in
   `automata-check-boundaries`: it runs in `pnpm check` through `test:unit`, and a new boundaries mode would change a
   published package for one private consumer.
4. **The fold lands before the beta.3 upgrade.**
5. **Filtered history, not a subtree merge and not a plain copy.**
6. **Two compiler flags are off for the painter when it arrives, and are turned on by tasks 21 to 27 on a third
   branch** (ruled by the coordinator: inside this workstream, folder by folder, no casts and no non-null
   assertions). The declarations step lives only as long as that gap.
7. **`@napi-rs/canvas`** (not in the lockfile) stays a `devDependency` of the private package for its hand-run sheet
   scripts; `pnpm deps:new` will report it.
8. **The builder's `docs/superpowers/` and its 228 PNGs do not come.** The wardrobe cycle's spec, plan and plan audit
   are copied to `docs/archive/figure-painter/c9-wardrobe/` (links there are not checked), because workstream 4's
   remaining wardrobe tasks use that plan as their step-level text.
9. **EnvironmentBuilder's GPU harness is not wanted** (the builder's own log ended it: `9c2df06`, "the look moves to
   AutomataFramework"); its `gpu:parity` idea is listed as following work.
10. **Tuning a swatch's knobs against its reads is an editor gap**, not a command to port.
11. **The painter's suite is two Vitest projects**, `goldens` always and `unit` when `AF_UNIT_FULL=1` (set by the
    root unit-test scripts, so by `pnpm check` and CI), so the commit hook runs about a minute of it and the gate
    all of it.
12. **The fix branches are cherry-picked before the wardrobe branch is merged and before any conform step**, so each
    commit applies as it was written. Measured in a scratch clone: the five clean c5 picks, the turned-face fix and
    the wardrobe merge apply together with no conflict; N4 has the one hunk of task 4c step 3, and breaks
    `lighting/sprite.ts` with no conflict at all (task 4c step 3b, found by the plan audit).

## Global constraints

- **No pixel changes, with one exception the Owner asked for.** No recorded golden, image or hash is re-recorded in
  this plan but in task 4d (a turned face keeps both eyes), where the Owner sees a before-and-after sheet first and
  one commit names the reason. Anywhere else, a golden that would move stops the task. The only new recordings are
  first recordings named by their task (the restated tiles list in task 15, which is the builder's own data).
- **The move and the conform are separate commits.** Tasks 2 to 5 change no line of the builder's source or tests.
- **The framework's rules** (`AGENTS.md`): feature folders, `pnpm boundaries`, tests in `tests/` importing `#src/…`,
  kebab-case names, files of at most 600 lines, Zod as the only schema language, PixiJS only for rendering, comments
  that say why and not which plan asked.
- **Private until Pixi 3D is public.** `"private": true`; no changeset; `pnpm boundaries --forbid` and the closed-beta
  guard keep the package out of everything published.
- **No paid stage and no model call.**
- **Neither builder is core.** Brand or game content does not come: no branch but `main`, `claude/c9-wardrobe`,
  `claude/c5-finish-fixes` and `claude/turned-face-both-eyes`.
- **The strict tasks never use an `as` cast or a non-null assertion** to quiet the compiler. Where an index really
  can be out of range, the fix is a check.
- **Test first where code changes** (tasks 4c step 3b, 7, 10, 11, 15, 16, 21): the failing test is written and seen to
  fail for the right reason before the change.
- **Stage files by path.** Never `git commit -a`. `pnpm format` before each commit. Conventional Commits.
- **Workflow files change only in task 4b**, with the Owner's words quoted in the commit and the pull request.
- **Never push to `mcthaydt/FigureBuilder` or `mcthaydt/EnvironmentBuilder`.** Clone them read only, outside the
  framework's working tree.

### The gates

- After every task: `pnpm check` (exit 0), and the suites the task names.
- The painter's suite, whole: `AF_UNIT_FULL=1 pnpm --filter @automata/figures test:unit` (before task 7 the
  variable does nothing and the script runs everything). Expected until task 4c: 47 files, 561 tests. Tasks 4c, 4d
  and 5 each add tests; record the new numbers at each and use them from then on. After task 7 the file count is the
  same and the paths are `tests/unit/…`.
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
2. **A pull request from a fork has no secrets.** The submodule step must stay harmless with no token until task 4b removes it
   (task 4, step 5 runs the script both ways).
3. **A stale `types/` folder.** Edit one exported type in the painter and run `pnpm typecheck` once: the kit must see
   the new type without a second command (task 3, step 5).
4. **A library file with a wrong field.** After task 10 a misspelt key in `swatches.json` fails at load, naming the
   file and the key, not as a wrong colour later (task 10, step 1).
5. **A consumer that reaches past the entries.** `import '@automata/figures/features/paint/paint'` must not
   resolve: the package exports three entries and no wildcard (task 3, step 1's test).

---

## Group 1: FigureBuilder (`claude/builders-fold-figures`)

From `origin/main`. One draft pull request, opened at the end of task 13. In every command below, `$FB` is a scratch clone of
`https://github.com/mcthaydt/FigureBuilder` outside the framework's working tree, and `$PIN` is
`23f889c8a5cda3511f4a2d044324c57ba624dc1c`.

### Task 1: The baseline, and the checksum manifest

**Files:**
- Create: `docs/provenance/figures-manifest.json`

- [ ] **Step 1: The baseline.** Attach `mcthaydt/FigureBuilder` and `mcthaydt/EnvironmentBuilder` read only first
  ("The archived sources"). `git submodule update --init`, `pnpm install --frozen-lockfile`, then `pnpm check`
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
const out = { source: "mcthaydt/FigureBuilder", commit, home: "extensions/figures", files: {} }
for (const f of files) out.files[f] = createHash("sha256").update(execFileSync("git", ["-C", src, "show", `${commit}:${f}`])).digest("hex")
fs.writeFileSync("docs/provenance/figures-manifest.json", `${JSON.stringify(out, null, 2)}\n`)
console.log(files.length)' "$FB" "$PIN"
```

  Expected output: `134` (47 in `src`, 1 in `base`, 73 in `tests`, 6 in `scripts`, 4 in `viewer`, 3 root files).
- [ ] **Step 3: Commit.** `git add docs/provenance/figures-manifest.json`, then
  `chore(provenance): the figure painter's files at 23f889c8, by checksum`.

**Done when:** the log holds the baseline numbers and the manifest lists 134 files.

### Task 2: The painter's source arrives with its history; its own suite passes as it is

**Files:**
- Create (by merge): `extensions/figures/{src,base,tests,scripts,viewer}/**`, `package.json`,
  `tsconfig.json`, `vitest.config.ts`
- Create: `extensions/figures/tsconfig.types.json`, `docs/provenance/figures-commit-map.txt`
- Modify: `extensions/figures/package.json`, `biome.json`, `knip.jsonc`, `.gitignore`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: the workspace package `@automata/figures` with `exports` `"."`, `"./kit"`, `"./view"`, each
  `{ "types": "./types/src/<entry>.d.ts", "default": "./src/<entry>.ts" }` for `index`, `kit`, `view`; and its
  scripts `prepare`, `typecheck`, `test:unit`.

- [x] **Step 1: Filter.** In a second fresh clone (filter-repo rewrites the clone it runs in):

```bash
python3 -m pip install --user git-filter-repo==2.47.0
git clone https://github.com/mcthaydt/FigureBuilder "$FB-filtered" && cd "$FB-filtered"
# The archived repository's main is past the pin (the merged retirement note): filter the pin, never main.
git checkout -B main "$PIN"
for b in c9-wardrobe c5-finish-fixes turned-face-both-eyes; do git branch claude/$b origin/claude/$b; done
REFS="main claude/c9-wardrobe claude/c5-finish-fixes claude/turned-face-both-eyes"
# History starts at the last content cut ("History"): keep only what descends from it, and drop every parent outside
# that set (the cut itself becomes the root; one merge loses its pre-cut first parent).
CUT=6b6819cb501d12c7e6d079f208b3ca42d5221333
{ echo "$CUT"; for r in $REFS; do git rev-list --ancestry-path "$CUT..$r"; done; } | sort -u > ../kept.txt
while read -r c; do
  parents=$(git rev-list --parents -n1 "$c" | cut -d' ' -f2-); keep=""
  for p in $parents; do grep -qx "$p" ../kept.txt && keep="$keep $p"; done
  [ "$(echo $keep)" = "$(echo $parents)" ] || git replace --graft "$c" $keep
done < ../kept.txt
git replace -l   # expected: 13407db8… and 6b6819cb…, nothing else
git filter-repo --force \
  --path src --path base --path tests --path scripts --path viewer \
  --path package.json --path tsconfig.json --path vitest.config.ts \
  --to-subdirectory-filter extensions/figures \
  --refs refs/heads/main refs/heads/claude/c9-wardrobe \
         refs/heads/claude/c5-finish-fixes refs/heads/claude/turned-face-both-eyes
test "$(grep "^$PIN " .git/filter-repo/commit-map | cut -d' ' -f2)" = "$(git rev-parse main)" && echo "main is the pin"
```

  `git filter-repo` writes the grafts into the rewritten commits, so the history fetched from this clone carries them
  without any `refs/replace`. Expected, from the plan audit's dry run in a fresh clone (filter-repo 2.47.0): `main is
  the pin`; `git log --oneline main | wc -l` prints **111** (from the cut; the commits that touched none of the kept
  paths are dropped); `git rev-list --max-parents=0 main` is one commit, "Sweep dead exports, …";
  `git ls-tree -r --name-only main | wc -l` prints **134**, none outside `extensions/figures/`; `git rev-list --count
  main..claude/<b>` prints **7** for `c9-wardrobe` (its three document and evidence commits are dropped), **6** for
  `c5-finish-fixes` (N3 and the handoff touch only files that do not come) and **2** for `turned-face-both-eyes`; the
  four refs fetched into an empty repository pack to **1.04 MiB**, 126 commits. The filter is deterministic, so the
  filtered ids are expected to be: `main` `c85b961`, the root `36a135e`; S1 `4c22b62`, S2 `a03b34f`, N1 `164d9ef`, N2
  `cb8e24d`, N5 `b121463`, N4 `e468d1f`; the turned-face fix `3cf1f2a` (and its old re-record `4988a0a`, not brought);
  the wardrobe's F0 `570ff18` to F6 `47b799d`. Different ids with the same subjects are not a stop; different counts
  are. Then the content check, in an empty repository that fetched the four refs (`git init /tmp/hist && cd /tmp/hist
  && git fetch "$FB-filtered" 'refs/heads/*:refs/remotes/p/*'`): `git grep -l -i -E 'snek[ _-]?prty' $(git rev-list
  --all) -- | wc -l` prints **0**, and `git log --all --no-renames --name-only --format= | sort -u | grep -cE
  'streetwear|graphics\.json|looks\.json|sets\.json|headwear|dressed|portrait|random-cast|render/scene'` prints
  **0**. Anything else is a stop. If `pip` cannot
  install the tool, use the fallback of "History" and say so.
- [x] **Step 2: Merge.** In the framework:

```bash
git remote add painter-history "$FB-filtered" && git fetch painter-history
git merge --allow-unrelated-histories --no-ff painter-history/main \
  -m "chore(figures): the figure painter's source arrives with its history"
cp "$FB-filtered/.git/filter-repo/commit-map" docs/provenance/figures-commit-map.txt
```

  The merge commit's body says: the source repository, `$PIN`, the paths kept, the paths left out and why, that the
  imported commits keep their own subjects, and that the history begins at the last content cut (`6b6819c`, as a root):
  what came before, with the builder's first cast and the Owner's SNEKPRTY graphics, is left out and stays in the
  archived repository ("History", above, lists the paths and the commits that cut them).
- [x] **Step 3: The manifest check.** Every file equal to its source:

```bash
node -e '
const { createHash } = require("node:crypto"), fs = require("node:fs")
const m = JSON.parse(fs.readFileSync("docs/provenance/figures-manifest.json", "utf8"))
const bad = Object.entries(m.files).filter(([f, sha]) => createHash("sha256").update(fs.readFileSync(`${m.home}/${f}`)).digest("hex") !== sha)
console.log(Object.keys(m.files).length, "files,", bad.length, "differ"); process.exit(bad.length ? 1 : 0)'
```

  Expected: `134 files, 0 differ`. Anything else is a stop.
- [x] **Step 4: Make it a workspace package, changing no source or test.** Edit only
  `extensions/figures/package.json`: `"name": "@automata/figures"`, `"version": "0.0.0"`,
  `"private": true`, `"license": "MIT"`, `"type": "module"`, the `exports` above, `"dependencies"`
  `{ "@pixi/3d": "file:../../vendor/pixi-3d/pixi-3d-0.1.0-beta.2.tgz" }`, `"peerDependencies"`
  `{ "pixi.js": "8.22.0" }`, `"devDependencies"` at the kit's versions (`pixi.js` 8.22.0, `typescript` 6.0.3,
  `vite` 8.3.3, `vitest` 5.0.3, `playwright` 1.63.0, `tsx` 4.23.15, `@types/node` 24.19.1) plus `@napi-rs/canvas`
  `1.0.10`, and the scripts `"prepare": "tsc -p tsconfig.types.json"`,
  `"typecheck": "tsc -p tsconfig.types.json && tsc --noEmit"`, `"test:unit": "vitest run"`, and the builder's
  `render`, `golden`, `lit`, `actors`, `c5`, `view-check` with `tsx` in place of `vite-node`. Copy
  `vendor/figure-builder/tsconfig.types.json` to `extensions/figures/tsconfig.types.json` unchanged but for
  its comment. Add `extensions/figures/types/` to `.gitignore`. Add, each with a comment that task 6 or task 7
  removes it, `"!extensions/figures"` to `biome.json`'s `files.includes` and
  `"extensions/figures/**"` to `knip.jsonc`'s `ignore`.
- [x] **Step 5: Install and run the builder's suite as it is.** `pnpm install` (the lockfile changes), then
  `pnpm --filter @automata/figures test:unit`. Expected: **47 files, 561 tests, all pass.** A failure is a
  stop: nothing has been changed, so the cause is the runtime (Node 24.21, Vitest 5.0.3) and is reported, not fixed
  by touching a golden. Then `pnpm --filter @automata/figures typecheck`: expected 0 errors in `src` and
  `base` (measured on TypeScript 6.0.3); if `tests`, `scripts` or `viewer` report errors under 6.0.3, list them in the
  log and leave them for task 7 with `"include"` unchanged.
- [x] **Step 6: The view check, by hand, once:** `pnpm --filter @automata/figures view-check`. Expected: exit
  0 (every case equal, or `webgpu: no adapter, skipped`). It was not run by the plan session; if it fails here on the
  untouched source, record the output and tell the coordinator before going on.
- [x] **Step 7:** `pnpm check` (exit 0), then commit by path:
  `chore(figures): a workspace package of the painter, as it arrived`.

**Done when:** the manifest check prints `134 files, 0 differ`, the builder's suite passes unchanged in the
framework's workspace, and `pnpm check` is green.

### Task 3: The character kit's door points at the package

**Files:**
- Modify: `extensions/character-kit/package.json:38`, `extensions/character-kit/src/shared/figure-builder/door.ts`,
  `door-view.ts`, `extensions/character-kit/tests/unit/shared/door.test.ts`, `turbo.json`, root `package.json`
  (`boundaries`), `tooling/release/tests/unit/closed-beta-guard.test.ts:33-35`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `@automata/figures`, `/kit`, `/view` from task 2.
- Produces: the door's export names unchanged (45 from the index, 10 from the kit entry, 2 from the view entry).

- [x] **Step 1: The failing test.** In `door.test.ts`, change the specifiers the three cases look for from
  `figure-builder`, `figure-builder/kit` and `figure-builder/view` to `@automata/figures`,
  `@automata/figures/kit` and `@automata/figures/view`, and add one case:

```ts
it('cannot reach past the three entries', async () => {
  const manifest = JSON.parse(readFileSync(new URL('../../../../figures/package.json', import.meta.url), 'utf8'))
  expect(Object.keys(manifest.exports)).toEqual(['.', './kit', './view'])
})
```

  Run `pnpm --filter @automata/character-kit exec vitest run --project unit tests/unit/shared/door.test.ts`.
  Expected: the three specifier cases FAIL (the door still imports `figure-builder`); the new case passes.
- [x] **Step 2: Switch.** The three specifiers in `door.ts` and `door-view.ts`; the dependency in the kit's
  `package.json`; `figure-builder` to `@automata/figures` in the root `boundaries` script's 13 `--forbid`
  entries and in the closed-beta guard test. Rewrite the door's header comment: the painter is a package of this
  repository, changed in place; the door stays so the kit takes only the names it uses.
- [x] **Step 3: Declarations before every typecheck.** Not only the kit compiles against the declarations: every
  workspace that imports the kit does (on `main` `examples/3d`; on `claude/last-light-prologue` the game too), and with
  no `types/` it type-checks the painter's source under the strict flags (seen by the plan audit: `examples-3d#typecheck`
  failed with the painter's `TS2532`s when the wrapper's `prepare` had run before the submodule was there). In
  `turbo.json` give the generic `typecheck` task `"dependsOn": ["@automata/figures#typecheck"]` and add
  `"@automata/figures#typecheck": {}` (its own entry, so it does not wait on itself). Check:
  `rm -rf extensions/figures/types && pnpm typecheck` passes with nothing else typed.
- [x] **Step 4:** `pnpm install`, then the door test (PASS), `pnpm boundaries` (0 findings), the guard test (PASS).
- [x] **Step 5: The stale-types check.** Add a throwaway exported type to
  `extensions/figures/src/index.ts`, import it in the door, run `pnpm typecheck` once: expected green. Revert
  both edits (`git checkout -- <the two files>`); `git status` shows neither.
- [x] **Step 6: The kit's goldens.** The kit's unit suite and its Chromium suite: the same counts as task 1,
  `git status` clean after them (no recorded file rewritten). A moved cell is a stop.
- [x] **Step 7:** `pnpm check`; commit `refactor(character-kit): the door imports the painter as a workspace package`.

**Done when:** nothing in the kit imports `figure-builder`, and the kit's suites give the baseline's counts.

### Task 4: The submodule and its wrapper go

**Files:**
- Delete: `.gitmodules`, `vendor/FigureBuilder` (gitlink), `vendor/figure-builder/` (5 tracked entries)
- Modify: `pnpm-workspace.yaml`, `biome.json:20-21`, `knip.jsonc:8-9,28-31`, `.gitignore:41-42`, root `package.json`,
  `pnpm-lock.yaml`

- [x] **Step 1: Remove.**

```bash
git submodule deinit -f vendor/FigureBuilder
git rm -f vendor/FigureBuilder
rm -rf .git/modules/vendor/FigureBuilder
git rm -r vendor/figure-builder
git rm -f .gitmodules
```

- [x] **Step 2: The configuration.** Take the comment and the entry out of `pnpm-workspace.yaml`; the two exclusions
  out of `biome.json`; the ignore entry and the wrapper's workspace out of `knip.jsonc`; lines 41 and 42 out of
  `.gitignore`.
- [x] **Step 3: The root's Pixi.** Remove `@pixi/3d` and `pixi.js` from the root `package.json`, `pnpm install`,
  `pnpm check`, and the kit's Chromium suite. If all pass, they stay out. If something fails to resolve them, put them
  back with a comment naming what needs them.
- [x] **Step 4:** `grep -rIn -iE "figure-builder|vendor/FigureBuilder|gitmodules" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs . | grep -v "^./.github/"`
  Expected: only the kit's door folder name and comments (task 12 rewords them). Anything that is configuration or
  code is fixed here.
- [x] **Step 5: The workflows' step is harmless.** `SUBMODULES_TOKEN= bash .github/scripts/checkout-submodules.sh;
  echo $?` and `SUBMODULES_TOKEN=x bash .github/scripts/checkout-submodules.sh; echo $?`: both print `0`.
  `pnpm --filter @automata/repo-hygiene test:unit` still passes: the invariant wants the step present, and it is.
- [x] **Step 6: A fresh clone.** After committing: `git clone --branch claude/builders-fold-figures <this repository's
  path> /tmp/fresh && cd /tmp/fresh && git fetch <this repository's path>
  refs/remotes/origin/main:refs/remotes/origin/main && pnpm install --frozen-lockfile && pnpm check`. (The fetch gives
  the clone the `origin/main` that `check:changesets` compares with; a clone of a local path has none of its own.)
  Expected: exit 0 with nothing else typed.
- [x] **Step 7:** Commit `chore(repo): the figure builder's submodule and its wrapper package go`.

**Done when:** `git submodule status` prints nothing, a fresh clone passes `pnpm check`, and no workflow file changed
yet (`git diff --stat origin/main -- .github` is empty): the checks pass without the submodule before task 4b
touches a workflow.

### Task 4b: The workflows lose the submodule step

The Owner, 2026-11-12: **"remove the submodule checkout and SUBMODULES_TOKEN from the workflows"**. Put those words
in the commit body and in the pull request's text. Its own commit, after task 4's checks.

**Files** (line numbers at `main` `0df11a43`; "What retires" has the same table):
- Modify: `.github/workflows/ci.yml` (80-85, 174-179, 252-257, 316-321, 380-385, 419, 436), `3d.yml` (23-25, 58-63,
  116-121, 162), `release-packages.yml` (81-86, 126, 148-153), `release-checks.yml` (20-21, 46-51), `game-ci.yml`
  (29-30, 47-52), `site.yml` (22-23, 52-58), `windows-trial.yml` (33-39, 71-77), `consumer-smoke.yml` (40-45); in
  each, the `secrets:` key itself where `SUBMODULES_TOKEN` was its only entry
- Delete: `.github/scripts/checkout-submodules.sh`, `tooling/repo-hygiene/tests/unit/checkout-submodules.test.ts`
- Modify: `tooling/repo-hygiene/src/workflow-invariants.ts` (rule 6 at 11-12, the token at 41, the script's name at
  46-47, the checks at 87-90, 102-104 and 117-138), `tooling/repo-hygiene/tests/unit/workflow-invariants.test.ts`
  (the four cases at 81, 95, 118, 141), `docs/runbook.md:63`

- [x] **Step 1: The failing test.** In `workflow-invariants.test.ts`, replace the four submodule cases with one
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

  Run `pnpm --filter @automata/repo-hygiene test:unit`. Expected: FAIL, 73 lines match.
- [x] **Step 2:** Remove the listed lines from the eight files (`3d.yml`'s two path filters go because
  `extensions/**` already covers the painter); delete the script and its test; take rule 6, `SUBMODULES_TOKEN` in
  `READ_ONLY_SECRETS`, `SUBMODULE_SCRIPT` and the checks that use them out of `workflow-invariants.ts`; remove the
  runbook's row.
- [x] **Step 3:** The test passes; every other invariant still holds (the case "hold for every workflow in the
  repository" passes); `pnpm check`; `pnpm lint:actions` if Docker is there (say so if not).
- [x] **Step 4:** Commit `ci: the workflows no longer check out a submodule`, with the Owner's words in the body.
  Tell the coordinator the `SUBMODULES_TOKEN` secret can be deleted by the Owner once no open branch predates the fold:
  a branch that has not merged `main` past this commit still runs the old step on its pushes, which then warns and
  empties the submodule, and its install fails.

If `main` has moved the lines since `0df11a43` (`claude/last-light-prologue` adds two path filters just above
`3d.yml`'s submodule filters), the line numbers above are a guide only: step 1's test names every line that must go.

**Done when:** `grep -rn "SUBMODULES_TOKEN\|checkout-submodules" .github tooling docs/runbook.md` prints nothing and
`pnpm check` is green.

### Task 4c: The c5-finish fixes come across

`claude/c5-finish-fixes` in the retired repository: eight commits cut from its `08f54a6` (2026-11-10), 49 commits
behind its `main`. Six come; two touch only files that do not come (`CLAUDE.md`, `docs/superpowers/progress.md`).
They are cherry-picked from the filtered history, so each keeps its author and message, onto the painter exactly as
it arrived: before the wardrobe branch and before any conform step, because a reformatted file no longer takes them.

**What they change:** a dark gloss's shine stays within its patch cap, and the leather sheen tests run at density 1
(S1); the orphan clean-up spares a quilted chamber's crest (S2); a comment (N1); a handed tile tested on the arms at
three densities (N2); the sheen test's bound is the painter's own cap (N5); the weave keeps a table of fabric depths
in place of two values a texel (N4). Files: `paint/paint.ts`, `paint/fabric.ts`, `lighting/light.ts`,
`figure/figure.ts`, and two test files.

**Goldens:** measured in a scratch clone with S1, S2, N1, N2 and N5 applied: the five goldens, the identity pins and
the painter's tests pass (11 files, 163 tests). **No golden is expected to move, and none may**: the base pair wear
no gloss and no fabric. N4 was not measured (it needs the hand resolution below).

- [x] **Step 1: The five that apply cleanly.**
  `git log --reverse --format='%h %s' painter-history/main..painter-history/claude/c5-finish-fixes` gives the six
  filtered commits (expected S1 `27a8fa8`, S2 `8dfb448`, N1 `a293d24`, N2 `b3cdafb`, N5 `eaebfbf`, N4 `37cf985`; the
  commit map has the old ones: `7bd4fac`, `d5205bd`, `d77244c`, `6fff4fa`, `4ded644`, `e97df55`). `git cherry-pick -x`
  the first five, in that order. Expected: no conflict.
- [x] **Step 2:** The whole suite: all pass, the five goldens among them. A moved golden is a stop.
- [x] **Step 3: N4** (old id `e97df55`). `git cherry-pick -x` it. **One conflict is expected**, one hunk of
  `extensions/figures/src/features/figure/figure.ts`, where the cell cache is stored: `main` has since added `depth`
  to the cached cell, and the fix replaces the weave's `lo` and `hi` with `depths`. Keep both: the fix's `weave`
  line (`depths: wv.depths.slice()`, no `lo`, no `hi`) and `main`'s `depth: this.depth.slice(a, b)` in the cached
  object. Any other conflict is a stop.
- [x] **Step 3b: N4 meets `lighting/sprite.ts`.** `main` added `src/features/lighting/sprite.ts` (c8-lit) after the
  branch was cut, and git merges it cleanly, but it still reads the old `Weave`: `weave.lo[k]` and `weave.hi[k]` at line
  194 and `weave.on[k] === 1` at lines 100 and 175, and `tests/features/lighting/sprite.test.ts:164` reads `w.lo[k]`
  and `w.hi[k]` (measured by the plan audit: 4 `TS2339` errors after N4). The type errors are loud; the two `=== 1` are
  silent, and light a texel of a second fabric depth (`on === 2`) as untiled. No golden wears a fabric.
  1. The failing test first, in `tests/features/lighting/sprite.test.ts`'s `lightSprite on a fabric` block: a figure
     dressed in two of `fabric-fixtures.ts`'s fabrics whose `depthOf` differ (add a fixture fabric with another depth if
     none differ), lit with `lightSprite`; expect some texel with `weave.on[k] === 2`, and every texel with
     `weave.on[k] !== 0` equal to `tiled(colourAt(lit, k), weave.labels[k], ...depthAt(weave, k))`, as the block's
     existing case computes `lit`. Change the existing case's `w.lo[k], w.hi[k]` to `...depthAt(w, k)`. Run the file:
     FAIL (the `on === 2` texels are untiled).
  2. In `sprite.ts`: `import { depthAt } from '../paint/fabric'`; `weave.on[k] === 1` becomes `weave.on[k] !== 0` at
     both lines; line 194 becomes `tiled(col, weave!.labels[k], ...depthAt(weave!, k))`, as N4 wrote `light.ts`.
  3. The file PASSES; `pnpm --filter @automata/figures typecheck` reports none of the four; the five goldens pass.
     Commit `fix(figures): the sprite light reads the weave's depth table`, its body naming N4 and c8-lit.
- [x] **Step 4:** `pnpm --filter @automata/figures typecheck`; the whole suite (record the new test count); the
  kit's unit suite and Chromium suite at the baseline's counts with `git status` clean (the kit registers fabrics, so
  the weave's change reaches it: a moved kit cell is a stop and a question, not a re-record).
- [x] **Step 5:** `pnpm check`. The cherry-picks are the commits; add no squash.

**Done when:** six commits of the branch and step 3b's are in `git log -- extensions/figures`, and no golden of the
painter or the kit moved.

### Task 4d: A turned face keeps both eyes

`claude/turned-face-both-eyes` in the retired repository: two commits cut from its `025ffb4`, 66 commits behind its
`main` (`claude/project-thread-2ts3yn` is the same two). The fix, old id `cfc4333`, `fix(paint): a turned face keeps
both eyes`: on a head turned three quarters, an ear's rim painted in the skin's own tones no longer counts as
something worn over the far eye (8 lines of `paint/paint.ts`, and 36 of `tests/features/figure/eyes.test.ts`). Its
second commit re-recorded goldens as they stood on 2026-11-09; the goldens have been re-recorded since, so it does
not apply and is not brought: the re-record is made afresh here.

**Goldens it moves, measured:** the plan session (fix on `23f889c8`, goldens and painter tests only): 4 tests in 3
files. The plan audit (the whole suite, on the c5 picks with step 3b's fix, then the wardrobe merged, Node 24.21):
**5 tests in 4 files**: the **actors** golden (`base-m`: 10 frames, `base-f`: 8, all `wave`), the **base** golden at
density 1 (`base-m-hero-d1`: 9 bytes, the first at 6284), the **sprites** golden (`base-m-D1`), and
`tests/features/stage/sheets.test.ts` ("the stage keeps the base goldens": `base-m hero0 at D1`, 3 texels), which
reads the base golden's data and so moves with it. The lit and sprite goldens pass. Which of the **kit's** cells move was not measured: step 2 measures it.

- [x] **Step 1: The fix.** `git cherry-pick -x` the filtered commit of `cfc4333`. Expected: no conflict (measured
  on top of the c5 picks).
- [x] **Step 2: What moves, exactly.** The whole painter suite and the kit's unit and Chromium suites. Write in the
  log every failing golden test and, for each, the cells or frames that differ (for the md5 lists, the keys; for the
  base sheets, the sheet and the count of texels). Expected for the painter: the three goldens above and
  `stage/sheets.test.ts`, and nothing else. Any other failing test (a guard test, the identity pins, `ulp.test.ts`) is a
  stop.
- [x] **Step 3: The before-and-after sheet.** For every figure and view whose cell moved, the cell before (from a
  worktree at the commit before the fix) beside the cell after, at 8 times nearest neighbour, each pair labelled
  with its golden key, written with the package's render script to
  `docs/superpowers/audits/2026-11-12-builders-fold-survey/turned-face/` with a `README.md`: what changed in each
  pair, in words, and anything that changed that is not an eye. Keep the sheets under 1 MB in all.
- [x] **Step 4: Stop for the coordinator and the Owner** with the sheet. Nothing is re-recorded until the Owner
  accepts it. Accepted, 2026-11-12: "yes, give me both eyes".
- [x] **Step 5: The re-record, on the Owner's acceptance.** `pnpm --filter @automata/figures golden -- actors`,
  `-- base`, `-- sprites`, and the kit's recorder for exactly the kit goldens step 2 named
  (`pnpm --filter @automata/character-kit goldens:runway` and the others in its `package.json`). `git diff --stat`
  shows only the recorded files step 2 named, and `stage/sheets.test.ts` passes again with no file of its own changed.
  One commit:
  `fix(figures): a turned face keeps both eyes; re-record the actors, base and sprites goldens`, its body naming
  each golden, the count of cells or frames moved in each, the sheet's path and the Owner's words.
- [x] **Step 6:** The whole painter suite and the kit's suites pass; `pnpm check` (the commit hook's run of the painter's suite passed on the re-record; the whole `pnpm check` runs with task 6).

**Done when:** the fix is in, the re-record is one commit that names its reason and the Owner's acceptance, and every
suite passes; or the fix is reverted on the Owner's word.

### Task 5: The wardrobe branch arrives as its own commits

**Files:**
- Create (by merge): what `claude/c9-wardrobe` adds under `src`, `tests` and `scripts`
- Create: `docs/archive/figure-painter/c9-wardrobe/{2026-11-11-c9-wardrobe-design.md,2026-11-11-c9-wardrobe.md,2026-11-11-c9-wardrobe-plan-audit.md,README.md}`

- [x] **Step 1: Merge.**
  `git merge --no-ff painter-history/claude/c9-wardrobe -m "feat(figures): the wardrobe's first six tasks arrive (sheer cloth, the shod foot, the head's form, front hair, hair on the trunk, a fringe)"`.
  **One conflict is expected, in `extensions/figures/package.json`** (the branch adds a script to the file
  task 2 rewrote): keep task 2's file and add `"c9": "tsx scripts/c9-sheet.ts"`. Any other conflict is a stop.
  Expected: seven commits arrive (F0 to F6).
- [x] **Step 2: Nothing recorded moved.**
  `git diff --stat HEAD^1 HEAD -- extensions/figures/tests/golden` prints nothing.
- [x] **Step 3: Its suite.** `pnpm --filter @automata/figures test:unit`. Expected (measured by the plan audit with
  everything before it applied, Node 24.21): **52 files, 651 tests** (plus task 4c step 3b's), every test passing but
  one: `tests/features/body/face-d2.test.ts`, "headForm at the default sliders keeps its width, front and back",
  `front 0.95: expected 0.07329037500000002 to be 0.07329037500000003`. The two numbers are **1 ulp** apart. The branch
  recorded the pin on Node 22.23, where it passes; the framework's Node is 24.21, and the two V8 versions differ in that
  last bit. Measured on the wardrobe branch alone, under both Nodes: 29 files, 353 tests (the five goldens, the identity
  and wardrobe cell pins, `ulp.test.ts`, `stage/sheets.test.ts`, and the hair, outfit and paint tests) pass identically,
  and only this pin differs. Record the counts in the log; any other failure is a stop.
- [x] **Step 3b: The pin holds within 2 ulps (the coordinator's ruling of 2026-11-12).** Its own commit, after the
  merge, never a re-record:
  1. The proof first, in `tests/features/hair/ulp.test.ts` (the suite's last-bit guard): a case that draws the base
     pair's standing views at densities 1 and 2 with `headForm`'s `width`, `front` and `back` nudged by +1 and by -1
     ulp at every `t` (wrap the form the way `tests/support/ulp.ts` wraps the maths), and expects every cell's md5
     equal to the un-nudged draw. Run it: it must PASS on Node 24.21, which shows no painted cell depends on that bit.
     If it fails, a cell does depend on it: **stop**, tell the coordinator, and do not loosen the pin.
  2. The pin: each `toBe` in that test becomes an ulp distance of at most 2 (a small helper in the test: the two
     doubles' bit patterns as `BigInt64Array`, their difference), with a comment: the profile is a few float operations
     whose last bit differs between V8 versions (measured 1 ulp between Node 22.23 and 24.21); 2 allows one more
     rounding and nothing a cell could see, which step 1's case proves.
  3. The whole suite on Node 24.21 passes; then the five goldens and both test files once more under Node 22.23, with
     a Node 22.23 binary run directly (the cloud image's own `node` is 22.23.4; in the package:
     `node node_modules/vitest/vitest.mjs run <files>`), or say it could not run. Commit `test(figures): the head's profile pin holds within 2 ulps across
     Node versions`, its body quoting the ruling and naming the Node versions run.
  The authoritative Node for every gate is **24.21.0**: `package.json` `engines` (`>=24.21.0`, with `engineStrict`),
  `.nvmrc`, `pnpm-workspace.yaml`'s `useNodeVersion: 24.21.0` (so `pnpm` runs it even where the machine's own `node` is
  older: the cloud image's is 22.23.4), and CI's `actions/setup-node` with `node-version-file: .nvmrc`. A cell that ever
  differs by Node version is a stop, never a tolerance.
- [x] **Step 4: The kit.** Its unit and Chromium suites at the baseline's counts, `git status` clean. The branch
  promises that a field left out changes nothing; a moved kit cell means it did not hold, and is a stop.
- [x] **Step 5: Its documents, as a record.** Copy the wardrobe cycle's spec, plan and plan audit from `$FB` at
  `856498a` into `docs/archive/figure-painter/c9-wardrobe/`, with a `README.md` that gives the source repository and
  commit and says the Checkpoint A sheets (five PNGs, 5.1 MB) stayed there. Commit
  `docs(archive): the wardrobe cycle's spec, plan and plan audit, from the retired repository`.
- [x] **Step 6:** `pnpm check`.

**Done when:** the branch's seven code commits are in `git log -- extensions/figures`, no golden changed, and
both suites pass. (Measured in a scratch clone: the branch merges with no conflict on top of the c5 picks and the
turned-face fix, but for `package.json`.)

### Task 6: Conform: one mechanical commit for format, one for lint's automatic fixes

Two commits made by the tool alone, before any hand edit, so every later diff is readable (the coordinator's
ruling). Measured at `23f889c8`: the format rewrites 46 of 47 files in `src/`, 1 of 1 in `base/`, 61 of 61 in
`tests/` and 6 of 6 in `scripts/`; lint reports 137 findings in `src/` and `base/`.

- [x] **Step 1: Format.** Remove `"!extensions/figures"` from `biome.json`, and add a Biome `overrides` entry that
  turns the linter off for `extensions/figures/**`, with a comment that task 8 removes it.
  `pnpm exec biome format --write extensions/figures`. The painter's whole suite, the kit's unit suite, `pnpm check`.
  Commit, alone: `style(figures): the framework's formatting`.
- [x] **Step 2: Lint's automatic fixes.** `pnpm exec biome lint --write extensions/figures` (safe fixes only: never
  `--unsafe`). Read the diff: it may only remove unused imports, turn `let` into `const`, add `type` to imports and
  the like. A hunk that changes an expression's value or order is reverted by hand and left for task 8. The
  painter's whole suite, the kit's unit suite, `pnpm check`. Commit, alone:
  `style(figures): lint's automatic fixes`. Record in the log how many findings remain, by rule.
- [x] **Step 3:** The repository has no `.git-blame-ignore-revs`; do not create one. Write both commits' ids in the
  log, so a reader of `git blame` knows which to step over.

**Done when:** `pnpm exec biome format extensions/figures` reports nothing to change, both commits are tool output
only, and the suites pass.

### Task 7: Conform: the framework's layout, test imports, runner and boundaries; the suite split for the hook

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
  `"test:unit": "vitest run --project goldens ${AF_UNIT_FULL:+--project unit}"`,
  `"typecheck": "tsc -p tsconfig.types.json && tsc -p ."`.
- Produces: the environment variable `AF_UNIT_FULL` (`1` runs every unit project of a package that splits them).

- [x] **Step 1: The layer test first.** Move `tests/architecture.test.ts` to `tests/unit/layers.test.ts` and set

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
- [x] **Step 2: Move with `git mv`**, then fix the imports the move breaks: relative ones inside `src/`, and in
  tests every chain into `src/` or `base/` (51 files) becomes `#src/…` with the `.ts` extension, as the kit's tests
  write it. The goldens' data paths become `tests/fixtures/golden/`. Change nothing else in any file.
- [x] **Step 3: The runner and the compiler.** `defineTests` (`tooling/vitest-preset/src/index.ts`) makes one Node
  project, `unit`, over `tests/unit/**/*.test.ts`, and has no option for a second; the package splits it in its own
  `vitest.config.ts` (the preset is not changed for one package):

```ts
import { defineTests } from '@automata/vitest-preset'

// The goldens and the pins that guard them run on every commit that touches the painter (the hook runs `goldens` only);
// `unit`, each layer's own tests, runs with them in `pnpm check` and CI (AF_UNIT_FULL=1, the root unit-test scripts).
const GOLDENS = [
  'tests/unit/golden/**/*.test.ts',
  'tests/unit/actors/actors.test.ts',
  'tests/unit/paint/identity.test.ts',
  'tests/unit/hair/ulp.test.ts',
  'tests/unit/api.test.ts',
  'tests/unit/layers.test.ts',
]
const config = defineTests()
type Project = { test: { name: string; exclude?: string[] } }
const projects = (config.test?.projects ?? []) as Project[]
config.test = {
  ...config.test,
  projects: projects.flatMap((project) =>
    project.test.name === 'unit'
      ? [
          { ...project, test: { ...project.test, name: 'goldens', include: GOLDENS } },
          { ...project, test: { ...project.test, exclude: [...(project.test.exclude ?? []), ...GOLDENS] } },
        ]
      : [project],
  ),
}
export default config
```

  (Fit the types to what `defineTests` returns: no `as` beyond the one that names the projects' shape; if `knip` or the
  typecheck refuses it, a `nodeProjects` option on the preset with its own test is the alternative, and the coordinator
  is told.) In the root `package.json`, prefix `test:unit`, `test:unit:2d` and `test:unit:3d` with `AF_UNIT_FULL=1`; in
  `turbo.json` add `"@automata/figures#test:unit": { "env": ["AF_UNIT_FULL"], "passThroughEnv":
  ["PLAYWRIGHT_BROWSERS_PATH"] }` (this package only: an `env` on the generic task would split every package's cache
  between the hook and the gate). Check: `pnpm --filter @automata/figures test:unit` runs the `goldens`
  project only (time it; the plan audit measured the nine files at 74 tests, 33 s, before the move); `pnpm test:unit --filter @automata/figures` runs both, with the
  same test count as before the split. `tsconfig.json`
  extends `../../tsconfig.base.json` with `"isolatedDeclarations": false`, `"noUncheckedIndexedAccess": false`,
  `"exactOptionalPropertyTypes": false`, `"resolveJsonModule": true`, and a comment: the painter predates the two
  flags, their findings are counted in this plan's ledger, tasks 21 to 27 turn them on folder by folder, and the
  declarations step exists only until then. `tsconfig.types.json` takes the new `include` and stays the builder's settings.
- [x] **Step 4: The lists.** Add `extensions/figures` to the root scripts where the kit is listed:
  `boundaries --features`, `--forbid …:effect`, `style`'s `--test-imports` list (not yet its `--plan-comments` list,
  which also checks file length: task 9 adds that), `test:unit:3d`, `test:browser:3d`, and as `!./extensions/figures` in `test:unit:2d`, `test:browser:2d` and
  `test:browser:affected`, beside whatever those lists hold when the task runs (`claude/last-light-prologue` adds its
  game to the same lines). Replace the temporary `knip.jsonc` ignore with a workspace entry whose `entry` is the three
  files of `src/entries/` and the scripts.
- [x] **Step 5:** The layer test PASSES; the painter's suite at task 5's counts; `pnpm boundaries` and `pnpm style`
  at 0 findings; `pnpm knip`; the kit's unit and Chromium suites; `pnpm check`.
- [x] **Step 6:** Commit `refactor(figures): shared layers, one feature, three entries; tests in tests/unit`.

**Done when:** `pnpm boundaries` and `style`'s test-imports rule pass with the package in their lists, the layer test
passes over the new paths, no suite's count changed, and a commit that touches the painter runs only the `goldens`
project in the hook.

### Task 8: Conform: the lint rules that need a hand, one rule a commit

What task 6's automatic pass left. At `23f889c8` the rules that need a hand were 92 `noNonNullAssertion`, 13
`noAssignInExpressions`, 4 `noSelfCompare`, 2 `noExplicitAny`, 1 `useIterableCallbackReturn`, 1 `noEmptyInterface`
and whatever of the unused-variable findings Biome would not fix alone; the tests' and the three branches' are
counted here first.

- [x] **Step 1:** Remove the linter override of task 6. `pnpm exec biome lint extensions/figures
  --max-diagnostics=5000` and record the count by rule in the log.
- [x] **Step 2: For each rule, in this order**, fix every finding of that rule, run the painter's whole suite,
  commit `style(figures): <rule>`: `noUnusedVariables`, `noUnusedFunctionParameters`, `noEmptyInterface`,
  `noExplicitAny`, `useIterableCallbackReturn`, `noSelfCompare`, `noAssignInExpressions`, `noNonNullAssertion`, then
  any rule only the tests show.
  - `noSelfCompare`: `x !== x` on a number becomes `Number.isNaN(x)`; if the operand is not provably a number, keep
    the line with a `biome-ignore` that says it is a NaN test.
  - `noAssignInExpressions`: lift the assignment out only where the order of evaluation is plainly the same; in a
    loop of the rasteriser where it is not plain, keep the line with a `biome-ignore` that says why.
  - `noNonNullAssertion`: with the package's two flags still off, most `!` are unnecessary and are simply removed;
    `pnpm --filter @automata/figures typecheck` must stay green. One that the compiler still needs stays, with a
    `biome-ignore` that names the strict task (21 to 27) that will replace it with a check. No `!` is replaced by an
    `as` cast.
  - An unused variable that is "generic machinery no base figure reaches" is not deleted if a test under
    `tests/unit/` names it; check before removing.
- [x] **Step 3:** A moved texel after any rule: `git revert` that commit, record the finding, go on with the next
  rule, and tell the coordinator.
- [x] **Step 4:** `pnpm lint` (0 findings, no override left), `pnpm check`.

**Done when:** `biome.json` has no entry for the package and `pnpm lint` passes.

### Task 9: Conform: no file over 600 lines

Three files after task 5 (the fix branches add a few lines to `paint.ts`): `src/shared/paint/paint.ts` (about 1,607 lines), `src/shared/motion/motion.ts` (716),
`src/shared/hair/hair.ts` (about 692). Formatting in task 6 changes these counts; measure them first with `wc -l`.

- [x] **Step 1:** For each file, list its top-level declarations and which of them run code at module load (a
  registry filled, a table built). Write the list in the log.
- [x] **Step 2: Split by moving whole declarations, unedited, into sibling files of the same layer**, named for what
  they hold in kebab-case. Everything that runs at load stays in one module, in its present order, and the original
  file re-exports what moved, so no importer changes. The order in which parts are built is never changed: the part
  index seeds the painter's grain.
- [x] **Step 3:** After each file: the painter's suite, the layer test (the new files are in the same layer), commit
  `refactor(figures): <file> in parts of at most 600 lines`.
- [x] **Step 4:** Add `extensions/figures/src` to `style`'s `--plan-comments` list, beside the kit's (that
  run checks names, length and plan comments). `pnpm style`: 0 findings. `pnpm check`.

**Done when:** `pnpm style` reports no `file-length` finding for the package and the suites pass.

### Task 10: Conform: the eight libraries are checked by Zod

**Files:**
- Create: `<library>.schema.ts` beside each reader (`actions`, `hair`, `times`, `gaits`, `poses`, `seats`, `items`,
  `swatches`), and `tests/unit/libraries.test.ts`
- Modify: the eight readers; `package.json` (`zod` 4.6.6, the kit's version)

- [x] **Step 1: The failing test,** `tests/unit/libraries.test.ts`, one block per library:

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
- [x] **Step 2:** Write each schema with `z.strictObject` (an unknown key is an error, never dropped), fields in the
  order the file writes them, and `z.record` for maps keyed by name. Each reader replaces its cast with
  `schema.parse(json)`; the exported types stay the ones the readers export today (assert with
  `satisfies` that the schema's output is assignable to them; do not replace the types).
- [x] **Step 3:** The new test passes; the painter's suite; the kit's unit suite (it fills `SWATCHES` and
  `HAIR_STYLES` at load); `pnpm check`. Commit `feat(figures): the libraries are checked when they load`.

**Done when:** a misspelt key in any of the eight files fails at load and no golden moved.

### Task 11: Conform: the view check is a browser suite

**Files:**
- Create: `tests/browser/view-check.test.ts`, `tests/fixtures/view-cases.ts` (from `viewer/cases.ts`),
  `tests/fixtures/view-sheets.ts` (from `viewer/sheets.ts`)
- Modify: `vitest.config.ts` (a `browser` project and a `webgpu` project, as the kit's has), `package.json`
  (`"test:browser": "vitest run --project browser --project webgpu"`), the root `test:browser:3d` list (task 7 added
  the filter)
- Keep: `viewer/` and `scripts/view-check.ts` until the suite is proven equal, then delete `scripts/view-check.ts`

- [x] **Step 1: The test first.** One `it` per case of `CASES`, drawing the case's `StageFrame` with `StageView` in
  the page and comparing the readback with `compose(frame)`: every byte equal for a `bytes` case; for a `palette`
  case alpha 0 or 255 only and every opaque pixel a colour some sprite's cell holds. One block for the 8 standing
  views of each base figure, texel for texel. One for determinism (`scene4` drawn twice in a page and once in a fresh
  one). Run it before the browser project exists: FAIL (no such project).
- [x] **Step 2:** Add the projects; run
  `AF_WEBGPU=software pnpm --filter @automata/figures test:browser`. Expected: every case passes under WebGL
  and, where the software adapter is granted, under WebGPU.
- [x] **Step 3: Equal to the script.** Run `pnpm --filter @automata/figures view-check` once more and compare
  the list of cases it reports with the suite's: the same names, none missing. Then delete `scripts/view-check.ts`
  and its `package.json` script; `viewer/` stays as the hand viewer (`"viewer": "vite viewer"`).
- [x] **Step 4:** `pnpm check`; commit `test(figures): the GPU frame equals the painter's, as a browser suite`.

**Done when:** `pnpm test:browser:3d` runs the suite and it passes in Chromium.

### Task 12: Conform: the words

**Files:**
- Create: `extensions/figures/README.md`, `extensions/figures/docs/contract.md`, `extensions/figures/docs/actors.md`
  (inside the package: the root `docs/` outside its record folders is a published surface `pnpm source-names` reads)
- Move: `extensions/character-kit/src/shared/figure-builder/` to `src/shared/figures/`
- Modify: the kit's `README.md:52-53`, the 10 kit files that say "submodule", "upstream" or `vendor/FigureBuilder`,
  `extensions/character-kit/tests/unit/shared/{door,contract}.test.ts`, `docs/provenance/sources.md`, the painter's
  comments that name the old game's repository (`src/shared/stage/pose.ts`)

- [x] **Step 1: The readme,** from the builder's `CLAUDE.md` and `README.md` at `$PIN`, in the framework's voice:
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
const ours = names("extensions/figures/src/entries"), core = names("packages/3d/src/entries")
console.log([...ours].filter((n) => core.has(n)).sort().join("\n"))'
```

- [x] **Step 2: The contract,** the builder's `docs/contract.md` and `docs/actors.md` copied from `$PIN` into
  `extensions/figures/docs/` and corrected: the
  consumers are the character kit's door, in this repository; the entries' paths; the changelog gains "moved into the
  framework, `STAGE_VERSION` unchanged at 1". Run `pnpm style` on them (links and plan IDs) and fix what it finds.
- [x] **Step 3: The door folder** renamed with `git mv`; `#src/shared/figure-builder/` becomes
  `#src/shared/figures/` wherever the kit imports it; the door test's paths follow.
- [x] **Step 4: Comments.** In the kit, reword the comments that say the builder is a submodule, is fixed upstream or
  lives under `vendor/`. In the painter, `pose.ts` keeps the game's name and drops the old repository's, and the three
  comments that name a character of the builder's cut cast ("the Nurse": `src/shared/body/parts.ts`, about line 28;
  `src/shared/motion/motion.ts`, about 40; `src/shared/paint/paint.ts` or the part task 9 moved it to, about 1065) say
  what the rule does without the character, and so do the wardrobe branch's two files that name it
  (`scripts/c9-sheet.ts`, lines 48 and 63: "the Nurse's head and hair"; `tests/unit/hair/standoff.test.ts`, lines 21
  and 127: a tilted head, a drooping posture and a loose hair spring). `grep -rn "Nurse" extensions/figures | grep -v
  "not.toMatch"` prints nothing (the one left is `fringe.test.ts`'s guard that no style's text names a character).
- [x] **Step 5: Provenance.** In `docs/provenance/sources.md`, after "The figure builder as a submodule
  (2026-11-10)", a section "The figure painter, folded in (the date)": the source repository and `$PIN`, the wardrobe
  branch's `856498a`, the method (filtered history from the last content cut, the commit map, the manifest), what did
  not come and why, the Owner's decision of 2026-11-12 quoted, and the coordinator's ruling on history: the paths and
  commits listed under "History" (the first cast, the SNEKPRTY graphics, the dressed golden, the scene pipeline, the
  portraits) are left out of the framework's history and stay in the archived repository. `pnpm source-names` passes.
- [x] **Step 6:** `pnpm check`, the kit's suites; commit
  `docs(figures): the readme, the contract and the provenance of the fold`.

**Done when:** `grep -rIn -iE "submodule|vendor/FigureBuilder" extensions/character-kit extensions/figures`
prints nothing.

### Task 13: Group 1 closes

- [x] **Step 1:** `git fetch origin main && git merge origin/main`; `pnpm install --frozen-lockfile`.
- [x] **Step 2:** `pnpm build`; `pnpm api-report` and `pnpm api-index` (expected: nothing to update, no published
  package's exports changed; if either reports a change, run it with `--update` or `--write`, read the diff, and
  commit it with the reason).
- [x] **Step 3:** The whole `pnpm check`, timed; then the unit tests once uncached,
  `time pnpm exec turbo run test:unit --force -- --testTimeout=90000`. Compare with task 1's times and write both.
- [ ] **Step 4: Chromium, software GL:** `AF_WEBGPU=software pnpm --filter @automata/figures test:browser`,
  `AF_WEBGPU=software pnpm --filter @automata/character-kit test:browser`, `pnpm test:journeys:3d`, and the
  `test:browser` of any other workspace that depends on the kit (`pnpm why @automata/character-kit -r` names them).
  `git status` clean after them.
- [ ] **Step 5:** `git count-objects -vH` against task 1's. The fresh-clone check of task 4, step 6, again.
- [ ] **Step 6: The record.** This plan's tracking table and log; `docs/superpowers/progress.md`, workstream 6: what
  moved, what did not and why, the stops met. **What was not run, stated:** WebKit, Firefox, WebGPU on a real GPU,
  anything on arm64, the journeys of the reference game.
- [ ] **Step 7:** Push; open a draft pull request,
  `feat(figures): the figure painter lives in the framework`. Its body: the Owner's decision quoted, the Owner's words for the workflows (task 4b) and for the
  re-record (task 4d) quoted, the manifest result, the suites and counts, the list of what was not run, and a request to the Owner for one run on
  arm64, on the framework's Node 24.21 (Node 22 and 24 differ in a last bit, task 5):
  `pnpm install && AF_UNIT_FULL=1 pnpm --filter @automata/figures test:unit`.

**Done when:** the pull request is open with every gate's result in it.

## Group 1b: the painter under the two strict flags (`claude/builders-fold-strict`)

> **Added at task 8 (accepted by the coordinator):** 37 files carry a `// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task N …` line (N is the task of the file's folder: 21 `shared/math` and `shared/body`, 22 `shared/paint` but for `paint.ts`, 23 `paint.ts` and its parts, 24 `shared/lighting` and `shared/motion`, 25 `shared/hair` and `shared/outfit`, 26 `shared/figure` and `shared/base`, 27 `shared/actors`, `shared/stage`, `features/view`, `scripts/` and `viewer/`; the tests follow their folder). Each task removes that line from its folder's files and replaces each `!` with a check; task 27 ends with `grep -rn "biome-ignore-all lint/style/noNonNullAssertion" extensions/figures` printing nothing. The three test files that read a private member by bracket keep their `useLiteralKeys` line.

From `origin/main` after group 1 merged, and before workstream 4's wardrobe branch starts. One draft pull request at
the end of task 27. The ledger is under "What this plan settles", 3.

**How a folder is brought in.** A second compiler project, `extensions/figures/tsconfig.strict.json`, extends the
package's `tsconfig.json`, turns `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` **on**, and `include`s
only the folders done so far. The package's `typecheck` script runs it as well. A folder is done when it is in that
`include` and the project reports 0 errors.

**The rules for a fix**, in order of preference:

1. **Walk the values, not the indices**, where the loop reads every element once (`for (const v of xs)`,
   `xs.entries()`): the type has no `undefined` and nothing can be out of range.
2. **Where an index really can be out of range** (it comes from data, from a neighbour offset at an edge, from a
   look-up by name), **write the check**: handle the missing value the way the surrounding code means to, or throw
   an `Error` that names the array, the index and the length. This is the case the flags exist to find.
3. **Where an index is in range by construction** (a typed array read inside its own `w * h` loop), read it as
   `xs[i] ?? outside(xs, i)`, where `outside` (`src/shared/math/outside.ts`) throws a `RangeError` naming the index and
   the length and returns `never`, so the expression has the element's type and the proof is a check, not an
   assertion. It is written inline, never wrapped in a generic reader: measured by the plan audit in `rasterize`, a
   generic `at(xs, i)` made the loop 5.5 times slower (1,150 ms to 6,400 ms for 200 passes of 3,000 triangles), and
   the inline form cost nothing measurable (1,160 against 1,180 ms) and took the function's 55 strict errors to 0.
4. `exactOptionalPropertyTypes`: an optional property is left out, not set to `undefined`; where a caller passes
   `undefined` on purpose, the property's type says `| undefined`.

Never an `as` cast, never a non-null assertion, never `?? 0` or another default that would hide a value that was
missing (`?? outside(…)` is not a default: it throws). A fix must not change what a correct input draws: the goldens
are the proof.

**After each folder:** the painter's whole suite (`AF_UNIT_FULL=1`), the kit's unit suite, and the times of the
painter's suite and of the painter's bench against task 21's baseline:
`AF_BENCH=1 pnpm --filter @automata/figures exec vitest run --project bench`, three runs, the median. (The kit's
`tests/bench/lit.bench.test.ts` measures the light and subtracts the painter's own `cellOf` by design, so it cannot see
a slower painter; it is run once at task 27 as the kit's own number.) A golden that moves
has found a place where the old code read past an array: stop, name the index, tell the coordinator. More than 10%
slower: report the loop before going on. One commit a folder: `refactor(figures): <folder> under the strict flags`.

### Task 21: The ledger measured; `shared/math` and `shared/body`

- [ ] **Step 1: The ledger.** Temporarily set both flags on in `tsconfig.json`, run
  `pnpm --filter @automata/figures exec tsc -p . --noEmit`, count the errors by folder
  (`grep -oE "src/(shared|features|entries)/[a-z-]+" | sort | uniq -c`), write them in the ledger's last column, and
  revert the edit. Record the baseline time of the painter's suite (the painter's bench is written and timed in step
  3b, before any fix).
- [ ] **Step 2: The failing check.** Create `tsconfig.strict.json` with `"include": ["src/shared/math",
  "src/shared/body"]`, add `tsc -p tsconfig.strict.json` to the `typecheck` script, run it: expected FAIL, about 190
  errors.
- [ ] **Step 3: The checked read, test first.** `tests/unit/math/outside.test.ts`:

```ts
it('an index an array must hold reads as the element, and outside it says which index of which length', () => {
  const xs = Float32Array.of(1, 2)
  expect(xs[1] ?? outside(xs, 1)).toBe(2)
  expect(() => xs[2] ?? outside(xs, 2)).toThrow(new RangeError('index 2 is outside 0..1'))
  expect(() => outside([], 0)).toThrow(new RangeError('index 0 is outside an empty array'))
})
```

  Run it: FAIL, no such module. Then `export function outside(xs: ArrayLike<unknown>, i: number): never` in
  `src/shared/math/outside.ts`; PASS.
- [ ] **Step 3b: The painter's bench.** `tests/bench/raster.bench.test.ts` (the preset's `bench` project, run only with
  `AF_BENCH=1`, never in a gate): `rasterize` over a fixed synthetic soup (3,000 triangles from a seeded generator in
  a 192 × 192 buffer, 20 passes of warm-up, then 200 timed) and the base pair's standing sheets drawn cold, each
  printed in milliseconds. Add `"bench": "AF_BENCH=1 vitest run --project bench"` to the package's scripts, as
  `packages/3d` has it. Run it three times and record the medians: the baseline for every folder after.
- [ ] **Step 4:** Fix the two folders by the rules; the strict project reports 0 errors; the checks of "After each
  folder"; commit.

### Tasks 22 to 26: one folder group each

Each is task 21's steps 2 and 4 for its folders, with the ledger's count as the expected failure and the commit
naming the folders:

- [ ] **Task 22:** `src/shared/paint` but for `paint.ts` and the parts task 9 split from it (`raster.ts`,
  `fabric.ts`, `duel-ramps.ts`, `row.ts`). The rasteriser's inner loops are the first place a checked reader costs
  time: measure before going further.
- [ ] **Task 23:** `src/shared/paint/paint.ts` and its parts (511 at `23f889c8`, the largest). One commit a part.
- [ ] **Task 24:** `src/shared/lighting`, `src/shared/motion`.
- [ ] **Task 25:** `src/shared/hair`, `src/shared/outfit`.
- [ ] **Task 26:** `src/shared/figure`, `src/shared/base`.

### Task 27: `shared/actors`, `shared/stage`, the view; the flags on; the declarations step goes; the pull request

- [ ] **Step 1:** The last folders (`src/shared/actors`, `src/shared/stage`, `src/features/view`, `src/entries`), as
  above.
- [ ] **Step 2: The flags on for good.** Remove the two `false` lines and their comment from `tsconfig.json`; delete
  `tsconfig.strict.json`; `pnpm --filter @automata/figures typecheck`: 0 errors, tests and scripts included (fix
  what the tests show by the same rules).
- [ ] **Step 3: The declarations step goes.** Delete `tsconfig.types.json`, the `prepare` script, the `types`
  conditions in `exports` (each entry is `"./src/entries/<entry>.ts"`, as the kit's are), the `.gitignore` line for
  `extensions/figures/types/`, and the two `turbo.json` changes of task 3 (the generic `dependsOn` and the package's entry). `pnpm typecheck`: the kit and everything that
  imports it compile against the painter's source with the framework's base, 0 errors.
- [ ] **Step 4: No escape was used.** `git diff <the commit before task 21> HEAD -- extensions/figures/src | grep -E
  "^\+" | grep -cE " as [A-Z]|[a-z\])]!\.|[a-z\])]!\[|\?\? 0\b"` prints `0`, and
  `grep -rn "biome-ignore" extensions/figures/src` shows none that names a strict task.
- [ ] **Step 5: The close.** `git merge origin/main`; `pnpm build`; `pnpm api-report`; `pnpm api-index`; the whole
  `pnpm check`; Chromium, software GL: the painter's and the kit's `test:browser`, `pnpm test:journeys:3d`; the
  times against task 21's baseline. The ledger's table filled, every row 0. `progress.md`. **Not run, stated:**
  WebKit, Firefox, a real GPU, arm64. Push; draft pull request
  `refactor(figures): the painter compiles under the framework's strict flags`, with the ledger and the times in its
  body.

**Done when:** no compiler flag differs between the package and the framework's base, and no `types/` folder exists.

---

## Group 2: EnvironmentBuilder (`claude/builders-fold-scenes`)

From `origin/main` after group 1 merged. `$EB` is a scratch clone of
`https://github.com/mcthaydt/EnvironmentBuilder` at `f7c535694fd7a53a8f94129b9e13b9ab3503a095`, outside the working
tree. These tasks follow the default answer to the first question (option A). If the Owner chooses B, task 20 is
planned before this group starts.

### Task 15: The tiles golden, restated as a world-kit check

**Run by the plan audit, so this task commits a result already measured:** the world kit's `photoToTile` gives all
**112** of the builder's md5s (0 differ, 10 s), on the kit's own photo bytes (each equal to the builder's, with the same
size).

**Files:**
- Create: `extensions/world-kit/tests/fixtures/builder-tiles.json` (the builder's `tests/golden/tiles.json` at
  `f7c5356`, unchanged, 112 keys), `extensions/world-kit/tests/unit/textures/builder-tiles.test.ts`

**Interfaces:**
- Consumes: `photoToTile(png, knobs)` from `#src/features/textures/tile.ts`; the kit's `assets/photos/photos.json` and
  PNGs; the kit's `library/swatches.json`.

- [ ] **Step 1: The fixture.** `git -C $EB show f7c5356:tests/golden/tiles.json >
  extensions/world-kit/tests/fixtures/builder-tiles.json` (byte for byte; the kit's fixtures sit directly in
  `tests/fixtures/`, as `builder-maps.json` does).
- [ ] **Step 2: The test**, `tests/unit/textures/builder-tiles.test.ts`, in the shape the audit ran:
  - The keys, as the builder's `tests/golden/tiles.ts` makes them: for each photo of the kit's `photos.json`,
    `<photo>/tone` (`{ colour: 'tone' }`), `<photo>/photo` (`{ colour: 'photo' }`), and `<photo>/swatch` where a swatch
    names the photo: the `texture` of the first swatch in the kit's `library/swatches.json` that names it and sets
    `contrast`, else of the first that names it (the builder's `swatchTextureOf`; the kit's library holds all 167 of
    the builder's swatches with the same textures, and this rule gives the same spec for all 38 photos, measured). A
    comment says it is the builder's rule and why the swatch key exists (a flat photo's tone tile is one label).
  - For each key: `photoToTile(<the photo's PNG bytes>, { ...spec without photo, wear: 0.3, seed: 1, size: <the
    photo's size>, texels: [32, 32] })`, and the md5 of `` `${tile.width}x${tile.height}` `` followed by the bytes of
    `tile.labels` (`Buffer.from(labels.buffer, labels.byteOffset, labels.byteLength)`). The kit's labels are a
    `Uint16Array` where the builder's were an `Int16Array`; the bytes are the same because a label is never negative:
    the test asserts that too.
  - One assertion: the list of keys whose md5 differs from the fixture's is empty, and the key sets are equal.
  First run it against a fixture with one md5 changed by hand, to see it fail naming that key; then restore the file
  (`git diff --stat` shows none).
- [ ] **Step 3: Run it.**
  `pnpm --filter @automata/world-kit exec vitest run --project unit tests/unit/textures/builder-tiles.test.ts`.
  Expected: PASS, 112 keys. A key that differs is a stop: do not change the pipeline and do not re-record; write which
  keys differ and tell the coordinator (the port has drifted since the audit). Commit
  `test(world-kit): the photo pipeline reproduces the source's tiles, key for key`.
- [ ] **Step 4:** `pnpm check`.

**Done when:** the test passes with 112 keys and the fixture is the builder's file unchanged.

### Task 16: What the builder changed after the ports were read

The provenance rows were written at `6d82a52`. Ten files of `src/` and `base/` that the rows name changed between it
and `f7c5356`. **The plan audit read every hunk** against the framework; the table is in the survey
(`environment-builder.md`, "The hunks, read"): none moves a recorded frame of the world kit or the 3D package; one is to
port, one follows other work, the rest are already answered or serve the CPU renderer and its harness.

- [ ] **Step 1: Check the table still holds.** For each of the ten files, `git -C $EB diff 6d82a52 f7c5356 -- <file>`
  and the framework file the table names. If `main` has changed one of those framework files since the audit, re-read
  that row and correct it; otherwise go on.
- [ ] **Step 2: The one to port: the bedroom declares its reads.** The builder's `maps.json` gave the bedroom
  `"reads": {}` (held to the default rules, no waiver; `d17b13a`, cycle 7); the kit's
  `tests/fixtures/builder-maps.json` was taken at `6d82a52` and lacks it, and so does
  `library/maps/bedroom.af-sector.json` (the other four maps of the fixture equal `f7c5356`'s, measured).
  1. The failing test, in `tests/unit/maps/convert.test.ts`: `it('the bedroom declares its reads, as the source's last
     map file does', () => expect((convertBuilderMap(builderMap('bedroom')) as Json).reads).toEqual({}))`. Run
     `pnpm --filter @automata/world-kit exec vitest run --project unit tests/unit/maps/convert.test.ts`: FAIL.
  2. Add `"reads": {}` to the fixture's `bedroom` entry where `f7c5356` has it (after `"grade"`), and change the
     test file's first comment to say the fixture is `maps.json` at `6d82a52` with the bedroom's `reads` from `f7c5356`.
     The test PASSES.
  3. The level: `pnpm --filter @automata/world-kit exec node --import ../../packages/3d/scripts/extensionless-ts.ts
     scripts/convert-builder-maps.ts tests/fixtures/builder-maps.json --out /tmp/maps`, then compare
     `/tmp/maps/bedroom.af-sector.json` with `library/maps/bedroom.af-sector.json`: if `reads` is the only difference,
     copy it over; if the library file was edited by hand since, add only the `"reads": {}` key where the converter puts
     it. Never regenerate the whole folder. `pnpm --filter @automata/world-kit test:unit` passes.
  4. No frame can move (no renderer reads `reads`). Commit `fix(world-kit): the bedroom declares its reads, as the
     source's last map file does`.
- [ ] **Step 3: The one that follows.** `base/base.ts` dropped the interior's `hot` waiver once the builder's figures
  were exposed; the framework's `packages/3d/src/features/world/base/base-scenes.ts` keeps `reads: { hot: true }`, and
  nothing in the framework judges a level's reads yet. Do not change it: add to the following-work line "A level's
  `reads` as a gate" (task 18, step 3) that the base interior's waiver goes when that gate exists, if its figures then
  pass.
- [ ] **Step 4:** `pnpm check`; the world kit's Chromium suite
  (`AF_WEBGPU=software pnpm --filter @automata/world-kit test:browser`), `git status` clean after it.

**Done when:** the bedroom's `reads` is in the fixture and the level, and the survey's table has no row marked "to port"
left undone.

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
- [ ] **Step 3: The ledger and the following work.** In `progress.md`'s editor gaps ledger, one row: a swatch's
  texture knobs cannot be tuned against its `reads` in an editor; the judge exists (`checkReads`), the search does
  not. Under workstream 6, the lines of this plan's "Following work this fold leaves", as written there, so the
  Owner sees what retiring the repository gives up.
- [ ] **Step 4:** `pnpm check`; commit `docs(provenance): every file of the environment source at f7c5356, and where it went`.

**Done when:** `pnpm source-names` passes and no file of the builder at `f7c5356` lacks a row.

### Task 19: Group 2 closes

- [ ] **Step 1:** `git fetch origin main && git merge origin/main`; `pnpm install --frozen-lockfile`; `pnpm build`;
  `pnpm api-report`; `pnpm api-index` (update and commit with the reason if task 16 changed a published package's
  exports or doc comments).
- [ ] **Step 2:** The whole `pnpm check`. Chromium, software GL: the 3D package's, the world kit's and the character
  kit's `test:browser`, and `pnpm test:journeys:3d`. `git status` clean after them.
- [ ] **Step 3: The retirement notes.** Record in `progress.md` that both notes are merged and both repositories
  archived by the Owner on 2026-11-12: FigureBuilder `3caa9ad` (merged as `c29284c`), EnvironmentBuilder `6983342`
  (merged as `1eb60f9`). Nothing is pushed to either: they are read only.
- [ ] **Step 4: The record.** This plan's table and log; `progress.md`, workstream 6: what moved, what did not and
  why (the survey's summary table, with task 15's and 16's outcomes), and the spec's "Done means" line by line with
  its evidence. **Not run, stated:** WebKit, Firefox, WebGPU on a real GPU, the builder's own `test:gpu` and `check`.
- [ ] **Step 5:** Push; a draft pull request,
  `docs(world-kit): what the environment source still had, proven and recorded`.

**Done when:** the pull request is open and the notes' commits are recorded.

### Task 20 (conditional): the CPU scene renderer as a reference tool

**Not planned.** It exists only if the Owner chooses option B of the first question, and then it gets its own short
plan before group 2 starts, on the pattern of group 1: a filtered history of `src`, `base`, `tests` and `scripts`
(3.87 MB with the photos, which would be dropped in favour of the kit's identical copies) merged under a private
home that is not an extension a game can add (it draws nothing a game ships); its door `src/lib/figure.ts` rewritten
to import `@automata/figures/kit` and `@automata/figures` (the kit entry exports every name the door
takes from the internals); its suite run, with `base` and `scenes` failing as measured (22 frames); then **one**
commit that re-records those two goldens, quoting the Owner, with every moved frame shot before and after; the GPU
harness left out. Nothing of this is done under the default.

---

## The retirement notes

**Done.** The coordinator committed a note to each repository and the Owner merged both and archived both repositories
on 2026-11-12: FigureBuilder `3caa9ad` (merged as `c29284c`), EnvironmentBuilder `6983342` (merged as `1eb60f9`). Each
is at the top of the repository's `README.md`; the texts are those commits', not the drafts this plan first held. No
execution session can push to either ("The archived sources", under "What this plan settles", 7).

## Following work this fold leaves, one line each

Not part of this plan. The first five are what retiring EnvironmentBuilder gives up (the survey's first table);
task 18 writes them into `progress.md`.

- **Review sheets as a kept tool:** a command that shoots the base scenes and a game's levels as stills, at chosen
  times of day, from the framework's own renderer (today only the spike `spikes/builders-look/shoot.mjs` does).
- **A level's `reads` as a gate:** a `reads` field on a level (`minEdge`, the hot rule and its shown waiver) and an
  `automata check` step that runs the world kit's `readsAgainst` over a game's levels. When it exists, the base
  interior's `hot` waiver (`packages/3d/src/features/world/base/base-scenes.ts`) goes if its figures pass: the source
  dropped it once its figures were exposed (task 16, step 3).
- **Tuning a swatch against its reads in the editor:** the judge exists (`checkReads`); nothing searches the knobs.
  An editor gap.
- **How every room's figures read, in one report:** what `tune-light --maps all` printed; exposure is now per
  figure, so the report replaces the search.
- **A real GPU against SwiftShader:** a hand-run command over the framework's own frames, texel by texel, so
  "WebGPU on a real GPU: not run" can end. For workstream 5.
- **A held item and cutscene poses for painted figures**, glyphs, an editor for painted figures: under the addendum
  below.
- **The `@pixi/3d` beta.3 port of the painter's view:** on the upgrade branch (the list it inherits is under "What
  this plan settles", 4).

## Addendum for workstream 4's plan (its tasks 13 to 16, after the fold)

For the coordinator to move into `2026-11-11-builders-look.md`, replacing the text of its group 4. One branch,
`claude/builders-look-wardrobe`, from `main` after this plan's groups 1 and 1b (the strict flags); one pull request; no second repository and no
pin.

- **Task 13, the painter: drawn moods and the wardrobe golden.** In `extensions/figures`. The step-level text
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
  (`src/shared/figures/door.ts`) re-exports what the new kinds use (`rampOf`, `skull`, `onHead`, `headForm`
  and the types `Skull`, `HeadForm`, `ShoeForm`, `Foot`, as the wardrobe plan lists them), pinned by `door.test.ts`.
  The runway golden must not move; if it does, the painter changed a cell it promised not to: stop.
- **Task 15, the ward's clothes as kit entries; moods reach the painter.** As written, with one change: where it says
  a cell that moves under the last-bit nudge "is fixed in FigureBuilder", it is fixed in
  `extensions/figures`, in the same pull request, with the painter's own goldens run.
- **Task 16, the ward gate sheet; the pull request.** As written.
- **Task 17, step 2:** "FigureBuilder #29 is merged by task 13" becomes "FigureBuilder #29 stays open in the retired
  repository; its code is on `main` here". **Step 4** ("ask, do not do": fold or keep the submodule) is answered by
  the Owner's decision of 2026-11-12 and is removed.

**Following work, not part of this plan or that one** (what the reference game still needs from figures):

- **A held item** (the lamp in a figure's hand): the painter has items (`ITEMS`, `itemOf`) and the hand's anchors
  (hook H2); the kit's `PaintedState` has no field for one. A kit change with a painter test, now one pull request.
- **Cutscene poses:** the painter has `POSES`, `SEATS` and holds (`applyHold`); the cutscenes extension has no way
  to name one for a painted figure at a time on its timeline.
- **Glyphs** (a watch, a badge): the Owner's to ask for.
- **An editor for painted figures** (already row 2 of the editor gaps ledger), and tuning a swatch against its reads
  (task 18's row).
- **The `@pixi/3d` beta.3 port of `src/features/view/`**, on the upgrade branch.

## Log

| Date | Session | What |
|---|---|---|
| 2026-11-12 | Stage 2 (plan), `claude/builders-fold-plan`, revised the same day for the coordinator's rulings (the name `@automata/figures`; the strict flags conformed inside the workstream, tasks 21 to 27; one mechanical commit each for format and lint; the suite split for the hook) and the Owner's answers (the workflows' step removed in the first pull request, task 4b; the two fix branches brought, tasks 4c and 4d; the retirement notes committed by the coordinator). Also measured for the revision: the two fix branches cherry-picked in a scratch clone (five c5 commits clean and no golden moved; one conflict of one hunk; the turned-face fix moves three goldens, 4 tests), the suite's time by file, and the 1,395 strict errors by folder | The two surveys and this plan, against `main` `0df11a43`, FigureBuilder `23f889c8` and EnvironmentBuilder `f7c5356` (both cloned read only; nothing committed in them). Ran: both builders' own suites (FigureBuilder 47 files, 561 tests, at most 227 s; EnvironmentBuilder 55 files, 578 tests, 130 s), FigureBuilder's goldens under Node 24.21 (pass, 27 s), EnvironmentBuilder's suite against the framework's painter pin (27 failures in 4 files), the framework's format, lint, style and strict typecheck over the builders' source, the submodule script with no submodule (exit 0 both ways), byte and key comparisons of the photo library and the kits, and a dry run in a scratch clone of task 2's filter and manifest check (236 commits on `main`, 7 more for the wardrobe branch, 134 files, 0 differ, 1.64 MB). Not run: either builder's view or GPU check, any render, anything on arm64, the wardrobe branch's tests, the tiles cross-check. No product code written; no golden or hash touched |
| 2026-11-12 | Stage 3 (plan audit), `claude/builders-fold-plan-audit`, no subagents, no product code | Ran: the plan's filter on the archived FigureBuilder (`main` now `c29284c`; filtered `main` is still `23f889c8`'s 236 commits; 251 commits and 1.72 MiB with the four refs); the c5 picks, N4, the turned-face fix and the wardrobe merge in a scratch clone, then the whole suite on Node 24.21 (52 files, 651 tests, 6 fail: the turned face's 5, one wardrobe pin that passes on Node 22.23 only); `tsc` after N4 (4 errors in `lighting/sprite.ts`, which `main` added after the c5 branch); the strict flags over the whole package (`src` 1,427, `tests` 579, `scripts` and `viewer` 79); a checked reader in `rasterize` (generic `at`: 5.5 times slower; inline `?? outside`: no cost); the `goldens` project's files (74 tests, 33 s); the tiles cross-check (112 of 112 equal); every hunk of the ten files EnvironmentBuilder changed after `6d82a52`; the workflow lines at `0de72717` (73, unchanged). Fixed in the plan: tasks 2, 3, 4, 4b, 4c (step 3b), 4d, 5, 7, 12, 15, 16, 19, 21 to 27 (the inline check, the painter's bench, the ledger with tests), the archived sources, the retirement notes as merged, what the upgrade inherits. Findings: [plan audit](../audits/2026-11-12-builders-fold-plan-audit.md) |
| 2026-11-12 | Stage 4 (execution), group 1, `claude/builders-fold-figures`, Sonnet 5.5, no subagents. Task 1 | Submodule at `23f889c8`, declarations built by hand, Node 24.21 through pnpm. `pnpm check` exit 0 (11m56s cold). Kit unit 28 files, 228 tests. Kit browser in Chromium only (`--project 'browser (chromium)' --project webgpu`: WebKit and Firefox do not exist here, and the package's own script asks for all three): 58 tests pass, 3 files skipped (`gate-lit`, written by `scripts/gate.ts`). Pack 275.69 MiB. Manifest 134 files (47/1/73/6/4/3), commit `e074227fe` made with LEFTHOOK=0 right after the whole check passed on the tree before it (it adds one data file). Not run: WebKit, Firefox, arm64, a real GPU |
| 2026-11-12 | Task 2 (same session) | Filtered and merged as the plan says (111/7/6/2 commits, main `c85b961`, root `36a135e`, 126 commits and 1.03 MiB fetched empty, 0 and 0 on the content check, grafts `13407db8` and `6b6819cb` only). Manifest `134 files, 0 differ`. **Deviation:** the builder's suite at the pin on Node 24.21 was 560 of 561: `face-d2.test.ts` (the head's profile pin, 1 ulp) is in the builder's `main`, not only in the wardrobe branch, and passes on Node 22.23.4. Task 5 step 3b was done here, in its own commit before the package's (`b192bad57`): the ±1-ulp case (both base figures, densities 1 and 2, eight views, the head form and the ear a last bit up and down: every md5 equal; a control moving the form by 5% does move a cell), then the pin within 2 ulps (measured 1; 0 fails). Node 22.23.4 and 24.21.0 both pass both files. **Also:** the extension manifest rule needs `imports: {"#src/*": "./src/*"}` and `docs/versions.md` needs a row for `@napi-rs/canvas` (found by `pnpm check`), both added in the package commit. `@napi-rs/canvas` installed here (no refusal) and `view-check` ran: exit 0. Typecheck has no error in tests, scripts or viewer. The filtered clone is `/home/user/figurebuilder-filtered`, the remote `painter-history`. Not run: WebKit, Firefox, arm64 |
| 2026-11-12 | Task 3 | The door's three specifiers, the kit's dependency, the 13 `--forbid` entries and the closed-beta guard point at `@automata/figures`; one new case (the package has three exports and no wildcard). The "Pixi-free entries" case passed vacuously in the plan's form (no specifier matched), so it now asserts the exact specifier set and fails first. **Two things the plan did not name:** `src/features/fashion/garments.ts` augments `declare module 'figure-builder'` (now `'@automata/figures'`), and `turbo.json`'s `@automata/figures#typecheck` needs `"outputs": ["types/**"]`, else a turbo cache hit does not restore `types/` and a consumer type-checks the painter's source under the strict flags (seen: `examples-3d` and the kit failed with `TS2532` with `types/` removed and the cached typecheck). With the outputs, `rm -rf extensions/figures/types && pnpm typecheck` passes on a miss and on a hit. Not run: WebKit, Firefox, arm64 |
| 2026-11-12 | Task 4 | Submodule, gitlink, wrapper, `.gitmodules`, workspace entry, Biome and knip and `.gitignore` entries gone. The root's `@pixi/3d` and `pixi.js` are out and stay out (`pnpm check` exit 0 and the kit's Chromium suite pass without them). The submodule script exits 0 with and without a token. A fresh clone with the declarations built by `prepare` passes `pnpm check`. `scripts/record-runway-cells.ts` named `vendor/FigureBuilder` in code: it now points at `extensions/figures` (a hand-run recorder; its comments are for task 12). What still names the submodule: the kit's comments (task 12), `gate.ts`'s error text (task 12) and the workflows and their invariants (task 4b). Not run: WebKit, Firefox, arm64 |
| 2026-11-12 | Task 4b | Eight workflow files, the script and its test, rule 6 and 7 of the invariants and the runbook row. The new case ("name no submodule step and no submodule token") was watched failing for the right reason first. Every file parses as YAML; `pnpm lint:actions` could not run (Docker's daemon is not available here), so actionlint is **not run**. For the pull request's text: the Owner, 2026-11-12, "remove the submodule checkout and SUBMODULES_TOKEN from the workflows". The `SUBMODULES_TOKEN` secret is the Owner's to delete once no open branch predates this commit (a branch that has not merged `main` past it still runs the old step, which warns and empties the submodule, and its install fails) |
| 2026-11-12 | Task 4c | The five apply with no conflict (47 files, 577 tests, all five goldens, the identity pins and the kit pass). N4 had the one expected conflict (one hunk of `figure.ts`; kept the fix's `weave` line and main's `depth`), and the commit hook refused it (its `lighting/sprite.ts` reads the old Weave), so N4 was committed with `LEFTHOOK=0`, said here and in the ledger: the next commit fixes it. Step 3b: the new case (two fabrics of different depth, lit) failed with the TypeError of the old shape; with only the `=== 1` left unfixed it fails with an assertion on a depth-2 texel, so it sees the silent bug; then `sprite.ts` reads `on !== 0` and `depthAt` (commit through the hook). No golden of the painter or the kit moved. Not run: WebKit, Firefox, arm64 |
| 2026-11-12 | Task 4d, steps 1 to 3 | The fix cherry-picked with `-n` (`3cf1f2a`, no conflict); the painter's whole suite: 5 tests in 4 files fail and nothing else (the actors golden for base-m, 10 frames, and for base-f, 8; the base golden at density 1, `base-m-hero-d1`, 9 bytes, 3 texels; the sprites golden `base-m-D1` frame 0; `stage/sheets.test.ts` "base-m hero0 at D1", 3 texels); the kit's unit (229) and Chromium (58) suites do not move. The sheet (`turned-face/`, 4 PNGs, 256 KB with the readme) shows 20 cells: the far eye in each, plus two things that are not an eye, both explained in its readme (a colour-budget merge of two outline texels in base-m's script frame 10, and one texel of base-f's script frame 10 that the Owner should judge). The fix is not committed (the hook rightly refuses a commit that moves goldens); it is kept as a patch and in the filtered history. **Waiting for the coordinator and the Owner (step 4)** |
| 2026-11-12 | Task 5 | Done **without the turned-face fix**, as the coordinator said (the fix waits for the Owner). Merged `painter-history/claude/c9-wardrobe` with the one `package.json` conflict. Step 3b was made in task 2 (`b192bad57`), so here it is a verification: the suite passes whole on Node 24.21 and the goldens and pins on Node 22.23.4. The wardrobe's documents are in `docs/archive/figure-painter/c9-wardrobe/` with a readme. No kit cell moved. Not run: WebKit, Firefox, arm64 |
| 2026-11-12 | Stage 4, second session (Sonnet 5.5, no subagents). Task 4d, steps 4 to 6, provisional | `origin/main` had nothing new to merge. Starting state: `pnpm check` exit 0, uncached, on the branch as handed over. The patch applied cleanly; the fix's own test fails without the 8 lines (1 of 9) and passes with them. The fix is `18d0cec`: the builder's commit `cfc4333`, its message and its author (read from the archived repository with the read-only `get_commit`; no clone), committed with `LEFTHOOK=0` (red alone by design). Re-recorded with `pnpm exec tsx scripts/golden.ts actors`, `base`, `sprites`: `git diff --stat` shows only `tests/golden/actors.json` (18 md5s), `tests/golden/sprites.json` (1 md5) and `tests/golden/base/base-m-hero-d1.rgba.gz`. Painter, whole suite: 52 files, 654 tests, all pass (4m14s, Node 24.21); kit unit 229 and Chromium 58 (3 files skipped by design), no kit cell moved. The re-record is `0eb1a76`, committed through the hook, which passed (the painter's suite, 270 s). **PROVISIONAL until the Owner answers on the sheet. To undo: `git revert --no-edit 0eb1a76 18d0cec`** (newest first), then the painter's whole suite and the kit's suites; the two are never pushed apart. Not run: WebKit, Firefox, arm64 |
| 2026-11-12 | Task 6 | **Step over in `git blame`: `4efbf92` (format) and `598503d` (lint's automatic fixes).** Three rulings. (1) The framework's `biome check` also applies the import-sorting assist, which the plan did not name: 92 files fail `pnpm check` with it on, so the format commit's override turns the assist off with the linter, and the lint commit (which turns the assist back on) applies the sort. (2) The formatter re-indented the four recorded golden JSONs (the recorder writes one-space indent), so `extensions/figures/tests/golden/*.json` is excluded from Biome (task 7 updates the path when they move) and the four files were restored byte for byte. (3) Two of Biome's "safe" outputs were corrected by hand: the sort detached the comments that group `src/index.ts` and `src/kit.ts` (a `biome-ignore-all` with the reason keeps their order), and the fix for `noEmptyInterface` turned `export interface GarmentKinds {}` into a type alias, which hosts can no longer merge into (it stays an interface; task 8 takes the finding with a `biome-ignore`). The commit hook is bypassed on the second commit only, after `pnpm check` exit 0 on exactly that tree. Lint findings left in `extensions/figures` (285): noNonNullAssertion 187, useLiteralKeys 23, noUnusedVariables 15, noAssignInExpressions 13, noUnusedImports 10 (Biome marks its fix unsafe: task 8), useIterableCallbackReturn 9, noExplicitAny 5, noApproximativeNumericConstant 5, noSelfCompare 4, noExportsInTest 4, noFocusedTests 3, noUnusedFunctionParameters 3, useOptionalChain 3, noEmptyInterface 1 (the plan's list had 6 rules; the tests and the three branches add the rest). Painter 52 files, 654 tests and kit unit 229 pass after each; no golden moved. Not run: WebKit, Firefox, arm64 |
| 2026-11-12 | Task 7 | One commit, `538bb9e`. The layer test (`tests/unit/layers.test.ts`, written first) failed on the old paths for the right reason (2 of 6: every module belongs to a layer, no module imports a layer above its own). The move is a script that resolves every relative specifier against the old tree and writes it as the new place needs (a test's chain into `src/` becomes `#src/…` with its extension; `vi.mock` too); the goldens' data are 100% renames; `tests/fixtures/golden/*.json` replaces the Biome exclusion's path. **Deviations:** (1) `defineTests({ testTimeout: 30_000, browsers: [] })`: the preset has the timeout as an option, so the builder's own config's comment and value carry over, and `browsers: []` because the browser project arrives with task 11; (2) knip now sees the package and reports `memberOf`, a re-export in `shared/actors/actor.ts` nothing reads (not in the entries, the kit or any test): removed; (3) `typecheck` is `tsc -p tsconfig.types.json && tsc -p .` and the old `types/` was deleted so the new entry paths are what it builds; (4) the viewer's entry `viewer/main.ts` and `scripts/*.ts` are knip entries; (5) the root's test lists name the package in `test:unit:3d`, `test:browser:3d` and the three exclusions, `AF_UNIT_FULL=1` prefixes the three unit scripts, and `turbo.json` gives `@automata/figures#test:unit` its own `env`. Typecheck passes with the base's `verbatimModuleSyntax` and `isolatedModules` on, which the plan did not expect. The whole suite once showed 1 failure of 654 (first full run, name not captured) that did not come back in three more runs (the unit project alone, the combined run, and `pnpm check`): a timeout under load is the most likely cause (the goldens and unit projects run side by side), but it was not seen, so it is **not explained**; a test that fails once more gets its name written here. Not run: WebKit, Firefox, arm64 |
| 2026-11-12 | Handoff at 90 minutes (second stage-4 session) | Last pushed commit before this row: `021080b`; tasks 1 to 7 and 4d are done and ticked. **Resume at task 8, step 1** (remove the linter override in `biome.json`, count the findings by rule on the new paths; the count before task 7 was 285: noNonNullAssertion 187, useLiteralKeys 23, noUnusedVariables 15, noAssignInExpressions 13, noUnusedImports 10, useIterableCallbackReturn 9, noExplicitAny 5, noApproximativeNumericConstant 5, noSelfCompare 4, noExportsInTest 4, noFocusedTests 3, noUnusedFunctionParameters 3, useOptionalChain 3, noEmptyInterface 1), then tasks 9 to 13 and the close. Waiting on the coordinator: the Owner's answer on the turned-face sheet (the two provisional commits `18d0cec` and `0eb1a76`; to undo `git revert --no-edit 0eb1a76 18d0cec`). Notes for the next session: (1) `pnpm exec biome check --write` also sorts imports and re-flows exports; check `git diff` for comment lines moving (it detached the export comments of the entries, which carry a `biome-ignore-all`) and never accept its `noEmptyInterface` rewrite of `GarmentKinds`; (2) the commit hook now runs only the `goldens` project (about 66 s), so run the whole suite yourself (`AF_UNIT_FULL=1 pnpm --filter @automata/figures test:unit`, about 5 min) before each rule's commit that can change a value; (3) the one unexplained failure in 654 noted under task 7 has not come back |
| 2026-11-12 | Stage 4, third session (`session_01HNdX7MN6MGoEGe99LU9Pnx`), Sonnet 5.5, no subagents: setup and the unexplained failure | Branch reset to `origin` `93d1079` (the local branch was behind), `origin/main` merged (`progress.md` only), `pnpm install`, then the whole `pnpm check` (exit 0, 13m45s uncached, 66 tasks, painter 52 files, 654 tests). **The failure of task 7 is explained: a timeout, never a wrong value.** The package's own script (`AF_UNIT_FULL=1 pnpm --filter @automata/figures test:unit`) has the config's 30 s per-test limit; on this 4-core machine `front.test.ts` "a front clump is outside the dressed trunk" needs 22 s alone (10 dresses and 8,600 brute-force `reach` rays in one test) and `standoff.test.ts` "the Nurse's tilt…" 19 s (a `stray` pass of about 1 s for each of 15 walk frames), and 32 to 40 s with the suite's other workers running. The script failed in 3 of 3 full runs (two loop runs and one quiet run: each time exactly those two tests, `Test timed out in 30000ms`, 653 of 654 or 652 of 654 passed, no pixel or md5 differed). The root `pnpm test:unit` passes `--testTimeout=90000`, so `pnpm check` hides it. Fix, `b3366fc` (tests only): one test per slider, per head angle and per thirty frames of the walk, the same assertions on the same samples; the longest is now about 4 s; `shoe-form.test.ts` (16 s) split the same way. The suite is 705 tests; after it, four full runs with nothing else running (3m50s, 3m48s, 3m51s and 4m01s) and `pnpm check` passed with none failing. I stopped the five-run loop after two runs because the cause was known; the later runs are the evidence that it does not return |
| 2026-11-12 | Task 8 (same session) | Counts by rule on the new paths, override removed in a scratch copy: 285 (noNonNullAssertion 187, useLiteralKeys 23, noUnusedVariables 15, noAssignInExpressions 13, noUnusedImports 10, useIterableCallbackReturn 9, noExplicitAny 5, noApproximativeNumericConstant 5, noSelfCompare 4, noExportsInTest 4, noFocusedTests 3, noUnusedFunctionParameters 3, useOptionalChain 3, noEmptyInterface 1): the same as before task 7. One commit a rule, in the plan's order, then useLiteralKeys, noUnusedImports, useOptionalChain, noFocusedTests, noExportsInTest, noApproximativeNumericConstant; each through the hook (the goldens project, `biome check` on the staged files). **Rulings.** (1) The `biome.json` override is removed last (`1a20225`), not at step 1: the hook lints every staged file with the working `biome.json`, so with the override gone no rule commit could pass. (2) **The plan's premise on `!` is false:** with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` off, `strictNullChecks` is still on, and stripping all 187 gave 328 type errors in 37 of 39 files (optional fields, `Map.get`, `find`). Two files (`actions.ts`, `rig.ts`) lose theirs; the 37 others keep theirs under one `biome-ignore-all` that names the strict task (21 to 27) whose pass replaces them with checks. No cast. (3) `useLiteralKeys`: the 23 findings are tests reading a private member of `Figure` by bracket (`fig['built']`); dot access does not compile (seen), so three files carry a `biome-ignore-all` that says so. (4) `noApproximativeNumericConstant`: five `3.1416` knots stay (Math.PI is 7e-6 away and would move a recorded curve), each with a `biome-ignore`. (5) `noSelfCompare`: the four operands are Float32Array elements, so `Number.isNaN` is exact. (6) `noExplicitAny`: `GarmentKind` and `HairPiece` default to `unknown` (method syntax keeps them bivariant: the painter and the kit typecheck). (7) `noEmptyInterface`: `GarmentKinds` stays an interface with a `biome-ignore`. (8) `noFocusedTests`: three false positives, functions named `fit` (`paint.ts`, the viewer), renamed; no `.only`, `fdescribe` or `fit(` test exists in the package, so no test was hidden. (9) Every rule's edit was tested on the combined tree (the whole suite once, 705 tests, quiet) and committed rule by rule afterwards, so the rules' commits are one rule each but the suite ran on the tree of several; the value-risk ones (`noSelfCompare`, `noAssignInExpressions`) had their own whole run first. Not run: WebKit, Firefox, arm64 |
| 2026-11-12 | Task 9, first part (same session) | **Contradicted by the code, reported to the coordinator.** Six files were over 600 lines at `1a20225`, not three: `paint.ts` 2,887, `hair.ts` 1,311, `motion.ts` 1,187, `figure.ts` 1,071, `garments.ts` 831, `actor.ts` 666. Moving whole declarations works for hair (the biggest, `hairParts`, 566), motion (327), garments (152) and actor (`ScriptedActor` 465) and was done by a script (`/tmp`, not committed) that reads each file with the compiler, moves chosen top-level statements unedited, writes the imports, adds `export` where a declaration is used across files and leaves re-exports in the original; it reports load-time cross references and import cycles (none; the only cross references at load were type annotations). Commits: `eeb156e` motion (157, 219, 380, 419 lines), `bcc6748` hair (44, 250, 346, 162, 587), `875ba4d` garments (250, 126, 90, 417), `6d9e042` actor (504, 125, 52), `e3661f8` paint's helpers into five siblings (style 180, face 159, stamp 453, hands 251, budget 532). **Cannot be done that way:** `paint()` is one function of 1,306 lines (a file with it is over 600 whatever else it holds), and `class Figure` is 620 lines. `style` has no exemption. Left for the coordinator: split `paint()` into phase functions over its shared locals (verifiable bit for bit by the goldens), or keep both files over the limit with a ledgered exception. Nothing in `paint()` or `Figure` was touched |
| 2026-11-12 | The Owner's answer on task 4d, and the coordinator's rulings (third stage-4 session) | **4d is final.** The Owner, 2026-11-12, on the turned-face sheet: "yes, give me both eyes". The fix `18d0cec` and the re-record `0eb1a76` stay; the revert instructions are gone from the plan and `progress.md`. The coordinator accepted task 8's two deviations (the override removed last; the 37 files' `biome-ignore-all`) on condition that the strict tasks name them: **tasks 21 to 27 each remove, as part of their folder, the `// biome-ignore-all lint/style/noNonNullAssertion` line of every file in it** (its text names the task: 21 `shared/math` and `shared/body` and their tests; 22 `shared/paint` but for `paint.ts`; 23 `paint.ts` and its parts, `paint-*.ts`; 24 `shared/lighting` and `shared/motion`; 25 `shared/hair` and `shared/outfit`; 26 `shared/figure` and `shared/base`; 27 `shared/actors`, `shared/stage`, `features/view`, `scripts/` and `viewer/`), replace each `!` with a check, and `grep -rn "biome-ignore-all lint/style/noNonNullAssertion" extensions/figures` prints nothing when task 27 closes. **Ruling on task 9, option 1:** the 600-line rule is the framework's and applies to what arrives. `class Figure` (620 lines) is cut by moving a few methods out into sibling functions the class calls, behaviour and call order unchanged, one commit. `paint()` (1,306 lines) is split into phase functions LAST, as its own commits, under these conditions: the body's statements keep their exact order and arithmetic (no reordering of parts, loops or RNG and grain draws: the part index seeds the grain; no cleanup; no renamed locals beyond what the cut needs); shared locals go through one explicit context object or parameters, never module state; float operations stay the same operations in the same order; after each cut the goldens project, at the end the whole painter suite, the kit's unit and Chromium suites and `view-check`; a moved texel, md5 or hash is a stop and that cut is reverted, not adjusted; the commit says where the cuts are and why. If a session's time will not cover `paint()` safely, it does not start it, and a half-cut `paint()` is never pushed. The branch does not close until `pnpm style` passes with no exemption for these files |
| 2026-11-12 | Handoff at 90 minutes (third stage-4 session) | Pushed up to the commit named in the coordinator's message. Tasks 1 to 8 and 4d are done and ticked; **task 9 is in progress**: motion, hair, garments, actor, paint's helpers and figure's build part are split (`eeb156e`, `bcc6748`, `875ba4d`, `6d9e042`, `e3661f8`, `980dd3f`). **Resume at task 9:** (1) `class Figure` is 620 lines in `figure.ts` (679 with its imports, constants and re-exports; the file must be at most 600): its private methods are `raster` 89 lines, `faceAt` 62, `handsAt` 53, `update` 122 (public), `motion` 45, `fillDepth` 29, `swingHair` 25, `bends` 17; moving some of them out as functions the class calls needs the fields they read (`private` today) to be passed in or made package-internal, which the coordinator's ruling allows (behaviour and call order unchanged, one commit); (2) then `paint()` in `paint.ts` (1,306 lines, 1,395 with the file), split LAST under the coordinator's conditions (see the row above), only if a session has the time to do it whole; (3) `pnpm style` with `extensions/figures/src` in its `--plan-comments` list (step 4: the list is in the root `package.json`'s `style` script). Then tasks 10 to 13 and the close (the Zod libraries: `actions`, `hair`, `times`, `gaits`, `poses`, `seats`, `items`, `swatches`; the readers are `actors/actions.ts`, `hair/hair-registry.ts`, `lighting/lamps.ts`, `motion/presets.ts` (three), `outfit/items.ts`, `outfit/garments-registry.ts`). **Notes:** (a) the splitting script is not committed (it lived in the session's scratch directory); it was a compiler-API program that moves chosen top-level statements unedited, writes their imports, adds `export` where a declaration is used across files, leaves re-exports in the original and reports import cycles and load-time cross references; the plan's rule is the contract, rewrite it if needed; (b) the commit hook lints staged files with the working `biome.json` and runs the goldens project (about 45 to 70 s); (c) `AF_UNIT_FULL=1 pnpm --filter @automata/figures test:unit` passes now on this machine (705 tests, 3m59s); (d) a git worktree used for edits while background runs went (`/home/user/wt-lint`) is not part of the branch |
| 2026-11-12 | Stage 4, fourth session (`session_01HNdX7MuftfEACuVaoCW78r`), Sonnet 5.5, no subagents: setup, `class Figure`, and the phases of `paint()` (written before any cut) | `origin/main` had nothing new. **Finding:** `pnpm check` was NOT green at the last handoff: knip failed on 29 names (17 values, 12 types) that the task 9 splits re-exported from the original files and nothing reads (`hair.ts`, `motion.ts`, `garments.ts`, `paint.ts`, `figure.ts`). Removed in `667b1abf8` (the declarations stay in their own files; typecheck, Biome and knip pass). **`class Figure`:** `faceAt`, `handsAt` and `fillDepth` are functions in `figure-stamps.ts` (200 lines) of a `Posed` object the raster builds (`built`, `skeleton`, `member`, `world`, `cell`, `metres`, `feet`: the class's fields stay private), bodies unchanged but `this.` is `f.`, the eye constants and `eyeWidth` moved with `faceAt` (`figure.ts` re-exports `eyeWidth`); `figure.ts` 679 to 520 lines; the removed lines against the new file differ in the signatures and the three call lines only; whole painter suite 52 files, 705 tests pass (237 s), goldens pass; commit `05d9091a1`. **The phases of `paint()` (read whole, 1,306 lines of body in one scope; cut at statement boundaries only, in this order, each a commit; names say what they paint):** (1) `prepare` 104–158, the tone tables, fabrics, the skin family, the painter's own copy of the G-buffer and the hands; (2) `smoothSurfaces` 159–225, the throat under the jaw and the normals smoothed within each part; (3) `faceForm` 226–339, the face on its planes and its blocked-in light (`faceTh`, `faceLight`); (4) `keyLight` 340–441, the key light on each texel (limb swell, folds, grain) and the large surfaces' thresholds; (5) `quiltedBands` 442–561; (6) `toneTexels` 562–716, the gloss patches and the tone of each texel (crevice, cast shadow, shine, outline owner); (7) `polishTones` 717–790, the speck sweep, the hair's sheen band and the face's tidy; (8) `ruleLines` 791–860, closed gaps, stray flecks and reflected light; (9) `clusterTones` 861–943; (10) `detailFloor` 944–1012; (11) `outlines` 1013–1159, outside outline, selective outline and black's form; (12) `stainsAndHolo` 1160–1272; (13) `colourTexels` 1273–1360, tone to colour and normal; (14) `stampAndBudget` 1361–1393, the drawn face, the colour budget, the outside light and the tile. **Why there:** each is a statement run that begins with a comment naming a thing the painter does, ends where the next one's first statement reads its output, and the loops and blocks that share a scope with their neighbours (the `{ }` blocks, the `for` over the texels, the closures over `material`/`part`) are never split; the order of the 14 is the original order, and no `part`, `k` or grain draw changes position. **How:** one context object. `paint()` keeps its signature and defaults and builds `PaintInputs` (an interface, in the first phase's file); each phase is `function name(ctx)` that opens with `const { … } = ctx` for the names it reads and returns `{ … }` for the names it declares that a later statement reads; `paint()` chains `const cN = { ...cN-1, ...phase(cN-1) }` and each context's type is the intersection of the earlier returns (inferred, no cast). A script (TypeScript compiler API, in the session's scratch directory, not committed) cuts the first N statements of what is left: it moves their text unedited, finds the inputs and outputs with the checker (declaring statement against use), and stops when a name declared in one phase is assigned in another or a module-level declaration is read; the new text is formatted by Biome. Nothing is reordered, renamed or combined |
| 2026-11-12 | Task 9, done (fourth stage-4 session) | **`paint()` is cut, fourteen commits, none moved a texel, md5 or hash.** The cuts are the phases of the previous row, by statement index of the then-current body (the line numbers there are the file at the handoff; Cloth's block had moved out first, nine lines up): `prepare` (`439487ff0`), `smoothSurfaces` (`4ea70978d`), `faceForm` (`d0574d8ec`), `keyLight` (`6dceb4032`), `quiltedBands` (`39f7c81fa`), `toneTexels` (`2f6bb0058`), `polishTones` (`11b4d1c9a`), `ruleLines` (`d9130a47c`), `clusterTones` (`3055f9616`), `detailFloor` (`0fa4f7c6f`), `outlines` (`a63850343`), `stainsAndHolo` (`20064c9fe`), `colourTexels` (`56087f8a8`), `stampAndBudget` (`3854c1dd0`). Files: `paint.ts` 90 lines (the signature, `PaintInputs` and the chain `c0` to `c9`), `paint-prepare.ts` 125 (with `Cloth`, `NO_FABRICS`, `PaintInputs`), `paint-surface.ts` 477, `paint-tones.ts` 489, `paint-detail.ts` 370, `paint-colour.ts` 196. **The tool:** a script on the TypeScript compiler API (scratch directory, not committed) cut the first N statements of what was left of the body: it took each statement's full text (comments and blank lines included), found by the checker which top-level names the phase reads (declared before it) and which it declares that a later statement reads, refused to cut if a phase wrote a name declared in another or read a module-level declaration, and wrote `function name(ctx)` with a `const { … } = ctx` and a `return { … }`. After each cut, a line check: every line removed from `paint.ts` is, but for imports and the destructures of the context, in the new files unedited (no other line differed in any of the fourteen). Biome formatted the new text; unused imports were dropped by its fix. Three new files needed the `noNonNullAssertion` ignore of task 23, at the top, as `paint.ts` has it. **Runs:** the goldens project through the hook on each commit (about 42 s, all pass); the whole painter suite (52 files, 705 tests) after the cuts of phases 4, 8, 11 and 14 (224 to 237 s, all pass); the kit's unit (28 files, 229) and Chromium (7 passed, 3 skipped by design, 58 tests) and the painter's `view-check` (exit 0, every case identical) after the last. **Step 4:** `extensions/figures/src` is in `style`'s `--plan-comments` list (the kit's neighbour); `pnpm style` 0 findings over 4,647 files with no exemption. **Not measured:** the cost of the chain (fourteen object spreads of about 70 names per `paint()` call); the raster bench is task 21's. Not run: WebKit, Firefox, arm64
| 2026-11-12 | Task 10 (fourth stage-4 session) | **RED first:** the new test failed on `Cannot find module '#src/shared/actors/actions.schema.ts'`. Eight schemas, `z.strictObject` for every object whose keys the types fix, `z.record` for the maps by name, fields in the type's order, the three ordering-sensitive things left alone (record order, array order, tuples). **One ruling, and it moves the plan's test a little:** Zod rebuilds an object with its keys in the *schema's* order, and the libraries write each entry's fields in the order that reads best (the first run of the plan's `JSON.stringify` case failed for six of the eight: `lean` before `knees` in one seat, after it in another; `seg` before `pitch` in one item part), so a strict schema cannot also give back the file as written. The whole-file schemas are therefore `asWritten(schema)` (`shared/math/as-written.ts`, ten lines): it checks the raw value with the strict schema, throws its error (which names the key: `Unrecognized key: "colur"`) and returns the raw object itself, so what a reader keeps is the data as written, in its own order, with the type the schema gives it. The plan's two cases hold as written (`toEqual` and `JSON.stringify` equal; a stray key refused, naming it). **Also:** `actions.json` is `{about, modes, actions}` and is checked whole (modes reuse the gait schema, partial); hair pieces are checked by kind (`scalp`, `rows`, `tail`, `bun`, `fall`, `fringe`: strict; a kind a fork registers passes as it is, by `registerHairPiece`), with two extra cases in the test for that; `times`, `items` and `actions` do not use `satisfies` (a schema importing its reader's type is a cycle the layer test refused: seen, 3 cycles), the reader's typed constant is the check. `zod` 4.6.6 added to the painter's dependencies (the lockfile gains three lines). Painter suite 53 files, 723 tests pass; kit unit 229; `tsc`, Biome and knip pass; no golden moved. Not run: WebKit, Firefox, arm64 |
| 2026-11-12 | Handoff at 90 minutes (fourth stage-4 session) | Pushed: tasks 1 to 10 and 4d done and ticked; task 12 step 4's painter half done (`0f69cd379`: the seven comments and test titles that named the Nurse; `export const nurse` in `scripts/c9-sheet.ts` is an identifier, not a comment, and is left). **Resume at task 11** (the view check as a browser suite: `scripts/view-check.ts` starts a Vite server on `viewer/`, drives Chromium with the swiftshader/WebGPU flags and compares with `compose`; the plan's steps are written for moving that into `tests/browser/view-check.test.ts` with `tests/fixtures/view-{cases,sheets}.ts` and a `browser` and a `webgpu` project in `vitest.config.ts`, as the kit's config has them), then task 12's rest (the readme and the contract/actors documents need the builder's `CLAUDE.md`, `README.md`, `docs/contract.md` and `docs/actors.md` at `$PIN` `23f889c8`: not in this checkout; read them from the archived repository read only (`get_file_contents`; no clone) or from `docs/archive/` if copied there; the door folder `git mv` and the kit's comments that say submodule or `vendor/FigureBuilder` (`place.ts`, `pose.ts`, `README.md:52-53`, `record-runway-cells.ts`, `gate.ts`, `contract.test.ts`, `showcase-cells.test.ts`) should be done together with the new paths so the comments point at `extensions/figures/docs/contract.md`), task 13 and the close (`pnpm build`, `api-report --update`, `api-index --write`, `changeset status`, merge `origin/main`, the whole `pnpm check --force`, a fresh clone, the kit's Chromium and WebGPU suites, `view-check`, and five clean runs of `AF_UNIT_FULL=1 pnpm --filter @automata/figures test:unit`: four quiet runs passed earlier this branch (3m48s to 4m01s) and the five phase checkpoints of task 9 and task 10's runs passed, 224 to 237 s). **Notes for the next session:** (a) Node 24.21.0 comes through pnpm (`useNodeVersion`): `pnpm exec node -v` says 24.21.0 where `node -v` says 22.23.4; (b) the cutting script of task 9 is gone with the scratch directory and is not needed again; (c) a new file in `src/shared/paint/` that uses `!` needs the `noNonNullAssertion` ignore header of task 23 (the hook warns); (d) a schema file that imports its reader's type makes a cycle the layer test refuses (three seen); (e) the strict tasks' `asWritten` is in `shared/math`, and its schemas are the place to look if a library gains a key.
| 2026-11-12 | Fifth stage-4 session (`session_01HNdX7Jex3PxYfUkqCqghqJ`), Sonnet 5.5, no subagents: setup, and the measurement of `paint()` | The local branch ref was stale (`66240d4`, 144 commits on no remote); moved onto `origin` `ca2086fcc` with `checkout -B` (the old tip is in the reflog only). `origin/main` had nothing to merge. Node 24.22.1 (`/opt/node24`; the machine's `node` is 22.23.4), `pnpm install --frozen-lockfile`, the whole `pnpm check` exit 0 on `ca2086fcc`. **The cost of the 14 phase contexts, measured (the coordinator's ask):** the base pair's 8 standing views at D1 and at D2, 20 repetitions (320 `paint()` calls per density), one warm-up pass, the median ms per call, a timer wrapped around `paint()` in two scratch worktrees (`dbf701f26`, the commit before `439487ff0`, and `ca2086fcc`), run before / after / before / after on the same quiet machine: before the cut D1 3.13 and 2.90 ms, D2 8.68 and 9.28 ms; after the cut D1 2.13 and 2.09 ms, D2 7.39 and 7.45 ms. **The cut costs nothing; it is about 30% faster at D1 and 17% at D2** (the smaller functions JIT better; not investigated further). The worktrees and the wrapper were scratch and are gone |
| 2026-11-12 | Task 11 (fifth session) | RED: with the two test files written and no project, `vitest run --project browser` failed with "No projects were found". Then the projects (`browser` and `webgpu`, Chromium only: the old script only ever ran there, and WebKit and Firefox are not on every machine that runs this package), `test:browser`, `@vitest/browser-playwright` 5.0.3 as a dev dependency of the package (its config imports it, as the kit's does; the lockfile gains three lines). **Rulings.** (1) The plan names one file, `tests/browser/view-check.test.ts`; the preset's projects are one folder each, so the WebGL checks are `tests/browser/view/view-check.test.ts` and the WebGPU ones `tests/browser/webgpu/view-webgpu.test.ts`, sharing `tests/fixtures/view-claims.ts` (what each case claims) and `view-draw.ts` (the page-side drawing, the only file that imports Pixi: the layer test's walk now skips it). (2) `viewer/cases.ts` and `viewer/sheets.ts` moved with `git mv` to `tests/fixtures/view-{cases,sheets}.ts` (the two unit tests that read them follow), and the viewer's `?case=` and `?check=` modes, whose only reader was the script, are gone with it (the page is the suite's own now): the hand viewer keeps its gameplay and free modes, unchanged, `preserveDrawingBuffer` included. (3) The old script drew each case in a fresh page; the suite draws each in a fresh Pixi application that it destroys, in one page. Determinism reads `scene4` three ways (once, twice in one application, once more fresh). The script's other two powers go with it and are **not** kept: the `OUT_DIR` dump of CPU and GPU PNGs and the owner's `gate.png` (the kit has its own gate sheets), and `ONLY=` (the runner's `-t` does that). (4) WebGPU: an adapter that is granted and then draws no frame (this machine without `AF_WEBGPU=software`: 96 of the 105 byte cases read back transparent) is a skip in words, decided by a plain red square read back once (`webgpuState`), as the kit's suite decides it; with the software flag every case runs. The old script instead asked `requestAdapter()` and failed on anything else. **Step 3, equal to the script:** `pnpm view-check` before the deletion printed 231 lines (16 standing views, 105 cases under WebGL, 105 under WebGPU, `scene4: deterministic`; exit 0, 4m21s); the suite names the same 105 cases under each renderer, none missing or extra (compared by name from the JSON report). Test counts: 2 files, 227 tests (54 s) with `AF_WEBGPU=software`; the suite needs no network. `turbo run test:browser --filter=./extensions/figures` (what `pnpm test:browser:3d` runs for this package) passes with 105 skipped, because turbo does not pass `AF_WEBGPU` through (the root `turbo.json` is not touched). Comments that said `npm run view-check` (`stage.ts`, `stage-view.ts`, `cell-sprite.ts`) and the `docs/versions.md` row for `@napi-rs/canvas` now name the suite. Not run: WebKit, Firefox, a real GPU |
| 2026-11-12 | Task 12 (fifth session) | The builder's `CLAUDE.md`, `README.md`, `docs/contract.md` and `docs/actors.md` were read from `mcthaydt/FigureBuilder` at `$PIN` `23f889c8a5cda3511f4a2d044324c57ba624dc1c` (the repository attached read only with `add_repo`; `git fetch --depth 1 --filter=blob:none` of that one commit into a scratch directory; nothing pushed, nothing registered, and the scratch clone is outside the branch). **Rulings.** (1) The readme's tables of tests and goldens use the new paths, and every test file named exists (checked by listing `tests/unit`). The goldens table names the five and the one command that records each (`pnpm --filter @automata/figures golden <kind>`: `golden.ts` reads `argv[2]`). No fork section, as the plan says. (2) The name table lists the 64 names the three entries share with `@automata/3d`'s (the plan's command, run as written), in 12 rows grouped by subject, each saying which is which: one line a row, not one a name, because the 64 fall into twelve pairs of meanings; core's meaning of each was read from `packages/3d/src` (for example `Anchor` and `Body` are the mesh figure's, in `features/figures/`). (3) The contract is the builder's text with the paths turned into the new layout (`src/shared/<layer>/`), the consumer named (the kit's door, `door.ts`), the `package.json` version dropped (the package is private at 0.0.0, so `STAGE_VERSION` alone versions it), the old consumer's names and `npm run view-check` replaced (the browser suite), and one changelog entry for the move (`STAGE_VERSION` stays 1; the turned-face fix is the one change that moved recorded pixels; the c5 fixes moved none). The actors' guide changed only in its paths and commands. (4) `docs/provenance/sources.md` keeps the old submodule section with a one-line pointer to the new one (history, not deleted). (5) The kit's comments that said the painter is a submodule, fixed upstream or under `vendor/` say what is true now; two comments name archived-repository things that remain true (the showcase on `claude/runway-video`, `gate.ts`'s `BASE_COMMIT`, which predates the move), reworded without the words the task's grep forbids. `extensions/figures/src/entries/kit.ts` and `src/shared/stage/pose.ts` lost the old repository's names where they named a consumer that is not here. Knip after the `git mv`: 0 findings. Not run: WebKit, Firefox, arm64 |
| 2026-11-12 | Task 13, steps 1 to 3 and the browser half of step 4 (fifth session) | `origin/main` had nothing new (merge: already up to date). `pnpm build` exit 0 (16 tasks, 24 s). `pnpm api-report`: 6 core packages, 0 API breaks against the base, 0 undeclared; `pnpm api-index`: 1300 exports from 49 entry points, 0 undocumented: **nothing to update** (no published package's exports changed; `git status` clean after both). `pnpm exec changeset status --since=origin/main` (the plain `changeset status` needs a local `main`, which a session branch lacks; the repository's own script passes `--since=origin/main`): no package to bump. **The whole `pnpm check`, uncached (`TURBO_FORCE=true pnpm check`): exit 0, 13m22s** (task 1's baseline: 11m56s cold; this tree has the painter's whole suite in it, 53 files, 723 tests, and the browser suite is not part of `pnpm check`). Chromium with the software adapter on the final tree: the painter's `test:browser` 2 files, 227 tests pass (54 s); the kit's `browser (chromium)` and `webgpu` projects 7 files, 58 tests pass, 3 files skipped by design (the gate's sheets), 25 s. **Not yet run:** `pnpm test:journeys:3d`, the fresh-clone check, `git count-objects` against task 1's, the painter's five clean unit runs and the final record (see the handoff row) |
| 2026-11-12 | Task 13, step 5 and the handoff at 90 minutes (fifth session) | **The fresh clone passes:** a plain `git clone --branch claude/builders-fold-figures` of the pushed `eedc31cfa` (17 s), `ls .gitmodules vendor/figure-builder vendor/FigureBuilder` finds none of them, `pnpm install --frozen-lockfile` (no manual step), then `pnpm check` exit 0 (13m41s, uncached: a fresh clone has no cache). This is the spec's first "done" line. `git count-objects -vH`: the working repository 347.36 MiB packed, the fresh clone 349.23 MiB; task 1's "pack 275.69 MiB" was taken earlier, with another `main` and perhaps another set of refs, so the two numbers are not measured on the same thing and no growth is claimed from them (the painter's whole history is 1.03 MiB, measured in task 2). **Resume at:** (1) `pnpm test:journeys:3d` (step 4's remaining item; not run: it was not reached); (2) five clean runs of `AF_UNIT_FULL=1 pnpm --filter @automata/figures test:unit` (about 4 minutes each; four quiet runs passed earlier on this branch, 3m48s to 4m01s, and the whole check ran the same tests twice today); (3) the painter's `view-check` is now the browser suite, run today (227 pass, `AF_WEBGPU=software`); (4) then tick task 13 (its steps 1 to 5 and 6 are done but for the journeys and the five runs; step 7's pull request is not opened by the coordinator's word) and send the merge session's report. Scratch worktrees, the filtered clone and the fresh clone were removed |
