# ED2D.6b review images (2026-10-31)

Screenshots from `packages/editor-2d/src/app/world/world-view.layout.test.ts`, the production CSS at the 2D editor's
sizes (spec §12), taken from a Chromium run (headless Firefox has no WebGL2, so its map says "Preview unavailable";
the three-browser run passes 24 of 24 either way). The project is the Hollowmere sample, an RPG map set of three
levels; the test chooses Village, so the inspector shows it. This is a new screen; no golden or committed screenshot
changed.

| Image | What it shows |
| --- | --- |
| `world-view-ipad-pro-11-landscape.png` | The reference size: the panel with the layout switch (Free, Grid, Row, Column) and the levels; the map with Village outlined in the accent; the inspector with Name, X, Y, Depth, Width, Height, the sides kept on a resize, Resize (disabled until the size changes) and the level's field (Area). |
| `world-view-ipad-pro-11-portrait.png` | Medium: Levels and Inspector open the drawers over the map; the inspector is open. |
| `world-view-ipad-mini-landscape.png` | Wide but short. |
| `world-view-phone-portrait.png` | Compact: the inspector as a bottom sheet over the map. |
| `world-view-phone-landscape.png` | Compact and short. |

Not shown: a drag in progress and the resize confirmation (the DOM tests cover both). Real-device testing stays the
Owner's (the finger and Pencil drag belongs to ED2D.8's iPad pass).
