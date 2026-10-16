# PRODUCT.3: cheatsheet TDD plan

- **Spec:** [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §7 ("The cheatsheet: one page grouped by module, generated from the API index (DX.4)"), §10 (PRODUCT.3). Consumes [DX.4](2026-10-16-dx4-api-index.md) ([DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.8).
- **Status:** drafted 2026-10-16; PRODUCT.0 Owner-approved 2026-10-16 with every recommended default. Stacks on DX.4 (PR #37), not yet merged.
- **Progress:** 3 of 3 steps.

## Decisions

- **One contract owner.** The cheatsheet is rendered from DX.4's `ApiExport[]` (the rows of `api.json`) by a new renderer in `tooling/api-index`. No second list of APIs exists: names, kinds, call forms and summaries all come from the index. PR #45's `tooling/api-report` is not used; PRODUCT.1b merges the two extractors.
- **Module = published package; one subsection per entry point**, in the index's order (package, entry point, name). The raylib module mapping in spec §7 is prose about where things live, not a list the page repeats.
- **One line per export, raylib style.** A function shows its call form, `name(a, b)`, parsed from the index's signature (overloads with the same parameters appear once); every other export shows `name` and its kind. Then the first sentence of its doc comment, and `(deprecated)` when it carries `@deprecated`. An undocumented export (DX.4's baseline) gets no summary. The full signatures stay in `api.md`.
- **Committed, not version-stamped.** The page lives at `docs/cheatsheet.md` so it is readable in the repo. It names no version, so a changesets version bump does not make it stale; only an API or doc-comment change does.
- **Stale check, the DX.4 way.** `pnpm api-index` (which already runs after `pnpm build` in `ci.yml`'s checks job and in `ci:local`) also renders the cheatsheet, writes it to `dist/cheatsheet.md`, and exits 1 when `docs/cheatsheet.md` differs or is missing, naming `pnpm cheatsheet` as the fix. `pnpm cheatsheet` (`cli.ts --write-cheatsheet`) rewrites the committed page.

## Files

- **Create:** `tooling/api-index/src/cheatsheet.ts`, `tooling/api-index/src/cheatsheet.test.ts`, `docs/cheatsheet.md` (generated).
- **Modify:** `tooling/api-index/src/run.ts`, `run.test.ts`, `cli.ts`, `ci.test.ts`; root `package.json` (`cheatsheet` script); 02, 03, this plan.

## Interfaces

- **Consumed:** `ApiExport` and `extractExports` (`tooling/api-index/src/extract.ts`), `entryPoints` (DX.4).
- **Produced:**
  - `cheatsheet(exports: readonly ApiExport[]): string` — the Markdown page.
  - `RunOptions.cheatsheet?: { file: string; write: boolean }` — the committed page and whether to rewrite it; `runApiIndex` reports a stale page as a finding (exit 1).
  - CLI: `node tooling/api-index/src/cli.ts [--write-cheatsheet]`; root scripts `api-index` (check) and `cheatsheet` (write).

## Steps

- [x] **1. Renderer.** `cheatsheet.test.ts` over `fixtures/repo`: the title names no version; one `##` per package and one subsection per entry point in index order; `add(a, b)` appears once for the two overloads; `area(size)` for the chunk-renamed export; `Named` (interface), `DEFAULT_SIZE` (const), `Counter` (class) with `(deprecated)`; the summary is the doc's first sentence; `undocumented` has no summary. Run `pnpm --filter @mcthaydt/api-index test`; it fails because `cheatsheet.ts` does not exist. Implement; pass.
- [x] **2. Stale check and CLI.** `run.test.ts`: with `cheatsheet: { file, write: false }` a missing or different committed page exits 1 naming the file and `pnpm cheatsheet`; with `write: true` it is written and the run exits 0; a matching page exits 0; `cheatsheet.md` is written to `out` either way. `ci.test.ts`: the root `cheatsheet` script runs the CLI with `--write-cheatsheet`. Fail (no stale finding; no script); add the option, the CLI flag and the script; pass.
- [x] **3. Real run.** `pnpm build && pnpm cheatsheet` writes `docs/cheatsheet.md`; read it; `pnpm api-index` exits 0; edit one line of the page and confirm `pnpm api-index` exits 1, then regenerate. Then `pnpm format`, `pnpm check`.

## Gates

- Selected: `pnpm --filter @mcthaydt/api-index test`; `pnpm build && pnpm api-index`; `pnpm format`; `pnpm check`.
- Omitted: `pnpm test:parity` and `pnpm test:e2e` (no runtime, rendering, UI, host or game change).
- No changeset: no published package changes.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-16 | Plan | `077375c` | |
| 2026-10-16 | 1 | `af8658a` | Red: missing `cheatsheet.ts`. Green: 8 tests. Call forms come from parsing the index's signature text with `ts.createSourceFile`; no extra extraction. |
| 2026-10-16 | 2 | `08200bc` | Red: 3 run tests (no stale finding, exit 0) and the missing `cheatsheet` script. `RunOptions.cheatsheet` is optional so DX.4's existing run tests stay unchanged; the CLI always passes it. |
| 2026-10-16 | 3 | `e8f39ce` | Real run: 359 exports, 8 packages, 18 entry points, 432 lines. Before writing, `pnpm api-index` exited 1 (page missing); after `pnpm cheatsheet`, 0 and `dist/cheatsheet.md` identical; one edited summary made it exit 1. `pnpm format` leaves the page unchanged (Biome does not format Markdown). `pnpm check` green (1,696 passed, 4 skipped). |
