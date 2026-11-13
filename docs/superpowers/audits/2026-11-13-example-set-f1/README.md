# F1: the set's shape (execution note)

Branch `claude/example-set-f1`, from `main` at `28d72fb54`. Task F1 of
[the plan](../../plans/2026-11-13-one-example-set.md), as the plan audit changed it. No other task was started and no
old example was deleted. No golden, hash or recorded picture moved.

## What landed

| Part | Where |
|---|---|
| The catalog's `scene` module: 40 code lines, the set package allowed there and nowhere else, the tier taken from the imports | `tooling/examples-runner/src/catalog.ts`, `tests/unit/catalog.test.ts`, `tests/fixtures/scene-catalog`, `tests/fixtures/scene-packages` |
| The nine 3D packages in `EXTENSION_PACKAGES` (still refused while private; nothing on `main` imports one) | `catalog.ts` |
| `@af-examples/set-3d`: the station level (one sector, zone `platform`), three DUEL swatches, `editors.toml`, `scene()`, `SCENE_ZONES`, `SCENE_CAST` (empty) | `examples/set-3d` |
| The content compiler for the 3D examples' page and for the set's tests, with the copy an editor journey names (`AF_E2E_CONTENT_ROOT`) | `examples/set-3d/src/entries/vite.ts` (`./vite` export), `examples/3d/vite.config.ts`, `examples/set-3d/vitest.config.ts` |
| The script `test:unit`, listed in `test:unit:3d` and `test:unit:2d` | `examples/set-3d/package.json`, root `package.json` |

## Rulings

1. **Tier of a scene example.** The plan says "the tier follows the imports in this module" and gives no rule for the
   3D family. Ruling: an import of an extension package makes it `Tier: extension`, except `@automata/3d` and
   `@automata/figures`, which the catalog already treats as core (`render3d`, `figures` modules). Costs, if wrong: a
   header edit in the examples that land later.
2. **One `./vite` entry instead of two copies.** The plan names the content compiler in `examples/3d/vite.config.ts`,
   the set's `vitest.config.ts` and (E14) the story's config. The kinds the set reads are listed once, in
   `@af-examples/set-3d/vite` (`setContentPlugin`), which also aliases the level file to the editor journey's copy and
   lets the dev server read it. Costs, if wrong: one export to inline.
3. **The runner loads its config with `--configLoader runner`.** The config now imports a workspace package that is
   TypeScript source, which Node's own loader refuses (the same reason `games/base-3d` and `examples/3d-story` pass it).
   Added to `examples/3d`'s `build` and `e2e:examples` scripts and to `automata-examples dev`
   (`tooling/examples-runner/src/cli.ts`). The plan's "Done means" allowed `package.json` and `vite.config.ts` only
   under `examples/3d`; the `package.json` change is two scripts. Anything else that runs `vite` over `examples/3d`
   with the default loader fails; nothing found does.
4. **`knip.jsonc` unchanged.** The plan lists it; knip passes with no entry for the new package (its `exports`,
   `vitest.config.ts` and `tests/` are found by its plugins).
5. **`SCENE_CAST` is empty and `cast` is checked anyway.** An unknown name fails with
   `There is no character called "…". The characters are: …`, as an unknown zone does; K1 and C3 fill the list.
6. **A broken link in the copied audit README** (line 265, a draft tracker row written for `docs/superpowers/progress.md`)
   failed `pnpm style --docs` on this branch. It is now the path in code ticks. The audit branch has the link.

## Facts

- The catalog tests fail before the change (`"scene" is not a module`, the nav kit called "a core package") and pass
  after: `pnpm --filter @automata/examples-runner test:unit`, 72 passed, 1 skipped (it was skipped before).
- The shape tests fail before the modules exist (config cannot load: module not found) and pass after:
  `pnpm --filter @af-examples/set-3d test:unit`, 14 passed in 3 files.
- A throwaway example (not committed) calling `scene({ start: 'platform' })` built through the runner and drew the
  platform room in the pixel-art look in Chromium (opened, 844 × 390): floor and walls from the set's own swatches, so
  the content compiler reaches the page. `assetsInlineLimit: 0` (the content plugin's) now applies to the 3D examples'
  build too.
- `pnpm style` does not scan `examples/set-3d` (its path lists name `examples/3d-story/src` and others by hand); the
  set's source and tests are not held to the 600-line, `#src` and plan-comment rules by it yet.

## For the tracker

Rows for `docs/superpowers/progress.md` and `docs/refactor/progress.md` (neither was edited here):

| Task | State | Evidence |
|---|---|---|
| F1 The set's shape | done on `claude/example-set-f1`, no pull request | commits `dcce7c9d2` (catalog) and `8312a429e` (package, entry, content compiler); gates below |
| F1 gates | all run | `pnpm format`; `TURBO_FORCE=true pnpm check` exit 0 (its unit step ran `@af-examples/set-3d`: 3 files, 14 tests); `pnpm build` exit 0; `pnpm --filter @af-examples/examples-3d test:e2e --project examples-3d` 22 passed |

## Gates, as run

| Gate | Result |
|---|---|
| `pnpm format` | ran (Biome; the pre-commit hook ran it and the catalog and set unit tests on each commit) |
| `TURBO_FORCE=true pnpm check` | exit 0 (67 tasks; the first run failed in `@automata/examples-runner#typecheck` on the new fixtures, fixed by excluding `tests/fixtures/scene-catalog` as the catalog fixtures are) |
| `pnpm build` | exit 0 (16 tasks) |
| 3D examples' e2e, Chromium (`examples-3d` project) | 22 passed, 2.6 min |

Left out: the WebKit project (`examples-3d-webkit`), `pnpm test:browser:3d`, `pnpm test:journeys:3d`, the 2D browser suites and
parity in three engines (nothing in F1 touches a sim, a 2D package or a picture; they run in the pull request's CI). No
pull request was opened. `git status` shows no recorded file (golden, hash, `screenshots-approved.json`) changed.
