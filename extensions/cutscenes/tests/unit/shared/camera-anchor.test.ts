// A camera key at an anchor: its `pos` and `look` are offsets from the anchor's point on the floor (x and z; the height is
// the key's own), so a shot can be said as "over her shoulder" or "where she was caught" and not as a point in the level.
// The anchor is resolved when the cutscene starts, as an actor's is, and a camera is never placed by a name the scene lacks.

import { readSectorMap, resolveLevel } from '@automataframework/sectors/sim'
import clinicLevel from '@automataframework/sectors/testing/fixtures/clinic.af-sector.json?raw'
import { describe, expect, it } from 'vitest'
import { anchorsOf, type CutsceneScript, cutsceneSchema, placeScript } from '#src/entries/sim.ts'
import { type LintWorld, lintCutscene } from '#src/shared/lint.ts'

const where = (name: string) =>
  name === 'player' ? { x: 4, z: 2 } : name === 'actor:nurse' ? { x: -1, z: 3 } : undefined

const SCRIPT: CutsceneScript = {
  id: 'found',
  duration: 6,
  camera: [
    { t: 0, pos: [1, 2, 0], look: [0, 1.2, 0], about: 'player' },
    { t: 3, pos: [0, 1.6, 5], look: [0, 1.2, 3], cut: true },
  ],
  actor: [{ who: 'nurse', t: 0, at: 'actor:nurse', moving: false }],
}

describe('a camera key at an anchor', () => {
  it('is read from the script, and an empty name is refused', () => {
    expect(cutsceneSchema.parse(SCRIPT).camera[0]?.about).toBe('player')
    expect(
      cutsceneSchema.safeParse({ ...SCRIPT, camera: [{ t: 0, pos: [0, 0, 0], look: [0, 0, 0], about: '' }] })
        .success,
    ).toBe(false)
  })

  it('resolves to the anchor’s point plus the offset, and the placed key has no anchor left', () => {
    const placed = placeScript(SCRIPT, where)
    if (!placed.ok) throw new Error('not placed')
    expect(placed.script.camera[0]).toEqual({ t: 0, pos: [5, 2, 2], look: [4, 1.2, 2] })
    expect('about' in (placed.script.camera[0] as object)).toBe(false)
    // A key with no anchor is as it was written.
    expect(placed.script.camera[1]).toEqual({ t: 3, pos: [0, 1.6, 5], look: [0, 1.2, 3], cut: true })
  })

  it('lists camera anchors with the actors’, once each and sorted', () => {
    expect(anchorsOf(SCRIPT)).toEqual(['actor:nurse', 'player'])
    expect(anchorsOf({ ...SCRIPT, actor: [{ who: 'a', t: 0, at: 'player', moving: false }] })).toEqual([
      'player',
    ])
  })

  it('is not placed when the scene cannot resolve it, naming it', () => {
    const lost: CutsceneScript = {
      ...SCRIPT,
      camera: [{ t: 0, pos: [0, 2, 0], look: [0, 1, 0], about: 'hotspot:ghost' }],
    }
    expect(placeScript(lost, where)).toEqual({ ok: false, missing: ['hotspot:ghost'] })
  })

  it('is named by the lint when the scene lacks the anchor', () => {
    const map = resolveLevel(readSectorMap(JSON.parse(clinicLevel)).level)
    const world: LintWorld = {
      map,
      text: {},
      sounds: new Set(),
      lamps: new Set(),
      doors: new Set(),
      props: new Set(),
      anchor: (name) => (name === 'player' ? { x: 0, z: 3 } : undefined),
    }
    const lost: CutsceneScript = {
      id: 'lost',
      duration: 6,
      camera: [
        { t: 0, pos: [0, 1.6, 2], look: [0, 1.2, 0], about: 'hotspot:ghost' },
        { t: 3, pos: [0, 1.6, 2], look: [0, 1.2, 0], about: 'player', cut: true },
      ],
    }
    const found = lintCutscene(lost, world).filter((f) => f.rule === 'anchor')
    expect(found).toHaveLength(1)
    expect(found[0]?.detail).toContain('hotspot:ghost')
  })
})
