import { describe, expect, it } from 'vitest'
import { GAME_ID_PATTERN, type GameConfig, gameConfigSchema } from './game-config.schema'

// DIST spec §4.4: the keys of a game's `ship.config.ts` that every target reads, owned by AF. The names are Ruken's
// manifest keys, kept as they are; `ruken/conformance.test.ts` holds AF's lists to Ruken's.

const emberwick: GameConfig = {
  game: { id: 'base-2d', title: 'AF Base 2D', version: '0.0.3', entry: 'index.html', sdk: '^0.0.0' },
  runtime: { renderer: 'webgl2', orientation: 'any', inputs: ['touch', 'keyboard'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
}

describe('the game config schema', () => {
  it("accepts a shipped game's config, and one with no Ruken SDK range (a game that never builds for Ruken)", () => {
    expect(gameConfigSchema.safeParse(emberwick).success).toBe(true)
    const { sdk: _sdk, ...game } = emberwick.game
    expect(gameConfigSchema.safeParse({ ...emberwick, game }).success).toBe(true)
  })

  it.each([
    ['renderer', { ...emberwick, runtime: { ...emberwick.runtime, renderer: 'vulkan' } }],
    ['orientation', { ...emberwick, runtime: { ...emberwick.runtime, orientation: 'sideways' } }],
    ['input', { ...emberwick, runtime: { ...emberwick.runtime, inputs: ['mind'] } }],
    ['rating', { ...emberwick, content: { ...emberwick.content, rating: 'adult' } }],
    ['game id', { ...emberwick, game: { ...emberwick.game, id: 'Base 2D' } }],
  ])('refuses an unknown %s', (_what, config) => {
    expect(gameConfigSchema.safeParse(config).success).toBe(false)
  })

  it('takes a game id of lower-case letters, digits and hyphens, starting with a letter or digit, up to 64', () => {
    for (const id of ['base-2d', 'a', '9lives', 'x'.repeat(64)])
      expect(GAME_ID_PATTERN.test(id), id).toBe(true)
    for (const id of ['', '-lead', 'Upper', 'under_score', 'x'.repeat(65)])
      expect(GAME_ID_PATTERN.test(id), id).toBe(false)
  })
})
