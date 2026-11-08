// The journeys' seed and route (G2): a build made for them (`VITE_AF_JOURNEYS=1`, the `e2e:game` script) starts Wick
// beside what a journey checks, named by `?route=`, and writes his place on the page, so a journey that plays with a
// finger takes seconds of the software-drawn game and not minutes. A normal build has neither: the route is read only
// under the flag, and the position is never written. Test code: the sim never reads it (law 1).
import type { StepResult } from '@automata/sim'
import type { AreaSource } from '../shared/area.ts'
import type { RoomWorld } from '../shared/room-world.ts'

/** Where `?route=` puts Wick, in metres: the room's own spots (content/levels/room.af-sector.json). */
const SPAWNS = {
  // Three metres to the left, the first ember is the next thing straight ahead: a push up the stick takes it.
  ember: { x: -3, z: 1.5 },
  // Two metres short of the goal ember, which ends the run.
  goal: { x: 0, z: 24 },
} as const

export type Route = keyof typeof SPAWNS

const isRoute = (name: string | null): name is Route => name !== null && name in SPAWNS

/** The route the page's address names, only when the build is a journeys build. */
export function routeOf(search: string, enabled: boolean): Route | undefined {
  if (!enabled) return undefined
  const name = new URLSearchParams(search).get('route')
  return isRoute(name) ? name : undefined
}

/** `area` with Wick starting where `route` says; unchanged without one. */
export function routed(area: AreaSource, route: Route | undefined): AreaSource {
  return route === undefined ? area : { ...area, spawn: SPAWNS[route] }
}

/**
 * Writes Wick's place, in metres, on the page's root element (`data-hero="x,z"`) after each step, for a journey to read.
 * Nothing is written without the flag.
 */
export function showHero(result: StepResult, enabled: boolean, root: HTMLElement): void {
  if (!enabled) return
  const rows = [...result.render.added, ...result.render.changed]
  const hero = rows.findLast((row) => row.components.hero !== undefined)?.components.hero as
    | { x: number; z: number }
    | undefined
  if (hero !== undefined)
    root.dataset.hero = `${(hero.x / 65_536).toFixed(2)},${(hero.z / 65_536).toFixed(2)}`
}

/**
 * Writes where the room's props stand, how high its floors are (in metres) and the time of day it is played in, on the
 * page's root element (`data-props="crate-1:-4.00,6.50;…"`, `data-floors="start:0.00;…"`, `data-time="night"`) once, for
 * a journey that edits the room in an editor and then checks it is the room that is drawn. Nothing is written without
 * the flag.
 */
export function showRoom(room: RoomWorld, enabled: boolean, root: HTMLElement, time: string): void {
  if (!enabled) return
  const props = new Map<string, string>()
  const floors = new Map<string, string>()
  for (const piece of room.world.pieces) {
    if (piece.prop !== undefined && !props.has(piece.prop.id)) {
      const [x, , z] = piece.prop.at
      props.set(piece.prop.id, `${piece.prop.id}:${x.toFixed(2)},${z.toFixed(2)}`)
    }
    if (piece.part === 'floor' && !floors.has(piece.sector)) {
      const height = Math.max(...piece.mesh.positions.filter((_, index) => index % 3 === 1))
      floors.set(piece.sector, `${piece.sector}:${height.toFixed(2)}`)
    }
  }
  root.dataset.props = [...props.values()].join(';')
  root.dataset.floors = [...floors.values()].join(';')
  root.dataset.time = time
}
