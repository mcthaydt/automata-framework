import { describe, expect, it } from 'vitest'
import { createBaseSim, moveCommand, readPlayer } from '#src/app/base-sim.ts'
import { ROOM, SIM_CONTENT } from '#src/features/room/emberwick-content.ts'
import { GOLDEN_GOAL_TICK, GOLDEN_HASH, routeInputs } from '#src/testing/golden.ts'
import { ROOM as HAND_WRITTEN_ROOM } from '../../../fixtures/hand-written-room.ts'
import { HAND_WRITTEN_TUNING } from '../../../fixtures/hand-written-tuning.ts'

// GAME-2D.ED moved the room and the tunables out of code: the room is exported by the 2D editor and both are compiled
// content, so the sim's content changed and the golden hash moved with it (the content hash is part of the state hash,
// `world/sim.ts`). This is the old behaviour, still asserted: the golden route replayed with the data as it was written by
// hand and with the compiled content gives the same state on every tick (position, speed, facing, grounded, every event),
// and reaches the goal on the same tick. The new golden hash is what the hand-written data hashes to in the new content shape (the room and the tuning).

async function replay(room: typeof ROOM, tuning: typeof HAND_WRITTEN_TUNING) {
  const sim = await createBaseSim({ room, tuning })
  const ticks: { player: ReturnType<typeof readPlayer>; events: unknown[] }[] = []
  const goalTicks: number[] = []
  for (const input of routeInputs()) {
    const result = sim.step([moveCommand(sim, input)])
    ticks.push({ player: { ...readPlayer(sim) }, events: result.events.map((event) => ({ ...event })) })
    for (const event of result.events) if (event.type === 'goal.reached') goalTicks.push(result.tick)
  }
  const hash = sim.hash()
  sim.dispose()
  return { ticks, goalTicks, hash }
}

describe('the golden route, by hand and compiled', () => {
  it('has the same state on every tick and reaches the goal on the same tick', async () => {
    const byHand = await replay(HAND_WRITTEN_ROOM, HAND_WRITTEN_TUNING)
    const compiled = await replay(ROOM, SIM_CONTENT.tuning)
    expect(byHand.ticks.length).toBeGreaterThan(300)
    expect(compiled.ticks).toEqual(byHand.ticks)
    expect(compiled.goalTicks).toEqual([GOLDEN_GOAL_TICK])
    expect(byHand.goalTicks).toEqual([GOLDEN_GOAL_TICK])
  })

  it('ends on the same hash: the compiled content is the hand-written data, bit for bit', async () => {
    const byHand = await replay(HAND_WRITTEN_ROOM, HAND_WRITTEN_TUNING)
    const compiled = await replay(ROOM, SIM_CONTENT.tuning)
    expect(compiled.hash).toBe(byHand.hash)
    expect(compiled.hash).toBe(GOLDEN_HASH)
  })
})
