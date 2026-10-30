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
| `framePolicy(importMapText: string): string` — Ruken's CSP from `compileHeaders` (`@ruken/manifest`) with `blob:` and `'sha256-<import map>'` added to `script-src`, and `manifest-src` and `frame-ancestors` removed (a meta policy cannot carry `frame-ancestors`) | `tooling/examples-runner/src/playground/frame-policy.ts` | this proof's frame page; `playgroundFramePage` (WEB.PLAY.2) |
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

1. [ ] **Failing unit tests.** `frame-policy.test.ts`: the policy starts from Ruken's (every Ruken directive but
   `manifest-src` and `frame-ancestors` is present unchanged), `script-src` gains `blob:` and the hash, the hash is
   the base64 SHA-256 of the exact text, and the policy has no `'unsafe-eval'` or `'unsafe-inline'` in `script-src`.
   `playground-headers.test.ts`: the three cases above and a path that only starts with `/playgroundx`. Run
   `pnpm --filter @mcthaydt/examples-runner exec vitest run --project node src/playground`: fails, modules missing.
2. [ ] **Minimal code** for both; the same command passes.
3. [ ] **Failing browser test.** `feasibility.e2e.ts`, first case: "a Blob module in an opaque-origin frame imports
   zod through the import map". Run `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-local pnpm exec playwright test --project
   playground-chromium -g "Blob module"`: fails because no frame page exists (server 404).
4. [ ] **Server, pages and scripts**; the case passes in Chromium.
5. [ ] **The other cases**, each seen to fail first against a planted defect (a policy without `blob:`; a frame
   without the import map hash; the headers removed): `'self'` loads a site module; `eval` throws and a
   `securitypolicyviolation` names `script-src`; `fetch` to another origin is refused; `/bare/` fails and
   `/playground/runtime/` loads; the parent cannot read `frame.contentDocument` and the frame reports its
   origin as `null`.
6. [ ] **R-1 measurement**: two fresh frames in turn, count the server's requests for the runtime module per frame;
   record the numbers per engine in the execution log; the test asserts only that both frames ran.
7. [ ] **All three engines**: `--project playground-chromium --project playground-webkit --project
   playground-firefox`.
8. [ ] **Gates**: `pnpm format`; `TURBO_FORCE=true pnpm check`. No published package changes, so no changeset,
   api-report or agent-skills change; no sim, renderer or golden changes, so no parity run.

## Execution log

(filled in as steps pass)
