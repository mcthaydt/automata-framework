// The editor list as a page holds it: read when the page opens, and read again when an editor adds its rows to it. The
// page's ports class every path by this, so the file an editor starts right after being listed is classed by the new
// list and not by the one the page opened with.
import { listGrowsBy } from '../../../shared/editor-list/editor-rows'
import type { ListPolicy } from '../../../shared/kit/ports/memory/memory-workspace'
import type { UnlistedFile, WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '../core'

export interface LiveList {
  classify(path: string): WorkspaceFile | UnlistedFile
  /** The list now reads `text`. */
  replace(text: string): void
}

export function createLiveList(text: string | undefined): LiveList {
  let load = loadEditorList(text)
  return {
    classify: (path) =>
      load.ok
        ? workspaceFile(load.list, path)
        : { path, writable: false, why: 'The editor list has a problem.' },
    replace(next) {
      load = loadEditorList(next)
    },
  }
}

/** The list's rules for the memory workspace: an editor may add its own rows, and the live list hears each write. */
export const listPolicyOf = (list: LiveList): ListPolicy => ({
  path: EDITOR_LIST_PATH,
  grows: listGrowsBy,
  changed: list.replace,
})
