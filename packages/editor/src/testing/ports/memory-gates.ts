// The in-memory gate records (editor suite spec §4.3, §7): read only, so there is no way here to record a decision.
// `'unreadable'` stands for records that cannot be read, which the gate pill shows as "Gates not readable".
import type { GateState, Gates } from '../../shared/kit/ports/suite-ports'
import type { GateRecords } from './gates-contract'

export function createMemoryGates(records: GateRecords | 'unreadable'): Gates {
  return {
    async states(ids): Promise<GateState[]> {
      if (records === 'unreadable') throw new Error('the gate records cannot be read')
      return ids.map((id) => {
        // Own keys only: an id such as `constructor` or `toString` is a gate with no record, not a prototype member.
        const record = Object.hasOwn(records, id) ? records[id] : undefined
        return record === undefined ? { id, name: id, decision: 'unknown' } : { id, ...record }
      })
    },
  }
}
