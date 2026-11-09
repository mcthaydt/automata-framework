// What the profile lists for the material picker, and the hints its views take (ED3D.8a step 1, spec §4.1, D8, D10).

import type { AfSector2File } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { EMPTY_LIBRARY, readGameLibrary } from '#src/shared/level-session/game-library.ts'
import { gameColours } from '#src/shared/level-session/materials.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { base3dWorkspace } from '#src/testing/game-files.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

const depot = (): AfSector2File => {
  const parsed = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!parsed.ok) throw new Error('the depot does not parse')
  return parsed.value
}

describe('afSectorProfile.materials', () => {
  it('lists the file’s table in file order, with what each entry says', () => {
    expect(afSectorProfile.materials(depot())).toEqual({
      ok: true,
      materials: [
        { id: 'brick', category: 'walls', label: 'Brick' },
        { id: 'plank', category: 'floors', label: 'Planks' },
        { id: 'tile', category: 'floors' },
      ],
    })
  })

  it('keeps wallOnly', () => {
    const level = toyAfSector({ materials: { brick: { category: 'walls', wallOnly: true } } })
    expect(afSectorProfile.materials(level)).toEqual({
      ok: true,
      materials: [{ id: 'brick', category: 'walls', wallOnly: true }],
    })
  })

  it('refuses a level with no table, and an empty table is an empty list', () => {
    expect(afSectorProfile.materials(toyAfSector())).toEqual({
      ok: false,
      reason: 'the level has no materials table',
    })
    expect(afSectorProfile.materials(toyAfSector({ materials: {} }))).toEqual({ ok: true, materials: [] })
  })
})

describe('hints', () => {
  it('is metres, an eye 1.6 m up, a field of 69 degrees in radians and a snap of 5 cm', () => {
    expect(afSectorProfile.hints).toEqual({
      unit: 'm',
      eyeHeight: 1.6,
      fov: (69 * Math.PI) / 180,
      snap: 0.05,
    })
  })
})

describe('gameColours', () => {
  it("is the colour base-3d's own swatches give, by the name a level writes, and a seeded name has its base's", async () => {
    const library = await readGameLibrary('content/levels/room.af-sector.json', base3dWorkspace())
    const colour = gameColours(library)
    expect(colour('lava')).toEqual(expect.any(Number))
    expect(colour('lava')).not.toBe(colour('crate'))
    expect(colour('lava#7')).toBe(colour('lava'))
  })

  it('gives nothing for a name the game lacks, and for a game with no library', async () => {
    const library = await readGameLibrary('content/levels/room.af-sector.json', base3dWorkspace())
    expect(gameColours(library)('nonesuch')).toBeUndefined()
    expect(gameColours(EMPTY_LIBRARY)('lava')).toBeUndefined()
  })
})
