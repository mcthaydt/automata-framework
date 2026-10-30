import { act, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLevelEditor } from '../../model/level-editor'
import { afSectorProfile } from '../../profile/af-sector-profile'
import { toyAfSector } from '../../testing/toy-af-sector'
import type { PlanPaint } from '../../view/plan/plan-paint'
import PlanCanvas from './PlanCanvas.svelte'
import type { PlanRenderer, PlanRendererFactory } from './plan-renderer'

// The Plan view's canvas (plan ED3D.5d step 5) with a fake renderer: it draws once it knows its size, a tap selects
// through the kit's gestures, and a page that cannot draw says so and offers Try again. Pixels are the canvas
// project's (`plan-renderer.canvas.test.ts`).

let resize: ((w: number, h: number) => void) | undefined

beforeEach(() => {
  // jsdom has no ResizeObserver: this one reports the size the test gives.
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
  // jsdom has no pointer capture.
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
  const draws: PlanPaint[] = []
  const paused = writable(false)
  const made: PlanRenderer = {
    paused: { subscribe: paused.subscribe },
    draw: (paint) => draws.push(paint),
    resize: vi.fn(),
    destroy: vi.fn(),
  }
  return { made, draws, paused }
}

function mount(factory: PlanRendererFactory) {
  const editor = createLevelEditor({ profile: afSectorProfile, level: toyAfSector() })
  const handlers = { onundo: vi.fn(), onredo: vi.fn(), onpointer: vi.fn() }
  render(PlanCanvas, { editor: editor as never, renderer: factory, ...handlers })
  return { editor, ...handlers }
}

const host = (): HTMLElement => screen.getByTestId('plan-canvas')

function press(type: string, x: number, y: number): void {
  host().dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      clientX: x,
      clientY: y,
    }),
  )
}

describe('PlanCanvas', () => {
  it('makes the renderer at its measured size and draws the framed level once', async () => {
    const fake = fakeRenderer()
    const factory = vi.fn(async () => fake.made)
    mount(factory)
    expect(factory).not.toHaveBeenCalled()
    await act(() => resize?.(640, 480))
    expect(factory).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), { w: 640, h: 480, resolution: 1 })
    expect(fake.draws.at(-1)?.fills.map((fill) => fill.sector)).toEqual(['hall', 'dock'])
    expect(host()).toHaveAttribute('data-phase', 'drawing')
  })

  it('selects the sector a tap lands on, and draws it outlined', async () => {
    const fake = fakeRenderer()
    const { editor } = mount(async () => fake.made)
    await act(() => resize?.(640, 480))
    const hall = fake.draws.at(-1)?.fills.find((fill) => fill.sector === 'hall')
    const [x0 = 0, y0 = 0, x1 = 0, , , y2 = 0] = hall?.points ?? []
    // jsdom puts every element at (0, 0), so client and element coordinates agree.
    await act(() => {
      press('pointerdown', (x0 + x1) / 2, (y0 + y2) / 2)
      press('pointerup', (x0 + x1) / 2, (y0 + y2) / 2)
    })
    expect(editor.selection.ids).toEqual(['sector:hall'])
    expect(fake.draws.at(-1)?.fills.find((fill) => fill.sector === 'hall')?.selected).toBe(true)
  })

  it('says so when the page cannot draw, and Try again makes a new renderer', async () => {
    const fake = fakeRenderer()
    const factory = vi.fn<PlanRendererFactory>().mockResolvedValueOnce(undefined).mockResolvedValue(fake.made)
    mount(factory)
    await act(() => resize?.(640, 480))
    expect(await screen.findByRole('status')).toHaveTextContent('needs WebGL2. Your level is safe.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await vi.waitFor(() => expect(factory).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(host()).toHaveAttribute('data-phase', 'drawing'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says the plan stopped drawing while the context is lost, and keeps the level and selection', async () => {
    const fake = fakeRenderer()
    const { editor } = mount(async () => fake.made)
    await act(() => resize?.(640, 480))
    editor.selection.set(['sector:dock'])
    await act(() => fake.paused.set(true))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'The plan stopped drawing. Your level is safe.',
    )
    expect(editor.selection.ids).toEqual(['sector:dock'])
    await act(() => fake.paused.set(false))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('resizes without a new renderer, and draws at the new size', async () => {
    const fake = fakeRenderer()
    const factory = vi.fn(async () => fake.made)
    mount(factory)
    await act(() => resize?.(640, 480))
    const before = fake.draws.length
    await act(() => resize?.(480, 640))
    expect(factory).toHaveBeenCalledOnce()
    expect(fake.made.resize).toHaveBeenCalledWith({ w: 480, h: 640, resolution: 1 })
    expect(fake.draws.length).toBeGreaterThan(before)
  })
})
