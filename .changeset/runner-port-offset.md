---
'@automata/tools': patch
---

In CI, `AF_RUNNER_PORT_OFFSET` moves the fixed test-server port pair (and every port derived from it) up by that much, so several runner copies on one machine never meet on a port. Unset or empty, nothing changes.
