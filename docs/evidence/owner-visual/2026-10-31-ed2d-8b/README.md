# ED2D.8b review images (2026-10-31)

Chromium screenshots from `packages/editor-2d/src/app/world/world-view.layout.test.ts` (Hollowmere; the test chooses
Village and opens the inspector below wide), beside the `world` mockup frame. The three-browser layout run passes 24 of
24. No golden or compared screenshot changed.

| Image | What it shows |
| --- | --- |
| `mockup-world.png` | The design: each map drawn inside its rectangle. |
| `world-view-ipad-pro-11-landscape.png` | Wide: each level's picture (the sample's placeholder tiles, numbered, since its tileset has no image) under its outline, name and links. |
| `world-view-ipad-pro-11-portrait.png` | Medium with the inspector drawer open: the levels fit the part of the map left of the drawer, and Fit sits in the bar with Levels and Inspector (review of #328). |
| `world-view-phone-portrait.png` | Compact with the inspector sheet open: the levels fit the part above the sheet; Fit in the bar. |

The first images of this branch drew the level canvas's screen-size entity labels and link chips inside each picture,
which cluttered the map; the pictures now draw as Home's thumbnails do (labels at the level's own scale, no chips),
and the map draws the links between levels.

## The build against the mockup

| In the mockup | In this build | Why |
| --- | --- | --- |
| Maps drawn with their artwork | The level's own drawing, at the map's zoom; placeholders where a tileset has no image | One renderer for the level canvas, Home and the map (decision 1). |
| The map always in full view | Fits the part no drawer or sheet covers; Fit in the bar below wide | Review of #328. |

Real-device testing stays the Owner's.
