// Draws painted cells into the scene: one quad a cell at whole field pixels, one texel to one pixel, each texel at its
// own depth so the hardware depth test hides a figure's legs behind a table. A `Pass3D` at the `afterTransparent`
// stage, so it draws over the opaque world and a wall the occluders have faded never covers a figure.
//
// It writes straight colour with blending off (a blended write would mix the world into the figure and its alpha
// code) and the *painted* alpha code, which the snap passes through. Quads are placed by the bound camera's own
// projection: the graph binds a scene target with a y flip that differs by backend, and the projection's y sign is that
// flip, so a cell lands upright on both.
//
// A cell's depth is metres toward the camera from its root, packed in two 8-bit channels (alpha-codes.ts); a texel's
// view depth is `rootDepth - depth`.

import {
  type GraphRenderPass,
  getCameraData,
  Pass3D,
  type PassBuilder,
  type PassContext,
  type RenderGraph,
  RenderPass,
  RenderPassBit,
  type RenderSession,
  type ShaderBit,
  type ShaderBitTemplate,
} from '@pixi/3d'
import {
  BindGroup,
  Buffer,
  BufferImageSource,
  BufferUsage,
  Geometry,
  State,
  Texture,
  UniformGroup,
} from 'pixi.js'
import { alphaCodeGlsl, alphaCodeWgsl } from '../../../shared/render/alpha/alpha-codes.ts'

/** A finished cell standing at a place in the field. */
export interface PlacedCell {
  /** The cell's colours, straight (unpremultiplied) RGBA; alpha under the painter's cut is discarded. */
  readonly colours: Texture
  /** The cell's depth, `rgba8unorm`: metres packed 16-bit into `r` (high) and `g` (low). */
  readonly depth: Texture
  /** The cell's top-left texel in its textures, so cells and particles can share an atlas. */
  readonly source: readonly [number, number]
  /** The top-left field pixel, a whole number counted from the top on both backends. */
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** The root's depth in metres from the camera along its view axis. */
  readonly rootDepth: number
}

/** The painter's alpha cut: a texel under it is empty. */
const CUT = 0.5

const FLOATS_PER_VERTEX = 5
const VERTEX_STRIDE = FLOATS_PER_VERTEX * 4

const BIT: ShaderBit = {
  name: 'cellComposite',
  attributes: { aPixel: 'float32x2', aTexel: 'float32x2', aRoot: 'float32' },
  interStage: { vTexel: 'vec2<f32>', vRoot: 'f32' },
  bindings: {
    cell: {
      uField: 'vec4<f32>',
      uColours: 'texture_2d<f32>',
      uColoursSampler: 'sampler',
      uDepth: 'texture_2d<f32>',
      uDepthSampler: 'sampler',
    },
  },
  gpu: {
    header: `
${alphaCodeWgsl()}
struct CellOut {
  @location(0) colour: vec4<f32>,
  @builtin(frag_depth) depth: f32,
}`,
  },
  gl: { header: alphaCodeGlsl() },
}

