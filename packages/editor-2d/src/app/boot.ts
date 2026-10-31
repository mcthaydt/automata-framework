import {
  createToasts,
  type DownloadEnv,
  type LifecycleWindow,
  openWorkspace,
  type StorageClock,
  type Workspace,
  type WorkspaceEnv,
} from '@mcthaydt/automata-editor-kit/core'
import { createGeometryOwner, type ViewportWindow } from '@mcthaydt/automata-ui'
import { type Component, mount, unmount } from 'svelte'
import type { LevelThumbnails } from '../canvas/level-thumbnails'
import { randomIds } from '../model/ids'
import App from './App.svelte'
import { createEditorApp } from './editor-app'
import type { LastOpened } from './home/home-controller'
import { createAppProfiles } from './profiles'
import type { LevelCanvasProps, ObjectUrls } from './views/view-props'

// The editor's boot (plan ED2D.4c2a, decision 9): everything it touches comes in through `env`, so a test hands it a
// window, a document, a clock and a workspace and gets the real app, and `main.ts` is the only file that reaches for
// the globals.

export interface EditorEnv {
  /** What the geometry owner reads and listens to, and whose `pagehide` writes an open document's journal. */
  readonly window: ViewportWindow & LifecycleWindow
  /** Its root element carries the published geometry; its `visibilitychange` writes an open document's journal. */
  readonly document: Document
  /** Time for the autosave debounce, the toasts and the ages on the cards. */
  readonly clock: StorageClock
  /** Random bytes for instance ids (`crypto.getRandomValues`). */
  readonly fillRandom: (bytes: Uint8Array<ArrayBuffer>) => void
  /** The browser's `navigator.storage`; `{}` for one without OPFS. */
  readonly storage?: WorkspaceEnv['storage']
  readonly download?: DownloadEnv
  /** A workspace that is already open, in place of opening the browser's: tests hand one in. */
  readonly workspace?: Workspace
  /**
   * Makes Home's card thumbnails over the open workspace (ED2D.4c3b). `main.ts` passes the Pixi one; without it every
   * card shows its initial, so the jsdom tests never load a renderer.
   */
  readonly thumbnails?: (workspace: Workspace) => LevelThumbnails
  /** Object URLs for the palette's tile pictures (`URL.createObjectURL`); `main.ts` passes the browser's. */
  readonly objectUrls?: ObjectUrls
  /** Where the project opened last is kept (`main.ts` passes the browser's storage); absent, Home selects the newest. */
  readonly lastOpened?: LastOpened
  /** The level canvas in place of the Pixi one: the jsdom tests pass a stand-in, since jsdom has no WebGL. */
  readonly canvas?: Component<LevelCanvasProps>
}

export interface EditorHandle {
  readonly workspace: Workspace
  /** Takes the editor off the page, waits for an open document's journal and lets go of the window. Safe to call twice. */
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
  const registry = createAppProfiles()
  const ids = randomIds(env.fillRandom)
  const app = createEditorApp({ workspace, registry, ids, clock: env.clock })
  const toasts = createToasts({ clock: env.clock })
  const owner = createGeometryOwner({ window: env.window, root: env.document.documentElement })
  const thumbnails = env.thumbnails?.(workspace)
  const root = mount(App, {
    target,
    props: {
      geometry: owner.geometry,
      app,
      workspace,
      registry,
      toasts,
      clock: env.clock,
      lifecycle: { document: env.document, window: env.window },
      thumbnails,
      ids,
      objectUrls: env.objectUrls,
      canvas: env.canvas,
      lastOpened: env.lastOpened,
    },
  })
  return {
    workspace,
    async dispose() {
      // Svelte's unmount, the geometry owner's dispose and the thumbnails' dispose do nothing the second time, so no guard is needed.
      await unmount(root)
      // Unmounting closes an open document, which writes its journal first; the editor is gone once that is done.
      await root.idle()
      owner.dispose()
      thumbnails?.dispose()
    },
  }
}
