# 2D editors and website refactor: plan

> **For the agent building this:** work through the tasks in order with the superpowers `executing-plans` skill
> (`test-driven-development` for every code change, `verification-before-completion` before ticking a box), followed
> by hand: the plugin is not installed in cloud sessions. Steps use checkboxes (`- [ ]`). Tick a step only when its
> check has passed, in the same session, and update [progress.md](progress.md) at the end of every task (section
> "Tracking"). No subagents: the Owner allows none.

**Goal:** carry out the [spec](2026-11-06-2d-editors-and-site-spec.md): AF ready to ship with 2D alone. A stranger
finds the site, makes a 2D game with one command, installs it, checks and tests it, opens its level in a redesigned
editor that looks like the site, saves, plays the change, and publishes it, from packages on npmjs.org; the editors are
one feature-grouped package with real journeys; the website lives in this repository and builds from the current code;
the published command, the agent package and the docs describe today's framework.

**Architecture:** the gate (phase 1); the stranger's journey, written failing and then fixed (2); the published
command trimmed (3); behaviour-preserving editor moves (4); the level contract and the save loop (5, 6); shipping the
editor and a 2D-only suite (7, 8); the examples split (9); the site's move (10); the design system and the redesign
(11, 12); the editor journeys written once against the final screens (13); npmjs.org (14); CI for games, the agent
package and docs, the tooling diet (15 to 17); the site's rebuild (18 to 20) and the launch (21).

**Tech stack:** as the core slice: pnpm 10 + turbo 2.11, Node 24.21, TypeScript (root 7.0.2), Vitest 5 with browser
mode, Playwright 1.63, Svelte 5.57, PixiJS 8.22, Zod 4.6.6, Biome. The site: SvelteKit 2 with the static adapter.

