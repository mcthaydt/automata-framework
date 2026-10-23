import { describe, expect, it } from 'vitest'
import { parseStage } from './stage-codec'
import { courseTables, elementTable, presentationTables, RANK } from './stage-tables'
import { SHIPPED_STAGE_IDS, type ShippedStageId, shippedStage } from './testing/shipped-stages'
import { documentOf } from './testing/stage-texts'
import { scanBlocks, splitLines } from './toml-blocks'

// The text of a table the editor adds (EDFF.1a decision 9): the shipped stages are the style guide, so a table rendered
// from a stage's own value must read as that stage's own table, apart from its comments.

/**
 * The lines of every block called `name`, without comments and blank lines. A whole number the file writes as a float
 * (`density = 1.0`) is written `1`: the value is the same number, and a value does not remember how it was spelled.
 */
function bareBlocks(text: string, name: string): string[][] {
  const { lines } = splitLines(text)
  return scanBlocks(lines)
    .filter((block) => block.name === name)
    .map((block) =>
      lines
        .slice(block.header, block.last + 1)
        .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
        .map((line) => line.replace(/= (-?\d+)\.0$/, '= $1')),
    )
}

describe('elementTable', () => {
  it.each(SHIPPED_STAGE_IDS)(
    'renders each layer and set piece of %s as the file writes it',
    (id: ShippedStageId) => {
      const text = shippedStage(id)
      const { value } = documentOf(text)
      expect(value.theme.layers.map((layer) => elementTable('theme.layers', layer))).toEqual(
        bareBlocks(text, 'theme.layers'),
      )
      expect(value.theme.setPieces.map((piece) => elementTable('theme.setPieces', piece))).toEqual(
        bareBlocks(text, 'theme.setPieces'),
      )
    },
  )

  it.each(['rooftops', 'snow-shrine', 'sunken-dome'] as const)(
    'renders each extension entry of %s as the file writes it',
    (id) => {
      const text = shippedStage(id)
      const extension = documentOf(text).value.course?.extension ?? []
      expect(extension).not.toHaveLength(0)
      expect(extension.map((entry) => elementTable('course.extension', entry))).toEqual(
        bareBlocks(text, 'course.extension'),
      )
    },
  )

  it('writes a string list without spaces inside the brackets, as the files do', () => {
    const lines = elementTable('theme.setPieces', {
      floor: 3,
      kind: 'swarm',
      holdMs: 900,
      layers: ['a.b', 'c'],
      speed: 4,
    })
    expect(lines).toEqual([
      '[[theme.setPieces]]',
      'floor = 3',
      'kind = "swarm"',
      'holdMs = 900',
      'layers = ["a.b", "c"]',
      'speed = 4',
    ])
  })

  it('leaves out an optional key that is unset', () => {
    const lines = elementTable('theme.layers', {
      alias: 'a',
      plate: 'city',
      depth: 0.3,
      sink: 5,
      haze: undefined,
      extend: 'skirt',
    })
    expect(lines).toEqual([
      '[[theme.layers]]',
      'alias = "a"',
      'plate = "city"',
      'depth = 0.3',
      'sink = 5',
      'extend = "skirt"',
    ])
  })

  it('orders the keys of every kind of set piece as the files and the schema do', () => {
    const base = { floor: 1, holdMs: 600 }
    const keys = (piece: Parameters<typeof elementTable>[1]): string[] =>
      elementTable('theme.setPieces', piece)
        .slice(1)
        .map((line) => line.split(' = ')[0] as string)
    expect(keys({ ...base, kind: 'lightsOut', invert: true } as never)).toEqual([
      'floor',
      'kind',
      'holdMs',
      'invert',
    ])
    expect(keys({ ...base, kind: 'paletteShift', stay: true, mood: 'night' } as never)).toEqual([
      'floor',
      'kind',
      'holdMs',
      'mood',
      'stay',
    ])
    expect(
      keys({ ...base, kind: 'weatherBurst', layers: ['x'], density: 1, particle: 'rain' } as never),
    ).toEqual(['floor', 'kind', 'holdMs', 'particle', 'density', 'layers'])
    expect(keys({ ...base, kind: 'skyFlash', kick: 1, tone: 'aurora', flashes: 2 } as never)).toEqual([
      'floor',
      'kind',
      'holdMs',
      'flashes',
      'tone',
      'kick',
    ])
    expect(keys({ ...base, kind: 'swarm', speed: 2, layers: ['x'] } as never)).toEqual([
      'floor',
      'kind',
      'holdMs',
      'layers',
      'speed',
    ])
  })

  it('writes text that reads back as the same element, including awkward strings and numbers', () => {
    const layer = {
      alias: 'a "quoted" \\ alias\twithé',
      plate: 'city',
      depth: 0.1 + 0.2,
      sink: -1e-7,
      extend: 'tile',
      arc: 1.5e-3,
    } as const
    const stage = [
      'id = "t"',
      'displayName = "T"',
      'platformAlias = "p"',
      '[courseTuning]',
      '[theme]',
      'backdropAlias = "b"',
      ...elementTable('theme.layers', layer),
    ].join('\n')
    const result = parseStage(stage)
    if (!result.ok) throw new Error(JSON.stringify(result.error))
    expect(result.value.value.theme.layers).toEqual([layer])
  })
})

