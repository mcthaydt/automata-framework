# M5: Saves and audio (milestone spec)

- **Status:** Owner-approved 2026-10-16, every open decision on its recommended default. Task **M5.0** in [02 Master delivery plan](../../02-master-delivery-plan.md). Nothing here is implemented before that review (01 Decomposition §5, [04 How we build](../../04-how-we-build.md)). Review freezes the contracts in §4; after that they change only additively or through a written change request. Open decisions M5-D1 to M5-D10 (§15) run on their recommended defaults until the Owner changes them.
  > **Amendment, 2026-10-30 (the Owner, in the session's chat: "throw this in where it fits"; the placement is the agent's, open to veto):** `@typeonce/ritmo-tools` (MIT, 0.19.1) joins §4.7's asset build as a separate CLI that is never imported (its Effect 4.1 does not meet AF's Effect 3.22): the pixel fixer and pixel lint in `automata-content assets` (M5.6) and an `automata check` step on the Endesga 64 palette; sound recipes rendered to WAV at build for core sound (M5.3), edited by the Audio editor (EDS.5), with `audio-synth` deciding whether to adopt the format; music songs rendered at build for core music and `audio-stream` (M5.8). 02 rows ASSET.0 (the full §4.7 amendment) to ASSET.4. ASSET.0 done 2026-10-30: §4.7a holds the full placement and acceptance cases ASSET-a to ASSET-h.
- **Owner direction (2026-10-16):** "Draft M4.0 and M5.0, core parts first." Per the [PRODUCT spec](./2026-10-16-product-core-and-plus-design.md) PD-3, the free core comes first (saves and migrations, core audio, the asset build, the leaderboard call) and the Plus extension (`audio-stream`) after it. Localization left M5 for PRODUCT.L (PD-4); M5 builds the font-subsetting half of PRODUCT.L's glyph-coverage case L-e.
- **Depends on:** M2 (merged: snapshots, content hash, replay codec) and M4, whose spec is drafted at [`2026-10-16-m4-input-display-design.md`](./2026-10-16-m4-input-display-design.md) on branch `claude/clever-pasteur-ujmu6e-m4spec` and is **pending Owner review**. M5 uses M4's Slider, Toggle, Toast and core Settings screen (M4 §4.8) and M4's layout matrix. If M4's review changes those, this spec follows.

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| AF `main` | `71c3410` | What exists (§2), checked against `packages/*/src` |
| PRODUCT.1 branch `claude/clever-pasteur-ujmu6e-product1` | `a42c58f` (pending review, not merged) | `AudioBuses` seam and `audioBusGainsSchema` (`packages/runtime/src/audio/`), `Hosting.leaderboards` (`packages/host/src/hosting.ts`) |
| PRODUCT.L1 branch `claude/clever-pasteur-ujmu6e-productl` | `f3e6784` (pending review) | `Locale` service, locale negotiation; the per-locale character sets M5's font subsetting reads come from PRODUCT.L's content side |
| M4 spec (draft) | branch `claude/clever-pasteur-ujmu6e-m4spec` | Settings screen, Slider, Toggle, Toast, layout matrix |
| FloorFifty, `SNEKPRTY/FloorFifty` | `ac72660` (local clone, re-surveyed 2026-10-16) | Every extraction row in §4 |
| Ruken SDK `@ruken/sdk` and fake host `@ruken/sdk-host`, vendored | RukenApp `b30d31b` ([`vendor/ruken/`](../../../vendor/ruken/README.md)) | `SavesApi` (`storage`, `status`, `on('changed')`, `flush`), `AudioApi` (`focus`, `master`, `gain`), `LeaderboardsApi`, the save map's checks, the fake host's `FakeSavesServer` (two devices can conflict) and `HostBridge.resolveConflict` |
| `@ruken/manifest`, vendored | `b30d31b` | `[leaderboards]` table (`order`, `min`, `max`), the game CSP (`media-src 'self' blob:`, `font-src 'self' data:`) |
| [M1 shared contracts](./2026-10-11-m1-shared-contracts-design.md) §1.1–§1.3 | — | `Hosting.saves`, no AF copies of Ruken limits, the no-grant saves behavior already reported to Ruken |
| [M1.5 runtime spec](./2026-10-12-m1-runtime-design.md) §1, Q5 | — | Save, audio and per-device settings deferred to M5 |

The Last Light (`audio/mixer.ts`, `audio/index.ts`) has no clone here; its rows are "not re-surveyed" and must be read at its current commit before M5.3's plan.

## 1. Goal and boundaries

**Goal.** A game saves the player's progress through Ruken, in named slots or one record. Saves are versioned, so a save written by version N loads on version N+1 through its migrations, and a save written by a newer build is never overwritten. The player can save on one device, exit, and resume on another. The game plays sound on the player's buses, unlocked on the first gesture, silent while hidden, and scaled by the host's volume. Fonts are cut to the characters each locale uses, sprites are packed into atlases, and both are checked at build time.

**Core first (all free, MIT):**
1. `Save` service: slots, autosave, versions and migrations, sync status, cross-device changes, exit flush (M5.1, M5.2).
2. Per-device settings fields (audio levels stay on the device; M5-D4) (M5.2).
3. Core audio: the `AudioBuses` implementation, unlock, sleep and wake, host gain and focus, ducking, `sound` and `music` (decoded, not streamed), the Audio settings section (M5.3, M5.4).
4. The asset build: font subsetting with a glyph-coverage gate, atlas packing, palette check (M5.5, M5.6).
5. The leaderboard flow on `Hosting.leaderboards`: board declared in `[leaderboards]`, submit and read with named failure states (M5.7).

**Plus, after core (M5.8):** `audio-stream` (streamed music with decode-behind playback, preloading, the menu stream, iPad unlock diagnostics) in `automata-plus` once PRODUCT.5 exists.

**Exclusions:**
- Localization: PRODUCT.L (runtime `t()`, negotiation, pseudo-locale). M5 only subsets fonts from PRODUCT.L's character sets.
- `audio-synth`: M6, on The Last Light's path (PRODUCT spec §3).
- The beat clock and music sync: cut to an example on the audio clock (PRODUCT spec §3).
- Replay sharing and a replay viewer: cut (PRODUCT spec §3). A replay may be stored as a save value (§4.3), nothing more.
- Store entitlements and the grant-once ledger: `store` (M7), which waits on Ruken's `[store]`.
- A leaderboards extension: cut (PD-5); the call is core on `Hosting` (PRODUCT.1).

