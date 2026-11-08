// The ports the suite page opens: the checkout it is served on, or the sample game. Served by `automata editor`, the
// page's own origin answers `/api/ping` and the files are the checkout's, read and written over HTTP behind the game's
// editor list, as the 2D editor reads them. Only when nothing answers does the page open the sample game, kept in this
// browser, and the top bar says so. The served suite has no change sets, so its edits write the checkout directly, and
// its Publish builds the game into a zip on the computer that serves it.
import type { SuitePorts } from '../../../shared/kit/ports/suite-ports.ts'
import { createMemoryStore } from '../../../shared/kit/storage/memory-store.ts'
import type { PublishClient } from '../../../shared/kit/storage/publish-client.ts'
import {
  openPrivateStores,
  openServedStore,
  type ServedWorkspaceEnv,
} from '../../../shared/kit/storage/workspace.ts'
import { EDITOR_LIST_PATH } from '../core'
import { createLiveList } from '../memory/live-list.ts'
import { createMemoryPorts } from '../memory/memory-ports.ts'
import { SAMPLE_GAME, samplePorts } from '../memory/sample-ports.ts'

export interface OpenedSuitePorts {
  readonly ports: SuitePorts
  /** True when the page opened the sample game because no editor server answered. */
  readonly sample: boolean
  /** False when the browser would not keep the sample (no private storage), so its changes are lost with the page; a checkout is always kept. */
  readonly kept: boolean
  /** The game's dev page, from the server's ping; none for the sample game. */
  readonly gameUrl: string | undefined
  /** Why Play is off, from the server's ping, when the game could not start; none otherwise. */
  readonly playOff: string | undefined
  /** The game's name in words, from the server's ping; none for the sample game. */
  readonly game: string | undefined
  /** Builds the game into a zip to upload, from a server that can; none for the sample game. */
  readonly publish: PublishClient | undefined
}

const decoder = new TextDecoder()

/** Where the content build writes what it makes. */
const GENERATED_FOLDER = 'content/generated/'

export interface SuitePortsEnv
  extends Pick<ServedWorkspaceEnv, 'origin' | 'search' | 'fetch' | 'sessionStorage' | 'storage'> {
  /** The sample game's files, opened when no editor server answers; the 2D sample by default. */
  readonly sample?: Readonly<Record<string, string>> | undefined
}

/** The private-storage folder the sample game is kept in, apart from the 2D page's own `workspace`. */
const SAMPLE_FOLDER = 'sample-game'

export async function openSuitePorts(env: SuitePortsEnv): Promise<OpenedSuitePorts> {
  const served = await openServedStore(env)
  if (served === undefined) {
    // The sample is kept in this browser's private storage where it has one (memory where it has not), so the try-it
    // page keeps a visitor's level through a reload, as the site says.
    const opened = await openPrivateStores([SAMPLE_FOLDER], env.storage)
    const [store = createMemoryStore()] = opened.stores
    const ports = await samplePorts(env.sample ?? SAMPLE_GAME, { store })
    return {
      ports,
      sample: true,
      kept: opened.persistent,
      gameUrl: undefined,
      playOff: undefined,
      game: undefined,
      publish: undefined,
    }
  }
  const { store, gameUrl, playOff, game, publish } = served
  const bytes = await store.read(EDITOR_LIST_PATH)
  const list = createLiveList(bytes === undefined ? undefined : decoder.decode(bytes))
  const { ports } = await createMemoryPorts({
    store,
    classify: list.classify,
    // The compiler's outputs (`tuning-meta.json`, `events.json`) are read from the checkout, never written.
    generated: (path) => path.startsWith(GENERATED_FOLDER),
    listChanged: list.replace,
  })
  return { ports, sample: false, kept: true, gameUrl, playOff, game, publish }
}
