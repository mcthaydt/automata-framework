import { parseManifest } from '@ruken/manifest'
import { describe, expect, it } from 'vitest'
import {
  type AssetsSource,
  checkAssets,
  checkGame,
  type GameSource,
  gameSchema,
  languagesOf,
  rukenFields,
} from './game-facts'

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
    expect(checkGame(game, { languages: ['en', 'fr'] })).toEqual([])
  })

  it('refuses event names Ruken would refuse, a repeated event, a bad tag and a missing en', () => {
    const bad = { ...game, source_language: 'French', custom_events: ['Level Done', 'ok_event', 'ok_event'] }
    expect(checkGame(bad, { languages: ['French'] })).toEqual([
      {
        path: ['custom_events', 0],
        code: 'invalidGame',
        message: 'event names match ^[a-z][a-z0-9_]{1,39}$, received Level Done',
      },
      { path: ['custom_events', 2], code: 'invalidGame', message: 'ok_event is listed more than once' },
      {
        path: ['source_language'],
        code: 'invalidGame',
        message: 'French is not a language tag like en or pt-BR',
      },
      {
        path: ['source_language'],
        code: 'invalidGame',
        message: 'Ruken needs en among the languages (LANGUAGES_MISSING_EN); they are French',
      },
    ])
  })

  it('requires preload screens to have assets', () => {
    expect(
      checkGame({ ...game, preload_screens: ['Splash'] }, { languages: ['en'], assetScreens: [] }),
    ).toEqual([
      { path: ['preload_screens', 0], code: 'invalidGame', message: 'Splash has no files in assets.toml' },
    ])
  })
})

describe('checkAssets', () => {
  const assets: AssetsSource = { screens: { Splash: { files: ['fonts/a.woff2', 'art/*'] } } }

  it('accepts relative paths and folders', () => {
    expect(checkAssets(assets, ['Splash', 'Menu'])).toEqual([])
  })

  it('refuses unknown screens and paths outside the build', () => {
    const bad: AssetsSource = {
      screens: { Credits: { files: ['/abs.png', '../up.png', 'a\\b.png', 'ok.png'] } },
    }
    expect(checkAssets(bad, ['Splash'])).toEqual([
      { path: ['screens', 'Credits'], code: 'invalidGame', message: 'Credits is not a screen in flow.toml' },
      {
        path: ['screens', 'Credits', 'files', 0],
        code: 'invalidGame',
        message: '/abs.png must be a relative path inside the build, such as audio/menu.m4a or audio/*',
      },
      {
        path: ['screens', 'Credits', 'files', 1],
        code: 'invalidGame',
        message: '../up.png must be a relative path inside the build, such as audio/menu.m4a or audio/*',
      },
      {
        path: ['screens', 'Credits', 'files', 2],
        code: 'invalidGame',
        message: 'a\\b.png must be a relative path inside the build, such as audio/menu.m4a or audio/*',
      },
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
