# Sequence: a cutscene's steps in time

Status: spec, 2026-11-08. Shared parts: [`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md)
(package, session, look, words). Plan: [`2026-11-08-sequence-plan.md`](2026-11-08-sequence-plan.md).

## 1. Why

A cutscene is the game taking the camera for a moment: someone walks in, a line is said, the lights go down. Sequence
is where a person lays those steps out in time and watches the result, without writing numbers into a file by hand.

## 2. What the content can say today

`@automata/cutscenes` (`content/cutscenes/*.toml`, `cutscene.schema.ts`), one script per file:

- **Length** (`duration`, seconds) and the default **lens** (mm).
- **Tracks**, each a list of keys at times `t`:
  - **camera**: where it stands and what it looks at (`pos`, `look`, in metres), a cut or an eased move (`ease`), a lens;
  - **actor**: who (`who`), where (`at`, a named anchor, or `x`, `z`), facing, walking or not, a pose, a cut, fading
    in or out (`alpha`), and 3D extras (frame, height, shiver, density, face);
  - **caption**: a line from Writer (`line`, a line id) shown from `t` until `until`, with an optional speaker;
  - **sound** (`kind`; nothing plays these yet, neither the cutscene system nor the director reads them), **light**
    (`lamp`, `level`), **doors** (`door`, `open`), **time** of day, mood **grade**,
    **props** (`prop`, `at`, `turn`), **cues** (a clip started on a figure: `at`, `who`, `clip`), **states** (a prop's
    state from `t`), and windows of **shake** (`[from, to, metres]`), **flicker** (`[from, to]`) and **fade**
    (`value` 0 clear to 1 black).
  - `victory`: the game is won when it ends. `lintAllow`: lint rules it may break, each with a reason.
- **The director** (`@automata/cutscenes/director`): `createDirector(script)` and `stateAt(seconds)` give the camera,
  actors, lamps, doors, props, fade and captions at any moment. It is pure, so the editor can run it.
- **The lint** (`@automata/cutscenes` lint): the camera inside the map and clear of walls, every actor on the floor,
  captions that exist, are readable and do not overlap, sounds and lamps that exist, no shot shorter than a second, no
  dead air. It runs in Node. The content-in-play plan makes it read the world through `places` and adds a `3d-only`
  warning, "This step only works in 3D games. It does nothing here.", for doors, lamps, props, time and grade in a 2D
  game.

Key order is part of the file: a camera key may not come before the one before it, nor an actor key before that
actor's previous one. Not every track keys by `t`: a cue uses `at`, a shake is `[from, to, metres]`, a flicker
`[from, to]`. A cutscene file names no scene or level.

In a 2D game (content-in-play spec, section 3.2) the camera centres on `look`'s x and z, actors are drawn at their x and
z, fade, shake and captions are drawn, and lens, height and the 3D-only tracks do nothing.

## 3. What a person does in Sequence

1. **Pick a cutscene** from the panel, or **Add a cutscene** (a name and a length; it starts with one camera key and
   nothing else).
2. **See it as a timeline**: one row per track the scene uses, in words (Camera, each actor by name, Words on screen,
   Sounds, Lights, Doors, Fade, Shake), with the time ruler in seconds across the top. A key is a mark on its row; a
   caption, a shake or a flicker is a bar from its start to its end. **Add a row** offers the other tracks; a 3D-only
   track in a 2D game is offered with "Only in 3D games". Sounds are not offered until a game plays them; a file that
   has them shows the row read only: "Sounds in cutscenes don't play yet."
3. **Scrub and play**: a playhead on the ruler; **Play** runs the scene at its own speed from the playhead; dragging the
   playhead or tapping the ruler moves it. The preview shows the scene at the playhead.
4. **The preview** is a plan seen from above, drawn from `stateAt`: the walls of a 2D level the person picks once
   ("Show over: Hall"; read from the level's file, one metre a cell; a 3D game says "Walls show for 2D levels only, for
   now."), each actor as a dot with its name and facing, the camera as a wedge showing what it
   sees, the caption as text under the plan, and the fade as darkening. It never runs the game. Section 7 leaves a game
   frame for later.
5. **Change a key**: tap it to select it. The inspector shows its fields in words (section 4). Drag it along its row
   to change its time; it snaps to 0.1 s, and a key never passes the scene's end. **Move to the playhead** puts a
   selected key at the playhead. **Add here** on a row adds a key at the playhead with the values the scene has there
   (from `stateAt`), so adding a camera key keeps the shot where it is until it is changed. A key stops at its
   neighbours on its row, so the file never goes back in time.
6. **Pick, never type, the names**, from the whole game, since a cutscene names no scene: a caption's line from every
   lines file (shown by its words, "Welcome in. Mind the step.", grouped by file), an actor from the characters placed
   with a name in the game's levels and the names the file uses, a place from `player`, `actor:<who>` and the names in
   use, a clip from the figure's clips. A name the game does not have is kept and named in words: "This step's words
   were removed." A caption's words are written in Writer; Sequence picks the line.
7. **See what is wrong** in words, on the key or bar it is about, worked out in the page from the file: "Two words on
   screen overlap from 4 s to 4.5 s.", "This shot is shorter than a second.", "This step's words were removed.", "These
   words have nothing written yet." The cutscene lint's checks that need the level in 3D (the camera in a wall, dead
   air) wait for a cutscenes check a made game can run.

## 4. Every field, in words

| Track | Fields and words |
| --- | --- |
| Camera | When, Stands at (x, height, z), Looks at (x, height, z), Lens (mm, "wide" under 35, "close" over 70), Arrives: Cut / Moves smoothly / Moves (its own curve), kept as written |
| Actor | When, Who, Where: a named place or x and z, Facing (a dial, degrees), Walking, Pose, Arrives: Cut / Walks there, Seen (`alpha` 0 to 1), Through walls (`through`) |
| Words on screen | From, Until, Which line, Who says it |
| Sound | Read only: "Sounds in cutscenes don't play yet." |
| Light | When, Which lamp, How bright (0 to 1) |
| Door | When, Which door, How open (Shut to Open) |
| Time of day, Mood | When, Which |
| Prop | When, Which prop, Where, Turned |
| Clip | When, Who, Which clip |
| Shake, Flicker | From, To, and for a shake How hard (metres) |
| Fade | When, How dark (Clear to Black) |
| The scene | Length (seconds), Lens, Ends the game when it ends (`victory`) |

The rare 3D actor fields (frame, height, shiver, density, face) are shown under **More** on an actor key.

## 5. Layout

At 820 px and wider: the preview above, the timeline below, the inspector at the side. Narrower: the preview on top (at
least 200 px), the timeline below it scrolling sideways in its own region (rows' names stay pinned), and the inspector
as a sheet when a key is selected. The timeline zooms with **Zoom in** and **Zoom out** (and pinch), never below 44 px
per second at the closest. Keys are at least 44 px to tap; dragging needs a 4 px move before it starts, so a tap
selects.

## 6. Checks

- Unit: tracks to rows and marks; time snapping and the end clamp; "Add here" values from `stateAt`; every field's
  words; the plan's drawing data from a scene state (walls, dots, camera wedge); the page's problems in words.
- DOM: add a cutscene; add a camera key at the playhead; drag a key (pointer events) and see `t` change in one undo
  step; pick a caption by its words; Play moves the playhead with an injected clock; a 3D-only row in a 2D game shows
  the warning.
- Chromium layout at 390×844 and 820×1180: the timeline scrolls only in its region; keys are at least 44 px.
- In play: content-in-play's served journey in `examples/2d-story`, run with Sequence's edits (plan Task 7).

## 7. Open choices

1. **A game frame in the preview** (the running game, as the Tuner shows it) or the plan. Recommended: the plan now; a
   game frame needs the game to play a cutscene on request, which no game does today.
2. **Camera keys placed on the plan** (drag the wedge) or by fields. Recommended: fields now, dragging on the plan
   after the timeline ships.
