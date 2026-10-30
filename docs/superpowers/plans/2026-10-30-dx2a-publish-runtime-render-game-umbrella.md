# DX.2a: publish runtime, render-pixi, game and the umbrella, TDD plan

- **Spec:** [M2.4 build and publish spec](../specs/2026-10-11-m2-build-and-publish-design.md) §3.1 (what is published), §3.2 (package layout), §3.3 (`ui`'s Svelte layout), §3.4 (D-8: Ruken code bundled, Ruken types inlined), §3.5 (Changesets fixed group), §3.6 (consumer smoke); [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.8 (every published export documented); [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §2 F6 (API reports) and §7 (the umbrella).
- **Task:** 02 row `DX.2a — Follow-up (found in DX.2) — Publish runtime, render-pixi and game` (also called DX.2p in PRODUCT.1b), with `@mcthaydt/automata` (PRODUCT.2 plan U-1). Lanes runtime, render, game; the ship lane's build and publish fields. Size L.
- **Why now:** Automata Plus installs core from packs (P5-D1) and cannot depend on `runtime`, `render-pixi`, `game` or the umbrella while they are `private: true`; M5.8, M6.1/M6.2, M3.3 and PRODUCT.6 wait on it. DX.5 and DX.11b need a game package that installs.
- **Status:** drafted 2026-10-30 on branch `claude/dx-2a-publish-runtime-render-game-umbrella` from `main` at `cc5185f`.
- **Progress:** 0 of 9 steps.

## Global constraints

- **Strict TDD** in `packages/` and `tooling/`: each step names the test that fails first and why.
- **D-8:** no published `.js` or `.d.ts` names `@ruken/`; no published package depends on a vendored `file:` tarball.
- **Licence:** `UNLICENSED`, as the other packages, until DX.11a. Registry: GitHub Packages, as the other packages.
- **Not here:** `cli` stays private (M8.8); the npmjs registry and MIT licence (DX.11a); `AGENTS.md`, whose "a private one (render-pixi, game, the umbrella, cli)" line goes stale (left for the integration owner, named in the PR body); no workflow edit (a browser install step for `consumer-smoke.yml` is a follow-up that needs the Owner's words).
- **Process:** `pnpm format` before committing; Conventional Commits; a patch changeset per newly published package.

## What exists

- `render-pixi` has a tsdown build and `publishConfig`; it is `private: true` at version 0.0.1 with an exact `pixi.js` peer.
- `runtime` (0.0.0, no `license`, `repository`, `files`, `publishConfig` or build), `game` (0.0.0, Svelte components, no build) and `@mcthaydt/automata` (0.0.0, no build) are `private: true`, with exact `svelte`/`pixi.js` peers.
- `runtime` and `game` list `@ruken/manifest` as a `file:` **dependency**. Runtime imports only its `Manifest` type (`src/extension/define-extension.ts`) and `@ruken/sdk-host/testing`'s `FakeHostOptions` type (`src/testing/runtime-test.ts`); game imports the value `SLUG_RE` (`src/define-game.ts`).
- `runtime` has two Svelte rune modules, `src/boot/page-layers.svelte.ts` and `src/display/display-policy.svelte.ts` (`$state`). A game's Svelte plugin compiles a module only when its file is named `*.svelte.js`/`*.svelte.ts`, so a bundle that inlines them into `dist/index.js` would throw `$state is not defined` in a game.
- `.changeset/config.json`'s fixed group is `@mcthaydt/automata-*`, which does not match `@mcthaydt/automata`.
- The published nine share version 0.0.3.

## Decisions (mine, recorded for review)

- **DX2A-1. Runtime builds with tsdown in unbundle mode** (output mirrors `src/`, one file per module reachable from an entry) instead of one bundle per entry: its rune modules must reach a game as `boot/page-layers.svelte.js` and `display/display-policy.svelte.js`. `publishedBuild` gains an `unbundle` option. A new dist check in `release-list.test.ts` fails when a rune (`$state(`, `$derived(`, `$effect(`, `$props(`) sits in a `.js` file not named `*.svelte.js`.
- **DX2A-2. Runtime's Ruken imports are types only, so nothing Ruken is bundled into its JavaScript:** `@ruken/manifest` moves to devDependencies; a declarations-only tsdown pass (`tsdown.dts.config.ts`, ui's layout) inlines `@ruken/manifest`'s and `@ruken/sdk-host/testing`'s types into `dist/vendor/*.d.ts`, and `finishSvelteDist` points runtime's declarations there. No `VENDORED.md` (no Ruken code ships), as for `ui` and `testing`. `publishedBuild` gains `rukenTypes`: vendored packages the declarations import, kept as imports by the main pass.
- **DX2A-3. Game builds as `ui` does** (`svelte-package`, then tsdown, then `finishSvelteDist`). Its tsdown pass bundles the one Ruken value it uses, `SLUG_RE`, into `dist/vendor/ruken-manifest.js` with its declaration and writes `VENDORED.md`; `@ruken/manifest` moves to devDependencies. The vendor bundle drops `@ruken/manifest`'s unused `smol-toml` import (`treeshake.moduleSideEffects: false`), so game declares no new runtime dependency. `finishSvelteDist` gains `vendoredCode` (rewritten in `.js` and `.d.ts`), turns svelte-package's `./x.ts` declaration specifiers into `./x.js`, and takes extra test-only paths to drop (`input/testing/`, a test helper).
- **DX2A-4. The umbrella builds with `publishedBuild`** (two entries, both re-exports of `game` and `sim`).
- **DX2A-5. Peers become caret ranges** (`svelte` `^5.57.1`, `pixi.js` `^8.21.0`), the published packages' rule (`release-list.test.ts`, `tooling/versions` `publishedPeerFloors`).
- **DX2A-6. The four take the shared version 0.0.3** (the fixed group; the next release bumps every package to 0.0.4), `license: UNLICENSED`, this repository's `repository` field, `files: ["dist"]` (game: plus `VENDORED.md`), and a `publishConfig` with the same export keys. `sideEffects` names `./dist/no-eval.js` beside `./src/no-eval.ts` (game, umbrella), or a game's bundler would drop the no-eval import; a new release-list test pins it.
- **DX2A-7. `@mcthaydt/automata` joins the fixed group:** `[["@mcthaydt/automata", "@mcthaydt/automata-*"]]`; a new release-list test checks every published package matches a fixed-group pattern.
- **DX2A-8. The consumer smoke boots a minimal game in Chromium:** a `game/` fixture (`@mcthaydt/automata` only: `defineGame`, `startGame`) is built by Vite with the `automata-web` target (a web build needs no host), served with `script-src 'self'` (no eval), and opened with the workspace's Playwright; the step passes when the title screen's Play reaches the play screen and 30 frames run with no console error or page error. A second build of the same game for the Ruken target must hold exactly one Ruken SDK. `pixi.js` joins the smoke project's tools (a peer of render-pixi, game and the umbrella). The browser comes from `PLAYWRIGHT_BROWSERS_PATH` or Playwright's cache; the step fails naming `pnpm exec playwright install chromium` when none is there.
- **DX2A-9. Node imports:** the new entries load Svelte components, rune modules or Pixi, so (like ui's root) they are checked by the types steps, the bundles and the boot, not imported in Node.

## Files

- **Create:** `packages/runtime/tsdown.config.ts`, `packages/runtime/tsdown.dts.config.ts`, `packages/runtime/build/ruken-manifest.ts`, `packages/runtime/build/ruken-sdk-host-testing.ts`, `packages/runtime/build/finish-dist.ts`; `packages/game/svelte.config.js`, `packages/game/tsconfig.package.json`, `packages/game/tsdown.config.ts`, `packages/game/build/ruken-manifest.ts`, `packages/game/build/finish-dist.ts`; `packages/automata/tsdown.config.ts`; `tooling/release/src/tsdown-shared.test.ts`; `tooling/consumer-smoke/src/serve.ts` and `serve.test.ts`, `tooling/consumer-smoke/src/boot-game.ts`, `tooling/consumer-smoke/fixtures/game/` (`index.html`, `main.ts`, `vite.config.ts`, `vite.ruken.config.ts`); `.changeset/dx-2a-publish-runtime-render-game-umbrella.md`.
- **Modify:** `packages/{runtime,render-pixi,game,automata}/package.json`; `.changeset/config.json`; `tooling/release/src/{release-list.test.ts,tsdown-shared.ts,finish-svelte-dist.ts,finish-svelte-dist.test.ts}`; `tooling/consumer-smoke/{src/run.ts,src/project.ts,src/project.test.ts,fixtures/types.ts,README.md,package.json}`; `tooling/api-report/src/core-packages.ts` (comment); doc comments on the newly published exports that lack one (runtime, render-pixi, game); the M2.4 spec §3.1 and §3.4 tables; `pnpm-lock.yaml`.
- **Generated:** `tooling/api-report/reports/*.api.md` (versions), `docs/cheatsheet.md`, `agents/automata/skills/automata-api/reference/api.md` and the plugin version, by `pnpm api-report --update`, `pnpm cheatsheet` and `pnpm agent-skills --write`.

## Interfaces

- **Consumed:** `publishedBuild` and `writeVendored` (`tooling/release`), `finishSvelteDist`, `packWorkspace` (`tooling/core-packs`), `publishablePackages`, `findRukenSdkMarkers` (`packages/host`), `defineGame`/`startGame` (`@mcthaydt/automata`).
- **Produced:** four published packages and their entries: `@mcthaydt/automata-runtime` (`.`, `./extension`, `./testing`), `@mcthaydt/automata-render-pixi` (`.`, `./no-eval`), `@mcthaydt/automata-game` (`.`, `./no-eval`), `@mcthaydt/automata` (`.`, `./no-eval`). `PublishedBuildOptions` gains `unbundle` and `rukenTypes`; `FinishSvelteDistOptions` gains `vendoredCode` and `testOnly`. No source API changes.

## Steps

- [ ] **1. The release list, red first.** `release-list.test.ts`: `EXPECTED` gains the four names; new cases: every published package matches a fixed-group pattern of `.changeset/config.json`; a published `./no-eval` entry's file is in `sideEffects`; (dist) no rune outside a `*.svelte.js` file. Run `pnpm --filter @mcthaydt/release test:unit`: red on the list (four names missing). Then step 3 turns the rest red as the packages become public.
- [ ] **2. Build helpers, red first.** `tsdown-shared.test.ts`: `publishedBuild` passes `unbundle` through, keeps `rukenTypes` out of the bundle and allows them as imports. `finish-svelte-dist.test.ts`: a `./x.ts` declaration specifier becomes `./x.js`; a `vendoredCode` specifier is rewritten in `.js` and `.d.ts`; a `testOnly` folder is removed. Red (options missing), then implement.
- [ ] **3. Manifests.** Remove `private`, version 0.0.3, licence, repository, files, publishConfig, caret peers, `@ruken/manifest` to devDependencies, `sideEffects`, build scripts; game gains `@sveltejs/package` (3.0.0, already pinned for ui); `pnpm install`. The release list is now red on the fixed group (umbrella) and `sideEffects` (game, umbrella): fix `.changeset/config.json` and `sideEffects`; green.
- [ ] **4. Builds.** runtime (step 2's helpers), game, umbrella; `pnpm build`, then `pnpm --filter @mcthaydt/release test:dist` green, including the rune check (red first against a plain bundled runtime build).
- [ ] **5. Consumer smoke, red first.** `project.test.ts`: the project brings `pixi.js` (red); `serve.test.ts`: the static server serves the build with the CSP and content types (red: no module). `types.ts` uses each new entry's main types; the `game` fixture and the boot and one-SDK steps. Run `node tooling/consumer-smoke/src/run.ts --from packs` on a tree whose packages are not yet built (or before step 4's builds) to see the new steps fail; after step 4 every step passes.
- [ ] **6. Documented exports.** `pnpm api-index`: every undocumented export of the four packages gets a doc comment (never a baseline entry); green. `pnpm cheatsheet`, `pnpm agent-skills --write`, `pnpm api-report --update`.
- [ ] **7. Changeset.** One patch changeset naming the four; `pnpm changeset status --since=origin/main` and `node tooling/release/src/check-changesets.ts` green.
- [ ] **8. Spec and docs.** M2.4 spec §3.1 and §3.4 rows for the four; consumer-smoke README; `core-packages.ts` comment.
- [ ] **9. Gates.** `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `pnpm --filter @mcthaydt/release test:dist`; `pnpm api-report`; `pnpm api-index`; `pnpm agent-skills`; `pnpm build && node tooling/consumer-smoke/src/run.ts --from packs`; parity: `pnpm --filter @mcthaydt/automata-render-pixi test:parity`, `pnpm --filter @mcthaydt/automata-runtime test:parity`, `pnpm --filter @mcthaydt/automata-game test:parity`. If PRODUCT.5g (#197) lands first: merge `origin/main` and re-run the release list, consumer smoke and api-report tests.

## Gates

- Selected: step 9.
- Omitted: the e2e suite (no example or game source changes); `pnpm build:examples`/`build:demos` (examples resolve workspace sources, unchanged).
- Pending: the Mac's CI (parity, consumer smoke on a non-draft PR).

## Execution log

| Date | Step | Commits | Result |
|---|---|---|---|
| 2026-10-30 | Plan | (this commit) | The TDD plan with decisions DX2A-1 to DX2A-9. |
