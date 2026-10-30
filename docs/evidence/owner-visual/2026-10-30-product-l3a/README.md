# PRODUCT.L3a: what the xx-long run changed, main beside this branch

For the Owner's visual acceptance ([plan](../../../superpowers/plans/2026-10-30-product-l3a-xx-long.md), Owner gates). These are evidence, not baselines: `ui`'s layout project asserts geometry and has no screenshot goldens, so nothing here is compared against in a test.

**How they were made.** A throwaway capture (not committed) mounted every contract fixture and show at 360x640, 844x390, 780x270, 1280x720 and 744x1133, at rest, with the keyboard up and at TV scale, in English and in xx-long, in Chromium, and took a screenshot of the viewport. It ran twice on this branch's fixtures (with their `locale` prop): once with `main`'s `ScreenFrame.svelte`, `SettingsScreen.svelte`, `Toggle.svelte` and without the level grid's `minTile` and `overflow-wrap` (the left half of each image), once as the branch stands (the right half). 525 captures per language; byte-identical except the ones listed below.

## English: 6 of 525 changed, all the level grid fixture

The fixture's level tiles now ask for 64 px (`minTile`) and let a too-long word break inside the tile, as a game with worded tiles would (decision 8 in the plan). No primitive's CSS change moved an English pixel at these sizes.

- `primitives-paged-grid` at 780x270 (rest, keyboard, TV scale), 844x390 (keyboard), 360x640 (keyboard, TV scale). Included: `en--primitives-paged-grid--phone-small--keyboard.png`, `en--primitives-paged-grid--galaxy-chrome-landscape--rest.png`.

## xx-long: 15 of 525 changed

- `screen` at 360x640 (rest, keyboard, TV scale): the action bar gives way (Settings takes its short label) instead of widening the screen past its right edge. Included: `xx-long--screen--phone-small--rest.png`, `xx-long--screen--phone-small--tv-scale.png`.
- `settings-settings`, `settings-settings-short`, `settings-controls`, `settings-controls-capturing` at 360x640 TV scale: the tabs wrap to a second row, Close comes back inside the dialog, the groups keep to the list's width (no option cut at its side). Included: `xx-long--settings-settings--phone-small--tv-scale.png`, `xx-long--settings-controls--phone-small--tv-scale.png`.
- `settings-settings` at 744x1133 TV scale: "Mute in the background"'s name breaks its longest word so its state word ("Off") stays whole inside the toggle. Included: `xx-long--settings-settings--ipad-mini--tv-scale.png`.
- `primitives-paged-grid` at 780x270 (rest, keyboard, TV scale), 844x390 (keyboard), 360x640 (rest, keyboard, TV scale): the fixture's tiles, as above. Included: `xx-long--primitives-paged-grid--phone-small--tv-scale.png`.
