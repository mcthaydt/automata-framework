# QB: the quality bar (doesn't look vibecoded)

- **Status:** drafted 2026-10-16 (QB.0). **Pending Owner review.** Nothing here is implemented before that review (AGENTS.md: a draft spec does not authorize implementation). QB-D1 to QB-D4 (§8) run on their recommended defaults until the Owner changes them.
- **Source:** the Owner's checklist of 2026-10-16 ("a checklist to make sure it doesn't look vibecoded"), about 300 items in 27 groups.
- **Evidence for "today":** `mcthaydt/automata_website` at `bfeaf91` (`main`) and this repo at `489f170`. Each claim below names the file or command it came from.

## 1. The rule

A vibecoded project claims what it doesn't do and builds what it doesn't need. So every checklist item gets exactly one of four dispositions, and the disposition is the deliverable:

| Disposition | Meaning | Evidence that closes it |
|---|---|---|
| **Gate** | AF has this surface. A check fails when the item regresses. | The check, in `pnpm check`, `check:site`, `automata check` or CI, with a failing fixture |
| **Task** | AF has this surface but no check can prove it (a policy, a page, an Owner setting). | The artifact, plus a test that it exists and is linked, where one is possible |
| **Ruken** | The item is about hosting other people's games. Ruken is that host (law 7, ADR 0004). | A request filed with Ruken (§6). AF never re-implements it |
| **Not applicable, with a trigger** | AF has no such surface today. | The row names what would make it apply. That change must reopen the row in its own spec |

Building SCIM for a static docs site, or a status page for a library, is itself the vibecoded tell. "Not applicable" is a real answer only when it names its trigger.

## 2. What AF actually runs

| Surface | What it is | Holds user data? |
|---|---|---|
| Framework packages | TypeScript libraries; core goes to public npm (DX.11), extensions to the private Plus registry (PRODUCT.5) | No |
| Games built on AF | Static bundles that run inside Ruken's iframe under Ruken's CSP | Only through the Ruken SDK (saves, session), which Ruken owns |
| Website `automata.ruken.com` | SvelteKit `adapter-static`, prerendered (`svelte.config.js`), not yet deployed (DX.12) | No forms, no accounts, no cookies, no analytics today |
| Automata Plus store | Not built (PRODUCT.5, master spec D-7) | Purchases and registry access, once built |
| Multiplayer server | Colyseus room server for the `net` extension (M7, Plus) | Room state and session tokens, once built |
| Agent package | Skills and instructions (DX.7); AF's runtime calls no model | No |

AF has no database, no login, no file uploads, no tenants and no model calls. That one fact decides most of the checklist.

## 3. Findings today (evidence-backed)

Already true, so these become regression gates rather than new work:
- **Website metadata.** Every built page has one `title`, `h1`, `main#main`, `meta[name=description]`, `og:title` and canonical link, and every internal link and anchor resolves (`scripts/check-site.ts`). OG image, `twitter:card` and `og:url` are set in `src/routes/+layout.svelte`.
- **Website basics.** A custom error and 404 page (`src/routes/+error.svelte`, `fallback: '404.html'`), a skip link (`+layout.svelte`), `:focus-visible` styles (4 rules in `src/app.css`), and `alt` on every `<img>` in `src/` (grep finds none without it).
- **Framework CI hardening.** All five workflows declare `permissions:`, and every action is pinned to a 40-character SHA (`.github/workflows/*.yml`: 33 pinned uses, 0 tag-pinned).
- **Process.** Code review through PRs, written ADRs (`docs/adr/`), Changesets changelogs, no `git stash`, strict TDD and determinism gates (AGENTS.md).

Wrong or missing, found while mapping the checklist:

