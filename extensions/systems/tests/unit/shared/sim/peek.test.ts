// Peeking: the player stands still facing a doorway into another zone, and after a moment the camera may lean through it.
// The sim keeps who peeks through what, so replays carry it. The cases are the old game's, on the clinic: the hall's
// doorway into the corridor (`hall>mouth`, which has no door) and the corridor's closet door (shut until nav opens it).
import { NavDoors } from '@automataframework/nav/sim'
import { clinicBlocked } from '@automataframework/nav/testing/clinic'
import { resolvedMap } from '@automataframework/sectors/sim'
import { stateHash, stepWith } from '@automataframework/sectors/testing'
import type { Sim } from '@automataframework/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { createPeek, peekOf, SystemsEnv, SystemsPeek, SystemsPursuit } from '#src/entries/sim.ts'
import { sceneOf } from '#src/testing/toy.ts'
import { createWardGame, kinds, load, move, run } from '#src/testing/ward-game.ts'

/** An agent that does nothing: a scene to load, and no behaviour to disturb the peek. */
const quiet = sceneOf({
  id: 'quiet',
  modes: ['idle'],
  initial: 'idle',
  speed: { idle: 0 },
  senses: [],
  transitions: [],
})

const NORTH = Math.PI // facing is atan2(x, z): north (towards -z) is π
const EAST = Math.PI / 2
const deg = (d: number): number => (d * Math.PI) / 180

let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})

/** The player stands at (x, z) facing `facing`, in the clinic; peeking is on. */
async function stand(x: number, z: number, facing: number, extra: { reach?: number } = {}) {
  const state = { facing }
  const game = await createWardGame(quiet, {}, [], {
    plugins: [
      createPeek({
        facing: () => state.facing,
        blocked: (ctx, doors) => clinicBlocked(resolvedMap(ctx), doors),
        ...(extra.reach === undefined ? {} : { def: { reach: extra.reach } }),
      }),
    ],
  })
  sims.push(game.sim)
  stepWith(game.sim, [load({ quiet: { x: 3, z: 3 } }), move(x, z)])
  return {
    sim: game.sim,
    turn: (to: number) => {
      state.facing = to
    },
    moving: (is: boolean) => {
      game.sim.resource(SystemsEnv).moving = is
    },
    /** Steps `seconds`; every `systems.peek` event of the run. */
    run: (seconds: number) => kinds(run(game.sim, seconds), SystemsPeek.id),
  }
}

