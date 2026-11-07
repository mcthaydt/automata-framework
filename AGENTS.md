# AutomataFramework: Agent Rules

AF is a TypeScript framework for small, deterministic web games. The simulation runs on Koota and is checked bit
for bit in Node, Chromium, WebKit and Firefox. PixiJS draws the game. `web`, `itch`, `ruken` and `tauri` are peer
distribution targets, chosen when the game is built. The Owner's direction, decision by decision, is in
[`docs/archive/direction-log.md`](docs/archive/direction-log.md).

## Read order

1. [`docs/README.md`](docs/README.md): what AF is and where things are.
2. [`docs/status.md`](docs/status.md): what works today and what is next.
3. [`docs/refactor/progress.md`](docs/refactor/progress.md): the refactor's tasks, with evidence.
4. [`docs/refactor/2026-11-05-core-and-2d-spec.md`](docs/refactor/2026-11-05-core-and-2d-spec.md): the layout and
   the rules below, with reasons. Its plan is next to it.

The 2026-10 specs, plans and task lists are in `docs/archive/`. They are history, not a source of tasks.

## The laws

1. Only the sim changes gameplay state. The sim has no I/O, no wall clock and no `Math.random`.
2. Each piece of state has one owner. Presentation observes; it never decides.
3. The same seed, content and inputs give the same hash, in every engine. Never accept a hash mismatch as flaky.
4. The host is a port. No distribution target is the reference ([ADR 0006](docs/adr/0006-distribution-targets.md)).
5. Effect is for Node tooling. The sim never imports it, and the browser package `@automata/framework` is plain
   TypeScript ([ADR 0003](docs/adr/0003-effect-outside-the-sim.md) as amended). The 3D renderer keeps Effect until the 3D phase.
6. PixiJS only for rendering ([ADR 0002](docs/adr/0002-pixi-for-2d-and-3d.md)). Every game imports the no-eval entry first.
7. Zod is the only schema language.

## Packages and features

- Browser code is one package, `@automata/framework`. Node build tools are one package, `@automata/tools`.
  The sim (`-sim`) and the content compiler (`-content`) stay separate. Extensions are opt-in and never edit core.
- Inside a package, `src/` is `app/`, `features/<x>/`, `shared/`, `entries/` and `testing/`. A feature imports
  only itself and `shared/`; `app/` wires features together; `entries/` only re-exports. `pnpm boundaries` enforces it.
- A game's `src/` has the same shape. Sim files are found by role suffix (`.component.ts`, `.system.ts`,
  `.command.ts`, `.event.ts`, `.resource.ts`, `.plugin.ts`) and by what they import. `games/base-3d` keeps its
  role files until the 3D phase.
- Tests live in `tests/` beside `src/`: `unit/<feature>/`, `browser/`, `e2e/`, `fixtures/`, and where a package needs
  them `bench/` (timings), `slow/` (needs a real browser or the network, run by hand) and `install/` (installs a packed
  package outside the workspace). One suffix, `.test.ts`. A test imports the code it tests as `#src/…`, never by a
  relative chain into `src/`; `pnpm style` fails on one.
- Names: kebab-case files with a role suffix where one applies. A source file has at most 600 lines.
- Comments say why. They do not say which plan asked for the code.

## Host authority and targets

- The game talks to the host only through the `Hosting` service. A refused or missing capability never quietly
  falls back to device storage.
- Only a target's adapter imports that platform's packages (`@ruken/*`, `@tauri-apps/*`). Never copy a Ruken
  message, limit or manifest field into AF; ask Ruken for what it lacks.
- A window-message handler checks both source and origin.

## Responsive UI

- Design and test at phone size first. Layout follows the container size and usable height; input mode is separate.
- Touch targets are at least 44 px; primary actions 48 px. Never shrink one or hide an action to make a screenshot fit.
- Keep focus and state through rotation, compact height and the on-screen keyboard. Scroll only in declared regions.
- Prove behaviour with DOM tests, layout with real-browser tests, composition with journeys. A screenshot proves none of
  focus, hit testing or a host journey.
- Copy and UX pass the drunk grandma test: could a drunk grandma tell what is happening and what to press?

## How to work

- Write the failing test first in `packages/`, `tooling/`, `games/` and `examples/`; confirm it fails for the right
  reason. Start with the smallest test, then widen.
- Use injected clocks and fixed seeds. Browser tests wait on readiness, never on a sleep.
- A hash that moves is investigated, not re-recorded per engine. Say why in the commit when it must move.
- Look at the real expected, actual and diff images before accepting a visual change, and explain each change.
- Facts come from artifacts: hashes, sizes and timings are measured, never written by hand.
- Keep the change to what was asked. Preserve other people's changes. Do not delegate to subagents unless asked.
- Update `docs/refactor/progress.md` and the plan's log in the same session as the work. Tick a plan step only when
  its checks pass. Leave a gate unchecked if it did not run, and say which.

## Gates

- `pnpm format` before committing; Conventional Commits.
- `pnpm check` runs lint, typecheck, `boundaries`, `style`, `knip`, the unit tests, `changeset status` and
  `check-changesets`.
- Pull requests run `pnpm check` plus parity and the 2D journeys. `release-checks.yml` (before every publish, nightly
  and by hand, not on pull requests) runs `pnpm build`, `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills` and the
  packed-install smoke. After changing a published package's exports or doc comments, run `pnpm build`, then
  `pnpm api-report --update` and `pnpm api-index --write` (the cheatsheet and the agent package's API reference), and
  commit what they write.
- The 2D gate (`pnpm check`, `pnpm test:unit:2d`, `pnpm test:browser:2d`) includes the 2D editors' unit, layout, canvas and
  journey tests; the 3D editor, the suite and the other 3D packages run in `.github/workflows/3d.yml`.
- Only published packages get a changeset, and it is `patch`. Private ones (the editors, figures) need none.
- Browser, visual and journey suites run on the GPU runner, and cross-engine parity runs in Chromium, WebKit and
  Firefox. Report what you ran, what you left out and what is pending.
- Packages publish publicly as `@automata/<name>` to npmjs.org (the Owner's `NPM_TOKEN`; no token to install them).

## Branches and pull requests

- Work on a branch and open a draft pull request. Do not leave backup or handoff branches; a draft PR or a tag does
  that job. When a branch's pull request is merged, delete the branch.
- `main` and the branches with an open pull request are the only long-lived branches.
- Credentials, money, real-device tests, release approvals and branch deletions are the Owner's.
