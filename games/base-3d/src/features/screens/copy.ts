// base-3d's own words (from the catalog through `t()`), as the default screens have theirs: one record a
// language, read by every base-3d screen through the live copy (copy.svelte.ts), so a language change shows the new
// words in place. The game ships English only.
import { t } from './t.ts'

export interface Base3dCopy {
  /** The game's title: the splash, the menu and the page (read once at boot, as `defineGame`'s title). */
  readonly title: string
  readonly hud: {
    /** The ember count's accessible name. */
    readonly embers: (count: number, total: number) => string
  }
  /** The menu's own button (the save's words are the framework's). */
  readonly menu: { readonly settings: string }
  /** The splash and the end (G3-t). */
  readonly splash: { readonly mark: string; readonly hint: string }
  readonly end: { readonly title: string; readonly menu: string }
  /** The keys' and touch buttons' labels, read once at boot (the input map is data). */
  readonly keys: { readonly roll: string }
}

/** Reads one message of the catalog by key, with its inputs: `t` (t.ts), or a test's recorder. */
export type Say = (key: string, inputs?: Readonly<Record<string, unknown>>) => string

/** The game's words from the catalog (src/messages/ui/en.json, G3-t), each key read through `say`. */
export function copyFrom(say: Say): Base3dCopy {
  return {
    title: say('title'),
    hud: { embers: (count, total) => say('hud_embers', { count, total }) },
    menu: { settings: say('menu_settings') },
    splash: { mark: say('splash_mark'), hint: say('splash_hint') },
    end: { title: say('end_title'), menu: say('end_menu') },
    keys: { roll: say('key_roll') },
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
