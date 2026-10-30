import { parse } from '@decimalturn/toml-patch'
import { describe, expect, it } from 'vitest'
import { stageSchema } from './stage.schema'
import { parseStage, printStage } from './stage-codec'
import { SHIPPED_STAGE_IDS, type ShippedStageId, shippedStage } from './testing/shipped-stages'
import { documentOf, MINIMAL_STAGE, setAt } from './testing/stage-texts'

// Reading a stage file (EDFF.1a step 2): a document for a good text and, for a bad one, every problem with the line
// it is on, so the editor can say where (acceptance G-c: a parse error never replaces the file).

function failure(text: string) {
  const result = parseStage(text)
  if (result.ok) throw new Error('expected the text not to parse')
  return result.error
}

/** The 1-based line of the first line of `text` that starts with `prefix` after `after` has been seen. */
function lineOf(text: string, prefix: string, after = ''): number {
  const lines = text.split('\n')
  const from = after === '' ? 0 : lines.findIndex((line) => line.startsWith(after))
  const found = lines.findIndex((line, index) => index >= from && line.startsWith(prefix))
  if (found < 0) throw new Error(`no line starts with ${prefix}`)
  return found + 1
}

describe('parseStage of a good text', () => {
  it.each(SHIPPED_STAGE_IDS)(
    'opens the shipped stage %s as the value the schema reads',
    (id: ShippedStageId) => {
      const text = shippedStage(id)
      const result = parseStage(text)
      if (!result.ok) throw new Error(JSON.stringify(result.error))
      expect(result.value.value).toEqual(stageSchema.parse(parse(text)))
    },
  )

  it.each(SHIPPED_STAGE_IDS)(
    'numbers the elements of each list of %s b0, b1, … in file order',
    (id: ShippedStageId) => {
      const result = parseStage(shippedStage(id))
      if (!result.ok) throw new Error('expected the stage to parse')
      const { value, ids } = result.value
      const numbers = (count: number): string[] => Array.from({ length: count }, (_, i) => `b${i}`)
      expect(ids.layers).toEqual(numbers(value.theme.layers.length))
      expect(ids.setPieces).toEqual(numbers(value.theme.setPieces.length))
      expect(ids.extension).toEqual(numbers(value.course?.extension?.length ?? 0))
    },
  )

  it('gives a stage with one layer, no set pieces and no course a single id and empty lists otherwise', () => {
    const result = parseStage(MINIMAL_STAGE)
    if (!result.ok) throw new Error('expected the minimal stage to parse')
    expect(result.value.ids).toEqual({ extension: [], layers: ['b0'], setPieces: [] })
    expect(result.value.value.theme.setPieces).toEqual([])
  })

  it('opens a text with Windows line endings and no final newline', () => {
    const text = MINIMAL_STAGE.replace(/\n/g, '\r\n').trimEnd()
    expect(parseStage(text).ok).toBe(true)
  })
})

describe('parseStage of a text that is not TOML', () => {
  it('reports the line and column of a syntax error, counted from 1, and the reason without the library excerpt', () => {
    const errors = failure('id = "x"\nb = ?\n')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ code: 'tomlSyntax', line: 2, column: 5 })
    expect(errors[0]?.message).toBe('Unexpected char "?"')
  })

  it('reports a value that is missing after the equals sign at the key', () => {
    expect(failure('id = \n')[0]).toMatchObject({ code: 'tomlSyntax', line: 1 })
  })

  it('reports a key defined twice at the second definition', () => {
    const errors = failure('id = "a"\nid = "b"\n')
    expect(errors[0]).toMatchObject({ code: 'tomlSyntax', line: 2 })
    expect(errors[0]?.message).toBe('Value already defined for id')
  })

  it('counts the same line for Windows line endings', () => {
    expect(failure('id = "x"\r\nb = ?\r\n')[0]).toMatchObject({ line: 2, column: 5 })
  })

  it('reports a text nested past the parser limit with its message and no position', () => {
    const deep = `a = ${'['.repeat(100_000)}${']'.repeat(100_000)}\n`
    const errors = failure(deep)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ code: 'tomlSyntax', message: 'Maximum call stack size exceeded' })
    expect(errors[0]?.line).toBeUndefined()
    expect(errors[0]?.column).toBeUndefined()
  })

  it('reports an unterminated string on its line', () => {
    expect(failure('id = "x\n')[0]).toMatchObject({ code: 'tomlSyntax', line: 1 })
  })
})

