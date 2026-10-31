# GAME-3D.1b part 2: review images (2026-10-31)

base-3d's game over and end screen, before and after the action row is centred (`screens/CentredActions.svelte`).
Taken from a production build (`vite build` + `vite preview`) in headless Chromium with SwiftShader, after New game,
with a throwaway patch to `screens.ts` that dispatched `defeated` or `ember` on entering play (neither state is
reachable in the first slice yet). The patch was reverted and is not committed.

| Image | Size | What changed |
|---|---|---|
| `game-over-844x390-before.png` / `-after.png` | 844 × 390 | The row was the frame's full width (12 px to 832 px), so Continue's focus ring overhung the 12 px gutter on the left only and the left margin looked narrower. Now the row is 26rem (416 px) wide, centred (214 px to 630 px) |
| `game-over-390x844-before.png` / `-after.png` | 390 × 844 | No change: under 26rem plus the gutters the row keeps the frame's whole width (16 px to 374 px) |
| `end-844x390-before.png` / `-after.png` | 844 × 390 | As the game over: Menu was full width, now 416 px, centred |

The black backdrop is the run's last frame under the scrim; SwiftShader draws the 3D stage black here (the earlier
"base-3d's black menu" follow-up), and nothing in this change touches it.

Not shown as stills: the 250 ms recentre ease (`easeHeading`, motion only; covered by `camera-driver.test.ts` and
`views.test.ts`) and the lock inputs (no visible change; covered by `lock-input.test.ts`, `game-spec.test.ts` and
`screens.dom.test.ts`).

The geometry is held by `games/base-3d/src/screens/screens.layout.test.ts` in Chromium, WebKit and Firefox: the row's
left and right margins equal within 1 px, at most 26rem wide, at 844 × 390 and 390 × 844.
