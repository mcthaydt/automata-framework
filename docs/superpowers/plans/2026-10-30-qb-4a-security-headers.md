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

1. [ ] `tests/csp.test.ts` (fails first: no module): the meta comes first in `<head>`; each inline script's sha256 is
   listed and a `src` script is not hashed; no `unsafe-inline` or `unsafe-eval` in `script-src`; the hook applies it
   after the hydration rewrite (the hash of the rewritten script).
2. [ ] `tests/site-checks.test.ts` gains: a page without the policy, and a page whose script changed after hashing, are
   each reported (fail first).
3. [ ] `tests/security-headers.test.ts` and `tests/serve-static.test.ts`: the set on a page and under `/playground/`
   (fail first).
4. [ ] `tests/check-deployed.test.ts`: `checkHeaders` reports a missing or different header by path (fails first); the
   `--local` run checks both.
5. [ ] Gates: `pnpm check`, `pnpm test`, `pnpm build`, `pnpm check:site`, `pnpm check:deployed --local`; the browser
   suite in Chromium and WebKit for the pages whose scripts run (every page's console gate).

## Not in this task

The live origin and its TLS certificate (Owner, DX.12); the host's own header configuration, written when the host is
known, from `securityHeaders()`; the demo bundles' own policies (the AF builds each carry Ruken's); uptime and spend
alerts (QB.4b); the rollback (QB.4c).

## Execution log
