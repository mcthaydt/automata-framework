import { describe, expect, it } from 'vitest'
import { checkProject } from '../../profiles/level-project/project-checks'
import { blankTemplate } from '../../profiles/level-project/templates/blank'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { withNewLevel } from '../../testing/project-edit'
import type { Rule } from '../../tiles/autotile/rule.schema'
import { counterIds } from '../ids'
import type { AutoLayerDef, IntGridLayerDef, LayerDef, Project } from '../project-types'
import { addLayerDef, editLayerDef, reorderLayerDefs, setIntValue } from './layer-def-edits'
import { newRule } from './rule-edits'

const platformer = (): Project => platformerTemplate.create(counterIds())
const twoLevels = (): Project => withNewLevel(platformer(), 'level-2', { x: 512, y: 0 })
const errors = (p: Project): string[] =>
  checkProject(p, {})
    .filter((d) => d.severity === 'error')
    .map((d) => d.code)
const defIds = (p: Project): string[] => p.defs.layers.map((def) => def.id)
const levelLayerIds = (p: Project): string[][] =>
  p.levels.map((level) => level.layers.map((layer) => layer.def))

const regions: IntGridLayerDef = {
  id: 'regions',
  label: 'Regions',
  kind: 'intgrid',
  grid: 16,
  values: [{ value: 1, id: 'safe', color: '#22c55e' }],
  opacity: 0.5,
}

