import {
  createToasts,
  type History,
  type LifecycleDocument,
  type LifecycleWindow,
} from '@mcthaydt/automata-editor-kit/core'
import { stubGeometry } from '@mcthaydt/automata-editor-kit/testing'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { packTile } from '../../model/cells-codec'
import { counterIds } from '../../model/ids'
import type { Placement, Project } from '../../model/project-types'
import { renameLevel } from '../../model/world/level-edits'
import FakeLevelCanvas from '../../testing/FakeLevelCanvas.svelte'
import FakeWorldCanvas from '../../testing/FakeWorldCanvas.svelte'
import { memoryWorkspace } from '../../testing/memory-workspace'
import { withLayer, withNewLevel } from '../../testing/project-edit'
import { createTestClock } from '../../testing/test-clock'
import DocumentScreen from '../document/DocumentScreen.svelte'
import { createDocumentController } from '../document/document-controller'
import { createEditorApp } from '../editor-app'
import { createAppProfiles } from '../profiles'
import { fitWorld, worldRects } from './world-model'

// The World view in jsdom (plan ED2D.6b steps 5 and 6), mounted the way the app mounts it and reached from the rail.
// jsdom lays nothing out, so the map's box is the view's default (800 × 600) and a client point is a point on the map.

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})
const BOX = { w: 800, h: 600 }
const MARGIN = 24

async function mount(seed: (project: Project) => Project = (project) => project) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create('level-project', 'platformer')
  if (opened.status !== 'opened') throw new Error(opened.status)
  const history = opened.document.history as History<Project>
  history.apply('Seed', (project) =>
    seed(renameLevel(withNewLevel(project, 'level-2', { x: 1000, y: 0 }), 'level-2', 'Second')),
  )
  const toasts = createToasts({ clock })
  const controller = createDocumentController({ app, opened, toasts, lifecycle: quietPage() })
  render(DocumentScreen, {
    geometry: stubGeometry(1194, 834),
    controller,
    toasts,
    clock,
    read: (path: string) => workspace.store.read(path),
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
    worldCanvas: FakeWorldCanvas,
    onback: () => {},
  })
  await rail('World')
  await screen.findByTestId('world-view')
  return { history, first: history.state.levels[0]?.id ?? '' }
}

async function rail(name: string): Promise<void> {
  await userEvent.click(within(screen.getByRole('tablist', { name: 'Views' })).getByRole('tab', { name }))
}

/** A mouse press, move or release as the browser sends it; jsdom has no `PointerEvent` constructor. */
function pointer(type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number): void {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, buttons: 1 })
  Object.assign(event, { pointerId: 1, pointerType: 'mouse', isPrimary: true })
  screen.getByTestId('world-map').dispatchEvent(event)
}

/** Where a world point is on the map, by the camera the view fits. */
function onMap(project: Project, x: number, y: number): { x: number; y: number } {
  const camera = fitWorld(worldRects(project, 'main', undefined), BOX, MARGIN)
  return { x: camera.x + x * camera.scale, y: camera.y + y * camera.scale }
}

const placement = (project: Project, level: string): Placement | undefined =>
  project.worlds[0]?.placements.find((candidate) => candidate.level === level)
const levelList = () => within(screen.getByRole('list', { name: 'Levels' }))
const inspector = () => within(screen.getByRole('complementary', { name: 'Inspector' }))

