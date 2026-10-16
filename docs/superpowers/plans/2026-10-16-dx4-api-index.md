# DX.4: generated API index and `llms-full.txt` TDD plan

- **Spec:** [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §2.3 ("Complete plain-text documentation", "Exhaustive API reference"), §3.7 (`automata-api` reads `reference/api.md`), §3.8, §8 (unit: API index extraction), §10 (DX.4).
- **Status:** drafted 2026-10-16; DX.0 Owner-approved 2026-10-16 with every recommended default.
- **Progress:** 2 of 6 steps.

## Decisions

- **Compiler API: TypeScript 6.0.3's JS API, not TypeScript 7.** AF's `typescript@7.0.2` (the native compiler) exports only `typescript/unstable/*`, an IPC client for the native binary that is explicitly unstable. The index needs the type checker: rolldown-plugin-dts emits chunks whose exports are renamed (`export { n as ColliderOptions }`), so names, docs and declarations must come from alias resolution (`getExportsOfModule`, `getAliasedSymbol`, `getDocumentationComment`), not from text matching. TypeScript 6.0.3 is already pinned in AF (`docs/versions.md`; render-pixi typechecks with it), so this adds no new version. When TypeScript 7 publishes a stable API, this package moves to it.
- **Published list:** `publishablePackages(root)` from `tooling/release/src/publishable-packages.ts`, imported (as consumer-smoke does), never copied. Entry points are the `exports` keys (`publishConfig.exports` first) that have a `types` target. A key with no `types` (`./theme.css`) and a package with no `exports` (`check-boundaries`, a bin) have no API to index.
- **Undocumented exports: a baseline that can only shrink.** `tooling/api-index/undocumented-baseline.json` lists every export id (`<package>[/<subpath>]#<name>`) that has no doc comment today. The run fails when an export is undocumented and not on the list (new exports arrive documented), and when a listed id is now documented or gone (the entry must be deleted, so the list only shrinks). Documenting every export now would touch every package; a follow-up row in 02 burns the list down.
- **Outputs are generated, not committed.** `pnpm api-index` writes `tooling/api-index/dist/{api.json,api.md,llms-api.txt,llms-full.txt}` (already git-ignored as `dist/`). They are reproducible from `pnpm build` at one version; DX.7 copies `api.md` into the skill and DX.12 serves the `llms*` files. Only the baseline is committed.
- **`llms-full.txt` corpus** is the one list `CORPUS` in `src/corpus.ts` (overview, ADRs 0001–0005, the M1 shared contracts spec, `docs/versions.md`), followed by the API index. A missing corpus file fails the run.

## Files

- **Create** `tooling/api-index/`: `package.json` (`@mcthaydt/api-index`, private), `tsconfig.json`, `src/entry-points.ts`, `src/extract.ts`, `src/render.ts`, `src/corpus.ts`, `src/baseline.ts`, `src/cli.ts`, `src/*.test.ts`, `fixtures/repo/` (a tiny workspace with built `.d.ts`), `undocumented-baseline.json`.
- **Modify:** root `package.json` (`api-index` script; `ci:local` after `pnpm build`), `.github/workflows/ci.yml` (checks job, after `pnpm build`), `docs/versions.md` (the 6.0.3 row names api-index), 02, 03.

## Interfaces

- **Consumed:** `publishablePackages(root)` (`tooling/release`); the emitted `dist/**/*.d.ts` of each published package.
- **Produced:**
  - `entryPoints(root): EntryPoint[]` — `{ package, entryPoint, typesFile, version }`.
  - `extractExports(entries): ApiExport[]` — `{ package, entryPoint, name, kind, signature, doc, version }`, sorted.
  - `apiJson`, `apiMarkdown`, `llmsApiText`, `llmsFullText(root, corpus, index)`.
  - `checkDocs(exports, baseline): { undocumented: string[]; stale: string[] }`.
  - CLI `node tooling/api-index/src/cli.ts [--root <dir>] [--out <dir>]`: exit 0 written, 1 doc findings, 2 tool error (a `types` file missing: run `pnpm build`).

## Steps

- [x] **1. Entry points.** `entry-points.test.ts` over `fixtures/repo`: a package with `.` and `./sub`, a `./theme.css` key, a private package and a bin-only package give exactly the two typed entry points with their versions; a missing `types` file is reported. Run `pnpm --filter @mcthaydt/api-index test`; it fails because `entry-points.ts` does not exist. Implement; pass.
- [x] **2. Extraction.** `extract.test.ts` over the fixture `.d.ts`: a documented function (overloads joined), interface, type alias, const, class and enum get the right kind, signature (no `export`/`declare`) and doc (with `@tags`); an export renamed through a chunk (`export { n as Renamed }`) is named `Renamed` in its signature; an undocumented export has `doc: ''`. Fails on the missing module; implement with the TypeScript 6 checker; pass.
- [ ] **3. Doc check and baseline.** `baseline.test.ts`: an undocumented export not in the baseline is reported; a baseline id that is documented or missing is reported as stale; a clean set reports nothing. Fails; implement; pass.
- [ ] **4. Renderers and corpus.** `render.test.ts`: `api.json` carries the version and every field; `api.md` states the version and has one section per entry point with each signature in a `ts` block; `llms-full.txt` holds every `CORPUS` file in order, then the API index; a missing corpus file throws. Fails; implement; pass.
- [ ] **5. CLI and CI hook.** `cli.test.ts`: on the fixture repo the CLI writes the four files and exits 1 naming the undocumented export; with a matching baseline it exits 0; with no build it exits 2. `ci.test.ts`: `ci.yml`'s checks job and `ci:local` run `pnpm api-index` after `pnpm build`. Fail; add the root script, `ci:local` step and `ci.yml` step; pass.
- [ ] **6. Real run.** `pnpm build && pnpm api-index`: write `undocumented-baseline.json` from the first run's findings, record the export and undocumented counts, rerun to exit 0, and read `api.md` and `llms-full.txt`. Then `pnpm format`, `pnpm check`.

## Gates

- Selected: `pnpm check`; `pnpm --filter @mcthaydt/api-index test`; `pnpm build && pnpm api-index`.
- Omitted: `pnpm test:parity` and `pnpm test:e2e` (no runtime, rendering, UI, host or game change); `pnpm lint:actions` if docker is missing.
- No changeset: no published package changes.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| — | — | — | — |
