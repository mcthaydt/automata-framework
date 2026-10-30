// Memory ports over a game's files, classed by the files' own `content/editors.toml` the way the disk adapter of
// EDS.1d classes a checkout; with no loadable list every file is read only. The DOM and layout tests use it, and
// `main.ts` serves FloorFifty's list through it until `automata editor` serves a real checkout (EDS.1d).
import type { SuitePorts } from '@mcthaydt/automata-editor-kit/ports'
import { createMemoryPorts } from '@mcthaydt/automata-editor-kit/ports/testing'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '../core'
import floorfiftyList from './fixtures/floorfifty.editors.toml?raw'

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

/** FloorFifty's list (677d456) with a tuning file and a stage, for the sample app and the tests. */
export const FLOORFIFTY_SAMPLE: Readonly<Record<string, string>> = {
  [EDITOR_LIST_PATH]: floorfiftyList,
  'content/tuning.toml': '[player]\nspeed = 6.5 # m/s\n',
  'content/stages/floor-01.toml': 'id = "floor-01"\n',
}
