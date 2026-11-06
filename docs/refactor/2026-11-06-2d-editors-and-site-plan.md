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
- [ ] **Step 5: Commit.** `refactor(editor): features import only themselves and shared; no 3D in the editor package`

### Task 4.5: Comments, fixtures, unused code and the mock-ups (same PR)

**Files:**
- Modify: comments across `packages/editor/src` and `tests/`; fixtures (`floorfifty.editors.toml`,
  `last-light-bay.editors.toml`, `FLOORFIFTY_SAMPLE`, ...); root `package.json` (`style` roots); `knip.json`
- Move: `docs/design/editor-kit`, `editor-2d`, `editor-suite` → `docs/archive/design/` (`tokens.json` already moved in
  4.2); `docs/design/editor-3d` stays for the 3D slice
- Modify: `docs/guides/editor.md` (first step builds nothing; `automata editor` opens the 2D editor; full rewrite in 12.5)

- [ ] **Step 1:** Add `packages/editor` to `style`'s `--plan-comments`, `--comments-only` and `--test-imports`. Run
  → expected about 943 plan-ID findings (audit S5). Rewrite each comment to say why in plain words, or remove it
  when the code says it. Re-run until 0. **Session breaks** by area (kit, level-2d, features, suite), logging the
  findings left.
- [ ] **Step 2:** Rename the fixtures away from the source projects: `floorfifty.editors.toml` → `platformer.editors.toml`,
  `last-light-bay.editors.toml` → `bay.editors.toml`, `FLOORFIFTY_SAMPLE` → `SAMPLE_GAME`, and the strings inside.
  `grep -rniE "floorfifty|last light|last-light" packages/editor` → 0.
- [ ] **Step 3:** `pnpm knip` → remove what it reports unused in `packages/editor` (the trimmed root entry's leftovers,
  S3). The suite's Node adapters stay: they are imported inside `features/suite` (E6). Re-run tests: counts drop
  only by the deleted files' tests, listed in the execution log.
- [ ] **Step 4:** Archive the mock-ups. `docs/README.md` points at `docs/archive/design/`.
- [ ] **Step 5:** `pnpm check` passes. Commit, mark ready.
  `refactor(editor): plain comments, neutral fixtures, no unused entries, mock-ups archived`

### Task 4.6: The code refactor of the editor package (PR `claude/refactor-ed-quality`)

**Files:** `packages/editor/src/shared/**`, `packages/editor/src/features/*/` logic files (`*-model.ts`,
`*-controller.ts`, `*-session.ts`, commands), `packages/editor/src/app/**`, their tests, `packages/editor/README.md`.
The `.svelte` view components wait for phase 12, which rewrites them (spec 17.4).

- [ ] **Step 1: The read.** Spec 17.3's checks over the package, area by area (kit core and storage, documents and
  history, commands and selection, the 2D model and codecs, the canvas, tiles and auto-tile, the profile and export, the
  editor list, the suite's logic). Findings list in the execution log before any change. Record the unit and Chromium
  browser counts.
- [ ] **Step 2: Fix, one area per commit** (session breaks between areas as needed; log what is left): unused options and
  exports out; single-implementation interfaces folded, keeping the seams tests and targets swap (store, clock,
  renderer); duplicates merged (one memory workspace, one toast model, one id helper); files over 300 lines split by
  responsibility; header comments and whys added.
- [ ] **Step 3:** Counts equal (or lower only by listed dead code); the auto-tile goldens unchanged in Node and
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

- [ ] **Step 1: Move the tests first.** `content-export.test.ts`'s schema assertions and the kit's `field.schema` and
  `check-field-*` tests move to `packages/content/tests/unit/level-2d/` importing `#src/shared/level-2d/...` → they
  fail (no files yet).
- [ ] **Step 2: Move the files** (`git mv`, then fix imports). Run → they pass with the same counts.
- [ ] **Step 3: `level2dKinds`, test first.** A test compiles a temporary content folder holding Emberwick's three
  exported files with `level2dKinds()` and expects `levels` in the sim's content and `project`, `world` outside it; a
  level with an unknown key fails with the schema's path in the message.
