# Site slice: plan audit

- **Stage:** 3 of 6 of the site slice (plan audit, Opus medium, superpowers `writing-plans` as the standard). It reads
  the [spec](2026-11-08-site-spec.md) and the [plan](2026-11-08-site-plan.md) of PR #510 against the code they will
  change, and fixes both in place (the commit after this file).
- **Date:** 2026-11-08, on the stack head the plan names (`claude/project-thread-6mtkk6`, PR #506, `ad1f627e`), with
  `main` (`61669c1f`) beside it.
- **What was run, Node 24.21.0, Chromium only:** `pnpm install --frozen-lockfile`; `cd site && pnpm build` (fails, A9);
  `pnpm exec turbo run build --filter=@automata/site` (15 tasks pass); the built site served by `serve-static.ts` and
  probed with `curl`; the try-it editor at 1440 × 900 and 390 × 844 with Playwright: a level made from the platformer
  template, items painted, the result looked at (A13); `check-style` over the site's folders (A8); a script that checks
  every hex colour in `examples/2d` against `DUEL_RAMPS` (A7); `git merge-tree` of #510 into #506 (A10); `git grep` for
  every form of the old scope (A5); npmjs.org asked for `@pixi/3d` (A15). Cloudflare's `_headers` rules were read from
  its documentation (A2); changesets' handling of an unknown package from its source (A3); the apps audit
  (`refactor/apps-audit.md` in the project files) for the Owner's prices (A16).
- **Not run:** WebKit, Firefox, hosted CI, a real Cloudflare upload, `wrangler pages dev`, Lighthouse, the site's
  Playwright suite.

## The short version

The plan is the right shape: the order (site and deploy now, rename last from `main`, launch after the first release),
the rulings and the host are sound. It is not yet buildable task by task. Four steps would fail as written (the missing
page, the headers file, the kept changeset, the straggler recipe), four rest on code that is not as the plan describes
(the pictures, the colours, the style gate, the build command), and the Home demo would still lose a visitor's first
press. Making a level in the built try-it editor found no way to play it, and on a phone the editor cuts its own tool
bar and places items outside the level. Two gaps come from the Owner's app decision of 14:53: nothing stops the site
launching before Pixi 3D is public (A15), and the site has no page for the paid apps (A16). The fixes below are made in
the spec and plan; three items are the Owner's (A13, A14, and A16's list of what stays free).

| # | Severity | Finding | Fixed in |
|---|---|---|---|
| A1 | Critical | The missing page breaks under a nested address and is copied from a path the build never writes | spec 4.4, Task 4.1 |
| A2 | Critical | The `_headers` check assumes the most specific rule wins; Cloudflare sends every matching rule and joins repeats with a comma | spec 5.1, Task 5.1 |
| A3 | Critical | Keeping `.changeset/scope-automata.md` makes `changeset status` fail after the rename | spec 6, Task 6.1, 6.2 |
| A4 | Important | The straggler recipe runs the straggler's own, old codemod | spec 3.1, Task 6.2 |
| A5 | Important | The rename table misses forms in use today; one rule covers them | spec 6, Task 6.1 |
| A6 | Important | The picture script writes PNGs to a folder nothing reads, and no tick hook exists | spec 4.3, Task 3 |
| A7 | Important | Twelve 2D example colours are off DUEL, in 15 files, not three | spec 4.3, Task 3 |
| A8 | Important | The style gate does not read the site where the plan expects it to | spec 4.1, 4.5, Tasks 1, 4.5 |
| A9 | Important | `cd site && pnpm build` fails on a fresh checkout | Task 0, Task 3 |
| A10 | Important | The build branch would not hold the plan it logs into | Task 0 |
| A11 | Important | "Play it" pressed before hydration is still lost; the planned test retries past it | spec 4.2, Review Focus 1, Task 2 |
| A12 | Important | The demo bar drops Full screen and the failure words, and makes "Play it" a second lime primary | spec 4.2, 7, Task 2 |
| A13 | Important | The try-it editor has no Play, and on a phone it cuts its tool bar and places items outside the level | spec 4.4, Task 4.2; the Owner's call on Play |
| A14 | Important | The Owner's 14:53 app decision ("keep essentials on web ... the full suite requires the app") is not in the spec | spec 2 (R7), Task 0 |
| A15 | Critical | Nothing stops the launch before Pixi 3D is public, against the Owner's rule; the repository stays private until then | spec 1, 2 (D4), 5.4, 5.5, Tasks 4.1, 5.2, 5.3, 7 |
| A16 | Important | The site has no page for the paid apps: the prices, where to buy, what stays free | spec 2 (R7), 4.4, 7, 8, Task 4.6 |
| M1 to M14 | Minor | Interfaces, tests and steps that would mislead a builder | section 3 |

