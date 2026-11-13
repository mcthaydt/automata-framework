import { Filter, UniformGroup } from 'pixi.js'
import type { QualityTier } from '../../../shared/runtime/display-settings.schema.ts'
import { filterPrograms } from './filter-programs.js'
import type { PostFilterSlot } from './post-filter-slot.js'

/**
 * What a screen-space filter is made of: the same effect written twice, for WebGL2 (`glsl`) and WebGPU (`wgsl`),
 * so the two renderers stay at parity. Both are fragment shaders that `filterPrograms` joins to the shared vertex
 * stage: GLSL reads `vTextureCoord`, `vPixelCoord` and `uTexture`; WGSL has `mainFragment(input: VSOutput)`.
 */
export interface PostFilterSpec {
  /** The GLSL ES 3.00 fragment shader, run under WebGL2. */
  readonly glsl: string
  /** The WGSL fragment shader, run under WebGPU; its entry point is `mainFragment`. */
  readonly wgsl: string
  /** Where it sits among the stage's filters: lower runs first, ties by name. Default 0. */
  readonly order?: number | undefined
  /** The lowest quality tier it runs at; left out, it runs at every tier. */
  readonly minTier?: QualityTier | undefined
  /**
   * Where it runs. `'field'` (the default): on the picture at the game's logical size, before it is upscaled.
   * `'screen'`: on the upscaled picture, at device pixels, so a pattern can be finer than a field pixel and sit on its
   * edges (an LCD mesh between pixel-art texels). A screen filter is given `uScreenScale`, device pixels a field pixel,
   * and `uScreenOrigin`, where the field's top-left lies in device pixels of the filter's input; a device pixel's
   * position in the field is `vTextureCoord * uInputPixel.xy - uScreenOrigin` (WGSL: `screen.uScreenScale`,
   * `screen.uScreenOrigin`, `gfu.uInputPixel`). The slot declares them; the shader must not. It needs the
   * renderer's composite (`pixelArt` on): without one it is left out with a warning.
   */
  readonly at?: PostFilterPlacement | undefined
}

/** Where a declared filter runs: on the field at its logical size, or on the upscaled picture at device pixels. */
export type PostFilterPlacement = 'field' | 'screen'

/** A declared filter, as `postFilter` returns it and `PixiRendererOptions.postFilters` takes it. */
export interface PostFilterDef {
  readonly name: string
  readonly glsl: string
  readonly wgsl: string
  readonly order: number
  readonly minTier: QualityTier | undefined
  readonly at: PostFilterPlacement
}

/**
 * Declares a screen-space filter over the whole picture: `renderer: { postFilters: [postFilter('vignette', {
 * glsl, wgsl })] }`. The renderer builds it when it starts and keeps it in the stage's post-filter slot under
 * `name`. A filter that cannot be built, or whose GLSL does not link, is left out with a warning and the frame
 * draws without it. Throws when the name or either shader is empty.
 */
export function postFilter(name: string, spec: PostFilterSpec): PostFilterDef {
  if (name.trim() === '') throw new Error('postFilter: name is empty')
  for (const field of ['glsl', 'wgsl'] as const)
    if (spec[field].trim() === '') throw new Error(`postFilter "${name}": ${field} is empty`)
  return Object.freeze({
    name,
    glsl: spec.glsl,
    wgsl: spec.wgsl,
    order: spec.order ?? 0,
    minTier: spec.minTier,
    at: spec.at ?? 'field',
  })
}

/** Throws when two declared filters share a name: the slot keys its owners by name and would drop the first. */
export function assertUniqueNames(defs: readonly PostFilterDef[]): void {
  const seen = new Set<string>()
  for (const { name } of defs) {
    if (seen.has(name)) throw new Error(`postFilter "${name}" is declared twice`)
    seen.add(name)
  }
}

