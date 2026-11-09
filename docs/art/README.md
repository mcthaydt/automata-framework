# Art direction

> Owner direction, 2026-10-11. This applies to AF's own visuals (examples, fixtures, default theme) and to the reference look the asset pipelines check against. A game built on AF can choose its own palette in its content; these are AF's defaults.

## Palette: DUEL

All asset visuals use **[DUEL](palettes/duel.md)** (file: [duel.txt](palettes/duel.txt)): 256 colours as 32 ramps of 8, dark to light, so a colour can be shaded by stepping along its own ramp. The file is in paint.net format (`AARRGGBB` per line, `;` comments), in ramp order: colour `r * 8 + s` is ramp `r`, step `s`. Owner direction, 2026-11-07: "2D should also use the duel palette" (it replaces DUEL, 2026-10-11).

## Look: Bubble Bobble mixed with Celeste

The design reference for 2D, 2.5D and 3D is **Bubble Bobble mixed with Celeste**:

- From **Bubble Bobble**: a readable single-screen arcade layout, chunky friendly characters with bold outlines, bright saturated colors on dark backgrounds, and clear "this is a thing you can touch" shapes.
- From **Celeste**: crisp pixel art at a low internal resolution, expressive movement and squash-and-stretch, small particles and screen feel (dust, dash trails, a little shake), and atmospheric layered backgrounds.

Owner (2026-10-11, on the first `base-2d`): use these as influences, not motifs to copy, and aim for the look of a current itch.io hit. The first pass (a bubble-blowing blob with a red scarf, pink bricks, a bubble to reach) read as a clone. Keep the single-screen readability and the movement feel; bring original characters and settings, and a modern treatment: colored outlines and rim light, pixel lighting (stepped, dithered lights over a darker scene), parallax, a vignette, and juice. Emberwick (`games/emberwick`) is the reference.

In 2.5D and 3D the same rules carry over through `post-retro`: a low internal resolution, palette-quantized output and sprite-like silhouettes rather than realistic shading.

## Where it is used

| Where | How |
|---|---|
| UI theme tokens | Default tokens (surfaces, text, accents, error and focus colors) are picked from DUEL and must meet contrast rules (text 4.5:1, large text and focus rings 3:1) |
| Examples and fixture games | Art and colors from DUEL |
| `content` | The palette is game content: a game's `content/palette` file is compiled like any other content and hashed with it, so pipelines and the renderer read one source. AF ships DUEL as the default. |
| `post-retro` | The palette LUT pass quantizes to the game's palette (default DUEL) |
| `pipelines` | A palette gate: pixel-art assets may only use palette colors (exact match, alpha aside); lit and 3D assets are checked after the palette LUT. The gate reports facts (off-palette color counts); a person decides on exceptions. |
| `feel` | Particle and flash colors come from the palette |
