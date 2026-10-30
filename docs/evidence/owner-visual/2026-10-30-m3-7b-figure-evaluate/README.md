# M3.7b part 2a: the figure view on `evaluate()`, 2026-10-30

Canvas captures of the two one-file figure examples after render-pixi3d's figure view moved from `evaluateMotion` to figures' `evaluate()` (M3 spec §4.4.5). Taken as the M3.5d part 2 captures were (`../2026-10-30-m3-5d-figures-examples/`): headless Chromium (Playwright 1.63), the compact 780×270 viewport (Pixel 7 landscape, device pixels), under the fake host and Ruken's CSP, in this container (software WebGL), at 1.5 s, 2.5 s and 4.5 s after the Play click. They are evidence, not goldens; the examples' e2e checks (cloak pixels drawn and moving, the lamp held and put down) pass.

| Image | Compare with | What changed and why |
|---|---|---|
| `figures-walk-780x270-{1500,2500,4500}ms.png` | the same names in the M3.5d folder | Wick still walks the square in the same outfit and camera. His limbs now pass through `solve()` (the rig's IK and joint limits) after locomotion, as `evaluate()` always does, so arm and leg positions differ slightly frame to frame from the M3.5d captures. The capture times are wall-clock times from the click, so the walk phase differs between the two sets too. Nothing is missing or misplaced. |
| `figures-outfits-items-780x270-{1500,2500,4500}ms.png` | the same names in the M3.5d folder | The outfits, the turn and the hand lamp behave as before. The lamp's hold now comes from `evaluate()`'s hold step (an item is held by an arm that no clip owns); these examples play no clips, so the hold is the same. |

Neither example has hair pieces, so the view's new hair spring changes nothing visible here; its swing is unit-tested (`figure-view.test.ts`).
