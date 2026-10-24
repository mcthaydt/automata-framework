// The `af-sector/1` schema (ED3D spec §4.6, the exact shape in the ED3D.1b plan): a pure validator over the sector
// vocabulary Last Light proved, without its camera zones, nav graph, openings or exports. It adds no defaults, changes
// nothing, and keeps a member it does not know.
import { describe, expect, it } from 'vitest'
import { AF_SECTOR_FORMAT, afFormatVersion, afSectorSchema } from './af-sector.schema'
import { OCCLUDES } from './sector.schema'

// biome-ignore lint/suspicious/noExplicitAny: tests edit a level by path
type Json = Record<string, any>

const room = (id: string, x0 = 0): Json => ({
  id,
  floor: 0,
  ceiling: 4,
  light: 1,
  corners: [
    [x0, 0],
    [x0 + 4, 0],
    [x0 + 4, 4],
    [x0, 4],
  ],
})
const level = (): Json => ({ format: 'af-sector/1', name: 'toy', sectors: [room('hall')] })

/** The paths Zod reports for a value it refuses, or undefined when it accepts it. */
const refusedAt = (value: unknown): PropertyKey[][] | undefined => {
  const result = afSectorSchema.safeParse(value)
  return result.success ? undefined : result.error.issues.map((issue) => issue.path)
}

