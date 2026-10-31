// base-3d's save, captured from and applied to the sim (DESIGN.md §12.1): outside the sim boundary, so the sim never
// sees the save. The sim holds only what it changes (`Progress`); every other field, unknown ones included, is kept
// from the slot applied to that sim, so a write never drops what a load brought in. New game applies nothing (the
// default screens capture a fresh sim), so a sim no slot was applied to captures over `newGame()`: what an earlier
// Continue brought in never carries into a new game. Continue always starts a fresh sim at
// the area's entrance (GAME3D-D9): nothing here moves Wick.
import type { GameSaves } from '@mcthaydt/automata-game'
import type { Sim } from '@mcthaydt/automata-sim'
import { Fighter, Hero } from '../components.ts'
import { ItemCode } from '../constants/items.ts'
import { Dungeon, Inventory, Progress } from '../resources.ts'
import { type Base3dSave, base3dSave, newGame } from '../state/save.ts'

/** One game's saves: `defineGame`'s `saves`. A new instance per game, since it remembers the slot it applied. */
export function base3dSaves(): GameSaves<Base3dSave> {
  // The slot applied to each sim (a disposed sim's entry goes with it).
  const appliedTo = new WeakMap<Sim, Base3dSave>()
  return {
    def: base3dSave,
    capture: (sim: Sim) => {
      const applied = appliedTo.get(sim) ?? newGame()
      return {
        ...applied,
        embers: sim.resource(Progress).embers,
        hearts: {
          max: Math.floor(sim.resource(Progress).maxHealth / 2),
          pieces: [...sim.resource(Dungeon).heartPieces],
        },
        ...captureInventory(sim.resource(Inventory)),
        ...captureDungeon(sim.resource(Dungeon), applied),
        // The sim starts at tick 0 on every Continue, so the play time is the slot's plus this sim's.
        playTicks: applied.playTicks + sim.tick,
      }
    },
    apply: (sim: Sim, data: Base3dSave) => {
      appliedTo.set(sim, data)
      sim.resource(Progress).embers = data.embers
      // A loaded game starts full at the area entrance, with the save's hearts as Wick's maximum (DESIGN.md §7.8).
      const maxHealth = data.hearts.max * 2
      sim.resource(Progress).maxHealth = maxHealth
      for (const { sid } of sim.query(Hero, Fighter)) sim.entity(sid)?.set(Fighter, { health: maxHealth })
      // The dungeon's pieces, keys, map, compass, visits and heart pieces (DESIGN.md §10): the flags whole, so a flag this build does
      // not know is kept.
      Object.assign(sim.resource(Dungeon), {
        flags: [...data.flags].sort(),
        smallKeys: data.kiln.smallKeys,
        bossKey: data.kiln.bossKey,
        map: data.kiln.map,
        compass: data.kiln.compass,
        visited: [...data.kiln.visited].sort(),
        heartPieces: [...data.hearts.pieces].sort(),
      })
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

/** The sim's dungeon as the save holds it (DESIGN.md §12.1): the flags, and the kiln's keys, map, compass and visits. */
function captureDungeon(
  dungeon: {
    readonly flags: readonly string[]
    readonly smallKeys: number
    readonly bossKey: boolean
    readonly map: boolean
    readonly compass: boolean
    readonly visited: readonly string[]
  },
  applied: Base3dSave,
): Pick<Base3dSave, 'flags' | 'kiln'> {
  const { flags, smallKeys, bossKey, map, compass, visited } = dungeon
  return {
    flags: [...flags],
    kiln: { ...applied.kiln, smallKeys, bossKey, map, compass, visited: [...visited] },
  }
}
