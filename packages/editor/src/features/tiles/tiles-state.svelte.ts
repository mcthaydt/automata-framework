import { onDestroy } from 'svelte'
import type { ObjectUrls } from '../../shared/level-2d/documents/view-props'
import type { Project } from '../../shared/level-2d/model/project-types'
import type { ResolvedSelection } from './tilesets-model'
import type { TilesetsSession } from './tilesets-session'

// What a Tiles region draws from: the session's project and selection as Svelte state that follows it, and the tile
// pictures as object URLs. Each region calls these while it is set up and stops following when it goes, so the
// session outlives the regions (the suite keeps it across a switch, as the Level view's) and each picture is read once
// per region and let go with it.

export interface TilesState {
  readonly project: Project
  readonly selection: ResolvedSelection
}

export function tilesState(session: TilesetsSession): TilesState {
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

export interface TileImages {
  /** The picture paths that have a URL now. */
  readonly images: ReadonlySet<string>
  imageUrl(path: string): string | undefined
}

/** Reads each tileset picture once and shows it through an object URL; without `objectUrls` the tiles show numbered. */
export function tileImages(
  project: () => Project,
  read: (path: string) => Promise<Uint8Array | undefined>,
  objectUrls: ObjectUrls | undefined,
): TileImages {
  let urls = $state.raw<ReadonlyMap<string, string>>(new Map())
  $effect(() => {
    if (objectUrls === undefined) return
    for (const set of project().defs.tilesets) {
      const path = set.image
      if (path === undefined || urls.has(path)) continue
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
