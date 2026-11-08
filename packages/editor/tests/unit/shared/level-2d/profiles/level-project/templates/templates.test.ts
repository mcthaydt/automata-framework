import { describe, expect, it } from 'vitest'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { openProject } from '#src/shared/level-2d/model/open-project.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { LayerInstance, Project } from '#src/shared/level-2d/model/project-types.ts'
import { tilesetTiles } from '#src/shared/level-2d/model/tileset-grid.ts'
import { blankTemplate } from '#src/shared/level-2d/profiles/level-project/templates/blank.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { topdownRpgTemplate } from '#src/shared/level-2d/profiles/level-project/templates/topdown-rpg.ts'
import { compileRules } from '#src/shared/level-2d/tiles/autotile/match.ts'

const TEMPLATES = [platformerTemplate, topdownRpgTemplate, blankTemplate]

const layer = <K extends LayerInstance['kind']>(
  project: Project,
  level: number,
  def: string,
  kind: K,
): Extract<LayerInstance, { kind: K }> => {
  const found = project.levels[level]?.layers.find((candidate) => candidate.def === def)
  if (found?.kind !== kind) throw new Error(`no ${kind} layer "${def}"`)
  return found as Extract<LayerInstance, { kind: K }>
}

describe('every template', () => {
  it.each(TEMPLATES.map((template) => [template.id, template] as const))(
    '%s opens as the project it made, byte for byte',
    (_id, template) => {
      const project = template.create(counterIds())
      const text = printProject(project)
      const opened = openProject(text)
      expect(opened.status).toBe('opened')
      if (opened.status !== 'opened') return
      expect(printProject(opened.project)).toBe(text)
      expect(project.template).toBe(template.id)
      expect(project.format).toBe('af2d')
    },
  )

  it('takes every instance id from the source it is given', () => {
    const first = platformerTemplate.create(counterIds())
    const again = platformerTemplate.create(counterIds())
    const later = platformerTemplate.create(counterIds(100))
    expect(printProject(again)).toBe(printProject(first))
    expect(printProject(later)).not.toBe(printProject(first))
  })

  it('has one level in exactly one world, and a placeholder tileset for every tileset it uses', () => {
    for (const template of TEMPLATES) {
      const project = template.create(counterIds())
      expect(project.levels).toHaveLength(1)
      expect(project.worlds).toHaveLength(1)
      expect(project.worlds[0]?.placements.map((p) => p.level)).toEqual([project.levels[0]?.id])
      for (const tileset of project.defs.tilesets) expect(tileset.image).toBeUndefined()
    }
  })

  it('has labels in the template list', () => {
    expect(TEMPLATES.map((template) => template.label)).toEqual(['Platformer', 'Top-down', 'Blank'])
  })
})

describe('the platformer template', () => {
  const project = platformerTemplate.create(counterIds())

  it('has the layers of the spec, front to back, and the collision values', () => {
    expect(project.defs.layers.map((l) => [l.id, l.kind])).toEqual([
      ['entities', 'entities'],
      ['decor', 'tiles'],
      ['ground', 'auto'],
      ['collision', 'intgrid'],
    ])
    const collision = project.defs.layers[3]
    if (collision?.kind !== 'intgrid') throw new Error('not IntGrid')
    expect(collision.values.map((v) => [v.value, v.id])).toEqual([
      [1, 'solid'],
      [2, 'one-way'],
      [3, 'spike'],
      [4, 'water'],
      [5, 'ladder'],
    ])
  })

  it('draws the ground from collision with the 47-tile terrain group, inside its tileset', () => {
    const ground = project.defs.layers[2]
    if (ground?.kind !== 'auto') throw new Error('not auto')
    expect(ground.source).toBe('collision')
    const terrain = ground.groups.find((group) => group.id === 'terrain')
    expect(terrain?.rules).toHaveLength(47)
    const tileset = project.defs.tilesets.find((set) => set.id === ground.tileset)
    expect(tilesetTiles(tileset as never).count).toBe(64)
    const used = ground.groups.flatMap((group) => group.rules.flatMap((rule) => rule.tiles))
    expect(Math.max(...used)).toBeLessThan(64)
    expect(compileRules(ground.groups).radius).toBe(1)
  })

  it('defines the entities of the spec with their limits as data', () => {
    expect(project.defs.entities.map((e) => e.id)).toEqual([
      'player-start',
      'slime',
      'coin',
      'door',
      'checkpoint',
      'moving-platform',
    ])
    const start = project.defs.entities.find((e) => e.id === 'player-start')
    expect(start?.single).toBe(true)
    expect(start?.min).toEqual({ per: 'project', count: 1 })
    const slime = project.defs.entities.find((e) => e.id === 'slime')
    expect(slime?.fields.map((f) => [f.id, f.type, f.list ?? false])).toEqual([
      ['hp', 'int', false],
      ['patrol', 'point', true],
      ['tint', 'color', false],
    ])
    const door = project.defs.entities.find((e) => e.id === 'door')
    expect(door?.fields).toEqual([expect.objectContaining({ id: 'target', type: 'ref', required: true })])
    expect(project.defs.levelFields.map((f) => [f.id, f.type])).toEqual([['music', 'text']])
  })

  it('has platforms to jump between above the floor, so the first level is a platformer and not a flat line', () => {
    const collision = layer(project, 0, 'collision', 'intgrid').cells
    // A run is a row of at least three solid cells; each is higher than the floor, which starts at row 16.
    const runs: number[] = []
    for (let row = 0; row < 16; row++) {
      let length = 0
      for (let col = 0; col <= collision.cols; col++) {
        if (col < collision.cols && collision.get(col, row) === 1) length++
        else {
          if (length >= 3) runs.push(row)
          length = 0
        }
      }
    }
    expect(runs.length).toBeGreaterThanOrEqual(3)
    // A jump is about four cells: no platform is more than four rows above the floor or the platform before it.
    expect(Math.min(...runs)).toBeGreaterThanOrEqual(8)
  })

  it('starts one 512 × 288 level with a floor to stand on and a player start on it', () => {
    const level = project.levels[0]
    expect(level?.size).toEqual({ w: 512, h: 288 })
    const collision = layer(project, 0, 'collision', 'intgrid').cells
    expect([collision.cols, collision.rows]).toEqual([32, 18])
    expect(collision.get(0, 15)).toBe(0)
    expect(collision.get(0, 16)).toBe(1)
    expect(collision.get(31, 17)).toBe(1)
    const items = layer(project, 0, 'entities', 'entities').items
    expect(items).toEqual([{ id: '00000001', def: 'player-start', x: 48, y: 256, fields: {} }])
    expect(project.worlds[0]).toEqual({
      id: 'main',
      layout: 'free',
      placements: [{ level: 'level-1', x: 0, y: 0, depth: 0 }],
    })
  })
})

