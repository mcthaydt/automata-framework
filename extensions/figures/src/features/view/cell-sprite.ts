import { FlatMaterial, type ShaderBit, type ShaderDescriptor, Sprite3D, type View3D } from '@pixi/3d'
import { BufferImageSource, Texture } from 'pixi.js'
import type { Cell } from '../../shared/stage/cell'
import { CELL_TEMPLATE } from './cell-template'

/**
 * A painted `Cell` on a Pixi 3D quad: its texture is the cell's own `rgba`, nearest neighbour, non-premultiplied, cut
 * at alpha by `alphaMode: 'mask'` (a texel is wholly there or not), so the quad shows the painter's texels and no
 * colour the cell does not hold. The texture is re-uploaded only when `cell.key` changes and rebuilt when the cell's
 * size does. The caller places the quad: `sprite.position`, `sprite.quaternion` and `sprite.pixelSize` (the scene's
 * metres to one texel); the anchor is the cell's root texel.
 *
 * With `depth: true` the quad writes a depth per texel (a `StageView`'s: figures hide behind scene geometry and behind
 * each other texel by texel). Its fragment shader sets the fragment depth (`gl_FragDepth` under WebGL, `@builtin(frag_depth)`
 * under WebGPU) from a second, float texture of the camera-space depth of every texel (`texelDepths`, set by `showDepths`)
 * through the camera's own projection.
 */

/** The fragment shader bit of a depth-writing quad: reads the texel's depth along the view (metres) from the `cellDepth`
 * texture and writes the window depth the camera's projection gives it: with `depthProj = (perspective ? 1 : 0, P22,
 * P32, bias)` for the camera's projection P (its elements 10 and 14), `z_ndc = −P22 + P32 / d` (perspective) or `−P22 · d + P32` (orthographic),
 * window depth `z_ndc / 2 + 0.5` (OpenGL's clip space, the depth range its default). The depth is first moved `bias`
 * metres nearer (`TIE_BIAS` times the sprite's place in the frame, from 1: stage.ts), the rule `compose` tests with, so the
 * tie goes the same way on both sides whatever the camera's range; the depth test is `LESS`. Under WebGPU the same
 * arithmetic is WGSL, and the shader's entry point returns the depth (`CELL_TEMPLATE`: a bit alone cannot, the entry's
 * return type has to change). */
const cellDepthBit: ShaderBit = {
  name: 'cellDepth',
  textures: ['cellDepth'],
  // `texSize`: the cell's width and height in texels (`CELL_TEMPLATE` snaps the texture coordinate to a texel's centre with it).
  bindings: { material: { depthProj: 'vec4<f32>', texSize: 'vec4<f32>' } },
  gl: {
    fragment: {
      material: `
  float cellD = sampleCellDepth(vUV).r - material.depthProj.w;
  float zNdc = material.depthProj.x > 0.5 ? (-material.depthProj.y + material.depthProj.z / cellD) : (-material.depthProj.y * cellD + material.depthProj.z);
  gl_FragDepth = zNdc * 0.5 + 0.5;
`,
    },
  },
  gpu: {
    fragment: {
      material: `
  // The depths arrive as the float's own four bytes in an rgba8unorm texture (CellSprite.gpu): WebGPU's material layout binds
  // every texture as filterable float, which r32float is not. Nearest filtering and a round trip through unorm bytes are exact.
  // The bytes are the host's own, as a Float32Array lays them, and are read little-endian here: every WebGPU platform is.
  let packed = sampleCellDepth(input.vUV);
  let bits = u32(packed.r * 255.0 + 0.5) | (u32(packed.g * 255.0 + 0.5) << 8u) | (u32(packed.b * 255.0 + 0.5) << 16u) | (u32(packed.a * 255.0 + 0.5) << 24u);
  let cellD = bitcast<f32>(bits) - material.depthProj.w;
  let zNdc = select(-material.depthProj.y * cellD + material.depthProj.z, -material.depthProj.y + material.depthProj.z / cellD, material.depthProj.x > 0.5);
  // Window depth, as under WebGL: the projection StageView passes holds −1…1 clip depth, and WebGPU's 0…1 is that halved and
  // shifted. Both formulas were tried at the spike; this one makes view-check's wall and overlap cases 0 pixels from compose.
  cellDepth = zNdc * 0.5 + 0.5;
`,
    },
  },
}

/** A flat material that, under WebGPU, compiles from `CELL_TEMPLATE` so its fragment entry can return a depth. The template has
 * no GLSL stage, so it is set only once the renderer is known to be WebGPU (`CellSprite.gpu`); under WebGL the material is a
 * plain flat one and the bit's GLSL writes `gl_FragDepth`. */
class CellMaterial extends FlatMaterial {
  /** Whether the renderer drawing this material is WebGPU. */
  webgpu = false
  override getPrimaryDescriptor(view: View3D): ShaderDescriptor {
    const d = super.getPrimaryDescriptor(view),
      want = this.webgpu ? CELL_TEMPLATE : undefined
    // `super` rebuilds the descriptor (template and all) whenever the material's variant changes, so this checks every call.
    if (d.template !== want) d.update({ bitsGpu: d.bitsGpu, bitsGl: d.bitsGl, template: want })
    return d
  }
}

