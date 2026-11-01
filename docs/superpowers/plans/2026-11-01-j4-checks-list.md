# J4: base-3d's level in the 3D editor with no unexplained problems (plan)

**Owner journey J4 (2026-11-01, via the coordinator):** open base-3d's level in the 3D editor with no unexplained problems. Scope reset (Owner: "we need to stick to the plan, and actually get things done"): this PR is J4 only; the rest of the earlier EDS.10/11 list is deferred by the Owner's reset (parked on `claude/eds-10-11`, #378). Specs and plans are auto-accepted (Owner, 2026-10-31).

## Findings
1. **The "17 errors" are real problems in the level's data; the editor's checks are right.** `src/content/levels/room.af-sector.json` (hand-written, EG-1/EG-2) gives 4 `heights` and 13 `entities` problems. The 4: both channel sectors are pits (`floor -3`) with `ceiling 0`, so their portals to the `floor 0` rooms "leave no opening"; the game reads `floor < 0` as a pit and ignores the ceiling. The 13: `entityDefs` is `[{id: "ember"}, {id: "goal"}, {id: "spawn"}]`; `af-sector/1` wants `{ id, shape, fields }`, so each of the 3 definitions has 2 faults and the 7 entities are "of a definition that is not defined". `base-3d-level.test.ts` proves it: with the pits' ceiling set to 3 and each definition given `shape = "point"` and `fields = []` the checks report nothing. **The level's data is the game's: not hand-edited here; the two fixes are reported to the coordinator.**
2. **The badge listed nothing (fixed).** New `ChecksList` (4 DOM tests first): every failing check with its problems in the model's sentences and a 44 px Show button on each problem that has a place (it selects it and centres the plan; a refusal is said in words). The pill is now a button opening a Checks dialog; on a phone, where the bar has no room, a Checks button in the status line does; the portrait sheet's Checks tab and the suite's inspector list the problems inline.
3. **`games/base-3d/content/editors.toml` added** (the level to `levels-3d`, the figure folders to `studio`; rows name `src/content/...`).
4. **World view disabled is the intended 1.0 state**: the launch cut puts the world view in "Editor suite beyond the two games" (Post-1.0) and neither 1.0 game has a second level file.

## Real run (WebKit, iPad Pro 11 landscape profile, real `automata editor games/base-3d --app 3d`, 2026-11-01)
Home listed `room.af-sector.json` ("17 errors"); opening it showed the pill "17 problems"; tapping it opened the list: `heights` with its 4 problems and `entities` with its 13, 11 with a Show button (the 6 definition faults have no place in the plan). Not run: a real iPad.

## Gates
`TURBO_FORCE=true pnpm check`; editor-3d dom and layout; no published package changed (editor-3d is private): no changeset.
