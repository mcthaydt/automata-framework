// The ports the suite page opens: the checkout it is served on, or the sample game. Served by `automata editor`, the
// page's own origin answers `/api/ping` and the files are the checkout's, read and written over HTTP behind the game's
// editor list, as the 2D editor reads them. Only when nothing answers does the page open the sample game, kept in this
// browser, and the top bar says so. The served suite has no change sets, so its edits write the checkout directly, and
// its Publish builds the game into a zip on the computer that serves it.
import type { SuitePorts } from '../../../shared/kit/ports/suite-ports.ts'
import { createMemoryStore } from '../../../shared/kit/storage/memory-store.ts'
import type { ProjectStore } from '../../../shared/kit/storage/project-store.ts'
import type { PublishClient } from '../../../shared/kit/storage/publish-client.ts'
import type { Where } from '../../../shared/kit/storage/save-line.ts'
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
  /** Where the game's files live, for the saved line: the served folder, this browser's storage, or nowhere. */
  readonly where: Where
  /** Why the browser keeps nothing, when it said; none otherwise. */
  readonly reason: string | undefined
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

/** A game of the person's own, kept in this browser (`web-games`): opened in place of the sample when no server answers. */
export interface LocalGame {
  readonly store: ProjectStore
  /** The game's name in words: the top bar's title. */
  readonly title: string
  /** Where its files live: this browser's storage, or nowhere when the browser keeps none. */
  readonly where: Where
  /** Why the browser keeps nothing, when `where` is nowhere. */
  readonly reason?: string | undefined
}

export interface SuitePortsEnv
  extends Pick<ServedWorkspaceEnv, 'origin' | 'search' | 'fetch' | 'sessionStorage' | 'storage'> {
  /** The sample game's files, opened when no editor server answers; the 2D sample by default. */
  readonly sample?: Readonly<Record<string, string>> | undefined
  /** The person's own game; opened when no editor server answers, and ahead of the sample. */
  readonly local?: LocalGame | undefined
}

/** The private-storage folder the sample game is kept in, apart from the 2D page's own `workspace`. */
const SAMPLE_FOLDER = 'sample-game'

/** The ports over a game's files, classed by the game's own `content/editors.toml` and kept in `store`. */
async function gamePorts(store: ProjectStore): Promise<SuitePorts> {
  const bytes = await store.read(EDITOR_LIST_PATH)
  const list = createLiveList(bytes === undefined ? undefined : decoder.decode(bytes))
  const { ports } = await createMemoryPorts({
    store,
    classify: list.classify,
    // The compiler's outputs (`tuning-meta.json`, `events.json`) are read from the checkout, never written.
    generated: (path) => path.startsWith(GENERATED_FOLDER),
    listChanged: list.replace,
  })
  return ports
}

export async function openSuitePorts(env: SuitePortsEnv): Promise<OpenedSuitePorts> {
  const served = await openServedStore(env)
  if (served === undefined && env.local !== undefined) {
    const { store, title, where, reason } = env.local
    return {
      ports: await gamePorts(store),
      sample: false,
      kept: where !== 'nowhere',
      where,
      reason,
      gameUrl: undefined,
      playOff: undefined,
      game: title,
      publish: undefined,
    }
  }
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
      where: opened.persistent ? 'device' : 'nowhere',
      reason: opened.persistent ? undefined : opened.reason,
      gameUrl: undefined,
      playOff: undefined,
      game: undefined,
      publish: undefined,
    }
  }
  const { store, gameUrl, playOff, game, publish } = served
  return {
    ports: await gamePorts(store),
    sample: false,
    kept: true,
    where: 'folder',
    reason: undefined,
    gameUrl,
    playOff,
    game,
    publish,
  }
}

/** Whether this page is served by `automata editor`, which shows its checkout whatever else the page might open. */
export async function pageIsServed(env: SuitePortsEnv): Promise<boolean> {
  return (await openServedStore(env)) !== undefined
}
