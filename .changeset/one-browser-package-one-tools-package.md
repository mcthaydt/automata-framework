---
'@mcthaydt/automata': patch
'@mcthaydt/automata-tools': patch
'@mcthaydt/automata-sim': patch
---

The browser packages are one package and the build tools are one package.

`@mcthaydt/automata` now holds what `@mcthaydt/automata-host`, `-runtime`, `-render-pixi`, `-ui`, `-game` and `-testing` held, grouped by feature. Import from `@mcthaydt/automata` (everything the old packages exported), `@mcthaydt/automata/target` (the build target's adapter, from `-host/target`), `@mcthaydt/automata/no-eval`, `@mcthaydt/automata/extension`, `@mcthaydt/automata/testing` (the fake host and its contract suite, the layout contract, the runtime fakes and the fake gamepads) and `@mcthaydt/automata/theme.css`.

`@mcthaydt/automata-tools` now holds what `@mcthaydt/automata-ship`, `-cli` and `-node` held, plus the Playwright helpers (`@mcthaydt/automata-tools/e2e`, from `-testing/e2e`). It has one command, `automata`: `automata create-game`, `automata ship prepare|publish|deploy-dev|test-remote`, `automata add`, `automata check`, `automata build`, `automata editor`. `automata-ship` still works for one release and says that it is now `automata ship`.

`@mcthaydt/automata-sim/testing` (with `/testing/commands` and `/testing/property`) replaces `@mcthaydt/automata-testing/sim`. `vitest` is an optional peer dependency of the sim package, for these helpers only.

The old packages are no longer built or released; deprecating them in the registry is a separate step.
