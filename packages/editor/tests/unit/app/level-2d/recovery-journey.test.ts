// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DocumentScreen from '#src/app/level-2d/DocumentScreen.svelte'
import { createAppProfiles } from '#src/app/level-2d/profiles.ts'
import { createDocumentController } from '#src/features/document/document-controller.ts'
import type { History } from '#src/shared/kit/history/history.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import { createEditorApp } from '#src/shared/level-2d/documents/editor-app.ts'
import { packTile } from '#src/shared/level-2d/model/cells-codec.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import FakeLevelCanvas from '#src/testing/level-2d/FakeLevelCanvas.svelte'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { withLayer } from '#src/testing/level-2d/project-edit.ts'

// G-l end to end: three edits, the tab killed before a save, the
// editor opened again over the same device storage: Restore is offered first and brings back exactly the state the
// edits had made.

const quietPage = () => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

type Workspace = ReturnType<typeof memoryWorkspace>

/** One tab of the editor over `workspace`: a level's screen open on `path`, or made from the first template. */
async function boot(workspace: Workspace, clock: ReturnType<typeof createTestClock>, path?: string) {
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await (path === undefined ? app.create('level-project', 'platformer') : app.open(path))
  if (opened.status !== 'opened') throw new Error(opened.status)
  const toasts = createToasts({ clock })
  const controller = createDocumentController({ app, opened, toasts, lifecycle: quietPage() })
  const view = render(DocumentScreen, {
    geometry: stubGeometry(1194, 834),
    controller,
    toasts,
    clock,
    read: (file: string) => workspace.store.read(file),
    files: workspace.store,
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
    onback: () => {},
  })
  return { ...view, document: opened.document }
}

describe('recovery (G-l)', () => {
  it('kills the tab after three edits; reopening offers Restore, and the restored state equals the state before', async () => {
    const clock = createTestClock()
    const workspace = memoryWorkspace(clock)
    const first = await boot(workspace, clock)
    await screen.findByRole('button', { name: 'Back' })
    const { document } = first
    const history = document.history as History<Project>

    // Three edits, each its own undo step, with the autosave's quiet time between them.
    history.apply('Rename', (project) => ({ ...project, name: 'Moss steps' }))
    clock.advance(1000)
    history.apply('Paint', (project) =>
      withLayer(project, 'level-1', 'decor', (layer) =>
        layer.kind === 'tiles'
          ? { ...layer, cells: layer.cells.set(2, 3, packTile(5, false, false)) }
          : layer,
      ),
    )
    clock.advance(1000)
    history.apply('Paint', (project) =>
      withLayer(project, 'level-1', 'decor', (layer) =>
        layer.kind === 'tiles' ? { ...layer, cells: layer.cells.set(3, 3, packTile(6, true, false)) } : layer,
      ),
    )
    clock.advance(1000)
    const before = printProject(history.state)
    await vi.waitFor(async () => {
      const journal = await workspace.journal.list()
      expect(journal.map((entry) => entry.path)).toEqual([`${document.path}.autosave`])
    })
    // Nothing was saved: the file on the device is still the template's.
    expect(new TextDecoder().decode(await workspace.store.read(document.path))).not.toBe(before)

    // The tab is killed: the page goes away without a save.
    first.unmount()

    const second = await boot(workspace, clock, document.path)
    const offer = await screen.findByRole('dialog', { name: 'Keep your changes from last time?' })
    await userEvent.click(within(offer).getByRole('button', { name: 'Keep my changes' }))
    const reopened = second.document
    await vi.waitFor(() => expect(printProject(reopened.history.state as Project)).toBe(before))
    expect(screen.getByRole('button', { name: 'Undo Keep changes from last time' })).toBeEnabled()
  })
})
