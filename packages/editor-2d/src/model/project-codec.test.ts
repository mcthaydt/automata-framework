import { describe, expect, it } from 'vitest'
import { edited as editedFile, type Path } from '../testing/edit-file'
import { minimalProjectFile, richProjectFile } from '../testing/projects'
import { packTile } from './cells-codec'
import { projectFileSchema } from './project.schema'
import { decodeProject, encodeProject, type OpenIssue, printProject } from './project-codec'
import type { Project, ProjectFile } from './project-types'

/** A damaged copy of the rich fixture (or of `file`). */
function edited(
  parent: Path,
  key: string | number,
  value: unknown,
  file: unknown = richProjectFile(),
): ProjectFile {
  return editedFile(parent, key, value, file) as ProjectFile
}

function decoded(file: ProjectFile): Project {
  const result = decodeProject(file)
  if (!result.ok) throw new Error(`expected the file to decode: ${JSON.stringify(result.issues)}`)
  return result.project
}

function issuesOf(file: ProjectFile): OpenIssue[] {
  const result = decodeProject(file)
  return result.ok ? [] : result.issues
}

const codes = (issues: readonly OpenIssue[]): string[] => issues.map((issue) => issue.code)

describe('decodeProject', () => {
  it('decodes the smallest file', () => {
    const project = decoded(minimalProjectFile())
    expect(project).toMatchObject({ format: 'af2d', version: 1, name: 'Minimal', levels: [] })
  })

  it('builds each grid at ceil(level size / grid) cells', () => {
    const project = decoded(richProjectFile())
    const start = project.levels.find((level) => level.id === 'start')
    const cellar = project.levels.find((level) => level.id === 'cellar')
    const grids = (level: typeof start) =>
      level?.layers.flatMap((layer) =>
        layer.kind === 'tiles' || layer.kind === 'intgrid'
          ? [[layer.cells.cols, layer.cells.rows]]
          : layer.kind === 'auto'
            ? [[layer.overrides.cols, layer.overrides.rows]]
            : [],
      )
    expect(grids(start)).toEqual([
      [4, 3],
      [4, 3],
      [4, 3],
    ])
    expect(grids(cellar)).toEqual([
      [2, 2],
      [2, 2],
      [2, 2],
    ])
  })

  it('reads the cells of each grid layer kind', () => {
    const project = decoded(richProjectFile())
    const start = project.levels.find((level) => level.id === 'start')
    const decor = start?.layers.find((layer) => layer.def === 'decor')
    const collision = start?.layers.find((layer) => layer.def === 'collision')
    const ground = start?.layers.find((layer) => layer.def === 'ground-art')
    if (decor?.kind !== 'tiles' || collision?.kind !== 'intgrid' || ground?.kind !== 'auto')
      throw new Error('fixture layers changed')
    expect(decor.cells.get(1, 1)).toBe(packTile(5, true, false))
    expect([...decor.cells.nonEmpty()]).toHaveLength(1)
    expect(collision.cells.get(1, 1)).toBe(2)
    expect([0, 1, 2, 3].map((x) => collision.cells.get(x, 2))).toEqual([1, 1, 1, 1])
    expect(ground.seed).toBe(1234)
    expect([...ground.overrides.nonEmpty()]).toEqual([])
  })

  it('passes entities and objects through', () => {
    const project = decoded(richProjectFile())
    const start = project.levels.find((level) => level.id === 'start')
    expect(start?.layers[0]).toEqual(richProjectFile().levels[1]?.layers[0])
    expect(start?.layers[1]).toEqual(richProjectFile().levels[1]?.layers[1])
  })

  it('is undone by encodeProject: encode(decode(file)) is the file', () => {
    expect(encodeProject(decoded(richProjectFile()))).toEqual(richProjectFile())
    expect(encodeProject(decoded(minimalProjectFile()))).toEqual(minimalProjectFile())
  })

  describe('refuses what decoding and every lookup need', () => {
    it('a repeated id: layer, tileset, entity definition, world and level', () => {
      const layers = edited(['defs'], 'layers', [
        ...richProjectFile().defs.layers,
        { id: 'decor', label: 'Again', kind: 'entities', grid: 16, snap: true },
      ])
      expect(issuesOf(layers)).toContainEqual(expect.objectContaining({ code: 'duplicateId' }))
      const duplicate = (path: Path, key: string, value: unknown, at: string) =>
        expect(issuesOf(edited(path, key, value))).toMatchObject([{ code: 'duplicateId', path: at }])
      duplicate(['defs', 'tilesets'], '1', { ...richProjectFile().defs.tilesets[0] }, 'defs.tilesets[1]')
      duplicate(['defs', 'entities', 2], 'id', 'door', 'defs.entities[2]')
      duplicate(['worlds'], '1', { ...richProjectFile().worlds[0] }, 'worlds[1]')
      duplicate(['levels', 1], 'id', 'cellar', 'levels[1]')
    })

    it('a repeated instance id, across levels, at the later one', () => {
      const file = edited(['levels', 0, 'layers', 0, 'items', 0], 'id', '00000009')
      expect(issuesOf(file)).toMatchObject([
        { code: 'duplicateId', path: 'levels[start].layers[entities].items[0]' },
      ])
    })

    it('a repeated IntGrid value or value id in one layer', () => {
      const values = ['defs', 'layers', 4, 'values', 1]
      expect(issuesOf(edited(values, 'value', 1))).toMatchObject([
        { code: 'duplicateId', path: 'defs.layers[collision].values[1]' },
      ])
      expect(issuesOf(edited(values, 'id', 'solid'))).toMatchObject([
        { code: 'duplicateId', path: 'defs.layers[collision].values[1]' },
      ])
    })

    it('a tileset that does not exist, in a tiles, auto or objects layer or an entity tile', () => {
      const missing = 'sprites'
      expect(issuesOf(edited(['defs', 'layers', 3], 'tileset', missing))).toMatchObject([
        { code: 'unknownTileset', path: 'defs.layers[decor].tileset' },
      ])
      expect(issuesOf(edited(['defs', 'layers', 2], 'tileset', missing))).toMatchObject([
        { code: 'unknownTileset', path: 'defs.layers[ground-art].tileset' },
      ])
      expect(issuesOf(edited(['defs', 'layers', 1], 'tileset', missing))).toMatchObject([
        { code: 'unknownTileset', path: 'defs.layers[props].tileset' },
      ])
      expect(issuesOf(edited(['defs', 'entities', 0, 'tile'], 'tileset', missing))).toMatchObject([
        { code: 'unknownTileset', path: 'defs.entities[door].tile.tileset' },
      ])
    })

    it('an auto layer whose source is missing or is not an IntGrid layer', () => {
      expect(issuesOf(edited(['defs', 'layers', 2], 'source', 'nope'))).toMatchObject([
        { code: 'unknownLayer', path: 'defs.layers[ground-art].source' },
      ])
      expect(issuesOf(edited(['defs', 'layers', 2], 'source', 'decor'))).toMatchObject([
        { code: 'layerKindMismatch', path: 'defs.layers[ground-art].source' },
      ])
    })

    it('a layer instance of a definition that does not exist', () => {
      expect(issuesOf(edited(['levels', 1, 'layers', 3], 'def', 'sky'))).toMatchObject([
        { code: 'unknownLayer', path: 'levels[start].layers[sky]' },
      ])
    })

    it('a layer instance whose kind is not its definition kind', () => {
      const layer = ['levels', 1, 'layers', 3]
      const wrong = edited(layer, 'kind', 'intgrid')
      expect(issuesOf(wrong)).toMatchObject([
        { code: 'layerKindMismatch', path: 'levels[start].layers[decor]' },
      ])
    })

    it('levels that do not hold one instance of every definition, in the definitions order', () => {
      const [entities, props, ground, decor, collision] = richProjectFile().levels[0]?.layers ?? []
      expect(issuesOf(edited(['levels', 0], 'layers', [entities, props, ground, collision]))).toMatchObject([
        { code: 'layerMismatch', path: 'levels[cellar].layers' },
      ])
      expect(
        issuesOf(edited(['levels', 0], 'layers', [entities, props, ground, collision, decor])),
      ).toMatchObject([{ code: 'layerMismatch', path: 'levels[cellar].layers' }])
    })

    it('a layer over 1024 cells on a side, without allocating it', () => {
      const widen = (width: number) =>
        edited(['defs', 'layers', 3], 'grid', 4, edited(['levels', 1, 'size'], 'w', width))
      // The other layers' rows no longer fit the wider level either; this is about the decor layer.
      const wide = issuesOf(widen(4100))
      expect(wide.filter((issue) => issue.code === 'layerTooLarge')).toMatchObject([
        { path: 'levels[start].layers[decor]' },
      ])
      expect(wide.some((issue) => issue.path.startsWith('levels[start].layers[decor].'))).toBe(false)
      // 4096 / 4 is exactly 1024 cells: allowed, so the layer is read and its 4-cell rows are the problem.
      const edge = issuesOf(widen(4096))
      expect(codes(edge)).not.toContain('layerTooLarge')
      expect(edge).toContainEqual(expect.objectContaining({ path: 'levels[start].layers[decor].rows[0]' }))
    })
  })

  describe('cellInvalid', () => {
    it('a row of the wrong width, with the row in the path', () => {
      const file = edited(['levels', 1, 'layers', 3, 'rows'], 1, '. 5h')
      expect(issuesOf(file)).toMatchObject([
        { code: 'cellInvalid', path: 'levels[start].layers[decor].rows[1]' },
      ])
    })

    it('a token that is not a cell, with the row in the path', () => {
      const file = edited(['levels', 1, 'layers', 4, 'rows'], 2, '1 1 7x 1')
      expect(issuesOf(file)).toMatchObject([
        { code: 'cellInvalid', path: 'levels[start].layers[collision].rows[2]' },
      ])
    })

    it('the wrong number of rows, at the rows array', () => {
      const file = edited(['levels', 1, 'layers', 3], 'rows', ['.*4', '.*4'])
      expect(issuesOf(file)).toMatchObject([
        { code: 'cellInvalid', path: 'levels[start].layers[decor].rows' },
      ])
    })

    it('a bad override row of an auto layer', () => {
      const file = edited(['levels', 0, 'layers', 2, 'overrides'], 0, '.*3')
      expect(issuesOf(file)).toMatchObject([
        { code: 'cellInvalid', path: 'levels[cellar].layers[ground-art].overrides[0]' },
      ])
    })
  })

  it('reports every problem it finds, in file order', () => {
    const file = edited(
      ['levels', 1, 'layers', 4, 'rows'],
      0,
      '.*3',
      edited(['defs', 'layers', 3], 'tileset', 'sprites'),
    )
    expect(issuesOf(file).map((issue) => issue.path)).toEqual([
      'defs.layers[decor].tileset',
      'levels[start].layers[collision].rows[0]',
    ])
  })
})

