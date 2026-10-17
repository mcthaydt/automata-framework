import { describe, expect, it } from 'vitest'
import { AudioGraph } from './audio-graph.js'
import { type FakeAudioContext, type FakeGainNode, fakeAudioContext } from './testing/fake-audio-context.js'

// The Web Audio graph (M5 spec §4.6), ported from FloorFifty `managers/audio/graph.ts` at `ac72660` without its
// hall, echo, vintage stage or analyser: one gain per bus, then a duck of its own, into master; master is the
// player's master gain × the host's gain × mute × unfocused-mute (A-b's product).

function built(): { graph: AudioGraph; context: FakeAudioContext } {
  const context = fakeAudioContext()
  const graph = new AudioGraph()
  graph.buildIfNeeded(() => context)
  return { graph, context }
}

const node = (graph: AudioGraph, bus: Parameters<AudioGraph['input']>[0]) =>
  graph.input(bus) as unknown as FakeGainNode

describe('AudioGraph: build and gains', () => {
  it('builds nothing until asked, and one context however often it is asked', () => {
    const graph = new AudioGraph()
    let built = 0
    const create = () => {
      built += 1
      return fakeAudioContext()
    }
    expect(graph.context).toBeUndefined()
    expect(graph.input('sfx')).toBeUndefined()
    expect(graph.buildIfNeeded(create)).toBe(true)
    expect(graph.buildIfNeeded(create)).toBe(false)
    expect(built).toBe(1)
  })

  it('routes each bus through a duck of its own into master, and master into the speakers', () => {
    const { graph, context } = built()
    const master = node(graph, 'master')
    expect(master.targets).toEqual([context.destination])
    for (const bus of ['music', 'sfx', 'ui', 'voice'] as const) {
      const [duck] = node(graph, bus).targets as FakeGainNode[]
      expect(duck).toBeDefined()
      expect(duck).not.toBe(master)
      expect(duck?.targets).toEqual([master])
    }
  })

  it('sets master to player master × host gain, silenced by a mute or an unfocused window (A-b)', () => {
    const { graph } = built()
    const master = node(graph, 'master')
    graph.setGain('master', 0.5)
    graph.setHostGain(0.4)
    expect(master.gain.value).toBeCloseTo(0.2)
    graph.setMuted(true)
    expect(master.gain.value).toBe(0)
    graph.setMuted(false)
    graph.setUnfocused(true)
    expect(master.gain.value).toBe(0)
    graph.setUnfocused(false)
    expect(master.gain.value).toBeCloseTo(0.2)
  })

  it('keeps the levels set before the build, so the first sound is already at them', () => {
    const graph = new AudioGraph()
    graph.setGain('music', 0.3)
    graph.setHostGain(0.5)
    graph.buildIfNeeded(() => fakeAudioContext())
    expect(node(graph, 'music').gain.value).toBeCloseTo(0.3)
    expect(node(graph, 'master').gain.value).toBeCloseTo(0.5)
  })

  it('clamps the host gain and the player gains into 0..1', () => {
    const { graph } = built()
    graph.setHostGain(1.5)
    expect(node(graph, 'master').gain.value).toBe(1)
    graph.setHostGain(-1)
    expect(node(graph, 'master').gain.value).toBe(0)
    graph.setGain('sfx', 2)
    expect(graph.gain('sfx')).toBe(1)
  })

  it("changes only the bus it is given, gliding there rather than stepping (FloorFifty's level glide)", () => {
    const { graph } = built()
    graph.setGain('sfx', 0.25)
    expect(node(graph, 'sfx').gain.value).toBe(0.25)
    expect(node(graph, 'sfx').automation.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 0.25 })
    expect(node(graph, 'music').gain.value).toBe(1)
    expect(graph.gain('sfx')).toBe(0.25)
  })
})

describe('AudioGraph: sleep, wake and gestures', () => {
  it('puts a running graph to sleep and wakes it', async () => {
    const { graph, context } = built()
    await graph.resumeUnlessRunning()
    await graph.sleep()
    expect(context.state).toBe('suspended')
    expect(graph.silenced).toBe(true)
    await graph.wake()
    expect(context.state).toBe('running')
    expect(graph.silenced).toBe(false)
  })

  it('leaves a graph that was not running alone, so waking never starts sound nobody unlocked', async () => {
    const { graph, context } = built()
    await graph.sleep()
    await graph.wake()
    expect(context.state).toBe('suspended')
    expect(context.resumed).toBe(0)
  })

  it('wakes a graph the system interrupted, which sleep never saw running', async () => {
    const { graph, context } = built()
    await graph.resumeUnlessRunning()
    context.interrupt()
    expect(graph.silenced).toBe(true)
    await graph.wake()
    expect(context.state).toBe('running')
  })

  it('resumes on a gesture only a graph the system stopped while in view', async () => {
    const { graph, context } = built()
    await graph.resumeUnlessRunning()
    await context.suspend() // the system, not sleep
    await graph.resumeOnGesture()
    expect(context.state).toBe('running')

    await graph.sleep()
    await graph.resumeOnGesture()
    expect(context.state).toBe('suspended') // asleep: left for wake
  })

  it('builds nothing on sleep, wake or a gesture before an unlock (A-c)', async () => {
    const graph = new AudioGraph()
    await graph.sleep()
    await graph.wake()
    await graph.resumeOnGesture()
    await graph.resumeUnlessRunning()
    expect(graph.context).toBeUndefined()
    expect(graph.silenced).toBe(false)
  })
})
