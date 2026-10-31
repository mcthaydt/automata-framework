# ED3D.7d-a Things tool: review images

Written by `packages/editor-3d/src/ui/plan/things-visuals.canvas.test.ts` with `ED3D_VISUALS=1` (Chromium, WebGL2) from
the shipped `depot.af-sector` fixture: T chooses Things, crate is picked, a mouse hovers over the dock. For review only:
nothing compares against them. `mockup-split.png` is the `Split` frame (its rail's Prop, Spot, Lamp, Spawn, Nav and
Zone tools).

| Image | Size | What to look at |
| --- | --- | --- |
| `things-ipad-pro-11-landscape.png` | 1194×834, `wide` | Things pressed in the rail; the palette over the plan with the depot's two definitions, crate picked; the crate sub-layer made the active layer; the ring where a tap would place the crate |
| `things-ipad-pro-11-portrait.png` | 834×1194, `medium` | The same with the tool strip and the sheet |

## The build against the mockup

| In the mockup | In this build | Why |
| --- | --- | --- |
| Prop, Spot, Lamp, Spawn, Nav and Zone as rail tools | One Things tool and a palette of the level's definitions | Decision 1: the definitions differ by profile and by level (ED3D spec §4.7) |
| Each definition's colour in its swatch | Grey swatches | The definitions name kit colour tokens, which the swatch does not resolve yet (follow-up: resolve them as the plan's paint does) |
| A thing's fields in the inspector | Its definition, place and Delete | The field form is ED3D.7d-b, moved into the kit first |

No golden or compared screenshot changed. Real-device testing stays the Owner's.
