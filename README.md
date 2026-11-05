# AutomataFramework

AutomataFramework (AF) is a TypeScript framework for small, deterministic web games that run inside
[Ruken](https://github.com/mcthaydt/RukenApp). The simulation runs on Koota and is checked bit for bit in Node,
Chromium, WebKit and Firefox. PixiJS draws the game. [`docs/README.md`](docs/README.md) explains the design and
[`docs/status.md`](docs/status.md) says what works today.

## Run Emberwick from a fresh clone

Emberwick is AF's 2D reference game: Wick, a hooded lantern-bearer, walks and jumps through one room of mossy
ruins to an ember. It is the workspace package `@af-games/emberwick`, in [`games/emberwick`](games/emberwick/)

You need Git, and Node 24.21.0 (the version in `.nvmrc`). Corepack then runs the pinned pnpm.

```sh
git clone https://github.com/mcthaydt/automata-framework.git
cd automata-framework
corepack enable
pnpm install
pnpm --filter @af-games/emberwick dev    # open the printed URL; arrows or A/D move, Space jumps
```

Opened on its own, Emberwick runs standalone. Inside Ruken it completes the host handshake first.

## Check a change

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

## Where things are

| Path | What it holds |
|---|---|
| `packages/` | The packages, published as `@mcthaydt/automata-*` |
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
