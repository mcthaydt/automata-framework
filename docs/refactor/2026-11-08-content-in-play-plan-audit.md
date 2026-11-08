# Plan audit: edited content shows in play

2026-11-08. Stage 3 (plan audit, Opus medium) of the normal dev pipeline for
[`2026-11-08-content-in-play-spec.md`](2026-11-08-content-in-play-spec.md) and
[`2026-11-08-content-in-play-plan.md`](2026-11-08-content-in-play-plan.md) (PR #479, stacked on #478). Every finding
below is fixed in the spec and the plan on #479 in the same commit as this file. Next: the build (Sonnet high).

## 1. Verdict

The direction is right and the cuts follow the Owner's correction (04:14, "I want humans to be able to modify
content"): nothing here replaces game code with ready-made behaviours or HUD pieces. But as written the plan could not
be built as specified in six places (a package cycle, a contract that misses what pursuit needs, units off by a
factor of 16, two owners of a 2D position, a caption in a package that cannot read its state, and a controls builder
that `keys()` cannot provide), and it did not meet the Owner's new standing rule: the only journey covered tiles, and
nothing proved that dialogue, cutscenes or AI made in the editors show up in a 2D game. No game in the repository uses
`narrative` at all today.

After the fixes: 17 tasks (new Task 16, the 2D story example and its served journey), two served journeys, and the
collisions with #478 and the full-game work named in the plan.

## 2. Checked against

- The gaps doc ([`2026-11-08-complete-game-gaps.md`](2026-11-08-complete-game-gaps.md)): steps 1, 3, 4 and 6 kept and
  covered; 2 and 5 cut on the Owner's word. Correct.
- The codebase at #479's base (extensions, from #458) and at #473's head `36a60c60` (core, editor, tools), since the
  build merges both. Every path the plan names exists on one of them.
- PR #478 ("Build the remaining editors") and its thread up to 04:23, and the "Make a full game from the editors"
  thread up to 04:15 (Play and Ship, PR not opened yet, stacked on #473).

## 3. Findings

Severity: **B** would block the build or break a law; **M** would build the wrong thing or miss the goal; **m** is
small.

| # | Sev | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| F1 | B | No served journey proves dialogue, cutscenes or AI made in the editors show in a 2D game (Owner's standing rule). No game uses `narrative`, so nothing could. | `grep narrativeExtension` finds only the extension and its test | New Task 16: `examples/2d-story` and a served journey: edit in Writer, Sequence, Schematic; Save; Play; see the box, the caption and the guard. Spec §9 rewritten |
| F2 | B | Task 4's journey could not pass: the template's `terrain` tileset is a placeholder with no image, so a painted tile draws flat, never a sprite. The spec's picture paths (`assets/tiles/terrain.png`, `assets/characters/hero.png`) are refused by the workspace policy, which allows only flat `assets/<file>` | `template-content/project.toml` (`placeholder = true`); `workspace-policy.ts` `tilePicturePath`; `add-tiles.ts` `pictureAsset` | Journey adds a real picture with Add tiles first, presses Play (served), and checks clips and controls too. Paths flat; glob spelled out |
| F3 | B | Cycle: `sectorsPlaces` was to use `blockedBy`, which lives in nav, and nav depends on sectors | `extensions/nav/src/shared/sim/blocked.ts`; `nav/package.json` | `blockedBy` moves into sectors; nav re-exports |
| F4 | B | `Places.neighbours` (ids) does not give pursuit what it uses: the shared edge's middle and the point `THROUGH` past it | `systems/src/shared/sim/pursuit.ts` `crossingOf` | `Places.crossing(ctx, from, to): PlanCrossing \| null`; sectors' geometry moves into `sectorsPlaces` |
| F5 | B | Units: systems' numbers are metres (speeds in m/s, ranges, `THROUGH` 0.5, `FOLLOW_CLEAR` 1.5); the spec put 2D plan points in level pixels, so a guard tuned at 1.4 m/s would crawl 1.4 px a second | `systems.schema.ts` ("Metres per second per mode"); `pursuit.ts` | The plan is metres everywhere; `level2dPlaces` converts with `metre` (default: the walls grid). Review Focus 7 |
| F6 | B | Law 2: `level-2d.at` would be a second copy of a 2D player's position, which the game already moves with its own component | `template-game.ts` (`Square` x, y) | `level2dPlaces({ position: { component, x, y } })` reads and writes the game's component; `Level2dAt` only when there is none |
| F7 | M | Plugins' `dependsOn: ['sectors']` were not in the plan; `navExtension` and `navPlugin` are constants, not factories | `nav.plugin.ts`, `narrative.plugin.ts`, `systems.plugin.ts`; `nav.extension.ts` | `dependsOn` follows `places.provider`; `createNavExtension({ places })`, `navExtension` unchanged; no plugin `config` field added |
| F8 | M | The caption cannot live in narrative: it reads cutscenes' state, and cutscenes depends on narrative. The 2D stage in `level-2d` would make every 2D game with areas pull cutscene code | `cutscenes/package.json`; `cutscenes.extension.ts` (`requires … 'narrative'`) | Caption is cutscenes' own `hud.overlay`; the stage is `@automata/cutscenes/stage-2d`; `level-2d` stays sim only |
| F9 | M | A line's `text` is a locale key, not words; the box had no way to get words, so it would show keys | `lines.schema.ts` ("The locale key of the line's text") | `narrativeExtension({ words })` (and cutscenes'); a missing word is reported, never shown as a key. Where Writer saves words is #478's Writer spec; the Task 16 journey proves they meet |
| F10 | M | `controlsFrom` cannot be built from `keys()`: `keys()` makes ids `<command>-<n>`, merges actions with equal payloads, and has one `touch` switch; and the content schema cannot import core's reserved keys | `keys.ts` 160-230; `input-profile.schema.ts` `RESERVED_KEYS` | Shared `inputMapOf`; `keys()` keeps its ids (saved bindings keep working); `controlsFrom` uses the file's ids and per-action touch; reserved lists move into `@automata/content/controls` |
| F11 | M | `levelScene` and the cutscene stage need the sim each frame, but stage hooks get only `FrameInfo` | `renderer.ts` `PixiStageHooks`; `frames.ts` `FrameInfo` | Wired beside the draw layer, which holds a `DrawSim`; `LevelScene.add(hooks)` |
| F12 | M | "Reuse Add tiles' picture write": it is inline in `AddTilesDialog.svelte`, and Characters may not import the tiles feature | `AddTilesDialog.svelte` `add()`; boundaries rule | `shared/pictures/pick-picture.ts` (`writePicture`), used by both |
| F13 | M | Areas need a definition tagged `area` and resizable, but Characters edits neither tags nor resizing, so a person could not make one | `EntityInspector.svelte` (no tags or resizable control) | The template and the example ship an `area` definition; people place and stretch areas in Levels |
| F14 | m | The editor draws a def's tile only when its shape is `tile`; the spec's picture rule ignored shape, so game and editor would differ | `level-draw-list.ts` `entitiesOf` | `pictureOf(def)` in content, used by both |
| F15 | m | The template has no way to the project: `project.toml` is a `sim: false` kind, and the template declares only `simContent` | `level-2d-kinds.ts`; `template-level.ts` `compiled-content.d.ts` | `content.project` and `content.levels` from the virtual module; the `.d.ts` declares `content` |
| F16 | m | Key and pad names: "A button (bottom)" was invented; core already has `keyLabel` and `padLabel` | `shared/ui/prompts/prompt-label.ts` | Export and reuse them in the Tuner |
| F17 | m | `usePlay().send` "is recorded": the runtime has no recorder | `default-screens.ts` `appLoop.run({ commands })` | Sent commands join the same `commands(tick)` stream, after the input map's |
| F18 | m | `GameSpec.level` in a 3D game (`createRenderer`) was not refused | `define-game.ts` | A spec problem with a plain sentence |
| F19 | m | Drunk grandma: "Touch button" is unclear; "Add key" has no way out on a phone; the light-sense lint sentence did not say what is wrong; the box had no keyboard or pad path | spec §3.3, §3.4, §5 | "Show a button on touch screens"; "Press a key on your keyboard." with Cancel; "2D levels have no lamps, so this sense never notices anything unless the game's code says how bright it is."; Next takes focus (Enter, Space, pad A) |
| F20 | M | Collisions with other work (section 4) were not named | #478 thread 04:22-04:23; full-game thread 04:04-04:15 | Base and merge-ups named in the plan; Task 9 adds its row beside #478's; spec §3.4 says Schematic's new AI reads through `places` |
| F21 | m | The cutscenes lint checks floors and walls with `ResolvedMap`, which a 2D game has none of | `cutscenes/src/shared/lint.ts` 231-242 | The lint asks `Places` (`roomAt`, `walk`) |

## 4. Collisions

- **#478, Build the remaining editors.** The Owner asked at 04:22 for one spec and plan per editor, Schematic first
  ("that's how we do AI"), and at 04:23 for every editor to stay on the rail. Effects here:
  - New games will list every editor's files in `editors.toml` (#478). Task 9 adds the controls row beside them, after
    merging #478 up again.
  - Writer decides where a line's words live. This plan reads them through `words(key)` and does not choose for
    Writer; Task 16's journey is where the two must meet, and it fails loudly if they do not.
  - Schematic's AI spec may grow `systems`. This plan changes only how systems reads the world (`places`), never its
    schema, so whatever Schematic adds runs in 2D through the same contract. Combat (health, damage) is not in this
    plan and was not in the Owner's 04:14 scope; it belongs to Schematic's spec if the Owner wants it.
  - #478's spec section 8 lists 2D sprites and animation, default controls, 2D games and the dialogue box as "not in
    this work". This plan owns them now; #478's thread has been told, so its per-editor specs can point here.
- **Make a full game from the editors (Play and Ship, stacked on #473).** It makes `automata editor` serve the game
  and adds Play, with one create, edit, save, play, ship journey. Both journeys here press that Play and extend that
  journey rather than starting a second dev server, so the build merges that PR up first. Its PR was not open at
  audit time.
- **#473 and #476** (suite Levels 2D, Add tiles, Share): unchanged; the build merges them up first, as the plan said.

## 5. What was not checked

- No code was run; this stage changes documents only. Hashes, layouts and journeys are the build's to measure.
- Whether `import.meta.glob` picks up a picture added while `pnpm dev` runs without a reload is left to the Task 4
  journey, which reloads through Play either way.
- The 3D parity scripts were not run; Task 10 runs them and stops if a hash moves.
