// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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
import FakeWorldCanvas from '#src/testing/level-2d/FakeWorldCanvas.svelte'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'

// Spec 11.4: Map, Tiles and Characters share the Level view's frame. The stage fills its region; the list and the
// selected item are sheets on a phone; in the medium layout the list sits beside the stage and the details float over
// it. The buttons that open them float over the stage in one pill at its top, or sit in a dock across its foot in the
// compact layout, as the Level view's tools do. Layout and hit sizes are checked in
// real browsers (`tests/browser/layout/{map,tiles,characters}`).

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

async function mount(view: string, [width, height]: [number, number]): Promise<void> {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create('level-project', 'platformer')
  if (opened.status !== 'opened') throw new Error(opened.status)
  const toasts = createToasts({ clock })
  const controller = createDocumentController({ app, opened, toasts, lifecycle: quietPage() })
  render(DocumentScreen, {
    geometry: stubGeometry(width, height),
    controller,
    toasts,
    clock,
    read: (path: string) => workspace.store.read(path),
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
    worldCanvas: FakeWorldCanvas,
    onback: () => {},
  })
  // On a phone the view switcher is a menu; from an iPad up it is a row of radios.
  const views = screen.queryByRole('radiogroup', { name: 'Views' })
  if (views !== null) await userEvent.click(within(views).getByRole('radio', { name: view }))
  else {
    const bar = screen.getByTestId('document-bar')
    const menuButton = bar.querySelector<HTMLElement>('.switch button[aria-haspopup]')
    if (menuButton === null) throw new Error('no view switcher')
    await userEvent.click(menuButton)
    await userEvent.click(screen.getByRole('menuitem', { name: view }))
  }
}

const VIEWS = [
  { view: 'Map', list: 'All levels', testId: 'world-view' },
  { view: 'Tiles', list: 'All tiles', testId: 'tilesets-view' },
  { view: 'Characters', list: 'All characters', testId: 'entities-view' },
] as const

describe.each(VIEWS)('$view view: the Level view’s frame', ({ view, list, testId }) => {
  const controls = (): HTMLElement => screen.getByRole('toolbar', { name: `${view} controls` })

  it('floats Details in one pill at the stage’s top on an iPad, where the list is always beside the stage', async () => {
    await mount(view, [834, 1194])
    expect(screen.getByTestId(testId)).toBeInTheDocument()
    expect(controls()).toHaveAttribute('data-floating', 'true')
    expect(controls()).toHaveAttribute('data-at', 'top')
    expect(within(controls()).queryByRole('button', { name: list })).toBeNull()
    const details = within(controls()).getByRole('button', { name: 'Details' })
    await userEvent.click(details)
    expect(details).toHaveAttribute('aria-expanded', 'true')
    // The old drawer words are gone.
    expect(screen.queryByRole('button', { name: 'Rules' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Definitions' })).toBeNull()
  })

  it('docks the controls across the stage’s foot on a phone, under the thumb, with the list', async () => {
    await mount(view, [390, 844])
    expect(controls()).toHaveAttribute('data-at', 'dock')
    const opener = within(controls()).getByRole('button', { name: list })
    expect(opener).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(opener)
    expect(opener).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('the frame on a wide screen', () => {
  it('leaves Tiles and Characters without a pill: their list and details are always in view', async () => {
    await mount('Tiles', [1440, 900])
    expect(screen.queryByRole('toolbar', { name: 'Tiles controls' })).toBeNull()
  })

  it('keeps Fit in the Map’s pill', async () => {
    await mount('Map', [1440, 900])
    const controls = screen.getByRole('toolbar', { name: 'Map controls' })
    expect(within(controls).getByRole('button', { name: 'Fit the map in view' })).toBeInTheDocument()
    expect(within(controls).queryByRole('button', { name: 'Details' })).toBeNull()
  })
})
