// @vitest-environment node
// The span-preserving insert and remove cases of the adventure source editor/tests/level-edits.test.ts, run on the
// ported structure edits and the new scanner.
import { describe, expect, it } from 'vitest'
import { scan } from '#src/shared/kit/documents/json/locate.ts'
import {
  insertElement,
  insertMember,
  JsonShapeError,
  removeElement,
  removeMember,
  replaceValue,
  setMember,
} from '#src/shared/kit/documents/json/structure.ts'
import { FIXTURE_NAMES, loadFixture } from '#src/shared/kit/documents/testing/fixtures.ts'

const SCENES = ['blockout-clinic', 'blockout-clinic-dawn', 'blockout-bay', 'blockout-prologue'] as const

/** The text `after` is `before` with one run of characters inserted (nothing else moved). */
function pureInsert(before: string, after: string): string {
  let prefix = 0
  while (prefix < before.length && before[prefix] === after[prefix]) prefix++
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++
  expect(prefix + suffix, 'every byte of the old text survives around one insert').toBe(before.length)
  return after.slice(prefix, after.length - suffix)
}

describe('span-preserving JSON inserts and removals on the shipped blockouts', () => {
  for (const scene of SCENES) {
    it(`${scene}: appends to each list as a pure insert, in the file's own layout, and removes it again byte for byte`, () => {
      const text = loadFixture(scene)
      const model = JSON.parse(text)
      for (const list of ['rooms', 'boxes', 'hotspots', 'lamps']) {
        const items = model[list] as { id: string }[]
        const sample = items[items.length - 1] as { id: string }
        const copy = { ...structuredClone(sample), id: `${sample.id}Copy` }
        const after = insertElement(text, [list], copy)
        const added = pureInsert(text, after)
        expect(JSON.parse(after)[list].at(-1)).toEqual(copy)
        // Written like its neighbour: on one line if the neighbour is, over several if it isn't.
        const neighbour = scan(text).node([list, items.length - 1])?.span
        expect(neighbour).toBeDefined()
        expect(added.replace(/^,\s*/, '').includes('\n')).toBe(
          text.slice(neighbour?.start, neighbour?.end).includes('\n'),
        )
        expect(removeElement(after, [list], items.length)).toBe(text)
      }
    })
  }

  it('inserts in the middle, removes the first and the last element, and keeps `[]` round trips', () => {
    const text = '{\n  "a": [1, 2, 3],\n  "b": [\n    { "x": 1 },\n    { "x": 2 }\n  ],\n  "c": []\n}\n'
    expect(insertElement(text, ['a'], 9, 1)).toBe(text.replace('[1, 2, 3]', '[1, 9, 2, 3]'))
    expect(insertElement(text, ['a'], 0, 0)).toBe(text.replace('[1, 2, 3]', '[0, 1, 2, 3]'))
    expect(insertElement(text, ['b'], { x: 3 })).toBe(
      text.replace('{ "x": 2 }\n', '{ "x": 2 },\n    { "x": 3 }\n'),
    )
    expect(removeElement(text, ['a'], 0)).toBe(text.replace('[1, 2, 3]', '[2, 3]'))
    expect(removeElement(text, ['a'], 2)).toBe(text.replace('[1, 2, 3]', '[1, 2]'))
    const one = insertElement(text, ['c'], 5)
    expect(JSON.parse(one).c).toEqual([5])
    expect(removeElement(one, ['c'], 0)).toBe(text)
  })

  it("adds members by the schema's order, packs them on the neighbour's line when it fits, and refuses a duplicate", () => {
    const text =
      '{\n  "room": {\n    "id": "a", "zone": "z", "light": 1,\n    "corners": [[0, 0], [1, 0], [1, 1]]\n  }\n}\n'
    const styled = insertMember(text, ['room'], 'style', 'YARD', { before: ['corners'] })
    expect(styled).toBe(text.replace('"light": 1,', '"light": 1, "style": "YARD",'))
    expect(removeMember(styled, ['room'], 'style')).toBe(text)
    expect(() => insertMember(text, ['room'], 'id', 'b')).toThrow(/already has "id"/)
    expect(setMember(styled, ['room'], 'style', 'COLD')).toBe(styled.replace('"YARD"', '"COLD"'))
    expect(replaceValue(text, ['room', 'corners', 2], [1, 1, 'west'])).toBe(
      text.replace('[1, 1]]', '[1, 1, "west"]]'),
    )
  })

  it('refuses a path that is not there or not a container', () => {
    const text = loadFixture('blockout-clinic')
    expect(() => insertElement(text, ['nope'], 1)).toThrow(/does not exist/)
    expect(() => insertElement(text, ['scene'], 1)).toThrow(/not an array/)
    expect(() => removeElement(text, ['rooms'], 99)).toThrow(/does not exist/)
    expect(() => removeMember(text, ['spawn'], 'nope')).toThrow(/does not exist/)
    expect(() => insertElement(text, ['rooms'], 1, 99)).toThrow(JsonShapeError)
  })

  it('checks what it wrote against the number as written: float noise is trimmed, not refused', () => {
    const text = '{\n  "a": [1, 2],\n  "b": 1\n}\n'
    expect(insertElement(text, ['a'], 0.1 + 0.2)).toBe('{\n  "a": [1, 2, 0.3],\n  "b": 1\n}\n')
    expect(replaceValue(text, ['b'], [0.1 + 0.2, 2.00001])).toBe('{\n  "a": [1, 2],\n  "b": [0.3, 2]\n}\n')
    expect(insertMember(text, [], 'c', { x: 0.30000000000000004 })).toContain('"c": { "x": 0.3 }')
  })

  it('refuses a text that is not JSON, and says why', () => {
    expect(() => insertElement('{ "a": [1,] }', ['a'], 2)).toThrow(/not valid JSON/)
  })

  it('writes the file layouts it meets: tight braces, tabs, and a file that expands everything', () => {
    const tight = '{\n  "xs": [{"a":1}, {"a":2}]\n}\n'
    // the adventure source writes a new object with a space after each colon, but keeps the neighbour's tight braces.
    expect(insertElement(tight, ['xs'], { a: 3 })).toBe(tight.replace('{"a":2}]', '{"a":2}, {"a": 3}]'))
    const tabs = '{\n\t"xs": [\n\t\t{ "a": 1 }\n\t]\n}\n'
    expect(insertElement(tabs, ['xs'], { a: 2 })).toBe(
      tabs.replace('{ "a": 1 }\n', '{ "a": 1 },\n\t\t{ "a": 2 }\n'),
    )
    const expanded = '{\n  "p": [\n    1,\n    2\n  ],\n  "q": []\n}\n'
    expect(insertElement(expanded, ['q'], [3, 4])).toBe(
      expanded.replace('"q": []', '"q": [\n    [\n      3,\n      4\n    ]\n  ]'),
    )
  })

  it('every shipped file survives inserting and removing at every depth it has a list', () => {
    for (const name of FIXTURE_NAMES) {
      const text = loadFixture(name)
      const lists = scan(text)
        .root.children.filter((child) => child.kind === 'array' && child.children.length > 0)
        .map((child) => child.path)
      for (const path of lists) {
        const first = scan(text).node([...path, 0])
        const value = JSON.parse(text.slice(first?.span.start, first?.span.end))
        const inserted = insertElement(text, path, value, 0)
        expect(removeElement(inserted, path, 0), `${name} ${JSON.stringify(path)}`).toBe(text)
      }
    }
  })
})
