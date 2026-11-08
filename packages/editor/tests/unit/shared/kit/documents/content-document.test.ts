// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  type ContentDocument,
  DocumentSyntaxError,
  type EditResult,
  openDocument,
} from '#src/shared/kit/documents/content-document.ts'
import type { KeyPath } from '#src/shared/kit/documents/key-path.ts'
import { DOCUMENT_FIXTURES, loadDocumentFixture } from '#src/shared/kit/documents/testing/fixtures.ts'

const TUNING = loadDocumentFixture('platformer-tuning.toml')
const JUICE = loadDocumentFixture('platformer-juice.toml')
const FLOW = loadDocumentFixture('af-flow.toml')
const MESSAGES = loadDocumentFixture('af-messages-fr.json')

function edited(result: EditResult): ContentDocument & { changed: readonly (readonly [number, number])[] } {
  if (!result.ok)
    throw new Error(`refused at ${JSON.stringify(result.keyPath)}: ${result.reason} ${result.message}`)
  return Object.assign(result.document, { changed: result.changed })
}

/** The value at a key path of a parsed value. */
function valueAt(value: unknown, keyPath: KeyPath): unknown {
  let at = value
  for (const key of keyPath) at = (at as Record<string | number, unknown>)[key]
  return at
}

/** The one region two texts differ in, by their longest common prefix and suffix. */
function changedRegion(before: string, after: string): readonly [number, number] {
  let prefix = 0
  while (prefix < before.length && before[prefix] === after[prefix]) prefix++
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++
  return [prefix, after.length - suffix]
}

