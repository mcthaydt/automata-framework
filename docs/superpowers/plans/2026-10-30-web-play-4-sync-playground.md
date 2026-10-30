# WEB.PLAY.4: the site's side of the playground runtime (plan)

> **Spec:** `docs/superpowers/specs/2026-10-30-live-playground-design.md` (WEB.PLAY.0), §5.1, §5.2, §5.5, §11.3, §17
> (WEB.PLAY.4). **Lane:** website. **Stacked on** #15 (WEB.S1, the re-sync to framework `main`).
> **Branch:** `claude/website-WEB.PLAY.4-sync-playground`.

The framework's side is merged (WEB.PLAY.1 #199, .2 #209, .3 #216). Its `build:playground` stops at the manifest's
licence check until the framework repacks `vendor/ruken` from Ruken's MIT release (PLAY-D16), so this task lands in
two parts.

## Part A (this PR): everything that does not need the built runtime

| Interface | File | Notes |
| --- | --- | --- |
| `compileExample(source, { id, moduleUrl })` → `{ ok: true, code }` or `{ ok: false, diagnostics }` | `src/lib/playground/compile.ts` | §5.2, in order: Babel parse (diagnostic at `loc`, 1-based), import rule (`@mcthaydt/automata`, `zod`), loop guard (`__afLoop(<line>);` first in every loop body, a non-block body wrapped, no newline added), `import.meta.url` rewrite to the string `moduleUrl`, sucrase type strip (lines kept), `//# sourceURL=examples/<path>` |
| The protocol copy | `src/lib/playground/protocol.ts` | the framework's `tooling/examples-runner/src/playground/playground-protocol.ts` at `framework.ref`, verbatim after a first line naming the commit; written by `scripts/sync-playground.ts`, never by hand |
| `playgroundHeaders` (§11.3) in the static server and the dev server | `scripts/serve-static.ts`, `vite.config.ts` | `Access-Control-Allow-Origin: *`, `Cross-Origin-Resource-Policy: cross-origin`, `Cache-Control` immutable under `/playground/runtime/` and `no-cache` elsewhere under `/playground/`; nothing outside it |

Dependencies: `@babel/parser` 8.0.10 and `sucrase` 3.35.1 (both MIT, read from npm on 2026-10-30), the versions the
spec's measurements used.

### Steps (TDD)

1. [x] `tests/playground/compile.test.ts`, failing first (module missing): types stripped with every line kept
   (`shapes-rects.ts` from the framework at `framework.ref`); a syntax error inside a system reported at its own line
   (the spec's measured case: line 21, column 18); the import rule (a `lodash` import is a diagnostic at its line, a
   type-only import of another module, a re-export and `import x = require(…)` also); the guard in `for`, `for…of`, `for…in`, `while`, `do…while` and a
   non-block body, with line numbers unchanged; `import.meta.url` rewritten and nothing else (`import.meta.env` kept);
   the `sourceURL` line. Then the module.
2. [x] `tests/serve-static.test.ts` gains: `/playground/runtime/x.js` carries the three headers, `/playground/x/`
   `no-cache`, `/examples` none of them (fails first). Then `serve-static.ts`; then the dev-server plugin with a unit
   test on the middleware.
