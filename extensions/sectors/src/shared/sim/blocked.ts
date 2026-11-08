// The `Blocked` query sectors answers by default: the walls and tall steps of the resolved map, and the doors a game
// keeps (`nav-doors`). A game with obstacles of its own (furniture) wraps it in its own `Blocked`. It lives here, with the
// map, so `sectorsPlaces` can answer for `nav` without sectors importing it.
import { type Blocked, blockedWith } from '@automata/places'
import type { ResolvedMap } from './resolve'

export const blockedBy = (map: ResolvedMap, doors: Readonly<Record<string, boolean>>): Blocked =>
  blockedWith((a, b, margin) => map.segmentBlocked(a, b, margin), doors)
