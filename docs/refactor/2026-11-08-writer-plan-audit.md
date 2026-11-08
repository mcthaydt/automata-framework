# Writer plan audit

Status: plan audit, 2026-11-08. Audits [`2026-11-08-writer-spec.md`](2026-11-08-writer-spec.md) and
[`2026-11-08-writer-plan.md`](2026-11-08-writer-plan.md) against the shared
[`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md), the content-in-play plan (PR #479/#481,
whose dialogue box reads `words(key)`) and the code on `claude/project-thread-j53mj6` at `9abece4f`. Every finding was
checked in the code named beside it. The fixes are applied to the spec and plan in the same commit as this audit.

## 1. Verdict

The decision that a line keeps its words (`words`, `localized()`) holds against the content compiler: the compiled
artifact keeps the plain string and the catalog gets a key. But the plan's `wordsOf` cannot rebuild that key, and AF
already has the one runtime lookup for it (W3). A translated game breaks its content build when a line is added or
removed, which the spec does not say (W2). One action writes two files and the suite's undo gives two steps (W5). The
plan had no proof in play of its own; it now runs the content-in-play journey's Writer step (W1).

## 2. Findings

| # | Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| W1 | Blocker | No served journey of its own. The proof is content-in-play Task 16, which the plan never names. | Plan Task 6; content-in-play plan Task 16 | New Task 7: run Task 16's Writer step (change the keeper's words, Save, Play, the box shows them) plus a new line and choice; left unchecked, and named, until `examples/2d-story` lands. Writer is not done until it runs. |
| W2 | Major | A message key holds the line's index (`content_lines_<file>_lines_<i>_words`), and the compiler fails a translation that lacks a source key or has an extra one. So in a translated game, **adding or removing** a line fails the content build until every translation is updated, and a removal re-keys every later line. | `packages/content/src/shared/locale/messages.ts messageKey, checkTranslation`; `compile-content.ts` step 5 | Spec §4 says it. After an add or remove in a translated game, the status says "French needs this change before the game builds." (each language named). Keying line messages by id is an open choice for the content compiler (spec §8). |
| W3 | Major | `wordsOf(lines, translation?, keyOf?)` takes a flat list, but the key needs the lines file's content id, which a flat list has lost. And AF's one runtime lookup of authored text in the active locale is `createContentText` (`@automata/content/locale`), built on `messageKey`, the one owner of the key format. | `packages/content/src/shared/locale/content-text.ts` | `wordsOf(files: Readonly<Record<string, LinesFile>>, text?: ContentText): ReadonlyMap<string, string>`: for each line with `words`, `text('lines', fileId, ['lines', i, 'words'], words)`, keyed by the line's `text`. |
| W4 | Minor | `localized()` is `min(1)`: empty words fail the schema. | `content-schema.ts localized` | Clearing the words field removes the key ("No words yet"); tested. |
| W5 | Major | **Add a choice** writes the player's line (lines file) and the choice (dialogue file). An editor's writes go through the suite's write path one file per undo step (`writeAll` is used only by imports), and `undoOf` follows one file's history. | `packages/editor/src/features/suite/shell/suite-history.svelte.ts`; `core/interchange.ts:261`; `extensions/editors/src/shared/session-hooks.ts` | Two undo steps, labelled "Write the player's line" and "Add a choice"; a new `undoOfMany(sessions)` follows the right file for each step from the order they were written. A one-step two-file write would need the kit to give editors `writeAll`, which the plan does not take on. |
| W6 | Minor | `@automata/editors` lists neither `@automata/narrative` nor `@automata/puzzle` (the dialogue's conditions are `@automata/puzzle/sim`'s `Cond`). | `extensions/editors/package.json`; `dialogue.schema.ts:4` | Task 3 adds both. |
| W7 | Major | Spec §3.4's "There is no line shop.thanks yet." prints a line id, which the plan's Global Constraints forbid and its own DOM test scans for. | Writer spec §3.4; plan Global Constraints | "This part says a line that no longer exists." |
| W8 | Minor | The id example differs: spec §3.2 `shop.welcome_in`, plan Task 2 `shop.welcome_in_mind_the`. | Spec §3.2; plan Task 2 | Spec follows the plan's rule. |
| W9 | Minor | The narrative lint through the checks port needs a `narrative.pipe.toml` naming the scene's code module, which a made game lacks; Task 5 already computes the structure problems in the page. | `extensions/pipelines/src/features/narrative/narrative-pipeline.ts:1-33` | Task 5 drops the checks-port half; the page's problems are the proof. Voice rules (canon) stay out with the canon. |
| W10 | Minor | `saidBy` must read cutscene captions, but Writer has no cutscenes dependency. | `extensions/cutscenes/src/shared/sim/cutscene.schema.ts Caption.line` | Read `content/cutscenes/*.toml` as documents (`openDocument`) and take `caption[].line`, with no schema. |
| W11 | Minor | No browser project for the layout test (see Feel F10). | `extensions/editors/vitest.config.ts` | Uses the project Feel's Task 4 adds. |

## 3. Drunk grandma

The script view ("Shopkeeper: Welcome in."), the kind words, "Goes to", "Only if" and the problem sentences pass, with
W7 fixed. "Standing: Warmer +1" passes.

## 4. What was checked and holds

`lineSchema`, `LINE_KINDS`, `linesFileSchema` (no duplicate ids), `dialogueFileSchema` (start, `next` and choice
targets checked), `localized()` turning text into a marker the compiler resolves back to the plain string; the content
kinds' folders (`lines`, `dialogue`); the content-in-play dialogue box reading `words(key)` by the line's `text`.
