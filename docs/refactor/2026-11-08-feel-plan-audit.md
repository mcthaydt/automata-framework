# Feel plan audit

Status: plan audit, 2026-11-08. Audits [`2026-11-08-feel-spec.md`](2026-11-08-feel-spec.md) and
[`2026-11-08-feel-plan.md`](2026-11-08-feel-plan.md) against the shared
[`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md), the content-in-play plan (PR #479/#481) and
the code on `claude/project-thread-j53mj6` at `9abece4f`. Every finding below was checked in the code named beside it.
The fixes are applied to the spec and plan in the same commit as this audit.

## 1. Verdict

The editor half is sound and matches the code it builds on (`ContentSession`, `setOrInsert`, `FieldRow`, `createFeel`,
`matches`, `DEFAULT_SETTINGS`). But nothing in a game plays a feel today, so a person who tunes a hit in Feel and
presses Play sees nothing change. That breaks the Owner's standing rule (2026-11-08): what is edited must be seen in
play, proven by a served journey. Two tasks are added for it (F1, F2). Four field details were wrong against the
runtime (F3 to F6), and three build details were missing (F7, F9, F10).

## 2. Findings

| # | Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| F1 | Blocker | Nothing plays `feel.toml` in a game. `feelExtension` registers only the content kind ("The renderer channels, the haptics port and the FeelSection join it later"); no game, example or core module calls `createFeel` (only `extensions/debug`'s board). | `extensions/feel/src/app/feel.extension.ts:1-13`; `grep createFeel` over `games/ examples/ packages/` | New Task 6, **Feel in play**: `@automata/feel/stage` exports `feelStage(options)`, a `PixiRendererOptions.setup` (`(stage) => PixiStageHooks`): `apply(result)` hears `result.events` at `result.tick`; `draw` takes `frameNow` and applies it (offset on `stage.world`, flash and tint over the playfield in `stage.ui`, words over the subject or the middle, squash on the subject's view). `examples/2d-story` wires it. |
| F2 | Blocker | No served journey. The plan's proof is unit, DOM and layout tests only. | Plan Task 6 | New Task 7: in `examples/2d-story` (content-in-play Task 16), Feel answers "the guard changes mode" with a flash; Save; Play; the guard sees the player; the stage's last frame (read through the game's test hook) has the flash. Left unchecked, and named, if the example has not landed. |
| F3 | Major | "How bright" falls back to the limit (`limits.flash_alpha`, 0.85 by default), not to 1. The plan's fallback 1 would remove a key set to 1 and play 0.85. | `extensions/feel/src/features/frame/feel.ts:172` | No fallback for `alpha`; an empty field removes the key and reads "As bright as allowed (0.85)". |
| F4 | Major | Shake can never be above its limit: `shake_px` _is_ the size of a full shake (trauma 1), and `limitWarnings` names no shake. The plan's test (shake 1, "Above the most shake") tests something the runtime cannot do. The freeze limit applies after strength (`min(ms × strength, limit)`). | `feel.ts:159, 215`; `feel.schema.ts limitWarnings` | Shake shows a hint, "At full: 3 px", never a limit note. Limit notes only for freeze, flash frames and flash brightness, the three `limitWarnings` names. |
| F5 | Major | `springs.squash` is a strict object that needs all of `f`, `zeta` and `r`. Inserting only `zeta` makes the file invalid. | `feel.schema.ts` (`spring`) | `springEdit` inserts the whole `[springs.squash]` with the defaults (`f = 4`, `zeta = 0.35`, `r = 0`) and the changed value; **Back to the default** removes the table. |
| F6 | Major | "Which word" offers keys from `generated/messages/en.json`, which is the _content_ catalog (`content_<kind>_<id>_<field>`), not the game's words; and picking a key fails the drunk grandma test. Writer settled the same question by keeping words in the record (Writer spec §4). | `packages/content/src/shared/locale/messages.ts messageKey`; Writer spec §4 | The word row gains `words`, `localized()` in the feel content kind (as Writer's lines); Feel shows **What it says** and sets `key` itself from the entry (`hit.word`). `createFeel`'s `WordPop` carries the words; the stage draws them through `createContentText`. Published change: `patch` changeset. |
| F7 | Minor | Name clash: the editor's factory is `createFeel()` (`feel-suite-editor.ts`) and the stage imports `@automata/feel`'s `createFeel`. Task 4 writes "`createFeel({ outputs? })`" without saying which. | `extensions/editors/src/features/feel/feel-suite-editor.ts:17` | `feel-stage.ts` imports the runtime as `createFeel as startFeel`; Task 4 names the editor factory's option `createFeel({ outputs })` explicitly. |
| F8 | Minor | `content/generated/events.json` does not exist (no generator), so the first source is empty in every game. The events of the extensions a game uses are known statically. | `packages/content` (no events generator); `extensions/systems/src/**/*.event.ts` | `gameEvents` adds the extensions' own events (`systems.mode`, `systems.caught`, `narrative.line`, `cutscene.started`, …) when the game has that extension's content folder. |
| F9 | Minor | `@automata/editors` lists neither `@automata/framework` (`Clock`, `fakeClock`) nor `@automata/sim` (`SimEvent`), which `createFeel`'s options need. | `extensions/editors/package.json`; `feel.ts:7-8` | Task 3 adds both. |
| F10 | Minor | The Chromium layout tests in `tests/browser/` have no project to run in: the package's `vitest.config.ts` is jsdom only and there is no `test:browser`. Same for Audio, Writer and Sequence. | `extensions/editors/vitest.config.ts` | Task 4 adds the Chromium project (`defineTests({ browsers: ['chromium'] })` beside `unit`) and `test:browser`, once for the package. |
| F11 | Minor | The create-game template row for `content/feel/*.toml` is in no plan (the other three editors' plans carry theirs). | Content editors spec §7 | Task 8 adds it. |

## 3. Drunk grandma

The sentences pass. Two fixes: "Which word" (a key) becomes **What it says** (F6), and the shake's false limit note
goes (F4). "Fix the file to play it." and "Only changes this preview." stay.

## 4. What was checked and holds

`matches` (`*` is one or more characters, so `player.*` plays for `player.example`); `FeelSettings` and
`DEFAULT_SETTINGS`; `FeelFrame`'s fields (offset, frozen, flash, tint, squash, words, haptics, cues); the subject read
from the payload's `entity` or `subject`; `ContentSession.change`, `setOrInsert` and the `Field` union; the editor
list's policy for a first file.
