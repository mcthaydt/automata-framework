# Core requests from Plus (FR.1 to FR.5) (TDD plan)

- **Rows:** FR.1 to FR.4 in `docs/02-master-delivery-plan.md`; FR.5 is the coordinator's row for the lane's own core finding (added in its next
  docs batch). The Plus side of each: automata-plus#28 (TR-D3), #31 (FE-D1), #33 (DBG-D2), #38 (the reconnect finding).
- **Branch:** `claude/core-requests-from-plus`, from main `02bf908a`; one wide PR, one commit per part, the branch pushed after each part.
- **Status:** plan drafted; no part built. CI verified, deployed and Owner accepted: not yet.

## FR.1: the private sector format builds to `dist` (TR-D3)

`@mcthaydt/automata-sector-format` exports `./src/index.ts`, so a Plus binary that runs from built code cannot resolve it. It stays private.

- Create `packages/sector-format/tsdown.config.ts` (the shared `publishedBuild`: entries `index` and `blockout`).
- Modify `packages/sector-format/package.json`: `files: ["dist"]`, `publishConfig.exports` (no registry: it is never published), a `build` script.
- Modify `tooling/core-packs/src/pack.ts`: an extra that declares `publishConfig.exports` needs its `dist` built (`pnpm pack` applies it).
- Create `tooling/release/src/private-build.test.ts` and add it to `release`'s `test:dist`: private libraries that declare built exports keep
  them in `dist`, ship `dist`, name no registry, and (after `pnpm build`) every built entry loads and exports something.
- Tests first: `private-build.test.ts` (the sector format is not yet one of them) and `pack.test.ts` (an extra with built exports and no `dist`).

## FR.2: the step's tick published with `sim.events` (FE-D1)

- Modify `packages/runtime/src/presentation/presentation-bus.manager.ts`: a new fact `'sim.step': { tick, events }`, additive.
  `'sim.events'` is unchanged, so no listener breaks.
- Modify `packages/runtime/src/loop/frame-loop.ts` (`stepOnce`): publish `sim.step` with `result.tick` (the tick the sim is at after the
  step, `StepResult.tick`) and the step's events, in the same place and under the same condition as `sim.events` (events non-empty).
- Test first: `packages/runtime/src/loop/app-loop.test.ts` or a new `frame-loop.test.ts`: a step that emits events publishes `sim.step`
  with the step's tick and events once, in order after `sim.events`; a step with no events publishes neither.
- A changeset (`@mcthaydt/automata-runtime`, minor); `pnpm api-report --update`, `pnpm agent-skills --write`, `pnpm cheatsheet` if stale.

## FR.3: `automata build --debug` and its constant

`automata build` does not exist yet (M8.5 is the full command with `--target`). This row adds the minimal command and the constant, nothing
of `--target`:

- Create `packages/cli/src/build/build-args.ts` and `run-build.ts`: `automata build [dir] [--debug]` runs the game's `vite build` and sets
  `AUTOMATA_DEBUG=1` for it when `--debug` is given. Wire it in `packages/cli/src/bin.ts` and its usage text.
- Modify `packages/content/src/vite/` (the plugin every game already uses): define `__AUTOMATA_DEBUG__` as `true` in a dev server or when
  `AUTOMATA_DEBUG=1`, else `false`. A release build tree-shakes every `if (__AUTOMATA_DEBUG__)` block.
- Create the bundle test `packages/content/src/vite/debug-constant.test.ts` (a Vite build of a fixture with a debug-gated marker): a
  release build has no marker, a `--debug` build and a dev build have it.
- Tests first: args parsing and `runBuild` with a fake runner (the flag sets the variable; no flag does not), then the bundle test.
- Plus's `debugBuild(debug)` plugin keeps working; moving it to core's constant is a Plus follow-up.

## FR.4: the changelogs and API summaries name no source project

- Reword the three lines in `packages/testing/CHANGELOG.md` and `packages/ui/CHANGELOG.md` (history entries are text of published releases:
  the lines are reworded in place, the commit hashes and facts stay).
- Create `tooling/repo-hygiene/src/source-names.ts` (the names, in private tooling, never in published text) and
  `source-names.test.ts`: a scan of the published surfaces (every `packages/*/CHANGELOG.md`, `packages/*/README.md`, the committed API
  reports, the cheatsheet and the agent skills) that fails naming file and line, never printing the name; a planted name fails; the
  real tree passes. Wire it into `pnpm check` as `pnpm source-names` beside `secrets`.
- Test first: the scan fails on the real tree (the three lines), then the rewording makes it pass.

## FR.5: Paused's reconnect line, and ScrollList's "+N more" badge

- Modify `packages/game/src/screens/PausedScreen.svelte`: the reconnect line moves under the menu (as the save lines are), so on a short
  screen the actions stay on screen and the line scrolls.
- Extend `packages/game/src/screens/screens.layout.test.ts` with a `paused-reconnect` screen (every reference size and variant, English and
  `xx-long`). Test first: it fails at 780x270 and TV scale with the line above the menu.
- ScrollList's "+N more" badge: read `ScrollList.svelte` and its layout test. If the badge is documented to sit over the last visible row
  (non-interactive, `pointer-events: none`), say so in the PR; otherwise fix it in the same commit with a layout test.

## Gates

`pnpm check`, `pnpm build`, `pnpm api-report --update`, `pnpm agent-skills --write`, `pnpm api-index`, `pnpm changeset status`,
`node tooling/release/src/check-changesets.ts`, `pnpm --filter @mcthaydt/release test:dist`; parity for runtime and ui in all three
browsers. Private packages (cli, sector-format) take no changeset. Pending: CI on the head.

## Decisions for the Owner's veto

- **CR-D1 (FR.2):** a new fact `sim.step` carries the tick, instead of changing `sim.events`' payload (which would break listeners).
- **CR-D2 (FR.3):** `automata build` arrives here as the minimal `[dir] [--debug]` command; `--target` stays M8.5.
- **CR-D3 (FR.4):** the scan covers published surfaces (changelogs, package READMEs, API reports, cheatsheet, agent skills), not source
  comments, which still cite their origin in places; that is a wider cleanup and its own row.

## Execution log

(empty)
