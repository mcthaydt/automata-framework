// The inspector's cards as plain data (ED3D.5f step 2; ED3D spec §9): what is selected, read from the live level. The
// depot: the hall (0, 0)–(8, 6), floor 0, ceiling 4, light 1, tile and brick; its wall 0 has a window, wall 1 is a portal
// into the dock, wall 2 is solid and wall 3 has a door. The dock: floor −0.5, light 0.7. Things: the spawn and a crate.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { inspectorOf, thingRowsOf, wallRowsOf } from '#src/features/levels-3d/inspector/inspector-cards.ts'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const editorWith = (...ids: string[]) => {
  const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
  editor.selection.set(ids)
  return editor
}

describe('inspectorOf', () => {
  it('says how to select when nothing is', () => {
    expect(inspectorOf(editorWith())).toEqual({ kind: 'none', selected: 0 })
  })

  it('reads a sector’s card: heights, light, materials, its walls and portals', () => {
    expect(inspectorOf(editorWith('sector:hall'))).toEqual({
      kind: 'sector',
      selected: 1,
      id: 'hall',
      floor: 0,
      ceiling: 4,
      light: 1,
      style: undefined,
      floorTexture: 'tile',
      ceilingTexture: undefined,
      wallTexture: 'brick',
      view: undefined,
      walls: 4,
      portals: 1,
    })
  })

  it('reads a wall’s card for each kind: solid, portal, door and window', () => {
    const wall = (corner: number) => inspectorOf(editorWith(`wall:hall/${corner}`))
    expect(wall(2)).toMatchObject({ kind: 'wall', sector: 'hall', corner: 2, type: 'solid', length: 8 })
    expect(wall(1)).toMatchObject({ type: 'portal', to: 'dock', length: 6 })
    expect(wall(3)).toMatchObject({ type: 'door', door: { at: 3, width: 1.2, height: 2.2 }, length: 6 })
    expect(wall(0)).toMatchObject({
      type: 'window',
      window: { at: 4, width: 1.6, y0: 1, y1: 2.6 },
      length: 8,
    })
    expect(wall(2)).toMatchObject({
      texture: undefined,
      occlude: undefined,
      handrail: undefined,
      frame: undefined,
    })
  })

  it('reads a thing’s card: its definition, id and place', () => {
    expect(inspectorOf(editorWith('entity:crate/crate1'))).toEqual({
      kind: 'thing',
      selected: 1,
      definition: 'crate',
      id: 'crate1',
      x: 11,
      z: 2,
      y: undefined,
      fields: [
        {
          id: 'contents',
          label: 'contents',
          type: 'enum',
          value: 'tools',
          widget: 'segmented',
          options: ['supplies', 'tools', 'empty'],
        },
      ],
    })
  })

  it('fills a field the thing does not have with the definition’s default, and shows it', () => {
    const spawn = inspectorOf(editorWith('entity:spawn/spawn'))
    expect(spawn).toMatchObject({
      kind: 'thing',
      fields: [{ id: 'facing', widget: 'stepper', value: 0 }],
    })
  })

  it('shows the first of several, and says how many are selected', () => {
    expect(inspectorOf(editorWith('sector:dock', 'sector:hall'))).toMatchObject({
      kind: 'sector',
      id: 'dock',
      selected: 2,
    })
  })

  it('shows none for a selection that names nothing the level has', () => {
    expect(inspectorOf(editorWith('sector:gone'))).toEqual({ kind: 'none', selected: 1 })
  })
})

describe('the portrait sheet’s lists (ED3D.5f step 6)', () => {
  it('lists the walls of the selected room, or of the wall’s room, with each kind', () => {
    expect(wallRowsOf(editorWith('sector:hall'))).toEqual([
      { id: 'wall:hall/0', label: 'Wall 1 · window · 8.00 m', selected: false },
      { id: 'wall:hall/1', label: 'Wall 2 · portal into dock · 6.00 m', selected: false },
      { id: 'wall:hall/2', label: 'Wall 3 · solid · 8.00 m', selected: false },
      { id: 'wall:hall/3', label: 'Wall 4 · door · 6.00 m', selected: false },
    ])
    expect(wallRowsOf(editorWith('wall:hall/2')).find((row) => row.selected)?.id).toBe('wall:hall/2')
    expect(wallRowsOf(editorWith())).toEqual([])
  })

  it('lists the level’s things by definition and id', () => {
    expect(thingRowsOf(editorWith('entity:crate/crate1'))).toEqual([
      { id: 'entity:spawn/spawn', label: 'spawn · spawn', selected: false },
      { id: 'entity:crate/crate1', label: 'crate · crate1', selected: true },
    ])
  })
})
