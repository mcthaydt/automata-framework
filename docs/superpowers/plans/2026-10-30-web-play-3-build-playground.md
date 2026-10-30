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

1. [ ] R-6 first: a browser case "shapes-rects runs with no policy violation" in Firefox fails today (the eval
   violation from the Zod chunk). Then the no-eval entry and the chunk groups; the frame page test requires the
   no-eval script before the frame script (fails first); the case passes in all three engines.
2. [ ] Manifest, catalog and size: failing unit tests (files sorted with the right bytes and sha256; a package
   without a licence is an error; the catalog carries each entry's header fields, source and frame page URL, and
   leaves pending examples marked; the size check fails one byte over budget), then the modules.
3. [ ] The build script, then a test that reads `dist-playground/manifest.json` and checks every file in the folder is
   listed with its sha256 (fails first: no build).
4. [ ] A-17: one case per catalog example (pending ones skipped with their reason) in each engine: it reaches
   `running` with no console error and no policy violation. Fix what fails in the framework, never by loosening the
   policy.
5. [ ] Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, the `playground-*` projects through the root config.

## Execution log

(filled in as steps pass)
