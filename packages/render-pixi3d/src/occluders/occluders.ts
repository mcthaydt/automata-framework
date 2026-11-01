// The occluder rule on `@pixi/3d` (M3 spec §4.2): the static scenery a game registers in its `scene` hook, and the
// per-frame pass applied to it. Walls are built here, so each has its own material for its fade and a floor trim that
// shows while it is cut, as The Last Light's cut-away groups show their low stubs (`src/render/stage.ts` lines 168 to
// 171 and 887 to 891 at 92e6704). Ceilings are never drawn in the angled view. A prop fades through its material's
// alpha, so its mesh must own its material. Presentation only: the sim never reads any of it.
import type { PixiStageHooks } from '@mcthaydt/automata-render-pixi'
import type { Occlude } from '@mcthaydt/automata-sector-format'
import { reducedMotion as prefersReducedMotion } from '@mcthaydt/automata-ui'
import {
  type BaseMaterial3D,
  Container3D,
  CubeGeometry,
  type Geometry3D,
  Mesh3D,
  PhongMaterial,
} from '@pixi/3d'
import type { Texture } from 'pixi.js'
import type { CameraRig } from '../camera/angled-camera.js'
import { ownCopyOf } from '../views/shared-material.js'
import {
  type OccluderFrame,
  type OccluderPass,
  occluderPass,
  type PropEntry,
  type WallEntry,
  type WallShown,
} from './occluder-pass.js'
import { type Box3, type PlanPoint, propOcclude } from './occluder-rule.js'
import { tiledCube } from './tiled-cube.js'

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
  /**
   * A texture on the wall and its trim, repeating every `tile` metres on each face and tinted by `color`. Each then has
   * a cube of its own, freed by `dispose`. Without it the wall is plain `color`.
   */
  readonly surface?: { readonly texture: Texture; readonly tile: number } | undefined
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
  /**
   * Builds a lit box filling `bounds` under the view's root, with its own material: a floor, a ceiling, a pillar. It
   * follows no rule until it is registered as a `ceiling` or a `prop`.
   */
  box(bounds: Box3, color: number): Mesh3D
}

export interface OccluderStage extends Occluders {
  /** Applies one frame of the rule. */
  update(frame: OccluderFrame): void
  /** The next frame jumps to where the rule says, with no fade (a resync, a rebuilt renderer, a camera cut). */
  reset(): void
  /** Frees the unit cube the walls and boxes share and the materials made for faded props. */
  dispose(): void
}

export const WALL_THICKNESS = 0.2
export const TRIM_HEIGHT = 0.12

/**
 * Shows `mesh` at `opacity`: hidden at 0, blended below 1, opaque (writing depth) at 1. A mesh destroyed since it was
 * registered (its material gone) is skipped. A change of alpha mode asks the mesh to recheck its shadow, which
 * `@pixi/3d` does not do on its own (a blended mesh casts none).
 */
function showAt(mesh: Mesh3D, opacity: number): void {
  if (mesh.destroyed) return
  mesh.visible = opacity > 0
  const mode = opacity < 1 ? 'blend' : 'opaque'
  if (mesh.material.alphaMode !== mode) {
    mesh.material.alphaMode = mode
    mesh.updateShadow()
  }
  mesh.material.alpha = opacity
}

