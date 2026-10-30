# PRODUCT.L3a: the `xx-long` pseudo-locale and its layout run in every ui primitive's contract (TDD plan)

- **Spec:** [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §4 item 7 ("A generated `xx-long` locale: about 40% longer, accented, wrapped in brackets. Every `ui` primitive's layout contract also runs in it at every reference size, including 780×270. Clipping, overlap or a hidden action fails."), §9 ownership (`content` owns the compile and catalogs; `ui` the pseudo-locale fixtures); acceptance L-a is the example-level version of this run (not in this plan).
- **Row:** 02 `PRODUCT.L3 — UI locale`. L3 is split: the language picker landed with the Settings redo (#91); **L3a** (this plan) is the pseudo-locale generator and the ui run. Still open in L3 after this plan: ui's physical left/right properties to logical ones and the right-to-left contract, Paraglide keys for ui's boot-failure copy, L-a on the core single-player example, L-b/L-c as e2e.
- **Status:** drafted 2026-10-30 (lane `claude/product-l3a-xx-long`). PRODUCT.0 is Owner-approved with every recommended default (2026-10-16), so this plan may run.
- **Progress:** 2 of 7 steps.

## Source

The generator is extracted from Ruken `packages/localization/src/pseudo.ts` and `pseudo.test.ts` at `d0fa2fe` (`/home/user/rukenapp`, Ruken's own `en-XA` pseudo-locale, P9 §12, R-65). FloorFifty (`677d456`) has no pseudo-locale.

| AF file | Ruken source | Changed |
|---|---|---|
| `packages/content/src/locale/pseudo-locale.ts` | `packages/localization/src/pseudo.ts` | The tag is the spec's `xx-long`, not `en-XA`; the text is 40% longer (spec §4 item 7), not 35%; otherwise the same accent map, `⟦ ⟧` brackets, `·` filler, placeholder and escaped-brace handling, `pseudoMessages` and `hasRawText`. |
| `packages/content/src/locale/pseudo-locale.test.ts` | `packages/localization/src/pseudo.test.ts` | The same cases, at 40% and `xx-long`; the tag case checks that `Intl` accepts the tag (its language is `xx`) instead of naming `en-XA`. |

## Decisions (for the Owner's veto; defaults taken)

- **The generator lives in `@mcthaydt/automata-content/locale`.** It turns a catalog into the `xx-long` catalog, and content owns the catalogs and their Paraglide compile (spec §9), so a game (and `automata check`, PRODUCT.L4) makes its `xx-long` locale there. `runtime/src/locale` cannot own it: `runtime` depends on `ui`, so `ui`'s tests could not import it without a cycle. `ui` takes `content` as a dev dependency for its layout tests only.
- **Brackets are `⟦ ⟧`, as Ruken's.** They never occur in real copy, so `hasRawText` can tell a pseudo-localized span from English that skipped the catalog; ASCII `[ ]` can.
- **Every contract runs twice, in `en` and in `xx-long`, with every variant** (rest, keyboard, Ruken's strip on either side, TV scale) and the same sizes as the English run (the reference sizes, 780×270 among them, and the tight sizes where the English run has them). The xx-long run also fails on any visible text that is not in xx-long (`hasRawText`), outside an element in its own `lang` (the language picker's endonyms), so a fixture or primitive that skips the locale cannot pass vacuously.
- **Fixtures take a `locale` prop** (`'en'`, the default, or `'xx-long'`) and say every word through `say(locale, text)` from `src/testing/locale-fixture.ts`. That module imports `content`, which a game does not install with `ui`, so the published build strips it like the `*Fixture.svelte` components: `finishSvelteDist` drops `*-fixture.js` and `*-fixture.d.ts` (tooling/release).
- **No screenshot baselines.** `ui`'s layout project asserts geometry; it has no screenshot goldens, so this plan writes none. Any primitive whose CSS this plan changes is listed under Owner gates for visual acceptance.

## Global constraints

- Strict TDD in `packages/` and `tooling/`: the failing test first, its failure reason confirmed, then the minimal change.
- A fix to a failure the xx-long run finds keeps 44 px targets and 48 px primaries, hides no required action and uses a declared scroll region (`data-scroll-region`) where content must scroll (AGENTS.md "Responsive UI"). A failing case is never skipped or loosened to pass.
- One contract owner: the contract stays `checkLayout` in `packages/ui/src/testing/layout-contract.ts`; the run reuses it unchanged.
- `ui` and `content` are published: one patch changeset for both. `testing` is untouched.

## Files

- **Create:** `packages/content/src/locale/pseudo-locale.ts`, `packages/content/src/locale/pseudo-locale.test.ts`; `packages/ui/src/testing/locale-fixture.ts`, `packages/ui/src/testing/locale-fixture.test.ts`; `.changeset/product-l3a-xx-long.md`.
- **Modify:** `packages/content/src/locale/index.ts` (exports); `packages/content/src/locale/content-text.test.ts` if the browser-safe import check lists modules; `packages/ui/package.json` (dev dependency `@mcthaydt/automata-content`), `pnpm-lock.yaml`; `tooling/release/src/finish-svelte-dist.ts` and its test; the fixtures `packages/ui/src/testing/{Primitives,Status,Dialog,Display,Screen,Settings,SaveSlots,Touch}Fixture.svelte` (the `locale` prop); the contract tests `packages/ui/src/{m4-primitives,status/status,dialog/dialog,display/display,layout/screen-frame,settings/settings,saves/save-slots,touch/touch}.layout.test.ts` (the xx-long run); any ui component the run finds at fault (with its own failing test); `tooling/api-report/reports/content.api.md`, agent skills and API index output as the tools write them.

## Interfaces

- **Consumed:** `checkLayout`, `publishConditions`, `settleLayout`, `byTestId` (`ui/testing`); `REFERENCE_SIZES`, `TIGHT_SIZES`, `VARIANTS`, `mountFixture` (`@mcthaydt/automata-testing`); Ruken's pseudo-locale (extracted, not imported: `@ruken/localization` is not a package AF consumes).
- **Produced** (`@mcthaydt/automata-content/locale`):
  - `PSEUDO_LOCALE: 'xx-long'`;
  - `pseudoLocalize(message: string): string`: every ASCII letter accented, 40% longer with `·`, between `⟦ ⟧`; `{placeholders}` and escaped braces kept; `''` stays `''`;
  - `pseudoMessages(file)`: a whole inlang message file in xx-long, nested namespaces and plural variants walked, `declarations`, `selectors` and `$schema` kept;
  - `hasRawText(text: string): boolean`: an ASCII letter outside every `⟦ ⟧` span.
- **Produced** (ui, test-only, not published): `FIXTURE_LOCALES`, `FixtureLocale`, `say(locale, text)`, `findUntranslated(root)` in `src/testing/locale-fixture.ts`; each fixture's `locale?: FixtureLocale` prop.

## Steps

- [x] **1. The generator.** Write `pseudo-locale.test.ts` (Ruken's cases at 40% and `xx-long`). Run `pnpm --filter @mcthaydt/automata-content exec vitest run --project node src/locale/pseudo-locale` and confirm it fails because the module does not exist. Write `pseudo-locale.ts`, export it from `locale/index.ts`; confirm it passes, and that `content-text.test.ts`'s browser-safe check still passes.
- [x] **2. Strip test-only fixture modules from ui's dist.** In `finish-svelte-dist.test.ts`, add `testing/locale-fixture.js` and `testing/locale-fixture.d.ts` to the files that must be gone. Run `pnpm --filter @mcthaydt/release exec vitest run src/finish-svelte-dist` and confirm it fails on them. Extend `TEST_ONLY` to `*-fixture.js`/`*-fixture.d.ts`; confirm it passes.
- [ ] **3. The fixture locale helper.** Add `@mcthaydt/automata-content` to ui's dev dependencies. Write `locale-fixture.test.ts` (unit, jsdom): `say('en', 'Play')` is `Play`; `say('xx-long', 'Play')` is `pseudoLocalize('Play')`; `findUntranslated` passes a body of xx-long text, names a text node with English in it, passes English inside an element with its own `lang`, and ignores whitespace and digits. Confirm it fails (no module), implement, confirm it passes.
- [ ] **4. Fixtures say their words in a locale.** Give each fixture the `locale` prop and pass every word it shows (copy objects, labels, children, aria labels) through `say`. The English run's tests are unchanged and must still pass in Chromium (`pnpm --filter @mcthaydt/automata-ui exec vitest run --project layout --browser.name=chromium`, or the instance filter the config allows).
- [ ] **5. The xx-long run, failing first.** In each contract test, run every case in `FIXTURE_LOCALES`, and in xx-long add `findUntranslated(document.body)`. Run the layout project in Chromium, WebKit and Firefox and record every failure (size, variant, case, message) in the execution log.
- [ ] **6. Fix what it finds, test-first.** For each defect: the failing xx-long case is the failing test (plus a focused behavior test where the contract's message does not pin the cause); the minimal CSS or markup change; the English and xx-long runs both pass. No target shrinks, no required action hides; content that must scroll is in a declared scroll region.
- [ ] **7. Gates and bookkeeping.** `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `pnpm api-report` (`--update`), `pnpm api-index` (and `pnpm cheatsheet` if stale), `pnpm agent-skills` (`--write` if asked); the changeset, `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`; parity for ui (`pnpm --filter @mcthaydt/automata-ui test:parity`) and content (`pnpm --filter @mcthaydt/automata-content test:parity`); `pnpm build && node tooling/consumer-smoke/src/run.ts --from packs` (ui's dist and content's exports change). Record the evidence here.

## Owner gates

- Visual acceptance of any primitive whose CSS step 6 changes (listed in the execution log with the sizes it changes at). No screenshot baselines are created or promoted.

## Execution log

(Filled in as each step's check passes.)

- **Step 1 (2026-10-30).** `pseudo-locale.test.ts` failed first on the missing module (`Failed to load url ./pseudo-locale`), and the export cases on `locale/index.ts` (4 failed: `exports PSEUDO_LOCALE` and the rest). After the extraction: `vitest run --project node src/locale` 5 files, 32 tests passed, the browser-safe import walk (`content-text.test.ts`) among them.
- **Step 2 (2026-10-30).** `finish-svelte-dist.test.ts` failed first: `testing/locale-fixture.js: expected true to be false`. With `-fixture.` in `TEST_ONLY`: 3 of 3 passed. No published ui file matches `-fixture.` (`find packages/ui/src -name '*-fixture.*'` was empty before this plan).
