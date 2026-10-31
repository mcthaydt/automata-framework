import { describe, expect, it } from 'vitest'
import { ACTION_CLIP, metres, WALK_SPEED } from './constants.ts'
import { HERO_ITEM, heroFigureState } from './views.ts'

// The render rows as the figure view reads them (M3 spec §4.4.5): turn units to radians, ticks to seconds at
// 60 Hz, the action code to its clip id, the guard to a stance, the lock to aim points.

const hero = { x: 0, z: 0, facing: 0, moving: false, moveDir: 0, lockTarget: 0 }
const idle = { clip: 0, startedAt: 0, guard: false, guardSince: 0 }

describe('heroFigureState', () => {
  it('stands holding the sword, with no action, stance or aim', () => {
    expect(heroFigureState({ hero, 'hero-action': idle })).toEqual({
      moving: false,
      speed: 0,
      moveDir: 0,
      item: HERO_ITEM,
    })
  })

  it('walks at the walk speed, his travel against his facing in radians', () => {
    const state = heroFigureState({ hero: { ...hero, moving: true, moveDir: -16_384 }, 'hero-action': idle })
    expect(state).toMatchObject({ moving: true, speed: WALK_SPEED })
    expect(state.moveDir).toBeCloseTo(-Math.PI / 2, 12)
  })

  it('plays the action by its clip id from its start in seconds, and the guard as a stance', () => {
    const action = { clip: ACTION_CLIP.slash, startedAt: 90, guard: true, guardSince: 30 }
    expect(heroFigureState({ hero, 'hero-action': action })).toMatchObject({
      action: { id: 'slash', startedAt: 1.5 },
      stances: [{ id: 'guard', startedAt: 0.5 }],
    })
    expect(heroFigureState({ hero, 'hero-action': { ...idle, clip: ACTION_CLIP.pickup } }).action?.id).toBe(
      'pickup',
    )
  })

  it('aims the head and chest at the locked target’s head and chest, in metres', () => {
    const target = { x: metres(2), z: metres(9) }
    const state = heroFigureState({ hero: { ...hero, lockTarget: 7 }, 'hero-action': idle }, target)
    expect(state.aim).toEqual([
      { part: 'head', at: [2, 1.5, 9] },
      { part: 'chest', at: [2, 1.2, 9] },
    ])
    // No lock, no aim, even with a target given.
    expect(heroFigureState({ hero, 'hero-action': idle }, target).aim).toBeUndefined()
  })
})
