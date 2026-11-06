import { describe, expect, test, vi } from 'vitest'
import { createCommandRegistry, defineCommand } from '../commands/command'
import { createKeymap, type KeyInput } from './keymap'

const key = (name: string, held: Partial<KeyInput> = {}): KeyInput => ({
  key: name,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  inText: false,
  ...held,
})

function setup(platform: 'apple' | 'other') {
  const registry = createCommandRegistry()
  const run = { undo: vi.fn(), redo: vi.fn(), del: vi.fn(), space: vi.fn(), rename: vi.fn() }
  registry.register(
    defineCommand({ id: 'undo', title: 'Undo', run: run.undo, shortcut: 'Mod+Z', allowInText: false }),
  )
  registry.register(defineCommand({ id: 'redo', title: 'Redo', run: run.redo, shortcut: 'Mod+Shift+Z' }))
  registry.register(defineCommand({ id: 'delete', title: 'Delete', run: run.del, shortcut: 'Delete' }))
  registry.register(defineCommand({ id: 'pan', title: 'Pan', run: run.space, shortcut: 'Space' }))
  registry.register(
    defineCommand({ id: 'rename', title: 'Rename', run: run.rename, shortcut: 'F2', allowInText: true }),
  )
  return { registry, run, keymap: createKeymap(registry, platform) }
}

describe('keymap on an Apple platform', () => {
  test('Mod is Cmd: Cmd+Z undoes, Ctrl+Z does nothing', () => {
    const { keymap, run } = setup('apple')
    expect(keymap.handle(key('z', { metaKey: true }))).toBe(true)
    expect(run.undo).toHaveBeenCalledTimes(1)
    expect(keymap.handle(key('z', { ctrlKey: true }))).toBe(false)
    expect(run.undo).toHaveBeenCalledTimes(1)
  })
})

describe('keymap elsewhere', () => {
  test('Mod is Ctrl: Ctrl+Z undoes, Meta+Z does nothing', () => {
    const { keymap, run } = setup('other')
    expect(keymap.handle(key('z', { ctrlKey: true }))).toBe(true)
    expect(run.undo).toHaveBeenCalledTimes(1)
    expect(keymap.handle(key('z', { metaKey: true }))).toBe(false)
  })
})

describe('keymap matching', () => {
  test('keys compare ignoring case, so Shift+Z (which reports "Z") finds Mod+Shift+Z', () => {
    const { keymap, run } = setup('other')
    expect(keymap.handle(key('Z', { ctrlKey: true, shiftKey: true }))).toBe(true)
    expect(run.redo).toHaveBeenCalledTimes(1)
    expect(run.undo).not.toHaveBeenCalled()
  })

  test('modifiers must match exactly: an extra Shift or Alt is a different shortcut', () => {
    const { keymap, run } = setup('other')
    expect(keymap.handle(key('z', { ctrlKey: true, altKey: true }))).toBe(false)
    expect(keymap.handle(key('Delete', { shiftKey: true }))).toBe(false)
    expect(run.undo).not.toHaveBeenCalled()
    expect(run.del).not.toHaveBeenCalled()
  })

  test('a bare key and Space', () => {
    const { keymap, run } = setup('other')
    expect(keymap.handle(key('Delete'))).toBe(true)
    expect(keymap.handle(key(' '))).toBe(true)
    expect(run.del).toHaveBeenCalledTimes(1)
    expect(run.space).toHaveBeenCalledTimes(1)
  })

  test('an unknown key is not handled, so the browser keeps it', () => {
    const { keymap } = setup('other')
    expect(keymap.handle(key('q'))).toBe(false)
    expect(keymap.resolve(key('q'))).toBeUndefined()
  })

  test('resolve names the command without running it', () => {
    const { keymap, run } = setup('other')
    expect(keymap.resolve(key('z', { ctrlKey: true }))?.id).toBe('undo')
    expect(run.undo).not.toHaveBeenCalled()
  })
})

describe('keymap and text fields', () => {
  test('a shortcut leaves typing alone unless the command says allowInText', () => {
    const { keymap, run } = setup('other')
    expect(keymap.handle(key('z', { ctrlKey: true, inText: true }))).toBe(false)
    expect(keymap.handle(key('Delete', { inText: true }))).toBe(false)
    expect(keymap.handle(key(' ', { inText: true }))).toBe(false)
    expect(run.undo).not.toHaveBeenCalled()
    expect(keymap.handle(key('F2', { inText: true }))).toBe(true)
    expect(run.rename).toHaveBeenCalledTimes(1)
  })
})

describe('keymap and disabled commands', () => {
  test('a disabled command is not resolved, so its key falls through', () => {
    const registry = createCommandRegistry()
    const run = vi.fn()
    let canUndo = false
    registry.register(
      defineCommand({ id: 'undo', title: 'Undo', run, shortcut: 'Mod+Z', enabled: () => canUndo }),
    )
    const keymap = createKeymap(registry, 'other')
    expect(keymap.handle(key('z', { ctrlKey: true }))).toBe(false)
    canUndo = true
    expect(keymap.handle(key('z', { ctrlKey: true }))).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
  })

  test('follows the registry: a command registered later has its key, and one removed loses it', () => {
    const registry = createCommandRegistry()
    const keymap = createKeymap(registry, 'other')
    const run = vi.fn()
    expect(keymap.handle(key('g'))).toBe(false)
    const unregister = registry.register(defineCommand({ id: 'grid', title: 'Grid', run, shortcut: 'G' }))
    expect(keymap.handle(key('g'))).toBe(true)
    unregister()
    expect(keymap.handle(key('g'))).toBe(false)
  })

  test('a command without a shortcut is never resolved by a key', () => {
    const registry = createCommandRegistry()
    registry.register(defineCommand({ id: 'menu-only', title: 'Menu only', run: () => {} }))
    expect(createKeymap(registry, 'other').resolve(key('m'))).toBeUndefined()
  })
})
