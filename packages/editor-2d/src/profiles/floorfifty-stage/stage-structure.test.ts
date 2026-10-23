import { parse } from '@decimalturn/toml-patch'
import { describe, expect, it } from 'vitest'
import type { StageValue } from './stage.schema'
import { parseStage, printStage } from './stage-codec'
import type { StageDocument } from './stage-document'
import { elementTable, type ListName } from './stage-tables'
import { diffLines } from './testing/diff-lines'
import { SHIPPED_STAGE_IDS, type ShippedStageId, shippedStage } from './testing/shipped-stages'
import {
  documentOf,
  insertElement,
  listOf,
  MINIMAL_STAGE,
  moveElement,
  removeAt,
  removeCourse,
  removeElement,
  setAt,
  withList,
} from './testing/stage-texts'
import { scanBlocks, splitLines } from './toml-blocks'

// Printing a document whose tables changed (EDFF.1a step 6): a table goes with its own comments and nothing else, a new
// table is written the way the file writes its tables, and a moved one takes its comments along.

const LISTS: readonly ListName[] = ['course.extension', 'theme.layers', 'theme.setPieces']

/** The value as a text spells it: an unset key is no key, and an empty extension is none. */
function asRead(value: StageValue): StageValue {
  const copy = JSON.parse(JSON.stringify(value)) as { course?: { extension?: unknown[] } }
  if (copy.course?.extension?.length === 0) delete copy.course.extension
  return copy as unknown as StageValue
}

/**
 * Prints and checks that the text is TOML that reads back as exactly the edited value, whether or not the schema would
 * accept that value: reordering layers can break the order of their depths, which is a check's business and not the
 * codec's.
 */
function printAsIs(before: string, edited: StageDocument): string {
  const text = printStage(before, edited)
  const expected = asRead(edited.value) as unknown as { theme: { setPieces?: unknown[] } }
  if (expected.theme.setPieces?.length === 0) delete expected.theme.setPieces
  expect(parse(text)).toEqual(expected)
  return text
}

/** Prints and checks that the text reads back as exactly the edited value. */
function print(before: string, edited: StageDocument): string {
  const text = printStage(before, edited)
  const reread = parseStage(text)
  if (!reread.ok) throw new Error(`the printed text does not parse: ${JSON.stringify(reread.error)}\n${text}`)
  expect(reread.value.value).toEqual(asRead(edited.value))
  return text
}

const commentLines = (text: string): string[] =>
  splitLines(text)
    .lines.filter((line) => line.trimStart().startsWith('#'))
    .sort()

/** `all` without one occurrence of each line of `once`. */
function withoutOnce(all: readonly string[], once: readonly string[]): string[] {
  const rest = [...all]
  for (const line of once) {
    const at = rest.indexOf(line)
    if (at >= 0) rest.splice(at, 1)
  }
  return rest
}

const nonBlank = (lines: readonly string[]): string[] => lines.filter((line) => line.trim() !== '')

