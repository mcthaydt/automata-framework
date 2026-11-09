// The material picker's model (ED3D.8a step 3, spec §5.3 flow 5 and §9: categories, search, empty search, selected, scale,
// brightness and the apply scope). The sheet reads `view` and calls the methods; nothing here draws.

import type { AfSector2File } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { createMaterialPicker } from '#src/features/levels-3d/inspector/material-picker.ts'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { toyAfSector, toyDock, toyHall } from '#src/testing/toy-af-sector.ts'

const level: AfSector2File = toyAfSector({
  materials: {
    brick: { category: 'walls', label: 'Red brick' },
    plaster: { category: 'walls', label: 'Warm plaster' },
    stone: { category: 'walls' },
    tile: { category: 'floors' },
    plank: { category: 'floors', label: 'Oak planks' },
    glass: { category: 'windows', wallOnly: true },
  },
  sectors: [
    { ...toyHall, wallTexture: 'brick', floorTexture: 'tile', light: 0.8 },
    { ...toyDock, wallTexture: 'brick', floorTexture: 'tile' },
  ],
})

const wall4 = { wall: { sector: 'hall', corner: 2 } } as const
const open = (target: Parameters<typeof createMaterialPicker>[1]['target'] = wall4, on = level) => {
  const editor = createLevelEditor({ profile: afSectorProfile, level: on })
  return { editor, picker: createMaterialPicker(editor, { target }) }
}
const ids = (materials: readonly { readonly id: string }[]) => materials.map((material) => material.id)

describe('createMaterialPicker: what it offers', () => {
  it('lists the categories in the order the list names them, with counts, and opens on the target’s material', () => {
    const { picker } = open()
    expect(picker.view.categories).toEqual([
      { id: 'walls', count: 3 },
      { id: 'floors', count: 2 },
      { id: 'windows', count: 1 },
    ])
    expect(picker.view.current).toBe('brick')
    expect(picker.view.category).toBe('walls')
    expect(ids(picker.view.tiles)).toEqual(['brick', 'plaster', 'stone'])
    expect(picker.view.selected?.id).toBe('brick')
    expect(picker.view.unavailable).toBeUndefined()
  })

  it('offers a floor no material that is for walls only, and opens on the floor’s category', () => {
    const { picker } = open({ sector: 'hall', surface: 'floor' })
    expect(picker.view.categories.map((category) => category.id)).toEqual(['walls', 'floors'])
    expect(picker.view.category).toBe('floors')
    expect(picker.view.selected?.id).toBe('tile')
    picker.select('glass')
    expect(picker.view.selected?.id).toBe('tile')
  })

  it('opens on the first category when the target is made of nothing the list has', () => {
    const { picker } = open({ sector: 'hall', surface: 'ceiling' })
    expect(picker.view.current).toBeUndefined()
    expect(picker.view.category).toBe('walls')
    expect(picker.view.selected).toBeUndefined()
  })

  it('switches category, and ignores one that is not there', () => {
    const { picker } = open()
    picker.openCategory('floors')
    expect(ids(picker.view.tiles)).toEqual(['tile', 'plank'])
    picker.openCategory('roofs')
    expect(picker.view.category).toBe('floors')
  })

  it('lists the materials the level uses, in list order', () => {
    expect(ids(open().picker.view.used)).toEqual(['brick', 'tile'])
  })
})

describe('createMaterialPicker: search', () => {
  it('matches id and label without case, across every category, and clears back to the category', () => {
    const { picker } = open()
    picker.search('  OAK ')
    expect(picker.view.search).toBe('  OAK ')
    expect(ids(picker.view.tiles)).toEqual(['plank'])
    expect(picker.view.empty).toBe(false)
    picker.search('ti')
    expect(ids(picker.view.tiles)).toEqual(['tile'])
    picker.search('a')
    expect(ids(picker.view.tiles)).toEqual(['plaster', 'plank', 'glass'])
    picker.search('marble')
    expect(picker.view.tiles).toEqual([])
    expect(picker.view.empty).toBe(true)
    picker.search('')
    expect(picker.view.empty).toBe(false)
    expect(ids(picker.view.tiles)).toEqual(['brick', 'plaster', 'stone'])
  })
})

