// Using a hotspot: the sim walks to it, then acts when the player is within its reach. Every case runs in the pantry,
// the extension's own two-room scene (`src/testing/pantry.ts`): the hall, a pantry behind a door, a jar, a crate behind
// the door, a shelf only usable once the door is open, and a cupboard to hide in.
import { afterEach, describe, expect, it } from 'vitest'
import {
  Cancel,
  Combine,
  EnterCode,
  InteractPending,
  InteractRefused,
  InteractUsed,
  Use,
} from '#src/entries/sim.ts'
import { createPantry, type Pantry } from '#src/testing/pantry.ts'

const made: Pantry[] = []
const pantry = async (...args: Parameters<typeof createPantry>) => {
  const p = await createPantry(...args)
  made.push(p)
  return p
}
afterEach(() => {
  for (const p of made.splice(0)) p.dispose()
})

describe('using a hotspot', () => {
  it('walks, then acts on arrival', async () => {
    const p = await pantry()
    p.use('jar')
    expect(p.events(InteractUsed)).toEqual([])
    p.tick(120)
    expect(p.events(InteractPending)).toEqual([{ at: 'jar' }])
    expect(p.events(InteractUsed)).toEqual([{ at: 'jar', hid: false }])
    expect(p.said()).toEqual(['jar'])
    // It stops walking once it is in reach, rather than on top of the jar.
    const distance = Math.hypot(p.player().x - 3, p.player().z - 1)
    expect(distance).toBeLessThanOrEqual(1.2)
    expect(distance).toBeGreaterThan(1.1)
  })

  it('acts at once when already in reach', async () => {
    const p = await pantry({ start: { x: 3, z: 1.2 } })
    p.send([{ type: Use.id, payload: { at: 'jar' } }])
    expect(p.events(InteractUsed)).toEqual([{ at: 'jar', hid: false }])
    expect(p.said()).toEqual(['jar'])
  })

  it('uses a held item', async () => {
    const p = await pantry({ start: { x: 3, z: 1.2 } })
    p.send([{ type: Use.id, payload: { at: 'jar', held: 'spoon' } }])
    expect(p.events(InteractUsed)).toEqual([{ at: 'jar', held: 'spoon', hid: false }])
    expect(p.said()).toEqual(['jarSpoon'])
  })

  it('refuses a hotspot whose condition fails, and one that is not there', async () => {
    const p = await pantry()
    p.use('shelf')
    p.send([{ type: Use.id, payload: { at: 'ghost' } }])
    expect(p.events(InteractRefused)).toEqual([
      { at: 'shelf', reason: 'unavailable' },
      { at: 'ghost', reason: 'unknown' },
    ])
    p.tick(200)
    expect(p.events(InteractUsed)).toEqual([])
  })

  it('drops a pending use it cannot reach, and never fires it later', async () => {
    const p = await pantry()
    p.use('crate')
    expect(p.events(InteractRefused)).toEqual([{ at: 'crate', reason: 'unreachable' }])
    p.send([{ type: 'pantry.door', payload: { open: true } }])
    p.tick(200)
    expect(p.events(InteractUsed)).toEqual([])
    expect(p.player().x).toBeLessThan(4)
  })

  it('drops a pending use when its condition stops holding on the way', async () => {
    const p = await pantry()
    p.send([{ type: 'pantry.door', payload: { open: true } }])
    p.use('shelf')
    p.tick(5)
    p.send([{ type: 'pantry.door', payload: { open: false } }])
    p.tick(300)
    expect(p.events(InteractRefused)).toEqual([{ at: 'shelf', reason: 'unavailable' }])
    expect(p.events(InteractUsed)).toEqual([])
  })

  it('goes through an open door to a hotspot behind it', async () => {
    const p = await pantry()
    p.send([{ type: 'pantry.door', payload: { open: true } }])
    p.use('crate')
    p.tick(300)
    expect(p.events(InteractUsed)).toEqual([{ at: 'crate', hid: false }])
    expect(p.said()).toEqual(['crate'])
  })

  it('a second Use replaces the first', async () => {
    const p = await pantry()
    p.use('jar')
    p.tick(3)
    p.use('cupboard')
    p.tick(300)
    expect(p.events(InteractPending)).toEqual([{ at: 'jar' }, { at: 'cupboard' }])
    expect(p.events(InteractUsed)).toEqual([{ at: 'cupboard', hid: true }])
  })

  it('Cancel drops the pending use', async () => {
    const p = await pantry()
    p.use('jar')
    p.tick(3)
    p.send([{ type: Cancel.id, payload: {} }])
    p.tick(300)
    expect(p.events(InteractUsed)).toEqual([])
  })

  it('hides at a hiding place, and sends no verb', async () => {
    const p = await pantry({ start: { x: 3, z: 2.8 } })
    p.send([{ type: Use.id, payload: { at: 'cupboard' } }])
    expect(p.hid).toEqual(['cupboard'])
    expect(p.events(InteractUsed)).toEqual([{ at: 'cupboard', hid: true }])
    expect(p.said()).toEqual([])
  })

  it('uses a hiding place as an ordinary hotspot when an item is held', async () => {
    const p = await pantry({ start: { x: 3, z: 2.8 } })
    p.send([{ type: Use.id, payload: { at: 'cupboard', held: 'spoon' } }])
    expect(p.hid).toEqual([])
    expect(p.events(InteractUsed)).toEqual([{ at: 'cupboard', held: 'spoon', hid: false }])
    expect(p.said()).toEqual(['cupboard'])
  })

  it('combines two items and enters a code at once', async () => {
    const p = await pantry()
    p.send([{ type: Combine.id, payload: { a: 'spoon', b: 'lid' } }])
    p.send([{ type: EnterCode.id, payload: { code: '42' } }])
    expect(p.said()).toEqual(['combined', 'codeRight'])
  })

  it('lists the hotspots in reach, nearest first, leaving out one that is not usable', async () => {
    const p = await pantry({ start: { x: 3, z: 2.1 } })
    expect(p.inReach().map((h) => h.id)).toEqual(['cupboard', 'jar'])
    const q = await pantry({ start: { x: 6, z: 1.2 } })
    expect(q.inReach()).toEqual([])
    q.send([{ type: 'pantry.door', payload: { open: true } }])
    expect(q.inReach().map((h) => h.id)).toEqual(['shelf'])
  })

  it('gives the same hash for the same commands', async () => {
    const a = await pantry()
    const b = await pantry()
    for (const p of [a, b]) {
      p.use('jar')
      p.tick(30)
      p.use('cupboard')
      p.tick(120)
    }
    expect(a.hash()).toBe(b.hash())
    expect(a.events(InteractUsed)).toEqual(b.events(InteractUsed))
  })
})
