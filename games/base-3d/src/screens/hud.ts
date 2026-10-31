// The HUD's state (DESIGN.md §9.5, GAME-3D.1e part 5a), read from the running sim each animation frame: Wick's
// hearts, the embers, the equipped item and its ammo, and the boss bar while a Warden lives. Presentation: it only
// reads the sim (law 1).
import type { Sim } from '@mcthaydt/automata-sim'
import { Enemy, Fighter, Hero } from '../components.ts'
import { enemyOf } from '../constants/enemies.ts'
import { ItemCode } from '../constants/items.ts'
import { Dungeon, Inventory, Progress } from '../resources.ts'

export type ItemName = keyof typeof ItemCode
export type HeartFill = 'full' | 'half' | 'empty'

export interface HudState {
  /** Wick's health and its maximum, in half-hearts. */
  readonly health: number
  readonly maxHealth: number
  readonly embers: number
  /** The small keys in hand (the kiln's, GAME-3D.1f). */
  readonly smallKeys: number
  /** The item on the Item button, and its ammo for the sling and the bombs. */
  readonly equipped: { readonly item: ItemName; readonly ammo?: number } | undefined
  /** The boss bar: the boss's `ENEMIES` id (its name is the copy's, copy.ts) and its health. */
  readonly boss: { readonly id: string; readonly health: number; readonly max: number } | undefined
}

/** The enemies with a boss bar, by `ENEMIES` id. */
const BOSSES: ReadonlySet<string> = new Set(['warden'])

/**
 * The running sim, given by the screens' `watchSim` (screens.ts), as `settingsInPlay` holds the settings store, and
 * the ways to the Items and Map screens while play is open (their HUD buttons).
 */
export const hudInPlay: {
  sim: Sim | undefined
  openItems: (() => void) | undefined
  openMap: (() => void) | undefined
} = {
  sim: undefined,
  openItems: undefined,
  openMap: undefined,
}

/** One fill a heart: two half-hearts make a heart, and an odd maximum rounds up to a whole heart. */
export function heartsOf(health: number, maxHealth: number): HeartFill[] {
  const hearts = Math.ceil(maxHealth / 2)
  const left = Math.max(0, Math.min(health, maxHealth))
  return Array.from({ length: hearts }, (_, index): HeartFill => {
    const halves = left - index * 2
    return halves >= 2 ? 'full' : halves === 1 ? 'half' : 'empty'
  })
}

const ITEM_BY_CODE = Object.fromEntries(
  Object.entries(ItemCode).map(([name, code]) => [code, name]),
) as Readonly<Record<number, ItemName>>

function equippedOf(inventory: {
  readonly equipped: number
  readonly pellets: number
  readonly bombAmmo: number
}): HudState['equipped'] {
  const item = ITEM_BY_CODE[inventory.equipped]
  if (item === undefined) return undefined
  if (item === 'sling') return { item, ammo: inventory.pellets }
  if (item === 'bombs') return { item, ammo: inventory.bombAmmo }
  return { item }
}

/** The boss bar: the first living boss (only the Warden has a bar) by sid. */
function bossOf(sim: Sim): HudState['boss'] {
  for (const entity of sim.query(Enemy, Fighter)) {
    const type = enemyOf(entity.get(Enemy).kind)
    const { health } = entity.get(Fighter)
    if (type !== undefined && BOSSES.has(type.id) && health > 0)
      return { id: type.id, health, max: type.health }
  }
  return undefined
}

/** What the HUD shows of `sim`; nothing without one (before play has a sim, or after it ends). */
export function hudOf(sim: Sim | undefined): HudState | undefined {
  if (sim === undefined) return undefined
  const progress = sim.resource(Progress)
  const wick = sim.query(Hero, Fighter)[0]
  return {
    health: wick?.get(Fighter).health ?? 0,
    maxHealth: progress.maxHealth,
    embers: progress.embers,
    smallKeys: sim.resource(Dungeon).smallKeys,
    equipped: equippedOf(sim.resource(Inventory)),
    boss: bossOf(sim),
  }
}
