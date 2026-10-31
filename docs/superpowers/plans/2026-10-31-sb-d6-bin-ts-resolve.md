# SB-D6 follow-up: the pipeline bins resolve TypeScript sources (TDD plan)

- **Origin:** M6.7b's SB-D6 (`2026-10-31-m6-7b-systems-bots.md`), carried by M6.6b and M6.8a as a follow-up. The
  `systems` and `puzzle` pipelines import their extension when a stage runs, so the bins start; but a run from the bin
  then fails, because Node's type stripping does not resolve the extensions' extensionless relative imports.
- **Branch:** `claude/plus-SB-D6-bin-ts-resolve`, from main (`434f135`); one PR.
- **Status:** implemented and locally checked.

## Evidence (before)

`node tooling/pipelines/src/cli.ts systems run <folder> --json`, on a folder whose `scene.ts` re-exports the ward
scene, exits 1: `scenarios: the systems bots: Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'…/packages/systems/src/bots/bot' imported from …/packages/systems/src/bots/index.ts`.

## Scope

In:
- `tooling/pipelines/src/ts-resolve.ts`: a synchronous resolve hook (`module.registerHooks`, Node 24) for a module
  imported from a `.ts` file: a relative or `file:` specifier with no `.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts` or
  `.json` extension resolves to `<specifier>.ts`, else `<specifier>/index.ts`, else Node's own answer (and its
  error). Bare specifiers, specifiers with an extension and imports from JavaScript are Node's alone.
- Both bins (`cli.ts`, `mcp-cli.ts`) register it first. Stages import lazily (SB-D6), so a hook registered in the bin's
  body is in place before any extension or scene module loads.

Out: the converters' own hooks (one-off scripts in their packages, unchanged); a built Plus; any change to the
platform's stage-failure reporting.

## Files

Create `tooling/pipelines/src/ts-resolve.ts` (resolve and load hooks) and `ts-resolve.test.ts`. Modify `tooling/pipelines/src/cli.ts`,
`mcp-cli.ts`, `cli.test.ts` (the bin runs `systems run` and `puzzle run`), and this plan.

## Steps

1. The hook, pure (a fake `nextResolve`): `.ts` first, then `/index.ts`, then Node's own error; bare, extensioned and
   from-JavaScript specifiers pass through untouched. Fails: no module.
   - [x] 1
2. The bins: `cli.test.ts` runs `systems run` and `puzzle run` from the bin on temporary scene folders and expects
   `ok: true` with every stage done. Fails with `ERR_MODULE_NOT_FOUND` (above). Register the hook in both bins.
   - [x] 2
3. Gates: `pnpm format`, `pnpm check`; the log; the PR and ready line.
   - [x] 3

## Decisions for the Owner's veto

- **TR-D1:** the hook applies only below a `.ts` parent, so published JavaScript keeps Node's resolution exactly.
- **TR-D3 (found in step 2):** Node refuses to strip types under `node_modules`, where pnpm installs core's private
  `sector-format` (its pack exports `./src/index.ts`). The load hook strips a `.ts` file there with Node's own
  `stripTypeScriptTypes` (experimental in Node 24: a stage that loads one prints Node's one-line ExperimentalWarning
  on stderr). The lasting fix is core's: a framework request to build `sector-format` like the published packages.
- **TR-D4 (found in step 2):** a `?raw` import loads as its file's text, the default export (Vite's convention, which
  the extensions' fixtures and a game's scene module use); a specifier with a query or hash is never tried as `.ts`.
- **TR-D2:** it lives in `tooling/pipelines` (the bins' package), not in core: a core change would go to the framework
  as a request, and the bins are Plus's.

## Execution log

- 2026-10-31: plan written; the failure above reproduced at `434f135` with Node 24.21.0.
- Step 1: `ts-resolve.test.ts` failed on the missing module, then passed (4).
- Step 2: the two bin tests failed with `ERR_MODULE_NOT_FOUND` as above; with the resolve hook, then on
  `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` (`sector-format`, TR-D3) and `ERR_UNKNOWN_FILE_EXTENSION` for a
  `?raw` TOML (TR-D4), each with its failing unit test first (loadTs 3, the `?raw` pass-through 1). Then both pass:
  `systems run` exits 0 with its three stages done, `puzzle run` exits 0 with every stage done.
- Step 3: `pnpm format`; `pnpm check` exit 0 (lint, typecheck, boundaries 0 findings, root 172 tests, every package's
  unit tests).
