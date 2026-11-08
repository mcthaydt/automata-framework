import { createGeometryOwner } from '@automata/framework'
import { mount, unmount } from 'svelte'
import DocumentScreen from '../../app/level-2d/DocumentScreen.svelte'
import { createAppProfiles } from '../../app/level-2d/profiles'
import { createDocumentController } from '../../features/document/document-controller'
import type { StorageClock } from '../../shared/kit/storage/clock.ts'
import type { Workspace } from '../../shared/kit/storage/workspace.ts'
import { createToasts } from '../../shared/kit/widgets/toasts.ts'
import { createEditorApp } from '../../shared/level-2d/documents/editor-app'
import { randomIds } from '../../shared/level-2d/model/ids'

// A level's own screen, open on the real page: the document bar, the views and their dialogs, over a workspace that
// already holds the project. The layout and canvas tests use it where they only need an open level; the suite's Levels
// pane is the same screen in its shell (15.3: the standalone app's Home and route are gone).

export interface OpenLevelScreen {
  dispose(): Promise<void>
}

/** The browser's clock, as the editor's storage and toasts read it. */
export const pageClock = (): StorageClock => ({
  now: () => Date.now(),
  setTimer: (ms, run) => window.setTimeout(run, ms),
  clearTimer: (handle) => window.clearTimeout(handle as number),
})

export async function openLevelScreen(
  target: HTMLElement,
  workspace: Workspace,
  path: string,
  clock: StorageClock = pageClock(),
): Promise<OpenLevelScreen> {
  const ids = randomIds((bytes) => {
    crypto.getRandomValues(bytes)
  })
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids, clock })
  const opened = await app.open(path)
  if (opened.status !== 'opened') throw new Error(`${path} did not open: ${opened.status}`)
  const toasts = createToasts({ clock })
  const lifecycle = { document, window }
  const controller = createDocumentController({ app, opened, toasts, lifecycle })
  const owner = createGeometryOwner({ window, root: document.documentElement })
  const root = mount(DocumentScreen, {
    target,
    props: {
      geometry: owner.geometry,
      controller,
      toasts,
      clock,
      read: (file: string) => workspace.store.read(file),
      files: workspace.store,
      ids,
      workspace,
      onback: () => {},
    },
  })
  return {
    async dispose() {
      await unmount(root)
      await controller.close()
      owner.dispose()
    },
  }
}
