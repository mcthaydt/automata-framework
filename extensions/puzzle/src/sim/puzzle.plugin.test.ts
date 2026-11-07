// P-c (engine): the adventure source's five puzzle-engine cases on the same toy room, played through `verb` commands
// in a real sim, plus the goal, mapped facts, entries and a restore.
import type { Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { createToy, loadScene, said, TOY, verb } from '../testing/toy-room'
import { type PuzzleDef, PuzzleState } from './index'

let sim: Sim | undefined
afterEach(() => sim?.dispose())
const glows: unknown[] = []
const toy = async () => {
  glows.length = 0
  sim = await createToy({ calls: { glow: (_ctx, call) => glows.push([call.action, call.pair]) } })
  return sim
}

describe('the puzzle interpreter (P-c, engine)', () => {
  it('matches the first action whose conditions hold, and lists gained items with the line', async () => {
    const s = await toy()
    expect(said(verb(s, { at: 'drawer' }))).toEqual([
      ['puzzle.gave', { item: 'key' }],
      ['puzzle.said', { action: 'drawer.key', at: 'drawer', line: 'drawerKey', gained: ['key'] }],
    ])
    expect(said(verb(s, { at: 'drawer' }))).toEqual([
      ['puzzle.gave', { item: 'shade' }],
      ['puzzle.gave', { item: 'bulb' }],
      [
        'puzzle.said',
        { action: 'drawer.parts', at: 'drawer', line: 'drawerParts', gained: ['shade', 'bulb'] },
      ],
    ])
    expect(s.resource(PuzzleState)).toMatchObject({
      facts: { doorOpen: false, drawer: 2 },
      items: ['bulb', 'key', 'shade'],
    })
  })

  it('treats a held item precisely: the key unlocks, a bare hand with the key unlocks, the shade does not', async () => {
    const s = await toy()
    verb(s, { at: 'drawer' })
    expect(said(verb(s, { at: 'door', held: 'key' }))).toEqual([
      ['puzzle.said', { action: 'door.unlock', at: 'door', line: 'doorUnlock', gained: [] }],
      ['puzzle.checkpoint', {}],
      ['puzzle.goal', {}],
    ])
    sim?.dispose()
    const t = await toy()
    verb(t, { at: 'drawer' })
    expect(said(verb(t, { at: 'door' }))[0]).toEqual([
      'puzzle.said',
      { action: 'door.bare', at: 'door', line: 'doorUnlock', gained: [] },
    ])
    sim?.dispose()
    const u = await toy()
    verb(u, { at: 'drawer' })
    verb(u, { at: 'drawer' })
    expect(said(verb(u, { at: 'door', held: 'shade' }))).toEqual([
      ['puzzle.said', { action: null, at: 'door', line: 'nothing', gained: [] }],
    ])
  })

  it('drops an item not held, and applies effects in order (not/any, noise)', async () => {
    const s = await toy()
    expect(said(verb(s, { at: 'door', held: 'key' }))).toEqual([
      ['puzzle.noise', { at: { x: 1, z: 2 }, loudness: 4, kind: 'bang' }],
      ['puzzle.said', { action: 'door.knock', at: 'door', line: 'knock', gained: [] }],
    ])
  })

  it('hands a noise to the game’s `noise` option on the verb’s step, as well as emitting it', async () => {
    const heard: unknown[] = []
    sim = await createToy({ noise: (ctx, noise) => heard.push([ctx.tick, noise]) })
    const tick = sim.tick
    expect(said(verb(sim, { at: 'door', held: 'key' }))[0]).toEqual([
      'puzzle.noise',
      { at: { x: 1, z: 2 }, loudness: 4, kind: 'bang' },
    ])
    expect(heard).toEqual([[tick, { at: { x: 1, z: 2 }, loudness: 4, kind: 'bang' }]])
  })

  it('combines a pair in either order, calls the game’s function, and falls back per verb', async () => {
    const s = await toy()
    verb(s, { at: 'drawer' })
    verb(s, { at: 'drawer' })
    expect(said(verb(s, { at: 'combine', pair: ['bulb', 'shade'] }))).toEqual([
      ['puzzle.gave', { item: 'lamp' }],
      ['puzzle.said', { action: 'lamp', at: 'combine', line: 'lampMade', gained: ['lamp'] }],
    ])
    expect(glows).toEqual([['lamp', ['bulb', 'shade']]])
    expect(said(verb(s, { at: 'combine', pair: ['lamp', 'key'] }))).toEqual([
      ['puzzle.said', { action: null, at: 'combine', line: 'noCombine', gained: [] }],
    ])
    expect(said(verb(s, { at: 'floor', held: 'lamp', point: { x: 0, z: 0 } }))).toEqual([
      ['puzzle.said', { action: null, at: 'floor', line: 'noFloor', gained: [] }],
    ])
  })

  it('reads a typed code as a fact', async () => {
    const s = await toy()
    expect(said(verb(s, { at: 'code', code: '41' }))).toEqual([])
    expect(said(verb(s, { at: 'code', code: '42' }))).toEqual([
      ['puzzle.said', { action: 'code', at: 'code', line: 'codeRight', gained: [] }],
      ['puzzle.goal', {}],
    ])
  })
})

describe('the puzzle plugin', () => {
  it('starts a `{ dialogue }` effect’s graph through the `dialogue` option, after the action’s line', async () => {
    const def: PuzzleDef = {
      ...TOY,
      hotspots: { ...TOY.hotspots, phone: { x: 0, z: 0 } },
      actions: [...TOY.actions, { id: 'phone', at: 'phone', then: [{ dialogue: 'call' }], say: 'pickUp' }],
    }
    const order: unknown[] = []
    sim = await createToy({ dialogue: (ctx, id) => order.push([ctx.tick, id]) }, { toy: def })
    const tick = sim.tick
    expect(said(verb(sim, { at: 'phone' }))).toEqual([
      ['puzzle.said', { action: 'phone', at: 'phone', line: 'pickUp', gained: [] }],
      ['puzzle.dialogue', { id: 'call' }],
    ])
    expect(order).toEqual([[tick, 'call']])
  })

  it('starts a `{ cutscene }` effect’s cutscene through the `cutscene` option, after the action’s line', async () => {
    const def: PuzzleDef = {
      ...TOY,
      hotspots: { ...TOY.hotspots, phone: { x: 0, z: 0 } },
      actions: [...TOY.actions, { id: 'phone', at: 'phone', then: [{ cutscene: 'ring' }], say: 'pickUp' }],
    }
    const order: unknown[] = []
    sim = await createToy({ cutscene: (ctx, id) => order.push([ctx.tick, id]) }, { toy: def })
    const tick = sim.tick
    expect(said(verb(sim, { at: 'phone' }))).toEqual([
      ['puzzle.said', { action: 'phone', at: 'phone', line: 'pickUp', gained: [] }],
      ['puzzle.cutscene', { id: 'ring' }],
    ])
    expect(order).toEqual([[tick, 'ring']])
  })

  it('ignores verbs while the `locked` option holds, and takes them again once it does not (a cutscene is playing)', async () => {
    let locked = true
    sim = await createToy({ locked: () => locked })
    expect(said(verb(sim, { at: 'drawer' }))).toEqual([])
    locked = false
    expect(said(verb(sim, { at: 'drawer' })).length).toBeGreaterThan(0)
  })

  it('tells the `verb` option which verb it took, what it said and whether it turned away', async () => {
    const def: PuzzleDef = {
      ...TOY,
      hotspots: { ...TOY.hotspots, phone: { x: 0, z: 0 } },
      actions: [...TOY.actions, { id: 'phone', at: 'phone', then: [{ dialogue: 'call' }], say: '' }],
    }
    const heard: unknown[] = []
    sim = await createToy({ verb: (_ctx, report) => heard.push(report) }, { toy: def })
    verb(sim, { at: 'drawer' })
    verb(sim, { at: 'phone' })
    verb(sim, { at: 'window' })
    verb(sim, { at: 'floor', held: 'lamp', point: { x: 0, z: 0 } })
    verb(sim, { at: 'door', held: 'key' })
    expect(heard).toEqual([
      { at: 'drawer', held: undefined, action: 'drawer.key', said: true, away: false },
      { at: 'phone', held: undefined, action: 'phone', said: false, away: true },
      { at: 'window', held: undefined, action: null, said: true, away: false },
      { at: 'floor', held: 'lamp', action: null, said: false, away: false },
      { at: 'door', held: 'key', action: 'door.unlock', said: true, away: false },
    ])
  })

  it('reports the goal once, when it first holds', async () => {
    const s = await toy()
    verb(s, { at: 'code', code: '42' })
    expect(said(verb(s, { at: 'code', code: '42' }))).toEqual([
      ['puzzle.said', { action: 'code', at: 'code', line: 'codeRight', gained: [] }],
    ])
  })

  it('reads and writes a fact through the game’s own field when it maps one', async () => {
    const store: Record<string, unknown> = { doorOpen: false }
    sim = await createToy({
      facts: {
        get: (_ctx, name) => (name === 'doorOpen' ? (store.doorOpen as boolean) : undefined),
        set: (_ctx, name, value) => {
          if (name !== 'doorOpen') return false
          store.doorOpen = value
          return true
        },
      },
    })
    verb(sim, { at: 'code', code: '42' })
    expect(store.doorOpen).toBe(true)
    expect(sim.resource(PuzzleState).facts.doorOpen).toBe(false)
  })

  it('starts from an entry’s items and facts', async () => {
    const def = {
      ...TOY,
      entry: [
        { name: 'start', items: [] },
        { name: 'late', items: ['key'], facts: { drawer: 1 } },
      ],
    }
    sim = await createToy({}, { toy: def })
    loadScene(sim, 'toy', 'late')
    expect(sim.resource(PuzzleState)).toMatchObject({ items: ['key'], facts: { drawer: 1, doorOpen: false } })
  })

  it('restores mid-way to the same state and events', async () => {
    const script = [
      { at: 'drawer' },
      { at: 'drawer' },
      { at: 'combine', pair: ['shade', 'bulb'] as const },
      { at: 'door', held: 'key' },
    ]
    const run = async (restoreAt?: number) => {
      let s = await createToy({ calls: { glow: () => {} } })
      const out: unknown[] = []
      for (const [i, payload] of script.entries()) {
        if (i === restoreAt) {
          const bytes = s.snapshot()
          s.dispose()
          s = await createToy({ calls: { glow: () => {} } })
          s.restore(bytes)
        }
        out.push(said(verb(s, payload)))
      }
      const hash = s.hash()
      s.dispose()
      return { out, hash }
    }
    expect(await run(2)).toEqual(await run())
  })
})
