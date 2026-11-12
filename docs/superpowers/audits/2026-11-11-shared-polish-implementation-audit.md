# Shared polish from FloorFifty: implementation audit

**Date:** 2026-11-12. **Stage:** 5 (implementation audit) of workstream 1. **Branch:** `claude/shared-polish-impl-audit`,
from `main` at `2d238cd0` (the merge of #645).
**Audited:** the work merged as #645: `git diff e6aabd78...2d238cd0` (433 files, +23,265 / −855), against
[the spec](../specs/2026-11-11-shared-polish-design.md) with its amendments, [the plan](../plans/2026-11-11-shared-polish.md)
with its ledger of rulings, `AGENTS.md`, the Owner's decisions in [`../progress.md`](../progress.md) and the code on
`main`. **Tracker:** [`../progress.md`](../progress.md). Earlier audit: [the plan audit](2026-11-11-shared-polish-plan-audit.md).

No code and no test was changed by this stage. Every scratch file used to check something (a probe server, a copy of a
game, a screenshot spec) was outside the repository or deleted before the commit.

## How it was checked

- `pnpm install --frozen-lockfile`; `vendor/FigureBuilder` placed at `main`'s pin `d6e3c9fb` (attached read only) and
  `node vendor/figure-builder/types.mjs` run, so the 3D packages typecheck.
- The whole `pnpm check` on `main` `2d238cd0`: **exit 0** (lint; typecheck 54 tasks; `boundaries`, all 12 runs 0 findings;
  `style` 0 findings; `source-names`; `knip`; unit tests 63 tasks; `check-changesets` 67 changesets, 0 problems).
- `pnpm build` (16 tasks, exit 0); `pnpm agent-skills` ("5 skills, no layout problems"); `pnpm api-report` ("0 API breaks
  against the base, 0 undeclared": the committed reports match the build); `pnpm api-index` ("1289 exports from 49 entry
  points … 0 undocumented", exit 0, so the committed cheatsheet and agent reference are current).
- The 2D browser suites this work touched, Chromium only (`--project 'browser*chromium*'`, `AF_WEBGPU=software`):
  `@automata/framework` 2,225 passed (26 files); `@automata/ui-screens` 550 passed, 1 skipped; `@automata/net-ui` 100
  passed; `@automata/content` 3 passed.
- Emberwick's journeys, `emberwick-*-chromium` and the six `emberwick-language-*` projects: **38 passed** (phone,
  compact, iPad-sized Chromium, the dev server, en, ja, ko, es-419, pt-BR, zh-CN).
- The examples' journeys, projects `examples`, `examples-compact`, `runner`, `runner-compact`, `demos`, `ui-primitives`:
  **106 passed, 2 skipped**, the four new examples' journeys among them (plus six scratch cases of this audit for S8,
  deleted afterwards).
- The site: `pnpm build` (exit 0), `pnpm check:site` ("Verified 51 built pages"), unit tests **518 passed** (84 files),
  the whole Chromium suite **509 passed** (one `test.fail` case, the editors' top bar at 390 px, fails as it is marked to,
  plan audit A13, not this work), the playground's own suites (`playground-chromium`, `playground-frame-chromium`) **41
  passed**.
- The consumer smoke's stranger journey, Chromium: **1 passed** (it packs every package, makes a game with `create-game`
  outside any workspace, installs from the packs, runs the game's `pnpm check` with no-eval, tests, plays and zips it).
- Probes of this audit's own, outside the repository: a CORS probe in Chromium (B1), `automata words` against a local
  stand-in for the API (S3), fontkit over every built font subset ("What holds"), `negotiateLocale` under Node (S5),
  each content entry loaded under Node (S7), a `vite build` of Emberwick into a scratch folder (S2), and Emberwick's
  plumbing measure (S4).

## Findings

