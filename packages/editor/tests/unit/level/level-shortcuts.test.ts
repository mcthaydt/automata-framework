import { describe, expect, it } from 'vitest'
import { type ShortcutKey, shortcutFor } from '#src/features/level/level-shortcuts.ts'

const key = (name: string, mods: Partial<Omit<ShortcutKey, 'key'>> = {}): ShortcutKey => ({
  key: name,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
})
const onCanvas = { inText: false, canNudge: true }

describe('shortcutFor (2D editor spec §12)', () => {
  it('maps every shortcut of §12', () => {
    const cases: readonly [ShortcutKey, ReturnType<typeof shortcutFor>][] = [
      [key('z', { metaKey: true }), { action: 'undo' }],
      [key('z', { ctrlKey: true }), { action: 'undo' }],
      [key('Z', { metaKey: true, shiftKey: true }), { action: 'redo' }],
      [key('Delete'), { action: 'delete' }],
      [key('Backspace'), { action: 'delete' }],
      [key('d', { metaKey: true }), { action: 'duplicate' }],
      [key('b'), { action: 'tool', tool: 'brush' }],
      [key('r'), { action: 'tool', tool: 'rectangle' }],
      [key('g'), { action: 'tool', tool: 'fill' }],
      [key('e'), { action: 'tool', tool: 'eraser' }],
      [key('i'), { action: 'tool', tool: 'picker' }],
      [key('['), { action: 'brush', by: -1 }],
      [key(']'), { action: 'brush', by: 1 }],
      [key('ArrowLeft'), { action: 'nudge', by: { x: -1, y: 0 } }],
      [key('ArrowRight'), { action: 'nudge', by: { x: 1, y: 0 } }],
      [key('ArrowUp'), { action: 'nudge', by: { x: 0, y: -1 } }],
      [key('ArrowDown', { shiftKey: true }), { action: 'nudge', by: { x: 0, y: 8 } }],
    ]
    for (const [event, expected] of cases) expect(shortcutFor(event, onCanvas), event.key).toEqual(expected)
  })

  it('lets only undo and redo through while focus is in a text field', () => {
    const inText = { inText: true, canNudge: false }
    expect(shortcutFor(key('z', { ctrlKey: true }), inText)).toEqual({ action: 'undo' })
    expect(shortcutFor(key('z', { ctrlKey: true, shiftKey: true }), inText)).toEqual({ action: 'redo' })
    for (const name of ['b', 'Delete', 'Backspace', '[', 'ArrowLeft'])
      expect(shortcutFor(key(name), inText), name).toBeUndefined()
    expect(shortcutFor(key('d', { metaKey: true }), inText)).toBeUndefined()
  })

  it('nudges only where arrows are not a list’s own keys', () => {
    expect(shortcutFor(key('ArrowLeft'), { inText: false, canNudge: false })).toBeUndefined()
  })

  it('leaves letters with a modifier, and other keys, to the browser', () => {
    expect(shortcutFor(key('b', { metaKey: true }), onCanvas)).toBeUndefined()
    expect(shortcutFor(key('b', { altKey: true }), onCanvas)).toBeUndefined()
    expect(shortcutFor(key('q'), onCanvas)).toBeUndefined()
  })
})
