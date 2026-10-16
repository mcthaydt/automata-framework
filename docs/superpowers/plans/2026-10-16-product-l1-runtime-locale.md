# PRODUCT.L1: runtime locale (negotiation, `t()`, `Intl`, `<html lang dir>`) TDD plan

- **Spec:** [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §4 items 1 to 4 (the runtime part of "Messages", "Negotiation", "Formatting", "Document"), acceptance cases L-b and L-c (runtime level); §9 ownership: `runtime` owns negotiation and `t()`.
- **Status:** drafted 2026-10-16. PRODUCT.0 is Owner-approved with every recommended default (2026-10-16), so this plan may run.
- **Progress:** 5 of 7 steps.
- **Split (PRODUCT.L is three PRs).** This plan is **PRODUCT.L1**, the runtime part. **PRODUCT.L2** (content: Paraglide compile of the content catalogs, per-locale TOML text, glyph sets, L-d, L-e once M5's asset build exists) and **PRODUCT.L3** (ui: language picker, `xx-long` pseudo-locale in every layout contract, logical properties and the right-to-left contract, the L-a example and the e2e first-frame check) are recorded as rows in 02. The `automata check` additions (§4 item 8) wait for DX.6 (PR #42) and are a follow-up row.

## Source

Extracted from FloorFifty `apps/client/src/i18n/` at `ac72660` (`SNEKPRTY/FloorFifty`):

| AF file | FloorFifty source | Changed |
|---|---|---|
| `locale/negotiate-locale.ts` | `detect.ts`, `strategy.ts` (`browserLanguages`, `detectLocale`) | Generic over the game's locales (exact tag, then primary subtag), and the spec's order: Ruken `session.locale` (hosted only), saved choice, browser languages, default |
| `locale/format.ts` | `format.ts` | Takes the locale; adds durations, ordinals and plural selection through `Intl` |
| `locale/document-locale.ts` | `document.svelte.ts` | Sets `dir` too; no Svelte effect, the `Locale` service calls it on each change |
| `locale/paraglide.ts` | `strategy.ts` (`defineCustomClientStrategy`) | `overwriteGetLocale` points Paraglide at the `Locale` service; `createT` is the typed `t()` verb |
| `locale/locale.manager.ts` | `strategy.ts` (`applyLocale`, the settings store) | An Effect service; the choice is saved through `Hosting.saves` (never device storage); a change is a presentation-bus fact |

FloorFifty's tests for these files are UI-level (Svelte stores); the AF tests below are new and cover the same behavior.

## Global constraints

- **Strict TDD** in `packages/runtime`: write the failing test, run it, confirm the failure reason, make the minimal change, confirm it passes.
- **Host authority.** The hosted locale is read from `Hosting.locale` (the SDK's `session.locale`), never by duplicating the SDK. The saved choice goes through `Hosting.saves`; a refused write is logged, never moved to device storage.
- **The sim is untouched.** Nothing under `locale/` imports `@mcthaydt/automata-sim`; a locale change publishes a presentation fact and never remounts a screen.
- **New dependencies** (devDependencies of `packages/runtime`, test fixtures only; the runtime code depends on Paraglide's generated runtime structurally): `@inlang/paraglide-js` 2.25.4 (released 2026-09-17) and `@inlang/plugin-message-format` 4.4.4 (released 2026-08-31), both FloorFifty's versions and both older than 14 days. Recorded in `docs/versions.md`.
- **Gates:** `pnpm format`, `pnpm check`, `pnpm test:parity`, `pnpm test:e2e` (runtime changes). No changeset: `@mcthaydt/automata-runtime` is private.

## Files

- **Create** (all in `packages/runtime/src/locale/`): `negotiate-locale.ts`, `negotiate-locale.test.ts`, `format.ts`, `format.test.ts`, `document-locale.ts`, `document-locale.test.ts`, `paraglide.ts`, `paraglide.test.ts`, `locale.manager.ts`, `locale.test.ts`, `testing/fixture.inlang/settings.json`, `testing/messages/en.json`, `testing/messages/fr.json`, `testing/compile-fixture.ts`.
- **Modify:** `packages/runtime/src/boot/game-definition.ts` (`locale?: LocaleDef`, `seams.languages`), `boot/boot-program.ts` (negotiate before the flow starts; add `Locale` to the services), `flow/screen.ts` (`RuntimeServices` gains `Locale`), `presentation/presentation-bus.manager.ts` (`'locale.changed'` fact), `testing/runtime-test.ts` (`locale`, `languages` options), `boot/run-game.test.ts`, `index.ts`, `index.test.ts`, `packages/runtime/package.json`, `docs/versions.md`.

## Interfaces

- **Consumed:** `Hosting.kind`, `Hosting.locale`, `Hosting.saves` (`@mcthaydt/automata-host`); `PresentationBus`; Paraglide's generated `runtime.js` (`locales`, `baseLocale`, `overwriteGetLocale`) and `messages.js`.
- **Produced (root export of `@mcthaydt/automata-runtime`):**
  - `negotiateLocale({ hosted, saved, browser, locales, baseLocale }): string` and `matchLocale(requested, locales): string | undefined`;
  - `formatNumber`, `formatPercent`, `formatDuration`, `pluralCategory`, `selectPlural` (each takes the locale first);
  - `textDirection(locale): 'ltr' | 'rtl'`, `applyDocumentLocale(element, locale)`;
  - `createT(messages)`: `t(key, inputs?)` typed by the messages module;
  - the `Locale` service (`current`, `locales`, `direction`, `subscribe`, `set(choice | null)`), `LOCALE_SAVE_KEY = 'automata.locale'`, the `LocaleDef` type (Paraglide's generated runtime module satisfies it);
  - presentation fact `'locale.changed': { locale, previous }`.

## Steps

- [x] **1. Negotiation.** `negotiate-locale.test.ts`:
  - hosted `fr-CA` with locales `en, fr` gives `fr` (exact tag first, then primary subtag);
  - hosted wins over saved and browser; an unsupported hosted locale falls through to saved, then to the first supported browser language, then to `baseLocale`;
  - a saved choice that is no longer a locale is ignored;
  - matching is case-insensitive and returns the game's own spelling (`pt-br` → `pt-BR`).

  Run `pnpm --filter @mcthaydt/automata-runtime exec vitest run --project unit src/locale` and confirm it fails because `./negotiate-locale` does not exist. Implement, confirm it passes.
- [x] **2. Formatting.** `format.test.ts`: `formatNumber('de', 1234.5)` is `1.234,5`; `formatPercent('fr', 0.5)` uses a narrow no-break space before `%`; `formatDuration('en', 75_000)` is `01:15` and `formatDuration('en', 3_725_000)` is `1:02:05`; `pluralCategory('en', 1)` is `one`, `pluralCategory('en', 2, 'ordinal')` is `two`; `selectPlural('fr', 0, { one, other })` picks `one` (French zero is singular). Confirm it fails on the missing module, implement, confirm it passes.
- [x] **3. Document.** `document-locale.test.ts`: `textDirection` is `rtl` for `ar`, `he`, `fa`, `ur` and `ar-EG`, and `ltr` for `en`, `ja`, `zh-Hans`, `xx-long`; `applyDocumentLocale` sets `lang` and `dir` on the element. Confirm the failure, implement from `Intl.Locale#maximize().script` (the same answer in every engine), confirm it passes.
- [x] **4. Paraglide `t()`.** `testing/compile-fixture.ts` compiles `testing/fixture.inlang` (en, fr) with Paraglide's `compile` into a temporary folder. `paraglide.test.ts`:
  - `bindParaglide(runtime, () => 'fr')` makes the generated `m.play()` answer `Jouer`;
  - `createT(m)('hello', { name: 'Ada' })` answers `Bonjour Ada` while the getter answers `fr`, and `Hello Ada` after it answers `en`, with no reload;
  - a type test: `t('nope')` and `t('hello')` without inputs are type errors (`// @ts-expect-error`).

  Confirm it fails on the missing module, implement, confirm it passes.
- [x] **5. `Locale` service.** `locale.test.ts`, with a fake `Hosting` (kind, locale, saves) and a presentation bus:
  - the initial locale is the negotiated one, and the element's `lang`/`dir` are set before `makeLocale` returns;
  - `set('fr')` updates `current`, publishes `'locale.changed'` with the previous locale, calls subscribers, updates `lang`, and writes `automata.locale` through `Hosting.saves`;
  - `set(null)` (Automatic) removes the saved key and goes back to negotiation without the saved step;
  - `set('de')` with locales `en, fr` throws, naming the locale (a picker never offers it);
  - a refused `saves.set` is logged and the locale still changes in memory (no device-storage fallback).

  Confirm the failure, implement, confirm it passes.
- [ ] **6. Boot (L-b, L-c at runtime level).** In `boot/run-game.test.ts`, under the fake Ruken host:
  - **L-b:** the welcome's `locale: 'fr'` and `locale: <fixture runtime>` give `document.documentElement.lang === 'fr'` and a first screen whose `enter` reads `t('play') === 'Jouer'`; the screen never saw English;
  - with no `locale` in the game, the locale is the content's `source_language` and `lang` is set;
  - a saved `automata.locale` of `fr` wins in standalone over the browser languages (`seams.languages`);
  - **L-c:** with a focused button inside the entered screen, `Locale.set('en')` keeps `Flow.current`, publishes no `screen.entered`, and keeps `document.activeElement`.

  Confirm they fail (no `Locale` service), wire `makeLocale` into `bootProgram` step 7 before `flowHandle.start()` and into `RuntimeTest`, add `Locale` to `RuntimeServices` and the root exports (`index.test.ts`), confirm they pass.
- [ ] **7. Pins, gates, bookkeeping.** Add the two rows to `docs/versions.md`; run `pnpm --filter @mcthaydt/versions test`. Run `pnpm format`, `pnpm check`, `pnpm test:parity`, `pnpm test:e2e` (ports per lane). Record the evidence in 02, 03 and the execution log; add the PRODUCT.L2, PRODUCT.L3 and `automata check` rows to 02.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| — | — | — | — |
