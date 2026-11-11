# Shared polish from FloorFifty: plan audit

**Date:** 2026-11-11. **Stage:** 3 (plan audit) of workstream 1. **Branch:** `claude/shared-polish-plan-audit`, from
`main` at `b1f339c3`.
**Audited:** [`../plans/2026-11-11-shared-polish.md`](../plans/2026-11-11-shared-polish.md) (1,292 lines at `b1f339c3`)
against [`../specs/2026-11-11-shared-polish-design.md`](../specs/2026-11-11-shared-polish-design.md), `AGENTS.md`, the
code on `main` and FloorFifty at `677d456` (attached read-only, cloned to `/home/user/floorfifty`, read for behaviour
only). **Tracker:** [`../progress.md`](../progress.md).

## How it was checked

- Every path the plan names was listed and tested for existence (176 backticked paths; every file the plan says to
  modify exists, and every `ff:` path exists at `677d456`). Every export, type, error code, script and test file the
  plan says is there was opened at the line given below.
- The four packages the plan leans on that ship as tarballs were unpacked and read: `vendor/ruken/ruken-manifest`,
  `ruken-sdk` and `ruken-sdk-host`.
- The font: `github.com` is refused by this session's network policy (HTTP 403 at the proxy), so the upstream release
  could not be fetched. Fontsource republishes the same font on npm, which is reachable:
  `@fontsource/fusion-pixel-12px-proportional-{jp,kr,sc}@5.3.0` (font version v2024.05.12, licence `OFL-1.1`). Each
  package's one `woff2` is the whole font (about 600 KB). Their `cmap`s were read with fontTools 4.68.0.
- No product code was changed and no test was run: `node_modules` is not installed in this container, and this stage
  writes documents only.

## Findings

Ranked: **blocking** (the plan as written cannot be executed, or misses a spec line or an Owner decision), **should
fix** (the executor would hit it and have to make an unrecorded call), **tidy** (a wrong detail that costs time). Each
was fixed in the plan in this branch unless it says *open*.

### Blocking

**B1. Core's error, loading and rotate words stay English.** Spec goal 1 lists "errors" among the menus that ship in
six languages. The plan translates `ScreensCopy` only. Core's other English words are elsewhere:
`BOOT_FAILURE_COPY_EN` (`packages/automata/src/shared/ui/status/boot-failure.ts:80`, used at
`app/flow/flow.manager.ts:157-204` and `shared/ui/status/BootFailurePanel.svelte:38`), `'Loading…'`
(`app/boot/boot-program.ts:173`, `flow.manager.ts:185`), `CONTEXT_LOST_COPY_EN` (`boot-program.ts:74`) and
`DISPLAY_COPY_EN` (`features/display/display-policy.svelte.ts:51`, "English … until they are localized").
*Fix:* task 2 widens core's catalog to these (`runtime_*` and `display_*` keys) and resolves them in the negotiated
locale; a failure before the locale service exists uses `negotiateLocale` over the browser's languages. **Fixed.**

**B2. Web, itch and the desktop never grant `links`, so `openLink` could never open anything there.** The web
adapter's grants are fixed (`features/targets/web/hosting-web.ts:252-253`: lifecycle, input, display, audio, and saves
when storage works); the fakes copy them (`testing/host/target-grants.ts`, `defaultGrants`). The plan refuses an
ungranted call and draws a credits link as plain text without the grant, so on three of the four targets every link is
dead, against the Owner's decision (an open-link call on all four targets). *Fix:* task 11b grants `links` on the web,
itch and desktop adapters and in `defaultGrants`, and the contract suite's factory takes the grants so the ungranted case
can run. **Fixed.**

