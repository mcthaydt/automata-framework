// The clinic's dressing: where the world kit's clinic pieces go, from the source game's `dressClinic` (its pipes, shafts of
// moonlight, light pools, grime, cables, notices, plaques, curtains, shelving and the CRT). The source places each as boxes and
// decals at world coordinates; here each is a kit preset placed at the same spot, with AF's own numbers, so the look is the
// source's and the data is AF's. Only coordinates and sizes are read from the source's file; no texture or model is.
//
// A place is `[x, z]` on the plan (and `y` up for a hung piece); a kit piece is built facing +z, so `angle` is the way its
// face looks: 90 faces +z (south), 0 faces +x (east), 180 faces -x, -90 faces -z. A run of pipe or cable is given as world
// points, and `run` turns them into a place at the first with the rest relative to it.
const round = (n: number): number => Math.round(n * 1e6) / 1e6

export interface Place {
  id: string
  use: string
  at: number[]
  angle?: number
  with?: Record<string, unknown>
}

const SOUTH = 90
const EAST = 0
const WEST = 180

/** A run of pipe through world points: the place is the first point's plan position, the points relative to it (y absolute). */
function pipe(id: string, points: [number, number, number][], mat = 'rust', radius = 0.045): Place {
  const [x0, , z0] = points[0] as [number, number, number]
  return {
    id,
    use: 'pipe-run',
    at: [x0, z0],
    angle: SOUTH,
    with: { points: points.map(([x, y, z]) => [round(x - x0), y, round(z - z0)]), mat, radius, bracketMat: mat },
  }
}

/** A cable laid on the floor through world points (x, z). */
function cable(id: string, points: [number, number][]): Place {
  const [x0, z0] = points[0] as [number, number]
  return { id, use: 'cable', at: [x0, z0], angle: SOUTH, with: { points: points.map(([x, z]) => [round(x - x0), round(z - z0)]) } }
}

// --- pipes: along the north walls and down the north-east corner, the services in the tall upper wall, and the curtain rails ----
const PIPES: Place[] = [
  pipe('dress-pipe-ne-low', [[1.9, 3.35, -0.83], [4.8, 3.35, -0.83]]),
  pipe('dress-pipe-ne-corner', [[4.75, 0.1, -0.83], [4.75, 3.4, -0.83]]),
  pipe('dress-pipe-ne-riser', [[2.2, 1.45, -0.83], [2.2, 2.95, -0.83]]),
  pipe('dress-pipe-ne-high-a', [[3.9, 3.35, -0.83], [3.9, 4.65, -0.83]]),
  pipe('dress-pipe-ne-high-b', [[2.75, 3.3, -0.83], [2.75, 4.85, -0.83]]),
  pipe('dress-pipe-ne-high', [[1.7, 4.55, -0.83], [4.8, 4.55, -0.83]]),
  pipe('dress-pipe-ward-low', [[-4.85, 2.75, -3.77], [-1.95, 2.75, -3.77]]),
  pipe('dress-pipe-ward-corner', [[-4.75, 0.6, -3.77], [-4.75, 3, -3.77]]),
  pipe('dress-pipe-ward-high', [[-4.85, 4.55, -3.77], [-1.95, 4.55, -3.77]]),
  pipe('dress-pipe-ward-riser', [[-2.05, 2.8, -3.77], [-2.05, 4.8, -3.77]]),
  pipe('dress-pipe-corridor', [[-1.43, 3.08, -6.8], [-1.43, 3.08, -1.4]]),
  pipe('dress-pipe-west-high', [[-4.83, 4.3, -0.8], [-4.83, 4.3, 6.8]]),
  pipe('dress-pipe-east-high', [[4.83, 4.3, -0.8], [4.83, 4.3, 6.8]]),
  pipe('dress-pipe-east-riser', [[4.83, 1.1, 4.6], [4.83, 4.3, 4.6]]),
  pipe('dress-rail-west', [[-4.8, 2.75, -0.72], [-2.05, 2.75, -0.72]], 'chrome', 0.025),
  pipe('dress-rail-east', [[-2.35, 2.75, -0.75], [-2.35, 2.75, 1.65]], 'chrome', 0.025),
]

