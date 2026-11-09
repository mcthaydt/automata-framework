import { type Command, createSim, type Sim } from '@automataframework/automata-sim'
import { afterEach, describe, expect, it } from 'vitest'
import { AIR_JUMPS, Body, GRAVITY, JUMP_SPEED } from '../../../src/features/double-jump/body.component.ts'
import { doubleJumpPlugin } from '../../../src/features/double-jump/double-jump.plugin.ts'

// Step 3 of the flow: the golden test. It drives the sim with commands only, as a player would, and reads the
// result back from components. The last test pins the whole run to one hash: any change to the rules changes it.

const live: Sim[] = []
afterEach(() => {
  for (const sim of live.splice(0)) sim.dispose()
})

async function start(): Promise<Sim> {
  const sim = await createSim({ seed: 1, plugins: [doubleJumpPlugin] })
  live.push(sim)
  sim.spawn([[Body, { airJumps: AIR_JUMPS }]])
  return sim
}

const jump = (sim: Sim): Command => ({ tick: sim.tick, source: 0, seq: sim.tick, type: 'jump', payload: {} })

/** Steps `ticks` times, pressing jump on the listed ticks (counted from 0). */
function play(sim: Sim, ticks: number, presses: readonly number[] = []): void {
  for (let i = 0; i < ticks; i++) {
    const result = sim.step(presses.includes(i) ? [jump(sim)] : [])
    expect(result.rejected).toEqual([])
  }
}

const body = (sim: Sim) => {
  const [entity] = sim.query(Body)
  if (entity === undefined) throw new Error('no body')
  return entity.get(Body)
}

describe('double jump', () => {
  it('jumps from the floor', async () => {
    const sim = await start()
    play(sim, 1, [0])
    expect(body(sim).y).toBeGreaterThan(0)
    expect(body(sim).vy).toBe(JUMP_SPEED - GRAVITY)
  })

  it('jumps once more in the air', async () => {
    const sim = await start()
    play(sim, 6, [0, 5])
    expect(body(sim).vy).toBe(JUMP_SPEED - GRAVITY)
    expect(body(sim).airJumps).toBe(0)
  })

  it('ignores a third press in the air', async () => {
    const sim = await start()
    play(sim, 10, [0, 5])
    const before = body(sim).vy
    play(sim, 1, [0])
    expect(body(sim).vy).toBe(before - GRAVITY)
  })

  it('gets its air jump back on landing', async () => {
    const sim = await start()
    play(sim, 120, [0, 5])
    expect(body(sim)).toMatchObject({ y: 0, vy: 0, airJumps: AIR_JUMPS })
  })

  it('ends a scripted run on the recorded hash', async () => {
    const sim = await start()
    play(sim, 120, [0, 8, 20, 60, 70, 75])
    expect(sim.hash()).toBe(GOLDEN_HASH)
  })
})

/** Recorded from the first passing run. A different hash is a behavior change: investigate, never re-record. */
const GOLDEN_HASH = '771f4164dd23d207'
