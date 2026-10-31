# M6.10b: `audio-synth`: offline render, `pipe audio check`, board panel and example (TDD plan)

- **Spec:** the framework's M6 spec (`docs/superpowers/specs/2026-10-16-m6-gameplay-extensions-design.md`): §4.10, §13 AS-a; M6.0a adds
  music (done in M6.10a). Decisions AU-D1 to AU-D4 are in the M6.10a plan.
- **Row:** M6.10b in the framework's `docs/02-master-delivery-plan.md`. Prerequisites M6.10a (merged), M3.8a (merged), M6.2 (automata-plus#33,
  open: steps 1 to 4 do not need it; step 5 does). Size M.
- **Branch:** `claude/plus-M6.10b-audio-pipeline`, from main `c80733a`; one PR, one commit per part.
- **Source (read-only):** the adventure source at `92e6704`: `scripts/pipeline/audio-lib.ts` (WAV, BS.1770-4 loudness, 4x true peak, click
  detector), `scripts/pipeline/audio.ts` (render and check stages), `src/audio/render.ts`, `src/audio/board.ts` and `tests/audio.test.ts`.
  Provenance goes in the framework's `docs/provenance/sources.md` only.
- **Status:** plan drafted. Nothing built yet.

## Scope

In:
- **`measure`** (`packages/audio-synth/src/measure/`, pure TypeScript, Node): WAV encode and decode (16-bit PCM), `integratedLoudness`
  (BS.1770-4, gated), `truePeak` (4x oversampled), `clicks` (second difference against its 30 ms neighbours), `rms` and RT60 `decay`.
  Tested against BS.1770 reference tones and synthetic steps, dropouts and edges.
- **`render`** (`src/render/`, runs wherever an `OfflineAudioContext` exists): `renderCue`, `renderBed`, `renderMix`, `renderDuck` over the
  M6.10a synth and mixer, with a seeded random so a render is the same every time.
- **The browser runner** (`tooling/pipelines`): bundles the render module with Vite, runs it in headless Chromium and returns the samples.
  One browser per run; a missing browser is a stage failure that says so (`StageFailed`), never a skip.
- **`audio` pipeline** (`tooling/pipelines/src/audio.pipeline.ts`, as `narrative`): an `audio.pipe.toml` names the game's `audio` content
  and the targets (sample rate, tail, true-peak ceiling, click floor, gameplay LUFS and tolerance, mixes). `render` writes WAVs and
  `render.json`; `check` fails on true peak, clicks, loudness (when enforced), ducking depth against the rule, panning, a stale render
  and event coverage (every event a cue or a silent reason). Free: no paid stage.
- **The audio board** (`audio-synth/board`): a `debug` panel (`DebugPanelDef`) with every cue on a button grouped by bus, the beds, and
  the events that play each cue. Plays through the mixer the game installed.
- **The example** (AS-a): a small `audio` fixture (`packages/audio-synth/fixtures/cues/`) that the pipeline's own test renders and
  checks: every cue renders under the true-peak and click limits.

Out: the blips, foley, hallucinations, space/convolver and recorded-music loudness stage (the source's `music-loudness`, `budget`:
game-specific or core's asset budget); parity with a legacy module (the source's migration); a `pipe audio` wrapper for Ruken;
the editor panels (EDS.5b).

## Decisions for the Owner's veto

- **AU-D5:** the offline render runs in headless Chromium (as the source did), because Node has no `OfflineAudioContext`. The stage
  fails closed when no browser exists. Default: Playwright's Chromium as in CI.
- **AU-D6:** the sample budget and recorded-music loudness checks stay out: the budget belongs to core's asset budget (M5) and music
  files are the game's. `check` reports them as not part of this pipeline, not as passed.
- **AU-D7:** the board is a `DebugPanelDef` exported from `@mcthaydt/automata-audio-synth/board`, so the main entry stays free of Svelte
  and of `debug`.

## Interfaces

- Produces: `@mcthaydt/automata-audio-synth/measure` (`encodeWav`, `decodeWav`, `integratedLoudness`, `truePeak`, `clicks`, `decay`),
  `.../render` (`renderCue`, `renderBed`, `renderMix`, `renderDuck`), `.../board` (`audioBoardPanel`, needs `debug`),
  `tooling/pipelines` `audioPipeline` and `audioPipeSpec`.
- Consumes: M6.10a (`createMixer`, `playCue`, `startBed`, `cueLength`, `coverage`), M3.8a (`definePipeline`), M6.2 (`DebugPanelDef`).

## Steps

Each step: write the test, see it fail for the stated reason, write the minimum, see it pass.

1. `measure`: WAV round trip, loudness, true peak, clicks, decay. Fails: no module.
   - [x] 1
2. `render`: cue, bed, mix, duck on a fake offline context (node), seeded. Fails: no module.
   - [x] 2
3. The browser runner: renders a cue in real Chromium and the samples match the fake-context expectations (length, non-silence, same twice). Fails: no module.
   - [ ] 3
4. The `audio` pipeline and its checks, with the fixture (AS-a). Fails: no pipeline.
   - [ ] 4
5. The board panel (after #33 merges): buttons per cue and bed, event list, plays through the mixer. Fails: no component.
   - [ ] 5
6. Gates, provenance row, ready line.
   - [ ] 6

## Gates

- `pnpm format`, Plus `pnpm check`. No golden (presentation only). No changeset (private). The browser tests run in Node Vitest through
  Playwright's Chromium; no parity project (no sim entry).
