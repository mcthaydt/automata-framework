// A figure's cast shadow drawn on the floor: one flat quad lying on the floor under the figure, textured with the cells
// `castShadow` marked (figure-shadow.ts), in the room's own 3D pass. It is black at `1 − figureShadow` opacity, so where it
// lies the floor's light is multiplied by `figureShadow` (the builder's 0.6), and the look's snap, which comes after, cuts the
// product into whole DUEL steps: a shadow is the floor one or two steps down, never a smooth grey. Light that is not on the
// floor does not reach it: the quad is lit by nothing, tested against the scene's depth like any mesh, and the marks stop where
// the floor does, so it never climbs a wall or hangs past a floor's edge.
//
// One shadow per figure, a child of the figure's node: the node stands at the feet and is neither turned nor scaled.
import { Box, Container3D, FlatMaterial, Geometry3D, Mesh3D, Vector3 } from '@pixi/3d'
import { BufferImageSource, Texture } from 'pixi.js'
import {
  castShadow,
  type FigureShadow,
  type FigureShadowInput,
  type FigureShadows,
  type ShadowMark,
} from '../../shared/render/light/figure-shadow.ts'
import type { SceneLighting } from '../../shared/render/light/scene-lighting.schema.ts'

/** How far over the floor the quad lies, in metres: enough that the floor's own depth does not fight it. */
const LIFT = 0.012
/** The texture's side in cells, from the smallest that holds the grid: a figure that walks into a longer shadow grows it. */
const SIDES = [64, 128, 256] as const

/** The room's shadows for `lighting`: the sun when it casts, its up-facing planes for floors. */
export function createFigureShadows(lighting: SceneLighting, strength: number): FigureShadows {
  const sun = lighting.sun?.shadow === true ? lighting.sun.dir : undefined
  const floors = lighting.planes
  return {
    strength,
    add(parent) {
      return new Shadow(parent, sun, floors, 1 - strength)
    },
  }
}

class Shadow implements FigureShadow {
  mark: ShadowMark | undefined
  private readonly node = new Container3D()
  private readonly geometry = unitQuad()
  private material: FlatMaterial | undefined
  private mesh: Mesh3D | undefined
  private pixels: Uint8Array | undefined
  private texture: Texture | undefined
  private side = 0
  /** What the cells were made for: the cell's key and where the figure stands and faces, so a still figure is cast once. */
  private made = ''

  constructor(
    parent: Container3D,
    private readonly sun: readonly [number, number, number] | undefined,
    private readonly floors: SceneLighting['planes'],
    private readonly opacity: number,
  ) {
    parent.addChild(this.node)
  }

  cast(input: FigureShadowInput): void {
    const { silhouette: s, at, right } = input
    const key = `${s.key ?? ''}|${at.join(',')}|${right.join(',')}`
    if (s.key === undefined || key !== this.made) {
      const mark = castShadow({ ...input, sun: this.sun }, this.floors)
      this.mark = mark
      this.made = key
      if (mark.count === 0) {
        this.hide()
        return
      }
      this.upload(mark)
      this.place(mark)
    }
    if (this.mesh !== undefined) this.mesh.visible = (this.mark?.count ?? 0) > 0
  }

  hide(): void {
    if (this.mesh !== undefined) this.mesh.visible = false
  }

  /** The marks as a texture of black cells, opaque where marked. */
  private upload(mark: ShadowMark): void {
    const need = Math.max(mark.width, mark.height)
    const side = SIDES.find((n) => n >= need) ?? SIDES[SIDES.length - 1] ?? 256
    if (this.texture === undefined || side !== this.side) {
      this.material?.destroy()
      this.texture?.destroy(true)
      this.side = side
      this.pixels = new Uint8Array(side * side * 4)
      this.texture = new Texture({
        source: new BufferImageSource({
          resource: this.pixels,
          width: side,
          height: side,
          format: 'rgba8unorm',
          scaleMode: 'nearest',
          autoGenerateMipmaps: false,
        }),
      })
      // Black, at `opacity` where the texture is opaque. Fog would tint it toward the fog's colour and lighten the floor.
      this.material = new FlatMaterial({
        baseColor: 0x000000,
        baseColorTexture: this.texture,
        alpha: this.opacity,
        alphaMode: 'blend',
        doubleSided: true,
        fog: false,
      })
      // The mesh is made with its material (the first cells), and takes a new one when the texture grows.
      if (this.mesh === undefined) {
        this.mesh = new Mesh3D({ geometry: this.geometry, material: this.material })
        this.node.addChild(this.mesh)
      } else this.mesh.material = this.material
    }
    const pixels = this.pixels as Uint8Array
    pixels.fill(0)
    for (let j = 0; j < mark.height; j++)
      for (let i = 0; i < mark.width; i++)
        if (mark.marks[j * mark.width + i] === 1) pixels[(j * side + i) * 4 + 3] = 255
    this.texture.source.update()
  }

  /** Lays the unit quad over the grid: scaled to its cells, turned to run along the figure's right, at its near corner. */
  private place(mark: ShadowMark): void {
    const { texel, width, height, right, toward } = mark
    const { mesh, side } = this
    if (mesh === undefined) return
    // The quad's UVs span the grid's cells only: the rest of the texture is empty.
    const uv = this.geometry.attributes.aUV?.buffer
    if (uv !== undefined) {
      const data = uv.data as Float32Array
      const u = width / side
      const v = height / side
      data.set([0, 0, u, 0, u, v, 0, v])
      uv.update()
    }
    mesh.position.set(
      mark.originRight * right[0] + mark.originToward * toward[0],
      LIFT,
      mark.originRight * right[1] + mark.originToward * toward[1],
    )
    mesh.scale.set(width * texel, 1, height * texel)
    // Local +x runs along the right and local +z toward the camera: a turn about +y by −atan2(right.z, right.x).
    mesh.rotation.set(0, -Math.atan2(right[1], right[0]), 0)
  }

  destroy(): void {
    this.node.destroy({ children: true })
    this.geometry.destroy(true)
    this.material?.destroy()
    this.texture?.destroy(true)
  }
}

/** A flat quad over [0, 1] × [0, 1] in x and z, facing up, its UVs written when it is placed. */
function unitQuad(): Geometry3D {
  return new Geometry3D({
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint16Array([0, 2, 1, 0, 3, 2]),
    bounds3D: new Box(new Vector3(0, -0.01, 0), new Vector3(1, 0.01, 1)),
    dynamic: true,
  })
}
