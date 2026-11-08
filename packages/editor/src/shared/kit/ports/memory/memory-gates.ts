// The in-memory gate records (editor suite spec §4.3, §7): read only, so there is no way here to record a decision.
// `'unreadable'` stands for records that cannot be read, which the gate pill shows as "Gates not readable".
import type { GateState, Gates } from '../suite-ports'

/** The recorded decisions an adapter under the gates contract reads (the Node adapter writes them as gate records). */
export type GateRecords = Readonly<Record<string, Omit<GateState, 'id'>>>

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
