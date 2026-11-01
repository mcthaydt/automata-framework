import type { ProjectStore } from '@mcthaydt/automata-editor-kit/core'
import type { SuitePorts } from '@mcthaydt/automata-editor-kit/ports'
import { createMemoryPorts } from '@mcthaydt/automata-editor-kit/ports/testing'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '../core'

// The suite over a game checkout that `automata editor` serves (EDS.1d's browser half): the files, and the checkout's own
// `content/editors.toml`, are read through the served store; a listed file is written back to it with the server's check
// that it did not change on disk. The workspace is the kit's store-backed one, which holds the editor list's rules in one
// place. There is no change set, gate record, check or assistant here yet, so edits save to the checkout and Ship stays
// hidden; a checkout with no list, or a list with a problem, opens read only.

export async function servedPorts(store: ProjectStore): Promise<SuitePorts> {
  const bytes = await store.read(EDITOR_LIST_PATH)
  const load = loadEditorList(bytes === undefined ? undefined : new TextDecoder().decode(bytes))
  const { ports } = await createMemoryPorts({
    store,
    changeSet: false,
    classify: (path) =>
      load.ok
        ? workspaceFile(load.list, path)
        : { path, writable: false, why: 'The editor list is missing or has a problem.' },
  })
  return ports
}
