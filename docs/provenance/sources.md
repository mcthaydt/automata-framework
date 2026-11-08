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
| Moved, 3D slice task 6.5 (2026-11-07) | The streetwear garments (`streetwear/`, eleven files from `src/render/figure/streetwear.ts` at `a1f7246`) moved from `packages/3d/src/features/figures/outfit/streetwear/` to the example extension `examples/3d/wardrobe/garments/`; their text and source rows are unchanged but for imports (core's `@automata/3d/figures-kit` entry) and the garment shapes, schemas and defaults, which left `figure/garment.schema.ts` and `garment-defaults.ts` for `garment-types.ts`, `garment-schemas.ts` and `defaults.ts` |
| Moved, 3D slice task 7.6 (2026-11-07) | The clothes and hairstyles core left out (scope trim section 2): the garment kinds `apron`, `belt`, `coat`, `gloves`, `legs`, `mark`, `skirt` and `waistcoat` (from `src/render/figure/garments.ts` at `a1f7246`, as ported in `outfit/garments/classic.ts`), the hair piece generators (from `src/render/figure/hair.ts` at `a1f7246`: scalp, rows, tail, loose and older fall, bun, sweep, block, edges), the matte finishes, and the seats (`seated`, the `figure-seat` kind) leave `packages/3d` for `@automata/character-kit`. Their text and source rows are unchanged; the files as they were are in project files `af-character-kit-source/` and in the commit before 7.6's |
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
| `src/features/outfit/fit.ts` | `packages/3d/src/features/figures/body/profiles.ts` | rewritten: `profiles`, `ringAt`, `girth`, `clearance`, `Body` and `bodyOf` as one query of the body's rings, in `body/` where the layers allow it; the clearance is one texel at the fixed `FIGURE_PPM` (no cell density); the cuffs and the collar are sized from it in `outfit/garments/classic.ts` |
| `src/features/paint/fabric.ts` | `packages/3d/src/features/figures/registry/fabric-registry.ts` | rewritten: the registry only (`Fabric`, `registerFabric`, `fabricOf`, `labelAt`), a taken name a `RegistryClash`; the painter that reads the labels is not taken, so no base look moves |
| `src/features/hair/hair.ts` | `packages/3d/src/features/figures/hair/hair-parts.ts` | rewritten: hands each entry of a style's `pieces` to the piece registered under its key (`HairBuild` is what they share) and builds none itself; the generators (scalp, rows, tail with its low `hang`, bun with `flat`, the older fall, sweep, block, edges) and the matte finishes moved to `@automata/character-kit` (3D slice task 7.6; the files as they were are in project files `af-character-kit-source/`); the tones and `shell` stay for caps |
| `src/features/motion/library/seats.json` | | left out: moved to `@automata/character-kit` (3D slice task 7.6): the `figure-seat` content kind, `seated` and the eight seats leave core with the rest of the clothes, hairstyles and seats; the files as they were are in project files `af-character-kit-source/` |
| `src/features/motion/motion.ts` | `packages/3d/src/features/figures/motion/base.ts` | rewritten: the natural stand (`relaxed`, the neck's slide, the chest's lift), `standElbow`, `standOut` and the side bend; the actions stay clips, and `seated` moved to the character kit |
| `src/features/motion/library/gaits.json` | `packages/3d/tests/fixtures/content/figure-gaits/strut.toml` | rewritten: `standOut` is the whole value and `standElbow` is new, so the fixture gaits (strut, loose, bounce, still, with games/base-3d's bounce) carry both |
| `tests/features/body/fat.test.ts` | `packages/3d/tests/unit/figures/body/diversity.test.ts` | rewritten: the fat classes, rings, jaw, bust and seat, the new genes' defaults and the face asymmetry, on the base pair |
| `src/features/lighting/lamps.ts` | `packages/3d/src/features/figures/lighting/lamps.ts` | rewritten: the lamp, its strength (flicker, light style, level) and the steps it lifts a point, as typed functions with `noise3` from `paint/raster.ts`; the lamp is `FigureLamp` |
| `src/features/lighting/grade.ts` | | left out: the colour moves along the DUEL ramps belong to the look's sprite light (3D slice task 8.2) |
| `src/features/lighting/light.ts` | | left out: `lightFigure` paints a CPU cell; the look's sprite light and its reference (task 8.2) replace it |
| `src/features/lighting/library/times.json` | `packages/3d/src/shared/time-of-day/library/times.json` | rewritten: merged with the environment source's six times of day into one entry each (exposure, lift, ambient and tint are `figure` and `scene.grade`) |
| `src/features/actors/actions.ts` | `packages/3d/src/features/figures/clips/figure-action.ts` | rewritten: the envelope (wind-up, action, recovery, hold) compiles to a clip the one player plays; the pose-spec keys and the repeat range wait for the other actions |
| `src/features/actors/pose-spec.ts` | | left out: the pose-spec's arms, feet and face-turn are for the nineteen actions beyond reach, look and flinch, which are not ported yet |
| `src/features/actors/library/actions.json` | `games/base-3d/content/figure-actions/look.toml` | rewritten: `look` only; reach and flinch come from the older extraction's motion, as `figure-action` files; the other eighteen are not ported yet |
| `.gitignore` | | left out: the builder's own readme, rules or editor settings; AF's are its own |
| `.vscode/settings.json` | | left out: the builder's own readme, rules or editor settings; AF's are its own |
| `CLAUDE.md` | | left out: the builder's own readme, rules or editor settings; AF's are its own |
| `README.md` | | left out: the builder's own readme, rules or editor settings; AF's are its own |
| `docs/actors.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/audits/2026-11-05-wardrobe-hooks-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/refactor-progress.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-05-stage1-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-05-stage3-plan-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-05-stage5-result-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/README.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/across-d2-pitch0-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/across-d2-pitch0.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/across-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/across-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/across-d4-pitch0-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/across-d4-pitch0.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/across-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/across-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/across-lit-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/across-lit-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/across-lit-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/across-lit-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/check-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/check-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/check-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/check-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/check-lit-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/check-lit-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/check-lit-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/check-lit-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/plain-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/plain-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/plain-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/plain-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/rib-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/rib-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/rib-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/rib-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/rib-lit-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/rib-lit-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/rib-lit-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/rib-lit-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/twill-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/twill-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/twill-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/twill-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/twill-lit-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/twill-lit-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/twill-lit-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/twill-lit-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/twill-walk-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-a/twill-walk-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/README.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-bust0-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-bust0-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-bust0-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-bust0-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-bust1-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-bust1-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-bust1-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-bust1-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-fat0-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-fat0-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-fat0-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-fat0-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-fat1.2-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-fat1.2-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-fat1.2-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-fat1.2-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-fat1.2-walk-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-fat1.2-walk-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-neck1-fat1.2-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-neck1-fat1.2-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-neck1-fat1.2-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-neck1-fat1.2-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-seat0-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-seat0-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-seat0-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-seat0-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-seat1-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-seat1-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-seat1-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-f-seat1-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-bust0-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-bust0-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-bust0-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-bust0-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-bust1-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-bust1-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-bust1-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-bust1-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-fat0-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-fat0-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-fat0-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-fat0-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-fat1.2-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-fat1.2-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-fat1.2-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-fat1.2-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-fat1.2-walk-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-fat1.2-walk-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-neck1-fat1.2-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-neck1-fat1.2-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-neck1-fat1.2-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-neck1-fat1.2-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-seat0-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-seat0-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-seat0-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-seat0-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-seat1-d2-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-seat1-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-seat1-d4-x1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-gate-b/base-m-seat1-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-impl-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-cloth-plan-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/base-f-turn-d2-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/base-m-turn-d2-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/before-after-base-f-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/before-after-base-f-d4-back.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/before-after-base-m-d2-head.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/before-after-base-m-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/heroes-before-after.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/neckline-d4-cap-before-after.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/neckline-off-on.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/talk-d1-before-after.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/talk-d1-fix-actors-frame.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/talk-d1-fix-views.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-impl-audit/walk-to-stand-pop.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-stand-plan-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-diversity-plan-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/base-f-hero-d1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/base-f-hero-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/base-f-hero-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/base-f-turn-d1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/base-f-turn-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/base-f-turn-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/base-m-hero-d1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/base-m-hero-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/base-m-hero-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/base-m-turn-d1.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/base-m-turn-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/base-m-turn-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/big-turn-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/big-walk-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/cheekwidth-mark-vs-outline.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/faces-base-f-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/fat-softened-front-back.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/lifter-turn-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage1/ugly-turn-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage2/eye-swap.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage2/eyes-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage2/eyes-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage2/hood-lighter-base-f-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage3/body-asymmetry-base-m-hero-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage3/body-asymmetry-base-m-turn-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage3/body-asymmetry-base-m-walk-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage3/face-asymmetry-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage3/face-asymmetry-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage4/base-f-bust-seat-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage4/base-f-bust-seat-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage4/base-m-bust-seat-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage4/base-m-bust-seat-d4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/bench-beauty-turn-d2-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/bench-beauty-turn-d4-x2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/bench-beauty-walk-d2-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/bench-big-turn-d2-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/bench-big-walk-d2-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/bench-curly-turn-d2-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/bench-curly-walk-d2-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/bench-elder-turn-d2-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/bench-elder-walk-d2-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/bench-lineup-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/demo-bench-hair.diff` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/pieces-turn-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/pieces-turn-d4-a.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/pieces-turn-d4-b.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-stage5/pieces-walk-d2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/plans/2026-11-05-base-pair-refactor.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/plans/2026-11-06-c3-cloth.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/plans/2026-11-06-c4-diversity.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/plans/2026-11-06-natural-stand.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/progress.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-05-base-pair-refactor-design.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-c3-cloth-design.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-c4-diversity-design.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-c4-diversity/before-beauty-hero-d4-x2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-c4-diversity/before-big-turn-d2-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-c4-diversity/before-lineup-x4.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-c4-diversity/before-ugly-hero-d4-x2.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-c4-diversity/probe-fat-limbs.diff.txt` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-c4-diversity/probe-fat-limbs.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-natural-stand-design.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-natural-stand/collars.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-natural-stand/n2-vs-current.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-natural-stand/neck-rotation-rejected.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-natural-stand/palm-twist.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-natural-stand/probe.diff.txt` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-natural-stand/weight-shift-options.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `package-lock.json` | | left out: the builder's package and build setup; AF's packages have their own |
| `package.json` | | left out: the builder's package and build setup; AF's packages have their own |
| `scripts/actors-demo.ts` | | left out: the builder's command line draws with its CPU painter; AF records its goldens with `packages/3d/scripts/record-goldens.ts` |
| `scripts/golden.ts` | | left out: the builder's command line draws with its CPU painter; AF records its goldens with `packages/3d/scripts/record-goldens.ts` |
| `scripts/lit.ts` | | left out: the builder's command line draws with its CPU painter; AF records its goldens with `packages/3d/scripts/record-goldens.ts` |
| `scripts/render.ts` | | left out: the builder's command line draws with its CPU painter; AF records its goldens with `packages/3d/scripts/record-goldens.ts` |
| `tests/api.test.ts` | | left out: the builder's layer rule and public-surface test; AF's `pnpm boundaries` and `pnpm api-report` do that |
| `tests/architecture.test.ts` | | left out: the builder's layer rule and public-surface test; AF's `pnpm boundaries` and `pnpm api-report` do that |
| `tests/golden/actors.json` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/actors.test.ts` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/actors.ts` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base.test.ts` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base.ts` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base/base-f-hero-d1.rgba.gz` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base/base-f-hero-d2.rgba.gz` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base/base-f-turn-d1.rgba.gz` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base/base-f-turn-d2.rgba.gz` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base/base-f-walk-d1.rgba.gz` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base/base-f-walk-d2.rgba.gz` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base/base-m-hero-d1.rgba.gz` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base/base-m-hero-d2.rgba.gz` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base/base-m-turn-d1.rgba.gz` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base/base-m-turn-d2.rgba.gz` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base/base-m-walk-d1.rgba.gz` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/base/base-m-walk-d2.rgba.gz` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/lit.json` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/lit.test.ts` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/lit.ts` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/sprites.json` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tests/golden/sprites.ts` | | left out: the golden pixels of the CPU painter; AF does not ship the painter and records its own goldens from its geometry and motion |
| `tsconfig.json` | | left out: the builder's package and build setup; AF's packages have their own |
| `vitest.config.ts` | | left out: the builder's package and build setup; AF's packages have their own |
| `src/features/paint/paint.ts` |  | left out: the figure's CPU painter and rasteriser; the view draws the figure's meshes with Pixi 3D |
| `src/features/paint/raster.ts` |  | left out: the figure's CPU painter and rasteriser; the view draws the figure's meshes with Pixi 3D |
| `tests/features/paint/materials.test.ts` |  | left out: the figure's CPU painter and rasteriser; the view draws the figure's meshes with Pixi 3D |
| `tests/features/paint/neckline.test.ts` |  | left out: the figure's CPU painter and rasteriser; the view draws the figure's meshes with Pixi 3D |
| `tests/features/paint/prints.test.ts` |  | left out: the figure's CPU painter and rasteriser; the view draws the figure's meshes with Pixi 3D |
| `tests/features/paint/fabric.test.ts` |  | left out: the figure's CPU painter and rasteriser; the view draws the figure's meshes with Pixi 3D |
| `tests/features/paint/fabric-fixtures.ts` |  | left out: the figure's CPU painter and rasteriser; the view draws the figure's meshes with Pixi 3D |
| `tests/features/figure/render.test.ts` |  | left out: the figure's CPU painter and rasteriser; the view draws the figure's meshes with Pixi 3D |
| `tests/features/figure/light-hook.test.ts` |  | left out: the figure's CPU painter and rasteriser; the view draws the figure's meshes with Pixi 3D |
| `tests/features/draw.ts` |  | left out: the figure's CPU painter and rasteriser; the view draws the figure's meshes with Pixi 3D |
| `src/lib/math.ts` | `packages/3d/src/shared/math/math.ts` | ported: the vector and matrix helpers; the results are bit-identical |
| `tests/features/body/sliders.test.ts` | `packages/3d/tests/unit/figures/figure/slider-ends.test.ts` | rewritten: every slider at either end on the golden outfits |
| `tests/features/motion/form.test.ts` | `packages/3d/tests/unit/figures/motion/base.test.ts` and `packages/3d/tests/unit/figures/motion/stands.test.ts` | rewritten: the walk and the pocket holds, on AF's fixture figures |
| `tests/features/motion/stand.test.ts` | `packages/3d/tests/unit/figures/motion/natural-stand.test.ts` | rewritten: checked through `base` |
| `tests/features/outfit/fit.test.ts` | `packages/3d/tests/unit/figures/outfit/fit.test.ts` | rewritten: to the body as a query (`girth`, `clearance`) |
| `tests/features/hair/hooks.test.ts` | `packages/3d/tests/unit/figures/registry/hair-registry.test.ts` | rewritten: hair pieces, finishes and fabrics as registries |
| `tests/features/motion/seats.test.ts` |  | left out: moved to `@automata/character-kit` with the seats (3D slice task 7.6) |
| `tests/features/hair/hang.test.ts` |  | left out: tests the low pony, bun and fall pieces, which moved to `@automata/character-kit` (3D slice task 7.6) |
| `tests/features/hair/options.test.ts` |  | left out: tests the hair finishes and pieces that moved to `@automata/character-kit` (3D slice task 7.6) |
| `tests/features/body/bust-seat.test.ts` | `packages/3d/tests/unit/figures/body/diversity.test.ts` | rewritten: folded into the diversity cases (bust and seat are the default at 0.5) |
| `tests/features/body/asymmetry.test.ts` | `packages/3d/tests/unit/figures/body/diversity.test.ts` | rewritten: folded into the diversity cases (asymmetry has defaults that change nothing) |
| `base/base.ts` | `packages/3d/src/features/figures/base/base-pair.ts` | rewritten: the base pair as data; see the row for `base/base.ts` (FigureBuilder: `BASE`) in the environment source's table |
| `src/features/actors/actor.ts` |  | left out: the scripted actor and its second player; an action is a clip the one player plays (`clips/figure-action.ts`), and a script of actors is the cutscenes extension's |
| `src/features/body/parts.ts` | `packages/3d/src/shared/math/superquadric.ts` | rewritten: the part builders as ported at `a1f7246` and now the shared superquadric and limb meshes (`shared/math/limb.ts`, `features/figures/body/mesh.ts`), with the fat on the limbs |
| `src/features/figure/cast.ts` | `packages/3d/src/features/figures/figure/figure.schema.ts` | rewritten: a character file is a `FigureDef` (Zod, the `figure` content kind, `content/figures.content.ts`), not a cast member |
| `src/features/figure/cloth.ts` |  | left out: the cloth coordinates a fabric is laid by; the fabric painter is not taken (see the `fabric.ts` row), so nothing reads them |
| `src/features/figure/figure.ts` | `packages/3d/src/features/figures/view/figure-view.ts` | rewritten: the runtime figure is the view (`figure-view.ts`) over `build` and the skeleton, drawn with Pixi 3D |
| `src/features/figure/frames.ts` |  | left out: the review frames of the CPU painter; AF's goldens are the figure's built parts and the view's frames |
| `src/features/hair/library/hair.json` | `packages/3d/tests/fixtures/content/figure-hair/bob.toml` | rewritten: hair styles are `figure-hair` content (TOML); core ships none, the tests keep `bob`, `cropped` and `curtain`, and the pieces' styles go to `@automata/character-kit` |
| `src/features/motion/library/poses.json` | `packages/3d/tests/fixtures/content/figure-poses/stand.toml` | rewritten: poses are `figure-pose` content (TOML); core ships none, the tests keep twelve (`stand`, `guard-high`, `reach-out` and the rest) |
| `src/features/motion/presets.ts` | `packages/3d/src/features/figures/content/gait.schema.ts` | rewritten: gait and pose presets are content (`figure-gait`, `figure-pose` and `figure-stand` TOML), checked by `gait.schema.ts`, `pose.schema.ts` and `stand.schema.ts` |
| `src/features/outfit/garments.ts` | `packages/3d/src/features/figures/outfit/garments/classic.ts` | rewritten: the garment kinds, registered through `registry/garment-registry.ts`; core registers seven (`classic-kinds.ts`) and the rest went to `@automata/character-kit` (3D slice task 7.6) |
| `src/features/outfit/items.ts` | `packages/3d/src/features/figures/figure/build.ts` | rewritten: a held item's parts are built in `build` from the `figure-item` content (`content/item.schema.ts`) |
| `src/features/outfit/library/items.json` | `packages/3d/tests/fixtures/content/figure-items/torch.toml` | rewritten: items are `figure-item` content (TOML); core ships none, the tests keep `hand-lamp`, `lighter` and `torch` |
| `src/features/outfit/library/swatches.json` | `packages/3d/tests/fixtures/content/figure-swatches/navy.toml` | rewritten: swatches are `figure-swatch` content (TOML) naming DUEL palette entries; core ships the base pair's (`BASE_PAIR_SWATCHES`) and the tests keep the rest |
| `src/features/paint/duel-ramps.ts` | `packages/content/src/shared/palette/duel.ts` | rewritten: the DUEL palette as `@automata/content`'s default palette; the ramps a light steps along are `features/look/ramp-light.ts` |
| `src/index.ts` |  | left out: the builder's public surface; AF's is `packages/3d/src/entries/` |
| `src/lib/colour.ts` | `packages/3d/src/shared/math/colour.ts` | ported: `oklab`, `labDistance` and `hexToRgb`; the rest of the builder's snapping is the look's DUEL pass |
| `tests/features/actors/actors.test.ts` | `packages/3d/tests/unit/figures/clips/actions.test.ts` | rewritten: the cases on the actions, run on clips |
| `tests/features/body/ends.ts` | `packages/3d/tests/unit/figures/figure/slider-ends.test.ts` | rewritten: the list of sliders whose range is not 0 to 1 |
| `tests/features/body/face-d2.test.ts` |  | left out: the face drawn at 2 pixels per texel by the CPU painter |
| `tests/features/figure/cloth.test.ts` |  | left out: tests the cloth coordinates, which are not taken |
| `tests/features/figure/eyes.test.ts` | `packages/3d/tests/unit/figures/body/diversity.test.ts` | rewritten: the eyes' size, spacing and tilt are folded into the diversity cases |
| `tests/features/hair/densities.test.ts` |  | left out: hair drawn at the CPU painter's pixel densities |
| `tests/features/motion/legacy-gait.test.ts` | `packages/3d/tests/unit/figures/motion/base.test.ts` | rewritten: the gait fields' cases are in the motion base test |
| `tests/features/outfit/faces.test.ts` | `packages/3d/tests/unit/figures/figure/build.test.ts` | rewritten: the face marks (brow, mouth) are cases of `build`'s anchors and parts |
| `tests/features/outfit/hooks.test.ts` | `packages/3d/tests/unit/figures/registry/outfit-hooks-registry.test.ts` | rewritten: the outfit hooks' cases |
| `tests/features/outfit/items.test.ts` | `packages/3d/tests/unit/figures/figure/build.test.ts` | rewritten: the held item's parts are cases of `build` |
| `tests/features/outfit/moods.test.ts` |  | left out: the drawn moods (smile, dead, gaze) are painted by the CPU painter |
| `tests/features/outfit/options.test.ts` | `packages/3d/tests/unit/figures/outfit/fit.test.ts` | rewritten: the cuffs and the collar are sized from the body (`fit.test.ts`); the stubble is a swatch and a mark |
| `tests/features/outfit/regions.test.ts` |  | left out: the shoe and sole regions of the CPU raster |

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
| `src/features/world/types.ts` (`MapPlan`, `Sector`, `Plane`, `MapWall`, `Decor`, `WindowGrid`, `Dress`, `MapSprite`, `Lamp`) | `packages/3d/src/shared/level/af-sector-2.schema.ts` | rewritten: as Zod, the `/2` file's fields, one per row of the 3D spec's section 9 table; `swatch` is `surface`, `ceil` is `ceiling`, a plane is a number or `{ z, slope?, sky?, surface? }`, and what the builder only cached (`dressed`, `doorState`, a door's `shown`, a sprite's `diorama`) is left out |
| `src/lib/geometry.ts` (`merge`, `tube`) | `packages/3d/src/shared/math/geometry.ts` | ported: `merge` and `tube` as written; `MeshData` (the plain mesh triple) and `windToNormals` (every triangle winds the way its normals point, so a renderer may cull back faces; the builder's raster did not cull) are AF's |
| `src/features/world/mesh.ts` (`quad`, `box`, `rbox`, `cylinder`, `rod`, `cone`, `blob`) | `packages/3d/src/features/world/mesh.ts` | ported: as written, each winding to its normals; `rbox`, `rod`, `cone` and `blob` return with the five base props (3D slice task 7.7); `turnY` and `turnX` go with the prop library to `@automata/world-kit` |
| `src/features/world/props.ts` (`table`, `bin`, `lamp`, `streetLamp`, `tree`) and `stream` | `packages/3d/src/features/world/props/base-props.ts` and `packages/3d/src/features/world/stream.ts` | ported: the five generators as written (the numbers are the source's), the ones the base scenes are made of; the rest of the prop library goes to `@automata/world-kit` |
| `base/base.ts` (EnvironmentBuilder: `interior`, `exterior`) | `packages/3d/src/features/world/base/base-scenes.ts` and `packages/3d/src/features/world/base/base-library.ts` | rewritten: the two bare scenes converted once to `af-sector/2` levels (with the 78e0ca7f converter, then written out), the swatches and presets they name as a library of flat DUEL steps; the dressed variants and the photo textures go to `@automata/world-kit` |
| `base/base.ts` (FigureBuilder: `BASE`) | `packages/3d/src/features/figures/base/base-pair.ts` | rewritten: the two figures' sliders and faces as written, painted-on blocks, hair as inline locks (the braided pony and the fade go to `@automata/character-kit`), colours as the DUEL swatches `BASE_PAIR_SWATCHES`; the pose and the face's camera and blink are the stand and the view's |
| `src/features/world/subdivide.ts` | `packages/3d/src/features/world/subdivide.ts` | ported |
| `src/features/stage/state.ts` (`StateScript`, `Snapshot`: doors, lamps, props) | `packages/3d/src/shared/level/piece-states.ts` and `packages/3d/src/app/update-pieces.ts` | rewritten: only the state of the pieces stays in core (a door's opening, a lamp's level and colour, a prop's place, turn and presence) and `updatePieces` applies a change of it to the meshes; the keys, the time of day, the grade, dynamic lights and `SceneState` are the cutscenes extension's |
| `src/features/world/surface.ts` (`isSurfaceTex`, `tileName`, `texOf`, `wallFrame`) | `packages/3d/src/features/world/surface.ts` | ported: the surface types are the `/2` schema's; `objectFrame` comes with the props |
| `src/features/world/swatches.ts` | `packages/3d/src/features/world/swatches.ts` | rewritten: the library is handed in (a game adds its own), and an unknown name is a `LevelProblem` the builder reports, not a throw; `name#seed` still reads as its base; the `world-swatch` content kind is core's, the swatch library goes to `@automata/world-kit` |
| `src/features/world/sectors.ts` (`vertsOf`, `inside`, `heightAt`, `signedArea`, `triangulate`, `segments`, `inward`) | `packages/3d/src/features/world/sectors.ts` | rewritten: a sector is `/2`'s `corners` and `holes` (a hole is walled from the room side; the point tests and the triangulation are `shared/level/geometry.ts`, moved from editor-3d's `geometry/{sectors,triangulate}.ts`), a room with no area is `isDegenerate`, and the shared stretch of an edge is found by geometry as the source did; `sectorAt`, `floorAt`, `dollhouseStub`, `wallInDiorama` and `lintel*` are not here (views belong to the editor, and nothing reads the rest yet) |
| `src/features/world/map.ts` (`planeMesh`, `wallQuad`, `onWall`, `rotY`) | `packages/3d/src/features/world/plane-mesh.ts` | ported: over `/2`'s planes and the bridged fill |
| `src/features/world/map.ts` (`decorPieces`, `doorPieces`) | `packages/3d/src/features/world/decor.ts` | rewritten: the rng is AF's seeded one, a piece names its swatch for the library to check, a hinged door is built shut and carries its hinge and swing for the stage to turn; a sign draws nothing until the world kit's lettering draws it |
| `src/features/world/map.ts` (`mapPieces`, first-person view) and `build.ts` | `packages/3d/src/features/world/build.ts` | rewritten: `buildWorld(level, library)` over `/2`, returning pieces and `LevelProblem`s; a level is built whole (the diorama's cut-away and the top-down clip are the editor's), a wall's `door` and `window` are cut from its face, a wall's `next` must agree with the shared stretch found by geometry, and grime, litter and emitters wait for task 7.3; `build.ts`'s prop placement (`buildScene`, `paramsOf`) comes with the props |
| `.claude/settings.json` | | left out: the builder's own readme, rules or editor settings; AF's are its own |
| `.gitignore` | | left out: the builder's own readme, rules or editor settings; AF's are its own |
| `.gitmodules` | | left out: the builder's own readme, rules or editor settings; AF's are its own |
| `.vscode/settings.json` | | left out: the builder's own readme, rules or editor settings; AF's are its own |
| `CLAUDE.md` | | left out: the builder's own readme, rules or editor settings; AF's are its own |
| `README.md` | | left out: the builder's own readme, rules or editor settings; AF's are its own |
| `docs/camera-and-state.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/dressing.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/environments-history.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/lighting.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/photos.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/README.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/corridor-on.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/hall-on.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/source/docs/style/look.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/source/src/render/dressing.ts` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/source/src/render/figure/ramp-light.ts` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/source/src/render/fog.ts` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/source/src/render/indirect-light.ts` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/source/src/render/look.ts` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/source/src/render/occlusion.ts` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/source/src/render/sector-mesh.ts` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/source/src/render/sprite-light.ts` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/supply-on.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/reference/the-last-light/ward-on.png` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-05-c2-implementation-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-05-c2-plan-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-05-implementation-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-05-pixel-3d-gap-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-05-plan-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-implementation-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c3-plan-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-implementation-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c4-plan-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c5-implementation-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c5-plan-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c6-implementation-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/audits/2026-11-06-c6-plan-audit.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/plans/2026-11-05-base-scenes-vertex-light-dresser.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/plans/2026-11-05-environment-builder.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/plans/2026-11-06-fast-tuning.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/plans/2026-11-06-figure-exposure.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/plans/2026-11-06-figures-read-surfaces-read.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/plans/2026-11-06-instant-checks.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/plans/2026-11-06-sprite-light-build-textures.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/progress.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-05-base-scenes-vertex-light-dresser-design.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-05-environment-builder-design.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-05-klipp-rig-design.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-fast-tuning-design.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-figure-exposure-design.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-figures-read-surfaces-read-design.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-instant-checks-design.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `docs/superpowers/specs/2026-11-06-sprite-light-build-textures-design.md` | | left out: the builder's own notes, specs, plans, audits and references; AF's are under `docs/` |
| `package-lock.json` | | left out: the builder's package and build setup; AF's packages have their own |
| `package.json` | | left out: the builder's package and build setup; AF's packages have their own |
| `scripts/board.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `scripts/check.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `scripts/checks.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `scripts/golden.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `scripts/lit.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `scripts/map.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `scripts/photos.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `scripts/render.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `scripts/save.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `scripts/sheet.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `scripts/textures.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `scripts/tune-light.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `scripts/tune.ts` | | left out: the builder's command line (render, board, tune, photos, textures, golden) drives its CPU renderer and photo tools, which core does not ship |
| `tests/api.test.ts` | | left out: the builder's layer rule and public-surface test; AF's `pnpm boundaries` and `pnpm api-report` do that |
| `tests/architecture.test.ts` | | left out: the builder's layer rule and public-surface test; AF's `pnpm boundaries` and `pnpm api-report` do that |
| `tests/golden/base.json` | | left out: golden images of the CPU renderer and the photo tiles; core does not ship them |
| `tests/golden/base.test.ts` | | left out: golden images of the CPU renderer and the photo tiles; core does not ship them |
| `tests/golden/base.ts` | | left out: golden images of the CPU renderer and the photo tiles; core does not ship them |
| `tests/golden/scenes.json` | | left out: golden images of the CPU renderer and the photo tiles; core does not ship them |
| `tests/golden/scenes.test.ts` | | left out: golden images of the CPU renderer and the photo tiles; core does not ship them |
| `tests/golden/scenes.ts` | | left out: golden images of the CPU renderer and the photo tiles; core does not ship them |
| `tests/golden/tiles.json` | | left out: golden images of the CPU renderer and the photo tiles; core does not ship them |
| `tests/golden/tiles.test.ts` | | left out: golden images of the CPU renderer and the photo tiles; core does not ship them |
| `tests/golden/tiles.ts` | | left out: golden images of the CPU renderer and the photo tiles; core does not ship them |
| `tsconfig.json` | | left out: the builder's package and build setup; AF's packages have their own |
| `vendor/FigureBuilder` | | left out: the submodule that gives the builder its figures; AF imports its own figure code |
| `vite.config.ts` | | left out: the builder's package and build setup; AF's packages have their own |
| `src/features/photo/library/photos.json` | `extensions/world-kit/assets/photos/photos.json` | ported: each photo keeps its source, licence and credit (Poly Haven, CC0) |
| `src/features/photo/library/photos/aggregate.png` | `extensions/world-kit/assets/photos/aggregate.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/asphalt.png` | `extensions/world-kit/assets/photos/asphalt.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/bark.png` | `extensions/world-kit/assets/photos/bark.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/beams.png` | `extensions/world-kit/assets/photos/beams.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/brick.png` | `extensions/world-kit/assets/photos/brick.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/brickYellow.png` | `extensions/world-kit/assets/photos/brickYellow.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/carpet.png` | `extensions/world-kit/assets/photos/carpet.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/ceilingPaint.png` | `extensions/world-kit/assets/photos/ceilingPaint.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/ceilingTiles.png` | `extensions/world-kit/assets/photos/ceilingTiles.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/checker.png` | `extensions/world-kit/assets/photos/checker.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/cobbles.png` | `extensions/world-kit/assets/photos/cobbles.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/concrete.png` | `extensions/world-kit/assets/photos/concrete.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/corrugated.png` | `extensions/world-kit/assets/photos/corrugated.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/dirt.png` | `extensions/world-kit/assets/photos/dirt.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/fabric.png` | `extensions/world-kit/assets/photos/fabric.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/floorTiles.png` | `extensions/world-kit/assets/photos/floorTiles.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/kerb.png` | `extensions/world-kit/assets/photos/kerb.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/laminate.png` | `extensions/world-kit/assets/photos/laminate.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/lino.png` | `extensions/world-kit/assets/photos/lino.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/metal.png` | `extensions/world-kit/assets/photos/metal.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/metalSheet.png` | `extensions/world-kit/assets/photos/metalSheet.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/paintedPlaster.png` | `extensions/world-kit/assets/photos/paintedPlaster.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/panelling.png` | `extensions/world-kit/assets/photos/panelling.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/pavement.png` | `extensions/world-kit/assets/photos/pavement.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/paving.png` | `extensions/world-kit/assets/photos/paving.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/planks.png` | `extensions/world-kit/assets/photos/planks.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/plaster.png` | `extensions/world-kit/assets/photos/plaster.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/plasterFinish.png` | `extensions/world-kit/assets/photos/plasterFinish.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/roof.png` | `extensions/world-kit/assets/photos/roof.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/rug.png` | `extensions/world-kit/assets/photos/rug.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/scallopPlaster.png` | `extensions/world-kit/assets/photos/scallopPlaster.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/stone.png` | `extensions/world-kit/assets/photos/stone.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/stripedWallpaper.png` | `extensions/world-kit/assets/photos/stripedWallpaper.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/stucco.png` | `extensions/world-kit/assets/photos/stucco.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/tiles.png` | `extensions/world-kit/assets/photos/tiles.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/wallTiles.png` | `extensions/world-kit/assets/photos/wallTiles.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/woodGrain.png` | `extensions/world-kit/assets/photos/woodGrain.png` | ported: the photo, unchanged |
| `src/features/photo/library/photos/woodPanels.png` | `extensions/world-kit/assets/photos/woodPanels.png` | ported: the photo, unchanged |
| `src/features/photo/pipeline.ts` | `extensions/world-kit/src/features/textures/pipeline.ts` and `extensions/world-kit/src/features/textures/tile.ts` and `extensions/world-kit/src/features/textures/texture-spec.ts` | rewritten: the stages (`flatten`, `facet`, `resample`, `indexTone`, `indexPhoto`, `wear`, `clean`) as written, the numbers the source's, over a decoded PNG instead of a canvas; the tile is one format shared with the swatch library (`Tile`, `photoToTile(png, knobs)`) and the knobs are a `TextureSpec` with the source's defaults |
| `src/features/photo/structure.ts` | `extensions/world-kit/src/features/textures/structure.ts` and `extensions/world-kit/src/features/textures/check-reads.ts` | rewritten: the checks are the source's (`READS`: blotch, dominant, span, spots, patches) as written; `checkReads(level, library, photos)` reports a swatch that misses its declared `reads` as the level problem `swatch-reads`, where the source's script printed it |
| `src/features/photo/textures.ts` | `extensions/world-kit/src/features/textures/photos.ts` and `extensions/world-kit/src/features/textures/swatch-tiles.ts` and `extensions/world-kit/src/features/textures/swatch-issues.ts` and `extensions/world-kit/src/features/textures/textures-command.ts` | rewritten: tiles are committed JSON (`library/tiles/*.tile.json`) stamped with their photo's sha-256, `staleTiles` reports a missing, stray or stale one, and `automata-world-textures [--check] [--out dir]` makes and checks them |
| `src/lib/png.ts` | `extensions/world-kit/src/features/textures/png.ts` | rewritten: `decodePng` only; the encoder served the CPU renderer and is left out |
| `tests/features/photo/pipeline.test.ts` | `extensions/world-kit/tests/unit/textures/photo-to-tile.test.ts` | rewritten: over generated PNGs (`tests/fixtures/png.ts`), the same properties: deterministic, on the palette, the same tile for the same knobs |
| `tests/features/photo/structure.test.ts` | `extensions/world-kit/tests/unit/textures/structure.test.ts` | rewritten: over the kit's tiles |
| `tests/features/photo/textures.test.ts` | `extensions/world-kit/tests/unit/textures/swatch-tiles.test.ts` and `extensions/world-kit/tests/unit/textures/textures-command.test.ts` | rewritten: every committed tile matches its photo's hash, a stale, missing or stray one is reported, and the command exits 0, 1 or 2 |
| `tests/lib/png.test.ts` | | left out: the photo library and its pipeline go to `@automata/world-kit` (scope trim section 2); core draws the textures a game supplies |
| `src/features/paint/paint.ts` |  | left out: the CPU scene painter; the Pixi 3D look (`features/look`, ADR 0007) draws instead |
| `src/features/paint/perspective.ts` |  | left out: the CPU scene painter; the Pixi 3D look (`features/look`, ADR 0007) draws instead |
| `src/features/paint/post.ts` | `extensions/world-kit/src/features/sky/glow-effect.ts` and `extensions/world-kit/src/features/sky/shader-parts.ts` | rewritten: only the bloom is here, as `GlowEffect`, a `@pixi/3d` `PostEffect` (GLSL and WGSL) that lifts the neighbours of what is bright by whole DUEL steps and runs after core's snap; the other passes are the CPU painter's and are left out (core's look draws instead) |
| `src/features/paint/light.ts` |  | left out: the CPU scene painter; the Pixi 3D look (`features/look`, ADR 0007) draws instead |
| `src/features/paint/colour.ts` | `extensions/world-kit/src/features/textures/colour.ts` | rewritten: OKLab, the DUEL index and the hash the photo pipeline uses are the kit's `textures/colour.ts`; the rest is the CPU scene painter's and is left out (the Pixi 3D look, ADR 0007, draws instead) |
| `tests/features/paint/colour.test.ts` |  | left out: the CPU scene painter; the Pixi 3D look (`features/look`, ADR 0007) draws instead |
| `tests/features/paint/light-pass.test.ts` |  | left out: the CPU scene painter; the Pixi 3D look (`features/look`, ADR 0007) draws instead |
| `tests/features/paint/place.test.ts` |  | left out: the CPU scene painter; the Pixi 3D look (`features/look`, ADR 0007) draws instead |
| `tests/features/paint/post.test.ts` |  | left out: the CPU scene painter; the Pixi 3D look (`features/look`, ADR 0007) draws instead |
| `tests/features/paint/to-cell.test.ts` |  | left out: the CPU scene painter; the Pixi 3D look (`features/look`, ADR 0007) draws instead |
| `tests/features/paint/kit.test.ts` |  | left out: the CPU scene painter; the Pixi 3D look (`features/look`, ADR 0007) draws instead |
| `tests/features/stage/figure-light.test.ts` |  | left out: the CPU scene painter; the Pixi 3D look (`features/look`, ADR 0007) draws instead |
| `src/features/paint/rain.ts` | `extensions/world-kit/src/features/sky/rain-effect.ts` and `extensions/world-kit/src/features/sky/sky-passes.ts` | rewritten: three depth-tested layers of streaks as a `PostEffect` on the frame clock, added with `addLookPass` (`addSkyPasses`) |
| `src/features/paint/look.ts` | `packages/3d/src/features/look/look.ts` | rewritten: the look's switches and numbers as a Zod-checked `Look` the Pixi 3D passes read, not the CPU painter's profile |
| `src/features/paint/library/look.json` | `packages/3d/src/features/look/library/look.json` | rewritten: the pixel size, light steps, outline, dither and grade; the lamp kit and haze stay with the world kit |
| `tests/features/paint/look.test.ts` | `packages/3d/tests/unit/look/look.test.ts` | rewritten: the look's parse and defaults, `targetSize`, `rampLit`, `spriteLight` and `addLookPass` |
| `src/features/stage/sprite-light.ts` | `packages/3d/src/features/look/sprite-light.ts` | rewritten: `spriteLight(input, time)` returns the flat chest light, the form and the rim as pure functions; the view's per-frame tint is not wired yet |
| `tests/features/stage/sprite-light.test.ts` | `packages/3d/tests/unit/look/look.test.ts` | rewritten: `spriteLight` is tested with the look |
| `src/features/view/fp.ts` |  | left out: the diorama, first-person and top-down views belong in the editor, not in core (the Owner, 2026-11-07) |
| `src/features/view/render.ts` |  | left out: the diorama, first-person and top-down views belong in the editor, not in core (the Owner, 2026-11-07) |
| `src/features/view/shots.ts` |  | left out: the diorama, first-person and top-down views belong in the editor, not in core (the Owner, 2026-11-07) |
| `src/features/view/view-frame.ts` | `extensions/world-kit/src/features/reads/reads-against.ts` | rewritten: `readsAgainst(figure, room, camera)` and its thresholds (`MIN_READ` 1.1, `HOT` 1.1) are the source's; a room's `reads` may waive a figure by name; the diorama frame itself belongs to the editor |
| `src/features/view/readability.ts` | `extensions/world-kit/src/features/reads/figure-reads.ts` | rewritten: `figureReads(frame)` takes a drawn frame as plain pixels (no canvas); the measure is the source's |
| `tests/features/view/readability.test.ts` | `extensions/world-kit/tests/unit/reads/reads.test.ts` | rewritten: the measure on the same kind of frames |
| `tests/features/view/room.test.ts` |  | left out: the diorama, first-person and top-down views belong in the editor, not in core (the Owner, 2026-11-07) |
| `tests/features/view/scene.test.ts` |  | left out: the diorama, first-person and top-down views belong in the editor, not in core (the Owner, 2026-11-07) |
| `tests/features/view/shots.test.ts` |  | left out: the diorama, first-person and top-down views belong in the editor, not in core (the Owner, 2026-11-07) |
| `tests/base/readability.test.ts` |  | left out: the diorama, first-person and top-down views belong in the editor, not in core (the Owner, 2026-11-07) |
| `src/features/world/dress.ts` |  | left out: goes to `@automata/world-kit` (scope trim section 2); core draws what a game authored |
| `src/features/world/decals.ts` |  | left out: goes to `@automata/world-kit` (scope trim section 2); core draws what a game authored |
| `src/features/world/lettering.ts` |  | left out: goes to `@automata/world-kit` (scope trim section 2); core draws what a game authored |
| `src/features/world/generate.ts` |  | left out: goes to `@automata/world-kit` (scope trim section 2); core draws what a game authored |
| `src/features/world/library/glyphs.json` |  | left out: goes to `@automata/world-kit` (scope trim section 2); core draws what a game authored |
| `src/features/world/library/kits.json` |  | left out: goes to `@automata/world-kit` (scope trim section 2); core draws what a game authored |
| `src/features/world/library/maps.json` |  | left out: goes to `@automata/world-kit` (scope trim section 2); core draws what a game authored |
| `tests/features/world/dress.test.ts` |  | left out: goes to `@automata/world-kit` (scope trim section 2); core draws what a game authored |
| `tests/features/world/signage.test.ts` |  | left out: goes to `@automata/world-kit` (scope trim section 2); core draws what a game authored |
| `tests/base/checked-maps.test.ts` |  | left out: goes to `@automata/world-kit` (scope trim section 2); core draws what a game authored |
| `tests/scripts/bad-values.test.ts` | | left out: tests of the builder's command line, which core does not ship |
| `tests/scripts/check.test.ts` | | left out: tests of the builder's command line, which core does not ship |
| `src/lib/search.ts` | | left out: the search the builder's tuning commands share; the tuning tools are not in core |
| `tests/lib/search.test.ts` | | left out: the search the builder's tuning commands share; the tuning tools are not in core |
| `tests/features/world/subdivide.test.ts` | `packages/3d/tests/unit/world/subdivide.test.ts` | ported: the cases on `subdivide` |
| `tests/features/world/surface.test.ts` | `packages/3d/tests/unit/world/surface.test.ts` | ported: the cases on the surface types and `tileName` |
| `tests/features/world/build.test.ts` | `packages/3d/tests/unit/world/build.test.ts` | rewritten: the cases run `buildWorld` over `/2` levels and check the `LevelProblem`s it reports |
| `src/features/world/build.ts` | `packages/3d/src/features/world/build.ts` | rewritten: see the row for `src/features/world/map.ts` (`mapPieces`) |
| `src/features/paint/occlusion.ts` | `packages/3d/src/shared/render/light/occlusion.ts` | rewritten: what blocks a lamp and the contact darkening, over a `SceneLighting`'s boxes and planes |
| `src/features/paint/sky.ts` | `extensions/world-kit/src/features/sky/stars-effect.ts` | rewritten: the stars only, as a `PostEffect` that draws where the depth buffer is empty sky and holds its place when the camera is aimed; core keeps the sky and horizon colours of a time of day |
| `src/features/paint/vertex-light.ts` | `packages/3d/src/shared/render/light/vertex-light.ts` | rewritten: direct light from a lamp at a point, over one `SceneLighting`; the stepped light is the look's |
| `src/features/stage/actor.ts` |  | left out: a scripted actor in a scene is the cutscenes extension's; a figure in a level is a game's entity drawn by the figure view |
| `src/features/stage/camera.ts` | `packages/3d/src/features/camera/angled-camera.ts` | rewritten: the camera is the angled 24 mm camera (`camera/`) a game drives; the source's shot cameras are the cutscenes extension's |
| `src/features/stage/cast.ts` |  | left out: casting figures into a scene; the base scenes name the base pair (`BASE_SCENES`) and a game places its own figures |
| `src/features/stage/runtime.ts` |  | left out: the stage's runtime state and timeline player; core keeps the pieces' state (`piece-states.ts`) and the one clip player |
| `src/features/world/library/props.json` |  | left out: the prop library goes to `@automata/world-kit` (scope trim section 2); core keeps the five base props' generators |
| `src/features/world/library/swatches.json` | `packages/3d/src/features/world/base/base-library.ts` | rewritten: only the swatches the base scenes name, as flat DUEL steps; the library goes to `@automata/world-kit` |
| `src/index.ts` |  | left out: the builder's public surface; AF's is `packages/3d/src/entries/` |
| `src/lib/colour.ts` | `packages/3d/src/shared/math/colour.ts` | ported: see the figure source's row |
| `src/lib/figure.ts` |  | left out: the door to the figure builder, which is AF's own `features/figures` now |
| `src/lib/rng.ts` | `packages/sim/src/shared/rng/rng.ts` | rewritten: the seeded generator is the sim's `createRng`, used by the world builder (`world/build.ts`) |
| `tests/base/base.test.ts` | `packages/3d/tests/unit/base/base-scenes.test.ts` | rewritten: the base scenes' cases, over the levels and the library |
| `tests/features/paint/occlusion.test.ts` | `packages/3d/tests/unit/shared/render/light/occlusion.test.ts` | rewritten: the cases over a `SceneLighting` |
| `tests/features/paint/sky.test.ts` | `extensions/world-kit/tests/browser/sky/passes.test.ts` | rewritten: in Chromium, the stars, the rain and the glow draw on the DUEL palette after core's snap |
| `tests/features/paint/vertex-light.test.ts` | `packages/3d/tests/unit/shared/render/light/vertex-bake.test.ts` | rewritten: the light at a vertex, over a `SceneLighting` |
| `tests/features/stage/actors.test.ts` |  | left out: scripted actors are the cutscenes extension's |
| `tests/features/stage/camera.test.ts` | `packages/3d/tests/unit/camera/angled-camera.test.ts` | rewritten: the camera's cases are the angled camera's |
| `tests/features/stage/state.test.ts` | `packages/3d/tests/unit/shared/level/piece-states.test.ts` | rewritten: the pieces' state (doors, lamps, props); the rest of the state script is the cutscenes extension's |
| `tests/features/world/base-library.test.ts` | `packages/3d/tests/unit/base/base-scenes.test.ts` | rewritten: the library names only DUEL swatches and generators core has |
| `tests/features/world/map.test.ts` | `packages/3d/tests/unit/world/build.test.ts` | rewritten: the map's pieces are built and checked by `buildWorld` |
| `tests/features/world/small-props.test.ts` | `packages/3d/tests/unit/world/props.test.ts` | rewritten: the props' cases over `buildWorld` and the registry |
| `tests/features/world/surface-library.test.ts` |  | left out: the surface library goes to `@automata/world-kit` |
| `tests/features/world/surface-structure.test.ts` |  | left out: the texture structure checks go with the photo library to `@automata/world-kit` |

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

## Extensions: moved from `mcthaydt/automata-plus` (2026-11-07)

Every extension below was ported into this repository from `mcthaydt/automata-plus` at `1766c622` (2026-11-01), with
that repository's history (a subtree import), and then laid out and checked by this repository's rules. Where Plus
recorded an earlier source, the row says so; the adventure source's rows above describe how most of them were made.

| Package | Folder | Ported from | Earlier source |
| --- | --- | --- | --- |
| `@automata/physics` | `extensions/physics` | `packages/physics` | `mcthaydt/automata-framework` `packages/physics` at `6aee63be` (2026-10-30), byte-identical at `b7ef19d9`; the 2D and 3D golden hashes are unchanged from there |
| `@automata/feel` | `extensions/feel` | `packages/feel` | The adventure source's frame model and coverage (M6 rows above) |
| `@automata/audio-synth` | `extensions/audio-synth` | `packages/audio-synth` | The adventure source (M6.10a, M6.10b rows) |
| `@automata/debug` | `extensions/debug` | `packages/debug` | The adventure source (M6.2 row) |
| `@automata/puzzle` | `extensions/puzzle` | `packages/puzzle` | The adventure source (M6.6b row) |
| `@automata/net` | `extensions/net` | `packages/net` | The arcade source (rows below) |
| `@automata/net-ui` | `extensions/net-ui` | `packages/net-ui` | The arcade source |
| `@automata/net-server` | `extensions/net-server` | `packages/server` | The arcade source |
| `@automata/ui-screens` | `extensions/ui-screens` | `kits/ui-screens` | Written in Plus (PRODUCT.6) |
| `@automata/sectors` | `extensions/sectors` | `packages/sectors` | The adventure source (M6 rows above) |
| `@automata/nav` | `extensions/nav` | `packages/nav` | The adventure source (M6.5 row) |
| `@automata/systems` | `extensions/systems` | `packages/systems` | The adventure source (M6.7a, M6.7b rows) |
| `@automata/narrative` | `extensions/narrative` | `packages/narrative` | The adventure source (M6.8a, M6.8b rows) |
| `@automata/cutscenes` | `extensions/cutscenes` | `packages/cutscenes` | The adventure source (M6.9a row) |
| `@automata/pipelines` | `extensions/pipelines` | `tooling/pipelines` | The adventure source (M6.6b to M6.10b rows); the blockout stage is not ported |
| `@automata/dev-tools` | `tooling/dev-tools` | `packages/dev-tools` | `FloorFifty`'s `tools/promote-evidence` and `tools/worktree-gc` |

Not ported: `starters/party-racer` (the Owner cut it), Plus's own `tooling/{core,boundary,ci}`, its docs, workflows and
the committed `.vitest` screenshots. The converted fixtures keep the headers their converter scripts wrote; the scripts
themselves are not ported, and the fixtures stay as they are.

## Third-party assets copied into this repository

| Asset | Source | Licence |
| --- | --- | --- |
| `packages/editor/src/shared/kit/icons/paths.ts`: 49 icon drawings (the editor's tools, history, layers, zoom and brush size, document actions, the level picker's chevron, Fit, the inspector, the list, and the suite's Home, Tuner, level editors and Review; the 3D level editor's Corner, Doorway, Door, Window, Thing, Furniture and Lamp; the editors v2 sidebar's Levels, Person, Zap, Volume, Message, Clapper and Workflow, and Maximize and Upload) | [Lucide](https://lucide.dev), npm `lucide-static` 0.460.0, `icons/*.svg`, copied as the markup inside each svg on 2026-11-06 | ISC (Lucide Contributors; the portions from Feather are MIT, Cole Bemis). The licence asks that its copyright and permission notice appear in copies; the header of `paths.ts` carries the notice |
| `packages/content/src/shared/palette/duel.ts` and `docs/art/palettes/duel.{txt,md}`: the DUEL palette, 32 ramps of 8 (replaces Endesga 64, removed 2026-11, 3D slice task 5.1) | The 3D builders' copy of the DUEL look-up table (`mcthaydt/FigureBuilder` `src/features/paint/duel-ramps.ts` at `025ffb4`, generated from the table) | Author and licence not recorded yet: a placeholder until the Owner supplies them |

## Original assets made in this repository

| Asset | Made by | Source |
| --- | --- | --- |
| `games/base-3d/public/sounds/{ember,goal,roll,fall}.wav` | `games/base-3d/scripts/make-sounds.ts` (sine sweeps, a seeded noise swoosh) | None: original, synthesized from code on 2026-10-31 under the repository's licence; `src/sounds.test.ts` checks the committed files are exactly what the script writes |
