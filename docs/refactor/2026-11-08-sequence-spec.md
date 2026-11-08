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
  - **sound** (`kind`), **light** (`lamp`, `level`), **doors** (`door`, `open`), **time** of day, mood **grade**,
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

In a 2D game (content-in-play spec, section 3.2) the camera centres on `look`'s x and z, actors are drawn at their x and
z, fade, shake and captions are drawn, and lens, height and the 3D-only tracks do nothing.

## 3. What a person does in Sequence

1. **Pick a cutscene** from the panel, or **Add a cutscene** (a name and a length; it starts with one camera key and
   nothing else).
2. **See it as a timeline**: one row per track the scene uses, in words (Camera, each actor by name, Words on screen,
   Sounds, Lights, Doors, Fade, Shake), with the time ruler in seconds across the top. A key is a mark on its row; a
   caption, a shake or a flicker is a bar from its start to its end. **Add a row** offers the other tracks; a 3D-only
   track in a 2D game is offered with "Only in 3D games".
3. **Scrub and play**: a playhead on the ruler; **Play** runs the scene at its own speed from the playhead; dragging the
   playhead or tapping the ruler moves it. The preview shows the scene at the playhead.
4. **The preview** is a plan seen from above, drawn from `stateAt`: the level's walls (from the 2D level, or a 3D
   scene's plan through `places`), each actor as a dot with its name and facing, the camera as a wedge showing what it
   sees, the caption as text under the plan, and the fade as darkening. It never runs the game. Section 7 leaves a game
   frame for later.
5. **Change a key**: tap it to select it. The inspector shows its fields in words (section 4). Drag it along its row
   to change its time; it snaps to 0.1 s, and a key never passes the scene's end. **Move to the playhead** puts a
   selected key at the playhead. **Add here** on a row adds a key at the playhead with the values the scene has there
   (from `stateAt`), so adding a camera key keeps the shot where it is until it is changed.
6. **Pick, never type, the names**: a caption's line from Writer's lines for the scene (shown by its words, "Welcome
   in. Mind the step."), an actor from the scene's characters, an anchor from the scene's named places, a sound from
   Audio's sounds, a clip from the figure's clips. A name the game does not have is kept and named: "There is no line
   shop.thanks yet."
7. **See what is wrong** in words, on the key or bar it is about, after **Check the scene** (the lint through the
   checks port): "The camera is inside a wall at 3.2 s.", "Two words on screen overlap from 4 s to 4.5 s.", "This shot is
   shorter than a second.", "Nothing happens from 6 s to 9 s." A rule the scene may break shows its reason instead.

## 4. Every field, in words

| Track | Fields and words |
| --- | --- |
| Camera | When, Stands at (x, height, z), Looks at (x, height, z), Lens (mm, "wide" under 35, "close" over 70), Arrives: Cut / Moves smoothly (`ease`) |
| Actor | When, Who, Where: a named place or x and z, Facing (a dial, degrees), Walking, Pose, Arrives: Cut / Walks there, Seen (`alpha` 0 to 1), Through walls (`through`) |
| Words on screen | From, Until, Which line, Who says it |
| Sound | When, Which sound |
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
  words; the plan's drawing data from a scene state (walls, dots, camera wedge); lint findings to words.
- DOM: add a cutscene; add a camera key at the playhead; drag a key (pointer events) and see `t` change in one undo
  step; pick a caption by its words; Play moves the playhead with an injected clock; a 3D-only row in a 2D game shows
  the warning.
- Chromium layout at 390×844 and 820×1180: the timeline scrolls only in its region; keys are at least 44 px.

## 7. Open choices

1. **A game frame in the preview** (the running game, as the Tuner shows it) or the plan. Recommended: the plan now; a
   game frame needs the game to play a cutscene on request, which no game does today.
2. **Camera keys placed on the plan** (drag the wedge) or by fields. Recommended: fields now, dragging on the plan
   after the timeline ships.
