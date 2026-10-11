# Changesets

A pull request that changes a published `@mcthaydt/automata-*` package adds a changeset (`pnpm changeset`),
and CI checks it (`changeset status`). Every published package shares one version (the `fixed` group), and
before 1.0 every changeset is a `patch` (`tooling/release/src/check-changesets.ts`). Merging to `main` opens or
updates the "Version packages" pull request; merging that one, on the Owner's word, publishes to GitHub
Packages (`.github/workflows/release-packages.yml`, M2.4 spec §3.5).
