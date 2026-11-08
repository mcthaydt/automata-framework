# Shared editors: build audit

Stage 5 (build audit) of the shared-editors pipeline. It audits PR #522 (branch `claude/project-thread-fxu792`, head
`a8b57d5e`, 18 commits on #508's head `89db7336`) against the [spec](2026-11-08-shared-editors-spec.md), the
[plan](2026-11-08-shared-editors-plan.md) (both on #512), the [audit](2026-11-08-shared-editors-audit.md) (#509, D1 = A:
one Characters editor in both kinds) and the [plan audit](2026-11-08-shared-editors-plan-audit.md). Every finding below
was seen on that head in this session. Screens: `/mnt/project-files/refactor/2026-11-08-shared-editors-build-audit-screens/`.

## Verdict

The build does most of what the spec asks, and the journeys prove it: every editor but the level editors is on the rail
of both kinds, Characters is one entry in both (D1 = A), the list grows by an editor's own rows and nothing else, the
game's events reach Feel, and Writer's and Sequence's words show in play in a new 2D and a new 3D game. Two things a
person would hit are broken, though, and no test sees either:

- **In a 3D game a cutscene never moves the camera** (C1). Sequence's camera keys do nothing in play.
- **An edit is lost without a word when the list stops naming its file** (H1), the case the spec's words were written
  for.

The fixes stage should take C1, H1 and H2 first. No finding needs the Owner: each has one right answer.

## What was run

| What | Result |
| --- | --- |
| `pnpm install`, `pnpm build` | clean |
| `pnpm check` (`CI=1`) | every step green except `check-changesets`: `.changeset/stage-characters-3d.md: @automata/3d is not a published package` (H2) |
| `complete-game-2d` and `complete-game-3d`, `editor-ipad-chromium` and `editor-phone-chromium`, 2 workers | 21 of 22 pass (the 4 `test.fail` journeys fail as marked). The iPad 3D Schematic journey timed out once ("the guard walks across the room", 60 s) and passed on its own (L2) |
| End to end by hand (the Owner's rule) | `create-game` 2D and 3D through the journeys' `newGame`, the real `automata editor` on each, every editor opened at iPad and phone size, edits in Writer, Sequence and Feel, each game played in Chromium |
| `tsc -p .` in a made game | could not reproduce the build's "clean" (M3) |
| Not run | WebKit, Firefox (not installed here), the GPU runner, `pnpm test:browser:2d`, `stranger-3d.test.ts` |

What I made and played (all at iPad size unless named):

- **2D, Writer:** I changed the keeper's first line to "Hello from the audit." and walked up to him. The dialogue box said it.
- **2D, Sequence:** I pointed the gate cutscene's words at "Safe travels." and chose "Show me the gate.". The caption said it.
- **3D, Writer:** I made the same change and walked Wick up to the keeper. The box said it.
- **3D, Sequence:** "Show me around." showed the caption, but the camera stayed behind Wick (C1).
- **3D Feel, the word:** I made the bump's word last 6 s. "Bump!" showed over Wick, and in 2D in the middle of the screen
  (M1).
- **Not done by hand:** Feel's flash, Audio's pitch, Schematic's guard speed, the Tuner and Characters in play. The
  journeys above cover them, and they passed.

## Findings

### C1 (critical). A 3D cutscene never moves the camera

**What happens.** In a new 3D game, the keeper's "Show me around." plays `look`. Its caption shows, but the picture stays
the follow camera behind Wick for the whole scene. `look` has three camera keys: `[0, 2.2, -3.6]`, then `[3.2, 1.9, -1.2]`
at 3 s, then `[-3.2, 1.9, -1.2]` at 6 s. Even so, frames taken at about 2 s and 5 s into the scene differ in 3,756 of
967,600 pixels (the guard walking). Screens: `3d-play-before-cutscene.png`, `3d-cutscene-at-2s.png` and
`3d-cutscene-at-5s.png`. Sequence's preview of the same scene shows the camera moving (`3d-sequence-preview.png`), so the
editor shows something the game never plays.

**Why.** `cutsceneStage3d` writes the camera in `apply` (once a sim step,
`extensions/cutscenes/src/features/stage-3d/cutscene-stage-3d.ts:28-41`). The follow camera's driver writes it in `draw`,
once a frame: `rig.update(...)` at `packages/3d/src/features/camera/camera-driver.ts:126-147`. Every frame runs its
`apply` steps first and its `draw` after them, so the rig puts the camera back before each picture. The plan's "who wins
the camera" (Task 14) is true only of hooks of the same phase. The unit test stubs the camera, and both journeys look only
for the caption, so nothing caught it. The door-and-lamp example has no follow camera, so the example works.

**Fix.** Keep the director's state from `apply` and write the camera in the stage's `draw` (or have the rig stand down
while a scene plays). Then add a journey step that reads the game's picture before the scene and about 3 s into it and
expects them to differ by more than the guard's walk.

### H1 (high). An edit is lost without a word when the list stops naming its file

**What happens.** This is Review Focus 3 and the spec's §11 row "On an open file (the list was changed by hand)".

1. I opened Feel in the 2D game, then took Feel's row out of `content/editors.toml` by hand.
2. I typed "Ouch!" into Feel's "What it says" and left the box.
3. The server refused the read with 403 (`content/feel/feel.toml is not one the editor may read`), and the page threw it
   as an uncaught error.
4. The file kept its old words. The top bar still said "Saved in your game folder" and the status line said "No
   problems." (`2d-feel-row-removed.png`).

The person is never told "Feel can't save: this game's list of editors leaves Feel out."

**Why.**

- The page classes paths by the list it loaded (`live-list.ts`) and never sees a hand edit, so it lets the write through.
- The server's refusal reads `… is not one the editor may read|write` (`serve-editor.ts:112`).
- `listedWords` turns a refusal into those words only when it matches `no row of … (lists|names) it`
  (`extensions/editors/src/shared/listed-words.ts:15`), the page's own wording. A served refusal never matches, and the
  read refusal is not caught at all.
- `content-session.test.ts:82` proves the sentence only over memory ports. Task 6 proves only the server's 403.

**Fix.**

- Catch the read refusal in the TOML session.
- Treat a served `policy` refusal of a path the page thinks is listed as "unlisted". Either give the server's 403 the
  same reason words, or have the page read the list again on a 403.
- Add a served test (the `open-suite-ports` harness over a real `serveEditor`) that removes a row and expects the
  sentence and the file unchanged.

### H2 (high). `pnpm check` is red from this build's own changeset

`check-changesets` fails on `.changeset/stage-characters-3d.md`. The PR and the plan's log both call it "not this
build's", but it was added in this build's own commit `9a7127af` (Task 11). The plan's global constraints say `-3d` is
private and gets no changeset. **Fix:** delete the file. Then `pnpm check` passes in full.

### M1 (medium). Feel's character effects reach no character in either new game

**What happens.** Both templates' bump events have empty payloads (`defineEvent('square.bumped', z.object({}))`,
`defineEvent('wick.bumped', z.object({}))`). Feel finds the subject from a payload's `entity` or `subject`
(`extensions/feel/src/features/frame/feel.ts:123-127`), so on a bump:

