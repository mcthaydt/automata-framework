import {
  canonicalJson,
  createSim,
  type Sim,
  SnapshotFormatError,
  SnapshotMismatchError,
} from '@mcthaydt/automata-sim'
import { afterEach, expect, test } from 'vitest'
import { BodyKind, body3d, collider3d, physics3d, transform3d } from './3d'
import { createScene3D, sceneCommands } from './testing/scene-3d'

const sims: Sim[] = []
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose()
})
const scene = async () => {
  const sim = await createScene3D()
  sims.push(sim)
  return sim
}
/** Steps from the sim's tick to `end`, returning every event as canonical JSON lines. */
const runTo = (sim: Sim, end: number): string[] => {
  const events: string[] = []
  while (sim.tick < end)
    for (const e of sim.step(sceneCommands(sim.tick)).events) events.push(canonicalJson(e))
  return events
}

test('snapshot at tick 150, restore into a fresh sim, and the next 150 ticks match the straight run', async () => {
  const straight = await scene()
  runTo(straight, 150)
  const bytes = straight.snapshot()
  const restored = await scene()
  restored.restore(bytes)
  expect(restored.snapshot()).toEqual(bytes) // restore then snapshot is byte-identical
  const a = runTo(straight, 300)
  const b = runTo(restored, 300)
  expect(a.length).toBeGreaterThan(0)
  expect(b).toEqual(a)
  expect(restored.hash()).toBe(straight.hash())
})

// Section 6 is the snapshot's last section: tag | length | count | name | byteLength | physics bytes.
function physicsBytesOf(snapshot: Uint8Array): { start: number; bytes: Uint8Array } {
  const view = new DataView(snapshot.buffer, snapshot.byteOffset, snapshot.byteLength)
  let at = 4 + 2 + 8 + 8 + 4 + 2
  while (view.getUint8(at) !== 6) at += 5 + view.getUint32(at + 1, true)
  const nameLength = view.getUint16(at + 5 + 2, true)
  const bytesAt = at + 5 + 2 + 2 + nameLength + 4
  return { start: at, bytes: snapshot.slice(bytesAt) }
}
function withPhysicsBytes(snapshot: Uint8Array, bytes: Uint8Array): Uint8Array {
  const { start } = physicsBytesOf(snapshot)
  const name = Uint8Array.from('physics-3d', (ch) => ch.charCodeAt(0))
  const section = new Uint8Array(2 + 2 + name.length + 4 + bytes.length)
  const sv = new DataView(section.buffer)
  sv.setUint16(0, 1, true)
  sv.setUint16(2, name.length, true)
  section.set(name, 4)
  sv.setUint32(4 + name.length, bytes.length, true)
  section.set(bytes, 8 + name.length)
  const out = new Uint8Array(start + 5 + section.length)
  out.set(snapshot.subarray(0, start))
  const ov = new DataView(out.buffer)
  ov.setUint8(start, 6)
  ov.setUint32(start + 1, section.length, true)
  out.set(section, start + 5)
  return out
}

/** Row offsets in the physics bytes: sid u32 | flags u8 | body f64? | collider f64? (spec §3.2). */
function rowsOf(b: Uint8Array): Array<{ sid: number; flags: number; collider?: number }> {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const rows: Array<{ sid: number; flags: number; collider?: number }> = []
  let at = 5
  for (let i = view.getUint32(1, true); i > 0; i--) {
    const sid = view.getUint32(at, true)
    const flags = view.getUint8(at + 4)
    at += 5 + (flags & 1 ? 8 : 0)
    rows.push(flags & 2 ? { sid, flags, collider: at } : { sid, flags })
    at += flags & 2 ? 8 : 0
  }
  return rows
}
/** Offset of the first contact (a u32 | b u32 | sensor u8), right after the table and the contact count. */
function firstContactAt(b: Uint8Array): number {
  const rows = rowsOf(b)
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let at = 5
  for (const r of rows) at += 5 + (r.flags & 1 ? 8 : 0) + (r.flags & 2 ? 8 : 0)
  if (view.getUint32(at, true) === 0) throw new Error('the scene has no contact at this tick')
  return at + 4
}
function editFirstContact(b: Uint8Array, edit: (view: DataView, at: number) => void): void {
  edit(new DataView(b.buffer, b.byteOffset, b.byteLength), firstContactAt(b))
}

