import type { EntityRef, EventDef, SimContext } from '@mcthaydt/automata-sim'
import { expect, test } from 'vitest'
import { Collider3D, CollisionEnded3D, CollisionStarted3D, RigidBody3D, Transform3D } from './3d'
import { type PhysicsAdapter, PhysicsWorld } from './physics-world'

// The event contract (spec §3.4) on its own, with a fake Rapier that reports pairs in whatever order the
// test chooses, so the sort and `a < b` are proven independent of Rapier's internal pair order.
function fakeWorld(report: Array<[number, number, boolean]>) {
  let next = 100
  const adapter = {
    Transform: Transform3D,
    RigidBody: RigidBody3D,
    Collider: Collider3D,
    started: CollisionStarted3D,
    ended: CollisionEnded3D,
    createWorld: () => ({}),
    validate: () => {},
    createCollider: () => next--, // handles count down while sids count up
    step: (_: unknown, on: (a: number, b: number, s: boolean) => void) => {
      for (const [a, b, s] of report) on(a, b, s)
    },
    updateLoneCollider: () => {},
    colliderMatches: () => true,
    isSensor: () => false,
  } as unknown as PhysicsAdapter<object>
  const entities = [1, 2, 3].map(
    (sid) => ({ sid, has: (c: unknown) => c === Transform3D || c === Collider3D }) as unknown as EntityRef,
  )
  const emitted: Array<{ type: string; payload: unknown }> = []
  const ctx = {
    query: () => entities,
    entity: (sid: number) => entities[sid - 1],
    emit: (def: EventDef, payload: unknown) => emitted.push({ type: def.id, payload }),
  } as unknown as SimContext
  return { world: new PhysicsWorld(adapter), ctx, emitted }
}

test('events are sorted started-first, then by sid, with a < b, whatever order Rapier reports them in', () => {
  // sid 1 -> handle 100, sid 2 -> 99, sid 3 -> 98.
  const { world, ctx, emitted } = fakeWorld([
    [98, 100, false],
    [98, 99, true],
    [99, 100, true],
  ])
  world.syncIn(ctx)
  world.step()
  world.emitEvents(ctx)
  expect(emitted).toEqual([
    { type: 'physics3d.collision-started', payload: { a: 1, b: 2, sensor: false } },
    { type: 'physics3d.collision-started', payload: { a: 2, b: 3, sensor: false } },
    { type: 'physics3d.collision-ended', payload: { a: 1, b: 3, sensor: false } },
  ])
})

test('an event naming a collider that has no owner is dropped', () => {
  const { world, ctx, emitted } = fakeWorld([[7, 100, true]])
  world.syncIn(ctx)
  world.step()
  world.emitEvents(ctx)
  expect(emitted).toEqual([])
})
