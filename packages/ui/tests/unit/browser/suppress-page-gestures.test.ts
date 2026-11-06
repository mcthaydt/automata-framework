import { afterEach, describe, expect, it } from 'vitest'
import { suppressPageGestures } from '#src/browser/suppress-page-gestures.ts'
import theme from '#src/theme.css?raw'

let release: (() => void) | undefined
afterEach(() => {
  release?.()
  release = undefined
  document.body.innerHTML = ''
})

/** The element `selector` names; throws when the page has none. */
function find(selector: string): Element {
  const element = document.querySelector(selector)
  if (element === null) throw new Error(`no ${selector}`)
  return element
}

/** Dispatches a cancelable `type` at `target` and reports whether it was cancelled. */
function cancelled(target: Element, type: string): boolean {
  const event = new Event(type, { bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event.defaultPrevented
}

describe('suppressPageGestures', () => {
  it('cancels the context menu and image drags over the game', () => {
    document.body.innerHTML = `<canvas></canvas><img alt="" /><button>Ready</button>`
    release = suppressPageGestures(document)
    expect(cancelled(find('canvas'), 'contextmenu')).toBe(true)
    expect(cancelled(find('button'), 'contextmenu')).toBe(true)
    expect(cancelled(find('img'), 'dragstart')).toBe(true)
  })

  it('leaves text fields their menu, so a room code can be pasted', () => {
    document.body.innerHTML = `<input data-testid="code-input" />`
    release = suppressPageGestures(document)
    expect(cancelled(find('input'), 'contextmenu')).toBe(false)
  })

  it('stops cancelling once released', () => {
    document.body.innerHTML = `<canvas></canvas>`
    suppressPageGestures(document)()
    expect(cancelled(find('canvas'), 'contextmenu')).toBe(false)
  })
})

describe("the page's selection rules", () => {
  const css = theme

  it('turns text selection and the long-press callout off for the page', () => {
    expect(css).toMatch(/html\s*\{[^}]*user-select:\s*none[^}]*-webkit-touch-callout:\s*none/)
  })

  it('gives selection back to text fields', () => {
    expect(css).toMatch(/input,\s*textarea\s*\{[^}]*user-select:\s*text/)
  })
})
