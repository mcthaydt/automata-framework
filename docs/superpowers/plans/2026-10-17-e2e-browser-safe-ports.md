# E2E ports avoid browser-blocked ports: TDD plan

- **Task:** 02 follow-up "E2E ports avoid browser-blocked ports" (found in DX.2b), now red on `main`'s nightly.
- **Status:** In progress.
- **Progress:** 2 of 4 steps.

## Why now

The scheduled nightly on `main` (`e3dfc6b`, run 39033701826, and `41d88f9` the day before) fails its browser journeys: `page.goto: net::ERR_UNSAFE_PORT at http://localhost:6000/`. In GitHub Actions `portsFor` returns the fixed pair (4600, 4700), and the examples runner's fixture build sits at `demoPort(7)` = 4700 + 600 + 700 = 6000. Port 6000 (X11) is on the Fetch standard's bad-port list, so Chromium, WebKit and Firefox all refuse it. Eight journeys fail (four each in `examples` and `examples-compact`): the index ones on the refused page, the core-stub ones because its frame never loads. DX.2b found the same class of fault locally: Emberwick at preview + 300 lands on 5060 (SIP) for one worktree slot.

## Design

- One helper, `browserSafePort(port)`, beside `portsFor` in `packages/ship/src/ports/`, holding the Fetch standard's bad ports from 1024 up. A blocked port moves up one at a time until it is allowed (5060 → 5062, 6000 → 6001).
- Applied wherever a port is derived by an offset: the examples runner's `demoPort(slot)` and `demoHostPort`, Emberwick's pair (+300) and the ui demo (+100). The placeholder's pair (4600–4799) holds no bad port and is left alone.
- Not exported from `@mcthaydt/automata-ship`'s index: the e2e origins import `portsFor` by relative path already, so the package API is unchanged (no changeset, no API report change).
- Known limit, written beside the code: locally, a bumped port can equal a neighbouring worktree's port in the same 100-port range; that needs two worktrees on adjacent hash slots running at once. CI has one checkout, so there it is exact.

## Steps

1. [x] **Red.** `packages/ship/src/ports/browser-safe-port.test.ts`: an allowed port is kept (4700, 5900); 6000 → 6001; runs of bad ports are stepped past (5060 → 5062, 6665 → 6670). Run `pnpm --filter @mcthaydt/automata-ship exec vitest run src/ports/browser-safe-port.test.ts`; expect it to fail because `./browser-safe-port.ts` does not exist. Done: "Cannot find module './browser-safe-port.ts'" (the pre-commit hook runs affected unit tests, so the red test was committed with its code, not alone).
2. [x] **Green.** Create `packages/ship/src/ports/browser-safe-port.ts` with the bad-port set and the stepping loop. The same test passes. Done: 3 passed.
3. [ ] **Apply.** Modify `tooling/examples-runner/host/ports.ts` (`demoPort`, `demoHostPort`), `games/emberwick/e2e/origins.ts` (game and host ports) and `examples/ui/primitives/e2e/origin.ts` (default demo port) to pass derived ports through `browserSafePort`. Red first for the runner: a test in `tooling/examples-runner/src/ports.test.ts` that with `GITHUB_ACTIONS` set no derived port is a bad port (fails on 6000 before the change).
4. [ ] **Verify.** `pnpm format`, `pnpm check`, the CI checks-job extras, `pnpm test:parity`, and the browser journeys with CI's fixed ports (`GITHUB_ACTIONS=1 CI=1 pnpm test:e2e`), which reproduce the nightly's port 6000 failure before the change and pass after it. Tick the 02 follow-up row; record the evidence in 02 and 03.

## Out of scope

The nightly frame budget is red for a different reason: af-linux draws with SwiftShader and no budget is recorded, so `budget:frame` reports NOT-COMPARABLE. That waits on a GPU runner (D-5) and a recorded budget (PRODUCT.7); this plan does not touch it.
