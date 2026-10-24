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
| `ruken-cli-0.0.0.tgz` | `@ruken/cli` (the `ruken` bin) | `packages/ship` (`ship publish` spawns `ruken publish`). Built with Ruken's own `tsdown` config, which bundles `@ruken/validation`, `@ruken/api-contract` and `@ruken/manifest` into `dist/`; runtime dependencies are `smol-toml` 1.9.0, `yauzl` 3.4.0, `yazl` 3.3.1 and `zod` 4.6.5, pinned as in Ruken. Checked: with only those four installed, `node dist/cli.js` prints the usage. |

AF installs `zod` 4.6.6 for these tarballs too: `pnpm-workspace.yaml`'s `overrides` replaces the exact 4.6.5 the `@ruken/cli` and `@ruken/sdk-host` tarballs declare (GHSA-mrhx-c7xc-m3w5). Repack from a Ruken that pins 4.6.6, then drop the override.

**Source:** RukenApp `main` at `b30d31b`, packed 2026-10-11. Each package was
built with its own `pnpm run build` (Ruken's `turbo run build` stops on
`@ruken/db#db:generate` without a database, and these packages do not need it).
`ruken-sdk-0.0.0.tgz` is byte-identical to FloorFifty's (same SHA-256).

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
8fb6f3b45972fe8e50be8e2501b5279d0ce27708b15af55c876fd1152be69474  ruken-sdk-0.0.0.tgz
2292bc434d4afa6f5af709ed80dd864993be1b32f1542f177d7218d0eb423f3e  ruken-sdk-host-0.0.0.tgz
4c47f29d73bfedcc220b6081e410c0acc37d7591323b9bbf8b6cd5eb9e9c369a  ruken-manifest-0.0.0.tgz
583225ed6ed88f4828da3fcfccaec8cea451ec8e8e5956ef98c32ec470938522  ruken-cli-0.0.0.tgz
```

Re-vendor after Ruken's F1 contract freeze (`contracts-f1`, planned
2026-10-16). When the packages are published to npm, switch the specifiers to
the published versions and delete this folder.
