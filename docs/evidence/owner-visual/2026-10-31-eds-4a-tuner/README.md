# The Tuner (EDS.4a), core tunables in the suite shell

Images are the Chromium layout test's own screenshots (`tuner.layout.test.ts`, the production CSS, the suite's one shell, the
sample game's `content/tuning.toml` from `testing/tuner-fixtures.ts`). The matching Figma "Automata Editors" frames are
`tuner-sliders` (landscape) and its portrait counterpart in `docs/design/editor-suite/screens-tuner.mjs`; the Fairness tab
(`tuner-fairness`) is EDS.4b, Post-1.0, and is absent by design.

| Image | Figma frame | What differs, and why |
| --- | --- | --- |
| `tuner-rows-ipad-pro-11-landscape.png` | `tuner-sliders` | Search and the tunable list in the panel, one row per tunable in the canvas (slider and number box for a bounded number, number box alone without bounds, On/Off, text, "Ask only" for a table), the chosen tunable's bounds and note in the inspector. The sample file has no compiler output, so the "Run checks to read bounds" hint shows and GRAVITY has no slider. The kit's slider and number box each print the tunable's name as their own label, so the name appears twice in a row (a kit widget trait; not changed here). No Fairness tab (EDS.4b). |
| `tuner-rows-ipad-mini-portrait.png` | the portrait frame | Panel and inspector behind the shell's toggles; the rows fill the width, one column. |
| `tuner-rows-phone-portrait.png` | the portrait frame | Same, at 390 x 844; every control is a 44 px target, reached by scrolling the rows' own region, the page never scrolls. |
