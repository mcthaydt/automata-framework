// The workspace contract (editor-kit `./ports/testing`) run against the kit's memory workspace with this package's
// policy, read from the scenario's own `content/editors.toml`: the setup the disk adapter of EDS.1d repeats on a real
// checkout, so the fake and the adapter answer to one policy.

import { EDITOR_LIST_PATH, fileAccess, loadEditorList, workspaceFile } from '../../features/suite/core'
import { createMemoryChangeSet } from '../ports/memory-change-set.ts'
import { createMemoryWorkspace } from '../ports/memory-workspace.ts'
import { describeSuiteWorkspace } from '../ports/workspace-contract.ts'

describeSuiteWorkspace('memory, with the af-editors/1 policy', async (scenario) => {
  const load = loadEditorList(scenario.files[EDITOR_LIST_PATH])
  if (!load.ok) throw new Error(`the scenario's list does not load: ${JSON.stringify(load.problems)}`)
  const { list } = load
  const changeSet = createMemoryChangeSet()
  const workspace = await createMemoryWorkspace({
    files: scenario.files,
    classify: (path) => workspaceFile(list, path),
    generated: (path) => {
      const access = fileAccess(list, path)
      return !access.writable && access.reason === 'generated'
    },
    changeSet,
  })
  return { workspace, changeSet }
})
