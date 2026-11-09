# Pinned versions

Every external dependency in AF is pinned to an exact version. AF owns its pins (ADR 0006): no other project's list moves them. The one exception is a published package's `peerDependencies`: there an outside peer is `^<pin>`, floored at the workspace's own pin (`svelte`, `vite`), so a game on the next patch still installs AF under npm or strict pnpm. Upgrade one package per PR and update this file in the same PR. `tooling/versions/src/versions.test.ts` fails when a `package.json` uses a range (other than that peer floor), when a pin has no row in the npm table or a different version there, when a row is no longer used, or when Node and pnpm drift from the Runtimes table.

## Runtimes

| Tool | Version | Date | Why |
|---|---|---|---|
| Node | 24.21.0 (`.nvmrc`, `useNodeVersion` in `pnpm-workspace.yaml`) | 2026-10-11 | The current LTS. pnpm fetches this exact version for scripts, so the system Node can differ |
| pnpm | 10.34.6 (the `packageManager` value in `package.json`) | 2026-10-11 | `save-exact`, `engine-strict` |

## npm packages

| Package | Version | Date | Why |
|---|---|---|---|
| `@biomejs/biome` | 2.5.15 | 2026-10-01 | Lint and format in one fast tool |
| `@changesets/cli` | 3.0.3 | 2026-10-11 | One shared `0.0.x` version for every published package and the "Version packages" release PR |
| `@inlang/paraglide-js` | 2.25.4 | 2026-10-16 | Compiles message catalogs into typed message functions. A dependency of `packages/content`, whose build compiles a game's catalogs (`ContentOptions.paraglide`), loaded only when a game asks for it; the runtime binds a game's generated `runtime.js` structurally |
| `@inlang/plugin-message-format` | 4.4.4 | 2026-10-16 | The inlang plugin that reads the `messages/<locale>.json` catalogs the content compiler writes; `packages/content` names it in the inlang project it generates for each compile |
| `@types/fontkit` | 2.0.9 | 2026-10-18 | Typings for `fontkit` in `@mcthaydt/automata-content` |
| `@types/node` | 24.19.1 | 2026-10-11 | Node 24 typings for tooling |
| `@types/pngjs` | 6.0.5 | 2026-10-17 | Typings for `pngjs` in `@mcthaydt/automata-content` |
| `@playwright/test` | 1.63.0 | 2026-10-11 | Browser journeys (`pnpm test:e2e`, root `playwright.config.ts`) |
| `@pmndrs/klipp` | 0.16.0 | 2026-10-30 | The 3D camera in `@mcthaydt/automata-render-pixi3d` (Owner, 2026-10-30: "keep in mind for the camera we're using klipp"). MIT; the core is headless, so its optional peers (`three`, `react`, `camera-controls`, `@react-three/fiber`) are not installed. 0.16 is needed: `addCamera` is gone from it. It brings `math` (pmndrs, MIT) at a canary version as its own exact dependency |
| `@vitest/browser-playwright` | 5.0.3 | 2026-10-01 | Cross-engine parity runs; same major as `vitest` |
| `effect` | 3.22.2 | 2026-10-11 | Services, scopes and the clock outside the sim, in the tools (ADR 0003). Effect 3, not 4.0: 4.0 renamed the Context API and was ten days old when chosen. `ship` uses it without `@effect/platform-node`, whose 0.108 line requires `@effect/cluster`, `rpc`, `sql` and `workflow` as peers |
| `fflate` | 0.8.3 | 2026-10-30 | Reads a zip imported into the 3D editor's OPFS workspace (`packages/editor-3d`, `app/import-files.ts`) (MIT, no dependencies); `unzipSync` with a size filter, so an entry over 16 MB is never inflated. Published 2026-05-16 |
| `fontkit` | 2.0.4 | 2026-10-18 | Reads a font subset back for the glyph-coverage gate in `automata-content assets`. Only the `./assets` subpath imports it, so it stays out of browser graphs |
| `knip` | 6.39.0 | 2026-10-16 | Unused files, exports and dependencies in `pnpm check` (`knip.jsonc`); a 2-week-old release when added |
| `koota` | 0.6.6 | 2026-10-01 | ECS inside the sim (ADR 0001) |
| `lefthook` | 2.1.16 | 2026-10-01 | Pre-commit hooks |
| `oxc-parser` | 0.152.0 | 2026-10-01 | AST for `check-boundaries`, `check-style` and `ship`'s root-absolute check |
| `pixi.js` | 8.22.0 | 2026-10-30 | 2D renderer (ADR 0002). 8.22.0 is the peer floor of the vendored `@pixi/3d` 0.1.0-beta.2 (`^8.22.0`) and was npm latest when moved; no change in it that AF depends on ([the move's plan](archive/superpowers/plans/2026-10-30-m3-2-pixi-822.md)) |
| `@fontsource/pixelify-sans` | 5.3.0 | 2026-10-11 | Pixel font for Emberwick's screens (`games/emberwick`) (OFL-1.1), bundled so it loads under a CSP that allows only `font-src 'self' data:` |
| `@fontsource-variable/geist` | 5.3.0 | 2026-11-06 | The editor kit's and the website's interface face (`packages/editor`, `site`) (OFL-1.1), bundled so the editors load offline and the site makes no third-party request |
| `@fontsource-variable/geist-mono` | 5.3.0 | 2026-11-06 | The editor kit's and the website's face for paths and numbers (`packages/editor`, `site`) (OFL-1.1), bundled likewise |
| `@decimalturn/toml-patch` | 3.3.1 | 2026-10-23 | Patches TOML content documents in the editor (`documents/toml/`) while keeping their comments and layout (MIT); an unchanged document prints byte for byte and a one-value edit changes one line. Array-of-tables structure edits are not safe with comments |
| `playwright` | 1.63.0 | 2026-10-01 | Browsers for parity and DOM checks; the same version as `@playwright/test` |
| `pngjs` | 7.0.0 | 2026-10-17 | Decodes atlas frames and encodes atlas pages in `automata-content assets`. Only the `./assets` subpath imports it, so it stays out of browser graphs |
| `smol-toml` | 1.9.0 | 2026-10-11 | Reads the TOML under `content/` in `@mcthaydt/automata-content`, writes the 2D editor's content export and reads the game's editor list, `content/editors.toml` |
| `subset-font` | 2.9.0 | 2026-10-18 | Cuts each language's font subset to woff2 (harfbuzz wasm) in `automata-content assets`. Build time only, through the `./assets` subpath; never in a game bundle |
| `tsdown` | 0.23.0 | 2026-10-11 | Builds every published package's `dist`. With isolatedDeclarations it writes `.d.ts` with oxc and never needs TypeScript's JS API, which TypeScript 7 lacks |
| `turbo` | 2.11.6 | 2026-10-01 | Task runner, local cache only |
| `typescript` | 7.0.2 | 2026-10-01 | Everything but `svelte-check` and the two tools below; TypeScript 7's native compiler |
| `vite` | 8.3.3 | 2026-10-23 | Builds every AF game, example, editor and the site |
| `vitest` | 5.0.3 | 2026-10-01 | Unit and parity test runner |
| `yaml` | 2.9.1 | 2026-10-11 | Parses the workflows in repo-hygiene's workflow invariants and the template's release workflow in the tools' tests |
| `yauzl` | 3.4.0 | 2026-10-11 | A runtime dependency of the vendored `@ruken/cli`, which `@mcthaydt/automata-tools` ships in `dist/vendor/ruken-cli/` |
| `yazl` | 3.3.1 | 2026-10-11 | The same, for `@ruken/cli` inside `@mcthaydt/automata-tools` |
| `zod` | 4.6.6 | 2026-10-01 | The one schema language (ADR 0003) |
| `@sveltejs/package` | 3.0.0 | 2026-10-11 | Builds `@mcthaydt/automata`'s published `dist/`, Svelte's documented library layout: `.svelte` shipped as Svelte source with TypeScript stripped. Peer `typescript` ^6, so it runs on the 6.0.3 the package pins |
| `@sveltejs/vite-plugin-svelte` | 7.3.1 | 2026-10-11 | Compiles Svelte 5 in the UI, the editors, the site and `examples/2d/ui/primitives` |
| `@tauri-apps/api` | 2.12.4 | 2026-10-31 | The desktop adapter's window API (`onCloseRequested`) and the IPC mocks its tests use, in `@mcthaydt/automata`'s `targets/tauri/` folder only. MIT or Apache-2.0; released 2026-10-14. An optional peer: a game that builds for `tauri` installs it |
| `@tauri-apps/plugin-process` | 2.4.0 | 2026-10-31 | Quit (`exit(0)`) in the desktop adapter. MIT or Apache-2.0; released 2026-09-26. An optional peer of `@mcthaydt/automata` |
| `@tauri-apps/plugin-store` | 2.5.0 | 2026-10-31 | The desktop adapter's saves, one `saves.json` store in the app's data folder. MIT or Apache-2.0; released 2026-09-26. An optional peer of `@mcthaydt/automata` |
| `@tauri-apps/cli` | 2.12.3 | 2026-10-31 | The Tauri CLI `prepare --target tauri` runs, a dev dependency `create-game` writes for a game that builds for `tauri` (ship does not carry it). MIT or Apache-2.0; released 2026-10-14 |
| `@testing-library/dom` | 10.4.2 | 2026-10-11 | DOM behaviour tests (AGENTS.md, Responsive UI) |
| `@testing-library/jest-dom` | 7.0.1 | 2026-10-11 | DOM matchers for those tests |
| `@testing-library/svelte` | 5.4.2 | 2026-10-11 | Renders Svelte components in those tests |
| `@testing-library/user-event` | 14.6.7 | 2026-10-11 | Player input in those tests |
| `jsdom` | 30.1.1 | 2026-10-11 | The `unit` test environment for the UI's DOM tests |
| `svelte` | 5.57.1 | 2026-10-11 | The UI framework (rune stores) |
| `svelte-check` | 4.7.6 | 2026-10-11 | Typechecks `.svelte` files |
| `typescript` | 6.0.3 | 2026-10-11 | For `svelte-check`, which does not support TypeScript 7 yet, and for `tooling/api-index` and `tooling/api-report`, which use its JS compiler API (`transpileDeclaration`, the checker), since 7.0.2 has only `typescript/unstable/*` |

## Tools run without installing

Run through `pnpm dlx` or `npx -y` at an exact version, so they are in no `package.json` (and not in the npm table, which `tooling/versions` matches against the manifests).

| Package | Version | Date | Why |
|---|---|---|---|
| `@anthropic-ai/claude-code` | 2.1.301 | 2026-10-16 | `claude plugin validate --strict` on the agent plugin and marketplace (`pnpm plugin:validate`, through `pnpm dlx`, not a devDependency: it pulls a platform binary), and the Claude Code version the install test ran on. 2.1.301 is what the container had; the claim is "tested on 2.1.301" |
| `skills` | 1.7.0 | 2026-10-16 | The Agent Skills installer (`npx skills add`) in the install test, run through `npx -y`; 1.7.0 (2026-09-17), as 1.7.1 and 1.7.2 were under two weeks old |

## Container images

| Image | Tag | Date | Why |
|---|---|---|---|
| `mcr.microsoft.com/playwright` | v1.63.0-noble | 2026-10-01 | Parity job in CI on any runner but af-mac (which runs it on the host); its tag follows `playwright` |
