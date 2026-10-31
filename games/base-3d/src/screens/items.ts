// The Items screen's contents (DESIGN.md §9.3, GAME-3D.1e part 5b): the five slots, the ammo, the equipped item, the
// heart pieces toward the next heart, the embers and the kiln's keys, map and compass, read from the save as play
// captures it (the sim holds only the items and ammo; the pieces and the kiln are the save's). Presentation; the
// words are the copy's (copy.ts).
import { BOMBS, SLING } from '../constants/items.ts'
import type { Base3dSave } from '../state/save.ts'
import type { ItemName } from './hud.ts'

export type SlotId = 'sword' | 'shield' | ItemName

export interface ItemSlot {
  readonly id: SlotId
  readonly owned: boolean
  /** Whether choosing it puts it on the Item button: the sword and shield have their own buttons. */
  readonly equippable: boolean
  readonly ammo?: { readonly count: number; readonly most: number }
}

export interface ItemsView {
  readonly slots: readonly ItemSlot[]
  readonly equipped: ItemName | undefined
  /** Heart pieces toward the next heart: 0 to 3, every 4 being a heart already counted in `hearts.max`. */
  readonly heartPieces: number
  readonly embers: number
  readonly kiln: Pick<Base3dSave['kiln'], 'smallKeys' | 'bossKey' | 'map' | 'compass'>
}

/** What the Items screen shows of `save`, with `pending` (an equip asked for while the sim is paused) as equipped. */
export function itemsOf(save: Base3dSave, pending?: ItemName): ItemsView {
  const slot = (id: SlotId, owned: boolean, ammo?: ItemSlot['ammo']): ItemSlot => ({
    id,
    owned,
    equippable: id !== 'sword' && id !== 'shield',
    ...(ammo !== undefined && owned ? { ammo } : {}),
  })
  const { smallKeys, bossKey, map, compass } = save.kiln
  return {
    slots: [
      slot('sword', true),
      slot('shield', true),
      slot('sling', save.items.sling, { count: save.ammo.pellets, most: SLING.maxPellets }),
      slot('bombs', save.items.bombs, { count: save.ammo.bombs, most: BOMBS.max }),
      slot('hookchain', save.items.hookchain),
    ],
    equipped: pending ?? save.equipped ?? undefined,
    heartPieces: save.hearts.pieces.length % 4,
    embers: save.embers,
    kiln: { smallKeys, bossKey, map, compass },
  }
}
