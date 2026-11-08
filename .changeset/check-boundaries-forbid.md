---
'@automata/tools': patch
---

`automata-check-boundaries` can now refuse a package's imports. `--forbid <package-root>:<package>,…` fails any source, test or Svelte file under the root that imports one of the named packages, and `--features … --shared-island <folder>` keeps a folder of `shared/` from importing its siblings. `--features` now reads Svelte components as well as `.ts` files.
