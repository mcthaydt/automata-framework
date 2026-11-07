import { describe, expect, it } from 'vitest'
import { clicks, decay, decodeWav, encodeWav, integratedLoudness, rms, truePeak } from './index'

const RATE = 48000
const sine = (freq: number, seconds: number, amp = 1, phase = 0): Float32Array =>
  Float32Array.from(
    { length: Math.round(seconds * RATE) },
    (_, i) => amp * Math.sin(2 * Math.PI * freq * (i / RATE) + phase),
  )

describe('WAV', () => {
  it('round-trips 16-bit PCM channels and the sample rate', () => {
    const left = sine(440, 0.1, 0.5)
    const right = sine(220, 0.1, 0.25)
    const back = decodeWav(encodeWav([left, right], RATE))
    expect(back.sampleRate).toBe(RATE)
    expect(back.channels).toHaveLength(2)
    expect(back.channels[0]?.length).toBe(left.length)
    for (let i = 0; i < left.length; i += 97) expect(back.channels[0]?.[i]).toBeCloseTo(left[i] as number, 3)
  })
  it('clamps samples outside -1..1', () => {
    expect(decodeWav(encodeWav([Float32Array.of(2, -2)], RATE)).channels[0]).toEqual(Float32Array.of(1, -1))
  })
  it('refuses a file that is not a 16-bit WAV', () => {
    expect(() => decodeWav(new Uint8Array(64))).toThrow(/not a WAV/)
  })
})

describe('integratedLoudness (BS.1770-4)', () => {
  it('reads a full-scale 997 Hz sine as about -3.0 LUFS and 20 dB lower as about -23.0', () => {
    expect(integratedLoudness([sine(997, 3)], RATE)).toBeCloseTo(-3.01, 1)
    expect(integratedLoudness([sine(997, 3, 0.1)], RATE)).toBeCloseTo(-23.01, 1)
  })
  it('adds 3 dB for the same signal on two channels', () => {
    const one = integratedLoudness([sine(997, 3, 0.1)], RATE) as number
    const two = integratedLoudness([sine(997, 3, 0.1), sine(997, 3, 0.1)], RATE) as number
    expect(two - one).toBeCloseTo(3.01, 1)
  })
  it('is null under one 400 ms block and -Infinity for silence', () => {
    expect(integratedLoudness([sine(997, 0.3)], RATE)).toBeNull()
    expect(integratedLoudness([new Float32Array(RATE)], RATE)).toBe(Number.NEGATIVE_INFINITY)
  })
})

describe('truePeak', () => {
  it('equals the sample peak of a slow sine', () => {
    expect(truePeak([sine(100, 0.2, 0.5)])).toBeCloseTo(-6.02, 1)
  })
  it('finds an inter-sample peak the samples miss', () => {
    const x = sine(RATE / 4, 0.05, 1, Math.PI / 4)
    const samplePeak = 20 * Math.log10(Math.max(...x.map(Math.abs)))
    expect(samplePeak).toBeCloseTo(-3.01, 1)
    expect(truePeak([x])).toBeGreaterThan(-0.5)
  })
  it('is -Infinity for silence', () => {
    expect(truePeak([new Float32Array(100)])).toBe(Number.NEGATIVE_INFINITY)
  })
})

describe('clicks', () => {
  it('finds none in a clean sine', () => {
    expect(clicks(sine(440, 1, 0.5), RATE)).toEqual([])
  })
  it('finds a step inside a sound', () => {
    const x = sine(440, 1, 0.5)
    for (let i = RATE / 2; i < x.length; i++) x[i] = (x[i] as number) + 0.3
    const found = clicks(x, RATE)
    expect(found.length).toBeGreaterThan(0)
    expect(found[0]).toBeGreaterThanOrEqual(RATE / 2 - 2)
    expect(found[0]).toBeLessThanOrEqual(RATE / 2 + 2)
  })
  it('lets a hard attack out of silence pass (its release is smooth)', () => {
    const x = new Float32Array(RATE)
    const tone = sine(440, 0.5, 0.8)
    for (let i = 0; i < 2400; i++)
      tone[tone.length - 1 - i] = (tone[tone.length - 1 - i] as number) * (i / 2400)
    x.set(tone, RATE / 4)
    expect(clicks(x, RATE)).toEqual([])
  })
  it('lets a sawtooth’s own edges pass', () => {
    const x = Float32Array.from({ length: RATE }, (_, i) => 0.5 * (((i * 220) / RATE) % 1) - 0.25)
    expect(clicks(x, RATE)).toEqual([])
  })
})

describe('decay', () => {
  it('measures the RT60 of a decaying tone', () => {
    const rt60 = 0.5
    const x = Array.from(sine(200, 2, 1)).map((v, i) => v * 10 ** (-3 * (i / RATE / rt60)))
    expect(decay(x, 0, RATE)).toBeCloseTo(rt60, 1)
  })
  it('is null for a tail too short to fit', () => {
    expect(decay([0.1, 0.1], 0, RATE)).toBeNull()
  })
  it('rms is the root mean square of a window', () => {
    expect(rms(Array.from(sine(100, 1, 1)), 0, RATE)).toBeCloseTo(Math.SQRT1_2, 3)
  })
})