**B3. The `ui-screens` and `net-ui` layout breaks three of the packages' own rules.** The plan puts the words in
`features/words/` and has `features/splash`, `features/credits` and `features/stale` import them, which
`pnpm boundaries --features` refuses (a feature imports only itself and `shared/`). `ui-screens`' copy-in test
(`extensions/ui-screens/tests/unit/screens/screens-copy.test.ts:10`) lets a screen folder import only
`@automata/framework`, `svelte` and `./X.svelte`, so `splash-step.ts`, `splash-copy.ts`, `credits.schema.ts` (Zod) and
`credits.content.ts` (`@automata/content/schema`) inside screen folders fail it, and the scan reads every file of every
folder under `features/`, words included (`src/testing/copy-screens.ts:12-22`). `entries.test.ts` pins "one path per
screen and nothing else". `ui-screens` has no `zod` dependency and has `@automata/content` only as a dev dependency
(`package.json:79-100`). *Fix:* each screen folder holds only its Svelte files, which take their words as props; the
words go to `src/shared/words/`, the schema and content kind to `src/shared/credits/`, the steps and default-word wiring
to `src/app/`; `package.json` gains `zod` and an `@automata/content` peer; the entries test is widened by name.
`net-ui` has no copy-in rule, so its step stays in `features/stale/` and only its words move to `shared/words/`.
**Fixed.**