## 1. Critical

### A1. The missing page

- **The path.** The site is built with SvelteKit's default trailing-slash rule, so a route is written as
  `<route>.html` (`build/docs/editor.html`, `build/api.html`), never `<route>/index.html`. The route
  `src/routes/not-found/` writes `build/not-found.html`; the plan's build step copies `build/not-found/index.html`,
  which does not exist.
- **The assets.** Prerendered pages use relative asset paths, SvelteKit's default (`paths.relative`). Built
  `docs/editor.html` links `../_app/immutable/assets/0.DKIPDaZ_.css` and starts the app with
  `base: new URL("..", location)`; today's fallback `404.html` uses `/_app/...` and `base: ""`, because SvelteKit always
  writes a fallback page with root paths. A prerendered page copied to `404.html` and served for `/docs/nope/deeper`
  resolves its stylesheet and its scripts under `/docs/nope/`: the page is unstyled and never hydrates. The plan's fix,
  root-absolute links inside `NotFound.svelte`, does not reach the links SvelteKit writes.
- **The checks.** `check-site` treats every built `.html` except `404.html` as a page that must have a canonical link
  and be in the sitemap (`site-checks/pages.ts`, `checkSeoFiles`), so a `not-found.html` left in the build fails
  `check:site` against the spec's "left out of the sitemap".
- **Already done.** `serve-static.ts` already answers a missing address with `404.html` and status 404 (checked with
  `curl`), so that test passes before any change.
- **Fix.** `kit.paths.relative = false` in `svelte.config.js` (the site is served from the root, so nothing else
  changes; per-page CSP hashes are computed after it); the build *moves* `build/not-found.html` (and its `.br` and
  `.gz`) to `build/404.html`, so there is no `/not-found` address; drop the serve-static step.

### A2. The headers file

- **Cloudflare's rule** (developers.cloudflare.com/pages/configuration/headers, read 2026-11-08): "An incoming request
  which matches multiple rules' URL patterns will inherit all rules' headers", and "If a header is applied twice in the
  `_headers` file, the values are joined with a comma separator". A header added by a broad rule is removed only with
  `! Name`.
- **The plan's model.** `matchHeaders` returns "the merged headers ... most specific pattern last": an override. A writer
  that puts `securityHeaders(path)` in full under `/*` and again under `/demos/*` passes that check, while Cloudflare
  sends a demo `Strict-Transport-Security: max-age=86400; includeSubDomains, max-age=86400; includeSubDomains`, which is
  malformed, so browsers ignore it; `Referrer-Policy` and `Permissions-Policy` repeat the same way.
- **Fix.** `matchHeaders` implements the documented rule (every matching rule, repeats joined with `, `, `! Name`
  removes). The writer puts the path-independent headers (HSTS, `X-Content-Type-Options`, `Referrer-Policy`) only in
  `/*`; a path-dependent header is written once for each path class, and the unit test fails when any header other than
  `Content-Security-Policy` reaches one path from two rules (two CSP headers are two policies, both enforced, which is
  how the demo policy can sit on top of the page one). The final word is the host's: Task 5.1 also runs
  `check:deployed` against `wrangler pages dev site/build`, Cloudflare's own `_headers` engine on this machine, before any
  account exists (if it asks for a login, the log says so and the first real upload is the check). The spec's
  "Netlify reads the same format" holds for the syntax; its merge rule is rechecked if the Owner picks Netlify.

### A3. The kept changeset breaks `changeset status`