describe('peeking through a doorway', () => {
  it('starts after the dwell, and leans across the doorway', async () => {
    const s = await stand(0, -0.5, NORTH)
    expect(s.run(0.5)).toEqual([])
    expect(peekOf(s.sim)).toBeUndefined()
    expect(s.run(0.2)).toEqual([{ portal: 'hall>mouth', into: 'mouth', on: true }])
    // Across the doorway is north, towards -z: the offset grows to the lean, 1.2 m, over the ease.
    s.run(0.5)
    const peek = peekOf(s.sim)
    expect(peek?.portal).toBe('hall>mouth')
    expect(Math.hypot(peek?.x ?? 0, peek?.z ?? 0)).toBeCloseTo(1.2, 5)
    expect(peek?.x).toBeCloseTo(0, 5)
    expect(peek?.z).toBeLessThan(0)
  })

  it('eases in: part way along a moment after the dwell', async () => {
    const s = await stand(0, -0.5, NORTH)
    s.run(0.8)
    const peek = peekOf(s.sim)
    expect(Math.hypot(peek?.x ?? 0, peek?.z ?? 0)).toBeGreaterThan(0.3)
    expect(Math.hypot(peek?.x ?? 0, peek?.z ?? 0)).toBeLessThan(1.2)
  })

  it('moving brings the peek in, with one event; and she can start again once still', async () => {
    const s = await stand(0, -0.5, NORTH)
    s.run(1)
    s.moving(true)
    expect(s.run(0.1)).toEqual([{ portal: 'hall>mouth', into: 'mouth', on: false }])
    expect(peekOf(s.sim)).toBeUndefined()
    s.moving(false)
    expect(s.run(0.7)).toEqual([{ portal: 'hall>mouth', into: 'mouth', on: true }])
  })

  it('moving before the dwell is up never starts one', async () => {
    const s = await stand(0, -0.5, NORTH)
    s.run(0.4)
    s.moving(true)
    s.run(0.1)
    s.moving(false)
    expect(s.run(0.4)).toEqual([])
  })

  it('facing 60° off the doorway never starts one; 40° does', async () => {
    const off = await stand(0, -0.5, NORTH + deg(60))
    expect(off.run(2)).toEqual([])
    const near = await stand(0, -0.5, NORTH + deg(40))
    expect(near.run(1)).toHaveLength(1)
  })

  it('turning away ends it', async () => {
    const s = await stand(0, -0.5, NORTH)
    s.run(1)
    s.turn(NORTH + deg(120))
    expect(s.run(0.1)).toEqual([{ portal: 'hall>mouth', into: 'mouth', on: false }])
  })

  it('needs her to be near: not past the reach', async () => {
    const far = await stand(0, 1.5, NORTH)
    expect(far.run(2)).toEqual([])
  })

  it('a doorway into the same zone is not peeked through', async () => {
    // The hall's way into the ward alcove: the same camera zone.
    const s = await stand(-3, -0.4, NORTH)
    expect(s.run(2)).toEqual([])
  })

  it('a shut door shows nothing; open, it can be peeked through', async () => {
    // In the corridor, facing east at the closet door (a doorway sector that is part of the corridor's zone).
    const s = await stand(1.0, -4, EAST)
    expect(s.run(1.5)).toEqual([])
    stepWith(s.sim, [{ type: 'nav.door', payload: { door: 'closetDoor', open: true } }])
    expect(s.run(1)).toEqual([{ portal: 'doorway>closet', into: 'closet', on: true }])
    const shut = stepWith(s.sim, [{ type: 'nav.door', payload: { door: 'closetDoor', open: false } }])
    expect(kinds(shut.events, SystemsPeek.id)).toEqual([
      { portal: 'doorway>closet', into: 'closet', on: false },
    ])
    expect(s.sim.resource(NavDoors).open.closetDoor).toBe(false)
  })

  it('hiding ends it and stops a new one', async () => {
    const s = await stand(0, -0.5, NORTH)
    s.run(1)
    const hiding = stepWith(s.sim, [{ type: 'systems.hide', payload: { spot: 'locker' } }])
    expect(kinds(hiding.events, SystemsPeek.id)).toEqual([{ portal: 'hall>mouth', into: 'mouth', on: false }])
    expect(s.sim.resource(SystemsPursuit).hidden).toBe('locker')
    expect(s.run(2)).toEqual([])
  })

  it('a verb ends it', async () => {
    const s = await stand(0, -0.5, NORTH)
    s.run(1)
    const events = stepWith(s.sim, [{ type: 'puzzle.verb', payload: { at: 'desk' } }]).events
    expect(kinds(events, SystemsPeek.id)).toEqual([{ portal: 'hall>mouth', into: 'mouth', on: false }])
  })

  it('is the same peek after a snapshot is restored mid-peek', async () => {
    const s = await stand(0, -0.5, NORTH)
    s.run(0.7)
    const bytes = s.sim.snapshot()
    s.run(0.5)
    const after = { ...peekOf(s.sim) }
    s.sim.restore(bytes)
    s.run(0.5)
    expect({ ...peekOf(s.sim) }).toEqual(after)
  })

  it('gives the same hash for the same play', async () => {
    const a = await stand(0, -0.5, NORTH)
    const b = await stand(0, -0.5, NORTH)
    a.run(1.5)
    b.run(1.5)
    expect(stateHash(a.sim)).toBe(stateHash(b.sim))
  })

  it('takes its numbers from its options: a longer dwell waits longer', async () => {
    const game = await createWardGame(quiet, {}, [], {
      plugins: [
        createPeek({
          facing: () => NORTH,
          blocked: (ctx, doors) => clinicBlocked(resolvedMap(ctx), doors),
          def: { dwell: 2 },
        }),
      ],
    })
    sims.push(game.sim)
    stepWith(game.sim, [load({ quiet: { x: 3, z: 3 } }), move(0, -0.5)])
    expect(kinds(run(game.sim, 1.5), SystemsPeek.id)).toEqual([])
    expect(kinds(run(game.sim, 1), SystemsPeek.id)).toHaveLength(1)
  })

  it('refuses a number that cannot be one, in words', () => {
    const facing = () => 0
    expect(() => createPeek({ facing, def: { dwell: -1 } })).toThrow(
      /peek: dwell must be a number of 0 or more, not -1/,
    )
    expect(() => createPeek({ facing, def: { reach: 0 } })).toThrow(/peek: reach must be above 0, not 0/)
    expect(() => createPeek({ facing, def: { arc: 200 } })).toThrow(
      /peek: arc must be between 0 and 180 degrees, not 200/,
    )
    expect(() => createPeek({ facing, def: { lean: Number.NaN } })).toThrow(/peek: lean must be a number/)
  })
})
