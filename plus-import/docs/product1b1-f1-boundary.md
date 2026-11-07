# PRODUCT.1b1: the F1 boundary test

- **Task:** PRODUCT.1b1 in the framework's `docs/02-master-delivery-plan.md`; PRODUCT spec §2 F1 and §10 (P-c, P-d).
  Small enough that this file is its plan and its log.
- **Branch:** `claude/plus-PRODUCT.1b1-f1-boundary`, stacked on PRODUCT.5f (PR #2) so the test has a package to cover.
- **Status:** implemented and checked locally. The Plus CI run on the Mac is pending.

## The rule

A Plus package imports core only through a public `exports` entry of a core package. The public entries are read
from the packed manifests in `.core/packs` (what Plus installs; a pack's `exports` is the published map), so:

- `@mcthaydt/automata-sim/hash` passes; `@mcthaydt/automata-sim/src/world/sim` fails (P-d).
- A core package with no pack fails: `runtime` and `render-pixi` are private until DX.2a publishes them, so their
  seams (`tooling/api-report/src/seams.ts` in the framework) reach Plus only once they are packed. The test then
  accepts their public entries with no change here.
- A private pack (`@mcthaydt/evidence`, packed as an extra and never published) is allowed in test files
  (`*.test.*`) only.
- A sibling Plus package, a relative path and a non-core package are not core imports.

Files: `tooling/boundary/core-imports.ts` and its test. The scan covers every `.ts`, `.mts`, `.cts`, `.tsx`, `.js`,
`.mjs`, `.cjs`, `.jsx` and `.svelte` file under `packages/`, skipping `node_modules`, `dist` and `.turbo`; it reads
`from`, `import`, `import()` and `require()` across line breaks.

## Interface

- `importSpecifiers(source)`: the specifiers of `from '…'`, `import '…'` and `import('…')`.
- `publicCoreEntries(root)`: the public entries from `.core/packs/packs.json` and each pack's `package.json`. It
  throws "run pnpm core:sync" when there are no packs.
- `coreImportFindings(root)`: `file:line: "<specifier>" is not a public exports entry of a core package`, one per
  import.

## Tests (red first: every case failed against an empty module)

1. Specifiers from static, type, side-effect, re-export, `export *`, dynamic and multi-line imports.
2. Public entries come from the packed manifests.
3. Public entries, non-core, relative and sibling Plus imports pass.
4. P-d: a deep core import fails with its file, line and specifier.
5. A core package with no pack fails.
6. Svelte files are checked; `node_modules` and `dist` are skipped.
7. No packs: the error says to run the sync.
8. P-c: the real workspace has no finding.

## Evidence (2026-10-30, this container, Node 24.21.0)

| Gate | Result |
|---|---|
| `tooling/boundary` | 8 tests passed |
| Planted `import '@mcthaydt/automata-sim/src/world/sim'` in `packages/physics/src/kinds.ts` | P-c failed naming `packages/physics/src/kinds.ts:49`; reverted |
| Independent review | 4 findings (imports split across lines, a private pack counted public, other file extensions, `require`), each fixed test-first: 10 new cases red, then 18 of 18 |
| `pnpm check` | lint, typecheck, boundaries (0 findings), root 147 tests, physics 71 tests |
