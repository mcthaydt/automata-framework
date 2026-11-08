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
