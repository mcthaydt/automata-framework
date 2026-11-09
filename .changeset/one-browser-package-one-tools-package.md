---
'@automataframework/automata': patch
'@automataframework/automata-tools': patch
'@automataframework/automata-sim': patch
---

The browser packages are one package and the build tools are one package.

`@automataframework/automata` now holds what `@automataframework/automata-host`, `-runtime`, `-render-pixi`, `-ui`, `-game` and `-testing` held, grouped by feature. Import from `@automataframework/automata` (everything the old packages exported), `@automataframework/automata/target` (the build target's adapter, from `-host/target`), `@automataframework/automata/no-eval`, `@automataframework/automata/extension`, `@automataframework/automata/testing` (the fake host and its contract suite, the layout contract, the runtime fakes and the fake gamepads) and `@automataframework/automata/theme.css`.

`@automataframework/automata-tools` now holds what `@automataframework/automata-ship`, `-cli` and `-node` held, plus the Playwright helpers (`@automataframework/automata-tools/e2e`, from `-testing/e2e`). It has one command, `automata`: `automata create-game`, `automata ship prepare|publish|deploy-dev|test-remote`, `automata add`, `automata check`, `automata build`, `automata editor`. `automata-ship` still works for one release and says that it is now `automata ship`.

`@automataframework/automata-sim/testing` (with `/testing/commands` and `/testing/property`) replaces `@automataframework/automata-testing/sim`. `vitest` is an optional peer dependency of the sim package, for these helpers only.

The old packages are no longer built or released; deprecating them in the registry is a separate step.
