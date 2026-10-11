// The dimension-neutral half of the physics plugins (M2.1 spec §3.2, §3.4): which entity owns which Rapier
// object, the order every Rapier mutation happens in, collision events, and the section 6 bytes. Everything
// that calls Rapier itself sits behind `PhysicsAdapter`, implemented once for 2D and once for 3D.

import {
  type ComponentDef,
  type EntityRef,
  type EventDef,
  type PluginState,
  type SimContext,
  SnapshotFormatError,
} from '@mcthaydt/automata-sim'

/** One dimension's Rapier, as the shared code needs it. `World` is that dimension's Rapier world. */
export interface PhysicsAdapter<World> {
  readonly Transform: ComponentDef
  readonly RigidBody: ComponentDef
  readonly Collider: ComponentDef
  readonly started: EventDef
  readonly ended: EventDef
  /** A new world with the plugin's gravity and the sim's timestep. */
  createWorld(): World
  /** A world from `takeSnapshot` bytes; throws on bytes Rapier rejects. */
  restoreWorld(bytes: Uint8Array): World
  takeSnapshot(world: World): Uint8Array
  /** Steps once and reports each collision start or end as (collider handle, collider handle, started). */
  step(world: World, onCollision: (a: number, b: number, started: boolean) => void): void
  free(world: World): void
  /** Every body and collider handle the world holds, as Rapier reports them. */
  handles(world: World): { bodies: number[]; colliders: number[] }
  /** Throws an Error naming the sid and field when the entity's physics fields are invalid (spec §5). */
  validate(entity: EntityRef): void
  createBody(world: World, entity: EntityRef): number
  /** Attached to `body` when given, else a lone collider placed by the entity's transform. */
  createCollider(world: World, entity: EntityRef, body: number | undefined): number
  /** Removes the body and any collider attached to it. */
  removeBody(world: World, body: number): void
  removeCollider(world: World, collider: number): void
  /** Applies whatever differs between the ECS and the body: pose, velocity, kind, damping (spec §3.4 rule 3). */
  updateBody(world: World, body: number, entity: EntityRef): void
  /** True when the Rapier collider still has the entity's shape, size, sensor flag, groups and material. */
  colliderMatches(world: World, collider: number, entity: EntityRef): boolean
  /** Moves a lone collider to the entity's transform if it differs. */
  updateLoneCollider(world: World, collider: number, entity: EntityRef): void
  /** Writes the body's pose and velocities into the entity (sync-out). */
  writeBack(world: World, body: number, entity: EntityRef): void
  isSensor(world: World, collider: number): boolean
}

/** What one entity owns in Rapier. A row exists only while the entity qualifies (spec §3.3). */
interface Row {
  readonly body: number | undefined
  collider: number | undefined
}

const PHYSICS_BYTES_VERSION = 1
const HAS_BODY = 1
const HAS_COLLIDER = 2

/** The exact 64 bits of a handle, so two handles compare equal only when Rapier would treat them the same. */
function handleBits(handle: number): bigint {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, handle, true)
  return view.getBigUint64(0, true)
}

function sameHandles(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  const left = a.map(handleBits).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
  const right = b.map(handleBits).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
  return left.every((bits, i) => bits === right[i])
}

/** The per-sim physics state: the plugin's `PluginState`, read by its systems through `ctx.pluginState`. */
export class PhysicsWorld<World> implements PluginState {
  private world: World
  private rows = new Map<number, Row>()
  private colliderOwner = new Map<number, number>() // collider handle -> sid
  private collisions: Array<{ a: number; b: number; started: boolean }> = []

  constructor(private readonly rapier: PhysicsAdapter<World>) {
    this.world = rapier.createWorld()
  }

  /** What the entity qualifies for: a body, a collider, both or nothing (spec §3.3). */
  private wants(entity: EntityRef | undefined): { body: boolean; collider: boolean } {
    const { Transform, RigidBody, Collider } = this.rapier
    if (!entity?.has(Transform)) return { body: false, collider: false }
    return { body: entity.has(RigidBody), collider: entity.has(Collider) }
  }

