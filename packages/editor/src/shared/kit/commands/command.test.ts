import { describe, expect, test, vi } from 'vitest'
import { createCommandRegistry, defineCommand } from './command'

const command = (id: string, extra: Partial<Parameters<typeof defineCommand>[0]> = {}) =>
  defineCommand({ id, title: id, run: () => {}, ...extra })

describe('defineCommand', () => {
  test('returns the command it was given', () => {
    const run = () => {}
    const defined = defineCommand({ id: 'edit.undo', title: 'Undo', run, shortcut: 'Mod+Z' })
    expect(defined).toMatchObject({ id: 'edit.undo', title: 'Undo', shortcut: 'Mod+Z' })
    expect(defined.run).toBe(run)
  })

  test('refuses an empty id or title, and a shortcut it cannot read', () => {
    expect(() => defineCommand({ id: '', title: 'x', run: () => {} })).toThrow(/id/)
    expect(() => defineCommand({ id: 'x', title: ' ', run: () => {} })).toThrow(/title/)
    expect(() => defineCommand({ id: 'x', title: 'x', run: () => {}, shortcut: 'Mod+' })).toThrow(/shortcut/i)
  })
})

describe('command registry', () => {
  test('lists commands in registration order and finds them by id', () => {
    const registry = createCommandRegistry()
    const undo = command('edit.undo')
    const redo = command('edit.redo')
    registry.register(undo)
    registry.register(redo)
    expect(registry.list()).toEqual([undo, redo])
    expect(registry.get('edit.redo')).toBe(redo)
    expect(registry.get('nope')).toBeUndefined()
  })

  test('refuses a duplicate id', () => {
    const registry = createCommandRegistry()
    registry.register(command('a'))
    expect(() => registry.register(command('a'))).toThrow(/"a"/)
  })

  test('refuses two commands with the same shortcut, however it is written', () => {
    const registry = createCommandRegistry()
    registry.register(command('undo', { shortcut: 'Mod+Shift+Z' }))
    expect(() => registry.register(command('redo', { shortcut: 'shift+mod+z' }))).toThrow(/undo/)
  })

  test('unregister frees the id and the shortcut', () => {
    const registry = createCommandRegistry()
    const unregister = registry.register(command('a', { shortcut: 'Delete' }))
    unregister()
    expect(registry.list()).toEqual([])
    expect(() => registry.register(command('a', { shortcut: 'Delete' }))).not.toThrow()
  })

  test('unregister only removes its own registration', () => {
    const registry = createCommandRegistry()
    const first = command('a')
    const unregister = registry.register(first)
    unregister()
    const second = command('a')
    registry.register(second)
    unregister()
    expect(registry.get('a')).toBe(second)
  })

  test('run runs an enabled command once and says so', () => {
    const registry = createCommandRegistry()
    const run = vi.fn()
    registry.register(command('go', { run }))
    expect(registry.run('go')).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
  })

  test('run does nothing and says so for an unknown or disabled command', () => {
    const registry = createCommandRegistry()
    const run = vi.fn()
    registry.register(command('off', { run, enabled: () => false }))
    expect(registry.run('off')).toBe(false)
    expect(registry.run('missing')).toBe(false)
    expect(run).not.toHaveBeenCalled()
  })

  test('enabled is asked each time, so it follows the editor state', () => {
    const registry = createCommandRegistry()
    let on = false
    const run = vi.fn()
    registry.register(command('maybe', { run, enabled: () => on }))
    expect(registry.run('maybe')).toBe(false)
    on = true
    expect(registry.run('maybe')).toBe(true)
  })
})
