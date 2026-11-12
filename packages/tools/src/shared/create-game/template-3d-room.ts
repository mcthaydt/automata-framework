import type { TemplateFile } from './template-file.ts'

// The 3D game's room feature (template-3d-game.ts has the rest): the room file read into what the sim needs, and the
// room built for the eye.

/** The room feature: the room file read into what the sim needs, and the room built for the eye. */
export const ROOM_FILES: readonly TemplateFile[] = [
  {
    path: 'src/features/room/read-room.ts',
    content:
      () => `import { type AfCorner2, type AfSector2, insideSector, type SectorPlan } from '@automata/3d/level'
import type { Tuning } from '../../shared/tuning.ts'

// Reads a room the 3D level editor wrote into what this game plays: the floors Wick can stand on, the props he cannot
// walk through, and where he starts. Pure, so the sim can hold the result. Everything is in metres.

/** A prop's round footprint: Wick cannot come nearer its centre than its radius. */
export interface Blocker {
  readonly x: number
  readonly z: number
  readonly r: number
}

/** A room as the game plays it. */
export interface Room {
  readonly id: string
  /** The floors, one for each room in the file (a pit is not a floor). */
  readonly floors: readonly SectorPlan[]
  readonly blockers: readonly Blocker[]
  /** Where Wick starts. */
  readonly start: { readonly x: number; readonly z: number }
}

/** What the sim reads as its content: the room and the numbers a designer tunes. */
export interface PlayContent {
  readonly room: Room
  readonly tuning: Tuning
}

/** The content a system finds in ctx.content: the app gives the sim PlayContent (src/app/game.ts). */
export const playIn = (content: unknown): PlayContent => content as PlayContent

/** The part of a prop's definition (content/world-props) that decides its footprint. */
export interface PropShape {
  readonly kind: string
  /** A box's width, height and depth. */
  readonly size?: readonly number[] | undefined
  /** A cylinder's radius. */
  readonly radius?: number | undefined
}

const point = (corner: AfCorner2) => ({ x: corner[0], z: corner[1] })

/** The round footprint that covers a prop: a cylinder's radius, or a box's corners whichever way it is turned. */
function reachOf(shape: PropShape | undefined): number {
  if (shape?.kind === 'cylinder') return shape.radius ?? 0.5
  const [width = 1, , depth = 1] = shape?.size ?? []
  return Math.sqrt(width * width + depth * depth) / 2
}

/** The room in \`level\`, with each prop's footprint from \`props\` (the game's content, by prop name). */
export function roomOf(level: AfSector2, props: Readonly<Record<string, PropShape>>): Room {
  const floors = level.sectors
    .filter((sector) => sector.pit !== true)
    .map((sector) => ({
      points: [sector.corners.map(point), ...(sector.holes ?? []).map((hole) => hole.map(point))],
    }))
  const blockers = (level.props ?? []).map((prop) => ({
    x: prop.at[0] ?? 0,
    z: prop.at[1] ?? 0,
    r: reachOf(props[prop.use ?? '']),
  }))
  const starts = (level.entities ?? []).filter((entity) => entity.def === 'spawn')
  const [start] = starts
  if (starts.length !== 1 || start === undefined)
    throw new Error(
      'Room "' + level.name + '" needs one start point. It has ' + starts.length + '. Open the room in the level editor and place one.',
    )
  return { id: level.name, floors, blockers, start: { x: start.x, z: start.z } }
}

/** True when a square of half-side \`half\` centred on (x, z) is on the floor and clear of every prop. */
export function standsAt(room: Room, x: number, z: number, half: number): boolean {
  for (const [dx, dz] of [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ] as const)
    if (!room.floors.some((floor) => insideSector({ x: x + dx, z: z + dz }, floor))) return false
  return room.blockers.every((blocker) => {
    const apart = Math.sqrt((x - blocker.x) * (x - blocker.x) + (z - blocker.z) * (z - blocker.z))
    return apart >= blocker.r + half
  })
}
`,
  },
  {
    path: 'src/features/room/room.ts',
    content: () => `import { readLevel } from '@automata/3d/level'
import { readSectorMap, type SectorMap } from '@automata/sectors/sim'
import file from '../../../content/levels/room.af-sector.json' with { type: 'json' }
import { type PropShape, type Room, roomOf } from './read-room.ts'

// The room this game plays: content/levels/room.af-sector.json, which the 3D level editor writes. Change it in the
// editor (pnpm exec automata editor), then press Save.

/** The room file as the editor wrote it (an older format is brought up to date). */
export const ROOM_LEVEL = readLevel(file).level

/** The room as the story's extensions read it: its floor plan, its walls and its doorways. */
export const ROOM_MAP: SectorMap = readSectorMap(file).level

/** The room as the sim plays it; the props' footprints come from the game's content (content/world-props). */
export function roomIn(content: unknown): Room {
  const kinds = content as { readonly 'world-prop'?: Readonly<Record<string, PropShape>> }
  return roomOf(ROOM_LEVEL, kinds['world-prop'] ?? {})
}

/** Where the room puts a person, in metres, and the way they face in radians (0 toward +z, growing toward +x). */
function personAt(id: string): { readonly x: number; readonly z: number; readonly yaw: number } {
  const person = ROOM_LEVEL.cast?.find((each) => each.id === id)
  if (person === undefined)
    throw new Error(\`The room needs a "\${id}". Place one in the level editor and press Save.\`)
  return { x: person.at[0] ?? 0, z: person.at[1] ?? 0, yaw: ((person.angle ?? 0) * Math.PI) / 180 }
}

/** Where the room puts the keeper. */
export const keeperAt = () => personAt('keeper')

/** Where the room puts the guard. */
export const guardAt = () => personAt('guard')
`,
  },
  {
    path: 'src/features/room/compiled-content.d.ts',
    content:
      () => `// The content plugin's module (vite.config.ts), typed as far as this game reads it: the story's files by kind (each
// kind's files by id), and what Feel and Audio write. The plugin also writes a full declaration into content/generated/ on the first
// \`pnpm dev\` or build; this one lets the game type-check before that.
declare module 'virtual:automata/content' {
  type Files = Readonly<Record<string, unknown>> | undefined
  export const content: {
    readonly lines?: Files
    readonly dialogue?: Files
    readonly cutscene?: Files
    readonly 'nav-graph'?: Files
    readonly systems?: Files
    readonly feel?: Readonly<Record<string, unknown>>
    readonly audio?: Readonly<Record<string, unknown>>
  }
}
`,
  },
  {
    path: 'src/features/room/room.view.ts',
    content: () => `import {
  buildWorld,
  drawWorld,
  type Look,
  type Occluders,
  swatchColour,
  type WorldLibrary,
  type WorldScene,
} from '@automata/3d'
import { ROOM_LEVEL } from './room.ts'

/** The room's swatches and props, from the game's content (content/world-swatches and content/world-props). */
export function worldLibraryOf(content: unknown): WorldLibrary {
  const kinds = content as {
    readonly 'world-swatch': WorldLibrary['swatches']
    readonly 'world-prop': NonNullable<WorldLibrary['props']>
  }
  return { swatches: kinds['world-swatch'], props: kinds['world-prop'] }
}

/**
 * Draws the room under \`parent\`: its floor, walls, ceiling and props. The walls and ceiling between the camera and
 * Wick are cut away by the occluders, so he is always in view.
 */
export function drawRoom(parent: WorldScene['parent'], occluders: Occluders, library: WorldLibrary, look: Look): void {
  const world = buildWorld(ROOM_LEVEL, library)
  drawWorld(
    { parent, occluders, colourOf: (swatch) => swatchColour(library, swatch), look },
    world.pieces,
  )
}
`,
  },
]