Ranked: **blocking** (a spec goal is not met where the spec says it is, or a law or an Owner decision is broken),
**should fix** (a defect a player, a maker or the next stage will meet), **tidy** (a wrong detail, a copy, a record).
The ten known items the coordinator named are each answered; where one has siblings they are named in the same finding.

### Blocking

**B1. The stale-build check can never say "stale" when the game and its server are on different origins.** Spec item 7
and goal 7: "An online game tells a player their tab is out of date before they join." The client reads the server's
facts with the game's own ``fetch(`${serverUrl}/version`)`` (`extensions/net/README.md:38`), from the game's page. The
server answers `/version` with `PROBE_HEADERS` only (`extensions/net-server/src/features/operations/probes.ts:41-44`,
`:53-55`, `:70-75`): `cache-control` and `x-content-type-options`, no `Access-Control-Allow-Origin`. The server's own
routes expect a cross-origin page: the matchmaking gate and every refusal answer with the origin policy's CORS headers
(`src/features/gates/origins.ts:16,46`, `server-gates.ts:63`, `refusal.ts:28`). A browser therefore refuses to hand the
answer to the page, `fetchFacts` rejects, and `checkServerVersion` turns a rejection into `current`
(`extensions/net/src/features/client/version/check-server-version.ts`, "A throw, a rejection … is `current`"). The
step lets every stale tab through, silently, in the deployment the server is built for: `net-server` serves no game
files, and a game reaches it as another origin (Ruken's `network.connect`).
*Verified:* a Node server answering `/version` with exactly those headers on `127.0.0.1:8791`, and a page on
`localhost:8792`, in Chromium: `fetch('http://127.0.0.1:8791/version')` → `rejected: Failed to fetch`. The unit tests
could not see it: `probes.test.ts` and `stale-build-step.test.ts` fetch from Node or pass a `fetchFacts` stand-in, and
the spec's journey ("covered by a journey") was not written (plan call 15; see S6).
*Fix:* answer `/version` with `origins.corsHeaders(request.headers.origin)` as the gates do (pass the policy to
`installProbes`), a unit case that sends an `Origin` header and expects the allowed origin back, and one browser case
that fetches the facts cross-origin (S6).

### Should fix

**S1. Known item 1, confirmed and wider: the flow's, the display policy's and the lost-picture panel's words do not
follow the language.** `GameSpec.copy` and core's catalogs promise every word in the player's language; the default
screens keep theirs live (`app/screens/screens-copy.svelte.ts`), these three do not
(`packages/automata/src/app/boot/boot-program.ts`):
- the flow's words (a screen that fails to enter, a slow load, a download that stalls: `flow.manager.ts:157-204`) are
  `runtimeCopyFor(locale.current)` read once at `:372`, *before* the opening runs (`:433-447`). A player on an English
  device who picks 日本語 on the first-run screen gets these in English for the whole session, and so does a player who
  changes language in Settings;
- the landscape gate, the rotate hint and the rotate toast (`displayCopyFor(locale.current)` at `:460`) are read once
  after the opening, so they follow the first-run pick but not a later change in Settings;
- **sibling:** the lost-picture panel during play (`reportLost`, `:265-280`) uses `earlyCopy`, the words chosen at
  `:175` *before the locale service exists*, from the browser's languages only (`runtime-copy.ts`: "Nothing saved is
  read"). It ignores the saved choice, the first-run pick and the language a Ruken host supplies, for the whole
  session, though the locale is known by then;
- **sibling:** a game's own runtime words (`GameSpec.copy`, everything but `screens`) are one fixed record
  (`game-definition.ts:154`), laid over every language (`boot-program.ts:372`); unlike `copy.screens` they cannot be a
  function of the locale, so a game that rewords "Couldn't connect" rewords it in English for all six.
*Verified* by reading the call order and the three call sites above.
*Fix:* hand the flow and the display policy a reader (`copy: () => runtimeCopyFor(locale.current)`, the display policy
re-reading on `locale.subscribe`, as `screensCopy` does), resolve `reportLost`'s words when the panel is shown, and let
`GameSpec.copy` take a function of the locale as `copy.screens` does. A unit test per site: switch the locale, then
trigger the panel.

**S2. The font's licence text does not reach a built game.** Spec item 1 (fonts): "the font build renames a subset's
family … and ships the copyright and licence text"; the coordinator asked that `OFL.txt` ship with the faces. The font
build writes `<font>-OFL.txt` beside the subsets (`packages/content/src/shared/assets/build-fonts.ts:119-120`), but
nothing references it: `fonts.css` names the `woff2` files only, so Vite bundles the faces and leaves the licence
behind. *Verified:* `vite build` of `games/emberwick` into a scratch folder (1.2 MB): six subsets in `assets/`, no
`OFL.txt`, no licence of any kind. The same holds for every game `create-game` makes (its `main.ts` imports
`fonts.css` the same way). The subsets themselves are renamed correctly (see "What holds" below), and the examples
pass only because the playground copies their whole `public/` folder. *Fix:* the content Vite plugin emits each font's
licence file into the build (`emitFile` from the `fonts.json` list), or the font build writes it under `public/`; a
test that builds a fixture game and finds the licence in `dist`.

**S3. `automata words` reads a wrong key, a rate limit or an outage as "refused", and asks for every word anyway.**
`words-model-live.ts` maps every `APIError` that is not a connection error to `refused`
(`packages/tools/src/shared/node/words-model-live.ts:34-43`), and `runWords` handles an unavailable translator word
by word: it prints the reason and goes on to the next (`run-words.ts:263-293`); `check()` only looks for the key's
presence (`:47`). *Verified* without calling the paid API, by pointing the SDK at a local server
(`ANTHROPIC_BASE_URL`) on a scratch copy of Emberwick with three words removed from `ja` and `ko`:
- a server answering 401 `authentication_error`: six requests, six lines `ja "play": the translator refused the
  request`, then `ja: 0 translated, 3 not (see above; the player sees the English word)`, exit 1. Nothing says the key
  is wrong; "refused" reads as the model declining the text;
- nothing listening (offline): three lines `could not be reached (offline?)`, exit 1, 5 s;
- no key: `automata words needs ANTHROPIC_API_KEY set on this computer to reach the translator; nothing was changed.`
  (clear, and nothing written).
A real run has hundreds of words, so a bad key or a lasting outage costs hundreds of failing requests and lines.
A partial run is handled well: what was translated is written and recorded, and the rest are listed with what the
player sees instead. *Fix:* a `bad-key` reason for 401/403 ("ANTHROPIC_API_KEY was not accepted"), a `busy` reason
for 429/529, and stop the run at the first unavailable answer of those kinds and of `offline` (keep the per-word
handling for a refusal by the model and for a lost placeholder); a case each in `run-words.test.ts` over the fake.

**S4. Known item 6: Emberwick's plumbing limit (430 → 490) and what could move.** Measured here:
`plumbing.test.ts` prints `plumbing 479` (`main.ts` 40, `src/app/game.ts` 12, `src/app/make-game.ts` 71,
`scene-renderer.ts` 46, `emberwick-screens.ts` 269, `flow.ts` 39, `game-id.ts` 2), with `words.ts` (83) moved to
*content* by the same change. The limit and the class were both moved to get green; the test's comment says why, but it
is a test number moved by the work it measures, so it is the Owner's (as the records say). What the framework could
take, by the Owner's rule "core only if generic for any game":
- **`bindWords` for plain-DOM screens** (any game with its own DOM screens needs it): fill `[data-word]` and
  `[data-word-label]` from a catalog function and redraw on `locale.subscribe`, returning the unsubscribe. Lives in
  `packages/automata/src/features/locale/bind-words.ts`, exported from the root entry. Removes
  `emberwick-screens.ts:69-78` (`WordField` and `applyWords`, 10 lines) and turns `:108-114` (7) into one line: −16.
- **`formatNumber` exported** from the root entry (it exists: `features/locale/format.ts:6`, not exported): `:261-263`
  (3) become 1: −2. The panel comment `:30-32` (3) can shrink to 1 once the binding has its own doc comment: −2.
- **Default languages on `defineGame`** (for example `locale: 'default'`, resolved in `app/define-game.ts`, or
  `DEFAULT_LOCALES` re-exported by `@automata/framework`): `game.ts:3` and `:10-12` become one line: −3.
- **`matchLocale` exported** (`features/locale/negotiate-locale.ts:24`): removes `primary` and `catalogFor` from
  `words.ts:46-60` (15 lines), which the measure counts as content, so the measure does not move; it also removes the
  same code from `ui-screens` and `net-ui` (S5).
Not movable: the board submit and its constant (`:15`, `:223-225`: the game's own rule) and `EmberwickOptions.locale`
in `make-game.ts` (the demo's choice). **Total: about −23, so about 456, not under 430.** No change that keeps the
game's own screens brings it under 430. *Recommendation for the Owner:* do the three core exports above (they help
every game, and the language example would use the first), re-measure, and set the limit to the measure with the same
small margin the old limits had (about 460), keeping `words.ts` as content only if it shrinks to the catalog table.

**S5. Locale matching is written four times, and two tools copies exist because three content entries cannot load in
Node.** Core's rule (`features/locale/negotiate-locale.ts:24`, `matchLocale`) is not exported, so it is copied in
`extensions/ui-screens/src/shared/words/screens-words.ts:41-55`, `extensions/net-ui/src/shared/words/stale-copy.ts:29-41`
and `games/emberwick/src/features/screens/words.ts:46-60` (the Emberwick comment says why: "core does not export it").
They agree today (checked: `zh-TW`, `zh-HK`, `zh-Hant`, `ZH-cn` → `zh-Hans`; `pt-PT`, `pt` → `pt-BR`; `es-ES` →
`es-419`; `fr-FR` → `en`, against `negotiateLocale` run under Node), but each is a place to drift. Separately, tools
keeps its own `fontCoverage`, `catalogCharacters` and `packageCatalogs` (plan ledger, tasks 5 and 5b), and
`ship.config.ts` writes the six tags out, because `@automata/content/assets` and `/locale` cannot load under plain Node
(see S7). *Fix:* export `matchLocale` (or a `pickCatalog(locale, catalogs)`) from `@automata/framework` and use it in
the three; once S7 is fixed, drop tools' copies and their pin tests.

**S6. The stale-build check has no journey, and nothing runs it end to end.** Spec: "the stale-build check is
documented in `extensions/net/README.md` and covered by a journey." The plan's call 15 dropped the journey (no home for
a two-process journey) and the records say so; B1 is what that left unseen. *Fix:* a browser test in `net-ui` (or
`net-server`) that serves `/version` from a second origin with the real `installProbes`, runs `staleBuildStep` with
the README's `fetchFacts`, and expects the panel for different facts and the title for equal ones.

**S7. Known item 5, confirmed, with its siblings and the cause of two duplicates.** `automata check --only no-eval`
in a game inside the repository runs a plain-Node `vite build` (`packages/tools/src/shared/check/check-steps.ts:109-113`),
which loads the game's `vite.config.ts`, which imports `@automata/content/vite`, whose source entry
(`packages/content/src/entries/vite.ts:2`) re-exports `'../features/vite/index'` with no extension. *Verified*: loading
each content entry with `node` from source: `vite`, `assets`, `locale`, `palette`, `schema` and `index` all fail
`ERR_MODULE_NOT_FOUND`; only `game-config` (fixed in task 13) loads. It failed the same way before this work (the
entry is unchanged since `e6aabd78`). **A game outside the repository** installs the built `dist` (`exports['./vite']`
→ `./dist/vite.js`), which resolves; the consumer smoke's stranger journey runs `pnpm check` in a game made by
`create-game` from the packed packages, no-eval included, and **passed here**: the defect is the workspace's only. *Fix:* name `.ts` in the
content entries and in what they import (as task 13 did for `game-config`), or have the step run
`vite build --configLoader runner` as the games' own scripts do; then S5's tools copies can go.

**S8. Known item 4, confirmed at both sizes and in every language tried: the Settings "+N more" badge covers a row's
label.** `AGENTS.md`: "Never shrink one or hide an action to make a screenshot fit"; the layout must work at phone size
first. The badge is `position: sticky; bottom: 4px` over the last visible row (`shared/ui/layout/ScrollList.svelte:125-128`),
and with the Language group's seven buttons (three rows at phone width) the list now overflows at both sizes.
*Verified* with a scratch Playwright spec (deleted afterwards) on the `core-languages` example: open Settings, pick a
language, then list every text element the badge's box crosses, inside the frame:
- `examples` (phone): en `"+1 more"` over "Rumble and vibration"; ja `"ほか1件"` over "コントローラーとスマホの振動"; pt-BR
  `"+1 mais"` over "Vibração do controle e do celular";
- `examples-compact` (780 × 270): en `"+3 more"` over "All sound"; ja over "すべての音"; pt-BR over "Todos os sons".
The pt-BR phone screenshot was looked at: the badge sits on the second line of the Vibration row's label, next to its
switch. No layout contract caught it: the sweep checks that essentials are whole and hit-testable, not that the badge
leaves text uncovered. *Fix:* give the badge its own space (the list reserves the badge's height at its end, or the
badge sits in the row gap outside the label column), and add a layout-contract rule that no visible text under a
`[data-scroll-region]` intersects `scroll-more`.

**S9. The flashing warning says the same thing for every game.** Spec item 3: the warning says "what the game does".
The option carries switches only (`app/opening/photosensitivity.ts:30`, `PhotosensitivityOption = true | { switches }`),
and the one body is `"This game has flashing lights and a shaking screen. …"` (`app/screens/words/en.json:124`). A game
that flashes and does not shake tells its players something untrue in a safety warning, unless it finds
`copy.screens.firstRun` and rewrites the body in six languages itself. *Fix:* the option says which effects the game has
(`effects: ['flashing', 'shaking']`) and the body is chosen from words for each (new keys, translated), or at the
least the option's doc comment and the Languages guide say to override the body.

### Tidy

**T1. Known item 2: the web `openLink`.** `features/targets/web/hosting-web.ts:356-365` opens `page.open(url, '_blank')`
and sets the tab's `opener` to null at once, because a `noopener` window answers null and a blocked popup could not be
told from an opened tab (task 11b's ruling). The tab cannot reach back into the game (the opener is cut while the tab is
still `about:blank`), but the browser sends the game's address as the referrer and the tab starts in the game's browsing
context group. Acceptable; say it in the doc comment of `Hosting.openLink`. Each adapter, read: **web and itch** (one
adapter) grant `links` and refuse an address that is not `https` with `INVALID_PAYLOAD` before opening (`isOpenableLink`);
a blocked popup is `{ opened: false }`. **Ruken** asks the SDK (`hosting-ruken.ts:225-230`), which needs `links` in
`wants` or answers `UNSUPPORTED` ("links was not granted", in the vendored SDK); `defineGame` adds `saves` and
`leaderboards` to `wants` by itself (`define-game.ts:261-266`) but not `links`. The credits panel hides its link buttons
without the grant (`CreditsPanel.svelte:49`) and the README and the Ruken guide say to add it, so nothing breaks; adding
`links` automatically when a game shows credits would be kinder. **Tauri** opens through `@tauri-apps/plugin-opener`
(`desktop-tauri.ts:2,31`) and answers `{ opened: false }` when it fails. A refusal or `opened: false` shows "That page
could not be opened." in the panel, which is also what a Ruken player sees after declining the host's own prompt.
Not verified here: a real desktop build, Tauri's capability glob (`https://*` and `https://*/*`), itch's iframe and
popups, a real Ruken host.

**T2. Known item 3: tests not watched failing, and their siblings.** From the ledger: task 5b's `package-words.test.ts`
and the words-step package case were written with the code; the playground frame fix was watched failing for one of
five cases. Read here: both 5b tests can fail (they compare tools' lookup with content's over the same folders), so
they are real tests written late, not tautologies. Siblings in the ledger: task 8's unit file was red only as a whole
(missing module); task 9's function-map `none` case was added after the boot test failed; task 11's unit file was red
only as a whole; task 19's "fails a page that links to `/editor`" pins existing behaviour. No new test asserts a value it
set itself (a grep of the 50 new test files for constant expectations, `.skip`, `.only` and `todo` found none). *Fix:*
for the four playground cases, revert `Playground.svelte`'s observer on a scratch branch and watch each fail; nothing
else needs redoing.

**T3. Interface sound names that nothing plays.** `UI_SOUND_NAMES` declares `open`, `close` and `error`
(`features/audio/ui-sounds.ts:12`) and `create-game`'s `feel-audio.ts` says "every name the framework asks for (press,
back, focus, open, close, error)" (`packages/tools/src/shared/create-game/template-game.ts:211-212`), but no core
component calls `requestUiSound` (grep: only its definition and a doc comment). *Fix:* `Modal` requests `open` and
`close` and the error panel `error`, or the names and the template's comment drop to the three that sound.

