// The synth (M6 spec §4.10; from the adventure source's `synth.ts`): schedules a cue's voices, or a bed's drones, on any
// `BaseAudioContext`: core's live context, or an `OfflineAudioContext` for the offline render (M6.10b), so the game and the check
// play the same thing. It never builds a context (core's audio graph owns the one context). Nodes are made in the order the
// source made them, so a render matches it sample for sample.
import type { Bed, Cue, Voice } from './audio.schema'

/** Seeded white noise (the Park–Miller generator, seed 7): every hiss is the same noise. */
export function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let seed = 7
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647
    data[i] = seed / 1073741823.5 - 1
  }
  return buffer
}

/** Schedules one voice at `when` (context seconds) into `out`. `random` picks a hiss centre from a range. */
export function playVoice(
  ctx: BaseAudioContext,
  out: AudioNode,
  voice: Voice,
  when: number,
  random: () => number = Math.random,
): void {
  const t = when + (voice.at ?? 0)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(voice.volume, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + voice.length)
  if (voice.tone !== undefined) {
    const osc = ctx.createOscillator()
    osc.type = voice.tone
    osc.frequency.setValueAtTime(voice.from ?? 440, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, voice.to ?? 440), t + voice.length)
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + voice.length + 0.05)
    return
  }
  const hiss = voice.hiss ?? 1000
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const centre = typeof hiss === 'number' ? hiss : hiss[0] + random() * (hiss[1] - hiss[0])
  source.buffer = noiseBuffer(ctx, voice.length)
  filter.type = 'bandpass'
  filter.frequency.value = centre
  filter.Q.value = voice.q ?? 1
  source.connect(filter).connect(gain).connect(out)
  source.start(t)
}

/** Plays a cue's voices at `when`. */
export function playCue(
  ctx: BaseAudioContext,
  out: AudioNode,
  cue: Pick<Cue, 'voices'>,
  when: number = ctx.currentTime,
  random?: () => number,
): void {
  for (const voice of cue.voices) playVoice(ctx, out, voice, when, random)
}

/** Seconds from a cue's start to its last voice's end (a tone rings 0.05 s past its ramp). */
export function cueLength(cue: Pick<Cue, 'voices'>): number {
  return Math.max(0, ...cue.voices.map((v) => (v.at ?? 0) + v.length + (v.tone === undefined ? 0 : 0.05)))
}

/** Starts a bed into `out`; returns its stop function. */
export function startBed(ctx: BaseAudioContext, out: AudioNode, bed: Bed): (at?: number) => void {
  const level = ctx.createGain()
  const sources: AudioScheduledSourceNode[] = []
  level.gain.value = bed.volume
  level.connect(out)
  let into: AudioNode = level
  if (bed.pulse) {
    // gain = 1 - depth/2 + depth/2 · sin(2π rate t): a slow swell between 1 - depth and 1.
    const pulse = ctx.createGain()
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    pulse.gain.value = 1 - bed.pulse.depth / 2
    depth.gain.value = bed.pulse.depth / 2
    lfo.frequency.value = bed.pulse.rate
    lfo.connect(depth).connect(pulse.gain)
    pulse.connect(level)
    lfo.start()
    sources.push(lfo)
    into = pulse
  }
  for (const d of bed.drones) {
    const o = ctx.createOscillator()
    o.type = d.wave
    o.frequency.value = d.freq
    // A drone with its own volume goes through its own gain; the others connect straight in.
    if (d.volume === undefined) o.connect(into)
    else {
      const g = ctx.createGain()
      g.gain.value = d.volume
      o.connect(g).connect(into)
    }
    o.start()
    sources.push(o)
  }
  if (bed.noise) {
    const source = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    source.buffer = noiseBuffer(ctx, 2)
    source.loop = true
    filter.type = 'bandpass'
    filter.frequency.value = bed.noise.freq
    filter.Q.value = bed.noise.q
    gain.gain.value = bed.noise.volume
    source.connect(filter).connect(gain).connect(into)
    source.start()
    sources.push(source)
  }
  return (at) => {
    for (const s of sources) s.stop(at)
  }
}
