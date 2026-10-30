# GL.1b: `check-boundaries --game`, `automata check` and the plugin hook find either layout — plan

> **Status:** Implemented and locally checked (2026-10-30); CI pending. Spec: [GL spec](../specs/2026-10-30-game-layout-by-role-design.md) §4.5,
> §5.2, §5.3; acceptance cases §12 B1–B7 (spec accepted under the Owner's "Auto accept all spec and plans",
> 2026-10-30; merged as #243). Owner: ship (`tooling/check-boundaries`, `packages/cli`'s `boundaries` step; the hook
> `agents/automata/scripts/check.mjs` with the integration owner's review, which the coordinator is).

## Interfaces

- Produced:
  - `tooling/check-boundaries`: `GAME_SIM_ROLES` (the seven roles of §4.5) and `collectGameSimSet(src): string[]`
    in `files.ts` (each role as `<role>.ts` or every source under `<role>/`, plus `sim.ts`); `CheckOptions.simSet?:
    ReadonlySet<string>` (resolved paths): a relative value import from a sim file must resolve to a file in it,
    else `import` "the sim imports ./views.ts, which is outside the sim (constants, components, commands, events,
    resources, systems, state, sim.ts)". Type-only imports stay exempt.
  - CLI: `automata-check-boundaries [--inline] [--allow-import <spec>]... <root>... [--game <src>...]`; a game root
    with no sim files exits 2 ("no sim files in <src> (constants.ts, components.ts, …, sim.ts)").
  - `packages/cli` `boundariesStep`: `src/sim` when it exists, `--game src` when a sim role file or folder exists
    in `src/`, both in one run when both exist, and a tool error naming both layouts when neither does.
  - The hook's `isSimFile`: `src/sim/`, `src/sim.ts`, `src/<role>.ts` and anything under `src/<role>/` for the
    seven roles.
- The role list has one owner, check-boundaries (`GAME_SIM_ROLES`). The cli step and the hook cannot import it
  (the package is a bin with no library entry, and the hook is a dependency-free script), so each keeps a copy with
  a comment naming the owner; their tests pin the same seven names.
- Published: `@mcthaydt/automata-check-boundaries` patch changeset. The package exports no API (bin only), so no
  api-report change. `packages/cli` is private: no changeset.

## Files

- Modify: `tooling/check-boundaries/src/{files,check,cli}.ts`, `packages/cli/src/check/check-steps.ts`,
  `agents/automata/scripts/check.mjs`; create `.changeset/gl-1b-boundaries-game.md`.
- Test: `tooling/check-boundaries/src/cli.test.ts` (B1–B5, which exercise `simSet` end to end),
  `packages/cli/src/check/run-check.test.ts` (B6), `tooling/agent-skills/src/hook.test.ts` (B7).

## Steps

- [x] 1. Red: B1–B7 tests fail for the expected reasons.
- [x] 2. Green: check-boundaries `--game` and the sim set.
- [x] 3. Green: `boundariesStep` and the hook.
- [x] 4. Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm build`, `pnpm api-report`, the changeset checks,
      `pnpm boundaries` unchanged.

## Execution log
- 2026-10-30 step 1: red for the expected reasons: B1–B5 (5 tests) because `--game` was read as a directory; B6
  (9 tests) because `boundariesStep` only knew `src/sim`; B7 (9 tests) because `isSimFile` only matched `src/sim/`.
- 2026-10-30 step 2: check-boundaries 87/87.
- 2026-10-30 step 3: `packages/cli` check tests 47/47; agent-skills 94/94. First green attempt of the hook failed
  every case: `SIM_ROLES` was declared below the top-level code that calls `isSimFile` (temporal dead zone), so it
  moved to the top of the script.
- 2026-10-30 step 4: first `pnpm check` red on check-boundaries' typecheck (TS9010, `GAME_SIM_SET_NAMES` needs an
  explicit type under `isolatedDeclarations`); fixed. Then `TURBO_FORCE=true pnpm check` all tasks successful;
  `pnpm build` 0; `pnpm api-report`: 0 breaks, 0 undeclared; `pnpm boundaries` unchanged (65, 2 and 52 files, 0
  findings); `check-changesets`: 0 problems; `changeset status --since=origin/main` passes once the changeset is
  committed.