// --- moonlight: the ward's barred window lights the hall, the corridor's end window falls across the leak -----------------
const MOON: Place[] = [
  {
    id: 'dress-moon-ward',
    use: 'moon-shaft',
    at: [-4, -3.8],
    angle: SOUTH,
    with: { height: 3.75, foot: [3.75, 1.5], topHalf: 0.35, footHalf: 0.7, footDepth: 4.6 },
  },
  {
    id: 'dress-moon-corridor',
    use: 'moon-shaft',
    at: [-0.95, -6.875],
    angle: SOUTH,
    with: { height: 3.15, foot: [-0.05, 1.4], topHalf: 0.26, footHalf: 0.45, footDepth: 2.4 },
  },
]

// --- the lamps' pools on the floor: the source's gain times each lamp's level in the opening (the power out) --------------
const POOLS: Place[] = [
  { id: 'dress-pool-exit', use: 'light-pool', at: [0, -5.7], with: { radius: 1.25, opacity: 0.2 } },
  { id: 'dress-pool-corridor', use: 'light-pool', at: [0, -3.2], with: { radius: 1.5, opacity: 0.07 } },
  { id: 'dress-pool-ward', use: 'light-pool', at: [-3.2, 3.4], with: { radius: 1.6, opacity: 0.05 } },
  { id: 'dress-pool-hall', use: 'light-pool', at: [0.2, 2.6], with: { radius: 2.2, opacity: 0.05 } },
]

// --- the leak's puddle, grime along the skirting and corners, and the cables ------------------------------------------------
const FLOOR: Place[] = [
  { id: 'dress-puddle-leak', use: 'puddle', at: [-1.05, -4.1], with: { size: [1.2, 0.9], seed: 3 } },
  ...(
    [
      [-4.5, 2.5, 1.4, 6.5],
      [4.5, 4.4, 1.4, 4.5],
      [-3.3, -0.55, 3.2, 1],
      [3.3, -0.55, 3.2, 1],
      [0, -6.4, 3, 1.2],
      [-1.3, -3.6, 0.9, 5],
      [1.3, -4.4, 0.9, 4],
    ] as const
  ).map(([x, z, w, d], i): Place => ({ id: `dress-grime-${i + 1}`, use: 'grime', at: [x, z], with: { size: [w, d], seed: i + 1 } })),
  cable('dress-cable-monitor', [[-2.4, -3.1], [-2.15, -3.25], [-2, -3.55], [-1.95, -3.75]]),
  cable('dress-cable-lamp', [[3.05, 0.08], [3.2, -0.3], [3.1, -0.86]]),
]

