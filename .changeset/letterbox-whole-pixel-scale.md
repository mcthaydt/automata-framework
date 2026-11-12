---
'@automata/framework': patch
---

The letterbox takes an opt-in `scale` option (`renderer: { scale: 'whole' }`, also read by `createPixi3dRenderer`): the field is drawn at a whole number of device pixels per field pixel, centred and clipped to its own rectangle, so no pixel is drawn wider than another. The default, `'fit'`, is today's fractional scale to the view's width and changes no frame.
