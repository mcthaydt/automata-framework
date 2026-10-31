// base-3d's own words (GAME-3D.1e part 5b), as DX.2d gives the default screens theirs: one record a language, English
// by default, read by the HUD and the Items screen through the live copy (copy.svelte.ts), so a language change shows
// the new words in place. The game has only English so far; a language adds its record to `BASE3D_COPY`.
import type { SlotId } from './items.ts'

export interface Base3dCopy {
  /** The game's title: the splash, the menu and the page (read once at boot, as `defineGame`'s title). */
  readonly title: string
  readonly hud: {
    /** The hearts' accessible name, from health and its maximum in half-hearts. */
    readonly hearts: (health: number, maxHealth: number) => string
    readonly embers: (count: number) => string
    readonly smallKeys: (count: number) => string
    /** The HUD's buttons to the Items and Map screens. */
    readonly items: string
    readonly map: string
    readonly bossHealth: (name: string) => string
  }
  readonly items: {
    readonly title: string
    readonly back: string
    readonly region: string
    readonly notFound: string
    /** Under the sword and the shield: owned, on buttons of their own, so never put on the Item button. */
    readonly ownButton: string
    readonly heartPieces: string
    readonly piecesOf: (count: number) => string
    readonly embers: string
    readonly smallKeys: string
    readonly bossKey: string
    readonly map: string
    readonly compass: string
    readonly yes: string
    readonly no: string
  }
  readonly map: {
    readonly title: string
    readonly close: string
    /** The plan's accessible name. */
    readonly plan: string
  }
  /** The splash, the end, the game over and the Lock mode section (GAME-3D.1a part 2, G3-t). */
  readonly splash: { readonly mark: string; readonly hint: string }
  readonly end: { readonly title: string; readonly menu: string }
  readonly gameOver: { readonly title: string; readonly continue: string; readonly quit: string }
  readonly lockMode: {
    readonly heading: string
    readonly label: string
    readonly toggle: string
    readonly hold: string
  }
  /** The keys' and touch buttons' labels, read once at boot (the input map is data). */
  readonly keys: {
    readonly lock: string
    readonly slash: string
    readonly guard: string
    readonly point: string
    readonly pickup: string
    readonly action: string
    readonly item: string
  }
  readonly itemNames: Readonly<Record<SlotId, string>>
  /** Each boss's name by its `ENEMIES` id, for the boss bar. */
  readonly bossNames: Readonly<Record<string, string>>
}

const EN: Base3dCopy = {
  title: 'The Cold Kiln',
  hud: {
    hearts: (health, maxHealth) => `Hearts ${health / 2} of ${maxHealth / 2}`,
    embers: (count) => `Embers ${count}`,
    smallKeys: (count) => `Small keys ${count}`,
    items: 'Items',
    map: 'Map',
    bossHealth: (name) => `${name} health`,
  },
  items: {
    title: 'Items',
    back: 'Back',
    region: 'Items',
    notFound: 'Not found yet',
    ownButton: 'Own button',
    heartPieces: 'Heart pieces',
    piecesOf: (count) => `${count} of 4`,
    embers: 'Embers',
    smallKeys: 'Small keys',
    bossKey: 'Boss key',
    map: 'Map',
    compass: 'Compass',
    yes: 'Yes',
    no: 'No',
  },
  map: { title: 'Map', close: 'Close', plan: 'Map of the area: Wick’s arrow and the camera’s view' },
  splash: { mark: 'AutomataFramework', hint: 'Press any key or tap' },
  end: { title: 'The ember is yours', menu: 'Menu' },
  gameOver: { title: 'The flame went out', continue: 'Continue', quit: 'Quit' },
  lockMode: { heading: 'Game', label: 'Lock mode', toggle: 'Toggle', hold: 'Hold' },
  keys: {
    lock: 'Lock',
    slash: 'Slash',
    guard: 'Guard',
    point: 'Point',
    pickup: 'Pick up',
    action: 'Action',
    item: 'Item',
  },
  itemNames: {
    sword: 'Sword',
    shield: 'Shield',
    sling: 'Spark Sling',
    bombs: 'Ember Bombs',
    hookchain: 'Hookchain',
  },
  bossNames: { warden: 'The Ashen Warden' },
}

/** The game's words by language tag. English is the source language and the fallback. */
export const BASE3D_COPY: Readonly<Record<string, Base3dCopy>> & { readonly en: Base3dCopy } = { en: EN }

/** The words for `locale`: its own record, else its language's (`fr` for `fr-CA`), else English. */
export function base3dCopy(locale: string, table: typeof BASE3D_COPY = BASE3D_COPY): Base3dCopy {
  return table[locale] ?? table[locale.split('-')[0] ?? ''] ?? table.en
}
