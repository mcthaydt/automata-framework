# 3D and every editor reach a stranger: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task by task, one
> session per branch, with no subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a stranger with npm and the public docs makes, checks, builds and plays a 3D game, opens every editor on it, and
can install every kit the templates, examples and editors use.

**Architecture:** `@automata/3d` and twelve kits become built packages through the one shared tsdown setup
(`tooling/release/src/tsdown-shared.ts`), join the fixed group and the API report, and are proved from packs outside the
workspace. The editor pages ship in their own package, `@automata/editors`, which `automata editor` resolves from the game.
`@pixi/3d` then moves from 0.1.0-beta.3 to 0.1.0 as a pixel-reviewed port.

**Tech stack:** TypeScript, tsdown (oxc declarations, isolatedDeclarations), `svelte-package` for the two kits with
Svelte files, Vitest, Playwright, pnpm, turbo, changesets.

**Spec:** [`../specs/2026-11-12-ship-3d-and-editors-design.md`](../specs/2026-11-12-ship-3d-and-editors-design.md).
**Survey (the measurements this plan argues from):**
[`../audits/2026-11-12-ship-3d-survey.md`](../audits/2026-11-12-ship-3d-survey.md).

## Tracking

| Task | Part | Branch | State | Evidence |
| --- | --- | --- | --- | --- |
| A1 The baseline and the checksum manifest | A | `claude/ship-3d-a` | not started | |
| A2 `@automata/3d` builds | A | `claude/ship-3d-a` | not started | |
| A3 `./testing` works from `dist` | A | `claude/ship-3d-a` | not started | |
| A4 Every export documented; the API report; the README | A | `claude/ship-3d-a` | not started | |
| A5 Public: the fixed group and the six guards | A | `claude/ship-3d-a` | not started | |
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
| C1 `@automata/editors` is a package of built pages | C | `claude/ship-3d-c-editors` | not started | |
| C2 `automata editor` opens it; the refusal goes | C | `claude/ship-3d-c-editors` | not started | |
| C3 `create-game` adds it; the README; the hosted editor | C | `claude/ship-3d-c-editors` | not started | |
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
```

- **A** runs alone. Nothing else starts until it has merged.
- **B-looks, B-figures and B-story run in parallel.** They own disjoint folders. In those three branches every kit keeps
  `"private": true` and **no shared file is touched** except each kit's own importer block in `pnpm-lock.yaml`.
- **B10** runs alone after all three have merged. It is the only B task that touches shared files.
- **C and D run in parallel** after B10. C owns `extensions/editors`, `packages/tools/src/features/editor`,
  `packages/tools/scripts`, `create-game` and `tooling/consumer-smoke`. D owns runtime source under
  `packages/3d/src`, the kits' `src` and every recorded picture. D does not touch `package.json` `exports`; C does not
  touch runtime source.

**Shared files, and the one task that may change each:**

| File | A5 | B10 | C | D1 |
| --- | --- | --- | --- | --- |
| `.changeset/config.json` (fixed group) | adds `@automata/3d` | adds the twelve kits | C1 adds `@automata/editors` | — |
| root `package.json` (`boundaries`, `style`) | the `--forbid` lists | the `--forbid` lists | — | — |
| `tooling/release/tests/unit/release-list.test.ts`, `closed-beta-guard.test.ts` | yes | yes | C1 | — |
| `tooling/api-index` entry list, `tooling/api-report/src/core-packages.ts` | A4 | yes | — | — |
| `tooling/examples-runner/src/catalog.ts` (`UNPUBLISHED_EXTENSIONS`) | removes `@automata/3d` | empties it | — | — |
| `turbo.json` | A2, only if `build` needs an input | B10, the painter's `typecheck` entry | C1 (the page copy's `dependsOn`) | — |
| `pnpm-lock.yaml` | A2 | each B branch its own importers; B10 re-runs `pnpm install` | C1 | D1 (`@pixi/3d` and `pixi.js` entries only) |
| `docs/cheatsheet.md`, the agent API reference (generated) | A4 | B10 | — | — |

## Global constraints

- The Owner, 2026-11-12: "We ship with 3D, Editors, and Desktop Apps too"; "publish the painter"; "port to 0.1.0"; "yes,
  move to the public pixi3d package and lift the deploy rule". The coordinator's ruling, open to the Owner's correction:
  the editors ship as their own package and `@automata/tools` stays under its 3 MB pack budget.
- **Building is not changing (spec rule 1).** Parts A to C move no golden, recorded picture, md5 or hash. Every A, B and
  C task ends with the manifest check of task A1 and prints `manifest: unchanged`. A changed line is a stop: the build is
  wrong, not the picture.
- **No entry dropped or renamed.** A kit's `exports` keys after its task equal its keys before.
- **A published package never imports a private one.** Enforced by the shared build (`onlyImport` fails a build whose
  output imports a package that is not a declared dependency), by `release-list.test.ts` (a publishable package's
  `@automata/*` dependencies are all publishable; A5 adds the case) and by `--confine` for the painter.
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
`pnpm --filter @automata/figures test:unit` passes.

### Task A1: The baseline and the checksum manifest

**Files:**
- Create: `tooling/release/src/recorded-manifest.ts`, `tooling/release/tests/unit/recorded-manifest.test.ts`,
  `docs/superpowers/audits/2026-11-12-ship-3d/recorded.sha256`

**Interfaces:**
- Produces: `recordedManifest(root: string): string` (one line per file, `<sha256>  <path>`, sorted by path) over every
  tracked file matching `**/__goldens__/**`, `**/tests/fixtures/golden*/**`, `**/__screenshots__/**`, `**/*.md5` and
  `extensions/world-kit/**/*.png`; and the command `node tooling/release/src/recorded-manifest.ts --check <file>`, which
  prints `manifest: unchanged` or the changed lines and exits 1.

- [ ] **Step 1: The failing test.** `recorded-manifest.test.ts`: in a temporary folder with two fixture files under
  `a/__goldens__/`, `recordedManifest` returns two sorted lines; after one file's bytes change, `--check` against the first
  output exits 1 and names that path. Run `pnpm --filter @automata/release exec vitest run tests/unit/recorded-manifest.test.ts`.
  Expected: FAIL, the module does not exist.
- [ ] **Step 2:** Implement it with `git ls-files` and `node:crypto`. Test passes.
- [ ] **Step 3:** Write the manifest to `recorded.sha256` and commit it. Run the unit suites of `packages/3d` and the
  five kits that record pictures (`pnpm --filter @automata/3d --filter @automata/figures --filter @automata/character-kit
  --filter @automata/world-kit test:unit`), then `--check`: `manifest: unchanged`.
- [ ] **Step 4:** Gates; commit `test(release): a checksum manifest of every recorded picture and hash`.

**Done when:** the manifest is committed and `--check` prints `manifest: unchanged` on a clean tree.

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
  `sideEffects` contains `./dist/no-eval.js` and each source path it names today. Run
  `pnpm --filter @automata/3d exec vitest run --project unit tests/unit/package/manifest.test.ts`. Expected: FAIL,
  `publishConfig` is undefined.
- [ ] **Step 2:** Write `tsdown.config.ts` as `extensions/puzzle/tsdown.config.ts` does, with the 13 entries and
  `platform: 'browser'`. Edit `package.json` to satisfy the test; add `publishConfig.registry` and `access` as
  `@automata/puzzle` has them. Keep `"private": true` and version `0.0.0` (A5 flips them).
- [ ] **Step 3:** `pnpm install` (the lockfile changes in `packages/3d`'s importer only), then
  `pnpm --filter @automata/3d build`. Expected: `Build complete`, no `is located in node_modules` error. The survey's
  trial took 0.9 s.
- [ ] **Step 4: The side-effect files.** The no-eval install and the classic garment registration land in hashed chunks
  (`classic-kinds-*.js`, `pixi3d-uniform-sync-*.js` in the trial). Give each its own tsdown entry
  (`'side-effects/classic-kinds'`, `'side-effects/install-no-eval'`) so the names are stable, list both in `sideEffects`,
  and extend the test to assert that every `sideEffects` path under `./dist/` exists after a build (skip that case when
  `dist/` is absent).
- [ ] **Step 5:** Manifest check (`manifest: unchanged`), gates, commit `build(3d): @automata/3d builds to dist with the
  shared tsdown setup`.

**Done when:** `pnpm build` builds `@automata/3d`, and its 13 `.js` and `.d.ts` files exist.

### Task A3: `./testing` works from `dist`

**Files:**
- Create: `packages/3d/src/testing/fixture-root.ts`, `packages/3d/tests/unit/testing/fixture-root.test.ts`
- Modify: `packages/3d/src/testing/compile-fixture.ts:15`, `packages/3d/src/testing/motion-goldens.ts:46`,
  `packages/3d/tsdown.config.ts` (`copy`), `tooling/release/tests/unit/private-build.test.ts` (one of the two files `test:dist` runs with `AF_CHECK_DIST=1`)

**Interfaces:**
- Produces: `fixtureRoot(here: string): string`: given `import.meta.dirname`, returns `<package>/tests/fixtures` from
  `src/testing` and `<package>/dist/fixtures` from `dist`.

- [ ] **Step 1: The failing test.** `fixtureRoot('/p/src/testing')` is `/p/tests/fixtures`;
  `fixtureRoot('/p/dist')` is `/p/dist/fixtures`. FAIL: no module.
- [ ] **Step 2:** Implement; use it in the two files; copy `tests/fixtures` (only the folders those two files read) to
  `dist/fixtures` with `publishedBuild`'s `copy`.
- [ ] **Step 3: From the pack.** Add to `private-build.test.ts`, under its `AF_CHECK_DIST` switch, a case that imports the packed `@automata/3d/testing` in Node and
  reads `FIXTURE_ROOT`: it exists on disk. Run `pnpm build && pnpm --filter @automata/release test:dist`. Expected: PASS.
- [ ] **Step 4:** Manifest check, gates, commit `fix(3d): the testing entry finds its fixtures from a built package`.

**Done when:** the pack's `./testing` loads its fixtures outside the workspace.

### Task A4: Every export documented; the API report; the README

**Files:**
- Modify: `tooling/api-index/src/entry-points.ts` (or the list it reads), `tooling/api-report/src/core-packages.ts`,
  doc comments under `packages/3d/src`, `packages/3d/README.md`, generated `docs/cheatsheet.md`,
  `agents/automata/skills/automata-api/reference/api.md`, the API report's committed file

- [ ] **Step 1: Measure.** Add `@automata/3d` (13 entries) to the API index's packages, `pnpm build`,
  `pnpm api-index`. Expected: exit 1, a list of undocumented exports. Record the count in the log. This is the failing
  test.
- [ ] **Step 2:** Write a doc comment on each, saying what it is for and its units where it has any. Do not add to
  `undocumented-baseline.json`. `pnpm api-index`: exit 0.
- [ ] **Step 3:** Add `@automata/3d` to the API report; `pnpm api-report --update`; `pnpm api-index --write`.
- [ ] **Step 4: The README**, for a stranger: what the package is, `create-game --template 3d`, the 13 entries in a
  table with one line each, the peers (`pixi.js`, `@pixi/3d`), "import `@automata/3d/no-eval` first", a link to
  `docs/guides/3d.md`. `tooling/consumer-smoke/src/readme.ts` checks published READMEs: run its unit test.
- [ ] **Step 5:** Manifest check, gates, commit `docs(3d): every export documented; the API report and index take
  @automata/3d`.

**Done when:** `pnpm api-index` and `pnpm api-report` exit 0 with `@automata/3d` in both.

### Task A5: Public: the fixed group and the six guards

Each guard is changed test first. A guard goes only where its reason is gone.

**Files:**
- Modify: `packages/3d/package.json`, `.changeset/config.json`, root `package.json` (`boundaries`),
  `tooling/release/tests/unit/release-list.test.ts`, `closed-beta-guard.test.ts`,
  `tooling/examples-runner/src/catalog.ts` and its test, `packages/tools/src/shared/create-game/three-d-gate.ts` and
  its test, `create-game`'s help text and its test, `packages/tools/scripts/copy-editor.ts` (comment only),
  `docs/guides/3d.md`
- Create: `.changeset/ship-3d-package.md` (`@automata/3d` and `@automata/tools`, `patch`)

| Guard | Its reason today | After |
| --- | --- | --- |
| `release-list.test.ts`: `@automata/3d` is not publishable | not built | **inverted**: it is publishable; new case: every `@automata/*` dependency of a publishable package is publishable |
| `closed-beta-guard.test.ts` and `--forbid <published>:@pixi/3d,@automata/figures` | keeps 3D out of 2D packages | **kept for the 2D packages** (a design rule: 2D core stays free of 3D); `@automata/3d` is exempt from the `@pixi/3d` half and keeps the `@automata/figures` half. The test's comment says "2D packages carry no 3D", not "closed beta" |
| `--forbid packages/editor:@pixi/3d,@automata/editor-3d,@automata/3d` | the 2D page in `-tools` must stay 2D | **kept** |
| `copy-editor.ts` refuses a build with Pixi 3D | the same | **kept**; its comment loses "not published yet" |
| the `AF_BETA_3D` gate | `@automata/3d` not on npm | **removed**: `three-d-gate.ts` and `THREE_D_NOT_PUBLIC` are deleted; `--template 3d` is listed in help |
| the playground's `UNPUBLISHED_EXTENSIONS` | examples import unpublished packages | **`@automata/3d` leaves the set**; the five kits stay until B10 |

- [ ] **Step 1:** Invert `release-list.test.ts` and add the dependency case. FAIL: the package is private.
- [ ] **Step 2:** `packages/3d/package.json`: remove `"private"`, set the fixed group's version, description without
  "Not published yet". Add it to `.changeset/config.json`'s fixed group. Tests pass.
- [ ] **Step 3:** The gate: change `three-d-gate`'s test to expect `create-game --template 3d` to succeed with no
  environment variable outside a workspace, and the help test to list `3d`. FAIL. Delete the gate; tests pass. Check
  `PIXI_3D_SPEC` and the template's `pixi.js` equal the versions in `packages/3d/package.json` (add that assertion to
  `template-3d`'s test).
- [ ] **Step 4:** The boundaries and catalog rows of the table, each with its test.
- [ ] **Step 5:** The changeset; `pnpm changeset status` and `check-changesets` pass inside `pnpm check`.
- [ ] **Step 6:** Manifest check, gates (with the build, report and index steps), commit
  `feat(3d): @automata/3d is a public package; create-game offers the 3D template`.

**Done when:** `pnpm check` is green with `@automata/3d` publishable and no `AF_BETA_3D` left outside history
(`git grep AF_BETA_3D -- ':!docs/archive' ':!docs/superpowers' ':!docs/refactor'` prints nothing).

### Task A6: The 3D stranger's journey, ungated, with a size budget

**Files:**
- Modify: `tooling/consumer-smoke/tests/e2e/stranger-3d.test.ts`, `tooling/consumer-smoke/src/commands.ts` (`pack3d`
  goes: `packAll` now packs it), `tooling/consumer-smoke/src/run.ts`, `tooling/consumer-smoke/tests/unit/pack.test.ts`

- [ ] **Step 1: The failing test.** In `pack.test.ts`: the packed `@automata/3d` is at most `400 * 1024` bytes
  (`THREE_D_PACK_BUDGET_KB = 400`; the trial packed to 307,703). Beside `TOOLS_PACK_BUDGET_MB` in `run.ts`, add the same
  check to the smoke. FAIL until the constant and check exist.
- [ ] **Step 2:** Remove `test.skip`, the `AF_BETA_3D` environment and `pack3d` from the journey; rewrite its header
  comment to say what it proves. Replace the fixed `waitForTimeout` calls with waits on the page's readiness attribute
  where one exists (browser tests wait on readiness, never a sleep); keep the before-and-after screenshot comparison.
- [ ] **Step 3:** `pnpm build && pnpm --filter @automata/consumer-smoke exec playwright test tests/e2e/stranger-3d.test.ts
  --trace off`. Expected on a GPU runner: `1 passed`. In a session without a GPU the survey reached "build it" and the
  browser step did not finish: report the step reached and mark the last step **pending the Owner's runner**; do not
  tick this task until `1 passed` is seen.
- [ ] **Step 4:** Manifest check, gates, commit `test(consumer-smoke): the 3D stranger's journey runs on every run, from
  packs`. Open the draft pull request for Part A.

**Done when:** the journey passes to "walk Wick" with no gate, from packs.

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
(recipe step 4) are done and committed **before** the build configuration, as a commit of their own
(`refactor(<kit>): written types on every export`), with the failing check being the compiler's count from the survey
(world-kit 17, character-kit 16, retro-crisp 4, lcd-panel 2; the painter's 174 are task B3). The count must be 0 and
the kit's recorded files unmoved before step 1 starts.

### The kit recipe (every B task applies it to each kit it owns)

1. **The failing test:** `extensions/<kit>/tests/unit/package/manifest.test.ts`, as A2's: the `exports` keys equal the
   list the task gives; each has `publishConfig.exports` at `./dist/<name>`; `files` is `['dist']`; `scripts.build`
   set; every `@automata/*` runtime import is a `peerDependency` at `workspace:^` and a `devDependency` at
   `workspace:*` (as `@automata/puzzle`). Run it: FAIL, no `publishConfig`.
2. `tsdown.config.ts` through `publishedBuild`, `platform: 'browser'`. A kit with `.svelte` files builds as
   `@automata/debug` does (`svelte-package`, then tsdown, `tsconfig.package.json`).
3. `package.json` to satisfy the test. **`"private": true` and version `0.0.0` stay** (B10 flips them).
4. isolatedDeclarations on in `tsconfig.json` where it is off; write the types the compiler asks for. A written type
   must equal the inferred one: `pnpm typecheck` green, no cast added.
5. `pnpm install`; `pnpm --filter @automata/<kit> build`: `Build complete`, and no `onlyImport` error (that error is the
   check that the kit imports nothing it does not declare).
6. Every non-code file the survey lists for the kit: find how it is read (`git grep -n "<file name>" extensions/<kit>/src`).
   An `import … with { type: 'json' }` is bundled and needs nothing. A file read by path at runtime needs `copy` into
   `dist` and a test from the built file.
7. Doc comments: build, then `node tooling/api-index/src/cli.ts` with the kit temporarily added to the entry list
   **in the working tree only** (do not commit the list: B10 owns it). Document every export it names; revert the list.
8. The README: what it is, how to add it to a game by name, its entries, its peers.
9. Pack it (`pnpm pack --pack-destination <a temp folder>`), record the bytes in the log, and add to the kit's
   `manifest.test.ts` nothing about size (B10 adds the budgets, from these numbers, in the one shared place).
10. The kit's unit suite and, where the session has a GPU, its browser suite: the same pass counts as before the task.
    Manifest check: `manifest: unchanged`. Gates. One commit per kit: `build(<kit>): <kit> builds to dist`.

No task in the three parallel branches edits `.changeset/`, root `package.json`, `turbo.json`, `tooling/` or another
kit's folder.

### Task B1: `world-kit` (`claude/ship-3d-b-looks`)

**Files:** `extensions/world-kit/**` (`package.json`, `tsconfig.json`, new `tsdown.config.ts`, `src`, `README.md`, the
new test). Entries: the 3 keys in its `exports` today. 17 written types. Its 38 PNGs must not move.

### Task B2: `lcd-panel` and `retro-crisp` (`claude/ship-3d-b-looks`)

**Files:** `extensions/lcd-panel/**`, `extensions/retro-crisp/**`. 2 entries each; 2 and 4 written types. Their source
imports `@automata/3d` (and `framework` for retro-crisp); `content` and `framework` appear in tests only and stay
devDependencies.

### Task B3: The painter's written types (`claude/ship-3d-b-figures`)

**Files:** `extensions/figures/src/**`, `extensions/figures/tsconfig.json`

**Two other branches rewrite the painter; never at the same time as this task.**
- `claude/builders-fold-strict` (the two strict compiler flags over the painter, 43 files, not started) touches the
  same files. **Order: this task first, the strict flags after.** The written types are on the launch path and the
  strict flags are not, and a file with written export types is easier to make strict than the reverse. The strict
  session starts only after `claude/ship-3d-b-figures` has merged. If the coordinator would rather have one pass, the
  alternative is one run per folder that does both in each folder's commit; this plan does not take it, because it
  would put work that is not needed for launch in front of the build.
- `claude/painter-hands` is editing `paint-hands.ts` and `paint-hand-form.ts` now. **Those two files are done last**,
  in their own commit, after that branch has merged; if it has not merged when every other folder is done, stop and
  say so in the log (the flag cannot go on until they are typed).

- [ ] **Step 1:** `pnpm --filter @automata/figures exec tsc -p . --noEmit --isolatedDeclarations true | grep -c "error TS9"`.
  Expected: 174 (the survey). This is the failing check.
- [ ] **Step 2:** Write the types, one folder of `src/shared` per commit (`math`, `body`, `figure`, `paint`, `outfit`,
  `hair`, `motion`, `lighting`, `actors`, then `features/view`). After each: `pnpm --filter @automata/figures test:unit`
  and the manifest check. The painter's 21 recorded files must not move.
- [ ] **Step 3:** Turn the flag on in `tsconfig.json`; the count is 0; gates.

**Done when:** the painter type-checks with isolatedDeclarations on and its goldens are byte-identical.

### Task B4: The painter builds; its licence record (`claude/ship-3d-b-figures`)

The Owner: "publish the painter".

**Files:** `extensions/figures/**` (`package.json`, new `tsdown.config.ts`, `README.md`, new `LICENSE`, new
`PROVENANCE.md`; `tsconfig.types.json`, `types/` and the `prepare` script go)

- [ ] **Step 1:** The recipe, steps 1 to 5, entries `.`, `./kit`, `./view`. `exports` in the workspace keep pointing at
  source; the `types` conditions that point at `types/` go, because the build writes declarations. `pnpm typecheck` for
  the whole workspace stays green with `types/` deleted (leave `turbo.json`'s `@automata/figures#typecheck` entry
  alone: B10 removes it).
- [ ] **Step 2: What the folder carries.** Write `PROVENANCE.md`: the 8 JSON libraries are the project's own data; no
  image, font, sound or model is bundled; the goldens are not packed. Search again and record the commands and their
  empty output: `git grep -niE "last light|floorfifty|floor fifty" -- extensions/figures`. Check the history the same
  way: `git log --format=%s -- extensions/figures | grep -iE "last light|floorfifty"`. Anything found is a stop and a
  question for the Owner.
- [ ] **Step 3: The DUEL palette.** Record its author, source address and terms in `PROVENANCE.md`. If the session
  cannot establish them from a public page, write "not established" and list it under "For the Owner" in the log; B10
  does not make the painter public until that line is filled.
- [ ] **Step 4:** `LICENSE`: a copy of the root `LICENSE` (MIT), so the pack carries one; add it to `files`.
- [ ] **Step 5:** The README loses "It is private and unpublished" and "Whether this package is published is the
  Owner's decision"; it says the kit's door is the supported way in. Recipe steps 7 to 10.

**Done when:** the painter builds and packs with a `LICENSE`, and `PROVENANCE.md` has no open line but, at most, DUEL.

### Task B5: `character-kit` (`claude/ship-3d-b-figures`)

**Files:** `extensions/character-kit/**`. 2 entries, 16 written types. `@automata/figures` becomes a peer at
`workspace:^`. The door (`src/shared/figures/door.ts`) stays the only importer of the painter: `pnpm boundaries`
prints 0 findings. The kit's 5 recorded files must not move.

### Task B6: `places` and `sectors` (`claude/ship-3d-b-story`)

**Files:** `extensions/places/**`, `extensions/sectors/**`. `places`: 1 entry, peers `sim`. `sectors`: 5 entries, peers
`3d`, `framework`, `physics`, `places`, `sim`; one JSON file (recipe step 6). Both are sim code in part
(`extensions/sectors/src/shared/sim`, `extensions/places/src/shared`): add each kit's sim entries to `automata.simEntries`
as `@automata/puzzle` does, and the built output imports no `effect` (`grep -L effect dist/*.js` lists every file).

### Task B7: `nav` and `level-2d` (`claude/ship-3d-b-story`)

**Files:** `extensions/nav/**`, `extensions/level-2d/**`. `nav`: 3 entries, peers `content`, `framework`, `places`,
`sectors`, `sim`; one `.toml` (step 6). `level-2d`: 2 entries, peers `content`, `framework`, `places`, `sim`.

### Task B8: `systems` (`claude/ship-3d-b-story`)

**Files:** `extensions/systems/**`. 6 entries; peers `content`, `framework`, `nav`, `places`, `puzzle`, `sectors`,
`sim`; `.toml` and JSON files (step 6).

### Task B9: `narrative` and `cutscenes` (`claude/ship-3d-b-story`)

**Files:** `extensions/narrative/**`, `extensions/cutscenes/**`. Both have `.svelte` files: the Svelte build of recipe
step 2, with `svelte` as a peer. `narrative`: 7 entries, peers `content`, `framework`, `places`, `puzzle`, `sectors`,
`sim`; `.toml` and `.md` files. `cutscenes`: 8 entries, peers `3d`, `content`, `framework`, `sim`, `pixi.js`; a `.toml`.
`cutscenes`' tests import `sectors` and `puzzle`: devDependencies only.

### Task B10: The join: twelve kits public (`claude/ship-3d-b-join`)

Runs alone, after B-looks, B-figures and B-story have merged.

**Files:** the twelve `package.json` files (two lines each), `.changeset/config.json`, root `package.json`,
`turbo.json`, `tooling/release/tests/unit/release-list.test.ts`, `closed-beta-guard.test.ts`,
`tooling/api-index` entry list, `tooling/api-report/src/core-packages.ts`, `tooling/examples-runner/src/catalog.ts`,
`site/playground/src/playground-catalog.ts` and its test, `tooling/consumer-smoke/tests/unit/pack.test.ts`,
`pnpm-lock.yaml`, the generated API files; create `.changeset/ship-3d-kits.md`

- [ ] **Step 1: The failing tests.** `release-list.test.ts` expects the 25 publishable packages by name (13 today,
  `@automata/3d`, the twelve kits; C1 adds one more). `pack.test.ts` gets one budget per kit: the bytes each B task
  logged, plus a quarter, rounded up to the next 10 kB, written as named constants. The catalog test expects
  `UNPUBLISHED_EXTENSIONS` to be empty and the playground to offer the 3D examples. All FAIL.
- [ ] **Step 2:** Remove `"private"`, set the fixed group's version in the twelve; add them to the fixed group; the
  changeset (`patch`, the twelve names).
- [ ] **Step 3: The guards.** `--forbid …:@automata/figures` stays on every package but `character-kit`. The text "the
  figure builder is a private repository: nothing published may bundle either" goes from `closed-beta-guard.test.ts`;
  the rule it leaves is "only the character kit's door imports the painter", which `--confine` already enforces.
  `--forbid …:@pixi/3d` stays on the 2D packages and is not added to the 3D kits.
- [ ] **Step 4:** `turbo.json`: remove `@automata/figures#typecheck` and the generic `typecheck`'s dependence on it,
  if B4 left `types/` gone and `rm -rf extensions/figures/dist && pnpm typecheck` is green; otherwise leave it and say so.
- [ ] **Step 5:** API index and report take the twelve; `pnpm build`, `pnpm api-report --update`,
  `pnpm api-index --write`. `pnpm api-index` exits 0 with the baseline file unchanged.
- [ ] **Step 6: From packs.** `pnpm --filter @automata/release test:dist` and the consumer smoke
  (`pnpm --filter @automata/consumer-smoke smoke`): every pack installs outside
  the workspace with no `workspace:` range left.
- [ ] **Step 7:** Manifest check, gates, commit `feat: the 3D and story kits are public packages`. Draft pull request.

**Done when:** `pnpm check` and `pnpm build` are green with 25 publishable packages, and every budget passes.

---

## Part C: the editors reach a stranger (`claude/ship-3d-c-editors`)

Starts after B10 and after `claude/editor-journeys-green` has merged; it builds on that branch's fix (a maker who runs
`automata editor` before `pnpm dev` reaches Play) and does not redo it.

**Packaging, decided from the survey (section 6):** the published package is `@automata/editors`
(`extensions/editors`). It carries two built pages: the full suite (2D and 3D, built by `packages/editor-3d`) and the
content editors (its own). About 1.58 MB packed; budget **2 MB**. **The 2D suite stays in `@automata/tools`**
(2.58 MB packed, budget 3 MB), so a 2D game's install is what it is today and `automata editor` in a 2D game needs
nothing new. Moving it would save 0.56 MB in `-tools` and make every 2D maker install a second package for what works
today.

### Task C1: `@automata/editors` is a package of built pages

**Files:**
- Create: `extensions/editors/scripts/copy-full-suite.ts`, `extensions/editors/tests/unit/scripts/copy-full-suite.test.ts`,
  `extensions/editors/src/entries/pages.ts`, `.changeset/ship-editors.md`
- Modify: `extensions/editors/package.json`, `turbo.json`, `.changeset/config.json`,
  `tooling/release/tests/unit/release-list.test.ts`, `tooling/consumer-smoke/tests/unit/pack.test.ts`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: the pack's layout `dist/pages/suite-full/index.html`, `dist/pages/content/index.html`, and
  `dist/pages.js` exporting `pagePath(page: 'suite-full' | 'content'): string` (an absolute path, from
  `import.meta.dirname`). `exports`: `.` (types and import at `./dist/pages`) and `./package.json`.

- [ ] **Step 1: The failing test.** `copyFullSuite(editor3dDist, outDir)` copies `<editor3dDist>/suite` to
  `<outDir>/pages/suite-full`, and throws "There is no 3D editor build to copy. Build it first: pnpm --filter
  @automata/editor-3d build" when `index.html` is missing; it refuses a build that carries `@pixi/3d/extras` (the
  no-eval rule; reuse `findPixi3d`'s `extras` list by importing nothing from `-tools`' private paths: the function is
  exported from `@automata/tools/internal`, a devDependency of this build script). FAIL: no module.
- [ ] **Step 2:** Implement. The package's `build` becomes: its own page into `dist/pages/content`, then the copy, then
  tsdown for `pages.ts`. In `turbo.json` its `build` depends on `@automata/editor-3d#build`.
- [ ] **Step 3:** `package.json`: no runtime dependencies (pages are bundled; move every `@automata/*` it lists to
  `devDependencies`), `files: ['dist']`, not private, the fixed group's version; fixed group, release list (26
  packages), changeset.
- [ ] **Step 4: The budgets.** `pack.test.ts`: `@automata/editors` at most `2 * 1024 * 1024` bytes; `-tools` still
  under 3 MB. PASS with the measured bytes in the log.
- [ ] **Step 5:** Manifest check, gates, commit `feat(editors): the editors package carries the built pages`.

### Task C2: `automata editor` opens it; the refusal goes

**Files:**
- Modify: `packages/tools/src/features/editor/editor-command.ts` (the block at line 92 to 96), its dependencies
  object, `packages/tools/tests/unit/editor/editor-command.test.ts`, the editor list that picks the page

**Interfaces:**
- Consumes: `pagePath` from C1, resolved **from the game's folder** (`createRequire(join(root, 'package.json'))`), so
  the game's own installed version is used.
- Produces: `deps.editorsPage(root: string, page: 'suite-full' | 'content'): string | undefined` (undefined when the
  game has no `@automata/editors`).

- [ ] **Step 1: The failing tests.** (a) A 3D game with the package installed: exit 0, the server serves
  `suite-full`. (b) A 3D game without it: exit 2 and stderr is exactly
  `Error: This game needs the editors package to open the 3D editors. Add it: pnpm add -D @automata/editors\n`.
  (c) A 2D game without it: the 2D page from `-tools`, as today. (d) Any game with it gets the content editors offered.
  (e) The string "The 3D editors are not in this release yet." appears nowhere in `packages/tools/src`. FAIL on (a),
  (b), (d), (e).
- [ ] **Step 2:** Implement; `deps.inRepository` keeps its meaning (the repository's own builds).
- [ ] **Step 3:** Gates, changeset line in `ship-editors.md` for `@automata/tools`, commit
  `feat(tools): automata editor opens the 3D and content editors from the editors package`.

### Task C3: `create-game` adds it; the README; the hosted editor

**Files:** `packages/tools/src/shared/create-game/template-3d.ts` and its test, the 2D template's package writer and
its test, `extensions/editors/README.md` (new), `site/src` files that describe `/editor/app`, their tests

- [ ] **Step 1:** Test first: a game from `--template 3d` has `@automata/editors` in `devDependencies` at the
  framework's version; a 2D game does not (it can add it for the content editors; the README says how). Implement.
- [ ] **Step 2:** The README, for a stranger: what each of the seven editors changes, how to open them, what to install.
- [ ] **Step 3: The hosted editor.** Read what the site's page says `/editor/app` offers and what it serves (the 2D
  suite today). Make the two agree by changing the words to what is served, in the copy file and its test. Serving the
  full suite from the site is a deploy decision: list it under "For the Owner".
- [ ] **Step 4:** Gates, commit.

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
  is pending a GPU runner. Manifest check, gates, commit, draft pull request.

**Done when:** both journeys pass from packs and `-tools` and `@automata/editors` are inside their budgets.

---

## Part D: `@pixi/3d` 0.1.0, a pixel-reviewed port (`claude/ship-3d-d-pixi`)

The Owner: "port to 0.1.0". This is the one part where a recorded picture or hash may move, and only as below.

**What may move:** the recorded files of `packages/3d` (12), `extensions/figures` (21), `extensions/character-kit`
(5), `examples/3d` (3) and world-kit's 38 PNGs, and only where the cause is one of the changed areas in the survey's
section 7. **What may not:** any sim hash, any 2D golden, any md5 of content. A sim hash that moves is a defect in the
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
  `template.test.ts` is expected to fail in words if the default material template moved.
- [ ] **Step 3:** Commit the bump and the failure list (`build(deps): @pixi/3d 0.1.0`); nothing re-recorded yet.

### Task D2: The port, area by area

**Files:** `packages/3d/src/features/look/**`, `features/renderer/no-eval/**`, `shared/render/**`,
`features/camera/occluders/**`, `extensions/figures/src/features/view/**`, the kits' look sources

- [ ] One commit per area, in this order: materials and uniforms (the no-eval uniform sync, then the painter's cell
  template rebuilt from 0.1.0's own, as the beta.3 port did), lighting and the fog conversion, shadows, batching,
  passes and the render graph (world-kit's sky, lcd-panel, retro-crisp), scene (`Sprite3D`, the occluders), glTF. For
  each: the failing tests of D1 for that area, the fix, the tests green **without re-recording**. A test that can only
  pass by re-recording goes on the list for D3, with its before and after images. The no-eval proof (the bundle holds
  no `new Function` outside `./extras`) is re-run after the first area.

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
2. **The DUEL palette.** The exact question: "The painter's colours are the palette named DUEL
   (`extensions/figures/src/shared/paint/duel-ramps.ts`). Who made it, where was it taken from, and do its terms let us
   ship its colour values inside an MIT package on npm? If not, which palette replaces it?" The painter does not become
   public until this is answered (B4, step 3; B10).
3. **Run the 3D stranger's journey and the two editor journeys on a GPU runner** (A6, C4). This is a gate: the
   journey's last step, "play it and walk Wick", did not finish on a machine without a GPU, so A6 is not done until
   your runner prints `1 passed`.
4. **Look at Part D's sheets** and say which moved pictures are accepted (D3).
5. **Run cross-engine 3D parity** in Chromium, WebKit and Firefox on your runners (D4).
6. **The site's hosted editor:** whether `/editor/app` should serve the full suite (a deploy).
7. **Publish:** the npm organisation and the rename, `NPM_TOKEN`, the release approval. Nothing here publishes.
8. Correct the coordinator's ruling on the editors package if you want one install instead (it would take `-tools` to
   about 3.5 MB, over its budget).

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
