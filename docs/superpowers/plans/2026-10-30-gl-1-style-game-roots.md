# GL.1: `check-style` accepts role files in a game's `src/` — plan

> **Status:** Implemented and locally checked (2026-10-30); CI pending. Spec: [GL spec](../specs/2026-10-30-game-layout-by-role-design.md) §5.1,
> acceptance cases §12 A1–A11 (spec accepted under the Owner's "Auto accept all spec and plans", 2026-10-30; merged
> as #243). Owner of the change: ship (`tooling/check-style`, the root `style` script).

## Interfaces

- Consumed: `oxc-parser` (as today); the GL spec's role table.
- Produced:
  - `checkFile(file, code, options?: { gameRoot?: string }): StyleFinding[]` — with `gameRoot`, a path under it gets
    the game-root rules (§5.1); without it, today's rules (A9).
  - `checkGameRoot(dir): StyleFinding[]` — the `role-split` rule (`<role>.ts` and `<role>/` both present).
  - `StyleRule` gains `'role-split'`.
  - CLI: `node tooling/check-style/src/cli.ts <package-src>... [--game <game-src>...]`.
  - Root script: `"style": "node tooling/check-style/src/cli.ts packages/*/src --game games/*/src"`.
- `ROLES` and `DEFINE_ROLE` stay the single list; the game-root table is derived from them (role + `s` for
  component, command, event, resource, system) plus `state` → `definePlugin`. `constants`, `views`, `main` have no
  factory.

## Files

- Modify: `tooling/check-style/src/style.ts`, `tooling/check-style/src/cli.ts`, `package.json` (`style` script).
- Test: `tooling/check-style/src/style.test.ts` (A1–A9, A11), `tooling/check-style/src/cli.test.ts` (`--game`, A5
  through the CLI, A10's script shape).

## Steps

- [x] 1. Red: `style.test.ts` game-root cases A1–A9, A11 and `checkGameRoot` (A5); `cli.test.ts` `--game` cases.
      `pnpm --filter @mcthaydt/check-style test` fails on the new
      cases only (no `gameRoot` handling, no `checkGameRoot` export, `--game` treated as a directory).
- [x] 2. Green: game-root rules in `style.ts`, `--game` in `cli.ts`. Focused tests pass.
- [x] 3. Root `style` script gains `--game games/*/src`; `pnpm style` passes (A10: today's games, 0 findings).
- [x] 4. Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`. No published package changes (check-style is private
      tooling): no changeset, no api-report.

## Execution log

- 2026-10-30: baseline `node tooling/check-style/src/cli.ts games/*/src` on `main` `0a4bfe8`: 41 files, 0 findings.
- 2026-10-30 step 1: 18 new tests red for the expected reasons (role names read as unsuffixed files → `role-suffix`;
  `checkGameRoot` not exported; `--game` read as a directory, so the CLI printed nothing).
- 2026-10-30 step 2: `pnpm --filter @mcthaydt/check-style test`: 71 passed. `main/` is not a role folder (only
  `constants/` and `views/` are plain folders, §5.1's table), so `role-split` checks the six sim roles plus those two.
- 2026-10-30 step 3: `pnpm style`: 731 files, 0 findings (690 package files as before, plus the 41 game files).
- Note for the integration owner: `AGENTS.md`'s `pnpm style` bullet should say it also checks `games/*/src` with the
  game-root rules (the docs PR after #228 carries it).
- 2026-10-30 step 4: `pnpm format` clean; `TURBO_FORCE=true pnpm check`: 34 of 34 tasks successful (lint, typecheck, boundaries, style, knip, unit). check-style is private tooling, so no changeset and no api-report.
