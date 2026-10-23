// ED3-o: what a patch refuses, and that a refusal carries no text a caller could save by mistake. Four reasons
// (spec §4.5): a value that cannot be written, text that is not JSON, a `before` that is not what the text holds, and
// a result that does not read as the new model.
import { describe, expect, it } from 'vitest'
import { loadFixture } from '../testing/fixtures'
import { type PatchRules, patchJson, verifyPatched } from './patch'
import { insertElement, replaceValue } from './structure'

const RULES: PatchRules = { idArrays: ['rooms'], memberOrder: () => undefined }
const TEXT =
  '{\n  "rooms": [\n    { "id": "a", "ceiling": 3, "corners": [[0, 0], [4, 0], [4, 4]] }\n  ],\n  "b": [1, 2]\n}\n'
const MODEL = JSON.parse(TEXT)

const edited = (edit: (model: typeof MODEL) => void) => {
  const after = structuredClone(MODEL)
  edit(after)
  return after
}

describe('unwritable-value', () => {
  for (const [name, value] of [
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['1e22, which needs an exponent', 1e22],
  ] as const) {
    it(`${name} refuses with the path of the value, and no text`, () => {
      const result = patchJson(
        TEXT,
        MODEL,
        edited((m) => {
          m.b[1] = value
        }),
        RULES,
      )
      expect(result).toMatchObject({ ok: false, path: ['b', 1], reason: 'unwritable-value' })
      expect(result).not.toHaveProperty('text')
    })
  }

  it('names the path inside a value that is being inserted', () => {
    const result = patchJson(
      TEXT,
      MODEL,
      edited((m) => {
        m.rooms[0].corners.push([5, Number.NaN])
      }),
      RULES,
    )
    expect(result).toMatchObject({
      ok: false,
      path: ['rooms', 0, 'corners', 3, 1],
      reason: 'unwritable-value',
    })
  })

  it('refuses a value that is not JSON at all', () => {
    const result = patchJson(TEXT, MODEL, { ...MODEL, b: [1, undefined] }, RULES)
    expect(result).toMatchObject({ ok: false, path: ['b', 1], reason: 'unwritable-value' })
  })

  it('writes 0.12345 as 0.1235 and 0.1 + 0.2 as 0.3, and the check reads the file against the rounded model', () => {
    const result = patchJson(
      TEXT,
      MODEL,
      edited((m) => {
        m.rooms[0].ceiling = 0.12345
        m.b[0] = 0.1 + 0.2
      }),
      RULES,
    )
    expect(result.ok && JSON.parse(result.text).rooms[0].ceiling).toBe(0.1235)
    expect(result.ok && JSON.parse(result.text).b[0]).toBe(0.3)
  })
})

describe('invalid-text', () => {
  it('refuses a text with a trailing comma and says where', () => {
    const text = '{ "a": [1,] }'
    const result = patchJson(text, { a: [1] }, { a: [1, 2] }, RULES)
    expect(result).toMatchObject({ ok: false, path: [], reason: 'invalid-text' })
    expect(!result.ok && result.detail).toContain(`at ${text.indexOf(']')}`)
    expect(result).not.toHaveProperty('text')
  })

  it('refuses a duplicate key in one object, which a path could not name', () => {
    const result = patchJson('{ "a": 1, "a": 2 }', { a: 2 }, { a: 3 }, RULES)
    expect(result).toMatchObject({ ok: false, reason: 'invalid-text' })
    expect(!result.ok && result.detail).toContain('duplicate key "a"')
  })
})

describe('before-mismatch', () => {
  it('refuses a before that is not what the text parses to, at the first differing path', () => {
    const before = edited((m) => {
      m.rooms[0].ceiling = 4
      m.b[1] = 9
    })
    const result = patchJson(
      TEXT,
      before,
      edited((m) => (m.b[0] = 7)),
      RULES,
    )
    expect(result).toMatchObject({ ok: false, path: ['rooms', 0, 'ceiling'], reason: 'before-mismatch' })
    expect(result).not.toHaveProperty('text')
  })

  it('catches a member the text has and the model does not, and a different array length', () => {
    const fewer = patchJson(
      TEXT,
      edited((m) => m.b.pop()),
      MODEL,
      RULES,
    )
    expect(fewer).toMatchObject({ ok: false, path: ['b'], reason: 'before-mismatch' })
    const fewerKeys = patchJson(TEXT, { rooms: MODEL.rooms }, MODEL, RULES)
    expect(fewerKeys).toMatchObject({ ok: false, path: ['b'], reason: 'before-mismatch' })
  })

  it('is the case a stale model produces: a file edited on disk since the model was read', () => {
    const onDisk = TEXT.replace('"ceiling": 3', '"ceiling": 3.5')
    const result = patchJson(
      onDisk,
      MODEL,
      edited((m) => (m.b[0] = 7)),
      RULES,
    )
    expect(result).toMatchObject({ ok: false, path: ['rooms', 0, 'ceiling'], reason: 'before-mismatch' })
  })
})

describe('verify-failed', () => {
  it('refuses text that does not parse to the new model, at the first differing path', () => {
    const after = edited((m) => {
      m.rooms[0].ceiling = 5.1
      m.b[0] = 8
    })
    // A wrong edit set, built by hand: it changes the ceiling to 5 instead of 5.1.
    const wrong = replaceValue(replaceValue(TEXT, ['rooms', 0, 'ceiling'], 5), ['b', 0], 8)
    const result = verifyPatched(wrong, after)
    expect(result).toMatchObject({ ok: false, path: ['rooms', 0, 'ceiling'], reason: 'verify-failed' })
    expect(result).not.toHaveProperty('text')
  })

  it('refuses an edit that added an element nobody asked for', () => {
    const extra = insertElement(TEXT, ['b'], 3)
    expect(verifyPatched(extra, MODEL)).toMatchObject({ ok: false, path: ['b'], reason: 'verify-failed' })
  })

  it('refuses text that is not JSON', () => {
    expect(verifyPatched('{ "b": [1, 2,] }', MODEL)).toMatchObject({
      ok: false,
      path: [],
      reason: 'verify-failed',
    })
  })

  it('accepts text that reads as the new model with its numbers rounded the way the file writes them', () => {
    const rounded = TEXT.replace('"ceiling": 3', '"ceiling": 0.1235')
    expect(
      verifyPatched(
        rounded,
        edited((m) => (m.rooms[0].ceiling = 0.12345)),
      ),
    ).toStrictEqual({
      ok: true,
      text: rounded,
    })
    expect(verifyPatched(TEXT, MODEL)).toStrictEqual({ ok: true, text: TEXT })
  })

  it('passes every real patch it is asked to make (shipped file, several rooms changed)', () => {
    const text = loadFixture('blockout-clinic')
    const before = JSON.parse(text)
    const after = structuredClone(before)
    after.rooms[0].ceiling = 5.1
    after.rooms[1].light = 1.35
    expect(patchJson(text, before, after, { ...RULES, idArrays: ['rooms'] })).toMatchObject({ ok: true })
  })
})
