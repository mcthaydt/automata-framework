# DIST.4 plan: the AF fake host in `testing`

> Row: DIST.4 in [02](../../02-master-delivery-plan.md). Spec:
> [DIST spec](../specs/2026-10-31-dist-target-neutral-design.md) §7, acceptance DIST-c (the contract suite on
> `FakeHosting`) and DIST-d (no fallback). Lane: testing. Stacked on DIST.2 (`claude/dist-2-host-contract`, #321).
> Strict TDD (`packages/`, `games/`).

## Scope

**In:** `FakeHosting` and its control handle; the host contract suite exported so `testing` runs it on all four fake
targets; a runtime seam that lets a test boot a game on any `Hosting` (`seams.hosting`), replacing the need for
Ruken's `sdkEnv` in target-neutral tests; the two game-level boot suites that only need a host, not Ruken's
behavior (`games/emberwick` screens, `packages/game` `startGame`), moved onto `FakeHosting`.

**Out, to DIST.3** (it adds the `platform-imports` rule that forces each of them): the remaining `runtime` and
`game` tests that drive Ruken-only behavior through `@ruken/sdk-host` (`host.bridge.*`, `host.fakes.server.*`:
conflicts, remote writes, overlays, the hosted handshake). They either switch to `FakeHosting` or move under a
`ruken/` folder, test by test. `RuntimeTest` keeps `HostingTest` until then; the runtime's `sdkEnv` seam and the root
`HostingSeams` type go when the last caller does.

## Consumed and produced interfaces

- **Produces** `@mcthaydt/automata-testing/host`:
  - `fakeHosting(options?: FakeHostingOptions): { control: FakeHostControl; make(hosting: HostingOptions): Effect<Hosting, HostError, Scope> }`
  - `FakeHosting(options?: FakeHostingOptions, hosting?: HostingOptions): Layer<Hosting | FakeHostControl>`
  - `FakeHostControl` (a `Context.Tag` and its interface): `welcome`, `failReady`, `push.*` (schema-checked),
    `saved`, `failNext`, `hold`/`release`, `tracked`, `exits`, `fullscreen`, `rounds`, `submits`, `requestMenu`,
    `close`.
  - `FakeHostingOptions`: `target` (`'web' | 'itch' | 'ruken' | 'tauri'`, default `'web'`), `granted`, `deferReady`,
    `player`, `locale`, `title`, `saves` (seed), `consent`, and the initial observed values.
- **Produces** `@mcthaydt/automata-host/contract-suite`: `describeHostingContract(name, layer, settled)` (today's
  internal `testing/hosting-contract.ts`, unchanged), with `vitest` an optional peer of `host`.
- **Produces** `RuntimeSeams.hosting?: (options: HostingOptions) => Effect<Hosting, HostError, Scope>`: boot uses it
  in place of `./target`'s `makeHosting` when given.
- **Consumes:** the DIST.2 contract (`@mcthaydt/automata-host`), `effect`.

## Files

| Action | Path |
|---|---|
| Create | `packages/testing/src/host/fake-hosting.ts`, `host/target-grants.ts`, `host/index.ts`, `host/fake-hosting.test.ts`, `host/fake-hosting.contract.test.ts` |
| Modify | `packages/testing/package.json` (`./host` export and publish entry; `@mcthaydt/automata-host` and `effect` dependencies), `packages/testing/tsdown.config.ts` (if entries are listed) |
| Move | `packages/host/src/testing/hosting-contract.ts` → `packages/host/src/contract-suite.ts`; `package.json` `./contract-suite`, `tsdown.config.ts`, optional peer `vitest` |
| Modify | `packages/runtime/src/boot/game-definition.ts`, `boot/boot-program.ts`, a test in `boot/run-game.test.ts` |
| Modify | `games/emberwick/src/screens/screens.dom.test.ts`, `packages/game/src/start-game.test.ts` (onto `FakeHosting`), their `package.json` dev dependencies |
| Create | `.changeset/dist-4-fake-host.md` (patch: `host`, `testing`, `runtime`) |

## Steps

1. [x] **The contract suite is public.** Move it to `host/src/contract-suite.ts` and export `./contract-suite`.
   Red: `packages/testing/src/host/fake-hosting.contract.test.ts` imports it and fails to resolve. Green: the export.
   (Its own first red is then the missing `FakeHosting`.)
2. [x] **`FakeHosting` passes the contract on each target.** The contract test runs the suite for `web`, `itch`,
   `ruken` and `tauri`. Red: no `./host` entry. Green: `fake-hosting.ts`.
3. [x] **Target behavior (spec §4.3), one test per row** in `fake-hosting.test.ts`: kind, hostName and default grants
   per target; ungranted `saves` fails `DENIED` (`web`, `itch`, `tauri`) or `UNSUPPORTED` (`ruken`) and the seeded
   map is untouched (DIST-d); `exit` granted only on `tauri` (and `ruken` when wanted); `flush` answers `device` off
   Ruken; `track` records only disclosed events with consent and `analytics.custom`. Each red first.
4. [x] **Control (spec §7):** `deferReady` + `welcome()`; `failReady(code)`; `push.*` rejects an invalid payload
   (Zod) and delivers a valid one; `failNext`; `hold`/`release` with a `TestClock` timeout in the caller; `requestMenu`
   answers false before ready and the latest handler after; `close()` runs the exiting handlers in order, then the
   flush, within `HOST_EXIT_CAP`. Each red first.
5. [x] **Runtime seam.** `run-game.test.ts`: a game booted with `seams.hosting` from `fakeHosting({ target: 'itch' })`
   reaches its entry screen and its `Hosting.hostName` is `itch.io`. Red: the seam is ignored (the Ruken adapter
   under the unit project's condition). Green: `boot-program.ts` uses the seam.
6. [x] **Games and `startGame` on `FakeHosting`.** Emberwick's screens test and `startGame`'s tests boot on
   `seams.hosting`; no `@ruken/sdk-host` import left in them. They pass unchanged in what they assert.
7. [x] Changeset; `pnpm api-report --update`, `api-index` (cheatsheet if stale), `agent-skills --write`.
8. [ ] Gates, adversarial re-read, one push, draft PR stacked on #321.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `api-report`; `api-index`; `agent-skills`;
`changeset status`; `check-changesets`; `pnpm build && node tooling/consumer-smoke/src/run.ts --from packs` (new
published entries); focused E2E: none (no build or example changes), recorded as omitted. Parity: omitted (no sim,
renderer, ui or golden).

## Execution log

- 2026-10-31: plan written on `claude/dist-2-host-contract` `cfb2cf0b`.
- Step 1: `hosting-contract.ts` moved to `host/src/contract-suite.ts`, published as `./contract-suite` (documented for
  `api-index`), `vitest` an optional peer of `host`. Red: `fake-hosting.contract.test.ts` resolved the suite and failed
  on the missing `./index` (`FakeHosting`).
- Step 2: green, 64 cases (16 contract cases on each of the four targets). First run: the round-end case timed out
  on all four with `Effect.yieldNow()` as `settled` (the forked reader had not subscribed); `settled` is one macrotask,
  as the web adapter's run uses.
- Steps 3 and 4: 25 cases in `fake-hosting.test.ts`. **Deviation:** `fake-hosting.ts` was written whole in step 2, so
  these tests came after the code. To show they catch faults, two mutations: `ungrantedCode` always `UNSUPPORTED` failed
  the three DIST-d cases, and ignoring `consent` failed the consent case; both restored, 89/89. The exit-order case was
  racy on its first run (one `yieldNow`), and was rewritten to wait one macrotask and assert that the exit is parked on
  the held flush after the handler ran.
- Step 5: red ("expected 'ready' not to be 'ready'": boot ignored the seam and used the Ruken adapter), then green; the
  runtime's `run-game.test.ts` 22/22 and `svelte-check` clean.
- Step 6: Emberwick's screens 8/8 on `FakeHosting`, with the `automata-ruken` condition removed from its dom project (it
  no longer boots through `./target`); `rounds()` maps `control.rounds` to the same `{ kind, outcome }` the assertions
  used. `startGame` 4/4: the "hello reached the host" assertion became "boot asked the fake host for `start-test`".
- Step 7: changeset (patch: `testing`, `host`, `runtime`). `knip.jsonc` drops `zod` from `packages/host`'s
  `ignoreDependencies` (knip's hint: the contract now imports it).
- Gates: `pnpm format`; `TURBO_FORCE=true pnpm check`: lint, typecheck (37), boundaries, style and knip pass;
  `test:unit` failed only on the stale API report (expected). After `pnpm build`, `api-report --update`, the doc comment
  `api-index` asked for, `pnpm cheatsheet` and `agent-skills --write`: `api-index` and `agent-skills` clean,
  `pnpm test:unit` 35/35, `changeset status`, `check-changesets` (30, 0 problems), consumer smoke from packs passed.
  Omitted: E2E (no build, example or Vite config change outside tests), parity (no sim, renderer, ui or golden).
- Merged #321 (its `BREAKING:` changeset and `main`). `main` brought `games/base-3d`'s screens test, which booted
  over Ruken's fake host: it moves onto `FakeHosting` through `seams.hosting`, as Emberwick's did, and loses the
  `automata-ruken` condition #321 had given its dom project, and its unused `@ruken/sdk-host` dev dependency (3D lane's
  files): 71/71. `pnpm check` passes (lint, typecheck, boundaries, style, knip, `test:unit`); `pnpm build`; the plain
  `pnpm api-report`: 9 breaks, 0 undeclared; `api-index`, `agent-skills` and `check-changesets` clean.