describe('createMaterialPicker: the preview and the scope', () => {
  it('holds scale from 0.25 to 4 and brightness from 0 to 1.5, starting at 1 and the sector’s light', () => {
    const { picker } = open()
    expect(picker.view.scale).toBe(1)
    expect(picker.view.brightness).toBe(0.8)
    picker.setScale(9)
    picker.setBrightness(-1)
    expect([picker.view.scale, picker.view.brightness]).toEqual([4, 0])
    picker.setScale(0.1)
    picker.setBrightness(3)
    expect([picker.view.scale, picker.view.brightness]).toEqual([0.25, 1.5])
    picker.setScale(Number.NaN)
    expect(picker.view.scale).toBe(0.25)
  })

  it('tells its subscribers once for each change, and not for one that changes nothing', () => {
    const { picker } = open()
    let told = 0
    const stop = picker.subscribe(() => {
      told += 1
    })
    picker.setScope('room')
    picker.setScope('room')
    picker.select('stone')
    expect(told).toBe(2)
    stop()
    picker.setScope('wall')
    expect(told).toBe(2)
  })
})

describe('createMaterialPicker: apply', () => {
  it('applies the selected material in the scope as one undo step, and follows the level', () => {
    const { editor, picker } = open()
    picker.select('stone')
    picker.setScope('matching')
    const result = picker.apply()
    expect(result.ok).toBe(true)
    expect(editor.history.undoLabel).toBe('Apply stone to the walls that match wall 2 of hall')
    const sectors = afSectorProfile.sectors.list(editor.level)
    expect(sectors.map((sector) => sector.wallTexture)).toEqual(['stone', 'stone'])
    expect(picker.view.current).toBe('stone')
    expect(ids(picker.view.used)).toEqual(['stone', 'tile'])
    editor.history.undo()
    expect(editor.level).toBe(level)
    expect(picker.view.current).toBe('brick')
  })

  it('refuses with nothing selected, says the refusal, and clears it once an apply is in', () => {
    const { editor, picker } = open({ sector: 'hall', surface: 'ceiling' })
    const refused = picker.apply()
    expect(refused).toEqual({ ok: false, reason: 'pick a material' })
    expect(picker.view.refusal).toBe('pick a material')
    expect(editor.level).toBe(level)
    picker.select('plank')
    expect(picker.apply().ok).toBe(true)
    expect(picker.view.refusal).toBeUndefined()
  })

  it('moves to a new target, opening on what it is made of', () => {
    const { picker } = open()
    picker.retarget({ sector: 'dock', surface: 'floor' })
    expect(picker.view.target).toEqual({ sector: 'dock', surface: 'floor' })
    expect([picker.view.category, picker.view.selected?.id, picker.view.brightness]).toEqual([
      'floors',
      'tile',
      0.7,
    ])
  })
})

describe('createMaterialPicker: a list that changes under it', () => {
  it('drops a selection and a category the list no longer has, and Apply refuses until one is picked', () => {
    const { editor, picker } = open()
    picker.openCategory('windows')
    picker.select('glass')
    const { glass: _glass, ...rest } = level.materials ?? {}
    // An edit of the table (ED3D.13a) or an undo past the one that added a material takes it away.
    editor.history.apply('Take glass off the table', () => ({ level: { ...level, materials: rest } }))
    expect(picker.view.selected).toBeUndefined()
    expect(picker.view.category).toBe('walls')
    expect(picker.apply()).toEqual({ ok: false, reason: 'pick a material' })
    expect(editor.history.undoLabel).toBe('Take glass off the table')
    editor.history.undo()
    expect(picker.view.categories.map((category) => category.id)).toContain('windows')
  })
})

describe('createMaterialPicker: a profile with no list', () => {
  const NO_LIST = 'this level has no list of materials'
  const bare: typeof afSectorProfile = {
    ...afSectorProfile,
    materials: () => ({ ok: false, reason: NO_LIST }),
  }
  const hall = 'hall'

  it('offers nothing and refuses to apply, in the profile’s sentence, changing nothing', () => {
    const editor = createLevelEditor({ profile: bare, level })
    const picker = createMaterialPicker(editor, { target: { sector: hall, surface: 'floor' } })
    expect(picker.view.unavailable).toBe(NO_LIST)
    expect([picker.view.categories, picker.view.tiles, picker.view.used]).toEqual([[], [], []])
    expect(picker.apply()).toEqual({ ok: false, reason: NO_LIST })
    expect(editor.level).toBe(level)
    expect(editor.history.canUndo).toBe(false)
  })
})