/** The unit cube scaled to a box `height` tall standing on the floor under `a → b`, its +z face on that line. */
function slab(
  cube: CubeGeometry | Geometry3D,
  options: WallOptions,
  height: number,
  thickness: number,
  texture?: Texture,
): Mesh3D {
  const { a, b } = options
  const length = Math.hypot(b.x - a.x, b.z - a.z)
  const dir = { x: (b.x - a.x) / length, z: (b.z - a.z) / length }
  const inward = { x: -dir.z, z: dir.x }
  const material = new PhongMaterial(
    texture === undefined
      ? { baseColor: options.color }
      : { baseColor: options.color, baseColorTexture: texture },
  )
  const mesh = new Mesh3D({ geometry: cube, material })
  mesh.scale.set(length, height, thickness)
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
  // Every wall, trim and box is this cube, scaled: one geometry for the whole room.
  const cube = new CubeGeometry({ width: 1, height: 1, depth: 1 })
  // The textured walls' own cubes (their UVs differ by size), freed with the shared one.
  const ownCubes: Geometry3D[] = []
  // The materials props fade through, so two props never fade one material; and the copies made for them.
  const fading = new WeakSet<BaseMaterial3D>()
  const copies: BaseMaterial3D[] = []
  // Registration happens in the `scene` hook, before the first frame; a later one starts the rule afresh.
  let pass: OccluderPass | undefined

  return {
    wall(options) {
      const { a, b } = options
      if (!(Math.hypot(b.x - a.x, b.z - a.z) > 0))
        throw new Error(`occluders.wall: a and b are the same point (${a.x}, ${a.z})`)
      const thickness = options.thickness ?? WALL_THICKNESS
      const node = new Container3D()
      const surface = options.surface
      const trimHeight = options.trim ?? TRIM_HEIGHT
      // A textured wall and its trim each get a cube whose UVs fit their own size.
      const cubeFor = (height: number): CubeGeometry | Geometry3D => {
        if (surface === undefined) return cube
        const own = tiledCube({ x: Math.hypot(b.x - a.x, b.z - a.z), y: height, z: thickness }, surface.tile)
        ownCubes.push(own)
        return own
      }
      const wall = slab(cubeFor(options.height), options, options.height, thickness, surface?.texture)
      const trim = slab(cubeFor(trimHeight), options, trimHeight, thickness, surface?.texture)
      trim.visible = false
      node.addChild(wall, trim)
      parent.addChild(node)
      const span = { a, b, height: options.height, thickness }
      walls.push({ entry: { span, occlude: options.occlude ?? 'cut' }, wall, trim })
      pass = undefined
      return node
    },
    ceiling(node) {
      ceilings.push(node)
    },
    prop(mesh, options) {
      // A shared material (a box view's, a loaded model's) is swapped for a copy of its own; one another prop already
      // fades cannot be told apart from this one's, so it is refused.
      const copy = ownCopyOf(mesh.material)
      if (copy !== undefined) {
        copies.push(copy)
        mesh.material = copy
      } else if (fading.has(mesh.material))
        throw new Error('occluders.prop: this mesh shares its material with another prop; give it its own')
      fading.add(mesh.material)
      props.push({
        entry: { bounds: options.bounds, occlude: propOcclude(options.bounds, options.occlude) },
        mesh,
      })
      pass = undefined
    },
    box(bounds, color) {
      const mesh = new Mesh3D({ geometry: cube, material: new PhongMaterial({ baseColor: color }) })
      const [min, max] = [bounds.min, bounds.max]
      mesh.scale.set(max[0] - min[0], max[1] - min[1], max[2] - min[2])
      mesh.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2)
      parent.addChild(mesh)
      return mesh
    },
    update(frame) {
      pass ??= occluderPass({ walls: walls.map((w) => w.entry), props: props.map((p) => p.entry) })
      const shown = pass.step(frame)
      for (let i = 0; i < walls.length; i++) {
        const { wall, trim } = walls[i] as (typeof walls)[number]
        const state = shown.walls[i] as WallShown
        showAt(wall, state.opacity)
        if (!trim.destroyed) trim.visible = state.trim
      }
      for (let i = 0; i < props.length; i++)
        showAt((props[i] as (typeof props)[number]).mesh, shown.props[i] ?? 1)
      for (const ceiling of ceilings) if (!ceiling.destroyed) ceiling.visible = false
    },
    reset() {
      pass?.reset()
    },
    dispose() {
      cube.destroy(true)
      for (const own of ownCubes) own.destroy(true)
      ownCubes.length = 0
      for (const copy of copies) copy.destroy()
      copies.length = 0
    },
  }
}

export interface OccluderHookOptions {
  /** Metres from the player's feet to its head: a positive, finite number. */
  readonly height: number
  /** Default: the player's `prefers-reduced-motion`, read every frame. */
  readonly reducedMotion?: (() => boolean) | undefined
}

/**
 * Stage hooks that run the rule each frame from what `rig` last wrote; nothing before its first `follow`. A resync, a
 * reset and a camera cut make the next frame jump instead of fading. The frame it hands the rule is rewritten each
 * frame (no allocation per frame).
 */
export function occluderHooks(
  rig: CameraRig,
  occluders: OccluderStage,
  options: OccluderHookOptions,
): PixiStageHooks {
  const { height } = options
  if (!(Number.isFinite(height) && height > 0))
    throw new Error(`occluders: the player's height must be a positive number of metres, not ${height}`)
  const isReduced = options.reducedMotion ?? (() => prefersReducedMotion())
  const head = { x: 0, y: 0, z: 0 }
  const frame = { eye: head, look: head, feet: head, head, seconds: 0, reduced: false }
  return {
    apply(result) {
      if (result.render.resync) occluders.reset()
    },
    draw(drawn) {
      const pose = rig.pose()
      if (pose === undefined) return
      if (pose.cut) occluders.reset()
      head.x = pose.player.x
      head.y = pose.player.y + height
      head.z = pose.player.z
      frame.eye = pose.eye
      frame.look = pose.look
      frame.feet = pose.player
      frame.seconds = drawn.frameMs / 1000
      frame.reduced = isReduced()
      occluders.update(frame)
    },
    reset() {
      occluders.reset()
    },
  }
}
