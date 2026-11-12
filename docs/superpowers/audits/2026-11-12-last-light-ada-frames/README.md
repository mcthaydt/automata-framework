# The Last Light: Ada's look in play (the ada session)

Painted in Node by the kit (`extensions/character-kit/scripts/ada-density2.ts`), or shot in Chromium on software GL (`AF_WEBGPU=software`) at
1024 by 768. WebKit, Firefox and a real GPU did not run. The reference (FigureBuilder's `eye-swap.png`, lower half) is not committed.

## Item 1: her eyes (`item1-head-x10.png`, `item1-body-x4.png`)

Base man, base woman, Ada, density 2, x10 nearest. Ada's crease, hood and liner are base-f's own (.4, .35, 0; `eyeSize` unset on both), done in
8d820269 with the cast test that pins them to the base data. Looked at: her eye is the woman's, a one-texel dark lid line over the white and the
iris, not the man's heavy hooded lid; it reads open, so `eyeSize` is left as the base woman's. Her brow stays bolder (.75) than base-f's.

## Item 2: her build (`item2-builds-in-play-1to1.png`, `item2-five-heads-head-x10.png`, `item2-five-heads-body-x4.png`)

Shot in play (the hall, facing us at the south wall, and in three-quarter by the beds), 1:1 crops of 1024 by 768 frames, a texel 4 screen pixels:
seven heads (height 190, head .85: 146 rows, a head of 20 by 20 texels), six heads (today's 160 and 1.25: 124 rows, 20 by 18), five heads
(160 and 2: 125 rows, 25 by 22). The head slider moves the ratio; height alone scales the head with the body (every height stays about six heads).
Kept five (head 2.05): her face reads largest by far, and her body is still a slim adult's in both views; seven is elegant but its face is no
bigger than six's, and its hair nearly meets the top of the three-quarter frame. At 2 the chin's catch-light came back under the lower lip (the
cast test caught it); 2.05 clears it. The `head` slider is exempt now from the cast test's "within .3 of the base woman" rule, as height was:
the build is the Owner's call ("go with what looks the best"). The cast tests that read the face in fixed rows under the crown now read windows
that are the same shares of the head's measured rows, so they still test the mouth and the eyes on a larger head.
The shots needed `play-shots.test.ts` to hold two keys at once and let both go in one task (one key let go a tick early turned her side-on).

## Item 5, first round: the gameplay frame (`item5-gameplay-frame-1024x768.png`, `item5-head-from-that-frame-x2.5.png`)

The five-heads build, facing us at the hall's south wall, as the game plays it (no item 3 work in it yet). Her head is cropped from that same
frame and enlarged x2.5 nearest, so a texel is 10 pixels, the reference's size. Looked at beside the reference's lower half, feature by feature:
brows bold and two texels thick (they read, bolder than base-f's); the lid is the woman's, a dark row over the white and the iris (reads); the
whites show both sides of each iris and are near-white but greyed by the mesh; the nose is a faint column, weaker than the reference's shadow;
the lips are two tones but low in contrast, a grey-pink band; the skin is a pale pink-peach, cooler than the reference's warm tan; crispness
falls short: the LCD panel's mesh crosses every texel, off the texel borders. The structure matches; the finish does not, which is item 3's.
