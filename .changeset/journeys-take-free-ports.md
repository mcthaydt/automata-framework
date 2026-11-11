---
'@automata/tools': patch
---

Browser journeys take free ports from the operating system when their Playwright config loads, instead of ports worked out from the checkout and `AF_RUNNER_PORT_OFFSET`, so jobs sharing a machine never meet on a port. `AF_RUNNER_PORT_OFFSET`, `AF_E2E_*_PORT` and `QB_*_PORT` no longer do anything.
