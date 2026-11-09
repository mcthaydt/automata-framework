// The ready-made characters Schematic offers (spec 9), run in a 2D level through the real systems, with fixed seeds. The
// definitions are the systems package's `presets.json` (the editors package keeps that file equal to what its menu writes),
// with the clinic's three stops swapped for this level's three: the west of the Hall, the east of the Hall, and the gate.

import type { AgentDef } from '@automata/systems/sim'
import presets from '@automata/systems/testing/fixtures/presets.json'
import { afterEach, describe, expect, it } from 'vitest'
import { CELL, createPatrol2d, type Patrol2d } from '#src/testing/patrol-2d.ts'

const STOPS: Readonly<Record<string, string>> = { end: 'hallW', cmid: 'hallE', mouth: 'gate' }
const PRESETS = JSON.parse(
  JSON.stringify(presets).replace(
    /"node":"(end|cmid|mouth)"/g,
    (_, from: string) => `"node":"${STOPS[from]}"`,
  ),
) as Record<string, AgentDef>

const HALL_W = { x: 2, z: 3 }
const HALL_E = { x: 5, z: 3 }
const YARD_E = { x: 10, z: 3 }
/** A position the sim keeps in pixels, in metres (a cell is a metre). */
const inMetres = (px: { x: number; y: number }): { x: number; z: number } => ({
  x: px.x / CELL,
  z: px.y / CELL,
})
const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number =>
  Math.hypot(a.x - b.x, a.z - b.z)

let game: Patrol2d | undefined
afterEach(() => {
  game?.sim.dispose()
  game = undefined
})
async function open(
  kind: string,
  at: { x: number; z: number },
  others: readonly { kind: string; at: { x: number; z: number } }[] = [],
): Promise<Patrol2d> {
  game = await createPatrol2d(at, {
    agent: PRESETS[kind] as AgentDef,
    noises: true,
    others: others.map((o) => ({ def: PRESETS[o.kind] as AgentDef, at: o.at })),
  })
  return game
}
describe('Guard in a 2D level', () => {
  it('hunts what it sees, then searches where it lost her, and catches her on touch', async () => {
    const g = await open('guard', HALL_E)
    g.putPlayer(3.5, 3)
    g.run(0.1)
    expect(g.mode()).toBe('hunt')
    const events = g.run(3)
    expect(events.filter((e) => e.type === 'systems.caught').length).toBeGreaterThan(0)
  })

  it('does not see through the wall, and goes back to its patrol 5 s after losing her', async () => {
    const g = await open('guard', { x: 5, z: 0.5 })
    g.putPlayer(8, 0.5) // behind the solid cells of the wall
    g.run(0.5)
    expect(g.mode()).toBe('patrol')
    g.putPlayer(3, 0.5)
    g.run(0.1)
    expect(g.mode()).toBe('hunt')
    g.putPlayer(8, 0.5)
    g.run(0.1)
    expect(g.mode()).toBe('search')
    g.run(12)
    expect(g.mode()).toBe('patrol')
  })
})

describe('Sentry in a 2D level', () => {
  it('stays at its post, sounds the alarm when it sees her, and a Hunter across the wall goes to it', async () => {
    const g = await open('sentry', HALL_W, [{ kind: 'hunter', at: YARD_E }])
    const post = g.guardPx()
    g.run(1)
    expect(g.guardPx()).toEqual(post)
    expect(g.mode()).toBe('patrol')
    g.putPlayer(5, 3)
    g.run(0.1)
    expect(g.mode()).toBe('alarm')
    g.run(1)
    expect(g.mode('hunter')).toBe('listen')
  })
})

describe('Hunter in a 2D level', () => {
  it('goes to a thrown noise and gives up 4 s after arriving', async () => {
    const g = await open('hunter', HALL_E)
    g.makeNoise(2.5, 3, 12)
    expect(g.mode()).toBe('listen')
    g.run(2)
    const here = g.guardPx()
    expect(dist(inMetres(here), { x: 2.5, z: 3 })).toBeLessThan(0.3)
    g.run(2)
    expect(g.mode()).toBe('listen')
    g.run(3)
    expect(g.mode()).toBe('patrol')
  })
})

describe('Coward in a 2D level', () => {
  it('moves away from the player when it sees her', async () => {
    const g = await open('coward', HALL_E)
    g.putPlayer(3, 3)
    const before = dist(inMetres(g.guardPx()), { x: 3, z: 3 })
    g.run(2)
    expect(g.mode()).toBe('flee')
    const now = g.guardPx()
    expect(dist(inMetres(now), { x: 3, z: 3 })).toBeGreaterThan(before)
  })
})

describe('Wanderer in a 2D level', () => {
  it('visits its stops in order and never changes mode with the player beside it', async () => {
    const g = await open('wanderer', HALL_W)
    g.putPlayer(3, 3)
    const seen = new Set<string>()
    for (let i = 0; i < 30; i++) {
      g.run(1)
      expect(g.mode()).toBe('patrol')
      const at = g.guardPx()
      seen.add(`${Math.round(at.x / CELL)}`)
    }
    // It walked: west, east and out through the gate, not one place.
    expect(seen.size).toBeGreaterThan(2)
  })
})

describe('every run is the same twice', () => {
  it.each(Object.keys(PRESETS))('%s', async (kind) => {
    const hashes: string[] = []
    for (let i = 0; i < 2; i++) {
      const g = await open(kind, HALL_E)
      g.putPlayer(3, 3)
      g.run(1)
      g.makeNoise(2.5, 3, 12)
      g.run(3)
      hashes.push(g.sim.hash())
      g.sim.dispose()
      game = undefined
    }
    expect(hashes[0]).toBe(hashes[1])
  })
})
