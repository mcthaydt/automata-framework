// Memory ports over a game's files, classed by the files' own `content/editors.toml` the way the disk adapter classes a checkout; with no loadable list every file is read only. The DOM and layout tests use it, and
// `main.ts` serves a sample game's list through it until `automata editor` serves a real checkout.

import type { SuitePorts } from '../../../shared/kit/ports/suite-ports.ts'
import { createMemoryStore } from '../../../shared/kit/storage/memory-store.ts'
import type { ProjectStore } from '../../../shared/kit/storage/project-store.ts'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '../core'
import { createMemoryPorts } from './memory-ports.ts'
import sampleList from './platformer.editors.toml?raw'

/**
 * `store` is where the files are kept (memory by default; the site's try-it passes this browser's storage, so a level
 * made there is there after a reload). A file already in it is the visitor's and stays, except the editor list, which is
 * always `files`' own: the list is AF's, not the visitor's.
 */
export async function samplePorts(
  files: Readonly<Record<string, string>>,
  store: ProjectStore = createMemoryStore(),
): Promise<SuitePorts> {
  const load = loadEditorList(files[EDITOR_LIST_PATH])
  for (const [path, text] of Object.entries(files))
    if (path === EDITOR_LIST_PATH || (await store.read(path)) === undefined) await store.write(path, text)
  const { ports } = await createMemoryPorts({
    store,
    classify: (path) =>
      load.ok
        ? workspaceFile(load.list, path)
        : { path, writable: false, why: 'The editor list has a problem.' },
  })
  return ports
}

/** A sample game's list with a tuning file, for the sample app and the tests. */
export const SAMPLE_GAME: Readonly<Record<string, string>> = {
  [EDITOR_LIST_PATH]: sampleList,
  'content/tuning.toml': '[player]\nspeed = 6.5 # m/s\n',
}
