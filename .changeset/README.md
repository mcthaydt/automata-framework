# Changesets

A pull request that changes a published `@mcthaydt/automata-*` package adds a changeset (`pnpm changeset`),
and CI checks it (`changeset status`). Every published package shares one version (the `fixed` group), and
before 1.0 every changeset is a `patch` (`tooling/release/src/check-changesets.ts`). Merging to `main` opens or
updates the "Version packages" pull request; merging that one, on the Owner's word, publishes to GitHub
Packages (`.github/workflows/release-packages.yml`, M2.4 spec §3.5).

Before a release: the release job (`release-packages.yml`) runs on `ubuntu-latest`, so it needs hosted Actions
minutes. While the account has none it fails on every push to `main` without publishing anything; it first runs
`pnpm check` on the commit it would release, then `pnpm release` builds and publishes. Merge the "Version packages"
pull request only once the Owner has said to publish and hosted minutes (an Actions spending limit) are available.
