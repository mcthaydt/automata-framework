// What a prop generator makes: pieces (a mesh, the swatch it is painted with and a label for the part), the lights it
// carries and the surface things stand on, all in the prop's own space. A prop's origin is the centre of its base on
// the floor and its front faces +z. Parameters are data from a library preset and the level, so a generator reads the
// ones it knows and ignores the rest.
import type { LampPlace } from '../../../shared/level/af-sector-2.schema.ts'
import type { MeshData } from '../../../shared/math/geometry.ts'
import type { V3 } from '../../../shared/math/math.ts'

// A preset's parameters are whatever its generator reads (sizes in metres, swatch names by role, a seed), checked by
// the library test against the presets, not by a type here.
// biome-ignore lint/suspicious/noExplicitAny: parameters are data; see above.
export type Params = Record<string, any>

/** One part of a prop: its mesh, its swatch, and what the part is (`seat`, `legs`), which names it in the piece id. */
export interface PropPiece {
  readonly mesh: MeshData
  readonly swatch: string
  readonly label: string
  /** Casts no shadow: a thin or glowing part. */
  readonly noCast?: boolean
  /** Sways in the wind: how far (metres) its top moves, and its phase (trees, grass, a curtain). */
  readonly sway?: number
  readonly phase?: number
}

/** A light a prop carries (a lamp's bulb), in the prop's own space: a lamp of a kind from the look's lamp kit. */
export interface PropLight extends Omit<LampPlace, 'id' | 'at'> {
  readonly at: V3
}

export interface Built {
  readonly pieces: PropPiece[]
  readonly lights?: PropLight[]
  /** A surface things stand on (a table's, a shelf's, a counter's): its height and its size along x and z, centred. */
  readonly top?: { readonly y: number; readonly size: readonly [number, number] }
}

export type Generator = (p: Params) => Built

/** A piece. */
export function part(
  mesh: MeshData,
  swatch: string,
  label: string,
  extra: Pick<PropPiece, 'noCast' | 'sway' | 'phase'> = {},
): PropPiece {
  return { mesh, swatch, label, ...extra }
}

/** The prop's light: a lamp of the kind it names (a bare bulb by default), with the preset's own over it. */
export function lightOf(at: V3, p: Params, fallback: Partial<PropLight> = {}): PropLight {
  return { at, kind: 'bulb', ...fallback, ...(p.light ?? {}) }
}

/** The four corners of a footprint, as signs: where a table's legs stand. */
export const CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const

/** A piece with its mesh moved up by `dy` (lettering sits on a panel's face, not at the origin). */
export function lifted(piece: PropPiece, dy: number): PropPiece {
  const positions = piece.mesh.positions.map((v, i) => (i % 3 === 1 ? v + dy : v))
  return { ...piece, mesh: { ...piece.mesh, positions } }
}
