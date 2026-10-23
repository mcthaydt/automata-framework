// The rooms of a Last Light blockout as the editor's edits see them (ED3D spec §4.1). A room is an `EditSector` plus a
// camera `zone`, which the edits do not know and carry through by spreading; a new room takes its zone from the room it
// is drawn like. `references` is Last Light's own `roomReferences` (editor/src/server/level-edits.ts, 92e6704) with
// its sentences, minus the search of the scene's code, which belongs to the Last Light server.
import type { Blockout, Room } from '../format/blockout.schema'
import { BlockoutError, wallOf } from '../format/expand'
import { insideOutline } from '../geometry/loops'
import {
  type EditSector,
  type EditWall,
  inheritedMaterials,
  portalReferences,
  type SectorAccess,
  SectorAccessError,
} from './sector-access'

function roomOf(sector: EditSector): Room {
  if (!('zone' in sector) || typeof sector.zone !== 'string')
    throw new SectorAccessError(`sector ${sector.id} has no zone, and a Last Light room must have one`)
  // The game reads neither the view id nor the wall occlusion of `af-sector/1`; Last Light has its own cutaway groups.
  if (sector.view !== undefined)
    throw new SectorAccessError(`sector ${sector.id} has a view id, which a Last Light room cannot hold`)
  for (const [i, corner] of sector.corners.entries())
    if (typeof corner[2] === 'object' && corner[2].occlude !== undefined)
      throw new SectorAccessError(
        `wall ${i} of sector ${sector.id} has an occlude, which a Last Light wall cannot hold`,
      )
  return { ...sector, zone: sector.zone }
}

const zoneOf = (sector: EditSector | undefined): string | undefined =>
  sector !== undefined && 'zone' in sector && typeof sector.zone === 'string' ? sector.zone : undefined

/** Where a wall leads, through its preset; a preset that does not exist leads nowhere (the checks report it). */
function nextThrough(
  presets: Blockout['walls'],
): (wall: string | EditWall | undefined) => string | undefined {
  return (wall) => {
    try {
      return wallOf(wall, presets)?.next
    } catch (error) {
      if (error instanceof BlockoutError) return undefined
      throw error
    }
  }
}

/** The things of the level that point at a corner of the room's outline: `wall:<room>/<corner>`. */
function wallReferences(level: Blockout, room: string): string[] {
  const found: string[] = []
  const look = (on: string | undefined, path: string): void => {
    const hit = on === undefined ? null : /^wall:(.+)\/(\d+)$/.exec(on)
    if (hit && hit[1] === room) found.push(`${path}: ${on}`)
  }
  for (const [i, hotspot] of level.hotspots.entries()) look(hotspot.on, `hotspots.${i}.on`)
  for (const [i, lamp] of level.lamps.entries()) look(lamp.on, `lamps.${i}.on`)
  for (const [key, anchor] of Object.entries(level.anchors ?? {})) look(anchor.on, `anchors.${key}.on`)
  for (const [key, node] of Object.entries(level.nav.nodes ?? {})) look(node.on, `nav.nodes.${key}.on`)
  return found
}

export const lastLightSectorAccess: SectorAccess<Blockout> = {
  list: (level) => level.rooms,
  withSectors(level, sectors) {
    if (sectors.length === level.rooms.length && sectors.every((sector, i) => sector === level.rooms[i]))
      return level
    const own = new Map<EditSector, Room>(level.rooms.map((room) => [room, room]))
    return { ...level, rooms: sectors.map((sector) => own.get(sector) ?? roomOf(sector)) }
  },
  takenIds: (level) => [...level.rooms.map((room) => room.id), ...(level.openings ?? []).map((o) => o.id)],
  create(level, draft) {
    const room: Room = {
      id: draft.id,
      zone: zoneOf(draft.like) ?? level.rooms[0]?.zone ?? level.zones[0]?.id ?? '',
      floor: draft.floor,
      ceiling: draft.ceiling,
      light: draft.light,
      ...inheritedMaterials(draft.like),
      corners: draft.corners.map(([x, z]): Room['corners'][number] => [x, z]),
    }
    return room
  },
  portalOf: (level, wall) => nextThrough(level.walls)(wall),
  references(level, id) {
    const room = level.rooms.find((each) => each.id === id)
    if (room === undefined) return []
    const found: string[] = []
    for (const opening of level.openings ?? [])
      if (opening.from === id || opening.to === id)
        found.push(`opening ${opening.id} (${opening.from} → ${opening.to})`)
    found.push(...portalReferences(level.rooms, id, 'room', nextThrough(level.walls)))
    for (const [name, wall] of Object.entries(level.walls ?? {}))
      if (wall.next === id) found.push(`wall preset ${name}: next ${id}`)
    found.push(...wallReferences(level, id))
    const within = (x: number, z: number): boolean => insideOutline(x, z, room.corners, room.holes)
    for (const box of level.boxes) if (within(box.x, box.z)) found.push(`box ${box.id} stands in it`)
    for (const hotspot of level.hotspots)
      if (within(hotspot.x, hotspot.z)) found.push(`hotspot ${hotspot.id} is in it`)
    for (const lamp of level.lamps) if (within(lamp.x, lamp.z)) found.push(`lamp ${lamp.id} is in it`)
    for (const [key, anchor] of Object.entries(level.anchors ?? {}))
      if (within(anchor.x, anchor.z)) found.push(`anchor ${key} is in it`)
    for (const [key, node] of Object.entries(level.nav.nodes ?? {}))
      if (within(node.x, node.z)) found.push(`nav node ${key} is in it`)
    for (const point of level.bounce ?? [])
      if (within(point[0], point[2])) found.push(`bounce point ${point.join(', ')} is in it`)
    if (within(level.spawn.x, level.spawn.z)) found.push('the spawn is in it')
    return found
  },
}