describe('printProject', () => {
  const printed = (file: ProjectFile): string => printProject(decoded(file))

  /** What a person or another tool might write: other spacing, every object's keys in reverse order. */
  function scrambled(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(scrambled)
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .reverse()
          .map(([key, inner]) => [key, scrambled(inner)]),
      )
    }
    return value
  }

  function reopened(text: string): ProjectFile {
    return projectFileSchema.parse(JSON.parse(text))
  }

  it('writes two-space JSON with a final newline and the keys in schema order', () => {
    const text = printed(richProjectFile())
    expect(text.endsWith('}\n')).toBe(true)
    expect(text.startsWith('{\n  "format": "af2d",\n  "version": 1,\n  "name": "Mossgate",\n')).toBe(true)
  })

  it('writes each grid row on its own line', () => {
    const lines = printed(richProjectFile()).split('\n')
    expect(lines).toContain('            ". 5h .*2",')
    expect(lines).toContain('            "1*4"')
  })

  it('G-b: a canonical text opens and prints byte-identical', () => {
    const text = printed(richProjectFile())
    expect(printed(reopened(text))).toBe(text)
    const small = printed(minimalProjectFile())
    expect(printed(reopened(small))).toBe(small)
  })

  it('prints the fixture as the fixture is written (it is canonical)', () => {
    expect(JSON.parse(printed(richProjectFile()))).toEqual(richProjectFile())
  })

  it('prints a hand-edited file canonically: other spacing, any key order', () => {
    const canonical = printed(richProjectFile())
    const handEdited = JSON.stringify(scrambled(JSON.parse(canonical)), null, 4)
    expect(printed(reopened(handEdited))).toBe(canonical)
  })

  it('sorts tilesets, entity definitions, worlds and levels by id and keeps every other order', () => {
    const file = richProjectFile()
    const shuffled: ProjectFile = {
      ...file,
      defs: { ...file.defs, entities: [...file.defs.entities].reverse() },
      levels: [...file.levels].reverse(),
    }
    expect(printed(shuffled)).toBe(printed(file))

    const layerOrder: ProjectFile = {
      ...file,
      defs: { ...file.defs, layers: [...file.defs.layers].reverse() },
      levels: file.levels.map((level) => ({ ...level, layers: [...level.layers].reverse() })),
    }
    const ids = (text: string) => JSON.parse(text).defs.layers.map((layer: { id: string }) => layer.id)
    expect(ids(printed(layerOrder))).toEqual(['collision', 'decor', 'ground-art', 'props', 'entities'])
  })

  it('sorts the keys of field values, and keeps a list in order', () => {
    const file = edited(['levels', 1, 'layers', 0, 'items', 1], 'fields', {
      patrol: [
        { y: 32, x: 48 },
        { y: 32, x: 16 },
      ],
      hp: 3,
    })
    const slime = JSON.parse(printed(file)).levels[1].layers[0].items[1]
    expect(Object.keys(slime.fields)).toEqual(['hp', 'patrol'])
    expect(slime.fields.patrol).toEqual([
      { x: 48, y: 32 },
      { x: 16, y: 32 },
    ])
  })

  it('refuses to print a project that the schema would refuse to open', () => {
    const project = { ...decoded(richProjectFile()), worlds: [] }
    expect(() => printProject(project)).toThrow(/worlds/)
  })
})
