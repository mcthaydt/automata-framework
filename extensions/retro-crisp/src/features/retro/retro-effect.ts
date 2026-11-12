// The retro pass as a post effect over the pixel-art look's field. Its profile is Zod-checked (retro-profile.schema.ts)
// and can be swapped while it runs; `clock` drives the film's grain and dust.

import { type EffectFragment, PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { parseRetroProfile, type RetroProfile } from './retro-profile.schema.ts'
import { RETRO_GLSL, RETRO_WGSL } from './retro-shader.ts'
import { RETRO_UNIFORMS, retroUniformValues } from './retro-uniforms.ts'

export class RetroEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = { gpu: RETRO_WGSL, gl: RETRO_GLSL }
  protected override readonly uniforms: UniformGroup
  #profile: RetroProfile
  #time = 0

  /** `profile` is what a game sets of it (the rest is the clinic's). `enabled: false` leaves the pass out of the frame. */
  constructor(profile: unknown = {}, options: { readonly enabled?: boolean } = {}) {
    super(options)
    this.#profile = parseRetroProfile(profile)
    this.uniforms = new UniformGroup(
      Object.fromEntries(RETRO_UNIFORMS.map((name) => [name, { value: 0, type: 'f32' as const }])),
    )
    this.#write()
  }

  #write(): void {
    const values = retroUniformValues(this.#profile, this.#time)
    for (const name of RETRO_UNIFORMS) this.uniforms.uniforms[name] = values[name]
  }

  get profile(): RetroProfile {
    return this.#profile
  }

  /** Swaps the profile (checked, and the rest filled with the clinic's numbers). */
  set profile(value: unknown) {
    this.#profile = parseRetroProfile(value)
    this.#write()
  }

  /** The game's clock, in seconds, for the film's grain and dust. */
  get clock(): number {
    return this.#time
  }

  set clock(seconds: number) {
    this.#time = seconds
    this.uniforms.uniforms.uFilmTime = seconds
  }
}
