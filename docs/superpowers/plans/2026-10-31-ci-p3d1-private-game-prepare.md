# CI.P3D1: CI's prepare of a private game (base-3d with @pixi/3d)

**Why:** #292 (M3.7b part 3b) puts `@pixi/3d` into base-3d's build. game-ci runs `automata-ship prepare`, which always prepared a public build, so the closed-beta guard (X-b) failed the job. #241's review refused `prepare --private` (a private prepare that writes `ruken.toml` makes a raw `ruken publish` a public upload), and the workflow is the Owner's, so the fix is in ship and the game's config. Spec: M3 spec §4.8, amended 2026-10-31.

**Interfaces:** `ShipConfig.audience?: 'public' | 'private'` (new, optional); `checkBuild(input)` (new export: `prepareBuild`'s checks without the write, returning the TOML); `prepareBuild` unchanged; `prepareMode(command, config)` (internal).

**Files:** `packages/ship/src/config/ship-config.ts`, `packages/ship/src/prepare/prepare-build.ts` (+ test), `packages/ship/src/prepare/prepare-mode.ts` (+ test), `packages/ship/src/cli.ts`, `games/base-3d/ship.config.ts`, the M3 spec §4.8, a patch changeset for `@mcthaydt/automata-ship`, the api report.

- [x] 1. Failing tests: `prepare-build.test.ts` "checks a private build without writing ruken.toml when asked not to write it" and "still refuses what Ruken refuses when it writes nothing"; `prepare-mode.test.ts` (three cases). Ran: `pnpm exec vitest run src/prepare` in packages/ship: the first failed on `manifestPath` being set, the second module was missing.
- [x] 2. Minimal code: `writeManifest`, `audience`, `prepareMode`, cli wiring. Ran: `src/prepare` 116/116.
- [x] 3. base-3d declares `audience: 'private'`; `pnpm --filter @af-games/base-3d build` then `automata-ship prepare` in games/base-3d prints the private message and writes no `ruken.toml`.
- [x] 4. Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm build`, `pnpm api-report --update`, `pnpm api-index`, `pnpm agent-skills`, changeset status and check-changesets.

## Execution log
- 2026-10-31: steps 1 and 2 as above.
- 2026-10-31: step 3 on main (`checked a private build; no ruken.toml written`, exit 0, no dist/ruken.toml) and on #292's head edaed00 merged with this branch, whose base-3d build carries `View3D.screenToRay:degenerate` in `dist/assets/index-*.js`: the same result.
- 2026-10-31: deviation: a first cut made `prepareBuild`'s `manifestPath` optional (`writeManifest: false`), which broke `@mcthaydt/automata-cli`'s typecheck (create-game.integration.test.ts reads it as a string). `prepareBuild`'s published signature stays as it was; the checks moved into `checkBuild`, which `prepareBuild` calls before its write.
- 2026-10-31: step 4: `pnpm format`; `TURBO_FORCE=true pnpm check` 35/35; `pnpm build`; `pnpm api-report --update` (ship.api.md: `ShipConfig.audience`); `pnpm api-index` 913 exports, 0 undocumented; `pnpm agent-skills --write`; changeset status and check-changesets after the commit.
