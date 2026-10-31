// base-3d's own words (GAME-3D.1e part 5b; from the catalog through `t()` since GAME-3D.1a part 2, G3-t), as DX.2d
// gives the default screens theirs: one record a language, read by every base-3d screen through the live copy
// (copy.svelte.ts), so a language change shows the new words in place. The game ships English only.
import type { SlotId } from './items.ts'
import { t } from './t.ts'

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

/** Reads one message of the catalog by key, with its inputs: `t` (t.ts), or a test's recorder. */
export type Say = (key: string, inputs?: Readonly<Record<string, unknown>>) => string

/** The game's words from the catalog (src/messages/ui/en.json, G3-t), each key read through `say`. */
export function copyFrom(say: Say): Base3dCopy {
  return {
    title: say('title'),
    hud: {
      hearts: (health, maxHealth) => say('hud_hearts', { health: health / 2, max: maxHealth / 2 }),
      embers: (count) => say('hud_embers', { count }),
      smallKeys: (count) => say('hud_small_keys', { count }),
      items: say('hud_items'),
      map: say('hud_map'),
      bossHealth: (name) => say('hud_boss_health', { name }),
    },
    items: {
      title: say('items_title'),
      back: say('items_back'),
      region: say('items_region'),
      notFound: say('items_not_found'),
      ownButton: say('items_own_button'),
      embers: say('items_embers'),
      smallKeys: say('items_small_keys'),
      bossKey: say('items_boss_key'),
      map: say('items_map'),
      compass: say('items_compass'),
      yes: say('items_yes'),
      no: say('items_no'),
    },
    map: { title: say('map_title'), close: say('map_close'), plan: say('map_plan') },
    splash: { mark: say('splash_mark'), hint: say('splash_hint') },
    end: { title: say('end_title'), menu: say('end_menu') },
    gameOver: {
      title: say('game_over_title'),
      continue: say('game_over_continue'),
      quit: say('game_over_quit'),
    },
    lockMode: {
      heading: say('lock_mode_heading'),
      label: say('lock_mode_label'),
      toggle: say('lock_mode_toggle'),
      hold: say('lock_mode_hold'),
    },
    keys: {
      lock: say('key_lock'),
      slash: say('key_slash'),
      guard: say('key_guard'),
      point: say('key_point'),
      pickup: say('key_pickup'),
      action: say('key_action'),
      item: say('key_item'),
    },
    itemNames: {
      sword: say('item_sword'),
      shield: say('item_shield'),
      sling: say('item_sling'),
      bombs: say('item_bombs'),
      hookchain: say('item_hookchain'),
    },
    bossNames: { warden: say('boss_warden') },
  }
}

/** The game's words by language tag. English is the source language and the fallback. */
export const BASE3D_COPY: Readonly<Record<string, Base3dCopy>> & { readonly en: Base3dCopy } = {
  en: copyFrom(t as Say),
}

/** The words for `locale`: its own record, else its language's (`fr` for `fr-CA`), else English. */
export function base3dCopy(locale: string, table: typeof BASE3D_COPY = BASE3D_COPY): Base3dCopy {
  return table[locale] ?? table[locale.split('-')[0] ?? ''] ?? table.en
}
