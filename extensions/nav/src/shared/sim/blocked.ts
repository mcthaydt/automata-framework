// The `Blocked` query nav uses by default: the walls and tall steps of sectors' resolved map, and the doors in
// `nav-doors`. A game with obstacles of its own (furniture) wraps it in its own `Blocked`.
import type { ResolvedMap } from '@automata/sectors/sim'
import type { Blocked } from './route'

export const blockedBy = (map: ResolvedMap, doors: Readonly<Record<string, boolean>>): Blocked => ({
  segment: (a, b, margin) => map.segmentBlocked(a, b, margin),
  open: (door) => doors[door] === true,
})
