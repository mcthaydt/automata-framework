---
'@automataframework/tools': patch
---

`automata-check-boundaries --confine <package>:<folder> <root>...` fails when a source under the roots outside the folder imports the package, so a private package stays behind its one door.