describe('the top-down RPG template', () => {
  const project = topdownRpgTemplate.create(counterIds())

  it('has the layers of the spec, front to back', () => {
    expect(project.defs.layers.map((l) => [l.id, l.kind])).toEqual([
      ['entities', 'entities'],
      ['props', 'objects'],
      ['walls-art', 'auto'],
      ['walls', 'intgrid'],
      ['ground', 'tiles'],
    ])
    const walls = project.defs.layers[3]
    if (walls?.kind !== 'intgrid') throw new Error('not IntGrid')
    expect(walls.values.map((v) => v.id)).toEqual(['blocked', 'water', 'door-frame'])
  })

  it('defines the entities of the spec', () => {
    expect(project.defs.entities.map((e) => e.id)).toEqual([
      'player-start',
      'npc',
      'door',
      'warp',
      'chest',
      'sign',
      'trigger',
      'enemy',
    ])
    const trigger = project.defs.entities.find((e) => e.id === 'trigger')
    expect(trigger?.resizable).toBe('xy')
    for (const id of ['door', 'warp']) {
      const def = project.defs.entities.find((e) => e.id === id)
      expect(def?.fields.find((f) => f.id === 'target')).toEqual(
        expect.objectContaining({ type: 'ref', required: true }),
      )
      expect(def?.fields.find((f) => f.id === 'facing')?.type).toBe('enum')
    }
    expect(project.defs.entities.find((e) => e.id === 'player-start')?.min).toEqual({
      per: 'project',
      count: 1,
    })
    expect(project.defs.levelFields.map((f) => f.id)).toEqual(['area'])
  })

  it('starts one 320 × 240 level of grass with a player start in the middle', () => {
    expect(project.levels[0]?.size).toEqual({ w: 320, h: 240 })
    const ground = layer(project, 0, 'ground', 'tiles').cells
    expect([ground.cols, ground.rows]).toEqual([20, 15])
    expect(ground.nonEmpty()).toHaveLength(20 * 15)
    expect(ground.get(10, 7)).toBe(1) // tile 0 is cell value 1
    expect(layer(project, 0, 'entities', 'entities').items).toEqual([
      { id: '00000001', def: 'player-start', x: 160, y: 120, fields: {} },
    ])
  })

  it('draws walls with the 16-tile edge set and keeps every tile inside its tileset', () => {
    const art = project.defs.layers[2]
    if (art?.kind !== 'auto') throw new Error('not auto')
    expect(art.source).toBe('walls')
    expect(art.groups[0]?.rules).toHaveLength(16)
    const tileset = project.defs.tilesets.find((set) => set.id === art.tileset)
    const used = art.groups.flatMap((group) => group.rules.flatMap((rule) => rule.tiles))
    expect(Math.max(...used)).toBeLessThan(tilesetTiles(tileset as never).count)
  })
})

describe('the blank template', () => {
  const project = blankTemplate.create(counterIds())

  it('has one tiles layer, one entities layer, one placeholder tileset and nothing else', () => {
    expect(project.defs.layers.map((l) => [l.id, l.kind])).toEqual([
      ['entities', 'entities'],
      ['tiles', 'tiles'],
    ])
    expect(project.defs.tilesets).toHaveLength(1)
    expect(project.defs.entities).toEqual([])
    expect(project.defs.levelFields).toEqual([])
    expect(project.levels[0]?.size).toEqual({ w: 256, h: 256 })
    expect(layer(project, 0, 'tiles', 'tiles').cells.nonEmpty()).toEqual([])
    expect(layer(project, 0, 'entities', 'entities').items).toEqual([])
  })
})