export class CellSprite {
  readonly sprite: Sprite3D
  private colour: BufferImageSource | null = null
  private depthSource: BufferImageSource | null = null
  /** The last depths shown, kept to re-upload when the renderer turns out to be WebGPU (and its depth texture is rebuilt). */
  private depths: Float32Array | null = null
  /** Whether the depths go up as raw float bytes in an rgba8 texture (WebGPU) rather than as an r32float texture (WebGL). */
  private packed = false
  private material: CellMaterial | null = null
  private key = ''
  private size = ''

  /** `depth`: write the per-texel depth (needs `showDepths` each frame). */
  constructor(private readonly depth = false) {
    this.sprite = depth
      ? new Sprite3D({
          material: this.makeMaterial(Texture.EMPTY, Texture.EMPTY),
          billboardMode: 'none',
          label: 'CellSprite',
        })
      : new Sprite3D({
          texture: Texture.EMPTY,
          billboardMode: 'none',
          alphaMode: 'mask',
          label: 'CellSprite',
        })
  }

  private makeMaterial(base: Texture, depth: Texture): CellMaterial {
    return (this.material = new CellMaterial({
      baseColorTexture: base,
      alphaMode: 'mask',
      extraBits: [cellDepthBit],
      textures: { cellDepth: depth },
    }))
  }

  /** Shows `cell`: uploads its texels when they may have changed. The texture reads the cell's own buffer when the
   * renderer next draws, so render before the figure's next draw (`StageView` copies nothing and draws every frame). */
  show(cell: Cell): void {
    const [w, h] = cell.size,
      size = `${w}x${h}`
    if (size !== this.size) {
      this.destroySources()
      this.colour = new BufferImageSource({
        resource: new Uint8Array(w * h * 4),
        width: w,
        height: h,
        format: 'rgba8unorm',
        scaleMode: 'nearest',
        alphaMode: 'no-premultiply-alpha',
      })
      const tex = new Texture({ source: this.colour })
      if (this.depth) {
        this.makeDepthTexture(w, h)
        this.material!.data.texSize = [w, h, 0, 0]
      }
      this.sprite.texture = tex
      this.size = size
      this.key = ''
    }
    this.sprite.anchor = { x: cell.anchor[0] / w, y: cell.anchor[1] / h }
    if (cell.key === this.key) return
    this.colour!.resource = new Uint8Array(cell.rgba.buffer, cell.rgba.byteOffset, cell.rgba.byteLength)
    this.colour!.update()
    this.key = cell.key
  }

  /** The depth texture in the form the renderer reads: `r32float` under WebGL; under WebGPU the float's own four bytes in an
   * `rgba8unorm` one (see `cellDepthBit`). */
  private makeDepthTexture(w: number, h: number): void {
    const resource = this.packed ? new Uint8Array(w * h * 4) : new Float32Array(w * h)
    this.depthSource = new BufferImageSource({
      resource,
      width: w,
      height: h,
      format: this.packed ? 'rgba8unorm' : 'r32float',
      scaleMode: 'nearest',
      alphaMode: 'no-premultiply-alpha',
    })
    this.material!.textures.cellDepth = new Texture({ source: this.depthSource })
  }

  /** Tells a depth-writing quad which renderer draws it (call before its first render): under WebGPU it compiles from the template
   * that returns a depth, and its depth texture is rebuilt in the form WebGPU reads. A quad made without depth has nothing to switch. */
  gpu(webgpu: boolean): void {
    if (!this.material) return
    this.material.webgpu = webgpu
    if (webgpu === this.packed) return
    this.packed = webgpu
    if (!this.depthSource) return
    const [w, h] = [this.depthSource.width, this.depthSource.height]
    this.material.textures.cellDepth!.destroy(true)
    this.makeDepthTexture(w, h)
    if (this.depths) this.uploadDepths(this.depths)
  }

  /** Uploads the texels' camera-space depths (`texelDepths`, `Infinity` where empty) and the projection they are written
   * through: `perspective`, and the camera's projection matrix elements 10 and 14 (`Matrix4.elements`); `bias` is metres
   * to take off every depth (`(rank + 1) · TIE_BIAS`), which breaks a tie in the later sprite's favour. Call after `show`. */
  showDepths(depths: Float32Array, perspective: boolean, p22: number, p32: number, bias: number): void {
    if (!this.depth) throw new Error('CellSprite: not made with depth')
    this.depths = depths
    this.uploadDepths(depths)
    this.material!.data.depthProj = [perspective ? 1 : 0, p22, p32, bias]
  }

  private uploadDepths(depths: Float32Array): void {
    this.depthSource!.resource = this.packed
      ? new Uint8Array(depths.buffer, depths.byteOffset, depths.byteLength)
      : depths
    this.depthSource!.update()
  }

  private destroySources(): void {
    if (!this.colour) return
    if (this.depth) {
      this.material!.textures.baseColor!.destroy(true)
      this.material!.textures.cellDepth!.destroy(true)
    } else this.sprite.texture.destroy(true)
    this.colour = null
    this.depthSource = null
    this.depths = null
  }

  destroy(): void {
    this.sprite.destroy({ texture: !this.depth, textureSource: !this.depth })
    this.destroySources()
    this.material?.destroy()
  }
}
