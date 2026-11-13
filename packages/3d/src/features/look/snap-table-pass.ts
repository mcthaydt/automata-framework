// One full-screen draw of an `effect(uv)` fragment that reads the chain's colour and one more texture, the snap's candidate
// table. `FullscreenPass` reads graph resources only, and `RenderGraph` takes a transient for a read, so a table that is made
// once on the CPU and uploaded once has no way in through it. This pass is `FullscreenPass` with that one difference: the same
// header, the same read bits and the same draw, and the table's texture bound from a source the effect owns. It reads no depth
// (`present-pass.ts`), and its slot order (the uniform block, the colour, then the table) is the one `FullscreenPass` gives
// a pass with `reads.color` and `reads.color2`, since both compile through the same read bits.

import {
  type ColorHandle,
  color2ReadBit,
  colorReadBit,
  createOutputState,
  type EffectFragment,
  fullscreenEffectTemplate,
  fullscreenTriangleGeometry,
  fxhBit,
  getCameraData,
  type PassBuilder,
  RenderPass,
  RenderPassBit,
  type RenderSession,
  type ShaderBit,
} from '@pixi/3d'
import {
  BindGroup,
  type Shader,
  State,
  Texture,
  type TextureSource,
  TextureStyle,
  UniformGroup,
  type WebGLRenderer,
  type WebGPURenderer,
} from 'pixi.js'

export interface TableSnapPassOptions {
  readonly renderer: WebGLRenderer | WebGPURenderer
  readonly label: string
  readonly fragment: EffectFragment
  /** The fragment's uniforms (`uDither`, `uGroups`), reached as `fx.<name>` in WGSL and `<name>` in GLSL. */
  readonly uniforms: UniformGroup
  /** The chain image to snap. */
  readonly input: ColorHandle
  /** Where the result lands, or `null` to present to the canvas. */
  readonly writes: ColorHandle | null
  /** The table's texture for this frame: read with `sampleColor2`, nearest-sampled and not blended. */
  readonly table: () => TextureSource
}

/** The fragment's shader bit: its uniforms, as the `fx` group declares them, and its code. */
function fragmentBit(fragment: EffectFragment, uniforms: UniformGroup): ShaderBit {
  const fx: Record<string, string> = {}
  for (const [name, structure] of Object.entries(
    uniforms.uniformStructures as Record<string, { type: string }>,
  ))
    fx[name] = structure.type
  return {
    name: 'effectFragment:duelSnap',
    bindings: { fx },
    gpu: { header: fragment.gpu },
    gl: { header: fragment.gl },
  } as unknown as ShaderBit
}

const FULL = [0, 0, 1, 1]

export class TableSnapPass extends RenderPass {
  /** What the pass reads: the chain's colour and its table, and never the scene's depth. */
  readonly reads: readonly ('color' | 'table')[] = ['color', 'table']
  readonly #options: TableSnapPassOptions
  readonly #isWebGL: boolean
  readonly #state: State
  readonly #fx: BindGroup
  readonly #fxh: BindGroup
  readonly #header: UniformGroup
  #shader: Shader | null = null

  constructor(options: TableSnapPassOptions) {
    super({ renderer: options.renderer, name: options.label, bit: RenderPassBit.NONE })
    this.#options = options
    this.#isWebGL = 'gl' in options.renderer
    if (options.writes === null) this.#state = createOutputState()
    else {
      this.#state = new State()
      this.#state.depthTest = false
      this.#state.depthMask = false
      this.#state.culling = false
      this.#state.blend = false
    }
    // Slot 0 the uniforms, then a texture and a sampler for the colour and for the table, as `createFxBindings` lays them out.
    const sampler = (): TextureStyle =>
      new TextureStyle({ scaleMode: 'nearest', addressMode: 'clamp-to-edge' })
    this.#fx = new BindGroup({
      0: options.uniforms,
      1: Texture.WHITE.source,
      2: new TextureStyle({ scaleMode: 'linear', addressMode: 'clamp-to-edge' }),
      3: Texture.WHITE.source,
      4: sampler(),
    })
    this.#header = new UniformGroup({
      uFxClip: { value: new Float32Array(4), type: 'vec4<f32>' },
      uFxTexel: { value: new Float32Array(4), type: 'vec4<f32>' },
      uFxInputClamp: { value: new Float32Array(FULL), type: 'vec4<f32>' },
      uFxInput2Clamp: { value: new Float32Array(FULL), type: 'vec4<f32>' },
    })
    this.#fxh = new BindGroup({ 0: this.#header })
  }

  override setup(builder: PassBuilder): void {
    builder.read(this.#options.input)
    if (this.#options.writes) builder.writeColor(this.#options.writes)
    else {
      builder.writeColor(builder.defaultColor)
      builder.writeDepth(builder.defaultDepth)
    }
  }

  override render(session: RenderSession): void {
    if (!this.#shader) {
      const bits = [
        fxhBit,
        colorReadBit,
        color2ReadBit,
        fragmentBit(this.#options.fragment, this.#options.uniforms),
      ]
      this.#shader = this.pipe.renderer.material3d.compilePassShader(bits, fullscreenEffectTemplate)
    }
    const graph = session.view3d._graph
    const camera = session.view3d.camera
    const uniforms = this.#header.uniforms as Record<string, Float32Array>
    const clip = uniforms.uFxClip as Float32Array
    const proj = camera.projection.elements
    clip[0] = camera.near
    clip[1] = camera.far
    clip[2] = proj[0] as number
    clip[3] = proj[5] as number
    const texel = uniforms.uFxTexel as Float32Array
    texel[0] = 1 / session.activeViewport.width
    texel[1] = 1 / session.activeViewport.height
    texel[2] = this.#isWebGL ? 0 : 1
    graph._inputClamp(this.#options.input, session, uniforms.uFxInputClamp as Float32Array)
    const table = this.#options.table()
    // The table is read whole: half a texel in from each edge, so a tap at a texel's centre stays inside.
    const clamp = uniforms.uFxInput2Clamp as Float32Array
    clamp[0] = 0.5 / table.pixelWidth
    clamp[1] = 0.5 / table.pixelHeight
    clamp[2] = 1 - clamp[0]
    clamp[3] = 1 - clamp[1]
    this.#header.update()
    this.#fx.setResource(graph._texture(this.#options.input, session).source, 1)
    this.#fx.setResource(table, 3)
    const shader = this.#shader
    shader.groups[0] = session.globalBindGroup
    shader.groups[1] = getCameraData(camera).bindGroup
    shader.groups[2] = this.#fx
    shader.groups[3] = this.#fxh
    this.pipe.renderGeometry(fullscreenTriangleGeometry(), shader, this.#state)
  }

  override destroy(): void {
    this.#shader?.destroy()
    this.#shader = null
    this.#fx.destroy()
    this.#fxh.destroy()
  }
}
