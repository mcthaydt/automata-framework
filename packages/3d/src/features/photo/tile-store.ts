// The tiles a view draws with, made when they are wanted: each from its photo, at the texel scales the view sees it at,
// worn by the grime of the place, and read against its swatch's ladder as RGBA. A tile is cached for the session by swatch,
// scales, grime and turn. By default tiles are made on the page's own thread, one at a time with a turn of the page between
// them, a photo fetched and prepared once for all its pairs; given a worker pool (`tile-workers.ts`) they are made off the
// page's thread, in parallel.

import { hash3 } from './colour.ts'
import { PHOTOS, photoOf, photoSource } from './photo-library.ts'
import { photoUrl } from './photo-urls.ts'
import { ladderOf, type TexturedSwatch, textureOf } from './swatch-tile.ts'
import { TEXTURE_DEFAULTS, texelScale } from './texture-spec.ts'
import type { PhotoSource } from './tile.ts'
import { type PaintedTile, renderTile, type TileJob } from './tile-render.ts'

/** A tile as a view draws with it. */
export interface TileImage extends PaintedTile {
  /** The texel the swatch's seed starts the tile at, where a surface is tiled in the world. */
  readonly offset: readonly [number, number]
}

/** A tile asked for: the swatch, the texels a metre it is seen at along u and v, and the grime that wears it. */
export interface TileRequest {
  readonly name: string
  readonly swatch: TexturedSwatch
  readonly pair: readonly [number, number]
  readonly grime: number
  /** Turned a quarter, as a surface placement may ask. */
  readonly turn?: boolean | undefined
}

/** Something that makes a tile from a job. A parallel maker takes jobs all at once. */
export interface TileMaker {
  readonly parallel: boolean
  make(job: TileJob): Promise<PaintedTile>
}

export interface TileStore {
  /** The tile, made now (after the ones before it), or `undefined` for a flat swatch or a photo that would not load. */
  tile(
    name: string,
    swatch: TexturedSwatch,
    pair: readonly [number, number],
    grime: number,
    turn?: boolean,
  ): Promise<TileImage | undefined>
  /** Makes every request. */
  prewarm(requests: readonly TileRequest[]): Promise<void>
  /** Asks for a tile to be made later, one at a time by `step`. */
  queue(request: TileRequest): void
  /** Makes the next queued tile; true if there was one. */
  step(): Promise<boolean>
  /** How many tiles are queued. */
  readonly pending: number
  /** How many tiles have been made. */
  readonly made: number
}

export interface TileStoreOptions {
  /** The swatches an accent is read from. */
  readonly swatches?: Readonly<Record<string, TexturedSwatch>>
  /** The URL a photo is fetched from (the bundler's by default). */
  readonly urlOf?: (photo: string) => string
  /** The page's turn between two tiles made on its own thread (a timeout by default). */
  readonly turn?: () => Promise<void>
  /** Makes the tiles elsewhere, such as a worker pool; by default the page's own thread does. */
  readonly maker?: TileMaker
}

const nextTurn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

