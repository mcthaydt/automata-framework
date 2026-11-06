import { describe, expect, test } from 'vitest'
import type { GateRecords } from '../../features/suite/memory/memory-gates'
import type { Gates } from '../../shared/kit/ports/suite-ports'

export type { GateRecords }

export const GATES_SCENARIO: GateRecords = {
  'P-G1': {
    name: 'Puzzle design',
    decision: 'approved',
    decidedAt: '2026-10-16T09:30:00Z',
    url: 'https://github.com/example/game/pull/7',
  },
  'C-G1': { name: 'Cutscene review', decision: 'rejected', decidedAt: '2026-10-17T14:00:00Z' },
  'S-G1': { name: 'Scene blockout', decision: 'open' },
}

/**
 * What every `Gates` promises: read only. `make('unreadable')` gives gates whose records
 * cannot be read.
 */
export function describeGates(
  name: string,
  make: (records: GateRecords | 'unreadable') => Promise<Gates> | Gates,
): void {
  describe(`Gates contract: ${name}`, () => {
    test('gives each state in request order, with its name, decision, date and link', async () => {
      const gates = await make(GATES_SCENARIO)
      expect(await gates.states(['S-G1', 'P-G1', 'C-G1'])).toEqual([
        { id: 'S-G1', name: 'Scene blockout', decision: 'open' },
        {
          id: 'P-G1',
          name: 'Puzzle design',
          decision: 'approved',
          decidedAt: '2026-10-16T09:30:00Z',
          url: 'https://github.com/example/game/pull/7',
        },
        { id: 'C-G1', name: 'Cutscene review', decision: 'rejected', decidedAt: '2026-10-17T14:00:00Z' },
      ])
    })

    test('a gate with no record is unknown, named by its id; no ids give no states', async () => {
      const gates = await make(GATES_SCENARIO)
      expect(await gates.states(['N-G1'])).toEqual([{ id: 'N-G1', name: 'N-G1', decision: 'unknown' }])
      expect(await gates.states([])).toEqual([])
    })

    test('an id that names an object member (constructor, toString) is a gate with no record', async () => {
      const gates = await make(GATES_SCENARIO)
      expect(await gates.states(['constructor', 'toString'])).toEqual([
        { id: 'constructor', name: 'constructor', decision: 'unknown' },
        { id: 'toString', name: 'toString', decision: 'unknown' },
      ])
    })

    test('records that cannot be read reject, so the pill can say "Gates not readable"', async () => {
      const gates = await make('unreadable')
      await expect(gates.states(['P-G1'])).rejects.toThrow()
    })

    test('has no way to record a decision', async () => {
      const gates = await make(GATES_SCENARIO)
      for (const verb of ['record', 'write', 'approve', 'reject', 'decide', 'set', 'clear'])
        expect(gates, verb).not.toHaveProperty(verb)
    })
  })
}
