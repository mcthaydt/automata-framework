# The Last Light: Ada's look in play (the ada session)

Painted in Node by the kit (`extensions/character-kit/scripts/ada-density2.ts`), or shot in Chromium on software GL (`AF_WEBGPU=software`) at
1024 by 768. WebKit, Firefox and a real GPU did not run. The reference (FigureBuilder's `eye-swap.png`, lower half) is not committed.

## Item 1: her eyes (`item1-head-x10.png`, `item1-body-x4.png`)

Base man, base woman, Ada, density 2, x10 nearest. Ada's crease, hood and liner are base-f's own (.4, .35, 0; `eyeSize` unset on both), done in
8d820269 with the cast test that pins them to the base data. Looked at: her eye is the woman's, a one-texel dark lid line over the white and the
iris, not the man's heavy hooded lid; it reads open, so `eyeSize` is left as the base woman's. Her brow stays bolder (.75) than base-f's.