**T4. Credit names are outside the font build's glyph gate.** A credits name is not translatable (right) and so is in
no catalog, and the font build cuts each face to the catalogs' characters (`build-fonts.ts:121-126`). A name in a script
the current language's face does not hold (a Japanese name on the English screen) falls back to the device, which the
Owner's font rule forbids, and `automata check` does not say so. *Fix:* the credits content kind adds its names to the
characters every language's face keeps, and the words step checks them.

**T5. Copy that fails the grandma test.** `"Turn down"` (`first_run_warning_choose`) heads the warning's switches; it
says neither what nor why ("Make it gentler:" or "Less flashing and shaking:"). Emberwick's splash is named `"Splash"` to a
screen reader (`splash_label`), which tells a listener nothing ("Emberwick, starting"). Both in six languages.

**T6. The Languages guide says "Core's `DEFAULT_LOCALES`"** (`docs/guides/languages.md:24`) but `@automata/framework`
does not export it; it is `@automata/content/locale`'s, which a game must know to import (Emberwick does,
`src/app/game.ts:3`). Name the import, or export it from the framework (S4).

**T7. The live `automata words` call and the key's name.** The tool reads `ANTHROPIC_API_KEY` only
(`words-model-live.ts:32`), as the spec says. The records say the live call waits for `AUTOMATA_ANTHROPIC_KEY`, and the
Owner's decision says a session must not hold `ANTHROPIC_API_KEY`. Nothing says how the two meet; the way that keeps the
decision is to set it for the one command: `ANTHROPIC_API_KEY="$AUTOMATA_ANTHROPIC_KEY" pnpm exec automata words …`.
Write that into the plan's ledger (or `docs/guides/languages.md`'s maintainer note) so the verifying session does not
put the key in the session's environment.

