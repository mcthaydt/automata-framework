import { describe, expect, it } from 'vitest'
import { entity, withDefs, withEntities, withLayer } from '../../../../testing/level-2d/project-edit'
import { packTile } from '../../model/cells-codec'
import { counterIds } from '../../model/ids'
import type { EntityInstance, Project } from '../../model/project-types'
import type { Diagnostic } from '../profile'
import { levelProject } from './level-project'
import { checkProject } from './project-checks'
import { applyProjectFix, chooseTarget, refChoices } from './project-fixes'
import { platformerTemplate } from './templates/platformer'
import { topdownRpgTemplate } from './templates/topdown-rpg'

const platformer = (): Project => platformerTemplate.create(counterIds())
const found = (project: Project, code: string): Diagnostic => {
  const finding = checkProject(project, {}).find((each) => each.code === code)
  if (finding === undefined) throw new Error(`no ${code}`)
  return finding
}
const codes = (project: Project): string[] => checkProject(project, {}).map((each) => each.code)
const items = (project: Project, level: string): readonly EntityInstance[] => {
  const layer = project.levels
    .find((each) => each.id === level)
    ?.layers.find((each) => each.def === 'entities')
  return layer?.kind === 'entities' ? layer.items : []
}

describe('the level-project repairs', () => {
  it('remove clears exactly the stray tiles of a tiles layer', () => {
    const project = withLayer(platformer(), 'level-1', 'decor', (layer) =>
      layer.kind === 'tiles'
        ? {
            ...layer,
            cells: layer.cells
              .set(4, 7, packTile(99, false, false))
              .set(5, 7, packTile(64, true, false))
              .set(6, 7, packTile(2, false, false)),
          }
        : layer,
    )
    const fixed = applyProjectFix(project, found(project, 'tileOutOfRange'))
    expect(codes(fixed)).not.toContain('tileOutOfRange')
    const decor = fixed.levels[0]?.layers.find((each) => each.def === 'decor')
    expect(decor?.kind === 'tiles' ? decor.cells.nonEmpty() : []).toEqual([
      { x: 6, y: 7, value: packTile(2, false, false) },
    ])
  })

  it('remove clears the stray manual tiles of an auto layer', () => {
    const project = withLayer(platformer(), 'level-1', 'ground', (layer) =>
      layer.kind === 'auto'
        ? { ...layer, overrides: layer.overrides.set(1, 1, packTile(500, false, false)) }
        : layer,
    )
    const fixed = applyProjectFix(project, found(project, 'tileOutOfRange'))
    const ground = fixed.levels[0]?.layers.find((each) => each.def === 'ground')
    expect(ground?.kind === 'auto' ? ground.overrides.get(1, 1) : -1).toBe(0)
  })

  it('remove drops the objects whose tile is beyond the tileset, and keeps the rest', () => {
    const rpg = topdownRpgTemplate.create(counterIds())
    const project = withLayer(rpg, 'map-1', 'props', (layer) =>
      layer.kind === 'objects'
        ? {
            ...layer,
            items: [
              { id: 'tree-1', tile: 400, x: 8, y: 8, flipX: false, flipY: false },
              { id: 'tree-2', tile: 1, x: 16, y: 8, flipX: false, flipY: false },
            ],
          }
        : layer,
    )
    const fixed = applyProjectFix(project, found(project, 'tileOutOfRange'))
    const props = fixed.levels[0]?.layers.find((each) => each.def === 'props')
    expect(props?.kind === 'objects' ? props.items.map((item) => item.id) : []).toEqual(['tree-2'])
  })

  it('remove clears the IntGrid cells holding a value the layer does not define', () => {
    const project = withLayer(platformer(), 'level-1', 'collision', (layer) =>
      layer.kind === 'intgrid' ? { ...layer, cells: layer.cells.set(2, 2, 42) } : layer,
    )
    const fixed = applyProjectFix(project, found(project, 'cellValueUnknown'))
    expect(codes(fixed)).not.toContain('cellValueUnknown')
  })

  it('move-inside clamps the anchor into the level', () => {
    const project = withEntities(platformer(), 'level-1', [entity('coin-1', 'coin', 9000, -3)])
    const fixed = applyProjectFix(project, found(project, 'entityOutOfBounds'))
    const level = fixed.levels[0]
    expect(items(fixed, 'level-1').find((item) => item.id === 'coin-1')).toMatchObject({
      x: level?.size.w,
      y: 0,
    })
    expect(codes(fixed)).not.toContain('entityOutOfBounds')
  })

  it('move-inside clamps an object too', () => {
    const rpg = topdownRpgTemplate.create(counterIds())
    const project = withLayer(rpg, 'map-1', 'props', (layer) =>
      layer.kind === 'objects'
        ? { ...layer, items: [{ id: 'tree-1', tile: 1, x: -20, y: 8, flipX: false, flipY: false }] }
        : layer,
    )
    const fixed = applyProjectFix(project, found(project, 'entityOutOfBounds'))
    const props = fixed.levels[0]?.layers.find((each) => each.def === 'props')
    expect(props?.kind === 'objects' ? props.items[0]?.x : -1).toBe(0)
  })

  it('delete removes an instance whose definition is gone', () => {
    const project = withEntities(platformer(), 'level-1', [entity('ghost-1', 'ghost', 10, 10)])
    const finding = found(project, 'unknownEntityDef')
    expect(finding.fix).toBe('delete')
    const fixed = applyProjectFix(project, finding)
    expect(items(fixed, 'level-1').map((item) => item.id)).not.toContain('ghost-1')
  })

  it('refuses a finding with no repair, an unknown or input-taking repair, or a target that is gone', () => {
    const project = withEntities(platformer(), 'level-1', [entity('coin-1', 'coin', 9000, 4)])
    const out = found(project, 'entityOutOfBounds')
    expect(() => applyProjectFix(project, { ...out, fix: undefined })).toThrow(RangeError)
    expect(() => applyProjectFix(project, { ...out, fix: 'polish' })).toThrow(RangeError)
    expect(() => applyProjectFix(project, { ...out, fix: 'choose-target' })).toThrow(RangeError)
    expect(() =>
      applyProjectFix(project, { ...out, path: 'levels[level-1].layers[entities].items[gone]' }),
    ).toThrow(RangeError)
  })

  it('is the profile’s fix', () => {
    const project = withEntities(platformer(), 'level-1', [entity('coin-1', 'coin', 9000, 4)])
    const fixed = levelProject.fix?.(project, found(project, 'entityOutOfBounds'), {})
    expect(codes(fixed as Project)).not.toContain('entityOutOfBounds')
  })
})

