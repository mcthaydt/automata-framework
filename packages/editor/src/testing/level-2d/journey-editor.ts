import { createGeometryOwner } from '@automata/framework'
import { settleLayout } from '@automata/framework/testing'
import { mount, unmount } from 'svelte'
import { page } from 'vitest/browser'
import { createEditorApp } from '../../app/editor-2d/editor-app'
import { componentOf } from '../../app/editor-2d/views'
import DocumentScreen from '../../features/document/DocumentScreen.svelte'
import { createDocumentController } from '../../features/document/document-controller'
import { createDownloadStore, type DownloadFile } from '../../shared/kit/storage/download-store.ts'
import { createMemoryStore } from '../../shared/kit/storage/memory-store.ts'
import type { LifecycleDocument, LifecycleWindow } from '../../shared/kit/storage/page-lifecycle.ts'
import type { Workspace } from '../../shared/kit/storage/workspace.ts'
import { createToasts } from '../../shared/kit/widgets/toasts.ts'
import { counterIds } from '../../shared/level-2d/model/ids'
import type { Project } from '../../shared/level-2d/model/project-types'
import { createAppProfiles } from '../../shared/level-2d/profiles/app-profiles'
import type { EditorApp, OpenDocument } from '../../shared/level-2d/session/editor-app-types'
import type { IpadProfile } from '../kit/ipad-profiles.ts'
import { arrived } from '../kit/layout-sizes.ts'
import { createTestClock, type TestClock } from '../kit/test-clock'

// The editor on an iPad for the journeys (the kit's harness: `IPAD_PROFILES`, `createPointers`, `turned`):
// the app's own screen with the real Pixi canvases and the real geometry owner over a memory workspace that keeps what
// Export downloads, started from a template at the iPad's window size. A journey drives it with real pointer events and
// reads the open document's history, the workspace and the page.

export interface JourneyEditor {
  readonly app: EditorApp
  readonly document: OpenDocument
  readonly workspace: Workspace
  readonly downloads: readonly DownloadFile[]
  /** The editor's time, storage's and the gestures': it moves only when the journey moves it. */
  readonly clock: TestClock
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
      viewOf: componentOf,
      toasts,
      clock,
      // The gestures run on the same test clock: a tap lasts no time at all, however slow the machine.
      gestureClock: clock,
      read: (path: string) => workspace.store.read(path),
      workspace,
      ids: counterIds(100),
      onback: () => {},
    },
  })
  await settleLayout()
  const editor: JourneyEditor = {
    app,
    clock,
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
  while (host.dataset.state !== 'drawn') {
    if (Date.now() - waited > 15_000) throw new Error(`the canvas never drew (${host.dataset.state})`)
    await arrived()
  }
  return editor
}

/**
 * The surface-relative point at the centre of a cell of the current level, from where the session fits it: centred,
 * with 24 px of padding (`level-session`). Valid until the camera moves, so a journey takes its points first.
 */
export function cellAt(
  editor: JourneyEditor,
  cx: number,
  cy: number,
  level: number | string = 0,
): { x: number; y: number } {
  const levels = editor.project().levels
  const size = (typeof level === 'number' ? levels[level] : levels.find((each) => each.id === level))?.size
  if (size === undefined) throw new Error('no such level')
  const surface = editor.surface().getBoundingClientRect()
  const scale = Math.min((surface.width - 48) / size.w, (surface.height - 48) / size.h)
  return {
    x: (surface.width - size.w * scale) / 2 + (cx * 16 + 8) * scale,
    y: (surface.height - size.h * scale) / 2 + (cy * 16 + 8) * scale,
  }
}

/** The control with `role` whose label or text starts with `name`. */
export function named(role: string, name: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>(`[role="${role}"]`)].find((each) =>
    (each.getAttribute('aria-label') ?? each.textContent ?? '').trim().startsWith(name),
  )
  if (found === undefined) throw new Error(`no ${role} named ${name}`)
  return found
}

/** Presses a control by its role and name, then waits for the layout to settle. */
export async function press(role: string, name: string): Promise<void> {
  named(role, name).click()
  await arrived()
}

/** A button of the document by its words. */
export async function pressButton(words: string): Promise<void> {
  const found = [...document.querySelectorAll<HTMLElement>('button')].find(
    (button) => button.textContent?.trim() === words || button.getAttribute('aria-label') === words,
  )
  if (found === undefined) throw new Error(`no button ${words}`)
  found.click()
  await arrived()
}

/** Chooses a layer in the panel, opening the Layers drawer first below wide. */
export async function chooseLayer(name: string): Promise<void> {
  const rows = (): HTMLElement[] => [
    ...document.querySelectorAll<HTMLElement>('[role="listbox"][aria-label="Layers"] [role="option"]'),
  ]
  const visible = (): boolean => rows().some((row) => row.getBoundingClientRect().width > 0)
  if (!visible()) await pressButton('Layers')
  const row = rows().find((option) => option.querySelector('.label')?.textContent === name)
  if (row === undefined) throw new Error(`no layer ${name}`)
  row.querySelector<HTMLElement>('button')?.click()
  await arrived()
}
