# Audio: the game's sounds and music

Status: spec, 2026-11-08. Shared parts: [`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md)
(package, session, look, words). Plan: [`2026-11-08-audio-plan.md`](2026-11-08-audio-plan.md).

## 1. Why

Audio was half built ahead of its spec (`291d4c3d`): sounds as tones and hisses, music beds as drones, and a page of
which sound plays when something happens. It is not on the suite page, Play does nothing on the page, and it leaves out
the music the game switches between, the mix, and the checks that keep a sound from clipping. This spec finishes it.

## 2. What the content can say today

`@automata/audio-synth` (`content/audio/*.toml`, `audio.schema.ts`):

- **Sounds** (`cue`): an id, a line saying what the player hears (`about`), the bus it plays on (music, sound effects,
  menus, voices), its voices (a **tone**: a shape, a pitch sweeping `from` to `to`; or a **hiss**: noise at a pitch or a
  pitch range, `q` for how narrow; each with a start, a length and a loudness). Flags: `world` (it comes from a place,
  so it pans and fades with distance), `no_duck` (it never quiets the other buses), `draft` (a placeholder), and
  `sound` (a recorded file plays instead, once it exists).
- **Music beds** (`bed`): a looping background of drones (shape, pitch, loudness), optional filtered noise, an optional
  slow pulse, a loudness and a bus.
- **When things happen** (`event`): an event id or pattern, and the sound it plays or, in words, why it plays none
  (`silent`). `coverage` says which of the game's events nothing answers.
- **Ducking** (`duck`): while a sound on one bus plays, other buses drop by some dB, with an attack and a release.
- **Music** (`slot`): a piece of music the game can switch to: loop or once, a loudness, its file (`sound`), fade in,
  crossfade at the loop seam, a delay, how long it lingers, a place of relief, whether it keeps running unheard, and
  placeholder files to play until its own exists (`fallback`, with a radio filter).
- **Music rules** (`music_rule`): when every named piece of the game's state holds (a value, one of a list, or within a
  range), play this music, keep what plays (`hold`) or play nothing (`silence`).
- **Master volume** (`master_gain`).

`playCue`, `startBed` and `createMixer` play all of it on any `AudioContext`. The audio pipeline
(`automata-pipe audio run <scene> --json`) renders every sound and checks true peak, clicks, loudness, the ducks and
event coverage, in Node.

## 3. What a person does in Audio

1. **Pick** a sound, a music bed, a piece of music, **When things happen**, or **Mix** from the panel.
2. **Make a sound** as today (tones and hisses with their fields), plus **What you hear** (the `about` line),
   **Comes from a place** (world), **Never quiets other sounds** (no_duck), **Not final yet** (draft) and **Use a
   recorded file instead** (the `sound` alias). A small picture above the voices shows each voice as a bar across the
   sound's length, its pitch rising or falling, so a person sees the sound's shape.
3. **Play** a sound (once) or a bed (until **Stop**). The page's first Play unlocks audio, as browsers require; until
   then the button says **Tap to hear**. Playing never writes the file. After each change to a sound, its picture
   updates; it plays again only when asked.
4. **Say what plays when things happen**, from the game's events (the list Feel uses, `shared/game-events.ts`): each
   row "When player hit: plays hit" or "When door opens: quiet, because the door is silent in the dark". A game event
   nothing answers is listed under "Nothing plays yet" with **Pick a sound** and **Keep it quiet**.
5. **Set up the music**: each piece's file, **Loops** or **Plays once**, loudness, fade in, and the rest in words
   (section 4); its placeholders. Then the rules, read top to bottom as the game reads them: "When danger is at least
   2: play Chase", "When in the menu: keep what plays", "Otherwise: play Calm". **Play** on a piece plays its file, or
   its first placeholder that exists.
6. **Mix**: **Overall volume**, and the ducks as sentences: "While a voice plays, music drops 6 dB (in 0.1 s, back in
   0.5 s)".
7. **Check it**: **Check the sounds** runs the audio pipeline through the checks port and shows each finding beside its
   sound in words: "Too loud at its peak: −0.4 dB. Keep it under −1 dB.", "Clicks at 0.12 s.", "Music is 3 LU quieter
   than its target." The findings are marked out of date after a change.

## 4. Every field, in words

| Thing | Field | Words |
| --- | --- | --- |
| sound, bed | `bus` | Plays on: Music / Sound effects / Menus / Voices |
| tone | `tone`, `from`, `to` | Shape (Smooth / Buzzy / Bright / Soft), Starts at, Ends at (Hz) |
| hiss | `hiss`, `q` | Pitch (one or a range), How narrow |
| voice | `at`, `length`, `volume` | Starts after, Lasts, Loudness |
| sound | `about`, `world`, `no_duck`, `draft`, `sound` | What you hear, Comes from a place, Never quiets other sounds, Not final yet, Recorded file |
| bed | `volume`, drones, `noise`, `pulse` | Loudness, Drone (Shape, Pitch, Loudness), Hiss (Pitch, How narrow, Loudness), Pulse (How fast, How deep) |
| event | `on`, `cue`, `silent` | When, Plays, Quiet because |
| duck | `bus`, `duck`, `db`, `attack`, `release` | While … plays, These drop, By (dB), Drops in, Comes back in |
| music | `mode`, `volume`, `sound`, `fade`, `seam`, `delay`, `linger`, `relief`, `resume`, `fallback` | Loops / Plays once, Loudness, File, Fades in over, Blends its loop over, Waits before starting, Keeps playing after, A calm place (a chase never carries into it), Keeps running when not heard, Until its file exists play |
| rule | `when`, `slot`, `why` | When (each: is, is one of, at least, at most), Play / Keep what plays / Play nothing, Because |
| file | `master_gain` | Overall volume |

A file field offers the game's sound files (the names under the game's `assets` that the asset manifest lists, through
the workspace) and takes a typed name; a name with no file is named: "There is no file chase yet; its placeholder plays."

## 5. Layout

Panel: Sounds, Music beds, Music, When things happen, Mix. Canvas: the chosen page. The picture of a sound is at most
120 px tall and spans the canvas. Play and Stop are primary (48 px). The page wires `createAudio({ play })` to a real
`AudioContext` made on the first Play and closed when the editor closes.

## 6. Checks

- Unit: every field's words (section 4); edits for music pieces, rules (add, reorder, remove) and ducks; the sound
  picture from voices; coverage rows from `gameEvents`; pipeline findings to words.
- DOM: the start page; Play unlocks then plays (a fake `AudioContext` records calls); Stop stops a bed; adding a rule
  and moving it up; picking a sound for an unanswered event; the checks' findings shown and marked out of date after a
  change.
- Chromium layout at 390×844 and 820×1180.

## 7. Open choices

1. **Recorded music files.** Audio picks files the game already has; bringing a new file in is the assets importer's
   job, as for tiles. Recommended: keep it that way.
2. **Check the sounds** runs the pipeline on request, not on every change, because rendering every sound takes seconds.
