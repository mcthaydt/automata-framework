# 3D and every editor reach a stranger: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task by task, one
> session per branch, with no subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a stranger with npm and the public docs makes, checks, builds and plays a 3D game, opens every editor on it, and
can install every kit the templates, examples and editors use.

**Architecture:** `@automata/3d` and twelve kits become built packages through the one shared tsdown setup
(`tooling/release/src/tsdown-shared.ts`), join the fixed group and the API report, and are proved from packs outside the
workspace. The editor pages ship in their own package, `@automata/editors`, which `automata editor` resolves from the game.
`@pixi/3d` then moves from 0.1.0-beta.3 to 0.1.0 as a pixel-reviewed port.

**Tech stack:** TypeScript, tsdown (oxc declarations, isolatedDeclarations), `svelte-package` and `finishSvelteDist`
(no tsdown) for the two kits with Svelte files, Vitest, Playwright, pnpm, turbo, changesets.

**Spec:** [`../specs/2026-11-12-ship-3d-and-editors-design.md`](../specs/2026-11-12-ship-3d-and-editors-design.md).
**Survey (the measurements this plan argues from):**
[`../audits/2026-11-12-ship-3d-survey.md`](../audits/2026-11-12-ship-3d-survey.md).

## Tracking

| Task | Part | Branch | State | Evidence |
| --- | --- | --- | --- | --- |
| A1 The baseline and the recorded-files check | A | `claude/ship-3d-a` | not started | |
| A2 `@automata/3d` builds | A | `claude/ship-3d-a` | not started | |
| A3 `./testing` works from `dist` | A | `claude/ship-3d-a` | not started | |
| A4 Every export documented (275); the README | A | `claude/ship-3d-a` | not started | |
| A5 Public: the fixed group, the six guards, the shared lists | A | `claude/ship-3d-a` | not started | |
| A6 The 3D stranger's journey, ungated, with a size budget | A | `claude/ship-3d-a` | not started | |
| B1 `world-kit` | B | `claude/ship-3d-b-looks` | not started | |
| B2 `lcd-panel` and `retro-crisp` | B | `claude/ship-3d-b-looks` | not started | |
| B3 The painter's written types | B | `claude/ship-3d-b-figures` | not started | |
| B4 The painter builds; its licence record | B | `claude/ship-3d-b-figures` | not started | |
| B5 `character-kit` | B | `claude/ship-3d-b-figures` | not started | |
| B6 `places` and `sectors` | B | `claude/ship-3d-b-story` | not started | |
| B7 `nav` and `level-2d` | B | `claude/ship-3d-b-story` | not started | |
| B8 `systems` | B | `claude/ship-3d-b-story` | not started | |
| B9 `narrative` and `cutscenes` | B | `claude/ship-3d-b-story` | not started | |
| B10 The join: twelve kits public | B | `claude/ship-3d-b-join` | not started | |
| C1 `@automata/editors` is a package of its built page (after the v2 landing's tasks 2 to 4 and 6) | C | `claude/ship-3d-c-editors` | not started | |
| C2 `automata editor` opens it; the refusal goes | C | `claude/ship-3d-c-editors` | not started | |
| C3 `create-game` adds it; the README | C | `claude/ship-3d-c-editors` | not started | |
| C4 Two journeys from packs | C | `claude/ship-3d-c-editors` | not started | |
| D1 The before frames; the move to 0.1.0 | D | `claude/ship-3d-d-pixi` | not started | |
| D2 The port, area by area | D | `claude/ship-3d-d-pixi` | not started | |
| D3 The sheets and the list of what moved | D | `claude/ship-3d-d-pixi` | not started | |
| D4 The Owner's parity run; the close | D | `claude/ship-3d-d-pixi` | not started | |

Progress: 0 of 24 tasks (0%). Per part: A 0 of 6, B 0 of 10, C 0 of 4, D 0 of 4.

## Order, and what may run in parallel

```
claude/pixi-3d-public merged ─► A (one session, A1…A6) ─► B-looks ┐
                                                          B-figures├─► B10 join ─► C ┐
                                                          B-story  ┘               D ┘ (C and D in parallel)
claude/editor-journeys-green merged ─────────────────────────────────────────────► C
editors v2 landing: tasks 2-4 (v2 on main) and 6 (one page) merged ──────────────► C
```

- **A** runs alone. Nothing else starts until it has merged.
- **B-looks, B-figures and B-story run in parallel.** They own disjoint folders. In those three branches every kit keeps
  `"private": true` and **no shared file is touched** except each kit's own importer block in `pnpm-lock.yaml`.
- **B10** runs alone after all three have merged. It is the only B task that touches shared files.
- **C and D run in parallel** after B10. C owns `extensions/editors`, `packages/tools/src/features/editor`,
  `packages/tools/scripts`, `create-game` and `tooling/consumer-smoke`. D owns runtime source under
  `packages/3d/src`, the kits' `src` and every recorded picture. D does not touch `package.json` `exports`; C does not
  touch runtime source. **They share two files**, measured: `packages/tools/src/shared/create-game/template-3d.ts`
  (D1 changes `PIXI_3D_SPEC` at line 19; C3 adds `@automata/editors` to the package writer at lines 36-40) with its
  test, and `pnpm-lock.yaml` (C1, D1). Different hunks: whichever merges second merges `main` and re-runs
  `pnpm install`. D re-records pictures on `main`; C's recorded-files check compares with its own merge base, so D's
  pictures never stop C. **C also waits on the editors v2 landing's tasks 2 to 4 and 6** (Part C's first section):
  until they merge C cannot start, and D can.

**Shared files, and the one task that may change each:**

| File | A (task named) | B10 | C | D1 |
| --- | --- | --- | --- | --- |
| `.changeset/config.json` (fixed group) | A5 adds `@automata/3d` | adds the twelve kits | C1 adds `@automata/editors` | — |
| root `package.json` (`boundaries`, `style`, `recorded:check`) | A1 adds `recorded:check`; A5 the `--forbid` lists | the `--forbid` lists | — | — |
| `tooling/release/tests/unit/release-list.test.ts`, `closed-beta-guard.test.ts` | A5 | yes | C1 | — |
| `tooling/api-report/reports/3d.api.md` (the report covers `packages/*` only) | A4, A5 | — | — | D4 if a type moved |
| `tooling/examples-runner/src/catalog.ts` (`UNPUBLISHED_EXTENSIONS`) | A5 removes `@automata/3d` | empties it | — | — |
| `turbo.json` | A2, only if `build` needs an input | — (the painter's `typecheck` entry stays until `claude/builders-fold-strict` removes it with `types/`) | C1 (the page copy's `dependsOn`) | — |
| `pnpm-lock.yaml` | A2 | each B branch its own importers; B10 re-runs `pnpm install` | C1 | D1 (`@pixi/3d` and `pixi.js` entries only) |
| `docs/cheatsheet.md`, the agent API reference, the plugin manifest (generated by `pnpm api-index --write`) | A5 | B10 | C1 | — |
| `tooling/release/src/workspace-only.ts`, `tests/unit/published-imports.test.ts`, `private-build.test.ts` | A5 (creates; lists the twelve kits' entries up front) | reads | — | — |
| `tooling/consumer-smoke/src/budgets.ts` | A6 (creates; `-tools`, `3d`) | the twelve | C1 (`editors`) | — |
| `packages/tools/src/shared/create-game/template-3d.ts` and its test | A5 (gate, pins) | — | C3 | D1 (`PIXI_3D_SPEC`) |

## Global constraints

- The Owner, 2026-11-12: "We ship with 3D, Editors, and Desktop Apps too"; "publish the painter"; "port to 0.1.0"; "yes,
  move to the public pixi3d package and lift the deploy rule". The coordinator's ruling, open to the Owner's correction:
  the editors ship as their own package and `@automata/tools` stays under its 3 MB pack budget.
- **Building is not changing (spec rule 1).** Parts A to C move no golden, recorded picture, md5 or hash. Every A, B and
  C task, and every step that runs a suite, ends with the recorded-files check of task A1 (`pnpm recorded:check`), which
  prints `recorded: unchanged`. A changed line is a stop: the build is wrong, not the picture. The check compares this
  branch with its merge base on `main`, so a recorded file that `main` moves for its own reasons (Part D, another lane)
  never stops this lane. It also lists every pre-existing test file the branch changed: each must be named in the log
  with the reason, because a hash written inline in a test is not a recorded file (plan audit, finding 5).
- **No entry dropped or renamed** in the workspace `exports`. A kit's `exports` keys after its task equal its keys
  before. What publishes (`publishConfig.exports`) leaves out only the entries listed for it in
  `tooling/release/src/workspace-only.ts` (A5 makes the file from `release-list.test.ts`'s `WORKSPACE_ONLY`, as
  `@automata/puzzle` already does for its `./testing/*` entries): test helpers whose files are read by path, wildcard
  fixture folders, and Node tools that read the package's own source folders. `@automata/3d` keeps all 13 published
  (the spec says so; A3 makes `./testing` work from `dist`).
- **A published package never imports a private one.** Enforced by `tooling/release/tests/unit/published-imports.test.ts`
  (A5): it reads every publishable package's `src/**/*.{ts,svelte}` and fails on an import of any workspace package
  whose manifest is private, naming file and line; by the shared build (`onlyImport`, for the tsdown packages: a Svelte
  kit built by `svelte-package` has no such check, so the source test is the one that covers `narrative` and
  `cutscenes`); by `release-list.test.ts` (a publishable package's `@automata/*` dependencies are all publishable; A5
  adds the case); and by `--confine` for the painter.
- **Every published export has a doc comment**: `pnpm api-index` exits 0 with nothing added to
  `tooling/api-index/undocumented-baseline.json`.
- **Proof is from packs, outside the workspace**: the stranger's journeys and `tooling/release`'s `test:dist`.
- **Sizes are budgets, as tests.** `-tools` stays under 3 MB.
- **No publish, no deploy, no workflow file, no pull request merge.** Those are the Owner's.
- The laws of `AGENTS.md` hold: the sim imports no Effect; Zod only; PixiJS only for rendering; a source file has at
  most 600 lines; comments say why and name no plan.
- Versions: a package that becomes public takes the fixed group's current version (read it from
  `packages/automata/package.json`; 0.0.5 at this writing) and a `patch` changeset. Private packages get none.

### The scope rename

`@automata` is another account's npm scope; `tooling/codemods`' `rename-scope` will run alone, before or after this lane.
So that either order works, every task obeys these:

1. Write a package name only as a whole literal, `@automata/<name>`, in code, tests, JSON and Markdown. Never build one
   by joining strings (`` `@automata/${name}` ``, `'@automata/' + x`), and never match one with a pattern that spells
   the scope in pieces.
2. No file or folder name carries the scope. Pack file names (`automata-3d-0.0.5.tgz`) are read from `pnpm pack`'s
   output, never written by hand.
3. No hash, golden or snapshot may contain the scope (it would move on the rename). If a task finds one, it stops.
   (The games' generated `content.d.ts` files name `@automata/*` in their imports: they are generated types, not
   records, and the rename rewrites them with everything else.)
6. Never find a pack by its file name. A pattern such as `/automata-tools-.*\.tgz$/` (`run.ts:178` today) stops
   matching after the rename and the check it guards passes silently; read the name from the tarball's `package.json`.
4. If the rename has already merged when a session starts, read every `@automata/<name>` in this plan as the new scope
   and change nothing else.
5. A session never runs `rename-scope` itself.

### The gates, for every task

