# ED3D.6g-a Plan tools: review images

Written by `packages/editor-3d/src/ui/plan/sector-tools-visuals.canvas.test.ts` with `ED3D_VISUALS=1` (Chromium,
WebGL2) from the shipped `depot.af-sector` fixture: S chooses the Sector tool, a Pencil places three corners in the band
above the level and hovers where a fourth would go. For review only: nothing compares against them.
`mockup-draw-sector.png` is the `Draw a sector` frame of the 3D editor mockups (`docs/design/editor-3d/screens.mjs`,
rendered by `gallery.mjs`; Figma "Automata Editors", `Draw sector · landscape`).

| Image | Size | What to look at |
| --- | --- | --- |
| `mockup-draw-sector.png` | 1194×834 | The design: rail, sector toolbar, edge lengths, shared-wall hint, loupe, nudge pad, Undo point and Close sector, the New sector card |
| `draw-ipad-pro-11-landscape.png` | 1194×834, `wide` | The rail with Sector pressed; Polygon chosen in the toolbar; the two placed edges solid with 2.50 m and 1.50 m, the pending edge dashed with 2.00 m to the snap ring; Undo point and Close sector (48 px primary) at the foot of the plan |
| `draw-ipad-pro-11-portrait.png` | 834×1194, `medium` | The rail as the shell's tab bar along the foot; the same drawing, toolbar and actions over the full-width plan |
| `phone-portrait.png` | 390×844, `compact` | No rail: the plan is view and select only on a phone (ED3D spec §10), so it keeps the height. Same as ED3D.5d's phone image |

## The build against the mockup

| In the mockup | In this build | Why |
| --- | --- | --- |
| Rail buttons with icons over their names, and Prop, Spot, Lamp, Spawn, Nav, Zone | Names only (as the 2D editor's view rail), and the six sector tools | The editors have no icon set yet; the Things tools are ED3D.7d |
| Toolbar at the plan's top left, with Grid, Snap and the F · C heights chips | Toolbar centred at the top, the four shapes only | The grid step, snap and heights chips edit the view and the new sector's heights, which no command covers yet (follow-up) |
| Loupe, nudge pad, the New sector card with the point list | Not yet | ED3D.6g-b |
| Undo point and Close sector with icons, at the foot left of centre | Same buttons, text only, centred | No icon set; centring keeps them clear of a nudge pad at the right (6g-b) |
| Shared-wall hint as one chip: "shares a wall with ward · portal?" | One row per shared wall over the foot: "Shares a 6.00 m wall with hall. Make it a portal?" with Portal and Keep solid, and Portal on every shared wall for more than one | The tool asks per wall, and the step stays open until each is answered (ED3D.6a) |
| Status hint: "Sector · tap to place a point · tap the first point or Close to finish" | The pointer, zoom and selection | Follow-up: tool hints in the status line |

No golden or compared screenshot changed. Real-device testing stays the Owner's.
