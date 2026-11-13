# AutomataFramework: Agent Rules

AF is a TypeScript framework for small, deterministic 2D web games. The simulation runs on Koota and is checked bit
for bit in Node, Chromium, WebKit and Firefox. PixiJS draws the game. `web`, `itch`, `ruken` and `tauri` are peer
distribution targets, chosen when the game is built.

## What we are doing now

**Make 2D perfect and ship 2D only.** The Owner's words, 2026-11-13. A first 3D attempt was made and is being moved
out of `main`; [`docs/refactor/2026-11-13-2d-launch-cut-list.md`](docs/refactor/2026-11-13-2d-launch-cut-list.md) is
the order of work until it is done. If a task does not make the 2D launch better or sooner, it waits.

## Read order

1. This page.
2. [`docs/README.md`](docs/README.md): what AF is and where things are.
3. The cut list above, while the cut is running; then [`docs/status.md`](docs/status.md).

Everything under `docs/archive/`, `docs/refactor/` (but the cut list) and `docs/superpowers/` is history, not a source
of tasks.

## Staying on the rails

These exist because the project went off them once: 3D and a showcase game took over before 2D shipped, 70 branches
and 18 "known" test failures piled up, and each piece of work passed through seven sessions and as many documents.

**Scope**
- Nothing new starts without the Owner's words: no new package, extension, game, example, editor, target or
  dependency. "It would be useful later" is not a reason. Say what you found and ask.
- No 3D work in this repository until the Owner says 2D has shipped.
- Build nothing ahead of its user. Code stays only if a game, an example or a journey in this repository uses it.
- Keep the change to what was asked. A second problem found on the way is reported, not fixed in the same change,
  unless it blocks the task.
- A decision the Owner has made is not reopened. If new facts make it look wrong, say so once, with the facts.

**Pace**
- One piece of work is one branch and one pull request, small enough to review in one sitting. It merges or closes
  within two days. Never build on a branch that is not in `main`.
- At most three pull requests open, and one in CI at a time: the runners are the Owner's own machines.
- The process is: say what you will build (in the pull request, a few lines), build it test first, have it reviewed.
  No committed plans, audits, handoffs or progress pages; what a reader needs goes in the pull request and the
  commit message. The cut list's own record is the one exception, until the cut is done.
- Stop and tell the Owner when a task has taken twice what was expected, when the third fix for the same failure
  has not worked, or when a look has been through two rounds without his "fine". Do not start a fourth attempt.
- Do not delegate to subagents or start other sessions unless asked.

**Truth**
- `main` is green. A test that fails on `main` is fixed, or its cause removed, before any other work. There is no
  list of known failures to merge past, and no step may hide behind a failing one. Until the cut has removed 3D, its
  night journeys fail on `main`: the cut list's pull requests and the merges the Owner names go past them, and each
  says so.
- A test that fails once and passes on retry is a defect to find, not a flake to note. It does not block that merge,
  but it is reported the same day with its text, and a second sighting is fixed before other work.
- "Done" means merged to `main` and green there. Otherwise say where it is: "on a branch", "in CI", "not started".
- Report what you ran, what you did not run and why, and what is still open. Never round up.
- Speak plainly to the Owner: the conclusion first, short, no jargon he did not use.

## The laws

1. Only the sim changes gameplay state. The sim has no I/O, no wall clock and no `Math.random`.
2. Each piece of state has one owner. Presentation observes; it never decides.
3. The same seed, content and inputs give the same hash, in every engine. Never accept a hash mismatch as flaky.
4. The host is a port. No distribution target is the reference ([ADR 0006](docs/adr/0006-distribution-targets.md)).
5. Effect is for Node tooling. The sim never imports it, and the browser package `@automata/framework` is plain
   TypeScript ([ADR 0003](docs/adr/0003-effect-outside-the-sim.md) as amended).
6. PixiJS only for rendering ([ADR 0002](docs/adr/0002-pixi-for-2d-and-3d.md)). Every game imports the no-eval entry first.
7. Zod is the only schema language.

## Packages and features

- Browser code is one package, `@automata/framework`. Node build tools are one package, `@automata/tools`.
  The sim (`-sim`) and the content compiler (`-content`) stay separate. Extensions are opt-in and never edit core.
  They live in `extensions/<name>` as `@automata/<name>`, and core never imports one (`pnpm boundaries` fails on it).
- Inside a package, `src/` is `app/`, `features/<x>/`, `shared/`, `entries/` and `testing/`. A feature imports
  only itself and `shared/`; `app/` wires features together; `entries/` only re-exports. `pnpm boundaries` enforces it.
- A game's `src/` has the same shape. Sim files are found by role suffix (`.component.ts`, `.system.ts`,
  `.command.ts`, `.event.ts`, `.resource.ts`, `.plugin.ts`) and by what they import. `games/emberwick` and
  `games/base-3d` both have it.
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
- Preserve other people's changes.

## Gates

- `pnpm format` before committing; Conventional Commits.
- `pnpm check` runs lint, typecheck, `boundaries`, `style`, `knip`, the unit tests, `changeset status` and
  `check-changesets`.
- Pull requests run `pnpm check` plus parity and the 2D journeys. `release-checks.yml` (before every publish, nightly
  and by hand, not on pull requests) runs `pnpm build`, `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills` and the
  packed-install smoke. After changing a published package's exports or doc comments, run `pnpm build`, then
  `pnpm api-report --update` and `pnpm api-index --write` (the cheatsheet and the agent package's API reference), and
  commit what they write.
- The gate runs every unit test (`pnpm check` runs `pnpm test:unit`, 3D included) and the 2D browser suites
  (`pnpm test:browser:2d`); `.github/workflows/3d.yml` runs the 3D browser suites and journeys, and `pnpm ci:local` runs both.
- Only published packages get a changeset, and it is `patch`. Private ones (the editors, figures) need none. The one exception is `.changeset/first-public-release.md`, a `minor` that takes the shared version to 0.1.0 once.
- Browser, visual and journey suites run on the GPU runner, and cross-engine parity runs in Chromium, WebKit and
  Firefox. Report what you ran, what you left out and what is pending.
- Packages publish publicly as `@automata/<name>` to npmjs.org (the Owner's `NPM_TOKEN`; no token to install them).

## Branches and pull requests

- `main` and the branches with an open pull request are the only branches. No backup, handoff or notes branches; a
  tag does that job. GitHub deletes a pull request's branch when it merges; any other deletion is the Owner's.
- Merge with a merge commit, never a squash, so ancestry shows what is in `main`.
- Never force-push. Never loosen, skip or re-record a test to get green; a golden moves only with the Owner seeing
  before and after.
- Workflow files (`.github/workflows/*`) change only on the Owner's words, quoted in the commit.
- Credentials, money, real-device tests, release approvals, tags and branch deletions are the Owner's.
