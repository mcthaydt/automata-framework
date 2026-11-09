// The stepped-light material: Pixi 3D's Blinn-Phong with its lighting replaced by one that cuts the summed light (direct
// plus ambient, as one grey level) into whole steps before it multiplies the albedo, so a lit surface moves in the same
// steps `rampLit` moves a palette colour (ramp-light.ts). Built with `createLightingBit`, which keeps the engine's light
// loop, attenuation and shadows; only the shading is ours. WGSL and GLSL twins.
// Measured in spikes/3d-look (ADR 0007).

import {
  createLightingBit,
  PhongMaterial,
  type PhongMaterialOptions,
  type ShaderBit,
  type ShaderDescriptor,
  type View3D,
} from '@pixi/3d'

/** Light above this does not climb the ramp further (the source's `light.max`). */
const MAX_LIGHT = 1.6

/** One lighting bit per step count: its shader text names the count, so the bit is built once for each. */
const BITS = new Map<number, ShaderBit>()

function rampLightingBit(steps: number): ShaderBit {
  const known = BITS.get(steps)
  if (known) return known
  const n = (steps - 1).toFixed(1)
  const max = MAX_LIGHT.toFixed(2)
  const bit = createLightingBit({
    name: `afRampLighting${steps}`,
    preLighting: { gpu: 'var direct = 0.0;', gl: 'float direct = 0.0;' },
    perLight: {
      gpu: 'direct += dot(light.color, vec3<f32>(0.3333)) * nDotL * attenuation * shadow;',
      gl: 'direct += dot(light.color, vec3(0.3333)) * nDotL * attenuation * shadow;',
    },
    postLighting: {
      gpu: `
let level = dot(global.uGlobalLightParams.xyz / 3.14159 + sampleEnvironment(normal, 1.0), vec3<f32>(0.3333));
let stepped = floor(clamp(direct + level, 0.0, ${max}) * ${n} + 0.5) / ${n};
finalColor = albedo * stepped + emissive;`,
      gl: `
float level = dot(uGlobalLightParams.xyz / 3.14159 + sampleEnvironment(normal, 1.0), vec3(0.3333));
float stepped = floor(clamp(direct + level, 0.0, ${max}) * ${n} + 0.5) / ${n};
finalColor = albedo * stepped + emissive;`,
    },
  })
  BITS.set(steps, bit)
  return bit
}

export interface RampMaterialOptions extends PhongMaterialOptions {
  /** Whole steps light is cut into (the look's `steps`). */
  readonly steps?: number
}

export class RampMaterial extends PhongMaterial {
  readonly steps: number

  constructor(options: RampMaterialOptions = {}) {
    super(options)
    this.steps = options.steps ?? 5
  }

  override getPrimaryDescriptor(view: View3D): ShaderDescriptor {
    const descriptor = super.getPrimaryDescriptor(view)
    const bit = rampLightingBit(this.steps)
    const swap = (bits: ShaderBit[]): ShaderBit[] => bits.map((b) => (b.name === 'phongLighting' ? bit : b))
    // Idempotent: the descriptor is cached per environment, and a swapped one has no `phongLighting` left to swap.
    if (descriptor.bitsGl.some((b) => b.name === 'phongLighting'))
      descriptor.update({ bitsGpu: swap(descriptor.bitsGpu), bitsGl: swap(descriptor.bitsGl) })
    return descriptor
  }
}
