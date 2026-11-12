import { CutsceneStarted, CutsceneState } from '@automata/cutscenes/sim'
import { PuzzleState } from '@automata/puzzle/sim'
import { InSector } from '@automata/sectors/sim'
import { SystemsCaught, SystemsState } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { Checkpoint } from '#src/features/catch/checkpoint.resource.ts'
import { boot, type Game } from '#src/testing/harness.ts'

// A practice catch: her touch finds Ada. It does nothing while a cutscene holds input; otherwise it plays `found` and, when
// that ends, puts the facts, items, Ada and the lamp back as the lights-out checkpoint had them, with the figure far off.

/** Stands the figure `apart` metres east of Ada: the sim is read and written through its entities, as a test may. */
function placeBeside(game: Game, apart = 0.2): void {
  const nurse = game.sim.resource(SystemsState).agents.nurse
  const at = game.ada()
  if (nurse !== undefined) game.sim.entity(nurse.sid)?.set(InSector, { x: at.x + apart, z: at.z })
}

/** Steps until no cutscene is playing (the lights-out one holds input for 16 s, and a catch then does nothing). */
function untilFree(game: Game): void {
  for (let i = 0; i < 60 * 40 && game.sim.resource(CutsceneState).id !== null; i += 1) game.send([])
}

/** Lights out and its cutscene over, and the figure standing next to Ada, hunting her. */
async function caught(): Promise<Game> {
  const game = await boot()
  game.sim.resource(PuzzleState).facts.bedMade = true
  game.hold(0.2) // lights out: the checkpoint is made
  untilFree(game)
  const nurse = game.sim.resource(SystemsState).agents.nurse
  if (nurse === undefined) throw new Error('no figure')
  Object.assign(nurse, { mode: 'hunt', path: [], goal: null })
  placeBeside(game)
  return game
}

describe('a practice catch', () => {
  it('makes the checkpoint at lights out', async () => {
    const game = await boot()
    expect(game.sim.resource(Checkpoint).saved).toBe(false)
    game.sim.resource(PuzzleState).facts.bedMade = true
    game.hold(0.2)
    expect(game.sim.resource(Checkpoint)).toMatchObject({ saved: true, pending: false })
    expect(game.sim.resource(Checkpoint).facts.lightsOut).toBe(true)
  })

  it('plays found when her touch finds Ada, and tells it once however long she touches', async () => {
    const game = await boot()
    game.sim.resource(PuzzleState).facts.bedMade = true
    game.hold(0.2)
    untilFree(game) // the lights-out cutscene, and whatever catch follows it, are over
    const founds = () =>
      game.events(CutsceneStarted).filter((e) => (e as { id: string }).id === 'found').length
    const before = founds()
    const nurse = game.sim.resource(SystemsState).agents.nurse
    if (nurse === undefined) throw new Error('no figure')
    Object.assign(nurse, { mode: 'hunt', path: [], goal: null })
    placeBeside(game)
    game.hold(1)
    expect(game.events(SystemsCaught).length).toBeGreaterThan(0)
    expect(founds() - before).toBe(1)
  })

  it('restores the checkpoint’s facts and items when found ends, and Ada where she stood', async () => {
    const game = await caught()
    const before = { ...game.sim.resource(Checkpoint).facts }
    const items = [...game.sim.resource(Checkpoint).items]
    const spot = { ...game.ada() }
    game.sim.resource(PuzzleState).facts.noteRead = true
    game.sim.resource(PuzzleState).items.push('sheets')
    game.hold(12) // found lasts 7 s
    expect(game.sim.resource(Checkpoint).pending).toBe(false)
    expect(game.sim.resource(PuzzleState).facts).toEqual(before)
    expect(game.sim.resource(PuzzleState).items).toEqual(items)
    expect(game.ada()).toMatchObject({ x: spot.x, z: spot.z })
  })

  it('puts the figure far from Ada, patrolling', async () => {
    const game = await caught()
    game.hold(12)
    const nurse = game.sim.resource(SystemsState).agents.nurse
    const at = game.sim.entity(nurse?.sid as number)?.get(InSector)
    const ada = game.ada()
    expect(nurse?.mode).toBe('patrol')
    expect(Math.hypot((at?.x ?? 0) - ada.x, (at?.z ?? 0) - ada.z)).toBeGreaterThan(4)
  })

  it('does nothing while a cutscene holds input', async () => {
    const game = await boot()
    game.sim.resource(PuzzleState).facts.bedMade = true
    game.hold(0.2)
    // The keypad cutscene is playing when her touch lands.
    game.send([{ type: 'cutscene.start', payload: { id: 'keypad' } }])
    placeBeside(game)
    game.hold(0.5)
    expect(game.sim.resource(Checkpoint).pending).toBe(false)
    expect(game.events(CutsceneStarted).filter((e) => (e as { id: string }).id === 'found')).toHaveLength(0)
  })
})
