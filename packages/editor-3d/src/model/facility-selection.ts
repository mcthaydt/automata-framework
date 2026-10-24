// What a World selection id names (ED3D spec §4.2, ED3D.9a): `wing:bay`, `join:exit`, `lock:p0.cabinet`, `phase:P2`.
// The same `kind:name` form as the level's ids (selection-ref.ts); the facility has a selection of its own, so the two
// never mix. A name may hold neither ":" nor "/", the rule the level's ids have. The writer is `facilitySelection` in
// checks/check.ts, beside the level's, since the checks name places too; this file reads the ids back.
import type { FacilitySelectionKind } from '../checks/check'

export interface FacilitySelectionRef {
  readonly kind: FacilitySelectionKind
  readonly id: string
}

const KINDS: readonly string[] = ['wing', 'join', 'lock', 'phase']

/** The reference an id names, or nothing when it is not one `facilitySelection` could have made. */
export function parseFacilitySelection(selection: string): FacilitySelectionRef | undefined {
  const colon = selection.indexOf(':')
  if (colon < 0) return undefined
  const kind = selection.slice(0, colon)
  const id = selection.slice(colon + 1)
  if (!KINDS.includes(kind) || id === '' || id.includes(':') || id.includes('/')) return undefined
  return { kind: kind as FacilitySelectionKind, id }
}
