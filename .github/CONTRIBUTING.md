# Contributing to AutomataFramework

Thank you for wanting to help. AF is a TypeScript framework for small, deterministic 2D web games, and it has one
maintainer today, so the clearer a report or a change is, the sooner it lands.

## Reporting a problem

- **A bug:** [open a bug report](https://github.com/mcthaydt/automata-framework/issues/new/choose). Say which AF
  version, which target (web, itch or desktop) and which browser. If the game behaves differently from one run
  or browser to the next, give the seed: the same seed, content and inputs must give the same result everywhere, so a
  difference is always a bug.
- **An idea:** open a feature request and describe the game that needs it. AF adds code only when a game, an example
  or a journey in this repository uses it.
- **A vulnerability:** never in a public issue. Follow [`SECURITY.md`](../SECURITY.md).

Search the open and closed issues first; it may already be known or fixed on `main`.

## Setting up

You need Git and Node 24.21.0 (the version in `.nvmrc`). Corepack brings the right pnpm.

```sh
git clone https://github.com/mcthaydt/automata-framework.git
cd automata-framework
corepack enable
pnpm install
pnpm --filter @af-games/emberwick dev    # the sample game; open the printed URL
```

## Making a change

1. **Say what you will build first.** For anything bigger than a typo, open an issue or a draft pull request with a
   few lines on what and why, so nobody builds something that will not be merged.
2. **One change, one pull request,** small enough to review in one sitting. A second problem you find on the way goes
   in its own issue.
3. **Write the failing test first,** then the code. Tests live in `tests/` beside `src/`, never next to the source.
   Use fixed seeds and injected clocks; a browser test waits on readiness, never on a sleep.
4. **Keep the sim pure.** Only the sim changes gameplay state, and it has no I/O, no wall clock and no
   `Math.random`. Presentation observes; it never decides.
5. **Write comments that say why,** not what the code does.

The full rules, the package layout and the reasons behind them are in [`AGENTS.md`](../AGENTS.md); the design is in
[`docs/README.md`](../docs/README.md).

## Checking a change

```sh
pnpm format          # Biome writes the formatting
pnpm check           # lint, typecheck, boundaries, style, knip and the unit tests
pnpm test:browser    # the determinism suites in Chromium, WebKit and Firefox
pnpm test:e2e        # the browser journeys
```

`pnpm check` must pass before you open a pull request. If you cannot run the browser suites, say so in the pull
request; CI runs them.

## Submitting

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`fix(sim): …`,
  `feat(editor): …`, `docs: …`).
- A change to a published `@automata/*` package needs a `patch` changeset: run `pnpm changeset`.
- After changing a published package's exports or doc comments, run `pnpm build`, `pnpm api-report --update` and
  `pnpm api-index --write`, and commit what they write.
- Fill in the pull request template. A reviewer may ask for changes; push them as new commits, never a force-push.
- Pull requests merge with a merge commit once CI is green.

## Code of conduct

Everyone taking part agrees to the [code of conduct](../CODE_OF_CONDUCT.md).

## Licence

By contributing you agree that your contribution is licensed under the [MIT License](../LICENSE) of this repository.
