# Owner visual gates, 2026-10-18

Screenshots for the Owner's pending visual acceptances: M4.4's Settings screen and M4.7's covers, in the plain default style. Taken in headless Chromium (Playwright 1.63) with device emulation, standalone (no host). Real phones stay M4.10's device gate. These record what was shown to the Owner; they are not goldens and nothing compares against them.

The same images are on one page for review: https://claude.ai/artifact/YRujDcfzYEH1QxQe5nzXQG

## M4.4: the core Settings screen

- **Commit:** `702bb47` (merged as `2d0929d`, #87).
- **Page:** the one-file example `core/input-rebind`: title → Play → pause → the gear.
- **Viewports:** 390×844 and 844×390 (iPhone 13), 780×270 (Pixel 7 sideways, compact), 1280×800 (desktop).
- **Pass:** every action reads with its rebind button and key prompt; Reset and the quality choice are reachable (by scroll where short); nothing clipped or overlapped; targets at least 44 px.
- **For the Owner's call:** Settings has no dimming scrim (Paused has one), so the paused game shows through at full brightness behind the list; at 780×270 the "+2 more" scroll hint sits on it.

## M4.7: the landscape gate and the rotate hint

- **Commit:** `92fc4f9` (#88), which gives the rotate hint a panel; without it the title screen's heading showed through the hint's text.
- **Page:** `core/input-keys` for the gate. No example is locked to one orientation, so the rotate hint was shot on an uncommitted copy of that example with `orientation: 'landscape'`.
- **Viewports:** 844×390 and 780×270 (Pixel 7 sideways, touch), 844×390 (iPhone 13 sideways), 412×915 (Pixel 7 upright), and an 844×390 desktop window.
- **Pass:** a phone held sideways in a browser gets one "Go fullscreen" tap (iPhone: turn upright or add to the Home Screen); a game locked to landscape held upright gets the rotate hint over a paused game; desktop windows and upright phones get no cover.