- a squash or a freeze touches no one;
- "Show a word, over what was hit" falls back to the middle of the screen. In 2D, "Bump!" shows mid-screen while the
  square is at the left wall (`2d-feel-word-mid-screen.png`).

In 3D it happens to land near Wick only because the camera centres him (`3d-feel-word-mid.png`).

**Why it matters.** Tasks 10 and 11 (`StageCharacters`, `characters3d`) are what the spec's §8 is for, and they are
proven only with stubs. No game or journey uses them in play.

**Fix.** Give both bump events `{ entity: <the square's / Wick's sid> }`, and add a journey step for one character effect
(the word over the character, or a squash) in each kind.

### M2 (medium). The 2D story template is not the spec's, and the spec was not updated

Ruling T13 replaced the spec's §9 2D story with a byte copy of `examples/2d-story/content`:

- a 2,503-line level in place of the template's, with "a keeper and a guard, named" added;
- the cutscene `gate` in place of `look`;
- `project.toml` and `world.toml` replaced too.

The story game's code files are made by text swaps of the plain template's (`swap()` in `template-story-game.ts`), which
throw if the plain text changes.

There are now two sources of truth for the 2D story (the example and the template), bound by an equality test, and a
spec that describes neither. A person who makes a new 2D game gets the example's level, not the square-in-a-room the
plain game and its README describe.

**Fix.** Either trim the template's story back to the spec (the template's own level plus a keeper and a guard), or
record the ruling in the spec's §9 and the README. Then replace the string swaps with the plain template's files taking
the story as an option.

### M3 (medium). Spec §13's "each new game is typechecked and its tests run" is not a gate

**What the spec asks.** That every new game the journeys make also passes `tsc -p .` and `vitest run`.

**What happens.**

- No journey or test does it. The log says it was done by hand.
- In this session, a game made with the journeys' `newGame` gave 257 `tsc` errors. Most come from the linked workspace
  packages' sources, so they may be the layout's fault, not the template's. A few are in the game's own files
  (`feel-audio.ts` implicit `any`, `ship.config.ts` `game`). So "clean" could not be reproduced.
