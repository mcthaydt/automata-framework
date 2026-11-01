// Writes base-3d's sounds (public/sounds/*.wav): four short original cues, synthesized here from sine tones and a seeded
// noise, 16-bit mono at 22,050 Hz. Run it with `node scripts/make-sounds.ts` from games/base-3d; the output is
// deterministic, so the committed files are exactly what it writes (sounds.test.ts checks them). No outside asset is used.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RATE = 22_050
const TAU = 2 * Math.PI

/** Samples of `seconds` from `at(t, i)`, t in seconds, each in −1..1. */
const render = (seconds: number, at: (t: number) => number): number[] =>
  Array.from({ length: Math.round(seconds * RATE) }, (_, i) => at(i / RATE))

/** A tone that sweeps from `from` Hz to `to` Hz over `seconds`, fading out. */
const sweep = (seconds: number, from: number, to: number, gain: number): number[] => {
  let phase = 0
  return render(seconds, (t) => {
    const u = t / seconds
    phase += (TAU * (from + (to - from) * u)) / RATE
    return gain * Math.sin(phase) * (1 - u) ** 2
  })
}

/** A seeded linear-congruential noise in −1..1, so the file is the same on every run. */
const noise = (seed: number): (() => number) => {
  let state = seed
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 2_147_483_648 - 1
  }
}

/** Notes one after another, each `step` seconds apart, mixed. */
const arpeggio = (notes: readonly number[], step: number, length: number, gain: number): number[] => {
  const total = Math.round((step * (notes.length - 1) + length) * RATE)
  const mix = new Array<number>(total).fill(0)
  for (const [index, hz] of notes.entries()) {
    const start = Math.round(index * step * RATE)
    const tone = sweep(length, hz, hz, gain)
    for (const [i, value] of tone.entries()) mix[start + i] = (mix[start + i] ?? 0) + value
  }
  return mix
}

const CUES: Readonly<Record<string, number[]>> = {
  // An ember: a quick rising chirp.
  ember: sweep(0.18, 660, 1_320, 0.5),
  // The goal: a rising major arpeggio that rings out.
  goal: arpeggio([523.25, 659.25, 783.99, 1_046.5], 0.11, 0.45, 0.35),
  // The roll: a short filtered swoosh, noise that fades as it passes.
  roll: (() => {
    const random = noise(7)
    let low = 0
    return render(0.3, (t) => {
      low += 0.18 * (random() - low)
      return 0.9 * low * Math.sin((Math.PI * t) / 0.3) ** 2
    })
  })(),
  // A fall: a tone sinking away.
  fall: sweep(0.45, 440, 110, 0.5),
}

/** A mono 16-bit PCM WAV file of `samples`. */
function wav(samples: readonly number[]): Buffer {
  const data = Buffer.alloc(samples.length * 2)
  for (const [i, sample] of samples.entries())
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32_767), i * 2)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sounds')
mkdirSync(out, { recursive: true })
for (const [name, samples] of Object.entries(CUES)) writeFileSync(join(out, `${name}.wav`), wav(samples))
