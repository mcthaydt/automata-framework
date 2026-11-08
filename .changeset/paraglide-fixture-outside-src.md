---
'@mcthaydt/automata': patch
---

The locale tests compile their Paraglide fixture outside `src/`, so the package build no longer reads it while a test run is deleting it.
