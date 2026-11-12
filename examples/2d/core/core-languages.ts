// core-languages: The menus in six languages
//
// Shows: a game that lists its languages gets the title, pause and settings menus in all six with no words of its
//   own: English, 日本語, 한국어, Español, Português and 简体中文. Pause, open Settings, pick a language in the Language
//   group and the menus change at once and stay changed on the next visit.
// Controls: tap or click; Escape or P to pause
// Packages: @automataframework/framework
// Difficulty: ★☆☆☆
// Tier: core
import { DEFAULT_LOCALES, defineGame } from '@automataframework/framework'

// The pixel font, cut to the words these menus show (content/fonts.toml): `fonts.css` is served beside this page
// (public/core/languages/) and sets the face each language draws in, so Japanese, Korean and Chinese are not left to a device.
document.head.append(
  Object.assign(document.createElement('link'), {
    rel: 'stylesheet',
    href: 'fonts.css',
    crossOrigin: 'anonymous',
  }),
)

export default defineGame({
  id: 'core-languages',
  size: { width: 320, height: 180 },
  sim: { plugins: [] },
  // The languages the game ships, in the order Settings lists them: the framework's six, which its own words are in.
  locale: { locales: [...DEFAULT_LOCALES], baseLocale: 'en' },
  // The first run's language screen has its own example (core-first-run); here the player picks in Settings.
  firstRunLanguage: false,
  draw: (ctx) => {
    ctx.rect(0, 0, ctx.width, ctx.height, 0x3b303c)
  },
})