**B4. Emberwick's six-language journey cannot pass as written.** Emberwick's journeys run inside Ruken's fake host
(`games/emberwick/tests/e2e/ruken/host.ts`), whose session locale is fixed at `en-US`
(`@ruken/sdk-host/testing`, `dist/testing.js:741`). A Ruken session's locale outranks the browser's
(`features/locale/negotiate-locale.ts:38-43`) and a Ruken host skips the first-run screen (call 4), so a project with
`use: { locale: 'ja' }` shows English and never meets the language screen. *Fix:* the language journeys open the game's
own origin with no host (the Ruken adapter's standalone session, kind `standalone`), where the browser's language and the
first-run screen apply. **Fixed.**

**B5. A game's languages are its content languages, and neither reference game has any but English.** The font build
refuses a `fonts.toml` language that is not a content language (`packages/content/src/shared/assets/build-fonts.ts:150-170`);
content languages are the source language plus one per `content/messages/<lang>.json` (`shared/compile/compile-content.ts:287`,
`shared/game/game-facts.ts:81`); Paraglide compiles only those (`shared/locale/compile-messages.ts:5-6`). Emberwick and
Ember Hall have no `content/messages/`. Task 16 never creates them and task 17 does so only "if its content has
localized text", so Emberwick's `fonts.toml` would fail the build and Ember Hall's Paraglide would not compile `ja`.
*Fix:* tasks 16 and 17 write `content/messages/<lang>.json` for the five languages (an empty catalog when the content has
no text), which is how a game declares a language today. **Fixed.**

**B6. Nothing loads the cut fonts, and core's screens draw in the device's fonts.** No code writes an `@font-face` from
the font build's output (none in `packages/content/src` or `packages/automata/src`); `fonts.json` maps a font and a
language to a file and names no family (`fonts.schema.ts`, `FontFiles`). Core's theme draws every screen in
`--af-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (`shared/ui/theme.css:26`). Task 16's "the family
name the font build's `fonts.json` gives" does not exist, so the Owner's "no device fallback" would not hold for core's
own screens in any game. *Fix:* task 5b's build also writes `fonts.css`, an `@font-face` per font and language and a
`:lang(<tag>)` rule that sets `--af-font` to that language's fonts; core's theme already reads `--af-font`; a game imports
`fonts.css`. The subsets and `fonts.css` are committed outputs of `automata-content assets`, as `fonts.json` is today
(`features/preload/asset-build-files.ts:1-7`). **Fixed.**

**B7. The font's licence reserves its name, and the build subsets it.** Fusion Pixel's licence reads "Copyright (c)
2022, TakWolf …, with Reserved Font Name 'Fusion Pixel'" (the package's `LICENSE`, line 1; name ID 0 says the same).
Under the OFL a subset is a Modified Version and may not carry a Reserved Font Name. The font build cuts with
`subset-font` and keeps the name table (`shared/assets/font-subset.ts:16-20`), so every shipped subset would still be
named `Fusion Pixel 12px Proportional ja` (name ID 1). Ark Pixel, the plan's fallback, reserves its name too.
*Fix:* the build renames a subset whose `fonts.toml` entry declares a reserved name, keeping the copyright notice and
shipping the licence file beside the subsets (call 13, task 5b). Asked of the coordinator with options (A rename in the
build; B ask TakWolf; C another font); the coordinator settled A. **Fixed.**

### Should fix

**S1. Some of core's function words compute their argument, so they cannot be flattened to `{placeholder}` text by
calling them.** `percent: (value) => \`${Math.round(value * 100)}%\`` (`app/screens/settings/settings-copy.ts:66`),
`slot: (slot) => \`Slot ${slot + 1}\`` (`app/screens/saves/saves-copy.ts:11`) and `capturing` lower-cases its device
(`settings-copy.ts:40`). The plan's `FUNCTION_LEAVES` holds only parameter names. *Fix:* each entry also has a `prepare`
that turns the call's arguments into the placeholders' values; the English text of those keys is written, and a test
checks it reads as the English function does. **Fixed.**

**S2. Task 11b names codes and files that do not exist.** There is no `INVALID` or `NOT_GRANTED`
(`shared/host/error-code.schema.ts:7-18`): a bad argument is `INVALID_PAYLOAD`, an ungranted call `UNSUPPORTED` (or
`DENIED`, `testing/host/target-grants.ts`, `ungrantedCode`). `tests/unit/shared/host/contract.test.ts` pins names; the
suite runs in `targets/web/hosting-web.test.ts`, `targets/tauri/hosting-tauri.test.ts`,
`targets/ruken/hosting-ruken.test.ts` and `testing/host/fake-hosting.contract.test.ts`. Ruken's fake host answers Cancel
to a link by default (`@ruken/sdk-host/testing`, `dist/testing.d.ts:253`), so its "opened: true" case needs the
responder set. The SDK also refuses a URL with a user name or password (`@ruken/sdk`, `dist/index.js:105`); the rule
should be the same on every target. The desktop's `Cargo.toml` needs `tauri-plugin-opener` pinned beside the other
plugins (`packages/tools/src/shared/ship/targets/tauri/tauri-project.ts:15-16,61-62`). **Fixed.**

**S3. `'opening'` is not a pause reason, and the host's menu is live during the opening.** `PauseReason` is
`'lifecycle' | 'menu' | 'input' | 'display'` (`shared/runtime/time/time.manager.ts:9`). `hosting.onMenuRequest` is wired
to `flowHandle.flow.openMenu()` before the flow starts (`app/boot/boot-program.ts:386`), so a Ruken menu press during the
opening would reach a flow with no screen. *Fix:* add the reason in task 6's files; a menu request before the first
screen opens nothing, with a test. **Fixed.**

**S4. The achievements step cannot read `ship.config.ts` "as the boards step does".** The boards step scans the
config's text for names (`shared/check/check-source-steps.ts:48-77`); `rukenToml` needs the whole evaluated config,
which only `ship` loads, by importing the file (`app/ship-cli.ts:34`). The `achievements` catalog in `gameCatalogs` has
the same need. *Fix:* both load the config through one injected loader (the import in production, a fake in tests).
**Fixed.**

**S5. `gameCatalogs` is synchronous but looks for files.** It picks "the first of `messages/ui` and `src/messages/ui`
that holds `<src>.json`" yet returns a plain array, while the plan says file reads go through `Files`. *Fix:* it returns
an `Effect` that needs `Files`. **Fixed.**

**S6. The browser commands start three engines.** `test:browser` runs Chromium, WebKit and Firefox, and only Chromium
is installed here; the repository's own record says to pass `--browser.name=chromium`
(`docs/refactor/2026-11-08-feel-audio-writer-sequence-build-audit.md:33`). *Fix:* every in-container browser command in
the plan says so. **Fixed.**

**S7. The template's fonts cannot ship the way task 10 says.** `@automata/tools` publishes `dist` and `VENDORED.md`
only (`packages/tools/package.json:12-15`), so `vendor/fonts/` cannot be listed in `files`; its build already copies
outside files in (`scripts/copy-editor.ts`). The template draws in `sans-serif` (`shared/create-game/template-project.ts:197`),
not Pixelify Sans as call 13 says. The 3D template (`template-3d-*.ts`) is not mentioned. *Fix:* the build copies the
fonts into `dist`; call 13 corrected; the 3D template stays one-language and is named as out. **Fixed.**

**S8. The consumer smoke test would meet the language screen.** `tooling/consumer-smoke/tests/e2e/stranger.test.ts:137-140`
creates a game from the template, opens it standalone and expects `title-screen`; the six-language template shows the
language screen first, and the test installs only published packages, so it cannot import `@automata/tools/e2e`.
*Fix:* task 10 updates that journey with an inline press. **Fixed.**

**S9. The site's Examples page cannot run an example that imports `@automata/ui-screens`.** The playground's import map
holds `@automata/framework` and `zod` only (`site/playground/src/frame-page.ts:35`), and no 2D example imports an
extension today. The spec says the examples "appear there with no site code". The playground runtime also has a gzip
budget of 460,000 bytes (`site/playground/src/runtime-size.ts:4`) that six catalogs in core will grow. Asked of the coordinator, who amended the spec (`87b48662`) to allow exactly
that site change. *Fix:* task 15 adds `@automata/ui-screens` to the playground's runtime and import map with its site
test; task 2 and task 15 measure the budget. **Fixed.**

**S10. The examples' build compiles no content, and their host is Ruken's.** The runner has no content plugin
(`tooling/examples-runner/src/vite-plugin.ts`); the one asset build (`examples/2d/content/atlases.toml`) is kept fresh by
a test. The examples run under Ruken's fake host (`tooling/examples-runner/host/ruken/host.ts`), kind `ruken`, locale
`en-US`, which cancels a link by default. *Fix:* the examples' subsets are committed in `examples/2d/public/fonts/` and
kept fresh by a test, as the atlas is; `core-first-run`'s journey opens its page directly (standalone); the credits
journey expects the host's request and the refusal line. **Fixed.**

**S11. The font build still lets a language fall back to the device.** "A language no font serves is not checked: it
draws in whatever face the game's CSS names" (`build-fonts.ts:10` and `17-18`). *Fix:* task 5b makes it a failure when
`fonts.toml` exists; no game has one today, so nothing breaks. **Fixed.**

**S12. Core's own symbols are not in the font.** Fusion Pixel has no ✓ (U+2713), ✕ (U+2715) or ⟳ (U+27F3); core draws
✕ in `shared/ui/dialog/Modal.svelte:74`, ✓ and ✕ in `shared/ui/status/Chip.svelte:21` and `Toast.svelte:29`, ✕ in the
PlayStation prompt list (`shared/ui/prompts/prompt-label.ts:85`), and ⟳ in `shared/ui/display/RotateHint.svelte:40`
and `RotateToast.svelte:21`. The words check
never sees them. *Fix:* core draws those three as inline SVG (they are icons, not words), and the font-set test covers
every other non-ASCII character core's Svelte files hold (· × ← ↑ → ↓ □ △ ○, all present). **Fixed.**

**S13. The spec reaches Credits "from the title or Settings"; the plan reaches it from the title only.** Core's Settings
screen cannot import `ui-screens`. Asked of the coordinator, who amended the spec (`87b48662`): Credits is reached from the
title or wherever the game places it, and core's Settings gains no dependency on `ui-screens`. *Fix:* call 19 says so.
**Fixed.**

**S14. Task 14's file list misses `net-ui`'s words.** The words folder and its `./words/*.json` export are in the prose,
not the files. A game's own facts are `{ protocol: PROTOCOL_VERSION, ...version }` (the join already sends them,
`extensions/net/src/features/client/room/net-room.ts:300-302`). **Fixed.**

