---
---

CI only: the release workflow is three jobs (`plan`, `version`, `publish`), and only `publish` waits for the Owner's approval in the `release` environment; `ship`'s workflow test pins the shape. No package changes.
