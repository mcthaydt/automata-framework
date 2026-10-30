# WEB.PLAY.1: playground feasibility proof (plan)

> **Spec:** website `docs/superpowers/specs/2026-10-30-live-playground-design.md` (WEB.PLAY.0, approved by the Owner
> 2026-10-30), §5.3, §11.2, §11.3, §17 (WEB.PLAY.1), risks R-1, R-2, R-3.
> **Lane:** website (the playground's framework side, private tooling in `tooling/examples-runner`).
> **Branch:** `claude/website-WEB.PLAY.1-playground-feasibility`.

## Goal

Before any playground code depends on it, prove in Chromium, WebKit and Firefox that:

1. a page served from the site, framed with `sandbox="allow-scripts"` (an opaque origin), can load the site's own
   module scripts under the §11.2 policy, so `'self'` means the site inside an opaque-origin document (R-2);
2. a Blob module created in that frame resolves the bare import `zod` through the frame's import map (R-3);
3. `eval` and a request to another origin are refused by the policy;
4. the §11.3 headers are needed (a module without `Access-Control-Allow-Origin` fails from `Origin: null`) and
   sufficient (the same file with them loads);
5. whether a second fresh frame reuses the HTTP cache for an immutable module (R-1): measured and recorded below,
   not asserted, because PLAY-D5 picks its design from the answer.

## Interfaces produced

| Name | File | Consumers |
| --- | --- | --- |
| `framePolicy(importMapText: string, siteOrigin: string): string` — Ruken's CSP from `compileHeaders` (`@ruken/manifest`, for the examples' own manifest `EXAMPLES_SHIP_CONFIG`) with `blob:` and `'sha256-<import map>'` added to `script-src`, the site's origin added to `connect-src` beside `'self'` (the R-2 finding below), and `manifest-src` and `frame-ancestors` removed (a meta policy cannot carry `frame-ancestors`) | `tooling/examples-runner/src/playground/frame-policy.ts` | this proof's frame page; `playgroundFramePage` (WEB.PLAY.2) |
| `playgroundHeaders(pathname: string): Record<string, string>` — the §11.3 rule: `Access-Control-Allow-Origin: *` and `Cross-Origin-Resource-Policy: cross-origin` for every path under `/playground/`, `Cache-Control` immutable under `/playground/runtime/` and `no-cache` elsewhere under `/playground/`; `{}` outside it | `tooling/examples-runner/src/playground/playground-headers.ts` | this proof's server; the site's `serve-static.ts` and dev server copy the rule in WEB.PLAY.4 |
| The feasibility server (Node `http`, no framework code) | `tooling/examples-runner/playground/feasibility-server.ts` | the `playground-*` Playwright projects |

Consumed: `compileHeaders` and `parseManifest` from the vendored `@ruken/manifest` (never a retyped CSP), zod 4.6.6's
published ESM files (served as they are; the playground runtime build replaces them in WEB.PLAY.3).

## Files

- Create `tooling/examples-runner/src/playground/frame-policy.ts`, `frame-policy.test.ts`.
- Create `tooling/examples-runner/src/playground/playground-headers.ts`, `playground-headers.test.ts`.
- Create `tooling/examples-runner/playground/feasibility-server.ts` (serves `/` the parent page, `/frame/` the frame
  page, `/playground/runtime/**` zod with the §11.3 headers, `/bare/**` the same files without them, `/requests` the
  request log, `/reset` to clear it) and `tooling/examples-runner/playground/static/{parent,frame}.js` (plain
  browser scripts, no inline script anywhere).
- Create `tooling/examples-runner/playground/e2e/feasibility.e2e.ts`.
- Modify `tooling/examples-runner/host/ports.ts` (`playgroundPort`, slot 8), `tooling/examples-runner/package.json`
  (`e2e:playground` script), the root `playwright.config.ts` (projects `playground-chromium`, `playground-webkit`,
  `playground-firefox` and the server).

## Steps (TDD)

1. [x] **Failing unit tests.** `frame-policy.test.ts`: the policy starts from Ruken's (every Ruken directive but
   `manifest-src` and `frame-ancestors` is present unchanged), `script-src` gains `blob:` and the hash, the hash is
   the base64 SHA-256 of the exact text, and the policy has no `'unsafe-eval'` or `'unsafe-inline'` in `script-src`.
   `playground-headers.test.ts`: the three cases above and a path that only starts with `/playgroundx`. Run
   `pnpm --filter @mcthaydt/examples-runner exec vitest run --project node src/playground`: fails, modules missing.
