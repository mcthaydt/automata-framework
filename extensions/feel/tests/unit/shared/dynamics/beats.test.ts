// Beats (M6.1a step 3, F-a), from the arcade source's `room-beats` cases: events are held until the drawn tick reaches them, and
// each is answered once, so a feel never lands before the picture shows its cause.
import { describe, expect, it } from 'vitest'
import { Beats } from '#src/shared/dynamics/beats.ts'

const slam = { type: 'slam', payload: {} }
const door = { type: 'door.open', payload: {} }

describe('Beats', () => {
  it('holds an event until the drawn tick reaches it, and gives it once', () => {
    const beats = new Beats()
    beats.noteAt(30, [slam])
    expect(beats.reach(29)).toEqual([])
    expect(beats.reach(30)).toEqual([{ tick: 30, event: slam }])
    expect(beats.reach(31)).toEqual([])
  })
  it('refuses a batch delivered again, before or after it was reached', () => {
    const beats = new Beats()
    beats.noteAt(30, [slam])
    beats.noteAt(30, [slam])
    expect(beats.reach(30)).toHaveLength(1)
    beats.noteAt(30, [slam])
    expect(beats.reach(31)).toEqual([])
  })
  it('tells two events of one tick apart, by their place in the batch', () => {
    const beats = new Beats()
    beats.noteAt(30, [slam, door])
    expect(beats.reach(30).map((b) => b.event.type)).toEqual(['slam', 'door.open'])
  })
  it('gives due events in tick order', () => {
    const beats = new Beats()
    beats.noteAt(32, [door])
    beats.noteAt(30, [slam])
    expect(beats.reach(40).map((b) => b.tick)).toEqual([30, 32])
  })
  it('drops, unanswered, what the picture passed long ago, so a tab back from the background does not flood', () => {
    const beats = new Beats()
    beats.noteAt(10, [slam])
    beats.noteAt(12, [slam])
    beats.noteAt(95, [door])
    expect(beats.reach(100).map((b) => b.tick)).toEqual([95])
    expect(beats.reach(200)).toEqual([])
  })
  it('still answers an event a moment behind the picture, and a window the game sets', () => {
    const beats = new Beats()
    beats.noteAt(90, [slam])
    expect(beats.reach(100)).toHaveLength(1)
    const tight = new Beats({ staleTicks: 5 })
    tight.noteAt(90, [slam])
    expect(tight.reach(100)).toEqual([])
  })
  it('forgets batches long behind the drawn tick, so a long run does not grow it', () => {
    const beats = new Beats()
    for (let tick = 0; tick < 2_000; tick += 1) {
      beats.noteAt(tick, [slam])
      beats.reach(tick)
    }
    expect(beats.remembered).toBeLessThanOrEqual(601)
  })
  it('clears', () => {
    const beats = new Beats()
    beats.noteAt(5, [slam])
    beats.clear()
    expect(beats.reach(10)).toEqual([])
    expect(beats.remembered).toBe(0)
  })
})
