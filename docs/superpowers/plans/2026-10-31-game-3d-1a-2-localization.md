# GAME-3D.1a part 2: every string through `t()`, and the `xx-long` layout run (G3-t) (plan)

> **Task:** GAME-3D.1a part 2 in [02 Master delivery plan](../../02-master-delivery-plan.md) (the 1a row: "part 2
> (G3-t localization) waits on DX.2d"; DX.2d merged as #312, `c713eaf`).
> **Design:** [`games/base-3d/DESIGN.md`](../../../games/base-3d/DESIGN.md) §12 ("Every string goes through core
> `t()`"), §13 (the screens), G3-t ("Every string shown in the golden run's screens comes from `t()`. With `xx-long`,
> every screen passes `checkLayout` at 844×390 and 780×270 with no clipped primary action"), the strings row of §3
> (`content/messages/*.json`, PRODUCT.L).
> **Lane:** 3D. **Branch:** `claude/3d-game-3d-1a-2` from `main` once #297 (1a part 1) and #300 (1a part 3) have
> merged; worktree `/home/user/wt/game-3d-1a-2`. This plan was written first on `main` at `547ce175`, before they
> merged, and is rebased onto `main` when they do (nothing else is committed before then). One push.
> **Spec and plan acceptance:** the Owner, 2026-10-30: "Auto accept all spec and plans"; 2026-10-31: "everything is
> auto approved and accepted, do not wait on me to do any approvals".

## What already exists (verified at `547ce175`, not rebuilt)

- **PRODUCT.L1 (runtime):** the `Locale` service (`current`, `subscribe`, negotiation over the host's
  `session.locale`), `LocaleDef` (a Paraglide `runtime.js` satisfies it), `bindParaglide` (Paraglide's
  `getLocale`/`setLocale` answer from `Locale`, never its own strategies), and `createT(messages)`
  (packages/runtime/src/locale/paraglide.ts): `t('key', inputs?)`, typed by the compiled module, throwing on an
  unknown key.
- **PRODUCT.L2 (content):** the content plugin's `paraglide: { outdir, catalogs }` option compiles the game's
  catalogs (`messages/ui/{locale}.json` patterns) with Paraglide on build into `outdir` (`runtime.js`,
  `messages.js`), and checks each translation has exactly the source keys.
- **PRODUCT.L3a (ui):** the `xx-long` pseudo-locale (`PSEUDO_LOCALE`, `pseudoLocalize`, `hasRawText` from the
  browser-safe `@mcthaydt/automata-content/locale`), and ui's `checkLayout(conditions, essentials)`
  (packages/ui/src/testing/layout-contract.ts: no document scroll, no small targets, no offscreen controls, no
  intrusions).
- **DX.2d (#312):** `GameSpec.copy.screens` (a part of `ScreensCopy`, or a function of the locale) for the default
  screens' words (title, play, paused, Settings, saves, board), read live; packages/game/src/screens/
  screens.layout.test.ts is the pattern for an `xx-long` layout run (renders in `xx-long`, finds raw English with
  `hasRawText`, then `checkLayout`).
- **base-3d today:** `ship.config.ts` declares `languages: ['en']`; no game uses `createT` or the `paraglide`
  option yet (base-3d is the first). Its own words are inline English in its screens (on `main` after #297/#300:
  the splash, the end, the game over, the Lock mode section, the key and touch labels in `main.ts`, the title "The
  Cold Kiln"). The 1e stack (#339, #340, #342) adds `screens/copy.ts`, a hand-made per-language record for the HUD,
  Items and Map: the stand-in this part replaces with the catalog.

## Scope

1. **The catalog.** `games/base-3d/src/content/messages/ui/en.json` (inlang message format): every word a base-3d
   screen shows that is not a default screen's (the splash's mark and hint, the end's title and Menu, the game
   over's title, Continue and Quit, the Lock mode section's heading, Toggle and Hold and their hints, the key and
   touch labels, the game's title); and `copy.screens`' words where base-3d overrides a default (none today; the
   key exists for the menu's own title).
2. **The compile.** `vite.config.ts`'s content plugin gets `paraglide: { outdir: 'src/paraglide', catalogs:
   ['src/content/messages/ui/{locale}.json'] }`; `src/paraglide/` is generated (git-ignored, written on build and on
   the test run's content compile).
3. **The binding.** `main.ts` passes `locale: paraglideRuntime` (`import * as paraglideRuntime from
   './paraglide/runtime.js'`) to `defineGame`, so `Locale` drives Paraglide; `screens/t.ts` exports `t =
   createT(messages)`, the one place the game reads its words.
4. **Every screen through `t()`.** The splash, end, game over and Lock mode section read `t(...)` in their markup
   (Svelte re-renders on a locale change: `Locale.subscribe` bumps a `$state` the components read, the same live
   pattern as DX.2d); `main.ts`'s labels take `t(...)`. The title stays one key.
5. **The 1e words.** When the 1e stack is on `main`, `screens/copy.ts`'s English record is generated from the
   catalog: `base3dCopy(locale)` returns `{ hud: { hearts: (h, m) => t('hud.hearts', { health: h / 2, max: m / 2
   }), … } }`, so the HUD, Items and Map keep their interface and their tests; `BASE3D_COPY` and the hand-written
   record go. Whichever of this part and the 1e stack lands second carries this step.
6. **G3-t's checks.** A layout run in the three engines (`screens/strings.layout.test.ts`) that mounts each
   base-3d screen (splash, end, game over, Lock mode section; with 1e: HUD, Items, Map) in `xx-long` at 844×390 and
   780×270, asserts no raw English text or `aria-label` (`hasRawText`), and `checkLayout` with the primary action
   as an essential. A node case reads the golden route's screens' strings and checks each key exists in every
   catalog.

## Interfaces

- Consumed: `createT`, `LocaleDef`, `Locale` (`@mcthaydt/automata-runtime`); the content plugin's `paraglide`
  option (`@mcthaydt/automata-content/vite`); `PSEUDO_LOCALE`, `pseudoLocalize`, `hasRawText`
  (`@mcthaydt/automata-content/locale`); `checkLayout` (`@mcthaydt/automata-ui/testing`); `GameSpec.locale`
  (`@mcthaydt/automata-game`).
- Produced: `games/base-3d/src/content/messages/ui/en.json`; `screens/t.ts` (`t`, and `liveLocale`, a `$state`
  holder Svelte reads so the words re-render); with 1e, `copy.ts` built from `t`.
- No framework change. If the content plugin cannot compile `xx-long` for a test build without listing it as a
  shipped language, that is a request to the content lane (and this part tests with `pseudoLocalize` over the
  English catalog in the meantime), not a copy of its compiler.

## Steps (red first)

- [x] 1. Red: `strings.test.ts` (node): every key the screens use exists in `en.json` (a list kept beside `t.ts`,
      checked both ways: no unused key, no missing key). Fails on the missing catalog.
- [x] 2. Catalog and compile: `en.json`, the `paraglide` option, `.gitignore` for `src/paraglide/`; the compile runs
      in `pnpm build` and in Vitest's content plugin. Step 1 passes.
- [x] 3. Red: a DOM case per screen in screens.dom.test.ts that the words follow the locale (a test locale record
      through `Locale`, as DX.2d's cases do): fails while the words are inline.
- [x] 4. The screens and `main.ts`'s labels read `t()`. Step 3 passes; the existing DOM cases still find their
      buttons by the English words.
- [x] 5. Red: `strings.layout.test.ts` in `xx-long` (raw English found while any word is inline), then green;
      `checkLayout` at 844×390 and 780×270 in Chromium, WebKit and Firefox, every primary action an essential.
- [x] 6. With the 1e stack on `main`: `copy.ts` from `t()`, its record removed; the HUD, Items and Map join the
      `xx-long` run (their layout tests already cover 844×390 and 780×270).
- [x] 7. Review images: each screen in English and `xx-long` at both sizes (the DX.2d evidence pattern), with the
      differences explained; goldens unchanged (no sim change); gates as in the lane rules (check, parity,
      build, the base-3d e2e project; no changeset, base-3d is private).

## Failure and recovery

- A key missing from a translation fails the content compile (PRODUCT.L2's check), not the game at run time.
- `t()` throws on an unknown key (`createT`): step 1's both-ways check keeps that from reaching a player.
- A host locale the game lacks negotiates to English (`Locale`), and the words stay English: no blank text.

## Defaults (for the Owner's veto)

1. One catalog file for base-3d's UI words (`messages/ui/en.json`); dialogue and item descriptions get their own
   catalogs in 1k (gap 5), not here.
2. The words follow the locale live, as DX.2d's screens do (no remount, focus kept).
3. English only ships (`languages: ['en']`); `xx-long` is a test-build locale, never shipped.
4. Step 6 (the 1e words) goes with whichever lands second; until then `copy.ts` stays the HUD's source.

## Execution log

**2026-10-31 (session_01QYLU1gPdfpqyJgh9oNhJpE).** The coordinator folded #300 to #340 into #342 ("GAME-3D.1a–1e")
and #297 merged; this part now lands in the 3D milestone PR with the trimmed-slice amendment and GAME-3D.1f, on
`claude/3d-game-3d-1f` (this plan cherry-picked onto it after #342's branch, `bca86d7`, was merged in).

- **Blocked: steps 1, 2 and 6 (the catalog through Paraglide and `t()`).** The content plugin's `paraglide` option
  fails in a game build: base-3d's `vite build --configLoader runner` (the default loader cannot load the workspace's
  TypeScript sources: `ERR_MODULE_NOT_FOUND` on `packages/content/src/vite/automata-content`) ends with "could not write
  …/src/paraglide: Error: Vite module runner has been closed", from `await import(PARAGLIDE)` in
  packages/content/src/locale/compile-messages.ts. Reproduced with a two-key `src/messages/ui/en.json` and `paraglide:
  { outdir: 'paraglide', catalogs: ['messages/ui/{locale}.json'] }`, then reverted. Reported to the coordinator as a
  content-lane request (the plan's rule: not a copy of its compiler).
- **Done meanwhile, so the catalog has one seam to feed:** every word base-3d's own screens show is in `copy.ts` (the
  splash's mark and hint, the end's title and Menu, the game over's title, Continue and Quit, the Lock mode section's
  heading, label, Toggle and Hold, the key labels and the title), with the HUD's, Items' and Map's words already there
  (1e). The screens read the live copy; `main.ts` reads the key labels and the title once at boot (the input map is
  data). When Paraglide compiles, `base3dCopy` builds that record from `t()` (step 6) and the both-ways key check
  (step 1) runs over it.
- Step 3 red: screens/strings.dom.test.ts, 4 cases (a marked copy; any word outside the marks fails), failing on the
  inline words (`AutomataFramework`, `Press any key or tap`, …), then green.
- Step 5: screens/strings.layout.test.ts, the splash, end, game over, Lock mode, Items and Map in `xx-long` (the
  copy pseudo-localized with `pseudoLocalize`) at 844×390 and 780×270, the `rest` variant, `untranslated` and
  `checkLayout` with each screen's actions as essentials: 36 passed in Chromium, WebKit and Firefox. Shown to fail with
  the game over's change reverted ("Continue", "Quit", "The flame went out" not in `xx-long`). The HUD is not in it
  yet: its layout test mounts it over a play fixture; it joins with step 6.
- Step 7 (images): with step 6, once the words come from the catalog.
- Goldens unchanged (no sim change).

**2026-10-31, later: the blocker fixed, steps 1, 2 and 6 done (session_01QYLU1gPdfpqyJgh9oNhJpE).** The coordinator:
"make the content fix yourself, inside this milestone PR, as its own commit".

- **Deviation, found by base-3d, first user of PRODUCT.L2's paraglide option** (commit bd91af2c,
  `fix(content)`, a patch changeset for `@mcthaydt/automata-content`). Red first in packages/content: a case loads
  write-outputs.ts through Vite's `runnerImport` (the runner closes after the import, as `--configLoader runner` does)
  and then compiles with `paraglide`; it failed with "ContentWriteFailed: Error: Vite module runner has been closed".
  The fix loads Paraglide with `createRequire(import.meta.url)(PARAGLIDE)`: Node's own `require`, which loads ES
  modules in Node 24. Importing the resolved file URL with `import()`, as first suggested, would not do: the runner
  rewrites every `import()` in the modules it loads, whatever the specifier. The case passes, and so do the other four.
- Step 1 red: screens/strings.test.ts (no `copyFrom`), then green: the copy reads exactly the catalog's 46 keys.
- Step 2: src/messages/ui/en.json (inlang message format, snake_case keys); vite.config.ts's content plugin
  `paraglide: { outdir: 'paraglide', catalogs: ['messages/ui/{locale}.json'] }` (root `src`). **Deviation:**
  src/paraglide is committed, as src/content/generated is, not git-ignored: `tsc` reads its JSDoc types (tsconfig
  `allowJs`, `checkJs: false`), and the typecheck runs without a content compile. Biome (base-3d's biome.json) and knip
  ignore it; every build and test run rewrites it.
- Step 6: `copyFrom(say)` builds the copy from the catalog by key; `BASE3D_COPY.en = copyFrom(t)`, `t =
  createT(messages)` (screens/t.ts); `main.ts` passes `locale: paraglideRuntime` to `defineGame`, so `Locale` answers
  Paraglide's `getLocale`. The HUD joined the `xx-long` run (its own words only: the play screen around it is the
  default screens', DX.2d's): 42 passed in the three engines.
- Step 7 (images): the outgoing coordinator asked for them, so they were taken after all.
  docs/evidence/owner-visual/2026-10-31-game-3d-1a-2-strings/ holds 28 images (7 screens, English and `xx-long`, 844×390
  and 780×270, Chromium), from a throwaway copy of the layout run that called `page.screenshot`; its README sets them
  against §12.3 and §13.
- Gates: `TURBO_FORCE=true pnpm check` 35/35; base-3d unit 356; base-3d `test:parity` 33 files, 615 tests (the goldens
  unchanged); base-3d `pnpm build` passes.
