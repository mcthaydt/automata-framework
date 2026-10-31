# ED3D.5e Dollhouse viewport and Split: review images

Written by `packages/editor-3d/src/ui/dollhouse/dollhouse-visuals.canvas.test.ts` with `ED3D_VISUALS=1` (Chromium,
WebGL2) from the shipped `depot.af-sector` fixture. For review only: nothing compares against them.
`mockup-split.png` is the `Split` frame of the 3D editor mockups (rendered from `docs/design/editor-3d/screens.mjs` by
`gallery.mjs`; Figma "Automata Editors", `Split · landscape`).

| Image | Size | What to look at |
| --- | --- | --- |
| `mockup-split.png` | 1194×834 | The design: plan left, dollhouse middle, inspector right; one selection in both |
| `split-ipad-pro-11-landscape.png` | 1194×834, `wide` | Split chosen in the bar; a finger tap on the plan selected the hall, outlined in the accent on the plan and tinted and outlined in the accent in the 3D view; the near walls cut away; the hall's window an opening in its far wall; the portal to the dock open; the status line names the hall |
| `split-ipad-pro-13-landscape.png` | 1366×1024, `wide` | The same at the larger size |
| `dollhouse-ipad-pro-11-landscape.png` | 1194×834, `wide` | 3D chosen: the 3D view fills the canvas region, framed from the home angles (30° up, 45° round); each surface outlined with a dark hairline so walls read apart |

## The build against the mockup

| In the mockup | In this build | Why |
| --- | --- | --- |
| Props, counters, lamps' pools and dashed zone boxes in the dollhouse | Sectors only | The mesh (`buildSectorMesh`) is sectors only; things in 3D are a follow-up |
| Orbit / Walk / Game cam switch under the 3D view | Not yet | Walk is ED3D.8b; Game cam with the camera-view card (ED3D.5f) |
| Inspector column with the sector card | Not yet | ED3D.5f |
| Fit and layers buttons on each viewport; "PLAN 40 px/m · grid 0.5 m" and "3D orbit · pitch 30°" tags | A "3D · orbit" tag; the plan's zoom in the status line | Viewport buttons come with 5f's portrait tool strip |
| Split by default at `wide` | Plan by default; Split and 3D in the bar | Opening on Split would change ED3D.5d's accepted layout (plan decision 3, for the Owner's veto) |
| Textured, lit surfaces | Flat-shaded greys by role and light | ED3D-D6: flat shading, no `@pixi/3d` |

Firefox in the layout runs here has no WebGL2: the 3D view shows its "can't draw" notice there, says the plan still
works, and a tap still selects. No golden or compared screenshot changed. Real-device testing stays the Owner's.
