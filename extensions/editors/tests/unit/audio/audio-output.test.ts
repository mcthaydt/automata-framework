import type { AudioContent } from '@automata/audio-synth'
import { describe, expect, it, vi } from 'vitest'
import { browserAudio } from '#src/features/audio/audio-output.ts'

const content: AudioContent = {
  cue: [
    { id: 'coin', bus: 'sfx', voices: [{ tone: 'square', from: 880, to: 1320, length: 0.08, volume: 0.4 }] },
  ],
}

function fakeContext(state: 'suspended' | 'running' = 'suspended') {
  const started: number[] = []
  const node = () => ({
    connect: vi.fn((next: unknown) => next),
    disconnect: vi.fn(),
    gain: param(),
    frequency: param(),
    Q: param(),
    start: vi.fn((t: number) => started.push(t)),
    stop: vi.fn(),
    type: '',
    buffer: null,
  })
  function param() {
    return {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    }
  }
  return {
    started,
    context: {
      state,
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      resume: vi.fn(async function (this: { state: string }) {
        this.state = 'running'
      }),
      close: vi.fn(async () => {}),
      createOscillator: vi.fn(node),
      createGain: vi.fn(node),
      createBiquadFilter: vi.fn(node),
      createBufferSource: vi.fn(node),
      createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(44100) })),
    } as unknown as AudioContext,
  }
}

describe('browserAudio', () => {
  it('makes no context before the first Play', () => {
    const make = vi.fn()
    browserAudio(make)
    expect(make).not.toHaveBeenCalled()
  })

  it('makes one on the first Play, resumes it and starts the sound’s voices', async () => {
    const { context, started } = fakeContext()
    const make = vi.fn(() => context)
    const output = browserAudio(make)
    expect(output.started()).toBe(false)
    await output.play(content, { kind: 'sound', id: 'coin' })
    await output.play(content, { kind: 'sound', id: 'coin' })
    expect(make).toHaveBeenCalledTimes(1)
    expect(context.resume).toHaveBeenCalledTimes(1)
    expect(output.started()).toBe(true)
    expect(started.length).toBeGreaterThan(0)
  })

  it('plays through the overall volume the file sets', async () => {
    const { context } = fakeContext()
    const gains: { gain: { value: number }; connect: ReturnType<typeof vi.fn> }[] = []
    const createGain = context.createGain as unknown as ReturnType<typeof vi.fn>
    const original = createGain.getMockImplementation() as () => (typeof gains)[number]
    createGain.mockImplementation(() => {
      const gain = original()
      gains.push(gain)
      return gain
    })
    const output = browserAudio(() => context)
    await output.play({ ...content, master_gain: 0.25 }, { kind: 'sound', id: 'coin' })
    const master = gains.find((gain) => gain.gain.value === 0.25)
    expect(master).toBeDefined()
    expect(master?.connect).toHaveBeenCalledWith(context.destination)
  })

  it('checks the sounds with the renderer it is given', async () => {
    const render = vi.fn(async () => [new Float32Array(48000), new Float32Array(48000)])
    const output = browserAudio(() => fakeContext().context, render)
    const found = await output.check(content)
    expect(render).toHaveBeenCalledWith(content, 'coin', expect.any(Number))
    expect(found).toEqual([{ sound: 'coin', kind: 'quiet', value: null }])
  })

  it('says in words when the sound is not in the file', async () => {
    const output = browserAudio(() => fakeContext().context)
    await expect(output.play(content, { kind: 'sound', id: 'boom' })).rejects.toThrow(
      'there is no sound called boom',
    )
  })

  it('closes the context it made', async () => {
    const { context } = fakeContext('running')
    const output = browserAudio(() => context)
    await output.play(content, { kind: 'sound', id: 'coin' })
    output.close()
    expect(context.close).toHaveBeenCalled()
    expect(output.started()).toBe(false)
  })
})