  private sortedSids(): number[] {
    return [...this.rows.keys()].sort((a, b) => a - b)
  }

  private removeRow(sid: number, row: Row): void {
    if (row.body !== undefined) this.rapier.removeBody(this.world, row.body)
    else if (row.collider !== undefined) this.rapier.removeCollider(this.world, row.collider)
    if (row.collider !== undefined) this.colliderOwner.delete(row.collider)
    this.rows.delete(sid)
  }

  private addCollider(sid: number, row: Row, entity: EntityRef): void {
    row.collider = this.rapier.createCollider(this.world, entity, row.body)
    this.colliderOwner.set(row.collider, sid)
  }

  /**
   * sync-in (spec §3.4). Removals first, then creations, then updates, each in ascending sid order: Rapier
   * reuses freed slots, so this fixed order is what keeps handles, and so the solver, identical everywhere.
   */
  syncIn(ctx: SimContext): void {
    for (const sid of this.sortedSids()) {
      const row = this.rows.get(sid) as Row
      const want = this.wants(ctx.entity(sid))
      if (want.body !== (row.body !== undefined) || want.collider !== (row.collider !== undefined))
        this.removeRow(sid, row)
    }
    for (const entity of ctx.query(this.rapier.Transform)) {
      if (this.rows.has(entity.sid)) continue
      const want = this.wants(entity)
      if (!want.body && !want.collider) continue
      this.rapier.validate(entity)
      const row: Row = {
        body: want.body ? this.rapier.createBody(this.world, entity) : undefined,
        collider: undefined,
      }
      this.rows.set(entity.sid, row)
      if (want.collider) this.addCollider(entity.sid, row, entity)
    }
    for (const sid of this.sortedSids()) {
      const row = this.rows.get(sid) as Row
      const entity = ctx.entity(sid) as EntityRef
      this.rapier.validate(entity)
      if (row.body !== undefined) this.rapier.updateBody(this.world, row.body, entity)
      if (row.collider === undefined) continue
      if (!this.rapier.colliderMatches(this.world, row.collider, entity)) {
        // Rapier cannot reshape every collider in place, so a changed collider is rebuilt.
        this.rapier.removeCollider(this.world, row.collider)
        this.colliderOwner.delete(row.collider)
        this.addCollider(sid, row, entity)
      } else if (row.body === undefined) {
        this.rapier.updateLoneCollider(this.world, row.collider, entity)
      }
    }
  }

  step(): void {
    this.collisions = []
    this.rapier.step(this.world, (a, b, started) => this.collisions.push({ a, b, started }))
  }

  /** sync-out: Rapier's results into the ECS. Rows of entities despawned this tick are skipped. */
  syncOut(ctx: SimContext): void {
    for (const sid of this.sortedSids()) {
      const row = this.rows.get(sid) as Row
      const entity = ctx.entity(sid)
      if (row.body !== undefined && entity) this.rapier.writeBack(this.world, row.body, entity)
    }
  }

  /**
   * Collision events, sorted by (started before ended, lower sid, higher sid) so the order is a contract and
   * not Rapier's internal pair order. A collider without an owner (removed this tick) drops its event.
   */
  emitEvents(ctx: SimContext): void {
    const out: Array<{ started: boolean; a: number; b: number; sensor: boolean }> = []
    for (const c of this.collisions) {
      const sa = this.colliderOwner.get(c.a)
      const sb = this.colliderOwner.get(c.b)
      if (sa === undefined || sb === undefined) continue
      const sensor = this.rapier.isSensor(this.world, c.a) || this.rapier.isSensor(this.world, c.b)
      out.push({ started: c.started, a: Math.min(sa, sb), b: Math.max(sa, sb), sensor })
    }
    out.sort((x, y) => Number(y.started) - Number(x.started) || x.a - y.a || x.b - y.b)
    for (const e of out)
      ctx.emit(e.started ? this.rapier.started : this.rapier.ended, { a: e.a, b: e.b, sensor: e.sensor })
    this.collisions = []
  }

