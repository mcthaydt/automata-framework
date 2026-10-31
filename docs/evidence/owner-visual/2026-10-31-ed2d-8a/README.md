# ED2D.8a review images (2026-10-31)

Chromium screenshots from `packages/editor-2d/src/app/world/world-view.layout.test.ts` (the Hollowmere sample; the test
chooses Village), beside the `world` frame of the "Automata Editors" Figma file rendered with `node
docs/design/editor-2d/build.mjs screen world` and a Playwright screenshot. The three-browser layout run passes 24 of 24.
No golden or compared screenshot changed.

| Image | What it shows |
| --- | --- |
| `mockup-world.png` | The design: zoom chip, "Pencil moves · finger pans", Duplicate and Delete. |
| `world-view-ipad-pro-11-landscape.png` | Wide: the levels fitted to the map's real box, Fit at the map's bottom right (44 px), Add level in the panel. |
| `world-view-ipad-pro-11-portrait.png` | Medium with the inspector drawer open: Links, "Linked from: Inn", then Duplicate and Remove. |
| `world-view-phone-portrait.png` | Compact: the inspector as a sheet over the map. |

An earlier run of this branch showed the map zoomed in and cut off in landscape: the camera had fitted the first box
the page reported and kept its zoom when the real box arrived. The camera now fits every new box until the person pans
or zooms, and the layout test checks every level is inside the map across (it failed at six sizes with the old rule).

## The build against the mockup

| In the mockup | In this build | Why |
| --- | --- | --- |
| A zoom chip with a percentage | A Fit button; zoom by pinch, Ctrl/Meta+wheel or trackpad pinch | The percentage chip is a follow-up; Fit is the action a person needs after panning away. |
| "Pencil moves · finger pans" hint | The behaviour (a finger only navigates once the Pencil has touched the map, decision 1), no hint text | The hint is part of the row's accessibility and first-run pass. |
| Duplicate and Delete | Duplicate and Remove (Remove asks first, with the links that will break) | "Remove" says what happens to the level in this world; a confirm protects links. |
| Level thumbnails in the rectangles | Plain rectangles | ED2D.8b. |

Real-device testing (finger, Pencil, palm) stays the Owner's.
