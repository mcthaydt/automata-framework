---
'@mcthaydt/automata-render-pixi': patch
---

Add `postFilter(name, { glsl, wgsl, order?, minTier? })` and the `PixiRendererOptions.postFilters` option: a screen-space filter declared by name from its GLSL and WGSL, built when the renderer starts and kept in the stage's post-filter slot. A filter that cannot be built or whose GLSL does not link is left out with a warning and a `render.filter.dropped` fact, like every other filter. `@mcthaydt/automata-game` and `@mcthaydt/automata` re-export the verb and its types. Additive: a renderer with no `postFilters` is unchanged.