- [ ] **Step 4: `intGridRows` and `entitiesOf`, test first.** Emberwick's `room-1.toml` collision layer decodes to the
  same rows `level-room.ts`'s `decodeRow` produces today (copy its current test's expectations); a row with a bad token
  throws `Level room-1, layer collision, row 3: "x*2" is not a number.` The file passes `pnpm boundaries`' sim rule.
- [ ] **Step 5: The entry, the API report, the agent skills.** `pnpm --filter @mcthaydt/automata-content build`,
  `pnpm api-report --update`, `pnpm agent-skills --write`; changeset `patch`: "New `@mcthaydt/automata-content/level-2d`:
  the 2D level format the editor writes and games read."
- [ ] **Step 6: Commit.** `feat(content): the 2D level format has one owner`

### Task 5.2: The editor and Emberwick import it (same PR)

**Files:**
- Modify: `packages/editor/src/shared/kit/fields/index.ts` (re-exports), the editor's export code and tests,
  `games/emberwick/src/features/room/{level-room.ts,emberwick-content.ts}`, `games/emberwick/content.config.ts` (or
  wherever `EMBERWICK_KINDS` is passed), `games/emberwick/tests/unit/room/*.test.ts`
- Delete: `games/emberwick/src/shared/kinds.ts`

- [ ] **Step 1:** Emberwick's tests that read the room keep their expectations; switch the code to `level2dKinds()`,
  `intGridRows` and `entitiesOf`, deleting `LevelLike`, `decodeRow` and `kinds.ts`.
- [ ] **Step 2: The golden must not move.** `pnpm --filter @af-games/emberwick test:unit` → `GOLDEN_HASH` still
  `421c5a1bf522299e`. If it moved, stop and find out why (the sim must get the same values); never re-record it.
- [ ] **Step 3:** The editor imports its schemas from `@mcthaydt/automata-content/level-2d`. Editor unit count equal
  to before less the tests that moved to `-content`.
