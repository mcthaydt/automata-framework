---
'@mcthaydt/automata-ui': patch
---

`checkLayout` no longer reports a scrolling control's words as running past its edge: a control that scrolls on an axis (a focusable scroll region with long lines) clips its words to itself on that axis. A control that cuts its words off without scrolling still fails.
