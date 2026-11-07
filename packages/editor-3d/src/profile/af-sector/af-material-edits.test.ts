// The materials-table edits of an `af-sector/1` level (ED3D.13a step 3): add, set, rename and remove an entry of the
// `materials` table the picker shows. A rename rewrites every member that names the material, so the `materials` check
// still passes; a removal is refused while anything names it.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { levelOf, reasonOf } from '../../testing/edit-helpers'
import { loadAuthored } from '../../testing/fixtures'
import { literalEdits } from '../../testing/text-diff'
import { afSectorProfile } from '../af-sector-profile'
import { addMaterial, removeMaterial, renameMaterial, setMaterial } from './af-material-edits'

const depotText = loadAuthored('depot.af-sector')
const depot = ((): AfSector => {
  const result = afSectorProfile.parse(depotText)
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

type MaterialEdit = ReturnType<typeof addMaterial>
const run = (edit: MaterialEdit, level: AfSector = depot) => edit.run(afSectorProfile, level)

const patched = (after: AfSector, before: AfSector = depot, text = depotText): string => {
  const result = afSectorProfile.patch(text, before, after)
  if (!result.ok) throw new Error(`patch refused at ${JSON.stringify(result.path)}: ${result.detail}`)
  return result.text
}

const materialsCheck = (level: AfSector) =>
  afSectorProfile.checks(level).find((result) => result.id === 'materials')

/** The depot with a style that names brick, a hall wall with a brick texture and a trim piece, and a hole wall in it. */
const textured: AfSector = {
  ...depot,
  styles: { warm: { wallTexture: 'brick', floorTexture: 'plank' } },
  sectors: depot.sectors.map((sector) =>
    sector.id !== 'hall'
      ? sector
      : {
          ...sector,
          style: 'warm',
          corners: sector.corners.map((corner, index) =>
            index === 2
              ? [corner[0], corner[1], { texture: 'brick', trimTexture: { skirting: 'brick' } }]
              : corner,
          ),
          holes: [
            [
              [3, 3, { texture: 'brick' }],
              [4, 3],
              [4, 4],
              [3, 4],
            ],
          ],
        },
  ),
}

describe('addMaterial (material.add)', () => {
  it('adds an entry at the end of the table, and a patch writes only it', () => {
    const next = levelOf(run(addMaterial({ id: 'steel', material: { category: 'walls', label: 'Steel' } })))
    expect(Object.keys(next.materials ?? {})).toEqual(['brick', 'plank', 'tile', 'steel'])
    expect(next.materials?.steel).toEqual({ category: 'walls', label: 'Steel' })
    expect(afSectorProfile.parse(patched(next))).toEqual({ ok: true, value: next })
  })

  it('writes the first table of a file that has none, and leaves out a member that is undefined', () => {
    const bare: AfSector = { ...depot, materials: undefined }
    const next = levelOf(
      run(addMaterial({ id: 'steel', material: { category: 'walls', label: undefined } }), bare),
    )
    expect(next.materials).toEqual({ steel: { category: 'walls' } })
    expect(Object.keys(next.materials?.steel ?? {})).toEqual(['category'])
  })

  it('refuses an id that is no id, one that is taken, and an empty category', () => {
    expect(reasonOf(run(addMaterial({ id: '9', material: { category: 'walls' } })))).toBe(
      'the material id must be an id: a letter, then letters, digits, - or _',
    )
    expect(reasonOf(run(addMaterial({ id: 'brick', material: { category: 'walls' } })))).toBe(
      'there is already a material called brick',
    )
    expect(reasonOf(run(addMaterial({ id: 'steel', material: { category: ' ' } })))).toBe(
      'a material has a category: walls, floors, ceilings or another',
    )
  })
})

describe('setMaterial (material.set)', () => {
  it('changes an entry in its own place, and a patch changes only that value', () => {
    const next = levelOf(
      run(setMaterial({ id: 'brick', material: { category: 'walls', label: 'Red brick' } })),
    )
    expect(next.materials?.brick).toEqual({ category: 'walls', label: 'Red brick' })
    expect(literalEdits(depotText, patched(next))).toEqual(['["materials","brick","label"]'])
  })

  it('is the level itself when nothing differs; refuses an unknown id and an empty category', () => {
    expect(levelOf(run(setMaterial({ id: 'brick', material: { category: 'walls', label: 'Brick' } })))).toBe(
      depot,
    )
    expect(reasonOf(run(setMaterial({ id: 'steel', material: { category: 'walls' } })))).toBe(
      'no material steel',
    )
    expect(reasonOf(run(setMaterial({ id: 'brick', material: { category: '' } })))).toBe(
      'a material has a category: walls, floors, ceilings or another',
    )
  })

  it('scrubbing one entry is one undo step', () => {
    expect(setMaterial({ id: 'brick', material: { category: 'walls' } }).coalesce).toBe('material:brick')
  })
})

describe('renameMaterial (material.rename)', () => {
  it('renames the entry in its place and every member that names it, and the materials check still passes', () => {
    const next = levelOf(run(renameMaterial({ id: 'brick', to: 'redbrick' }), textured))
    expect(Object.keys(next.materials ?? {})).toEqual(['redbrick', 'plank', 'tile'])
    expect(next.styles?.warm).toEqual({ wallTexture: 'redbrick', floorTexture: 'plank' })
    const hall = next.sectors.find((sector) => sector.id === 'hall')
    expect(hall?.wallTexture).toBe('redbrick')
    expect(hall?.corners[2]?.[2]).toEqual({ texture: 'redbrick', trimTexture: { skirting: 'redbrick' } })
    expect(hall?.holes?.[0]?.[0]?.[2]).toEqual({ texture: 'redbrick' })
    expect(next.sectors.find((sector) => sector.id === 'dock')?.wallTexture).toBe('redbrick')
    expect(materialsCheck(next)?.ok).toBe(true)
    expect(materialsCheck(textured)?.ok).toBe(true)
  })

  it('patches the key and the names in place and nothing else', () => {
    const next = levelOf(run(renameMaterial({ id: 'tile', to: 'slate' })))
    const text = patched(next)
    expect(afSectorProfile.parse(text)).toEqual({ ok: true, value: next })
    expect(text).toBe(
      depotText
        .replace('"tile": {', '"slate": {')
        .replace('"floorTexture": "tile"', '"floorTexture": "slate"'),
    )
  })

  it('keeps the sectors and walls that do not name it as they were', () => {
    const next = levelOf(run(renameMaterial({ id: 'tile', to: 'slate' }), textured))
    expect(next.sectors.find((sector) => sector.id === 'dock')).toBe(
      textured.sectors.find((sector) => sector.id === 'dock'),
    )
    expect(next.styles).toBe(textured.styles)
  })

  it('is the level itself for the same id; refuses an unknown id, a bad id and a taken one', () => {
    expect(levelOf(run(renameMaterial({ id: 'brick', to: 'brick' })))).toBe(depot)
    expect(reasonOf(run(renameMaterial({ id: 'steel', to: 'iron' })))).toBe('no material steel')
    expect(reasonOf(run(renameMaterial({ id: 'brick', to: 'a b' })))).toBe(
      'the material id must be an id: a letter, then letters, digits, - or _',
    )
    expect(reasonOf(run(renameMaterial({ id: 'brick', to: 'tile' })))).toBe(
      'there is already a material called tile',
    )
  })
})

describe('removeMaterial (material.remove)', () => {
  it('removes an entry nothing names', () => {
    const unused: AfSector = { ...depot, materials: { ...depot.materials, steel: { category: 'walls' } } }
    const next = levelOf(run(removeMaterial({ id: 'steel' }), unused))
    expect(next.materials).toEqual(depot.materials)
  })

  it('refuses while anything names it, listing each use in file order', () => {
    expect(reasonOf(run(removeMaterial({ id: 'brick' }), textured))).toBe(
      'brick is still used: style warm: wallTexture; hall: wallTexture; hall: wall 2 texture; hall: wall 2 trimTexture skirting; hall: hole 0 wall 0 texture; dock: wallTexture',
    )
    expect(reasonOf(run(removeMaterial({ id: 'steel' })))).toBe('no material steel')
  })
})
