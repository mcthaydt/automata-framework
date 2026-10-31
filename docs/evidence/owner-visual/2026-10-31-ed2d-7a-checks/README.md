# ED2D.7a: the Checks view (review images)

Captured 2026-10-31 by `packages/editor-2d/src/app/checks/checks-view.layout.test.ts` in Chromium (Playwright headless
shell, Linux) with the production CSS. The editor starts as `main.ts` starts it, over a memory workspace holding the
Mossgate sample seeded with three problems: a stray decor tile (tile 99 of a 64-tile tileset), a slime placed at
5000, 40 (outside the 512 × 288 level) and a door whose `target` names `gone-1`, which does not exist. The Info row is
the sample's own (no Moving platform is placed).

| Image                                     | What it shows                                                                                                   | What to check                                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checks-view-ipad-pro-11-landscape.png`   | The view in `wide` (1194 × 834): Errors (2), Warnings (1), Info (1), each row with its object, message, Locate and its repair. | Groups in severity order with counts; each row names its object (`slime-z in moss-steps`, `Layer decor in moss-steps`); repair labels read "Remove 1 stray tile", "Choose target", "Move inside". |
| `checks-view-window-900x600.png`          | The narrowest `wide` window.                                                                                    | Rows keep the buttons on the row's right; nothing clipped.                                                                                          |
| `checks-view-phone-portrait.png`          | `compact` at 390 × 844: the rail at the bottom, the buttons wrapping under each message.                        | Buttons at least 44 px; the text wraps rather than cutting; the rail stays in view.                                                                 |
| `checks-view-phone-landscape.png`         | `compact` at a short height: the list scrolls inside its region, the page does not.                             | The top bar, the rail and the status line stay in view.                                                                                             |
| `checks-target-phone-landscape.png`       | "Choose target" on the broken door: the dialog lists the doors, the checkpoint and the player start it may point at, with their level. | Choices are full-width 44 px buttons; Cancel has the focus first.                                                                                   |
| `checks-target-ipad-pro-11-landscape.png` | The same dialog in `wide`.                                                                                      | As above.                                                                                                                                           |

Known, not this task's: the tile message says "1 cell use tiles" (the check's own wording, from ED2D.4c); Locate on a
definition finding (the Info row) opens the Level view without a selection, since a definition has no place in a level.
