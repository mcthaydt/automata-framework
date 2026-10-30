# WEB.PLAY.3: `build:playground` (plan)

> **Spec:** website `docs/superpowers/specs/2026-10-30-live-playground-design.md` (WEB.PLAY.0), §5.5, §10.1, §11.2,
> §12, §16 A-17, §17 (WEB.PLAY.3), risks R-6, PLAY-D16. **Lane:** website (the playground's framework side, private
> tooling). **Stacked on** WEB.PLAY.2 (#209). **Branch:** `claude/website-WEB.PLAY.3-build-playground`.

## Goal

One command writes everything the site publishes under `/playground/`, for one site origin:

```
pnpm --filter @mcthaydt/examples-runner build:playground --site-origin https://automata.ruken.com
```

and every catalog example runs in it with no policy violation in Chromium, WebKit and Firefox (A-17).

## Interfaces produced

| Name | File | Consumers |
| --- | --- | --- |
| `dist-playground/` (§5.5): `runtime/` (the Vite build), `examples/<module>/<name>/index.html` (frame pages for the given origin) and each example's public files, `examples/resources/`, `goldens/<id>.replay`, `catalog.json`, `manifest.json` | `tooling/examples-runner/playground/build-playground.ts` | the site's sync (WEB.PLAY.4); the `playground-frame` and `playground-examples` projects |
| `playgroundManifest({ framework, siteOrigin, files, packages })`: every file with bytes and sha256, sorted, and each bundled package with version and licence | `src/playground/playground-manifest.ts` | the build |
| `playgroundCatalog(entries, sources)`: the site's example data (§5.5 `catalog.json`) | `src/playground/playground-catalog.ts` | the build |
| `checkRuntimeSize(files, budget)`: gzip bytes of the runtime's JavaScript against `RUNTIME_GZIP_BUDGET` (460,000) | `src/playground/runtime-size.ts` | the build (fails over budget) |
| `PlaygroundRuntime.noEval`: a first module script that runs no-eval before any other runtime chunk (R-6) | `frame-page.ts`, `vite-runtime.ts`, `playground/runtime/no-eval.ts` | the frame pages |

## Files

- Create, each with a Node test: `src/playground/playground-manifest.ts`, `playground-catalog.ts`, `runtime-size.ts`.
- Create `playground/build-playground.ts`, `playground/runtime/no-eval.ts`, `playground/e2e/examples.e2e.ts`,
  `playground/e2e/compile-for-test.ts` (the test-only compile the frame cases already use, shared).
- Modify `playground/vite.config.ts` (the no-eval entry; Zod and Pixi in chunks of their own), `frame-page.ts` and
  its test, `vite-runtime.ts` and its test, `playground/frame-server.ts` (serves `dist-playground` as built),
  `package.json` (`build:playground`; `e2e:playground-frame` builds then serves), the root `playwright.config.ts`
  (`playground-examples-{chromium,webkit,firefox}`).

## Steps (TDD)

1. [x] R-6 first: a browser case "shapes-rects runs with no policy violation" in Firefox fails today (the eval
   violation from the Zod chunk). Then the no-eval entry and the chunk groups; the frame page test requires the
   no-eval script before the frame script (fails first); the case passes in all three engines.
2. [x] Manifest, catalog and size: failing unit tests (files sorted with the right bytes and sha256; a package
   without a licence is an error; the catalog carries each entry's header fields, source and frame page URL, and
   leaves pending examples marked; the size check fails one byte over budget), then the modules.
3. [ ] (partial: the script is in; the manifest check waits for the vendor/ruken repack, see the log) The build script, then a test that reads `dist-playground/manifest.json` and checks every file in the folder is
   listed with its sha256 (fails first: no build).
4. [x] A-17: one case per catalog example (pending ones skipped with their reason) in each engine: it reaches
   `running` with no console error and no policy violation. Fix what fails in the framework, never by loosening the
   policy.
5. [x] Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, the `playground-*` projects through the root config.

## Execution log

2026-10-30, this container: Node 24.21.0, Playwright 1.63.0, Chromium 153.0.8010.12, WebKit 26.6, Firefox 155.0.

- **Step 1 (R-6).** "shapes-rects runs with no policy violation" failed in Firefox only (3 console lines: the eval
  probe in the Zod chunk) and passed in Chromium and WebKit. Cause: Rolldown inlined no-eval into the frame chunk, so
  `config({ jitless: true })` ran after the chunks the frame imports had evaluated. The frame page test ("loads no-eval
  in its own module script, before the frame script") and the Vite manifest test failed first; then a `no-eval` entry
  loaded before the frame script, with Zod and Pixi in chunks of their own (`codeSplitting.groups`). The built no-eval
  chunk imports only the pixi and zod chunks. All 33 frame cases then passed in the three engines.
- **Step 2.** Manifest (2), size (3) and catalog (3) unit tests failed first on their missing modules, then passed.
- **Step 3, partial.** `build:playground --site-origin https://automata.ruken.com` writes the runtime, 17 frame pages,
  public files, resources, 10 goldens and catalog.json; the runtime's JavaScript is **437,229 B gzip** (budget
  460,000). It then stops, as designed, at the manifest: `@ruken/sdk-host@0.0.0 declares no licence`. The vendored
  Ruken packages have no `license` field until the coordinator repacks `vendor/ruken` from the MIT release (RukenApp
  #396, PLAY-D16). The check that every file is listed with its sha256 runs once the repack is on main.
- **Step 4 (A-17).** The first run: 47 of 51 passed; `textures-atlas` and `textures-sprite` failed in WebKit and
  Firefox with "Refused to connect to data:image/png;base64,…" (connect-src). Pixi's texture loader checks ImageBitmap
  support in a Blob worker that fetches a `data:` URL, which Ruken's own policy refuses too; the examples' Ruken smoke
  runs Chromium only, so it had not shown. Fix in the framework, never the policy: render-pixi's no-eval sets
  `loadTextures.config.preferWorkers = false`; its test failed first ("expected true to be false"). After: 84 passed
  (17 examples and 11 frame cases, three engines). render-pixi `test:parity`: 19 passed, 5 skipped. The examples'
  Ruken smoke (`--project examples`): 35 passed, 1 skipped, 1 failed on the first run: core-saves "another device
  changes the slot" timed out at 30 s with four workers on this four-CPU container; alone it passed on this branch
  (20.4 s) and on main `6aee63b` (19.7 s), so it is load, not this change. The first failure is recorded here.
- **Step 5.** `pnpm format`; `TURBO_FORCE=true pnpm check` exit 0 after two type fixes (Pixi types
  `loadTextures.config` as optional, so no-eval throws if it is ever missing; a test fixture under
  `exactOptionalPropertyTypes`).
