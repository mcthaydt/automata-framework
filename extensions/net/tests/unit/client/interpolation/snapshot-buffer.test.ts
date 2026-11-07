import { describe, expect, it } from 'vitest'
import {
  blendViews,
  type RemoteView,
  SnapshotBuffer,
} from '#src/features/client/interpolation/snapshot-buffer.ts'

// The snapshot buffer over a generic view: entity -> fields. A game's own wrap rule is its `blend`; the generic
// `blendViews` takes a per-field jump threshold for the same job.

const view = (entities: Record<string, Record<string, number | string | boolean>>): RemoteView => entities
const buffer = (windowTicks = 48) =>
  new SnapshotBuffer<RemoteView>({
    windowTicks,
    blend: (a, b, t) => blendViews(a, b, t, { takeNewer: ['facing'], jump: { x: 100 } }),
  })

describe('remote interpolation', () => {
  it('interpolates a remote entity between two snapshots, every numeric field', () => {
    const b = buffer()
    b.push(10, view({ a: { x: 0, y: 0 } }))
    b.push(16, view({ a: { x: 60, y: 30 } }))
    expect(b.sample(13)).toEqual({ a: { x: 30, y: 15 } })
    expect(b.sample(12)).toEqual({ a: { x: 20, y: 10 } })
  })

  it('holds at the newest snapshot rather than extrapolating past it', () => {
    const b = buffer()
    b.push(10, view({ a: { x: 0 } }))
    b.push(16, view({ a: { x: 60 } }))
    expect(b.sample(40)).toEqual({ a: { x: 60 } })
  })

  it('holds at the oldest snapshot before the buffer starts', () => {
    const b = buffer()
    b.push(10, view({ a: { x: 0 } }))
    b.push(16, view({ a: { x: 60 } }))
    expect(b.sample(2)).toEqual({ a: { x: 0 } })
  })

  it('has nothing to sample while empty', () => {
    expect(buffer().sample(5)).toBeUndefined()
    expect(buffer().latest()).toBeUndefined()
  })

  it('never moves an entity backward when a stale snapshot arrives late', () => {
    const b = buffer()
    b.push(10, view({ a: { x: 0 } }))
    b.push(16, view({ a: { x: 60 } }))
    b.push(13, view({ a: { x: -500 } }))
    b.push(16, view({ a: { x: -500 } }))
    expect(b.size).toBe(2)
    expect(b.sample(16)).toEqual({ a: { x: 60 } })
  })

  it('snaps rather than sliding when a field jumps past its threshold (a wrap, a teleport)', () => {
    const b = buffer()
    b.push(10, view({ a: { x: 10 } }))
    b.push(16, view({ a: { x: 950 } }))
    expect(b.sample(13)).toEqual({ a: { x: 950 } })
  })

  it('takes discrete state from the older snapshot, except the fields named as the newer’s', () => {
    const b = buffer()
    b.push(10, view({ a: { x: 0, mode: 'walk', facing: true } }))
    b.push(16, view({ a: { x: 60, mode: 'run', facing: false } }))
    expect(b.sample(13)).toEqual({ a: { x: 30, mode: 'walk', facing: false } })
  })

  it('keeps an entity that is only in the newer snapshot, where authority says it is', () => {
    const b = buffer()
    b.push(10, view({ a: { x: 0 } }))
    b.push(16, view({ a: { x: 60 }, b: { x: 7 } }))
    expect(b.sample(13)).toEqual({ a: { x: 30 }, b: { x: 7 } })
  })

  it('discards snapshots that have aged out of the window, keeping at least two', () => {
    const b = buffer(30)
    for (let tick = 0; tick <= 120; tick += 6) b.push(tick, view({ a: { x: tick } }))
    expect(b.oldestTick).toBeGreaterThanOrEqual(120 - 30)
    expect(b.size).toBeGreaterThanOrEqual(2)
    const lone = buffer(1)
    lone.push(0, view({ a: { x: 0 } }))
    lone.push(500, view({ a: { x: 5 } }))
    expect(lone.size).toBe(2)
  })

  it('says how far the buffer reaches past a moment, so an underrun can be seen', () => {
    const b = buffer()
    b.push(10, view({ a: { x: 0 } }))
    b.push(16, view({ a: { x: 60 } }))
    expect(b.reach(13)).toBe(3)
    expect(b.reach(20)).toBe(-4)
    expect(buffer().reach(5)).toBeUndefined()
  })

  it('clears', () => {
    const b = buffer()
    b.push(10, view({ a: { x: 0 } }))
    b.clear()
    expect(b.size).toBe(0)
  })
})
