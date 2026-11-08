# Site slice audit

- **Stage:** 1 of 6 of the site slice (audit, Opus extra-high). The next stage writes the plan and spec from this.
- **Date:** 2026-11-08, on top of the 3D stack (`claude/project-thread-us0s9k`, PR #473, head `c3391f2e`), with the
  site changes that wait on other branches read beside it: #440's (`claude/project-thread-e4cj35`, six commits that are
  not in the 3D stack), the Plus port's (#458) and the skills mirror's (automata-skills #451).
- **What it covers:** the website as it would launch: `site/` in this repository (Home, Start, Docs, Examples, the
  Editor page and its try-it editor, the API index, Privacy, Terms, the missing page, the redirect pages, `llms.txt`,
  `security.txt`), its build and checks, its deploy (`site.yml`, the runbook's launch steps), the domain
  `automataframework.com`, the contact address, and the old `mcthaydt/automata-website` repository it replaced.
  Measured against the approved Home mockup (`refactor/2026-11-06-redesign-mockups/site-home.html`, phase 18), the
  site visual audit, the 2D audits, the grandma copy audit, the taste standard (slightly rounded corners, never pills,
  DUEL), the drunk grandma test and the repository's rules (`AGENTS.md`).
- **What it does not do:** change code. Section 6 lists the decisions only the Owner can make (D1 to D5), each with a
  recommendation.
- **In-flight work.** The Owner, 2026-11-08: "Yeah, we can start it knowing we'll have to recheck". Every finding that
  depends on the 3D stack (#472, #473 and the rest of 15.1b to 20.1) or the Plus port (#458) is tagged
  **Recheck after 3D/Plus merge**; section 7 lists them.

Every number below was measured on this checkout on 2026-11-08; the commands are in the appendix. WebKit and Firefox
cannot be installed in a cloud session, so every browser run here is Chromium; hosted CI and a real host were not run.
Screens are in the project files, `refactor/2026-11-08-site-audit-screens/` (built and mockup side by side).

## The short version

1. **The site's first command can never work as written.** `npx @automata/tools create-game my-game` is on Home and
   Start, and every package was renamed to `@automata/*` in task 14.1. On npm, `automata` is an existing account that
   holds other people's packages (`noflo-webaudio`, `noflo-canvas`, `zeh` and more), so nobody else can publish under
   `@automata`. `@automataframework` is free today.
2. **The domain is not registered, and main already sends security reports to it.** `automataframework.com` has no
   registration (Verisign RDAP: 404) and no DNS. `SECURITY.md` on `main` says to email hello@automataframework.com, so
   a security report sent today bounces, and anyone can buy the name first.
3. **The site cannot deploy.** No host is chosen, `site.yml`'s upload step is `exit 1`, and `check:launch` fails on
   three counts (the Gmail address twice, `@automata/tools` not on npm). The runbook's launch steps start at "choose the
   host" and "point the domain", with no step to register it.
4. **Home matches the approved mockup in words and layout, but not in its centrepiece.** The game sits under a title
   bar with letterbox strips and the game's own pause button in the picture; two dark boxes cover the middle of the
   art; the code sample has no colours. The pictures were taken before DUEL became the palette.
5. **The other pages are on a second layout.** Docs, Examples and API start 40 px left of the header's logo, use a
   lighter heading weight and a different code box, while Home lines up with the header.
6. **The Editor page's pictures are wrong.** One is cropped through its text, the phone one is mostly black with
   "Emberwi…" and "Roo…", and all three show the standalone editor (with a Map tab) that 15.1b replaces with the suite.
7. **What works is solid.** The build, the closed-beta scan, 340 unit tests, `svelte-check`, `check:site` (35 pages:
   metadata, links, CSP, fonts, alt text, banned phrases) and the Chromium browser suite pass; across 37 addresses at six
   sizes (222 views) nothing scrolls sideways, no text is under 12 px and no page logs an error except the missing page.

## 1. What the site is

| Part | Today |
|---|---|
| Pages | 35 built: Home, Start, Docs (6 guides), Examples (index and 17 examples), Editor, API (index and 4 packages at 0.0.5), Privacy, Terms; the missing page; the try-it editor at `/editor/app/` |
| Redirect pages | 29 (meta refresh) for addresses the cut pages had |
| For agents | `llms.txt`, `llms-full.txt`, `llms-api.txt`, `llms-guides.txt` |
| Other files | `sitemap.xml` (35 addresses), `robots.txt`, `.well-known/security.txt` (Expires 2027-10-15) |
| Code | `site/`: SvelteKit 2.70.4, Svelte 5, Vite 8.3.3, `adapter-static`; `src/features/` (home, start, docs, api, examples, playground, editor, legal, redirects), `src/shared/` (components, framework, html); `playground/`; 63 unit test files in `tests/unit/<feature>/`, e2e in `tests/e2e/` |
| Build | `scripts/build-demos.ts` builds the packages and demos, writes the API index, copies the 2D editor build (`packages/editor/dist/2d`) to `static/editor/app/`, builds the playground; then `vite build` and the closed-beta scan |
| Deploy | `.github/workflows/site.yml` from `main`: "No host configured yet." without `SITE_DEPLOY_TOKEN`; with it, `check:launch`, then an upload step that is not written (`exit 1`) |
| Old repository | `mcthaydt/automata-website`, `main` at `4a514eb` (2026-11-01), 39 branches. Its deploy was always a dry run (for `automata.ruken.com`), so it was never public. It still names the Gmail address |

What waits on other branches and changes the site:

| Branch | Site change |
|---|---|
| #440 (`e4cj35`) | `0d5cab36`: footer, Privacy, Terms and `security.txt` name hello@automataframework.com; `12bda870`: the first release is 0.1.0 (a changeset). Neither is in the 3D stack; `main` has the address change, the stack still has the Gmail |
| 3D stack | 15.1b moves Try-it onto the suite; 19.1 puts the site's 3D parts behind the `AF_SITE_3D` switch; 20.1 |
| Plus port #458 | the site's build depends on nine extension builds; the API pages test expects 13 packages; the playground catalog gains an `extension` tier |
| automata-skills #451 | Start's agent setup lines change to the mirror's install lines ("three sets of skills") |

## 2. What was run

| Check | Result |
|---|---|
| `node scripts/build-demos.ts`, then `vite build` | Builds; the closed-beta scan (`@pixi/3d`) is clean |
| `pnpm check` in `site/` (`svelte-check`) | 2,088 files, 0 errors, 0 warnings |
| `pnpm test:unit` in `site/` | 63 files, 340 tests pass |
| `pnpm check:site` | Passes on 35 pages; the editor chunk is 148,167 B gzip and the compile worker 118,749 B, and no page loads either |
| `pnpm check:launch` | Fails: the contact and security addresses are a personal mailbox; `@automata/tools` is not on npm |
| `playwright test --project=chromium --trace off` | 345 of 345 pass in 9.1 minutes (run under Node 22.23.4; everything else under 24.21.0) |
| The visual sweep: 37 addresses (35 pages, a missing page, the try-it editor) at phone, tablet and desktop, each portrait and landscape: 222 views | Sideways scroll: 0. Text under 12 px: 0. Targets under 44 px: the try-it editor's 32 px desktop controls, and Start's three 20 px checkboxes (each inside its label, so the tap target is the label). Console errors: only the missing page's 404 |
| The Home demo and the try-it editor, played at phone and desktop size | Both start; no console errors |
| Home beside the mockup at 1440 × 900 and 390 × 844 | Section 4, I1 |
| npm and DNS | `registry.npmjs.org/-/org/automata/package` lists an existing account's packages; `@automata/tools`: 404; `@automataframework`: "Scope not found" (free); `automataframework.com`: RDAP 404, no DNS |

Not run: WebKit and Firefox (not installable here); hosted CI; a real host's response headers; the playground's own
Playwright config (`test:e2e:playground`); Lighthouse.

## 3. Critical: the site cannot launch

### C1. The `@automata` scope on npm belongs to someone else

- **Evidence.** `GET registry.npmjs.org/-/org/automata/package` returns an existing account's packages
  (`noflo-webaudio`, `noflo-ccv`, `noflo-canvas`, `zeh`, `alan-view` and more). An npm scope is the name of a user or
  an organisation, and organisation names share that namespace with usernames, so `@automata` cannot be created.
  `@automata/tools` is 404. `@automataframework` returns "Scope not found", so it is free today.
- **Where it shows.** Home's command box (`home-content.ts` `CREATE_COMMAND`), Start's step 1 (`start-content.ts`),
  `check:launch`, the runbook, every package manifest since 14.1 (`@automata/framework`, `@automata/tools`, ...), the API
  pages, `llms*.txt`, the guides, the agent skills, and the Plus port's nine extensions.
- **Why it is critical.** A stranger's first action fails. The first release (task 14.2, the Owner's step "create
  @automata org on npmjs.org") cannot happen under this name.
- **For the plan.** The rename is a codemod like 14.1's (964 files there); run it after the Plus port merges, so the
  extensions are renamed in the same pass. Owner's call: D1. **Recheck after 3D/Plus merge** (the file count grows).

### C2. `automataframework.com` is not registered, and `main` sends security reports to it

- **Evidence.** Verisign RDAP for `automataframework.com`: 404 (no registration); no DNS answer. `SECURITY.md` on
  `main` (`c6fe6c91`): "Email: hello@automataframework.com, with "AF security" in the subject".
- **Where it shows.** `SITE_ORIGIN` (`site/src/shared/site.js`), every canonical link, `sitemap.xml`, `robots.txt`,
  `security.txt`, the footer on #440, `SECURITY.md` on `main`.
- **Why it is critical.** A security report sent today is lost, and the name can be taken by anyone before the
  launch.
- **For the plan.** Nothing for the agent until D2; then the runbook's launch section gains "register the domain" as
  its first step, and `SECURITY.md` names an address that works until the mailbox exists.

### C3. Nothing can deploy the site

- **Evidence.** `site.yml` line 71: "The host's upload step is not written yet" and `exit 1`. `check:launch` fails
  (section 2). The runbook's "Launch the website" step 2 is "Point the domain at it", which assumes the domain is owned.
- **What the host must do.** The site relies on response headers that a page cannot set for itself:
  `frame-ancestors 'self'` (a CSP meta tag ignores `frame-ancestors`) and `Strict-Transport-Security`
  (`src/shared/html/security-headers.ts`). So the host must let the site set headers. GitHub Pages cannot; Cloudflare
  Pages and Netlify read a `_headers` file.
- **For the plan.** After D3: write the host's upload step, generate the host's headers file from
  `security-headers.ts` (one source), test it in `check:site`, and add a post-deploy check of the live headers.
  `security-headers.ts`'s HSTS comment points at `pnpm check:deployed`, which no longer exists (M4).

## 4. Important

### I1. Home's centrepiece is not the approved mockup's

Screens: `home-desktop-built.png` beside `home-desktop-mockup.png`, and the phone and code pairs.

- The mockup shows the game edge to edge with one bar under it: "Emberwick", "a platformer made with Automata" and a
  white "Play it" button. The site puts a dark title bar ("• Emberwick") over the picture, letterbox strips above and
  below it, and two dark boxes in the middle of the art, "Plays here, nothing to install." and "Play demo"
  (`DemoRunner.svelte`). The picture includes the game's own pause button (top right). On a phone the title bar and a
  dark strip come before the art starts.
- The command box: the mockup has a copy icon and an ellipsis; the site has a "Copy" text button and a grey highlight
  behind the command, which on a phone cuts it at "create-gam" with no ellipsis.
- "Small files. Plain TypeScript.": the mockup's code is coloured (keywords, strings, numbers); the site's is plain,
  while the Docs' code is coloured. The panel label is "What it draws" (mockup: "Running"); either is fine, one should
  be chosen in `copy.md`.
- Drunk grandma: "Play demo" over a picture that already looks like a game, plus a second box saying the same thing,
  is two things to read before one thing to press. The mockup's single "Play it" passes.

### I2. The pictures and the Shapes colours predate DUEL. Recheck after 3D/Plus merge

- The posters (`static/previews/emberwick*`, `double-jump*`, `hot-reload*`) were recorded in `ef5a7bb7`, an ancestor
  of `fa855582` ("DUEL is the palette everywhere"), which changed Emberwick's content and the example sprites. They show
  the game as it no longer is.
- Home's code sample and `ShapesPreview.svelte` draw `0x00cdf9`, `0x5ac54f` and `0xf5555d`, the colours in
  `examples/2d/shapes/shapes-rects.ts`; none of the three is in `docs/art/palettes/duel.txt`. The 3D stack's DUEL pass
  moved the 3D examples' colours and left `examples/2d/shapes` alone.
- The plan should retake every picture from the merged build in one scripted pass (no hand-made screenshots), and move
  the 2D examples' hex colours to DUEL in the framework, so Home quotes the real file.

### I3. The inner pages use a second page width and type scale

Screens: `examples-desktop.png`, `docs-editor-desktop.png` beside `home-desktop-built.png`.

- At 1440 px, Home's content and the header's logo start at x = 120; Docs, Examples and API start at x = 80.
- Docs' title is a light weight (420: "Display type is light and tight, like signage set into glass", while the same
  file's header says "No glass and no glow"); Home's titles are bold; Examples' "The basics" is
  light again. Docs' code boxes have a tall grey "sh" header with a "Copy" button and a green-grey body, and cut long
  comment lines (`docs/editor`: "# the level editor on the game in this"); Home's command box is a third style.
- `app.css` is 1,092 lines (the rule for a source file is 600; the style check does not count CSS).
- The plan should give every page one shell (one width, one gutter), one type scale and one code box, from the kit's
  tokens, the way Home was rebuilt in phase 18.

### I4. The Editor page's pictures are wrong. Recheck after 3D/Plus merge

Screens: `editor-page-pictures-desktop.png`, `editor-page-pictures-phone.png`.

- "Start from a platformer, a top-down map or nothing.": the picture is cropped through the page behind the box (the
  text "et", "st one to start drawing", "vser. E" shows at the left edge).
- "It works on a phone and a tablet too.": the 390 × 844 picture is mostly black; its labels read "Emberwi…" and
  "Roo…", and on a phone the page cuts its Save button.
- All three show the standalone 2D editor with its Level, Map, Tiles and Characters tabs. 15.1b replaces that page with
  the suite, and the Owner's ruling is that World is the Map view, so the pictures will show an editor that no longer
  exists. Retake them from the suite after 15.1b, in the same scripted pass as I2.

### I5. A missing page is blank for three seconds

Screens: `404-phone-first-second.png`, `404-phone-after-3s.png`.

The missing page is SvelteKit's empty fallback (`404.html`). The deferred start waits for the first contentful paint
(`src/shared/html/hydration.ts`), which an empty page never has, so it starts after `FALLBACK_MS = 3000`. The plan
should prerender a real "Page not found" with links home, or start at once when the body is empty.

### I6. The contact address differs between `main` and the stack. Recheck after 3D/Plus merge

`main` has hello@automataframework.com in `SECURITY.md` (#470); #440's `0d5cab36` puts it in the footer, Privacy,
Terms and `security.txt`; the 3D stack still has `mcthaydawson@gmail.com` in `site/src/shared/site.js` (both
`CONTACT_EMAIL` and `SECURITY_EMAIL`), `security.txt` and `SECURITY.md`. The stack's merge will conflict there. Resolve
in favour of the project address, and only once C2's mailbox exists. The 2D build audit's D8 comment in `Footer.svelte`
goes with it.

### I7. Try-it, its pictures and Privacy after 15.1b. Recheck after 3D/Plus merge

The try-it editor is the standalone 2D build copied by `copyEditor` from `packages/editor/dist/2d`. 15.1b moves Try-it
onto the suite (templates on the sample game, Share). After it: the copy step's source, the Editor page's words ("Paint
a room, then place its characters"), `docs/guides/editor.md` (`automata editor --app suite`), Privacy's sentence on what
the try-it editor keeps in the browser, the try-it editor's 32 px desktop controls, and `check:site`'s chunk budgets
must all be read again.

### I8. The API index and docs after the Plus port. Recheck after 3D/Plus merge

With #458 the API index lists 13 packages (the API pages test says so). No guide explains an extension, "How it works"
says the tour covers "the four packages", and the header says "API" where the footer says "Reference". The plan should
decide how the index groups core and extensions, give extensions one guide, and use one name.

### I9. Start's agent setup asks for a file the game does not have

- The preflight it gives the agent (`agent-setup.ts` line 38) says "read this checkout's AGENTS.md"; `create-game`
  writes no `AGENTS.md` (`packages/tools/src/shared/create-game/`).
- Three checkboxes that change nothing but a counter ("1 of 3 ticked. The boxes are only for you."). Drunk grandma:
  boxes that do nothing look broken. Either make it a plain list or cut it (essentials only).
- automata-skills #451 rewrites these lines (the mirror's install lines). **Recheck after 3D/Plus merge** and after
  #451.

### I10. The site's tests break the repository's test rules, and no gate notices

- 44 site test files import code by relative chains (`../../../../packages/tools/src/...`, `../../../src/...`); none
  uses `#src/`, and `site/package.json` has no `#src` import map. `AGENTS.md`: "A test imports the code it tests as
  `#src/…`, never by a relative chain"; `pnpm style` passes, so it does not look at `site/tests/`.
- `site/tests/unit/home/home.test.ts` imports the tools package's source (`packages/tools/src/shared/ship/cli-args`)
  rather than its public entry.
- `Home.svelte` is 553 lines, near the 600 cap.

### I11. Launch order: the release comes first

The API pages carry the package version in the address (`/api/0.0.5/...`), and the first release is 0.1.0 (#440's
changeset). If the site launched before the release, its first addresses would move and the first command would fetch
nothing (C1). The plan should make the launch wait for the first release, and the runbook should say so.

### I12. 3D on the site. Recheck after 3D/Plus merge

Home says "2D" in its eyebrow ("TypeScript · 2D · MIT licence") and its first paragraph; `docs/guides/3d.md` exists
but is not in `docs/guides/index.md`, by design until 3D is public. The 3D plan's phase 19 (the site's 3D parts behind
`AF_SITE_3D`) and phase 20 cover this. The plan stage should either take those two phases into the site plan or name
them as the 3D slice's, so one plan owns each page.

## 5. Minor

- **M1. Plan citations in code.** About 63 lines in `site/` name a plan item ("(D8)", "(PLAY-D6)", "spec F-4",
  "QB-D3", "quality-bar spec §4.2"). `AGENTS.md`: comments say why, not which plan asked. The 2D build audit's L1 check
  catches only the "Spec 11.5" form.
- **M2. Unused code.** `virtual:framework/packages` and `src/shared/framework/packages.ts` (declared, never
  imported); `apiVersions` and `latestApiVersion` for a single version; `DemoRunner.svelte`'s `aspect` prop.
- **M3. Redirects for addresses nobody has.** 29 redirect pages for pages the cut removed, but the old site was never
  public (its deploy was a dry run), so no search result or bookmark holds them. Cut them, or keep only any that
  `main`'s own docs link to.
- **M4. Stale comments.** `Footer.svelte`'s D8 note; `security-headers.ts`'s HSTS note names `pnpm check:deployed`,
  which no longer exists.
- **M5. Words.** `llms.txt` describes the editor guide as "In your game's folder, run:" (its first line);
  `llms-full.txt` is "the framework's defined documentation corpus"; the framework API page shows 887 spans of doc
  comments with their backticks as raw text (`` `collapseLevel` ``).
- **M6. The header moves.** The current page's link is bold, so the links after it shift by 2 to 3 px from page to
  page.
- **M7. The demo frame's sandbox does nothing.** `sandbox="allow-scripts allow-same-origin"` on a same-origin demo lets
  the frame lift its own sandbox. The demos are first-party, so drop the attribute or serve demos from their own
  origin, and say which in a comment.
- **M8. The playground's Ruken harness** is the site's only use of Effect and `@ruken/*` (`playground/src/ruken/`, the
  vendored `0.0.0` tarballs). It plays the host's side, which the rules allow; the plan should still ask whether the
  site needs a Ruken target in its playground (essentials only).
- **M9. The old repository.** `mcthaydt/automata-website` still names the Gmail address and has 39 branches; archive
  it once the site is live (the Owner's step).

## 6. Decisions for the Owner

| # | Decision | Recommendation |
|---|---|---|
| D1 | The npm scope, since `@automata` is taken (C1) | `@automataframework`: free today and the same name as the domain. Claim it now (an organisation on npmjs.org), before someone else does. Asking npm for `@automata` is slow and may fail |
| D2 | Register `automataframework.com` and create the mailbox (C2) | Register it today; one mailbox, hello@, for questions and security reports |
| D3 | The host (C3) | A static host that reads a headers file: Cloudflare Pages or Netlify. Not GitHub Pages (no response headers) |
| D4 | When to launch (I11) | After the first release on the chosen scope, so the first command works and the API addresses settle |
| D5 | The old website repository (M9) | Archive it after the launch |

## 7. For the plan stage

- **Order.** C1's rename after the Plus port merges (one codemod pass, extensions included), then C3's deploy
  (upload step, headers file from one source, live-header check, runbook), then I1 to I12, then the minor items.
- **Recheck after 3D/Plus merge:** C1 (count), I2, I4, I6, I7, I8, I9, I12; then rerun `check:site`, `check:launch`,
  the visual sweep and the Chromium suite on the merged `main`.
- **Overlap.** The 3D plan's phases 19 and 20 touch the same pages (I12).
- **Essentials questions for the plan:** the playground's Ruken target (M8), the redirect pages (M3), the version
  machinery (M2), the agent setup checkboxes (I9).
- **Keep.** Per-page CSP hashes, the closed-beta scan, `check:site`'s rules (links, no link into the private
  repository, banned phrases, chunk budgets), the deferred start (except on the missing page), `llms*.txt`, the 44 px
  rule in `site.e2e.ts`, the feature folders and `tests/unit/<feature>/`.

## Appendix: commands

Run in `site/` with Node 24.21.0 and `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, after
`pnpm install --frozen-lockfile` at the root:

```sh
node scripts/build-demos.ts && pnpm build          # the build and the closed-beta scan
pnpm check                                          # svelte-check
pnpm test:unit
pnpm check:site
pnpm check:launch                                   # fails, see C1 to C3
pnpm exec playwright test --project=chromium --trace off
node scripts/serve-static.ts build 4417             # then the visual sweep: 37 addresses x 6 sizes, Playwright
curl -s https://registry.npmjs.org/-/org/automata/package           # an existing account's packages
curl -s https://registry.npmjs.org/-/org/automataframework/package  # {"error":"Scope not found"}
curl -s -o /dev/null -w '%{http_code}' https://rdap.verisign.com/com/v1/domain/automataframework.com  # 404
git log --oneline claude/project-thread-us0s9k..claude/project-thread-e4cj35   # #440's commits not in the stack
```
