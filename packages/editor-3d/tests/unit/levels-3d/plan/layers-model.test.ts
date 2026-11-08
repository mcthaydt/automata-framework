import { describe, expect, it } from 'vitest'
import { editorLayerRows, layerRows } from '#src/features/levels-3d/plan/layers-model.ts'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { initialView } from '#src/shared/edit/view-store.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import type { EntityKit } from '#src/shared/things/things.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

// The rows of the layers panel (plan ED3D.5d step 4; ED3D spec §5.2): Sectors and Walls, then Things with one row per
// entity definition, in the level's order, each with its count, colour and state.

const kit: EntityKit = {
  definitions: [
    { id: 'lamp', label: 'Lamps', shape: 'point', color: '#f4e285', fields: [] },
    { id: 'crate', shape: 'box', size: [1, 1, 1], fields: [] },
  ],
  things: [
    { def: 'lamp', id: 'l1', x: 0, z: 0, values: {} },
    { def: 'lamp', id: 'l2', x: 1, z: 0, values: {} },
  ],
  problems: [],
}

describe('layerRows', () => {
  it('lists the geometry layers, then Things and a row for each definition with its count', () => {
    const rows = layerRows({ kit, sectors: 3, walls: 12, view: initialView })
    expect(rows.map((row) => [row.id, row.label, row.count, row.depth])).toEqual([
      ['sectors', 'Sectors', 3, 0],
      ['walls', 'Walls', 12, 0],
      ['things', 'Things', 2, 0],
      ['things:lamp', 'Lamps', 2, 1],
      ['things:crate', 'crate', 0, 1],
    ])
    expect(rows.find((row) => row.id === 'things:lamp')?.color).toBe('#f4e285')
    expect(rows.find((row) => row.id === 'things:crate')?.color).toBe('#8f9bb3')
    expect(rows.find((row) => row.id === 'sectors')?.active).toBe(true)
  })

  it('marks hidden, locked and active rows, and a sub-layer under a hidden or locked Things', () => {
    const view = {
      ...initialView,
      layer: 'things:lamp',
      hidden: ['walls', 'things'],
      locked: ['things:crate'],
    }
    const rows = layerRows({ kit, sectors: 0, walls: 0, view })
    const state = (id: string) => {
      const row = rows.find((each) => each.id === id)
      return [row?.hidden, row?.locked, row?.active, row?.inherited]
    }
    expect(state('walls')).toEqual([true, false, false, false])
    expect(state('things:lamp')).toEqual([false, false, true, true])
    expect(state('things:crate')).toEqual([false, true, false, true])
    expect(state('sectors')).toEqual([false, false, false, false])
  })

  it('lists no Things row for a level with no definitions', () => {
    const rows = layerRows({
      kit: { definitions: [], things: [], problems: [] },
      sectors: 1,
      walls: 4,
      view: initialView,
    })
    expect(rows.map((row) => row.id)).toEqual(['sectors', 'walls'])
  })
})

describe('editorLayerRows', () => {
  it('counts the rooms and walls of the editor’s level, and follows its view', () => {
    const editor = createLevelEditor({ profile: afSectorProfile, level: toyAfSector() })
    editor.view.toggle('hidden', 'walls')
    const rows = editorLayerRows(editor)
    expect(rows.map((row) => [row.id, row.count, row.hidden])).toEqual([
      ['sectors', 2, false],
      ['walls', 8, true],
    ])
  })
})
