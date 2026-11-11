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
**Audit:** [`../audits/2026-11-11-shared-polish-plan-audit.md`](../audits/2026-11-11-shared-polish-plan-audit.md)
(stage 3). Its findings are folded in below; the ones still open are marked *open* where they bite.

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
- Each task: `pnpm format`, then the task's checks, then one Conventional Commit. Every published package a task changes
  gets a `patch` changeset in that task's commit (`.changeset/<short-name>.md`, the form of
  `.changeset/audio-overall-volume.md`); the tasks below do not repeat this.
- A changed export or doc comment of a published package: `pnpm build`, `pnpm api-report --update`,
  `pnpm api-index --write`, committed (batched in task 18, or earlier if `pnpm check` asks).
- No subagents. Hosted CI has no runners: run browser suites in Chromium here, and report WebKit, Firefox and real
  devices as pending for the Owner. Never claim a suite that did not run.
- Test commands below use `pnpm --filter <pkg> exec vitest run --project unit <file>`. Where a package's own script adds
  flags (`--configLoader runner` in the games), add them. A Vitest browser project starts Chromium, WebKit and Firefox,
  and only Chromium is installed here: add `--browser.name=chromium` to every browser run in this container.
- Every "write the failing tests" step is followed by running them and seeing them fail for the reason given; the steps
  below say so only where the reason is not obvious.
- JSON is imported the repository's way: `import ja from './ja.json' with { type: 'json' }`
  (`packages/3d/src/shared/time-of-day/time-of-day.ts:4`).
- A feature folder imports only itself and `shared/`; `app/` wires features; `entries/` re-exports (`pnpm boundaries`).
  `ui-screens`' screen folders also obey its copy-in rule: only `@automata/framework`, `svelte` and their own
  `.svelte` files (`extensions/ui-screens/tests/unit/screens/screens-copy.test.ts`).

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
   the bundle (a language switch must be instant and offline); the measured size goes in the changeset. The catalog is
   all of core's words, not only `ScreensCopy`: the boot and failure words (`BOOT_FAILURE_COPY_EN`, the loading and
   lost-picture lines) and the display policy's (`DISPLAY_COPY_EN`), under `runtime_*` and `display_*` keys, because
   the spec's goal 1 names errors (audit B1).
7. **Stale words:** per catalog and language, a *stamps* file, `key → sha256 of the English when it was translated`.
   A key whose stamp differs from the English now is stale. There is no review state (the Owner).
8. **Where the translations come from:** the executor writes them new, for each string, in the five languages, in
   plain short words. None is taken from FloorFifty, and no test compares against FloorFifty's files.
9. **Sound names:** `press` (the default), `back`, `none`, `focus`, and by request `open`, `close`, `error`. A game may
   add any name. Starter sounds in task 10.
10. **Credits schema:** task 12. Sections of names; a name may have a role and a link.
11. **Credits links go through the host:** `Hosting` gains `openLink(url)` on every target (task 11b): Ruken through
    its SDK's `links.open`, the web and itch in a new tab, the desktop in the system browser. A refusal is an answer the
    panel shows; nothing navigates away silently. The credits panel is its first user. The web, itch and desktop
    adapters grant `links` (today they grant only what they observe, plus saves), since a new tab or the system browser
    is always there; Ruken grants it when the game asks (audit B2).
12. **Build facts:** there is no build stamp in the ship step. The facts are the `GameVersion` net-server already
    computes (protocol, schema hash, content hash), served on a new `GET /version`. `/health` stays as documented.
    The client waits at most 1500 ms; anything slow or unreadable passes. The coordinator confirmed it.
13. **The font set:** Fusion Pixel Font, 12 px proportional (TakWolf, SIL Open Font License 1.1 with the Reserved Font
    Name "Fusion Pixel"), in three flavours: `ja`, `ko` and `zh_hans`, so shared Han characters take each language's
    shape. Every flavour holds the same full Latin, so `en`, `es-419` and `pt-BR` are served by the `ja` flavour; no
    separate Latin file is needed. The source is Fontsource's npm copy, since `github.com` is refused by the network
    here and npm is not: `@fontsource/fusion-pixel-12px-proportional-{jp,kr,sc}@5.3.0` (font v2024.05.12, about
    600 KB of `woff2` each). Checked by the audit: each holds 31,345 code points, including every es/pt letter, the six
    language names, kana, all Hangul syllables, GB2312 level 1 and JIS X 0208 level 1; it lacks ✓, ✕ and ⟳ (call 18).
    It replaces Pixelify Sans in Emberwick, and the device fonts in Ember Hall and the template (which draws in
    `sans-serif` today), cut to the characters used. *Open, for the Owner (audit B7):* a subset is a Modified Version
    under the OFL and may not keep a reserved name; the default here is that the font build renames such a subset
    (task 5b). If the Owner picks another font, this call and task 5b step 1 change, nothing else.
14. **Emberwick's words** live in `games/emberwick/messages/ui/<lang>.json` (the game catalog path the content compiler
    documents) and are read as plain JSON, with no Paraglide, because Emberwick's screens are plain DOM.
15. **The stale-build "journey"** is a real-browser test in `@automata/net-ui` against a fake `fetch`, plus a unit test
    of the server route. A served two-process journey has no home in the repository today; that is reported, not built.
