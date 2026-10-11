import { describe, expect, it } from 'vitest'
import { actionForKey, NOTHING_HELD, toMove } from './keys.ts'

describe('keyboard', () => {
  it.each([
    ['ArrowLeft', 'left'],
    ['KeyA', 'left'],
    ['ArrowRight', 'right'],
    ['KeyD', 'right'],
    ['Space', 'jump'],
    ['KeyZ', 'jump'],
    ['KeyW', 'jump'],
    ['ArrowUp', 'jump'],
    ['Escape', 'pause'],
    ['KeyP', 'pause'],
  ] as const)('%s is %s', (code, action) => {
    expect(actionForKey(code)).toBe(action)
  })

  it('ignores keys it does not use', () => {
    expect(actionForKey('KeyQ')).toBeUndefined()
  })
})

describe('the move command from what is held', () => {
  it('is still with nothing held', () => {
    expect(toMove(NOTHING_HELD)).toEqual({ x: 0, jump: false })
  })

  it('goes the held way and jumps while jump is held', () => {
    expect(toMove({ left: true, right: false, jump: true })).toEqual({ x: -1, jump: true })
    expect(toMove({ left: false, right: true, jump: false })).toEqual({ x: 1, jump: false })
  })

  it('stands still when left and right are both held', () => {
    expect(toMove({ left: true, right: true, jump: false })).toEqual({ x: 0, jump: false })
  })
})