**S15. "Missing" breaks a content build.** The content compiler refuses a translation that lacks a source key
(`shared/locale/messages.ts:90`), so a missing key in `content/messages/<lang>.json` fails the build, while a missing key
in a `ui` catalog falls back to English. And `words status` for a game that ships only English would list five languages
as missing. *Fix:* task 4 says what an untranslated word costs per catalog kind. The `status` and `import` parts were
then cut by the spec's amendment (M1). **Fixed.**

**S16. Fusion Pixel's flavour names and download are not as the plan says.** Fontsource's packages are `jp`, `kr`,
`sc` (and `tc`); each covers the same full Latin, so a separate `latin` flavour is not needed and its upstream name is
unproven. The download must come from npm here. *Fix:* call 13 and task 5b name the three npm packages, version and
size. **Fixed.**

### Tidy

- **T1.** The Latin-only fixture font is `packages/content/src/shared/assets/fixtures/fonts/pixelify-sans-latin-400-normal.woff2`,
  not under `tests/fixtures`. **Fixed.**
- **T2.** `fontCoverage` is already exported from `@automata/content/assets` and `catalogCharacters` from
  `@automata/content/locale` (`packages/content/src/entries/assets.ts`, `shared/locale/index.ts:7`). **Fixed.**
- **T3.** `--only words` follows from `STEP_NAMES` in `check-report.ts`; `check-args.ts` needs no change (`check-args.ts:33`).
  **Fixed.**