const TEMPLATE: ShaderBitTemplate = {
  bindGroups: ['global', 'camera', 'cell'],
  gpu: `
{{header}}

@vertex
fn mainVertex(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let flipY = sign(camera.uProjectionMatrix[1][1]);
  let ndc = vec2<f32>(input.aPixel.x / cell.uField.x * 2.0 - 1.0, flipY * (1.0 - input.aPixel.y / cell.uField.y * 2.0));
  output.position = vec4<f32>(ndc, 0.0, 1.0);
  output.vTexel = input.aTexel;
  output.vRoot = input.aRoot;
  return output;
}

@fragment
fn mainFragment(input: FragmentInput) -> CellOut {
  let at = vec2<i32>(floor(input.vTexel));
  let c = textureLoad(uColours, at, 0);
  if (c.a < ${CUT.toFixed(2)}) { discard; }
  let d = unpackCellDepth(textureLoad(uDepth, at, 0).rg);
  let view = input.vRoot - d;
  let p = camera.uProjectionMatrix;
  let z = p[2][2] * -view + p[3][2];
  let w = p[2][3] * -view + p[3][3];
  var out: CellOut;
  out.colour = vec4<f32>(c.rgb, ALPHA_PAINTED);
  out.depth = z / w;
  return out;
}
`,
  gl: {
    vertex: `#version 300 es

{{header}}

void main() {
  float flipY = sign(uProjectionMatrix[1][1]);
  vec2 ndc = vec2(aPixel.x / uField.x * 2.0 - 1.0, flipY * (1.0 - aPixel.y / uField.y * 2.0));
  vTexel = aTexel;
  vRoot = aRoot;
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`,
    fragment: `#version 300 es

{{header}}

out vec4 fragColor;

void main() {
  ivec2 at = ivec2(floor(vTexel));
  vec4 c = texelFetch(uColours, at, 0);
  if (c.a < ${CUT.toFixed(2)}) discard;
  float d = unpackCellDepth(texelFetch(uDepth, at, 0).rg);
  float view = vRoot - d;
  float z = uProjectionMatrix[2][2] * -view + uProjectionMatrix[3][2];
  float w = uProjectionMatrix[2][3] * -view + uProjectionMatrix[3][3];
  gl_FragDepth = z / w * 0.5 + 0.5;
  fragColor = vec4(c.rgb, ALPHA_PAINTED);
}
`,
  },
}

/** A cell texture from raw RGBA bytes: nearest, no mipmaps, unpremultiplied (the cell's colours are straight). */
export function cellTexture(rgba: Uint8Array, width: number, height: number): Texture {
  return new Texture({
    source: new BufferImageSource({
      resource: rgba,
      width,
      height,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'nearest',
      autoGenerateMipmaps: false,
    }),
  })
}

/** The graph pass: draws the cells the owner was last shown. */
class CellDrawPass extends RenderPass implements GraphRenderPass {
  private readonly _owner: CellCompositePass
  private readonly _state: State
  private readonly _field = new Float32Array(4)
  private readonly _uniforms = new UniformGroup({ uField: { value: this._field, type: 'vec4<f32>' } })
  private readonly _groups = new WeakMap<Texture, BindGroup>()
  private _shader: ReturnType<RenderPass['pipe']['renderer']['material3d']['compilePassShader']> | null = null
  private _geometry: Geometry | null = null
  private _vertices: Buffer | null = null
  private _store = new Float32Array(0)
  private _capacity = 0
  private _destroyed = false

  constructor(renderer: PassContext['renderer'], owner: CellCompositePass) {
    super({ renderer, name: 'cell-composite', bit: RenderPassBit.NONE })
    this._owner = owner
    const state = new State()
    state.depthTest = true
    state.depthMask = true
    state.culling = false
    state.blend = false
    this._state = state
  }

  override setup(b: PassBuilder): void {
    b.writeColor(b.targetColor)
    b.writeDepth(b.targetDepth)
  }

  override condition(): boolean {
    return this._owner.cells.length > 0
  }

  override render(session: RenderSession): void {
    const cells = this._owner.cells
    if (cells.length === 0) return
    if (!this._shader) {
      this._shader = this.pipe.renderer.material3d.compilePassShader([BIT], TEMPLATE)
    }
    this._grow(cells.length)
    // Cells that share a texture draw in one call: order them by texture, keep each run's first quad.
    const runs = this._write(cells)
    this._field[0] = session.activeViewport.width
    this._field[1] = session.activeViewport.height
    this._uniforms.update()
    const shader = this._shader
    shader.groups[0] = session.globalBindGroup
    shader.groups[1] = getCameraData(session.view3d.camera).bindGroup
    for (const run of runs) {
      shader.groups[2] = this._groupFor(run.colours, run.depth)
      this.pipe.renderer.encoder.draw({
        geometry: this._geometry as Geometry,
        shader,
        state: this._state,
        size: run.quads * 6,
        start: run.first * 6,
      })
    }
  }

