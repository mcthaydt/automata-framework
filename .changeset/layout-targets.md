---
'@automataframework/automata': patch
---

Testing: `checkLayout` holds controls to the targets in its conditions. `publishConditions(root, size, variant, targets?)` takes them (`Conditions.targets`), and the default stays the touch rule, `TOUCH_TARGETS` (44 px, a primary 48). A screen held with a mouse, such as an editor, may pass smaller targets; the `Targets` type and `TOUCH_TARGETS` are exported.
