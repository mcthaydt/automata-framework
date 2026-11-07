// Starting the suite: read the game's editor list through the workspace port,
// list the files of each editor it names, and mount the suite with the kit's geometry owner. `main.ts` is the only
// caller with the page's globals; tests hand in the window and memory ports.

import { createGeometryOwner, type ViewportWindow } from '@mcthaydt/automata'
import { mount, unmount } from 'svelte'
import type { GestureClock } from '../../../shared/kit/gestures/gesture-clock.ts'
import type { SuitePorts, WorkspaceFile } from '../../../shared/kit/ports/suite-ports.ts'
import { EDITOR_LIST_PATH, loadEditorList } from '../core'
import type { Suite } from './create-suite'
import { homeOf } from './home-model'
import SuiteView from './Suite.svelte'

export interface SuiteEnv {
  /** What the geometry owner reads and listens to. */
  readonly window: ViewportWindow
  /** Its root element carries the published geometry. */
  readonly document: Document
  readonly ports: SuitePorts
  readonly suite: Suite
  /** Marks the top bar when the workspace is the built-in sample rather than a game's checkout. */
  readonly sample?: boolean
  /** The game's name in words, from the server's ping: the top bar's title. */
  readonly game?: string | undefined
  /** What the toasts time out on; the page's clock unless a test holds one. */
  readonly clock?: GestureClock | undefined
}

export interface SuiteHandle {
  /** Takes the suite off the page and lets go of the window. */
  dispose(): Promise<void>
}

export async function startSuite(target: HTMLElement, env: SuiteEnv): Promise<SuiteHandle> {
  const load = loadEditorList((await env.ports.workspace.read(EDITOR_LIST_PATH))?.text)
  const files = new Map<string, readonly WorkspaceFile[]>()
  if (load.ok)
    for (const editor of new Set(load.list.file.map((row) => row.editor)))
      files.set(editor, await env.ports.workspace.files(editor))
  const owner = createGeometryOwner({ window: env.window, root: env.document.documentElement })
  const root = mount(SuiteView, {
    target,
    props: {
      geometry: owner.geometry,
      home: homeOf(load, files, env.suite),
      suite: env.suite,
      ports: env.ports,
      sample: env.sample ?? false,
      game: env.game,
      clock: env.clock,
    },
  })
  return {
    async dispose() {
      await unmount(root)
      owner.dispose()
    },
  }
}
