# AutomataFramework

AutomataFramework (AF) is a TypeScript framework for small 2D web games. You write a game once and ship it to the web,
itch.io, Ruken or a desktop app. The game's rules give the same result, bit for bit, in Node, Chromium, WebKit and
Firefox, and PixiJS draws it.

## Make a game

`npx @automata/tools create-game my-game` makes a game that runs, passes its checks and opens in the
level editor. The steps, the guides and the API are on [automataframework.com](https://automataframework.com).

## Work on the framework

The rest of this page is for working on AF itself. [`docs/README.md`](docs/README.md) explains the design and
[`docs/status.md`](docs/status.md) says what works today.

### Play Emberwick from a fresh clone

Emberwick is AF's 2D sample game: Wick, a hooded lantern-bearer, walks and jumps through a room of mossy ruins to
reach an ember. It lives in [`games/emberwick`](games/emberwick/).

You need Git and Node 24.21.0 (the version in `.nvmrc`). Corepack brings the right pnpm.

```sh
git clone https://github.com/mcthaydt/automata-framework.git
cd automata-framework
corepack enable
pnpm install
pnpm --filter @af-games/emberwick dev    # open the printed URL; arrows or A/D move, Space jumps
```

The same build runs on its own in a browser and inside Ruken.

### Check a change

```sh
pnpm format                               # Biome writes the formatting
pnpm check                                # lint, typecheck, boundaries, style, knip and unit tests
pnpm test:browser                          # the determinism suites in Chromium, WebKit and Firefox
pnpm test:e2e                             # the browser journeys
pnpm ci:local                             # everything CI runs, in order
```

Consumer smoke packs the published packages, installs them in a project outside the workspace and uses them
as a game would. It also checks that every command in this README still resolves to a script or file:

```sh
pnpm build && node tooling/consumer-smoke/src/run.ts --from packs
```

### Where things are

| Path | What it holds |
|---|---|
| `packages/` | The packages, published as `@automata/*` |
| `games/` | Emberwick (2D) and the 3D game |
| `examples/` | One file per feature ([`examples/README.md`](examples/README.md)) |
| `tooling/` | Repository checks: boundaries, style, versions, release, consumer smoke and repo hygiene |
| `docs/` | The [status](docs/status.md), the refactor [progress](docs/refactor/progress.md), ADRs, guides and the [runbook](docs/runbook.md); old specs and plans are in `docs/archive/` |

Contributors and agents start with [`AGENTS.md`](AGENTS.md). Every change is a pull request, written test first.

## Security and licence

Report a vulnerability as [`SECURITY.md`](SECURITY.md) describes, not in a public issue.

The framework is MIT licensed, copyright (c) 2026 Team Automata: see [`LICENSE`](LICENSE). Every package carries
`"license": "MIT"` and its own `LICENSE` file. Third-party code, fonts and artwork keep their own terms; see
[`LICENSE-SCOPE.md`](LICENSE-SCOPE.md).
