// audioStage: a game's own audio player. Cues play for the sim's events once the audio is unlocked, music follows the
// game's state through the rules, and shutting down stops both. Core's audio and bus are fakes here.
import { fakeClock } from '@automata/framework/testing'
import type { SimEvent } from '@automata/sim'
import { parse } from 'smol-toml'
import { describe, expect, it, vi } from 'vitest'
import { audioStage } from '#src/app/audio-stage.ts'
import type { AudioContent } from '#src/shared/audio.schema.ts'
import { type FakeContext, type FakeNode, fakeContext } from '#src/testing/fake-audio.ts'

const CONTENT = parse(`
[[cue]]
id = "coin"
bus = "sfx"
voices = [{ tone = "sine", from = 880, to = 1320, length = 0.2, volume = 0.5 }]

[[event]]
on = "coin.picked"
cue = "coin"

[[slot]]
id = "calm"
mode = "loop"
volume = 0.5
fade = 1

[[slot]]
id = "chase"
mode = "loop"
volume = 0.9
fade = 1

[[music_rule]]
when = { mode = "chase" }
slot = "chase"

[[music_rule]]
when = { mode = "calm" }
slot = "calm"
`) as unknown as AudioContent

function setup(extra: Partial<Parameters<typeof audioStage>[0]> = {}) {
  const context = fakeContext() as FakeContext & Record<string, unknown>
  context.decodeAudioData = vi.fn(() => Promise.resolve({}))
  const inputs = new Map<string, FakeNode>()
  let unlocked = false
  const ducks: unknown[] = []
  const audio = {
    unlocked: { get: () => unlocked },
    input: (name: string) => {
      if (!unlocked) throw new Error('audio is not unlocked yet')
      let node = inputs.get(name)
      if (node === undefined) {
        node = (context.createGain as () => FakeNode)()
        inputs.set(name, node)
      }
      return node
    },
    duck: (...args: unknown[]) => void ducks.push(args),
  }
  const listeners: ((fact: { tick: number; events: readonly SimEvent[] }) => void)[] = []
  const bus = {
    subscribe: (_name: string, listener: (typeof listeners)[number]) => {
      listeners.push(listener)
      return () => void listeners.splice(listeners.indexOf(listener), 1)
    },
  }
  const clock = fakeClock()
  let mode = 'calm'
  const faults: string[] = []
  const stop = audioStage({
    content: () => CONTENT,
    tracks: { calm: '/m/calm.ogg', chase: '/m/chase.ogg' },
    state: () => ({ mode }),
    clock,
    load: () => Promise.resolve(new ArrayBuffer(1)),
    onFault: (m) => void faults.push(m),
    ...extra,
  })({ audio, bus } as never)
  const step = (tick: number, ...types: string[]) => {
    for (const l of listeners) l({ tick, events: types.map((type) => ({ type, payload: {} }) as SimEvent) })
  }
  const sources = () => context.nodes.filter((n) => n.kind === 'buffer')
  const oscillators = () => context.nodes.filter((n) => n.kind === 'oscillator')
  const flush = async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve()
  }
  return {
    context,
    clock,
    stop,
    step,
    sources,
    oscillators,
    flush,
    faults,
    listeners,
    unlock: () => (unlocked = true),
    setMode: (next: string) => (mode = next),
  }
}

describe('audioStage: cues', () => {
  it('plays the cue an event maps to, on its bus, once the audio is unlocked', () => {
    const { step, oscillators, unlock } = setup()
    step(1, 'coin.picked')
    expect(oscillators()).toHaveLength(0)
    unlock()
    step(2, 'coin.picked')
    expect(oscillators()).toHaveLength(1)
  })

  it('stays silent for an event no row answers', () => {
    const { step, oscillators, unlock } = setup()
    unlock()
    step(1, 'something.else')
    expect(oscillators()).toHaveLength(0)
  })

  it('stops listening when the game shuts down', () => {
    const { stop, listeners } = setup()
    expect(listeners).toHaveLength(1)
    stop?.()
    expect(listeners).toHaveLength(0)
  })
})

describe('audioStage: music', () => {
  it('starts the track the rules pick once the audio is unlocked, and switches when the state changes', async () => {
    const { clock, unlock, sources, setMode, flush } = setup()
    clock.advance(200)
    await flush()
    expect(sources()).toHaveLength(0)
    unlock()
    clock.advance(200)
    await flush()
    expect(sources()).toHaveLength(1)
    setMode('chase')
    clock.advance(200)
    await flush()
    expect(sources()).toHaveLength(2)
  })

  it('goes quiet when no rule holds', async () => {
    const { clock, unlock, sources, setMode, flush } = setup()
    unlock()
    clock.advance(200)
    await flush()
    setMode('nothing')
    clock.advance(200)
    await flush()
    const stopped = sources()[0]?.calls.some((c) => c.startsWith('stop'))
    expect(stopped).toBe(true)
  })

  it('stops the music at shutdown and asks for no more', async () => {
    const { clock, unlock, sources, stop, flush } = setup()
    unlock()
    clock.advance(200)
    await flush()
    stop?.()
    expect(sources()[0]?.calls.some((c) => c.startsWith('stop'))).toBe(true)
    clock.advance(1000)
    await flush()
    expect(sources()).toHaveLength(1)
  })

  it('reads the music rules live, so a saved change shows', async () => {
    let table = CONTENT
    const { clock, unlock, sources, flush } = setup({ content: () => table })
    unlock()
    clock.advance(200)
    await flush()
    expect(sources()).toHaveLength(1)
    table = { ...CONTENT, music_rule: [{ when: { mode: 'calm' }, slot: 'chase' }] }
    clock.advance(200)
    await flush()
    expect(sources()).toHaveLength(2)
  })

  it('plays no music, and says nothing, for a game with no slots', async () => {
    const { clock, unlock, sources, faults, flush } = setup({ content: () => ({}) })
    unlock()
    clock.advance(200)
    await flush()
    expect(sources()).toHaveLength(0)
    expect(faults).toEqual([])
  })
})
