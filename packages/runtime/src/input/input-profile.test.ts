import { describe, expect, it } from 'vitest'
import {
  actionsForKey,
  actionsForPadButton,
  type InputProfile,
  inputProfileSchema,
  RESERVED_KEYS,
  RESERVED_PAD_BUTTONS,
} from './input-profile.schema.js'

// Input profiles (PRODUCT spec §2 F1, §5 "Gamepad and all input"): which keys, standard-mapping pad buttons
// and touch buttons drive each game action, as data a settings screen can rebind and save.

const platformer: InputProfile = inputProfileSchema.parse({
  id: 'default',
  bindings: {
    left: { keys: ['ArrowLeft', 'KeyA'], pad: [14] },
    right: { keys: ['ArrowRight', 'KeyD'], pad: [15] },
    jump: { keys: ['Space', 'ArrowUp'], pad: [0], touch: true },
    'menu.confirm': { keys: ['Space', 'Enter'], pad: [0] },
  },
})

describe('input profiles', () => {
  it('parses keys, pad buttons and touch, defaulting what a binding leaves out', () => {
    expect(platformer.bindings.left).toEqual({ keys: ['ArrowLeft', 'KeyA'], pad: [14], touch: false })
    expect(inputProfileSchema.parse({ id: 'empty', bindings: { pause: {} } }).bindings.pause).toEqual({
      keys: [],
      pad: [],
      touch: false,
    })
  })

  it('finds every action bound to a key or pad button, sorted by action id', () => {
    expect(actionsForKey(platformer, 'Space')).toEqual(['jump', 'menu.confirm'])
    expect(actionsForKey(platformer, 'KeyD')).toEqual(['right'])
    expect(actionsForKey(platformer, 'KeyQ')).toEqual([])
    expect(actionsForPadButton(platformer, 0)).toEqual(['jump', 'menu.confirm'])
    expect(actionsForPadButton(platformer, 9)).toEqual([])
  })

  it('rejects a pad button outside the standard mapping, an empty key and an empty action id', () => {
    expect(inputProfileSchema.safeParse({ id: 'p', bindings: { jump: { pad: [17] } } }).success).toBe(false)
    expect(inputProfileSchema.safeParse({ id: 'p', bindings: { jump: { pad: [-1] } } }).success).toBe(false)
    expect(inputProfileSchema.safeParse({ id: 'p', bindings: { jump: { keys: [''] } } }).success).toBe(false)
    expect(inputProfileSchema.safeParse({ id: 'p', bindings: { '': { keys: ['KeyA'] } } }).success).toBe(
      false,
    )
    expect(inputProfileSchema.safeParse({ id: '', bindings: {} }).success).toBe(false)
  })
})

describe('M4 binding fields (M4 spec §4.1)', () => {
  it('parses stick directions, gestures, required and context, leaving them out when absent', () => {
    const profile = inputProfileSchema.parse({
      id: 'm4',
      bindings: {
        jump: { keys: ['Space'], stick: ['left-up'], gesture: ['swipe-up', 'tap'], required: true },
        inventory: { keys: ['KeyI'], context: 'menu' },
      },
    })
    expect(profile.bindings.jump).toEqual({
      keys: ['Space'],
      pad: [],
      touch: false,
      stick: ['left-up'],
      gesture: ['swipe-up', 'tap'],
      required: true,
    })
    expect(profile.bindings.inventory?.context).toBe('menu')
    expect(platformer.bindings.left).not.toHaveProperty('context')
  })

  it('refuses an unknown stick direction, gesture or context', () => {
    for (const binding of [{ stick: ['left-forward'] }, { gesture: ['pinch'] }, { context: 'hud' }])
      expect(inputProfileSchema.safeParse({ id: 'bad', bindings: { jump: binding } }).success).toBe(false)
  })
})

describe('reserved inputs (M4-D3, I-j)', () => {
  it('reserves the host View and Home buttons, Escape and Tab', () => {
    expect(RESERVED_PAD_BUTTONS).toEqual([8, 16])
    expect(RESERVED_KEYS).toEqual(['Escape', 'Tab'])
  })

  it.each([
    [{ pad: [0, 8] }, 'pad', '8'],
    [{ pad: [16] }, 'pad', '16'],
    [{ keys: ['Escape'] }, 'keys', 'Escape'],
    [{ keys: ['KeyJ', 'Tab'] }, 'keys', 'Tab'],
  ])('refuses %j, naming the action', (binding, field, value) => {
    const result = inputProfileSchema.safeParse({ id: 'bad', bindings: { jump: binding } })
    expect(result.success).toBe(false)
    const issue = result.error?.issues[0]
    expect(issue?.path).toEqual(['bindings', 'jump', field])
    expect(issue?.message).toContain(`"jump"`)
    expect(issue?.message).toContain(value)
  })
})
