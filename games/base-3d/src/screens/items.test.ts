// The Items screen's contents from the save as play captures it (DESIGN.md §9.3, GAME-3D.1e part 5b).
import { describe, expect, it } from 'vitest'
import { newGame } from '../state/save.ts'
import { itemsOf } from './items.ts'

describe('itemsOf', () => {
  it('lists the five slots in order: the sword and shield always owned, the rest outlined until found', () => {
    const view = itemsOf(newGame())
    expect(view.slots.map((slot) => [slot.id, slot.owned, slot.equippable])).toEqual([
      ['sword', true, false],
      ['shield', true, false],
      ['sling', false, true],
      ['bombs', false, true],
      ['hookchain', false, true],
    ])
    expect(view.equipped).toBeUndefined()
    expect(view).toMatchObject({ embers: 0 })
  })

  it('shows the sling’s pellets and the bombs’ count against their most, and the equipped item', () => {
    const view = itemsOf({
      ...newGame(),
      items: { sling: true, bombs: true, hookchain: false },
      ammo: { pellets: 12, bombs: 3 },
      equipped: 'bombs',
      embers: 140,
    })
    expect(view.slots[2]).toMatchObject({ id: 'sling', owned: true, ammo: { count: 12, most: 30 } })
    expect(view.slots[3]).toMatchObject({ id: 'bombs', owned: true, ammo: { count: 3, most: 10 } })
    expect(view.slots[4]).toMatchObject({ id: 'hookchain', owned: false })
    expect(view.slots[4]?.ammo).toBeUndefined()
    expect(view).toMatchObject({ equipped: 'bombs', embers: 140 })
  })

  it('reads the kiln’s keys, map and compass, and no heart pieces (cut by the 2026-10-31 rescope)', () => {
    const view = itemsOf({
      ...newGame(),
      hearts: { max: 5, pieces: ['a', 'b', 'c', 'd', 'e', 'f'] },
      kiln: { ...newGame().kiln, smallKeys: 2, bossKey: true, map: true, compass: false },
    })
    expect(view).not.toHaveProperty('heartPieces')
    expect(view.kiln).toEqual({ smallKeys: 2, bossKey: true, map: true, compass: false })
  })

  it('shows a pending choice as the equipped item, so the screen answers before the sim runs again', () => {
    const save = {
      ...newGame(),
      items: { sling: true, bombs: false, hookchain: true },
      equipped: 'sling' as const,
    }
    expect(itemsOf(save, 'hookchain').equipped).toBe('hookchain')
  })
})