  /** Section 6 bytes (spec §3.2): version, the sid -> handle table, then Rapier's own snapshot. */
  snapshot(): Uint8Array {
    const world = this.rapier.takeSnapshot(this.world)
    const sids = this.sortedSids()
    let size = 1 + 4 + 4 + world.length
    for (const sid of sids) {
      const row = this.rows.get(sid) as Row
      size += 4 + 1 + (row.body !== undefined ? 8 : 0) + (row.collider !== undefined ? 8 : 0)
    }
    const out = new Uint8Array(size)
    const view = new DataView(out.buffer)
    let at = 0
    view.setUint8(at, PHYSICS_BYTES_VERSION)
    view.setUint32(at + 1, sids.length, true)
    at += 5
    for (const sid of sids) {
      const row = this.rows.get(sid) as Row
      view.setUint32(at, sid, true)
      view.setUint8(
        at + 4,
        (row.body !== undefined ? HAS_BODY : 0) | (row.collider !== undefined ? HAS_COLLIDER : 0),
      )
      at += 5
      // Handles are f64 bit patterns of (index, generation); setFloat64 keeps the bits exactly.
      if (row.body !== undefined) {
        view.setFloat64(at, row.body, true)
        at += 8
      }
      if (row.collider !== undefined) {
        view.setFloat64(at, row.collider, true)
        at += 8
      }
    }
    view.setUint32(at, world.length, true)
    out.set(world, at + 4)
    return out
  }

  prepareRestore(bytes: Uint8Array): () => void {
    const fail = (why: string): never => {
      throw new SnapshotFormatError(`physics: ${why}`)
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let at = 0
    const need = (n: number): number => {
      if (at + n > bytes.length) fail(`truncated at byte ${at}`)
      const start = at
      at += n
      return start
    }
    const version = view.getUint8(need(1))
    if (version !== PHYSICS_BYTES_VERSION) fail(`unsupported version ${version}`)
    const count = view.getUint32(need(4), true)
    const rows = new Map<number, Row>()
    let previous = 0
    for (let i = 0; i < count; i++) {
      const sid = view.getUint32(need(4), true)
      if (sid <= previous) fail('rows must be in strictly ascending sid order, starting at 1')
      previous = sid
      const flags = view.getUint8(need(1))
      if (flags === 0 || flags > (HAS_BODY | HAS_COLLIDER)) fail(`row ${sid} has invalid flags ${flags}`)
      const body = flags & HAS_BODY ? view.getFloat64(need(8), true) : undefined
      const collider = flags & HAS_COLLIDER ? view.getFloat64(need(8), true) : undefined
      rows.set(sid, { body, collider })
    }
    const worldLength = view.getUint32(need(4), true)
    const worldBytes = bytes.subarray(need(worldLength), at)
    if (at !== bytes.length) fail(`${bytes.length - at} trailing bytes`)

    let world: World
    try {
      world = this.rapier.restoreWorld(worldBytes)
    } catch (err) {
      throw new SnapshotFormatError(`physics: Rapier rejected the world bytes: ${String(err)}`, {
        cause: err,
      })
    }
    // The table must name exactly the world's bodies and colliders. Rapier's own lookup is not enough: it
    // resolves some malformed handles to a live object, so the check compares exact handle bits instead.
    const inWorld = this.rapier.handles(world)
    const inTable = { bodies: [] as number[], colliders: [] as number[] }
    for (const row of rows.values()) {
      if (row.body !== undefined) inTable.bodies.push(row.body)
      if (row.collider !== undefined) inTable.colliders.push(row.collider)
    }
    if (!sameHandles(inWorld.bodies, inTable.bodies) || !sameHandles(inWorld.colliders, inTable.colliders)) {
      this.rapier.free(world)
      fail('the handle table does not match the world’s bodies and colliders')
    }
    return () => {
      this.rapier.free(this.world)
      this.world = world
      this.rows = rows
      this.colliderOwner = new Map()
      for (const [sid, row] of rows) if (row.collider !== undefined) this.colliderOwner.set(row.collider, sid)
      this.collisions = []
    }
  }

  dispose(): void {
    this.rapier.free(this.world)
  }
}
