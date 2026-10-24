import { describe, expect, it } from 'vitest'
import { counterIds } from '../../../model/ids'
import type { AutoLayerDef, Project, TilesetDef } from '../../../model/project-types'
import { entity, withDefs, withEntities } from '../../../testing/project-edit'
import type { Rule } from '../../../tiles/autotile/rule.schema'
import type { Diagnostic, ProjectContext } from '../../profile'
import { checkProject } from '../project-checks'
import { platformerTemplate } from '../templates/platformer'

const valid = (): Project => platformerTemplate.create(counterIds())

/** The diagnostics of one code, so a test names the one thing it edits. */
const only = (project: Project, code: string, context: ProjectContext = {}): Diagnostic[] =>
  checkProject(project, context).filter((d) => d.code === code)

const ground = (project: Project): AutoLayerDef => {
  const found = project.defs.layers.find((layer) => layer.id === 'ground')
  if (found?.kind !== 'auto') throw new Error('no ground layer')
  return found
}

/** The project with `edit` applied to the ground layer's terrain rules. */
function withTerrainRules(project: Project, edit: (rules: readonly Rule[]) => readonly Rule[]): Project {
  return withDefs(project, (defs) => ({
    ...defs,
    layers: defs.layers.map((layer) =>
      layer.kind === 'auto' && layer.id === 'ground'
        ? {
            ...layer,
            groups: layer.groups.map((group) =>
              group.id === 'terrain' ? { ...group, rules: edit(group.rules) } : group,
            ),
          }
        : layer,
    ),
  }))
}

const withImage = (project: Project, image: string): Project =>
  withDefs(project, (defs) => ({
    ...defs,
    tilesets: defs.tilesets.map((set) => (set.id === 'terrain' ? { ...set, image } : set)),
  }))

