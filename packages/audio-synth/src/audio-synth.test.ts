// The driver (M6.10a step 4, M6 spec §4.10, §5): sim events answered when the drawn tick reaches them, once each, by the cue the
// event map names; beds started and stopped by id; and the coverage check over the events a game declares. It never writes the sim.
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import type { AudioContent, BusId } from './audio.schema'
import { coverage, createAudioSynth } from './audio-synth'
import type { MixerPort } from './mixer'
import { type FakeNode, fakeContext } from './testing/fake-audio'

const CONTENT = parse(`
[[cue]]
id = "bang"
bus = "sfx"
world = true
voices = [{ tone = "sine", from = 90, to = 30, length = 0.6, volume = 0.8 }]

[[cue]]
id = "creak"
bus = "sfx"
voices = [{ hiss = [1800, 3800], length = 0.1, volume = 0.1 }]

[[cue]]
id = "tick"
bus = "ui"
voices = [{ tone = "square", from = 1400, to = 1400, length = 0.03, volume = 0.01 }]

[[bed]]
id = "hum"
bus = "music"
volume = 0.04
drones = [{ wave = "sine", freq = 55 }]

[[event]]
on = "noise.bang"
cue = "bang"

[[event]]
on = "door.open"
silent = "the animation carries it"

[[event]]
on = "door.*"
cue = "creak"

[[event]]
on = "ui.tick"
cue = "tick"
`) as unknown as AudioContent

function setup(content: AudioContent = CONTENT) {
  const ctx = fakeContext()
  const nodes = new Map<BusId, FakeNode>()
  const ducks: unknown[] = []
  const port: MixerPort = {
    input: (bus) => {
      let n = nodes.get(bus)
      if (n === undefined) {
        n = (ctx.createGain as () => FakeNode)()
        nodes.set(bus, n)
      }
      return n as never
    },
    duck: (...args) => {
      ducks.push(args)
    },
  }
  const synth = createAudioSynth({ content: () => content, port })
  const oscillators = (): number => ctx.nodes.filter((n) => n.kind === 'oscillator').length
  return { ctx, nodes, ducks, synth, oscillators }
}
const ev = (type: string, payload: unknown = {}) => ({ type, payload })

describe('events at the drawn tick', () => {
  it('plays the cue an event maps to when the drawn tick reaches it, and not before', () => {
    const { synth, oscillators } = setup()
    synth.hear(10, [ev('noise.bang')])
    expect(synth.frame(9)).toEqual({ played: [] })
    expect(oscillators()).toBe(0)
    expect(synth.frame(10)).toEqual({ played: ['bang'] })
    expect(oscillators()).toBe(1)
  })
  it('plays an event once, however often it is heard or the frame is asked', () => {
    const { synth, oscillators } = setup()
    synth.hear(3, [ev('noise.bang')])
    synth.hear(3, [ev('noise.bang')])
    synth.frame(3)
    synth.frame(4)
    expect(oscillators()).toBe(1)
  })
  it('takes the first row that matches: a silent row before a pattern keeps its event quiet', () => {
    const { synth } = setup()
    synth.hear(1, [ev('door.open'), ev('door.shut')])
    expect(synth.frame(1)).toEqual({ played: ['creak'] })
  })
  it('plays nothing for an event no row names', () => {
    const { synth } = setup()
    synth.hear(1, [ev('unrelated')])
    expect(synth.frame(1)).toEqual({ played: [] })
  })
  it('drops an event the picture passed long ago, and answers one a moment behind', () => {
    const { synth } = setup()
    synth.hear(0, [ev('noise.bang')])
    expect(synth.frame(100).played).toEqual([])
    synth.hear(90, [ev('noise.bang')])
    expect(synth.frame(100).played).toEqual(['bang'])
  })
  it('pans a world cue from the listener to where its event happened', () => {
    const { synth, ctx } = setup()
    synth.hear(1, [ev('noise.bang', { at: { x: 5, z: 0 } })])
    synth.frame(1, { x: 0, z: 0, yaw: 0 })
    expect(ctx.nodes.some((n) => n.kind === 'panner')).toBe(true)
    const none = setup()
    none.synth.hear(1, [ev('noise.bang', { at: { x: 5, z: 0 } })])
    none.synth.frame(1)
    expect(none.ctx.nodes.some((n) => n.kind === 'panner')).toBe(false)
  })
  it('picks a hiss’s centre the same way every run', () => {
    const centre = () => {
      const { synth, ctx } = setup()
      synth.hear(1, [ev('door.shut')])
      synth.frame(1)
      return (ctx.nodes.find((n) => n.kind === 'biquad') as FakeNode).params.frequency?.value
    }
    expect(centre()).toBe(centre())
  })
  it('reads the content live: an edit shows on the next event', () => {
    let table = CONTENT
    const ctx = fakeContext()
    const node = (ctx.createGain as () => FakeNode)()
    const synth = createAudioSynth({
      content: () => table,
      port: { input: () => node as never, duck: () => {} },
    })
    synth.hear(1, [ev('ui.tick')])
    expect(synth.frame(1).played).toEqual(['tick'])
    table = { ...CONTENT, event: [{ on: 'ui.tick', cue: 'creak' }] }
    synth.hear(2, [ev('ui.tick')])
    expect(synth.frame(2).played).toEqual(['creak'])
  })
})

describe('beds', () => {
  it('starts a bed by id once and stops it', () => {
    const { synth, oscillators, ctx } = setup()
    synth.startBed('hum')
    synth.startBed('hum')
    expect(oscillators()).toBe(1)
    expect(synth.playing()).toEqual(['hum'])
    synth.stopBed('hum')
    expect(synth.playing()).toEqual([])
    expect(ctx.nodes.flatMap((n) => n.calls).filter((c) => c.startsWith('stop'))).toHaveLength(1)
  })
  it('does nothing for a bed the content lacks, and stopping one that is not playing', () => {
    const { synth, oscillators } = setup()
    synth.startBed('nope')
    synth.stopBed('hum')
    expect(oscillators()).toBe(0)
  })
})

describe('coverage', () => {
  const wanted = new Map([
    ['noise.bang', 'GameEvents'],
    ['door.open', 'hotspot'],
    ['door.shut', 'hotspot'],
    ['agent.nurse.hunt', 'systems'],
  ])
  it('lists the events nothing answers, the silent ones with their reasons, and what is cued', () => {
    const c = coverage(CONTENT, wanted)
    expect(c.ok).toBe(false)
    expect(c.missing).toEqual([{ event: 'agent.nurse.hunt', from: 'systems' }])
    expect(c.silent).toEqual([{ event: 'door.open', why: 'the animation carries it' }])
    expect(c.events).toBe(4)
    expect(c.cued).toBe(2)
  })
  it('is ok when every event is cued or silent with a reason', () => {
    expect(
      coverage(
        CONTENT,
        new Map([
          ['noise.bang', 'x'],
          ['door.open', 'y'],
        ]),
      ).ok,
    ).toBe(true)
  })
})
