import { describe, expect, it } from 'vitest'
import { valuesWithDefaults } from '#src/shared/kit/fields/field-values.ts'
import { counterIds, type IdSource } from '#src/shared/level-2d/model/ids.ts'
import { emptyLayers } from '#src/shared/level-2d/model/level-layers.ts'
import type { EntityInstance, Level, Placement, Project } from '#src/shared/level-2d/model/project-types.ts'
import {
  addLevel,
  duplicateLevel,
  removeLevel,
  renameLevel,
  setLevelField,
} from '#src/shared/level-2d/model/world/level-edits.ts'
import { setWorldLayout } from '#src/shared/level-2d/model/world/world-layout.ts'
import { checkProject } from '#src/shared/level-2d/profiles/level-project/project-checks.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { entity, withEntities, withNewLevel, withWorld } from '#src/testing/level-2d/project-edit.ts'
import { hollowmere } from '#src/testing/level-2d/samples.ts'

const platformer = (): Project => platformerTemplate.create(counterIds())
const SIZE = { w: 512, h: 288 }
const levelOf = (p: Project, id: string): Level => {
  const found = p.levels.find((level) => level.id === id)
  if (found === undefined) throw new Error(`no level ${id}`)
  return found
}
const placementsOf = (p: Project, world = 'main'): readonly Placement[] =>
  p.worlds.find((found) => found.id === world)?.placements ?? []
const errors = (p: Project): string[] =>
  checkProject(p, {})
    .filter((d) => d.severity === 'error')
    .map((d) => d.code)
const entitiesOf = (level: Level): EntityInstance[] =>
  level.layers.flatMap((layer) => (layer.kind === 'entities' ? layer.items : []))
const add = (p: Project, id: string, x = 512, y = 0): Project =>
  addLevel(p, { id, name: id, world: 'main', x, y, size: SIZE })

describe('addLevel', () => {
  it("adds an empty level with every layer, the level fields' defaults, and places it", () => {
    const before = platformer()
    const after = addLevel(before, { id: 'cave', name: 'Cave', world: 'main', x: 512.4, y: 0, size: SIZE })
    const cave = levelOf(after, 'cave')
    expect(cave).toMatchObject({
      id: 'cave',
      name: 'Cave',
      size: SIZE,
      background: { color: '#000000', mode: 'fit' },
    })
    expect(cave.fields).toEqual(valuesWithDefaults(before.defs.levelFields, {}))
    expect(cave.fields).toEqual({ music: '' })
    expect(cave.layers.map((layer) => [layer.def, layer.kind])).toEqual(
      emptyLayers(before.defs.layers, SIZE).map((layer) => [layer.def, layer.kind]),
    )
    expect(placementsOf(after).at(-1)).toEqual({ level: 'cave', x: 512, y: 0, depth: 0 })
    expect(after.levels[0]).toBe(before.levels[0])
    expect(errors(after)).toEqual(errors(before))
  })

  it('takes a background when given one', () => {
    const background = { color: '#123456', mode: 'cover' as const }
    const after = addLevel(platformer(), {
      id: 'sky',
      name: 'Sky',
      world: 'main',
      x: 0,
      y: -288,
      size: SIZE,
      background,
    })
    expect(levelOf(after, 'sky').background).toEqual(background)
  })

  it("follows the world's layout: snapped on a grid, appended to a sequence", () => {
    const grid = setWorldLayout(platformer(), 'main', 'grid', { w: 64, h: 64 })
    expect(placementsOf(add(grid, 'cave', 500, 40)).at(-1)).toMatchObject({ x: 512, y: 64 })
    const line = setWorldLayout(platformer(), 'main', 'horizontal')
    expect(placementsOf(add(line, 'cave', 9999, 9999)).map((p) => [p.level, p.x, p.y])).toEqual([
      ['level-1', 0, 0],
      ['cave', 512, 0],
    ])
  })

  it('refuses a bad id, a duplicate id, an unknown world and a size past the guard rails', () => {
    expect(() => add(platformer(), 'Cave')).toThrow(/level id "Cave"/)
    expect(() => add(platformer(), 'level-1')).toThrow(/already/)
    expect(() =>
      addLevel(platformer(), { id: 'cave', name: 'Cave', world: 'nowhere', x: 0, y: 0, size: SIZE }),
    ).toThrow(/no world/)
    for (const size of [
      { w: 0, h: 288 },
      { w: 512.5, h: 288 },
      { w: 16385, h: 288 },
      { w: 16384, h: 288 },
    ]) {
      // 16 384 px is the side limit, but at 16 px a cell it is 1024 cells: allowed. 16 385 is past both.
      const attempt = () =>
        addLevel(platformer(), { id: 'cave', name: 'Cave', world: 'main', x: 0, y: 0, size })
      if (size.w === 16384) expect(attempt).not.toThrow()
      else expect(attempt, JSON.stringify(size)).toThrow(RangeError)
    }
  })

  it('refuses a level wider than 1024 cells of its finest layer', () => {
    const fine = {
      ...platformer(),
      defs: {
        ...platformer().defs,
        layers: platformer().defs.layers.map((layer) =>
          layer.id === 'decor' ? { ...layer, grid: 4 } : layer,
        ),
      },
    }
    expect(() =>
      addLevel(fine, { id: 'cave', name: 'Cave', world: 'main', x: 0, y: 0, size: { w: 4100, h: 16 } }),
    ).toThrow(/1025 × 4 cells/)
    expect(() =>
      addLevel(fine, { id: 'cave', name: 'Cave', world: 'main', x: 0, y: 0, size: { w: 16, h: 4100 } }),
    ).toThrow(/4 × 1025 cells/)
  })

  it('refuses a 257th level', () => {
    let project = platformer()
    for (let i = 2; i <= 256; i++) project = withNewLevel(project, `l-${i}`, { x: i * 512, y: 0 })
    expect(project.levels).toHaveLength(256)
    expect(() => add(project, 'one-more')).toThrow(/256 levels/)
  })
})

