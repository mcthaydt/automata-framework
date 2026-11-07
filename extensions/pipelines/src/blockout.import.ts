// `import` for the blockout pipeline (M6 spec §4.11, BP-D3): an existing `sector-map` and `nav-graph` as a blockout spec, once, for a level that
// was written by hand. It reads the content files, not a game's code, so it works for any game. Each sector is a room (a sector is already
// a room: corner loops with their walls and portals as written), masses are kept, the graph is the hand-written nav (nothing derived).
// What the files cannot know is listed in `todo`: the spawn (put in the middle of the first room), the boxes, hotspots and lamps, the camera
// zones beyond the first, openings and anchors.
import type { Blockout, Room } from '@mcthaydt/automata-sector-format/blockout'

interface MapFile {
  readonly sectors: readonly Room[]
  readonly masses?: Blockout['masses']
}
interface NavFile {
  readonly nodes: NonNullable<Blockout['nav']['nodes']>
  readonly edges: NonNullable<Blockout['nav']['edges']>
}

export function importBlockout(
  scene: string,
  map: MapFile,
  nav: NavFile,
): { blockout: Blockout; todo: string[] } {
  const rooms = JSON.parse(JSON.stringify(map.sectors)) as Room[]
  const first = rooms[0]
  const xs = first?.corners.map((corner) => corner[0]) ?? [0]
  const zs = first?.corners.map((corner) => corner[1]) ?? [0]
  const x = (Math.min(...xs) + Math.max(...xs)) / 2
  const z = (Math.min(...zs) + Math.max(...zs)) / 2
  const blockout: Blockout = {
    scene,
    rooms,
    ...(map.masses === undefined || map.masses.length === 0
      ? {}
      : { masses: JSON.parse(JSON.stringify(map.masses)) }),
    spawn: { x, y: (first?.floor ?? 0) + 0.79, z, facing: 0 },
    boxes: [],
    hotspots: [],
    lamps: [],
    nav: {
      derive: false,
      nodes: JSON.parse(JSON.stringify(nav.nodes)),
      edges: JSON.parse(JSON.stringify(nav.edges)),
    },
    zones: [{ id: first?.zone ?? 'main', look: [x, 1, z], distance: 14 }],
  }
  return {
    blockout,
    todo: [
      'the spawn is the middle of the first room: move it',
      'zones: only the first room’s zone is named, looking at the first room: add the others with their areas',
      'boxes, hotspots and lamps are not in a sector map: add them',
      'openings and anchors cannot be recovered: portals stay as walls of the rooms they were written in',
    ],
  }
}
