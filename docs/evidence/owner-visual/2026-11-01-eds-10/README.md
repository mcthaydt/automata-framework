# EDS.10 + EDS.11: the 1.0 editors in the suite's one shell (Chromium, iPad Pro 11 landscape and 390 x 844 phone)

Images are the layout tests' own screenshots (production CSS, Chromium; `suite.layout`, `suite-levels.layout`,
`tuner.layout` and `studio.layout` tests in `packages/editor-suite`), with the canvases drawn by stand-ins (the level
canvas shows what it is handed, the 3D plan draws to a fake renderer, the Studio stage is a stand-in): pixels of the
canvases are the canvas projects' own. WebKit and Firefox run the same tests at the same eight sizes; only Chromium images
are kept. The matching Figma "Automata Editors" frames (sources `docs/design/editor-suite/`, `editor-2d/`, `editor-3d/`):

| Image | Figma frame | What differs, and why |
| --- | --- | --- |
| `suite-home-*.png` | `Suite home · iPad landscape` | The shell with no editor registered (the layout test's case): every listed editor reads "Not in this build" and its file opens read only; the rail of nine entries (wide) or the 64 px tab bar (phone). With editors registered, each tab opens its editor (the other images). |
| `tuner-rows-*.png` | `Tuner · Warmth · iPad landscape` / `iPad portrait`, `tuner-sliders` | Rows of sliders and number boxes in a declared scroll region; no Fairness tab (EDS.4b, Post-1.0). |
| `studio-look-*.png`, `studio-pose-*.png`, `studio-animate-*.png` | `Studio · Look`, `Studio · Pose`, `Studio · Animate` (`iPad landscape`; `Studio · Look · iPad portrait` for the phone) | Stage drawn by a stand-in; no pipeline gate bar (EDS.9d, Post-1.0). |
| `suite-levels-2d-*.png` | `level-platformer` (2D Level) | **Changed in this PR:** the layers list is now names in a listbox with Hide and Lock as buttons in a column beside it (axe: a button inside an option is nested interactive content). Same visual rows; the buttons are now keyboard tab stops. Canvas is a stand-in. |
| `suite-levels-3d-*.png` | `Plan viewport` (3D) | Plan drawn to a fake renderer; the suite has no tool rail or edit cards yet (not in this PR). |

Intentional change in this PR: the Levels 2D layers list only (above). No golden hash or baseline image was changed.
The Owner's iPad and Pencil passes are not recorded here and are never ticked by an agent.
