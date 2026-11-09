import { describe, expect, it } from 'vitest'
import { audio, log, noteFrame } from '#src/app/story-feel-audio.ts'

// The story hears its sim: the event map's sound plays once the audio is unlocked, and the music rules read the guard's mode.
// Core's audio and the presentation bus are stand-ins here (the real ones need a browser); the served journeys play the
// real thing.

type Listener = (fact: unknown) => void

/** A Web Audio stand-in that accepts every call and every setting, and counts the sources started. */
function anyNode(started: string[]): unknown {
  const node: unknown = new Proxy(() => undefined, {
    get: (_target, key) =>
      key === 'start' ? () => started.push('source') : key === 'context' ? context : node,
    apply: () => node,
    set: () => true,
  })
  const context = new Proxy({}, { get: (_target, key) => (key === 'currentTime' ? 0 : node) })
  return node
}

function fakeServices() {
  const listeners = new Map<string, Listener[]>()
  const started: string[] = []
  const input = anyNode(started)
  const bus = {
    subscribe: (name: string, listener: Listener) => {
      listeners.set(name, [...(listeners.get(name) ?? []), listener])
      return () =>
        listeners.set(
          name,
          (listeners.get(name) ?? []).filter((each) => each !== listener),
        )
    },
  }
  const services = { audio: { unlocked: { get: () => true }, input: () => input, duck() {} }, bus }
  const emit = (name: string, fact: unknown) => {
    for (const listener of listeners.get(name) ?? []) listener(fact)
  }
  return { services, emit, started }
}

describe('the story’s feel and audio', () => {
  it('counts what the player saw, frame by frame, for a debug panel or a journey', () => {
    const before = { ...log.felt, words: [...log.felt.words] }
    const still = { offset: [0, 0], flash: null, tint: null, words: [] }
    noteFrame(still as never)
    expect(log.felt).toEqual(before)
    noteFrame({
      offset: [2, 0],
      flash: { colour: 'white', alpha: 0.5 },
      tint: { colour: 'red', alpha: 0.2 },
      words: [{ words: 'Gate!' }, { words: undefined }],
    } as never)
    expect(log.felt.shake).toBe(before.shake + 1)
    expect(log.felt.flash).toBe(before.flash + 1)
    expect(log.felt.tint).toBe(before.tint + 1)
    expect(log.felt.words).toEqual([...before.words, 'Gate!'])
  })

  it('plays the event map’s sound when the keeper speaks, and undoes itself at shutdown', () => {
    const { services, emit, started } = fakeServices()
    const stop = audio(services as never)
    log.cues.length = 0
    emit('sim.step', {
      tick: 1,
      events: [{ type: 'narrative.line', payload: { graph: 'keeper', id: 'keeper.hello' } }],
    })
    expect(log.cues).toEqual(['talk'])
    expect(started).not.toHaveLength(0)
    stop?.()
    emit('sim.step', { tick: 2, events: [{ type: 'narrative.line', payload: {} }] })
    expect(log.cues).toEqual(['talk'])
  })

  it('knows no music tracks until a person puts some in assets/music', () => {
    expect(log.tracks).toEqual([])
  })
})
