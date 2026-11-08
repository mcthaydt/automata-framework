import { describe, expect, it } from 'vitest'
import {
  autoLayerRows,
  groupRows,
  resolveSelection,
  ruleInspector,
  ruleRows,
  ruleSummary,
  tagRows,
  tilesetRows,
} from '#src/features/tiles/tilesets-model.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { AutoLayerDef, Project } from '#src/shared/level-2d/model/project-types.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { topdownRpgTemplate } from '#src/shared/level-2d/profiles/level-project/templates/topdown-rpg.ts'
import type { Rule } from '#src/shared/level-2d/tiles/autotile/rule.schema.ts'

const platformer = (): Project => platformerTemplate.create(counterIds())
const ground = (project: Project): AutoLayerDef =>
  project.defs.layers.find(
    (layer): layer is AutoLayerDef => layer.id === 'ground' && layer.kind === 'auto',
  ) as AutoLayerDef

const rule = (patch: Partial<Rule>): Rule => ({
  id: 'r',
  active: true,
  size: 1,
  pattern: ['filled'],
  tiles: [3],
  chance: 1,
  flipX: false,
  flipY: false,
  breakOnMatch: false,
  outside: 0,
  ...patch,
})

describe('the Tilesets panel rows', () => {
  it('lists each tileset with its tile size, and says a generated one is a placeholder', () => {
    const project = platformer()
    expect(tilesetRows(project)).toEqual([
      { id: 'terrain', label: 'Terrain (placeholder)', sub: '16 px · placeholder' },
    ])
    const withArt: Project = {
      ...project,
      defs: {
        ...project.defs,
        tilesets: project.defs.tilesets.map((set) => ({
          ...set,
          image: 'assets/t.png',
          tile: { w: 16, h: 8 },
        })),
      },
    }
    expect(tilesetRows(withArt)[0]?.sub).toMatch(/^16 × 8 px · \d+ tiles$/)
  })

  it('lists the auto layers with the IntGrid layer each reads', () => {
    expect(autoLayerRows(platformer())).toEqual([{ id: 'ground', label: 'Ground', sub: 'from Collision' }])
    expect(autoLayerRows(topdownRpgTemplate.create(counterIds()))).toEqual([
      { id: 'walls-art', label: 'Wall art', sub: 'from Walls' },
    ])
  })

  it('lists a layer’s rule groups with their rule counts, an inactive one marked off', () => {
    const def = ground(platformer())
    const terrainCount = def.groups[0]?.rules.length ?? 0
    expect(groupRows(def)).toEqual([
      { id: 'terrain', label: 'Terrain', sub: `${terrainCount} rules`, active: true },
      { id: 'hazards', label: 'Hazards and water', sub: '4 rules', active: true },
    ])
    const off = { ...def, groups: [{ id: 'g', label: 'G', active: false, rules: [rule({})] }] }
    expect(groupRows(off)).toEqual([{ id: 'g', label: 'G', sub: '1 rule · off', active: false }])
  })

  it('lists a group’s rules in order with their pattern, first output and a summary', () => {
    const rows = ruleRows(ground(platformer()), 'hazards')
    expect(rows.map((row) => [row.id, row.sub, row.firstTile, row.size])).toEqual([
      ['spike', '1 tile', rows[0]?.firstTile, 1],
      ['water', '1 tile', rows[1]?.firstTile, 1],
      ['ladder', '1 tile', rows[2]?.firstTile, 1],
      ['one-way', '1 tile', rows[3]?.firstTile, 1],
    ])
    expect(rows[0]?.pattern).toEqual([{ is: 3 }])
    expect(ruleRows(ground(platformer()), 'missing')).toEqual([])
  })

  it('summarises a rule in a few words', () => {
    expect(ruleSummary(rule({ tiles: [] }))).toBe('no tile')
    expect(ruleSummary(rule({ tiles: [1, 2], chance: 0.3, flipX: true, breakOnMatch: true }))).toBe(
      '2 tiles · chance 30% · flip X · break',
    )
    expect(ruleSummary(rule({ flipY: true, active: false, chance: 0.125 }))).toBe(
      '1 tile · chance 12.5% · flip Y · off',
    )
  })

  it('lists a tileset’s tags with how many tiles each holds', () => {
    const set = {
      ...platformer().defs.tilesets[0],
      tags: [
        { tag: 'solid', tiles: [0, 1, 2] },
        { tag: 'water', tiles: [9] },
      ],
    }
    expect(tagRows(set as Project['defs']['tilesets'][number])).toEqual([
      { tag: 'solid', count: 3, tiles: [0, 1, 2] },
      { tag: 'water', count: 1, tiles: [9] },
    ])
  })
})