describe('removeLevel', () => {
  it('removes the level and every placement of it, and closes a sequence', () => {
    const line = setWorldLayout(add(add(platformer(), 'b'), 'c', 1024), 'main', 'horizontal')
    const twice = withWorld(
      { ...line, worlds: [...line.worlds, { id: 'side', layout: 'free', placements: [] }] },
      'side',
      (w) => ({ ...w, placements: [{ level: 'b', x: 0, y: 0, depth: 0 }] }),
    )
    const after = removeLevel(twice, 'b')
    expect(after.levels.map((level) => level.id)).toEqual(['level-1', 'c'])
    expect(placementsOf(after).map((p) => [p.level, p.x])).toEqual([
      ['level-1', 0],
      ['c', 512],
    ])
    expect(placementsOf(after, 'side')).toEqual([])
  })

  it('leaves references into the removed level broken, for the Checks to report', () => {
    const before = hollowmere()
    expect(errors(before)).toEqual([])
    expect(errors(removeLevel(before, 'inn'))).toContain('brokenRef')
  })

  it('throws RangeError for an unknown level', () => {
    expect(() => removeLevel(platformer(), 'nope')).toThrow(/no level "nope"/)
  })
})

describe('duplicateLevel', () => {
  /** Hollowmere with a second door in the inn that leads to the inn's own door. */
  function withInnerDoor(): Project {
    const project = hollowmere()
    const innDoor = entitiesOf(levelOf(project, 'inn')).find((item) => item.def === 'door')
    return withEntities(project, 'inn', [
      entity('back-door', 'door', 32, 200, {
        target: { target: innDoor?.id ?? '', container: 'inn' },
        facing: 'up',
      }),
    ])
  }
  const ids = (): IdSource => counterIds(1000)

  it('copies the cells, fields and items with fresh ids, and places the copy to the right of the original', () => {
    const before = withInnerDoor()
    const after = duplicateLevel(before, 'inn', { id: 'inn-2', name: 'Inn 2' }, ids())
    const inn = levelOf(after, 'inn')
    const copy = levelOf(after, 'inn-2')
    expect(inn).toBe(levelOf(before, 'inn'))
    expect(copy).toMatchObject({
      id: 'inn-2',
      name: 'Inn 2',
      size: inn.size,
      background: inn.background,
      fields: inn.fields,
    })
    const cells = (level: Level) => level.layers.flatMap((layer) => ('cells' in layer ? [layer.cells] : []))
    expect(cells(copy)).toEqual(cells(inn))
    const original = entitiesOf(inn)
    const copied = entitiesOf(copy)
    expect(copied.map((item) => [item.def, item.x, item.y])).toEqual(
      original.map((item) => [item.def, item.x, item.y]),
    )
    for (const item of copied) expect(original.some((o) => o.id === item.id)).toBe(false)
    expect(new Set(copied.map((item) => item.id)).size).toBe(copied.length)
    const innPlacement = placementsOf(after).find((p) => p.level === 'inn')
    expect(placementsOf(after).find((p) => p.level === 'inn-2')).toEqual({
      ...innPlacement,
      level: 'inn-2',
      x: (innPlacement?.x ?? 0) + inn.size.w,
    })
    expect(errors(after)).toEqual([])
  })

  it("points the copy's references inside the level at the copies, and leaves the others alone", () => {
    const after = duplicateLevel(withInnerDoor(), 'inn', { id: 'inn-2', name: 'Inn 2' }, ids())
    const doors = entitiesOf(levelOf(after, 'inn-2')).filter((item) => item.def === 'door')
    const [front, back] = doors
    expect(back?.fields.target).toEqual({ target: front?.id, container: 'inn-2' })
    expect(front?.fields.target).toEqual(
      entitiesOf(levelOf(after, 'inn')).find((i) => i.def === 'door')?.fields.target,
    )
  })

  it('gives objects fresh ids too, skipping ids already in use', () => {
    const before = hollowmere()
    const used = entitiesOf(levelOf(before, 'village'))[0]?.id ?? ''
    // The first id the source offers is one the village already uses; the copy must not take it.
    const fresh = counterIds(5000)
    let offered = false
    const source: IdSource = {
      next: () => {
        if (offered) return fresh.next()
        offered = true
        return used
      },
    }
    const after = duplicateLevel(before, 'village', { id: 'village-2', name: 'Village 2' }, source)
    const objects = levelOf(after, 'village-2').layers.flatMap((layer) =>
      layer.kind === 'objects' ? layer.items : [],
    )
    expect(objects).toHaveLength(5)
    const all = after.levels.flatMap((level) =>
      level.layers.flatMap((layer): readonly { readonly id: string }[] =>
        layer.kind === 'entities' || layer.kind === 'objects' ? layer.items : [],
      ),
    )
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length)
  })

  it('never gives two copied items the same id, even when the source repeats one', () => {
    const fresh = counterIds(7000)
    let offered = 0
    const repeating: IdSource = { next: () => (offered++ < 2 ? 'same-id' : fresh.next()) }
    const after = duplicateLevel(hollowmere(), 'inn', { id: 'inn-2', name: 'Inn 2' }, repeating)
    const copied = entitiesOf(levelOf(after, 'inn-2')).map((item) => item.id)
    expect(new Set(copied).size).toBe(copied.length)
    expect(copied.filter((id) => id === 'same-id')).toHaveLength(1)
  })

  it("points a level field's ref into the original at the copy", () => {
    const base = withInnerDoor()
    const withField = {
      ...base,
      defs: {
        ...base.defs,
        levelFields: [...base.defs.levelFields, { id: 'entry', type: 'ref' as const, label: 'Entry' }],
      },
    }
    const project = setLevelField(withField, 'inn', 'entry', { target: 'back-door', container: 'inn' })
    const after = duplicateLevel(project, 'inn', { id: 'inn-2', name: 'Inn 2' }, ids())
    const copiedDoor = entitiesOf(levelOf(after, 'inn-2')).find((item) => item.x === 32 && item.y === 200)
    expect(levelOf(after, 'inn-2').fields.entry).toEqual({ target: copiedDoor?.id, container: 'inn-2' })
  })

  it('never lands on the original in a grid world, even when the level is narrower than half a grid step', () => {
    const grid = setWorldLayout(platformer(), 'main', 'grid', { w: 64, h: 64 })
    const small = addLevel(grid, {
      id: 'cell',
      name: 'Cell',
      world: 'main',
      x: 1024,
      y: 0,
      size: { w: 16, h: 16 },
    })
    const after = duplicateLevel(small, 'cell', { id: 'cell-2', name: 'Cell 2' }, ids())
    expect(placementsOf(after).find((p) => p.level === 'cell-2')).toMatchObject({ x: 1088, y: 0 })
  })

  it('goes right after the original in a sequence, at its depth', () => {
    const line = setWorldLayout(add(platformer(), 'b'), 'main', 'horizontal')
    const deep = withWorld(line, 'main', (w) => ({
      ...w,
      placements: w.placements.map((p) => (p.level === 'level-1' ? { ...p, depth: 2 } : p)),
    }))
    const after = duplicateLevel(deep, 'level-1', { id: 'copy', name: 'Copy' }, ids())
    expect(placementsOf(after).map((p) => [p.level, p.x, p.depth])).toEqual([
      ['level-1', 0, 2],
      ['copy', 512, 2],
      ['b', 1024, 0],
    ])
  })

  it('refuses a copy id that is taken or malformed, and an unknown level', () => {
    expect(() => duplicateLevel(platformer(), 'level-1', { id: 'level-1', name: 'x' }, ids())).toThrow(
      /already/,
    )
    expect(() => duplicateLevel(platformer(), 'level-1', { id: '9x', name: 'x' }, ids())).toThrow(RangeError)
    expect(() => duplicateLevel(platformer(), 'nope', { id: 'x', name: 'x' }, ids())).toThrow(
      /no level "nope"/,
    )
  })
})

