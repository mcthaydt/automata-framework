# Pinned versions

Every external dependency in AF is pinned to an exact version, as in Ruken (`RukenApp/docs/versions.md`, P0 R-20). The one exception is a published package's `peerDependencies`: there an outside peer is `^<pin>`, floored at the workspace's own pin (`svelte`, `vite`), so a game on the next patch still installs AF under npm or strict pnpm (M2.4 audit). Upgrade one package per PR and update this file in the same PR. `tooling/versions/src/versions.test.ts` fails when a `package.json` uses a range (other than that peer floor), when a pin has no row in the npm table or a different version there, when a row is no longer used, or when Node and pnpm drift from the Runtimes table.

Lanes may append rows for their own dependencies (agreed 2026-10-11); the ship lane owns the file.

Where Ruken pins the same package, AF uses Ruken's version, unless the row says why not.

## Runtimes

| Tool | Version | Date | Why |
|---|---|---|---|
| Node | 24.21.0 (`.nvmrc`, `useNodeVersion` in `pnpm-workspace.yaml`) | 2026-10-11 | Same as Ruken (R-20: Node 24 LTS). pnpm fetches this exact version for scripts, so the system Node can differ |
| pnpm | 10.34.6 (the `packageManager` value in `package.json`) | 2026-10-11 | Same as Ruken; `save-exact`, `engine-strict` |

## npm packages

