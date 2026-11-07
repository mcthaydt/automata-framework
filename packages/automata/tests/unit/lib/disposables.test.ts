import { describe, expect, it } from 'vitest'
import { disposables } from '#src/shared/lib/disposables.ts'

describe('disposables', () => {
  it('runs what was added once, last added first', () => {
    const order: string[] = []
    const bag = disposables()
    bag.add(() => order.push('first'))
    bag.add(() => order.push('second'))
    bag.dispose()
    bag.dispose()
    expect(order).toEqual(['second', 'first'])
  })

  it('runs every function even when one throws, then rethrows the first error', () => {
    const order: string[] = []
    const bag = disposables()
    bag.add(() => order.push('a'))
    bag.add(() => {
      throw new Error('boom 1')
    })
    bag.add(() => {
      throw new Error('boom 2')
    })
    bag.add(() => order.push('d'))
    // Disposal goes last-in first-out, so "boom 2" is the first error met.
    expect(() => bag.dispose()).toThrow('boom 2')
    expect(order).toEqual(['d', 'a'])
  })

  it('runs a function added after disposal at once, so a late arrival is never leaked', () => {
    const bag = disposables()
    bag.dispose()
    let ran = 0
    bag.add(() => {
      ran += 1
    })
    expect(ran).toBe(1)
    expect(bag.disposed).toBe(true)
  })

  it('lets a function leave the bag before disposal, so a stopped listener is not kept', () => {
    const bag = disposables()
    let ran = 0
    const remove = bag.add(() => {
      ran += 1
    })
    remove()
    bag.dispose()
    expect(ran).toBe(0)
  })

  it('runs every undo even when each one removes itself from the bag as it runs', () => {
    const bag = disposables()
    const order: number[] = []
    for (const n of [1, 2, 3]) {
      const remove = bag.add(() => {
        order.push(n)
        remove()
      })
    }
    bag.dispose()
    expect(order).toEqual([3, 2, 1])
  })
})