describe('choosing a ref target', () => {
  /** Level 1 with a checkpoint and a door whose target was deleted. */
  const brokenDoor = (): Project =>
    withEntities(platformer(), 'level-1', [
      entity('check-1', 'checkpoint', 40, 40),
      entity('door-1', 'door', 80, 40, { target: { target: 'gone-1' } }),
    ])

  it('lists the instances the field may point at, with their level', () => {
    const project = brokenDoor()
    const finding = found(project, 'brokenRef')
    expect(finding.fix).toBe('choose-target')
    const choices = refChoices(project, finding)
    expect(choices.map((choice) => choice.label)).toEqual([
      'check-1 · checkpoint in level-1',
      '00000001 · player-start in level-1',
    ])
    expect(choices[0]?.value).toEqual({ target: 'check-1', container: 'level-1' })
  })

  it('sets the chosen target as the field value, which clears the finding', () => {
    const project = brokenDoor()
    const finding = found(project, 'brokenRef')
    const [first] = refChoices(project, finding)
    if (first === undefined) throw new Error('no choice')
    const fixed = chooseTarget(project, finding, first.value)
    expect(items(fixed, 'level-1').find((item) => item.id === 'door-1')?.fields.target).toEqual(first.value)
    expect(codes(fixed)).not.toContain('brokenRef')
  })

  it('offers the levels for a field that points at $level', () => {
    const project = withDefs(platformer(), (defs) => ({
      ...defs,
      entities: defs.entities.map((def) =>
        def.id === 'door' ? { ...def, fields: [{ id: 'target', type: 'ref', to: ['$level'] }] } : def,
      ),
    }))
    const broken = withEntities(project, 'level-1', [
      entity('door-1', 'door', 8, 8, { target: { target: 'nowhere' } }),
    ])
    expect(refChoices(broken, found(broken, 'brokenRef')).map((choice) => choice.value)).toEqual([
      { target: 'level-1' },
    ])
  })

  it('refuses a finding that is not about a ref', () => {
    const project = withEntities(platformer(), 'level-1', [entity('coin-1', 'coin', 9000, 4)])
    expect(() => refChoices(project, found(project, 'entityOutOfBounds'))).toThrow(RangeError)
  })
})
