# Status

Written 2026-11-05, during the core-and-2D refactor. [`refactor/progress.md`](refactor/progress.md) has the
task-by-task record; this page is the short version.

## What works today

- **The sim.** Koota behind a sim facade; goldens give the same hash in Node, Chromium, WebKit and Firefox.
- **Emberwick** (`games/emberwick`): the 2D reference game. Splash, menu, room, pause, end screen; keyboard, touch
  and gamepad; boots standalone and inside Ruken's fake host. Its 25 journeys pass in Chromium.
- **Targets.** `web`, `itch`, `ruken` and `tauri` adapters share AF's own host contract. The host contract and the
  three adapters are plain TypeScript (no Effect).
- **Tools.** One `automata` command: create-game, add, check, build, editor, ship.
- **Examples.** 27 single-file examples and the content hot-reload demo.
- **Editors.** The 2D level editor and the 3D editor build and pass their unit tests.

## Where the refactor is

Core and 2D, stage 4 (build). Open and stacked: package merge and test move (#393), plain host contract (#394),
Emberwick rename, feature layout and a smaller root entry (#395), the docs move (#396), copy and new Emberwick journeys
(#397), comments that say why and the `create-game` journey (#398). `automata create-game` now writes a game that runs on
the default screens.

Still to do in core and 2D:

1. Take Effect out of the runtime, by feature (task 5.4), then check the bundle.
2. The rest of the copy table (Settings sections, CLI messages, READMEs) and the boot-failure journey, which needs a
   refusal switch in Ruken's fake host.
3. Branch clean-up (9.2), which waits for the Owner.

## What is next

After core and 2D: 3D (`games/base-3d`, `render-pixi3d`, `figures`), then the editors, then the website. Each area
goes audit, plan, plan audit, build, build audit, fixes, and is finished before the next starts.

## Not verified here

Hosted CI has no runners, so the pull requests rely on local runs. WebKit and Firefox cannot be installed in the
cloud sessions, so cross-engine parity and the golden hash in those engines are left to CI or the Owner's machine.
Real-device testing (the iPad) is the Owner's.

## How to run it

```sh
pnpm install
pnpm --filter @af-games/emberwick dev    # open the printed URL
pnpm check                                # lint, typecheck, boundaries, style, knip, unit tests
pnpm test:e2e                             # the journeys
```
