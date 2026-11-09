# Site copy from the GTM research: build audit

Audit of AF PR #542 (`98129556`, stacked on #520) against the GTM research, the marketing plan and the launch posts
(`/mnt/project-files/gtm/`), and against the Owner's 2026-11-09 calls on the paid apps
(`/mnt/project-files/gtm/2026-11-09-paid-app-features.md`). Checked for completeness, consistency and cohesion, and for
the drunk grandma test. Screens are in `/mnt/project-files/refactor/2026-11-09-site-copy-build-audit/`.

## What holds

- The headline is "Finish the game your agent started." on Home (`HERO.title`, the h1) and in the page title. Neither
  the site's source, its tests nor the built pages contain "makes the fun part".
- Prices come from one file (`shared/content/pricing.ts`), and Home and `/app` agree. "No credits, ever." appears
  everywhere the price is.
- The Home section order follows the plan's three proofs in order: built in, checks, editors.
- No "deterministic", "ECS", "no-code" or "open source" appears on Home or `/app`. FigureBuilder and EnvironmentBuilder
  are banned by `check:site`.
- The built-in list maps to real code: saves, screens, input with rebinding, audio, display and locale.
- Gates on the PR as it stands: site unit 434 passed, `check:site` 47 pages, site build green. Home and `/app` show no
  sideways scroll at 390 and 1440 px.

## Try-it journey

I made a level in the try-it page (`/editor/app/` from the built site) at phone size in Chromium: New level, then
Platformer, then placed seven checkpoints with the brush. Then I reloaded the page, closed the browser and opened it
again. The level stayed in the list, and when I opened it the checkpoints were all there
(`j3-compare.png`: before on the left, after reopening on the right). I could not play it. The try-it page says it
cannot play a level (`EDITOR_PLAY_NOTE`), and Play in try-it belongs to the saving build (#544, task 3.1).

## Findings

### High

- **H1. The site says every editor is free in your browser, but this stack's try-it page has two.** Home, `/app` and the
  marketing posts say every editor (2D and 3D, Writer included) is free in the browser. The try-it page built from this
  stack shows only Tuner and Levels (`first.png`), because `build-demos.ts` copies `packages/editor/dist/suite`.
  Every editor arrives with #532 (`extensions/editors/dist/suite`), which is not under #542. *Fix:* bring #532 into the
  site stack before #542 deploys. The deploy is blocked until Pixi 3D is public anyway. Not changed here.
- **H2. "Record a play once" promised a recording a new game does not have.** Fixed. The Checks section said a recorded
  play fails the test when the agent breaks something. A new game's test runs the same moves twice and compares the two
  (`template-game.ts`), and nothing records a play for the maker. It now says what is true: the same moves give the
  same result, the game comes with tests, and one command runs them. The marketing plan's second proof point
  ("checks every change against what already worked") overclaims in the same way. Saved replays are the first
  sweetener the GTM thread suggested, and building them would make the claim true.
- **H3. "Publish ... then offers to put it on itch.io" described a step that does not exist.** Fixed. The editor's
  Publish gives one zip and tells the person to upload it (`PublishGameDialog.svelte`). The Owner's "zip, then ask
  where, itch.io first" is planned, not built. Home now says "Publish packs your game into one zip. Upload it to
  itch.io ... or to any website host." The `automata ship publish --target itch` card stays, because the command does
  upload.

### Medium

- **M1. The app sold the editors.** Fixed. The Home pricing card said the app gives you "The editors on your phone,
  tablet or computer". The Owner (2026-11-09 01:46) says an app sells no setup and what only an app can do, never a
  limit of the free web editor. Each purchase now has its own list (`APP_OFFER.phone.gives`,
  `APP_OFFER.computer.gives`): the computer leads with "Nothing to set up". The phone and tablet app lists iPad first
  and Apple Pencil. Anything not built says "coming later". A test refuses an editor, sync or "keeps your work" in either
  list.
- **M2. The turned-down line had no guard.** Fixed. `check:site` now bans "makes the fun part" on every page.
- **M3. Sync is sold as free, but it is not in this stack.** "Sign in with GitHub to keep your games in sync" is on Home
  and `/app`. Sync is #544, which is not merged. This is fine once #544 lands before deploy. Not changed.
- **M4. "Level editor" and "every editor" sit side by side.** The header says Editor, the footer says Level editor, the
  Home link says "Try the level editor" and `/editor` is titled "The level editor". Meanwhile Home says "every editor".
  Once #532 is in, rename these to "the editors". Not changed, because in this stack the label is true.

### Low (drunk grandma)

- **L1.** The facts row says "4 engines: Node, Chrome, Safari and Firefox", "4 targets ... and Ruken", and the Checks
  table says "unit tests" and "parity job". Node, Ruken and "parity" mean nothing to the buyer.
- **L2.** The Examples cards on Home are developer notes ("draws one view per component id, interpolated between
  ticks"). They come from the examples' own descriptions, so a short plain line per example would fix it.
- **L3.** The "Free" pill ("Every editor is free in your browser") links to Pricing, not to the editors. A reader who
  taps it expects editors.
- **L4 (editor, not copy, for the editors thread).** In try-it at 390 px, the brush size "+" is cut off at the right
  edge. A new level is "Untitled platformer" in the list but "Level 1" in the top bar.

## Ran

Site unit (437 after fixes), `svelte-check` (0 errors), site build, `check:site` (47 pages), and the try-it journey above
(Chromium, phone). Not run: WebKit, Firefox, the e2e visitor suite and the full `pnpm check`.
