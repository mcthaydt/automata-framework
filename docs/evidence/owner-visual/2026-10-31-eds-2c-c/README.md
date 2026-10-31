# EDS.2c-c review images (2026-10-31)

Screenshots from `packages/editor-suite/src/shell/suite-ship.layout.test.ts` (production CSS in a real browser, the
spec §10 sizes; the last browser of the run, Firefox, wrote them). They answer the follow-ups from the #290 visual
acceptance and #275. No golden or committed screenshot changed; the #290 images in `../2026-10-31-eds-2c-b/` show the
screens before.

| Image | What changed |
| --- | --- |
| `reload-toast-phone-portrait.png` | The reload toast sits above the tab bar; before, it covered the rail (#275). |
| `reload-toast-phone-landscape.png` | The same at phone landscape (compact height): the toast clears the tab bar. |
| `reload-toast-ipad-mini-portrait.png` | The same at tablet portrait (medium): the tab bar stays reachable. |
| `review-desk-phone-portrait.png` | Each gate is one row: its state wraps on the left, its record link is a bordered 44 px control on the right, with one 8 px gap between rows. Before, the links were plain text links that wrapped onto their own lines unevenly. |
| `review-desk-ipad-pro-11-portrait.png` | The gate rows at tablet portrait. |
| `interchange-phone-portrait.png` | Import's file chooser is a kit button, "Choose a file" (44 px), in place of the browser's native control. |

The kit change behind the toast (`EditorShell` hands `--shell-foot` to its `sheets`; `ToastRegion` sits above it)
also lifts toasts in the 2D and 3D editors above their status line and tab bar; the kit's
`editor-shell.layout.test.ts` checks that at all 8 shell sizes.

Real-device testing stays the Owner's.
