import { describe, expect, it } from 'vitest'
import { BrainState, ENEMIES, ENEMY_MOVES } from '../constants/enemies.ts'
import { HERO_MOVES, TICK_HZ } from '../constants/index.ts'
import { DANGER, ENEMY_FIGURES, enemyFigureState, reticleOf, windupGlow } from './enemies.ts'

const MOVES = [...HERO_MOVES, ...ENEMY_MOVES]
const index = (id: string) => MOVES.findIndex((move) => move.id === id) + 1
const kind = (id: string) => ENEMIES.findIndex((type) => type.id === id) + 1

describe('enemyFigureState (GAME-3D.1d part 4)', () => {
  it('walks while it closes in or circles, and stands while idle at a pause, noticing or recovering', () => {
    const at = (brain: number) =>
      enemyFigureState({ enemy: { kind: kind('sootling'), brain }, fighter: { move: 0 } }, MOVES)
    expect(at(BrainState.approach)).toMatchObject({ moving: true })
    expect(at(BrainState.circle)).toMatchObject({ moving: true })
    expect(at(BrainState.notice)).toMatchObject({ moving: false, speed: 0 })
    expect(at(BrainState.recover)).toMatchObject({ moving: false })
  })

  it('plays the running move’s clip from its start, retimed to the move (G3-d)', () => {
    const state = enemyFigureState(
      {
        enemy: { kind: kind('ash-knight'), brain: BrainState.attack },
        fighter: { move: index('knight-chop'), moveStart: 120 },
      },
      MOVES,
    )
    expect(state.action).toEqual({ id: 'knight-chop', length: 56 / TICK_HZ, startedAt: 120 / TICK_HZ })
  })

  it('names a clip no content has as it is, beside its walk: the figure view warns once and keeps the gait (G3-F7)', () => {
    const missing = [
      ...MOVES,
      { ...ENEMY_MOVES[0], id: 'test-missing', clip: 'no-such-clip' } as (typeof MOVES)[number],
    ]
    const state = enemyFigureState(
      {
        enemy: { kind: kind('sootling'), brain: BrainState.approach },
        fighter: { move: missing.length, moveStart: 0 },
      },
      missing,
    )
    expect(state).toMatchObject({ moving: true, action: { id: 'no-such-clip' } })
  })
})

describe('windupGlow (DESIGN.md §8.1 rule 1, §8.5)', () => {
  const glowOf = (id: string, moveTick: number, ms = 0) =>
    windupGlow({ fighter: { move: index(id), moveTick } }, MOVES, ms)

  it('glows orange through a blockable windup and goes out at the first active frame', () => {
    expect(glowOf('knight-chop', 1)).toEqual({ colour: DANGER.blockable, strength: 1 })
    expect(glowOf('knight-chop', 30)).toEqual({ colour: DANGER.blockable, strength: 1 })
    expect(glowOf('knight-chop', 31)).toBeUndefined()
  })

  it('glows white-yellow and pulses through an unblockable windup, so colour is never the only signal', () => {
    const strengths = [0, 125, 250].map((ms) => glowOf('warden-breath', 10, ms)?.strength)
    expect(glowOf('warden-breath', 10)?.colour).toBe(DANGER.unblockable)
    expect(new Set(strengths).size).toBeGreaterThan(1)
    for (const strength of strengths) expect(strength).toBeGreaterThanOrEqual(0.4)
  })

  it('shows nothing with no move, or for Wick’s own moves', () => {
    expect(windupGlow({ fighter: { move: 0, moveTick: 0 } }, MOVES, 0)).toBeUndefined()
    expect(glowOf('slash-1', 2)).toBeUndefined()
  })
})

describe('ENEMY_FIGURES', () => {
  it('draws each figure-drawn type at its §8 height: the Sootling and the Warden scaled past the slider’s range', () => {
    expect(ENEMY_FIGURES).toEqual({
      sootling: { figure: 'sootling', scale: 0.75 },
      'ash-knight': { figure: 'ash-knight', scale: 1 },
      'ash-captain': { figure: 'ash-captain', scale: 1 },
      warden: { figure: 'warden', scale: 3.2 / 2.4 },
    })
  })
})

describe('reticleOf (§8.1 rule 4, GAME-3D.1e part 5a)', () => {
  const sootling = (token: boolean) => ({ enemy: { kind: kind('sootling'), token } })

  it('shows over the locked enemy only', () => {
    expect(reticleOf(7, sootling(false), 0, 0)).toBeUndefined()
    expect(reticleOf(7, sootling(false), 8, 0)).toBeUndefined()
    expect(reticleOf(7, { target: {} }, 7, 0)).toBeUndefined()
    expect(reticleOf(7, sootling(false), 7, 0)).toEqual({ scale: 1 })
  })

  it('holds steady without a token and pulses while its target holds one', () => {
    expect(reticleOf(7, sootling(false), 7, 200)).toEqual({ scale: 1 })
    expect(reticleOf(7, sootling(true), 7, 0)).toEqual({ scale: 1 })
    expect(reticleOf(7, sootling(true), 7, 200)).toEqual({ scale: 1.25 })
    expect(reticleOf(7, sootling(true), 7, 100)?.scale).toBeCloseTo(1.125)
    expect(reticleOf(7, sootling(true), 7, 400)).toEqual({ scale: 1 })
  })
})
