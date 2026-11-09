---
'@automataframework/automata-content': patch
---

Adds two browser-safe entries: `@automataframework/automata-content/schema` (`defineContentSchema`, `contentRef`, `localized`
and their types) and `@automataframework/automata-content/palette` (`DEFAULT_PALETTE`, `Palette`). Code that runs in the page
imports these instead of the root, which is the compiler and reaches Node built-ins: under Vite's dev server those threw
at boot and left the page blank. The root's exports are unchanged.
