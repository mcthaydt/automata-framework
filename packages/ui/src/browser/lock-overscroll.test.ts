import { describe, expect, it } from 'vitest'
import { lockOverscroll, pastEdge } from './lock-overscroll'

const region = (scrollTop: number) => ({ scrollTop, scrollHeight: 600, clientHeight: 200 })

describe('lockOverscroll', () => {
  it('treats a pull down at the top as past the edge', () => {
    expect(pastEdge(region(0), 12)).toBe(true)
  })

  it('lets a pull down scroll a region that is not at its top', () => {
    expect(pastEdge(region(80), 12)).toBe(false)
  })

  it('treats a push up at the bottom as past the edge', () => {
    expect(pastEdge(region(400), -12)).toBe(true)
    expect(pastEdge(region(400), 12)).toBe(false)
  })

  it('treats a region with nothing to scroll as an edge both ways', () => {
    const fits = { scrollTop: 0, scrollHeight: 200, clientHeight: 200 }
    expect(pastEdge(fits, 12)).toBe(true)
    expect(pastEdge(fits, -12)).toBe(true)
  })
})

describe('a drag on a region that does not scroll itself', () => {
  /** A screen that scrolls, holding a sheet that does not, as desktop lays out the menu. */
  function screenWithSheet(scrollTop: number): HTMLElement {
    const screen = document.createElement('section')
    screen.style.overflowY = 'auto'
    Object.defineProperties(screen, {
      scrollHeight: { value: 1200 },
      clientHeight: { value: 800 },
      scrollTop: { value: scrollTop, writable: true },
    })
    const sheet = document.createElement('div')
    screen.append(sheet)
    document.body.append(screen)
    lockOverscroll(sheet)
    return sheet
  }

  /** Drags a finger down `dy` pixels on `node`; true when the move was cancelled. */
  function dragDown(node: HTMLElement, dy: number): boolean {
    const touch = (y: number) => [{ clientX: 100, clientY: y }]
    const start = new Event('touchstart', { bubbles: true })
    Object.defineProperty(start, 'touches', { value: touch(100) })
    node.dispatchEvent(start)
    const move = new Event('touchmove', { bubbles: true, cancelable: true })
    Object.defineProperty(move, 'touches', { value: touch(100 + dy) })
    node.dispatchEvent(move)
    return move.defaultPrevented
  }

  it('leaves the drag to the screen around it while the screen can scroll', () => {
    expect(dragDown(screenWithSheet(200), 20)).toBe(false)
  })

  it('stops the drag once the screen around it is at its top', () => {
    expect(dragDown(screenWithSheet(0), 20)).toBe(true)
  })
})
