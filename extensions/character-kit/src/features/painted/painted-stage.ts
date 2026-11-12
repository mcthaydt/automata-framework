// The painted figures of one camera, drawn with per-texel depth under WebGL and WebGPU. One stage per camera (found by the `Camera3D` a view
// factory is handed, so a game writes nothing for it) places every figure by the stage contract (place.ts), sorts them far to
// near, and shows each cell on the builder's own depth-writing `CellSprite` in the AF `View3D`, so the figures and AF's
// meshes share one depth buffer and the builder's tie rule: strictly nearer wins, a tie goes to the later figure, and a
// figure wins a tie with geometry.
//
// It runs in `View3D.onRender`, which Pixi runs at the start of each render, after the draw hooks (the camera driver among
// them): so a figure is placed by the camera as it is drawn, not by last frame's. `onRender` is one slot, so the stage
// calls whatever was there first and puts it back when its last figure leaves.
import type { FigureShadow } from '@automataframework/3d'
import { type Camera3D, type Container3D, Matrix4, type View3D } from '@pixi/3d'
import { RendererType } from 'pixi.js'
import { type Cell, TIE_BIAS, texelDepths, type V3, type View } from '../../shared/figures/door.ts'
import { CellSprite, poseQuaternion } from '../../shared/figures/door-view.ts'
import { type Placed, type PlaceOptions, paintView, place, ranked } from './place.ts'
import { poseOf } from './pose.ts'
import { shadowInput } from './shadow-input.ts'

/** A figure on the stage: where it stands, and the cell it paints for the view the stage gives it. */
export interface StageMember {
  /** The entity's node. The quad is its child, so it is hidden with it, and goes with it when it is destroyed. */
  readonly node: Container3D
  /** How its cell is placed: the density it paints at and whether a texel is a whole number of pixels (whole pixels at density 2 by default). */
  readonly placing?: PlaceOptions | undefined
  /** The figure's cast shadow on the floor (the room's: `SceneLight.shadows`), cast each frame the figure is drawn; none without one. */
  readonly shadow?: FigureShadow | undefined
  /** Paints for this frame: `view` is the view the camera gives a figure at that place. */
  frame(view: (at: V3) => View): { cell: Cell; at: V3; name: string }
}

export interface PaintedStage {
  /** Puts a figure on the stage; its node must be in the scene (it names the `View3D`). */
  add(member: StageMember): { remove(): void }
  /** For tests: what was placed in the last frame, far to near (the rank is the index). */
  readonly placed: readonly Placed[]
  /** For tests: each figure's quad, in the order they were added. */
  readonly sprites: readonly CellSprite[]
}

interface Entry {
  readonly member: StageMember
  readonly quad: CellSprite
}

type OnRender = NonNullable<View3D['onRender']>

class Stage implements PaintedStage {
  placed: readonly Placed[] = []
  private entries: Entry[] = []
  private view: View3D | undefined
  private hook: OnRender | undefined
  private before: View3D['onRender'] = null
  /** The camera's projection, one matrix kept so a frame allocates none. */
  private readonly projection = new Matrix4()

  constructor(private readonly camera: Camera3D) {}

  get sprites(): readonly CellSprite[] {
    return this.entries.map((entry) => entry.quad)
  }

  add(member: StageMember): { remove(): void } {
    const view = member.node.view3d
    if (view === null) throw new Error('A painted figure must be in the scene before it goes on the stage.')
    const entry: Entry = { member, quad: new CellSprite(true) }
    member.node.addChild(entry.quad.sprite)
    this.entries.push(entry)
    if (this.hook === undefined) this.install(view)
    return { remove: () => this.remove(entry) }
  }

  private install(view: View3D): void {
    this.view = view
    this.before = view.onRender
    const hook: OnRender = (renderer) => {
      this.before?.(renderer)
      this.draw(view, renderer.type)
    }
    this.hook = hook
    view.onRender = hook
  }

  private remove(entry: Entry): void {
    const at = this.entries.indexOf(entry)
    if (at < 0) return
    this.entries.splice(at, 1)
    entry.quad.destroy()
    if (this.entries.length > 0 || this.view === undefined) return
    if (this.view.onRender === this.hook) this.view.onRender = this.before
    this.view = undefined
    this.hook = undefined
    this.placed = []
  }

  private draw(view: View3D, rendererType: number): void {
    const [w, h] = [view.width, view.height]
    const pose = poseOf(this.camera, [w, h])
    const turn = poseQuaternion(pose)
    const around = new Map<Placed, Entry>()
    const found: Placed[] = []
    for (const entry of this.entries) {
      const { node } = entry.member
      if (!shown(node)) {
        entry.member.shadow?.hide()
        continue
      }
      const { cell, at, name } = entry.member.frame((where) => paintView(pose, where))
      const placed = place(pose, at, cell, name, entry.member.placing)
      entry.quad.sprite.visible = placed !== undefined
      if (placed === undefined) {
        entry.member.shadow?.hide()
        continue
      }
      // The shadow is the floor's, not the quad's: it is cast from the cell and where the figure stands.
      entry.member.shadow?.cast(shadowInput(cell, at, pose.right))
      around.set(placed, entry)
      found.push(placed)
    }
    const order = ranked(found)
    const matrix = this.camera.computeProjection(w / h, this.projection).elements
    order.forEach((placed, rank) => {
      const entry = around.get(placed) as Entry
      const { sprite } = entry.quad
      const { node } = entry.member
      // Before the quad's shader compiles: which renderer draws it decides its template and its depth texture.
      entry.quad.gpu(rendererType === RendererType.WEBGPU) // under it a depth-writing quad compiles from the builder's own template
      entry.quad.show(placed.sprite.cell)
      entry.quad.showDepths(
        texelDepths(pose, placed.sprite),
        pose.f !== undefined,
        matrix[10] ?? 0,
        matrix[14] ?? 0,
        (rank + 1) * TIE_BIAS,
      )
      // The quad is the node's child: its place is the contract's world place less the node's own, and it is turned to the
      // camera in the world (the node itself is never turned).
      sprite.position.set(
        placed.position[0] - node.position.x,
        placed.position[1] - node.position.y,
        placed.position[2] - node.position.z,
      )
      sprite.quaternion.copyFrom(turn)
      sprite.pixelSize = placed.pixelSize
    })
    this.placed = order
  }
}

/** Whether the node and everything above it is visible, and it is still in a scene. */
function shown(node: Container3D): boolean {
  if (node.view3d === null) return false
  for (let up: { visible: boolean; parent: unknown } | null = node; up; up = up.parent as typeof up) {
    if (!up.visible) return false
  }
  return true
}

const stages = new WeakMap<Camera3D, Stage>()

/** The stage for `camera`'s painted figures: made on first use, kept while the camera lives. */
export function stageFor(camera: Camera3D): PaintedStage {
  let stage = stages.get(camera)
  if (stage === undefined) {
    stage = new Stage(camera)
    stages.set(camera, stage)
  }
  return stage
}