- `.changeset/scope-automata.md` is pending (never versioned) and its front matter names `@automata/framework`,
  `@automata/content`, `@automata/sim` and `@automata/tools`. After the rename those packages do not exist, and
  changesets stops with "Found changeset scope-automata for package @automata/framework which is not in the workspace"
  (`@changesets/assemble-release-plan` 7.0.0, the `mapGetOrThrow` on each release). `pnpm check` runs
  `changeset status`, so the rename's own PR fails.
- Run through the codemod instead (its `KEPT` does not list `.changeset/`), its text would read "`@automataframework/framework`
  is now `@automataframework/framework`".
- The `@automata/*` names were never published (the scope belongs to another npm account); the names users could have
  installed are `@mcthaydt/automata*` on GitHub Packages, at 0.0.5.
- **Fix.** Task 6.2 deletes `scope-automata.md`. The new `.changeset/scope-automataframework.md` names the new packages in
  its front matter, says "`@mcthaydt/automata` (GitHub Packages) is now `@automataframework/framework`, and
  `@mcthaydt/automata-<name>` is now `@automataframework/<name>`", and is in the codemod's `KEPT` (it must name the old
  scope). The guard keeps its blanket `.changeset/*.md` exemption, so a changeset may quote old names; `changeset status`
  catches a wrong package name.

### A15. Nothing public before Pixi 3D (added after the Owner's app decision)

- **The rule.** The Owner, 2026-10-23: "we launch when pixi 3D goes public" (quoted in `vendor/pixi-3d/README.md`,
  which also says "Keep this tarball, the source that uses it and every build that contains it private"). `@pixi/3d` is
  not on npmjs.org: the registry answered `404 {"error":"Not found"}` on 2026-11-08.
- **Why it reaches the site.** The framework's repository stays private until that day, because the closed-beta tarball
  is in its history (the go-public audit, 2026-11-07); the site already refuses any link into it while
  `REPOSITORY_PUBLIC` is `false` (`site/src/shared/site.js`, `site-checks.ts:98`). The paid apps' full suite carries
  `@pixi/3d` in four chunks (apps audit A3), so nothing can be sold either. A site that says "open source" and sells an
  app, with the source private and the app unsellable, fails the drunk grandma test and the beta's terms.
- **The gap.** The spec orders the launch after the Owner's accounts and the first release only (section 1 item 4, D4,
  5.5), and `check:launch` asks only about the mailbox and the package. The day the Owner adds the Cloudflare token after
  the release, the site deploys, whatever Pixi 3D's state. A public deploy cannot be taken back.
- **What already holds.** The site's own build ends with `scan-closed-beta.ts`, which fails on any built file carrying
  Pixi 3D's markers (`findPixi3d`, the scan `automata ship` runs). The try-it is the 2D page and passes. Tasks 4.1 and
  4.5 both edit that `build` script line, and nothing tests that the scan stays last.
- **Fix.** D4, section 1 and the runbook add Pixi 3D's public release, with the repository opened the same day.
  `check:launch` (which runs before every upload) adds two problems: `@pixi/3d` is not on npmjs.org (the same injected
  registry question it asks for the tools), and `REPOSITORY_PUBLIC` is `false`. Task 4.1 adds a test that the build's
  last step is the closed-beta scan. Task 7 puts the Owner's Pixi 3D step before the token. If the Owner gets PixiJS's
  written permission instead, the check changes in a PR that quotes it.

## 2. Important

### A4. The straggler recipe runs the old codemod

