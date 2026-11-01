// Memory ports over a game's files, classed by the files' own `content/editors.toml` the way the disk adapter of
// EDS.1d classes a checkout; with no loadable list every file is read only. The DOM and layout tests use it, and
// `main.ts` shows the sample game through it when the page is not served by `automata editor`.
import type { SuitePorts } from '@mcthaydt/automata-editor-kit/ports'
import { createMemoryPorts } from '@mcthaydt/automata-editor-kit/ports/testing'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '../core'
import sampleList from './fixtures/sample-game.editors.toml?raw'

export async function samplePorts(files: Readonly<Record<string, string>>): Promise<SuitePorts> {
  const load = loadEditorList(files[EDITOR_LIST_PATH])
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) =>
      load.ok
        ? workspaceFile(load.list, path)
        : { path, writable: false, why: 'The editor list has a problem.' },
  })
  return ports
}

/** The sample game's editor list with a tuning file, for the sample app and the tests. */
export const SAMPLE_GAME: Readonly<Record<string, string>> = {
  [EDITOR_LIST_PATH]: sampleList,
  'content/tuning.toml': '[player]\nspeed = 6.5 # m/s\n',
}