describe('addLayerDef', () => {
  it('appends the definition and an empty instance to every level', () => {
    const next = addLayerDef(twoLevels(), regions)
    expect(defIds(next)).toEqual(['entities', 'decor', 'ground', 'collision', 'regions'])
    for (const level of next.levels) {
      const layer = level.layers.at(-1)
      expect(layer?.def).toBe('regions')
      expect(
        layer?.kind === 'intgrid' && [layer.cells.cols, layer.cells.rows, layer.cells.chunkCount],
      ).toEqual([32, 18, 0])
    }
    expect(errors(next)).toEqual([])
  })

  it('puts the definition and the instances at the index it is given', () => {
    const next = addLayerDef(
      twoLevels(),
      { id: 'pickups', label: 'Pickups', kind: 'entities', grid: 16, snap: false },
      1,
    )
    expect(defIds(next)).toEqual(['entities', 'pickups', 'decor', 'ground', 'collision'])
    expect(levelLayerIds(next)).toEqual([defIds(next), defIds(next)])
  })

  it('adds every kind with the instance its kind needs', () => {
    let next = blankTemplate.create(counterIds())
    next = addLayerDef(next, regions)
    next = addLayerDef(next, {
      id: 'art',
      label: 'Art',
      kind: 'auto',
      grid: 16,
      source: 'regions',
      tileset: 'tiles',
      groups: [],
      opacity: 1,
    })
    next = addLayerDef(next, { id: 'props', label: 'Props', kind: 'objects', tileset: 'tiles', snap: 0 })
    const kinds = next.levels[0]?.layers.map((layer) => layer.kind)
    expect(kinds).toEqual(['entities', 'tiles', 'intgrid', 'auto', 'objects'])
    const art = next.levels[0]?.layers[3]
    expect(art?.kind === 'auto' && art.seed).toBe(1)
    expect(errors(next)).toEqual([])
  })

  it('refuses a shape the file schema refuses', () => {
    expect(() => addLayerDef(platformer(), { ...regions, id: 'Regions' })).toThrow(RangeError)
    expect(() => addLayerDef(platformer(), { ...regions, grid: 3 })).toThrow(/grid/)
    expect(() => addLayerDef(platformer(), { ...regions, opacity: 2 })).toThrow(RangeError)
  })

  it('refuses an id another layer has', () => {
    expect(() => addLayerDef(platformer(), { ...regions, id: 'collision' })).toThrow(/already/)
  })

  it('refuses a tileset that does not exist and an auto layer that does not read an IntGrid layer', () => {
    expect(() =>
      addLayerDef(platformer(), {
        id: 'more',
        label: 'More',
        kind: 'tiles',
        grid: 16,
        tileset: 'nope',
        opacity: 1,
      }),
    ).toThrow(/tileset "nope"/)
    const auto = (source: string): LayerDef => ({
      id: 'art',
      label: 'Art',
      kind: 'auto',
      grid: 16,
      source,
      tileset: 'terrain',
      groups: [],
      opacity: 1,
    })
    expect(() => addLayerDef(platformer(), auto('decor'))).toThrow(/IntGrid/)
    expect(() => addLayerDef(platformer(), auto('nothing'))).toThrow(/IntGrid/)
    expect(errors(addLayerDef(platformer(), auto('collision')))).toEqual([])
  })

  it("checks an auto layer's rules against its source and tileset", () => {
    const rule = { ...newRule('r1'), tiles: [0] }
    const auto = (groups: AutoLayerDef['groups']): LayerDef => ({
      id: 'art',
      label: 'Art',
      kind: 'auto',
      grid: 16,
      source: 'collision',
      tileset: 'terrain',
      groups,
      opacity: 1,
    })
    const group = (id: string, rules: readonly Rule[]) => ({ id, label: id, active: true, rules })
    expect(errors(addLayerDef(platformer(), auto([group('a', [rule])])))).toEqual([])
    expect(() => addLayerDef(platformer(), auto([group('a', [{ ...rule, tiles: [64] }])]))).toThrow(/tile 64/)
    expect(() => addLayerDef(platformer(), auto([group('a', [rule]), group('b', [rule])]))).toThrow(/r1/)
    expect(() => addLayerDef(platformer(), auto([group('a', []), group('a', [])]))).toThrow(/group id "a"/)
  })

  it('refuses an IntGrid layer that repeats a value or a value id', () => {
    const value = { value: 1, id: 'safe', color: '#22c55e' }
    expect(() =>
      addLayerDef(platformer(), { ...regions, values: [value, { ...value, id: 'other' }] }),
    ).toThrow(/repeats/)
    expect(() => addLayerDef(platformer(), { ...regions, values: [value, { ...value, value: 2 }] })).toThrow(
      /repeats/,
    )
  })

  it('refuses a grid that makes a level more than 1024 cells on a side', () => {
    const wide: Project = {
      ...platformer(),
      levels: platformer().levels.map((l) => ({ ...l, size: { w: 4100, h: 16 } })),
    }
    expect(() => addLayerDef(wide, { ...regions, grid: 4 })).toThrow(/1024/)
    expect(addLayerDef(wide, { ...regions, grid: 8 }).defs.layers).toHaveLength(5)
  })

  it('refuses a 65th layer', () => {
    let next = blankTemplate.create(counterIds())
    for (let i = next.defs.layers.length; i < 64; i++) next = addLayerDef(next, { ...regions, id: `r-${i}` })
    expect(() => addLayerDef(next, { ...regions, id: 'one-more' })).toThrow(/64/)
  })

  it('refuses an index outside the list', () => {
    expect(() => addLayerDef(platformer(), regions, 5)).toThrow(RangeError)
    expect(() => addLayerDef(platformer(), regions, -1)).toThrow(RangeError)
    expect(defIds(addLayerDef(platformer(), regions, 4)).at(-1)).toBe('regions')
  })
})

