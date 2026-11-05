import { parseManifest } from '@ruken/manifest'
import { describe, expect, it } from 'vitest'
import {
  type AssetsSource,
  assetsSchema,
  checkAssets,
  checkGame,
  type GameSource,
  gameSchema,
  languagesOf,
  rukenFields,
} from '#src/shared/game/game-facts.ts'

const game: GameSource = gameSchema.parse({
  rating: 'everyone',
  custom_events: ['level_complete'],
  estimated_hours: 1.5,
})

describe('gameSchema', () => {
  it('defaults the source language and lists', () => {
    expect(game).toEqual({
      source_language: 'en',
      rating: 'everyone',
      descriptors: [],
      estimated_hours: 1.5,
      custom_events: ['level_complete'],
    })
  })

  it("takes Ruken's ratings only", () => {
    expect(gameSchema.safeParse({ rating: 'adult' }).success).toBe(false)
  })
})

describe('languagesOf', () => {
  it('puts the source first, then the translations present, sorted', () => {
    expect(languagesOf('en', ['pt-BR', 'fr'])).toEqual(['en', 'fr', 'pt-BR'])
  })
})

describe('checkGame', () => {
  it('accepts a well-formed game.toml', () => {
    expect(checkGame(game, {})).toEqual([])
  })

  it("refuses what Ruken's parser cannot see: a repeated event and a source language that is not a tag", () => {
    const bad = { ...game, source_language: 'French', custom_events: ['ok_event', 'ok_event'] }
    expect(checkGame(bad, {})).toEqual([
      { path: ['custom_events', 1], code: 'invalidGame', message: 'ok_event is listed more than once' },
      {
        path: ['source_language'],
        code: 'invalidGame',
        message: 'French is not a language tag like en or pt-BR',
      },
    ])
  })

  it('requires preload screens to have assets', () => {
    expect(checkGame({ ...game, preload_screens: ['Splash'] }, { assetScreens: [] })).toEqual([
      { path: ['preload_screens', 0], code: 'invalidGame', message: 'Splash has no files in assets.toml' },
    ])
  })
})

describe('assetsSchema', () => {
  it('lets a screen name the atlases and fonts it uses (M5.6F.2)', () => {
    const screen = { files: ['art/splash.png'], atlases: ['wick'], fonts: ['pixel'] }
    expect(assetsSchema.safeParse({ screens: { Splash: screen } })).toEqual({
      success: true,
      data: { screens: { Splash: screen } },
    })
  })

  it('adds no keys to a screen that names none, so its compiled content is unchanged', () => {
    expect(assetsSchema.parse({ screens: { Splash: { files: ['art/splash.png'] } } })).toEqual({
      screens: { Splash: { files: ['art/splash.png'] } },
    })
    expect(
      Object.keys(assetsSchema.parse({ screens: { Splash: { files: [] } } }).screens.Splash ?? {}),
    ).toEqual(['files'])
  })

  it('refuses atlases or fonts that are not a list of names', () => {
    expect(assetsSchema.safeParse({ screens: { Splash: { files: [], atlases: 'wick' } } }).success).toBe(
      false,
    )
    expect(assetsSchema.safeParse({ screens: { Splash: { files: [], fonts: [1] } } }).success).toBe(false)
  })
})

describe('checkAssets', () => {
  const assets: AssetsSource = { screens: { Splash: { files: ['fonts/a.woff2', 'art/*'] } } }

  it('accepts relative paths and folders', () => {
    expect(checkAssets(assets, ['Splash', 'Menu'])).toEqual([])
  })

  it('refuses screens the flow does not have', () => {
    const bad: AssetsSource = { screens: { Credits: { files: ['ok.png'] } } }
    expect(checkAssets(bad, ['Splash'])).toEqual([
      { path: ['screens', 'Credits'], code: 'invalidGame', message: 'Credits is not a screen in flow.toml' },
    ])
  })
})

describe('rukenFields', () => {
  it("gives Ruken's [content] and [analytics] tables, which Ruken's own parser accepts", () => {
    const fields = rukenFields(game, ['en', 'fr'])
    expect(fields).toEqual({
      content: { languages: ['en', 'fr'], rating: 'everyone', descriptors: [], estimated_hours: 1.5 },
      analytics: { custom_events: ['level_complete'] },
    })
    const list = (values: readonly string[]) => `[${values.map((v) => JSON.stringify(v)).join(', ')}]`
    const toml = [
      'schema = 1',
      '[game]',
      'id = "fixture"',
      'title = "Fixture"',
      'version = "0.1.0"',
      'entry = "index.html"',
      'sdk = "^0.0.0"',
      '[runtime]',
      'renderer = "webgl2"',
      'orientation = "any"',
      'inputs = ["touch"]',
      'pause_behavior = "pause"',
      '[network]',
      'connect = []',
      '[content]',
      `languages = ${list(fields.content.languages)}`,
      `rating = "${fields.content.rating}"`,
      `descriptors = ${list(fields.content.descriptors)}`,
      `estimated_hours = ${fields.content.estimated_hours}`,
      '[analytics]',
      `custom_events = ${list(fields.analytics.custom_events)}`,
    ].join('\n')
    const parsed = parseManifest(toml)
    expect(parsed.ok ? [] : parsed.errors).toEqual([])
  })
})
