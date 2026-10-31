# M6.10a: `audio-synth`: cues, synth voices, event-to-cue map, mixer on core buses, music slots (TDD plan)

- **Spec:** the framework's M6 spec (`docs/superpowers/specs/2026-10-16-m6-gameplay-extensions-design.md`): §4.10, §4.13 (music, M6-D16),
  §5 (per frame), §13 AS-a (M6.10b). Decision M6-D8 (no game-named storage key).
- **Row:** M6.10a in the framework's `docs/02-master-delivery-plan.md`. Prerequisite PRODUCT.5e (merged). Size L. Offline render,
  `pipe audio check` and the board panel are M6.10b.
- **Branch:** `claude/plus-M6.10a-audio-synth`, **stacked on `claude/plus-M6.1a-feel` (automata-plus#31)**: `Beats`, the drawn-tick
  event holder, has one owner, `feel`, and `audio-synth` imports it rather than copying it. The PR targets main once #31 merges.
- **Source (read-only):** the adventure source at `92e67047a33161c5cfb1c5f9d8b981e91e1c55b9`: `src/audio/{cues,synth,events,mixer,music,music-rules}.ts`
  (and the cue and bed tables as the converted fixtures). Provenance goes in the framework's `docs/provenance/sources.md` only.
- **Status:** plan drafted.

## Scope

In (`packages/audio-synth`, presentation only: no sim entry):
- **Content:** the `audio` kind (one file): `[[cue]]` (voices: tones swept exponentially and band-passed noise; a bus; `world`; `noDuck`),
  `[[bed]]` (drones, filtered noise, a pulse), `[[event]]` (a sim event id or `*` pattern to a cue, or `silent` with its reason),
  `[[duck]]` rules, `[[slot]]` (music slots with fallbacks) and `[[music_rule]]` (first match wins). References are checked at their paths.
- **Synth** on any `BaseAudioContext`: `playVoice`, `playCue`, `startBed`, seeded noise, `cueLength`; nothing here creates a context.
- **Mixer** over a port the game gives from core: `input(bus)` (core's `AudioBuses`) and `duck(bus, amount, seconds)` (core's `Audio`); world cues
  are panned and attenuated from a listener; ducking comes from the content's rules. Buses are core's (`sfx`, `music`, `ui`, `voice`).
- **Driver:** `createAudioSynth`: `hear(tick, events)` and `frame(drawnTick, listener)` play the cues the events map to when the drawn tick
  reaches them (once each; `feel`'s `Beats`); beds start and stop by id; `coverage` lists the events the game declares that no entry answers.
- **Music:** slots resolve to the first file the game has (its own, then fallbacks); rules pick a slot from a flat state of the game's; a
  director holds a chase's slot for its `linger`, never into relief, `hold` keeps what plays, `silence` plays nothing.
- **`audioSynthExtension`** (the content kind).

Out (M6.10b): offline render, `automata pipe audio check`, the audio board panel, example `audio-synth-cues`, AS-a. Not ported (game-specific):
the source's `blips`, `foley`, `hallucinations` and `space` (a room reverb) and its inlined-sample loader; recorded files come from core's assets.

## Decisions for the Owner's veto

- **AU-D1:** ASSET.2's sound-recipe format (core renders recipes to WAV at build) is **not** adopted: a cue is live voices on the graph, which is what
  `audio-synth` is for; a cue may name a core sound alias (`sound`) that core's `Audio.sound` plays, so a game mixes both. Revisit when ASSET.2 lands.
- **AU-D2:** the source's four buses become core's (`music`, `sfx`, `ui`, `voice`); `effects` is `sfx`, `dialogue` is `voice`.
- **AU-D3:** music rules read a flat state of strings, numbers and booleans the game fills, not the source's phase/scene/pursuer shape; a pursuer is
  `{ agent: 'nurse', mode: 'hunt' }` flattened by the game (`pursuit.mode`, `pursuit.distance`).
- **AU-D4:** a seam crossfade inside a loop is core's `MusicSlot`'s concern; this package decides which slot plays and when.

## Steps

Each step: write the test, see it fail for the stated reason, write the minimum, see it pass.

1. Package; the `audio` schema (cues, beds, events, ducks, slots, rules), content kind. Fails: no package.
   - [x] 1 (the extension joins in step 6)
2. Synth on a recording fake context: voices, cues, beds, noise, `cueLength`. Fails: no module.
   - [x] 2
3. Mixer: bus routing, spatial pan and distance, ducking. Fails: no module.
   - [x] 3
4. Driver: events at the drawn tick, patterns, silent entries, beds, `coverage`. Fails: no module.
   - [x] 4
5. Music: slots, `resolveSlot`, rules, the director. Fails: no module.
   - [x] 5
6. The extension; gates, provenance row, ready line.
   - [x] 6

## Gates

- `pnpm format`, Plus `pnpm check`. No golden (presentation only). No changeset (private).

## Follow-ups

- M6.10b: offline render, `pipe audio check`, board panel, example, AS-a. A core request for a node-level seam on `Audio` if `input(bus)` is not enough.

## Execution log

- 2026-10-31: plan written from the M6 spec, Plus `claude/plus-M6.1a-feel` and the adventure source at `92e6704`.

## Execution log

- Stacked on M6.1a (#31): feel's `Beats`, `hash` and `matches` are imported from `@mcthaydt/automata-feel` (feel's index now exports `Beats` and `hash`).
- Buses are core's (AU-D2). ASSET.2 is not adopted (AU-D1): a cue may name a core `sound` alias.
- Tests run on a recording fake `BaseAudioContext`, not real audio. Some switches were written in the same edit as their tests; mutation checks showed the tests bite.
- Step 5: the director is generic over a flat state. Silence and `relief` slots end a linger at once (the source's "in play only" and "hidden" rules become data: a `silence` row and a `relief` slot). No `MusicPort`: core's `MusicSlot` owns playback and crossfade (AU-D4), so the game feeds `director.step(state, dt)` to it.
- Gates: package tests (6 files, 53), tsc, biome, Plus `pnpm check`. No golden, no changeset (private), no parity project (no sim entry).
