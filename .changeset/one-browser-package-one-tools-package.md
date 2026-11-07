---
'@automata/framework': patch
'@automata/tools': patch
'@automata/sim': patch
---

The browser packages are one package and the build tools are one package.

`@automata/framework` now holds what `@automata/host`, `-runtime`, `-render-pixi`, `-ui`, `-game` and `-testing` held, grouped by feature. Import from `@automata/framework` (everything the old packages exported), `@automata/framework/target` (the build target's adapter, from `-host/target`), `@automata/framework/no-eval`, `@automata/framework/extension`, `@automata/framework/testing` (the fake host and its contract suite, the layout contract, the runtime fakes and the fake gamepads) and `@automata/framework/theme.css`.

`@automata/tools` now holds what `@automata/ship`, `-cli` and `-node` held, plus the Playwright helpers (`@automata/tools/e2e`, from `-testing/e2e`). It has one command, `automata`: `automata create-game`, `automata ship prepare|publish|deploy-dev|test-remote`, `automata add`, `automata check`, `automata build`, `automata editor`. `automata-ship` still works for one release and says that it is now `automata ship`.

`@automata/sim/testing` (with `/testing/commands` and `/testing/property`) replaces `@automata/testing/sim`. `vitest` is an optional peer dependency of the sim package, for these helpers only.

The old packages are no longer built or released; deprecating them in the registry is a separate step.