| # | Finding | Evidence | Fix |
|---|---|---|---|
| F-1 | The site says "MIT" but every package says `"license": "UNLICENSED"` and there is no `LICENSE` file | `grep '"license"' packages/*/package.json` gives 10 × `UNLICENSED`; `ls LICENSE*` finds nothing; `Footer.svelte`, `audience.ts` FAQ | Already DX.11 (03 records the gap). QB.3 adds a site test that holds the claim until it is true |
| F-2 | Six preview images are JPEG data in `.png` files | `file static/previews/*.png` reports JPEG for all six | QB.3: re-encode or rename, plus a check that a file's bytes match its extension |
| F-3 | No `robots.txt` and no `sitemap.xml` | `ls static` | QB.3 |
| F-4 | No privacy page, no terms page, no contact, no security contact | No route; no `mailto`, contact or security link in `src/` | QB.3, QB.1 |
| F-5 | Fonts load from a third party (`api.fontshare.com`) on every page | `src/app.html` lines 7–9 | QB.3: self-host. It removes a third-party request (privacy) and a render-blocking cross-origin stylesheet (performance) |
| F-6 | The website has no real-browser tests: nothing checks breakpoints, horizontal scroll, keyboard reach or console errors | `tests/` holds Vitest/JSDOM suites only | QB.3 |
| F-7 | The framework repo has no root `README`, no `SECURITY.md`, no `CODEOWNERS`, no dependency update bot and no dependency audit in CI | `ls -a`, `ls .github`, `grep audit package.json ci.yml` | QB.1 |
| F-8 | Every repo, the npm scope and the domain are in a personal name (`mcthaydt`, `@mcthaydt`, `ruken.com`), with one maintainer | Repo and package names | Owner to-do (QB-D4) |

## 4. Disposition by checklist group

Groups are the Owner's headings. A group whose items share a disposition is one row; items that differ get their own rows.

### 4.1 Anti-vibe website additions (the long list)

