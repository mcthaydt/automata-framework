# EX.4: port `host/lifecycle-and-saves` TDD plan

- **Spec:** [EX spec](../specs/2026-10-16-examples-one-file-design.md) §2 (one file, public imports, 100 code lines), §5 (smoke, the journeys that need a real host), §6 (`host/lifecycle-and-saves` → `core/core-host-lifecycle.ts`, `core/core-saves.ts` with `Host: grant=saves`; tests to `packages/host` contract tests); [EX plan](2026-10-16-examples-one-file.md) Task EX.4 (the three steps per demo); [M5 spec](../specs/2026-10-16-m5-saves-audio-design.md) §12.
- **Task:** `EX.4 — port the existing demos`, the `host/lifecycle-and-saves` row. One PR per demo.
- **Status:** drafted 2026-10-23. Stacked on the `render-pixi/renderer-2d` port (#108), which is stacked on EX.6 (#98).
- **Progress:** 0 of 5 steps.

## What the old demo checked

`examples/host/lifecycle-and-saves` is a hand-wired page on Emberwick's `playRoom` (`makeHosting`, an Effect scope, DOM queries, a side panel, `data-*` attributes for the tests). Its e2e has six tests:

| Old e2e test | Where it is pinned now | Kind |
|---|---|---|
| Boots under the fake host, ready and quiet; shows the saves it was handed | `packages/host/src/saves.test.ts` (`reads the host's snapshot and writes back through saves.set`); `handshake.test.ts`; every example's smoke (ready, no console error, no CSP violation) | Regression pin |
| Stops the room while the host has it in the background and plays on after | `packages/runtime/src/time/time.test.ts` (`under pauseBehavior: 'pause', the host going to background adds lifecycle`, `entering background under 'pause' calls openMenu once`); `packages/host/src/state.test.ts` (lifecycle cases); **new** `examples/e2e/core-host-lifecycle.e2e.ts` for the real-browser journey (a fixture cannot prove a real host/game journey, AGENTS.md) | New journey, regression pins for the units |
| Reaching the ember writes the run to the host saves, and the round start and end reach the host | `saves.test.ts` (round trip, `flushes every pending write to the host`); `requests.test.ts` (the `telemetry.round` messages); `rounds.test.ts` | Regression pin |
| With saves denied, it keeps nothing and nothing goes to the device | `saves.test.ts` (`without the saves grant, relays the SDK's behaviour`) pins the in-memory behavior; **new** `saves.test.ts` cases pin that the page's own storage is never written | New pin (host authority) |
| With the saves server out of reach, the run queues on the host and nothing goes to the device | `saves.test.ts` (`reports syncing then saved, offline-queued while offline…`); **new** case for the page's own storage | New pin |
| Opened directly, it runs standalone | `standalone.test.ts` (`is ready at once…`, `keeps saves in the page's own storage under Ruken's ruken:<gameId>: prefix`) | Regression pin |

## Decisions

- **Two new `packages/host` tests, written first.** The old e2e asserted `localStorage.length === 0` after a denied and after an offline run: AGENTS.md's host-authority rule ("a denied or unavailable hosted capability must not silently switch to device storage"). The host suite pinned the SDK's in-memory behavior but never looked at page storage. Two cases in `saves.test.ts` run inside the fake Ruken frame with a spy `StorageLike` in the SDK environment: a write without the `saves` grant, and a write while the saves server is out of reach, both leave the spy untouched. Expected to pass on their first run (the SDK does not fall back), so they are regression pins that guard a re-vendor. Red check: the same spy under a top-level page (the standalone case) is written to, so the spy is wired correctly.
- **`core-host-lifecycle` shows what the game package does for the host, not host code.** An example may import only `@mcthaydt/automata`, which has no `Hosting` verb, and does not need one here: `defineGame` waits for the host's ready before it mounts, and the runtime pauses the sim and opens the pause screen when the host sends the game to the background (`pauseBehavior: 'pause'`, the default). The example is a ticking counter whose HUD prints the sim's tick and whether the frame is paused, so a reader sees the count freeze in the background and continue from the same tick on Resume. Nothing in the file mentions the host: that is the point, and the header says so.
- **`core-saves` stays with M5.2.** The delivery plan already moved `core/core-saves.ts` out of M5.1 ("the spec defines no game-lane surface for `Save` until the SaveSlots screen") and onto the M5.2 row. The umbrella has no saves verb, so the example cannot be written with public imports today; nothing is added here, and the best-time round trip it would show is pinned in the host and runtime suites (table above).
- **The journey test is an `examples/e2e` spec, not a package test.** The runtime's pause-on-background is unit tested against the fake host, but the old demo proved it on a real page under Ruken's CSP. `examples/e2e/core-host-lifecycle.e2e.ts` opens the example under the fake host, presses Play, sends the host's drawer overlay (`hostBridge.setOverlay`), expects the pause screen, and resumes. It runs in the `examples` and `examples-compact` projects with the other example journeys.

## Files

- **Create:** `examples/core/core-host-lifecycle.ts`; `examples/e2e/core-host-lifecycle.e2e.ts`.
- **Modify:** `packages/host/src/saves.test.ts` (two cases); `playwright.config.ts` (`hostDemo` import, `demos` testMatch `host/*`, `webServer` entry); `examples/README.md` (the demo row); `pnpm-lock.yaml` (via `pnpm install`); `docs/02-master-delivery-plan.md` (the EX.4 progress note); this plan; the EX plan's EX.4 checklist; `docs/03-continuation-prompt.md` (with the docs sync PR).
- **Delete:** `examples/host/lifecycle-and-saves/` (`git rm -r`; `dist/` and `node_modules/` are disposable local output).
- **No changeset:** `packages/host` gains only tests.

## Interfaces

- **Consumed:** `HostingTest`, `FakeHostHandle`, `runScoped`, `manualClock` from `packages/host/src/testing`; `defineComponent`, `defineSystem`, `definePlugin`, `defineGame`, `rect` from `@mcthaydt/automata`; `GameSpec.draw` (`ctx.sim.tick`, `ctx.frame.paused`, `ctx.text`); the fake host's `hostBridge.setOverlay` and `openHosted` (`@mcthaydt/examples-runner/host/testing`).
- **Produced:** the example `core-host-lifecycle` (Tier core, `Packages: @mcthaydt/automata`); the e2e spec; nothing else.

## Steps

- [ ] **1. The storage pins, red first.** Add the two `saves.test.ts` cases with a spy `StorageLike`, plus a control case in which a top-level page does write to it. Run `pnpm --filter @mcthaydt/automata-host test:unit`; record whether each passes on its first run (regression pin) or fails (a defect in the host to fix before the demo goes).
- [ ] **2. The journey, red first.** Write `examples/e2e/core-host-lifecycle.e2e.ts` before the example exists; run it under a local build and record the failure (the page is not there).
- [ ] **3. The example.** Write `examples/core/core-host-lifecycle.ts` within the budget. The catalog's real-examples test and `pnpm --filter @af-examples/examples typecheck` pass; the journey passes against a local Chromium build under the fake host (the only console error is the favicon 404 this container's full-Chrome build makes, as on untouched `main`); read the screenshots.
- [ ] **4. Delete the old demo.** `git rm -r examples/host/lifecycle-and-saves`; remove its `playwright.config.ts` entries and README row; `pnpm install`; then `pnpm check` and `pnpm build:examples`. The e2e and three-engine parity are the CI runner's.
- [ ] **5. Docs.** Tick `host/lifecycle-and-saves` in the EX plan with the `core-saves` note; add the 02 progress note; the execution record and 03 come with the docs sync PR.

## Gates

- Selected: `pnpm check`; `pnpm build:examples`; the host unit tests; the examples-runner Node tests; a local Chromium run of the journey and the smoke boot of the new example.
- Omitted here, pending on CI: the `examples` smoke projects, `pnpm test:parity` in WebKit and Firefox, the full `pnpm test:e2e`.
- No changeset.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | | |
