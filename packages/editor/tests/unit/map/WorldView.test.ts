// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createAppProfiles } from '#src/app/editor-2d/profiles.ts'
import DocumentScreen from '#src/features/document/DocumentScreen.svelte'
import { createDocumentController } from '#src/features/document/document-controller.ts'
import type { History } from '#src/shared/kit/history/history.ts'
import type { LifecycleDocument, LifecycleWindow } from '#src/shared/kit/storage/page-lifecycle.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import { createEditorApp } from '#src/shared/level-2d/documents/editor-app.ts'
import { packTile } from '#src/shared/level-2d/model/cells-codec.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Placement, Project } from '#src/shared/level-2d/model/project-types.ts'
import { renameLevel } from '#src/shared/level-2d/model/world/level-edits.ts'
import { fitWorld, worldRects } from '#src/shared/level-2d/model/world/world-model.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import FakeLevelCanvas from '#src/testing/level-2d/FakeLevelCanvas.svelte'
import FakeWorldCanvas from '#src/testing/level-2d/FakeWorldCanvas.svelte'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { entity, withEntities, withLayer, withNewLevel } from '#src/testing/level-2d/project-edit.ts'

// The World view in jsdom, mounted the way the app mounts it and reached from the rail.
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
  await rail('Map')
  await screen.findByTestId('world-view')
  return { history, first: history.state.levels[0]?.id ?? '' }
}

async function rail(name: string): Promise<void> {
  await userEvent.click(
    within(screen.getByRole('radiogroup', { name: 'Views' })).getByRole('radio', { name }),
  )
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
    // The camera fits once and then holds still, so every point is aimed with the first fit.
    const start = history.state
    const scale = fitWorld(worldRects(start, 'main', undefined), BOX, MARGIN).scale
    const at = onMap(start, 1010, 10)
    pointer('pointerdown', at.x, at.y)
    pointer('pointermove', at.x + 40, at.y + 20)
    pointer('pointerup', at.x + 40, at.y + 20)
    expect(placement(history.state, 'level-2')).toMatchObject({
      x: Math.round(1000 + 40 / scale),
      y: Math.round(20 / scale),
    })
    expect(await screen.findByRole('button', { name: 'Undo Move level' })).toBeEnabled()
    const before = history.revision
    const first = onMap(start, 10, 10)
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
    await userEvent.click(screen.getByRole('radio', { name: 'Row' }))
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

describe('World view: links and new levels (plan ED2D.6c)', () => {
  /** A door in the first level that leads to a spawn in Second. */
  const linked = (project: Project): Project => {
    const first = project.levels[0]?.id ?? ''
    const spawned = withEntities(project, 'level-2', [entity('spawn-2', 'player-start', 32, 32)])
    return withEntities(spawned, first, [
      entity('door-1', 'door', 64, 64, { target: { target: 'spawn-2', container: 'level-2' } }),
    ])
  }

  it('hands the map its links, and lists them in the inspector both ways', async () => {
    const { first } = await mount(linked)
    expect(screen.getByTestId('fake-world-canvas')).toHaveAttribute('data-links', `${first}>level-2`)
    await userEvent.click(levelList().getAllByRole('button')[0] as HTMLElement)
    const links = within(inspector().getByRole('list', { name: 'Links' }))
    expect(links.getByRole('listitem')).toHaveTextContent('Door → Second · Player start')
    await userEvent.click(levelList().getByRole('button', { name: 'Second' }))
    expect(inspector().getByText(/^Linked from:/)).toHaveTextContent('Linked from: Level 1')
    expect(inspector().getByText('No links from this level.')).toBeInTheDocument()
  })

  it('adds a level next to the others, selected, as one undo step', async () => {
    const { history } = await mount()
    const steps = history.revision
    await userEvent.click(screen.getByRole('button', { name: 'Add level' }))
    expect(history.revision).toBe(steps + 1)
    expect(levelList().getByRole('button', { name: 'Level 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('fake-world-canvas').getAttribute('data-levels')).toContain('level-3@')
    history.undo()
    expect(await screen.findByTestId('world-view')).toBeInTheDocument()
    expect(levelList().queryByRole('button', { name: 'Level 3' })).toBeNull()
  })
})

describe('World view: the camera (plan ED2D.8a)', () => {
  it('pans with the wheel, zooms with Ctrl+wheel about the pointer, and Fit puts every level back in view', async () => {
    const { history } = await mount()
    const fitted = fitWorld(worldRects(history.state, 'main', undefined), BOX, MARGIN)
    const camera = () => screen.getByTestId('fake-world-canvas').getAttribute('data-camera')
    expect(camera()).toBe(`${fitted.x},${fitted.y},${fitted.scale}`)
    const map = screen.getByTestId('world-map')
    map.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 0, deltaY: 30 }))
    await vi.waitFor(() => expect(camera()).toBe(`${fitted.x},${fitted.y - 30},${fitted.scale}`))
    map.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: -100,
        ctrlKey: true,
        clientX: 400,
        clientY: 300,
      }),
    )
    await vi.waitFor(() => expect(Number(camera()?.split(',')[2])).toBeGreaterThan(fitted.scale))
    await userEvent.click(screen.getByRole('button', { name: 'Fit' }))
    expect(camera()).toBe(`${fitted.x},${fitted.y},${fitted.scale}`)
  })
})

describe('World view: duplicate and remove (plan ED2D.8a decision 3)', () => {
  it('duplicates the selected level as "<name> copy", selected, as one undo step', async () => {
    const { history } = await mount()
    await userEvent.click(levelList().getByRole('button', { name: 'Second' }))
    const steps = history.revision
    await userEvent.click(inspector().getByRole('button', { name: 'Duplicate' }))
    expect(history.revision).toBe(steps + 1)
    expect(levelList().getByRole('button', { name: 'Second copy' })).toHaveAttribute('aria-pressed', 'true')
    history.undo()
    await vi.waitFor(() => expect(levelList().queryByRole('button', { name: 'Second copy' })).toBeNull())
  })

  it('asks before removing, says which links break, removes in one step, and keeps the last level', async () => {
    const { history, first } = await mount((project) => {
      const spawned = withEntities(project, 'level-2', [entity('spawn-2', 'player-start', 32, 32)])
      return withEntities(spawned, project.levels[0]?.id ?? '', [
        entity('door-1', 'door', 64, 64, { target: { target: 'spawn-2', container: 'level-2' } }),
      ])
    })
    await userEvent.click(levelList().getByRole('button', { name: 'Second' }))
    const steps = history.revision
    await userEvent.click(inspector().getByRole('button', { name: 'Remove' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Remove Second?' }))
    expect(dialog.getByText('1 link leads here. It will show in Checks as broken.')).toBeInTheDocument()
    await userEvent.click(dialog.getByRole('button', { name: 'Remove' }))
    expect(history.revision).toBe(steps + 1)
    expect(history.state.levels.map((level) => level.id)).toEqual([first])
    expect(screen.getByText('Choose a level on the map or in the list.')).toBeInTheDocument()
    await userEvent.click(levelList().getAllByRole('button')[0] as HTMLElement)
    expect(inspector().getByRole('button', { name: 'Remove' })).toBeDisabled()
  })
})
