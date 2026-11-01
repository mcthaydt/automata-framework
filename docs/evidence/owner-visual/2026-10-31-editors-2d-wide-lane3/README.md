# Studio fixes from the #367 review (lane 3), iPad Pro 11 landscape (1194 x 834)

Images are the Chromium layout test's own screenshots (`studio.layout.test.ts`, the stage drawn by a stand-in renderer, so
the black canvas is expected; WebGL is checked by the canvas project). The matching Figma "Automata Editors" frames are
the Studio screens generated from `docs/design/editor-suite/` (`studio-look`, `studio-pose`, `studio-animate`).

| Image | Figma frame (source) | What differs, and why |
| --- | --- | --- |
| `studio-look-ipad-pro-11-landscape.png` | `studio-look` | Hand is now captioned "Hand" above Left/Right (it had only an `aria-label`). Same for Loop and Mode in Animate. |
| `studio-pose-ipad-pro-11-landscape.png` | `studio-pose` | Handle gizmos are drawn at the figure's own scale, on the limb (they floated at the 1.62 m reference position). The stand-in stage draws no figure, so see the unit test `studio-view.test.ts` for the numbers. |
| `studio-animate-ipad-pro-11-landscape.png` | `studio-animate` | The timeline (bar, keys, marker row) now fits the kit's 148 px dock: both keys are whole and the playhead ends inside the dock; before, the keys were cut at the bottom edge. Cues share the marker row, in the accent colour. |
