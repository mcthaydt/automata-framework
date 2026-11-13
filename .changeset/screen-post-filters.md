---
'@automata/framework': patch
---
`postFilter(name, { glsl, wgsl, at: 'screen' })` runs a filter on the upscaled picture at device pixels instead of on the field at its logical size (`'field'`, the default, is unchanged). A screen filter is kept in the stage's new `screenFilters` slot, on the composite's sprite, and is told each frame `uScreenScale` (device pixels a field pixel) and `uScreenOrigin` (where the field starts), so a pattern finer than a field pixel can sit on its edges, such as an LCD mesh between pixel-art texels. Without a composite it is left out with the usual dropped-filter warning.