// --- the walls: the noticeboard and what is pinned to it, frames, posters, the exit's sign, the CRT, a loose ceiling tile -----
/** One notice on the north-east wall's board: its centre height and its roll in degrees. */
const BOARD: [number, number, number][] = [
  [2.75, 1.85, 2.9],
  [3.3, 1.75, -2.3],
  [3.85, 1.9, 4.6],
  [3.55, 1.5, -3.4],
]
const WALLS: Place[] = [
  { id: 'dress-noticeboard', use: 'noticeboard', at: [3.3, -0.86, 1.95], angle: SOUTH, with: { size: [1.7, 0.9], seed: 4 } },
  ...BOARD.map(([x, y, roll], i): Place => ({
    id: `dress-notice-board-${i + 1}`,
    use: 'wall-notice',
    at: [x, -0.84],
    angle: SOUTH,
    with: { y, roll, size: [0.26, 0.34] },
  })),
  { id: 'dress-notice-drawing', use: 'wall-notice', at: [2.8, -0.84], angle: SOUTH, with: { y: 1.62, roll: 4, size: [0.3, 0.3] } },
  { id: 'dress-notice-photo', use: 'wall-notice', at: [-3.2, -3.79], angle: SOUTH, with: { y: 2.25, size: [0.4, 0.45] } },
  { id: 'dress-frame-west-1', use: 'plaque', at: [-4.86, 4.4], angle: EAST, with: { size: [0.6, 0.45], y: 1.65, lit: false, face: 'canvasSea' } },
  { id: 'dress-poster-west-1', use: 'plaque', at: [-4.86, 5.3], angle: EAST, with: { size: [0.5, 0.7], y: 1.6, lit: false, face: 'posterPaper' } },
  { id: 'dress-poster-east-1', use: 'plaque', at: [4.84, 1], angle: WEST, with: { size: [0.55, 0.7], y: 1.75, lit: false, face: 'posterPaper' } },
  { id: 'dress-frame-east-1', use: 'plaque', at: [4.84, 2.3], angle: WEST, with: { size: [0.55, 0.42], y: 1.7, lit: false, face: 'canvasSun' } },
  { id: 'dress-poster-ward-1', use: 'plaque', at: [-4.3, -3.79], angle: SOUTH, with: { size: [0.45, 0.6], y: 1.6, lit: false, face: 'posterPaper' } },
  { id: 'dress-sign-exit', use: 'plaque', at: [0, -6.86], angle: SOUTH, with: { size: [0.42, 0.2], y: 2.25, lit: true } },
  { id: 'dress-crt-ward', use: 'screen', at: [-4.84, -1.7], angle: EAST, with: { size: [0.3, 0.22], y: 2.1, face: 'plaqueFace' } },
  { id: 'dress-tile-loose', use: 'ceiling-tile', at: [0.75, -0.45], with: { ceiling: 4.9, drop: 40 } },
]

// --- the ward's two curtains, and the supply room's three shelving bays -------------------------------------------------------
const FURNISHING: Place[] = [
  { id: 'dress-curtain-west', use: 'curtain', at: [-3.85, -0.72], angle: SOUTH, with: { width: 1.7, height: 2.7, panel: 0.85, rail: 'chrome' } },
  { id: 'dress-curtain-east', use: 'curtain', at: [-2.35, 1.15], angle: EAST, with: { width: 1.1, height: 2.7, panel: 0.55, rail: 'chrome' } },
  { id: 'dress-shelving-east', use: 'shelving', at: [4.25, -4.5], angle: EAST, with: { size: [1.6, 1.9, 0.45], shelves: 4, mat: 'pipeSteel' } },
  { id: 'dress-shelving-north', use: 'shelving', at: [3.94, -6.175], angle: SOUTH, with: { size: [1.07, 1.9, 0.4], shelves: 4, mat: 'pipeSteel' } },
  { id: 'dress-shelving-west', use: 'shelving', at: [1.925, -5.525], angle: EAST, with: { size: [1.55, 1.3, 0.4], shelves: 3, mat: 'pipeSteel' } },
]

export const DRESSING: Place[] = [...MOON, ...POOLS, ...FLOOR, ...PIPES, ...WALLS, ...FURNISHING]

/**
 * The kit swatches the dressing's pieces name (each generator's default among them) that the clinic's own library does not
 * already have. The level's test builds the world with these alone, so a missing one is a problem there, not a grey piece here.
 */
export const DRESSING_SWATCHES = [
  'moonBeam',
  'lampPool',
  'puddleDark',
  'puddleSheen',
  'grimeDark',
  'pipeSteel',
  'cableBlack',
  'ceilingTilePale',
  'noticePaper',
  'plaqueFace',
  'plaqueLit',
  'plaqueFrame',
  'curtainClinic',
  'screenGlow',
  'tyre',
  'rust',
  'posterPaper',
  'canvasSea',
  'canvasSun',
  'oak',
  'crateWood',
]
