// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FeelContent, FeelSettings } from '@automata/feel'
import { render } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FeelStage from '#src/features/feel/FeelStage.svelte'

// The preview draws its word in the face and the way play does (spec D10): Geist semibold, white with a black shadow
// 1.5 CSS px down and right, at the device's pixel density, once the face is loaded.
const SETTINGS: FeelSettings = { reduceFlashing: false, haptics: true, intensity: 1 }
const content: FeelContent = {
  entry: [{ on: 'slam', word: [{ key: 'slam.word', words: 'Ouch, a wall!', at: 'subject' }] }],
}
const outputs = { rumble: () => true, cue: () => true }

interface Call {
  readonly font: string
  readonly fillStyle: string
  readonly text: string
  readonly x: number
  readonly y: number
}

let calls: Call[]
let scales: [number, number][]
let order: string[]
let canvases: HTMLCanvasElement[]

beforeEach(() => {
  calls = []
  scales = []
  order = []
  canvases = []
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
  const context = {
    font: '',
    fillStyle: '',
    textAlign: '',
    globalAlpha: 1,
    clearRect: () => {},
    fillRect: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: (x: number, y: number) => void scales.push([x, y]),
    setTransform: (a: number, _b: number, _c: number, d: number) => void scales.push([a, d]),
    fillText(text: string, x: number, y: number) {
      order.push('fillText')
      calls.push({ font: this.font, fillStyle: this.fillStyle, text, x, y })
    },
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    canvases.push(this)
    return context as never
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 320,
    height: 200,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 320,
    bottom: 200,
    toJSON: () => ({}),
  })
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      load: vi.fn(async () => {
        order.push('load')
        return []
      }),
    },
  })
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) =>
    setTimeout(() => run(performance.now()), 0),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const mount = () =>
  render(FeelStage, { content, on: 'slam', settings: SETTINGS, reduced: false, outputs, replay: 0 })

const words = () => calls.filter((call) => call.text === 'Ouch, a wall!')

describe('the Feel preview word', () => {
  it('waits for the face to load before it draws anything', async () => {
    mount()
    await vi.waitFor(() => expect(words().length).toBeGreaterThan(0))
    expect(order.indexOf('load')).toBeGreaterThanOrEqual(0)
    expect(order.indexOf('load')).toBeLessThan(order.indexOf('fillText'))
  })

  it('draws it in Geist semibold, a black shadow at +1.5, +1.5 CSS px under the white fill', async () => {
    mount()
    await vi.waitFor(() => expect(words().length).toBeGreaterThanOrEqual(2))
    const [shadow, fill] = words()
    expect(fill?.font).toContain('600')
    expect(fill?.font).toContain('"Geist Variable"')
    expect(shadow?.fillStyle).toBe('#000000')
    expect(fill?.fillStyle).toBe('#ffffff')
    expect((shadow?.x ?? 0) - (fill?.x ?? 0)).toBeCloseTo(1.5)
    expect((shadow?.y ?? 0) - (fill?.y ?? 0)).toBeCloseTo(1.5)
  })

  it('backs the canvas with one pixel per device pixel and scales the drawing to match', async () => {
    mount()
    await vi.waitFor(() => expect(words().length).toBeGreaterThan(0))
    const canvas = canvases[0] as HTMLCanvasElement
    expect([canvas.width, canvas.height]).toEqual([640, 400])
    expect(scales).toContainEqual([2, 2])
  })

  it('shows a dark game field in both themes', () => {
    const source = readFileSync(
      join(import.meta.dirname, '../../../src/features/feel/FeelStage.svelte'),
      'utf8',
    )
    const canvasRule = /\n\s*canvas\s*\{[^}]*\}/.exec(source)?.[0] ?? ''
    expect(canvasRule).toContain('var(--color-bg-canvas)')
    expect(canvasRule).not.toContain('--color-bg-field')
  })
})
