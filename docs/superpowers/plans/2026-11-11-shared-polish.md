# Shared polish from FloorFifty: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to do this plan task by task, in this
> session, with no subagents (`AGENTS.md`). Steps use checkbox (`- [ ]`) syntax. Tick a step only when its check passed.

**Goal:** every game on the framework gets six languages, a translator's workflow, a first-run language pick, a
photosensitivity warning, interface sounds, a splash, credits, Ruken achievements and a stale-build check, with four
examples a person can see.

**Architecture:** each item goes where its owner already is (the spec's approach C). Core (`packages/automata`) gets the
translated menu words, an *opening* sequence that runs after the host is ready and before the first screen, and one
root listener for interface sounds. `@automata/ui-screens` gets Splash and Credits. `@automata/tools` gets
`automata words` and achievements in `ruken.toml`. `@automata/net`, `-net-server` and `-net-ui` get the stale-build check.

**Tech stack:** TypeScript, Svelte 5, Zod, Vitest (jsdom and real-browser projects), Playwright journeys, Effect in
Node tools only.

**Spec:** [`../specs/2026-11-11-shared-polish-design.md`](../specs/2026-11-11-shared-polish-design.md). Read it first.
**Tracker:** [`../progress.md`](../progress.md). **FloorFifty** (`SNEKPRTY/floorfifty` at `677d456`) is the behaviour
reference; attach it read-only with `add_repo` and clone it to `/home/user/floorfifty`. Paths below that start
`ff:` are under that clone. Port behaviour and tests; copy no FloorFifty branding, art, flags or wordmark.

## Tracking

Update this table and the workstream row in `../progress.md` in the same commit as each task.
**Progress: 0 of 18 tasks (0%).**

| # | Task | Item | State | Commit |
|---|---|---|---|---|
| 1 | The six languages as data, and the negotiation rules pinned | 1 | todo | |
| 2 | Core's menu words as catalogs in six languages | 1 | todo | |
| 3 | `words`: catalogs, CSV and the review ledger (pure) | 1 | todo | |
| 4 | `automata words export`, `import`, `status` | 1 | todo | |
| 5 | `automata words check`, and the `words` step of `automata check` | 1 | todo | |
| 6 | The opening sequence and the seen flags (core) | 2, 3 | todo | |
| 7 | First-run language pick | 2 | todo | |
| 8 | Photosensitivity warning | 3 | todo | |
| 9 | Interface sounds | 4 | todo | |
| 10 | `create-game` maps a starter set of interface sounds | 4 | todo | |
| 11 | Splash (`@automata/ui-screens`) | 5 | todo | |
| 12 | Credits (`@automata/ui-screens`) | 5 | todo | |
| 13 | Achievements in `ruken.toml` and `automata check` | 6 | todo | |
| 14 | Stale-build check | 7 | todo | |
| 15 | The four examples and their journeys | examples | todo | |
| 16 | Emberwick in six languages, with an achievement | 1, 6 | todo | |
| 17 | Ember Hall (`games/base-3d`) in six languages | 1 | todo | |
| 18 | Guides, API report and index, changesets, final gates | done means | todo | |

## Global constraints

- `AGENTS.md` is in force: the seven laws; feature folders (`pnpm boundaries`); tests first, only in `tests/`, importing
  `#src/…`; Zod only; one `.test.ts` suffix; kebab-case files; at most 600 lines a source file; comments say why and
  name no plan.
- Languages, in picker order: `en` (source), `ja`, `ko`, `es-419`, `pt-BR`, `zh-Hans`.
- Touch targets at least 44 px, primary actions 48 px. Design and test at phone size first. Copy passes the grandma test.
- The sim is untouched: nothing here may move a sim hash or a golden replay. If one moves, stop and investigate.
- Core never imports an extension; `packages/` and `games/emberwick` may not import one (`pnpm boundaries`).
- Achievement limits and rule shapes are `@ruken/manifest`'s. Never retype a limit (48, 120, the percent list).
- A translation is *reviewed* only when the ledger says a person approved it. Drafts ship marked unreviewed.
- Each task: `pnpm format`, then the task's checks, then one Conventional Commit. Published packages that changed get a
  `patch` changeset in the same commit (`.changeset/<short-name>.md`, the form of `.changeset/audio-overall-volume.md`).
- A changed export or doc comment of a published package: `pnpm build`, `pnpm api-report --update`,
  `pnpm api-index --write`, committed (batched in task 18, or earlier if `pnpm check` asks).
- No subagents. Hosted CI has no runners: run browser suites in Chromium here, and report WebKit, Firefox and real
  devices as pending for the Owner. Never claim a suite that did not run.
- Test commands below use `pnpm --filter <pkg> exec vitest run --project unit <file>`. Where a package's own script adds
  flags (`--configLoader runner` in the games), add them.

## The calls this plan makes

The spec left these to the builder, or the code did not have what the spec assumed. Each is decided here.

1. **Field names on `defineGame`:** `photosensitivity`, `firstRunLanguage`, `opening`, `uiSounds`. Shapes in tasks 6 to 9.
2. **How first-run sits in the flow:** it does not enter the flow graph. Boot runs an *opening sequence* after
   `hosting.ready` and before `flow.start`: language, then the warning, then the game's own `opening` steps (the
   splash), then the first screen. A game's content flow is unchanged, so no content hash moves, and the splash can
   never hold back the host's ready signal because ready has already resolved.
3. **Seen flags:** one device-storage record, key `automata.seen`, `{ language: boolean, photosensitivity: boolean }`
   (the spec says once per device). The language *choice* is saved by `Locale.set`, as Settings saves it.
4. **Language screen rule:** shown when the game has more than one locale, `hosting.kind !== 'ruken'`, the player has
   no saved choice (`locale.choice === null`) and `seen.language` is false. One press: each language is a button, the
   detected one has focus, pressing one picks it and goes on. Close and Escape go on with the detected one.
   FloorFifty's flags are art and are not copied; names are in their own script.
