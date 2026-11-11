import { describe, expect, it } from 'vitest'
import { GAME_ID_PATTERN, type GameConfig, gameConfigSchema } from '#src/shared/game/game-config.schema.ts'

// DIST spec §4.4: the keys of a game's `ship.config.ts` that every target reads, owned by AF. The names are Ruken's
// manifest keys, kept as they are; `ruken/conformance.test.ts` holds AF's lists to Ruken's.

const emberwick: GameConfig = {
  game: { id: 'emberwick', title: 'Emberwick', version: '0.0.3', entry: 'index.html', sdk: '^0.0.0' },
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
    for (const id of ['emberwick', 'a', '9lives', 'x'.repeat(64)])
      expect(GAME_ID_PATTERN.test(id), id).toBe(true)
    for (const id of ['', '-lead', 'Upper', 'under_score', 'x'.repeat(65)])
      expect(GAME_ID_PATTERN.test(id), id).toBe(false)
  })
})

// Achievements are the framework's own idea: an id, a title, a description and one goal on a board's score. The schema
// names no host and holds no host's limits (a title's length, a count, the shares a store allows): each target maps
// what it can and says so plainly about what it cannot.
describe('achievements', () => {
  const withBoards = (achievements: unknown): unknown => ({
    ...emberwick,
    leaderboards: { best: { order: 'desc', min: 0, max: 999 } },
    achievements,
  })
  const score20 = { title: 'Twenty', description: 'Score 20.', board: 'best', goal: { reach: 20 } }

  it('accepts a reach goal and a top share, on a board the config declares', () => {
    expect(
      gameConfigSchema.safeParse(
        withBoards({
          'score-20': score20,
          'top-ten': { ...score20, title: 'Top 10%', goal: { top_percent: 10 } },
        }),
      ).success,
    ).toBe(true)
  })

  it('needs no achievements at all, so a game before this work still parses', () => {
    expect(gameConfigSchema.safeParse(emberwick).success).toBe(true)
  })

  it('refuses a goal with both reach and top_percent', () => {
    const goal = { reach: 20, top_percent: 10 }
    expect(gameConfigSchema.safeParse(withBoards({ both: { ...score20, goal } })).success).toBe(false)
  })

  it('refuses a goal with neither', () => {
    expect(gameConfigSchema.safeParse(withBoards({ none: { ...score20, goal: {} } })).success).toBe(false)
  })

  it('refuses a top share of 0 or over 100, and any other word in the goal', () => {
    for (const goal of [{ top_percent: 0 }, { top_percent: 101 }, { top_rank: 3 }])
      expect(
        gameConfigSchema.safeParse(withBoards({ bad: { ...score20, goal } })).success,
        JSON.stringify(goal),
      ).toBe(false)
  })

  it('refuses a board the config does not declare, naming no host', () => {
    const result = gameConfigSchema.safeParse(withBoards({ lost: { ...score20, board: 'elsewhere' } }))
    expect(result.success).toBe(false)
    if (!result.success) {
      const text = result.error.issues.map((issue) => issue.message).join('\n')
      expect(text).toContain('elsewhere')
      expect(text).not.toMatch(/ruken/i)
    }
  })

  it('refuses a config that declares achievements and no leaderboards', () => {
    expect(gameConfigSchema.safeParse({ ...emberwick, achievements: { 'score-20': score20 } }).success).toBe(
      false,
    )
  })

  it('takes an id of lower-case letters, digits and hyphens, and refuses empty text and unknown keys', () => {
    expect(gameConfigSchema.safeParse(withBoards({ 'Not Valid': score20 })).success).toBe(false)
    expect(gameConfigSchema.safeParse(withBoards({ ok: { ...score20, title: '' } })).success).toBe(false)
    expect(gameConfigSchema.safeParse(withBoards({ ok: { ...score20, description: '' } })).success).toBe(
      false,
    )
    expect(gameConfigSchema.safeParse(withBoards({ ok: { ...score20, hidden: true } })).success).toBe(false)
  })

  it('holds no host’s limits: a long title and a hundred achievements are the framework’s to accept', () => {
    const many = Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`a${i}`, { ...score20, title: 'T'.repeat(200) }]),
    )
    expect(gameConfigSchema.safeParse(withBoards(many)).success).toBe(true)
  })
})
