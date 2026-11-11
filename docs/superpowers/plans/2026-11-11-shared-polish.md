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
`ff:` are under that clone. **Nothing is copied from FloorFifty**: no code, no tests, no translations, no branding, no
art (the Owner, 2026-11-11). Read a cited file to learn how the thing behaves, close it, and write the framework's own.

## Tracking

Update this table and the workstream row in `../progress.md` in the same commit as each task.
**Progress: 0 of 20 tasks (0%).**

| # | Task | Item | State | Commit |
|---|---|---|---|---|
| 1 | The six languages as data, and the negotiation rules pinned | 1 | todo | |
| 2 | Core's menu words as catalogs in six languages | 1 | todo | |
| 3 | `words`: catalogs, CSV and the source stamps (pure) | 1 | todo | |
| 4 | `automata words export`, `import`, `status` | 1 | todo | |
| 5 | `automata words check`, and the `words` step of `automata check` | 1 | todo | |
| 5b | Fonts: the font build cuts to every word a game shows; the pixel font set | 1 | todo | |
| 6 | The opening sequence and the seen flags (core) | 2, 3 | todo | |
| 7 | First-run language pick | 2 | todo | |
| 8 | Photosensitivity warning | 3 | todo | |
| 9 | Interface sounds | 4 | todo | |
| 10 | `create-game`: starter interface sounds, the six languages and the font set | 1, 4 | todo | |
| 11 | Splash (`@automata/ui-screens`) | 5 | todo | |
| 11b | `Hosting.openLink` on every target | 5 | todo | |
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
- Translations are written new for the framework's own strings and shipped. There is no review state, no reviewer
  and no ledger of approvals; the workflow knows only *missing* and *stale*.
- A game's fonts draw every language it ships. No language falls back to the device's fonts.
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
   `photosensitivity.switches`; a game with feel passes its `reduceFlashing` and `intensity`. The coordinator confirmed it.
6. **Core's words are catalogs:** `packages/automata/src/app/screens/words/<lang>.json` in the inlang format the
   tools already read, so the same `automata words` workflow serves core, `ui-screens` and every game. The
   English TypeScript records stay the source; `en.json` is derived and a test fails when it is stale. All six ship in
   the bundle (a language switch must be instant and offline); the measured size goes in the changeset.
7. **Stale words:** per catalog and language, a *stamps* file, `key → sha256 of the English when it was translated`.
   A key whose stamp differs from the English now is stale. There is no review state (the Owner).
8. **Where the translations come from:** the executor writes them new, for each string, in the five languages, in
   plain short words. None is taken from FloorFifty, and no test compares against FloorFifty's files.
9. **Sound names:** `press` (the default), `back`, `none`, `focus`, and by request `open`, `close`, `error`. A game may
   add any name. Starter sounds in task 10.
10. **Credits schema:** task 12. Sections of names; a name may have a role and a link.
11. **Credits links go through the host:** `Hosting` gains `openLink(url)` on every target (task 11b): Ruken through
    its SDK's `links.open`, the web and itch in a new tab, the desktop in the system browser. A refusal is an answer the
    panel shows; nothing navigates away silently. The credits panel is its first user.
12. **Build facts:** there is no build stamp in the ship step. The facts are the `GameVersion` net-server already
    computes (protocol, schema hash, content hash), served on a new `GET /version`. `/health` stays as documented.
    The client waits at most 1500 ms; anything slow or unreadable passes. The coordinator confirmed it.
13. **The font set:** Fusion Pixel Font, 12 px proportional (TakWolf, `github.com/TakWolf/fusion-pixel-font`, SIL Open
    Font License 1.1), in its `latin`, `ja`, `ko` and `zh_hans` flavours: one pixel style across Latin, Japanese,
    Korean and Simplified Chinese, each language drawn by its own flavour so shared Han characters take the right
    shape. It replaces Pixelify Sans in Emberwick, Ember Hall and the template, cut to the characters used. The
    executor proves the choice before building on it (task 5b, step 1): the licence file reads OFL 1.1 and
    `fontCoverage` covers every character of the six catalogs. If either fails, the fallback is the same author's Ark
    Pixel Font 12 px (OFL 1.1); if that fails too, stop and report.
14. **Emberwick's words** live in `games/emberwick/messages/ui/<lang>.json` (the game catalog path the content compiler
    documents) and are read as plain JSON, with no Paraglide, because Emberwick's screens are plain DOM.
15. **The stale-build "journey"** is a real-browser test in `@automata/net-ui` against a fake `fetch`, plus a unit test
    of the server route. A served two-process journey has no home in the repository today; that is reported, not built.