**T8. `@anthropic-ai/sdk` is not on the browser check's Node-only list.** `browser-only.ts:14` names `fontkit`,
`pngjs` and `subset-font`; the SDK (in `@automata/tools` only, imported by `words-model-live.ts` alone) is kept out of
the browser package today by dependencies alone. Add it to `NODE_ONLY_LIBRARIES` so `pnpm boundaries` refuses it in
`packages/automata` or `packages/content`'s browser entries.

### What holds (checked, no finding)

- **Laws.** The sim gains no file and no import from this work (no `-sim` change in the diff; Emberwick's golden and
  content hash files did not move: no `.hash`, golden or snapshot file in the diff). Effect stays in tools; the browser
  package has `@automata/content`, `@automata/sim` and `zod` as its only dependencies. No new window-message handler,
  no new device storage key but the seen flags (`automata.seen`, device-scoped by design, spec item 3), and no storage
  fallback for a refused capability. `@tauri-apps/plugin-opener` is an optional peer of `@automata/framework`, imported
  only by `features/targets/tauri/desktop-tauri.ts` (`pnpm boundaries --platform-imports` passes).
- **Dependencies.** `@anthropic-ai/sdk` 1.6.0 and `fontkit` 2.0.4 are dependencies of `@automata/tools` only (fontkit
  was already content's); the SDK accepts the request shape used (`betas: ['server-side-fallback-2026-07-01']`,
  `fallbacks`, `output_config.effort`, model `claude-opus-5-5`, all in the SDK's own types, and typecheck passes).
- **The font.** Every built subset (Emberwick's six, the examples' six) was opened with fontkit: family, full and
  PostScript names are `<font> <lang>` (`ja en`, `ko ko`, `zh-hans zh-Hans`, …); the reserved name "Fusion Pixel"
  appears only in the copyright record, which the OFL keeps; the licence description (13) is kept. The full fonts
  (`vendor/fonts/fusion-pixel-12/`, `games/emberwick/assets/fonts/`) are not in Emberwick's build.
- **Six languages.** Core's catalogs: 154 keys in each of the five translations, none missing or extra, every
  placeholder kept; `ui-screens` (5) and `net-ui` (2) the same. The only translations equal to the English are
  `{percent}%` and, in Spanish and Portuguese, "Select"/"Start" (pad buttons) and Portuguese "Menus". A grep of
  `packages/automata/src` and `extensions/ui-screens/src` for English literals in markup and labels found only the
  English records the catalogs are flattened from. The fallback (English for a language core lacks) is in
  `catalogFor`/`screensCopyFor` and tested.
- **First run.** Order language → warning → the game's own opening (splash) → title (`define-game.ts:378-385`,
  `first-run.ts:69-74`); the language step skips one language, a Ruken host and a saved choice; the opening runs after
  the host's ready with the sim held (`boot-program.ts:433-447`).
