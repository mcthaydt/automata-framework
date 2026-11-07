import { Filter } from 'pixi.js'
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
}

/** A declared filter, as `postFilter` returns it and `PixiRendererOptions.postFilters` takes it. */
export interface PostFilterDef {
  readonly name: string
  readonly glsl: string
  readonly wgsl: string
  readonly order: number
  readonly minTier: QualityTier | undefined
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
  tryFilter<F extends Filter>(id: string, make: () => F): F | undefined
}

/** Builds each declared filter through `tryFilter` and sets the ones that build in the stage's slot. */
export function addPostFilters(stage: PostFilterStage, defs: readonly PostFilterDef[]): void {
  for (const def of defs) {
    const filter = stage.tryFilter(def.name, () => new Filter(filterPrograms(def.name, def.glsl, def.wgsl)))
    if (filter !== undefined) stage.postFilters.set(def.name, [filter], def.order, { minTier: def.minTier })
  }
}