**Later, not in this work:** a translation editor in the suite; achievements on hosts other than Ruken; a served
two-process journey for the stale-build check.

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
| `packages/automata/src/app/screens/` | `screens-copy.ts`, `screens-catalog.ts` (new), `words/<lang>.json`, `words/context.json`, `words/stamps/<lang>.json` | Core's words |
| `packages/automata/src/app/opening/` (new) | `opening.ts`, `seen-flags.ts`, `first-run.ts`, `LanguageFirst.svelte`, `PhotosensitivityWarning.svelte` | Opening sequence |
| `packages/automata/src/features/audio/` | `ui-sounds.ts` (new) | Interface sounds |
| `packages/automata/src/app/` | `define-game.ts`, `boot/game-definition.ts`, `boot/boot-program.ts` | New fields, wiring |
| `packages/tools/src/shared/words/` (new) | `catalog.ts`, `csv.ts`, `stamps.ts`, `words-args.ts`, `run-words.ts`, `characters.ts`, `words-step.ts` | `automata words` |
| `packages/tools/src/app/` | `cli.ts`, `help.ts` | Command wiring |
| `packages/content/src/shared/assets/`, `…/locale/` | `build-fonts.ts`, `game-words.ts` (new) | Fonts cut to every word |
| `packages/automata/src/shared/host/`, `features/targets/*`, `testing/host/` | `hosting.ts`, the three adapters, `fake-hosting.ts`, `contract-suite.ts` | `openLink` |
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
  `packages/automata/src/app/screens/words/context.json`
  (`words/stamps/<lang>.json` is written by task 4's import, in task 4's commit)
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
test.each(['ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'])('%s has exactly the English keys and placeholders', (lang) => { /* key sets equal; {names} per key equal; no value is empty */ })
test('a game with no words of its own gets translated menus', () => {
  expect(resolveScreensCopy(undefined, 'ja').paused.resume).toBe(ja.paused_resume)
  expect(ja.paused_resume).not.toBe(en.paused_resume)
  expect(resolveScreensCopy(undefined, 'pt-PT').title.play).toBe(ptBR.title_play)
  expect(resolveScreensCopy(undefined, 'fr')).toEqual(DEFAULT_SCREENS_COPY)
})
test('copy.screens still overrides', () => {
  expect(resolveScreensCopy({ title: { play: 'Go' } }, 'ja').title.play).toBe('Go')
})
```

- [ ] **Step 2: Run; confirm it fails** on the missing module.
- [ ] **Step 3: Implement** `screens-catalog.ts` and write `en.json` from `flattenScreensCopy` (a one-off `node -e`; the
  test is the guard from then on).
- [ ] **Step 4: Write `words/context.json`**: `{ key: { note } }`, one plain line per key saying where the word shows and
  what pressing it does. A translator, and you in the next step, read it.
- [ ] **Step 5: Write the five translations, new.** For every key, in `ja`, `ko`, `es-419` (Latin American Spanish, the
  informal `tú`), `pt-BR` and `zh-Hans`: the word a game in that language would put on that control, short enough for a
  phone button, with every `{placeholder}` kept. Use the same word for the same action everywhere (one word for Back,
  one for Settings). Do not open FloorFifty's message files for this.
- [ ] **Step 6: Run** the test file and `pnpm --filter @automata/framework exec vitest run --project unit tests/unit/app`.
  Then `pnpm --filter @automata/framework build` and confirm the six JSON files are in `dist` at the path
  `publishConfig.exports["./words/*.json"]` names; fix the build's copy step if they are not.
- [ ] **Step 7: Commit** `feat(framework): the default screens' words in six languages` with a `patch` changeset that
  states the measured growth of the built entry in bytes.

### Task 3: `words`: catalogs, CSV and the source stamps (pure)

Behaviour reference (read, do not copy): `ff:tools/i18n/{catalogue,csv}.ts`. Its `review.ts` is not wanted. Content
catalogs are plain text (`checkTranslation` refuses anything else), so there are no plural variants here.

**Files:**
- Create: `packages/tools/src/shared/words/catalog.ts`, `csv.ts`, `stamps.ts`
- Test: `packages/tools/tests/unit/shared/words/{catalog,csv,stamps}.test.ts`

**Interfaces (produced):**

