# WEB.PLAY.9 code header at phone sizes (website#25)

The playground's code header on `/examples/shapes-rects`, captured from the static build at 390x844 (portrait) and 844x390 (landscape) in Chromium and WebKit, both at device scale factor 1.

For each browser and size there are three images:

- `<browser>-<size>-before-edit.png`: the header as the page opens: "TypeScript", Copy link and Copy (its accessible name is "Copy code"). Reset is hidden.
- `<browser>-<size>-after-edit.png`: the header after one edit (`0x00cdf9` replaced with `0xff0000`), with Reset shown.
- `<browser>-<size>-viewport.png`: the whole viewport after the edit, so the header can be seen next to the editor and the preview.

## What to check

- Each button is a 44 px touch target. Measured after the edit, in both browsers and at both sizes, every button is 44 px tall and 59 to 85 px wide.
- Nothing is clipped or overlapping: no two button boxes intersect, and the header's `scrollWidth` equals its `clientWidth` (348 px portrait, 429 px landscape).
- The header wraps cleanly. With all three buttons it still fits on one row (45 px tall) at 390 px wide, so no wrap was needed at either size.

## How they were made

A throwaway Playwright spec (not committed) ran on head 7c8fa58 after `pnpm exec vite build`. It scrolled the preview into view first, because the preview starts only once its frame is on screen. It double-clicked the colour in the editor until it was selected and typed the new one, waited for Reset, and then took the screenshots and measured the buttons. In WebKit at 844x390 the measurement taken after the full viewport screenshot reported y = -1700 for the buttons (the page had scrolled). Their widths and heights match the other runs, and the viewport image shows the header in place.
