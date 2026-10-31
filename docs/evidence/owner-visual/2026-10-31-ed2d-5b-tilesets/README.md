# ED2D.5b Tilesets view: review images (2026-10-31)

Chromium screenshots written by `packages/editor-2d/src/app/tilesets/tilesets-view.layout.test.ts` (plan [ED2D.5b](../../../superpowers/plans/2026-10-30-ed2d-5b-tilesets-view.md) step 8), with the production CSS, over the Mossgate sample. The same test passes in Chromium, WebKit and Firefox at the kit's eight sizes (72 cases). These are new screens, not changed baselines: no golden or earlier screenshot changes.

| Image | What it shows |
|---|---|
| `tilesets-view-ipad-pro-11-landscape.png` | The reference size (1194 × 834): panel (tilesets, the Ground auto layer, its two rule groups, the Terrain group's rules with pattern thumbnails, first output tile, id and summary, each with a 44 px grip), the placeholder tileset as 44 px tiles with its tags, the new-tag field, the start of the live preview; the inspector on the first rule (on/off, size, the 3 × 3 pattern with the centre outlined, the value the cycle uses, outputs, chance, flips, break, outside). |
| `tilesets-view-ipad-pro-13-landscape.png` | 1366 × 1024: the whole live preview (the 12 × 8 sample painted Solid, the Ground result from the same engine and seed 1, the one cell where `ground-alone` matches outlined) and the inspector's Duplicate and Delete. |
| `tilesets-view-window-900x600.png` | The short `wide` window: the canvas column scrolls inside its region; the page does not scroll. |
| `tilesets-view-phone-portrait.png`, `tilesets-view-phone-landscape.png` | `compact`: Rules and Inspector open as a drawer and a sheet; the tile sheet scrolls sideways inside its own region (16 px bottom edge for WebKit's overlay bar). |
| `tilesets-inspector-ipad-pro-11-portrait.png`, `tilesets-inspector-phone-portrait.png` | The inspector opened from the canvas's Inspector button below `wide`, scrolled to Duplicate and Delete. |
| `tilesets-rules-ipad-pro-11-portrait.png` | The Rules drawer scrolled to the end of the 47-rule Terrain group; the matched-cell outline in the preview behind it. |

Known limits, recorded as follow-ups in the plan: rule ids are truncated in the 264 px panel (the full id is the inspector's heading); "Replace image" and "Re-roll variation" from the mockup are not drawn (their flows belong to later rows).

**Refreshed 2026-10-31 after the Mac's WebKit parity run:** "Outside the level" is now the kit `Picker` (a 44 px button that opens a listbox), not a native `<select>`. The images show it as a field-styled row, "Outside the level" with the rule's choice beside it (Same as the centre for the terrain rules). The outline of the matched cell and the "1 cell" caption also show their earlier fixes.
