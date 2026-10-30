# M5.5F Endonyms in the font subsets: TDD plan

- **Task:** M5.5F in [02](../../02-master-delivery-plan.md) (lane content, size S). M5 spec [§4.7 Fonts](../specs/2026-10-16-m5-saves-audio-design.md): "each locale's subset is cut … to that locale's characters … plus FloorFifty's `ALWAYS` set … and the endonym text for the language picker". The follow-up recorded by the [M5.5 plan](2026-10-18-m5-5-fonts.md) (its "Out" table).
- **Lane:** content. **Depends on:** M5.5 (merged), the language picker (#91: `LanguageSection` and `endonymOf` in ui).
- **Status:** Drafted 2026-10-30.
- **Progress:** 1 of 5 steps.

## Sources, read at these commits

- **AF `main` at `30e9606c`:**
  - `packages/content/src/assets/build-fonts.ts`: each locale's subset is cut to `localeCharacters(catalog)` only, and the glyph gate checks only the locale's messages.
  - `packages/ui/src/settings/language-section.ts`: `endonymOf(tag)`, the picker's name for a language (`Intl.DisplayNames` in the language itself, first letter upper-cased, the tag when the engine cannot name it). `LanguageSection.svelte` shows `names?.[tag] ?? endonymOf(tag)`; `game`'s `SettingsView` passes no `names`, so the picker shows `endonymOf` for every language.
  - Package graph: `runtime` depends on `content` and `ui`; `ui` depends on no workspace package (`testing` is an optional peer); `content` depends on `sim`. Nothing links `content` and `ui`.
- **FloorFifty at `677d456`** (read for its design, not extracted): `packages/asset-contract/tools/subset-fonts.ts` cuts each CJK family twice, to its locale's characters and to a separate few-KB endonym file holding only its own language's name (`noto-sans-jp-endonym.woff2`: 日本語), and the picker's CSS stack (`--ff-font-endonym` in `apps/client/src/ui/styles/theme.css`) lists the Latin face then every endonym file. `tests/client/i18n/fonts.test.ts` checks each endonym file covers its name. Its names come from a hand-written `ENDONYMS` table (`apps/client/src/i18n/locales.ts`).
- **Test font:** `packages/content/src/assets/fixtures/fonts/noto-sans-jp-endonym.woff2` (already in the repo since M5.5, provenance beside it): 日, 本 and 語, nothing Latin.

## Design

**Every subset holds every content language's name** (spec §4.7 as written), rather than FloorFifty's separate endonym file. The picker can be opened in any language, and its options are drawn in whatever face the page's stack (or a game's `:lang()` rule) names, so the names have to be in every face a game loads, not in one extra file the game must also wire into a separate CSS stack. It needs no new output, no change to `fonts.json`'s shape and no CSS token in ui. A subset holds only the glyphs its face has, so a Latin face simply lacks 日本語.

**The gate checks the names of the languages the fonts serve, in every served language's subsets.** As the existing rule says, a language no font serves is not checked: it draws in whatever face the game's CSS names, and so does its name. So for a game with a pixel face for `en` and `fr` and a JP face for `ja`, the `en` and `fr` subsets must also hold 日本語: either the JP face serves `en` and `fr` too (it is cut to their text plus the names), or the build fails. A failure is `missingGlyph` at the locale's entry in the first font (by name) that serves it, `font.<name>.locales.<i>` in `content/fonts.toml`, since that file is where it is fixed; the message names each missing code point, the locale, its fonts, and the name and language it belongs to.

**One owner for the names.** The font build (content, Node, build time) must use the picker's own function, not a copy. `content` must not import `ui`, and `ui` imports no workspace package, so `endonymOf` moves to `@mcthaydt/automata-content/locale`, content's browser-safe localization entry, which already owns `localeCharacters` for this build. ui keeps its public `endonymOf` as a re-export of content's (`language-section.ts`), so ui's API and `LanguageSection` are unchanged; ui gains a dependency on `@mcthaydt/automata-content` (every game already has it through `runtime`). The move brings its test.

## Contract

### `packages/content/src/locale/endonyms.ts` (create; moved from ui)

