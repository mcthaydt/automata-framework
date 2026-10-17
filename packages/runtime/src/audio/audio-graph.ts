// The Web Audio graph (M5 spec §4.6). Ported from FloorFifty `apps/client/src/managers/audio/graph.ts` at `ac72660`,
// without its hall, tape echo, vintage stage and analyser, which stay in the game or go to `feel` and
// `audio-synth` (M6):
//
//   source → bus (the player's level) → duck (its own gain) → master → speakers
//
// master = the player's master level × the host's gain × mute × unfocused-mute. A duck is a gain of its own, so it
// never overwrites the player's level, and a mute is the master's, so unmuting restores the mix as it was.
import { AUDIO_BUS_NAMES, type AudioBusName } from './audio-buses.schema.js'

/** The part of `AudioContext` the graph uses. `interrupted` is Safari's state for a call or Siri. */
export type AudioContextLike = Pick<
  AudioContext,
  | 'currentTime'
  | 'destination'
  | 'createGain'
  | 'createBufferSource'
  | 'decodeAudioData'
  | 'resume'
  | 'suspend'
  | 'close'
> & { readonly state: AudioContextState | 'interrupted' }

/** The buses under master. */
export type SubBus = Exclude<AudioBusName, 'master'>

/** How long a level change glides, so a slider never clicks (FloorFifty `model.ts`). */
export const LEVEL_GLIDE_SECONDS = 0.01

const SUB_BUSES = AUDIO_BUS_NAMES.filter((bus): bus is SubBus => bus !== 'master')

const unit = (value: number) => Math.min(1, Math.max(0, value))

interface BusNodes {
  readonly level: GainNode
  readonly duck: GainNode
}

export class AudioGraph {
  context: AudioContextLike | undefined
  private master: GainNode | undefined
  private readonly buses = new Map<SubBus, BusNodes>()
  /** The player's levels, kept before the build so the first sound is already at them. */
  private readonly levels = new Map<AudioBusName, number>(AUDIO_BUS_NAMES.map((bus) => [bus, 1]))
  /** Ruken's volume for the game, 0..1 (its master volume, ducking and ads); 1 standalone. */
  private hostGain = 1
  private muted = false
  /** The window has lost focus and the player asked for quiet then; apart from `muted`, which is theirs. */
  private unfocused = false
  /** Whether `sleep` suspended the graph, so `wake` knows it may resume it. */
  private asleep = false

  /**
   * Builds the graph, once. Returns whether it built. Safe to call on every gesture: a context already built is
   * left alone, which keeps a graph from being rebuilt under a playing track.
   */
  buildIfNeeded(createContext: () => AudioContextLike): boolean {
    if (this.context !== undefined) return false
    const context = createContext()
    const master = context.createGain()
    master.connect(context.destination)
    for (const bus of SUB_BUSES) {
      const level = context.createGain()
      const duck = context.createGain()
      level.gain.value = this.gain(bus)
      level.connect(duck)
      duck.connect(master)
      this.buses.set(bus, { level, duck })
    }
    this.context = context
    this.master = master
    master.gain.value = this.masterGain
    return true
  }

  /** Where a source connects to play on `bus`; `master` skips the bus levels but not the host's. Undefined unbuilt. */
  input(bus: AudioBusName): AudioNode | undefined {
    return bus === 'master' ? this.master : this.buses.get(bus)?.level
  }

  /** The player's level for `bus`, 0..1. */
  gain(bus: AudioBusName): number {
    return this.levels.get(bus) ?? 1
  }

  /** Sets the player's level for `bus`, clamped into 0..1. */
  setGain(bus: AudioBusName, value: number): void {
    this.levels.set(bus, unit(value))
    if (bus === 'master') this.applyMaster()
    else this.glide(this.buses.get(bus)?.level, this.gain(bus))
  }

  /** Scales the master by the host's volume (Ruken's `audio.gain`). The player's mute still wins. */
  setHostGain(value: number): void {
    this.hostGain = unit(value)
    this.applyMaster()
  }

  /** Silences the master rather than the buses, so unmuting restores the mix rather than a default of it. */
  setMuted(muted: boolean): void {
    this.muted = muted
    this.applyMaster()
  }

  /** Silences the master while another window has focus. The graph runs on, so sound is right when focus returns. */
  setUnfocused(unfocused: boolean): void {
    this.unfocused = unfocused
    this.applyMaster()
  }

  /** Resumes the graph unless it is already running. */
  async resumeUnlessRunning(): Promise<void> {
    if (this.context === undefined) return
    if (this.context.state !== 'running') await this.context.resume()
  }

  /**
   * Suspends the graph while the page is hidden: a locked phone or a backgrounded tab. Only a running graph is
   * put to sleep, and `wake` resumes only a graph this put to sleep, so waking never starts sound a player had not
   * unlocked. Suspending pauses every voice where it is, so a loop carries on from the same place.
   */
  async sleep(): Promise<void> {
    if (this.context?.state !== 'running') return
    this.asleep = true
    await this.context.suspend()
  }

  /** Resumes a graph `sleep` suspended, or one the system interrupted (a call, Siri), which `sleep` never saw. */
  async wake(): Promise<void> {
    if (this.context === undefined) return
    if (!this.asleep && this.context.state !== 'interrupted') return
    this.asleep = false
    if (this.context.state !== 'running') await this.context.resume()
  }

  /**
   * On any gesture: resumes a graph the system suspended while the page stayed in view, which nothing else would,
   * since only a gesture may. One `sleep` suspended is left for `wake`, and one never unlocked is never built.
   */
  async resumeOnGesture(): Promise<void> {
    if (this.context === undefined || this.asleep || this.context.state === 'running') return
    await this.context.resume()
  }

  /** Whether a sound asked for now would wait on a stopped clock rather than play. */
  get silenced(): boolean {
    return this.asleep || this.context?.state === 'interrupted'
  }

  get masterGain(): number {
    return this.muted || this.unfocused ? 0 : this.gain('master') * this.hostGain
  }

  private applyMaster(): void {
    this.glide(this.master, this.masterGain)
  }

  private glide(node: GainNode | undefined, value: number): void {
    if (node === undefined || this.context === undefined) return
    node.gain.setTargetAtTime(value, this.context.currentTime, LEVEL_GLIDE_SECONDS)
  }
}
