# PUB.1: web adapter and `./target` TDD plan

- **Spec:** [PUB spec](../specs/2026-10-16-publish-targets-design.md) §3, §3.1, §7 (unit and build rows), §8, §12 PUB-a; [ADR 0005](../../adr/0005-publish-targets.md); [M1 shared contracts](../specs/2026-10-11-m1-shared-contracts-design.md) §1 (contract owner: host lane).
- **Status:** PUB.0 Owner-approved 2026-10-16 with every recommended default. Lane `pub1`, branch `claude/clever-pasteur-ujmu6e-pub1`.
- **Progress:** 10 of 10 steps; implemented and locally verified 2026-10-16. Owner review of the PR pending.
- **Out of scope:** the "Back to …" label (PUB.4), `ship --target itch` and the `automata build --target` switch (PUB.2), the itch-like harness and placeholder E2E (PUB.3). The default target stays `ruken`.

## Global constraints

- **Strict TDD** in `packages/`: a failing test first, run, confirm the failure reason, minimal change, green.
- **The web adapter imports `@ruken/sdk` as types only.** No module it reaches may import an SDK value, so an `automata-web` bundle holds no SDK code.
- **No AF copy of a Ruken limit.** The web adapter does not re-implement Ruken's save-key pattern or per-save quotas; the browser's own quota gives `QUOTA_EXCEEDED`.
- **Gates:** `pnpm format`, `pnpm check`, `pnpm test:parity`, `pnpm test:e2e` (the runtime's boot import changes), and `pnpm build && node tooling/consumer-smoke/src/run.ts --from packs` (exports change). Changeset: `@mcthaydt/automata-host` patch (`@mcthaydt/automata-runtime` is private, so `check-changesets` refuses it).

## Files

- **Create:**
  - `packages/host/src/hosting-web.ts`: the web adapter, `makeWebHosting(options, page, target)` and `makeHosting` over the real `window`.
  - `packages/host/src/target-ruken.ts`, `packages/host/src/target-web.ts`: the two `./target` entries, each exporting `makeHosting` and `HostingLive`.
  - ~~`packages/host/src/to-host-error.ts`~~: not needed (see the execution log, step 5).
  - `packages/host/src/sdk-markers.ts`: `RUKEN_SDK_MARKERS` and `findRukenSdkMarkers(code)`.
  - `packages/host/src/testing/fake-web-page.ts` (internal, not exported): an `EventTarget`-based page for Node tests.
  - `packages/host/src/testing/hosting-contract.ts` (internal): the contract cases both adapters run.
  - Tests: `hosting-web.test.ts`, `sdk-markers.test.ts`, `target.build.test.ts` (one real Vite build per condition of a tiny entry under `src/testing/fixtures/target-bundle/`).
- **Modify:**
  - `packages/host/src/hosting.ts`: `kind: 'ruken' | 'standalone' | 'web'`, new `hostName`.
  - `packages/host/src/hosting-live.ts`: `hostName: 'Ruken'`.
  - `packages/host/src/errors.ts`, `index.ts`, `index.test.ts`.
  - `packages/host/package.json` (`./target` in `exports` and `publishConfig.exports`, `vite` devDependency), `packages/host/tsdown.config.ts` (two more entries).
  - `packages/runtime/src/boot/boot-program.ts`: `makeHosting` from `@mcthaydt/automata-host/target`.
  - `tooling/consumer-smoke/src/run.ts`, `fixtures/web-target/`: an `automata-web` build of the packed packages has no SDK marker.
  - Docs: shared contracts §1, PUB spec §3 (how web knows itch.io), 02, 03.

## Interfaces

- **Consumed:** `Hosting`, `HostingOptions`, `HostingSeams`, `HostError` (host); `@ruken/sdk` types only (`Capability`, `LifecyclePayload`, `InputModePayload`, `DisplayMetricsPayload`, `FullscreenRes`, `StorageLike`, …).
- **Produced:**
  - `Hosting.kind: 'ruken' | 'standalone' | 'web'` and `Hosting.hostName: string` (`'Ruken'`, `'itch.io'`, `'this page'`).
  - `@mcthaydt/automata-host/target`: `makeHosting(options, seams?)` and `HostingLive(options, seams?)`, same signatures on both conditions. `automata-web` resolves to the web adapter, `default` to the Ruken adapter.
  - The build-time define `__AUTOMATA_TARGET__` (`'itch'` or `'web'`), read only by the web adapter for `hostName`; PUB.2's build sets it with `resolve.conditions: ['automata-web']`.
  - `RUKEN_SDK_MARKERS` and `findRukenSdkMarkers(code): string[]` from `@mcthaydt/automata-host`, for PUB.2/PUB.3's itch build checks.

## Steps

- [x] **1. `kind` and `hostName` on the Ruken adapter.** In `handshake.test.ts`, assert `hosting.hostName === 'Ruken'` for hosted and standalone sessions. Run `pnpm --filter @mcthaydt/automata-host test`; expect a typecheck-free runtime failure (`undefined` is not `'Ruken'`). Add the field to `Hosting` and `hosting-live.ts`; green.
- [x] **2. Web adapter, contract suite on both adapters.** Write `testing/hosting-contract.ts` (ready, player, locale, saves round trip, flush, `savesStatus`, observed values start with the current one, round/track never fail, menu/exiting handlers register in a scope, shut-down calls fail `CANCELLED` and streams end) and run it in `hosting-web.test.ts` against `HostingTest` and the web adapter on `fake-web-page.ts`. Expect failure: `hosting-web.ts` does not exist. Implement `makeWebHosting`; green.
- [x] **3. Web-only behavior.** In `hosting-web.test.ts`: visibility and focus drive `lifecycle` with reasons; pointer/touch/keyboard/gamepad events drive `input`; viewport and orientation drive `display`; `setFullscreen` uses the Element Fullscreen API and reports `support: 'element'`, or `'none'` without it; `hostName` is `'itch.io'` for the itch target and `'this page'` for web; saves live under `ruken:<gameId>:`; the probe key is not `ruken:__probe__`. Each fails first, then passes.
- [x] **4. Pinned differences, one test each:** `exit fails UNSUPPORTED`; `blocked storage probe: saves not granted, every call fails DENIED`; `QUOTA_EXCEEDED from a full origin quota`; `no handshake wait: ready without advancing the TestClock`; plus `no AF copy of Ruken save limits` (spec §9 request 4). Each fails first, then passes.
- [x] **5. No SDK value in the web adapter's graph.** ~~Move `toHostError` to `to-host-error.ts`~~ (dropped: step 6's build and the consumer smoke show the SDK tree-shaken out of web bundles without it); `index.test.ts` keeps the same export list plus `RUKEN_SDK_MARKERS`/`findRukenSdkMarkers`. `sdk-markers.test.ts`: fixtures with and without each marker. Expect failure: module missing. Implement; green.
- [x] **6. `./target` and the real bundle check.** `target.build.test.ts` builds the fixture entry (imports `Hosting`/`HostError` from `.` and `makeHosting` from `./target`, as the runtime does) with Vite twice: with `resolve.conditions: ['automata-web']` it has no marker and contains the web probe key; with defaults it has both markers. Expect failure: `./target` not exported. Add the exports and entries; green.
- [x] **7. Runtime boot uses `./target`.** Change `boot-program.ts`'s `makeHosting` import; runtime unit tests and typecheck stay green (default condition = Ruken).
- [x] **8. Published build.** `tsdown.config.ts` gains `target` and `target-web`; `publishConfig.exports['./target']` maps `automata-web` and `default` to their `dist` files. Consumer smoke gains a step: a Vite build of the packed packages with `automata-web` has no SDK marker, and the existing default bundle step still finds exactly one SDK. Run `pnpm build`, `pnpm --filter @mcthaydt/release test:dist`, and consumer smoke from packs.
- [x] **9. Contract text.** Shared contracts §1: two adapters, `kind`, `hostName`, `./target`. PUB spec §3: the `__AUTOMATA_TARGET__` define. Changeset (host, patch).
- [x] **10. Gates.** `pnpm format`, `pnpm check`, `pnpm test:parity`, `pnpm test:e2e` (ports 4640/4740), consumer smoke from packs. Record counts in 02, 03 and below.

