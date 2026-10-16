# PRODUCT.1: core seams and API reports TDD plan

- **Spec:** [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §2 F1 and F6, §9 (ownership), §10 (PRODUCT.1). Owner-approved 2026-10-16 with every recommended default.
- **Status:** drafted 2026-10-16.
- **Progress:** 9 of 10 steps.

## What exists (verified on `main` `71c3410`)

| F1 seam | Today | PRODUCT.1 does |
|---|---|---|
| `defineExtension` | `@mcthaydt/automata-runtime/extension` | Public-use test only |
| Settings schema | `SettingsDef` (Zod schema, version, migrations) and `settingsStore` in `runtime` `.` | Public-use test: a game's settings embed the new input-profile and audio-gain schemas |
| Presentation-bus events | `PresentationBus`, `RuntimeFacts`, `typedBus` in `runtime` `.` | Public-use test: game facts on the typed bus |
| Render layer | `PixiStage` `backdrop`/`world`/`ui` and the `setup` hook in `render-pixi` `.` | Public-use test |
| Post-filter slot | `PixiStage.filters`, one raw array two extensions would overwrite | `PostFilterSlot`: named, ordered entries composed into `stage.filters` |
| Host leaderboard call | Ruken SDK `LeaderboardsApi` (`session.leaderboards`), not on `Hosting` | `Hosting.leaderboards.submit/get` over the SDK |
| `NetworkPort` | Sim takes `Command`s and `restore`s snapshot bytes | The port (Context tag + interface) in `runtime` |
| Input profiles | Only base-2d's private key table; DX.2's `InputMap` is not built | `inputProfileSchema` and lookups in `runtime` |
| Audio buses | Nothing (core audio is M5) | Bus names, the gains schema and the `AudioBuses` port in `runtime` |

`runtime` and `render-pixi` are `private: true` today, so Plus cannot install them yet. Their seams are public `exports` entries in the workspace; publishing them is a follow-up (ship lane, before PRODUCT.5).

## Decisions

- **Ports, not implementations.** Each new seam is the contract the owning milestone implements: M4 implements input profiles behind devices, M5 the Web Audio graph behind `AudioBuses`, M7 `net` behind `NetworkPort`. PRODUCT.1 ships the interface, its Zod schema where settings store it, and a test that user code implements and consumes it through the public entry. No speculative implementation.
- **`NetworkPort` hot path is plain callbacks**, not Effect: commands cross it every tick and ADR 0003 forbids Effect allocation per frame. The port carries the sim's own `Command` and `Sim.snapshot()` bytes; it defines no wire format (that is `net`'s).
- **Leaderboards relay the SDK.** Types come from `@ruken/sdk` (`LeaderboardsApi`, `LeaderboardSubmitRes`, `LeaderboardGetRes`); AF redefines none. Not granted, standalone or offline fail with the SDK's code as `HostError` (`UNSUPPORTED` standalone); nothing falls back to device storage. Ruken lacks nothing here, so no Ruken request.
- **API reports read source, not `dist`.** `tooling/api-report` turns each core package's `src/**/*.ts` into declarations with TypeScript 6.0.3's `transpileDeclaration` (AF builds with `isolatedDeclarations`, so every file transpiles alone) and reads each `exports` entry's exports with the type checker, resolving aliases as DX.4 does. This covers the private `runtime` and `render-pixi` too and needs no `pnpm build`. Svelte components are listed by name (their props are a follow-up).
- **Relation to DX.4 (PR #37).** DX.4 reads the *built* `.d.ts` of published packages for documentation; the API report reads *source* of every core package for compatibility. No code is shared, so the two merge in either order; the only textual overlaps are the root `package.json` `ci:local` line, `ci.yml`'s checks job, the `docs/versions.md` 6.0.3 row and `pnpm-lock.yaml` importers (resolved by `pnpm install`). Follow-up: one extractor for both once both land.
- **Core packages** are every `packages/*` except `physics` (an extension moving to Plus, PD-1/PRODUCT.5). One committed report per package: `tooling/api-report/reports/<folder>.api.md`.
- **What a break is:** an entry point or export removed, or an export's declaration changed. Additions are not breaks. Any declaration change counts (adding a member to an interface breaks implementers).
- **Declaring a break (04, M2.4 §2):** from 1.0 a `major` changeset for the package; before 1.0 every changeset is a patch (`check-changesets.ts`), so a patch changeset naming the package with a `BREAKING:` line in its body. The rule changes with the M8 spec.
- **The release check** is `pnpm api-report` in CI's checks job and `ci:local`: reports must match source, and every break against `origin/main`'s reports must be declared. Every change that reaches a release passes it.

## Files

- **Create:**
  - `packages/host/src/leaderboards.test.ts`;
  - `packages/runtime/src/net/network-port.ts`, `network-port.test.ts`;
  - `packages/runtime/src/input/input-profile.schema.ts`, `input-profile.test.ts`;
  - `packages/runtime/src/audio/audio-buses.schema.ts`, `audio-buses.ts`, `audio-buses.test.ts`;
  - `packages/runtime/src/public-seams.test.ts`;
  - `packages/render-pixi/src/filter/post-filter-slot.ts`, `post-filter-slot.test.ts`;
  - `tooling/api-report/` (`package.json`, `tsconfig.json`, `vitest.config.ts`, `turbo.json`, `src/{core-packages,declarations,extract,report,breaks,seams,run,cli}.ts` with tests, `fixtures/`, `reports/*.api.md`);
  - `.changeset/product1-core-seams.md`.
- **Modify:** `packages/host/src/hosting.ts`, `hosting-live.ts`; `packages/runtime/src/index.ts`; `packages/render-pixi/src/renderer.ts`, `index.ts`; `tooling/release/src/check-changesets.ts` (export the front-matter reader); root `package.json`, `.github/workflows/ci.yml`, `biome.json` (fixtures), `docs/versions.md`; the PRODUCT spec (§2 seam locations), 02, 03.

## Interfaces

- **Consumed:** `@ruken/sdk` `LeaderboardsApi` via `RukenSession.leaderboards`; `@ruken/sdk-host/testing` fake leaderboards; sim `Command`, `Sim.snapshot/restore/hash`; `SettingsDef`/`settingsStore`; `PresentationBus`/`typedBus`; `PixiStage`; `publishablePackages`-style manifests; TypeScript 6.0.3 `transpileDeclaration` and checker.
- **Produced:**
  - `Hosting.leaderboards: { submit(board, score, meta?): Effect<LeaderboardSubmitRes, HostError>; get(board, query?): Effect<LeaderboardGetRes, HostError> }`.
  - `NetworkPort` tag and interface `{ onRemoteCommand, sendCommand, publishSnapshot, onSnapshot }`, `AuthoritativeSnapshot { tick, bytes, hash }`.
  - `inputProfileSchema`, `InputProfile`, `actionsForKey(profile, code)`, `actionsForPadButton(profile, index)`.
  - `AUDIO_BUS_NAMES`, `AudioBusName`, `audioBusGainsSchema`, `AudioBusGains`, `AudioBuses` tag and interface `{ input(bus), gain(bus), setGain(bus, gain) }`.
  - `createPostFilterSlot(target)`, `PostFilterSlot`, `PixiStage.postFilters`.
  - `apiReport(root, pkg)`, `renderReport`/`parseReport`, `apiBreaks(base, head)`, `undeclaredBreaks(breaks, changesets, versions)`, `SEAMS`; CLI `node tooling/api-report/src/cli.ts [--update] [--since <ref>]`: exit 0 clean, 1 stale report or undeclared break, 2 tool error.

## Steps

- [x] **1. Leaderboards.** `leaderboards.test.ts` under `HostingTest` with `leaderboards` granted: `submit` returns the fake host's answer and the host records the submit; `get` returns entries; without the grant both fail `HostError{code:'UNSUPPORTED'}`; standalone (top level) fails `UNSUPPORTED` and writes no save; offline relays the host's code; after the scope closes, `CANCELLED`. Red: `hosting.leaderboards` is undefined. Implement in `hosting.ts`/`hosting-live.ts`; green; changeset (patch, with `BREAKING:` for implementers of `Hosting`).
- [x] **2. `NetworkPort`.** `network-port.test.ts`: user code writes an in-memory port pair; a client sends commands, the authority steps its sim with the remote commands and publishes `AuthoritativeSnapshot`s; the client restores and its hash equals the authority's; an unsubscribed listener gets nothing. Red: missing module. Implement; export from `runtime` `.`; green.
- [x] **3. Input profiles.** `input-profile.test.ts`: a profile with keys, pad buttons and touch parses; `actionsForKey`/`actionsForPadButton` return the bound actions in sorted order (none for an unbound key); a pad index outside the standard mapping (0–16) and an empty action id are rejected. Red: missing module; implement; green.
- [x] **4. Audio buses.** `audio-buses.test.ts`: `audioBusGainsSchema` gives defaults of 1, clamps nothing silently (an out-of-range gain fails parse); a user-provided `AudioBuses` layer (fake nodes) is consumed by extension code through the tag. Red: missing module; implement; green.
- [x] **5. Settings, presentation bus, extension through the public barrel.** `public-seams.test.ts` imports only from `../index.js` and `../extension/index.js`: a game `SettingsDef` embedding `inputProfileSchema` and `audioBusGainsSchema` round-trips through `settingsStore` over `HostingTest` saves; a typed game fact reaches a subscriber; `defineExtension` registers. Red: the step 2–4 names are not exported from the barrel until wired (written before wiring); green.
- [x] **6. Post-filter slot.** `post-filter-slot.test.ts` (jsdom, fake filters): two ids compose by order then id; replacing an id keeps its place; remove restores `null` when empty; a removed id's remover is idempotent. Red: missing module. Implement; add `postFilters` to `PixiStage`; export; green.
- [x] **7. API extraction and reports.** `extract.test.ts` over `fixtures/repo` (a package with `.` and `./sub`, a CSS export, a Svelte re-export, a function with a body, an interface+const merge, a re-export from a sibling package): names, kinds and body-free declarations; `report.test.ts`: render then parse round-trips. Red: missing modules; implement; green.
- [x] **8. Break check.** `breaks.test.ts`: removed export, removed entry and changed declaration are breaks, an addition is not; a break is declared by a `major` changeset, or before 1.0 by a patch changeset with `BREAKING:` for that package; a changeset for another package does not declare it. Planted fixture per committed report: removing one export from each core package's report is an undeclared break. Red; implement (reusing the exported changeset reader from `check-changesets.ts`); green.
- [x] **9. CLI, committed reports, seam reachability.** `run.test.ts` on the fixture repo: a stale committed report exits 1 naming the package, `--update` writes and then exits 0, a planted undeclared break against a base exits 1. `seams.test.ts`: every F1 seam in `SEAMS` appears in its package's committed report under a public `exports` entry, and the committed reports equal freshly generated ones. Red; `pnpm api-report --update`; green. Wire `api-report` into root scripts, `ci:local` and `ci.yml`; `ci.test.ts` pins it.
- [ ] **10. Gates and bookkeeping.** `pnpm format`, `pnpm check`, `pnpm test:parity`, `pnpm test:e2e` (host and runtime changed), `pnpm api-report`; build + consumer smoke (`host` publish surface changed). Spec §2 seam locations, 02 row/follow-ups, execution record, 03 row.

## Gates

- Selected: `pnpm check`; focused package tests; `pnpm api-report`; `pnpm test:parity`; `pnpm test:e2e` (`AF_E2E_SERVER_PORT=4680`, `AF_E2E_PREVIEW_PORT=4780`); `pnpm build && node tooling/consumer-smoke/src/run.ts --from packs`.
- Omitted: `pnpm lint:actions` if docker is missing.

## Follow-ups (not built here; rows in 02)

- PRODUCT.1b: the F1 boundary test inside `automata-plus` (blocked on the Owner creating the repo, PRODUCT.5); publish `runtime` and `render-pixi` so Plus can install their seams; Svelte component props in the API report; one extractor shared with DX.4.
- PUB.1 merge order: whichever of PUB.1 and PRODUCT.1 merges second adds `leaderboards` to the web adapter (`hosting-web.ts`), failing `HostError{code:'UNSUPPORTED'}` with no fallback, plus the shared contract test.
- Codemods for majors (M8); ui screens (PRODUCT.6).

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
