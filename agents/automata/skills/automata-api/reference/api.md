# Automata API reference, version 0.0.5

> Every export of every published `@automata/*` entry point at version 0.0.5, generated from the published `.d.ts` files. An export that is not listed here does not exist in this version.

## `@automata/audio-synth`

### `import { … } from '@automata/audio-synth'`

#### `audioContent` (const)

The `audio` content kind: `content/audio/*.toml` holds a game's cues, beds, event map, ducking
and music.

```ts
const audioContent: ContentSchemaDef<"audio", z.ZodType<AudioContent>>;
```

#### `AudioContent` (interface)

A game's whole `audio` content: master gain, cues, beds, the map from sim events to cues, the
ducking rules, and the music slots and rules.

```ts
interface AudioContent {
  readonly master_gain?: number | undefined;
  readonly cue?: readonly Cue[] | undefined;
  readonly bed?: readonly Bed[] | undefined;
  readonly event?: readonly EventRow[] | undefined;
  readonly duck?: readonly DuckRule[] | undefined;
  readonly slot?: readonly Slot[] | undefined;
  readonly music_rule?: readonly MusicRule[] | undefined;
}
```

#### `audioSchema` (const)

The Zod schema of the `audio` content. Every reference (a cue an event plays, a slot a rule
picks) is checked at its path.

```ts
const audioSchema: z.ZodType<AudioContent>;
```

#### `AudioSynth` (interface)

The audio runtime. Tell it what the sim did with `hear`, play what the picture has reached with
`frame`, and start or stop looping beds.

```ts
interface AudioSynth {
  /** The events the step at `tick` produced. */
  hear(tick: number, events: readonly SimEvent[]): void;
  /** Plays what the drawn tick has reached. `listener` pans world cues. */
  frame(drawnTick: number, listener?: Listener | null): {
    readonly played: readonly string[];
  };
  /** Plays the cue called `id` now, on its bus; false when the table has no such cue. */
  play(id: string, at?: {
    readonly x: number;
    readonly z: number;
  }): boolean;
  startBed(id: string): void;
  stopBed(id: string): void;
  /** The beds playing, in the order they started. */
  playing(): string[];
}
```

#### `audioSynthExtension` (const)

The audio-synth extension a game opts into. It registers the `audio` content kind.

```ts
const audioSynthExtension: ExtensionDef<"audio-synth">;
```

#### `AudioSynthOptions` (interface)

What `createAudioSynth` needs: the audio table (read at each event, so a reload shows), the port
into the game's buses, an optional seed and how many ticks behind the picture an event is still
answered.

```ts
interface AudioSynthOptions {
  /** The audio table; read at each event, so a reload shows on the next one. */
  readonly content: () => AudioContent;
  readonly port: MixerPort;
  /** The most ticks behind the picture an event is still answered (default 30). */
  readonly staleTicks?: number | undefined;
  readonly seed?: number | undefined;
}
```

#### `Bed` (interface)

A looping bed: steady drones, optional filtered noise and an optional slow pulse.

```ts
interface Bed {
  readonly id: string;
  readonly about?: string | undefined;
  readonly bus: BusId;
  /** The bed's own gain, before its fade and bus. */
  readonly volume: number;
  readonly drones: readonly {
    readonly wave: Wave;
    readonly freq: number;
    readonly volume?: number | undefined;
  }[];
  readonly noise?: {
    readonly freq: number;
    readonly q: number;
    readonly volume: number;
  } | undefined;
  /** Amplitude pulse: `rate` Hz, `depth` 0..1. */
  readonly pulse?: {
    readonly rate: number;
    readonly depth: number;
  } | undefined;
  readonly draft?: boolean | undefined;
}
```

#### `BUSES` (const)

Every audio bus, in order.

```ts
const BUSES: readonly BusId[];
```

#### `BusId` (type)

One of the four audio buses: music, sfx, ui and voice.

```ts
type BusId = "music" | "sfx" | "ui" | "voice";
```

#### `Candidate` (interface)

A file that would play for a slot, with its final level.

```ts
interface Candidate {
  readonly sound: string;
  readonly volume: number;
  readonly filter?: FilterId;
  /** True for a placeholder, false for the slot's own file. */
  readonly placeholder: boolean;
}
```

#### `Condition` (type)

What a music rule asks of one key of the game's state: an exact value, one of a list, or within
`atLeast` and `atMost`.

```ts
type Condition = StateValue | readonly StateValue[] | {
  readonly atMost?: number | undefined;
  readonly atLeast?: number | undefined;
};
```

#### `coverage` (function)

Every event the game declares, with where it comes from, against the event map: cued, silent with a reason, or missing.

```ts
function coverage(content: Pick<AudioContent, "event">, wanted: ReadonlyMap<string, string>): Coverage;
```

#### `Coverage` (interface)

Whether every event a game can produce is answered: `missing` lists events with no row, and
`silent` lists events that are silent on purpose, with the reason.

```ts
interface Coverage {
  readonly ok: boolean;
  /** Events a game declares that no row answers. */
  readonly missing: readonly {
    readonly event: string;
    readonly from: string;
  }[];
  readonly silent: readonly {
    readonly event: string;
    readonly why: string;
  }[];
  readonly events: number;
  readonly cued: number;
}
```

#### `createAudioSynth` (function)

Starts the audio runtime. Sim events are answered when the drawn picture reaches their tick,
once each, with the cue the event map names.

```ts
function createAudioSynth(options: AudioSynthOptions): AudioSynth;
```

#### `createMixer` (function)

Makes a mixer that plays into the buses the game already has. It never makes an audio context or
a bus of its own.

```ts
function createMixer({ port, ducks, master }: MixerOptions): Mixer;
```

#### `createMusicDirector` (function)

Turns the rows' answer into the slot to play. A slot with a `linger` holds that many seconds after its state ends, so a
pursuer losing the player for a moment does not cut the chase. Silence and a `relief` slot take over at once, and `hold`
(an overlay) keeps what plays and leaves the linger clock where it was. Every other change is at once.

```ts
function createMusicDirector(options: MusicDirectorOptions): MusicDirector;
```

#### `Cue` (interface)

A short sound as a recipe of voices, played on a bus. A world cue is panned and made quieter
with distance from the listener, and a draft cue is a placeholder until the audio pass replaces
it.

```ts
interface Cue {
  readonly id: string;
  /** One line: what the player hears, and when. */
  readonly about?: string | undefined;
  readonly bus: BusId;
  readonly voices: readonly Voice[];
  /** A core sound alias played through `Audio.sound` in place of the voices once it is loaded. */
  readonly sound?: string | undefined;
  /** A world sound: panned and attenuated from the listener when the caller passes a position. */
  readonly world?: boolean | undefined;
  /** Played on its bus without the ducking that bus normally causes. */
  readonly no_duck?: boolean | undefined;
  /** Not final: a placeholder until the audio pass replaces it. */
  readonly draft?: boolean | undefined;
}
```

#### `cueLength` (function)

Seconds from a cue's start to its last voice's end (a tone rings 0.05 s past its ramp).

```ts
function cueLength(cue: Pick<Cue, "voices">): number;
```

#### `dbToGain` (const)

Turns decibels into a gain multiplier: -6 dB is about half.

```ts
const dbToGain: (db: number) => number;
```

#### `DISTANCE` (const)

Distance model: full level within `ref` metres, then ref / (ref + rolloff · (d − ref)).

```ts
const DISTANCE: {
  readonly ref: number;
  readonly rolloff: number;
};
```

#### `DuckRule` (interface)

While a cue on `bus` plays, each bus in `duck` drops by `db`, then recovers.

```ts
interface DuckRule {
  readonly bus: BusId;
  readonly duck: readonly BusId[];
  readonly db: number;
  readonly attack: number;
  readonly release: number;
}
```

#### `EventRow` (interface)

A sim event id or a `*` pattern, and the cue it plays or the reason it plays none.

```ts
interface EventRow {
  readonly on: string;
  readonly cue?: string | undefined;
  readonly silent?: string | undefined;
}
```

#### `Fallback` (interface)

A music file standing in for a slot: `volume` multiplies the slot's, `filter` colours it.

```ts
interface Fallback {
  readonly sound: string;
  readonly volume?: number | undefined;
  readonly filter?: FilterId | undefined;
}
```

#### `FilterId` (type)

The colour a music file can be given. Only `radio` exists.

```ts
type FilterId = "radio";
```

#### `FILTERS` (const)

The cut-off frequencies of each filter: `radio` removes everything below 450 Hz and above 3000
Hz.

```ts
const FILTERS: Readonly<Record<FilterId, {
  readonly highpass: number;
  readonly lowpass: number;
}>>;
```

#### `holds` (function)

Whether `value` satisfies `want`: equal, one of a list, or within `atLeast`/`atMost`.

```ts
function holds(want: Condition, value: StateValue | null | undefined): boolean;
```

#### `Listener` (interface)

Where the ears are: the camera's ground position and yaw (0 looks toward −z, right is +x).

```ts
interface Listener {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}
```

#### `Mixer` (interface)

Plays cues on their buses with ducking and, for world cues, panning and distance. `listener`
says where the ears are.

```ts
interface Mixer {
  play(cue: Cue, options?: PlayOptions): void;
  listener(l: Listener | null): void;
}
```

#### `MixerOptions` (interface)

What `createMixer` needs: the port into the game's audio buses and the ducking rules.

```ts
interface MixerOptions {
  readonly port: MixerPort;
  readonly ducks: readonly DuckRule[];
  /** The overall volume, 0..1 (`master_gain`): every cue is played through a gain of it. Full when left out. */
  readonly master?: number | undefined;
}
```

#### `MixerPort` (interface)

What the mixer needs of core: a node to connect a source to for a bus, and a duck.

```ts
interface MixerPort {
  /** `AudioBuses.input(bus)`: the node a source connects to so that it plays on `bus`. */
  input(bus: BusId): AudioNode;
  /** `Audio.duck(bus, amount, seconds)`: takes `bus` down by `amount` (0..1) for `seconds`. */
  duck(bus: BusId, amount: number, seconds: number): void;
}
```

#### `MusicDirector` (interface)

Chooses which music slot plays as the game's state changes. `step` moves it forward by some
seconds and `slot` is what plays now, or nothing.

```ts
interface MusicDirector {
  /** Steps `dt` seconds with `state`; returns the slot to play (null for none). */
  step(state: MusicState, dt: number): string | null;
  readonly slot: string | null;
}
```

#### `MusicDirectorOptions` (interface)

The slots and rules a music director chooses from.

```ts
interface MusicDirectorOptions {
  readonly slots: readonly Slot[];
  readonly rules: readonly MusicRule[];
}
```

#### `MusicRule` (interface)

Picks a music slot when every key in `when` holds. The slot is a slot id, `hold` to keep what
plays or `silence` to play nothing.

```ts
interface MusicRule {
  /** Every named key must hold: equal to a value, one of a list, or within `atLeast`/`atMost`. */
  readonly when: Readonly<Record<string, Condition>>;
  /** A slot id, `hold` (keep what plays) or `silence` (play nothing). */
  readonly slot: string;
  readonly why?: string | undefined;
}
```

#### `MusicState` (type)

What the rules read: a flat record. A key the state lacks never satisfies a condition that names it.

```ts
type MusicState = Readonly<Record<string, StateValue | null | undefined>>;
```

#### `noiseBuffer` (function)

Seeded white noise (the Park–Miller generator, seed 7): every hiss is the same noise.

```ts
function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer;
```

#### `PAN_WIDTH` (const)

How far a sound fully to one side pans (1 would silence the other ear).

```ts
const PAN_WIDTH = .8;
```

#### `playCue` (function)

Plays a cue's voices at `when`.

```ts
function playCue(ctx: BaseAudioContext, out: AudioNode, cue: Pick<Cue, "voices">, when?: number, random?: () => number): void;
```

#### `PlayOptions` (interface)

How to play one cue: where it sounds, when to start it in audio-context seconds, a random source
and how long it holds a duck.

```ts
interface PlayOptions {
  readonly at?: {
    readonly x: number;
    readonly z: number;
  } | undefined;
  /** Context seconds; now by default. */
  readonly when?: number | undefined;
  readonly random?: (() => number) | undefined;
  /** Seconds the cue holds a duck; the cue's length by default. */
  readonly length?: number | undefined;
}
```

#### `playVoice` (function)

Schedules one voice at `when` (context seconds) into `out`. `random` picks a hiss centre from a range.

```ts
function playVoice(ctx: BaseAudioContext, out: AudioNode, voice: Voice, when: number, random?: () => number): void;
```

#### `resolveSlot` (function)

What plays for `slot`, best first: its own file, then each fallback that exists. Empty when none does (silent).

```ts
function resolveSlot(slot: Slot, available: ReadonlySet<string>): Candidate[];
```

#### `rowFor` (const)

The first row of the event map that matches `event`.

```ts
const rowFor: (content: Pick<AudioContent, "event">, event: string) => EventRow | undefined;
```

#### `Slot` (interface)

One piece of music the game can switch to. It loops or plays once, has a level, and may fade in,
cross-fade at its seam, delay, linger after its state ends or be a place of relief.

```ts
interface Slot {
  readonly id: string;
  readonly about?: string | undefined;
  /** `loop` repeats until the state moves on; `once` plays through and then the slot is silent until it is wanted again. */
  readonly mode: "loop" | "once";
  /** Its level, 0..1, before the music bus's volume setting. */
  readonly volume: number;
  /** The core sound alias of its own file; its id when unset. */
  readonly sound?: string | undefined;
  /** Seconds to crossfade in (2 by default). */
  readonly fade?: number | undefined;
  /** Seconds of crossfade at a loop's seam. */
  readonly seam?: number | undefined;
  /** Seconds before it starts to sound, so an effect on the same moment lands first. */
  readonly delay?: number | undefined;
  /** A place of relief: a chase does not linger into it. */
  readonly relief?: boolean | undefined;
  /** Diegetic: its file runs on while the slot is not heard. */
  readonly resume?: boolean | undefined;
  /** Seconds the slot holds after its state ends, in play only. */
  readonly linger?: number | undefined;
  /** The placeholders to play while the slot's own file does not exist, best first. */
  readonly fallback?: readonly Fallback[] | undefined;
}
```

#### `slotFor` (function)

The slot `state` calls for: the first row that matches wins, so the order is the priority. `hold` and `silence` come back as themselves.

```ts
function slotFor(rules: readonly MusicRule[], state: MusicState): string | undefined;
```

#### `slotsFor` (function)

The loops the rows play when `state[key]` is `value`, best first: for loading ahead of the scene.

```ts
function slotsFor(rules: readonly MusicRule[], slots: readonly Slot[], key: string, value: StateValue): string[];
```

#### `Spatial` (interface)

How a world sound reaches the listener: a pan from -0.8 (left) to 0.8 (right) and a gain that
falls with distance.

```ts
interface Spatial {
  readonly pan: number;
  readonly gain: number;
}
```

#### `spatial` (function)

Pan and distance gain of a world sound at `at` for `listener`.

```ts
function spatial(listener: Listener, at: {
  readonly x: number;
  readonly z: number;
}): Spatial;
```

#### `startBed` (function)

Starts a bed into `out`; returns its stop function.

```ts
function startBed(ctx: BaseAudioContext, out: AudioNode, bed: Bed): (at?: number) => void;
```

#### `StateValue` (type)

A value a music rule can test: text, a number or a yes-or-no.

```ts
type StateValue = string | number | boolean;
```

#### `Voice` (interface)

A tone (`tone`, `from`, `to`) or a hiss (`hiss`, `q`), `at` seconds in, `length` long, at `volume`.

```ts
interface Voice {
  readonly tone?: Wave | undefined;
  readonly from?: number | undefined;
  readonly to?: number | undefined;
  readonly hiss?: number | readonly [number, number] | undefined;
  readonly q?: number | undefined;
  readonly at?: number | undefined;
  readonly length: number;
  readonly volume: number;
}
```

#### `Wave` (type)

The shape of a tone: sine, square, sawtooth or triangle.

```ts
type Wave = "sine" | "square" | "sawtooth" | "triangle";
```

#### `WAVES` (const)

Every tone shape.

```ts
const WAVES: readonly Wave[];
```

### `import { … } from '@automata/audio-synth/browser'`

#### `Renderers` (interface)

The offline renderers the page offers the audio pipeline: a cue, a bed, a mix and the ducking
demonstration, each answering plain number arrays.

```ts
interface Renderers {
  cue(content: AudioContent, id: string, options: CueRenderOptions): Promise<number[][]>;
  bed(content: AudioContent, id: string, seconds: number): Promise<number[][]>;
  mix(content: AudioContent, mix: MixSpec): Promise<number[][]>;
  duck(content: AudioContent, options: DuckRenderOptions): Promise<number[][]>;
}
```

### `import { … } from '@automata/audio-synth/measure'`

#### `ClickOptions` (interface)

How strict the click check is: the smallest second difference that counts (`floor`) and how far
it must stand out from its neighbours (`ratio`).

```ts
interface ClickOptions {
  readonly floor?: number;
  readonly ratio?: number;
}
```

#### `clicks` (function)

Clicks: a second difference that stands out of everything around it. A sample is a click when
|x[n] - 2x[n-1] + x[n-2]| exceeds `floor` and `ratio` times the largest second difference in the 30 ms on either side (the 1 ms
around the sample left out). A waveform's own edges (a saw's reset, a square's step, from 34 Hz up) repeat inside that window and
pass, and so does noise. A sound starting out of silence (the 30 ms before it under -80 dBFS) is an attack, not a click:
percussive cues start hard on purpose. An isolated step, dropout or cut inside a sound does not pass.

```ts
function clicks(x: Float32Array, rate: number, { floor, ratio }?: ClickOptions): number[];
```

#### `decay` (function)

RT60 measured from a decaying tail starting at `from`: the level in 10 ms windows, a straight line fitted to it from 5 dB below
its start to 25 dB below (a T20), extended to 60 dB. `null` when the tail is too short or too quiet to measure.

```ts
function decay(x: ArrayLike<number>, from: number, rate: number): number | null;
```

#### `decodeWav` (function)

Decodes a 16-bit PCM WAV. Throws on anything else: the pipeline writes only this.

```ts
function decodeWav(bytes: Uint8Array): Wav;
```

#### `encodeWav` (function)

Encodes `channels` (equal length, -1..1; anything outside is clamped) as a 16-bit PCM WAV.

```ts
function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array;
```

#### `integratedLoudness` (function)

Integrated loudness in LUFS (gated), `null` when the signal is shorter than one 400 ms block, `-Infinity` when all is gated out.

```ts
function integratedLoudness(channels: readonly Float32Array[], rate: number): number | null;
```

#### `rms` (function)

The root mean square of `x[from..to)`.

```ts
function rms(x: ArrayLike<number>, from: number, to: number): number;
```

#### `truePeak` (function)

True peak in dBTP: the sample peak of a 4x windowed-sinc upsampling. `-Infinity` for silence.

```ts
function truePeak(channels: readonly Float32Array[]): number;
```

#### `Wav` (interface)

A decoded WAV file: its sample rate and one array of samples between -1 and 1 for each channel.

```ts
interface Wav {
  readonly sampleRate: number;
  readonly channels: Float32Array[];
}
```

### `import { … } from '@automata/audio-synth/render'`

#### `CueRenderOptions` (interface)

How to render one cue: how many seconds, and optionally where it sounds and where the listener
is, for a world cue.

```ts
interface CueRenderOptions {
  readonly seconds: number;
  /** Where the cue sounds and where the listener is, to render it panned and attenuated (a world cue only). */
  readonly place?: {
    readonly at: {
      readonly x: number;
      readonly z: number;
    };
    readonly listener: Listener;
  } | undefined;
}
```

#### `DuckRenderOptions` (interface)

How to render the ducking demonstration: its length, when the line starts, which cue is the line
and which bed to listen on.

```ts
interface DuckRenderOptions {
  readonly seconds: number;
  /** When the line starts. */
  readonly at: number;
  /** The cue that ducks, or `null` for the same render with nothing to duck it. */
  readonly line: string | null;
  /** The bed to listen to ducking on; the first bed by default. */
  readonly bed?: string | undefined;
}
```

#### `MixSpec` (interface)

A mix to render: its length in seconds, the bed under it and the cues to play at which times.

```ts
interface MixSpec {
  readonly seconds: number;
  readonly bed: string | null;
  readonly sequence: readonly {
    readonly t: number;
    readonly cue: string;
  }[];
}
```

#### `OfflineLike` (interface)

The part of `OfflineAudioContext` a render needs.

```ts
interface OfflineLike extends BaseAudioContext {
  startRendering(): Promise<{
    getChannelData(channel: number): Float32Array;
  }>;
}
```

#### `OfflinePort` (interface)

A mixer port for an offline render. Set `at` to the context time before each `play` so ducks
start there.

```ts
interface OfflinePort extends MixerPort {
  /** The context time ducks start at; set before each `play` (a render schedules everything before it starts). */
  at: number | undefined;
}
```

#### `offlinePort` (function)

Core's buses for an offline render: a gain per bus into the destination, and ducks as gain automation. Ducks do not nest:
overlapping ducks on one bus each automate the same param, the last scheduled winning where they cross.

```ts
function offlinePort(ctx: BaseAudioContext, { release }?: OfflinePortOptions): OfflinePort;
```

#### `OfflinePortOptions` (interface)

How long a duck takes to let go after its hold, in seconds.

```ts
interface OfflinePortOptions {
  /** Seconds a duck takes to let go after its hold (the rule's release is not part of the port's call). */
  readonly release?: number;
}
```

#### `renderBed` (function)

A bed for `seconds`.

```ts
function renderBed(env: RenderEnv, content: AudioContent, id: string, seconds: number): Promise<Float32Array[]>;
```

#### `renderCue` (function)

One cue through the mixer, alone.

```ts
function renderCue(env: RenderEnv, content: AudioContent, id: string, options: CueRenderOptions): Promise<Float32Array[]>;
```

#### `renderDuck` (function)

A bed, with `line` played at `at`: the ducking demonstration.

```ts
function renderDuck(env: RenderEnv, content: AudioContent, options: DuckRenderOptions): Promise<Float32Array[]>;
```

#### `RenderEnv` (interface)

What an offline render needs from the page: a function that makes an offline audio context, and
optionally a sample rate.

```ts
interface RenderEnv {
  /** `(channels, frames, sampleRate) => new OfflineAudioContext(...)`. */
  readonly make: (channels: number, frames: number, rate: number) => OfflineLike;
  readonly rate?: number;
}
```

#### `renderMix` (function)

A sequence of cues over a bed: the bus and gameplay mix the loudness targets apply to.

```ts
function renderMix(env: RenderEnv, content: AudioContent, mix: MixSpec): Promise<Float32Array[]>;
```

#### `SAMPLE_RATE` (const)

The sample rate offline renders use: 48000 Hz.

```ts
const SAMPLE_RATE = 48e3;
```

#### `seeded` (function)

A seeded random (mulberry32), so a crackle renders the same every time.

```ts
function seeded(seed?: number): () => number;
```

### `import { … } from '@automata/audio-synth/stage'`

#### `AudioNote` (type)

What the player did: a cue sounded, or this music was asked for (`null` is silence).

```ts
type AudioNote = {
  readonly cue: string;
} | {
  readonly music: string | null;
};
```

#### `audioStage` (function)

The `audio` of `defineGame`: `defineGame({ audio: audioStage({ content, tracks, state }) })`.

```ts
function audioStage(options: AudioStageOptions): GameAudioStart;
```

#### `AudioStageHandle` (interface)

What the game may do with the player once it runs.

```ts
interface AudioStageHandle {
  /** Plays the cue called `id` now. False before the audio is unlocked, or when the table has no such cue. */
  cue(id: string): boolean;
}
```

#### `AudioStageOptions` (interface)

What a game gives `audioStage`.

```ts
interface AudioStageOptions {
  /** The audio table (read live, so a saved change shows on the next event or the next music check). */
  readonly content: () => AudioContent;
  /** The imported music: a track's name to the address of its file (`tracksFrom`). */
  readonly tracks?: Readonly<Record<string, string>> | undefined;
  /** What the game is in, for the music rules to read (`{ mode: 'chase' }`). Asked about ten times a second. */
  readonly state?: (() => MusicState) | undefined;
  readonly clock?: Clock | undefined;
  /** Fetches a music file's bytes. Default: `fetch`. */
  readonly load?: ((url: string) => Promise<ArrayBuffer>) | undefined;
  /** Something would not play (a missing music file): say it where the game says such things. */
  readonly onFault?: ((message: string) => void) | undefined;
  /** Hands the game the means to play a cue by name once audio is running (Feel's sounds, a button's click). */
  readonly ready?: ((handle: AudioStageHandle) => void) | undefined;
  /** Hears what sounds: each cue as it plays, and the music as it is asked for. For a debug panel or a test. */
  readonly watch?: ((note: AudioNote) => void) | undefined;
}
```

#### `DEFAULT_FADE_SECONDS` (const)

Seconds of crossfade when a slot names none.

```ts
const DEFAULT_FADE_SECONDS = 2;
```

#### `isTrackFile` (const)

Whether a path is a music file the game can play.

```ts
const isTrackFile: (path: string) => boolean;
```

#### `MusicPlayer` (interface)

Plays the slot the game's state calls for.

```ts
interface MusicPlayer {
  /** The slot to be hearing now, or `null` for silence. Asked again for the same slot, it does nothing. */
  play(slot: Slot | null): void;
  /** The overall volume, 0..1 (`master_gain`): every track plays at its own level times this, and a change is followed at once. */
  setMaster(volume: number): void;
  /** The id of the slot being asked for, whether or not it has started yet. */
  wanted(): string | null;
  /** Fades out and lets go. */
  dispose(): void;
}
```

#### `MusicPlayerOptions` (interface)

What the player needs: the context and bus input of core's audio graph, and where the tracks' files are.

```ts
interface MusicPlayerOptions {
  readonly context: BaseAudioContext;
  /** `AudioBuses.input('music')`: the node every track connects to. */
  readonly output: AudioNode;
  /** The imported tracks: the sound alias (the file's name, as Audio writes it) to the file's address. */
  readonly tracks: Readonly<Record<string, string>>;
  /** Fetches a file's bytes. Default: `fetch`. */
  readonly load?: ((url: string) => Promise<ArrayBuffer>) | undefined;
  /** Says in words why something would not play. */
  readonly onFault?: ((message: string) => void) | undefined;
}
```

#### `trackAlias` (function)

The name the game knows a track's sound by: the file's own name, lower case, words joined with dashes.

```ts
function trackAlias(path: string): string;
```

#### `tracksFrom` (function)

The player's `tracks` from the music files a bundler found (Vite's `import.meta.glob('../../assets/music/*', { eager: true,
query: '?url', import: 'default' })`): each file's name to the address it is served from.

```ts
function tracksFrom(found: Readonly<Record<string, string>>): Readonly<Record<string, string>>;
```

## `@automata/content`

### `import { … } from '@automata/content'`

#### `AssetsSource` (interface)

What `content/assets.toml` says: for each screen, the files it waits for (`dir/*` names every file in a
folder), and the atlases and fonts of the asset build it uses, by their names in `atlases.toml` and
`fonts.toml`. A preloaded screen's atlas pages and font subsets join the preload list.

```ts
interface AssetsSource {
  readonly screens: Readonly<Record<string, {
    readonly files: readonly string[];
    /** Atlases named in `content/atlases.toml`: each page's Spritesheet JSON and image. */
    readonly atlases?: readonly string[] | undefined;
    /** Fonts named in `content/fonts.toml`: the subset of every language `fonts.json` lists. */
    readonly fonts?: readonly string[] | undefined;
  }>>;
}
```

#### `buildContent` (const)

Compiles, writes every output under the output folder, then removes the outputs it no longer produces.

```ts
const buildContent: (options: ContentOptions) => Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig | ContentWriteFailed>;
```

#### `checkTuningLayer` (function)

Checks one layer of tuning against code-owned declarations. `complete` is true for the base layer, which
must name every tunable; false for a partial override (a stage or mode layer).

Invariants are rejected before unknown names so the more specific answer wins, then non-numbers, then
integer declarations, then the inclusive range.

```ts
function checkTuningLayer(layer: Readonly<Record<string, unknown>>, options: TuningOptions & {
  readonly tunables: TunableDeclarations;
}, { complete }: {
  readonly complete: boolean;
}): Problem[];
```

#### `compileContent` (const)

Compiles `<root>/content` in memory. Writes nothing.

```ts
const compileContent: (options: ContentOptions) => Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig>;
```

#### `CompileContentResult` (type)

What `compileContentResult` answers: the content, or the error `compileContent` failed with.

```ts
type CompileContentResult = {
  readonly ok: true;
  readonly content: CompiledContent;
} | {
  readonly ok: false;
  readonly error: ContentCompileFailed | InvalidContentConfig;
};
```

#### `compileContentResult` (const)

`compileContent` for a caller outside Effect (a package's tests, a script): runs it and answers with a plain value,
so the caller imports no `effect`. A refusal is a value too, never a rejection.

```ts
const compileContentResult: (options: ContentOptions) => Promise<CompileContentResult>;
```

#### `CompiledContent` (interface)

The result of a compile: the content and its hash, the sim partition, every output file's text, warnings,
the languages and each language's message catalog.

```ts
interface CompiledContent {
  readonly data: ContentData;
  /** Over all of `data`: the boot check and evidence identity. Never compared with `sim.hash`. */
  readonly hash: string;
  /** What the sim receives, and the hash that gates snapshots and replays. */
  readonly sim: SimPartition;
  /** Each output path, relative to the output folder, to its exact text. Build and verify use the same bytes. */
  readonly files: ReadonlyMap<string, string>;
  /** Problems that do not stop a compile (`skippedFile`), sorted. They are not part of the hash or the outputs. */
  readonly warnings: readonly Diagnostic[];
  /** The source language, then each translation's language, sorted. */
  readonly languages: readonly string[];
  /**
   * Each language's checked catalog (without `$schema`), in `languages` order. Derived beside the hashed data,
   * never inside it, so a translation edit moves neither hash. Paraglide and the glyph sets read these.
   */
  readonly catalogs: ReadonlyMap<string, MessageCatalog>;
  /**
   * Where each language's messages are written, in `languages` order: a source message at its text in the
   * TOML, a translated one at its key in `messages/<lang>.json`. The glyph gate names a message by these.
   */
  readonly messageLocations: ReadonlyMap<string, ReadonlyMap<string, MessageLocation>>;
}
```

#### `ContentCompileFailed` (class)

The authored content has problems. Every one is listed, sorted; nothing was written.

```ts
class ContentCompileFailed extends CompileFailedBase {}
```

#### `ContentConfig` (type)

The default export of `automata.content.ts`.

```ts
type ContentConfig = Omit<ContentOptions, "root"> & {
  /** The authoring guide whose tunable table `docs` writes and `--verify-artifact` checks. */
  readonly guide?: string | undefined;
};
```

#### `ContentData` (type)

The compiled content as it is written to `content.json` and hashed.

```ts
type ContentData = Readonly<Record<string, unknown>>;
```

#### `ContentGenerator` (interface)

A generator: a unique name and a pure `generate` that turns compiled content into extra files. Create one
with `defineContentGenerator`.

```ts
interface ContentGenerator {
  readonly name: string;
  generate(input: GeneratorInput): GeneratorOutput;
}
```

#### `contentHash` (function)

16 lowercase hex digits.

```ts
function contentHash(data: unknown): string;
```

#### `ContentOptions` (interface)

What the content compiler is given: the project root, the registered kinds, and optionally tunables,
invariants, flow capabilities, generators, an output folder and Paraglide.

```ts
interface ContentOptions {
  /** The project root; content is read from `<root>/content`. */
  readonly root: string;
  readonly schemas: readonly ContentSchemaDef[];
  /** Code-owned tunable names and ranges. Absent: ranges are authored in `tuning.toml`. */
  readonly tunables?: TunableDeclarations | undefined;
  /** Code-only constants an author may not write in `tuning.toml`. */
  readonly invariants?: readonly string[] | undefined;
  /** Code-owned screens, pairs and styles for `flow.toml`. */
  readonly flow?: FlowCapabilities | undefined;
  readonly generators?: readonly ContentGenerator[] | undefined;
  /** Relative to `root`. Default `content/generated`. */
  readonly outDir?: string | undefined;
  /** Compile the catalogs with Paraglide on each build. Absent: no Paraglide output. */
  readonly paraglide?: ParaglideOptions | undefined;
}
```

#### `contentRef` (function)

The ID of another content item of `kind`. Checked to exist, and to be that kind, after parsing.

```ts
function contentRef<const K extends string>(kind: K): z.ZodType<string, string>;
```

#### `ContentSchemaDef` (interface)

A content kind a game registers: its name, the Zod schema each item must match, where its TOML files live,
and whether the sim receives it. Create one with `defineContentSchema`.

```ts
interface ContentSchemaDef<K extends string = string, S extends z.ZodType = z.ZodType> {
  readonly kind: K;
  readonly schema: S;
  readonly place: ContentSchemaPlace;
  /**
   * Whether the sim receives this kind. Default true: content is gameplay unless the game
   * says otherwise, so a forgotten flag can only refuse a snapshot, never let a gameplay change through.
   */
  readonly sim: boolean;
}
```

#### `ContentSchemaOptions` (interface)

Options for `defineContentSchema`; `sim: false` keeps the kind out of the sim's content and its hash.

```ts
interface ContentSchemaOptions {
  readonly sim?: boolean;
}
```

#### `ContentSchemaPlace` (type)

Where a kind's files are: every TOML file under a folder (a collection), or one file (a document).

```ts
type ContentSchemaPlace = {
  readonly folder: string;
} | {
  readonly file: string;
};
```

#### `ContentWriteFailed` (class)

An output could not be written. Files already replaced are whole; none is half written.

```ts
class ContentWriteFailed extends WriteFailedBase {}
```

#### `DEFAULT_OUT_DIR` (const)

Where outputs go when `outDir` is not set: `content/generated`, relative to the project root.

```ts
const DEFAULT_OUT_DIR = "content/generated";
```

#### `DEFAULT_PALETTE` (const)

The palette a game gets when it has no `content/palette.toml`: DUEL, its ramps row-major (colour `r * 8 + s`).

```ts
const DEFAULT_PALETTE: Palette;
```

#### `defineContentGenerator` (function)

Defines a generator by name and `generate` function. Generators do no I/O: the compiler writes their files.
A generator that throws, repeats another's name, returns a path outside the output folder or writes a file
another generator wrote is reported as `InvalidContentConfig`.

```ts
function defineContentGenerator(name: string, generate: (input: GeneratorInput) => GeneratorOutput): ContentGenerator;
```

#### `defineContentSchema` (function)

Registers a content kind: a name, its Zod schema, and a folder (every TOML file in it is an item) or one
file (a single document). The sim receives the kind unless `{ sim: false }`. A bad registration (a name
that does not start with a lower-case letter followed by lower-case letters, digits and dashes, a built-in
name, a duplicate, or a place two kinds share) is reported when content compiles, as `InvalidContentConfig`.

```ts
function defineContentSchema<const K extends string, S extends z.ZodType>(kind: K, schema: S, place: ContentSchemaPlace, options?: ContentSchemaOptions): ContentSchemaDef<K, S>;
```

#### `Diagnostic` (interface)

One authoring problem: a stable `code`, the file to open, the 1-based line and column, the dotted key
inside it and a message that says what to write instead.

```ts
interface Diagnostic {
  readonly code: DiagnosticCode;
  /** Project-relative, `/`-separated, e.g. `content/tuning.toml`. */
  readonly file: string;
  readonly line: number;
  readonly column: number;
  /** Dotted path inside the file (`transitions.3.to`), or '' for the whole file. */
  readonly keyPath: string;
  readonly message: string;
}
```

#### `DiagnosticCode` (type)

Stable codes. Tests and tools match on these, so a code is never renamed, only added.

```ts
type DiagnosticCode = "invalidToml" | "invalidType" | "missingField" | "unknownField" | "invalidId" | "unknownReference" | "wrongKind" | "outOfRange" | "invariantNotAuthorable" | "invalidFlow" | "invalidPalette" | "invalidGame" | "missingAsset" | "invalidAsset" | "offPalette" | "missingGlyph" | "duplicateMessageKey" | "staleTranslation" | "staleArtifact" | "reservedKey" | "simReference" | "skippedFile";
```

#### `FlowCapabilities` (interface)

What the game's code implements: the screens, and optionally the pairs and destinations each allows.

```ts
interface FlowCapabilities {
  /** The only screen a session may begin on. */
  readonly entry?: string;
  readonly screens: readonly string[];
  /** For each screen and event, the destinations that screen is prepared to enter. */
  readonly targets?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  /** Transition styles the runtime draws. Default: only `cut`. */
  readonly styles?: readonly string[];
}
```

#### `FlowGraph` (interface)

The checked screen flow from `flow.toml`: the entry screen, every screen, the terminal screens and every
transition, in a fixed order.

```ts
interface FlowGraph {
  readonly entry: string;
  /** Sorted. */
  readonly screens: readonly string[];
  /** Sorted. */
  readonly terminal: readonly string[];
  /** Sorted by from, event, then to: declaration order means nothing. */
  readonly transitions: readonly FlowTransition[];
}
```

#### `FlowTransition` (interface)

One checked move in the flow: on `event` the game goes `from` one screen `to` another, drawn in the
`transition` style (`cut` when unwritten).

```ts
interface FlowTransition {
  readonly from: string;
  readonly event: string;
  readonly to: string;
  readonly transition: string;
}
```

#### `formatDiagnostic` (function)

`content/tuning.toml:12:1  GRAVITY  outOfRange: expected -1200..-100, received -2000`

```ts
function formatDiagnostic(d: Diagnostic): string;
```

#### `GAME_ID_PATTERN` (const)

A game id and a board id: lower-case letters, digits and hyphens, starting with a letter or digit, up to 64.

```ts
const GAME_ID_PATTERN: RegExp;
```

#### `GameConfig` (interface)

What every target knows about a game.

```ts
interface GameConfig {
  readonly game: {
    readonly id: string;
    readonly title: string;
    readonly version: string;
    /** The entry page in the build. */
    readonly entry: string;
    /** The Ruken SDK's version range; the Ruken target requires it. */
    readonly sdk?: string;
  };
  readonly runtime: {
    readonly renderer: Renderer;
    readonly orientation: Orientation;
    readonly inputs: readonly Input[];
    readonly pause_behavior: "pause" | "continue";
  };
  /** The origins the game connects to; empty means it works offline. */
  readonly network: {
    readonly connect: readonly string[];
  };
  readonly content: {
    readonly languages: readonly string[];
    readonly rating: Rating;
    readonly estimated_hours?: number;
    readonly descriptors: readonly string[];
  };
  /** The analytics events the game may send (`Hosting.track` drops any other). */
  readonly analytics?: {
    readonly custom_events: readonly string[];
  };
  /** Files to load before the game starts, besides those the entry page names (the Ruken target). */
  readonly loading?: {
    readonly preload: readonly string[];
  };
  readonly leaderboards?: Readonly<Record<string, LeaderboardConfig>>;
}
```

#### `gameConfigSchema` (const)

Checks a game's config.

```ts
const gameConfigSchema: z.ZodType<GameConfig>;
```

#### `GameSource` (interface)

What `content/game.toml` says about the game: its source language, rating, content descriptors, estimated
hours, the analytics events it may send, and the screens whose files are preloaded.

```ts
interface GameSource {
  /** The language the TOML is written in. Default `en`. */
  readonly source_language: string;
  readonly rating: Rating;
  readonly descriptors: string[];
  readonly estimated_hours?: number | undefined;
  readonly custom_events: string[];
  /** The screens whose files Ruken preloads, in order. Default: the flow's entry. */
  readonly preload_screens?: string[] | undefined;
}
```

#### `GeneratorInput` (interface)

Everything a generator is given: the compiled content and its hash, the sim partition, the registered
schemas, the message catalog and the tuning metadata.

```ts
interface GeneratorInput {
  readonly data: ContentData;
  readonly hash: string;
  /** The sim partition and its hash, so a generator never re-derives it from `schemas`. */
  readonly sim: SimPartition;
  readonly schemas: readonly ContentSchemaDef[];
  readonly messages: MessageCatalog;
  readonly tuning: TuningMeta;
}
```

#### `GeneratorOutput` (interface)

What a generator returns: files to write and diagnostics to report. Both are optional.

```ts
interface GeneratorOutput {
  /** Path relative to the output folder → the file's exact text. */
  readonly files?: Readonly<Record<string, string>>;
  readonly diagnostics?: readonly Diagnostic[];
}
```

#### `Input` (type)

One input a game can be played with.

```ts
type Input = (typeof INPUTS)[number];
```

#### `INPUTS` (const)

The inputs a game can be played with.

```ts
const INPUTS: readonly ["touch", "keyboard", "gamepad"];
```

#### `InvalidContentConfig` (class)

The game's code registered something unusable (a duplicate kind, a clashing generator).

```ts
class InvalidContentConfig extends InvalidConfigBase {}
```

#### `LEADERBOARD_ORDERS` (const)

The orders a score board sorts in.

```ts
const LEADERBOARD_ORDERS: readonly ["asc", "desc"];
```

#### `LeaderboardConfig` (interface)

A score board a game declares.

```ts
interface LeaderboardConfig {
  readonly order: (typeof LEADERBOARD_ORDERS)[number];
  readonly min: number;
  readonly max: number;
  readonly title?: string;
}
```

#### `localized` (function)

Text a player reads, written in the source language. It gets a message key for translators.

```ts
function localized(): z.ZodType<string, string>;
```

#### `MessageCatalog` (type)

One locale's messages: message key to translated text.

```ts
type MessageCatalog = Readonly<Record<string, string>>;
```

#### `messageKey` (function)

The message key of one text. `id` is absent for a single-document kind.

```ts
function messageKey(kind: string, id: string | undefined, path: DataPath): string;
```

#### `MessageLocation` (interface)

A message's place in its file, 1-based.

```ts
interface MessageLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}
```

#### `Orientation` (type)

One orientation a game supports.

```ts
type Orientation = (typeof ORIENTATIONS)[number];
```

#### `ORIENTATIONS` (const)

The orientations a game supports.

```ts
const ORIENTATIONS: readonly ["landscape", "portrait", "any"];
```

#### `Palette` (interface)

The game's palette: a name and its colors.

```ts
interface Palette {
  readonly name: string;
  /** `#rrggbb`, lowercase, in authored order. */
  readonly colors: readonly string[];
}
```

#### `ParaglideOptions` (interface)

Where and which catalogs `ContentOptions.paraglide` compiles with Paraglide on build.

```ts
interface ParaglideOptions {
  /** Where the generated `runtime.js` and `messages.js` go, relative to the root. Emptied on each compile. */
  readonly outdir: string;
  /** The game's own catalogs, `{locale}` path patterns relative to the root (`messages/ui/{locale}.json`). */
  readonly catalogs?: readonly string[] | undefined;
}
```

#### `PreloadInput` (interface)

What `preloadList` reads: the content options (to compile `game.toml` and `assets.toml`, and to find the asset
build's outputs below `outDir`) and the built game folder.

```ts
interface PreloadInput {
  readonly options: ContentOptions;
  /** The built game folder (Vite's `dist/`). */
  readonly distDir: string;
}
```

#### `preloadList` (const)

The files Ruken preloads before the game starts, in order, for `[loading] preload`: each `preload_screens`
screen's files from `assets.toml` (the flow's entry when none is named), then the pages of the atlases and
every language's subset of the fonts it names there, which `automata-content assets` wrote below `outDir`
and the build serves in `atlases/` and `fonts/`; without repeats. Empty without a `game.toml`. Fails with
`ContentCompileFailed` carrying a diagnostic for every file the build lacks (`missingAsset`), every atlas or
font not declared (`unknownReference`) or not built (`missingAsset`), all at once, or with
`InvalidContentConfig`.

```ts
const preloadList: (input: PreloadInput) => Effect.Effect<string[], ContentCompileFailed | InvalidContentConfig>;
```

#### `Rating` (type)

One content rating.

```ts
type Rating = (typeof RATINGS)[number];
```

#### `RATINGS` (const)

The content ratings a game declares.

```ts
const RATINGS: readonly ["everyone", "teen", "mature"];
```

#### `Renderer` (type)

One renderer a game may ask for.

```ts
type Renderer = (typeof RENDERERS)[number];
```

#### `RENDERERS` (const)

The renderers a game may ask for.

```ts
const RENDERERS: readonly ["webgl2", "webgl", "canvas2d", "wasm-webgl2"];
```

#### `renderTuningTable` (function)

Every tunable once, sorted by name, with its type, range and value in `content/tuning.toml`.

```ts
function renderTuningTable(meta: TuningMeta): string;
```

#### `RukenFields` (type)

The game config's `content` and `analytics` sections (Ruken's `[content]` and `[analytics]` tables), worked out
from `game.toml` and the languages present and written to `ruken-fields.json`.

```ts
type RukenFields = {
  readonly content: GameConfig["content"];
  readonly analytics: NonNullable<GameConfig["analytics"]>;
};
```

#### `SimPartition` (interface)

The part of the compiled content the sim receives (`tuning` and every kind with `sim: true`) and its hash,
which gates snapshots and replays.

```ts
interface SimPartition {
  /** `tuning` and each sim kind, the same objects as in the full data. */
  readonly data: ContentData;
  /** `contentHash(data)`: exactly what `createSim` computes from the same data. */
  readonly hash: string;
}
```

#### `sortDiagnostics` (function)

Returns the diagnostics in the one fixed order (file, line, column, key, code, message), without changing
the input. The order never depends on locale.

```ts
function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[];
```

#### `TunableDeclaration` (interface)

A tunable a game declares in code: `int` or `float`, an inclusive range and a default. Content selects a
value inside the range and never widens it.

```ts
interface TunableDeclaration {
  readonly type: TunableType;
  /** Inclusive lower bound. */
  readonly min: number;
  /** Inclusive upper bound. */
  readonly max: number;
  readonly default: number;
}
```

#### `TunableDeclarations` (type)

A game's tunables by name (upper-case words joined by underscores, such as `GRAVITY`).

```ts
type TunableDeclarations = Readonly<Record<string, TunableDeclaration>>;
```

#### `TuningMeta` (type)

Every tunable's type, value and range (`min`, `max`, `step`) by name, as written to `tuning-meta.json` for
debug sliders.

```ts
type TuningMeta = Readonly<Record<string, TuningEntryMeta>>;
```

#### `verifyContent` (const)

Fails with `staleArtifact` for each committed output that differs from a fresh compile.

```ts
const verifyContent: (options: ContentOptions) => Effect.Effect<void, ContentCompileFailed | InvalidContentConfig>;
```

#### `withTuningTable` (function)

The guide with its generated section replaced, or undefined when it has no markers.

```ts
function withTuningTable(guide: string, meta: TuningMeta): string | undefined;
```

### `import { … } from '@automata/content/assets'`

#### `ATLAS_EXTRUDE` (const)

Pixels of each frame's edge repeated around it, so filtering never samples a neighbour.

```ts
const ATLAS_EXTRUDE = 1;
```

#### `ATLAS_PADDING` (const)

Transparent pixels between cells, and between a cell and the page edge.

```ts
const ATLAS_PADDING = 1;
```

#### `ATLAS_PAGE_MAX` (const)

The largest atlas page side, in pixels: WebGL2's guaranteed `MAX_TEXTURE_SIZE`.

```ts
const ATLAS_PAGE_MAX = 2048;
```

#### `AtlasFrameTooLarge` (class)

A frame that cannot fit a page even alone.

```ts
class AtlasFrameTooLarge extends Error {
  readonly frame: FrameSize;
  constructor(frame: FrameSize);
}
```

#### `AtlasOutputs` (interface)

What `buildAtlases` produces; the caller writes it.

```ts
interface AtlasOutputs {
  /** `<atlas>-<page>.png` and `<atlas>-<page>.json`, sorted by name. */
  readonly files: ReadonlyMap<string, Uint8Array>;
}
```

#### `buildAtlases` (const)

Builds every atlas `<root>/content/atlases.toml` names, or fails with every problem found. Without the file
there is nothing to build.

```ts
const buildAtlases: (root: string) => Effect.Effect<AtlasOutputs, ContentCompileFailed>;
```

#### `buildFonts` (const)

Builds every subset `<root>/content/fonts.toml` names, or fails with every problem found. Without the file
there is nothing to build, and the content is not compiled.

```ts
const buildFonts: (options: ContentOptions) => Effect.Effect<FontOutputs, ContentCompileFailed | InvalidContentConfig>;
```

#### `fontCoverage` (function)

Whether a font file (TrueType, OpenType, woff or woff2) has a glyph for each character.

```ts
function fontCoverage(font: Uint8Array): (character: string) => boolean;
```

#### `FontOutputs` (interface)

What `buildFonts` produces; the caller writes it.

```ts
interface FontOutputs {
  /** `<font>-<locale>-<hash8>.woff2` and `fonts.json` (`{ font: { locale: file } }`), sorted by name. */
  readonly files: ReadonlyMap<string, Uint8Array>;
}
```

#### `FontsFile` (interface)

`content/fonts.toml`: each source font by name.

```ts
interface FontsFile {
  readonly font: Readonly<Record<string, FontSource>>;
}
```

#### `FontSource` (interface)

One source font: its committed file, the sha256 of its bytes, its licence and the languages it serves.

```ts
interface FontSource {
  readonly file: string;
  readonly sha256: string;
  readonly license: string;
  readonly locales: readonly string[];
}
```

#### `FrameSize` (interface)

A frame to pack: its name (the PNG's file name without `.png`) and size in pixels.

```ts
interface FrameSize {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}
```

#### `PackedAtlas` (interface)

Every frame's placement, and the pages they fill.

```ts
interface PackedAtlas {
  /** Each page's side, in pixels. */
  readonly pageSizes: readonly number[];
  /** In code-unit order of the frame names. */
  readonly placements: readonly Placement[];
}
```

#### `packFrames` (function)

Packs `frames` into atlas pages. Throws `AtlasFrameTooLarge` for a frame no page can hold.

```ts
function packFrames(frames: readonly FrameSize[]): PackedAtlas;
```

#### `Placement` (interface)

Where a frame's own pixels are: inside its extrusion, on page `page`.

```ts
interface Placement {
  readonly name: string;
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

#### `subsetWoff2` (function)

The font cut to `characters`, as woff2. A character the font lacks is simply not in the subset.

```ts
function subsetWoff2(source: Uint8Array, characters: ReadonlySet<string>): Promise<Uint8Array>;
```

### `import { … } from '@automata/content/controls'`

#### `ControlAction` (interface)

One action: what it sends, and every way to do it.

```ts
interface ControlAction {
  readonly id: string;
  /** Its name in the Controls section of Settings and in the Tuner. */
  readonly label?: string | undefined;
  /** The command's fields this action sets while held. The game checks them against the command's own schema. */
  readonly send: Readonly<Record<string, unknown>>;
  readonly keys?: readonly string[] | undefined;
  readonly pad?: readonly number[] | undefined;
  /** Whether the play screen shows a button for it on touch screens. Default yes, when it has a key. */
  readonly touch?: boolean | undefined;
  readonly stick?: readonly StickDirection[] | undefined;
  readonly gesture?: readonly GestureName[] | undefined;
  /** The game cannot be played without it: rebinding never leaves it unbound. */
  readonly required?: boolean | undefined;
}
```

#### `ControlsFile` (interface)

What `content/controls.toml` holds.

```ts
interface ControlsFile {
  /** The id of the command the actions send. */
  readonly command: string;
  readonly action: readonly ControlAction[];
}
```

#### `controlsFileSchema` (const)

The schema of `content/controls.toml`: at least one action, and no two with one id.

```ts
const controlsFileSchema: z.ZodType<ControlsFile>;
```

#### `controlsKind` (function)

The kind a game registers to read `content/controls.toml`.

```ts
function controlsKind(): ContentSchemaDef;
```

#### `GESTURE_NAMES` (const)

`camera-drag` is analog: a one-finger or secondary-button drag whose horizontal pixels
`Input.cameraDrag()` reads. It never holds or pulses an action; binding it is what turns the drag on.

```ts
const GESTURE_NAMES: readonly ["swipe-left", "swipe-right", "swipe-up", "swipe-down", "flick-down", "tap", "camera-drag"];
```

#### `GestureName` (type)

A touch gesture (the swipes, flick, tap and the camera drag).

```ts
type GestureName = (typeof GESTURE_NAMES)[number];
```

#### `RESERVED_KEYS` (const)

Keys never bindable in a game's profile: Escape (the one back path) and Tab (focus).

```ts
const RESERVED_KEYS: readonly string[];
```

#### `RESERVED_PAD_BUTTONS` (const)

Never bindable in a game's profile: Ruken's SDK summons the host on pad 8 (View), 16 is Home, Escape is the
one back path and Tab moves focus.

```ts
const RESERVED_PAD_BUTTONS: readonly number[];
```

#### `STANDARD_PAD_BUTTON_MAX` (const)

The highest button index of the W3C Gamepad standard mapping (0 = bottom face button … 16 = home). Only the
standard mapping is bound; a pad without it is the device layer's to normalize.

```ts
const STANDARD_PAD_BUTTON_MAX = 16;
```

#### `STICK_DIRECTIONS` (const)

The eight stick pushes a profile can bind: each stick up, down, left or right.

```ts
const STICK_DIRECTIONS: readonly ["left-up", "left-down", "left-left", "left-right", "right-up", "right-down", "right-left", "right-right"];
```

#### `StickDirection` (type)

A stick pushed past its dead zone in one direction (the input service reads them).

```ts
type StickDirection = (typeof STICK_DIRECTIONS)[number];
```

### `import { … } from '@automata/content/game-config'`

#### `GAME_ID_PATTERN` (const)

A game id and a board id: lower-case letters, digits and hyphens, starting with a letter or digit, up to 64.

```ts
const GAME_ID_PATTERN: RegExp;
```

#### `GameConfig` (interface)

What every target knows about a game.

```ts
interface GameConfig {
  readonly game: {
    readonly id: string;
    readonly title: string;
    readonly version: string;
    /** The entry page in the build. */
    readonly entry: string;
    /** The Ruken SDK's version range; the Ruken target requires it. */
    readonly sdk?: string;
  };
  readonly runtime: {
    readonly renderer: Renderer;
    readonly orientation: Orientation;
    readonly inputs: readonly Input[];
    readonly pause_behavior: "pause" | "continue";
  };
  /** The origins the game connects to; empty means it works offline. */
  readonly network: {
    readonly connect: readonly string[];
  };
  readonly content: {
    readonly languages: readonly string[];
    readonly rating: Rating;
    readonly estimated_hours?: number;
    readonly descriptors: readonly string[];
  };
  /** The analytics events the game may send (`Hosting.track` drops any other). */
  readonly analytics?: {
    readonly custom_events: readonly string[];
  };
  /** Files to load before the game starts, besides those the entry page names (the Ruken target). */
  readonly loading?: {
    readonly preload: readonly string[];
  };
  readonly leaderboards?: Readonly<Record<string, LeaderboardConfig>>;
}
```

#### `gameConfigSchema` (const)

Checks a game's config.

```ts
const gameConfigSchema: z.ZodType<GameConfig>;
```

#### `Input` (type)

One input a game can be played with.

```ts
type Input = (typeof INPUTS)[number];
```

#### `INPUTS` (const)

The inputs a game can be played with.

```ts
const INPUTS: readonly ["touch", "keyboard", "gamepad"];
```

#### `LEADERBOARD_ORDERS` (const)

The orders a score board sorts in.

```ts
const LEADERBOARD_ORDERS: readonly ["asc", "desc"];
```

#### `LeaderboardConfig` (interface)

A score board a game declares.

```ts
interface LeaderboardConfig {
  readonly order: (typeof LEADERBOARD_ORDERS)[number];
  readonly min: number;
  readonly max: number;
  readonly title?: string;
}
```

#### `Orientation` (type)

One orientation a game supports.

```ts
type Orientation = (typeof ORIENTATIONS)[number];
```

#### `ORIENTATIONS` (const)

The orientations a game supports.

```ts
const ORIENTATIONS: readonly ["landscape", "portrait", "any"];
```

#### `Rating` (type)

One content rating.

```ts
type Rating = (typeof RATINGS)[number];
```

#### `RATINGS` (const)

The content ratings a game declares.

```ts
const RATINGS: readonly ["everyone", "teen", "mature"];
```

#### `Renderer` (type)

One renderer a game may ask for.

```ts
type Renderer = (typeof RENDERERS)[number];
```

#### `RENDERERS` (const)

The renderers a game may ask for.

```ts
const RENDERERS: readonly ["webgl2", "webgl", "canvas2d", "wasm-webgl2"];
```

### `import { … } from '@automata/content/level-2d'`

#### `animationSchema` (const)

At least one clip, and no two with one name.

```ts
const animationSchema: z.ZodType<ContentAnimation>;
```

#### `autoStacks` (function)

The grids of an auto layer, one per stack depth, depth 0 first (the order they are drawn in).

```ts
function autoStacks(level: ContentLevel, layer: string): readonly (readonly (readonly (TileCell | undefined)[])[])[];
```

#### `checkEntityDef` (function)

Problems with an entity definition: its id and color, then each field's problems tagged with the field's id and
index, with a repeated field id reported at its later occurrence.

```ts
function checkEntityDef(def: EntityDef): readonly EntityDefProblem[];
```

#### `checkFieldDef` (function)

Problems with one field definition, in a stable order: id, misplaced properties, bounds, step, options, default.

```ts
function checkFieldDef(def: FieldDef): readonly FieldProblem<FieldDefCode>[];
```

#### `checkFieldValue` (function)

Whether `value` fits the field: `undefined` when it does, else the first problem. It checks the value's shape
and the field's own rules; whether a reference resolves is the editor's check.

```ts
function checkFieldValue(def: FieldDef, value: unknown): FieldValueProblem | undefined;
```

#### `ClipPicture` (interface)

A character with an animation: frame `index` of its first clip, cut from the picture `image` in `cell`-sized cells
(the frame's place depends on the picture's width, so whoever has the picture works it out). `still` is the look
to show while the picture is not there.

```ts
interface ClipPicture {
  readonly kind: "clip";
  readonly image: string;
  readonly cell: {
    readonly w: number;
    readonly h: number;
  };
  readonly index: number;
  readonly still: StillPicture;
}
```

#### `ContentAnimation` (interface)

A character's animation: a picture cut into `frame`-sized cells, and clips over those cells.

```ts
interface ContentAnimation {
  readonly image: string;
  readonly frame: ContentSize;
  readonly clips: readonly ContentClip[];
}
```

#### `ContentClip` (interface)

One named run of frames of a character's picture: `frames` are indexes into the picture cut into equal cells.

```ts
interface ContentClip {
  readonly id: string;
  readonly frames: readonly number[];
  /** Frames a second, 1 to 60. */
  readonly fps: number;
  readonly loop: boolean;
}
```

#### `ContentEntityDef` (type)

An entity definition in `project.toml`: a typed-field definition plus how the editor draws and places it.

```ts
type ContentEntityDef = EntityDef & {
  readonly shape: "rect" | "ellipse" | "point" | "tile";
  readonly size: ContentSize;
  readonly pivot: {
    readonly x: number;
    readonly y: number;
  };
  readonly resizable: "none" | "x" | "y" | "xy";
  readonly tile?: {
    readonly tileset: string;
    readonly index: number;
  } | undefined;
  readonly animation?: ContentAnimation | undefined;
  readonly tags: readonly string[];
  readonly min?: {
    readonly per: "level" | "project";
    readonly count: number;
  } | undefined;
};
```

#### `ContentEntityItem` (interface)

One placed entity in a level: its definition, its position (and size when resizable) and its field values.

```ts
interface ContentEntityItem {
  readonly id: string;
  readonly def: string;
  readonly x: number;
  readonly y: number;
  readonly w?: number | undefined;
  readonly h?: number | undefined;
  readonly fields: FieldValues;
}
```

#### `ContentLevel` (interface)

A level as `levels/<id>.toml` holds it, after parsing the TOML.

```ts
interface ContentLevel {
  readonly format: "af2d-content";
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly size: ContentSize;
  readonly background: {
    readonly color: string;
    readonly image?: string | undefined;
    readonly mode: "fit" | "cover" | "repeat" | "repeat-x";
  };
  readonly fields: FieldValues;
  readonly layers: readonly ContentLevelLayer[];
}
```

#### `ContentLevelLayer` (type)

One layer of a level, by kind: tile rows, IntGrid rows, auto-tile stacks, entities or objects.

```ts
type ContentLevelLayer = {
  readonly def: string;
  readonly kind: "tiles";
  readonly rows: readonly string[];
} | {
  readonly def: string;
  readonly kind: "intgrid";
  readonly rows: readonly string[];
} | {
  readonly def: string;
  readonly kind: "auto";
  readonly stack: readonly ContentRows[];
} | {
  readonly def: string;
  readonly kind: "entities";
  readonly items: readonly ContentEntityItem[];
} | {
  readonly def: string;
  readonly kind: "objects";
  readonly items: readonly ContentObjectItem[];
};
```

#### `ContentNeighbours` (interface)

One level's neighbours in `world.toml`, each side ordered by position and then id. The editor computes them.

```ts
interface ContentNeighbours {
  readonly level: string;
  readonly north: readonly string[];
  readonly east: readonly string[];
  readonly south: readonly string[];
  readonly west: readonly string[];
}
```

#### `ContentObjectItem` (interface)

One placed tile object in an objects layer.

```ts
interface ContentObjectItem {
  readonly id: string;
  readonly tile: number;
  readonly x: number;
  readonly y: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
}
```

#### `ContentProject` (interface)

The project as `project.toml` holds it: the layer, tileset and entity definitions every level uses.

```ts
interface ContentProject {
  readonly format: "af2d-content";
  readonly version: 1;
  readonly name: string;
  readonly template: string;
  readonly layers: readonly ContentProjectLayer[];
  readonly tilesets: readonly ContentTileset[];
  readonly entities: readonly ContentEntityDef[];
  readonly levelFields: readonly FieldDef[];
}
```

#### `ContentProjectLayer` (type)

A layer definition in `project.toml`, by kind.

```ts
type ContentProjectLayer = {
  readonly id: string;
  readonly kind: "tiles";
  readonly grid: number;
  readonly tileset: string;
} | {
  readonly id: string;
  readonly kind: "intgrid";
  readonly grid: number;
  readonly values: readonly {
    readonly value: number;
    readonly id: string;
  }[];
} | {
  readonly id: string;
  readonly kind: "auto";
  readonly grid: number;
  readonly source: string;
  readonly tileset: string;
} | {
  readonly id: string;
  readonly kind: "entities";
  readonly grid: number;
  readonly snap: boolean;
} | {
  readonly id: string;
  readonly kind: "objects";
  readonly tileset: string;
  readonly snap: number;
};
```

#### `ContentRows` (interface)

One stack entry of an auto layer: run-length row strings.

```ts
interface ContentRows {
  readonly rows: readonly string[];
}
```

#### `ContentSize` (interface)

A width and height in pixels.

```ts
interface ContentSize {
  readonly w: number;
  readonly h: number;
}
```

#### `ContentTileset` (interface)

A tileset in `project.toml`: its tile size, grid, optional image and tags.

```ts
interface ContentTileset {
  readonly id: string;
  readonly tile: ContentSize;
  readonly columns: number;
  readonly rows: number;
  readonly spacing: number;
  readonly padding: number;
  readonly image?: string | undefined;
  readonly placeholder: boolean;
  readonly tags: readonly {
    readonly tag: string;
    readonly tiles: readonly number[];
  }[];
}
```

#### `ContentWorld` (interface)

The worlds as `world.toml` holds them: layout, level placements and, for a grid world, each level's neighbours.

```ts
interface ContentWorld {
  readonly format: "af2d-content";
  readonly version: 1;
  readonly worlds: readonly {
    readonly id: string;
    readonly layout: "free" | "grid" | "horizontal" | "vertical";
    readonly grid?: ContentSize | undefined;
    readonly placements: readonly {
      readonly level: string;
      readonly x: number;
      readonly y: number;
      readonly depth: number;
    }[];
    /** Only in a `grid` world: for each level, the levels whose edge touches its own along a span of positive length. */
    readonly neighbours?: readonly ContentNeighbours[] | undefined;
  }[];
}
```

#### `defaultFieldValue` (function)

The value an instance gets when it has none: the field's `default`, else the type's zero (moved into a number's
bounds), else `[]` for a list. `undefined` for a required field, which has no stand-in, and for a ref until one
is picked.

```ts
function defaultFieldValue(def: FieldDef): FieldValue | undefined;
```

#### `entitiesOf` (function)

The items of an entities layer, in file order. Throws for a missing or other layer.

```ts
function entitiesOf(level: ContentLevel, layer: string): readonly ContentEntityItem[];
```

#### `ENTITY_ID` (const)

An entity definition id.

```ts
const ENTITY_ID: RegExp;
```

#### `EntityDef` (interface)

A thing a game places: an id, a label and the typed fields its instances carry.

```ts
interface EntityDef {
  readonly id: string;
  readonly label?: string | undefined;
  /** A token name or `#rrggbb`. */
  readonly color?: string | undefined;
  /** At most one instance per scope the editor names (2D: per level; 3D: per map). */
  readonly single?: boolean | undefined;
  readonly fields: readonly FieldDef[];
}
```

#### `EntityDefCode` (type)

The reasons `checkEntityDef` can refuse an entity definition.

```ts
type EntityDefCode = FieldDefCode | "badEntityId" | "badEntityColor" | "duplicateFieldId";
```

#### `EntityDefIssue` (interface)

One problem found in a parsed entity definition, with the path of the field at fault.

```ts
interface EntityDefIssue {
  readonly message: string;
  /** Mutable, so it can be handed to `ctx.addIssue` as it is. */
  readonly path: (string | number)[];
}
```

#### `entityDefIssues` (function)

The entity-level problems of a definition, for `superRefine`: its id and color, and a repeated field id at the later
field's path. A field's own problems are reported by `fieldDefSchema` at the field's path, so they are not repeated.

```ts
function entityDefIssues(def: EntityDef): readonly EntityDefIssue[];
```

#### `EntityDefProblem` (interface)

A problem with a definition; `fieldId` and `fieldIndex` (its place in `fields`) say which field when the problem is in one.

```ts
interface EntityDefProblem extends FieldProblem<EntityDefCode> {
  readonly fieldId?: string;
  readonly fieldIndex?: number;
}
```

#### `entityDefSchema` (const)

The schema of an entity definition: strict shape, then the rules `checkEntityDef` applies.

```ts
const entityDefSchema: z.ZodType<EntityDef>;
```

#### `entityDefShape` (const)

The keys of an entity definition, for an editor to extend (`z.strictObject({ ...entityDefShape, shape: … })`) so
its own entity schema never copies the kit's keys (`EntityDef2D = EntityDef & { shape, size, … }`).

```ts
const entityDefShape: {
  id: z.ZodString;
  label: z.ZodOptional<z.ZodString>;
  color: z.ZodOptional<z.ZodString>;
  single: z.ZodOptional<z.ZodBoolean>;
  fields: z.ZodArray<z.ZodType<FieldDef>>;
};
```

#### `FIELD_ID` (const)

A field id as an inspector shows it and a file stores it.

```ts
const FIELD_ID: RegExp;
```

#### `FIELD_TYPES` (const)

Every field type, in the order a picker lists them.

```ts
const FIELD_TYPES: readonly FieldType[];
```

#### `FieldDef` (interface)

The definition of one typed field: its id, type and the bounds, options or target its type needs.

```ts
interface FieldDef {
  readonly id: string;
  readonly type: FieldType;
  readonly label?: string | undefined;
  /** An ordered array of this type (a patrol path is a list of points). */
  readonly list?: boolean | undefined;
  /** No default stands in: an instance without a value is a `fieldMissing` problem. */
  readonly required?: boolean | undefined;
  readonly default?: FieldValue | undefined;
  /** `int` and `float`: inclusive bounds. */
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  /** `int` and `float`: the stepper's increment (1 for an `int` without one). */
  readonly step?: number | undefined;
  /** `enum`: non-empty and unique. */
  readonly options?: readonly string[] | undefined;
  /** `text`: an editor shows a multi-line box. */
  readonly multiline?: boolean | undefined;
  /** `ref`: what it may point at, as names the editor defines (entity definition ids, `$level`, `$sector`); empty or absent means any. */
  readonly to?: readonly string[] | undefined;
}
```

#### `FieldDefCode` (type)

The reasons `checkFieldDef` can refuse a field definition.

```ts
type FieldDefCode = "badId" | "badBounds" | "badStep" | "noOptions" | "duplicateOption" | "badDefault" | "wrongTypeProperty";
```

#### `fieldDefSchema` (const)

The schema of a field definition: strict shape, then the rules `checkFieldDef` applies.

```ts
const fieldDefSchema: z.ZodType<FieldDef>;
```

#### `FieldProblem` (interface)

A problem with a field, with a stable `code` and a sentence to show.

```ts
interface FieldProblem<Code extends string = string> {
  readonly code: Code;
  readonly message: string;
}
```

#### `FieldType` (type)

The kind of value a field holds: int, float, bool, text, enum, color, angle, ref or point.

```ts
type FieldType = "int" | "float" | "bool" | "text" | "enum" | "color" | "angle" | "ref" | "point";
```

#### `FieldValue` (type)

A value a field can hold: a number, boolean, string, point, reference or a list of those.

```ts
type FieldValue = number | boolean | string | Point | RefValue | readonly FieldValue[];
```

#### `FieldValueCode` (type)

The reasons `checkFieldValue` can refuse a value.

```ts
type FieldValueCode = "wrongType" | "notInteger" | "belowMin" | "aboveMax" | "notAnOption" | "badColor" | "badRef" | "badPoint" | "badListItem";
```

#### `FieldValueProblem` (interface)

`badListItem` carries the index of the first bad item and that item's own problem as `cause`.

```ts
interface FieldValueProblem extends FieldProblem<FieldValueCode> {
  readonly index?: number;
  readonly cause?: FieldValueProblem;
}
```

#### `FieldValues` (type)

The values an instance holds, by field id.

```ts
type FieldValues = Readonly<Record<string, FieldValue>>;
```

#### `fieldValueSchema` (const)

Any well-formed value shape. Whether it fits a definition is `checkValues`, which knows the definition.

```ts
const fieldValueSchema: z.ZodType<FieldValue>;
```

#### `fieldValuesSchema` (const)

The schema of the values an instance holds, by field id.

```ts
const fieldValuesSchema: z.ZodType<FieldValues>;
```

#### `HEX_COLOR` (const)

A field's color value: `#rrggbb`, either case.

```ts
const HEX_COLOR: RegExp;
```

#### `InstanceCode` (type)

The reasons an instance's values can disagree with its definition.

```ts
type InstanceCode = FieldValueCode | "fieldMissing" | "unknownField";
```

#### `InstanceProblem` (interface)

A problem with one value of an instance, found by `checkValues`.

```ts
interface InstanceProblem extends FieldProblem<InstanceCode> {
  readonly fieldId: string;
  readonly index?: number;
  readonly cause?: FieldValueProblem;
}
```

#### `intGridRows` (function)

The cells of an IntGrid layer, one array of numbers per row (0 is empty). Throws for a missing or other layer.

```ts
function intGridRows(level: ContentLevel, layer: string): readonly (readonly number[])[];
```

#### `level2dKinds` (function)

The kinds `levels` (in the sim's content), `project` and `world` (outside it).

```ts
function level2dKinds(options?: Level2dKindsOptions): ContentSchemaDef[];
```

#### `Level2dKindsOptions` (interface)

Options for `level2dKinds`.

```ts
interface Level2dKindsOptions {
  /** Where the exported levels are, under `content/`. Default `levels`. */
  readonly folder?: string | undefined;
}
```

#### `levelContentSchema` (const)

The strict schema of `levels/<id>.toml`.

```ts
const levelContentSchema: z.ZodType<ContentLevel>;
```

#### `objectsOf` (function)

The items of an objects layer, in file order. Throws for a missing or other layer.

```ts
function objectsOf(level: ContentLevel, layer: string): readonly ContentObjectItem[];
```

#### `parseTileToken` (function)

A tile token without its repeat (`7`, `7h`, `7hv`) as a tile, or undefined when it is not one.

```ts
function parseTileToken(base: string): TileCell | undefined;
```

#### `Picture` (type)

How a character looks: its first animation frame when it has a clip, else a tile or a flat colour.

```ts
type Picture = StillPicture | ClipPicture;
```

#### `pictureOf` (function)

The picture of a definition: its animation's first frame, else its tile, else its colour as its flat shape.

```ts
function pictureOf(def: Pick<ContentEntityDef, "shape" | "tile" | "color" | "animation">): Picture;
```

#### `PLACEHOLDER_COLORS` (const)

Twelve flat colours far enough apart to tell neighbouring indices apart; tile `n` takes colour `n % 12`, so a
placeholder looks the same wherever it is drawn and whatever happened to the image.

```ts
const PLACEHOLDER_COLORS: readonly string[];
```

#### `placeholderColor` (const)

The placeholder colour of tile `tile`.

```ts
const placeholderColor: (tile: number) => string;
```

#### `Point` (interface)

A position with `x` and `y`.

```ts
interface Point {
  readonly x: number;
  readonly y: number;
}
```

#### `projectContentSchema` (const)

The strict schema of `project.toml`.

```ts
const projectContentSchema: z.ZodType<ContentProject>;
```

#### `RefValue` (interface)

`target` and `container` are opaque to the kit: whether they resolve is the editor's check.

```ts
interface RefValue {
  readonly target: string;
  /** The level or sector that holds the target. */
  readonly container?: string | undefined;
}
```

#### `StillPicture` (type)

A look with no animation: a tile of a tileset, or a flat shape.

```ts
type StillPicture = {
  readonly kind: "tile";
  readonly tileset: string;
  readonly index: number;
} | {
  readonly kind: "flat";
  readonly shape: "rect" | "ellipse" | "point";
  readonly color: string;
};
```

#### `TileCell` (interface)

One drawn tile: its index in the tileset and whether it is mirrored.

```ts
interface TileCell {
  readonly tile: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
}
```

#### `tileFrame` (function)

The rectangle of tile `tile` in the tileset's picture, or undefined when the index is past the set.

```ts
function tileFrame(tileset: Pick<ContentTileset, "tile" | "columns" | "rows" | "spacing" | "padding">, tile: number): (ContentSize & {
  readonly x: number;
  readonly y: number;
}) | undefined;
```

#### `tileRows` (function)

The cells of a tiles layer, one array per row (undefined is empty). Throws for a missing or other layer.

```ts
function tileRows(level: ContentLevel, layer: string): readonly (readonly (TileCell | undefined)[])[];
```

#### `worldContentSchema` (const)

The strict schema of `world.toml`.

```ts
const worldContentSchema: z.ZodType<ContentWorld>;
```

### `import { … } from '@automata/content/locale'`

#### `ALWAYS_CHARACTERS` (const)

Printable ASCII, CJK symbols and punctuation, half- and full-width forms, and the symbols the UI draws.

```ts
const ALWAYS_CHARACTERS: readonly string[];
```

#### `catalogCharacters` (function)

Every character the catalog's messages show. `$schema` is the file's format, not text a player reads.

```ts
function catalogCharacters(catalog: MessageCatalog): Set<string>;
```

#### `ContentText` (type)

`text(kind, id, path, authored, inputs?)`: the text in the active locale, or the authored text.

```ts
type ContentText = (kind: string, id: string | undefined, path: DataPath, authored: string, inputs?: Readonly<Record<string, unknown>>) => string;
```

#### `ContentTextOptions` (interface)

Options for `createContentText`.

```ts
interface ContentTextOptions {
  /** Called once per key the messages lack. */
  readonly onMissing?: ((key: string) => void) | undefined;
}
```

#### `createContentText` (function)

A lookup over the messages module Paraglide compiles into `paraglide.outdir` (its `messages.js`, imported whole).

```ts
function createContentText(messages: Readonly<Record<string, unknown>>, options?: ContentTextOptions): ContentText;
```

#### `endonymOf` (function)

A language's name in its own language ("日本語" for `ja`), from the browser's `Intl.DisplayNames`. An engine without
it, or a tag it cannot name, gives the tag back, so the picker never shows nothing.

```ts
function endonymOf(tag: string): string;
```

#### `hasRawText` (function)

True when a piece of visible text has English in it that did not come from the xx-long catalog: any ASCII
letter outside a ⟦ ⟧ span. Data a player typed (a name) is also "raw", so a check lists the data it expects.

```ts
function hasRawText(text: string): boolean;
```

#### `localeCharacters` (function)

A locale's own characters for its subset font: `ALWAYS_CHARACTERS` and the catalog's characters. The font build
also adds every content language's name for the language picker (`endonymOf`).

```ts
function localeCharacters(catalog: MessageCatalog): Set<string>;
```

#### `MessageCatalog` (type)

One locale's messages: message key to translated text.

```ts
type MessageCatalog = Readonly<Record<string, string>>;
```

#### `messageKey` (function)

The message key of one text. `id` is absent for a single-document kind.

```ts
function messageKey(kind: string, id: string | undefined, path: DataPath): string;
```

#### `MessageValue` (type)

A value in an inlang message file: a message, a list of variants, or a namespace or variant object.

```ts
type MessageValue = string | readonly MessageValue[] | {
  readonly [key: string]: MessageValue;
};
```

#### `PSEUDO_LOCALE` (const)

The pseudo-locale's tag. `Intl` reads it as the unknown language `xx`, so formatting falls back, never throws.

```ts
const PSEUDO_LOCALE = "xx-long";
```

#### `pseudoLocalize` (function)

The xx-long form of one message string. Placeholders and escaped braces stay as written. The extra length is
spread over the words in proportion to their length, each word's share right after it, so a long message keeps
the places a line can break, as a longer language's would; a message with no words has it at the end.

```ts
function pseudoLocalize(message: string): string;
```

#### `pseudoMessages` (function)

The xx-long form of a whole message file (the inlang message format): nested namespaces are walked, plural
variants keep their `declarations` and `selectors` (they are code, not text) and only their `match` texts
change. `$schema` is copied as is.

```ts
function pseudoMessages(file: {
  readonly [key: string]: MessageValue;
}): Record<string, MessageValue>;
```

#### `snakeKey` (function)

`snow-shrine` → `snow_shrine`, `fastFall` → `fast_fall`, `melee/sword` → `melee_sword`.

```ts
function snakeKey(value: string): string;
```

### `import { … } from '@automata/content/palette'`

#### `DEFAULT_PALETTE` (const)

The palette a game gets when it has no `content/palette.toml`: DUEL, its ramps row-major (colour `r * 8 + s`).

```ts
const DEFAULT_PALETTE: Palette;
```

#### `DUEL_RAMP_NAMES` (const)

One lowercase word for each ramp, in ramp order, so a swatch can say `{ ramp = "skin", step = 5 }` instead of a bare
number. The words are AF's own labels for what each ramp looks like; DUEL itself names none.

```ts
const DUEL_RAMP_NAMES: readonly ["grey", "sand", "skin", "sea", "flame", "dusk", "moss", "sky", "pine", "rose", "slate", "clay", "mud", "plum", "teal", "wood", "wine", "indigo", "cherry", "rust", "olive", "amber", "mauve", "forest", "brick", "sage", "ocean", "dawn", "violet", "navy", "blush", "ember"];
```

#### `DUEL_RAMPS` (const)

DUEL's 32 ramps of 8 `#rrggbb` colours, dark to light: colour `r * 8 + s` is ramp `r`, step `s`.

```ts
const DUEL_RAMPS: readonly (readonly string[])[];
```

#### `duelIndex` (function)

The palette index (0 to 255) of step `at` (0 dark to 7 light) on the ramp called `name`.

```ts
function duelIndex(name: DuelRampName, at: number): number;
```

#### `DuelRampName` (type)

A ramp's name.

```ts
type DuelRampName = (typeof DUEL_RAMP_NAMES)[number];
```

#### `nearestDuel` (function)

The palette index of the DUEL colour nearest `hex` (`#rrggbb`) in OKLab; the first wins a tie.

```ts
function nearestDuel(hex: string): number;
```

#### `Palette` (interface)

The game's palette: a name and its colors.

```ts
interface Palette {
  readonly name: string;
  /** `#rrggbb`, lowercase, in authored order. */
  readonly colors: readonly string[];
}
```

#### `rampOf` (function)

The ramp (0 to 31) a palette index is on.

```ts
function rampOf(index: number): number;
```

#### `step` (function)

`index` moved `by` steps along its own ramp (negative is darker), stopping at the ramp's ends.

```ts
function step(index: number, by: number): number;
```

### `import { … } from '@automata/content/schema'`

#### `contentRef` (function)

The ID of another content item of `kind`. Checked to exist, and to be that kind, after parsing.

```ts
function contentRef<const K extends string>(kind: K): z.ZodType<string, string>;
```

#### `ContentSchemaDef` (interface)

A content kind a game registers: its name, the Zod schema each item must match, where its TOML files live,
and whether the sim receives it. Create one with `defineContentSchema`.

```ts
interface ContentSchemaDef<K extends string = string, S extends z.ZodType = z.ZodType> {
  readonly kind: K;
  readonly schema: S;
  readonly place: ContentSchemaPlace;
  /**
   * Whether the sim receives this kind. Default true: content is gameplay unless the game
   * says otherwise, so a forgotten flag can only refuse a snapshot, never let a gameplay change through.
   */
  readonly sim: boolean;
}
```

#### `ContentSchemaOptions` (interface)

Options for `defineContentSchema`; `sim: false` keeps the kind out of the sim's content and its hash.

```ts
interface ContentSchemaOptions {
  readonly sim?: boolean;
}
```

#### `ContentSchemaPlace` (type)

Where a kind's files are: every TOML file under a folder (a collection), or one file (a document).

```ts
type ContentSchemaPlace = {
  readonly folder: string;
} | {
  readonly file: string;
};
```

#### `defineContentSchema` (function)

Registers a content kind: a name, its Zod schema, and a folder (every TOML file in it is an item) or one
file (a single document). The sim receives the kind unless `{ sim: false }`. A bad registration (a name
that does not start with a lower-case letter followed by lower-case letters, digits and dashes, a built-in
name, a duplicate, or a place two kinds share) is reported when content compiles, as `InvalidContentConfig`.

```ts
function defineContentSchema<const K extends string, S extends z.ZodType>(kind: K, schema: S, place: ContentSchemaPlace, options?: ContentSchemaOptions): ContentSchemaDef<K, S>;
```

#### `localized` (function)

Text a player reads, written in the source language. It gets a message key for translators.

```ts
function localized(): z.ZodType<string, string>;
```

### `import { … } from '@automata/content/vite'`

#### `automataContent` (function)

The Vite plugin that compiles content and serves it as `virtual:automata/content`. It builds when Vite
starts and on every save in dev, with the same build as `automata-content build`. A `vite build` with
content errors fails; a dev server keeps serving the last good content and reports the diagnostics through
Vite's logger and the `automata:content-error` event (`automata:content` after a good save). It also sets
`build.assetsInlineLimit: 0` when the game's config leaves it unset, so no asset becomes a `data:` URL that Ruken's
CSP refuses to fetch.

```ts
function automataContent(pluginOptions?: AutomataContentOptions): Plugin;
```

#### `AutomataContentOptions` (type)

The plugin's options: `ContentOptions`, with `root` defaulting to Vite's root.

```ts
type AutomataContentOptions = Omit<ContentOptions, "root"> & {
  readonly root?: string | undefined;
};
```

#### `VIRTUAL_MODULE_ID` (const)

The import path of the compiled content: `content`, `contentHash`, `simContent` and `simContentHash`.

```ts
const VIRTUAL_MODULE_ID = "virtual:automata/content";
```

## `@automata/debug`

### `import { … } from '@automata/debug'`

#### `audioBoard` (function)

Builds the audio board for the debug overlay from the game's audio content and its controls. The
content is read each time, so a reload shows.

```ts
function audioBoard(content: () => AudioContent, controls: AudioControls): AudioBoardPort;
```

#### `AudioBoardBed` (interface)

One looping bed on the audio board: its id, its bus, a line about it and whether it is still a
draft.

```ts
interface AudioBoardBed {
    readonly id: string;
    readonly bus: string;
    readonly about?: string;
    readonly draft: boolean;
}
```

#### `AudioBoardCue` (interface)

One cue on the audio board: its bus, its line, and the sim events that play it.

```ts
interface AudioBoardCue {
    readonly id: string;
    readonly bus: string;
    readonly about?: string;
    readonly draft: boolean;
    readonly events: readonly string[];
}
```

#### `AudioBoardPort` (interface)

The audio board: every cue and bed, and a way to play them through the mixer the game installed.

```ts
interface AudioBoardPort {
    cues(): readonly AudioBoardCue[];
    beds(): readonly AudioBoardBed[];
    play(cue: string): void;
    startBed(id: string): void;
    stopBed(id: string): void;
    /** The beds playing now. */
    playing(): readonly string[];
}
```

#### `AudioControls` (interface)

What the audio board needs from the game's mixer and synth: play a cue, start or stop a bed and
say which beds are playing.

```ts
interface AudioControls {
    play(cue: string): void;
    startBed(id: string): void;
    stopBed(id: string): void;
    playing(): readonly string[];
}
```

#### `BusPort` (interface)

The presentation bus, as far as the debug panels need it.

```ts
interface BusPort {
    subscribe(name: string, listener: (fact: unknown) => void): () => void;
}
```

#### `createOverlay` (function)

Makes the overlay's state. The dev key (backquote) or a three-finger tap toggles it and Escape
closes it. Opening it pauses nothing.

```ts
function createOverlay(options: OverlayOptions): Overlay;
```

#### `debugExtension` (const)

The debug extension a game opts into in dev and `--debug` builds only. It draws the overlay in
`hud.overlay`, with the panels from the host the game installed. Add it behind
`__AUTOMATA_DEBUG__` so a release build leaves it out.

```ts
const debugExtension: ExtensionDef<'debug'>;
```

#### `DebugHost` (interface)

Everything the debug panels can read, handed over by the game with `installDebug`. Every handle
is optional: a panel whose handle is missing says so instead of failing.

```ts
interface DebugHost {
    readonly panels: readonly DebugPanelDef[];
    readonly bus?: BusPort | undefined;
    /** The sim's ticks a second, when the game does not run it at 60: Watch's times in seconds need it. */
    readonly tickHz?: number | undefined;
    /** The facts to record for the bus panel; the runtime's by default. */
    readonly facts?: readonly string[] | undefined;
    readonly sim?: SimProbe | undefined;
    readonly feel?: FeelBoardPort | undefined;
    readonly audio?: AudioBoardPort | undefined;
    readonly net?: NetDiagnosticsPort | undefined;
    /** Each extension's summary, by the id of its `summaryPanel` (DBG-D4). */
    readonly summaries?: Readonly<Record<string, SummaryPort>> | undefined;
    /** Flow's existing pause, for the overlay's "Pause the game" toggle. */
    readonly setPaused?: ((paused: boolean) => void) | undefined;
    /** The game's test driver (DBG-D3): named functions a Playwright playthrough calls, exposed as `window.__automataDebug`. */
    readonly driver?: Readonly<Record<string, (...args: never[]) => unknown>> | undefined;
}
```

#### `DebugOverlay` (const)

The debug overlay. The dev key or a three-finger tap opens it; it shows the host's panels as tabs in a scroll region, and opening it pauses nothing. If one panel fails, its tab shows the error and the others keep working.

```ts
const DebugOverlay: import("svelte").Component<Record<string, never>, {}, "">;
type DebugOverlay = ReturnType<typeof DebugOverlay>;
```

#### `DebugPanelDef` (interface)

One tab of the debug overlay: a kebab-case id that is not used twice, a title (debug words are
not translated) and the component that draws it.

```ts
interface DebugPanelDef {
    readonly id: string;
    readonly title: string;
    readonly component: UiComponent;
}
```

#### `debugPanels` (function)

Checks the panels and returns them in the order given. Throws on a bad id, a repeated id or an empty title.

```ts
function debugPanels(...panels: readonly DebugPanelDef[]): readonly DebugPanelDef[];
```

#### `FactEntry` (interface)

One fact heard on the presentation bus: its name and one line of text.

```ts
interface FactEntry {
    readonly name: string;
    readonly text: string;
}
```

#### `FactLog` (interface)

The bus panel's record of the last facts heard. Read it with `entries`, hear changes with
`subscribe` and stop listening with `dispose`.

```ts
interface FactLog {
    entries(): readonly FactEntry[];
    subscribe(listener: () => void): () => void;
    dispose(): void;
}
```

#### `feelBoard` (function)

Builds the feel board for the debug overlay: every event the feel content reacts to, and a way
to fire one.

```ts
function feelBoard(content: () => FeelContent, feel: Feel, tick: () => number): FeelBoardPort;
```

#### `FeelBoardPort` (interface)

The feel board: every event the content reacts to, and a way to fire one.

```ts
interface FeelBoardPort {
    entries(): readonly string[];
    fire(on: string): void;
}
```

#### `ForwardedEvent` (interface)

What the editor hears for each event.

```ts
interface ForwardedEvent {
    readonly type: 'af-sim-event';
    readonly name: string;
    readonly payload: unknown;
    /** The sim tick that emitted it, and that tick in seconds. */
    readonly tick: number;
    readonly seconds: number;
}
```

#### `forwardEvents` (function)

Starts forwarding when the page is framed and its address carries `af-watch` (the editor's origin) and `events` (the
event names, comma between). Returns the stop; it returns at once, having listened to nothing, otherwise.

```ts
function forwardEvents(bus: BusPort, location: Pick<Location, 'search'>, parent: Pick<Window, 'postMessage'>, options?: {
    readonly tickHz?: number;
}): () => void;
```

#### `installDebug` (function)

Makes `host` the one the overlay shows, and its driver (if any) `window.__automataDebug`, with `panels()` added. Returns a
dispose that removes both, unless a later install has replaced them.

```ts
function installDebug(host: DebugHost): () => void;
```

#### `NetDiagnosticsPort` (interface)

The net diagnostics: a summary object (`NetDiagnostics.summary()`), read as rows.

```ts
interface NetDiagnosticsPort {
    summary(): unknown;
}
```

#### `Overlay` (interface)

The overlay's state and its dev-input rules, apart from any view: toggle, close, pick a tab,
pause, and handle a key or a touch count.

```ts
interface Overlay {
    state(): OverlayState;
    toggle(): void;
    close(): void;
    select(id: string): void;
    setPaused(paused: boolean): void;
    /** Returns true when the key was the overlay's (the caller then stops it reaching the game). */
    key(key: string): boolean;
    /** Returns true when the touch count opened or closed the overlay. */
    touch(fingers: number): boolean;
    subscribe(listener: (state: OverlayState) => void): () => void;
}
```

#### `OverlayOptions` (interface)

What the overlay starts with: its panels, and the function that pauses the game when the pause
toggle is used.

```ts
interface OverlayOptions {
    readonly panels: readonly DebugPanelDef[];
    readonly setPaused?: ((paused: boolean) => void) | undefined;
}
```

#### `OverlayState` (interface)

Whether the overlay is open, which tab it shows and whether the game is paused from it.

```ts
interface OverlayState {
    readonly open: boolean;
    /** The shown panel's id; null when there are no panels. */
    readonly tab: string | null;
    readonly paused: boolean;
}
```

#### `recordFacts` (function)

Starts listening for the named facts on the bus and keeps the last `limit` of them (50 by
default). It only listens: it never sends anything.

```ts
function recordFacts(bus: BusPort, names: readonly string[], limit?: number): FactLog;
```

#### `RUNTIME_FACTS` (const)

The facts the runtime publishes (core's `RuntimeFacts`), for a host that does not name its own.

```ts
const RUNTIME_FACTS: readonly string[];
```

#### `shippedPanels` (const)

The panels debug comes with: Sim, Bus, Feel, Audio and Net.

```ts
const shippedPanels: readonly DebugPanelDef[];
```

#### `SimProbe` (interface)

What the sim panel shows, read each time the panel refreshes.

```ts
interface SimProbe {
    tick(): number;
    entities(): number;
    /** The last state hash, as a string. */
    hash(): string;
    /** Milliseconds the last step took. */
    stepMs(): number;
}
```

#### `summaryPanel` (function)

A panel for an extension's summary: it lists `host.summaries[id].summary()` as rows. `debug` imports no extension, so
each extension exports a function that turns its state into a plain object and the game hands it over under this id.

```ts
function summaryPanel(id: string, title: string): DebugPanelDef;
```

#### `SummaryPort` (interface)

An extension's debug summary (DBG-D4): a plain object the extension builds from its own state, shown as rows by `summaryPanel`.

```ts
interface SummaryPort {
    summary(): unknown;
}
```

#### `SummaryRow` (interface)

One row of a diagnostics summary: a dotted name and its value as text.

```ts
interface SummaryRow {
    readonly name: string;
    readonly value: string;
}
```

#### `summaryRows` (function)

Turns a diagnostics summary into rows: nested objects get dotted names, a distribution (count,
last, min, p50, p95, max) takes one row and long fractions are rounded. Anything that is not an
object gives no rows.

```ts
function summaryRows(summary: unknown, prefix?: string): SummaryRow[];
```

### `import { … } from '@automata/debug/vite'`

#### `debugBuild` (function)

A Vite plugin that sets `__AUTOMATA_DEBUG__`. Pass `true` in dev and `--debug` builds and
`false` in a release build, so a release bundle leaves the overlay out.

```ts
function debugBuild(debug: boolean): Plugin;
```

## `@automata/feel`

### `import { … } from '@automata/feel'`

#### `AudioRow` (interface)

An audio cue to play, named by its id.

```ts
interface AudioRow {
  readonly cue: string;
}
```

#### `Beat` (interface)

A sim event with the tick that produced it.

```ts
interface Beat {
  readonly tick: number;
  readonly event: SimEvent;
}
```

#### `Beats` (class)

Events held until the drawn picture reaches them, each answered once even when a batch is
delivered twice.

```ts
class Beats {
  private pending;
  private readonly seen;
  private readonly seenAt;
  private readonly stale;
  constructor(options?: BeatsOptions);
  /** Notes the events a step at `tick` produced. An event is told apart by its tick and place in the batch. */
  noteAt(tick: number, events: readonly SimEvent[]): void;
  /**
   * The events the drawn tick has reached, oldest first; each is given once. One the picture passed more than the stale
   * window ago is dropped unanswered: a tab back from the background would otherwise play every pop it missed in one frame.
   */
  reach(drawnTick: number): Beat[];
  /** Batches still remembered. */
  get remembered(): number;
  clear(): void;
}
```

#### `BeatsOptions` (interface)

How late an event may still be answered, in ticks behind the picture.

```ts
interface BeatsOptions {
  /** The most ticks behind the picture an event is still answered (default 30). */
  readonly staleTicks?: number | undefined;
}
```

#### `CameraRow` (interface)

A camera shake an entry causes.

```ts
interface CameraRow {
  /** Trauma 0..1: the shake is its square. */
  readonly shake: number;
}
```

#### `createFeel` (function)

Starts the feel runtime. Events are answered when the drawn picture reaches their tick, once
each, and the same events, settings and frame times always give the same frames.

```ts
function createFeel(options: FeelOptions): Feel;
```

#### `DEFAULT_LIMITS` (const)

The limits used when `feel.toml` sets none.

```ts
const DEFAULT_LIMITS: Limits;
```

#### `DEFAULT_SETTINGS` (const)

The settings a new player starts with: flashing on, rumble on, full strength.

```ts
const DEFAULT_SETTINGS: FeelSettings;
```

#### `DEFAULT_SQUASH` (const)

How squash moves when `feel.toml` sets no spring.

```ts
const DEFAULT_SQUASH: SpringTuning;
```

#### `EntityRef` (type)

A view the sim names, by its stable id.

```ts
type EntityRef = number;
```

#### `Feel` (interface)

The feel runtime. Tell it what the sim did with `hear`, then ask for the frame to draw with
`frame` or `frameNow`. It never writes the sim.

```ts
interface Feel {
  /** The events the step at `tick` produced (the game's loop passes them as it gets them: FE-D1). */
  hear(tick: number, events: readonly SimEvent[]): void;
  /** The frame to draw: `frameSeconds` after the last. */
  frame(drawnTick: number, alpha: number, frameSeconds: number): FeelFrame;
  /** The same, its seconds read from the clock: the time since the last call, or 0 on the first. */
  frameNow(drawnTick: number, alpha: number): FeelFrame;
}
```

#### `feelContent` (const)

The `feel` content kind: `content/feel/feel.toml` is the game's feel table; a word's `words` is translatable.

```ts
const feelContent: ContentSchemaDef<"feel", z.ZodType<FeelContent>>;
```

#### `FeelContent` (interface)

The whole `feel.toml`: the limits, the squash spring and the entries that answer sim events.

```ts
interface FeelContent {
  readonly limits?: { readonly [K in keyof Limits]?: Limits[K] | undefined; } | undefined;
  readonly springs?: {
    readonly squash?: SpringTuning | undefined;
  } | undefined;
  readonly entry?: readonly FeelEntry[] | undefined;
}
```

#### `FeelEntry` (interface)

How one sim event feels. `on` is an event id or a pattern with `*` for any run of characters,
and the channels say what happens: camera, pose, visual, word, haptic and audio.

```ts
interface FeelEntry {
  readonly on: string;
  readonly camera?: readonly CameraRow[] | undefined;
  readonly pose?: readonly PoseRow[] | undefined;
  readonly visual?: readonly VisualRow[] | undefined;
  readonly word?: readonly WordRow[] | undefined;
  readonly haptic?: readonly HapticRow[] | undefined;
  readonly audio?: readonly AudioRow[] | undefined;
}
```

#### `feelExtension` (const)

The feel extension a game opts into. It is presentation only and adds no sim plugin, so a game's
sim hash is the same with or without it.

```ts
const feelExtension: ExtensionDef<"feel">;
```

#### `FeelFrame` (interface)

Everything to draw for one frame as plain data: the camera offset, the views held by a hit-stop,
the flash and tint, the squashes, the words, and the rumbles and audio cues that fire on this
frame once.

```ts
interface FeelFrame {
  /** Whole pixels (2D) or screen pixels (3D). */
  readonly offset: readonly [number, number];
  /** Hit-stop: these views hold their pose. */
  readonly frozen: readonly EntityRef[];
  readonly flash: {
    readonly colour: string;
    readonly alpha: number;
  } | null;
  readonly tint: {
    readonly colour: string;
    readonly alpha: number;
  } | null;
  /** Scale x, y on 1/32 steps, for each view not at rest. */
  readonly squash: ReadonlyMap<EntityRef, readonly [number, number]>;
  readonly words: readonly WordPop[];
  /** The rumbles that fire on this frame, once (the haptics port plays them). */
  readonly haptics: readonly Pulse[];
  /** The audio cues that fire on this frame, once. */
  readonly cues: readonly string[];
}
```

#### `FeelOptions` (interface)

What `createFeel` needs: the feel table, the player's settings, the reduced-motion preference,
an optional seed and the presentation clock.

```ts
interface FeelOptions {
  /** The feel table; read at each event, so a reload shows on the next one. */
  readonly content: () => FeelContent;
  readonly settings: () => FeelSettings;
  /** The player's reduced-motion preference, read every frame. */
  readonly reducedMotion: () => boolean;
  readonly seed?: number | undefined;
  /** The most ticks behind the picture an event is still answered (default 30). */
  readonly staleTicks?: number | undefined;
  /** The presentation clock `frameNow` reads its frame times from; tests hand over `fakeClock()`. */
  readonly clock: Clock;
}
```

#### `feelSchema` (const)

The Zod schema of `feel.toml`.

```ts
const feelSchema: z.ZodType<FeelContent>;
```

#### `FeelSettings` (interface)

What the player can switch: no flashing, rumble on or off, and how strong the camera and pose
effects are.

```ts
interface FeelSettings {
  /** Drops flash and flicker. */
  readonly reduceFlashing: boolean;
  /** The player's rumble switch. */
  readonly haptics: boolean;
  /** Scales camera and pose effects: shake, hit-stop length and squash. */
  readonly intensity: 0 | 0.5 | 1;
}
```

#### `HapticRow` (interface)

A rumble for a game pad (strong and weak motors, in milliseconds) and, optionally, a single buzz
for a phone.

```ts
interface HapticRow {
  readonly strong: number;
  readonly weak: number;
  readonly ms: number;
  /** A phone's single buzz; none for an entry without it. */
  readonly phone_ms?: number | undefined;
}
```

#### `hash` (function)

A steady pseudo-random number from 0 up to but not including 1, made from whole numbers with no
stored state, so a replay shakes the same.

```ts
function hash(...n: number[]): number;
```

#### `Limits` (interface)

The hard limits on the effects: the most shake in pixels, the longest hit-stop in milliseconds,
and the most flash frames and flash opacity. Values above a limit are clamped when played and
named by `limitWarnings`.

```ts
interface Limits {
  readonly shake_px: number;
  readonly hit_stop_ms: number;
  readonly flash_frames: number;
  readonly flash_alpha: number;
}
```

#### `limitWarnings` (function)

Each value above a limit, named by entry; the runtime clamps it anyway.

```ts
function limitWarnings(feel: FeelContent): string[];
```

#### `matches` (const)

`*` matches any run of characters.

```ts
const matches: (pattern: string, event: string) => boolean;
```

#### `PoseRow` (interface)

A hit-stop: the view's pose is held for this many milliseconds, and `target: 'subject'` holds
only the view the event is about.

```ts
interface PoseRow {
  readonly hit_stop_ms: number;
  readonly target?: "subject" | undefined;
}
```

#### `Pulse` (interface)

One rumble for the haptics port to play.

```ts
interface Pulse {
  readonly strong: number;
  readonly weak: number;
  readonly ms: number;
  readonly phoneMs?: number | undefined;
}
```

#### `resolveLimits` (const)

The limits a file sets over the defaults.

```ts
const resolveLimits: (feel: Pick<FeelContent, "limits">) => Limits;
```

#### `SpringTuning` (interface)

How the squash spring moves: its speed in hertz, how much it wobbles and how it starts.

```ts
interface SpringTuning {
  /** How fast it answers, in hertz. */
  readonly f: number;
  /** How much it wobbles: below 1 it overshoots. */
  readonly zeta: number;
  /** How it starts: above 1 it anticipates past the target, below 0 it winds up first. */
  readonly r: number;
}
```

#### `VisualRow` (interface)

One of a flash (`flash`, `frames`, `alpha`), a tint (`tint`, `ms`, `alpha`) or a squash (`squash`).

```ts
interface VisualRow {
  readonly flash?: string | undefined;
  readonly frames?: number | undefined;
  readonly tint?: string | undefined;
  readonly ms?: number | undefined;
  readonly alpha?: number | undefined;
  readonly squash?: number | undefined;
}
```

#### `WordPop` (interface)

A word on screen: its locale key, the view it belongs to, its age in seconds and whether it
holds still for reduced motion.

```ts
interface WordPop {
  /** The word's name in the table. */
  readonly key: string;
  /** What it says, as authored; absent for a word the table only names. */
  readonly words?: string;
  /** Where `words` sits in the feel file, for the content text that translates it. */
  readonly path?: readonly (string | number)[];
  readonly at: EntityRef | null;
  /** Seconds since it popped. */
  readonly age: number;
  /** Reduced motion: it appears, still. */
  readonly still: boolean;
}
```

#### `WordRow` (interface)

A word that pops up, as a locale key, never as text. It stays up 800 ms unless `ms` says
otherwise.

```ts
interface WordRow {
  /** The word's name, unique in the file. */
  readonly key: string;
  /** What it says, in the game's source language. Translatable text in the `feel` content kind. */
  readonly words?: string | undefined;
  readonly at?: "subject" | undefined;
  /** How long it stays up; 800 ms when unset. */
  readonly ms?: number | undefined;
}
```

### `import { … } from '@automata/feel/stage'`

#### `feelStage` (function)

The setup to hand to `createPixiRenderer({ setup })`.

```ts
function feelStage(options: FeelStageOptions): (stage: PixiStage) => PixiStageHooks;
```

#### `FeelStageOptions` (interface)

What a game gives `feelStage`: the table (read at each event, so a saved change shows on the next one) and its ports.

```ts
interface FeelStageOptions {
  readonly content: () => FeelContent;
  /** The player's feel settings; the defaults when the game has none yet. */
  readonly settings?: (() => FeelSettings) | undefined;
  readonly reducedMotion?: (() => boolean) | undefined;
  readonly clock?: Clock | undefined;
  /** An audio cue fires, once. The game plays it; without this the cue is not heard. */
  readonly onCue?: ((cue: string) => void) | undefined;
  /** A rumble fires, once. The game's haptics port plays it. */
  readonly onHaptic?: ((pulse: Pulse) => void) | undefined;
  /**
   * A word's text in the player's language: given where the words sit in the feel file and what was authored (the
   * game's content text). Without it the authored words show.
   */
  readonly translate?: ((path: readonly (string | number)[], authored: string) => string) | undefined;
  /**
   * What was drawn, once per frame, after it was drawn: the shake's offset, the flash and tint, the words and the squashes.
   * For a debug panel or a journey that checks what the player saw; the stage itself needs nothing from it.
   */
  readonly onFrame?: ((frame: FeelFrame) => void) | undefined;
  /** The playfield's logical size: a word with no subject shows in the middle of it. Default 320 by 180. */
  readonly size?: {
    readonly width: number;
    readonly height: number;
  } | undefined;
}
```

## `@automata/framework`

### `import { … } from '@automata/framework'`

#### `ActionBar` (const)

One row of actions that collapses as its container narrows.

It gives way in a fixed order as its container narrows (`collapseLevel`): utilities to their icon,
then secondaries to their short label, and only then a wrap with the primary on its own row.
Three hidden, inert copies of the row ([data-measure]) report how wide it would be at each level,
so the choice is measured rather than guessed from breakpoints.

```ts
const ActionBar: import("svelte").Component<Props, {}, "">;
type ActionBar = ReturnType<typeof ActionBar>;
```

#### `ActionKind` (type)

The action bar's model.

One row of actions that gives way in a fixed order as its container narrows, so the primary
action is the last thing to lose its words:
  0. every label in full;
  1. utility actions drop to their icon;
  2. secondary actions take their short label;
  3. it wraps, with the primary alone on the first row.
Level 3 is a fallback: the layout contracts fail any reference size where a bar reaches it.

```ts
type ActionKind = 'primary' | 'secondary' | 'utility';
```

#### `actionsForKey` (function)

Every action `code` (a `KeyboardEvent.code`) drives in `profile`; none when it is unbound.

```ts
function actionsForKey(profile: InputProfile, code: string): string[];
```

#### `actionsForPadButton` (function)

Every action the standard-mapping pad button `index` drives in `profile`; none when it is unbound.

```ts
function actionsForPadButton(profile: InputProfile, index: number): string[];
```

#### `AnalogOptions` (interface)

The `analog` option of `keys()`.

```ts
interface AnalogOptions<Z extends z.ZodType> {
    /**
     * Per tick: what the sticks and the drag add to the held keys' payload, merged over it and parsed by the
     * command's schema. The held payload is passed in so a game can sum a key term and a stick term. When the schema
     * refuses the merge (a `NaN`, a float in an integer field), the held payload is sent alone.
     */
    read(reading: AnalogReading, held: z.output<Z>): Partial<z.input<Z>>;
    /** Bind the `camera-drag` gesture: the play screen mounts the drag surface. */
    readonly drag?: boolean;
    /** Show the touch stick; its vector is `stick('left')`. */
    readonly touchStick?: boolean;
}
```

#### `AnalogReading` (interface)

The analog input at one fixed step, read once after `Input.poll()`.

```ts
interface AnalogReading {
    /** The active pad's stick, or the touch stick, as integers −127..127. */
    stick(side: 'left' | 'right'): {
        readonly x: number;
        readonly y: number;
    };
    /** CSS px dragged to the right since the previous tick; 0 unless the map binds the camera drag. */
    cameraDrag(): number;
    /** The player's camera settings. */
    readonly camera: CameraSettings;
}
```

#### `AnalyticsProps` (type)

The properties of one analytics event: flat names to strings, numbers or booleans.

```ts
type AnalyticsProps = Record<string, string | number | boolean>;
```

#### `AppLoop` (interface)

The frame loop service: `run` steps a sim at its fixed tick rate from display frames, with the commands for each
tick, and the renderer draws every frame. No step runs while `Time` is paused; a throw from a step stops it.

```ts
interface AppLoop {
    run(options: {
        sim: Sim;
        commands: (tick: number) => readonly Command[];
    }): void;
    stop(): void;
    readonly running: boolean;
}
```

#### `Audio` (interface)

The audio service: one-shot sounds and looping music on the audio buses, unlocked by the
first gesture after `session.ready`; the game runs silent when no audio context can be built.

```ts
interface Audio {
    /** False until the first gesture after `session.ready` builds and resumes the graph. */
    readonly unlocked: Subscribable<boolean>;
    /** False once a context could not be built (`audio.unavailable`): the game runs silent, and Settings says so. */
    readonly available: Subscribable<boolean>;
    /** Plays the asset at `alias` once. Fire and forget: silent before the unlock, while asleep, or if it fails. */
    sound(alias: string, options?: SoundOptions): void;
    /**
     * Loops the asset at `alias` on the music bus. Asked for before the unlock, it starts on the unlock (and answers at
     * once). A file that is missing or is not audio is an answer, not a throw: the game plays on without that music.
     */
    music(alias: string, options?: MusicOptions): Promise<Result<void, AudioDecodeFailed | AssetLoadFailed>>;
    /** Fades the music out over `fadeSeconds`, a click-free cut by default. */
    stopMusic(fadeSeconds?: number): void;
    /** Takes `bus` down by `amount` (0..1) for `seconds`; `master` ducks every bus. */
    duck(bus: AudioBusName, amount: number, seconds: number): void;
    /** The player's mute: the master only, so unmuting restores the mix as it was. */
    setMuted(muted: boolean): void;
    /**
     * A short tone on `bus`, as the volume sliders play on release, so the player hears the level
     * they set. The graph makes it: no game asset. Silent before the unlock, as every sound is.
     */
    sample(bus: AudioBusName): void;
    /** The player's "mute when in the background": silences the master while another window has focus. */
    setMuteUnfocused(muteUnfocused: boolean): void;
}
```

#### `AUDIO_BUS_NAMES` (const)

The core audio buses: `master` carries the other four, `voice` is announcers and dialogue. Every change to
the set is an API change.

```ts
const AUDIO_BUS_NAMES: readonly ['master', 'music', 'sfx', 'ui', 'voice'];
```

#### `AudioBuses` (interface)

The audio-bus seam. Core audio implements it over Web Audio (a gain node per bus
into `master`, combined there with `Hosting.audio`'s volume and focus); an extension such as Plus
`audio-stream`, or the game, connects its sources to `input(bus)` and never to the destination directly,
so the player's gains and the host's ducking always apply.

```ts
interface AudioBuses {
    /** The node a source connects to so that it plays on `bus`. */
    input(bus: AudioBusName): AudioNode;
    /** The player's current gain for `bus`, 0..1. */
    gain(bus: AudioBusName): number;
    /** Sets the player's gain for `bus`, 0..1. Persisting it is the game's settings' job. */
    setGain(bus: AudioBusName, gain: number): void;
}
```

#### `audioBusGainsSchema` (const)

Validates saved bus gains; a bus left out is at full gain. A gain outside 0..1 fails the parse rather than
being clamped, so `SettingsDef`'s fallback to defaults (runtime `readSettings`) applies to a bad record.

```ts
const audioBusGainsSchema: z.ZodType<AudioBusGains, Partial<Record<AudioBusName, number | undefined>>>;
```

#### `AudioChange` (interface)

The host's audio state: focus (an ad or overlay may duck or mute the game), the master volume, and the gain.

```ts
interface AudioChange {
    focus: {
        state: 'full' | 'ducked' | 'muted';
        reason: 'ad' | 'hidden' | 'host-overlay' | 'system';
    };
    master: {
        volume: number;
        muted: boolean;
    };
    /** 0..1: multiply the game's own mix by this. */
    gain: number;
}
```

#### `AudioChangeSchema` (const)

Checks an audio change.

```ts
const AudioChangeSchema: z.ZodType<AudioChange>;
```

#### `AutosavePolicy` (interface)

When the loaded slot writes itself: on each listed trigger, with `intervalSeconds` for the `interval`
timer.

```ts
interface AutosavePolicy {
    readonly on: readonly AutosaveTrigger[];
    /** Seconds between timer writes, default 60. Read only when `interval` is in `on`. */
    readonly intervalSeconds?: number;
}
```

#### `AutosaveTrigger` (type)

What can make the loaded slot write itself.

```ts
type AutosaveTrigger = 'screen-exit' | 'round-end' | 'background' | 'interval';
```

#### `BarAction` (interface)

One action in an `ActionBar`: an id, a label and a kind (`primary`, `secondary` or `utility`), what it does
when selected, and optionally a short label, an icon, a disabled state and a pressed state.

```ts
interface BarAction {
    readonly id: string;
    readonly label: string;
    /** What a secondary action says from level 2 ("Replay" for "Watch replay"). */
    readonly shortLabel?: string | undefined;
    /** A utility's icon; from level 1 the icon alone stands for it, and the label stays its name. */
    readonly icon?: Snippet | undefined;
    readonly kind: ActionKind;
    /** Receives the click, so an action can act on its own button. */
    readonly onSelect: (event: MouseEvent) => void;
    readonly disabled?: boolean | undefined;
    /** A toggle's state, rendered as `aria-pressed`. */
    readonly pressed?: boolean | undefined;
    /** Defaults to `id`. */
    readonly testId?: string | undefined;
}
```

#### `BootFailurePanel` (const)

The state a boot failure draws: an ErrorPanel with the
failure's copy and its ways forward. The runtime passes its `BootError` and the handlers; this
component decides nothing beyond `bootFailureView`.

```ts
const BootFailurePanel: import("svelte").Component<Props, {}, "">;
type BootFailurePanel = ReturnType<typeof BootFailurePanel>;
```

#### `Button` (const)

The framework's button: an `.af-control` of one kind. A primary carries
`data-kind="primary"`, which both sizes it to the 48 px primary target and tells the layout check
to hold it to that size. The words are the caller's, in the game's language.

```ts
const Button: import("svelte").Component<Props, {}, "">;
type Button = ReturnType<typeof Button>;
```

#### `Camera2d` (interface)

A presentation-only 2D camera over one container: it follows a target, shakes, and writes only that
container's transform, never a sim value.

```ts
interface Camera2d {
    /** The world point to follow. The first call snaps to it. */
    target(x: number, y: number): void;
    /** Adds trauma, 0..1 (capped at 1); it decays over time. */
    shake(trauma: number): void;
    /** Advances one display frame and writes the transform to the container. */
    update(frameSeconds: number): void;
    readonly transform: {
        readonly x: number;
        readonly y: number;
        readonly scale: number;
    };
}
```

#### `Camera2dOptions` (interface)

How `createCamera2d` frames the world: the view's size, and optionally a follow, bounds and zoom.

```ts
interface Camera2dOptions {
    /** The playfield's logical size: the area the camera shows at zoom 1. */
    readonly view: {
        readonly width: number;
        readonly height: number;
    };
    /** Approach the target at `rate` per second; a dead zone, centred on the view, the target may move in freely. */
    readonly follow?: {
        readonly rate: number;
        readonly deadZone?: {
            readonly width: number;
            readonly height: number;
        };
    };
    /** The world rect the view never shows outside of. */
    readonly bounds?: CameraRect;
    /** Default 1; above 1 shows less of the world. */
    readonly zoom?: number;
    /** Default: the player's `prefers-reduced-motion`, read every frame. */
    readonly reducedMotion?: () => boolean;
}
```

#### `CameraDragSurface` (const)

The camera drag surface: the player turns the camera by dragging the scene,
a finger anywhere outside the controls or the mouse with its secondary button.

All the rules of who drags are the tracker's (runtime `CameraDragTracker`); this forwards pointer events with their
`clientX`. It is a fixed layer drawn under the play screen's controls, so a contact on a touch button, the stick,
the corner controls or an ActionBar never reaches it, and its box stops short of the host's reserved strip and of
what the browser lays over the page's foot, so a drag never starts inside `hostReserved`. Pointer only, never in
the focus order.

```ts
const CameraDragSurface: import("svelte").Component<CameraDragSurfaceProps, {}, "">;
type CameraDragSurface = ReturnType<typeof CameraDragSurface>;
```

#### `CameraRect` (interface)

A world-space rectangle, in logical px: `Camera2dOptions.bounds`.

```ts
interface CameraRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
```

#### `CAPABILITIES` (const)

What a game may ask its host for. The names are Ruken's (`@ruken/protocol` `CAPABILITIES`),
kept where they fit; `ruken/conformance.test.ts` holds them to the vendored SDK. Each target's adapter says
which it grants.

```ts
const CAPABILITIES: readonly ["lifecycle", "input", "display", "audio", "exit", "menu", "saves", "leaderboards", "entitlements", "store", "ads", "telemetry", "analytics.custom", "links"];
```

#### `Capability` (type)

One capability a game may ask for.

```ts
type Capability = (typeof CAPABILITIES)[number];
```

#### `CapabilitySchema` (const)

Checks a capability name.

```ts
const CapabilitySchema: z.ZodType<Capability>;
```

#### `ChangedElsewhereCopy` (interface)

The words of the choice paused offers once another device has changed the slot being played.

```ts
interface ChangedElsewhereCopy {
    readonly message: string;
    readonly loadNewer: string;
    readonly keepPlaying: string;
    /** Load newer was chosen and the other device's progress could not be used; this game goes on as it was. */
    readonly failed: string;
}
```

#### `Chip` (const)

A short status label. Its tone is `data-tone` and an edge colour, and never only
that: every tone but `info` also shows a glyph a sighted player reads and says `toneLabel` to
assistive technology, so the tone survives with every colour removed. A warning or danger chip
without words throws while it mounts.

```ts
const Chip: import("svelte").Component<Props, {}, "">;
type Chip = ReturnType<typeof Chip>;
```

#### `classifyFormFactor` (function)

The form factor of a layout viewport: a portrait one narrower than 600 px is `phone-portrait`, any other
portrait one `tablet-portrait`; a landscape one shorter than 500 px is `phone-landscape`, otherwise
`desktop`. A square viewport is landscape.

```ts
function classifyFormFactor(width: number, height: number): FormFactor;
```

#### `classifyHeightTier` (function)

The height tier of a layout height in CSS px: `compact` below 340, `short` up to 600, otherwise
`undefined`.

```ts
function classifyHeightTier(height: number): HeightTier;
```

#### `Clock` (interface)

Time as the runtime reads it: `now()` and timeouts. Tests hand over `fakeClock()` and move it by hand.

```ts
interface Clock {
    /** Milliseconds; only differences between two calls mean anything. */
    now(): number;
    setTimeout(callback: () => void, ms: number): TimeoutHandle;
    clearTimeout(handle: TimeoutHandle): void;
}
```

#### `Command` (interface)

Input to the sim, the only way gameplay state changes from outside. `source` is a player slot (u8), `seq` a per-source counter (u32).

```ts
interface Command {
  readonly tick: number
  readonly source: number
  readonly seq: number
  readonly type: string
  readonly payload: unknown
}
```

#### `CommandDef` (interface)

A command the sim accepts as input: an id and the Zod schema its payload must match. Create one with
`defineCommand`.

```ts
interface CommandDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: 'command'
  readonly id: string
  readonly schema: Z
}
```

#### `CompiledContentData` (interface)

The compiled JSON content read by the runtime.

```ts
interface CompiledContentData {
    readonly flow: FlowGraph;
    readonly assets?: AssetsSource | undefined;
    readonly game?: GameSource | undefined;
    readonly [key: string]: unknown;
}
```

#### `ComponentDef` (interface)

A component: a stable id and a flat record of typed fields. Create one with `defineComponent`; game code
addresses entity data through the definition, never through `trait`.

```ts
interface ComponentDef<S extends FieldSchema = FieldSchema> {
  readonly kind: 'component'
  readonly id: string
  readonly fields: S
  /** Field names in sorted order: the order used by snapshots. */
  readonly fieldNames: readonly string[]
  /** Included in RenderDelta rows (default true). */
  readonly render: boolean
  /** Internal Koota storage. Game code never touches it. */
  readonly trait: Trait
}
```

#### `contentHashOf` (function)

The content hash formula: hex64(xxhash64(utf8(canonicalJson(data)))).
Matches `@automata/content`'s contentHash formula, pinned by tests.

```ts
function contentHashOf(data: unknown): string;
```

#### `controlsFrom` (function)

The input map for a controls file. Throws when the file is for another command, and when an action's `send` is
not something the command takes, naming the action.

```ts
function controlsFrom<Z extends z.ZodType>(command: CommandDef<Z>, file: ControlsFile): InputMap;
```

#### `CORE_SETTINGS` (const)

The `settings` save, version 1: the player's bindings (`input`), graphics quality (`display`), audio (`audio`),
vibration (`haptics`) and camera turn (`camera`).

```ts
const CORE_SETTINGS: SettingsDef<CoreSettings>;
```

#### `CoreSettings` (interface)

The settings every game carries: input bindings, display, audio and vibration.

```ts
interface CoreSettings {
    readonly input: InputSettings;
    readonly display: DisplaySettings;
    /** The Audio group's choices; a record saved before it reads them as the defaults. */
    readonly audio: AudioSettings;
    /** The Vibration group's toggle (Owner, 2026-10-18); a record saved before it reads it as on. */
    readonly haptics: HapticsSettings;
    /** "Camera turn speed" and "Invert camera"; a record saved before them reads them as the defaults. */
    readonly camera: CameraSettings;
}
```

#### `createCamera2d` (function)

A camera writing `stage`'s transform (usually `PixiStage.world`). `seed` fixes the shake's random sequence,
so a shake looks the same in every run and visual test.

```ts
function createCamera2d(stage: Container, options: Camera2dOptions, seed?: number): Camera2d;
```

#### `createGeometryOwner` (function)

Creates the geometry owner of a document, the only writer of its geometry: make one per document. It measures
at once, on every resize of the window or the visual viewport, and again at 100, 400 and 1000 ms as bars and
the keyboard settle, and publishes each measure on the root.

```ts
function createGeometryOwner(options: GeometryOwnerOptions): GeometryOwner;
```

#### `createPixiRenderer` (function)

The core 2D renderer (ADR 0002) as a runtime `RendererFactory`: a letterboxed Pixi app on the render
target, entity views from each step's render delta, interpolated each frame. Answers `RendererUnavailable`
when the renderer cannot start; `dispose` destroys the app and removes its canvas.

```ts
function createPixiRenderer(options?: PixiRendererOptions): (target: RenderTarget) => Promise<Result<PixiRenderer, RendererUnavailable>>;
```

#### `createPostFilterSlot` (function)

A post-filter slot writing its composed filters to `target`'s `filters`.

```ts
function createPostFilterSlot(target: PostFilterTarget): PostFilterSlot;
```

#### `createT` (function)

`t` over a messages module (`import * as m from './paraglide/messages.js'`). Each call reads the current
locale, so a screen that calls `t` again after `'locale.changed'` shows the new language without a remount.
An unknown key throws, naming it: the types already forbid it, so it means the catalog and the code drifted.

```ts
function createT<Messages extends Record<string, unknown>>(messages: Messages): Translate<Messages>;
```

#### `defaultContent` (function)

The default flow `title → play ⇄ paused → title`, with `paused ⇄ settings`, and its hash.

```ts
function defaultContent(): GameContent;
```

#### `defaultScreens` (function)

The title, play, paused and settings screens over the default content's flow
(`title → play ⇄ paused → title`, `paused ⇄ settings`).

The screens share one sim: play creates it on first entry (seed, plugins, content, then `setup`),
paused keeps it, and the title drops it, so Quit to title and Play start again at tick 0. A runtime that shuts
down with the sim alive drops it too, whichever screen is current. Returning
from paused re-sends the whole state to the renderer (G-5): `AppLoop.run` resets the renderer, so
play restores the sim's own snapshot, which makes the next step a resync.

```ts
function defaultScreens(game: ScreensGame): ScreenDef[];
```

#### `defineCommand` (function)

Defines a command by id and payload schema. Throws for an id that is not lower-case words separated by dots
or dashes.

```ts
function defineCommand<Z extends z.ZodType>(id: string, schema: Z): CommandDef<Z> {
  checkId('command', id)
  return { kind: 'command', id, schema }
}
```

#### `defineComponent` (function)

Defines a component from an id (lower-case words separated by dots or dashes) and its fields by name and
type. `render: false` keeps it out of the renderer's deltas. Throws for a bad id, no fields, a bad field
name or an unknown field type.

```ts
function defineComponent<S extends FieldSchema>(
  id: string,
  fields: S,
  opts: { render?: boolean } = {},
): ComponentDef<S> {
  checkId('component', id)
  const fieldNames = sortedKeys(fields)
  if (fieldNames.length === 0) throw new Error(`component "${id}" needs at least one field`)
  const defaults: Record<string, number | boolean | string> = {}
  for (const name of fieldNames) {
    const type = fields[name] as FieldType
    if (!FIELD_RE.test(name)) throw new Error(`component "${id}" has invalid field name "${name}"`)
    if (!FIELD_TYPES.includes(type))
      throw new Error(`component "${id}" field "${name}" has unknown field type "${type}"`)
    defaults[name] = defaultField(type)
  }
  // A factory, not a schema object: Koota builds structure-of-arrays accessors for a schema object with
  // `new Function`, which Ruken's CSP (no 'unsafe-eval') blocks. Each entity holds its own record instead
  // (array-of-structures); the entity store always writes whole records, so nothing else changes.
  const traitDef = trait(() => ({ ...defaults }))
  return { kind: 'component', id, fields, fieldNames, render: opts.render ?? true, trait: traitDef }
}
```

#### `DefinedGame` (interface)

The runtime's `GameDefinition`, plus what the screens and the golden replay read from the spec.

```ts
interface DefinedGame<S = never> extends GameDefinition<S> {
    readonly id: string;
    readonly title: string;
    readonly size: {
        readonly width: number;
        readonly height: number;
    };
    readonly input?: InputMap | undefined;
    readonly sim: {
        readonly plugins: readonly PluginDef[];
        readonly seed: number;
        readonly setup?: ((sim: Sim) => void) | undefined;
        readonly content?: unknown;
    };
}
```

#### `defineEvent` (function)

Defines an event by id and payload schema, to emit from a system with `ctx.emit`. Events come back in
`StepResult.events`; `ctx.emit` throws for a payload that fails the schema.

```ts
function defineEvent<Z extends z.ZodType>(id: string, schema: Z): EventDef<Z> {
  checkId('event', id)
  return { kind: 'event', id, schema }
}
```

#### `defineGame` (function)

Checks a spec and fills in every default over the runtime, the Pixi renderer, Ruken hosting and the default
screens; `startGame` boots the result. Pure: it reads no document, so a game module also loads in Node.
Throws `BootDefect` (its cause a `GameSpecError`) for an invalid spec.

```ts
function defineGame<S = never, D = unknown>(spec: GameSpec<S, D>): DefinedGame<S>;
```

#### `definePlugin` (function)

Defines a plugin from a name, its dependencies and its definitions, given in the keyed lists or in one flat
`defs` list sorted by kind. A plugin written either way registers the same lists and gets the same schema
hash. `config` is copied as canonical, frozen JSON, so anything that cannot hash exactly throws a
`CanonicalJsonError` here.

```ts
function definePlugin(spec: {
  name: string
  dependsOn?: readonly string[]
  /** One flat list, sorted into the keyed lists by `kind`; each entry follows that list's keyed entries. */
  defs?: readonly Def[]
  components?: readonly ComponentDef[]
  commands?: readonly CommandDef[]
  events?: readonly EventDef[]
  resources?: readonly ResourceDef[]
  systems?: readonly SystemDef[]
  state?: (setup: PluginStateSetup) => Promise<PluginState>
  config?: unknown
}): PluginDef {
  checkId('plugin', spec.name)
  // A canonical, frozen copy: it throws CanonicalJsonError for anything that cannot hash exactly, and nobody
  // can change it after it joins the schema hash.
  const config = spec.config === undefined ? undefined : deepFreeze(JSON.parse(canonicalJson(spec.config)))
  // Keyed entries first, then `defs` in order, so a plugin written either way registers the same lists in the
  // same order and gets the same schema hash. Duplicates are left for createSim to reject, as they are today.
  const components = [...(spec.components ?? [])]
  const commands = [...(spec.commands ?? [])]
  const events = [...(spec.events ?? [])]
  const resources = [...(spec.resources ?? [])]
  const systems = [...(spec.systems ?? [])]
  for (const def of spec.defs ?? []) {
    if (def.kind === 'component') components.push(def)
    else if (def.kind === 'command') commands.push(def)
    else if (def.kind === 'event') events.push(def)
    else if (def.kind === 'resource') resources.push(def)
    else if (def.kind === 'system') systems.push(def)
    else
      throw new Error(
        `plugin "${spec.name}" defs has an entry of unknown kind "${(def as { kind: unknown }).kind}"`,
      )
  }
  return {
    kind: 'plugin',
    name: spec.name,
    dependsOn: spec.dependsOn ?? [],
    components,
    commands,
    events,
    resources,
    systems,
    state: spec.state,
    config,
  }
}
```

#### `defineResource` (function)

Defines a resource by id, schema and starting value. `createSim` parses `init()` with the schema, so a bad
start fails there.

```ts
function defineResource<Z extends z.ZodType>(
  id: string,
  schema: Z,
  init: () => z.input<Z>,
): ResourceDef<Z> {
  checkId('resource', id)
  return { kind: 'resource', id, schema, init }
}
```

#### `defineSave` (function)

Declares a save. It checks nothing the SDK checks; it only gives the definition its type.

```ts
function defineSave<S>(def: SaveDef<S>): SaveDef<S>;
```

#### `defineSystem` (function)

A system: `defineSystem(name, run)` runs in `gameplay`, `defineSystem(name, phase, run)` in that phase, and the
object form also takes `before`/`after`. All three build the same SystemDef.

```ts
function defineSystem(name: string, run: (ctx: SimContext) => void): SystemDef
function defineSystem(name: string, phase: Phase, run: (ctx: SimContext) => void): SystemDef
function defineSystem(spec: SystemSpec): SystemDef
function defineSystem(
  nameOrSpec: string | SystemSpec,
  phaseOrRun?: Phase | ((ctx: SimContext) => void),
  run?: (ctx: SimContext) => void,
): SystemDef {
  if (typeof nameOrSpec !== 'string') return defineSystemFrom(nameOrSpec)
  if (typeof phaseOrRun === 'function')
    return defineSystemFrom({ name: nameOrSpec, phase: 'gameplay', run: phaseOrRun })
  return defineSystemFrom({
    name: nameOrSpec,
    phase: phaseOrRun as Phase,
    run: run as (ctx: SimContext) => void,
  })
}
```

#### `Dialog` (const)

A question that needs an answer before the screen goes on. The screen renders it only while it is open
(`{#if open}<Dialog>`) and decides what each action does; `onclose` is what Escape means, and it
should mean the safe choice.

Keyboard and focus (the rules live in `modal-scope.ts`, which Modal and Sheet share):
- Initial focus goes to the control marked `data-initial-focus` (the safe action), else the
  first control, else the dialog itself.
- Tab and Shift+Tab wrap inside the dialog, and focus that lands outside it is pulled back in.
  The scrim covers the page, so a pointer cannot reach out either.
- When the dialog goes away, focus returns to whatever had it before the dialog opened.
- Escape calls `onclose`. The focus navigator's Back arrives as Escape, so a controller closes
  it the same way. With dialogs stacked, only the topmost answers Escape and holds focus.
- While it is open the page behind it is `inert` (every sibling of the dialog and of each of its
  ancestors up to the body), so assistive technology and the browser cannot reach it either.

Layout: a sheet on the bottom edge on a phone, centred otherwise; always inside the insets and
above the keyboard. Its body is a declared scroll region, so on a 780 x 270 screen the actions
stay reachable however long the text is.

```ts
const Dialog: import("svelte").Component<Props, {}, "">;
type Dialog = ReturnType<typeof Dialog>;
```

#### `DisplayMetricsPayload` (interface)

The game's display: insets the game must keep clear, the area the host reserves for its own controls, and the
UI scale hint (1.333 on a TV: enlarge text and targets, never CSS zoom).

```ts
interface DisplayMetricsPayload {
    safeArea: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    hostReserved: {
        edge: 'right' | 'left';
        rect: {
            x: number;
            y: number;
            w: number;
            h: number;
        };
    };
    orientation: 'portrait' | 'landscape';
    fullscreen: boolean;
    scale: 1 | 1.333;
}
```

#### `DisplayMetricsPayloadSchema` (const)

Checks display metrics.

```ts
const DisplayMetricsPayloadSchema: z.ZodType<DisplayMetricsPayload>;
```

#### `Disposables` (interface)

A list of "undo this" functions, run together once: what a screen, a run or a service holds open.

```ts
interface Disposables {
    /**
     * Runs `undo` at disposal. Added after disposal it runs at once, so a late arrival is never leaked. Returns a
     * function that takes `undo` back out (a listener that was stopped by hand has nothing left to undo).
     */
    add(undo: () => void): () => void;
    /** Runs what was added, last added first, once. Later calls do nothing. */
    dispose(): void;
    readonly disposed: boolean;
}
```

#### `disposables` (function)

Makes an empty `Disposables`.

```ts
function disposables(): Disposables;
```

#### `DrawContext` (interface)

What `draw` receives each frame. Coordinates are logical playfield pixels (plan D-2).

```ts
interface DrawContext {
    /** The sim at this frame, read-only. */
    readonly sim: DrawSim;
    readonly frame: FrameInfo;
    /** The playfield's logical size. */
    readonly width: number;
    readonly height: number;
    rect(x: number, y: number, w: number, h: number, color: number): void;
    circle(x: number, y: number, radius: number, color: number): void;
    line(x1: number, y1: number, x2: number, y2: number, color: number, width?: number): void;
    /** One line of text, its top-left at (x, y). */
    text(value: string, x: number, y: number, options?: DrawTextOptions): void;
}
```

#### `DrawEntity` (interface)

One entity, read-only: its components' values are frozen copies.

```ts
interface DrawEntity {
    readonly sid: number;
    has(component: ComponentDef): boolean;
    get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>;
}
```

#### `DrawSim` (interface)

The sim at this frame, read-only.

```ts
interface DrawSim {
    readonly tick: number;
    query(...components: ComponentDef[]): DrawEntity[];
    entity(sid: number): DrawEntity | undefined;
    /** A deep-frozen copy of the resource's value. */
    resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>;
}
```

#### `DrawTextOptions` (interface)

Options for `DrawContext.text`: colour and font size.

```ts
interface DrawTextOptions {
    /** Default 0xffffff. */
    readonly color?: number | undefined;
    /** Font size in logical pixels. Default 8. */
    readonly size?: number | undefined;
}
```

#### `EntitlementsPayload` (interface)

What the player owns: whether ads show, permanent items and subscriptions, and whether this is a dev build.

```ts
interface EntitlementsPayload {
    ads: boolean;
    items: string[];
    subscriptions: SubscriptionEntitlement[];
    devBuild: boolean;
}
```

#### `EntitlementsPayloadSchema` (const)

Checks entitlements.

```ts
const EntitlementsPayloadSchema: z.ZodType<EntitlementsPayload>;
```

#### `EntityRef` (interface)

A live entity, addressed by its StableId. Writes are coerced per field type and mark the entity changed.

```ts
interface EntityRef {
  readonly sid: number
  has(component: ComponentDef): boolean
  get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>
  set<S extends FieldSchema>(component: ComponentDef<S>, values: Partial<FieldValues<S>>): void
  add<S extends FieldSchema>(component: ComponentDef<S>, values?: Partial<FieldValues<S>>): void
  remove(component: ComponentDef): void
}
```

#### `EntityView` (interface)

What an entity view factory returns: the container drawn for one entity, updated with its current and
previous component values and the interpolation alpha, and destroyed when the entity goes.

```ts
interface EntityView<C extends SceneNode = Container> {
    readonly container: C;
    update?(curr: Readonly<Record<string, Readonly<FieldRecord>>>, prev?: Readonly<Record<string, Readonly<FieldRecord>>> | undefined, alpha?: number): void;
    destroy?(): void;
}
```

#### `ERROR_CODES` (const)

Why a host call failed. The codes are Ruken's (`@ruken/protocol` `ERROR_CODES`), kept where they
fit; `ruken/conformance.test.ts` holds them to the vendored SDK.

```ts
const ERROR_CODES: readonly ["UNSUPPORTED", "NOT_READY", "TIMEOUT", "RATE_LIMITED", "QUOTA_EXCEEDED", "INVALID_PAYLOAD", "DENIED", "OFFLINE", "CANCELLED", "INTERNAL"];
```

#### `ErrorAction` (interface)

One way forward from a failure.

```ts
interface ErrorAction {
    readonly id: string;
    readonly label: string;
    readonly kind: 'primary' | 'secondary';
    readonly onSelect: () => void;
}
```

#### `ErrorCode` (type)

One error code.

```ts
type ErrorCode = (typeof ERROR_CODES)[number];
```

#### `ErrorCodeSchema` (const)

Checks an error code.

```ts
const ErrorCodeSchema: z.ZodType<ErrorCode>;
```

#### `ErrorPanel` (const)

A failure, and what the player can do about it.

`role="alert"` rather than `role="status"`, because this interrupts: the player usually just
pressed something and needs to know it did not work. The panel is opaque, because a failure is
often the thing that means the artwork did not arrive. It sits at the top of the visible region,
under the corner row, so it never covers the way out of the screen it reports on, and its layer
passes taps through everywhere but the panel.

Where the room is short (a long message, a keyboard), the panel gives up space in this order:
first the message, which scrolls, down to one visible line; only then the gap that keeps it under
the corner row, so it rises over Back only when its actions cannot fit any other way. A final
panel has no actions and is the screen's last word, so it never rises: Back is its way out. The
actions sit outside the scrolling part and never shrink (framework audit of #7).

```ts
const ErrorPanel: import("svelte").Component<Props, {}, "">;
type ErrorPanel = ReturnType<typeof ErrorPanel>;
```

#### `EventDef` (interface)

An event a system emits: an id and the Zod schema its payload must match. Create one with `defineEvent`.

```ts
interface EventDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: 'event'
  readonly id: string
  readonly schema: Z
}
```

#### `filterPrograms` (function)

Builds a filter's programs from its GLSL and WGSL fragment stages on the shared vertex stages, so WebGL2
stays at parity with WebGPU (AGENTS.md).

```ts
function filterPrograms(name: string, fragmentGlsl: string, fragmentWgsl: string): FilterProgramsResult;
```

#### `findRukenSdkMarkers` (function)

The markers found in `code` (built JavaScript), each named once; empty means no Ruken SDK code.

```ts
function findRukenSdkMarkers(code: string): string[];
```

#### `findTauriMarkers` (function)

The Tauri markers found in `code` (built JavaScript), each named once; empty means no Tauri IPC code.

```ts
function findTauriMarkers(code: string): string[];
```

#### `Flow` (interface)

The screen flow service: the current screen, `dispatch` to follow an event's transition from it, `openMenu`
for the current screen's menu, and `settled()` once no transition is pending.

```ts
interface Flow {
    readonly current: string | undefined;
    dispatch(event: string): boolean;
    openMenu(): boolean;
    /** Resolves once no transition is queued or running (at once when the flow is idle). */
    settled(): Promise<void>;
}
```

#### `FormFactor` (type)

The four form factors.

Decided from the layout viewport's size alone. Whether the pointer is coarse is a different
question: it decides which controls mount, not how a screen is laid out. So a tablet with a
keyboard and a desktop with a touch screen both get the layout their shape asks for.

The one place the thresholds live. CSS reads the answer from `data-form-factor`, script from
the geometry owner, and neither re-derives it.

```ts
type FormFactor = 'phone-portrait' | 'phone-landscape' | 'tablet-portrait' | 'desktop';
```

#### `FrameInfo` (interface)

One display frame: the interpolation alpha between the last two ticks, the frame's length in ms, and
whether time is paused.

```ts
interface FrameInfo {
    alpha: number;
    frameMs: number;
    paused: boolean;
}
```

#### `FullscreenRes` (interface)

The answer to a fullscreen request: the new state, and how this device can go fullscreen at all.

```ts
interface FullscreenRes {
    fullscreen: boolean;
    support: 'element' | 'ios-home-screen' | 'none';
}
```

#### `FullscreenResSchema` (const)

Checks a fullscreen answer.

```ts
const FullscreenResSchema: z.ZodType<FullscreenRes>;
```

#### `GameAudioServices` (interface)

What a game's own audio player is given: the audio service (also the buses' seam) and the presentation bus.

```ts
interface GameAudioServices {
    readonly audio: Audio & AudioBuses;
    readonly bus: PresentationBus;
}
```

#### `GameAudioStart` (type)

Starts a game's audio player; the function it returns stops it.

```ts
type GameAudioStart = (services: GameAudioServices) => (() => void) | undefined;
```

#### `GameCopy` (type)

A game's words: the runtime's boot and failure copy, and the default screens' words.

```ts
type GameCopy = NonNullable<GameDefinition['copy']> & {
    /** The default screens' words, over their English defaults: a part of `ScreensCopy`, or a function of the locale. */
    readonly screens?: ScreensCopyInput | undefined;
};
```

#### `GameDefinition` (interface)

Everything a game provides to the runtime to boot.

```ts
interface GameDefinition<S = never> {
    readonly root: HTMLElement;
    readonly hosting: Omit<HostingOptions, 'disclosedEvents'>;
    readonly content: {
        readonly data: CompiledContentData;
        readonly hash: string;
    };
    readonly screens: readonly ScreenDef[];
    /**
     * Files fetched with the preload screens' own (byte progress, the 30 s stall rule) before the renderer starts,
     * outside the content: a game without `content/` lists its 3D models here. They are not part of
     * `content.hash`, so a new origin or a rebuilt file never changes the hash saves are stamped with.
     */
    readonly preload?: readonly string[] | undefined;
    readonly renderer: RendererFactory;
    readonly settings?: SettingsDef<S> | undefined;
    /**
     * The game's save: its slots, autosave and migrations. Boot opens it, wires its triggers and flushes it when
     * the host closes the game; a screen reaches it with `saveOf(def)`. Absent, the game has no save and the runtime
     * reads and writes nothing for one.
     */
    readonly saves?: SaveDef<unknown> | undefined;
    /**
     * The orientation the game plays in, as the ship config's `runtime.orientation` says. A `portrait` or
     * `landscape` game on a phone held the other way pauses behind the rotate hint. Default `any`.
     */
    readonly orientation?: GameOrientation | undefined;
    /** How a locked orientation says so on a phone held the other way: `'block'` (the default) or `'toast'`. */
    readonly rotateHint?: RotateHintMode | undefined;
    /**
     * The game's languages: pass its Paraglide `runtime.js` (`import * as runtime from './paraglide/runtime.js'`).
     * Absent, the game has one locale, the content's `source_language`.
     */
    readonly locale?: LocaleDef | undefined;
    readonly extensions?: readonly ExtensionDef[] | undefined;
    /** The sound each sim event plays, by the event's type. */
    readonly sounds?: EventSounds | undefined;
    /**
     * The game's own audio player, started once the runtime has built its audio service: cues for events, music for the
     * game's state. It plays through the service's buses, hears the presentation bus and never writes the sim. What it
     * returns undoes it at shutdown.
     */
    readonly audio?: GameAudioStart | undefined;
    /** The board and score each sim event submits, by the event's type. Needs the `leaderboards` grant. */
    readonly scores?: EventScores | undefined;
    readonly copy?: Partial<BootFailureCopy> & {
        readonly loading?: string;
        readonly slow?: string;
        /** The panel when the renderer's graphics context is lost for good. */
        readonly contextLost?: string;
    };
    readonly seams?: RuntimeSeams;
}
```

#### `GameRenderer` (interface)

What the runtime asks of a renderer: apply each step's result, draw each frame, and reset for a new sim.

```ts
interface GameRenderer {
    apply(result: StepResult): void;
    draw(frame: FrameInfo): void;
    reset(): void;
}
```

#### `GameSaves` (interface)

What a game saves, and how the default screens read it from the sim and put it back. The title lists the
save's slots; New game writes the starting data, Continue loads a slot, and play keeps it saved while it runs, on
the triggers the `def` declares (autosave).

```ts
interface GameSaves<D> {
    readonly def: SaveDef<D>;
    /**
     * The data to keep, read from the live sim when a trigger writes, and for a new game from the sim at tick 0. It
     * only reads: it must not change the sim.
     */
    capture(sim: Sim): D;
    /** Puts a loaded slot's data into the freshly set-up sim, before tick 0. */
    apply(sim: Sim, data: D): void;
    /** The label a new game gives its slot on the list ("Run 2"). Default: none, and the list says "Slot N". */
    label?(slot: number): string;
}
```

#### `GameSpec` (interface)

A game in one object: its id, size and sim, and optionally its title, input, views, sounds,
scores, saves, content, screens, settings, extensions, draw layer and host and renderer options.
`defineGame` fills in every default.

```ts
interface GameSpec<S = never, D = unknown> {
    /** Ruken's game id (`[game].id`), checked with Ruken's own rule; it is `hosting.gameId`. */
    readonly id: string;
    /** Shown on the title screen. Default: the id. */
    readonly title?: string;
    /** The playfield in logical pixels. */
    readonly size: {
        readonly width: number;
        readonly height: number;
    };
    readonly sim: {
        readonly plugins: readonly PluginDef[];
        /** Default 1. */
        readonly seed?: number;
        /** Spawns the starting entities before tick 0. */
        readonly setup?: (sim: Sim) => void;
    };
    /**
     * The orientation the game plays in, the same as the ship config's `runtime.orientation`. On a phone held
     * the other way a `portrait` or `landscape` game pauses behind the rotate hint. Default `any`.
     */
    readonly orientation?: GameOrientation;
    /** On a phone held the other way: `'block'` (the default) covers and pauses; `'toast'` says so and plays on. */
    readonly rotateHint?: RotateHintMode;
    /** Default: no commands. */
    readonly input?: InputMap;
    /** Component id → view (`rect`, `sprite`). */
    readonly views?: Readonly<Record<string, EntityViewFactory>>;
    /**
     * The sound each sim event plays, by the event's id: `{ [Chime.id]: 'chime.wav' }`, or `{ alias, bus, gain }`.
     * Silent until the player's first gesture (browsers allow no sound before it).
     */
    readonly sounds?: EventSounds;
    /**
     * The game's own audio player (`@automata/audio-synth/stage`), started once the runtime has built its audio service:
     * it plays cues for sim events and music for the game's state through the service's buses. Presentation only; what it
     * returns undoes it at shutdown.
     */
    readonly audio?: GameAudioStart;
    /**
     * The board and score each sim event submits, by the event's id:
     * `{ [RunEnded.id]: { board: 'best', score: (payload) => RunEnded.schema.parse(payload).score } }`. The board is a key
     * of the ship config's `leaderboards`; the game then asks the host for `leaderboards`.
     */
    readonly scores?: EventScores;
    /**
     * The game's save: its slots, how the sim is captured into them and put back. The game then asks the host
     * for `saves`. Needs the default screens for the title's slot list; custom `screens` open the save themselves.
     */
    readonly saves?: GameSaves<D>;
    /** A game with `content/` passes the compiler's output; `sim` is the sim's partition of it. */
    readonly content?: {
        readonly data: CompiledContentData;
        readonly hash: string;
        readonly sim?: unknown;
    };
    /** Default: title, play and paused. */
    readonly screens?: readonly ScreenDef[];
    /** Default: `#game`. */
    readonly root?: HTMLElement;
    readonly hosting?: Partial<Omit<HostingOptions, 'gameId' | 'disclosedEvents'>>;
    /**
     * Default: the core settings (`CORE_SETTINGS`, the save `settings`), with the player's bindings and graphics
     * quality. A game's own settings keep those only when its schema has `input: inputSettingsSchema` and
     * `display: displaySettingsSchema`.
     */
    readonly settings?: SettingsDef<S>;
    readonly extensions?: readonly ExtensionDef[];
    /**
     * Immediate-mode HUD, debug and prototype drawing over the entity views, once per display frame while the
     * default screens hold a sim. It reads the sim and never writes it. Needs the default screens.
     */
    readonly draw?: (ctx: DrawContext) => void;
    /**
     * The 2D level the game shows: the tiles, auto tiles, objects and placed characters painted in the editor, drawn
     * under the entity views (`levelScene`). Needs the default screens, which hand it the sim, and a 2D game: a 3D game
     * draws its rooms itself.
     */
    readonly level?: LevelScene;
    /** Merged over the defaults (`pixelArt`, the logical size and the views). */
    readonly renderer?: PixiRendererOptions;
    /**
     * Makes the renderer from the Pixi options `defineGame` built (the size, pixel art, the views, `renderer` and
     * the draw layer's and Settings' `setup`): an extension's renderer, such as a 3D extension's
     * `(options) => createPixi3dRenderer({ ...options, views })`. Default: core's `createPixiRenderer`.
     */
    readonly createRenderer?: (options: PixiRendererOptions) => RendererFactory;
    /**
     * Files the runtime fetches with the preload screens, with byte progress and the 30 s stall rule, before
     * the renderer starts: model files a 3D view draws, for example. They stay out of the content and its hash, so a
     * new origin or a rebuilt file never changes the hash a save is stamped with.
     */
    readonly preload?: readonly string[];
    /**
     * The game's words: the runtime's boot and failure copy, and `screens`, the default screens' words over their
     * English defaults. `screens` may be a function of the locale, run again on each language change, so a
     * Paraglide game passes its messages: `screens: () => ({ title: { play: m.play() } })`.
     */
    readonly copy?: GameCopy;
    /** The game's languages: Settings' Language group offers them. Absent, the content's one language. */
    readonly locale?: GameDefinition['locale'];
    /** Tests only. */
    readonly seams?: RuntimeSeams;
}
```

#### `GameSpecError` (class)

Every invalid field of a spec, by path: `size.width: …`.

```ts
class GameSpecError extends Error {
    readonly problems: readonly string[];
    constructor(problems: readonly string[]);
}
```

#### `Geometry` (interface)

The geometry every screen lays out against: the layout size, form factor and height tier, the insets, the
usable and visible regions, what covers the page's foot, and the host's scale hint.

```ts
interface Geometry {
    readonly layout: {
        readonly width: number;
        readonly height: number;
    };
    readonly formFactor: FormFactor;
    readonly heightTier: HeightTier;
    /** Per side, the largest of the env inset, the host's safe area and the host's reserved strip. */
    readonly insets: Insets;
    readonly hostReserved: {
        readonly left: number;
        readonly right: number;
    };
    /** The layout viewport less the insets. */
    readonly usable: Rect;
    /** What the browser lays over the page's foot (keyboard, a bottom toolbar, a hidden bar), in whole px. */
    readonly visualInsetBottom: number;
    /** The part of `visualInsetBottom` that is a bar the browser does not report, in whole px. */
    readonly hiddenBarBottom: number;
    /** How much a keyboard shrank the layout viewport itself (see `restingLayout`), in whole px. */
    readonly keyboardResize: number;
    /** `usable` less the visual inset: what the player can actually see and reach. */
    readonly visible: Rect;
    readonly scale: HostDisplay['scale'];
}
```

#### `GeometryState` (interface)

The current geometry as rune state: reading `current` in a component or `$derived` tracks it.

```ts
interface GeometryState {
    readonly current: Geometry;
}
```

#### `HeightTier` (type)

The height tiers.

The form factor says what shape a screen is; the tier says how much height it has to spend.
Two screens of the same form factor can need different answers: a 1280 x 720 desktop and a
900 x 600 window are both desktop, and only one can afford a hero above the menu.

Written to `<html data-height>` by the geometry owner. Tokens tighten under it, so every
primitive tightens at once. Targets never shrink with the tier; gutters and decoration do.

```ts
type HeightTier = 'short' | 'compact' | undefined;
```

#### `HOST_EXIT_CAP_MS` (const)

How long the game may hold the host's close, in milliseconds (Ruken's own grace is 1.5 s, so we answer first).

```ts
const HOST_EXIT_CAP_MS = 1000;
```

#### `HostHandshakeFailed` (interface)

The page is inside a frame, but the SDK got no usable welcome and fell back to its standalone session. Not fatal:
reported on `Hosting.handshake.fellBack` and logged once.

```ts
interface HostHandshakeFailed {
    /** The Ruken SDK does not say whether it timed out or rejected a welcome. */
    readonly reason: 'no-welcome';
}
```

#### `Hosting` (interface)

Everything a game may ask of, or hear from, its host. Every target's adapter builds one of these.

```ts
interface Hosting {
    /** 'ruken' when Ruken hosts it; 'standalone' for the Ruken adapter's standalone session; 'web'; 'tauri'. */
    readonly kind: 'ruken' | 'standalone' | 'web' | 'tauri';
    /** The host's name for UI: 'Ruken', 'itch.io', 'this page', or the game's title on the desktop. */
    readonly hostName: string;
    /** Set when the page is inside a frame but the SDK fell back to standalone. */
    readonly handshake: {
        readonly fellBack: HostHandshakeFailed | null;
    };
    readonly player: {
        readonly id: string;
        readonly displayName: string;
    };
    readonly locale: string;
    readonly granted: ReadonlySet<Capability>;
    /** Answers on `session.ready` (at once standalone). No gameplay renders before it (R-04). Never rejects. */
    readonly ready: Promise<HostResult<void>>;
    readonly lifecycle: Subscribable<LifecyclePayload>;
    readonly input: Subscribable<InputModePayload>;
    readonly display: Subscribable<DisplayMetricsPayload>;
    readonly audio: Subscribable<AudioChange>;
    readonly entitlements: Subscribable<EntitlementsPayload>;
    readonly savesStatus: Subscribable<SavesStatus>;
    readonly saves: HostingSaves;
    readonly leaderboards: HostingLeaderboards;
    /** `support` in the answer says what the device allows (for example `ios-home-screen`). */
    setFullscreen(on: boolean): Promise<HostResult<FullscreenRes>>;
    readonly round: {
        /** A round began. A second start before an end is dropped. */
        start(): void;
        /** The open round ended. With no round open it is dropped. */
        end(outcome?: RoundOutcome): void;
        /** One event per round that ended, with its outcome, from the moment of subscribing. A dropped end gives none. */
        readonly ended: Listenable<RoundOutcome | undefined>;
    };
    /** A disclosed analytics event. Never fails: undisclosed, unconsented or refused events are dropped. */
    track(event: string, props?: AnalyticsProps): void;
    /** Hands the player back to the host. Standalone it is refused `UNSUPPORTED`. */
    exit(reason?: 'player' | 'completed'): Promise<HostResult<void>>;
    /**
     * Answers the host's "Open game menu": the handler returns true when the game opened its own menu. Returns the
     * function that takes the handler back. With no handler the host keeps its own drawer.
     */
    onMenuRequest(handler: () => boolean): () => void;
    /**
     * Runs `handler` when the host closes the game. The host waits for it, but AF cuts everything off at
     * `HOST_EXIT_CAP_MS`. Handlers run one after another in registration order and the host save flush runs after the
     * last, so a write a handler makes is flushed. Returns the function that takes the handler back.
     */
    onExiting(handler: () => void | Promise<void>): () => void;
    /** Shuts Hosting down: later calls are refused `CANCELLED`, every subscription stops, the session is released. */
    dispose(): void;
}
```

#### `HostingLeaderboards` (interface)

The host's leaderboards. Needs the `leaderboards` grant; without it a call is refused `UNSUPPORTED`.

```ts
interface HostingLeaderboards {
    submit(board: string, score: number, meta?: LeaderboardSubmitMeta): Promise<HostResult<LeaderboardSubmitRes>>;
    get(board: string, query?: LeaderboardQuery): Promise<HostResult<LeaderboardGetRes>>;
}
```

#### `HostingOptions` (interface)

What the game asks of its host. The game passes these by hand; content does not list them yet.

```ts
interface HostingOptions {
    /** The game config's `game.id`; a host that knows the game (Ruken) checks it. */
    readonly gameId: string;
    /** The capabilities the game asks the host for (`wants` in the hello). */
    readonly wants: readonly Capability[];
    /** Fixed for the game's whole life (Ruken's answer 7 in docs/archive/spikes/s6-ruken-stub.md). */
    readonly pauseBehavior: PauseBehavior;
    /**
     * The game config's `analytics.custom_events`. When given, `track` drops every
     * other name before it reaches the SDK.
     */
    readonly disclosedEvents?: readonly string[];
    /**
     * Ruken adapter, test builds only: exact https origins also trusted to send the welcome. Passed to `Ruken.init`
     * as is; other adapters ignore it.
     */
    readonly testHostOrigins?: readonly string[];
}
```

#### `HostingSaves` (interface)

The player's saves. Each call relays the host's answer or refusal; none falls back to other storage.

```ts
interface HostingSaves {
    get(key: string): Promise<HostResult<string | null>>;
    set(key: string, value: string): Promise<HostResult<void>>;
    remove(key: string): Promise<HostResult<void>>;
    flush(): Promise<HostResult<SavesFlushRes>>;
    /** Every key the session holds, sorted by code unit. Refused `CANCELLED` once Hosting is disposed. */
    keys(): Promise<HostResult<readonly string[]>>;
    /** Another device's write, or the host's conflict choice, reached this session. Only changes, no current value. */
    readonly changed: Listenable<SavesChangedPayload>;
}
```

#### `HostingSeams` (interface)

Test seams of a target's adapter. Games pass nothing. `env` is the host SDK's environment (Ruken's `SdkEnv`); the
adapter that reads it gives it that type, so no SDK type reaches the declarations a game installs.

```ts
interface HostingSeams {
    readonly env?: object;
    /** The clock AF's own timing (the exit cap) runs on; a test passes `fakeClock()`. */
    readonly clock?: Clock;
    /**
     * Gives up waiting for the handshake. Inside a frame that is not Ruken's the SDK waits up to 10 s for a welcome;
     * boot may stop sooner. A session that arrives after the abort is disposed at once instead of leaking.
     */
    readonly signal?: AbortSignal;
}
```

#### `HostRefusal` (interface)

Why the host said no to a call: its contract code, whether a retry may succeed, and the call it refused.

```ts
interface HostRefusal {
    /** The contract's code; the Ruken adapter relays Ruken's unchanged. */
    readonly code: ErrorCode;
    /** Whether a retry may succeed (Ruken's flag, relayed unchanged). */
    readonly retryable: boolean;
    /** The protocol request or `Hosting` call that was refused, for example `saves.set`. */
    readonly operation: string;
    readonly cause?: unknown;
}
```

#### `HostResult` (type)

What a host call answers: the value, or the host's refusal.

```ts
type HostResult<T> = Result<T, HostRefusal>;
```

#### `IconButton` (const)

A button whose face is an icon. Its accessible name is `label`, which it cannot
do without: an empty label throws while it mounts, so a nameless icon button fails its first test
instead of reaching a player. The icon is decoration and hidden from assistive technology.

```ts
const IconButton: import("svelte").Component<Props, {}, "">;
type IconButton = ReturnType<typeof IconButton>;
```

#### `Input` (interface)

The input service: held actions from keys, pads, touch buttons and gestures under the game's
profile and the player's overrides, menu edges, the active device and pads, and rebinding.

```ts
interface Input {
    /** The actions held now, the union over devices, in first-press order. Read once per fixed step; never copied. */
    held(): ReadonlySet<string>;
    /** The active pad's stick, each axis an integer in −127..127, centred inside the deadzone. */
    stick(side: 'left' | 'right'): {
        readonly x: number;
        readonly y: number;
    };
    /** Menu and pause edges, never sent to the sim. Returns the unsubscribe. */
    onPress(action: MenuAction, listener: () => void): () => void;
    /**
     * Reads the pads; the loop calls it once per fixed step, before `held()`. `nowMs` (the frame or step time)
     * paces the held-direction repeat in menus.
     */
    poll(nowMs?: number): void;
    /** A touch button held or let go, by action. */
    hold(action: string): void;
    release(action: string): void;
    /**
     * Gestures from a `SwipeTracker`, as touch: a held gesture holds its actions until released, and a pulse
     * (a flick or a tap) holds them for exactly one sample.
     */
    readonly gesture: GestureSink;
    /** The overlay's move stick: while held it is `stick('left')` and drives the `left-*` directions. */
    readonly touchStick: TouchStickSink;
    /** Where a `CameraDragTracker` sends its pixels. */
    readonly drag: DragSink;
    /** CSS px dragged to the right between the previous two `poll()`s; 0 unless a live action binds `camera-drag`. */
    cameraDrag(): number;
    /** `play` during gameplay, `menu` while a screen pauses the sim or a modal is open. Releases what is held. */
    setContext(context: InputContextNow): void;
    readonly device: Subscribable<ActiveDevice>;
    readonly profile: Subscribable<InputProfile>;
    /** The pads connected since this Input started, in connection order. */
    readonly pads: Subscribable<readonly PadInfo[]>;
    /**
     * Binds the captured key or pad button to `action` on `device`, saved in the settings'
     * `input` when the Input has settings; refused, with nothing changed, by `RebindError`.
     */
    rebind(action: string, device: 'keyboard' | 'gamepad', capture: Capture): Result<void, RebindError>;
    /** Every binding back to the game's profile. */
    resetBindings(): void;
    /**
     * The next key (`keyboard`) or pad button (`gamepad`) pressed, for `rebind`. Escape or pad B cancels; nothing
     * for `REBIND_TIMEOUT_MS` on the Input's clock times out. While it waits, every key it sees goes no further, and the
     * pads drive nothing else. A new capture cancels the one waiting; `signal` aborting stops it and rejects.
     */
    capture(device: 'keyboard' | 'gamepad', signal?: AbortSignal): Promise<Result<Capture, RebindCancelled | RebindTimedOut>>;
}
```

#### `InputMap` (interface)

Held keys, touch buttons and gamepad buttons, turned into one command per tick.

```ts
interface InputMap {
    readonly command: CommandDef;
    /** Whether the play screen shows touch buttons when the player uses touch. */
    readonly touch: boolean;
    readonly touchButtons: readonly TouchButton[];
    /** How the play screen takes touch: its buttons, or swipes over the whole screen. */
    readonly touchMode: TouchMode;
    /**
     * The bindings as data: one action per distinct payload, id `<command id>-<n>`, with its keys, its
     * pad buttons and whether it has a touch button. Rebinding swaps the profile and never the command mapping.
     */
    readonly profile: InputProfile;
    /** Each action's name, as the Settings screen's Controls section lists it. */
    readonly labels: Readonly<Record<string, string>>;
    /** Whether the play screen shows the touch stick (the `analog.touchStick` option). */
    readonly touchStick: boolean;
    /**
     * Pure: the one command for the held actions, merged in iteration order (a later action wins per field). With an
     * `analog` option, `reading` adds the sticks and the drag; without one it is ignored.
     */
    toCommand(held: Iterable<string>, tick: number, reading?: AnalogReading): readonly Command[];
    attach(target: Window): InputSource;
}
```

#### `InputMode` (type)

How the player is playing right now.

```ts
type InputMode = 'touch' | 'keyboard-mouse' | 'gamepad';
```

#### `InputModePayload` (interface)

The current input mode, and the gamepad when one is in use.

```ts
interface InputModePayload {
    mode: InputMode;
    gamepad?: {
        layout: 'xbox' | 'other';
        connected: boolean;
    } | undefined;
}
```

#### `InputModePayloadSchema` (const)

Checks an input mode change.

```ts
const InputModePayloadSchema: z.ZodType<InputModePayload>;
```

#### `InputProfile` (interface)

A named set of bindings, one per game action. It is data: a settings screen rebinds a
copy and saves it in the game's `SettingsDef`; the input service reads it. Action ids are the game's own.

```ts
interface InputProfile {
    readonly id: string;
    readonly bindings: Readonly<Record<string, InputBinding>>;
}
```

#### `inputProfileSchema` (const)

Validates an input profile, filling left-out binding fields with "unbound". A reserved key or pad button fails
the parse with the action named: at boot that is a developer error before anything renders.

```ts
const inputProfileSchema: z.ZodType<InputProfile, InputProfileInput>;
```

#### `inputs` (function)

One input map from `maps`, each sending its own command every tick in map order. The commands share source 0, so
each gets its own `seq`: `tick × maps.length + index` (a u32, which at 60 Hz lasts 2³²/60/86,400/n ≈ 828/n days of
play). `command` is the first map's. Throws on no maps, on two maps for one command, and on an action id, a key or
a pad button two maps share.

```ts
function inputs(...maps: readonly InputMap[]): InputMap;
```

#### `InputSource` (interface)

The input map attached to a window for one play session.

```ts
interface InputSource {
    /** This tick's command, if any: one per tick, never an edge. */
    commands(tick: number): readonly Command[];
    /** A touch button pressed or released (its `TouchButton.id`). */
    hold(buttonId: string): void;
    release(buttonId: string): void;
    /** Gestures from a `SwipeTracker`: held swipes and one-tick flicks and taps. */
    readonly gesture: GestureSink;
    dispose(): void;
}
```

#### `installGlobalErrorHandlers` (function)

Installs once per window; a second call is a no-op. Returns the uninstall.

```ts
function installGlobalErrorHandlers(win: Window, onFatal: (errorClass: string) => void, 
/**
 * A promise nobody awaited that rejected. The game goes on -- a cue that
 * failed to fetch must not end a race -- so it is heard apart from `onFatal`.
 */
onRejection?: (errorClass: string) => void): () => void;
```

#### `KeyBindings` (type)

By `KeyboardEvent.code`, so the keys sit in the same place on every keyboard layout.

```ts
type KeyBindings<Z extends z.ZodType> = Readonly<Record<string, Payload<Z>>>;
```

#### `keyLabel` (function)

A key's label: the keyboard layout's own (`navigator.keyboard.getLayoutMap()`, a letter in capitals) when there
is one, else its `code` without the `Key` and `Digit` prefixes, an arrow as its arrow.

```ts
function keyLabel(code: string, layout?: ReadonlyMap<string, string>): string;
```

#### `keys` (function)

An input map sending `command` once per tick with the payload of what is held: keys by
`KeyboardEvent.code`, on-screen touch buttons, gamepad buttons, the stick and gestures, merged over the
idle payload. Throws when a binding's payload fails the command's schema, and when a key in `options.required` has
no binding.

```ts
function keys<Z extends z.ZodType>(command: CommandDef<Z>, bindings: KeyBindings<Z>, options?: KeysOptions<Z>): InputMap;
```

#### `KeysOptions` (interface)

Options for `keys`: touch buttons, gamepad buttons, gestures and the stick, the idle payload, required keys
and the Controls section's labels.

```ts
interface KeysOptions<Z extends z.ZodType> {
    /** On-screen buttons from the bindings when the player uses touch. Default true. */
    readonly touch?: boolean;
    /** Standard-mapping gamepad button index → payload, polled once per tick. */
    readonly pad?: Readonly<Record<number, Payload<Z>>>;
    /** Touch gesture → payload: a swipe holds while the finger steers, a flick or a tap lasts one tick. */
    readonly gestures?: Readonly<Partial<Record<GestureName, Payload<Z>>>>;
    /** Default `buttons` when the map has touch buttons, else `swipe`. The player's setting overrides it. */
    readonly touchMode?: TouchMode;
    /** A stick pushed past the deadzone in a direction (`left-left`, `right-up`, …) → payload. */
    readonly stick?: Readonly<Partial<Record<StickDirection, Payload<Z>>>>;
    /** The payload with nothing held. Default: the schema's own defaults (`schema.parse({})`), when it has them. */
    readonly idle?: z.input<Z>;
    /**
     * Keys whose actions the game cannot be played without: rebinding never leaves them unbound on a device
     *, and where the touch buttons do not all fit, theirs are the ones that show.
     */
    readonly required?: readonly string[];
    /**
     * Action names for the Controls section, by any of the action's default keys: `{ Space: 'Jump' }`. Default: the
     * command and payload (`move x -1`).
     */
    readonly labels?: Readonly<Record<string, string>>;
    /** The sticks and the camera drag, added to the held keys' payload each tick. */
    readonly analog?: AnalogOptions<Z>;
}
```

#### `LeaderboardEntry` (interface)

One row of a board.

```ts
interface LeaderboardEntry {
    rank: number;
    displayName: string;
    score: number;
    isMe: boolean;
}
```

#### `LeaderboardGetRes` (interface)

The rows of a board.

```ts
interface LeaderboardGetRes {
    entries: LeaderboardEntry[];
}
```

#### `LeaderboardGetResSchema` (const)

Checks a board's rows.

```ts
const LeaderboardGetResSchema: z.ZodType<LeaderboardGetRes>;
```

#### `LeaderboardPanel` (const)

A board's rows, or why there are none: loading, entries (the player's row marked "you"
in words, not only by colour), empty, unavailable and offline. The rows are read, not chosen, so
they are out of the focus order; only the action row (Back, Play again) takes focus. Unavailable
and offline are what the host said: the panel never shows a board kept on the device instead.
The rows sit in a ScrollList, a declared scroll region, so on a short screen they scroll and the
action row stays.

```ts
const LeaderboardPanel: import("svelte").Component<Props, {}, "">;
type LeaderboardPanel = ReturnType<typeof LeaderboardPanel>;
```

#### `LeaderboardQuery` (interface)

Which entries to read from a board.

```ts
interface LeaderboardQuery {
    scope?: 'top' | 'around-me';
    limit?: number;
}
```

#### `LeaderboardQuerySchema` (const)

Checks a board query.

```ts
const LeaderboardQuerySchema: z.ZodType<LeaderboardQuery>;
```

#### `LeaderboardSubmitMeta` (type)

Extra facts sent with a score, passed to the host as they are.

```ts
type LeaderboardSubmitMeta = Record<string, string | number>;
```

#### `LeaderboardSubmitMetaSchema` (const)

Checks a score's extra facts.

```ts
const LeaderboardSubmitMetaSchema: z.ZodType<LeaderboardSubmitMeta>;
```

#### `LeaderboardSubmitRes` (interface)

The host's answer to a submitted score.

```ts
interface LeaderboardSubmitRes {
    accepted: boolean;
    personalBest: number;
    rank?: number | undefined;
}
```

#### `LeaderboardSubmitResSchema` (const)

Checks a submit answer.

```ts
const LeaderboardSubmitResSchema: z.ZodType<LeaderboardSubmitRes>;
```

#### `lerp` (function)

Linear blend; `t = 1` returns `b` exactly, because `a + (b - a)` can round away from it.

```ts
function lerp(a: number, b: number, t: number): number;
```

#### `lerpAngle` (function)

Blends two angles (radians) along the shorter arc, so a body turning from just under π to just over -π
swings through π instead of spinning the long way round through 0. At `t = 1` it returns `b` exactly, so a
view at rest shows the sim's own value rather than an equivalent angle 2π away.

```ts
function lerpAngle(a: number, b: number, t: number): number;
```

#### `LevelDraw` (interface)

What a level shows: its backdrop, its things back to front, and the sentences for anything that fell back.

```ts
interface LevelDraw {
    readonly background: {
        readonly color: string;
        readonly image?: string | undefined;
        readonly mode: ContentLevel['background']['mode'];
    };
    readonly items: readonly DrawItem[];
    /** Each in the words of the thing a person made, once ("The level "Cave" uses tile 70, but …"). */
    readonly problems: readonly string[];
}
```

#### `levelDrawList` (function)

Builds one level's list. `images` holds the picture paths the game has; `live` the characters the game draws itself.

```ts
function levelDrawList(project: ContentProject, level: ContentLevel, images: ReadonlySet<string>, live: readonly string[]): LevelDraw;
```

#### `LevelScene` (interface)

A level the game shows, from `levelScene`; pass it as `defineGame({ level })`.

```ts
interface LevelScene {
    /** Adds a hook called each frame after the scene's own redraw check (the 2D cutscene stage is the first). */
    add(hooks: LevelSceneHooks): void;
}
```

#### `levelScene` (function)

Validates the options now and returns the scene; the Pixi objects are made on the first frame.

```ts
function levelScene(options: LevelSceneOptions): LevelScene;
```

#### `LevelSceneHooks` (interface)

What a hook draws in the scene: the sim now, the scene's container (under the game's own views), an overlay over
everything the world shows, and a way to hide one placed item's drawing.

```ts
interface LevelSceneHooks {
    draw(sim: DrawSim, scene: {
        readonly container: Container;
        /**
         * A layer over the world and every view in it, in view coordinates (the camera does not move it): the place for a
         * fade or a flash, which must cover the game's own characters too.
         */
        readonly overlay: Container;
        hide(itemId: string, hidden: boolean): void;
    }): void;
}
```

#### `LevelSceneOptions` (interface)

What `levelScene` needs: the exported content, the pictures the build gave the game, and where to start.

```ts
interface LevelSceneOptions {
    readonly project: ContentProject;
    readonly levels: Readonly<Record<string, ContentLevel>>;
    /** A workspace path (`assets/terrain.png`) to the url the build gave it. */
    readonly images: Readonly<Record<string, string>>;
    /** The level shown first (its id). */
    readonly start: string;
    /**
     * Characters (definition ids) the game spawns and draws itself, with `pictureView`. Core leaves out their placed
     * items, so one is not drawn twice. Also the way to keep a marker (an area, a spawn point) out of the picture.
     */
    readonly live?: readonly string[] | undefined;
    /** The level to show now, read from the sim each frame. Default: always `start`. */
    readonly current?: ((sim: DrawSim) => string) | undefined;
}
```

#### `LifecyclePayload` (interface)

Whether the game is in front, and if not, why.

```ts
interface LifecyclePayload {
    state: 'active' | 'background';
    reasons: LifecycleReason[];
}
```

#### `LifecyclePayloadSchema` (const)

Checks a lifecycle change.

```ts
const LifecyclePayloadSchema: z.ZodType<LifecyclePayload>;
```

#### `LifecycleReason` (type)

Why the game is in the background.

```ts
type LifecycleReason = 'hidden' | 'blurred' | 'host-overlay' | 'ad' | 'offline-grace';
```

#### `LoaderOverlay` (const)

The loader over a screen while its assets load. It shows real progress when the runtime has it
and an indeterminate bar before the first byte, says what is loading in words, and after the
runtime's slow threshold says quietly that it is slow, not failing. The slow line always holds
its height, so nothing shifts when it appears.

```ts
const LoaderOverlay: import("svelte").Component<Props, {}, "">;
type LoaderOverlay = ReturnType<typeof LoaderOverlay>;
```

#### `Locale` (interface)

The locale service: the game's locales, the one text is drawn in now, the player's choice
and the text direction.

```ts
interface Locale {
    /** The game's locales, in its own order (the picker's order). */
    readonly locales: readonly string[];
    readonly baseLocale: string;
    /** The locale text is drawn in now. */
    readonly current: string;
    /** The player's pick: one of `locales`, or null for Automatic (nothing saved, or a saved locale the game dropped). */
    readonly choice: string | null;
    readonly direction: 'ltr' | 'rtl';
    /** Svelte store contract: called at once with the current locale, then on each change. */
    subscribe(listener: (locale: string) => void): () => void;
    /**
     * The picker's one call: one of `locales`, or null for Automatic. Saved through `Hosting.saves`.
     * A locale the game does not ship throws: the picker only offers `locales`.
     */
    set(choice: string | null): void;
}
```

#### `MAX_TURN_UNITS_PER_STEP` (const)

The most one step's `camera-turn` may carry either way: 45°.

```ts
const MAX_TURN_UNITS_PER_STEP = 8192;
```

#### `measureGeometry` (function)

Turns what the browser and the host report into one `Geometry`. Pure. Each inset is the largest of the
browser's safe area, the host's and (at the sides) the host's reserved strip; the visible region is the
usable one less whatever covers the page's foot.

```ts
function measureGeometry(input: GeometryInput): Geometry;
```

#### `mergeStageHooks` (function)

Every hook of each, called in the order given; `undefined` entries are skipped.

```ts
function mergeStageHooks(...all: readonly (PixiStageHooks | undefined)[]): PixiStageHooks;
```

#### `Modal` (const)

A panel over the screen with a visible Close. Where Dialog asks a question that needs an answer,
Modal shows something the player can close at any time: a level list, a credits page.

It holds the page by the rules Dialog uses (`modal-scope.ts`): the page behind is inert, focus
moves in on open and back to the opener on close, Tab wraps, and Escape (or the pad's Back)
calls `onclose`. A tap on the dimmed page calls `onbackdrop` only when one is given; absent,
such a tap does nothing, so a stray tap never loses the player's place.

`anchor="bottom"` puts it on the bottom edge at every form factor; Sheet is that.

```ts
const Modal: import("svelte").Component<$$ComponentProps, {}, "">;
type Modal = ReturnType<typeof Modal>;
```

#### `ModelInvalid` (class)

A 3D model file could not be read: malformed, of an unknown type, not loaded, or a glTF with a skin,
which is not supported yet. Boot shows the panel naming the file, with Try again.

```ts
class ModelInvalid extends Error {
    readonly _tag: "ModelInvalid";
    readonly file: string;
    readonly reason: string;
    constructor(fields: ModelInvalidFields);
}
```

#### `OptionGroup` (const)

A choice of one: a
segmented row whose chosen option is filled and marked, never only underlined or only coloured.

Native radios in a fieldset, not `<button role="radio">`: the browser gives the arrow keys,
and the focus navigator's `adjust` cycles a named radio group, so a pad changes it without leaving it.

Controlled: it reports a choice through `onchange` and shows the `value` it is given. A choice the owner does
not take is undone, so what is checked is always the owner's value.

```ts
const OptionGroup: import("svelte").Component<Props, {}, "">;
type OptionGroup = ReturnType<typeof OptionGroup>;
```

#### `OwnedRenderer` (interface)

A renderer the runtime owns: `dispose` destroys it (the canvas, its listeners, its GPU resources).

```ts
interface OwnedRenderer extends GameRenderer {
    dispose(): void;
}
```

#### `padLabel` (function)

A standard-mapping pad button's label on a pad of `glyphs`.

```ts
function padLabel(button: number, glyphs: PromptGlyphs, copy: PromptCopy): string;
```

#### `PagedGrid` (const)

A grid of items in pages that never scrolls. Each group starts its own page; the shape is `most`, cut to what the measured box holds at
`minTile` and to what the largest group fills. PagerDots show where it is.

The page is controlled: it reports `onpage` and shows the `page` it is given. A `[data-focus-grid]`, so the
focus navigator steers through the tiles spatially, and paging comes from the owner (a page swipe, a pad's
shoulder buttons, the dots).

```ts
const PagedGrid: $$IsomorphicComponent;
type PagedGrid<T extends {
    readonly id: string;
}> = InstanceType<typeof PagedGrid<T>>;
```

#### `PagerDots` (const)

Where a paged view is: one row of
dots, each a whole touch target, or "3 / 11" once the dots would not fit on one row. It never wraps.

```ts
const PagerDots: import("svelte").Component<Props, {}, "">;
type PagerDots = ReturnType<typeof PagerDots>;
```

#### `PauseBehavior` (type)

Whether the game pauses when it goes to the background; fixed for the game's whole life.

```ts
type PauseBehavior = 'pause' | 'continue';
```

#### `PauseBehaviorSchema` (const)

Checks a pause behavior.

```ts
const PauseBehaviorSchema: z.ZodType<PauseBehavior>;
```

#### `pictureView` (function)

An entity drawn as its character looks in the editor: the tile Characters gave it, else its colour as its shape.
The view follows the entity's `x`, `y` and `angle` like `rect` and `sprite`, and is anchored at the character's
pivot. A picture that has not arrived (or a tile past its set) shows the tile's flat colour, never a blank:
`registerViews({ [Body.id]: pictureView(project, 'player-start', images) })`.

```ts
function pictureView(project: ContentProject, def: string, images: Readonly<Record<string, string>>, options?: PictureViewOptions): EntityViewFactory;
```

#### `PictureViewOptions` (interface)

A `pictureView`'s options.

```ts
interface PictureViewOptions {
    /**
     * The name of the clip to play now, read from the entity's components each frame. Code picks the clip by name;
     * what the clip looks like is the character's, edited in Characters.
     */
    readonly clip?: ((components: Readonly<Record<string, Readonly<FieldRecord>>>) => string) | undefined;
    /**
     * Moves the picture off the entity's position, for a game whose position is not the character's pivot (a body
     * whose `x`, `y` is its centre while the character stands on its pivot, its feet). Default none.
     */
    readonly offset?: {
        readonly x: number;
        readonly y: number;
    } | undefined;
}
```

#### `PixiRenderer` (interface)

The runtime's `GameRenderer`, built on PixiJS, with its stage.

```ts
interface PixiRenderer extends OwnedRenderer {
    readonly stage: PixiStage;
}
```

#### `PixiRendererOptions` (interface)

Options for `createPixiRenderer`; every field has a default.

```ts
interface PixiRendererOptions {
    /**
     * Preferred backend. Default is 'webgl' (WebGL2).
     * Overridden by URL query param `?renderer=webgl` or `?renderer=webgpu` if present in browser.
     */
    readonly preference?: RendererPreference | undefined;
    /** Logical playfield width in pixels (e.g. 960 or 320). If omitted, renders unletterboxed. */
    readonly logicalWidth?: number | undefined;
    /** Logical playfield height in pixels (e.g. 540 or 192). If omitted, renders unletterboxed. */
    readonly logicalHeight?: number | undefined;
    /** Background clear colour (hex number, e.g. 0x000000). Default is 0x000000. */
    readonly backgroundColor?: number | undefined;
    /** If true, textures default to nearest-neighbour sampling for crisp pixel art. Default is true. */
    readonly pixelArt?: boolean | undefined;
    /** Letterbox cropping fraction for top and bottom bars. Default is 0.05 (5%). */
    readonly barFraction?: number | undefined;
    /** Bar color in hex. Default is 0x2e222f (plum black). */
    readonly barColor?: number | undefined;
    /** The graphics quality tier to start at; `PixiStage.setQuality` changes it. Default `high`. */
    readonly quality?: QualityTier | undefined;
    /**
     * Draws the world and UI at the logical size and resolution 1, then nearest-upscales them into the letterbox
     * (`CompositeTarget`). Needs a letterbox. Default: on when `pixelArt` is on.
     */
    readonly composite?: boolean | undefined;
    /** Optional view factory resolver for entity components. */
    readonly entityViews?: EntityViewResolver | undefined;
    /**
     * Screen-space filters declared with `postFilter`. Each is built when the renderer starts and set in the
     * stage's post-filter slot before `setup` runs, so `setup` sees them and may add more. Names must be unique.
     */
    readonly postFilters?: readonly PostFilterDef[] | undefined;
    /**
     * Optional setup hook called before the first frame to add layers/filters. It may return hooks for a game
     * that draws its own scene: they run after the entity views each step, before Pixi renders each frame, and
     * after the views reset.
     */
    readonly setup?: ((stage: PixiStage) => PixiStageHooks | undefined) | ((stage: PixiStage) => void) | undefined;
}
```

#### `PixiStage` (interface)

The Pixi scene the renderer draws, as a game's `setup` sees it: the app, the letterbox's layers, the entity
views, the post-filter slot and the quality tier.

```ts
interface PixiStage {
    readonly app: Application;
    readonly frame?: LetterboxFrame | undefined;
    /** The world container where entity views and gameplay objects are mounted. */
    readonly world: Container;
    /** The logical screen-space UI layer (masked with the playfield). */
    readonly ui: Container;
    /** The unclipped background scenery container. */
    readonly backdrop: Container;
    /** The delta consumer tracking entity views. */
    readonly consumer: RenderDeltaConsumer;
    /**
     * How characters are squashed, held and found for a word above them. Read it each frame: a renderer that draws
     * characters its own way replaces it (`useCharacters`) when it mounts.
     */
    readonly characters: StageCharacters;
    /** Replaces `characters` with this renderer's own answer. */
    useCharacters(characters: StageCharacters): void;
    /** The fixed-resolution composite the world and UI draw into, when it is on. */
    readonly composite?: CompositeTarget | undefined;
    /** Post-processing filters applied to the root rendered scene. Owned by `postFilters` once it is used. */
    filters: Filter[] | null;
    /** The post-filter slot over `filters`: each owner keeps its own filters by id and order. */
    readonly postFilters: PostFilterSlot;
    /** The graphics quality tier now. */
    readonly quality: QualityTier;
    /** Changes the tier: re-caps the canvas resolution and leaves out post-filter owners registered for a higher one. */
    setQuality(tier: QualityTier): void;
    /**
     * Builds a filter, or returns `undefined` when it cannot be built or compiled: it then warns and publishes
     * `render.filter.dropped` on the render target's bus, and the frame draws without it.
     */
    tryFilter<F extends Filter>(id: string, make: () => F): F | undefined;
}
```

#### `PixiStageHooks` (interface)

What a `setup` may return to hear every step, frame and reset.

```ts
interface PixiStageHooks {
    /** After the entity views took the step's render delta. */
    readonly apply?: ((result: StepResult) => void) | undefined;
    /** Each display frame, after the views interpolated and before Pixi renders. */
    readonly draw?: ((frame: FrameInfo) => void) | undefined;
    /** After the views reset (a new sim or a resync). */
    readonly reset?: (() => void) | undefined;
}
```

#### `PlayHandle` (interface)

What `usePlay()` hands a slot component.

```ts
interface PlayHandle {
    /** The game as it is now, read-only; undefined until play has a sim. Reading it in a template or `$derived` follows each frame. */
    readonly sim: DrawSim | undefined;
    /** Queues `command` for the next tick, after the input map's own, in the order sent. */
    send(command: SentCommand): void;
}
```

#### `PluginDef` (interface)

A bundle of definitions the sim registers together: components, commands, events, resources and systems,
the plugins it depends on, and optionally per-sim engine state and `config`. Create one with
`definePlugin`.

```ts
interface PluginDef {
  readonly kind: 'plugin'
  readonly name: string
  /** Creates this plugin's per-sim engine state; its systems see it as `ctx.pluginState`. */
  readonly state: ((setup: PluginStateSetup) => Promise<PluginState>) | undefined
  readonly dependsOn: readonly string[]
  readonly components: readonly ComponentDef[]
  readonly commands: readonly CommandDef[]
  readonly events: readonly EventDef[]
  readonly resources: readonly ResourceDef[]
  readonly systems: readonly SystemDef[]
  /**
   * Settings that change what the plugin simulates (physics gravity), as plain JSON. Part of the schema hash,
   * so a snapshot never restores into a sim configured differently. Undefined when the plugin has none.
   */
  readonly config: unknown
}
```

#### `Pose` (interface)

Where an entity view draws: position in world pixels and rotation in radians (Pixi `rotation`).

```ts
interface Pose {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
}
```

#### `postFilter` (function)

Declares a screen-space filter over the whole picture: `renderer: { postFilters: [postFilter('vignette', {
glsl, wgsl })] }`. The renderer builds it when it starts and keeps it in the stage's post-filter slot under
`name`. A filter that cannot be built, or whose GLSL does not link, is left out with a warning and the frame
draws without it. Throws when the name or either shader is empty.

```ts
function postFilter(name: string, spec: PostFilterSpec): PostFilterDef;
```

#### `PostFilterDef` (interface)

A declared filter, as `postFilter` returns it and `PixiRendererOptions.postFilters` takes it.

```ts
interface PostFilterDef {
    readonly name: string;
    readonly glsl: string;
    readonly wgsl: string;
    readonly order: number;
    readonly minTier: QualityTier | undefined;
}
```

#### `PostFilterSpec` (interface)

What a screen-space filter is made of: the same effect written twice, for WebGL2 (`glsl`) and WebGPU (`wgsl`),
so the two renderers stay at parity. Both are fragment shaders that `filterPrograms` joins to the shared vertex
stage: GLSL reads `vTextureCoord`, `vPixelCoord` and `uTexture`; WGSL has `mainFragment(input: VSOutput)`.

```ts
interface PostFilterSpec {
    /** The GLSL ES 3.00 fragment shader, run under WebGL2. */
    readonly glsl: string;
    /** The WGSL fragment shader, run under WebGPU; its entry point is `mainFragment`. */
    readonly wgsl: string;
    /** Where it sits among the stage's filters: lower runs first, ties by name. Default 0. */
    readonly order?: number | undefined;
    /** The lowest quality tier it runs at; left out, it runs at every tier. */
    readonly minTier?: QualityTier | undefined;
}
```

#### `PresentationBus` (interface)

The presentation bus: typed facts the runtime publishes for screens, audio and tests to hear. Facts
describe what happened; they never change gameplay state.

```ts
interface PresentationBus<Facts = RuntimeFacts> {
    publish<K extends keyof Facts & string>(name: K, fact: Facts[K]): void;
    subscribe<K extends keyof Facts & string>(name: K, listener: (fact: Facts[K]) => void): () => void;
}
```

#### `PROMPT_COPY` (const)

What a binding is called when its key, pad button or tap is shown in the settings.

```ts
const PROMPT_COPY: PromptCopy;
```

#### `PromptCopy` (interface)

Every word a prompt shows, in the game's language.

```ts
interface PromptCopy {
    /** An action with nothing on the active device. */
    readonly unbound: string;
    /** An action with an on-screen button, on touch. */
    readonly touch: string;
    readonly pad: Readonly<Record<PadWord, string>>;
}
```

#### `QualityTier` (type)

A graphics quality tier: `high`, `medium` or `low`.

```ts
type QualityTier = (typeof QUALITY_TIERS)[number];
```

#### `rect` (function)

A filled rectangle that follows its component's `x`, `y` and `angle`, interpolated between ticks:
`entityViews: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) }`.

```ts
function rect(options: RectViewOptions): EntityViewFactory;
```

#### `RectViewOptions` (interface)

A `rect` view's size, colour and anchor.

```ts
interface RectViewOptions {
    /** Width in world pixels. */
    readonly w: number;
    /** Height in world pixels. */
    readonly h: number;
    /** Fill colour, e.g. 0xf9c22b. */
    readonly color: number;
    /** Default 0.5 (centred on the entity's position). */
    readonly anchor?: ViewAnchor | undefined;
}
```

#### `reducedMotion` (function)

Whether the player has asked for less movement.

Checked at call time rather than cached, because the setting can change
while the game is open. Primitives also honour it in CSS; this is for code
that moves things itself.

```ts
function reducedMotion(win?: Pick<Window, 'matchMedia'>): boolean;
```

#### `RenderDeltaConsumer` (class)

Keeps one entity view per sim entity in the world from each step's render delta, and interpolates them between
ticks. `C` is the scene's node type: Pixi's `Container` by default.

```ts
class RenderDeltaConsumer<C extends SceneNode = Container> {
    private readonly world;
    private readonly resolver?;
    private readonly views;
    private readonly cache;
    /** Entities whose view keeps its pose for now (a hit-stop): the sim moves on, the picture waits. */
    private held;
    constructor(world: SceneParent<C>, resolver?: EntityViewResolver<C>);
    private resolveView;
    apply(delta: RenderDelta): void;
    /** The view drawn for the entity with this stable id, or `undefined` when it has none. */
    viewOf(sid: number): EntityView<C> | undefined;
    /**
     * Holds these entities' views in the pose they have: a step or a frame leaves them alone until they are let go
     * (pass a set without them), when the next frame draws them where the sim has them. Presentation only; the sim does
     * not wait.
     */
    hold(sids: ReadonlySet<number>): void;
    interpolate(alpha: number): void;
    private removeEntity;
    reset(): void;
    destroy(): void;
}
```

#### `RendererFactory` (type)

Builds the game's renderer for a target. It answers `RendererUnavailable` when no backend it accepts starts, and
`ModelInvalid` when a 3D renderer cannot read a model file it was given; a bug throws. The caller disposes what it
gets.

```ts
type RendererFactory = (target: RenderTarget) => Promise<Result<OwnedRenderer, RendererUnavailable | ModelInvalid>>;
```

#### `RendererUnavailable` (class)

Neither WebGL2 nor WebGPU could be initialized.
In Ruken this presents the "unsupported" screen with an exit button.

```ts
class RendererUnavailable extends Error {
    readonly _tag: "RendererUnavailable";
    readonly tried: readonly ('webgl2' | 'webgpu')[];
    constructor(fields: RendererUnavailableFields);
}
```

#### `RenderTarget` (interface)

Where a renderer draws: the host element, the layout geometry, the loaded assets and the presentation bus.

```ts
interface RenderTarget {
    readonly host: HTMLElement;
    readonly geometry: GeometryOwner;
    readonly assets: Pick<Assets, 'get'>;
    /** The runtime's presentation bus, for render facts such as `render.filter.dropped`. Optional for tests and tools. */
    readonly bus?: PresentationBus | undefined;
    /**
     * Shows the "picture stopped" panel with Try again, for a renderer whose graphics context is lost and will not
     * come back by itself: Try again closes the panel and calls `retry`, which rebuilds the renderer from
     * the sim's current state. Returns a function that closes the panel. Optional for tests and tools.
     */
    readonly reportLost?: ((retry: () => void) => () => void) | undefined;
}
```

#### `ResourceDef` (interface)

A value the sim keeps once, not on any entity: an id, a Zod schema and the `init` that gives its starting
value. Create one with `defineResource`.

```ts
interface ResourceDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: 'resource'
  readonly id: string
  readonly schema: Z
  readonly init: () => z.input<Z>
}
```

#### `RoundOutcome` (type)

How a round ended.

```ts
type RoundOutcome = 'complete' | 'fail' | 'quit';
```

#### `RoundOutcomeSchema` (const)

Checks a round outcome.

```ts
const RoundOutcomeSchema: z.ZodType<RoundOutcome>;
```

#### `RUKEN_SDK_MARKERS` (const)

String literals only the Ruken SDK contains, which survive minification: the SDK's storage probe
key (`env-browser.ts`) and its standalone refusal message (`standalone.ts`), at RukenApp d0fa2fe (as at
b30d31b). An `itch` or `web` build must contain neither, because it bundles the web adapter instead of the SDK;
a `ruken` build contains both. The web adapter's own probe key (`WEB_STORAGE_PROBE_KEY`) is deliberately different.

Re-check these after re-vendoring the SDK: `target.build.test.ts` fails if a default build stops containing them.

```ts
const RUKEN_SDK_MARKERS: readonly string[];
```

#### `runGame` (function)

Boots and runs the game: a failure draws the boot failure panel, and `shutdown` closes everything the runtime opened.

Each attempt opens into a fresh `Teardown`. On failure it mounts the boot failure panel and keeps the attempt open,
so Back to {host} can still reach its `Hosting`. Try again and Continue without loading close the failed attempt and
boot again on the same root without reloading the page. Inside a Ruken session, Try again reloads the game's frame
instead: the host answers one hello per frame load, so a second session in this load would never be welcomed.

`shutdown()` stops a boot under way and closes the current attempt, last opened first. `start.at` names the screen
the flow starts on (a restart in development); `screen` is the screen showing now.

```ts
function runGame<S>(game: GameDefinition<S>, start?: StartOptions): RuntimeHandle;
```

#### `RuntimeFacts` (interface)

Every fact the runtime publishes on the presentation bus, by name.

```ts
interface RuntimeFacts {
    readonly 'sim.events': readonly SimEvent[];
    /**
     * The same events with the tick of the step that emitted them (`StepResult.tick`, the tick the sim is at after the step), for
     * a listener that needs to know when an event happened. Published with `sim.events`, only when the step emitted events.
     */
    readonly 'sim.step': {
        readonly tick: number;
        readonly events: readonly SimEvent[];
    };
    readonly 'screen.entered': {
        readonly screen: string;
        readonly from: string | undefined;
    };
    readonly 'time.changed': {
        readonly paused: boolean;
    };
    /** The player's language changed. Screens redraw their text; nothing remounts. */
    readonly 'locale.changed': {
        readonly locale: string;
        readonly previous: string;
    };
    /** The player's last real input came from another device. Prompts and touch controls follow it. */
    readonly 'input.device.changed': {
        readonly device: InputDevice;
        readonly glyphs: GlyphFamily;
        readonly previous: InputDevice;
    };
    /** The first gesture after `session.ready` built and resumed the audio graph. */
    readonly 'audio.unlocked': Readonly<Record<never, never>>;
    /** No audio context could be built or resumed; the game runs silent. */
    readonly 'audio.unavailable': {
        readonly reason: string;
    };
    /** A sound or a track could not be loaded or decoded; it is silent and nothing else stops. */
    readonly 'audio.decode.failed': {
        readonly alias: string;
        readonly reason: string;
    };
    /** A pad was plugged in. `standard: false` means it cannot drive bindings. */
    readonly 'input.pad.connected': PadInfo;
    /** A pad was unplugged; what it held is released. `wasActive`: it was the pad in use. */
    readonly 'input.pad.disconnected': PadInfo & {
        readonly wasActive: boolean;
    };
    /** The player's bindings changed: `action` when one was rebound, none on a reset or a follow. */
    readonly 'input.bindings.changed': {
        readonly action?: string;
    };
    /** A post filter could not be built or compiled and was left out; the frame draws without it. */
    readonly 'render.filter.dropped': {
        readonly id: string;
        readonly reason: string;
    };
    /** The WebGL context was lost; the renderer draws nothing until it is restored. */
    readonly 'render.context.lost': Readonly<Record<never, never>>;
    /**
     * The WebGL context came back: Pixi re-uploads its GPU resources and the renderer draws again; the
     * views and the sim are untouched.
     */
    readonly 'render.context.restored': Readonly<Record<never, never>>;
    /** A slot's save reached the host. `key` is the save's prefix (`SaveDef.key`). */
    readonly 'save.written': {
        readonly key: string;
        readonly slot: number;
    };
    /** The host refused a slot's write; the slot keeps its previous value. */
    readonly 'save.failed': {
        readonly key: string;
        readonly slot: number;
        readonly code: ErrorCode;
    };
    /** A slot was loaded for play. */
    readonly 'save.loaded': {
        readonly key: string;
        readonly slot: number;
    };
    /**
     * Another device changed the slot being played. Nothing was reloaded; the game offers Load
     * newer or Keep playing.
     */
    readonly 'save.changedElsewhere': {
        readonly key: string;
        readonly slot: number;
    };
    /** A submit to `board` changed state: `submitting`, then how the host answered. */
    readonly 'leaderboard.submitted': {
        readonly board: string;
        readonly state: BoardState;
    };
}
```

#### `RuntimeHandle` (interface)

Controls the running game: `shutdown` closes everything the runtime opened, last opened first.

```ts
interface RuntimeHandle {
    /** The screen showing now; `undefined` before the flow starts and after shutdown. */
    readonly screen: string | undefined;
    shutdown(): Promise<void>;
}
```

#### `RuntimeSeams` (interface)

Test seams injected into the runtime boot program.

```ts
interface RuntimeSeams {
    readonly fetch?: typeof fetch;
    readonly frames?: FrameSource;
    readonly fonts?: Pick<FontFaceSet, 'load'>;
    readonly sdkEnv?: () => NonNullable<HostingSeams['env']>;
    /**
     * Builds the game's `Hosting` in place of the build target's adapter (`@automata/framework/target`), for example
     * `fakeHosting(…).open` from `@automata/framework/testing`. It gets boot's clock and the signal that gives up the
     * handshake; boot disposes what it answers. When given, `sdkEnv` is not used.
     */
    readonly hosting?: (options: HostingOptions, seams: {
        readonly clock: Clock;
        readonly signal: AbortSignal;
    }) => Promise<HostResult<Hosting>>;
    /** The clock every runtime timer runs on (the stall rule, fades, toasts, the exit cap); default the real one. */
    readonly clock?: Clock;
    /** The wall clock saves are stamped with, in epoch milliseconds; default `Date.now`. */
    readonly now?: () => number;
    readonly document?: Document;
    /** The browser's languages, best first; defaults to `navigator.languages`. */
    readonly languages?: readonly string[];
    /** Builds the audio context on the unlock; defaults to `new AudioContext()`. */
    readonly createAudioContext?: () => AudioContextLike;
    /** The device's haptics, in place of the browser's (pads, `navigator.vibrate`, a coarse pointer). */
    readonly haptics?: Haptics;
    /** Where settings fields that belong to the device are kept; defaults to the frame's `localStorage`. */
    readonly deviceStorage?: DeviceStorage;
    /**
     * Hears what failed, after the runtime has shown it as usual: a boot failure's `BootError`, why a screen could not
     * load or enter, or what a running sim's step threw. Each Try again can fail again, so it can be called more than
     * once. A throw from it is ignored. The website's playground reports the line in the reader's code
     * from it.
     */
    readonly onFailure?: (cause: unknown) => void;
    /**
     * Reloads the game's frame: what Try again does after a boot failure inside a Ruken session, where the host answers
     * one hello per frame load. Defaults to reloading the document's location.
     */
    readonly reload?: () => void;
}
```

#### `RuntimeServices` (interface)

The runtime services a screen may use, as one plain object: boot builds them in order and hands them over.

```ts
interface RuntimeServices {
    readonly hosting: Hosting;
    readonly bus: PresentationBus;
    /** The runtime's clock: what a screen waits on (a toast's four seconds, a rebind's countdown). */
    readonly clock: Clock;
    readonly time: Time;
    readonly flow: Flow;
    readonly settings: Settings;
    readonly saves: Saves;
    readonly appLoop: AppLoop;
    readonly assets: Assets;
    readonly renderer: GameRenderer;
    readonly locale: Locale;
    /** Sounds and music, and the audio buses' gains (one service). */
    readonly audio: Audio & AudioBuses;
    readonly leaderboards: Leaderboards;
    readonly haptics: Haptics;
}
```

#### `Save` (interface)

A game's save: its slots' states, load, write and remove, and the progress `touch` keeps for
the autosave triggers to write.

```ts
interface Save<S> {
    /** Every slot's state, in slot order. */
    readonly slots: Subscribable<readonly SlotState[]>;
    /** The slot being played: the last one `load` returned. Undefined before the first load. */
    readonly loaded: Subscribable<number | undefined>;
    /**
     * Reads a slot and makes it the one being played. Progress `touch`ed before is dropped: it came from the game this
     * load replaces, and must not be written over what was just read. A slot the save does not have throws.
     */
    load(slot: number): Promise<Result<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostRefusal>>;
    write(slot: number, data: S, options?: SaveWriteOptions): Promise<Result<void, SaveRefused | HostRefusal>>;
    remove(slot: number): Promise<Result<void, HostRefusal>>;
    /**
     * Says the loaded slot's progress changed and what it is now. A plain function, safe to call every tick: it only
     * keeps `data`, and the next autosave trigger writes it. With no slot loaded it keeps nothing.
     */
    touch(data: () => S): void;
    /**
     * Writes the progress `touch` has kept for every slot that still has some, now, whatever the autosave policy
     * (an exit must not lose progress because `on` left out a trigger). It still never writes a slot whose state
     * is not `ready` or `empty` (a newer build's, a damaged one, one loaded with other content), nor the slot
     * another device changed while it was played, until the player answers: that progress stays kept (Keep
     * playing releases it; Load newer and any other load drop it). It never rejects, because it runs inside the host's
     * exit; a refused write is the `save.failed` fact, and the progress stays kept for the next flush.
     */
    flushPending(): Promise<void>;
    /**
     * What a trigger calls: `flushPending` if the save's policy lists `trigger`, otherwise nothing. `saveService`
     * already wires every trigger to its source; this is for a game that raises one itself.
     */
    autosave(trigger: AutosaveTrigger): Promise<void>;
    /**
     * True while the loaded slot holds something another device wrote after it was loaded. Nothing is
     * reloaded, and no trigger writes that slot over the other device's until the player answers. Lowered by
     * `keepPlaying`, `loadNewer` or any load.
     */
    readonly changedElsewhere: Subscribable<boolean>;
    /** Loads the loaded slot again, so the game plays what the other device wrote. Throws when nothing is loaded. */
    loadNewer(): Promise<Result<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostRefusal>>;
    /** The player chose to carry on: lowers `changedElsewhere`. The next trigger writes the progress kept over the other device's, as any write would. */
    keepPlaying(): void;
}
```

#### `SaveDef` (interface)

A game's save: one record, or a fixed number of slots, each one Ruken key.

```ts
interface SaveDef<S> {
    /** The key prefix. Ruken's key rule is the SDK's, which checks it on write. */
    readonly key: string;
    /** This build's version of the data, an integer from 1. */
    readonly version: number;
    readonly schema: z.ZodType<S>;
    /** What an empty slot loads as. */
    readonly empty: () => S;
    /** `migrations[n]` turns version `n` data into version `n + 1`. */
    readonly migrations: Readonly<Record<number, SaveMigration>>;
    /** Absent: one record, slot 0, stored at `key`. */
    readonly slots?: {
        readonly count: number;
    };
    /** Absent: save on `screen-exit`, `round-end` and `background`, with no timer. `{ on: [] }` turns it off. */
    readonly autosave?: AutosavePolicy;
}
```

#### `Saves` (interface)

The booted game's save as a runtime service, as `Settings` is for settings: its key and the
`Save`, both undefined for a game without saves.

```ts
interface Saves {
    /** The booted save's key prefix; undefined for a game without saves. */
    readonly key: string | undefined;
    readonly save: Save<unknown> | undefined;
}
```

#### `SavesChangedPayload` (interface)

Another device's write, or the host's conflict choice, reached this session. `null` is a removed key.

```ts
interface SavesChangedPayload {
    key: string;
    value: string | null;
    revision: number;
}
```

#### `SavesChangedPayloadSchema` (const)

Checks a saves change.

```ts
const SavesChangedPayloadSchema: z.ZodType<SavesChangedPayload>;
```

#### `SavesFlushRes` (interface)

Where a flush left the saves: the host's outbox, its server, or the device's own storage (`'device'`, the `web`,
`itch` and `tauri` targets).

```ts
interface SavesFlushRes {
    persisted: 'host-outbox' | 'server' | 'device';
}
```

#### `SavesFlushResSchema` (const)

Checks a flush answer.

```ts
const SavesFlushResSchema: z.ZodType<SavesFlushRes>;
```

#### `SavesStatus` (type)

Where the player's saves stand with the host.

```ts
type SavesStatus = 'checking' | 'syncing' | 'saved' | 'offline-queued' | 'retry' | 'conflict' | 'recovered';
```

#### `SavesStatusSchema` (const)

Checks a saves status.

```ts
const SavesStatusSchema: z.ZodType<SavesStatus>;
```

#### `ScreenContext` (interface)

What a screen's `enter` is given: where to mount, where it came from, what to undo, and the runtime's services.

```ts
interface ScreenContext {
    /** The screen's own element in the screen layer. */
    readonly layer: HTMLElement;
    readonly from: string | undefined;
    /**
     * What the screen undoes when it is left: add a function for each listener, mount or timer it starts. The flow
     * disposes it once, last added first, before the next screen enters (and when a failed `enter` is cleaned up).
     */
    readonly screen: Disposables;
    /**
     * What a game keeps across screens, such as the sim the default screens share. Every screen of a run gets the same
     * one. It is disposed once, when the runtime shuts down or a failed boot is tried again: after the current screen
     * and the save's last flush, which may still read what it holds, and before the renderer is destroyed and Hosting
     * closes.
     */
    readonly runtime: Disposables;
    readonly services: RuntimeServices;
}
```

#### `ScreenDef` (interface)

One screen of the flow: its id, whether it pauses the sim, its kind and fonts, and `enter`, which mounts it.
Everything `enter` starts goes in `context.screen`, which the flow disposes when the screen is left.

```ts
interface ScreenDef {
    readonly id: string;
    readonly pausesSim?: boolean;
    /** `gameplay` lets the cursor policy hide an idle pointer; a `menu` (the default) never does. */
    readonly kind?: 'menu' | 'gameplay';
    readonly fonts?: readonly string[];
    /** A throw, or a rejected promise, is the screen's failure: the flow shows the error panel with Try again. */
    enter(context: ScreenContext): void | Promise<void>;
    openMenu?(): boolean;
}
```

#### `ScreenFrame` (const)

Every screen's frame: the visible region, a corner row, then a hero and a body.

It fills the visible region: the layout viewport less the insets the geometry owner publishes
(safe area and Ruken's reserved strip), ending above whatever the browser lays over the page's
foot (the keyboard). Its first row is the corner controls, in flow, so they never sit over the
content. Below that it arranges a hero and a body:
  stack: hero above body; the hero takes what the body leaves, so on a short screen the hero
         shrinks first and never pushes the body off the screen;
  split: hero and body side by side.
The screen root picks the arrangement from the form factor and height tier; nothing inside the
frame branches on either. The body is the `af-screen` size container its contents query.

```ts
const ScreenFrame: import("svelte").Component<Props, {}, "">;
type ScreenFrame = ReturnType<typeof ScreenFrame>;
```

#### `ScreensCopy` (interface)

Every word the default title, play, paused and settings screens show.

```ts
interface ScreensCopy {
    readonly title: {
        readonly play: string;
    };
    /** The play screen's corner button and the touch stick, read by assistive technology. */
    readonly play: {
        readonly pause: string;
        readonly move: string;
    };
    readonly paused: {
        readonly title: string;
        readonly resume: string;
        /** The dialog's ✕ on the menu: not Resume, so a screen reader hears one Resume button, not two. */
        readonly close: string;
        /** The dialog's ✕ away from the menu (the quit confirm, the changed-elsewhere step). */
        readonly back: string;
        readonly mute: string;
        readonly unmute: string;
        readonly settings: string;
        readonly quit: string;
        readonly quitPrompt: string;
        readonly quitConfirm: string;
        readonly cancel: string;
        /** Why play paused when a controller in use was unplugged. */
        readonly reconnect: string;
    };
    readonly settings: {
        readonly screen: SettingsScreenCopy;
        readonly prompts: PromptCopy;
        readonly controls: ControlsCopy;
        readonly language: LanguageCopy;
        readonly vibration: VibrationCopy;
        readonly audio: AudioCopy;
        readonly touch: TouchCopy;
        readonly display: DisplayCopy;
    };
    readonly saves: {
        readonly slots: SaveSlotsCopy;
        readonly status: SaveStatusCopy;
        readonly changedElsewhere: ChangedElsewhereCopy;
        readonly changedElsewhereToast: string;
    };
    /** The scored board on the paused screen. */
    readonly board: LeaderboardCopy;
    /** Told once when a controller the input does not support is plugged in. */
    readonly padUnsupported: string;
}
```

#### `ScreensCopyInput` (type)

A game's words for the default screens: a part of the record, or a function of the player's locale returning one.
The function runs again on each language change, so a Paraglide game can pass its messages:
`screens: () => ({ title: { play: m.play() } })`.

```ts
type ScreensCopyInput = ScreensCopyOverrides | ((locale: string) => ScreensCopyOverrides);
```

#### `ScreensCopyOverrides` (type)

A part of `ScreensCopy` with every group optional, down to the words; a word or a function is replaced whole.

```ts
type ScreensCopyOverrides<T = ScreensCopy> = {
    readonly [K in keyof T]?: T[K] extends Leaf ? T[K] : ScreensCopyOverrides<T[K]>;
};
```

#### `ScreensGame` (interface)

What the default screens need from the game.

```ts
interface ScreensGame {
    readonly title: string;
    readonly sim: {
        readonly plugins: readonly PluginDef[];
        readonly seed: number;
        readonly setup?: ((sim: Sim) => void) | undefined;
        readonly content?: unknown;
    };
    readonly input?: InputMap | undefined;
    /** Told the sim play runs, and `undefined` when the title drops it: the draw layer reads it. */
    readonly watchSim?: ((sim: Sim | undefined) => void) | undefined;
    /** The board paused shows: the game's first scored board. None: paused shows no board. */
    readonly board?: string | undefined;
    /** Applies the player's graphics quality to the stage: the saved one at the title, then each choice. */
    readonly setQuality?: ((tier: QualityTier) => void) | undefined;
    /** The game's save: the title lists its slots and play keeps the loaded one saved. None: no slot list. */
    readonly saves?: GameSaves<unknown> | undefined;
    /** The game's extensions: play draws their `hud.overlay` components, Settings shows their `settings.sections`. */
    readonly extensions?: readonly ExtensionDef[] | undefined;
    /** The game's words for these screens (`GameSpec.copy.screens`), over the English defaults. */
    readonly copy?: ScreensCopyInput | undefined;
}
```

#### `ScrollList` (const)

A list that keeps its rows.

It reserves `min(minRows, rowCount)` rows of `--af-row-h` as its minimum height, so on a short
screen its siblings shrink before a row is lost. The reserve is capped at the height its parent
gives it: where even that cannot hold the rows (TV scale on a compact phone) the list keeps what
fits and scrolls the rest inside its own box, rather than painting over the controls below it. For that to work its parent must give it a
`1fr` grid row or `flex: 1 1 auto`, never `minmax(0, 1fr)`, which ignores an item's minimum.
Rows mark themselves `data-row`. It is a declared scroll region (`data-scroll-region`): the layout
contracts allow controls to be off screen only inside one.

```ts
const ScrollList: import("svelte").Component<Props, {}, "">;
type ScrollList = ReturnType<typeof ScrollList>;
```

#### `SentCommand` (type)

What a slot component asks the game for: a command, without the tick, source and seq the stream fills in.

```ts
type SentCommand = Pick<Command, 'type' | 'payload'>;
```

#### `Settings` (interface)

The booted game's settings as a runtime service: its key and store, both undefined for a game without
settings.

```ts
interface Settings {
    readonly key: string | undefined;
    readonly store: SettingsStore<unknown> | undefined;
}
```

#### `SettingsDef` (interface)

A game's settings: the key it is saved under, its version, schema, defaults and migration steps, and which
fields stay on one device.

```ts
interface SettingsDef<S> {
    readonly key: string;
    readonly version: number;
    readonly schema: z.ZodType<S>;
    readonly defaults: S;
    readonly migrations?: Readonly<Record<number, (record: Record<string, unknown>) => Record<string, unknown>>>;
    /**
     * Fields that belong to one device: kept in its `DeviceStorage`, never in the player's saves, and the saves'
     * copy is never read. The rest of the record is the player's, as for any settings. Names, not
     * `keyof S`, so a `SettingsDef<S>` stays assignable where `SettingsDef<unknown>` is wanted; `createSettings`
     * refuses a name the defaults do not have.
     */
    readonly deviceFields?: readonly string[];
}
```

#### `SettingsScreen` (const)

The core Settings screen: a dialog over the dimmed game, the same frame as Paused, so going between them reads as
one dialog changing its view. Tabs stay put and the chosen tab's sections scroll under them in one list that counts
what is below; Back sits under the dialog, and Escape and the dialog's Close go back too. Where the dialog is 560 px
wide (it widens on a short band) the sections go two across. The default screens give it Display and Controls;
extensions add theirs to the Settings tab through the `settings.sections` slot. A kit's styled screen replaces it
by flow.

```ts
const SettingsScreen: import("svelte").Component<Props, {}, "">;
type SettingsScreen = ReturnType<typeof SettingsScreen>;
```

#### `SettingsScreenCopy` (interface)

The Settings screen's own words: its title, Back, the tabs and the overflow count.

```ts
interface SettingsScreenCopy {
    readonly title: string;
    readonly back: string;
    readonly tabs: string;
    readonly settingsTab: string;
    readonly controlsTab: string;
    readonly more: (count: number) => string;
}
```

#### `settingsStore` (function)

The booted store for `def`. Throws when `def` is not the game's settings: asking for another key is the game's
mistake, and a store made up on the spot would save under a key nothing reads.

```ts
function settingsStore<S>(settings: Settings, def: SettingsDef<S>): SettingsStore<S>;
```

#### `SettingsTab` (interface)

A tab of the Settings screen (Settings and Controls): its label and its sections, in order.

```ts
interface SettingsTab {
    readonly id: string;
    readonly label: string;
    readonly sections: readonly SettingsSection[];
}
```

#### `Sheet` (const)

A Modal on the bottom edge at every form factor: the same scoping, Close and
scroll region, where a thumb reaches the actions. Settings' sub-pages and a "more" menu use it.

```ts
const Sheet: import("svelte").Component<ModalProps, {}, "">;
type Sheet = ReturnType<typeof Sheet>;
```

#### `Sim` (interface)

A running simulation, stepped with commands, that can snapshot, restore and hash its state. `step` is the
only way gameplay state changes. Create one with `createSim`, and `dispose` it when done.

```ts
interface Sim {
  readonly seed: number
  readonly tickHz: number
  readonly tick: number
  /** XXH64 of the canonical content this sim was created with, 16 hex digits; the snapshot header's value. */
  readonly contentHash: string
  step(commands: readonly Command[]): StepResult
  /** Setup and inspection outside `step` (tests, scene setup). Runtime changes go through commands. */
  spawn(parts: readonly SpawnPart[]): number
  entity(sid: number): EntityRef | undefined
  query(...components: ComponentDef[]): EntityRef[]
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>
  /** Canonical snapshot v1 bytes. */
  snapshot(): Uint8Array
  /** Replaces the whole state. Throws SnapshotFormatError / SnapshotMismatchError and leaves the sim unchanged. */
  restore(bytes: Uint8Array): void
  /**
   * A readable view of `bytes`, or of the current state when none are given. Decodes and checks
   * the header as `restore` does (SnapshotFormatError / SnapshotMismatchError) but not restore's later
   * cross-checks, and changes nothing.
   */
  describeSnapshot(bytes?: Uint8Array): SnapshotView
  /** xxhash64 of the snapshot, 16 hex digits. */
  hash(): string
  /** Frees the Koota world and every plugin's engine. Idempotent; any later call throws SimDisposedError. */
  dispose(): void
}
```

#### `SimContext` (interface)

What a system's `run` receives each tick.

```ts
interface SimContext {
  readonly tick: number
  /** Fixed step, 1 / tickHz. */
  readonly dt: number
  /** This system's own RNG substream. */
  readonly rng: Rng
  /** Compiled content, deep-frozen. */
  readonly content: unknown
  /** Live entities that have every listed component, in ascending StableId order. */
  query(...components: ComponentDef[]): EntityRef[]
  entity(sid: number): EntityRef | undefined
  /** Spawns immediately; returns the new StableId. */
  spawn(...parts: SpawnPart[]): number
  /** Despawn is deferred to the end of the tick (built-in `entities.flush`). */
  despawn(sid: number): void
  readonly commands: {
    of<Z extends z.ZodType>(def: CommandDef<Z>): ReadonlyArray<CommandRecord<z.output<Z>>>
  }
  emit<Z extends z.ZodType>(def: EventDef<Z>, payload: z.input<Z>): void
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>
  /** The per-sim state of the plugin that registered this system (`definePlugin({ state })`), else undefined. */
  readonly pluginState: unknown
}
```

#### `Slider` (const)

A number in a range: a labelled native `<input type="range">`, so the browser
gives the arrow keys and the focus navigator's `adjust` steps it. `valueText` gives the value its
words for assistive technology (`aria-valuetext`), and the same words show beside the track. The
thumb is a 44 px target, checked by the layout contract.

```ts
const Slider: import("svelte").Component<Props, {}, "">;
type Slider = ReturnType<typeof Slider>;
```

#### `Split` (const)

Two panes side by side where both fit at `min` px, stacked otherwise. Measured, because a container query cannot read a prop; stacked
until the first measurement, so a pane never starts squeezed.

```ts
const Split: import("svelte").Component<Props, {}, "">;
type Split = ReturnType<typeof Split>;
```

#### `sprite` (function)

A sprite that follows its component's `x`, `y` and `angle`, interpolated between ticks. `source` is a
texture or a url: a url the runtime already loaded (it is in `Assets.cache`) shows at once; otherwise the
sprite is empty until `Assets.load` resolves. A url that fails to load is reported with `reportError`
and the sprite stays empty. The frame textures are sliced once per factory and shared by its sprites.
With `frame`, the url is an atlas page's Spritesheet and the sprite shows that frame; a name the atlas lacks
is reported the same way.

```ts
function sprite(source: Texture | string, options?: SpriteViewOptions): EntityViewFactory;
```

#### `SpriteFrames` (interface)

The texture is a sheet of equal frames, read left to right, top to bottom. The pose component's numeric
`frame` field picks one (floored, wrapped by the frame count); with no `frame` field the first is shown.
Frames switch on ticks; they are not interpolated.

```ts
interface SpriteFrames {
    readonly width: number;
    readonly height: number;
    /** Default: every whole frame that fits in the texture. */
    readonly count?: number | undefined;
}
```

#### `SpriteViewOptions` (interface)

A `sprite` view's anchor and either its sprite-sheet frames or one frame of a packed atlas.

```ts
interface SpriteViewOptions {
    /** Default 0.5 (centred on the entity's position). */
    readonly anchor?: ViewAnchor | undefined;
    readonly frames?: SpriteFrames | undefined;
    /**
     * A frame of a packed atlas: `source` is the url of an atlas page's Spritesheet JSON, which
     * `automata-content assets` writes, and `frame` names one of its frames. Not with `frames`.
     */
    readonly frame?: string | undefined;
}
```

#### `StageCharacters` (interface)

The stage's port for characters, keyed by the sim's stable id of the character.

```ts
interface StageCharacters {
    /** Where a word above a character sits, in `stage.ui`'s coordinates, or `undefined` when it has no view. */
    point(ref: number): {
        readonly x: number;
        readonly y: number;
    } | undefined;
    /** Scales a character's view by `x` and `y` from the scale it rests at. */
    squash(ref: number, x: number, y: number): void;
    /** Puts a squashed character's scale back. */
    rest(ref: number): void;
    /** Holds these characters' poses until the next call. */
    hold(refs: ReadonlySet<number>): void;
}
```

#### `startGame` (function)

Boots a game: `defineGame`'s defaults over the runtime, the Pixi renderer, Ruken hosting
and the default screens, then the runtime's boot on the game's root. Takes a spec or a game `defineGame`
already returned. Throws `BootDefect` before anything mounts when the spec is invalid or there is no
root (`spec.root`, else `#game`); a failure after that shows on the runtime's boot failure panel. `start.at` starts on
another screen than the flow's entry, for a restart in development (`StartOptions`).

```ts
function startGame<S = never>(game: GameSpec<S> | DefinedGame<S>, start?: StartOptions): RuntimeHandle;
```

#### `StartOptions` (interface)

How a game starts.

```ts
interface StartOptions {
    /**
     * The screen to start on instead of the flow's entry, for a restart in development that brings the person back
     * where they were (a tuning change restarts the game on new content). A screen the flow does not have starts at
     * the entry. The start screen's assets load as it enters, as any screen's do after boot.
     */
    readonly at?: string | undefined;
}
```

#### `StepResult` (interface)

What one `step` produced: the new tick, the events emitted, the renderer's delta and the commands that were
rejected.

```ts
interface StepResult {
  /** The tick the sim is at after this step. */
  readonly tick: number
  readonly events: readonly SimEvent[]
  readonly render: RenderDelta
  /** Invalid commands, in input order. The sim has no I/O, so it reports instead of logging. */
  readonly rejected: readonly RejectedCommand[]
}
```

#### `STICKY_MARGIN_PX` (const)

How far outside a button a thumb still counts for it, in CSS pixels.

```ts
const STICKY_MARGIN_PX = 24;
```

#### `SubscriptionEntitlement` (interface)

One subscription the player holds. The host computes `active`.

```ts
interface SubscriptionEntitlement {
    sku: string;
    plan: 'monthly' | 'season';
    active: boolean;
    seasonId?: string | undefined;
    /** ISO 8601 UTC instant. */
    endsAt?: string | undefined;
}
```

#### `suppressPageGestures` (function)

Turns off the browser's document gestures over the game.

A right-click menu, a long-press menu or an image dragged off the page
reminds a player they are on a web page, which breaks the illusion the
screen is drawn. Text selection is off in CSS (`theme.css`); these two are
events, so they are cancelled here.

Text fields are the exception. A name or code field keeps its menu, so
text can be pasted from a message.

```ts
function suppressPageGestures(doc: Document): () => void;
```

#### `systemClock` (const)

The real clock. `performance.now()` is steady: it does not jump when the player changes the system time.

```ts
const systemClock: Clock;
```

#### `SystemDef` (interface)

A system: a name, the phase it runs in, the systems it must run `before` or `after` within that phase, and
its `run`, called once per tick. Create one with `defineSystem`.

```ts
interface SystemDef {
  readonly kind: 'system'
  readonly name: string
  readonly phase: Phase
  readonly before: readonly string[]
  readonly after: readonly string[]
  readonly run: (ctx: SimContext) => void
}
```

#### `TAURI_MARKERS` (const)

String literals only Tauri's IPC code contains, which survive minification: the global the webview injects
(`@tauri-apps/api/core`) and the process plugin's exit command (`@tauri-apps/plugin-process`). A `tauri` build holds
both; a `web`, `itch` or `ruken` build holds neither. Re-check them after a Tauri upgrade:
`target.build.test.ts` fails if a `tauri` build stops containing them.

```ts
const TAURI_MARKERS: readonly string[];
```

#### `Time` (interface)

The time service: whether the sim is paused, and why; each reason pauses until it is resumed.

```ts
interface Time {
    readonly paused: boolean;
    readonly reasons: ReadonlySet<PauseReason>;
    pause(reason: PauseReason): void;
    resume(reason: PauseReason): void;
}
```

#### `TimeoutHandle` (type)

What a timeout is called back with: opaque, only ever handed back to `clearTimeout`.

```ts
type TimeoutHandle = unknown;
```

#### `Toast` (const)

A passing message: "Pad connected", "Saved", "This controller is not supported".
The owner shows it and takes it away; Toast neither times itself nor takes focus, so a player
in the middle of a menu is never moved.

It is a polite live region (`role="status"`), and an error is an alert. Every tone but `info`
shows a glyph and says `toneLabel` to assistive technology, so the tone survives with every
colour removed (U-b); a toned toast without words throws while it mounts.

It sits above Ruken's strip, the safe area and the keyboard, through the geometry owner's inset
variables, and slides in unless the player asked for less movement.

```ts
const Toast: import("svelte").Component<Props, {}, "">;
type Toast = ReturnType<typeof Toast>;
```

#### `Toggle` (const)

An on/off setting: a native checkbox with the switch role, so the browser gives
Space and the focus navigator's `adjust` flips it. The state shows in words (`onLabel`,
`offLabel`) beside the track, never in colour alone.

Controlled, as OptionGroup is: a click reports the new state through `onchange`, and the box
shows the `checked` it is given.

```ts
const Toggle: import("svelte").Component<Props, {}, "">;
type Toggle = ReturnType<typeof Toggle>;
```

#### `TouchButton` (interface)

One on-screen touch button: every key bound to the same payload shares it.

```ts
interface TouchButton {
    readonly id: string;
    readonly label: string;
    readonly keys: readonly string[];
    /** Which lower corner's group it sits in. Default `start`; a game moves buttons to `end` itself. */
    readonly side?: 'start' | 'end' | undefined;
    /** The game cannot be played without it: where the touch buttons do not all fit, only these show. */
    readonly required?: boolean | undefined;
}
```

#### `TouchControls` (const)

The on-screen touch buttons.

This is the element that produces pointer events and nothing more; the multi-touch bookkeeping is
`touch-controls.ts`. Each side's group takes the pointers, not the buttons, and reaches `STICKY_MARGIN_PX` past
them with an invisible margin, so a near miss presses the nearest button and a held thumb can slide from one to
the next. The group captures the pointer, so the release always arrives, however far the thumb wanders.

Pointer only: the buttons are never in the focus order, since a keyboard or pad drives the same actions directly.
Hidden (not unmounted) while the player uses another device, so the screen never remounts; hiding or coming down
releases whatever is held.

```ts
const TouchControls: import("svelte").Component<TouchControlsProps, {}, "">;
type TouchControls = ReturnType<typeof TouchControls>;
```

#### `Translate` (type)

The typed `t` verb: `t('hello', { name })`, checked against the game's compiled messages.

```ts
type Translate<Messages> = <K extends keyof Messages & string>(key: K, ...inputs: InputsOf<Messages[K]>) => string;
```

#### `turnUnitsFromPixels` (function)

`dxPx` dragged at `degPerPixel` as whole turn units: positive for a drag to the right (which way that turns the
heading is the game's convention), negated when `invert`, clamped to ±`MAX_TURN_UNITS_PER_STEP`. Halves round away
from zero, so a drag left and the same drag right are the same size. A non-finite input or a `degPerPixel` that is
not positive gives 0, and the result is never −0.

```ts
function turnUnitsFromPixels(dxPx: number, degPerPixel: number, invert: boolean): number;
```

#### `typedBus` (function)

Cast a PresentationBus instance to a typed view with game-specific fact types.
Safe because PresentationBus stores facts dynamically by string key.

```ts
function typedBus<GameFacts>(bus: PresentationBus<object>): PresentationBus<GameFacts>;
```

#### `usePlay` (function)

The running game, for a component the play screen draws (the `hud.overlay` slot): read it, and send it commands.
Call it while the component is being made, as any Svelte context.

```ts
function usePlay(): PlayHandle;
```

#### `ViewportWindow` (interface)

The parts of `window` the owner reads; a fake from `@automata/framework/testing` stands in for it in tests.

```ts
interface ViewportWindow {
    readonly innerWidth: number;
    readonly innerHeight: number;
    readonly visualViewport?: {
        readonly height: number;
        readonly offsetTop: number;
        addEventListener: Listen;
        removeEventListener: Listen;
    } | null | undefined;
    /** Read only where the browser needs its bar recognised (`browser/hidden-browser-bar.ts`). */
    readonly screen?: {
        readonly width: number;
        readonly height: number;
    } | undefined;
    readonly navigator?: object | undefined;
    addEventListener: Listen;
    removeEventListener: Listen;
}
```

### `import { … } from '@automata/framework/extension'`

#### `defineExtension` (function)

Returns its argument. It exists so the name keeps its literal type and `pnpm style` can find extensions.

```ts
function defineExtension<const N extends string>(def: ExtensionDef<N>): ExtensionDef<N>;
```

#### `ExtensionDef` (interface)

One opt-in feature of a game. Build it with `defineExtension`.

```ts
interface ExtensionDef<Name extends string = string> {
    /** Kebab-case and unique. */
    readonly name: Name;
    /** Names of other extensions that must come first. */
    readonly requires?: readonly string[];
    /** `definePlugin` results; they pass the determinism checker. */
    readonly sim?: readonly PluginDef[];
    /** `defineContentSchema` results. */
    readonly content?: readonly ContentSchemaDef[];
    /** Components for the named ui slots. An extension fills the slots it wants, and cannot add a slot. */
    readonly ui?: {
        readonly slots?: Readonly<Partial<Record<UiSlotName, UiComponent>>>;
    };
    /** Called at build time with the game's manifest facts. */
    readonly manifest?: (config: GameConfig) => RukenManifestContribution;
}
```

#### `ExtensionError` (class)

A bad extension list. Thrown, not returned, so a game's Vite build fails with `message`.

```ts
class ExtensionError extends Error {
    readonly _tag: "ExtensionError";
    readonly reason: ExtensionErrorFields['reason'];
    readonly names: readonly string[];
    constructor(fields: ExtensionErrorFields);
}
```

#### `GameConfig` (type)

The parts of the game config an extension may read (content's `GameConfig`).

```ts
type GameConfig = Pick<FullGameConfig, 'game' | 'runtime' | 'content'>;
```

#### `ResolvedExtensions` (interface)

Everything the runtime and the build tools need from a game's extension list, in one fixed order.

```ts
interface ResolvedExtensions {
    /** Extension names: `requires` first, ties by name. */
    readonly order: readonly string[];
    /** In extension order; the game passes them to `createSim`. */
    readonly simPlugins: readonly PluginDef[];
    /** For the content Vite plugin's `schemas`. */
    readonly contentSchemas: readonly ContentSchemaDef[];
    /** Every extension's component for that slot, in order. */
    slots(name: UiSlotName): readonly UiComponent[];
    /** The contributions merged: preload lists concatenated, a repeated path keeps its first place. */
    manifest(config: GameConfig): RukenManifestContribution;
}
```

#### `resolveExtensions` (function)

Checks the list and puts it in a fixed order. Throws `ExtensionError`, synchronously, so a game's
Vite config fails the build with the message. At run time the build has already resolved the same
list, so a throw there is a defect.

```ts
function resolveExtensions(defs: readonly ExtensionDef[]): ResolvedExtensions;
```

#### `RukenManifestContribution` (type)

What an extension may add to ruken.toml: preload files. `wants` is not a manifest field.

```ts
type RukenManifestContribution = {
    readonly loading?: {
        readonly preload?: readonly string[];
    };
};
```

#### `UiComponent` (type)

What an extension puts in a slot: a Svelte component that takes no props.

```ts
type UiComponent = Component<Record<string, never>>;
```

#### `UiSlotName` (type)

The name of a place an extension may add UI: one of `UI_SLOT_NAMES`.

```ts
type UiSlotName = (typeof UI_SLOT_NAMES)[number];
```

### `import { … } from '@automata/framework/testing'`

#### `BAR_ACTIONS` (const)

The selector for the controls a player presses in a bar: the buttons, links, tabs and menu items inside a region a
screen or an editor declares with `data-region` (`topbar`, `rail`, `panel`, `dock`, `tools`). `findCutByBar` and
`findCovered` take it as their `selector`, and `checkLayout` runs both with it.

```ts
const BAR_ACTIONS: string;
```

#### `byTestId` (function)

The element a test id names; throws when the fixture has none, so a missing part fails loudly.

```ts
function byTestId(id: string): HTMLElement;
```

#### `checkLayout` (function)

The checks every screen shares: the document never scrolls; every control is at least the conditions' target
(primaries the primary target) at this scale, on screen unless in a declared scroll region,
never under a reserved area or a touch button and never over the corner row; the corner row's controls and any
`data-way-out` stay reachable (but under a modal dialog or an ErrorPanel that had to rise); no
ActionBar wraps (level 3); no row (`[data-row]`) clips what it holds; no control is cut at the side of the scroll
region it scrolls in (`findCutAtSide`: a region declared `data-scroll-region="both"` scrolls sideways too), no
action in a bar is cut by it (`findCutByBar`) or covered (`findCovered`), and no control's words run past its edge; and each of `essentials` is reachable without scrolling.

```ts
function checkLayout(conditions: Conditions, essentials: readonly Element[]): string[];
```

#### `Conditions` (interface)

The conditions a layout test runs under: the geometry published for a size and variant, and the regions
that cover the page (the keyboard, Ruken's strip), which nothing may sit under.

```ts
interface Conditions {
    readonly geometry: Geometry;
    /** What covers the page in this variant: the keyboard, Ruken's strip. Nothing may sit under it. */
    readonly reserved: LayoutRect[];
    /** The sizes every control is held to (`TOUCH_TARGETS` unless the screen is held with a mouse). */
    readonly targets: Targets;
}
```

#### `describeHostingContract` (function)

Registers the `Hosting` contract's cases as a Vitest `describe` block named after `name`. `create` builds a fresh
`Hosting` for each case, with `saves` granted; `settled` lets the host answer (for example one macrotask). Every
target's adapter and `FakeHosting` pass these cases. Each case disposes its `Hosting`.

```ts
function describeHostingContract(name: string, create: HostingFactory, settled: Settle): void;
```

#### `documentScrolls` (function)

The document itself never scrolls; screens scroll inside declared regions.

```ts
function documentScrolls(doc: Document): string[];
```

#### `errorPanelFloor` (function)

The least height any of an ErrorPanel's layouts needs, measured here rather than read from the
panel, so a panel that misjudges its room cannot excuse itself. For each layout
(`row`, `stack`, `row-tight`) it lays the panel out, keeps the layout only where its message is
readable there (20 characters or the whole panel, half that in `row-tight`, and clear of the
actions), and takes the panel's chrome, one message line and the actions as laid out. The
panel's own layout is put back after.

```ts
function errorPanelFloor(panel: HTMLElement): number;
```

#### `FakeAudioContext` (interface)

A recording stand-in for an `AudioContext`: what was started, stopped and automated, with a clock tests
move by hand.

```ts
interface FakeAudioContext extends AudioContextLike {
    state: AudioContextLike['state'];
    currentTime: number;
    readonly gains: FakeGainNode[];
    readonly started: Started[];
    readonly stopped: Array<{
        readonly alias: string;
        readonly when: number;
    }>;
    readonly resumed: number;
    readonly closed: boolean;
    /** Moves the clock on, ending every source whose stop time it passes. */
    advance(seconds: number): void;
    /** As the system does for a phone call or Siri. */
    interrupt(): void;
    /** Ends a source as if it played out. */
    end(alias: string): void;
}
```

#### `fakeAudioContext` (function)

`decode` turns the bytes `decodeAudioData` receives into a buffer, or throws as the browser does for bytes that
are not audio; by default the bytes are the alias's UTF-8 text.

```ts
function fakeAudioContext(decode?: (bytes: ArrayBuffer) => AudioBuffer): FakeAudioContext;
```

#### `fakeBuffer` (const)

A decoded buffer that remembers the alias it came from, so `started` can name it.

```ts
const fakeBuffer: (alias: string, duration?: number) => AudioBuffer;
```

#### `FakeClock` (interface)

A `Clock` whose time a test moves by hand: nothing fires until `advance`.

```ts
interface FakeClock extends Clock {
    /** Moves time forward by `ms`, firing every timeout that falls due on the way, earliest first. */
    advance(ms: number): void;
    /** How many timeouts are still waiting. */
    pending(): number;
}
```

#### `fakeClock` (function)

Makes a `FakeClock` at time 0 with no timeouts waiting.

```ts
function fakeClock(): FakeClock;
```

#### `fakeFetch` (function)

Creates an in-memory fetch implementation for deterministic loading tests.

```ts
function fakeFetch(routes: Readonly<Record<string, FakeRoute>>, options?: FakeFetchOptions): FakeFetchResult;
```

#### `FakeFetchOptions` (interface)

Options for `fakeFetch`: the fetch that answers urls with no route.

```ts
interface FakeFetchOptions {
    readonly fallback?: typeof fetch;
}
```

#### `FakeFetchResult` (interface)

The fake fetch, and the urls it was asked for and saw aborted.

```ts
interface FakeFetchResult {
    readonly fetch: typeof fetch;
    readonly requests: string[];
    readonly aborted: string[];
}
```

#### `FakeGainNode` (interface)

A gain node of `fakeAudioContext`, recording its value, its targets and its automation.

```ts
interface FakeGainNode {
    readonly targets: unknown[];
    readonly automation: Array<{
        readonly method: string;
        readonly value?: number;
        readonly at: number;
    }>;
    readonly gain: {
        value: number;
    };
}
```

#### `fakeGamepads` (function)

`target` hears `gamepadconnected` and `gamepaddisconnected`, as `window` does in a browser.

```ts
function fakeGamepads(options?: {
    readonly target?: EventTarget;
}): FakeGamepads;
```

#### `FakeGamepads` (interface)

Four gamepad slots a unit test plugs pads into and presses; `getGamepads` reads them as the browser's would.

```ts
interface FakeGamepads {
    readonly getGamepads: () => (Gamepad | null)[];
    /** Puts a pad at rest in `index` (0 by default): standard, unless `mapping` says otherwise. */
    connect(index?: number, options?: {
        readonly mapping?: '' | 'standard';
        readonly id?: string;
    }): void;
    unplug(index?: number): void;
    press(button: number, value?: number, index?: number): void;
    release(button: number, index?: number): void;
    /** The left stick. */
    stick(x: number, y: number, index?: number): void;
}
```

#### `FakeHostControl` (interface)

What a test does to, and reads from, the fake host.

```ts
interface FakeHostControl {
    /** Makes `ready` resolve (with `deferReady`). */
    welcome(): void;
    /** Makes `ready` fail with `code` (with `deferReady`). */
    failReady(code: ErrorCode): void;
    /** Sends the game a host change. Each payload is checked by its contract schema, so a bad fixture throws here. */
    readonly push: {
        lifecycle(payload: LifecyclePayload): void;
        input(payload: InputModePayload): void;
        display(payload: DisplayMetricsPayload): void;
        audio(payload: AudioChange): void;
        entitlements(payload: EntitlementsPayload): void;
        savesStatus(status: SavesStatus): void;
        /** Another device's write: the host's saves change and `saves.changed` carries it. */
        savesChanged(payload: SavesChangedPayload): void;
    };
    /** The host's saves now. */
    readonly saved: ReadonlyMap<string, string>;
    /** Makes the next call named `operation` (for example `saves.set`) fail with `code`. */
    failNext(operation: string, code: ErrorCode): void;
    /** Holds every call named `operation` unanswered until `release(operation)`, so a test can time it out. */
    hold(operation: string): void;
    release(operation: string): void;
    readonly tracked: readonly TrackedEvent[];
    readonly exits: readonly ('player' | 'completed')[];
    /** Every fullscreen request, in order. */
    readonly fullscreen: readonly boolean[];
    /** Every round start and end the host received (after the contract's guard), in order. */
    readonly rounds: readonly ({
        readonly start: true;
    } | {
        readonly end: RoundOutcome | undefined;
    })[];
    readonly submits: readonly Submission[];
    /** The host's "Open game menu": the latest handler's answer, or false before `ready` or with none. */
    requestMenu(): boolean;
    /** The host closes the game: the exiting handlers in order, then the save flush, all within `HOST_EXIT_CAP_MS`. */
    close(): Promise<void>;
}
```

#### `fakeHosting` (function)

A fake host and the control handle that drives it. `create` builds the game's `Hosting`; `dispose()` shuts it down
(later calls are refused `CANCELLED`, every subscription stops). `clock` times the exit cap.

```ts
function fakeHosting(options?: FakeHostingOptions): {
    readonly control: FakeHostControl;
    create(hosting: HostingOptions, clock?: Clock): Hosting;
    /** `create` in the shape of the runtime's `seams.hosting`: boot's clock times the exit cap; never refused. */
    make(hosting: HostingOptions, seams?: {
        readonly clock?: Clock;
    }): Promise<HostResult<Hosting>>;
};
```

#### `FakeHostingOptions` (interface)

How the fake host starts. Every field has a default, so `fakeHosting()` is a web page with saves.

```ts
interface FakeHostingOptions {
    /** The target to stand in for: its `kind`, `hostName`, grants and error codes. Default `web`. */
    readonly target?: FakeTarget;
    /** The capabilities granted, in place of the target's default ones. */
    readonly granted?: readonly Capability[];
    /** When true, `ready` waits for `control.welcome()` (or `control.failReady`); otherwise it is ready at once. */
    readonly deferReady?: boolean;
    readonly player?: {
        readonly id: string;
        readonly displayName: string;
    };
    readonly locale?: string;
    /** The game's title, which the desktop target uses as its `hostName`. Default `Game`. */
    readonly title?: string;
    /** Saves already on the host when the session starts. */
    readonly saves?: Readonly<Record<string, string>>;
    /** Whether the player consented to analytics. Default true; false drops every `track`. */
    readonly consent?: boolean;
    readonly lifecycle?: LifecyclePayload;
    readonly input?: InputModePayload;
    readonly display?: DisplayMetricsPayload;
    readonly audio?: AudioChange;
    readonly entitlements?: EntitlementsPayload;
    readonly savesStatus?: SavesStatus;
}
```

#### `FakeResizeObserver` (interface)

Controls the fake `ResizeObserver` `installFakeResizeObserver` put in place: report a width to every
observer, then restore the original.

```ts
interface FakeResizeObserver {
    /** Reports `width` to every live observer, for every element it observes. */
    resize(width: number): void;
    restore(): void;
}
```

#### `FakeRoute` (interface)

How `fakeFetch` answers one url: a status, the body in chunks, a content length or type, a hang or a
network error.

```ts
interface FakeRoute {
    readonly status?: number;
    readonly chunks?: readonly Uint8Array[];
    readonly contentLength?: number;
    readonly hang?: boolean;
    readonly networkError?: boolean;
    readonly type?: string;
}
```

#### `FakeTarget` (type)

The four distribution targets a fake host can stand in for (ADR 0006).

```ts
type FakeTarget = 'web' | 'itch' | 'ruken' | 'tauri';
```

#### `FakeViewportWindow` (interface)

A stand-in for the browser window the geometry owner reads: its size, `screen`, `navigator`, visual
viewport and `resize` listeners, with methods to rotate, open the keyboard and count live listeners.

```ts
interface FakeViewportWindow {
    readonly innerWidth: number;
    readonly innerHeight: number;
    readonly visualViewport: FakeVisualViewport;
    /** `screen`, which does not move when the page does. */
    readonly screen: {
        readonly width: number;
        readonly height: number;
    };
    /** `navigator`, for corrections that only one browser needs (DuckDuckGo's client-hint brands). */
    readonly navigator: object;
    addEventListener(type: string, listener: Listener): void;
    removeEventListener(type: string, listener: Listener): void;
    /** Rotation, a browser bar, a window drag: both viewports take the new size. */
    resize(width: number, height: number): void;
    /** The on-screen keyboard covers `height` px of the visual viewport; the layout keeps its size. */
    openKeyboard(height: number): void;
    closeKeyboard(): void;
    /** Live listeners on the window and its visual viewport together, to prove disposal. */
    listenerCount(): number;
}
```

#### `fakeViewportWindow` (function)

A fake window of the given size. Its `screen` defaults to that size and its `navigator` names no browser.
Resizing and the keyboard fire `resize` on the window and the visual viewport, as a browser does.

```ts
function fakeViewportWindow(size: {
    width: number;
    height: number;
    /** Defaults to the window's starting size. */
    screen?: {
        width: number;
        height: number;
    };
    /** Defaults to a navigator that names no browser. */
    navigator?: object;
}): FakeViewportWindow;
```

#### `FakeVisualViewport` (interface)

The visual viewport of `FakeViewportWindow`: its height (less the keyboard, if open), an offset, and
listeners for `resize`.

```ts
interface FakeVisualViewport {
    readonly height: number;
    readonly offsetTop: number;
    addEventListener(type: string, listener: Listener): void;
    removeEventListener(type: string, listener: Listener): void;
}
```

#### `findClipped` (function)

Each element `selector` names is tall enough for what it holds (a crushed row clips its content).

```ts
function findClipped(root: ParentNode, selector: string): string[];
```

#### `findCovered` (function)

Each visible control `selector` names is on top at its centre: what is drawn there is the control or inside it. A
modal dialog may cover it (the page behind a modal is inert), and so may anything `excused` says may: an ErrorPanel
that had to rise over the bar, for one. The same rule `findCoveredCorners` holds the corner row to.

```ts
function findCovered(root: ParentNode, selector: string, excused?: (cover: Element) => boolean): string[];
```

#### `findCutAtSide` (function)

No control is cut at a side of a declared scroll region that clips it (see `clippedBy`). A region scrolls up and
down, so a control past its side is cut where a player would not think to scroll, as a long language's options
were in a Settings list; `findOffscreenControls` passes whatever a region clips, so this is what catches a control
cut across. A region that scrolls sideways on purpose (an editor's strip of scenes) declares
`data-scroll-region="both"`: a control past its side is reached by scrolling it, and the walk out through the
regions around it stops there. A checkbox or radio is judged by its label (`pressedPart`).

```ts
function findCutAtSide(root: ParentNode): string[];
```

#### `findCutByBar` (function)

Each visible control `selector` names is whole inside every ancestor that clips its overflow. `findClipped` measures
a node's own vertical overflow, so a button that its bar cuts across (a phone's top bar hid Publish) is never seen
by it. An ancestor that is a declared scroll region (`data-scroll-region`) may hold a control past its side: the
player scrolls to it, and `findCutAtSide` judges the region.

```ts
function findCutByBar(root: ParentNode, selector: string): string[];
```

#### `findIntrusions` (function)

No visible control intersects a reserved area (Ruken's strip, a keyboard), in viewport px, by its
whole box. The one exception is a control that a declared scroll region clips (see `clippedBy`)
where that region is itself clear of every area: scrolling brings it into view. An undeclared
scroller earns nothing, and a fixed control is measured where it is drawn, whatever it sits inside.

```ts
function findIntrusions(root: ParentNode, rects: readonly LayoutRect[]): string[];
```

#### `findOffscreenControls` (function)

Every visible control is on screen, unless a declared scroll region (`[data-scroll-region]`)
clips it (see `clippedBy`): a fixed control, or one positioned outside the region, is judged
where it is drawn, since scrolling the region would never bring it into view.

```ts
function findOffscreenControls(root: ParentNode): string[];
```

#### `findOverlaps` (function)

Two elements' boxes do not overlap.

```ts
function findOverlaps(a: Element, b: Element): string[];
```

#### `findSmallTargets` (function)

Every visible control is at least `min` square, and a primary (`data-kind="primary"`) at least
`minPrimary` tall. A checkbox or radio is pressed through its label too, so the label is its target.

```ts
function findSmallTargets(root: ParentNode, min: number, minPrimary: number): string[];
```

#### `findUnreachable` (function)

Each element is fully inside the viewport, and the whole of it is in view: a tap at its centre
and at the middle of each edge lands on it or inside it, so nothing covers or clips any part.

```ts
function findUnreachable(elements: readonly Element[]): string[];
```

#### `hostDisplay` (function)

Ruken's display metrics for a hosted game. Defaults are Ruken's own fixture
(`packages/protocol/src/fixtures/display.ts` at b30d31b): a 48 x 56 tab on the right, landscape.

```ts
function hostDisplay(options?: {
    edge?: 'left' | 'right';
    width?: number;
    scale?: DisplayMetricsPayload['scale'];
    safeArea?: DisplayMetricsPayload['safeArea'];
}): DisplayMetricsPayload;
```

#### `HostingFactory` (type)

An adapter under test: a fresh `Hosting` per case, with `saves` granted.

```ts
type HostingFactory = () => Hosting | Promise<Hosting>;
```

#### `installFakeResizeObserver` (function)

Replaces the global `ResizeObserver` with a fake that reports only the widths you give it, for components
measured under jsdom, which has no layout. Call `restore` when the test ends.

```ts
function installFakeResizeObserver(): FakeResizeObserver;
```

#### `LayoutRect` (interface)

Layout assertions as plain DOM functions (`expectReachable`, `expectControlsFit`, `expectRowsWhole`,
`expectApart`, `expectNoDocumentScroll`).

Each returns a list of human-readable problems; `[]` is a pass. They take no test framework, so
the same code runs in Vitest browser mode and inside a Playwright `page.evaluate` bundle. They
measure what a player meets: no scrolling, at the centre of what they would tap. They need a real
layout engine; in jsdom every box is 0x0.

```ts
interface LayoutRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
```

#### `ManualFrames` (interface)

A frame source a test drives: `advance` moves time on and runs the frame asked for, if any.

```ts
interface ManualFrames extends FrameSource {
    advance(ms: number): void;
    readonly pending: boolean;
}
```

#### `manualFrames` (function)

A frame source that runs a frame only when a test advances it, starting at `startMs`.

```ts
function manualFrames(startMs?: number): ManualFrames;
```

#### `MountedFixture` (interface)

A mounted Svelte fixture: the element it was mounted into and a way to unmount it.

```ts
interface MountedFixture {
    readonly target: HTMLElement;
    /** Unmounts the component; removes the target too when `mountFixture` created it. */
    unmount(): Promise<void>;
}
```

#### `mountFixture` (function)

Mounts a Svelte component with the given props and no renderer or host, and flushes effects so the first
render is finished. Mounts into `target`, or into a new `div` in `document.body`, which `unmount` removes.

```ts
function mountFixture<Props extends Record<string, unknown>>(component: Component<Props>, props: Props, target?: HTMLElement): MountedFixture;
```

#### `mountInPlay` (function)

Mounts `slot` (a `hud.overlay` component) over `sim` with the play context, into `target` or a new element of the page.

```ts
function mountInPlay(slot: UiComponent, sim: Sim | undefined, target?: HTMLElement): PlayMount;
```

#### `nullRenderer` (function)

A renderer that draws nothing and records each call in `log`, for runtime tests without a GPU.

```ts
function nullRenderer(log?: NullRendererEntry[], options?: NullRendererOptions): RendererFactory;
```

#### `NullRendererEntry` (type)

One call `nullRenderer` recorded.

```ts
type NullRendererEntry = {
    readonly type: 'apply';
    readonly tick: number;
} | {
    readonly type: 'draw';
    readonly alpha: number;
} | {
    readonly type: 'reset';
} | {
    readonly type: 'destroy';
};
```

#### `NullRendererOptions` (interface)

Options for `nullRenderer`: `fail` makes it fail `RendererUnavailable`.

```ts
interface NullRendererOptions {
    readonly fail?: boolean;
}
```

#### `openRuntimeTest` (function)

Boots the runtime for screen and integration tests, as `runGame` does but without the loader or failure panel:
`openHostingTest` behind the scenes, page layers and geometry, the settings, the save, the services, and the flow
started when there are screens. A host refusal throws the `HostError` boot would show; a refused renderer throws its
reason. Whatever opened before a throw is closed.

```ts
function openRuntimeTest(options?: RuntimeTestOptions): Promise<RuntimeTestSession>;
```

#### `PlayMount` (interface)

A slot component mounted as the play screen draws it: the element it is in, the session it reads and sends through, and how to remove it.

```ts
interface PlayMount {
    readonly host: HTMLElement;
    /** `refresh()` says a frame passed; `commands(tick, [])` takes what the component sent. */
    readonly session: PlaySession;
    unmount(): void;
}
```

#### `PlaySession` (class)

One play screen's link to the running game: the reactive read-only view, the queue of sent commands and the
per-frame refresh. The default screens make one when play starts and give it to `PlayScreen`.

```ts
class PlaySession {
    #private;
    readonly handle: PlayHandle;
    constructor(sim: Sim | undefined);
    /** Says a frame passed, so what reads the sim reads it again. */
    refresh(): void;
    /**
     * The commands for `tick`: the input map's (`input`), then the sent ones in send order, each given this tick, source 0 and a
     * seq of its own (the input map's is the tick, and a seq is used once per source in a step).
     */
    commands(tick: number, input: readonly Command[]): readonly Command[];
}
```

#### `pressedPart` (function)

What a player presses for `control`: a checkbox's or radio's label (the theme draws it as the control, and a
press anywhere on it toggles the input), else the control itself.

```ts
function pressedPart(control: HTMLElement): HTMLElement;
```

#### `publishConditions` (function)

Measures and publishes the geometry for `size` under `variant`, as the owner would; `targets` are the control sizes the checks hold.

```ts
function publishConditions(root: HTMLElement, size: ReferenceSize, variant: Variant, targets?: Targets): Conditions;
```

#### `REFERENCE_SIZES` (const)

The viewports a layout is checked at: phones in both orientations, tablets, desktops, both sides of every
breakpoint and the tightest sizes, each with the classification it should get.

```ts
const REFERENCE_SIZES: readonly ReferenceSize[];
```

#### `ReferenceFormFactor` (type)

The geometry owner's `FormFactor`.

```ts
type ReferenceFormFactor = 'phone-portrait' | 'phone-landscape' | 'tablet-portrait' | 'desktop';
```

#### `ReferenceHeightTier` (type)

The geometry owner's `HeightTier`.

```ts
type ReferenceHeightTier = 'short' | 'compact' | undefined;
```

#### `ReferenceSize` (interface)

One viewport every primitive and screen is checked at: a name, its size, and the form factor and height
tier it must classify as.

```ts
interface ReferenceSize {
    readonly name: string;
    readonly width: number;
    readonly height: number;
    readonly formFactor: ReferenceFormFactor;
    readonly heightTier: ReferenceHeightTier;
    readonly group: 'phone' | 'tablet' | 'desktop' | 'boundary' | 'tight';
}
```

#### `RuntimeTestOptions` (interface)

What `openRuntimeTest` boots: the fake host, the screens, content, settings and save, and the frames, renderer,
fetch and locale it uses.

```ts
interface RuntimeTestOptions {
    readonly hosting?: HostingTestOptions | Partial<Omit<FakeHostOptions, 'gameOrigin' | 'gameId'>>;
    readonly screens?: readonly ScreenDef[];
    readonly content?: CompiledContentData;
    readonly settings?: SettingsDef<unknown>;
    /** The game's save, opened as boot opens it: its triggers and exit flush run, and `saveOf(def)` finds it. */
    readonly saves?: SaveDef<unknown>;
    /** Where settings fields kept on the device go; default a fresh in-memory one, so a test never meets the browser's. */
    readonly deviceStorage?: DeviceStorage;
    readonly frames?: ManualFrames | FrameSource;
    readonly renderer?: GameRenderer | RendererFactory;
    readonly fetch?: typeof fetch;
    /** The game's languages (a Paraglide `runtime.js`); absent, the content's source language alone. */
    readonly locale?: LocaleDef;
    /** The browser's languages, best first; default none. */
    readonly languages?: readonly string[];
    /** Builds the audio context on the first gesture; defaults to `fakeAudioContext()`. */
    readonly createAudioContext?: () => AudioContextLike;
    /** The clock the runtime's timers run on (the stall rule, fades, toasts, the exit cap); default the real one. */
    readonly clock?: Clock;
    /** The wall clock saves are stamped with; default `Date.now`. */
    readonly now?: () => number;
}
```

#### `RuntimeTestSession` (interface)

A booted runtime over the fake Ruken host: every service a screen reads, the host's handle and the page layers.

```ts
interface RuntimeTestSession {
    readonly services: RuntimeServices;
    readonly handle: FakeHostHandle;
    readonly layers: PageLayers;
    /** Closes everything the session opened, last opened first: the screen, the save, the renderer, then the host. */
    dispose(): Promise<void>;
}
```

#### `Settle` (type)

Lets the fake Ruken host answer over its in-memory ports (for example one macrotask).

```ts
type Settle = () => Promise<void>;
```

#### `settleLayout` (function)

Waits until a freshly mounted fixture has finished laying out: fonts loaded, then two frames, so
ResizeObserver callbacks (ActionBar's collapse, ScrollList's measure) and the re-layout they
cause have run. A semantic wait, not a sleep.

```ts
function settleLayout(): Promise<void>;
```

#### `Submission` (interface)

One leaderboard submission the host received.

```ts
interface Submission {
    readonly board: string;
    readonly score: number;
    readonly meta?: LeaderboardSubmitMeta | undefined;
}
```

#### `Targets` (interface)

The smallest a control may be drawn, in CSS px before the display's scale: `hit` for any control, `primary` for one marked `data-primary`.

```ts
interface Targets {
    readonly hit: number;
    readonly primary: number;
}
```

#### `textSnippet` (function)

A Svelte 5 snippet rendering `<tag>text</tag>`, so a test can pass `children`, `body` or an icon
to a component without writing a wrapper component (Ruken `packages/ui/src/test-snippets.ts`).
Text is escaped unless `trusted` is set, for fixture markup such as list rows.

```ts
function textSnippet(text: string, tag?: string, trusted?: boolean): Snippet;
```

#### `TIGHT_SIZES` (const)

Sideways phones shorter than 780x270, where an open keyboard leaves the least room (framework
audit of #7, 2026-10-11). Not resting viewports a screen is laid out for: the overlays that must
keep their actions above a keyboard (ErrorPanel, the boot failure) are checked here too.

```ts
const TIGHT_SIZES: readonly ReferenceSize[];
```

#### `TOUCH_TARGETS` (const)

The touch rule, every game screen's default: a control is at least 44 px, a primary 48. Only a screen held with a
mouse (an editor on a desktop) may pass smaller targets, and then it proves the touch rule again with touch.

```ts
const TOUCH_TARGETS: Targets;
```

#### `TrackedEvent` (interface)

One analytics event the host received.

```ts
interface TrackedEvent {
    readonly event: string;
    readonly props?: AnalyticsProps | undefined;
}
```

#### `Variant` (interface)

A condition layered over a reference size. Each field that is set applies; the caller turns them
into the geometry owner's inputs (a covered visual viewport, Ruken's display metrics).

```ts
interface Variant {
    readonly name: 'rest' | 'keyboard' | 'host-reserved-right' | 'host-reserved-left' | 'tv-scale';
    /** Px of the height the on-screen keyboard covers at this size. */
    readonly keyboard?: (size: ReferenceSize) => number;
    /** Ruken's reserved strip (its fixture is 48 px wide). */
    readonly hostReserved?: {
        readonly edge: 'left' | 'right';
        readonly width: number;
    };
    /** Ruken's TV-mode scale hint. */
    readonly scale?: 1 | 1.333;
}
```

#### `VARIANTS` (const)

The conditions each size is also checked under: at rest, with the on-screen keyboard open, with Ruken's
reserved strip on the right or the left, and at its TV scale.

```ts
const VARIANTS: readonly Variant[];
```

#### `visibleControls` (function)

Controls a player could see and reach: laid out, not hidden, not in an inert subtree.

```ts
function visibleControls(root: ParentNode): HTMLElement[];
```

#### `withRuntimeTest` (function)

Runs `program` on an open runtime and always closes it.

```ts
function withRuntimeTest<A>(program: (session: RuntimeTestSession) => Promise<A> | A, options?: RuntimeTestOptions): Promise<A>;
```

### `import { … } from '@automata/framework/tooling'`

#### `isDefinedGame` (function)

Whether `value` came from `defineGame`.

```ts
function isDefinedGame<S>(value: GameSpec<S> | DefinedGame<S>): value is DefinedGame<S>;
```

## `@automata/net`

### `import { … } from '@automata/net'`

#### `ClientMessage` (type)

Everything a client may send the room: a command, a clock probe, ready or not, add or remove a
bot, and leave.

```ts
type ClientMessage = {
  readonly t: "cmd";
  readonly seq: number;
  readonly tick: number;
  readonly type: string;
  readonly payload: unknown;
} | {
  readonly t: "ping";
  readonly id: number;
  readonly tick: number;
} | {
  readonly t: "ready";
  readonly ready: boolean;
  readonly req: string;
} | {
  readonly t: "bot.add" | "leave";
  readonly req: string;
} | {
  readonly t: "bot.remove";
  readonly req: string;
  readonly seat: number;
};
```

#### `clientMessageSchema` (const)

The Zod schema of a client message. The room checks every message against it before it acts.

```ts
const clientMessageSchema: z.ZodType<ClientMessage>;
```

#### `ClientNetworkPort` (interface)

The sim's link to the room on a client: it sends the player's commands and never hears remote
ones or publishes a snapshot, because the room is the authority.

```ts
interface ClientNetworkPort {
  /** A client hears no remote commands: the listener is never called. */
  onRemoteCommand(listener: (command: Command) => void): () => void;
  /** Sends one local command to the room; `source` is not sent (the room stamps the seat). */
  sendCommand(command: Command): void;
  /** A client publishes nothing: the authority is the room. */
  publishSnapshot(snapshot: {
    readonly tick: number;
    readonly bytes: Uint8Array;
    readonly hash: string;
  }): void;
  /** Each authoritative snapshot, in arrival order, with the per-seat acks. */
  onSnapshot(listener: (snapshot: NetSnapshot) => void): () => void;
  /** A clock probe for `tick` (-1 with no clock); its id, or undefined with no room. */
  ping(tick: number): number | undefined;
  onPong(listener: (pong: Pong) => void): () => void;
  /** The median of the last seven round trips, in milliseconds; undefined before the first. */
  roundTripMs(): number | undefined;
  /** Every byte the room sockets delivered, across reconnects. */
  bytesIn(): number;
  /** The finished game's packed replay. */
  onReplay(listener: (bytes: Uint8Array) => void): () => void;
}
```

#### `colyseusClient` (function)

The real SDK client for a server at `url` (net.toml's `url`).

```ts
function colyseusClient(url: string): NetSdkClient;
```

#### `COMMAND_TYPE_MAX_LENGTH` (const)

The longest sim command type a client may name.

```ts
const COMMAND_TYPE_MAX_LENGTH = 64;
```

#### `commandTypeSchema` (const)

A sim command id, in the sim's own id form (lower-case words separated by dots or dashes).

```ts
const commandTypeSchema: z.ZodType<string>;
```

#### `ConnectionState` (type)

Where the connection to the room is: offline, connecting, connected, reconnecting after a drop,
or degraded (up, but slow or silent).

```ts
type ConnectionState = "offline" | "connecting" | "connected" | "reconnecting" | "degraded";
```

#### `createNetRoom` (function)

Makes the player's side of a room. It reconnects after a drop for as long as the grace allows,
and keeps the seat so a reload can take it back.

```ts
function createNetRoom(options: NetRoomOptions): NetRoom;
```

#### `createNetSession` (function)

Joins a room's port to a client sim: it predicts the player's own commands, follows the room's
snapshots and measures the link. Close the handle when the game ends.

```ts
function createNetSession<T = RemoteView>(options: CreateNetSessionOptions<T>): NetSessionHandle<T>;
```

#### `CreateNetSessionOptions` (interface)

What `createNetSession` needs: the room, the client sim, the game's clock, the largest lead in
ticks and how to draw the other players.

```ts
interface CreateNetSessionOptions<T = RemoteView> {
  readonly room: Pick<NetRoom, "port" | "info" | "connection" | "markDegraded">;
  /** The client's sim: the game's plugins and content, as the room runs them. */
  readonly sim: Sim;
  /** Time for arrivals and probes: the game's clock, a fake one in tests. */
  readonly clock: Clock;
  /** net.toml's `maxLeadTicks` [60]. */
  readonly maxLeadTicks?: number | undefined;
  /** How the game draws the others from the authoritative states. */
  readonly remote?: RemoteSource<T> | undefined;
  /** net.toml's `snapshotEvery`, `interpolationTicks`, `degradedRoundTripMs` and `degradedGapMs`; their defaults when absent. */
  readonly config?: {
    readonly snapshotEvery?: number | undefined;
    readonly interpolationTicks?: number | undefined;
    readonly degradedRoundTripMs?: number | undefined;
    readonly degradedGapMs?: number | undefined;
  } | undefined;
}
```

#### `createRoomStore` (function)

Mirrors a room's info and connection. It starts with what the room shows now, so a store made in
the middle of a room shows it at once.

```ts
function createRoomStore(room: Pick<NetRoom, "info" | "connection">): RoomStore;
```

#### `createWatchable` (function)

Makes a value that tells its listeners when it changes. Keep the source to set it, and hand out
the read-only view.

```ts
function createWatchable<T>(initial: T): WatchableSource<T>;
```

#### `DEFAULT_DEGRADED` (const)

The usual thresholds: a second of round trip or a second of silence.

```ts
const DEFAULT_DEGRADED: DegradedThresholds;
```

#### `DegradedThresholds` (interface)

How slow or silent the link may be before it counts as degraded: the round trip and the gap
between snapshots, in milliseconds.

```ts
interface DegradedThresholds {
  readonly roundTripMs: number;
  readonly gapMs: number;
}
```

#### `DESYNC_WINDOW_MS` (const)

Two hash mismatches this close together end the session.

```ts
const DESYNC_WINDOW_MS = 1e4;
```

#### `Distribution` (class)

The last `capacity` values, summarised on demand.

```ts
class Distribution {
  private readonly capacity;
  private values;
  constructor(capacity?: number);
  add(value: number): void;
  summary(): DistributionSummary;
  /** The median of the last `n` values; undefined with fewer than `n`. */
  medianOfLast(n: number): number | undefined;
  clear(): void;
}
```

#### `DistributionSummary` (interface)

What this client's netcode is doing, measured.

The room is drawn from three moving parts that each fail quietly: a clock that tracks authority, a buffer that interpolates the
others, and a prediction that carries the local player ahead. When one is off the symptom is a feel ("floaty", "rubber-bandy")
and a feel cannot be bisected, so each part reports numbers. It observes and never steers: nothing in the session reads a value
back out of it except `degraded`, which only changes what the connection badge says. Anomalies go to a console sink only while
one is attached, each kind at most once a second.

`degraded` (new here): the round trip's median over the last five probes, or the silence since the last snapshot, past the
thresholds (1000 ms by default); it clears once both are under 80 % of them. Plain counters and a ring of recent values, no Effect
per frame (ADR 0003).

```ts
interface DistributionSummary {
  readonly count: number;
  readonly last: number;
  readonly min: number;
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
}
```

#### `hex16Schema` (const)

A sim hash on the wire: 16 lower-case hex characters, as `Sim.hash()` writes it.

```ts
const hex16Schema: z.ZodType<string>;
```

#### `INITIAL_LEAD_TICKS` (const)

A lead a typical home connection needs, until the first pong says otherwise.

```ts
const INITIAL_LEAD_TICKS = 4;
```

#### `InputLead` (class)

How many ticks ahead of the room the client stamps its commands, worked out from recent round
trips so a command arrives on time.

```ts
class InputLead {
  private current;
  private wanted;
  private heard;
  private readonly tickMs;
  private readonly maxTicks;
  /** The lead each recent probe would have needed to arrive exactly on time. */
  private readonly needed;
  constructor(initialTicks?: number, options?: InputLeadOptions);
  /** The lead to predict at, in ticks. */
  get ticks(): number;
  /** Where the lead is heading. */
  get target(): number;
  /**
   * One pong: the lead its ping was sent with, and how early it arrived. The first answer is adopted at once when it
   * asks for more lead (a game that starts short runs every early input late until the lead catches up); every later
   * change eases.
   */
  observe(leadAtSend: number, slackTicks: number): void;
  /** Moves the lead toward its target for one rendered frame, at the slew bound. */
  advance(deltaMs: number): void;
}
```

#### `InputLeadOptions` (interface)

The sim's tick rate and the largest lead, in ticks.

```ts
interface InputLeadOptions {
  /** The sim's tick rate. */
  readonly tickHz: number;
  /** The largest lead, in ticks. */
  readonly maxTicks: number;
}
```

#### `IntentOptions` (interface)

What an intent that opens a room takes besides the player's name.

```ts
interface IntentOptions {
  readonly name: string;
  /** Aborting it gives the call up: the room goes `offline` and the call rejects with the signal's reason. */
  readonly signal?: AbortSignal | undefined;
}
```

#### `JoinOptions` (interface)

What a client presents when it joins; `name` is trimmed by the schema.

```ts
interface JoinOptions {
  readonly protocol: number;
  readonly schemaHash: string;
  readonly contentHash: string;
  readonly name: string;
  readonly session?: string | undefined;
}
```

#### `joinOptionsSchema` (const)

The Zod schema of what a client sends to join: the protocol version, the two hashes, a name and
an optional session token.

```ts
const joinOptionsSchema: z.ZodType<JoinOptions>;
```

#### `leadForRoundTrip` (function)

The lead a known round trip needs, before any slack has been measured. The client's view of authority trails the
room by the downstream half of the trip and its commands take the upstream half to arrive, so the round trip in
ticks lands a command exactly on time; the margin is the floor a measured lead would add, and one more for jitter
nobody has measured yet.

```ts
function leadForRoundTrip(roundTripMs: number | undefined, options?: InputLeadOptions): number;
```

#### `LOBBY_PHASES` (const)

Where a room is: `RoomInfo.phase`.

```ts
const LOBBY_PHASES: readonly ["lobby", "countdown", "playing", "ended"];
```

#### `LobbyPhase` (type)

Where a room is: in the lobby, counting down, playing or ended.

```ts
type LobbyPhase = (typeof LOBBY_PHASES)[number];
```

#### `LocalCommand` (interface)

One command a game samples: a sim command without the header the session stamps.

```ts
interface LocalCommand {
  readonly type: string;
  readonly payload: unknown;
}
```

#### `MAX_CATCH_UP_TICKS` (const)

The most ticks one frame may sample. Twelve is a fifth of a second at 60 Hz, a hitch the loop can catch up on; past
it the gap is a hidden tab or a stalled device, and the loop re-seats at the present instead.

```ts
const MAX_CATCH_UP_TICKS = 12;
```

#### `MAX_LEAD_TICKS` (const)

The cap at net's default `maxLeadTicks` (60, one second at 60 Hz): half of it. The room refuses commands at its
bound; past half of that the link is not one a game can be played on as if local, and leading further only makes
every other player look more behind.

```ts
const MAX_LEAD_TICKS = 30;
```

#### `MAX_MESSAGE_BYTES` (const)

The size cap: a message past it is dropped before it is parsed.

```ts
const MAX_MESSAGE_BYTES = 16384;
```

#### `MAX_PENDING_COMMANDS` (const)

A backstop on unacked commands, past which a sample is dropped, neither applied nor sent. The real bound is the
expiry (a command unacked `maxLeadTicks` past its tick is given up). This is not the room's queue bound: the room's
32 (server `MAX_QUEUED_COMMANDS`) counts commands that have arrived and are not yet due, while this counts every
command not yet acked (in flight both ways, about the lead plus a snapshot interval of ticks). At the 30-tick lead
cap that is a few dozen commands at one or two a tick; 256 leaves room for a busy game and still bounds a broken one.

```ts
const MAX_PENDING_COMMANDS = 256;
```

#### `MAX_SEATS` (const)

Seats are 0 to MAX_SEATS - 1. Owned by the sim side, which the wire imports (the sim may not import the wire).

```ts
const MAX_SEATS = 16;
```

#### `nameSchema` (const)

The only player-authored string on the wire: letters, digits, spaces, hyphens
and underscores, so no later consumer (nameplate, roster, results row) needs an escaping rule of its own.

```ts
const nameSchema: z.ZodType<string>;
```

#### `NET_BYTES_CHANNEL` (const)

The channel the binary that follows a `snap` or `replay` header travels on: snapshot or packed replay bytes.

```ts
const NET_BYTES_CHANNEL = "net.bytes";
```

#### `NET_CHANNEL` (const)

The channel every wire message travels on as JSON text, both ways: a `ClientMessage` from a client and a
`ServerMessage` from the room. Text, so the room measures a message before it parses it.

```ts
const NET_CHANNEL = "net";
```

#### `NET_ERROR_CODES` (const)

The codes a room answers a refused request with.

```ts
const NET_ERROR_CODES: readonly ["REFUSED", "VERSION_MISMATCH", "ROOM_NOT_FOUND", "ROOM_FULL", "SERVER_BUSY", "SERVER_UPDATING", "RATE_LIMITED", "UNVERIFIED", "OFFLINE"];
```

#### `NetConfig` (interface)

`content/net.toml` after parsing: every field present.

```ts
interface NetConfig {
  readonly url: string;
  readonly snapshotEvery: number;
  readonly maxLeadTicks: number;
  readonly interpolationTicks: number;
  readonly reconnectGraceSeconds: number;
  readonly degradedRoundTripMs: number;
  readonly degradedGapMs: number;
}
```

#### `NetConfigInput` (interface)

`content/net.toml` as written: everything but `url` may be left to its default.

```ts
interface NetConfigInput {
  readonly url: string;
  readonly snapshotEvery?: number | undefined;
  readonly maxLeadTicks?: number | undefined;
  readonly interpolationTicks?: number | undefined;
  readonly reconnectGraceSeconds?: number | undefined;
  readonly degradedRoundTripMs?: number | undefined;
  readonly degradedGapMs?: number | undefined;
}
```

#### `netConfigSchema` (const)

`content/net.toml`. The url must also be one the game's target lets it connect to (each target has its own network
setting, and building for that target checks it).

```ts
const netConfigSchema: z.ZodType<NetConfig, NetConfigInput>;
```

#### `NetDiagnostics` (class)

Measures the link as it is used and says when it is degraded. It writes a console line for
anything strange, at most once in a while.

```ts
class NetDiagnostics {
  private readonly options;
  private readonly thresholds;
  private sink;
  private readonly lastLogged;
  private isDegraded;
  private snapshotCount;
  private duplicates;
  private reordered;
  private newestTick;
  private lastArrival;
  private readonly interval;
  private readonly tickStep;
  private readonly clockError;
  private snapCount;
  private delay;
  private readonly headroom;
  private underrunCount;
  private frameCount;
  private correctionCount;
  private adoptedCount;
  private readonly correctionSize;
  private late;
  private readonly rtt;
  private bytesIn;
  private firstBytes;
  constructor(options: NetDiagnosticsOptions);
  /** Attaches or detaches the console sink. Only anomalies are ever logged. */
  attach(sink: ((line: string) => void) | undefined): void;
  get degraded(): boolean;
  /** A snapshot arrived for `tick`. */
  snapshot(tick: number): void;
  /** The clock after a frame: how far it trails its anchor, how far back others are drawn, how many times it jumped. */
  clock(report: {
    error: number;
    delayTicks: number;
    snaps: number;
  }): void;
  /** How far the buffer reaches past the render moment; an underrun is none at all. */
  buffer(headroomTicks: number): void;
  /** A reconciliation moved the predicted state by `ticks` of error; `adopted` when it was taken outright rather than eased. */
  correction(ticks: number, adopted: boolean): void;
  /** A command was resent late. */
  lateCommand(): void;
  /** A pong measured a round trip. */
  roundTrip(ms: number): void;
  /** The socket's lifetime received byte count, as the transport reports it. */
  bytes(total: number): void;
  /** Re-reads the silence since the last snapshot; the session calls it each frame. */
  poll(): void;
  private evaluate;
  private anomaly;
  summary(): NetSummary;
  /** Forgets everything, as leaving a room does. */
  reset(): void;
}
```

#### `NetDiagnosticsOptions` (interface)

What the diagnostics need: a millisecond clock, optional thresholds and a function to call when
the link becomes degraded or recovers.

```ts
interface NetDiagnosticsOptions {
  /** Milliseconds (Effect's `Clock` in the session). */
  readonly now: () => number;
  readonly thresholds?: DegradedThresholds | undefined;
  /** Called when `degraded` changes. */
  readonly onDegraded?: ((degraded: boolean) => void) | undefined;
}
```

#### `NetError` (class)

A `NetRoom` call that failed: net's code, and which call it was (`create`, `join`, `setReady`, ...).

```ts
class NetError extends Error {
  override readonly name: "NetError";
  readonly code: NetErrorCode;
  readonly operation: string;
  constructor(fields: {
    readonly code: NetErrorCode;
    readonly operation: string;
  });
}
```

#### `NetErrorCode` (type)

Why a room refused a request: refused, the game versions differ, no such room, the room is full,
the server is busy or updating, too many requests, not verified, or offline.

```ts
type NetErrorCode = (typeof NET_ERROR_CODES)[number];
```

#### `NetFrame` (interface)

One frame's answer: where authority is and the tick the predicted sim has stepped.

```ts
interface NetFrame<T = RemoteView> {
  readonly authorityTick: number;
  readonly predictedTick: number;
  /** The moment the others are drawn at: authority less the interpolation delay. */
  readonly renderTick: number;
  /** The others at `renderTick`, blended from the authoritative states; undefined without a `remote` option or before one. */
  readonly remote: T | undefined;
}
```

#### `NetRoom` (interface)

The player's side of an online room. Create, join or quick-match, get ready, add or remove a
bot, leave, and watch the connection, the room and why it ended.

```ts
interface NetRoom {
  create(options: IntentOptions): Promise<void>;
  join(code: string, options: IntentOptions): Promise<void>;
  /** Seats you in an open room in its lobby, or opens one. */
  quickMatch(options: IntentOptions): Promise<void>;
  setReady(ready: boolean): Promise<void>;
  /** Host seat only; the server's `BotPolicy` drives the bot. */
  addBot(): Promise<void>;
  removeBot(seat: number): Promise<void>;
  /** Leaves and forgets the seat, so no later reconnect or reload reclaims it. */
  leave(): Promise<void>;
  /**
   * The session's diagnostics say the link is slow or silent: while the connection is up it reads `degraded` instead
   * of `connected`. A drop shows `reconnecting`, and going offline forgets the mark.
   */
  markDegraded(degraded: boolean): void;
  /** Reclaims the stored seat after a reload, once: `expired` forgets the token and is never retried. */
  resume(options?: {
    readonly signal?: AbortSignal | undefined;
  }): Promise<ResumeOutcome>;
  readonly info: Watchable<RoomInfo | undefined>;
  readonly connection: Watchable<ConnectionState>;
  /** Set when the room ended without a leave; cleared by the next intent. */
  readonly ended: Watchable<RoomEnd | undefined>;
  /** Core's `NetworkPort`, client end, for the session that predicts and reconciles. */
  readonly port: ClientNetworkPort;
  /**
   * Closes the socket, the probe and any reconnect in flight, without giving up the seat: the stored token stays for
   * the next page load's `resume`. Pending requests reject as `OFFLINE`.
   */
  close(): void;
}
```

#### `NetRoomOptions` (interface)

What `createNetRoom` needs: the server url, the client sim's hashes for the join check, the
reconnect grace, the game's clock and optionally the session token, the SDK client and where the
seat token is stored.

```ts
interface NetRoomOptions {
  /** The server: net.toml's `url`. */
  readonly url: string;
  /** The client sim's hashes: the join check. */
  readonly version: {
    readonly schemaHash: string;
    readonly contentHash: string;
  };
  readonly reconnectGraceSeconds: number;
  /** Time for the probe, the round trips and the reconnection's waits: the game's clock, a fake one in tests. */
  readonly clock: Clock;
  /** The host's session token, for the server's `SessionVerifier`; none for an anonymous server. */
  readonly session?: (() => string | undefined) | undefined;
  /** The SDK client for `url`; the real one by default. */
  readonly client?: ((url: string) => NetSdkClient) | undefined;
  /**
   * Where the reconnection token is written through to, for a reload's `resume`: this page's `sessionStorage` when
   * absent; `null` switches persistence off (the seat is still held in memory, so a drop reconnects).
   */
  readonly storage?: SeatStorage | null | undefined;
  /** The backoff's spread, in [0, 1]; `Math.random` by default. */
  readonly random?: (() => number) | undefined;
  /** The request ids' per-load prefix; drawn by default. */
  readonly loadToken?: string | undefined;
}
```

#### `NetSdkClient` (interface)

The part of the Colyseus SDK's client that `net` uses: create, join by code, join or create, and
reconnect with a token.

```ts
interface NetSdkClient {
  create(roomName: string, options: unknown): Promise<NetSdkRoom>;
  joinById(code: string, options: unknown): Promise<NetSdkRoom>;
  joinOrCreate(roomName: string, options: unknown): Promise<NetSdkRoom>;
  reconnect(token: string): Promise<NetSdkRoom>;
}
```

#### `NetSdkRoom` (interface)

The part of the Colyseus SDK's room that `net` uses. The real SDK room fits it, and so does the
fake in `@automata/net/testing`.

```ts
interface NetSdkRoom {
  /** The room code. */
  readonly roomId: string;
  /** Rotated by every reconnect handshake. */
  readonly reconnectionToken: string;
  /** The SDK's own reconnect loop: switched off, because ours survives a reload too. */
  readonly reconnection: {
    enabled: boolean;
  };
  /** The room-info schema, decoded by the SDK. */
  readonly state: unknown;
  readonly connection: {
    close(code?: number, reason?: string): void;
    readonly transport?: unknown;
  };
  onMessage(type: string, handler: (payload: unknown) => void): unknown;
  onStateChange(handler: (state: unknown) => void): unknown;
  onLeave(handler: (code: number) => void): unknown;
  send(type: string, payload: unknown): void;
  /** A consented leave frees the seat at once; the SDK resolves with the close code. */
  leave(consented?: boolean): Promise<number>;
  removeAllListeners(): void;
}
```

#### `NetSession` (class)

The client's game loop in an online room. It predicts the player's commands, takes the room's
snapshots and corrects when they differ, and tells a desync. Call `frame` once per rendered
frame.

```ts
class NetSession<T = RemoteView> {
  private readonly prediction;
  private readonly clock;
  private readonly buffer;
  private readonly diagnostics;
  private readonly lead;
  private readonly send;
  private readonly ping;
  private readonly now;
  private readonly onEnd;
  private seat;
  private accepting;
  /** The last tick input was sampled for: the tick the prediction stands at. */
  private inputTick;
  /**
   * The next command's seq. Numbering starts at 1: the room reads seq 0 from a seat that has
   * just returned as a reloaded client restarting its numbering, so a resent first command must never be 0.
   */
  private nextSeq;
  private sincePing;
  /** The lead each outstanding probe was sent with, and whether it can count, by id. */
  private readonly pings;
  /** Commands already sent a second time, by seq. */
  private readonly resent;
  private virtualTime;
  private lastMismatchAt;
  private mismatchCount;
  private end;
  /** One frame's answer, reused: `frame` allocates nothing (ADR 0003). */
  private readonly answer;
  constructor(options: NetSessionOptions<T>);
  /** The seat and whether the room takes input; until both say yes, sampled commands are dropped. */
  setRoomState(state: SessionRoomState): void;
  /**
   * One authoritative snapshot, timestamped with when it arrived. It reconciles the prediction and steers the clock;
   * then numbering goes on from the seat's ack (a reloaded page takes over a seat the room kept counting for), and a
   * command the room has stepped past without taking is sent once more.
   */
  observe(snapshot: NetSnapshot, receivedAt?: number): void;
  /**
   * Advances one rendered frame, sampling input for the latest tick it reaches. Undefined before the first snapshot
   * (there is no game to be at a moment of) and once the session has ended. The answer is one object, reused: read it
   * before the next frame.
   */
  frame(sample: Sampler, deltaMs: number): NetFrame<T> | undefined;
  /** The room answered a probe: a reliable one steers the lead. Another's probe (NetRoom's own) is ignored. */
  pong(pong: {
    readonly id: number;
    readonly slack: number;
  }): void;
  /**
   * The connection came back. Commands sent while it was down went nowhere, so every one the room has not acked is
   * sent again, with its own seq and tick: the room takes a late one on its next tick and refuses one it already has.
   */
  resync(): void;
  /**
   * Forgets the game, as leaving it does: its snapshots, commands, numbering and any desync. The next room numbers
   * from 1, or from its own ack when this player is taking over a seat it kept counting for (`observe`).
   */
  clear(): void;
  /** The tick input was last sampled for, or undefined before the first frame. */
  get sampledTick(): number | undefined;
  /** The lead in ticks. */
  get leadTicks(): number;
  /** Where authority is now, on the one clock. */
  authorityTick(): number | undefined;
  /** Why the session ended; undefined while it runs. */
  get ended(): SessionEnd | undefined;
  /** Snapshot frames that failed their hash, in all. */
  get mismatches(): number;
  /** The last snapshot restored, by tick and hash. */
  get authoritative(): {
    readonly tick: number;
    readonly hash: string;
  } | undefined;
  /** The local commands the room has not acked yet. */
  get pendingCommands(): readonly Command[];
  private time;
  private mismatch;
  /**
   * A command whose tick is before the snapshot's, and not acked, was lost or is late. Sending it once more costs a
   * refusal at worst (the room refuses a seq it has had) and saves a command lost for good. Once, so a slow link does
   * not resend every command on every snapshot.
   */
  private resendOverdue;
  /**
   * Brings input and the prediction up to `target`: sample once, stamp, step. A frame that covers several ticks could
   * only notice a key now, so its commands are stamped with the latest tick it reaches; the ticks before are stepped
   * with what is already pending. Re-seated rather than caught up after a long gap either way: forward, so a hidden
   * tab does not sample hundreds of ticks; backward, so a clock that lands far behind never leaves input dead.
   */
  private sampleUpTo;
}
```

#### `NetSessionHandle` (interface)

A running session: the session to call once per frame, its measured diagnostics, why it ended
and a way to close it.

```ts
interface NetSessionHandle<T = RemoteView> {
  /** The game's loop calls `session.frame` once per rendered frame. */
  readonly session: NetSession<T>;
  /** What the netcode is doing, measured; the connection reads `degraded` from it. */
  readonly diagnostics: NetDiagnostics;
  /** Why the session ended (a desync), once it has. */
  readonly ended: Watchable<SessionEnd | undefined>;
  /** Stops listening to the room and the port: no command and no probe goes out after it. */
  close(): void;
}
```

#### `NetSessionOptions` (interface)

What a session needs: the client sim it steps and restores, how to send a command and a probe,
the first round trip, the largest lead, how to draw the others and the diagnostics.

```ts
interface NetSessionOptions<T = RemoteView> {
  /** The client's sim: the game's plugins and content, as the room runs them. The session steps and restores it. */
  readonly sim: Sim;
  /** Sends one stamped command (`ClientNetworkPort.sendCommand`). */
  readonly send?: ((command: Command) => void) | undefined;
  /** Sends a clock probe for `tick`; its id, or undefined with no room (`ClientNetworkPort.ping`). */
  readonly ping?: ((tick: number) => number | undefined) | undefined;
  /** The round trip measured before play, which seeds the lead. */
  readonly roundTripMs?: number | undefined;
  /** net.toml's `maxLeadTicks`, past which the room refuses a command; the lead stays under half of it [60]. */
  readonly maxLeadTicks?: number | undefined;
  /** Milliseconds (Effect's `Clock`). Without one, time is the sum of frame deltas. */
  readonly now?: (() => number) | undefined;
  /** Called once, when the session ends. */
  readonly onEnd?: ((end: SessionEnd) => void) | undefined;
  /** The others, drawn from the authoritative states. */
  readonly remote?: RemoteSource<T> | undefined;
  /** net.toml's `snapshotEvery` [3]: the interpolation delay is never less than a snapshot's span. */
  readonly snapshotTicks?: number | undefined;
  /** net.toml's `interpolationTicks` [6]: the delay a perfect link needs. */
  readonly interpolationTicks?: number | undefined;
  /** Measures the link (round trips, snapshot gaps, the buffer); the session only feeds it. */
  readonly diagnostics?: NetDiagnostics | undefined;
}
```

#### `NetSnapshot` (interface)

One authoritative snapshot as it arrived: core's `AuthoritativeSnapshot` (`tick`, `bytes`, `hash`), plus the
per-seat acks that ride beside it on net's wire (the last `seq` the room applied for each seat).

```ts
interface NetSnapshot {
  readonly tick: number;
  readonly bytes: Uint8Array;
  readonly hash: string;
  readonly acks: Readonly<Record<string, number>>;
}
```

#### `NetSummary` (interface)

What the diagnostics measured: snapshots, their spacing and reordering, round trips, corrections
and whether the link is degraded.

```ts
interface NetSummary {
  readonly snapshots: {
    readonly count: number;
    /** Same tick as the newest already seen: a republish, harmless. */
    readonly duplicates: number;
    /** Older than the newest already seen: the transport reordered. */
    readonly reordered: number;
    readonly intervalMs: DistributionSummary;
    readonly tickStep: DistributionSummary;
  };
  readonly clock: {
    readonly errorTicks: DistributionSummary;
    readonly snaps: number;
    /** How far behind authority everyone else is drawn, now. */
    readonly delayTicks: number;
  };
  readonly buffer: {
    readonly headroomTicks: DistributionSummary;
    readonly underruns: number;
    readonly frames: number;
  };
  readonly corrections: {
    readonly count: number;
    readonly adopted: number;
    readonly size: DistributionSummary;
  };
  readonly input: {
    readonly lateCommands: number;
    readonly rttMs: DistributionSummary;
  };
  readonly wire: {
    readonly bytesIn: number;
    readonly bytesPerSecond: number;
  };
  readonly degraded: boolean;
}
```

#### `parseClientMessage` (const)

Reads a raw message from a client. It measures it first, so a message that is too large is
refused before it is parsed.

```ts
const parseClientMessage: (raw: string | Uint8Array) => ParseResult<ClientMessage>;
```

#### `ParseResult` (type)

The result of reading a raw message: the message, or why it was refused (too large, not JSON, or
not a valid message).

```ts
type ParseResult<M> = {
  readonly ok: true;
  readonly message: M;
} | {
  readonly ok: false;
  readonly reason: "too-large" | "not-json" | "invalid";
  readonly detail: string;
};
```

#### `parseServerMessage` (const)

Reads a raw message from the room, the same way.

```ts
const parseServerMessage: (raw: string | Uint8Array) => ParseResult<ServerMessage>;
```

#### `PING_EVERY_MS` (const)

How often the clock is probed. Four a second is five seconds per lead window.

```ts
const PING_EVERY_MS = 250;
```

#### `PLAYER_NAME_MAX_LENGTH` (const)

The longest a player's name may be.

```ts
const PLAYER_NAME_MAX_LENGTH = 16;
```

#### `Pong` (interface)

The answer to a clock probe: its id, how many ticks early (positive) or late (negative) the
probe arrived, and the round trip in milliseconds.

```ts
interface Pong {
  readonly id: number;
  /** Ticks early (positive) or late (negative) the probe's tick arrived. */
  readonly slack: number;
  readonly rttMs: number;
}
```

#### `PROTOCOL_VERSION` (const)

Bumped when a message shape changes; a room refuses a join on another version.

```ts
const PROTOCOL_VERSION = 1;
```

#### `RECONNECT_BASE_MS` (const)

The first wait after a drop.

```ts
const RECONNECT_BASE_MS = 250;
```

#### `RECONNECT_CEILING_MS` (const)

The longest wait between two attempts.

```ts
const RECONNECT_CEILING_MS = 2e3;
```

#### `reconnectDelay` (function)

The wait before reconnect attempt `attempt` (from 0): 250 ms doubling to a 2 s ceiling. The climbing steps are spread by ±25%, so a server restart does not bring every client back on
the same beat; the ceiling is not spread, so the attempts keep their pace through a long outage. `random` is in
[0, 1]: injected, so a test chooses the spread.

```ts
function reconnectDelay(attempt: number, random: () => number): number;
```

#### `refusalCode` (function)

Turns whatever a failed join or create threw into one of the error codes, so a screen can say
what went wrong.

```ts
function refusalCode(error: unknown): NetErrorCode;
```

#### `RemoteSource` (interface)

How the game draws the others: which entities are remote, read from each authoritative state, and how to blend.

```ts
interface RemoteSource<T = RemoteView> {
  /** The view of the remote entities in `sim`, right after a snapshot was restored (before the prediction steps on). */
  read(sim: Sim): T;
  blend(from: T, to: T, t: number): T;
}
```

#### `reqIdSchema` (const)

A client-chosen correlation id: printable ASCII, bounded. It addresses an
answer and grants no authority; nothing branches on its value.

```ts
const reqIdSchema: z.ZodType<string>;
```

#### `REQUEST_ID_MAX_LENGTH` (const)

The longest a request id may be.

```ts
const REQUEST_ID_MAX_LENGTH = 64;
```

#### `ResumeOutcome` (type)

What happened when a page tried to take its old seat back after a reload: it resumed, there was
nothing to resume, or the seat had expired.

```ts
type ResumeOutcome = "resumed" | "none" | "expired";
```

#### `ROOM_CODE_ALPHABET` (const)

Characters a player can read off a screen and type without ambiguity: `I`, `O`, `0` and `1` are omitted.

```ts
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
```

#### `ROOM_CODE_LENGTH` (const)

Six characters.

```ts
const ROOM_CODE_LENGTH = 6;
```

#### `ROOM_NAME` (const)

The Colyseus room type a client creates, joins and finds (`create`, `joinById`, `joinOrCreate`).

```ts
const ROOM_NAME = "automata";
```

#### `RoomEnd` (interface)

Why the room went without the player choosing to leave.

```ts
interface RoomEnd {
  readonly reason: "seat-lost" | "closed" | "server-updating" | "failed";
}
```

#### `RoomInfo` (interface)

A room as a screen shows it: the six-character code, the phase, the seats, your own seat and the
host's seat.

```ts
interface RoomInfo {
  /** Six characters: the Colyseus room id. */
  readonly code: string;
  readonly phase: LobbyPhase;
  readonly seats: readonly SeatInfo[];
  /** Your seat, from the room's `seated` message only. */
  readonly you: number | undefined;
  readonly hostSeat: number | undefined;
}
```

#### `RoomStore` (interface)

The room and the connection as plain values with one subscription, for a screen to read.

```ts
interface RoomStore {
  readonly info: RoomInfo | undefined;
  readonly connection: ConnectionState;
  /** Called after each change; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Stops mirroring and drops every subscriber; the store keeps what it last showed. */
  close(): void;
}
```

#### `Sampler` (type)

The game's input for one predicted tick: the commands to apply and send on it, often none.

```ts
type Sampler = (tick: number) => readonly LocalCommand[];
```

#### `SEAT_TOKEN_KEY` (const)

The `sessionStorage` key's prefix; the server's url follows it (`seatTokenKey`).

```ts
const SEAT_TOKEN_KEY = "automata-net.seat";
```

#### `SeatInfo` (interface)

One seat in a room: its number, the name, whether the player is ready and connected, and whether
it is a bot.

```ts
interface SeatInfo {
  readonly seat: number;
  readonly name: string;
  readonly ready: boolean;
  readonly connected: boolean;
  readonly bot: boolean;
}
```

#### `seatSchema` (const)

A seat index, 0 to MAX_SEATS - 1.

```ts
const seatSchema: z.ZodType<number>;
```

#### `SeatStorage` (interface)

The slice of the Web Storage API the store uses.

```ts
interface SeatStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

#### `seatTokenKey` (const)

The key a server's seat is stored under.

```ts
const seatTokenKey: (url: string) => string;
```

#### `ServerMessage` (type)

Everything the room may send a client: a snapshot header, the seat you were given, a probe's
answer, the answer to a request (with an error code if it was refused) and a replay header.

```ts
type ServerMessage = {
  readonly t: "snap";
  readonly tick: number;
  readonly hash: string;
  readonly acks: Record<string, number>;
} | {
  readonly t: "seated";
  readonly seat: number;
} | {
  readonly t: "pong";
  readonly id: number;
  readonly slack: number;
} | {
  readonly t: "answer";
  readonly req: string;
  readonly error?: NetErrorCode | undefined;
} | {
  readonly t: "replay";
};
```

#### `serverMessageSchema` (const)

The Zod schema of a server message.

```ts
const serverMessageSchema: z.ZodType<ServerMessage>;
```

#### `SESSION_MAX_LENGTH` (const)

A reconnection session token, opaque to the client.

```ts
const SESSION_MAX_LENGTH = 128;
```

#### `SessionEnd` (interface)

Why the session stopped: a second snapshot hash mismatch within `DESYNC_WINDOW_MS`, at this snapshot tick.

```ts
interface SessionEnd {
  readonly reason: "desync";
  readonly tick: number;
}
```

#### `SessionRoomState` (interface)

What the room says about this player: their seat, and whether it takes input now.

```ts
interface SessionRoomState {
  readonly seat: number | undefined;
  readonly accepting: boolean;
}
```

#### `uintSchema` (const)

A whole number from 0.

```ts
const uintSchema: z.ZodType<number>;
```

#### `Watchable` (interface)

What a reader gets: the value now, and a way to hear it change.

```ts
interface Watchable<T> {
  get(): T;
  /** Calls `listener` with the value after each change (not with the current one); returns the unsubscribe. */
  subscribe(listener: (value: T) => void): () => void;
}
```

#### `WatchableSource` (interface)

The owner's end of a `Watchable`: it can also set the value.

```ts
interface WatchableSource<T> extends Watchable<T> {
  /** Sets the value; a value equal to the current one (`Object.is`) is not announced. */
  set(value: T): void;
  /** The read-only end, safe to hand out. */
  readonly view: Watchable<T>;
}
```

### `import { … } from '@automata/net/sim'`

#### `NetOwner` (const)

The seat an entity belongs to. `netPlugin` gives each joined seat one entity with it; a game tags
its own entities (a player's character) with the same seat, and `seat.leave` despawns them together.

```ts
const NetOwner: ComponentDef<{
  seat: "u32";
}>;
```

#### `netPlugin` (const)

`net`'s sim side: the same plugin runs in the room and in every client.

```ts
const netPlugin: PluginDef;
```

#### `ROOM_SOURCE` (const)

The sim `source` of the room's own commands (seat.join, seat.leave and a game's room commands): the highest source
the sim accepts, never a seat. On the sim side so a game's sim can tell the room's commands from a seat's without
importing the server; the server stamps its commands with this constant.

```ts
const ROOM_SOURCE = 255;
```

#### `SeatEntity` (interface)

The seat and the id of its seat entity.

```ts
interface SeatEntity {
  readonly seat: number;
  readonly sid: number;
}
```

#### `SeatJoin` (const)

Sent by the room when a seat is taken (a player or a bot). Commands are `seat.join`; the events say `joined`.

```ts
const SeatJoin: CommandDef<z.ZodType<SeatPayload>>;
```

#### `SeatJoined` (const)

A player took a seat: its number and the id of the sim entity it owns.

```ts
const SeatJoined: EventDef<z.ZodType<SeatEntity>>;
```

#### `SeatLeave` (const)

Sent by the room when a seat is given up (a leave, or a drop past the reconnect grace).

```ts
const SeatLeave: CommandDef<z.ZodType<SeatPayload>>;
```

#### `SeatLeft` (const)

A player left a seat: its number and the id of the sim entity it owned.

```ts
const SeatLeft: EventDef<z.ZodType<SeatEntity>>;
```

#### `SeatPayload` (interface)

Which seat.

```ts
interface SeatPayload {
  readonly seat: number;
}
```

### `import { … } from '@automata/net/testing'`

#### `createLink` (function)

A deterministic in-memory link: every delay, loss, duplicate and reorder is drawn from `seed`, one stream per
direction, and delivery waits on `clock`, so under a fake clock a failure replays exactly.

```ts
function createLink(options: LinkOptions, clock: Clock): {
  client: Transport;
  server: Transport;
};
```

#### `fakeColyseus` (function)

Makes a fake SDK client for tests, so `createNetRoom` runs without a network.

```ts
function fakeColyseus(): FakeColyseus;
```

#### `FakeColyseus` (interface)

A stand-in for the SDK client. It records every matchmaking call, hands out fake rooms, and lets
a test choose the next answer.

```ts
interface FakeColyseus {
  readonly client: NetSdkClient;
  /** Every matchmaking call: the method and its arguments. */
  readonly calls: {
    readonly method: Method;
    readonly args: readonly unknown[];
  }[];
  /** Every room the fake client handed out, in order. */
  readonly rooms: FakeRoom[];
  /** A room the test may hand out itself. */
  room(code?: string): FakeRoom;
  /** The next `method` call answers with `outcome`; queued in order. */
  respond(method: Method, outcome: FakeOutcome): void;
  /** Every `method` call with nothing queued answers with `outcome`. */
  respondAlways(method: Method, outcome: FakeOutcome | undefined): void;
  /** The room-info state a fresh room starts with. */
  state(code: string, extra?: Record<string, unknown>): Record<string, unknown>;
}
```

#### `FakeOutcome` (type)

What a fake matchmaking call answers: a room, an error, or a promise of a room.

```ts
type FakeOutcome = FakeRoom | Error | Promise<FakeRoom>;
```

#### `FakeRoom` (interface)

A stand-in for the SDK's room. It records every send, leave and close, and lets a test push
messages and state to the client.

```ts
interface FakeRoom extends NetSdkRoom {
  roomId: string;
  reconnectionToken: string;
  /** Every `send`, in order: the type and the payload as sent. */
  readonly sent: {
    readonly type: string;
    readonly payload: unknown;
  }[];
  /** Every `leave` call's `consented`. */
  readonly leaves: boolean[];
  /** Every `connection.close` call. */
  readonly closes: number;
  readonly socket: FakeSocket;
  /** Whether any handler is still attached. */
  readonly listening: boolean;
  /** A wire message on net's channel, as the room sends it (JSON text), or raw text. */
  message(message: ServerMessage | string): void;
  /** Binary on net's bytes channel. */
  bytes(bytes: Uint8Array): void;
  /** Replaces the room-info state and announces the change. */
  patch(state: unknown): void;
  /** The socket closes with `code`, as the SDK reports it to `onLeave`. */
  close(code: number): void;
  /** Raw data on the socket, for the byte count. */
  socketData(data: unknown): void;
  /**
   * A callback the SDK had already queued: runs the last handler registered for `channel` (`'leave'` for the close
   * handler) even if the client has since removed it.
   */
  queued(channel: string, payload: unknown): void;
}
```

#### `FakeSocket` (interface)

A socket stand-in the client may count bytes from, as it does the SDK's WebSocket.

```ts
interface FakeSocket {
  addEventListener(type: "message", listener: Listener): void;
  removeEventListener(type: "message", listener: Listener): void;
  readonly listeners: number;
}
```

#### `linkClient` (function)

Makes the client's end of a test link over a transport.

```ts
function linkClient(transport: Transport, options: {
  readonly now: () => number;
}): LinkClient;
```

#### `LinkClient` (interface)

The client's end of a test link: its port, its seat, and ways to attach to another link (a
reconnect) or drop the link.

```ts
interface LinkClient {
  /** The client port, kept across `attach`, as `NetRoom`'s is across a reconnect. */
  readonly port: ClientNetworkPort;
  /** The seat the room's last `seated` said. */
  seat(): number | undefined;
  /** Talks over another link from now on (a reconnect), keeping every listener. */
  attach(transport: Transport): void;
  /** Talks over no link: commands are dropped and nothing arrives (a drop). */
  detach(): void;
}
```

#### `LinkOptions` (interface)

How bad a test link is: a seed, the base delay, the jitter, and the chances a message is lost,
arrives twice or is held back so later ones overtake it.

```ts
interface LinkOptions {
  readonly seed: number;
  /** Every message's base delay. */
  readonly latencyMs: number;
  /** Up to this much more, drawn uniformly per message. */
  readonly jitterMs: number;
  /** The chance a message is lost, 0 to 1. */
  readonly loss: number;
  /** The chance a message also arrives a second time, with its own delay. */
  readonly duplicate: number;
  /** The chance a message is held back by one more `latencyMs`, so later ones overtake it. */
  readonly reorder: number;
}
```

#### `linkRoomClient` (function)

The room's end of a link, in the shape of `server`'s `RoomClient`.

```ts
function linkRoomClient(transport: Transport): LinkRoomClient;
```

#### `LinkRoomClient` (interface)

The room's end of a test link, shaped like the server's room client: send a message or bytes,
close, and whether it is closed.

```ts
interface LinkRoomClient {
  send(message: ServerMessage): void;
  sendBytes(bytes: Uint8Array): void;
  /** Ends the connection: nothing more is sent. */
  close(): void;
  readonly closed: boolean;
}
```

#### `Transport` (interface)

One end of a link: what `net`'s transport and the test server talk through.

```ts
interface Transport {
  /** Sends one message to the other end; it arrives after the link's delay, on the link's clock. */
  send(data: WireData): void;
  /** Calls `listener` for each message that arrives here, in arrival order; returns the unsubscribe. */
  onMessage(listener: (data: WireData) => void): () => void;
}
```

#### `WireData` (type)

One message as it travels: text (JSON) or binary (a snapshot, a packed replay).

```ts
type WireData = string | Uint8Array;
```

## `@automata/net-server`

### `import { … } from '@automata/net-server'`

#### `acceptsInput` (function)

Whether the room takes commands for the sim: from the countdown on, so a player holding a direction through GO
moves on the first tick of play exactly as they would locally; never in the lobby, and never once the game ended.

```ts
function acceptsInput(lobby: Pick<LobbyState, "phase">): boolean;
```

#### `addBot` (function)

The host's tap on an open seat, in the lobby only. `botsAllowed` is whether the game configured a `BotPolicy`.
Returns the bot's seat.

```ts
function addBot(lobby: LobbyState, by: number, rules: LobbyRules, botsAllowed: boolean): number;
```

#### `ANOMALY_COOLDOWN_MS` (const)

One line per anomaly kind per room (and per seat for late inputs), at most this often.

```ts
const ANOMALY_COOLDOWN_MS: number;
```

#### `anonymousVerifier` (const)

Accepts every join and names nobody: the only verifier production has until a host gives its own.

```ts
const anonymousVerifier: SessionVerifier;
```

#### `answerProbe` (function)

Answers one of the server's own routes and returns true, or returns false for every other path.

```ts
function answerProbe(request: IncomingMessage, response: ServerResponse, state: ProbeState): boolean;
```

#### `AutomataRoom` (class)

The Colyseus room behind every game. It seats players and bots, steps the sim on its own clock,
sends snapshots and answers each request once. A game never builds it directly; the server makes
its subclass.

```ts
class AutomataRoom extends Room<{
  state: RoomInfoState;
}> {
  /** Set by `roomClassFor`'s subclass before Colyseus calls `onCreate`. */
  protected context: RoomContext | undefined;
  private roomEngine;
  private scheduler;
  private codeClaimed;
  /** Whether the matchmaker offers this room to Quick match; undefined until the first `project`. */
  private listed;
  private closing;
  private readonly serial;
  /** Sessions whose connection dropped and has not come back: their leave is the grace running out. */
  private readonly dropped;
  /** Room telemetry's cooldown (`room-telemetry.ts`), on the room's clock. */
  private anomalies;
  /** A step longer than this is logged `step.slow`: half a tick. */
  private slowStepAfterMs;
  /** The room's engine, for the test driver (`server/testing`); not room API. */
  get engine(): RoomEngine;
  private get ctx();
  override onCreate(): Promise<void>;
  /** Validated before a seat exists: a bad join is refused, not seated and then removed. Reconnects skip this. */
  override onAuth(_client: Client, options: unknown): true;
  override onJoin(client: Client, options: unknown): void;
  /**
   * A connection lost rather than given up: the seat is held for the grace, on room ticks in the engine and in wall
   * seconds by Colyseus, whose reconnection token is cancelled when the engine gives the seat up first.
   */
  override onDrop(client: Client): void;
  override onReconnect(client: Client): void;
  /** A consented leave, or a drop the grace ran out on: the seat is freed for good. Idempotent. */
  override onLeave(client: Client): void;
  override onDispose(): void;
  /** One tick: the engine's, then the info state; a patch goes with each snapshot. */
  tick(): void;
  /**
   * Something on the tick threw outside the engine's own boundary (which halts the room for the game's code). The
   * room halts the same way: logged by the error's class, closed with an error, and the process carries on.
   */
  private fail;
  /** A slow tick or step: written with the room's serial unless one of its kind went out in the last ten seconds. */
  private anomaly;
  /** Stops the room's own clock for good: a test that steps the room by hand calls this first. */
  stopClock(): void;
  /** The server is draining (`LiveRooms`): the engine decides what that means for this room. */
  beginDrain(): void;
  /**
   * Every client message, inside an error boundary: Colyseus calls a handler outside any
   * try/catch of its own, so an error a handler let escape would reach the process and end every game on it.
   */
  private receive;
  private project;
  /**
   * The room is offered to Quick match (`joinOrCreate`) exactly while it is in its lobby and not draining
   *. Colyseus's `private` means "not offered"; its lock keeps meaning "full", and a friend
   * with the code (`joinById`) is told the real reason by `onAuth`. A no-op while the answer has not changed.
   */
  private syncListing;
  /**
   * The engine has nothing left to do. A drained room closes with Colyseus's server-shutdown code, which a client
   * reads as `SERVER_UPDATING`; an abandoned one simply goes.
   */
  private close;
}
```

#### `botCount` (const)

How many of the lobby's seats are bots.

```ts
const botCount: (lobby: LobbyState) => number;
```

#### `BotPolicy` (interface)

The bot-seat hook (PD-5): no AI ships.

```ts
interface BotPolicy {
  readonly name: string;
  /**
   * Called once per tick for each bot seat, while the room takes commands (the countdown and play). Reads the sim;
   * never writes it. Its commands enter the same input queue with the bot's seat as `source`, so they are in the
   * replay and clients see bots only through snapshots.
   */
  commands(view: SimView, seat: number, rng: Rng): readonly CommandIntent[];
}
```

#### `botSeed` (const)

The seed of a bot seat's RNG (`deriveSeed(roomSeed, seat)`; the sim's `deriveSeed` names its stream
with a string). The same room and seat draw the same stream, so a room's story repeats from its replay.

```ts
const botSeed: (roomSeed: number, seat: number) => number;
```

#### `Bucket` (interface)

A token bucket: up to `burst` at once, refilled at `perSecond`.

```ts
interface Bucket {
  readonly burst: number;
  readonly perSecond: number;
}
```

#### `bucketOptions` (function)

A config bucket as `TokenBuckets` reads it. `perSecond` 0 never refills.

```ts
function bucketOptions(bucket: Bucket): {
  burst: number;
  refillMs: number;
};
```

#### `claimRoomCode` (function)

Claims a free code. The shared set's add is the claim: two processes can generate the same code in the same
instant, and only the one whose add reports 1 holds it (a check followed by an add would let both take it).

```ts
function claimRoomCode(store: RoomCodeStore, randomInt: RandomInt): Promise<string>;
```

#### `clientIp` (function)

The address a request's limits are counted against. It is the connection's peer, or the proxy's
last hop when the peer is the proxy on loopback; a header from anyone else is ignored.

```ts
function clientIp(request: IncomingMessage): string;
```

#### `CODE_ATTEMPTS` (const)

Bounded so a failing random source cannot spin forever.

```ts
const CODE_ATTEMPTS = 8;
```

#### `colyseusLogger` (function)

Colyseus logs to the console by default, and its text can hold a room id (the room code) or what a client sent.
Its errors and warnings become text-free lines, so the operator still hears of them; the rest is dropped.

```ts
function colyseusLogger(log: (event: RoomLogEvent) => void): ColyseusLogger;
```

#### `ColyseusLogger` (interface)

The logger Colyseus is given (`new Server({ logger })`).

```ts
interface ColyseusLogger {
  debug(...args: unknown[]): void;
  error(...args: unknown[]): void;
  info(...args: unknown[]): void;
  trace(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}
```

#### `COMMAND_HISTORY` (const)

Answers remembered per session.

```ts
const COMMAND_HISTORY = 64;
```

#### `CommandIntent` (interface)

A command without its header: the room stamps `tick`, `source` and `seq`.

```ts
interface CommandIntent {
  readonly type: string;
  readonly payload: unknown;
}
```

#### `CommandLedger` (class)

Remembers the answer given to each request, per session, so a resent request gets the same
answer and never acts twice. Bounded, oldest answers dropped first.

```ts
class CommandLedger {
  /** Answers per session, oldest first: a `Map` iterates in insertion order. */
  private readonly answers;
  private readonly capacity;
  constructor(capacity?: number);
  /**
   * Runs `run` for a request id this session has not sent before, or replays the stored answer for one it has.
   * `run` refuses by throwing; the throw becomes an `ok: false` answer and is remembered like any other, so a resent
   * refusal is refused again without running a second time.
   */
  answer(session: string, req: string, run: () => void): LedgerAnswer;
  /** Drops a session's history, for a seat that has left for good. */
  forget(session: string): void;
  private historyOf;
  /** Evicts the oldest answers until the history fits its capacity. */
  private trim;
}
```

#### `CommandResult` (type)

The answer to one request.

```ts
type CommandResult = {
  readonly req: string;
  readonly ok: true;
} | {
  readonly req: string;
  readonly ok: false;
  readonly error: ServerError;
};
```

#### `countdownElapsed` (function)

Whether a running countdown has reached zero on this tick.

```ts
function countdownElapsed(lobby: LobbyState): boolean;
```

#### `CrashTarget` (interface)

Where crashes are heard: `process` in production, an emitter in a test.

```ts
interface CrashTarget {
  on(event: "unhandledRejection" | "uncaughtException", handler: (error: unknown) => void): unknown;
}
```

#### `createAnomalyLimiter` (function)

Whether an event may be written now. Anomalies are limited on `now` (the room's clock, in milliseconds); every
other event passes.

```ts
function createAnomalyLimiter(now: () => number, cooldownMs?: number): (event: RoomLogEvent) => boolean;
```

#### `createLobby` (function)

A new, empty lobby, before anyone has sat down.

```ts
function createLobby(): LobbyState;
```

#### `createLogWriter` (function)

The server's `log`: each event becomes one validated JSON line.

```ts
function createLogWriter(options: LogWriterOptions): (event: RoomLogEvent) => void;
```

#### `createMatchmakeGate` (function)

Builds the gate every matchmaking request passes before Colyseus sees it: origin, draining,
per-address limits, body size and game version. It answers a refused request itself.

```ts
function createMatchmakeGate(options: MatchmakeGateOptions): MatchmakeGate;
```

#### `createServerRuntime` (function)

Builds a server inside the caller's scope: checks the config, binds the listener, installs the
gates and probes, and defines the room. It stops with the scope.

```ts
function createServerRuntime(def: ServerDef, config: ServerConfig): Effect.Effect<ServerRuntime, ServerStartError, Scope.Scope>;
```

#### `createSocketGate` (function)

Builds the count of open sockets, per address and in all. It admits a socket while both counts
have room and forgets an address with none open.

```ts
function createSocketGate(limits: {
  readonly maxPerIp: number;
  readonly maxTotal: number;
}): SocketGate;
```

#### `createUpgradeGate` (function)

Builds the gate every WebSocket upgrade passes: the origin must be listed and the address must
have a socket to spare. A refusal is a bare HTTP status on the socket.

```ts
function createUpgradeGate(options: UpgradeGateOptions): UpgradeGate;
```

#### `defineServer` (function)

Checks a game's server once, so a room never meets a bad one. Throws for a definition no room can run.

```ts
function defineServer(def: ServerGameDef): ServerDef;
```

#### `DRAIN_MAX_MS` (const)

The longest a drain waits for rooms to close: five minutes.

```ts
const DRAIN_MAX_MS: number;
```

#### `DrainableRoom` (interface)

The slice of a room the drain needs; kept narrow so this file imports no room.

```ts
interface DrainableRoom {
  beginDrain(): void;
}
```

#### `DrainResult` (type)

`empty` when the last room closed; `cap` when the wait ran out first.

```ts
type DrainResult = "empty" | "cap";
```

#### `endGame` (function)

The game says it is over. Only from play.

```ts
function endGame(lobby: LobbyState): void;
```

#### `EnvConfigResult` (type)

The server's config read from its environment, or the name of every variable that was missing or
not valid.

```ts
type EnvConfigResult = {
  readonly ok: true;
  readonly config: ServerConfig;
} | {
  readonly ok: false;
  readonly problems: string[];
};
```

#### `EnvServerBase` (interface)

What a game gives its server beside the environment's limits.

```ts
interface EnvServerBase {
  readonly net: NetConfig;
  readonly limits: Omit<ServerLimits, "maxRooms" | "allowedOrigins">;
  /** [`anonymousVerifier`]; a host gives its own verifier. */
  readonly verifier?: SessionVerifier | undefined;
}
```

#### `evaluateReadiness` (function)

Under `all-ready`, starts the countdown once every connected player is ready and the game's minimum of seats is
taken. A room with nobody connected never starts. Outside the lobby, or under `host`, it does nothing.

```ts
function evaluateReadiness(lobby: LobbyState, rules: LobbyRules): void;
```

#### `FreedSeat` (interface)

A seat freed by `keepOnly`, so the room can forget what else it held.

```ts
interface FreedSeat {
  readonly session: string;
  readonly seat: number;
}
```

#### `GameVersion` (interface)

What two builds must share to play in one room: the net protocol, the sim's schema hash and the
content hash.

```ts
interface GameVersion {
  readonly protocol: number;
  readonly schemaHash: string;
  readonly contentHash: string;
}
```

#### `gameVersionOf` (function)

The game's version, read from a sim of it (seed 0: neither hash depends on the seed), then disposed.

```ts
function gameVersionOf(def: ServerDef): Promise<GameVersion>;
```

#### `GateOptions` (interface)

The gates `installGates` puts in front of Colyseus: the origin list, the matchmaking gate and
the upgrade gate.

```ts
interface GateOptions {
  readonly origins: OriginPolicy;
  readonly matchmake: MatchmakeGate;
  readonly upgrade: UpgradeGate;
}
```

#### `generateRoomCode` (function)

A room code drawn from net's alphabet with the given random source. It is not yet claimed.

```ts
function generateRoomCode(randomInt: RandomInt): string;
```

#### `InputMeter` (class)

Each seat's command budget, a token bucket counted in room ticks. A seat spends one credit per
accepted command; an empty seat has its command dropped.

```ts
class InputMeter {
  private readonly credits;
  private readonly options;
  constructor(options: InputMeterOptions);
  /** Gives a seat a full budget: on joining, and again on reconnecting. */
  fill(seat: number): void;
  /**
   * Spends one command's credit. Returns false when the seat is out of credit, and the caller drops the command. A
   * seat the meter has never seen has no credit.
   */
  spend(seat: number): boolean;
  /** Earns each listed seat one tick's credit, up to the cap. Once per tick. */
  refill(seats: Iterable<number>): void;
  /** Drops a seat's budget, for a seat that has left for good. */
  forget(seat: number): void;
}
```

#### `InputMeterOptions` (interface)

Each seat's command budget: a token bucket on the room clock.

A seat may bank up to `capacity` commands and spends one per accepted command, refilling a little faster than
the tick rate so ordinary play never touches the limit. Budgets are measured on the room clock rather than wall
time, so a client cannot widen them by stalling the server.

A command over budget is dropped, never answered with a disconnect: a burst is far more often a slow
frame than an attack, and dropping costs the player one tick of intent.

No I/O and no clock: the room calls `refill` once per tick.

```ts
interface InputMeterOptions {
  /** The most commands a seat can bank: one second's worth, `tickHz`. */
  readonly capacity: number;
  /** Commands a seat earns back per room tick. */
  readonly creditsPerTick: number;
}
```

#### `InputQueue` (class)

Holds the commands each seat has sent until the tick they are due. It refuses a repeated or
runaway sequence, a command stamped too far ahead and a seat with too many waiting.

```ts
class InputQueue {
  /** Indexed by seat, so taking walks the seats in seat order. */
  private readonly seats;
  private readonly options;
  constructor(options: InputQueueOptions);
  private queueOf;
  /** Accepts one command from `seat`, given the tick the room steps next (the sim's `tick` before `step`). */
  submit(seat: number, input: QueuedInput, nextTick: number): SubmitResult;
  /**
   * Every command due by `tick`, stamped `tick` with its seat as `source`, in seat order and then sequence order.
   * Called once per room tick, just before the sim steps `tick`.
   */
  take(tick: number): Command[];
  /**
   * Forgets a seat that has been given up, numbering and all. The room also calls it when a seat is resumed by a
   * reloaded client (`NetRoom.resume`), whose sequence starts again; a transport reconnect keeps the client's state
   * and continues its numbering, so it is not forgotten.
   */
  forget(seat: number): void;
  /** Forgets every seat, as a new game does. */
  reset(): void;
}
```

#### `InputQueueOptions` (interface)

How far ahead a command may be stamped, and how far its sequence may jump past the last accepted
one.

```ts
interface InputQueueOptions {
  /** How far ahead of the room a command may be stamped: net's `maxLeadTicks`. One at that lead is refused. */
  readonly maxLeadTicks: number;
  /**
   * How far a sequence may jump past the last accepted one. A command far ahead of the last one is not a fast client
   * but a client that has lost track.
   */
  readonly maxSequenceGap: number;
}
```

#### `installCrashHandlers` (function)

Makes an error nothing caught write one fatal log line, naming the error's class only, and end
the process with code 1 so the supervisor restarts it.

```ts
function installCrashHandlers(target: CrashTarget, log: (event: RoomLogEvent) => void, exit: (code: number) => void): void;
```

#### `installGates` (function)

Puts Colyseus's listeners behind the gates; the returned function puts them back.

```ts
function installGates(http: Server, options: GateOptions): () => void;
```

#### `installProbes` (function)

Puts the probes in front of the listener's own request handlers. Colyseus binds a router at `listen()` that answers
every path (a 404 for those it does not know), so this runs after `listen`, takes its handlers and calls them only
for what the probes leave.

```ts
function installProbes(http: Server, state: ProbeState): void;
```

#### `isPreGame` (function)

Before the game: the lobby, and only the lobby. From the countdown on, nobody new sits down or readies.

```ts
function isPreGame(lobby: Pick<LobbyState, "phase">): boolean;
```

#### `isTestVerifier` (function)

Whether a verifier is a test switch, which a production server refuses (`process-safety.ts`).

```ts
function isTestVerifier(verifier: SessionVerifier): boolean;
```

#### `LedgerAnswer` (interface)

The answer to one request, and whether it came from history.

```ts
interface LedgerAnswer {
  readonly result: CommandResult;
  /** True when the request did not run because this id was answered before. */
  readonly replayed: boolean;
}
```

#### `levelOf` (function)

A crash or a refusal to start is fatal; a refusal, a slow or late tick and a room's error warn; the rest inform.

```ts
function levelOf(event: string): LogLevel;
```

#### `LiveRooms` (class)

Every room a server process holds. The room cap counts them and a drain speaks to each. One per
server, so two servers in a test never share a set.

```ts
class LiveRooms<R extends DrainableRoom = DrainableRoom> implements Iterable<R> {
  private readonly rooms;
  get size(): number;
  register(room: R): void;
  forget(room: R): void;
  [Symbol.iterator](): Iterator<R>;
}
```

#### `LobbyRules` (interface)

A game's lobby.

```ts
interface LobbyRules {
  /** Seats, bots included, that must be taken before a game starts. */
  readonly minSeats: number;
  /** Seats the room offers; never more than net's `MAX_SEATS`. */
  readonly maxSeats: number;
  readonly countdownTicks: number;
  /** `all-ready`: the countdown starts when every connected player is ready. `host`: when the host says so. */
  readonly startWhen: "all-ready" | "host";
}
```

#### `LobbySeat` (interface)

One taken seat. A bot has no client: always connected and ready, never the host (`bot-seats.ts`).

```ts
interface LobbySeat {
  readonly seat: number;
  ready: boolean;
  connected: boolean;
  readonly bot: boolean;
}
```

#### `LobbyState` (interface)

The room's lobby: its phase, the host, who is seated and ready, and the countdown's end. The
lobby rules change it in place.

```ts
interface LobbyState {
  phase: LobbyPhase;
  /** The room's tick, set by the room once per tick: the countdown runs on it. */
  tick: number;
  hostSeat: number | undefined;
  countdownEndsAtTick: number | undefined;
  startedAtTick: number | undefined;
  /** Taken seats in seating order: the longest-seated first. */
  readonly seats: LobbySeat[];
}
```

#### `LogLevel` (type)

How serious a log line is: information, a warning, or a fatal error.

```ts
type LogLevel = "info" | "warn" | "fatal";
```

#### `LogWriterOptions` (interface)

Where a finished log line is written and the clock that stamps it.

```ts
interface LogWriterOptions {
  /** Where a finished line goes, newline included [`process.stdout.write` in production]. */
  readonly write: (line: string) => void;
  /** Milliseconds since the epoch, for `ts`. */
  readonly now: () => number;
}
```

#### `MatchmakeGate` (type)

Answers the request when it is refused, and says whether it did. Anything not matchmaking passes untouched.

```ts
type MatchmakeGate = (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;
```

#### `MatchmakeGateOptions` (interface)

What the matchmaking gate checks a request against: the origin list, whether the server is
draining, the per-address limits, the body cap, the game's version and the clock.

```ts
interface MatchmakeGateOptions {
  readonly origins: OriginPolicy;
  readonly isDraining: () => boolean;
  readonly perIp: ServerLimits["perIp"];
  /** The body cap: `maxMessageBytes`. */
  readonly maxBodyBytes: number;
  /** The game's version, once the server has read it; undefined while the game is loading or if it never loads. */
  readonly version: () => GameVersion | undefined;
  /** The server's clock, in milliseconds (Effect's `Clock`). */
  readonly now: () => number;
  readonly onRefused: (code: string) => void;
}
```

#### `MAX_QUEUED_COMMANDS` (const)

Commands one seat may have waiting. A client leads the room by a round trip, so an honest queue holds a handful;
thirty-two is generous for a hand on a controller and still a bound for a client that is not one.

```ts
const MAX_QUEUED_COMMANDS = 32;
```

#### `nextHost` (function)

Who hosts next, from the seated players in seating order: the longest-seated player who is still connected,
because a host who has dropped would block everyone who is there; when nobody is connected, the longest-seated
player, so a room always has a host to hand on. Never a bot.

```ts
function nextHost(lobby: LobbyState): number | undefined;
```

#### `openSeat` (function)

The lowest seat number nobody holds, or undefined when the room is full.

```ts
function openSeat(lobby: LobbyState, rules: LobbyRules): number | undefined;
```

#### `originPolicy` (function)

Builds the origin list from exact origins. It refuses an empty list, a blank entry and anything
that is not `scheme://host[:port]`.

```ts
function originPolicy(list: readonly string[]): OriginPolicy;
```

#### `OriginPolicy` (interface)

Which pages may use this server.

`allowedOrigins` lists the client origins, matched exactly: whichever origins the game is served from (a web page,
an itch.io page, or a host's `gameOrigin`; see `originsFromGameOrigin`). There is no "unset allows everything":
a server without a list refuses to start, and a dev server lists its dev origin.

This keeps other websites from using the server from their pages. It does not stop a script that forges the
header; the per-address limits are for that.

```ts
interface OriginPolicy {
  /** Whether a request or socket from `origin` may proceed. */
  allows(origin: string | undefined): boolean;
  /** The CORS headers an answer to `origin` carries. */
  corsHeaders(origin: string | undefined): Record<string, string>;
  /** The listed origins. */
  readonly origins: readonly string[];
}
```

#### `originsFromGameOrigin` (function)

The seam for Ruken's `gameOrigin(publicId, env, channel)` (`@ruken/manifest`). No core pack exports it yet, and a
Ruken contract is never copied here, so the deploy computes the origin and this lists it, refusing anything that
is not an exact origin. Once a core pack exposes `gameOrigin`, this calls it.

```ts
function originsFromGameOrigin(origin: string): readonly string[];
```

#### `PROBE_HEADERS` (const)

The probes' answers are never cached and never sniffed.

```ts
const PROBE_HEADERS: Readonly<Record<string, string>>;
```

#### `ProbeState` (interface)

What the server's own routes report: whether it is ready, and the contact for `security.txt` if
it has one.

```ts
interface ProbeState {
  readonly readiness: () => Readiness;
  readonly securityTxt?: SecurityTxt | undefined;
}
```

#### `QueuedInput` (type)

What a client sends for the sim: a command without `source`, which the seat supplies.

```ts
type QueuedInput = Pick<Command, "seq" | "tick" | "type" | "payload">;
```

#### `RandomInt` (type)

An integer in `[0, max)`.

```ts
type RandomInt = (max: number) => number;
```

#### `RATE_BUCKET_MAX_KEYS` (const)

The most addresses a bucket remembers.

```ts
const RATE_BUCKET_MAX_KEYS: number;
```

#### `readCappedBody` (function)

Reads a request body up to a size cap. Past the cap it stops reading and gives back undefined.

```ts
function readCappedBody(request: IncomingMessage, limit: number): Promise<string | undefined>;
```

#### `Readiness` (type)

`starting` until the content has loaded, `ready` while rooms may open, `full` at the room cap (every new room is
refused `SERVER_BUSY`), `draining` once SIGTERM came.

```ts
type Readiness = "starting" | "ready" | "full" | "draining";
```

#### `ReadonlyEntity` (interface)

An entity as a view reads it: its id and its components' values, never a setter.

```ts
interface ReadonlyEntity {
  readonly sid: number;
  has(component: ComponentDef): boolean;
  get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>;
}
```

#### `REFUSAL_WORDS` (const)

What a player is told, by code.

```ts
const REFUSAL_WORDS: Readonly<Partial<Record<NetErrorCode, string>>>;
```

#### `refuseTooLarge` (function)

Answers 413 and closes the connection once the answer is out, so a body that never ends cannot
hold the server.

```ts
function refuseTooLarge(request: IncomingMessage, response: ServerResponse, headers?: Record<string, string>): void;
```

#### `releaseRoomCode` (function)

Gives a room code back to the shared set when its room closes.

```ts
function releaseRoomCode(store: RoomCodeStore, code: string): Promise<void>;
```

#### `removeBot` (function)

The host's tap on a bot's seat: frees it.

```ts
function removeBot(lobby: LobbyState, by: number, seat: number): void;
```

#### `removeSeat` (function)

Frees a seat for good: a leave, or a drop past the grace. A host who leaves hands the role on (`nextHost`), and a
countdown left short of the game's minimum is cancelled.

```ts
function removeSeat(lobby: LobbyState, seat: number, rules: LobbyRules): void;
```

#### `requestIdOf` (function)

The request id (`req`) a raw message carries, if any.

Read before the rest of the message is validated, because even a malformed request has to be answered, and the
answer is addressed by this id. Runs on raw client data, so it must never throw: it reads only the message's own
data property, which runs no code, and takes it only when net's `reqIdSchema` does, which checks the type before
anything else and never converts a value to a string.

```ts
function requestIdOf(message: unknown): string | undefined;
```

#### `ROOM_CODE_CHANNEL` (const)

The shared set holding every live room code.

```ts
const ROOM_CODE_CHANNEL = "automata:rooms";
```

#### `ROOM_SOURCE` (const)

The sim `source` of the room's own commands (seat.join, seat.leave and a game's room commands): the highest source
the sim accepts, never a seat. On the sim side so a game's sim can tell the room's commands from a seat's without
importing the server; the server stamps its commands with this constant.

```ts
const ROOM_SOURCE = 255;
```

#### `RoomCodeStore` (interface)

The set operations a code claim needs: Colyseus Presence's `sismember`, `sadd` and `srem`.

```ts
interface RoomCodeStore {
  /** Adds `member`; resolves to 1 when it was added and 0 when the set already held it (Redis and Presence `sadd`). */
  sadd(key: string, member: string): Promise<number>;
  srem(key: string, member: string): Promise<unknown>;
}
```

#### `RoomCommandError` (class)

A refusal the client is expected to show the player, as opposed to a crash.

```ts
class RoomCommandError extends Error {
  readonly code: NetErrorCode;
  constructor(code: NetErrorCode, message: string);
}
```

#### `RoomLogEvent` (interface)

One event worth a log line. No field holds an address, a name, a room code, a
token or a payload; `room` is the room's index in this process, never its code.

```ts
interface RoomLogEvent {
  readonly event: string;
  readonly room?: string;
  readonly seat?: number;
  readonly code?: string;
  readonly ms?: number;
  readonly count?: number;
}
```

#### `runServerProcess` (function)

Runs a game's server as a production process and never returns. Fails with `ServerStartError` (after one
`start.refused` line per problem) when the environment lacks what the server cannot run without.

```ts
function runServerProcess(def: ServerDef, options: ServerProcessOptions): Effect.Effect<never, ServerStartError, Scope.Scope>;
```

#### `SeatClient` (interface)

The one thing the registry does with a client: tell it where it sits.

```ts
interface SeatClient {
  send(message: ServerMessage): void;
}
```

#### `seatPlayer` (function)

Seats a joining player in the lowest open seat; the first player to sit down hosts. Returns the seat.

```ts
function seatPlayer(lobby: LobbyState, rules: LobbyRules): number;
```

#### `SeatRegistry` (class)

Which session sits in which seat, which clients have yet to be told their seat and which dropped
seats are being held for a return.

```ts
class SeatRegistry {
  /** The seat per session, in the order they first sat down. */
  private readonly bySession;
  /** Clients still waiting to hear their own seat. */
  private readonly unannounced;
  /** How to cancel each pending reconnection, keyed by the session that dropped. */
  private readonly holds;
  private seatedOnce;
  /** Seats taken, counting those held for a player who dropped. */
  get size(): number;
  /** Whether anyone has ever sat down: an empty room that has had a player is abandoned; one that has not is new. */
  get everSeated(): boolean;
  seatOf(session: string): number | undefined;
  /** The session sitting in `seat`, if it still holds it. */
  sessionOf(seat: number): string | undefined;
  /** Every seat a session holds, in seating order: a copy, safe to keep. */
  seats(): number[];
  /**
   * Every seat a session holds, in seating order, without copying: for loops that run on every tick. Do not seat
   * or free anyone while iterating it.
   */
  seated(): Iterable<number>;
  /** Seats a session and queues its announcement: on a join and again on a reconnect, which keeps its place. */
  seat(session: string, seat: number, client: SeatClient): void;
  /**
   * Frees a seat for good; nothing is announced to it afterwards. It does not touch a reconnection hold: a caller
   * freeing a dropped seat calls `closeHold` first, or the token stays valid.
   */
  release(session: string): void;
  /** Frees every seat `keep` rejects, and says which ones it freed. */
  keepOnly(keep: (seat: number) => boolean): FreedSeat[];
  /**
   * Tells each waiting client its seat. Once per tick. A client that disconnected after it was queued makes `send`
   * throw; its seat has already been dealt with by the room's leave handler, so the failure is swallowed and the
   * other clients are still told.
   */
  announce(): void;
  /** Records how to cancel the reconnection held for a dropped session. */
  hold(session: string, cancel: () => void): void;
  /** Forgets a hold that has settled: the player came back, or the grace ran out. */
  endHold(session: string): void;
  /** Ends a hold early. Its token stops working, so a client still holding it is refused rather than seated. */
  closeHold(session: string): void;
}
```

#### `SecurityTxt` (interface)

RFC 9116's two required fields: a `mailto:` or `https:` contact, and an ISO 8601 expiry.

```ts
interface SecurityTxt {
  readonly contact: string;
  readonly expires: string;
}
```

#### `securityTxtBody` (function)

The text of `/.well-known/security.txt` for a contact and an expiry.

```ts
function securityTxtBody(security: SecurityTxt): string;
```

#### `ServerConfig` (interface)

Everything a server process is given: its port, limits, net settings, log, verifier and the test
switches a production server refuses.

```ts
interface ServerConfig {
  /** `0` asks the operating system for a free port, as every test does. */
  readonly port: number;
  /**
   * The address to listen on. Unset, every address (Node's default), as a deployed server wants. The test harness
   * gives `127.0.0.1` (issue #14): on macOS a wildcard listener can share its port with another process's loopback one.
   */
  readonly host?: string | undefined;
  readonly limits: ServerLimits;
  /** `content/net.toml`: the snapshot rate, the lead a client may take and the reconnect grace. */
  readonly net: NetConfig;
  /** A test switch: every room's seed. Unset, each room draws a fresh one. A production server refuses it. */
  readonly seed?: number | undefined;
  readonly log?: ((event: RoomLogEvent) => void) | undefined;
  /**
   * A test switch: rooms start with no clock of their own, and only a test steps them, so no tick runs that the
   * test did not ask for. A production server refuses it with the other test switches.
   */
  readonly manualClock?: boolean | undefined;
  /** SIGTERM's source [`process`]. */
  readonly signals?: SignalSource | undefined;
  /** Ends the process after a drain [`process.exit`]. */
  readonly exit?: ((code: number) => void) | undefined;
  /** Read for `NODE_ENV`: a clock hold is refused in production [`process.env`]. */
  readonly env?: Readonly<Record<string, string | undefined>> | undefined;
  /** The longest a drain waits for rooms to finish [five minutes]. */
  readonly drainCapMs?: number | undefined;
  /** Who a joining player is [`anonymousVerifier`, until a host verifier is given]. The fake is a test switch. */
  readonly verifier?: SessionVerifier | undefined;
  /** `/.well-known/security.txt`'s contact and expiry; unset, the path is 404. */
  readonly securityTxt?: SecurityTxt | undefined;
}
```

#### `serverConfigFromEnv` (function)

The server's config from its environment, or the name of each variable that is missing or not valid.

```ts
function serverConfigFromEnv(env: Env, base: EnvServerBase): EnvConfigResult;
```

#### `ServerDef` (interface)

A game's server after `defineServer` has checked it: the game, its seat range, its lobby and a
way to find the commands a client may send.

```ts
interface ServerDef {
  readonly kind: "server";
  readonly game: ServerGameDef;
  readonly seats: {
    readonly min: number;
    readonly max: number;
  };
  readonly lobby: {
    readonly countdownSeconds: number;
    readonly startWhen: "all-ready" | "host";
  };
  /**
   * The definition of a command a client may send, by type: every plugin's commands but net's seat commands, which
   * only the room sends. Undefined for any other type.
   */
  clientCommand(type: string): CommandDef | undefined;
}
```

#### `ServerError` (interface)

What a player is told about a failure: a code from net's list and a sentence.

```ts
interface ServerError {
  readonly code: NetErrorCode;
  readonly message: string;
}
```

#### `ServerGameDef` (interface)

What a game gives its server: the sim's plugins and content, how many seats, and optionally the
lobby rules, how a new seat gets its avatar, how a bot plays and when the game is over.

```ts
interface ServerGameDef {
  /** The game's sim, the same list its client uses; it must include net's `netPlugin`. */
  readonly plugins: readonly PluginDef[];
  /** Compiled content, as `SimOptions.content`; its hash must equal the client's. */
  readonly content?: unknown;
  readonly seats: {
    readonly min: number;
    readonly max: number;
  };
  readonly lobby?: {
    readonly countdownSeconds: number;
    readonly startWhen: "all-ready" | "host";
  };
  /** Commands that give a newly seated seat (a player or a bot) its entities, sent right after `seat.join`. */
  readonly seat?: (seat: number, name: string) => readonly CommandIntent[];
  readonly bots?: BotPolicy;
  /**
   * Whether play is over, asked after each tick of play with that tick's events. Without it a game plays until its
   * room closes.
   */
  readonly ended?: (view: SimView, events: readonly SimEvent[]) => boolean;
}
```

#### `ServerLimits` (interface)

Every limit the server enforces: rooms, allowed origins, message size, sockets and matchmaking
per address, and each seat's command budget.

```ts
interface ServerLimits {
  /** The most rooms the process holds; one more is refused `SERVER_BUSY`. */
  readonly maxRooms: number;
  /**
   * Exact client origins (`scheme://host[:port]`): the game's Ruken `gameOrigin` (see `originsFromGameOrigin`) and
   * any web or itch.io origin. Matchmaking and sockets from any other origin, or none, are refused; empty refuses
   * to start.
   */
  readonly allowedOrigins: readonly string[];
  /**
   * A room message past this is dropped before parsing, and a matchmaking body past it gets 413. From 1 to net's
   * `MAX_MESSAGE_BYTES` [16384].
   */
  readonly maxMessageBytes: number;
  /** Sockets one address may hold [16]; the server's total is a socket per seat of `maxRooms` rooms plus 64. */
  readonly socketsPerIp: number;
  /**
   * Matchmaking per address: opening a room (`create`), Quick match (`quickMatch`, which fills a listed room or
   * opens one), joining by code (`join`) and reconnecting (`reconnect`). Past one: `RATE_LIMITED`.
   */
  readonly perIp: {
    readonly create: Bucket;
    readonly join: Bucket;
    readonly quickMatch: Bucket;
    readonly reconnect: Bucket;
  };
  /** Each seat's command budget: a command past it is dropped, never a disconnect. */
  readonly commandsPerSeat: Bucket;
}
```

#### `serverLogLine` (const)

The strict schema every log line is parsed with before it is written. It is what keeps the log
free of anything private.

```ts
const serverLogLine: z.ZodType<ServerLogLine>;
```

#### `ServerLogLine` (interface)

One line of the server's log. It has no field for an address, a name, a room code, a token or a
payload, so none can leak.

```ts
interface ServerLogLine {
  readonly ts: number;
  readonly level: LogLevel;
  readonly event: string;
  readonly room?: string | undefined;
  readonly seat?: number | undefined;
  readonly code?: string | undefined;
  readonly ms?: number | undefined;
  readonly count?: number | undefined;
}
```

#### `ServerProcessOptions` (interface)

What `runServerProcess` takes beyond the game's own limits. Every field is injected so a test
can run a whole process without touching the real one: the environment, the log writer and
clock, the process and its exit.

```ts
interface ServerProcessOptions extends EnvServerBase {
  /** [`process.env`] */
  readonly env?: Env | undefined;
  /** Where log lines go [`process.stdout.write`]. */
  readonly write?: ((line: string) => void) | undefined;
  /** The log lines' clock, in epoch milliseconds [`Date.now`]. */
  readonly now?: (() => number) | undefined;
  /** Crashes and SIGTERM [`process`]. */
  readonly process?: (CrashTarget & SignalSource) | undefined;
  /** [`process.exit`] */
  readonly exit?: ((code: number) => void) | undefined;
}
```

#### `ServerRuntime` (interface)

A running server: its port and address, its rooms, whether it is draining, what `/ready` says,
and the `drain` that ends it gracefully.

```ts
interface ServerRuntime {
  /** The port the listener bound: the one asked for, or the operating system's choice for port 0. */
  readonly port: number;
  /** The address the listener bound: the configured host, or Node's wildcard (`::` or `0.0.0.0`) with none. */
  readonly host: string;
  readonly gameServer: Server$1;
  readonly rooms: LiveRooms<AutomataRoom>;
  readonly draining: boolean;
  /** What `/ready` reports: `ready` once the content has loaded, `full` at the room cap, `draining` after SIGTERM. */
  readonly readiness: Readiness;
  /** The origin list every route answers with. */
  readonly origins: OriginPolicy;
  /** The protocol and hashes a client must match to join; undefined until read. */
  readonly version: GameVersion | undefined;
  /** The open sockets the gates count, per address and in all. */
  readonly sockets: Pick<SocketGate, "open" | "addresses">;
  /**
   * Opens no room and seats nobody new, tells every room, waits for them to finish (at most the cap), then shuts
   * Colyseus down. Runs once: a second run returns the first result.
   */
  readonly drain: Effect.Effect<DrainResult>;
}
```

#### `ServerStartError` (class)

The server could not start: a config no server can run with, or a listener that could not bind.

```ts
class ServerStartError extends ServerStartErrorBase {}
```

#### `SessionRejected` (class)

The verifier refused the token; the room refuses the join `UNVERIFIED`.

```ts
class SessionRejected extends SessionRejectedBase {}
```

#### `SessionRejectReason` (type)

Why a token was refused: none was given, it was never issued, or it has expired.

```ts
type SessionRejectReason = "missing" | "forged" | "expired";
```

#### `SessionVerifier` (interface)

The port that says who a joining player is. Given the session token a client presents, it
answers with a verified player or refuses.

```ts
interface SessionVerifier {
  verify(token: string): Effect.Effect<VerifiedSession, SessionRejected>;
}
```

#### `setConnected` (function)

A player's drop (false) or return (true). A dropped player cannot hold the room up, so their readiness is cleared;
they keep the host role while their seat is held. A countdown that no longer has anyone
connected is cancelled.

```ts
function setConnected(lobby: LobbyState, seat: number, connected: boolean, rules: LobbyRules): void;
```

#### `setReady` (function)

A player's Ready toggle, in the lobby only.

```ts
function setReady(lobby: LobbyState, seat: number, ready: boolean, rules: LobbyRules): void;
```

#### `SignalSource` (interface)

Where SIGTERM comes from: the process in production, an emitter in a test.

```ts
interface SignalSource {
  on(event: "SIGTERM", listener: () => void): unknown;
  off(event: "SIGTERM", listener: () => void): unknown;
}
```

#### `SimView` (interface)

A read-only look at the room's sim, for a bot: the tick, the hash, entities and resources, and
nothing that changes them.

```ts
interface SimView {
  /** The tick the sim steps next. */
  readonly tick: number;
  readonly tickHz: number;
  readonly contentHash: string;
  entity(sid: number): ReadonlyEntity | undefined;
  /** Entities with every listed component, in id order (the sim's `query`). */
  query(...components: ComponentDef[]): ReadonlyEntity[];
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): Readonly<z.output<Z>>;
  hash(): string;
}
```

#### `simViewOf` (function)

Wraps a sim as a read-only `SimView`. The view is live, reading the sim as it is when called.

```ts
function simViewOf(sim: Sim): SimView;
```

#### `slowStepMs` (function)

A step that took more than half its tick: two back to back would miss a tick.

```ts
function slowStepMs(tickHz: number): number;
```

#### `SOCKET_HEADROOM` (const)

Sockets beyond one per seat that the server holds for joins in flight.

```ts
const SOCKET_HEADROOM: number;
```

#### `SocketGate` (interface)

Open WebSockets, per address and overall.

Sixteen per address (the default) covers four players behind one router with their reconnects; the total is a
socket per seat in every room the server may hold, plus headroom for joins in flight. An address with no open
socket is forgotten. Refusing a socket never touches the ones already open.

```ts
interface SocketGate {
  /** Counts one more socket from `ip`, or refuses it. */
  admit(ip: string): boolean;
  /** Counts one socket from `ip` closed. */
  release(ip: string): void;
  readonly open: number;
  readonly addresses: number;
}
```

#### `socketTotal` (function)

The most sockets the server holds at once: one per seat of `maxRooms` rooms, plus the headroom.

```ts
function socketTotal(maxRooms: number, seatsPerRoom: number): number;
```

#### `startCountdown` (function)

The host's Start, under `host`. A guest is told they are not the host before anything else, so the lobby can
disable the control for the right reason rather than "not now".

```ts
function startCountdown(lobby: LobbyState, by: number, rules: LobbyRules): void;
```

#### `startGame` (function)

Play begins on this tick; every seat keeps its connection and readiness. Only from the countdown.

```ts
function startGame(lobby: LobbyState): void;
```

#### `startOver` (function)

Play again: a fresh lobby after an ended game, keeping every seat, the host and the room's clock (`tick` is kept,
so a dropped seat's grace deadline stays meaningful). A dropped player comes over still dropped; were they rebuilt
as connected, they would count as a player who is not ready and the countdown could never start. People ready
again in the lobby; a bot is always ready.

```ts
function startOver(lobby: LobbyState): void;
```

#### `startServer` (function)

Starts the server and keeps it: listens, then drains on the first SIGTERM and exits (0 drained, 1 failed). Fails
with `ServerStartError` before listening when the config cannot run. Closing the scope shuts it down.

```ts
function startServer(def: ServerDef, config: ServerConfig): Effect.Effect<never, ServerStartError, Scope.Scope>;
```

#### `startTickScheduler` (function)

Starts ticking at fixed deadlines, one tick length apart, so ticks do not bunch up. After a
stall it catches up a few ticks and drops the rest.

```ts
function startTickScheduler(options: TickSchedulerOptions): TickScheduler;
```

#### `SubmitResult` (type)

`tick` is when the command will take effect. `slack` is how many ticks early it arrived: its stamped tick minus
the next tick the room steps. Zero is exactly in time; negative is late, which the room logs as `input.late`.

```ts
type SubmitResult = {
  readonly ok: true;
  readonly tick: number;
  readonly slack: number;
} | {
  readonly ok: false;
  readonly reason: "sequence" | "lead" | "full";
};
```

#### `testSwitchesSet` (function)

Each test switch set, or a production limit missing, when any of `envs` says production; empty otherwise.

```ts
function testSwitchesSet(config: ServerConfig, ...envs: readonly Env$1[]): string[];
```

#### `TickClock` (interface)

The time source and timer the scheduler runs on. Times are milliseconds.

```ts
interface TickClock {
  now(): number;
  setTimer(callback: () => void, delayMs: number): unknown;
  clearTimer(handle: unknown): void;
}
```

#### `tickClockFrom` (function)

The room's tick clock on Effect's `Clock`: time is the clock's (TestClock in a test), and the wake-up is a Node
timer, which the clock does not own. A test that needs exact ticks stops the room's clock and steps it by hand.

```ts
function tickClockFrom(clock: Clock.Clock): TickClock;
```

#### `TickScheduler` (interface)

A running metronome. Stop it to end it for good.

```ts
interface TickScheduler {
  /** Stops for good. Idempotent. */
  stop(): void;
}
```

#### `TickSchedulerOptions` (interface)

How often to tick and what runs: the tick length, the clock, the tick itself and optional hooks
for a slow wake-up, an error and the most ticks to catch up.

```ts
interface TickSchedulerOptions {
  readonly tickMs: number;
  readonly clock: TickClock;
  /** Runs one tick. */
  readonly onTick: () => void;
  /** After each wake-up: how many ticks ran and how much time was given up. */
  readonly onCallback?: (ticks: number, droppedMs: number) => void;
  /**
   * A tick threw. The scheduler has stopped for good: it runs in a timer callback, where a throw would be an
   * uncaught exception, so it never lets one out and never runs a room on past one.
   */
  readonly onError?: (error: unknown) => void;
  /** The most ticks one wake-up runs [5]. */
  readonly maxCatchUp?: number;
}
```

#### `TokenBucketOptions` (interface)

How a set of buckets behaves: the burst a quiet key may take, how long one token takes to come
back, how many keys to remember and the clock.

```ts
interface TokenBucketOptions {
  /** How many a quiet key may take at once. */
  readonly burst: number;
  /** How long one token takes to come back; `Infinity` never refills. */
  readonly refillMs: number;
  readonly maxKeys: number;
  /** The clock, in milliseconds. */
  readonly now: () => number;
}
```

#### `TokenBuckets` (class)

A token bucket for each key, usually an address, held in memory and capped at a number of keys.
The least recently used key is forgotten first.

```ts
class TokenBuckets {
  private readonly buckets;
  private readonly options;
  constructor(options: TokenBucketOptions);
  get size(): number;
  /** Takes one token for `key`, and says whether there was one. */
  take(key: string): boolean;
  /** Drops every bucket that has refilled to its burst: it would behave exactly like a new one. */
  sweep(): void;
  private refilled;
}
```

#### `toLogLine` (function)

The line an event becomes, with only the schema's fields copied. Not yet validated.

```ts
function toLogLine(event: {
  readonly event: string;
} & object, ts: number): ServerLogLine;
```

#### `toServerError` (function)

Translates any thrown failure into something a client can render. A refusal keeps its own code and words.
Anything else is a bug on our side, so the player gets a generic sentence and never the bug's own text.

```ts
function toServerError(error: unknown): ServerError;
```

#### `UpgradeGate` (type)

Admits an upgrade, or answers it and says it did not. An admitted socket is counted until it closes.

```ts
type UpgradeGate = (request: IncomingMessage, socket: Duplex) => boolean;
```

#### `UpgradeGateOptions` (interface)

What the upgrade gate checks a socket against: the origin list and the socket counts, and where
refusals are reported.

```ts
interface UpgradeGateOptions {
  readonly origins: OriginPolicy;
  readonly sockets: SocketGate;
  /** Hears each refusal by its code (`origin`, `sockets`), never by address. */
  readonly onRefused: (code: string) => void;
}
```

#### `VerifiedSession` (interface)

Who a token belongs to. The player id is the only thing a verifier tells the room.

```ts
interface VerifiedSession {
  readonly playerId: string;
}
```

#### `versionVerdict` (function)

`same`, `mismatch`, or `unread` for options this gate cannot read, which are the room's to refuse (its strict
schema answers `REFUSED`). A protocol that differs is a mismatch whatever else the options hold: an old client may
send a shape this server does not know.

```ts
function versionVerdict(options: unknown, version: GameVersion): "same" | "mismatch" | "unread";
```

### `import { … } from '@automata/net-server/testing'`

#### `CLOCK_NAMES` (const)

The clocks a test may ask a room to hold.

```ts
const CLOCK_NAMES: readonly ClockName[];
```

#### `ClockName` (type)

A clock a room can be asked to hold. The countdown is the one a client watches run out.

```ts
type ClockName = "countdown";
```

#### `createFakeVerifier` (function)

Verifies only the tokens it issued: any other is `forged`, an empty one `missing`, and one at or past its expiry
`expired`. Each fake numbers its tokens under its own prefix, so two fakes never accept each other's.

```ts
function createFakeVerifier(): FakeVerifier;
```

#### `createRoomDriver` (function)

Builds a driver for a room. It uses the room's own input path and cannot set a position, a phase
or a winner.

```ts
function createRoomDriver(room: DrivableRoom): RoomDriver;
```

#### `DrivableRoom` (interface)

What the driver needs of a room: its engine, its clock and one tick (`AutomataRoom` has all three).

```ts
interface DrivableRoom {
  readonly engine: RoomEngine;
  stopClock(): void;
  tick(): void;
}
```

#### `FakeVerifier` (interface)

A verifier for tests: it hands out tokens and accepts only those. A production server refuses to
start with one.

```ts
interface FakeVerifier extends SessionVerifier {
  /** A token this verifier accepts for `playerId` until `expiresAtMs` on Effect's `Clock`. */
  issue(playerId: string, options: {
    readonly expiresAtMs: number;
  }): string;
}
```

#### `HELD_GRACE_SECONDS` (const)

How long Colyseus keeps a seat that dropped while the room was held, in wall seconds.

```ts
const HELD_GRACE_SECONDS: number;
```

#### `holdAllowed` (function)

Whether a hold may be taken in this environment: never in production.

```ts
function holdAllowed(env: Readonly<Record<string, string | undefined>>): boolean;
```

#### `isClockName` (function)

Whether a value names a clock a room can hold. Checked before a hold is taken, because the name
comes from a test's input.

```ts
function isClockName(value: unknown): value is ClockName;
```

#### `MAX_DRIVEN_TICKS` (const)

The most ticks one `step` call drives: five minutes at 60 Hz.

```ts
const MAX_DRIVEN_TICKS: number;
```

#### `RoomDriver` (interface)

Drives a room in a test: stop its clock, step it tick by tick, submit a seat's command, read its
state and hold its clocks.

```ts
interface RoomDriver {
  /** Stops the room's own clock for good, so no tick the test did not ask for lands between its assertions. */
  stopClock(): void;
  step(count: number): void;
  submit(seat: number, input: QueuedInput): SubmitOutcome;
  read(): RoomReading;
  /** Holds the named clocks and lets go of the rest. Refused in production; the whole list or nothing. */
  holdClocks(names: readonly ClockName[]): RoomReading;
}
```

#### `RoomReading` (interface)

The room as it decided, read from the room itself and never from a client's copy.

```ts
interface RoomReading {
  readonly phase: string;
  /** The tick the room steps next. */
  readonly tick: number;
  readonly countdownEndsAtTick?: number;
  readonly held: ClockName[];
  readonly hash: string;
  readonly seats: readonly SeatInfoView[];
}
```

## `@automata/net-ui`

### `import { … } from '@automata/net-ui'`

#### `BadgeState` (type)

What the connection badge shows: nothing, connecting, connected, reconnecting (with seconds
left) or a poor connection.

```ts
type BadgeState = 'hidden' | 'connecting' | 'connected' | 'reconnecting' | 'degraded';
```

#### `CONNECTED_SHOWN_MS` (const)

How long the badge says the connection is up before it hides again, in milliseconds.

```ts
const CONNECTED_SHOWN_MS = 2000;
```

#### `copyOf` (const)

The words for `host`: its own catalog, or the English one when it gave none.

```ts
const copyOf: (host: NetUiHost) => Readonly<Record<string, string>>;
```

#### `createNetStatus` (function)

Starts a status machine. `graceSeconds` is how long a game keeps trying to reconnect before the
overlay says it could not.

```ts
function createNetStatus(options: {
    readonly graceSeconds: number;
}): NetStatus;
```

#### `currentNetUi` (const)

The host that is installed now, or nothing when the game has not installed one.

```ts
const currentNetUi: () => NetUiHost | undefined;
```

#### `installNetUi` (function)

Makes `host` the one the badge and overlay read. Returns a dispose that removes it (if it is still the current one).

```ts
function installNetUi(host: NetUiHost): () => void;
```

#### `NET_COPY_EN` (const)

The English words for the badge, the overlay and every connection error. Each error says what
went wrong and what to do next. A game translates by giving the same keys.

```ts
const NET_COPY_EN: Readonly<Record<NetCopyKey, string>>;
```

#### `NetBadge` (const)

The small connection badge for the game's overlay layer. It is hidden offline, says connecting, then says online for two seconds, shows the seconds left while reconnecting, and says poor connection for as long as that lasts. It cannot be pressed, and a screen reader hears each change.

```ts
const NetBadge: import("svelte").Component<Record<string, never>, {}, "">;
type NetBadge = ReturnType<typeof NetBadge>;
```

#### `NetCopyKey` (type)

A key into the connection words, always starting with `net.`.

```ts
type NetCopyKey = `net.${string}`;
```

#### `netCopyKeys` (const)

Every key, sorted: what a locale file must supply.

```ts
const netCopyKeys: () => string[];
```

#### `netErrorKey` (const)

The key for a `NetError` code's message.

```ts
const netErrorKey: (code: NetErrorCode) => NetCopyKey;
```

#### `NetHud` (const)

What the net extension puts in the game's overlay layer: the connection badge and the reconnect overlay.

```ts
const NetHud: $$__sveltets_2_IsomorphicComponent<Record<string, never>, {
    [evt: string]: CustomEvent<any>;
}, {}, {}, string>;
type NetHud = InstanceType<typeof NetHud>;
```

#### `NetStatus` (interface)

The connection badge and the reconnect overlay as one state machine, fed the connection state
and the time.

```ts
interface NetStatus {
    /** The view for `state` at time `now` (ms). Call it when the state changes and as time passes. */
    update(state: ConnectionState, now: number): NetStatusView;
}
```

#### `NetStatusView` (interface)

What to draw for one moment: the badge, the overlay and the seconds of grace left while
reconnecting.

```ts
interface NetStatusView {
    readonly badge: BadgeState;
    readonly overlay: OverlayState;
    /** Seconds of grace left while reconnecting; undefined otherwise. */
    readonly secondsLeft: number | undefined;
}
```

#### `netText` (function)

The text for `key`, with `{name}` placeholders filled from `params`; one with no value is left as written, so a gap shows.

```ts
function netText(key: NetCopyKey, params?: Readonly<Record<string, string | number>>, catalog?: Readonly<Record<string, string>>): string;
```

#### `NetUiHost` (interface)

What the badge and overlay need from the game: the connection, the grace, a way to leave and the
words. Hand it to `installNetUi`.

```ts
interface NetUiHost {
    /** The connection now, and a way to hear it change (a `NetRoom.connection` subscription). */
    readonly connection: {
        get(): ConnectionState;
        subscribe(listener: (state: ConnectionState) => void): () => void;
    };
    /** net.toml's `reconnectGraceSeconds`. */
    readonly graceSeconds: number;
    /** `NetRoom.leave`, fire and forget: the overlay's Leave and Back. */
    leave(): void;
    /** Milliseconds; `performance.now` by default. */
    readonly now?: (() => number) | undefined;
    /** The catalog (keys from `net-copy`); English by default. */
    readonly copy?: Readonly<Record<string, string>> | undefined;
}
```

#### `OverlayState` (type)

What the reconnect overlay shows: nothing, a countdown while the game reconnects, or the words
for giving up once the grace has passed.

```ts
type OverlayState = 'hidden' | 'reconnecting' | 'expired';
```

#### `ReconnectOverlay` (const)

The banner shown while the game reconnects: it counts down the grace, then says it could not reconnect. Leave is always there, and it gets focus once the grace has passed. It pauses nothing: the game keeps drawing behind it.

```ts
const ReconnectOverlay: import("svelte").Component<Record<string, never>, {}, "">;
type ReconnectOverlay = ReturnType<typeof ReconnectOverlay>;
```

#### `watchStatus` (function)

Calls `onView` with what to draw now, and again whenever the connection changes or time passes.
Returns a function that stops it.

```ts
function watchStatus(host: NetUiHost, onView: (view: NetStatusView) => void): () => void;
```

## `@automata/physics`

### `import { … } from '@automata/physics/2d'`

#### `body2d` (function)

The spawn part that gives an entity a rigid body of a `BodyKind`. Damping and velocities (`vx`, `vy` in
m/s, `angvel` in rad/s) are 0 unless given.

```ts
function body2d(kind: BodyKind, opts?: {
  linearDamping?: number;
  angularDamping?: number;
  vx?: number;
  vy?: number;
  angvel?: number;
}): SpawnPart;
```

#### `BodyKind` (const)

The codes a rigid body's `kind` field holds: `dynamic` (moved by gravity and contacts), `fixed` (never
moves), `kinematicPosition` (moved by writing its transform) and `kinematicVelocity` (moved by its
velocity). `BodyKind` is also the type of those values.

```ts
const BodyKind: {
  readonly dynamic: 0;
  readonly fixed: 1;
  readonly kinematicPosition: 2;
  readonly kinematicVelocity: 3;
};
type BodyKind = (typeof BodyKind)[keyof typeof BodyKind];
```

#### `Collider2D` (const)

One collider. `shape` is a `ShapeKind`; sizes are halves: ball radius `hx`; cuboid half extents `hx, hy`;
capsule radius `hx` and half-height `hy`. `groups` is Rapier's packed membership << 16 | filter.

```ts
const Collider2D: ComponentDef<typeof colliderFields>;
```

#### `collider2d` (const)

The spawn parts that give an entity a collider: `ball(radius)`, `cuboid(hx, hy)` with half extents, and
`capsule(halfHeight, radius)`. Each takes `ColliderOptions`, whose defaults are Rapier's (every group,
friction 0.5, no bounce, not a sensor).

```ts
const collider2d: {
  ball(radius: number, opts?: ColliderOptions): SpawnPart;
  cuboid(hx: number, hy: number, opts?: ColliderOptions): SpawnPart;
  capsule(halfHeight: number, radius: number, opts?: ColliderOptions): SpawnPart;
};
```

#### `ColliderOptions` (interface)

Options every collider helper takes. The defaults are Rapier's: every group, friction 0.5, no bounce.

```ts
interface ColliderOptions {
  readonly sensor?: boolean;
  readonly groups?: number;
  readonly friction?: number;
  readonly restitution?: number;
}
```

#### `CollisionEnded2D` (const)

Two colliders stopped touching, or one was removed. The payload is the one of `CollisionStarted2D`; ended
events come before started events in a tick.

```ts
const CollisionEnded2D: EventDef<typeof pair>;
```

#### `CollisionStarted2D` (const)

Two colliders began touching (or, with a sensor, overlapping). `a` and `b` are the entities' StableIds, `a`
the lower, and `sensor` is true when either collider is a sensor. Emitted in `postPhysics`, in `(a, b)`
order, after that tick's ended events.

```ts
const CollisionStarted2D: EventDef<typeof pair>;
```

#### `physics2d` (function)

The 2D physics plugin. Rapier's wasm loads inside `createSim`, through the dynamic import
in rapier-2d.ts, so importing this module costs nothing until a sim uses it.

```ts
function physics2d(options?: Physics2DOptions): PluginDef;
```

#### `Physics2DOptions` (interface)

The options of `physics2d`. Gravity is part of the sim's schema hash, so a different gravity is a different
sim.

```ts
interface Physics2DOptions {
  /** m/s², default { x: 0, y: -9.81 }. */
  readonly gravity?: {
    readonly x: number;
    readonly y: number;
  };
}
```

#### `RigidBody2D` (const)

A Rapier rigid body: its kind (`BodyKind`), damping, and linear (m/s) and angular (rad/s) velocity.

```ts
const RigidBody2D: ComponentDef<typeof bodyFields>;
```

#### `ShapeKind` (const)

The codes a collider's `shape` field holds: `ball`, `cuboid` and `capsule`. `ShapeKind` is also the type of
those values.

```ts
const ShapeKind: {
  readonly ball: 0;
  readonly cuboid: 1;
  readonly capsule: 2;
};
type ShapeKind = (typeof ShapeKind)[keyof typeof ShapeKind];
```

#### `transform2d` (function)

The spawn part that places an entity: `x` and `y` in metres and `rotation` in radians, each 0 unless given.

```ts
function transform2d(at?: {
  x?: number;
  y?: number;
  rotation?: number;
}): SpawnPart;
```

#### `Transform2D` (const)

Position in metres and rotation in radians. Rendered.

```ts
const Transform2D: ComponentDef<typeof transformFields>;
```

### `import { … } from '@automata/physics/3d'`

#### `body3d` (function)

The spawn part that gives an entity a rigid body of a `BodyKind`. Damping and velocities (`vx`, `vy`, `vz`
in m/s, `wx`, `wy`, `wz` in rad/s) are 0 unless given.

```ts
function body3d(kind: BodyKind, opts?: {
  linearDamping?: number;
  angularDamping?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  wx?: number;
  wy?: number;
  wz?: number;
}): SpawnPart;
```

#### `BodyKind` (const)

The codes a rigid body's `kind` field holds: `dynamic` (moved by gravity and contacts), `fixed` (never
moves), `kinematicPosition` (moved by writing its transform) and `kinematicVelocity` (moved by its
velocity). `BodyKind` is also the type of those values.

```ts
const BodyKind: {
  readonly dynamic: 0;
  readonly fixed: 1;
  readonly kinematicPosition: 2;
  readonly kinematicVelocity: 3;
};
type BodyKind = (typeof BodyKind)[keyof typeof BodyKind];
```

#### `Collider3D` (const)

One collider. `shape` is a `ShapeKind`; sizes are halves: ball radius `hx`; cuboid half extents `hx, hy, hz`;
capsule radius `hx` and half-height `hy`. `groups` is Rapier's packed membership << 16 | filter.

```ts
const Collider3D: ComponentDef<typeof colliderFields>;
```

#### `collider3d` (const)

The spawn parts that give an entity a collider: `ball(radius)`, `cuboid(hx, hy, hz)` with half extents, and
`capsule(halfHeight, radius)`. Each takes `ColliderOptions`, whose defaults are Rapier's (every group,
friction 0.5, no bounce, not a sensor).

```ts
const collider3d: {
  ball(radius: number, opts?: ColliderOptions): SpawnPart;
  cuboid(hx: number, hy: number, hz: number, opts?: ColliderOptions): SpawnPart;
  capsule(halfHeight: number, radius: number, opts?: ColliderOptions): SpawnPart;
};
```

#### `ColliderOptions` (interface)

Options every collider helper takes. The defaults are Rapier's: every group, friction 0.5, no bounce.

```ts
interface ColliderOptions {
  readonly sensor?: boolean;
  readonly groups?: number;
  readonly friction?: number;
  readonly restitution?: number;
}
```

#### `CollisionEnded3D` (const)

Two colliders stopped touching, or one was removed. The payload is the one of `CollisionStarted3D`; ended
events come before started events in a tick.

```ts
const CollisionEnded3D: EventDef<typeof pair>;
```

#### `CollisionStarted3D` (const)

Two colliders began touching (or, with a sensor, overlapping). `a` and `b` are the entities' StableIds, `a`
the lower, and `sensor` is true when either collider is a sensor. Emitted in `postPhysics`, in `(a, b)`
order, after that tick's ended events.

```ts
const CollisionStarted3D: EventDef<typeof pair>;
```

#### `physics3d` (function)

The 3D physics plugin. Rapier's wasm loads inside `createSim`, through the dynamic import
in rapier-3d.ts, so importing this module costs nothing until a sim uses it.

```ts
function physics3d(options?: Physics3DOptions): PluginDef;
```

#### `Physics3DOptions` (interface)

The options of `physics3d`. Gravity is part of the sim's schema hash, so a different gravity is a different
sim.

```ts
interface Physics3DOptions {
  /** m/s², default { x: 0, y: -9.81, z: 0 }. */
  readonly gravity?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}
```

#### `RigidBody3D` (const)

A Rapier rigid body: its kind (`BodyKind`), damping, and linear (m/s) and angular (rad/s) velocity.

```ts
const RigidBody3D: ComponentDef<typeof bodyFields>;
```

#### `ShapeKind` (const)

The codes a collider's `shape` field holds: `ball`, `cuboid` and `capsule`. `ShapeKind` is also the type of
those values.

```ts
const ShapeKind: {
  readonly ball: 0;
  readonly cuboid: 1;
  readonly capsule: 2;
};
type ShapeKind = (typeof ShapeKind)[keyof typeof ShapeKind];
```

#### `transform3d` (function)

The spawn part that places an entity: `x`, `y` and `z` in metres and a rotation quaternion (`qx`, `qy`,
`qz`, `qw`). Position is 0 and the rotation is the identity unless given.

```ts
function transform3d(at?: {
  x?: number;
  y?: number;
  z?: number;
  qx?: number;
  qy?: number;
  qz?: number;
  qw?: number;
}): SpawnPart;
```

#### `Transform3D` (const)

Position in metres and rotation as a unit quaternion. Rendered.

```ts
const Transform3D: ComponentDef<typeof transformFields>;
```

## `@automata/puzzle`

### `import { … } from '@automata/puzzle'`

#### `Action` (interface)

One thing the player can do at a hotspot: where it is aimed (`at`), the item or pair of items it
uses, the conditions that must hold, its effects, the line said and how many seconds it takes.

```ts
interface Action {
  readonly id: string;
  readonly at: VerbAt;
  readonly use?: string | readonly [string, string] | undefined;
  readonly when?: readonly Cond[] | undefined;
  readonly then: readonly Effect[];
  readonly say: string;
  readonly seconds?: number | undefined;
}
```

#### `Cond` (type)

A condition on the puzzle's state. It asks that a fact is a value or within `atLeast` and
`atMost`, that an item is carried (`has`), that another condition does not hold (`not`), or that
any of a list holds (`any`).

```ts
type Cond = {
  readonly fact: string;
  readonly is?: Value | undefined;
  readonly atLeast?: number | undefined;
  readonly atMost?: number | undefined;
} | {
  readonly has: string;
} | {
  readonly not: Cond;
} | {
  readonly any: readonly Cond[];
};
```

#### `condSchema` (const)

The Zod schema of a condition.

```ts
const condSchema: z.ZodType<Cond>;
```

#### `createPuzzlePlugin` (function)

Makes the puzzle plugin with the game's options: its functions for `call` effects, where facts
live, and what hears noises, dialogues and cutscenes.

```ts
function createPuzzlePlugin(options?: PuzzleOptions): PluginDef;
```

#### `Effect` (type)

What an action does when it is taken: set or add to a fact, give or take an item, make a noise,
start a cutscene or a dialogue, mark a checkpoint, open the keypad, leave through an exit, or
call a function the game supplied.

```ts
type Effect = {
  readonly set: string;
  readonly to: Value;
} | {
  readonly add: string;
  readonly by: number;
} | {
  readonly give: string;
} | {
  readonly take: string;
} | {
  readonly noise: {
    readonly at: Point | string;
    readonly loudness: number;
    readonly kind: string;
  };
} | {
  readonly cutscene: string;
} | {
  readonly checkpoint: true;
} | {
  readonly keypad: true;
} | {
  readonly exit: {
    readonly to: string;
    readonly cutscene: string;
  };
} | {
  readonly dialogue: string;
} | {
  readonly call: string;
};
```

#### `effectSchema` (const)

The Zod schema of an effect.

```ts
const effectSchema: z.ZodType<Effect>;
```

#### `Entry` (interface)

A way into the scene: its name, the items the player arrives with and any facts it sets.

```ts
interface Entry {
  readonly name: string;
  readonly items: readonly string[];
  readonly facts?: Readonly<Record<string, Value>> | undefined;
}
```

#### `fallbackLine` (function)

The fallback line for a verb that matched nothing: per hotspot, then per verb kind, then `*` (codes have no `*`).

```ts
function fallbackLine(def: PuzzleDef, verb: Verb): string | undefined;
```

#### `holds` (function)

Whether a condition holds for this reader and verb. `held` and `code` are facts of the verb
itself.

```ts
function holds(reader: Reader, verb: Verb, c: Cond): boolean;
```

#### `Lethal` (interface)

A way to fail, with its rule and the hints that warn the player.

```ts
interface Lethal {
  readonly id: string;
  readonly rule: string;
  readonly hintedBy: readonly string[];
}
```

#### `loadPuzzle` (function)

Loads a scene's puzzle into the sim and starts the play state, at the named entry or the first
one.

```ts
function loadPuzzle(ctx: SimContext, def: PuzzleDef, entryName?: string): void;
```

#### `match` (const)

The first action, in content order, aimed where the verb is, using what it holds, whose conditions all hold.

```ts
const match: (def: PuzzleDef, reader: Reader, verb: Verb) => Action | undefined;
```

#### `Point` (interface)

A spot on the floor.

```ts
interface Point {
  readonly x: number;
  readonly z: number;
}
```

#### `PuzzleCall` (interface)

What a `{ call }` effect hands the game's function: the action and what the verb held or pointed at.

```ts
interface PuzzleCall {
  readonly action: string;
  readonly held: string | undefined;
  readonly pair: readonly [string, string] | undefined;
  readonly point: {
    readonly x: number;
    readonly z: number;
  } | undefined;
}
```

#### `PuzzleCheckOptions` (interface)

What the content checks need to know about the game: the `call` names it declares and the
extensions it registers.

```ts
interface PuzzleCheckOptions {
  /** The `{ call }` names the game declares (its `calls` option). */
  readonly calls: readonly string[];
  /** The extensions the game registers, by name. */
  readonly extensions: readonly string[];
}
```

#### `PuzzleCheckpoint` (const)

An action marks a checkpoint. The game decides what that saves.

```ts
const PuzzleCheckpoint: EventDef<z.ZodType<Empty>>;
```

#### `puzzleContent` (const)

The `puzzle` content kind: `content/puzzles/*.toml`, one puzzle per scene.

```ts
const puzzleContent: (options: PuzzleCheckOptions) => ContentSchemaDef<"puzzle", z.ZodType<PuzzleDef>>;
```

#### `PuzzleCutscene` (const)

An action asks for a cutscene, by id.

```ts
const PuzzleCutscene: EventDef<z.ZodType<IdPayload>>;
```

#### `PuzzleDebugSummary` (interface)

What the debug summary shows: whether the goal is reached, the items carried, how many actions
were seen and the facts.

```ts
interface PuzzleDebugSummary {
  readonly goal: boolean;
  readonly items: string;
  readonly seen: number;
  readonly facts: Readonly<Record<string, Value>>;
}
```

#### `puzzleDebugSummary` (function)

Turns the puzzle's play state into a summary for the debug overlay.

```ts
function puzzleDebugSummary(state: PuzzleStateValue): PuzzleDebugSummary;
```

#### `PuzzleDef` (interface)

One scene's puzzle: its facts and items, where its hotspots are, the ways in, the actions, the
systemic solutions and lethal rules, the goal and the fallback lines for verbs that match
nothing.

```ts
interface PuzzleDef {
  readonly scene: string;
  readonly facts: Readonly<Record<string, Value>>;
  readonly items: readonly string[];
  readonly hotspots: Readonly<Record<string, Point>>;
  readonly entry: readonly Entry[];
  readonly actions: readonly Action[];
  readonly systemic: readonly Systemic[];
  readonly lethal: readonly Lethal[];
  readonly goal: readonly Cond[];
  readonly fallback: Readonly<Record<string, string>>;
}
```

#### `puzzleDefShape` (const)

The Zod schema of a puzzle's shape, without the cross-checks that `puzzleSchema` adds.

```ts
const puzzleDefShape: z.ZodType<PuzzleDef>;
```

#### `PuzzleDialogue` (const)

An action asks for a dialogue, by id.

```ts
const PuzzleDialogue: EventDef<z.ZodType<IdPayload>>;
```

#### `PuzzleExit` (const)

An action leaves the scene for another, with the cutscene to play on the way.

```ts
const PuzzleExit: EventDef<z.ZodType<ExitPayload>>;
```

#### `puzzleExtension` (const)

The puzzle extension a game opts into. It adds the puzzle plugin and the `puzzle` content kind
from one set of options.

```ts
const puzzleExtension: (options: PuzzleExtensionOptions) => ExtensionDef<"puzzle">;
```

#### `PuzzleExtensionOptions` (interface)

The puzzle's options plus the names of the extensions the game registers, so an effect that
needs a missing one fails when content compiles.

```ts
interface PuzzleExtensionOptions extends PuzzleOptions {
  /** The extensions the game registers, so an effect that needs a missing one fails when content compiles. */
  readonly extensions: readonly string[];
}
```

#### `PuzzleGave` (const)

The player was given an item.

```ts
const PuzzleGave: EventDef<z.ZodType<GavePayload>>;
```

#### `PuzzleGoal` (const)

The puzzle's goal now holds. It is sent once.

```ts
const PuzzleGoal: EventDef<z.ZodType<Empty>>;
```

#### `PuzzleKeypad` (const)

An action opens the keypad. The game shows it and sends the typed code back as a verb.

```ts
const PuzzleKeypad: EventDef<z.ZodType<Empty>>;
```

#### `PuzzleNoise` (const)

An action made a noise at a place, with its loudness and kind. The systems extension listens.

```ts
const PuzzleNoise: EventDef<z.ZodType<NoisePayload>>;
```

#### `PuzzleOptions` (interface)

How a game wires the puzzle to the rest of itself: the functions `call` effects run, where it
keeps its own facts, and what hears noises, dialogues and cutscenes. `locked` ignores verbs
while a cutscene plays, and `verb` is told of every verb once it has run.

```ts
interface PuzzleOptions {
  /**
   * The game's functions for `{ call }` effects, by name. They run inside the verb system, on the verb's step, so
   * they may change sim state like any system (P6-D2 as built: the sim has no reading of a step's own events).
   */
  readonly calls?: Readonly<Record<string, (ctx: SimContext, call: PuzzleCall) => void>>;
  /**
   * Facts the game keeps in its own fields: `get` returns undefined for a fact it does not map, and `set` returns false
   * for one; those facts live in `puzzle.state`.
   */
  readonly facts?: {
    get(ctx: SimContext, name: string): Value | undefined;
    set(ctx: SimContext, name: string, value: Value): boolean;
  };
  /**
   * Where a `noise` effect is heard, on the verb's step (the `systems` extension's `hear`, SY-D2). `puzzle.noise` is
   * emitted either way, for presentation.
   */
  readonly noise?: (ctx: SimContext, noise: {
    readonly at: {
      readonly x: number;
      readonly z: number;
    };
    readonly loudness: number;
    readonly kind: string;
  }) => void;
  /**
   * Where a `{ dialogue }` effect starts its graph, on the verb's step and after the action's line (the `narrative`
   * extension's `startDialogue`, NR-D3). `puzzle.dialogue` is emitted either way.
   */
  readonly dialogue?: (ctx: SimContext, id: string) => void;
  /**
   * Where a `{ cutscene }` effect starts its cutscene, on the verb's step and after the action's line (the `cutscenes`
   * extension's `start`, as `dialogue`). `puzzle.cutscene` is emitted either way.
   */
  readonly cutscene?: (ctx: SimContext, id: string) => void;
  /** While this holds (a cutscene is playing), verbs are ignored (the `cutscenes` extension's `locked`). */
  readonly locked?: (ctx: SimContext) => boolean;
  /**
   * Told of every verb once it has run, taken or not (the `narrative` extension's inspect storylets, NR-D3): the
   * action taken or null, whether a line was said, and whether the action turned away to a cutscene, dialogue, keypad
   * or exit.
   */
  readonly verb?: (ctx: SimContext, report: VerbReport) => void;
}
```

#### `puzzlePlugin` (const)

The puzzle plugin with no options.

```ts
const puzzlePlugin: PluginDef;
```

#### `PuzzleSaid` (const)

A verb was answered: the action applied (null for a fallback line), where, the line key and the
items gained. It carries keys, never text.

```ts
const PuzzleSaid: EventDef<z.ZodType<SaidPayload>>;
```

#### `PuzzleSceneResource` (const)

The scene's puzzle as content gives it. `def` is null until the game loads a scene's puzzle.

```ts
const PuzzleSceneResource: ResourceDef<z.ZodType<PuzzleScene>>;
```

#### `puzzleSchema` (const)

The Zod schema of a puzzle with all its cross-checks: every item, fact, call and extension an
action names must exist.

```ts
const puzzleSchema: (options: PuzzleCheckOptions) => z.ZodType<PuzzleDef>;
```

#### `PuzzleState` (const)

Facts, carried items (sorted), the ids of actions applied so far, and whether `puzzle.goal` was emitted.

```ts
const PuzzleState: ResourceDef<z.ZodType<PuzzleStateValue>>;
```

#### `Reader` (interface)

What a condition reads: a fact by name and whether an item is carried.

```ts
interface Reader {
  fact(name: string): Value | undefined;
  has(item: string): boolean;
}
```

#### `Systemic` (interface)

A way of solving the puzzle that no single action shows, with a note, the conditions it enables,
the actions that lead to it and any risk (`lethal` or `chase`).

```ts
interface Systemic {
  readonly id: string;
  readonly note: string;
  readonly enables: readonly Cond[];
  readonly via: readonly string[];
  readonly risk?: "lethal" | "chase" | undefined;
}
```

#### `uses` (function)

A pair matches in either order; a single `use` is the first of a pair, or the held item.

```ts
function uses(action: Action, verb: Verb): boolean;
```

#### `Value` (type)

A fact's value: a yes-or-no, a number or text.

```ts
type Value = boolean | number | string;
```

#### `valueSchema` (const)

The Zod schema of a fact's value.

```ts
const valueSchema: z.ZodType<Value>;
```

#### `Verb` (interface)

What the player did, as the interpreter reads it: where it is aimed, the item held, a pair of
items, a typed code or a floor point.

```ts
interface Verb {
  readonly at: string;
  readonly held?: string | undefined;
  readonly pair?: readonly [string, string] | undefined;
  readonly code?: string | undefined;
  readonly point?: {
    readonly x: number;
    readonly z: number;
  } | undefined;
}
```

#### `VerbCommand` (const)

A verb: what the player did, sent by the game once its walker is in reach. `at` is a hotspot id,
or `combine`, `floor` or `code`; `held` is the item in hand, `pair` two items combined, `code` a
typed code and `point` a floor point.

```ts
const VerbCommand: CommandDef<z.ZodType<VerbPayload>>;
```

#### `VerbReport` (interface)

What happened to one verb: where it was aimed, the item held, the action taken (null for none),
whether a line was said and whether the action turned away to a cutscene, dialogue, keypad or
exit.

```ts
interface VerbReport {
  readonly at: string;
  readonly held: string | undefined;
  readonly action: string | null;
  readonly said: boolean;
  readonly away: boolean;
}
```

### `import { … } from '@automata/puzzle/sim'`

#### `Action` (interface)

One thing the player can do at a hotspot: where it is aimed (`at`), the item or pair of items it
uses, the conditions that must hold, its effects, the line said and how many seconds it takes.

```ts
interface Action {
  readonly id: string;
  readonly at: VerbAt;
  readonly use?: string | readonly [string, string] | undefined;
  readonly when?: readonly Cond[] | undefined;
  readonly then: readonly Effect[];
  readonly say: string;
  readonly seconds?: number | undefined;
}
```

#### `Cond` (type)

A condition on the puzzle's state. It asks that a fact is a value or within `atLeast` and
`atMost`, that an item is carried (`has`), that another condition does not hold (`not`), or that
any of a list holds (`any`).

```ts
type Cond = {
  readonly fact: string;
  readonly is?: Value | undefined;
  readonly atLeast?: number | undefined;
  readonly atMost?: number | undefined;
} | {
  readonly has: string;
} | {
  readonly not: Cond;
} | {
  readonly any: readonly Cond[];
};
```

#### `condSchema` (const)

The Zod schema of a condition.

```ts
const condSchema: z.ZodType<Cond>;
```

#### `createPuzzlePlugin` (function)

Makes the puzzle plugin with the game's options: its functions for `call` effects, where facts
live, and what hears noises, dialogues and cutscenes.

```ts
function createPuzzlePlugin(options?: PuzzleOptions): PluginDef;
```

#### `Effect` (type)

What an action does when it is taken: set or add to a fact, give or take an item, make a noise,
start a cutscene or a dialogue, mark a checkpoint, open the keypad, leave through an exit, or
call a function the game supplied.

```ts
type Effect = {
  readonly set: string;
  readonly to: Value;
} | {
  readonly add: string;
  readonly by: number;
} | {
  readonly give: string;
} | {
  readonly take: string;
} | {
  readonly noise: {
    readonly at: Point | string;
    readonly loudness: number;
    readonly kind: string;
  };
} | {
  readonly cutscene: string;
} | {
  readonly checkpoint: true;
} | {
  readonly keypad: true;
} | {
  readonly exit: {
    readonly to: string;
    readonly cutscene: string;
  };
} | {
  readonly dialogue: string;
} | {
  readonly call: string;
};
```

#### `effectSchema` (const)

The Zod schema of an effect.

```ts
const effectSchema: z.ZodType<Effect>;
```

#### `Entry` (interface)

A way into the scene: its name, the items the player arrives with and any facts it sets.

```ts
interface Entry {
  readonly name: string;
  readonly items: readonly string[];
  readonly facts?: Readonly<Record<string, Value>> | undefined;
}
```

#### `fallbackLine` (function)

The fallback line for a verb that matched nothing: per hotspot, then per verb kind, then `*` (codes have no `*`).

```ts
function fallbackLine(def: PuzzleDef, verb: Verb): string | undefined;
```

#### `holds` (function)

Whether a condition holds for this reader and verb. `held` and `code` are facts of the verb
itself.

```ts
function holds(reader: Reader, verb: Verb, c: Cond): boolean;
```

#### `Lethal` (interface)

A way to fail, with its rule and the hints that warn the player.

```ts
interface Lethal {
  readonly id: string;
  readonly rule: string;
  readonly hintedBy: readonly string[];
}
```

#### `loadPuzzle` (function)

Loads a scene's puzzle into the sim and starts the play state, at the named entry or the first
one.

```ts
function loadPuzzle(ctx: SimContext, def: PuzzleDef, entryName?: string): void;
```

#### `match` (const)

The first action, in content order, aimed where the verb is, using what it holds, whose conditions all hold.

```ts
const match: (def: PuzzleDef, reader: Reader, verb: Verb) => Action | undefined;
```

#### `Point` (interface)

A spot on the floor.

```ts
interface Point {
  readonly x: number;
  readonly z: number;
}
```

#### `PuzzleCall` (interface)

What a `{ call }` effect hands the game's function: the action and what the verb held or pointed at.

```ts
interface PuzzleCall {
  readonly action: string;
  readonly held: string | undefined;
  readonly pair: readonly [string, string] | undefined;
  readonly point: {
    readonly x: number;
    readonly z: number;
  } | undefined;
}
```

#### `PuzzleCheckpoint` (const)

An action marks a checkpoint. The game decides what that saves.

```ts
const PuzzleCheckpoint: EventDef<z.ZodType<Empty>>;
```

#### `PuzzleCutscene` (const)

An action asks for a cutscene, by id.

```ts
const PuzzleCutscene: EventDef<z.ZodType<IdPayload>>;
```

#### `PuzzleDebugSummary` (interface)

What the debug summary shows: whether the goal is reached, the items carried, how many actions
were seen and the facts.

```ts
interface PuzzleDebugSummary {
  readonly goal: boolean;
  readonly items: string;
  readonly seen: number;
  readonly facts: Readonly<Record<string, Value>>;
}
```

#### `puzzleDebugSummary` (function)

Turns the puzzle's play state into a summary for the debug overlay.

```ts
function puzzleDebugSummary(state: PuzzleStateValue): PuzzleDebugSummary;
```

#### `PuzzleDef` (interface)

One scene's puzzle: its facts and items, where its hotspots are, the ways in, the actions, the
systemic solutions and lethal rules, the goal and the fallback lines for verbs that match
nothing.

```ts
interface PuzzleDef {
  readonly scene: string;
  readonly facts: Readonly<Record<string, Value>>;
  readonly items: readonly string[];
  readonly hotspots: Readonly<Record<string, Point>>;
  readonly entry: readonly Entry[];
  readonly actions: readonly Action[];
  readonly systemic: readonly Systemic[];
  readonly lethal: readonly Lethal[];
  readonly goal: readonly Cond[];
  readonly fallback: Readonly<Record<string, string>>;
}
```

#### `puzzleDefShape` (const)

The Zod schema of a puzzle's shape, without the cross-checks that `puzzleSchema` adds.

```ts
const puzzleDefShape: z.ZodType<PuzzleDef>;
```

#### `PuzzleDialogue` (const)

An action asks for a dialogue, by id.

```ts
const PuzzleDialogue: EventDef<z.ZodType<IdPayload>>;
```

#### `PuzzleExit` (const)

An action leaves the scene for another, with the cutscene to play on the way.

```ts
const PuzzleExit: EventDef<z.ZodType<ExitPayload>>;
```

#### `PuzzleGave` (const)

The player was given an item.

```ts
const PuzzleGave: EventDef<z.ZodType<GavePayload>>;
```

#### `PuzzleGoal` (const)

The puzzle's goal now holds. It is sent once.

```ts
const PuzzleGoal: EventDef<z.ZodType<Empty>>;
```

#### `PuzzleKeypad` (const)

An action opens the keypad. The game shows it and sends the typed code back as a verb.

```ts
const PuzzleKeypad: EventDef<z.ZodType<Empty>>;
```

#### `PuzzleNoise` (const)

An action made a noise at a place, with its loudness and kind. The systems extension listens.

```ts
const PuzzleNoise: EventDef<z.ZodType<NoisePayload>>;
```

#### `PuzzleOptions` (interface)

How a game wires the puzzle to the rest of itself: the functions `call` effects run, where it
keeps its own facts, and what hears noises, dialogues and cutscenes. `locked` ignores verbs
while a cutscene plays, and `verb` is told of every verb once it has run.

```ts
interface PuzzleOptions {
  /**
   * The game's functions for `{ call }` effects, by name. They run inside the verb system, on the verb's step, so
   * they may change sim state like any system (P6-D2 as built: the sim has no reading of a step's own events).
   */
  readonly calls?: Readonly<Record<string, (ctx: SimContext, call: PuzzleCall) => void>>;
  /**
   * Facts the game keeps in its own fields: `get` returns undefined for a fact it does not map, and `set` returns false
   * for one; those facts live in `puzzle.state`.
   */
  readonly facts?: {
    get(ctx: SimContext, name: string): Value | undefined;
    set(ctx: SimContext, name: string, value: Value): boolean;
  };
  /**
   * Where a `noise` effect is heard, on the verb's step (the `systems` extension's `hear`, SY-D2). `puzzle.noise` is
   * emitted either way, for presentation.
   */
  readonly noise?: (ctx: SimContext, noise: {
    readonly at: {
      readonly x: number;
      readonly z: number;
    };
    readonly loudness: number;
    readonly kind: string;
  }) => void;
  /**
   * Where a `{ dialogue }` effect starts its graph, on the verb's step and after the action's line (the `narrative`
   * extension's `startDialogue`, NR-D3). `puzzle.dialogue` is emitted either way.
   */
  readonly dialogue?: (ctx: SimContext, id: string) => void;
  /**
   * Where a `{ cutscene }` effect starts its cutscene, on the verb's step and after the action's line (the `cutscenes`
   * extension's `start`, as `dialogue`). `puzzle.cutscene` is emitted either way.
   */
  readonly cutscene?: (ctx: SimContext, id: string) => void;
  /** While this holds (a cutscene is playing), verbs are ignored (the `cutscenes` extension's `locked`). */
  readonly locked?: (ctx: SimContext) => boolean;
  /**
   * Told of every verb once it has run, taken or not (the `narrative` extension's inspect storylets, NR-D3): the
   * action taken or null, whether a line was said, and whether the action turned away to a cutscene, dialogue, keypad
   * or exit.
   */
  readonly verb?: (ctx: SimContext, report: VerbReport) => void;
}
```

#### `puzzlePlugin` (const)

The puzzle plugin with no options.

```ts
const puzzlePlugin: PluginDef;
```

#### `PuzzleSaid` (const)

A verb was answered: the action applied (null for a fallback line), where, the line key and the
items gained. It carries keys, never text.

```ts
const PuzzleSaid: EventDef<z.ZodType<SaidPayload>>;
```

#### `PuzzleSceneResource` (const)

The scene's puzzle as content gives it. `def` is null until the game loads a scene's puzzle.

```ts
const PuzzleSceneResource: ResourceDef<z.ZodType<PuzzleScene>>;
```

#### `PuzzleState` (const)

Facts, carried items (sorted), the ids of actions applied so far, and whether `puzzle.goal` was emitted.

```ts
const PuzzleState: ResourceDef<z.ZodType<PuzzleStateValue>>;
```

#### `Reader` (interface)

What a condition reads: a fact by name and whether an item is carried.

```ts
interface Reader {
  fact(name: string): Value | undefined;
  has(item: string): boolean;
}
```

#### `Systemic` (interface)

A way of solving the puzzle that no single action shows, with a note, the conditions it enables,
the actions that lead to it and any risk (`lethal` or `chase`).

```ts
interface Systemic {
  readonly id: string;
  readonly note: string;
  readonly enables: readonly Cond[];
  readonly via: readonly string[];
  readonly risk?: "lethal" | "chase" | undefined;
}
```

#### `uses` (function)

A pair matches in either order; a single `use` is the first of a pair, or the held item.

```ts
function uses(action: Action, verb: Verb): boolean;
```

#### `Value` (type)

A fact's value: a yes-or-no, a number or text.

```ts
type Value = boolean | number | string;
```

#### `valueSchema` (const)

The Zod schema of a fact's value.

```ts
const valueSchema: z.ZodType<Value>;
```

#### `Verb` (interface)

What the player did, as the interpreter reads it: where it is aimed, the item held, a pair of
items, a typed code or a floor point.

```ts
interface Verb {
  readonly at: string;
  readonly held?: string | undefined;
  readonly pair?: readonly [string, string] | undefined;
  readonly code?: string | undefined;
  readonly point?: {
    readonly x: number;
    readonly z: number;
  } | undefined;
}
```

#### `VerbCommand` (const)

A verb: what the player did, sent by the game once its walker is in reach. `at` is a hotspot id,
or `combine`, `floor` or `code`; `held` is the item in hand, `pair` two items combined, `code` a
typed code and `point` a floor point.

```ts
const VerbCommand: CommandDef<z.ZodType<VerbPayload>>;
```

#### `VerbReport` (interface)

What happened to one verb: where it was aimed, the item held, the action taken (null for none),
whether a line was said and whether the action turned away to a cutscene, dialogue, keypad or
exit.

```ts
interface VerbReport {
  readonly at: string;
  readonly held: string | undefined;
  readonly action: string | null;
  readonly said: boolean;
  readonly away: boolean;
}
```

### `import { … } from '@automata/puzzle/solver'`

#### `analyse` (function)

Solves a scene and checks its softlocks, hints and key-sets. `entry` limits it to one way in,
and `softlocks: false` skips the softlock search.

```ts
function analyse(p: PuzzleScene, opts?: {
  entry?: string;
  softlocks?: boolean;
}): Analysis;
```

#### `Analysis` (interface)

Everything the tools learn about one scene: the solve, its routes, the softlocks, the hint
checks and the key-sets.

```ts
interface Analysis {
  readonly solve: SolveResult;
  readonly routes: readonly Route[];
  readonly softlocks: Softlocks;
  readonly hints: readonly HintResult[];
  /** The key-sets the design asks for (the model's `keys`), each with its route. */
  readonly keys: readonly KeyResult[];
}
```

#### `applyEffect` (function)

Applies plain effects (set, add, give, take); everything else is presentation or handled by the model.

```ts
function applyEffect(s: State, e: Effect): void;
```

#### `budget` (function)

Seconds for a solution: action time plus walking between hotspots at `speed` m/s; a code is typed at `keypad`.

```ts
function budget(solution: Solution, walk: Walk, speed?: number, keypad?: string): Budget;
```

#### `Budget` (interface)

The time a solution takes: the seconds of actions, the seconds of walking and the total.

```ts
interface Budget {
  readonly actions: number;
  readonly walking: number;
  readonly total: number;
}
```

#### `condFacts` (const)

The names of the facts a condition reads.

```ts
const condFacts: (c: Cond) => string[];
```

#### `condItems` (const)

The names of the items a condition asks about.

```ts
const condItems: (c: Cond) => string[];
```

#### `createSolver` (function)

Makes a solver for a puzzle and the model of what its `call` effects do.

```ts
function createSolver(def: PuzzleDef, model?: PuzzleModel): Solver;
```

#### `describe` (function)

What the player does for a step, in words.

```ts
function describe(p: PuzzleScene, step: Step): string;
```

#### `DOC` (const)

The name of the generated doc file, `puzzle.md`.

```ts
const DOC = "puzzle.md";
```

#### `Finding` (interface)

One problem the checks found: an error or a warning, the rule it breaks, what it is about and
the detail.

```ts
interface Finding {
  readonly level: "error" | "warning";
  readonly rule: string;
  readonly id: string;
  readonly detail: string;
}
```

#### `GOAL` (const)

The name of the lock graph's last node, the goal.

```ts
const GOAL = "goal";
```

#### `HintResult` (interface)

Whether the hints on one lethal rule hold: its id, whether they do and what failed.

```ts
interface HintResult {
  readonly id: string;
  readonly ok: boolean;
  readonly failures: readonly string[];
}
```

#### `holds` (const)

Whether a condition holds in a solver state, with the item held and the code typed.

```ts
const holds: (s: State, c: Cond, held?: string, code?: string) => boolean;
```

#### `KeyDecl` (interface)

A key-set the design asks for: the shortest solution with the actions in `ban` banned must take
every action in `uses` to open `lock` with `key`, optionally from one entry.

```ts
interface KeyDecl {
  readonly lock: string;
  readonly key: string;
  readonly uses: readonly string[];
  readonly ban?: readonly string[] | undefined;
  readonly entry?: string | undefined;
}
```

#### `keypadOf` (const)

The hotspot a code is typed at: the one whose action opens the keypad.

```ts
const keypadOf: (p: PuzzleScene) => string | undefined;
```

#### `KeyResult` (interface)

A key-set check: the declaration, the shortest solution found with its actions banned, whether
it used every action asked for, and which it missed.

```ts
interface KeyResult extends KeyDecl {
  readonly solution: Solution | null;
  readonly ok: boolean;
  readonly missing: readonly string[];
}
```

#### `keySet` (const)

A solution's distinct action ids, sorted and joined, to tell routes apart.

```ts
const keySet: (s: Solution) => string;
```

#### `LockEdge` (interface)

One arrow of the lock graph: from one lock or item to another, with the action that gets there.

```ts
interface LockEdge {
  readonly from: string;
  readonly to: string;
  readonly label: string;
}
```

#### `lockGraph` (function)

Draws which things unlock which for a scene's routes, as nodes and labelled edges.

```ts
function lockGraph(p: PuzzleScene, routes: readonly Route[]): {
  nodes: string[];
  edges: LockEdge[];
};
```

#### `matrix` (function)

Builds the item by hotspot table of a puzzle.

```ts
function matrix(def: PuzzleDef): Matrix;
```

#### `Matrix` (interface)

The item by hotspot table of a puzzle: for each item and hotspot, its own actions, a response
whatever is held, or the fallback line, plus the item pairs that combine.

```ts
interface Matrix {
  readonly hotspots: readonly string[];
  /** Per item, per hotspot: its own actions, `any` (a response whatever is held) or `fallback`. */
  readonly rows: readonly {
    item: string;
    cells: Record<string, string>;
  }[];
  readonly combines: readonly {
    pair: readonly [string, string];
    action: string;
  }[];
}
```

#### `PuzzleModel` (interface)

What data cannot say about a scene, for the solver: what each `call` effect does, extra facts,
solver-only effects and conditions, what time does after a step, which hotspots exist in which
state, the key-sets the design asks for and how many states a search expands before it stops.

```ts
interface PuzzleModel {
  /** Extra facts the solver tracks, with their starting values. */
  readonly facts?: Readonly<Record<string, Value>> | undefined;
  /** What each `{ call }` does: the possible resulting states. */
  readonly calls?: Readonly<Record<string, (s: State, step: Step) => State[]>> | undefined;
  /** Solver-only effects after an action's own. */
  readonly effects?: Readonly<Record<string, readonly Effect[]>> | undefined;
  /** Solver-only conditions: the player can take this action only if these hold. */
  readonly require?: Readonly<Record<string, readonly Cond[]>> | undefined;
  /** What time does after any step; applied after the step's effects. */
  readonly after?: ((s: State, step: Step) => State) | undefined;
  /** Whether a hotspot exists in this state (default: always). */
  readonly available?: ((s: State, at: string) => boolean) | undefined;
  /** What a systemic set-up does when that depends on the state (default: it sets its `enables`). */
  readonly systemic?: Readonly<Record<string, (s: State) => State[]>> | undefined;
  /** Seconds an action takes when it gives none (default 2). */
  readonly seconds?: number | undefined;
  /** Calls whose result does not depend on the item in hand: such an action is tried once, bare-handed. */
  readonly pure?: readonly string[] | undefined;
  /** States a search expands before it stops as capped (default 200,000). */
  readonly cap?: number | undefined;
  /** The key-sets the design asks for: the shortest solution with `ban` banned must take every step in `uses`. */
  readonly keys?: readonly KeyDecl[] | undefined;
}
```

#### `PuzzleScene` (interface)

How a game plugs into the solver's tools: its puzzle, its solver model, the names for the
generated doc, where the player spawns, the game's text, its cutscene ids, how far apart its
hotspots are and the files the doc depends on. The tools never import a game.

```ts
interface PuzzleScene {
  readonly id: string;
  readonly def: PuzzleDef;
  readonly model: PuzzleModel;
  /** Hotspot names for the doc (the hotspots themselves are the puzzle's `hotspots`). */
  readonly names: Readonly<Record<string, string>>;
  readonly spawn: {
    readonly x: number;
    readonly z: number;
  };
  /** The game's text: line keys to text, item ids to names (the doc's words; a line key with no text fails `validate`). */
  readonly story: {
    readonly lines: Readonly<Record<string, string>>;
    readonly items: Readonly<Record<string, string>>;
  };
  /** The scene's cutscene ids. */
  readonly cutscenes: readonly string[];
  /** Metres walked between two hotspots (null: from the spawn), every door open. */
  readonly walk: Walk;
  /** The files the generated doc depends on, relative to the scene folder, with their XXH64 hashes (PZ-D4). */
  readonly sources: readonly {
    readonly path: string;
    readonly hash: string;
  }[];
}
```

#### `renderDoc` (function)

Writes a scene's puzzle doc as Markdown from its analysis: the hotspots, the item table, the
routes with their times, the softlocks and the lock graph.

```ts
function renderDoc(p: PuzzleScene, x: Analysis): string;
```

#### `Route` (interface)

One way through the puzzle: a name, the action banned to find it (null for the shortest) and its
solution.

```ts
interface Route {
  readonly name: string;
  readonly banned: string | null;
  readonly solution: Solution;
}
```

#### `routesOf` (function)

The shortest solution, then one per distinct key-set among the alternatives, in the solver's order.

```ts
function routesOf(result: SolveResult): Route[];
```

#### `showCond` (function)

A condition in words, for the generated doc.

```ts
function showCond(c: Cond): string;
```

#### `showEffect` (function)

An effect in words, for the generated doc.

```ts
function showEffect(e: Effect): string;
```

#### `Softlocks` (interface)

The states from which the goal can no longer be reached, with the trail to each, and the actions
that change something but are never taken in any reachable state.

```ts
interface Softlocks {
  readonly states: number;
  readonly capped: boolean;
  readonly count: number;
  readonly softlocks: readonly {
    entry: string;
    trail: string[];
    facts: Record<string, Value>;
    items: string[];
  }[];
  /** Actions that change something but are never taken in any reachable state. */
  readonly never: readonly string[];
}
```

#### `Solution` (interface)

A route through the puzzle: the entry it starts from, the steps in order and the seconds they
take.

```ts
interface Solution {
  readonly entry: string;
  readonly steps: readonly Step[];
  readonly seconds: number;
}
```

#### `Solver` (interface)

Searches a puzzle's states: pick the action a verb resolves to, list the verbs, step, test for
the goal, find the shortest solution, look for softlocks and check hints.

```ts
interface Solver {
  /** The action the game would pick for this verb, or null for its fallback line. */
  match(s: State, at: string, held?: string, pair?: readonly [string, string], code?: string): Action | null;
  verbs(s: State, banned: ReadonlySet<string>): Verb[];
  next(s: State, step: Step, action: Action | null): State[];
  isGoal(s: State): boolean;
  start(entry: PuzzleDef["entry"][number]): State;
  keys(): KeyResult[];
  solve(): SolveResult;
  softlocks(limit?: number): Softlocks;
  states(sol: Solution): State[];
  hints(solutions: readonly Solution[]): HintResult[];
}
```

#### `SolveResult` (interface)

What solving found: whether the puzzle can be solved, how many states were searched, whether the
search was capped, the shortest solution, one alternative for each action of it banned in turn,
and the distinct sets of actions used.

```ts
interface SolveResult {
  readonly solvable: boolean;
  readonly states: number;
  readonly capped: boolean;
  readonly shortest: Solution | null;
  /** One solution per alternative: banning each action of the shortest solution in turn. */
  readonly alternatives: readonly {
    readonly banned: string;
    readonly solution: Solution | null;
  }[];
  /** Distinct sets of action ids across the shortest solution and the alternatives. */
  readonly keySets: readonly (readonly string[])[];
}
```

#### `stamp` (const)

The line that records which source files the generated doc was made from, with their hashes.

```ts
const stamp: (p: PuzzleScene) => string;
```

#### `State` (interface)

The puzzle's facts, the player's items (a multiset) and which systemic set-ups have happened.

```ts
interface State {
  facts: Record<string, Value>;
  items: string[];
  seen: string[];
}
```

#### `Step` (interface)

A verb as the player makes it: a hotspot with a held item (or a bare hand), a floor use, a combine, a typed code.

```ts
interface Step {
  readonly action: string;
  readonly at: string;
  readonly held?: string | undefined;
  readonly pair?: readonly [string, string] | undefined;
  readonly code?: string | undefined;
  /** A systemic set-up (`systemic:<id>`), not a verb. */
  readonly systemic?: boolean | undefined;
}
```

#### `timing` (const)

The seconds a solution takes: its actions plus walking between hotspots.

```ts
const timing: (p: PuzzleScene, solution: Solution) => Budget;
```

#### `used` (const)

The items an action uses: none, one, or both of a pair.

```ts
const used: (a: Action) => string[];
```

#### `validate` (function)

Checks a scene's puzzle for mistakes the schema cannot see, such as a line with no text or an
item nothing gives. Returns the findings.

```ts
function validate(p: PuzzleScene): Finding[];
```

#### `Verb` (interface)

A verb the player can make in a state, with the action it resolves to.

```ts
interface Verb {
  readonly step: Step;
  readonly action: Action | null;
}
```

#### `Walk` (type)

Metres walked between two hotspots (null: from the spawn).

```ts
type Walk = (from: string | null, to: string) => number;
```

## `@automata/sim`

### `import { … } from '@automata/sim'`

#### `canonicalJson` (function)

Canonical JSON: object keys sorted at every depth, no whitespace. Numbers use the ECMAScript
Number-to-string algorithm, which every engine implements identically, except that -0 is written as -0.
Throws CanonicalJsonError for anything JSON can't represent exactly: NaN, Infinity, undefined, bigint,
functions, symbols, and non-plain objects (a Date, Map, Set, typed array or class instance would otherwise
serialize as {} and hash the same as every other one).

```ts
function canonicalJson(value: unknown): string;
```

#### `CanonicalJsonError` (class)

A value canonical JSON cannot represent exactly; hashing it anyway would let different values collide.

```ts
class CanonicalJsonError extends Error {
  constructor(message: string);
}
```

#### `Command` (interface)

Input to the sim, the only way gameplay state changes from outside. `source` is a player slot (u8), `seq` a per-source counter (u32).

```ts
interface Command {
  readonly tick: number;
  readonly source: number;
  readonly seq: number;
  readonly type: string;
  readonly payload: unknown;
}
```

#### `CommandDef` (interface)

A command the sim accepts as input: an id and the Zod schema its payload must match. Create one with
`defineCommand`.

```ts
interface CommandDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: "command";
  readonly id: string;
  readonly schema: Z;
}
```

#### `CommandRecord` (interface)

A command as a system reads it this tick: the player slot that sent it (`source`), its per-source `seq` and
its parsed `payload`.

```ts
interface CommandRecord<P> {
  readonly source: number;
  readonly seq: number;
  readonly payload: P;
}
```

#### `ComponentDef` (interface)

A component: a stable id and a flat record of typed fields. Create one with `defineComponent`; game code
addresses entity data through the definition, never through `trait`.

```ts
interface ComponentDef<S extends FieldSchema = FieldSchema> {
  readonly kind: "component";
  readonly id: string;
  readonly fields: S;
  /** Field names in sorted order: the order used by snapshots. */
  readonly fieldNames: readonly string[];
  /** Included in RenderDelta rows (default true). */
  readonly render: boolean;
  /** Internal Koota storage. Game code never touches it. */
  readonly trait: Trait;
}
```

#### `createRng` (function)

A generator seeded from `seed` (through splitmix32): the same seed gives the same sequence in every engine.

```ts
function createRng(seed: number): Rng;
```

#### `createSim` (function)

Creates a sim from its plugins, seed and content; async, because a plugin may create engine state (a Rapier
world). Throws for a bad `tickHz`, a duplicate definition, an unknown plugin dependency or system ordering
reference, an ordering cycle, a system name the sim reserves, or an invalid resource start. If a plugin's
engine fails to start, the engines already created are disposed first.

```ts
function createSim(opts: SimOptions): Promise<Sim>;
```

#### `Def` (type)

Anything `definePlugin`'s flat `defs` list takes.

```ts
type Def = ComponentDef | CommandDef | EventDef | ResourceDef | SystemDef;
```

#### `defineCommand` (function)

Defines a command by id and payload schema. Throws for an id that is not lower-case words separated by dots
or dashes.

```ts
function defineCommand<Z extends z.ZodType>(id: string, schema: Z): CommandDef<Z>;
```

#### `defineComponent` (function)

Defines a component from an id (lower-case words separated by dots or dashes) and its fields by name and
type. `render: false` keeps it out of the renderer's deltas. Throws for a bad id, no fields, a bad field
name or an unknown field type.

```ts
function defineComponent<S extends FieldSchema>(id: string, fields: S, opts?: {
  render?: boolean;
}): ComponentDef<S>;
```

#### `defineEvent` (function)

Defines an event by id and payload schema, to emit from a system with `ctx.emit`. Events come back in
`StepResult.events`; `ctx.emit` throws for a payload that fails the schema.

```ts
function defineEvent<Z extends z.ZodType>(id: string, schema: Z): EventDef<Z>;
```

#### `definePlugin` (function)

Defines a plugin from a name, its dependencies and its definitions, given in the keyed lists or in one flat
`defs` list sorted by kind. A plugin written either way registers the same lists and gets the same schema
hash. `config` is copied as canonical, frozen JSON, so anything that cannot hash exactly throws a
`CanonicalJsonError` here.

```ts
function definePlugin(spec: {
  name: string;
  dependsOn?: readonly string[];
  /** One flat list, sorted into the keyed lists by `kind`; each entry follows that list's keyed entries. */
  defs?: readonly Def[];
  components?: readonly ComponentDef[];
  commands?: readonly CommandDef[];
  events?: readonly EventDef[];
  resources?: readonly ResourceDef[];
  systems?: readonly SystemDef[];
  state?: (setup: PluginStateSetup) => Promise<PluginState>;
  config?: unknown;
}): PluginDef;
```

#### `defineResource` (function)

Defines a resource by id, schema and starting value. `createSim` parses `init()` with the schema, so a bad
start fails there.

```ts
function defineResource<Z extends z.ZodType>(id: string, schema: Z, init: () => z.input<Z>): ResourceDef<Z>;
```

#### `defineSystem` (function)

A system: `defineSystem(name, run)` runs in `gameplay`, `defineSystem(name, phase, run)` in that phase, and the
object form also takes `before`/`after`. All three build the same SystemDef.

```ts
function defineSystem(name: string, run: (ctx: SimContext) => void): SystemDef;
function defineSystem(name: string, phase: Phase, run: (ctx: SimContext) => void): SystemDef;
function defineSystem(spec: SystemSpec): SystemDef;
```

#### `deriveSeed` (function)

Seed for a named substream: FNV-1a over the name's UTF-16 code units, mixed with the root seed.

```ts
function deriveSeed(rootSeed: number, name: string): number;
```

#### `EntityRef` (interface)

A live entity, addressed by its StableId. Writes are coerced per field type and mark the entity changed.

```ts
interface EntityRef {
  readonly sid: number;
  has(component: ComponentDef): boolean;
  get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>;
  set<S extends FieldSchema>(component: ComponentDef<S>, values: Partial<FieldValues<S>>): void;
  add<S extends FieldSchema>(component: ComponentDef<S>, values?: Partial<FieldValues<S>>): void;
  remove(component: ComponentDef): void;
}
```

#### `EventDef` (interface)

An event a system emits: an id and the Zod schema its payload must match. Create one with `defineEvent`.

```ts
interface EventDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: "event";
  readonly id: string;
  readonly schema: Z;
}
```

#### `FieldRecord` (type)

One component's field values on an entity, by field name.

```ts
type FieldRecord = Record<string, number | boolean | string>;
```

#### `FieldSchema` (type)

A component's fields, by name.

```ts
type FieldSchema = Readonly<Record<string, FieldType>>;
```

#### `FieldType` (type)

A component field's type: `f32`, `f64`, `i32`, `u32`, `bool`, `entity` (a StableId, stored as a `u32`) or
`string`.

```ts
type FieldType = (typeof FIELD_TYPES)[number];
```

#### `FieldValue` (type)

The JavaScript type a field holds: `boolean` for `bool`, `string` for `string`, `number` for every other
type.

```ts
type FieldValue<T extends FieldType> = T extends "bool" ? boolean : T extends "string" ? string : number;
```

#### `FieldValues` (type)

The writable record of values a `FieldSchema` describes.

```ts
type FieldValues<S extends FieldSchema> = { -readonly [K in keyof S]: FieldValue<S[K]>; };
```

#### `hex64` (function)

16 lowercase hex digits.

```ts
function hex64(value: bigint): string;
```

#### `Phase` (type)

One of the six phases a tick runs through, in `PHASES` order.

```ts
type Phase = (typeof PHASES)[number];
```

#### `PHASES` (const)

Fixed phase order.

```ts
const PHASES: readonly ["input", "prePhysics", "physics", "postPhysics", "gameplay", "cleanup"];
```

#### `PluginDef` (interface)

A bundle of definitions the sim registers together: components, commands, events, resources and systems,
the plugins it depends on, and optionally per-sim engine state and `config`. Create one with
`definePlugin`.

```ts
interface PluginDef {
  readonly kind: "plugin";
  readonly name: string;
  /** Creates this plugin's per-sim engine state; its systems see it as `ctx.pluginState`. */
  readonly state: ((setup: PluginStateSetup) => Promise<PluginState>) | undefined;
  readonly dependsOn: readonly string[];
  readonly components: readonly ComponentDef[];
  readonly commands: readonly CommandDef[];
  readonly events: readonly EventDef[];
  readonly resources: readonly ResourceDef[];
  readonly systems: readonly SystemDef[];
  /**
   * Settings that change what the plugin simulates (physics gravity), as plain JSON. Part of the schema hash,
   * so a snapshot never restores into a sim configured differently. Undefined when the plugin has none.
   */
  readonly config: unknown;
}
```

#### `PluginState` (interface)

Engine state a plugin keeps outside the ECS, such as a Rapier world. `createSim` creates
one per sim, so a PluginDef shared by many sims never shares engine state between them.

```ts
interface PluginState {
  /** Bytes for snapshot section 6. Must be canonical: the same state gives the same bytes in every engine. */
  snapshot(): Uint8Array;
  /**
   * Validates and parses `bytes` without touching the live state. Throwing here (a SnapshotFormatError for bad
   * bytes) leaves the sim exactly as it was. Otherwise the sim later calls exactly one of the result's
   * methods: `commit` when every part of the snapshot was valid, `discard` when another part was not.
   */
  prepareRestore(bytes: Uint8Array): PreparedRestore;
  /** Frees the engine. The sim calls it once, on `dispose` or when `createSim` fails after creating it. */
  dispose(): void;
}
```

#### `PluginStateSetup` (interface)

What a plugin's state may know when it is created.

```ts
interface PluginStateSetup {
  /** The sim's fixed step, 1 / tickHz seconds. */
  readonly dt: number;
}
```

#### `PreparedRestore` (interface)

A plugin's parsed restore, held until the sim knows whether the whole snapshot is valid.

```ts
interface PreparedRestore {
  /** Adopts the parsed state and frees the state it replaces. Must not throw. */
  commit(): void;
  /** Frees whatever `prepareRestore` built (a restored engine world). Must not throw. */
  discard(): void;
}
```

#### `RejectedCommand` (interface)

A command `step` dropped, with the reason.

```ts
interface RejectedCommand {
  readonly command: Command;
  readonly reason: RejectReason;
}
```

#### `RejectReason` (type)

Why `step` dropped a command: `bad-header` (a field is missing or out of range), `unknown-command` (no
plugin defines its type), `wrong-tick` (not the sim's current tick), `duplicate-seq` (the same source and
seq twice in one step) or `invalid-payload` (it fails the command's schema).

```ts
type RejectReason = "bad-header" | "unknown-command" | "wrong-tick" | "duplicate-seq" | "invalid-payload";
```

#### `RenderDelta` (interface)

What changed for the renderer since the last delta. `changed` rows carry the entity's full
render state, so a removed component shows up as its absence. `resync` deltas list every live render
entity as added; the renderer drops everything it had first.

```ts
interface RenderDelta {
  readonly resync: boolean;
  readonly added: readonly RenderRow[];
  readonly changed: readonly RenderRow[];
  readonly removed: readonly number[];
}
```

#### `RenderRow` (interface)

One entity's render-flagged components (component id -> field values).

```ts
interface RenderRow {
  readonly sid: number;
  readonly components: Readonly<Record<string, Readonly<FieldRecord>>>;
}
```

#### `ResourceDef` (interface)

A value the sim keeps once, not on any entity: an id, a Zod schema and the `init` that gives its starting
value. Create one with `defineResource`.

```ts
interface ResourceDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: "resource";
  readonly id: string;
  readonly schema: Z;
  readonly init: () => z.input<Z>;
}
```

#### `Rng` (interface)

A deterministic generator (xoshiro128**, 32-bit integer math only, so it is bit-exact in every engine).
Each system gets its own, seeded from the sim's seed and the system's name.

```ts
interface Rng {
  /** Next raw 32-bit unsigned output. */
  nextU32(): number;
  /** Uniform in [0, 1), 32 bits of precision. */
  next(): number;
  /** Uniform integer in [0, n). `n` must be a positive integer <= 2^32. */
  int(n: number): number;
  /** Copy of the current state, for snapshots. */
  state(): RngState;
}
```

#### `RngState` (type)

The four 32-bit words of a generator's state, as `Rng.state()` copies them and snapshots store them.

```ts
type RngState = [number, number, number, number];
```

#### `Sim` (interface)

A running simulation, stepped with commands, that can snapshot, restore and hash its state. `step` is the
only way gameplay state changes. Create one with `createSim`, and `dispose` it when done.

```ts
interface Sim {
  readonly seed: number;
  readonly tickHz: number;
  readonly tick: number;
  /** XXH64 of the canonical content this sim was created with, 16 hex digits; the snapshot header's value. */
  readonly contentHash: string;
  step(commands: readonly Command[]): StepResult;
  /** Setup and inspection outside `step` (tests, scene setup). Runtime changes go through commands. */
  spawn(parts: readonly SpawnPart[]): number;
  entity(sid: number): EntityRef | undefined;
  query(...components: ComponentDef[]): EntityRef[];
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>;
  /** Canonical snapshot v1 bytes. */
  snapshot(): Uint8Array;
  /** Replaces the whole state. Throws SnapshotFormatError / SnapshotMismatchError and leaves the sim unchanged. */
  restore(bytes: Uint8Array): void;
  /**
   * A readable view of `bytes`, or of the current state when none are given. Decodes and checks
   * the header as `restore` does (SnapshotFormatError / SnapshotMismatchError) but not restore's later
   * cross-checks, and changes nothing.
   */
  describeSnapshot(bytes?: Uint8Array): SnapshotView;
  /** xxhash64 of the snapshot, 16 hex digits. */
  hash(): string;
  /** Frees the Koota world and every plugin's engine. Idempotent; any later call throws SimDisposedError. */
  dispose(): void;
}
```

#### `SIM_VERSION` (const)

The sim package's version, written into replay headers for information only. A constant
rather than a build-time define, so workspace tests and un-built replays carry the real version; the release's
version step updates it with package.json, and version.test.ts keeps the two equal.

```ts
const SIM_VERSION: string;
```

#### `SimCapacityError` (class)

More sims are alive than Koota allows worlds (16 per process). Dispose sims you no longer need.

```ts
class SimCapacityError extends Error {
  constructor(cause: unknown);
}
```

#### `SimContext` (interface)

What a system's `run` receives each tick.

```ts
interface SimContext {
  readonly tick: number;
  /** Fixed step, 1 / tickHz. */
  readonly dt: number;
  /** This system's own RNG substream. */
  readonly rng: Rng;
  /** Compiled content, deep-frozen. */
  readonly content: unknown;
  /** Live entities that have every listed component, in ascending StableId order. */
  query(...components: ComponentDef[]): EntityRef[];
  entity(sid: number): EntityRef | undefined;
  /** Spawns immediately; returns the new StableId. */
  spawn(...parts: SpawnPart[]): number;
  /** Despawn is deferred to the end of the tick (built-in `entities.flush`). */
  despawn(sid: number): void;
  readonly commands: {
    of<Z extends z.ZodType>(def: CommandDef<Z>): ReadonlyArray<CommandRecord<z.output<Z>>>;
  };
  emit<Z extends z.ZodType>(def: EventDef<Z>, payload: z.input<Z>): void;
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>;
  /** The per-sim state of the plugin that registered this system (`definePlugin({ state })`), else undefined. */
  readonly pluginState: unknown;
}
```

#### `SimDisposedError` (class)

The sim was disposed; it holds no world any more, so every call that reads or changes state refuses.

```ts
class SimDisposedError extends Error {
  constructor();
}
```

#### `SimEvent` (interface)

An event a system emitted during a step: the event's id as `type`, and its parsed `payload`.

```ts
interface SimEvent {
  readonly type: string;
  readonly payload: unknown;
}
```

#### `SimFaultedError` (class)

A system threw during `step`. The tick was left half-applied, so the sim refuses `step`, `snapshot` and
`hash` until a successful `restore`. Failing closed is cheaper than rolling back every tick.

```ts
class SimFaultedError extends Error {
  readonly system: string;
  readonly tick: number;
  constructor(system: string, tick: number, cause: unknown);
}
```

#### `SimOptions` (interface)

What `createSim` takes: the root `seed`, the `plugins`, `tickHz` (an integer from 1 to 1000, default 60)
and the `content` the systems read as `ctx.content` (default `{}`).

```ts
interface SimOptions {
  readonly seed: number;
  readonly tickHz?: number;
  readonly content?: unknown;
  readonly plugins: readonly PluginDef[];
}
```

#### `SNAPSHOT_VERSION` (const)

The snapshot format version this build reads and writes; a snapshot of another version fails with
`SnapshotFormatError`.

```ts
const SNAPSHOT_VERSION = 1;
```

#### `SnapshotFormatError` (class)

Snapshot bytes that are not a valid snapshot of this format version: bad magic, an unsupported version,
truncated or malformed sections.

```ts
class SnapshotFormatError extends Error {
  constructor(message: string, options?: ErrorOptions);
}
```

#### `SnapshotMismatchError` (class)

A valid snapshot that belongs to another sim: `field` names the header value that differs (`schemaHash`,
`contentHash` or `tickHz`), with this sim's `expected` value and the snapshot's `actual` one.

```ts
class SnapshotMismatchError extends Error {
  readonly field: "schemaHash" | "contentHash" | "tickHz";
  readonly expected: string;
  readonly actual: string;
  constructor(field: "schemaHash" | "contentHash" | "tickHz", expected: string, actual: string);
}
```

#### `SnapshotView` (interface)

A readable copy of a snapshot, for diffs and reports. Plugin bytes are opaque engine state,
so they are described by length and hash only.

```ts
interface SnapshotView {
  readonly header: {
    readonly formatVersion: number;
    readonly schemaHash: string;
    readonly contentHash: string;
    readonly tick: number;
    readonly tickHz: number;
  };
  /** Per system, its RNG state words. */
  readonly rng: Readonly<Record<string, readonly number[]>>;
  /** Per resource id, its value parsed from canonical JSON. */
  readonly resources: Readonly<Record<string, unknown>>;
  readonly nextId: number;
  /** Ascending sid; per component id, its field values. Components the entity lacks are absent. */
  readonly entities: ReadonlyArray<{
    readonly sid: number;
    readonly components: Readonly<Record<string, FieldRecord>>;
  }>;
  /** Section 6, per stateful plugin: byte length and XXH64 of its bytes. */
  readonly plugins: Readonly<Record<string, {
    readonly byteLength: number;
    readonly hash: string;
  }>>;
}
```

#### `sortedEntries` (function)

Own enumerable [key, value] pairs, sorted by key.

```ts
function sortedEntries<V>(obj: Readonly<Record<string, V>>): Array<[string, V]>;
```

#### `sortedKeys` (function)

Own enumerable string keys, sorted by UTF-16 code unit.

```ts
function sortedKeys(obj: object): string[];
```

#### `SpawnPart` (type)

A component to spawn with: the definition alone (defaults) or [definition, initial values].

```ts
type SpawnPart = ComponentDef | readonly [ComponentDef, Readonly<Record<string, unknown>>];
```

#### `StepResult` (interface)

What one `step` produced: the new tick, the events emitted, the renderer's delta and the commands that were
rejected.

```ts
interface StepResult {
  /** The tick the sim is at after this step. */
  readonly tick: number;
  readonly events: readonly SimEvent[];
  readonly render: RenderDelta;
  /** Invalid commands, in input order. The sim has no I/O, so it reports instead of logging. */
  readonly rejected: readonly RejectedCommand[];
}
```

#### `SystemDef` (interface)

A system: a name, the phase it runs in, the systems it must run `before` or `after` within that phase, and
its `run`, called once per tick. Create one with `defineSystem`.

```ts
interface SystemDef {
  readonly kind: "system";
  readonly name: string;
  readonly phase: Phase;
  readonly before: readonly string[];
  readonly after: readonly string[];
  readonly run: (ctx: SimContext) => void;
}
```

#### `SystemSpec` (interface)

The object form of `defineSystem`: a name, a phase, the optional `before`/`after` ordering and the run.

```ts
interface SystemSpec {
  name: string;
  phase: Phase;
  before?: readonly string[];
  after?: readonly string[];
  run: (ctx: SimContext) => void;
}
```

#### `xxhash64` (function)

XXH64 of `data` with an unsigned 64-bit `seed`.

```ts
function xxhash64(data: Uint8Array, seed?: bigint): bigint;
```

### `import { … } from '@automata/sim/hash'`

#### `canonicalJson` (function)

Canonical JSON: object keys sorted at every depth, no whitespace. Numbers use the ECMAScript
Number-to-string algorithm, which every engine implements identically, except that -0 is written as -0.
Throws CanonicalJsonError for anything JSON can't represent exactly: NaN, Infinity, undefined, bigint,
functions, symbols, and non-plain objects (a Date, Map, Set, typed array or class instance would otherwise
serialize as {} and hash the same as every other one).

```ts
function canonicalJson(value: unknown): string;
```

#### `hex64` (function)

16 lowercase hex digits.

```ts
function hex64(value: bigint): string;
```

#### `utf8` (function)

UTF-8 encoding without TextEncoder (the sim's lib has no DOM/Web APIs). Lone surrogates become U+FFFD.

```ts
function utf8(s: string): Uint8Array;
```

#### `xxhash64` (function)

XXH64 of `data` with an unsigned 64-bit `seed`.

```ts
function xxhash64(data: Uint8Array, seed?: bigint): bigint;
```

### `import { … } from '@automata/sim/math'`

#### `atan` (function)

Deterministic arctangent. NaN stays NaN; `-0` stays `-0`.

```ts
function atan(x0: number): number;
```

#### `atan2` (function)

Finite inputs only (sim values are finite). Signed zeros follow the built-in atan2.

```ts
function atan2(y: number, x: number): number;
```

#### `cos` (function)

Deterministic cosine, in radians. NaN for a non-finite input.

```ts
function cos(x: number): number;
```

#### `exp` (function)

Deterministic `e` to the power `x`. Infinity above about 709.78, 0 below about -745.13.

```ts
function exp(x: number): number;
```

#### `hypot` (function)

No overflow scaling: inputs must satisfy x*x + y*y < 1.7e308.

```ts
function hypot(x: number, y: number): number;
```

#### `log` (function)

Deterministic natural logarithm. NaN for a negative input, `-Infinity` for 0.

```ts
function log(x0: number): number;
```

#### `pow` (function)

Deterministic `x` to the power `y`. An integer `y` of 64 or less in magnitude multiplies exactly; otherwise
it is `exp(y * log(x))`, and a negative `x` with a non-integer `y` is NaN.

```ts
function pow(x: number, y: number): number;
```

#### `sin` (function)

Deterministic sine, in radians. NaN for a non-finite input; `-0` stays `-0`.

```ts
function sin(x: number): number;
```

#### `tan` (function)

Deterministic tangent, in radians, as `sin(x) / cos(x)`.

```ts
function tan(x: number): number;
```

### `import { … } from '@automata/sim/replay'`

#### `createRecorder` (function)

Starts recording `sim` from its current state, for the recorder's `step` to extend. Throws
`ReplayRecordError` for a `checkEvery` or `snapshotEvery` that is not an integer of at least 1.

```ts
function createRecorder(sim: Sim, options?: RecorderOptions): Recorder;
```

#### `createReplayStepper` (function)

Creates a stepper over `replay`: a fresh sim built from the replay's seed and tick rate, restored from its
start snapshot. Throws `SnapshotMismatchError` when the start snapshot belongs to another schema or
content, `SnapshotFormatError` when it is malformed, and `ReplayFormatError` when the header disagrees with
the start snapshot it describes; the sim it created is disposed first.

```ts
function createReplayStepper(replay: Replay, setup: ReplayStepSetup): Promise<ReplayStepper>;
```

#### `decodeReplay` (function)

Decodes `.replay` bytes (already inflated) into a `Replay`. Throws `ReplayFormatError`, with the byte
offset when known, for anything that is not a valid replay.

```ts
function decodeReplay(bytes: Uint8Array): Replay;
```

#### `DEFAULT_CHECK_EVERY` (const)

How often, in ticks, a recording stores a check hash when `RecorderOptions.checkEvery` is not given.

```ts
const DEFAULT_CHECK_EVERY = 60;
```

#### `encodeReplay` (function)

Encodes a replay as `.replay` bytes before deflate. The same run encodes to the same bytes in every engine.
Throws `ReplayFormatError` for a replay that cannot be encoded.

```ts
function encodeReplay(replay: Replay): Uint8Array;
```

#### `packReplay` (function)

Encodes a replay and deflates it into `.replay` file bytes.

```ts
function packReplay(replay: Replay, compression: ReplayCompression): Promise<Uint8Array>;
```

#### `Recorder` (interface)

Steps a sim and records the run as a `Replay`. Nothing else may step the sim while it records; the recorder
refuses to continue if something did.

```ts
interface Recorder {
  /** `sim.step` plus recording. */
  step(commands: readonly Command[]): StepResult;
  /** Adds the final tick and hash; the recorder is closed afterwards. */
  finish(): Replay;
}
```

#### `RecorderOptions` (interface)

What a recording takes: how often to store a check hash, whether to keep a reference hash and snapshots
(goldens), and free-form `meta`.

```ts
interface RecorderOptions {
  /** A check hash every this many ticks from the start (default 60, at least 1). */
  readonly checkEvery?: number;
  /** Goldens: also a hash after every step and a full snapshot every `snapshotEvery` ticks. */
  readonly reference?: {
    readonly snapshotEvery: number;
  };
  readonly meta?: Readonly<Record<string, string>>;
}
```

#### `Replay` (interface)

A recorded run: its header, the start snapshot, the accepted commands by tick, check hashes along the way
and the final tick and hash. Replaying it must reproduce every hash.

```ts
interface Replay {
  readonly header: ReplayHeader;
  /** sim.snapshot() when recording started: covers setup spawns and checkpoint starts. */
  readonly start: Uint8Array;
  /** Only ticks with accepted commands, ascending; commands within a tick in (source, seq) order. */
  readonly ticks: ReadonlyArray<{
    readonly tick: number;
    readonly commands: readonly ReplayCommand[];
  }>;
  /** sim.hash() after stepping to `tick`; ascending, in (startTick, finalTick]. */
  readonly checks: ReadonlyArray<{
    readonly tick: number;
    readonly hash: string;
  }>;
  readonly finalTick: number;
  readonly finalHash: string;
  /** Goldens only: a hash after every step, and full snapshots every `snapshotEvery` ticks. */
  readonly reference?: {
    /** Index i is the hash at startTick + 1 + i. */
    readonly hashes: readonly string[];
    readonly snapshots: ReadonlyArray<{
      readonly tick: number;
      readonly bytes: Uint8Array;
    }>;
  };
}
```

#### `REPLAY_FORMAT` (const)

The `.replay` format version this build reads and writes.

```ts
const REPLAY_FORMAT = 1;
```

#### `REPLAY_INFLATE_MAX_BYTES` (const)

Larger than 1 MiB because goldens carry reference snapshots; player replays may pass less.

```ts
const REPLAY_INFLATE_MAX_BYTES: number;
```

#### `REPLAY_MAX_TICKS` (const)

The longest run a replay may hold: 2^24 ticks, over 77 hours at 60 Hz. Bounds the work a small forged file can
ask of playback (its final delta is one varint).

```ts
const REPLAY_MAX_TICKS: number;
```

#### `ReplayCheck` (interface)

A hash check at a tick: the hash the replay recorded (`expected`) and the hash the re-simulated sim has
(`actual`). A recorded command the sim now rejects reports as `expected: 'accepted'` with the rejection
reason as `actual`.

```ts
interface ReplayCheck {
  readonly expected: string;
  readonly actual: string;
}
```

#### `ReplayCommand` (interface)

A command as a replay stores it: the sim's `Command` without its tick, which the replay's `ticks` entry
carries.

```ts
interface ReplayCommand {
  readonly source: number;
  readonly seq: number;
  readonly type: string;
  readonly payload: unknown;
}
```

#### `ReplayCompression` (interface)

The deflate and inflate a `.replay` file needs. The sim imports no compression library, so callers pass an
adapter (testing/sim has one for Node and one for browsers).

```ts
interface ReplayCompression {
  deflate(bytes: Uint8Array): Promise<Uint8Array>;
  /** Rejects once the output would pass maxBytes, without inflating the rest. */
  inflate(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array>;
}
```

#### `ReplayFormatError` (class)

Bytes that are not a valid `.replay`. `offset` is the byte where reading failed, when known.

```ts
class ReplayFormatError extends Error {
  readonly offset: number | undefined;
  constructor(message: string, offset?: number, options?: ErrorOptions);
}
```

#### `ReplayHeader` (interface)

The facts a replay needs before it plays: tick rate, seed, the schema and content hashes it was recorded
against, where it starts and how often it checks.

```ts
interface ReplayHeader {
  readonly tickHz: number;
  readonly seed: number;
  /** 16 hex digits, copied from the start snapshot's header. */
  readonly schemaHash: string;
  readonly contentHash: string;
  readonly startTick: number;
  readonly checkEvery: number;
  /** SIM_VERSION when recorded; informational, never compared. */
  readonly framework: string;
  /** Free-form (game, build id); always {} in a golden. */
  readonly meta: Readonly<Record<string, string>>;
}
```

#### `ReplayRecordError` (class)

A recording that cannot be exact: the sim stepped outside the recorder, a payload that is not JSON, and so on.

```ts
class ReplayRecordError extends Error {
  constructor(message: string, options?: ErrorOptions);
}
```

#### `ReplayStepper` (interface)

A replay playing back one tick at a time on its own sim. Create one with `createReplayStepper`, and
`dispose` it when done.

```ts
interface ReplayStepper {
  readonly sim: Sim;
  readonly tick: number;
  readonly done: boolean;
  /** One step. `check` is present at a check tick, the final tick, or when a recorded command was rejected. */
  step(): {
    readonly tick: number;
    readonly result: StepResult;
    readonly check?: ReplayCheck;
  };
  /** Steps to the end; stops at the first failed check. `checks` counts the checks that passed. */
  run(): {
    readonly ok: boolean;
    readonly checks: number;
    readonly failed?: {
      readonly tick: number;
    } & ReplayCheck;
  };
  dispose(): void;
}
```

#### `ReplayStepSetup` (interface)

What a stepper needs to rebuild the recorded sim: the same `plugins` and `content` the recording sim had.

```ts
interface ReplayStepSetup {
  readonly plugins: readonly PluginDef[];
  /** As SimOptions.content: the content the recording sim was given. */
  readonly content?: unknown;
}
```

#### `unpackReplay` (function)

Inflates `.replay` file bytes and decodes them. Throws `ReplayFormatError` for bytes that are not a
deflated replay or that inflate past `maxInflatedBytes` (default `REPLAY_INFLATE_MAX_BYTES`).

```ts
function unpackReplay(bytes: Uint8Array, compression: ReplayCompression, options?: {
  readonly maxInflatedBytes?: number;
}): Promise<Replay>;
```

### `import { … } from '@automata/sim/testing'`

#### `Difference` (interface)

One difference between two snapshot views: its kind, where it is (`entity 4 bounce.ball.vx`), the entity's
sid when it is an entity, and both values as printed.

```ts
interface Difference {
  readonly kind: "header" | "rng" | "resource" | "entity" | "plugin";
  /** What differs, as printed: "entity 4 bounce.ball.vx", "resource bounce.stats.bounces". */
  readonly at: string;
  /** For entity differences, the entity's sid. */
  readonly sid?: number;
  readonly expected: string;
  readonly actual: string;
}
```

#### `diffSnapshotViews` (function)

Every difference between an expected and an actual snapshot view, field by field, in a fixed order (header,
rng, resources, next id, entities, plugin bytes) so a report reads the same in every engine. Empty when
they are equal.

```ts
function diffSnapshotViews(expected: SnapshotView, actual: SnapshotView): Difference[];
```

#### `expectGolden` (function)

Throws with the formatted report unless the golden matched or was just written.

```ts
function expectGolden(report: GoldenReport): void;
```

#### `formatGoldenReport` (function)

One report as text: a line for most outcomes, and for a divergence the tick and up to 20 differences.

```ts
function formatGoldenReport(report: GoldenReport): string;
```

#### `GOLDEN_MAX_PACKED_BYTES` (const)

A golden that passes this cannot be reviewed or loaded cheaply; lower snapshotEvery's cost instead.

```ts
const GOLDEN_MAX_PACKED_BYTES: number;
```

#### `goldenCommands` (function)

The Vitest browser commands that let golden tests read golden files in a browser: register them with
`browser: { commands: goldenCommands() }`. Only `.golden.json` and `.replay` files inside the project root
can be read, and nothing can be written.

```ts
function goldenCommands(options?: GoldenCommandsOptions): Record<string, BrowserCommand<[path: string], Promise<string | null>>>;
```

#### `GoldenReport` (type)

What a golden check found: `pass`, `written`, `missing`, `schema-changed`, `content-changed`,
`setup-changed` or `diverged` (with the first differing tick and the fields that differ).

```ts
type GoldenReport = {
  readonly name: string;
} & ({
  readonly kind: "pass";
  readonly checks: number;
} | {
  readonly kind: "written";
  readonly file: string;
  readonly bytes: number;
} | {
  readonly kind: "missing";
  readonly file: string;
} | {
  readonly kind: "schema-changed" | "content-changed";
  readonly expected: string;
  readonly actual: string;
} | {
  readonly kind: "setup-changed";
  readonly field: "seed" | "tickHz" | "ticks" | "every";
  readonly expected: number;
  readonly actual: number;
} | {
  readonly kind: "diverged";
  /** The first tick whose hash differs (the tick after the step), or the failed check when not exact. */
  readonly firstTick: number;
  readonly lastGoodTick: number;
  readonly exact: boolean;
  /** The tick the differences were taken at, when that is not firstTick. */
  readonly diffTick?: number;
  readonly differences: readonly Difference[];
});
```

#### `nodeCompression` (const)

Node only. zlib is imported when first used, so importing this module in a browser costs nothing.

```ts
const nodeCompression: ReplayCompression;
```

#### `replayGolden` (function)

Replays a golden `.replay` against the current sim and reports whether it still matches. With reference
data a divergence names the exact tick and every field that differs. With `AUTOMATA_UPDATE_GOLDENS=1` in
Node and a `record` option it records the file first, then checks what it wrote. A mismatch is a report, not
a throw: pass it to `expectGolden`.

```ts
function replayGolden(options: ReplayGoldenOptions): Promise<GoldenReport>;
```

#### `ReplayGoldenOptions` (interface)

What `replayGolden` checks: the `.replay` file, the plugins and content to replay it with, and how to
record it when updating goldens.

```ts
interface ReplayGoldenOptions {
  /** A deflated `.replay`; a relative path is taken from the test file's folder. */
  readonly file: string;
  readonly plugins: readonly PluginDef[];
  readonly content?: unknown;
  /**
   * How to record the golden when updating (Node, AUTOMATA_UPDATE_GOLDENS=1); absent for replays recorded
   * elsewhere. Either seed/tickHz/setup, or `create`, a game's own sim factory.
   */
  readonly record?: RecordFrom & {
    readonly drive: (recorder: Recorder, sim: Sim) => void | Promise<void>;
    /** A reference snapshot every this many ticks (default 1, so a divergence is diffed at its exact tick). */
    readonly snapshotEvery?: number;
  };
}
```

#### `RoundTripFailure` (interface)

One case whose restored run differed from the uninterrupted one: its number, sim seed, length, restore
tick, variant and a report of what differed.

```ts
interface RoundTripFailure {
  readonly case: number;
  readonly simSeed: number;
  readonly ticks: number;
  readonly at: number;
  readonly variant: RoundTripVariant;
  readonly report: string;
}
```

#### `RoundTripOptions` (interface)

What `snapshotRoundTripProperty` runs: the plugins, content and a command script, and how many cases of
what length to try.

```ts
interface RoundTripOptions {
  readonly plugins: readonly PluginDef[];
  readonly content?: unknown;
  readonly tickHz?: number;
  /** Builds each case's world; `rng` is derived from the case's sim seed. */
  readonly setup?: (sim: Sim, rng: Rng) => void;
  readonly script: (tick: number, rng: Rng) => readonly Command[];
  /** Default 200. */
  readonly cases?: number;
  /** Each case runs 1..maxTicks ticks (default 300). */
  readonly maxTicks?: number;
  /** Chooses which cases run (default 1). */
  readonly seed?: number;
}
```

#### `RoundTripVariant` (type)

How a case restores: into a `fresh` sim, or into one that has `dirty` (stepped on past the snapshot).

```ts
type RoundTripVariant = "fresh" | "dirty";
```

#### `simGolden` (function)

Plays a scripted run and compares the sim's hash every `every` ticks with the golden JSON file, reporting
the first recorded tick that differs. With `AUTOMATA_UPDATE_GOLDENS=1` in Node it records the file. Throws
for an `every` that is not an integer of 1 or more; a mismatch is a report, not a throw.

```ts
function simGolden(options: SimGoldenOptions): Promise<GoldenReport>;
```

#### `SimGoldenOptions` (interface)

What `simGolden` runs: the plugins, content, seed and scripted commands to play for `ticks` ticks, where
the golden JSON lives, and how often to record a hash.

```ts
interface SimGoldenOptions {
  readonly name: string;
  /** The golden is <dir>/__goldens__/<name>.golden.json; a relative dir is taken from the test file's folder. */
  readonly dir: string;
  readonly plugins: readonly PluginDef[];
  readonly content?: unknown;
  readonly seed: number;
  readonly tickHz?: number;
  readonly setup?: (sim: Sim) => void;
  /** Commands for each tick; `rng` is a stream of its own, derived from the seed. */
  readonly script: (tick: number, rng: Rng) => readonly Command[];
  readonly ticks: number;
  /** Record a hash every this many ticks (default 1). */
  readonly every?: number;
}
```

#### `snapshotRoundTripProperty` (function)

Checks that snapshot, restore and continue equals an uninterrupted run, over many seeds, run lengths and
restore points, alternating fresh and dirty restores. Returns `{ failures }`; an empty list means the
property held.

```ts
function snapshotRoundTripProperty(options: RoundTripOptions): Promise<{
  readonly failures: readonly RoundTripFailure[];
}>;
```

#### `streamCompression` (const)

Browsers and Node: CompressionStream / DecompressionStream('deflate-raw').

```ts
const streamCompression: ReplayCompression;
```

### `import { … } from '@automata/sim/testing/commands'`

#### `goldenCommands` (function)

The Vitest browser commands that let golden tests read golden files in a browser: register them with
`browser: { commands: goldenCommands() }`. Only `.golden.json` and `.replay` files inside the project root
can be read, and nothing can be written.

```ts
function goldenCommands(options?: GoldenCommandsOptions): Record<string, BrowserCommand<[path: string], Promise<string | null>>>;
```

#### `GoldenCommandsOptions` (interface)

Options for {@link goldenCommands}.

```ts
interface GoldenCommandsOptions {
  /**
   * The folder golden files must be inside; defaults to the Vitest project's root. A package whose goldens sit
   * beside it rather than under it names an absolute folder holding both.
   */
  readonly root?: string;
}
```

### `import { … } from '@automata/sim/testing/property'`

#### `RoundTripFailure` (interface)

One case whose restored run differed from the uninterrupted one: its number, sim seed, length, restore
tick, variant and a report of what differed.

```ts
interface RoundTripFailure {
  readonly case: number;
  readonly simSeed: number;
  readonly ticks: number;
  readonly at: number;
  readonly variant: RoundTripVariant;
  readonly report: string;
}
```

#### `RoundTripOptions` (interface)

What `snapshotRoundTripProperty` runs: the plugins, content and a command script, and how many cases of
what length to try.

```ts
interface RoundTripOptions {
  readonly plugins: readonly PluginDef[];
  readonly content?: unknown;
  readonly tickHz?: number;
  /** Builds each case's world; `rng` is derived from the case's sim seed. */
  readonly setup?: (sim: Sim, rng: Rng) => void;
  readonly script: (tick: number, rng: Rng) => readonly Command[];
  /** Default 200. */
  readonly cases?: number;
  /** Each case runs 1..maxTicks ticks (default 300). */
  readonly maxTicks?: number;
  /** Chooses which cases run (default 1). */
  readonly seed?: number;
}
```

#### `RoundTripVariant` (type)

How a case restores: into a `fresh` sim, or into one that has `dirty` (stepped on past the snapshot).

```ts
type RoundTripVariant = "fresh" | "dirty";
```

#### `snapshotRoundTripProperty` (function)

Checks that snapshot, restore and continue equals an uninterrupted run, over many seeds, run lengths and
restore points, alternating fresh and dirty restores. Returns `{ failures }`; an empty list means the
property held.

```ts
function snapshotRoundTripProperty(options: RoundTripOptions): Promise<{
  readonly failures: readonly RoundTripFailure[];
}>;
```

## `@automata/tools`

### `import { … } from '@automata/tools'`

#### `defineShipConfig` (function)

Identity function that gives a game's `ship.config.ts` type checking and editor completion.

```ts
function defineShipConfig(config: ShipConfig): ShipConfig;
```

#### `ItchConfig` (interface)

What a game writes in `ship.config.ts`.

```ts
interface ItchConfig {
  /** The itch.io project as butler names it: `user/game`, lower case. */
  readonly project: string;
  /** The butler channel. Defaults to `html5`. */
  readonly channel?: string | undefined;
  /**
   * The butler channel of each desktop bundle (`publish --target itch --from tauri`). Each defaults to
   * its OS's name: `linux`, `mac`, `windows`.
   */
  readonly downloads?: {
    readonly linux?: string | undefined;
    readonly mac?: string | undefined;
    readonly windows?: string | undefined;
  } | undefined;
}
```

#### `ItchSettings` (interface)

The checked settings, with the channel filled in.

```ts
interface ItchSettings {
  readonly project: string;
  readonly channel: string;
  readonly downloads: {
    readonly linux: string;
    readonly mac: string;
    readonly windows: string;
  };
}
```

#### `ShipConfig` (interface)

What a game tells ship about itself: the game config every target reads (`@automata/content`'s
`GameConfig`) and each target's own section. Keys keep Ruken's manifest names and snake_case, so
the config reads like the `ruken.toml` the Ruken target writes from it (ship fills in `schema` and `allow_eval`,
always false); `prepare --target ruken` checks the whole of it with Ruken's own parser.

```ts
interface ShipConfig extends GameConfig {
  /**
   * Where `automata ship publish --target itch` pushes. Not a Ruken field: it is never written to
   * `ruken.toml`, and a Ruken build ignores it.
   */
  readonly itch?: ItchConfig | undefined;
  /**
   * The desktop build's settings (`automata ship prepare --target tauri`). Not a Ruken field: it is
   * never written to `ruken.toml`.
   */
  readonly tauri?: TauriConfig | undefined;
  /**
   * Who the game's builds are for. `private` is a game that carries `@pixi/3d`, a closed beta (D-1), until Pixi 3D's
   * public release: `automata ship prepare` then checks the build as private and writes no `ruken.toml`, and only
   * `publish --private` ships it. Not a Ruken field. Left out, a game is `public`.
   */
  readonly audience?: "public" | "private" | undefined;
}
```

#### `TauriConfig` (interface)

What a game writes in `ship.config.ts` to build for the desktop.

```ts
interface TauriConfig {
  /**
   * The app's reverse-DNS identifier, unique to the game (`dev.mcthaydt.emberwick`): letters, digits and hyphens in
   * two or more dot-separated parts, the first starting with a letter, and not ending in `.app`
   * (https://v2.tauri.app/reference/config/#identifier).
   */
  readonly identifier: string;
  /** A square PNG of at least 512 px for the app's icon, relative to the game's folder. Left out, ship draws one. */
  readonly icon?: string | undefined;
}
```

## `@automata/ui-screens`

### `import { … } from '@automata/ui-screens'`

#### `ErrorScreen` (const)

The error screen: core's ErrorPanel on core's ScreenFrame (the frame gives Back its place). The panel is opaque and sits at the top of the visible region, so the screen carries no title of its own. Every failure names a way forward: an
action, or, when the device cannot run the game at all (`final`), the frame's Back, so a final failure needs `onBack`. The primary
action takes focus on entry; Escape goes back when the game gives a way back. The panel's own layout rules (where the message
scrolls, where the actions stack) are core's.

```ts
const ErrorScreen: import("svelte").Component<Props, {}, "">;
type ErrorScreen = ReturnType<typeof ErrorScreen>;
```

#### `LoadingScreen` (const)

The loading screen: the game's title on core's ScreenFrame with core's LoaderOverlay over it. The words are the game's
own: `label` names the progress bar and `slowLabel` is what the overlay says once `slow` is set. Progress is 0 to 1, absent while
unknown (the bar is then indeterminate). Edit the title, the art behind it, or swap the overlay: the frame is what keeps it inside
the visible region.

```ts
const LoadingScreen: import("svelte").Component<Props, {}, "">;
type LoadingScreen = ReturnType<typeof LoadingScreen>;
```

#### `ResultsAction` (interface)

A button on the results screen's action bar. Mark one `primary`; give each secondary a
`shortLabel` for when the bar is narrow.

```ts
interface ResultsAction {
    readonly id: string;
    readonly label: string;
    /** What a secondary action says when the bar is narrow ("Title" for "Back to title"); give one for each secondary. */
    readonly shortLabel?: string | undefined;
    readonly primary?: boolean | undefined;
}
```

#### `ResultsCopy` (interface)

The words this screen adds to the game's own: the rows' region name, the empty line and the "+N more" label.

```ts
interface ResultsCopy {
    readonly rows: string;
    readonly empty: string;
    readonly more: (count: number) => string;
}
```

#### `ResultsRow` (interface)

One line of the results list: a label and its value, with an optional detail line under it. `id`
keeps the row steady between updates.

```ts
interface ResultsRow {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly detail?: string | undefined;
}
```

#### `ResultsScreen` (const)

The results screen: a title, the rows a game wants to show and one to three actions, on core's ScreenFrame.

It never ranks. The caller passes the rows in the order to show them and the screen only shows them, so what decides the order
(the sim, a server's standings) stays the one place that decides it. The rows are a declared scroll region; the actions
are outside it, so a long list scrolls and the way out never moves. The primary action takes focus on entry (the first action
when none is primary); Escape or the system back calls `onBack` when the game gives one.

Edit freely once copied: the layout, the row markup and the order of the actions are yours. The geometry, the targets and the
focus model are core's (`@automata/framework`), so keep using `ScreenFrame`, `ScrollList` and `ActionBar`.

```ts
const ResultsScreen: import("svelte").Component<Props, {}, "">;
type ResultsScreen = ReturnType<typeof ResultsScreen>;
```

#### `TitleAction` (interface)

An extra button on the title screen beside Play, such as Settings or Credits. `shortLabel` is
what it says when the bar is narrow.

```ts
interface TitleAction {
    readonly id: string;
    readonly label: string;
    /** What the action says when the bar is narrow. */
    readonly shortLabel?: string | undefined;
}
```

#### `TitleScreen` (const)

The title screen: the game's name, one primary Play and any further actions the game adds (Settings, Credits), on core's
ScreenFrame and ActionBar. Play takes focus on entry. A game with saves keeps core's default title, which lists the slots; add
that here by copying the slot list from `@automata/framework`'s title when you need it.

```ts
const TitleScreen: import("svelte").Component<Props, {}, "">;
type TitleScreen = ReturnType<typeof TitleScreen>;
```

### `import { … } from '@automata/ui-screens/error'`

#### `ErrorScreen` (const)

The error screen: core's ErrorPanel on core's ScreenFrame (the frame gives Back its place). The panel is opaque and sits at the top of the visible region, so the screen carries no title of its own. Every failure names a way forward: an
action, or, when the device cannot run the game at all (`final`), the frame's Back, so a final failure needs `onBack`. The primary
action takes focus on entry; Escape goes back when the game gives a way back. The panel's own layout rules (where the message
scrolls, where the actions stack) are core's.

```ts
const ErrorScreen: import("svelte").Component<Props, {}, "">;
type ErrorScreen = ReturnType<typeof ErrorScreen>;
```

### `import { … } from '@automata/ui-screens/loading'`

#### `LoadingScreen` (const)

The loading screen: the game's title on core's ScreenFrame with core's LoaderOverlay over it. The words are the game's
own: `label` names the progress bar and `slowLabel` is what the overlay says once `slow` is set. Progress is 0 to 1, absent while
unknown (the bar is then indeterminate). Edit the title, the art behind it, or swap the overlay: the frame is what keeps it inside
the visible region.

```ts
const LoadingScreen: import("svelte").Component<Props, {}, "">;
type LoadingScreen = ReturnType<typeof LoadingScreen>;
```

### `import { … } from '@automata/ui-screens/results'`

#### `ResultsAction` (interface)

A button on the results screen's action bar. Mark one `primary`; give each secondary a
`shortLabel` for when the bar is narrow.

```ts
interface ResultsAction {
    readonly id: string;
    readonly label: string;
    /** What a secondary action says when the bar is narrow ("Title" for "Back to title"); give one for each secondary. */
    readonly shortLabel?: string | undefined;
    readonly primary?: boolean | undefined;
}
```

#### `ResultsCopy` (interface)

The words this screen adds to the game's own: the rows' region name, the empty line and the "+N more" label.

```ts
interface ResultsCopy {
    readonly rows: string;
    readonly empty: string;
    readonly more: (count: number) => string;
}
```

#### `ResultsRow` (interface)

One line of the results list: a label and its value, with an optional detail line under it. `id`
keeps the row steady between updates.

```ts
interface ResultsRow {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly detail?: string | undefined;
}
```

#### `ResultsScreen` (const)

The results screen: a title, the rows a game wants to show and one to three actions, on core's ScreenFrame.

It never ranks. The caller passes the rows in the order to show them and the screen only shows them, so what decides the order
(the sim, a server's standings) stays the one place that decides it. The rows are a declared scroll region; the actions
are outside it, so a long list scrolls and the way out never moves. The primary action takes focus on entry (the first action
when none is primary); Escape or the system back calls `onBack` when the game gives one.

Edit freely once copied: the layout, the row markup and the order of the actions are yours. The geometry, the targets and the
focus model are core's (`@automata/framework`), so keep using `ScreenFrame`, `ScrollList` and `ActionBar`.

```ts
const ResultsScreen: import("svelte").Component<Props, {}, "">;
type ResultsScreen = ReturnType<typeof ResultsScreen>;
```

### `import { … } from '@automata/ui-screens/title'`

#### `TitleAction` (interface)

An extra button on the title screen beside Play, such as Settings or Credits. `shortLabel` is
what it says when the bar is narrow.

```ts
interface TitleAction {
    readonly id: string;
    readonly label: string;
    /** What the action says when the bar is narrow. */
    readonly shortLabel?: string | undefined;
}
```

#### `TitleScreen` (const)

The title screen: the game's name, one primary Play and any further actions the game adds (Settings, Credits), on core's
ScreenFrame and ActionBar. Play takes focus on entry. A game with saves keeps core's default title, which lists the slots; add
that here by copying the slot list from `@automata/framework`'s title when you need it.

```ts
const TitleScreen: import("svelte").Component<Props, {}, "">;
type TitleScreen = ReturnType<typeof TitleScreen>;
```
