// The occluder rule on `@pixi/3d` (M3 spec §4.2): the static scenery a game registers in its `scene` hook, and the
// per-frame pass applied to it. Walls are built here, so each has its own material for its fade and a floor trim that
// shows while it is cut, as The Last Light's cut-away groups show their low stubs (`src/render/stage.ts` lines 168 to
// 171 and 887 to 891 at 92e6704). Ceilings are never drawn in the angled view. A prop fades through its material's
// alpha, so its mesh must own its material. Presentation only: the sim never reads any of it.
import type { PixiStageHooks } from '@mcthaydt/automata-render-pixi'
import { reducedMotion as prefersReducedMotion } from '@mcthaydt/automata-ui'
import { Container3D, CubeGeometry, Mesh3D, PhongMaterial } from '@pixi/3d'
import type { CameraRig } from '../camera/angled-camera.js'
import type { Occlude } from './occlude.js'
import {
  type OccluderFrame,
  type OccluderPass,
  occluderPass,
  type PropEntry,
  type WallEntry,
} from './occluder-pass.js'
import { type Box3, type PlanPoint, propOcclude } from './occluder-rule.js'

export interface WallOptions {
  /** The inside face runs from `a` to `b` with the room on its left. */
  readonly a: PlanPoint
  readonly b: PlanPoint
  /** Metres from the floor (y 0). */
  readonly height: number
  /** Metres outward from the inside face. Default 0.2. */
  readonly thickness?: number | undefined
  /** The floor trim's height in metres, shown while the wall is cut. Default 0.12. */
  readonly trim?: number | undefined
  /** Base colour, e.g. 0x6d758d. */
  readonly color: number
  /** Default `cut`. */
  readonly occlude?: Occlude | undefined
}

export interface PropOptions {
  /** The prop's world bounds in metres. */
  readonly bounds: Box3
  /** Default: `fade` when taller than 1.5 m, else `never`. */
  readonly occlude?: Occlude | undefined
}

/** What a game's `scene` hook registers with the occluder rule. */
export interface Occluders {
  /** Builds a wall and its floor trim under the view's root, and returns their node. */
  wall(options: WallOptions): Container3D
  /** A ceiling or an overhead beam: not drawn in the angled view. */
  ceiling(node: Container3D): void
  /** A static mesh that fades (or is cut) when it stands on the camera's line to the player. It owns its material. */
  prop(mesh: Mesh3D, options: PropOptions): void
}

export interface OccluderStage extends Occluders {
  /** Applies one frame of the rule. */
  update(frame: OccluderFrame): void
}

export const WALL_THICKNESS = 0.2
export const TRIM_HEIGHT = 0.12

/** Shows `mesh` at `opacity`: hidden at 0, blended below 1, opaque (writing depth) at 1. */
function showAt(mesh: Mesh3D, opacity: number): void {
  mesh.visible = opacity > 0
  const mode = opacity < 1 ? 'blend' : 'opaque'
  if (mesh.material.alphaMode !== mode) mesh.material.alphaMode = mode
  mesh.material.alpha = opacity
}

/** A box `height` tall standing on the floor under `a → b`, its +z face on that line and its depth outward. */
function slab(options: WallOptions, height: number, thickness: number): Mesh3D {
  const { a, b } = options
  const length = Math.hypot(b.x - a.x, b.z - a.z)
  const dir = { x: (b.x - a.x) / length, z: (b.z - a.z) / length }
  const inward = { x: -dir.z, z: dir.x }
  const mesh = new Mesh3D({
    geometry: new CubeGeometry({ width: length, height, depth: thickness }),
    material: new PhongMaterial({ baseColor: options.color }),
  })
  // Turning by θ about +y takes local +x to (cos θ, −sin θ) and local +z to (sin θ, cos θ) on the plan: the wall's
  // direction and its inward normal.
  mesh.rotation.set(0, Math.atan2(-dir.z, dir.x), 0)
  mesh.position.set(
    (a.x + b.x) / 2 - (inward.x * thickness) / 2,
    height / 2,
    (a.z + b.z) / 2 - (inward.z * thickness) / 2,
  )
  return mesh
}

export function createOccluders(parent: Container3D): OccluderStage {
  const walls: { entry: WallEntry; wall: Mesh3D; trim: Mesh3D }[] = []
  const props: { entry: PropEntry; mesh: Mesh3D }[] = []
  const ceilings: Container3D[] = []
  // Registration happens in the `scene` hook, before the first frame; a later one starts the rule afresh.
  let pass: OccluderPass | undefined

  return {
    wall(options) {
      const thickness = options.thickness ?? WALL_THICKNESS
      const node = new Container3D()
      const wall = slab(options, options.height, thickness)
      const trim = slab(options, options.trim ?? TRIM_HEIGHT, thickness)
      trim.visible = false
      node.addChild(wall, trim)
      parent.addChild(node)
      const span = { a: options.a, b: options.b, height: options.height, thickness }
      walls.push({ entry: { span, occlude: options.occlude ?? 'cut' }, wall, trim })
      pass = undefined
      return node
    },
    ceiling(node) {
      ceilings.push(node)
    },
    prop(mesh, options) {
      props.push({
        entry: { bounds: options.bounds, occlude: propOcclude(options.bounds, options.occlude) },
        mesh,
      })
      pass = undefined
    },
    update(frame) {
      pass ??= occluderPass({ walls: walls.map((w) => w.entry), props: props.map((p) => p.entry) })
      const shown = pass.step(frame)
      walls.forEach(({ wall, trim }, i) => {
        const state = shown.walls[i]
        if (state === undefined) return
        showAt(wall, state.opacity)
        trim.visible = state.trim
      })
      props.forEach(({ mesh }, i) => {
        showAt(mesh, shown.props[i] ?? 1)
      })
      for (const ceiling of ceilings) ceiling.visible = false
    },
  }
}

export interface OccluderHookOptions {
  /** Metres from the player's feet to its head. */
  readonly height: number
  /** Default: the player's `prefers-reduced-motion`, read every frame. */
  readonly reducedMotion?: (() => boolean) | undefined
}

/** Stage hooks that run the rule each frame from what `rig` last wrote; nothing before its first `follow`. */
export function occluderHooks(
  rig: CameraRig,
  occluders: OccluderStage,
  options: OccluderHookOptions,
): PixiStageHooks {
  const isReduced = options.reducedMotion ?? (() => prefersReducedMotion())
  return {
    draw(frame) {
      const pose = rig.pose()
      if (pose === undefined) return
      const { eye, look, player } = pose
      occluders.update({
        eye,
        look,
        feet: player,
        head: { x: player.x, y: player.y + options.height, z: player.z },
        seconds: frame.frameMs / 1000,
        reduced: isReduced(),
      })
    },
  }
}
