import * as Ruken from '@ruken/manifest'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  GAME_ID_PATTERN,
  type GameConfig,
  INPUTS,
  LEADERBOARD_ORDERS,
  ORIENTATIONS,
  RATINGS,
  RENDERERS,
} from '#src/shared/game/game-config.schema.ts'

// DIST spec §4.4: AF owns the game config and keeps Ruken's names; these hold it to the vendored `@ruken/manifest`, so
// a re-vendor that changes one of Ruken's lists fails here instead of drifting.

describe("AF's game config against Ruken's manifest", () => {
  it("has Ruken's renderers, orientations, inputs, ratings and board orders", () => {
    expect(RENDERERS).toEqual(Ruken.RENDERERS)
    expect(ORIENTATIONS).toEqual(Ruken.ORIENTATIONS)
    expect(INPUTS).toEqual(Ruken.INPUTS)
    expect(RATINGS).toEqual(Ruken.RATINGS)
    expect(LEADERBOARD_ORDERS).toEqual(Ruken.LEADERBOARD_ORDERS)
  })

  it("checks game ids with Ruken's pattern", () => {
    expect(GAME_ID_PATTERN.source).toBe(Ruken.SLUG_RE.source)
    expect(GAME_ID_PATTERN.flags).toBe(Ruken.SLUG_RE.flags)
  })

  it('gives the Ruken target every manifest section it writes from the config', () => {
    expectTypeOf<GameConfig['runtime']>().toExtend<Omit<Ruken.Manifest['runtime'], 'allow_eval'>>()
    expectTypeOf<GameConfig['network']>().toExtend<Ruken.Manifest['network']>()
    expectTypeOf<GameConfig['content']>().toExtend<Ruken.Manifest['content']>()
    expectTypeOf<Omit<GameConfig['game'], 'sdk'>>().toExtend<Omit<Ruken.Manifest['game'], 'sdk'>>()
    expectTypeOf<NonNullable<GameConfig['leaderboards']>>().toExtend<Ruken.Manifest['leaderboards']>()
  })
})
