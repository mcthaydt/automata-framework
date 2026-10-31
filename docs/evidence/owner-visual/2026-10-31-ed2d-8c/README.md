# ED2D.8c review images (2026-10-31)

Chromium screenshots from `packages/editor-2d/src/app/world/world-view.layout.test.ts` (Hollowmere), beside the
`world` mockup frame and ED2D.8b's image of the same view. The Chromium layout run passes 8 of 8. No golden or compared
screenshot changed.

| Image | What it shows |
| --- | --- |
| `mockup-world.png` | The design: each map's name in its top-left corner. |
| `before-world-view-ipad-pro-11-landscape.png` | ED2D.8b: the names (Village, Inn, Forest Path) drawn straight onto the pictures, hard to read over the tiles. |
| `world-view-ipad-pro-11-landscape.png` | This build: each name on an opaque `bg/surface` plate with rounded corners, readable over any picture. |
| `world-view-phone-portrait.png` | Compact: the same plates at the smaller fit. |

## The build against the mockup

| In the mockup | In this build | Why |
| --- | --- | --- |
| The name on the picture, no plate | The name on a plate | The coordinator's review of #332: over the levels' real pictures the bare name was unreadable (plan decision 1). |

Real-device testing stays the Owner's.
