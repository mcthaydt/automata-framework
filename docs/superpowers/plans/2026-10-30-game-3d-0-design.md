# GAME-3D.0: the base 3D game's design doc (plan)

> **Task:** GAME-3D.0 in [02 Master delivery plan](../../02-master-delivery-plan.md) ("Design and review the base 3D game").
> **Lane:** integration (docs only; no code, so the TDD rule has nothing to test).
> **Branch:** `claude/3d-game-3d-0-design`, worktree `/home/user/wt/game-3d-0-design`, from `origin/main` `30e9606c`.
> **Deliverable:** [`games/base-3d/DESIGN.md`](../../../games/base-3d/DESIGN.md), reviewed by the Owner before GAME-3D.1.

## What is written

- `games/base-3d/DESIGN.md` (new; `games/base-3d/` did not exist, so the folder holds only the doc). Emberwick has no
  design doc in its folder: its design is the [M1.8 base-2d spec](../specs/2026-10-11-m1-base-2d-design.md), so the doc
  follows that spec's shape and [01 Decomposition](../../01-decomposition.md) §5 (goal and boundaries, ownership,
  contracts, flows, failure, UI, responsive, tests, feedback, Ruken, exit criteria), plus the game design the row asks
  for: concept and tone, scope with a room-by-room outline, the core loop, lock-on, combat, items, dungeon pieces,
  enemies and the boss, the ranged-item aim (a decision for the Owner's veto), positional audio, touch, keyboard and
  gamepad, settings, saves, localization, devices and budgets, content in the editors and the editor gaps, the M3 §18
  parity list confirmed or amended row by row, GAME-3D.T's place among M8's tasks, decision 7, acceptance cases mapped
  to GAME-3D.1a to 1l, and the open decisions GAME3D-D1 onward with defaults.
- This plan.
- Nothing else: 00 to 04 and `AGENTS.md` are the integration owner's; the rows the doc asks to change are listed as
  requests in the doc's §21 and in the hand-off.

## Sources read (with the revision)

| Source | Revision |
|---|---|
| AF `main`: 02 rows GAME-3D.0 to GAME-3D.T, M9.0 to M9.10, M3.7a to M3.10, M4.12, EDS.4a, EDS.9a to 9d, ED3D.12, M8.1 to M8.13, DX.5, DX.11; 03's Owner decisions of 2026-10-30; the M3 spec (§1, §4.2, §4.4, §4.7, §6 to §9, §12, §13, §15, §16, §17, §18); the EDS spec (§2, §3); the ED3D spec (§2, §3, §4.6, §4.7); the M4 spec (§4.4, §4.9, §8); the M5 spec (§4.2 to §4.4); the M1.8 base-2d spec; `docs/art/README.md`; `games/emberwick` (layout, package, e2e projects in `playwright.config.ts`); `packages/editor-3d/src/format/af-sector.schema.ts` (sector `view`, wall `occlude`); `packages/runtime/src/audio/audio.manager.ts` and `audio-voices.ts` (no pan); `packages/ui/src/touch/touch-button.ts` | `30e9606c` |
| The M4 spec's §16 (M4.12, analog input), PR #204, not merged at the time of writing | branch `claude/3d-m4-12-analog-input` at `0b23f8ca` |
| The Last Light: `src/fight/moves.ts`, `sim.ts`, `director.ts`, `src/fight/brawl/sim.ts`, `brawl/moves.ts`, `tests/fight.test.ts`, `tests/brawl.test.ts` (names), `src/game/pursuit.ts` (header), `src/audio/mixer.ts` (`spatial`, `Listener`) | `mcthaydt/PixiJS3D_Experiment_001` `92e6704` |
| FigureBuilder | `a1f7246`, through the M3 and EDS specs only (not re-read here) |

## Steps

- [x] Worktree from `origin/main` (`30e9606c`), branch `claude/3d-game-3d-0-design`.
- [x] Read the sources above.
- [x] Write this plan.
- [x] Write `games/base-3d/DESIGN.md`.
- [x] Gates: `pnpm format` (Biome does not format Markdown; run for the rule) and a relative-link check of both files.
- [x] Commit (Conventional Commits, the lane's trailers) and push. No PR (the coordinator opens it).

## Gates

| Gate | Selected | Result |
|---|---|---|
| `pnpm format` | yes | ran: "Checked 2046 files … No fixes applied" (Markdown is not Biome's) |
| Relative links in both files resolve (a script over every Markdown link target that is not `http` or an anchor) | yes | 15 relative links, all resolve |
| `TURBO_FORCE=true pnpm check` | omitted: docs only, no package, test or config touched | — |
| Build, api-report, agent-skills, changeset, parity | omitted: nothing they read changed | — |
| Owner review of the design doc | pending (Owner gate, never ticked by an agent) | — |

## Execution log

- 2026-10-30: worktree created at `30e9606c`; `pnpm install --frozen-lockfile`; sources read; plan and design doc
  written. `pnpm format`: no fixes. Link check: 15 relative links in the two files, none broken. Pushed to
  `claude/3d-game-3d-0-design`; no PR opened.
