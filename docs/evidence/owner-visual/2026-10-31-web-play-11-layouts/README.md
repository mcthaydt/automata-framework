# WEB.PLAY.11 layouts (website#27 draft)

`/examples/shapes-rects` from the static build, in Chromium and WebKit, at device scale factor 1. These are for A-18,
the Owner's acceptance from screenshots. The Owner's own phone check is separate.

| Image | Shows | What to check |
| --- | --- | --- |
| `<browser>-phone-375x667-playground.png` | One column: preview above the code | Preview full width at 16:10; toolbar Restart and Fullscreen at 44 px. |
| `<browser>-phone-375x667-code-header-edited.png` | Code header after an edit: Preview (pressed), Reset, Copy link, Copy | The four 44 px buttons wrap to two clean rows; nothing clipped or overlapping. |
| `<browser>-phone-375x667-preview-hidden.png` | After pressing Preview: the preview is hidden and the code follows | No empty gap where the preview was. The page is scrolled so the code header sits under the sticky site header; the toggle is above the visible area. |
| `<browser>-tablet-768x1024-playground.png`, `<browser>-desktop-1280x800-playground.png` | Two columns: code left (about 55 %), preview right and sticky | Columns aligned at the top; no toggle in the code header. |
| `<browser>-landscape-780x270-playground.png` | Two columns on a short screen | Only the top of the page fits in 270 px; the test (`playground-layout.e2e.ts`) asserts the whole panel fits below the site header (it was 254 px with 196 px of room before the cap). |

All sizes are also asserted by `tests/e2e/playground-layout.e2e.ts`: no horizontal overflow and every playground
control at least 44×44 px at all four layouts, in both browsers.
