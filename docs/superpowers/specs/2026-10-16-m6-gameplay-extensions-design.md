# M6: Gameplay extensions (milestone spec)

- **Status:** Owner-approved 2026-10-16, every open decision on its recommended default. Task **M6.0** in [02 Master delivery plan](../../02-master-delivery-plan.md). Nothing here is implemented before that review (01 Decomposition §5, [04 How we build](../../04-how-we-build.md)). Review freezes the contracts in §4; after that they change only additively or through a written change request. Open decisions M6-D1 to M6-D14 (§15) run on their recommended defaults until the Owner changes them.
  > **Amendment, 2026-10-30 (the Owner, in the session's chat):** `games/base-3d` is free and uses core only, like Emberwick: its rooms, keys, feel and cutscenes are game code, and every M6 extension is built in Plus (automata-plus), with `games/base-adventure` as the Plus fixture. M6.3 does not edit the adventure source (the work is AF-side only): the extraction records the adventure source's commit (in `docs/provenance/sources.md`) and removes each leak during the rewrite in Plus. The rest of the 3D revision is 02 row M6.0a.
  > **Amendment M6.0a, 2026-10-31 (the 3D revision and a re-read at the recorded extraction commit; specs auto-accepted, Owner 2026-10-30):**
  > - **Standalone (STANDALONE.0, AGENTS.md "Core and extensions").** This spec names no source project. It says *the adventure source* (the 3D adventure game every `sectors` to `cutscenes` row comes from) and *the arcade source* (the 2D game `feel`'s juice comes from). Their repositories and commits are recorded only in [`docs/provenance/sources.md`](../../provenance/sources.md), which is not shipped.
  > - **Plus is free** ([APP spec](./2026-10-30-paid-editor-apps-design.md) §3): every M6 package stays in `mcthaydt/automata-plus` (M6-D1, APP-D2, APP-D9) and publishes on core's line once the licence switch has the Owner's word on the text (APP-D1, row PLUS.FREE).
  > - **The 3D revision.** `games/base-adventure` grows from `games/base-3d` (M3.7, free and core only, decision 7), not `games/base-25d`. `sectors` renders on the full `render-pixi3d`, with camera views (a scene's `camera-view` content, by view id) and each wall's `occlude` (`cut`, `fade`, `never`) feeding M3's occluder rule. `cutscenes` uses free-shot cameras (any lens and tilt, unlike a play view) and acts its actors with `@mcthaydt/automata-figures` clips (§4.3, §4.8).
  > - **One owner for the sector format** (M6-D15): core's `@mcthaydt/automata-editor-3d` `format/` (`sector.schema.ts`, `af-sector/1`, already ported by ED3D.1 and ED3D.1c). `sectors` imports it through that package's public entry and owns resolution, the sim side and rendering.
  > - **AF-side leak fixes (decision 8).** M6.3 does not edit the source. It re-reads it at the recorded commit, and each leak (§2.3, re-checked there) is removed in the Plus rewrite (M6-D2).
  > - **Scope call on the modules the adventure source added since the first read** (storylets, conversations, delivery, portraits, music): §4.13, M6-D16.
  > - **Targets are peers** ([ADR 0006](../../adr/0006-distribution-targets.md)). Read §9's fake host and §11 through it: E2E runs under AF's own fake host, and §11 is the Ruken target's facts, applied only when a game builds for `ruken`.
  > - §12 and §13 now name only the acceptance cases §13 defines (X-a and X-b).
- **Owner direction:** 2026-10-11, AF is built from proven code in the arcade source and the adventure source, with everything a game does not need as an opt-in extension (master spec §1, §4). 2026-10-16 ([PRODUCT spec](./2026-10-16-product-core-and-plus-design.md) PD-1, PD-3, PD-5): every extension is Automata Plus; `feel` is on the arcade-source path and comes early; `telemetry-extra` and a tutorial system are cut.
- **Depends on:** M2 (merged) for `feel` and `debug`. M3 for every extension that draws in 3D or reuses M3's `pipelines` (`sectors`, the environment pipeline, `cutscenes`). PRODUCT.5 (the `mcthaydt/automata-plus` workspace) before any M6 package task, because every M6 package is Plus (M6-D1).

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| AF `main` | `a125344` | What exists (§2). Every "exists" cell was checked against `packages/*/src` at this commit. |
| The adventure source (`docs/provenance/sources.md`) | first read 2026-10-16; re-read at the recorded extraction commit 2026-10-31 (M6.0a) | Every `sectors`, `nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `feel`, `audio-synth`, `debug` and environment-pipeline row. Paths, line counts and test counts below are from the first read unless marked; each task's plan re-reads its files at the recorded commit (§14). The leaks (§2.3), the route tests (P-b) and the new modules (§4.13) were re-checked at the recorded commit. |
| The arcade source (`docs/provenance/sources.md`) | read 2026-10-16 | `feel`'s arcade-source rows: `apps/client/src/systems/gameplay/juice/*` (18 files), `systems/haptics.ts`, `content/juice.toml`, their tests |
| Ruken, vendored | RukenApp `b30d31b` ([`vendor/ruken/`](../../../vendor/ruken/README.md)) | `@ruken/sdk` `CAPABILITIES` (no haptics capability), the fake host |
| [M3 spec](./2026-10-18-m3-3d-characters-design.md) (revised; supersedes the 2.5D [first M3 spec](./2026-10-16-m3-25d-pipelines-design.md) for M6) | revised 2026-10-23 | `render-pixi3d` (camera views, `CameraRig`, occluders, baked lighting), `@mcthaydt/automata-figures` clips, the `pipelines` platform (`definePipeline`, gates, budgets, guard), `games/base-3d` (M3.7) |
| [M4 spec](./2026-10-16-m4-input-display-design.md) (draft, branch `claude/clever-pasteur-ujmu6e-m4spec`) | pending review | `camera2d.shake(trauma)` (M4 §4.10), the core Settings screen and `settings.sections` (M4 §4.8), "haptics and rumble are `feel`'s" (M4 §1), the Plus `dev-tools` extension (M4.11) |
| [M5 spec](./2026-10-16-m5-saves-audio-design.md) (draft, branch `claude/clever-pasteur-ujmu6e-m5spec`) | pending review | `Save` and `SaveDef` migrations, per-device settings fields (M5-D4), core audio buses, "`audio-synth`: M6" (M5 §1) |
| [EX spec](./2026-10-16-examples-one-file-design.md) | approved 2026-10-16 | One-file examples; games under `games/` (EX-D1); Plus examples in `automata-plus` |

**Not verified here:** whether `navigator.vibrate` and `Gamepad.vibrationActuator` work inside Ruken's game frame on its desktop, iOS and Android shells (R-11; no RukenApp checkout or device); real phones and pads; the GPU runner. Test counts quoted from both games are top-level `it(`/`test(` calls (appendix A), not run here. The four generated route files hold **16** tests (bay 8, clinic 5, clinic-dawn 2, prologue 1), at the first read and again at the recorded commit; no earlier AF document gives a number.

## 1. Goal and boundaries

**Goal.** A game can feel good and tell a story without writing its own machinery. A hit shakes the camera, holds a pose, flashes, pops a word and buzzes the pad, all from data and all switchable by the player. An adventure game describes its rooms as sector maps, its paths as a nav graph, its locks and keys as a puzzle, its people as state machines, its talk as dialogue graphs and its set pieces as cutscene scripts, all as content, and gets a solver, softlock search, generated route tests, bot playtests and lints for free. A developer opens a debug overlay in dev builds and never ships it.

**Plus (free since the APP spec; PD-1 placed every extension in Plus), in `mcthaydt/automata-plus` (M6-D1).** Two groups, in the order PD-3 sets:

1. **On the arcade-source path (early, needs only M2):** `feel` (juice and haptics as data) and `debug` (the overlay that renders the `debug.panels` slot, dev builds only).
2. **On the adventure-source path (after M3):** `sectors` (and the environment pipeline on it), `nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `audio-synth`, and the fixture game `games/base-adventure`.

**Core (free):** no change is planned. Each extension is one `defineExtension` (existing) and uses existing seams: sim plugins, content schemas, Effect layers, the presentation bus's `sim.events`, the `debug.panels`, `settings.sections` and `hud.overlay` slots. A missing seam becomes a change request to the owning lane, never a copy.

**Exclusions:**
- `telemetry-extra` is cut (PD-5). The Ruken `telemetry` capability and `track()` stay in core.
- A tutorial system is cut (PD-5); the adventure source's `onboarding.ts` (a 12-line `localStorage` "first night done" flag) becomes a field in the game's own save, not an extension (M6-D9).
- The arcade source's race-specific juice (`juice-director`, `wrap-streak`, `fall-trail`, `bark`, `cpu-barks`, `wall-juice`'s rules, `motion-watch`'s bounce detector) stays in the game; `feel` takes the generic parts (§4.1).
- Brush-based 3D environments stay in M9. `sectors` renders on M3's full 3D `render-pixi3d` (camera views, occluders, baked lighting).
- The adventure source's other pipelines (reference, vision, style, UI, FMV, sound, art round-trip, act) stay in the game (M3-D10 holds). M6 moves only blockout (the environment pipeline) and the `puzzle`, `systems`, `narrative` and `feel` pipeline commands that check content.
- Particles as a package are cut (PD-5); `feel` keeps one burst helper on Pixi's `ParticleContainer`.

**Prerequisites:** M6.1 (`feel`) needs PRODUCT.5; its camera channel uses M4.8's `camera2d` when it lands. M6.2 (`debug`) needs PRODUCT.5. M6.3 (leak fixes) is AF-side and needs only this spec (decision 8). M6.4 onward need M6.3, M3.4 and PRODUCT.5; M6.11 needs M3.8.

## 2. What already exists (verified at `a125344`, not rebuilt)

### 2.1 On `main`

| Capability | Where | M6 does |
|---|---|---|
| `defineExtension({ name, requires, sim, content, layers, ui.slots, manifest })` | `packages/runtime/src/extension/define-extension.ts` | Each M6 extension is one `defineExtension`; `requires` orders them (`puzzle` requires `nav`, and so on) |
| UI slots `title.actions`, `pause.actions`, `settings.sections`, `hud.overlay`, `debug.panels` (closed list; "the debug overlay in M6") | `packages/ui/src/slots/ui-slot.ts` | `debug` renders `debug.panels`; `feel` fills `settings.sections`; `narrative` fills `hud.overlay` |
| `definePlugin`, `defineComponent`, `defineCommand`, `defineEvent`, `defineResource`, `defineSystem`; phases `input` … `cleanup` | `packages/sim/src/define/definitions.ts` | Every sim part is a plugin on these |
| Deterministic math: `sin`, `cos`, `tan`, `atan`, `atan2`, `exp`, `log`, `pow`, `hypot` | `packages/sim/src/math/dmath.ts` | Replaces the adventure source's `Math.hypot`, `Math.atan2`, `Math.sin`, `Math.cos` in sim code (§4.9). There is no `acos`; only build-time lint code uses it (`cutscene-lint.ts`) |
| `createRng`, `deriveSeed`, `sortedKeys`, `sortedEntries` | `packages/sim/src/{rng,util}` | Replace the adventure source's `rng.ts` and its `Object.keys`/`Object.entries` loops in sim code |
| `check-boundaries` with a list of source roots and `--allow-import` | `tooling/check-boundaries`, root `package.json` `boundaries` | Every M6 package with a sim plugin adds its `src/sim` (master spec §5) |
| `PresentationBus` with `sim.events`, `screen.entered`, `time.changed` | `packages/runtime/src/presentation/presentation-bus.manager.ts` | `feel`, `audio-synth` and `debug` subscribe; none of them writes the sim |
| `Settings` service and `settingsStore(def)` with migrations | `packages/runtime/src/settings/` | `feel`'s settings (§4.1) |
| Reduced motion | `packages/ui/src/browser/reduced-motion.ts` | `feel` reads it; it never keeps its own copy |
| Content hot reload in dev (`examples/content/hot-reload`) | `packages/content/src/vite/` | Replaces the arcade source's `?dev=juice` polling (`live-tuning.ts`) |
| `Transform3D`, `RigidBody3D`, `Collider3D`, Rapier 3D | `packages/physics/src/physics-3d*.ts` | `sectors` builds wall colliders when the game uses `physics` (optional, §4.3); `physics` moves to Plus in PRODUCT.5 |

### 2.2 Pending elsewhere (consumed, not redefined)

- **M3** ([3D characters spec](./2026-10-18-m3-3d-characters-design.md), revised): `render-pixi3d` camera views (`camera-view` content by view id) and `CameraRig` (M3 §4.1, §4.2), occluders with `occlude` (`cut`, `fade`, `never`), baked lighting (M3 §4.4: "sector-derived occlusion arrives with `sectors` in M6"), `@mcthaydt/automata-figures` clips, `post-retro`, the `pipelines` platform (M3 §4.8), and `games/base-3d` (M3.7: free, core only, decision 7).
- **ED3D** (merged): `@mcthaydt/automata-editor-3d`'s sector format (`format/sector.schema.ts`, `af-sector/1`) and float geometry (`geometry/sectors.ts`, `geometry/nav.ts`), ported from the adventure source by ED3D.1 and ED3D.1c. The format is the one sector format (M6-D15); the editor's geometry is floats, so the sim side (dmath) is `sectors`'.
- **M4** (draft): `camera2d.shake(trauma)` with reduced motion (M4 §4.10); the core Settings screen and its `settings.sections` slot (M4 §4.8); the `Input` service and device prompts (M4 §4.2, §4.6); `dev-tools` (M4.11), which is about evidence and worktrees, not the in-game overlay.
- **M5** (draft): `Save` with versioned `SaveDef` and migrations; per-device settings fields (M5-D4); core audio buses (`music`, `sfx`, `voice`, `ui`).
- **PRODUCT.5**: the `automata-plus` workspace, its private registry and release list.

**Not in AF anywhere:** juice, haptics, a debug overlay, sector maps, navigation, puzzles, NPC state machines, dialogue, cutscenes, procedural audio, a blockout pipeline.

### 2.3 The adventure source's leaks (all still present at the recorded commit, re-checked 2026-10-31)

An engine file that imports a scene, or a contract that carries one game's fields, cannot be extracted as is. The source is not edited (decision 8): M6.3 records the commit, and each leak is removed AF-side, in the Plus rewrite of the module that has it (M6-D2). The source's own tests at that commit are the behavior specs (§4.9).

| File | Leak |
|---|---|
| `game/sectors.ts` lines 1, 5 | Imports and re-exports `scenes/clinic/map` (`CLINIC_MAP`, `SECTOR_DEFS`, `MASS_DEFS`) |
| `game/level.ts` lines 1, 35 | Imports `scenes/clinic/level`; holds the level as module-level `let` bindings (`NODES`, `EDGES`, `PATROL`, …) swapped by `useLevel` |
| `game/nav.ts` | Imports `level` and `sectors` (so the clinic) |
| `game/agents.ts`, `probes.ts`, `pursuit.ts`, `systems.ts`, `bots.ts` | Import `level` and (most) `sectors` |
| `game/cutscenes.ts` lines 1, 134 | Imports `scenes/clinic/cutscenes` |
| `game/cutscene-lint.ts` lines 14–22 | Imports `../audio` and `../narrative/lint` |
| `game/simulation.ts` line 17 | Imports `narrative/dialogue` (line 15 at the first read) |
| `game/contracts/rules.ts` lines 18–35 | `BaseWorld` carries `basinFull`, `fuel`, `light`, `torchTime` (one game's torch and basin); it also imports `../level` |
| `game/contracts/narrative.ts` | Imports `../cutscenes` (so the clinic's cutscenes) |
| `narrative/dialogue.ts` line 27 | `STANCE` comes from the game's `CANON` (`narrative/canon.ts`, the game's canon text) |
| `feel/runtime.ts` line 18 | A `localStorage` key named after the game; `GameEvents` from `game/types`; `FRAME` locked to 640×480 |
| `feel/board.ts`, `audio/board.ts`, `main.ts` lines 273–295 | `?debug` read straight from `location.search` in every build; `window.game` driver |

`game/rules.ts` and `game/world.ts` are now two-line re-exports of the contracts. No `game/` file calls `Math.random` (`rng.ts` says so).

## 3. Ownership

| Contract | Owner (lane, package) | Consumers |
|---|---|---|
| `FeelDef` content, `Feel` service, haptics port | feel lane, `automata-plus/packages/feel` | games; `debug` (its board) |
| Debug overlay, `DebugPanel` registration, the dev-build strip check | feel lane, `automata-plus/packages/debug` | every extension with a panel |
| The sector format (`af-sector/1`: sectors, walls, trims, masses, `occlude`) | editor-3d lane, core `@mcthaydt/automata-editor-3d` `format/` (M6-D15) | `sectors`, the 3D level editor, the environment pipeline |
| `SectorMap` content (the format compiled as game content), resolved sectors, sim geometry, colliders, occlusion, cutaway | gameplay lane, `automata-plus/packages/sectors` | `nav`, `systems` (line of sight), `cutscenes`, `render-pixi3d` lighting, the environment pipeline |
| `NavGraph` content, `route`, `clear` | gameplay lane, `automata-plus/packages/nav` | `systems`, `puzzle` (route tests), `cutscenes` |
| `PuzzleDef` content, interpreter plugin, solver, route-test generator | gameplay lane, `automata-plus/packages/puzzle` | `narrative` (conditions), `systems` (claims), games |
| `SystemsDef` content, agents and rules plugin, probes, bots, scenarios | gameplay lane, `automata-plus/packages/systems` | games |
| `DialogueGraph`, `LineRecord`, canon and beats content, dialogue plugin, lints | gameplay lane, `automata-plus/packages/narrative` | `puzzle` (`dialogue` effect), `cutscenes` (captions) |
| `CutsceneScript` content, playback plugin and view, builder, lint | gameplay lane, `automata-plus/packages/cutscenes` | `puzzle` and `systems` (`cutscene` effects) |
| `CueDef` content, synth voices, event-to-cue map, offline render | feel lane, `automata-plus/packages/audio-synth` | games; `feel` (its audio channel) |
| Environment (blockout) pipeline | pipelines lane, `automata-plus/tooling/pipelines` | games using `sectors` |
| `games/base-adventure` | integration lane | the M6 exit |

**Shared vocabulary, one owner each.** the adventure source's contracts share a few small types (`Value`, `Cond`, `Point`, `ItemId`, `HotspotId`, `NoiseKind`). In AF:
- `Value` and `Cond` (facts and conditions) belong to `puzzle`; `narrative` and `systems` import them, never copy them.
- `Point` is `{ x: number; z: number }` on the floor plan in metres, owned by the sector format (`@mcthaydt/automata-editor-3d`'s `format/sector.schema.ts`) and re-exported by `sectors` and `nav`.
- `NoiseKind` and noises belong to `systems`; `puzzle`'s `noise` effect emits `systems`' event when `systems` is present and is a content error otherwise.
- Item and hotspot ids are strings declared in the game's content; each package validates references at content compile time, not at run time.

## 4. Contracts

### 4.1 `feel` (`automata-plus/packages/feel`, M6.1)

```toml
# content/feel.toml (schema `feel`, compiled and hashed like all content)
[limits]                  # hard caps, after any per-entry value
shake_px = 3
hit_stop_ms = 120
flash_frames = 3
flash_alpha = 0.85

[[entry]]
on = "slam"               # a sim event id, or a pattern such as "door.*"
camera = [{ shake = 0.6 }]                     # trauma 0..1 → camera2d.shake, or the 3D offset
pose = [{ hit_stop_ms = 90, target = "subject" }]
visual = [{ flash = "white", frames = 2 }, { squash = 0.35 }]
word = [{ key = "feel.word.slam", at = "subject" }]  # a locale key; never a literal string
haptic = [{ strong = 0.6, weak = 0.4, ms = 90, phone_ms = 18 }]
audio = [{ cue = "slam" }]                     # an `audio-synth` cue or a core audio sound id
```

```ts
export interface FeelSettings {
  readonly reduceFlashing: boolean   // drops flash and flicker
  readonly haptics: boolean          // the player's rumble switch
  readonly intensity: 0 | 0.5 | 1    // scales camera and pose effects
}
export interface FeelFrame {          // plain data, one per drawn frame
  readonly offset: readonly [number, number]   // whole pixels (2D) or screen pixels (3D)
  readonly frozen: readonly EntityRef[]        // hit-stop: these views hold their pose
  readonly flash: { readonly colour: string; readonly alpha: number } | null
  readonly tint: { readonly colour: string; readonly alpha: number } | null
  readonly squash: ReadonlyMap<EntityRef, readonly [number, number]> // scale x, y on 1/32 steps
  readonly words: readonly WordPop[]
}
export interface Feel {
  frame(drawnTick: number, alpha: number, frameSeconds: number): FeelFrame
  readonly settings: SettingsStore<FeelSettings>
}
export interface HapticsPort {        // a Context tag; the default implementation is standalone
  pulse(effect: { strong: number; weak: number; ms: number; phoneMs?: number }): void
}
export const feelExtension: ExtensionDef<'feel'>
```

- **Presentation only.** `feel` hears `sim.events` from the presentation bus and the interpolated render rows. It never writes the sim, never sends a command and never changes a tick (law 1). Hit-stop freezes *views* (pose, squash, camera follow), never sim positions: The arcade source's rule (`hit-stop.ts`, polish spec D-P5: "its position never does"). The adventure source's `hitStop` flag is read by nothing outside `feel/` at the first read, so nothing there depends on stopping the sim.
- **Events at the drawn tick.** A sim event is answered when the drawn picture reaches its tick, once per event id (the arcade source `room-beats.ts`), so a feel never lands before the picture shows its cause.
- **Deterministic frames.** Noise comes from a hash of integers (the adventure source `feel/runtime.ts` `hash`), and time is the presentation clock (Effect `Clock`, `TestClock` in tests), so a frame is a pure function of the events, the drawn tick and the settings.
- **Camera.** In 2D the camera channel calls M4's `camera2d.shake(trauma)`: one trauma model, owned by M4 (the arcade source `trauma.ts` is its source and is not extracted twice). Until M4.8 lands, `feel` writes the offset to `PixiStage.world`'s position. In 3D it adds the offset after M3's `CameraRig`, in screen pixels.
- **Springs.** `second-order.ts` (105, f/zeta/r dynamics), `squash.ts` (62), `lean.ts` (85) and `hit-stop.ts` (26) come across with their tests. Values are drawn on steps (whole pixels, 1/32 scale), so pixel art stays crisp.
- **Words.** `word-pool.ts` (473) and `word-text.ts` (80) draw pop-up words through a Pixi text pool; the rules for *which* moment says *which* word stay in the game (`word-director.ts`, 402, is the arcade source's). Words are locale keys (PRODUCT.L), never literals.
- **Burst helper.** `dust-pool.ts` (202) becomes `burst(at, preset)` on Pixi's `ParticleContainer` (PD-5 keeps only this).
- **Haptics.** The default `HapticsPort` is the arcade source's `haptics.ts` (128): the first pad with a `vibrationActuator` gets `dual-rumble`; otherwise a touch screen with `navigator.vibrate` gets `phone_ms` (none for an entry without it); otherwise nothing, and nothing fails. Haptics are not motion: reduced motion leaves them alone; the `haptics` setting turns them off. Under Ruken there is no haptics capability (§11): the same port is used, and R-10/R-11 ask Ruken to own it. A rumble is never a required signal.
- **Accessibility.** Reduced motion (core, read live) drops shake, pose holds, squash, words' motion and bursts; words still appear, still. Reduce flashing drops flash and flicker. Both apply on the next frame, without a remount.
- **Settings.** `FeelSettings` is a `settingsStore` declared by the extension and shown through `settings.sections` (a FeelSection with two toggles and an intensity choice). `haptics` and `intensity` are per-device fields under M5-D4; `reduceFlashing` follows the player through host saves. Nothing uses `localStorage` (the source's game-named key goes; M6-D8).
- **Live tuning.** In dev, editing `content/feel.toml` hot-reloads the content (existing). In a running scene the frame reads the content the scene started with, except in dev (the arcade source `live-tuning.ts`' rule, now through content hot reload).
- **Coverage.** `automata pipe feel coverage` (the adventure source `feel/coverage.ts`, 55, and `scripts/pipeline/feel.ts`) lists every sim event id the game declares and whether a feel entry answers it, with a written "none" reason allowed per id (the adventure source `FEEL_NONE`).

| From | Lines | Goes to |
|---|---|---|
| The adventure source `feel/runtime.ts`, `effects.ts` | 189, 183 | Frame model, limits, channel matrix, reduce flags; the game's `FEEL` table becomes its `feel.toml` |
| The adventure source `feel/overlay.ts`, `board.ts` | 51, 67 | The board becomes a `debug` panel (§4.2); the overlay draws flash and tint as one Pixi layer |
| The adventure source `feel/coverage.ts` | 55 | `automata pipe feel coverage` |
| The arcade source `hit-stop`, `second-order`, `squash`, `lean`, `trauma`, `dust-pool`, `word-pool`, `word-text`, `room-beats` | 26, 105, 62, 85, 68, 202, 473, 80, 55 | As above; `trauma` informs `camera2d` (M4), not extracted twice |
| The arcade source `feel-director.ts` | 214 | Its view and hands routing becomes the channel dispatcher; its race moments stay |
| The arcade source `systems/haptics.ts` | 128 | Default `HapticsPort` |
| The arcade source `content/juice.toml` | 116 | The shape of `feel.toml` (`[limits]`, springs, bursts, words); the arcade source's values become a `feel` preset (PRODUCT spec §6 "look and feel packs") |
| The arcade source `juice-director`, `word-director`, `wrap-streak`, `fall-trail`, `bark`, `cpu-barks`, `motion-watch`, `live-tuning` | 529, 402, 94, 151, 65, 59, 82, 50 | Stay in the arcade source (race-specific, or replaced by content hot reload) |

### 4.2 `debug` (`automata-plus/packages/debug`, M6.2)

```ts
export interface DebugPanelDef {
  readonly id: string                     // kebab-case, unique
  readonly title: string                  // a dev-only literal; debug text is not localized
  readonly component: UiComponent         // reads services through Effect context, never props
}
export const debugExtension: ExtensionDef<'debug'>
export function debugPanels(...panels: DebugPanelDef[]): Pick<ExtensionDef, 'ui'> // fills `debug.panels`
```

- **Dev builds only.** The overlay exists only when `import.meta.env.DEV` is true or the game is built with `automata build --debug` (a build-time constant). A release build tree-shakes it: a bundle test fails if the release build contains the overlay's marker string. Under Ruken a release build therefore has no `?debug` at all; the adventure source's habit of reading `?debug` from `location.search` in every build does not come across.
- **Overlay.** Toggled by a dev key (backquote) or a three-finger tap. It renders every component in `resolved.slots('debug.panels')` as tabs inside `geometry.visible`, above the HUD and below dialogs, in a declared scroll region. Opening it pauses nothing; a "pause sim" toggle sends Flow's existing pause.
- **Read-only by default.** Panels read services (sim snapshot rows, presentation bus, feel frame, audio graph). A panel that changes the game (The adventure source's `?debug&carry=` start inventory, `debug-carry.ts` 19 lines) does it only through existing commands or a dev-only boot option, recorded in the replay header, so a debug-started run is never confused with a normal one.
- **Panels shipped with M6:** sim (tick, entity count, last hash, step time), presentation bus (last 50 facts), feel board (fire any entry; the adventure source `feel/board.ts`), audio board (play any cue; `audio/board.ts`), and one per gameplay extension (puzzle facts and inventory, agent modes, dialogue state, nav graph drawn over the view).
- **Test driver.** A dev-only `window.__automataDebug` handle (The adventure source's `window.game`: `click`, `floor`, `state`) for Playwright playthroughs. It is in the same tree-shaken module, so release builds cannot expose it.
- **Not `dev-tools`.** M4.11's `dev-tools` is CLI tooling (evidence promotion, worktree cleanup) and never runs in a game. `debug` is in-game. They share nothing.

### 4.3 `sectors` (`automata-plus/packages/sectors`, M6.4)

```ts
export interface SectorMap {            // content, schema `sector-map`
  readonly sectors: readonly SectorDef[] // the sector format's types (editor-3d `format/sector.schema.ts`), imported, never redefined
  readonly masses?: readonly MassDef[]
}
export interface ResolvedMap {
  readonly sectors: readonly Sector[]   // loops normalised, portals linked, pilasters expanded
  sectorAt(p: Point): Sector | undefined
  floorAt(p: Point): number | undefined
  segmentBlocked(a: Point, b: Point, margin?: number): boolean
}
export function resolveMap(map: SectorMap): ResolvedMap
export const sectorsPlugin: PluginDef     // `sector-map` resource, `in-sector` component, `sector.entered` event
export const sectorsExtension: ExtensionDef<'sectors'>
```

- From the adventure source `game/sector-format.ts` (64, types and constants only), `game/sectors.ts` (180), `rooms.ts` (61), `cutaway.ts` (47); render from `render/sector-mesh.ts` (310) and `dressing.ts` (92). After M6.3 the map is a parameter, never an import.
- **Sim side** (`src/sim`, boundaries-checked): the resolved map as a resource built once per scene from content; `in-sector` membership and `sector.entered`/`zone.crossed` events (The adventure source's `crossed` probe); floor height and the step rule (`STEP` 0.25 m). Geometry uses `dmath.hypot`.
- **Colliders** (optional): when the game also registers `physics`, `sectors` adds one static `Collider3D` per wall run and mass (`thick`, `WALL_THICK`). Without `physics`, `segmentBlocked` is the collision query (the base adventure uses this).
- **Render side** (`src/render`, on `render-pixi3d`): extruded floor, ceiling, walls, trims, windows, doors, masked walls and masses; texel-locked UVs at 32 texels per metre; rule-based dressing; camera cutaways (walls in a `cut` group hide together when they stand between the camera and the followed figure, plus `hideFrom` zones). Sector shade feeds M3's baked lighting, and wall runs feed M3's occluder rule with each wall's `occlude` (`cut`, `fade`, `never`; walls default to `cut`), so the camera view (by view id) cuts and fades sector walls exactly as it does static meshes (M3 §4.4's "sector-derived occlusion").
- **One format.** The map's shape is the sector format's (M6-D15); `sectors` adds no field to it. A field the sim needs and the format lacks is a change request to the editor-3d lane. The editor's float geometry (`geometry/sectors.ts`) stays the editor's; the sim side is rewritten on `dmath` (§4.9), and SC-a compares the two.
- **Packaging.** Because its render side depends on `render-pixi3d`, `sectors` is `private: true` while D-1 stands, like `render-pixi3d` (M6-D3). Its sim side has no `@pixi/3d` dependency, so it can be split out and published if D-1 changes.

### 4.4 `nav` (`automata-plus/packages/nav`, M6.5)

```ts
export interface NavGraph {              // content, schema `nav-graph`
  readonly nodes: Readonly<Record<string, Point>>
  readonly edges: readonly (readonly [string, string, string?])[] // third: a door id that must be open
}
export function route(from: Point, to: Point, graph: NavGraph, blocked: Blocked, margin?: number): readonly Point[]
export function clear(a: Point, b: Point, blocked: Blocked, margin?: number): boolean
export function nearestNode(p: Point, graph: NavGraph, blocked: Blocked, margin?: number): string | undefined
export const navPlugin: PluginDef        // `walk-to` command, `nav-agent` component, `nav.arrived` event
```

- From the adventure source `game/nav.ts` (73). After M6.3 it takes the graph and a `Blocked` query (from `sectors`' `segmentBlocked`, or boxes) as parameters; its module-level `EDGES` and the level import go.
- Click-to-walk: a `walk-to` command carries a target point; the plugin routes once, then steps along the route at the entity's speed each tick. Routes are recomputed on a door's state change only.
- Determinism: node iteration through `sortedKeys`, ties broken by node id, distances through `dmath.hypot`. Same route in four engines (§13 N-a).

### 4.5 `puzzle` (`automata-plus/packages/puzzle`, M6.6)

```ts
export type Value = boolean | number | string
export type Cond = { fact: string; is?: Value; atLeast?: number; atMost?: number } | { has: string } | { not: Cond } | { any: Cond[] }
export interface PuzzleDef { /* the adventure source contracts/puzzle.ts, unchanged in shape: facts, items, entry, actions, systemic, lethal, goal, fallback */ }
export const puzzlePlugin: PluginDef     // `puzzle-state` resource (facts, items, seen); `verb` command; `puzzle.said`, `puzzle.gave`, `puzzle.goal` events
export function createSolver(def: PuzzleDef, model?: PuzzleModel): Solver  // build-time and tests only
```

- **Interpreter** (sim): from `game/puzzle.ts` (134). A `verb` command (`at`, `held`, `pair`, `code`, `point`) finds the first matching action and applies its effects in order. Facts live in the `puzzle-state` resource (a sorted record), not in a game's world fields; a game that kept facts in its own fields maps them through `hooks.facts`, as the adventure source already allows. The `{ call }` escape hatch names a game system registered with `defineSystem`; an unknown name is a content error.
- **Cross-extension effects** are events, not calls: `noise` (needs `systems`), `cutscene` (needs `cutscenes`), `dialogue` (needs `narrative`), `exit` (a scene change through the game's Flow). A puzzle whose content uses an effect whose extension is not registered fails at content compile.
- **Solver and tools** (build time, Node; not in a game bundle): `puzzle-solver.ts` (329): solve, softlock search, key and lock matrix, time budget; `scripts/pipeline/puzzle.ts` and `puzzle-lib.ts` (235 + 462): `validate`, `solve`, `softlocks`, `hints`, `matrix`, `doc`, `routes`, `audit`, run as `automata pipe puzzle <command>` on M3's `pipelines` platform. The pipeline is free: no paid stage, no gate.
- **Route tests.** `automata pipe puzzle routes <scene>` writes `tests/generated/<scene>-routes.test.ts`, one test per solver route, each playing the route in the real AF sim (the game's plugins with `puzzle` and `nav`, NPCs off) and checking the goal. The header records the generator and the source hashes (XXH64), and `check` fails a stale file (The adventure source's freshness rule).

### 4.6 `systems` (`automata-plus/packages/systems`, M6.7)

- From the adventure source `game/systems.ts` (158), `agents.ts` (318), `probes.ts` (186), `pursuit.ts` (161), `bots.ts` (250), `contracts/systems.ts` (109) and the systems pipeline (`scripts/pipeline/systems.ts` 218, `systems-lib.ts` 547).
- **Content:** `SystemsDef` unchanged in shape: rules (`every`, `when` probes, `then` effects), agents (modes, speeds, senses, prioritized transitions, routine), tunables, scenarios and fairness. The WP-19 additions (`crossed`, `sawHide`, `followThrough`, `ambush`) come across.
- **Sim:** one plugin with an `agent` component (mode, target, timers), a `noises` resource with `NOISE_LIFE`, the `rules` system and the `agents` system in the `gameplay` phase. Senses read `sectors` (sight past walls) and `nav` (movement). `BaseWorld`'s torch and basin fields do not exist here: light and warmth are probe inputs the game supplies through a `SystemsEnv` resource (M6.3 removes them from the contract first).
- **Bots, scenarios, fairness** (tests and build time): `createBot(policy)` drives the sim through commands only, with the sim's seeded RNG; `automata pipe systems playtest|fairness|sweep` runs scenarios over N seeds and checks the fairness limits (`cautiousWin`, `firstThreatAfter`, `telegraph`, …). A scenario's `probability` is checked over its declared seeds, never over `Math.random`.

### 4.7 `narrative` (`automata-plus/packages/narrative`, M6.8)

- From the adventure source `narrative/dialogue.ts` (134), `lines.ts` (52), `canon.ts` (99, as a schema only: the canon text is the game's content), `lint.ts` (119), `dialogue-lint.ts` (285), `coverage.ts` (153), `screenplay.ts` (98), `help.ts` (92), `audit.ts` (285), `staging.ts` (98), `contracts/narrative.ts` (133), and the narrative pipeline (`scripts/pipeline/narrative.ts` 364 plus the `narrative-*` helpers).
- **Sim:** a `dialogue-state` resource (`stance` within the canon's bounds, facts) and a `choose` command. Conditions are `puzzle`'s `Cond`. Stance bounds come from the game's canon content, never a constant (M6.3 fixes `STANCE`).
- **Lines:** every line is a `LineRecord` (id, kind, speaker, text key). Text lives in the locale content (PRODUCT.L), so a line is a key in the sim and a string only on screen.
- **UI:** a DialoguePanel in `hud.overlay` (speaker, line, up to four choices as 48 px buttons, focus on the first choice, Back closes only when the graph allows it), and captions for cutscenes.
- **Tools** (build time): lint (line length, speaker, banned words from canon), dialogue lint (reachability, dead ends, every choice's effect in bounds), coverage (every beat, clue and hint reachable), screenplay and help docs, all through `automata pipe narrative <command>`.

### 4.8 `cutscenes` (`automata-plus/packages/cutscenes`, M6.9)

```toml
# content/cutscenes/night-nurse.toml (schema `cutscene`)
id = "night-nurse"
lens = 50
camera = [{ t = 0.0, pos = [1.0, 1.6, 4.0], look = [0.0, 1.2, 0.0], ease = "smooth" }]
actor = [{ who = "nurse", t = 0.0, at = "door.ward", facing = 4 }]
caption = [{ t = 1.2, until = 3.0, line = "clinic.nurse.03" }]
light = [{ t = 2.0, lamp = "ward.ceiling", level = 0.2 }]
```

- From the adventure source `game/cutscenes.ts` (131, `evaluate(script, t)`), `cutscene-builder.ts` (245) and `cutscene-lint.ts` (172), with `scripts/pipeline/cutscene-preview.ts` (146).
- **Scripts are content.** the adventure source's scripts are functions of a context (`CutsceneLibrary = Record<id, (ctx) => script>`). AF's are data whose positions may name anchors (`at = "door.ward"`, `"player"`, `"actor:nurse"`) resolved when the cutscene starts; the builder becomes a build-time helper that writes such files (M6-D6).
- **Time from ticks.** Starting a cutscene is a sim event; a `cutscene-state` resource records the start tick, and gameplay input commands are ignored until it ends or a `cutscene.skip` command arrives. Presentation evaluates the script at `(tick − start) / rate + alpha`, so replays include cutscenes and the sim hash does not depend on frame rate (M6-D7).
- **Render:** drives M3's `CameraRig` with a free-shot camera for the cutscene's duration (any lens, position and tilt; a play view's limits do not apply), actor views acted by `@mcthaydt/automata-figures` clips (an actor row names a clip and its start, sampled at the cutscene's time), and lamps; captions go through `narrative`'s caption component.
- **Lint** (build time): camera inside the map (`sectors`), actors on walkable floor (`nav`), captions' line keys exist, light and sound keys exist, no cut faster than the minimum. `Math.acos` and friends are fine here because lint is Node code, not sim.

### 4.9 Porting rules for every sim plugin (M6-D4)

The adventure source runs on Miniplex with mutable world objects, `mitt` events and `Math` floats. AF's sim is Koota with laws 1–7. So `puzzle`, `systems`, `nav`, `narrative`, `cutscenes` and `sectors`' sim side are **rewrites with behavior specs**, not copies (extraction map §5):
- The source tests come across as behavior specs and are re-pointed at the Koota version. A test that cannot be ported is listed in that task's plan with the reason.
- `Math.hypot`, `atan2`, `sin`, `cos` → `@mcthaydt/automata-sim/math`; `Object.keys/entries` and `for…in` → `sortedKeys`/`sortedEntries`; `rng.ts` → the sim's `createRng`/`deriveSeed`; `mitt` events → `defineEvent`; module-level `let` state → resources.
- Each package's `src/sim` is added to `check-boundaries` in the Plus workspace's CI, and every plugin gets a golden replay in Node, Chromium, WebKit and Firefox.
- Content that was TypeScript objects (`scenes/*/puzzle.ts`, `systems.ts`, `map.ts`, `level.ts`) becomes TOML compiled by `content` with a Zod schema per type, hashed into the snapshot header. Each task includes a one-off converter that turns the adventure source's objects into TOML, recorded with the source commit.

### 4.10 `audio-synth` (`automata-plus/packages/audio-synth`, M6.10)

- From the adventure source `audio/cues.ts` (131), `synth.ts` (58), `events.ts` (165), `mixer.ts` (106), `render.ts` (75), `index.ts` (68), and the make-audio pipeline (`scripts/pipeline/audio.ts`, `audio-lib.ts`). `audio/board.ts` (70) becomes a `debug` panel.
- Cues and beds as content (oscillators, envelopes, noise, filters); a game-event to cue map; ducking and listener panning; it plays through M5's core buses (`sfx`, `music`, `voice`) and its gain, never a second `AudioContext`.
- Offline render (`OfflineAudioContext`) and audio checks (true peak, clicks, loudness) as `automata pipe audio check`.
- Answers `sim.events` at the drawn tick like `feel`; never writes the sim.

### 4.11 Environment pipeline (`automata-plus/tooling/pipelines`, M6.11)

- From the adventure source `scripts/pipeline/blockout.ts` (141), `blockout-lib.ts` (343), `blockout-format.ts` (243), and `tests/blockout.test.ts` (14 tests).
- `automata pipe blockout run <spec>`: stages `validate` (fails closed) → `generate` (the scene's `sector-map` and `nav-graph` content, hash-stamped as generated paths the M3 guard protects) → `shots` (grey clay captures per camera zone through the dev server and the debug driver, for a person to judge). `import` turns an existing scene into a blockout spec once.
- Free: no paid stage, no gate. It runs on M3.8's platform (`definePipeline`, exit codes, `--json`, audit log).

### 4.12 Fixture games and examples (M6.12)

- **One-file examples** (EX spec rules, `Tier: plus`, 100 code lines or fewer each): `feel/feel-hit.ts` (2D, on Emberwick: shake, hit-stop, flash, word, rumble), `feel/feel-settings.ts`, `debug/debug-panel.ts`, `sectors/sectors-room.ts`, `nav/nav-click-to-walk.ts`, `puzzle/puzzle-locked-door.ts`, `systems/systems-patrol.ts`, `narrative/narrative-dialogue.ts`, `cutscenes/cutscenes-intro.ts`, `audio-synth/audio-synth-cues.ts`. Each is the fixture its extension's E2E runs.
- **`games/base-adventure`** (in `automata-plus`, private while `sectors` is): two sector rooms joined by a door, one NPC with a patrol, a three-step locked-door puzzle with one dialogue and one cutscene, feel on every interaction, the debug overlay in dev. It starts from `games/base-3d` (M3.7: free, core only) and is the M6 integration fixture; base-3d stays free and never imports a Plus package.

### 4.13 Modules the adventure source added since the first read (scope call, M6.0a, M6-D16)

Re-read at the recorded commit, 2026-10-31. Line counts are `wc -l`; test counts are top-level `it(`/`test(` calls in the source's `tests/`. Each module is assigned to an existing task, so no new package appears. Each joins its task under the same porting rules (§4.9): the leaks it has are removed in the rewrite, and its tests come across as behavior specs.

| Module | Lines | Tests | What it is | Goes to |
|---|---|---|---|---|
| `narrative/storylets.ts` and per-scene decks | 347 | 19 | Lines outside dialogue, picked by salience from what the player does, where they are and what they know | `narrative` (M6.8a): a storylet deck as content and a pick in the sim, on `puzzle`'s `Cond` and `sectors`' membership. Its imports of the game's director, pursuit and level go (§2.3) |
| `narrative/conversations.ts`, `narrative/conversation-stage.ts`, `game/conversation-camera.ts` | 47, 164, 291 | 3 (`conversation-audit`) | How a dialogue is shot and acted: during a conversation the stage draws a solved cutscene camera and figure poses instead of the play camera | `cutscenes` (M6.9b): a conversation is staged as a cutscene frame (free-shot camera, figure-clip acting) over `narrative`'s `DialogueGraph`, which is unchanged. The staging data is content per scene; `conversation-audit.ts` (188) joins the cutscene lint |
| `narrative/delivery.ts` and per-scene deliveries | 191 | 21 | How a line is said with no voices: typing pace, beats, and stressed, hushed, raised or shaken words | `narrative` UI (M6.8c): delivery as line content read by the DialoguePanel and the caption strip, under reduced motion (shake off, pace kept) |
| `narrative/portraits.ts` | 103 | none found | Each line shows its speaker's face in the expression the line calls for | `narrative` UI (M6.8c): a speaker-and-expression portrait table as content; the art is the game's. A missing portrait shows none and is a content warning |
| `audio/music.ts`, `audio/music-rules.ts`, `audio/music-play.ts` | 151, 164, 195 | 43 (`music`) | Recorded music in named slots with fallbacks; rules from the game's state to a slot (first match wins); a player that crossfades and loops on a seam | `audio-synth` (M6.10): music slots and rules as content, played on M5's `music` bus through its gain. The rules read presentation state only, never feeding the sim, a replay or the picture. The track files are the game's |

Out of M6: the source's FMV, fight, vision and direction modules (game-specific, like the other pipelines in §1).

## 5. Data and lifecycle flows

**Boot** (master spec §7, unchanged order): `no-eval` → host → settings (feel's store included) → content (maps, graphs, puzzles, systems, dialogue, cutscenes, feel, cues; every cross-reference validated at compile time) → assets → renderer (sector meshes built and lit once) → ready.

**Per fixed step** (sim): input commands (`verb`, `walk-to`, `choose`, `cutscene.skip`) → `nav` moves walkers → `systems` rules and agents (senses read `sectors` and `nav`) → `puzzle` applies the verb → `narrative` applies choices → events (`puzzle.said`, `nav.arrived`, `agent.mode`, `cutscene.started`, `sector.entered`, …) → hash.

**Per frame** (presentation): interpolate views → camera rig (or the cutscene's override) → cutaways → `feel.frame(drawnTick, alpha, dt)` → apply offset, frozen poses, squash, flash, words → haptics and cues when their moment comes → post chain.

**Verb flow:** a click on a hotspot → the game sends `walk-to` (`nav`) → on `nav.arrived` the game sends `verb` → `puzzle` matches an action → its effects run in order (facts, items, `noise` to `systems`, `dialogue` to `narrative`, `cutscene` to `cutscenes`) → `puzzle.said` → the line shows (`narrative` UI) and feel answers.

**Dialogue:** `dialogue` effect → `dialogue-state` opens the graph → the panel shows the node → `choose` → stance and facts change → the graph settles or ends.

**Cutscene:** `cutscene.started` at tick T → input ignored → presentation evaluates at `(tick − T)/rate + alpha` → `cutscene.skip` or the end tick → `cutscene.ended` → input resumes.

**Lifecycle:** background pauses the loop (M1.5); feel frames, words and bursts stop with the presentation clock; a pending haptic is dropped, never queued; audio-synth follows core audio focus.

**Settings change:** reduced motion, reduce flashing, haptics or intensity apply on the next frame; no remount; the sim hash is untouched.

**Scene change:** the old scene's resources (map, graph, puzzle, systems, dialogue) are replaced from the new scene's content through the game's Flow; carried state (items, facts the game declares as carried) moves through a `carry` record the game defines (The adventure source's `Carry`, minus its torch and basin fields).

**Dispose:** closing the scope removes overlay, pools, meshes, filters and listeners; a restart rebuilds from content.

**Release build:** `debug` and its driver are absent (tree-shaken), checked by the bundle test.

## 6. Failure policy

| Case | Result |
|---|---|
| A content reference does not resolve (an item, hotspot, node, line, cue, lamp, cutscene or feel event id) | Content compile error with `file:line:col` and the missing id; nothing runs |
| A puzzle effect needs an extension the game did not register (`noise` without `systems`) | Content compile error naming the extension |
| `{ call }` names a system the game did not register | Content compile error |
| The solver finds a softlock or an unreachable goal | `automata pipe puzzle check` fails with the route that locks; the generated route tests are not written |
| A generated route test is stale (its source hash moved) | `check` fails naming the file and the moved source |
| A route test fails | A product failure: the puzzle, the nav graph or the port is wrong; never regenerated to pass |
| A nav target has no route | `walk-to` emits `nav.unreachable` and the walker stays; the game shows its "can't get there" line |
| A sector map is invalid (self-intersecting loop, unlinked portal, floor step above the rule) | Content compile error from `resolveMap`'s validation |
| A scenario misses its probability over its seeds | `systems playtest` fails, naming the scenario and the seeds that failed |
| A dialogue graph has a dead end or an out-of-bounds stance | `narrative lint` fails |
| A cutscene camera leaves the map or an actor stands off the floor | `cutscene lint` fails |
| A cutscene's anchor is missing at run time (an actor not in the scene) | The cutscene is skipped with a logged warning and `cutscene.ended` fires, so input never stays locked |
| No pad actuator and no `navigator.vibrate`, or the call throws | Nothing happens; logged once per session; gameplay unaffected |
| Haptics denied by the host frame (R-11) | Same as unavailable; never a fallback to another path, and never a prompt |
| A feel entry exceeds a limit | Clamped to `[limits]`; content compile warns |
| `debug` code found in a release bundle | The bundle test fails the build |
| A golden hash differs between engines in any M6 plugin | A determinism bug: investigated, never rebaselined |

## 7. UI inventory and states

| Component | Owner | States | Focus and input | Host-aware |
|---|---|---|---|---|
| FeelSection (in Settings) | `feel` | haptics on/off (hidden when no haptics path exists), reduce flashing on/off, intensity off/half/full; saved, saving, save failed | Toggles and a segmented choice, 44 px; focus order top to bottom | Values through core Settings and host saves; per-device fields per M5-D4 |
| Word pop | `feel` | popping, holding, fading; still under reduced motion | None (not interactive) | Inside `geometry.visible` |
| Flash and tint layer | `feel` | off, on; absent under reduce flashing | None | — |
| Debug overlay | `debug` | hidden, open (tabs), panel error (the panel's error, others keep working) | Dev key or three-finger tap; tabs focusable; Escape closes | Dev builds only; inside `geometry.visible` |
| DialoguePanel (`hud.overlay`) | `narrative` | line only, line with 1–4 choices, waiting for the next line, closed | First choice focused; pad and keyboard move focus; 48 px choices; Back closes only where the graph allows | Never under `hostReserved`; scrolls when the text is long |
| Caption strip | `narrative` | shown with speaker, shown without, hidden | None | Above the bottom safe area |
| Skip cutscene control | `cutscenes` | hidden until 1 s in, shown, pressed | Hold to skip (500 ms) on pad, keyboard and touch, 48 px | Corner control; avoids `hostReserved` |
| "Can't get there" line | game | shown, fading | None | — |

## 8. Responsive behavior

| Situation | Policy |
|---|---|
| Phone landscape and compact (844×390, 780×270) | DialoguePanel takes the lower third with at most two choices visible and a declared scroll region for the rest; caption strip one line, ellipsis never, wraps to two |
| Portrait phone | `base-adventure` is `landscape` and shows M4's rotate hint (when M4.7 lands) |
| `scale` 1.333 | Panel text and targets scale through `--af-scale`; words and flashes do not |
| Keyboard or browser bar appears | No remount; the panel stays in `geometry.visible` |
| Reduced motion | Shake, holds, squash, bursts and the words' motion off; words appear still; orbit and cutscene eases unchanged in timing but instant cuts stay cuts |
| Long text (`xx-long` pseudo-locale) | DialoguePanel and captions pass the layout contract at every reference size, with no clipped or hidden choice |

## 9. Test allocation

| Layer | Where | What it proves |
|---|---|---|
| Unit (Node) | every package | Ported behavior specs: The adventure source `sectors` 1, `cutaway` 3, `room-masses` 1, `nav` 3, `puzzle-engine` 5, `puzzle-solver` 8, `puzzle-audit` 7, `puzzle-help` 7, `puzzle-pipeline` 7, `systems` 5, `agents` 8, `bots` 13, `pursuit` 15, `dialogue` 24, `narrative` 13, `narrative-audit` 9, `narrative-coverage` 12, `narrative-quality` 10, `cutscenes` 5, `cutscene-builder` 15, `cutscene-lint` 15, `feel` 17, `audio` 14, `blockout` 14, `debug-carry` 2 (233 top-level tests); the arcade source juice (16 files, 204 tests) for the parts that come across (§4.1), `haptics` 9, `content/juice` 15 as the `feel.toml` schema spec. Feel frames under `TestClock`; the haptics port with a fake pad and a fake `navigator` |
| Determinism | each package's `src/sim` | `check-boundaries` passes; a golden replay per plugin matches in Node, Chromium, WebKit and Firefox |
| Route tests | `games/base-adventure`, and the private adventure-source fixtures (M6-D5) | Every generated route reaches its goal in the AF sim |
| DOM behavior | FeelSection, DialoguePanel, Caption, Skip control, Debug overlay | States, focus order, Back, hold-to-skip, reduced motion and reduce flashing applied |
| Layout | the same components at every reference size and `xx-long` | No clipped, overlapping or hidden required action |
| Fake-host E2E | each example and `base-adventure` under AF's own fake host (`@mcthaydt/automata-testing`, ADR 0006), served with the target's headers | Boots, nothing before ready, zero CSP violations, zero console errors; a playthrough by the debug driver in dev; the release bundle has no debug marker |
| Render parity | GPU runner | Sector meshes and the feel layer in WebGL2 and WebGPU within M3-D5's tolerance |
| Owner | real phones and pads | §13 |

## 10. Feedback workflow

- Focused first: one Vitest file in the package (`pnpm --filter <pkg> exec vitest run src/sim/<file>`), then the package's golden in Node, then its parity project, then one example's E2E (`CI=1 pnpm exec playwright test <spec> --project=examples`).
- Content first: `automata pipe <puzzle|systems|narrative|feel|blockout> check --json` is the fast signal for content errors before any browser run.
- Browser checks wait on `session.ready`, `document.fonts.ready`, `nav.arrived`, `cutscene.ended` and two animation frames after a settings change; never a sleep.
- Full gates before each PR, under the heavy-gates lock: `pnpm check`, `pnpm test:parity`, and `pnpm test:e2e` when the change touches UI, a renderer, an example or a game.

## 11. Ruken alignment and requests

These are the Ruken target's facts (ADR 0006): they apply when a game builds for `ruken`. On `web`, `itch` and `tauri` the same `HapticsPort` default runs, and the target's own limits apply.

| Behavior | Ruken contract (vendored, `b30d31b`) |
|---|---|
| Capabilities a game may use | `@ruken/sdk` `CAPABILITIES`: `lifecycle`, `input`, `display`, `audio`, `exit`, `menu`, `saves`, `leaderboards`, `entitlements`, `store`, `ads`, `telemetry`, `analytics.custom`, `links`. There is no haptics capability |
| Saves (feel's settings, puzzle and dialogue state in the game's save) | Through M5's `Save` on the SDK; nothing in M6 talks to the SDK directly |
| Game CSP | `compileHeaders`; M6 adds no script source and no `eval` |
| Publish | `ruken publish` (unchanged); release builds contain no `debug` code |

**Requests to Ruken** (numbered after M3's R-8 and R-9; the Owner files them):
- **R-10.** A haptics capability (for example `haptics.pulse({ strong, weak, ms })`), so the host can route rumble to the pad it owns, to the phone shell's vibration, or to nothing, with a player setting the host controls. AF's `HapticsPort` would then call the SDK when the capability is granted.
- **R-11.** Question: does Ruken's game frame allow `navigator.vibrate` and `Gamepad.vibrationActuator` (its `allow` attribute and Permissions Policy) on the desktop, iOS and Android shells? Not verifiable here.

## 12. Tasks

| ID | Task | Lane | Depends on | Deliverable and acceptance |
|---|---|---|---|---|
| M6.0 | This spec, reviewed | integration | — | Owner review; M6-D1 to M6-D14 confirmed or changed |
| M6.1 | `feel` | feel (new) | M2, PRODUCT.5; M4.8 for `camera2d` when it lands | §4.1; examples `feel-hit`, `feel-settings`; the arcade source's values as a preset; F-a to F-e |
| M6.2 | `debug` | feel | PRODUCT.5 | §4.2; example `debug-panel`; the feel board as its first panel; DB-a, DB-b |
| M6.3 | Leak fixes, AF-side | gameplay (new) | M6.0 | The source re-read at the recorded commit (in `docs/provenance/sources.md`); each §2.3 leak assigned to the Plus task whose rewrite removes it; L-a |
| M6.4 | `sectors` | gameplay, render3d | M6.3, M3.4, PRODUCT.5 | §4.3; example `sectors-room`; SC-a to SC-c |
| M6.5 | `nav` | gameplay | M6.4 | §4.4; example `nav-click-to-walk`; N-a, N-b |
| M6.6 | `puzzle` and its route tests | gameplay | M6.5, M3.8 | §4.5; example `puzzle-locked-door`; P-a to P-d |
| M6.7 | `systems` | gameplay | M6.5 | §4.6; example `systems-patrol`; SY-a, SY-b |
| M6.8 | `narrative` | gameplay, ui | M6.6 | §4.7; example `narrative-dialogue`; NR-a to NR-c |
| M6.9 | `cutscenes` | gameplay, render3d | M6.4, M6.8 | §4.8; example `cutscenes-intro`; CS-a to CS-c |
| M6.10 | `audio-synth` | feel | M5 core audio, PRODUCT.5 | §4.10; example `audio-synth-cues`; AS-a |
| M6.11 | Environment pipeline | pipelines | M3.8, M6.5 | §4.11; EP-a, EP-b |
| M6.12 | `games/base-adventure` | integration | M6.1, M6.2, M6.6 to M6.9, M3.7 | §4.12; X-a |
| M6.13 | M6 exit | integration | all above | X-a and X-b; Owner gates (§13) |

Order: M6.1 and M6.2 start as soon as PRODUCT.5 merges (the arcade-source path, PD-3) and do not wait for M3. M6.3 can start at once. M6.4 waits for M3.4; then M6.5, M6.6 and M6.7 (M6.6 and M6.7 in parallel), M6.8, M6.9. M6.10 waits for M5's core audio. M6.11 after M3.8 and M6.5. M6.12 and M6.13 last.

New lanes for 04: **feel** (`automata-plus/packages/{feel,debug,audio-synth}`) and **gameplay** (`automata-plus/packages/{sectors,nav,puzzle,systems,narrative,cutscenes}`). `render3d` and `pipelines` are M3's lanes; the integration lane owns `base-adventure`.

## 13. Exit criteria and acceptance cases

**Success:**
- **F-a.** Under `TestClock`, a `slam` event at tick 10 produces the same `FeelFrame` sequence on every run, and its first non-empty frame is the one whose drawn tick reaches 10.
- **F-b.** During a 90 ms hit-stop the frozen view's pose holds while its interpolated position keeps moving, and the sim hash at every tick equals a run without `feel`.
- **F-c.** With reduced motion on, the offset is `[0, 0]`, no pose is frozen, squash is `[1, 1]` and words appear without motion; with reduce flashing on, no frame has a flash.
- **F-d.** With a fake pad that has a `vibrationActuator`, a slam calls `playEffect('dual-rumble', { duration: 90, strongMagnitude: 0.6, weakMagnitude: 0.4, startDelay: 0 })` once (the arcade source's call shape); with the `haptics` setting off, it is not called.
- **F-e.** Editing `feel.toml` under the dev server changes the next slam's shake within one reload, without a page reload.
- **DB-a.** In a dev build, the overlay opens with the dev key and shows every component registered in `debug.panels`.
- **L-a.** After the Plus rewrites, no M6 package imports a scene, a game's content module or a game-named storage key, and no contract carries one game's fields (`basinFull`, `torchTime` and the like); a `pnpm boundaries` rule in the Plus workspace fails on the first such import. The source's behavior specs from the recorded commit pass against the rewrites (§4.9).
- **SC-a.** `resolveMap` of the clinic fixture yields the same loops, portals and edges as the adventure source's `sectors` test.
- **SC-b.** Walking a figure into a wall's `cut` group from the camera's side hides the whole group on the same frame, and it reappears when the figure leaves.
- **N-a.** `route` between the same two points gives the same node list in Node, Chromium, WebKit and Firefox.
- **N-b.** A closed door's edge is not used; opening it (a sim event) makes the next `walk-to` route through it.
- **P-a.** The locked-door example's solver finds exactly the routes its generated tests play, and every one reaches the goal.
- **P-b.** **The adventure source's 16 route tests** (bay 8, clinic 5, clinic-dawn 2, prologue 1, the same at the first read and at the recorded commit), regenerated by `automata pipe puzzle routes` from the converted puzzle content, pass on AF's `puzzle` (M6-D5). Any route that cannot be ported is listed with the reason and does not count as passing.
- **P-c.** the adventure source's `puzzle-engine` and `puzzle-solver` behavior specs pass against AF's `puzzle`.
- **SY-a.** A patrol agent follows its routine and switches to `chase` when its sight probe holds, with the same tick of the switch in four engines.
- **SY-b.** A scenario's probability over its declared seeds is the same in every run (seeded, not random).
- **NR-a.** A choice that adds stance past the canon's bound clamps to the bound.
- **NR-b.** The DialoguePanel at 780×270 in `xx-long` shows the line and every choice reachable by scroll, with focus on the first choice.
- **CS-a.** A cutscene of 3 s at 60 Hz plays 180 ticks; a replay of the same run plays the same frames and ends on the same sim hash.
- **CS-b.** `cutscene.skip` at tick 30 ends the cutscene on the next tick and resumes input.
- **AS-a.** Every cue in the example renders offline under the true-peak and click limits.
- **EP-a.** `automata pipe blockout run` on a fixture spec writes a `sector-map` and a `nav-graph` that `base-adventure` loads, and the guard refuses a hand edit to either.
- **X-a.** `base-adventure` boots under AF's fake host (and, for the `ruken` target, Ruken's local stack), plays its puzzle to the goal by the debug driver in dev, and its golden replay matches in four engines.

**Failure cases that must be shown by tests:**
- **F-f.** With no actuator and no `navigator.vibrate` (or one that throws), a slam does nothing and logs once; no exception reaches the loop.
- **DB-b.** A release build of `base-adventure` contains no overlay marker and no `__automataDebug`; adding a debug import to release code fails the bundle test.
- **SC-c.** A self-intersecting sector loop fails the content compile with its file and line.
- **P-d.** A puzzle with a softlock fails `puzzle check` naming the locking route; a stale generated route file fails `check` naming its moved source.
- **NR-c.** A dialogue graph with a dead end fails `narrative lint`.
- **CS-c.** A cutscene whose anchor actor is absent is skipped, `cutscene.ended` fires, and input is not locked.
- **EP-b.** An invalid blockout spec stops at `validate` (exit 1) and writes nothing.
- **X-b.** A golden hash mismatch between engines in any M6 plugin fails parity (never rebaselined).

**Gates reported separately:** implemented; locally verified (`pnpm check`, parity, fake-host E2E in Chromium); GPU-runner verified (render parity); deployed (Ruken local stack and the private dev host; `sectors` and `base-adventure` stay private while D-1 stands); Owner accepted.

**Owner acceptance (never ticked by an agent):**
- `feel` on the arcade source's preset, felt on a real phone and a real pad, with device, browser and date recorded.
- `base-adventure` played on a real phone under Ruken's local stack, from the title to the goal.
- The answers to R-10 and R-11 recorded, or the Owner's decision to ship haptics as standalone only.

## 14. Risks

| Risk | Mitigation |
|---|---|
| The Miniplex to Koota rewrite changes behavior | Behavior specs from the adventure source's tests; route tests and goldens as the oracle; each unportable test listed with its reason |
| The adventure source keeps moving | M6.3 records the extraction commit in `docs/provenance/sources.md`; each task's plan re-reads its files at that commit |
| Floats in ported sim code drift across engines | Only `dmath` and the allowed `Math` functions; four-engine goldens per plugin; boundaries check in CI |
| Haptics silently unavailable under Ruken | A rumble is never a required signal; R-10/R-11; Owner gate on real devices |
| `feel` and `camera2d` both shake | One trauma model in `camera2d` (M4); `feel` only calls it |
| Debug code leaks into a release | Build-time constant, tree-shaking, and the bundle test (DB-b) |
| Gameplay extensions become one game's engine | Each needs a fixture example and `base-adventure` that is not the adventure source; game fields stay out of contracts (M6.3) |
| `sectors` is private only because its render side needs `@pixi/3d` | Sim and render are separate entry points; the sim side can be published if D-1 changes (M6-D3) |

## 15. Open decisions (recommended defaults in effect until the Owner reviews)

| ID | Question | Recommended default | Why |
|---|---|---|---|
| M6-D1 | Where M6 code lives | **`mcthaydt/automata-plus`** for every package, example and `base-adventure` | PD-1: every extension is Plus; APP-D2 keeps the repo separate, and Plus is free (APP §3); APP-D9 keeps `cutscenes` and its prerequisites there |
| M6-D2 | Where the leaks are fixed | **AF-side, in the Plus rewrite** of the module that has each leak, from the recorded commit (decision 8: the source is not edited) | AGENTS.md: extracted code comes from a recorded source commit and brings its source tests; those tests, as behavior specs, prove the rewrite |
| M6-D3 | `sectors` packaging | **Private (`private: true`) while D-1 stands**, with sim and render as separate entry points | Its render side depends on the unpublished `render-pixi3d` |
| M6-D4 | Port or copy | **Rewrite on Koota with behavior specs** for every sim part; copy only pure build-time tools (solver, lints, pipelines) with their tests | Extraction map §5; laws 1–7 |
| M6-D5 | How the adventure source's route tests run in AF | **Regenerated** by `automata pipe puzzle routes` from the adventure source's four puzzles converted to TOML, kept as private fixtures in `automata-plus` at the recorded commit, played in an AF sim with `puzzle`, `nav` and `sectors` (NPCs off) | The originals call the adventure source's `createSimulation`; the exit criterion is that the same routes pass on AF's `puzzle` |
| M6-D6 | Cutscene scripts | **Data with named anchors**, resolved at start; the builder writes data | Content must be hashable and hot-reloadable; functions are not |
| M6-D7 | Cutscene time | **Sim ticks** (start tick in a resource; input ignored until the end or a skip command) | Replays and hashes include cutscenes; no frame-rate dependence |
| M6-D8 | Feel settings storage | **Core Settings** through `settings.sections`; `haptics` and `intensity` per device (M5-D4), `reduceFlashing` with the player | Host authority: no `localStorage`; M5-D4 already allows declared per-device fields |
| M6-D9 | Onboarding (`onboarding.ts`) | **Not an extension:** a field in the game's save (M5 `Save`); the title screen reads it | PD-5 cuts a tutorial system; it is 12 lines of game logic |
| M6-D10 | `telemetry-extra` | **Cut** | PD-5 |
| M6-D11 | Hit-stop semantics | **Presentation only:** views freeze, sim never pauses | The arcade source D-P5; laws 1 and 2; nothing in the adventure source stops the sim for it |
| M6-D12 | Haptics under Ruken | **Same port as standalone** (`vibrationActuator`, `navigator.vibrate`), never required, a player switch; move behind the SDK if R-10 is granted | Ruken has no haptics capability at `b30d31b`; nothing here is a denied-capability fallback |
| M6-D13 | Debug in builds | **Dev builds and `--debug` builds only**, tree-shaken from release, checked by a bundle test | Master spec: "stripped from release builds"; the adventure source reads `?debug` in every build |
| M6-D14 | Fixture game | **`games/base-adventure`** grown from `games/base-3d` (M3.7), not the adventure source's scenes | A fixture AF owns; the adventure source adopts AF in M8 (D-2) |
| M6-D15 | Who owns the sector format | **Core's `@mcthaydt/automata-editor-3d` `format/`** (`af-sector/1`, `sector.schema.ts`); `sectors` imports it and adds no field; the sim's geometry is `sectors`' own, on `dmath` | One owner (§3): the editor already ships the format and its codec, core cannot import Plus, and Plus imports core only through public entries. If a second core consumer appears, the format moves to its own core entry with no shape change |
| M6-D16 | The modules the source added since the first read | **Folded into existing tasks** (§4.13): storylets, delivery and portraits into `narrative`; conversations into `cutscenes`; music into `audio-synth` | No new package or row; each has a home whose contracts it already uses |

## Appendix A. How the counts were produced

On a clone of the adventure source at the first-read commit (`docs/provenance/sources.md`):

```sh
wc -l src/feel/*.ts src/audio/*.ts src/narrative/*.ts src/game/contracts/*.ts \
  src/game/{sectors,sector-format,rooms,cutaway,nav,level,puzzle,puzzle-solver,systems,agents,probes,bots,pursuit,cutscenes,cutscene-builder,cutscene-lint,rng,simulation}.ts \
  src/render/{sector-mesh,dressing}.ts scripts/pipeline/{blockout,blockout-lib,blockout-format,puzzle,puzzle-lib,systems,systems-lib,narrative,feel,cutscene-preview}.ts
for f in sectors cutaway room-masses nav puzzle-engine puzzle-solver puzzle-audit puzzle-help puzzle-pipeline systems agents bots pursuit \
  dialogue narrative narrative-audit narrative-coverage narrative-quality cutscenes cutscene-builder cutscene-lint feel audio blockout debug-carry; do
  printf '%s %s\n' "$f" "$(grep -cE '^\s*(it|test)(\.each)?\(' tests/$f.test.ts)"
done
for f in tests/generated/*.ts; do printf '%s %s\n' "$f" "$(grep -cE '\b(it|test)(\.each)?\(' "$f")"; done
# leaks and sim-unsafe calls, per file
for f in src/game/*.ts; do grep -oE "from '[^']+'" "$f"; grep -oE 'Math\.[a-zA-Z0-9]+' "$f" | sort | uniq -c; done
```

On the arcade source at its recorded commit: `wc -l apps/client/src/systems/gameplay/juice/*.ts apps/client/src/systems/haptics.ts content/juice.toml`, and the same `grep -cE` over `tests/client/systems/gameplay/juice/*.test.ts`, `tests/client/systems/haptics.test.ts` and `tests/content/juice.test.ts`. On the vendored `@ruken/sdk` at `b30d31b`: the `CAPABILITIES` array in `dist/index.js`, and a search for `vibrat|haptic|rumble` across the four tarballs (no match).
