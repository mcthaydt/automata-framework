import { act, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DollhousePaint } from '../../app/dollhouse-paint'
import type { AfSector } from '../../format/af-sector.schema'
import { createLevelEditor } from '../../model/level-editor'
import { afSectorProfile } from '../../profile/af-sector-profile'
import { toyAfSector } from '../../testing/toy-af-sector'
import type { DollhouseRenderer, DollhouseRendererFactory } from '../dollhouse/dollhouse-renderer'
import type { Frames } from './frames'
import WalkCanvas from './WalkCanvas.svelte'

// The Walk canvas (ED3D.8b) with a fake renderer and a frame clock walked by hand: it draws the level through the eye once it
// knows its size, a tap picks what the crosshair is on through the editor's one selection, W A S D walk, the sticks and the
// modes work, the start with no spawn says so (ED3-n), and a page that cannot draw says so and offers Try again (ED3-p).

let resize: ((w: number, h: number) => void) | undefined

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly run: ResizeObserverCallback) {}
      observe(): void {
        resize = (w, h) =>
          this.run(
            [{ contentRect: { width: w, height: h } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          )
      }
      disconnect(): void {
        resize = undefined
      }
    },
  )
  Object.assign(HTMLElement.prototype, {
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
    hasPointerCapture: () => false,
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  resize = undefined
})

function fakeRenderer() {
  const draws: DollhousePaint[] = []
  const paused = writable(false)
  const made: DollhouseRenderer = {
    paused: { subscribe: paused.subscribe },
    draw: (paint) => draws.push(paint),
    resize: vi.fn(),
    destroy: vi.fn(),
  }
  return { made, draws, paused }
}

/** A frame clock the test advances: `step(seconds)` runs the callback asked for, at that time. */
function fakeFrames(): Frames & { step(seconds: number): void } {
  let pending: ((seconds: number) => void) | undefined
  return {
    request: (callback) => {
      pending = callback
      return 1
    },
    cancel: () => {
      pending = undefined
    },
    step(seconds) {
      const run = pending
      pending = undefined
      run?.(seconds)
    },
  }
}

const withSpawn = (): AfSector =>
  toyAfSector({
    entityDefs: [
      { id: 'spawn', shape: 'point', single: true, fields: [{ id: 'facing', type: 'angle', default: 0 }] },
    ],
    entities: [{ def: 'spawn', id: 'spawn', x: 2, z: 3, facing: Math.PI / 2 }],
  } as Partial<AfSector>)

function mount(factory: DollhouseRendererFactory, level: AfSector = withSpawn()) {
  const editor = createLevelEditor({ profile: afSectorProfile, level })
  const frames = fakeFrames()
  const words: (string | undefined)[] = []
  const handlers = {
    onundo: vi.fn(),
    onredo: vi.fn(),
    onwords: (text: string | undefined) => words.push(text),
  }
  render(WalkCanvas, { editor: editor as never, renderer: factory, frames, ...handlers })
  return { editor, frames, words, ...handlers }
}

const host = (): HTMLElement => screen.getByTestId('walk-canvas')

function press(target: HTMLElement, type: string, x: number, y: number, kind = 'mouse'): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: kind,
      clientX: x,
      clientY: y,
    }),
  )
}

async function ready(factory: DollhouseRendererFactory) {
  const mounted = mount(factory)
  await act(() => resize?.(800, 600))
  await vi.waitFor(() => expect(host()).toHaveAttribute('data-phase', 'drawing'))
  return mounted
}

