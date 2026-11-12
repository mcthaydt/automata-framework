---
'@automata/3d': patch
---
A model's texture is sampled by nearest texel with no mips (it was linear, which blurred a lit model's texels into colours the palette does not hold). New: `LightPatch` and `drawLightPatches`, a patch of window light laid on the floor as stripes added to it, for a pattern the per-vertex baked light cannot say.
