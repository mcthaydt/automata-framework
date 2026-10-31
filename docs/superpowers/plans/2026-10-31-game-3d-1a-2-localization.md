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

- [ ] 1. Red: `strings.test.ts` (node): every key the screens use exists in `en.json` (a list kept beside `t.ts`,
      checked both ways: no unused key, no missing key). Fails on the missing catalog.
- [ ] 2. Catalog and compile: `en.json`, the `paraglide` option, `.gitignore` for `src/paraglide/`; the compile runs
      in `pnpm build` and in Vitest's content plugin. Step 1 passes.
- [ ] 3. Red: a DOM case per screen in screens.dom.test.ts that the words follow the locale (a test locale record
      through `Locale`, as DX.2d's cases do): fails while the words are inline.
- [ ] 4. The screens and `main.ts`'s labels read `t()`. Step 3 passes; the existing DOM cases still find their
      buttons by the English words.
- [ ] 5. Red: `strings.layout.test.ts` in `xx-long` (raw English found while any word is inline), then green;
      `checkLayout` at 844×390 and 780×270 in Chromium, WebKit and Firefox, every primary action an essential.
- [ ] 6. With the 1e stack on `main`: `copy.ts` from `t()`, its record removed; the HUD, Items and Map join the
      `xx-long` run (their layout tests already cover 844×390 and 780×270).
- [ ] 7. Review images: each screen in English and `xx-long` at both sizes (the DX.2d evidence pattern), with the
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

(Empty until the branch is rebased onto `main` after #297 and #300.)
