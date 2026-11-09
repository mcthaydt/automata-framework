# Changesets

A pull request that changes a published `@automata/*` package adds a changeset (`pnpm changeset`),
and CI checks it (`changeset status`). Every published package shares one version (the `fixed` group), and
before 1.0 every changeset is a `patch` (`tooling/release/src/check-changesets.ts`), except `first-public-release.md`,
a `minor` that takes the shared version from 0.0.x to 0.1.0 once and is deleted when it is versioned. Merging to `main` opens or
updates the "Version packages" pull request; merging that one, on the Owner's word, publishes to npmjs.org
(`.github/workflows/release-packages.yml`). The version step, `pnpm release:version`, bumps
the versions and changelogs, syncs the sim's `SIM_VERSION`, builds, and regenerates the API index, the cheatsheet and
the `automata-api` skill's `reference/api.md` and plugin version (DX.7a), so the Version packages pull request needs no
edits by hand.

Before a release: the release workflow (`release-packages.yml`) runs on `ubuntu-latest`, so it needs hosted Actions
minutes. While the account has none it fails on every push to `main` without publishing anything. A push that carries
changesets runs the `version` job (the Version packages pull request, no approval); a push that carries none runs the
`publish` job, the only one that waits for the Owner's approval in the `release` environment. Each runs `pnpm check`
on the commit first, and `pnpm release` then builds and publishes. Merge the "Version packages"
pull request only once the Owner has said to publish and hosted minutes (an Actions spending limit) are available.
