import { describe, expect, it } from 'vitest'
import type { AssetsSource, RukenFields } from './game-facts'
import { checkWithRuken } from './ruken-check'

const fields: RukenFields = {
  content: { languages: ['en', 'fr'], rating: 'everyone', descriptors: [], estimated_hours: 1.5 },
  analytics: { custom_events: ['level_complete'] },
}
const assets: AssetsSource = { screens: { Splash: { files: ['fonts/a.woff2', 'audio/*'] } } }

// Audit of PR #8: Ruken's own parser is the authority on these fields, not a hand-copied rule.
describe('checkWithRuken', () => {
  it("accepts what Ruken's parser accepts", () => {
    expect(checkWithRuken({ fields, assets })).toEqual({ game: [], assets: [] })
  })

  it("places Ruken's refusal of a game fact at its key in game.toml", () => {
    const bad: RukenFields = {
      content: { ...fields.content, languages: ['fr'] },
      analytics: { custom_events: ['ok_event', 'Level Done'] },
    }
    expect(checkWithRuken({ fields: bad }).game).toEqual([
      {
        path: ['source_language'],
        code: 'invalidGame',
        message: 'Ruken LANGUAGES_MISSING_EN: content.languages must include "en".',
      },
      {
        path: ['custom_events', 1],
        code: 'invalidGame',
        message:
          'Ruken CUSTOM_EVENT_INVALID: analytics.custom_events[1] must be lowercase letters, digits and underscores, starting with a letter.',
      },
    ])
  })

  it("places Ruken's refusal of a preload path at its file in assets.toml, even without game.toml", () => {
    const spaced: AssetsSource = {
      screens: {
        Splash: { files: ['fonts/a.woff2'] },
        Menu: { files: ['art/x.png', 'audio/My Song.m4a', '../up'] },
      },
    }
    expect(checkWithRuken({ assets: spaced }).assets).toEqual([
      {
        path: ['screens', 'Menu', 'files', 1],
        code: 'invalidGame',
        message:
          'Ruken PRELOAD_PATH_INVALID: audio/My Song.m4a must be a file path inside the build, such as audio/menu.m4a, or a folder path ending in /* such as audio/*.',
      },
      {
        path: ['screens', 'Menu', 'files', 2],
        code: 'invalidGame',
        message:
          'Ruken PRELOAD_PATH_INVALID: ../up must be a file path inside the build, such as audio/menu.m4a, or a folder path ending in /* such as audio/*.',
      },
    ])
  })
})
