---
"@automata/framework": patch
---

The theme stops double-tap zoom on the page (`touch-action: manipulation` on `html` and `body`); a canvas that wants every gesture still says `none` itself.