```ts
// catalog.ts
export type Catalog = Readonly<Record<string, string>>            // without `$schema`
export interface CatalogPaths { readonly name: string; readonly source: string; readonly context: string | undefined
  translation(lang: string): string; stamps(lang: string): string }
/** A game's catalogs: `content` (source `content/generated/messages/<src>.json`, translations
 *  `content/messages/<lang>.json`, stamps `content/messages-stamps/<lang>.json`) when the source file exists, and
 *  `ui` (`<ui>/<lang>.json`, stamps `<ui>/stamps/<lang>.json`, context `<ui>/context.json`), where `<ui>` is the
 *  first of `messages/ui` and `src/messages/ui` that holds `<src>.json` (Ember Hall keeps its in `src/`). */
export function gameCatalogs(gameDir: string, sourceLanguage: string): readonly CatalogPaths[]
/** One folder as a catalog: `<dir>/<lang>.json`, `<dir>/stamps/<lang>.json`, `<dir>/context.json`. */
export function folderCatalog(dir: string, sourceLanguage: string): CatalogPaths
export function placeholders(text: string): string[]             // `{name}` names, sorted, unique; `\{` is not one
export function translationProblems(source: Catalog, translated: Catalog): string[] // missing, not a source key, placeholders differ
// csv.ts
export function toCsv(rows: readonly (readonly string[])[], options?: { bom?: boolean }): string  // RFC 4180, CRLF
export function parseCsv(text: string): string[][]
// stamps.ts
export const stampsSchema: z.ZodType<Stamps>                     // z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/))
export type Stamps = Readonly<Record<string, string>>            // key → sha256 hex of the English when it was translated
export function sourceStamp(source: string): string
export interface WordsState { readonly missing: string[]; readonly stale: string[] }
export function wordsState(source: Catalog, translated: Catalog, stamps: Stamps): WordsState
```

`wordsState`: `missing` is a source key with no translation (or an empty one); `stale` is a translated key whose stamp
is absent or differs from `sourceStamp(the English now)`. Both sorted. File reads go through the `Files` service the
other tools use (`shared/node/files.ts`), so tests use its fake.

- [ ] **Step 1: Write the failing tests**

```ts
// csv
expect(parseCsv('﻿key,source\r\n"a,b","say ""hi"""\r\n\r\n')).toEqual([['key', 'source'], ['a,b', 'say "hi"'], ['']])
expect(parseCsv(toCsv([['k', 'line\nbreak']], { bom: true }))).toEqual([['k', 'line\nbreak']])
// catalog
expect(placeholders('+{count} more \\{x}')).toEqual(['count'])
expect(translationProblems({ a: 'Hi {name}' }, { a: 'Hola', b: 'x' })).toEqual(['a: placeholders (none) are not {name}', 'b: not a source key'])
// stamps
const stamps = { a: sourceStamp('Play') }
expect(wordsState({ a: 'Play', b: 'Back' }, { a: 'Jugar' }, stamps)).toEqual({ missing: ['b'], stale: [] })
expect(wordsState({ a: 'Play now' }, { a: 'Jugar' }, stamps)).toEqual({ missing: [], stale: ['a'] })
expect(wordsState({ a: 'Play' }, { a: 'Jugar' }, {})).toEqual({ missing: [], stale: ['a'] })
expect(stampsSchema.safeParse({ a: 'not a hash' }).success).toBe(false)
```

- [ ] **Step 2: Run; confirm they fail** on the missing modules.
- [ ] **Step 3: Implement** the three files.
- [ ] **Step 4: Run** `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/shared/words`. Pass.
- [ ] **Step 5: Commit** `feat(tools): message catalogs, CSV and source stamps for translators`.

### Task 4: `automata words export`, `import`, `status`

Behaviour reference (read, do not copy): `ff:tools/i18n/cli.ts`, without its reviewer and approval parts.

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
  | { readonly kind: 'import'; readonly lang: string; readonly file: string }
  | { readonly kind: 'status' } | { readonly kind: 'check' }
export interface WordsOptions { readonly command: WordsCommand; readonly dir: string; readonly catalog?: string; readonly source: string /* default 'en' */ }
export function parseWordsArgs(args: readonly string[]): { ok: true; options: WordsOptions } | { ok: false; problem: string }
/** Exit code: 0 fine, 1 a check found something, 2 a usage or input error. */
export function runWords(options: WordsOptions, io: CliIo): Effect.Effect<number, never, Files>
```

Behaviour:
- `--catalog <dir>` works on that one folder (`folderCatalog`); otherwise on `gameCatalogs(dir)`.
- `export <lang>` writes `words-<lang>.csv` in `dir` (or `--out`), with a BOM, columns
  `catalog,key,source,translation,note`, every source key, in source order.
- `import <lang> <file>` needs the columns `key` and `translation` (and `catalog` when the game has more than one). An
  unknown key, or a translation whose placeholders differ from the source's, refuses the whole file: nothing is
  written, exit 2, each problem on its own line. An empty translation cell leaves that key as it was. Otherwise it writes
  the translation file (`$schema` first, then keys in source order, two-space JSON, a final newline) and stamps every
  key the file translated with the English as it is now. It prints `<lang>: imported N`.
- `status` prints, per language found beside the source (plus the six defaults that are absent, as all missing):
  `<lang>: <m> missing, <s> stale`, then each missing and each stale key, indented, all of them. Exit 0.

- [ ] **Step 1: Write the failing tests** over the fake `Files`:

```ts
test('export then import round-trips and stamps every key', …)
test('import refuses an unknown key and writes nothing', …)                      // exit 2, files unchanged
test('import refuses a broken placeholder and writes nothing', …)                // "{count}" dropped; review focus 2
test('import reads a BOM, CRLF file with a blank row, as a spreadsheet saves it', …) // review focus 1
test('status lists what is missing and what is stale', …)   // after the English of one key changes: 'ja: 1 missing, 1 stale' and both keys
test('status with nothing to do prints 0 missing, 0 stale for each language', …)
test('automata words with no command prints its help and exits 2', …)            // cli-words.test.ts
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.** `cli.ts` gets `if (command === 'words') return wordsCommand(rest, io)`, which provides
  `FilesLive` as `checkCommand` does.
- [ ] **Step 4: Stamp core's words through the tool** (the first real use): for each of the five languages,
  `node packages/tools/src/app/bin.ts words export <lang> --catalog packages/automata/src/app/screens/words`, then
  `words import <lang> <that file>`, then `words status --catalog …`. Paste the status output into the commit body: it
  must read `0 missing, 0 stale` for all five. Commit the `stamps/` files, not the CSVs.
- [ ] **Step 5: Run** the two test files and `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/app`.
- [ ] **Step 6: Commit** `feat(tools): automata words export, import and status` with a `patch` changeset for
  `@automata/tools`.

### Task 5: `automata words check`, and the `words` step of `automata check`

**Files:**
- Create: `packages/tools/src/shared/words/characters.ts`, `words-step.ts`
- Modify: `packages/tools/src/shared/check/run-check.ts` (add `['words', wordsStep]` after `levels`, in
  `NEEDS_SOURCES`), `check-report.ts` (`StepName`), `check-args.ts` (`--only words`), `app/help.ts` (`CHECK_HELP` line:
  `words         every language has all its words, and the game's fonts can draw every letter of them`)
- Test: `packages/tools/tests/unit/shared/words/characters.test.ts`, `words-step.test.ts`;
  fixture `packages/tools/tests/fixtures/words-game/` (a `content/fonts.toml` and one small Latin-only font that already
  sits in the repository's test fixtures: find one under `packages/content/tests/fixtures`, do not add a binary here)

**Interfaces:**
- Consumes: `fontCoverage(font: Uint8Array): (character: string) => boolean` and `catalogCharacters` from
  `@automata/content` (read `packages/content/src/shared/assets/build-fonts.ts` for how `content/fonts.toml` names
  fonts and the locales each serves; export what is missing from content's Node entry rather than copying it), and
  `gameWords` from task 5b once it exists (until then this task reads the game's own catalogs only).
- Produces:

```ts
/** Each character of `lang`'s words that none of the fonts serving `lang` can draw, with the key that uses it. */
export function undrawable(words: Catalog, covers: readonly ((c: string) => boolean)[]): { key: string; character: string }[]
export const wordsStep: (gameDir: string) => StepEffect
```

`wordsStep`, per language of the game's catalogs, finds:
- `words-parity`: each `translationProblems` line (a missing key, a key that is not a source key, a placeholder changed).
- `words-font`: each character of that language's words that no font serving the language draws, as
  `U+65E5 "日" in ja "paused_resume" is not in any font that serves ja`. The words are the full source font
  (`fontCoverage` on the file `fonts.toml` names), not the built subset, so the check says whether the font *can* draw
  the word; that the subset *does* hold it is the font build's own gate (task 5b).
- `words-font`, once per language: a game that ships more than its source language and has no `content/fonts.toml`, or
  whose `fonts.toml` names no font for the language: `no font is declared for ja: name one in content/fonts.toml`.
  The device's fonts never count, so this neither passes silently nor guesses.
- Nothing, for a game with one language and no `content/fonts.toml` (every game that exists today), and for a game with
  no catalogs. Control characters draw nothing and are skipped.

`automata words check` runs the same function and prints the findings; exit 1 when there are any.

- [ ] **Step 1: Write the failing tests**

```ts
test('a character no font can draw is a finding', …)       // fixture: ja "日本" over a Latin font → rule 'words-font', names U+65E5
test('a font that covers the words passes', …)             // en only
test('two languages and no fonts.toml: one finding per language without a font', …)
test('a language fonts.toml does not list is a finding', …)
test('one language and no fonts.toml: nothing to check', …)
test('a missing key is a words-parity finding', …)
test('automata check runs the words step and exits 1 on a finding', …) // run-check over the fixture, only: 'words'
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/shared`. Pass.
- [ ] **Step 5: Commit** `feat(tools): automata check holds every language's words to the game's fonts`.

### Task 5b: Fonts: the font build cuts to every word a game shows; the pixel font set

Today the font build (`packages/content/src/shared/assets/build-fonts.ts`) cuts each language's subset to the
*content* catalog only. A game's menu words (its `messages/ui` catalog, core's words, `ui-screens`' and `net-ui`'s) are
not in it, so a subset would lack them. This task makes the build cut to all of them, and brings in the font set.

**Files:**
- Create: `packages/content/src/shared/locale/game-words.ts`,
  `vendor/fonts/fusion-pixel-12/{latin,ja,ko,zh_hans}.<ext as released>`, `vendor/fonts/fusion-pixel-12/OFL.txt`,
  `vendor/fonts/README.md`
- Modify: `packages/content/src/shared/assets/build-fonts.ts`, content's Node entry (export `gameWords`),
  `packages/tools/src/shared/words/words-step.ts` (use `gameWords`), `LICENSE-SCOPE.md` (the fonts and their licence)
- Test: `packages/content/tests/unit/shared/locale/game-words.test.ts`,
  `packages/content/tests/unit/shared/assets/build-fonts.test.ts` (add cases),
  `packages/content/tests/unit/shared/assets/font-set.test.ts`

**Interfaces (produced):**

```ts
/** Every word a game shows in `lang`, by catalog: its content catalog, its own `ui` catalog (`messages/ui` or
 *  `src/messages/ui`), and the words of each of `@automata/framework`, `@automata/ui-screens` and `@automata/net-ui`
 *  that resolves from the game's folder (`<package>/words/<lang>.json`). A package the game does not have is skipped. */
export function gameWords(gameDir: string, lang: string, content: MessageCatalog): Promise<ReadonlyMap<string, MessageCatalog>>
```

`buildFonts` cuts each language's subset to `localeCharacters` of every catalog `gameWords` returns, not the content
catalog alone, and its glyph gate names the catalog and key of a character a subset lacks.

- [ ] **Step 1: Prove the font choice before anything depends on it.** Download the 12 px proportional release of
  Fusion Pixel Font (call 13) into `vendor/fonts/fusion-pixel-12/` with its licence file. Then:
  - read the licence file: it is the SIL Open Font License 1.1. Record the release tag, each file's sha256 and the
    source URL in `vendor/fonts/README.md`;
  - write `font-set.test.ts`: for each of the six languages, every character of core's words catalog
    (`packages/automata/src/app/screens/words/<lang>.json`) is covered by that language's flavour
    (`fontCoverage`); `en`, `es-419` and `pt-BR` use `latin`.
  If the download is refused by the network policy, or the licence is not OFL 1.1, or a character is not covered:
  try Ark Pixel Font 12 px the same way; if that fails too, stop and report to the coordinator with what failed.
- [ ] **Step 2: Write the failing tests** for `gameWords` (a fixture game with a `messages/ui` catalog and a fake
  `node_modules/@automata/framework/words/ja.json`: both catalogs come back; a missing package is skipped) and for
  `buildFonts` (a word that is only in the `ui` catalog is in the subset; a `ui` word the font lacks fails the build
  naming `ui` and the key).
- [ ] **Step 3: Run; confirm they fail.**
- [ ] **Step 4: Implement,** and switch task 5's `wordsStep` to `gameWords` so the check and the build read the same
  words.
- [ ] **Step 5: Run** `pnpm --filter @automata/content exec vitest run --project unit tests/unit/shared` and
  `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/shared/words`. Pass.
- [ ] **Step 6: Commit** `feat(content): a game's fonts are cut to every word it shows; the pixel font set` with `patch`
  changesets for `@automata/content` and `@automata/tools`. Say the fonts' total size in the commit body.

Switching the font set later is this task's step 1 again plus the three `fonts.toml` files (tasks 10, 16, 17): nothing
else names the font.

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

Behaviour reference (read, do not copy): `ff:apps/client/src/ui/components/LanguageFirst.svelte`, `LanguagePicker.svelte`.

**Files:**
- Create: `packages/automata/src/app/opening/LanguageFirst.svelte`, `first-run.ts`
- Modify: `app/screens/screens-copy.ts` (add `firstRun` to `ScreensCopy` and English defaults), the six
  `words/*.json`, `words/context.json` and stamps, `app/define-game.ts` (`firstRunLanguage`), `boot-program.ts`
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
- [ ] **Step 3: Implement.** Add the `firstRun.language` words to `en.json`, write the five translations new, and bring
  them in with `automata words export` and `import` (so they are stamped), not by editing the JSON by hand.
- [ ] **Step 4: Run** the unit file, then `pnpm --filter @automata/framework exec vitest run --project browser tests/browser/app/language-first.test.ts`
  (Chromium). Report WebKit and Firefox as not run.
- [ ] **Step 5: Run every journey that boots a multi-language game standalone** and fix the ones that now meet the
  language screen by pressing through it with a shared helper (`passFirstRun(page)` in `@automata/tools/e2e`), never by
  switching the screen off: `pnpm test:browser:2d`, and list the 3D journeys (`games/base-3d`) for task 17.
- [ ] **Step 6: Commit** `feat(framework): the first run asks for a language`.

### Task 8: Photosensitivity warning

Behaviour reference (read, do not copy): `ff:apps/client/src/ui/components/PhotosensitivityWarning.svelte`.

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
switches keep what was set. The framework's own English words (written new; a game overrides them in `copy.screens`):

- title: `Flashing lights warning`
- body: `This game has flashing lights and a shaking screen. For a few people these can bring on a seizure, even if
  they have never had one. If you feel dizzy or unwell, or your eyes or muscles twitch, stop playing and talk to a
  doctor.`
- choose: `Turn down`; later: `You can change these later in Settings.`; continue: `Continue`; close: `Close`

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
- [ ] **Step 3: Implement.** Write the five translations new and bring them in through `automata words import`.
- [ ] **Step 4: Run** the unit file and the browser file in Chromium.
- [ ] **Step 5: Commit** `feat(framework): a photosensitivity warning a game opts into`.

### Task 9: Interface sounds

Behaviour reference (read, do not copy): `ff:apps/client/src/ui/ui-sounds.ts`.

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

Rules (the timings are the reference's behaviour, restated): listeners on `root` in the capture phase, passive. A click on an enabled
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

### Task 10: `create-game`: starter interface sounds, the six languages and the font set

**Files:**
- Modify: `packages/tools/src/shared/create-game/template-game.ts` (the `src/app/feel-audio.ts` and game-definition
  templates), `packages/tools/src/shared/create-game/template-content/audio/` (the template's `audio.toml`),
  `template-content/` (a `fonts.toml`), `template-project.ts` or `template-file.ts` (the font files copied from
  `vendor/fonts/fusion-pixel-12/` into the new game's `assets/fonts/`, and their `OFL.txt`), the template's CSS
  (`font-family`), the tools package's `files` so the fonts ship in the published package
- Test: `packages/tools/tests/unit/shared/create-game/template-ui-sounds.test.ts`, `template-fonts.test.ts`

**Interfaces:**
- Consumes: `GameSpec.uiSounds` as a function (task 9); the template's `sounds?.cue(name)` (`AudioStageHandle`); the
  font set (task 5b).
- Produces: a new game whose `defineGame` has `uiSounds: (name) => void sounds?.cue(`ui.${name}`)` (exported from
  `feel-audio.ts` as `uiSounds`) and `locale: { locales: [...DEFAULT_LOCALES], baseLocale: 'en' }`; three cues in the
  template's `audio.toml`, written in the form of the cues already there so the Audio editor opens and changes them:
  - `ui.press`: a short square blip, 660 Hz, 60 ms
  - `ui.back`: a falling blip, 440 Hz to 330 Hz, 80 ms
  - `ui.focus`: a tick, 880 Hz, 25 ms, half the level of `ui.press`

  and a `content/fonts.toml` that names the four flavours and the languages each serves (`latin`: `en`, `es-419`,
  `pt-BR`; `ja`; `ko`; `zh_hans`: `zh-Hans`), in the form `build-fonts.ts` reads.

- [ ] **Step 1: Write the failing tests:** the generated game's files hold `uiSounds` and `locale` in the `defineGame`
  call; its `content/audio/audio.toml` parses with `audioSchema` and has the cues `ui.press`, `ui.back` and `ui.focus`;
  its `content/fonts.toml` lists all six languages and every font file it names exists in the generated game with the
  sha256 it records; `OFL.txt` is beside them.
- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.** `packages/tools` may not import `@automata/audio-synth`: the map is template text, and if
  the test needs the schema, put the test where the existing template-content tests parse it.
- [ ] **Step 4: Run** `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/shared/create-game`, and the
  slow created-game test by hand (`packages/tools/tests/slow`): the new game builds and `automata check --only words`
  passes in it. Say which ran.
- [ ] **Step 5: Commit** `feat(tools): a new game has button sounds, six languages and a font that draws them`.

### Task 11: Splash (`@automata/ui-screens`)

Behaviour reference (read, do not copy): `ff:apps/client/src/ui/components/SplashRoot.svelte` (the hold, any press
goes on, the reduced-motion rule).

**Files:**
- Create: `extensions/ui-screens/src/features/splash/SplashScreen.svelte`, `splash-step.ts`, `splash-copy.ts`,
  `extensions/ui-screens/src/features/words/{en,ja,ko,es-419,pt-BR,zh-Hans}.json`, `words/context.json`,
  `words/stamps/<lang>.json`, `words/screens-words.ts`, `extensions/ui-screens/src/entries/splash.ts`
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
- [ ] **Step 3: Implement.** Write the five translations new and bring them in with
  `automata words import --catalog extensions/ui-screens/src/features/words` (so they are stamped).
- [ ] **Step 4: Run** `pnpm --filter @automata/ui-screens test:unit` and `test:browser` (Chromium).
- [ ] **Step 5: Commit** `feat(ui-screens): a studio splash as an opening step` with a `patch` changeset.

### Task 11b: `Hosting.openLink` on every target

The framework names a `links` capability (`shared/host/capability.schema.ts`) but `Hosting` has no call to open one.
The vendored Ruken SDK has `links.open(url): Promise<{ opened: boolean }>` (`vendor/ruken/ruken-sdk-0.0.0.tgz`,
`dist/index.d.ts`), so nothing is asked of Ruken. Behaviour reference (read, do not copy): `ff:apps/client/src/ruken/host.ts`
`openLink`.

**Files:**
- Modify: `packages/automata/src/shared/host/hosting.ts` (the interface), `shared/host/errors.ts` only if a code is
  missing, `features/targets/ruken/hosting-ruken.ts`, `features/targets/web/hosting-web.ts`,
  `features/targets/tauri/hosting-tauri.ts` and `desktop-tauri.ts`, `testing/host/fake-hosting.ts`,
  `testing/host/contract-suite.ts`, `packages/automata/package.json` (`@tauri-apps/plugin-opener` as an optional peer
  and a dev dependency, beside the other `@tauri-apps/*`), the tauri target's project template and capability file in
  `packages/tools/src/shared/ship/targets/tauri/` (register the opener plugin, allow `opener:allow-open-url` for
  `https:` only), `define-game.ts` (`wantsOf`: no change; a game asks with `hosting: { wants: ['links'] }`)
- Test: `packages/automata/tests/unit/targets/` (each adapter's test file, add cases),
  `packages/automata/tests/unit/shared/host/contract.test.ts` (it runs the suite), `packages/tools/tests/unit/shared/ship/`
  (the tauri template test)

**Interfaces (produced):**

```ts
// Hosting
/**
 * Opens a web page outside the game, the way the host wants it done: Ruken asks the player first, a web page opens a
 * new tab, the desktop opens the system browser. `opened: false` means the player or the host said no. Only `https:`
 * links are opened. The game is never navigated away. Needs the `links` grant.
 */
openLink(url: string): Promise<HostResult<{ readonly opened: boolean }>>
```

Rules, the same on every target, and what the contract suite holds each adapter to:
- A URL that does not parse, or whose scheme is not `https:`, is refused `INVALID` (use the existing code for a bad
  argument in `errors.ts`; read the file and name it in the test) and nothing is opened.
- Without the `links` grant the call is refused `NOT_GRANTED` (the existing code other ungranted calls use) and nothing
  is opened. It never falls back to another way of opening.
- Ruken: `session.links.open(url)` through the adapter's `whileOpen`, as `setFullscreen` goes; `{ opened }` from the
  SDK's answer; an SDK refusal maps through `errors-ruken.ts` as every other call's does.
- Web and itch (`hosting-web.ts`): `window.open(url, '_blank', 'noopener,noreferrer')`; `opened` is whether a window
  came back (a blocked popup is `opened: false`, an answer, not an error). `location` is never set.
- Tauri: `openUrl` from `@tauri-apps/plugin-opener`, imported only in the tauri adapter; a rejection is `opened: false`.
- `fakeHosting` records each call (`opened: readonly string[]`) and answers from an option (`links: 'open' | 'refuse'`,
  default `'open'`).

- [ ] **Step 1: Write the failing tests:** add to the contract suite, so every adapter and the fake run them:

```ts
test('openLink opens an https link and answers opened: true', …)
test('openLink refuses http:, javascript: and a string that is not a URL, and opens nothing', …)
test('openLink without the links grant is refused and opens nothing', …)
test('a host that says no answers opened: false, not an error', …)   // blocked popup; SDK { opened: false }; opener rejects
test('openLink never changes the page’s own location', …)             // web: location.href unchanged
```

- [ ] **Step 2: Run; confirm they fail** (the method is missing on every adapter).
- [ ] **Step 3: Implement** the interface, the three adapters and the fake; then the tauri template and capability.
- [ ] **Step 4: Run** `pnpm --filter @automata/framework exec vitest run --project unit tests/unit/targets tests/unit/shared/host tests/unit/testing`
  and the tools' tauri template test. A real desktop build opening a real browser is the Owner's to try: report it as
  not run.
- [ ] **Step 5: Commit** `feat(framework): a game opens a link through its host` with `patch` changesets for
  `@automata/framework` and `@automata/tools`. In `docs/guides/publish-to-ruken.md`, `publish-to-web.md`,
  `publish-to-itch.md` and `publish-to-desktop.md` add one line each on what a link does there (task 18 checks them).

### Task 12: Credits (`@automata/ui-screens`)

Behaviour reference (read, do not copy): `ff:apps/client/src/ui/components/CreditsPanel.svelte`,
`ff:apps/client/src/common/credits.ts`.

**Files:**
- Create: `extensions/ui-screens/src/features/credits/CreditsPanel.svelte`, `credits.schema.ts`, `credits.content.ts`,
  `credits-copy.ts`, `extensions/ui-screens/src/entries/credits.ts`
- Modify: `entries/index.ts`, `package.json` (export `./credits`), the six words files, `README.md`
- Test: `extensions/ui-screens/tests/unit/credits/{credits-schema,credits-panel}.test.ts`,
  `extensions/ui-screens/tests/browser/credits/credits-panel.test.ts`

**Interfaces:**
- Consumes: `Hosting['openLink']` (task 11b).
- Produces:

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
export interface CreditsCopy { readonly title: string; readonly close: string
  readonly opens: (name: string) => string; readonly refused: string }
// en: 'Credits', 'Close', 'Open {name}’s page', 'That page could not be opened.'
```

`CreditsPanel.svelte` props: `credits: Credits`, `copy: CreditsCopy`, `onClose: () => void`,
`hosting: Pick<Hosting, 'openLink' | 'granted'>`,
`text?: (section: number, name: number | undefined, authored: string) => string` (the game's content-text lookup for
translated titles and roles; default returns `authored`). It is core's `Modal` with one `ScrollList` (the declared
scroll region) of sections: a heading, then each name with its role. A name with a `url` is a button (at least 44 px,
`aria-label` from `copy.opens`) when the host granted `links`; without the grant it is plain text, so there is never a
control that cannot work. Pressing it calls `hosting.openLink(url)`; a refusal or `opened: false` shows `copy.refused`
in a polite live region under the list and leaves the panel open. The panel never opens a window or sets `location`
itself. Close has `data-sfx="back"`.

- [ ] **Step 1: Write the failing tests**

```ts
// schema
expect(creditsSchema.safeParse({ sections: [] }).success).toBe(false)
expect(creditsSchema.safeParse({ sections: [{ title: 'Game', names: [{ name: 'A', url: 'http://x.test' }] }] }).success).toBe(false) // https only
expect(creditsSchema.safeParse({ sections: [{ title: 'Game', names: [{ name: 'A', extra: 1 }] }] }).success).toBe(false)           // strict
expect(creditsSchema.parse({ sections: [{ title: 'Game', names: [{ name: 'A', role: 'Design', url: 'https://x.test' }] }] }).sections[0].names[0].role).toBe('Design')
// panel (jsdom, with fakeHosting)
test('sections and names render in the order given', …)
test('a link calls hosting.openLink with the url', …)                 // fake.opened equals ['https://x.test']
test('a refused link says so and the panel stays open', …)            // links: 'refuse' → copy.refused is shown
test('without the links grant a link is plain text: no button, no anchor', …)
test('Escape and Close call onClose', …)
// real browser: phone, compact, iPad; en and xx-long; forty names
test('the list scrolls inside the panel; Close stays whole and hit-testable; no document scroll', …)
```

- [ ] **Step 2: Run; confirm they fail.**
- [ ] **Step 3: Implement.** Write the words' five translations new and bring them in through `automata words import`.
- [ ] **Step 4: Run** `pnpm --filter @automata/ui-screens test:unit` and `test:browser` (Chromium), and the package's
  screens-rule and copy-in tests.
- [ ] **Step 5: Commit** `feat(ui-screens): a credits panel drawn from a content file, its links opened by the host`.

### Task 13: Achievements in `ruken.toml` and `automata check`

Behaviour reference (read, do not copy): `ff:apps/client/src/ruken/score-boards.ts`; `@ruken/manifest` (`vendor/ruken/ruken-manifest-0.0.0.tgz`).

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

Behaviour reference (read, do not copy): `ff:apps/client/src/managers/boot-version-check.ts`.

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
this package's own catalog (`extensions/net-ui/src/features/words/`, exported as `./words/*.json`), written new and
brought in through `automata words import`.

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
  `examples/2d/tests/e2e/{core-languages,core-first-run,audio-ui-sounds,ui-splash-credits}.test.ts`,
  `examples/2d/content/fonts.toml` (the font set of task 5b for the six languages, so the examples that show them draw
  them in the game's font; if the examples' build does not compile `content/fonts.toml`, load the four flavours from
  `vendor/fonts/fusion-pixel-12/` with `@font-face` in those two examples instead and say so in the commit)
- Modify: `examples/2d/package.json` (add `@automata/ui-screens`), `examples/2d/playwright.config.ts` (a third project,
  `examples-ipad`, `use: { ...sizes.ipad, deviceScaleFactor: 1 }`, same `testDir` and ignore), `examples/README.md`
  (four rows)

Each file opens with the header the catalog checks (`// <module>-<name>: <title>`, `Shows`, `Controls`, `Packages`,
`Difficulty`, `Tier`; no `Golden`, since none has a sim worth replaying beyond a still field). The synthesized sounds are
made the way `chime.wav` was (`resources/sounds/PROVENANCE.md` says how); they are the examples' own.

| File | Title line | What it does |
|---|---|---|
| `core-languages.ts` | `core-languages: The menus in six languages` | `locale: { locales: [...DEFAULT_LOCALES], baseLocale: 'en' }`, `firstRunLanguage: false`, default screens. `Tier: core` |
| `core-first-run.ts` | `core-first-run: A first run asks for a language and warns about flashing` | six locales, `photosensitivity: { switches: [one in-memory "Flashing" switch] }`. `Host:` set so the fake host is not Ruken-kind for the locale rule; if the examples' fake host is always `ruken`, add a header-free way in this file: pass `hosting: { … }` the standalone kind the example runner supports, and say so in the file's comment. `Tier: core` |
| `audio-ui-sounds.ts` | `audio-ui-sounds: Buttons that sound, a Back that sounds different, one that stays silent` | `uiSounds: { press, back, focus }` from the three files; a `title.actions`-free page: default screens, whose Back and mute already carry `data-sfx`. `Tier: core` |
| `ui-splash-credits.ts` | `ui-splash-credits: A studio splash, then a title with Credits` | `opening: [splashStep({ logo })]`, custom `screens` with `@automata/ui-screens`' Title (`extra: [{ id: 'credits', … }]`) that opens `CreditsPanel` over inline credits parsed by `creditsSchema`, with `hosting: { wants: ['links'] }` and one name with a link. `Tier: extension` |

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
//  names; pressing the linked name asks the fake host to open it (the host page records the request); Escape closes
//  the panel and focus is back on Credits.
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
  `games/emberwick/messages/ui/stamps/<lang>.json`, `games/emberwick/src/features/screens/words.ts`,
  `games/emberwick/content/fonts.toml`, `games/emberwick/assets/fonts/` (the four flavours and `OFL.txt`, copied from
  `vendor/fonts/fusion-pixel-12/`)
- Modify: `games/emberwick/src/features/screens/emberwick-screens.ts` (panels from words, re-drawn on a language
  change; the end screen submits the round's time), `src/app/make-game.ts` (`locale`, `hosting.wants`),
  `ship.config.ts` (`content.languages`, `leaderboards`, `achievements`), `style.css` and `package.json` (the font set
  in place of `@fontsource/pixelify-sans`; the family name the font build's `fonts.json` gives, with no generic or
  system family after it for text the game draws), `playwright.config.ts`
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
test.each(DEFAULT_LOCALES)('%s: content/fonts.toml names a font, and it draws every word the game shows', …) // gameWords + fontCoverage
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
  four) in `games/emberwick`, fill the CSVs with translations written new, `automata words import <lang>
  words-<lang>.csv`, then `automata words status` (`0 missing, 0 stale` for all five). Paste the status output into the
  commit body. Do not commit the CSVs.
- [ ] **Step 5: Move Emberwick to the font set.** `content/fonts.toml` names the four flavours and the languages each
  serves; the build writes the subsets; `style.css` uses them. Look at the game in Chromium in `en`, `ja`, `ko` and
  `zh-Hans` at phone size: the menu, paused and end screens read in the pixel font with no fallback glyphs, and nothing
  that fitted in Pixelify Sans now overflows (the layout tests say so; fix the layout, never shrink a target). The
  existing visual goldens that hold text will move: look at each expected, actual and diff image and say in the commit
  that the font is why. Record the subsets' total size.
- [ ] **Step 6: Run** `pnpm --filter @af-games/emberwick check`, `automata check` in the game's folder (the `words`,
  `boards` and `achievements` steps pass; then break it once by hand, adding a character the font lacks to `ja.json`,
  see `words` fail, and undo it), and `pnpm --filter @af-games/emberwick test:e2e -- --trace off` in Chromium:
  the existing journeys and the six language projects.
- [ ] **Step 7: Commit** `feat(emberwick): six languages in a font that draws them, and an achievement`.

### Task 17: Ember Hall (`games/base-3d`) in six languages

Ember Hall already has Paraglide, its catalog at `src/messages/ui/{locale}.json` and core's default screens, so core's
menus translate with no work. This task translates its own few words.

**Files:**
- Create: `games/base-3d/src/messages/ui/{ja,ko,es-419,pt-BR,zh-Hans}.json`, `src/messages/ui/stamps/<lang>.json`,
  `src/messages/ui/context.json`; `games/base-3d/content/messages/<lang>.json` if its content has localized text;
  `games/base-3d/content/fonts.toml` and the four font flavours (or, if the game already has a `fonts.toml`, change it
  to the font set)
- Modify: `games/base-3d/ship.config.ts` (`content.languages`), the content's language list where it is declared
  (find it from `languagesOf` in `packages/content/src/shared/compile/compile-content.ts`), its journeys' first-run helper
- Test: `games/base-3d/tests/unit/` (a `words.test.ts`: every language has exactly the source keys and placeholders, by
  `translationProblems`)

- [ ] **Step 1: Write the failing test.**
- [ ] **Step 2: Run; confirm it fails** on the missing files.
- [ ] **Step 3: Translate through the workflow** (`automata words export|import|status` in `games/base-3d`), as in task
  16, with translations written new. Then move the game to the font set as in task 16, step 5 (its text is the menus
  and the HUD; the 3D scene's goldens hold no text and must not move).
- [ ] **Step 4: Run** `pnpm --filter @af-games/base-3d test:unit` and `automata check --only words` there. The game's
  browser suites and journeys are the 3D workflow's: run them if this machine can (`pnpm ci:local`), and otherwise report
  them as not run, with the helper change described.
- [ ] **Step 5: Commit** `feat(base-3d): Ember Hall's words in six languages`.

### Task 18: Guides, API report and index, changesets, final gates

**Files:**
- Modify: `docs/guides/publish-to-ruken.md` (an "Achievements" section: declare them beside `leaderboards`, one rule
  each, Ruken awards them, `automata check` says what is wrong), `docs/guides/how-it-works.md` or `docs/guides/index.md`
  (a "Languages" section: the six, `automata words`, what missing and stale mean, and the font rule; and "The first
  run": language, warning, splash), `docs/cheatsheet.md` and the agent package's API reference (written by `pnpm api-index --write`),
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
  - `automata words status` prints what is missing or stale (paste its output for core, ui-screens, net-ui, Emberwick
    and Ember Hall: all `0 missing, 0 stale`; and the unit test's name that shows a stale key listed);
    `automata check` fails on a character a font cannot draw (the test's name, and the by-hand break in task 16);
  - every game and the template draw all six languages in the font set, with no device fallback (the tests' names);
    the fonts' licence is in `LICENSE-SCOPE.md` and `vendor/fonts/README.md`;
  - `Hosting.openLink` is in the contract suite and on every adapter; the four publish guides say what a link does;
  - `pnpm check` passes; API reports and the index are updated; changesets are written (list them);
  - not run here: WebKit, Firefox, real devices, the 3D workflow if so. These are the Owner's.
- [ ] **Step 5: Commit** `docs: shared polish, the guides, the API index and the record`, push, and report the commit to
  the coordinator.

---

## Self-review (done when the plan was written, and again after the spec's amendments of 2026-11-11)

- **Spec coverage:** item 1 → tasks 1 to 5b, 10, 16, 17 (fonts: 5, 5b, 10, 16, 17); item 2 → 6, 7; item 3 → 6, 8;
  item 4 → 9, 10; item 5 → 11, 11b (the host opens links), 12; item 6 → 13, 16; item 7 → 14; the four examples → 15;
  "Done means" → 18. The spec's "left to the builder" list is calls 1, 2, 9 and 10.
- **The amendments:** nothing is copied from FloorFifty (the header, call 8, and every task's "read, do not copy");
  no review state (call 7, tasks 3 and 4: only missing and stale); fonts cover every shipped language with no device
  fallback (call 13, tasks 5, 5b, 10, 16, 17); `Hosting.openLink` (call 11, task 11b, used by task 12).
  `automata-website` is retired and not touched; `automata-skills` is kept and not touched.
- **Names used across tasks:** `OpeningStep`, `OpeningContext`, `SeenFlags` (6) are consumed by 7, 8, 11 and 14;
  `DEFAULT_LOCALES` (1) by 2, 10, 15, 16; `Catalog`, `translationProblems`, `wordsState` (3) by 4, 5, 17; `gameWords`
  (5b) by 5 and 16; `UiSounds` (9) by 10 and 15; `Hosting.openLink` (11b) by 12 and 15; `creditsSchema`, `CreditsCopy`
  (12) by 11's `screensWords` and by 15.
- **Order:** 1, 2, 3, 4, 5, 5b, 6, 7, 8, 9, 10, 11, 11b, 12, 13, 14, 15, 16, 17, 18. Task 11's `screensWords` names
  `CreditsCopy`: declare the type in task 11 with the splash words alone and widen it in task 12.
- **Not verified while planning** (the executor checks first and stops if wrong): the font's coverage and licence
  (task 5b, step 1, with a named fallback); the package build copies JSON into `dist` (task 2); the examples' fake host
  kind for the language rule, and whether the examples' build compiles `content/fonts.toml` (task 15); the form of a
  cue in the template's `audio.toml` (task 10); a Latin-only font already among content's test fixtures (task 5); the
  error codes `errors.ts` uses for a bad argument and a missing grant (task 11b).