describe('World view: the map and the panel', () => {
  it('lists the levels; choosing one selects it on the map and in the inspector', async () => {
    await mount()
    expect(
      levelList()
        .getAllByRole('button')
        .map((button) => button.textContent?.trim()),
    ).toEqual([expect.any(String), 'Second'])
    await userEvent.click(levelList().getByRole('button', { name: 'Second' }))
    expect(levelList().getByRole('button', { name: 'Second' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('fake-world-canvas')).toHaveAttribute('data-selected', 'level-2')
    expect(inspector().getByRole('textbox', { name: 'Name' })).toHaveValue('Second')
  })

  it('switches the layout to Grid, snapping every level, as one undo step', async () => {
    const { history } = await mount((project) => withNewLevel(project, 'level-3', { x: 37, y: 900 }))
    await userEvent.click(screen.getByRole('radio', { name: 'Grid' }))
    expect(history.state.worlds[0]?.layout).toBe('grid')
    const grid = history.state.worlds[0]?.grid?.w ?? 0
    expect(grid).toBeGreaterThan(0)
    expect((placement(history.state, 'level-3')?.x ?? 0) % grid).toBe(0)
    expect(screen.getByRole('button', { name: 'Undo Switch layout' })).toBeEnabled()
  })

  it('drags a level on the map by the travel over the scale, as one undo step; a tap only selects', async () => {
    const { history } = await mount()
    const scale = fitWorld(worldRects(history.state, 'main', undefined), BOX, MARGIN).scale
    const at = onMap(history.state, 1010, 10)
    pointer('pointerdown', at.x, at.y)
    pointer('pointermove', at.x + 40, at.y + 20)
    pointer('pointerup', at.x + 40, at.y + 20)
    expect(placement(history.state, 'level-2')).toMatchObject({
      x: Math.round(1000 + 40 / scale),
      y: Math.round(20 / scale),
    })
    expect(await screen.findByRole('button', { name: 'Undo Move level' })).toBeEnabled()
    const before = history.revision
    const first = onMap(history.state, 10, 10)
    pointer('pointerdown', first.x, first.y)
    pointer('pointerup', first.x, first.y)
    expect(history.revision).toBe(before)
    await vi.waitFor(() =>
      expect(screen.getByTestId('fake-world-canvas')).toHaveAttribute(
        'data-selected',
        history.state.levels[0]?.id,
      ),
    )
  })

  it("reorders a horizontal world when a level is dragged past its neighbour, and the Level view's dock follows (G-h)", async () => {
    const { history, first } = await mount()
    await userEvent.click(screen.getByRole('radio', { name: 'Horizontal' }))
    const width = history.state.levels[0]?.size.w ?? 0
    const scale = fitWorld(worldRects(history.state, 'main', undefined), BOX, MARGIN).scale
    const at = onMap(history.state, 10, 10)
    pointer('pointerdown', at.x, at.y)
    pointer('pointermove', at.x + width * 1.2 * scale, at.y)
    pointer('pointerup', at.x + width * 1.2 * scale, at.y)
    expect(history.state.worlds[0]?.placements.map((p) => p.level)).toEqual(['level-2', first])
    await rail('Level')
    const dock = within(await screen.findByRole('navigation', { name: 'Levels' }))
    expect(dock.getAllByRole('button')[0]).toHaveTextContent('Second')
  })
})

describe('World view: the inspector', () => {
  async function chooseSecond() {
    await userEvent.click(levelList().getByRole('button', { name: 'Second' }))
  }

  /** The kit's stepper is a spinbutton until tapped, then a text box under the same name. */
  async function setStepper(label: string, value: number): Promise<void> {
    await userEvent.click(inspector().getByRole('spinbutton', { name: label }))
    const input = inspector().getByRole('textbox', { name: label })
    await userEvent.clear(input)
    await userEvent.type(input, `${value}{Enter}`)
  }

  it('renames the level, and refuses an empty name keeping the old one', async () => {
    const { history } = await mount()
    await chooseSecond()
    const name = inspector().getByRole('textbox', { name: 'Name' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Moss steps{Enter}')
    expect(history.state.levels[1]?.name).toBe('Moss steps')
    expect(screen.getByRole('button', { name: 'Undo Rename level' })).toBeEnabled()
    await userEvent.clear(name)
    await userEvent.type(name, '{Enter}')
    expect(history.state.levels[1]?.name).toBe('Moss steps')
    expect(inspector().getByRole('alert')).toHaveTextContent('A level needs a name.')
    expect(name).toHaveValue('Moss steps')
  })

  it('moves the level with X and Y, and sets its depth', async () => {
    const { history } = await mount()
    await chooseSecond()
    await setStepper('X', 1200)
    await setStepper('Y', 64)
    expect(placement(history.state, 'level-2')).toMatchObject({ x: 1200, y: 64 })
    await setStepper('Depth', 2)
    expect(placement(history.state, 'level-2')?.depth).toBe(2)
  })

  it('resizes larger at once, and asks before a resize that drops painted cells (spec §13)', async () => {
    const paint = (project: Project): Project =>
      withLayer(project, 'level-2', 'decor', (layer) =>
        layer.kind === 'tiles'
          ? { ...layer, cells: layer.cells.set(30, 16, packTile(5, false, false)) }
          : layer,
      )
    const { history } = await mount(paint)
    await chooseSecond()
    const size = history.state.levels[1]?.size ?? { w: 0, h: 0 }
    await setStepper('Width', size.w + 64)
    await userEvent.click(inspector().getByRole('button', { name: 'Resize' }))
    expect(history.state.levels[1]?.size.w).toBe(size.w + 64)
    expect(screen.queryByRole('dialog')).toBeNull()

    await setStepper('Width', 64)
    await userEvent.click(inspector().getByRole('button', { name: 'Resize' }))
    const dialog = await screen.findByRole('dialog', { name: 'Resize Second?' })
    expect(within(dialog).getByText(/decor: 1 cell/i)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(history.state.levels[1]?.size.w).toBe(size.w + 64)
    await userEvent.click(inspector().getByRole('button', { name: 'Resize' }))
    const again = await screen.findByRole('dialog', { name: 'Resize Second?' })
    await userEvent.click(within(again).getByRole('button', { name: 'Resize anyway' }))
    expect(history.state.levels[1]?.size.w).toBe(64)
    expect(screen.getByRole('button', { name: 'Undo Resize level' })).toBeEnabled()
  })
})