describe('parseStage of a TOML text that is not a stage', () => {
  it('reports every missing key of an empty text at line 1, each with its path', () => {
    const errors = failure('')
    expect(errors.map((e) => e.path).sort()).toEqual([
      'courseTuning',
      'displayName',
      'id',
      'platformAlias',
      'theme',
    ])
    expect(errors.every((e) => e.line === 1)).toBe(true)
  })

  it('reports a value out of range with the path of the value and the line of its key', () => {
    const text = shippedStage('rooftops')
    const bad = text.replace(/^sink = -?\d+/m, 'sink = 5000')
    const errors = failure(bad)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ path: 'theme.layers[0].sink', line: lineOf(bad, 'sink = 5000') })
    expect(errors[0]?.message).toMatch(/1440/)
  })

  it('addresses an element of a list by its index and finds the key in that element', () => {
    const text = shippedStage('rooftops')
    // Break the third layer's depth only.
    const lines = text.split('\n')
    const depthLines = lines.flatMap((line, index) => (line.startsWith('depth = ') ? [index] : []))
    const at = depthLines[2] ?? 0
    lines[at] = 'depth = 4'
    const errors = failure(lines.join('\n'))
    expect(errors[0]).toMatchObject({ path: 'theme.layers[2].depth', line: at + 1 })
  })

  it('points a missing key at the header of the table that should hold it', () => {
    const text = MINIMAL_STAGE.replace('plate = "sky"\n', '')
    const errors = failure(text)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ path: 'theme.layers[0].plate', line: lineOf(text, '[[theme.layers]]') })
  })

  it('reports every problem, not only the first', () => {
    const text = MINIMAL_STAGE.replace('depth = 0.1', 'depth = 7').replace('sink = 0', 'sink = -9999')
    const errors = failure(text)
    expect(errors.map((e) => e.path).sort()).toEqual(['theme.layers[0].depth', 'theme.layers[0].sink'])
  })

  it('reports an unknown key at its own line, one error for each key', () => {
    const text = MINIMAL_STAGE.replace(
      'platformAlias = "world.platform"\n',
      'platformAlias = "world.platform"\nflavour = "sweet"\nmood = 4\n',
    )
    const errors = failure(text)
    expect(errors.map((e) => ({ path: e.path, line: e.line }))).toEqual([
      { path: 'flavour', line: lineOf(text, 'flavour') },
      { path: 'mood', line: lineOf(text, 'mood') },
    ])
    expect(errors[0]?.code).toBe('unrecognized_keys')
    expect(errors.map((e) => e.message)).toEqual(['Unrecognized key: "flavour"', 'Unrecognized key: "mood"'])
  })

  it('finds an unknown key inside an element of a list', () => {
    const text = MINIMAL_STAGE.replace('depth = 0.1\n', 'depth = 0.1\nwobble = 1\n')
    expect(failure(text)[0]).toMatchObject({ path: 'theme.layers[0].wobble', line: lineOf(text, 'wobble') })
  })

  it('reports a value of the wrong type with the key of that value', () => {
    const text = MINIMAL_STAGE.replace('displayName = "Tiny"', 'displayName = 12')
    expect(failure(text)[0]).toMatchObject({ path: 'displayName', line: lineOf(text, 'displayName') })
  })

  it('reports a rule across values at the key the rule names', () => {
    const text = MINIMAL_STAGE.replace('plate = "sky"', 'plate = "city"')
    const errors = failure(text)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ path: 'theme.layers[0].extend', line: lineOf(text, 'extend = ') })
    expect(errors[0]?.message).toMatch(/sky picture/)
  })

  it('counts lines the same for Windows line endings', () => {
    const text = MINIMAL_STAGE.replace('sink = 0', 'sink = 5000')
    const unix = failure(text)
    const windows = failure(text.replace(/\n/g, '\r\n'))
    expect(windows.map((e) => e.line)).toEqual(unix.map((e) => e.line))
  })
})

// -- printing --------------------------------------------------------------------------------------------------------

const VARIANTS: readonly [string, (text: string) => string][] = [
  ['unchanged', (text) => text],
  ['with Windows line endings', (text) => text.replace(/\n/g, '\r\n')],
  ['without a final newline', (text) => text.trimEnd()],
  ['with Windows line endings and no final newline', (text) => text.replace(/\n/g, '\r\n').trimEnd()],
]

describe('printStage of an unchanged document', () => {
  for (const [variant, change] of VARIANTS) {
    it.each(SHIPPED_STAGE_IDS)(
      `prints the shipped stage %s ${variant} byte for byte`,
      (id: ShippedStageId) => {
        const text = change(shippedStage(id))
        expect(printStage(text, documentOf(text))).toBe(text)
      },
    )
  }

  it('prints a stage with no set pieces and no course without adding keys for them', () => {
    expect(printStage(MINIMAL_STAGE, documentOf(MINIMAL_STAGE))).toBe(MINIMAL_STAGE)
  })

  it('keeps an empty list the file wrote out', () => {
    const text = MINIMAL_STAGE.replace('[[theme.layers]]', 'setPieces = []\n\n[[theme.layers]]')
    expect(printStage(text, documentOf(text))).toBe(text)
  })

  it('throws for a base that is not the text the document came from, which is a bug in the caller', () => {
    expect(() => printStage('id = ', documentOf(MINIMAL_STAGE))).toThrow()
  })
})

// EDS.1a: the value step goes through the kit's content documents (`patchToml`), so a value edit is its literal's span
// alone, written by the kit's number rule.
describe('printStage of a value edit', () => {
  it("writes a changed number into its literal's span only, and a float stays a float", () => {
    const text = shippedStage('dawn')
    const printed = printStage(text, setAt(documentOf(text), ['theme', 'layers', 1, 'depth'], 1))
    const start = text.indexOf('depth = 0.15') + 'depth = '.length
    expect(printed).toBe(`${text.slice(0, start)}1.0${text.slice(start + '0.15'.length)}`)
  })
})