export function createTileStore(
  fetchBytes: (url: string) => Promise<Uint8Array>,
  warn: (message: string) => void,
  options: TileStoreOptions = {},
): TileStore {
  const urlOf = options.urlOf ?? photoUrl
  const turn = options.turn ?? nextTurn
  const swatches = options.swatches ?? {}
  const sources = new Map<string, Promise<PhotoSource>>()
  const own: TileMaker = {
    parallel: false,
    async make(job) {
      const facet = job.spec.facet ?? TEXTURE_DEFAULTS.facet
      const flat = job.spec.flatten ?? TEXTURE_DEFAULTS.flatten
      const key = `${job.photo}|${facet}|${flat}`
      let source = sources.get(key)
      if (source === undefined) {
        source = fetchBytes(job.url).then((bytes) =>
          photoSource(bytes, photoOf(PHOTOS, job.photo), facet, flat),
        )
        sources.set(key, source)
      }
      return renderTile(await source, job)
    },
  }
  const maker = options.maker ?? own
  const done = new Map<string, Promise<TileImage | undefined>>()
  const waiting: TileRequest[] = []
  const warned = new Set<string>()
  let chain: Promise<unknown> = Promise.resolve()
  let made = 0

  const keyOf = (r: TileRequest): string =>
    `${r.name}|${texelScale(r.pair[0])}|${texelScale(r.pair[1])}|${r.grime}|${r.turn === true}`

  async function make(r: TileRequest): Promise<TileImage | undefined> {
    const spec = textureOf(r.swatch)
    if (spec === undefined) return undefined
    const worn =
      r.grime === 1 ? spec : { ...spec, wear: Math.min(1, (spec.wear ?? TEXTURE_DEFAULTS.wear) * r.grime) }
    const job: TileJob = {
      photo: spec.photo,
      url: urlOf(spec.photo),
      spec: r.turn === true ? { ...worn, turn: !worn.turn } : worn,
      ladder: ladderOf(r.swatch, swatches),
      pair: r.pair,
    }
    let tile: PaintedTile
    try {
      tile = await maker.make(job)
    } catch {
      if (!warned.has(r.name)) {
        warned.add(r.name)
        warn(`The material "${r.name}" could not load its photo, so it is drawn plain.`)
      }
      return undefined
    }
    const seed = spec.seed ?? TEXTURE_DEFAULTS.seed
    made++
    return {
      ...tile,
      offset: [Math.floor(hash3(seed, 1) * tile.width), Math.floor(hash3(seed, 2) * tile.height)],
    }
  }

  function ask(r: TileRequest, yields: boolean): Promise<TileImage | undefined> {
    const key = keyOf(r)
    let hit = done.get(key)
    if (hit === undefined) {
      if (maker.parallel) hit = make(r)
      else {
        // One at a time, in the order asked: a job starts when the one before it has made its tile and the page has had a turn.
        const job = chain.then(() => make(r))
        chain = job.catch(() => undefined).then(() => (yields ? turn() : undefined))
        hit = job
      }
      done.set(key, hit)
    }
    return hit
  }

  return {
    tile: (name, swatch, pair, grime, turned) =>
      ask({ name, swatch, pair, grime, ...(turned === undefined ? {} : { turn: turned }) }, true),
    async prewarm(requests) {
      await Promise.all(requests.map((r) => ask(r, true)))
    },
    queue(request) {
      if (!done.has(keyOf(request)) && !waiting.some((w) => keyOf(w) === keyOf(request)))
        waiting.push(request)
    },
    async step() {
      const next = waiting.shift()
      if (next === undefined) return false
      await ask(next, false)
      return true
    },
    get pending() {
      return waiting.length
    },
    get made() {
      return made
    },
  }
}

/** The ways a tile may be placed on its surface (the surface's `repeat`, `pan`, and whether it starts at the origin). */
export interface TilePlace {
  readonly repeat?: readonly [number, number] | undefined
  readonly pan?: readonly [number, number] | undefined
  /** Starts at u = v = 0 (a wall's start, a prop's origin) with no seed offset. */
  readonly anchored?: boolean | undefined
}

const wrap = (n: number, m: number): number => ((n % m) + m) % m

/**
 * The tile texel (column, row) at a place on a surface, `u` and `v` in metres in the surface's frame. A wall's rows run
 * down (`down`: v is up the wall); a floor's run with v. The repeat spreads the tile over more metres, the pan moves it in
 * whole texels, and a surface tiled in the world starts at its seed's texel.
 */
export function tileTexel(
  tile: Pick<TileImage, 'width' | 'height' | 'texels' | 'offset'>,
  u: number,
  v: number,
  down: boolean,
  place: TilePlace,
): readonly [number, number] {
  const [r0, r1] = place.repeat ?? [1, 1]
  const [p0, p1] = place.pan ?? [0, 0]
  const [lu, lv] = tile.texels
  const du = Math.round((p0 / r0) * lu)
  const dv = Math.round((p1 / r1) * lv)
  const [ox, oy] = place.anchored === true ? [0, 0] : tile.offset
  const x = Math.floor((u / r0) * lu) - du + ox
  const y = (down ? -Math.floor((v / r1) * lv) - 1 + dv : Math.floor((v / r1) * lv) - dv) + oy
  return [wrap(x, tile.width), wrap(y, tile.height)]
}