| Items | Disposition | Owner and how it closes |
|---|---|---|
| Schema someone designed; migrations; indexes; connection pooling; backups, tested restore, PITR; soft deletes; pagination; exports and imports; retention | N/A: no database | **Trigger:** the Plus store or the M7 server stores records. Their specs then own every row here |
| Plus-sign emails, password reset, MFA, sessions, SSO, SAML, SCIM, roles, IDOR, tenant isolation, impersonation, login rate limits, lockouts | N/A for AF: no accounts. Player accounts are Ruken's | **Trigger:** a Plus account system. QB-D2 avoids one (the merchant of record and GitHub hold identity) |
| Server-side validation | Gate | Games: the sim validates every command (law 1), and Zod validates content and saves (ADR 0001). M7 server: every client message is Zod-validated server-side, in M7.0's acceptance (§5) |
| Apostrophes, emoji, accents, RTL in every field; translations with locale dates and numbers | Gate | PRODUCT.L: `xx-long` pseudo-locale, `Intl` formatting, `dir` (cases L-a to L-e). Name entry in kits gets an RTL and emoji fixture (PRODUCT.6) |
| Timezones | N/A: the sim has no wall clock (law 2); the host owns time | **Trigger:** scheduled features (daily challenges) |
| Money as integers; currency, rounding, tax and VAT for every country | Task | QB.5: the merchant of record computes tax and charges (QB-D2). Any amount AF code handles is integer minor units, with a test |
| Idempotency keys; double-submit dedupe | Task | QB.5: the purchase webhook is idempotent on the provider's event ID |
| Secrets out of code, repo and AI chat; rotate keys pasted by an AI | Gate | QB.1: a secret scan (gitleaks) over the full history in CI; QB.2: a scan of every built game bundle. No AF code holds a secret today; the release token is a GitHub secret |
| Confirm every AI-installed package exists and is intended; dependency scanning; monthly upgrades; upgrade before end of support | Gate | QB.1: a new-dependency report on each PR (name, registry, publisher, weekly downloads, versus `main`), `pnpm audit --prod --audit-level=high` in `ci:local` and CI, and a monthly update PR from Renovate. Ruken pins follow Ruken's `docs/versions.md` |
| Input sanitization; OWASP (XSS, CSRF, injection) | Gate | Website: static with no inputs; the CSP blocks inline script (QB.4). Games: Ruken's CSP plus `no-eval`; `ui` renders text with Svelte escaping (`{@html}` is forbidden by a style rule, QB.2). No SQL anywhere |
| File uploads | Ruken | Game uploads are Ruken's (§6). AF has none |
| CORS; security headers; encryption in transit | Task | QB.4 with DX.12: HTTPS with HSTS and the header set. Games inherit Ruken's headers |
| Encryption at rest | N/A: nothing stored | Trigger as row 1 |
| Least privilege, including the AI agent | Gate | Workflow `permissions:` (already); release publishes need an Owner-approved `release` environment (QB.1); agents never hold the `NPM_TOKEN` |
| Audit logs without secrets | Task | QB.5 (grants and revocations); M7 server logs (§5) |
| Pen test; security questionnaires; SOC 2; HIPAA and BAAs; PCI; GDPR deletion reach; data residency; access reviews | N/A, mostly | **PCI:** QB.5 keeps card data at the merchant of record (SAQ A scope). **GDPR:** the site sets no cookies and collects nothing (QB-D1); the privacy page says so (QB.3). **Rest — trigger:** an enterprise or health customer |
| Vulnerability disclosure process | Task | QB.1: `SECURITY.md` and `/.well-known/security.txt` on the site, with a contact and a response window |
| Stolen laptop with production access | Task | QB.1 runbook: revoke the npm token and GitHub sessions, rotate secrets, re-publish from CI. Production access is the npm token and the site deploy only |
| Dev, staging, prod; IaC; tested deploys; one-click rollback; zero downtime | Gate | Packages: the release workflow from CI only (M2.4). Site: QB.4, immutable static deploys with rollback to the previous build. Games: `ruken publish` versions (Ruken) |
| Feature flags; autoscaling; job queues; retries and backoff; dead-letter queue; cron; caching | N/A: no service | **Trigger:** the M7 server. Its spec owns them |
| CDN; DNS, certificates and renewal | Task | QB.4 with DX.12: the static host's CDN and managed certificates, plus an external expiry check |
| SPF, DKIM, DMARC; bounces | N/A: AF sends no email | QB-D2: the merchant of record sends receipts |
| Cost alerts | Task | QB.4: a spend alert on the site host, the Plus store and any GPU runner (D-5) |
| DR plan | Task | QB.1 runbook: everything is rebuildable from Git plus the registries. It names what is not (secrets, DNS) and where each is held |
| Structured logs; error tracking; uptime; paging; dashboards; tracing; on-call; runbooks; postmortems; status page | Mostly N/A | QB.4: one external uptime check on the site. QB.1 runbooks. **Trigger:** the M7 server (its spec owns logs, dashboards and paging). A status page for a static site and a library is the vibecoded version |
| Unit, integration, E2E, regression tests; test data | Gate | Exists: strict TDD, goldens, parity, E2E (AGENTS.md). QB.3 adds the website's E2E |
| Load testing | Task | M7 server spec (§5); PRODUCT.7 frame budget for games |
| Old hardware | Gate | PRODUCT.7 runs the frame budget on the GPU runner. The Owner names one low-end device for the acceptance pass (QB.3) |
| Accessibility compliance | Gate | Site: axe in QB.3 at WCAG 2.2 AA. `ui`: existing layout contracts, 44 px and 48 px targets, focus tests |
| Subscriptions; dunning; PO numbers on invoices; refunds; metering; custom contracts; revenue reports | Task | QB.5: the merchant of record handles all of them (QB-D2). AF reacts only to "granted" and "revoked" |
| Webhook signatures and retries | Gate | QB.5: verify the signature, reject replays, process idempotently, log failures |
| Versioned API; deprecation; third-party format change | Gate | PRODUCT F6: semver and API reports with a release break check, plus codemods from M8. Ruken contracts are consumed, never copied (AGENTS.md) |
| API keys customers create and revoke | Task | QB.5: Plus registry tokens, revocable |
| OAuth refresh; integration sandbox | N/A: none | The fake host is the integration sandbox for Ruken (`@ruken/sdk-host`) |
| Prompt injection; data in prompts; spend caps; evals; provider fallback; model deprecation; prompt logs; human approval for irreversible AI actions | N/A for the runtime: AF calls no model | The agent package (DX.7) is instructions only. Evals were dropped (D-DX-3). **Human approval:** agents never push `main`, publish, or delete (AGENTS.md, workflows); the release environment makes that a gate (QB.1) |
| Hotel wifi; empty, loading and error states; actionable errors; forms keep input; undo; back button; notifications off | Gate | Site: QB.3 (throttled-network test; no forms). Games: DX.2 §7 default screens (loading, and an error screen that names the cause and offers a retry) and PRODUCT.6 kits |
| Email rendering | N/A | No email |
| Readable code; review; branching; dead code; huge files; ADRs; README; docs; changelog | Gate | QB.1: `knip` (unused files, exports, dependencies) and a 600-line ceiling on non-test source in `pnpm style` (the largest today is `packages/sim/src/world/sim.ts` at 574); a root README whose commands run in consumer smoke. ADRs and Changesets exist |
| Admin panel; support tooling | N/A | **Trigger:** the Plus store. The merchant of record's dashboard covers it |
| Terms and privacy that match the code | Task | QB.3: each claim on the privacy page is pinned by a test (for example "no cookies": the built site sets none and loads no third-party origin) |
| Accounts, domain and repos in the company's name; bus factor above one | Owner | QB-D4 |