- **T4.** `ScreenContext` is exported from `packages/automata/src/entries/runtime.ts:19`. **Fixed.**
- **T5.** Import JSON as the repository does: `import ja from './ja.json' with { type: 'json' }`
  (`packages/3d/src/shared/time-of-day/time-of-day.ts:4`). **Fixed.**
- **T6.** `negotiate-locale.test.ts` exists; the engines test that pins `endonymOf`
  (`packages/content/tests/browser/locale/endonyms.test.ts`) lists `es`, not `es-419`. **Fixed.**
- **T7.** `ACHIEVEMENT_ID_INVALID` also refuses an id that starts `ruken-` (`@ruken/manifest`, `dist/index.js:737-738`).
  **Fixed.**
- **T8.** FloorFifty's splash waits for the player behind a load bar (`SplashRoot.svelte:1-10`), with no hold; its
  version check never holds the title and reports a late answer (`boot-version-check.ts`). The plan's hold and its
  1500 ms cut are the spec's and the coordinator's; the plan now says they differ on purpose. **Fixed.**
- **T9.** The reference never ticks the same control twice in a row (`ui-sounds.ts`, `tick`). **Fixed.**
- **T10.** Changesets: tasks 7, 8, 9 and 12 say nothing, the others restate the global rule. **Fixed** by the trim.
- **T11.** The spec asks for keyboard, pad and touch on the language screen; the plan tests no pad. **Fixed.**
- **T12.** Feel's `intensity` is `0 | 0.5 | 1` (`extensions/feel/src/features/frame/feel.ts:28`), so a game's switch
  maps on and off to two of them. Emberwick's headings are `font-weight: 700` (`games/emberwick/style.css:114`) over a
  one-weight pixel font, which a browser would fake; the panels' `aria-label="Splash"` is missing from `EmberwickWords`.
  **Fixed.**
