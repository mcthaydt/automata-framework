---
'@automata/framework': patch
---

The letterbox's whole-pixel scale (`scale: 'whole'`) now fits a landscape field inside the view on both sides. It took the largest whole scale the view's width allowed, so a field in a view that is wider than the field's shape was drawn taller than the view and cut at the top and the bottom.
