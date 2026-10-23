# M4.10 follow-up: the matrix journey gives the game's frame the keyboard, TDD plan

- **Spec:** [M4 spec](../specs/2026-10-16-m4-input-display-design.md) §9.1 (the input × form-factor matrix, M-a); the journey is `examples/e2e/input-matrix.e2e.ts`. No spec change.
- **Task:** a follow-up of M4.10 found by the Mac run of #170 (`tests/queue/2026-10-23-1736-automata-cap-workers-mac.md`): `[matrix-desktop-keyboard-webkit] input-matrix.e2e.ts:303` §9.1 under the fake Ruken host failed with `focus never reached [data-testid="play"]` in 2.0 s, 2 of 3 on rerun, at a load of 10 with one runner job. It also failed in the 0915 run. The hub asked the Examples and DX thread to deflake it by waiting on the focus semantically, no sleeps.
- **Status:** drafted 2026-10-23, based on `main` (`9514d52`). Only the journey's file changes.
- **Progress:** 0 of 4 steps.

## What is wrong

`keyboardDriver.choose` walks focus with `frame.locator('body').press('ArrowDown')` until `document.activeElement` matches the wanted control, at most 30 steps (`walk`). Under a host the game is an iframe, and a key press goes to the frame the page has focused. Playwright's `press` focuses `body`, which is not focusable, so it never gives the iframe the keyboard. The game focuses Play itself on entry (runtime flow step 7), which usually makes its frame the focused one; in WebKit with other pages busy it did not: `document.hasFocus()` stayed false and `activeElement` stayed `body` (top document: `body`, not the `iframe`). All 30 presses reached the host page, which has no menu to move. 30 presses at about 65 ms is the 2.0 s the Mac saw.

Found by reproduction here (WebKit installed with `playwright install webkit` and `install-deps webkit`): 6 passes of 6 idle with two workers; with six CPU hogs on four cores and four workers, **12 of 12 failed** with that error, and a probe of the game frame showed 7 of 8 runs with `hasFocus` false and `activeElement` `body` and the one passing run with the iframe focused and Play active. Focusing the iframe element from the host page before the first key gave Play focus on the first ArrowDown in 8 of 8 under the same load.

## Decisions

- **Give the frame the keyboard once, in `open`**, the way a player's click on the game does: `frame.frameElement()` then `focus()` on it, then `expect.poll` for `document.hasFocus()` in the game frame. Semantic (waits for the focus, not a time), host-only (`frame.parentFrame() === null` means the standalone page, which is the focused frame), and in `open` so every keyboard path of every cell (the journeys, the host-event tests, a touch cell's keyboard rebind) gets it. Gamepad cells read pads, not keys; the focus is harmless there.
- **Not in the shared harness** (`openHosted` in `tooling/examples-runner/host/testing.ts`): other specs use it, none needed this, and whether Ruken's real host focuses the game frame on load is Ruken's to say. The fake host (`tooling/examples-runner/host/host.ts`) does not focus it today. If the hub wants the fake host to match Ruken, that is a Ruken question.
- **`walk` names what it saw** when it gives up: the active element and whether the frame has focus, so the next failure of this kind is diagnosed from the message.
- **Not touched:** the later steps of the journey. Under that synthetic overload (six hogs, or three, on four cores, four workers) 2 to 3 of 12 runs now pass the first step and fail later, at `holding right did not move the runner` or the held jump shot: the sim steps by the wall clock and a starved WebKit may draw no frame during the 100 ms hold. That is a different cause, was masked by this failure on the Mac, and may or may not show at the Mac's load; the PR says so, and the next Mac run decides whether it needs its own task.

## Files

- **Modify:** `examples/e2e/input-matrix.e2e.ts` (`open`, a new `focusGame`, `walk`'s message); this plan.
- No changeset: `examples/` is private.

## Interfaces

- **Consumed:** Playwright's `Frame.frameElement()`, `Frame.parentFrame()`, `expect.poll`; `document.hasFocus()` in the game frame.
- **Produced:** `focusGame(frame)` (local to the spec).

## Steps

- [ ] **1. Red, by reproduction.** `playwright test examples/e2e/input-matrix.e2e.ts --project=matrix-desktop-keyboard-webkit -g "fake Ruken" --repeat-each=12 --workers=4` with six CPU hogs (`sh -c 'while :; do :; done'`) on this four-core container fails 12 of 12 with `focus never reached [data-testid="play"]`. The test is the spec itself; a unit test of a helper would not fail where the race is.
- [ ] **2. Green.** `focusGame` in `open`, the clearer `walk` message. The same command passes the focus step 12 of 12.
- [ ] **3. All engines.** The fake-host journey in WebKit, Firefox and Chromium, four runs each, idle: 12 of 12. The whole matrix (170 tests) once with `CI=1`, so the two-worker cap is on: no new failure.
- [ ] **4. Gates and hand-off.** `pnpm format`, `pnpm check`; draft PR on an extra branch, merge queue told; a Mac `test-request` is not needed beyond the Orchestrator's next full e2e run (the journey is in it).

## Gates

- Selected: the reproduction before and after, the three engines, the whole matrix, `pnpm check`.
- Omitted, not runnable here: the Mac, any Actions run.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | | |
