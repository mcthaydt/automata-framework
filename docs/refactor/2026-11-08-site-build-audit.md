# Site slice: build audit (PR #517)

- **Stage:** 5 of 6 of the site slice (build audit, Opus medium, superpowers `verification-before-completion` as the
  standard, no subagents). It reads PR #517 (`claude/project-thread-jpd2b5`, head `87619dbb`, on #506) against the
  spec and plan of #513 (`docs/refactor/2026-11-08-site-spec.md` and `-plan.md`) and
  [the plan audit](2026-11-08-site-plan-audit.md). It fixes nothing; the fix stage does.
- **Date:** 2026-11-08.
- **What ran (Node 24, Chromium only):** `pnpm install --frozen-lockfile`; `pnpm exec turbo run build --filter=@automata/site`
  (15 of 15); site `test:unit` (410 passed); `check:site` (46 pages, pass); `svelte-check` (0 errors); `pnpm style` (one
  finding, `progress.md:630`, from the base); `check:launch` (fails as designed, see M3); `wrangler pages dev build` with
  `check:deployed` against it (pass); `curl` of a nested missing address under wrangler (404, root `/_app/` links). In a
  browser (Playwright, built site served by `serve-static.ts`): 12 addresses at 390 × 844 (touch) and 1440 × 900;
  Home's "Play it" pressed once right after `commit`, then played to the game's menu, Full screen and Stop; the try-it
  editor at both sizes (New level, Platformer, three coins, Share, Download); the downloaded level taken into a new game
  made with `automata create-game`, opened with `automata editor` and played (C1). The site's Chromium e2e suite was
  started; its result is at the end of this file.
- **Not run:** WebKit, Firefox, a real Cloudflare upload, `pnpm lint:actions` (no Docker), Lighthouse, the full
  `pnpm check` (the PR reports it red on packages below the slice; not rechecked).

## The short version

The deploy half is solid: `_headers` is right on Cloudflare's own engine, the 404 page works at nested addresses, and
the launch gate refuses on every Owner step. The site passes its own checks at both sizes, with no sideways scroll and the
logo and content on one edge.

The end-to-end test fails twice, though. A level made in the try-it editor cannot be played: taken into a new game, it
saves under the wrong name and the game draws a blank screen (C1). And Home's centrepiece does not "start the game" on
one press: the visitor watches "Starting Emberwick…" for about 10 s, then must press twice more (C2). Then there are four
important items: a committed `.wrangler/` folder, the Editor page's phone picture that the spec held back, copy that
says things that aren't true, and a 27 px tap target on the 404 page. Section 4 lists the gaps to the v2 Home the Owner
approved today.

| # | Severity | Finding | Owner of the fix |
|---|---|---|---|
| C1 | Critical | A try-it level, downloaded and opened in a new game, breaks the game (blank screen) | editors + tools; the site's copy |
| C2 | Critical | "Play it" shows "Starting Emberwick…" ~10 s (Ruken handshake timeout in a frame), then two more presses | site (demo build) |
| I1 | Important | `site/.wrangler/` local state (18 SQLite files) committed and not ignored | site |
| I2 | Important | The Editor page still shows the phone picture and "It works on a phone and a tablet too." | site |
| I3 | Important | Copy that isn't true today: Editor page intro, App page's "In the app" list | site |
| I4 | Important | 404 page's "Read the docs" is 27 px tall; the tap-target sweep never visits the 404 page | site |
| M1 to M8 | Minor | See section 3 | site |
| V1 to V14 | v2 gaps | The Home redesign the Owner approved at 17:34 | fix stage |

## 1. Critical

### C1. A level from the try-it cannot be played

What the site tells a visitor: "Your levels stay in this page and are gone when you close it, so press Share to save one
as a file. The try-it editor cannot play a level. To play one, open the editor on your own game with the command below."

What happens when you do exactly that (made 2026-11-08, files in the scratch run):

1. Try the editor at 1440 × 900: New level, Platformer, three coins. Share, Download gives
   `untitled-platformer.af2d.json` (57 kB). This works.
2. `automata create-game mygame` (the built tools, workspace packages linked in). The new game plays: a green square on a
   floor with two platforms (control run, `mygame2`, no console error).
3. Put the downloaded file in place of `content/levels/start.af2d.json` and run `automata editor`. The editor opens it
   and autosaves after one more coin. It writes `content/levels/level-1.toml` (the try-it template's level is "Level 1",
   id `level-1`), rewrites `content/project.toml` and `world.toml` from the try-it project, and leaves the old `start.toml`.
4. The game (`Your game is running` address) draws a **blank screen**, with
   `Error: There is no character "area" in the project. Check the 'live' list.` The starter game's code wants an `area`
   character that the try-it's platformer project does not define, and it plays `levels.start`, not `level-1`.

So nothing a visitor makes on the site ever shows up in a game. This is the same failure as the Owner's 04:17 complaint
("tiles aren't visible"), and the build's by-hand check stopped at "shown in the editor".

**Fix (recommended):** the try-it's Platformer template and `create-game`'s template become one project (the same
character list, including `area`, and the same level id, `start`), from one source the two share; and a journey test does
steps 1 to 4 and checks the downloaded level's coins are drawn in play. Until that passes, the Editor page's sentence
should not send people to the editor with a downloaded file. If the Owner answers R8 with Play in the try-it, the same
test covers it.

### C2. "Play it" does not start the game

Measured at 390 × 844 (touch) and 1440 × 900: the single press before hydration **is** kept (the page answered in
63 ms, the bar changed to "Full screen", "Stop"), so A11 is fixed. Then:

- **About 10 s of "Loading…"** in the frame and "Starting Emberwick…" in the bar. The request log has a 10 s gap after
  the game's first two scripts. The cause is in the demo's bundle: the game is built with Ruken hosting
  (`make-game.ts`: `hosting: { wants: ['menu'] }`), and inside a frame the SDK sends `hello` to the parent every 250 ms and
  waits `XR = 1e4` ms for a `welcome` before it falls back to standalone (`ZR` in `assets/index-*.js`). The site's Home
  never answers, so every visitor waits the full 10 s, on any network. The bar's own deadline is 20 s
  (`DemoRunner.svelte`), so a slow phone that also needs 10 s to load gets "Emberwick didn't start."
- **Then a splash**, "AutomataFramework / Press any key or tap", then the game's menu, "Emberwick / Carry your lantern up
  to the ember. / Play". So it takes three presses and about 12 s to play. Spec 4.2: "Pressing it starts the game in the
  picture's place."
- It predates this PR (the old `DemoRunner` framed the same build), but Task 2 owned the centrepiece, and its journey
  only checks that the frame mounts.

**Fix:** build the site's demos for the web target (no Ruken handshake), or give the frame a `?demo` start that skips the
handshake, the splash and the menu; and the visitor journey asserts the game is playable (the room drawn, a key moves
the player) within a stated time after one press.

## 2. Important

### I1. `site/.wrangler/` is committed

Commit `ea0cd246` adds 18 Miniflare SQLite files under `site/.wrangler/state/v3/` (about 1 MB, including a 457 kB trace
store that logs the local check's requests to `127.0.0.1:4871`). Nothing ignores `.wrangler/`, so every `host:local` run
dirties the tree. Nothing secret is in them (checked with `strings`). **Fix:** `git rm -r site/.wrangler` and add
`.wrangler/` to `.gitignore`.

### I2. The phone picture the spec held back is on the Editor page

Spec 4.3 and 4.4: the phone picture and "It works on a phone and a tablet too." wait until the try-it passes the
390 × 844 edge check. That check is marked `test.fail` (`tests/e2e/editor-try.e2e.ts:52`), and today the brush's `+` still
reaches x = 399 on a 390 px screen. The page still shows both (`editor-content.ts:39-41`), and the picture shows the
"Sa…" name and the white box. The templates picture also shows the New level title dark on dark. **Fix:** take the phone
picture and its caption out until the check passes. Retake the templates picture once the editors fix the title, or
crop it below the title.

### I3. Copy that is not true today (drunk grandma)

- **Editor page, first paragraph:** "The level editor opens on your game's folder. Paint the rooms and place the
  characters: each change is saved into the game, and the running game picks it up." The next lines say the try-it keeps
  nothing and plays nothing. A visitor reads the paragraph under "Try the editor" as describing what they are about to try.
  **Fix:** lead with what the try-it does ("Try it here: paint a level, then press Share to keep it"), and move the
  "your game's folder" sentence under "On your own game", where it is already said.
- **App page, "In the app":** "Feel, Audio, Writer and Sequence". The free `automata editor` today opens Feel and Audio on
  a new game (its Home lists Controls, Start, Feel, Audio). The list is the apps audit's option A, which the apps pipeline
  has not built. **Fix:** say in the list file which items are not yet gated, and keep `/app` out of the build or out of
  the footer until the split is real. At the latest, the launch checks it: `check:launch` could ask the built editor
  list for the free editors.
- **App page:** "Every editor on your phone" is under "In the app", while the Editor page says the try-it works on a
  phone. Reword it as "Every editor, made for your phone" or drop it until I2 is settled.

### I4. A 27 px action on the 404 page

"Read the docs" on the missing page is a text link 112 × 27 px at both sizes, beside the 48 px "Go to the home page".
AGENTS.md: touch targets at least 44 px. `site.e2e.ts`'s tap-target sweep walks the sitemap, which leaves `404.html` out by
design, so nothing caught it. **Fix:** make it the white secondary button, and add the missing address (top-level and
nested) to the sweep.

## 3. Minor

- **M1. Full screen keeps its word.** In full screen the bar still says "Full screen"; pressing it leaves. Say "Exit full
  screen" while `document.fullscreenElement` is set.
- **M2. The phone bar drops the tagline** (`demo-runner.css:87`) against spec 4.2's words. It's reasonable at 390 px,
  but it isn't logged as a ruling in the plan; log it.
- **M3. `check:launch` words.** With no MX record it says "Could not look up the mail record for automataframework.com
  (queryMx ENODATA …)". `ENODATA` means the name resolves and has no MX, which is the "has no mail record" sentence.
  Map `ENODATA` and `ENOTFOUND` to it. (`ENODATA` rather than `ENOTFOUND` suggests the domain now resolves. The earlier
  audit found it unregistered, so the Owner may have registered it. Worth asking.)
- **M4. `check:launch` asks npm about `@automata/tools`.** The `@automata` scope belongs to another npm account, so before
  Part C a package of theirs would pass this check. The runbook merges the rename first, so it's low risk. Note it in the
  check's comment, or ask for `@automataframework/tools` until Part C lands.
- **M5. A first touch elsewhere loses the mark.** The inline listener is `once: true`. A phone visitor who scrolls first
  (a `pointerdown`) starts hydration but no longer marks a Play press, so a tap on "Play it" during the hydration chain is
  lost. Keep the listener until mount, and mark only presses on `[data-play]`.
- **M6. Pictures differ between runs.** The two game pictures differ by about 27,000 pixels between runs (logged ruling).
  Accepted, but spec section 8 item 3 says "two runs write the same bytes, or the log says why". The log says why, so keep
  it as a known gap.
- **M7. `wrangler` as a site devDependency** adds `workerd` and about 836 lockfile lines to every install, including CI jobs
  that never deploy. Consider `pnpm dlx wrangler@4.140.0` in `site.yml` and in `host:local`.
- **M8. `site.yml`** puts `${{ steps.upload.outputs.url }}` straight into a `run:` line. Pass it through `env:` (template
  injection hygiene; the value comes from wrangler's output). Set `WRANGLER_SEND_METRICS=false` too.

What was checked and holds: `_headers` (one CSP per path, no header twice, `!` detaches as documented; `check:deployed`
passes on `wrangler pages dev`), the 404 page at `/no-such` and `/docs/nope/deeper` (styled, root `/_app/` links, status
404), the closed-beta scan last in `build`, `/app`'s prices, "Coming soon" as words, the two-purchases sentence, the
`#help` address, no sideways scroll on 12 addresses at 390 and 1440, the logo and the first heading on one edge (x = 16
and 120; docs pages have their sidebar there), one lime primary per screen on Home, the header's four links plus Search
and Get started, `check:site` refusing a store link without `#app` sections (unit tests).

## 4. Gaps to the v2 Home (approved by the Owner, 2026-11-08 17:34)

Source: `refactor/2026-11-06-redesign-mockups/site-home-v2.html`, `shots-v2/`, `PATTERNS-2026.md`. v2 replaces the light
`site-home.html` that #517 was built to. The editor pictures stay light. The site keeps two rules: no customer logos or
quotes, and every number comes from data.

| # | Area | #517 today | v2 | What the fix stage does |
|---|---|---|---|---|
| V1 | Theme | Light tokens (`shared/styles/tokens.css`), ruling R5 "no dark mode" | Dark first: `--bg #0b0c0e`, `--panel #121418`, `--raise #181b20`, `--line #23262c`, `--ink #f2f3f5`, `--muted #a6abb3`, lime `#cbf25c` the only colour, radii 4/6/8 px | Replace the tokens site-wide (every page goes through `PageShell` and `shared/styles/`). Restate R5 as "the site is dark, with no toggle". Recheck contrast on every page, including `/app`, Docs prose, Reference and 404 |
| V2 | Code colours | Shiki `github-light` | Dark code box with lime and blue keywords | Switch the highlighter's theme to a dark one; `code-highlight.test.ts` follows |
| V3 | Header | Docs, Examples, Editor, Reference; Search; "Get started" | Docs, Examples, Editor, Reference, **Changelog**; **GitHub**; "Make a game" | Add Changelog (needs V10's page). GitHub only when `REPOSITORY_PUBLIC` is true (`check:site` refuses repo links today), so hide it until launch. Keep Search, since v2 does not forbid it and Reference needs it |
| V4 | Hero layout | Split: text left, game right | Centred, faint 48 px grid that fades out, low lime glow under the game | New `HomeHero` layout; the grid and glow are CSS only, no image |
| V5 | Announcement | none | "New · The level editor, in your browser →" pill above the H1 | One pill to `/editor`, from data. Corners 4 px, not a pill radius (the Owner's "no pill buttons") |
| V6 | Hero actions | "Make a game" plus the command box | "Make a game" (lime) and **"Copy the prompt for your agent"** (secondary), then the command as a plain line with a copy icon | Reuse Start's agent prompt (`agent-setup.ts`) as the one source; the button copies it and says "Copied". Command from `CREATE_COMMAND` (the mockup's `@mcthaydt` name is stale) |
| V7 | Game | Right of the hero; bar under it with "Play it" | Full width under the hero; bar **above** with name, tagline and key hints "← → Space to play" | Move the bar on top. Keep the poster and one press to play (spec 4.2, and C2's fix), and show the key hints (or "Tap to play" on touch) once it plays |
| V8 | Numbers row | none | "4 engines", "17 examples", "4 targets", "MIT" | Read each from data: engines from the parity projects, examples from the examples catalogue (17 pages today), targets from `TARGETS`, the licence from `package.json`. A unit test fails on a typed number |
| V9 | Middle sections | "Why Automata" three cards; code; editor, stacked | Three alternating text-and-product sections: code with three checked bullets; the determinism table (Node, Chromium, WebKit, Firefox, "Same hash"); the editor | The table's rows come from the parity job's engine list, not typed by hand. The "Why" cards go |
| V10 | Changelog | none | "Recently shipped." four dated items and "Full changelog" | Needs a source (the changesets/`CHANGELOG.md` files, or one data file the release writes) and a `/changelog` page; items must be real |
| V11 | Examples | One link, "See every example running" | Six cards (picture, title, one line, file name, "Open") and "All 17 examples" | Pictures from `take-pictures.ts`, not drawn; the count from the catalogue; no card starts a template |
| V12 | Publish | Four stacked cards | Four cards in one row with their commands | Restyle only |
| V13 | Closing band | Plain, "Make a game" and "Read the docs" | Full lime band, one button and the command | One action; it's the screen's one lime area, so the button inside is dark |
| V14 | Footer | One row of links | Columns (Tools: Level editor, Changelog, GitHub, …) | Keep "The app", Privacy, Terms, Contact; GitHub as in V3 |

Spec items that v2 overrides, which the fix stage logs as rulings: R5 (V1), 4.2's bar position (V7), and the "approved
mockup" in section 1 and section 8 item 2, which now names `site-home-v2.html`.

## 5. What must be fixed before Parts A and B merge

C1 (or, at least, the Editor page stops promising it until the fix lands), C2, I1, I2, I3 and I4. The v2 section is the
fix stage's main job. M1 to M8 can ride along.

## 6. The site's Chromium e2e suite

(Filled in below when the run ended.)