describe('WalkCanvas', () => {
  it('draws the level through the eye at its size, with the HUD over it', async () => {
    const { made, draws } = fakeRenderer()
    await ready(async () => made)
    expect(draws.length).toBeGreaterThan(0)
    expect(draws.at(-1)?.polygons.length).toBeGreaterThan(0)
    expect(screen.getByTestId('walk-hud')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Minimap' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Walk' })).toHaveAttribute('aria-checked', 'true')
  })

  it('says what the crosshair is on, in the chip and to the status line', async () => {
    const { made } = fakeRenderer()
    const { words } = await ready(async () => made)
    await vi.waitFor(() => expect(screen.getByTestId('walk-chip').textContent).toMatch(/·/))
    expect(words.at(-1)).toBe(screen.getByTestId('walk-chip').textContent)
  })

  it('picks what the crosshair is on with a tap, through the editor’s one selection (ED3-f)', async () => {
    const { made } = fakeRenderer()
    const { editor } = await ready(async () => made)
    press(host(), 'pointerdown', 400, 300)
    press(host(), 'pointerup', 400, 300)
    await vi.waitFor(() => expect(editor.selection.ids.length).toBe(1))
    expect(editor.selection.ids[0]).toMatch(/^(wall|sector):/)
  })

  it('walks with W on the frame clock, and stops when the key is let go', async () => {
    const { made } = fakeRenderer()
    const { frames } = await ready(async () => made)
    const eye = () => screen.getByTestId('walk-minimap').querySelector('circle')?.getAttribute('cx')
    const before = eye()
    host().focus()
    await userEvent.keyboard('{w>}')
    frames.step(0)
    frames.step(0.1)
    frames.step(0.2)
    await userEvent.keyboard('{/w}')
    await vi.waitFor(() => expect(eye()).not.toBe(before))
  })

  it('keeps a key it uses from the editor’s own shortcuts while it has the focus', async () => {
    const { made } = fakeRenderer()
    await ready(async () => made)
    const outside = vi.fn()
    window.addEventListener('keydown', outside)
    host().focus()
    await userEvent.keyboard('d')
    window.removeEventListener('keydown', outside)
    expect(outside).not.toHaveBeenCalled()
  })

  it('switches mode, and Fly offers Up and Down', async () => {
    const { made } = fakeRenderer()
    await ready(async () => made)
    expect(screen.queryByRole('button', { name: 'Fly up' })).toBeNull()
    await userEvent.click(screen.getByRole('radio', { name: 'Fly' }))
    expect(host()).toHaveAttribute('data-mode', 'fly')
    expect(screen.getByRole('button', { name: 'Fly up' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Orbit' }))
    expect(host()).toHaveAttribute('data-mode', 'orbit')
  })

  it('tilts a stick with a finger and lets it go: the thumb follows and springs back', async () => {
    const { made } = fakeRenderer()
    await ready(async () => made)
    const pad = screen.getByTestId('stick-look')
    pad.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const thumb = pad.querySelector<HTMLElement>('.thumb')
    await act(() => press(pad, 'pointerdown', 120, 60, 'touch'))
    expect(thumb?.style.transform).toContain('60px')
    await act(() => press(pad, 'pointerup', 120, 60, 'touch'))
    expect(thumb?.style.transform).toBe('translate(0px, 0px)')
  })

  it('says a level with no spawn starts in the middle of the first sector, in the status line (ED3-n)', async () => {
    const { made } = fakeRenderer()
    const mounted = mount(async () => made, toyAfSector())
    await act(() => resize?.(800, 600))
    await vi.waitFor(() => expect(screen.getByTestId('walk-warning').textContent).toMatch(/no spawn/))
    expect(mounted.words.at(-1)).toMatch(/no spawn/)
  })

  it('says when the page cannot draw and offers Try again, the editor untouched (ED3-p)', async () => {
    let tries = 0
    mount(async () => {
      tries += 1
      return undefined
    })
    await act(() => resize?.(800, 600))
    await vi.waitFor(() => expect(host()).toHaveAttribute('data-phase', 'unavailable'))
    expect(screen.getByRole('status', { hidden: true }).textContent).toMatch(/needs WebGL2/)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await vi.waitFor(() => expect(tries).toBe(2))
  })

  it('does not move the camera with a Pencil drag', async () => {
    const { made, draws } = fakeRenderer()
    await ready(async () => made)
    const before = draws.length
    press(host(), 'pointerdown', 300, 300, 'pen')
    press(host(), 'pointermove', 400, 320, 'pen')
    press(host(), 'pointermove', 500, 340, 'pen')
    press(host(), 'pointerup', 500, 340, 'pen')
    const last = draws.at(-1)
    expect(draws.length - before).toBeLessThanOrEqual(1)
    expect(last).toBeDefined()
  })
})