## What later tasks reuse

- **PUB.2:** `automata build --target itch|web` adds `resolve.conditions: ['automata-web']` and `define: { __AUTOMATA_TARGET__: '"itch"' }`, and can fail an itch build with `findRukenSdkMarkers` over its JavaScript.
- **PUB.3:** the placeholder still imports `@ruken/sdk` directly (`examples/placeholder/src/boot.ts`), so its itch build needs it to boot through `@mcthaydt/automata-host/target` before the "no marker" build row can pass on it.
- **PUB.4:** `hostName` and `granted.has('exit')` drive "Back to …".

## Execution log

| Step | Date | Evidence |
|---|---|---|
| 1 | 2026-10-16 | Red: `handshake.test.ts` 2 failed (`expected undefined to be 'Ruken'`). Green 9/9; `tsc` clean. `4d6f11a` |
| 2 | 2026-10-16 | Red: `Cannot find module './hosting-web'`. Green: 24 contract cases (12 per adapter). `8f7172f` |
| 3 | 2026-10-16 | Red: 7 failed (lifecycle, input, coarse pointer, display, fullscreen enter, fullscreen refused, track warning). Passed on first run, kept as pins of step 2's code: `hostName`, locale/player, granted set, `support: 'none'`, the `ruken:<gameId>:` prefix, the probe key. Green 37/37. `8126540` |
| 4 | 2026-10-16 | Red: `exit` (returned success). Passed on first run as pins of step 2's code: blocked probe → `DENIED`, `QUOTA_EXCEEDED`, no handshake wait under `TestClock`, no copy of Ruken's save limits. Green 42/42. `7d90904` |
| 5 | 2026-10-16 | Red: `Cannot find module './sdk-markers'` and the export list. Green. The planned `toHostError` move was dropped: the built `automata-web` bundles (step 6 and consumer smoke) hold no SDK code and no `RukenError` without it. `ed44827` |
| 6 | 2026-10-16 | Red: `"./target" is not exported under the conditions ["automata-web", …]`. Green: web build has no marker and no `RukenError`; default build has both markers; an itch build (`__AUTOMATA_TARGET__` defined) has neither marker nor the define. `ed44827`, `476e107` (the define: red `buildTarget is not a function`, then green) |
| 7 | 2026-10-16 | Red: runtime `svelte-check` (`'web'` not assignable to ui's `HostKind`) and `failureHostKind is not a function`; green with `failureHostKind` (a web session's failures draw as standalone until PUB.4). Runtime 149/149, `svelte-check` 0 errors. `df4e975` |
| 8 | 2026-10-16 | `pnpm build` green; `test:dist` 13/13; consumer smoke from packs passed, including the new step "vite build with the automata-web condition, no Ruken SDK" (567 kB, no SDK) beside the default bundle's "1 Ruken SDK". `3d45178` |
| 9 | 2026-10-16 | Shared contracts §1 and PUB spec §3/§9 updated; changeset `pub1-web-adapter.md` (host, patch); `check-changesets` 0 problems. `3d45178` |
| 10 | 2026-10-16 | See the 02 execution record: `pnpm check` (static green; unit step green on rerun at `--concurrency=2` after load timeouts), `pnpm test:parity` 590/590, `pnpm test:e2e` 44 passed + 2 load timeouts, both green on rerun. |
