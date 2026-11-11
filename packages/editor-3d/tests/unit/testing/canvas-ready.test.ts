// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { untilAttribute } from '#src/testing/canvas-ready.ts'

// A journey waits for a WebGL canvas to be ready. When it never is, the message says which case it was: still
// starting (a slow runner) or unavailable (a runner without WebGL), because the fix for each is different.

afterEach(() => {
  document.body.replaceChildren()
})

function canvas(attributes: Record<string, string>): HTMLElement {
  const element = document.body.appendChild(document.createElement('div'))
  element.dataset['testid'] = 'walk-canvas'
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  return element
}

describe('untilAttribute', () => {
  it('resolves when the canvas already has the value, and when it gets it later', async () => {
    const element = canvas({ 'data-phase': 'starting' })
    setTimeout(() => element.setAttribute('data-phase', 'drawing'), 20)
    await untilAttribute('walk-canvas', 'data-phase', 'drawing', { timeout: 1000 })
  })

  it('names the phase it was left in when the canvas never gets there', async () => {
    canvas({ 'data-phase': 'starting' })
    await expect(untilAttribute('walk-canvas', 'data-phase', 'drawing', { timeout: 60 })).rejects.toThrow(
      /walk-canvas.*data-phase is "starting"/,
    )
  })

  it('says a runner without WebGL is not slowness', async () => {
    canvas({ 'data-phase': 'unavailable' })
    await expect(untilAttribute('walk-canvas', 'data-phase', 'drawing', { timeout: 60 })).rejects.toThrow(
      /no WebGL on this runner, not a slow one/,
    )
  })

  it('says when the canvas is not on the page at all', async () => {
    await expect(untilAttribute('walk-canvas', 'data-phase', 'drawing', { timeout: 60 })).rejects.toThrow(
      /not on the page/,
    )
  })
})
