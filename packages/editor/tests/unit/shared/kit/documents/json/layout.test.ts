// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { indentAt, readLayout } from '#src/shared/kit/documents/json/layout.ts'
import { FIXTURE_NAMES, type FixtureName, loadFixture } from '#src/shared/kit/documents/testing/fixtures.ts'

describe('readLayout', () => {
  const expected: Record<FixtureName, { expandsEverything: boolean; bracesSpaced: boolean }> = {
    // Hand-formatted, inline objects with a space inside the braces.
    'blockout-clinic': { expandsEverything: false, bracesSpaced: true },
    // JSON.stringify(…, 2) style: every array on one number per line, no inline objects at all.
    'blockout-clinic-dawn': { expandsEverything: true, bracesSpaced: true },
    // Hand-formatted, inline objects tight against the braces.
    'blockout-bay': { expandsEverything: false, bracesSpaced: false },
    'blockout-prologue': { expandsEverything: false, bracesSpaced: true },
    facility: { expandsEverything: false, bracesSpaced: true },
  }
  for (const name of FIXTURE_NAMES) {
    it(`${name}: two-space indent and the layout its author used`, () => {
      expect(readLayout(loadFixture(name))).toEqual({ unit: '  ', ...expected[name] })
    })
  }

  it('reads tabs, four spaces and a file with no indentation', () => {
    expect(readLayout('{\n\t"a": {\n\t\t"b": 1\n\t}\n}').unit).toBe('\t')
    expect(readLayout('{\n    "a": {\n        "b": 1\n    }\n}').unit).toBe('    ')
    expect(readLayout('{"a":{"b":1}}')).toEqual({ unit: '  ', expandsEverything: false, bracesSpaced: false })
  })

  it('says a file expands everything only when short number arrays take a line per number', () => {
    expect(readLayout('{\n  "p": [\n    1,\n    2\n  ]\n}').expandsEverything).toBe(true)
    expect(readLayout('{\n  "p": [1, 2]\n}').expandsEverything).toBe(false)
  })
})

describe('indentAt', () => {
  it('is the indentation of the line a position is on', () => {
    const text = '{\n  "a": {\n    "b": 1\n  }\n}'
    expect(indentAt(text, text.indexOf('"b"'))).toBe('    ')
    expect(indentAt(text, text.indexOf('"a"'))).toBe('  ')
    expect(indentAt(text, 0)).toBe('')
  })
})
