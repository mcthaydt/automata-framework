# EX.6: examples import the core umbrella TDD plan

- **Spec:** [EX spec](../specs/2026-10-16-examples-one-file-design.md) §2 ("Public imports only: `@mcthaydt/automata` (the core umbrella, PRODUCT.2) or an extension's published entry"), §5 (the catalog test), §7 (a deep or non-public import fails the catalog); [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §7 (the umbrella).
- **Task:** `EX.6 — Narrow example imports to the umbrella (follow-up from EX.1)`, integration. PRODUCT.2 (`@mcthaydt/automata`) is merged, so the condition in the row is met.
- **Status:** drafted 2026-10-23.
- **Progress:** 5 of 5 steps.

## Decisions

- **Core packages are rejected, extensions are allowed.** The catalog today accepts any declared entry of a published `@mcthaydt/automata-*` package, plus the private game package (DX.2 plan G-1). EX.6 accepts: the umbrella, `zod`, and the entries of an extension package. The extension packages are a named set in `catalog.ts` (`EXTENSION_PACKAGES`, today `@mcthaydt/automata-physics`); every other `@mcthaydt/automata-*` workspace package is core or tooling, and importing it from an example fails with `import "<specifier>" is a core package; core is imported through "@mcthaydt/automata"`. A new extension package therefore fails loudly until someone adds it to the set, which is the moment to decide its tier.
- **The game package exception goes.** G-1 made `@mcthaydt/automata-game` the one private package an example could import. The umbrella re-exports it unchanged (`export * from '@mcthaydt/automata-game'`), so the exception has no use left.
- **A missing verb stays visible.** An example that needs something the umbrella does not export (the follow-up row "Umbrella verbs core lacks": `sound`, `music`, `t`, `tween`) cannot reach for the owning package. It is blocked on the verb and says so with `Pending:`, which is EX spec §2's rule ("a core verb is missing; the budget is not raised"), applied to imports.
- **`zod` stays a public import.** EX.3 allowed it because every command takes a Zod schema and no core package re-exports `z`. Re-exporting `z` from the umbrella would tie the example's schema library to the umbrella's pinned copy and add a dependency to a package that has none of its own, for no reader benefit: `import { z } from 'zod'` is what a game writes. Decision, recorded in EX spec §2 and the catalog comment.
- **The runner's page imports go through the umbrella too.** `examples/vite.config.ts` names the game package for `startGame` and its `no-eval`. The umbrella exports `startGame` and has a `./no-eval` entry, so the config names `@mcthaydt/automata` and `@mcthaydt/automata/no-eval`. `examples/package.json` then depends on the umbrella, `zod`, `pixi.js` and `svelte` (the umbrella's peers), not on `-game`, `-sim` or `-render-pixi`, and knip's ignore for `@mcthaydt/automata-render-pixi` in `examples` goes (the QB.1a entry for that workspace).
- **Goldens do not change.** The umbrella is the same code; the replays in `examples/__goldens__` must match unchanged in Node and, on CI, in the three browsers. A mismatch is investigated, never re-recorded.

## Files

- **Modify:** `tooling/examples-runner/src/catalog.ts`, `catalog.test.ts`, the fixtures under `src/fixtures/catalog/` (`core-good`, `core-schema`, `core-game`, `core-deep`, `core-private` change; `physics/physics-bodies.ts` and `physics/physics-deep.ts` are new); every example that imports `-game` or `-sim` (12 files: `audio-sound`, `core-basic-window`, `core-camera-2d`, `core-input-gamepad`, `core-input-keys`, `core-input-rebind`, `core-input-touch`, `core-leaderboard`, `render-quality`, `shapes-rects`, `textures-atlas`, `textures-sprite`) for their import lines and `Packages:` headers; `examples/vite.config.ts`, `examples/package.json`, `pnpm-lock.yaml` (by `pnpm install`), `knip.jsonc`; `docs/superpowers/specs/2026-10-16-examples-one-file-design.md` §2; `examples/README.md`; `docs/02-master-delivery-plan.md` (the EX.6 row).
- **No changeset:** no published package changes (`tooling/examples-runner` and `examples` are private).

## Interfaces

