# Haze, sky and the dresser (2026-11-11)

Each sheet is the source's CPU frame, then AF on WebGL with the baked room light, AF on WebGL with material light only,
and AF on WebGPU, at 2× nearest. Made by `EB_DIR=<source renders> node spikes/eb-look/shoot.mjs docs/refactor/eb-look/haze-sky`
on `claude/eb-look-haze-sky` with `main` merged in (the sun, key and fill, and the WebGPU fixes).

- `base-exterior-fp.png`: the cloud-and-city sky and the haze toward the veil, on both backends.
- `base-exterior-dressed-diorama.png`: the street's planter, bin and no bench in frame, as the source's.
- `base-interior-dressed-fp.png`: the room fading toward the far wall.

What still differs: flat swatch colours against the source's tiles, figures lit by one flat tint, no glow, and the WebGPU
panels lack the figures (an open `@pixi/3d` issue, see `wp0/README.md`).