describe('reorderLayerDefs', () => {
  it('moves the definition and every level instance together', () => {
    const next = reorderLayerDefs(twoLevels(), 3, 0)
    expect(defIds(next)).toEqual(['collision', 'entities', 'decor', 'ground'])
    expect(levelLayerIds(next)).toEqual([defIds(next), defIds(next)])
    expect(errors(next)).toEqual([])
    expect(defIds(reorderLayerDefs(twoLevels(), 0, 2))).toEqual(['decor', 'ground', 'entities', 'collision'])
  })

  it('shares the layer instances it moves', () => {
    const project = twoLevels()
    const next = reorderLayerDefs(project, 3, 0)
    expect(next.levels[0]?.layers[0]).toBe(project.levels[0]?.layers[3])
  })

  it('returns the same project for the same index and throws outside the list', () => {
    const project = twoLevels()
    expect(reorderLayerDefs(project, 2, 2)).toBe(project)
    expect(() => reorderLayerDefs(project, 4, 0)).toThrow(RangeError)
    expect(() => reorderLayerDefs(project, 0, 4)).toThrow(RangeError)
    expect(() => reorderLayerDefs(project, 0.5, 1)).toThrow(RangeError)
  })
})

describe('editLayerDef', () => {
  it('changes the label and the opacity', () => {
    const project = platformer()
    const next = editLayerDef(project, 'collision', { label: 'Solid ground', opacity: 0.25 })
    expect(next.defs.layers[3]).toMatchObject({ label: 'Solid ground', opacity: 0.25 })
    expect(next.levels).toBe(project.levels)
  })

  it('returns the same project for the values it already has', () => {
    const project = platformer()
    expect(editLayerDef(project, 'collision', { label: 'Collision', opacity: 0.6 })).toBe(project)
    expect(editLayerDef(project, 'collision', {})).toBe(project)
  })

  it('refuses an opacity outside 0 to 1 and on a layer that has none', () => {
    expect(() => editLayerDef(platformer(), 'collision', { opacity: 1.5 })).toThrow(RangeError)
    expect(() => editLayerDef(platformer(), 'entities', { opacity: 0.5 })).toThrow(/opacity/)
    expect(editLayerDef(platformer(), 'entities', { label: 'Things' }).defs.layers[0]?.label).toBe('Things')
  })

  it('throws for a layer that does not exist', () => {
    expect(() => editLayerDef(platformer(), 'nothing', { label: 'x' })).toThrow(
      /no layer definition "nothing"/,
    )
  })
})

describe('setIntValue', () => {
  it('adds a value the layer does not have', () => {
    const next = setIntValue(platformer(), 'collision', {
      value: 6,
      id: 'ice',
      label: 'Ice',
      color: '#bae6fd',
    })
    const collision = next.defs.layers[3]
    expect(collision?.kind === 'intgrid' && collision.values.map((value) => value.id)).toEqual([
      'solid',
      'one-way',
      'spike',
      'water',
      'ladder',
      'ice',
    ])
    expect(errors(next)).toEqual([])
  })

  it('relabels, renames and recolours the value with that number in place', () => {
    const next = setIntValue(platformer(), 'collision', {
      value: 2,
      id: 'thin',
      label: 'Thin',
      color: '#ffffff',
    })
    const collision = next.defs.layers[3]
    expect(collision?.kind === 'intgrid' && collision.values[1]).toEqual({
      value: 2,
      id: 'thin',
      label: 'Thin',
      color: '#ffffff',
    })
  })

  it('returns the same project when the value is unchanged', () => {
    const project = platformer()
    expect(
      setIntValue(project, 'collision', { value: 1, id: 'solid', label: 'Solid', color: '#64748b' }),
    ).toBe(project)
  })

  it('refuses an id another value has, a bad value and a layer that is not an IntGrid layer', () => {
    expect(() => setIntValue(platformer(), 'collision', { value: 6, id: 'solid', color: '#000000' })).toThrow(
      /already/,
    )
    expect(() => setIntValue(platformer(), 'collision', { value: 256, id: 'x', color: '#000000' })).toThrow(
      RangeError,
    )
    expect(() => setIntValue(platformer(), 'collision', { value: 6, id: 'x', color: 'red' })).toThrow(
      RangeError,
    )
    expect(() => setIntValue(platformer(), 'decor', { value: 6, id: 'x', color: '#000000' })).toThrow(
      /IntGrid/,
    )
  })
})