### 4.2 Website groups (SEO, Conversion, UX, Performance, Trust, Analytics, Final check)

All are QB.3, in `automata_website`, extending `pnpm check:site` and adding a Playwright suite. The site is static, so each item is a check on the build or a browser assertion.

| Item | Today | QB.3 gate |
|---|---|---|
| Title, description, OG, canonical | Checked | Keep |
| robots.txt, sitemap.xml | Missing (F-3) | Generated at build from the prerendered pages; `check:site` asserts every page is listed and nothing else |
| Favicon set | SVG only | Add the 180 px apple-touch icon and a 32 px PNG; check they exist and are linked |
| Alt text | Present | `check:site` fails on an `<img>` without `alt` (decorative images use `alt=""`) |
| CTA above the fold; sticky CTA on mobile | Unchecked | The primary action ("Make your first change") is visible without scrolling at 375×667 and in the header at every width. A floating sticky bar is not added: the header already holds it |
| Forms, thank-you page | N/A | No forms. Trigger: a newsletter or contact form |
| Contact; real address | Missing (F-4) | A contact email in the footer. A postal address only if the Owner's jurisdiction requires one for the business (QB-D3) |
| Breakpoints; no horizontal scroll; mobile nav | Unchecked (F-6) | Playwright at 375, 768, 1280 and 780×270 in Chromium and WebKit: `scrollWidth ≤ clientWidth`, nav opens and every link is reachable |
| Loading, empty, error states; disabled and processing buttons | Partial | The demo runner shows loading and a failure state (asserted); search shows an empty result state |
| 404 | Present | A test hits an unknown path and asserts the page and its links |
| Keyboard navigation; visible focus | Partial | Tab through each page: every interactive element is reachable and shows a focus ring (computed outline is not `none`); axe has no violations |
| Image compression, dimensions, formats, lazy loading | Mostly | F-2 fixed; a check that each image's bytes match its extension and its intrinsic size is at most 2× its rendered size; AVIF or WebP previews with a fallback |
| Fonts | Third party (F-5) | Self-host with `font-display: swap` and a preload of the one used weight |
| Unused scripts and styles; performance | Unchecked | A Lighthouse CI budget on `/`, `/start`, `/examples` and `/docs`: performance ≥ 90 mobile, LCP ≤ 2.5 s, CLS ≤ 0.1. Thresholds come from the first recorded run and are only tightened |
| Privacy, terms, cookie banner and preferences | Missing (F-4) | Privacy and terms pages. No cookies are set, so there is no banner (QB-D1). A test fails if any cookie or third-party request appears |
| HTTPS | Not deployed | QB.4 |
| No fake testimonials, logos or metrics | Covered by the cut-claims ledger (`docs/2026-10-14-cut-claims.md`) | DX.10 rule: every restored claim is pinned to its evidence by a test. The showcase lists only real games |
| Analytics; CTA, conversion and consent events | None | QB-D1: no analytics until the Owner picks a cookieless provider. If chosen: events for the CTA and the outbound repo link, verified receiving in staging, no consent banner needed because no identifiers are stored |
| Placeholder copy; lorem ipsum; AI filler; generic sections | Partly audited (`docs/2026-10-14-site-audit.md`) | A banned-phrase check in `check:site` (`lorem`, `TODO`, `coming soon`, `seamless`, `cutting-edge`, `unleash`, `supercharge`, `revolutionize`, `game-changer`) and an Owner read-through of each page against its stated purpose |
| Broken links; dead buttons | Links checked | Every `<button>` has a handler or a `type=submit` in a form (Playwright clicks each one and expects a state change or navigation) |
| Console errors; JS failure | Unchecked | Playwright fails on any console error or `pageerror`. With JavaScript off, every page's content and links render (prerendered) |
| Real phone; Chrome and Safari; someone else tests the journey | Unchecked | The Owner's acceptance pass, recorded in the site's results doc with the device, browser and date. An agent never ticks it |

