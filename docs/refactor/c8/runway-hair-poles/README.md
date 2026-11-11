# c8-lit A2: the runway golden on the builder's pole rule

The submodule moved from `d6e3c9f` to FigureBuilder's `d5ca055` (the hair-grid pole rule, `lightSprite`, WebGPU depth), and
`tests/fixtures/goldens/runway-cells.json` was re-recorded from the showcase on the new pin (`goldens:runway`). Every number is
copied from `summary.json` (made by `runway-compare.py` from a dump of every cell, drawn on the old and the new pin).

- Cells: 112; moved: **42**; changed texels: 281, of which **in the hair 281**, in an ear 0,
  beside the hair 0, elsewhere 0.
- `nia/thin/0` is now `259c7a376180713d893c1fdf5ac99b3e`, the md5 the Macs painted: the arm64 override is gone.
- Of the 281 changed texels, 129 are darker than they were (the rest lighter); 12 are darker than every unchanged hair
  texel beside them (crown texels at a band's edge: `sam/heavy/0` 4, `june/short/0` 3, and one each in `june/curvy/0`,
  `june/heavy/5`, `june/own/3`, `june/thin/0`, `nia/own/6`). They are the same shade swaps the coordinator accepted in FigureBuilder's
  audit (`docs/superpowers/audits/c8-hair-poles/` there) and nothing about the shapes changes.
- The sheets show each moved cell as a crop round the changed texels at x8: before | after | changed texels in magenta.

Moved cells (texels): `edith/curvy/5` (1), `edith/heavy/5` (14), `edith/muscular/5` (26), `june/curvy/0` (5), `june/curvy/5` (2), `june/heavy/0` (1), `june/heavy/5` (20), `june/muscular/5` (2), `june/own/1` (8), `june/own/3` (9), `june/own/6` (1), `june/short/0` (5), `june/short/5` (11), `june/thin/0` (2), `june/thin/5` (6), `mara/curvy/5` (5), `mara/heavy/5` (2), `mara/muscular/5` (3), `mara/own/1` (2), `mara/own/6` (6), `mara/short/5` (4), `mara/thin/5` (2), `nia/curvy/5` (4), `nia/heavy/5` (5), `nia/muscular/5` (3), `nia/own/0` (6), `nia/own/6` (4), `nia/short/5` (2), `nia/thin/0` (2), `nia/thin/5` (10), `otto/curvy/5` (1), `otto/heavy/5` (5), `otto/muscular/5` (2), `otto/short/5` (2), `sam/curvy/0` (4), `sam/heavy/0` (19), `sam/muscular/0` (7), `sam/own/0` (12), `sam/own/1` (1), `sam/short/0` (25), `sam/thin/0` (23), `sam/thin/5` (7).

Sheets: [`runway-moved-1.png`](runway-moved-1.png), [`runway-moved-2.png`](runway-moved-2.png), [`runway-moved-3.png`](runway-moved-3.png), [`runway-moved-4.png`](runway-moved-4.png).
