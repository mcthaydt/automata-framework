// Applying a material (ED3D.8a step 2, spec §5.3 flow 5): to one wall, to a room, or to every wall made of what the target
// is made of, as one edit. On a small `af-sector/1` level with a style and a hole.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { afSectorProfile } from '../profile/af-sector-profile'
import type { Material } from '../profile/materials'
import type { EditSector } from '../profile/sector-access'
import { levelOf, must, reasonOf } from '../testing/edit-helpers'
import { toyAfSector, toyDock, toyHall } from '../testing/toy-af-sector'
import { createLevelEditor } from './level-editor'
import { applyMaterial, type MaterialScope, type MaterialTarget, materialOf } from './material-edits'

const stone: Material = { id: 'stone', category: 'walls' }
const plank: Material = { id: 'plank', category: 'floors' }
const glass: Material = { id: 'glass', category: 'windows', wallOnly: true }

/**
 * The hall's walls are brick, but for its first wall and the first wall of the pillar in it, which are plaster; the dock
 * takes plaster walls and a tile floor from its style.
 */
const level: AfSector = toyAfSector({
  materials: {
    brick: { category: 'walls' },
    plaster: { category: 'walls' },
    stone: { category: 'walls' },
    tile: { category: 'floors' },
    plank: { category: 'floors' },
    glass: { category: 'windows', wallOnly: true },
  },
  styles: { warm: { wallTexture: 'plaster', floorTexture: 'tile' } },
  sectors: [
    {
      ...toyHall,
      wallTexture: 'brick',
      floorTexture: 'tile',
      corners: [
        [0, 0, { texture: 'plaster' }],
        [8, 0, { next: 'dock' }],
        [8, 6],
        [0, 6],
      ],
      holes: [
        [
          [3, 2, { texture: 'plaster' }],
          [3, 3],
          [4, 3],
          [4, 2],
        ],
      ],
    },
    { ...toyDock, style: 'warm' },
  ],
})

const apply = (target: MaterialTarget, scope: MaterialScope, material: Material = stone, on = level) =>
  applyMaterial<AfSector>({ target, scope, material }).run(afSectorProfile, on)
const sectorIn = (of: AfSector, id: string): EditSector =>
  must(afSectorProfile.sectors.list(of).find((each) => each.id === id))
const wallOf = (sector: string, corner: number): MaterialTarget => ({ wall: { sector, corner } })
const walls = (of: AfSector, id: string): (string | undefined)[] =>
  sectorIn(of, id).corners.map((_, corner) => materialOf(afSectorProfile, of, wallOf(id, corner)))

describe('materialOf', () => {
  it('reads what a wall, a floor and a ceiling are made of, through the wall, the sector and its style', () => {
    expect(walls(level, 'hall')).toEqual(['plaster', 'brick', 'brick', 'brick'])
    expect(walls(level, 'dock')).toEqual(['plaster', 'plaster', 'plaster', 'plaster'])
    expect(materialOf(afSectorProfile, level, { sector: 'dock', surface: 'floor' })).toBe('tile')
    expect(materialOf(afSectorProfile, level, { sector: 'hall', surface: 'walls' })).toBe('brick')
    expect(materialOf(afSectorProfile, level, { sector: 'hall', surface: 'ceiling' })).toBeUndefined()
    expect(materialOf(afSectorProfile, level, { sector: 'attic', surface: 'floor' })).toBeUndefined()
  })
})

describe('applyMaterial: this wall', () => {
  it('sets the one wall’s texture and nothing else', () => {
    const after = levelOf(apply(wallOf('hall', 2), 'wall'))
    expect(sectorIn(after, 'hall').corners[2]).toEqual([8, 6, { texture: 'stone' }])
    expect(walls(after, 'hall')).toEqual(['plaster', 'brick', 'stone', 'brick'])
    expect(sectorIn(after, 'dock')).toBe(sectorIn(level, 'dock'))
  })

  it('sets a floor or a ceiling of the sector, and the same for Room', () => {
    for (const scope of ['wall', 'room'] as const) {
      const floor = levelOf(apply({ sector: 'hall', surface: 'floor' }, scope, plank))
      expect(sectorIn(floor, 'hall').floorTexture).toBe('plank')
      expect(sectorIn(floor, 'dock')).toBe(sectorIn(level, 'dock'))
      const ceiling = levelOf(apply({ sector: 'dock', surface: 'ceiling' }, scope, plank))
      expect(sectorIn(ceiling, 'dock').ceilingTexture).toBe('plank')
    }
  })

  it('is the level itself when the wall is made of it already', () => {
    const same = apply(wallOf('hall', 0), 'wall', { id: 'plaster', category: 'walls' })
    expect(levelOf(same)).toBe(level)
  })
})

