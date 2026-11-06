// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createAppProfiles } from '#src/app/editor-2d/profiles.ts'
import DocumentScreen from '#src/features/document/DocumentScreen.svelte'
import { createDocumentController } from '#src/features/document/document-controller.ts'
import type { History } from '#src/shared/kit/history/history.ts'
import type { LifecycleDocument, LifecycleWindow } from '#src/shared/kit/storage/page-lifecycle.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import { createEditorApp } from '#src/shared/level-2d/documents/editor-app.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import FakeLevelCanvas from '#src/testing/level-2d/FakeLevelCanvas.svelte'
import FakeWorldCanvas from '#src/testing/level-2d/FakeWorldCanvas.svelte'
import { linkedMaps } from '#src/testing/level-2d/linked-maps.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { createTestClock } from '#src/testing/level-2d/test-clock.ts'

// Linked levels in jsdom: the app's screen with stand-in
// canvases, driven through the rail, the World view, the Level view's palette and inspector, and the Checks view.
// jsdom lays nothing out, so a point on the level surface is a level pixel; the RPG's entities snap to its 16 px grid.

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

async function mount(seed?: () => Project) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create('level-project', 'topdown-rpg')
  if (opened.status !== 'opened') throw new Error(opened.status)
  const history = opened.document.history as History<Project>
  if (seed !== undefined) history.apply('Seed', () => seed())
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
  return { app, document: opened.document, history }
}

async function rail(name: string): Promise<void> {
  await userEvent.click(within(screen.getByRole('tablist', { name: 'Views' })).getByRole('tab', { name }))
}

/** A mouse press or release as the browser sends it; jsdom has no `PointerEvent` constructor. */
function press(type: 'pointerdown' | 'pointerup', x: number, y: number): void {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 })
  Object.assign(event, { pointerId: 1, pointerType: 'mouse', pressure: type === 'pointerdown' ? 0.5 : 0 })
  screen.getByTestId('level-surface').dispatchEvent(event)
}

function tap(x: number, y: number): void {
  press('pointerdown', x, y)
  press('pointerup', x, y)
}

async function openLevel(name: RegExp): Promise<void> {
  await userEvent.click(
    within(screen.getByRole('navigation', { name: 'Levels' })).getByRole('button', { name }),
  )
}

async function chooseEntities(): Promise<void> {
  const layers = within(screen.getByRole('listbox', { name: 'Layers' }))
  await userEvent.click(layers.getByRole('option', { name: /^Entities/ }))
}

/** Places a thing of `def` with the brush, which leaves it selected in the inspector. */
async function place(def: string, x: number, y: number): Promise<void> {
  await userEvent.click(screen.getByRole('radio', { name: 'Brush' }))
  await userEvent.click(screen.getByRole('radio', { name: def }))
  tap(x, y)
}

async function select(x: number, y: number): Promise<void> {
  await userEvent.click(screen.getByRole('radio', { name: 'Select' }))
  tap(x, y)
}

/** Points the selected thing's Target at `choice` in `level`, through the picker. */
async function pointAt(level: RegExp, choice: string): Promise<void> {
  const entity = within(await screen.findByTestId('entity-tab'))
  await userEvent.click(entity.getByRole('button', { name: 'Choose target' }))
  const dialog = within(await screen.findByRole('dialog', { name: /^Choose a target/ }))
  await userEvent.click(dialog.getByRole('button', { name: level }))
  await userEvent.click(dialog.getByRole('button', { name: choice }))
}

/** G-r asks for zero errors; the template's unused definitions stay as info. */
async function noErrors(): Promise<void> {
  const view = await screen.findByTestId('checks-view')
  expect(within(view).queryByText(/^Errors/)).toBeNull()
  expect(within(view).queryByText(/^Warnings/)).toBeNull()
}

const mapLinks = (): string | null => screen.getByTestId('fake-world-canvas').getAttribute('data-links')

describe('G-g: a link to something deleted', () => {
  it('drops off the world map and the canvas, and the Checks offer Choose target, which repairs it in one step', async () => {
    const { history } = await mount(linkedMaps)
    await rail('World')
    expect(mapLinks()).toBe('map-1>inn inn>map-1')

    await rail('Level')
    await openLevel(/Inn/)
    await chooseEntities()
    await select(32, 200)
    await userEvent.click(within(screen.getByTestId('entity-tab')).getByRole('button', { name: 'Delete' }))

    await rail('World')
    expect(mapLinks()).toBe('')
    await userEvent.click(
      within(screen.getByRole('list', { name: 'Levels' })).getByRole('button', { name: 'Village' }),
    )
    expect(screen.getByText('No links from this level.')).toBeInTheDocument()

    await rail('Checks')
    const steps = history.revision
    await userEvent.click(await screen.findByRole('button', { name: 'Choose target' }))
    const dialog = within(screen.getByRole('dialog', { name: /^Choose a target/ }))
    const player = dialog.getAllByRole('button').find((each) => each.textContent?.includes('player-start'))
    if (player === undefined) throw new Error('no player start on offer')
    await userEvent.click(player)
    expect(history.revision).toBe(steps + 1)
    await noErrors()
    // The door now leads to the player start in its own level: a link the map does not draw.
    await rail('World')
    expect(mapLinks()).toBe('')
  })
})

describe('G-r, the linking half: two RPG maps built in the editor', () => {
  it('adds the inn, links a door each way and a warp, has no errors, and re-opens equal', async () => {
    const { app, document, history } = await mount()
    await rail('World')
    await userEvent.click(screen.getByRole('button', { name: 'Add level' }))
    const name = screen.getByRole('textbox', { name: 'Name' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Inn{Enter}')

    await rail('Level')
    await chooseEntities()
    await place('Door', 96, 64)
    await openLevel(/Inn/)
    await chooseEntities()
    await place('Door', 32, 192)
    await pointAt(/^Map 1/, 'Door at 96, 64')
    expect(within(screen.getByTestId('entity-tab')).getByText('Map 1 · Door')).toBeInTheDocument()

    await openLevel(/Map 1/)
    await chooseEntities()
    await select(96, 64)
    await pointAt(/^Inn/, 'Door at 32, 192')
    await place('Warp', 192, 160)
    await pointAt(/^Inn/, 'Door at 32, 192')
    expect(within(screen.getByTestId('entity-tab')).getByText('Inn · Door')).toBeInTheDocument()

    await rail('Checks')
    await noErrors()
    await rail('World')
    expect(mapLinks()).toBe('map-1>level-1 map-1>level-1 level-1>map-1')

    const saved = history.state
    expect((await document.save()).status).toBe('saved')
    const again = await app.open(document.path)
    if (again.status !== 'opened') throw new Error(again.status)
    // Level order means nothing in the working file (the codec prints levels by id), so equal is printed byte-equal.
    expect(printProject(again.document.history.state as Project)).toBe(printProject(saved))
  })
})
