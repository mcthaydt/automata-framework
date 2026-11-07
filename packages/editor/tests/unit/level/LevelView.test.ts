// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppProfiles } from '#src/app/editor-2d/profiles.ts'
import DocumentScreen from '#src/features/document/DocumentScreen.svelte'
import { createDocumentController } from '#src/features/document/document-controller.ts'
import type { LifecycleDocument, LifecycleWindow } from '#src/shared/kit/storage/page-lifecycle.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import { createEditorApp } from '#src/shared/level-2d/documents/editor-app.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import FakeLevelCanvas from '#src/testing/level-2d/FakeLevelCanvas.svelte'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'

// The Level view in jsdom: the layer panel, the palette, the toolbar and what reaches the
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
      'Characters',
      'Decor',
      'Ground',
      'Collision',
    ])
    expect(rows.map((row) => row.querySelector('.kind')?.textContent)).toEqual([
      'Characters and items',
      'Tiles',
      'Tiles that place themselves',
      'Walls and floors',
    ])
    // Each row has its colour and two icon toggles named for what a press does.
    expect(rows.every((row) => row.querySelector('.swatch') !== null)).toBe(true)
    expect(within(rows[0] as HTMLElement).getByRole('button', { name: 'Hide Characters' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(
      within(rows[0] as HTMLElement).getByRole('button', { name: 'Lock Characters' }),
    ).toBeInTheDocument()
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
  it('shows the tools as icons named in plain words and hands the chosen one to the canvas', async () => {
    await mount()
    const tool = screen.getByRole('radiogroup', { name: 'Tool' })
    const options = within(tool).getAllByRole('radio')
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'Select',
      'Brush',
      'Rectangle',
      'Fill',
      'Eraser',
      'Copy a tile',
    ])
    // Each is an icon: its name is its tooltip too.
    expect(options.map((option) => option.getAttribute('title'))).toContain('Copy a tile')
    await userEvent.click(within(tool).getByRole('radio', { name: 'Fill' }))
    expect(canvas()).toHaveAttribute('data-tool', 'fill')
    expect(screen.queryByRole('button', { name: /^Brush size/ })).toBeNull()
    await userEvent.click(within(tool).getByRole('radio', { name: 'Eraser' }))
    // The size is behind its own 44 px button showing the number, so it never widens the pill.
    expect(screen.queryByRole('spinbutton', { name: 'Brush size' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Brush size 1' })).toHaveTextContent(/^1$/)
    await userEvent.click(screen.getByRole('button', { name: 'Brush size 1' }))
    expect(screen.getByRole('spinbutton', { name: 'Brush size' })).toBeInTheDocument()
  })

  it('fits the level in the canvas once it is measured', async () => {
    measuredAt(560, 336)
    await mount()
    expect(canvas()).toHaveAttribute('data-camera', '24,24,1')
  })

  it('opens the layers from the tool dock in the compact layout', async () => {
    await mount([390, 844])
    const button = screen.getByRole('button', { name: 'Layers' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('has no Layers button in wide or medium, where the panel is always in view', async () => {
    await mount()
    expect(screen.queryByRole('button', { name: 'Layers' })).toBeNull()
    cleanup()
    await mount([834, 1194])
    expect(screen.queryByRole('button', { name: 'Layers' })).toBeNull()
  })

  it('floats the tools over the canvas, beside it rather than in it, and Fit and Details in its corner', async () => {
    measuredAt(560, 336)
    await mount([834, 1194])
    const tools = screen.getByRole('toolbar', { name: 'Tools' })
    const surface = screen.getByTestId('level-surface')
    // The pill floats over the level in the canvas's region, not in a row of its own above it; it is the canvas's
    // sibling, so a press on a tool never reaches the canvas's gestures.
    expect(surface.parentElement?.contains(tools)).toBe(true)
    expect(surface.contains(tools)).toBe(false)
    expect(tools).toHaveAttribute('data-floating', 'true')
    const fit = screen.getByRole('button', { name: 'Fit the level in view' })
    expect(surface.contains(fit)).toBe(false)
    await userEvent.click(fit)
    expect(canvas()).toHaveAttribute('data-camera', '24,24,1')
    const details = screen.getByRole('button', { name: 'Details' })
    expect(details).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(details)
    expect(details).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('Level view: the level picker in the top bar', () => {
  const picker = (): HTMLElement =>
    within(screen.getByTestId('document-bar')).getByRole('button', { name: /^Level: / })

  it('names the open level and has no strip of level cards', async () => {
    await mount()
    expect(picker()).toHaveAccessibleName('Level: Level 1')
    expect(picker()).toHaveTextContent('Level 1')
    expect(screen.queryByTestId('level-dock')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Levels' })).toBeNull()
  })

  it('adds a level as one undo step and opens it', async () => {
    await mount()
    const before = canvas().dataset.level
    await userEvent.click(picker())
    await userEvent.click(screen.getByRole('menuitem', { name: 'New level' }))
    expect(picker()).toHaveAccessibleName('Level: Level 2')
    expect(canvas().dataset.level).not.toBe(before)
    // Back to the first from the picker: the menu lists every level of the world.
    await userEvent.click(picker())
    const items = screen.getAllByRole('menuitem').map((item) => item.querySelector('.label')?.textContent)
    expect(items).toEqual(['Level 1', 'Level 2', 'New level'])
    await userEvent.click(screen.getByRole('menuitem', { name: /^Level 1/ }))
    expect(canvas()).toHaveAttribute('data-level', before as string)
    await userEvent.click(screen.getByTestId('undo'))
    expect(picker()).toHaveAccessibleName('Level: Level 1')
    await userEvent.click(picker())
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
  })
})

/** A mouse press or release as the browser sends it; jsdom has no `PointerEvent` constructor. */
function press(target: HTMLElement, type: 'pointerdown' | 'pointerup', x: number, y: number): void {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 })
  Object.assign(event, { pointerId: 1, pointerType: 'mouse', pressure: type === 'pointerdown' ? 0.5 : 0 })
  target.dispatchEvent(event)
}

/** Places a Slime with the brush; jsdom lays nothing out, so a canvas point is a level pixel. */
async function placeSlime(x = 40, y = 40): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole('radio', { name: 'Slime' }))
  const surface = screen.getByTestId('level-surface')
  press(surface, 'pointerdown', x, y)
  press(surface, 'pointerup', x, y)
  return surface
}

/** The inspector's heading: the chosen thing's name, or the level's with nothing chosen (there are no tabs). */
const inspectorHeading = (): HTMLElement =>
  within(screen.getByTestId('level-inspector')).getByRole('heading', { level: 2 })

const stepper = (name: string): string | null =>
  screen.getByRole('spinbutton', { name }).getAttribute('aria-valuenow')

describe('Level view: the inspector opens on selection', () => {
  const inspectorRegion = (): HTMLElement =>
    document.querySelector('[data-region="inspector"]') as HTMLElement

  it('on a phone, placing a thing opens the inspector sheet on it', async () => {
    measuredAt(390, 600)
    await mount([390, 844])
    await userEvent.click(screen.getByRole('button', { name: 'Layers' }))
    expect(inspectorRegion()).toHaveAttribute('data-open', 'false')
    await placeSlime()
    expect(inspectorRegion()).toHaveAttribute('data-open', 'true')
    expect(inspectorHeading()).toHaveTextContent('Slime')
  })
})

describe('Level view: inspector journey (flow 3, G-e)', () => {
  it('places a thing, edits its fields, refuses a bad value and undoes', async () => {
    await mount()
    await placeSlime()
    expect(inspectorHeading()).toHaveTextContent('Slime')
    expect(stepper('Hit points')).toBe('3')

    await userEvent.click(screen.getByRole('button', { name: 'Increase Hit points' }))
    expect(stepper('Hit points')).toBe('4')
    expect(screen.getByRole('button', { name: 'Undo Set Hit points' })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Tint: #7c3aed' }))
    const swatches = within(screen.getByRole('listbox', { name: 'Tint palette' })).getAllByRole('option')
    const other = swatches.find((swatch) => swatch.getAttribute('aria-label') !== '#7c3aed')
    if (other === undefined) throw new Error('no other colour on offer')
    const picked = other.getAttribute('aria-label')
    await userEvent.click(other)
    expect(screen.getByRole('button', { name: `Tint: ${picked}` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo Set Tint' })).toBeEnabled()

    await userEvent.click(screen.getByRole('spinbutton', { name: 'Hit points' }))
    await userEvent.keyboard('{Control>}a{/Control}12{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent(/9/)
    expect(screen.getByRole('button', { name: 'Undo Set Tint' })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Undo Set Tint' }))
    expect(screen.getByRole('button', { name: 'Tint: #7c3aed' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Undo Set Hit points' }))
    expect(stepper('Hit points')).toBe('3')
  })
})

describe('Level view: shortcuts (§12)', () => {
  it('B, R, G, E and I choose the tools; [ and ] change the brush size', async () => {
    await mount()
    for (const [key, tool] of [
      ['r', 'rectangle'],
      ['g', 'fill'],
      ['e', 'eraser'],
      ['i', 'picker'],
      ['b', 'brush'],
    ] as const) {
      await userEvent.keyboard(key)
      expect(canvas()).toHaveAttribute('data-tool', tool)
    }
    // The size button says the size; the stepper behind it is the same number.
    const size = (): number => Number(screen.getByRole('button', { name: /^Brush size/ }).textContent?.trim())
    const before = size()
    await userEvent.keyboard(']')
    expect(size()).toBe(before + 1)
    await userEvent.keyboard('[[')
    expect(size()).toBe(before)
  })

  it('arrows nudge from the canvas, Mod+D duplicates and Delete deletes, each one undo step', async () => {
    await mount()
    const surface = await placeSlime()
    const x = Number(stepper('X'))
    surface.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(Number(stepper('X'))).toBe(x + 16)
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(Number(stepper('X'))).toBe(x + 16 - 8 * 16)
    expect(screen.getByRole('button', { name: 'Undo Move entity' })).toBeEnabled()

    await userEvent.keyboard('{Control>}d{/Control}')
    expect(screen.getByRole('button', { name: 'Undo Duplicate' })).toBeEnabled()
    await userEvent.keyboard('{Delete}')
    expect(screen.getByRole('button', { name: 'Undo Delete' })).toBeEnabled()
    // Nothing is selected any more, so the inspector shows the level.
    expect(inspectorHeading()).toHaveTextContent('Level 1')
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(screen.getByRole('button', { name: 'Undo Duplicate' })).toBeEnabled()
  })

  it('ignores tool letters while typing in a text field', async () => {
    await mount()
    expect(inspectorHeading()).toHaveTextContent('Level 1')
    await userEvent.click(screen.getByRole('textbox', { name: 'Music' }))
    await userEvent.keyboard('r')
    expect(canvas()).toHaveAttribute('data-tool', 'brush')
  })
})

// The accessibility pass.
describe('Level view: accessibility', () => {
  const NAMED =
    'button, [role="radio"], [role="tab"], [role="option"], [role="slider"], input, select, textarea'

  it('names every control, the canvas included', async () => {
    await mount()
    const unnamed = [...document.querySelectorAll<HTMLElement>(NAMED)]
      .filter((control) => !control.hidden && control.closest('[aria-hidden="true"]') === null)
      .filter((control) => {
        const labelled =
          control.getAttribute('aria-label') ??
          control.getAttribute('aria-labelledby') ??
          (control as HTMLInputElement).labels?.[0]?.textContent ??
          control.textContent
        return (labelled ?? '').trim() === ''
      })
      .map((control) => control.outerHTML.slice(0, 80))
    expect(unnamed).toEqual([])
    expect(screen.getByTestId('level-surface')).toHaveAccessibleName('Level canvas')
  })

  it('reaches the bar (with its view switcher), the canvas and the inspector in that order with the keyboard', async () => {
    await mount()
    const regions = [screen.getByTestId('document-bar'), canvas(), screen.getByTestId('level-inspector')]
    expect(within(screen.getByTestId('document-bar')).getByRole('radiogroup', { name: 'Views' })).toBeTruthy()
    for (const [before, after] of regions.slice(1).map((region, at) => [regions[at], region] as const))
      expect(
        (before as HTMLElement).compareDocumentPosition(after as HTMLElement) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        `${(after as HTMLElement).getAttribute('aria-label') ?? (after as HTMLElement).dataset.testid} follows`,
      ).toBeTruthy()
  })
})
