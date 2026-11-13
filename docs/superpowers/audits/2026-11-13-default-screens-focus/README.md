# Default screens: Play not focused on `examples-ipad` (2026-11-13)

`examples/2d/tests/e2e/default-screens.test.ts:10` ("core-input-keys walks title, play, paused and back")
failed at line 16, `expect(getByTestId('play')).toBeFocused()`, in project `examples-ipad`, on the Owner's
runner. Intermittent.

## Verdict: the product, not the test

`examples-ipad` is `devices['iPad Pro 11']`, so it runs WebKit (`tooling/playwright-preset/src/index.ts`).
Playwright 1.63.0, WebKit 26.6 (build 2359), installed here with `pnpm exec playwright install --with-deps webkit`.

The flow asks for the first focus once. `packages/automata/src/app/flow/flow.manager.ts`, step 7 of a transition,
called `target.focus()` a single time after `enter`. WebKit drops `focus()` on a control that was added a moment
ago: no `focus` event, `document.activeElement` stays `<body>`, and nothing asked again. The test waits 5 s on
`activeElement`; it was right to fail.

## Evidence

All from `examples-ipad`, one worker, `CI=1`, `--retries=0`, `core-input-keys` only.

| Run | Before the fix | After the fix |
|---|---|---|
| Quiet | 25 of 50 passed (19 of 40, then 6 of 10) | 30 of 30 after the first commit, 30 of 30 again on the final code |
| Loaded, 6 busy loops on 4 cores | 2 of 24 | 24 of 24 (run twice, after each of the two commits) |

Trace of a failing run (an init script in the page logging `activeElement`, `document.hasFocus()`, focus events and
every `HTMLElement.prototype.focus` call, in ms from page start; the script is not committed):

```
276 play mounted          active=BODY  hasFocus=false
277 focus() call on play  active=BODY  hasFocus=false     <- the flow's one request
277 focus() returned      active=BODY  hasFocus=false     <- dropped, no event
...                       active=BODY for the next 3 s    <- nothing asks again
```

A passing run is the same until the call: `focus target=play`, `hasFocus=true` in the same millisecond. The element
looked the same in both (display, visibility, opacity, inert, hidden, rect all identical), so it is the engine, not
the markup.

Retry measurement: after a dropped call, retrying on every animation frame succeeded on attempt 2 in 11 of 12
failing runs (24 to 34 ms later) and on attempt 1 in one (6 ms): the first retry, one frame later, is dropped too;
the next one takes. A `setTimeout(0)` retry also failed in some runs; one 50 ms later never did. In the failing runs
the window did not get focus on its own, so this is not "wait for the window's focus event": the page got focus
only after a successful `focus()` call.

What this shows and what it does not. It shows WebKit 26.6 under Playwright dropping the first `focus()` on a fresh
control, about half the time. It does not show the iPad itself doing so: no physical device was tried.

## What a player gets

A keyboard or gamepad player on the title screen with nothing focused:
- Keyboard: Enter and Space do nothing; Tab focuses the first control, then Enter works.
- Gamepad: the Gamepad API needs no DOM focus, and the pad is read each frame (`menu-input.ts`). A d-pad press
  walks to the first control (`FocusNavigator.move`), then A works. A bare A does nothing: `confirm()` clicks only
  a focused control. `recover()` puts focus back only after the navigator has been used (`engaged`), so it does not
  help at load.
- A pointer or touch player is not affected: they tap Play.

Before the fix that was the state on about half of the WebKit loads. After it, Play is focused at load; the ring
shows once the player uses keys or a pad.

In a game embedded in a host page's iframe (`ruken`, `itch`) there is usually no window focus at load, in any
engine, until the player clicks or the host focuses the frame. The flow now also asks once when the window gains
focus. Unit tests cover: the screen mounts while the engine takes no focus, the frames run out, the window then
gains focus and Play is focused; focus the player moved meanwhile is kept; nothing is asked for a screen that was
left. Not tested in a real embedded iframe without window focus (the journeys' host frame gets focus from
Playwright's emulation).

## Gates run (final code)

`pnpm format`; `TURBO_FORCE=true pnpm check` exit 0 (56 tasks); `pnpm build`; `pnpm api-report` (0 breaks) and
`pnpm api-index` (nothing to write: no exports or doc comments of the public API moved); whole `examples/2d` e2e,
Chromium, WebKit and Firefox: 182 passed, 137 skipped (the input matrix's other cells, by design), 0 failed; the
framework's browser suite (`vitest run --project browser`): 6749 passed, 7 skipped. No golden, hash or picture moved.
Not run: the parity suites and the 3D journeys (not touched), a physical iPad.

## The fix

`focusUntilItTakes` in `flow.manager.ts`: focus, and if the control did not take it, ask again on each display
frame, at most 30 (about half a second), and once more when the window gains focus. Each asking stops when the
control has focus, when focus is on anything else (the player's, or the screen's own), when the control left the
page and when the screen was left. Unit tests in `tests/unit/app/flow/flow.test.ts`, "an engine that drops focus()
on a freshly mounted control", were red first for the right reason (no second request).

Plant: replacing the focus call with nothing makes the journey fail 3 of 3 (`Received: inactive`); reverted.

## The editor failure

`share-leaves-the-browser.test.ts:58` on `editor-ipad-webkit` (timeout after `page.reload()` waiting for a saved
level to be listed). Judgement only, not reproduced: this does not explain it. The test clicks a button in the
Levels region; a Playwright click does not depend on DOM focus, and the editor does not go through the game flow.
A level missing after a reload points at the save finishing after the reload (storage), not at focus. WebKit is the
common factor, nothing more.

## For the tracker

| Row | State |
|---|---|
| `default-screens` Play focus flake on `examples-ipad` | Fixed in the framework: the flow retries a dropped first focus. Quiet 30 of 30, loaded 24 of 24 (was 25 of 50 and 2 of 24). Not tried on a physical iPad. |
| Patch changeset `title-screen-focus-webkit` | Added for `@automata/framework`. |
| `share-leaves-the-browser.test.ts:58` on `editor-ipad-webkit` | Not explained by this; still open. |
| Embedded iframe without window focus | Unit-tested only; a real-browser test that loads the game in a frame that never gets focus is not written. |
