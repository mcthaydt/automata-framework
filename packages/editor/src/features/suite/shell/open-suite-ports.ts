// The ports the suite page opens: the checkout it is served on, or the sample game. Served by `automata editor`, the
// page's own origin answers `/api/ping` and the files are the checkout's, read and written over HTTP behind the game's
// editor list, as the 2D editor reads them. Only when nothing answers does the page open the sample game held in
// memory, and the top bar says so. The served suite has no change sets yet (its Review, Ship and checks are wired in
// the 3D slice), so its edits write the checkout directly.
import type { SuitePorts } from '../../../shared/kit/ports/suite-ports.ts'
import { openServedStore, type ServedWorkspaceEnv } from '../../../shared/kit/storage/workspace.ts'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '../core'
import { createMemoryPorts } from '../memory/memory-ports.ts'
import { SAMPLE_GAME, samplePorts } from '../memory/sample-ports.ts'

export interface OpenedSuitePorts {
  readonly ports: SuitePorts
  /** True when the page opened the sample game because no editor server answered. */
  readonly sample: boolean
  /** The game's dev page, from the server's ping; none for the sample game. */
  readonly gameUrl: string | undefined
  /** The game's name in words, from the server's ping; none for the sample game. */
  readonly game: string | undefined
}

const decoder = new TextDecoder()

export async function openSuitePorts(
  env: Pick<ServedWorkspaceEnv, 'origin' | 'search' | 'fetch' | 'sessionStorage'>,
): Promise<OpenedSuitePorts> {
  const served = await openServedStore(env)
  if (served === undefined)
    return {
      ports: await samplePorts(SAMPLE_GAME, { changeSet: false }),
      sample: true,
      gameUrl: undefined,
      game: undefined,
    }
  const { store, gameUrl, game } = served
  const bytes = await store.read(EDITOR_LIST_PATH)
  const load = loadEditorList(bytes === undefined ? undefined : decoder.decode(bytes))
  const { ports } = await createMemoryPorts({
    store,
    classify: (path) =>
      load.ok
        ? workspaceFile(load.list, path)
        : { path, writable: false, why: 'The editor list has a problem.' },
    changeSet: false,
  })
  return { ports, sample: false, gameUrl, game }
}
