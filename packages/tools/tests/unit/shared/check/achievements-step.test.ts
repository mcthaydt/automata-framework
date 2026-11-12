import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { achievementsStep } from '#src/shared/check/check-source-steps.ts'
import { CspProbe } from '#src/shared/check/csp-probe.ts'
import { Files } from '#src/shared/node/files.ts'
import { ProcessRunner } from '#src/shared/node/process-runner.ts'
import { ShipConfigError, ShipConfigLoader } from '#src/shared/node/ship-config-loader.ts'
import { defineShipConfig, type ShipConfig } from '#src/shared/ship/config/ship-config.ts'

// `automata check` reads the whole of `ship.config.ts` (it cannot scan the text as the boards step does: a goal, a
// description and a board are values, not names) and reports what the framework's own schema refuses, in plain words.

const base: ShipConfig = defineShipConfig({
  game: { id: 'g', title: 'G', version: '0.1.0', entry: 'index.html' },
  runtime: { renderer: 'canvas2d', orientation: 'any', inputs: ['touch'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
  leaderboards: { best: { order: 'desc', min: 0, max: 9 } },
})

/** The step over a game folder holding (or not) a `ship.config.ts`, whose loader answers `config` or fails. */
function run(options: {
  config?: unknown
  there?: boolean
  fails?: boolean
  words?: Record<string, string> | null
}) {
  const there = options.there ?? true
  // `words` is the achievements source catalog on disk: absent (null) or what it says.
  const catalog = options.words === undefined ? WORDS : options.words
  const files = Layer.succeed(Files, {
    exists: (path: string) =>
      Effect.succeed(path.endsWith('messages/achievements/en.json') ? catalog !== null : there),
    readText: () => Effect.succeed(JSON.stringify(catalog)),
  } as never)
  const loader = Layer.succeed(ShipConfigLoader, {
    load: () =>
      options.fails === true
        ? Effect.fail(new ShipConfigError({ path: '/g/ship.config.ts', cause: new Error('boom') }))
        : Effect.succeed(options.config as ShipConfig),
  })
  return Effect.runPromise(
    Effect.provide(
      Effect.either(achievementsStep('/g')),
      Layer.mergeAll(
        files,
        loader,
        Layer.succeed(ProcessRunner, {} as never),
        Layer.succeed(CspProbe, {} as never),
      ),
    ),
  )
}

const WORDS = { $schema: 'x', achievement_win_title: 'Win', achievement_win_description: 'Win once.' }
const win = { title: 'Win', description: 'Win once.', board: 'best', goal: { reach: 5 } }

describe('achievementsStep', () => {
  it('finds nothing for a config whose achievements name a board and one goal', async () => {
    const result = await run({ config: { ...base, achievements: { win } } })
    expect(result).toMatchObject({ _tag: 'Right', right: [] })
  })

  it('an unknown board is a finding in plain words', async () => {
    const result = await run({ config: { ...base, achievements: { win: { ...win, board: 'elsewhere' } } } })
    if (result._tag !== 'Right') throw new Error('expected findings')
    expect(result.right).toHaveLength(1)
    expect(result.right[0]).toMatchObject({
      file: 'ship.config.ts',
      rule: 'achievement-invalid',
      message: 'achievement "win": its board "elsewhere" is not one of this game\'s leaderboards',
    })
  })

  it('a goal with neither reach nor top_percent is a finding naming the achievement', async () => {
    const result = await run({ config: { ...base, achievements: { win: { ...win, goal: {} } } } })
    if (result._tag !== 'Right') throw new Error('expected findings')
    expect(result.right[0]?.message).toBe(
      'achievement "win": its goal needs exactly one of reach and top_percent (above 0, at most 100)',
    )
  })

  it('a source catalog that has fallen behind the declaration is a finding that says what to run', async () => {
    const result = await run({
      config: { ...base, achievements: { win: { ...win, title: 'Win twice' } } },
    })
    if (result._tag !== 'Right') throw new Error('expected findings')
    expect(result.right).toEqual([
      {
        file: 'messages/achievements/en.json',
        line: 0,
        col: 0,
        rule: 'achievement-words',
        message:
          'messages/achievements/en.json is out of date with the achievements in ship.config.ts: run automata words',
      },
    ])
  })

  it('a missing source catalog is a finding that says what to run', async () => {
    const result = await run({ config: { ...base, achievements: { win } }, words: null })
    if (result._tag !== 'Right') throw new Error('expected findings')
    expect(result.right[0]).toMatchObject({
      rule: 'achievement-words',
      message: 'messages/achievements/en.json is missing: run automata words',
    })
  })

  it('no ship.config.ts: no findings', async () => {
    expect(await run({ there: false })).toMatchObject({ _tag: 'Right', right: [] })
  })

  it('a config with no achievements: no findings', async () => {
    expect(await run({ config: base })).toMatchObject({ _tag: 'Right', right: [] })
  })

  it('a config that fails to load is a tool error, never a pass', async () => {
    const result = await run({ fails: true })
    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toMatchObject({ tool: 'achievements', kind: 'failed' })
      expect(result.left.detail).toContain('boom')
    }
  })
})