/** Swaps the collider handles of the first row matching `x` and the first other row matching `y`. */
function swapColliders(b: Uint8Array, x: number, y: number): void {
  const rows = rowsOf(b)
  const first = rows.find((r) => r.flags === x) as { collider: number }
  const second = rows.find((r) => r.flags === y && r !== first) as { collider: number }
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const handle = view.getFloat64(first.collider, true)
  view.setFloat64(first.collider, view.getFloat64(second.collider, true), true)
  view.setFloat64(second.collider, handle, true)
}

test.each([
  ['an unknown version', (b: Uint8Array) => b.set([9], 0), /unsupported version 9/],
  ['rows out of order', (b: Uint8Array) => new DataView(b.buffer).setUint32(5, 999, true), /ascending/],
  ['invalid flags', (b: Uint8Array) => b.set([0], 9), /invalid flags/],
  [
    'a handle the world lacks',
    (b: Uint8Array) => new DataView(b.buffer).setFloat64(10, 12345.5, true),
    /handle table does not match/,
  ],
  ['two bodies’ colliders swapped', (b: Uint8Array) => swapColliders(b, 3, 3), /row \d+: collider .* body/],
  [
    'a contact naming the higher sid first',
    (b: Uint8Array) =>
      editFirstContact(b, (v, at) => {
        const a = v.getUint32(at, true)
        v.setUint32(at, v.getUint32(at + 4, true), true)
        v.setUint32(at + 4, a, true)
      }),
    /lower sid first/,
  ],
  [
    'a contact naming an entity without a collider',
    (b: Uint8Array) => editFirstContact(b, (v, at) => v.setUint32(at + 4, 999, true)),
    /without a collider/,
  ],
  [
    'a contact with an invalid sensor byte',
    (b: Uint8Array) => editFirstContact(b, (v, at) => v.setUint8(at + 8, 7)),
    /invalid sensor byte/,
  ],
  [
    'a body’s and a lone collider swapped',
    (b: Uint8Array) => swapColliders(b, 3, 2),
    /row \d+: collider .* body/,
  ],
] as const)('physics bytes with %s are refused and the sim is unchanged', async (_, corrupt, message) => {
  const source = await scene()
  runTo(source, 40)
  const good = source.snapshot()
  const bytes = physicsBytesOf(good).bytes.slice()
  corrupt(bytes)
  const target = await scene()
  runTo(target, 5)
  const before = target.snapshot()
  expect(() => target.restore(withPhysicsBytes(good, bytes))).toThrow(SnapshotFormatError)
  expect(() => target.restore(withPhysicsBytes(good, bytes))).toThrow(message)
  expect(target.snapshot()).toEqual(before)
  // The reframing helper itself is sound: unmodified bytes restore.
  target.restore(withPhysicsBytes(good, physicsBytesOf(good).bytes))
  expect(target.snapshot()).toEqual(good)
})

test('trailing or truncated physics bytes are refused', async () => {
  const source = await scene()
  runTo(source, 40)
  const good = source.snapshot()
  const bytes = physicsBytesOf(good).bytes
  const target = await scene()
  const longer = new Uint8Array(bytes.length + 1)
  longer.set(bytes)
  expect(() => target.restore(withPhysicsBytes(good, longer))).toThrow(SnapshotFormatError)
  expect(() => target.restore(withPhysicsBytes(good, bytes.subarray(0, 20)))).toThrow(SnapshotFormatError)
})

test('a snapshot from a sim with other gravity is refused, not silently adopted (audit, spec §10.8)', async () => {
  const moon = await createSim({ seed: 1, plugins: [physics3d({ gravity: { x: 0, y: -1.62, z: 0 } })] })
  const earth = await createSim({ seed: 1, plugins: [physics3d()] })
  sims.push(moon, earth)
  moon.spawn([transform3d({ y: 3 }), body3d(BodyKind.dynamic), collider3d.ball(0.5)])
  for (let t = 0; t < 10; t++) moon.step([])
  expect(() => earth.restore(moon.snapshot())).toThrow(SnapshotMismatchError)
})