describe('definition checks', () => {
  it('finds nothing wrong with a template', () => {
    const errors = checkProject(valid(), {}).filter((d) => d.severity !== 'info')
    expect(errors).toEqual([])
  })

  describe('missingTileset', () => {
    it('warns when a tileset names an image the workspace does not hold', () => {
      const project = withImage(valid(), 'art/terrain.png')
      expect(only(project, 'missingTileset', { assets: ['art/other.png'] })).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: 'defs.tilesets[terrain]',
          message: expect.stringContaining('art/terrain.png'),
        }),
      ])
    })

    it('is silent when the image is there, when the workspace list is unknown, and for a placeholder', () => {
      const project = withImage(valid(), 'art/terrain.png')
      expect(only(project, 'missingTileset', { assets: ['art/terrain.png'] })).toEqual([])
      expect(only(project, 'missingTileset')).toEqual([])
      expect(only(valid(), 'missingTileset', { assets: [] })).toEqual([])
    })
  })

  describe('tilesetImageChanged', () => {
    it('warns when the image is no longer the size that was recorded', () => {
      const project = withImage(valid(), 'art/terrain.png')
      const found = only(project, 'tilesetImageChanged', {
        imageSizes: { 'art/terrain.png': { w: 256, h: 128 } },
      })
      expect(found).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: 'defs.tilesets[terrain]',
          message: expect.stringMatching(/256 × 128.*128 × 128/),
        }),
      ])
    })

    it('is silent when the size matches or is not known', () => {
      const project = withImage(valid(), 'art/terrain.png')
      expect(
        only(project, 'tilesetImageChanged', { imageSizes: { 'art/terrain.png': { w: 128, h: 128 } } }),
      ).toEqual([])
      expect(only(project, 'tilesetImageChanged')).toEqual([])
    })
  })

  describe('fieldDefInvalid', () => {
    it('is an error for an entity field the kit refuses, addressed by entity and field', () => {
      const project = withDefs(valid(), (defs) => ({
        ...defs,
        entities: defs.entities.map((def) =>
          def.id === 'slime'
            ? {
                ...def,
                fields: def.fields.map((f) =>
                  f.id === 'hp' ? { ...f, min: 5, max: 2, default: undefined } : f,
                ),
              }
            : def,
        ),
      }))
      expect(only(project, 'fieldDefInvalid')).toEqual([
        expect.objectContaining({ severity: 'error', path: 'defs.entities[slime].fields[hp]' }),
      ])
    })

    it('covers the level fields too', () => {
      const project = withDefs(valid(), (defs) => ({
        ...defs,
        levelFields: [...defs.levelFields, { id: 'music', type: 'text' }],
      }))
      const found = only(project, 'fieldDefInvalid')
      expect(found.map((d) => d.path)).toEqual(['defs.levelFields[music]'])
    })
  })

  describe('rule diagnostics', () => {
    it('ruleTileOutOfRange is an error at the rule', () => {
      const project = withTerrainRules(valid(), (rules) =>
        rules.map((rule) => (rule.id === 'ground-alone' ? { ...rule, tiles: [99] } : rule)),
      )
      expect(only(project, 'ruleTileOutOfRange')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'defs.layers[ground].groups[terrain].rules[ground-alone]',
        }),
      ])
    })

    it('ruleValueUnknown warns about a value the source layer does not define', () => {
      const project = withTerrainRules(valid(), (rules) =>
        rules.map((rule) =>
          rule.id === 'ground-alone'
            ? { ...rule, pattern: rule.pattern.map((cell, i) => (i === 4 ? { is: 9 } : cell)) }
            : rule,
        ),
      )
      expect(only(project, 'ruleValueUnknown')).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: 'defs.layers[ground].groups[terrain].rules[ground-alone]',
        }),
      ])
    })

    it('ruleNeverMatches takes the engine severity: chance 0 is a warning', () => {
      const project = withTerrainRules(valid(), (rules) =>
        rules.map((rule) => (rule.id === 'ground-alone' ? { ...rule, chance: 0 } : rule)),
      )
      expect(only(project, 'ruleNeverMatches')).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: 'defs.layers[ground].groups[terrain].rules[ground-alone]',
        }),
      ])
    })

    it('ruleShadowed is info for a rule an earlier breaking rule always pre-empts', () => {
      const project = withTerrainRules(valid(), (rules) => {
        const first = rules[0] as Rule
        return [...rules, { ...first, id: 'again' }]
      })
      expect(only(project, 'ruleShadowed')).toEqual([
        expect.objectContaining({
          severity: 'info',
          path: 'defs.layers[ground].groups[terrain].rules[again]',
        }),
      ])
    })

    it('skips rules that are switched off', () => {
      const project = withTerrainRules(valid(), (rules) =>
        rules.map((rule) => (rule.id === 'ground-alone' ? { ...rule, tiles: [99], active: false } : rule)),
      )
      expect(only(project, 'ruleTileOutOfRange')).toEqual([])
    })

    it('reads the source layer, not the first layer, for the values a rule may name', () => {
      expect(ground(valid()).source).toBe('collision')
      expect(only(valid(), 'ruleValueUnknown')).toEqual([])
    })
  })

  describe('unusedDefinition', () => {
    it('is info for each entity definition no level uses', () => {
      const found = only(valid(), 'unusedDefinition')
      expect(found.map((d) => d.path)).toEqual([
        'defs.entities[slime]',
        'defs.entities[coin]',
        'defs.entities[door]',
        'defs.entities[checkpoint]',
        'defs.entities[moving-platform]',
      ])
      expect(found.every((d) => d.severity === 'info')).toBe(true)
    })

    it('stops once an instance exists', () => {
      const project = withEntities(valid(), 'level-1', [entity('coin-1', 'coin', 64, 64)])
      expect(only(project, 'unusedDefinition').map((d) => d.path)).not.toContain('defs.entities[coin]')
    })

    it('also names a tileset nothing draws from', () => {
      const project = withDefs(valid(), (defs) => ({
        ...defs,
        tilesets: [...defs.tilesets, { ...(defs.tilesets[0] as TilesetDef), id: 'extra' }],
      }))
      expect(only(project, 'unusedDefinition').map((d) => d.path)).toContain('defs.tilesets[extra]')
    })

    it('counts a tileset an entity definition draws with as used', () => {
      const project = withDefs(valid(), (defs) => ({
        ...defs,
        tilesets: [...defs.tilesets, { ...(defs.tilesets[0] as TilesetDef), id: 'extra' }],
        entities: defs.entities.map((def) =>
          def.id === 'coin' ? { ...def, tile: { tileset: 'extra', index: 3 } } : def,
        ),
      }))
      expect(only(project, 'unusedDefinition').map((d) => d.path)).not.toContain('defs.tilesets[extra]')
    })
  })
})
