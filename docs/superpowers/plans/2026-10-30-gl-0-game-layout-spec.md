# GL.0: game layout by role (EsperRedux-style), spec (plan)

> **Task:** GL.0, a spec amendment for the games, the `create-game` template and the one-file examples. The row is
> not in [02 Master delivery plan](../../02-master-delivery-plan.md) yet; the integration owner adds GL.0 to GL.7 from
> the spec's §14.
> **Owner direction (2026-10-30, this session's chat):** "I wanted the projects structured like the esper redux
> project", then, after the coordinator's recommendation, "make the restructure when it makes sense to". The Owner
> approved the coordinator's take/leave split, which the spec encodes.
> **Lane:** docs only (no code, so the TDD rule has nothing to test). The rows the spec defines belong to the game,
> ship, examples, integration and figures/3D lanes (spec §3).
> **Branch:** `claude/gl-0-game-layout-by-role-spec`, worktree `/home/user/wt/af-gl0-game-layout-spec` (review fixes in `/home/user/wt/gl-0`), from
> `origin/main` `30e9606c`.
> **Deliverable:** [`docs/superpowers/specs/2026-10-30-game-layout-by-role-design.md`](../specs/2026-10-30-game-layout-by-role-design.md),
> reviewed by the Owner before GL.1.

## What is written

- The spec (new), at the 01 Decomposition §5 level: scope and ownership, the layout and its rules, a file-by-file
  mapping for Emberwick (all 69 `.ts` files) and the placeholder, the checker contracts (`check-style` and
  `check-boundaries` in a game root, `automata check`, the plugin hook, the examples catalog), why the move keeps the
  golden hash (with a measured probe), migration order, failure and recovery, acceptance cases, task rows GL.1 to
  GL.7 (plus GL.1b, found while writing), decisions for the Owner's veto, and follow-ups.
- This plan.
- Nothing else: 00 to 04 and `AGENTS.md` are the integration owner's. The spec proposes the `AGENTS.md` sentence and
  lists the rows and pointers the integration owner adds.

## Sources read (with the revision)

| Source | Revision |
|---|---|
| EsperRedux: `README.md`, `constants.py`, `components.py`, `actions.py`, `state.py`, `redux_toolkit.py`, `processors.py`, `sync.py`, `main.py`, `tests.py` | `mcthaydt/PyrayExperiments_EsperRedux` `c2f4365` |
| AF `games/emberwick` (every file), `games/placeholder` (every file), `examples/*/*.ts` (17 examples), `tooling/check-style/src/{style,cli,style.test}.ts`, `tooling/check-boundaries/src/{cli,check,files}.ts`, `tooling/examples-runner/src/{catalog,header}.ts` and `catalog.test.ts`, `packages/cli/src/create-game.ts`, `packages/cli/src/check/check-steps.ts`, `agents/automata/` (skills, `hooks/hooks.json`, `scripts/check.mjs`), `tooling/agent-skills/src/install.test.ts`, `packages/game/src/{define-game,start-game}.ts`, `packages/sim/src/world/{sim,snapshot,entity-store}.ts`, `packages/sim/src/schedule/schedule.ts`, `packages/sim/src/define/definitions.ts`, root `package.json` scripts, `.github/workflows/{ci,game-ci}.yml`, `packages/ship/src/workflows.test.ts`; docs 00 to 04, `AGENTS.md`, the DX spec §3.4 to §3.7, the EX spec §2 and §4 | `30e9606c` |
| GAME-3D.0's design doc §3.1 (PR #229, open) | `claude/3d-game-3d-0-design` at `4734d6f9` |
| Open PRs touching `games/`, `examples/`, `packages/cli/src/create-game.ts` or `ci.yml` (#194, #197, #203, #205, #219, #235), by their file lists | GitHub REST, 2026-10-30 |

## Steps

- [x] Worktree from `origin/main` (`30e9606c`); `pnpm install --frozen-lockfile`.
- [x] Read the sources above.
- [x] Probe what moves the golden hash (a scratch test in `games/emberwick/src`, deleted, never committed): the
      plugin's arrays reversed keep `31f50888ccb4cf0a`; `Move`'s Zod keys swapped change the schema hash (spec §7).
- [x] Probe `import.meta.env.MODE` under Vitest 5.0.3 (a scratch test, deleted): `'test'` in the node, jsdom and
      browser projects, Chromium, WebKit and Firefox (spec §4.6).
- [x] Probe `main.ts`'s side-effect imports in tests (a scratch test, deleted): `no-eval` and the font CSS load in
      Emberwick's node and jsdom projects (spec §4.6).
- [x] Run today's style rules on `games/*/src`: "41 files, 0 findings" (spec §8).
- [x] Write this plan.
- [x] Write the spec.
- [x] Gates: `pnpm format`, and every relative link in both files resolves.
- [x] Commit, push, open the draft PR.
- [x] Apply the PR #243 review (seven findings, each verified against the files on `main` `30e9606c`); `pnpm format`
      and `pnpm check`; commit, push, mark the PR ready.

## Gates

| Gate | Selected | Result |
|---|---|---|
| `pnpm format` | yes | "Checked 2046 files … No fixes applied" (Biome does not format Markdown; run for the rule) |
| Relative links in both files resolve (a script over every Markdown link that is not `http` or an anchor) | yes | 7 relative links, 0 broken (one broken link, the proposed `AGENTS.md` text's root-relative path, was turned into plain text) |
| `pnpm check` (review fixes; turbo cache allowed, docs only) | yes | 34 of 34 tasks successful |
| `TURBO_FORCE=true pnpm check` (first draft), build, api-report, agent-skills, changeset, parity | omitted: docs only, no package, test or config touched | — |
| Owner review of the spec | pending (Owner gate, never ticked by an agent) | — |

## Execution log

- 2026-10-30: worktree created at `30e9606c`; install done; sources read. Probes run and deleted (`git status` clean
  after each): the plugin's arrays reversed keep `31f50888ccb4cf0a` and schema hash `a032b5126eeba0a8`; `Move`'s
  Zod keys swapped give schema hash `3b0bb21c08e833d0`; `import.meta.env.MODE` is `'test'` in 6 of 6 probe files
  (node, jsdom, Chromium, WebKit, Firefox); `no-eval` and the font CSS load in the node and jsdom projects. Emberwick's
  plumbing test today: sim 377, art 393, content 96, drawing 860, plumbing 383. Today's style rules on `games/*/src`:
  41 files, 0 findings. Plan committed first (`be70064d`), then the spec. `pnpm format`: no fixes. Links: 7, none
  broken.
- Found while writing (spec GL-D9): the flat layout removes the `src/sim/` folder that `check-boundaries`,
  `automata check` and the plugin hook read, so the spec adds row GL.1b beside the brief's GL.1 to GL.7.
- Deviation from the brief, recorded in the spec §7: the brief asked to preserve definition registration order
  because of the schema hash. The probe shows registration order is not hashed (the sim sorts definitions and
  orders systems canonically); what the hash covers is each definition's text (ids, field types, Zod key and union
  order, system names and phases). The spec keeps the order anyway and states the real rule.
- 2026-10-30, review of PR #243 (worktree `/home/user/wt/gl-0`), every finding verified against `main` `30e9606c`
  and applied: (1) GL.5 now follows EX.4 and every EX.4 row in 02 (EX.4cu, EX.4c, EX.4s, EX.4u, EX.4p, EX.4f,
  EX.4h), the Owner's order "the examples' section order after EX.4", and counts the examples from `readCatalog`
  when it runs instead of "all 17" (§3, §6.5, §8 step 4, §12 G1, §14); (2) `goal.system.ts` imports `Progress`, and
  `state.ts` would import `systems.ts` for the plugin, a cycle: `resources.ts` is now a role before `systems.ts`
  (§4.1, §4.5, §5.1, §5.4's nine sections, §5.5, §6.1, GL-D2, GL-D7, A3, B7), `Progress` maps to `src/resources.ts`,
  and `install.test.ts`'s seed moves to appending to `src/resources.ts` (Emberwick now uses it); `Progress` is
  Emberwick's only resource and no one-file example defines one; the plugin's arrays keep today's order, so the
  golden `31f50888ccb4cf0a` is unchanged (§7); (3) GL.4 needs the Owner's words for the `ci.yml` change, quoted in
  the PR (§3, §8, §14), as 03 leaves merge authority over `.github/workflows` open; (4) E1 restated: the three
  golden constants unchanged, the only diff the `MoveInput` import path (`./sim/index.ts` → `../sim.ts`, confirmed
  in `src/golden.ts` line 6); (5) GL.4 now runs after DX.3a, which deletes the demo kit and the `./play`, `./render`
  and `./room` subpaths, so the move is smaller; §6.3 says the table is re-derived at GL.4's base, and E5 and the
  e2e row no longer name `content/hot-reload` (EX.4c deletes it before DX.3a); (6) citations: `check-steps.ts`
  line 101 and `check.mjs` line 45 (`isSimFile` at 41), checked on `main`; (7) §11 states red-first for GL.1b
  (B1–B7), GL.2 (C1–C3) and GL.5 (G2) as well as GL.1.
