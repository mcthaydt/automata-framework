# Plan: content's browser-safe entries (base-3d's dev server boots)

Journey J2 blocker (the Owner plays base-3d on the iPad from the dev server). Branch `claude/content-browser-entry`.
Lane: session_01QYLU1iRHT7V45nkE1aT4Lg.

**Cause.** `vite dev` of base-3d showed a blank page: `Module "node:fs/promises" has been externalized for browser
compatibility` at `packages/content/src/locale/compile-messages.ts`. figures and render-pixi3d value-import
`defineContentSchema`, `contentRef` and `DEFAULT_PALETTE` from content's root entry, which is the compiler and reaches
`node:fs/promises`, `node:path`, `node:crypto`, `node:os` and `node:module`. A production build tree-shakes those away,
so the e2e journeys (built bundles) never saw it.

**Approach.** The coordinator preferred moving the Node-only exports off the root. The root *is* the compiler
(`compileContent`, `buildContent`, `verifyContent`, `preloadList` and the errors all reach Node), so that would move most of
the published API. Instead (the coordinator's alternative): browser-safe entries, and the page's packages import them.

Interfaces produced: `@mcthaydt/automata-content/schema` (`defineContentSchema`, `contentRef`, `localized`,
`ContentSchemaDef`, `ContentSchemaOptions`, `ContentSchemaPlace`), `@mcthaydt/automata-content/palette`
(`DEFAULT_PALETTE`, `Palette`; the same entry #377 adds, so the two merge cleanly). Root exports unchanged.

## Steps

- [x] 1. Reproduce: `vite dev` of base-3d in Chromium: no canvas, the pageerror above.
- [x] 2. `packages/content/src/browser-entries.test.ts` first: each browser entry is in `exports`,
  `publishConfig.exports` and `tsdown.config.ts`, and its whole value-import graph has no `node:` module; `./schema`
  exports exactly the three helpers and imports only `zod`; the root does reach `node:fs/promises`. Failed: entries
  missing. Then `src/schema/index.ts`, `src/palette/index.ts`, the manifest and build config.
- [x] 3. `packages/{figures,render-pixi3d}/src/browser-imports.test.ts` first: no non-test source value-imports the
  content root. Failed listing 8 figures files and 3 render-pixi3d files. Then those imports (and Emberwick's
  `src/content/kinds.ts`) moved to `/schema` and `/palette`.
- [x] 4. `games/base-3d/e2e-dev/dev-server.e2e.ts` with projects `base-3d-dev` (Chromium, phone landscape) and
  `base-3d-dev-webkit` (WebKit, iPad landscape) and a `vite dev` web server on `base3dDevPort`: boots, splash, menu,
  New game, play, one canvas, no pageerror. Seen failing with one figures import put back on the root (the title
  screen never attaches); passing with the fix in both engines.
- [x] 5. Patch changeset for content; api-report; gates.

## Execution log

- 2026-11-01: steps 1–4 as above. Deviation: the coordinator's suggested failing test ("the content root entry's
  module graph contains no `node:` import") is replaced by the browser entries' graph test plus each page package's
  guard, because the root stays the compiler (approach above); the root's test asserts it reaches Node, which is why
  the entries exist.
