# ED3D.5d Plan view: review images

Written by `packages/editor-3d/src/ui/plan/plan-visuals.canvas.test.ts` with `ED3D_VISUALS=1` (Chromium, WebGL2) from the
shipped `depot.af-sector` fixture, after a finger tap at the middle of the plan selected the hall. They are for review
only: nothing compares against them.

| Image | Size | What to look at |
|---|---|---|
| `plan-ipad-pro-11-landscape.png` | 1194×834, `wide` | The layers panel inline (264 px), the views with Plan chosen and the others disabled, the checks pill; the level framed in the canvas region with rulers in metres; the hall outlined in the accent; the door piece on its top wall and the window on its left; the portal to the dock dashed under the accent; the spawn disc and the crate's footprint; the status line's zoom and selection |
| `plan-ipad-pro-11-portrait.png` | 834×1194, `medium` | The views left out and the Layers button in their place; the plan fills the width |
| `plan-phone-portrait.png` | 390×844, `compact` | The checks words leading the status line (no pill in the bar), the save state still in view |

The empty column at the right of the landscape image is the inspector's region, which ED3D.5f fills.