`pnpm format`, then `pnpm check` (exit 0). After a change to a published package's exports or doc comments:
`pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`, and commit what they write. Report what ran, what did
not, and what is pending. Browser suites that need a GPU are run where the session can and named as pending otherwise.

## Review focus

1. A game bundler drops `@automata/3d/no-eval` or the classic garments because `sideEffects` names only source files:
   the built game must still install no-eval (A2's test names the `dist` files).
2. A stranger's test imports `@automata/3d/testing` and the fixtures path leaves the package (A3).
3. A kit's `.toml` or JSON library is read at runtime by a path that exists only in `src/` (B6 to B9 check each).
4. A game without `@automata/editors` runs `automata editor` on a 3D game: it must be told what to install, in plain
   words, never a stack trace (C2).
5. A kit builds, but its peer range lets a stranger install a framework version it was never built against: every kit
   peers `workspace:^` on the fixed group, as `@automata/puzzle` does (the kit recipe, step 3).

---

## Part A: `@automata/3d` is a built, published package (`claude/ship-3d-a`)

Starts from a `main` that has `claude/pixi-3d-public` merged. That branch changed `packages/3d/package.json` (the
`@pixi/3d` pin and description), `three-d-gate.ts`, `template-3d.ts`, `commands.ts` (`pack3d`), `stranger-3d.test.ts`,
`closed-beta-guard.test.ts`, `release-list.test.ts` and `catalog.ts`. Tasks A2, A5 and A6 edit the same files: read its
diff first (`git log -p --follow` on each) and keep its wording where this plan does not change it.

When this plan was written that branch conflicted with `main` in three files: `docs/superpowers/progress.md`,
`extensions/figures/src/features/view/cell-sprite.ts` and `extensions/figures/tests/unit/view/template.test.ts`. A
session brings it up to `main` before it merges (the coordinator, 2026-11-12). Before A1, check all three on the
merged `main`: `git grep -n '<<<<<<<\|>>>>>>>' -- <the three files>` prints nothing, and
`pnpm --filter @automata/figures test:unit` passes. Two of the three conflicts are wording only, and both must be
resolved to what the code says, not by taking a side (checked at the plan audit by merging the two in a scratch copy):
`cell-sprite.ts`'s first line (`main` reworded the ignore comment to name no plan; the branch adds
`BaseMaterial3DOptions` to the import: keep both), and `template.test.ts`'s doc comment, where `main` says the
painter's template is the default "with four edits" and the branch says "three": count the edits
`cell-template.ts` makes against beta.3's template and write that number. Also re-check on the merged `main`, before
A1: `PIXI_3D_SPEC` is `'0.1.0-beta.3'`; `three-d-gate.ts` and `pack3d` still exist (A5 and A6 remove them); and
`git grep -n "vendor/pixi-3d"` prints nothing outside history.

### Task A1: The baseline and the recorded-files check

