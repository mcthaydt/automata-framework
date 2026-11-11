// The LCD panel as a post pass over the pixel-art look's field. A `PostEffect`, so it takes its place in the look's
// pass list (`addLcdPanelPass`); its profile is Zod-checked (lcd-profile.schema.ts) and can be changed while it runs.

import { type EffectFragment, PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { LCD_UNIFORMS, lcdUniformValues } from './lcd-geometry.ts'
import { type LcdProfile, parseLcdProfile } from './lcd-profile.schema.ts'
import { LCD_GLSL, LCD_WGSL } from './lcd-shader.ts'

export class LcdPanelEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = { gpu: LCD_WGSL, gl: LCD_GLSL }
  protected override readonly uniforms: UniformGroup
  #profile: LcdProfile
  #scale = 1

  /** `profile` is what a game sets of it (the rest is the clinic's). `enabled: false` leaves the pass out of the frame. */
  constructor(profile: unknown = {}, options: { readonly enabled?: boolean } = {}) {
    super(options)
    this.#profile = parseLcdProfile(profile)
    this.uniforms = new UniformGroup(
      Object.fromEntries(LCD_UNIFORMS.map((name) => [name, { value: 0, type: 'f32' as const }])),
    )
    this.#write()
  }

  #write(): void {
    const values = lcdUniformValues(this.#profile, this.#scale)
    for (const name of LCD_UNIFORMS) this.uniforms.uniforms[name] = values[name]
  }

  get profile(): LcdProfile {
    return this.#profile
  }

  /** Swaps the profile (checked, and the rest filled with the clinic's numbers). */
  set profile(value: unknown) {
    this.#profile = parseLcdProfile(value)
    this.#write()
  }

  /** Multiplies the cell, so the mesh keeps its pitch on a coarser field: 1 by default. */
  set scale(value: number) {
    if (!(value >= 1) || value === this.#scale) return
    this.#scale = value
    this.#write()
  }
}