/** The longest run of blank lines in a text. */
function blankRun(text: string): number {
  let longest = 0
  let run = 0
  for (const line of splitLines(text).lines) {
    run = line.trim() === '' ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  return longest
}

/** The lines of the `index`th table called `name` with its own comments, as the text has them. */
function ownLines(text: string, name: string, index: number): string[] {
  const { lines } = splitLines(text)
  const block = scanBlocks(lines).filter((candidate) => candidate.name === name)[index]
  if (block === undefined) throw new Error(`no table ${name}[${index}]`)
  return lines.slice(block.start, block.last + 1)
}

const newLayer = {
  alias: 'world.fresh',
  plate: 'city',
  depth: 0.5,
  sink: 40,
  extend: 'skirt',
} as const
const newPiece = { floor: 3, kind: 'lightsOut', holdMs: 900 } as const

describe('printStage removing an element of a list', () => {
  const cases = SHIPPED_STAGE_IDS.flatMap((id) =>
    LISTS.flatMap((list) =>
      Array.from({ length: listOf(documentOf(shippedStage(id)), list).items.length }, (_, index) => ({
        id,
        list,
        index,
      })),
    ),
  )

  it('covers every element of every list of the four stages', () => {
    expect(cases.length).toBeGreaterThan(60)
  })

  it.each(cases)(
    'removes $list[$index] of $id with its own comments and nothing else',
    ({ id, list, index }: { id: ShippedStageId; list: ListName; index: number }) => {
      const base = shippedStage(id)
      const text = print(base, removeElement(documentOf(base), list, index))
      const own = ownLines(base, list, index)
      const diff = diffLines(base, text)
      expect(diff.added).toEqual([])
      expect(nonBlank(diff.removed.map((line) => line.text)).sort()).toEqual(nonBlank(own).sort())
      // The comments of every other table are all still there, once.
      expect(commentLines(text)).toEqual(withoutOnce(commentLines(base), commentLines(own.join('\n'))))
      expect(blankRun(text)).toBeLessThanOrEqual(blankRun(base))
    },
  )

  it('removes a layer in the middle and leaves one blank line between its neighbours', () => {
    const base = shippedStage('rooftops')
    const text = print(base, removeElement(documentOf(base), 'theme.layers', 2))
    const own = ownLines(base, 'theme.layers', 2)
    expect(text).not.toContain(own[own.length - 1] as string)
    expect(text.split('\n').length).toBe(base.split('\n').length - own.length - 1)
  })
})

describe('printStage removing a single table', () => {
  const rooftops = shippedStage('rooftops')

  it('removes the presentation and its city sink and keeps the paragraph about set pieces below them', () => {
    const base = rooftops
    const text = print(base, removeAt(documentOf(base), ['theme', 'presentation']))
    const own = [
      ...ownLines(base, 'theme.presentation', 0),
      '',
      ...ownLines(base, 'theme.presentation.citySink', 0),
    ]
    const diff = diffLines(base, text)
    expect(diff.added).toEqual([])
    expect(nonBlank(diff.removed.map((line) => line.text)).sort()).toEqual(nonBlank(own).sort())
    expect(text).toContain('# Set pieces (Wonder spec §6.4)')
    expect(commentLines(text)).toEqual(withoutOnce(commentLines(base), commentLines(own.join('\n'))))
  })

  it('removes only the city sink and keeps the presentation', () => {
    const text = print(rooftops, removeAt(documentOf(rooftops), ['theme', 'presentation', 'citySink']))
    const diff = diffLines(rooftops, text)
    expect(diff.added).toEqual([])
    expect(nonBlank(diff.removed.map((line) => line.text)).sort()).toEqual(
      nonBlank(ownLines(rooftops, 'theme.presentation.citySink', 0)).sort(),
    )
    expect(text).toContain('# Set pieces (Wonder spec §6.4)')
  })

  it('removes the course with its phrases and extension and nothing else', () => {
    const text = print(rooftops, removeCourse(documentOf(rooftops)))
    const own = ['course', 'course.phrases', 'course.extension'].flatMap((name) =>
      scanBlocks(splitLines(rooftops).lines)
        .filter((block) => block.name === name)
        .flatMap((_, index) => ownLines(rooftops, name, index)),
    )
    const diff = diffLines(rooftops, text)
    expect(diff.added).toEqual([])
    expect(nonBlank(diff.removed.map((line) => line.text)).sort()).toEqual(nonBlank(own).sort())
    expect(blankRun(text)).toBeLessThanOrEqual(blankRun(rooftops))
  })

  it.each(['snow-shrine', 'sunken-dome'] as const)('removes the course and the presentation of %s', (id) => {
    const base = shippedStage(id)
    const doc = removeAt(removeCourse(documentOf(base)), ['theme', 'presentation'])
    const text = print(base, doc)
    expect(text).not.toMatch(/^\[\[?course[\].]/m)
    expect(text).not.toMatch(/^\[\[?theme\.presentation[\].]/m)
    expect(blankRun(text)).toBeLessThanOrEqual(blankRun(base))
  })
})

describe('printStage adding a single table', () => {
  const sink = { teach: 1, combine: 2, recover: 3, finish: 4 }

  it('adds the city sink as a table after the presentation, ahead of the set pieces', () => {
    const dawn = shippedStage('dawn')
    const text = print(dawn, setAt(documentOf(dawn), ['theme', 'presentation', 'citySink'], sink))
    const diff = diffLines(dawn, text)
    expect(diff.removed).toEqual([])
    expect(nonBlank(diff.added.map((line) => line.text))).toEqual([
      '[theme.presentation.citySink]',
      'teach = 1',
      'combine = 2',
      'recover = 3',
      'finish = 4',
    ])
    const lines = splitLines(text).lines
    const at = lines.indexOf('[theme.presentation.citySink]')
    expect(scanBlocks(lines).find((block) => block.name === 'theme.presentation')?.last).toBe(at - 2)
    expect(lines[at + 5]).toBe('')
    // The paragraph that followed the presentation still follows the new table, and still leads to the set pieces.
    expect(commentLines(text)).toEqual(commentLines(dawn))
    expect(scanBlocks(lines).find((block) => block.name === 'theme.setPieces')?.start).toBeGreaterThan(at + 5)
  })

  it('adds a course between the tunables and the theme, with its phrases as tables', () => {
    const course = {
      seed: 7,
      phrases: [
        { name: 'teach', fromFloor: 1, toFloor: 5, purpose: 'First.' },
        { name: 'combine', fromFloor: 6, toFloor: 11, purpose: 'Second.' },
        { name: 'recover', fromFloor: 12, toFloor: 15, purpose: 'Third.' },
        { name: 'finish', fromFloor: 16, toFloor: 19, purpose: 'Fourth.' },
      ],
    }
    const text = print(MINIMAL_STAGE, setAt(documentOf(MINIMAL_STAGE), ['course'], course))
    expect(text).toBe(
      MINIMAL_STAGE.replace(
        '[courseTuning]\n\n',
        [
          '[courseTuning]',
          '',
          '[course]',
          'seed = 7',
          '',
          '[[course.phrases]]',
          'name = "teach"',
          'fromFloor = 1',
          'toFloor = 5',
          'purpose = "First."',
          '',
          '[[course.phrases]]',
          'name = "combine"',
          'fromFloor = 6',
          'toFloor = 11',
          'purpose = "Second."',
          '',
          '[[course.phrases]]',
          'name = "recover"',
          'fromFloor = 12',
          'toFloor = 15',
          'purpose = "Third."',
          '',
          '[[course.phrases]]',
          'name = "finish"',
          'fromFloor = 16',
          'toFloor = 19',
          'purpose = "Fourth."',
          '',
          '',
        ].join('\n'),
      ),
    )
  })

  it('adds a presentation with a city sink after the last layer of a stage that ends there', () => {
    const presentation = {
      profile: 'aquarian',
      refractionIntensity: 0.4,
      horizonLift: 10,
      citySink: sink,
    }
    const text = print(
      MINIMAL_STAGE,
      setAt(documentOf(MINIMAL_STAGE), ['theme', 'presentation'], presentation),
    )
    expect(text).toBe(
      `${MINIMAL_STAGE}\n${[
        '[theme.presentation]',
        'profile = "aquarian"',
        'refractionIntensity = 0.4',
        'horizonLift = 10',
        '',
        '[theme.presentation.citySink]',
        'teach = 1',
        'combine = 2',
        'recover = 3',
        'finish = 4',
        '',
      ].join('\n')}`,
    )
  })

  it('adds a course, a presentation and a set piece to the same stage', () => {
    const doc = documentOf(MINIMAL_STAGE)
    const withPiece = insertElement(doc, 'theme.setPieces', 0, newPiece, 'n1')
    const withPresentation = setAt(withPiece, ['theme', 'presentation'], {
      profile: 'aquarian',
      refractionIntensity: 0.4,
      horizonLift: 10,
    })
    const text = print(MINIMAL_STAGE, withPresentation)
    const names = scanBlocks(splitLines(text).lines).map((block) => block.name)
    expect(names).toEqual(['courseTuning', 'theme', 'theme.layers', 'theme.presentation', 'theme.setPieces'])
  })
})

describe('printStage inserting an element', () => {
  it('adds the first set piece after the last layer of a stage that has none', () => {
    const text = print(
      MINIMAL_STAGE,
      insertElement(documentOf(MINIMAL_STAGE), 'theme.setPieces', 0, newPiece, 'n1'),
    )
    expect(text).toBe(`${MINIMAL_STAGE}\n[[theme.setPieces]]\nfloor = 3\nkind = "lightsOut"\nholdMs = 900\n`)
  })

  it('adds a layer at the end of the layers', () => {
    const text = print(
      MINIMAL_STAGE,
      insertElement(documentOf(MINIMAL_STAGE), 'theme.layers', 1, newLayer, 'n1'),
    )
    expect(text).toBe(
      `${MINIMAL_STAGE}\n${['[[theme.layers]]', 'alias = "world.fresh"', 'plate = "city"', 'depth = 0.5', 'sink = 40', 'extend = "skirt"', ''].join('\n')}`,
    )
  })

  it('adds a layer at the front, before the comments of the first', () => {
    const base = MINIMAL_STAGE.replace('[[theme.layers]]', '# the sky\n[[theme.layers]]')
    const text = print(base, insertElement(documentOf(base), 'theme.layers', 0, newLayer, 'n1'))
    expect(text).toBe(
      base.replace(
        '# the sky\n',
        '[[theme.layers]]\nalias = "world.fresh"\nplate = "city"\ndepth = 0.5\nsink = 40\nextend = "skirt"\n\n# the sky\n',
      ),
    )
  })

  it.each(SHIPPED_STAGE_IDS)(
    'adds a layer between the first two of %s, after the first and its gap',
    (id: ShippedStageId) => {
      const base = shippedStage(id)
      const doc = documentOf(base)
      // A layer as far away as the first, so that the order of depths stays valid wherever the stage's layers lie.
      const first = doc.value.theme.layers[0]
      if (first === undefined) throw new Error('expected a layer')
      const layer = {
        alias: 'world.fresh',
        plate: first.plate,
        depth: first.depth,
        sink: first.sink,
        extend: 'none',
      } as const
      const text = print(base, insertElement(doc, 'theme.layers', 1, layer, 'n1'))
      const diff = diffLines(base, text)
      expect(diff.removed).toEqual([])
      expect(nonBlank(diff.added.map((line) => line.text))).toEqual(elementTable('theme.layers', layer))
      expect(commentLines(text)).toEqual(commentLines(base))
      // The new table sits right after the first layer's last key.
      const lines = splitLines(text).lines
      const layers = scanBlocks(lines).filter((block) => block.name === 'theme.layers')
      expect(lines[(layers[0]?.last ?? 0) + 1]).toBe('')
      expect(layers[1]?.start).toBe((layers[0]?.last ?? 0) + 2)
      expect(lines.slice(layers[1]?.start, (layers[1]?.last ?? 0) + 1)).toEqual(
        elementTable('theme.layers', layer),
      )
    },
  )

  it('adds the first extension entry after the last phrase', () => {
    const base = shippedStage('rooftops')
    const noExtension = removeAt(documentOf(base), ['course', 'extension'])
    const oneEntry = { fromFloor: 20, toFloor: 49, purpose: 'The rest.' }
    const onlyPhrases = print(base, withList(documentOf(base), 'course.extension', [], []))
    const text = print(
      onlyPhrases,
      insertElement(documentOf(onlyPhrases), 'course.extension', 0, oneEntry, 'n1'),
    )
    const names = scanBlocks(splitLines(text).lines).map((block) => block.name)
    expect(names.slice(0, 7)).toEqual([
      'courseTuning',
      'course',
      'course.phrases',
      'course.phrases',
      'course.phrases',
      'course.phrases',
      'course.extension',
    ])
    expect(noExtension.value.course?.extension).toBeUndefined()
  })
})

describe('printStage moving an element', () => {
  /** What stands in a text right above the header of each element of `list`, with the keys under it: the element's own lines. */
  const ownByIndex = (text: string, list: ListName): string[][] => {
    const count = scanBlocks(splitLines(text).lines).filter((block) => block.name === list).length
    return Array.from({ length: count }, (_, index) => ownLines(text, list, index))
  }

  const moves: readonly { id: ShippedStageId; list: ListName; from: number; to: number }[] =
    SHIPPED_STAGE_IDS.flatMap((id) =>
      LISTS.flatMap((list) => {
        const count = listOf(documentOf(shippedStage(id)), list).items.length
        if (count < 2) return []
        return [
          { id, list, from: 0, to: count - 1 },
          { id, list, from: count - 1, to: 0 },
          { id, list, from: 0, to: 1 },
          { id, list, from: Math.floor(count / 2), to: 0 },
        ]
      }),
    )

  it('covers every list of the four stages that has two elements or more', () => {
    expect(moves.length).toBeGreaterThan(30)
  })

  it.each(moves)(
    'moves $list[$from] of $id to $to with its own comments',
    ({ id, list, from, to }: { id: ShippedStageId; list: ListName; from: number; to: number }) => {
      const base = shippedStage(id)
      const text = printAsIs(base, moveElement(documentOf(base), list, from, to))
      const before = ownByIndex(base, list)
      const expected = [...before]
      const [moved] = expected.splice(from, 1)
      expected.splice(to, 0, moved as string[])
      expect(ownByIndex(text, list)).toEqual(expected)
      // Every non-blank line is still there once; only their order changed.
      expect(nonBlank(splitLines(text).lines).sort()).toEqual(nonBlank(splitLines(base).lines).sort())
      expect(blankRun(text)).toBeLessThanOrEqual(blankRun(base))
    },
  )

  it('keeps the text of a list that was moved and then moved back', () => {
    const base = shippedStage('snow-shrine')
    const moved = moveElement(documentOf(base), 'theme.layers', 0, 3)
    const back = moveElement(moved, 'theme.layers', 3, 0)
    expect(printAsIs(base, back)).toBe(base)
  })
})

describe('printStage with several edits at once', () => {
  it('removes a layer, adds a set piece, moves a piece, edits a scalar and drops the presentation in one print', () => {
    const base = shippedStage('rooftops')
    let doc = documentOf(base)
    doc = removeElement(doc, 'theme.layers', 1)
    doc = insertElement(doc, 'theme.setPieces', 2, newPiece, 'n1')
    doc = moveElement(doc, 'theme.setPieces', 0, 3)
    doc = setAt(doc, ['displayName'], 'Roof Tops')
    doc = removeAt(doc, ['theme', 'presentation'])
    const text = print(base, doc)
    expect(text).toContain('displayName = "Roof Tops"')
    expect(text).toContain('# Set pieces (Wonder spec §6.4)')
    expect(text).not.toContain('[theme.presentation')
  })

  it('changes a scalar of an element that moved', () => {
    const base = shippedStage('sunken-dome')
    const moved = moveElement(documentOf(base), 'theme.layers', 0, 2)
    const edited = setAt(moved, ['theme', 'layers', 2, 'sink'], 77)
    const text = printAsIs(base, edited)
    expect(ownLinesOf(text, 'theme.layers', 2)).toContain('sink = 77')
  })
})

function ownLinesOf(text: string, list: ListName, index: number): string[] {
  return ownLines(text, list, index)
}

describe('printStage of a text with Windows line endings or no final newline', () => {
  const edits: readonly [string, (doc: StageDocument) => StageDocument][] = [
    ['removes a layer', (doc) => removeElement(doc, 'theme.layers', 1)],
    ['moves a set piece', (doc) => moveElement(doc, 'theme.setPieces', 0, 2)],
    ['drops the presentation', (doc) => removeAt(doc, ['theme', 'presentation'])],
    ['adds a set piece', (doc) => insertElement(doc, 'theme.setPieces', 1, newPiece, 'n1')],
  ]

  it.each(edits)('%s and prints the same changes', (_name, edit) => {
    const lf = shippedStage('rooftops')
    const crlf = lf.replace(/\n/g, '\r\n')
    const noFinal = lf.trimEnd()
    const reference = print(lf, edit(documentOf(lf)))
    const windows = print(crlf, edit(documentOf(crlf)))
    expect(windows).toBe(reference.replace(/\n/g, '\r\n'))
    expect(windows).not.toMatch(/[^\r]\n/)
    const bare = print(noFinal, edit(documentOf(noFinal)))
    expect(bare.endsWith('\n')).toBe(false)
    expect(bare).toBe(reference.trimEnd())
  })
})

describe('printStage of a document whose ids do not fit its lists', () => {
  it('refuses an id list that is shorter or longer than its elements', () => {
    const doc = documentOf(MINIMAL_STAGE)
    expect(() =>
      printStage(MINIMAL_STAGE, withList(doc, 'theme.layers', listOf(doc, 'theme.layers').items, [])),
    ).toThrow(/theme.layers has 1 elements and 0 ids/)
    expect(() =>
      printStage(MINIMAL_STAGE, insertElement(doc, 'theme.setPieces', 0, newPiece, 'n1')),
    ).not.toThrow()
    expect(() => printStage(MINIMAL_STAGE, withList(doc, 'theme.setPieces', [newPiece], ['a', 'b']))).toThrow(
      /theme.setPieces has 1 elements and 2 ids/,
    )
  })

  it('refuses the same id twice in a list', () => {
    const doc = documentOf(MINIMAL_STAGE)
    const twice = withList(doc, 'theme.setPieces', [newPiece, { ...newPiece, floor: 4 }], ['x', 'x'])
    expect(() => printStage(MINIMAL_STAGE, twice)).toThrow(/theme.setPieces has an id twice/)
  })

  it('refuses ids for an extension the document has no course for', () => {
    const doc = documentOf(MINIMAL_STAGE)
    expect(() => printStage(MINIMAL_STAGE, { ...doc, ids: { ...doc.ids, extension: ['x'] } })).toThrow(
      /course.extension has 0 elements and 1 ids/,
    )
  })
})

describe('printStage in the places the shipped stages do not reach', () => {
  const layer = (alias: string, depth: number): string =>
    [
      '[[theme.layers]]',
      `alias = "${alias}"`,
      'plate = "city"',
      `depth = ${depth}`,
      'sink = 10',
      'extend = "skirt"',
    ].join('\n')

  const threeLayers = [
    'id = "tiny"',
    'displayName = "Tiny"',
    'platformAlias = "world.platform"',
    '',
    '[courseTuning]',
    '',
    '[theme]',
    'backdropAlias = "world.sky"',
    '',
    layer('world.a', 0.1),
    '',
    '# Floating: about the layers further down, not about the one above.',
    '',
    layer('world.b', 0.2),
    '',
    '# Floating again.',
    '',
    layer('world.c', 0.3),
    '',
  ].join('\n')

  it('leaves a floating comment where it stood when a later element moves up', () => {
    const text = printAsIs(threeLayers, moveElement(documentOf(threeLayers), 'theme.layers', 2, 1))
    expect(text).toBe(
      [
        'id = "tiny"',
        'displayName = "Tiny"',
        'platformAlias = "world.platform"',
        '',
        '[courseTuning]',
        '',
        '[theme]',
        'backdropAlias = "world.sky"',
        '',
        layer('world.a', 0.1),
        '',
        '# Floating: about the layers further down, not about the one above.',
        '',
        layer('world.c', 0.3),
        '',
        '# Floating again.',
        '',
        layer('world.b', 0.2),
        '',
      ].join('\n'),
    )
  })

  it('adds a layer after the last of several, past the floating comments between them', () => {
    const end = { alias: 'world.d', plate: 'city', depth: 0.3, sink: 10, extend: 'skirt' } as const
    const doc = documentOf(threeLayers)
    const text = print(threeLayers, insertElement(doc, 'theme.layers', 3, end, 'n1'))
    expect(text).toBe(`${threeLayers}\n${elementTable('theme.layers', end).join('\n')}\n`)
  })

  it.each(SHIPPED_STAGE_IDS)('adds a layer at the end of the layers of %s', (id: ShippedStageId) => {
    const base = shippedStage(id)
    const doc = documentOf(base)
    const last = doc.value.theme.layers.at(-1)
    if (last === undefined) throw new Error('expected a layer')
    const layer = {
      alias: 'world.fresh',
      plate: last.plate,
      depth: last.depth,
      sink: last.sink,
      extend: 'none',
    } as const
    const text = print(base, insertElement(doc, 'theme.layers', doc.value.theme.layers.length, layer, 'n1'))
    const layers = scanBlocks(splitLines(text).lines).filter((block) => block.name === 'theme.layers')
    const lines = splitLines(text).lines
    expect(layers).toHaveLength(doc.value.theme.layers.length + 1)
    expect(lines.slice(layers.at(-1)?.start, (layers.at(-1)?.last ?? 0) + 1)).toEqual(
      elementTable('theme.layers', layer),
    )
    expect(lines[(layers.at(-2)?.last ?? 0) + 1]).toBe('')
  })

  it('removes a course and keeps the paragraph that stands between it and the theme', () => {
    const phrases = ['teach', 'combine', 'recover', 'finish'].map(
      (name, i) =>
        `[[course.phrases]]\nname = "${name}"\nfromFloor = ${1 + i * 5}\ntoFloor = ${5 + i * 5}\npurpose = "${name}."`,
    )
    const base = [
      'id = "tiny"',
      'displayName = "Tiny"',
      'platformAlias = "world.platform"',
      '',
      '[courseTuning]',
      '',
      '# The course.',
      '[course]',
      'seed = 1',
      '',
      ...phrases.flatMap((phrase) => [phrase, '']),
      '# Floating: about the theme below.',
      '',
      '[theme]',
      'backdropAlias = "world.sky"',
      '',
      '[[theme.layers]]',
      'alias = "world.sky"',
      'plate = "sky"',
      'depth = 0.1',
      'sink = 0',
      'extend = "plate"',
      '',
    ].join('\n')
    const text = print(base, removeCourse(documentOf(base)))
    expect(text).toBe(
      MINIMAL_STAGE.replace(
        '[courseTuning]\n\n[theme]',
        '[courseTuning]\n\n# Floating: about the theme below.\n\n[theme]',
      ),
    )
  })

  it('puts a new course before the theme when the tunables are not a table of their own', () => {
    const base = MINIMAL_STAGE.replace('[courseTuning]\n\n', '').replace(
      'platformAlias = "world.platform"\n',
      'platformAlias = "world.platform"\ncourseTuning = {}\n',
    )
    const course = {
      seed: 2,
      phrases: ['teach', 'combine', 'recover', 'finish'].map((name, i) => ({
        name,
        fromFloor: 1 + i * 5,
        toFloor: 5 + i * 5,
        purpose: 'x',
      })),
    }
    const text = print(base, setAt(documentOf(base), ['course'], course))
    const names = scanBlocks(splitLines(text).lines).map((block) => block.name)
    expect(names).toEqual([
      'course',
      'course.phrases',
      'course.phrases',
      'course.phrases',
      'course.phrases',
      'theme',
      'theme.layers',
    ])
  })

  it('appends a new course to a stage that has no table at all', () => {
    const base = [
      'id = "tiny"',
      'displayName = "Tiny"',
      'platformAlias = "world.platform"',
      'courseTuning = {}',
      'theme = { backdropAlias = "world.sky", layers = [{ alias = "world.sky", plate = "sky", depth = 0.1, sink = 0, extend = "plate" }] }',
      '',
    ].join('\n')
    const course = {
      seed: 2,
      phrases: ['teach', 'combine', 'recover', 'finish'].map((name, i) => ({
        name,
        fromFloor: 1 + i * 5,
        toFloor: 5 + i * 5,
        purpose: 'x',
      })),
    }
    const text = print(base, setAt(documentOf(base), ['course'], course))
    expect(text.startsWith(`${base}\n[course]\nseed = 2\n\n[[course.phrases]]\nname = "teach"`)).toBe(true)
  })

  it('leaves a list that the text writes as an inline array to the library', () => {
    const base = [
      'id = "tiny"',
      'displayName = "Tiny"',
      'platformAlias = "world.platform"',
      '',
      '[courseTuning]',
      '',
      '[theme]',
      'backdropAlias = "world.sky"',
      'layers = [{ alias = "world.sky", plate = "sky", depth = 0.1, sink = 0, extend = "plate" }]',
      '',
    ].join('\n')
    const doc = insertElement(documentOf(base), 'theme.layers', 1, newLayer, 'n1')
    const text = print(base, doc)
    expect(text).not.toContain('[[theme.layers]]')
    expect(text).toContain('layers = [{ alias = "world.sky"')
  })
})
