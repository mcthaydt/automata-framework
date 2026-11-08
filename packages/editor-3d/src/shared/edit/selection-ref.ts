// What a selection id names (ED3D spec §4.2): the readers of the ids that `checks/check.ts` writes (`sector:hall`,
// `wall:hall/4`, `entity:crate/crate1`). A tool that picks, a check that locates and the inspector all pass ids around as
// strings, and this is the one place that takes one apart.
export type SelectionRef =
  | { readonly kind: 'sector'; readonly sector: string }
  /** The wall that starts at the sector's document corner `corner`. */
  | { readonly kind: 'wall'; readonly sector: string; readonly corner: number }
  | { readonly kind: 'entity'; readonly definition: string; readonly id: string }

const CORNER = /^(?:0|[1-9]\d*)$/

/** The reference an id names, or nothing when it is not one the writers could have made. */
export function parseSelection(id: string): SelectionRef | undefined {
  const colon = id.indexOf(':')
  if (colon < 0) return undefined
  const kind = id.slice(0, colon)
  const rest = id.slice(colon + 1)
  // The writers refuse ":" and "/" inside a part, so a second colon is never one of theirs.
  if (rest.includes(':')) return undefined
  const [first, second, ...extra] = rest.split('/')
  if (first === undefined || first === '' || extra.length > 0) return undefined
  if (kind === 'sector') return second === undefined ? { kind, sector: first } : undefined
  if (second === undefined || second === '') return undefined
  if (kind === 'wall')
    return CORNER.test(second) ? { kind, sector: first, corner: Number(second) } : undefined
  if (kind === 'entity') return { kind, definition: first, id: second }
  return undefined
}
