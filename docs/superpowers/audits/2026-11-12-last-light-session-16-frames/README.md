# The Last Light, session 16: Ada's face and the camera nearer

Chromium on software GL (`AF_WEBGPU=software`), 1024 by 768 game frames, field 512 by 384 at 2x. WebKit, Firefox and a real GPU did not run.
The reference (FigureBuilder's `eye-swap.png`, lower half) is not committed.

## Item 1: Ada's painted face (`item1-head-x10.png`, `item1-body-x4.png`)

Base man, base woman, Ada, density 2, x10 nearest. New: the kit's `bobOpen` (hairline lifted over the brow, three forehead rows, the fall close to the head), a
two-tone mouth (`lipsAda`: #7c4b47 upper over the painter's #d28d7a lower), head slider 1.25 (a taller face: the lower lip gets its second row, and the chin's catch-light
no longer sits under the lip: the coordinator's "tongue" pixel, #edb67c). Eye whites are #fff3d6, the same texels as the reference's (the painter's `eyeWhite()` picks the
ramp tone nearest skin + 0.25 in lightness; identical code and swatch in both repositories). Not done: jeans taper (taper 1.5 to 3 changes nothing: the body's legs are tubes).
The mouth is 4 texels wide (the painter's width is round(headHalfWidth x (.2 + .06 x lips)), and no slider reaches 3 per side).

## Item 2: the camera nearer

(i) `item2-option-i-hall-south-before-fix.png`: a texel is 2 field pixels (4 screen), distance 8 m in the hall (8.25 corridor and closet), the lens 79 mm: her head is about 95 screen
pixels wide, about 440 pixels tall. (ii) `item2-option-ii-3x-field-hall-south.png`: a 341 by 256 field at 3x (the distance 10.9), her head about 70 pixels wide, about 372 tall.
Kept (i): the face reads at 95 pixels and at 70 it is marginal; the cost is the room shown (about 3.5 m across against 5.2 m), which the lock-on, the lead and the focus boxes carry.
(ii) is also not a field the game's window rule makes (`app/field.ts` caps at 640 by 480 and picks the whole scale), so it would change the window rule for every window.

## Item 3: which stage costs the face (`item3-stage-crops-x3.png`)

Her head cropped from the same frame (the hall's south wall), x3, one stage off at a time, each added to the last: all on; LCD off; retro grade off; the room's baked light off
(`lit: false`); the skin-hue hold off; haze and dither off. What each costs: the LCD mesh crosses every texel (all on against LCD off); the retro grade is a small hue shift; **the room's baked
light is the big one** (the skin goes from warm peach to dark olive-orange, and the brows, nose and mouth are lost in it); the hue hold, the haze and the dither cost almost nothing.
Fixes (opt-in, defaults unchanged): the kit's `dimmest` (the most whole steps the room may take a figure under its painted cell; the game says 1), and the LCD panel's mesh, stripes and
scanlines held to a third with the colour split off, in `content/look.toml`. `item3-play-hall-south-dim1-softlcd.png` is that frame.
