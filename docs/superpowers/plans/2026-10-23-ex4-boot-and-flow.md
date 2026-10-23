# EX.4: port `runtime/boot-and-flow` TDD plan

- **Spec:** [EX spec](../specs/2026-10-16-examples-one-file-design.md) §6 (`runtime/boot-and-flow` → `core/core-screens-and-flow.ts`; "boot failure modes and the veil go to `packages/runtime` browser tests; the Effect-share budget goes to the placeholder's S8 budgets"), §8 E-e (every behavior test listed in §6 passes in its package before the demo folder is deleted); [EX plan](2026-10-16-examples-one-file.md) Task EX.4; [runtime spec](../specs/2026-10-12-m1-runtime-design.md) §8 (what the demo proved).
- **Task:** `EX.4 — port the existing demos`, the `runtime/boot-and-flow` row. One PR per demo. This is one of the two ports the examples queue left to the runtime/ui queue (its files: `packages/runtime` tests).
- **Status:** drafted 2026-10-23.
- **Progress:** 0 of 5 steps.

## What the old demo checked

`examples/runtime/boot-and-flow` (30 files, a hand-wired `GameDefinition` with a compiled flow and a content hash, three DOM screens, a `?fail=` query) has a unit file (`game.test.ts`, `fail-mode.test.ts`), the Effect-share budget (`budget/`) and one e2e file under the fake Ruken host:

| Old check | Where it is pinned now | Kind |
|---|---|---|
| Boots under the fake host to ready; walks title → play → paused → play; the sim stops while paused and goes on from the same tick; no CSP violation | `packages/game/src/screens/default-screens.test.ts` (`Resume (focused) and Escape return to the same sim`, `Quit to title drops the sim`, the pad and back tests); `packages/runtime/src/time/time.test.ts` (the `menu` reason holds the clock); `packages/runtime/src/flow/flow.test.ts` (transitions, the veil); every example's smoke (ready, no console error, no CSP violation) | Regression pin |
| `?fail=init` → `start`, `saves` → `progress`, `content` → `damaged`, `download` → `download`, `renderer` → `unsupported` | `packages/runtime/src/boot/run-game.test.ts` (`boot failure drawing`, `Continue without loading`, `Back to Ruken`), `boot-error.test.ts` | Regression pin |
| `?fail=stall` → `download-stalled` after 30 s | `run-game.test.ts` has a test with that name that asserts nothing (it boots, advances one frame and shuts down) | **Gap: the only proof was the e2e's 30 s wait** |
| Fake host `ready: 'never'` → `connect` after 30 s | `packages/ui/src/status/boot-failure.test.ts` maps a `HostError` with operation `ready` to `connect`, and `boot-program.ts` raises exactly that on a stalled `hosting.ready`, but nothing runs the two together | **Gap: only the e2e's 30 s wait** |
| The Effect-share budget (`budget/effect-share.ts`, 35,000 gzip bytes) | `games/placeholder/s8/budgets.ts` (`effectShareBytes: 35_000`, measured as the page with Effect minus the same page without it) and its `budgets.test.ts` | Already there |
| `failMode(query)` parsing | Demo-only (the `?fail=` query is the demo's own switch) | Not ported; nothing in a package parses it |

## Decisions

- **The two gaps become `packages/runtime` tests on fake timers, written first.** The stall rule is 30 s of Effect time (`STALL_MS` in `loading/load-meter.ts`), and `runGame` has no clock seam, so a test cannot wait 30 real seconds. Vitest fake timers move `Effect.sleep` and `Date` together, which is what the load meter reads. (a) The hollow `LoadStalled -> data-code="download-stalled"` test is replaced by one that hangs a preload fetch, advances 30 s and expects the panel (`data-code="download-stalled"`, one Try again action). (b) A new test boots under `createFakeHost({ autoReady: false })`, advances 30 s and expects `data-code="connect"` with Try again. Both are expected to pass on their first run (the code exists), so they are regression pins that replace the e2e's real waits; the red check is the control: the same game with the fetch resolving (or the host ready) must reach `ready` at the same point in time, or the fake timers are not the reason the failure appears.
- **No `core/core-screens-and-flow.ts`.** The spec's row names an example whose only content would be custom screens, and an example may import only the umbrella (`@mcthaydt/automata`), which has no `ScreenDef`: `GameSpec.screens` takes the runtime's type. The default flow (`title → play ⇄ paused → settings`) is what every example, starting with `core-basic-window`, already shows and smoke-tests. The same call was made for `core-saves` before M5.2 gave it a surface. No umbrella verb is added to make an example possible. If the Owner wants a custom-screens example, the umbrella needs a screen verb first (a separate task, not scoped here).
- **The Effect-share budget is not copied.** The placeholder's S8 check measures the same thing against the same 35,000-byte number on the shipped page. The demo's `budget:size` was never in `ci.yml` or `ci:local`, so nothing stops being checked.
- **`?fail=` stays a demo switch.** The panel tests construct each failure through the game definition, which is what a real failure looks like; a query parser is not product code.

## Files

- **Modify:** `packages/runtime/src/boot/run-game.test.ts` (the stall test; the `connect` test); `playwright.config.ts` (the `runtimeDemo` import, the `runtime/*/e2e` `testMatch` entry and the `webServer` entry); `package.json` (the `boundaries` entry for the demo's `src/sim`); `knip.jsonc` (the demo's workspace entry); `examples/README.md` (the demo row); `pnpm-lock.yaml` (via `pnpm install`); `docs/02-master-delivery-plan.md` (the EX.4 progress note); the EX plan's EX.4 checklist; this plan.
- **Delete:** `examples/runtime/boot-and-flow/` (`git rm -r`; `dist/`, `.turbo/` and `node_modules/` are disposable local output).
- **Changeset:** an empty one if `changeset status --since=origin/main` asks (tests only in `packages/runtime`), as the host-lifecycle port did.

## Interfaces

- **Consumed:** `createFakeHost` (`@ruken/sdk-host/testing`), `fakeFetch`, `manualFrames`, `nullRenderer` (`packages/runtime/src/testing`), `STALL_MS`.
- **Produced:** two tests; nothing else. No source change in `packages/runtime`.

## Steps

- [ ] **1. The stall pin, red first.** Replace the hollow test with the fake-timer version. Confirm it can fail: run it with the 30 s advance cut to 29 s and expect `data-state` not `failed` (the control), then restore 30 s and record whether it passes on its first run.
- [ ] **2. The `connect` pin, red first.** Add the `autoReady: false` test with the same control (29 s: still loading; 30 s: `connect`).
- [ ] **3. Delete the old demo.** `git rm -r examples/runtime/boot-and-flow`; remove the Playwright, `boundaries`, knip and README entries; `pnpm install`; then `pnpm check` and `pnpm build:examples`. The e2e and three-engine parity are the CI runner's.
- [ ] **4. Spec and plan records.** EX spec §6: an as-built note on the row (no example, why; the budget and the failure modes where they live). The EX plan checklist ticked with that note.
- [ ] **5. Docs.** The 02 EX.4 progress note; the execution-record row and 03 come with the docs sync.

## Gates

- Selected: the two runtime tests; `pnpm check`; `pnpm build:examples`; `pnpm build:demos` (the demo folder is gone from its filter).
- Omitted here, pending on CI: the `demos` Playwright project without the old spec, `pnpm test:parity`, the full `pnpm test:e2e`.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
