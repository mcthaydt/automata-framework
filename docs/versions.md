# Pinned versions

Every external dependency in AF is pinned to an exact version, as in Ruken (`RukenApp/docs/versions.md`, P0 R-20). Upgrade one package per PR and update this file in the same PR. `tooling/versions/src/versions.test.ts` fails when a `package.json` uses a range, when a pin has no row in the npm table or a different version there, when a row is no longer used, or when Node and pnpm drift from the Runtimes table.

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
| `@types/node` | 24.19.1 | 2026-10-11 | Same as Ruken: Node 24 typings for tooling |
| `@playwright/test` | 1.63.0 | 2026-10-11 | Same as Ruken: browser journeys (`pnpm test:e2e`, root `playwright.config.ts`) |
| `@vitest/browser-playwright` | 5.0.3 | 2026-10-01 | Cross-engine parity runs (A0); same major as `vitest` |
| `effect` | 3.22.2 | 2026-10-11 | Everything outside the sim (ADR 0003). Effect 3, not 4.0: 4.0 is ten days old and renames the Context API (coordinator decision 2026-10-11). `ship` uses it without `@effect/platform-node`, whose 0.108 line requires `@effect/cluster`, `rpc`, `sql` and `workflow` as peers (ship spec §3) |
| `koota` | 0.6.6 | 2026-10-01 | ECS inside the sim (ADR 0001) |
| `lefthook` | 2.1.16 | 2026-10-01 | Pre-commit hooks |
| `oxc-parser` | 0.152.0 | 2026-10-01 | AST for `check-boundaries`, `check-style` and `ship`'s root-absolute check |
| `playwright` | 1.63.0 | 2026-10-01 | Same as Ruken's `@playwright/test`: browsers for parity and DOM checks |
| `smol-toml` | 1.9.0 | 2026-10-11 | Same as Ruken: reads the TOML under `content/` in `@mcthaydt/automata-content` (M1.3 content spec §8) |
| `turbo` | 2.11.6 | 2026-10-01 | Same as Ruken: task runner, local cache only |
| `typescript` | 7.0.2 | 2026-10-01 | Ruken holds 6.0.3 only for svelte-check, typescript-eslint, SvelteKit and Prisma, none of which AF uses (ship spec §3.1) |
| `vite` | 8.3.2 | 2026-10-11 | Same as Ruken: builds the placeholder page (and later every AF game) |
| `vitest` | 5.0.3 | 2026-10-01 | Same as Ruken: unit and parity test runner |
| `yaml` | 2.9.1 | 2026-10-11 | Same as Ruken: parse workflow YAML in ship's workflow tests |
| `zod` | 4.6.5 | 2026-10-01 | Same as Ruken: the one schema language (ADR 0003) |
| `@sveltejs/vite-plugin-svelte` | 7.3.1 | 2026-10-11 | ui lane: compiles Svelte 5 in `packages/ui` and `examples/ui/primitives` |
| `@testing-library/dom` | 10.4.2 | 2026-10-11 | ui lane: DOM behaviour tests (AGENTS.md, Responsive UI) |
| `@testing-library/jest-dom` | 7.0.1 | 2026-10-11 | ui lane: DOM matchers for those tests |
| `@testing-library/svelte` | 5.4.2 | 2026-10-11 | ui lane: renders Svelte components in those tests |
| `@testing-library/user-event` | 14.6.7 | 2026-10-11 | ui lane: player input in those tests |
| `jsdom` | 30.1.1 | 2026-10-11 | ui lane: the `unit` test environment for `packages/ui` |
| `svelte` | 5.57.1 | 2026-10-11 | ui lane: the UI framework (master spec §3, rune stores) |
| `svelte-check` | 4.7.6 | 2026-10-11 | ui lane: typechecks `.svelte` files |
| `typescript` | 6.0.3 | 2026-10-11 | ui lane: only for `svelte-check`, which does not support TypeScript 7 yet; the rest of AF uses 7.0.2 (as Ruken holds 6.0.3 for svelte-check) |

## Container images

| Image | Tag | Date | Why |
|---|---|---|---|
| `mcr.microsoft.com/playwright` | v1.63.0-noble | 2026-10-01 | Parity job in CI; its tag follows `playwright` |
