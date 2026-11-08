// The mixer (M6.10a step 3; from the adventure source's `mixer.ts`): a cue plays on its core bus, a world cue is panned and
// attenuated from the listener, and a cue that dubs a bus ducks the others through core's `duck`. Core's audio graph owns the
// context, the buses, their levels and the master, so none of that is rebuilt here (M6 spec §4.10: never a second context).
import { describe, expect, it } from 'vitest'
import type { BusId, Cue, DuckRule } from '#src/shared/audio.schema.ts'
import { createMixer, DISTANCE, dbToGain, type MixerPort, PAN_WIDTH, spatial } from '#src/shared/mixer.ts'
import { type FakeNode, fakeContext } from '#src/testing/fake-audio.ts'

function port() {
  const ctx = fakeContext()
  const inputs = new Map<BusId, FakeNode>()
  const ducks: [BusId, number, number][] = []
  const p: MixerPort = {
    input: (bus) => {
      let node = inputs.get(bus)
      if (node === undefined) {
        node = (ctx.createGain as () => FakeNode)()
        inputs.set(bus, node)
      }
      return node as never
    },
    duck: (bus, amount, seconds) => {
      ducks.push([bus, amount, seconds])
    },
  }
  return { ctx, p, inputs, ducks }
}
const BLIP: Cue = {
  id: 'blip',
  bus: 'sfx',
  voices: [{ tone: 'sine', from: 440, to: 440, length: 0.2, volume: 0.1 }],
}
const SPEECH: Cue = { id: 'speech', bus: 'voice', voices: [{ hiss: 800, length: 1, volume: 0.1 }] }
const RULES: DuckRule[] = [{ bus: 'voice', duck: ['music', 'sfx'], db: -9, attack: 0.08, release: 0.4 }]

describe('the overall volume', () => {
  it('plays a cue through a gain of the overall volume into its bus', () => {
    const { ctx, p, inputs } = port()
    createMixer({ port: p, ducks: [], master: 0.5 }).play(BLIP, { when: 0 })
    const master = (ctx as unknown as { nodes: FakeNode[] }).nodes.find(
      (node) => node.kind === 'gain' && node.params.gain?.value === 0.5,
    )
    expect(master?.connections).toContain(inputs.get('sfx'))
  })

  it('adds no stage at full volume', () => {
    const { ctx, p } = port()
    createMixer({ port: p, ducks: [], master: 1 }).play(BLIP, { when: 0 })
    expect(
      (ctx as unknown as { nodes: FakeNode[] }).nodes.filter((node) => node.params.gain?.value === 0.5),
    ).toEqual([])
  })
})

describe('spatial', () => {
  const ears = { x: 0, z: 0, yaw: 0 }
  it('is full level and centred at the listener, and within the reference distance', () => {
    expect(spatial(ears, { x: 0, z: 0 })).toEqual({ pan: 0, gain: 1 })
    expect(spatial(ears, { x: 0, z: DISTANCE.ref }).gain).toBe(1)
  })
  it('pans toward the side the sound is on, to the pan width', () => {
    expect(spatial(ears, { x: 5, z: 0 }).pan).toBeCloseTo(PAN_WIDTH, 6)
    expect(spatial(ears, { x: -5, z: 0 }).pan).toBeCloseTo(-PAN_WIDTH, 6)
    expect(spatial(ears, { x: 0, z: 5 }).pan).toBeCloseTo(0, 6)
  })
  it('turns with the listener’s yaw', () => {
    expect(spatial({ x: 0, z: 0, yaw: Math.PI / 2 }, { x: 5, z: 0 }).pan).toBeCloseTo(0, 6)
  })
  it('falls off past the reference distance', () => {
    const g = spatial(ears, { x: 12, z: 0 }).gain
    expect(g).toBeCloseTo(DISTANCE.ref / (DISTANCE.ref + DISTANCE.rolloff * (12 - DISTANCE.ref)), 6)
    expect(g).toBeLessThan(1)
  })
})

describe('createMixer', () => {
  it('plays a cue into its bus’s input on core’s context', () => {
    const { p, inputs, ctx } = port()
    const mixer = createMixer({ port: p, ducks: RULES })
    mixer.play(BLIP, { when: 3, random: () => 0 })
    const osc = ctx.nodes.find((n) => n.kind === 'oscillator') as FakeNode
    const gain = ctx.nodes.find(
      (n) => n.kind === 'gain' && n.connections.includes(inputs.get('sfx') as FakeNode),
    )
    expect(osc.calls).toEqual(['start 3', 'stop 3.25'])
    expect(gain).toBeDefined()
  })
  it('pans and attenuates a world cue from the listener when it has a position', () => {
    const { p, ctx } = port()
    const mixer = createMixer({ port: p, ducks: [] })
    const world: Cue = { ...BLIP, world: true }
    mixer.play(world, { at: { x: 5, z: 0 } })
    expect(ctx.nodes.some((n) => n.kind === 'panner')).toBe(false)
    mixer.listener({ x: 0, z: 0, yaw: 0 })
    mixer.play(world, { at: { x: 5, z: 0 } })
    const panner = ctx.nodes.find((n) => n.kind === 'panner') as FakeNode
    expect(panner.params.pan?.value).toBeCloseTo(PAN_WIDTH, 6)
    // A cue that is not a world cue, or has no position, is not panned.
    mixer.play(BLIP, { at: { x: 5, z: 0 } })
    expect(ctx.nodes.filter((n) => n.kind === 'panner')).toHaveLength(1)
  })
  it('ducks the buses a rule names while a cue on its bus plays, for the cue’s length', () => {
    const { p, ducks } = port()
    const mixer = createMixer({ port: p, ducks: RULES })
    mixer.play(SPEECH, {})
    expect(ducks.map(([bus]) => bus)).toEqual(['music', 'sfx'])
    expect(ducks[0]?.[1]).toBeCloseTo(1 - dbToGain(-9), 6)
    expect(ducks[0]?.[2]).toBeCloseTo(1, 6)
  })
  it('ducks for the length the caller gives, and not at all for a no_duck cue or another bus', () => {
    const { p, ducks } = port()
    const mixer = createMixer({ port: p, ducks: RULES })
    mixer.play(SPEECH, { length: 3 })
    expect(ducks[0]?.[2]).toBe(3)
    ducks.length = 0
    mixer.play({ ...SPEECH, no_duck: true }, {})
    mixer.play(BLIP, {})
    expect(ducks).toEqual([])
  })
  it('holds a duck at least its attack, so a very short cue still ducks', () => {
    const { p, ducks } = port()
    createMixer({ port: p, ducks: RULES }).play(
      { ...SPEECH, voices: [{ hiss: 800, length: 0.01, volume: 0.1 }] },
      {},
    )
    expect(ducks[0]?.[2]).toBeCloseTo(0.08, 6)
  })
})

describe('dbToGain', () => {
  it('is 10^(db/20)', () => {
    expect(dbToGain(0)).toBe(1)
    expect(dbToGain(-20)).toBeCloseTo(0.1, 6)
  })
})