5. **Warning switches:** core has no reduced-motion switch (it reports the device's setting) and cannot import
   `@automata/feel`. The warning shows the device's reduced-motion line and any switches the game passes in
   `photosensitivity.switches`; a game with feel passes its `reduceFlashing` and `intensity`. Shown to the coordinator.
6. **Core's words are catalogs:** `packages/automata/src/app/screens/words/<lang>.json` in the inlang format the
   tools already read, so the same `automata words` workflow and ledger serve core, `ui-screens` and every game. The
   English TypeScript records stay the source; `en.json` is derived and a test fails when it is stale. All six ship in
   the bundle (a language switch must be instant and offline); the measured size goes in the changeset.
7. **Review ledger:** FloorFifty's scheme. Per catalog and language, `key → { source, reviewed? }` where `source` is the
   sha256 of the English at translation time and `reviewed` is the sha256 of English and translation together. Change
   either text and the string is unreviewed again with nothing to clear by hand.
8. **Which FloorFifty strings match:** the table in task 2. A match is the same English text *and* the same meaning
   (FloorFifty's `context.json` note). FloorFifty's ledger holds reviews for `es-419` only, so only those enter as
   reviewed; its `ja`, `ko`, `pt-BR` and `zh-Hans` texts are taken and recorded unreviewed.
9. **Sound names:** `press` (the default), `back`, `none`, `focus`, and by request `open`, `close`, `error`. A game may
   add any name. Starter sounds in task 10.
10. **Credits schema:** task 12. Sections of names; a name may have a role and a link.
11. **Credits links:** `Hosting` has no link-opening call, and adding one is a host-port change Ruken must be asked
    about. The panel never navigates: it calls the game's `onOpenLink(url)`; with no handler a link is plain text.
    Shown to the coordinator.
12. **Build facts:** there is no build stamp in the ship step. The facts are the `GameVersion` net-server already
    computes (protocol, schema hash, content hash), served on a new `GET /version`. `/health` stays as documented.
    The client waits at most 1500 ms; anything slow or unreadable passes. Shown to the coordinator.
13. **Emberwick's fonts:** Pixelify Sans has no Japanese, Korean or Chinese. Those menus use the device's fonts
    (`font-family` fallback); no font files are added. `automata words check` is proven on a fixture with a font. The
    Owner has been asked whether to ship Noto subsets instead.
14. **Emberwick's words** live in `games/emberwick/messages/ui/<lang>.json` (the game catalog path the content compiler
    documents) and are read as plain JSON, with no Paraglide, because Emberwick's screens are plain DOM.
15. **The stale-build "journey"** is a real-browser test in `@automata/net-ui` against a fake `fetch`, plus a unit test
    of the server route. A served two-process journey has no home in the repository today; that is reported, not built.

## Review focus

Inputs the spec implies and a person would meet. Each has a test in the task named.

1. A translator's CSV saved by Excel: a BOM, CRLF, quoted commas, an added empty row. Import reads it (task 3).
2. A translation that drops or renames a `{placeholder}`: import refuses the whole file and changes nothing (task 4).
3. Device storage blocked (private mode): the first-run screens still show and go on, once per visit, and never throw
   (task 6).
4. A language picked while the warning is next: the warning reads in the language just picked (task 8).
5. A held arrow key running down a list, or a finger press: at most one focus sound per 90 ms, and no focus sound on
   top of a press (task 9).

## File map

| Where | Files | What |
|---|---|---|
| `packages/content/src/shared/locale/` | `default-locales.ts` (new), `endonyms.ts`, `index.ts` | The six tags and their names |
| `packages/automata/src/features/locale/` | `negotiate-locale.ts` | Rules pinned by tests |
| `packages/automata/src/app/screens/` | `screens-copy.ts`, `screens-catalog.ts` (new), `words/<lang>.json`, `words/context.json`, `words/review/<lang>.json` | Core's words |
| `packages/automata/src/app/opening/` (new) | `opening.ts`, `seen-flags.ts`, `first-run.ts`, `LanguageFirst.svelte`, `PhotosensitivityWarning.svelte` | Opening sequence |
| `packages/automata/src/features/audio/` | `ui-sounds.ts` (new) | Interface sounds |
| `packages/automata/src/app/` | `define-game.ts`, `boot/game-definition.ts`, `boot/boot-program.ts` | New fields, wiring |
| `packages/tools/src/shared/words/` (new) | `catalog.ts`, `csv.ts`, `ledger.ts`, `words-args.ts`, `run-words.ts`, `characters.ts`, `words-step.ts` | `automata words` |
| `packages/tools/src/app/` | `cli.ts`, `help.ts` | Command wiring |
| `packages/content/src/shared/game/` | `game-config.schema.ts` | `achievements` |
| `packages/tools/src/shared/ship/targets/ruken/` | `ruken-toml.ts` | `[achievements.*]` |
| `packages/tools/src/shared/check/` | `check-source-steps.ts`, `run-check.ts`, `check-report.ts` | `achievements`, `words` steps |
| `extensions/ui-screens/src/features/` | `splash/`, `credits/` (new), `words/` | Splash, Credits |
| `extensions/net-server/src/features/operations/` | `probes.ts` | `GET /version` |
| `extensions/net/src/features/client/version/` (new) | `check-server-version.ts` | The check |
| `extensions/net-ui/src/features/stale/` (new) | `stale-build-step.ts`, `StaleBuild.svelte` | The error and Reload |
| `examples/2d/` | `core/core-languages.ts`, `core/core-first-run.ts`, `audio/audio-ui-sounds.ts`, `ui/ui-splash-credits.ts`, `tests/e2e/*.test.ts` | Examples |
| `games/emberwick/`, `games/base-3d/` | messages, screens, ship config | Reference games |

---

### Task 1: The six languages as data, and the negotiation rules pinned

**Files:**
- Create: `packages/content/src/shared/locale/default-locales.ts`
- Modify: `packages/content/src/shared/locale/endonyms.ts`, `packages/content/src/shared/locale/index.ts`
- Test: `packages/content/tests/unit/shared/locale/default-locales.test.ts`,
  `packages/automata/tests/unit/locale/negotiate-locale.test.ts` (add cases; create if absent)

**Interfaces:**
- Produces, from `@automata/content/locale`:
  `DEFAULT_LOCALES: readonly ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans']`, `type DefaultLocale`,
  `ENDONYMS: Readonly<Record<DefaultLocale, string>>`, and `endonymOf(tag)` answering from `ENDONYMS` first.

- [ ] **Step 1: Write the failing tests**

```ts
// default-locales.test.ts
expect(DEFAULT_LOCALES).toEqual(['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'])
expect(ENDONYMS).toEqual({ en: 'English', ja: '日本語', ko: '한국어', 'es-419': 'Español',
  'pt-BR': 'Português (Brasil)', 'zh-Hans': '简体中文' })
expect(endonymOf('es-419')).toBe('Español') // Intl alone says "Español (Latinoamérica)"
expect(endonymOf('fr')).toBe('Français')    // a tag outside the six still comes from Intl

// negotiate-locale.test.ts: ff:apps/client/src/i18n/detect.ts as cases
const six = ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans']
const pick = (browser: string[]) => negotiateLocale({ hosted: undefined, saved: undefined, browser, locales: six, baseLocale: 'en' })
expect(pick(['zh-TW'])).toBe('zh-Hans')
expect(pick(['zh-Hant-HK'])).toBe('zh-Hans')
expect(pick(['pt-PT'])).toBe('pt-BR')
expect(pick(['es-ES'])).toBe('es-419')
expect(pick(['fr-FR', 'ko-KR'])).toBe('ko') // the browser's order, first language the game has
expect(pick(['fr'])).toBe('en')
```

- [ ] **Step 2: Run them; confirm they fail.** The content test fails on the missing module. The negotiation cases may
  already pass (`matchLocale` matches on the primary subtag): if all pass, keep them as the pin and change nothing in
  `negotiate-locale.ts`; if one fails, fix `matchLocale` only.
- [ ] **Step 3: Implement** `default-locales.ts` (pure data, no imports), make `endonymOf` read `ENDONYMS` before
  `Intl.DisplayNames`, export all three from `index.ts`.
- [ ] **Step 4: Run** both test files, then `pnpm --filter @automata/content exec vitest run --project unit` and
  the font build's tests (they cut endonyms into subsets). Expected: pass.
- [ ] **Step 5: Commit** `feat(content): the six default languages and their names` with a `patch` changeset for
  `@automata/content`.

### Task 2: Core's menu words as catalogs in six languages

**Files:**
- Create: `packages/automata/src/app/screens/screens-catalog.ts`,
  `packages/automata/src/app/screens/words/{en,ja,ko,es-419,pt-BR,zh-Hans}.json`,
  `packages/automata/src/app/screens/words/context.json`,
  `packages/automata/src/app/screens/words/review/{ja,ko,es-419,pt-BR,zh-Hans}.json`
- Modify: `packages/automata/src/app/screens/screens-copy.ts` (`resolveScreensCopy`), `packages/automata/package.json`
  (export `"./words/*.json"`, in both `exports` and `publishConfig.exports`)
- Test: `packages/automata/tests/unit/app/screens/screens-catalog.test.ts`

**Interfaces:**
- Produces:
  - `flattenScreensCopy(copy: ScreensCopy): Record<string, string>`: keys are the record's path in snake_case joined by
    `_` (`paused_quit_prompt`, `settings_screen_more`). A function leaf becomes text with `{name}` placeholders; a leaf
    that takes a boolean becomes two keys ending `_on` and `_off`. The list of function leaves is a table in this file
    (`FUNCTION_LEAVES`: path, parameter names or `'boolean'`); read every `*Copy` interface under `app/screens/` and
    `shared/ui/` to fill it, and let the type checker hold it to `ScreensCopy`.
  - `screensCopyFrom(catalog: Readonly<Record<string, string>>, fallback: ScreensCopy): ScreensCopy`: the reverse; a
    missing key takes `fallback`'s leaf.
  - `screensCopyFor(locale: string): ScreensCopy`: the catalog of `matchLocale(locale, DEFAULT_LOCALES)`, else English.
  - `resolveScreensCopy(input, locale)` now lays the game's overrides over `screensCopyFor(locale)`.
- Consumes: `DEFAULT_LOCALES` (task 1), `matchLocale`.

- [ ] **Step 1: Write the failing tests**

```ts
test('en.json is the English record, flattened', () => {
  expect(en).toEqual({ $schema: 'https://inlang.com/schema/inlang-message-format', ...flattenScreensCopy(DEFAULT_SCREENS_COPY) })
})
test('a round trip keeps every leaf', () => {
  const back = screensCopyFrom(flattenScreensCopy(DEFAULT_SCREENS_COPY), DEFAULT_SCREENS_COPY)
  expect(back.paused.resume).toBe('Resume')
  expect(back.board.more(3)).toBe(DEFAULT_SCREENS_COPY.board.more(3))
  expect(back.settings.display.reducedMotion(true)).toBe(DEFAULT_SCREENS_COPY.settings.display.reducedMotion(true))
})
test.each(['ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'])('%s has exactly the English keys and placeholders', (lang) => { /* key sets equal; {names} per key equal */ })
test('a game with no words of its own gets translated menus', () => {
  expect(resolveScreensCopy(undefined, 'ja').paused.resume).toBe('再開')          // FloorFifty's pause_resume
  expect(resolveScreensCopy(undefined, 'pt-PT').title.play).toBe(resolveScreensCopy(undefined, 'pt-BR').title.play)
  expect(resolveScreensCopy(undefined, 'fr')).toEqual(DEFAULT_SCREENS_COPY)
})
test('copy.screens still overrides', () => {
  expect(resolveScreensCopy({ title: { play: 'Go' } }, 'ja').title.play).toBe('Go')
})
```

Check `再開` against `ff:apps/client/messages/ui/ja.json` `pause_resume` before writing it in; use the file's value.

- [ ] **Step 2: Run; confirm it fails** on the missing module.
- [ ] **Step 3: Implement** `screens-catalog.ts` and write `en.json` from `flattenScreensCopy` (a one-off `node -e`; the
  test is the guard from then on).
- [ ] **Step 4: Fill the five translations.** For each core key, take FloorFifty's text where the table below matches;
  draft the rest yourself in plain, short words (the grandma test) and keep every `{placeholder}`.

  | Core key | FloorFifty key (`ff:apps/client/messages/ui/<tag>.json`) |
  |---|---|
  | `title_play` | `title_play` |
  | `play_pause` | `settings_action_pause` |
  | `play_move` | `settings_action_move` |
  | `paused_title`, `paused_resume`, `paused_settings` | `pause_title`, `pause_resume`, `pause_settings` |
  | `paused_close`, `paused_back`, `paused_mute`, `paused_unmute` | `shell_close`, `shell_back`, `shell_mute`, `shell_unmute` |
  | `settings_screen_title`, `…_back`, `…_tabs`, `…_settings_tab`, `…_controls_tab` | `title_settings`, `shell_back`, `settings_sections`, `settings_tab_settings`, `settings_tab_controls` |
  | `settings_language_title`, `…_automatic` | `settings_language`, `settings_language_automatic` |
  | `settings_audio_title`, `settings_audio_mute`, music | `settings_audio`, `settings_mute`, `settings_music` |
  | `settings_display_title`, quality and its three tiers | `settings_display`, `settings_graphics_quality`, `settings_quality_{high,medium,low}` |
  | `settings_vibration_title` | `settings_rumble` |
  | touch: title, buttons, swipe | `settings_touch_controls`, `settings_touch_buttons`, `settings_touch_swipe` |
  | input methods and prompt glyph names | `settings_method_{keyboard,gamepad,touch}`, `a11y_glyph_*` |
  | `board_you` | `ready_seat_you` (only if its context note means "this row is you") |

  Extend the table yourself the same way: list core's English values, find equal values in `ff:…/ui/en.json`, read the
  note in `ff:…/messages/context.json`, and take the match only when the meaning is the same.
- [ ] **Step 5: Write the ledgers.** `words/review/<lang>.json` is `{ key: { source, reviewed? } }` (call 7; task 3
  defines the hashes, so write the files with task 3's `ledgerEntry` once it exists, and until then leave them `{}` and
  finish this step in task 4's commit). `reviewed` is set only for an `es-419` key taken from FloorFifty whose own
  ledger entry (`ff:apps/client/messages/review/es-419.json`) still verifies against FloorFifty's English and Spanish.
  Everything else has no `reviewed`.
- [ ] **Step 6: Write `words/context.json`**: `{ key: { note } }`, one plain line per key saying where the word shows.
- [ ] **Step 7: Run** the test file and `pnpm --filter @automata/framework exec vitest run --project unit tests/unit/app`.
  Then `pnpm --filter @automata/framework build` and confirm the six JSON files are in `dist` at the path
  `publishConfig.exports["./words/*.json"]` names; fix the build's copy step if they are not.
- [ ] **Step 8: Commit** `feat(framework): the default screens' words in six languages` with a `patch` changeset that
  states the measured growth of the built entry in bytes.

### Task 3: `words`: catalogs, CSV and the review ledger (pure)

Port of `ff:tools/i18n/{catalogue,csv,review}.ts`, without plural variants (content catalogs are plain text;
`checkTranslation` refuses anything else).

**Files:**
- Create: `packages/tools/src/shared/words/catalog.ts`, `csv.ts`, `ledger.ts`
- Test: `packages/tools/tests/unit/shared/words/{catalog,csv,ledger}.test.ts`

**Interfaces (produced):**

```ts
// catalog.ts
export type Catalog = Readonly<Record<string, string>>            // without `$schema`
export interface CatalogPaths { readonly name: string; readonly source: string; readonly context: string | undefined
  translation(lang: string): string; ledger(lang: string): string }
/** A game's catalogs: `content` (source `content/generated/messages/<src>.json`, translations
 *  `content/messages/<lang>.json`, ledger `content/messages-review/<lang>.json`) when the source file exists, and
 *  `ui` (`<ui>/<lang>.json`, ledger `<ui>/review/<lang>.json`, context `<ui>/context.json`), where `<ui>` is the
 *  first of `messages/ui` and `src/messages/ui` that holds `<src>.json` (Ember Hall keeps its in `src/`). */
export function gameCatalogs(gameDir: string, sourceLanguage: string): readonly CatalogPaths[]
/** One folder as a catalog: `<dir>/<lang>.json`, `<dir>/review/<lang>.json`, `<dir>/context.json`. */
export function folderCatalog(dir: string, sourceLanguage: string): CatalogPaths
export function placeholders(text: string): string[]             // `{name}` names, sorted, unique; `\{` is not one
export function translationProblems(source: Catalog, translated: Catalog): string[] // missing, not a source key, placeholders differ
// csv.ts
export function toCsv(rows: readonly (readonly string[])[], options?: { bom?: boolean }): string  // RFC 4180, CRLF
export function parseCsv(text: string): string[][]
// ledger.ts
export const ledgerSchema: z.ZodType<Ledger>                     // z.record(z.string(), z.strictObject({ source: hex64, reviewed: hex64.optional() }))
export type Ledger = Readonly<Record<string, { readonly source: string; readonly reviewed?: string }>>
export function sourceHash(source: string): string               // sha256 hex of the English
export function reviewHash(source: string, translation: string): string // sha256 hex of `${source}\u0000${translation}`
export interface WordsState { readonly missing: string[]; readonly changed: string[]; readonly unreviewed: string[] }
export function wordsState(source: Catalog, translated: Catalog, ledger: Ledger): WordsState
```

`wordsState`: `missing` is a source key with no translation; `changed` is a translated key whose ledger `source` is
absent or differs from `sourceHash(current English)`; `unreviewed` is a translated key whose `reviewed` is absent or
differs from `reviewHash`. Each list is sorted. File reads go through the `Files` service the other tools use
(`shared/node/files.ts`), so tests use its fake.

- [ ] **Step 1: Write the failing tests.** Port `ff:tools/i18n` tests' cases where they exist
  (`ff:tools/i18n/*.test.ts` or `ff:tools/tests`); at least:

```ts
// csv
expect(parseCsv('﻿key,source\r\n"a,b","say ""hi"""\r\n\r\n')).toEqual([['key', 'source'], ['a,b', 'say "hi"'], ['']])
expect(parseCsv(toCsv([['k', 'line\nbreak']], { bom: true }))).toEqual([['k', 'line\nbreak']])
// catalog
expect(placeholders('+{count} more \\{x}')).toEqual(['count'])
expect(translationProblems({ a: 'Hi {name}' }, { a: 'Hola', b: 'x' })).toEqual(['a: placeholders (none) are not {name}', 'b: not a source key'])
// ledger
const led = { a: { source: sourceHash('Play'), reviewed: reviewHash('Play', 'Jugar') } }
expect(wordsState({ a: 'Play', b: 'Back' }, { a: 'Jugar' }, led)).toEqual({ missing: ['b'], changed: [], unreviewed: [] })
expect(wordsState({ a: 'Play now' }, { a: 'Jugar' }, led)).toEqual({ missing: [], changed: ['a'], unreviewed: ['a'] })
expect(wordsState({ a: 'Play' }, { a: 'Juega' }, led).unreviewed).toEqual(['a'])
```

- [ ] **Step 2: Run; confirm they fail** on the missing modules.
- [ ] **Step 3: Implement** the three files.
- [ ] **Step 4: Run** `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/shared/words`. Pass.
- [ ] **Step 5: Commit** `feat(tools): message catalogs, CSV and the review ledger for translators`.

### Task 4: `automata words export`, `import`, `status`

Port of `ff:tools/i18n/cli.ts`.

**Files:**
- Create: `packages/tools/src/shared/words/words-args.ts`, `run-words.ts`
- Modify: `packages/tools/src/app/cli.ts` (route `words`), `packages/tools/src/app/help.ts` (`WORDS_HELP`, one line in
  `ROOT_HELP`: `words <command>        Send a game's words to a translator and take them back.`)
- Test: `packages/tools/tests/unit/shared/words/run-words.test.ts`, `packages/tools/tests/unit/app/cli-words.test.ts`

**Interfaces:**
- Consumes: task 3.
- Produces:

```ts
export type WordsCommand =
  | { readonly kind: 'export'; readonly lang: string; readonly out?: string }
  | { readonly kind: 'import'; readonly lang: string; readonly file: string; readonly reviewer?: string }
  | { readonly kind: 'status' } | { readonly kind: 'check' }
export interface WordsOptions { readonly command: WordsCommand; readonly dir: string; readonly catalog?: string; readonly source: string /* default 'en' */ }
export function parseWordsArgs(args: readonly string[]): { ok: true; options: WordsOptions } | { ok: false; problem: string }
/** Exit code: 0 fine, 1 a check found something, 2 a usage or input error. */
export function runWords(options: WordsOptions, io: CliIo): Effect.Effect<number, never, Files>
```

Behaviour:
- `--catalog <dir>` works on that one folder (`folderCatalog`); otherwise on `gameCatalogs(dir)`.
- `export <lang>` writes `words-<lang>.csv` in `dir` (or `--out`), with a BOM, columns
  `catalog,key,source,translation,note,approved`, every source key, in source order.
- `import <lang> <file>` needs the columns `key` and `translation` (and `catalog` when the game has two). An unknown key,
  or a translation whose placeholders differ from the source's, refuses the whole file: nothing is written, exit 2, each
  problem on its own line. Otherwise it writes the translation file (`$schema` first, then keys in source order, two-space
  JSON, a final newline) and the ledger: every imported key gets `source`; a row gets `reviewed` only when its `approved`
  cell is one of `yes, y, x, 1, true` **and** `--reviewer <name>` was given. With approvals and no reviewer: exit 2,
  "say who reviewed these: --reviewer <name>". It prints `<lang>: imported N, M reviewed by <name>`.
- `status` prints, per language found beside the source (plus the six defaults that are absent, as all missing):
  `<lang>: <m> missing, <c> changed, <u> unreviewed`, then the unreviewed keys, indented, all of them. Exit 0.

- [ ] **Step 1: Write the failing tests** over the fake `Files`:

```ts
test('export then import round-trips and records the source hash', …)
test('import refuses an unknown key and writes nothing', …)                      // exit 2, files unchanged
test('import refuses a broken placeholder and writes nothing', …)                // "{count}" dropped
test('approved rows are reviewed only with --reviewer', …)                       // without: exit 2; with: ledger has reviewed
test('status lists every unreviewed key', …)                                     // stdout holds 'ja: 0 missing, 0 changed, 2 unreviewed' and both keys
test('status reads a BOM, CRLF file written by a spreadsheet', …)                // review focus 1 and 2
test('automata words with no command prints its help and exits 2', …)            // cli-words.test.ts
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.** `cli.ts` gets `if (command === 'words') return wordsCommand(rest, io)`, which provides
  `FilesLive` as `checkCommand` does.
- [ ] **Step 4: Finish task 2's ledgers** with `ledgerEntry`-level helpers from task 3, then run
  `node packages/tools/src/app/bin.ts words status --catalog packages/automata/src/app/screens/words` and paste its
  output into the commit body. It must list the drafts as unreviewed.
- [ ] **Step 5: Run** the two test files and `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/app`.
- [ ] **Step 6: Commit** `feat(tools): automata words export, import and status` with a `patch` changeset for
  `@automata/tools` (and the ledger files from task 2).

### Task 5: `automata words check`, and the `words` step of `automata check`

**Files:**
- Create: `packages/tools/src/shared/words/characters.ts`, `words-step.ts`
- Modify: `packages/tools/src/shared/check/run-check.ts` (add `['words', wordsStep]` after `levels`, in
  `NEEDS_SOURCES`), `check-report.ts` (`StepName`), `check-args.ts` (`--only words`), `app/help.ts` (`CHECK_HELP` line:
  `words         every language's words are complete enough to draw: no letter the game's fonts lack`)
- Test: `packages/tools/tests/unit/shared/words/characters.test.ts`, `words-step.test.ts`;
  fixture `packages/tools/tests/fixtures/words-game/` (a `content/fonts.toml`, one small Latin-only font that already
  sits in the repository's test fixtures: find one under `packages/content/tests/fixtures`, do not add a binary)

**Interfaces:**
- Consumes: `fontCoverage(font: Uint8Array): (character: string) => boolean` and `catalogCharacters` from
  `@automata/content` (read `packages/content/src/shared/assets/build-fonts.ts` for how `content/fonts.toml` names
  fonts and the locales each serves; export what is missing from content's Node entry rather than copying it).
- Produces:

```ts
/** Each character of `lang`'s words that none of the fonts serving `lang` can draw, with the key that uses it. */
export function undrawable(words: Catalog, covers: readonly ((c: string) => boolean)[]): { key: string; character: string }[]
export const wordsStep: (gameDir: string) => StepEffect
```

`wordsStep`, per language of the game's catalogs: the words are the game's catalogs plus core's and ui-screens' when the
game has them (resolve `@automata/framework/words/<lang>.json` and `@automata/ui-screens/words/<lang>.json` from
`gameDir` with `createRequire`; a package that does not resolve is skipped). Findings: `translationProblems` (rule
`words-parity`) and each undrawable character (rule `words-font`, message
`U+65E5 "日" in ja "paused_resume" is not in any font that serves ja`). No `content/fonts.toml`: no font findings (the
device's fonts draw the text). No catalogs: no findings. Control characters draw nothing and are skipped.
`automata words check` runs the same function and prints the findings; exit 1 when there are any.

- [ ] **Step 1: Write the failing tests**

```ts
test('a character no font can draw is a finding', …)       // fixture: ja "再開" over a Latin font → rule 'words-font', names U+518D
test('a font that covers the words passes', …)             // en only
test('no fonts.toml: nothing to check', …)
test('a missing key is a words-parity finding', …)
test('automata check runs the words step and exits 1 on a finding', …) // run-check over the fixture, only: 'words'
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/shared`. Pass.
- [ ] **Step 5: Commit** `feat(tools): automata check holds every language's words to the game's fonts`.

### Task 6: The opening sequence and the seen flags (core)

**Files:**
- Create: `packages/automata/src/app/opening/opening.ts`, `seen-flags.ts`
- Modify: `packages/automata/src/app/boot/game-definition.ts` (`GameDefinition.opening`), `app/define-game.ts`
  (`GameSpec.opening`, passed through), `app/boot/boot-program.ts` (run it just before `flowHandle.start`),
  `entries/index.ts` or the entry that exports `ScreenContext` (export the new types)
- Test: `packages/automata/tests/unit/app/opening/{opening,seen-flags}.test.ts`,
  `packages/automata/tests/unit/app/boot/opening-order.test.ts`

**Interfaces (produced):**

```ts
// opening.ts
/** What an opening step is given. `layer` is its own element in the overlay layer, removed when the step ends. */
export interface OpeningContext {
  readonly layer: HTMLElement
  readonly services: Pick<RuntimeServices, 'hosting' | 'locale' | 'settings' | 'audio' | 'clock' | 'bus'>
  readonly seen: SeenFlags
  /** Aborted when the runtime shuts down; a step then resolves at once. */
  readonly signal: AbortSignal
}
/** One step before the first screen: it shows what it wants in `layer` and resolves when the player may go on. */
export type OpeningStep = (context: OpeningContext) => Promise<void>
/** Runs the steps in order. A step that throws is logged through `warn` and skipped: an opening never blocks play. */
export function runOpening(steps: readonly OpeningStep[], context: Omit<OpeningContext, 'layer'>, overlay: HTMLElement, warn: (message: string) => void): Promise<void>
// seen-flags.ts
export const SEEN_KEY = 'automata.seen'
export interface SeenFlags { has(flag: SeenFlag): boolean; mark(flag: SeenFlag): void }
export type SeenFlag = 'language' | 'photosensitivity'
/** Zod-parsed, every field `.catch(false)`. A storage that is absent or throws keeps the flags for the visit only. */
export function createSeenFlags(storage: DeviceStorage | undefined): SeenFlags
```

Boot: `const steps = [...firstRunSteps(game), ...(game.opening ?? [])]` (tasks 7 and 8 add `firstRunSteps`; here it is
the game's `opening` alone), run after the services object is built and before `flowHandle.start(options.startAt)`.
While it runs the sim is paused by reason `'opening'` (`time.pause` / `time.resume`). With `options.startAt` set (a
development restart) the opening is skipped.

- [ ] **Step 1: Write the failing tests**

```ts
test('steps run in order, each in its own layer, removed after', …)
test('a step that throws is skipped and the next still runs', …)        // warn called once
test('an aborted signal ends the opening', …)
test('seen flags survive a new createSeenFlags over the same storage', …)
test('a storage that throws on set still answers has() for this visit', …) // review focus 3
test('garbage in storage reads as nothing seen', …)                     // '{"language":"yes"}' and 'not json'
// opening-order.test.ts, with fakeHosting and a recording step:
test('the opening runs after hosting.ready and before the first screen enters', …) // order: ['ready', 'opening', 'screen:title']
test('a game with no opening boots exactly as before', …)
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @automata/framework exec vitest run --project unit tests/unit/app`. Pass, with no
  existing boot test changed.
- [ ] **Step 5: Commit** `feat(framework): an opening sequence before the first screen` with a `patch` changeset.

### Task 7: First-run language pick

Behaviour reference: `ff:apps/client/src/ui/components/LanguageFirst.svelte`, `LanguagePicker.svelte`.

**Files:**
- Create: `packages/automata/src/app/opening/LanguageFirst.svelte`, `first-run.ts`
- Modify: `app/screens/screens-copy.ts` (add `firstRun` to `ScreensCopy` and English defaults), the six
  `words/*.json`, `words/context.json` and ledgers, `app/define-game.ts` (`firstRunLanguage`), `boot-program.ts`
- Test: `packages/automata/tests/unit/app/opening/language-first.test.ts`,
  `packages/automata/tests/browser/app/language-first.test.ts`

**Interfaces:**
- Consumes: task 6, `endonymOf`, `Locale`.
- Produces:

```ts
// GameSpec
/** The first run asks for a language when the game has more than one. Default true; false never shows the screen. */
readonly firstRunLanguage?: boolean
// ScreensCopy
readonly firstRun: {
  readonly language: { readonly title: string; readonly close: string }                 // 'Language', 'Close'
  readonly warning: { readonly title: string; readonly body: string; readonly choose: string; readonly later: string
    readonly continue: string; readonly close: string }                                 // task 8 fills the words
}
// first-run.ts
export function languageStep(): OpeningStep
export function firstRunSteps(game: { readonly firstRunLanguage?: boolean | undefined; readonly photosensitivity?: PhotosensitivityOption | undefined }): OpeningStep[]
```

The step resolves at once unless call 4's rule holds. The screen: core's `Modal` titled `firstRun.language.title`, one
button per `locale.locales` in order, each labelled `endonymOf(tag)` with `lang={tag}`, `data-testid="first-language-<tag>"`,
at least 48 px high, in a declared scroll region; the detected locale's button has `data-autofocus`. Pressing one calls
`locale.set(tag)`, marks `seen.language` and resolves. Close and Escape mark it and resolve without setting a choice.
The title re-renders in the picked language (it reads `screensCopy`). Arrow keys and a pad move focus through core's
focus model, as on other screens.

- [ ] **Step 1: Write the failing tests**

```ts
// jsdom
test('one locale: the step resolves and shows nothing', …)
test('a Ruken host: skipped even with six locales', …)                    // fakeHosting kind 'ruken'
test('a saved choice: skipped', …)
test('seen: skipped', …)
test('six locales, browser ko: the 한국어 button has focus', …)
test('pressing 日本語 sets the locale, saves it, marks seen and resolves', …) // locale.choice === 'ja'; saves has automata.locale
test('Escape goes on with no choice saved', …)                            // locale.choice === null, seen.language true
test('firstRunLanguage: false never shows it', …)
// real browser, at phone (390×844), compact (780×270) and iPad sizes, in en and xx-long
test('every language button is whole, at least 48 px, and hit-testable; no document scroll', …) // use #src/testing/layout helpers
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.** Add the `firstRun.language` words to the six catalogs (FloorFifty: `settings_language`,
  `shell_close`) and their ledger entries through `automata words import`, not by hand.
- [ ] **Step 4: Run** the unit file, then `pnpm --filter @automata/framework exec vitest run --project browser tests/browser/app/language-first.test.ts`
  (Chromium). Report WebKit and Firefox as not run.
- [ ] **Step 5: Run every journey that boots a multi-language game standalone** and fix the ones that now meet the
  language screen by pressing through it with a shared helper (`passFirstRun(page)` in `@automata/tools/e2e`), never by
  switching the screen off: `pnpm test:browser:2d`, and list the 3D journeys (`games/base-3d`) for task 17.
- [ ] **Step 6: Commit** `feat(framework): the first run asks for a language`.

### Task 8: Photosensitivity warning

Behaviour reference: `ff:apps/client/src/ui/components/PhotosensitivityWarning.svelte`.

**Files:**
- Create: `packages/automata/src/app/opening/PhotosensitivityWarning.svelte`
- Modify: `app/opening/first-run.ts`, `app/define-game.ts` and `boot/game-definition.ts` (`photosensitivity`), the six
  catalogs
- Test: `packages/automata/tests/unit/app/opening/photosensitivity.test.ts`,
  `packages/automata/tests/browser/app/photosensitivity.test.ts`

**Interfaces (produced):**

```ts
/** A switch the warning offers: one of the game's own effect settings. */
export interface WarningSwitch { readonly id: string; readonly label: string | ((locale: string) => string)
  get(): boolean; set(on: boolean): void }
/** `true`: the warning with the device's reduced-motion line. An object adds the game's switches. */
export type PhotosensitivityOption = true | { readonly switches?: readonly WarningSwitch[] }
// GameSpec, beside `rotateHint`
/** The game flashes: the first run on a device warns before anything plays. Absent: no warning. */
readonly photosensitivity?: PhotosensitivityOption
export function warningStep(option: PhotosensitivityOption): OpeningStep
```

Shown when `seen.photosensitivity` is false. A `Modal` titled `firstRun.warning.title`; the body; a group labelled
`choose` with one checkbox row (at least 44 px) per switch, each calling `set` at once; the device's reduced-motion line
(`copy.settings.display.reducedMotion(reduced)`); the `later` line; a primary `continue` button (48 px,
`data-testid="photosensitivity-continue"`, focused). Continue, Close and Escape all mark it seen and resolve; the
switches keep what was set. English words, adapted from FloorFifty so they name no game:

- title: `Photosensitivity warning`
- body: `This game has flashing lights, bright patterns and screen shake. A very small number of people may have a
  seizure when exposed to them, even with no history of epilepsy. If you feel dizzy, see your vision change, or twitch,
  stop playing at once and see a doctor.` (FloorFifty's `photosensitivity_body`, word for word, so its translations apply)
- choose: `Effects`; later: `You can change these at any time in Settings.`; continue: `Continue`; close: `Close`

`firstRunSteps` returns the language step, then the warning step when the option is set.

- [ ] **Step 1: Write the failing tests**

```ts
test('not opted in: no warning step', …)
test('opted in, first run: shown; Continue marks seen and resolves', …)
test('Escape and Close also go on', …)
test('seen: skipped on the next run', …)
test('a switch calls set at once and keeps its value after Continue', …)
test('language first, then the warning, in the language just picked', …) // review focus 4: pick ja, the title is ja's
// real browser, phone, compact and iPad, en and xx-long:
test('the warning fits: body scrolls inside its region, Continue is whole and 48 px, no document scroll', …)
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.** Translations from FloorFifty's `photosensitivity_*` keys, through `automata words import`.
- [ ] **Step 4: Run** the unit file and the browser file in Chromium.
- [ ] **Step 5: Commit** `feat(framework): a photosensitivity warning a game opts into`.

### Task 9: Interface sounds

Port of `ff:apps/client/src/ui/ui-sounds.ts` and its tests (`ff:apps/client/src/ui/ui-sounds.test.ts` if present).

**Files:**
- Create: `packages/automata/src/features/audio/ui-sounds.ts`
- Modify: `features/audio/event-sounds.ts` (export the entry type as `SoundEntry`), `app/define-game.ts` and
  `boot/game-definition.ts` (`uiSounds`), `boot/boot-program.ts` (install on the game root once audio is built)
- Test: `packages/automata/tests/unit/audio/ui-sounds.test.ts`

**Interfaces (produced):**

```ts
/** What counts as a control. */
export const UI_CONTROL = "button, a[href], [role='button'], select, input:not([type='range']):not([type='text'])"
export const UI_SOUND_NAMES = ['press', 'back', 'focus', 'open', 'close', 'error'] as const
/** Sound name → the asset it plays (or `{ alias, gain }`), always on the `ui` bus; or one function that plays a name. */
export type UiSounds = Readonly<Record<string, string | { readonly alias: string; readonly gain?: number }>> | ((name: string) => void)
/** Asks for a sound from inside a component with no press behind it (an error arriving). Bubbles to the root. */
export function requestUiSound(from: Element, name: string): void          // CustomEvent 'automata-sfx'
export function installUiSounds(root: HTMLElement, audio: Pick<Audio, 'sound'>, sounds: UiSounds, now?: () => number): () => void
// GameSpec, beside `sounds`
/** The interface's sounds by name. Absent: silent. `data-sfx="back"`, `"none"` or a name of the game's on a control. */
readonly uiSounds?: UiSounds
```

Rules (FloorFifty's, with its constants): listeners on `root` in the capture phase, passive. A click on an enabled
`UI_CONTROL` plays `data-sfx`'s name when the map has it, nothing for `none`, else `press`. Focus moving to a control by
keyboard, pad or mouse hover plays `focus` at half gain (unless the entry sets a gain), never within 90 ms of the last,
never within 400 ms after a pointer press (the press brought the focus), never within 250 ms after a scroll or wheel,
never for a touch pointer. `open` and `close` requests also start the 400 ms quiet. A name the map lacks plays nothing.
Everything plays through `audio.sound(alias, { bus: 'ui', gain })`, so the interface volume and mute apply.

- [ ] **Step 1: Write the failing tests** with an injected `now` and a recording `audio`:

```ts
test('a button with no attribute plays press on the ui bus', …)   // [['press.wav', { bus: 'ui' }]]
test('data-sfx="back" plays back; "none" plays nothing; a disabled button plays nothing', …)
test('a game name on data-sfx plays the game’s sound', …)         // data-sfx="coin"
test('no map entry: silent', …)                                   // sounds = {}
test('keyboard focus ticks at half gain', …)
test('a held arrow: ten focus moves in 300 ms make at most four ticks', …) // review focus 5
test('focus within 400 ms of a pointer press does not tick', …)
test('a touch pointer never ticks', …)
test('requestUiSound("error") plays error', …)
test('a function map is called with the name', …)
test('the returned function removes every listener', …)
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement,** and wire boot: `if (game.uiSounds !== undefined) owned.add(installUiSounds(game.root, audio, game.uiSounds))`.
  Mark core's own leaving controls with `data-sfx="back"` (Back, Close, Cancel, "Keep playing") and the mute toggle with
  `data-sfx="none"`; add a DOM test per screen that the attribute is there.
- [ ] **Step 4: Run** `pnpm --filter @automata/framework exec vitest run --project unit tests/unit/audio tests/unit/app`.
- [ ] **Step 5: Commit** `feat(framework): every control sounds by default once a game maps the sounds`.

### Task 10: `create-game` maps a starter set of interface sounds

**Files:**
- Modify: `packages/tools/src/shared/create-game/template-game.ts` (the `src/app/feel-audio.ts` and game-definition
  templates), `packages/tools/src/shared/create-game/template-content/audio/` (the template's `audio.toml`)
- Test: `packages/tools/tests/unit/shared/create-game/` (the existing template tests; add
  `template-ui-sounds.test.ts`)

**Interfaces:**
- Consumes: `GameSpec.uiSounds` as a function (task 9); the template's `sounds?.cue(name)` (`AudioStageHandle`).
- Produces: a new game whose `defineGame` has `uiSounds: (name) => void sounds?.cue(`ui.${name}`)` (exported from
  `feel-audio.ts` as `uiSounds`), and three cues in the template's `audio.toml`, written in the form of the cues already
  there so the Audio editor opens and changes them:
  - `ui.press`: a short square blip, 660 Hz, 60 ms
  - `ui.back`: a falling blip, 440 Hz to 330 Hz, 80 ms
  - `ui.focus`: a tick, 880 Hz, 25 ms, half the level of `ui.press`

- [ ] **Step 1: Write the failing test:** the generated game's files hold `uiSounds` in the `defineGame` call, and its
  `content/audio/audio.toml` parses with `audioSchema` and has the cues `ui.press`, `ui.back` and `ui.focus`.
- [ ] **Step 2: Run; confirm it fails.**
- [ ] **Step 3: Implement.** `packages/tools` may not import `@automata/audio-synth` (it is template text and a
  test-only parse; if the test needs the schema, put the test where the existing template-content tests parse it).
- [ ] **Step 4: Run** `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/shared/create-game`, and the
  slow created-game test by hand if the session has time (`packages/tools/tests/slow`); say which ran.
- [ ] **Step 5: Commit** `feat(tools): a new game's buttons sound, from sounds the Audio editor can change`.

### Task 11: Splash (`@automata/ui-screens`)

Behaviour reference: `ff:apps/client/src/ui/components/SplashRoot.svelte` (the hold, any press goes on, the reduced-motion
rule). Its wordmark, art, progress bar and `StudioLogo.svelte` are FloorFifty's and are not copied.

**Files:**
- Create: `extensions/ui-screens/src/features/splash/SplashScreen.svelte`, `splash-step.ts`, `splash-copy.ts`,
  `extensions/ui-screens/src/features/words/{en,ja,ko,es-419,pt-BR,zh-Hans}.json`, `words/context.json`,
  `words/review/<lang>.json`, `words/screens-words.ts`, `extensions/ui-screens/src/entries/splash.ts`
- Modify: `extensions/ui-screens/src/entries/index.ts`, `package.json` (exports `./splash`, `./words/*.json`), `README.md`
- Test: `extensions/ui-screens/tests/unit/splash/splash-screen.test.ts`,
  `extensions/ui-screens/tests/browser/splash/splash-screen.test.ts`; extend `tests/unit/screens/*.test.ts` lists

**Interfaces:**
- Consumes: `OpeningStep`, `OpeningContext` from `@automata/framework` (task 6); `DEFAULT_LOCALES`.
- Produces:

```ts
export interface SplashCopy { readonly skip: string }               // en: 'Press any key or tap to skip'
export interface SplashOptions {
  readonly logo: { readonly src: string; readonly alt: string }      // the studio's image, the game's own file
  readonly holdMs?: number                                           // default 1500
  readonly copy?: SplashCopy | ((locale: string) => SplashCopy)      // default: this package's words in the locale
}
/** An opening step: the logo, held `holdMs` on the runtime's clock, ended early by any key, click or tap. */
export function splashStep(options: SplashOptions): OpeningStep
/** This package's words for a locale (the six, English otherwise): `{ splash: SplashCopy, credits: CreditsCopy }`. */
export function screensWords(locale: string): { readonly splash: SplashCopy; readonly credits: CreditsCopy }
```

`SplashScreen.svelte` props: `logo`, `copy`, `onDone`. The image is centred, at most 60% of the shorter side; the skip
line is under it; with reduced motion there is no fade. The step uses `context.services.clock` for the hold, never
`setTimeout`, and resolves once, on whichever comes first (the hold, a press, the abort signal). It plays no sound.
The screen folder reaches only `@automata/framework` and `svelte` (the package's copy-in rule); the words folder is
its own feature.

- [ ] **Step 1: Write the failing tests**

```ts
test('resolves after holdMs on the injected clock, not before', …)      // advance 1499: pending; 1: resolved
test('a keydown, a pointerdown and a click each end it early', …)
test('resolves once when a press and the timer both fire', …)
test('the logo has the alt text; the skip line is the copy’s', …)
test('an aborted signal resolves it and removes the screen', …)
test('the default words follow the locale', …)                           // ja → screensWords('ja').splash.skip
// real browser: phone, compact, iPad; en and xx-long
test('the logo and the line fit with no document scroll', …)
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.** Words: `shell_tap_to_start` and `shell_press_to_start` do not mean "skip", so draft all five
  translations and record them unreviewed with `automata words import --catalog extensions/ui-screens/src/features/words`.
- [ ] **Step 4: Run** `pnpm --filter @automata/ui-screens test:unit` and `test:browser` (Chromium).
- [ ] **Step 5: Commit** `feat(ui-screens): a studio splash as an opening step` with a `patch` changeset.

### Task 12: Credits (`@automata/ui-screens`)

Behaviour reference: `ff:apps/client/src/ui/components/CreditsPanel.svelte`, `ff:apps/client/src/common/credits.ts`.
FloorFifty's privacy note is the game's own and is not part of this panel.

**Files:**
- Create: `extensions/ui-screens/src/features/credits/CreditsPanel.svelte`, `credits.schema.ts`, `credits.content.ts`,
  `credits-copy.ts`, `extensions/ui-screens/src/entries/credits.ts`
- Modify: `entries/index.ts`, `package.json` (export `./credits`), the six words files, `README.md`
- Test: `extensions/ui-screens/tests/unit/credits/{credits-schema,credits-panel}.test.ts`,
  `extensions/ui-screens/tests/browser/credits/credits-panel.test.ts`

**Interfaces (produced):**

```ts
// credits.schema.ts
export interface CreditName { readonly name: string; readonly role?: string; readonly url?: string }
export interface CreditsSection { readonly title: string; readonly names: readonly CreditName[] }
export interface Credits { readonly sections: readonly CreditsSection[] }
/** Strict. `title` and `role` are text a translator sees; `url` must be `https:`. At least one section, one name each. */
export const creditsSchema: z.ZodType<Credits>
export const creditsSchemaWith: (text: z.ZodType<string, string>) => z.ZodType<Credits>
// credits.content.ts, in the form of extensions/feel/src/features/frame/feel.content.ts
/** The `credits` content kind: `content/credits/credits.toml`; section titles and roles are `localized()`. */
export const creditsContent: ContentSchemaDef<'credits', z.ZodType<Credits>>
// credits-copy.ts
export interface CreditsCopy { readonly title: string; readonly close: string; readonly opens: (name: string) => string }
// en: 'Credits', 'Close', 'Open {name}’s page'
```

`CreditsPanel.svelte` props: `credits: Credits`, `copy: CreditsCopy`, `onClose: () => void`,
`onOpenLink?: (url: string) => void`, `text?: (section: number, name: number | undefined, authored: string) => string`
(the game's content-text lookup for translated titles and roles; default returns `authored`). It is core's `Modal` with
one `ScrollList` (the declared scroll region) of sections: a heading, then each name with its role. A name with a `url`
is a button (at least 44 px, `aria-label` from `copy.opens`) only when `onOpenLink` is given; otherwise plain text. The
panel never opens a window or sets `location` itself (call 11). Close has `data-sfx="back"`.

- [ ] **Step 1: Write the failing tests**

```ts
// schema
expect(creditsSchema.safeParse({ sections: [] }).success).toBe(false)
expect(creditsSchema.safeParse({ sections: [{ title: 'Game', names: [{ name: 'A', url: 'http://x.test' }] }] }).success).toBe(false) // https only
expect(creditsSchema.safeParse({ sections: [{ title: 'Game', names: [{ name: 'A', extra: 1 }] }] }).success).toBe(false)           // strict
expect(creditsSchema.parse({ sections: [{ title: 'Game', names: [{ name: 'A', role: 'Design', url: 'https://x.test' }] }] }).sections[0].names[0].role).toBe('Design')
// panel (jsdom)
test('sections and names render in the order given', …)
test('a link with a handler is a button that calls onOpenLink with the url', …)
test('a link with no handler is plain text: no button, no anchor', …)
test('Escape and Close call onClose', …)
// real browser: phone, compact, iPad; en and xx-long; forty names
test('the list scrolls inside the panel; Close stays whole and hit-testable; no document scroll', …)
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.** Words: `title` from FloorFifty's `title_credits`, `close` from `shell_close`; draft `opens`.
- [ ] **Step 4: Run** `pnpm --filter @automata/ui-screens test:unit` and `test:browser` (Chromium), and the package's
  screens-rule and copy-in tests.
- [ ] **Step 5: Commit** `feat(ui-screens): a credits panel drawn from a content file`.

### Task 13: Achievements in `ruken.toml` and `automata check`

Behaviour reference: `ff:apps/client/src/ruken/score-boards.ts`; `@ruken/manifest` (`vendor/ruken/ruken-manifest-0.0.0.tgz`).

**Files:**
- Modify: `packages/content/src/shared/game/game-config.schema.ts`,
  `packages/tools/src/shared/ship/targets/ruken/ruken-toml.ts`,
  `packages/tools/src/shared/check/check-source-steps.ts` (new `achievementsStep`), `run-check.ts`, `check-report.ts`,
  `check-args.ts`, `app/help.ts`
- Test: `packages/content/tests/unit/shared/game/game-config.schema.test.ts` (and its Ruken conformance cases),
  `packages/tools/tests/unit/shared/ship/` (the `ruken-toml` test), `packages/tools/tests/unit/shared/check/achievements-step.test.ts`

**Interfaces (produced):**

```ts
// game-config.schema.ts: shapes only, no limits (Ruken's parser is the judge)
export type AchievementConfig = { readonly title: string; readonly description?: string; readonly board: string } &
  ({ readonly reach: number } | { readonly top_percent: number } | { readonly top_rank: number })
// GameConfig
readonly achievements?: Readonly<Record<string, AchievementConfig>>
// check-source-steps.ts
export const achievementsStep: (gameDir: string) => StepEffect
```

- The Zod schema is a union of three strict objects (exactly one rule key), each with `title`, optional `description`
  and `board`. It holds no length, count or percent limit.
- `rukenToml` writes, after the boards and sorted by id, `[achievements."<id>"]` with `title`, `description` when set,
  `board`, and the one rule key. A board's `title` is written too when set (it is in the schema and was not written).
- `achievementsStep` reads `ship.config.ts` as the `boards` step does, builds the manifest text with `rukenToml` and
  parses it with `parseManifest`. Each error whose code starts `ACHIEVEMENT_` or `LEADERBOARD_TITLE` becomes a finding
  in plain words, with Ruken's own message after it:

  | Code | Finding starts |
  |---|---|
  | `ACHIEVEMENT_ID_INVALID` | `achievement "<id>": the id must be lowercase letters, digits and hyphens.` |
  | `ACHIEVEMENT_BOARD_UNKNOWN` | `achievement "<id>": its board is not one of this game's leaderboards.` |
  | `ACHIEVEMENT_RULE_INVALID` | `achievement "<id>": it needs exactly one rule: reach, top_percent or top_rank.` |
  | `ACHIEVEMENT_TEXT_INVALID` | `achievement "<id>": its title or description is empty or too long.` |
  | `ACHIEVEMENT_LIMIT` | `this game declares more achievements than Ruken allows.` |

  No `ship.config.ts`, or no achievements: no findings. The step is named `achievements`, runs after `boards`, and
  `CHECK_HELP` gains `achievements  every achievement is one Ruken will accept`.
- The `itch`, `web` and `tauri` targets ignore the table; add one assertion to each target's prepare test that a config
  with achievements prepares as before.
- Titles and descriptions reach the words workflow as a third game catalog, `achievements`, whose source is derived
  from `ship.config.ts` (`achievement_<id>_title`, `achievement_<id>_description`) and whose translations are
  `messages/achievements/<lang>.json`. Ruken's manifest takes one language today, so the manifest carries the source
  text; the translations are kept for when it takes more. Add this to `gameCatalogs` with a test.

- [ ] **Step 1: Write the failing tests**

```ts
// ruken-toml
expect(rukenToml(configWith({ leaderboards: { best: { order: 'desc', min: 0, max: 999, title: 'Best score' } },
  achievements: { 'score-20': { title: 'Twenty', description: 'Score 20.', board: 'best', reach: 20 },
                  'top-ten': { title: 'Top 10%', board: 'best', top_percent: 10 } } })))
  .toContain('[achievements."score-20"]\ntitle = "Twenty"\ndescription = "Score 20."\nboard = "best"\nreach = 20\n')
test('the manifest with achievements parses with Ruken’s own parser', …) // manifestOf(toml).achievements has both
test('a config with no achievements writes the same text as before', …) // snapshot of the existing fixture unchanged
// schema
test('two rules on one achievement are refused', …); test('no rule is refused', …)
// step
test('an unknown board is a finding in plain words', …) // message starts 'achievement "x": its board is not one of this game’s leaderboards.'
test('a title of 49 characters is a finding, by Ruken’s rule, not ours', …)
test('no ship.config.ts: no findings', …)
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @automata/content exec vitest run --project unit tests/unit/shared/game` and
  `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/shared`.
- [ ] **Step 5: Commit** `feat(tools): a game declares Ruken achievements beside its leaderboards` with `patch` changesets
  for `@automata/content` and `@automata/tools`.

### Task 14: Stale-build check

Behaviour reference: `ff:apps/client/src/managers/boot-version-check.ts`.

**Files:**
- Modify: `extensions/net-server/src/features/operations/probes.ts` (`ProbeState.version`, `GET /version`), and where
  `installProbes` is called in `extensions/net-server/src/app/start-server.ts` (pass the server's `GameVersion`)
- Create: `extensions/net/src/features/client/version/check-server-version.ts`,
  `extensions/net-ui/src/features/stale/stale-build-step.ts`, `StaleBuild.svelte`, `stale-copy.ts`
- Modify: `extensions/net/src/entries/index.ts`, `extensions/net-ui/src/entries/index.ts`, `extensions/net/README.md`,
  `extensions/net-server/README.md`
- Test: `extensions/net-server/tests/unit/operations/probes.test.ts` (add cases),
  `extensions/net/tests/unit/client/version/check-server-version.test.ts`,
  `extensions/net-ui/tests/unit/stale/stale-build-step.test.ts`, `extensions/net-ui/tests/browser/stale/stale-build.test.ts`

**Interfaces (produced):**

```ts
// net-server probes.ts
export interface ProbeState { …; readonly version?: (() => GameVersion | undefined) | undefined }
// GET /version → 200 { protocol, schemaHash, contentHash } with PROBE_HEADERS; 503 {} before the content has loaded
// net check-server-version.ts
export interface BuildFacts { readonly protocol: number; readonly schemaHash: string; readonly contentHash: string }
export const buildFactsSchema: z.ZodType<BuildFacts>
/** `stale` only when the server answered readable facts that differ. A throw, a bad shape, a 503: `current`. */
export function checkServerVersion(fetchFacts: () => Promise<unknown>, own: BuildFacts): Promise<'current' | 'stale'>
// net-ui stale-build-step.ts
export interface StaleCopy { readonly message: string; readonly reload: string } // en: 'This game was updated. Reload to get the new version.', 'Reload'
export interface StaleBuildOptions {
  readonly facts: BuildFacts
  readonly fetchFacts: () => Promise<unknown>            // the game's own fetch of `<server>/version`
  readonly waitMs?: number                               // default 1500, on the runtime's clock
  readonly reload?: () => void                           // default: reload the document
  readonly copy?: StaleCopy | ((locale: string) => StaleCopy)
}
/** An opening step. Current, unreadable or slower than `waitMs`: resolves. Stale: shows the error and Reload, and stays. */
export function staleBuildStep(options: StaleBuildOptions): OpeningStep
```

`StaleBuild.svelte` is core's `ErrorPanel` with code `stale-build`, the message and one primary action `reload`. The
step never resolves while the stale panel shows, so the title of a stale tab is never reached; Reload is its way
forward. The join check stays the authority (`refuseStaleVersion` is untouched). The six languages of `StaleCopy` are
this package's own catalog (`extensions/net-ui/src/features/words/`), drafted and unreviewed: FloorFifty's
`error_version_mismatch` names its game and is not taken.

- [ ] **Step 1: Write the failing tests**

```ts
// probes
test('GET /version answers the server’s version, uncached', …)     // 200, body equals version, cache-control no-store
test('GET /version before the content loaded is 503', …)
test('/health still carries no build facts', …)                     // body is exactly { ok: true }
// check-server-version
expect(await checkServerVersion(async () => own, own)).toBe('current')
expect(await checkServerVersion(async () => ({ ...own, contentHash: 'ffffffffffffffff' }), own)).toBe('stale')
expect(await checkServerVersion(async () => { throw new Error('offline') }, own)).toBe('current')
expect(await checkServerVersion(async () => ({ protocol: 'x' }), own)).toBe('current')
// step (jsdom, fake clock)
test('current: resolves and shows nothing', …)
test('stale: shows the message and Reload, and does not resolve', …)
test('Reload calls reload', …)
test('no answer within 1500 ms: resolves', …)
// real browser, phone and compact: the panel fits, Reload is whole and 48 px, focused
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.** In `extensions/net/README.md` add a "Tell a player their tab is out of date" section with the
  three lines a game writes; in `extensions/net-server/README.md` add `GET /version` to the routes.
- [ ] **Step 4: Run** `test:unit` in the three packages and net-ui's `test:browser` (Chromium).
- [ ] **Step 5: Commit** `feat(net): an online game says its tab is out of date before the title` with `patch` changesets
  for `@automata/net`, `@automata/net-server` and `@automata/net-ui`.

### Task 15: The four examples and their journeys

**Files:**
- Create: `examples/2d/core/core-languages.ts`, `examples/2d/core/core-first-run.ts`,
  `examples/2d/audio/audio-ui-sounds.ts`, `examples/2d/ui/ui-splash-credits.ts`,
  `examples/2d/resources/sounds/{ui-press,ui-back,ui-focus}.wav` and a line each in `PROVENANCE.md`,
  `examples/2d/resources/logo/studio.svg` (a plain placeholder mark drawn for this repository: a circle and the word
  "Studio", DUEL palette, in `PROVENANCE.md`),
  `examples/2d/tests/e2e/{core-languages,core-first-run,audio-ui-sounds,ui-splash-credits}.test.ts`
- Modify: `examples/2d/package.json` (add `@automata/ui-screens`), `examples/2d/playwright.config.ts` (a third project,
  `examples-ipad`, `use: { ...sizes.ipad, deviceScaleFactor: 1 }`, same `testDir` and ignore), `examples/README.md`
  (four rows)

Each file opens with the header the catalog checks (`// <module>-<name>: <title>`, `Shows`, `Controls`, `Packages`,
`Difficulty`, `Tier`; no `Golden`, since none has a sim worth replaying beyond a still field). The synthesized sounds are
made the way `chime.wav` was (`resources/sounds/PROVENANCE.md` says how); they are examples' own, not FloorFifty's.

| File | Title line | What it does |
|---|---|---|
| `core-languages.ts` | `core-languages: The menus in six languages` | `locale: { locales: [...DEFAULT_LOCALES], baseLocale: 'en' }`, `firstRunLanguage: false`, default screens. `Tier: core` |
| `core-first-run.ts` | `core-first-run: A first run asks for a language and warns about flashing` | six locales, `photosensitivity: { switches: [one in-memory "Flashing" switch] }`. `Host:` set so the fake host is not Ruken-kind for the locale rule; if the examples' fake host is always `ruken`, add a header-free way in this file: pass `hosting: { … }` the standalone kind the example runner supports, and say so in the file's comment. `Tier: core` |
| `audio-ui-sounds.ts` | `audio-ui-sounds: Buttons that sound, a Back that sounds different, one that stays silent` | `uiSounds: { press, back, focus }` from the three files; a `title.actions`-free page: default screens, whose Back and mute already carry `data-sfx`. `Tier: core` |
| `ui-splash-credits.ts` | `ui-splash-credits: A studio splash, then a title with Credits` | `opening: [splashStep({ logo })]`, custom `screens` with `@automata/ui-screens`' Title (`extra: [{ id: 'credits', … }]`) that opens `CreditsPanel` over inline credits parsed by `creditsSchema`. `Tier: extension` |

- [ ] **Step 1: Write the four journeys first** (they fail: the pages do not exist). Each uses `openHosted` and
  `collectErrors` as `default-screens.test.ts` does, and ends with `expect(errors).toEqual([])`.

```ts
// core-languages
//  title → play → pause → Settings; pick 日本語 (data-testid of the Language group’s option); the Settings title is ja’s
//  word from @automata/framework/words/ja.json; reload the page; the title screen’s Play is still ja’s.
// core-first-run
//  first load: first-language-ko is visible; press first-language-ja; the warning’s title is ja’s; toggle the switch;
//  press photosensitivity-continue; title-screen is visible and Play is focused.
//  reload: title-screen is visible with no first-run screen (assert neither test id is attached).
// audio-ui-sounds
//  the page counts plays in `window.__uiSounds` (the example wraps its map in a function that records the name, then plays).
//  click Play → ['press']; Pause, then Back/Resume marked data-sfx="back" → 'back' recorded; the mute toggle → nothing new.
// ui-splash-credits
//  the splash logo is visible with its alt text; a tap ends it; title-screen shows; press Credits; the panel lists the
//  names; Escape closes it and focus is back on Credits.
```

  Read the words the journeys compare against from the catalogs; never write a translation into a test by hand.
- [ ] **Step 2: Run** `pnpm --filter @af-examples/examples-2d test:e2e --project examples -g "core-languages|core-first-run|audio-ui-sounds|ui-splash-credits" -- --trace off`; confirm the four fail for the missing page.
- [ ] **Step 3: Write the four examples.**
- [ ] **Step 4: Run** the same command for `examples`, `examples-compact` and `examples-ipad`; then the catalog and
  smoke tests (`examples.test.ts`) and `pnpm --filter @af-examples/examples-2d typecheck`. All pass in Chromium.
- [ ] **Step 5: Commit** `feat(examples): languages, a first run, interface sounds, and a splash with credits`.

### Task 16: Emberwick in six languages, with an achievement

**Files:**
- Create: `games/emberwick/messages/ui/{en,ja,ko,es-419,pt-BR,zh-Hans}.json`, `games/emberwick/messages/ui/context.json`,
  `games/emberwick/messages/ui/review/<lang>.json`, `games/emberwick/src/features/screens/words.ts`
- Modify: `games/emberwick/src/features/screens/emberwick-screens.ts` (panels from words, re-drawn on a language
  change; the end screen submits the round's time), `src/app/make-game.ts` (`locale`, `hosting.wants`),
  `ship.config.ts` (`content.languages`, `leaderboards`, `achievements`), `style.css` (a system font fallback for
  Japanese, Korean and Chinese), `playwright.config.ts`
- Test: `games/emberwick/tests/unit/screens/words.test.ts`, `tests/unit/ship-config.test.ts` (add cases),
  `tests/e2e/emberwick-languages.test.ts`

**Interfaces:**
- `words.ts`: `emberwickWords(locale: string): EmberwickWords`, where `EmberwickWords` has one field per string in today's
  `PANELS` (`splashHint`, `menuTitle`, `menuHint`, `play`, `keysMove`, `keysJump`, `keysPause`, `pause`, `pausedTitle`,
  `resume`, `backToMenu`, `endTitle`, `playAgain`, `menu`, and the time line as `time: (seconds: string) => string`).
  It reads the six JSON files (static imports) and matches the locale with `matchLocale`.
- `make-game.ts`: `locale: { locales: [...DEFAULT_LOCALES], baseLocale: 'en' }`, `firstRunLanguage` left at its default,
  `hosting: { wants: ['menu', 'leaderboards'] }`.
- `ship.config.ts`: `content.languages` the six; `leaderboards: { fastest: { order: 'asc', min: 1000, max: 3_600_000,
  title: 'Fastest climb' } }`; `achievements: { 'ember-in-a-minute': { title: 'Ember in a minute', description: 'Reach
  the ember in under 60 seconds.', board: 'fastest', reach: 60_000 } }`.
- The end screen submits `Math.round(seconds * 1000)` to `fastest` through `services.leaderboards` (read
  `features/leaderboards/leaderboards.manager.ts` for the call). The sim and `GoalReached` are not touched: no hash and
  no golden may move, and `pnpm --filter @af-games/emberwick test:unit` proves it.

- [ ] **Step 1: Write the failing tests**

```ts
test.each(DEFAULT_LOCALES)('%s has every word, with the time placeholder kept', …)
test('the manifest carries the achievement', () => {
  const manifest = manifestOf(rukenToml(config))
  expect(manifest.achievements?.['ember-in-a-minute']).toEqual({ title: 'Ember in a minute',
    description: 'Reach the ember in under 60 seconds.', board: 'fastest', reach: 60_000 })
})
// journey, one Playwright project per language (`use: { locale: '<tag>' }`), phone size:
//  pass the first-run screen with the detected language; the menu’s Play reads the catalog’s word for that language;
//  play, pause: the paused title and Resume read the catalog’s words; quit to menu.
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.** Move the English out of `PANELS` into `messages/ui/en.json` and build the panels from
  `emberwickWords(services.locale.current)`; subscribe to the locale for as long as the screen is open and redraw the
  words in place (set `textContent`, never rebuild the panel, so focus stays). Text goes in with `textContent`.
- [ ] **Step 4: Translate through the workflow,** as a translator would: `automata words export ja` (and the other
  four) in `games/emberwick`, fill the CSVs (FloorFifty's text where the task 2 rule matches: Play, Paused, Resume;
  drafts otherwise), `automata words import <lang> words-<lang>.csv`, then `automata words status`. Paste the status
  output into the commit body. Do not commit the CSVs.
- [ ] **Step 5: Run** `pnpm --filter @af-games/emberwick check`, `automata check` in the game's folder (the `words`,
  `boards` and `achievements` steps pass), and `pnpm --filter @af-games/emberwick test:e2e -- --trace off` in Chromium:
  the existing journeys and the six language projects.
- [ ] **Step 6: Commit** `feat(emberwick): six languages through the translator's workflow, and an achievement`.

### Task 17: Ember Hall (`games/base-3d`) in six languages

Ember Hall already has Paraglide, its catalog at `src/messages/ui/{locale}.json` and core's default screens, so core's
menus translate with no work. This task translates its own few words.

**Files:**
- Create: `games/base-3d/src/messages/ui/{ja,ko,es-419,pt-BR,zh-Hans}.json`, `src/messages/ui/review/<lang>.json`,
  `src/messages/ui/context.json`; `games/base-3d/content/messages/<lang>.json` if its content has localized text
- Modify: `games/base-3d/ship.config.ts` (`content.languages`), the content's language list where it is declared
  (find it from `languagesOf` in `packages/content/src/shared/compile/compile-content.ts`), its journeys' first-run helper
- Test: `games/base-3d/tests/unit/` (a `words.test.ts`: every language has exactly the source keys and placeholders, by
  `translationProblems`)

- [ ] **Step 1: Write the failing test.**
- [ ] **Step 2: Run; confirm it fails** on the missing files.
- [ ] **Step 3: Translate through the workflow** (`automata words export|import|status` in `games/base-3d`), as in task 16.
- [ ] **Step 4: Run** `pnpm --filter @af-games/base-3d test:unit` and `automata check --only words` there. The game's
  browser suites and journeys are the 3D workflow's: run them if this machine can (`pnpm ci:local`), and otherwise report
  them as not run, with the helper change described.
- [ ] **Step 5: Commit** `feat(base-3d): Ember Hall's words in six languages`.

### Task 18: Guides, API report and index, changesets, final gates

**Files:**
- Modify: `docs/guides/publish-to-ruken.md` (an "Achievements" section: declare them beside `leaderboards`, one rule
  each, Ruken awards them, `automata check` says what is wrong), `docs/guides/how-it-works.md` or `docs/guides/index.md`
  (a "Languages" section: the six, `automata words`, the ledger, what unreviewed means; and "The first run": language,
  warning, splash), `docs/cheatsheet.md` and the agent package's API reference (written by `pnpm api-index --write`),
  `tooling/api-report/reports/*.api.md` (written by `pnpm api-report --update`), `docs/status.md`,
  `docs/refactor/progress.md` (one line pointing at this workstream), `docs/superpowers/progress.md`

- [ ] **Step 1:** `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`, `pnpm agent-skills`. Read each diff:
  every new export has a doc comment a first-time author can follow.
- [ ] **Step 2:** `pnpm format`, then `pnpm check`. Fix what it finds (`knip` on unused exports, `check-changesets` on a
  published package with no changeset).
- [ ] **Step 3:** `pnpm test:browser:2d` and the examples' and Emberwick's journeys in Chromium, `--trace off`.
- [ ] **Step 4: Check "Done means" line by line** and write the result in `docs/superpowers/progress.md`:
  - the four examples' journeys pass at phone, compact and iPad sizes (which projects, which commit);
  - Emberwick's journeys pass in each of the six languages; its manifest carries the achievement (the unit test's name);
  - `automata words status` prints the unreviewed list (paste the counts per language for core, ui-screens, net-ui,
    Emberwick and Ember Hall); `automata check` fails on a character a font cannot draw (the test's name);
  - `pnpm check` passes; API reports and the index are updated; changesets are written (list them);
  - not run here: WebKit, Firefox, real devices, the 3D workflow if so. These are the Owner's.
- [ ] **Step 5: Commit** `docs: shared polish, the guides, the API index and the record`, push, and report the commit to
  the coordinator.

---

## Self-review (done when the plan was written)

- **Spec coverage:** item 1 → tasks 1 to 5, 16, 17; item 2 → 6, 7; item 3 → 6, 8; item 4 → 9, 10; item 5 → 11, 12;
  item 6 → 13, 16; item 7 → 14; the four examples → 15; "Done means" → 18. The spec's "left to the builder" list is
  calls 1, 2, 8, 9 and 10. The website needs no code (the spec says so); the Owner's question about
  `automata-website` stays open in the tracker.
- **Names used across tasks:** `OpeningStep`, `OpeningContext`, `SeenFlags` (6) are consumed by 7, 8, 11 and 14;
  `DEFAULT_LOCALES` (1) by 2, 15, 16; `Catalog`, `translationProblems`, `wordsState` (3) by 4, 5, 17; `UiSounds` (9) by
  10 and 15; `creditsSchema`, `CreditsCopy` (12) by 11's `screensWords` and by 15.
- **Not verified while planning** (the executor checks first and stops if wrong): the package build copies JSON into
  `dist` (task 2, step 7); the examples' fake host kind for the language rule (task 15); the form of a cue in the
  template's `audio.toml` (task 10); a Latin-only font already among content's test fixtures (task 5).
