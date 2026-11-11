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
 *  `content/messages/<lang>.json`, ledger `messages/review/content/<lang>.json`) when the source file exists, and
 *  `ui` (`messages/ui/<lang>.json`, ledger `messages/review/ui/<lang>.json`, context `messages/context.json`) when
 *  `messages/ui/<src>.json` exists. */
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