### 4.3 Platform groups (isolation, uploads, code execution, hosting, auth, storage, network, abuse, domains, admin, logging, incident response, the platform test)

These describe a game host, and Ruken is the host. AF never redefines a Ruken capability (AGENTS.md "Ruken first"), so each group becomes a request (§6). Three items do touch AF and become gates here:

| Item | Why it is AF's too | Gate |
|---|---|---|
| Secrets not embedded in frontend bundles | AF builds the bundle | QB.2: `prepare-ruken` and `automata check` scan the built files for high-entropy strings, known key formats and the values of any `.env*` variable, and fail on a match |
| Games cannot impersonate platform UI; clear trust boundary | AF's `ui` draws inside the frame | QB.2: AF's kits never draw Ruken's chrome, login or payment UI. Ruken enforces it (§6) |
| Deployment integrity, provenance, dependency scanning (Deployment Security, Supply Chain) | AF publishes packages | QB.1: npm provenance on the public npmjs.org publish (DX.11; GitHub Packages accepts none, per `release-packages.yml`), the audit, Renovate and the secret scan |

### 4.4 Billing and payments

QB.5, with PRODUCT.5 and master spec D-7. "Payment provider tokens never reach hosted games" holds by construction: the Plus registry token is a developer install credential, games are built from installed code, and QB.2's bundle scan also fails on the registry token's format.

## 5. Requirements handed to future specs

These are not tasks here. Each owning spec must cover them in its acceptance, and its reviewer checks them:
- **M7.0 (server):**
  - Zod validation of every client message, with a size cap.
  - Per-connection and per-IP rate limits.
  - Session tokens verified with Ruken.
  - Structured logs without tokens.
  - A health endpoint and an external uptime check.
  - Deploy with rollback.
  - A load test at the room count the spec sets.
  - Cost alerts.
- **PRODUCT.5 and D-7 (the Plus store):** QB.5's rows.
- **PRODUCT.6 (kits):** a name-entry fixture with RTL, emoji and an apostrophe, and error screens that name the cause and the next action.

## 6. Requests to Ruken

The Owner files these in Ruken; AF records the link here when each is filed. Each asks Ruken to confirm the item is covered, or to plan it, with its evidence.

1. **Isolation:** games are isolated from each other's files, storage and runtime (sandboxed origin per game); tenant IDs are enforced server-side; there is a cross-tenant test.
2. **Uploads and builds:** archives are untrusted; path traversal and zip bombs are handled; size and type limits; builds run isolated with CPU, memory and time limits and no host credentials; logs are redacted.
3. **Code execution:** no server-side execution of game code, or a sandbox with quotas.
4. **Hosting:** HTTPS with automatic renewal; host-header validation; CSP and frame policy (AF already ships against it); a platform/game trust boundary, including games not impersonating platform UI.
5. **Auth, authorization, secrets, storage, database, internal services, network:** MFA for admins; session revocation; private and draft games not publicly fetchable; deploy permissions separate from edit; signed URLs expire; SSRF protection; edge rate limits and DDoS protection.
6. **Abuse:** phishing, malware, mining and spam controls; signup abuse; per-project limits; a reporting and takedown workflow.
7. **Custom domains:** ownership verification; dangling-DNS and reuse protection; no open redirects.
8. **Admin, logging, incident response:** audited admin actions and impersonation; centralized security logs; disabling a game, revoking sessions and rolling back quickly; a security contact.
9. **The anti-vibe platform test** (malicious archive, ID swapping, reading env vars, internal requests, resource exhaustion, domain claiming, deletion, control-plane compromise): AF offers its fake-host fixtures if Ruken wants a hostile test game. That would be a new AF task, only on request.

## 7. Tasks