**Prerequisites:** PRODUCT.1 merged before M5.3 and M5.7 are planned; M4.6 (Slider, Toggle, Toast) and M4.4 (core Settings screen) merged before M5.4 and M5.2's UI. M5.1, M5.5 and M5.6 depend on neither and can be planned first.

## 2. What already exists (verified at `71c3410`, not rebuilt)

| Capability | Where | M5 does |
|---|---|---|
| `Hosting.saves.get/set/remove/flush`, `Hosting.savesStatus` | `packages/host/src/hosting.ts`, `hosting-live.ts` | Adds `keys` and `changed` (§4.1, additive) |
| Flush on `session.exiting`, capped at `HOST_EXIT_CAP` 1 s inside Ruken's grace | `packages/host/src/hosting-live.ts` (lines 120–126, 271–280) | Commits pending writes into the SDK before that flush (§5) |
| Quota errors relayed as `HostError` `QUOTA_EXCEEDED` (from the SDK's `QuotaExceededError`) | `packages/host/src/errors.ts` `toHostError` | Maps it to a save state (§6) |
| `Hosting.audio` (`focus`, `master`, `gain`), `Hosting.lifecycle` | `packages/host/src/hosting.ts` | Consumed by core audio |
| Settings with versions and migrations (`SettingsDef`, `readSettings`, `writeSettings`), over `Hosting.saves`, no device fallback | `packages/runtime/src/settings/` | Reused by `SaveDef` (§4.2) with stricter rules for newer versions |
| `Assets` loading per screen with byte progress and the 30 s stall; fonts per screen | `packages/runtime/src/loading/assets.manager.ts` | Audio files load through it; subset fonts are declared to it |
| Preload list generator, palette schema (Endesga 64) | `packages/content/src/preload/`, `packages/content/src/palette/` | Atlas and font outputs feed the preload list; atlases are checked against the palette |
| Snapshot and restore with content hash (`SnapshotMismatchError`), replay codec | `packages/sim` (M2.2, M2.3) | A save may carry a snapshot (M5-D5) |
| `sleepWhenHidden` | `packages/ui/src/browser/sleep-when-hidden.ts` | Core audio sleeps on it |
| `[leaderboards]` written into `ruken.toml` from ship config | `packages/ship/src/manifest/ruken-toml.ts` (line 50) | The board check reads the same config (§4.7) |

**Pending elsewhere (consumed, not redefined):** PRODUCT.1's `AudioBuses` (`input(bus)`, `gain(bus)`, `setGain(bus, gain)`; buses `master`, `music`, `sfx`, `ui`), `audioBusGainsSchema`, and `Hosting.leaderboards` (`submit`, `get`).

**Not in AF anywhere:** a save service, slots, autosave, save migrations, sync status UI, cross-device change handling, any audio implementation, font subsetting, glyph checks, atlas packing.

## 3. Ownership

| State or artifact | Owner | Writers | Readers |
|---|---|---|---|
| Save values in Ruken | Ruken (the host's saves engine and server) | the SDK, called only through `Hosting.saves` | `Save` |
| Slot records, the loaded save, autosave timers | `runtime` `save/` (`Save` service) | `Save.write`, autosave | the game, the Save slots UI |
| Gameplay state | the sim (law 1) | sim systems | the game turns it into a save value; `restore` only at load |
| Conflict resolution between devices | **the host** (`HostBridge.resolveConflict`, Ruken's shell asks the player) | Ruken | AF hears the outcome as `saves.changed` and never resolves conflicts itself |
| Sync status | the SDK (`SavesStatus`) | Ruken | `ui` `SaveStatus` indicator |
| Per-device settings fields | `runtime` `settings/` device part | the settings store | audio |
| Audio graph, buses, unlock state | `runtime` `audio/` (`Audio` service, `AudioBuses`) | `Audio` | the game, extensions (`audio-stream`) through `AudioBuses.input(bus)` |
| Player bus gains | the game's settings record, field `audio` (device part) | the Audio settings section | `Audio` |
| Host gain and focus | Ruken (`audio.gain`, `audio.focus`) | the host | `Audio` multiplies it in |
| Subset fonts, atlases | `content` `assets/` (build time) | the asset build | `Assets`, `render-pixi` |
| Leaderboard boards | the game's ship config (`leaderboards`) | the game | `ship prepare`, the leaderboard check |

Laws kept: the sim does no I/O; saving reads sim state through the game's own serializer outside the sim; loading restores through `restore` or the game's setup, never by writing components from outside a system.

## 4. Contracts

### 4.1 `Hosting` additions (host lane, additive)

```ts
export interface HostingSaves {
  // M1: get, set, remove, flush
  /** Every save key the session holds, sorted by code unit (from the SDK's `SavesStorage.key(i)` and `length`). */
  readonly keys: Effect.Effect<readonly string[], HostError>
  /** Another device's write, or the host's conflict choice, reached this session (`SavesApi.on('changed')`). */
  readonly changed: Stream.Stream<SavesChangedPayload>
}
```

`SavesChangedPayload` (`key`, `value`, `revision`) is the SDK's type, imported, never copied. Contract tests drive both with the fake host's `FakeSavesServer.remoteWrite` (a second device) and `HostBridge.resolveConflict`.

### 4.2 `SaveDef` and migrations (`packages/runtime/src/save/save.schema.ts`)

```ts
export interface SaveDef<S> {
  readonly key: string                 // prefix; Ruken's key rule is the SDK's, checked by the SDK
  readonly version: number             // integer >= 1
  readonly schema: z.ZodType<S>
  readonly empty: () => S
  readonly migrations: Readonly<Record<number, (record: Record<string, unknown>) => Record<string, unknown>>>
  readonly slots?: { readonly count: number } // absent: one record at `key`
  readonly autosave?: AutosavePolicy
}
/** What is stored: a self-describing envelope, one Ruken key per slot. */
interface SaveEnvelope {
  readonly format: 1
  readonly version: number
  readonly contentHash: string         // the sim content hash at save time (M2.2)
  readonly savedAt: number             // Effect Clock epoch ms, for the slot list; outside the sim
  readonly label?: string
  readonly data: Record<string, unknown>
  readonly snapshot?: string           // optional sim snapshot, base64 (M5-D5)
}
```

Rules, from FloorFifty `common/progress.ts` (152 lines) and `common/settings.ts` (284), with the stricter save policy:
- **Migrations** run step by step from the stored version to `version` (`n` → `n + 1`), then the schema parses. A missing step, a throwing step or a failed parse is `SaveUnreadable` for that slot: the slot is shown as damaged, kept untouched, and never overwritten unless the player chooses to (§6).
- **Newer build** (stored `version` above the build's): `SaveFromNewerBuild`. The slot is read-only in this build; no write, autosave or migration touches it (FloorFifty `isNewerProgress`: "opening an older build must not erase it").
- **Unknown fields ride through** a passthrough parse (FloorFifty: a field a later build adds survives a write by an older build of the same version).
- **Settings differ on purpose:** a settings record from a newer build falls back to defaults (M1.5's rule stays), because losing a preference is acceptable and losing progress is not.
- Envelopes are canonical JSON (`@mcthaydt/automata-sim/hash`), so the same state always writes the same bytes and an unchanged autosave sends nothing (§4.4).

### 4.3 `Save` service (`packages/runtime/src/save/save.manager.ts`)

```ts
export type SlotState =
  | { readonly kind: 'empty'; readonly slot: number }
  | { readonly kind: 'ready'; readonly slot: number; readonly meta: SlotMeta }
  | { readonly kind: 'unreadable'; readonly slot: number; readonly reason: string }
  | { readonly kind: 'newer'; readonly slot: number; readonly version: number }
  | { readonly kind: 'other-content'; readonly slot: number; readonly meta: SlotMeta } // snapshot with another content hash

export interface Save<S> {
  readonly slots: Subscribable.Subscribable<readonly SlotState[]>
  load(slot: number): Effect.Effect<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostError>
  write(slot: number, data: S, options?: { label?: string; snapshot?: Uint8Array }): Effect.Effect<void, SaveRefused | HostError>
  remove(slot: number): Effect.Effect<void, HostError>
  /** Marks the loaded slot dirty; autosave writes it on its next trigger. A plain function, safe to call per tick. */
  touch(data: () => S): void
  readonly flushPending: Effect.Effect<void>
}
export function saveService<S>(def: SaveDef<S>): Effect.Effect<Save<S>, never, Hosting | PresentationBus | Scope.Scope>
```

- Slot keys are `<key>.slot.<n>` (one Ruken key each, so a host conflict on one slot never splits it from its metadata). The slot list is derived from `Hosting.saves.keys` and each envelope's header, with no separate index key (M5-D2).
- `write` checks the envelope against `SaveRefused` conditions AF can know (writing over a `newer` slot) and relays everything else from the SDK, including quota (AF quotes no limit; R-5).
- A write publishes `save.written`; a failure publishes `save.failed` with the `HostError` code.

### 4.4 Autosave (`AutosavePolicy`)

```ts
export interface AutosavePolicy {
  readonly on: readonly ('screen-exit' | 'round-end' | 'background' | 'interval')[]
  readonly intervalSeconds?: number    // default 60; Effect Clock, tested with TestClock
}
```

- Triggers only write a slot that `touch` marked dirty and whose canonical envelope differs from the last write.
- `background` (lifecycle to background) writes, then calls `Hosting.saves.flush`.
- Autosave never writes while the loaded slot is `newer`, `unreadable` or `other-content`.
- Writes are serialized per slot: one in flight, the latest pending replaces older pending data.

### 4.5 Per-device settings (`packages/runtime/src/settings/`, M5-D4)

`SettingsDef` gains `deviceFields?: readonly (keyof S)[]`. Those fields are read from and written to a `DeviceStorage` (the frame's `localStorage` behind try/catch), the rest through `Hosting.saves` as today. From FloorFifty `keepAudioOnDevice` (`common/settings.ts` lines 150–200, Owner 2026-10-10: "muting a Mac must not mute the same player's iPad"):
- Device storage blocked or throwing: the fields hold for the session only. They are never written to `Hosting.saves` instead.
- The account copy of a device field is never read (FloorFifty's rule, so an old account-wide mute does not follow the player).
- This is a declared choice per field, not a fallback for a denied capability; a denied `saves` grant still fails as M1.5 says. Ruken request R-6 asks for a host-owned device scope so this can move behind `Hosting`.

### 4.6 Core audio (`packages/runtime/src/audio/`)

```ts
export type AudioBusName = 'master' | 'music' | 'sfx' | 'ui' | 'voice' // M5-D3 adds 'voice' to PRODUCT.1's four
export interface Audio {
  readonly unlocked: Subscribable.Subscribable<boolean>
  sound(alias: string, options?: { bus?: AudioBusName; gain?: number; rate?: number }): void // fire and forget
  music(alias: string, options?: { fromSeconds?: number; loop?: { start: number; end: number } }): Effect.Effect<void, AudioDecodeFailed | AssetLoadFailed>
  stopMusic(fadeSeconds?: number): void
  duck(bus: AudioBusName, amount: number, seconds: number): void // 0..1, its own gain node
  setMuted(muted: boolean): void
}
export const AudioLive: Layer.Layer<Audio | AudioBuses, never, Hosting | Assets | Settings | Scope.Scope>
```

From FloorFifty `managers/audio/{engine (480), graph (427), model (452), manager (351)}.ts` and their tests (`audio.test.ts`, `audio-decode-context.test.ts`, `rukens/audio-host-gain.test.ts`, `sleep-hosted.test.ts`):
- **Graph:** one `AudioContext`, built lazily on the first unlock. One gain node per bus into `master`; `master` = player master gain × host `audio.gain` × mute × unfocused-mute. FloorFifty's hall, tape echo and vintage stage stay in the game or go to `feel`/`audio-synth`; the graph exposes `AudioBuses.input(bus)` for them.
- **Unlock:** on the first `pointerdown`, `keydown` or `touchend` after `session.ready`, inside the gesture, build and `resume()` (FloorFifty `unlock`: both calls before any await). Idempotent. Before unlock, `sound` drops silently and `music` is remembered and starts on unlock.
- **Sleep and wake:** on `lifecycle` background or a hidden page (`sleepWhenHidden`), suspend a running context and cancel queued one-shots ("asleep is silent, not queued"); wake resumes only what sleep suspended. A context the system interrupted is resumed on the next gesture (FloorFifty `resumeOnGesture`).
- **Host focus:** `audio.focus` `ducked` or `muted` (ads, host overlay) and `audio.master` apply through `gain`, which the SDK already combines; AF multiplies by `Hosting.audio.gain` and adds nothing else.
- **Mute when unfocused:** an optional setting (FloorFifty `muteUnfocused`), master only, the graph keeps running.
- **Voices:** at most `MAX_VOICES` 16 one-shots (FloorFifty `model.ts` line 15); the oldest stops first.
- **Decoding** reads the blob from `Assets`; a decode failure publishes `audio.decode.failed` and plays nothing; it never blocks a screen.
- No Effect is allocated per frame; `sound` is a plain call. Audio is presentation: it never feeds back into the sim, and sim events reach it as presentation-bus facts.

### 4.7 The asset build (`packages/content/src/assets/`, build time, Node)

Run by `automata-content assets` and by the content Vite plugin's build hook; outputs are generated files, never hand-edited.

**Fonts** (from FloorFifty `packages/asset-contract/tools/subset-fonts.ts` 52 and `tools/i18n/characters.ts`):
- `fonts.toml` declares each source font (`file`, `sha256`, `license`, the locales it serves). The game commits its font sources (M5-D7); a source whose hash differs is refused.
- Each locale's subset is cut with `subset-font` (FloorFifty's dependency, ^2.9.0) to that locale's characters (from PRODUCT.L's compiled messages) plus FloorFifty's `ALWAYS` set (ASCII, CJK punctuation, full-width forms, a few symbols) and the endonym text for the language picker. Output `woff2` with content-hashed names.
- **Glyph coverage gate (PRODUCT.L L-e):** every character of every message in a locale must be in that locale's subset. A missing glyph fails the build with the message's `file:line:col` and the character's code point.
- Two runs over the same inputs give byte-identical outputs (checked by a test).

**Atlases** (new; no FloorFifty source: FloorFifty ships single WebP files):
- `atlases.toml` names each atlas and its input folder of PNG frames. Frames are packed by a small deterministic packer in AF (M5-D8): inputs sorted by code unit, fixed 1 px padding and 1 px edge extrusion for pixel art, a square power-of-two page no larger than 2048 (WebGL2's guaranteed minimum `MAX_TEXTURE_SIZE`), extra pages when needed.
- Output is a PNG page and a Pixi `Spritesheet` JSON per page, loaded through `Assets`; frame names are the file names without extension.
- PNGs are read and written with `pngjs` (FloorFifty's dependency, ^7.0.0).
- **Palette check:** when the game declares a palette (content `palette`), every opaque pixel must be a palette colour, from FloorFifty `validate-assets.ts`. A stray colour fails with the file, the pixel and the colour.
- Atlas and font outputs join the generated preload list when their screen is preloaded.
  - **How (M5.6F.2, 2026-10-30, open to the Owner's veto; [plan](../plans/2026-10-30-m5-6f2-preload-atlas-fonts.md)):** a screen names them in `assets.toml` beside its `files`, by their names in `atlases.toml` and `fonts.toml` (`atlases = ["wick"]`, `fonts = ["pixel"]`). Each atlas page's Spritesheet JSON and image, and the subset of every language `fonts.json` lists, join the list after the screen's files. Which files exist comes from the outputs `automata-content assets` wrote below `outDir`; the build serves them in the same folders, `atlases/` and `fonts/`. A name not declared is `unknownReference`, one not built or a file the build lacks is `missingAsset`, all reported at once at the screen's key.

### 4.7a ritmo-tools in the asset build (ASSET.0, 2026-10-30)

Placement of `@typeonce/ritmo-tools` (Owner, 2026-10-30: "throw this in where it fits"; accepted under "Auto accept
all spec and plans"; the placement is the agent's, open to veto). Read from the published 0.19.1 tarball (its
`README.md`, `package.json` and `LICENSE`, 2026-10-30).

**The package.** `@typeonce/ritmo-tools` 0.19.1, MIT, one bin `ritmo-tools` (`dist/cli.js`), Node `>=20`, depending
on `effect` 4.1.0, `@effect/platform-node` 4.1.0, `pngjs` 7.0.0 and `jpeg-js` 0.4.4. Three command groups: `pixel`,
`sound`, `music`. Every command prints a JSON report on stdout and exits 0 (clean), 2 (usage error, missing file,
broken source), 3 (fixable: rules broken) or, for `pixel` only, 4 (needs a person: the grid is unsure).

**The separate-CLI rule.** AF runs `ritmo-tools` as a child process and reads its JSON; no AF package imports it,
and no AF type mirrors its internals beyond the fields of the JSON report a step reads. Its Effect 4.1 does not meet
AF's Effect 3.22 (ADR 0003), and a second Effect major in one process graph would duplicate the runtime. It is a
`devDependency` of the package that spawns it (`@mcthaydt/automata-content` for the asset build, the game for its
own scripts), pinned exactly; `docs/versions.md` gets its npm-table row and `docs/stack.md` its card in the PR that
first installs it (ASSET.1), because `tooling/versions` fails on a row no manifest uses. Never in a game bundle.

**Version.** 0.19.1, as the Owner named it. It was published on 2026-10-29 and the package's first release was
2026-10-28, so no version meets AF's usual "older than 14 days" rule (versions.md); ASSET.1 pins 0.19.1 and records
that exception in its row (veto ASSET-D2 below).

**Pixel (ASSET.1).**
- `automata-content assets` runs `ritmo-tools pixel lint <png>` on every atlas input frame (§4.7 Atlases) before it
  packs, with the game's `pixel.config.json` (`--config`). A report with exit 3 fails the build with the file and
  the report's findings; exit 2 is a tool error naming the file; exit 4 cannot come from `lint` (it reads pixels as
  they are) and is treated as a tool error.
- The fixer is not run by the build. `ritmo-tools pixel fix` and `sheet` rewrite art, which a build must never do
  (outputs are generated, inputs are authored); a person or an agent runs them, and the agent skills describe that
  (ASSET.4).
- **Palette.** The game's palette is a committed `.hex` file next to `pixel.config.json`, which names it
  (`"palette": "endesga-64.hex"`). ritmo-tools 0.19.1 has no Endesga 64 preset (its presets include Endesga 32,
  AAP-64 and PICO-8), so the file is the source; a game may name a preset instead. When the content `palette` (§4.7
  Palette check) and the `.hex` both exist, they must hold the same colours, and the build fails naming the first
  colour that differs, so the palette has one source of truth per game.
- **`automata check` `pixels` step.** Runs `ritmo-tools pixel lint` over the same inputs with `--json` findings
  (`file`, `rule`, `message`), so an agent sees art problems without a full build. The step is skipped, not
  failed, when the game has no `pixel.config.json`.

**Sound (ASSET.2).**
- A game's sound effects are a bank, `content/sounds/<name>.sounds.json` (ritmo-tools' format:
  `{"version": 1, "master": …, "sounds": {…}}`). `automata-content assets` runs `ritmo-tools sound check <bank>`
  (exit 3 fails the build with the bank and each sound's findings) and `ritmo-tools sound render <bank> -o <out>`,
  writing one WAV per sound with a content-hashed name into the generated assets; core `sound` (§4.6) plays them
  by name.
- The review files (`*.sounds.review.json`) are authoring state, never read by the build.
- The Audio editor (EDS.5) edits banks; `audio-synth` (M6.10a, Plus) decides in its own spec whether it adopts the
  recipe format.

**Music (ASSET.3).**
- A song is `content/music/<name>.song.json`. The build runs `ritmo-tools music check <song>` (exit 3 fails it) and
  `ritmo-tools music render <song> -o <out>.wav`, writing a stereo WAV per song (the MIDI file it also writes is
  not shipped). Core `music` (§4.6) and the Plus `audio-stream` (§4.9, M5.8a) play the rendered file.
- `listen` and `review` are authoring commands (a hum, a local page); the build never runs them.

**Determinism.** Two runs over the same inputs must give byte-identical outputs, as for fonts and atlases (§4.7). If
a ritmo-tools render is not byte-stable (`sound vary` takes a `--seed`, but `render` documents none), ASSET.2 and
ASSET.3 record the evidence and hash the WAV's samples instead of its bytes, and say so in their plans.

**Acceptance cases.**
- ASSET-a (ASSET.1). A planted off-palette pixel in an atlas frame fails `automata-content assets` with the file and
  ritmo-tools' finding; the same frame on the palette passes and the atlas is byte-identical to the build without
  the lint.
- ASSET-b (ASSET.1). `automata check --json` reports the planted pixel under a `pixels` step; a game with no
  `pixel.config.json` skips the step.
- ASSET-c (ASSET.1). A content `palette` and an `endesga-64.hex` that differ by one colour fail the build naming it.
- ASSET-d (ASSET.2). A bank with a clipping sound fails the build (exit 3) naming the sound; a clean bank renders one
  WAV per sound, and core `sound` plays one by name in a runtime test with a fake audio context.
- ASSET-e (ASSET.3). A silent song fails the build; a clean song renders a WAV that core `music` loads.
- ASSET-f (ASSET.2, ASSET.3). Two builds over the same banks and songs give identical outputs (bytes, or samples per
  the determinism rule).
- ASSET-g (every row). No AF source file imports `@typeonce/ritmo-tools` (a repo-hygiene check), and its `effect`
  4.x is absent from every published package's dependency graph.
- ASSET-h (ASSET.4). `create-game` output has `@typeonce/ritmo-tools` as an exact-pinned dev dependency with
  `pixel:lint`, `sounds` and `music` scripts; the agent skills name the commands and when the build runs them;
  `tooling/agent-skills` checks stay green.

**Decisions for the Owner's veto.**
- ASSET-D1: the build lints art but never runs the fixer (a build does not rewrite authored inputs).
- ASSET-D2: pin 0.19.1 although it is under 14 days old, because the Owner named it and no older release exists.
- ASSET-D3: Endesga 64 comes from a committed `.hex` file, as ritmo-tools has no preset for it.
- ASSET-D4: the MIDI ritmo-tools writes beside each song is not shipped.

### 4.8 Leaderboards (`packages/runtime/src/leaderboards/`, M5.7)

- `submitScore(board, score)` and `readBoard(board, query)` wrap `Hosting.leaderboards` (PRODUCT.1) for screens, with states `idle`, `submitting`, `accepted` (with `personalBest` and `rank`), `refused`, `unavailable`, `offline`.
- A board name not declared in the game's ship config `leaderboards` fails `automata check` and `ship prepare` with the call site's board name (a typed `BoardId` from config).
- `UNSUPPORTED` (no grant, or standalone) shows "Scores aren't available here"; `OFFLINE` shows "You're offline". AF never keeps a local board instead (host authority).
- The score is whatever the game computes from sim state (FloorFifty `scores.ts`: never typed by a person, R-80). Ruken checks the range server-side; AF does not restate `min`/`max` beyond writing them into the manifest.

### 4.9 `audio-stream` (Plus, M5.8)

From FloorFifty `managers/audio/{deck (689), song-bridge (268), menu-stream (175), song-preloader (63), diagnostics (449)}.ts`, `docs/ipad-audio-check.md`, and tests `audio-streaming`, `audio-song-bridge`, `audio-song-preload`, `audio-diagnostics`:
- Streams long music through a media element into `AudioBuses.input('music')`, never the destination, so player gains and host ducking apply. The game CSP already allows `media-src 'self' blob:` (`@ruken/manifest` `compileHeaders`).
- Decode-behind: a stream plays at once and swaps to the decoded buffer for seamless loops when it is ready.
- A song preloader on the `Assets` stall rule; a menu stream; iPad unlock diagnostics as a dev overlay.
- Registered with `defineExtension`; edits no core file; lives in `automata-plus` (PRODUCT.5).

## 5. Data and lifecycle flows

**Boot** (after M1.5's step 3, storage and settings):
1. The `Save` service reads `Hosting.saves.keys`, then each slot's envelope header, into `slots`. Nothing is migrated yet.
2. Device-part settings load from `DeviceStorage`; the audio graph is not built.
3. After `session.ready`, the first gesture unlocks audio.

**Load a slot:** read → migrate → parse → if a snapshot is present and its content hash equals the build's, `restore`; if it differs, the slot is `other-content` and loads only its `data` (M5-D5) → `save.loaded` fact.

**Play and autosave:** the game calls `touch(() => toSave(sim))` when its progress changes; a trigger writes the canonical envelope if it differs from the last one.

**Exit (Ruken `session.exiting`):** the existing handler in `hosting-live.ts` flushes saves. M5 adds one step before it: `Save.flushPending` writes any dirty slot into the SDK, then `Hosting.saves.flush` runs, all inside `HOST_EXIT_CAP`. Anything later is lost only if the host's grace ends first, which Ruken's outbox already reports.

**Cross-device resume:** device A writes and flushes; the player opens the game on device B; B's welcome snapshot carries A's value; B's slot list shows it. Proven under the fake host with two sessions on one `FakeSavesServer` (S-c).

**Change while running (`saves.changed`):**
- On a menu or the slot list: the slot list re-reads that key; a loaded slot that changed is reloaded only when the player next picks it.
- During play of that slot: the change is held, a Toast says "Your progress changed on another device", and the next pause screen offers Load newer or Keep playing (M5-D6). Keep playing overwrites on the next write, as a normal write would.

**Conflict (`SavesStatus` `conflict`):** the host shell asks the player and calls `resolveConflict`; AF shows the status and waits for `changed`. AF never writes the losing side back.

**Lifecycle background:** autosave (`background`) writes and flushes; audio sleeps. **Foreground:** audio wakes; nothing reloads unless `changed` arrived.

**Restart and dispose:** closing the runtime scope cancels the autosave timer after one final `flushPending`, closes the `AudioContext`, and removes every listener.

## 6. Failure policy

| Case | Result |
|---|---|
| A slot's migration step is missing or throws, or the parse fails | `unreadable`: shown as "This save can't be opened", kept untouched; the player may delete it or write over it explicitly; autosave never touches it |
| A slot from a newer build | `newer`: read-only, "Saved by a newer version of the game"; no write, autosave or delete without explicit confirmation |
| A snapshot whose content hash differs from the build's | `other-content`: loads `data` only; the snapshot is dropped on the next write (M5-D5) |
| `saves.set` fails `QUOTA_EXCEEDED` | `save.failed`; Toast "This save is too big to store"; the previous value is unchanged (Ruken's save map checks before it writes) |
| `saves.*` fails `OFFLINE` or a retryable code | The SDK queues it (`offline-queued`, `retry`); the status indicator says so; AF does not retry on its own |
| No `saves` grant | Writes relay the SDK's behavior (known: `setItem` succeeds into memory and `flush` fails `UNSUPPORTED`, already reported to Ruken, shared contracts §1.3); the status shows "Progress won't be kept"; no device fallback |
| `DeviceStorage` blocked | Device fields hold for the session; never written to the account |
| `AudioContext` cannot be created or resumed | `audio.unavailable` fact; the game runs silent; the Audio section says "Sound isn't available on this device" |
| A sound fails to decode | `audio.decode.failed`; that sound is silent; nothing else stops |
| A font source hash differs or a glyph is missing | Build fails with the file, the character and the message location |
| An atlas frame is not a PNG, is larger than a page, or has an off-palette pixel | Build fails naming the file |
| A board name not in config | `automata check` / `ship prepare` fails naming the board |
| Leaderboard `UNSUPPORTED` or `OFFLINE` | The named UI state; never a local board |

## 7. UI inventory and states

Built from `ui` primitives (M1.6) and M4's (draft) Slider, Toggle, Toast and Settings screen.

| Component | States | Focus and input | Host-aware |
|---|---|---|---|
| `SaveSlots` (list) | loading, empty slot, ready (label, saved time via PRODUCT.L `Intl` formatting), unreadable, newer, other-content, writing, failed | ScrollList; each slot a 48 px row; Delete behind a Dialog | Hidden "Delete" on `newer` unless confirmed |
| `SaveStatus` indicator | checking, syncing, saved, offline-queued, retry, conflict ("Choose which progress to keep" points to the host), recovered, unavailable (no grant) | Not focusable; polite live region | Hidden standalone where the SDK's standalone session has nothing to sync |
| Audio settings section | master, music, sfx, ui, voice sliders; mute; mute when unfocused; unavailable | Slider with `adjust` (M4); 44 px thumbs | Says "The host's volume also applies" when `audio.master` is below 1 |
| Changed-elsewhere Toast and pause choice | shown, Load newer, Keep playing | Pause screen buttons | — |
| `LeaderboardPanel` | loading, entries (with "you"), empty, unavailable, offline | ScrollList; entries not focusable except the action row | `UNSUPPORTED` copy |

Every visible string is a PRODUCT.L message key; every component has a renderer-free fixture, DOM tests and a layout contract.

**Owner amendment, 2026-10-18 (Settings groups):** "Language, Audio and Vibration should also be in AF." Each is a required framework Settings group beside Display, matching FloorFifty's layout and function, built in the Settings and Pause redo (steps 9 to 11):
- **Language:** Automatic, then the game's locales by endonym (PRODUCT.L's `Locale.set`).
- **Audio:** as above, with a sample sound on a volume's release, and Mute in Pause.
- **Vibration:** one toggle over a framework haptics API (`Haptics`: a pad's rumble, else a phone's buzz), hidden where the device can do neither.

## 8. Responsive and input inventory

| Situation | Policy |
|---|---|
| Phone portrait and compact landscape (780×270) | SaveSlots and LeaderboardPanel are ScrollLists inside ScreenFrame; the slot actions stay in the ActionBar; nothing essential below the fold |
| Long labels and `xx-long` | Slot labels and times wrap to two lines then truncate with the full text in the accessible name; targets never shrink |
| `scale` 1.333 | Rows and sliders scale with `--af-scale` |
| `hostReserved`, keyboard (slot naming) | The geometry owner's rules; the label field stays visible with the keyboard up |
| Keyboard, gamepad, touch | All controls reachable by M4's focus navigation; sliders adjust with D-pad left/right |

## 9. Test allocation

| Layer | Where | What it proves |
|---|---|---|
| Unit (Node, `test:unit`) | `runtime/save`, `runtime/audio`, `runtime/settings`, `runtime/leaderboards`, `content/assets` | Migration chains N→N+1→N+2; missing and throwing steps; newer-version refusal; passthrough fields; canonical envelope bytes; unchanged autosave sends nothing; autosave triggers and interval with `TestClock`; serialized writes; device fields never reach `Hosting.saves`; audio graph gains (player × host × mute) on a fake `AudioContext`; unlock idempotence; sleep and wake rules; voice cap; board-name check; subset and atlas determinism (byte-identical runs); missing glyph; off-palette pixel. Ported FloorFifty tests: `progress`, `progress-store`, `settings-bridge`, `audio`, `audio-decode-context`, `ruken/audio-host-gain`, `ruken/sleep-hosted`, `ruken/settings-hosted`, `ruken/scores*`, `i18n/fonts` (behavior specs) |
| Host contract (`@ruken/sdk-host` fake host) | `packages/host` | `keys` and `changed`; a second device's `remoteWrite` arrives as `changed`; `resolveConflict('theirs')` arrives as `changed`; quota relayed |
| Fake-host integration | `packages/runtime` | Exit flush includes `flushPending`; save → exit → new session on the same `FakeSavesServer` resumes the slot (S-c); changed-while-playing flow |
| Parity | `packages/runtime` | A save made from a sim and loaded through `restore` gives the same `hash()` in Node, Chromium, WebKit and Firefox |
| Real browser (Chromium, WebKit, Firefox) | `packages/runtime` browser project | A real `AudioContext` unlocks on a synthetic gesture and its master gain equals the product; `OfflineAudioContext` renders a ducked bus at the expected level |
| DOM and layout | `packages/ui` | SaveSlots, SaveStatus, Audio section, LeaderboardPanel states, at every reference size and variant |
| E2E under the fake host | examples `core/core-saves.ts`, `audio/audio-sound.ts`, `core/core-leaderboard.ts` | Save, reload, resume; audio unlock journey with zero console errors and zero CSP violations; leaderboard submit and offline |
| Device and Owner | real devices on Ruken's local stack | Owner acceptance only (§13) |

## 10. Feedback workflow

- Focused first: `pnpm --filter @mcthaydt/automata-runtime exec vitest run src/save/<file>`; the content asset tests with fixture fonts and PNGs checked into `packages/content/src/assets/fixtures/`; one example with `CI=1 pnpm exec playwright test <spec> --project=<cell>`.
- Fixtures: a 3-version `SaveDef` with a migration per step; a saved envelope per state (empty, ready, unreadable, newer, other-content); a small OFL test font and a two-locale message set; a 4-frame PNG set and one off-palette PNG.
- Browser readiness waits on `session.ready`, the unlock fact and an animation frame; never a sleep.
- Full local gate before each PR: `pnpm check` and `pnpm test:parity` under the heavy-gates lock, plus `pnpm test:e2e` for runtime, ui or example changes.

## 11. Ruken alignment and requests

| Behavior | Ruken contract (vendored, `b30d31b`) |
|---|---|
| Save storage, limits, queueing, status | `SavesApi` (`storage`, `status`, `flush`, `on('status' / 'changed')`); the SDK's save map enforces the limits (AF quotes none) |
| Conflicts between devices | The host's saves engine and shell (`HostBridge.resolveConflict`); the game sees `saves.changed` |
| Exit | `session.exiting`, the host's grace; AF's flush inside `HOST_EXIT_CAP` |
| Audio volume and focus | `AudioApi` (`focus`, `master`, `gain`: "multiply your own mix by this") |
| Leaderboards | `LeaderboardsApi`, the manifest's `[leaderboards]` (`order`, `min`, `max`) |
| Fonts and media under CSP | `compileHeaders`: `font-src 'self' data:`, `media-src 'self' blob:` |

**Requests to Ruken** (numbered after M4's R-1 to R-4; the Owner files them):
- **R-5.** Export the save limits and the key pattern from `@ruken/sdk` (the save map's value, key-count and total limits and `SAVE_KEY_RE`), so AF can show "too big" before queueing instead of only relaying the error.
- **R-6.** A host-owned device scope for saves (for example `saves.device`), so per-device settings such as audio levels go through the SDK instead of the frame's `localStorage`.
- **R-7.** Document what a game should expect around `conflict` and `recovered`: whether `saves.changed` fires for the side the player chose in every case, and what `getItem` returns while a conflict is open. Read from the fake host here (`settleConflict`, `resolveConflict`); not verified against Ruken's server or docs (no RukenApp checkout in this environment).
- Already filed (shared contracts §1.3): without the `saves` grant, `setItem` succeeds into memory; M5's status shows "Progress won't be kept" until Ruken changes it.

## 12. Tasks

| ID | Task | Lane | Depends on | Deliverable and acceptance |
|---|---|---|---|---|
| M5.0 | This spec, reviewed | integration | M4.0 reviewed | Owner review; M5-D1 to M5-D10 confirmed or changed |
| M5.1 | `Hosting.saves.keys` and `changed`; `SaveDef`, migrations and the `Save` service | host, runtime | M5.0 | §4.1–§4.3; example `core/core-saves.ts` (EX's planned name); S-a, S-b, S-e, S-f |
| M5.2 | Autosave, exit flush, cross-device changes, per-device settings, SaveSlots and SaveStatus UI | runtime, ui | M5.1, M4.4, M4.6 | §4.4, §4.5, §5, §7; S-c, S-d, S-g |
| M5.3 | Core audio graph, unlock, sleep and wake, host gain, `sound`, `music`, ducking | runtime | M5.0, PRODUCT.1 | §4.6; example `audio/audio-sound.ts`; A-a to A-d |
| M5.4 | Audio settings section | ui | M5.3, M4.4, M4.6 | §7; A-e |
| M5.5 | Font subsetting and the glyph-coverage gate | content | M5.0, PRODUCT.L content side | §4.7 Fonts; G-a, G-b (with PRODUCT.L's L-e) |
| M5.6 | Atlas packing and palette check | content | M5.0 | §4.7 Atlases; example `textures/textures-atlas.ts`; G-c, G-d |
| M5.7 | Leaderboard flow | runtime, ui | M5.0, PRODUCT.1 | §4.8; example `core/core-leaderboard.ts`; L-a, L-b |
| M5.8 | `audio-stream` (Plus, after core) | audio-stream | M5.3, PRODUCT.5 | §4.9 in `automata-plus`; its fixture game and tests |

Order: M5.1, M5.5, M5.6 start at once; M5.3 and M5.7 after PRODUCT.1 merges; M5.2 and M5.4 after M4.4 and M4.6; M5.8 last.

## 13. Exit criteria and acceptance cases

**Success:**
- **S-a.** A save written by `SaveDef` version 1 loads on version 3 through steps 1→2 and 2→3, and the loaded data equals the fixture's expected value.
- **S-b.** Writing the same state twice sends one `saves.set` (canonical envelope unchanged).
- **S-c.** Under the fake host, session A writes slot 1 and exits (flush awaited); session B on the same `FakeSavesServer` lists slot 1 with A's label and loads equal data. The Owner repeats this on two real devices on Ruken's local stack (Owner gate).
- **S-d.** `lifecycle` to background with a dirty slot writes it and calls `flush` once.
- **A-a.** Before a gesture no `AudioContext` exists; after the first `pointerdown` exactly one exists and is `running`.
- **A-b.** Master gain equals player master × `Hosting.audio.gain`; a host focus `ducked` change updates it without the game's code.
- **A-c.** A hidden page suspends a running context and cancels queued one-shots; becoming visible resumes it; a context never unlocked stays unbuilt.
- **A-d.** The seventeenth overlapping `sound` stops the oldest voice.
- **G-a.** Two subset runs over the same sources give byte-identical `woff2` files.
- **G-c.** Two atlas runs over the same frames give byte-identical PNG and JSON.
- **L-a.** `submitScore` on a declared board under the fake host returns `accepted` with `personalBest`.

**Failure cases that must be shown by tests:**
- **S-e.** A version-4 save opened by a version-3 build is `newer`, and no write, autosave or migration changes its bytes.
- **S-f.** A missing migration step makes the slot `unreadable` and leaves its bytes unchanged.
- **S-g.** With device storage throwing, a changed music volume holds for the session and never appears in `Hosting.saves`.
- **A-e.** `AudioContext` construction throwing yields `audio.unavailable`, a silent game and the Audio section's unavailable state.
- **G-b.** A message containing a character missing from its locale's subset fails the build with the message's `file:line:col` and the code point.
- **G-d.** An off-palette pixel fails the atlas build naming the file and pixel.
- **L-b.** A board not declared in config fails `ship prepare`; `OFFLINE` from the fake host shows the offline state and keeps no local score.

**Gates reported separately:** implemented; locally verified (`pnpm check`, `pnpm test:parity`, the local E2E cells); GPU-runner verified (phone and tablet cells); Owner accepted. **Owner acceptance (never ticked by an agent):** cross-device save, exit and resume on two real devices on Ruken's local stack; sound unlock and host volume on a real iPhone and a real Android phone; one real Ruken conflict resolved through the host shell, with devices, browsers and dates recorded.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Ruken's conflict semantics are only known from the fake host | R-7; S-c and the conflict tests run on the fake host's real engine; an Owner device gate on the real stack |
| Saves grow past Ruken's limits (snapshots in saves) | Snapshots are optional and dropped across content changes (M5-D5); quota is a named state; R-5 for preflight |
| iOS audio unlock quirks | FloorFifty's unlock rules (both calls inside the gesture) and its iPad diagnostics (Plus); a real iPhone is an Owner gate |
| A deterministic packer that is slow on large sets | Atlas inputs are per screen; the build caches by input hash |
| `subset-font` (harfbuzz wasm) cost in CI | Build time only; outputs cached by input hash; never in a game bundle |
| Device-only settings look like the forbidden device fallback | Declared per field (`deviceFields`), never used for a denied capability, and R-6 moves it behind the host |

## 15. Open decisions (recommended defaults in effect until the Owner reviews)

| ID | Question | Recommended default | Why |
|---|---|---|---|
| M5-D1 | Do Save and Audio move to their own core packages? (master spec §4.1 left it to M4/M5) | **No.** `runtime/src/save/` and `runtime/src/audio/`; the asset build in `content/src/assets/` | PRODUCT.1 put `AudioBuses` in `runtime`; the asset build is build-time content work like the preload list |
| M5-D2 | Slot storage layout | **One Ruken key per slot**, self-describing envelope, list from `Hosting.saves.keys`; no index key | Ruken resolves conflicts per key; an index key could disagree with its slots after a conflict |
| M5-D3 | The bus set | **Add `voice`** to PRODUCT.1's `master`, `music`, `sfx`, `ui`, before PRODUCT.1 merges | FloorFifty has a voice bus and an announcer volume; adding it after PRODUCT.1 publishes would be an API change (PRODUCT spec F6) |
| M5-D4 | Per-device settings | **Allowed for declared fields** (`deviceFields`), audio levels and mute by default in the core Audio section | FloorFifty's Owner rule (2026-10-10); not a fallback; R-6 to move it behind the host |
| M5-D5 | Sim snapshots in saves | **Optional.** Restored only when the content hash matches; otherwise the slot loads its `data` and drops the snapshot on the next write | Game data survives content updates; snapshots give exact resume within one build |
| M5-D6 | Another device changed the slot being played | **Hold it**; Toast; offer Load newer or Keep playing at the next pause | Never yank state mid-play; never silently discard the other device's progress |
| M5-D7 | Font sources | **Committed by the game** (OFL allows it) with sha256 in `fonts.toml`; subsets generated at build | Reproducible builds without network access in CI |
| M5-D8 | Atlas packer | **A small deterministic packer in AF** (sorted inputs, fixed padding, power-of-two pages ≤ 2048) with `pngjs`; no new packing dependency | Byte-identical output is a requirement; one fewer dependency to pin and audit |
| M5-D9 | `music` in core versus `audio-stream` | **Core plays decoded music** (short loops, menu beds); **streaming is Plus** | raylib's `music` verb is core (PRODUCT spec §7); FloorFifty's streaming deck is the Plus part |
| M5-D10 | Autosave defaults | **On** `screen-exit`, `round-end` and `background`; **interval off** unless the game sets it | Covers the exits that lose progress without spending Ruken's write budget on a timer |
