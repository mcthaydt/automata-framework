// The objective line: nine sentences in the old game, one ordered list in a file here. The first row whose conditions
// all hold is the line, and the row may name a place to walk to.
import type { Reader } from '@automataframework/puzzle/sim'
import { describe, expect, it } from 'vitest'
import { chooseObjective, type ObjectiveRow } from '#src/entries/index.ts'

const rows: readonly ObjectiveRow[] = [
  { when: [{ fact: 'out', is: true }], line: 'objective.done' },
  { when: [{ has: 'key' }], line: 'objective.door', target: 'door' },
  { when: [], line: 'objective.look', target: 'desk' },
]
const reader = (facts: Record<string, boolean>, items: string[] = []): Reader => ({
  fact: (name) => facts[name],
  has: (item) => items.includes(item),
})

describe('chooseObjective', () => {
  it('takes the first row whose conditions all hold', () => {
    expect(chooseObjective(rows, reader({}, ['key']))).toBe(rows[1])
    expect(chooseObjective(rows, reader({ out: true }, ['key']))).toBe(rows[0])
  })

  it('falls through to a row with no conditions', () => {
    expect(chooseObjective(rows, reader({}))?.line).toBe('objective.look')
  })

  it('gives nothing when no row holds', () => {
    expect(chooseObjective(rows.slice(0, 2), reader({}))).toBeUndefined()
    expect(chooseObjective([], reader({}))).toBeUndefined()
  })
})
