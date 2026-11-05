import { describe, expect, it } from 'vitest'
import { AudioGraph } from '#src/audio/audio-graph.ts'
import { CUT_SECONDS, MAX_VOICES, Voices } from '#src/audio/audio-voices.ts'
import {
  type FakeAudioContext,
  type FakeGainNode,
  fakeAudioContext,
  fakeBuffer,
} from '#src/audio/testing/fake-audio-context.ts'

// One-shots (M5 spec §4.6, A-d), from FloorFifty `managers/audio/voices.ts` and `model.ts` at `ac72660`: at most
// MAX_VOICES at once, the oldest cut first (a short fade, then stop, so it never clicks); nothing plays or queues
// while the graph is silenced, and a sleep drops the sounds still decoding ("asleep is silent, not queued").

async function running(): Promise<{ graph: AudioGraph; context: FakeAudioContext; voices: Voices }> {
  const context = fakeAudioContext()
  const graph = new AudioGraph()
  graph.buildIfNeeded(() => context)
  await graph.resumeUnlessRunning()
  return { graph, context, voices: new Voices(graph) }
}

const decoded = (alias: string) => async () => fakeBuffer(alias)

describe('Voices', () => {
  it('plays a sound through a level of its own into its bus, at its gain and rate', async () => {
    const { graph, context, voices } = await running()
    await voices.play(decoded('chime'), { bus: 'sfx', gain: 0.5, rate: 1.5 })
    expect(context.started).toEqual([expect.objectContaining({ alias: 'chime', rate: 1.5 })])
    const level = context.started[0]?.target as FakeGainNode
    expect(level.gain.value).toBe(0.5)
    expect(level.targets).toEqual([graph.input('sfx')])
    expect(voices.active).toBe(1)
  })

  it(`cuts the oldest voice when the ${MAX_VOICES + 1}th overlaps (A-d)`, async () => {
    const { context, voices } = await running()
    for (let index = 0; index < MAX_VOICES; index++)
      await voices.play(decoded(`hit-${index}`), { bus: 'sfx' })
    expect(context.stopped).toEqual([])
    await voices.play(decoded('hit-new'), { bus: 'sfx' })
    expect(context.stopped).toEqual([{ alias: 'hit-0', when: CUT_SECONDS }])
    const cut = context.gains.find((gain) =>
      gain.automation.some((step) => step.method === 'linearRampToValueAtTime'),
    )
    expect(cut?.automation.at(-1)).toEqual({ method: 'linearRampToValueAtTime', value: 0, at: CUT_SECONDS })
    context.advance(CUT_SECONDS)
    expect(voices.active).toBe(MAX_VOICES)
  })

  it('frees the slot of a voice that played out', async () => {
    const { context, voices } = await running()
    await voices.play(decoded('chime'), { bus: 'ui' })
    context.end('chime')
    expect(voices.active).toBe(0)
  })

  it('drops a sound asked for while silenced, and never plays it later', async () => {
    const { graph, context, voices } = await running()
    await graph.sleep()
    await voices.play(decoded('chime'), { bus: 'sfx' })
    await graph.wake()
    expect(context.started).toEqual([])
  })

  it('drops a sound still decoding when the pending ones are cancelled', async () => {
    const { context, voices } = await running()
    let finish: (buffer: AudioBuffer) => void = () => undefined
    const playing = voices.play(() => new Promise((resolve) => (finish = resolve)), { bus: 'sfx' })
    voices.cancelPending()
    finish(fakeBuffer('late'))
    await playing
    expect(context.started).toEqual([])
  })

  it('plays nothing before the graph is built', async () => {
    const voices = new Voices(new AudioGraph())
    let decodes = 0
    await voices.play(
      async () => {
        decodes += 1
        return fakeBuffer('chime')
      },
      { bus: 'sfx' },
    )
    expect(decodes).toBe(0)
  })
})
