# ED2D.6b review images (2026-10-31)

Screenshots from `packages/editor-2d/src/app/world/world-view.layout.test.ts`, the production CSS at the 2D editor's
sizes (spec §12), from a Chromium run (headless Firefox has no WebGL2, so its map says "Preview unavailable"; the
three-browser run passes 24 of 24 either way). The project is the Hollowmere sample, three levels; the test chooses
Village. This is a new screen; no golden or committed screenshot changed. Each image is taken with the inspector at
its top, as it opens (the checks scroll it to reach every control first, then scroll it back).

| Image | What it shows |
| --- | --- |
| `mockup-world.png` | The design: the `world` frame of the "Automata Editors" Figma file (Figma key `8H4vY5xZj7xIedrvDdwg2d`), rendered at 1:1 from `docs/design/editor-2d` with `node build.mjs screen world` and a Playwright screenshot. It is the only mockup frame for this view (iPad 11" landscape). |
| `world-view-ipad-pro-11-landscape.png` | The build at the mockup's size: the layout switch and the level list in the panel, the levels centred on the map with Village outlined, and the inspector. |
| `world-view-ipad-pro-11-portrait.png` | Medium: Levels and Inspector open the drawers over the map; the inspector is open. |
| `world-view-ipad-mini-landscape.png` | Wide but short. |
| `world-view-phone-portrait.png` | Compact: the inspector as a bottom sheet, open at Name. |
| `world-view-phone-landscape.png` | Compact and short. |

## The build against the mockup

| In the mockup | In this build | Why |
| --- | --- | --- |
| Layout switch Free, Grid, Row, Column | The same | |
| Levels as rectangles with names; the selected one outlined in the accent | The same, without the tile thumbnails inside | Thumbnails are a follow-up (`level-thumbnails.ts` exists). |
| Links between levels on the map, the Links section in the inspector, the link tool | Not built | ED2D.6c (the reference picker and links). |
| Worlds list with + (add a world), a grid size field | One world is shown; no add, no grid field | Adding worlds and editing the grid size were out of this slice (plan "Out"). A grid world uses the computed grid. |
| Maps list with size in cells and depth (z) | Level names only | A follow-up; depth is in the inspector. |
| Map toolbar (select, pan, add, link), zoom chip, "Pencil moves · finger pans" | Not built; the map is fitted | Plan decision 1: pan and zoom wait for ED2D.8; adding levels is a follow-up. |
| Inspector tabs Map, World, Checks; id shown locked | No tabs; no id field | The World view's inspector edits the selected level only; Checks has its own view. |
| X, Y in px; Width, Height in cells, applied directly | X, Y, Depth in px; Width, Height in px with the side kept and a Resize button | Plan decision 3: a resize that would drop cells asks first, so it is an explicit action with an anchor. |
| Duplicate and Delete | Not built | A follow-up (the commands exist). |
| Top bar: Checks ok and Export | The document bar of every view (Back, Undo, Redo, Save) | The editor's shared top bar; Export is its own rail view (ED2D.7b). |

Real-device testing stays the Owner's (the finger and Pencil drag belongs to ED2D.8's iPad pass).