Git already addresses every file by its content, so the check needs no hash file of its own: a recorded file is
unchanged when `git diff` against the merge base and `git status` both print nothing for it. A frozen hash file would
stop C when D (which runs beside it) re-records on `main`, and the first draft's patterns missed 35 recorded files
(the three games' `content/generated` hashes and outputs, `examples/3d/wardrobe/goldens`), while two of its five
patterns (`__screenshots__`, `*.md5`) match nothing in the tree (plan audit, finding 5).

**Files:**
- Create: `tooling/release/src/recorded-files.ts`, `tooling/release/tests/unit/recorded-files.test.ts`
- Modify: `tooling/release/package.json` (script `recorded:check`), root `package.json` (script
  `recorded:check`: `pnpm --filter @automata/release recorded:check`)

**Interfaces:**
- Produces: `RECORDED_PATHSPECS: readonly string[]`, exactly: `:(glob)**/__goldens__/**`, `:(glob)**/golden/**`,
  `:(glob)**/goldens/**`, `:(glob)**/tests/fixtures/golden*/**`, `:(glob)**/content/generated/**`, `:(glob)**/*.hash`,
  `:(glob)**/*.replay`, `:(glob)**/*.md5`, `:(glob)**/__screenshots__/**`, and the exclusion `:(exclude,glob)**/*.ts`
  (the recorders and the tests that read goldens are code, not records); `recordedChanges(root: string, base: string):
  { changed: string[]; testsChanged: string[] }`, from `git diff --name-only <base> -- <pathspecs>` plus
  `git status --porcelain -- <pathspecs>`, and for `testsChanged` the pre-existing `*.test.ts` files that differ from
  `<base>` (`git diff --name-only --diff-filter=M <base> -- ':(glob)**/*.test.ts'`); and the command
  `node tooling/release/src/recorded-files.ts [--base <ref>]` (default base: `git merge-base HEAD origin/main`), which
  prints `recorded: unchanged` and exits 0, or the changed paths and exits 1. It always prints the `testsChanged` list
  (it does not fail on it: a new case in an old test file is normal; the log names each).
- Measured at the plan audit (`main` `d401ec4d`): the pathspecs match **108** tracked files; the first draft's matched 73.

- [ ] **Step 1: The failing test.** `recorded-files.test.ts`: in a temporary git repository (`git init`, one commit with
  `a/__goldens__/x.json`, `g/content/generated/content.hash` and `a/x.test.ts`), `recordedChanges(root, 'HEAD')` returns
  no changes; after editing the `.hash` file in the working tree it returns that path in `changed`; after editing the test
  file it returns it in `testsChanged` only; and a new file `b/goldens/y.json` committed on a branch shows in `changed`
  against the first commit. Run `pnpm --filter @automata/release exec vitest run tests/unit/recorded-files.test.ts`.
  Expected: FAIL, `Cannot find module '#src/recorded-files.ts'` (or the relative path the test uses).
- [ ] **Step 2:** Implement with `node:child_process` `execFileSync('git', …)`. Test passes. `pnpm knip` stays clean
  (the CLI is a script entry of the package, as `test:dist`'s files are).
- [ ] **Step 3:** Count what it covers, for the log: `git ls-files -- <the pathspecs> | wc -l` (108 at the audit; a
  different count is written down, not argued with). Run the unit suites that read or write recorded files
  (`pnpm --filter @automata/3d --filter @automata/figures --filter @automata/character-kit --filter @automata/world-kit
  --filter @automata/sim --filter @automata/content test:unit`), then `pnpm recorded:check`: `recorded: unchanged`.
- [ ] **Step 4:** Gates; commit `test(release): a check that no recorded picture, golden or hash moved on a branch`.

**Done when:** `pnpm recorded:check` prints `recorded: unchanged` on a clean tree and exits 1 when one recorded file
changes (try it on a scratch edit of `games/base-3d/content/generated/content.hash`, then `git checkout` the file).

### Task A2: `@automata/3d` builds

**Files:**
- Create: `packages/3d/tsdown.config.ts`, `packages/3d/tests/unit/package/manifest.test.ts`
- Modify: `packages/3d/package.json`, `pnpm-lock.yaml`, `.gitignore` only if `packages/3d/dist` is not already ignored

**Interfaces:**
- Produces: `packages/3d/dist/<name>.js` and `.d.ts` for the 13 entries, `<name>` being the export key without `./`
  and `index` for `.`: `index`, `camera-view`, `figures`, `figures-kit`, `level`, `props-kit`, `no-eval`,
  `world-content`, `base`, `sim`, `testing`, `testing-checks`, `timeline`.

- [ ] **Step 1: The failing test.** `manifest.test.ts` reads `package.json` and `tsdown.config.ts` and asserts: the
  `exports` keys are exactly the 13 above; `publishConfig.exports[key]` is
  `{ types: './dist/<name>.d.ts', import: './dist/<name>.js' }` for each; `files` is `['dist']`; `scripts.build` is
  `'tsdown'`; `peerDependencies.vitest` is `'^5.0.3'` and `peerDependenciesMeta.vitest.optional` is `true`;
  `sideEffects` contains `./dist/no-eval.js` and each source path it names today; and `publishConfig.registry` is
  **undefined** while the package is private (`tooling/release/tests/unit/private-build.test.ts:38` fails a private
  package that names a registry: "must not name a registry"; A5 adds `registry` and `access` when `private` goes). Run
  `pnpm --filter @automata/3d exec vitest run --project unit tests/unit/package/manifest.test.ts`. Expected: FAIL,
  `publishConfig` is undefined.
- [ ] **Step 2:** Write `tsdown.config.ts` as `extensions/puzzle/tsdown.config.ts` does, with the 13 entries and
  `platform: 'browser'`. Edit `package.json` to satisfy the test: `publishConfig` holds `exports` only (no `registry`,
  no `access`: see step 1). Keep `"private": true` and version `0.0.0` (A5 flips them). While it is private and has
  `publishConfig.exports`, `private-build.test.ts` checks it in `pnpm check` (its export keys equal the workspace's,
  every target under `./dist/`), and `pnpm --filter @automata/release test:dist` checks the built files load.
- [ ] **Step 3:** `pnpm install` (the lockfile changes in `packages/3d`'s importer only), then
  `pnpm --filter @automata/3d build`. Expected: `Build complete`, no `is located in node_modules` error. The survey's
  trial took 0.9 s.
- [ ] **Step 4: The side-effect files.** The no-eval install and the classic garment registration land in hashed chunks
  (`classic-kinds-*.js`, `pixi3d-uniform-sync-*.js` in the trial). Give each its own tsdown entry
  (`'side-effects/classic-kinds'`, `'side-effects/install-no-eval'`) so the names are stable, list both in `sideEffects`,
  and extend the test to assert that every `sideEffects` path under `./dist/` exists after a build (skip that case when
  `dist/` is absent). **This step is load-bearing**, measured at the plan audit: with `sideEffects` naming only source
  files, the packed game built by the stranger's journey fails at boot with
  `Boot defect: Error: @automata/3d: import '@automata/3d/no-eval' first, before anything else` and `data-state="failed"`;
  with the `dist` files listed it reaches `ready` and Wick walks. A6's journey is the test that proves it end to end.
- [ ] **Step 5:** `pnpm recorded:check` (`recorded: unchanged`), gates, commit `build(3d): @automata/3d builds to dist with the
  shared tsdown setup`.

**Done when:** `pnpm build` builds `@automata/3d`, and its 13 `.js` and `.d.ts` files exist.

### Task A3: `./testing` works from `dist`

**Files:**
- Create: `packages/3d/src/testing/fixture-root.ts`, `packages/3d/tests/unit/testing/fixture-root.test.ts`
- Modify: `packages/3d/src/testing/compile-fixture.ts:15`, `packages/3d/src/testing/motion-goldens.ts:46`,
  `packages/3d/tsdown.config.ts` (`copy`), `tooling/release/package.json` (`test:dist` names the new test file)
- Create: `tooling/release/tests/unit/three-d-testing-dist.test.ts` (not a case in `private-build.test.ts`: that file
  checks private packages only, and A5 makes `@automata/3d` public, so a case there would stop running)

Why it matters more than a wrong path: `motion-goldens.ts:46` reads `motion.json` **when the module loads**, and
`testing/public.ts` re-exports it, so importing `@automata/3d/testing` from a pack throws `ENOENT` at import, before
any test of the stranger's runs. The fixtures to copy are `tests/fixtures/content` (476 kB) and
`tests/fixtures/goldens` (572 kB) on disk; the pack grows, so A6's budget is set from the pack measured after this
task, not from the survey's 307,703 bytes.

**Interfaces:**
- Produces: `fixtureRoot(here: string): string`: given `import.meta.dirname`, returns `<package>/tests/fixtures` from
  `src/testing` and `<package>/dist/fixtures` from `dist`.

- [ ] **Step 1: The failing test.** `fixtureRoot('/p/src/testing')` is `/p/tests/fixtures`;
  `fixtureRoot('/p/dist')` is `/p/dist/fixtures`. FAIL: no module.
- [ ] **Step 2:** Implement; use it in the two files; copy `tests/fixtures` (only the folders those two files read) to
  `dist/fixtures` with `publishedBuild`'s `copy`.
- [ ] **Step 3: From the pack.** `three-d-testing-dist.test.ts`, skipped unless `AF_CHECK_DIST=1` (as
  `private-build.test.ts`'s built cases are): `pnpm pack` `packages/3d` into a temporary folder, unpack it, import its
  `dist/testing.js` in Node and read `FIXTURE_ROOT`: it is inside the unpacked folder and exists on disk; and
  `compileFixture()` returns `ok: true`. Add the file to `test:dist`'s list in `tooling/release/package.json`. Run
  `pnpm build && pnpm --filter @automata/release test:dist`. Expected before step 2: FAIL with `ENOENT … motion.json`;
  after: PASS. Record the new pack size in the log (A6 sets its budget from it).
- [ ] **Step 4:** `pnpm recorded:check`, gates, commit `fix(3d): the testing entry finds its fixtures from a built package`.

**Done when:** the pack's `./testing` loads its fixtures outside the workspace.

### Task A4: Every export documented; the README

There is no API-index list to add to: `tooling/api-index/src/entry-points.ts` takes every package
`publishablePackages` returns (every manifest whose `private` is not `true`), so `@automata/3d` joins the index when A5
removes `private`. The API report already covers it: `tooling/api-report/src/core-packages.ts` reports every
`packages/*` folder, private or not, and `tooling/api-report/reports/3d.api.md` is committed today. So this task
writes the doc comments while the package is private, measured as below, and A5 writes the index (plan audit,
finding 7).

**Measured at the plan audit** (the trial build's `dist/*.d.ts` read by the index's own `indexRows` and `checkDocs`):
**805 exports, 275 undocumented** across the 13 entries. This is the largest writing task in Part A; it is a session's
work on its own, and the README is the last step.

**Files:**
- Modify: doc comments under `packages/3d/src` (only comments: no export changes shape), `packages/3d/README.md`,
  `tooling/api-report/reports/3d.api.md` (regenerated: the report carries doc comments)

- [ ] **Step 1: Measure (the failing check).** `pnpm --filter @automata/3d build`; then, in the working tree only,
  set `"private": false` in `packages/3d/package.json` and run `pnpm api-index`. Expected: exit 1, `@automata/3d`'s
  undocumented exports listed (275 at the audit). Save the list to the session's scratch folder; `git checkout
  packages/3d/package.json docs/cheatsheet.md agents/automata/skills/automata-api/reference/api.md
  agents/automata/.claude-plugin/plugin.json` (the run writes those files: none of it is committed here).
- [ ] **Step 2:** Write a doc comment on each, saying what it is for and its units where it has any, one feature folder
  per commit (`docs(3d): doc comments on <feature>`). Do not add to `undocumented-baseline.json`. Re-run step 1's
  measurement: 0 for `@automata/3d`, then restore the files again.
- [ ] **Step 3:** `pnpm build`, `pnpm api-report --update` (the 3D report takes the new comments), commit it.
- [ ] **Step 4: The README**, for a stranger: what the package is, `create-game --template 3d`, the 13 entries in a
  table with one line each, the peers (`pixi.js`, `@pixi/3d`), "import `@automata/3d/no-eval` first", a link to
  `docs/guides/3d.md`. `tooling/consumer-smoke/src/readme.ts` finds the commands a README tells a reader to run and
  whether they resolve (`readmeCommands`, `unresolvedCommands`); run each command the README names in a scratch 3D game
  and say in the log that it ran.
- [ ] **Step 5:** `pnpm recorded:check`, gates, commit `docs(3d): every export documented; the API report and index take
  @automata/3d`.

**Done when:** step 1's measurement prints 0 undocumented for `@automata/3d`, `pnpm api-report` exits 0, and every
command in the README ran. (`pnpm api-index` with `@automata/3d` in it is A5's, after `private` goes.)

### Task A5: Public: the fixed group and the six guards

Each guard is changed test first. A guard goes only where its reason is gone.

**Files:**
- Modify: `packages/3d/package.json`, `.changeset/config.json`, root `package.json` (`boundaries`),
  `tooling/release/tests/unit/release-list.test.ts`, `closed-beta-guard.test.ts`,
  `tooling/examples-runner/src/catalog.ts` and its test, `packages/tools/src/shared/create-game/three-d-gate.ts` and
  its test, `create-game`'s help text and its test, `packages/tools/scripts/copy-editor.ts` (comment only),
  `docs/guides/3d.md`, `tooling/release/tests/unit/private-build.test.ts` (reads the shared workspace-only list),
  `.changeset/create-game-3d-template.md` (unreleased; its sentence about `AF_BETA_3D` becomes false here), the
  generated `docs/cheatsheet.md`, `agents/automata/skills/automata-api/reference/api.md` and
  `agents/automata/.claude-plugin/plugin.json`
- Create: `.changeset/ship-3d-package.md` (`@automata/3d` and `@automata/tools`, `patch`),
  `tooling/release/src/workspace-only.ts`, `tooling/release/tests/unit/published-imports.test.ts`

| Guard | Its reason today | After |
| --- | --- | --- |
| `release-list.test.ts`: `@automata/3d` is not publishable | not built | **inverted**: it is publishable; new case: every `@automata/*` dependency of a publishable package is publishable |
| `closed-beta-guard.test.ts` and `--forbid <published>:@pixi/3d,@automata/figures` | keeps 3D out of 2D packages | **kept for the 2D packages** (a design rule: 2D core stays free of 3D); `@automata/3d` is exempt from the `@pixi/3d` half and keeps the `@automata/figures` half. The test today demands both halves of every publishable package, so it changes shape: a package is **3D** when its manifest names `@pixi/3d` or `@automata/3d` in `dependencies` or `peerDependencies`; every publishable package must forbid `@automata/figures` except `@automata/character-kit` (B10), and every publishable package that is not 3D must forbid `@pixi/3d`. The test's comment says "2D packages carry no 3D", not "closed beta" |
| `--forbid packages/editor:@pixi/3d,@automata/editor-3d,@automata/3d` | the 2D page in `-tools` must stay 2D | **kept** |
| `copy-editor.ts` refuses a build with Pixi 3D | the same | **kept**; its comment loses "not published yet" |
| the `AF_BETA_3D` gate | `@automata/3d` not on npm | **removed**: `three-d-gate.ts` and `THREE_D_NOT_PUBLIC` are deleted; `--template 3d` is listed in help |
| the playground's `UNPUBLISHED_EXTENSIONS` | examples import unpublished packages | **`@automata/3d` leaves the set**; the five kits stay until B10 |

- [ ] **Step 0: The shared lists the parallel B branches will need** (they may not edit `tooling/`). Move
  `WORKSPACE_ONLY` out of `release-list.test.ts` into `tooling/release/src/workspace-only.ts` (exported, with its
  reason per entry) and make `private-build.test.ts`'s first case use it too (today it demands that a private built
  package's `publishConfig.exports` keys equal its `exports` keys exactly, which a kit with a wildcard fixture entry
  cannot meet). Add the twelve kits' entries measured at the plan audit, each with its reason: `@automata/nav`:
  `./testing/clinic` (tsdown cannot load its `?raw` TOML imports); `@automata/sectors`: `./testing`,
  `./testing/fixtures/*`; `@automata/systems`: `./testing/ward-scene.pipe`, `./testing/ward-scene-strict.pipe`,
  `./testing/fixtures/*`; `@automata/narrative`: `./testing/toy-scene.pipe`, `./testing/dead-end-scene.pipe`,
  `./testing/fixtures/*`; `@automata/cutscenes`: `./testing/door-and-lamp`; `@automata/character-kit`: `./testing`
  (`src/testing/kit-fixture.ts:18` reads `../../tests/fixtures` by path); `@automata/world-kit`: `./textures` (the
  kit's own texture command: `dist/textures.js` reads `../../../library/swatches.json`, `../../../library/tiles/` and
  `../../../assets/photos/` by `import.meta.url`, which leave the package from `dist`; nothing outside the kit imports
  it). The test for the move is the two existing files, green before and after. Commit
  `refactor(release): the workspace-only entries in one list both release tests read`.
- [ ] **Step 0b: Published never imports private.** `published-imports.test.ts`, test first: for every package
  `publishablePackages` returns, every import specifier in `src/**/*.{ts,svelte}` that names a workspace package
  (matched against the names in `workspacePackages`, never a scope written in pieces) names a publishable one; the
  failure names the file, the line and the private package. Seed it with a temporary fixture workspace (as
  `pack.test.ts` does) in which a public package imports a private one: FAIL with that file named; then the real tree:
  PASS. This is the coordinator's check that `interact`, `hud` and `pipelines` (and `editor`, `editor-3d`) never reach a
  published package, for the Svelte kits too, which `onlyImport` does not see.
- [ ] **Step 1:** Invert `release-list.test.ts` (`@automata/3d` joins `EXPECTED`, 14 names) and add two cases: every
  `@automata/*` `dependency` or `peerDependency` of a publishable package is publishable; and every publishable
  package's `tsconfig.json` resolves `isolatedDeclarations: true` (read `compilerOptions` through its `extends` chain).
  Nothing enforces the second today, and tsdown builds without it (measured at the plan audit: with the flag off it
  writes declarations with TypeScript 7's emitter, `Emit types with typescript@7.0.2`), so without this case the written
  types the coordinator ruled could quietly not happen. FAIL: the package is private.
- [ ] **Step 2:** `packages/3d/package.json`: remove `"private"`, set the fixed group's version, description without
  "Not published yet", add `publishConfig.registry` (`https://registry.npmjs.org`) and `access: public`, and make every
  outside peer a caret range (`release-list.test.ts` fails an exact one: "accept a caret range of each outside peer";
  `pixi.js` is the exact `8.23.0` after `claude/pixi-3d-public`: it becomes `^8.23.0`). `@pixi/3d` stays a
  `dependency` at the exact version `PIXI_3D_SPEC` names. Add it to `.changeset/config.json`'s fixed group. Tests pass.
- [ ] **Step 3:** The gate: change `three-d-gate`'s test to expect `create-game --template 3d` to succeed with no
  environment variable outside a workspace, and the help test to list `3d`. FAIL. Delete the gate; tests pass. Check
  `PIXI_3D_SPEC` and the template's `pixi.js` equal the versions in `packages/3d/package.json` (add that assertion to
  `template-3d`'s test).
- [ ] **Step 4:** The boundaries and catalog rows of the table, each with its test.
- [ ] **Step 5:** The changeset; reword `.changeset/create-game-3d-template.md`'s gate sentence to what ships (it is
  unreleased); `pnpm changeset status` and `check-changesets` pass inside `pnpm check`.
- [ ] **Step 6: The index.** `pnpm build`, `pnpm api-index`: exit 0 with `@automata/3d` in it and
  `undocumented-baseline.json` still `[]` (A4 documented every export). `pnpm api-index --write`, `pnpm api-report
  --update`; commit what they write.
- [ ] **Step 7:** `pnpm recorded:check`, gates, commit
  `feat(3d): @automata/3d is a public package; create-game offers the 3D template`.

**Done when:** `pnpm check` is green with `@automata/3d` publishable and no `AF_BETA_3D` left outside history and the
journey A6 rewrites (`git grep AF_BETA_3D -- ':!docs/archive' ':!docs/superpowers' ':!docs/refactor'
':!tooling/consumer-smoke'` prints nothing; A6's done-means drops the last exclusion).

### Task A6: The 3D stranger's journey, ungated, with a size budget

**Files:**
- Modify: `tooling/consumer-smoke/tests/e2e/stranger-3d.test.ts`, `tooling/consumer-smoke/src/commands.ts` (`pack3d`
  goes: `packAll` now packs it), `tooling/consumer-smoke/src/run.ts`, `tooling/consumer-smoke/tests/unit/pack.test.ts`; create
  `tooling/consumer-smoke/src/budgets.ts`

- [ ] **Step 1: The failing test.** The budgets live in one table, `PACK_BUDGETS_KB` in a new
  `tooling/consumer-smoke/src/budgets.ts`, keyed by **package name**, and `run.ts`'s size step checks every pack against
  it. Today's tools check finds its pack with `/automata-tools-.*\.tgz$/` (`run.ts:178`), a pack file name written by
  hand: after the scope rename the file is `automataframework-tools-….tgz`, the pattern matches nothing, and the step
  reports "installed from the registry: not measured" and passes (plan audit, finding 14). So the new step reads each
  tarball's `package/package.json` name (or the name `packPublished` returns with it) and never a file name. Test first
  in `pack.test.ts` (a fixture tarball named `x-1.0.0.tgz` whose manifest says `@automata/tools` is measured against the
  tools budget); `-tools` keeps 3 MB (3,072 kB) and `@automata/3d` gets the size measured after A3, plus a quarter,
  rounded up to the next 10 kB (the trial before A3: 307,703 bytes). FAIL until the table and the reader exist. These
  budgets run where packs exist (the smoke, `release-checks.yml`), not in `pnpm check`: say so in the file's comment.
- [ ] **Step 2:** Remove `test.skip`, the `AF_BETA_3D` environment and `pack3d` from the journey; rewrite its header
  comment to say what it proves. Replace the fixed `waitForTimeout` calls with waits on the page's readiness attribute
  where one exists (browser tests wait on readiness, never a sleep); keep the before-and-after screenshot comparison.
- [ ] **Step 2b: The rotate hint.** The survey's run failed here, not on the renderer: the journey's project is
  `sizes.phone`, upright, and the 3D game's rotate hint (`data-testid="rotate-hint"`) covers Play, so the click never
  lands. The 3D template is landscape **by design**: `template-3d-game.ts:107-110` sizes the field "the long side a phone
  held sideways" and sets `orientation: 'landscape'`, and `template-3d.ts:41` writes `shipConfigFile('landscape')`. So the
  journey plays it as a stranger with a phone would, **on the same page, without a reload** (AGENTS.md: keep focus and
  state through rotation): `goto` upright; wait for `data-state="ready"`; assert the hint is visible and its text is
  "Turn your phone sideways" and "This game plays in landscape." (the words a drunk grandma reads; `en.json:157-158`);
  then `page.setViewportSize` with `sizes.phone`'s width and height swapped; assert the hint is hidden and
  `data-state` is still `ready`; then Play. Do not hide the hint or shrink anything. Give each browser expectation a
  60 s limit, so a blocked click fails in a minute, not twenty. Measured at the plan audit with exactly this sequence:
  the hint said "Turn your phone sideways", went on the turn, and the walk passed.
- [ ] **Step 3:** `pnpm build && pnpm --filter @automata/consumer-smoke exec playwright test tests/e2e/stranger-3d.test.ts
  --trace off`. Expected: `1 passed`, **in the session, with no GPU**. Measured at the plan audit on SwiftShader with the
  trial build (dist side-effect files listed, A2 step 4) and step 2b's turn: `1 passed (35.0s)`, the whole journey from
  `create-game` to Wick walking. Without the `dist` side-effect files it fails at boot (`data-state="failed"`, the
  no-eval boot defect): if it does, A2 step 4 is wrong, not the renderer. A run that does not pass is a stop to
  investigate here, not a step to leave for the Owner's runner.
- [ ] **Step 4:** `pnpm recorded:check`, gates, commit `test(consumer-smoke): the 3D stranger's journey runs on every run, from
  packs`. Open the draft pull request for Part A.

**Done when:** the journey passes to "walk Wick" with no gate, from packs, in the session; `git grep AF_BETA_3D --
':!docs/archive' ':!docs/superpowers' ':!docs/refactor'` prints nothing; every pack is inside its budget.

---

## Part B: the kits (three parallel branches, then the join)

**The list, from the import graph (survey, section 2):** `world-kit`, `lcd-panel`, `retro-crisp`, `figures`,
`character-kit`, `places`, `sectors`, `nav`, `level-2d`, `systems`, `narrative`, `cutscenes`. **Staying private:**
`interact`, `hud`, `pipelines` (nothing public imports them), `editor`, `editor-3d` (page sources).

**Why the three stay private (the coordinator agreed, 2026-11-12).** The survey's section 2: no source file of the 3D
template, `games/base-3d`, `examples/3d`, `examples/3d-story`, `examples/2d-story`, `packages/editor-3d`,
`extensions/editors` or the site imports `@automata/interact`, `@automata/hud` or `@automata/pipelines`. The check that
keeps it so is A5's new case in `release-list.test.ts` (every `@automata/*` dependency of a publishable package is
publishable), which B10 extends with a named assertion: none of the three is a dependency, peer or import of a
publishable package. A build would fail first (`onlyImport`), and the test says why in words.

**Written types come first, as their own work.** In every kit that has isolatedDeclarations off, the written types
(recipe step 2) are done and committed **before** the build configuration, as a commit of their own
(`refactor(<kit>): written types on every export`), with the failing check being the compiler's count (re-measured at
the plan audit on `main` `d401ec4d`, TypeScript 6.0.3: world-kit 17 (12 TS9013, 5 TS9010), character-kit 16 (5 TS9007,
5 TS9010, 4 TS9016, 2 TS9011), retro-crisp 4 (3 TS9010, 1 TS9016), lcd-panel 2 (TS9010); the painter's 174 are task
B3). The count must be 0 and the kit's recorded files unmoved before the build step starts. **Why, honestly:** tsdown
does not need them to build. With the flag off it writes declarations with TypeScript 7's emitter (measured: every kit
built, `Emit types with typescript@7.0.2`), against the shared setup's own rule that declarations come from
isolatedDeclarations (`tooling/release/src/tsdown-shared.ts:4-5`). The coordinator ruled the written types are real
work before each build; A5's new `release-list.test.ts` case (every publishable package resolves the flag on) is what
holds a kit to it when B10 makes it public.

### What the plan audit measured for each kit

A trial build of every kit on `main` + `claude/pixi-3d-public` (scratch, never committed): tsdown through
`publishedBuild` for the ten plain kits, `svelte-package` plus `finishSvelteDist` for the two Svelte kits; packed with
`pnpm pack`. Undocumented exports from the built `.d.ts`, read by the API index's own `indexRows` and `checkDocs`.

| Kit | Builds | Packed bytes | Exports / undocumented | Workspace-only entries (A5's list) |
| --- | --- | --- | --- | --- |
| `world-kit` | yes | 122,633 | 88 / 31 | `./textures` (reads `library/` and `assets/photos/` by path) |
| `lcd-panel` | yes | 8,577 | 15 / 4 | none |
| `retro-crisp` | yes | 13,979 | 32 / 12 | none |
| `figures` | yes | 194,174 | 181 / 46 | none |
| `character-kit` | yes | 40,340 | 44 / 26 | `./testing` (reads `tests/fixtures` by path) |
| `places` | yes | 3,019 | 8 / 1 | none |
| `sectors` | yes | 11,402 | 55 / 27 | `./testing`, `./testing/fixtures/*` |
| `nav` | **no**, until `./testing/clinic` leaves the build (`UNLOADABLE_DEPENDENCY … clinic.nav-graph.toml?raw`) | 6,799 | 55 / 38 | `./testing/clinic` |
| `level-2d` | yes | 5,774 | 13 / 3 | none |
| `systems` | yes | 46,245 | 247 / 140 | `./testing/ward-scene.pipe`, `./testing/ward-scene-strict.pipe`, `./testing/fixtures/*` |
| `narrative` | yes (`svelte-package`) | 55,640 | 242 / 135 | `./testing/toy-scene.pipe`, `./testing/dead-end-scene.pipe`, `./testing/fixtures/*` |
| `cutscenes` | yes (`svelte-package`) | 25,400 | 97 / 53 | `./testing/door-and-lamp` |

Together 533,977 bytes packed and 516 undocumented exports. No kit reads a non-code file at runtime outside the
entries listed as workspace-only: every JSON library is an `import … with { type: 'json' }` and is bundled; the
`.toml` and `.md` files are test fixtures; `systems`' `carried-light.toml` and `peek.toml` are the names of a
**game's** content files, not files the kit reads. Every kit already has `automata.simEntries`.

### The kit recipe (every B task applies it to each kit it owns, in this order)

1. **The failing test:** `extensions/<kit>/tests/unit/package/manifest.test.ts`, as A2's: the `exports` keys equal
   the keys the task lists (unchanged from today); `publishConfig.exports` has every one of them **except** the kit's
   workspace-only entries (read from `tooling/release/src/workspace-only.ts`, which A5 filled), each with `types` and
   `import` under `./dist/`; `publishConfig` has no `registry` while the kit is private (`private-build.test.ts:38`);
   `files` is `['dist']`; `scripts.build` is set; every `@automata/*` import of `src/` outside `src/testing` is a
   `peerDependency` at `workspace:^` and a `devDependency` at `workspace:*`, as `@automata/puzzle` has them. Run
   `pnpm --filter @automata/<kit> exec vitest run --project unit tests/unit/package/manifest.test.ts`. Expected:
   FAIL, `publishConfig` is undefined.
2. **Written types** (only `world-kit`, `lcd-panel`, `retro-crisp`, `character-kit`; the painter is B3): run
   `pnpm --filter @automata/<kit> exec tsc -p . --noEmit --isolatedDeclarations true | grep -c "error TS9"` (the count
   above), write each type, set `"isolatedDeclarations": true` (or drop the `false` line) in the kit's
   `tsconfig.json`, run it again: 0. A written type must equal the inferred one: `pnpm --filter @automata/<kit>
   typecheck` green, no cast added. `pnpm recorded:check`. Commit `refactor(<kit>): written types on every export`.
3. **The build.** A plain kit: `tsdown.config.ts` through `publishedBuild` with `platform: 'browser'` and one entry per
   published key (`index` for `.`, the key without `./` otherwise), `scripts.build: 'tsdown'`. A kit with `.svelte`
   files (`narrative`, `cutscenes`) builds **as `@automata/debug` does, without tsdown**: `svelte.config.js` (copy
   debug's), `tsconfig.package.json` (`isolatedDeclarations: false`, only for `svelte-package`: svelte2tsx writes
   inferred component types), `build/finish-dist.ts` calling `finishSvelteDist(dist, { vendoredTypes: {}, testOnly:
   ['testing'] })`, and `scripts.build: 'svelte-package -i src -o dist --tsconfig tsconfig.package.json && node
   build/finish-dist.ts'`; its `publishConfig.exports` point at `./dist/entries/<name>.js` and `.d.ts` (the source tree's
   shape), with the `svelte` condition on `.` as debug's has; add `@sveltejs/package` `3.0.0` and
   `@sveltejs/vite-plugin-svelte` `7.3.1` to its devDependencies. `onlyImport` does not run for a Svelte kit: A5's
   `published-imports.test.ts` is its check.
4. **`package.json`** to satisfy the test. **`"private": true` and version `0.0.0` stay** (B10 flips them). Outside
   peers stay as they are here (B10 makes them caret ranges).
5. `pnpm install` (only this kit's importer block of `pnpm-lock.yaml` changes: `git diff --stat pnpm-lock.yaml` shows
   one file and the log says which importer), then `pnpm --filter @automata/<kit> build`. Expected: `Build complete`
   (tsdown) or exit 0 (`svelte-package`), and no `onlyImport` or `UNLOADABLE_DEPENDENCY` error. The manifest test
   passes.
6. **From `dist`:** every file `publishConfig.exports` names exists; `grep -l "from 'node:\|from \"node:" dist/**/*.js`
   prints nothing (a browser kit whose published entry imports `node:` breaks a game's build: a stop). The sim stays
   free of Effect through the root `boundaries` script's `--forbid <kit>:effect`, already there for every kit.
7. **Doc comments.** Measure in the working tree only: set `"private": false`, run `pnpm api-index`, keep the kit's
   undocumented list, then `git checkout` the manifest and the files the run writes (`docs/cheatsheet.md`,
   `agents/automata/skills/automata-api/reference/api.md`, `agents/automata/.claude-plugin/plugin.json`). The count
   must equal the table's, or the log says why. Document each export, re-measure: 0. Commit
   `docs(<kit>): doc comments on every export`.
8. **The README**, for a stranger: what it is, `pnpm add @automata/<kit>`, its published entries in a table with one
   line each, its peers, and one example that a 3D or story game would write. Each command it names is run once in a
   scratch game and the log says so.
9. **Pack** (`pnpm --filter @automata/<kit> pack --pack-destination <a temp folder>`), record the bytes in the log
   next to the table's. B10 sets the budgets from these numbers.
10. **The kit's suites:** its unit suite, and its browser suite where it has one (`test:browser`; on SwiftShader in
    the session for 2D-only kits, else pending a GPU runner and said so): the same pass counts as before the task,
    written in the log. `pnpm recorded:check`: `recorded: unchanged`. Gates (`pnpm format`, `pnpm check`). Commit
    `build(<kit>): <kit> builds to dist`.

No task in the three parallel branches edits `.changeset/`, root `package.json`, `turbo.json`, `tooling/`,
`pnpm-lock.yaml` outside its own kits' importer blocks, or another kit's folder. Every shared list a kit needs was
written by A5.

### Task B1: `world-kit` (`claude/ship-3d-b-looks`)

**Files:** `extensions/world-kit/**` (`package.json`, `tsconfig.json`, new `tsdown.config.ts`, `src` (types and doc
comments only), `README.md`, the new test). Entries: `.`, `./textures`, `./sky`; published: `.` and `./sky`
(`./textures` is the kit's own texture command and stays workspace-only). The 38 PNGs under `assets/photos/` are the
texture command's source photos, not recorded pictures, and are not packed (`files: ['dist']`).

- [ ] **Step 1:** Recipe step 1 (keys `.`, `./textures`, `./sky`; published `.`, `./sky`). FAIL as the recipe says.
- [ ] **Step 2:** Recipe step 2: 17 errors, 12 of them TS9013 (the first: the tile files' and props' exported
  objects); 0 after. Commit.
- [ ] **Step 3:** Recipe steps 3 to 6. Expected from step 6: no `node:` import in `dist` (the audit's trial, with
  `./textures` built, had one: `dist/textures.js`; leaving it out removes it).
- [ ] **Step 4:** Recipe step 7: 31 undocumented (the first five: `Dressed`, `FigureRead`, `Kit`, `MapName`,
  `dressedBaseScenes`). Commit.
- [ ] **Step 5:** Recipe steps 8 to 10. The kit's browser suite (`test:browser`, `test:webgpu`) needs a GPU: pending.

**Done when:** the kit builds, packs (about 120 kB), has 0 undocumented exports and 0 written-type errors, and its unit
suite passes with recorded files unchanged.

### Task B2: `lcd-panel` and `retro-crisp` (`claude/ship-3d-b-looks`)

**Files:** `extensions/lcd-panel/**`, `extensions/retro-crisp/**`. Entries `.` and `./pass` each, both published.
Their source imports `@automata/3d` (and `framework` for retro-crisp); `content` and `framework` appear in tests only
and stay devDependencies.

- [ ] **Step 1:** `lcd-panel`: recipe step 1; step 2 (2 TS9010); steps 3 to 6; step 7 (4 undocumented:
  `LcdProfile`, `LcdUniformValues`, `lcdProfileSchema`, `LcdPanelEffect`); steps 8 to 10.
- [ ] **Step 2:** `retro-crisp`: the same; step 2 has 4 (3 TS9010, 1 TS9016); step 7 has 12 (the first:
  `CrispLayout`, `CrispProfile`, `RETRO_UNIFORMS`, `RetroGrade`, `RetroProfile`).
- [ ] **Step 3:** Open the branch's draft pull request when B1 and B2 are done.

**Done when:** both build and pack (about 9 and 14 kB) with 0 undocumented and 0 written-type errors.

### Task B3: The painter's written types (`claude/ship-3d-b-figures`)

**Files:** `extensions/figures/src/**`, `extensions/figures/tests/fixtures/**` (9 of the 174 are there: the flag
covers the whole `tsconfig.json`, whose `include` has `tests`), `extensions/figures/tsconfig.json`

**Two other branches rewrite the painter; never at the same time as this task.**
- `claude/builders-fold-strict` (the two strict compiler flags over the painter, 43 files, not started; not on `origin`
  at the plan audit) touches the same files. **Order: this task first, the strict flags after.** The written types are
  on the launch path and the strict flags are not, and a file with written export types is easier to make strict than
  the reverse. The strict session starts only after `claude/ship-3d-b-figures` has merged. If the coordinator would
  rather have one pass, the alternative is one run per folder that does both in each folder's commit; this plan does
  not take it, because it would put work that is not needed for launch in front of the build. **The strict session
  also inherits the declarations step** (`tsconfig.types.json`, `types/`, `prepare`, `turbo.json`'s
  `@automata/figures#typecheck`): B4 keeps it, because removing it before the strict flags breaks the kit's
  typecheck (B4, step 1).
- `claude/painter-hands` changes `paint-hands.ts`, adds `paint-hand-form.ts` (223 lines) and changes one line of
  `figure/figure-stamps.ts`. Measured at the plan audit: **neither hand file has a TS9 error today**;
  `figure-stamps.ts:168` has one (TS9007). So: `figure-stamps.ts` is done in the `figure` commit only if that branch has
  merged by then, else last; `paint-hand-form.ts` is checked with the count after that branch merges (new exports in it
  may need types). If it has not merged when every other folder is done, stop and say so in the log: the flag cannot
  go on until the merged painter counts 0.

The 174, by folder (re-measured): `shared/paint` **95**, `shared/actors` 20, `shared/math` 9, `shared/motion` 9,
`shared/figure` 7, `shared/hair` 7, `shared/lighting` 7, `shared/outfit` 6, `shared/stage` 2, `features/view` 2,
`shared/body` 1 (165 in `src/`), and `tests/fixtures` 9 (`body-ends.ts`, `draw.ts`, `pins.ts`, `stage.ts`): 174. By kind: TS9007 73,
TS9016 47, TS9010 27, TS9011 11, TS9013 8, TS9008 5, TS9017 3.

- [ ] **Step 1:** `pnpm --filter @automata/figures exec tsc -p . --noEmit --isolatedDeclarations true | grep -c "error TS9"`.
  Expected: 174. This is the failing check. Save the full list.
- [ ] **Step 2:** Write the types, one folder per commit, smallest first so the method settles before `paint`: `body`,
  `stage`, `features/view`, `outfit`, `figure`, `hair`, `lighting`, `math`, `motion`, `actors`, `tests/fixtures`, then
  `paint` (95, in two commits if a session must stop half way). After each: `pnpm --filter @automata/figures test:unit`
  and `pnpm recorded:check`. The painter's recorded files must not move.
- [ ] **Step 3:** Turn the flag on in `tsconfig.json` (drop `"isolatedDeclarations": false`; keep the two strict flags
  off and its comment's first sentence); the count is 0; gates.

**Done when:** the painter type-checks with isolatedDeclarations on and its goldens are byte-identical.

### Task B4: The painter builds; its licence record (`claude/ship-3d-b-figures`)

The Owner: "publish the painter".

**Files:** `extensions/figures/**` (`package.json`, new `tsdown.config.ts`, `README.md`, new `LICENSE`, new
`PROVENANCE.md`), `docs/art/palettes/duel.md`. **`tsconfig.types.json`, `types/`, the `prepare` script and the
workspace `types` conditions stay** (see step 1).

- [ ] **Step 1:** The recipe, steps 1, 3 to 6, entries `.`, `./kit`, `./view`, all published. `exports` in the
  workspace keep their `types` conditions pointing at `types/` and their `default` at source; only
  `publishConfig.exports` points at `dist`. **Do not delete `types/`**: measured at the plan audit, with the `types`
  conditions removed and `types/` gone, `@automata/character-kit`'s typecheck reads the painter's source under the base's
  strict flags and fails with **1,440 errors** (692 TS2532, 266 TS18048, 245 TS2345, 132 TS2322, …). That step belongs
  to `claude/builders-fold-strict`, after the flags are on.
- [ ] **Step 2: What the folder carries.** Write `PROVENANCE.md`: the 8 JSON libraries are the project's own data; no
  image, font, sound or model is bundled; the goldens are not packed. Search again and record the commands and their
  empty output: `git grep -niE "last light|floorfifty|floor fifty" -- extensions/figures`. Check the history the same
  way: `git log --format=%s -- extensions/figures | grep -iE "last light|floorfifty"`. Anything found is a stop and a
  question for the Owner.
- [ ] **Step 3: The DUEL palette.** DUEL is not the painter's alone: `@automata/content` already carries its 256
  colours (`packages/content/src/shared/palette/duel.ts`, in the publish set today), and `@automata/3d` names it in 24
  source files. `duel.ts:2-3` says "the palette's author and licence are not recorded yet (docs/art/palettes/duel.md)".
  So the record is made **once**, in `docs/art/palettes/duel.md`, and `PROVENANCE.md` links to it. If the session cannot
  establish the author, source and terms from a public page, it writes "not established" there and lists it under
  "For the Owner" in the log. The question gates the **first release** (the Owner's), for `content`, `3d` and the
  painter alike; it does not hold B10, which makes nothing published.
- [ ] **Step 4:** `LICENSE`: a copy of the root `LICENSE` (MIT), so the pack carries one; add it to `files`.
- [ ] **Step 5:** The README loses "It is private and unpublished" and "Whether this package is published is the
  Owner's decision"; it says the kit's door is the supported way in. Recipe step 7 (46 undocumented; the first five
  `ACTIONS`, `ActorOptions`, `BASE`, `CastMember`, `DEFAULT_HEAD`), then steps 8 to 10 (pack about 194 kB).

**Done when:** the painter builds and packs with a `LICENSE`, `pnpm typecheck` is green for the whole workspace, and
`PROVENANCE.md` has no open line but, at most, DUEL.

### Task B5: `character-kit` (`claude/ship-3d-b-figures`)

**Files:** `extensions/character-kit/**`. Entries `.` and `./testing`; published: `.` (`./testing` reads
`tests/fixtures` by path, `src/testing/kit-fixture.ts:18`; nothing outside the kit imports it). `@automata/figures` and
`@pixi/3d` move from `dependencies` to peers (`workspace:^` for the painter) with devDependencies at `workspace:*` and
the exact pin. The door (`src/shared/figures/door.ts`) stays the only importer of the painter.

- [ ] **Step 1:** Recipe step 1; step 2 (16: 5 TS9007, 5 TS9010, 4 TS9016, 2 TS9011); steps 3 to 6.
- [ ] **Step 2:** `pnpm boundaries`: 0 findings (the `--confine` door holds).
- [ ] **Step 3:** Recipe step 7 (26 undocumented; the first five `Apron`, `BASE`, `Belt`, `Block`, `Bun`), steps 8 to
  10 (pack about 40 kB). Open the branch's draft pull request when B3 to B5 are done.

**Done when:** the kit builds and packs with 0 undocumented and 0 written-type errors, and its recorded files are
unchanged.

### Task B6: `places` and `sectors` (`claude/ship-3d-b-story`)

**Files:** `extensions/places/**`, `extensions/sectors/**`. `places`: entry `.`, peers `sim`. `sectors`: entries `.`,
`./sim`, `./physics`, `./testing`, `./testing/fixtures/*`; published `.`, `./sim`, `./physics`; peers `3d`,
`framework`, `physics`, `places`, `sim`. Both already list `automata.simEntries` (`places`: `.`; `sectors`: `./sim`,
`./physics`): nothing to add.

- [ ] **Step 1:** `places`: recipe steps 1, 3 to 10 (1 undocumented: `Places`; pack about 3 kB).
- [ ] **Step 2:** `sectors`: recipe steps 1, 3 to 10 (27 undocumented, the first five `InSector`, `Point`,
  `ResolvedMap`, `Sector`, `SectorEntered`; pack about 11 kB).

**Done when:** both build and pack with 0 undocumented.

### Task B7: `nav` and `level-2d` (`claude/ship-3d-b-story`)

**Files:** `extensions/nav/**`, `extensions/level-2d/**`. `nav`: entries `.`, `./sim`, `./testing/clinic`; published
`.`, `./sim` (the clinic entry imports `.toml?raw`, which tsdown cannot load: measured `UNLOADABLE_DEPENDENCY`); peers
`content`, `framework`, `places`, `sectors`, `sim`. `level-2d`: entries `.`, `./sim`, both published; peers `content`,
`framework`, `places`, `sim`.

- [ ] **Step 1:** `nav`: recipe steps 1, 3 to 10 (38 undocumented, the first five `NavAgent`, `NavArrived`,
  `NavArrivedPayload`, `NavDoor`, `NavDoorPayload`; pack about 7 kB). The build's entries must not include
  `testing/clinic`: if `UNLOADABLE_DEPENDENCY` appears, an entry list is wrong.
- [ ] **Step 2:** `level-2d`: the same (3 undocumented: `Level2dPlacesOptions` twice, `level2dExtension`; about 6 kB).

**Done when:** both build and pack with 0 undocumented.

### Task B8: `systems` (`claude/ship-3d-b-story`)

**Files:** `extensions/systems/**`. Entries `.`, `./sim`, `./bots`, `./testing/ward-scene.pipe`,
`./testing/ward-scene-strict.pipe`, `./testing/fixtures/*`; published `.`, `./sim`, `./bots`; peers `content`,
`framework`, `nav`, `places`, `puzzle`, `sectors`, `sim`. `extensions/editors`' tests read
`@automata/systems/testing/fixtures/presets.json` through the workspace `exports`, which keep the entry.

- [ ] **Step 1:** Recipe steps 1, 3 to 6.
- [ ] **Step 2:** Recipe step 7: **140** undocumented of 247 (the first five `AgentDef`, `CarriedLight`,
  `CarriedLightOptions`, `CaughtPayload`, `CutscenePayload`), one feature folder per commit. This is most of the
  task's time.
- [ ] **Step 3:** Recipe steps 8 to 10 (pack about 46 kB).

**Done when:** the kit builds and packs with 0 undocumented.

### Task B9: `narrative` and `cutscenes` (`claude/ship-3d-b-story`)

**Files:** `extensions/narrative/**`, `extensions/cutscenes/**`. Both have `.svelte` files (2 and 1): the Svelte build
of recipe step 3, with `svelte` as a peer. `narrative`: entries `.`, `./content`, `./sim`, `./tools`,
`./testing/toy-scene.pipe`, `./testing/dead-end-scene.pipe`, `./testing/fixtures/*`; published the first four; peers
`content`, `framework`, `places`, `puzzle`, `sectors`, `sim`, `svelte`. `cutscenes`: entries `.`, `./content`, `./sim`,
`./director`, `./stage-2d`, `./stage-3d`, `./testing/door-and-lamp`, `./tools`; published all but the testing entry;
peers `3d`, `content`, `framework`, `sim`, `pixi.js`, `svelte`. `cutscenes`' tests import `sectors` and `puzzle`, and
its `src/testing/converted-cutscenes.ts` resolves `@automata/narrative/testing/fixtures/…`: devDependencies only.

- [ ] **Step 1:** `cutscenes` first (smaller): recipe steps 1, 3 (Svelte) to 6; step 7 (53 undocumented, the first five
  `Caption`, `CutsceneEnded`, `CutsceneSceneValue`, `CutsceneScript`, `CutsceneSkip`); 8 to 10 (about 25 kB). The
  measured `svelte-package` output carried 1 `.svelte` file and no test file after `finishSvelteDist`.
- [ ] **Step 2:** `narrative`: the same; step 7 has **135** (the first five `AdvanceCommand`, `Canon`, `Choice`,
  `ChooseCommand`, `Delivery`); pack about 56 kB.
- [ ] **Step 3:** Open the branch's draft pull request when B6 to B9 are done.

**Done when:** both build and pack with 0 undocumented, and `published-imports.test.ts` (A5) passes with them in the
working tree's measurement flip (they have no `onlyImport`).

### Task B10: The join: twelve kits public (`claude/ship-3d-b-join`)

Runs alone, after B-looks, B-figures and B-story have merged. It makes nothing published (the release is the
Owner's), so the DUEL question (B4, step 3) does not hold it.

**Files:** the twelve `package.json` files, `.changeset/config.json`, root `package.json` (`boundaries`),
`tooling/release/tests/unit/release-list.test.ts`, `closed-beta-guard.test.ts`,
`tooling/examples-runner/src/catalog.ts` and its test, `site/playground/src/playground-catalog.ts` and its test,
`tooling/consumer-smoke/src/budgets.ts` and `tests/unit/pack.test.ts`, `pnpm-lock.yaml`, the generated API files
(`docs/cheatsheet.md`, `agents/automata/skills/automata-api/reference/api.md`, `agents/automata/.claude-plugin/plugin.json`);
create `.changeset/ship-3d-kits.md`. **Not** `turbo.json` (the painter's declarations step stays until the strict
flags: B4, step 1) and **not** `tooling/api-report` (it reports `packages/*` only, by design,
`tooling/api-report/src/core-packages.ts:1-3`; the published extensions `puzzle`, `feel` and the rest have no report
either, and the spec's "API-reported" for the kits is amended to "in the API index").

- [ ] **Step 1: The failing tests.** `release-list.test.ts`'s `EXPECTED` takes the twelve: **26** names (13 before
  Part A, `@automata/3d`, the twelve kits; C1 makes it 27). Add the named assertion the coordinator asked for: none of
  `@automata/interact`, `@automata/hud`, `@automata/pipelines`, `@automata/editor`, `@automata/editor-3d` is
  publishable, and none is a dependency or peer of a publishable package (A5's `published-imports.test.ts` already
  fails on an import of one). `budgets.ts` gets one budget per kit: the bytes each B task logged, plus a quarter,
  rounded up to the next 10 kB. The catalog test expects `UNPUBLISHED_EXTENSIONS` to be empty and the playground to
  offer the 3D examples. All FAIL.
- [ ] **Step 2:** In the twelve: remove `"private"`, set the fixed group's version, add `publishConfig.registry` and
  `access`, and make every outside peer a caret range (`pixi.js`, `@pixi/3d`, `svelte` are exact today in `world-kit`,
  `lcd-panel`, `retro-crisp`, `figures`, `character-kit`, `narrative`, `cutscenes`; `release-list.test.ts` fails an exact
  outside peer). Add the twelve to the fixed group; the changeset (`patch`, the twelve names).
- [ ] **Step 3: The guards.** `closed-beta-guard.test.ts` as A5 reshaped it: `--forbid <kit>:@automata/figures` is
  added for every new publishable kit but `character-kit`; `--forbid <kit>:@pixi/3d` for every new kit that is not 3D
  by A5's rule (`places`, `nav`, `level-2d`, `systems`, `narrative`: none names `@pixi/3d` or `@automata/3d`; check each
  manifest, do not trust this list). The test's text says the rule that is left: "2D packages carry no 3D; only the
  character kit's door imports the painter".
- [ ] **Step 4:** `pnpm install` (the lockfile settles the twelve importers), `pnpm build`, `pnpm api-index` exits 0
  with the baseline file `[]`, then `pnpm api-index --write`; commit what it writes.
- [ ] **Step 5: From packs.** `pnpm --filter @automata/release test:dist` and the consumer smoke
  (`pnpm --filter @automata/consumer-smoke smoke`): every pack installs outside the workspace with no `workspace:` range
  left, and every budget passes. Then the 3D stranger's journey (A6) again: `1 passed`.
- [ ] **Step 6:** `pnpm recorded:check`, gates, commit `feat: the 3D and story kits are public packages`. Draft pull
  request.

**Done when:** `pnpm check` and `pnpm build` are green with 26 publishable packages, every budget passes, and the 3D
journey still passes.

---

## Part C: the editors reach a stranger (`claude/ship-3d-c-editors`)

Starts after B10, after `claude/editor-journeys-green` has merged, and after the coordinator confirms the one-page
interface below. `claude/editor-journeys-green` was not on `origin` at the plan audit, so its diff was not read. What C
needs from it, exactly: (1) `automata editor` run on a fresh game before `pnpm dev` starts the game itself and the
editor's Play reaches it (the ship audit's Part 1, M5); (2) the 2D editor journeys green in Chromium (the audit
measured 23 passed, 15 failed), with the harness change under `packages/editor/tests/e2e/harness/`, because C4's 3D
journey copies `levels-3d-edit-reaches-the-game.test.ts`'s readiness waits; (3) the journeys' time limit (the audit
saw a 180 s wait per test that looked like a hang). C starts from a `main` that has all three; it does not redo them.

**Packaging, decided from the survey (section 6):** the published package is `@automata/editors`
(`extensions/editors`). It carries two built pages: the full suite (2D and 3D, built by `packages/editor-3d`) and the
content editors (its own). About 1.58 MB packed; budget **2 MB**. **The 2D suite stays in `@automata/tools`**
(2.58 MB packed, budget 3 MB), so a 2D game's install is what it is today and `automata editor` in a 2D game needs
nothing new. Moving it would save 0.56 MB in `-tools` and make every 2D maker install a second package for what works
today.

**One page, built once, by the editors v2 landing (the coordinator's ruling, 2026-11-12, after the plan audit's
finding 6).** `automata editor` serves **one** page per run (`editor-command.ts`: `pageFor(readEditorList(root))`
picks `suite-2d` or `suite-full`; `deps.serve` takes one `appDir`). As first written, C1 to C3 packed two pages
(`suite-full` from `packages/editor-3d`, and the content editors), so a 3D game would have got Levels 3D and
Characters **or** the content editors in one run, never both, and the spec's done-means 2 would fail. The editors v2
landing plan (`claude/editors-v2-landing-plan` `fdae6f18`, `docs/superpowers/plans/2026-11-12-editors-v2-landing.md`,
its section on Part C and its tasks 2, 6 and 7) owns the page: after its **task 6** merges,
`pnpm --filter @automata/editors exec vite build` writes **one** page, `extensions/editors/dist/suite/index.html`,
holding Levels 2D, Levels 3D, Characters (2D and 3D), the Tuner, Feel, Audio, Writer, Sequence and Schematic (the
source is already in the v2 stack: `extensions/editors/src/app/suite/main.ts` with `editors3d`), and
`page-for.ts` becomes `pageFor(editorList: string | undefined, fullPageThere: boolean): 'suite-2d' | 'suite-full'`,
where `'suite-full'` is that page. Its **task 7** hosts the same page on the site. **Part C builds no page.** It
packages that one, resolves it from a pack, removes the refusal, writes the README, sets the budget and proves it with
two journeys. **C starts after the landing's tasks 2 to 4 (v2 on `main`) and task 6 have merged**, and every path below
is re-checked against `main` at that point (at the plan audit they all exist both on `main` and on the v2 tip,
`refs/pull/567/head` `47391563`: `page-for.ts`, `editor-command.ts`, its test, `extensions/editors/package.json`,
`src/app/suite/main.ts`, `template-3d.ts`).

### Task C1: `@automata/editors` is a package of its built page

**Files:**
- Create: `extensions/editors/src/entries/pages.ts`, `extensions/editors/tsdown.config.ts`,
  `extensions/editors/tests/unit/package/manifest.test.ts`, `extensions/editors/tests/unit/entries/pages.test.ts`,
  `.changeset/ship-editors.md`
- Modify: `extensions/editors/package.json`, `.changeset/config.json`, `tooling/release/tests/unit/release-list.test.ts`,
  `tooling/consumer-smoke/src/budgets.ts`, `pnpm-lock.yaml`, the generated API index files

**Interfaces:**
- Produces: the pack's layout `dist/suite/index.html` (the landing's page, as its `vite build` writes it) and
  `dist/pages.js` exporting `pagePath(): string`, the absolute path of `dist/suite` from `import.meta.dirname`.
  Published `exports`: `.` (types and import at `./dist/pages.*`) and `./package.json`. The workspace `exports` keep
  today's `.` (the TOML session the page's code imports) for the repository's own importers.

- [ ] **Step 1: The failing tests.** `manifest.test.ts`: `files` is `['dist']`; no `dependencies` at all (the page is
  bundled: every `@automata/*`, `svelte`, `smol-toml`, `zod` it lists today moves to `devDependencies`);
  `publishConfig.exports` as above; `scripts.build` runs the page build and then tsdown. `pages.test.ts`: `pagePath()`
  ends with `/dist/suite` and, when `dist/suite/index.html` exists, the build carries no `@pixi/3d/extras` (the no-eval
  rule: `findPixi3d(pagePath()).extras` is empty; `findPixi3d` comes from `@automata/tools/internal`, a devDependency).
  Run `pnpm --filter @automata/editors exec vitest run --project unit tests/unit/package tests/unit/entries`. FAIL: no
  `publishConfig`, no module.
- [ ] **Step 2:** `tsdown.config.ts` through `publishedBuild` with the one entry `pages` and **`clean: false`** (tsdown
  empties `dist` by default, which would delete the page `vite build` just wrote; check `tsdown-shared.ts` passes the
  option through, and if it does not, write `pages.js` to `dist/` from a second out folder instead and say so in the
  log). `scripts.build`: `vite build && tsdown`. `pnpm --filter @automata/editors build`: both `dist/suite/index.html`
  and `dist/pages.js` exist.
- [ ] **Step 3:** `package.json`: not private, the fixed group's version, `publishConfig.registry` and `access`; fixed
  group, `release-list.test.ts`'s `EXPECTED` (27 names), the changeset (`patch`). `published-imports.test.ts` (A5)
  reads `src/` of a package whose code is bundled into a page: it must pass (its imports of private packages, if the
  page imports any, are devDependencies that are bundled; if the test fails on them, give it the one named exception
  "a page package bundles its imports" for this package, with the reason in the test, and say so in the log).
- [ ] **Step 4: The budget.** `budgets.ts`: `@automata/editors` at most 2,048 kB (the survey: the full suite and the
  content editors gzipped together about 1.58 MB; the one page should be smaller: measure and write the bytes in the
  log). `-tools` still under 3 MB.
- [ ] **Step 5:** `pnpm build`, `pnpm api-index --write` (one new export), `pnpm recorded:check`, gates, commit
  `feat(editors): the editors package carries the page with every editor`.

### Task C2: `automata editor` opens it; the refusal goes

**Files:**
- Modify: `packages/tools/src/features/editor/editor-command.ts` (the refusal, at `main`'s lines 92 to 96, wherever the
  landing left it), its dependencies object, `packages/tools/tests/unit/editor/editor-command.test.ts`, and the place
  that builds the real `deps` (`grep -rn "inRepository" packages/tools/src`)

**Interfaces:**
- Consumes: `pagePath` from C1, resolved **from the game's folder** (`createRequire(join(root, 'package.json'))`), so
  the game's own installed version is used; `pageFor(editorList, fullPageThere)` from the landing's task 6.
- Produces: `deps.editorsPage(root: string): string | undefined` (undefined when the game has no `@automata/editors`).
  `fullPageThere` is `deps.inRepository || deps.editorsPage(root) !== undefined`; inside the repository the page stays
  the repository's own build.

- [ ] **Step 1: The failing tests.** (a) A 3D game with the package installed, outside the repository: exit 0, the
  server serves `editorsPage(root)`. (b) A 3D game without it: exit 2 and stderr is exactly
  `Error: This game needs the editors package to open the 3D editors. Add it: pnpm add -D @automata/editors\n`.
  (c) A 2D game without it: the 2D page from `-tools`, as today. (d) A 2D game with it: the one page, so the content
  editors its list names are there. (e) The string "The 3D editors are not in this release yet." appears nowhere in
  `packages/tools/src`. FAIL on (a), (b), (d), (e).
- [ ] **Step 2:** Implement; `deps.inRepository` keeps its meaning.
- [ ] **Step 3:** `pnpm recorded:check`, gates, changeset line in `ship-editors.md` for `@automata/tools`, commit
  `feat(tools): automata editor opens every editor from the editors package`.

### Task C3: `create-game` adds it; the README

**Files:** `packages/tools/src/shared/create-game/template-3d.ts` and its test, `extensions/editors/README.md` (new)

- [ ] **Step 1:** Test first: a game from `--template 3d` has `@automata/editors` in `devDependencies` at the
  framework's version; a 2D game does not (it can add it for the content editors; the README says how). Implement.
- [ ] **Step 2:** The README, for a stranger: what each editor changes, how to open them, what to install; each
  command in it run once in a scratch game, and the log says so.
- [ ] **Step 3:** The hosted editor is not this task's: the landing's task 7 makes the site serve the page with every
  editor, so the site's words and what it serves agree there. (The first draft's step that changed the site's words
  to the 2D suite is dropped, as that plan proposed.)
- [ ] **Step 4:** `pnpm recorded:check`, gates, commit.

### Task C4: Two journeys from packs

**Files:** create `tooling/consumer-smoke/tests/e2e/stranger-editor-3d.test.ts` and
`stranger-editor-content.test.ts`; modify `tooling/consumer-smoke/src/stranger.ts` only to share setup

- [ ] **Step 1: The 3D journey.** From packs: `create-game --template 3d`, install, `pnpm exec automata editor`, open
  Levels 3D, move one prop (or change the room's light, whichever the editor's own journey
  `levels-3d-edit-reaches-the-game` drives), press Play, and assert the game shows the change by the same readiness
  attribute and assertion that journey uses. Run it before C2 is in place on a scratch checkout to see it fail on the
  refusal text; on the branch it passes.
- [ ] **Step 2: The content journey.** A 2D game from packs plus `pnpm add -D` the packed `@automata/editors`: open
  Writer, change one word, press Play, and the game shows the new word (assert on the DOM text).
- [ ] **Step 3:** Both wait on readiness, never a sleep. Report `2 passed`, or which step was reached and that the rest
  is pending a GPU runner. `pnpm recorded:check`, gates, commit, draft pull request.

**Done when:** both journeys pass from packs and `-tools` and `@automata/editors` are inside their budgets.

---

## Part D: `@pixi/3d` 0.1.0, a pixel-reviewed port (`claude/ship-3d-d-pixi`)

The Owner: "port to 0.1.0". This is the one part where a recorded picture or hash may move, and only as below.

**What may move:** the recorded files of `packages/3d` (12), `extensions/figures` (21), `extensions/character-kit`
(5) and `examples/3d` (3), and only where the cause is one of the changed areas in the survey's section 7. (World-kit's
38 PNGs, `extensions/world-kit/assets/photos/`, are the texture command's source photos, not recorded pictures: no
renderer change can move them, and one that changes is a stop.)

**Every place AF reaches into `@pixi/3d`**, checked at the plan audit on `claude/pixi-3d-public` (D1 re-checks each):
the 47 imports of `@pixi/3d` and one of `@pixi/3d/extras` (`packages/3d/src/testing/bundle/extras-entry.ts`); no deep
import into `dist/` and no file name of the package's own bundles anywhere in source, configs or tests (the renamed
`pixijs-3d*.mjs` bundles are not named by AF: `git grep -nE "pixi-3d[a-z.*-]*\.mjs|pixijs-3d|@pixi/3d/(dist|lib|src)"`
finds only a test string in `extensions/figures/tests/unit/layers.test.ts:98`); the painter's
`template.test.ts`, which resolves the package with `createRequire(import.meta.url).resolve('@pixi/3d')` and reads
`core/gpu/shader/MaterialSystemGpu.mjs` beside the entry (0.1.0's `exports` keep `default` on `.`, so the CommonJS
resolver still finds `dist/index.mjs`; the file's path is the one to re-check); `findPixi3d`'s marker strings
(`packages/tools/src/shared/ship/prepare/pixi3d-markers.ts`: `View3D.screenToRay:degenerate`,
`View3D.worldToScreen:degenerate`, `pixi3d-shadow-budget`, and three extras markers), on which `ship prepare`'s scan
and `copy-editor`'s 2D guard depend, and which live in files 0.1.0 changed (`View3D`, the shadow pass): if one is gone,
both guards pass silently, and `packages/3d/tests/unit/renderer/bundle/pixi3d-bundle.test.ts` (Vite builds of two
fixture pages against the installed package) is the test that says so; `extensions/figures/vitest.config.ts`'s
`optimizeDeps`; and the eight manifests that pin it (`packages/3d`, `packages/editor-3d`, `games/base-3d`,
`extensions/character-kit`, `figures`, `lcd-panel`, `retro-crisp`, `world-kit`). **What may not:** any sim hash, any 2D golden, any md5 of content. A sim hash that moves is a defect in the
port (law 3).

### Task D1: The before frames; the move to 0.1.0

**Files:** create `docs/superpowers/audits/2026-11-12-ship-3d/pixi-0.1.0/README.md` and `before/`; modify the eight
manifests that pin `@pixi/3d`, `PIXI_3D_SPEC` in `template-3d.ts`, `docs/versions.md`, `pnpm-lock.yaml`

- [ ] **Step 1: Before.** On the untouched tree, shoot the frames the beta.3 port's audit used (its record,
  `docs/superpowers/audits/2026-11-12-pixi-3d-beta-3/README.md`, names the spike pages, cameras and the `?fog=` and
  `?colour=` switches) plus one frame per 3D example, in WebGL and WebGPU, into `before/`. Record the commands.
- [ ] **Step 2: The failing check.** Pin `0.1.0` in the eight manifests and the template; `pixi.js` to the version
  0.1.0 peers (`^8.23.0`; core already pins 8.23.0, so check every template and `docs/versions.md` and change only
  what differs). `pnpm install`: the lockfile diff is `@pixi/3d` (and `pixi.js` only if it moved). Run
  `pnpm test:unit` and the 3D browser suites. Record every failure, grouped by the survey's areas. The painter's
  `template.test.ts` is expected to fail in words if the default material template moved. Also run, and record:
  `pnpm --filter @automata/3d exec vitest run --project unit tests/unit/renderer/bundle/pixi3d-bundle.test.ts` (the
  markers still find 0.1.0 and its extras: a failure here is fixed in D2's first commit, in `pixi3d-markers.ts`, with the
  new marker read from 0.1.0's own source), and `ls node_modules/@pixi/3d/dist/core/gpu/shader/MaterialSystemGpu.mjs`
  from `extensions/figures` (the path `template.test.ts` reads).
- [ ] **Step 3:** Commit the bump and the failure list (`build(deps): @pixi/3d 0.1.0`); nothing re-recorded yet.

### Task D2: The port, area by area

**Files:** `packages/3d/src/features/look/**`, `features/renderer/no-eval/**`, `shared/render/**`,
`features/camera/occluders/**`, `extensions/figures/src/features/view/**`, the kits' look sources

For **every** area below the same five steps, one commit per area: (a) list D1's failures for the area (the
failing tests); (b) read the area's changed 0.1.0 files (`diff` of the two unpacked tarballs, as the survey did) and
write in the log, in a sentence, what changed; (c) fix AF's code; (d) the area's tests green **without re-recording**;
a test that can pass only by re-recording goes on D3's list with its before and after images, and nothing is
re-recorded here; (e) `pnpm test:unit` for the packages the area touches, then a commit
`fix(3d): <area> on @pixi/3d 0.1.0`. The sim hash tests (`packages/sim`, the games' `content.hash` files) must not move
in any area: one that does is a stop.

- [ ] **Area 1, materials and uniforms** (`MaterialSystemGl`/`Gpu`, `globalBitGl`/`Gpu`, `GlobalUniformGroup`,
  `BaseMaterial3D`): `packages/3d/src/features/renderer/no-eval/` (the uniform sync), then the painter's cell template
  rebuilt from 0.1.0's own (`extensions/figures/src/features/view/cell-template.ts`, as the beta.3 port did;
  `template.test.ts` names the edits). Then the no-eval proof: the bundle holds no `new Function` outside `./extras`
  (`pixi3d-bundle.test.ts` and the no-eval check of a built game, `automata check --only no-eval` on `games/base-3d`).
- [ ] **Area 2, lighting and the fog conversion** (`LightDataList`, `LightTiles`, `LightingSystemGl`/`Gpu`,
  `createLightingBit`, and the new `core/lightLimits`, where `MAX_LIGHTS` now lives): `packages/3d/src/features/look`
  (3 files) and the fog conversion in `packages/3d/src/shared/render`.
- [ ] **Area 3, shadows** (`ShadowRenderPassGpu`, `ShadowRenderPassBase`): `features/look`; the `pixi3d-shadow-budget`
  marker is checked again here.
- [ ] **Area 4, batching and instances** (`Mesh3DBatch`, `InstanceDataStoreBuffer`, `renderForwardBatchesGpu`):
  `packages/3d/src/shared/render/views` (2 files).
- [ ] **Area 5, passes and the render graph** (`RenderGraph`, `BackgroundPass`, `CopyOpaquePass`, `ColorOutputDraw`,
  `passBitRegistry`, `FullscreenPass`, `createDefaultGraph3D`): world-kit's sky and looks, `lcd-panel`, `retro-crisp`.
- [ ] **Area 6, the scene** (`Sprite3D`, `View3D`, `ParticleContainer3D`, `CameraData`, `validateCamera`): the painter's
  `cell-sprite.ts`, `packages/3d/src/features/camera/occluders` (1 file); the two `View3D` markers are checked again.
- [ ] **Area 7, glTF** (`loadGlb`, `processMaterials`, `processMeshes`, `loadImages`, `decodeDracoPrimitive`):
  `packages/3d/src/shared/render/model`.
- [ ] **Area 8, what is left**: the math and `extras/` files that changed (doc strings and the particle generator,
  per the ship audit), textures and image-based light (`DefaultTextures`, `generateIblSpecialCubemap`; no AF file names
  them): run the whole of `pnpm test:unit` and the 3D browser suites once more and list anything not yet explained.

### Task D3: The sheets and the list of what moved

- [ ] **Step 1:** Shoot `after/` with D1's commands. For every pair, write a side-by-side sheet (before, after, and the
  difference scaled ×8) with the tool the beta.3 audit used; put them under `pixi-0.1.0/sheets/`.
- [ ] **Step 2:** The list, in the README: every recorded file that must move, its before and after hash, the area that
  caused it, and one sentence on why the new picture is right (or "not right: open"). Look at each expected, actual and
  diff image before writing its line.
- [ ] **Step 3:** Stop. Send the list and sheets to the coordinator for the Owner. **Re-record nothing until he has
  seen them.** After his word, re-record exactly the listed files, one commit, the commit message naming the list.

### Task D4: The Owner's parity run; the close

- [ ] **Step 1:** Write, in the README, the exact commands for cross-engine parity in Chromium, WebKit and Firefox
  (take them from the beta.3 audit's "the Owner's parity commands" and `.github/workflows/3d.yml`, read only). An
  execution session cannot run WebKit or Firefox with a GPU: this gate is the Owner's, on his runners.
- [ ] **Step 2:** After his run is green: `docs/versions.md`, `docs/guides/3d.md`, ADR 0002's amendment line, a
  changeset (`@automata/3d` and each public kit whose pin moved, `patch`), gates, draft pull request. A red engine is a
  stop, never "flaky".

**Done when:** every moved file is on the list the Owner saw, and parity is green in three engines on his runners.

---

## For the Owner only

1. **Merge `claude/pixi-3d-public`** after its own proof (it conflicts with `main` in three files today; a session must
   resolve them first) and **`claude/editor-journeys-green`**. Part A and Part C wait on them.
2. **The DUEL palette.** The exact question: "AF's default palette is DUEL: `@automata/content` ships its 256 colours
   (`packages/content/src/shared/palette/duel.ts`), `@automata/3d` draws with it and the painter's colours are its ramps
   (`extensions/figures/src/shared/paint/duel-ramps.ts`). Who made it, where was it taken from, and do its terms let us
   ship its colour values inside MIT packages on npm? If not, which palette replaces it?" `duel.ts:2-3` already says
   the author and licence are not recorded (`docs/art/palettes/duel.md`). This gates the **first release** of
   `content`, `3d` and the painter alike (B4, step 3); no build task waits on it.
3. **The editor journeys on a GPU runner, where a session cannot draw them** (C4). The 3D stranger's journey is **not**
   on this list any more: at the plan audit it passed on SwiftShader, without a GPU, in 35 s, once the built package
   listed its `dist` side-effect files and the journey turned the phone (A6). Your runner is still where the 3D browser
   suites and parity run (D4).
4. **Look at Part D's sheets** and say which moved pictures are accepted (D3).
5. **Run cross-engine 3D parity** in Chromium, WebKit and Firefox on your runners (D4).
6. **The site's hosted editor** serves the page with every editor after the editors v2 landing's task 7 (a deploy:
   yours).
7. **Publish:** the npm organisation and the rename, `NPM_TOKEN`, the release approval. Nothing here publishes.
8. Correct the coordinator's ruling on the editors package if you want one install instead (it would take `-tools` to
   about 3.5 MB, over its budget).

## Questions for the coordinator from the plan audit

1. **The one editors page.** *Answered by the coordinator, 2026-11-12:* the editors v2 landing builds it
   (`extensions/editors/dist/suite`), Part C packages it after the landing's tasks 2 to 4 and 6; C1 to C3 are rewritten
   to that.
2. **The painter's declarations step** stays until `claude/builders-fold-strict` (B4, step 1): that branch's plan must
   take the removal of `types/`, `tsconfig.types.json`, `prepare` and `turbo.json`'s `@automata/figures#typecheck`.
3. **Workspace-only test entries in the kits** (A5, step 0): the spec's "no entry is dropped" is written for
   `@automata/3d`; for the kits the plan follows `@automata/puzzle`'s precedent and keeps eleven test or tool entries
   out of the packs. Say if any must ship.
4. **The kits and the API report**: the report covers `packages/*` by design; the kits are in the API index (with every
   export documented) but get no report, as `puzzle` and the other published extensions have none.

## Questions for the coordinator, with the answer this plan takes

1. **`interact`, `hud`, `pipelines`: publish or not?** The spec lists them; nothing public imports them. *Planned:*
   stay private. Publishing them later is one recipe task each (`pipelines` also needs its private `editor` import
   removed).
2. **The editors package's name.** *Planned:* `@automata/editors`, the existing folder, as the spec's own words suggest.
3. **Where the 2D suite lives.** *Planned:* it stays in `-tools` (measured above).
4. **The 2D packages' `--forbid @pixi/3d`.** *Planned:* kept, as a design rule.
5. **`pixi-3d-public` does not merge cleanly.** *Planned:* not this lane's work; Part A waits. If the coordinator wants
   it folded in, it is one task before A1.
6. **Part D against Part C.** *Planned:* in parallel. If the Owner would rather review pictures on a quiet tree, run D
   after C; no task changes.
7. **A kit's version before the rename.** *Planned:* the fixed group's version now; the rename changes names, not
   versions.

## Amendment to the spec's figures, 2026-11-12

The coordinator: use the measured numbers. Where the spec and the survey differ, the survey stands:

| The spec says | Measured |
| --- | --- |
| Part B publishes 15 kits | 12 kits (and `@automata/3d`): `interact`, `hud` and `pipelines` stay private |
| "Sixteen packages … are private, unbuilt and source-only" | 13 must publish; 3 stay private; `editor`, `editor-3d` and `editors` are pages, of which `@automata/editors` publishes as built pages |
| `-tools` packs to 2,513 kB | 2,577,117 bytes |
| the 3D suite adds about 2.5 MB | 2,600 kB on disk, 902,933 bytes gzipped (it is the full suite, 2D and 3D) |
| Part D moves `pixi.js` to `^8.23.0` in core | core already pins 8.23.0 after the beta.3 port; D1 checks the templates and `docs/versions.md` |
| a `tsdown` config "like `@automata/framework`'s" | also written export types in five packages (213 in all: 174, 17, 16, 4, 2), and `vitest` as an optional peer of `@automata/3d` |

## Log

| Date | Session | Task | What happened |
| --- | --- | --- | --- |
| 2026-11-12 | plan audit (stage 3) | all | 27 findings fixed in this plan ([the audit](../audits/2026-11-12-ship-3d-plan-audit.md)): A1 is a merge-base check over 108 recorded files; A2 sets no registry while private; A3 has its own pack test; A4 measures 275 undocumented exports by a working-tree flip; A5 writes the shared lists (workspace-only entries, published-imports test, caret peers, the isolatedDeclarations case); A6 runs in the session (`1 passed (35.0s)` on SwiftShader, measured); Part B stepped per task with each kit measured; B4 keeps the painter's declarations step; Part C packages the v2 landing's one page; D2 is eight areas. No task ticked. |
