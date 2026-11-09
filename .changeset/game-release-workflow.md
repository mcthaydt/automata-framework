---
'@automataframework/automata-tools': patch
---
`create-game` writes the new game's own release workflow, `.github/workflows/release.yml`: on a version tag it runs `pnpm check`, builds for the web and, for a game that builds for itch.io, pushes it there once the repository has a `BUTLER_API_KEY` secret.
