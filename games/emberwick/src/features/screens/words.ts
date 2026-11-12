// Emberwick's words, one catalog per language (messages/ui/<lang>.json, the inlang format `automata words` writes).
// The screens are plain DOM, so they read the JSON directly: there is no Paraglide here. All six ship in the bundle,
// because a language switch must be instant and offline.
import en from '../../../messages/ui/en.json' with { type: 'json' }
import es419 from '../../../messages/ui/es-419.json' with { type: 'json' }
import ja from '../../../messages/ui/ja.json' with { type: 'json' }
import ko from '../../../messages/ui/ko.json' with { type: 'json' }
import ptBR from '../../../messages/ui/pt-BR.json' with { type: 'json' }
import zhHans from '../../../messages/ui/zh-Hans.json' with { type: 'json' }

/** Every line a screen shows, in one language. The studio's mark and the key caps are not words. */
export interface EmberwickWords {
  /** A screen reader's name for the splash panel; never drawn. */
  readonly splashLabel: string
  readonly splashHint: string
  readonly menuTitle: string
  readonly menuHint: string
  readonly play: string
  /** The three verbs after the key caps on the menu. */
  readonly keysMove: string
  readonly keysJump: string
  readonly keysPause: string
  /** The corner button's name: the button itself shows two bars. */
  readonly pause: string
  readonly pausedTitle: string
  readonly resume: string
  readonly backToMenu: string
  readonly endTitle: string
  readonly playAgain: string
  readonly menu: string
  /** How long the climb took; `seconds` is already written for the player's language. */
  readonly time: (seconds: string) => string
}

type Catalog = typeof en

const CATALOGS: Readonly<Record<string, Catalog>> = {
  en,
  ja,
  ko,
  'es-419': es419,
  'pt-BR': ptBR,
  'zh-Hans': zhHans,
}

const primary = (tag: string): string => tag.toLowerCase().split('-')[0] ?? tag

/**
 * The catalog for a locale: the same tag (ignoring case), else the first with the same primary language, so `pt` finds
 * `pt-BR` and `zh-CN` finds `zh-Hans`; English otherwise. This is the framework's own matching rule, kept in five lines
 * because core does not export it.
 */
function catalogFor(locale: string): Catalog {
  const tags = Object.keys(CATALOGS)
  const tag =
    tags.find((candidate) => candidate.toLowerCase() === locale.toLowerCase()) ??
    tags.find((candidate) => primary(candidate) === primary(locale)) ??
    'en'
  return CATALOGS[tag] ?? en
}

/** The words for `locale`; English where the game has no such language. */
export function emberwickWords(locale: string): EmberwickWords {
  const catalog = catalogFor(locale)
  return {
    splashLabel: catalog.splash_label,
    splashHint: catalog.splash_hint,
    menuTitle: catalog.menu_title,
    menuHint: catalog.menu_hint,
    play: catalog.play,
    keysMove: catalog.keys_move,
    keysJump: catalog.keys_jump,
    keysPause: catalog.keys_pause,
    pause: catalog.pause,
    pausedTitle: catalog.paused_title,
    resume: catalog.resume,
    backToMenu: catalog.back_to_menu,
    endTitle: catalog.end_title,
    playAgain: catalog.play_again,
    menu: catalog.menu,
    time: (seconds) => catalog.end_time.replaceAll('{seconds}', seconds),
  }
}
