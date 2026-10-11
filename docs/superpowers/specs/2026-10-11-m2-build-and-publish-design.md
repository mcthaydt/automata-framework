# M2.4 Build and publish (lane **ship**): design

- **Status:** drafted 2026-10-11 by the M2 specs thread; revised after the PR #12 audit (H1–H3, M5–M7); awaiting Owner review with the [M2 milestone spec](./2026-10-11-m2-deterministic-core-design.md).
- **Task:** M2.4 in [02 Master delivery plan](../../02-master-delivery-plan.md). Plan: [m2-build-and-publish](../plans/2026-10-11-m2-build-and-publish.md).
- **Owns:** root config (`package.json`, `turbo.json`, `pnpm-workspace.yaml`, `.npmrc`), `.changeset/`, `.github/workflows/` (a new `release-packages.yml`; `ci.yml`, `game-ci.yml` and `game-release.yml` changes), `docs/versions.md`, `tooling/versions/`, new `tooling/release/` and `tooling/consumer-smoke/`, `packages/node/` and `packages/ship/` (ship's own packages, [04](../../04-how-we-build.md)), and in every other published package only its build and publish fields (`private`, `files`, `dependencies`/`devDependencies` moves for D-8, `publishConfig`, `scripts.build`, `tsdown.config.ts`, `VENDORED.md`). The rename of `tooling/check-boundaries` to `@mcthaydt/automata-check-boundaries` (its `IMPORT_ALLOWED` physics entries and `--allow-import` arrive with M2.1b).
- **Must not touch:** any other package's `src/` (except where a build needs an entry file that only re-exports, agreed with the package's lane), `examples/` (they stay private), `vendor/ruken/` (integration).
- **Builds from:**
  - **Ruken's release setup** (RukenApp at `ccad7c0`): `tsdown` 0.23.0 builds (`packages/sdk/tsdown.config.ts`: ESM, `platform: 'browser'`, `target: 'es2022'`, `dts: { eager: true }`); workspace `exports` pointing at `src` with `publishConfig.exports` pointing at `dist` (`packages/sdk/package.json`); `files: ["dist"]`; `@changesets/cli` 3.0.3 with `.changeset/config.json` (`baseBranch: main`, `updateInternalDependencies: patch`); `.github/workflows/release-packages.yml` on `changesets/action` v2.1.2 at `ae32849d` (a "Version packages" PR; merging it publishes); `ci.yml` runs `pnpm changeset status --since=origin/main`; Ruken's CLI bundles its workspace packages with tsdown (`vendor/ruken/README.md`).
  - AF's ship lane: `docs/versions.md`, `tooling/versions/src/versions.test.ts`, `ci.yml` (af-linux, 10-minute job timeouts), `game-ci.yml` (`AF_READ_TOKEN`, "blocked for other repositories until M2.4", ship spec audit round 1).
  - GitHub Packages docs ([Working with the npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry), [About permissions for GitHub Packages](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages), read 2026-10-11): the npm registry "only supports authentication using a personal access token (classic)"; installing needs `read:packages`; a workflow's `GITHUB_TOKEN` can publish packages linked to the workflow's repository.
  - Decisions: master spec §12 D-1 (`render-pixi3d` not published while D-1 stands; provisional), D-6 (vendored Ruken tarballs), D-8 (bundle vendored Ruken code); milestone spec §4 (tsdown, D-8 widened, one fixed version).

## 1. Goal and boundaries

A game in its own repository adds `@mcthaydt/automata-*` packages from GitHub Packages, and they install, import, typecheck (TypeScript 7.0.2 and 6.0.3) and build. Each AF release is one reviewed "Version packages" pull request; merging it publishes every changed package at one shared `0.0.x` version. CI stays under 10 minutes.

**Deliverables:** tsdown builds for every published package (`@sveltejs/package` for `ui`); `publishConfig`; Changesets with one fixed group; the release workflow; `tooling/consumer-smoke` (packed tarballs into a project outside the workspace, then the same against the registry); `tooling/release` (version sync and the patch-only rule); `game-ci.yml` installing AF from the registry; CI timings.

**Not in this task:** npmjs.org publishing; the public mirror and paid-extension split (M10, D-7); the full CLI (M8); publishing `render-pixi3d` (D-1 keeps it unpublished; D-1 is provisional and its review, not this task, would change that).

