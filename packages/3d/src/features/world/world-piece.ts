// The world builder's piece: one drawable thing, its mesh and the surface it is painted with, in the room it belongs to.
import type { Surface } from '../../shared/level/af-sector-2.schema.ts'
import type { Occlude } from '../../shared/level/occlude.ts'
import type { MeshData } from '../../shared/math/geometry.ts'
import type { V3 } from '../../shared/math/math.ts'
import type { ModelPlacement } from './place-props.ts'
import type { Veil } from './props/piece.ts'
import type { V2 } from './sectors.ts'
import type { TexPlace } from './surface.ts'

/** What a piece is a part of. Lamps are not pieces: they are `World.lamps`. */
export type WorldPart = 'floor' | 'ceiling' | 'wall' | 'decor' | 'prop'

/** A solid rectangle of a wall face: its plan line `a` to `b`, and the heights (metres from the world's floor) it spans. */
export interface WallFace {
  readonly a: V2
  readonly b: V2
  readonly lo: number
  readonly hi: number
}

/** One drawable thing: its mesh and the surface it is painted with, in the room it belongs to. */
export interface WorldPiece {
  /** `<room>:<role>` or `<room>:<role>:<place>`, stable for a given level. */
  readonly id: string
  /** The room's id. */
  readonly sector: string
  /** The room's shade, as the level states it (1 is normal, lower is darker): the light baked into the piece takes it. */
  readonly light: number
  readonly part: WorldPart
  readonly mesh: MeshData
  /** A swatch name, or a swatch with its placement. */
  readonly surface: Surface
  /** How its tile is placed, when the surface gives a placement. */
  readonly tex?: TexPlace
  /** A wall face's line: where it stands on the plan, `a` to `b` with the room on its left, for the occluder rule. */
  readonly line?: { readonly a: V2; readonly b: V2 }
  /** What the occluder rule does with a wall face (`/2`'s `occlude`); a wall that says nothing is cut. */
  readonly occlude?: Occlude
  /**
   * The solid parts of a wall face, each a rectangle on the plan line between two heights (the face with its doorways and
   * windows cut out), so the light's occluders let light through an opening. A wall with none has one over its whole face.
   */
  readonly faces?: readonly WallFace[]
  /** The camera-cut group of the wall (or mass) it belongs to: room visibility hides a group's pieces together. */
  readonly cut?: string
  /** A model the renderer draws in place of this mesh (a `model` prop), and its turn. */
  readonly model?: ModelPlacement
  /** Hangs from the ceiling: it goes with the ceilings. */
  readonly ceiling?: boolean
  /** Translucent: drawn blended at an opacity, or added to what is behind it; unlit. */
  readonly veil?: Veil
  /** A hinged door's pivot and its swing at fully open (degrees about y); the mesh is built shut. */
  readonly door?: { readonly hinge: V3; readonly swing: number }
  /** Sways in the wind: how far (metres) its top moves, and its phase (leaves, grass, a curtain). */
  readonly sway?: number
  readonly phase?: number
  /** Casts no shadow: a thin or glowing part. */
  readonly noCast?: boolean
  /** A prop's part: the prop's id and where its base stands (world x, up, z), for a state that moves the prop. */
  readonly prop?: { readonly id: string; readonly at: V3 }
}
