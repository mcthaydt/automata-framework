# ED3D.6g-b loupe, nudge pad, points and the portal offer: review images

Written by `packages/editor-3d/src/ui/plan/draw-visuals.canvas.test.ts` with `ED3D_VISUALS=1` (Chromium, WebGL2) from
the shipped `depot.af-sector` fixture. For review only: nothing compares against them. `mockup-draw-sector.png` is the
`Draw a sector` frame of the 3D editor mockups (rendered from `docs/design/editor-3d/screens.mjs`; Figma "Automata
Editors", `Draw sector · landscape`).

| Image | Size | What to look at |
| --- | --- | --- |
| `mockup-draw-sector.png` | 1194×834 | The design: loupe above the tip, nudge pad at the bottom right, the New sector card with the points |
| `draw-loupe-ipad-pro-11-landscape.png` | 1194×834, `wide` | A Pencil placed (8, 6), (8, 8) and (11, 8) and hovers over the dock's south wall at (11, 6): the lens magnifies four times around the snapped point (the dock's fill above the wall, outside below, the snap ring and the pending edge), flipped left of the tip because the right has no room; the nudge pad bottom right; the New sector card floats below the toolbar with the three points and their edge lengths |
| `draw-loupe-ipad-pro-11-portrait.png` | 834×1194, `medium` | The same drawing; no card below wide (the plan keeps its width), the lens above-left and the pad bottom right, clear of the tab bar |
| `portal-offer-ipad-pro-11-landscape.png` | 1194×834, `wide` | ED3-c: a rectangle closed against the dock's south wall; the offer "Shares a 6.00 m wall with dock. Make it a portal?" with Make portal and Keep solid; the other shapes disabled until it is answered |

## The build against the mockup

| In the mockup | In this build | Why |
| --- | --- | --- |
| The lens over the tip with a "snap · vertex" chip under it | The lens alone | The status line already says where the pointer is; a snap-kind chip is a follow-up |
| The New sector card in the inspector, with heights, Rectilinear snap, Portal to neighbours and Checks on close | A floating card with the points only, at `wide` | An inspector column would narrow the plan mid-drawing (it did in the first build of this branch and cut the dock off); the heights and switches need commands ED3D.5f owns |
| Nudge pad arrows as icons, the check in the accent | Arrow and check glyphs, the check in the accent | No icon set yet |
| "shares a wall with ward · portal?" chip | A row per shared wall: Make portal / Keep solid | "Make portal" because the rail already has a Portal tool, and one button named "Portal" chose the tool and declined the offer in the first journey run |

Firefox in the layout runs here has no WebGL2, so its plan shows the "can't draw" notice and none of these overlays; the
journeys there check that, and ED3-c and ED3-d pass through the DOM. No golden or compared screenshot changed. Real-device
testing stays the Owner's.
