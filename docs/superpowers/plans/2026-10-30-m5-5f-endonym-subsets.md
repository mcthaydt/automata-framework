# M5.5F Endonyms in the font subsets: TDD plan

- **Task:** M5.5F in [02](../../02-master-delivery-plan.md) (lane content, size S). M5 spec [§4.7 Fonts](../specs/2026-10-16-m5-saves-audio-design.md): "each locale's subset is cut … to that locale's characters … plus FloorFifty's `ALWAYS` set … and the endonym text for the language picker". The follow-up recorded by the [M5.5 plan](2026-10-18-m5-5-fonts.md) (its "Out" table).
- **Lane:** content. **Depends on:** M5.5 (merged), the language picker (#91: `LanguageSection` and `endonymOf` in ui).
- **Status:** Implemented and locally checked 2026-10-30 (PR #237 from `claude/m5-5f-endonym-subsets`); the review's optional findings handled in step 6. Not CI verified (the Mac's CI pending); no Owner gate of its own.
- **Progress:** 6 of 6 steps.

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
2. After the message check, for each locale with subsets (and no broken font), for each language some font serves (in `content.languages` order), the name's characters that none of the locale's subsets hold are reported once, as `missingGlyph` at `font.<first font>.locales.<i>`: `U+65E5 "日", U+672C "本", U+8A9E "語" are not in the en subset of pixel (the language picker names ja 日本語)`.
3. Control characters are skipped as before (a name has none).

## Steps

Each step starts with its test, run red, with the failure reason recorded.

- [x] **1. This plan.** *Verify:* `pnpm format`.
- [x] **2. `endonymOf` moves to content** (`packages/content/src/locale/endonyms.test.ts`, the `endonymOf` case moved from `packages/ui/src/settings/language-section.svelte.test.ts`; `endonyms.ts`; `locale/index.ts`; ui's `language-section.ts` re-export and `package.json` dependency).
  - *Red:* `endonyms.test.ts` (日本語 for `ja`, English for `en`, the tag for one the engine cannot name; the entry exports it).
  - *Expected failure:* `Cannot find module './endonyms'`.
  - *Then:* ui's `language-section.svelte.test.ts` (the `LanguageSection` cases, which use the re-export) still passes, and ui's `typecheck` passes.
  - *Done: red `Cannot find module './endonyms'`, then 3 of 3 green (a `fr` case added: "Français", the capital the picker adds); `src/locale` 21 of 21. ui's `endonymOf` case became a check that ui's export is content's function; `language-section.svelte.test.ts` 4 of 4, ui `typecheck` 0 errors over 522 files. `pnpm install` added the `packages/ui` dependency to `pnpm-lock.yaml` (a workspace link, no new external package).*
- [x] **3. Every subset holds every language's name** (`build-fonts.test.ts`; `build-fonts.ts`).
  - *Red:* a game with `en`, `fr` and a `ja` translation, the pixel face serving all three and the `noto-sans-jp-endonym` fixture serving all three: the build passes and the JP face's `en` and `fr` subsets hold 日, 本 and 語.
  - *Expected failure:* the JP face's `en` subset is cut to the English text only, so `fontCoverage(...)('日')` is false.
  - *Done: red `en: expected [ false, false, false ] to deeply equal [ true, true, true ]` (the JP face's `en` subset held no glyph), then green with the names added to each subset's characters: 12 of 12 in `build-fonts.test.ts`, 74 of 74 in `src/assets` and `src/cli`.*
- [x] **4. The gate covers the names** (`build-fonts.test.ts`; `build-fonts.ts`).
  - *Red, by case:*
    - the same game with the JP fixture serving `ja` only: the build fails with one `missingGlyph` each for `en` and `fr`, at `font.pixel.locales.0` and `.1`, naming U+65E5, U+672C and U+8A9E, 日本語 and `ja`;
    - with no font serving `ja`, the build passes: an unserved language's name is not checked (green before and after; it guards the rule).
  - *Expected failure:* the first case builds (`expected the build to fail`).
  - *Done: red `expected the build to fail`, then green: 14 of 14 in `build-fonts.test.ts`, 292 of 292 in content's node project, `tsc` clean. The message check and the name check share `missingCharacters` and `notInSubset`; `LocaleCoverage` gains `at`, the locale's entry in its first font's `locales`. `DiagnosticCode`'s `missingGlyph` doc names the picker's names too. Hand mutations: dropping the served-language filter fails the unserved case; dropping the names from the cut fails 9 of 14 (the Latin subsets then lack the ç of Français).*
- [x] **5. Reports, changeset, gates.**
  - *Regenerate:* `pnpm build`, `pnpm api-report --update`, `pnpm api-index` (`pnpm cheatsheet` if stale), `pnpm agent-skills --write`.
  - *Changeset:* a patch for `@mcthaydt/automata-content` and `@mcthaydt/automata-ui`.
  - *Gates:* `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`, `pnpm --filter @mcthaydt/automata-content test:parity`, `pnpm --filter @mcthaydt/automata-ui test:parity`, and (ui's dependencies change) `pnpm build && node tooling/consumer-smoke/src/run.ts --from packs`.
  - *Done, 2026-10-30, first attempts on `7f2c27c5` (main at `30e9606c`, unmoved at push time):*
    - *Regenerate:* `pnpm api-report` failed first (`content.api.md` gains `endonymOf` in `./locale`), then `--update`; `pnpm api-index` said the cheatsheet was stale, `pnpm cheatsheet`, then 571 exports, 0 undocumented; `pnpm agent-skills` differed, `--write`, then current. ui's report is unchanged. The `localeCharacters` doc now says the build adds the names, so it was regenerated once more.
    - *Known quirk (not new):* the API index prints ui's re-exported `endonymOf` with its source body, as it already does for ship's re-exported `FileError`: the extractor resolves a workspace package through its development `exports` (`src`), not its published `.d.ts`. Left as a follow-up.
    - *Gates:* `pnpm format` clean; `TURBO_FORCE=true pnpm check` exit 0 (lint, typecheck 36 of 36, boundaries 0 findings, style 654 files 0 findings, knip clean apart from the existing `zod` hint in ship, test:unit 34 of 34); `pnpm changeset status --since=origin/main` passes; `check-changesets` 4 changesets, 0 problems; content parity 6 of 6 and ui layout parity 2412 of 2412 (Chromium, WebKit, Firefox); `pnpm build` then `consumer-smoke --from packs` passed (install, node entries, content bin, types with TypeScript 7, 7 nodenext and 6, no eval, both bundles).

- [x] **6. Review follow-ups** (the independent review of PR #237: no blocking finding, seven optional ones).
  - `packages/content/src/locale/endonyms.parity.test.ts` (create): `endonymOf` gives the same names for `en`, `es`, `fr`, `ja`, `ko`, `pt-BR` and `zh-Hans` in Node, Chromium, WebKit and Firefox, pinned as Node 24.21 gives them. It runs in content's `node` and `browsers` projects.
  - `build-fonts.test.ts`: an unserved language's name is still cut into every subset (`ja` with no font; the 日本語 face serving `en` and `fr` holds 日本語 in both).
  - `glyphs.ts`: the header says `localeCharacters` is the locale's own characters and the font build adds the names.
  - This plan: the contract's example message now matches the code (see the log's deviation).
  - *Done:* both tests are characterisation tests of behaviour steps 2 to 4 built, so they passed on first run; each was then shown to bite. With the cut limited to the served languages' names (a temporary edit, reverted), the new `build-fonts` case failed `en: expected [ false, false, false ] to deeply equal [ true, true, true ]` and the other 14 passed. With `yue: '粵語'` (Node's name) added to the pinned list (reverted), Chromium failed with `"yue": "Cantonese"` while WebKit and Firefox passed. Then `build-fonts.test.ts` 15 of 15, `src/locale` endonym tests 4 of 4 in Node; content parity 9 of 9 (3 files × 3 browsers).
  - *Measured for the PR's Decision 1,* with AF's `subsetWoff2` on FloorFifty's variable (`wght` 100–900) Noto Sans JP, KR and SC subsets at `677d456` (`apps/client/public/fonts/`), cut to `localeCharacters` of an English catalog plus the six planned names: 74 728, 71 568 and 70 508 bytes (395, 393 and 394 glyphs); `ALWAYS_CHARACTERS` alone is 69 368, 71 228 and 69 432 bytes. FloorFifty's endonym files are 1 552, 1 548 and 1 992 bytes.

## Out

| What | Where |
|---|---|
| A separate endonym file per face (FloorFifty's design) | Not taken: see Design. |
| A game's own `names` for `LanguageSection` | `game`'s `SettingsView` passes none today. When a game can pass its own names, the font build has to read them from the same place (a follow-up, not speculative scope here). |
| The browser's `Intl.DisplayNames` naming a language differently from Node's, beyond the planned languages | The build uses Node 24's ICU. Step 6 pins the planned languages' names in every engine; a game language outside that list is not checked, and Chromium already names `yue` "Cantonese" where Node gives 粵語. A character a browser adds that no subset holds falls back to the next face in the stack. Recorded as a follow-up (a static name table read by both, as FloorFifty has, would close it). |
| A game's UI catalogs in the gate, fonts in the Vite build hook and the preload list | Unchanged; already tracked by the M5.5 and M5.6 follow-up rows. |

## Execution log

- 2026-10-30: plan drafted (step 1), `b92905dd`.
- Step 2, `812967ad`: `endonymOf` moved to content's `./locale` with its test; ui re-exports it and depends on content.
- Step 3, `93bbe80d`: every subset is cut with every content language's name.
- Step 4, `de40e742`: the gate checks the served languages' names in each language's subsets.
- Step 5, `7f2c27c5`: changeset (content, ui patch), API report, index, cheatsheet and agent skills; gates above.
- Step 6: the review follow-ups above (`endonyms.parity.test.ts`, the unserved-name cut case, the `glyphs.ts` header, this plan's contract text).
- **Deviation:** the diagnostic's wording. The contract's example said `…of pixel: 日本語 names ja in the language picker`; the code and its test (step 4) say `…of pixel (the language picker names ja 日本語)`, which keeps the message check's sentence unchanged and puts the name after it. The contract now shows the code's wording. Otherwise none from this plan. From the brief's two options, every subset carries the names (the spec's wording) rather than FloorFifty's separate endonym file; the reasons are under Design.