A PR branched before Part C carries the old `tooling/codemods/src/rename-scope.ts` (it maps to `@automata`, checked on
#506) and no `pnpm rename-scope` script. Step 1 of the recipe would rename `@mcthaydt/*` to `@automata/*` and leave the
`@automata/*` names alone. **Fix:** step 1 first takes main's codemod,
`git checkout origin/main -- tooling/codemods/src/rename-scope.ts tooling/codemods/src/rename-scope-cli.ts`, then runs
`node tooling/codemods/src/rename-scope-cli.ts`; on a `pnpm-lock.yaml` conflict in step 2, take main's
(`git checkout --theirs pnpm-lock.yaml`) and let step 3's `pnpm install` redo it. Task 6.2's rehearsal must use a branch
made before the rename, so it exercises exactly this.

### A5. The rename table misses forms in use today

`git grep` on #506 outside the history:

- `node_modules/@automata` with no slash after it: `tooling/consumer-smoke/src/run.ts:136`,
  `packages/tools/tests/unit/shared/create-game/create-game.integration.test.ts:21`;
- `'@automata'` in single quotes: `tooling/repo-hygiene/tests/unit/new-deps.test.ts:16`;
- `` `@automata` organisation `` in prose: `docs/runbook.md:22, 31, 53`, `.github/workflows/release-packages.yml:24, 145`
  (so the runbook would tell the Owner to make the token for the wrong organisation);
- `/automata-tools-.*\.tgz$/` (`tooling/consumer-smoke/src/run.ts:179`): `npm pack` of `@automataframework/tools` writes
  `automataframework-tools-<version>.tgz`, which it does not match, so the tools size budget would quietly report
  "installed from the registry: not measured".

The guard as specified (`@automata/`, `@automata\/`, `@automata:`, `"@automata"`) misses the first three too. **Fix:**
one rule, `@automata(?![a-z0-9-])` → `@automataframework`, replaces the table's first and fourth rows. It covers every
form above (1,953 files, against 1,946 for `@automata/`), leaves `automata@automata-framework` (the agent plugin's id)
and `hello@automataframework.com`, and cannot match its own output, so it is idempotent by construction. The guard uses
the same pattern. The CLI's check-by-eye list adds every changed line with `automata-` before `.tgz`.

### A6. The picture script

- `encode-previews.ts` reads `static/previews/*.jpg` only and writes `.webp` copies beside them; the pages use
  `/previews/<name>.jpg` (`editor-content.ts`, `Home.svelte`). There is no `static/editor-pictures/`. The planned
  script writes `.png` files into `static/previews/` and `static/editor-pictures/`, so nothing would show the new
  pictures and the encoder would skip them.
- A built demo has no tick or seed control from outside (the seed is the game's own, `spec.sim.seed ?? 1`; no step hook
  in `packages/automata/src` or the tools' `e2e` entry). "A fixed tick count" has no mechanism.
- `editor-content.ts` types each picture's `width` and `height` by hand.
- **Fix.** `take-pictures.ts` writes JPEGs under today's names in `static/previews/`; time is held with Playwright's
  `page.clock` (installed before `goto`, then `runFor(ms)`), so `PICTURES` entries carry `ms`, not `ticks`; the script
  is run twice and must write identical bytes (or the build logs why not and the pictures are taken once per release);
  the pages' `width` and `height` come from `PICTURES`. A canvas shot leaves out page markup but not what Pixi draws, so
  each picture is still looked at for the game's own pause button.

### A7. The 2D example colours

Every hex colour literal in `examples/2d` (tests excluded) is off DUEL: twelve colours at 36 places in 15 files, not the
three of `shapes-rects.ts`. With `nearestDuel`'s pick: `0xffffff` (10 places) → `#f5f7fa`; `0x2e222f` (5) → `#31222a`;
`0xffc825` (4) → `#ffcf05`; `0xf9c22b` (4) → `#ffbc4e`; `0x3e3546` (3) → `#3b303c`; `0x5ac54f` (3) → `#7fbd39`;
`0x00cdf9` (2) → `#52d2ff`; `0x5ee6a8` → `#91daa1`; `0x4fc3f7` → `#6dccff`; `0x0cf1ff` → `#74f5fd`; `0xff5d8f` →
`#f85d80`; `0xf5555d` → `#e45c5f`. They are view colours (the examples' goldens in `examples/2d/__goldens__` are
replays of sim state), so no hash should move. The test's wording also needs care: `DUEL_RAMPS` holds `#rrggbb`
strings and `nearestDuel` returns an index (`DUEL_RAMPS.flat()[nearestDuel(hex)]` is the colour). **Fixed** in the
spec and Task 3.

### A8. The style gate and the site

- `pnpm style` passes `site/src` only as a `--comments-only` root, and `findingsFor` returns only plan-comment findings
  for those roots and for every `.css` file. Making `MAX_SOURCE_LINES` count `.css` alone leaves `site/src/app.css`
  (1,092 lines) passing: the planned failing test would pass while the real file does not fail.
- `PLAN_REFERENCE` already matches "spec F-4", "QB-D3" and "§4.2". The site's citations sit where no style root
  looks: run with `site/scripts` and `site/playground` as comments-only roots, today's regex finds 28 lines at once
  (`site/src` has none it can see). The forms it misses are the bare decision codes in `site/src`, "(D8)" and
  "(PLAY-D6)". `site/tests` holds 30 more "§" lines, but tests are exempt by folder, by design.
- `--test-imports site` finds 86 lines in 44 files with today's `test-imports.ts`: the rule needs the root, not new
  code.
- **Fix.** Task 1 makes the 600-line rule apply to every non-test file `check-style` reads, comments-only roots and
  `.css` included (no other file in today's comments-only roots is over 600 lines, so only `app.css` fails, as it
  should), without the packages' naming rules. Task 4.5 adds `site/scripts` and
  `site/playground` to `--comments-only`, `site` to `--test-imports`, and the bare decision code (`(D8)`, `(PLAY-D6)`) to
  `PLAN_REFERENCE`; its failing tests are those, not the forms already caught.

### A9. The build command

`cd site && pnpm build` on a fresh checkout of #506 stops in `build-demos.ts`: "`@automata/audio-synth`: ./dist/index.d.ts
does not exist; run pnpm build first". The API index lists the nine published extensions, which only `site/turbo.json`
builds first. `pnpm exec turbo run build --filter=@automata/site` builds (15 tasks). Task 0 and Task 3 Step 5 now use it.

### A10. The build branch and the plan

The build branches from #506, which holds neither this plan nor the stage 1 audit (#477 and #510 are not in it), yet
every task appends to the plan's log. Merging #510's branch into #506 conflicts in `docs/refactor/progress.md`
(`git merge-tree`). Today two stack tips qualify as "the newest head that holds #458, #476 and #499": #506 and #508.
**Fix:** Task 0 merges the plan-audit branch (this PR's) into the build branch first, keeps both sides of
`progress.md`, and takes #506 unless the merge thread names a newer head.

### A11. "Play it" before hydration

Hydration waits for the first contentful paint or three seconds (`hydration.ts`). Review Focus 1 says a press before
then "must still start the game", but the planned test presses and retries with `toPass`, which is how today's
`visitor.e2e.ts` passes with a lost press ("a press before then is lost, as a visitor's would be, and a visitor presses
again"). A visitor whose press does nothing thinks the game is broken (the drunk grandma test). **Fix:** the test presses
once, right after `goto(..., { waitUntil: 'commit' })`, with no retry. The page remembers a press it cannot answer yet:
`AFTER_FIRST_PAINT` also starts hydration on the first `pointerdown` or `keydown`, and an inline listener marks
`<html data-play-pressed>` when the press lands on the bar's button; `DemoRunner` starts the game on mount when the mark
is set.

### A12. The demo bar

- The spec makes "Play it" a primary button. The approved mockup draws it as the white secondary (`btn--secondary` in
  `site-home.html`), and Home keeps one lime primary per screen (`home.test.ts`); the hero's "Make a game" is on the same
  screen.
- While playing, the spec's bar has only "Stop". Today it also has Full screen, Start over and Open in a new tab, plus
  "Starting the demo…" and a failure message with Retry. On a 390 px phone the game is about 220 px tall, so Full screen
  is how it is played; AGENTS.md: never hide an action to make a picture fit.
- **Fix.** "Play it" is the bar's white secondary; playing, the bar shows "Emberwick", "Full screen" and "Stop";
  starting, "Starting Emberwick…"; failed, "Emberwick didn't start." and "Try again". Start over and Open in a new tab
  go (essentials). Copy rows added to spec section 7.

### A13. The try-it editor, made and played end to end

Made on the built site (#506) at 1440 × 900 and 390 × 844: Try the editor, New level, Platformer, then painting. The
level draws and takes items; the console is clean. Screens: `refactor/2026-11-08-site-plan-audit-screens/` in the
project files.

- **No Play.** The only actions are Share and the editors; a visitor cannot see what they drew in play. Whether the
  try-it should play a level is a feature, so it is the Owner's call (a decision card in the thread). The plan
  assumes "no" until the Owner says otherwise: the Editor page says in words that playing needs `automata editor` on your
  own game.
- **On a phone** (editor code, not the site's; for the editors' owners): the top bar shows the game's name as "Sa…"; a
  blank white box sits at the top left of the stage; the tool bar's brush-size `+` is cut at the right edge (controls
  reach x = 505 and 623 on a 390 px screen); the "Editor colours" control overflows by 8 px; what a tap places is not on
  screen; and a tap outside the level's grid puts a Checkpoint outside the level.
- **For the site:** Task 4.2 now also checks, at 390 × 844, that nothing in the try-it reaches past the screen's edge and
  that the game's name reads whole; it fails until the editor is fixed, and the Editor page's phone picture and its
  caption "It works on a phone and a tablet too." wait for that.

### A14. The app decision

The Owner, 2026-11-08 14:53, in "Ship the paid desktop and mobile apps": "$19.99 for mobile, $39.99 for desktop; lets
keep essentials on web, everything open source except deployment, but the full suite requires the app desktop or
mobile". The spec, written the same hour, shows "the suite" on the Editor page and in the try-it. **Fix:** ruling R7:
the site shows only the editors that stay on the web (the apps audit decides which; Task 0 rereads it). The first
version of this fix left the App page to the apps pipeline; A16 brings it into this slice.

### A16. No page for the paid apps (added after the Owner's app decision)

- **The Owner, 14:53:** "$19.99 for mobile, $39.99 for desktop; lets keep essentials on web ... the full suite requires
  the app desktop or mobile". The coordinator asked that the site carry the pricing and download pages. The apps audit
  (stage 1 of that area, `refactor/apps-audit.md` in the project files) already names the address: the free editor
  command will say "Feel and Audio are in the Automata app. Get it at automataframework.com/app." The stores also need a
  support address and a privacy policy on a website (its A16), and the Editor page needs one plain line on the app (its
  A19). Today there is no `/app` page; Privacy and Terms speak of the site only ("No accounts or forms").
- **One page, not two.** The site hosts no app files: the phone apps come from the App Store and Google Play, and the
  computer app's download goes to buyers by email from the seller, a merchant of record such as Polar (apps audit
  section 5). So "pricing and download" is one page, `/app`, whose buttons lead to the two stores and the seller's
  checkout.
- **What it says** (copy rows in spec section 7): the two prices, paid once, and which devices each covers (iPhone, iPad
  and Android; Mac, Windows and Linux); that they are two purchases, as Nomad Sculpt's are (a phone purchase does not
  unlock the computer app); what is free on the web and what the app adds, from one list; that all the code is open
  source and what the price buys; and where to ask for help (`/app#help`, the stores' support address).
- **States.** No app exists yet and no store link is known, so every store link starts empty and reads "Coming soon" in
  words, never a button that goes nowhere. A link can be set only when Privacy and Terms each have an `#app` section
  saying what the app keeps and who sells it, written against the app as built (the apps pipeline knows that, the site
  does not); `check:site` enforces it. No picture of the app: there is no app to photograph, and pictures come from
  `take-pictures.ts`.
- **What stays free** is the apps audit's D1, the Owner's call: A (recommended there) keeps Levels 2D with Characters
  and Add tiles, the Tuner, and Play and Publish on a game folder free on the web. The page reads its two lists from one
  data file; the build uses A until the Owner answers, and logs it. The page goes live only with the site (A15).
- **Fix.** Ruling R7 is rewritten: the site shows only the web's editors and carries the App page. New Task 4.6 builds
  it, the Editor page's line and button, the footer link and the check; the header keeps its four links.

## 3. Minor

- **M1. `CodeBlock`'s props.** The planned `lang?: 'ts' | 'sh' | 'toml'` and the loss of `filename` break two callers:
  `DocsPage` passes markdown's `block.lang` (the guides use `sh`, `ts`, `yaml` and none), and `AgentSetup` passes
  `lang="text"` with captions that say where the code goes ("Copy this to your agent", "In your terminal"). Keep
  `lang?: string` and a `label` shown as words above the box (not a language header).
- **M2. The highlight test.** Shiki with `github-light` writes `style="color:…"` spans, not `.tok-keyword` classes, and
  `CodeBlock` highlights only once it is near the viewport. The test awaits `highlightCode` and looks for a coloured
  span holding `const`.
- **M3. `apiVersions` and `latestApiVersion`** have four callers (`CommandMenu`, `ApiIndex`, `ApiPackage`,
  `routes/api/[version]/[pkg]/+page.ts`); knip will not flag them. Replace them with the one version.
- **M4. The clipboard.** Playwright grants `clipboard-read` in Chromium only, and the site's config has a WebKit
  project. Stub `navigator.clipboard.writeText` with `addInitScript` and read what it was given.
- **M5. The deploy's edges.** `ci.yml:363` passes `SITE_DEPLOY_TOKEN` into `site.yml`, and the runbook's secrets table
  names it (line 23): both change with the secret. The Pages project needs the custom domain attached (not in spec 5.5's
  steps). Between adding the token and the first release, every push to `main` would fail `check:launch`, so the token is
  the Owner's last step. `check:deployed` probes the deployment address `wrangler` prints, then the domain.
- **M6.** `site-checks/pages.ts` imports `REDIRECT_FILES` from the redirect feature; Task 4.5 names it.
- **M7.** "No page but `/editor/app/` offers a template" must mean a link or button that starts one: the Editor page's
  picture of New level names "Platformer" on purpose.
- **M8.** The test that no tracked file names the Gmail address must not name it whole, or it finds itself.
- **M9. R2 challenged.** Keep the playground's fake host, but keep its folder `ruken/`: it imports
  `@ruken/sdk-host/testing` (`createFakeHost`), and a folder named for the platform keeps the rule "only a target's
  adapter imports that platform's packages" visible; the move changes no behaviour and moves tests.
- **M10.** `precompress: true` writes a `.br` and a `.gz` beside 318 of the build's 762 files; Cloudflare compresses on
  its own and would serve them as addresses (`/index.html.br`). The upload leaves them out.
- **M11. R4.** The 3D plan's 19.1 and 20.1 are "Not started" (`progress.md`); the site row now says they wait for
  `@pixi/3d` to be public, so they are not orphaned.
- **M12.** Part C also waits for Parts A and B's own PR; otherwise it is the first straggler.
- **M13.** Each task's commit step appends its log entry and updates `progress.md` (AGENTS.md), not only Task 7. The
  first release depends on #440's `.changeset/first-public-release.md` (commit `12bda870`), still open; Task 7 names it.
- **M14.** `llms-full.txt`'s new line says "API page" while R6 renames API to Reference: "Every guide and Reference page
  in one file". The try-it follows the device's theme while the site is light (R5): accepted, the editors own their look.

## 4. The rulings and the host

- **R1** (scope swap only), **R3** (cut the redirects), **R5** (no site dark mode), **R6** ("Reference"): agreed.
- **R2**: agreed on keeping the fake host, not on the folder move (M9).
- **R4**: agreed, with the note in M11.
- **D3, Cloudflare Pages**: agreed. It reads `_headers` (A2's merge rule applies), serves a top-level `404.html` with
  status 404, can register the domain, and `wrangler pages dev` lets the headers be tried before an account exists.
- **New, R7**: the web/app split (A14), and the App page (A16).
- **D4**: amended, the launch also waits for Pixi 3D's public release (A15).

## 5. Drunk grandma

Fixed in the spec's copy table: one lime primary per screen (A12); a first press that always works (A11); Full screen
kept and a failure that says what happened and what to press (A12); the missing page styled at every address (A1); the
try-it's phone bugs and no Play (A13), which the Owner and the editors' owners decide; "Reference" used the same way in
`llms-full.txt` (M14); the App page says the price, what it covers and that it is paid once, says "Coming soon" instead
of a button that goes nowhere, and says plainly that the phone and computer apps are two purchases (A16). The rest of
section 7 passes.
