// The `figure-action` content kind (spec 8.3): an action is a clip with an envelope, a wind-up (anticipation), the
// action itself and a recovery back to the gait, written as keyed poses and compiled to the clip the one player
// (`evaluate`) plays. Ported from the figure source's actor actions: its envelope, not its pose-spec.

import { describe, expect, it } from 'vitest'
import { clipsWithActions, compileAction, NEUTRAL_POSE } from '#src/features/figures/clips/figure-action.ts'
import { type FigureAction, figureActionSchema } from '#src/features/figures/content/figure-action.schema.ts'

const nod: FigureAction = {
  mask: ['head'],
  anticipation: 0.1,
  action: 0.7,
  recovery: 0.2,
  keys: [
    { t: 0.1, pose: 'nod-down' },
    { t: 0.5, pose: 'nod-up', ease: 'inOut' },
  ],
}

describe('compileAction', () => {
  it('is as long as its wind-up and its action, and ends when the sim says', () => {
    const clip = compileAction(nod)
    expect(clip.length).toBe(0.8)
    expect(clip.loop).toBe('once')
    expect(compileAction({ ...nod, hold: true }).loop).toBe('hold')
  })
  it('blends in over the wind-up (or `enter`) and out over the recovery', () => {
    expect(compileAction(nod).blend).toEqual({ inMs: 100, outMs: 200 })
    expect(compileAction({ ...nod, enter: 0 }).blend).toEqual({ inMs: 0, outMs: 200 })
    expect(compileAction({ ...nod, anticipation: 0.01, action: 0.79 }).blend?.inMs).toBe(80)
  })
  it('starts on the body as it stands, since its first key is after the start', () => {
    const [first, second] = compileAction(nod).keys
    expect(first).toEqual({ t: 0, pose: NEUTRAL_POSE })
    expect(second).toMatchObject({ t: 0.1, pose: 'nod-down' })
  })
  it('starts on its first key when that is at 0', () => {
    const clip = compileAction({
      ...nod,
      keys: [
        { t: 0, pose: 'a' },
        { t: 0.5, pose: 'b' },
      ],
    })
    expect(clip.keys[0]).toMatchObject({ t: 0, pose: 'a' })
    expect(clip.keys).toHaveLength(3)
  })
  it('holds its last pose to the end of the action', () => {
    const keys = compileAction(nod).keys
    const last = keys.at(-1)
    expect(last).toMatchObject({ t: compileAction(nod).length, pose: 'nod-up' })
    expect(keys).toHaveLength(4)
  })
  it('eases between keys smoothly unless a key names its own ease', () => {
    const keys = compileAction(nod).keys
    expect(keys[1]?.ease).toBe('smooth')
    expect(keys[2]?.ease).toBe('inOut')
  })
  it('keeps the mask', () => {
    expect(compileAction(nod).mask).toEqual(['head'])
  })
})

describe('figureActionSchema', () => {
  const read = (action: unknown) => figureActionSchema.safeParse(action)
  it('reads a well-formed action', () => {
    expect(read(nod).success).toBe(true)
  })
  it('refuses keys out of order, saying which', () => {
    const bad = read({
      ...nod,
      keys: [
        { t: 0.5, pose: 'a' },
        { t: 0.1, pose: 'b' },
      ],
    })
    expect(bad.success).toBe(false)
    expect(bad.error?.issues[0]?.path).toEqual(['keys', 1, 't'])
    expect(bad.error?.issues[0]?.message).toBe('key 1 at 0.1 s is not after key 0 at 0.5 s')
  })
  it('refuses a key after the end of the action', () => {
    const bad = read({
      ...nod,
      keys: [
        { t: 0.1, pose: 'a' },
        { t: 0.9, pose: 'b' },
      ],
    })
    expect(bad.error?.issues[0]?.path).toEqual(['keys', 1, 't'])
    expect(bad.error?.issues[0]?.message).toBe('key 1 at 0.9 s is after the end of the action, 0.8 s')
  })
  it('refuses an action with no time or no keys or no mask', () => {
    expect(read({ ...nod, anticipation: 0, action: 0 }).success).toBe(false)
    expect(read({ ...nod, keys: [] }).success).toBe(false)
    expect(read({ ...nod, mask: [] }).success).toBe(false)
  })
  it('reads hold as step in a key’s ease', () => {
    const ok = read({ ...nod, keys: [{ t: 0.1, pose: 'a', ease: 'hold' }] })
    expect(ok.data?.keys[0]?.ease).toBe('step')
  })
})

describe('clipsWithActions', () => {
  const clip = compileAction(nod)
  it('lists the authored clips and every action as a clip', () => {
    expect(clipsWithActions({ roll: clip }, { nod })).toEqual({ roll: clip, nod: clip })
  })
  it('refuses an id that is both a clip and an action, naming it', () => {
    expect(() => clipsWithActions({ nod: clip }, { nod })).toThrow(
      'There is a figure-clip and a figure-action both called "nod"',
    )
  })
})
