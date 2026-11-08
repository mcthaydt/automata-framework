# QB.3g: re-sync the site to framework `main` TDD plan

- **Spec:** the QB.3f finding (results doc, "CI and Lighthouse (QB.3f)"): the site's committed copies match the framework at `365f115`, and `main` has moved `examples/base-2d` to `games/emberwick` (EX.2), so CI had to pin the framework. The coordinator asked for this first, since the pin is a stopgap (bus, 2026-10-23, answer to the 0234 follow-ups).
- **Status:** implemented and verified locally 2026-10-23 against framework `5ad4a84` (Chromium only; WebKit is a bus test-request); stacked on `main` (QB.3 and QB.3f are merged).
- **Progress:** 6 of 6 steps.
- **Branch:** `claude/project-thread-onilcu-resync`, based on `main`.

## Findings that shape the design

- **Against framework `main` the site had** 10 `svelte-check` errors, `pnpm sync` stopping at "Missing demo source: …/examples/base-2d/main.ts", `verify:workshop` (and so `pnpm build`) failing, and, in the merge queue's run, `api-contract`, `example-sources` and `source-explorer` failing plus three test files failing at import. Every cause was the one move: Emberwick's package `@af-examples/base-2d` now lives at `games/emberwick`, and the site named `examples/base-2d` in code, tests, data and displayed file paths.
- **Everything else the site copies is still where it was.** The six demos (`renderer-2d`, `bodies-2d`, `boot-and-flow`, `primitives`, `hot-reload`, `lifecycle-and-saves`) are at their old paths until EX.4 ports them to one-file examples; the cheatsheet, which the `api-contract` test checks against the package entry points, needed no change.
- **A sync must replace a bundle, not merge into it.** Demo files have content hashes in their names. The old sync copied a new build over the old one, so each demo folder would keep the previous build's files, published and unreferenced.
- **The site's committed bundles must come from the same framework commit as the displayed sources.** The sync therefore builds nothing itself (the framework's `pnpm build:demos` and `pnpm --filter @af-examples/base-2d build` do) and records the commit it read in `framework.ref`, which is also what CI checks out. A checkout with edited or untracked files is refused, since the copy would not be that commit.
- **The three licence files.** The site's copies of `LICENSE`, `LICENSE-SCOPE.md` and the `license` field carried MIT ahead of the framework (QB spec F-1). Syncing copies only what the framework has, so they drop out of the published project files, `api-contract` no longer needs its allowance, and its `it.fails` test goes. After DX.11 the next sync brings them back. The Terms page and `license-claim.test.ts` (expected red until DX.11) are unchanged.

## Interfaces

- **Produced:** `scripts/framework-source.ts` (`frameworkCommit`, `writeFrameworkRef`); `installDemoBundle`, `demoBundleDirectory` and a `games/` search in `scripts/sync-demos.ts`; `framework.ref` written by `pnpm sync`.
- **Consumed:** the framework checkout at `../automata-framework`, clean, at the commit to sync, with its demos built.

## Files

- **Create:** `scripts/framework-source.ts`, `tests/framework-source.test.ts`, `tests/demo-bundles.test.ts`.
- **Modify:** `scripts/sync-demos.ts`, `tests/example-sources.test.ts`, `tests/api-contract.test.ts`, the tests that name Emberwick's files (`demo-navigation`, `double-jump`, `first-change`, `homepage`, `source-explorer`, `workshop-controls`), `workshop/*.ts`, `src/routes/+page.svelte`, `src/routes/start/+page.svelte`, `src/data/ai-guidance.ts`, `src/data/creative-starts.ts`; regenerated: `src/data/projects.json`, `src/data/demos.json`, `src/data/first-change-proof.json`, `static/demos/**`, `static/llms-full.txt`, `framework.ref`.

## Steps

- [x] **1. Baseline.** Framework at `main`: record the failures above.
- [x] **2. The collector finds shared packages under `games/`.** `tests/example-sources.test.ts` fails ("Missing shared example package") for a base in `games/` and for Emberwick; search `examples` and `games`; passes.
- [x] **3. A bundle folder follows the public URL.** Fails (`demoBundleDirectory` missing); implement; Emberwick stays at `/demos/base-2d` while its source is at `games/emberwick`.
- [x] **4. A sync replaces a bundle, and records its source.** `tests/demo-bundles.test.ts` and `tests/framework-source.test.ts` fail (no functions); implement `installDemoBundle`, `frameworkCommit` and `writeFrameworkRef`, and wire them into `pnpm sync`.
- [x] **5. Sync and repoint.** Build the framework's demos at `5ad4a84`, run `pnpm sync`, repoint the displayed paths, the workshop imports and the tests; drop the licence-file allowance from `api-contract`.
- [x] **6. Gates and bookkeeping.** `pnpm check`, `pnpm test`, `pnpm build` (which re-verifies the workshop against the framework's sim), `pnpm check:site`, the Chromium suite; mutation checks; results doc. The framework's 02 and 03 rows are a separate docs PR.

## Execution log

See the results doc, "Re-sync to framework main (QB.3g, 2026-10-23)".