- [ ] **Step 4:** `pnpm check`, Emberwick's Chromium journeys (`pnpm --filter @af-games/emberwick test:e2e
  --project='*-chromium'`) pass. Commit, mark ready. `refactor(emberwick): read the room through the shared level format`

---

## Phase 6: Save writes the game (one PR, `claude/refactor-ed-save`)

### Task 6.1: `exports` in the editor list and the policy

**Files:**
- Modify: `packages/editor/src/shared/editor-list/{editors.schema.ts,editor-list.ts,write-path.ts}`,
  `packages/tools/src/features/editor/editor-policy.ts`, `games/emberwick/content/editors.toml`
- Test: `packages/editor/tests/unit/editor-list/exports.test.ts`, `packages/tools/tests/unit/editor/editor-policy.test.ts`

- [ ] **Step 1: Failing tests.** (a) A row with `exports = "content"` loads; `fileAccess(list, 'content/project.toml')`,
  `'content/world.toml'`, `'content/levels/room-1.toml'` are writable; `'content/tuning.toml'` is not (unless its own
  row says so); `'content/levels/x.json'` is not. (b) Two rows whose projects share an `exports` folder fail to load
  with spec section 6.1's message. (c) The server policy agrees with (a).
- [ ] **Step 2:** Implement in `editor-list` (one function, `exportPaths(row)`, used by `fileAccess`). The policy
  needs no change beyond using `fileAccess`. Add `exports = "content"` to Emberwick's row.
- [ ] **Step 3: Commit.** `feat(editor-list): a level row names the folder its game files go into`

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

- [ ] **Step 1: Failing tests** on a memory store (`src/testing/memory-workspace.ts`) with Emberwick's list:
  - Save writes `content/project.toml`, `content/world.toml`, `content/levels/room-1.toml` and then the project, in that
    order (the store records the order), with bytes equal to `exportContent(project)`.
  - A game file changed on disk since it was read → nothing is written, the result is `{ conflict: path }`, the
    controller opens the conflict dialog; Keep mine writes all four.
  - A write failure on the second file → the first stays written, the document stays dirty, the store's message is
    shown; the next Save writes all four.
  - No `exports` row (browser storage) → only the project is written, as today.
  - The export model on a checkout with `exports` offers no "Write to folder" and never says "Open a game folder to
    write into it."; the home storage line says "Saved in your game folder".
- [ ] **Step 2:** `save-to-game.ts` composes `exportContent` and `writeToFolder(store, files, seen, 'guarded')`
  (reused, not copied) and writes the project last. `app/editor-2d` passes it in; the document feature does not
  import `share` (spec 3.3).
- [ ] **Step 3:** Run the editor's unit and Chromium browser tests → pass. Copy rows in `copy.md`. Commit.
  `feat(editor): Save writes the game files the game reads`

### Task 6.3: The drift check

**Files:**
- Create: `packages/tools/src/shared/check/levels-step.ts`
- Modify: `packages/tools/src/shared/check/{check-steps.ts,run-check.ts,check-args.ts}` (`--only levels`),
  `packages/tools/package.json` (`@mcthaydt/automata-editor` as a devDependency in place of `-editor-suite`, bundled),
  `packages/tools/tsdown.config.ts`
- Test: `packages/tools/tests/unit/shared/check/levels-step.test.ts` (fixtures: a temp copy of Emberwick's `content/`)

- [ ] **Step 1: Failing tests.** In sync → pass; a hand edit to `levels/room-1.toml` → fails with spec 6.3's two lines;
  a project that does not open → fails with its first problem and the same last line; no `editors.toml` or no
  `exports` row → the step is skipped with "No level files to check."; and the real `games/emberwick` is in sync (this
  is what keeps Emberwick's room and its game files together in `pnpm check`: `-tools`' `check:example` script runs in
  no gate).
- [ ] **Step 2:** Implement with `@mcthaydt/automata-editor/level-export` (Effect, as the other steps are: `-tools`
  is Node tooling). Bundled by tsdown like the editor list.
- [ ] **Step 3:** `node packages/tools/src/app/bin.ts check games/emberwick --only levels` → passes (from source:
  confirms the entry loads in Node). `pnpm check` passes. Commit. `feat(check): catch a level and its game files
  disagreeing`

### Task 6.4: The narrow fallback

**Files:**
- Modify: `packages/tools/src/features/editor/editor-policy.ts`, `packages/tools/src/features/editor/editor-command.ts`
  (usage text)
- Test: `packages/tools/tests/unit/editor/editor-policy.test.ts`

- [ ] **Step 1: Failing test:** with no list, `package.json`, `tsconfig.json` and `content/data.json` are neither readable
  nor writable; `levels/a.af2d.json` is both.
- [ ] **Step 2:** The fallback matches `**/*.af2d.json` outside tool folders. Usage text: "Without
  content/editors.toml, it opens only level files (*.af2d.json)."
- [ ] **Step 3:** `pnpm check`. Commit, mark the PR ready. `fix(editor): without an editor list, only level files are reachable`

---

## Phase 7: The editor ships inside `-tools` (one PR, `claude/refactor-ed-ship`)

### Task 7.1: `--app 2d` by default, and it runs from source

**Files:**
- Modify: `packages/tools/src/features/editor/{editor-args.ts,editor-command.ts}`
- Test: `packages/tools/tests/unit/editor/{editor-args.test.ts,editor-command.test.ts}`,
  `packages/tools/tests/unit/app/editor-from-source.test.ts` (create; spawns the source bin)

- [ ] **Step 1: Failing tests.** `parseEditorArgs([])` → `app: '2d'`. The command resolves `2d` to
  `<bin dir>/editors/2d` when it exists and to the checkout's `packages/editor/dist/2d` otherwise; `3d` and `suite`
  outside a checkout print "The 3D editor is not in this release yet." and exit 2. The spawned source bin
  (`node packages/tools/src/app/bin.ts editor games/emberwick --port 0`) prints its address within 20 s and serves
  `/api/ping` (then is stopped).
- [ ] **Step 2:** Implement. The usage and messages per spec 7.1 (copy rows).
- [ ] **Step 3: Commit.** `feat(editor): automata editor opens the 2D editor and runs from source`

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

- [ ] **Step 1: Failing tests.** `copy-editor` scans `packages/editor/dist/2d` and `packages/editor/dist/suite` with the
  existing `findPixi3d` (one scan, the one `ship prepare` already runs: nothing is moved or copied), fails with spec
  7.3's message naming the file when either holds the beta, and otherwise copies `dist/2d` to `dist/editors/2d`.
- [ ] **Step 2:** Implement; `ship prepare`'s existing tests stay green (unchanged).
- [ ] **Step 3: Verify the package.** `pnpm --filter @mcthaydt/automata-tools build && cd packages/tools && pnpm pack`
  → the tarball lists `dist/editors/2d/index.html`; size recorded. Run the consumer smoke (14 steps plus "the packed
  `automata editor` serves the editor": a new step that starts it on the fixture game and fetches `/`).
- [ ] **Step 4:** Changeset `patch`: "`automata editor` now includes the 2D editor." Commit.
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

- [ ] **Step 1: Failing tests.** (a) `write-template-content.ts --check` regenerates the four game files from
  `start.af2d.json` with `@mcthaydt/automata-editor/level-export` and they equal the checked-in ones. (b)
  `createGame` writes `content/editors.toml` and the five content files. (c) The existing `create-game` journey sees a
  wall where the level has one (read through the template's test hook) and still boots.
- [ ] **Step 2:** Make the starter level in the editor's platformer template (one level, a floor, two platforms, a
  player start), write its game files with the script, and the template's sim reading them through `intGridRows`
  and `entitiesOf`.
- [ ] **Step 3:** The stranger's journey and `pnpm --filter @mcthaydt/automata-tools test:e2e` (Chromium) pass, and
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

- [ ] **Step 1: Failing test:** `copy-editor` fails on a planted `dist/suite` chunk carrying a `PIXI3D_MARKERS` string.
- [ ] **Step 2:** `pnpm --filter @mcthaydt/automata-tools build` (which builds the editor first) → both editor builds
  scanned clean. `pnpm --filter @mcthaydt/automata-editor-3d build` → its `suite/` holds the beta and is not scanned
  (it is not shipped; its Vite config's comment says so).
- [ ] **Step 3: Commit.** `test(suite): the editor package's suite build is scanned for the closed beta`

### Task 8.2: The suite opens the checkout; the rail lists what is there

**Files:**
- Modify: `packages/editor/src/app/suite/main.ts` (ping, then HTTP ports or the sample),
  `packages/editor/src/features/suite/shell/{suite-entries.ts,SuiteRail.svelte,Home.svelte,home-model.ts}`
- Test: `packages/editor/tests/unit/suite/{suite-entries.test.ts,home-model.test.ts,boot.test.ts}`

- [ ] **Step 1: Failing tests.** With two registered editors the rail has two entries and Cmd 1 and 2; Cmd 3 does
  nothing. No card says "Plus" or a package name. The boot uses the HTTP ports when `/api/ping` answers and the sample
  only when it does not.
- [ ] **Step 2:** Implement: `SUITE_ENTRIES` becomes the registered list's order. Delete the not-built card.
- [ ] **Step 3:** `pnpm check`; the editor's Chromium browser tests pass. Commit, mark ready.
  `fix(suite): open the game it is served on and list only its editors`

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

- [ ] **Step 1: Failing test:** the 2D catalog holds no `render3d` or `figures` entry; `examples/2d/package.json`'s
  dependency tree (`pnpm --filter @af-examples/examples-2d list --depth Infinity`) has no `@pixi/3d`.
- [ ] **Step 2:** Move (`git mv`); fix imports. `pnpm --filter @af-examples/examples-2d build` and the closed-beta scan
  of its output pass; the 2D examples' journeys pass in Chromium; the 3D ones run in `3d.yml`.
- [ ] **Step 3:** `pnpm check`. Commit, mark ready. `refactor(examples): 2D and 3D examples are separate packages`

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

- [ ] **Step 1:** `git fetch https://github.com/mcthaydt/automata-website main` (unshallow it first if the session's
  clone is shallow), `git subtree add --prefix site FETCH_HEAD`. If the proxy refuses the pack, use `--squash` and
  record the website's last commit (`4a514eb3` or later) in the commit message.

  **Session break here** if needed.
- [ ] **Step 2:** `pnpm install`. `pnpm --filter @mcthaydt/automata-site test` → record which files fail (the audit:
  6 of 78, `double-jump`, `first-change`, `workshop-controls`, `api-contract`, `example-sources`, `license-claim`).
- [ ] **Step 3: Commit.** `chore(site): move the website into the repository with its history`

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

- [ ] **Step 1: Failing tests.** The guides loader lists `docs/guides/editor.md` and the four publish guides (W7);
  the API loader lists the four published packages, not twelve (W4); the demos list comes from the examples' own
  manifest and has no `bodies-2d` (WS3).
- [ ] **Step 2:** Implement the loaders; delete the sync scripts and every copy; `build-demos.ts` builds the examples
  and Emberwick into `site/.generated/demos/` and Vite serves it as static.
- [ ] **Step 3:** `pnpm --filter @mcthaydt/automata-site test` → no failing file (the six broken ones are deleted with
  what they covered, or now read the real files); `pnpm --filter @mcthaydt/automata-site build` → exits 0 (W3).
- [ ] **Step 4: Commit.** `refactor(site): read the framework at build time; no sync scripts, pins or committed builds`

### Task 10.3: The site's tooling matches the repository's

**Files:**
- Modify: `site/package.json` (Vite 8.3.3, SvelteKit 2.70.4 (the last 2.x; its peers allow Vite 8 and the plugin 7),
  `@sveltejs/vite-plugin-svelte` 7, Zod 4.6.6, exact pins, no `tsx`; TypeScript stays 6.0.3, because SvelteKit 2 and 3
  both ask for TypeScript 6 as a peer), `site/svelte.config.js`, `site/vite.config.ts`, `site/tsconfig.json`; root `package.json`
  (`lint` covers `site`), every site file Biome reformats

- [ ] **Step 1:** Upgrade; `pnpm --filter @mcthaydt/automata-site check test build` pass.
- [ ] **Step 2:** `pnpm format`; `pnpm lint` passes over `site/`. Its existing end-to-end gates (`site/tests/e2e`) pass
  in Chromium.
- [ ] **Step 3:** `site`'s unit tests join `test:unit:2d`, its e2e joins `ci.yml`'s `e2e-2d` job. `pnpm check` passes.
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

### Task 18.3: The editor page and "Try the editor"

**Files:**
- Modify: `site/src/features/editor/**`, `site/scripts/build-demos.ts` (copies `packages/editor/dist/2d` to
  `/editor/app/`), `site/src/shared/csp.ts` (if the editor needs anything new; it must not need `eval`)
- Test: `site/tests/unit/editor/*.test.ts`, `site/tests/e2e/editor-try.test.ts`

- [ ] **Step 1: Failing e2e (Chromium):** `/editor` shows three pictures from the design board and "Try the editor";
  it opens `/editor/app/`, which starts on browser storage with no console error under the site's CSP.
- [ ] **Step 2:** Implement. If Pixi needs `eval` there, the editor's `main.ts` imports `@mcthaydt/automata/no-eval`
  first (spec risks). Copy rows. Commit. `feat(site): try the 2D editor on the site`

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

---

## Phase 21: Launch (one PR, `claude/refactor-site-launch`, then the Owner's steps)

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

- [ ] The Owner supplies the domain, the host and its deploy secret, the project contact address and `NPM_TOKEN`
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
