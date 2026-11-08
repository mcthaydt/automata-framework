import { onDestroy } from 'svelte'
import type { ObjectUrls } from '../../shared/level-2d/documents/view-props'
import type { Project } from '../../shared/level-2d/model/project-types'
import type { ResolvedEntitiesSelection } from './entities-model'
import type { EntitiesSession } from './entities-session'

// What a Characters region draws from: the session's project and selection as Svelte state that follows it, and the
// tile pictures a character draws with as object URLs. Each region calls these while it is set up and stops following
// when it goes, so the session outlives the regions (the suite keeps it across a switch).

export interface CharactersState {
  readonly project: Project
  readonly selection: ResolvedEntitiesSelection
}

export function charactersState(session: EntitiesSession): CharactersState {
  let project = $state.raw(session.project)
  let selection = $state.raw(session.selection)
  const stop = session.subscribe(() => {
    project = session.project
    selection = session.selection
  })
  onDestroy(stop)
  return {
    get project() {
      return project
    },
    get selection() {
      return selection
    },
  }
}

export interface CharacterImages {
  /** The picture paths that have a URL now. */
  readonly images: ReadonlySet<string>
  imageUrl(path: string): string | undefined
}

/** Reads each picture a character's tile is cut from once and shows it through an object URL. */
export function characterImages(
  project: () => Project,
  read: (path: string) => Promise<Uint8Array | undefined>,
  objectUrls: ObjectUrls | undefined,
): CharacterImages {
  let urls = $state.raw<ReadonlyMap<string, string>>(new Map())
  $effect(() => {
    if (objectUrls === undefined) return
    const used = new Set(
      project().defs.entities.flatMap((def) => (def.tile === undefined ? [] : [def.tile.tileset])),
    )
    for (const set of project().defs.tilesets) {
      const path = set.image
      if (path === undefined || !used.has(set.id) || urls.has(path)) continue
      void read(path).then((bytes) => {
        if (bytes === undefined || urls.has(path)) return
        urls = new Map([...urls, [path, objectUrls.create(bytes)]])
      })
    }
  })
  onDestroy(() => {
    for (const url of urls.values()) objectUrls?.revoke(url)
  })
  return {
    get images() {
      return new Set(urls.keys())
    },
    imageUrl: (path) => urls.get(path),
  }
}
