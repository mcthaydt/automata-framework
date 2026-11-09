// A map plan (`map-plan.ts`, EnvironmentBuilder's `MapPlan` at 6d82a52) as an `af-sector/2` level. The generators make
// plans and `generateMap` converts them here; `scripts/convert-builder-maps.ts` converts a file of the builder's own
// maps into `library/maps/`. The fields land so: a rectangle or vertices become
// corners (edge `i` runs from corner `i`, so the builder's walls by edge index stay by edge), the sector's default wall
// goes under each edge's own, `swatch` is `surface`, `shade` is a light level, and sprites split into props and cast.
// What the builder only cached (`dressed`, `doorState`, a door's `shown`, a sprite's `diorama`) is left out.
import {
  AF_SECTOR_2_FORMAT,
  type AfCorner2,
  type AfSector2,
  type AfSectorEntry2,
  type AfWall2,
  afSector2Schema,
  type CastPlace,
  type Plane,
  type PropPlace,
} from '@automata/3d/level'
import type { MapPlan, MapPlane, MapSector, MapSprite, MapWall, V2 } from './map-plan.ts'

/** The light a Build shade step takes off: a shade of 1 is a tenth darker. */
const SHADE_STEP = 0.1

/** `value` without the members that are `undefined`, so the result is the JSON the file would hold. */
function defined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, member]) => member !== undefined)) as T
}

/**
 * The generator a sprite's `kind` names. The builder's `box` is a rounded block painted `mat`; core's `box` is a plain
 * one painted `swatch`, so the builder's is the kit's `block`.
 */
const kindOf = (kind: string | undefined): string | undefined => (kind === 'box' ? 'block' : kind)

function planeOf({ swatch, ...rest }: MapPlane): Plane {
  return defined({ z: rest.z, surface: swatch, slope: rest.slope, sky: rest.sky })
}

function wallOf(wall: MapWall | undefined): AfWall2 | undefined {
  if (wall === undefined) return undefined
  const { swatch, dado, cornice, ...same } = wall
  return defined({
    ...same,
    surface: swatch,
    dado: dado === undefined ? undefined : { surface: dado.swatch, height: dado.height },
    cornice: cornice === undefined ? undefined : { surface: cornice.swatch, height: cornice.height },
  })
}

/** The sector's default wall with the edge's own over it. */
function edgeWall(sector: MapSector, edge: number): AfWall2 | undefined {
  const base = wallOf(sector.wall)
  const own = wallOf(sector.walls?.[String(edge)])
  return base === undefined && own === undefined ? undefined : { ...base, ...own }
}

/** The outline as points: vertices as given, or a rectangle walked from its north-west corner (north, east, south, west). */
function outline(sector: MapSector): V2[] {
  if (sector.verts !== undefined) return sector.verts
  if (sector.rect === undefined) throw new Error(`sector "${sector.id}" has neither verts nor rect`)
  const [x0, y0, x1, y1] = sector.rect
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
}

function sectorOf(sector: MapSector): AfSectorEntry2 {
  const corners: AfCorner2[] = outline(sector).map(([x, z], edge) => {
    const wall = edgeWall(sector, edge)
    return wall === undefined ? [x, z] : [x, z, wall]
  })
  const { shown: _shown, swatch, ...door } = sector.door ?? {}
  const { dressed: _dressed, ...dress } = sector.dress ?? { as: '' }
  return defined({
    id: sector.id,
    floor: planeOf(sector.floor),
    ceiling: planeOf(sector.ceil),
    light: Math.round((1 - (sector.shade ?? 0) * SHADE_STEP) * 100) / 100,
    grime: sector.grime,
    door: sector.door === undefined ? undefined : defined({ ...door, surface: swatch }),
    dress: sector.dress === undefined ? undefined : dress,
    corners,
  })
}

/** Props (a preset or a generator) and cast (a character) from the builder's one list of sprites. */
function placesOf(sprites: MapSprite[]): { props: PropPlace[]; cast: CastPlace[] } {
  const taken = new Set(sprites.flatMap((sprite) => (sprite.id === undefined ? [] : [sprite.id])))
  const idOf = (sprite: MapSprite, stem: string, index: number): string => {
    if (sprite.id !== undefined) return sprite.id
    let id = `${stem}${index}`
    while (taken.has(id)) id += '-'
    taken.add(id)
    return id
  }
  const props: PropPlace[] = []
  const cast: CastPlace[] = []
  for (const [index, sprite] of sprites.entries()) {
    if (sprite.who !== undefined)
      cast.push(
        defined({
          id: idOf(sprite, 'cast', index),
          who: sprite.who,
          pose: sprite.pose,
          at: sprite.at,
          angle: sprite.angle,
          to: sprite.to,
        }),
      )
    else if (sprite.use !== undefined || sprite.kind !== undefined)
      props.push(
        defined({
          id: idOf(sprite, 'prop', index),
          use: sprite.use,
          kind: kindOf(sprite.kind),
          at: sprite.at,
          angle: sprite.angle,
          with: sprite.with,
          layer: sprite.layer,
        }),
      )
    else throw new Error(`sprite ${index} is neither a prop (use or kind) nor a character (who)`)
  }
  return { props, cast }
}

/** A builder map as a `/2` level, checked against the schema. Throws on a plan that is not a map. */
export function convertBuilderMap(plan: unknown): AfSector2 {
  if (plan === null || typeof plan !== 'object') throw new Error('not a builder map: expected an object')
  const map = plan as Partial<MapPlan>
  if (typeof map.id !== 'string') throw new Error('not a builder map: it has no id')
  if (!Array.isArray(map.sectors)) throw new Error(`not a builder map: "${map.id}" has no sectors`)
  const { props, cast } = placesOf(map.sprites ?? [])
  const { dressed: _dressed, ...dress } = map.dress ?? { as: '' }
  const sky = defined({ horizon: map.horizon, layers: map.layers })
  const look = defined({ visibility: map.visibility, grade: map.grade })
  return afSector2Schema.parse(
    defined({
      format: AF_SECTOR_2_FORMAT,
      name: map.id,
      title: map.name,
      sectors: map.sectors.map(sectorOf),
      props: props.length > 0 ? props : undefined,
      cast: cast.length > 0 ? cast : undefined,
      lamps: map.lamps?.map((lamp, index) => ({ ...lamp, id: lamp.id ?? `lamp${index}` })),
      time: map.time,
      look: Object.keys(look).length > 0 ? look : undefined,
      views: map.views,
      paths: map.paths,
      sky: Object.keys(sky).length > 0 ? sky : undefined,
      seed: map.seed,
      grime: map.grime,
      dress: map.dress === undefined ? undefined : dress,
      reads: map.reads,
    }),
  )
}
