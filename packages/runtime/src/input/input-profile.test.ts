import { describe, expect, it } from 'vitest'
import {
  actionsForKey,
  actionsForPadButton,
  type InputProfile,
  inputProfileSchema,
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
