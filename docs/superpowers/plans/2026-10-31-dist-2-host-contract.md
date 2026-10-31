# DIST.2 plan: `host` owns the contract; the Ruken adapter maps it

> Row: DIST.2 in [02](../../02-master-delivery-plan.md). Spec:
> [DIST spec](../specs/2026-10-31-dist-target-neutral-design.md) §4, §5.2 (host rows), §5.3, §7 (contract suite), §11,
> acceptance DIST-a and DIST-c (Ruken and web adapters; Tauri and `FakeHosting` join in DIST.5 and DIST.4).
> Lane: host. Stacked on DIST.1 (`claude/dist-1-spec`, #317). Strict TDD (`packages/`).

## Consumed and produced interfaces

- **Produces** (root `@mcthaydt/automata-host`): `CAPABILITIES`, `Capability`, `ERROR_CODES`, `ErrorCode`,
  `PauseBehavior`, `LifecycleReason`, `LifecyclePayload`, `InputMode`, `InputModePayload`, `DisplayMetricsPayload`,
  `FullscreenRes`, `AudioChange`, `SavesStatus`, `SavesFlushRes` (adds `'device'`), `SavesChangedPayload`,
  `EntitlementsPayload`, `LeaderboardSubmitMeta`, `LeaderboardQuery`, `LeaderboardSubmitRes`, `LeaderboardGetRes`,
  `RoundOutcome`, and one Zod schema per payload (`*Schema`); `Hosting.kind` adds `'tauri'`; `HOST_EXIT_CAP` moves to
  the contract.
- **Removed from the root** (moved to `./target`, where the build's condition picks the adapter): `HostingLive`,
  `makeHosting`. `toHostError` leaves the public API (the Ruken adapter's internal mapping). `HostingSeams` stays a
  root type until DIST.4 replaces the runtime's `sdkEnv` seam with `FakeHosting`.
- **`./target` conditions:** `automata-ruken` → the Ruken adapter; `automata-web` and `default` → the web adapter.
- **Consumes:** the vendored `@ruken/sdk` (types, in `ruken/` only), `effect`, `zod`.

## Files

| Action | Path |
|---|---|
| Create | `packages/host/src/contract/{capability,error-code,lifecycle,input-mode,display,audio,saves,entitlements,leaderboards,round}.schema.ts`, `contract/contract.test.ts` |
| Move | `src/hosting.ts` → `src/contract/hosting.ts`; `src/errors.ts` → `src/contract/errors.ts` (without `toHostError`) |
| Move | `src/hosting-live.ts` → `src/ruken/hosting-ruken.ts`; `toHostError` → `src/ruken/errors-ruken.ts`; `src/target-ruken.ts` → `src/ruken/target.ts`; the Ruken-only tests (`errors`, `handshake`, `leaderboards`, `requests`, `saves`, `shutdown`, `standalone`, `state`, `test-host-origin`, `vendor`) → `src/ruken/`; `src/testing/hosting-test.ts` → `src/testing/ruken/hosting-test.ts` |
| Move | `src/hosting-web.ts` → `src/web/hosting-web.ts`; `src/target-web.ts` → `src/web/target.ts`; `src/hosting-web.test.ts` → `src/web/hosting-web.test.ts` (web cases) and `src/ruken/hosting-ruken.contract.test.ts` (the contract suite on the Ruken adapter) |
| Create | `src/ruken/conformance.test.ts` |
| Modify | `src/index.ts`, `src/index.test.ts`, `src/rounds.ts`, `src/testing/fake-web-page.ts` (local `StorageLike`), `src/testing/hosting-contract.ts`, `src/target.build.test.ts`, `package.json` (`exports`, `publishConfig`), `tsdown.config.ts` |
| Modify (consumers of the moved root exports and of the default condition) | `examples/content/hot-reload/main.ts`, `tooling/consumer-smoke/fixtures/{web/main.ts,types.ts}`, the Ruken builds' Vite configs (`games/*/vite.config.ts`) and the Vitest configs whose tests boot through `./target`, which add `automata-ruken` (found by step 7's run) |
| Create | `.changeset/dist-2-host-contract.md` (`patch`, `@mcthaydt/automata-host`; see the log), with the migration table of spec §11 |
| Regenerate | `packages/host` API report, `api-index`, agent skills |

## Steps (red, then green, each check run before ticking)

1. [x] **Contract names.** `contract/contract.test.ts`: the root exports `CAPABILITIES` (Ruken's 14, in order) and
   `ERROR_CODES` (10); each payload schema parses a valid sample and rejects an invalid one;
   `SavesFlushResSchema` accepts `'device'`. Red: `CAPABILITIES` is not exported. Green: the schema files and root
   exports. `pnpm --filter @mcthaydt/automata-host exec vitest run src/contract`.
2. [x] **Hosting on AF's types.** Move `hosting.ts` and `errors.ts` into `contract/` and point them, `rounds.ts` and
   `fake-web-page.ts` at the contract. Red: `grep -rn "@ruken/" src/contract src/rounds.ts src/testing/fake-web-page.ts`
   finds imports. Green: none; `pnpm --filter @mcthaydt/automata-host typecheck`.
3. [x] **Conformance.** `ruken/conformance.test.ts` (`expectTypeOf`): AF's `Capability` and `ErrorCode` equal Ruken's;
   every Ruken payload type is assignable to AF's; AF's request types (`RoundOutcome`, `LeaderboardSubmitMeta`,
   `LeaderboardQuery`, `PauseBehavior`) are assignable to Ruken's. Red first by temporarily dropping `links` from
   `CAPABILITIES` (typecheck fails), then restored.
4. [x] **Adapters into folders.** The moves of the Files table; `toHostError` into `ruken/errors-ruken.ts`. The
   whole host suite passes unchanged in behavior. `pnpm --filter @mcthaydt/automata-host test`.
5. [x] **`persisted: 'device'`.** In `web/hosting-web.test.ts`, a pinned test "flush answers device on the web adapter".
   Red: it answers `host-outbox`. Green: the web adapter answers `device`; the contract suite accepts
   `host-outbox | server | device`.
6. [x] **The root is target-neutral.** `index.test.ts` expects the contract names, `HOST_EXIT_CAP` and the markers,
   and no `HostingLive`, `makeHosting` or `toHostError`. Red: those three are still exported. Green: `index.ts`.
7. [x] **Conditions.** `target.build.test.ts`: a build with no AF condition holds no Ruken SDK marker and holds the web
   adapter; an `automata-ruken` build holds the markers. Red: the default build holds the markers. Green:
   `package.json` `exports`/`publishConfig` and `tsdown.config.ts`. Then run every Vitest suite that boots through
   `./target` (`pnpm turbo run test:unit`), and add `automata-ruken` to each Ruken build or test config that now
   resolves to the web adapter, recording each in the log.
8. [x] **Consumers.** Point `examples/content/hot-reload` and the consumer-smoke fixtures at `./target`.
9. [x] Changeset (minor) with the migration note; `pnpm api-report --update`, `pnpm api-index`, `pnpm agent-skills
   --write` (and `pnpm cheatsheet` if stale).
10. [ ] Gates (below), adversarial re-read of the diff, push, draft PR stacked on #317.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `pnpm api-report`; `pnpm api-index`; `pnpm agent-skills`;
`pnpm changeset status --since=origin/main`; `node tooling/release/src/check-changesets.ts`;
`pnpm build && node tooling/consumer-smoke/src/run.ts --from packs` (build config changed); `pnpm build:examples`,
`pnpm build:demos` (an example changed); focused E2E: the placeholder's and Emberwick's Ruken journeys (their Vite
configs gain a condition). Parity: not affected (no sim, renderer, ui or golden change), recorded as omitted.

## Execution log

- 2026-10-31: plan written on `claude/dist-1-spec` `81375192`.
- Step 1: red 19/19 (`CAPABILITIES` undefined), then green 19/19 after the ten `contract/*.schema.ts` files (interface
  plus `z.ZodType<…>`-annotated schema, the repo's pattern under `isolatedDeclarations`; `LeaderboardQuery` uses Zod's
  `exactOptional()` to match the SDK's optional keys under `exactOptionalPropertyTypes`).
- Step 2: `contract/hosting.ts` and `contract/errors.ts` import only the contract and `effect`; `HOST_EXIT_CAP` moved
  into `contract/hosting.ts` (both adapters' exits use it). `rounds.ts` and `testing/fake-web-page.ts` on AF types;
  the web adapter defines its own `StorageLike`.
- Step 3: `ruken/conformance.test.ts` is type-level (`expectTypeOf`, checked by `tsc`) because the SDK exports
  `CAPABILITIES`/`ERROR_CODES` only as types. Red: with `links` dropped from `CAPABILITIES`, `tsc` fails in the
  conformance test (TS2344); restored, clean.
- Step 4: the moves of the Files table. Host suite 18 files, 161 tests pass. The Ruken adapter's contract run moved to
  `ruken/hosting-ruken.contract.test.ts` so `web/` imports no `@ruken/*`.
- Step 5: red ("flush answers 'device'": got `host-outbox`), then green.
- Step 6: red (the old list), then green with the contract names and no adapter. **Deviation:** `HostingSeams` stays
  a root *type* re-export (from `ruken/hosting-ruken.ts`), because the runtime's `sdkEnv` seam needs it until DIST.4;
  the web adapter's `makeHosting` now takes `_seams?: unknown`.
- Step 7: red ("no AF condition" bundle held the Ruken markers), then green with `default` → web. The run of every
  suite that boots through `./target` found these Ruken builds and tests, each now with `automata-ruken` (and a red
  test first where a config test exists): `packages/runtime` and `packages/game` (unit project: 16 and 20 failures
  before, 564 and 207 passing after), `games/emberwick` (dom project: 3 failures before, 8 passing after),
  `games/emberwick` and `games/placeholder` Vite builds (new "builds for the ruken target" tests, red then green),
  `games/base-3d/vite.config.ts` (3D lane's file, two lines; its Vitest run fails at startup on `main` too, so no config
  test there), the examples runner's plugin (red then green), the playground runtime build (new
  `playground-vite-config.test.ts`, red then green), `examples/content/hot-reload` and the consumer-smoke Ruken
  fixtures.
- Step 8: `examples/content/hot-reload` and the consumer-smoke fixtures import `HostingLive`/`makeHosting` from `./target`.
- Step 9: **Deviation:** the changeset is `patch`, not the spec's "minor": `.changeset/README.md` and
  `check-changesets` require `patch` for every changeset before 1.0. API report, cheatsheet and agent skills
  regenerated.
- Gates: `pnpm format`; `TURBO_FORCE=true pnpm check`: lint, typecheck (37 tasks), boundaries, style and knip pass;
  `test:unit` first failed on the stale API report (expected), and `examples-runner`'s `audio-sound` parity replay
  failed once at 5.6 s under the parallel run (first-attempt evidence; it passed alone and in its package's full run,
  21 files and 110 tests); after `pnpm api-report --update`, `pnpm test:unit` 35/35. `pnpm build`, `api-report`,
  `api-index`, `agent-skills` pass after `pnpm cheatsheet` and `agent-skills --write`. `changeset status` and
  `check-changesets` (29 changesets, 0 problems). Consumer smoke from packs passed (14 steps, including one Ruken SDK
  in the Ruken bundles and none in the web bundle). `build:examples` and `build:demos` pass. E2E (Chromium): placeholder
  and base-2d 12/12; demos, examples and playground-frame-chromium 84 passed, 1 skipped (the runner's pending
  `core-later` fixture, skipped by design). Parity omitted: no sim, renderer, ui or golden changed.
- CI on `cfb2cf0b` failed `pnpm api-report`: 8 API breaks of `host` against `main`, undeclared. The local gate had run
  only `api-report --update`, which rewrites the reports and does not check declarations; the plain `pnpm api-report`
  does. Fixed: the changeset's breaking note is a `BREAKING:` line naming each break and its replacement; `main`
  merged in; `pnpm api-report`: 8 breaks, 0 undeclared. After the merge, `games/base-3d`'s new screens test (from
  `main`) boots over Ruken's fake host, so its dom project gets the `automata-ruken` condition as Emberwick's did
  (3 failures before, 71 tests passing after). `pnpm check` gates re-run: lint, typecheck (37), boundaries, style,
  knip and `test:unit` (35/35) pass; `check-changesets` 0 problems.
