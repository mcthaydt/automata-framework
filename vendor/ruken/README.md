# Vendored Ruken packages

The `@ruken` npm organisation does not exist yet (Ruken master plan M0.3), so
AF takes Ruken's packages from tarballs packed out of the Ruken repository
(`mcthaydt/RukenApp`) and installs them with `file:` specifiers. This is
FloorFifty's `vendor/ruken/` pattern (decision D-6, master spec §12).

| Tarball | Package | Used by |
|---|---|---|
| `ruken-sdk-0.0.0.tgz` | `@ruken/sdk` | `packages/host` (the game side of the host protocol) |
| `ruken-sdk-host-0.0.0.tgz` | `@ruken/sdk-host` | `packages/host` and `packages/testing` dev dependency: the fake host tests run against |
| `ruken-manifest-0.0.0.tgz` | `@ruken/manifest` | `packages/ship` (checks the generated `ruken.toml`) |

**Source:** RukenApp `main` at `b30d31b`, packed 2026-10-11. Each package was
built with its own `pnpm run build` (Ruken's `turbo run build` stops on
`@ruken/db#db:generate` without a database, and these packages do not need it).
`ruken-sdk-0.0.0.tgz` is byte-identical to FloorFifty's (same SHA-256).

Owner: the integration thread (PR #4). Lanes consume these files and do not
repack them; a lane that needs a newer Ruken asks the integration owner.

Rebuild from a RukenApp checkout:

```sh
pnpm install
for p in sdk sdk-host manifest; do (cd packages/$p && pnpm run build && pnpm pack --pack-destination <automata-framework>/vendor/ruken); done
```

then `pnpm install` here, update the commit and the hashes below, and re-run
the host contract tests.

SHA-256 of the tarballs as packed:

```
8fb6f3b45972fe8e50be8e2501b5279d0ce27708b15af55c876fd1152be69474  ruken-sdk-0.0.0.tgz
2292bc434d4afa6f5af709ed80dd864993be1b32f1542f177d7218d0eb423f3e  ruken-sdk-host-0.0.0.tgz
4c47f29d73bfedcc220b6081e410c0acc37d7591323b9bbf8b6cd5eb9e9c369a  ruken-manifest-0.0.0.tgz
```

Re-vendor after Ruken's F1 contract freeze (`contracts-f1`, planned
2026-10-16). When the packages are published to npm, switch the specifiers to
the published versions and delete this folder.
