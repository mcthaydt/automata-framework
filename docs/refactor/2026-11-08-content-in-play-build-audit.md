# Build audit: edited content shows in play

2026-11-08. Stage 5 (build audit, Opus medium) of the normal dev pipeline for
[`2026-11-08-content-in-play-spec.md`](2026-11-08-content-in-play-spec.md) and
[`2026-11-08-content-in-play-plan.md`](2026-11-08-content-in-play-plan.md), built on PR #484 (branch
`claude/project-thread-r8qhjh`, head `f9d170ab`, stacked on #481). Next: the fixes (Sonnet high), on a branch stacked on
this one. Screenshots: `/mnt/project-files/content-in-play/build-audit/`.

## 1. Verdict

The runtime half is sound and most of it is proved by playing. I made a small game in the editors myself and played it:
a picture added with Add tiles, three Decor cells painted from it, a wall painted on Collision, a coin placed and given a
four-frame animation in Characters, and J added to Left in the Tuner. In play the painted cells are the picture's tile,
the wall shows through the ground auto layer, the placed coin shows its animation's frames (not its yellow circle), and
J moves the square left. In the 2D story I moved the keeper in Levels; in play he stands at his new spot, walking up to
him opens the dialogue box with his words, key 2 picks the second answer, Enter goes on, the cutscene runs with its
caption, and the guard comes through the gap. The committed journeys pass here too.

What is not yet true is the goal's other half for dialogue and cutscenes: no editor on this branch can change the
keeper's words, the caption or the guard (H2; #478's editors are not here, which was known). And two things a person
makes now drift between the editor and the game: an animated character looks different in Levels than in play (H1),
and a character moved in Levels jumps back to where its cutscene was written (M1).

**2 High, 5 Medium, 9 Low.** No 3D hash, golden or replay moved that I could run.

## 2. Findings

### High

