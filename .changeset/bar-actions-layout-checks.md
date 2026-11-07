---
'@automata/framework': patch
---
The layout checks that every screen's `checkLayout` runs now also fail a button that its bar cuts off (`findCutByBar`) and a bar button that something else covers (`findCovered`), judged for the controls inside `[data-region=topbar|rail|panel|dock|tools]` (`BAR_ACTIONS`). A modal dialog may cover a bar, and so may anything the caller excuses. `testing/fixtures` exports all three.