describe('setLevelField', () => {
  it('stores a valid value and returns the same project for the value it has', () => {
    const after = setLevelField(platformer(), 'level-1', 'music', 'caves.ogg')
    expect(levelOf(after, 'level-1').fields).toEqual({ music: 'caves.ogg' })
    expect(setLevelField(after, 'level-1', 'music', 'caves.ogg')).toBe(after)
  })

  it("refuses a value the field rejects, with the kit's message, and an unknown field or level", () => {
    expect(() => setLevelField(platformer(), 'level-1', 'music', 3)).toThrow(/music/)
    expect(() => setLevelField(platformer(), 'level-1', 'weather', 'rain')).toThrow(
      /no level field "weather"/,
    )
    expect(() => setLevelField(platformer(), 'nope', 'music', 'a')).toThrow(/no level "nope"/)
  })
})

describe('renameLevel', () => {
  it('renames the level, trimmed, and leaves the others', () => {
    const project = withNewLevel(platformer(), 'level-2', { x: 512, y: 0 })
    const [first, second] = project.levels
    const renamed = renameLevel(project, first?.id ?? '', '  Moss steps  ')
    expect(levelOf(renamed, first?.id ?? '').name).toBe('Moss steps')
    expect(levelOf(renamed, second?.id ?? '')).toBe(second)
  })

  it('returns the same project for the same name', () => {
    const project = platformer()
    const level = project.levels[0]
    expect(renameLevel(project, level?.id ?? '', level?.name ?? '')).toBe(project)
  })

  it('refuses an empty name and a level that is not there', () => {
    const project = platformer()
    expect(() => renameLevel(project, project.levels[0]?.id ?? '', '   ')).toThrow(RangeError)
    expect(() => renameLevel(project, 'gone', 'Name')).toThrow(RangeError)
  })
})
