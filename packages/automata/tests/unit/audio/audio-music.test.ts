import { describe, expect, it } from 'vitest'
import { AudioGraph } from '#src/features/audio/audio-graph.ts'
import { MusicSlot } from '#src/features/audio/audio-music.ts'
import { CUT_SECONDS } from '#src/features/audio/audio-voices.ts'
import {
  type FakeAudioContext,
  type FakeGainNode,
  fakeAudioContext,
  fakeBuffer,
} from '#src/features/audio/testing/fake-audio-context.ts'

// Decoded music (M5 spec §4.6, M5-D9: core plays short loops and menu beds; streaming is Plus) and ducking:
// one track in the slot at a time, a duck a gain of its own per
// bus so it never overwrites the player's level, and the deepest duck in force holds.

async function running(): Promise<{ graph: AudioGraph; context: FakeAudioContext; music: MusicSlot }> {
  const context = fakeAudioContext()
  const graph = new AudioGraph()
  graph.buildIfNeeded(() => context)
  await graph.resumeUnlessRunning()
  return { graph, context, music: new MusicSlot(graph) }
}

/** The duck node after a bus's level node. */
const duckOf = (graph: AudioGraph, bus: 'music' | 'sfx') =>
  (graph.input(bus) as unknown as FakeGainNode).targets[0] as FakeGainNode
const targets = (node: FakeGainNode) => node.automation.filter((step) => step.method === 'setTargetAtTime')

describe('MusicSlot', () => {
  it('loops a track on the music bus from where it is asked to start, between its loop points', async () => {
    const { graph, context, music } = await running()
    music.play(fakeBuffer('menu', 30), { fromSeconds: 2, loop: { start: 1, end: 20 } })
    expect(context.started).toEqual([
      expect.objectContaining({ alias: 'menu', loop: true, loopStart: 1, loopEnd: 20, offset: 2 }),
    ])
    const level = context.started[0]?.target as FakeGainNode
    expect(level.targets).toEqual([graph.input('music')])
  })

  it('loops the whole track when no loop points are given', async () => {
    const { context, music } = await running()
    music.play(fakeBuffer('bed', 8))
    expect(context.started[0]).toMatchObject({ loop: true, loopStart: 0, loopEnd: 0 })
  })

  it('replaces the playing track, cutting the old one', async () => {
    const { context, music } = await running()
    music.play(fakeBuffer('one'))
    music.play(fakeBuffer('two'))
    expect(context.stopped).toEqual([{ alias: 'one', when: CUT_SECONDS }])
    expect(context.started.map((started) => started.alias)).toEqual(['one', 'two'])
  })

  it('fades a stop out over the seconds given, then stops', async () => {
    const { context, music } = await running()
    music.play(fakeBuffer('menu'))
    music.stop(0.5)
    const level = context.started[0]?.target as FakeGainNode
    expect(level.automation.at(-1)).toEqual({ method: 'linearRampToValueAtTime', value: 0, at: 0.5 })
    expect(context.stopped).toEqual([{ alias: 'menu', when: 0.5 }])
    music.stop(0.5) // nothing playing: nothing to stop
    expect(context.stopped).toHaveLength(1)
  })
})

describe('AudioGraph.duck', () => {
  it('takes a bus down by the amount for the seconds, then back up, on its own duck node', async () => {
    const { graph } = await running()
    graph.duck('music', 0.6, 0.5)
    expect(targets(duckOf(graph, 'music')).map(({ value, at }) => ({ value, at }))).toEqual([
      { value: 0.4, at: 0 },
      { value: 1, at: 0.5 },
    ])
    expect((graph.input('music') as unknown as FakeGainNode).gain.value).toBe(1) // the player's level is untouched
    expect(targets(duckOf(graph, 'sfx'))).toEqual([])
  })

  it('holds the deepest duck in force until it ends, then the next deepest', async () => {
    const { graph } = await running()
    graph.duck('music', 0.6, 0.5)
    graph.duck('music', 0.8, 0.2)
    const last = targets(duckOf(graph, 'music')).slice(-3)
    expect(
      last.map(({ value = 0, at }) => ({ value: Number(value.toFixed(3)), at: Number(at.toFixed(3)) })),
    ).toEqual([
      { value: 0.2, at: 0 },
      { value: 0.4, at: 0.2 },
      { value: 1, at: 0.5 },
    ])
  })

  it('ducks every bus when asked to duck master, and nothing before the build', async () => {
    const unbuilt = new AudioGraph()
    unbuilt.duck('music', 0.5, 1) // no graph: nothing to do, nothing thrown
    const { graph } = await running()
    graph.duck('master', 0.5, 1)
    expect(targets(duckOf(graph, 'music'))[0]?.value).toBe(0.5)
    expect(targets(duckOf(graph, 'sfx'))[0]?.value).toBe(0.5)
  })
})
