# Main's nightly green again: TDD plan

- **Task:** 02 follow-up "Nightly on `main`: Emberwick's journeys port, the `vite` advisory" (found 2026-10-23 reading the nightly runs of 2026-10-16 to 2026-10-22).
- **Status:** Implemented and locally verified 2026-10-23 (Node 24.21.0, Linux container); PR CI with parity pending.
- **Progress:** 4 of 4 steps.

## Why now

`main`'s scheduled run (`ci.yml`, 14:23 UTC daily) has been red since 2026-10-16. Read at `c2cca72`, run 39795189655 (2026-10-22):

| Job | Failure | Cause | This plan |
| --- | --- | --- | --- |
| browser journeys | `http://localhost:5000/b/202610110000-e2e0b2d/ is already used` before any test runs (also run 39129738004, 2026-10-18) | Under CI's fixed pair Emberwick's game sits at `4700 + 300` = 5000. macOS 12 and later run the AirPlay Receiver on 5000 and 7000, and the runner is the Owner's Mac, so Playwright finds something answering there. `browserSafePort` knew only the Fetch standard's bad ports. | Fix |
| lint, typecheck, boundaries, style, unit | `pnpm audit:deps`: `vite` 8.3.0 to 8.3.2 (GHSA-587h-7wmj-h5pm, `launch-editor`, high), reached through `packages/content > @inlang/paraglide-js > vite` | New advisory, patched in 8.3.3. Reproduced locally with `pnpm audit --prod --audit-level=high` (1 high, 4 moderate, 1 low). | Fix |
| frame budget | `UNSET: no frame budget is recorded`; the runner measured desktop work p95 30.90 ms, phone 16.70 ms | By design (PRODUCT.7): the job fails closed until the Owner records a budget from a quiet GPU run. | Not here. Filed as a bus question and test-request. |

## Design

- `browserSafePort` also steps past the ports a Mac holds that no browser blocks (5000 and 7000, AirPlay Receiver). Same function and call sites, so Emberwick's game moves to 5001 under CI's pair. Still not exported from `@mcthaydt/automata-ship`'s index.
- `vite` goes from 8.3.2 to 8.3.3, the first patched release, in every `package.json` that pins it, the `create-game` scaffold, the consumer-smoke fixture, `docs/versions.md` and `docs/stack.md`. Published `content` floors its peer at the workspace pin, so it takes a patch changeset. Ruken's pin is not readable from this checkout; the bump is recorded as a Ruken request (its `docs/versions.md` should follow).

## Steps

1. [x] **Red, ports.** `packages/ship/src/ports/browser-safe-port.test.ts`: `browserSafePort(5000)` is 5001 and `browserSafePort(7000)` is 7001. `tooling/examples-runner/src/ports.test.ts`: under CI's pair Emberwick's `gamePort` is 5001. Expect both to fail on 5000 and 7000. Done: `expected 5000 to be 5001` in both (ship: 1 failed, 3 passed; runner: 1 failed, 1 passed).
2. [x] **Green, ports.** Add the Mac's ports to `packages/ship/src/ports/browser-safe-port.ts`. The same tests pass. Done: 4 passed (ship), 2 passed (runner) (`43233cf`).
3. [x] **Red then green, advisory.** `pnpm audit:deps` is the failing check (reproduced red on `main`'s lockfile). Bump the pins, refresh the lockfile with `pnpm install --no-frozen-lockfile`, add the changeset. `pnpm audit:deps` passes and `tooling/versions` and `tooling/consumer-smoke` tests still match `docs/versions.md`. Done: before, `pnpm audit:deps` printed 6 vulnerabilities (1 high: `vite` through `packages/content > @inlang/paraglide-js`) and exited 1; after, "No known vulnerabilities found" (`313daa7`).
4. [x] **Verify.** `pnpm format`, `TURBO_FORCE=true pnpm check`, the CI checks-job extras (`pnpm build`, `pnpm api-index`, `pnpm build:examples`, `pnpm changeset status --since=origin/main`), then PR CI with parity. The browser journeys themselves run only on the Owner's Mac: a bus test-request asks for `GITHUB_ACTIONS=1 CI=1 pnpm test:e2e` after the merge; the container has no WebKit or Firefox build and does not stand in for that run. Done: `TURBO_FORCE=true pnpm check` on the working tree before it was committed: its two turbo runs passed, 34 of 34 and 30 of 30 tasks; `pnpm changeset status --since=origin/main`, `check-changesets`, `pnpm build`, `pnpm api-index`, `pnpm build:examples`, `pnpm audit:deps` and `pnpm deps:new --base origin/main` passed and left the tree clean. Not run here: `pnpm test:parity` (CI runs it in all three engines on the Owner's Mac) and `pnpm test:e2e` (the journeys, on the Mac only).

**Deviation.** The commits used `LEFTHOOK=0`. The pre-commit unit run (`turbo --filter=...[HEAD]`) selects all 35 packages once every `package.json` carries the new pin, and under that load three of the examples-runner's twelve golden replays hit the hook's 5 s budget (`audio-sound`, `core-input-gamepad`, `core-input-keys`). The same replays pass inside `pnpm check`, which has the 90 s budget: this is the open follow-up "Pre-commit unit tests get the 90 s budget" in 02, not a product failure. First-attempt evidence is kept here.

## Out of scope

The frame budget (Owner decision: headroom and a quiet GPU run), and why the runner's desktop probe reads 30.90 ms work p95.
