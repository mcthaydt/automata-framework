---
---

CI only: the parity job runs on af-mac (on the host; macOS runners cannot run containers), or on `vars.AF_PARITY_RUNNER` in the pinned Playwright container, and `ship`'s workflow test requires that. No package changes.