## 2. Decisions recorded here

| Decision | Why |
|---|---|
| **tsdown 0.23.0**, not Vite library mode (A0+A1 §8, 01 Decomposition §4, both updated by this spec's PR) | Ruken's pin and Ruken's tool for the same job. With `isolatedDeclarations`, tsdown writes `.d.ts` with oxc and never needs TypeScript's JS API, which TypeScript 7 does not have. Proven on `sim` first (plan Task 1) before any other package. |
| **`isolatedDeclarations` everywhere that publishes** | `node` and `ship` turn it off today (`packages/node/tsconfig.json:8`, `packages/ship/tsconfig.json:8`), because `Data.TaggedError(...)` classes need inferred base types (`node/src/errors.ts:4,14`, `ship/src/errors.ts:9`). This task converts them to the `TaggedErrorClass` pattern `content` (`src/compile/errors.ts:11-33`) and `host` (`src/errors.ts:15-40`) already use, then turns the flag on. Same `_tag`, same fields, so callers and `Effect.catchTag` are unchanged |
| **One fixed version** for every published package (Changesets `fixed`) | A game upgrades AF as one thing; `update-game` (M8) and bug reports name one version |
| **Patch bumps only before 1.0** | The master plan says `0.0.x` prereleases; `tooling/release` refuses a `minor` or `major` changeset until the M8 spec changes this rule |
| **Workspace runs `src`; only the published tarball uses `dist`** | AF's tests, examples and parity suites run TypeScript sources today; switching the workspace to built output would add a build before every test. `publishConfig.exports` is the switch, as in Ruken |
| **Games never import `@ruken/*` directly** | `host` bundles `@ruken/sdk` (D-8); a second copy in the game would be a second SDK and a second handshake. Games use `Hosting` (AGENTS.md: "do not duplicate the SDK bridge in game code"). `base-2d`'s direct `Ruken.init` is a marked stand-in that M1.8 replaces |
| **GitHub Packages, workflow token to publish, classic PAT to read** | The release job uses its own `GITHUB_TOKEN` with `packages: write` (GitHub: it can publish packages linked to the workflow's repository). Games install with `AF_READ_TOKEN`, a **classic** personal access token with `read:packages` only: GitHub Packages' npm registry accepts only classic tokens, so a fine-grained token cannot be used (coordinator, 2026-10-11, checked against the docs above; milestone spec §14 Q1) |
| **Turbo stops building before tests** | `turbo.json` makes `typecheck`, `test`, `test:unit` and `test:parity` depend on `^build`. Once packages have build scripts, every `pnpm check` would build dependencies first, against the row above and the 10-minute budget. Those four lose `dependsOn`; `build` keeps `^build` |

## 3. Contracts

### 3.1 What is published

| Package | Source | Entries | Notes |
|---|---|---|---|
| `@mcthaydt/automata-sim` | `packages/sim` | `.`, `./hash`, `./math`, `./replay` (M2.3) | deps `koota`, `zod` |
| `@mcthaydt/automata-physics` | `packages/physics` | `./2d`, `./3d` | Rapier deterministic-compat as dependencies, loaded lazily (#9) |
| `@mcthaydt/automata-content` | `packages/content` | `.`, `./vite`, bin `automata-content` | bundles `@ruken/manifest` (D-8); `vite` peer |
| `@mcthaydt/automata-node` | `packages/node` | `.` | |
| `@mcthaydt/automata-host` | `packages/host` | `.`, `./testing` | bundles `@ruken/sdk`; `./testing` also bundles `@ruken/sdk-host`, so `zod` 4.6.5 becomes a runtime dependency (sdk-host's own dependency) |
| `@mcthaydt/automata-testing` | `packages/testing` | `.`, `./sim` (M2.3) | Ruken types only (`fixtures/viewport-window.ts:9` is `import type`), inlined into its `.d.ts`; `svelte` peer for `.` only |
| `@mcthaydt/automata-ui` | `packages/ui` | `.`, `./testing`, `./theme.css` | `@sveltejs/package`: `.svelte` files shipped as Svelte source with TypeScript stripped, `svelte` export condition; Ruken types only (`landscape-gate.ts:16`, `geometry.ts:10`, `boot-failure.ts:9`), inlined into its `.d.ts` (§3.4) |
| `@mcthaydt/automata-ship` | `packages/ship` | `.`, bin `automata-ship` | bundles `@ruken/manifest`; copies the vendored `@ruken/cli` `dist/` to `dist/vendor/ruken-cli/` and declares its four runtime dependencies (`smol-toml` 1.9.0, `yauzl` 3.4.0, `yazl` 3.3.1, `zod` 4.6.5) |
| `@mcthaydt/automata-check-boundaries` | `tooling/check-boundaries` (renamed from `@mcthaydt/check-boundaries`) | bin `automata-check-boundaries` | `game-ci.yml` runs it on a game's sim roots |

Never published (a test in `tooling/release` holds the list): `examples/*`, `tooling/check-style`, `tooling/versions`, `tooling/release`, `tooling/consumer-smoke`, and `render-pixi3d` while D-1 stands. Extensions stay separate packages (physics now; every later one), so a paid extension can later move to a private repository and registry without touching core (D-7).

### 3.2 Package layout

```jsonc
{
  "name": "@mcthaydt/automata-sim",
  "version": "0.0.1",
  "type": "module",
  "sideEffects": false,
  "files": ["dist", "VENDORED.md"],              // VENDORED.md only where Ruken code is bundled
  "exports": { ".": "./src/index.ts", "./hash": "./src/hash/hash.ts", … },   // the workspace, unchanged
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "exports": {
      ".":      { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
      "./hash": { "types": "./dist/hash.d.ts",  "import": "./dist/hash.js" }
    }
  },
  "scripts": { "build": "tsdown", … }
}
```

- tsdown: ESM only, `target: 'es2022'`, `platform: 'browser'` for packages that run in a game (`sim`, `physics`, `host`, `testing`), `'node'` for `content`, `node`, `ship`, `check-boundaries`; `dts` on; external everything in `dependencies` and `peerDependencies`; bundle `@ruken/*` (D-8). The vendored `file:` tarballs move from `dependencies` to `devDependencies`, as Ruken keeps its bundled workspace packages (`packages/sdk/package.json` at `ccad7c0`), so "external = dependencies" and "bundle Ruken" never disagree. The runtime dependencies of what gets bundled are declared instead (§3.4).
- Bins point at `dist/*.js` with a `#!/usr/bin/env node` banner; in the workspace they keep pointing at `src/*.ts` (Node 24 strips types).
- `VENDORED.md` names the RukenApp commit and each bundled Ruken package with its tarball SHA-256, copied from `vendor/ruken/README.md` by the build, so a published package always says which Ruken it carries.
- `workspace:*` dependencies become the fixed version at publish (pnpm does this).
- `SIM_VERSION` (M2.3) is rewritten by `tooling/release/sync-versions.ts` after `changeset version`, so the version test stays true.

### 3.3 `ui`

`@sveltejs/package` (one new pinned dev dependency, recorded in `docs/versions.md`) writes `dist/` from `src/`: `.svelte` files with `lang="ts"` preprocessed to JavaScript, `.ts` compiled, `.d.ts` emitted. `publishConfig.exports` gains the `svelte` condition. `theme.css` is copied as is. This is Svelte's documented library layout; shipping uncompiled components keeps Svelte's compiler in the game's build, where it belongs.

### 3.4 D-8 cases

Two halves: the JavaScript (bundled) and the declarations (inlined). `host` re-exports Ruken types by contract (M1 shared contracts §1), so a published `.d.ts` that says `from '@ruken/sdk'` would not resolve in a game. tsdown's `dts` bundles the `@ruken/*` declarations into each entry's `.d.ts` (`dts.resolve: [/^@ruken\//]`); `@sveltejs/package` does not bundle, so `ui` runs its emitted `.d.ts` through the same tsdown `dts` pass for the three files that import Ruken types. The release list test (§6) fails if any published `.js` or `.d.ts` still names `@ruken/`.

| Package | Imports from vendored Ruken | JavaScript | Declarations | Declared runtime dependencies |
|---|---|---|---|---|
| `host` | `@ruken/sdk` (values and types) | bundled into `dist/index.js` | inlined | none new |
| `host/testing` | `@ruken/sdk-host/testing` (`createFakeHost`) | bundled into `dist/testing.js` | inlined | `zod` 4.6.5 |
| `testing` | `@ruken/sdk` (types only) | nothing to bundle | inlined | none |
| `ui` | `@ruken/sdk` (types only) | nothing to bundle | inlined | none |
| `content` | `@ruken/manifest` (`parseManifest`, `RATINGS`) | bundled | inlined | `smol-toml` 1.9.0 (already declared) |
| `ship` | `@ruken/manifest`; spawns `@ruken/cli` | manifest bundled; CLI copied to `dist/vendor/ruken-cli/` and resolved relative to `dist/` (`publish-to-ruken.ts` keeps an injectable path, so the change is the default only) | inlined | the CLI's four (§3.1) |

When Ruken publishes its packages, each row switches to a pinned dependency and `VENDORED.md` goes away (01 Decomposition §6).

### 3.5 Changesets and the release workflow

- `.changeset/config.json` as Ruken's, plus `"fixed": [["@mcthaydt/automata-*"]]`, `"access": "restricted"`, `"privatePackages": { "version": false, "tag": false }`.
- `ci.yml` `checks` job gains `pnpm changeset status --since=origin/main` (Ruken's rule: a PR that changes a published package carries a changeset; docs-only PRs pass), `node tooling/release/check-changesets.ts` (patch only) and `pnpm build`. `changeset status` compares against `origin/main`, so the `checks` checkout gets `fetch-depth: 0` on pull requests (Ruken's setting); today it is shallow (`ci.yml:45`).
- `release-packages.yml`: on push to `main`, on `ubuntu-latest`, never `af-linux`: a job holding a write token stays off shared self-hosted runners, AF's own rule for `game-release.yml` and Ruken's for its publish workflows. `permissions: contents: write, pull-requests: write, packages: write`, `concurrency: release`, `timeout-minutes: 20` (Ruken's). Steps: checkout with `fetch-depth: 0`, pnpm, Node from `.nvmrc` with `registry-url: https://npm.pkg.github.com` and `scope: '@mcthaydt'`, `pnpm install --frozen-lockfile`, then `changesets/action` with `version: pnpm release:version` (`changeset version` then the version sync) and `publish: pnpm release` (`pnpm -r --filter './packages/*' --filter './tooling/check-boundaries' build` then `changeset publish`), `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.
- A release is the Owner merging the "Version packages" PR (project memory: nothing merges to `main` without the Owner's word). The workflow publishes nothing on any other push.
- After publishing, the same job runs `tooling/consumer-smoke` in registry mode against the version it just published, so exit 2's evidence is produced by the release itself.

### 3.6 `tooling/consumer-smoke`

`node tooling/consumer-smoke/src/run.ts --from packs|registry [--version 0.0.n]`:

1. `packs`: `pnpm pack` each published package into a temp folder outside the workspace; `registry`: nothing to pack.
2. Write a project there: `package.json` depending on every published package (tarball paths with `pnpm.overrides` for the transitive `@mcthaydt/*` ones, or the registry version), `.npmrc` for `@mcthaydt` on GitHub Packages.
3. `pnpm install` (no workspace above it).
4. Run checks, each a named step in the output:
   - Node: import every entry; create a sim with `physics2d()`, step 60 ticks, round-trip a `.replay` through `packReplay`/`unpackReplay`; compile a three-file content folder with the `automata-content` bin; run `automata-ship --help` and `automata-check-boundaries` on a clean and a dirty fixture (exit 0 and 1).
   - Types: `tsc --noEmit` with TypeScript 7.0.2, then with 6.0.3, over a file that uses each entry's main types (the ship spec §3.1 promise that TS 6 consumers can read AF's `.d.ts`).
   - Bundle: `vite build` of a page importing `@mcthaydt/automata-sim`, `@mcthaydt/automata-host` and one `@mcthaydt/automata-ui` component; the output contains no `new Function` and no `eval(` from AF code (Ruken's CSP has no `'unsafe-eval'`) and exactly one copy of the Ruken SDK.
5. Exit 0 only if every step passed; the temp folder is removed unless `--keep`.

### 3.7 `game-ci.yml` and `game-release.yml`

Today both reusable workflows check AF out with `AF_READ_TOKEN` (Contents read) and run its sources: `game-ci.yml` runs `check-boundaries` and `node $AF/packages/ship/src/cli.ts prepare` (`game-ci.yml:70-102`); all three `game-release.yml` jobs (`build`, `ruken`, `dev-host`) do the same for `prepare`, `publish` and `deploy-dev` (`game-release.yml:87-220`). A classic `read:packages` token cannot read AF's contents, so once `AF_READ_TOKEN` changes meaning both workflows must stop checking AF out, in the same PR.

After M2.4, a game depends on the published packages (`@mcthaydt/automata-ship` and `@mcthaydt/automata-check-boundaries` as dev dependencies), and both workflows:

- check out only the game; set up Node from the game's own `.nvmrc` with `actions/setup-node`'s `registry-url: https://npm.pkg.github.com` and `scope: '@mcthaydt'`; install with `NODE_AUTH_TOKEN: ${{ secrets.AF_READ_TOKEN }}`;
- run the tools from the game: `pnpm exec automata-check-boundaries <sim-roots> [--allow-import …]` (a new `allow-imports` input; M2.1b adds the option) and `pnpm exec automata-ship prepare | publish | deploy-dev` with today's arguments;
- check for `AF_READ_TOKEN` first when the caller is not AF itself and stop with "AF_READ_TOKEN (a classic personal access token with read:packages) is missing", as the release jobs already do for their own secrets;
- describe `AF_READ_TOKEN` as "a classic personal access token with read:packages; GitHub Packages' npm registry accepts no other kind" in both `secrets:` blocks and both header comments (today: "Contents read on mcthaydt/automata-framework").

Inside AF (`github.repository == 'mcthaydt/automata-framework'`), the examples run from the workspace and the workflows keep their in-repo paths, without the token. `game-release.yml`'s token jobs stay on `ubuntu-latest` by default, as now. Calling the reusable workflows from a game still needs AF's Actions access setting ("Accessible from repositories owned by mcthaydt"), which is unchanged.

## 4. Lifecycle

1. A PR changes `packages/sim`; it adds `.changeset/<name>.md` with `'@mcthaydt/automata-sim': patch`.
2. CI: `changeset status` and the patch-only check pass; `pnpm build` passes; `consumer-smoke --from packs` runs nightly and on PRs that touch build config.
3. The PR merges (Owner). `release-packages.yml` opens or updates "Version packages", bumping every package to the next shared `0.0.n` and writing changelogs.
4. The Owner merges "Version packages". The workflow builds and publishes each changed package (with `fixed`, all of them), tags `@mcthaydt/automata-sim@0.0.n` etc., then runs `consumer-smoke --from registry --version 0.0.n`.

## 5. Failure policy

| Case | Behaviour |
|---|---|
| A PR changes a published package without a changeset | `checks` fails at `changeset status` |
| A `minor` or `major` changeset | `checks` fails naming the file (patch only before 1.0) |
| A build fails, or `.d.ts` cannot be emitted without TypeScript's API | `checks` fails at `pnpm build`; never published |
| Version already on the registry | `changeset publish` skips it (it publishes only versions not yet there); a partial earlier publish is completed, never overwritten |
| No `packages: write` / token rejected | The publish step fails; nothing is half-written because npm uploads per package atomically; the job is re-run after the fix |
| `consumer-smoke` fails after a publish | The release job fails loudly; the versions stay published (npm forbids reuse); the fix ships as the next patch, and the failure is recorded in 02's execution record |
| A game installs without `AF_READ_TOKEN` | `game-ci.yml` and `game-release.yml` check for the secret first and say it is missing and that it must be a classic PAT with `read:packages` |
| `AF_READ_TOKEN` is a fine-grained token | `pnpm install` fails with 401 or 403 from GitHub Packages; the workflow's error hint names the classic-token rule |
| A package lists a vendored `file:` dependency in its published `dependencies` | The release test fails before publishing (D-8: bundled, never referenced) |
| `render-pixi3d` or an example marked publishable | The release list test fails |

## 6. Test allocation

| Layer | File | What |
|---|---|---|
| Unit (Node) | `tooling/release/src/check-changesets.test.ts` | patch passes; minor, major and an unknown package fail |
| Unit | `tooling/release/src/sync-versions.test.ts` | rewrites `SIM_VERSION`; idempotent |
| Unit | `tooling/release/src/release-list.test.ts` | exactly the §3.1 packages are publishable; none has a `file:` dependency in `dependencies`; every one has `files`, `publishConfig.exports` matching its workspace `exports` key by key, and `registry`; every `bin` has a `publishConfig.bin` pointing at `dist/*.js`; after `pnpm build`, no published `.js` or `.d.ts` names `@ruken/` |
| Unit | `packages/node/src/errors.test.ts`, `packages/ship/src/errors.test.ts` | each converted error keeps its `_tag` and fields and is caught by `Effect.catchTag`; `tsc` passes with `isolatedDeclarations: true` |
| Unit | `tooling/versions/src/versions.test.ts` | new pins (`tsdown`, `@changesets/cli`, `@sveltejs/package`) have rows |
| Workflow | `packages/ship/src/workflows.test.ts` | `release-packages.yml`: `ubuntu-latest`, permissions, pinned action SHA, concurrency, `timeout-minutes: 20`, `fetch-depth: 0`; `ci.yml` gained the three steps and `fetch-depth: 0` on `checks`; `game-ci.yml` and `game-release.yml` no longer check out AF for a game, run the tools with `pnpm exec`, and describe `AF_READ_TOKEN` as a classic `read:packages` token; `ci:local` still equals ci.yml's checks |
| Config | `tooling/release/src/turbo.test.ts` | only `build` depends on `^build` |
| Build | `pnpm build` | every package builds; `dist` matches `publishConfig.exports` (checked by the release list test after build) |
| Integration | `tooling/consumer-smoke` (`--from packs`) | §3.6, locally and nightly |
| Registry | `consumer-smoke --from registry` | after the first release (exit 2) |
| Timing | CI run logs | each af-linux job's wall time and their sum (exit 8) |

## 7. Feedback workflow

`pnpm --filter <pkg> build` per package while adding configs; `pnpm build` then `consumer-smoke --from packs --keep` to inspect the temp project; `actionlint` (`pnpm lint:actions`) for workflow edits; `pnpm ci:local` before calling the PR green. The first publish is a separate, Owner-approved step after this PR merges.

## 8. Ruken alignment

Follows Ruken's tooling, pins and package layout (§2). Ruken publishes to npmjs.org with OIDC trusted publishing and provenance; AF publishes to GitHub Packages with the workflow token; GitHub's npm-registry docs say nothing of provenance, so AF publishes without `--provenance` (plan Task 9). Request to Ruken (existing): publish `@ruken/cli`, `@ruken/sdk`, `@ruken/sdk-host` and `@ruken/manifest`, after which D-8 bundling ends.

## 9. Exit criteria

1. Every §3.1 package builds with `pnpm build` locally; the release list test passes.
2. `consumer-smoke --from packs` passes locally: Node, TypeScript 7.0.2 and 6.0.3, the Vite bundle with one SDK copy and no eval.
3. `pnpm ci:local` green with the new checks steps; each job's local wall time recorded.
4. After this PR merges, and only on the Owner's merge of the first "Version packages" PR: `0.0.1` is on GitHub Packages and `consumer-smoke --from registry --version 0.0.1` passes in the release job (milestone exit 2).
5. `game-ci.yml` and `game-release.yml` pass their workflow tests for a game outside AF and keep working inside AF (the examples' runs in `ci:local`).
6. On af-linux when it is back: `checks` and `parity` each under 10 minutes, the sum recorded (milestone exit 8). Open until then.

## 10. Open questions

- **Q1, decided (coordinator, 2026-10-11):** the release job publishes with the workflow's own `GITHUB_TOKEN` (`packages: write`); game repositories install with `AF_READ_TOKEN`, a classic personal access token with `read:packages` only (GitHub Packages' npm registry accepts only classic tokens; checked against GitHub's docs, §Builds from). Creating that token is an Owner step at M2.4 time; nothing in this task blocks on it before the first game repository needs it.
- **Q2:** `access: restricted` (packages visible to those with access to AF, which is private). Recommended while AF is private; M10 decides public core packages.
- **Q3:** `@sveltejs/package` for `ui` (recommended) or publish `ui` later.
