// Anchors: an actor row names where it stands as a point or an anchor, resolved when the cutscene starts.
// A script with an anchor the scene cannot resolve is not played.
import { describe, expect, it } from 'vitest'
import { anchorsOf, placeScript } from '#src/shared/sim/anchors.ts'
import type { CutsceneScript } from '#src/shared/sim/cutscene.schema.ts'

const script: CutsceneScript = {
  id: 'toy',
  duration: 4,
  camera: [{ t: 0, pos: [0, 1, 4], look: [0, 1, 0] }],
  actor: [
    { who: 'nurse', t: 0, at: 'door.ward', facing: 2 },
    { who: 'nurse', t: 2, at: 'player' },
    { who: 'ada', t: 0, x: 1, z: 2 },
    { who: 'porter', t: 1, at: 'door.ward' },
  ],
}

describe('anchorsOf', () => {
  it('lists the anchors a script names, once each, sorted', () => {
    expect(anchorsOf(script)).toEqual(['door.ward', 'player'])
    expect(anchorsOf({ ...script, actor: undefined })).toEqual([])
  })
})

describe('placeScript', () => {
  const where: Record<string, { x: number; z: number }> = {
    'door.ward': { x: 3, z: -1 },
    player: { x: 0, z: 5 },
  }
  it('puts every actor key at a point, keeping its other fields', () => {
    const placed = placeScript(script, (name) => where[name])
    expect(placed).toMatchObject({ ok: true })
    const actors = placed.ok ? placed.script.actor : []
    expect(actors?.map((a) => [a.who, a.t, a.x, a.z])).toEqual([
      ['nurse', 0, 3, -1],
      ['nurse', 2, 0, 5],
      ['ada', 0, 1, 2],
      ['porter', 1, 3, -1],
    ])
    expect(actors?.[0]?.facing).toBe(2)
    expect(actors?.[0]).not.toHaveProperty('at')
  })
  it('names every anchor it cannot resolve, and places nothing', () => {
    expect(placeScript(script, (name) => (name === 'player' ? where.player : undefined))).toEqual({
      ok: false,
      missing: ['door.ward'],
    })
    expect(placeScript(script, () => undefined)).toEqual({ ok: false, missing: ['door.ward', 'player'] })
  })
  it('places a script with no anchors without asking', () => {
    const plain = { ...script, actor: [{ who: 'ada', t: 0, x: 1, z: 2 }] }
    expect(placeScript(plain, () => undefined)).toMatchObject({ ok: true })
  })
})
