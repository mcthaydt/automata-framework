// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DollhouseCanvas from '#src/features/levels-3d/dollhouse/DollhouseCanvas.svelte'
import type { DollhousePaint } from '#src/features/levels-3d/dollhouse/dollhouse-paint.ts'
import type {
  DollhouseRenderer,
  DollhouseRendererFactory,
} from '#src/features/levels-3d/dollhouse/dollhouse-renderer.ts'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { toyAfSector, toyDock, toyHall } from '#src/testing/toy-af-sector.ts'

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

function mount(
  factory: DollhouseRendererFactory,
  level = toyAfSector(),
  colours?: (name: string) => number | undefined,
) {
  const editor = createLevelEditor({ profile: afSectorProfile, level })
  const handlers = { onundo: vi.fn(), onredo: vi.fn() }
  render(DollhouseCanvas, { editor: editor as never, renderer: factory, ...handlers, colours })
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

  it('draws the rooms in the game’s colours for the materials they name', async () => {
    const fake = fakeRenderer()
    const level = toyAfSector({ sectors: [{ ...toyHall, floorTexture: 'oak' }, toyDock] })
    mount(
      async () => fake.made,
      level,
      (name) => (name === 'oak' ? 0xf0c080 : undefined),
    )
    await act(() => resize?.(600, 400))
    const floorOf = (sector: string) =>
      fake.draws
        .at(-1)
        ?.polygons.find((polygon) => polygon.role === 'floor' && polygon.selection === `sector:${sector}`)
    // The hall's floor is oak, light and warm; the dock names nothing and keeps the blockout's grey.
    expect((floorOf('hall')?.color ?? 0) >> 16).toBeGreaterThan(0xa0)
    expect((floorOf('dock')?.color ?? 0xffffff) >> 16).toBeLessThan(0x60)
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