describe('openDocument', () => {
  for (const name of DOCUMENT_FIXTURES) {
    it(`${name}: unchanged prints byte for byte, and every literal slices to its text`, () => {
      const text = loadDocumentFixture(name)
      const document = openDocument(`content/${name}`, text)
      expect(document.format).toBe(name.endsWith('.toml') ? 'toml' : 'json')
      expect(document.text).toBe(text)
      const literals = document.literals()
      expect(literals.length).toBeGreaterThan(0)
      for (const literal of literals) expect(text.slice(...literal.span)).toBe(literal.text)
      expect(edited(document.edit([])).text).toBe(text)
      const first = literals[0] as (typeof literals)[number]
      const same = valueAt(document.value(), first.keyPath)
      expect(edited(document.edit([{ keyPath: first.keyPath, expected: same, set: same }]))).toMatchObject({
        text,
        changed: [],
      })
    })

    it(`${name}: a value edit changes only its literal's span`, () => {
      const document = openDocument(`content/${name}`, loadDocumentFixture(name))
      const value = document.value()
      // Up to 25 literals spread through the file: each number moves by 1.5, each string gains a word.
      const literals = document.literals()
      const step = Math.max(1, Math.floor(literals.length / 25))
      for (let index = 0; index < literals.length; index += step) {
        const literal = literals[index] as (typeof literals)[number]
        const current = valueAt(value, literal.keyPath)
        if (typeof current !== 'number' && typeof current !== 'string') continue
        const next = typeof current === 'number' ? current + 1.5 : `${current} encore`
        const after = edited(document.edit([{ keyPath: literal.keyPath, expected: current, set: next }]))
        expect(after.changed, JSON.stringify(literal.keyPath)).toHaveLength(1)
        const [start, end] = after.changed[0] as readonly [number, number]
        expect(start, 'the span starts where the literal did').toBe(literal.span[0])
        const [from, to] = changedRegion(document.text, after.text)
        expect(from).toBeGreaterThanOrEqual(start)
        expect(to).toBeLessThanOrEqual(end)
        expect(
          document.text.slice(0, start) + after.text.slice(start, end) + document.text.slice(literal.span[1]),
        ).toBe(after.text)
        // A new number reads back as exactly that number.
        expect(valueAt(after.value(), literal.keyPath)).toBe(next)
      }
    })
  }

  it("EDS-a, EDS-b: the platformer's tuning.toml round-trips, and MAX_MOVE_SPEED's edit is that number's span", () => {
    const document = openDocument('content/tuning.toml', TUNING)
    expect(edited(document.edit([])).text).toBe(TUNING)
    const after = edited(document.edit([{ keyPath: ['MAX_MOVE_SPEED'], expected: 356, set: 400 }]))
    const start = TUNING.indexOf('356.0')
    expect(after.changed).toEqual([[start, start + '400.0'.length]])
    expect(after.text).toBe(TUNING.replace('MAX_MOVE_SPEED = 356.0', 'MAX_MOVE_SPEED = 400.0'))
  })

  it("gives the Tuner's notes from TOML comments, and none for JSON", () => {
    expect(openDocument('content/tuning.toml', TUNING).comments(['LAP_HOLD_TICKS'])).toEqual({
      before: 'Ticks a racer rests at the spawn after a non-final lap (0.8 s at 60 Hz).',
    })
    expect(openDocument('content/juice.toml', JUICE).comments(['words', 'size'])).toEqual({
      trailing: "the local racer's words, in world units",
    })
    expect(
      openDocument('messages/fr.json', MESSAGES).comments(['content_character_cyan_display_name']),
    ).toEqual({})
  })

  it('refuses a value edit whose expected value is not what the document holds, writing nothing', () => {
    const document = openDocument('content/tuning.toml', TUNING)
    expect(document.edit([{ keyPath: ['MAX_MOVE_SPEED'], expected: 300, set: 400 }])).toMatchObject({
      ok: false,
      keyPath: ['MAX_MOVE_SPEED'],
      reason: 'expected-mismatch',
    })
    expect(document.edit([{ keyPath: ['NOT_A_TUNABLE'], expected: 1, set: 2 }])).toMatchObject({
      ok: false,
      reason: 'expected-mismatch',
    })
    expect(document.text).toBe(TUNING)
  })

  it('refuses a value it cannot write', () => {
    const document = openDocument('content/tuning.toml', TUNING)
    expect(document.edit([{ keyPath: ['GRAVITY'], expected: -275, set: Number.NaN }])).toMatchObject({
      ok: false,
      keyPath: ['GRAVITY'],
      reason: 'unwritable-value',
    })
  })

  it('applies several edits in order, or none of them', () => {
    const document = openDocument('content/tuning.toml', TUNING)
    const both = edited(
      document.edit([
        { keyPath: ['GRAVITY'], expected: -275, set: -300.12345 },
        { keyPath: ['MAX_MOVE_SPEED'], expected: 356, set: 400 },
      ]),
    )
    expect(both.text).toBe(
      TUNING.replace('GRAVITY = -275.0', 'GRAVITY = -300.12345').replace('= 356.0', '= 400.0'),
    )
    expect(both.changed.map(([start, end]) => both.text.slice(start, end))).toEqual(['-300.12345', '400.0'])
    const refused = document.edit([
      { keyPath: ['GRAVITY'], expected: -275, set: -300.12345 },
      { keyPath: ['MAX_MOVE_SPEED'], expected: 1, set: 400 },
    ])
    expect(refused).toMatchObject({ ok: false, keyPath: ['MAX_MOVE_SPEED'], reason: 'expected-mismatch' })
    expect(document.text).toBe(TUNING)
  })

  it('a later edit starts from the text the earlier one wrote, in TOML and in JSON', () => {
    for (const [path, text] of [
      ['values.toml', 'a = 1.5\nb = 2\n'],
      ['values.json', '{\n  "a": 1.5,\n  "b": 2\n}\n'],
    ] as const) {
      const after = edited(
        openDocument(path, text).edit([
          { keyPath: ['a'], expected: 1.5, set: 0.123456 },
          { keyPath: ['b'], expected: 2, set: 3 },
        ]),
      )
      const value = after.value() as { a: number; b: number }
      expect(value.b, path).toBe(3)
      expect(after.changed, path).toHaveLength(2)
    }
  })

  it('numbers round-trip exactly in TOML and in JSON: 128.57142857142856 and 0.00001', () => {
    for (const [path, text] of [
      ['values.toml', 'a = 1.5\nb = 2.0\n'],
      ['values.json', '{\n  "a": 1.5,\n  "b": 2\n}\n'],
    ] as const) {
      const after = edited(
        openDocument(path, text).edit([
          { keyPath: ['a'], expected: 1.5, set: 540 / 4.2 },
          { keyPath: ['b'], expected: 2, set: 0.00001 },
        ]),
      )
      expect(after.value(), path).toEqual({ a: 128.57142857142856, b: 0.00001 })
      expect(after.text, path).toContain('128.57142857142856')
      // Inserted numbers too.
      const inserted = edited(after.edit([{ keyPath: ['c'], insert: [0.123456789, 1e-7] }]))
      expect((inserted.value() as { c: unknown }).c, path).toEqual([0.123456789, 1e-7])
    }
  })

  it('edits a key of a TOML document that holds nan and inf elsewhere, leaving them as written', () => {
    const text = 'x = nan\ny = 1\nz = [inf, -inf]\n'
    const after = edited(openDocument('values.toml', text).edit([{ keyPath: ['y'], expected: 1, set: 2 }]))
    expect(after.text).toBe('x = nan\ny = 2\nz = [inf, -inf]\n')
  })

  it('TOML: inserts a key in its table and an array table at an index, laid out like their siblings, and removes them', () => {
    const juice = openDocument('content/juice.toml', JUICE)
    const withKey = edited(juice.edit([{ keyPath: ['lean', 'minDeg'], insert: 2 }]))
    expect(withKey.text).toBe(JUICE.replace('stepDeg = 3\n', 'stepDeg = 3\nminDeg = 2\n'))
    expect(withKey.changed.map(([start, end]) => withKey.text.slice(start, end).trim())).toEqual([
      'minDeg = 2',
    ])
    expect(edited(withKey.edit([{ keyPath: ['lean', 'minDeg'], remove: true }])).text).toBe(JUICE)

    const flow = openDocument('content/flow.toml', FLOW)
    const transition = { from: 'Lobby', event: 'quit', to: 'MainMenu' }
    const appended = edited(flow.edit([{ keyPath: ['transitions'], insert: transition }]))
    expect(valueAt(appended.value(), ['transitions'])).toContainEqual(transition)
    expect(appended.text).toContain('\n\n[[transitions]]\nfrom = "Lobby"\nevent = "quit"\nto = "MainMenu"\n')
    const last = (valueAt(appended.value(), ['transitions']) as unknown[]).length - 1
    expect(edited(appended.edit([{ keyPath: ['transitions', last], remove: true }])).value()).toEqual(
      flow.value(),
    )
  })

  it('JSON: inserts a member and an element laid out like their siblings, and removes them', () => {
    const messages = openDocument('messages/fr.json', MESSAGES)
    const withMember = edited(messages.edit([{ keyPath: ['content_x_title'], insert: 'Titre' }]))
    expect(withMember.text).toMatch(/,\n {2}"content_x_title": "Titre"\n\}\n$/)
    expect(edited(withMember.edit([{ keyPath: ['content_x_title'], remove: true }])).text).toBe(MESSAGES)

    const text = '{\n  "ids": ["a", "c"],\n  "n": 1\n}\n'
    const list = openDocument('list.json', text)
    const inserted = edited(list.edit([{ keyPath: ['ids'], insert: 'b', at: 1 }]))
    expect(inserted.text).toBe('{\n  "ids": ["a", "b", "c"],\n  "n": 1\n}\n')
    expect(edited(inserted.edit([{ keyPath: ['ids', 1], remove: true }])).text).toBe(text)
  })

  it('refuses an insert where a value already is, past the end of an array, and a remove of nothing', () => {
    const juice = openDocument('content/juice.toml', JUICE)
    expect(juice.edit([{ keyPath: ['lean', 'maxDeg'], insert: 1 }])).toMatchObject({
      ok: false,
      reason: 'expected-mismatch',
    })
    expect(juice.edit([{ keyPath: ['nowhere', 'x'], insert: 1 }])).toMatchObject({
      ok: false,
      reason: 'expected-mismatch',
    })
    const flow = openDocument('content/flow.toml', FLOW)
    expect(flow.edit([{ keyPath: ['transitions'], insert: {}, at: 999 }])).toMatchObject({
      ok: false,
      reason: 'unwritable-value',
    })
    expect(juice.edit([{ keyPath: ['lean', 'nothing'], remove: true }])).toMatchObject({
      ok: false,
      reason: 'expected-mismatch',
    })
  })

  it('opens a text that does not parse, which reads as a syntax error and refuses every edit', () => {
    const broken = openDocument('content/tuning.toml', 'GRAVITY = = 1\n')
    expect(() => broken.value()).toThrow(DocumentSyntaxError)
    expect(() => broken.literals()).toThrow(DocumentSyntaxError)
    expect(() => broken.comments(['GRAVITY'])).toThrow(DocumentSyntaxError)
    expect(() => broken.value()).toThrow(expect.objectContaining({ line: 1 }))
    expect(broken.edit([{ keyPath: ['GRAVITY'], expected: 1, set: 2 }])).toMatchObject({
      ok: false,
      keyPath: [],
      reason: 'invalid-text',
    })
    const json = openDocument('messages/fr.json', '{\n  "a": 1,\n}\n')
    expect(() => json.value()).toThrow(DocumentSyntaxError)
    expect(json.edit([])).toMatchObject({ ok: false, reason: 'invalid-text' })
  })

  it('knows TOML and JSON by the extension, and no other format', () => {
    expect(openDocument('content/GAME.TOML', 'a = 1\n').format).toBe('toml')
    expect(() => openDocument('content/notes.yaml', 'a: 1\n')).toThrow(/toml or \.json/)
  })
})