2. [x] **Minimal code** for both; the same command passes.
3. [x] **Failing browser test.** `feasibility.e2e.ts`, first case: "a Blob module in an opaque-origin frame imports
   zod through the import map". Run `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-local pnpm exec playwright test --project
   playground-chromium -g "Blob module"`: fails because no frame page exists (server 404).
4. [x] **Server, pages and scripts**; the case passes in Chromium.
5. [x] **The other cases**, each seen to fail first against a planted defect (a policy without `blob:`; a frame
   without the import map hash; the headers removed): `'self'` loads a site module; `eval` throws and a
   `securitypolicyviolation` names `script-src`; `fetch` to another origin is refused; `/bare/` fails and
   `/playground/runtime/` loads; the parent cannot read `frame.contentDocument` and the frame reports its
   origin as `null`.
6. [x] **R-1 measurement**: two fresh frames in turn, count the server's requests for the runtime module per frame;
   record the numbers per engine in the execution log; the test asserts only that both frames ran.
7. [x] **All three engines**: `--project playground-chromium --project playground-webkit --project
   playground-firefox`.
8. [x] **Gates**: `pnpm format`; `TURBO_FORCE=true pnpm check`. No published package changes, so no changeset,
   api-report or agent-skills change; no sim, renderer or golden changes, so no parity run.

## Execution log

Measured 2026-10-30 in this container (Linux, 4 CPUs), Node 24.21.0, Playwright 1.63.0 with Chromium 153.0.8010.12
(headless shell), WebKit 26.6 and Firefox 155.0.

- **Step 1.** Both unit files failed first with "Cannot find module './frame-policy.ts'" and "./playground-headers.ts".
  A first draft parsed a hand-written probe manifest, which Ruken's parser refused (missing `schema`, `game.sdk`,
  `runtime`, `content`); the policy now reads the examples' own manifest, `EXAMPLES_SHIP_CONFIG`, moved out of
  `vite-plugin.ts` into `src/examples-ship-config.ts` so the runner and the policy share it.
- **Step 2.** 6 unit tests passed.
- **Step 3.** The Blob case failed in Chromium with `TypeError: window.probe is not a function` (the server served
  only an empty parent page).
- **Step 4.** The Blob case passed in Chromium, WebKit and Firefox: **R-3 does not bite**; a Blob module made in an
  opaque-origin frame imports `zod` through the frame's import map in all three engines.
- **Step 5, R-2 found in WebKit.** `fetch('/playground/runtime/probe.txt')` from the frame failed in WebKit only
  ("Load failed", a `connect-src` violation): WebKit does not match `'self'` to the site for a fetch from an
  opaque-origin document, while it does for module scripts and images (both cases pass). Chromium and Firefox pass.
  So the risk's fallback applies to `connect-src` alone: the unit test "names the site's origin in connect-src beside
  'self'" failed first (`'self'` received), then `framePolicy` took `siteOrigin` and passed. **Consequence for
  WEB.PLAY.2 to .4:** a frame page's policy names the origin it is served from, so frame pages are written for one
  origin (the build or the site's sync takes the origin; local test servers get their own). The website spec's §11.2
  needs this line; it goes in the next website PR. Also seen: WebKit refuses `eval` with an `EvalError` but fires no
  `securitypolicyviolation` event, so the eval case reads the error; the spec's A-17 listener cannot rely on the
  event in WebKit for eval.
- **Planted defects.** `blob:` removed from `script-src`: the Blob case fails in all three engines, nothing else. The
  `Access-Control-Allow-Origin` header removed: all 24 cases fail (the frame's own script cannot load from
  `Origin: null`), so the §11.3 headers are needed for every module the frame loads; `/bare/` fails while
  `/playground/runtime/` loads, so they are sufficient.
- **Step 6, R-1 measured: the cache is reused.** Server requests for `/playground/runtime/cache-probe.js` (served
  `public, max-age=31536000, immutable`), first fresh frame then second: Chromium 1, 0; WebKit 1, 0; Firefox 1, 0. A
  new opaque-origin frame in the same page reuses the HTTP cache, so PLAY-D5's default (a fresh frame per run) stands.
  This is one module and an in-memory cache in a headless browser; the full runtime's warm-frame time is WEB.PLAY.3's
  and WEB.PLAY.11's to measure against the 1,000 ms budget.
- **Step 7.** Through the root `playwright.config.ts`: `--project playground-chromium --project playground-webkit
  --project playground-firefox`, 24 passed (43.7 s, including the other projects' servers starting).
- **Step 8.** `pnpm format`; `TURBO_FORCE=true pnpm check` exit 0 (33 tasks). knip first flagged the served browser
  scripts as unused files, so `knip.jsonc` ignores `tooling/examples-runner/playground/static/**` with the reason.
