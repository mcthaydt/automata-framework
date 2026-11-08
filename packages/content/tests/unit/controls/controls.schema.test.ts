import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import {
  controlsFileSchema,
  RESERVED_KEYS,
  RESERVED_PAD_BUTTONS,
} from '#src/shared/controls/controls.schema.ts'
import { controlsKind } from '#src/shared/controls/controls-kind.ts'

const EXAMPLE = `
command = "move"
[[action]]
id = "left"
label = "Left"
send = { x = -1 }
keys = ["ArrowLeft", "KeyA"]
pad = [14]
touch = true
`

const messages = (input: unknown): string[] => {
  const parsed = controlsFileSchema.safeParse(input)
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
}

describe('the controls file', () => {
  it('reads the example', () => {
    expect(controlsFileSchema.parse(parse(EXAMPLE))).toEqual({
      command: 'move',
      action: [
        { id: 'left', label: 'Left', send: { x: -1 }, keys: ['ArrowLeft', 'KeyA'], pad: [14], touch: true },
      ],
    })
  })

  it('keeps Escape and Tab for the menus, and pad buttons 8 and 16', () => {
    const bad = (extra: string) => parse(`command = "move"\n[[action]]\nid = "a"\nsend = {}\n${extra}`)
    expect(messages(bad('keys = ["Escape"]'))).toEqual(['That key is kept for the menus.'])
    expect(messages(bad('keys = ["Tab"]'))).toEqual(['That key is kept for the menus.'])
    expect(messages(bad('pad = [8]'))).toEqual(['That button is kept for the menus.'])
    expect(messages(bad('pad = [16]'))).toEqual(['That button is kept for the menus.'])
    expect(RESERVED_KEYS).toEqual(['Escape', 'Tab'])
    expect(RESERVED_PAD_BUTTONS).toEqual([8, 16])
  })

  it('refuses a file with no actions, two actions with one id, and a field it does not know', () => {
    expect(messages({ command: 'move', action: [] })).toEqual(['A controls file needs at least one action.'])
    const one = { id: 'a', send: {} }
    expect(messages({ command: 'move', action: [one, one] })).toEqual(['Two actions are called "a".'])
    expect(messages({ command: 'move', action: [{ ...one, colour: 'red' }] })).toHaveLength(1)
  })

  it('is a kind outside the sim, in controls.toml', () => {
    const kind = controlsKind()
    expect(kind.kind).toBe('controls')
    expect(kind.place).toEqual({ file: 'controls.toml' })
    expect(kind.sim).toBe(false)
  })
})
