import { createSim, defineComponent, definePlugin, defineResource } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { simViewOf } from '#src/shared/game/sim-view.ts'

// The read-only view a BotPolicy gets: AF's sim has no SimView export, so server defines one over Sim.

const Position = defineComponent('position', { x: 'i32' })
const Score = defineResource('score', z.object({ total: z.number() }).strict(), () => ({ total: 7 }))
const game = definePlugin({ name: 'game', components: [Position], resources: [Score] })

async function sim() {
  const s = await createSim({ seed: 3, plugins: [game] })
  s.spawn([[Position, { x: 4 }]])
  return s
}

describe('simViewOf', () => {
  it('reads the tick, the hash, entities and resources as the sim has them', async () => {
    const s = await sim()
    const view = simViewOf(s)
    expect(view.tick).toBe(s.tick)
    expect(view.tickHz).toBe(60)
    expect(view.contentHash).toBe(s.contentHash)
    expect(view.hash()).toBe(s.hash())
    const [entity] = view.query(Position)
    expect(entity?.get(Position)).toEqual({ x: 4 })
    expect(entity && view.entity(entity.sid)?.has(Position)).toBe(true)
    expect(view.entity(999)).toBeUndefined()
    expect(view.resource(Score)).toEqual({ total: 7 })
    s.dispose()
  })

  it('follows the sim as it steps', async () => {
    const s = await sim()
    const view = simViewOf(s)
    s.step([])
    expect(view.tick).toBe(1)
    expect(view.hash()).toBe(s.hash())
    s.dispose()
  })

  it('has no way to step, spawn, restore or snapshot', async () => {
    const s = await sim()
    const view = simViewOf(s) as unknown as Record<string, unknown>
    for (const name of ['step', 'spawn', 'restore', 'snapshot', 'dispose']) expect(view[name]).toBeUndefined()
    s.dispose()
  })

  it('reads entities that cannot be changed through it', async () => {
    const s = await sim()
    const [entity] = simViewOf(s).query(Position)
    const record = entity as unknown as Record<string, unknown>
    for (const name of ['set', 'add', 'remove']) expect(record[name]).toBeUndefined()
    s.dispose()
  })
})