16. **How a game draws its fonts:** the font build also writes `fonts.css` beside `fonts.json`: one `@font-face` per
    font and language (family `"<font> <lang>"`, the subset's file, `font-display: block`) and, per language,
    `:root:lang(<tag>) { --af-font: "<first font> <tag>", "<next font> <tag>"; }` in `fonts.toml` order. Core's theme
    already draws every screen in `var(--af-font)` and the locale service already sets `<html lang>`, so a language
    change switches faces with no code. A game imports the built `fonts.css` once; its own styles use
    `var(--af-font)`. Nothing names a device or generic family after a game's faces (audit B6).
17. **A game's languages are its content languages.** The content compiler takes them from
    `content/messages/<lang>.json` (the source plus one per file), and the font build and Paraglide accept only those. A
    game that ships a language therefore has `content/messages/<lang>.json`, an empty catalog when its content has no
    text (audit B5).
18. **Core's three symbols are drawn, not typed.** ✕, ✓ and ⟳ are not in the font; core draws them as inline SVG
    (`Modal`, `Chip`, `Toast`, `RotateHint`, `RotateToast`, and the PlayStation ✕ prompt), so no game's font must hold an
    icon (audit S12).
19. **Credits are reached from the title.** Core's Settings screen cannot import `ui-screens`, so it gets no Credits
    entry; a game may add one to its own screens. *Open, for the coordinator (audit S13):* the spec says "from the title
    or Settings".
20. **The site's Examples page** builds the four examples with no site code, except that its playground's import map
    holds only `@automata/framework` and `zod` (`site/playground/src/frame-page.ts:35`). *Open, for the coordinator
    (audit S9):* add `@automata/ui-screens` there, or leave `ui-splash-credits` off the site. Until answered, task 15
    builds the playground and reports what it does.

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

---

### Task 1: The six languages as data, and the negotiation rules pinned

**Files:**
- Create: `packages/content/src/shared/locale/default-locales.ts`
- Modify: `packages/content/src/shared/locale/endonyms.ts`, `packages/content/src/shared/locale/index.ts`
- Test: `packages/content/tests/unit/shared/locale/default-locales.test.ts`,
  `packages/automata/tests/unit/locale/negotiate-locale.test.ts` (it exists; add cases),
  `packages/content/tests/browser/locale/endonyms.test.ts` (it pins every engine's names for `es`; add `es-419` from
  `ENDONYMS`, so the engines test and the font build agree)

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
- [ ] **Step 5: Commit** `feat(content): the six default languages and their names`.

### Task 2: Core's menu words as catalogs in six languages

**Files:**
- Create: `packages/automata/src/app/screens/screens-catalog.ts`,
  `packages/automata/src/app/screens/words/{en,ja,ko,es-419,pt-BR,zh-Hans}.json`,
  `packages/automata/src/app/screens/words/context.json`
  (`words/stamps/<lang>.json` is written by task 4's import, in task 4's commit)
- Modify: `packages/automata/src/app/screens/screens-copy.ts` (`resolveScreensCopy`), `packages/automata/package.json`
  (export `"./words/*.json"`, in both `exports` and `publishConfig.exports`); the English outside `ScreensCopy` (call 6):
  `shared/ui/status/boot-failure.ts` (`BOOT_FAILURE_COPY_EN`), `shared/ui/status/BootFailurePanel.svelte`,
  `app/flow/flow.manager.ts` (lines 157-204 read the failure and loading words), `app/boot/boot-program.ts`
  (`'Loading…'` and `CONTEXT_LOST_COPY_EN`), `features/display/display-policy.svelte.ts` (`DISPLAY_COPY_EN`)
- Test: `packages/automata/tests/unit/app/screens/screens-catalog.test.ts`

**Interfaces:**
- Produces:
  - `flattenScreensCopy(copy: ScreensCopy): Record<string, string>`: keys are the record's path in snake_case joined by
    `_` (`paused_quit_prompt`, `settings_screen_more`). A function leaf becomes text with `{name}` placeholders; a leaf
    that takes a boolean becomes two keys ending `_on` and `_off`. The list of function leaves is a table in this file
    (`FUNCTION_LEAVES`: path, parameter names or `'boolean'`, and `prepare`, which turns the call's arguments into the
    placeholders' values); read every `*Copy` interface under `app/screens/` and `shared/ui/` to fill it, and let the
    type checker hold it to `ScreensCopy`. Three leaves compute their argument, so their text cannot come from calling
    the English function with `{name}`: `settings.audio.percent` (`Math.round(value * 100)`, placeholder `{percent}`),
    `saves.slots.slot` (`slot + 1`, placeholder `{number}`) and `settings.controls.capturing` (lower-cases the device;
    the English keeps that in `prepare`, and other languages get the device as given). Write their English text by hand
    in the table, and test that each reads as the English function does for two arguments.
  - The same for core's runtime and display words (call 6): `runtimeCopyFor(locale)` (`BootFailureCopy` plus
    `loading`, `slow`, `contextLost`) and `displayCopyFor(locale)` (`DisplayCopy`), read where those English records
    are read today. A game's `copy` still wins. A failure before the locale service exists takes
    `negotiateLocale({ hosted: undefined, saved: undefined, browser, locales, baseLocale })` over the game's locales.
  - `screensCopyFrom(catalog: Readonly<Record<string, string>>, fallback: ScreensCopy): ScreensCopy`: the reverse; a
    missing key takes `fallback`'s leaf.
  - `screensCopyFor(locale: string): ScreensCopy`: the catalog of `matchLocale(locale, DEFAULT_LOCALES)`, else English.
  - `resolveScreensCopy(input, locale)` now lays the game's overrides over `screensCopyFor(locale)`.
- Consumes: `DEFAULT_LOCALES` (task 1), `matchLocale`, `negotiateLocale`.

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
test('a computed word reads as the English function does', () => {
  const back = screensCopyFrom(en, DEFAULT_SCREENS_COPY)
  expect(back.settings.audio.percent(0.5)).toBe('50%')
  expect(back.saves.slots.slot(0)).toBe('Slot 1')
})
test('the failure, loading and rotate words follow the locale', () => {
  expect(runtimeCopyFor('ja').retry).toBe(ja.runtime_retry)
  expect(displayCopyFor('ko').toast.ok).toBe(ko.display_toast_ok)
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
  `publishConfig.exports["./words/*.json"]` names (`svelte-package` copies non-code files as it copies `theme.css`; the
  audit did not run the build); fix the build's copy step if they are not. Measure the site playground's runtime
  against its gzip budget (`site/playground/src/runtime-size.ts`, 460,000 bytes) and say the number.
- [ ] **Step 7: Commit** `feat(framework): the default screens' words in six languages`; the changeset states the
  measured growth of the built entry in bytes.

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
 *  first of `messages/ui` and `src/messages/ui` that holds `<src>.json` (Ember Hall keeps its in `src/`). It looks
 *  for files, so it is an Effect over `Files`. */
export function gameCatalogs(gameDir: string, sourceLanguage: string): Effect.Effect<readonly CatalogPaths[], never, Files>
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
- `status` prints, per language the game ships (the translation files found beside each catalog's source; with
  `--catalog`, the six defaults, an absent file being all missing): `<lang>: <m> missing, <s> stale`, then each
  missing and each stale key, indented, all of them. Exit 0. A game that ships only English prints nothing to do.
- What *missing* costs differs by catalog, and the help says so: a missing key in a `ui` catalog shows the English
  word; a missing key in `content/messages/<lang>.json` fails the content build (`checkTranslation`,
  `packages/content/src/shared/locale/messages.ts:90`), so `import` of a partial CSV into the content catalog writes
  nothing and says which keys are still empty.

- [ ] **Step 1: Write the failing tests** over the fake `Files`:

```ts
test('export then import round-trips and stamps every key', …)
test('import refuses an unknown key and writes nothing', …)                      // exit 2, files unchanged
test('import refuses a broken placeholder and writes nothing', …)                // "{count}" dropped; review focus 2
test('import reads a BOM, CRLF file with a blank row, as a spreadsheet saves it', …) // review focus 1
test('status lists what is missing and what is stale', …)   // after the English of one key changes: 'ja: 1 missing, 1 stale' and both keys
test('status with nothing to do prints 0 missing, 0 stale for each language', …)
test('a CSV that leaves a content key empty writes nothing and names the key', …) // the content build would fail
test('automata words with no command prints its help and exits 2', …)            // cli-words.test.ts
```

- [ ] **Step 2: Implement.** `cli.ts` gets `if (command === 'words') return wordsCommand(rest, io)`, which provides
  `FilesLive` as `checkCommand` does.
- [ ] **Step 3: Stamp core's words through the tool** (the first real use): for each of the five languages,
  `node packages/tools/src/app/bin.ts words export <lang> --catalog packages/automata/src/app/screens/words`, then
  `words import <lang> <that file>`, then `words status --catalog …`. Paste the status output into the commit body: it
  must read `0 missing, 0 stale` for all five. Commit the `stamps/` files, not the CSVs.
- [ ] **Step 4: Run** the two test files and `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/app`.
- [ ] **Step 5: Commit** `feat(tools): automata words export, import and status`.

### Task 5: `automata words check`, and the `words` step of `automata check`

**Files:**
- Create: `packages/tools/src/shared/words/characters.ts`, `words-step.ts`
- Modify: `packages/tools/src/shared/check/run-check.ts` (add `['words', wordsStep]` after `levels`, in
  `NEEDS_SOURCES`), `check-report.ts` (`STEP_NAMES`, in the same place; `--only words` then parses with no change to
  `check-args.ts`), `app/help.ts` (`CHECK_HELP` line:
  `words         every language has all its words, and the game's fonts can draw every letter of them`)
- Test: `packages/tools/tests/unit/shared/words/characters.test.ts`, `words-step.test.ts`;
  fixture `packages/tools/tests/fixtures/words-game/` (a `content/fonts.toml` that names the Latin-only font already in
  the repository, `packages/content/src/shared/assets/fixtures/fonts/pixelify-sans-latin-400-normal.woff2`, read from
  there by the test; do not add a binary)

**Interfaces:**
- Consumes: `fontCoverage(font: Uint8Array): (character: string) => boolean` from `@automata/content/assets` and
  `catalogCharacters` from `@automata/content/locale` (both exported already; read
  `packages/content/src/shared/assets/build-fonts.ts` for how `content/fonts.toml` names fonts and the locales each
  serves), and `gameWords` from task 5b once it exists (until then this task reads the game's own catalogs only).
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

- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/shared`. Pass.
- [ ] **Step 4: Commit** `feat(tools): automata check holds every language's words to the game's fonts`.

### Task 5b: Fonts: the font build cuts to every word a game shows; the pixel font set

Today the font build (`packages/content/src/shared/assets/build-fonts.ts`) cuts each language's subset to the
*content* catalog only, lets a language no font serves fall back to the game's CSS (lines 10 and 17-18), keeps the
source's name table, and writes no CSS: nothing loads the subsets, and core's theme draws in the device's fonts
(`--af-font: system-ui, …`, `packages/automata/src/shared/ui/theme.css:26`). This task makes the build cut to every
word a game shows, refuse a shipped language no font serves, rename a subset whose licence reserves its name, and write
the faces as CSS (calls 13 and 16); and it brings in the font set.

**Files:**
- Create: `packages/content/src/shared/locale/game-words.ts`,
  `vendor/fonts/fusion-pixel-12/{ja,ko,zh_hans}.woff2`, `vendor/fonts/fusion-pixel-12/OFL.txt`, `vendor/fonts/README.md`
- Modify: `packages/content/src/shared/assets/build-fonts.ts`, `fonts.schema.ts` (an optional `reserved_name` on a
  font), `font-subset.ts` (rename), `asset-outputs.ts` (`fonts.css` beside `fonts.json`), content's Node entry (export
  `gameWords`), `packages/tools/src/shared/words/words-step.ts` (use `gameWords`), `LICENSE-SCOPE.md` (the fonts and
  their licence); core's symbols (call 18): `packages/automata/src/shared/ui/dialog/Modal.svelte`,
  `shared/ui/status/Chip.svelte`, `Toast.svelte`, `shared/ui/display/RotateHint.svelte`, `RotateToast.svelte`,
  `shared/ui/prompts/prompt-label.ts` (✕, ✓ and ⟳ as inline SVG, `aria-hidden` as the glyphs are now)
- Test: `packages/content/tests/unit/shared/locale/game-words.test.ts`,
  `packages/content/tests/unit/shared/assets/build-fonts.test.ts` (add cases),
  `packages/content/tests/unit/shared/assets/font-set.test.ts`; a DOM test per changed core component that the icon is
  an SVG and no text glyph is left

**Interfaces (produced):**

```ts
/** Every word a game shows in `lang`, by catalog: its content catalog, its own `ui` catalog (`messages/ui` or
 *  `src/messages/ui`), and the words of each of `@automata/framework`, `@automata/ui-screens` and `@automata/net-ui`
 *  that resolves from the game's folder through the package's `exports` (`<package>/words/<lang>.json`). A package the
 *  game does not have is skipped. */
export function gameWords(gameDir: string, lang: string, content: MessageCatalog): Promise<ReadonlyMap<string, MessageCatalog>>
```

- `buildFonts` cuts each language's subset to `localeCharacters` of every catalog `gameWords` returns, not the content
  catalog alone, and its glyph gate names the catalog and key of a character a subset lacks.
- With a `fonts.toml`, every content language must be served by a font: one that is not is a `missingAsset` diagnostic
  at the file (`no font serves ko: add it to a font's locales`). The comment's "draws in whatever face the game's CSS
  names" goes. No game has a `fonts.toml` today, so nothing that passes now fails.
- A font with `reserved_name = "Fusion Pixel"` in `fonts.toml` is cut and then renamed: name IDs 1, 4, 6, 16 and 17
  become `"<font> <lang>"` (the `@font-face` family of call 16), IDs 0 (copyright) and 13-14 (licence) are kept.
  `subset-font` does not rename: cut to `truetype`, rewrite the `name` table, then convert to `woff2` with
  `fontverter` (already under `subset-font`). If that cannot be done in Node without a new native dependency, stop and
  report. *Open, for the Owner (audit B7):* if the Owner settles the reserved name another way, drop the rename and the
  field.
- `fonts.css`, beside `fonts.json`, as call 16 says, sorted so the same input gives the same bytes. Both are committed
  outputs of `automata-content assets`, like `fonts.json`, and `check --verify-artifact` catches a stale one.

- [ ] **Step 1: Prove the font choice before anything depends on it.** Fetch the three npm packages of call 13
  (`npm pack @fontsource/fusion-pixel-12px-proportional-jp@5.3.0`, and `-kr`, `-sc`), each into its own empty folder,
  and copy each package's `files/*-latin-400-normal.woff2` (the whole font, despite the name) and its `LICENSE` into
  `vendor/fonts/fusion-pixel-12/` as `ja.woff2`, `ko.woff2`, `zh_hans.woff2` and `OFL.txt`. Then:
  - read `OFL.txt`: SIL Open Font License 1.1, Reserved Font Name "Fusion Pixel". Record the packages, their npm
    integrity, the font version (`metadata.json`: v2024.05.12), each file's sha256 and size in `vendor/fonts/README.md`;
  - write `font-set.test.ts`: for each of the six languages, every character of core's words catalog
    (`packages/automata/src/app/screens/words/<lang>.json`) and every non-ASCII character in core's Svelte files is
    covered by that language's flavour (`fontCoverage`); `en`, `es-419` and `pt-BR` use `ja`.
  If the packages cannot be fetched or a character is not covered, stop and report to the coordinator with what failed
  (the audit found every language name, kana, all Hangul, GB2312 level 1 and JIS level 1 covered, and ✓ ✕ ⟳ missing).
- [ ] **Step 2: Write the failing tests** for `gameWords` (a fixture game with a `messages/ui` catalog and a fake
  `node_modules/@automata/framework` with a `package.json` whose `exports` maps `./words/*.json`: both catalogs come
  back; a missing package is skipped) and for `buildFonts` (a word that is only in the `ui` catalog is in the subset; a
  `ui` word the font lacks fails the build naming `ui` and the key; a content language no font serves fails; a font with
  `reserved_name` comes out under the new family name with its copyright kept; `fonts.css` holds one face per font and
  language and one `:lang()` rule per language).
- [ ] **Step 3: Implement,** switch task 5's `wordsStep` to `gameWords` so the check and the build read the same words,
  and draw core's three symbols as SVG.
- [ ] **Step 4: Run** `pnpm --filter @automata/content exec vitest run --project unit tests/unit/shared`,
  `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/shared/words` and
  `pnpm --filter @automata/framework exec vitest run --project unit tests/unit/shared/ui`. Pass.
- [ ] **Step 5: Commit** `feat(content): a game's fonts are cut to every word it shows; the pixel font set`. Say the
  fonts' total size in the commit body.

Switching the font set later is this task's step 1 again plus the `fonts.toml` files (tasks 10, 15, 16, 17): nothing
else names the font.

### Task 6: The opening sequence and the seen flags (core)

**Files:**
- Create: `packages/automata/src/app/opening/opening.ts`, `seen-flags.ts`
- Modify: `packages/automata/src/app/boot/game-definition.ts` (`GameDefinition.opening`), `app/define-game.ts`
  (`GameSpec.opening`, passed through), `app/boot/boot-program.ts` (run it just before `flowHandle.start`),
  `shared/runtime/time/time.manager.ts` (`PauseReason` gains `'opening'`; today it is
  `'lifecycle' | 'menu' | 'input' | 'display'`), `entries/runtime.ts` (it exports `ScreenContext`; export the new types
  beside it)
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
development restart) the opening is skipped. The host's menu request (`hosting.onMenuRequest`, wired above the flow's
start in `boot-program.ts`) does nothing until the first screen has entered: there is no menu to open yet.

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
test('a host menu request during the opening opens nothing', …)
```

- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** `pnpm --filter @automata/framework exec vitest run --project unit tests/unit/app`. Pass, with no
  existing boot test changed.
- [ ] **Step 4: Commit** `feat(framework): an opening sequence before the first screen`.

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
test('a pad moves focus down the list and its bottom button picks', …)   // the spec: keyboard, pad and touch
// real browser, at phone (390×844), compact (780×270) and iPad sizes, in en and xx-long
test('every language button is whole, at least 48 px, and hit-testable; no document scroll', …) // use #src/testing/layout helpers
```

- [ ] **Step 2: Implement.** Add the `firstRun.language` words to `en.json`, write the five translations new, and bring
  them in with `automata words export` and `import` (so they are stamped), not by editing the JSON by hand.
- [ ] **Step 3: Run** the unit file, then `pnpm --filter @automata/framework exec vitest run --project browser --browser.name=chromium tests/browser/app/language-first.test.ts`.
  Report WebKit and Firefox as not run.
- [ ] **Step 4: Write the journeys' helper now,** `passFirstRun(page, tag?)` in `@automata/tools/e2e` (presses the
  detected language, or `tag`, then Continue on the warning when one shows), for tasks 15 to 17. No journey meets the
  screen yet: every game today ships one language, and the examples' and Emberwick's journeys run under Ruken's fake
  host, which skips it. A journey is never fixed by switching the screen off.
- [ ] **Step 5: Commit** `feat(framework): the first run asks for a language`.

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

`firstRunSteps` returns the language step, then the warning step when the option is set. A switch is on or off; feel's
`intensity` is `0 | 0.5 | 1` (`extensions/feel/src/features/frame/feel.ts:28`), so a game's "Less shaking" switch maps
on to `0.5` and off to `1`, and its `reduceFlashing` maps straight across. The doc comment on `WarningSwitch` says so.

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

- [ ] **Step 2: Implement.** Write the five translations new and bring them in through `automata words import`.
- [ ] **Step 3: Run** the unit file and the browser file (`--browser.name=chromium`).
- [ ] **Step 4: Commit** `feat(framework): a photosensitivity warning a game opts into`.

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

Rules (the timings are the reference's behaviour, restated): listeners on `root` in the capture phase, passive. The
control that last had focus is remembered, so moving focus back onto it does not tick again. A click on an enabled
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

- [ ] **Step 2: Implement,** and wire boot: `if (game.uiSounds !== undefined) owned.add(installUiSounds(game.root, audio, game.uiSounds))`.
  Mark core's own leaving controls with `data-sfx="back"` (Back, Close, Cancel, "Keep playing") and the mute toggle with
  `data-sfx="none"`; add a DOM test per screen that the attribute is there.
- [ ] **Step 3: Run** `pnpm --filter @automata/framework exec vitest run --project unit tests/unit/audio tests/unit/app`.
- [ ] **Step 4: Commit** `feat(framework): every control sounds by default once a game maps the sounds`.

### Task 10: `create-game`: starter interface sounds, the six languages and the font set

**Files:**
- Modify: `packages/tools/src/shared/create-game/template-game.ts` (the `src/app/feel-audio.ts` and game-definition
  templates), `packages/tools/src/shared/create-game/template-content/audio/` (the template's `audio.toml`),
  `template-content/` (a `fonts.toml`, and `messages/<lang>.json` for the five languages, empty, call 17),
  `template-project.ts` or `template-file.ts` (the font files copied from `vendor/fonts/fusion-pixel-12/` into the new
  game's `assets/fonts/`, and their `OFL.txt`), the template's `style.css` (`font-family: var(--af-font)` in place of
  `sans-serif`, and the built `fonts.css` imported), `create-game.ts` (after writing the files, run the font build once
  so the new game starts with its subsets and `fonts.css`, as `automata-content assets` writes them),
  `packages/tools/scripts/copy-editor.ts` or a sibling script in the tools build (copy the three fonts and `OFL.txt`
  into `dist`: the package publishes only `dist` and `VENDORED.md`, so `files` cannot reach `vendor/`),
  `tooling/consumer-smoke/tests/e2e/stranger.test.ts` (lines 137-140 expect the title right after load; the created
  game now meets the language screen first. Press the detected language inline: the smoke installs only published
  packages, so it cannot import `@automata/tools/e2e`)
- Test: `packages/tools/tests/unit/shared/create-game/template-ui-sounds.test.ts`, `template-fonts.test.ts`

The 3D template (`template-3d-*.ts`, behind the 3D gate) is not changed: it stays one language with no `fonts.toml`,
which the words check accepts. Say so in its doc comment.

**Interfaces:**
- Consumes: `GameSpec.uiSounds` as a function (task 9); the template's `sounds?.cue(name)` (`AudioStageHandle`); the
  font set (task 5b).
- Produces: a new game whose `defineGame` has `uiSounds: (name) => void sounds?.cue(`ui.${name}`)` (exported from
  `feel-audio.ts` as `uiSounds`) and `locale: { locales: [...DEFAULT_LOCALES], baseLocale: 'en' }`; three cues in the
  template's `audio.toml`, written in the form of the cues already there so the Audio editor opens and changes them:
  - `ui.press`: a short square blip, 660 Hz, 60 ms
  - `ui.back`: a falling blip, 440 Hz to 330 Hz, 80 ms
  - `ui.focus`: a tick, 880 Hz, 25 ms, half the level of `ui.press`

  and a `content/fonts.toml` that names the three flavours and the languages each serves (`ja`: `en`, `es-419`,
  `pt-BR`, `ja`; `ko`: `ko`; `zh_hans`: `zh-Hans`), with `license = "OFL-1.1"` and `reserved_name = "Fusion Pixel"`, in
  the form `build-fonts.ts` reads. The cues are written in the template's existing form
  (`template-content/audio/audio.toml`: `[[cue]]` with `id`, `about`, `bus = "ui"`,
  `voices = [{ tone, from, to, length, volume }]`).

- [ ] **Step 1: Write the failing tests:** the generated game's files hold `uiSounds` and `locale` in the `defineGame`
  call; its `content/audio/audio.toml` parses with `audioSchema` and has the cues `ui.press`, `ui.back` and `ui.focus`;
  its `content/fonts.toml` lists all six languages and every font file it names exists in the generated game with the
  sha256 it records; `OFL.txt` is beside them.
- [ ] **Step 2: Implement.** `packages/tools` may not import `@automata/audio-synth`: the map is template text, and if
  the test needs the schema, put the test where the existing template-content tests parse it.
- [ ] **Step 3: Run** `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/shared/create-game`, and the
  slow created-game test by hand (`packages/tools/tests/slow`): the new game builds and `automata check --only words`
  passes in it. The consumer smoke needs the packed packages and the network (`pnpm test:e2e --filter
  @automata/consumer-smoke`): run it if this machine can, else report it as not run. Say which ran.
- [ ] **Step 4: Commit** `feat(tools): a new game has button sounds, six languages and a font that draws them`.

### Task 11: Splash (`@automata/ui-screens`)

Behaviour reference (read, do not copy): `ff:apps/client/src/ui/components/SplashRoot.svelte` (any press goes on,
the reduced-motion rule). FloorFifty's splash waits for the player behind a load bar; the spec's splash is held briefly
and skippable, so the hold is this plan's, not the reference's.

The package's rules decide the layout (audit B3): a screen folder under `features/` holds only Svelte files that import
`@automata/framework`, `svelte` and each other (the copy-in test, `tests/unit/screens/screens-copy.test.ts`, which reads
every file of every folder under `features/`); a feature imports only itself and `shared/` (`pnpm boundaries`). So the
screen takes its words as props, the words live in `shared/words/`, and the step that wires clock, words and screen is
in `app/`.

**Files:**
- Create: `extensions/ui-screens/src/features/splash/SplashScreen.svelte`,
  `extensions/ui-screens/src/shared/words/{en,ja,ko,es-419,pt-BR,zh-Hans}.json`, `shared/words/context.json`,
  `shared/words/stamps/<lang>.json`, `shared/words/screens-words.ts`, `extensions/ui-screens/src/app/splash-step.ts`
  (with `SplashCopy`, `SplashOptions`), `extensions/ui-screens/src/entries/splash.ts`
- Modify: `extensions/ui-screens/src/entries/index.ts`, `package.json` (exports `./splash` and `./words/*.json`, in
  `exports` and `publishConfig.exports`), `README.md` (Splash in the table; "Four ready-made screens" becomes six),
  `tests/unit/screens/entries.test.ts` (its "one path per screen and nothing else" names `./words/*.json` as the one
  other path), `tests/unit/screens/screens-copy.test.ts` (the copy-in case mounts the splash too)
- Test: `extensions/ui-screens/tests/unit/splash/splash-screen.test.ts`,
  `extensions/ui-screens/tests/browser/splash/splash-screen.test.ts`

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
A game that copies `features/splash/` into its own source gets a screen that still works; it passes its own words.

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

- [ ] **Step 2: Implement.** Write the five translations new and bring them in with
  `automata words import --catalog extensions/ui-screens/src/shared/words` (so they are stamped).
- [ ] **Step 3: Run** `pnpm --filter @automata/ui-screens test:unit` and `test:browser --browser.name=chromium`.
- [ ] **Step 4: Commit** `feat(ui-screens): a studio splash as an opening step`.

### Task 11b: `Hosting.openLink` on every target

The framework names a `links` capability (`shared/host/capability.schema.ts`) but `Hosting` has no call to open one.
The vendored Ruken SDK has `links.open(url): Promise<{ opened: boolean }>` (`vendor/ruken/ruken-sdk-0.0.0.tgz`,
`dist/index.d.ts`), so nothing is asked of Ruken. Behaviour reference (read, do not copy): `ff:apps/client/src/ruken/host.ts`
`openLink`.

**Files:**
- Modify: `packages/automata/src/shared/host/hosting.ts` (the interface), `features/targets/ruken/hosting-ruken.ts`,
  `features/targets/web/hosting-web.ts` (its `granted` set, lines 252-253, gains `links`; call 11),
  `features/targets/tauri/hosting-tauri.ts` (the same) and `desktop-tauri.ts`, `testing/host/fake-hosting.ts`,
  `testing/host/target-grants.ts` (`defaultGrants` gives `links` to `web`, `itch` and `tauri`),
  `testing/host/contract-suite.ts` (its `HostingFactory` takes the grants a case needs, so the ungranted case can build
  a `Hosting` without `links`; this is a published `/testing` export, so its doc comment changes too),
  `packages/automata/package.json` (`@tauri-apps/plugin-opener` as an optional peer and a dev dependency, beside the
  other `@tauri-apps/*`; `pnpm deps:new` reports it in CI), the tauri target's project in
  `packages/tools/src/shared/ship/targets/tauri/tauri-project.ts` (pin `tauri-plugin-opener` in `Cargo.toml` beside
  `tauri-plugin-store` and `-process`, register it in `main.rs`, and allow `opener:allow-open-url` for `https:` only in
  `capabilities/default.json`), `define-game.ts` (`wantsOf`: no change; a game asks with `hosting: { wants: ['links'] }`)
- Test: the suite runs in `packages/automata/tests/unit/targets/web/hosting-web.test.ts`,
  `targets/tauri/hosting-tauri.test.ts`, `targets/ruken/hosting-ruken.test.ts` and
  `tests/unit/testing/host/fake-hosting.contract.test.ts` (`tests/unit/shared/host/contract.test.ts` only pins the
  names, and needs no change); `packages/tools/tests/unit/shared/ship/` (the tauri project test)

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
- A URL that does not parse, whose scheme is not `https:`, or that carries a user name or password (the SDK's own rule,
  `@ruken/sdk` `dist/index.js:105`) is refused `INVALID_PAYLOAD` and nothing is opened.
- Without the `links` grant the call is refused `UNSUPPORTED` (`ungrantedCode` in `testing/host/target-grants.ts`; the
  codes are in `shared/host/error-code.schema.ts`) and nothing is opened. It never falls back to another way of
  opening.
- Ruken: `session.links.open(url)` through the adapter's `whileOpen`, as `setFullscreen` goes; `{ opened }` from the
  SDK's answer; an SDK refusal maps through `errors-ruken.ts` as every other call's does. Ruken's fake host answers
  Cancel to a link by default (`@ruken/sdk-host/testing`, its recording `HostUi`), so the Ruken run of the
  "opened: true" case sets the responder to open.
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
- [ ] **Step 4: Run** `pnpm --filter @automata/framework exec vitest run --project unit tests/unit/targets tests/unit/testing`
  and the tools' tauri project test. A real desktop build opening a real browser is the Owner's to try: report it as
  not run.
- [ ] **Step 5: Commit** `feat(framework): a game opens a link through its host`. In `docs/guides/publish-to-ruken.md`, `publish-to-web.md`,
  `publish-to-itch.md` and `publish-to-desktop.md` add one line each on what a link does there (task 18 checks them).

### Task 12: Credits (`@automata/ui-screens`)

Behaviour reference (read, do not copy): `ff:apps/client/src/ui/components/CreditsPanel.svelte`,
`ff:apps/client/src/common/credits.ts`.

The same layout as task 11 (audit B3): the panel alone is the screen folder; the schema, the content kind and the
words are `shared/`. `CreditsPanel.svelte` declares its props' types in its own `<script>` (the copy-in test reads
`import type` too), and `shared/credits/credits.schema.ts` holds the same shapes, so a `Credits` value fits the props.

**Files:**
- Create: `extensions/ui-screens/src/features/credits/CreditsPanel.svelte`,
  `extensions/ui-screens/src/shared/credits/credits.schema.ts`, `shared/credits/credits.content.ts`,
  `shared/words/credits-copy.ts`, `extensions/ui-screens/src/entries/credits.ts`
- Modify: `entries/index.ts`, `package.json` (export `./credits`; `zod` as a dependency at the version core uses; and
  `@automata/content` as a peer, since `credits.content.ts` imports `@automata/content/schema`, as
  `extensions/feel/package.json` has both), the six words files, `README.md`, `tests/unit/screens/entries.test.ts`
- Test: `extensions/ui-screens/tests/unit/credits/{credits-schema,credits-panel}.test.ts`,
  `extensions/ui-screens/tests/browser/credits/credits-panel.test.ts`

**Interfaces:**
- Consumes: `Hosting['openLink']` (task 11b).
- Produces:

```ts
// shared/credits/credits.schema.ts
export interface CreditName { readonly name: string; readonly role?: string; readonly url?: string }
export interface CreditsSection { readonly title: string; readonly names: readonly CreditName[] }
export interface Credits { readonly sections: readonly CreditsSection[] }
/** Strict. `title` and `role` are text a translator sees; `url` must be `https:`. At least one section, one name each. */
export const creditsSchema: z.ZodType<Credits>
export const creditsSchemaWith: (text: z.ZodType<string, string>) => z.ZodType<Credits>
// shared/credits/credits.content.ts, in the form of extensions/feel/src/features/frame/feel.content.ts
/** The `credits` content kind: `content/credits/credits.toml`; section titles and roles are `localized()`. */
export const creditsContent: ContentSchemaDef<'credits', z.ZodType<Credits>>
// shared/words/credits-copy.ts
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

- [ ] **Step 2: Implement.** Write the words' five translations new and bring them in through `automata words import`.
- [ ] **Step 3: Run** `pnpm --filter @automata/ui-screens test:unit` and `test:browser --browser.name=chromium`, and the package’s
  screens-rule and copy-in tests.
- [ ] **Step 4: Commit** `feat(ui-screens): a credits panel drawn from a content file, its links opened by the host`.

### Task 13: Achievements in `ruken.toml` and `automata check`

Behaviour reference (read, do not copy): `ff:apps/client/src/ruken/score-boards.ts`; `@ruken/manifest` (`vendor/ruken/ruken-manifest-0.0.0.tgz`).

**Files:**
- Modify: `packages/content/src/shared/game/game-config.schema.ts`,
  `packages/tools/src/shared/ship/targets/ruken/ruken-toml.ts`,
  `packages/tools/src/shared/check/check-source-steps.ts` (new `achievementsStep`), `run-check.ts`, `check-report.ts`
  (`STEP_NAMES`), `app/help.ts`, `packages/tools/src/shared/words/catalog.ts` (the `achievements` catalog), and a
  ship-config loader port beside `Files` in `packages/tools/src/shared/node/` (`ShipConfigLoader`: production imports
  the file as `app/ship-cli.ts:34` does; tests give a value)
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
- `achievementsStep` loads `ship.config.ts` through `ShipConfigLoader`, builds the manifest text with `rukenToml` and
  parses it with `parseManifest`. It cannot scan the text as the `boards` step does (`check-source-steps.ts:48-77` reads
  only board names from the object literal): `rukenToml` needs the whole config (audit S4). A config that fails to load
  is a tool error, never a pass. Each error whose code starts `ACHIEVEMENT_` or `LEADERBOARD_TITLE` becomes a finding
  in plain words, with Ruken's own message after it:

  | Code | Finding starts |
  |---|---|
  | `ACHIEVEMENT_ID_INVALID` | `achievement "<id>": the id must be lowercase letters, digits and hyphens, and not start with "ruken-".` |
  | `ACHIEVEMENT_BOARD_UNKNOWN` | `achievement "<id>": its board is not one of this game's leaderboards.` |
  | `ACHIEVEMENT_RULE_INVALID` | `achievement "<id>": it needs exactly one rule: reach, top_percent or top_rank.` |
  | `ACHIEVEMENT_TEXT_INVALID` | `achievement "<id>": its title or description is empty or too long.` |
  | `ACHIEVEMENT_LIMIT` | `this game declares more achievements than Ruken allows.` |

  No `ship.config.ts`, or no achievements: no findings. The step is named `achievements`, runs after `boards`, and
  `CHECK_HELP` gains `achievements  every achievement is one Ruken will accept`.
- The `itch`, `web` and `tauri` targets ignore the table; add one assertion to each target's prepare test that a config
  with achievements prepares as before.
- Titles and descriptions reach the words workflow as a third game catalog, `achievements`, whose source is derived
  from `ship.config.ts` through the same loader (`achievement_<id>_title`, `achievement_<id>_description`) and whose
  translations are
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

- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** `pnpm --filter @automata/content exec vitest run --project unit tests/unit/shared/game` and
  `pnpm --filter @automata/tools exec vitest run --project unit tests/unit/shared`.
- [ ] **Step 4: Commit** `feat(tools): a game declares Ruken achievements beside its leaderboards`.

### Task 14: Stale-build check

Behaviour reference (read, do not copy): `ff:apps/client/src/managers/boot-version-check.ts`. It differs on purpose:
FloorFifty never holds its title and reports a late answer whenever it comes; here the step waits at most `waitMs`
(call 12) and a later answer is dropped, since the join check still refuses a stale client.

**Files:**
- Modify: `extensions/net-server/src/features/operations/probes.ts` (`ProbeState.version`, `GET /version`), and where
  `installProbes` is called in `extensions/net-server/src/app/start-server.ts` (pass the server's `GameVersion`)
- Create: `extensions/net/src/features/client/version/check-server-version.ts`,
  `extensions/net-ui/src/features/stale/StaleBuild.svelte`, `stale-build-step.ts`,
  `extensions/net-ui/src/shared/words/{en,ja,ko,es-419,pt-BR,zh-Hans}.json` (in `shared/`, not a feature of its own, so
  the `stale` feature may import them under `pnpm boundaries`),
  `shared/words/context.json`, `shared/words/stamps/<lang>.json`, `shared/words/stale-copy.ts`
- Modify: `extensions/net/src/entries/index.ts`, `extensions/net-ui/src/entries/index.ts`, `extensions/net-ui/package.json`
  (export `./words/*.json` in `exports` and `publishConfig.exports`, so `gameWords` finds it),
  `extensions/net/README.md`, `extensions/net-server/README.md`
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
// net-ui features/stale/stale-build-step.ts
export interface StaleCopy { readonly message: string; readonly reload: string } // en: 'This game was updated. Reload to get the new version.', 'Reload'
export interface StaleBuildOptions {
  readonly facts: BuildFacts                             // the game's own: { protocol: PROTOCOL_VERSION, ...the version it joins with }
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
this package's own catalog (`extensions/net-ui/src/shared/words/`, exported as `./words/*.json`), written new and
brought in through `automata words import --catalog extensions/net-ui/src/shared/words`. The facts a game passes are
what it already joins with (`extensions/net/src/features/client/room/net-room.ts:300-302`).

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

- [ ] **Step 2: Implement.** In `extensions/net/README.md` add a "Tell a player their tab is out of date" section with the
  three lines a game writes; in `extensions/net-server/README.md` add `GET /version` to the routes.
- [ ] **Step 3: Run** `test:unit` in the three packages and net-ui's `test:browser --browser.name=chromium`.
- [ ] **Step 4: Commit** `feat(net): an online game says its tab is out of date before the title`.

### Task 15: The four examples and their journeys

**Files:**
- Create: `examples/2d/core/core-languages.ts`, `examples/2d/core/core-first-run.ts`,
  `examples/2d/audio/audio-ui-sounds.ts`, `examples/2d/ui/ui-splash-credits.ts`,
  `examples/2d/resources/sounds/{ui-press,ui-back,ui-focus}.wav` and a line each in `PROVENANCE.md`,
  `examples/2d/resources/logo/studio.svg` (a plain placeholder mark drawn for this repository: a circle and the word
  "Studio", DUEL palette, in `PROVENANCE.md`),
  `examples/2d/tests/e2e/{core-languages,core-first-run,audio-ui-sounds,ui-splash-credits}.test.ts`,
  `examples/2d/public/fonts/` (the subsets and `fonts.css` the examples draw in) and a unit test that keeps them fresh,
  as the atlas is kept (`examples/2d/content/atlases.toml` names the test): the examples' runner compiles no content
  (`tooling/examples-runner/src/vite-plugin.ts`), so a `content/fonts.toml` there would never be built. The test runs
  `buildFonts` over a `fonts.toml` beside it and the framework's and `ui-screens`' words, and fails when the committed
  files differ. The two language examples import `/fonts/fonts.css`.
- Modify: `examples/2d/package.json` (add `@automata/ui-screens`), `examples/2d/playwright.config.ts` (a third project,
  `examples-ipad`, `use: { ...sizes.ipad, deviceScaleFactor: 1 }`, same `testDir` and ignore), `examples/README.md`
  (four rows)

The examples run under Ruken's fake host (`tooling/examples-runner/host/ruken/host.ts`): kind `ruken`, session locale
`en-US`, and a link answered Cancel. So the language screen never shows there, and a saved language choice outranks
the host's locale. A journey that needs the first run opens the example's page directly, where the Ruken adapter's
standalone session (kind `standalone`) uses the browser's language. The smoke test still boots each example under the
host and waits for `data-state="ready"`, which is set before the opening runs.

Each file opens with the header the catalog checks (`// <module>-<name>: <title>`, `Shows`, `Controls`, `Packages`,
`Difficulty`, `Tier`; no `Golden`, since none has a sim worth replaying beyond a still field). The synthesized sounds are
made the way `chime.wav` was (`resources/sounds/PROVENANCE.md` says how); they are the examples' own.

| File | Title line | What it does |
|---|---|---|
| `core-languages.ts` | `core-languages: The menus in six languages` | `locale: { locales: [...DEFAULT_LOCALES], baseLocale: 'en' }`, `firstRunLanguage: false`, default screens. `Tier: core` |
| `core-first-run.ts` | `core-first-run: A first run asks for a language and warns about flashing` | six locales, `photosensitivity: { switches: [one in-memory "Flashing" switch] }`. Its `Shows` line says the first run shows standalone and a Ruken host skips the language. `Tier: core` |
| `audio-ui-sounds.ts` | `audio-ui-sounds: Buttons that sound, a Back that sounds different, one that stays silent` | `uiSounds: { press, back, focus }` from the three files; a `title.actions`-free page: default screens, whose Back and mute already carry `data-sfx`. `Tier: core` |
| `ui-splash-credits.ts` | `ui-splash-credits: A studio splash, then a title with Credits` | `opening: [splashStep({ logo })]`, custom `screens` with `@automata/ui-screens`' Title (`extra: [{ id: 'credits', … }]`) that opens `CreditsPanel` over inline credits parsed by `creditsSchema`, with `hosting: { wants: ['links'] }` and one name with a link. `Tier: extension` |

- [ ] **Step 1: Write the four journeys first** (they fail: the pages do not exist). Each uses `collectErrors` and,
  except `core-first-run`, `openHosted`, as `default-screens.test.ts` does, and ends with `expect(errors).toEqual([])`.

```ts
// core-languages
//  title → play → pause → Settings; pick 日本語 (data-testid of the Language group’s option); the Settings title is ja’s
//  word from @automata/framework/words/ja.json; reload the game in its frame (`frame.evaluate(() => location.reload())`,
//  as core-input-rebind does: the host keeps the saves); the title screen’s Play is still ja’s.
// core-first-run (opened directly, not hosted; `use: { locale: 'ko' }` for this file)
//  first load: first-language-ko is focused; press first-language-ja; the warning’s title is ja’s; toggle the switch;
//  press photosensitivity-continue; title-screen is visible and Play is focused.
//  reload: title-screen is visible with no first-run screen (assert neither test id is attached).
// audio-ui-sounds
//  the page counts plays in `window.__uiSounds` (the example wraps its map in a function that records the name, then plays).
//  click Play → ['press']; Pause, then Back/Resume marked data-sfx="back" → 'back' recorded; the mute toggle → nothing new.
// ui-splash-credits
//  the splash logo is visible with its alt text; a tap ends it; title-screen shows; press Credits; the panel lists the
//  names; pressing the linked name sends `links.open` to the fake host (the host page's `hostTrace()` lists it) and,
//  as that host answers Cancel, the refusal line shows; Escape closes the panel and focus is back on Credits.
```

  Read the words the journeys compare against from the catalogs; never write a translation into a test by hand.
- [ ] **Step 2: Run** `pnpm --filter @af-examples/examples-2d test:e2e --project examples -g "core-languages|core-first-run|audio-ui-sounds|ui-splash-credits" --trace off`
  (pnpm passes the flags on; no `--`); confirm the four fail for the missing page.
- [ ] **Step 3: Write the four examples.**
- [ ] **Step 4: Run** the same command for `examples`, `examples-compact` and `examples-ipad`; then the catalog and
  smoke tests (`examples.test.ts`) and `pnpm --filter @af-examples/examples-2d typecheck`. All pass in Chromium. Then
  build the site's playground (`site/playground/build.ts`) and report whether `ui-splash-credits` runs there (call 20,
  open).
- [ ] **Step 5: Commit** `feat(examples): languages, a first run, interface sounds, and a splash with credits`.

### Task 16: Emberwick in six languages, with an achievement

**Files:**
- Create: `games/emberwick/messages/ui/{en,ja,ko,es-419,pt-BR,zh-Hans}.json`, `games/emberwick/messages/ui/context.json`,
  `games/emberwick/messages/ui/stamps/<lang>.json`, `games/emberwick/src/features/screens/words.ts`,
  `games/emberwick/content/fonts.toml`, `games/emberwick/assets/fonts/` (the three flavours and `OFL.txt`, copied from
  `vendor/fonts/fusion-pixel-12/`), `games/emberwick/content/messages/{ja,ko,es-419,pt-BR,zh-Hans}.json` (empty
  catalogs: Emberwick's content has no text, and these files are what make the five content languages, call 17;
  without them the font build refuses `ja` in `fonts.toml` as "not a content language"), the font build's committed
  outputs (subsets, `fonts.json`, `fonts.css`) where `automata-content assets` writes them
- Modify: `games/emberwick/src/features/screens/emberwick-screens.ts` (panels from words, re-drawn on a language
  change; the end screen submits the round's time), `src/app/make-game.ts` (`locale`, `hosting.wants`),
  `ship.config.ts` (`content.languages`, `leaderboards`, `achievements`), `style.css` and `package.json` (the font set
  in place of `@fontsource/pixelify-sans`: import the built `fonts.css` and set `--pixel-font: var(--af-font)`, call 16,
  with no generic or system family after it; the panels' `font-weight: 700` becomes 400 with `font-synthesis: none`,
  since a one-weight pixel face would be faked bold), `playwright.config.ts`
- Test: `games/emberwick/tests/unit/screens/words.test.ts`, `tests/unit/ship-config.test.ts` (add cases),
  `tests/e2e/emberwick-languages.test.ts`

**Interfaces:**
- `words.ts`: `emberwickWords(locale: string): EmberwickWords`, where `EmberwickWords` has one field per string in today's
  `PANELS` (`splashHint`, `menuTitle`, `menuHint`, `play`, `keysMove`, `keysJump`, `keysPause`, `pause`, `pausedTitle`,
  `resume`, `backToMenu`, `endTitle`, `playAgain`, `menu`, the splash panel's `aria-label` as `splashLabel`, and the
  time line as `time: (seconds: string) => string`). The "AutomataFramework" mark and the key caps are not words.
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
// journey, one Playwright project per language (`use: { locale: '<tag>' }`), phone size, Chromium. It opens the game's
// own origin (`gameUrl` in tests/e2e/origins.ts) with no host page: Emberwick's other journeys run inside Ruken's fake
// host, whose session locale is fixed at en-US and outranks the browser's, and a Ruken host skips the first run.
//  passFirstRun(page): the detected language's button has focus; press it; the menu’s Play reads the catalog’s word
//  for that language; play, pause: the paused title and Resume read the catalog’s words; quit to menu.
```

- [ ] **Step 2: Implement.** Move the English out of `PANELS` into `messages/ui/en.json` and build the panels from
  `emberwickWords(services.locale.current)`; subscribe to the locale for as long as the screen is open and redraw the
  words in place (set `textContent`, never rebuild the panel, so focus stays). Text goes in with `textContent`.
- [ ] **Step 3: Translate through the workflow,** as a translator would: `automata words export ja` (and the other
  four) in `games/emberwick`, fill the CSVs with translations written new, `automata words import <lang>
  words-<lang>.csv`, then `automata words status` (`0 missing, 0 stale` for all five). Paste the status output into the
  commit body. Do not commit the CSVs.
- [ ] **Step 4: Move Emberwick to the font set.** `content/fonts.toml` names the three flavours and the languages each
  serves, as the template's does (task 10); `automata-content assets` writes the subsets, `fonts.json` and `fonts.css`,
  committed; `style.css` imports `fonts.css`. The end screen's leaderboard submit runs under the existing journeys' fake
  Ruken host too: check it logs no console error there. Look at the game in Chromium in `en`, `ja`, `ko` and
  `zh-Hans` at phone size: the menu, paused and end screens read in the pixel font with no fallback glyphs, and nothing
  that fitted in Pixelify Sans now overflows (the layout tests say so; fix the layout, never shrink a target). The
  existing visual goldens that hold text will move: look at each expected, actual and diff image and say in the commit
  that the font is why. Record the subsets' total size.
- [ ] **Step 5: Run** `pnpm --filter @af-games/emberwick check`, `automata check` in the game's folder (the `words`,
  `boards` and `achievements` steps pass; then break it once by hand, adding a character the font lacks to `ja.json`,
  see `words` fail, and undo it), and `pnpm --filter @af-games/emberwick test:e2e --trace off` in Chromium:
  the existing journeys and the six language projects.
- [ ] **Step 6: Commit** `feat(emberwick): six languages in a font that draws them, and an achievement`.

### Task 17: Ember Hall (`games/base-3d`) in six languages

Ember Hall already has Paraglide, its catalog at `src/messages/ui/{locale}.json` and core's default screens, so core's
menus translate with no work. This task translates its own few words.

**Files:**
- Create: `games/base-3d/src/messages/ui/{ja,ko,es-419,pt-BR,zh-Hans}.json`, `src/messages/ui/stamps/<lang>.json`,
  `src/messages/ui/context.json`; `games/base-3d/content/messages/{ja,ko,es-419,pt-BR,zh-Hans}.json` (translations of
  its content text, or empty catalogs if it has none: these files are what make the content languages, call 17, and
  Paraglide compiles only those, `packages/content/src/shared/locale/compile-messages.ts:5-6`);
  `games/base-3d/content/fonts.toml` (it has none today) and the three font flavours; the font build's outputs
- Modify: `games/base-3d/ship.config.ts` (`content.languages`), its styles (import `fonts.css`), and its journeys
  (`passFirstRun` where a journey opens the game standalone)
- Test: `games/base-3d/tests/unit/` (a `words.test.ts`: every language has exactly the source keys and placeholders, by
  `translationProblems`)

- [ ] **Step 1: Write the failing test.**
- [ ] **Step 2: Run; confirm it fails** on the missing files.
- [ ] **Step 3: Translate through the workflow** (`automata words export|import|status` in `games/base-3d`), as in task
  16, with translations written new. Then move the game to the font set as in task 16's font step (its text is the menus
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
- [ ] **Step 3:** `pnpm test:browser:2d -- --browser.name=chromium` (the root script forwards through turbo, which
  needs the `--`), and the examples', Emberwick's and the consumer smoke's journeys in Chromium with `--trace off`.
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
  - not run here: WebKit, Firefox, real devices, the 3D workflow if so. These are the Owner's;
  - the open calls, as answered or still open: the font's reserved name (call 13), Credits from Settings (call 19), the
    site's playground (call 20).
- [ ] **Step 5: Commit** `docs: shared polish, the guides, the API index and the record`, push, and report the commit to
  the coordinator.

---

## Order and checks

- **Order:** 1, 2, 3, 4, 5, 5b, 6, 7, 8, 9, 10, 11, 11b, 12, 13, 14, 15, 16, 17, 18. Task 11's `screensWords` names
  `CreditsCopy`: declare the type in task 11 with the splash words alone and widen it in task 12.
- **Checked:** the plan was written against the spec and its amendments, then audited against the spec, `AGENTS.md`
  and the code on `main` at `b1f339c3` (the audit linked at the top: spec coverage, every named file, export, code and
  command, and the things the first draft left unverified). Where the audit found the code differed from what the plan
  assumed, the task above now says what the code is.
