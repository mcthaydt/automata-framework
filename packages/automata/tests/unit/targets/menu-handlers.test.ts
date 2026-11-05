import { describe, expect, it } from 'vitest'
import { makeMenuHandlers } from '#src/features/targets/menu.ts'

describe('menu handlers', () => {
  it('answers false until the session is ready, then asks the latest handler', () => {
    const menu = makeMenuHandlers()
    menu.register(() => true)
    expect(menu.answer()).toBe(false)
    menu.markReady()
    expect(menu.answer()).toBe(true)
  })

  it('answers false with no handler, so the host keeps its own drawer', () => {
    const menu = makeMenuHandlers()
    menu.markReady()
    expect(menu.answer()).toBe(false)
  })

  it('lets the latest handler win, and falls back to the one before when it is taken back', () => {
    const menu = makeMenuHandlers()
    menu.markReady()
    menu.register(() => false)
    const takeBack = menu.register(() => true)
    expect(menu.answer()).toBe(true)
    takeBack()
    expect(menu.answer()).toBe(false)
  })
})