describe('the af-sector schema', () => {
  it('parses a minimal level, and the parse is the file’s own value (a validator, not a transform)', () => {
    const json = level()
    const result = afSectorSchema.safeParse(json)
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
    expect(result.data).toStrictEqual(json)
    expect(AF_SECTOR_FORMAT).toBe('af-sector/1')
  })

  it('parses a full level: styles, materials, walls with portals, doors, windows and trim, holes, entities', () => {
    const json = level()
    json.materials = {
      brick: { category: 'walls' },
      tile: { category: 'floors', label: 'Tile', wallOnly: false },
    }
    json.styles = {
      plain: { wallTexture: 'brick', floorTexture: 'tile', trim: { skirting: 0.1, cap: true } },
    }
    json.sectors = [
      {
        ...room('hall'),
        style: 'plain',
        open: true,
        trim: { rail: 0.08 },
        corners: [
          [
            0,
            0,
            {
              door: { at: 1, width: 1, height: 2.1, id: 'front' },
              window: { at: 3, width: 1, y0: 1, y1: 2 },
            },
          ],
          [4, 0, { next: 'dock', frame: true, mask: 'glass', block: true, pan: [1, 2], thick: 0.2 }],
          [
            4,
            4,
            { pilaster: { start: [0.3, 0.2] }, trimTexture: { skirting: 'oak' }, trimDepth: { rail: 0.02 } },
          ],
          [0, 4],
        ],
        holes: [
          [
            [1, 1],
            [2, 1],
            [2, 2],
          ],
        ],
      },
      room('dock', 4),
    ]
    json.entityDefs = [{ id: 'spawn', shape: 'point', single: true, fields: [] }]
    json.entities = [{ def: 'spawn', id: 'spawn', x: 1, z: 1, y: 0.5, facing: 0 }]
    const result = afSectorSchema.safeParse(json)
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
    expect(result.data).toStrictEqual(json)
  })

  it('keeps a member it does not know, at every level', () => {
    const json = level()
    json.lighting = { bounce: 0.2 }
    json.materials = { brick: { category: 'walls', hue: 3 } }
    json.styles = { plain: { wallTexture: 'brick', mood: 'dim' } }
    json.sectors[0].tags = ['indoors']
    json.sectors[0].corners[0] = [
      0,
      0,
      { next: 'dock', hideFrom: 5, cut: 7, custom: 1, pilaster: { start: [1, 1], style: 'square' } },
    ]
    json.entityDefs = [{ id: 'crate', shape: 'box', size: [1, 1, 1], fields: [{ id: 'loot', type: 'ref' }] }]
    json.entities = [{ def: 'crate', id: 'crate1', x: 3, z: 2, loot: 'key', note: 'near the door' }]
    const result = afSectorSchema.parse(json)
    expect(result).toStrictEqual(json)
  })

  describe('wall occlusion and the sector view id (ED3D.4b)', () => {
    it('names the three occlusions the camera rule knows', () => {
      expect(OCCLUDES).toEqual(['cut', 'fade', 'never'])
    })

    it.each(OCCLUDES)('keeps a wall that says occlude %s, and a sector with a view', (occlude) => {
      const json = level()
      json.sectors[0].view = 'hall-view'
      json.sectors[0].corners[0] = [0, 0, { occlude }]
      const result = afSectorSchema.safeParse(json)
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
      expect(result.data).toStrictEqual(json)
    })

    it.each([5, 'hide', true, ['cut'], null])(
      'refuses a wall whose occlude is %j, at the member',
      (value) => {
        const json = level()
        json.sectors[0].corners[0] = [0, 0, { occlude: value }]
        expect(refusedAt(json)).toContainEqual(['sectors', 0, 'corners', 0, 2, 'occlude'])
      },
    )

    it.each([5, true, ['a'], null])('refuses a sector whose view is %j, at the member', (value) => {
      const json = level()
      json.sectors[0].view = value
      expect(refusedAt(json)).toContainEqual(['sectors', 0, 'view'])
    })
  })

  describe('the format member', () => {
    it.each(['af-sector/1', 'af-sector/1.0', 'af-sector/1.2', 'af-sector/1.10'])('opens %s', (format) => {
      expect(refusedAt({ ...level(), format })).toBeUndefined()
    })

    it.each([
      'af-sector/2',
      'af-sector/2.0',
      'af-sector/0',
      'af-sector/10',
      'af-sector/01',
      'af-sector/1.',
      'af-sector/1.x',
      'af-sector/1.01',
      'af-sector/1.2.3',
      'af-sector/',
      'af-sector',
      'last-light/1',
      'AF-SECTOR/1',
      ' af-sector/1',
      '',
    ])('refuses %j, at the format member', (format) => {
      expect(refusedAt({ ...level(), format })).toEqual([['format']])
    })

    it('refuses a level with no format, or one that is not a string, at the format member', () => {
      const { format: _format, ...without } = level()
      expect(refusedAt(without)).toEqual([['format']])
      expect(refusedAt({ ...level(), format: 1 })).toEqual([['format']])
    })

    it('says, for a version it does not read, what it reads', () => {
      const result = afSectorSchema.safeParse({ ...level(), format: 'af-sector/2' })
      expect(result.error?.issues[0]?.message).toBe(
        'af-sector/2 is not a version this editor reads (af-sector/1)',
      )
      const malformed = afSectorSchema.safeParse({ ...level(), format: 'nope' })
      expect(malformed.error?.issues[0]?.message).toBe(
        'nope is not af-sector/<major> or af-sector/<major>.<minor>',
      )
    })

    it('reads a version as a major and a minor, and not a malformed one', () => {
      expect(afFormatVersion('af-sector/1')).toEqual({ major: 1, minor: 0 })
      expect(afFormatVersion('af-sector/1.2')).toEqual({ major: 1, minor: 2 })
      expect(afFormatVersion('af-sector/12.34')).toEqual({ major: 12, minor: 34 })
      expect(afFormatVersion('af-sector/x')).toBeUndefined()
      expect(afFormatVersion('af-sector/01')).toBeUndefined()
      expect(afFormatVersion('xaf-sector/1')).toBeUndefined()
      expect(afFormatVersion('af-sector/1 ')).toBeUndefined()
    })
  })

  describe('refusals, each at the member that is wrong', () => {
    const refusals: [string, (json: Json) => void, (string | number)[]][] = [
      ['a level with no name', (json) => delete json.name, ['name']],
      ['a level with no sectors member', (json) => delete json.sectors, ['sectors']],
      ['a sector with no id', (json) => delete json.sectors[0].id, ['sectors', 0, 'id']],
      ['a sector with no floor', (json) => delete json.sectors[0].floor, ['sectors', 0, 'floor']],
      ['a sector with no ceiling', (json) => delete json.sectors[0].ceiling, ['sectors', 0, 'ceiling']],
      ['a sector with no light', (json) => delete json.sectors[0].light, ['sectors', 0, 'light']],
      ['a sector with no corners', (json) => delete json.sectors[0].corners, ['sectors', 0, 'corners']],
      ['a floor that is a string', (json) => (json.sectors[0].floor = '0'), ['sectors', 0, 'floor']],
      [
        'a sector of two corners',
        (json) =>
          (json.sectors[0].corners = [
            [0, 0],
            [1, 0],
          ]),
        ['sectors', 0, 'corners'],
      ],
      ['a corner of one number', (json) => (json.sectors[0].corners[1] = [1]), ['sectors', 0, 'corners', 1]],
      [
        'a corner whose wall is a string (there are no presets)',
        (json) => (json.sectors[0].corners[1] = [4, 0, 'GLASS']),
        ['sectors', 0, 'corners', 1, 2],
      ],
      [
        'a corner of four members',
        (json) => (json.sectors[0].corners[1] = [4, 0, {}, 1]),
        ['sectors', 0, 'corners', 1],
      ],
      [
        'a hole of two corners',
        (json) =>
          (json.sectors[0].holes = [
            [
              [1, 1],
              [2, 1],
            ],
          ]),
        ['sectors', 0, 'holes', 0],
      ],
      [
        'a door with no width',
        (json) => (json.sectors[0].corners[0] = [0, 0, { door: { at: 1, height: 2 } }]),
        ['sectors', 0, 'corners', 0, 2, 'door', 'width'],
      ],
      [
        'a wall mask that is neither glass nor bars',
        (json) => (json.sectors[0].corners[0] = [0, 0, { mask: 'mist' }]),
        ['sectors', 0, 'corners', 0, 2, 'mask'],
      ],
      [
        'a pan of three numbers',
        (json) => (json.sectors[0].corners[0] = [0, 0, { pan: [1, 2, 3] }]),
        ['sectors', 0, 'corners', 0, 2, 'pan'],
      ],
      [
        'a style texture that is a number',
        (json) => (json.styles = { s: { wallTexture: 1 } }),
        ['styles', 's', 'wallTexture'],
      ],
      [
        'a material with no category',
        (json) => (json.materials = { brick: {} }),
        ['materials', 'brick', 'category'],
      ],
      [
        'an entity with no def',
        (json) => (json.entities = [{ id: 'a', x: 0, z: 0 }]),
        ['entities', 0, 'def'],
      ],
      ['an entity with no id', (json) => (json.entities = [{ def: 'a', x: 0, z: 0 }]), ['entities', 0, 'id']],
      [
        'an entity with no z',
        (json) => (json.entities = [{ def: 'a', id: 'a', x: 0 }]),
        ['entities', 0, 'z'],
      ],
      [
        'an entity with no x',
        (json) => (json.entities = [{ def: 'a', id: 'a', z: 0 }]),
        ['entities', 0, 'x'],
      ],
      [
        'an entity with a string z',
        (json) => (json.entities = [{ def: 'a', id: 'a', x: 0, z: '0' }]),
        ['entities', 0, 'z'],
      ],
      [
        'an entity definition with no id',
        (json) => (json.entityDefs = [{ shape: 'point' }]),
        ['entityDefs', 0, 'id'],
      ],
    ]
    for (const [what, edit, path] of refusals) {
      it(`refuses ${what}`, () => {
        const json = level()
        edit(json)
        expect(refusedAt(json), what).toContainEqual(path)
      })
    }

    it.each([
      ['next', 5],
      ['texture', 5],
      ['trimTexture', { skirting: 5 }],
      ['trimDepth', { rail: 'deep' }],
      ['pan', ['a', 2]],
      ['trim', { cap: 'yes' }],
      ['frame', 'yes'],
      ['block', 'yes'],
      ['maskTop', 'high'],
      ['hatch', [1]],
      ['handrail', 'low'],
      ['window', { at: 1, width: 1, y0: 1 }],
      ['door', { at: 1, width: 1, height: 'tall' }],
      ['pilaster', { start: [1] }],
      ['thick', 'wide'],
    ])('refuses a wall whose %s is %j', (member, value) => {
      const json = level()
      json.sectors[0].corners[0] = [0, 0, { [member]: value }]
      const paths = refusedAt(json)
      expect(paths?.some((path) => path.slice(0, 6).join('/') === `sectors/0/corners/0/2/${member}`)).toBe(
        true,
      )
    })

    it('refuses an entity whose y is not a number', () => {
      const json = level()
      json.entities = [{ def: 'a', id: 'a', x: 0, z: 0, y: 'up' }]
      expect(refusedAt(json)).toContainEqual(['entities', 0, 'y'])
    })

    it('refuses a bad hole in a sector, and a bad wall in a hole, at the hole’s corner', () => {
      const json = level()
      json.sectors[0].holes = [
        [
          [1, 1],
          [2, 1],
          [2, 2, { next: 3 }],
        ],
      ]
      expect(refusedAt(json)).toContainEqual(['sectors', 0, 'holes', 0, 2, 2, 'next'])
    })
  })
})
