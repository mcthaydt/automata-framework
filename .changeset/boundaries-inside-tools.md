---
'@automataframework/automata-tools': patch
---
The determinism and layout checker is part of `@automataframework/automata-tools`: the `automata-check-boundaries` bin comes with it, `automata check` runs it with nothing else installed, and `@automataframework/automata-check-boundaries` is no longer a package. The root entry exports `defineShipConfig` and the types of its sections, and nothing else.
