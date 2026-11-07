---
'@automata/tools': patch
---

`automata-check-boundaries --no-extension-imports <root>...` fails when a source under the roots imports a package from `extensions/`, so core never depends on an extension.