- **Achievements.** The declaration is host-neutral (Zod, `game-config.schema.ts:42-97`); Emberwick's
  `ember-in-a-minute` (`reach: 60_000` on the ascending `fastest` board) means "at or better than" in both the
  framework's doc and Ruken's (`@ruken/manifest`: "the player's best is at or better than this, in the board's order").
- **Changesets.** 23 new, all `patch`, covering every published package with source changes (`framework` 8, `tools` 10,
  `content` 5, `ui-screens` 3, `net`, `net-ui`, `net-server` 1 each).
- **Known item 10.** The editor gaps ledger has a row for each new content kind: the interface-sound map (3), the
  credits file (4), the achievements declaration (5), `fonts.toml` (6), a game's interface words (7). One more is
  worth a row: the photosensitivity option's switches and (after S9) its effects are code in `defineGame`, which no
  editor opens.

## Spec items and "Done means", marked

| Spec item | State | Evidence |
|---|---|---|
| 1. The six languages, endonyms, picker order, detection rules | done | `DEFAULT_LOCALES`, `ENDONYMS`; `negotiateLocale` run under Node for 13 tags (S5) |
| 1. Core's words ship in six; `copy.screens` overrides | partly | the default screens are live (`screens-copy.svelte.ts`); the flow's, the display policy's and the lost-picture words are not (S1) |
| 1. `automata words`: everything or one line, one language or all, `--all`; checks before writing; one retry; key from the environment; model settable | done | `run-words.ts`; the fake-model tests in `pnpm check`; failure paths run against a local stand-in (S3). The live model call: not verified |
| 1. `automata check`: lost placeholder, font cannot draw | done | `words-step.test.ts` (in `pnpm check`); the step passes on Emberwick (records) |
| 1. Fonts cover all six, subset, renamed, licence shipped | partly | renamed (fontkit read, "What holds"); licence not in a built game (S2); credit names outside the gate (T4) |
| 1. Emberwick (and Ember Hall) in six | done (Ember Hall cut by the Owner) | 38 Chromium journeys passed, the six `emberwick-language-*` projects among them |
| 2. First-run language pick | done | `first-run.ts`; layout contract (`@automata/framework` Chromium browser suite, 2,225 passed); `core-first-run` journey (the examples' Chromium projects, 106 passed) |
| 3. Photosensitivity warning, once per device, Continue/Close/Escape | partly | works and is tested; it cannot say what the game does (S9) |
| 4. Interface sounds: one listener, `data-sfx`, focus sound, `ui` bus, silent by default, template's starter set | done | `ui-sounds.ts`; `audio-ui-sounds` journey (a source node starts on a running context) (the examples' Chromium projects, 106 passed); T3 |
| 5. Splash, skippable, never blocking ready | done | `ui-screens` unit and layout suites (Chromium, 550 passed) |
| 5. Credits from a content file, links through the host | done | `creditsContent`, `CreditsPanel`; T1, T4 |
| 5. `Hosting.openLink` on every target | done in code | unit tests over fakes (in `pnpm check`); T1 lists what was not run |
| 6. Achievements declared host-neutral, written into `ruken.toml`, checked by Ruken's parser; nothing on web/itch/tauri | done | `ship-config.test.ts` (in `pnpm check`); a real `ruken publish`: not run |
| 7. Stale-build check | not done in effect | B1 (the browser cannot read `/version` cross-origin); S6 (no journey) |
| Phone-first layout of the changed screens | partly | the layout contracts pass; the Settings badge covers a label at phone and compact size (S8) |
| Examples: the four, with journeys | done | (the examples' Chromium projects, 106 passed) |
| Site: the Editor page cut, `/editor` redirects | done | site build, `check:site`, site unit 518, site Chromium 509, playground 41, all passing |

| "Done means" line | State | Evidence |
|---|---|---|
| The four examples run and their journeys pass in Chromium at phone, compact and iPad sizes | partly | phone and compact: (the examples' Chromium projects, 106 passed). iPad (`examples-ipad`) is WebKit: not run |
| Emberwick's journeys pass in each of the six languages' menus; its Ruken manifest carries an achievement | done | 38 Chromium journeys passed, the six `emberwick-language-*` projects among them; the manifest: `ship-config.test.ts` in `pnpm check` |
| `automata words` against a fake model; `automata check` fails on a missing word, a lost placeholder, a character no font draws | done | the tests in `pnpm check`; S3 for the failure messages; the live call not made |
| `pnpm check` passes; API reports and the index updated; changesets written | done | `pnpm check` on `main` `2d238cd0`: exit 0; `pnpm api-report`: 0 breaks against the base, 0 undeclared; `pnpm api-index`: 1,289 exports, 0 undocumented, committed outputs current; 23 `patch` changesets |
| The site shows all of it | done, with B1's caveat on what the stale-build docs promise | site build, `check:site`, site unit 518, site Chromium 509, playground 41, all passing |
| Reported, not claimed: WebKit, Firefox, real devices | reported | below |

## Not verified here

- WebKit and Firefox in every suite (only Chromium is installed): the `examples-ipad`, `emberwick-*-webkit`, the site's
  and the playground's WebKit projects, cross-engine parity.
- A real device; a real Ruken host (its locale, its link prompt, achievements awarded); a real `ruken publish`; a real
  desktop build opening the system browser, and Tauri's capability glob; itch's iframe and its popup rules.
- The live `automata words` call: no key here, and no paid API was called. Its failure paths were run against a local
  stand-in server (S3).
- Sound heard through speakers (headless Chromium has none).
- The deployed site (`check:deployed`, `check:launch`, Lighthouse) and the 3D workflow.
- A real two-process stale-build run: B1 was shown with a stand-in server that sends the probe's exact headers, not with
  `net-server` itself.
