# AutomataFramework

AutomataFramework (AF) is a TypeScript framework for small, deterministic web games that run inside
[Ruken](https://github.com/mcthaydt/RukenApp). The simulation runs on Koota and is checked bit for bit in Node,
Chromium, WebKit and Firefox. Everything outside the simulation runs on Effect, and PixiJS draws the game.
[`docs/00-overview.md`](docs/00-overview.md) explains the design and links the specs.

## Run Emberwick from a fresh clone

Emberwick is AF's 2D reference game: Wick, a hooded lantern-bearer, walks and jumps through one room of mossy
ruins to an ember. It is the workspace package `@af-examples/base-2d`, in [`games/emberwick`](games/emberwick/)
(EX.2 moved the folder there and kept the package name, so the `--filter` line below is unchanged).

You need Git, and Node 24.21.0 (the version in `.nvmrc`). Corepack then runs the pinned pnpm.

```sh
git clone https://github.com/mcthaydt/automata-framework.git
cd automata-framework
corepack enable
pnpm install
pnpm --filter @af-examples/base-2d dev    # open the printed URL; arrows or A/D move, Space jumps
```

Opened on its own, Emberwick runs standalone. Inside Ruken it completes the host handshake first.

## Check a change

```sh
pnpm format                               # Biome writes the formatting
pnpm check                                # lint, typecheck, boundaries, style, knip and unit tests
pnpm test:parity                          # the determinism suites in Chromium, WebKit and Firefox
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
| `packages/` | The core packages, published as `@mcthaydt/automata-*` |
| `examples/` | Emberwick and the feature demos ([`examples/README.md`](examples/README.md)) |
| `tooling/` | Repository checks: boundaries, style, versions, release, consumer smoke and repo hygiene |
| `docs/` | The plan ([02](docs/02-master-delivery-plan.md)), the status page ([03](docs/03-continuation-prompt.md)), specs, ADRs and the [runbook](docs/runbook.md) |

Contributors and agents start with [`AGENTS.md`](AGENTS.md) and
[`docs/04-how-we-build.md`](docs/04-how-we-build.md). Every change is a pull request, written test first.

## Security and licence

Report a vulnerability as [`SECURITY.md`](SECURITY.md) describes, not in a public issue.

There is no licence yet: every package says `"license": "UNLICENSED"` until DX.11 chooses one.