- The gate-closed 2D game, the one the published tools make, is never typechecked or played by any gate.

**Fix.** A slow or integration test that makes the plain 2D, story 2D and 3D games with a resolution that typechecks
(for example the packs, as `consumer-smoke` does) and runs `tsc` and `vitest` in each.

### M4 (medium). Words and pictures a drunk grandma would trip on

**Home** (`2d-home-ipad.png`, `2d-home-phone.png`):

- The Writer card lists "Keeper" twice, because the lines file and the conversation file share a name.
- The Feel and Audio cards say "Feel" under "Feel" and "Audio" under "Audio".
- The 2D Characters card names "Start", which is the level's name, not a character.

**Rail.** Feel, Audio, Writer, Sequence and Schematic all have the same list icon, so the icon helps the eye find none of
them.

**2D Characters** (`2d-characters-ipad.png`):

- The list starts with Area, Checkpoint, Coin, Door and Moving platform, which are not characters.
- The status line shows `content/levels/start.af2d.json`, as Levels' does. The plan's global constraints say no file key
  as page text.

**Sequence.** "Who says it" offers Hall and Yard (places) next to `keeper` and `guard` in lower case.

**3D Characters.** The Studio shows ids: the guard's skin is `wick-shadow` and the default outfit is `wanderer`.

**Fix.**

- Name a file row by what it holds ("Lines", "Conversation").
- Leave a card's single file row out when it repeats the editor's name.
- Give each content editor its own icon.
- Show the level picker's name only in Levels.
- Take the path off the status line.
- In "Who says it", offer people only, by display name.

### L1 (low). The phone top bar clips its buttons in Schematic

At 390 × 844 the redo button is cut off behind "Game", and the title reads "Tiny…" (`2d-schematic-phone.png`). Check
whether #508 already does this. Either way the top bar should fold before it overlaps.

### L2 (low). The 3D Schematic journey is load-sensitive

It waits 60 s for the guard to cross. It failed once with 2 workers and passed alone (1.3 min). Base the wait on game
ticks, not wall time, or give it the journey's own timeout.

### L3 (low). The 2D list's comments say when rows come, not what they are for

The 2D list's comments say "Writer and Sequence are added to this list where the game has the story" and "the rows wait
for them here" (`template-content/editors.toml`). Spec §9 asks for what each row is for, in one sentence.

### L4 (low). "Press Start to add it" can repeat forever

If Start itself could not list the editor (no list, or ports with no `list`), the start page says "This game's list of
editors doesn't include Feel yet. Press Start to add it.". Pressing Start again gives the same sentence. Say what the
person can do instead, or nothing.

### Noted, not this build's

- Schematic's presets call the player "her" ("chases the player when it sees her"), already on #508.
- Feel's "What happens in the game?" lists only the game's own `src/**/*.event.ts` ids. Extension events (a conversation
  starting, a cutscene) are not offered, which is consistent with spec §7.

## Checked and right

- **The rail (spec §4):** every editor of the game's kinds, in page order. Labels gain 2D or 3D only when both kinds show.
  The phone folds the rest under More, with the open editor kept in view (Schematic shown, Writer under More,
  `2d-schematic-phone.png`). On iPad, "Characters" shows in full.
- **D1 = A (spec §3):** Characters is a rail entry in both kinds. In 2D it shows neither Levels' view tabs nor the level
  picker. Levels shows only Level and Tiles.
- **The list (spec §5):** `listGrowsBy` keeps every old table and allows only `editorRows` rows. Both the server and the
  page use it. A game with no list is never given one, and the server re-reads the list by mtime and text.
- **Events (spec §7):** `content/generated/events.json` is written on dev start, and the served page reads it. Feel's
  picker offered "wick bumped" in 3D.
- **The player check (spec §6):** the words match exactly. A manifest that is missing or not JSON counts as having the
  player.
- **The Tuner in 3D:** it says "This game's controls are in its code."
- **The Sequence preview in 3D:** it draws the room's walls, with "The room" in "Show over".
- **`characters3d`:** it uses Pixi 3D's `Container3D.getGlobalPosition` (a `Vector3`) and `View3D.worldToScreen`. A word
  over a character in 3D needs M1's payload to show it.

## Next

The Sonnet high fixes stage, on #522, in this order:

1. C1, H1, H2.
2. M1, M3.
3. M2. The spec record is enough if the template stays as built.
4. M4.
5. The lows.

The fixes audit must play a 3D cutscene and watch the camera move.
