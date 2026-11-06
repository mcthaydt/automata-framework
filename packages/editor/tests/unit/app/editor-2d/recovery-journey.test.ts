// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '#src/app/editor-2d/App.svelte'
import { createAppProfiles } from '#src/app/editor-2d/profiles.ts'
import type { History } from '#src/shared/kit/history/history.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import {
  createEditorApp,
  type EditorApp,
  type OpenDocument,
} from '#src/shared/level-2d/documents/editor-app.ts'
import { packTile } from '#src/shared/level-2d/model/cells-codec.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import FakeLevelCanvas from '#src/testing/level-2d/FakeLevelCanvas.svelte'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { withLayer } from '#src/testing/level-2d/project-edit.ts'
import { createTestClock } from '#src/testing/level-2d/test-clock.ts'

// G-l end to end (plan ED2D.7b step 6; 2D editor spec §8 flow 10, §15): three edits, the tab killed before a save, the
// editor opened again over the same device storage: Restore is offered first and brings back exactly the state the
// edits had made.

const quietPage = () => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

type Workspace = ReturnType<typeof memoryWorkspace>

/** One tab of the editor over `workspace`; `documents` collects every document it opens. */
function boot(workspace: Workspace, clock: ReturnType<typeof createTestClock>) {
  const real = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const documents: OpenDocument[] = []
  const keep = async (outcome: ReturnType<EditorApp['open']>) => {
    const result = await outcome
    if (result.status === 'opened') documents.push(result.document)
    return result
  }
  const app: EditorApp = {
    ...real,
    create: (...args) => keep(real.create(...args)),
    open: (...args) => keep(real.open(...args)),
  }
  const view = render(App, {
    geometry: stubGeometry(1194, 834),
    app,
    workspace,
    registry: real.registry,
    toasts: createToasts({ clock }),
    clock,
    lifecycle: quietPage(),
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
  })
  return { ...view, documents }
}

describe('recovery (G-l)', () => {
  it('kills the tab after three edits; reopening offers Restore, and the restored state equals the state before', async () => {
    const clock = createTestClock()
    const workspace = memoryWorkspace(clock)
    const first = boot(workspace, clock)
    const templates = await screen.findByRole('region', { name: 'Start a new project' })
    await userEvent.click(within(templates).getAllByRole('button')[0] as HTMLElement)
    await screen.findByRole('button', { name: 'Back' })
    const [document] = first.documents
    if (document === undefined) throw new Error('no document opened')
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

    const second = boot(workspace, clock)
    await userEvent.dblClick(
      await screen.findByRole('option', { name: new RegExp(document.path.replace('.', '\\.')) }),
    )
    const offer = await screen.findByRole('dialog', { name: 'Restore your unsaved work?' })
    await userEvent.click(within(offer).getByRole('button', { name: 'Restore edits' }))
    const [reopened] = second.documents
    if (reopened === undefined) throw new Error('no document reopened')
    await vi.waitFor(() => expect(printProject(reopened.history.state as Project)).toBe(before))
    expect(screen.getByRole('button', { name: 'Undo Restore autosave' })).toBeEnabled()
  })
})
