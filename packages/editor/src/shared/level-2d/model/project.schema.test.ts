import { describe, expect, it } from 'vitest'
import { edited as editedFile, type Path } from '../../../testing/level-2d/edit-file'
import { minimalProjectFile, richProjectFile } from '../../../testing/level-2d/projects'
import { projectFileSchema } from './project.schema'

/** A damaged copy of the rich fixture (or of `file`). */
function edited(
  parent: Path,
  key: string | number,
  value: unknown,
  file: unknown = richProjectFile(),
): unknown {
  return editedFile(parent, key, value, file)
}

function issuesOf(file: unknown) {
  const result = projectFileSchema.safeParse(file)
  return result.success ? [] : result.error.issues
}

describe('projectFileSchema', () => {
  it('parses the smallest file', () => {
    const result = projectFileSchema.safeParse(minimalProjectFile())
    expect(result.success).toBe(true)
  })

  it('parses a file that uses every shape of spec §5 and returns it unchanged', () => {
    const result = projectFileSchema.safeParse(richProjectFile())
    expect(result.success).toBe(true)
    expect(result.data).toEqual(richProjectFile())
  })

  it('returns keys in schema order, whatever order the file had', () => {
    const shuffled = Object.fromEntries(Object.entries(minimalProjectFile()).reverse())
    const result = projectFileSchema.safeParse(shuffled)
    expect(Object.keys(result.data ?? {})).toEqual([
      'format',
      'version',
      'name',
      'template',
      'defs',
      'worlds',
      'levels',
    ])
  })

  describe('strictness: an unknown key at any depth is an issue at its parent', () => {
    const depths: [string, Path][] = [
      ['the project', []],
      ['definitions', ['defs']],
      ['a layer definition', ['defs', 'layers', 0]],
      ['an IntGrid value', ['defs', 'layers', 4, 'values', 0]],
      ['a rule group', ['defs', 'layers', 2, 'groups', 0]],
      ['a rule', ['defs', 'layers', 2, 'groups', 0, 'rules', 0]],
      ['a tileset', ['defs', 'tilesets', 0]],
      ['a tileset size', ['defs', 'tilesets', 0, 'imageSize']],
      ['a tileset tag', ['defs', 'tilesets', 0, 'tags', 0]],
      ['an entity definition', ['defs', 'entities', 0]],
      ['an entity minimum', ['defs', 'entities', 1, 'min']],
      ['an entity tile', ['defs', 'entities', 0, 'tile']],
      ['a field definition', ['defs', 'entities', 0, 'fields', 0]],
      ['a world', ['worlds', 0]],
      ['a placement', ['worlds', 0, 'placements', 0]],
      ['a level', ['levels', 0]],
      ['a level size', ['levels', 0, 'size']],
      ['a level background', ['levels', 0, 'background']],
      ['an entities layer instance', ['levels', 0, 'layers', 0]],
      ['an entity instance', ['levels', 0, 'layers', 0, 'items', 0]],
      ['an object instance', ['levels', 1, 'layers', 1, 'items', 0]],
      ['a tiles layer instance', ['levels', 0, 'layers', 3]],
    ]
    it.each(depths)('%s', (_label, parent) => {
      const issues = issuesOf(edited(parent, 'extra', 1))
      expect(issues).toHaveLength(1)
      expect(issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['extra'], path: [...parent] })
    })
  })

  describe('guard rails (ED2D-D13)', () => {
    const accepts = (file: unknown): boolean => projectFileSchema.safeParse(file).success

    it('keeps a layer grid cell between 4 and 256 px', () => {
      expect(accepts(edited(['defs', 'layers', 3], 'grid', 4))).toBe(true)
      expect(accepts(edited(['defs', 'layers', 3], 'grid', 256))).toBe(true)
      expect(accepts(edited(['defs', 'layers', 3], 'grid', 3))).toBe(false)
      expect(accepts(edited(['defs', 'layers', 3], 'grid', 257))).toBe(false)
      expect(accepts(edited(['defs', 'layers', 3], 'grid', 16.5))).toBe(false)
    })

    it('keeps a level side between 1 and 16384 px', () => {
      expect(accepts(edited(['levels', 0, 'size'], 'w', 16384))).toBe(true)
      expect(accepts(edited(['levels', 0, 'size'], 'w', 16385))).toBe(false)
      expect(accepts(edited(['levels', 0, 'size'], 'h', 0))).toBe(false)
    })

    it('allows at most 256 levels', () => {
      const level = (index: number) => ({ ...richProjectFile().levels[0], id: `level-${index}` })
      const withLevels = (count: number) =>
        edited(
          [],
          'levels',
          Array.from({ length: count }, (_, index) => level(index)),
        )
      // The levels' layers are not checked against the definitions here; the schema only counts.
      expect(issuesOf(withLevels(256)).map((issue) => issue.message)).toEqual([])
      expect(issuesOf(withLevels(257)).map((issue) => issue.path)).toEqual([['levels']])
    })

    it('allows at most 64 layer definitions', () => {
      const layer = (index: number) => ({
        id: `layer-${index}`,
        label: 'L',
        kind: 'entities',
        grid: 16,
        snap: true,
      })
      const withLayers = (count: number) =>
        edited(
          ['defs'],
          'layers',
          Array.from({ length: count }, (_, index) => layer(index)),
        )
      expect(issuesOf(withLayers(64)).map((issue) => issue.path)).toEqual([])
      expect(issuesOf(withLayers(65)).map((issue) => issue.path)).toEqual([['defs', 'layers']])
    })
  })

  describe('the header', () => {
    it('refuses another format', () => {
      expect(issuesOf(edited([], 'format', 'ldtk'))).toMatchObject([{ path: ['format'] }])
    })

    it('refuses a version this schema does not describe (the codec decides what to do with it first)', () => {
      expect(issuesOf(edited([], 'version', 2))).toMatchObject([{ path: ['version'] }])
    })

    it('needs at least one world', () => {
      expect(issuesOf(edited([], 'worlds', []))).toMatchObject([{ path: ['worlds'] }])
    })
  })

  describe('layers', () => {
    it('refuses a layer kind it does not know, in a definition and in an instance', () => {
      expect(issuesOf(edited(['defs', 'layers', 0], 'kind', 'parallax'))).toMatchObject([
        { code: 'invalid_union', path: ['defs', 'layers', 0, 'kind'] },
      ])
      expect(issuesOf(edited(['levels', 0, 'layers', 0], 'kind', 'parallax'))).toMatchObject([
        { code: 'invalid_union', path: ['levels', 0, 'layers', 0, 'kind'] },
      ])
    })

    it('refuses a layer opacity outside 0 to 1', () => {
      expect(issuesOf(edited(['defs', 'layers', 3], 'opacity', 1.5))).toMatchObject([
        { path: ['defs', 'layers', 3, 'opacity'] },
      ])
    })

    it('keeps an IntGrid value between 1 and 255 and its colour a #rrggbb', () => {
      const values = ['defs', 'layers', 4, 'values', 0]
      expect(issuesOf(edited(values, 'value', 0))).toMatchObject([{ path: [...values, 'value'] }])
      expect(issuesOf(edited(values, 'value', 256))).toMatchObject([{ path: [...values, 'value'] }])
      expect(issuesOf(edited(values, 'color', 'red'))).toMatchObject([{ path: [...values, 'color'] }])
    })

    it('refuses a rule whose pattern is not size × size', () => {
      const rule = ['defs', 'layers', 2, 'groups', 0, 'rules', 0]
      expect(issuesOf(edited(rule, 'pattern', ['any', 'any']))).toMatchObject([
        { code: 'custom', path: [...rule, 'pattern'] },
      ])
    })

    it('refuses a rule with an even size or a pattern cell it does not know', () => {
      const rule = ['defs', 'layers', 2, 'groups', 0, 'rules', 0]
      expect(issuesOf(edited(rule, 'size', 2)).length).toBeGreaterThan(0)
      expect(issuesOf(edited([...rule, 'pattern'], 0, 'solid')).length).toBeGreaterThan(0)
    })
  })

  describe('tilesets', () => {
    it('is a placeholder when it has no image, and keeps an image path when it has one', () => {
      const tileset = ['defs', 'tilesets', 0]
      expect(projectFileSchema.safeParse(edited(tileset, 'image', 'art/terrain.png')).success).toBe(true)
      expect(issuesOf(edited(tileset, 'image', ''))).toMatchObject([{ path: [...tileset, 'image'] }])
    })

    it('needs a positive image size and tile size, and non-negative spacing and padding', () => {
      const tileset = ['defs', 'tilesets', 0]
      expect(issuesOf(edited([...tileset, 'imageSize'], 'w', 0))).toMatchObject([
        { path: [...tileset, 'imageSize', 'w'] },
      ])
      expect(issuesOf(edited([...tileset, 'tile'], 'h', 0))).toMatchObject([
        { path: [...tileset, 'tile', 'h'] },
      ])
      expect(issuesOf(edited(tileset, 'spacing', -1))).toMatchObject([{ path: [...tileset, 'spacing'] }])
      expect(issuesOf(edited(tileset, 'padding', 0.5))).toMatchObject([{ path: [...tileset, 'padding'] }])
    })

    it('refuses a negative tile index in a tag', () => {
      const tag = ['defs', 'tilesets', 0, 'tags', 0]
      expect(issuesOf(edited(tag, 'tiles', [1, -2]))).toMatchObject([{ path: [...tag, 'tiles', 1] }])
    })
  })

  describe('entity definitions', () => {
    it('runs the kit rules: an id that is not an entity id', () => {
      const entity = ['defs', 'entities', 0]
      expect(issuesOf(edited(entity, 'id', 'Door'))).toMatchObject([{ code: 'custom', path: entity }])
    })

    it('runs the kit rules: a repeated field id, reported at the later field', () => {
      const fields = ['defs', 'entities', 2]
      const duplicated = edited(fields, 'fields', [
        { id: 'hp', type: 'int' },
        { id: 'hp', type: 'int' },
      ])
      expect(issuesOf(duplicated)).toMatchObject([{ code: 'custom', path: [...fields, 'fields', 1] }])
    })

    it("runs the kit rules: a field definition's own problem, reported at that field", () => {
      // `min` means nothing to a point field.
      const field = ['defs', 'entities', 2, 'fields', 1]
      expect(issuesOf(edited(field, 'min', 20))).toMatchObject([{ code: 'custom', path: field }])
    })

    it('keeps the pivot inside the shape and a minimum a positive count', () => {
      const entity = ['defs', 'entities', 1]
      expect(issuesOf(edited([...entity, 'pivot'], 'x', 1.5))).toMatchObject([
        { path: [...entity, 'pivot', 'x'] },
      ])
      expect(issuesOf(edited([...entity, 'min'], 'count', 0))).toMatchObject([
        { path: [...entity, 'min', 'count'] },
      ])
    })

    it('refuses a shape, resizable mode or minimum scope it does not know', () => {
      const entity = ['defs', 'entities', 1]
      expect(issuesOf(edited(entity, 'shape', 'polygon'))).toMatchObject([{ path: [...entity, 'shape'] }])
      expect(issuesOf(edited(entity, 'resizable', 'z'))).toMatchObject([{ path: [...entity, 'resizable'] }])
      expect(issuesOf(edited([...entity, 'min'], 'per', 'world'))).toMatchObject([
        { path: [...entity, 'min', 'per'] },
      ])
    })
  })

  describe('worlds and levels', () => {
    it('needs a snap grid exactly when the layout is grid', () => {
      const world = ['worlds', 0]
      expect(projectFileSchema.safeParse(edited(world, 'layout', 'horizontal')).success).toBe(true)
      expect(issuesOf(edited(world, 'layout', 'grid'))).toMatchObject([{ path: [...world, 'grid'] }])
      const snapped = edited(world, 'grid', { w: 64, h: 64 })
      expect(issuesOf(snapped)).toMatchObject([{ path: [...world, 'grid'] }])
      expect(projectFileSchema.safeParse(edited(world, 'layout', 'grid', snapped)).success).toBe(true)
    })

    it('refuses a level id that is not kebab-case and a background mode it does not know', () => {
      expect(issuesOf(edited(['levels', 0], 'id', 'Cellar'))).toMatchObject([{ path: ['levels', 0, 'id'] }])
      expect(issuesOf(edited(['levels', 0, 'background'], 'mode', 'stretch'))).toMatchObject([
        { path: ['levels', 0, 'background', 'mode'] },
      ])
    })

    it('refuses a field value that is not a field value shape', () => {
      expect(issuesOf(edited(['levels', 1, 'fields'], 'music', { x: 1, y: 'two' })).length).toBeGreaterThan(0)
    })

    it('refuses a layer instance of the wrong shape for its kind', () => {
      const layer = ['levels', 1, 'layers', 4]
      expect(issuesOf(edited(layer, 'rows', 'not rows'))).toMatchObject([{ path: [...layer, 'rows'] }])
      expect(issuesOf(edited(layer, 'rows', undefined)).length).toBeGreaterThan(0)
    })
  })
})
