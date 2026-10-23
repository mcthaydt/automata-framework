# QB.1a: remove frame-budget's unused `@ruken/manifest` TDD plan

- **Spec:** [QB spec](../specs/2026-10-16-quality-bar-design.md) §4.1 (knip in `pnpm check`).
- **Task:** `QB.1a — knip baseline` (02), the `tooling/frame-budget` part. The row's other parts are already gone: the `examples/render-pixi/renderer-2d` ignore left with that demo (EX.4, #108), the `examples` workspace's `@mcthaydt/automata-game`, `zod` and `@playwright/test` entries no longer exist on `main`, and `examples/runtime/boot-and-flow` leaves with its EX.4 port.
- **Status:** drafted 2026-10-23, based on `main`. No PR is opened until the shared runner's queue drains.
- **Progress:** 0 of 3 steps.

## What is wrong

`tooling/frame-budget` lists `@ruken/manifest` as a dev dependency, copied from the examples when the package was made, and imports it nowhere. `knip.jsonc` ignores it so `pnpm knip` stays green.

## Decisions

- **Remove the dependency and the ignore together.** The test is knip itself (`tooling/repo-hygiene/src/knip.test.ts` proves it fails on a planted unused export): with the ignore gone and the dependency still listed, knip names it; with both gone it is clean.
- **02's row is not edited here.** `QB.1a`'s row is also edited by the renderer-2d port (#108), and two edits to one table row conflict. The row's update (what is done, what `boot-and-flow` still holds) goes in the docs sync PR once those have merged.
- **No changeset.** `tooling/frame-budget` is private.

## Files

- **Modify:** `tooling/frame-budget/package.json`, `pnpm-lock.yaml` (via `pnpm install`), `knip.jsonc`; this plan.

## Steps

- [ ] **1. Red.** Remove the `tooling/frame-budget` ignore in `knip.jsonc` and leave the dependency; `pnpm knip` fails naming `@ruken/manifest` in `tooling/frame-budget/package.json`.
- [ ] **2. Green.** Remove the dependency and run `pnpm install`; `pnpm knip` is clean.
- [ ] **3. Gates.** `pnpm check`; `pnpm --filter @af-examples/frame-budget` typecheck and tests (the package's own scripts) still pass.

## Gates

- Selected: `pnpm check`; the frame-budget package's own tests.
- Omitted here, pending on CI: the rest of CI.
- No changeset.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | | |
