# ED2D.4c4b Level view inspector and dock: review images

Written by `packages/editor-2d/src/app/level/level-view.layout.test.ts` (`pnpm --filter @mcthaydt/automata-editor-2d
test:layout`, the Chromium instance) from the shipped Mossgate fixture, at head `14dab9ee`. They are for review only:
nothing compares against them. In tall `wide` the inspector and the dock are both inline, so one image shows both; the
`level-dock-ipad-pro-11-landscape` shot is the same image and is left out. Nothing is selected in these shots, so the
inspector opens on its Level tab (plan decision 2); the Entity tab's fields (steppers, the colour field, a refusal) are
covered by the jsdom journey in `LevelView.dom.test.ts` and `FieldEditor.dom.test.ts`.

Compared with ED2D.4c4a's images, the canvas no longer takes the inspector's column in `wide`, the dock of level cards
arrives, and below `wide` the toolbar gains Levels and Inspector buttons.

| Image | Size | What to look at | What changed |
|---|---|---|---|
| `level-inspector-ipad-pro-11-landscape.png` | 1194×834, `wide` | The 320 px inspector column on the right with the kit's tabs Entity, Level (chosen) and Checks; the Level tab shows the name and size read only and the Music text field; the 148 px dock under the canvas with Moss Steps (current, outlined) and Root Cellar cards; the toolbar's brush size stepper now runs past the canvas's width and is reached by scrolling the row (its declared scroll region) | Inspector and dock new; the canvas is narrower than 4c4a's (the inspector takes its column, §12's 554 px reference) |
| `level-inspector-ipad-mini-landscape.png` | 1133×744, `wide` | The same layout at the iPad mini; the kit counts 744 px as a tall height, so the dock is inline here too | New |
| `level-dock-ipad-mini-landscape.png` | 1133×744, `wide` | The same image as above (no toggle to press in `wide`): the dock inline with its two cards | New |
| `level-inspector-ipad-pro-11-portrait.png` | 834×1194, `medium` | The inspector as the kit's drawer from the right over the canvas, opened by the toolbar's Inspector button; it stops where the dock's sheet begins; the dock opens as a strip by default in `medium` | New |
| `level-dock-ipad-pro-11-portrait.png` | 834×1194, `medium` | The dock sheet with its grab handle and the two level cards above the tab bar; the canvas keeps the full width | New |
| `level-inspector-phone-portrait.png` | 390×844, `compact` | The inspector as a bottom sheet (half height) with the tabs and the Music field; Back, Undo, Redo, Save and the tab bar stay in view | New |
| `level-dock-phone-portrait.png` | 390×844, `compact` | The dock as a bottom sheet with its cards, opened by Levels (which sits at the end of the sideways-scrolling tool row) | New |

**Regenerated 2026-10-30 after the Mac CI's WebKit parity run (job 124310463507):** every image above. The level
toolbar (Layers, then the tool row) keeps a 16 px bottom edge instead of 8 px, so the row is 8 px taller and the canvas
below it starts 8 px lower; the tools, their order and everything else are unchanged. macOS lays its overlay scroll bar
(about 15 px, hit-tested in Safari) along a sideways-scrolling row's bottom edge, which covered the tools' lower edge
at 900×600 and 390×844 ("Select is covered or clipped at its bottom edge"), the same class as #265's region bodies.
