# Extraction sources

AF is standalone: its code, tests, published text and website never name the projects it was extracted from. This file
is the only place their repositories and commits are named (AGENTS.md "Core and extensions"). It is not shipped, not
published and not on the website. Each entry records the source repository, the commit read, what was taken or is to be
taken, and the licence. Specs, plans and code refer to a source only by its neutral name below.

STANDALONE.2 extends this file to every earlier extraction; until then it holds M6's entries only.

## M6: gameplay extensions ([M6 spec](../archive/superpowers/specs/2026-10-16-m6-gameplay-extensions-design.md))

### The adventure source

| Field | Value |
| --- | --- |
| Repository | `mcthaydt/PixiJS3D_Experiment_001` (private) |
| First read | `17eb568`, 2026-10-16 (the M6 spec's line and test counts) |
| Recorded extraction commit | `92e67047a33161c5cfb1c5f9d8b981e91e1c55b9` (`92e6704`, committed 2026-10-22), re-read 2026-10-31 for M6.0a |
| Taken (M6.3 onward, into `mcthaydt/automata-plus`) | `sectors`, `nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `feel`'s frame model and coverage, `audio-synth`, `debug`'s boards and driver, the environment (blockout) pipeline, and the modules in M6 spec §4.13 (storylets, conversations, delivery, portraits, music), all rewritten on Koota under the porting rules (M6 spec §4.9), with the source's tests as behavior specs. The source itself is not edited (decision 8) |
| Earlier extraction | `@automata/editor-3d` `format/` and `geometry/` (ED3D.1, ED3D.1c) from `src/game/sector-format.ts` at `92e6704` and the source's sector and nav geometry |
| Moved, M6-D17 (2026-10-31) | The format file (`sector.schema.ts`, from `src/game/sector-format.ts` at `92e6704`) moved with its constants to core `@automata/sector-format` (`packages/sector-format/src`); its header no longer names the source |
| Moved, M6-D18 (2026-10-31) | The blockout file format and its expansion (`blockout.schema.ts` and `expand.ts`, from `src/blockout-format.ts` at `92e6704`) moved from `@automata/editor-3d` `format/` to core `@automata/sector-format/blockout` (`packages/sector-format/blockout`), outside its sim entry; their headers no longer name the source. Removed 2026-11 (D3): the source game's level format is not AF's, so `@automata/3d` ships `af-sector/1` only |
| Moved, 3D slice task 2.1 (2026-11-07) | `packages/render-pixi3d`, `packages/figures` and `packages/sector-format` (with the two rows above) became feature folders of one package, `packages/3d` (`@automata/3d`); every file keeps its text and its source rows; the file-by-file map is `docs/refactor/move-map-3d.json` |
| Converted, M6.5 (automata-plus#24) | `nav`: `src/game/nav.ts` (`clear`, `nearestNode`, `route`) rewritten on Koota; its three tests (`tests/nav.test.ts`) ported as behaviour specs; the clinic's `NODES`, `EDGES` and `BOXES` (`src/game/level.ts`) converted once to TOML fixtures by `packages/nav/scripts/convert-adventure-nav.ts` at `92e6704` (18 nodes, 22 edges, 21 boxes) |
| Converted, M6.7a (automata-plus#24) | `systems`: `src/game/systems.ts`, `agents.ts`, `probes.ts`, `pursuit.ts`, `contracts/systems.ts` and `nav.ts`'s `reserveNodes` and `reachable` rewritten on Koota; `tests/agents.test.ts`, `systems.test.ts` and `pursuit.test.ts` ported as behaviour specs (all but `wallRing` and `withHiding`); the four scenes' `SYSTEMS` (`src/scenes/{prologue,clinic,clinic-dawn,bay}/systems.ts`) converted once to TOML fixtures by `packages/systems/scripts/convert-adventure-systems.ts` at `92e6704` |
| Ported, M6.7b (automata-plus#25) | `systems` bots, scenarios and fairness: `src/game/bots.ts` and `scripts/pipeline/systems-lib.ts`'s `play`, `scenario`, `claimsCheck`, `playtest`, `fairness` and `sweep`, rewritten for AF's sim commands at `92e6704`; `tests/bots.test.ts`'s bot, fairness and claim cases ported (not the trace, emergent search and doc cases; not `tests/crew-fairness.test.ts`, the source game's crew) |
| Ported, M6.6b (automata-plus#26) | `puzzle`'s solver and tools: `src/game/puzzle-solver.ts`, `scripts/pipeline/puzzle-lib.ts` (`validate`, `analyse`, `routesOf`, `lockGraph`, `renderDoc`) and `scripts/pipeline/audit-lib.ts` (the generic audit), at `92e6704`; the clinic's solver model (`src/scenes/clinic/puzzle-model.ts`) ported by hand into a test; `tests/puzzle-solver.test.ts`, `clinic-puzzle.test.ts` and the generic cases of `puzzle-pipeline.test.ts` and `puzzle-audit.test.ts` ported |
| Converted, M6.8a (automata-plus#27) | `narrative`: `src/narrative/dialogue.ts`, `lines.ts`, `canon.ts` (its shape) and `storylets.ts`, and `src/game/contracts/narrative.ts`, rewritten on Koota at `92e6704`; `tests/dialogue.test.ts`'s runtime and in-game cases and `storylets.test.ts`'s salience, once and max, inspect, enter, dwell, system and state cases ported as behaviour specs (not the lint, screenplay, deck-check, radio or session cases); the four scenes' lines, dialogue graphs and decks (`src/scenes/{prologue,clinic,clinic-dawn,bay}/{story,dialogues,storylets}.ts`) and the canon converted once to TOML fixtures by `packages/narrative/scripts/convert-adventure-narrative.ts` at `92e6704` |
| Rewritten, M6.10a (automata-plus#32) | `audio-synth`: `src/audio/cues.ts`, `synth.ts`, `events.ts`, `mixer.ts`, `music.ts` and `music-rules.ts` at `92e6704`, rewritten as data (`audio` content), a synth on any `BaseAudioContext`, a mixer on core's buses and a generic music director; its `Beats` and `hash` moved into `feel`. Blips, foley, hallucinations, space and the inlined-sample loader are not ported |
| Ported, M6.8b (automata-plus#29) | `narrative` tools: `src/narrative/lint.ts`, `dialogue-lint.ts` (lint, `walk`, `stance`, `motifs`), `coverage.ts`, `help.ts` and `screenplay.ts`, and `scripts/pipeline/narrative-play.ts`, `narrative-coverage.ts` and `narrative-storylets.ts`'s deck checks, rewritten at `92e6704` (voice rules, endings and box geometry as options; text from the locale); the source's lint, dialogue, coverage and help cases ported on toy scenes; the four scenes' `beats.ts` and `help.ts` converted once by `packages/narrative/scripts/convert-adventure-narrative.ts` at `92e6704` (27 beats, 18 hint ladders). Not ported: the cutscene and conversation audits (M6.9) |
| Ported, M6.9a (automata-plus#30) | `cutscenes`: `src/game/cutscenes.ts` (`evaluate`, the script's keys and eases), `cutscene-lint.ts`'s generic rules (duration, fades, captions, sounds, lamps, shots, dead air, camera and actors against the map) rewritten at `92e6704` for scripts as data with anchors and tick-time playback; the source's evaluate, pose and camera-acting cases and lint cases ported on toy scripts; the four scenes' 28 cutscene scripts (`src/scenes/{prologue,clinic,clinic-dawn,bay}/cutscenes.ts`) converted once by `packages/cutscenes/scripts/convert-adventure-cutscenes.ts` at `92e6704`, each evaluated in one context. Not ported (M6.9b): `cutscene-builder.ts`, the renderer-dependent lint rules, the preview tool |
| Rewritten, M6.2 (automata-plus#33) | `debug`: the `window.game` driver and `?debug` handling in `src/main.ts` and the feel board in `src/feel/board.ts` at `92e6704`, rewritten as a build-gated overlay, panels and a generic driver (`debug-carry.ts` is not ported: a game concern) |
| Rewritten, M6.10b (automata-plus#34) | `audio-synth` offline render and checks: `scripts/pipeline/audio-lib.ts` (WAV, BS.1770-4 loudness, true peak, click detector), `scripts/pipeline/audio.ts` (render and check stages) and `src/audio/render.ts` and `board.ts` at `92e6704`, rewritten as a measure module, an offline render over the synth and mixer, an `audio` pipeline in Chromium and a debug panel; its legacy-parity, space-probe, sample-budget and music-loudness stages are not ported |
| Rewritten, M6.11 (automata-plus#36) | `blockout` pipeline: `scripts/pipeline/blockout.ts` (stages, `import`), `blockout-lib.ts` (`validate`, `generate`, `freshness`, `importScene`) and `tests/blockout.test.ts` at `92e6704`, rewritten as `validate` (plain findings), `generate` (stamped `sector-map` and `nav-graph` TOML), a game-supplied `shots` command with a PNG legibility read, and `import` from content files; its puzzle-hotspot binding, lamp checks, `facility` command and python leveller are not ported |
| Licence | No `LICENSE` file and no `license` field at `92e6704`: the Owner's own private repository, extracted on the Owner's direction (2026-10-11) |

### The arcade source

| Field | Value |
| --- | --- |
| Repository | `SNEKPRTY/FloorFifty` (private) |
| Recorded commit | `ac72660`, read 2026-10-16 |
| Taken (M6.1, into `mcthaydt/automata-plus` `feel`) | `apps/client/src/systems/gameplay/juice/` (`hit-stop`, `second-order`, `squash`, `lean`, `dust-pool`, `word-pool`, `word-text`, `room-beats`, `feel-director`'s routing), `systems/haptics.ts`, `content/juice.toml`'s shape, and their tests (M6 spec §4.1). `trauma.ts` informs core's `camera2d.shake` (M4) and is not extracted twice |
| Ported, M6.1a (automata-plus#31) | `feel`: `second-order.ts`, `squash.ts`, `lean.ts`, `hit-stop.ts` and `room-beats.ts` rewritten generic over a view key and a sim event, and `trauma.ts`'s budget (a small one of `feel`'s own for the frame's offset), read at `677d4568b7b2265fda4246d711065b8f417cac26` (the recorded `ac72660` is not fetchable from a shallow checkout); their `second-order`, `squash`, `lean`, `beats` (hit-stop and room-beats) and `trauma` cases ported. The adventure source's `src/feel/runtime.ts` and `effects.ts` (the frame model, limits, hashed noise and reduce flags) at `92e6704` shaped `createFeel` and the `feel` schema. Not ported (M6.1b, M6.1c): `dust-pool`, `word-pool`, `word-text`, `haptics`, `coverage`. The arcade source has no licence file |
| Rewritten, M7.5c (automata-plus#35) | `net`: `apps/client/src/systems/netcode/snapshot-buffer.ts`, the interpolation half of `render-clock.ts` (the authority half came with M7.5b) and `net-diagnostics.ts` with their tests, made generic: the buffer holds a game-supplied view with a per-field jump rule in place of the race's wrap, the delay estimator is `RenderClock`, and the diagnostics drop the race-specific parts (sprite pull, respawn adoption, `?netstats`) and add the `degraded` rule |
| Used as the reference, PRODUCT.6 (automata-plus#38) | `kits/ui-screens`: the results screen's contract from `apps/client/src/screens/game-end.ts` and `ui/components/ResultsPanel.svelte` at `677d456` (read 2026-10-31): rows come from the room's standings and the screen never orders players or picks a winner; the kit's `ResultsScreen` is written fresh and generic (rows in the order the caller gives, highlight, actions, a scroll region). No code copied. The kit's title, pause, settings, loading and error screens are compositions of core's `ui` parts and take no code from this source |
| Licence | No `LICENSE` file and no `license` field at `677d456` (checked 2026-10-31); the Owner's direction (2026-10-11) covers its use. M6.1's plan records it from the checkout it extracts from |

### Design input (not code)

| Field | Value |
| --- | --- |
| Repository | `mcthaydt/AutomataEngine-LegacyV2-` (private) |
| Commit | `18525fc` |
| Used | `docs/references/Narrative Architecture.md` (layered storylets; one shared state of facts, relationships, promises and reputations) as design input for `narrative` (row M6.8a; Owner, 2026-10-30: "Steal everything you need to") |

## The figure source

Repository: `mcthaydt/FigureBuilder`. Commit read: `025ffb48b941043e16ab680c847d33e2eb40eab4`. Licence: none recorded
(the Owner's private repository). Every file at that commit is listed in `builders-manifest.json`; each file's row below
says where it went in AF (3D slice task 6.1, spec 8.4).

Earlier extraction: the first port of the figures, at `a1f7246` (M3, `packages/3d/src/features/figures/` as
`packages/figures`), took the generators, rig, motion and clips; the 3D slice's phase 6 ports everything since, from
`025ffb4`, tests first.

Pull again: clone the builder, `git diff 025ffb4..<new> -- <the rows' source paths>`, port each hunk (tests first), add
a row for every new file, run `pnpm sources-md`, and record the new commit here and in the manifest. A row says
*ported*, *rewritten: what* or *left out: why*.

| Source file | AF file | How |
| --- | --- | --- |
| `src/features/body/genes.ts` | `packages/3d/src/features/figures/body/genes.ts` | rewritten: fat on the limbs, neck and jaw, `bust`, `seat`, the eyes' size, spacing and tilt, and the face and body asymmetry; the sliders' names and numbers are the builder's |
| `src/features/body/rig.ts` | `packages/3d/src/features/figures/body/rig.ts` | rewritten: the `sideBend` gene only; the rest was ported at `a1f7246` |
| `src/features/body/head.ts` | `packages/3d/src/features/figures/outfit/garments/head.ts` | rewritten: the jaw's underside widens with fat and the jaw with asymmetry (`HeadForm.width` takes a side) |
| `src/features/outfit/fit.ts` | `packages/3d/src/features/figures/body/profiles.ts` | rewritten: `profiles` and `ringAt` as one query of the body's rings, in `body/` where the layers allow it; `girth` and the cuffs and collar wait for task 6.4 |
| `src/features/motion/motion.ts` | `packages/3d/src/features/figures/motion/base.ts` | rewritten: the natural stand (`relaxed`, the neck's slide, the chest's lift), `standElbow`, `standOut` and the side bend; the actions stay clips, and `seated` waits for the seats |
| `src/features/motion/library/gaits.json` | `packages/3d/tests/fixtures/content/figure-gaits/strut.toml` | rewritten: `standOut` is the whole value and `standElbow` is new, so the fixture gaits (strut, loose, bounce, still, with games/base-3d's bounce) carry both |
| `tests/features/body/fat.test.ts` | `packages/3d/tests/unit/figures/body/diversity.test.ts` | rewritten: the fat classes, rings, jaw, bust and seat, the new genes' defaults and the face asymmetry, on the base pair |
| `src/features/lighting/lamps.ts` | `packages/3d/src/features/figures/lighting/lamps.ts` | rewritten: the lamp, its strength (flicker, light style, level) and the steps it lifts a point, as typed functions with `noise3` from `paint/raster.ts`; the lamp is `FigureLamp` |
| `src/features/lighting/grade.ts` | | left out: the colour moves along the DUEL ramps belong to the look's sprite light (3D slice task 8.2) |
| `src/features/lighting/light.ts` | | left out: `lightFigure` paints a CPU cell; the look's sprite light and its reference (task 8.2) replace it |
| `src/features/lighting/library/times.json` | `packages/3d/src/shared/time-of-day/library/times.json` | rewritten: merged with the environment source's six times of day into one entry each (exposure, lift, ambient and tint are `figure` and `scene.grade`) |
| `src/features/actors/actions.ts` | `packages/3d/src/features/figures/clips/figure-action.ts` | rewritten: the envelope (wind-up, action, recovery, hold) compiles to a clip the one player plays; the pose-spec keys and the repeat range wait for the other actions |
| `src/features/actors/pose-spec.ts` | | left out: the pose-spec's arms, feet and face-turn are for the nineteen actions beyond reach, look and flinch, which are not ported yet |
| `src/features/actors/library/actions.json` | `games/base-3d/src/content/figure-actions/look.toml` | rewritten: `look` only; reach and flinch come from the older extraction's motion, as `figure-action` files; the other eighteen are not ported yet |

## The environment source

Repository: `mcthaydt/environmentbuilder`. Commit read: `6d82a527bf0e6ae9c771b14f2cb5bfa487438ab0`. Licence: none
recorded (the Owner's private repository). Every file at that commit is listed in `builders-manifest.json`. Left out on
purpose: its `vendor/FigureBuilder` submodule (its door, `src/lib/figure.ts`, becomes AF imports), `docs/reference/`,
both `docs/superpowers/` folders and the review tooling.

Pull again: clone the builder, `git diff 6d82a52..<new> -- <the rows' source paths>`, port each hunk (tests first), add
a row for every new file, run `pnpm sources-md`, and record the new commit here and in the manifest.

| Source file | AF file | How |
| --- | --- | --- |
| `src/features/world/timeline.ts` | `packages/3d/src/shared/timeline/sample.ts` | rewritten: the key is `{ t, value, ease? }` (`v` is `value`), no ease is linear (the source's was `inOut`), `hold` reads as `step`, and the ease and the sampling are AF's, shared with the figures' clips; `wobble`, `lerpAngle` and `lerpV` wait for the shots |
| `src/features/paint/library/times.json` | `packages/3d/src/shared/time-of-day/library/times.json` | rewritten: merged with the figure source's six times of day (the light, haze and sky are `scene`) |

## Core: the doc comments that named their source (moved here 2026-11-07)

The published doc comments below named the arcade source (`SNEKPRTY/FloorFifty`); the doc comments no longer do, so
the record is here.

| AF file | Taken from |
| --- | --- |
| `packages/automata/src/shared/ui/touch/TouchControls.svelte` | `ui/components/TouchControls.svelte` at `ac72660` |
| `packages/automata/src/testing/layout/assertions.ts` | `tests/e2e/support/layout.ts` at `122a220` (`expectReachable`, `expectControlsFit`, `expectRowsWhole`, `expectApart`, `expectNoDocumentScroll`) |
| `packages/automata/src/shared/ui/layout/OptionGroup.svelte` | its pause and settings rows, which used `<button role="radio">` |
| `packages/automata/src/features/render/renderer.ts` | the plum-black letterbox colour `0x2e222f` |
| `packages/content/src/shared/flow/check-flow.ts` | `FLOW_TARGETS` and `byPair` |
| `packages/sim/src/features/replay/pack.ts` | the 1 MiB replay cap, raised here for goldens |

## Third-party assets copied into this repository

| Asset | Source | Licence |
| --- | --- | --- |
| `packages/editor/src/shared/kit/icons/paths.ts`: 33 icon drawings (the editor's tools, history, layers, zoom and brush size, document actions, the level picker's chevron, Fit, the inspector, the list, and the suite's Home, Tuner, level editors and Review) | [Lucide](https://lucide.dev), npm `lucide-static` 0.460.0, `icons/*.svg`, copied as the markup inside each svg on 2026-11-06 | ISC (Lucide Contributors; the portions from Feather are MIT, Cole Bemis). The licence asks that its copyright and permission notice appear in copies; the header of `paths.ts` carries the notice |
| `packages/content/src/shared/palette/duel.ts` and `docs/art/palettes/duel.{txt,md}`: the DUEL palette, 32 ramps of 8 (replaces Endesga 64, removed 2026-11, 3D slice task 5.1) | The 3D builders' copy of the DUEL look-up table (`mcthaydt/FigureBuilder` `src/features/paint/duel-ramps.ts` at `025ffb4`, generated from the table) | Author and licence not recorded yet: a placeholder until the Owner supplies them |

## Original assets made in this repository

| Asset | Made by | Source |
| --- | --- | --- |
| `games/base-3d/public/sounds/{ember,goal,roll,fall}.wav` | `games/base-3d/scripts/make-sounds.ts` (sine sweeps, a seeded noise swoosh) | None: original, synthesized from code on 2026-10-31 under the repository's licence; `src/sounds.test.ts` checks the committed files are exactly what the script writes |
