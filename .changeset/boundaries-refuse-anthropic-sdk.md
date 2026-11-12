---
'@automata/tools': patch
---

`automata-check-boundaries --browser` refuses `@anthropic-ai/sdk` (a Node-only library) in a browser package's entries, as it does `fontkit`, `pngjs` and `subset-font`.