describe('applyMaterial: room', () => {
  it('sets the sector’s wall texture and takes the walls’ own textures off, the hole’s too', () => {
    const after = levelOf(apply(wallOf('hall', 2), 'room'))
    const hall = sectorIn(after, 'hall')
    expect(hall.wallTexture).toBe('stone')
    expect(hall.corners[0]).toEqual([0, 0])
    expect(must(hall.holes?.[0])[0]).toEqual([3, 2])
    expect(walls(after, 'hall')).toEqual(['stone', 'stone', 'stone', 'stone'])
    expect(sectorIn(after, 'dock')).toBe(sectorIn(level, 'dock'))
  })

  it('gives a sector that takes its walls from a style a member of its own, which wins', () => {
    const after = levelOf(apply({ sector: 'dock', surface: 'walls' }, 'room'))
    expect(sectorIn(after, 'dock')).toMatchObject({ style: 'warm', wallTexture: 'stone' })
    expect(walls(after, 'dock')).toEqual(['stone', 'stone', 'stone', 'stone'])
  })
})

describe('applyMaterial: matching', () => {
  it('gives every wall made of the target’s material the new one, in walls, holes and styled sectors', () => {
    const after = levelOf(apply(wallOf('hall', 0), 'matching'))
    const hall = sectorIn(after, 'hall')
    expect(hall.corners[0]).toEqual([0, 0, { texture: 'stone' }])
    expect(must(hall.holes?.[0])[0]).toEqual([3, 2, { texture: 'stone' }])
    expect(hall.wallTexture).toBe('brick')
    expect(walls(after, 'hall')).toEqual(['stone', 'brick', 'brick', 'brick'])
    expect(sectorIn(after, 'dock')).toMatchObject({ style: 'warm', wallTexture: 'stone' })
  })

  it('changes a sector’s walls that take their material from it, and leaves the walls that say something else', () => {
    const after = levelOf(apply(wallOf('hall', 2), 'matching'))
    expect(sectorIn(after, 'hall').wallTexture).toBe('stone')
    expect(walls(after, 'hall')).toEqual(['plaster', 'stone', 'stone', 'stone'])
    expect(sectorIn(after, 'dock')).toBe(sectorIn(level, 'dock'))
  })

  it('gives every floor made of the target floor’s material the new one', () => {
    const after = levelOf(apply({ sector: 'hall', surface: 'floor' }, 'matching', plank))
    expect(sectorIn(after, 'hall').floorTexture).toBe('plank')
    expect(sectorIn(after, 'dock')).toMatchObject({ style: 'warm', floorTexture: 'plank' })
  })
})

describe('applyMaterial: matching a target made of nothing', () => {
  it('refuses, rather than match every surface that says nothing', () => {
    expect(reasonOf(apply({ sector: 'hall', surface: 'ceiling' }, 'matching', plank))).toBe(
      'the ceiling of hall is made of no material, so nothing matches it',
    )
    const bare = toyAfSector({ materials: { stone: { category: 'walls' } } })
    expect(reasonOf(apply(wallOf('hall', 2), 'matching', stone, bare))).toBe(
      'wall 2 of hall is made of no material, so nothing matches it',
    )
    expect(levelOf(apply(wallOf('hall', 2), 'room', stone, bare))).not.toBe(bare)
  })
})

describe('applyMaterial: refusals and the history', () => {
  it('refuses a material for walls only on a floor or a ceiling, and a sector or a wall that is not there', () => {
    expect(reasonOf(apply({ sector: 'hall', surface: 'floor' }, 'wall', glass))).toBe(
      'glass is for walls only',
    )
    expect(reasonOf(apply({ sector: 'hall', surface: 'ceiling' }, 'matching', glass))).toBe(
      'glass is for walls only',
    )
    expect(levelOf(apply(wallOf('hall', 1), 'wall', glass))).not.toBe(level)
    expect(reasonOf(apply(wallOf('attic', 0), 'wall'))).toBe('no sector attic')
    expect(reasonOf(apply({ sector: 'attic', surface: 'floor' }, 'room'))).toBe('no sector attic')
    expect(reasonOf(apply(wallOf('hall', 9), 'room'))).toBe('sector hall has no wall 9')
  })

  it('is one undo step however many walls it changes, with a label that says what it did', () => {
    const editor = createLevelEditor({ profile: afSectorProfile, level })
    const edit = applyMaterial<AfSector>({ target: wallOf('hall', 0), scope: 'matching', material: stone })
    expect(edit.label).toBe('Apply stone to the walls that match wall 0 of hall')
    expect(editor.run(edit).ok).toBe(true)
    expect(editor.history.undoLabel).toBe(edit.label)
    editor.history.undo()
    expect(editor.level).toBe(level)
    const labels = [
      applyMaterial({ target: wallOf('hall', 2), scope: 'wall', material: stone }).label,
      applyMaterial({ target: wallOf('hall', 2), scope: 'room', material: stone }).label,
      applyMaterial({ target: { sector: 'hall', surface: 'floor' }, scope: 'wall', material: plank }).label,
      applyMaterial({ target: { sector: 'hall', surface: 'floor' }, scope: 'matching', material: plank })
        .label,
    ]
    expect(labels).toEqual([
      'Apply stone to wall 2 of hall',
      'Apply stone to the walls of hall',
      'Apply plank to the floor of hall',
      'Apply plank to the floors that match hall',
    ])
  })
})
