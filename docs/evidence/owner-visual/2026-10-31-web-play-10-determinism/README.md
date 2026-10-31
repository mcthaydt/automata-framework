# WEB.PLAY.10 determinism row (website#26)

The preview column of `/examples/shapes-rects` (preview, status line and the determinism row), captured from the
static build in Chromium at 1280x800 (desktop) and 390x844 (phone), device scale factor 1.

| Image | State | How it was reached |
| --- | --- | --- |
| `chromium-<size>-1-checking.png` | "Determinism: checking 120 ticks in this browser…" | The golden's request was held back so the state stayed on screen. |
| `chromium-<size>-2-pass.png` | The pass text, with the golden's path, framework `f8023a9` and the hash | The real check, after the golden was released. |
| `chromium-<size>-3-diverged.png` | "Determinism: this browser diverged from the golden at tick 37.", as an alert (bold) | Injected: the frame on show posted a `diverged` message (tick 37) to the page, as the frame would. The shipped golden can't be made to diverge honestly. |
| `chromium-<size>-4-edit.png` | "Your edit: 120 ticks hash to … in this browser. …" | A real edit (`0x00cdf9` replaced with `0xff0000`) and its own hash run. |

## What to check

- **Wrapping at 390 px:** every state wraps inside the column. Measured: the row's `scrollWidth` equals its
  `clientWidth` (350 px phone, 404 px desktop), and its left and right edges sit inside the preview column. The golden's
  path breaks at its hyphen (`shapes-` / `rects.replay`).
- **Nothing clipped:** the whole row is in each image. On the phone the site's sticky header covers the top edge of the
  crop (the lime Start button). That's page chrome over the preview's title bar, not the row.
- **Hash and ref readable:** the 16-hex hash and the 7-hex framework ref are in the body text size, in the muted colour;
  the diverged alert is in the text colour, bold.
- **Height:** on desktop the row is 26 px while checking and 102 px with a result (128 px on the phone), so the page
  below the preview column moves down once when the result arrives. Say if you'd rather reserve the space.
- The edit's hash equals the original's (`4b19e5aabfac26f3`). The edit changes only a view's colour, and views are not
  part of the sim state that is hashed. An edit to a system would hash differently.

## How they were made

A throwaway Playwright spec (not committed) ran on head bd14698 after `pnpm exec vite build`. It screenshotted
`.playground-preview` and measured `.determinism-row` in each state.
