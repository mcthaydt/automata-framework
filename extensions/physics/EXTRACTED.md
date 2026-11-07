# Extracted: `@automata/physics`

- **Source:** `mcthaydt/automata-framework` at `6aee63bedce8785aaf725571100e5fcdccd714ef` (`main`, 2026-10-30),
  `packages/physics`. Its files are byte-identical at `b7ef19d978d4751eaf08d1374dcfbcf2459d8c2b`, the commit in
  `core.ref` that the core packs this package is tested against come from.
- **Task:** PRODUCT.5f (the framework's plan `docs/superpowers/plans/2026-10-23-product5-plus-repo-and-physics-move.md`,
  section 5f). The framework deletes its copy in PRODUCT.5g.
- **Copied unchanged:** every file under `src/` (the 14 test files and the `testing/` scene helpers included) and
  `tsconfig.json` (it extends `../../tsconfig.base.json`, which Plus copies from the framework).
- **Not copied:** `CHANGELOG.md` (the framework's release history), `dist/`, `.turbo/`, `node_modules/`.

## Changed, and only this

| File | Change |
|---|---|
| `package.json` | `@automata/sim` moves from `dependencies` to `peerDependencies` at the exact version (0.0.3); `devDependencies` list `@automata/sim`, `@automata/framework/testing` and `@automata/evidence` at their pack versions, resolved through the core overrides (P5-D1); `license` is `SEE LICENSE IN LICENSE` (P5-D5); `repository` points at `automata-plus`. The `automata.simEntries` declaration (P5-D2, PRODUCT.5c) is unchanged. |
| `vitest.config.ts` | `koota` leaves `optimizeDeps.include` for `@automata/sim`: Koota is the sim's dependency, which resolved here in the framework only through the workspace link. |
| `tsdown.config.ts` | A comment: the file is copied and not run, because `publishedBuild` is the framework's and the Plus build is PRODUCT.5h's. |

## Golden hashes (unchanged from the source commit)

| Test | Hash | Events |
|---|---|---|
| `src/physics-2d.parity.test.ts` | `46042079c99bfdf1` | `4fc381ee4c45b8dd` |
| `src/physics-3d.parity.test.ts` | `5ab771a640ac4b78` | `770efcd4f89ac854` |

The framework's physics demo (`examples/physics/bodies-2d`, golden `ad621eea6325a8db`, a hash of Emberwick's sim) does
not move: P5-D3 retires that hash, and EX.4p ports the demo here as a one-file example on its own room.
