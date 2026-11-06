import { describe, expect, it } from 'vitest'
import { mossgate } from '../../../../testing/level-2d/samples'
import { findLayer, updateLayer } from './layer-target'

const STEPS = { level: 'moss-steps', layer: 'collision' }

describe('updateLayer', () => {
  it('rebuilds the project with one layer changed and shares everything else', () => {
    const project = mossgate()
    const before = project.levels.find((level) => level.id === 'moss-steps')
    const next = updateLayer(project, STEPS, (layer, def) => {
      expect(def.id).toBe('collision')
      expect(layer.def).toBe('collision')
      return layer.kind === 'intgrid' ? { ...layer, cells: layer.cells.set(0, 0, 1) } : layer
    })
    const after = next.levels.find((level) => level.id === 'moss-steps')
    expect(next).not.toBe(project)
    expect(next.defs).toBe(project.defs)
    expect(next.worlds).toBe(project.worlds)
    expect(next.levels.find((level) => level.id === 'root-cellar')).toBe(
      project.levels.find((level) => level.id === 'root-cellar'),
    )
    expect(after?.layers.filter((_, i) => before?.layers[i] === after.layers[i])).toHaveLength(3)
    const layer = after?.layers.find((candidate) => candidate.def === 'collision')
    expect(layer?.kind === 'intgrid' && layer.cells.get(0, 0)).toBe(1)
  })

  it('keeps the layer in its place among the level layers', () => {
    const project = mossgate()
    const order = (p: typeof project): string[] =>
      p.levels.find((level) => level.id === 'moss-steps')?.layers.map((layer) => layer.def) ?? []
    const next = updateLayer(project, { level: 'moss-steps', layer: 'decor' }, (layer) =>
      layer.kind === 'tiles' ? { ...layer, cells: layer.cells.set(0, 0, 5) } : layer,
    )
    expect(order(next)).toEqual(order(project))
  })

  it('returns the same project when the edit returns the same layer', () => {
    const project = mossgate()
    expect(updateLayer(project, STEPS, (layer) => layer)).toBe(project)
  })

  it('throws a RangeError naming the missing level', () => {
    expect(() => updateLayer(mossgate(), { level: 'nowhere', layer: 'collision' }, (layer) => layer)).toThrow(
      new RangeError('no level "nowhere"'),
    )
  })

  it('throws a RangeError when the level has the layer but the definitions do not', () => {
    const project = mossgate()
    const broken = {
      ...project,
      defs: { ...project.defs, layers: project.defs.layers.filter((def) => def.id !== 'collision') },
    }
    expect(() => updateLayer(broken, STEPS, (layer) => layer)).toThrow(
      new RangeError('no layer "collision" in level "moss-steps"'),
    )
  })

  it('throws a RangeError naming the missing layer and its level', () => {
    expect(() => updateLayer(mossgate(), { level: 'moss-steps', layer: 'sky' }, (layer) => layer)).toThrow(
      new RangeError('no layer "sky" in level "moss-steps"'),
    )
  })
})

describe('findLayer', () => {
  it('finds the layer, its definition, its level and its place', () => {
    const project = mossgate()
    const found = findLayer(project, { level: 'moss-steps', layer: 'decor' })
    expect(found.layer.def).toBe('decor')
    expect(found.def.id).toBe('decor')
    expect(found.level.id).toBe('moss-steps')
    expect(found.level.layers[found.index]).toBe(found.layer)
  })

  it('throws the same RangeErrors as updateLayer', () => {
    const project = mossgate()
    expect(() => findLayer(project, { level: 'nowhere', layer: 'decor' })).toThrow(
      new RangeError('no level "nowhere"'),
    )
    expect(() => findLayer(project, { level: 'moss-steps', layer: 'sky' })).toThrow(
      new RangeError('no layer "sky" in level "moss-steps"'),
    )
  })
})
