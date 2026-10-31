// base-3d's save, captured from and applied to the sim (DESIGN.md §12.1): outside the sim boundary, so the sim never
// sees the save. The sim holds only what it changes (`Progress`); every other field, unknown ones included, is kept
// from the slot last applied, so a write never drops what a load brought in. Continue always starts a fresh sim at
// the area's entrance (GAME3D-D9): nothing here moves Wick.
import type { GameSaves } from '@mcthaydt/automata-game'
import type { Sim } from '@mcthaydt/automata-sim'
import { Fighter, Hero } from '../components.ts'
import { ItemCode } from '../constants/items.ts'
import { Inventory, Progress } from '../resources.ts'
import { type Base3dSave, base3dSave, newGame } from '../state/save.ts'

/** One game's saves: `defineGame`'s `saves`. A new instance per game, since it remembers the slot it applied. */
export function base3dSaves(): GameSaves<Base3dSave> {
  let applied = newGame()
  return {
    def: base3dSave,
    capture: (sim: Sim) => ({
      ...applied,
      embers: sim.resource(Progress).embers,
      hearts: { ...applied.hearts, max: Math.floor(sim.resource(Progress).maxHealth / 2) },
      ...captureInventory(sim.resource(Inventory)),
      // The sim starts at tick 0 on every Continue, so the play time is the slot's plus this sim's.
      playTicks: applied.playTicks + sim.tick,
    }),
    apply: (sim: Sim, data: Base3dSave) => {
      applied = data
      sim.resource(Progress).embers = data.embers
      // A loaded game starts full at the area entrance, with the save's hearts as Wick's maximum (DESIGN.md §7.8).
      const maxHealth = data.hearts.max * 2
      sim.resource(Progress).maxHealth = maxHealth
      for (const { sid } of sim.query(Hero, Fighter)) sim.entity(sid)?.set(Fighter, { health: maxHealth })
      Object.assign(sim.resource(Inventory), {
        ...data.items,
        equipped: data.equipped === null ? 0 : ItemCode[data.equipped],
        pellets: data.ammo.pellets,
        bombAmmo: data.ammo.bombs,
      })
    },
  }
}

const EQUIPPED: readonly Base3dSave['equipped'][] = [null, 'sling', 'bombs', 'hookchain']

/** The sim's inventory as the save holds it (DESIGN.md §12.1): items, ammo and the equipped item. */
function captureInventory(inventory: {
  readonly sling: boolean
  readonly bombs: boolean
  readonly hookchain: boolean
  readonly equipped: number
  readonly pellets: number
  readonly bombAmmo: number
}): Pick<Base3dSave, 'items' | 'ammo' | 'equipped'> {
  const { sling, bombs, hookchain, equipped, pellets, bombAmmo } = inventory
  return {
    items: { sling, bombs, hookchain },
    ammo: { pellets, bombs: bombAmmo },
    equipped: EQUIPPED[equipped] ?? null,
  }
}