**Sessions:** a session is refreshed after 90 minutes (the Owner's rule). Tasks 3.5, 4.2, 4.3, 4.5, 4.6, 10.1, 12.3,
12.4, 16.3, 17.3 and 18.5 do not fit one session and name their breaks (a task may span sessions and still counts once). A session ends by ticking its steps, updating `progress.md`, pushing, and writing a
two-line handoff in this file's execution log.

**Browsers in a cloud session:** only Chromium installs. A step that needs WebKit or Firefox says so; it is ticked
"Chromium here, WebKit/Firefox on the Owner's `pnpm ci:local` or hosted CI" and the progress row says which engines
ran. Playwright from a cloud session:
`NODE_PATH=$(/opt/node22/bin/npm root -g) /opt/node22/bin/node script.cjs` for throwaway scripts; the repository's
own Playwright for its configs.

**Changesets:** `patch` only before 1.0 (`check-changesets` fails `minor` and `major`), except the one `minor` of task
14.2 that makes the first public version 0.1.0. Only published packages get one (`-sim`, `-content`, `-tools`,
`automata`); the private `editor`, `editor-3d` and `site` get none.

**Pull requests:** each phase is a draft PR stacked on the one before (the first on this plan's branch), marked ready
once its checks pass locally, so the gated jobs that skip drafts run on its head. The agent may merge its own PR once
every check, parity included, is green on the head (AGENTS.md, Owner 2026-10-30).

**Code standard:** every task's code meets spec section 17 (minimal, elegant, well documented, not over-engineered);
tasks 3.5, 4.6, 17.3 and 18.5 are the measured refactor passes for the code the moves do not rewrite.

**Decisions:** D1 to D8 (the editors and website audit) and D9 to D17 (the [rest-of-AF audit](2026-11-06-2d-ship-rest-audit.md))
were all taken as recommended by the Owner on 2026-11-06 ("Go with all recommendations", twice). D8's and D17's actions
are the Owner's and sit in phase 21; task 14.1 waits only on the npm organisation's name and is not in the stack's
line: it is done as its own PR whenever the name arrives, and no later phase waits for it.

**Reviewed:** the [plan audit](2026-11-06-2d-editors-and-site-plan-audit.md) (stage 3, 2026-11-06) checked this plan and
the spec against the audits and the code; its fixes are in both. Accepted under the Owner's standing rule ("Auto accept
all spec and plans", 2026-10-30; "everything is auto approved and accepted", 2026-10-31).

**Command lines used below** (checked against the code): the module mover is
`node tooling/codemods/src/move-modules-cli.ts --map <map> [--dry-run] [--surface]`; the test mover is
`node tooling/codemods/src/cli.ts <package> --environment node|jsdom [--keep-qualifier <q>] [--dry-run]`.

**Copy:** every user-facing string a task changes goes in `docs/refactor/copy.md` (sections "Editor" and "Site") in
the same commit, old and new, and passes the four questions of the core spec's section 8.

---

## Tracking

`docs/refactor/progress.md` holds the stage table for each slice. During stage 4 (build) it also holds this table, one
row per task, and the build's percentage is `done tasks / 63`:

```markdown
### Build: 0% (0 of 63 tasks)

| Task | Phase | Status | PR |
|---|---|---|---|
| 1.1 The editors in the 2D gate | 1 | Not started | |
...
```

At the end of each task: set its row to "Done, <date>" with the engines that ran, recompute the build percentage and
the overall percentage (`stages done / 18`, counting the build as done only at 63 of 63), and commit the change with
the task.

---

## Phase 1: The 2D gate sees the 2D editors (one PR, `claude/refactor-ed-gate`)

### Task 1.1: The editors in the 2D gate

**Files:**
- Modify: `package.json` (`test:unit:core` → `test:unit:2d`, `test:browser:core` → `test:browser:2d`,
  `test:browser:affected`, the `:3d` scripts, a new `test:journeys:3d`, `check`, `ci:local`), `.github/workflows/ci.yml`
  (script names), `packages/editor-kit/package.json` (`test:browser` runs `layout` and `journeys`),
  `packages/editor-2d/package.json` (`test:browser` runs `browsers`, `layout`, `canvas` and `journeys`), `docs/status.md`,
  `AGENTS.md` (the gate lines)

  Today the editors' journeys run only through the root `test:journeys` in `3d-and-editors.yml` (ci.yml never runs
  it), and `editor-2d`'s canvas project (`test:canvas`) runs in no workflow at all. Folding both into the packages'
  `test:browser` puts them under ci.yml's parity job, which already installs all three engines.
- Test: `tooling/repo-hygiene/tests/unit/gate-scripts.test.ts` (create)

- [ ] **Step 1: Write the failing test.** It reads the root `package.json` and asserts: `test:unit:2d` has no filter
  that excludes `editor-kit` or `editor-2d`, excludes `./packages/editor-3d` and `./packages/editor-suite` (it holds 3D
  until phase 8), and `check` calls `test:unit:2d`. Run `pnpm --filter @mcthaydt/repo-hygiene exec vitest run
  tests/unit/gate-scripts.test.ts` → fails on the old script name.
- [ ] **Step 2: Rename and re-filter the scripts.** `--filter='!./packages/editor-3d' --filter='!./packages/editor-suite'`
  in place of `--filter='!./packages/editor-*'`; the `:3d` scripts filter `./packages/editor-3d` and
  `./packages/editor-suite`. Update every caller (`grep -rn "unit:core\|browser:core" .github package.json docs AGENTS.md`).
- [ ] **Step 3: Run the new gate.** `pnpm check` → passes, now including `editor-kit` (1,373) and `editor-2d` (1,552)
  unit and DOM tests; record the counts. `pnpm test:browser:2d` in Chromium (set `--browser.instances` through the
  preset's `AF_BROWSERS=chromium` if the editor configs honour it; otherwise a throwaway config, deleted after) → the
  editor's layout and canvas pass (252 + 6 skipped, the audit's numbers). WebKit and Firefox: the Owner's `ci:local`.
- [ ] **Step 4: Commit.** `ci(gate): run the 2D editors' tests in the 2D gate`

### Task 1.2: One workflow per dimension

**Files:**
- Rename: `.github/workflows/3d-and-editors.yml` → `3d.yml`
- Modify: `3d.yml` (paths and job names: `editor-3d`, `editor-suite`, `render-pixi3d`, `figures`, `sector-format`,
  `base-3d`, the 3D examples), `ci.yml` (its header comment), `docs/status.md`

- [ ] **Step 1:** Rename the workflow and drop `editor-kit` and `editor-2d` from its jobs; keep `packages/**` in its
  paths (a core change can break 3D) but name the 2D editor folders in nothing. Its `pnpm test:journeys` becomes
  `pnpm test:journeys:3d` (filtered like the other `:3d` scripts), or the 2D editors' journeys would run twice.
- [ ] **Step 2:** `pnpm lint:actions` needs Docker: if it is not available, run `node -e` YAML parse on both files and
  note "actionlint: the Owner's" in the execution log.
- [ ] **Step 3: Commit.** `ci: the 3D workflow holds only 3D; the 2D editors are in the 2D gate`

---

## Phase 2: A stranger can make a game (one PR, `claude/refactor-new-game`)

The journey is written first and fails; the tasks after it make it pass; the PR merges only when it does (spec 16.1).

### Task 2.1: The stranger's journey

**Files:**
- Create: `tooling/consumer-smoke/src/stranger.ts` (the steps), `tooling/consumer-smoke/tests/e2e/stranger.test.ts`
  (the journey), `tooling/consumer-smoke/playwright.config.ts` (`defineJourneys`, one Chromium project)
- Modify: `tooling/consumer-smoke/package.json` (`test:e2e`), `.github/workflows/ci.yml` (`e2e-2d` runs it when
  `packages/**` or `tooling/consumer-smoke/**` change), `turbo.json` (`test:e2e` depends on the published packages' builds)
- Test: `tooling/consumer-smoke/tests/unit/stranger.test.ts` (the overrides block it writes, the temp folder is outside
  the workspace: no `pnpm-workspace.yaml` above it)

- [ ] **Step 1: Unit tests first** for the two pieces of logic: `packOverrides(packs)` returns a `pnpm.overrides`
  object naming each pack by absolute `file:` path; `strangerFolder()` makes a folder under `os.tmpdir()` and refuses one
  inside a workspace. Run → fail (no file). Implement → pass.
- [ ] **Step 2: The journey.** The six steps of spec 16.1, each a `test.step` with a plain name ("make a game", "install
  it", "check it", "test it", "play it in a browser", "make the itch.io zip"), each command's output attached on
  failure.
- [ ] **Step 3: See it fail for the right reason.** Run in Chromium → fails at "install it" with "Failed to resolve
  @mcthaydt/automata-tools@workspace:*" (N1). Record the first-attempt output in the execution log.
- [ ] **Step 4: Commit** (the PR stays red until 2.4). `test(create-game): a stranger's journey from an empty folder to an itch.io zip`

### Task 2.2: A new game installs

**Files:**
- Modify: `packages/tools/src/shared/create-game/{create-game.ts,create-game-targets.ts}`,
  `packages/tools/src/app/cli.ts` (`--link-workspace`), `packages/tools/tests/e2e/serve-new-game.ts` (uses
  `--link-workspace`, no hand-made links), `docs/guides/publish-to-ruken.md` (no `@ruken/sdk` line)
- Test: `packages/tools/tests/unit/shared/create-game/{create-game.test.ts,create-game-targets.test.ts}`

- [ ] **Step 1: Failing tests.** The written `package.json` asks for `^<running -tools version>` for each AF package;
  `--link-workspace` writes `workspace:*`; no target adds `@ruken/sdk`; with no `--targets` the game's targets are `web`
  and `itch`; `--targets web,itch,tauri,ruken` still works.
- [ ] **Step 2:** Implement. The version comes from `-tools`' own `package.json` (read once at start).
- [ ] **Step 3:** The journey passes "install it" and fails at "check it" (N3). Commit.
  `fix(create-game): a new game installs outside the repository, with web and itch by default`

### Task 2.3: A new game passes its own check, in the feature layout

**Files:**
- Modify: `packages/tools/src/shared/create-game/create-game.ts` (the template files),
  `packages/tools/src/shared/check/check-steps.ts` (layouts: feature only, plus `games/base-3d` by name; the boundaries
  step resolves the checker from `-tools` itself, phase 3 folds it in; until then `-tools` depends on
  `@mcthaydt/automata-check-boundaries`), `packages/tools/package.json`
- Test: `packages/tools/tests/unit/shared/create-game/template.test.ts`, `packages/tools/tests/unit/shared/check/check-steps.test.ts`

- [ ] **Step 1: Failing tests.** The template writes `src/app/game.ts`, `src/features/square/{square.component.ts,
  move.command.ts,move.system.ts,square.plugin.ts}`, `src/shared/`, `main.ts`, `tests/unit/square/square-move.test.ts`,
  `vitest` in devDependencies and `test` and `check` scripts; `ship.config.ts` declares `gamepad` with the pad bindings;
  `automata check` refuses a `src/sim/` layout with "Put game code in src/features/<name>/ (see the guide)." and accepts
  role files only under `games/base-3d`.
- [ ] **Step 2:** Implement. The template's test runs in the repository too (`pnpm --filter` on a generated fixture in
  `tests/fixtures/new-game/`, regenerated by a script and compared, so it cannot drift).
- [ ] **Step 3:** The journey passes "check it" and "test it". Commit.
  `feat(create-game): a new game has a test, passes its check and uses the feature layout`

### Task 2.4: The rest of the path

**Files:**
- Modify: `packages/tools/src/shared/create-game/create-game.ts` (README: the site's guides, the one command),
  `packages/tools/README.md` (`pnpm dlx … create-game` first)
- Test: the template test (no link into the repository; the README's first command)

- [ ] **Step 1:** Failing test, then the change (N5, N7). Copy rows in `copy.md`.
- [ ] **Step 2:** The whole journey passes in Chromium: play, then the itch.io zip. `pnpm check` passes. The old
  `create-game` journey's hand-made links are gone (N6). Changeset `patch` for `-tools`. Mark the PR ready.
  `docs(create-game): one command to start, guides on the site`

---

## Phase 3: The published command (one PR, `claude/refactor-tools-surface`)

### Task 3.1: What leaves

**Files:**
- Delete: `packages/tools/src/shared/ship/remote/` (`test-remote`), `packages/tools/src/shared/ship/targets/ruken/deploy-dev.ts`
  (and `shared/ship/deploy/build-id.ts` if nothing else imports it), `packages/tools/deploy/`,
  `packages/tools/src/features/add/`, `packages/tools/src/app/{ship-alias-bin.ts,ship-alias.ts}`, their tests,
  `game-release.yml`'s `dev-host` job; the `deployDev`/`testRemote` branches in `shared/ship/{cli-args.ts,errors.ts}`,
  `prepare/prepare-mode.ts`, `config/ship-config.ts` and `app/ship-cli.ts`
- Create (only if the Owner wants it, else skip): `tooling/repo-scripts/src/ci-remote.ts` (`pnpm ci:remote`)
- Modify: `packages/tools/src/app/cli.ts`, `packages/tools/package.json` (`bin`), `packages/tools/tsdown.config.ts`,
  `packages/tools/README.md`

- [ ] **Step 1: Failing test:** `automata --help`'s commands are `create-game`, `check`, `build`, `editor`, `ship`;
  `automata add` and `automata ship test-remote` and `deploy-dev` print "Unknown command" and the help.
- [ ] **Step 2:** Delete; `pnpm knip` finds nothing left behind. Tag the last commit with the deleted code in the
  execution log (git keeps it; the Owner pushes tags). Commit. `refactor(tools): the command holds what a game author needs`

### Task 3.2: The target is always named

**Files:**
- Modify: `packages/tools/src/shared/ship/{cli-args.ts,prepare/prepare-build.ts,publish/publish-build.ts}`, create
  `packages/tools/src/shared/ship/targets/web/prepare-web.ts` (beside `targets/itch` and `targets/tauri`)
- Test: `packages/tools/tests/unit/shared/ship/{ship-args.test.ts,targets/prepare-web.test.ts}`

- [ ] **Step 1: Failing tests.** `ship prepare` with no `--target` exits 2 with "Choose a target: --target web, itch,
  tauri or ruken."; `--target web` builds and runs the public scans (secrets, data URLs, `findPixi3d` from
  `prepare/pixi3d-markers.ts`, no-eval) and writes `dist/`; `--private`'s help text is spec 16.2's.
- [ ] **Step 2:** Implement. Commit. `feat(ship): name the target every time; web has a prepare step`

### Task 3.3: A small root entry, and `check-boundaries` folded in

**Files:**
- Modify: `packages/tools/src/entries/index.ts` (only `defineShipConfig` and its types), create
  `packages/tools/src/entries/internal.ts` (what the repository's tooling imports; in `exports`, not in
  `publishConfig.exports`); every importer of a removed name (`grep -rn "@mcthaydt/automata-tools'" tooling games examples`:
  today `rukenHeaders` in both games' `vite.config.ts`, `checkManifest`, `inputsProblems` and `rukenToml` in both games'
  ship-config tests, `examples-runner`'s playground and preview headers). `./e2e` (17 names: the input matrix and fake
  pad, used only by `examples/`) leaves `publishConfig.exports` too and stays a workspace entry. The consumer smoke's
  fixtures (`fixtures/types.ts`, `node-check.mjs`) import the packed package, which has no `./internal`: they check the
  published surface only
- Move: `tooling/check-boundaries/src` → `packages/tools/src/features/boundaries/`, its tests to `packages/tools/tests/unit/boundaries/`
- Modify: `packages/tools/package.json` (`bin.automata-check-boundaries`), root `package.json` (`boundaries` calls it),
  `.changeset/config.json`, `tooling/release/src/*` (four published packages), `tooling/consumer-smoke`, API reports
- Delete: `tooling/check-boundaries`

- [ ] **Step 1: Failing test:** the API report for `-tools` lists `defineShipConfig` and its types only; the boundaries
  step of `automata check` runs with no `@mcthaydt/automata-check-boundaries` installed (the journey proves it).
- [ ] **Step 2:** Move and trim. `pnpm build`, `pnpm api-report --update`, `pnpm agent-skills --write`, `pnpm cheatsheet`.
  Changeset `patch` for `-tools`. `pnpm check` passes. Commit. `refactor(tools): export the ship config only; boundaries inside tools`

### Task 3.4: Help text

**Files:**
- Modify: `packages/tools/src/app/cli.ts` (`USAGE`), every command's usage text
- Test: `packages/tools/tests/unit/app/help.test.ts`

- [ ] **Step 1: Failing test:** `automata --help` is at most eight lines and names the four steps; no help text holds
  `D-1`, `M<n>`, `__AUTOMATA_DEBUG__`, "exit 0", `ruken.toml` on the first screen or a package name.
- [ ] **Step 2:** Rewrite (Y1, Y2); copy rows. The stranger's journey still passes. Commit.
  `docs(tools): help a first-time author can read`

### Task 3.5: The code refactor of `-tools` (same PR)

**Files:** `packages/tools/src/**` (create-game, check, ship, the editor command), their tests, `packages/tools/README.md`

- [x] **Step 1: The read.** Run spec 17.3's checks over `packages/tools/src`; write the findings list in the execution
  log (each with file and line), before changing anything. Record unit test counts.
- [x] **Step 2: Fix, one concern per commit:** remove what is unused, fold single-implementation layers and forwarding
  modules, merge duplicates, split files over 300 lines by responsibility, add header comments and the missing whys.
  Effect stays where it runs a step or a process (law 5); a function that wraps a pure computation in Effect only to
  call it from Effect becomes plain.
- [x] **Step 3 (Chromium; PR ready once the Owner's runs are in):** Counts equal (or lower only by listed dead code); the stranger's journey passes; `pnpm check`.
  Mark the PR ready. `refactor(tools): minimal, documented internals`

---

## Phase 4: One editor package (three PRs)

### Task 4.1: The move map and the package skeleton (PR `claude/refactor-ed-package`)

**Files:**
- Create: `docs/refactor/move-map-editor.json`, `packages/editor/{package.json,tsconfig.json,vite.config.ts,vitest.config.ts,README.md}`,
  `packages/editor/src/entries/*.ts` (empty re-exports, filled in 4.2)
- Modify: `tooling/codemods/src/move-modules.ts` (only if the map needs a feature it lacks), `knip.json`

- [x] **Step 1: Write the map.** One JSON object, old path → new path, for every file in `packages/editor-kit/src`,
  `packages/editor-2d/src` and `packages/editor-suite/src`, generated by a throwaway script from section 3.3 of the
  spec's table and checked by hand:

  | From | To |
  |---|---|
  | `editor-kit/src/<area>/` (commands, core, documents, fields, gestures, history, keymap, ports, selection, shell, storage, tokens, widgets, dialogs, home) | `editor/src/shared/kit/<area>/` |
  | `editor-kit/src/{tokens.css,fonts.css}` | `editor/src/shared/kit/` |
  | `editor-kit/src/journeys/`, `editor-2d/src/journeys/` | tests (task 4.3) |
  | `editor-kit/src/index.ts`, `editor-2d/src/index.ts`, the `vitest-setup.ts` files | `entries/kit.ts` and `tests/fixtures/setup.ts`; `editor-2d/src/index.ts` is not carried over (S3) |
  | `editor-kit/scripts/{generate-tokens.ts,remove-profiles.ts}` | `editor/scripts/` |
  | `editor-2d/src/{model,canvas,tiles,profiles}/` | `editor/src/shared/level-2d/{model,canvas,tiles,profiles}/` |
  | `editor-2d/src/app/export/write-folder.ts` | `editor/src/shared/kit/storage/write-folder.ts` (Save and Share both use it, spec 6.2) |
  | `editor-2d/src/app/{boot.ts,App.svelte,editor-app*.ts,level-editor.ts,profiles.ts,read-document.ts,project-list.ts,tile-sprite.ts}`, `main.ts`, `main.css` | `editor/src/app/editor-2d/` |
  | `editor-2d/src/app/home/` | `editor/src/features/home/` |
  | `editor-2d/src/app/{document,views}/` | `editor/src/features/document/` |
  | `editor-2d/src/app/{level,canvas}/` | `editor/src/features/level/` |
  | `editor-2d/src/app/world/` → `features/map/`; `tilesets/` → `features/tiles/`; `entities/` → `features/characters/`; `checks/` → `features/problems/`; `export/` → `features/share/` | |
  | `editor-2d/src/suite/`, `editor-suite/src/{shell,node,shims,editors/tuner}/` | `editor/src/features/suite/{levels-2d,shell,node,shims,tuner}/` |
  | `editor-suite/src/core/{editors.schema,editor-list,glob,write-path,workspace-policy}.ts` | `editor/src/shared/editor-list/` (what `-tools` and `automata check` read) |
  | the rest of `editor-suite/src/core/` (ask-session, change-set-journal, interchange, pills-model, review-model, reopened-gates, ship-draft, text-diff) | `editor/src/features/suite/core/` (the suite's own logic, E6) |
  | `editor-suite/src/main.ts`, `main.css` | `editor/src/app/suite/` (rewritten to Levels 2D and the Tuner only in task 4.2 step 4: it may not import `editor-3d`) |
  | `editor-suite/src/editors/studio/` | `editor-3d/src/ui/suite/studio/` |
  | `*/src/testing/`, `editor-kit/src/ports/testing/` | `editor/src/testing/` (names deduplicated: `memory-workspace.ts` is in `editor-2d/src/testing/` and the kit's `ports/testing/`) |
  | `editor-kit/scripts/generate-tokens.ts`, `docs/design/editor-kit/tokens.json` | `editor/scripts/generate-tokens.ts`, `editor/src/shared/kit/tokens/tokens.json` |

  Tests are mapped in task 4.3, not here.
- [x] **Step 2: Dry run.** `node tooling/codemods/src/move-modules-cli.ts --map docs/refactor/move-map-editor.json
  --dry-run --surface` → expected: every source file mapped, none unmapped, no two files to one path, and the surface
  report lists what `editor-3d` (and the moved Studio: `../../../core`, `shell/boot`, `shell/create-suite`) imports, so
  the entries of 4.2 step 3 export exactly that. Fix the map until it is clean.
- [x] **Step 3: The skeleton.** `package.json` (`@mcthaydt/automata-editor`, private, `imports: {"#src/*": "./src/*"}`,
  the entries of spec section 3.2, the union of the three packages' dependencies less `@pixi/3d`, `figures`,
  `render-pixi3d`, `editor-3d`), one `vitest.config.ts` calling `defineTests` (filled in 4.3), `tsconfig.json` including
  `src`, `tests` and configs, the root TypeScript.
- [x] **Step 4: Commit.** `refactor(editor): the move map and the editor package skeleton`

### Task 4.2: Merge the three packages (same PR)

**Files:**
- Move: everything in the map
- Delete: `packages/editor-kit`, `packages/editor-2d`, `packages/editor-suite` (their `package.json`, configs,
  `biome.json`, `svelte.config.js`, `LICENSE`)
- Modify: `packages/editor-3d` (imports, `package.json` dependencies, a `suite.html` and `src/ui/suite/suite-main.ts`),
  `packages/tools/src/features/editor/editor-policy.ts`, `packages/tools/package.json`, `packages/tools/tsdown.config.ts`
  (comment), root `package.json` (filters), `pnpm-lock.yaml`

- [x] **Step 1: Count before.** Run `pnpm test:unit` in the three packages and `editor-3d`; record the four counts in
  the execution log (audit: 1,373, 1,552, 423).
- [x] **Step 2: Apply the map.** `node tooling/codemods/src/move-modules-cli.ts --map docs/refactor/move-map-editor.json`, then
  the specifier codemod with an entry table: `@mcthaydt/automata-editor-kit` → `@mcthaydt/automata-editor/kit`, each kit
  subpath → `/kit/<subpath>`, `@mcthaydt/automata-editor-2d/suite` and `@mcthaydt/automata-editor-suite/core` →
  `@mcthaydt/automata-editor/suite` and `/editor-list`. Inside `packages/editor`, cross-area imports that were
  package names become relative paths.
- [x] **Step 3: Fill the entries.** Each `src/entries/*.ts` re-exports what the old entry exported. `./level-export`
  re-exports `openProject` and `exportContent` (the names `content-export.ts` and `open-project.ts` have). Do not
  carry `editor-2d/src/index.ts` or the suite's `node/index.ts` over (S3).
- [x] **Step 4: The Studio moves to `editor-3d`; the editor's suite page is 2D only.** `src/ui/suite/studio/` gets the
  Studio (and `Suite.studio.dom.test.ts`, `testing/studio-fixtures.ts`); `packages/editor-3d/suite.html` and
  `src/ui/suite/suite-main.ts` hold today's `editor-suite/src/main.ts` (Tuner, Levels 2D, Levels 3D, Studio, sample
  ports) importing `createSuite`, the boot (`shell/boot.ts`), `createLevels2d`, `createTuner` and the core names the
  surface report found from `@mcthaydt/automata-editor/suite`. `packages/editor/src/app/suite/main.ts` registers Levels
  2D and the Tuner only: today's file imports `@mcthaydt/automata-editor-3d/suite` and the Studio, and `editor` may not
  import `editor-3d` (it would be a dependency cycle, and 4.4's `--forbid` refuses it).
  `editor-3d`'s Vite config builds `suite.html` into `dist/suite/`. `automata editor --app suite` serves
  `packages/editor-3d/dist/suite` (`liveEditorDeps.builtApp`, test updated).
- [x] **Step 5: Make it build.** `pnpm install`, `pnpm --filter @mcthaydt/automata-editor typecheck`, `... build`
  (the 2D editor at `dist/2d/`, the suite at `dist/suite/`: two Vite inputs), `pnpm --filter
  @mcthaydt/automata-editor-3d typecheck build`, `pnpm --filter @mcthaydt/automata-tools build`. If `svelte-check`
  refuses TypeScript 7, pin 6.0.3 in this package and write why in the execution log.

  **Session break here** if 90 minutes have passed: push, log the handoff ("4.2 step 5 done: builds; tests not yet
  moved").
- [x] **Step 6: The 2D architecture test.** `editor-2d`'s own boundary test (`architecture.test.ts` with
  `testing/architecture.ts`: the pure core, profile isolation, no profile ids in generic areas, import cycles) reads paths
  relative to `src/` (`model/`, `tiles/`, `canvas/draw/`, `app`). After the move those prefixes match nothing and the
  test would pass on an empty tree. Remap them to `shared/level-2d/...` and `app/editor-2d/`, and add one assertion that
  every rule's prefix matches at least one file. (It runs under the preset's Svelte plugin and `browser` condition:
  checked in the plan audit, 23 of 23 pass.)
- [x] **Step 7: Count after.** Run the old tests where they now sit (still beside the code; 4.3 moves them): the
  editor's unit and DOM total equals the three packages' sum minus the Studio's tests, which now count in `editor-3d`
  (its count rises by the same number). Any other difference is a bug: find it before going on.
- [x] **Step 8: Commit.** `refactor(editor): merge editor-kit, editor-2d and editor-suite into one editor package`

### Task 4.3: Tests into `tests/` (same PR)

**Files:**
- Modify: `tooling/codemods/src/move-tests.ts` (the editor's suffix table), `tooling/codemods/tests/unit/move-tests.test.ts`,
  `tooling/vitest-preset/src/index.ts` (named browser projects), `tooling/vitest-preset/tests/unit/*.test.ts`,
  `packages/editor/vitest.config.ts`, `packages/editor/package.json` (scripts)
- Move: every `*.test.ts` and test host under `packages/editor/src`

- [x] **Step 1: The preset, test first.** A failing preset test: `defineTests({ browserProjects: [{ name: 'parity',
  folder: 'parity', engines: ['chromium','webkit','firefox'] }, { name: 'layout', folder: 'layout', engines:
  ['chromium','webkit','firefox'] }, { name: 'canvas', folder: 'canvas', engines: ['chromium','webkit'] }, { name:
  'journeys', folder: 'journeys', engines: ['webkit','chromium'], instance: journeyInstance }] })` returns `unit` plus
  four browser projects whose `include` is `tests/browser/<folder>/**/*.test.ts`. `parity` is today's `browsers` project
  (the auto-tile goldens, `*.parity.test.ts`), which also runs in Node through `alsoInNode: ['tests/browser/parity/**/*.test.ts']`.
  Without the option, the single `browser` project is unchanged (existing tests stay green). Then the change.
- [x] **Step 2: The suffix table, test first.** In `move-tests`, the editor's suffixes map to folders: `.dom` →
  `tests/unit/<feature>/` with `// @vitest-environment jsdom` added as the first line; `.layout` →
  `tests/browser/layout/`; `.canvas` → `tests/browser/canvas/`; `.journey` → `tests/browser/journeys/`; `.parity` →
  `tests/browser/parity/` (the Node run comes from `alsoInNode`, step 1); the one-offs (`.codec-bug`, `.ship.dom`, `.refusal`,
  ...) → `tests/unit/<feature>/` with the suffix folded into the name (`codec-bug.test.ts`). `*.test.svelte` and the
  fake canvases → `tests/fixtures/`. A fixture test per rule.
- [x] **Step 3: Run it.** `node tooling/codemods/src/cli.ts packages/editor --environment node --dry-run`, check,
  apply (without `--dry-run`). Imports of the code under test become `#src/...`.

  **Session break here** if needed (log: "4.3 step 3 applied; configs not yet switched").
- [x] **Step 4: Switch the config.** `vitest.config.ts` is one `defineTests` call (`environment: 'node'`, `svelte: true`,
  `plugins: [svelteTesting()]`, `setupFiles`, `css: true`, the four browser projects). Scripts: `test:unit`
  (`--project unit`), `test:browser` (the four browser projects).
- [x] **Step 5: Counts equal.** `pnpm --filter @mcthaydt/automata-editor test:unit` → the same count as 4.2 step 7.
  Chromium browser projects → 252 pass, 6 skipped (plus the kit's layout tests, which the audit could not run: record
  the number). `pnpm style --test-imports packages/editor` → 0 findings.
- [x] **Step 6: Gate lines.** Root `package.json`: `test:unit:2d` and `test:browser:2d` filter `./packages/editor`
  in and `./packages/editor-3d` out. `pnpm check` passes.
- [x] **Step 7: Commit, mark the PR ready.** `refactor(editor): tests in tests/, one suffix, the preset's browser projects`

### Task 4.4: Feature folders and the boundaries rules (PR `claude/refactor-ed-features`)

**Files:**
- Modify: `packages/tools/src/features/boundaries/{cli.ts,features.ts}` (where task 3.3 moved `check-boundaries`),
  create `packages/tools/src/features/boundaries/forbid.ts`, `packages/tools/tests/unit/boundaries/forbid.test.ts`; root
  `package.json` (`boundaries`, `style`), files under `packages/editor/src/features` and `src/app` that the rule flags

- [x] **Step 1: `--forbid`, test first.** A fixture package importing `@pixi/3d` (value and type import) fails with
  `packages/x/src/a.ts:1:1 imports "@pixi/3d", which packages/x may not use.`; a clean one passes. Then the rule.
- [x] **Step 2: A shared-kit rule, test first.** `--features` learns an optional `--shared-island kit` so
  `shared/kit/` may not import `shared/level-2d/` or `shared/editor-list/`. Fixture test, then the rule.
- [x] **Step 3: Run them.** Add to `boundaries`: `--features packages/editor --shared-island kit` and
  `--forbid packages/editor:@pixi/3d,@mcthaydt/automata-editor-3d,@mcthaydt/automata-render-pixi3d,@mcthaydt/automata-figures`.
  Record the findings count.
- [x] **Step 4: Fix each finding** by passing the function in from `app/editor-2d/` or `app/suite/` (spec section
  3.3), or moving a file that two features use to `shared/`. No behaviour change: unit counts stay equal after each
  fix. Re-run until 0.
- [x] **Step 5: Commit.** `refactor(editor): features import only themselves and shared; no 3D in the editor package`

### Task 4.5: Comments, fixtures, unused code and the mock-ups (same PR)

**Files:**
- Modify: comments across `packages/editor/src` and `tests/`; fixtures (`floorfifty.editors.toml`,
  `last-light-bay.editors.toml`, `FLOORFIFTY_SAMPLE`, ...); root `package.json` (`style` roots); `knip.json`
- Move: `docs/design/editor-kit`, `editor-2d`, `editor-suite` → `docs/archive/design/` (`tokens.json` already moved in
  4.2); `docs/design/editor-3d` stays for the 3D slice
- Modify: `docs/guides/editor.md` (first step builds nothing; `automata editor` opens the 2D editor; full rewrite in 12.5)

- [x] **Step 1:** Add `packages/editor` to `style`'s `--plan-comments`, `--comments-only` and `--test-imports`. Run
  → expected about 943 plan-ID findings (audit S5). Rewrite each comment to say why in plain words, or remove it
  when the code says it. Re-run until 0. **Session breaks** by area (kit, level-2d, features, suite), logging the
  findings left.
- [x] **Step 2:** Rename the fixtures away from the source projects: `floorfifty.editors.toml` → `platformer.editors.toml`,
  `last-light-bay.editors.toml` → `bay.editors.toml`, `FLOORFIFTY_SAMPLE` → `SAMPLE_GAME`, and the strings inside.
  `grep -rniE "floorfifty|last light|last-light" packages/editor` → 0.
- [x] **Step 3:** `pnpm knip` → remove what it reports unused in `packages/editor` (the trimmed root entry's leftovers,
  S3). The suite's Node adapters stay: they are imported inside `features/suite` (E6). Re-run tests: counts drop
  only by the deleted files' tests, listed in the execution log.
- [x] **Step 4:** Archive the mock-ups. `docs/README.md` points at `docs/archive/design/`.
- [x] **Step 5:** `pnpm check` passes. Commit, mark ready.
  `refactor(editor): plain comments, neutral fixtures, no unused entries, mock-ups archived`

### Task 4.6: The code refactor of the editor package (PR `claude/refactor-ed-quality`)

**Files:** `packages/editor/src/shared/**`, `packages/editor/src/features/*/` logic files (`*-model.ts`,
`*-controller.ts`, `*-session.ts`, commands), `packages/editor/src/app/**`, their tests, `packages/editor/README.md`.
The `.svelte` view components wait for phase 12, which rewrites them (spec 17.4).

- [x] **Step 1: The read.** Spec 17.3's checks over the package, area by area (kit core and storage, documents and
  history, commands and selection, the 2D model and codecs, the canvas, tiles and auto-tile, the profile and export, the
  editor list, the suite's logic). Findings list in the execution log before any change. Record the unit and Chromium
  browser counts.
- [x] **Step 2: Fix, one area per commit** (session breaks between areas as needed; log what is left): unused options and
  exports out; single-implementation interfaces folded, keeping the seams tests and targets swap (store, clock,
  renderer); duplicates merged (one memory workspace, one toast model, one id helper); files over 300 lines split by
  responsibility; header comments and whys added.
- [x] **Step 3:** Counts equal (or lower only by listed dead code); the auto-tile goldens unchanged in Node and
  Chromium; `editor-3d`'s tests pass in the 3D workflow; `pnpm check`. Mark ready.
  `refactor(editor): minimal, documented internals`

---

## Phase 5: The 2D level contract in `-content` (one PR, `claude/refactor-ed-level-contract`)

### Task 5.1: The `level-2d` entry

**Files:**
- Create: `packages/content/src/shared/level-2d/{content.schema.ts,fields.schema.ts,field-types.ts,check-field-def.ts,check-field-value.ts,level-2d-kinds.ts,read-level.ts}`,
  `packages/content/src/entries/level-2d.ts`, `packages/content/tests/unit/level-2d/*.test.ts`
- Modify: `packages/content/package.json` (`exports`, `publishConfig.exports`, `"automata": {"simEntries": ["./level-2d"]}`),
  `packages/content/tsdown.config.ts`, root `package.json` (`boundaries --browser packages/content:...,level-2d` and the
  sim rule over `packages/content/src/shared/level-2d/read-level.ts`), `.changeset/level-2d-contract.md`
- Delete (moved): `packages/editor/src/shared/level-2d/profiles/level-project/content.schema.ts`; the four kit field
  files become re-exports of `-content/level-2d`

- [x] **Step 1: Move the tests first.** `content-export.test.ts`'s schema assertions and the kit's `field.schema` and
  `check-field-*` tests move to `packages/content/tests/unit/level-2d/` importing `#src/shared/level-2d/...` → they
  fail (no files yet).
- [x] **Step 2: Move the files** (`git mv`, then fix imports). Run → they pass with the same counts.
- [x] **Step 3: `level2dKinds`, test first.** A test compiles a temporary content folder holding Emberwick's three
  exported files with `level2dKinds()` and expects `levels` in the sim's content and `project`, `world` outside it; a
  level with an unknown key fails with the schema's path in the message.
- [x] **Step 4: `intGridRows` and `entitiesOf`, test first.** Emberwick's `room-1.toml` collision layer decodes to the
  same rows `level-room.ts`'s `decodeRow` produces today (copy its current test's expectations); a row with a bad token
  throws `Level room-1, layer collision, row 3: "x*2" is not a number.` The file passes `pnpm boundaries`' sim rule.
- [x] **Step 5: The entry, the API report, the agent skills.** `pnpm --filter @mcthaydt/automata-content build`,
  `pnpm api-report --update`, `pnpm agent-skills --write`; changeset `patch`: "New `@mcthaydt/automata-content/level-2d`:
  the 2D level format the editor writes and games read."
- [x] **Step 6: Commit.** `feat(content): the 2D level format has one owner`

### Task 5.2: The editor and Emberwick import it (same PR)

**Files:**
- Modify: `packages/editor/src/shared/kit/fields/index.ts` (re-exports), the editor's export code and tests,
  `games/emberwick/src/features/room/{level-room.ts,emberwick-content.ts}`, `games/emberwick/content.config.ts` (or
  wherever `EMBERWICK_KINDS` is passed), `games/emberwick/tests/unit/room/*.test.ts`
- Delete: `games/emberwick/src/shared/kinds.ts`

- [x] **Step 1:** Emberwick's tests that read the room keep their expectations; switch the code to `level2dKinds()`,
  `intGridRows` and `entitiesOf`, deleting `LevelLike`, `decodeRow` and `kinds.ts`.
- [x] **Step 2: The golden must not move.** `pnpm --filter @af-games/emberwick test:unit` → `GOLDEN_HASH` still
  `421c5a1bf522299e`. If it moved, stop and find out why (the sim must get the same values); never re-record it.
- [x] **Step 3:** The editor imports its schemas from `@mcthaydt/automata-content/level-2d`. Editor unit count equal
  to before less the tests that moved to `-content`.
- [x] **Step 4:** `pnpm check`, Emberwick's Chromium journeys (`pnpm --filter @af-games/emberwick test:e2e
  --project='*-chromium'`) pass. Commit, mark ready. `refactor(emberwick): read the room through the shared level format`

---

## Phase 6: Save writes the game (one PR, `claude/refactor-ed-save`)

### Task 6.1: `exports` in the editor list and the policy

**Files:**
- Modify: `packages/editor/src/shared/editor-list/{editors.schema.ts,editor-list.ts,write-path.ts}`,
  `packages/tools/src/features/editor/editor-policy.ts`, `games/emberwick/content/editors.toml`
- Test: `packages/editor/tests/unit/editor-list/exports.test.ts`, `packages/tools/tests/unit/editor/editor-policy.test.ts`

- [x] **Step 1: Failing tests.** (a) A row with `exports = "content"` loads; `fileAccess(list, 'content/project.toml')`,
  `'content/world.toml'`, `'content/levels/room-1.toml'` are writable; `'content/tuning.toml'` is not (unless its own
  row says so); `'content/levels/x.json'` is not. (b) Two rows whose projects share an `exports` folder fail to load
  with spec section 6.1's message. (c) The server policy agrees with (a).
- [x] **Step 2:** Implement in `editor-list` (one function, `exportPaths(row)`, used by `fileAccess`). The policy
  needs no change beyond using `fileAccess`. Add `exports = "content"` to Emberwick's row.
- [x] **Step 3: Commit.** `feat(editor-list): a level row names the folder its game files go into`

### Task 6.2: Save writes the game files, then the project

**Files:**
- Create: `packages/editor/src/shared/level-2d/profiles/level-project/save-to-game.ts` (shared: it composes the
  export, `shared/level-2d`, with `shared/kit/storage/write-folder.ts`; a feature may not import `share`)
- Modify: `packages/editor/src/app/editor-2d/editor-app.ts` (reads the editor list through the store; passes
  `saveToGame` into the document feature), `packages/editor/src/features/document/document-controller.ts`,
  `packages/editor/src/features/share/export-model.ts` (no "Write to folder" where Save writes the game),
  `packages/editor/src/shared/kit/home/project-browse.ts` (the storage line)
- Test: `packages/editor/tests/unit/level-2d/save-to-game.test.ts`, `.../document/document-controller.test.ts`,
  `.../share/export-model.test.ts`, `.../home/project-browse.test.ts`

- [x] **Step 1: Failing tests** on a memory store (`src/testing/memory-workspace.ts`) with Emberwick's list:
  - Save writes `content/project.toml`, `content/world.toml`, `content/levels/room-1.toml` and then the project, in that
    order (the store records the order), with bytes equal to `exportContent(project)`.
  - A game file changed on disk since it was read → nothing is written, the result is `{ conflict: path }`, the
    controller opens the conflict dialog; Keep mine writes all four.
  - A write failure on the second file → the first stays written, the document stays dirty, the store's message is
    shown; the next Save writes all four.
  - No `exports` row (browser storage) → only the project is written, as today.
  - The export model on a checkout with `exports` offers no "Write to folder" and never says "Open a game folder to
    write into it."; the home storage line says "Saved in your game folder".
- [x] **Step 2:** `save-to-game.ts` composes `exportContent` and `writeToFolder(store, files, seen, 'guarded')`
  (reused, not copied) and writes the project last. `app/editor-2d` passes it in; the document feature does not
  import `share` (spec 3.3).
- [x] **Step 3:** Run the editor's unit and Chromium browser tests → pass. Copy rows in `copy.md`. Commit.
  `feat(editor): Save writes the game files the game reads`

### Task 6.3: The drift check

**Files:**
- Create: `packages/tools/src/shared/check/levels-step.ts`
- Modify: `packages/tools/src/shared/check/{check-steps.ts,run-check.ts,check-args.ts}` (`--only levels`),
  `packages/tools/package.json` (`@mcthaydt/automata-editor` as a devDependency in place of `-editor-suite`, bundled),
  `packages/tools/tsdown.config.ts`
- Test: `packages/tools/tests/unit/shared/check/levels-step.test.ts` (fixtures: a temp copy of Emberwick's `content/`)

- [x] **Step 1: Failing tests.** In sync → pass; a hand edit to `levels/room-1.toml` → fails with spec 6.3's two lines;
  a project that does not open → fails with its first problem and the same last line; no `editors.toml` or no
  `exports` row → the step is skipped with "No level files to check."; and the real `games/emberwick` is in sync (this
  is what keeps Emberwick's room and its game files together in `pnpm check`: `-tools`' `check:example` script runs in
  no gate).
- [x] **Step 2:** Implement with `@mcthaydt/automata-editor/level-export` (Effect, as the other steps are: `-tools`
  is Node tooling). Bundled by tsdown like the editor list.
- [x] **Step 3:** `node packages/tools/src/app/bin.ts check games/emberwick --only levels` → passes (from source:
  confirms the entry loads in Node). `pnpm check` passes. Commit. `feat(check): catch a level and its game files
  disagreeing`

### Task 6.4: The narrow fallback

**Files:**
- Modify: `packages/tools/src/features/editor/editor-policy.ts`, `packages/tools/src/features/editor/editor-command.ts`
  (usage text)
- Test: `packages/tools/tests/unit/editor/editor-policy.test.ts`

- [x] **Step 1: Failing test:** with no list, `package.json`, `tsconfig.json` and `content/data.json` are neither readable
  nor writable; `levels/a.af2d.json` is both.
- [x] **Step 2:** The fallback matches `**/*.af2d.json` outside tool folders. Usage text: "Without
  content/editors.toml, it opens only level files (*.af2d.json)."
- [x] **Step 3:** `pnpm check`. Commit, mark the PR ready. `fix(editor): without an editor list, only level files are reachable`

---

## Phase 7: The editor ships inside `-tools` (one PR, `claude/refactor-ed-ship`)

### Task 7.1: `--app 2d` by default, and it runs from source

**Files:**
- Modify: `packages/tools/src/features/editor/{editor-args.ts,editor-command.ts}`
- Test: `packages/tools/tests/unit/editor/{editor-args.test.ts,editor-command.test.ts}`,
  `packages/tools/tests/unit/app/editor-from-source.test.ts` (create; spawns the source bin)

- [x] **Step 1: Failing tests.** `parseEditorArgs([])` → `app: '2d'`. The command resolves `2d` to
  `<bin dir>/editors/2d` when it exists and to the checkout's `packages/editor/dist/2d` otherwise; `3d` and `suite`
  outside a checkout print "The 3D editor is not in this release yet." and exit 2. The spawned source bin
  (`node packages/tools/src/app/bin.ts editor games/emberwick --port 0`) prints its address within 20 s and serves
  `/api/ping` (then is stopped).
- [x] **Step 2:** Implement. The usage and messages per spec 7.1 (copy rows).
- [x] **Step 3: Commit.** `feat(editor): automata editor opens the 2D editor and runs from source`

### Task 7.2: The build inside `-tools`, and the closed-beta scan

**Files:**
- Create: `packages/tools/scripts/copy-editor.ts`
- Modify: `packages/tools/src/entries/internal.ts` (exports `findPixi3d` for the site's build, task 19.2),
  `packages/tools/package.json` (`build`:
  `tsdown && node scripts/copy-editor.ts`), `turbo.json` (`@mcthaydt/automata-tools#build` depends on
  `@mcthaydt/automata-editor#build`), `tooling/consumer-smoke/src/*` (records `-tools`' packed size; 3 MB budget),
  `.changeset/editor-in-tools.md`
- Test: `packages/tools/tests/unit/scripts/copy-editor.test.ts` (`findPixi3d` keeps its own tests in
  `tests/unit/shared/ship/prepare/pixi3d-markers.test.ts`)

- [x] **Step 1: Failing tests.** `copy-editor` scans `packages/editor/dist/2d` and `packages/editor/dist/suite` with the
  existing `findPixi3d` (one scan, the one `ship prepare` already runs: nothing is moved or copied), fails with spec
  7.3's message naming the file when either holds the beta, and otherwise copies `dist/2d` to `dist/editors/2d`.
- [x] **Step 2:** Implement; `ship prepare`'s existing tests stay green (unchanged).
- [x] **Step 3: Verify the package.** `pnpm --filter @mcthaydt/automata-tools build && cd packages/tools && pnpm pack`
  → the tarball lists `dist/editors/2d/index.html`; size recorded. Run the consumer smoke (14 steps plus "the packed
  `automata editor` serves the editor": a new step that starts it on the fixture game and fetches `/`).
- [x] **Step 4:** Changeset `patch`: "`automata editor` now includes the 2D editor." Commit.
  `feat(tools): ship the 2D editor inside the tools package`

### Task 7.3: `create-game` makes a level

**Files:**
- Create: `packages/tools/src/shared/create-game/template-content/` (`editors.toml`, `levels/start.af2d.json`,
  `project.toml`, `world.toml`, `levels/start.toml`), `packages/tools/scripts/write-template-content.ts`
- Modify: `packages/tools/src/shared/create-game/create-game.ts` (writes `content/`; the template's
  `src/features/level/` reads the level and `src/features/square/move.system.ts` stops at its walls; `vite.config.ts`
  uses the content plugin with `level2dKinds()`), `tooling/consumer-smoke/tests/e2e/stranger.test.ts` (the square stops
  at a wall),
  `packages/tools/package.json` (`@mcthaydt/automata-content` already a dependency)
- Test: `packages/tools/tests/unit/shared/create-game/template-content.test.ts`,
  `packages/tools/tests/unit/shared/create-game/create-game.test.ts`, the template's own
  `tests/unit/level/read-level.test.ts`, the stranger's journey

- [x] **Step 1: Failing tests.** (a) `write-template-content.ts --check` regenerates the four game files from
  `start.af2d.json` with `@mcthaydt/automata-editor/level-export` and they equal the checked-in ones. (b)
  `createGame` writes `content/editors.toml` and the five content files. (c) The existing `create-game` journey sees a
  wall where the level has one (read through the template's test hook) and still boots.
- [x] **Step 2:** Make the starter level in the editor's platformer template (one level, a floor, two platforms, a
  player start), write its game files with the script, and the template's sim reading them through `intGridRows`
  and `entitiesOf`.
- [x] **Step 3:** The stranger's journey and `pnpm --filter @mcthaydt/automata-tools test:e2e` (Chromium) pass, and
  `automata check` on the untouched game runs the `levels` step and passes. Changeset `patch`:
  "`create-game` starts every game with a level you can open in the editor." Commit, mark the PR ready.
  `feat(create-game): a new game has a level and an editor list`

---

## Phase 8: The suite without 3D (one PR, `claude/refactor-ed-suite`)

### Task 8.1: The 2D-only suite page

**Files:**
- Modify: `packages/editor/vite.config.ts` (`suite.html` as the second input), `packages/editor/src/app/suite/main.ts`
  (its comment: why only these two)
- Test: `packages/tools/tests/unit/scripts/copy-editor.test.ts` (the suite build's case)

The 2D-only page itself was written in task 4.2 step 4. The scan runs in `-tools`' build (task 7.2), not in the
editor's: the editor cannot run a `-tools` bin, because `-tools` depends on the editor (its editor list, its level
export and its 2D build) and the reverse would be a dependency cycle.

- [x] **Step 1: Failing test:** `copy-editor` fails on a planted `dist/suite` chunk carrying a `PIXI3D_MARKERS` string.
- [x] **Step 2:** `pnpm --filter @mcthaydt/automata-tools build` (which builds the editor first) → both editor builds
  scanned clean. `pnpm --filter @mcthaydt/automata-editor-3d build` → its `suite/` holds the beta and is not scanned
  (it is not shipped; its Vite config's comment says so).
- [x] **Step 3: Commit.** `test(suite): the editor package's suite build is scanned for the closed beta`

### Task 8.2: The suite opens the checkout; the rail lists what is there

**Files:**
- Modify: `packages/editor/src/app/suite/main.ts` (ping, then HTTP ports or the sample),
  `packages/editor/src/features/suite/shell/{suite-entries.ts,SuiteRail.svelte,Home.svelte,home-model.ts}`
- Test: `packages/editor/tests/unit/suite/{suite-entries.test.ts,home-model.test.ts,boot.test.ts}`

- [x] **Step 1: Failing tests.** With two registered editors the rail has two entries and Cmd 1 and 2; Cmd 3 does
  nothing. No card says "Plus" or a package name. The boot uses the HTTP ports when `/api/ping` answers and the sample
  only when it does not.
- [x] **Step 2:** Implement: `SUITE_ENTRIES` becomes the registered list's order. Delete the not-built card.
- [x] **Step 3:** `pnpm check`; the editor's Chromium browser tests pass. Commit, mark ready.
  `fix(suite): open the game it is served on and list only its editors`
- [x] **Step G (added 2026-11-06, [grandma audit](2026-11-06-grandma-ux-copy-audit.md) finding 4):** `automata editor --app suite` serves the 2D suite (`packages/editor/dist/suite`) in the 2D release, not `editor-3d`'s (whose full suite stays reachable with `--app-dir`); a published copy says "The editor suite is not in this release yet. Run automata editor to open the level editor." Done 2026-11-06 (session 9; `editor-command` tests). The sample banner is in 12.7, where the suite's top bar is rebuilt.

---

## Phase 9: Examples by dimension (one PR, `claude/refactor-examples-2d`)

### Task 9.1: Split the examples package

**Files:**
- Move: `examples/render3d/`, `examples/figures/` and their journeys (`examples/tests/e2e/render3d-*`, `figures-*`) →
  `examples/3d/`; the rest → `examples/2d/`
- Modify: `pnpm-workspace.yaml`, `examples/2d/package.json` (`@af-examples/examples-2d`, no `render-pixi3d`, `figures`
  or `@pixi/3d`), `examples/3d/package.json`, `examples/playwright.config.ts` (one per package),
  `tooling/examples-runner` (catalog per package), `.github/workflows/{ci.yml,3d.yml}`, root `package.json` scripts
- Test: `tooling/examples-runner/tests/unit/catalog.test.ts` (the 2D catalog has no private entry)

- [x] **Step 1: Failing test:** the 2D catalog holds no `render3d` or `figures` entry; `examples/2d/package.json`'s
  dependency tree (`pnpm --filter @af-examples/examples-2d list --depth Infinity`) has no `@pixi/3d`.
- [x] **Step 2:** Move (`git mv`); fix imports. `pnpm --filter @af-examples/examples-2d build` and the closed-beta scan
  of its output pass; the 2D examples' journeys pass in Chromium; the 3D ones run in `3d.yml`.
- [x] **Step 3:** `pnpm check`. Commit, mark ready. `refactor(examples): 2D and 3D examples are separate packages`

---

## Phase 10: The website moves in (one PR, `claude/refactor-site-move`)

### Task 10.1: `site/` with its history

**Files:**
- Create (by subtree): `site/**`
- Modify: `pnpm-workspace.yaml` (`site`), `site/package.json` (name `@mcthaydt/automata-site`), `turbo.json`,
  `knip.json`, `biome.json` (stop ignoring nothing new), `.vscode/settings.json`
- Delete (after the subtree): `site/pnpm-lock.yaml` (the workspace has one lockfile), `site/LICENSE` (the root's),
  `site/.nvmrc`, `site/.superpowers/`, `site/.taste-skill/` (agent scratch folders) and `site/docs/` (the site's own
  plans: moved to `docs/archive/site/`)

- [x] **Step 1:** `git fetch https://github.com/mcthaydt/automata-website main` (unshallow it first if the session's
  clone is shallow), `git subtree add --prefix site FETCH_HEAD`. If the proxy refuses the pack, use `--squash` and
  record the website's last commit (`4a514eb3` or later) in the commit message.

  **Session break here** if needed.
- [x] **Step 2:** `pnpm install`. `pnpm --filter @mcthaydt/automata-site test` → record which files fail (the audit:
  6 of 78, `double-jump`, `first-change`, `workshop-controls`, `api-contract`, `example-sources`, `license-claim`).
- [x] **Step 3: Commit.** `chore(site): move the website into the repository with its history`

### Task 10.2: Imports, not copies

**Files:**
- Delete: `site/scripts/{sync-*.ts,framework-source.ts,release.ts,rehearse-rollback.ts,check-deployed.ts,check-uptime.ts,record-lighthouse-baseline.ts,record-workshop-proof.mjs,build-workshop.mjs}`,
  `site/framework.ref`, `site/static/demos/`, the generated playground runtime, committed `llms*.txt` and API JSON,
  `site/workshop/`, `site/src/data/{restorations.ts,evidence*,first-change-proof.json,releases*}`, the tests that cover
  only those, `site/.github/` (its workflows; the deploy key goes with them)
- Create: `site/scripts/build-demos.ts`, `site/src/shared/framework/` (loaders that read `docs/guides`, the API index
  and the examples list from the workspace at build time)
- Modify: `site/package.json` (workspace dependencies; `build` = `node scripts/build-demos.ts && vite build && node
  scripts/write-seo-files.ts build`), `turbo.json` (`site#build` depends on the examples', Emberwick's, the editor's and
  `api-index`'s builds), `.gitignore` (`site/static/demos/`, `site/.generated/`)
- Move: the playground half of `tooling/examples-runner` (`src/playground/`, the `playground/` build and server scripts,
  `tests/e2e/playground-*`, the `build:playground` and `e2e:playground*` scripts) into `site/src/lib/playground/` and
  `site/tests/`, replacing the site's synced copies (`protocol.ts`, `headers.ts` and the generated runtime). The site is
  its only user; `examples-runner` keeps the examples index (spec 16.6). `tooling/examples-runner` has no entry that
  exports the protocol, so this is a move, not a re-export
- Test: `site/tests/unit/framework/*.test.ts`

- [x] **Step 1: Failing tests.** The guides loader lists `docs/guides/editor.md` and the four publish guides (W7);
  the API loader lists the four published packages, not twelve (W4); the demos list comes from the examples' own
  manifest and has no `bodies-2d` (WS3).
- [x] **Step 2:** Implement the loaders; delete the sync scripts and every copy; `build-demos.ts` builds the examples
  and Emberwick into `site/.generated/demos/` and Vite serves it as static.
- [x] **Step 3:** `pnpm --filter @mcthaydt/automata-site test` → no failing file (the six broken ones are deleted with
  what they covered, or now read the real files); `pnpm --filter @mcthaydt/automata-site build` → exits 0 (W3).
- [x] **Step 4: Commit.** `refactor(site): read the framework at build time; no sync scripts, pins or committed builds`

### Task 10.3: The site's tooling matches the repository's

**Files:**
- Modify: `site/package.json` (Vite 8.3.3, SvelteKit 2.70.4 (the last 2.x; its peers allow Vite 8 and the plugin 7),
  `@sveltejs/vite-plugin-svelte` 7, Zod 4.6.6, exact pins, no `tsx`; TypeScript stays 6.0.3, because SvelteKit 2 and 3
  both ask for TypeScript 6 as a peer), `site/svelte.config.js`, `site/vite.config.ts`, `site/tsconfig.json`; root `package.json`
  (`lint` covers `site`), every site file Biome reformats

- [x] **Step 1:** Upgrade; `pnpm --filter @mcthaydt/automata-site check test build` pass. (Done in 10.2, deviation 95.)
- [x] **Step 2:** `pnpm format`; `pnpm lint` passes over `site/`. Its existing end-to-end gates (`site/tests/e2e`) pass
  in Chromium.
- [x] **Step 3:** `site`'s unit tests join `test:unit:2d`, its e2e joins `ci.yml`'s `e2e-2d` job. `pnpm check` passes.
  Commit, mark the PR ready. `chore(site): the repository's versions, Biome and gates`

---

## Phase 11: One design system (one PR, `claude/refactor-ed-design-system`)

### Task 11.1: One token source

**Files:**
- Modify: `packages/editor/src/shared/kit/tokens/tokens.json` (the site's values, spec 11.2), `packages/editor/scripts/generate-tokens.ts`,
  `packages/editor/src/shared/kit/tokens.css` (generated), `site/src/app.css` (its `:root` block replaced by
  `@import '@mcthaydt/automata-editor/tokens.css'`), `site/package.json` (`@mcthaydt/automata-editor` workspace dependency)
- Test: `packages/editor/tests/unit/kit/tokens.test.ts`

- [ ] **Step 1: Failing test.** The generated CSS defines every custom property the site's `:root` block defines today,
  with the same value (the test reads the names and values from a fixture copied from `site/src/app.css` before the
  change: about 36, from `--bg` to `--ease-out`, the flutes, the curtain, the glow and the stage colours included, not
  a hand-picked list); every old editor name (`--color-bg-app`, `--color-accent-default`, ...) is an alias (`var(--...)`);
  every `--color-layer-*` name still exists; `color-scheme: light`. `generate-tokens.ts --check` fails when `tokens.css`
  is stale.
- [ ] **Step 2:** Implement; the site imports the file; its own page CSS keeps working (its e2e gates pass in
  Chromium; screenshots of Home before and after are identical by eye, since the values are the same).
- [ ] **Step 3: Commit.** `feat(design): one token source for the editor and the site`

### Task 11.2: Geist and the icons

**Files:**
- Modify: `packages/editor/src/shared/kit/fonts.css`, `packages/editor/package.json` (`@fontsource-variable/geist`,
  `@fontsource-variable/geist-mono` replace the Plex packages), `docs/provenance/sources.md` (Lucide, ISC)
- Create: `packages/editor/src/shared/kit/icons/{Icon.svelte,paths.ts}`
- Test: `packages/editor/tests/unit/kit/icons.test.ts`

- [ ] **Step 1: Failing test.** `Icon` renders an `svg` with `aria-hidden="true"` and the path for each of the 24
  names (select, brush, rectangle, fill, eraser, eyedropper, undo, redo, layers, eye, eye-off, lock, unlock, more,
  back, plus, trash, share, download, copy, play, check, alert, close); an unknown name is a type error.
- [ ] **Step 2:** Implement. Font files load as the site's do (self-hosted, no third-party request: the site's
  third-party gate covers the try-it page later).
- [ ] **Step 3: Commit.** `feat(design): Geist and an icon set in the editor kit`

### Task 11.3: The kit's components and the design board

**Files:**
- Modify: every component in `packages/editor/src/shared/kit/{widgets,dialogs,shell}` (styles; props only where spec
  11.3 adds a variant: Button `quiet`, `danger`; new `IconButton.svelte`; Dialog's phone sheet)
- Create: `packages/editor/design.html`, `packages/editor/src/app/design/main.ts` (mounts every component in every
  state with fixture data), `packages/editor/tests/e2e/design-board.test.ts` (screenshots at the four sizes)
- Test: `packages/editor/tests/unit/kit/widgets/*.test.ts` (behaviour unchanged), `packages/editor/tests/browser/layout/widgets.test.ts`

- [ ] **Step 1: Failing layout tests** for the new rules: Button 44 px, primary 48 px; IconButton 44 × 44 with an
  accessible name; a Dialog at 390 × 844 is a bottom sheet with its primary action visible; focus rings are 2 px cobalt.
- [ ] **Step 2:** Restyle each component to spec 11.3 using only the new token names (no literal colours: a unit test,
  `tests/unit/kit/no-literal-colors.test.ts`, reads the kit's `.svelte` styles and fails on a `#hex`, `rgb(` or `hsl(`
  outside `tokens/`). The kit's components stop using the old aliases; the aliases stay only for `editor-3d`, and the
  3D slice deletes them (spec 11.2).
- [ ] **Step 3: The board.** Build `design.html` (not in the shipped build: Vite input only in `dev` and the design
  script). Run the screenshot test in Chromium; open every image; fix what looks wrong; attach the iPad and phone images
  to the PR.
- [ ] **Step 4:** The editor's unit and Chromium browser tests pass (behaviour unchanged). `editor-3d`'s tests in the
  3D workflow: any that asserted an old colour or size is updated with the reason in the commit (spec 11.6). Commit,
  mark ready. `feat(design): the editor kit in the website's look, with a design board`

---

## Phase 12: The 2D editor redesigned (two PRs)

Every task here: before-and-after screenshots at phone, iPad (both orientations) and desktop attached to the PR; every
changed string in `copy.md`; DOM tests updated only for names and places; nothing a view could do before becomes
unreachable (spec 11.4, "what stays"): before each task, list the view's actions from its current DOM tests in the
execution log, and tick each off when the redesigned view's tests reach it. The views are where spec 17's standard is
met for the `.svelte` code (spec 17.4), so each task also starts with spec 17.3's read over the components it touches
(findings in the execution log) and its rewrite closes them: no component over 300 lines, a header comment on each,
logic that is not markup lives in the view's `*-model.ts`.

### Task 12.1: Home (PR `claude/refactor-ed-redesign-1`)

**Files:**
- Modify: `packages/editor/src/features/home/{Home.svelte,ProjectSummary.svelte,TemplateRow.svelte,DeleteDialog.svelte,home-model.ts,home-controller.ts}`,
  `packages/editor/src/shared/kit/home/project-browse.ts`
- Create: `packages/editor/src/features/home/{ProjectCard.svelte,NewLevelSheet.svelte}`
- Test: `packages/editor/tests/unit/home/*.test.ts`, `packages/editor/tests/browser/layout/home.test.ts`

- [ ] **Step 1: Failing tests.** One list of cards; "New level" opens a sheet with three templates named per spec 11.5;
  a card's More menu holds Open, Duplicate, Delete; no third column at any size; "Open from" is a two-option control;
  storage is one line; no "Level project" or "Valid" badge; a project with problems says "2 problems".
- [ ] **Step 2:** Implement. Layout test at the four sizes: no horizontal scroll, every card's More button inside the
  viewport.
- [ ] **Step 3:** Screenshots, copy rows. Commit. `feat(editor): Home redesigned`
- [ ] **Step G (added 2026-11-06, [grandma audit](2026-11-06-grandma-ux-copy-audit.md) findings 3 and 16, section 5.2):** the New level templates on a game folder make the level where the game's editor list allows (`content/rooms/`), or the sheet says why not and what to do; never the toast that names the file twice. The Delete dialog names the level by its label ("Delete Emberwick room? It's removed from your game for good."). Home shows the game's name as the source ("Your game: Emberwick"), one storage line, and "Changed 7 minutes ago" on a card; file sizes and paths go under Details. One name per thing: the label people gave it, everywhere.

### Task 12.2: The document frame (same PR)

**Files:**
- Modify: `packages/editor/src/features/document/{DocumentBar.svelte,ViewRail.svelte,DocumentScreen.svelte,view-router.ts}`,
  `packages/editor/src/features/problems/` (a sheet), `packages/editor/src/features/share/` (a menu),
  `packages/editor/src/app/editor-2d/App.svelte`, `packages/editor/src/shared/kit/shell/EditorShell.svelte`
- Test: `packages/editor/tests/unit/document/*.test.ts`, `.../problems/*.test.ts`, `.../share/*.test.ts`,
  `packages/editor/tests/browser/layout/document.test.ts`

- [ ] **Step 1: Failing tests.** The top bar has Back, the name (renames on tap), the view switcher with Level, Map,
  Tiles, Characters, Undo and Redo icon buttons, and Save as the one primary button showing "Save", "Saving…",
  "Saved"; no status bar; "2 problems" opens a sheet and choosing one jumps to it; on a checkout with `exports` there is
  no Share menu; in browser storage the Share menu holds Download, Share, Copy; on a phone the view switcher is a menu.
- [ ] **Step 2:** Implement. Layout test: Save is visible and never covered by a sheet, at every size.
- [ ] **Step 3:** Screenshots, copy rows. Commit, mark the PR ready. `feat(editor): the document frame redesigned`
- [ ] **Step G (added 2026-11-06, [grandma audit](2026-11-06-grandma-ux-copy-audit.md) finding 8):** Back with unsaved changes asks "Save your changes to Emberwick room?" (Save, Don't save, Cancel). One save story: Save writes the game; the autosave is a safety net out of sight (no "Autosave on"); a restore says "You have unsaved changes from last time. Keep them?" (Throw away, Keep my changes). The rail's views carry icons and labels.

### Task 12.3: The Level view (PR `claude/refactor-ed-redesign-2`)

**Files:**
- Modify: `packages/editor/src/features/level/{LevelView.svelte,LevelToolbar.svelte,LayersPanel.svelte,LevelPanel.svelte,Inspector.svelte,LevelInspector.svelte,LevelDock.svelte,LevelCards.svelte,Palette.svelte,LevelStage.svelte,dock-model.ts}`,
  `packages/editor/src/shared/level-2d/canvas/colors.ts` (the `NEUTRAL` grey for the charcoal canvas), the layer colour
  token values in `tokens.json`
- Test: `packages/editor/tests/unit/level/*.test.ts`, `packages/editor/tests/browser/layout/level.test.ts`,
  `packages/editor/tests/browser/canvas/*.test.ts`, the level journeys in `tests/browser/journeys/`

- [ ] **Step 1: Failing tests.** The canvas fills a charcoal cabinet; the tools are one floating pill with Select,
  Brush, Rectangle, Fill, Eraser, Copy a tile (brush size inside Brush's popover); the pill is wholly inside the
  viewport at 1194 × 834 and at 390 × 844 (G5); Layers is a sheet with colour, name, eye and lock per row and the
  palette under the chosen layer; layer subtitles per spec 11.5; the inspector opens on selection and docks from iPad
  landscape up; the level strip is a level picker in the top bar.
- [ ] **Step 2:** Implement. **Session break** after the tool pill and layers if needed (log what is left).
- **12.7, the rest of Step 1 and 2 (session 15).** *The split:* `Suite.svelte` 437 → 339 lines by responsibility:
  `SuiteTopBar.svelte` (the game's name, where edits are saved, the pills, Undo, Redo, Ask, Publish and the editor's
  tools; it shows only what has something to say), `SuiteHome.svelte` (the sample's note, Export and Import, the
  cards), `SuiteAsk.svelte` (Ask's session state on its dialog and the rule that a step in the editor's history drops
  a proposal) and `core/write-messages.ts` (what a refused write and a check finding say, pure, with a unit test).
  `Suite.svelte` keeps the editor mounting, the history and the dialogs' state; it is over 300 lines by 39, all
  wiring that shares the mounted editor's state, so splitting it further would only pass that state around: listed
  for the build audit. *Publish:* the top bar's Ship is Publish and its dialog says "Publish your changes",
  "Publishing…", "Publishing still opens a draft for review." and, with nothing open, "Nothing new to publish yet."
  It stays hidden with no change sets (a game folder writes its files directly), so no button does nothing (E6).
  *Home:* the title asks "What do you want to change?"; each file is named in words (`fileTitle`: `room-1.af2d.json`
  is "Room 1", `tuning.toml` is "Tuning"), no path on Home; empty pages say "This game has nothing to edit yet." and
  "Nothing to edit in Tuner yet." Not done: a level's own name ("Emberwick room") lives inside its file, so Home
  would read every file to show it; the file's name in words is the essential part, and the level menu (12.3) shows
  the levels' own names. Gates: editor unit (suite) 286 → 294 (with the new `write-messages` and `fileTitle` tests),
  Chromium layout (suite) 121, svelte-check clean.
- **12.3, the look begins (session 15).** The Owner approved the redesign mockups on 2026-11-06 ("Approved", relayed
  by the coordinator): `editor-level.html` and `AUDIT.md` in the shared folder's `refactor/2026-11-06-redesign-mockups/`
  are the look of 12.3 and every non-3D editor view. *Done:* the mockup's neutral tool palette as tokens (`--tool-bg`
  #f7f7f8, `--tool-panel` white, `--tool-hover`, `--tool-selected`, `--tool-line`, `--tool-line-strong`, `--tool-muted`
  and `--tool-faint`, which read at 4.5:1 on white and on the chosen row) and `src/shared/kit/tool-chrome.css`, which
  the three editor pages import after `tokens.css` and which puts them under the names the kit already reads (`--bg`,
  `--paper`, `--surface`, the hairlines, the grey, the selection wash), so every view takes the palette at once and
  the website, which does not import it, keeps its field. A unit test holds the mapping, the import order and the
  contrast. The design board shows it (neutral field, white cards, hairlines). The stage keeps `--charcoal`
  (#16191e; the mockup's #0e1014 is close) so no canvas pixel expectation changes yet. *Next, designed:* (1) the
  density, 32 px rows and controls on a fine pointer and 44 on touch (`--row`, `--ctl` under `(pointer: coarse)`); the
  layout tests hold every control to 44 px in Chromium's fine pointer today, so they first learn the pointer (44 on
  touch, 32 with a mouse), and a primary stays 48 on touch (the framework rule); (2) 12.3's structure from the mockup:
  the top bar is Back, the level menu (the levels and New level; on compact it also switches the four views), the
  views as quiet tabs, Undo, Redo, problems, the save state and one lime primary (Save on a game folder, Share in
  browser storage); tools float top centre, zoom bottom; the inspector is label-left and shows the level with nothing
  chosen; three layouts by the container (wide 1180 px and up, medium, compact at 760 px and down or under 520 px
  high, with the tools in a dock and sheets); lock before eye on layer rows; (3) the same on Map, Tiles, Characters,
  the Tuner, the suite page and the dialogs.
- [ ] **Step 3:** The canvas tests' pixel expectations that read old colours: open expected, actual and diff for each;
  update with the reason in the commit. The iPad journeys (WebKit) are the Owner's run; Chromium here.
- [ ] **Step 4:** Screenshots, copy rows. Commit. `feat(editor): the Level view redesigned, canvas first`

### Task 12.4: Map, Tiles, Characters and the dialogs (same PR)

**Files:**
- Modify: `packages/editor/src/features/{map,tiles,characters}/**/*.svelte`, `packages/editor/src/shared/kit/dialogs/{ConflictDialog,RecoveryDialog}.svelte`,
  `packages/editor/src/shared/kit/dialogs/document-messages.ts`
- Test: their unit and layout tests

- [ ] **Step 1: Failing tests** per view: the frame of spec 11.4 (stage in its cabinet, a list sheet, an item sheet);
  each dialog has one primary action and the copy of `copy.md`.
- [ ] **Step 2:** Implement, one view per commit. **Session break** between views if needed.
- [ ] **Step 3:** Screenshots, copy rows. Commit per view.
- [ ] **Step G (added 2026-11-06, [grandma audit](2026-11-06-grandma-ux-copy-audit.md) section 5.2):** the Tiles, Map and Characters rows of the audit's table: no IntGrid, rule, pivot, id, shape or field-count words on the first screen ("No tiles yet. Add a picture of your tiles to paint with them.", "Arrange levels: Anywhere, In a grid, In a row, In a column", "Ember (one per level)", "Box, Circle, Dot, Picture"); the anchor point and the name in code live under More.

### Task 12.6: The Tuner, audited and redesigned (PR `claude/refactor-ed-redesign-3`; added 2026-11-06)

The Owner, 2026-11-06: "We should be redesigning and auditing all editors that aren't 3D, not just the 2D level
editor". The Tuner (`features/suite/tuner/`) is a non-3D editor the plan had left to the 3D slice.

**Files:**
- Modify: `packages/editor/src/features/suite/tuner/ui/{TunerPanel,TunerRegions,TunerRows,TunerInspector}.svelte`,
  `packages/editor/src/features/suite/tuner/{tuner-controller,tuner-session}.ts` (only where logic leaves markup)
- Test: `packages/editor/tests/unit/suite/tuner/*.test.ts`, a layout test at the four sizes in
  `packages/editor/tests/browser/layout/suite/`

- [ ] **Step 0: The audit.** Spec 17.3's read over the Tuner (size, header, logic in markup, unused code) and the
  four questions over every string it shows; findings and the Tuner's actions (from its DOM tests) in the execution log.
- [ ] **Step 1: Failing tests.** A split view (the Owner, 2026-11-06: "I feel like the tuner should be a split view
  where it shows the effect of the change"): the settings on one side, the game running live on the other, and a
  change to a value shows in the running game without a reload (side by side from iPad landscape up; stacked, game
  on top, on a phone); every value row names the setting in plain words with its unit; no format word or path on screen; nothing reachable before is
  lost.
- [ ] **Step 2:** Implement with the kit's components only. Layout test: no horizontal scroll, 44 / 48 px targets.
- [ ] **Step 3:** Screenshots before and after (phone, iPad, desktop), copy rows. Commit.
  `feat(editor): the Tuner audited and redesigned`
- [ ] **Step G (added 2026-11-06, [grandma audit](2026-11-06-grandma-ux-copy-audit.md) section 6.2):** each tunable has a label and a one-line "what you'll feel" carried by the game's `tuning.toml` (or the Tuner's schema), with a unit a player can feel; no constant names, no other game's numbers on screen (they stay in the TOML comments); Lock becomes Keep with its tooltip; the empty panel says "Tap a setting to see more."; the split view (step 1) is how she tries it, so no separate "Play to try it" button.

### Task 12.7: The 2D suite page, audited and redesigned (same PR; added 2026-11-06)

The suite's 2D page (`app/suite/`, `features/suite/shell/`: Home, the rail, the pills, Review, Ask, Ship, Import and
Export) is the other non-3D editor screen. It still does not ship (D3) and Ship and Ask stay unwired (E6); this task
gives it the look, the layout and the words, and the 3D slice adds the Studio and Levels 3D to it.

**Files:**
- Modify: `packages/editor/src/features/suite/shell/*.svelte`, `packages/editor/src/app/suite/main.css`,
  `packages/editor/src/features/suite/shell/home-model.ts` (only where logic leaves markup)
- Test: `packages/editor/tests/unit/suite/shell/*.test.ts`, `packages/editor/tests/browser/layout/suite/`

- [ ] **Step 0: The audit**, as 12.6 step 0, over every file in `features/suite/shell/` and `app/suite/`.
- [ ] **Step 1: Failing tests.** The suite's top bar holds Back, the editor's name and one primary action; the rail is
  the kit's view switcher; each dialog has one primary action and the copy of `copy.md`; a control that is not wired
  says so in plain words, or is not shown (E6), never a button that does nothing.
- [ ] **Step 2:** Implement with the kit's components only; no component over 300 lines (`Suite.svelte` and
  `ReviewDesk.svelte` are split by responsibility if they are).
- [ ] **Step 3:** Screenshots, copy rows. Commit, mark the PR ready. `feat(editor): the 2D suite page audited and redesigned`

Task 12.5 (the copy table and the guide) runs after 12.6 and 12.7, so its scan covers them.
- [ ] **Step G (added 2026-11-06, [grandma audit](2026-11-06-grandma-ux-copy-audit.md) section 6.1):** the top bar's rewrites (the game's name as the title; "Saved in your game folder"; change-set, checks and gates pills hidden until they mean something; Ship becomes Publish, disabled with "Nothing new to publish yet"; Undo and Redo labelled); when the suite shows a sample instead of the game (no server), a full-width banner says "This is a sample game, not yours. Run automata editor inside your game's folder to edit it." in place of the small "Sample game" chip; Home lists levels by name ("What do you want to change? Levels: Emberwick room. Movement: how Wick runs and jumps") and hides the files Save writes.

### Task 12.5: The copy table and the guide (same PR)

**Files:**
- Modify: `docs/refactor/copy.md` ("Editor": every string phases 6 to 12 changed, checked against the four questions),
  `docs/guides/editor.md` (rewritten: open, draw, save, play; screenshots from the design board),
  `packages/editor/README.md`

- [ ] **Step 0:** Spec 17.3's file checks over every `.svelte` file in `packages/editor/src` (size, header comment);
  what phase 12 did not reach is fixed here or listed for the build audit.
- [ ] **Step 1:** `grep` the editor's `.svelte` and `*-messages.ts` for strings not in `copy.md`; each is either fine
  (listed as kept) or rewritten. No package name, path jargon or format word on screen (G3, G4): a unit test scans the
  rendered text of each screen fixture for `editor-`, `af2d`, `.json`, `checkout`, `Plus`.
- [ ] **Step 2:** `pnpm check`; the editor's Chromium browser tests. Commit, mark the PR ready.
  `docs(editor): the copy table and the editor guide for the redesigned editor`
- [ ] **Step G (added 2026-11-06, [grandma audit](2026-11-06-grandma-ux-copy-audit.md) sections 5.2 and 7):** every row of the audit's section 5.2 is in `copy.md`; its seven rules join `copy.md` beside the four questions; the rendered-text scan also fails on project, workspace, entity, IntGrid, tunable, change set, gate, pivot.

---

## Phase 13: Real journeys (one PR, `claude/refactor-ed-journeys`)

### Task 13.1: The harness

**Files:**
- Create: `packages/editor/playwright.config.ts` (`defineJourneys` from `tooling/playwright-preset`; projects
  `editor-ipad-webkit`, `editor-ipad-chromium`, `editor-phone-chromium`), `packages/editor/tests/e2e/harness/{temp-game.ts,run-editor.ts,run-game.ts,canvas-pointer.ts}`
- Modify: `packages/editor/package.json` (`test:e2e`), `turbo.json` (`test:e2e` depends on `-tools`' build),
  `.github/workflows/ci.yml` (`e2e-2d` runs the editor's projects)

- [ ] **Step 1:** `temp-game.ts` copies a game (Emberwick, or a `create-game` output) to a fresh temp folder per test
  and removes it after; `run-editor.ts` spawns `packages/tools/dist/bin.js editor <dir> --port 0` and resolves with its
  printed address; `run-game.ts` starts the game's dev server on its own port; `canvas-pointer.ts` turns a level cell
  into page coordinates from the canvas's published geometry. Each has a unit test where it has logic (the cell
  mapping).
- [ ] **Step 2:** A smoke journey (open the editor, see "Emberwick room") passes in Chromium.
- [ ] **Step 3: Commit.** `test(editor): a Playwright harness that runs the real automata editor on a temp game`

### Task 13.2: Save, drift and conflict journeys

**Files:**
- Create: `packages/editor/tests/e2e/{save-reaches-the-game.test.ts,drift-is-caught.test.ts,conflict-stops-the-save.test.ts}`

- [ ] **Step 1:** Write the three journeys of spec section 9, using roles and names from `copy.md`. The game's room is
  read through the hook Emberwick's own journeys use (find it: `grep -rn "window\.__" games/emberwick/tests/e2e`).
- [ ] **Step 2:** Run in Chromium (iPad and phone projects) → pass. Record first-attempt results. WebKit: the Owner's.
- [ ] **Step 3: Commit.** `test(editor): journeys prove Save reaches the game and the check catches drift`

### Task 13.3: A new game, and the suite

**Files:**
- Create: `packages/editor/tests/e2e/{new-game-opens.test.ts,suite-opens-the-checkout.test.ts}`

- [ ] **Step 1:** The new-game journey reuses the stranger's journey's steps (`tooling/consumer-smoke/src/stranger.ts`:
  pack, `create-game` outside the workspace, install from the packs), then starts `automata editor` with no flags,
  paints a wall into the starter level, saves, and sees it in the game.
- [ ] **Step 2:** The suite journey (Chromium only) per spec section 9.
- [ ] **Step 3:** Both pass in Chromium. `pnpm check`. Commit, mark ready. `test(editor): a new game opens in the editor; the suite opens the game`

---

## Phase 14: Release to npmjs.org (two PRs)

### Task 14.1: The scope (PR `claude/refactor-scope`; waits only on the Owner's organisation name, D9; based on whatever is the stack's head when the name arrives, and nothing later waits for it)

**Files:**
- Modify: every `package.json`, import, doc, guide, README, skill, template and test naming `@mcthaydt/automata`
  (`git grep -l "@mcthaydt/automata"`), through a specifier codemod table (`tooling/codemods`)
- Test: `tooling/release/tests/unit/scope.test.ts`

- [ ] **Step 1: Failing test:** no tracked file outside `docs/archive/`, `docs/refactor/` and the changelogs names
  `@mcthaydt/automata`.
- [ ] **Step 2:** Run the codemod with the Owner's scope; `pnpm install`, `pnpm check`, the stranger's journey,
  Emberwick's Chromium journeys. API reports, agent skills and cheatsheet regenerated. One changeset `patch` per package
  saying the name changed. Mark ready. `refactor: publish under the project's npm scope`

### Task 14.2: The registry and the first public version (PR `claude/refactor-npm`)

**Files:**
- Modify: the published `package.json`s (`publishConfig.registry`, `repository`/`homepage`/`bugs`), root `.npmrc`,
  `.changeset/config.json` (`"access": "public"`), `.github/workflows/{release-packages.yml,game-ci.yml,game-release.yml}`,
  `tooling/consumer-smoke/src/run.ts` (`AF_REGISTRY`), `tooling/release/src/check-changesets.ts` (the one-time `minor`
  below 0.1.0), `vendor/ruken/README.md` (R7), `docs/runbook.md`, `AGENTS.md` (the publish line), READMEs
- Delete: the fourteen pending refactor changesets; Create: `.changeset/first-public-release.md` (`minor`, one entry)
- Test: `tooling/release/tests/unit/{publish-config.test.ts,check-changesets.test.ts}`, and the five tests that pin
  GitHub Packages, updated

- [ ] **Step 1: Failing tests:** every published package's registry is `https://registry.npmjs.org` and none links to
  the private repository; access is `public`; `check-changesets` accepts one `minor` while the version is below 0.1.0
  and refuses one at or above it; no workflow reads `AF_READ_TOKEN`.
- [ ] **Step 2:** Implement. `release-packages.yml`: `NPM_TOKEN`, no provenance with a one-line reason (R6).
- [ ] **Step 3: Dry run.** Verdaccio locally (`pnpm dlx verdaccio@<exact>`), `changeset version` (→ 0.1.0),
  `changeset publish` to it, the stranger's journey with `AF_REGISTRY` pointing at it (installing by version, not packs)
  → passes. Undo the version commit; it is the release's job.
- [ ] **Step 4:** `docs/runbook.md`: the Owner's first-publish steps (organisation, `NPM_TOKEN`, approve the release
  environment). Mark ready. `build(release): publish 0.1.0 to npmjs.org`

---

## Phase 15: CI for games (one PR, `claude/refactor-game-ci`)

### Task 15.1: The game's own workflow

**Files:**
- Create: `packages/tools/src/shared/create-game/template-ci/release.yml`
- Modify: `create-game.ts` (writes `.github/workflows/release.yml`), `.github/workflows/{game-ci.yml,game-release.yml}`
  (Emberwick's jobs only; no `workflow_call` inputs for others, no `af-linux`/`af-mac` defaults for others, no
  `dev-target` example), `docs/guides/publish-to-*.md` (show the template's workflow)
- Test: `packages/tools/tests/unit/shared/create-game/template-ci.test.ts`

- [ ] **Step 1: Failing test:** a new game has `.github/workflows/release.yml` that runs on a tag, on `ubuntu-latest`,
  with `pnpm check`, `pnpm build:web` and an itch.io publish guarded by `BUTLER_API_KEY`; it parses as YAML and passes
  `actionlint` when Docker is present.
- [ ] **Step 2:** Implement; the stranger's journey checks the file exists. Mark ready.
  `feat(create-game): a new game has its own release workflow`

---

## Phase 16: The agent package and the docs (one PR, `claude/refactor-agents-docs`)

### Task 16.1: The skills, for today's framework

**Files:**
- Modify: `agents/automata/skills/*/SKILL.md`, `agents/automata/skills/automata-feature/example/` (regenerated from
  `create-game` plus one feature), root `package.json` (`boundaries` root for the example), `.claude-plugin/marketplace.json`
- Test: `pnpm plugin:validate`; `tooling/agent-skills/tests/unit/skills-text.test.ts` (no `src/sim/`, "reference host",
  "networked truth" or `vitest run src/`)

- [ ] **Step 1:** Failing text test, then rewrite (A1, A2). `pnpm boundaries` passes on the new example. Commit.
  `docs(agents): the skills teach the refactored framework`

### Task 16.2: One generated reference

**Files:**
- Modify: `tooling/api-index/src/cli.ts` (writes the cheatsheet and the agent `reference/api.md` in one run),
  `tooling/agent-skills/src/*` (reads the index instead of generating its own), root `package.json`
  (`release:version`), `AGENTS.md` (one command after an export change)
- Test: `tooling/api-index/tests/unit/outputs.test.ts`

- [ ] **Step 1:** Failing test: one `pnpm api-index --write` writes both files from one index; `pnpm agent-skills
  --write` no longer writes `api.md`. Implement (A3). Commit. `build(docs): one generator for the API reference`

### Task 16.3: The docs agree with the direction

**Files:**
- Modify: `docs/adr/0002*.md`, `0004*.md`, `0005*.md`, `docs/stack.md`, `tooling/versions/src/stack-cards.ts`,
  `docs/versions.md`, `renovate.json`, `docs/status.md`, `README.md`, `tooling/check-style/src/{plan-comments.ts,cli.ts}`
  (YAML and Markdown; a `--links` rule), `tooling/repo-hygiene/src/source-names.ts` (wired into `pnpm check`), the
  files those rules flag
- Test: `tooling/check-style/tests/unit/{plan-comments-yaml-md.test.ts,links.test.ts}`,
  `tooling/repo-hygiene/tests/unit/source-names-wired.test.ts`

- [ ] **Step 1: Failing tests** for the YAML/Markdown plan-ID rule, the links rule and source names in `pnpm check`.
- [ ] **Step 2:** Implement; run; rewrite every finding (about 100 plan-ID lines, 9 links, the source names outside
  comments). The source-names rule skips `docs/refactor/` as well as `docs/archive/` and `docs/provenance/` (the audits
  there name the source projects as evidence). ADRs, stack, versions and Renovate per spec 16.5. **Session break**
  between the three rules if needed. `pnpm check` passes. Commit.
  `docs: the docs, ADRs and pins follow the current direction`

### Task 16.4: The skills' public home

**Files:**
- Modify: `.github/workflows/release-packages.yml` (after publish: copy `agents/automata` to `mcthaydt/automata-skills`
  with `SKILLS_TOKEN`; without it, print "No skills token yet." and pass)

- [ ] **Step 1:** The job parses; with no secret it passes on the PR's head (a `workflow_dispatch` dry run;
  task 17.1's invariants then keep the guard). Mark the PR ready. `ci(release): mirror the agent package to its public home`

---

## Phase 17: Tooling diet (one PR, `claude/refactor-tooling-diet`)

### Task 17.1: The workflow invariants replace the YAML-pinning tests

**Files:**
- Create: `tooling/repo-hygiene/tests/unit/workflow-invariants.test.ts`
- Delete: `packages/tools/tests/unit/shared/ship/workflows.test.ts` and the config-pinning tests the audit lists (Q2)

- [ ] **Step 1:** Write the invariants (spec 16.6) and see each fail on a fixture workflow that breaks it.
- [ ] **Step 2:** Delete the pinning tests. Record the test counts before and after. Commit.
  `test(ci): a few workflow invariants instead of tests that pin the YAML`

### Task 17.2: The packages that lost their reason

**Files:**
- Delete or modify per spec 16.6's table: `tooling/core-packs` (Plus half; the package if nothing else needs it),
  `tooling/api-report/src/seams.ts`, `tooling/bundle-report` (into `release-checks.yml` with a per-game budget, or
  deleted), `tooling/evidence` (the Proof half), `tooling/versions` (stack rows), `tooling/examples-runner` (confirm
  task 10.2 left only the examples index; knip finds nothing of the playground)

- [ ] **Step 1:** For each, `grep` its importers and scripts; decide per the table; write the decision and the line
  counts in the execution log.
- [ ] **Step 2:** `pnpm check`, `pnpm knip` clean. Commit. `chore(tooling): drop what Plus and the old site needed`

### Task 17.3: The code refactor of the tooling that stays (same PR)

**Files:** the `tooling/*/src` packages left after 17.2, their tests and READMEs

- [ ] **Step 1: The read.** Spec 17.3's checks per package; findings in the execution log first.
- [ ] **Step 2:** Fix, one package per commit. Counts equal or lower only by listed dead code; `pnpm check`. Mark ready.
  `refactor(tooling): minimal, documented internals`

---

## Phase 18: The lean site (one PR, `claude/refactor-site-lean`)

### Task 18.0: The shared layout, fixed first (PR `claude/refactor-site-shared`; added 2026-11-06, [site visual audit](2026-11-06-site-visual-audit.md))

Every page phase 18 rebuilds inherits the header, the footer, the code blocks and the menu, so their faults are fixed
before it. The footer's contact address stays as it is until the Owner decides (D8).

**Files:**
- Modify: `site/src/app.css`, `site/src/lib/components/{Header,Footer,CommandMenu}.svelte`, the code block and copy
  button components, the docs "On this page" list, the demo toolbar
- Test: `site/tests/e2e/site.e2e.ts` (a rule over every page at the six sizes of the audit)

- [ ] **Step 1: Failing tests.** At every size of the audit (390 × 844, 844 × 390, 820 × 1180, 1180 × 820,
  1080 × 1920, 1440 × 900; phone and tablet as touch): every link and button is at least 44 px tall (48 px for a
  primary), stand-alone text links and the logo included (M1); no code block breaks inside a word, and every block
  scrolls sideways the same way with its Copy button in one place (M2); the open phone menu is opaque, nothing shows
  through it (M4); on a touch device the Search button shows no `⌘K` and the search dialog no keyboard hint (L1).
- [ ] **Step 2:** Fix each in the shared CSS or component, never per page.
- [ ] **Step 3:** Rerun the audit's scripts (`docs/refactor/2026-11-06-site-visual-audit/scripts/`, `vite preview` on
  4417); M1, M2, M4 and L1 read 0. Commit. `fix(site): tap targets, code blocks, the phone menu and touch hints`

### Task 18.1: Features, the page cut and redirects

**Files:**
- Move: `site/src/lib/components/*` → `site/src/shared/components/`; `site/src/lib/playground/` → `site/src/features/playground/`;
  each kept page's data and components → `site/src/features/<page>/`
- Delete: the routes and data of Showcase, Community, AI, Inside, Proof, Releases, Cheatsheet, Sources and their tests
- Create: `site/src/features/redirects/redirects.ts`, `site/scripts/write-redirects.ts`
- Modify: root `package.json` (`boundaries --features site`), `site/src/routes/**` (thin)
- Test: `site/tests/unit/redirects.test.ts`

- [ ] **Step 1: Failing test:** the redirect map sends `/ai` and `/inside` to `/docs/how-it-works`, `/cheatsheet` to
  `/api`, and `/showcase`, `/community`, `/proof`, `/releases`, `/sources` to `/`; the build writes a page for each that
  redirects (meta refresh plus a link, so it works on any static host).
- [ ] **Step 2:** Move and delete. `pnpm boundaries` passes with `--features site`. Unit and e2e gates pass in
  Chromium. Commit. `refactor(site): seven pages, grouped by feature`

### Task 18.2: Home and Start on the current code

**Files:**
- Modify: `site/src/features/home/**`, `site/src/features/start/**`, `site/src/shared/framework/starter-files.ts`
  (create: reads `create-game`'s template at build time)
- Test: `site/tests/unit/home/*.test.ts`, `site/tests/unit/start/*.test.ts`

- [ ] **Step 1: Failing tests:** Home's walk-through shows three files that exist in `create-game`'s template (the
  test reads the template); Start's first command is `npx @mcthaydt/automata-tools create-game`; no page text mentions
  `@af-examples/base-2d`, `base-2d`, `git clone`, Effect in the browser, or files the refactor deleted (W1, W2, WG3).
- [ ] **Step 2:** Rewrite both pages, on the shared tokens and the kit's look. Start has the four steps of spec 10.2
  and "Using a coding agent" (the AI page's setup). Copy rows. Commit. `feat(site): Home and Start describe the
  framework as it is`
- [ ] **Step G (added 2026-11-06, [grandma audit](2026-11-06-grandma-ux-copy-audit.md) findings 2, 5, 6, 18):** the Emberwick embed starts upright on an upright phone (the game's orientation check or the embed's aspect ratio); no promise of a remix or a demo that is not there; every Emberwick link lands on Emberwick; the demo's controls show only while it plays.
- [ ] **Step V (added 2026-11-06, [site visual audit](2026-11-06-site-visual-audit.md) H5, M3, M6, L2, L3, L4, L7):** the first example shows something (a title, a coloured field, a line of text), not a black box; at 844 × 390 the Emberwick demo and an example's preview start above the fold (the facts table folds); the footer's two API links become one ("Reference"); the double-jump picture is re-shot or removed; Home's desktop gutter label, lone card and uneven cards go; the hero's two actions stay side by side or stack aligned; the comments in Emberwick's code shown on Home read plainly.

### Task 18.3: The editor page and "Try the editor"

**Files:**
- Modify: `site/src/features/editor/**`, `site/scripts/build-demos.ts` (copies `packages/editor/dist/2d` to
  `/editor/app/`), `site/src/shared/csp.ts` (if the editor needs anything new; it must not need `eval`)
- Test: `site/tests/unit/editor/*.test.ts`, `site/tests/e2e/editor-try.test.ts`

- [ ] **Step 1: Failing e2e (Chromium):** `/editor` shows three pictures from the design board and "Try the editor";
  it opens `/editor/app/`, which starts on browser storage with no console error under the site's CSP.
- [ ] **Step 2:** Implement. If Pixi needs `eval` there, the editor's `main.ts` imports `@mcthaydt/automata/no-eval`
  first (spec risks). Copy rows. Commit. `feat(site): try the 2D editor on the site`
- [ ] **Step V (added 2026-11-06, [site visual audit](2026-11-06-site-visual-audit.md) L8):** Privacy says that the try-it editor keeps levels in this browser's storage and nowhere else.

### Task 18.4: Docs and API

**Files:**
- Modify: `site/src/features/docs/**` (the guides from `docs/guides/` and "How it works"), `site/src/features/api/**`,
  `site/scripts/write-seo-files.ts` (`llms*.txt` from the docs and API at build time)
- Create: `docs/guides/how-it-works.md` (folds today's ECS, determinism, CSP and runtime pages into one, for the four
  packages; in the framework's docs so the site reads it like any guide)
- Test: `site/tests/unit/docs/*.test.ts`, `site/tests/unit/api/*.test.ts`

- [ ] **Step 1: Failing tests:** the docs nav is the guides plus How it works, in the order of a `docs/guides/index.md`
  list; no doc says "Effect Runtime" or "planned" for the desktop build (W4, W7); the API has one page per published
  package with the current names.
- [ ] **Step 2:** Implement; write `how-it-works.md` (drunk grandma test applies). Commit.
  `feat(site): docs from the framework's guides, API generated`
- [ ] **Step V (added 2026-11-06, [site visual audit](2026-11-06-site-visual-audit.md) H4):** no API page is longer than about ten phone screens: a package's page is an index of its export groups, each group collapsed or on a page of its own, with a jump list at the top.

### Task 18.5: The code refactor of the site (same PR)

**Files:** `site/src/**`, `site/scripts/**`, their tests, `site/README.md`

- [ ] **Step 1: The read.** Spec 17.3's checks over the site (the playground's compile, orchestrator and live code,
  the shared components, the loaders, the build scripts); findings in the execution log first.
- [ ] **Step 2:** Fix, one concern per commit. The site's unit and Chromium e2e counts equal or lower only by listed
  dead code; `pnpm --filter @mcthaydt/automata-site build` passes. Mark ready. `refactor(site): minimal, documented code`

---

## Phase 19: The site's journeys and link checks (one PR, `claude/refactor-site-tests`)

### Task 19.1: The visitor's journey

**Files:**
- Create: `site/tests/e2e/visitor.test.ts`
- Modify: `site/playwright.config.ts` (`defineJourneys`; phone and desktop in Chromium and WebKit)

- [ ] **Step 1:** Write spec 10.4's journey (land, play Emberwick inline, Start, copy the command, Editor, Try,
  make a platformer level, paint, reload, still there). Run in Chromium → pass. WebKit: the Owner's.
- [ ] **Step 2: Commit.** `test(site): a visitor's journey from the home page to their first level`
- [ ] **Step G (added 2026-11-06, [grandma audit](2026-11-06-grandma-ux-copy-audit.md) finding 2):** the visitor's journey runs at a phone size too and plays the Emberwick embed upright.
- [ ] **Step V (added 2026-11-06, [site visual audit](2026-11-06-site-visual-audit.md) section 4):** rerun the visual audit's scripts on the rebuilt site; every finding it measures reads 0 or is explained in the PR; rerun them on the editor's screens after phase 12.

### Task 19.2: Links, privacy and the closed beta

**Files:**
- Create: `site/tests/e2e/links.test.ts`, `site/src/shared/config.ts` (`repositoryPublic: false`, `origin`)
- Create: `site/scripts/scan-closed-beta.ts` (calls `findPixi3d` from `@mcthaydt/automata-tools/internal` on `build/`;
  the site depends on `-tools`, never the other way, so there is no cycle)
- Modify: `site/package.json` (`build` ends with `node scripts/scan-closed-beta.ts build`)
- Delete: remaining claim-to-data tests that pin history (WT1); list them in the execution log

- [ ] **Step 1: Failing tests:** every internal link and anchor in the built site resolves; no link to
  `github.com/mcthaydt/automata-framework` while `repositoryPublic` is false; the scan passes on the build and fails on
  a fixture with the beta's marker.
- [ ] **Step 2:** Fix every broken link the test finds (W6). Commit, mark ready.
  `test(site): links resolve, none reach the private repository, no closed beta`

---

## Phase 20: The site's and the CLI's copy (one PR, `claude/refactor-site-copy`)

### Task 20.1: The copy table

**Files:**
- Modify: `docs/refactor/copy.md` ("Site", plus the CLI's editor and check messages), every site page and CLI message
  it changes

- [ ] **Step 1:** List every visible string on the seven pages (from the built HTML) and the CLI's editor and check
  output; each passes the four questions or is rewritten. Two audiences, one path (WG1): Home and Start speak to a game
  maker; How it works and API are where the engine words live. Keep the voice of WG4.
- [ ] **Step 2:** The visitor journey asserts Home's headline, Start's steps and the Editor page's button by role and
  name. `pnpm check`, site e2e in Chromium. Commit, mark ready. `docs(site): plain words on every page`
- [ ] **Step G (added 2026-11-06, [grandma audit](2026-11-06-grandma-ux-copy-audit.md) sections 3 and 4, finding 19):** every row of the audit's section 4; the guides (`docs/guides/*.md`) are in the string list (`editor.md` drops "build it first" and opens with run, open, draw, Save); the search placeholder and ranking, the playground's messages (the Determinism row behind "For developers"), the examples' titles as sentences, and the CLI's "Opened Emberwick in the level editor."

---

## Phase 21: Launch (one PR, `claude/refactor-site-launch`, then the Owner's steps)

### Task 21.0: The site's own domain (added 2026-11-06)

The Owner, 2026-11-06 (relayed): "Let's also use automataframework.com for the site as well; we can't couple this
tightly to ruken". This answers D8's domain.

- [x] **Step 1:** Every site URL moves to `https://automataframework.com`: `SITE_ORIGIN` (`site/src/lib/site.js`, which
  the canonical and Open Graph links, the sitemap, `robots.txt` and the playground's origin read), the docs links
  check in `site/src/lib/utils/markdown.ts`, `site/static/.well-known/security.txt`, and the site's tests. Done
  2026-11-06 (session 9): the demos and the playground rebuilt with the new origin; site unit 353 pass. The only
  `ruken.com` left in a built page is the Ruken target's host check inside the game bundle, which is about Ruken's
  own origin and stays.
- [ ] **Step 2 (the Owner's):** register `automataframework.com` (if it is not already), point its DNS at the host
  chosen in 21.2 (an apex record, or `ALIAS`/`ANAME`/flattened `CNAME`, plus `www` redirecting to the apex), and turn on
  HTTPS at the host. The contact address and the host stay D8's.

### Task 21.1: The deploy, ready

**Files:**
- Create: `.github/workflows/site.yml` (build on PRs inside the `e2e-2d` job's needs; deploy on `main` when the host
  secret exists, else print "No host configured yet." and pass)
- Modify: `site/src/shared/config.ts` (origin from one constant), `site/static/.well-known/security.txt`,
  `site/src/features/legal/**` (the contact address placeholder `CONTACT_ADDRESS`, filled in 21.2), `docs/runbook.md`
  (the Owner's launch steps)
- Test: `site/tests/unit/legal.test.ts` (no personal mailbox in any page or `security.txt`; W9)

- [ ] **Step 1:** Failing test, then the change. `pnpm lint:actions` if Docker exists, else the Owner's.
- [ ] **Step 2:** The deploy job runs on this PR's head and prints "No host configured yet." Commit, mark ready, merge
  when green.

### Task 21.2: The Owner's inputs and go (the Owner)

- [ ] The Owner supplies the host (the domain is `automataframework.com`, task 21.0) and its deploy secret, the project contact address and `NPM_TOKEN`
  (D8). The agent fills `config.ts`, the contact address and DNS notes in one PR, merges it when green, and the deploy
  runs.
- [ ] The Owner approves the first npmjs.org release; the agent runs the consumer smoke against the real registry and
  records it.
- [ ] The Owner creates the npm organisation (the name task 14.1 needs, if not given earlier) and the `SKILLS_TOKEN`
  for `automata-skills` (D16, D17).
- [ ] The Owner archives `mcthaydt/automata-website`, `mcthaydt/automata-plus` and the nine older Automata repositories
  (or says which to keep), lets the branch prune run in Plus and the website, and updates the repository descriptions
  (D12, D17, P5 to P7). The agent prepares the list and the `gh` one-liners; repository writes are refused from a cloud
  session.
- [ ] The Owner says whether outside authors can publish to Ruken (D11); the Ruken guide says the answer.
- [ ] The agent closes #379 and #383 with a pointer to #403 (ported there); deleting their branches is the Owner's.
- [ ] No deprecation of the GitHub Packages names is needed (rest-of-AF audit U7: nobody outside this repository,
  Plus and the website installed them). If the Owner wants them gone, deleting the package versions on GitHub is
  theirs; the runbook says where.
- [ ] The Owner opens the site and the editor on the iPad (a real-device test is the Owner's).

---

## Done (stage 4's last step)

- [ ] Every row in `progress.md`'s build table says Done, with its engines.
- [ ] Section 1 of the spec: each criterion has its command or the Owner's record beside it in `progress.md`.
- [ ] `docs/status.md`, `AGENTS.md` (the editor package, the site, the gates) and the memory notes describe what is
  there.

---

## Execution log

(Each session appends: date, tasks touched, counts before and after, engines run, first-attempt failures, deviations
from this plan with their reason, and a two-line handoff.)

### 2026-11-06, session 1 (Sonnet, high)

- Tasks 1.1 and 1.2 (phase 1). Node 24.22 from `/opt/node24`; `pnpm install --frozen-lockfile` works in the cloud
  session. `pnpm check` passed: 25 unit tasks, editor-kit 1,373, editor-2d 1,552, `automata` 1,841, `-tools` 673,
  repo-hygiene 82 (before the new gate test; 90 with it).
- Chromium only: editor-2d `layout`, `canvas` and `browsers` projects 259 passed, 6 skipped (the plan's 252 + 6; the canvas
  project now counts); editor-kit `layout` 129 passed. The journeys projects need WebKit, which does not install here:
  first attempt failed with the WebKit launch error, expected, left to the Owner's `pnpm ci:local`.
- Deviations: the editors' `test:browser` also gained `canvas` (editor-2d) so the canvas tests run in a workflow, as the
  task text asks. `actionlint` needs Docker: not run; the three workflow files parse as YAML.
- Handoff: phase 1 committed on `claude/project-thread-s8zs6m` (draft PR). Next: phase 2, task 2.1 (the stranger's journey).

### 2026-11-06, session 1 continued: phase 2 (Sonnet, high)

- Tasks 2.1 to 2.4 on `claude/refactor-new-game`, stacked on phase 1. `pnpm check` green (`-tools` 690 unit tests). The
  stranger's journey (make, install, check, test, play, itch.io zip) passes in Chromium in about 26 s. It first failed at
  "make a game" with `workspace:*` instead of `^0.0.5` (finding N1), as the plan said it would.
- Deviations: (1) the journey writes the overrides to `pnpm-workspace.yaml`, because current pnpm ignores
  `pnpm.overrides` in `package.json`; (2) it installs `-tools` from the packs into `<folder>/tools` and runs its bin,
  because `npx --package <tgz>` cannot resolve dependencies that are not published yet; (3) no fixture-package drift guard,
  because the journey is the drift guard; (4) the old `-tools` create-game journey is deleted and its assertions (title,
  play, Escape pauses, Resume focused, no console errors) moved into the stranger's "play" step, so the `-tools`
  `test:e2e` script and its CI filter entries are gone (supersedes the mention in task 7.3); (5) the new game's README
  names the Docs on the site without a URL, because the domain is task 21.2.
- Not run: WebKit, Firefox, hosted CI.
- Handoff: next is phase 3, task 3.1 (what leaves from `-tools`).

### 2026-11-06, session 1 continued: phase 3, task 3.5 step 1 (the read of `packages/tools/src`)

Counts before: `-tools` unit tests 794 (the 148 boundaries tests came in with 3.3). `pnpm knip` clean. No subagents; the
checks below were run with `wc`, a function-length scan over the syntax tree (oxc) and `git grep`.

| Check | Finding |
|---|---|
| Unused code | `SHIP_PACKAGE` (`shared/package-name.ts`) is exported and imported nowhere: delete. `shared/ship/testing/fake-process-runner.ts` is a test helper in a feature path; only tests import it: move to `src/testing/`. |
| Single-implementation abstractions | None to remove. `Files`, `ProcessRunner` and `CspProbe` are the seams tests swap; `errors-ruken.ts` and `errors-tauri.ts` are per-target error files that `errors.ts` re-exports, and they keep `errors.ts` under 300 lines. |
| Forwarding layers | None found. `entries/node-services.ts` is an entry re-export, which entries are for. |
| Duplicates | (1) The secrets, then closed-beta (`@pixi/3d`) scan is written out four times: `prepare-build.ts` (`checkBuild`), `prepare-itch.ts`, `prepare-web.ts`, `prepare-tauri.ts`; (2) the release-tag check (`checkVersion` then `VersionMismatch`) four times; (3) `attempt(path, run)` (a `try` that becomes a `FileError`) five times: `files.ts`, `prepare-web.ts`, `prepare-itch.ts`, `prepare-tauri.ts`, `publish-downloads-to-itch.ts`. |
| Long files (over 300 lines) | `shared/check/check-steps.ts` 399, `features/boundaries/check.ts` 380, `shared/create-game/template.ts` 367. |
| Long functions (over 60 lines) | `serveEditor` 168 (`features/editor/serve-editor.ts`), `checkSource` 209 with its `visit` 107 (`features/boundaries/check.ts`), `prepareTauri` 98, `program` 93 (`app/ship-cli.ts`), `createGame` 71, `tauriProjectFiles` 67 (a table of generated files: left), `checkBuild` 62. |
| Missing explanations | No file-level comment: `app/cli.ts`, `shared/create-game/create-game.ts`, `shared/ship/errors.ts`, `shared/ship/testing/fake-process-runner.ts`. |
| Tests that test the implementation | Not found in the ship, check and create-game tests read so far (they run the real function over a temp folder or a fake `ProcessRunner`). The boundaries tests run the real CLI as a process. |

Fixes, one concern per commit: unused code; the three duplicates; long functions (`prepareTauri`, `program`,
`createGame`, `checkBuild`); long files (`check-steps.ts`, `template.ts`, `check.ts`); headers. `serveEditor` and
`checkSource` are one closure over shared state each: split only if it can be done without a behaviour change, else
listed as left with the reason.

### 2026-11-06, session 1 end (90 minutes): phases 2 and 3

- Phase 3 on `claude/refactor-tools-surface`, stacked on phase 2. Tasks 3.1 to 3.4 done; 3.5 in progress. `-tools` unit
  tests: 690 before phase 3, 594 after 3.1 (the deleted `add`, `deploy-dev`, `test-remote` and deploy-folder tests, listed
  by file in the commit), 607 after 3.2 and 3.3 before the boundaries tests, 755 with them (the 148 boundaries tests
  moved in from `tooling/check-boundaries`), 803 now (new: web prepare, help, entries, build-scans, boundaries CLI).
  `pnpm check`, the consumer smoke from packs and the stranger's journey pass in Chromium.
- The last commit that holds the deleted code (`add`, `deploy-dev`, `test-remote`, `packages/tools/deploy/`, the dev-host
  job): `e523f860`. Cloud sessions cannot push tags: the Owner tags it if wanted.
- Deviations: (1) `ship prepare --target web` checks the build the game made; it does not run Vite (the other targets do
  not either), and writes nothing; (2) `create-game` also writes `prepare:web`, so the web path has the same two steps as
  the others; (3) `ship --help`, `check --help`, `build --help`, `editor --help` and `create-game --help` are each
  their own text (`app/help.ts`), and `automata --help` is seven lines; (4) a bare `automata <folder>` no longer makes a
  game: only `create-game` does, and any other word is "Unknown command" (otherwise `automata add` would have made a
  game called "add"); (5) `pnpm ci:remote` was not created (the Owner's call, per the task); (6) the internal entry holds
  only what the repository imports today plus `findPixi3d` (the site build's caller, task 7.3); (7) `pnpm-lock.yaml`
  dropped `semver`, `@types/semver` (used only by `add`) and the `check-boundaries` workspace link.
- Left in 3.5: the long functions and files and the four headers (list above). Then mark the phase 3 PR ready.
- Handoff: resume at task 3.5 step 2 ("long functions"), then phase 4. Task 14.1 (the scope rename) waits for the Owner to
  confirm the `automata` npm organisation exists.

### 2026-11-06, session 2 (Sonnet, high): task 3.5 finished

- Task 3.5 done on `claude/project-thread-pbmc59` (stacked on phase 3's branch). `-tools` unit tests: 803 before, 809
  after (the six new ones test `checkout.ts`, which came out of `serve-editor.ts`; no test was removed). `pnpm check`
  (24 tasks, 4 m 49 s), `pnpm build`, `pnpm api-report` (no change to a published export), `pnpm agent-skills`, the
  consumer smoke from packs (7 of 7 steps shown) and the stranger's journey (Chromium, 31 s) pass. WebKit, Firefox and
  hosted CI not run.
- What was fixed, one concern per commit (the findings list above): `prepareTauri`, the ship command (`program` became
  one function per target), `createGame` and `checkBuild` each read as their steps; `check-steps.ts` (399 lines) split
  into the tools and what a step returns (`check-tool.ts`), the steps that run something (`check-steps.ts`) and the
  steps that compare sources with `ship.config.ts` (`check-source-steps.ts`, with one `readSources` instead of three
  copies of the same loop); `template.ts` (367) split into the options (`template-file.ts`), the project's files
  (`template-project.ts`) and the game's (`template-game.ts`); `features/boundaries/check.ts` (380, one 209-line
  function) split into the tables (`sim-rules.ts`), the import rule (`sim-imports.ts`), the shared tree helpers
  (`ast.ts`: `childrenOf`, `lineLocator`) and one small function per rule, so `checkSource` is a parse and a walk;
  `serve-editor.ts` (248, one 168-line function) split into the server, the routes and `checkout.ts` (the real-path
  guard, the listing and the guarded write); headers on `app/cli.ts` and `fake-process-runner.ts` (the other two had
  been added already). A write that loses its race no longer creates the folder it was going to write into.
- Left, listed with the reason: `tauriProjectFiles` (67 lines) is a table of generated files; every other function
  over 60 lines is gone. Every file under `packages/tools/src` is at most 300 lines.
- Deviations: none from the plan. `TOOLS.boundaries` still names the retired `automata-check-boundaries` package in
  the install hint nothing prints (the tests use it as the tool's name); left, since renaming it would touch the
  report's tool names.
- Handoff: phase 3 is done; mark its PR ready when the stack head's checks are the Owner's to run. Next: phase 4,
  task 4.1 (the move map and the package skeleton).

### 2026-11-06, session 3 (Sonnet, high): tasks 4.1 and 4.2

- Task 4.1 done: `docs/refactor/move-map-editor.json` (70 folder rows, an `entries` table for the specifier rewrite),
  the skeleton, and the entries. 764 files move by rename; none unmapped, none clashing.
- Task 4.2 done on `claude/project-thread-pbmc59`: `editor-kit`, `editor-2d` and `editor-suite` are `packages/editor`
  (`app/`, `features/`, `shared/{kit,level-2d,editor-list}`, `entries/`, `testing/`). `pnpm lint`, typecheck (30 tasks),
  `boundaries`, `style`, `knip`, the three builds (`editor` writes `dist/2d` and `dist/suite`, `editor-3d` writes
  `dist/suite`, `-tools`) and `pnpm api-report --update` (three reports become `editor.api.md`) pass.
- Counts (step 1 and step 7). Before, unit and DOM: kit 1,373, editor-2d 1,552, editor-suite 423 (3,348), editor-3d
  2,857. After: editor 3,268, editor-3d 2,932. Every difference, by test name against a run of the old packages at
  `f86d3bbb`: the Studio's 73 tests and the two "Levels 3D in the suite" tests now count in `editor-3d` (+75); nine tests
  of `editor-2d/src/index.ts` and one of the suite's `node/index.ts` went with those entries (S3); the 2D architecture
  test gained three tests (the kit's Svelte shell stays out of the core, entries and test helpers may import a profile,
  every rule's prefix finds files); the headless test now also covers `shared/editor-list` (the five files that used to
  sit in the suite core), so its 14 per-file tests are unchanged. Chromium: layout, kit layout and parity 452 pass;
  canvas 49 pass, 6 skipped (WebKit, Firefox and the journeys not run: not installed here).
- Deviations: (1) the editor's own 2D architecture test now scans all of `src/` (it only saw `src/` of `editor-2d`),
  which found nothing new but made the profile rule name its three kinds of importer (the app's registration file, the
  entries, test helpers); (2) the two suite tests that mount Levels 2D and Levels 3D together are split: the 2D half stays
  in `editor`, the 3D half is `editor-3d/src/ui/suite/suite-levels.*.test.ts`, with the shared layout helpers exported as
  `@mcthaydt/automata-editor/suite/testing` and `.../suite/testing/layout`; (3) `editor-3d`'s full suite page entry and
  its content shim sit at `src/suite-main.ts` and `src/suite-content-shim.ts`, outside `ui/`, so its architecture test
  keeps its rule (views take their clock from the boot); (4) `packages/editor/biome.json` keeps the old kit's ignore of
  the documents fixtures (a first `pnpm format` rewrote them, caught by the comparison above and restored byte for byte);
  (5) `tests/fixtures/dom-matchers.d.ts` restores jest-dom's RegExp overload of `toHaveTextContent`, which
  `vitest/browser`'s declaration shadows once one program holds jsdom and browser tests; 4.3 separates the two.
  `@mcthaydt/vitest-preset` is not yet a dependency (knip): 4.3 adds it.
- Handoff: next is task 4.3 (the preset's named browser projects, the editor's suffix table, then the move).

### 2026-11-06, session 3 (continued): task 4.3

- Task 4.3 done: the editor's tests are in `packages/editor/tests/`. 295 files moved with `move-tests` (unit 268, browser 27),
  plus the five 2D journeys and four kit journeys that 4.2 had already put under `tests/browser/journeys/` (renamed to
  `.test.ts`), `scripts/remove-profiles.test.ts`, and the two storage layout tests (their own folder, below).
- The preset: `defineTests({ browserProjects })` (tested first, five new tests): one project per folder of `tests/browser/`
  with its own engines and an optional `instance(engine)` that may return several instances; two projects with one name
  throw. `journeyInstance(playwright)(engine)` is the iPad context as an instance (two tests). `move-tests` gained
  `browserFolders` (layout, canvas, parity and journey tests go to `tests/browser/<kind>/`), `featureFolders` (`features/`
  is left out of a feature's test folder, as in the other packages) and a folded-qualifier table (`patch.refusal.test.ts` is
  `patch-refusal.test.ts`), each with fixture tests (49 codemod tests, was 44).
- The config is one `defineTests` call: `unit` (Node, Svelte compiled, Testing Library, jest-dom, CSS) and five browser
  projects: `parity` (also run in Node), `layout`, `storage`, `canvas`, `journeys`. The storage tests (the two that need a
  persistent profile in Chromium and WebKit, and the private-window one in an ephemeral WebKit) have their own project,
  because with the persistent profile on, Vitest runs a project's files one at a time: the rest of the kit's layout tests,
  which only ran that way because they shared a project, now run in parallel in the default context.
  `vitest.global-teardown.ts` is gone; the config removes the profiles when the process exits, which was its second line of
  defence.
- Counts. Unit: 3,268 before, 3,270 after: the two `journeyInstance` tests; every other test is where it was. 29 kit
  component tests had no `.dom` in their name and ran in jsdom because the old kit project did; each got the
  `// @vitest-environment jsdom` first line. Chromium browser projects: 527 pass, 6 skipped, 0 fail (parity, layout,
  storage, canvas, journeys), where 4.2 ran 452 + 49 pass and 6 skipped without the journeys: the 26 more are the nine
  journey files, run here in Chromium with the iPad context because WebKit is not installed (WebKit and Firefox not run).
  `pnpm style --test-imports packages/editor`: 0 findings (the root `style` script now lists the package).
- Step 6: the root `test:unit:2d` and `test:browser:2d` filters exclude the 3D packages, so `packages/editor` is in both
  already; no edit. `pnpm lint`, typecheck, boundaries, style and knip pass.
- Deviations: (1) the persistent-profile project is named `storage`, not part of `layout`; (2) `journeys` runs WebKit and
  Chromium, as the plan says, so the iPad flows can run where WebKit is missing.
- Handoff (session 3 ends here, at a clean point): next is task 4.4. Start with `--forbid` in
  `packages/tools/src/features/boundaries/` (the fixture test first), then the shared-island rule, then run both on
  `packages/editor` and fix each finding by passing the function in from `app/editor-2d/` or `app/suite/`.

### 2026-11-06, session 4 (Sonnet, high): task 4.4

- Task 4.4 done on `claude/project-thread-nw26wp` (stacked on #412's head). `--forbid <root>:<package>,...` is
  `features/boundaries/forbid.ts` (8 fixture tests; value, type, dynamic and re-export imports, tests and Svelte included, a
  name in a string or comment ignored, `@pixi/3d-extras` is not `@pixi/3d`). `--features ... --shared-island kit` makes
  `shared/kit/` import only itself (3 tests, two through the real CLI). Both are in the root `boundaries` script.
- Findings on `packages/editor`: `--forbid` 0 (705 files). `--features --shared-island kit` 39 on the first run (the
  kit island itself had none). How each went to 0, with no behaviour change (unit 3,270 before and after, every test
  moved by name):
  - The Level view's logic is a feature: `app/editor-2d/level-editor.ts` is `features/level/level-editor.ts`. The types
    other areas read are shared: `EditHistory` and `projectHistory` (`shared/level-2d/model/edit-history.ts`),
    `LevelTool` and `LevelEditorView` (`.../model/editor-view.ts`, which the canvas reads), `field-commit.ts`,
    `tile-sprite.ts`, `palette-model.ts`, and the map's `world-links.ts` and `world-model.ts` (`.../model/world/`).
  - The documents model that Home and the document screen both use is `shared/level-2d/documents/`: `editor-app.ts`,
    `project-list.ts`, `read-document.ts`, and `open-flow-model.ts` with `openProblem`, which moved there from Home's model
    (its test went with it). `createAppProfiles` stays in `app/editor-2d/profiles.ts`.
  - The view router (`views.ts`) is in `app/editor-2d/`; Levels 2D as a suite editor (session, regions, status, the
    suite editor) is `app/suite/levels-2d/`, since it composes the Level and document features.
  - The in-memory suite ports (`memory-*.ts`, `scripted-ask.ts`) and `sample-ports.ts` with the sample game's editor list
    are product code, because the suite page opens the sample when no checkout answers: they are
    `features/suite/memory/`. `testing/ports` contracts import them. `GateRecords` is defined beside `createMemoryGates`.
- Deviations: (1) the plan said to pass functions in from `app/`; for these files the code was shared or one feature's
  own, so it moved instead (the spec allows "or moving a file that two features use to `shared/`"); (2) the sample
  game's `floorfifty.editors.toml` moved with the ports, so two tests read it from there (4.5 renames it).
- Browser (Chromium, `--project '*chromium*'`): see the row in `progress.md`.
- Handoff: next is task 4.5. Run `style` with the editor added and rewrite the plan-ID comments by area.

### 2026-11-06, session 4 (continued): task 4.5

- Step 1: the editor joined `style`'s `--plan-comments` and `--comments-only` (`--test-imports` already had it).
  446 plan-citing comment lines in `src/` and the same kind in `tests/` were rewritten: a throwaway script removed the
  parentheticals that held only a plan code, a decision, a step or a spec section (about 370), and 73 more were worded by
  hand (what a moved file was, what a later task would add). Comments now say what the code does and why; none names a
  plan. `pnpm style`: 0 findings in 2,041 files.
- Step 2: fixtures `floorfifty.editors.toml` is `platformer.editors.toml`, `last-light-bay.editors.toml` is
  `bay.editors.toml`, `floorfifty-tuning.toml` and `-juice.toml` are `platformer-*.toml`, `FLOORFIFTY_SAMPLE` is `SAMPLE_GAME`
  (the package's suite entry and `editor-3d`'s suite page follow). The documents fixtures' `SOURCE.json` names its origins
  `adventure` and `arcade` and points at `docs/provenance/sources.md`, and one fixture's French word was neutral-ised and
  its byte count and sha repinned. `grep -rniE "floorfifty|last light|last-light" packages/editor` finds nothing.
- Step 3: `pnpm knip` reports nothing unused in `packages/editor` (the earlier moves and the root entry trim had
  already taken what was dead). Unit tests 3,270 → 3,268: the two tests that checked a fixture file names its source
  commit are gone, since the commit now lives only in `SOURCE.json` and the provenance file.
- Step 4: the 2D editor's, the suite's and the kit's mock-ups are in `docs/archive/design/` (`docs/design/editor-3d`
  stays for the 3D slice); `docs/README.md` and `knip.jsonc` follow; `docs/guides/editor.md` names the 2D editor's build
  and `--app 2d` (the default switches in 7.1, the full rewrite is 12.5).
- Handoff: next is task 4.6 (the editor's logic refactor). Read area by area, log the findings first.

### 2026-11-06, session 4 (continued): task 4.6, the read and the first fixes

Step 1, the findings over `packages/editor/src` (288 `.ts` files, measured, not guessed). Counts before: unit 3,268;
Chromium browser projects 527 pass, 6 skipped.

| Check | Found |
|---|---|
| Unused code | `pnpm knip` clean (4.5 removed it). |
| Single-implementation abstractions | 55 `create*` factories; the ones with one implementation are the sessions and controllers the views and tests drive, which are the seams 17.2 allows. None folded. |
| Forwarding layers | `shared/kit/documents/index.ts` (a barrel, 8 of 17 lines re-export) and `app/suite/levels-2d/index.ts`; both stay, since `entries/` and the app import through them. |
| Duplicates | Two `createTestClock` (merged, fixed below). Two `memory-workspace.ts` are not copies: the testing one is a plain in-memory `Workspace`, the suite one is the editor list's policy over a store. Two JSON scanners (`model/json-syntax.ts` finds the first syntax error; `kit/documents/json/locate.ts` locates literals) share a tokenizer shape; merging them would change the error panel's engine-independent messages, so left for a later task with its own tests. Two `text-diff.ts` and two `home-model.ts` are different things. |
| Long files (over 300) | `kit/documents/json/structure.ts` 401, `level/level-editor.ts` 397, `kit/documents/json/patch.ts` 365, `editor-list/write-path.ts` 336, `kit/gestures/recognizer.ts` 330, `level-2d/documents/editor-app.ts` 313, `level-2d/model/project-codec.ts` 311, `kit/documents/content-document.ts` 308. |
| Long functions (over 60) | 40 functions; the longest are `createLevelEditor` 285, `createRecognizer` 256, `createWritePath` 240, `createGitChangeSet` 199, `createTilesetsSession` 193. |
| Missing explanations | 34 files had no header comment before their first code line. |
| Tests that test the implementation | Not yet read. |

Fixes done: one test clock for the storage and gesture tests (`testing/kit/test-clock.ts`; the second copy and its 32
imports are gone; the storage tests pass with the shared default start); header comments for 33 of the 34 (the other, `handle-store.ts`, explains itself in a comment under its imports)
none (checked against each file's exports).

More fixes (one concern per commit): `json/structure.ts` 401 → 258 lines (`shape.ts` holds the file's reading and the shape
error, `render-like.ts` the writing of a value like its neighbours); `json/patch.ts` 365 → 255 (`patch-check.ts` holds the
refusal reasons and the guard that every result reads as the model it should); `level-editor.ts` 397 → 343
(`level-editor-support.ts` holds the gesture types, the layer lookup and the pointer-to-cell arithmetic). Two comments
that still named a source project across a wrapped line were reworded (the earlier grep read one line at a time). Unused
imports in three files removed. Unit tests 3,268 equal after each. A second duplicate scan (the same name defined in two source files) found and merged
three more: `systemClock` (the editor app and `main.ts` each had a copy of `kit/storage/clock.ts`'s), `baseName` (five
copies, now one in `store-path.ts`, also used by two inline spellings) and `hasValue` (two copies). Other same-name
pairs are different things (`clamp` has four different signatures; the two `firstDifference` and `firstUnwritable`
are the generic and the JSON-number-style versions).

Left: the files still over 300 lines (`write-path.ts` 336, `recognizer.ts` 330, `editor-app.ts` 313, `project-codec.ts`
311, `content-document.ts` 308, `level-editor.ts` 343), the longest functions (`createLevelEditor` 250, `createRecognizer`
256, `createWritePath` 240), the tests read for implementation coupling, and the JSON scanner question. The next session
continues here.

### 2026-11-06, session 5: task 4.6 finished

Left over from session 4, all closed:

- **Files over 300 lines, all under now.** `write-path.ts` 336 → 284 (`write-history.ts` holds the undo and redo stacks per
  owner, `write-journal.ts` the change set's title prompt, baseline measures and journal entries); `recognizer.ts` 330 →
  294 (`sample-gestures.ts` builds the drag, hover and wheel events from a sample); `project-codec.ts` 313 → 218
  (`project-checks.ts` holds the id and reference checks and `OpenIssue`); `editor-app.ts` 313 → 294 (`unique-name.ts`
  holds the name arithmetic that `firstFree` and `duplicate` each had a loop for; five new unit tests, written with it);
  `content-document.ts` 308 → 271 (`edit-ranges.ts` holds the range arithmetic); `level-editor.ts` 343 → 283
  (`level-editor-api.ts` holds the interface, `level-editor-support.ts` the id lookups and the view-change test).
- **Longest functions: left as they are, on purpose.** `createLevelEditor` (about 230 lines), `createRecognizer` (about
  230), `createWritePath` (about 210) are closures over one piece of state, made of named inner functions of under 40
  lines each. Splitting them would pass that state through parameters to no gain; the extractions above took out every
  part that held no state.
- **Tests read for implementation coupling.** Three files use `vi.mock`, all to inject a fault so a guard's refusal can
  be reached (`patch-codec-bug`, `patch-toml-codec-bug`, `patch-toml-guards`); none reaches into a private name. The
  43 files that assert calls do so on callbacks the views pass, which are the contract. No change.
- **The two JSON scanners stay two.** `locate.ts` builds the tree of values with spans; `json-syntax.ts` only words the
  first error for the error panel after `JSON.parse` threw, and its messages are pinned by that panel's tests. Each
  header now says why the other exists.
- **Source-project phrases.** The earlier scrub left 35 lines that said "the adventure source" or "the arcade source"
  and cited file paths of another project, some with broken grammar. All rewritten to say what the code does; only
  `SOURCE.json` (the fixtures' provenance record) keeps the two keys, as provenance belongs to
  `docs/provenance/sources.md`.
- **Counts.** Editor unit 3,275 (3,270 + the five new `unique-name` tests), 272 files, all pass; typecheck 0 errors, 0
  warnings; biome clean of errors. Chromium browser projects: see the task's row.

### 2026-11-06, session 5 (continued): phase 5, the 2D level contract in `-content`

Tasks 5.1 and 5.2, one commit group on PR #415.

- **Moved with `git mv`:** `content.schema.ts`, `field-types.ts`, `field.schema.ts` (now `fields.schema.ts`),
  `check-field-def.ts` and `check-field-value.ts` into `packages/content/src/shared/level-2d/`; the three tests of the
  field rules into `packages/content/tests/unit/level-2d/` (52 tests, same counts). The schemas are now
  `levelContentSchema`, `projectContentSchema` and `worldContentSchema` (spec section 5). `ContentNeighbours` is
  written out in `-content`; the editor's `LevelNeighbours` is an alias of it.
- **Deviation 82 (re-exports):** the plan said the four kit field files "become re-exports". They were deleted instead
  and the editor's 47 importing files now import `@mcthaydt/automata-content/level-2d` directly (a codemod over the
  specifiers; biome sorted the imports), so there is one copy and no forwarding file. `kit/fields/index.ts` stays the
  kit's public entry and re-exports from `-content`. The editor's `pure-imports` architecture rule and the fields entry
  test now allow `@mcthaydt/automata-content/level-2d` (it imports only zod; a `-content` test pins that).
- **New in `-content`:** `entries/level-2d.ts`, `level2dKinds({ folder })`, `intGridRows`, `entitiesOf`
  (sim-safe: `pnpm boundaries` scans `read-level.ts` with the sim rule; `./level-2d` is in `simEntries` and in the
  browser-entry list). Tests first: `level-2d-kinds.test.ts` (compiles a copy of the base game's three exported files;
  a stray key fails with the file and the key), `read-level.test.ts` (the room's 24 collision rows, the bad-token
  sentence `Level room-1, layer collision, row 3: "x*2" is not a number.`), and the browser-entry test.
- **Emberwick:** `shared/kinds.ts`, `LevelLike` and `decodeRow` deleted; `vite.config.ts` registers
  `level2dKinds()`; `level-room.ts` reads through `intGridRows` and `entitiesOf`. The compiled `levels` type is a
  looser shape than `ContentLevel` (the content generator cannot write the field-value union), so
  `emberwick-content.ts` parses the compiled level once with `levelContentSchema` to get the typed level.
- **The golden did not move.** With the strict schemas, `content/generated/sim-content.json` and `content.json` are
  byte-identical to before, `sim-content.hash` is still `5fd77abd159d6a5e`, and the golden-equivalence test passes
  (`GOLDEN_HASH` unchanged); only `content.d.ts` changed (more precise types). Emberwick unit 109 pass.
- **Gates:** `pnpm check` exit 0 (editor unit 3,275 less the 3 tests that moved to `-content`, plus none lost);
  `pnpm build`; API reports, agent reference and cheatsheet regenerated; changeset `level-2d-contract` (patch).

### 2026-11-06, session 5 (continued): phase 6, Save writes the game

Tasks 6.1 to 6.4, one commit group on PR #415.

- **6.1 `exports`.** `FileRow.exports` (optional, so the format stays `af-editors/1`); `exportPathsMatch(exports, path)`
  in `workspace-policy.ts` is the one function `fileAccess` uses, so the suite and the server agree; two rows with the
  same folder fail to load with "Two level projects would write content/project.toml. Give each its own exports
  folder." Emberwick's row names `exports = "content"`. The server's policy needed no change (it calls `fileAccess`);
  `editor-policy.test.ts` pins it.
- **6.2 Save.** `createGameSave` (`shared/level-2d/documents/save-to-game.ts`) exports through the same
  `exportContent` the Export view uses, writes the game files with the guarded write and the project last, and
  refreshes the mtimes it expects for the files it reached. `DocumentSession` gained `beforeSave(mode)`: a stop with a
  conflict opens the conflict dialog with nothing written; a failure part-way keeps what was written, leaves the
  document in `error` with the store's message, and the next Save writes everything. **Deviation 83:** the plan put
  `save-to-game.ts` under `profiles/level-project/`; it is in `documents/` beside `editor-app.ts`, which composes it,
  and `OpenDocument.gameFolder` tells the Share view and Home. Browser storage and a row without `exports` write the
  project only. The Share view offers no "Write to folder" where Save writes the game; Home says "Saved in your game
  folder" (rows in `copy.md`).
- **6.3 The drift check.** `levels` step (`shared/check/levels-step.ts`): for each row that names `exports`, open each
  matching project, export it and compare bytes with the files on disk; a project that does not open is reported with
  its first problem; the last line of every finding is "Open the level in the editor and press Save." `StepName` became
  `STEP_NAMES`, and `--only <step>` runs one step (`--only levels` is the plan's check). **Deviation 84:** the editor
  package is loaded with `import()` only when a game has an editor list: Node cannot load its source, and `bin.ts`
  from source must still start for every other game (phase 7.1 makes the editor run from source). Run from source,
  `--only levels` therefore waits for 7.1; the unit tests over a copy of Emberwick's `content/` and over the real
  `games/emberwick` run in `pnpm check` and pass. The help's step label `tests` became `test`, the name `--only` takes.
- **6.4 The narrow fallback.** With no editor list, only `**/*.af2d.json` outside tool folders is readable and
  writable. Tests in `checkout.test.ts` and `serve-editor.test.ts` use `.af2d.json` names now.
- **Skill.** `automata-verify` documents the `levels` rule and `--only`; the API reports, agent reference and cheatsheet
  were regenerated.
- **Counts.** Editor unit 3,242 in 271 files, all pass (3,275 after task 4.6; phase 5 moved the field-rule tests to
  `-content`, and phase 6 added the save, exports and export-model tests); `-tools` unit 835 (809 after task 3.5).
  Chromium: parity, layout and storage 452 pass; canvas and journeys 75 pass, 6 skipped. `pnpm check` exit 0.
  WebKit, Firefox and hosted CI not run.

### 2026-11-06, session 5 (continued): phase 7, task 7.1

Task 7.1, a commit group on PR #415 (phase 7 continues with 7.2 and 7.3).

- **Runs from source.** The editor's two headless entries (`editor-list`, `level-export`) and the files they reach
  (27 in `packages/editor/src`, 9 in `packages/content/src`) now import with `.ts` extensions (50 and 18 specifiers),
  and the three classes that used constructor parameter properties (`Stop` in `json-syntax.ts`, `ContentRefMarker`
  and `LocalizedMarker` in `content-schema.ts`) assign their fields, because Node strips types but does not compile
  them. **Deviation 85:** the spec said the extensionless imports "are rewritten in the package merge"; they were
  not, so this task rewrote only the files the Node-run entries reach, not the whole editor package. `automata check
  --only levels` and `automata editor` both run from source now; `levels-step.ts` imports the editor statically again
  (the lazy `import()` of deviation 84 is gone).
- **The command.** `--app` defaults to `2d`. The 2D build is the copy next to the running bin
  (`dist/editors/2d`) when there is one, else the repository's `packages/editor/dist/2d`. `3d` and `suite` outside the
  repository, with no `--app-dir`, print "The 3D editor is not in this release yet." and exit 2. Usage: "Opens the
  level editor on the game in <folder>".
- **Tests.** `editor-args` and `editor-command` tests updated and extended; `tests/unit/app/editor-from-source.test.ts`
  spawns `node packages/tools/src/app/bin.ts editor games/emberwick --app-dir <stand-in> --port 0`, reads the address
  within 20 s and fetches `/api/ping`. **Deviation 86:** it serves a stand-in `index.html` through `--app-dir` instead
  of the real build, so the unit gate does not depend on the editor having been built.
- **Gates.** `pnpm check` exit 0; the editor, content and tools builds succeed; the built bin
  (`packages/tools/dist/bin.js check games/emberwick --only levels`) passes.

### 2026-11-06, session 5 (continued): phase 7, task 7.2

- **`scripts/copy-editor.ts`.** `copyEditor(editorDist, outDir)` reads `packages/editor/dist/2d` and `dist/suite` with
  `findPixi3d` (the existing scan, nothing moved), throws "This build contains the private Pixi 3D beta (2d/<file>).
  It cannot be published." naming the file, and otherwise replaces `dist/editors/2d` with a copy of the 2D build. With no
  2D build it says to build the editor first. Six tests, one with a planted marker per build and per marker kind. The
  real 2D and suite builds scan clean.
- **Build.** `-tools`' `build` is `tsdown && node scripts/copy-editor.ts`. **Deviation 87:** the plan's `turbo.json`
  change was not needed: `-tools` already has the editor as a devDependency, and turbo's `^build` orders a package after
  its devDependencies. `internal.ts` already exports `findPixi3d` (task 19.2 uses it).
- **Packed size.** `pnpm pack` of `-tools`: 791,076 bytes (about 773 kB), 34 files under `dist/editors/2d/`, including
  `index.html`. The consumer smoke has two new steps: the packed `automata editor` serves the page on the smoke
  project's `content` folder, and the packed tarball is under a 3 MB budget (it measured 773 kB). The smoke passes from
  packs: 17 steps, including the stranger's game booting in Chromium under Ruken's CSP.
- Changeset `editor-in-tools`.

### 2026-11-06, session 6: phase 7, task 7.3

- **The starter level.** `packages/tools/src/shared/create-game/template-content/` holds `editors.toml` (one
  `levels-2d` row, `exports = "content"`), `levels/start.af2d.json` (the editor's platformer template: one 512 × 288
  level on a 16 px grid, the template's two-row floor, two six-cell platforms and the player start) and the game files
  the editor's Save writes from it (`project.toml`, `world.toml`, `levels/start.toml`). `scripts/write-template-content.ts`
  makes those three with `@mcthaydt/automata-editor/level-export` (`--check` lists any that differ); the plan said "four
  game files", the export writes three and `editors.toml` is written by hand. `template-content.ts` reads the folder
  next to itself; the build copies it to `dist/template-content/` (tsdown `copy`), next to the bundle.
- **The template game.** A new `src/features/level/` (`read-level.ts` reads the walls and start through `intGridRows` and
  `entitiesOf`; `walls.ts` is the sim's wall test, the level's edge counting as a wall; `level.ts` reads the compiled
  level from `virtual:automata/content`; `level.view.ts` draws the walls with the draw layer; `compiled-content.d.ts`
  types the virtual module so a fresh game type-checks before its first build). The square starts on the player start,
  moves one axis at a time and stops at walls; the sim gets the level as `content.sim` beside `defaultContent()`. The
  game's size is the level's. `vite.config.ts` adds `automataContent({ schemas: level2dKinds() })`, `package.json`
  depends on `-content`, `.gitignore` ignores `content/generated/`, the README says where the level is and how to open
  it. **Deviation 88:** the level feature's files went to `template-level.ts`, so `template-game.ts` stays under 300 lines.
- **Tests.** `template-content.test.ts` (the export does not drift; the level is a floor, two platforms and one start on
  the floor; a new game passes `levelsStep` as made); `template.test.ts` and `create-game.test.ts` updated (the file
  list, the content files, the plugin, the dependency, the gitignore). The template's own tests: `read-level.test.ts`
  and a "stops at the floor" case in `square-move.test.ts`. The stranger's journey holds Down on the start and checks
  the square did not move, after a move right that proves the frames were drawn.
- **Gates.** `-tools` unit 851 (835 before); `pnpm check` exit 0; the stranger's journey passes in Chromium (49 s:
  install, `pnpm check` with the `levels` step, `pnpm test`, play, itch.io zip). Changeset `create-game-level`.
  WebKit, Firefox and hosted CI not run.

### 2026-11-06, session 6 (continued): phase 8, task 8.1

- Steps 1 and 2 were already in the tree: task 4.2 made the 2D-only `suite.html` and the `--mode suite` build, and
  task 7.2's `copy-editor.test.ts` has the planted-marker case for `dist/suite` (6 tests pass). Verified here: the
  `-tools` build scanned the editor's `2d` and `suite` builds clean (`findPixi3d`: 0 and 0); `editor-3d`'s build
  (`pnpm build`, both pages) holds the beta (2 findings in `dist/suite`) and is not scanned or shipped, which its
  `vite.config.ts` comment now says. The suite page's `main.ts` comment says why only these two editors.
  **Deviation 89:** no new test; the step-1 test existed (task 7.2).

### 2026-11-06, session 6 (continued): phase 8, task 8.2

- **The rail.** `SUITE_ENTRIES` and `PROVIDERS` are gone: `suiteEntries(editors, review)` makes one entry per editor the
  page registers, in its order, each opening only itself, then Review when the ports have a change set. On the 2D page
  served by `automata editor` the rail is `Tuner`, `Levels 2D`; Cmd 1 and 2 choose them and Cmd 3 does nothing (a
  `SuiteRail` test). **Deviation 90:** the plan's "two registered editors, two entries" holds where there are no change
  sets; with the sample game's change set Review stays as a third entry, because it is the only way to its desk, and
  Review, Ship and the checks are wired in the 3D slice (spec 3.4, E6). The single `Levels` entry for both level editors
  is gone with it: `editor-3d`'s suite page now has `Levels 2D` and `Levels 3D` tabs (its tests updated).
- **Home.** No card or import message names a package or Plus: a card for an editor the build lacks says
  "<Name> isn't in this build. Its files open read only." (copy table rows added). `EditorCard.provider` and the
  `provider` options of the suite session and `planImport` are deleted; an installed editor's card takes its label and
  its rail entry from the editor itself.
- **Opening the checkout.** `openSuitePorts` (`features/suite/shell/open-suite-ports.ts`) asks the page's origin for
  `/api/ping`; when an editor server answers, the ports are the memory ports over the kit's HTTP store (the list read
  from the checkout, no change sets), otherwise the sample game. The ping and token code moved out of
  `openServedWorkspace` into `openServedStore` in the kit's `workspace.ts`, which both the 2D editor and the suite use.
- **Two bugs found by trying it on Emberwick** (`automata editor games/emberwick --app-dir packages/editor/dist/suite`):
  (1) the suite builds of both packages wrote `suite.html` and no `index.html`, so no suite build could be served: the
  `suite-page-is-index` plugin renamed a bundle key the bundler ignores. It now renames the written file
  (`writeBundle`). (2) The server refused to read `content/editors.toml` (the list is `never` written, and the read rule
  followed the write rule), so the served suite could not start. `editorPolicy` now always lets the list be read, also
  when it does not load, so the suite can show its problem; two tests. After both, the page shows `Tuner` and
  `Levels 2D`, no "Sample game", and Levels 2D lists `content/rooms/room-1.af2d.json`. **For the build audit:** that card
  also lists the three exported game files, because the `exports` row matches them (task 6.1); opening them from the
  card is the level editor's call to make.
- **Gates.** `pnpm check` exit 0 (the editor's API report regenerated for `openSuite`'s new `entry`); editor unit 3,245; editor Chromium browser projects 527
  pass, 6 skipped; `editor-3d` suite DOM and Chromium layout tests pass; `-tools` editor tests 48. WebKit, Firefox and
  hosted CI not run.

### 2026-11-06, session 7: phase 9, task 9.1

- **The split.** `examples/2d` (`@af-examples/examples-2d`: core, shapes, textures, audio, render, content, ui, the
  goldens, `public/`, `resources/` without the models, and every journey but the 3D ones) and `examples/3d`
  (`@af-examples/examples-3d`: render3d, figures, `resources/models`, their eight journeys). The 2D package's
  dependency tree has no `@pixi/3d`, `render-pixi3d` or `figures`. The workspace globs are `examples/2d`, `examples/3d`
  and `examples/2d/*/*` (the two feature demos); `release`'s package walk follows them.
- **Catalog per package.** `readCatalog` already reads one root, so the catalog code did not change; its test now
  runs both real packages and fails if the 2D one holds a `render3d` or `figures` example or imports an unpublished
  extension (the step-1 test, failing before the move with no `examples/2d`).
- **3D journeys.** `examples/3d/playwright.config.ts` runs them in Chromium and WebKit (iPhone 14 landscape, as before)
  on their own port, `examples3dPort` (slot 12), so a 2D and a 3D run never share a server; `base-3d`'s config no
  longer serves the examples, and `3d.yml`'s `e2e-3d` job runs `pnpm --filter @af-examples/examples-3d test:e2e`.
  **Deviation 91:** the plan kept the 3D examples' journeys in WebKit only; they gained a Chromium project because it
  is the only engine a cloud session can run, and they pass there (9 of 9).
- **Deviation 92:** the 2D config's `runner` projects ran every test under `tooling/examples-runner/tests/e2e`, the
  playground journeys included, whose servers only the runner's own config starts (37 connection refusals when run
  alone). They now ignore `playground-*.test.ts`; the playground moves to the site in task 10.2.
- **Paths.** Root scripts (`examples` and `build:examples` on the 2D package, `examples:3d` new, `build:demos` and
  `ci:local`), `ci.yml`'s 2D journeys, `3d.yml`'s paths (`examples/3d/**`), every `turbo.json` input glob, `knip.jsonc`
  (each example file is an entry: the runner serves it), `biome.json`, `.vscode` (hides `examples/3d`), the playground's
  examples root, the golden replay globs, `workflows.test.ts`'s YAML pins and comments that named the old paths.
- **Gates.** `pnpm check` exit 0; examples-runner unit 115 and Chromium golden replays 12 pass; the 2D journeys
  (examples, compact, runner, demos, ui-primitives) 88 pass and 2 skipped; the 3D journeys 9 pass in Chromium;
  `findPixi3d` finds 0 in `examples/2d/dist` and 2 in `examples/3d/dist`. WebKit, Firefox, the input matrix's
  WebKit and Firefox cells and hosted CI not run.

### 2026-11-06, session 7 (continued): phase 10, task 10.1

- **The subtree.** The session's clone is shallow, but `git fetch` of the website's `main` brought its whole history
  (229 commits), so `git subtree add --prefix site FETCH_HEAD` ran without `--squash`; the website's last commit is
  `4a514eb3`. Deleted after it: `site/pnpm-lock.yaml`, `site/LICENSE`, `site/.nvmrc`, `site/.superpowers/`,
  `site/.taste-skill/`; `site/docs/` moved to `docs/archive/site/`. `site/package.json` is `@mcthaydt/automata-site`
  (its `license` field went with its LICENSE file) and the scaffold test says so. The workspace lists `site`.
- **Deviation 93:** Biome (`"!site"`) and knip (`ignoreWorkspaces`) leave `site` out for now: as it arrived it imports
  the framework from a sibling checkout (12 unresolved imports) and carries synced copies and generated builds, which
  task 10.2 deletes; 10.3 brings it under `pnpm lint` and 10.2 under knip. `turbo.json` needs nothing yet: the root
  `build` filters `./packages/*` and the site has no `typecheck` or `test:unit` script; 10.2 adds `site#build`'s
  dependencies.
- **Step 2's record.** `pnpm --filter @mcthaydt/automata-site test`: 10 of 78 files fail (the audit counted 6):
  `api-contract`, `double-jump`, `first-change`, `workshop-controls`, `playground/compile` (they import
  `../../automata-framework/...`), `example-sources` and `license-claim` (they read that checkout's examples and
  packages), `playground-sync` and `stack-page` (they compare synced copies at `framework.ref`), and `scaffold` (the
  new name, fixed here). 491 tests pass.
- **Gates.** `pnpm check` exit 0.

### 2026-11-06, session 7 (continued): task 10.2, step 1 and the loaders

- **Step 1.** `site/tests/unit/framework/{guides,packages,examples}.test.ts` (7 tests, Node environment) failed on the
  missing modules, then pass against `site/src/shared/framework/`: `root.ts` (the repository root, four folders up),
  `guides.ts` (`readGuides`: every `docs/guides/*.md`, title from its `# ` heading, description from the first
  paragraph, `./x.md` links to `/docs/x`; a guide with no heading stops the build), `packages.ts`
  (`publishedPackages`: the `packages/*` that are not private, the four a game author installs) and `examples.ts`
  (`exampleList` from the examples runner's catalog over `examples/2d`, `featureDemos` from the demos' own
  `package.json`: `hot-reload` and `primitives`, no `bodies-2d`). The site depends on `@mcthaydt/examples-runner`
  (workspace) for the catalog.
- **Deviation 94:** the guides carry no front matter (the website's old loader required `title` and `description`
  fields from a `docs/guide/` folder that never existed under that name), so the title and description come from the
  Markdown itself, and a guide's page is `/docs/<file>` rather than `/docs/guide-<file>`.
- **Step 2, first part: the deploy that never ran.** Deleted `site/.github/` (its CI and deploy workflows, and the
  deploy key with them), `scripts/{release,rehearse-rollback,check-deployed,check-uptime,record-lighthouse-baseline}.ts`,
  `lighthouse-baseline.json`, their six test files and the four `package.json` scripts. `serve-static.ts` stays (the
  browser suite and Lighthouse serve the build with it). Site tests: 75 files, 9 fail (the sibling-checkout and
  synced-copy ones from 10.1's record), 389 pass.
- **Gates.** The 7 tests pass; `pnpm check` exit 0. The rest of step 2 onward is the next session's.

### 2026-11-06, session 8: task 10.2, steps 2 to 4

- **Versions first (deviation 95).** Task 10.3's version step ran here: `site` is on Vite 8.3.3, SvelteKit 2.70.4,
  `@sveltejs/vite-plugin-svelte` 7.3.1, Zod 4.6.6 and `@types/node` 24.19.1, because the playground's runtime build
  (Rolldown options, the Svelte plugin 7) moves into the site in this task and does not run on Vite 6. The site's 75
  test files gave the same result before and after the upgrade (9 failing, all the sibling-checkout ones). 10.3 keeps
  Biome over `site/`, the dropped `tsx`, and the gates' move into `test:unit:2d` and `e2e-2d`.
- **Deleted:** every `sync-*.ts`, `framework-source.ts`, `build-workshop.mjs`, `record-workshop-proof.mjs`,
  `api-reference.ts` (its parser moved), `framework.ref`, `workshop/`, `static/{demos,playground}/`, the four committed
  `llms*.txt`, and from `src/data/`: `restorations.ts`, `evidence*`, `first-change-proof.json`, `releases*`, `stack*`,
  `projects.json`, `demos.json`, `docs.json`, `examples.json`, `api-index.json`, `boot-errors.json`, `api-reference/`,
  `api-search/`, `publication.ts` (unused), plus `src/lib/{evidence,stack}.ts` and `ProofReport.svelte`. Tests that
  covered only those went with them (23 files).
- **Deviation 96: four pages left now, not in 18.1.** `/community`, `/proof`, `/releases` and `/inside` read only
  synced data that this task deletes (restorations, evidence, release list, `stack.md`), so their routes went with it;
  18.1 still writes their redirects and deletes the other four. Start lost its worked double-jump demo, its workshop
  sources and their recorded test run (the workshop is gone); its links and the site's `/start#worked-change` links now
  point at `#first-task`. Home lost the cross-engine claim that linked `/proof`. 18.2 rewrites both pages.
- **Deviation 97: no boot-errors page.** The `BootError` union it was generated from no longer exists after the core
  refactor (boot answers a typed result), so the page and its test went; the service-model page says so in one line.
- **The loaders, as one Vite plugin.** `site/src/shared/framework/vite-plugin.ts` (`frameworkData()`) serves
  `virtual:framework/{guides,examples,demos,packages,sources,api,api-search,llms}`, each computed by a loader in the
  same folder when Vite first asks for it: `guides.ts`, `examples.ts` (`playgroundExamples`: the playground catalog
  over `examples/2d`; it replaced step 1's `exampleList`, the test now checks the source and frame page), `demos.ts`
  (Emberwick and the feature demos with their `main.ts` headers, both comment styles), `sources.ts` (the source
  explorer's files; it now follows `@af-games/` dependencies too), `api.ts` (the API index in
  `tooling/api-index/dist`). `src/data/{docs-loader,demos,examples,projects}.ts` and `src/lib/api-reference.ts` read
  them; the site's own docs moved from the sync script to `src/data/site-docs.ts` (`buildDocs(guides)`), the agents'
  text files to `src/data/llms.ts`, served by four prerendered `+server.ts` routes (`/llms.txt`, `/llms-guides.txt`,
  and `/llms-full.txt`, `/llms-api.txt` byte for byte from the index: `cmp` equal). The API pages show the workspace's
  one version (0.0.5) and no commit.
- **The playground's move (deviation 98: `site/playground/`, not `site/src/lib/playground/`).** The runtime build is
  not SvelteKit code, so it sits beside `src/`: `site/playground/{build.ts,vite.config.ts,runtime/,static/,
  feasibility-server.ts,frame-server.ts,static-files.ts,playwright.config.ts}` and `site/playground/src/` (the frame,
  the Ruken harness and the build helpers). `playground-protocol.ts` and `playground-headers.ts` replaced the site's
  synced copies at `src/lib/playground/{protocol,headers}.ts`. Tests: `site/tests/playground/runtime/` (50 unit
  tests, Node environment) and `site/tests/playground/e2e/` (Playwright, `pnpm --filter @mcthaydt/automata-site
  test:e2e:playground`; Vitest excludes the folder). `examples-runner` exports `header`, `page-template` and
  `examples-ship-config` for it, lost its playground scripts, its Playwright config and three unused dependencies; its
  unit tests are 64 and 1 skipped (115 before: the 50 moved). `release-checks.yml` and its pinning test name the
  site's script.
- **`build-demos.ts`** builds the published packages and the three demos in one turbo run, writes the API index,
  copies each demo's `dist` into `static/demos/<slug>/` (assets relocated under it) and the playground into
  `static/playground/` with every example precompiled; `site/.gitignore` ignores both. The site's `build` is
  `node scripts/build-demos.ts && vite build && write-seo-files`. Demos are served at `/demos/emberwick/`,
  `/demos/hot-reload/` and `/demos/primitives/`. The prerender names the four text files as entries.
- **knip** covers `site` now (`ignoreWorkspaces` removed; entries for the compile worker, the scripts, the playground
  build and both Playwright configs); `@testing-library/{dom,jest-dom}` and `publication.ts` were unused.
- **Gates.** Site unit tests: 69 files, 353 tests pass (75 files, 9 failing before); `svelte-check` 0 errors; `vite
  build` exits 0 (57 pages); knip clean. `api-contract.test.ts` was deleted rather than repointed: it holds the
  cheatsheet to packages the core refactor merged (runtime, render-pixi, ui, host, ship), and 18.1 deletes the
  cheatsheet. `license-claim`'s `it.fails` became `it` (the framework is MIT now). Site e2e gates in Chromium: 483
  pass (the demo-runner failure journey now uses Home's Emberwick runner, since Start's demo left; its first attempt
  failed on the missing runner); playground journeys in Chromium: 37 pass. `pnpm check` exit 0 (its YAML-pinning test
  names the site's playground script; `examples-runner` no longer has journeys of its own). WebKit, Firefox and hosted
  CI not run.

### 2026-11-06, session 8 (continued): task 10.3, steps 2 and 3

- **Biome over `site/`.** `biome.json` drops `"!site"` and ignores only the site's generated folders (`build`,
  `static/demos`, `static/playground`). `pnpm format` rewrote the site's files; four lint errors were fixed by hand:
  a `forEach` callback that returned a value (`SourceExplorer.svelte`), an assignment inside a `return`
  (`highlight.ts`), the favicon's missing `<title>`, and a fixture link that said only "A link" (`good.html`).
- **No `tsx`.** Every script runs on Node's own TypeScript: `node scripts/...` in `package.json`, both Playwright
  configs and `lighthouserc.json`; the scripts' relative imports name their `.ts` files; `serve-static.test.ts`
  spawns the script without the loader. `tsx` left the site's dependencies.
- **The gates.** The site has a `test:unit` script (`write-api-index.ts && vitest run`), so `test:unit:2d` and
  `pnpm check` run its 353 tests. **Deviation 99:** they read the API index, which is generated from the packages'
  built declarations, so `site/turbo.json` makes the site's `test:unit` (and `build`) wait for `^build`; the release
  package's turbo test, which allowed only `build` to, now names this one exception and checks it. `site/turbo.json`
  also makes `test:e2e` wait for the site's `build`, and `ci.yml`'s `e2e-2d` job runs `pnpm test:e2e --filter
  @mcthaydt/automata-site` (Chromium and WebKit). `scripts/write-api-index.ts` is shared with `build-demos.ts`.
- **Gates.** `pnpm check` exit 0, the site's 69 files and 353 tests in it; `turbo run build --filter
  @mcthaydt/automata-site` exits 0; site e2e gates in Chromium after the format: 483 pass. The evidence fixtures the deleted evidence test used went too. WebKit, Firefox and hosted
  CI not run.
- **Handoff.** Next is phase 11 (task 11.1, one token source). 14.1 waits for the Owner.

### 2026-11-06, session 9: phase 11 (one design system)

- **11.1, one token source.** `tokens.json` changed shape: `colorScheme`, `tokens` (custom property name to its CSS
  value, verbatim) and `aliases` (old name to the token it now means). The 40 custom properties of the site's `:root`
  come first with the site's values (fixture `tests/fixtures/tokens/site-root.css`, copied before the change; the test
  compares every one after collapsing whitespace), then the editor's own: `cobalt-soft`, `ok`, `bad`, `warn`,
  `danger-wash`, `scrim`, `shadow`, `shadow-sheet`, the layer and phase colours (values kept; 12.3 retunes the layer
  ones), spacing, `radius-md`, `radius-xl`, the targets and the fixed type ramp. **Deviation 100:** where the two sets
  shared a name the site won, so `--radius-sm` is 12 px (was 6) and `--radius-lg` 26 px (was 12), and `--font-sans`/
  `--font-mono` are Geist. The 16 old colour names are `var()` aliases. `tokensToCss` refuses a bad name, an alias to
  nothing and a name defined twice; `generate-tokens.ts --check` exits 1 on a stale file (a test spawns it).
  **Deviation 101:** `tokens.css` is out of Biome (`packages/editor/biome.json`): Biome wraps the long gradient
  values, so a formatted file could never equal the generator's output. The site's `app.css` imports
  `@mcthaydt/automata-editor/tokens.css` (a workspace dependency of the site; the editor depends on neither the site
  nor `-tools`, so no cycle) and keeps only its non-token `:root` declarations. The screenshots "identical by eye" are
  replaced by the stronger check: every value is the same. Gates: tokens tests; editor unit 3,250 and editor-3d unit
  2,790 pass; site build exits 0; site e2e in Chromium 482 pass and 1 failed on the first run (the playground's
  "a later frame that never starts" journey: `frames` was 1); it passed alone on the same build after a rebuild, and 3
  of 3 times on both the old and the new `app.css`, so it is a timing race in that journey, not the tokens (recorded,
  not fixed here).
- **11.2, Geist and the icons.** `fonts.css` imports `@fontsource-variable/geist` and `geist-mono` (`wght.css`, as the
  site does; the Plex packages left the editor). `icons/paths.ts` holds 24 Lucide drawings (lucide-static 0.460.0,
  ISC; the notice is in the file's header and the row in `docs/provenance/sources.md`), `Icon.svelte` draws one,
  decorative and unfocusable. Gates: icon tests (24 names, an unknown name is a type error under `svelte-check`).
- **11.3, the kit's components.** New `IconButton` (44 px round, name and tooltip from `label`, `showLabel`,
  `pressed`); Button gains `quiet` and the site's looks (frosted pill; primary the chartreuse panel with its glow;
  danger ink on a pale red wash). Dialog is paper with the 26 px radius and, at a phone width (37.5 rem), a sheet from
  the bottom with a grab handle and the actions stacked primary first, each 48 px. Segmented, Tabs and Chips are pills
  on a glass track (Segmented chosen = cobalt fill; Tabs chosen = paper with a cobalt underline; Chips chosen = cobalt
  wash). Popovers, sheets, toasts and the colour panel are paper with the sheet shadow; fields are paper with a hairline
  and the 12 px radius; focus is `--focus` (cobalt) everywhere. Toasts sit under a dialog's scrim (z-index 90): the
  board showed them covering a phone sheet's actions. Every kit `.svelte` moved off the old aliases (a unit test reads
  each `<style>` and fails on a literal colour or an old name); the editor's views and `testing/` still read the
  aliases until phase 12. The pages' `color-scheme` meta is light. **The board:** `design.html` (dev only, not a build
  input) and `src/app/design/`; `pnpm --filter @mcthaydt/automata-editor design:board` (Playwright, Chromium, phone,
  compact, iPad both ways, desktop, with and without the dialog) writes `tests/e2e/screens/` (git-ignored). Every image
  was opened; fixed from them: the menu and picker triggers had lost their border, the stepper's label pushed `+` onto
  its own line, the toast's coloured left edge fought its round corners (now a dot), toasts covered the dialog.
  **Deviation 102:** the board mounts the kit's components only; the screens join it in phase 12 as each is redesigned.
  Two existing layout tests caught real regressions and were fixed in the Dialog, not the tests: the error panel was
  1 px off the top of a phone (`box-sizing`), and a stacked plain action was 44 px where the suite's Ask dialog needs
  48. Gates: `pnpm check` green; editor unit 3,284; editor Chromium browser projects 533 pass, 6 skipped; editor-3d
  unit 2,790, dom 142, layout and canvas in Chromium pass (none asserted an old colour, so none changed). PR #419.
- **Scope, the Owner (2026-11-06, relayed):** "We should be redesigning and auditing all editors that aren't 3D, not
  just the 2D level editor". The plan redesigned the kit and the 2D level editor and left the Tuner and the suite's 2D
  page to the 3D slice. Added tasks 12.6 (the Tuner) and 12.7 (the suite's 2D page), each starting with its own audit;
  12.5's copy scan runs after them. The slice now has 65 tasks; the spec's "Out" and `progress.md`'s 3D row say only
  `editor-3d`, the Studio and Levels 3D are left to the 3D slice. The Owner also restated the standing rule the same
  day ("are the editors aware that they should be so simple a drunk grandma can use and understand it"): it is in the
  spec (11.5) and applies to every screen of phase 12; no plan task found short of it so far.
- **The drunk grandma audit (2026-11-06,** [grandma audit](2026-11-06-grandma-ux-copy-audit.md)**, copied into `docs/refactor/`).** Its section 8 folded in as a
  "Step G" on tasks 8.2 (the suite command serves the 2D suite; a sample shows a banner), 12.1, 12.2, 12.4, 12.5, 12.6,
  12.7, 18.2, 19.1 and 20.1. No new task: each finding fits the task that owns that screen. 8.2 is done, so its Step G
  reopens it (the row in `progress.md` says so).
- **Handoff (session 9).** Phase 11 is in draft PR #419 with the 8.2 step G fix and the plan changes. Next is task 12.1
  (Home) with its Step G, on a new branch stacked on #419. The design board is the place to check each redesigned screen.
- **The site visual audit (2026-11-06,** [site visual audit](2026-11-06-site-visual-audit.md)**, copied into `docs/refactor/`).** New task 18.0 fixes the shared
  layout before phase 18 (tap targets M1, code wrapping M2, the see-through phone menu M4, keyboard hints on touch
  L1); "Step V" on 18.2 (the first example that shows nothing H5, landscape fold M3, footer labels M6, L2 to L4, L7),
  18.3 (Privacy and browser storage L8), 18.4 (the 185,000 px API page H4) and 19.1 (rerun the audit). H3, the
  footer's contact address, stays until the Owner decides (D8). The slice now has 66 tasks.
- **The Tuner is a split view** (the Owner, 2026-11-06, relayed: "I feel like the tuner should be a split view where it
  shows the effect of the change"): task 12.6 step 1 now asks for the settings beside the live game, each change shown
  without a reload; it replaces the audit's separate "Play to try it" button.
- **The domain (2026-11-06).** The Owner: "Let's also use automataframework.com for the site as well; we can't couple
  this tightly to ruken". New task 21.0; its step 1 (every site URL on the new origin) is done in this session, its
  DNS step is the Owner's. The slice now has 67 tasks.
- **12.1, part: Home's words.** Step 0's action list (from Home's DOM tests, to tick off when the redesigned Home
  reaches each): list newest first with the first selected; ages told against the given clock; the sources panel;
  a card per template; re-read on return; loading skeleton; empty workspace invites a template; device-only storage
  said once; click selects; arrow keys, Home and End move; Enter, double click and Open each open; open the card it
  came on; search narrows with an honest count; nothing matches plus Clear; Escape clears the search; a template
  makes and opens a level; Duplicate adds, selects and says so; Delete asks with Cancel focused; Delete confirmed
  removes, says so and focuses the list; the Delete key asks; Import keeps what a profile claims and names the rest;
  actions wait while one runs; a listing failure says why and Retry recovers; drawers and sheets open and close by
  button and Escape; rotation keeps the search, the selection and the scroll. Done this session (TDD): the badge is
  "N problems" or none (no "Valid"); the templates read "Platformer: jump between platforms", "Top-down: walk around
  a map", "Blank: start from nothing"; Delete asks "Delete Mossgate?" with "This level is deleted for good. You can't
  undo this." and "Delete level"; the delete toast names the level. The kit's `HomeCard.badge` became optional
  (editor-3d's summary shows it only when present). Gates: editor unit 3,284; Home's Chromium layout tests 41 pass;
  editor and editor-3d typecheck clean. Left for 12.1: the one-column card list with the More menu, the New level
  sheet, "Open from" as a two-option control, the one storage line, Step G (templates on a game folder, "Your game:
  Emberwick", "Changed 7 minutes ago"), the layout test at four sizes, and the screenshots.
- **Handoff (session 9, 14:30 UTC).** Branch `claude/project-thread-9tfov0`, PR #419. The plan named separate
  branches per phase; this session may push only to its own branch, so 12.1's start is on #419 too. Next session: the
  rest of 12.1, on a new branch stacked on #419.
- **12.1 done (session 10): Home redesigned.** The 2D Home no longer uses the kit's three-column `HomeScreen`: it is
  one column on the sage field (`features/home/Home.svelte`, under 300 lines like every file it touches), with "New
  level" the top bar's one primary button, the game's name under the title on a game folder ("Your game: Emberwick"),
  "Open from" as the kit's two-option `Segmented` ("This game" or "This browser", "Import files"), the search, one
  column of cards and one storage line ("Saved in your game folder. Edits are kept if the page closes."). A card
  (`ProjectCard.svelte`, new) is a button that opens the level, a 72 px tile, the name and "Changed 7 minutes ago";
  its More menu holds Open, Duplicate, Details and Delete…; Details is a dialog with what `ProjectSummary` showed,
  less its buttons, plus the file, size and date. "New level" opens `NewLevelSheet.svelte` (new) with the template
  cards (`TemplateRow`, restyled). The list (`LevelList.svelte`, new: the plan named only the card and the sheet,
  but the keys, focus and empty states needed a home of their own to keep `Home.svelte` small) has one tab stop, the
  selected card; arrows, Home and End move it, Enter opens, Delete asks. The kit's `ProjectCard` tile moved to
  `kit/home/CardTile.svelte`, which both cards use. **Step G:** a template on a game folder makes the level where the
  editor list lets the editor write it (`newFilePath` in `workspace-policy.ts`: the folder of the first row whose glob
  would take the name and that is not generated or never written; `content/rooms/` on Emberwick); with no such row
  it says "Your game has no folder for new levels yet. Add one to content/editors.toml, then try again." (a refusal
  with no path, so `openProblem` no longer prefixes a file name). `automata editor`'s ping now carries the game's name,
  its folder's name in words (`emberwick` is "Emberwick"; a title lives in a target's own config, so the folder is
  the one name every game has); `openServedStore` returns it beside the store and the workspace carries it as
  `game`. Delete on a game folder says "It's removed from your game for good." **Deviation 103:** the browser's
  technical reason for keeping nothing (OPFS) is the storage line's tooltip, not a second line. **Deviation 104:**
  `editor-3d` still uses the kit's `HomeScreen`, `SourcesPanel` and `ProjectList` unchanged: the 3D slice redesigns
  its Home (spec 11.6); the kit's components stay for it. **Left for later:** a duplicate keeps the level's own
  name, so two cards read "Mossgate" (the toast names the copy's file); renaming the copy needs the profile, so it is
  listed for 12.5's copy pass; the template tiles are letters, not illustrations; Home joins the design board with
  12.2. Step 0's action list, ticked: list newest first with the first selected (yes); ages told against the clock
  (yes, "Changed 5 minutes ago"); the sources panel (now the source line and "Open from"); a card per template (yes,
  in the sheet); re-read on return (yes); loading placeholder (yes); empty invites a template (yes, with its own New
  level button); device-only storage said once (yes, one line); click selects (a tap now opens, and focus selects);
  arrows, Home and End move (yes, the focus with them); Enter, double click and Open open (Enter and a tap, and Open
  in the menu); open the card it came on (yes); search narrows (yes; the count line is gone); nothing matches plus
  Clear (yes); Escape clears (yes); a template makes and opens a level (yes); Duplicate adds, selects, says so (yes);
  Delete asks with Cancel focused (yes); Delete confirmed removes, says so and focuses the list (the next card);
  the Delete key asks (yes); Import keeps and names (yes, under Import files); actions wait while one runs (yes);
  a listing failure says why and Retry recovers (yes); drawers and sheets by button and Escape (no drawers now; the
  dialogs close by button and Escape); rotation keeps the search, the selection and the scroll (yes). Gates: editor
  unit 3,286 (Home's DOM tests rewritten to 28; ProjectSummary 7, policy +3, save-to-game +2, served workspace +1,
  home model +3; App, boot and recovery-journey tests moved to the new names); `-tools` serve-editor 14; editor
  typecheck clean; Home's layout test in Chromium 41 of 41 at the eight sizes (one column, every More button inside
  the viewport and 44 px, the New level sheet's templates reachable, one scroll region, rotation); every screenshot
  opened. The layout tests that open a level from Home (level, characters, share, map, problems, tiles, open flows,
  the thumbnails canvas test) now tap the card. WebKit, Firefox and hosted CI not run.
- **12.2, part (session 10): Back with unsaved changes asks.** Step G's first line: Back on a level whose save state
  is `dirty` or `error` opens `LeaveDialog.svelte` (new): "Save your changes to Mossgate?" with Save (primary, focused
  first), Don't save and Cancel. Save writes and then leaves, and stays when the save conflicts or fails, so its own
  dialog or toast is seen; Don't save calls the controller's new `closeWithoutSaving()`, which drops the autosave so
  the next open offers nothing to restore; Cancel stays. **Deviation 105:** an undo moves the history's revision, so
  a level painted and then undone still asks on Back (the boot journey now answers Don't save); comparing against the
  saved revision is the session's rule and is left as it is. Gates: document-controller 30 (one new), DocumentScreen
  22 (four new), app tests 211. Left for 12.2: the top bar (rename on tap, the view switcher with Level, Map, Tiles,
  Characters, icon Undo and Redo, Save as the one primary button with "Saving…" and "Saved"), no status bar, the
  problems sheet, the Share menu, the rail's icons, and the restore dialog's words.
- **The Owner, 2026-11-06 (relayed): "Yeah those should be in try it page; the editors should have only essential
  features and nothing more".** Templates are the try-it page's: on a game folder Home offers no New level and no
  templates (a game has its level file from `create-game`, and a second file would write over the same game files);
  in browser storage, which is what the try-it page runs on, New level and its sheet stay. An empty game folder says
  "Your game has no levels to edit yet." `newFilePath` stays as the app's guard for a create on a checkout. **Standing
  rule for every editor task left (12.2 to 12.7):** essential features only; anything that is not is cut, and the cut
  is named in this log.
- **12.2, part (session 10): the top bar, essentials only.** `DocumentBar` holds Back, the level's name, Undo and
  Redo as the kit's `IconButton`s (named with their step, "Undo Paint") and Save, now the one primary button, whose
  words say where the level stands: "Save", "Saving…", "Saved" (`data-save` carries the state). **Cut, by the
  Owner's essential-only rule:** the file path under the name (it is in Home's Details; the bar keeps it as
  `data-path`), the profile's pill, and the status bar: `StatusLine` is gone from the document (`ViewFrame.status`
  removed and the seven views no longer place it), since Save says the state, a failed save or autosave is a toast
  with its way on, and "Not saved on this device" is Home's storage line. The kit's `StatusLine` stays for editor-3d
  and the board. Gates: editor unit 3,292; DocumentBar 8; DocumentScreen and App tests read Save's state, not the
  status bar. Left for 12.2: rename on tap, the four-view switcher, the problems sheet, the Share menu, the rail's
  icons, the restore dialog's words.
- **Tried and backed out (session 10): the view names alone.** Renaming the rail's tabs to Map, Tiles and
  Characters (spec 11.5) breaks the Chromium layout tests: "Characters" does not fit the 56 px rail ("button's words
  run past its edge", every Characters-view layout test at every size). The names land with the view switcher that
  replaces the rail (12.2 step 1: a segmented control in the top bar from iPad up, a menu on a phone), not before.
- **Handoff (session 10, 15:25 UTC).** Branch `claude/project-thread-tfmb6k`, draft PR #420 (12.1 done; 12.2's
  Back-asks, the essentials-only top bar and no status bar). Next: the rest of 12.2 on a new branch stacked on #420:
  the view switcher with the four views and their new names, "2 problems" opening a sheet in place of the Checks
  view, the Share menu (browser storage only) in place of the Export view, the rail's icons, and the essential-only
  cut over each (rename on tap is listed by the spec; keep it only if it passes the Owner's essential-only rule).
- **12.2, the rest (session 11): the view switcher, Problems, Share and rename.** The 56 px rail is gone: `ViewRail`
  became `ViewSwitcher` in the top bar, the kit's `Segmented` ("Views", a radio group) from iPad up and the kit's
  `Menu` named after the open view on a phone. The level project lists four views with the spec's names: Level, Map,
  Tiles, Characters (ids `level`, `world`, `tilesets`, `entities` kept). `ViewFrame.rail` and `ViewServices.locate`
  and `.workspace` are removed; the five views no longer place a rail. `DocumentBar` takes `switcher` and `tools`
  snippets and is two rows on a phone (Back, the name, Save; then the switcher, Problems, Share, Undo, Redo), so no
  target shrinks; the kit shell's top bar row is now `minmax(52px, auto)` so it can grow. **Problems** (`Problems.svelte`)
  replaces `ChecksView`: "2 problems" in the top bar opens a sheet (Needs fixing, Worth a look; Show, the repair, Done);
  Show closes it and reopens the Level view on the finding (a counter re-keys the view, so a Show while the Level
  view is open still selects it). **Share** (`ShareMenu.svelte`, `share-model.ts`) replaces `ExportView`: shown only
  where Save does not write the game (no `gameFolder`), it holds Download, Share (off with a reason where the device
  cannot share) and Copy of the level's file, each answered with a toast; on a device that keeps nothing a file that
  left marks the level clean, as Export did. **Rename on tap** kept (a level had no other way to be renamed): a new
  optional `Profile.rename`, the name is a button opening `RenameDialog`, one undo step named "Rename".
  **Cut, by the Owner's essential-only rule:** notes (info findings: an empty level, a definition nothing uses) are
  not counted or listed (a fresh template showed "problems"); Export's target cards, file sizes and per-target choice;
  "Download game files" (in browser storage there is no game to put them in; a game folder's Save writes them);
  "Write to folder" (only reachable on a checkout without an `exports` row, where the answer is to add the row so Save
  writes the game); the rail's icons (the rail is gone; the switcher's words are enough). **Deviation 106:** the
  switcher is a radio group, not tabs, because it is the kit's `Segmented`; tests read `radio` and `aria-checked`.
  **Deviation 107:** the restore dialog's new words (grandma Step G) move to 12.4, which owns `RecoveryDialog`.
  Gates: editor unit 3,284 (ChecksView, ExportView and export-model tests replaced by Problems 10, share-model 3,
  DocumentScreen 25); editor typecheck clean; Chromium layout (level, problems, map, tiles, characters) 130 of 130;
  Chromium 2D journeys 8 of 8. WebKit, Firefox and hosted CI not run. Rounded buttons: none added; the kit's look
  changes with the design thread (the Owner, 2026-11-06: "I HATE rounded buttons").
- **The Owner, 2026-11-06 (relayed), the site's order: "Let's do that".** The design thread's site mockups come
  first and the Owner picks a direction; phase 18 (18.0 included) then applies that direction and the
  [site visual audit](2026-11-06-site-visual-audit.md)'s fixes in one pass, and the visual audit is rerun after.
  Phase 18 does not start until the Owner has picked. The editors' look follows the same design thread's token and
  component changes when it sends them.
- **The design direction (session 11).** A design thread's draft PR #422 (square, flat editor look; spec
  `docs/refactor/2026-11-06-editor-visual-direction.md`) is merged into this stack; the Problems sheet and the rename
  field use `var(--edge)`, and the phone top bar's lower row became one flex row of its own (a wide "3 problems"
  label had squeezed the name to 1 px; the Chromium layout test caught it). The Owner then picked site direction C
  (flat lime; relayed 2026-11-06 16:01): editors and site share one system, flat lime primary buttons, radii 4 px
  controls, 6 px panels, 8 px cards and dialogs. #422 is being updated to match and is adopted from there again; phase
  18 starts once those final tokens land.
- **17.1 (session 11): five workflow rules replace the YAML-pinning tests.** `tooling/repo-hygiene/src/workflow-invariants.ts`
  checks every workflow for: top-level `permissions`; no `pull_request_target`; secrets only in a step's `env`; no
  publishing secret (anything but `GITHUB_TOKEN` and the read-only `AF_READ_TOKEN`) in a job a pull request can start,
  a reusable workflow counted as one a pull request can start; heavy jobs skip drafts (`checks` is the light gate).
  Each rule has a fixture that breaks it. **They found a real gap:** `game-release.yml`'s `ruken` job held
  `RUKEN_TOKEN` with no pull request guard; it now has the itch and desktop jobs' guard. Deleted:
  `packages/tools/tests/unit/shared/ship/workflows.test.ts` (108 tests, 1,469 lines). `yaml` moved from -tools to
  repo-hygiene (`docs/versions.md` row updated), `.github/workflows/**` moved from -tools' turbo inputs to
  repo-hygiene's. **Deviation 108:** the two `turbo-inputs` tests stay (they guard the turbo cache, which once hid red
  tests); -tools' one loses its two workflow entries. Counts: -tools unit 627 → 519 (108 gone), repo-hygiene 82 → 88.
- **17.2 (session 11): the tooling that lost its reason.** `tooling/core-packs` (625 lines): deleted; the consumer
  smoke's own `src/pack.ts` (80 lines, 8 tests) packs the published packages with `pnpm pack`; the extras, unpack,
  source-commit and `packs.json` parts served Plus only; the root `pnpm packs` script goes. `tooling/api-report/src/seams.ts`
  (83 lines): deleted with Plus; `seams.test.ts` becomes `committed-reports.test.ts`, keeping the committed-report and
  planted-break tests. `tooling/bundle-report` (300 lines): deleted; it attributed bytes by package for task 5.1's
  before and after (recorded) and held no budget, and a per-game budget would be a new check nobody asked for.
  `tooling/versions`: the Plus cards (Rapier, Colyseus), the Planck note, the Plus sentence and the Effect card go
  (Effect is Node tooling only now); `docs/stack.md` regenerated. `tooling/examples-runner`: confirmed, only the
  examples index is left (the playground is the site's). `tooling/evidence`: unchanged here; the Proof page's half goes
  with the page in 18.1 (the parity job's golden evidence stays).
- **12.3, part (session 11): the tools as icons.** The kit's `Segmented` takes an optional `icon` per option (the
  label stays the option's accessible name and tooltip); the Level toolbar's six tools are icons, the eyedropper
  named "Copy a tile" (was "Pick"); the brush size is behind a "Size 2" button that opens a popover with the stepper,
  so the size never widens the row. On a 390 px phone all six tools now fit beside Layers. Gates: editor unit (level
  98), Chromium layout (level and shared) 161, Chromium 2D journeys 8. **Left for 12.3:** the floating pill over the
  canvas (top from iPad up, bottom on a phone), the charcoal cabinet, Layers as a sheet with colour, name, eye and lock
  per row and the palette under the chosen layer, the inspector opening on selection, and the level picker in the top
  bar; then the canvas tests' colour expectations.
- **12.3, part (session 11): the layer rows.** Each row names its kind in plain words (spec 11.5: "Walls and floors",
  "Tiles that place themselves", "Characters and items", "Shapes"), shows a square colour swatch from the layer colour
  tokens, and hides or locks through icon buttons labelled "Hide Entities" or "Lock Entities" (eye and lock icons, the
  pressed state spoken). Gates: editor unit 3288, Chromium layout (level) 50, Chromium 2D journeys 8. **Left for
  12.3:** the floating pill, the charcoal cabinet, Layers as a sheet with the palette under the chosen layer, the
  inspector on selection, the level picker in the top bar, the canvas colour expectations.
- **12.3, part (session 11): the inspector opens on selection.** The Level view opens the inspector when the editor's
  selection changes to a new, non-empty one, so below `wide` a thing just placed or tapped shows its fields; closing
  the sheet with the same thing selected keeps it closed. Gates: editor unit 3289, Chromium layout (level) 50, 2D
  journeys 8, `pnpm check`. #422's second commit (corners 4 / 6 / 8 px, the flat lime primary) is merged; this
  stack's three corners moved onto the scale (swatch and rename field `--edge-sm`, Problems rows `--edge-md`).
- **Site unit tests (session 11).** `examples-pages.test.ts` and `playground/origin.test.ts` read
  `static/playground/compiled/`, build output a fresh checkout lacks, so hosted CI failed with ENOENT on #420 and
  #422. They now compile the examples in place with `compileExample`, the way `build-demos.ts` does.
- **Owner, 2026-11-06:** the editors' look is still not good. The design thread makes a Level screen mockup; the rest
  of 12.3 keeps to structure and behaviour and takes its styling from that mockup.
- **12.3, part (session 12): the floating pill, the level picker, no dock.** Structure and behaviour only; the look waits
  for the design thread's Level mockup. The tools are one pill (`role="toolbar"`, "Tools") floating over the canvas's
  foot, a sibling of the canvas's box so a press on it never reaches the gestures; below `wide` it starts with Layers
  (an icon button). The brush size is a 44 px button showing the number ("Brush size 2"), so the pill is one row on a
  390 px phone; inside the pill the segmented control draws no frame of its own. Fit ("Fit the level in view") and,
  below `wide`, Details (the inspector, was "Inspector") are icon buttons in the canvas's top right corner; the
  locked or hidden layer message moved to the top left. The strip of level cards is gone: a level picker beside the
  document's name in the top bar (a kit `Menu`: the world's levels, the open one marked "Open", then New level, which
  adds the first free "Level N" as one undo step and opens it; disabled with the reason at 256 levels). The suite's
  Levels 2D puts the same picker in its bar's `tools` and loses its dock and Dock toggle. Deleted:
  `LevelCards.svelte`, `LevelDock.svelte` and its test; `dock-model.ts` is `level-list.ts` (`levelList`). Three
  Lucide icons added (chevron-down, maximize as `fit`, panel-right as `inspector`; 27 now, provenance row updated).
  The top bar takes two rows on an upright iPad too (`tablet-portrait`): in one row at 744 px the picker was cut to
  one letter; the name's words truncate inside their own box so the button keeps its edge. **Deviation 109:** the
  pill sits at the canvas's foot on every size, as the mockup draws it, not at the top from iPad up (spec 11.4); one
  CSS rule if the Owner wants the top. **Deviation 110:** the palette stays below the layer list, naming the chosen
  layer ("Paint with Collision"), as the mockup draws it, rather than inside the chosen layer's row. **Deviation 111:**
  the pill hides its scroll bar instead of keeping 16 px under its tools for macOS's overlay bar (#272); the layout
  test now holds `scrollbar-width: none`. Gates: editor unit 3,289 → 3,293 (three new: the pill with Fit and Details,
  the picker twice; three icon checks for the new icons; the two `LevelDock` tests gone), typecheck clean, Chromium layout 427, canvas,
  journeys, parity and storage 106 pass and 6 skipped, `pnpm check` green; WebKit, Firefox and hosted CI not run.
  **Left for 12.3:** the charcoal cabinet and the canvas tests' colour expectations (styling, from the mockup), and
  step 4's screenshots and copy rows.
- **12.4 Step G (session 12): Map, Tiles and Characters in plain words.** Map: "Layout" (Free, Grid, Row, Column) is
  "Arrange levels" (Anywhere, In a grid, In a row, In a column), wrapping to two rows in the 264 px panel; the empty
  inspector says "Tap a level to edit it."; Remove's warning says links "will show in Problems as broken" (Checks is
  no longer a view). Tiles: "Auto layers" is "Tiles that place themselves", empty "None in this game yet." (was "No
  auto layer reads an IntGrid yet."); the rule groups and rules show only once there is such a layer, as before; the
  stage with no tileset says "No tiles yet. Add a picture of your tiles to paint with them." **Deviation 112:** no
  [Add tiles] button: the editor has no action that adds a tileset (every template comes with one), and adding a
  picture is a new feature, not essential to editing a game that has its tiles; noted for the Owner. Characters: each
  row shows the label (not the id) and "One per level" only where it applies (no field count, no shape); "Level
  fields" is "Settings for every level"; the shapes are Box, Circle, Dot, Picture (the file keeps `rect`, `ellipse`,
  `point`, `tile`); "Single per level" is "Only one per level"; the id ("Name in code") and the pivot ("Anchor point
  across", "Anchor point down") moved under a closed More; the preview names the thing by its label, says "Box, 16 × 24
  px" and "Shown 8 times bigger" (was "Placed with its pivot on the snapped cell · 8× zoom") and drops the pivot pill.
  Gates: editor unit 3,293 → 3,296 (three new: arrange words, tiles words, the More section), typecheck clean,
  Chromium layout (map, tiles, characters, level, document) and 2D journeys pass, `pnpm check` green; WebKit, Firefox
  and hosted CI not run. **Left for 12.4:** steps 1 to 3, the frame of spec 11.4 for the three views (the stage in its
  cabinet, a list sheet and an item sheet: their "Rules" / "Definitions" / "Inspector" drawer buttons become the
  Level view's corner and pill controls) and the dialogs' one primary action, then the inspector tab names
  ("Definition", "Fields 3"), which still read as engine words.
- **12.4, part (session 12): Details everywhere.** The drawer button that opens the inspector below `wide` says
  "Details" in Map, Tiles and Characters too (was "Inspector"), as in the Level view. Gates: editor unit (map, tiles,
  characters) 126, Chromium layout (the three views) 64, 2D journeys 26.
- **12.3, part (session 12): the pill at the top from an iPad up.** The design thread's revised mockup (after the
  Owner's "Audit it", 2026-11-06) puts the tools at the top centre, which is also spec 11.4's rule, so **deviation 109
  is withdrawn**: the pill floats at the canvas's top from `medium` up and at its foot on a phone (`toolsAt`); with it
  at the top, Fit, Details and the layer message move to the canvas's foot. The suite's Levels 2D keeps the foot until
  12.7. Gates: Chromium layout (level, suite) 171, canvas and journeys 75 pass and 6 skipped, editor unit (level, app)
  303.
- **12.4 done (session 13): the frame and the dialogs.** Map, Tiles and Characters take the Level view's frame (spec
  11.4): the row of drawer buttons above each stage is gone; one pill floats over the stage (the kit's new
  `shell/StagePill.svelte`, which the Level view's tools now use too) with `All levels` / `All tiles` / `All
  characters` and `Details` below `wide`, and on the Map `Fit the map in view` at every size. It sits at the stage's top
  from an iPad up and at its foot on a phone, and moves clear of an open drawer (centred in what the drawer leaves)
  or sheet (to the top), so Fit and the button that closes it stay in view; Tiles and Characters keep room for it in
  their scrolling stage. One Lucide icon added (`list`; 28 now, provenance row updated). The inspector's tabs say
  `Selected`, `Level`, `Problems` (were Entity, Level, Checks) and `Character`, `Settings 3` (were Definition, Fields
  3). The save conflict and the restore offer follow `copy.md` with one primary each: `Mossgate was changed somewhere
  else` with `Cancel`, `Use theirs`, `Use mine`, `Keep both` (primary); `Keep your changes from last time?` with one
  sentence naming the level and when (the File / Last autosave / File on disk list is gone, `recoveryFacts` is
  `recoveryWords` and leaves the kit's exports), `Throw away`, `Keep my changes`; the undo step is `Keep changes from
  last time`. The dialogs take the document's name, not its path; the 3D editor, which shares them, passes its file's
  name without the extension. **Deviation 113:** one commit for the three views' frame, not one per view, since the
  frame is one shared component. **Deviation 114:** the list buttons say `All levels` / `All tiles` / `All characters`,
  not the view's own name, which the phone's view menu already uses (two buttons named "Tiles"). The delete and
  new-level dialogs were done in 12.1; the refusal dialog already had one (danger) action and plain words. Gates:
  editor unit 3,296 → 3,307 (eight frame tests, one tab-name test, recovery words three for two), editor-3d unit and
  dom 2,932, Chromium layout (map, tiles, characters, level, document) 146 and 3D open flows 32, canvas and journeys 75
  pass and 6 skipped; WebKit, Firefox and hosted CI not run. Screenshots: the design board run is left for 12.5's
  guide.
- **12.6, part (session 13): Step 0, Step G, and the split view's design.** *Step 0, the audit:* four components,
  all under 300 lines (`TunerRows` 272, `TunerPanel` 104, `TunerInspector` 95, `TunerRegions` 25); logic stays in
  `tuner-controller.ts` and `tuner-session.ts`, the markup only forwards; nothing unused. The panel and the rows still
  style with the old `--color-*` aliases and literal fallbacks (`#3a3f48`, `#d9a441`), left for the look (the mockup
  verdict). Words a drunk grandma stumbles on: the constant names (`MAX_RUN`) as every row's title, the comments'
  other-game numbers ("Celeste: 90 px/s.") as its note, "tunable", "Lock" / "Locked" / "Unlock", "Kind" and "Bounds",
  "Create tuning.toml", "Run checks to read bounds: … tuning-meta.json". The Tuner's actions (from its DOM tests):
  search, choose, set a toggle, a text, a number by slider (a drag is one step) or by box, a refused value past a bound,
  keep and let go, create the file, the parse problem with its line, and Ask's scope and locks; all stay. *Step G:*
  a ranged tunable may carry `label` and `feel` text (`-content`'s check accepts them as text, refuses anything else,
  and keeps them out of the values and `tuning-meta.json`; a changeset); Emberwick's ten have them ("Running speed",
  "How fast Wick runs."). The Tuner shows the label and the feel and, when a label is there, never the name in code or
  the comment (`shownName`, `shownNote`); search finds labels and feels too; Lock is `Keep` / `Kept` with the tooltip
  "Keep this value: nothing changes it until you let it go."; "Search settings"; "Tap a setting to see more."; "This
  game has no settings file yet." with `Make one`; "Run the game's checks once to see how far these settings can go.";
  the inspector says Type, Range and What it does. Gates: editor unit 3,307 → 3,311, content's tuning tests 15 → 17,
  Emberwick unit 109, Chromium suite layout 113. **Left for a unit a player can feel:** the values are still the
  sim's units (subpixels per tick); a `unit` and a display scale per tunable (px/s) is the next step of Step G.
  *The split view, designed (steps 1 and 2, next session):* every Tuner edit is already written to
  `content/tuning.toml` as it lands, and the content Vite plugin already rebuilds on a TOML change and sends
  `automata:content` to the page; nothing listens. (a) The runtime (`@mcthaydt/automata`, the owner of the sim's
  content contract) takes new content in development: on `import.meta.hot` `automata:content` it re-imports
  `virtual:automata/content` and starts the game's sim again with it (`createSim` fixes a sim's content for its life,
  and the sim must not grow a content swap for a dev convenience: law 1 and the sim spec), keeping the page, so the
  player sees the room start over with the new feel; never in a build (`import.meta.hot` is undefined there); a unit
  test on the restart and a journey. Found while designing it: the plugin invalidates the module and sends a custom event, but the
  page keeps the module it imported, so a re-import returns the old one; the plugin should send a real HMR update for
  `virtual:automata/content` that the game accepts (`import.meta.hot.accept`), and `startGame`'s handle already has
  `shutdown()` for the restart. Prove it in a real browser against the game's Vite dev server, not with a fake. (b) `automata editor`
  learns the game's dev page (`--game-url`, default the game's Vite port) and the suite reads it from `/api/ping`. (c)
  The Tuner's canvas becomes two regions: the settings and a game pane (an `iframe` of that page, `title="Your game"`),
  side by side from iPad landscape up and stacked, game on top, on a phone; with no dev page answering, the pane says
  "Start your game with pnpm dev to see your changes here." in plain words. No "Play to try it" button.
- **12.6, the split view built (session 14).** *(a) The content plugin sends a real HMR update:* after a good save it
  reloads `virtual:automata/content` through each environment's `reloadModule`, so Vite walks up its importers to the
  module that accepts it, or reloads the page when none does (`automata:content` and `automata:content-error` are still
  sent). The hot-reload example accepts the module itself (`import.meta.hot.accept('virtual:automata/content')`), so its
  `?v=<hash>` import is gone. Found while building it: Vite finds what a module accepts by reading
  `import.meta.hot.accept(...)` as written, so an alias (`const hot = import.meta.hot`) made every save a full reload.
  *(b) The game restarts:* Emberwick's `main.ts` and the create-game template's accept `game.ts` and restart the game
  through `startGame`'s `shutdown()`, one restart after another; Emberwick shows `#game[data-content-hash]`. The
  template's `tsconfig.json` gains `types: ['node', 'vite/client']` for `import.meta.hot`. A new journey,
  `emberwick-dev-chromium` (`tests/e2e/dev.test.ts`), runs Emberwick's dev server on a copy of `content/` (`pnpm
  e2e:dev`, `AF_E2E_CONTENT_ROOT`): a saved tuning value changes the hash on the same page with one canvas; without the
  accept it fails (the page reloads). Emberwick's plumbing budget is 430 lines (was 420; about fifteen for this).
  *(c) `automata editor --game-url`* (default `http://localhost:5173/`, Vite's own port; anything but an http or https
  address is refused in words) is handed to the editor in `/api/ping` as `gameUrl`. The suite reads it
  (`openServedStore`, `openSuitePorts`) and `createTuner({ gameUrl })` gives it to the session. The Tuner's canvas is
  `TunerCanvas`: `TunerGame` (an `iframe` titled "Your game") and the rows, side by side in a canvas 480 px wide and up
  (every iPad, a phone held sideways), stacked with the game on top below that (a phone upright, the 900 x 600 window,
  whose panels leave the canvas 260 px). **Deviation 115:** the split follows the canvas's own width (a container
  query), not the shell's `wide` mode: at 900 x 600 the wide shell leaves the canvas 260 px, and a phone held sideways
  is too short to stack (94 px of rows). Until something answers at the address the pane says "Start your game with pnpm
  dev to see your changes here." and looks again every two seconds; the sample says "Your game shows here when you open
  the editors in your game's folder." Gates: content's plugin tests 10 → 11, the hot-reload example's journeys 2,
  Emberwick unit 109 and the dev journey 1, tools' editor tests 47 → 54 and create-game 44, editor unit 3,311 → 3,315
  and Chromium layout (suite, tuner) 121 including the split at eight sizes, `pnpm check` green; WebKit, Firefox and
  hosted CI not run. **Left for 12.6:** a restart lands on the game's first screen (Emberwick's splash, then the menu),
  so a person tuning presses Play after each change; going back to the screen they were on needs a runtime option to
  start at a screen, and the room's assets load with the splash (`preload_screens`), so it is not a one-line change:
  the next session designs it. The unit a player can feel (px/s) is still to do. The pane's colours wait for the look.
- **12.6, the restart lands where the person was (session 15).** *Design:* the flow already loads a screen's assets
  as it enters (`flow.manager` asks `assets.isLoaded` before each enter), so starting on another screen needs no change
  to the preload: `preload_screens` (and `game.preload`, attached to the first of them) still load at boot, and the
  start screen's own files load as it enters, the same as after any transition. So the runtime gains two small things,
  no more: `startGame(game, { at })` (`StartOptions`, through `runGame` and `bootProgram`'s `startAt` to
  `FlowHandle.start(at)`), which starts on `at` when the flow has that screen and at the entry otherwise (a save can
  rename a screen), and `RuntimeHandle.screen`, the screen showing now (`undefined` before the flow starts and after
  shutdown). The sim is untouched (law 1): a restart is still a new game on new content. *The games:* the create-game
  template's `main.ts` restarts `startGame(fresh.game, { at })` with `at = running.screen`, read before the shutdown;
  Emberwick maps the screens that hold a round (`room`, `paused`, `end`) to `room`, since the round lived in the old
  sim, so a person tuning lands in a fresh round at once and feels the change without pressing Play. Not done, on
  purpose: carrying Wick's position across (a new sim on new tuning is the honest test of the feel, and a carried
  state would need a snapshot across content, which the sim does not allow). Gates: the flow's tests 21 → 22, run-game
  23 → 24 (start at a screen, `screen` before, during and after), create-game's template test, Emberwick's dev
  journey changed to play into the room and expect the room after a save (failed first on `splash`/`menu`, passes
  now); a changeset for `@mcthaydt/automata` and `-tools`, the API report, the agent skill's API and the cheatsheet.
- **12.7, part (session 14): the top bar in plain words (Step G).** Step 0's size check: `Suite.svelte` is 420 lines,
  over the 300 the task allows, and is the one file to split (by responsibility: the editing, Ask and Ship wiring
  leave the markup); every other shell file is under 300. Done: the title is the game's name from the ping (`Your
  game` when a server sends none, `Sample game` on the sample) in place of `Editors`; `Saved in your game folder` beside
  it when edits write the game's files (no change sets); the pills with nothing to say (`No change set`, `No checks
  run`, `No gates`) are hidden until they mean something (`pillsToShow`; with no gate records and nothing reopened the
  gates pill is now `No gates`, not `Gates not readable`); Undo and Redo say so in words (the arrows on a phone); the
  sample's chip is a full-width note over Home: "This is a sample game, not yours. Run automata editor inside your
  game's folder to edit it." Gates: editor unit (suite) 286, Chromium layout (suite) 121. **Left for 12.7:** the split
  of `Suite.svelte`; Ship becomes Publish with its dialog's words (the dialog is the 3D slice's change-set flow, E6, so
  the rename covers both together); Home's levels by name; Step 1's dialog checks.