- **T13.** The journey commands put `--` before `--trace off` after a `pnpm` script; pnpm passes flags on, and only npm
  needs the `--` (the session's own instructions). **Fixed.**

### The spec moved under the plan

The Owner amended the spec while this audit ran (`b119393b`, `df992aaa`, `87b48662`, `134d7fd1`, merged into this
branch from `main`). Each change left the plan out of date.

**M1 (blocking). The translator's workflow is cut.** The amended section 1 and goal 2 drop `automata words export`,
`import`, `status` and `check`, the CSV and the review: "cut the translation workflow, AI is capable". The plan's call 7
and tasks 3 and 4 were that workflow. *Fix:* task 3 keeps the catalogs, placeholders and a source record and drops the
CSV; task 5 becomes the `words` step of `automata check` alone (a missing word, a lost placeholder, a font that cannot
draw a letter, the amended "Done means"); every later task that brought words in by `import` now writes them and runs
`automata words --mark`. **Fixed.**

**M2 (blocking). `automata words` is an AI translator.** `df992aaa`: it translates every missing or stale word into every
shipped language, `--to <lang>`, `<key>` and `--all`, through one model port with a fake in tests, the key from
`ANTHROPIC_API_KEY` on the developer's machine only, the placeholder check before every write with one retry. *Fix:* task
4 is rewritten to that, with its port, prompt, write, report and model setting (`words.model` in `ship.config.ts`), tests
first, and the `claude-api` skill loaded before the model call. Stale detection needs a record of the source each
translation came from, which the first amendment's "no source stamps" seemed to forbid; asked of the coordinator, who
withdrew that line: the record stays, written only by the tool, `--mark` for translations written without a model
(call 7). This container has no key, so the framework's own words are written by the executing session and marked, and
the live call stays unverified until someone runs it with a key (call 8). **Fixed.**

**M3 (blocking). Achievements are generic.** `b119393b`: a host-neutral declaration beside the leaderboards (id, title,
description, one goal: reach a value or a top share), the framework's own Zod schema, mapped by each target; Ruken
refuses at ship a goal it cannot express. The plan's task 13 was Ruken's manifest shape with `top_rank`. *Fix:* task 13
declares `goal: { reach } | { top_percent }` in the game config with no host limits, maps it in `rukenToml`, refuses at
`ship prepare --target ruken` a top share outside `@ruken/manifest`'s `ACHIEVEMENT_TOP_PERCENTS` (read, never retyped),
and leaves web, itch and tauri unchanged; the `achievements` step of `automata check` holds the framework's schema only.
Emberwick's achievement uses the generic form. **Fixed.**

**M4 (blocking). The site's Editor page is cut.** `134d7fd1`: the header's Editor link opens `/editor/app/`, `/editor`
redirects there, and the page, its words, pictures and checks go. *Fix:* task 19, tests first. **Fixed.**

**M5 (should fix). The site has no redirects feature.** The amended spec says `/editor` redirects "through the site's
redirects feature". There is none: the build writes `_headers` only (`site/scripts/write-headers.ts`), and the site
checks refuse a page that only redirects (`site/scripts/site-checks.ts:56-58`, "cut pages get the 404 page"). *Fix:*
task 19 writes a host rule, `_redirects` for Cloudflare Pages (the host, `.github/workflows/site.yml:78`), so the rule
against redirect pages stands. Reported to the coordinator as a wording to correct in the spec. **Fixed in the plan.**

## The four things "not verified while planning"

| Item | Result |
|---|---|
| The font's licence and coverage | OFL-1.1 with a Reserved Font Name (B7). Coverage of v2024.05.12, each flavour: 31,345 code points; ASCII and every es/pt letter and mark checked (145 of 146; ✕ missing); the six endonyms; kana; all 11,172 Hangul syllables; GB2312 level 1 (3,755); JIS X 0208 level 1 (2,965). Not proven: the translations, which are not written yet (task 5b's test proves them); the upstream GitHub release and its flavour names. |
| The package build copies JSON into `dist` | By precedent, not run: `svelte-package` turns `src/` into `dist/` file for file and the published `./theme.css` export points at `dist/shared/ui/theme.css`. Task 2's step 6 still checks it. |
| The examples' fake host kind, and whether their build compiles `fonts.toml` | Ruken kind, `en-US`, links cancelled by default; no content compile (S10). |
| The form of a cue in the template's `audio.toml` | `[[cue]]` with `id`, `about`, `bus`, `voices = [{ tone, from, to, length, volume }]` (`template-content/audio/audio.toml`; `extensions/audio-synth/src/shared/audio.schema.ts:156-188`); `bus = "ui"` is allowed. |
| A Latin-only font among content's fixtures | Yes, at the path in T1. |
| The error codes for a bad argument and a missing grant | `INVALID_PAYLOAD`; `UNSUPPORTED` (or `DENIED`) (S2). |

## FloorFifty behaviours checked

The `ui-sounds` timings (400 ms after a press, 250 ms after a scroll, 90 ms between ticks, half gain, mouse-only hover,
`open` and `close` quieting focus) match the plan's restatement. `detect.ts` matches on the primary subtag, which the
framework's `matchLocale` already does. The splash and the version check differ on purpose (T8). Nothing was copied.

## Trimming

The plan was 1,292 lines. Cut in this branch without losing what an executor needs: the 24-line file map (each task
lists its files), the self-review's coverage, amendments and "names used across tasks" paragraphs (the tracking table
and each task's Interfaces carry them; this audit carries the coverage check), the twelve bare "run; confirm they fail"
steps and the per-task changeset clauses (the global constraints now say each once), and the "not verified" list
(answered above), and the CSV, export, import and status parts the spec cut (M1). The fixes and the spec's new work
(M2, M4) added more than that removed: the plan is now 1,529 lines. Further cuts that would cost an
executor nothing: the test blocks whose bodies are `…` could become one line per task naming the cases; the "Review
focus" list repeats cases already in tasks 3, 4, 6, 8 and 9.

## Counts

Against the plan as written: 7 blocking (B1-B7), 16 should fix (S1-S16), 13 tidy (T1-T13). From the spec's amendments:
4 blocking (M1-M4), 1 should fix (M5). In all 41 findings: 11 blocking, 17 should fix, 13 tidy. All are fixed in the
plan. B7, S9, S13 and call 7 were settled by the coordinator during the audit; M5 asks for a wording change in the spec.
The plan matches the spec at `main` `0332302c`.
