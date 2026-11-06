import { describe, expect, it } from 'vitest'
import { counterIds } from '../../shared/level-2d/model/ids'
import type { AutoLayerDef, Project } from '../../shared/level-2d/model/project-types'
import { platformerTemplate } from '../../shared/level-2d/profiles/level-project/templates/platformer'
import { autoTiles } from '../../shared/level-2d/tiles/autotile/auto-tiles'
import { compileRules } from '../../shared/level-2d/tiles/autotile/match'
import type { Rule } from '../../shared/level-2d/tiles/autotile/rule.schema'
import { rulePreview, SAMPLE, sampleGrid } from './rule-preview'

const platformer = (): Project => platformerTemplate.create(counterIds())

/** The platformer's Ground layer with one more group holding `rule`. */
function withRule(project: Project, rule: Rule): Project {
  return {
    ...project,
    defs: {
      ...project.defs,
      layers: project.defs.layers.map((layer) =>
        layer.kind === 'auto'
          ? {
              ...layer,
              groups: [...layer.groups, { id: 'extra', label: 'Extra', active: true, rules: [rule] }],
            }
          : layer,
      ),
    },
  }
}

const solo = (patch: Partial<Rule>): Rule => ({
  id: 'solo',
  active: true,
  size: 3,
  pattern: ['any', 'any', 'any', 'any', 'filled', 'any', 'any', 'any', 'any'],
  tiles: [1],
  chance: 1,
  flipX: false,
  flipY: false,
  breakOnMatch: false,
  outside: 0,
  ...patch,
})

const rows = (value: number): string[] => {
  const grid = sampleGrid(value)
  return Array.from({ length: grid.rows }, (_, y) =>
    Array.from({ length: grid.cols }, (_, x) => (grid.get(x, y) === 0 ? '.' : String(grid.get(x, y)))).join(
      '',
    ),
  )
}

describe('the sample IntGrid', () => {
  it('is a fixed shape with a step, a hole and a lone cell, painted with the chosen value', () => {
    expect(SAMPLE).toEqual({ cols: 12, rows: 8 })
    expect(rows(2)).toEqual([
      '............',
      '.222....2...',
      '.2222.......',
      '.2222...222.',
      '.22.2...222.',
      '.2222.222222',
      '222222222222',
      '222222222222',
    ])
  })
})

describe('the live preview', () => {
  it('draws what the layer’s rules make of the sample, with the first level’s seed', () => {
    const project = platformer()
    const def = project.defs.layers.find((layer) => layer.id === 'ground') as AutoLayerDef
    const preview = rulePreview(project, 'ground', 1)
    const instance = project.levels[0]?.layers.find((layer) => layer.def === 'ground')
    expect(instance?.kind === 'auto' ? instance.seed : undefined).toBe(preview.seed)
    expect(preview.result).toEqual(autoTiles(sampleGrid(1), compileRules(def.groups), preview.seed))
    expect(preview.result.stacks.size).toBeGreaterThan(0)
    expect(preview.tileset?.id).toBe('terrain')
  })

  it('outlines where the selected rule matches on its own', () => {
    const project = withRule(platformer(), solo({}))
    const preview = rulePreview(project, 'ground', 1, 'solo')
    const filled: number[] = []
    const grid = sampleGrid(1)
    for (let y = 0; y < grid.rows; y++)
      for (let x = 0; x < grid.cols; x++) if (grid.get(x, y) !== 0) filled.push(y * grid.cols + x)
    expect(preview.matched).toEqual(filled)
  })

  it('matches nothing where the rule asks for a value the sample does not hold, and even an inactive rule shows', () => {
    const project = withRule(platformer(), solo({ size: 1, pattern: [{ is: 2 }], active: false }))
    expect(rulePreview(project, 'ground', 1, 'solo').matched).toEqual([])
    expect(rulePreview(project, 'ground', 2, 'solo').matched.length).toBeGreaterThan(0)
  })

  it('is empty for a layer that is not an auto layer', () => {
    const preview = rulePreview(platformer(), 'collision', 1)
    expect(preview.result.stacks.size).toBe(0)
    expect(preview.matched).toEqual([])
    expect(preview.tileset).toBeUndefined()
  })
})
