# PRODUCT.1b3: one extractor shared by api-report and api-index TDD plan

- **Spec:** [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §2 F6 (the API reports, `pnpm api-report`); [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.8 (the API index, `pnpm api-index`); the [PRODUCT.1 plan](2026-10-16-product1-core-seams-and-api-reports.md)'s follow-up "one extractor for both once both land".
- **Task:** PRODUCT.1b3, the "one extractor shared by `tooling/api-report` and DX.4's API index" part of 02's PRODUCT.1b row.
- **Status:** drafted 2026-10-30 from `main` `b7ef19d9`.
- **Progress:** 5 of 6 steps.

## What exists

Two modules read a module's exports with the TypeScript 6 checker and turn each into a declaration text:

| | `tooling/api-report/src/extract.ts` | `tooling/api-index/src/extract.ts` |
|---|---|---|
| Input | every core package's source, through `transpileDeclaration` (`isolatedDeclarations`), files outside the core `src` folders as empty modules, workspace imports through `paths` | the emitted `.d.ts` of each published entry point, read as written (`skipLibCheck`) |
| Per export | `kindOf`, `declarationText` (named as exported, `export`/`declare` dropped), Svelte and unresolved re-exports named by their module | the same `kindOf` and `declarationText`, word for word; the doc comment and its tags (`docOf`); an export with no declaration gets kind `other` and an empty signature |
| Shape and order | `PackageApi` / `ApiEntry` / `ApiExport {name, kind, declaration}`, per entry, case-insensitive then code unit (`byName`) | one flat list of `api.json` rows `{package, entryPoint, name, kind, signature, doc, version}`, by package, entry point, then the `en` collator |
| Not a module | the entry has no exports | throws `<file> is not a module` |

## Decisions

- **The owner is `tooling/api-report/src/extract.ts`.** It is the superset (it already handles Svelte and unresolved re-exports) and has no tooling dependency; `tooling/api-index` already imports `tooling/release/src/publishable-packages.ts` by relative path, so importing `../../api-report/src/extract.ts` the same way adds no new pattern. No new package.
- **Two inputs, one reader.** The module builds the program for each input (`sourceExports(packages)`, `declarationExports(files)`: what is read differs, so how the program is built differs) and one private `readExports` turns a module's exports into `ExtractedExport {name, kind, declaration, doc}`: alias resolution, kind, declaration text, doc comment. `kindOf`, `declarationText` and `docOf` exist once.
- **Each tool keeps its own row shape and order.** The orders differ (`byName` vs the `en` collator) and both are pinned by committed outputs, so sorting stays with each tool. The report drops `doc` (from source it is always empty: `transpileDeclaration` runs with `removeComments`). The index keeps its row field order, which is `api.json`'s key order.
- **"Not a module" stays each tool's policy.** The reader returns `undefined` for a file that is not a module; the report lists the entry with no exports, the index still throws.
- **The index names an unresolved re-export as the report does (decision for the Owner's veto).** An export whose alias resolves to nothing was kind `other` with an empty signature in the index; through the one reader it is `svelte` (`component from '<file>'`) or `unresolved` (`from '<module>'`), as in the report. No published export resolves to nothing today (`api.json` has none; step 5 proves the files byte-identical), and such an export has no doc comment, so the index's doc check fails on it either way. Keeping the old text would need a branch that maps a described export back to an empty one. Default taken: one behaviour.
- **`tooling/api-index/src/extract.ts` becomes `rows.ts`** (`indexRows`, the `ApiExport` row type), so `extract.ts` names the one extractor and `rg getExportsOfModule tooling` finds one file.
- **Turbo inputs.** `tooling/api-index`'s `test` and `test:unit` inputs gain `$TURBO_ROOT$/tooling/api-report/src/**`, so a change to the extractor reruns the index's tests rather than reusing a cached pass.
- **No changeset:** both tooling packages are private.

## Files

- **Create:** `tooling/api-report/fixtures/kinds/packages/kinds/` (`package.json`; `src/index.ts`, `src/extra.ts`, `src/shared.ts`, `src/star.ts`, `src/helpers.ts`, `src/unbuildable.ts`) and its pinned report `tooling/api-report/fixtures/kinds/reports/kinds.api.md`; `tooling/api-report/src/kinds-golden.test.ts`. `tooling/api-index/fixtures/kinds/packages/kinds/` (`package.json`; `types/*.d.ts`, what tsdown emits for the same source's `.` and `./extra`) and its pinned `tooling/api-index/fixtures/kinds/api.json`; `tooling/api-index/src/kinds-golden.test.ts`; `tooling/api-index/src/one-extractor.test.ts`.
- **Modify:** `tooling/api-report/src/extract.ts` (the shared reader), `tooling/api-report/src/extract.test.ts`; `tooling/api-index/src/extract.ts` → `tooling/api-index/src/rows.ts`, `extract.test.ts` → `rows.test.ts`; the imports in `tooling/api-index/src/{run,render,cheatsheet,baseline}.ts` and `{render,cheatsheet,baseline}.test.ts`; `tooling/api-index/turbo.json`; this plan.
- **Not touched:** every committed report, `docs/cheatsheet.md`, `agents/automata/skills/automata-api/reference/api.md`; 02, 03 (the integration owner's).

## Interfaces

- **Consumed:** `CorePackage` (`tooling/api-report/src/core-packages.ts`), `EntryPoint` (`tooling/api-index/src/entry-points.ts`), TypeScript 6.0.3's checker (both packages' dev dependency).
- **Produced** (`tooling/api-report/src/extract.ts`): `ApiKind`; `ExtractedExport`; `ExportsOf = (file: string) => readonly ExtractedExport[] | undefined`; `sourceExports(packages: readonly CorePackage[]): ExportsOf`; `declarationExports(files: readonly string[]): ExportsOf`. Unchanged for their callers: `extractApi`, `PackageApi`, `ApiEntry`, `ApiExport`, `byName` (report); the index's `ApiExport` row, now from `rows.ts` with `indexRows(entries)` in place of `extractExports(entries)`.

## Steps

- [x] **1. Plan.** This file, committed first.
- [x] **2. Pin today's outputs, green on `main`.** A `kinds` fixture for each tool covering every declaration kind both handle: function (overloads with a doc comment each), class (`@deprecated`), interface, type, enum, `const`, `let`, `var`, namespace (a `namespace` block and `export * as`), an interface and a `const` merged under one name, a local exported under another name, a re-export, an `export *`, and a module shared by two entry points (a tsdown chunk with renamed exports). The report's fixture adds a Svelte and an unresolved re-export in a third entry, `./unbuildable`, which tsdown cannot build. Write each golden with today's code (`runApiReport --update` for the report; `apiJson(extractExports(entryPoints(root)))` for the index), read it through, and commit it with a test that fails when the output differs: `runApiReport` in check mode exits 0 over the fixture; the index's `api.json` equals the committed file byte for byte. Record the real workspace's outputs on `main` (the 14 reports; `dist/api.json`, `api.md`, `llms-api.txt`, `llms-full.txt`, `cheatsheet.md`; `docs/cheatsheet.md`; the skill's `api.md`) with their sha256 in the log.
- [x] **3. Red.** `extract.test.ts`: `declarationExports` reads an emitted `.d.ts` with its doc comments and a chunk-renamed alias, and returns `undefined` for a file that is not a module; `sourceExports` gives every export an empty doc. `one-extractor.test.ts`: no `tooling/api-index` source creates a TypeScript program. Run both packages' unit tests; expect exactly these to fail: the first because `declarationExports` and `sourceExports` are not exported, the second naming `src/extract.ts`.
- [x] **4. Green.** The shared reader in `tooling/api-report/src/extract.ts` with `extractApi` on it; `tooling/api-index/src/rows.ts` on `declarationExports`; delete `tooling/api-index/src/extract.ts`; the turbo inputs. Both packages' unit tests pass, the two pins of step 2 among them, with no golden rewritten; both typecheck.
- [x] **5. The real workspace, byte for byte.** `pnpm api-report --update` (`git status` clean), `pnpm api-report`, `pnpm build`, `pnpm api-index`, `pnpm agent-skills`; `diff -r` of every file recorded in step 2 against the new outputs is empty and the sha256 list matches.
- [ ] **6. Gates.** `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm changeset status --since=origin/main`; `node tooling/release/src/check-changesets.ts`.

## Gates

- Selected: both packages' unit tests and typecheck while iterating; `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`, `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills`; `changeset status`, `check-changesets`.
- Omitted: parity, e2e, examples and demo builds, consumer smoke: no sim, renderer, ui, golden hash, build config or example changes.
- No changeset: both packages are private.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | 1 | `9bedb647` | Plan, from `main` `b7ef19d9`. |
| 2026-10-30 | 2 | `c55fdfb2` | Pins written with `main`'s code and read through. Report: `runApiReport --update` over `fixtures/kinds` wrote `kinds.api.md` (19 exports in `.`, `./extra`, `./unbuildable`, kinds function, class, interface, type, enum, const, let, var, namespace, svelte, unresolved). Index: `fixtures/kinds/packages/kinds/types` is tsdown 0.23.0's output (`dts: { eager: true }`, ESM, es2022, the published build's options) for the report fixture's `src` without `unbuildable.ts`: a `shared-DFI0g3v5.d.ts` chunk exporting `n`/`t`, and `export * as helpers` emitted as `declare namespace helpers_d_exports`; `apiJson(extractExports(entryPoints(root)))` wrote `api.json` (17 rows, the same kinds but svelte and unresolved, every doc). Biome's safe fix had turned the fixture's `export let` into `const`; restored with a `useConst` suppression. Both pin tests pass on `main`'s code; a planted `let` to `var` in each golden made each fail with that line as the diff, then the goldens were restored (`cmp` equal). The real workspace on `main` `b7ef19d9` (`pnpm api-report --update` left `git status` clean; `pnpm build`, `pnpm api-index`): sha256 `api.json` `1cfdcaf8…d859c`, `api.md` = `llms-api.txt` = the skill's `api.md` `a9eb787a…5b690`, `llms-full.txt` `f1fe5fdd…a6805`, `cheatsheet.md` = `docs/cheatsheet.md` `be3f2ad5…9db`, and the 14 reports (full list in step 5). |
| 2026-10-30 | 3 | | Red, as expected: `tooling/api-report` `vitest run src/extract.test.ts` failed at import with `TypeError: sourceExports is not a function` (so the file's six existing tests did not run either); `tooling/api-index` `vitest run src/one-extractor.test.ts` failed with `Received: ["extract.ts"]`. The `declarationExports` cases write their `.d.ts` to a temp folder (an entry, a chunk renaming `ShapeKind$1` to `t`, a `.svelte` re-export, a script with no export), so no fixture is needed for them. The red and green commits are one: the pre-commit hook runs the affected unit tests. |
| 2026-10-30 | 4 | | Green. `extract.ts`: `readExports(program)` holds `describeExport` with `docOf` (moved from the index); `sourceExports` is the old program setup; `declarationExports` is the index's old program setup (`skipLibCheck`, default host); `extractApi` drops `doc` and sorts as before. `rows.ts` (`git mv` of `extract.ts`): `indexRows` maps each `ExtractedExport` to a row in `api.json`'s key order, throws `<file> is not a module` as before, sorts as before. `rg -l 'getExportsOfModule\|createProgram\(' tooling/*/src` lists only `tooling/api-report/src/extract.ts`. `tooling/api-report` 69 of 69 tests in 7 files, `tooling/api-index` 40 of 40 in 9 files, both pins among them with neither golden touched; `tsc -p .` clean in both. |
| 2026-10-30 | 5 | | On the branch: `pnpm api-report --update` (`git status` shows no report changed), `pnpm api-report` (14 core packages, 0 breaks, 0 undeclared), `pnpm build` (12 of 12, cache hits on unchanged inputs), `pnpm api-index` (570 exports from 22 entry points at 0.0.3, 0 undocumented, cheatsheet current, exit 0), `pnpm agent-skills` (skill `api.md` current). `diff -r` of the 21 files recorded on `main` against the branch's: no differences. sha256 on both sides: `automata` `7c8f525f`, `cli` `ff2c6cae`, `content` `fa022f7e`, `editor-2d` `7e50a874`, `editor-kit` `cd383c81`, `game` `f09058aa`, `host` `1411bb61`, `node` `314f6a41`, `render-pixi` `8f92ec30`, `runtime` `85f2a95c`, `ship` `3bf058eb`, `sim` `98268319`, `testing` `59cfa11f`, `ui` `6903c3f8` (`.api.md`); `api.json` `1cfdcaf8`; `api.md` = `llms-api.txt` = skill `api.md` `a9eb787a`; `llms-full.txt` `f1fe5fdd`; `cheatsheet.md` = `docs/cheatsheet.md` `be3f2ad5`. |
