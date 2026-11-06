# QB.4a: HTTPS, HSTS and the header set (plan)

> **Row:** framework `docs/02-master-delivery-plan.md`, QB.4a (quality-bar spec §5 QB.4, QB-d). **Lane:** website.
> **Stacked on** #17 (DX.12, the deploy dry run). **Branch:** `claude/website-QB.4a-security-headers`.

## Goal

The site's pages carry a CSP without `unsafe-inline` for scripts, and every response the set QB.4 names: HSTS,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and a frame policy that still lets the site's pages
and demos embed each other. A script checks them against an origin. The live origin waits on the Owner's host (DX.12), so
the check runs against the build on `serve-static.ts`, which serves the same set; the browser suite then runs under the
real policy, and its console-error gate turns any CSP violation red.

## Why the CSP is written in the hook, not by `kit.csp`

`svelte.config.js` has no `kit.csp`, and SvelteKit's hash mode would hash its start script before `src/hooks.server.ts`
rewrites it (QB.3j's `hydrateAfterFirstPaint`), so the hash would never match. The hook adds the policy last, from the
final HTML: every inline `<script>` is hashed. A build has 29 such scripts, one per page, and no inline event handler.

## Interfaces produced

| Name | File | Notes |
| --- | --- | --- |
| `withContentSecurityPolicy(html)` | `src/lib/csp.ts` | a `<meta http-equiv="Content-Security-Policy">` first in `<head>`: `default-src 'self'`, `script-src 'self'` and a `sha256-` per inline script, `style-src 'self' 'unsafe-inline'` (Svelte writes style attributes; the spec forbids `unsafe-inline` for scripts only), `img-src 'self' data:`, `font-src 'self'`, `connect-src 'self'`, `frame-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` |
| `securityHeaders()` | `src/lib/security-headers.ts` | `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation, payment, usb denied; fullscreen and gamepad `self`), `Content-Security-Policy: frame-ancestors 'self'` (a meta policy cannot carry `frame-ancestors`) |
| site check | `scripts/site-checks.ts` | every built page has the meta policy first in `<head>`, and it lists the hash of each of its inline scripts |
| header check | `scripts/check-deployed.ts` | `checkHeaders(origin, paths, fetch)`: each path answers with the set; `pnpm check:deployed` runs it with the served-file check |

`serve-static.ts` adds `securityHeaders()` to every response; the playground's own headers (§11.3) still apply under
`/playground/`.

## Steps (TDD)

1. [x] `tests/csp.test.ts` (fails first: no module): the meta comes first in `<head>`; each inline script's sha256 is
   listed and a `src` script is not hashed; no `unsafe-inline` or `unsafe-eval` in `script-src`; the hook applies it
   after the hydration rewrite (the hash of the rewritten script).
2. [x] `tests/site-checks.test.ts` gains: a page without the policy, and a page whose script changed after hashing, are
   each reported (fail first).
3. [x] `tests/security-headers.test.ts` and `tests/serve-static.test.ts`: the set on a page and under `/playground/`
   (fail first).
4. [x] `tests/check-deployed.test.ts`: `checkHeaders` reports a missing or different header by path (fails first); the
   `--local` run checks both.
5. [x] Gates: `pnpm check`, `pnpm test`, `pnpm build`, `pnpm check:site`, `pnpm check:deployed --local`; the browser
   suite in Chromium and WebKit for the pages whose scripts run (every page's console gate).

## Not in this task

The live origin and its TLS certificate (Owner, DX.12); the host's own header configuration, written when the host is
known from `securityHeaders()` **and** the playground's `playgroundHeaders()` (§11.3: CORS, CORP and cache under
`/playground/`; the playground spec's R-7 asks the deploy check to request a runtime file with `Origin: null`, which
lands with WEB.PLAY.4 part B); raising HSTS from one day to a year once the live origin has passed `check:deployed` for
a week; uptime and spend alerts (QB.4b); the rollback (QB.4c).

## Execution log

2026-10-30, this container: Node 24.21.0.

- **Step 1.** `tests/csp.test.ts` failed first ("Cannot find module '../src/lib/csp'"), then 5 passed.
- **Step 2.** Three `site-checks` cases (no policy, a script changed after hashing, `unsafe-inline` in script-src)
  failed first, then passed; the test pages now go through `withContentSecurityPolicy` as built pages do.
- **Step 3.** `security-headers` failed first (module missing) and the `serve-static` case failed first (no HSTS), then
  passed.
- **Step 4.** The `checkHeaders` cases and the `--local` run failed first, then passed.
- **Step 5 (in part).** `pnpm check` 0 errors; `pnpm test` 53 files, 340 passed, 1 expected fail; `pnpm build`;
  `pnpm check:site` 28 pages; `pnpm check:deployed --local` passed with the headers on `/` and `/llms.txt`. The full
  browser suite under the policy and the header set (Chromium 153 headless shell and WebKit 26.6, two workers): 458
  passed, 2 skipped, 12.1 min. Its console-error gate would have failed on any CSP violation, and "hydration requests
  its modules only after the first contentful paint" passing in both engines shows the hashed start script ran.
- **Independent review (a separate agent: the focused tests, `check-site`, and Playwright in Chromium, WebKit and
  Firefox on 13 pages and the five demos, with Play, a scroll and a client-side navigation: no
  `securitypolicyviolation`), addressed test-first:**
  1. The demos had no script policy at all (they are copied in as built, so the page hook never sees them; the plan's
     "the AF builds each carry Ruken's" was wrong). `/demos/` now gets a whole policy in its header (`DEMO_POLICY`:
     scripts and workers from the site, `wasm-unsafe-eval` for Rapier, no inline script, no eval), the site's own
     choice for its origin, not a copy of Ruken's. All five demos reached ready under it in Chromium, WebKit and
     Firefox with no violation.
  2. `check-deployed` did not check the page policy on the live origin; `checkServedPolicies` runs the `check:site` rule
     on the HTML that `/` and `/docs` serve, so a host that rewrites the start script fails it. The header check also
     reads `/demos/` and a missing page now.
  3. The hook's regex could misread a script (CRLF, upper case, `</script >`): it now reads them as the parser does,
     and `check:site` hashes the parsed DOM (JSDOM) instead of reusing the hook's reading, so the two are independent.
  4. HSTS starts at one day (`max-age=86400`): a certificate problem on a new host then costs a day, not a year.
  5. Recorded above: the host configuration needs the playground's headers too.
  Not changed: `404.html` stays outside `builtPages` (it carries its policy); a streamed page would need the hook to
  honour `done`, as the hydration rewrite already assumes; `.mjs` is not in serve-static's types (none are built).
  After: `pnpm check` 0 errors; `pnpm test` 53 files, 345 passed, 1 expected fail; `pnpm build`; `pnpm check:site`;
  `pnpm check:deployed --local`; the full browser suite (Chromium and WebKit, two workers) 458 passed, 2 skipped, 12.1 min.