/** The part of a stage that `addPostFilters` needs. */
export interface PostFilterStage {
  readonly postFilters: PostFilterSlot
  /** The slot on the upscaled picture; absent when there is no composite, and a screen filter is then left out. */
  readonly screenFilters?: PostFilterSlot | undefined
  tryFilter<F extends Filter>(id: string, make: () => F): F | undefined
}

// The screen uniforms, declared ahead of a screen filter's own source. In GLSL they go after a `#version` line when the
// source has one (Pixi adds it otherwise); in WGSL they are the group after the filter's own (`@group(1)`).
const SCREEN_GLSL = 'uniform float uScreenScale;\nuniform vec2 uScreenOrigin;\n'
const SCREEN_WGSL = `struct ScreenUniforms { uScreenScale: f32, uScreenOrigin: vec2<f32> };
@group(1) @binding(0) var<uniform> screen: ScreenUniforms;
`

/** `glsl` with the screen uniforms declared at its top, after its `#version` line if it has one. */
function withScreenGlsl(glsl: string): string {
  const version = /^\s*#version[^\n]*\n/.exec(glsl)
  return version ? `${version[0]}${SCREEN_GLSL}${glsl.slice(version[0].length)}` : `${SCREEN_GLSL}${glsl}`
}

/** The uniforms a screen filter reads; the renderer writes them each frame (`updateScreenUniforms`). */
function screenUniforms(): UniformGroup {
  return new UniformGroup({
    uScreenScale: { value: 1, type: 'f32' },
    uScreenOrigin: { value: new Float32Array(2), type: 'vec2<f32>' },
  })
}

/** Builds a screen filter: its programs with the screen uniforms declared, and the group that feeds them. */
function makeScreenFilter(def: PostFilterDef): Filter {
  return new Filter({
    ...filterPrograms(def.name, withScreenGlsl(def.glsl), `${SCREEN_WGSL}${def.wgsl}`),
    // Keyed by the WGSL variable's name: WebGPU binds a filter's resources by name (GLSL by each uniform's own name).
    resources: { screen: screenUniforms() },
  })
}

/**
 * Writes where the field lies on the screen into every screen filter in `filters`: `scale` device pixels a field pixel,
 * and `origin`, the field's top-left in device pixels. The filter's input starts at the first whole device pixel the
 * field covers (Pixi floors its bounds to the device grid), so the origin it is told is the fraction left over, or the
 * whole offset when the field starts off the canvas's left or top edge.
 */
export function updateScreenUniforms(
  filters: readonly Filter[] | null,
  scale: number,
  origin: readonly [number, number],
): void {
  for (const filter of filters ?? []) {
    const group = (filter.resources as { screen?: UniformGroup }).screen
    if (group === undefined) continue
    group.uniforms.uScreenScale = scale
    const at = group.uniforms.uScreenOrigin as Float32Array
    at[0] = origin[0] - Math.floor(Math.max(origin[0], 0))
    at[1] = origin[1] - Math.floor(Math.max(origin[1], 0))
    group.update()
  }
}

/**
 * Builds each declared filter through `tryFilter` and sets the ones that build in the stage's slot for where they run:
 * `postFilters` for the field, `screenFilters` for the screen.
 */
export function addPostFilters(stage: PostFilterStage, defs: readonly PostFilterDef[]): void {
  for (const def of defs) {
    if (def.at === 'screen') {
      const slot = stage.screenFilters
      const filter = stage.tryFilter(def.name, () => {
        if (slot === undefined)
          throw new Error("an at: 'screen' filter needs the renderer's composite (pixelArt)")
        return makeScreenFilter(def)
      })
      if (filter !== undefined) slot?.set(def.name, [filter], def.order, { minTier: def.minTier })
      continue
    }
    const filter = stage.tryFilter(def.name, () => new Filter(filterPrograms(def.name, def.glsl, def.wgsl)))
    if (filter !== undefined) stage.postFilters.set(def.name, [filter], def.order, { minTier: def.minTier })
  }
}