3. [x] `pnpm sync` to framework `main` (`30e9606`, after #216 and #223; it has the protocol), `scripts/sync-playground.ts` copying the
   protocol and the header rule, and `tests/playground-sync.test.ts`: each copy equals the framework file at `framework.ref` (fails
   first: no copy).
4. [x] Gates: `pnpm check`, `pnpm test`, `pnpm build`, `pnpm check:site`.

## Part B (after the repack): the runtime itself

`sync-playground` runs the framework's `build:playground --site-origin <the site's origin>`, checks the tree against
its `manifest.json`, copies it to `static/playground/`, writes `src/data/examples.json` from `catalog.json` and the
precompiled originals (`static/playground/compiled/<id>.js`, each `compileExample` of its source, with a test that
each equals a fresh compile); `builtPages`, `readFontFaces` and the sitemap leave `playground/` out. The local servers
serve frame pages built for their own origin (R-2).

### Part B steps (TDD)

Branch `claude/website-WEB.PLAY.4b-runtime`, from `main` after #16. The framework repack is on framework `main` (#236,
RukenApp `e376a2d`, MIT); `build:playground --site-origin https://automata.ruken.com` there wrote 17 examples, 47 files,
runtime 442,148 B gzip of 460,000 (run 2026-10-30 in this container).

| Interface | File | Notes |
| --- | --- | --- |
| `syncPlaygroundTree(frameworkDir, commit)` | `scripts/sync-playground.ts` | runs the framework's `build:playground --site-origin <SITE_ORIGIN>` into a scratch `dist-playground`, refuses a tree whose `manifest.json` does not list every file with its sha256 or names another commit, copies it to `static/playground/`, writes `static/playground/compiled/<id>.js` and `src/data/examples.json` |
| `verifyPlaygroundTree(dir, commit)` | `scripts/sync-playground.ts` | the manifest check, shared by the sync and the test |
| `framePageForOrigin(html, origin)` | `scripts/playground-origin.ts` | R-2 for the local servers: a frame page's `connect-src` names the origin serving it; `serve-static.ts` and the Vite plugin apply it to `/playground/examples/**/index.html` |
| `builtPages`, `readFontFaces`, the sitemap | `scripts/site-checks.ts`, `scripts/write-seo-files.ts` | leave `playground/` out, as they leave `demos/` out |
| `RAW_DEMOS` | `scripts/sync-demos.ts` | `bodies-2d` removed: framework `main` no longer has `examples/physics/bodies-2d`. `ui-primitives`, `hot-reload` and `base-2d` still build there and stay until WEB.PLAY.5 replaces the gallery |

1. [ ] `tests/playground-tree.test.ts`, failing first (no tree): `static/playground/manifest.json` names the commit in
   `framework.ref` and its site origin is `SITE_ORIGIN`; every file under `static/playground/` (except `compiled/`) is
   listed with its bytes and sha256, and the manifest lists nothing missing; `src/data/examples.json` is the tree's
   `catalog.json`; each `compiled/<id>.js` equals a fresh `compileExample(source, { id, moduleUrl })`, and every
   example has one. `verifyPlaygroundTree` gets a fixture test: a changed byte, an unlisted file and a missing file are
   each refused.
2. [ ] `tests/site-checks.test.ts` gain: a page under
   `playground/` is not a site page and its stylesheet is not a site stylesheet (fail first). Then the filters.
3. [ ] `tests/playground-origin.test.ts`: `framePageForOrigin` swaps the `connect-src` origin and nothing else, and refuses a page
   without one; `tests/serve-static.test.ts` gains: a frame page is served with the server's own origin in `connect-src`
   (fail first). Then `serve-static.ts` and the Vite plugin.
4. [ ] `RAW_DEMOS` without `bodies-2d` (the sync test fails first on the missing source), then `pnpm sync` and
   `pnpm sync:stack` at framework `main`; `framework.ref` moves there.
5. [ ] Gates: `pnpm check`, `pnpm test`, `pnpm build`, `pnpm check:site`, and the browser specs that open `/demos/` and
   the gallery (`tests/e2e/site.e2e.ts`).

## Execution log

- **Step 1.** `tests/playground/compile.test.ts` failed first ("Cannot find module …/compile"), then 6 passed: lines
  kept on `shapes-rects.ts`, the syntax error inserted at line 21 reported at line 21 and the `;`'s column, the import
  rule, the guard in five loop forms with no line added, `import.meta.url` rewritten and `import.meta.env` kept.
- **Step 2.** The two `serve-static` cases: the `/playground/` one failed first (no CORS header), then passed; the
  dev-server plugin's test failed first (module missing), then passed. The header rule is the framework's
  `playground-headers.ts`, copied (step 3), not a second copy written here.
- **Step 3.** The four demo bundles rebuilt at framework `30e9606`; `pnpm sync` (demos, docs, then the new
  `sync-playground.ts`) and `pnpm sync:stack`; `framework.ref` is `30e9606`. `tests/playground-sync.test.ts` failed
  first (ENOENT on the copies), then passed for both copies.
- **Step 4.** `pnpm check` 0 errors; `pnpm test` 49 files, 302 passed, 1 expected fail; `pnpm build`;
  `pnpm check:site` 28 pages.
- **Independent review (a separate agent reading the diff against the spec), all addressed test-first:**
  1. A loop guard and an `import.meta.url` rewrite at the same offset: the rewrite cut the guard away
     (`while (x) import.meta.url`, `do import.meta.url; while (0)`, and a block body starting with it, where the
     edited text did not even parse). Three cases failed first; at one offset a replacement is now applied before an
     insertion.
  2. `import x = require('m')` and `export import y = require('m')` passed the import rule (sucrase then dropped them).
     Now the import diagnostic; with them, cases for a type-only import and a named re-export of another module.
  3. A non-declare `namespace` (sucrase drops its body) and `export =` (sucrase writes `module.exports`) ran as
     something else. Both are diagnostics now; `declare namespace` and `declare module 'm'` still compile.
  4. A sucrase failure kept its "Error transforming <file>:" prefix and "(l:c)" suffix, with a column shifted by the
     guards (and off by one: sucrase's column is already 1-based). `sucraseDiagnostic` strips both and maps sucrase's
     offset back past the edits; Babel catches every syntax error first, so it is tested directly.
  5. A 404 under `/playground/runtime/` was served `immutable`; the static server now applies the playground rule only
     to files that exist (failed first). The dev plugin's comment says Vite's static middleware sets its own
     Cache-Control there.
  6. Test gaps: labeled, `for await` and empty-bodied loops.
  After: `pnpm check` 0 errors; `pnpm test` 49 files, 308 passed, 1 expected fail; `pnpm build`; `pnpm check:site` 28 pages.
