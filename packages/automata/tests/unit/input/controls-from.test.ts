import type { ControlsFile } from '@automata/content/controls'
import { defineCommand } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { controlsFrom } from '#src/features/input/controls-from.ts'
import { keys } from '#src/features/input/keys.ts'

// controlsFrom(): the same input map `keys()` builds, from the data in content/controls.toml.
const step = z.number().int().min(-1).max(1).default(0)
const Move = defineCommand('move', z.object({ x: step, y: step }))

/** The new-game template's call, written as code. */
const inCode = keys(
  Move,
  {
    ArrowLeft: { x: -1 },
    KeyA: { x: -1 },
    ArrowRight: { x: 1 },
    KeyD: { x: 1 },
    ArrowUp: { y: -1 },
    KeyW: { y: -1 },
    ArrowDown: { y: 1 },
    KeyS: { y: 1 },
  },
  { pad: { 14: { x: -1 }, 15: { x: 1 }, 12: { y: -1 }, 13: { y: 1 } } },
)

const file: ControlsFile = {
  command: 'move',
  action: [
    { id: 'left', label: 'Left', send: { x: -1 }, keys: ['ArrowLeft', 'KeyA'], pad: [14], touch: true },
    { id: 'right', label: 'Right', send: { x: 1 }, keys: ['ArrowRight', 'KeyD'], pad: [15], touch: true },
    { id: 'up', label: 'Up', send: { y: -1 }, keys: ['ArrowUp', 'KeyW'], pad: [12], touch: true },
    { id: 'down', label: 'Down', send: { y: 1 }, keys: ['ArrowDown', 'KeyS'], pad: [13], touch: true },
  ],
}
const fromFile = controlsFrom(Move, file)
const CODE_IDS: Record<string, string> = { left: 'move-0', right: 'move-1', up: 'move-2', down: 'move-3' }

describe('controlsFrom()', () => {
  it('sends the same commands as the keys() call it replaces, for every set of held actions', () => {
    const ids = Object.keys(CODE_IDS)
    for (let mask = 0; mask < 1 << ids.length; mask++) {
      const held = ids.filter((_, bit) => (mask & (1 << bit)) !== 0)
      expect(fromFile.toCommand(held, 7), held.join('+')).toEqual(
        inCode.toCommand(
          held.map((id) => CODE_IDS[id] as string),
          7,
        ),
      )
    }
  })

  it("names its actions as the file does, and labels them with the file's labels", () => {
    expect(Object.keys(fromFile.profile.bindings)).toEqual(['left', 'right', 'up', 'down'])
    expect(fromFile.profile.bindings.left).toEqual({ keys: ['ArrowLeft', 'KeyA'], pad: [14], touch: true })
    expect(fromFile.labels).toEqual({ left: 'Left', right: 'Right', up: 'Up', down: 'Down' })
    expect(fromFile.touchButtons.map((button) => button.id)).toEqual(['left', 'right', 'up', 'down'])
  })

  it('keeps keys() ids for the call that still uses keys(), so saved bindings keep working', () => {
    expect(Object.keys(inCode.profile.bindings)).toEqual(['move-0', 'move-1', 'move-2', 'move-3'])
  })

  it('shows no touch button for an action with touch = false, and keeps the others', () => {
    const quiet = controlsFrom(Move, {
      ...file,
      action: file.action.map((action) => (action.id === 'up' ? { ...action, touch: false } : action)),
    })
    expect(quiet.touchButtons.map((button) => button.id)).toEqual(['left', 'right', 'down'])
    expect(quiet.profile.bindings.up?.touch).toBe(false)
    expect(quiet.profile.bindings.left?.touch).toBe(true)
  })

  it('keeps two actions that send the same payload as two rows', () => {
    const twins = controlsFrom(Move, {
      command: 'move',
      action: [
        { id: 'a', label: 'A', send: { x: 1 }, keys: ['KeyA'] },
        { id: 'b', label: 'B', send: { x: 1 }, keys: ['KeyB'] },
      ],
    })
    expect(Object.keys(twins.profile.bindings)).toEqual(['a', 'b'])
    expect(twins.toCommand(['a'], 0)[0]?.payload).toEqual({ x: 1, y: 0 })
    expect(twins.toCommand(['b'], 0)[0]?.payload).toEqual({ x: 1, y: 0 })
  })

  it('takes stick, gesture and required as the file gives them', () => {
    const map = controlsFrom(Move, {
      command: 'move',
      action: [
        {
          id: 'go',
          send: { x: 1 },
          keys: ['KeyD'],
          stick: ['left-right'],
          gesture: ['swipe-right'],
          required: true,
        },
      ],
    })
    expect(map.profile.bindings.go).toEqual({
      keys: ['KeyD'],
      pad: [],
      touch: true,
      stick: ['left-right'],
      gesture: ['swipe-right'],
      required: true,
    })
    expect(map.touchButtons[0]?.required).toBe(true)
    expect(map.labels.go).toBe('move x 1')
  })

  it('refuses a file for another command', () => {
    expect(() => controlsFrom(Move, { ...file, command: 'jump' })).toThrow(
      'The controls file is for "jump", but the game sends "move".',
    )
  })

  it("refuses a send the command's schema refuses, naming the action", () => {
    expect(() =>
      controlsFrom(Move, { command: 'move', action: [{ id: 'sideways', send: { x: 5 }, keys: ['KeyQ'] }] }),
    ).toThrow(/"sideways".*x/)
  })
})
