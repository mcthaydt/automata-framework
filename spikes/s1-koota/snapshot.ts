import type { Entity } from 'koota'
import { Contains, Health, Position, type Sim, StableId, sidOf, Velocity } from './world'

export type Row = {
  sid: number
  pos: [number, number] | null
  vel: [number, number] | null
  hp: number | null
  contains: Array<[number, number]> // [target sid, amount], sorted by target sid
}
export type Snapshot = { nextId: number; acc: number; rng: number; rows: Row[] }

/** Canonical snapshot: rows sorted by StableId, relation targets sorted by target StableId. */
export function takeSnapshot(sim: Sim): Snapshot {
  const rows: Row[] = []
  for (const e of sim.world.query(StableId)) {
    const p = e.has(Position) ? e.get(Position) : undefined
    const v = e.has(Velocity) ? e.get(Velocity) : undefined
    const h = e.has(Health) ? e.get(Health) : undefined
    const contains: Array<[number, number]> = e
      .targetsFor(Contains)
      .map((t: Entity) => [sidOf(t), (e.get(Contains(t)) as { amount: number }).amount] as [number, number])
      .sort((x, y) => x[0] - y[0])
    rows.push({
      sid: sidOf(e),
      pos: p ? [p.x, p.y] : null,
      vel: v ? [v.x, v.y] : null,
      hp: h ? h.hp : null,
      contains,
    })
  }
  rows.sort((a, b) => a.sid - b.sid)
  return { nextId: sim.nextId, acc: sim.acc, rng: sim.rng.s, rows }
}

const HAS_POS = 1
const HAS_VEL = 2
const HAS_HP = 4

/** Little-endian binary encoding. Positions/velocities are f32 (they are Math.fround'ed on every write). */
export function encode(s: Snapshot): Uint8Array {
  let size = 16
  for (const row of s.rows)
    size +=
      4 + 1 + (row.pos ? 8 : 0) + (row.vel ? 8 : 0) + (row.hp !== null ? 4 : 0) + 4 + row.contains.length * 8
  const v = new DataView(new ArrayBuffer(size))
  let o = 0
  const u32 = (n: number) => {
    v.setUint32(o, n, true)
    o += 4
  }
  const i32 = (n: number) => {
    v.setInt32(o, n, true)
    o += 4
  }
  const f32 = (n: number) => {
    v.setFloat32(o, n, true)
    o += 4
  }
  u32(s.nextId)
  u32(s.acc)
  u32(s.rng)
  u32(s.rows.length)
  for (const row of s.rows) {
    u32(row.sid)
    v.setUint8(o++, (row.pos ? HAS_POS : 0) | (row.vel ? HAS_VEL : 0) | (row.hp !== null ? HAS_HP : 0))
    if (row.pos) {
      f32(row.pos[0])
      f32(row.pos[1])
    }
    if (row.vel) {
      f32(row.vel[0])
      f32(row.vel[1])
    }
    if (row.hp !== null) i32(row.hp)
    u32(row.contains.length)
    for (const [sid, amount] of row.contains) {
      u32(sid)
      i32(amount)
    }
  }
  if (o !== size) throw new Error(`encode size mismatch ${o} != ${size}`)
  return new Uint8Array(v.buffer)
}

export function decode(bytes: Uint8Array): Snapshot {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let o = 0
  const u32 = () => {
    const n = v.getUint32(o, true)
    o += 4
    return n
  }
  const i32 = () => {
    const n = v.getInt32(o, true)
    o += 4
    return n
  }
  const f32 = () => {
    const n = v.getFloat32(o, true)
    o += 4
    return n
  }
  const nextId = u32(),
    acc = u32(),
    rng = u32(),
    count = u32()
  const rows: Row[] = []
  for (let i = 0; i < count; i++) {
    const sid = u32()
    const flags = v.getUint8(o++)
    const pos: [number, number] | null = flags & HAS_POS ? [f32(), f32()] : null
    const vel: [number, number] | null = flags & HAS_VEL ? [f32(), f32()] : null
    const hp = flags & HAS_HP ? i32() : null
    const n = u32()
    const contains: Array<[number, number]> = []
    for (let j = 0; j < n; j++) contains.push([u32(), i32()])
    rows.push({ sid, pos, vel, hp, contains })
  }
  if (o !== bytes.byteLength) throw new Error(`trailing bytes: read ${o} of ${bytes.byteLength}`)
  return { nextId, acc, rng, rows }
}

/** Rebuild into a fresh world: spawn in StableId order first, then add relations. */
export function restore(s: Snapshot, into: Sim): void {
  into.nextId = s.nextId
  into.acc = s.acc
  into.rng.s = s.rng
  const bySid = new Map<number, Entity>()
  for (const row of s.rows) {
    const e = into.world.spawn(StableId({ value: row.sid }))
    if (row.pos) e.add(Position({ x: row.pos[0], y: row.pos[1] }))
    if (row.vel) e.add(Velocity({ x: row.vel[0], y: row.vel[1] }))
    if (row.hp !== null) e.add(Health({ hp: row.hp }))
    bySid.set(row.sid, e)
  }
  for (const row of s.rows) {
    const src = bySid.get(row.sid) as Entity
    for (const [targetSid, amount] of row.contains)
      src.add(Contains(bySid.get(targetSid) as Entity, { amount }))
  }
}
