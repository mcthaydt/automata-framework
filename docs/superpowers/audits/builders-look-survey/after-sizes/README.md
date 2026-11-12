# The old game's picture and figure size

The Owner's word was to match The Last Light's settings: a picture capped at 640 × 480 (640 × 360 in a 16:9 window), figures at
density 1 in play. The kit's placement takes `{ density, crisp }` (default unchanged: density 2, whole pixels). The sheets here shoot the
painted base pair in the four base scenes with the old game's settings, two ways side by side:

- **left: density 1, whole pixels a texel** (`crisp` on, the kit's rule `max(1, round(zoom / density))`);
- **right: density 1, true size** (`crisp=0`: a texel is `zoom / density` pixels, so the figure is as tall as its metres).

```sh
SIZES_ONLY=1 FIELD=640x360 node spikes/builders-look/shoot.mjs docs/superpowers/audits/builders-look-survey/after-sizes \
  docs/superpowers/audits/builders-look-survey/builders figures=painted
SIZES_ONLY=1 FIELD=640x480 VIEWS=zone HEIGHTS=1 SCENES=base-interior-dressed node spikes/builders-look/shoot.mjs …same…
```

A sheet is `<scene>-<gameplay|zone>-<field>.png`: gameplay is the default camera (50 mm, 30°, 16 m), zone the room's own view (9 m in the
interior, 10.2 m on the pavement). `sizes-<field>.json` holds the man's and the woman's measured height in picture pixels (rows the
pair covers where the frame with it differs from the frame without it, the shadow off in both) and the true one (1.78 m at the 50 mm
lens: `field height × 1.78 / (0.48 × distance)`). Heights are measured on the bare scenes; a dressed scene has the same camera.

## How tall the man is

| Field | View | Scene | True | Whole pixels (man / woman) | True size (man / woman) |
|---|---|---|---|---|---|
| 640 × 360 | gameplay (16 m) | both | 83.4 | 67 / 66 (−20%) | 83 / 82 (−0.5%) |
| 640 × 360 | zone | interior (9 m) | 148.3 | 134 / 132 (−10%) | 144 / 144 (−3%) |
| 640 × 360 | zone | street (10.2 m) | 130.9 | 134 / 132 (+2%) | 128 / 128 (−2%) |
| 640 × 480 | zone | dressed interior (9 m) | 197.8 | 201 / 198 (+2%) | 191 / 192 (−3%) |

The whole-pixel rule rounds a texel to a whole number of pixels (`zoom / density`, here 1.27, 2.26 and 1.99 px a texel in the three
views at 640 × 360, 3.01 at 640 × 480, where the rule is exact), so the figure's height is off by that rounding: 1.27 becomes 1 (20% under), 2.26 becomes 2 (10% under), 1.99 becomes 2 (2%
over). True size is within 3% of the metres in all three (the man's 1.78 m is 65.7 texels, drawn from the cell's top row to its sole;
the small shortfall is the cell's own edge rows).

## What uneven texels look like

True size on a figure (right) against whole pixels (left), a 5× crop of the man on the pavement (the zone view): at a zoom between two
whole numbers a texel is one pixel wide in some places and two in others, so the figure's one-texel outline, its limbs and the folds of
the shorts vary in width down and across the body: an arm's black edge is one pixel in one row and two in the next, a leg's width
steps by a pixel between knee and ankle. Shapes are still the painter's (every texel is drawn, none is dropped), proportions are
right, and the figure reads at a glance as slightly rougher and a little softer than the whole-pixel one, which is crisp and
evenly blocky but 10% to 20% off its true height in two of the three views. The painter's pose, light and rim are the same in both
(the panels' brightnesses are equal to a tenth: 45.6 against 45.6 in the interior's gameplay view; 115 against 115.1 on the pavement's
room view).
