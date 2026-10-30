# PRODUCT.5: the `automata-plus` workspace, `automata add` and the physics move, TDD plan

- **Spec:** [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §6 (Automata Plus, delivery, "Physics moves now"), §9 (ownership, the buy-and-add flow, failures), §10 (PRODUCT.5, acceptance P-c and P-d), §11 (PD-1, PD-2, PD-3); [EX spec](../specs/2026-10-16-examples-one-file-design.md) §6 (the physics row); [M2.4 spec](../specs/2026-10-11-m2-build-and-publish-design.md) (GitHub Packages, packs, consumer smoke); [M8 spec](../specs/2026-10-17-m8-cli-adoption-design.md) (the CLI; lists `automata add` and does not rebuild it).
- **Task:** `PRODUCT.5 — automata-plus repo and automata add` in [02](../../02-master-delivery-plan.md). Lanes **ship** (registry, release) and **integration** (`automata add`), per spec §9. The Owner created the private repo `mcthaydt/automata-plus` (one commit, `3000c20`, a 55-byte README, checked 2026-10-23).
- **Status:** drafted 2026-10-23; decisions confirmed by the hub the same day. 5b and 5c are implemented and checked locally (draft PRs #179 and #177, CI pending); the rest is not started.
- **Progress:** 3 of 8 slices (5a the plan, 5b, 5c). Each later slice gets its own PR and ticks its own steps here.

PRODUCT.5 gates a lot: every Plus package task (M3's `post-retro` and `pipelines`, M4.11, M5.8, M6, M7), the Plus half of PRODUCT.1b, QB.5, and DX.11's first public publish (which must not contain `physics`). It is split so the pieces that need nothing from the Owner start first.

## What the spec leaves open (evidence, 2026-10-23)

1. **How Plus gets core before core is on a registry.** Core has not been published (03: the M2.4 first publish waits on the Owner, and no token exists; `release-packages.yml` stays on a hosted runner by the Owner's word, 2026-10-23 14:21Z, bus question 1427, and hosted Actions are stopped on this account by a billing failure). `runtime`, `render-pixi`, `game`, the umbrella and the editors are `private`, so even after a publish Plus could not install their seams (PRODUCT.1b). **Spike, scratch workspace outside the repo:** `packages/physics` copied to a bare pnpm workspace, `@mcthaydt/automata-sim` and `@mcthaydt/automata-testing` installed from `pnpm pack` tarballs (36 KB and 26 KB; `workspace:*` came out as exact versions and `publishConfig.exports` was applied) with two `overrides` entries. `pnpm install` took 4 s. The package's Node project passed **13 files and 71 tests, the same counts as inside AF** (46.6 s there, 42.6 s in AF); `tsc -p .` (TypeScript 7.0.2) exited 0; the Chromium parity project passed (2 files). One Koota, one sim instance in the install tree. Not covered: WebKit and Firefox (the container has Chromium only), `@mcthaydt/evidence` (stubbed in the spike), `tsdown` (the build helper is a relative import into `tooling/release`). It also showed `physics/vitest.config.ts` lists `koota` in `optimizeDeps.include`, which resolves in AF only because `sim` depends on it; in Plus the list needs a `devDependency` or a shorter list.
2. **`automata check` on a game that uses physics.** `automata check` runs `automata-check-boundaries src/sim` with no flags (`packages/cli/src/check/check-steps.ts`). A game sim may import `@mcthaydt/automata-physics/2d` and `/3d` today only because those two names are hard-coded in the checker's `IMPORT_ALLOWED` (`tooling/check-boundaries/src/check.ts:107-108`). The spec says the physics import entries "move to Plus"; moving the names alone would make every buyer's `automata check` fail, and keeping them leaves core naming Plus packages and needing an edit for each new extension (AGENTS.md: "extensions never edit core files").
3. **The physics demo cannot move as it is.** `examples/physics/bodies-2d` imports `@af-examples/base-2d` (Emberwick, `games/emberwick`) in 12 files, and its golden hash `ad621eea6325a8db` is a hash of Emberwick's sim plus the demo's bodies. The EX plan's rule ("if the old demo had a golden, the hash must be identical") cannot hold in a repo that does not contain Emberwick. Packing Emberwick into Plus means packing its whole closure plus Ruken's vendored tarballs (`file:../../vendor/ruken/…`).
4. **Scope clash on the registries.** Core goes to npmjs.org as `@mcthaydt/automata-*` (DX.11). Plus extensions go to GitHub Packages (spec §6), whose npm scope must equal the repository owner, so they are `@mcthaydt/automata-*` too. npm and pnpm map a scope to one registry, so a buyer's `@mcthaydt:registry=https://npm.pkg.github.com` also sends core installs there.
5. **Plus has no CI.** The Owner's rule is CI on their own devices, and runners are registered per repository. A workflow change needs the Owner's words.

## Decisions

Each is an agent default on the evidence above and reversible.

**Answers, 2026-10-23.** The hub decided that **P5-D1 to P5-D6 stand as written**, and applied the P5-D3 amendment to the approved EX spec row (`automata/inbox/2026-10-23-1915-hub-product5-defaults-stand.md`; the EX spec §6 row and the EX plan entry now carry it). The Owner's words, 2026-10-23 19:15:32Z, relayed in `automata/inbox/2026-10-23-1917-hub-owner-yes-plus-ci.md`: "Yes to a Plus repo CI workflow on af-mac, with the fork guard and the no-hosted-labels test." Runner `af-mac-plus` is registered on `mcthaydt/automata-plus` and online (labels `self-hosted`, `macOS`, `ARM64`, `af-mac`; `automata/inbox/2026-10-23-1925-tests-plus-runner-done.md`). It reaches the framework repository only through the Mac user's global git credential helper, so a Plus job clones AF with plain `git clone`; `actions/checkout` with the job token works for Plus itself and not for AF. A deploy key (the website's `AF_FRAMEWORK_DEPLOY_KEY` pattern) is the fallback if Plus CI should not depend on the Owner's `gh` login.

| ID | Decision | Default | Reversal cost |
|---|---|---|---|
| P5-D1 | How Plus installs core while core has no registry | **Packs from a pinned AF commit.** Plus has a `core.ref` file; a script fetches AF at that commit, builds it and runs AF's new `core-packs` tool, which writes tarballs, the same packs unpacked into folders (`--unpack`) and a `packs.json`; Plus writes the `overrides` block from it, one `file:.core/packs/<folder>` entry per package. A folder is installed rather than a tarball because `pnpm pack` does not write the same bytes twice, so a tarball's lockfile hash would differ from machine to machine, and a directory dependency has no hash (checked in a scratch workspace: a full rebuild of the packs followed by `pnpm install --frozen-lockfile` left the lockfile identical). Extensions declare core as `peerDependencies`. When core is on GitHub Packages (5h) the overrides are deleted and the ranges resolve from the registry. | One block in `pnpm-workspace.yaml` and one script |
| P5-D2 | Who tells the checker which extension entries a sim may import | **The extension, in its own `package.json`:** `"automata": { "simEntries": ["./2d", "./3d"] }`. `check-boundaries` reads the declaration of the package a sim imports (nearest `node_modules`), allows exactly those entries, and drops the two hard-coded physics names. | Re-add two strings |
| P5-D3 | The physics demo | **Retire it from AF in 5g; port it in Plus as a one-file example (`physics/physics-bodies-2d.ts`, row EX.4p) on its own small room, with a new hash recorded in Node and three browsers.** The old hash is recorded as retired in the move note. The package's own cross-engine goldens (`physics-2d.parity`, `physics-3d.parity`) move unchanged and keep proving Rapier is deterministic. This amends the EX spec §6 and EX plan "hash identical" for this one row; the amendment is applied to those two files in 5g, after the hub confirms. | The demo stays in `git` history at the recorded source commit |
| P5-D4 | Plus package names and registry | **Names unchanged** (`@mcthaydt/automata-<ext>`), published to GitHub Packages from `automata-plus`. Buyers set `@mcthaydt:registry` to GitHub Packages with their token, so the release job mirrors core to GitHub Packages as well as npmjs.org. Revisit with QB.5 if a hosted registry ever appears. | A rename before the first Plus publish is a find-and-replace; after it, a major |
| P5-D5 | The Plus license | **`LICENSE`: "All rights reserved" with a pointer to the commercial terms, `"license": "SEE LICENSE IN LICENSE"` in every Plus manifest.** The terms themselves are D-7 (the Owner). No license facts are invented here. | Replace one file |
| P5-D6 | Kit versions for `automata add` | Plus tags `core-v<version>` for each core version its kits were tested against. `add` reads the installed `@mcthaydt/automata` version, clones the greatest such tag at or below it (the newest tag if none is at or below is an error), and checks the kit manifest's `requires.core` range before copying anything. | The tag rule is one function |

## Slices

| Slice | Where, branch | What | Needs |
|---|---|---|---|
| 5a | AF, `claude/project-thread-4vn53j-product5` | This plan, the 02 and 03 updates, the bus filings | — |
| 5b | AF, `…-corepacks` | `tooling/core-packs`: pack the workspace for an outside project | 5a |
| 5c | AF, `…-simentries` | Extensions declare their sim entries (P5-D2) | 5a |
| 5d | AF, `…-add` | `automata add <kit>` in `packages/cli` | 5a |
| 5e | Plus, `claude/project-thread-4vn53j` | The workspace skeleton, `core.ref` sync, CI | 5b merged; the runner and the Owner's yes are in |
| 5f | Plus, `…-physics` | `packages/physics` arrives with its tests and goldens | 5c, 5e |
| 5g | AF, `…-dropphysics` | AF is core only: physics and the demo leave, every list that named them is updated | 5f merged and green on the Mac |
| 5h | Plus (+ AF release workflow) | Registry, release, buyer smoke, mirror of core to GitHub Packages | Not planned here: needs the first core publish (which needs hosted Actions back, the Owner's billing fix), a read token (QB.5) |

5b, 5c and 5d are independent and can be reviewed in any order. **Order of merges that matters:** 5c before 5g (the checker must read declarations before the hard-coded names go), 5f before 5g (nothing is deleted before it exists elsewhere and is green), and 5g before DX.11's first publish. Each PR is handed to the merge thread when it is ready; a Plus PR also needs its runner (5e).

## 5b. `tooling/core-packs`

Owner of "pack the workspace for an outside project". `tooling/consumer-smoke` consumes it, so there is one packer.

- **Create:** `tooling/core-packs/package.json` (private, role: tooling), `tsconfig.json`, `src/pack.ts`, `src/pack.test.ts`, `src/cli.ts`, `README.md`.
- **Modify:** `tooling/consumer-smoke/src/run.ts` (`packAll` calls the shared function), `package.json` (`"packs": "node tooling/core-packs/src/cli.ts"`), `pnpm-lock.yaml`, `knip.jsonc` only if knip asks.
- **Consumed:** `publishablePackages` (`tooling/release/src/publishable-packages.ts`), `pnpm pack`.
- **Produced:** `packWorkspace({ root, out, extras, sourceCommit, pack })` returning `{ sourceCommit, packs: [{ name, version, file, sha256, dir? }] }` and writing the same to `<out>/packs.json`; with `unpack`, each tarball is also extracted into `<out>/<dir>`. `extras` names private workspace packages Plus needs (first: `@mcthaydt/evidence`).

Tests, written first (`pack.test.ts`, with an injected `pack` function and a temporary workspace):

1. Every published package and every extra gets one tarball and one `overrides` entry; an unpublished package that is not an extra gets none.
2. A package without a `dist/` fails and names it (the message consumer-smoke has today: "run pnpm build first").
3. An extra that is not in the workspace fails and names it.
4. `packs.json` records the source commit it was given and a SHA-256 for each file; two runs on the same inputs write identical bytes.
5. A packed manifest that still contains a `workspace:` range fails (pnpm applies it; this pins that nothing else sneaks in).
6. One slow test runs the real `pnpm pack` on `packages/sim` (skipped without a built `dist/`, as the release list tests are).

Steps:

- [x] 1. Tests 1 to 5 red against an empty module; then the minimal `packWorkspace`.
- [x] 2. Move consumer-smoke's `packAll` onto it; `project.test.ts` stays green unchanged.
- [x] 3. The CLI (`--out`, `--extra`, `--source-commit` defaulting to `git rev-parse HEAD`), its usage test, test 6.
- [x] 4. Run it once on the built workspace and record the sizes and the closure in the log.

As built (draft PR #179): `tooling/core-packs/src/{pack,args,cli}.ts`; the dirty-tree rule is `--allow-dirty`, which records `<sha>+dirty` (a pack never claims a commit it was not built from); test 6 runs the real `pnpm pack` over all nine published packages plus `@mcthaydt/evidence`; `--unpack` (commit `2bd0c8f`) extracts each tarball into a folder named by the package (`automata-sim`), recorded as `dir`, which is what Plus installs (P5-D1); `packs.json` carries `sourceCommit` and per pack `name`, `version`, `file`, `sha256`, `dir` and no overrides (a consumer writes its own `file:` paths, since the folder moves), so `consumerWorkspace` in `tooling/consumer-smoke` is unchanged.

## 5c. Extensions declare their sim entries

- **Modify:** `tooling/check-boundaries/src/check.ts` (read `automata.simEntries`; remove `@mcthaydt/automata-physics/2d` and `/3d` from `IMPORT_ALLOWED`; keep the Rapier names, which are engines a sim plugin may import), `check.test.ts`, `packages/physics/package.json` (the declaration).
- **Consumed:** the file being checked (to find `node_modules/<scope>/<name>/package.json` by walking up; `require.resolve` would fail for packages that do not export `./package.json`).
- **Produced:** a declaration schema (Zod: an array of `./`-prefixed strings with no `..`), an `import` finding for a malformed one that names the package, and no change to the finding text for undeclared imports.

Tests, written first (`check.test.ts`, with a temporary project that has `node_modules/@x/ext/package.json`):

1. A sim importing `@x/ext/2d` passes when `./2d` is declared; the existing physics test (`game sims may import the physics extension's sim entry points, and only those`) is rewritten to use the declaration and is red while the names are hard-coded.
2. `@x/ext/3d` (not declared), `@x/ext/src/2d` (deep path) and a package with no declaration all give `import`.
3. A malformed declaration gives one `import` finding naming the package, not a crash.
4. A declaration in a package that the sim does not import changes nothing.
5. The checker's CLI with no flags, run in a temporary game folder (what `automata check` runs: `automata-check-boundaries src/sim`), exits 0 for a declared entry and 1 for an undeclared one, with the declared list in the message (`cli.test.ts`). `run-check.test.ts` uses fakes for the tools, so it cannot prove this.

Steps:

- [x] 1. Tests 1 to 4 red; implement the lookup (`src/sim-entries.ts`).
- [x] 2. Test 5 (`cli.test.ts`).
- [x] 3. Add the declaration to `packages/physics/package.json` in the same PR, so AF itself exercises it until 5g; a patch changeset for `@mcthaydt/automata-check-boundaries` and `@mcthaydt/automata-physics`. `pnpm api-report`, `pnpm agent-skills` and `pnpm api-index` needed no change.

As built (draft PR #177): the declaration is validated with Zod, a new `zod` 4.6.5 dependency of `check-boundaries`; on the real tree, removing the declaration makes the physics demo's sim fail (`bodies.plugin.ts:15 import of "@mcthaydt/automata-physics/2d" is not allowed in the sim`) and restoring it gives 0 findings. AGENTS.md's boundaries line names the declaration.

## 5d. `automata add <kit>`

`packages/cli` (private; the published bins are `automata-check-boundaries`, `automata-content` and `automata-ship`). Spec §9 gives the flow and the failures; M8 lists the command and does not rebuild it.

- **Create:** `packages/cli/src/add/add-args.ts`, `kit-manifest.schema.ts`, `kit-source.ts` (the port and the live `git` implementation), `run-add.ts`, and a `.test.ts` for each, plus `add.integration.test.ts`.
- **Modify:** `packages/cli/src/bin.ts` (`add` next to `create-game` and `check`; the usage text), `bin.test.ts`, the M8 spec's command table (as built), `agents/automata/skills/automata/` command list if it names the commands (`pnpm agent-skills` fails on drift; `--write` fixes it).
- **Consumed:** `runCheck` (`./check/run-check.ts`), `FilesLive` and `ProcessRunnerLive` (`@mcthaydt/automata-node`), the same path rules `create-game` uses.
- **Produced:** one Effect program, `runAdd` (M8-D4: commands are thin and call one program), with the clone behind a `KitSource` service so the tests swap it. `automata add <kit> [--dir <game>] [--repo <url>] [--force]`. Exit 0 added and checked, 1 the added kit failed `automata check`, 2 could not run (no access, unknown kit, version, collision). `kit.json` in each kit folder of the Plus repo: `{ name, requires: { core: '<semver range>' }, files: [{ from, to }] }`.

Behaviour (spec §9): read the installed core version (`node_modules/@mcthaydt/automata/package.json` in the game; absent is an error naming the path) → shallow-clone the Plus repo at the tag from P5-D6 with the buyer's own `git` credentials and `GIT_TERMINAL_PROMPT=0` → read the kit manifest → **check `requires.core` before touching any file** → stage the files in a temporary folder → refuse to overwrite an existing destination unless `--force` → move them into place → run `automata check` in the game. The kit is untrusted input: no script from it runs, only `automata check`, and every `from`/`to` path is validated (relative, no `..`, no duplicates) before anything is cloned into the game.

Tests, written first (the port is faked for the unit tests; the integration test uses a real bare repository created in a temporary folder and a `file://` URL):

1. Args: kit name required, `--dir` default, unknown flag errors.
2. Manifest: valid; missing `requires`; `..` and absolute paths; two files with one destination.
3. No access (the fake port fails like `git` does: "Repository not found", "Permission denied"): the access message, exit 2, and the game folder is byte-identical afterwards.
4. Unknown kit: lists the kits the repository has.
5. `requires.core` newer than installed: the message names both versions, nothing is copied (the folder listing is unchanged).
6. A destination that already exists: error listing the files, nothing written; with `--force` it is replaced.
7. A failure while moving staged files leaves the game folder as it was (inject a failing move on the second file).
8. Success: files appear, then `runCheck` is called once with the game folder, and its report decides exit 0 or 1.
9. Integration: tags `core-v0.0.1` and `core-v0.0.2` in a real repository; installed core 0.0.2 picks `core-v0.0.2`; installed 0.0.3 picks `core-v0.0.2`; installed 0.0.0 is an error naming the tags.

Steps:

- [x] 1. Tests 1 and 2 red; args and schema.
- [x] 2. Tests 3 to 8 red against the fake port; `runAdd`.
- [ ] 3. The live port (`git clone --depth 1 --branch <tag>`, `git ls-remote --tags` for the tag choice) and test 9.
- [ ] 4. Wire `bin.ts`; usage text; M8 command table; `agent-skills` if it asks.

Gates: cli unit tests, `pnpm check`. Omitted here: a run against the real Plus repository (no kit exists until PRODUCT.6; the fixture kit is the proof).

## 5e. The Plus workspace

Files in `mcthaydt/automata-plus`; every path is new.

- **Create:** `package.json` (private root, `packageManager` as AF's), `pnpm-workspace.yaml` (`packages/*`, `examples`, and a block between `# core-overrides:begin` and `# core-overrides:end` that the sync script owns), `.nvmrc`, `tsconfig.base.json`, `biome.json` (both copied from AF with the source commit in a comment, as AF's `VENDORED.md` does for Ruken), `core.ref`, `LICENSE`, `README.md`, `AGENTS.md` and `CLAUDE.md` (`@AGENTS.md`), `tooling/core/{core-ref.ts,sync-core.ts,overrides.ts}` with tests, `.github/workflows/ci.yml`.
- **AGENTS.md** carries what applies from AF's: strict TDD in `packages/`, Plus is paid and private, every Plus package imports core only through public entries (PRODUCT.1b enforces it), CI on the owner's devices and never hosted, no secrets in the repo, conventional commits, one branch one PR, and "a paid capability is never silently replaced by a weaker free path".
- **`sync-core`:** reads `core.ref`; clones or fetches AF into `.core/af` (ignored) with the machine's own git credentials; if `.core/packs/packs.json` already records that commit, stops; otherwise `pnpm install --frozen-lockfile --ignore-scripts && pnpm build && pnpm packs --out <plus>/.core/packs --unpack --extra @mcthaydt/evidence --source-commit <ref>` in AF, then rewrites the overrides block (`file:.core/packs/<folder>`; a name Plus has itself in `packages/` is never overridden, because AF packs its own physics until 5g). The sync imports nothing but Node, because it runs before `pnpm install`.

Tests, written first:

1. `core-ref`: 40 hex characters, nothing else in the file; a branch name is rejected.
2. `overrides`: the block is generated from `packs.json`, sorted, idempotent; text outside the markers survives; a missing marker fails and says which.
3. `sync-core` with fakes for git and the shell: skips when `packs.json` matches `core.ref`; runs the four commands in order otherwise; a failing build stops before the overrides are written.
4. CI shape (as the website's): every job has `runs-on: af-mac`, no hosted label appears anywhere in `.github/workflows`, every job carries the fork guard.
5. Manifests: every `packages/*/package.json` has `"license": "SEE LICENSE IN LICENSE"` and lists core only under `peerDependencies` (devDependencies resolve through the overrides).

Steps:

- [ ] 1. Tests 1 to 3 red; the three scripts.
- [ ] 2. Test 5 (no package yet, so it passes vacuously; it is pinned for 5f) and the root files.
- [ ] 3. The CI workflow and test 4. The Owner's words and the runner are in (see Answers above); the PR quotes the words. It needs `core.ref` to name a commit that has `tooling/core-packs`, so it follows the merge of #179.
- [ ] 4. First green run on the Mac.

As built so far (not pushed: the Owner's feature freeze, 2026-10-23 19:35Z, bus `automata/inbox/2026-10-23-1937-hub-owner-feature-freeze.md`): the Plus workspace is committed locally (`cc77cc6` on `claude/project-thread-4vn53j` in `automata-plus`, no branch pushed, no PR) with `tooling/core/{core-ref,overrides,sync-core,manifest-rules,cli}.ts`, the CI-shape and workspace tests, `.github/workflows/ci.yml`, `core.ref` at `2bd0c8f`, and the root files. 69 tests; lint, typecheck and format green. A real `pnpm core:sync` against a local AF checkout takes 21 seconds and writes 10 packs. Open: the hand mutation run found survivors in `overrides.ts` (the commit-hash end anchor, the folder pattern's first character, array and null as a record, the unchecked `version`, `file` and `sha256`, an empty string, a non-string `dir`, a pack that is not an object, the END marker check), and its `sync-core.ts` mutants have not been run; `core.ref` moves to the merge commit of #179 once it merges.

## 5f. Physics arrives in Plus

Source: AF at the commit 5g is based on, recorded in `packages/physics/EXTRACTED.md` with the golden hashes read from the test files at that commit (AGENTS.md: extracted code comes from a recorded source commit and brings its source tests).

- **Copy:** `packages/physics/**` except `CHANGELOG.md`, `dist/`, `.turbo/`, `node_modules/`.
- **Change (and only this):** `package.json` (`@mcthaydt/automata-sim` moves from `dependencies` to `peerDependencies` at the exact version, `devDependencies` gain `@mcthaydt/automata-sim` and `@mcthaydt/automata-testing` resolved through the overrides, the `automata.simEntries` declaration from 5c, `repository.url` and `directory` for `automata-plus`, `license` per P5-D5), `vitest.config.ts` (`koota` out of `optimizeDeps.include` or into `devDependencies`), `tsconfig.json` (extends the Plus base), `tsdown.config.ts` (the `publishedBuild` helper is AF's; the build is 5h, so the file is copied and not run yet).
- **Tests:** the moved test files are the failing tests (they fail until the install resolves), plus the Plus-side checks: the package's `src` passes `automata-check-boundaries` (the same run the root script gives it in AF), and every Plus package with `simEntries` is on that run's argument list.
- **Acceptance:** 13 files and 71 unit tests green in Node; the parity project green in Chromium, WebKit and Firefox on the Mac with the golden constants unchanged from the source commit (a test-request to the tests thread, as AF's parity is); `tsc -p .` green; `EXTRACTED.md` states the AF commit and the hashes.

Steps:

- [ ] 1. Copy; red on the install; fix the manifest and config.
- [ ] 2. Node unit tests and typecheck local; boundaries run.
- [ ] 3. Test-request for the three-engine parity on the Mac.
- [ ] 4. `EXTRACTED.md`; PR to the merge thread.

## 5g. AF is core only

Each list that pins the old state is changed first (red while physics still exists), then the folders go. Every file below was found by searching the tree on 2026-10-23.

- **Tests changed first:** `tooling/release/src/release-list.test.ts` (`EXPECTED` drops `@mcthaydt/automata-physics`: 8 packages), `packages/ship/src/workflows.test.ts` (`GOLDEN_PACKAGES` drops `packages/physics` and `examples/physics/bodies-2d`), `tooling/consumer-smoke/src/project.test.ts` (the pack list), `tooling/examples-runner/src/catalog.test.ts` and `header.test.ts` (the catalog test reads the real `packages/physics/package.json` through `EXTENSION_PACKAGES`; it moves to a fixture `packagesDir` holding a stub extension manifest, so the rule "an example imports an extension only by its published entry" keeps its test).
- **Replaced by a core-only equivalent:** `tooling/consumer-smoke/fixtures/node-check.mjs` (the sim step runs a small plugin built with `defineComponent` and `defineSystem`, twice, and compares hashes, as the physics step does) and `types.ts`.
- **Modified:** root `package.json` (`boundaries` script: `packages/physics/src` and `examples/physics/bodies-2d/sim` out), `playwright.config.ts` (the `physicsDemo` import, the `physics/*/e2e` `testMatch` entry, the `webServer` entry), `tooling/api-report/src/core-packages.ts` (`NOT_CORE.physics`), `tooling/versions/src/stack-cards.ts` and generated `docs/stack.md` (the Rapier card says "Automata Plus"), `docs/versions.md` (the two Rapier rows say where the pins live), `examples/README.md`, `.changeset/dx4b-testing-physics-docs.md` (drop the `physics` line: `changeset status` fails on a name that no longer exists), `pnpm-lock.yaml`, the EX spec §6 row and EX plan entry (the P5-D3 amendment), `docs/01-decomposition.md` (the line that lists `packages/physics`; `docs/00-overview.md` only if a line says physics ships from this repo), `docs/02`, `docs/03`, generated `docs/cheatsheet.md` and `agents/automata/skills/automata-api/reference/api.md`.
- **Deleted:** `packages/physics/`, `examples/physics/bodies-2d/` (`git rm -r`; `dist/`, `.turbo/`, `node_modules/` are local output). `.github/workflows/ci.yml` line 172 only mentions physics in a comment and is left alone (a workflow edit needs the Owner's words).
- **Not touched:** `check-boundaries`' Rapier import entries (engines a sim plugin may import), and the generic uses of "physics" as a plugin name in `sim`, `testing` and the agent skill example.

Steps:

- [ ] 1. Change the pinning tests; confirm each fails for the right reason with physics still present.
- [ ] 2. Core-only consumer smoke fixtures; delete the folders; update the lists; `pnpm install`.
- [ ] 3. Regenerate: `pnpm build && pnpm api-report --update && pnpm api-index && pnpm cheatsheet && pnpm agent-skills --write && pnpm docs:stack`; `changeset status`; `check-changesets`.
- [ ] 4. `pnpm check`; `pnpm build:examples`; `pnpm build:demos`; `node tooling/consumer-smoke/src/run.ts --from packs`. Parity, e2e and the consumer smoke job are the Mac's.
- [ ] 5. Docs sync; the website's `pnpm sync:stack --check` reports the stack page drift, which the website thread resolves.

## 5h. Registry and release (planned when unblocked)

Needs: the first core publish (the Owner said the release workflow can be cloud, bus 1427 answer of 2026-10-23 14:21Z, so it needs hosted Actions working again, which is the Owner's billing fix); a read token and revocation story (QB.5); the Owner's words for every workflow. Plus's own release workflow follows the same rule when it is planned. Contents when it is planned: Changesets in Plus (its own fixed group), a release workflow, `verify-published`, a buyer smoke that installs a Plus package into a game outside both workspaces and runs `automata add` against the real repository, the core mirror (P5-D4), and the removal of the overrides block (P5-D1).

## Follow-up rows this plan adds to 02

- **EX.4p, `physics/physics-bodies-2d.ts` in Plus** (P5-D3): needs 5f and the Plus examples runner (the EX spec says Plus examples use "the same runner and rules"; the runner is a private AF tool, so it joins the pack list or is published; decided in that row's plan).
- **PRODUCT.1b** keeps the F1 boundary test; 5f only uses `automata-check-boundaries` on `packages/physics/src`.

## Gates

- Selected locally per slice: the slice's tests, `pnpm check` in AF, the Node project and typecheck in Plus.
- Pending on the Mac: three-engine parity for 5f and 5g, the consumer-smoke job, the first Plus CI run.
- Omitted: anything touching the real registry, the real Plus repository's kits, and licensing text.

## Execution log

| Date | Slice | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | 5a | `a28a5f8` | Spike (scratch workspace, not committed): `packages/physics` outside AF with `sim` and `testing` from packs; Node 13 files and 71 tests pass, as inside AF; `tsc` 7.0.2 exit 0; Chromium parity 2 files pass; WebKit, Firefox and evidence pending. Findings 2 to 5 above are read from the tree (`check-steps.ts`, `check.ts`, `bodies-2d` imports, `release-packages.yml`), not run. |
| 2026-10-23 | 5a answers | (this commit) | The hub: defaults stand (inbox 1915); the Owner's yes to a Plus CI workflow on `af-mac` with the fork guard and the no-hosted-labels test (inbox 1917, 19:15:32Z); runner `af-mac-plus` online (inbox 1925). The P5-D3 amendment is applied to the EX spec §6 row and the EX plan. |
| 2026-10-23 | 5c | `claude/project-thread-4vn53j-simentries`, draft PR #177 | Red first: `sim-entries.ts` did not exist; the hard-coded names let the "names no extension" test pass. 55 tests in `check-boundaries`; 7 of 7 planted mutants killed (one survived until `./a/../../outside` was a case). `pnpm check` 33 of 33; `pnpm build`, `api-report` (0 breaks), `api-index`, `agent-skills`, `check-changesets` (50, 0 problems). |
| 2026-10-23 | 5b | `claude/project-thread-4vn53j-corepacks`, draft PR #179 | 21 tests in `core-packs`, 16 of 16 planted mutants killed (one survived until each of the four dependency fields had a case). The consumer smoke on the new packer, `--from packs`: all 11 steps pass. `pnpm packs --out … --extra @mcthaydt/evidence --allow-dirty`: 10 packs, about 370 KB (ui 108, ship 69, host 51, content 50, sim 36, testing 26, physics 12, evidence 10, check-boundaries 4, node 3). `pnpm check` 34 of 34. |
| 2026-10-23 | freeze | `claude/project-thread-4vn53j-product5` | The Owner's feature freeze (19:35:43Z: "We need to let the merges catch-up, no new ruken and automata features until everything is merged"; amendment 19:37:42Z). #175, #177 and #179 stay open and are driven to merge; 5d, 5f and 5g are not started; 5e is committed locally in `automata-plus`, not pushed, no PR. |
