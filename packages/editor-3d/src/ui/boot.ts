// The 3D editor's boot (plan ED3D.5c step 9): everything it touches comes in through `env`, so a test hands it a window,
// a document, a clock and a workspace and gets the real app, and `main.ts` is the only file that reaches for the
// globals.

import { createGeometryOwner, type ViewportWindow } from '@mcthaydt/automata'
import {
  createToasts,
  type DownloadEnv,
  type LifecycleWindow,
  openWorkspace,
  type StorageClock,
  type Workspace,
  type WorkspaceEnv,
} from '@mcthaydt/automata-editor-kit/core'
import { mount, unmount } from 'svelte'
import { createEditorApp } from '../app/editor-app'
import App from './App.svelte'
import type { PlanRendererFactory } from './plan/plan-renderer'
import type { Frames } from './walk/frames'

export interface EditorEnv {
  /** What the geometry owner reads and listens to, and whose `pagehide` writes an open level's journal. */
  readonly window: ViewportWindow & LifecycleWindow
  /** Its root element carries the published geometry; its `visibilitychange` writes an open level's journal. */
  readonly document: Document
  /** Time for the autosave debounce, the toasts and the ages on the cards. */
  readonly clock: StorageClock
  /** The browser's `navigator.storage`; `{}` for one without OPFS. */
  readonly storage?: WorkspaceEnv['storage']
  readonly download?: DownloadEnv
  /** A workspace that is already open, in place of opening the browser's: tests hand one in. */
  readonly workspace?: Workspace
  /** Makes the Plan view's renderer: `main.ts` loads Pixi lazily (`lazyPlanRenderer`); tests pass a fake. */
  readonly renderer: PlanRendererFactory
  /** The page's animation frames, which the Walk view's eye moves on: `main.ts` passes them; tests walk by hand. */
  readonly frames?: Frames
}

export interface EditorHandle {
  readonly workspace: Workspace
  /** Takes the editor off the page, waits for an open level's journal and lets go of the window. Safe to call twice. */
  dispose(): Promise<void>
}

/** Opens the workspace, builds the app and mounts it into `target`. Rejects only when mounting itself fails. */
export async function startEditor(target: HTMLElement, env: EditorEnv): Promise<EditorHandle> {
  const workspace =
    env.workspace ??
    (await openWorkspace({
      ...(env.storage === undefined ? {} : { storage: env.storage }),
      ...(env.download === undefined ? {} : { download: env.download }),
    }))
  const app = createEditorApp({ workspace, clock: env.clock })
  const toasts = createToasts({ clock: env.clock })
  const owner = createGeometryOwner({ window: env.window, root: env.document.documentElement })
  const root = mount(App, {
    target,
    props: {
      geometry: owner.geometry,
      app,
      workspace,
      toasts,
      clock: env.clock,
      lifecycle: { document: env.document, window: env.window },
      renderer: env.renderer,
      frames: env.frames,
      // The checks run after the editing pauses, on the page's clock.
      schedule: (delayMs: number, run: () => void) => {
        const handle = env.clock.setTimer(delayMs, run)
        return () => env.clock.clearTimer(handle)
      },
    },
  })
  return {
    workspace,
    async dispose() {
      await unmount(root)
      // Unmounting closes an open level, which writes its journal first; the editor is gone once that is done.
      await root.idle()
      owner.dispose()
    },
  }
}
