// `validate` for the blockout pipeline (M6 spec §4.11, M6.11): the generic half of the adventure source's checks, as plain findings.
// It stops at the first stage that cannot go on (the schema, then the expansion) and otherwise reports every finding: unique ids, doors,
// attachments, the generated sector map and nav graph through their content schemas, nav edges through boxes, and nav nodes the spawn
// cannot reach. The source's puzzle-hotspot binding and lamp checks are the game's (BP-D1). Pure: no files, no clock.

import { navGraphSchema } from '@mcthaydt/automata-nav/sim'
import {
  type Blockout,
  BlockoutError,
  blockoutSchema,
  type Expanded,
  expand,
} from '@mcthaydt/automata-sector-format/blockout'
import { sectorMapSchema } from '@mcthaydt/automata-sectors/sim'

export interface Finding {
  readonly rule: 'schema' | 'expand' | 'ids' | 'doors' | 'attachments' | 'map' | 'nav'
  readonly detail: string
}

const at = (path: readonly PropertyKey[]): string => path.map(String).join('.') || '(file)'

function duplicates(kind: string, ids: readonly string[]): Finding[] {
  const seen = new Set<string>()
  const out: Finding[] = []
  for (const id of ids) {
    if (seen.has(id)) out.push({ rule: 'ids', detail: `${kind} ${id} is defined twice` })
    seen.add(id)
  }
  return out
}

function doorFindings(b: Blockout, x: Expanded): Finding[] {
  const out: Finding[] = []
  const closed = new Set<string>()
  for (const opening of b.openings ?? []) {
    if (opening.door === undefined) continue
    closed.add(opening.door)
    const box = x.boxes.find((candidate) => candidate.id === opening.door)
    if (box === undefined)
      out.push({ rule: 'doors', detail: `opening ${opening.id}: ${opening.door} is not a box` })
    else if (box.kind !== 'door')
      out.push({ rule: 'doors', detail: `opening ${opening.id}: ${opening.door} is not a door box` })
  }
  for (const box of b.boxes)
    if (box.role === 'door' && !closed.has(box.id))
      out.push({ rule: 'doors', detail: `door box ${box.id} closes no opening` })
  return out
}

/** `box:<id>` names a box; `wall:<room>/<corner index>` a wall of a room. */
function attachmentFindings(b: Blockout): Finding[] {
  const out: Finding[] = []
  const boxes = new Set(b.boxes.map((box) => box.id))
  const check = (kind: string, id: string, on: string | undefined): void => {
    if (on === undefined) return
    const [type, rest = ''] = on.split(':')
    if (type === 'box' && boxes.has(rest)) return
    if (type === 'wall') {
      const [room, index] = rest.split('/')
      const found = b.rooms.find((r) => r.id === room)
      if (
        found !== undefined &&
        Number.isInteger(Number(index)) &&
        Number(index) >= 0 &&
        Number(index) < found.corners.length
      )
        return
    }
    out.push({ rule: 'attachments', detail: `${kind} ${id} is on ${on}, which is not there` })
  }
  for (const h of b.hotspots) check('hotspot', h.id, h.on)
  for (const l of b.lamps) check('lamp', l.id, l.on)
  return out
}

/** Whether the open segment p→q passes through the interior of the box (plan view, slab method). */
function crossesBox(
  p: { x: number; z: number },
  q: { x: number; z: number },
  box: { x: number; z: number; w: number; d: number },
): boolean {
  const eps = 1e-6
  const lo = [box.x - box.w / 2 + eps, box.z - box.d / 2 + eps] as const
  const hi = [box.x + box.w / 2 - eps, box.z + box.d / 2 - eps] as const
  const from = [p.x, p.z] as const
  const delta = [q.x - p.x, q.z - p.z] as const
  let t0 = 0
  let t1 = 1
  for (const axis of [0, 1] as const) {
    if (Math.abs(delta[axis]) < 1e-12) {
      if (from[axis] < lo[axis] || from[axis] > hi[axis]) return false
      continue
    }
    const a = (lo[axis] - from[axis]) / delta[axis]
    const c = (hi[axis] - from[axis]) / delta[axis]
    t0 = Math.max(t0, Math.min(a, c))
    t1 = Math.min(t1, Math.max(a, c))
    if (t0 > t1) return false
  }
  return true
}

function navFindings(x: Expanded): Finding[] {
  const out: Finding[] = []
  const graph = navGraphSchema.safeParse({ nodes: x.nodes, edges: x.edges })
  if (!graph.success) {
    for (const issue of graph.error.issues)
      out.push({ rule: 'nav', detail: `${at(issue.path)}: ${issue.message}` })
    return out
  }
  const ids = Object.keys(x.nodes).sort()
  for (const edge of x.edges) {
    const [a, b, door] = edge
    const p = x.nodes[a] as { x: number; z: number }
    const q = x.nodes[b] as { x: number; z: number }
    for (const box of x.boxes) {
      // The door an edge passes through is the one box it may cross.
      if (box.id === door) continue
      if (crossesBox(p, q, box))
        out.push({ rule: 'nav', detail: `edge ${a}-${b} passes through box ${box.id}` })
    }
  }
  // Reachability from the node nearest the spawn, over every edge (a door edge counts: doors open).
  if (ids.length > 0) {
    const near = ids.reduce((best, id) => {
      const d = (n: { x: number; z: number }): number => (n.x - x.spawn.x) ** 2 + (n.z - x.spawn.z) ** 2
      return d(x.nodes[id] as { x: number; z: number }) < d(x.nodes[best] as { x: number; z: number })
        ? id
        : best
    })
    const seen = new Set([near])
    const queue = [near]
    for (let head = 0; head < queue.length; head += 1) {
      const here = queue[head] as string
      for (const [a, b] of x.edges) {
        const next = a === here ? b : b === here ? a : undefined
        if (next !== undefined && !seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    for (const id of ids)
      if (!seen.has(id)) out.push({ rule: 'nav', detail: `nav node ${id} is not reachable from ${near}` })
  }
  return out
}

/** Every finding for a blockout read from a file. A sound one has none. */
export function validateBlockout(input: unknown): Finding[] {
  const parsed = blockoutSchema.safeParse(input)
  if (!parsed.success)
    return parsed.error.issues.map((issue) => ({
      rule: 'schema',
      detail: `${at(issue.path)}: ${issue.message}`,
    }))
  const b = parsed.data
  const ids = [
    ...duplicates(
      'room',
      b.rooms.map((r) => r.id),
    ),
    ...duplicates(
      'opening',
      (b.openings ?? []).map((o) => o.id),
    ),
    ...duplicates(
      'box',
      b.boxes.map((box) => box.id),
    ),
    ...duplicates(
      'hotspot',
      b.hotspots.map((h) => h.id),
    ),
    ...duplicates(
      'zone',
      b.zones.map((z) => z.id),
    ),
  ]
  let x: Expanded
  try {
    x = expand(b)
  } catch (error) {
    // A repeated room id can be why the expansion fails, so the ids come first.
    if (error instanceof BlockoutError) return [...ids, { rule: 'expand', detail: error.message }]
    throw error
  }
  const map = sectorMapSchema.safeParse({ sectors: x.sectors, masses: x.masses })
  return [
    ...ids,
    ...doorFindings(b, x),
    ...attachmentFindings(b),
    ...(map.success
      ? []
      : map.error.issues.map((issue) => ({
          rule: 'map' as const,
          detail: `${at(issue.path)}: ${issue.message}`,
        }))),
    ...navFindings(x),
  ]
}
