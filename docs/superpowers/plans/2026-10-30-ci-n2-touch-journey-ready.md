# CI.N2: Emberwick's touch journey waits until the room is live, with a budget for a loaded machine, TDD plan

- **Spec:** [M1 ship spec](../specs/2026-10-11-m1-ship-design.md) §3.7 (browser journeys: Playwright from the root config, the game served from `/b/<buildId>/`). AGENTS.md, Testing feedback: browser checks wait on semantic readiness and completed state transitions, never arbitrary sleeps. No spec change.
- **Task:** CI.N2, the part left of the 02 row "Follow-up (found 2026-10-23) — Two load-sensitive e2e journeys failed once in the Mac nightly run" (the WebKit focus half was #176). `[base-2d-compact] games/emberwick/e2e/base-2d.e2e.ts:198`, "the touch buttons move the character", failed in the Mac nightlies of 2026-10-23, 10-27 and 10-28 with `#game` still without `data-player-x` 5 s after tapping Play.
- **Status:** drafted 2026-10-30 on `main` (`b7ef19d`). Only the journey's file and this plan change.
- **Progress:** 0 of 5 steps.

## What is wrong

Found by reproduction and a timing probe in this four-core container, before any change (logs in the execution log below).

- **The room keeps the page's main thread busy.** In the room, Emberwick draws every frame through render-pixi, and Playwright's headless shell draws WebGL in software (SwiftShader). A room frame took a median of 167 ms (compact) and 233 ms (portrait) with one worker on a quiet machine, and up to 3.0 s with four workers and the page's CPU throttled 4x (`Emulation.setCPUThrottlingRate`). The frame loop asks for the next frame as soon as one is drawn, so the page is drawing nearly all the time.
- **Every Playwright call in the room waits for that page.** Measured on the quiet machine: a `getAttribute` or `toBeVisible` costs 2 to 3 room frames (about 0.5 to 0.8 s), `boundingBox` about 8 (1.4 to 1.6 s), and a mouse event 2 to 3. Under load the same calls took 1.5 to 14 s.
- **The journey uses Playwright's default budgets.** It allows 5 s for each assertion and 30 s for the whole test. After Play, the journey makes about eight calls in the room, then walks 16 px. The frame loop clamps a frame to 100 ms, so it runs at most 6 sim steps a frame, and the walk needs about 14 steps, which is 3 frames. At 1 to 3 s a frame, that does not fit in 5 s a step or 30 s a test. The Mac failed at its first room step, the first position after Play. Its nightlies ran at a load average of 37 to 115. Here, under the synthetic load, the later steps failed (the walk, `boundingBox`, `mouse.down`) on the test timeout or on the walk's 5 s. Both come from the same cause.
- **What the journey waits on is already the right signal; it lacks only the time.** `data-player-x` is the round's first sim step, published. `showWick` (`src/game.ts`) writes it from render-pixi's draw hook only when the scene has a player (`render/scene-renderer.ts`). The scene has no player until a step of this round is applied (`AppLoop.run` resets the renderer, `scene.reset()` clears it, and `apply` sets it). The room screen attaches its touch buttons and keys before it starts the loop (`screens/emberwick-screens.ts`, room `enter`). So once `data-player-x` is set, the room is live and the buttons work. Two cases would need a new attribute: a stale position left from an earlier round, and a screen marked `room` before its sim exists. This journey cannot meet the first, because it opens a fresh page. It does not have to rely on `data-screen="room"`, which is set before `createSim`, as a sign the room is live. So **no new attribute in the game** (the brief adds one only "if the game lacks a readiness signal").

## Decisions

- **Name the readiness and give every step in the room one budget sized from the measurements.** `roomLive(page)` waits for `data-screen="room"` (the tap was taken, so a lost tap fails with its own message) and then for the first published step, `data-player-x`. Each wait and call in the room (the readiness, `toBeVisible`, `boundingBox`, the walk's poll) gets `ROOM_STEP_MS`. That is ten of the slowest room frames measured: 3 s each, so 30 s, which is twice the slowest single step measured under load (14 s). The test's own timeout is sized the same way (step 3 records the number).
- **The journey and its assertions stay the same.** It taps Play, presses the real button where it is drawn, holds it, and needs more than 16 px of walking. There is no sleep, no retry, no skip and no quarantine. The existing `test.skip(!isMobile, …)` stays: a fine pointer has no touch buttons.
- **Not driven by Playwright's clock.** A paused clock makes the page idle between calls, but every frame then runs only one 16 ms step (the golden route does this), so the walk would need about 14 frames instead of 3. The real clock lets a slow frame catch up to 6 steps.
- **Only this journey.** The other room journeys in the file (keyboard walk, pause, 44 px buttons) wait on the same signal with the same default budgets. They have not failed on the Mac. Step 4 runs them under the same reproduction and records what it shows. If they are red, that is a follow-up, not part of this PR.
- **Engines.** `base-2d` and `base-2d-compact` use Playwright's Pixel 7 devices, whose browser is Chromium. Neither project runs in WebKit or Firefox, so there is no WebKit run to make.

## Files

- **Modify:** `games/emberwick/e2e/base-2d.e2e.ts` (`ROOM_STEP_MS`, `roomLive`, the touch journey); this plan.
- **Local only, never committed:** a scratch Playwright config with only Emberwick's two servers (`pw-ci-n2.local.config.ts`), the reproduction harness (`e2e/throttled-ci-n2.local.e2e.ts`: the real spec imported unchanged behind a `beforeEach` that throttles the page's CPU through CDP), and the timing probe (`e2e/probe-ci-n2.local.e2e.ts`).
- No changeset: `@af-examples/base-2d` is private.

## Interfaces

- **Consumed:** `#game`'s `data-screen` and `data-player-x` (written by `src/screens/emberwick-screens.ts` and `src/game.ts`); Playwright's `expect(...).toHaveAttribute`, `expect.poll`, `locator.boundingBox({ timeout })`, `test.setTimeout`.
- **Produced:** `ROOM_STEP_MS` and `roomLive(page)`, local to the spec.

## Steps

- [ ] **1. Red, by reproduction.** On `main`, with the journey unchanged: `CI_N2_THROTTLE=5 playwright test -c pw-ci-n2.local.config.ts e2e/throttled-ci-n2.local.e2e.ts -g "touch buttons" --workers=4 --repeat-each=12 --project=base-2d-compact` fails, and so does the same run in `base-2d`.
- [ ] **2. Root cause, by probe.** The timing probe records where the time goes, on the page and on the test's side, quiet and under load (the numbers in "What is wrong").
- [ ] **3. Green.** `roomLive`, `ROOM_STEP_MS` and the test timeout in the touch journey. The step 1 command passes 12 of 12 in each project, and the test timeout is recorded with the slowest pass it allows for.
- [ ] **4. The real config and the neighbours.** `pnpm exec playwright test games/emberwick/e2e/base-2d.e2e.ts -g "touch buttons" --project=base-2d --project=base-2d-compact --repeat-each=5` with the repo's own config (every server), and the whole file once in both projects. The other room journeys run under the step 1 reproduction and the result is recorded.
- [ ] **5. Gates and hand-off.** `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm build:examples`, `pnpm build:demos`; a draft PR.

## Gates

- Selected: the reproduction before and after, `--repeat-each=5` in both projects under the real config, the whole file once in both projects, `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm build:examples`, `pnpm build:demos`.
- Omitted: parity (no sim, renderer, ui or golden changes); the API report, API index and agent skills (no package exports change); changesets (private package); WebKit and Firefox (the projects are Chromium-only).
- Pending: the Mac's next nightly, the real confirmation at the load that failed.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | Plan | | Branch `claude/ci-n2-touch-journey-ready` from `main` `b7ef19d`. |
