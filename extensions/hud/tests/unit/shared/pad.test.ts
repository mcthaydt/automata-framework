// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { neighbour, padSteer } from '#src/shared/pad.ts'

// A pad steering a piece: the D-pad moves to the nearest control that way, A presses the focused one, B goes back.

const at = (button: HTMLElement, x: number, y: number): void => {
  button.getBoundingClientRect = () => ({
    left: x,
    top: y,
    width: 10,
    height: 10,
    right: x + 10,
    bottom: y + 10,
    x,
    y,
    toJSON: () => ({}),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('neighbour', () => {
  it('picks the nearest control in the direction, straight ahead before off to the side', () => {
    const [a, right, below, farRight] = [0, 1, 2, 3].map(() => document.createElement('button'))
    at(a as HTMLElement, 0, 0)
    at(right as HTMLElement, 50, 0)
    at(below as HTMLElement, 0, 50)
    at(farRight as HTMLElement, 120, 0)
    const all = [a, right, below, farRight] as HTMLElement[]
    expect(neighbour(a as HTMLElement, all, 1, 0)).toBe(right)
    expect(neighbour(a as HTMLElement, all, 0, 1)).toBe(below)
    expect(neighbour(a as HTMLElement, all, -1, 0)).toBeUndefined()
    expect(neighbour(a as HTMLElement, all, 0, -1)).toBeUndefined()
  })
})

describe('padSteer', () => {
  it('moves the focus with the D-pad, presses with A and goes back with B', () => {
    let down: number[] = []
    vi.stubGlobal('navigator', {
      getGamepads: () => [{ buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: down.includes(i) })) }],
    })
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callbacks.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const node = document.body.appendChild(document.createElement('div'))
    const one = node.appendChild(document.createElement('button'))
    const two = node.appendChild(document.createElement('button'))
    at(one, 0, 0)
    at(two, 50, 0)
    const clicked: string[] = []
    one.onclick = () => clicked.push('one')
    two.onclick = () => clicked.push('two')
    let backs = 0
    const action = padSteer(node, { onback: () => (backs += 1) })
    const frame = (...buttons: number[]): void => {
      down = buttons
      for (const step of callbacks.splice(0)) step(0)
    }
    one.focus()
    frame(15)
    expect(document.activeElement).toBe(two)
    frame()
    frame(0)
    expect(clicked).toEqual(['two'])
    frame(0)
    expect(clicked).toEqual(['two'])
    frame()
    frame(1)
    expect(backs).toBe(1)
    action.destroy()
  })

  it('does not take a button already held when the piece appears for a press', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [{ buttons: [{ pressed: true }] }] })
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callbacks.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const node = document.body.appendChild(document.createElement('div'))
    const button = node.appendChild(document.createElement('button'))
    let clicks = 0
    button.onclick = () => (clicks += 1)
    button.focus()
    padSteer(node)
    for (const step of callbacks.splice(0)) step(0)
    expect(clicks).toBe(0)
  })
})
