# AutomataFramework

AutomataFramework (AF) is a TypeScript framework for small, deterministic web games. The simulation runs on Koota
and gives the same hash in Node, Chromium, WebKit and Firefox. PixiJS draws the game, in 2D and in 3D. A game is
mostly content and game logic; AF supplies the loop, input, saves, audio, screens, the build and the publish step.

A game is built for one of four peer targets, chosen at build time: `web`, `itch`, `ruken` and `tauri`.

## Where things are

| Path | What it holds |
|---|---|
| `packages/automata` | The browser package: runtime, renderer, host contract, ui kit, screens, target adapters |
| `packages/sim`, `packages/content` | The deterministic sim, and the content compiler |
| `packages/tools` | The `automata` command: create-game, add, check, build, ship |
| `packages/3d` | The 3D renderer, camera, procedural figures and the level format, by feature (private until Pixi 3D is public) |
| `packages/editor-*` | The editor suite: 2D level editor, 3D editor, shared kit |
| `extensions/` | Opt-in extras a game adds, each `@automata/<name>` with its own README (physics, feel, net, the 3D kits and more) |
| `games/emberwick` | The 2D reference game |
| `games/base-3d` | The 3D reference game, Ember Hall ([`README`](../games/base-3d/README.md)) |
| `examples/` | One file per feature ([`examples/README.md`](../examples/README.md)) |
| `tooling/` | Repository checks: boundaries, style, versions, release, consumer smoke |

## Where to read next

- [`status.md`](status.md): what works today and what is next.
- [`refactor/progress.md`](refactor/progress.md): the refactor, task by task, with evidence.
- [`adr/`](adr/): the decisions in force (ECS, Pixi, Effect, hosts, publish targets).
- [`guides/`](guides/): publish to the web, itch.io, Ruken or the desktop; the editor; [making a 3D game](guides/3d.md) (private beta, so not on the site yet).
- [`runbook.md`](runbook.md): how to run and release.
- [`art/`](art/README.md): the look: DUEL, Bubble Bobble with Celeste.
- [`archive/`](archive/): the 2026-10 specs, plans and task lists. History, not a task list. The 2D editor's and the
  suite's mock-ups are in [`archive/design/`](archive/design/); the 3D editor's are still in `design/`.

## Principles

- **Mobile first.** Design and test at phone size.
- **Core is small and proven.** A capability is core only if every target needs it or both reference games do.
- **Fast feedback, honest gates.** Evidence decides what is done: written, reviewed, built, verified, deployed and
  accepted are different facts.
