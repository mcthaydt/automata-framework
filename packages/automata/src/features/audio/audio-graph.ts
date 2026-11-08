// The Web Audio graph, without a hall, tape echo, vintage stage and analyser, which stay in the game or go to `feel` and
// `audio-synth`:
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
  | 'createBuffer'
  | 'sampleRate'
  | 'decodeAudioData'
  | 'resume'
  | 'suspend'
  | 'close'
> & { readonly state: AudioContextState | 'interrupted' }

/** The buses under master. */
export type SubBus = Exclude<AudioBusName, 'master'>

/** How long a level change glides, so a slider never clicks. */
export const LEVEL_GLIDE_SECONDS = 0.01

/** How fast a duck goes down: quick enough to clear room for what ducked it. */
export const DUCK_ATTACK_SECONDS = 0.012

/** How long a duck takes to come back up. */
export const DUCK_RELEASE_SECONDS = 0.26

interface Duck {
  readonly level: number
  readonly from: number
  readonly until: number
}

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
  /** The ducks in force per bus, on the graph's clock. */
  private readonly ducks = new Map<SubBus, Duck[]>()

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

  /**
   * Takes `bus` down by `amount` (0..1) for `seconds` from now, then back up; `master` ducks every bus. The deepest
   * duck in force holds, so a short deep duck inside a long shallow one comes back to the shallow one, not to full.
   */
  duck(bus: AudioBusName, amount: number, seconds: number): void {
    const now = this.context?.currentTime
    if (now === undefined) return
    const duck = { level: 1 - unit(amount), from: now, until: now + Math.max(0, seconds) }
    for (const each of bus === 'master' ? SUB_BUSES : [bus]) {
      const before = levelAt(this.ducks.get(each) ?? [], now)
      const inForce = (this.ducks.get(each) ?? []).filter((held) => held.until > now)
      inForce.push(duck)
      this.ducks.set(each, inForce)
      this.scheduleDucks(each, before)
    }
  }

  /**
   * Writes the ducks in force onto `bus`'s duck gain, whole from now, starting from `previous`, the level it holds
   * now: each boundary is a glide to the level in force just after it, fast
   * going down and at the release coming back up.
   */
  private scheduleDucks(bus: SubBus, previous: number): void {
    const param = this.buses.get(bus)?.duck.gain
    const now = this.context?.currentTime
    if (param === undefined || now === undefined) return
    const ducks = this.ducks.get(bus) ?? []
    param.cancelScheduledValues(now)
    const boundaries = [...new Set([now, ...ducks.flatMap((held) => [held.from, held.until])])]
      .filter((time) => time >= now)
      .sort((a, b) => a - b)
    let level = previous
    for (const time of boundaries) {
      const next = levelAt(ducks, time)
      if (next === level) continue
      // A time constant is a third of the way there; a fifth of the release lands within a percent of it.
      param.setTargetAtTime(next, time, next < level ? DUCK_ATTACK_SECONDS : DUCK_RELEASE_SECONDS / 4.6)
      level = next
    }
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

/** The level the deepest duck in force at `time` holds a bus at; 1 with none. */
function levelAt(ducks: readonly Duck[], time: number): number {
  let level = 1
  for (const held of ducks) if (held.from <= time && time < held.until) level = Math.min(level, held.level)
  return level
}