- **Consumed:** `@mcthaydt/automata` (`packages/automata/src/index.ts`); each package's `exports`.
- **Produced:** `readCatalog` entries whose `problems` carry the new core-package message; nothing else changes shape.

## Steps

- [x] **1. The catalog rejects core packages, red.** Update `catalog.test.ts` and the fixtures first: `core-good` and `core-schema` import the umbrella (and `zod`) and must pass; `core-game`, `core-deep` and `core-private` fail with the core-package message; `physics/physics-bodies.ts` (`@mcthaydt/automata-physics/2d`, Tier plus) passes; `physics/physics-deep.ts` (`@mcthaydt/automata-physics/src/world`) fails `is not a public entry`; `core-future-ready` still fails `is not a public entry` and the pending fixtures still pass. Run `pnpm --filter @mcthaydt/examples-runner test:unit`; it fails on the missing message and on `core-game` still passing.
- [x] **2. The catalog rejects core packages, green.** `catalog.ts`: `EXTENSION_PACKAGES`; `publicEntries` returns the umbrella, `zod` and the published extensions' entries, plus every workspace package name; `importProblem` reports the core-package message for a core package's entry, deep path or not, and keeps `is not a public entry` for anything else; remove `PRIVATE_ENTRY_POINT`. The catalog test passes on the fixtures; `the real examples` fails on the 12 examples that still import `-game` and `-sim`.
- [x] **3. The examples move to the umbrella.** Each of the 12 examples imports one line from `@mcthaydt/automata`, and its `Packages:` header says `@mcthaydt/automata` (and `zod` where it imports it). `shapes-draw-hud` already does. `examples/vite.config.ts`, `examples/package.json` and `knip.jsonc` follow; `pnpm install` rewrites the lockfile. The catalog's real-examples test passes; `pnpm --filter @af-examples/examples typecheck` passes.
- [x] **4. The goldens still match.** `pnpm --filter @mcthaydt/examples-runner test:unit` replays every `Golden:` example in Node against the unchanged `.replay` files. The three-browser run is `pnpm test:parity`; the CI parity job runs it (this container has Chromium only).
- [x] **5. Docs and gates.** EX spec §2 and `examples/README.md` say what an example may import and why `zod` is allowed; 02's EX.6 row is ticked with this evidence. `pnpm format`, then `pnpm check`, `pnpm build:examples`.

## Gates

- Selected: `pnpm check`; `pnpm build:examples`; the examples-runner Node tests (catalog and golden replays); `pnpm test:parity` for Chromium if the container can run it.
- Omitted here, pending on CI: parity in WebKit and Firefox; `pnpm test:e2e` smoke (the examples boot unchanged under the fake host, but the smoke projects run on the runner).
- No changeset.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | | |
| 2026-10-23 | 1 | | Red first: `catalog.test.ts` 3 of 24 failed (`core-game`, `core-deep`, `core-private` still accepted: `expected [] to include 'import "@mcthaydt/automata-game" is a core pac…'`); the new physics fixtures already passed (an extension's entry accepted, its deep path rejected). The pre-commit hook runs the unit tests on the working tree, so the red state is recorded here rather than committed. |
| 2026-10-23 | 2, 3 | | Green on the fixtures; `the real examples` then failed on the 12 examples (23 problems) until they moved. Biome wraps the merged import of the larger examples over several lines; the catalog counts the wrapped lines and every example is still under the budget. `pnpm install` dropped `-game`, `-sim` and `-render-pixi` from the examples' lockfile entry; the knip ignore for render-pixi went with them. `pnpm --filter @af-examples/examples typecheck` exit 0; `pnpm build:examples` built every example. |
| 2026-10-23 | 4 | | Node: the runner's `node` project 51 passed, 1 skipped (catalog and every `Golden:` replay against the unchanged `.replay` files). Chromium: `vitest run --project browsers --browser.name=chromium` 11 passed, 1 skipped. WebKit and Firefox are the CI parity job's. The container has Chromium 1194 only and Playwright 1.63 wants 1243, so the local run used symlinks to it; its full-Chrome build also asks for `/favicon.ico` (404), which fails the smoke specs the same way on untouched `main`, so smoke is left to CI. |