describe('what the Tilesets view has selected', () => {
  it('starts on the first tileset, auto layer, group and rule, and the source layer’s first value', () => {
    const project = platformer()
    expect(resolveSelection(project, { tiles: [] })).toEqual({
      tileset: 'terrain',
      layer: 'ground',
      group: 'terrain',
      rule: ground(project).groups[0]?.rules[0]?.id,
      tiles: [],
      tag: undefined,
      value: 1,
    })
  })

  it('falls back to the first remaining when a selected group or rule is gone, and keeps a rule that is there', () => {
    const project = platformer()
    expect(resolveSelection(project, { group: 'hazards', rule: 'gone', tiles: [] }).rule).toBe('spike')
    expect(resolveSelection(project, { group: 'gone', rule: 'water', tiles: [] })).toMatchObject({
      group: 'terrain',
      rule: ground(project).groups[0]?.rules[0]?.id,
    })
    expect(resolveSelection(project, { group: 'hazards', rule: 'water', tiles: [] }).rule).toBe('water')
  })

  it('keeps only tiles inside the tileset, sorted and once, and a tag the tileset has', () => {
    const project = platformer()
    const picked = resolveSelection(project, { tiles: [5, 2, 5, 100000], tag: 'none', value: 4 })
    expect(picked).toMatchObject({ tiles: [2, 5], tag: undefined, value: 4 })
    expect(resolveSelection(project, { tiles: [], value: 99 }).value).toBe(1)
  })

  it('selects no layer, group or rule in a project without an auto layer', () => {
    const project = platformer()
    const bare: Project = {
      ...project,
      defs: { ...project.defs, layers: project.defs.layers.filter((layer) => layer.kind !== 'auto') },
    }
    expect(resolveSelection(bare, { tiles: [] })).toMatchObject({
      tileset: 'terrain',
      layer: undefined,
      group: undefined,
      rule: undefined,
      value: undefined,
    })
  })
})

describe('the rule inspector', () => {
  it('labels the pattern cells, marks the centre, and offers the source layer’s values', () => {
    const project = platformer()
    const def = ground(project)
    const id = def.groups[0]?.rules[0]?.id ?? ''
    const shaped = {
      ...project,
      defs: {
        ...project.defs,
        layers: project.defs.layers.map((layer) =>
          layer.id === 'ground' && layer.kind === 'auto'
            ? {
                ...layer,
                groups: layer.groups.map((group, g) =>
                  g === 0
                    ? {
                        ...group,
                        rules: group.rules.map((each, r) =>
                          r === 0
                            ? {
                                ...each,
                                size: 3 as const,
                                pattern: [
                                  'any',
                                  'empty',
                                  'filled',
                                  { is: 1 },
                                  'filled',
                                  { not: 3 },
                                  'any',
                                  'any',
                                  { is: 9 },
                                ],
                              }
                            : each,
                        ),
                      }
                    : group,
                ),
              }
            : layer,
        ),
      },
    } as Project
    const inspector = ruleInspector(shaped, 'ground', id, new Set())
    expect(inspector?.cells.map((cell) => cell.label)).toEqual([
      'any',
      'empty',
      'filled',
      'is Solid',
      'filled',
      'not Spike',
      'any',
      'any',
      'is 9',
    ])
    expect(inspector?.cells.filter((cell) => cell.centre).map((cell) => cell.index)).toEqual([4])
    expect(inspector?.values.map((value) => value.label)).toEqual([
      'Solid',
      'One-way',
      'Spike',
      'Water',
      'Ladder',
    ])
    expect(inspector).toMatchObject({ layer: 'ground', group: 'terrain', place: 1, tileset: 'terrain' })
  })

  it('gives the outputs as tiles, the chance in percent and the outside choices', () => {
    const inspector = ruleInspector(platformer(), 'ground', 'spike', new Set())
    expect(inspector?.outputs.map((tile) => tile.tile)).toEqual(
      ruleRows(ground(platformer()), 'hazards')
        .slice(0, 1)
        .map((row) => row.firstTile),
    )
    expect(inspector?.chance).toBe(100)
    expect(inspector?.outside).toBe('0')
    expect(inspector?.outsideOptions.map((option) => option.label)).toEqual([
      'Same as the centre',
      'Empty',
      'Solid',
      'One-way',
      'Spike',
      'Water',
      'Ladder',
    ])
    expect(inspector?.outsideOptions[0]?.id).toBe('same')
    expect(inspector).toMatchObject({ group: 'hazards', place: 1 })
  })

  it('is undefined for a rule or layer that is not there', () => {
    expect(ruleInspector(platformer(), 'ground', 'nope', new Set())).toBeUndefined()
    expect(ruleInspector(platformer(), 'collision', 'spike', new Set())).toBeUndefined()
  })
})