**H1. The editor's level does not show a character's animation; the game does.** Spec §4: "Game and editor share
this rule from `@automata/content/level-2d` (`pictureOf(def)`), so they cannot drift." `pictureOf`
(`packages/content/src/shared/level-2d/picture-of.ts`) never got the animation branch the plan put in Task 5 (its
comment still says "an animation's first clip arrives with the `animation` schema"). Core's `levelDrawList` and
`pictureView` each check `def.animation` themselves; the editor's `level-draw-list.ts` asks only `pictureOf`.
*Seen:* after the coin got its animation, Levels still drew a yellow circle (`editor-coin-flat.png`) while the game drew
the green frame (`game-coin-animated.png`). A person cannot see in the level what the player will see.
*Fix:* add the `animation` branch to `pictureOf` (first clip's first frame, with the picture path and the frame), make
`levelDrawList`, `pictureView` and the editor's level canvas all take it from there, and draw that frame on the editor
canvas (the Characters preview already loads the picture). A test that the editor's draw list and core's agree on a def
with an animation.

**H2. Nobody can edit the 2D story's words, caption or guard in an editor yet, and nothing tracks re-pointing it.**
Known as "Writer, Sequence and Schematic steps unchecked", but the gap is wider than the journey steps:
- the keeper's words live in `examples/2d-story/content/words/en.json`, which no editor opens (`wordsOf` in
  `story-content.ts`; Log ruling 4). Writer (#478) writes a line's `words` into the line;
- `examples/2d-story/content/editors.toml` lists only Levels. The plan's Task 16 says Levels, Writer, Sequence,
  Schematic and the Tuner;
- the story wires `keys()` in code, so even its controls are not in the Tuner (see L9).
*Fix:* when #478 merges up, point `wordsOf` at the line's own words (narrative `wordsOf`), delete `content/words/en.json`
except the screen words that belong to the message catalog (`dialogue.next`, `speaker.*`), list the editors in
`editors.toml`, and run the unchecked journey steps for real. Add this as a named step in the plan so it is not lost.

### Medium

**M1. A character moved in Levels jumps back to where its cutscene was written.** The cutscene's actor keys are
absolute metres (`gate.toml`: keeper at x 12.5, z 16), and the stage draws the actor there. *Seen:* I dragged the keeper
from x 200 to about x 104 in Levels; in play he stood at 104 and talked there, then at the cutscene's first frame he was
at 200, walked to 232, and snapped back to 104 when it ended (`story-keeper-jumps.png`: top left the talk, top right the
cutscene start, bottom left after). A person who moves a character sees a teleport and does not know why. *Fix,
smallest:* the cutscenes lint (or `automata check`) warns when an actor's first key is not where the named character is
placed ("The keeper starts this cutscene at 12.5, 16 but stands at 6.5, 16 in the level."); better, an actor whose first
key names no point starts where it is placed. Either way it is content, so the person can fix it.

**M2. A cutscene fade leaves the player and the guard on screen.** `cutsceneStage2d` adds its fade rectangle to the level
scene's container ("Last, so it covers the characters too"), but `mountLevelScene` puts that container at index 0 of
`stage.world`, under every entity view. So the fade covers the level and the placed characters, and the game's own views
(the player square, the guard) draw over the black. *Code read*; the story's cutscene has no fade, so no journey shows
it. *Fix:* draw the fade on a layer over the world (the stage's `ui` layer, or a container the stage adds on top), with
a browser test that a live entity is covered.

**M3. The Tuner can open on a bare "Tuner / Controls" list that does nothing.** *Seen (iPad, Chromium):* after working in
Levels (Add tiles, painting, Characters with an added picture), the Tuner tab showed only a card with "Tuner" and
"Controls" (`tuner-stuck.png`); tapping Controls highlighted it and nothing else, for 8 s. A reload showed the game and
the Controls rows at once. Opening the Tuner straight after opening the level (no edits) worked, so it depends on what
happened in Levels; I did not find the cause. The committed `controls-change-the-game` journey opens the Tuner first,
which is why it passes. *Fix:* reproduce with the steps above, find why the Tuner falls back to its
list, and add that order to the journey.

**M4. The new 2D warnings never reach a person.** `systemsWarnings` (the "2D levels have no lamps" sentence, spec §3.4)
and the cutscenes lint's `dimensions: 2` (the `3d-only` warning, spec §3.2) have no caller: not `automata check`, not an
editor. The lint also needs a `LintFloor` for a 2D level, and `level-2d` does not provide one (Log Task 10 ruling 2 says
"a 2D game builds its own"; that is code a person cannot write). *Fix:* `level-2d` exports
`level2dLintFloor(options)` beside `level2dPlaces` (same areas and walls), and `automata check` runs both lints for a game
whose project is 2D; Sequence and Schematic (#478) show them.

**M5. Places and the story know one level.** `level2dPlaces` is built for one `level`; `levelScene` can switch levels
with `current`, but rooms, walls and the story's `itemOf` stay the first level's. A game with a second level gets the
first level's walls in its AI and dialogue. *Fix:* `level2dPlaces({ levels, current })` reading the level from the sim the
way `levelScene` does, or say plainly in its doc comment and README that it is one level and throw when a game passes
`levels` with more than one.

### Low

- **L1.** `levelScene`'s waiting tile is grey `0x808080`, but its comment says "the tile's own colour, as the editor
  shows". Use `placeholderColor(tile)`, or fix the comment. `pictureOf`'s header comment is stale (H1).
- **L2.** A clip frame past the picture (the editor flags "This clip uses frame 6, but the picture has 4.") is cut outside
  the texture in play with no report. `clipTextures` should report once and skip it.
- **L3.** Every picture that loads swaps every `pictureView` back to its first clip (`pictures.onLoad` is shared), so a
  running clip restarts when an unrelated picture arrives. Swap only views whose picture just loaded.
- **L4.** The dialogue box listens for keys 1 to 9 on `window` while it is open, including while the pause menu is up.
- **L5.** A speaker with no words shows its id read aloud ("Nurse jo"). Spec §7 says nothing a player sees is an id;
  report it once like a missing line.
- **L6.** Drunk grandma, Tuner: the pad chips show the same arrows as the arrow-key chips (`←` twice in one row), so a
  person cannot tell a key from a pad button; and a new game's Tuner opens with "This game has no settings file yet." and
  a bright "Make one" above Controls, the loudest thing on the page for something the person did not come for.
- **L7.** The committed animation journey animates the player start (a `pictureView`), not a placed coin, as the plan
  asked; `levelScene`'s animated-item path is proved only by this audit's run. Add the coin step.
- **L8.** The guard keeps hunting while the player is frozen in a conversation (Log, Task 16). Fine as the example's
  behaviour, but its README should say so, since a person reading the example will copy it.
- **L9.** The 2D story wires `keys()` in code instead of `content/controls.toml` and `controlsFrom`, unlike the template.
  Move it so the example shows the content path.

Pre-existing, not from this work: in the iPad portrait inspector the steppers' "+" wraps under the field (Characters'
Width, Height, Frame width; Level's X and Y), and the inspector card covers the Characters preview; the phone top bar
clips Play and Publish (W5, fixed on #485, not on this branch).

## 3. Plan and spec, task by task

| Task | State | Notes |
| --- | --- | --- |
| 1 Tile rules in content | Done | Readers, `tileFrame`, placeholder colours shared; `pictureOf` lacks animation (H1) |
| 2 `levelScene` | Done | Draw list matches the editor's order; L1; M2 (mount order) |
| 3 `pictureView` | Done | |
| 4 New game draws the level | Done, played | Painted tiles, wall, player start seen in play |
| 5 `animation` schema | Partly | Schema and export done; `pictureOf` branch missing (H1) |
| 6 Clips | Done, played | L2, L3 |
| 7 Animation section | Done, played | Placed coin animates in play (this audit); L7 |
| 8 Controls as data | Done | |
| 9 Controls in the Tuner | Done, played | J moves the square; M3, L6 |
| 10 Places contract | Done | 3D suites and base-3d green; lint uses `LintFloor` not `Places` (M4) |
| 11 `level-2d` | Done | M5 |
| 12 `usePlay` | Done | |
| 13 Dialogue box | Done, played | Keys 1-9, Enter, focus to Pause after; L4, L5 |
| 14 2D cutscenes, caption | Done, played | M1, M2, M4 |
| 15 Systems in 2D | Done | Golden passes in Chromium here; WebKit, Firefox pending |
| 16 2D story | Partly | Writer, Sequence, Schematic steps pending (H2); editors.toml lists only Levels |
| 17 Docs and gate | Done with known failures | As the Log lists |

## 4. What I ran

Container Node 24.21.0 (downloaded), pnpm 10.34.6, Chromium only.

- `pnpm build` (6 packages): green.
- Unit suites, all green: content 452, framework 1907, level-2d 21, places 2, 2d-story 13, narrative 154, cutscenes 88,
  systems 66, sectors 49, nav 25, tools 769 (1 skipped), base-3d 141.
- level-2d browser golden (`systems-2d`, hash `de5df42656c162d7`) in Chromium: green.
- Committed journeys on `editor-ipad-chromium`: `paint-shows-in-game`, `animation-plays-in-game`,
  `controls-change-the-game`, `story-in-play`, `whole-game-loop`: 5 passed.
- My own make-and-play runs (uncommitted Playwright scripts against the built `automata editor`, iPad Chromium): the new
  game (Add tiles, paint Decor, wall on Collision, place a coin, animate it, Add key J, Play); the 2D story (drag the
  keeper in Levels, Play, talk, choose with key 2, cutscene, guard). The phone run of the new game could not paint: my
  script tapped cells under the open panel sheet, so I have no phone result for it; the phone journeys in the repo were
  not re-run.

Not run: WebKit and Firefox (not installed here); the GPU runner; the Writer, Sequence and Schematic steps (#478 not on
the branch); `pnpm check` as a whole (the Log's known failures stand: `source-names`, the `@automata/editors` typecheck,
`tooling/release` `turbo.test.ts`, `api-index`).
