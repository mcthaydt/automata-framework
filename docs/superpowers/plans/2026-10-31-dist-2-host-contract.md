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
| Create | `.changeset/dist-2-host-contract.md` (minor, `@mcthaydt/automata-host`), with the migration table of spec §11 |
| Regenerate | `packages/host` API report, `api-index`, agent skills |

## Steps (red, then green, each check run before ticking)

1. [ ] **Contract names.** `contract/contract.test.ts`: the root exports `CAPABILITIES` (Ruken's 14, in order) and
   `ERROR_CODES` (10); each payload schema parses a valid sample and rejects an invalid one;
   `SavesFlushResSchema` accepts `'device'`. Red: `CAPABILITIES` is not exported. Green: the schema files and root
   exports. `pnpm --filter @mcthaydt/automata-host exec vitest run src/contract`.
2. [ ] **Hosting on AF's types.** Move `hosting.ts` and `errors.ts` into `contract/` and point them, `rounds.ts` and
   `fake-web-page.ts` at the contract. Red: `grep -rn "@ruken/" src/contract src/rounds.ts src/testing/fake-web-page.ts`
   finds imports. Green: none; `pnpm --filter @mcthaydt/automata-host typecheck`.
3. [ ] **Conformance.** `ruken/conformance.test.ts` (`expectTypeOf`): AF's `Capability` and `ErrorCode` equal Ruken's;
   every Ruken payload type is assignable to AF's; AF's request types (`RoundOutcome`, `LeaderboardSubmitMeta`,
   `LeaderboardQuery`, `PauseBehavior`) are assignable to Ruken's. Red first by temporarily dropping `links` from
   `CAPABILITIES` (typecheck fails), then restored.
4. [ ] **Adapters into folders.** The moves of the Files table; `toHostError` into `ruken/errors-ruken.ts`. The
   whole host suite passes unchanged in behavior. `pnpm --filter @mcthaydt/automata-host test`.
5. [ ] **`persisted: 'device'`.** In `web/hosting-web.test.ts`, a pinned test "flush answers device on the web adapter".
   Red: it answers `host-outbox`. Green: the web adapter answers `device`; the contract suite accepts
   `host-outbox | server | device`.
6. [ ] **The root is target-neutral.** `index.test.ts` expects the contract names, `HOST_EXIT_CAP` and the markers,
   and no `HostingLive`, `makeHosting` or `toHostError`. Red: those three are still exported. Green: `index.ts`.
7. [ ] **Conditions.** `target.build.test.ts`: a build with no AF condition holds no Ruken SDK marker and holds the web
   adapter; an `automata-ruken` build holds the markers. Red: the default build holds the markers. Green:
   `package.json` `exports`/`publishConfig` and `tsdown.config.ts`. Then run every Vitest suite that boots through
   `./target` (`pnpm turbo run test:unit`), and add `automata-ruken` to each Ruken build or test config that now
   resolves to the web adapter, recording each in the log.
8. [ ] **Consumers.** Point `examples/content/hot-reload` and the consumer-smoke fixtures at `./target`.
9. [ ] Changeset (minor) with the migration note; `pnpm api-report --update`, `pnpm api-index`, `pnpm agent-skills
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