describe('courseTables', () => {
  it.each(['rooftops', 'snow-shrine', 'sunken-dome'] as const)(
    'renders the course of %s as the file writes it',
    (id) => {
      const text = shippedStage(id)
      const course = documentOf(text).value.course
      if (course === undefined) throw new Error('expected a course')
      const tables = courseTables(course)
      expect(tables.map((table) => table[0])).toEqual([
        '[course]',
        ...course.phrases.map(() => '[[course.phrases]]'),
        ...(course.extension ?? []).map(() => '[[course.extension]]'),
      ])
      expect(tables).toEqual([
        ...bareBlocks(text, 'course'),
        ...bareBlocks(text, 'course.phrases'),
        ...bareBlocks(text, 'course.extension'),
      ])
    },
  )
})

describe('presentationTables', () => {
  it.each(['dawn', 'rooftops', 'snow-shrine', 'sunken-dome'] as const)(
    'renders the presentation of %s with the same lines as the file',
    (id) => {
      const text = shippedStage(id)
      const presentation = documentOf(text).value.theme.presentation
      if (presentation === undefined) throw new Error('expected a presentation')
      const tables = presentationTables(presentation)
      const written = [
        ...bareBlocks(text, 'theme.presentation'),
        ...bareBlocks(text, 'theme.presentation.citySink'),
      ]
      // The files do not agree on where `lightHeight` goes; the schema's order is used for new tables.
      expect(tables.map((table) => [...table].sort())).toEqual(written.map((table) => [...table].sort()))
      expect(tables.map((table) => table[0])).toEqual(written.map((table) => table[0]))
      // The city sink's order is the same in every file.
      expect(tables[1]).toEqual(written[1])
    },
  )
})

describe('presentationTables with every key', () => {
  it("writes the presentation's keys in the schema's order, then the city sink", () => {
    const tables = presentationTables({
      silhouette: false,
      citySink: { finish: 4, recover: 3, combine: 2, teach: 1 },
      lightShimmer: true,
      lightHeight: -20,
      horizonLift: 8,
      refractionIntensity: 0.5,
      profile: 'aquarian',
    })
    expect(tables).toEqual([
      [
        '[theme.presentation]',
        'profile = "aquarian"',
        'refractionIntensity = 0.5',
        'horizonLift = 8',
        'lightHeight = -20',
        'lightShimmer = true',
        'silhouette = false',
      ],
      ['[theme.presentation.citySink]', 'teach = 1', 'combine = 2', 'recover = 3', 'finish = 4'],
    ])
  })
})

describe('RANK', () => {
  it('orders the tables of a stage as the shipped files do', () => {
    const order = Object.keys(RANK).sort((a, b) => (RANK[a] as number) - (RANK[b] as number))
    expect(order).toEqual([
      'courseTuning',
      'course',
      'course.phrases',
      'course.extension',
      'theme',
      'theme.layers',
      'theme.presentation',
      'theme.presentation.citySink',
      'theme.setPieces',
    ])
  })

  it.each(SHIPPED_STAGE_IDS)('is the order in which %s lists its tables', (id: ShippedStageId) => {
    const { lines } = splitLines(shippedStage(id))
    const ranks = scanBlocks(lines).map((block) => RANK[block.name])
    expect(ranks).toEqual([...ranks].sort((a, b) => (a as number) - (b as number)))
  })
})
