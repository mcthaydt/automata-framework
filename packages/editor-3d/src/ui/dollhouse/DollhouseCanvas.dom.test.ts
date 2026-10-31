import { act, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DollhousePaint } from '../../app/dollhouse-paint'
import { createLevelEditor } from '../../model/level-editor'
import { afSectorProfile } from '../../profile/af-sector-profile'
import { toyAfSector } from '../../testing/toy-af-sector'
import DollhouseCanvas from './DollhouseCanvas.svelte'
import type { DollhouseRenderer, DollhouseRendererFactory } from './dollhouse-renderer'

// The Dollhouse canvas (plan ED3D.5e step 5) with a fake renderer: it draws the framed level once it knows its size, a
// tap selects through the kit's gestures, the plan's selection shows, and a page that cannot draw says so and offers Try
// again. Pixels are the canvas project's.

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

function mount(factory: DollhouseRendererFactory) {
  const editor = createLevelEditor({ profile: afSectorProfile, level: toyAfSector() })
  const handlers = { onundo: vi.fn(), onredo: vi.fn() }
  render(DollhouseCanvas, { editor: editor as never, renderer: factory, ...handlers })
  return { editor, ...handlers }
}

const host = (): HTMLElement => screen.getByTestId('dollhouse-canvas')

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

describe('DollhouseCanvas', () => {
  it('makes the renderer at its measured size and draws the framed level', async () => {
    const fake = fakeRenderer()
    const factory = vi.fn(async () => fake.made)
    mount(factory)
    await act(() => resize?.(600, 400))
    expect(factory).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), { w: 600, h: 400, resolution: 1 })
    expect(fake.draws.at(-1)?.polygons.length).toBeGreaterThan(0)
    expect(host()).toHaveAttribute('data-phase', 'drawing')
  })

  it('selects what a tap hits, and draws the plan’s selection', async () => {
    const fake = fakeRenderer()
    const { editor } = mount(async () => fake.made)
    await act(() => resize?.(600, 400))
    // The middle of the canvas looks at the middle of the level.
    await act(() => {
      press('pointerdown', 300, 200)
      press('pointerup', 300, 200)
    })
    expect(editor.selection.ids.length).toBe(1)
    await act(() => editor.selection.set(['sector:dock']))
    expect(fake.draws.at(-1)?.polygons.some((polygon) => polygon.selected)).toBe(true)
  })

  it('says so when the page cannot draw, keeps the level, and Try again makes a new renderer', async () => {
    const fake = fakeRenderer()
    const factory = vi
      .fn<DollhouseRendererFactory>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(fake.made)
    mount(factory)
    await act(() => resize?.(600, 400))
    expect(await screen.findByRole('status')).toHaveTextContent('can’t draw the 3D view')
    expect(screen.getByRole('status')).toHaveTextContent('The plan still works')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await vi.waitFor(() => expect(factory).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(host()).toHaveAttribute('data-phase', 'drawing'))
  })

  it('says the 3D view stopped drawing while the context is lost', async () => {
    const fake = fakeRenderer()
    mount(async () => fake.made)
    await act(() => resize?.(600, 400))
    await act(() => fake.paused.set(true))
    expect(await screen.findByRole('status')).toHaveTextContent('The 3D view stopped drawing.')
    await act(() => fake.paused.set(false))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
