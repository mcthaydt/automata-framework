---
'@automata/tools': patch
---
`automata editor` now tells it is running from a game you installed, not from the AutomataFramework repository, even when your game sits in a `pnpm-workspace.yaml` of its own, so a missing editor build says to reinstall the tools instead of asking you to build the repository.
