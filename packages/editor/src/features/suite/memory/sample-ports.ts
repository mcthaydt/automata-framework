// Memory ports over a game's files, classed by the files' own `content/editors.toml` the way the disk adapter classes a checkout; with no loadable list every file is read only. The DOM and layout tests use it, and
// `main.ts` serves a sample game's list through it until `automata editor` serves a real checkout.

import type { SuitePorts } from '../../../shared/kit/ports/suite-ports.ts'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '../core'
import { createMemoryPorts } from './memory-ports.ts'
import sampleList from './platformer.editors.toml?raw'

/** `changeSet: false` is a sample with no change sets, which is the try-it page's: a visitor is never asked to name a change. */
export async function samplePorts(
  files: Readonly<Record<string, string>>,
  options: { readonly changeSet?: false } = {},
): Promise<SuitePorts> {
  const load = loadEditorList(files[EDITOR_LIST_PATH])
  const { ports } = await createMemoryPorts({
    files,
    changeSet: options.changeSet,
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
