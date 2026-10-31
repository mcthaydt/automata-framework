# ED3D.5f Inspector cards and portrait layout: review images

Written by `packages/editor-3d/src/ui/inspector/inspector-visuals.canvas.test.ts` with `ED3D_VISUALS=1` (Chromium,
WebGL2) from the shipped `depot.af-sector` fixture. For review only: nothing compares against them. The mockups are the
`Split` and `Portrait` frames of the 3D editor mockups (rendered from `docs/design/editor-3d/screens.mjs` by
`gallery.mjs`; Figma "Automata Editors").

| Image | Size | What to look at |
| --- | --- | --- |
| `mockup-split.png` | 1194×834 | The design's sector card in the inspector column (right) |
| `inspector-sector-ipad-pro-11-landscape.png` | 1194×834, `wide` | A finger tap selected the hall: its card in the inspector column, its walls and portals, Floor and Ceiling steppers one to a row, the Light slider, its materials, and Change materials disabled until the material sheet |
| `mockup-portrait.png` | 834×1194 | The design's portrait: the floating tool strip, the bottom sheet with Sector, Walls, Things and Checks |
| `portrait-ipad-pro-11-portrait.png` | 834×1194, `medium` | The tool strip floating above the bottom sheet's peek; the views in the bar are Plan and 3D; the sheet's tabs with the hall's card under Sector |
| `portrait-wall-ipad-pro-11-portrait.png` | 834×1194, `medium` | Wall 4 of the hall chosen from the Walls tab: the wall outlined on the plan, its card under Sector, the status line naming the same wall |

## The build against the mockup

| In the mockup | In this build | Why |
| --- | --- | --- |
| Sector card: name chip, zone, area, Floor and Ceiling side by side, material swatches, Split / Merge / Duplicate / Delete buttons, Hide from camera and Portal to neighbours switches | Name, walls and portals, Floor and Ceiling one to a row, Light, material names, Change materials (disabled: the sheet is ED3D.8b) | Two kit steppers side by side wrap in a 320 px column; swatches need the material sheet; the actions and switches are follow-ups (decision 2 and the plan's Out) |
| Layers in the inspector column above the sector card | Layers stay in their own panel | ED3D.5d's layers panel is unchanged |
| Inspector column on every `wide` window | On a `wide` window of 1100 px or more | Decision 4: a 900 px window would leave the plan 260 px |
| Portrait tool strip with the Things tools and viewport buttons on the right edge | The six sector tools; Fit and Layers stay where they are (Layers in the bar) | Things tools are ED3D.7d; viewport buttons a follow-up |
| Plan / Split / 3D in the portrait bar | Plan and 3D | Split needs the width (spec §10) |
| Camera-view card with the 24 mm preview and heading | Not yet | ED3D.5f-b |

Walls are counted from 1 in the card, the Walls tab and the status line; the model's undo labels count from 0 (a
follow-up for the model). Firefox in the layout runs here has no WebGL2: the plan shows its notice and the inspector,
strip and sheet still work. No golden or compared screenshot changed. Real-device testing stays the Owner's.
