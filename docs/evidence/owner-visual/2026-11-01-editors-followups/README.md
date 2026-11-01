# Editors follow-ups: the Tuner row (images), 2026-11-01

Chromium layout-test screenshots (`tuner.layout.test.ts`), refreshed after the coordinator's review of #375. The matching Figma
frame is `tuner-sliders` (`docs/design/editor-suite/screens-tuner.mjs`).

| Image | What changed against #375's | Figma `tuner-sliders` |
| --- | --- | --- |
| `tuner-rows-ipad-pro-11-landscape.png` | The tunable's name is drawn once per row (the slider's and number box's own labels are visually hidden, still their accessible names); the note under the name reads "Celeste: 90 px/s." and no longer becomes a unit beside 384. | name once, slider, value box, lock |
| `tuner-rows-phone-portrait.png` | Same, one column at 390 x 844. | the portrait frame |

The Studio fixes of this PR (the Undo label, chest-space handles) have no visible change; the Studio layout run in WebKit and
Firefox passed on its first attempt (96 tests), so no Studio image is added.
