// core-first-run: A first run asks for a language and warns about flashing
//
// Shows: the first time a game is opened on a device it asks for a language, with the device's own already chosen, then
//   warns, in that language, about flashing lights and offers a switch to reduce them (the game's own setting), and only then shows the title.
//   Both screens show once per device. Opened standalone the language screen shows; a Ruken host supplies the player's
//   language and skips it.
// Controls: tap, click or Enter on a language, then on Continue
// Packages: @automataframework/framework
// Difficulty: ★★☆☆
// Tier: core
import { defineGame } from '@automataframework/framework'

// The pixel font, cut to the words these menus show (content/fonts.toml): `fonts.css` is served beside this page
// (public/core/first-run/) and sets the face each language draws in, so Japanese, Korean and Chinese are not left to a device.
document.head.append(
  Object.assign(document.createElement('link'), {
    rel: 'stylesheet',
    href: 'fonts.css',
    crossOrigin: 'anonymous',
  }),
)

// The game's own effect setting, kept in memory here; a real game keeps it in its settings.
let reduced = false

export default defineGame({
  id: 'core-first-run',
  size: { width: 320, height: 180 },
  sim: { plugins: [] },
  locale: { locales: ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'], baseLocale: 'en' },
  // The game flashes, so the first run warns once and offers the switches that reduce it.
  photosensitivity: {
    // What the game has, as data: the warning says it in the player's language ("This game has flashing lights.").
    effects: ['flashing'],
    switches: [
      {
        id: 'flashing',
        label: 'Reduce flashing',
        get: () => reduced,
        set: (on: boolean) => {
          reduced = on
        },
      },
    ],
  },
  draw: (ctx) => {
    ctx.rect(0, 0, ctx.width, ctx.height, reduced ? 0x3b303c : 0x583126)
  },
})
