# Sequence plan audit

Status: plan audit, 2026-11-08. Audits [`2026-11-08-sequence-spec.md`](2026-11-08-sequence-spec.md) and
[`2026-11-08-sequence-plan.md`](2026-11-08-sequence-plan.md) against the shared
[`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md), the content-in-play plan (PR #479/#481,
Tasks 14 and 16) and the code on `claude/project-thread-j53mj6` at `9abece4f`. Every finding was checked in the code
named beside it. The fixes are applied to the spec and plan in the same commit as this audit.

## 1. Verdict

The timeline, inspector and preview are the right shape, and the director is pure, so the editor can run it. But the
plan treats every track as keys at `t` and lets a drag reorder keys, both of which the schema refuses (S2, S3). It
names a scene and a level that a cutscene file does not have (S6). Its check and its walls rest on things that do not
exist outside a running 3D game (S5, S7). Its sound row edits data nothing plays (S4). And the content-in-play journey
asks Sequence to change a caption's words, which Sequence cannot do (S1).

## 2. Findings

| # | Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| S1 | Blocker | No served journey of its own, and content-in-play Task 16's Sequence step ("changes the caption to 'Later, at the gate.'") cannot be done: a caption names a line id, the words are in the lines file, and Sequence only picks a line. | `cutscene.schema.ts Caption.line`; content-in-play plan Task 16 | New Task 7: Writer writes a caption line "Later, at the gate."; Sequence picks it for the caption and moves it to 1 s; Save; Play; the caption shows. Content-in-play's build is told to use this step, and that the caption finds its words by line id (line record, then its `text`). Left unchecked until `examples/2d-story` lands. |
| S2 | Major | Key order is part of the schema: a camera key may not come before the one before it, nor an actor key before that actor's previous one. A drag past a neighbour makes the file invalid. | `cutscene.schema.ts superRefine` | A drag clamps between the key's neighbours on its row (equal times stay allowed: two camera keys at one time are a cut). Tested. |
| S3 | Major | Not every track keys by `t`: `cues` use `at`, `shake` is `[from, to, metres]`, `flicker` `[from, to]`, a caption has `t` and `until`. `Mark`, `retimeEdit` and `snap` assume `t`. | `cutscene.schema.ts` | `tracks.ts` has one time accessor per track (`timeOf`, `endOf`, and the key path each writes); retiming a shake writes index 0, its end index 1. |
| S4 | Major | Nothing plays a cutscene's `sound` keys: neither the cutscene system nor the director reads them; only the lint checks they exist. Editing them would not show in play. | `grep sound` over `extensions/cutscenes/src/shared/sim`, `director` | **Add a row** does not offer Sounds; a file that has them shows the row read only: "Sounds in cutscenes don't play yet." `states` and `lintAllow` stay out of the editor. |
| S5 | Major | **Check the scene** through the checks port has no command: `automata-pipe` serves puzzle, systems, narrative and audio only, and `lintCutscene` needs a `LintWorld` with a sectors `ResolvedMap`. | `extensions/pipelines/src/app/registry.ts`; `extensions/cutscenes/src/shared/lint.ts:25` | Out of this build. The page computes the problems a file alone shows: a caption's line is missing or has no words, two captions overlap, a step after the end, a shot shorter than a second (`MIN_SHOT`). |
| S6 | Major | A cutscene file names no scene or level, so "the scene's lines", "the scene's characters" and "the scene's named places" are undefined. | `cutscene.schema.ts CutsceneScript` | Lines: every lines file's, grouped by file, shown by their words. Actors: in 2D the names of placed items with a `name` in the game's levels (content-in-play Task 14 matches `who` to that name), and the names the file already uses. Places: `player`, `actor:<who>` and the names in use. |
| S7 | Major | The preview's walls "through `places`": `places` is a sim contract over a running game, which the editor never runs. "The level's walls show once the game is built." misleads (the game being built changes nothing). | content-in-play plan Tasks 10, 11 | 2D walls come from a level's solid cells read from its file (the readers content-in-play Task 11 uses, metre = one cell); the person picks the level once ("Show over: Hall"), kept in the session only. A 3D game: "Walls show for 2D levels only, for now." |
| S8 | Minor | `@automata/editors` lists no `@automata/cutscenes`, and the cutscene schema imports `easeSchema` from `@automata/3d/timeline`. | `extensions/editors/package.json`; `cutscene.schema.ts:9` | Task 1 adds `@automata/cutscenes` and `@automata/3d`. |
| S9 | Minor | A camera or door key's `ease` may be a curve (`[0.33, 0.67, 0.67, 1]`) or a name; "Moves smoothly" says nothing of a curve. | `extensions/cutscenes/src/testing/fixtures/bay.cutscenes.toml` | A curve shows "Moves (its own curve)" and is kept; choosing **Moves smoothly** removes `ease`. |
| S10 | Minor | No browser project for the layout test (see Feel F10). | `extensions/editors/vitest.config.ts` | Uses the project Feel's Task 4 adds. |

## 3. Drunk grandma

The row names, "Add here", "Move to the playhead" and the problem sentences pass. Changed: a missing line reads "This
step's words were removed." instead of printing `shop.thanks` (a key); the walls message (S7); the sound row (S4).

## 4. What was checked and holds

`createDirector` and `SceneState` (camera, actors, caption, fade, time, grade), `fovOf` for the wedge, the tracks the
schema has, `victory`, the one-script-per-file content kind (`cutscenes` folder), and `MIN_SHOT`, `MAX_CAPTION` in
`@automata/cutscenes/tools`.
