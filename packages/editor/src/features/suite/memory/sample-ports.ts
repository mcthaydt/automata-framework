// Memory ports over a game's files, classed by the files' own `content/editors.toml` the way the disk adapter classes a checkout; with no loadable list every file is read only. The DOM and layout tests use it, and
// `main.ts` serves a sample game's list through it until `automata editor` serves a real checkout.

import { listGrowsBy } from '../../../shared/editor-list/editor-rows.ts'
import type { SuitePorts } from '../../../shared/kit/ports/suite-ports.ts'
import { createMemoryStore } from '../../../shared/kit/storage/memory-store.ts'
import type { ProjectStore } from '../../../shared/kit/storage/project-store.ts'
import { EDITOR_LIST_PATH } from '../core'
import { createLiveList } from './live-list.ts'
import { createMemoryPorts } from './memory-ports.ts'
import sampleList from './platformer.editors.toml?raw'

/**
 * `store` is where the files are kept (memory by default; the site's try-it passes this browser's storage, so a level
 * made there is there after a reload). A file already in it is the visitor's and stays, except the editor list, which is
 * always `files`' own: the list is AF's, not the visitor's. The one thing kept of the visitor's is rows an editor added
 * to it (`listGrowsBy`), so the file that editor started is still listed after a reload.
 */
export async function samplePorts(
  files: Readonly<Record<string, string>>,
  options: { readonly store?: ProjectStore } = {},
): Promise<SuitePorts> {
  const { store = createMemoryStore() } = options
  const own = files[EDITOR_LIST_PATH]
  const kept = await store.read(EDITOR_LIST_PATH)
  const grown = own !== undefined && kept !== undefined && listGrowsBy(own, new TextDecoder().decode(kept))
  for (const [path, text] of Object.entries(files))
    if (path === EDITOR_LIST_PATH ? !grown : (await store.read(path)) === undefined)
      await store.write(path, text)
  const list = createLiveList(grown && kept !== undefined ? new TextDecoder().decode(kept) : own)
  const { ports } = await createMemoryPorts({
    store,
    classify: list.classify,
    listChanged: list.replace,
  })
  return ports
}

/** A sample game's list with a tuning file, for the sample app and the tests. */
export const SAMPLE_GAME: Readonly<Record<string, string>> = {
  [EDITOR_LIST_PATH]: sampleList,
  'content/tuning.toml': '[player]\nspeed = 6.5 # m/s\n',
}
