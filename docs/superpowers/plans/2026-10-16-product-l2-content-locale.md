# PRODUCT.L2: content locale (Paraglide compile, missing-key positions, content text lookup, glyph sets) TDD plan

- **Spec:** [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §4 items 1, 5 and 6 (the content part of "Messages", "Content", "Glyph coverage"), acceptance case **L-d**; §9 ownership: `content` owns the compile and the glyph sets.
- **Status:** drafted 2026-10-16. PRODUCT.0 is Owner-approved with every recommended default (2026-10-16), so this plan may run. Depends on PRODUCT.L1 (PR #48, branch `claude/clever-pasteur-ujmu6e-productl`), which it is based on.
- **Progress:** 2 of 6 steps.
- **Out of scope:** L-e (a glyph missing from the subset font fails the asset build) waits for M5's font-subsetting asset build, which consumes the glyph sets made here; the language picker, `xx-long` and right-to-left are PRODUCT.L3; missing/unused keys and glyph coverage in `automata check` are PRODUCT.L4.

## Source

Extracted from FloorFifty at `ac72660` (`SNEKPRTY/FloorFifty`, `ac726602e05dc5ea23ca175f374b4dd81d0ee5ae`):

| AF file (`packages/content/src/`) | FloorFifty source | Changed |
|---|---|---|
| `locale/compile-messages.ts` | `tools/i18n/compile.ts`, `apps/client/i18n.config.ts`, `apps/client/project.inlang/settings.json` | The inlang project is generated from the compiled catalogs (source language first, then each translation) in a temporary folder, so no `project.inlang` or plugin path is committed in the game; a game's own UI catalogs join through `paraglide.catalogs` path patterns, merged after content as FloorFifty merges `messages/content` then `messages/ui`; Paraglide's own strategies are only `baseLocale` (the runtime's `Locale` service answers, PRODUCT.L1) |
| `locale/content-text.ts` | `apps/client/src/i18n/content.ts` (`lookup`, `stageName`, …) | One generic lookup by kind, ID and field path through `messageKey` (the one key owner) instead of hand-written per-field helpers; the missing-key report is an injected callback, called once per key |
| `locale/glyphs.ts` | `tools/i18n/characters.ts`, `tools/i18n/catalogue.ts` (`visibleTexts`) | Over a catalog value rather than a file read; content catalogs are plain text (`checkTranslation` refuses anything else), so every character of every message counts |
| `parse/locate-json-keys.ts` | — (new) | Positions of a JSON object's top-level keys, so a translation's problems carry `line:col` |

FloorFifty's `tests/client/i18n/content.test.ts` and `fonts.test.ts` are app-level (its catalogs, its fonts); the AF tests below are new and cover the same behavior on the fixture game.

## Decisions (made under the Owner's instruction to decide and record)

- **Where a missing key is reported (L-d).** A key missing from `content/messages/fr.json` has no position in that file, so the diagnostic is placed at the source text it translates: `content/stages/dawn.toml:2:1  displayName  staleTranslation: content_stage_dawn_display_name is missing from content/messages/fr.json`. An extra key or a non-text value is placed at its own key in the translation file. Today all three sit at `content/messages/fr.json:1:1`.
- **No duplicate catalogs in the output folder.** Translations stay authored in `content/messages/<lang>.json`; `CompiledContent` gains `languages` and `catalogs` (each language's checked catalog, source first), and the Paraglide compile and the glyph sets read those. Copying translations into `content/generated/messages/` would give translators a second file to edit by mistake, and would change every committed output folder. The existing `messages/<source>.json` output is unchanged.
- **Paraglide runs in `buildContent`, only when the game asks** (`ContentOptions.paraglide: { outdir, catalogs? }`), after the outputs are written, so `automata-content build` and the Vite plugin both produce it and `check` never does. Its output is not part of `verifyContent` (generated code, which the game ignores in git as FloorFifty does). A Paraglide failure is a `ContentWriteFailed` naming the outdir, so the CLI and the Vite plugin report it with no new error branch.
- **Paraglide is loaded with a dynamic `import()`** inside the compile, so a game that does not localize (and `check`) never loads the inlang SDK.
- **Runtime lookup lives in a browser-safe subpath** `@mcthaydt/automata-content/locale` (`messageKey`, `snakeKey`, `createContentText`, the glyph functions): the root entry pulls in Node's `fs`, and the runtime already avoids importing it (`contentHashOf`).
- **Glyph sets are functions, not an output file.** `localeCharacters(catalog)` is what M5's subsetter cuts to and `catalogCharacters(catalog)` what a coverage check holds a font to (FloorFifty's split); M5 calls them on `CompiledContent.catalogs`. No output file is added, so committed outputs (`examples/content/hot-reload`) do not change.

## Global constraints

- **Strict TDD** in `packages/content`: write the failing test, run it, confirm the failure reason, make the minimal change, confirm it passes.
- **Content hashes don't move with language.** The catalogs are derived beside the artifact, never inside it; a translation edit changes neither `hash` nor `sim.hash` (step 3 proves it).
- **One key owner.** Every key is `messageKey` from `locale/messages.ts`; the lookup never re-implements it.
- **New dependencies** of `packages/content` (`dependencies`, since a game's build runs them): `@inlang/paraglide-js` 2.25.4 and `@inlang/plugin-message-format` 4.4.4, the versions PRODUCT.L1 pinned (`docs/versions.md` rows updated to name content).
- **Gates:** `pnpm format`, `pnpm check` (under the heavy-gates lock); content's browser parity project (`pnpm --filter @mcthaydt/automata-content test:parity`, under the lock) because the package changed; consumer smoke (`pnpm build && node tooling/consumer-smoke/src/run.ts --from packs`) because the published exports change. `pnpm test:parity` and `pnpm test:e2e` are omitted: no runtime, rendering, UI, host, game or example code changes, and no committed output changes. Changeset: patch for `@mcthaydt/automata-content`.

## Files

- **Create** (in `packages/content/src/`): `parse/locate-json-keys.ts`, `parse/locate-json-keys.test.ts`, `locale/glyphs.ts`, `locale/glyphs.test.ts`, `locale/compile-messages.ts`, `locale/compile-messages.test.ts`, `locale/content-text.ts`, `locale/content-text.test.ts`, `locale/index.ts`; `.changeset/product-l2-content-locale.md`.
- **Modify:** `packages/content/src/locale/messages.ts` (`collectMessages` returns each key's origin), `compile/compile-content.ts` (positions for translation problems; `languages`, `catalogs`; `paraglide` option), `compile/compile-content.test.ts`, `compile/write-outputs.ts` (run the Paraglide compile), `index.ts`, `packages/content/package.json` (dependencies, `./locale` export), `packages/content/tsdown.config.ts` (`locale` entry), `docs/versions.md`.

## Interfaces

- **Consumed:** `@inlang/paraglide-js` `compile`; `@inlang/plugin-message-format`; the content compiler's `collectMessages`, `checkTranslation`, `messageKey`, `diagnosticAt`.
- **Produced:**
  - `CompiledContent.languages: readonly string[]` and `CompiledContent.catalogs: ReadonlyMap<string, MessageCatalog>` (source language first);
  - `ContentOptions.paraglide?: { outdir: string; catalogs?: readonly string[] }` (relative to `root`; `catalogs` are `{locale}` path patterns such as `messages/ui/{locale}.json`);
  - `compileMessages({ root, content, paraglide }): Effect<void, ContentWriteFailed>`;
  - `locateJsonKeys(text): KeyIndex`;
  - from `@mcthaydt/automata-content/locale`: `messageKey`, `snakeKey`, `createContentText(messages, { onMissing? })` giving `text(kind, id, path, authored, inputs?)`, `ALWAYS_CHARACTERS`, `catalogCharacters(catalog)`, `localeCharacters(catalog)`.

## Steps

- [x] **1. JSON key positions.** `parse/locate-json-keys.test.ts`: in `{\n  "$schema": "x",\n  "content_a": "A"\n}` the key `content_a` is at 3:3; a key-like text inside a string value (`"a": "\"b\": 1"`) and keys of a nested object are not indexed; a byte order mark does not shift columns; `positionOf` of an unknown key is 1:1. Run `pnpm --filter @mcthaydt/automata-content exec vitest run --project node src/parse/locate-json-keys` and confirm it fails because the module does not exist. Implement a scanner over text `JSON.parse` already accepted, confirm it passes.
- [x] **2. L-d: a missing key fails with its position.** In `compile/compile-content.test.ts`, change "a stale translation" to expect `content/stages/dawn.toml:2:1  displayName  staleTranslation: content_stage_dawn_display_name is missing from content/messages/fr.json`, and add: an extra key added at line 3 of `fr.json` is reported at `content/messages/fr.json:3:3`; a number value at its own key. Confirm they fail (today all are at `content/messages/fr.json:1:1`). `collectMessages` returns `origins` (key → item index and path, unit-tested in `messages.test.ts`); the compiler places missing keys at their origin and the rest with `locateJsonKeys`. Confirm they pass.
- [ ] **3. Per-locale catalogs and glyph sets.** In `compile-content.test.ts`: the fixture's `languages` is `['en', 'fr']` and `catalogs.get('fr')` holds `content_stage_dawn_display_name: 'Aube'` without `$schema`; changing `Aube` to `Aurore` in `fr.json` leaves `hash` and `sim.hash` unchanged. `locale/glyphs.test.ts`: `catalogCharacters({ a: 'Écarlate', b: 'Aube' })` is the set of their characters; `localeCharacters` adds `ALWAYS_CHARACTERS` (printable ASCII, CJK punctuation, full-width forms, `… — · ← → ✓ ×`); `$schema` is never counted. Confirm both fail (no `catalogs`; no module), implement, confirm they pass.
- [ ] **4. Paraglide compile.** `locale/compile-messages.test.ts` (node): `buildContent` on the fixture with `paraglide: { outdir: 'src/paraglide' }` writes `src/paraglide/messages.js`; importing it, `content_stage_dawn_display_name({}, { locale: 'fr' })` is `Aube` and `({}, { locale: 'en' })` is `Dawn`, and `runtime.locales` is `['en', 'fr']`; with `catalogs: ['messages/ui/{locale}.json']` and a `messages/ui/en.json` and `fr.json` holding `play`, `play({}, { locale: 'fr' })` answers from it; a build without `paraglide` writes no `src/paraglide`. Confirm it fails (no option, no files), implement `compileMessages` and call it from `buildContent`, confirm it passes.
- [ ] **5. Content text at run time.** `locale/content-text.test.ts`: with messages `{ content_stage_snow_shrine_display_name: () => 'Sanctuaire' }`, `text('stage', 'snow-shrine', ['displayName'], 'Snow Shrine')` is `Sanctuaire`; a missing key returns the authored text and calls `onMissing` once per key however often it is asked; a nested ID and field path use `messageKey`'s key; inputs reach the message. Add the `./locale` subpath (package `exports`, `publishConfig.exports`, `tsdown` entry) and a test that `locale/index.ts` imports nothing from `node:`. Confirm the failure on the missing module, implement, confirm it passes.
- [ ] **6. Pins, gates, bookkeeping.** Update the two `docs/versions.md` rows; run `pnpm --filter @mcthaydt/versions test`. Add the changeset. Run `pnpm format`, `pnpm check`, content's parity project and the consumer smoke. Record the evidence in 02, 03 and the execution log.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-16 | Plan | (this commit) | — |
