---
---

CI only: the root `test:unit`, `test:parity` and `evidence` scripts start two vitest workers per project on CI (`VITEST_MAX_WORKERS`, which a caller can override), turbo runs four packages at once, and the Playwright journeys use two workers on CI (`AF_E2E_WORKERS` overrides); `ship`'s workflow test pins the scripts and `turbo.json`. No package changes.
