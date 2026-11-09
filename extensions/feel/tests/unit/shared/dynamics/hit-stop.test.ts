// The hit-stop (M6.1a step 2, F-b): a view's pose, squash and follow freeze for a beat; its position never does.
import { describe, expect, it } from 'vitest'
import { HitStop } from '#src/shared/dynamics/hit-stop.ts'

describe('HitStop', () => {
  it('freezes from the start until the end of its time, and not before or after', () => {
    const stop = new HitStop()
    expect(stop.frozen(0)).toBe(false)
    stop.start(1000, 90)
    expect(stop.frozen(999)).toBe(false)
    expect(stop.frozen(1000)).toBe(true)
    expect(stop.frozen(1089)).toBe(true)
    expect(stop.frozen(1090)).toBe(false)
  })
  it('never shortens a freeze under way, and extends it', () => {
    const stop = new HitStop()
    stop.start(1000, 100)
    stop.start(1010, 20)
    expect(stop.frozen(1099)).toBe(true)
    stop.start(1050, 100)
    expect(stop.frozen(1140)).toBe(true)
    expect(stop.frozen(1150)).toBe(false)
  })
  it('settles at once', () => {
    const stop = new HitStop()
    stop.start(0, 500)
    stop.settle()
    expect(stop.frozen(10)).toBe(false)
  })
})
