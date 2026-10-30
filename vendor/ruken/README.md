# Vendored Ruken packages

The `@ruken` npm organisation does not exist yet (Ruken master plan M0.3), so
AF takes Ruken's packages from tarballs packed out of the Ruken repository
(`mcthaydt/RukenApp`) and installs them with `file:` specifiers. This is
FloorFifty's `vendor/ruken/` pattern (decision D-6, master spec §12).

| Tarball | Package | Used by |
|---|---|---|
| `ruken-sdk-0.0.0.tgz` | `@ruken/sdk` | `packages/host` (the game side of the host protocol) |
| `ruken-sdk-host-0.0.0.tgz` | `@ruken/sdk-host` | `packages/host` and `packages/testing` dev dependency: the fake host tests run against |
| `ruken-manifest-0.0.0.tgz` | `@ruken/manifest` | `packages/ship` (checks the generated `ruken.toml`, compiles CSP headers) |
| `ruken-cli-0.0.0.tgz` | `@ruken/cli` (the `ruken` bin) | `packages/ship` (`ship publish` spawns `ruken publish`). Built with Ruken's own `tsdown` config, which bundles `@ruken/validation`, `@ruken/api-contract` and `@ruken/manifest` into `dist/`; runtime dependencies are `smol-toml` 1.9.0, `yauzl` 3.4.0, `yazl` 3.3.1 and `zod` 4.6.6, pinned as in Ruken. Checked: with only those four installed, `node dist/cli.js` prints the usage (exit 2). |

**Source:** RukenApp `main` at `d0fa2fe` (`d0fa2fe766d532a293c3723d5ba3102d1e602d63`, 2026-10-28), packed
2026-10-30 (QB.1f). Each package was built with its own `pnpm run build` (Ruken's `turbo run build` stops on
`@ruken/db#db:generate` without a database, and these packages do not need it). `@ruken/sdk-host` and
`@ruken/cli` declare `zod` 4.6.6 (the SDK only as a dev dependency; `@ruken/manifest` does not use zod), so AF
needs no override. The previous tarballs were packed from `b30d31b` on 2026-10-11; what
changed between the two for AF is listed in `docs/superpowers/plans/2026-10-30-qb1f-repack-ruken.md`.

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

then `pnpm install` here, update the commit and the hashes below, and re-run
the host contract tests.

SHA-256 of the tarballs as packed:

```
501baf6177630583363d97fec285372315782087dbbfdcd7c1c3c6e0f1c49883  ruken-sdk-0.0.0.tgz
4d4b1d7c1e3c8084e00231b801e74f53a50541b39505d8961a044cc39315ff9f  ruken-sdk-host-0.0.0.tgz
7dd9e8bc541aa61899502c89a7fd9e4d7ce7778c26337077185b014a5dcfbfc6  ruken-manifest-0.0.0.tgz
ad7e2a67fd11f52a5bebf8a2de8ef7847448aead935befa1b6a482e9869e08e9  ruken-cli-0.0.0.tgz
```

Re-vendor after Ruken's F1 contract freeze (`contracts-f1`, planned
2026-10-16). When the packages are published to npm, switch the specifiers to
the published versions and delete this folder.