```ts
/** A language's name in its own language ("日本語" for `ja`), from `Intl.DisplayNames`; the tag when the engine cannot name it. */
export function endonymOf(tag: string): string
```

Exported from `@mcthaydt/automata-content/locale`. `packages/ui/src/settings/language-section.ts` re-exports it; ui's root entry is unchanged.

### `buildFonts` (`packages/content/src/assets/build-fonts.ts`, modify; no signature change)

1. Each subset is cut to `localeCharacters(catalog)` plus the characters of `endonymOf(language)` for every language in `content.languages`.
2. After the message check, for each locale with subsets (and no broken font), for each language some font serves (in `content.languages` order), the name's characters that none of the locale's subsets hold are reported once, as `missingGlyph` at `font.<first font>.locales.<i>`: `U+65E5 "日", U+672C "本", U+8A9E "語" are not in the en subset of pixel: 日本語 names ja in the language picker`.
3. Control characters are skipped as before (a name has none).

## Steps

Each step starts with its test, run red, with the failure reason recorded.

- [x] **1. This plan.** *Verify:* `pnpm format`.
- [ ] **2. `endonymOf` moves to content** (`packages/content/src/locale/endonyms.test.ts`, the `endonymOf` case moved from `packages/ui/src/settings/language-section.svelte.test.ts`; `endonyms.ts`; `locale/index.ts`; ui's `language-section.ts` re-export and `package.json` dependency).
  - *Red:* `endonyms.test.ts` (日本語 for `ja`, English for `en`, the tag for one the engine cannot name; the entry exports it).
  - *Expected failure:* `Cannot find module './endonyms'`.
  - *Then:* ui's `language-section.svelte.test.ts` (the `LanguageSection` cases, which use the re-export) still passes, and ui's `typecheck` passes.
- [ ] **3. Every subset holds every language's name** (`build-fonts.test.ts`; `build-fonts.ts`).
  - *Red:* a game with `en`, `fr` and a `ja` translation, the pixel face serving all three and the `noto-sans-jp-endonym` fixture serving all three: the build passes and the JP face's `en` and `fr` subsets hold 日, 本 and 語.
  - *Expected failure:* the JP face's `en` subset is cut to the English text only, so `fontCoverage(...)('日')` is false.
- [ ] **4. The gate covers the names** (`build-fonts.test.ts`; `build-fonts.ts`).
  - *Red, by case:*
    - the same game with the JP fixture serving `ja` only: the build fails with one `missingGlyph` each for `en` and `fr`, at `font.pixel.locales.0` and `.1`, naming U+65E5, U+672C and U+8A9E, 日本語 and `ja`;
    - with no font serving `ja`, the build passes: an unserved language's name is not checked (green before and after; it guards the rule).
  - *Expected failure:* the first case builds (`expected the build to fail`).
- [ ] **5. Reports, changeset, gates.**
  - *Regenerate:* `pnpm build`, `pnpm api-report --update`, `pnpm api-index` (`pnpm cheatsheet` if stale), `pnpm agent-skills --write`.
  - *Changeset:* a patch for `@mcthaydt/automata-content` and `@mcthaydt/automata-ui`.
  - *Gates:* `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`, `pnpm --filter @mcthaydt/automata-content test:parity`, `pnpm --filter @mcthaydt/automata-ui test:parity`, and (ui's dependencies change) `pnpm build && node tooling/consumer-smoke/src/run.ts --from packs`.

## Out

| What | Where |
|---|---|
| A separate endonym file per face (FloorFifty's design) | Not taken: see Design. |
| A game's own `names` for `LanguageSection` | `game`'s `SettingsView` passes none today. When a game can pass its own names, the font build has to read them from the same place (a follow-up, not speculative scope here). |
| The browser's `Intl.DisplayNames` naming a language differently from Node's | The build uses Node 24's ICU; a browser with older or newer CLDR data may spell a name differently (casing, a region in brackets). A character it adds that no subset holds falls back to the next face in the stack. Recorded as a follow-up. |
| A game's UI catalogs in the gate, fonts in the Vite build hook and the preload list | Unchanged; already tracked by the M5.5 and M5.6 follow-up rows. |

## Execution log

- 2026-10-30: plan drafted (step 1).
