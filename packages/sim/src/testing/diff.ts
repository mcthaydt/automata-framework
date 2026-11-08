// Structural diff of two snapshot views: what differs, field by field, in a fixed order so a
// report reads the same in every engine: header, rng, resources, nextId, entities, plugin bytes.
import type { SnapshotView } from '@mcthaydt/automata-sim'

/**
 * One difference between two snapshot views: its kind, where it is (`entity 4 bounce.ball.vx`), the entity's
 * sid when it is an entity, and both values as printed.
 */
export interface Difference {
  readonly kind: 'header' | 'rng' | 'resource' | 'entity' | 'plugin'
  /** What differs, as printed: "entity 4 bounce.ball.vx", "resource bounce.stats.bounces". */
  readonly at: string
  /** For entity differences, the entity's sid. */
  readonly sid?: number
  readonly expected: string
  readonly actual: string
}

const PRESENT = 'present'
const ABSENT = 'absent'

/** Exact and unambiguous: String() is exact for f32 and f64 values; -0 keeps its sign; strings are quoted. */
function show(value: unknown): string {
  if (value === undefined) return ABSENT
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value)
  return JSON.stringify(value)
}

const sorted = (keys: Iterable<string>): string[] => [...new Set(keys)].sort()
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Differences between two JSON values, by path; arrays report a length change, then each index. */
function diffJson(path: string, expected: unknown, actual: unknown, out: Difference[]): void {
  const push = (at: string, e: unknown, a: unknown) =>
    out.push({ kind: 'resource', at: `resource ${at}`, expected: show(e), actual: show(a) })
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) push(`${path}.length`, expected.length, actual.length)
    for (let i = 0; i < Math.max(expected.length, actual.length); i++)
      diffJson(`${path}[${i}]`, expected[i], actual[i], out)
    return
  }
  if (isRecord(expected) && isRecord(actual)) {
    for (const key of sorted([...Object.keys(expected), ...Object.keys(actual)]))
      diffJson(`${path}.${key}`, expected[key], actual[key], out)
    return
  }
  const bothScalar = typeof expected !== 'object' || expected === null
  if (bothScalar && Object.is(expected, actual)) return
  if (!bothScalar && JSON.stringify(expected) === JSON.stringify(actual)) return
  push(path, expected, actual)
}

/**
 * Every difference between an expected and an actual snapshot view, field by field, in a fixed order (header,
 * rng, resources, next id, entities, plugin bytes) so a report reads the same in every engine. Empty when
 * they are equal.
 */
export function diffSnapshotViews(expected: SnapshotView, actual: SnapshotView): Difference[] {
  const out: Difference[] = []
  const add = (kind: Difference['kind'], at: string, e: unknown, a: unknown, sid?: number) =>
    out.push({ kind, at, ...(sid === undefined ? {} : { sid }), expected: show(e), actual: show(a) })
  /** One side has the thing (a system's stream, an entity, a component) and the other does not. */
  const presence = (kind: Difference['kind'], at: string, inExpected: boolean, sid?: number) =>
    out.push({
      kind,
      at,
      ...(sid === undefined ? {} : { sid }),
      expected: inExpected ? PRESENT : ABSENT,
      actual: inExpected ? ABSENT : PRESENT,
    })

  for (const field of ['formatVersion', 'schemaHash', 'contentHash', 'tick', 'tickHz'] as const)
    if (!Object.is(expected.header[field], actual.header[field]))
      add('header', `header ${field}`, expected.header[field], actual.header[field])

  for (const name of sorted([...Object.keys(expected.rng), ...Object.keys(actual.rng)])) {
    const e = expected.rng[name]
    const a = actual.rng[name]
    if (!e || !a) {
      presence('rng', `rng ${name}`, e !== undefined)
      continue
    }
    for (let i = 0; i < Math.max(e.length, a.length); i++)
      if (!Object.is(e[i], a[i])) add('rng', `rng ${name}[${i}]`, e[i], a[i])
  }

  for (const id of sorted([...Object.keys(expected.resources), ...Object.keys(actual.resources)]))
    diffJson(id, expected.resources[id], actual.resources[id], out)

  if (expected.nextId !== actual.nextId) add('entity', 'nextId', expected.nextId, actual.nextId)

  const expectedBySid = new Map(expected.entities.map((e) => [e.sid, e.components]))
  const actualBySid = new Map(actual.entities.map((e) => [e.sid, e.components]))
  const sids = [...new Set([...expectedBySid.keys(), ...actualBySid.keys()])].sort((x, y) => x - y)
  for (const sid of sids) {
    const e = expectedBySid.get(sid)
    const a = actualBySid.get(sid)
    if (!e || !a) {
      presence('entity', `entity ${sid}`, e !== undefined, sid)
      continue
    }
    for (const id of sorted([...Object.keys(e), ...Object.keys(a)])) {
      const ec = e[id]
      const ac = a[id]
      if (!ec || !ac) {
        presence('entity', `entity ${sid} ${id}`, ec !== undefined, sid)
        continue
      }
      for (const field of sorted([...Object.keys(ec), ...Object.keys(ac)]))
        if (!Object.is(ec[field], ac[field]))
          add('entity', `entity ${sid} ${id}.${field}`, ec[field], ac[field], sid)
    }
  }

  for (const name of sorted([...Object.keys(expected.plugins), ...Object.keys(actual.plugins)])) {
    const e = expected.plugins[name]
    const a = actual.plugins[name]
    if (e && a && e.byteLength === a.byteLength && e.hash === a.hash) continue
    out.push({
      kind: 'plugin',
      at: `plugin ${name}`,
      expected: e ? `${e.byteLength} bytes ${e.hash}` : ABSENT,
      actual: a ? `${a.byteLength} bytes ${a.hash}` : ABSENT,
    })
  }
  return out
}
