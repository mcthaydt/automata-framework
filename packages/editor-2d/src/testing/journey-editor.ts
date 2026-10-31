import {
  createDownloadStore,
  createMemoryStore,
  createToasts,
  type DownloadFile,
  type LifecycleDocument,
  type LifecycleWindow,
  type Workspace,
} from '@mcthaydt/automata-editor-kit/core'
import { arrived, type IpadProfile } from '@mcthaydt/automata-editor-kit/testing'
import { createGeometryOwner } from '@mcthaydt/automata-ui'
import { settleLayout } from '@mcthaydt/automata-ui/testing'
import { mount, unmount } from 'svelte'
import { page } from 'vitest/browser'
import DocumentScreen from '../app/document/DocumentScreen.svelte'
import { createDocumentController } from '../app/document/document-controller'
import { createEditorApp, type EditorApp, type OpenDocument } from '../app/editor-app'
import { createAppProfiles } from '../app/profiles'
import { counterIds } from '../model/ids'
import type { Project } from '../model/project-types'
import { createTestClock } from './test-clock'

// The editor on an iPad for the ED2D.8 journeys (the kit's EDK.6b harness: `IPAD_PROFILES`, `createPointers`, `turned`):
// the app's own screen with the real Pixi canvases and the real geometry owner over a memory workspace that keeps what
// Export downloads, started from a template at the iPad's window size. A journey drives it with real pointer events and
// reads the open document's history, the workspace and the page.

export interface JourneyEditor {
  readonly app: EditorApp
  readonly document: OpenDocument
  readonly workspace: Workspace
  readonly downloads: readonly DownloadFile[]
  /** The level canvas's surface (the element the pointers drive). */
  surface(): HTMLElement
  /** The project in the document right now. */
  project(): Project
  /** Sets the window to `size` and waits for the layout to settle (a turn of the iPad). */
  resize(size: { readonly width: number; readonly height: number }): Promise<void>
  close(): Promise<void>
}

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

export async function openJourneyEditor(
  profile: IpadProfile,
  template: 'platformer' | 'topdown-rpg',
): Promise<JourneyEditor> {
  await page.viewport(profile.width, profile.height)
  const clock = createTestClock()
  const downloads: DownloadFile[] = []
  const workspace: Workspace = {
    store: createMemoryStore({ now: clock.now }),
    journal: createMemoryStore({ now: clock.now }),
    exports: createDownloadStore({ now: clock.now, download: (file) => downloads.push(file) }),
    persistent: true,
    reason: undefined,
  }
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create('level-project', template)
  if (opened.status !== 'opened') throw new Error(`the ${template} template did not open: ${opened.status}`)
  const toasts = createToasts({ clock })
  const controller = createDocumentController({ app, opened, toasts, lifecycle: quietPage() })
  const owner = createGeometryOwner({ window, root: document.documentElement })
  const box = document.body.appendChild(document.createElement('div'))
  box.style.cssText = 'position: fixed; inset: 0'
  const root = mount(DocumentScreen, {
    target: box,
    props: {
      geometry: owner.geometry,
      controller,
      toasts,
      clock,
      read: (path: string) => workspace.store.read(path),
      workspace,
      ids: counterIds(100),
      onback: () => {},
    },
  })
  await settleLayout()
  const editor: JourneyEditor = {
    app,
    document: opened.document,
    workspace,
    downloads,
    surface() {
      const found = document.querySelector<HTMLElement>('[data-testid="level-surface"]')
      if (found === null) throw new Error('no level canvas')
      return found
    },
    project: () => opened.document.history.state as Project,
    async resize(size) {
      await page.viewport(size.width, size.height)
      await settleLayout()
      await arrived()
    },
    async close() {
      await unmount(root)
      owner.dispose()
      box.remove()
    },
  }
  const host = document.querySelector<HTMLElement>('[data-level-canvas]')
  if (host === null) throw new Error('no level canvas host')
  const waited = Date.now()
  while (host.dataset['state'] !== 'drawn') {
    if (Date.now() - waited > 15_000) throw new Error(`the canvas never drew (${host.dataset['state']})`)
    await arrived()
  }
  return editor
}

/**
 * The surface-relative point at the centre of a cell of the current level, from where the session fits it: centred,
 * with 24 px of padding (`level-session`). Valid until the camera moves, so a journey takes its points first.
 */
export function cellAt(editor: JourneyEditor, cx: number, cy: number, level = 0): { x: number; y: number } {
  const size = editor.project().levels[level]?.size
  if (size === undefined) throw new Error('no such level')
  const surface = editor.surface().getBoundingClientRect()
  const scale = Math.min((surface.width - 48) / size.w, (surface.height - 48) / size.h)
  return {
    x: (surface.width - size.w * scale) / 2 + (cx * 16 + 8) * scale,
    y: (surface.height - size.h * scale) / 2 + (cy * 16 + 8) * scale,
  }
}