| Package | Version | Date | Why |
|---|---|---|---|
| `@biomejs/biome` | 2.5.15 | 2026-10-01 | Lint and format (A0). Ruken uses ESLint and Prettier; AF keeps Biome |
| `@changesets/cli` | 3.0.3 | 2026-10-11 | Same as Ruken: one shared `0.0.x` version for every published package and the "Version packages" release PR (M2.4 spec §3.5) |
| `@dimforge/rapier2d-deterministic-compat` | 0.21.0 | 2026-10-11 | 2D physics in `packages/physics` (M2.1). The deterministic build gives bit-identical results in Node, Chromium, WebKit and Firefox; `-compat` inlines the wasm, so no loader setup |
| `@dimforge/rapier3d-deterministic-compat` | 0.21.0 | 2026-10-11 | 3D physics in `packages/physics` (M2.1), and the same release as The Last Light; same reasons as the 2D row |
| `@inlang/paraglide-js` | 2.25.4 | 2026-10-16 | runtime lane (PRODUCT.L1): compiles message catalogs into typed message functions (PRODUCT spec §4). FloorFifty's version (`ac72660`); released 2026-09-17, so older than 14 days. In PRODUCT.L1 only a devDependency of `packages/runtime`, whose tests compile a fixture; the runtime binds a game's generated `runtime.js` structurally. PRODUCT.L2: a dependency of `packages/content`, whose build compiles a game's catalogs (`ContentOptions.paraglide`), loaded only when a game asks for it |
| `@inlang/plugin-message-format` | 4.4.4 | 2026-10-16 | runtime lane (PRODUCT.L1): the inlang plugin that reads the `messages/<locale>.json` catalogs the content compiler writes. FloorFifty's version (`ac72660`); released 2026-08-31. PRODUCT.L2: also a dependency of `packages/content`, which names it in the inlang project it generates for each compile |
| `@types/node` | 24.19.1 | 2026-10-11 | Same as Ruken: Node 24 typings for tooling |
| `@playwright/test` | 1.63.0 | 2026-10-11 | Same as Ruken: browser journeys (`pnpm test:e2e`, root `playwright.config.ts`) |
| `@vitest/browser-playwright` | 5.0.3 | 2026-10-01 | Cross-engine parity runs (A0); same major as `vitest` |
| `effect` | 3.22.2 | 2026-10-11 | Everything outside the sim (ADR 0003). Effect 3, not 4.0: 4.0 is ten days old and renames the Context API (coordinator decision 2026-10-11). `ship` uses it without `@effect/platform-node`, whose 0.108 line requires `@effect/cluster`, `rpc`, `sql` and `workflow` as peers (ship spec §3) |
| `knip` | 6.39.0 | 2026-10-16 | ship lane, QB.1: unused files, exports and dependencies in `pnpm check` (`knip.jsonc`); a 2-week-old release when added |
| `koota` | 0.6.6 | 2026-10-01 | ECS inside the sim (ADR 0001) |
| `lefthook` | 2.1.16 | 2026-10-01 | Pre-commit hooks |
| `oxc-parser` | 0.152.0 | 2026-10-01 | AST for `check-boundaries`, `check-style` and `ship`'s root-absolute check |
| `pixi.js` | 8.21.0 | 2026-10-11 | 2D renderer (ADR 0002). FloorFifty's version (`45482fb`, `pnpm-lock.yaml`); used by Emberwick (`games/emberwick`) until `render-pixi` (M1.7) owns it |
| `@fontsource/pixelify-sans` | 5.3.0 | 2026-10-11 | Pixel font for Emberwick's screens (`games/emberwick`) (OFL-1.1), bundled so it loads under Ruken's `font-src 'self' data:` |
| `playwright` | 1.63.0 | 2026-10-01 | Same as Ruken's `@playwright/test`: browsers for parity and DOM checks |
| `smol-toml` | 1.9.0 | 2026-10-11 | Same as Ruken: reads the TOML under `content/` in `@mcthaydt/automata-content` (M1.3 content spec §8) |
| `tsdown` | 0.23.0 | 2026-10-11 | Same as Ruken: builds every published package's `dist` (M2.4). With isolatedDeclarations it writes `.d.ts` with oxc and never needs TypeScript's JS API, which TypeScript 7 lacks |
| `turbo` | 2.11.6 | 2026-10-01 | Same as Ruken: task runner, local cache only |
| `typescript` | 7.0.2 | 2026-10-01 | Ruken holds 6.0.3 only for svelte-check, typescript-eslint, SvelteKit and Prisma, none of which AF uses (ship spec §3.1) |
| `vite` | 8.3.2 | 2026-10-11 | Same as Ruken: builds the placeholder page (and later every AF game) |
| `vitest` | 5.0.3 | 2026-10-01 | Same as Ruken: unit and parity test runner |
| `yaml` | 2.9.1 | 2026-10-11 | Same as Ruken: parse workflow YAML in ship's workflow tests |
| `yauzl` | 3.4.0 | 2026-10-11 | Same as Ruken: a runtime dependency of the vendored `@ruken/cli`, which `@mcthaydt/automata-ship` ships in `dist/vendor/ruken-cli/` (M2.4 spec §3.4) |
| `yazl` | 3.3.1 | 2026-10-11 | Same as Ruken: the same, for `@ruken/cli` inside `@mcthaydt/automata-ship` |
| `zod` | 4.6.5 | 2026-10-01 | Same as Ruken: the one schema language (ADR 0003) |
| `@sveltejs/package` | 3.0.0 | 2026-10-11 | ship lane: builds `@mcthaydt/automata-ui`'s published `dist/` (M2.4 spec §3.3), Svelte's documented library layout: `.svelte` shipped as Svelte source with TypeScript stripped. Peer `typescript` ^6, so it runs on ui's 6.0.3 |
| `@sveltejs/vite-plugin-svelte` | 7.3.1 | 2026-10-11 | ui lane: compiles Svelte 5 in `packages/ui` and `examples/ui/primitives` |
| `@testing-library/dom` | 10.4.2 | 2026-10-11 | ui lane: DOM behaviour tests (AGENTS.md, Responsive UI) |
| `@testing-library/jest-dom` | 7.0.1 | 2026-10-11 | ui lane: DOM matchers for those tests |
| `@testing-library/svelte` | 5.4.2 | 2026-10-11 | ui lane: renders Svelte components in those tests |
| `@testing-library/user-event` | 14.6.7 | 2026-10-11 | ui lane: player input in those tests |
| `jsdom` | 30.1.1 | 2026-10-11 | ui lane: the `unit` test environment for `packages/ui` |
| `svelte` | 5.57.1 | 2026-10-11 | ui lane: the UI framework (master spec §3, rune stores) |
| `svelte-check` | 4.7.6 | 2026-10-11 | ui lane: typechecks `.svelte` files |
| `typescript` | 6.0.3 | 2026-10-11 | ui lane: for `svelte-check`, which does not support TypeScript 7 yet; ship lane: `tooling/api-index` (DX.4) and `tooling/api-report` (PRODUCT.1) use its JS compiler API (`transpileDeclaration`, the checker), since 7.0.2 has only `typescript/unstable/*`. The rest of AF uses 7.0.2 (as Ruken holds 6.0.3 for svelte-check) |

## Tools run without installing

Run through `pnpm dlx` or `npx -y` at an exact version, so they are in no `package.json` (and not in the npm table, which `tooling/versions` matches against the manifests).

| Package | Version | Date | Why |
|---|---|---|---|
| `@anthropic-ai/claude-code` | 2.1.301 | 2026-10-16 | integration lane (DX.7): `claude plugin validate --strict` on the agent plugin and marketplace (`pnpm plugin:validate`, through `pnpm dlx`, not a devDependency: it pulls a platform binary), and the Claude Code version the install test ran on. 2.1.301 is what the container had; the claim is "tested on 2.1.301" |
| `skills` | 1.7.0 | 2026-10-16 | integration lane (DX.7): the Agent Skills installer (`npx skills add`) in the install test, run through `npx -y`; 1.7.0 (2026-09-17), as 1.7.1 and 1.7.2 are under two weeks old |

## Container images

| Image | Tag | Date | Why |
|---|---|---|---|
| `mcr.microsoft.com/playwright` | v1.63.0-noble | 2026-10-01 | Parity job in CI; its tag follows `playwright` |
