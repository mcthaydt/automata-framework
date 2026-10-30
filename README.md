# automata-plus

AutomataFramework Plus paid extensions.

Private and commercial: see `LICENSE`. Agents start at `AGENTS.md`.

## Setup

Node 24.21.0 (`.nvmrc`) and pnpm 10.34.6 (`packageManager`). Git must be able to read
`mcthaydt/automata-framework` with your own credentials.

```sh
pnpm core:sync              # core from the framework at core.ref, into .core/
pnpm install --frozen-lockfile
pnpm check                  # lint, typecheck, boundaries, unit tests
pnpm test:parity            # the packages' browser projects (Chromium, WebKit, Firefox)
```

## How core gets here

Core is not on a registry yet, so Plus builds it from the framework at the commit in `core.ref` (PRODUCT.5, P5-D1):

1. `pnpm core:sync` reads `core.ref` (one full commit, nothing else).
2. It fetches that commit into `.core/af` with plain git, then runs `pnpm install --frozen-lockfile --ignore-scripts`,
   `pnpm build` and `pnpm packs --out .core/packs --unpack --extra @mcthaydt/evidence --source-commit <commit>` there.
   When `.core/packs/packs.json` already records the commit, it skips this step.
3. It writes the block between `# core-overrides:begin` and `# core-overrides:end` in `pnpm-workspace.yaml`: one
   `file:.core/packs/<folder>` override per core package. A package that Plus has itself in `packages/` is never
   overridden.

Folders rather than tarballs are installed because `pnpm pack` does not write the same bytes twice, so a tarball's
lockfile hash would differ from machine to machine; a directory dependency has no hash. `--repository <url or path>`
fetches from another clone of the framework, such as a local one.

When core is on GitHub Packages (PRODUCT.5h), the block is deleted and the ranges resolve from the registry.

## CI

`.github/workflows/ci.yml` runs on the Owner's Mac (label `af-mac`) for pushes to `main`, pull requests from this
repository and manual runs: `pnpm core:sync`, `pnpm install --frozen-lockfile`, `pnpm check`.

## Execution logs

- [PRODUCT.5e, the workspace skeleton](docs/product5e-workspace.md)
- [PRODUCT.5f, physics arrives](docs/product5f-physics.md)
- [PRODUCT.1b1, the F1 boundary test](docs/product1b1-f1-boundary.md)
