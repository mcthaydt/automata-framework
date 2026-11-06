# Vendored Ruken packages

The `@ruken` npm organisation does not exist yet (Ruken master plan M0.3), so
AF takes Ruken's packages from tarballs packed out of the Ruken repository
(`mcthaydt/RukenApp`) and installs them with `file:` specifiers. This is
the vendoring pattern of decision D-6 (master spec §12).

| Tarball | Package | Used by |
|---|---|---|
| `ruken-sdk-0.0.0.tgz` | `@ruken/sdk` | `packages/host` (the game side of the host protocol) |
| `ruken-sdk-host-0.0.0.tgz` | `@ruken/sdk-host` | `packages/host` and `packages/testing` dev dependency: the fake host tests run against |
| `ruken-manifest-0.0.0.tgz` | `@ruken/manifest` | `packages/ship` (checks the generated `ruken.toml`, compiles CSP headers) |
| `ruken-cli-0.0.0.tgz` | `@ruken/cli` (the `ruken` bin) | `packages/ship` (`ship publish` spawns `ruken publish`). Built with Ruken's own `tsdown` config, which bundles `@ruken/validation`, `@ruken/api-contract` and `@ruken/manifest` into `dist/`; runtime dependencies are `smol-toml` 1.9.0, `yauzl` 3.4.0, `yazl` 3.3.1 and `zod` 4.6.6, pinned as in Ruken. Checked: with only those four installed, `node dist/cli.js` prints the usage (exit 2). |

**Source:** RukenApp `main` at `e376a2d` (`e376a2d7971b696f77f1d15f5174e80de70e65ef`, the merge of RukenApp PR #396,
2026-10-30), packed 2026-10-30 (PRODUCT.4r). Each package was built with its own `pnpm run build` (Ruken's
`turbo run build` stops on `@ruken/db#db:generate` without a database, and these packages do not need it).
`@ruken/sdk-host` and `@ruken/cli` declare `zod` 4.6.6 (the SDK only as a dev dependency; `@ruken/manifest` does not
use zod), so AF needs no override. The previous tarballs were packed from `d0fa2fe` on 2026-10-30 (QB.1f), and before
that from `b30d31b` on 2026-10-11. Between `d0fa2fe` and `e376a2d` only the licence changed: each tarball gains
`package/LICENSE` and `"license": "MIT"`, and every `dist/` is byte-identical
(`docs/archive/superpowers/plans/2026-10-30-product4r-ruken-mit-repack.md`; what changed from `b30d31b` to `d0fa2fe` is in
`docs/archive/superpowers/plans/2026-10-30-qb1f-repack-ruken.md`).

**Licence:** MIT, for all four (the Owner, 2026-10-30: "Yes, MIT it"; RukenApp PR #396). Each tarball holds the same
`package/LICENSE` ("Copyright (c) 2026 Dawson McThay") and its `package.json` declares `"license": "MIT"`. MIT asks
that its notice travel with every copy of the code. Content, host and ship, which bundle Ruken code into their
`dist/`, repeat the licence and its text in their published `VENDORED.md`, read from the installed tarball
(`tooling/release/src/write-vendored.ts`), and `docs/stack.md` shows it. Testing and ui inline Ruken type
declarations without a published notice (testing one region of `@ruken/sdk`'s `dist/index.d.ts`, ui
`dist/vendor/ruken-sdk.d.ts`): neither publishes a `VENDORED.md`, which is PRODUCT.4r's follow-up.

`pnpm pack` writes the `@ruken/*` dev dependencies of a packed `package.json` in no fixed order, so packing
the same commit twice can give a different SHA-256 for `ruken-sdk`, `ruken-sdk-host` and `ruken-cli`, with the
same `dist/`. The hashes below are of the files in this folder.

Owner: the integration thread (PR #4). Lanes consume these files and do not
repack them; a lane that needs a newer Ruken asks the integration owner.

Rebuild from a RukenApp checkout:

```sh
pnpm install
for p in packages/sdk packages/sdk-host packages/manifest tooling/ruken-cli; do (cd $p && pnpm run build && pnpm pack --pack-destination <automata-framework>/vendor/ruken); done
```

then `pnpm install` here, update the commit and the hashes below (`tooling/release/src/write-vendored.test.ts`
fails until they are the hashes of the tarballs in this folder), and re-run the host contract tests.

SHA-256 of the tarballs as packed:

```
a54837ad1c7a5a7d35d64a4afbce6753eb45ac67d6dee1dadc79993c50c25672  ruken-sdk-0.0.0.tgz
ee68ba187823979bc933d239f329fd7f068e63c935ef9afd68109438154c5f7c  ruken-sdk-host-0.0.0.tgz
7975fedbbd91613ddec7277d2e34d7642c238a7988f15eda5ca5223e4c0eab41  ruken-manifest-0.0.0.tgz
ce13f46536258f382e40702d45ecae2209b977742da7b9c38cb734122a6b7087  ruken-cli-0.0.0.tgz
```

Re-vendor after Ruken's F1 contract freeze (`contracts-f1`, planned
2026-10-16). When the packages are published to npm, switch the specifiers to
the published versions and delete this folder.
