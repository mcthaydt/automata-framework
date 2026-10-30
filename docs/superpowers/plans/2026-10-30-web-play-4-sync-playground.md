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

1. [ ] `tests/playground/compile.test.ts`, failing first (module missing): types stripped with every line kept
   (`shapes-rects.ts` from the framework at `framework.ref`); a syntax error inside a system reported at its own line
   (the spec's measured case: line 21, column 18); the import rule (a `lodash` import is a diagnostic at its line, a
   type-only import of another module also); the guard in `for`, `for…of`, `for…in`, `while`, `do…while` and a
   non-block body, with line numbers unchanged; `import.meta.url` rewritten and nothing else (`import.meta.env` kept);
   the `sourceURL` line. Then the module.
2. [ ] `tests/serve-static.test.ts` gains: `/playground/runtime/x.js` carries the three headers, `/playground/x/`
   `no-cache`, `/examples` none of them (fails first). Then `serve-static.ts`; then the dev-server plugin with a unit
   test on the middleware.
3. [ ] `pnpm sync` to framework `main` `d804033` (it has the protocol), `scripts/sync-playground.ts` copying the
   protocol, and `tests/playground-protocol.test.ts`: the copy equals the framework file at `framework.ref` (fails
   first: no copy).
4. [ ] Gates: `pnpm check`, `pnpm test`, `pnpm build`, `pnpm check:site`.

## Part B (after the repack): the runtime itself

`sync-playground` runs the framework's `build:playground --site-origin <the site's origin>`, checks the tree against
its `manifest.json`, copies it to `static/playground/`, writes `src/data/examples.json` from `catalog.json` and the
precompiled originals (`static/playground/compiled/<id>.js`, each `compileExample` of its source, with a test that
each equals a fresh compile); `builtPages`, `readFontFaces` and the sitemap leave `playground/` out. The local servers
serve frame pages built for their own origin (R-2).

## Execution log

(filled in as steps pass)
