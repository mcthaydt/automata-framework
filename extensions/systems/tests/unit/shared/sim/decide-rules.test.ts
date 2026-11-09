// The rules "How it decides" in Schematic tells a person (`decide-words.ts`), pinned against the interpreter
// (`agent-step.ts`): a line the game does not follow would teach the wrong thing.
import type { Point } from '@automata/sectors/sim'
import { stepWith } from '@automata/sectors/testing'
import type { Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { routineMode } from '#src/shared/sim/probe-kinds.ts'
import type { AgentDef, SysEffect } from '#src/shared/sim/systems.schema.ts'
import { sceneOf } from '#src/testing/toy.ts'
import { agent, createWardGame, load } from '#src/testing/ward-game.ts'

let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})

const AT: Point = { x: -2.85, z: 2.4 }

/** The mode after the first step of a character whose first switch does `first` and whose second would go on. */
async function modeAfterOneStep(
  first: { to: string; do?: SysEffect[] },
  speed: Record<string, number>,
): Promise<string> {
  const def: AgentDef = {
    id: 'watcher',
    modes: ['start', 'middle', 'end'],
    initial: 'start',
    speed: { start: 1, ...speed },
    senses: [],
    transitions: [
      { from: 'start', to: first.to, when: [], priority: 20, do: first.do ?? [] },
      { from: first.to, to: 'end', when: [], priority: 10, do: [] },
    ],
  }
  const game = await createWardGame({ ...sceneOf(def), agents: [def] })
  sims.push(game.sim)
  stepWith(game.sim, [load({ watcher: AT })])
  return agent(game.sim, 'watcher').mode
}

describe('how a character decides', () => {
  it('control: every switch that holds does its actions, one after the other', async () => {
    expect(await modeAfterOneStep({ to: 'middle' }, { middle: 1, end: 1 })).toBe('end')
  })

  it('stops there when a switch catches the player', async () => {
    expect(
      await modeAfterOneStep({ to: 'middle', do: [{ emit: { caught: 'guard' } }] }, { middle: 1, end: 1 }),
    ).toBe('middle')
  })

  it('stops there when a switch starts a cutscene', async () => {
    expect(
      await modeAfterOneStep({ to: 'middle', do: [{ emit: { cutscene: 'wake' } }] }, { middle: 1, end: 1 }),
    ).toBe('middle')
  })

  it('stops there when a switch goes into a mode where it stands still', async () => {
    expect(await modeAfterOneStep({ to: 'middle' }, { middle: 0, end: 1 })).toBe('middle')
  })

  it('stops there when a switch goes out of a mode where it stands still', async () => {
    expect(await modeAfterOneStep({ to: 'middle' }, { start: 0, middle: 1, end: 1 })).toBe('middle')
  })

  it('runs the patrol in Routine, or in Patrol when it has no Routine', () => {
    const base = { id: 'a', speed: {}, initial: 'patrol', senses: [], transitions: [] }
    expect(routineMode({ ...base, modes: ['patrol', 'routine'] })).toBe('routine')
    expect(routineMode({ ...base, modes: ['patrol'] })).toBe('patrol')
    expect(routineMode({ ...base, modes: ['hunt'] })).toBeUndefined()
  })
})
