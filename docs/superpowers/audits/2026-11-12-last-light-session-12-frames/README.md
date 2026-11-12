# The Last Light, session 12: frames and tables

Chromium on software GL (SwiftShader, `AF_WEBGPU=software`), 1024 by 768 for frames. WebKit, Firefox and a real GPU did not run. The old game's frames are session 8's real-play capture of `92e6704` (no `?debug`, Begin clicked).

## Item 1: setup, the check, the second night

- **Setup.** The container's local `claude/last-light-prologue` was an older divergent copy (the early sessions' commits under other hashes); it was moved to `origin/claude/last-light-prologue` (`7c3f95778`, the brief's base). Node 24.21.0 exactly (the container has 24.22.1 and 22.23.4; 24.21.0 was fetched from nodejs.org into a scratch folder), pnpm 10.34.6. `vendor/FigureBuilder` is a private repository: attached with `add_repo`, cloned to `/home/user/figurebuilder`, checked out in the submodule at its pin `23f889c8a` (a local `submodule.vendor/FigureBuilder.url` override in `.git/config`; `.gitmodules` is unchanged), then `pnpm install --frozen-lockfile` and `node vendor/figure-builder/types.mjs` (exit 0).
- **No merge.** `origin/main` (`924a26ef7`) is already an ancestor of the branch; it has `.gitmodules` with `vendor/FigureBuilder` and no `extensions/figures`, so the builders fold is not in it and there was nothing to merge.
- **The whole `pnpm check`**, alone, on `7c3f95778`: PASSED (lint, typecheck, boundaries, style, source-names, knip, `test:unit`, `check:changesets` 83 changesets, 0 problems), real 13 min 9 s.
- **The second-night journey**, alone (`pnpm --filter @af-games/the-last-light test:e2e --workers=1 --trace off --grep "second night"`, the test's own 30-minute limit, the run's limit 2 h): PASSED, 19.2 min. Session 11's run had been cut by its time limit; this is the first full run of it. The first night's and the second night's facts and items agree.
