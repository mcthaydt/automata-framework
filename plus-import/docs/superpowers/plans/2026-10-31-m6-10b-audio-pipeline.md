# M6.10b: `audio-synth`: offline render, `pipe audio check`, board panel and example (TDD plan)

- **Spec:** the framework's M6 spec (`docs/superpowers/specs/2026-10-16-m6-gameplay-extensions-design.md`): §4.10, §13 AS-a; M6.0a adds
  music (done in M6.10a). Decisions AU-D1 to AU-D4 are in the M6.10a plan.
- **Row:** M6.10b in the framework's `docs/02-master-delivery-plan.md`. Prerequisites M6.10a (merged), M3.8a (merged), M6.2 (automata-plus#33,
  open: steps 1 to 4 do not need it; step 5 does). Size M.
- **Branch:** `claude/plus-M6.10b-audio-pipeline`, from main `c80733a`; one PR, one commit per part.
- **Source (read-only):** the adventure source at `92e6704`: `scripts/pipeline/audio-lib.ts` (WAV, BS.1770-4 loudness, 4x true peak, click
  detector), `scripts/pipeline/audio.ts` (render and check stages), `src/audio/render.ts`, `src/audio/board.ts` and `tests/audio.test.ts`.
  Provenance goes in the framework's `docs/provenance/sources.md` only.
- **Status:** plan drafted; steps 1-6 built and locally checked (2026-10-31). CI verified, deployed and Owner accepted: not yet.

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
- **The audio board** (`debug`, AU-D7): a panel with every cue on a button grouped by bus, the beds as toggles, and the events that
  play each cue. Plays through the mixer the game installed.
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
- **AU-D7:** the board lives in the `debug` package beside the feel board (`AudioPanel`, an `audio` handle on `DebugHost` and an
  `audioBoard` adapter over the content and the synth's controls), so `audio-synth` stays free of Svelte and of `debug`.

## Interfaces

- Produces: `@mcthaydt/automata-audio-synth/measure` (`encodeWav`, `decodeWav`, `integratedLoudness`, `truePeak`, `clicks`, `decay`),
  `.../render` (`renderCue`, `renderBed`, `renderMix`, `renderDuck`), `debug`: `AudioPanel`, `audioBoard`, `DebugHost.audio`,
  `tooling/pipelines` `audioPipeline` and `audioPipeSpec`.
- Consumes: M6.10a (`createMixer`, `playCue`, `startBed`, `cueLength`, `coverage`), M3.8a (`definePipeline`), M6.2 (`DebugPanelDef`).

## Steps

Each step: write the test, see it fail for the stated reason, write the minimum, see it pass.

1. `measure`: WAV round trip, loudness, true peak, clicks, decay. Fails: no module.
   - [x] 1
2. `render`: cue, bed, mix, duck on a fake offline context (node), seeded. Fails: no module.
   - [x] 2
3. The browser runner: renders a cue in real Chromium and the samples match the fake-context expectations (length, non-silence, same twice). Fails: no module.
   - [x] 3
4. The `audio` pipeline and its checks, with the fixture (AS-a). Fails: no pipeline.
   - [x] 4
5. The board panel (in `debug`, after #33 merged): buttons per cue and bed, event list, plays through the mixer. Fails: no component.
   - [x] 5
6. Gates, provenance row, ready line.
   - [x] 6

## Gates

- `pnpm format`, Plus `pnpm check`. No golden (presentation only). No changeset (private). The browser tests run in Node Vitest through
  Playwright's Chromium; no parity project (no sim entry).

## Execution log

- #33 merged during the work, so the board (step 5) is built on `debug`'s real host (AU-D7 moved it into `debug`).
- The browser runner and the pipeline are in `tooling/pipelines` (new dependencies: `playwright`, `vite`, the `audio-synth` package);
  its tsconfig gained the DOM lib because it type-checks the render module's sources. The bin loads the measure module when the stage
  runs, not at import (the SB-D6 hook resolves extensionless imports only after the stage starts), as `narrative` does.
- Measurements are taken in the render stage and kept in `render.json`; `check` reads the record and its staleness hash (content text
  plus spec text), so it does not render again. The example's loudness target (-18 LUFS, 4 LU) is the measured mix, recorded as the
  fixture's target, not a game's.
- The click check is unit-tested on synthetic signals; no integration fixture produces a click on purpose (the synth's envelopes
  ramp), so the pipeline's `clicks` row passes the example and is not exercised failing end to end.
- Tests of the render module use a recording fake context; the Chromium test in `tooling/pipelines` renders for real and measures a
  12 dB duck within 1 dB. The `mcp-cli` test's registered list gained `audio`.
- Not done: the one-file `audio-synth/audio-synth-cues.ts` runnable example (no Plus examples runner; the fixture is the AS-a
  example), parity with a legacy module, the space/convolver probe.
- Gates: package tests, svelte-check, tsc, biome, Plus `pnpm check`. No golden, no changeset (private), no parity project.
