# ED2D.6c review images (2026-10-31)

Built images from Chromium (headless Firefox has no WebGL2): the World view from
`packages/editor-2d/src/app/world/world-view.layout.test.ts` with the Hollowmere sample (a door each way between the
village and the inn, and a warp to the forest path), and the level canvas from
`ED2D_VISUALS=1 pnpm exec vitest run --project "canvas (chromium)" src/canvas/level-visuals.canvas.test.ts`, copied
here so that ED2D.4c3b's own images stay as they were. Mockup frames come from `node docs/design/editor-2d/build.mjs
screen <id> out.html` plus `pnpm exec playwright screenshot --viewport-size=1194,834`. No golden or committed
screenshot that a test compares against changed. The reference picker is a dialog and is covered by the DOM tests
(`FieldEditor.dom.test.ts`, `app/links.dom.test.ts`), so it has no image here.

| Image | What it shows |
| --- | --- |
| `mockup-world.png` | The design: the `world` frame of the "Automata Editors" Figma file. |
| `world-view-ipad-pro-11-landscape.png` | The build: the two doors as a lens between the village and the inn, each labelled Door, the warp from the village to the forest path labelled Warp, each in its definition's colour with an arrowhead; the panel's new Add level; the inspector's Links (below the fold here: "Linked from: Inn"). |
| `world-view-phone-portrait.png` | Compact: unchanged from ED2D.6b apart from the map's links under the sheet. |
| `mockup-level-rpg.png` | The design: the `level-rpg` frame, with link chips on the canvas. |
| `level-hollowmere-links.png` | The build: the village at 1:1 with placeholder tiles; the door's chip "→ Inn · Door" below it, the warp's chip at the right edge. |
| `level-mossgate-links.png` | The platformer's door near the right edge: its chip "→ Root Cellar · Door" flips to the left of the door so it stays inside the level. |

## The build against the mockups

| In the mockup | In this build | Why |
| --- | --- | --- |
| World links run edge to edge, dashed, a chip with an icon at the middle | Solid curves from the door on one map to the door on the other, a text label at the middle | Pixi 8's `Graphics` has no dash (plan decision 5). Running from the entities keeps a pair of doors apart when the maps nearly touch: edge-to-edge curves collided into a knot in the first image (fixed before this commit, with a minimum bow of 40 world px). |
| Link chips on the canvas: `Inn · inn-door` (ids) | `→ Inn · Door` (level name and definition label) | Plan decision 3: generated ids read worse than definition labels. |
| Inspector "Links" rows with an icon, the kind and a chevron to open the target | Plain rows "Door → Inn · Door"; "Linked from: …" | The rows are not buttons yet; going to a target is a follow-up. |
| Map toolbar with a link tool | Not built | Links are made in the inspector's picker (flow 4); a link tool on the map is not in this row. |

Real-device testing stays the Owner's.