  private _grow(quads: number): void {
    if (quads <= this._capacity && this._geometry) return
    this._capacity = Math.max(quads, this._capacity * 2, 16)
    this._geometry?.destroy(true)
    this._store = new Float32Array(this._capacity * 4 * FLOATS_PER_VERTEX)
    this._vertices = new Buffer({
      data: this._store,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
      shrinkToFit: false,
    })
    const indices = new Uint32Array(this._capacity * 6)
    for (let q = 0; q < this._capacity; q++) {
      const v = q * 4
      indices.set([v, v + 1, v + 2, v, v + 2, v + 3], q * 6)
    }
    const buffer = this._vertices
    this._geometry = new Geometry({
      attributes: {
        aPixel: { buffer, format: 'float32x2', stride: VERTEX_STRIDE, offset: 0 },
        aTexel: { buffer, format: 'float32x2', stride: VERTEX_STRIDE, offset: 8 },
        aRoot: { buffer, format: 'float32', stride: VERTEX_STRIDE, offset: 16 },
      },
      indexBuffer: indices,
    })
  }

  /** Fills the vertex store with the cells grouped by texture; returns each group's range. */
  private _write(
    cells: readonly PlacedCell[],
  ): { colours: Texture; depth: Texture; first: number; quads: number }[] {
    const order = new Map<Texture, PlacedCell[]>()
    for (const cell of cells) {
      const list = order.get(cell.colours)
      if (list) list.push(cell)
      else order.set(cell.colours, [cell])
    }
    const runs: { colours: Texture; depth: Texture; first: number; quads: number }[] = []
    let quad = 0
    for (const [colours, list] of order) {
      // Cells of one colour texture share its depth texture (they are cut from one atlas).
      const depth = (list[0] as PlacedCell).depth
      const first = quad
      for (const cell of list) {
        const o = quad * 4 * FLOATS_PER_VERTEX
        const [sx, sy] = cell.source
        const corners = [
          [cell.x, cell.y, sx, sy],
          [cell.x + cell.width, cell.y, sx + cell.width, sy],
          [cell.x + cell.width, cell.y + cell.height, sx + cell.width, sy + cell.height],
          [cell.x, cell.y + cell.height, sx, sy + cell.height],
        ]
        for (const [i, c] of corners.entries()) {
          this._store.set(
            [c[0] as number, c[1] as number, c[2] as number, c[3] as number, cell.rootDepth],
            o + i * FLOATS_PER_VERTEX,
          )
        }
        quad++
      }
      runs.push({ colours, depth, first, quads: quad - first })
    }
    ;(this._vertices as Buffer).update(quad * 4 * VERTEX_STRIDE)
    return runs
  }

  private _groupFor(colours: Texture, depth: Texture): BindGroup {
    let group = this._groups.get(colours)
    if (!group) {
      group = new BindGroup({
        0: this._uniforms,
        1: colours.source,
        2: colours.source.style,
        3: depth.source,
        4: depth.source.style,
      })
      this._groups.set(colours, group)
    } else {
      group.setResource(depth.source, 3)
      group.setResource(depth.source.style, 4)
    }
    return group
  }

  override destroy(): void {
    if (this._destroyed) return
    this._destroyed = true
    this._shader?.destroy()
    this._shader = null
    this._geometry?.destroy(true)
    this._geometry = null
  }
}

/**
 * Composites painted cells into the scene. `show` replaces the cells drawn each frame; an empty list draws nothing.
 * The pass survives graph rebuilds, as every `Pass3D`; call `destroy` when it is retired.
 */
export class CellCompositePass extends Pass3D {
  readonly stage = 'afterTransparent' as const
  private _cells: readonly PlacedCell[] = []

  get cells(): readonly PlacedCell[] {
    return this._cells
  }

  show(cells: readonly PlacedCell[]): void {
    this._cells = cells
  }

  build(graph: RenderGraph, ctx: PassContext): void {
    graph.addPass(new CellDrawPass(ctx.renderer, this))
  }
}
