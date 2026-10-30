// The in-memory gate records (editor suite spec §4.3, §7): read only, so there is no way here to record a decision.
// `'unreadable'` stands for records that cannot be read, which the gate pill shows as "Gates not readable".
import type { GateState, Gates } from '../suite-ports'
import type { GateRecords } from './gates-contract'

export function createMemoryGates(records: GateRecords | 'unreadable'): Gates {
  return {
    async states(ids): Promise<GateState[]> {
      if (records === 'unreadable') throw new Error('the gate records cannot be read')
      return ids.map((id) => {
        const record = records[id]
        return record === undefined ? { id, name: id, decision: 'unknown' } : { id, ...record }
      })
    },
  }
}
