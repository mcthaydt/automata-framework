---
'@automata/content': patch
---
Compiling a game's messages no longer empties the Paraglide folder on the way. The compile goes to a temporary folder and only the files that changed reach `outdir`, so a dev server watching it no longer loads a page with its message modules missing, and a compile that changes nothing touches nothing.
