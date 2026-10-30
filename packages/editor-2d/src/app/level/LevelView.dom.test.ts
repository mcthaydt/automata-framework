import {
  createToasts,
  type LifecycleDocument,
  type LifecycleWindow,
} from '@mcthaydt/automata-editor-kit/core'
import { stubGeometry } from '@mcthaydt/automata-editor-kit/testing'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { counterIds } from '../../model/ids'
import FakeLevelCanvas from '../../testing/FakeLevelCanvas.svelte'
import { memoryWorkspace } from '../../testing/memory-workspace'
import { createTestClock } from '../../testing/test-clock'
import DocumentScreen from '../document/DocumentScreen.svelte'
import { createDocumentController } from '../document/document-controller'
import { createEditorApp } from '../editor-app'
import { createAppProfiles } from '../profiles'

// The Level view in jsdom (plan ED2D.4c4a step 7): the layer panel, the palette, the toolbar and what reaches the
// canvas, mounted the way the app mounts it, with a stand-in canvas. The pointer itself is tested in Node (the session
// and the gestures) and in real browsers (`level-view.canvas.test.ts`).

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

/** A `ResizeObserver` that reports one box at once, as a browser does when it starts observing. */
function measuredAt(width: number, height: number): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(
        private readonly report: (entries: { contentRect: { width: number; height: number } }[]) => void,
      ) {}
      observe(): void {
        this.report([{ contentRect: { width, height } }])
      }
      disconnect(): void {}
    },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

async function mount(size: [number, number] = [1194, 834]) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create('level-project', 'platformer')
  if (opened.status !== 'opened') throw new Error(opened.status)
  const toasts = createToasts({ clock })
  const controller = createDocumentController({ app, opened, toasts, lifecycle: quietPage() })
  render(DocumentScreen, {
    geometry: stubGeometry(...size),
    controller,
    toasts,
    clock,
    read: (path: string) => workspace.store.read(path),
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
    onback: () => {},
  })
  return { opened }
}

const canvas = (): HTMLElement => screen.getByTestId('fake-canvas')
const layers = (): HTMLElement => screen.getByRole('listbox', { name: 'Layers' })

describe('Level view: layers', () => {
  it('lists the layers front to back with their kind in plain words, the first chosen', async () => {
    await mount()
    const rows = within(layers()).getAllByRole('option')
    expect(rows.map((row) => row.querySelector('.label')?.textContent)).toEqual([
      'Entities',
      'Decor',
      'Ground',
      'Collision',
    ])
    expect(rows.map((row) => row.querySelector('.kind')?.textContent)).toEqual([
      'Things',
      'Tiles',
      'Auto tiles',
      'Grid values',
    ])
    expect(rows[0]).toHaveAttribute('aria-selected', 'true')
    expect(canvas()).toHaveAttribute('data-layer', 'entities')
  })

  it('choosing a layer draws on it and shows its palette', async () => {
    await mount()
    await userEvent.click(within(layers()).getByText('Collision'))
    expect(canvas()).toHaveAttribute('data-layer', 'collision')
    const palette = screen.getByRole('radiogroup', { name: /Paint with/ })
    const choices = within(palette)
      .getAllByRole('radio')
      .map((choice) => choice.textContent?.trim())
    expect(choices).toEqual(['Solid', 'One-way', 'Spike', 'Water', 'Ladder'])
    expect(screen.getByRole('radio', { name: 'Solid' })).toHaveAttribute('aria-checked', 'true')
  })

  it('arrow keys move the chosen layer', async () => {
    await mount()
    layers().focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(canvas()).toHaveAttribute('data-layer', 'ground')
  })

  it('a hidden or locked layer says why the brush does nothing, and how to go on', async () => {
    await mount()
    await userEvent.click(within(layers()).getByText('Collision'))
    await userEvent.click(screen.getByRole('button', { name: 'Hide Collision' }))
    expect(screen.getByRole('button', { name: 'Show Collision' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Collision is hidden. Show it to draw.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show Collision' }))
    await userEvent.click(screen.getByRole('button', { name: 'Lock Collision' }))
    expect(screen.getByText('Collision is locked. Unlock it to draw.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Unlock Collision' }))
    expect(screen.queryByText(/is locked/)).toBeNull()
  })
})

describe('Level view: palette', () => {
  it('chooses what the brush paints', async () => {
    await mount()
    await userEvent.click(within(layers()).getByText('Collision'))
    await userEvent.click(screen.getByRole('radio', { name: 'Spike' }))
    expect(screen.getByRole('radio', { name: 'Spike' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Solid' })).toHaveAttribute('aria-checked', 'false')
  })

  it('lists the definitions on an entities layer', async () => {
    await mount()
    await userEvent.click(screen.getByRole('radio', { name: 'Coin' }))
    expect(screen.getByRole('radio', { name: 'Coin' })).toHaveAttribute('aria-checked', 'true')
  })

  it('shows numbered tiles for a tileset with no image yet', async () => {
    await mount()
    await userEvent.click(within(layers()).getByText('Decor'))
    expect(screen.getByRole('radio', { name: 'Tile 51' })).toHaveTextContent('51')
  })
})

describe('Level view: toolbar and canvas', () => {
  it('names the tools in plain words and hands the chosen one to the canvas', async () => {
    await mount()
    const tool = screen.getByRole('radiogroup', { name: 'Tool' })
    expect(
      within(tool)
        .getAllByRole('radio')
        .map((option) => option.textContent?.trim()),
    ).toEqual(['Select', 'Brush', 'Rectangle', 'Fill', 'Eraser', 'Pick'])
    await userEvent.click(within(tool).getByRole('radio', { name: 'Fill' }))
    expect(canvas()).toHaveAttribute('data-tool', 'fill')
    expect(screen.queryAllByLabelText(/Brush size/)).toEqual([])
    await userEvent.click(within(tool).getByRole('radio', { name: 'Eraser' }))
    expect(screen.getAllByLabelText(/Brush size/).length).toBeGreaterThan(0)
  })

  it('fits the level in the canvas once it is measured', async () => {
    measuredAt(560, 336)
    await mount()
    expect(canvas()).toHaveAttribute('data-camera', '24,24,1')
  })

  it('opens the layers from the toolbar below wide', async () => {
    await mount([834, 1194])
    const button = screen.getByRole('button', { name: 'Layers' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('has no Layers button in wide, where the panel is always in view', async () => {
    await mount()
    expect(screen.queryByRole('button', { name: 'Layers' })).toBeNull()
  })
})
