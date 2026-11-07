# Status

Written 2026-11-06, after stage 6 (fixes) of the core-and-2D refactor. [`refactor/progress.md`](refactor/progress.md) has
the task-by-task record; this page is the short version.

## What works today

- **The sim.** Koota behind a sim facade; goldens give the same hash in Node, Chromium, WebKit and Firefox (WebKit and
  Firefox last ran before the refactor; they run again when the Owner runs `pnpm ci:local`).
- **Emberwick** (`games/emberwick`): the 2D reference game. Splash, menu, room, pause, end screen; keyboard, touch
  and gamepad; boots standalone and inside Ruken's fake host. Its 28 journeys pass in Chromium (phone, compact and iPad sizes).
- **Targets.** `web`, `itch`, `ruken` and `tauri` adapters share AF's own host contract. The host contract, the
  adapters and the browser runtime are plain TypeScript (no Effect).
- **Packages.** `@automata/framework` (everything a game imports in the browser), `-sim`, `-content` and `-tools`.
  `-content` has browser-safe entries for `game-config`, `locale`, `schema` and `palette`, so a dev server page never
  loads Node modules.
- **Tools.** One `automata` command: create-game, add, check, build, editor, ship. `automata --help` works.
- **Examples.** 27 single-file examples and the content hot-reload demo.
- **Editors.** Every unit test, 2D and 3D, runs in the gate; the 2D editors' layout, canvas and journey tests run in the 2D
  gate, and the 3D editor's browser suites and journeys run in `.github/workflows/3d.yml`.
- **Touch.** No double-tap zoom or long-press selection in games and editors (`touch-action: manipulation`).

## Where the refactor is

Core and 2D: stages 1, 2, 3, 5 and 6 are done; stage 4 (the build) is 27 of 30 tasks. The work is 16 stacked pull
requests, #388 to #403, all drafts except #388. Stage 5 audited the stack (#402) and stage 6 closed every finding (#403).

Left, and the Owner's:

1. Run `pnpm ci:local` where WebKit and Firefox install, and `pnpm lint:actions` where Docker runs.
2. Mark the pull requests ready and merge them bottom up. Squashing the stack into fewer pull requests is an option.
3. Push the tag `pre-refactor-2d`, say go for the branch clean-up, and play Emberwick on the iPad.
4. Ask Ruken for a refusal switch in its fake host, so the boot-failure journey can be added.

## What is next

After core and 2D: the 2D editors and the website, made ready to ship with 2D alone (the Owner, 2026-11-06); then the
same for 3D (`games/base-3d`, `render-pixi3d`, `figures`, the 3D editors and the site). Each slice goes audit, plan,
plan audit, build, build audit, fixes, and is finished before the next starts. The 2D editors and website audit is
[`refactor/2026-11-06-2d-editors-and-site-audit.md`](refactor/2026-11-06-2d-editors-and-site-audit.md); the rest of the
2D launch path (`create-game`, releases, the agent package, docs, tooling, Plus and the other repositories) is
[`refactor/2026-11-06-2d-ship-rest-audit.md`](refactor/2026-11-06-2d-ship-rest-audit.md).

## Not verified here

Hosted CI has no runners, so the pull requests rely on local runs. WebKit and Firefox cannot be installed in the
cloud sessions, so cross-engine parity and the golden hash in those engines are left to the Owner's machine or a runner.
Real-device testing (the iPad) is the Owner's.

## How to run it

```sh
pnpm install
pnpm --filter @af-games/emberwick dev    # open the printed URL
pnpm check                                # lint, typecheck, boundaries, style, knip, unit tests, changeset checks
pnpm test:e2e                             # the journeys
```
