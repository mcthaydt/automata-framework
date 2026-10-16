# PUB.1: web adapter and `./target` TDD plan

- **Spec:** [PUB spec](../specs/2026-10-16-publish-targets-design.md) §3, §3.1, §7 (unit and build rows), §8, §12 PUB-a; [ADR 0005](../../adr/0005-publish-targets.md); [M1 shared contracts](../specs/2026-10-11-m1-shared-contracts-design.md) §1 (contract owner: host lane).
- **Status:** PUB.0 Owner-approved 2026-10-16 with every recommended default. Lane `pub1`, branch `claude/clever-pasteur-ujmu6e-pub1`.
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
  - `packages/host/src/to-host-error.ts`: `toHostError` moved out of `errors.ts`, so `errors.ts` (used by the web adapter) imports nothing from the SDK at run time.
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

- [ ] **1. `kind` and `hostName` on the Ruken adapter.** In `handshake.test.ts`, assert `hosting.hostName === 'Ruken'` for hosted and standalone sessions. Run `pnpm --filter @mcthaydt/automata-host test`; expect a typecheck-free runtime failure (`undefined` is not `'Ruken'`). Add the field to `Hosting` and `hosting-live.ts`; green.
- [ ] **2. Web adapter, contract suite on both adapters.** Write `testing/hosting-contract.ts` (ready, player, locale, saves round trip, flush, `savesStatus`, observed values start with the current one, round/track never fail, menu/exiting handlers register in a scope, shut-down calls fail `CANCELLED` and streams end) and run it in `hosting-web.test.ts` against `HostingTest` and the web adapter on `fake-web-page.ts`. Expect failure: `hosting-web.ts` does not exist. Implement `makeWebHosting`; green.
- [ ] **3. Web-only behavior.** In `hosting-web.test.ts`: visibility and focus drive `lifecycle` with reasons; pointer/touch/keyboard/gamepad events drive `input`; viewport and orientation drive `display`; `setFullscreen` uses the Element Fullscreen API and reports `support: 'element'`, or `'none'` without it; `hostName` is `'itch.io'` for the itch target and `'this page'` for web; saves live under `ruken:<gameId>:`; the probe key is not `ruken:__probe__`. Each fails first, then passes.
- [ ] **4. Pinned differences, one test each:** `exit fails UNSUPPORTED`; `blocked storage probe: saves not granted, every call fails DENIED`; `QUOTA_EXCEEDED from a full origin quota`; `no handshake wait: ready without advancing the TestClock`; plus `no AF copy of Ruken save limits` (spec §9 request 4). Each fails first, then passes.
- [ ] **5. No SDK value in the web adapter's graph.** Move `toHostError` to `to-host-error.ts`; `index.test.ts` keeps the same export list plus `RUKEN_SDK_MARKERS`/`findRukenSdkMarkers`. `sdk-markers.test.ts`: fixtures with and without each marker. Expect failure: module missing. Implement; green.
- [ ] **6. `./target` and the real bundle check.** `target.build.test.ts` builds the fixture entry (imports `Hosting`/`HostError` from `.` and `makeHosting` from `./target`, as the runtime does) with Vite twice: with `resolve.conditions: ['automata-web']` it has no marker and contains the web probe key; with defaults it has both markers. Expect failure: `./target` not exported. Add the exports and entries; green.
- [ ] **7. Runtime boot uses `./target`.** Change `boot-program.ts`'s `makeHosting` import; runtime unit tests and typecheck stay green (default condition = Ruken).
- [ ] **8. Published build.** `tsdown.config.ts` gains `target` and `target-web`; `publishConfig.exports['./target']` maps `automata-web` and `default` to their `dist` files. Consumer smoke gains a step: a Vite build of the packed packages with `automata-web` has no SDK marker, and the existing default bundle step still finds exactly one SDK. Run `pnpm build`, `pnpm --filter @mcthaydt/release test:dist`, and consumer smoke from packs.
- [ ] **9. Contract text.** Shared contracts §1: two adapters, `kind`, `hostName`, `./target`. PUB spec §3: the `__AUTOMATA_TARGET__` define. Changeset (host, patch).
- [ ] **10. Gates.** `pnpm format`, `pnpm check`, `pnpm test:parity`, `pnpm test:e2e` (ports 4640/4740), consumer smoke from packs. Record counts in 02, 03 and below.

## What later tasks reuse

- **PUB.2:** `automata build --target itch|web` adds `resolve.conditions: ['automata-web']` and `define: { __AUTOMATA_TARGET__: '"itch"' }`, and can fail an itch build with `findRukenSdkMarkers` over its JavaScript.
- **PUB.3:** the placeholder still imports `@ruken/sdk` directly (`examples/placeholder/src/boot.ts`), so its itch build needs it to boot through `@mcthaydt/automata-host/target` before the "no marker" build row can pass on it.
- **PUB.4:** `hostName` and `granted.has('exit')` drive "Back to …".

## Execution log

| Step | Date | Evidence |
|---|---|---|
