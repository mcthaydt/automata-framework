// core-languages: The menus in six languages
//
// Shows: a game that lists its languages gets the title, pause and settings menus in all six with no words of its
//   own: English, 日本語, 한국어, Español, Português and 简体中文. Pause, open Settings, pick a language in the Language
//   group and the menus change at once and stay changed on the next visit.
// Controls: tap or click; Escape or P to pause
// Packages: @automata/framework
// Difficulty: ★☆☆☆
// Tier: core
import { defineGame } from '@automata/framework'

export default defineGame({
  id: 'core-languages',
  size: { width: 320, height: 180 },
  sim: { plugins: [] },
  // The languages the game ships, in the order Settings lists them. The framework's own words are in each of them.
  locale: { locales: ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'], baseLocale: 'en' },
  // The first run's language screen has its own example (core-first-run); here the player picks in Settings.
  firstRunLanguage: false,
  draw: (ctx) => {
    ctx.rect(0, 0, ctx.width, ctx.height, 0x3b303c)
  },
})
