import { CutsceneState } from '@automata/cutscenes/sim'
import { NarrativeDialogue } from '@automata/narrative/sim'
import type { Sim } from '@automata/sim'
import { SystemsState } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { createStorySim } from '#src/app/story-sim.ts'
import { Move } from '#src/features/square/move.command.ts'
import { Square } from '#src/features/square/square.component.ts'

// A scripted play of the story, on the sim alone: walk to the keeper, answer, watch the cutscene, then be seen by the
// guard through the gap in the wall. Every order is a command, so a replay of them ends in the same state.

const command = (sim: Sim, type: string, payload: unknown) => ({
  tick: sim.tick,
  source: 0,
  seq: 0,
  type,
  payload,
})

/** Holds `x`/`y` for `ticks` ticks. */
function hold(sim: Sim, x: number, y: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.step([command(sim, Move.id, { x, y })])
}
const wait = (sim: Sim, ticks: number): void => {
  for (let i = 0; i < ticks; i++) sim.step([])
}
const player = (sim: Sim) => {
  const [square] = sim.query(Square)
  return square?.get(Square) as { x: number; y: number }
}
const dialogue = (sim: Sim) => sim.resource(NarrativeDialogue)
const mode = (sim: Sim): string | undefined =>
  (sim.resource(SystemsState).agents.guard as { mode: string })?.mode

/** The player walks up to the keeper in the Hall: the conversation starts by itself. */
function touchTheKeeper(sim: Sim): void {
  hold(sim, 1, 0, 70)
}

describe('2D Story: a play from the keeper to the guard', () => {
  it('starts the keeper’s conversation when the player walks up to him', async () => {
    const sim = await createStorySim()
    expect(dialogue(sim).graph).toBeNull()
    touchTheKeeper(sim)
    expect(dialogue(sim).graph).toBe('keeper')
    sim.dispose()
  })

  it('starts the cutscene when the second answer is chosen and the conversation ends', async () => {
    const sim = await createStorySim()
    touchTheKeeper(sim)
    sim.step([command(sim, 'narrative.choose', { index: 1 })])
    expect(sim.resource(CutsceneState).id).toBeNull()
    sim.step([command(sim, 'narrative.advance', {})])
    expect(dialogue(sim).graph).toBeNull()
    wait(sim, 1)
    expect(sim.resource(CutsceneState).id).toBe('gate')
    sim.dispose()
  })

  it('does not start the cutscene when the first answer is chosen', async () => {
    const sim = await createStorySim()
    touchTheKeeper(sim)
    sim.step([command(sim, 'narrative.choose', { index: 0 })])
    sim.step([command(sim, 'narrative.advance', {})])
    wait(sim, 5)
    expect(sim.resource(CutsceneState).id).toBeNull()
    sim.dispose()
  })

  it('holds the player still while the cutscene plays, then lets them walk again', async () => {
    const sim = await createStorySim()
    touchTheKeeper(sim)
    sim.step([command(sim, 'narrative.choose', { index: 1 })])
    sim.step([command(sim, 'narrative.advance', {})])
    wait(sim, 1)
    const before = player(sim)
    hold(sim, 0, -1, 10)
    expect(player(sim)).toEqual(before)
    wait(sim, 6 * 60)
    expect(sim.resource(CutsceneState).id).toBeNull()
    hold(sim, 0, -1, 5)
    expect(player(sim).y).toBeLessThan(before.y)
    sim.dispose()
  })

  it('has the guard hunt a player he sees through the gap, and not one behind the wall', async () => {
    const seen = await createStorySim()
    // The first tick hands the story's files to the extensions, and the guard appears.
    wait(seen, 1)
    expect(mode(seen)).toBe('patrol')
    // The keeper stands on the way: hear him out (the first answer), then on along the floor to the wall. The gap is the three
    // cells above the floor.
    touchTheKeeper(seen)
    seen.step([command(seen, 'narrative.choose', { index: 0 })])
    seen.step([command(seen, 'narrative.advance', {})])
    hold(seen, 1, 0, 30)
    wait(seen, 3 * 60)
    expect(mode(seen)).toBe('hunt')
    seen.dispose()

    const hidden = await createStorySim()
    // Up into the Hall, where the wall is solid up to the ceiling, then along it to the wall.
    hold(hidden, 0, -1, 70)
    hold(hidden, 1, 0, 100)
    wait(hidden, 10 * 60)
    expect(mode(hidden)).toBe('patrol')
    hidden.dispose()
  })

  it('ends in the same state every time the same play is run', async () => {
    const run = async (): Promise<string> => {
      const sim = await createStorySim()
      touchTheKeeper(sim)
      sim.step([command(sim, 'narrative.choose', { index: 1 })])
      sim.step([command(sim, 'narrative.advance', {})])
      wait(sim, 8 * 60)
      hold(sim, 1, 0, 60)
      const hash = sim.hash()
      sim.dispose()
      return hash
    }
    expect(await run()).toBe(await run())
  })
})