| ID | Task | Owner | Depends on | Deliverable and acceptance |
|---|---|---|---|---|
| QB.0 | This spec, reviewed | integration | — | Owner review; QB-D1 to QB-D4 confirmed or changed |
| QB.1 | Framework repo hygiene | ship | QB.0 | All of: <br>• root `README.md` (clone to a running Emberwick, with commands that consumer smoke runs) <br>• `SECURITY.md` <br>• `CODEOWNERS` <br>• Renovate, monthly, pnpm and Actions <br>• `pnpm audit --prod --audit-level=high` in `ci:local` and CI <br>• gitleaks over the full history <br>• a new-dependency report on PRs <br>• `knip` <br>• the 600-line ceiling in `pnpm style` <br>• a `release` environment that needs Owner approval <br>• a two-page runbook (lost credentials; rebuild from Git) <br>Each check has a fixture that fails it (QB-a) |
| QB.2 | Game build gates | ship + ui | QB.0, DX.6 | A bundle secret scan in `prepare-ruken` and `automata check`, failing on a planted key (QB-b). A style rule forbidding `{@html}` in `ui`. A kit rule against platform-chrome mimicry, recorded in the `ui` spec |
| QB.3 | Website quality gates | website | QB.0 | All of §4.2 in `check:site` and a Playwright suite (Chromium and WebKit). <br>Fixes F-2 to F-6. <br>Privacy, terms, contact and `security.txt` pages. <br>The MIT claim is held by a test that reads the framework's published `license` field and stays red until DX.11 (F-1). <br>The Owner's acceptance pass is recorded (QB-c) |
| QB.4 | Website deploy hardening | website | DX.12 | All of: <br>• HTTPS with HSTS <br>• headers checked against the deployed origin: CSP without `unsafe-inline` for scripts, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and a frame policy that still lets the demos embed <br>• an external uptime and certificate-expiry check <br>• rollback to the previous build, rehearsed once <br>• a spend alert <br>(QB-d) |
| QB.5 | Plus store integrity | ship | PRODUCT.5, D-7 | Purchases through a merchant of record (QB-D2). The webhook verifies signatures, rejects replays and is idempotent on the event ID. Each grant and revocation issues or revokes a registry token and is logged with an audit entry. Refunds revoke. No card data or provider token in AF code or games. A Plus licence (EULA) and a refund policy page (QB-e) |

## 8. Owner decisions (recommended defaults in effect until reviewed)

| ID | Question | Recommended default | Why |
|---|---|---|---|
| QB-D1 | Analytics on the website? | **None now.** If wanted later: one cookieless provider (for example Plausible), with events for the CTA and the repo link | No cookies means no banner, a short privacy page and no consent bugs. There are no forms or funnels to measure yet |
| QB-D2 | How does Plus take money? | **A merchant of record (Lemon Squeezy or Paddle)** | It handles tax and VAT, invoices with PO numbers, refunds, dunning, currency and receipts. AF builds no accounts, billing or email. This is how Tailwind Plus-style products are usually sold |
| QB-D3 | Contact details on the site | **A contact email and a security email.** A postal address only if the business's jurisdiction requires one | The checklist's "real address" item is a legal requirement in some places (for example Germany's Impressum), not everywhere |
| QB-D4 | Company ownership and bus factor | **Owner action:** move the repos to a GitHub organization, the npm scope to an org scope, and the domain to the business; add a second maintainer with recovery access | These are account actions, so no agent can do them, but the checklist is right that they matter |

## 9. Acceptance

- **QB-a:** each new QB.1 check fails on a planted fixture (a fake secret in history, an unused export, a 601-line file, a high-severity advisory in a fixture lockfile) and passes on `main`.
- **QB-b:** a game build with a planted `sk_live_`-style key, or a `.env` value, fails `prepare-ruken` with the file and offset; the clean placeholder and Emberwick builds pass.
- **QB-c:** `check:site` and the Playwright suite fail on fixtures for each §4.2 gate: a missing sitemap entry, a JPEG named `.png`, an `<img>` without `alt`, horizontal overflow at 375 px, a console error, a third-party request, a cookie, a banned phrase. They pass on the fixed site. The Owner's real-phone, Safari and second-person journey are recorded with device and date.
- **QB-d:** the deployed origin's headers are checked by a script against the live URL, and a rollback to the previous build is performed once and recorded.
- **QB-e:** webhook tests: a bad signature is rejected; a replayed event changes nothing; a refund revokes the token; the store's access log shows each grant and revocation.
- **Not applicable rows stay closed** until their trigger happens. The spec that introduces the trigger (for example, the M7 server or a Plus account system) reopens them in its own acceptance.
