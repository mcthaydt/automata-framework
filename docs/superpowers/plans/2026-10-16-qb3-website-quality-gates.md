# QB.3: website quality gates TDD plan

- **Spec:** framework repo `docs/superpowers/specs/2026-10-16-quality-bar-design.md` (§3 F-1 to F-6, §4.2, §7 QB.3, §9 QB-c). Approved by the Owner 2026-10-16 with QB-D1 (no analytics, no cookies) and QB-D3 (a contact email and a security email, no postal address).
- **Status:** drafted 2026-10-16.
- **Progress:** 2 of 11 steps.
- **Branch:** `claude/clever-pasteur-ujmu6e-qb3`.

## Global constraints

- **Strict TDD:** every gate gets a failing fixture first. Run it, confirm it fails for the expected reason, make the minimal change, confirm it passes, then confirm the real site passes.
- **Gates for the PR:** `pnpm check`, `pnpm test`, `pnpm build`, `pnpm check:site` and `pnpm test:e2e` (Chromium and WebKit). Report selected, omitted and pending gates.
- **Ports:** the Playwright servers use 4650 (built site) and 4651 (browser fixtures) only.
- **No new heavy dependencies.** Added: `@playwright/test` 1.63.0 (the framework's pin) and `@axe-core/playwright` 4.13.0. Image work uses the Playwright Chromium already installed (`PLAYWRIGHT_BROWSERS_PATH=/home/user/pw`), not `sharp`.
- **Never tick Owner acceptance.** The real-phone, Safari and second-person journey stays open.
- **The framework repo is read, never edited.** Tests that read it use the sibling checkout `../automata-framework`, as `tests/api-contract.test.ts` already does.

## Interfaces

- **Produced:**
  - `checkSite(root: string, options?: { now?: Date }): string[]` in `scripts/site-checks.ts`: every `check:site` rule, returning one message per failure. `scripts/check-site.ts` runs it on `build/` and throws on any message.
  - `writeSeoFiles(root: string, origin: string): void` in `scripts/write-seo-files.ts`: writes `sitemap.xml` (the canonical URL of every prerendered page) and `robots.txt` into the build. Runs after `vite build`.
  - `BANNED_PHRASES` in `scripts/site-checks.ts`.
  - `tests/e2e/gates.ts`: `watchPage(page, origin)` (console errors, `pageerror`, third-party requests), `horizontalOverflow(page)`, `cookieNames(context)`, `unreachableOrUnringed(page)` (keyboard reach and focus ring), `deadButtons(page)`, `axeViolations(page)`. The site suite asserts each returns nothing; the fixture suite asserts each catches its planted fixture.
- **Consumed:** the prerendered build (`build/`), `SITE_ORIGIN` (`src/lib/site.js`), the framework's `packages/*/package.json` `license` fields and root `LICENSE`.

## Files

- **Create:** `scripts/site-checks.ts`, `scripts/write-seo-files.ts`, `scripts/serve-static.ts`, `scripts/render-favicons.ts`, `scripts/encode-previews.ts`, `tests/site-checks.test.ts`, `tests/license-claim.test.ts`, `playwright.config.ts`, `tests/e2e/gates.ts`, `tests/e2e/site.e2e.ts`, `tests/e2e/gates.e2e.ts`, `tests/e2e/fixtures/*.html`, `src/routes/privacy/+page.svelte`, `src/routes/terms/+page.svelte`, `static/.well-known/security.txt`, `static/apple-touch-icon.png`, `static/favicon-32.png`, `static/previews/*.jpg` and `*.webp`.
- **Modify:** `scripts/check-site.ts`, `package.json` (`build`, `test:e2e`, devDependencies), `src/app.html` (icons), `src/routes/+layout.svelte` (font preload), `src/lib/components/Footer.svelte` (privacy, terms, contact, security), `src/lib/components/CreativeStarts.svelte`, `src/lib/components/DemoRunner.svelte`, `src/routes/+page.svelte`, `src/routes/start/+page.svelte`, `src/data/creative-starts.ts` (preview formats), `docs/2026-10-14-site-redesign-results.md` (results).

## Steps

- [x] **1. Extract `checkSite`.** Write `tests/site-checks.test.ts` with a minimal good build written to a temp directory; it expects `checkSite` to return `[]`. Confirm it fails because `scripts/site-checks.ts` does not exist. Move the current rules from `scripts/check-site.ts` into `checkSite` unchanged, then confirm the test and `pnpm check:site` pass.
- [x] **2. Sitemap and robots (F-3).** Add cases:
  - a page missing from `sitemap.xml` fails with that page's URL;
  - a sitemap entry with no page fails;
  - no `robots.txt`, or one without the `Sitemap:` line, fails.

  Confirm they fail (no rule yet). Add the rules, write `writeSeoFiles` with a test that its output passes, and append it to `pnpm build`. Confirm the real build passes.
- [ ] **3. Images (F-2) and alt text.** Add cases:
  - JPEG bytes in a `.png` file fails with the file name;
  - an `<img>` without `alt` fails (`alt=""` passes).

  Confirm they fail, add the rules, confirm `check:site` now fails on the six previews. Fix: `git mv` the previews to `.jpg`, add 640 w and 1280 w WebP copies from `scripts/encode-previews.ts`, serve them through `<picture>` with `srcset` and `sizes` and the JPEG fallback. Confirm `check:site` passes.
- [ ] **4. Favicon set.** Add cases: a missing `apple-touch-icon.png` (180 × 180) or `favicon-32.png` (32 × 32), wrong dimensions, or a page without the `<link>` fails. Confirm they fail, add the rules, render both PNGs from `favicon.svg` with `scripts/render-favicons.ts`, link them in `src/app.html`, confirm they pass.
- [ ] **5. Fonts (F-5).** Add cases: an `@font-face` without `font-display: swap`, a stylesheet or font from another origin, or a page without a `woff2` preload that exists in the build fails. Confirm they fail, add the rules. Fix: preload the Geist latin variable `woff2` in `+layout.svelte`. (The `api.fontshare.com` link named in F-5 was already replaced by `@fontsource-variable` on `main`; this step adds the gate and the preload.)
- [ ] **6. Trust pages (F-4).** Add cases: a page without footer links to `/privacy` and `/terms` and a `mailto:` contact fails; a missing `/.well-known/security.txt`, or one without `Contact:` and a future `Expires:`, fails. Confirm they fail, add the rules, then add the privacy and terms pages, the footer links and `security.txt` (QB-D3: contact and security email, no postal address).
- [ ] **7. Banned phrases.** Add a case: each phrase in `BANNED_PHRASES` in a page's text fails with the phrase. Confirm it fails, add the rule, confirm the real site passes (rewrite any copy it catches).
- [ ] **8. MIT claim (F-1).** Write `tests/license-claim.test.ts`: every framework package's `license` is `MIT` and the root `LICENSE` is the MIT text. Confirm it fails on today's framework (`UNLICENSED`, no `LICENSE`). Mark it `it.fails` with the reason `expected red until DX.11`: Vitest then passes while the claim is false and fails hard once the framework is MIT, forcing the marker's removal. The MIT copy stays on the site (the spec keeps it).
- [ ] **9. Browser gates fail on fixtures.** Add `@playwright/test` and `@axe-core/playwright`, `playwright.config.ts` (Chromium and WebKit; servers on 4650 and 4651) and `tests/e2e/gates.ts`. Write `tests/e2e/gates.e2e.ts` over `tests/e2e/fixtures/`: horizontal overflow at 375 px, a console error, a `pageerror`, a third-party request, a cookie, an element with `outline: none` on focus, a dead button, and an axe violation. Confirm each fails for its own reason before its helper exists, then implement the helper and confirm the fixture is caught.
- [ ] **10. Browser gates pass on the site.** Write `tests/e2e/site.e2e.ts`, enumerating pages from the built `sitemap.xml`, at 375×667, 768×1024, 1280×800 and 780×270 in Chromium and WebKit:
  - no horizontal scroll, console error, `pageerror`, third-party request, cookie or `localStorage` entry; axe (WCAG 2.2 AA) has no violations;
  - the header nav (or the opened mobile menu) shows every primary link; "Make your first change" is visible without scrolling at 375×667 and a Start link is in the header at every width;
  - at 1280: Tab reaches every interactive element with a visible focus ring; every visible button changes the page or navigates;
  - each image is at most 2× its rendered width;
  - an unknown path returns 404 with the branded page and links;
  - the demo runner shows loading and a failure state when its bundle fails; search shows an empty state;
  - with JavaScript off, every page shows its `h1`, main content and links;
  - Chromium only: on an emulated slow 3G connection the home page's heading and primary action appear.

  Fix every real failure it finds. Lighthouse CI is not added (step 11 records why).
- [ ] **11. Bookkeeping.** Record gate results, the pending Lighthouse budget and the open Owner acceptance pass in `docs/2026-10-14-site-redesign-results.md`, fill the execution log and hand the framework's 02 and 03 rows to the coordinator.

## Gates

`pnpm check`, `pnpm test`, `pnpm build`, `pnpm check:site`, `pnpm test:e2e`.

## Execution log

(Filled when the task is done.)
